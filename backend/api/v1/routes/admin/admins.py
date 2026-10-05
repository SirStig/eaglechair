"""
Admin User Management Routes (super admin only)

GET    /admin/admins                        - Admins plus role / permission catalogue
POST   /admin/admins                        - Add an admin
PATCH  /admin/admins/{id}                   - Edit name, email, role, permissions, active
POST   /admin/admins/{id}/reset-password    - Set a new password (signs them out)
POST   /admin/admins/{id}/reset-security    - Clear 2FA and passkeys (set up again at next sign-in)
POST   /admin/admins/{id}/unlock            - Clear failed sign-in lockout
GET    /admin/admins/{id}/sessions          - Where they're signed in

Every write needs a recent identity confirmation (passkey or password, see
backend/services/admin_confirmation.py). Admins are deactivated, never
deleted, so their audit history stays intact.
A super admin can't demote or deactivate themselves, and the last active
super admin can't be demoted or deactivated.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import require_role
from backend.core.admin_permissions import (
    GRANTABLE,
    PERMISSION_LABELS,
    ROLE_DEFAULTS,
    ROLE_LABELS,
    effective_permissions,
    normalize_permissions,
)
from backend.core.security import SecurityManager
from backend.database.base import get_db
from backend.models.company import AdminRole, AdminUser
from backend.models.passkey import AdminPasskeyCredential
from backend.services import admin_session_service
from backend.services.admin_confirmation import require_recent_confirmation
from backend.services.auth_service import revoke_user_tokens

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Admins"])

_ROLE_ORDER = (AdminRole.VIEWER, AdminRole.EDITOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)


class AdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: AdminRole = AdminRole.EDITOR
    # None = the role's defaults
    permissions: Optional[list[str]] = None
    password: str = Field(..., max_length=128)


class AdminUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[AdminRole] = None
    # Send null to reset to the role's defaults
    permissions: Optional[list[str]] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str = Field(..., max_length=128)


def _check_password(password: str) -> None:
    ok, error = SecurityManager.validate_password_strength(password)
    if not ok:
        raise HTTPException(status_code=400, detail=error)


def _permissions_or_400(role: AdminRole, values: Optional[list[str]]) -> Optional[list[str]]:
    try:
        return normalize_permissions(role, values)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def _get_admin(db: AsyncSession, admin_id: int) -> AdminUser:
    admin = await db.get(AdminUser, admin_id)
    if admin is None:
        raise HTTPException(status_code=404, detail="Admin not found")
    return admin


async def _active_super_admins(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(AdminUser.id)).where(
            AdminUser.role == AdminRole.SUPER_ADMIN, AdminUser.is_active.is_(True)
        )
    )
    return result.scalar_one()


async def _ensure_unique(
    db: AsyncSession, username: Optional[str], email: Optional[str], exclude_id: Optional[int] = None
) -> None:
    conditions = []
    if username:
        conditions.append(func.lower(AdminUser.username) == username.lower())
    if email:
        conditions.append(func.lower(AdminUser.email) == email.lower())
    if not conditions:
        return
    query = select(AdminUser.username, AdminUser.email).where(or_(*conditions))
    if exclude_id is not None:
        query = query.where(AdminUser.id != exclude_id)
    clash = (await db.execute(query)).first()
    if clash:
        field = "username" if username and clash.username.lower() == username.lower() else "email"
        raise HTTPException(status_code=409, detail=f"Another admin already uses that {field}")


async def _sign_out_everywhere(db: AsyncSession, admin: AdminUser, reason: str) -> None:
    revoke_user_tokens(admin)
    admin.session_token = None
    admin.admin_token = None
    await admin_session_service.revoke_all(db, admin.id, reason)


def _serialize(admin: AdminUser, has_passkey: bool) -> dict:
    return {
        "id": admin.id,
        "username": admin.username,
        "email": admin.email,
        "first_name": admin.first_name,
        "last_name": admin.last_name,
        "phone": admin.phone,
        "role": admin.role.value,
        "permissions": sorted(p.value for p in effective_permissions(admin)),
        "custom_permissions": admin.role != AdminRole.SUPER_ADMIN and admin.permissions is not None,
        "is_active": admin.is_active,
        "is_2fa_enabled": admin.is_2fa_enabled,
        "has_passkey": has_passkey,
        "failed_login_attempts": admin.failed_login_attempts or 0,
        "locked_until": admin.locked_until,
        "last_login": admin.last_login,
        "last_login_ip": admin.last_login_ip,
        "last_activity": admin.last_activity,
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
    }


async def _passkey_owner_ids(db: AsyncSession) -> set[int]:
    result = await db.execute(select(AdminPasskeyCredential.admin_user_id).distinct())
    return set(result.scalars().all())


def _catalogue() -> dict:
    return {
        "roles": [
            {
                "value": role.value,
                "label": ROLE_LABELS[role],
                "permissions": sorted(p.value for p in ROLE_DEFAULTS[role]),
            }
            for role in _ROLE_ORDER
        ],
        "permissions": [
            {
                "value": perm.value,
                "label": PERMISSION_LABELS[perm][0],
                "description": PERMISSION_LABELS[perm][1],
                "grantable": perm in GRANTABLE,
            }
            for perm in PERMISSION_LABELS
        ],
    }


@router.get("", summary="List admins (super admin)")
async def list_admins(
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).order_by(AdminUser.is_active.desc(), AdminUser.first_name, AdminUser.last_name)
    )
    passkeys = await _passkey_owner_ids(db)
    return {
        "items": [_serialize(a, a.id in passkeys) for a in result.scalars().all()],
        **_catalogue(),
    }


@router.post("", status_code=201, summary="Add an admin (super admin)", dependencies=[Depends(require_recent_confirmation)])
async def create_admin(
    body: AdminCreate,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    _check_password(body.password)
    await _ensure_unique(db, body.username, body.email)
    admin = AdminUser(
        username=body.username,
        email=body.email,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        phone=body.phone or None,
        role=body.role,
        permissions=_permissions_or_400(body.role, body.permissions),
        hashed_password=SecurityManager.hash_password(body.password),
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    logger.info(f"Super admin {current.username} added admin {admin.username} ({admin.role.value})")
    return _serialize(admin, False)


@router.patch("/{admin_id}", summary="Edit an admin (super admin)", dependencies=[Depends(require_recent_confirmation)])
async def update_admin(
    admin_id: int,
    body: AdminUpdate,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    admin = await _get_admin(db, admin_id)
    changes = body.model_dump(exclude_unset=True)
    new_role = changes.get("role") or admin.role
    deactivating = changes.get("is_active") is False and admin.is_active

    if admin.id == current.id and (new_role != admin.role or deactivating):
        raise HTTPException(status_code=400, detail="You can't change your own role or deactivate yourself")
    losing_super = admin.role == AdminRole.SUPER_ADMIN and admin.is_active and (
        new_role != AdminRole.SUPER_ADMIN or deactivating
    )
    if losing_super and await _active_super_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="There must always be at least one active super admin")

    await _ensure_unique(db, changes.get("username"), changes.get("email"), exclude_id=admin.id)

    for field in ("username", "email", "first_name", "last_name"):
        if changes.get(field):
            setattr(admin, field, changes[field].strip())
    if "phone" in changes:
        admin.phone = changes["phone"] or None

    if new_role != admin.role or "permissions" in changes:
        # A role change without explicit permissions resets to the new role's defaults
        admin.permissions = _permissions_or_400(new_role, changes.get("permissions"))
        admin.role = new_role

    if "is_active" in changes and changes["is_active"] is not None:
        if deactivating:
            await _sign_out_everywhere(db, admin, "deactivated")
        admin.is_active = changes["is_active"]

    await db.commit()
    await db.refresh(admin)
    logger.info(f"Super admin {current.username} updated admin {admin.username}: {sorted(changes)}")
    return _serialize(admin, admin.id in await _passkey_owner_ids(db))


@router.post("/{admin_id}/reset-password", summary="Set a new password for an admin (super admin)", dependencies=[Depends(require_recent_confirmation)])
async def reset_admin_password(
    admin_id: int,
    body: PasswordReset,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    admin = await _get_admin(db, admin_id)
    _check_password(body.new_password)
    admin.hashed_password = SecurityManager.hash_password(body.new_password)
    admin.failed_login_attempts = 0
    admin.locked_until = None
    await _sign_out_everywhere(db, admin, "password_reset")
    await db.commit()
    logger.info(f"Super admin {current.username} reset the password of admin {admin.username}")
    return {"message": f"Password updated. {admin.first_name} has been signed out everywhere."}


@router.post("/{admin_id}/reset-security", summary="Clear an admin's 2FA and passkeys (super admin)", dependencies=[Depends(require_recent_confirmation)])
async def reset_admin_security(
    admin_id: int,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    admin = await _get_admin(db, admin_id)
    admin.is_2fa_enabled = False
    admin.two_factor_secret = None
    await db.execute(delete(AdminPasskeyCredential).where(AdminPasskeyCredential.admin_user_id == admin.id))
    await _sign_out_everywhere(db, admin, "security_reset")
    await db.commit()
    logger.info(f"Super admin {current.username} reset 2FA/passkeys of admin {admin.username}")
    return {"message": f"2FA and passkeys cleared. {admin.first_name} will set them up again at next sign-in."}


@router.post("/{admin_id}/unlock", summary="Clear an admin's sign-in lockout (super admin)", dependencies=[Depends(require_recent_confirmation)])
async def unlock_admin(
    admin_id: int,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    admin = await _get_admin(db, admin_id)
    admin.failed_login_attempts = 0
    admin.locked_until = None
    await db.commit()
    return {"message": f"{admin.first_name} can sign in again."}


@router.get("/{admin_id}/sessions", summary="An admin's device sessions (super admin)")
async def list_admin_sessions(
    admin_id: int,
    current: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    await _get_admin(db, admin_id)
    sessions = await admin_session_service.list_sessions(db, admin_id)
    return {"items": [admin_session_service.serialize(s) for s in sessions]}
