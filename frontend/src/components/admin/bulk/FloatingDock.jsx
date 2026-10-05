import { createPortal } from 'react-dom';

/**
 * Bar pinned to the bottom of the window, over the admin content column.
 *
 * Rendered into document.body: the admin content wrapper has overflow and an
 * entry transform, which would otherwise trap `fixed` / `sticky` inside it.
 * The left edge follows the sidebar (--admin-rail, set by the dashboard) and
 * it sits above the PWA bottom nav (--admin-bottom-nav, set by AdminShell).
 * The right gutter leaves room for the floating AI button.
 *
 * An in-flow spacer keeps the end of the page reachable above the dock.
 */
export default function FloatingDock({ children, label, spacer = 'h-28' }) {
  if (typeof document === 'undefined') return null;
  return (
    <>
      <div className={spacer} aria-hidden="true" />
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center pl-3 pr-[4.25rem] sm:pl-6 sm:pr-24 md:left-[var(--admin-rail,0px)] bottom-[calc(var(--admin-bottom-nav,0px)+0.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(var(--admin-bottom-nav,0px)+1.25rem+env(safe-area-inset-bottom))]"
        >
          <div
            role="region"
            aria-label={label}
            className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-primary-500/50 bg-dark-800/95 shadow-2xl shadow-black/60 backdrop-blur animate-admin-in"
          >
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
