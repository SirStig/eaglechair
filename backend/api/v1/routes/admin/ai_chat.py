"""
Admin AI Chat Routes

REST + WebSocket endpoints for the EagleChair AI assistant.

Endpoints:
  GET    /admin/ai/chats              - List chat sessions
  POST   /admin/ai/chats              - Create new chat session
  GET    /admin/ai/chats/{id}         - Get chat with messages
  PATCH  /admin/ai/chats/{id}         - Update chat (title, pin, etc.)
  DELETE /admin/ai/chats/{id}         - Delete chat session
  DELETE /admin/ai/chats/{id}/messages/{msg_id} - Delete message in chat
  POST   /admin/ai/chats/{id}/upload  - Upload file to chat
  GET    /admin/ai/memory             - Get AI memory entries
  PUT    /admin/ai/memory/{key}       - Update/create memory entry
  DELETE /admin/ai/memory/{key}       - Delete memory entry
  GET    /admin/ai/training           - List training documents
  POST   /admin/ai/training           - Upload training document
  DELETE /admin/ai/training/{id}      - Delete training document
  GET    /admin/ai/edits              - List AI-proposed changes (by session / status)
  POST   /admin/ai/edits/apply        - Approve + apply proposed changes
  POST   /admin/ai/edits/decline      - Decline proposed changes
  POST   /admin/ai/ws-ticket          - One-time ticket for the WebSocket
  WS     /admin/ai/ws/{chat_id}       - WebSocket for streaming chat
"""

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy import select, delete, update, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.dependencies import get_current_admin, require_role
from backend.core.config import settings
from backend.core.ephemeral_store import ephemeral_store
from backend.models.company import AdminAuditLog, AdminRole, AdminUser
from backend.core.security import SecurityManager
from backend.database.base import get_db, AsyncSessionLocal
from backend.utils.file_validation import PRIVATE_UPLOAD_DIR
from backend.models.ai_chat import (
    AIChatSession,
    AIChatMessage,
    AIMemory,
    AITrainingDocument,
    AIUploadedFile,
    AIFileType,
    AIProposedEdit,
    MessageRole,
    ProposalStatus,
    TrainingStatus,
)
from backend.services.ai_catalog_tools import (
    ChangeError,
    apply_proposal,
    serialize_proposal,
    validate_change,
)
from backend.services.ai_service import (
    AIStreamEvent,
    ToolContext,
    build_system_prompt,
    extract_memory_from_conversation,
    fetch_valid_reference_ids,
    generate_chat_title,
    get_eaglechair_context,
    process_training_document,
    process_uploaded_file,
    stream_ai_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()

CHAT_MODES = {"ask", "edit", "agent"}
CHAT_MODEL_OPTIONS = {"auto", "max", "deep"}

# Upload directories for AI files: private (not under the public /uploads mount),
# resolved relative to the repository rather than the process CWD
AI_UPLOADS_DIR = PRIVATE_UPLOAD_DIR / "ai"
AI_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

TRAINING_UPLOADS_DIR = PRIVATE_UPLOAD_DIR / "ai_training"
TRAINING_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

AI_UPLOAD_MAX_BYTES = 25 * 1024 * 1024  # 25MB per file
AI_CHAT_UPLOAD_EXTENSIONS = {
    ".pdf", ".csv", ".xlsx", ".xls", ".xlsm", ".txt", ".md", ".json",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
}
AI_TRAINING_UPLOAD_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls", ".xlsm", ".txt", ".md"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _validated_upload_extension(filename: str, allowed: set[str]) -> str:
    """Return the lowercased extension if allowed, otherwise raise 400."""
    ext = Path(filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type '{ext or 'unknown'}' is not allowed")
    return ext


async def _read_upload_limited(file: UploadFile) -> bytes:
    """Read an upload, rejecting files larger than AI_UPLOAD_MAX_BYTES."""
    content = await file.read(AI_UPLOAD_MAX_BYTES + 1)
    if len(content) > AI_UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25MB size limit")
    return content


def detect_file_type(filename: str, content_type: str = "") -> AIFileType:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return AIFileType.PDF
    elif ext == ".csv":
        return AIFileType.CSV
    elif ext in (".xlsx", ".xls", ".xlsm"):
        return AIFileType.EXCEL
    elif ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"):
        return AIFileType.IMAGE
    elif ext in (".txt", ".md", ".json", ".xml", ".html", ".py", ".js"):
        return AIFileType.TEXT
    elif "image" in content_type:
        return AIFileType.IMAGE
    elif "pdf" in content_type:
        return AIFileType.PDF
    else:
        return AIFileType.OTHER


async def get_session_or_404(session_id: str, db: AsyncSession, admin) -> AIChatSession:
    admin_id = getattr(admin, "id", None)
    if admin_id is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.id == session_id, AIChatSession.admin_user_id == admin_id)
        .options(selectinload(AIChatSession.messages))
        .options(selectinload(AIChatSession.files))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


async def get_session_basic(session_id: str, db: AsyncSession, admin) -> AIChatSession:
    admin_id = getattr(admin, "id", None)
    if admin_id is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.id == session_id, AIChatSession.admin_user_id == admin_id)
        .options(selectinload(AIChatSession.files))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


async def load_active_memory(db: AsyncSession, admin_id: int | None) -> list[dict]:
    q = select(AIMemory).where(AIMemory.is_active == True)
    if admin_id is not None:
        q = q.where(AIMemory.admin_user_id == admin_id)
    else:
        q = q.where(AIMemory.admin_user_id.is_(None))
    result = await db.execute(
        q.order_by(desc(AIMemory.importance), desc(AIMemory.updated_at)).limit(50)
    )
    return [
        {"key": m.key, "value": m.value, "category": m.category, "importance": m.importance}
        for m in result.scalars().all()
    ]


async def load_training_summaries(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(AITrainingDocument)
        .where(
            AITrainingDocument.is_active == True,
            AITrainingDocument.status == TrainingStatus.COMPLETED,
        )
        .order_by(desc(AITrainingDocument.created_at))
        .limit(20)
    )
    return [
        {
            "name": d.name,
            "summary": d.summary or "",
            "key_facts": d.key_facts or [],
            "structured_data": d.structured_data or "",
        }
        for d in result.scalars().all()
    ]


def serialize_session(
    session: AIChatSession,
    include_messages: bool = True,
    messages_list: list | None = None,
    proposals: dict | None = None,
) -> dict:
    data = {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "message_count": session.message_count,
        "total_tokens": session.total_tokens,
        "pinned": session.pinned,
        "is_archived": session.is_archived,
        "tags": session.tags or [],
    }
    if include_messages:
        data["messages"] = [
            serialize_message(m, proposals)
            for m in (messages_list if messages_list is not None else session.messages)
        ]
        data["files"] = [serialize_file(f) for f in session.files]
    return data


def _overlay_proposals(blocks, proposals: dict | None):
    """Replace stored edit_batch rows with their live status from ai_proposed_edits."""
    if not blocks or not proposals:
        return blocks
    out = []
    for b in blocks:
        if isinstance(b, dict) and b.get("type") == "edit_batch" and isinstance(b.get("data"), dict):
            edits = [proposals.get(e.get("id"), e) for e in b["data"].get("edits") or []]
            b = {**b, "data": {**b["data"], "edits": edits}}
        out.append(b)
    return out


def serialize_message(msg: AIChatMessage, proposals: dict | None = None) -> dict:
    return {
        "id": msg.id,
        "session_id": msg.session_id,
        "role": msg.role.value if msg.role else msg.role,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "tokens_used": msg.tokens_used,
        "web_sources": msg.web_sources or [],
        "tool_calls": msg.tool_calls or [],
        "file_ids": msg.file_ids or [],
        "suggested_edits": getattr(msg, "suggested_edits", None) or [],
        "content_blocks": _overlay_proposals(getattr(msg, "content_blocks", None), proposals),
    }


def serialize_file(f: AIUploadedFile) -> dict:
    return {
        "id": f.id,
        "original_filename": f.original_filename,
        "file_type": f.file_type.value if f.file_type else f.file_type,
        "file_size": f.file_size,
        "is_processed": f.is_processed,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Chat Session Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/chats")
async def list_chats(
    archived: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    admin_id = getattr(admin, "id", None)
    if admin_id is None:
        return []
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.admin_user_id == admin_id, AIChatSession.is_archived == archived)
        .order_by(desc(AIChatSession.pinned), desc(AIChatSession.updated_at))
        .offset(offset)
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [serialize_session(s, include_messages=False) for s in sessions]


@router.post("/chats")
async def create_chat(db: AsyncSession = Depends(get_db), admin=Depends(get_current_admin)):
    admin_id = getattr(admin, "id", None)
    session = AIChatSession(
        id=str(uuid.uuid4()),
        title="New Chat",
        admin_user_id=admin_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return serialize_session(session, include_messages=False)


MESSAGE_LIMIT_DEFAULT = 100
MESSAGE_LIMIT_MAX = 200


@router.get("/chats/{session_id}")
async def get_chat(
    session_id: str,
    limit: int = MESSAGE_LIMIT_DEFAULT,
    before_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    limit = min(max(1, limit), MESSAGE_LIMIT_MAX)
    session = await get_session_basic(session_id, db, admin)
    q = select(AIChatMessage).where(AIChatMessage.session_id == session_id)
    if before_id:
        subq = select(AIChatMessage.created_at).where(
            AIChatMessage.id == before_id, AIChatMessage.session_id == session_id
        ).scalar_subquery()
        q = q.where(AIChatMessage.created_at < subq)
    result = await db.execute(q.order_by(AIChatMessage.created_at.desc()).limit(limit))
    msgs = list(result.scalars().all())
    msgs.reverse()
    has_more = len(msgs) >= limit
    if not before_id:
        count_row = await db.execute(
            select(func.count(AIChatMessage.id)).where(AIChatMessage.session_id == session_id)
        )
        total = count_row.scalar() or 0
        has_more = total > limit
    proposal_rows = await db.execute(
        select(AIProposedEdit).where(
            AIProposedEdit.session_id == session_id,
            AIProposedEdit.message_id.in_([m.id for m in msgs] or [""]),
        )
    )
    proposals = {p.id: serialize_proposal(p) for p in proposal_rows.scalars().all()}
    data = serialize_session(session, messages_list=msgs, proposals=proposals)
    data["has_more"] = has_more
    return data


@router.patch("/chats/{session_id}")
async def update_chat(
    session_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    session = await get_session_or_404(session_id, db, admin)
    if "title" in body:
        title = body["title"]
        session.title = title[:255] if title is not None else None
    if "pinned" in body:
        session.pinned = bool(body["pinned"])
    if "is_archived" in body:
        session.is_archived = bool(body["is_archived"])
    if "tags" in body:
        session.tags = body["tags"]
    await db.commit()
    return {"success": True}


@router.delete("/chats/{session_id}")
async def delete_chat(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    admin_id = getattr(admin, "id", None)
    if admin_id is not None:
        await db.execute(
            delete(AIChatSession).where(
                AIChatSession.id == session_id,
                AIChatSession.admin_user_id == admin_id,
            )
        )
    await db.commit()
    return {"success": True}


@router.delete("/chats/{session_id}/messages/{message_id}")
async def delete_chat_message(
    session_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    session = await get_session_basic(session_id, db, admin)
    result = await db.execute(
        select(AIChatMessage).where(
            AIChatMessage.id == message_id,
            AIChatMessage.session_id == session_id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await db.delete(msg)
    session.message_count = max(0, (session.message_count or 0) - 1)
    session.total_tokens = max(0, (session.total_tokens or 0) - (msg.tokens_used or 0))
    await db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# File Upload
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chats/{session_id}/upload")
async def upload_file_to_chat(
    session_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    session = await get_session_or_404(session_id, db, admin)
    file_type = detect_file_type(file.filename or "", file.content_type or "")
    file_id = str(uuid.uuid4())
    ext = _validated_upload_extension(file.filename or "", AI_CHAT_UPLOAD_EXTENSIONS)
    save_path = AI_UPLOADS_DIR / f"{file_id}{ext}"

    content = await _read_upload_limited(file)
    save_path.write_bytes(content)

    db_file = AIUploadedFile(
        id=file_id,
        session_id=session_id,
        original_filename=file.filename or "upload",
        file_path=str(save_path),
        file_type=file_type,
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)

    # Process immediately in background
    async def process_bg():
        try:
            async with AsyncSessionLocal() as bg_db:
                processed = await process_uploaded_file(
                    str(save_path), file_type.value, file.filename or "upload"
                )
                await bg_db.execute(
                    update(AIUploadedFile)
                    .where(AIUploadedFile.id == file_id)
                    .values(processed_content=processed, is_processed=True)
                )
                await bg_db.commit()
        except Exception as e:
            logger.error(f"Background file processing failed: {e}")

    await db.commit()

    asyncio.create_task(process_bg())

    return {
        "file_id": file_id,
        "filename": file.filename,
        "file_type": file_type.value,
        "file_size": len(content),
    }


# ─────────────────────────────────────────────────────────────────────────────
# AI Memory Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/memory")
async def get_memory(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    admin_id = getattr(admin, "id", None)
    q = select(AIMemory).where(AIMemory.is_active == True)
    if admin_id is not None:
        q = q.where(AIMemory.admin_user_id == admin_id)
    else:
        q = q.where(AIMemory.admin_user_id.is_(None))
    result = await db.execute(q.order_by(desc(AIMemory.importance), desc(AIMemory.updated_at)))
    memories = result.scalars().all()
    return [
        {
            "id": m.id,
            "key": m.key,
            "value": m.value,
            "category": m.category,
            "importance": m.importance,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
        for m in memories
    ]


@router.put("/memory/{key}")
async def upsert_memory(
    key: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    admin_id = getattr(admin, "id", None)
    if admin_id is None:
        raise HTTPException(status_code=400, detail="Admin user required")
    q = select(AIMemory).where(AIMemory.key == key, AIMemory.admin_user_id == admin_id)
    result = await db.execute(q)
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = body.get("value", existing.value)
        existing.category = body.get("category", existing.category)
        existing.importance = body.get("importance", existing.importance)
        existing.is_active = True
    else:
        db.add(AIMemory(
            id=str(uuid.uuid4()),
            admin_user_id=admin_id,
            key=key,
            value=body.get("value", ""),
            category=body.get("category", "general"),
            importance=body.get("importance", 0.5),
        ))
    await db.commit()
    return {"success": True}


@router.post("/apply-edit")
async def apply_edit(
    body: dict,
    admin=Depends(require_role(AdminRole.ADMIN)),
):
    """
    Apply a legacy single suggested edit (messages from before proposal batches).
    Body: {entity_type, entity_id, changes}
    """
    if not isinstance(body, dict) or not body.get("entity_type") or body.get("entity_id") is None or not body.get("changes"):
        raise HTTPException(status_code=400, detail="entity_type, entity_id, and changes required")
    async with AsyncSessionLocal() as db:
        try:
            norm = await validate_change(db, {**body, "action": "update"})
        except ChangeError as e:
            raise HTTPException(status_code=400, detail=str(e))
        proposal = AIProposedEdit(id=str(uuid.uuid4()), batch_id="legacy", **{**norm, "before": None})
        result = await apply_proposal(db, proposal)
    if result["status"] != "applied":
        raise HTTPException(status_code=400, detail=result.get("error") or "Could not apply edit")
    logger.info(f"Admin {admin.id} applied legacy AI edit to {norm['entity_type']} {norm['entity_id']}")
    return {"success": True, "entity_type": norm["entity_type"], "entity_id": norm["entity_id"]}


# ─────────────────────────────────────────────────────────────────────────────
# AI-proposed changes (review queue)
# ─────────────────────────────────────────────────────────────────────────────

MAX_EDIT_IDS_PER_REQUEST = 500


def _edit_ids(body) -> list[str]:
    ids = body.get("ids") if isinstance(body, dict) else None
    if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
        raise HTTPException(status_code=400, detail="ids must be a non-empty list of proposal ids")
    if len(ids) > MAX_EDIT_IDS_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"At most {MAX_EDIT_IDS_PER_REQUEST} ids per request")
    return list(dict.fromkeys(ids))


async def _load_own_proposals(db: AsyncSession, ids: list[str], admin_id: int) -> dict[str, AIProposedEdit]:
    rows = await db.execute(
        select(AIProposedEdit)
        .where(AIProposedEdit.id.in_(ids), AIProposedEdit.admin_user_id == admin_id)
        .order_by(AIProposedEdit.batch_id, AIProposedEdit.position)
    )
    return {p.id: p for p in rows.scalars().all()}


@router.get("/edits")
async def list_proposed_edits(
    session_id: str | None = None,
    status: str | None = None,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = select(AIProposedEdit).where(AIProposedEdit.admin_user_id == admin.id)
    if session_id:
        q = q.where(AIProposedEdit.session_id == session_id)
    if status:
        q = q.where(AIProposedEdit.status == status)
    q = q.order_by(desc(AIProposedEdit.created_at), AIProposedEdit.position).limit(min(max(1, limit), 2000))
    return [serialize_proposal(p) for p in (await db.execute(q)).scalars().all()]


@router.post("/edits/apply")
async def apply_proposed_edits(
    body: dict,
    admin=Depends(require_role(AdminRole.ADMIN)),
):
    """
    Approve and apply proposals in order. Each one commits on its own, so one
    failure doesn't block the rest. Body: {ids: [...], force?: bool}
    """
    ids = _edit_ids(body)
    force = bool(body.get("force"))
    results = []
    async with AsyncSessionLocal() as db:
        proposals = await _load_own_proposals(db, ids, admin.id)
        for pid in ids:
            p = proposals.get(pid)
            if p is None:
                results.append({"id": pid, "status": "failed", "error": "Proposal not found", "conflict": False})
                continue
            if p.status != ProposalStatus.PENDING.value:
                results.append({"id": pid, "status": p.status, "error": p.error, "conflict": False, "entity_id": p.entity_id})
                continue
            try:
                outcome = await apply_proposal(db, p, force=force)
            except Exception as e:  # never let one bad row abort the whole batch
                logger.exception(f"Applying AI proposal {pid} failed")
                await db.rollback()
                outcome = {"status": "failed", "error": f"Unexpected error: {type(e).__name__}", "conflict": False}

            # Re-load: apply_proposal may have rolled back / expired the session
            p = await db.get(AIProposedEdit, pid)
            if outcome["status"] in (ProposalStatus.APPLIED.value, ProposalStatus.FAILED.value):
                p.status = outcome["status"]
                p.error = outcome.get("error")
                p.resolved_at = datetime.utcnow()
                p.resolved_by_id = admin.id
                if outcome.get("entity_id") and not p.entity_id:
                    p.entity_id = outcome["entity_id"]
                if outcome["status"] == ProposalStatus.APPLIED.value:
                    db.add(AdminAuditLog(
                        admin_id=admin.id,
                        action=f"AI_{p.action.upper()}_{p.entity_type.upper()}",
                        resource_type=p.entity_type,
                        resource_id=p.entity_id,
                        details={"proposal_id": p.id, "batch_id": p.batch_id, "changes": p.changes, "before": p.before},
                        timestamp=datetime.utcnow().isoformat(),
                    ))
                await db.commit()
            results.append({"id": pid, **outcome, "entity_id": p.entity_id, "proposal": serialize_proposal(p)})
    applied = sum(1 for r in results if r["status"] == "applied")
    logger.info(f"Admin {admin.id} applied {applied}/{len(ids)} AI proposals")
    return {"results": results, "applied": applied}


@router.post("/edits/decline")
async def decline_proposed_edits(
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    ids = _edit_ids(body)
    proposals = await _load_own_proposals(db, ids, admin.id)
    results = []
    for pid in ids:
        p = proposals.get(pid)
        if p is None:
            results.append({"id": pid, "status": "failed", "error": "Proposal not found"})
            continue
        if p.status == ProposalStatus.PENDING.value:
            p.status = ProposalStatus.DECLINED.value
            p.resolved_at = datetime.utcnow()
            p.resolved_by_id = admin.id
        results.append({"id": pid, "status": p.status, "proposal": serialize_proposal(p)})
    await db.commit()
    return {"results": results}


async def _proposal_status_summary(db: AsyncSession, session_id: str) -> str | None:
    """Short recap of this chat's proposals for the system prompt, so the AI knows what was approved."""
    rows = (await db.execute(
        select(AIProposedEdit)
        .where(AIProposedEdit.session_id == session_id)
        .order_by(AIProposedEdit.created_at, AIProposedEdit.position)
    )).scalars().all()
    if not rows:
        return None
    batches: dict[str, list] = {}
    for p in rows:
        batches.setdefault(p.batch_id, []).append(p)
    lines = []
    for batch in list(batches.values())[-15:]:
        counts: dict[str, int] = {}
        for p in batch:
            counts[p.status] = counts.get(p.status, 0) + 1
        summary = ", ".join(f"{n} {s}" for s, n in counts.items())
        lines.append(f"- \"{batch[0].batch_title}\" ({len(batch)} changes): {summary}")
        for p in batch:
            if p.status in ("failed", "declined"):
                detail = f": {p.error}" if p.error else ""
                lines.append(f"  - {p.status} {p.action} {p.entity_type} {p.entity_id or ''} {p.entity_name or ''}{detail}"[:300])
    lines.append("Pending changes are still awaiting review; don't re-propose them. Re-propose failed ones only after fixing the cause.")
    return "\n".join(lines)


@router.delete("/memory/{key}")
async def delete_memory(
    key: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    admin_id = getattr(admin, "id", None)
    if admin_id is not None:
        await db.execute(
            update(AIMemory).where(
                AIMemory.key == key,
                AIMemory.admin_user_id == admin_id,
            ).values(is_active=False)
        )
    await db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# Training Documents
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/training")
async def list_training_docs(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    result = await db.execute(
        select(AITrainingDocument)
        .where(AITrainingDocument.is_active == True)
        .order_by(desc(AITrainingDocument.created_at))
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "file_type": d.file_type.value if d.file_type else None,
            "original_filename": d.original_filename,
            "file_size": d.file_size,
            "status": d.status.value if d.status else None,
            "summary": d.summary,
            "key_facts": d.key_facts or [],
            "structured_data": getattr(d, "structured_data", None) or "",
            "tags": d.tags or [],
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "processed_at": d.processed_at.isoformat() if d.processed_at else None,
            "error_message": d.error_message,
        }
        for d in docs
    ]


@router.post("/training")
async def upload_training_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_role(AdminRole.ADMIN)),
):
    file_type = detect_file_type(file.filename or "", file.content_type or "")
    doc_id = str(uuid.uuid4())
    ext = _validated_upload_extension(file.filename or "", AI_TRAINING_UPLOAD_EXTENSIONS)
    save_path = TRAINING_UPLOADS_DIR / f"{doc_id}{ext}"

    content = await _read_upload_limited(file)
    save_path.write_bytes(content)

    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    doc = AITrainingDocument(
        id=doc_id,
        name=name[:255],
        description=description,
        file_type=file_type,
        original_filename=file.filename or "upload",
        file_path=str(save_path),
        file_size=len(content),
        status=TrainingStatus.PENDING,
        tags=tags_list,
    )
    db.add(doc)
    await db.commit()

    # Start processing in background
    async def process_training_bg():
        try:
            async with AsyncSessionLocal() as bg_db:
                await bg_db.execute(
                    update(AITrainingDocument)
                    .where(AITrainingDocument.id == doc_id)
                    .values(status=TrainingStatus.PROCESSING)
                )
                await bg_db.commit()

                result = await process_training_document(
                    str(save_path), file_type.value, file.filename or "upload", name
                )

                if result["success"]:
                    await bg_db.execute(
                        update(AITrainingDocument)
                        .where(AITrainingDocument.id == doc_id)
                        .values(
                            status=TrainingStatus.COMPLETED,
                            processed_content=result["processed_content"],
                            summary=result["summary"],
                            key_facts=result["key_facts"],
                            structured_data=result.get("structured_data") or "",
                            processed_at=datetime.utcnow(),
                        )
                    )
                else:
                    await bg_db.execute(
                        update(AITrainingDocument)
                        .where(AITrainingDocument.id == doc_id)
                        .values(
                            status=TrainingStatus.FAILED,
                            error_message=result.get("error", "Unknown error"),
                        )
                    )
                await bg_db.commit()
        except Exception as e:
            logger.error(f"Training document processing failed: {e}")
            try:
                async with AsyncSessionLocal() as bg_db:
                    await bg_db.execute(
                        update(AITrainingDocument)
                        .where(AITrainingDocument.id == doc_id)
                        .values(status=TrainingStatus.FAILED, error_message=str(e))
                    )
                    await bg_db.commit()
            except Exception:
                pass

    asyncio.create_task(process_training_bg())

    return {"document_id": doc_id, "status": "pending", "name": name}


@router.post("/training/batch")
async def upload_training_batch(
    files: list[UploadFile] = File(..., description="Multiple files; names will be derived from filenames"),
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_role(AdminRole.ADMIN)),
):
    if not files or len(files) > 200:
        raise HTTPException(status_code=400, detail="Provide 1–200 files")
    created = []
    for file in files:
        filename = file.filename or "file"
        file_type = detect_file_type(filename, file.content_type or "")
        ext = Path(filename).suffix.lower()
        if ext not in AI_TRAINING_UPLOAD_EXTENSIONS:
            continue
        doc_id = str(uuid.uuid4())
        save_path = TRAINING_UPLOADS_DIR / f"{doc_id}{ext}"
        content = await file.read(AI_UPLOAD_MAX_BYTES + 1)
        if len(content) > AI_UPLOAD_MAX_BYTES:
            continue
        save_path.write_bytes(content)
        name = Path(filename).stem[:255] or filename[:255]
        doc = AITrainingDocument(
            id=doc_id,
            name=name,
            description="",
            file_type=file_type,
            original_filename=filename,
            file_path=str(save_path),
            file_size=len(content),
            status=TrainingStatus.PENDING,
            tags=[],
        )
        db.add(doc)
        created.append({"id": doc_id, "name": name, "path": str(save_path), "file_type": file_type, "filename": filename})
    await db.commit()

    async def process_batch_sequential():
        for item in created:
            doc_id, name, path, file_type, filename = item["id"], item["name"], item["path"], item["file_type"], item["filename"]
            try:
                async with AsyncSessionLocal() as bg_db:
                    await bg_db.execute(
                        update(AITrainingDocument).where(AITrainingDocument.id == doc_id).values(status=TrainingStatus.PROCESSING)
                    )
                    await bg_db.commit()
                result = await process_training_document(path, file_type.value, filename, name)
                async with AsyncSessionLocal() as bg_db:
                    if result["success"]:
                        await bg_db.execute(
                            update(AITrainingDocument)
                            .where(AITrainingDocument.id == doc_id)
                            .values(
                                status=TrainingStatus.COMPLETED,
                                processed_content=result["processed_content"],
                                summary=result["summary"],
                                key_facts=result["key_facts"],
                                structured_data=result.get("structured_data") or "",
                                processed_at=datetime.utcnow(),
                            )
                        )
                    else:
                        await bg_db.execute(
                            update(AITrainingDocument)
                            .where(AITrainingDocument.id == doc_id)
                            .values(status=TrainingStatus.FAILED, error_message=result.get("error", "Unknown error"))
                        )
                    await bg_db.commit()
            except Exception as e:
                logger.error(f"Batch training doc {doc_id} failed: {e}")
                try:
                    async with AsyncSessionLocal() as bg_db:
                        await bg_db.execute(
                            update(AITrainingDocument)
                            .where(AITrainingDocument.id == doc_id)
                            .values(status=TrainingStatus.FAILED, error_message=str(e))
                        )
                        await bg_db.commit()
                except Exception:
                    pass

    asyncio.create_task(process_batch_sequential())
    return {"uploaded": len(created), "documents": [{"id": c["id"], "name": c["name"]} for c in created], "status": "pending"}


@router.delete("/training/{doc_id}")
async def delete_training_doc(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_role(AdminRole.ADMIN)),
):
    await db.execute(
        update(AITrainingDocument)
        .where(AITrainingDocument.id == doc_id)
        .values(is_active=False)
    )
    await db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Tickets
# ─────────────────────────────────────────────────────────────────────────────

# The WebSocket may live on a different site than the REST API (it is served
# through a tunnel that supports WebSockets), where the browser will not send
# our auth cookies. The page fetches a short-lived ticket over the cookie-
# authenticated API and passes it in the WebSocket URL instead.
WS_TICKET_TTL_SECONDS = 30


def _ws_ticket_signature(payload: bytes) -> bytes:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), b"ai-ws-ticket:" + payload, hashlib.sha256
    ).digest()


def _issue_ws_ticket(admin: AdminUser, session_id: str) -> str:
    """Signed, stateless ticket so any Gunicorn worker can verify it"""
    from webauthn.helpers import bytes_to_base64url

    payload = json.dumps(
        {
            "a": admin.id,
            "s": session_id,
            "tv": getattr(admin, "token_version", 0) or 0,
            "exp": int(time.time()) + WS_TICKET_TTL_SECONDS,
            "n": secrets.token_urlsafe(8),
        },
        separators=(",", ":"),
    ).encode("utf-8")
    return f"{bytes_to_base64url(payload)}.{bytes_to_base64url(_ws_ticket_signature(payload))}"


async def _redeem_ws_ticket(ticket: str, session_id: str) -> dict | None:
    """Verify a ticket for this chat and mark it used; None if invalid"""
    from webauthn.helpers import base64url_to_bytes

    if not ticket or len(ticket) > 1024:
        return None
    try:
        payload_b64, sig_b64 = ticket.split(".", 1)
        payload = base64url_to_bytes(payload_b64)
        if not hmac.compare_digest(base64url_to_bytes(sig_b64), _ws_ticket_signature(payload)):
            return None
        record = json.loads(payload)
        if record.get("s") != session_id or int(record["exp"]) < time.time():
            return None
    except Exception:
        return None
    # Single use (shared across workers when Redis is up, per worker otherwise)
    if await ephemeral_store.incr(f"ai-ws-ticket:{sig_b64}", WS_TICKET_TTL_SECONDS) > 1:
        return None
    return record


@router.post("/ws-ticket")
async def create_ws_ticket(
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Issue a one-time ticket (valid 30s) for opening the chat WebSocket"""
    session_id = body.get("session_id") if isinstance(body, dict) else None
    if not isinstance(session_id, str) or not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    result = await db.execute(
        select(AIChatSession.id).where(
            AIChatSession.id == session_id, AIChatSession.admin_user_id == admin.id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"ticket": _issue_ws_ticket(admin, session_id), "expires_in": WS_TICKET_TTL_SECONDS}


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Chat Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for streaming AI chat.

    Client sends:
      {"type": "message", "content": "...", "file_ids": [...]}
      {"type": "interrupt"}  - stop current stream
      {"type": "ping"}

    Server streams:
      {"type": "thinking", "data": {...}}
      {"type": "searching", "data": {"query": "...", "search_count": N}}
      {"type": "search_results", "data": {"sources": [...]}}
      {"type": "fetching_url", "data": {"url": "..."}}
      {"type": "calculating", "data": {"expression": "..."}}
      {"type": "text_chunk", "data": {"content": "..."}}
      {"type": "message_done", "data": {"message_id": "...", "tokens": N, "web_sources": [...]}}
      {"type": "error", "data": {"message": "..."}}
      {"type": "title_update", "data": {"title": "..."}}
    """
    await websocket.accept()

    # Authenticate with, in order: a one-time ?ticket= from /ws-ticket (browsers
    # when the WebSocket is on another site), the httpOnly access_token cookie
    # (browsers on the same site), or a ?token= query param (non-browser clients)
    payload = None
    ticket = websocket.query_params.get("ticket", "")
    if ticket:
        record = await _redeem_ws_ticket(ticket, session_id)
        if record is None:
            await websocket.send_json(AIStreamEvent.error("Invalid or expired ticket"))
            await websocket.close(code=4001)
            return
        payload = {"sub": str(record["a"]), "tv": record.get("tv", 0)}
    else:
        token = websocket.query_params.get("token", "")
        if not token:
            token = websocket.cookies.get("access_token", "")
            if token:
                # Cookie auth: block cross-site WebSocket hijacking
                from backend.core.middleware.csrf import CSRFOriginMiddleware, normalize_origin

                origin = normalize_origin(websocket.headers.get("origin"))
                if not origin or origin not in CSRFOriginMiddleware._trusted_origins():
                    await websocket.send_json(AIStreamEvent.error("Origin not allowed"))
                    await websocket.close(code=4003)
                    return
        if not token:
            await websocket.send_json(AIStreamEvent.error("Authentication required"))
            await websocket.close(code=4001)
            return

        try:
            payload = SecurityManager.decode_token(token)
            if payload.get("type") != "admin" or payload.get("token_type") != "access":
                raise ValueError("Not an admin access token")
        except Exception:
            await websocket.send_json(AIStreamEvent.error("Invalid or expired token"))
            await websocket.close(code=4001)
            return

    admin_id = None
    try:
        admin_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        pass
    if not admin_id:
        await websocket.send_json(AIStreamEvent.error("Invalid token"))
        await websocket.close(code=4001)
        return

    try:
        async with AsyncSessionLocal() as db:
            ws_admin = await db.get(AdminUser, admin_id)
            if (
                ws_admin is None
                or not ws_admin.is_active
                or not SecurityManager.token_version_matches(payload, ws_admin)
            ):
                await websocket.send_json(AIStreamEvent.error("Invalid or expired token"))
                await websocket.close(code=4001)
                return
            # Edit/agent modes can create products directly (create_product tool);
            # same bar as the product create/apply-edit routes.
            can_write = ws_admin.role in (AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
            result = await db.execute(
                select(AIChatSession)
                .where(AIChatSession.id == session_id, AIChatSession.admin_user_id == admin_id)
                .options(selectinload(AIChatSession.messages))
                .options(selectinload(AIChatSession.files))
            )
            session = result.scalar_one_or_none()
            if not session:
                await websocket.send_json(AIStreamEvent.error("Chat session not found"))
                await websocket.close(code=4004)
                return

        logger.info(f"WebSocket connected for session {session_id} admin={admin_id}")

        pending_message = None

        while True:
            if pending_message is None:
                try:
                    raw = await websocket.receive_text()
                    data = json.loads(raw)
                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    await websocket.send_json(AIStreamEvent.error("Invalid JSON"))
                    continue

                msg_type = data.get("type", "message")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                if msg_type == "interrupt":
                    continue

                if msg_type != "message":
                    continue

                pending_message = data

            user_content = (pending_message.get("content") or "").strip()
            file_ids = pending_message.get("file_ids", [])
            mode = pending_message.get("mode", "edit")
            if not can_write:
                mode = "ask"
            model = pending_message.get("model", "auto")
            pending_message = None

            if not user_content and not file_ids:
                await websocket.send_json(AIStreamEvent.error("Message cannot be empty"))
                continue

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(AIChatSession)
                    .where(AIChatSession.id == session_id)
                    .options(selectinload(AIChatSession.messages))
                    .options(selectinload(AIChatSession.files))
                )
                session = result.scalar_one_or_none()
                if not session:
                    await websocket.send_json(AIStreamEvent.error("Session lost"))
                    break

                full_user_content = user_content
                attached_file_content = []

                if file_ids:
                    for fid in file_ids:
                        fr = await db.execute(
                            select(AIUploadedFile).where(AIUploadedFile.id == fid)
                        )
                        f = fr.scalar_one_or_none()
                        if f and f.processed_content:
                            attached_file_content.append(f.processed_content)
                        elif f and not f.processed_content:
                            processed = await process_uploaded_file(
                                f.file_path, f.file_type.value, f.original_filename
                            )
                            attached_file_content.append(processed)

                if attached_file_content:
                    full_user_content = (
                        user_content
                        + "\n\n--- ATTACHED FILES ---\n\n"
                        + "\n\n---\n\n".join(attached_file_content)
                    )

                user_msg = AIChatMessage(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    role=MessageRole.USER,
                    content=user_content,
                    file_ids=file_ids,
                )
                db.add(user_msg)
                session.message_count = (session.message_count or 0) + 1

                history = []
                for m in session.messages:
                    history.append({"role": m.role.value, "content": m.content})
                history.append({"role": "user", "content": full_user_content})

                memory = await load_active_memory(db, admin_id)
                training = await load_training_summaries(db)
                db_context = await get_eaglechair_context(db)
                valid_ids = await fetch_valid_reference_ids() if mode in ("edit", "agent") else None
                system_prompt = build_system_prompt(
                    memory, training, mode=mode, model=model, valid_reference_ids=valid_ids
                )
                if db_context:
                    system_prompt += f"\n\n## Live Data\n{db_context}"

                await db.commit()

            stream_state = {
                "full_response": "",
                "web_sources": [],
                "suggested_edits": [],
                "tool_calls": [],
                "content_blocks": [],
                "tokens_used": 0,
                "error_sent": False,
            }
            cancelled_event = asyncio.Event()

            async def consume_stream():
                try:
                    async for event in stream_ai_response(history, system_prompt, mode=mode, model=model, cancelled=cancelled_event):
                        if event["type"] == "text_chunk":
                            stream_state["full_response"] += event["data"]["content"]
                            blocks = stream_state["content_blocks"]
                            if blocks and blocks[-1].get("type") == "text":
                                blocks[-1]["content"] += event["data"]["content"]
                            else:
                                blocks.append({"type": "text", "content": event["data"]["content"]})
                            await websocket.send_json(event)
                        elif event["type"] == "message_done":
                            stream_state["web_sources"] = event["data"].get("web_sources", [])
                            stream_state["tokens_used"] = event["data"].get("tokens", 0)
                        elif event["type"] == "suggested_edit":
                            edit = event["data"].get("edit", {})
                            if edit:
                                stream_state["suggested_edits"].append(edit)
                                stream_state["content_blocks"].append({"type": "suggested_edit", "data": edit})
                            await websocket.send_json(event)
                        elif event["type"] == "tool_call_started":
                            d = event["data"] or {}
                            stream_state["content_blocks"].append({
                                "type": "tool_call_in_progress",
                                "data": {"name": d.get("name"), "label": d.get("label"), "args": d.get("args")},
                            })
                            await websocket.send_json(event)
                        elif event["type"] == "tool_call":
                            tool_call = event["data"].get("tool_call", {})
                            if tool_call:
                                stream_state["tool_calls"].append(tool_call)
                                blocks = stream_state["content_blocks"]
                                if blocks and blocks[-1].get("type") == "tool_call_in_progress":
                                    blocks[-1] = {"type": "tool_call", "data": tool_call}
                                else:
                                    blocks.append({"type": "tool_call", "data": tool_call})
                            await websocket.send_json(event)
                        elif event["type"] == "error":
                            stream_state["error_sent"] = True
                            await websocket.send_json(event)
                            return
                        else:
                            await websocket.send_json(event)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.exception("AI stream failed")
                    stream_state["error_sent"] = True
                    await websocket.send_json(AIStreamEvent.error(str(e)))

            async def receive_next():
                raw = await websocket.receive_text()
                return json.loads(raw)

            stream_task = asyncio.create_task(consume_stream())
            receive_task = asyncio.create_task(receive_next())

            done, pending = await asyncio.wait(
                [stream_task, receive_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            interrupted = False
            if receive_task in done:
                interrupted = True
                cancelled_event.set()
                stream_task.cancel()
                try:
                    await stream_task
                except asyncio.CancelledError:
                    pass
                try:
                    next_data = receive_task.result()
                except Exception:
                    next_data = {}
                if next_data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif next_data.get("type") == "interrupt":
                    pass
                elif next_data.get("type") == "message":
                    pending_message = next_data
            else:
                receive_task.cancel()
                try:
                    await receive_task
                except asyncio.CancelledError:
                    pass

            full_response = stream_state["full_response"]
            web_sources = stream_state["web_sources"]
            suggested_edits = stream_state["suggested_edits"]
            tool_calls = stream_state["tool_calls"]
            content_blocks = stream_state.get("content_blocks") or []
            tokens_used = stream_state["tokens_used"]
            error_sent = stream_state.get("error_sent", False)
            is_first_message = (session.message_count or 0) <= 1

            has_content = bool(full_response and full_response.strip())

            if not error_sent and not has_content:
                logger.info(
                    f"Skipping persistence of empty assistant message for session "
                    f"{session_id} (interrupted={interrupted})"
                )

            if not error_sent and has_content:
                try:
                    async with AsyncSessionLocal() as db:
                        asst_msg_id = str(uuid.uuid4())
                        asst_msg = AIChatMessage(
                            id=asst_msg_id,
                            session_id=session_id,
                            role=MessageRole.ASSISTANT,
                            content=full_response,
                            tokens_used=tokens_used,
                            model_used=settings.GEMINI_MODEL,
                            web_sources=web_sources,
                            suggested_edits=suggested_edits,
                            tool_calls=tool_calls,
                            content_blocks=content_blocks if content_blocks else None,
                        )
                        db.add(asst_msg)

                        result = await db.execute(
                            select(AIChatSession).where(AIChatSession.id == session_id)
                        )
                        session_obj = result.scalar_one_or_none()
                        if session_obj:
                            session_obj.message_count = (session_obj.message_count or 0) + 1
                            session_obj.total_tokens = (session_obj.total_tokens or 0) + tokens_used
                            session_obj.updated_at = datetime.utcnow()

                        await db.commit()

                    await websocket.send_json(
                        AIStreamEvent.message_done(asst_msg_id, tokens_used, web_sources)
                    )

                    if is_first_message and user_content and not interrupted:
                        title = await generate_chat_title(user_content)
                        async with AsyncSessionLocal() as title_db:
                            await title_db.execute(
                                update(AIChatSession)
                                .where(AIChatSession.id == session_id)
                                .values(title=title)
                            )
                            await title_db.commit()
                        await websocket.send_json(AIStreamEvent.title_update(title))

                    if full_response and not interrupted:
                        asyncio.create_task(
                            _extract_and_save_memory(session_id, admin_id, history, full_response)
                        )
                except Exception as e:
                    logger.error(f"Failed to save assistant message: {e}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json(AIStreamEvent.error(str(e)))
        except Exception:
            pass


async def _extract_and_save_memory(
    session_id: str,
    admin_id: int,
    history: list[dict],
    assistant_response: str,
):
    """Background task to extract and save memory from conversations. Scoped per admin."""
    try:
        await asyncio.sleep(2)
        async with AsyncSessionLocal() as db:
            existing_memory = await load_active_memory(db, admin_id)
            full_history = history + [{"role": "assistant", "content": assistant_response}]
            new_memories = await extract_memory_from_conversation(full_history, existing_memory)

            for mem in new_memories:
                key = mem.get("key", "").strip()
                value = mem.get("value", "").strip()
                if not key or not value:
                    continue
                result = await db.execute(
                    select(AIMemory).where(
                        AIMemory.key == key,
                        AIMemory.admin_user_id == admin_id,
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    existing.value = value
                    existing.importance = mem.get("importance", 0.5)
                    existing.source_session_id = session_id
                else:
                    db.add(AIMemory(
                        id=str(uuid.uuid4()),
                        admin_user_id=admin_id,
                        key=key,
                        value=value,
                        category=mem.get("category", "general"),
                        importance=mem.get("importance", 0.5),
                        source_session_id=session_id,
                    ))
            await db.commit()
    except Exception as e:
        logger.debug(f"Memory extraction background task failed: {e}")
