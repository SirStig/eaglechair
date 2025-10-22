import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../../contexts/EditModeContext';

/**
 * Floating Edit Mode Toggle Button
 * Pinned to top-left corner, visible only to admins
 */
const EditModeToggle = () => {
  const { isAdmin, isEditMode, toggleEditMode } = useEditMode();

  // Don't render if user is not admin
  if (!isAdmin) return null;

  return (
    <motion.div
      className="fixed top-4 left-4 z-[10000]"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        onClick={toggleEditMode}
        className={`
          flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl font-semibold
          transition-all duration-300 border-2
          ${isEditMode 
            ? 'bg-accent-600 hover:bg-accent-700 text-white border-accent-400 ring-2 ring-accent-400/50' 
            : 'bg-dark-800 hover:bg-dark-700 text-dark-50 border-dark-600'
          }
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          {isEditMode ? (
            // Check icon when edit mode is on
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          ) : (
            // Edit icon when edit mode is off
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
            />
          )}
        </svg>
        <span className="text-sm">
          {isEditMode ? 'Exit Edit Mode' : 'Edit Page'}
        </span>
      </motion.button>

      {/* Edit Mode Indicator */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 px-3 py-2 bg-accent-900/90 backdrop-blur-sm border border-accent-500 rounded-lg text-xs text-white shadow-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
              <span className="font-medium">Edit mode active</span>
            </div>
            <p className="mt-1 text-accent-100 text-[10px]">
              Click any content to edit
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EditModeToggle;

