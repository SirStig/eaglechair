import { useState, useEffect, useCallback, useRef } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import AdminQuoteDetailView from './AdminQuoteDetailView';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { useToast } from '../../../contexts/ToastContext';
import TableSortHead from '../TableSortHead';
import PaginationBar from '../PaginationBar';
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
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const lastSelectedIndexRef = useRef(null);
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

  useEffect(() => {
    lastSelectedIndexRef.current = null;
    setSelectedQuotes([]);
  }, [page]);

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

  const handleSelectQuote = useCallback((quoteId, index, event) => {
    if (event?.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeIds = filteredQuotes.slice(start, end + 1).map(q => q.id);
      setSelectedQuotes(rangeIds);
      lastSelectedIndexRef.current = index;
    } else {
      lastSelectedIndexRef.current = index;
      setSelectedQuotes(prev =>
        prev.includes(quoteId)
          ? prev.filter(id => id !== quoteId)
          : [...prev, quoteId]
      );
    }
  }, [filteredQuotes]);

  const handleSelectAll = () => {
    if (selectedQuotes.length === filteredQuotes.length) {
      setSelectedQuotes([]);
      lastSelectedIndexRef.current = null;
    } else {
      setSelectedQuotes(filteredQuotes.map(q => q.id));
      lastSelectedIndexRef.current = 0;
    }
  };

  const handleBulkStatus = async (newStatus) => {
    if (selectedQuotes.length === 0) {
      toast.warning('Please select quotes first');
      return;
    }
    setLoading(true);
    const ids = [...selectedQuotes];
    setSelectedQuotes([]);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of ids) {
        try {
          await apiClient.patch(`/api/v1/admin/quotes/${id}/status`, { status: newStatus });
          successCount++;
        } catch { failCount++; }
      }
      if (successCount > 0) toast.success(`${successCount} quote(s) status updated`);
      if (failCount > 0) toast.error(`Failed to update ${failCount}`);
      await fetchQuotes();
    } catch (error) {
      toast.error('Bulk action failed');
      setSelectedQuotes(ids);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50 flex items-center gap-2">
            <FileText className="w-7 h-7 text-accent-500" />
            Quote Management
          </h2>
          <p className="text-dark-300 mt-1">Manage and track customer quotes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

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

      {selectedQuotes.length > 0 && (
        <Card className="bg-primary-900/20 border-primary-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-dark-50 font-medium">
              {selectedQuotes.length} quote(s) selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkStatus('quoted')}>
                Set to Quoted
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatus('declined')}>
                Decline
              </Button>
            </div>
          </div>
        </Card>
      )}

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
                    <input type="checkbox" checked={filteredQuotes.length > 0 && selectedQuotes.length === filteredQuotes.length} onChange={handleSelectAll} className="rounded border-dark-600 bg-dark-700" />
                  </th>
                  <TableSortHead label="Quote #" sortKey="quote_number" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Company" sortKey="company_name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Contact" sortKey="contact_name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Items" sortKey="items" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Status" sortKey="status" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <TableSortHead label="Created" sortKey="created_at" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium" />
                  <th className="text-right px-3 sm:p-4 py-3 text-xs sm:text-sm text-dark-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote, index) => (
                  <tr
                    key={quote.id}
                    className={`border-b border-dark-700 hover:bg-dark-700/50 transition-colors cursor-pointer select-none ${selectedQuotes.includes(quote.id) ? 'bg-primary-900/10' : ''}`}
                    onClick={(e) => {
                      if (!e.target.closest('button') && !e.target.closest('[data-no-select]')) {
                        handleSelectQuote(quote.id, index, e);
                      }
                    }}
                  >
                    <td className="px-3 sm:p-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedQuotes.includes(quote.id)}
                        readOnly
                        onClick={(e) => { e.stopPropagation(); handleSelectQuote(quote.id, index, e); }}
                        className="rounded border-dark-600 bg-dark-700 cursor-pointer"
                      />
                    </td>
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
        )}

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
    </div>
  );
};

export default QuoteManagement;
