import { createContext, useContext, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import logger from '../utils/logger';

const CONTEXT = 'AdminAuthContext';
const ADMIN_ROLES = ['super_admin', 'admin', 'editor'];

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const adminToken = useAuthStore((state) => state.adminToken);
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const isAdmin = () => {
    if (!user) return false;
    return ADMIN_ROLES.includes(user.role) || user.type === 'admin';
  };

  const hasAdminPermission = (permission) => {
    if (!user) return false;
    if (!isAdmin()) return false;

    const permissionMap = {
      edit_content: ['editor', 'admin', 'super_admin'],
      upload_images: ['editor', 'admin', 'super_admin'],
      manage_users: ['admin', 'super_admin'],
      manage_settings: ['super_admin'],
    };

    const allowedRoles = permissionMap[permission] || [];
    return allowedRoles.includes(user.role) || user.type === 'super_admin';
  };

  const getAdminToken = () => {
    return adminToken || token || null;
  };

  const logAdminAction = (action, details = {}) => {
    if (!isAdmin()) {
      logger.warn(CONTEXT, `Non-admin attempted action: ${action}`);
      return;
    }

    const email = user?.email ?? 'unknown';
    logger.info(CONTEXT, `Admin action [${email}]: ${action}`, details);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      adminToken,
      sessionToken,
      isAuthenticated: Boolean(token),
      isAdmin,
      hasAdminPermission,
      getAdminToken,
      logAdminAction,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, adminToken, sessionToken]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default AdminAuthContext;
