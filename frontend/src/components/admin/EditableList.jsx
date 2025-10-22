import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../../contexts/EditModeContext';
import EditModal from './EditModal';
import Button from '../ui/Button';
import logger from '../../utils/logger';

const CONTEXT = 'EditableList';

/**
 * EditableList Component
 * 
 * Wraps an array of items to make them editable with add/edit/delete capabilities
 * Perfect for managing lists like hero slides, features, team members, etc.
 * 
 * @param {string} id - Unique identifier for this list
 * @param {Array} items - Array of items to display
 * @param {function} onUpdate - Callback when an item is updated (itemId, newData)
 * @param {function} onCreate - Callback when a new item is created (newData)
 * @param {function} onDelete - Callback when an item is deleted (itemId)
 * @param {string} itemType - Type of items in the list (e.g., 'hero-slide', 'feature')
 * @param {function} renderItem - Function to render each item (item, index)
 * @param {object} defaultNewItem - Default data structure for new items
 * @param {string} label - Label to display for this list
 * @param {string} addButtonText - Text for the add button
 */
const EditableList = ({
  id,
  items = [],
  onUpdate,
  onCreate,
  onDelete,
  itemType = 'item',
  renderItem,
  defaultNewItem = {},
  label = 'List',
  addButtonText = 'Add Item',
  className = ''
}) => {
  const { isEditMode } = useEditMode();
  const [editingItem, setEditingItem] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleEditClick = (e, item, index) => {
    if (isEditMode) {
      e.stopPropagation();
      e.preventDefault();
      logger.debug(CONTEXT, `Editing ${itemType} at index ${index}`);
      setEditingItem({ ...item, index });
    }
  };

  const handleDeleteClick = async (e, item, index) => {
    if (isEditMode && onDelete) {
      e.stopPropagation();
      e.preventDefault();
      
      const confirmed = window.confirm(`Are you sure you want to delete this ${itemType}?`);
      if (confirmed) {
        try {
          logger.info(CONTEXT, `Deleting ${itemType} ${item.id}`);
          await onDelete(item.id);
          logger.info(CONTEXT, `Successfully deleted ${itemType}`);
        } catch (error) {
          logger.error(CONTEXT, `Failed to delete ${itemType}`, error);
          alert(`Failed to delete ${itemType}: ${error.message}`);
        }
      }
    }
  };

  const handleAddClick = () => {
    if (isEditMode && onCreate) {
      logger.debug(CONTEXT, `Creating new ${itemType}`);
      setShowCreateModal(true);
    }
  };

  const handleSaveEdit = async (newData) => {
    try {
      if (onUpdate && editingItem) {
        logger.info(CONTEXT, `Updating ${itemType} ${editingItem.id}`);
        await onUpdate(editingItem.id, newData);
        logger.info(CONTEXT, `Successfully updated ${itemType}`);
      }
      setEditingItem(null);
    } catch (error) {
      logger.error(CONTEXT, `Failed to update ${itemType}`, error);
      throw error;
    }
  };

  const handleSaveCreate = async (newData) => {
    try {
      if (onCreate) {
        logger.info(CONTEXT, `Creating new ${itemType}`);
        await onCreate(newData);
        logger.info(CONTEXT, `Successfully created ${itemType}`);
      }
      setShowCreateModal(false);
    } catch (error) {
      logger.error(CONTEXT, `Failed to create ${itemType}`, error);
      throw error;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Add Button - Floats at top when in edit mode */}
      <AnimatePresence>
        {isEditMode && onCreate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Button
              onClick={handleAddClick}
              variant="primary"
              size="sm"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addButtonText}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items List */}
      <div className={className}>
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Edit Controls Overlay */}
            <AnimatePresence>
              {isEditMode && hoveredIndex === index && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-2 right-2 z-20 flex gap-2"
                >
                  {onUpdate && (
                    <button
                      onClick={(e) => handleEditClick(e, item, index)}
                      className="p-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg shadow-lg transition-all border border-accent-400"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => handleDeleteClick(e, item, index)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg transition-all border border-red-400"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Item Content with hover highlight */}
            <motion.div
              animate={{
                boxShadow: isEditMode && hoveredIndex === index
                  ? '0 0 0 2px rgba(139, 115, 85, 0.4)'
                  : '0 0 0 0px rgba(139, 115, 85, 0)'
              }}
              transition={{ duration: 0.2 }}
              className="rounded-lg"
            >
              {renderItem(item, index)}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
          elementData={editingItem}
          elementType={itemType}
          elementId={editingItem.id}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <EditModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveCreate}
          elementData={defaultNewItem}
          elementType={itemType}
          elementId="new"
        />
      )}
    </div>
  );
};

export default EditableList;

