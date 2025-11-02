import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  User, 
  ShoppingCart, 
  Package, 
  Clock, 
  CheckCircle,
  XCircle,
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import QuoteDetailsView from '../components/quotes/QuoteDetailsView';
import AccountSettings from '../components/account/AccountSettings';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import apiClient from '../config/apiClient';

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const cartStore = useCartStore();
  const cartItems = cartStore?.items || [];
  
  // Check if user needs email verification
  const isUnverified = user && user.type === 'company' && !user.isVerified;
  
  // Determine active tab from URL
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('/quotes')) return 'quotes';
    if (path.includes('/account')) return 'account';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [quotesData, setQuotesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quoteFilter, setQuoteFilter] = useState('all');
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);

  // Update active tab when URL changes
  useEffect(() => {
    const tab = getActiveTabFromPath();
    setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, quoteFilter]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'overview') {
        const data = await apiClient.get('/api/v1/dashboard/overview');
        setDashboardData(data);
      } else if (activeTab === 'quotes') {
        const data = await apiClient.get(`/api/v1/dashboard/quotes?status=${quoteFilter}`);
        setQuotesData(data.quotes || []);
      }
      // Account settings handles its own data loading
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { variant: 'default', icon: FileText },
      submitted: { variant: 'info', icon: Clock },
      under_review: { variant: 'warning', icon: Clock },
      quoted: { variant: 'primary', icon: DollarSign },
      accepted: { variant: 'success', icon: CheckCircle },
      declined: { variant: 'danger', icon: XCircle },
      expired: { variant: 'default', icon: XCircle },
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount / 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Sidebar navigation items with routes
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'quotes', label: 'My Quotes', icon: FileText, path: '/dashboard/quotes' },
    { id: 'cart', label: 'Shopping Cart', icon: ShoppingCart, badge: cartItems.length, path: '/cart' },
    { id: 'account', label: 'Account Settings', icon: User, path: '/dashboard/account' },
  ];

  return (
    <div className="min-h-screen bg-dark-800 flex flex-col">
      {/* Verification Banner - Fixed at top after header */}
      {isUnverified && (
        <div className="fixed top-[72px] sm:top-[88px] md:top-24 left-0 right-0 bg-yellow-900/30 border-b border-yellow-600 px-4 py-3 z-20">
          <div className="container max-w-7xl mx-auto flex items-center gap-3">
            <XCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-300">
                Please verify your email address to create quote requests.
              </p>
              <p className="text-xs text-yellow-400/80 mt-0.5">
                Check your email for the verification link or{' '}
                <button
                  onClick={() => navigate('/verify-email', { state: { email: user?.email } })}
                  className="underline hover:text-yellow-300"
                >
                  resend verification email
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Container - Adjust for banner height when shown */}
      <div className={`flex flex-1 pt-[88px] md:pt-24 ${isUnverified ? 'pt-[140px] md:pt-32' : ''}`}>
        
        {/* Sidebar - Adjust top position when banner is shown */}
        <aside className={`
          fixed ${isUnverified ? 'top-[136px] sm:top-[152px] md:top-40' : 'top-[72px] sm:top-[88px] md:top-24'} left-0 bottom-0
          bg-dark-700 border-r border-dark-600 
          transition-all duration-300 z-30 overflow-y-auto
          ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden md:w-20'}
        `}>
          <div className="p-4 pb-20"> {/* Add padding bottom for footer clearance */}
            {/* Company Info */}
            {isSidebarOpen && (
              <div className="mb-6 pb-6 border-b border-dark-600">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-dark-50 truncate">
                      {user?.companyName || 'Company'}
                    </h3>
                    <p className="text-xs text-dark-200 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <Badge variant={user?.status === 'approved' ? 'success' : 'warning'} className="w-full justify-center">
                  {user?.status || 'pending'}
                </Badge>
              </div>
            )}

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-colors relative group
                      ${isActive 
                        ? 'bg-primary-900/30 text-primary-400 font-medium' 
                        : 'text-dark-100 hover:bg-dark-600'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-400' : 'text-dark-300'}`} />
                    {isSidebarOpen && (
                      <>
                        <span className="flex-1 text-left text-sm">{item.label}</span>
                        {item.badge > 0 && (
                          <Badge variant="primary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                    {!isSidebarOpen && item.badge > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.badge}
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`
          flex-1 overflow-y-auto transition-all duration-300
          ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}
        `}>
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-dark-50">
                      Welcome back, {user?.companyName || 'User'}!
                    </h1>
                    <p className="text-dark-200 mt-1">
                      Here's what's happening with your account today.
                    </p>
                  </div>
                  <Button onClick={() => navigate('/products')} className="shrink-0">
                    <Package className="w-4 h-4 mr-2" />
                    Browse Products
                  </Button>
                </div>

                {/* Stats Grid */}
                {dashboardData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    <Card className="p-6 hover:shadow-lg transition-shadow bg-dark-700 border-dark-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-dark-200 mb-1">Total Quotes</p>
                          <p className="text-3xl font-bold text-dark-50">
                            {dashboardData.stats.totalQuotes}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 hover:shadow-lg transition-shadow bg-dark-700 border-dark-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-dark-200 mb-1">Pending Quotes</p>
                          <p className="text-3xl font-bold text-yellow-400">
                            {dashboardData.stats.pendingQuotes}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-yellow-900/30 rounded-xl flex items-center justify-center">
                          <Clock className="w-6 h-6 text-yellow-400" />
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 hover:shadow-lg transition-shadow bg-dark-700 border-dark-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-dark-200 mb-1">Active Orders</p>
                          <p className="text-3xl font-bold text-green-400">
                            {dashboardData.stats.activeOrders}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-green-900/30 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Recent Quotes */}
                <Card className="overflow-hidden bg-dark-700 border-dark-600">
                  <div className="p-6 border-b border-dark-600">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-dark-50">Recent Quotes</h2>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate('/dashboard/quotes')}
                      >
                        View All
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-dark-600 border-b border-dark-500">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Quote #
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Project
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Items
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-dark-700 divide-y divide-dark-600">
                        {dashboardData?.recentQuotes?.map((quote) => (
                          <tr key={quote.id} className="hover:bg-dark-600 transition-colors">
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-dark-50">
                              {quote.quoteNumber}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {quote.projectName || 'Untitled Project'}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {formatDate(quote.createdAt)}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(quote.status)}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {quote.itemCount} items
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-dark-50 text-right">
                              {quote.totalAmount ? formatCurrency(quote.totalAmount) : 'TBD'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    
                    {!dashboardData?.recentQuotes?.length && (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-dark-300 mx-auto mb-3" />
                        <p className="text-dark-200 mb-4">No quotes yet</p>
                        <Button onClick={() => navigate('/products')}>
                          Start Shopping
                        </Button>
                      </div>
                    )}
                </Card>
              </div>
            )}

            {/* Quotes Tab */}
            {activeTab === 'quotes' && (
              <>
                {selectedQuoteId ? (
                  <QuoteDetailsView 
                    quoteId={selectedQuoteId} 
                    onBack={() => setSelectedQuoteId(null)}
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <h1 className="text-2xl md:text-3xl font-bold text-dark-50">My Quotes</h1>
                      
                      <div className="flex flex-wrap gap-2">
                        {['all', 'submitted', 'under_review', 'quoted', 'accepted'].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setQuoteFilter(filter)}
                            className={`
                              px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[44px]
                              ${quoteFilter === filter
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-700 text-dark-100 hover:bg-dark-600 border border-dark-600'
                              }
                            `}
                          >
                            {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {quotesData.map((quote) => (
                        <Card key={quote.id} className="p-6 hover:shadow-md transition-shadow bg-dark-700 border-dark-600">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-dark-50">
                                  {quote.projectName || 'Untitled Project'}
                                </h3>
                                {getStatusBadge(quote.status)}
                              </div>
                              <div className="space-y-1 text-sm text-dark-200">
                                <p>Quote #{quote.quoteNumber}</p>
                                <p className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4" />
                                  Created {formatDate(quote.createdAt)}
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <Package className="w-4 h-4" />
                                  {quote.itemCount} items
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-3">
                              {quote.totalAmount > 0 && (
                                <p className="text-2xl font-bold text-dark-50">
                                  {formatCurrency(quote.totalAmount)}
                                </p>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedQuoteId(quote.id)}
                              >
                                View Details
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      
                      {quotesData.length === 0 && !loading && (
                        <Card className="p-12 text-center bg-dark-700 border-dark-600">
                          <FileText className="w-16 h-16 text-dark-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-dark-50 mb-2">No quotes found</h3>
                          <p className="text-dark-200 mb-6">
                            {quoteFilter === 'all' 
                              ? "You haven't created any quotes yet" 
                              : `No ${quoteFilter.replace('_', ' ')} quotes`
                            }
                          </p>
                          <Button onClick={() => navigate('/products')}>
                            Browse Products
                          </Button>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Account Settings Tab */}
            {activeTab === 'account' && (
              <AccountSettings />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-primary-700 transition-colors min-w-[56px] min-h-[56px]"
        aria-label="Toggle sidebar"
      >
        <LayoutDashboard className="w-6 h-6" />
      </button>
    </div>
  );
};

export default DashboardPage;


