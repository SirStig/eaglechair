import { clsx } from 'clsx';
import { ArrowLeft } from 'lucide-react';

/**
 * Page frame for an admin section: consistent gutters and max width so every
 * screen lines up under the shell's top bar.
 */
export function AdminPage({ children, className, width = 'wide' }) {
  const widths = {
    narrow: 'max-w-4xl',
    default: 'max-w-6xl',
    wide: 'max-w-[1600px]',
    full: 'max-w-none',
  };
  return (
    <div className={clsx('mx-auto w-full px-4 pt-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:py-8 space-y-6', widths[width], className)}>
      {children}
    </div>
  );
}

/**
 * Section header: small gold eyebrow, serif title (matches the public site's
 * headings), optional description and a right-aligned action slot.
 */
export function AdminPageHeader({ eyebrow, title, description, actions, icon: Icon, onBack, backLabel = 'Back', backDisabled = false, className }) {
  return (
    <header
      className={clsx(
        'flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-dark-200 transition-colors hover:text-dark-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </button>
        )}
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500/90">
            {eyebrow}
          </p>
        )}
        <h1 className="flex items-center gap-2.5 font-serif text-2xl font-bold leading-tight text-dark-50 sm:text-[1.75rem]">
          {Icon && <Icon className="h-6 w-6 flex-shrink-0 text-primary-500" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-dark-100">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export default AdminPage;
