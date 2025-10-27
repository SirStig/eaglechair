import { useContext } from 'react';
import EditModeContext from './EditModeContext';

/**
 * Hook: useEditMode
 * Access edit mode context from any component
 */
export const useEditMode = () => {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
};

export default useEditMode;
