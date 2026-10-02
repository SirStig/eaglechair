import { useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { useEditMode } from '../../contexts/useEditMode';
import { useToast } from '../../contexts/ToastContext';
import { isPublishFailed } from '../../utils/cmsContentStore';
import logger from '../../utils/logger';

const CONTEXT = 'EditableWrapper';

// Admin-only; fetched when an edit is started
const EditModal = lazy(() => import('./EditModal'));

/**
 * EditableWrapper Component
 *
 * Wraps any content to make it editable in edit mode
 * Supports: text, textarea, image, rich-text, array
 *
 * Saving goes through services/cmsAdminService; the API client then
 * invalidates the shared CMS content caches, so every content hook on the
 * page (Header, Footer, ...) re-fetches. No per-call refetch is needed.
 *
 * @param {string} id - Unique identifier for this editable element
 * @param {string} type - Type of content (text, textarea, image, rich-text, array)
 * @param {object} data - Current data for this element
 * @param {function} onSave - Callback when content is saved
 * @param {function} refetch - Optional extra callback awaited after save
 *   (for data that is not loaded through the content hooks)
 * @param {object[]} fieldSchema - Optional field schema for EditModal
 * @param {string} apiEndpoint - API endpoint to save to (e.g., '/api/v1/content/hero-slides/1')
 * @param {string} label - Label to display in edit indicator
 * @param {ReactNode} children - The content to wrap
 */
const EditableWrapper = ({
  id,
  type = 'text',
  data,
  onSave,
  refetch,
  fieldSchema,
  apiEndpoint,
  label,
  children,
  className = ''
}) => {
  const { isEditMode, editingElement, startEditing, stopEditing } = useEditMode();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isEditing = editingElement?.id === id;
  const displayLabel = label || type;

  const openEditor = () => {
    logger.debug(CONTEXT, `Starting edit for ${id} (${type})`);
    startEditing(id, type, data);
    setShowModal(true);
  };

  const handleClick = (e) => {
    if (isEditMode && !isEditing) {
      e.stopPropagation();
      e.preventDefault();
      openEditor();
    }
  };

  const handleKeyDown = (e) => {
    // Only react to keys pressed on the wrapper itself, not on inner controls
    if (e.target !== e.currentTarget || isEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      openEditor();
    }
  };

  const handleClose = () => {
    setShowModal(false);
    stopEditing();
  };

  const handleSave = async (newData) => {
    try {
      logger.info(CONTEXT, `Saving ${id}`, newData);
      let result;
      if (onSave) {
        result = await onSave(newData);
      }
      if (refetch) {
        await refetch();
      }
      setShowModal(false);
      stopEditing();
      // A save that didn't publish already raises a global warning toast
      if (!isPublishFailed(result)) toast.success(`${displayLabel} saved`);
    } catch (error) {
      logger.error(CONTEXT, `Failed to save ${id}`, error);
      throw error;
    }
  };

  // If not in edit mode, just render children
  if (!isEditMode) {
    return children;
  }

  const highlighted = isHovered || isFocused;
  // Every editable region gets a faint dashed outline in edit mode so admins
  // can see what is editable; hover/focus/active editing makes it solid.
  const outlineClass = isEditing
    ? 'outline outline-2 outline-editor-500'
    : highlighted
      ? 'outline outline-2 outline-editor-400'
      : 'outline-dashed outline-1 outline-editor-400/50';

  return (
    <>
      <div
        className={`relative cursor-pointer rounded-sm outline-offset-2 transition-[outline-color] duration-150 ${outlineClass} ${className}`}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${displayLabel}`}
        aria-haspopup="dialog"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { if (e.target === e.currentTarget) setIsFocused(true); }}
        onBlur={(e) => { if (e.target === e.currentTarget) setIsFocused(false); }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}

        {(highlighted || isEditing) && (
          <div
            className="pointer-events-none absolute left-1 top-1 z-20 flex items-center gap-1 rounded-md bg-editor-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-md"
            aria-hidden="true"
          >
            <Pencil className="h-3 w-3" />
            <span className="max-w-[16rem] truncate">{displayLabel}</span>
          </div>
        )}
      </div>

      {/* Edit Modal via Portal - Rendered at root to avoid z-index stacking issues */}
      {showModal && createPortal(
        <Suspense fallback={null}>
          <EditModal
            isOpen={showModal}
            onClose={handleClose}
            onSave={handleSave}
            elementData={data}
            elementType={type}
            elementId={id}
            fieldSchema={fieldSchema}
            apiEndpoint={apiEndpoint}
          />
        </Suspense>,
        document.body
      )}
    </>
  );
};

export default EditableWrapper;
