"""
Admin Activity Log Routes

GET /admin/audit-log          - Who did what, newest first, with filters
GET /admin/audit-log/filters  - Admins, record types and actions to filter by

Needs the view_audit permission (backend/core/admin_permissions.py).
Entries are written by backend/services/audit_service.py.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.database.base import get_db
from backend.models.chair import Category, Chair, Color, Finish, ProductFamily, Upholstery
from backend.models.company import AdminAuditLog, AdminUser, Company, CompanyPricing
from backend.models.content import Catalog, EmailTemplate, Feedback, Hardware, Laminate
from backend.models.quote import Quote

router = APIRouter(tags=["Admin - Activity Log"])

# resource_type -> model, for showing record names next to ids
_NAMED_RESOURCES = {
    "products": Chair,
    "categories": Category,
    "families": ProductFamily,
    "finishes": Finish,
    "colors": Color,
    "upholsteries": Upholstery,
    "hardware": Hardware,
    "laminates": Laminate,
    "catalogs": Catalog,
    "companies": Company,
    "quotes": Quote,
    "inquiries": Feedback,
    "pricing-tiers": CompanyPricing,
    "emails": EmailTemplate,
    "admins": AdminUser,
    "admin_users": AdminUser,
}
_NAME_ATTRS = ("company_name", "quote_number", "name", "title", "tier_name")


def _admin_name(admin: Optional[AdminUser]) -> Optional[str]:
    if admin is None:
        return None
    return f"{admin.first_name} {admin.last_name}".strip() or admin.username


def _record_name(row) -> Optional[str]:
    if isinstance(row, AdminUser):
        return _admin_name(row)
    for attr in _NAME_ATTRS:
        value = getattr(row, attr, None)
        if isinstance(value, str) and value:
            return value
    return None


async def _resource_names(db: AsyncSession, entries: list[AdminAuditLog]) -> dict[tuple[str, int], str]:
    wanted: dict[str, set[int]] = defaultdict(set)
    for entry in entries:
        if entry.resource_id is not None and entry.resource_type in _NAMED_RESOURCES:
            wanted[entry.resource_type].add(entry.resource_id)
    names = {}
    for resource_type, ids in wanted.items():
        model = _NAMED_RESOURCES[resource_type]
        rows = (await db.execute(select(model).where(model.id.in_(ids)))).scalars().all()
        for row in rows:
            name = _record_name(row)
            if name:
                names[(resource_type, row.id)] = name
    return names


def _parse_when(value: Optional[str], field: str) -> Optional[datetime]:
    """ISO date or datetime -> naive UTC (created_at is stored naive UTC)"""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be an ISO date or datetime")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _serialize(entry: AdminAuditLog, admin: Optional[AdminUser], resource_name: Optional[str]) -> dict:
    return {
        "id": entry.id,
        "admin": {
            "id": entry.admin_id,
            "name": _admin_name(admin) or f"Admin #{entry.admin_id}",
            "email": admin.email if admin else None,
            "role": admin.role.value if admin else None,
        },
        "action": entry.action,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "resource_name": resource_name,
        "details": entry.details or {},
        "ip_address": entry.ip_address,
        "user_agent": entry.user_agent,
        # created_at is naive UTC; mark it so browsers convert to local time
        "created_at": (
            entry.created_at.replace(tzinfo=timezone.utc).isoformat() if entry.created_at else entry.timestamp
        ),
    }


@router.get("", summary="Admin activity log")
async def list_audit_log(
    admin_id: Optional[int] = Query(None),
    resource_type: Optional[str] = Query(None, max_length=100),
    resource_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None, max_length=255),
    q: Optional[str] = Query(None, max_length=200, description="Search action, record type and details"),
    date_from: Optional[str] = Query(None, description="ISO date/datetime, inclusive"),
    date_to: Optional[str] = Query(None, description="ISO date/datetime, exclusive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if admin_id is not None:
        conditions.append(AdminAuditLog.admin_id == admin_id)
    if resource_type:
        conditions.append(AdminAuditLog.resource_type == resource_type)
    if resource_id is not None:
        conditions.append(AdminAuditLog.resource_id == resource_id)
    if action:
        conditions.append(AdminAuditLog.action == action)
    start = _parse_when(date_from, "date_from")
    end = _parse_when(date_to, "date_to")
    if start:
        conditions.append(AdminAuditLog.created_at >= start)
    if end:
        conditions.append(AdminAuditLog.created_at < end)
    if q and q.strip():
        like = f"%{q.strip()}%"
        conditions.append(or_(
            AdminAuditLog.action.ilike(like),
            AdminAuditLog.resource_type.ilike(like),
            cast(AdminAuditLog.details, String).ilike(like),
        ))

    total = (await db.execute(select(func.count(AdminAuditLog.id)).where(*conditions))).scalar_one()
    rows = (await db.execute(
        select(AdminAuditLog, AdminUser)
        .outerjoin(AdminUser, AdminUser.id == AdminAuditLog.admin_id)
        .where(*conditions)
        .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).all()
    names = await _resource_names(db, [entry for entry, _ in rows])

    return {
        "items": [
            _serialize(entry, admin, names.get((entry.resource_type, entry.resource_id)))
            for entry, admin in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/filters", summary="Values to filter the activity log by")
async def audit_log_filters(
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    admins = (await db.execute(
        select(AdminUser).order_by(AdminUser.first_name, AdminUser.last_name)
    )).scalars().all()
    resource_types = (await db.execute(
        select(AdminAuditLog.resource_type).distinct().order_by(AdminAuditLog.resource_type)
    )).scalars().all()
    actions = (await db.execute(
        select(AdminAuditLog.action).distinct().order_by(AdminAuditLog.action)
    )).scalars().all()
    return {
        "admins": [
            {"id": a.id, "name": _admin_name(a), "email": a.email, "is_active": a.is_active}
            for a in admins
        ],
        "resource_types": [r for r in resource_types if r],
        "actions": [a for a in actions if a],
    }
