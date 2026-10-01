import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../../contexts/useEditMode';
import { useToast } from '../../contexts/ToastContext';
import Button from '../ui/Button';
import logger from '../../utils/logger';

const CONTEXT = 'EditableList';

// Admin-only; fetched when an item is edited/created
const EditModal = lazy(() => import('./EditModal'));

/**
 * EditableList Component
 *
 * Wraps an array of items to make them editable with add/edit/delete/reorder capabilities
 * Perfect for managing lists like hero slides, features, team members, etc.
 *
 * Writes go through services/cmsAdminService; the API client invalidates the
 * shared CMS content caches afterwards, so the list re-renders with fresh data
 * without an explicit refetch.
 *
 * @param {Array} items - Array of items to display
 * @param {function} onUpdate - Callback when an item is updated (itemId, newData)
 * @param {function} onCreate - Callback when a new item is created (newData)
 * @param {function} onDelete - Callback when an item is deleted (itemId)
 * @param {function} onReorder - Callback when items are reordered
 *   (reorderedItems, { item, fromIndex, toIndex }); may return a promise.
 *   The new order is shown optimistically and rolled back if it rejects.
 * @param {function} refetch - Optional extra callback awaited after changes
 * @param {string} itemType - Type of items in the list (e.g., 'hero-slide', 'feature')
 * @param {function} renderItem - Function to render each item (item, index)
 * @param {object} defaultNewItem - Default data structure for new items
 * @param {string} addButtonText - Text for the add button
 * @param {boolean} allowReorder - Whether to allow drag-and-drop reordering
 */
const EditableList = ({
  items = [],
  onUpdate,
  onCreate,
  onDelete,
  onReorder,
  refetch,
  itemType = 'item',
  renderItem,
  defaultNewItem = {},
  addButtonText = 'Add Item',
  allowReorder = true,
  className = ''
}) => {
  const { isEditMode } = useEditMode();
  const toast = useToast();
  const [editingItem, setEditingItem] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Order shown while a reorder is being saved (null = use `items`)
  const [optimisticItems, setOptimisticItems] = useState(null);
  const [reordering, setReordering] = useState(false);
  const reorderingRef = useRef(false);

  const canReorder = isEditMode && allowReorder && !!onReorder && !reordering;
  const displayItems = optimisticItems || items;

  // Fresh data from the server replaces the optimistic order (but not while
  // the reorder is still being saved)
  useEffect(() => {
    if (!reorderingRef.current) setOptimisticItems(null);
  }, [items]);

  const handleEditClick = (e, item, index) => {
    if (isEditMode) {
      e.stopPropagation();
      e.preventDefault();
      logger.debug(CONTEXT, `Editing ${itemType} at index ${index}`);
      setEditingItem({ ...item, index });
    }
  };

  const handleDeleteClick = async (e, item) => {
    if (isEditMode && onDelete) {
      e.stopPropagation();
      e.preventDefault();

      const confirmed = window.confirm(`Are you sure you want to delete this ${itemType}?`);
      if (confirmed) {
        try {
          logger.info(CONTEXT, `Deleting ${itemType} ${item.id}`);
          await onDelete(item.id);
          if (refetch) await refetch();
          logger.info(CONTEXT, `Successfully deleted ${itemType}`);
        } catch (error) {
          logger.error(CONTEXT, `Failed to delete ${itemType}`, error);
          toast.error(`Failed to delete ${itemType}: ${error.message || 'Unknown error'}`);
        }
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    if (!canReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    if (!canReorder || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = async (e, dropIndex) => {
    if (!canReorder || draggedIndex === null) return;
    e.preventDefault();

    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (fromIndex === dropIndex) return;

    const previousItems = displayItems;
    const newItems = [...previousItems];
    const [draggedItem] = newItems.splice(fromIndex, 1);
    // Insert at new position (adjust index if dragging from earlier position)
    const insertIndex = fromIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newItems.splice(insertIndex, 0, draggedItem);

    setOptimisticItems(newItems);
    reorderingRef.current = true;
    setReordering(true);
    try {
      await onReorder(newItems, { item: draggedItem, fromIndex, toIndex: insertIndex });
      logger.info(CONTEXT, `Reordered ${itemType}`, { from: fromIndex, to: insertIndex });
    } catch (error) {
      logger.error(CONTEXT, `Failed to reorder ${itemType}`, error);
      // Restore the order from before the drag
      setOptimisticItems(null);
      toast.error(`Couldn't save the new order: ${error?.message || 'Unknown error'}`);
    } finally {
      reorderingRef.current = false;
      setReordering(false);
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

        // Remove the 'index' field before sending - it's not part of the API schema
        // eslint-disable-next-line no-unused-vars
        const { index, ...cleanData } = newData;

        await onUpdate(editingItem.id, cleanData);
        if (refetch) await refetch();
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
        if (refetch) await refetch();
        logger.info(CONTEXT, `Successfully created ${itemType}`);
      }
      setShowCreateModal(false);
    } catch (error) {
      logger.error(CONTEXT, `Failed to create ${itemType}`, error);
      throw error;
    }
  };

  return (
    <div className="relative">
      {/* Add Button - Floats at top when in edit mode */}
      <AnimatePresence>
        {isEditMode && onCreate && (
          <m.div
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
          </m.div>
        )}
      </AnimatePresence>

      {/* Items List */}
      <div className={className} aria-busy={reordering || undefined}>
        {displayItems.map((item, index) => (
          <div
            key={item.id || index}
            className={`group/editable relative ${
              canReorder ? 'cursor-move' : ''
            } ${
              dragOverIndex === index ? 'border-t-4 border-accent-400' : ''
            } ${
              draggedIndex === index ? 'opacity-50' : ''
            }`}
            draggable={canReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Drag Handle - Shows when in edit mode and reordering is allowed */}
            {isEditMode && allowReorder && onReorder && (
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 opacity-60 hover:opacity-100 transition-opacity" aria-hidden="true">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                </svg>
              </div>
            )}

            {/* Edit Controls Overlay: visible on hover, on keyboard focus
                within the item, and always on touch devices (no hover). */}
            {isEditMode && (onUpdate || onDelete) && (
              <div
                className="editable-list-controls absolute top-2 right-2 z-20 flex gap-2 opacity-0 pointer-events-none transition-opacity duration-200 group-hover/editable:opacity-100 group-hover/editable:pointer-events-auto group-focus-within/editable:opacity-100 group-focus-within/editable:pointer-events-auto"
              >
                {onUpdate && (
                  <button
                    type="button"
                    onClick={(e) => handleEditClick(e, item, index)}
                    className="p-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg shadow-lg transition-all border border-accent-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    title="Edit"
                    aria-label={`Edit ${itemType} ${index + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, item)}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg transition-all border border-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    title="Delete"
                    aria-label={`Delete ${itemType} ${index + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Item Content with hover highlight */}
            <m.div
              animate={{
                boxShadow: isEditMode && hoveredIndex === index
                  ? '0 0 0 2px rgba(139, 115, 85, 0.4)'
                  : '0 0 0 0px rgba(139, 115, 85, 0)'
              }}
              transition={{ duration: 0.2 }}
              className="rounded-lg h-full"
            >
              {renderItem(item, index)}
            </m.div>
          </div>
        ))}
      </div>

      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
};

export default EditableList;
