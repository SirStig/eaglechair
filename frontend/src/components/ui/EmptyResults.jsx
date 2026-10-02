import { SearchX } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Shared "nothing matched" state for search + filter results.
 * Small icon badge, clear headline, optional hints and actions.
 */
const EmptyResults = ({
  icon: Icon = SearchX,
  title = 'No results found',
  message,
  hints,
  children,
  bordered = true,
  className,
}) => (
  <div
    role="status"
    className={clsx(
      'flex flex-col items-center text-center px-6 py-14 sm:py-16',
      bordered && 'bg-white rounded-xl border border-cream-200',
      className
    )}
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-100 ring-8 ring-cream-50 mb-5">
      <Icon className="h-6 w-6 text-slate-500" strokeWidth={1.75} aria-hidden />
    </div>
    <h2 className="text-lg sm:text-xl font-semibold text-slate-800">{title}</h2>
    {message && <p className="mt-2 max-w-md text-sm sm:text-base text-slate-600">{message}</p>}
    {hints?.length > 0 && (
      <ul className="mt-3 space-y-1 text-sm text-slate-500">
        {hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
    )}
    {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
  </div>
);

export default EmptyResults;
