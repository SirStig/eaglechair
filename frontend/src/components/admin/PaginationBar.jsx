import Button from '../ui/Button';

const PaginationBar = ({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, position = 'top' }) => {
  if (totalPages <= 1 && total <= 0) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-4 ${position === 'top' ? 'border-b' : 'border-t'} border-dark-700`}>
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm text-dark-300">
          {total > 0
            ? `Showing ${((page - 1) * pageSize) + 1} to ${Math.min(page * pageSize, total)} of ${total}`
            : `Page ${page} of ${totalPages}`}
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor={`page-size-${position}`} className="text-sm text-dark-300">Per page:</label>
            <select
              id={`page-size-${position}`}
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onPageChange(1)} disabled={page === 1}>
          First
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
          Previous
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
          Next
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>
          Last
        </Button>
      </div>
    </div>
  );
};

export default PaginationBar;
