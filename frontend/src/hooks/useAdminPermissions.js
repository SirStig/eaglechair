import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * Permission values mirror backend/core/admin_permissions.py. The server is
 * the source of truth (it enforces every write); the UI only hides what the
 * signed-in admin can't use.
 */
export const PERMISSIONS = {
  EDIT_CATALOG: 'edit_catalog',
  EDIT_SALES: 'edit_sales',
  EDIT_CONTENT: 'edit_content',
  DELETE: 'delete',
  VIEW_AUDIT: 'view_audit',
  PERMANENT_DELETE: 'permanent_delete',
  MANAGE_ADMINS: 'manage_admins',
  TIME_MACHINE: 'time_machine', // super admins only
};

// Role defaults, for profiles cached before `permissions` was sent
const ROLE_DEFAULTS = {
  viewer: [],
  editor: ['edit_catalog', 'edit_sales', 'edit_content'],
  admin: ['edit_catalog', 'edit_sales', 'edit_content', 'delete', 'view_audit'],
  super_admin: Object.values(PERMISSIONS),
};

export function permissionsFor(user) {
  if (!user || user.type !== 'admin') return new Set();
  if (user.role === 'super_admin') return new Set(ROLE_DEFAULTS.super_admin);
  return new Set(Array.isArray(user.permissions) ? user.permissions : ROLE_DEFAULTS[user.role] || []);
}

/**
 * const { can, isSuperAdmin } = useAdminPermissions();
 * can(PERMISSIONS.DELETE) -> boolean
 */
export function useAdminPermissions() {
  const user = useAuthStore((state) => state.user);
  return useMemo(() => {
    const permissions = permissionsFor(user);
    return {
      permissions,
      role: user?.role || null,
      isSuperAdmin: user?.role === 'super_admin',
      can: (permission) => permissions.has(permission),
    };
  }, [user]);
}
