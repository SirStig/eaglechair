import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../../contexts/EditModeContext';
import EditModal from './EditModal';
import logger from '../../utils/logger';

const CONTEXT = 'EditableWrapper';

/**
 * EditableWrapper Component
 * 
 * Wraps any content to make it editable in edit mode
 * Supports: text, textarea, image, rich-text, array
 * 
 * @param {string} id - Unique identifier for this editable element
 * @param {string} type - Type of content (text, textarea, image, rich-text, array)
 * @param {object} data - Current data for this element
 * @param {function} onSave - Callback when content is saved
 * @param {string} apiEndpoint - API endpoint to save to (e.g., '/api/v1/content/hero-slides/1')
 * @param {string} label - Label to display in edit indicator
 * @param {ReactNode} children - The content to wrap
 */
const EditableWrapper = ({ 
  id, 
  type = 'text',
  data, 
  onSave, 
  apiEndpoint,
  label,
  children,
  className = '' 
}) => {
  const { isEditMode, editingElement, startEditing, stopEditing } = useEditMode();
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isEditing = editingElement?.id === id;

  const handleClick = (e) => {
    if (isEditMode && !isEditing) {
      e.stopPropagation();
      e.preventDefault();
      logger.debug(CONTEXT, `Starting edit for ${id} (${type})`);
      startEditing(id, type, data);
      setShowModal(true);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    stopEditing();
  };

  const handleSave = async (newData) => {
    try {
      logger.info(CONTEXT, `Saving ${id}`, newData);
      if (onSave) {
        await onSave(newData);
      }
      setShowModal(false);
      stopEditing();
    } catch (error) {
      logger.error(CONTEXT, `Failed to save ${id}`, error);
      throw error;
    }
  };

  // If not in edit mode, just render children
  if (!isEditMode) {
    return children;
  }

  return (
    <>
      <motion.div
        className={`relative ${className}`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ 
          boxShadow: '0 0 0 2px rgba(139, 115, 85, 0.4)',
        }}
        animate={{
          boxShadow: isEditing 
            ? '0 0 0 3px rgba(139, 115, 85, 0.8)' 
            : isHovered
            ? '0 0 0 2px rgba(139, 115, 85, 0.4)'
            : '0 0 0 0px rgba(139, 115, 85, 0)'
        }}
        transition={{ duration: 0.2 }}
        style={{ cursor: isEditMode ? 'pointer' : 'default' }}
      >
        {children}
        
        {/* Edit Indicator */}
        <AnimatePresence>
          {(isHovered || isEditing) && (
            <motion.div
              className="absolute top-0 right-0 -mt-2 -mr-2 z-10"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <div className="bg-accent-600 text-white px-2 py-1 rounded-md text-xs font-medium shadow-lg flex items-center gap-1 border border-accent-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>{label || type}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Edit Modal */}
      <EditModal
        isOpen={showModal}
        onClose={handleClose}
        onSave={handleSave}
        elementData={data}
        elementType={type}
        elementId={id}
        apiEndpoint={apiEndpoint}
      />
    </>
  );
};

export default EditableWrapper;
