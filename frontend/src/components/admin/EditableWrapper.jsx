import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../../contexts/useEditMode';
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
      <div
        className={`relative ${className}`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          cursor: isEditMode ? 'pointer' : 'default',
          outline: isEditing ? '3px solid rgba(139, 115, 85, 0.8)' : 
                   isHovered && isEditMode ? '2px solid rgba(139, 115, 85, 0.4)' : 'none',
          outlineOffset: '2px',
          transition: 'outline 0.2s ease',
        }}
      >
        {children}
        
        {/* Edit Indicator - Bottom Left */}
        {isEditMode && (isHovered || isEditing) && (
          <div
            className="absolute bottom-1 left-1 z-20 bg-accent-600 text-white px-2 py-1 rounded text-xs font-medium shadow-lg flex items-center gap-1 border border-accent-400 pointer-events-none"
            style={{
              animation: isEditing ? 'pulse 2s infinite' : 'none'
            }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{label || type}</span>
          </div>
        )}
      </div>

      {/* Edit Modal via Portal - Rendered at root to avoid z-index stacking issues */}
      {showModal && createPortal(
        <EditModal
          isOpen={showModal}
          onClose={handleClose}
          onSave={handleSave}
          elementData={data}
          elementType={type}
          elementId={id}
          apiEndpoint={apiEndpoint}
        />,
        document.body
      )}
    </>
  );
};

export default EditableWrapper;
