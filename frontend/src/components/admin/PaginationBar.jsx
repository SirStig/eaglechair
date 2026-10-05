import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [50, 100, 150, 250, 500];

function PageButton({ onClick, disabled, label, children, className = 'flex' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${className} h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-dark-100 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-dark-50 disabled:pointer-events-none disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

const PaginationBar = ({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, position = 'top' }) => {
  if (totalPages <= 1 && total <= 0) return null;

  return (
    // Phones get only the bottom bar, on a single row
    <div className={`items-center justify-between gap-3 px-4 py-3 ${position === 'top' ? 'hidden sm:flex border-b' : 'flex border-t'} border-white/[0.06]`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <p className="text-sm text-dark-200 tabular-nums">
          {total > 0 ? (
            <>
              <span className="text-dark-50">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}</span> of {total}
            </>
          ) : `Page ${page} of ${totalPages}`}
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor={`page-size-${position}`} className="hidden sm:inline text-sm text-dark-200">Rows</label>
            <select
              id={`page-size-${position}`}
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-8 rounded-md border border-white/[0.08] bg-dark-900 px-2 text-sm text-dark-50 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <PageButton className="hidden sm:flex" label="First page" onClick={() => onPageChange(1)} disabled={page === 1}>
          <ChevronsLeft className="h-4 w-4" />
        </PageButton>
        <PageButton label="Previous page" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </PageButton>
        <span className="px-2 text-sm tabular-nums text-dark-100">
          {page} <span className="text-dark-300">/</span> {Math.max(totalPages, 1)}
        </span>
        <PageButton label="Next page" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </PageButton>
        <PageButton className="hidden sm:flex" label="Last page" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
          <ChevronsRight className="h-4 w-4" />
        </PageButton>
      </div>
    </div>
  );
};

export default PaginationBar;
