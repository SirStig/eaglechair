"""
Admin Inquiry Routes

Contact form submissions (Feedback model): list, triage and delete.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.content import FeedbackUpdate
from backend.core.exceptions import ResourceNotFoundError
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.models.content import Feedback

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Inquiries"])


def _serialize(item: Feedback) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "email": item.email,
        "phone": item.phone,
        "company_name": item.company_name,
        "subject": item.subject,
        "message": item.message,
        "feedback_type": item.feedback_type,
        "is_read": item.is_read,
        "is_responded": item.is_responded,
        "admin_notes": item.admin_notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


async def _get_or_404(db: AsyncSession, inquiry_id: int) -> Feedback:
    item = await db.get(Feedback, inquiry_id)
    if not item:
        raise ResourceNotFoundError(resource_type="Inquiry", resource_id=inquiry_id)
    return item


@router.get("", summary="List contact form inquiries (Admin)")
async def list_inquiries(
    status: Literal["all", "unread", "open", "responded"] = "all",
    search: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Newest first. `open` = not yet responded; `unread` = never opened.
    Always returns the overall unread count for the nav badge.
    """
    query = select(Feedback)
    if status == "unread":
        query = query.where(Feedback.is_read.is_(False))
    elif status == "open":
        query = query.where(Feedback.is_responded.is_(False))
    elif status == "responded":
        query = query.where(Feedback.is_responded.is_(True))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(
            Feedback.name.ilike(term),
            Feedback.email.ilike(term),
            Feedback.company_name.ilike(term),
            Feedback.message.ilike(term),
        ))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    unread = (await db.execute(
        select(func.count()).select_from(Feedback).where(Feedback.is_read.is_(False))
    )).scalar_one()
    rows = (await db.execute(
        query.order_by(Feedback.created_at.desc(), Feedback.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "unread": unread,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/{inquiry_id}", summary="Update inquiry status or notes (Admin)")
async def update_inquiry(
    inquiry_id: int,
    data: FeedbackUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_or_404(db, inquiry_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    # Responding implies it has been read
    if item.is_responded:
        item.is_read = True
    await db.commit()
    await db.refresh(item)
    logger.info(f"Admin {admin.username} updated inquiry {inquiry_id}")
    return _serialize(item)


@router.delete("/{inquiry_id}", response_model=MessageResponse, summary="Delete inquiry (Admin)")
async def delete_inquiry(
    inquiry_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_or_404(db, inquiry_id)
    await db.delete(item)
    await db.commit()
    logger.info(f"Admin {admin.username} deleted inquiry {inquiry_id}")
    return MessageResponse(message="Inquiry deleted")
