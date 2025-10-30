import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
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
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter]);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        page_size: pagination.page_size,
      };
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await apiClient.get('/api/v1/admin/quotes', { params });
      setQuotes(response.items);
      setPagination(prev => ({
        ...prev,
        total: response.total,
        pages: response.pages
      }));
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.page_size, statusFilter]);

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

  const filteredQuotes = quotes.filter(quote => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      quote.quote_number?.toLowerCase().includes(searchLower) ||
      quote.company_name?.toLowerCase().includes(searchLower) ||
      quote.contact_name?.toLowerCase().includes(searchLower)
    );
  });

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
                setPagination(prev => ({ ...prev, page: 1 }));
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Quote #</th>
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Company</th>
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Contact</th>
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Items</th>
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Status</th>
                  <th className="text-left p-4 text-dark-300 font-medium text-sm">Created</th>
                  <th className="text-right p-4 text-dark-300 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="border-b border-dark-700 hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-medium text-accent-500">
                        #{quote.quote_number}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-dark-400" />
                        <span className="text-dark-50">{quote.company_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-dark-200">
                      {quote.contact_name || 'N/A'}
                    </td>
                    <td className="p-4 text-dark-200">
                      {quote.items?.length || 0} items
                    </td>
                    <td className="p-4">
                      {getStatusBadge(quote.status)}
                    </td>
                    <td className="p-4 text-dark-300 text-sm">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-dark-600">
            <p className="text-sm text-dark-400">
              Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
              {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
              {pagination.total} quotes
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {[...Array(pagination.pages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: i + 1 }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      pagination.page === i + 1
                        ? 'bg-accent-500 text-dark-900'
                        : 'text-dark-300 hover:bg-dark-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.pages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default QuoteManagement;
