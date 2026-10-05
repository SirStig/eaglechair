import { PERMISSIONS, useAdminPermissions } from '../../hooks/useAdminPermissions';

/**
 * Renders its children (a delete button) only for admins allowed to delete:
 * the "delete" permission, or "permanent_delete" with `permanent`. The
 * server enforces the same rules (backend/core/admin_permissions.py).
 */
export default function DeleteGate({ permanent = false, children }) {
  const { can } = useAdminPermissions();
  return can(permanent ? PERMISSIONS.PERMANENT_DELETE : PERMISSIONS.DELETE) ? children : null;
}
