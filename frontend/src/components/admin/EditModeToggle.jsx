// eslint-disable-next-line no-unused-vars
import { m, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Pencil, Check, LayoutDashboard } from 'lucide-react';
import { useEditMode } from '../../contexts/useEditMode';
import DiscardChangesDialog from './DiscardChangesDialog';

/**
 * Floating CMS toolbar, pinned to the bottom-right corner.
 * Visible only to admins on public pages.
 */
const EditModeToggle = () => {
  const {
    isAdmin,
    isEditMode,
    hasUnsavedChanges,
    toggleEditMode,
    exitConfirmOpen,
    confirmExitEditMode,
    cancelExitEditMode,
  } = useEditMode();
  const location = useLocation();

  if (!isAdmin) return null;
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <m.div
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 sm:right-6 z-[10000] print:hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        role="toolbar"
        aria-label="Page editing"
        className={`flex items-center gap-1 rounded-xl border p-1 shadow-2xl backdrop-blur-md transition-colors ${
          isEditMode
            ? 'bg-editor-950/90 border-editor-500/60'
            : 'bg-dark-800/95 border-dark-500'
        }`}
      >
        <AnimatePresence initial={false}>
          {isEditMode && (
            <m.div
              key="status"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 whitespace-nowrap pl-3 pr-2" aria-live="polite">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${hasUnsavedChanges ? 'bg-amber-400' : 'bg-editor-400'}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-400' : 'bg-editor-400'}`} />
                </span>
                <span className="text-xs font-medium text-editor-100">
                  {hasUnsavedChanges ? 'Unsaved changes' : 'Editing'}
                </span>
                <span className="hidden md:inline text-xs text-editor-300/80">
                  · Click highlighted content to edit
                </span>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={toggleEditMode}
          aria-pressed={isEditMode}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-editor-400 ${
            isEditMode
              ? 'bg-editor-600 text-white hover:bg-editor-500'
              : 'text-dark-50 hover:bg-dark-700'
          }`}
        >
          {isEditMode
            ? <Check className="h-4 w-4" aria-hidden="true" />
            : <Pencil className="h-4 w-4" aria-hidden="true" />}
          {isEditMode ? 'Done' : 'Edit page'}
        </button>

        {!isEditMode && (
          <Link
            to="/admin/dashboard"
            title="Admin dashboard"
            aria-label="Admin dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-100 transition-colors hover:bg-dark-700 hover:text-dark-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-editor-400"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Turning edit mode off while an editor has unsaved changes */}
      <DiscardChangesDialog
        isOpen={exitConfirmOpen}
        onConfirm={confirmExitEditMode}
        onCancel={cancelExitEditMode}
        title="Exit edit mode?"
        message="An editor has unsaved changes. Exiting edit mode will discard them."
        confirmText="Discard and exit"
      />
    </m.div>
  );
};

export default EditModeToggle;
