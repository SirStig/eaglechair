import { useContext } from 'react';
import EditModeContext from '../contexts/EditModeContext';

/**
 * Hook: useEditMode
 * 
 * Access edit mode state and controls
 * 
 * Usage:
 * const { isEditMode, toggleEditMode, isAdmin, startEditing } = useEditMode();
 */
const useEditMode = () => {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
};

export default useEditMode;
