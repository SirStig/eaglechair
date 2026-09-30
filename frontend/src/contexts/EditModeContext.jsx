import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  // Open editors with unsaved changes, keyed by editor id
  const dirtyEditorsRef = useRef(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const adminAuth = useAdminAuth();

  // Use admin auth to check permissions
  const isAdmin = adminAuth.isAdmin();

  const clearDirty = useCallback(() => {
    dirtyEditorsRef.current.clear();
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    // Disable edit mode if user logs out or is not admin
    if (!isAdmin && isEditMode) {
      setIsEditMode(false);
      setEditingElement(null);
      setExitConfirmOpen(false);
      clearDirty();
      logger.info(CONTEXT, 'Edit mode disabled - user is not admin');
    }
  }, [isAdmin, isEditMode, clearDirty]);

  const setEditorDirty = useCallback((editorId, dirty) => {
    const editors = dirtyEditorsRef.current;
    if (dirty) editors.add(editorId);
    else editors.delete(editorId);
    setHasUnsavedChanges(editors.size > 0);
  }, []);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditingElement(null);
    setExitConfirmOpen(false);
    clearDirty();
    logger.info(CONTEXT, 'Edit mode disabled');
  }, [clearDirty]);

  const toggleEditMode = useCallback(() => {
    if (!isAdmin) {
      logger.warn(CONTEXT, 'Cannot enable edit mode - user is not admin');
      return;
    }
    if (isEditMode) {
      // Turning edit mode off unmounts open editors; confirm before
      // throwing away unsaved changes.
      if (dirtyEditorsRef.current.size > 0) {
        setExitConfirmOpen(true);
        return;
      }
      exitEditMode();
      return;
    }
    setIsEditMode(true);
    setEditingElement(null);
    logger.info(CONTEXT, 'Edit mode enabled');
  }, [isAdmin, isEditMode, exitEditMode]);

  const cancelExitEditMode = useCallback(() => setExitConfirmOpen(false), []);

  const startEditing = useCallback((elementId, elementType, currentData) => {
    if (!isEditMode) return;
    setEditingElement({ id: elementId, type: elementType, data: currentData });
    logger.debug(CONTEXT, `Started editing ${elementType} (${elementId})`);
  }, [isEditMode]);

  const stopEditing = useCallback(() => {
    setEditingElement(null);
    logger.debug(CONTEXT, 'Stopped editing');
  }, []);

  const value = useMemo(() => ({
    isEditMode,
    isAdmin,
    editingElement,
    toggleEditMode,
    startEditing,
    stopEditing,
    hasUnsavedChanges,
    setEditorDirty,
    exitConfirmOpen,
    confirmExitEditMode: exitEditMode,
    cancelExitEditMode,
  }), [
    isEditMode,
    isAdmin,
    editingElement,
    toggleEditMode,
    startEditing,
    stopEditing,
    hasUnsavedChanges,
    setEditorDirty,
    exitConfirmOpen,
    exitEditMode,
    cancelExitEditMode,
  ]);

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
};

export default EditModeContext;
