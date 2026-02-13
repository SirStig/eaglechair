import { createContext, useContext, useState, useCallback } from 'react';

const AdminRefreshContext = createContext(null);

export const AdminRefreshProvider = ({ children }) => {
  const [refreshKeys, setRefreshKeys] = useState({});

  const invalidate = useCallback((section) => {
    setRefreshKeys((prev) => ({ ...prev, [section]: (prev[section] ?? 0) + 1 }));
  }, []);

  const value = { refreshKeys, invalidate };
  return (
    <AdminRefreshContext.Provider value={value}>
      {children}
    </AdminRefreshContext.Provider>
  );
};

export const useAdminRefresh = () => {
  const ctx = useContext(AdminRefreshContext);
  if (!ctx) return { refreshKeys: {}, invalidate: () => {} };
  return ctx;
};

export default AdminRefreshContext;
