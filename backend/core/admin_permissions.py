"""
Admin permissions

Each admin role grants a default set of permissions. A super admin can
override the set per admin (AdminUser.permissions); NULL means "use the role
defaults". Super admins always hold every permission, and only they can
manage other admins, permanently delete rows or use the Time Machine.

Requests under /api/v1/admin and /api/v1/cms-admin are checked centrally by
missing_permissions (called from get_current_admin), so every admin route is
covered without each one declaring what it needs:

  - GET / HEAD / OPTIONS            any active admin
  - POST / PUT / PATCH              the edit permission for that area
  - DELETE                          that edit permission plus "delete"
  - DELETE ?hard=… (or hard_delete / permanent / force / delete_tier)
                                    also "permanent_delete" (super admins)
"""

import re
from enum import Enum
from typing import Iterable, Mapping, Optional

from backend.models.company import AdminRole, AdminUser


class Permission(str, Enum):
    EDIT_CATALOG = "edit_catalog"  # Products, materials, categories, catalogs, uploads
    EDIT_SALES = "edit_sales"  # Quotes, companies, pricing tiers, inquiries
    EDIT_CONTENT = "edit_content"  # Website pages, legal documents, email templates
    DELETE = "delete"  # Delete records in the areas the admin can edit
    VIEW_AUDIT = "view_audit"  # See the activity log
    # Super admin only - not grantable
    PERMANENT_DELETE = "permanent_delete"
    MANAGE_ADMINS = "manage_admins"
    TIME_MACHINE = "time_machine"  # Browse and undo change history


# Permissions a super admin may switch on or off for another admin
GRANTABLE = (
    Permission.EDIT_CATALOG,
    Permission.EDIT_SALES,
    Permission.EDIT_CONTENT,
    Permission.DELETE,
    Permission.VIEW_AUDIT,
)

PERMISSION_LABELS = {
    Permission.EDIT_CATALOG: ("Edit catalog", "Products, materials, categories, catalogs and uploads"),
    Permission.EDIT_SALES: ("Edit sales", "Quotes, companies, pricing tiers and inquiries"),
    Permission.EDIT_CONTENT: ("Edit website content", "Site pages, legal documents and email templates"),
    Permission.DELETE: ("Delete", "Delete records in the areas they can edit"),
    Permission.VIEW_AUDIT: ("View activity log", "See who changed what in the admin panel"),
    Permission.PERMANENT_DELETE: ("Permanently delete", "Super admin only"),
    Permission.MANAGE_ADMINS: ("Manage admins", "Super admin only"),
    Permission.TIME_MACHINE: ("Time Machine", "Super admin only"),
}

_EDIT = (Permission.EDIT_CATALOG, Permission.EDIT_SALES, Permission.EDIT_CONTENT)

ROLE_DEFAULTS: dict[AdminRole, frozenset[Permission]] = {
    AdminRole.VIEWER: frozenset(),
    AdminRole.EDITOR: frozenset(_EDIT),
    AdminRole.ADMIN: frozenset((*_EDIT, Permission.DELETE, Permission.VIEW_AUDIT)),
    AdminRole.SUPER_ADMIN: frozenset(Permission),
}

ROLE_LABELS = {
    AdminRole.VIEWER: "Viewer",
    AdminRole.EDITOR: "Editor",
    AdminRole.ADMIN: "Admin",
    AdminRole.SUPER_ADMIN: "Super Admin",
}


def effective_permissions(admin: AdminUser) -> frozenset[Permission]:
    """The permissions this admin actually holds"""
    if admin.role == AdminRole.SUPER_ADMIN:
        return ROLE_DEFAULTS[AdminRole.SUPER_ADMIN]
    if admin.permissions is None:
        return ROLE_DEFAULTS.get(admin.role, frozenset())
    granted = set()
    for value in admin.permissions:
        try:
            perm = Permission(value)
        except ValueError:
            continue
        if perm in GRANTABLE:
            granted.add(perm)
    return frozenset(granted)


def has_permission(admin: AdminUser, permission: Permission) -> bool:
    return permission in effective_permissions(admin)


def normalize_permissions(role: AdminRole, values: Optional[Iterable[str]]) -> Optional[list[str]]:
    """
    Value to store in AdminUser.permissions: None when it matches the role
    defaults (so the admin follows the role), otherwise the sorted list of
    grantable permissions.

    Raises:
        ValueError: unknown or non-grantable permission
    """
    if values is None or role == AdminRole.SUPER_ADMIN:
        return None
    perms = {Permission(v) for v in values}
    not_grantable = perms - set(GRANTABLE)
    if not_grantable:
        raise ValueError(f"Not grantable: {', '.join(sorted(p.value for p in not_grantable))}")
    if perms == ROLE_DEFAULTS[role]:
        return None
    return sorted(p.value for p in perms)


def admin_profile(admin: AdminUser) -> dict:
    """Admin user payload for login / me responses"""
    return {
        "id": admin.id,
        "username": admin.username,
        "email": admin.email,
        "firstName": admin.first_name,
        "lastName": admin.last_name,
        "role": admin.role.value,
        "permissions": sorted(p.value for p in effective_permissions(admin)),
        "type": "admin",
    }


# ---------------------------------------------------------------------------
# Route policy
# ---------------------------------------------------------------------------

ADMIN_PREFIX = "/api/v1/admin/"
CMS_PREFIX = "/api/v1/cms-admin/"

# First path segment under /admin -> area
_SECTION_AREAS = {
    "products": Permission.EDIT_CATALOG,
    "catalog": Permission.EDIT_CATALOG,
    "categories": Permission.EDIT_CATALOG,
    "subcategories": Permission.EDIT_CATALOG,
    "families": Permission.EDIT_CATALOG,
    "finishes": Permission.EDIT_CATALOG,
    "colors": Permission.EDIT_CATALOG,
    "upholsteries": Permission.EDIT_CATALOG,
    "upload": Permission.EDIT_CATALOG,
    "register": Permission.EDIT_CATALOG,
    "catalog-builder": Permission.EDIT_CATALOG,
    "companies": Permission.EDIT_SALES,
    "quotes": Permission.EDIT_SALES,
    "inquiries": Permission.EDIT_SALES,
    "pricing-tiers": Permission.EDIT_SALES,
    "emails": Permission.EDIT_CONTENT,
    "dashboard": Permission.EDIT_CONTENT,
}

# /admin/bulk/{resource} -> area (everything else there is catalog data)
_BULK_AREAS = {
    "companies": Permission.EDIT_SALES,
    "quotes": Permission.EDIT_SALES,
    "inquiries": Permission.EDIT_SALES,
    "pricing-tiers": Permission.EDIT_SALES,
    "email-templates": Permission.EDIT_CONTENT,
    "legal-documents": Permission.EDIT_CONTENT,
}

# Sections gated for reads as well as writes
_GATED_SECTIONS = {
    "admins": Permission.MANAGE_ADMINS,
    "audit-log": Permission.VIEW_AUDIT,
    "time-machine": Permission.TIME_MACHINE,
}

# Writes that only render or read
_READ_ONLY_WRITES = re.compile(r"^catalog-builder/(preview|export|suggest-pages)$")

# The admin's own AI chats, memory and declined proposals - a personal
# workspace. Applying proposals changes the catalog; training docs are
# shared content.
_AI_PERSONAL = re.compile(r"^ai/(chats|memory|ws-ticket|edits/decline)(/|$)")
_AI_APPLY = re.compile(r"^ai/(apply-edit|edits/apply)$")


# Query flags that turn a (soft) DELETE into a permanent one. `force` and
# `delete_tier` also remove rows for good (pricing tiers).
_HARD_DELETE_FLAGS = ("hard", "hard_delete", "permanent", "force", "delete_tier")
# Fail closed: FastAPI reads true/1/yes/on/t/y (any case) as True, so any
# value that isn't explicitly false counts as a hard delete
_FALSE_VALUES = ("", "0", "false", "no", "off", "f", "n")


def _delete_permissions(query: Optional[Mapping[str, str]]) -> set[Permission]:
    needed = {Permission.DELETE}
    if query and any(
        flag in query and str(query.get(flag)).strip().lower() not in _FALSE_VALUES
        for flag in _HARD_DELETE_FLAGS
    ):
        needed.add(Permission.PERMANENT_DELETE)
    return needed


def required_permissions(
    method: str, path: str, query: Optional[Mapping[str, str]] = None
) -> set[Permission]:
    """
    Permissions needed to call `method path?query`. Empty set = any admin.
    Paths outside /admin and /cms-admin need nothing here.
    """
    method = method.upper()
    if path.startswith(CMS_PREFIX):
        if method in ("GET", "HEAD", "OPTIONS"):
            return set()
        needed = {Permission.EDIT_CONTENT}
        if method == "DELETE":
            needed |= _delete_permissions(query)
        return needed
    if not path.startswith(ADMIN_PREFIX):
        return set()

    rest = path[len(ADMIN_PREFIX):].strip("/")
    section = rest.split("/", 1)[0]

    if section in _GATED_SECTIONS:
        return {_GATED_SECTIONS[section]}
    if method in ("GET", "HEAD", "OPTIONS"):
        return set()
    if _READ_ONLY_WRITES.match(rest) or _AI_PERSONAL.match(rest):
        return set()

    if _AI_APPLY.match(rest):
        area = Permission.EDIT_CATALOG
    elif section == "ai":
        area = Permission.EDIT_CONTENT  # training documents
    elif section == "bulk":
        parts = rest.split("/")
        resource = parts[1] if len(parts) > 1 else ""
        area = _BULK_AREAS.get(resource, Permission.EDIT_CATALOG)
        if len(parts) > 2 and parts[2] == "delete":
            return {area, Permission.DELETE, Permission.PERMANENT_DELETE}
    else:
        area = _SECTION_AREAS.get(section, Permission.EDIT_CATALOG)

    needed = {area}
    if method == "DELETE":
        needed |= _delete_permissions(query)
    return needed


def missing_permissions(
    admin: AdminUser, method: str, path: str, query: Optional[Mapping[str, str]] = None
) -> set[Permission]:
    return required_permissions(method, path, query) - effective_permissions(admin)
