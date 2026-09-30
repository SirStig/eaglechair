import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

/**
 * In-app "discard unsaved changes?" confirmation (replaces window.confirm).
 * Rendered above the edit modal; Escape or "Keep editing" cancels.
 */
const DiscardChangesDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Discard unsaved changes?',
  message = 'You have changes that have not been saved. If you leave now they will be lost.',
  confirmText = 'Discard changes',
  cancelText = 'Keep editing',
}) => {
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Don't let the edit modal underneath treat this as its own Escape
        e.stopPropagation();
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        // Keep focus on the two dialog buttons
        const buttons = [...(dialogRef.current?.querySelectorAll('button') || [])];
        if (buttons.length === 0) return;
        const index = buttons.indexOf(document.activeElement);
        const next = e.shiftKey
          ? buttons[(index - 1 + buttons.length) % buttons.length]
          : buttons[(index + 1) % buttons.length];
        e.preventDefault();
        e.stopPropagation();
        next.focus();
      }
    };
    // Capture phase so this runs before the edit modal's handler
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Portal to <body> so a transformed/stacking parent can't trap it under the edit modal
  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        data-testid="discard-changes-dialog"
        className="relative w-full max-w-md bg-dark-800 border border-dark-600 rounded-xl shadow-2xl p-6"
      >
        <h3 id={titleId} className="text-lg font-semibold text-dark-50 mb-2">
          {title}
        </h3>
        <p id={messageId} className="text-sm text-dark-100 mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-dark-500 text-dark-50 hover:bg-dark-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DiscardChangesDialog;
