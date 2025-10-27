import { createContext, useState, useEffect } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import logger from '../utils/logger';

const CONTEXT = 'EditModeContext';

const EditModeContext = createContext();

/**
 * Component: EditModeProvider
 * Manages edit mode state and admin permissions
 */
export const EditModeProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingElement, setEditingElement] = useState(null);
  const adminAuth = useAdminAuth();

  // Use admin auth to check permissions
  const isAdmin = adminAuth.isAdmin();

  useEffect(() => {
    // Disable edit mode if user logs out or is not admin
    if (!isAdmin && isEditMode) {
      setIsEditMode(false);
      setEditingElement(null);
      logger.info(CONTEXT, 'Edit mode disabled - user is not admin');
    }
  }, [isAdmin, isEditMode]);

  const toggleEditMode = () => {
    if (!isAdmin) {
      logger.warn(CONTEXT, 'Cannot enable edit mode - user is not admin');
      return;
    }
    setIsEditMode(prev => !prev);
    setEditingElement(null);
    logger.info(CONTEXT, `Edit mode ${!isEditMode ? 'enabled' : 'disabled'}`);
  };

  const startEditing = (elementId, elementType, currentData) => {
    if (!isEditMode) return;
    setEditingElement({ id: elementId, type: elementType, data: currentData });
    logger.debug(CONTEXT, `Started editing ${elementType} (${elementId})`);
  };

  const stopEditing = () => {
    setEditingElement(null);
    logger.debug(CONTEXT, 'Stopped editing');
  };

  const value = {
    isEditMode,
    isAdmin,
    editingElement,
    toggleEditMode,
    startEditing,
    stopEditing,
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
};

export default EditModeContext;

