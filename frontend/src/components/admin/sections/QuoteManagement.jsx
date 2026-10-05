import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import AdminQuoteDetailView from './AdminQuoteDetailView';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { useToast } from '../../../contexts/ToastContext';
import TableSortHead from '../TableSortHead';
import PaginationBar from '../PaginationBar';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { retiredBy } from '../bulk/bulkActions';
import { SelectAllCheckbox, SelectCell } from '../bulk/SelectCheckbox';
import { openOnRowClick } from '../bulk/rowClick';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Building2
} from 'lucide-react';

const QuoteManagement = () => {
  const { refreshKeys } = useAdminRefresh();
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchQuotes();
  }, [page, pageSize, statusFilter, sortBy, sortDir, refreshKeys.quotes]);

  const filteredQuotes = quotes.filter(quote => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      quote.quote_number?.toLowerCase().includes(searchLower) ||
      quote.company_name?.toLowerCase().includes(searchLower) ||
      quote.contact_name?.toLowerCase().includes(searchLower)
    );
  });

  const selection = useBulkSelection(filteredQuotes);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await apiClient.get('/api/v1/admin/quotes', { params });
      setQuotes(response.items || []);
      setTotal(response.total ?? 0);
      setTotalPages(response.pages || 1);
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, sortBy, sortDir]);

  // Status changes go through the per-quote endpoint (history, notifications)
  const setStatus = (status) => async (ids) => {
    let failCount = 0;
    for (const id of ids) {
      try {
        await apiClient.patch(`/api/v1/admin/quotes/${id}/status`, { status });
      } catch {
        failCount++;
      }
    }
    if (failCount === ids.length) throw new Error('Failed to update quote status');
    if (failCount > 0) toast.error(`Failed to update ${failCount}`);
  };

  const bulkActions = [
    { label: 'Under review', run: setStatus('under_review') },
    { label: 'Set to Quoted', run: setStatus('quoted') },
    { label: 'Decline', run: setStatus('declined'), tone: 'danger' },
    { label: 'Expire', run: setStatus('expired'), tone: 'danger' },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-dark-600', text: 'text-dark-300', icon: Clock },
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-500', icon: Clock },
      approved: { bg: 'bg-green-900/30', text: 'text-green-500', icon: CheckCircle },
      rejected: { bg: 'bg-red-900/30', text: 'text-red-500', icon: XCircle },
      expired: { bg: 'bg-dark-600', text: 'text-dark-400', icon: XCircle }
    };
    
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} flex items-center gap-1.5 w-fit`}>
        <Icon className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  };

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (key === sortBy ? (d === 'asc' ? 'desc' : 'asc') : key === 'created_at' ? 'desc' : 'asc'));
    setPage(1);
  }, [sortBy]);

  const handleStatusChange = async (quoteId, newStatus) => {
    try {
      await apiClient.patch(`/api/v1/admin/quotes/${quoteId}/status`, {
        status: newStatus
      });
      fetchQuotes();
    } catch (error) {
      console.error('Failed to update quote status:', error);
      alert('Failed to update quote status');
    }
  };

  const handleViewQuote = (quoteId) => {
    setSelectedQuoteId(quoteId);
  };

  const handleBackToList = () => {
    setSelectedQuoteId(null);
  };

  const handleQuoteUpdated = () => {
    fetchQuotes();
  };

  // Show detail view if quote is selected
  if (selectedQuoteId) {
    return (
      <AdminQuoteDetailView
        quoteId={selectedQuoteId}
        onBack={handleBackToList}
        onUpdated={handleQuoteUpdated}
      />
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Sales"
        title="Quotes"
        description="Manage and track customer quotes"
        actions={
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search by quote number, company, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Quotes List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-accent-500 rounded-full animate-spin" />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-300 text-lg">No quotes found</p>
            <p className="text-dark-400 text-sm mt-2">
              {searchTerm ? 'Try adjusting your search' : 'Quotes will appear here once created'}
            </p>
          </div>
        ) : (
          <>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="top"
            />
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-3 sm:p-4 py-3 text-left">
                    <SelectAllCheckbox selection={selection} label="Select all quotes" />
                  </th>
                  <TableSortHead label="Quote #" sortKey="quote_number" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Company" sortKey="company_name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Contact" sortKey="contact_name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Items" sortKey="items_count" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Status" sortKey="status" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Created" sortKey="created_at" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <th className="text-right px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className={`border-b border-dark-700 hover:bg-dark-700/50 transition-colors cursor-pointer ${selection.isSelected(quote.id) ? 'bg-primary-900/10' : ''}`}
                    onClick={openOnRowClick(() => handleViewQuote(quote.id))}
                  >
                    <SelectCell
                      selection={selection}
                      id={quote.id}
                      label={`Select quote ${quote.quote_number}`}
                      className="px-3 sm:p-4 py-3"
                    />
                    <td className="px-3 sm:p-4 py-3">
                      <span className="font-medium text-xs sm:text-sm text-accent-500">
                        #{quote.quote_number}
                      </span>
                    </td>
                    <td className="px-3 sm:p-4 py-3">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-dark-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-dark-50 truncate">{quote.company_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-200">
                      {quote.contact_name || 'N/A'}
                    </td>
                    <td className="px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-200">
                      {quote.items?.length || 0} items
                    </td>
                    <td className="px-3 sm:p-4 py-3">
                      {getStatusBadge(quote.status)}
                    </td>
                    <td className="px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 sm:p-4 py-3" data-no-select onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewQuote(quote.id)}
                          className="p-2 text-dark-300 hover:text-accent-500 hover:bg-dark-600 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {quote.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(quote.id, 'approved')}
                              className="p-2 text-dark-300 hover:text-green-500 hover:bg-dark-600 rounded-lg transition-all"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(quote.id, 'rejected')}
                              className="p-2 text-dark-300 hover:text-red-500 hover:bg-dark-600 rounded-lg transition-all"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="bottom"
            />
          </>
        )}
      </Card>
      <BulkActionBar
        selection={selection} permanentDelete={{ resource: 'quotes', isRetired: retiredBy(filteredQuotes, (q) => ['declined', 'expired'].includes(q.status)), retiredLabel: 'declined or expired' }}
        noun="quote"
        actions={bulkActions}
        onDone={fetchQuotes}
      />
    </AdminPage>
  );
};

export default QuoteManagement;
