import { useState, useEffect, useRef, lazy, Suspense } from 'react';
// eslint-disable-next-line no-unused-vars
import { m, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, ChevronUp, ChevronDown, GripVertical, Plus } from 'lucide-react';
import { useEditMode } from '../../contexts/useEditMode';
import { useToast } from '../../contexts/ToastContext';
import Button from '../ui/Button';
import DiscardChangesDialog from './DiscardChangesDialog';
import logger from '../../utils/logger';
import DeleteGate from './DeleteGate';

const CONTEXT = 'EditableList';

// "hero-slide" -> "hero slide"
const CONTROL_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-dark-50 transition-colors hover:bg-editor-600 hover:text-white disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-editor-400';

const readable = (type) => String(type).replace(/[-_]/g, ' ');

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
  const [pendingDelete, setPendingDelete] = useState(null);
  const reorderingRef = useRef(false);
  const itemLabel = readable(itemType);

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

  const handleDeleteClick = (e, item) => {
    if (isEditMode && onDelete) {
      e.stopPropagation();
      e.preventDefault();
      setPendingDelete(item);
    }
  };

  const confirmDelete = async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    try {
      logger.info(CONTEXT, `Deleting ${itemType} ${item.id}`);
      await onDelete(item.id);
      if (refetch) await refetch();
      toast.success(`Deleted ${itemLabel}`);
    } catch (error) {
      logger.error(CONTEXT, `Failed to delete ${itemType}`, error);
      toast.error(`Couldn't delete ${itemLabel}: ${error.message || 'Unknown error'}`);
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

  // Moves an item and saves the new order (optimistic, rolled back on failure).
  // toIndex is the final position of the item.
  const moveItem = async (fromIndex, toIndex) => {
    if (!canReorder || fromIndex === toIndex || toIndex < 0 || toIndex >= displayItems.length) return;
    const previousItems = displayItems;
    const newItems = [...previousItems];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    setOptimisticItems(newItems);
    reorderingRef.current = true;
    setReordering(true);
    try {
      await onReorder(newItems, { item: movedItem, fromIndex, toIndex });
      logger.info(CONTEXT, `Reordered ${itemType}`, { from: fromIndex, to: toIndex });
    } catch (error) {
      logger.error(CONTEXT, `Failed to reorder ${itemType}`, error);
      setOptimisticItems(null);
      toast.error(`Couldn't save the new order: ${error?.message || 'Unknown error'}`);
    } finally {
      reorderingRef.current = false;
      setReordering(false);
    }
  };

  const handleDrop = (e, dropIndex) => {
    if (!canReorder || draggedIndex === null) return;
    e.preventDefault();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (fromIndex === dropIndex) return;
    // Dropping on an item inserts before it
    moveItem(fromIndex, fromIndex < dropIndex ? dropIndex - 1 : dropIndex);
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
        toast.success(`Saved ${itemLabel}`);
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
        toast.success(`Added ${itemLabel}`);
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
      <AnimatePresence>
        {isEditMode && onCreate && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4"
          >
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-dashed border-editor-400/70 bg-editor-950/40 px-4 text-sm font-medium text-editor-200 transition-colors hover:border-editor-300 hover:bg-editor-900/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-editor-400"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {addButtonText}
            </button>
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
              dragOverIndex === index ? 'before:absolute before:-top-2 before:left-0 before:right-0 before:h-1 before:rounded-full before:bg-editor-400' : ''
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
            {/* Edit controls: visible on hover, on keyboard focus within the
                item, and always on touch devices (no hover). */}
            {isEditMode && (onUpdate || onDelete || (allowReorder && onReorder)) && (
              <div
                className="editable-list-controls absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg border border-editor-500/50 bg-dark-900/95 p-0.5 opacity-0 shadow-lg backdrop-blur pointer-events-none transition-opacity duration-150 group-hover/editable:opacity-100 group-hover/editable:pointer-events-auto group-focus-within/editable:opacity-100 group-focus-within/editable:pointer-events-auto"
              >
                {allowReorder && onReorder && (
                  <>
                    <span className="hidden px-1 text-dark-200 sm:inline-flex" aria-hidden="true" title="Drag to reorder">
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(index, index - 1); }}
                      disabled={!canReorder || index === 0}
                      className={CONTROL_BUTTON}
                      title="Move earlier"
                      aria-label={`Move ${itemLabel} ${index + 1} earlier`}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(index, index + 1); }}
                      disabled={!canReorder || index === displayItems.length - 1}
                      className={CONTROL_BUTTON}
                      title="Move later"
                      aria-label={`Move ${itemLabel} ${index + 1} later`}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
                {onUpdate && (
                  <button
                    type="button"
                    onClick={(e) => handleEditClick(e, item, index)}
                    className={CONTROL_BUTTON}
                    title="Edit"
                    aria-label={`Edit ${itemLabel} ${index + 1}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                {onDelete && (
                  <DeleteGate>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, item)}
                    className={`${CONTROL_BUTTON} hover:!bg-red-900/60 hover:!text-red-200`}
                    title="Delete"
                    aria-label={`Delete ${itemLabel} ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  </DeleteGate>
                )}
              </div>
            )}

            <div
              className={`h-full rounded-lg transition-[outline-color] duration-150 ${
                isEditMode
                  ? hoveredIndex === index
                    ? 'outline outline-2 outline-offset-2 outline-editor-400'
                    : 'outline-dashed outline-1 outline-offset-2 outline-editor-400/50'
                  : ''
              }`}
            >
              {renderItem(item, index)}
            </div>
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

      <DiscardChangesDialog
        isOpen={!!pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        title={`Delete this ${itemLabel}?`}
        message="It will be removed from the live site immediately. This can't be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default EditableList;
