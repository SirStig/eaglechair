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
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import apiClient from '../config/apiClient';

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const cartStore = useCartStore();
  const cartItems = cartStore?.items || [];
  
  // Determine active tab from URL
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('/quotes')) return 'quotes';
    if (path.includes('/profile')) return 'profile';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [quotesData, setQuotesData] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteFilter, setQuoteFilter] = useState('all');

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
      } else if (activeTab === 'profile') {
        const data = await apiClient.get('/api/v1/dashboard/profile');
        setProfileData(data);
      }
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
    { id: 'profile', label: 'Account Settings', icon: User, path: '/dashboard/profile' },
  ];

  return (
    <div className="min-h-screen bg-dark-800 flex flex-col">
      {/* Main Container */}
      <div className="flex flex-1 pt-[88px] md:pt-24"> {/* Account for header: mobile ~88px, desktop ~96px */}
        
        {/* Sidebar */}
        <aside className={`
          fixed top-[88px] md:top-24 left-0 bottom-0
          bg-dark-700 border-r border-dark-600 
          transition-all duration-300 z-30 overflow-y-auto
          ${isSidebarOpen ? 'w-64' : 'w-0 md:w-20'}
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
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-dark-600 border-b border-dark-500">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Quote #
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Project
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Items
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-dark-200 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-dark-700 divide-y divide-dark-600">
                        {dashboardData?.recentQuotes?.map((quote) => (
                          <tr key={quote.id} className="hover:bg-dark-600 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark-50">
                              {quote.quoteNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {quote.projectName || 'Untitled Project'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {formatDate(quote.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(quote.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-100">
                              {quote.itemCount} items
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark-50 text-right">
                              {quote.totalAmount ? formatCurrency(quote.totalAmount) : 'TBD'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {!dashboardData?.recentQuotes?.length && (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-dark-300 mx-auto mb-3" />
                        <p className="text-dark-200 mb-4">No quotes yet</p>
                        <Button onClick={() => navigate('/products')}>
                          Start Shopping
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Quotes Tab */}
            {activeTab === 'quotes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-dark-50">My Quotes</h1>
                  
                  <div className="flex flex-wrap gap-2">
                    {['all', 'submitted', 'under_review', 'quoted', 'accepted'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setQuoteFilter(filter)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-colors
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
                          <Button variant="outline" size="sm">
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

            {/* Profile Tab */}
            {activeTab === 'profile' && profileData && (
              <div className="space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold text-dark-50">Account Settings</h1>

                <div className="grid gap-6">
                  {/* Company Information */}
                  <Card className="p-6 bg-dark-700 border-dark-600">
                    <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Company Information
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Company Name
                        </label>
                        <p className="text-dark-50">{profileData.companyName}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Legal Name
                        </label>
                        <p className="text-dark-50">{profileData.legalName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Tax ID
                        </label>
                        <p className="text-dark-50">{profileData.taxId || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Industry
                        </label>
                        <p className="text-dark-50">{profileData.industry || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Website
                        </label>
                        <p className="text-dark-50">{profileData.website || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Account Status
                        </label>
                        <Badge variant={profileData.status === 'approved' ? 'success' : 'warning'}>
                          {profileData.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>

                  {/* Representative Information */}
                  <Card className="p-6 bg-dark-700 border-dark-600">
                    <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Representative Information
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Full Name
                        </label>
                        <p className="text-dark-50">
                          {profileData.representative.firstName} {profileData.representative.lastName}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1">
                          Title
                        </label>
                        <p className="text-dark-50">{profileData.representative.title || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1 flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          Email
                        </label>
                        <p className="text-dark-50">{profileData.representative.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-1 flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          Phone
                        </label>
                        <p className="text-dark-50">{profileData.representative.phone}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Billing Address */}
                  <Card className="p-6 bg-dark-700 border-dark-600">
                    <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Billing Address
                    </h2>
                    <div className="text-dark-50 space-y-1">
                      <p>{profileData.billingAddress.line1}</p>
                      {profileData.billingAddress.line2 && <p>{profileData.billingAddress.line2}</p>}
                      <p>
                        {profileData.billingAddress.city}, {profileData.billingAddress.state} {profileData.billingAddress.zip}
                      </p>
                      <p>{profileData.billingAddress.country}</p>
                    </div>
                  </Card>

                  {/* Shipping Address */}
                  {profileData.shippingAddress && (
                    <Card className="p-6 bg-dark-700 border-dark-600">
                      <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Shipping Address
                      </h2>
                      <div className="text-dark-50 space-y-1">
                        <p>{profileData.shippingAddress.line1}</p>
                        {profileData.shippingAddress.line2 && <p>{profileData.shippingAddress.line2}</p>}
                        <p>
                          {profileData.shippingAddress.city}, {profileData.shippingAddress.state} {profileData.shippingAddress.zip}
                        </p>
                        <p>{profileData.shippingAddress.country}</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-primary-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <LayoutDashboard className="w-6 h-6" />
      </button>
    </div>
  );
};

export default DashboardPage;


