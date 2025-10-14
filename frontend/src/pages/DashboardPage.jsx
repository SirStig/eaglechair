import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { IS_DEMO } from '../data/demoData';

const DashboardPage = () => {
  const { user } = useAuthStore();
  const [quotes, setQuotes] = useState([]);
  const [stats, setStats] = useState({
    totalQuotes: 0,
    pendingQuotes: 0,
    activeOrders: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (IS_DEMO) {
      // Demo data
      setStats({
        totalQuotes: 12,
        pendingQuotes: 3,
        activeOrders: 2,
      });
      setQuotes([
        {
          id: 1,
          number: 'QT-2024-001',
          date: '2024-01-15',
          status: 'pending',
          items: 5,
          total: 12500,
        },
        {
          id: 2,
          number: 'QT-2024-002',
          date: '2024-01-10',
          status: 'approved',
          items: 8,
          total: 18750,
        },
        {
          id: 3,
          number: 'QT-2023-089',
          date: '2023-12-20',
          status: 'completed',
          items: 12,
          total: 25000,
        },
      ]);
    } else {
      // Real API
      try {
        const response = await fetch('/api/v1/dashboard');
        const data = await response.json();
        setStats(data.stats);
        setQuotes(data.recentQuotes);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      }
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      completed: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const statsCards = [
    {
      title: 'Total Quotes',
      value: stats.totalQuotes,
      icon: '📋',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Pending Quotes',
      value: stats.pendingQuotes,
      icon: '⏳',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      title: 'Active Orders',
      value: stats.activeOrders,
      icon: '📦',
      color: 'bg-green-50 text-green-600',
    },
  ];

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-dark-50">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-lg text-dark-100">
            Here's an overview of your account and recent activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl border-2 ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-sm text-dark-100 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-dark-50">{stat.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Quotes */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-dark-50">Recent Quotes</h2>
                <Link to="/quotes">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              {quotes.length === 0 ? (
                <div className="text-center py-12 text-dark-200">
                  <svg className="w-16 h-16 text-dark-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mb-4 text-dark-100">No quotes yet</p>
                  <Link to="/quote-request">
                    <Button variant="primary">
                      Request Your First Quote
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="border border-dark-500 rounded-lg p-4 hover:border-primary-500 transition-colors bg-dark-700"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg text-dark-50">{quote.number}</h3>
                          <p className="text-sm text-dark-200">
                            {new Date(quote.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        {getStatusBadge(quote.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-dark-200">Items</p>
                          <p className="font-semibold text-dark-50">{quote.items}</p>
                        </div>
                        <div>
                          <p className="text-sm text-dark-200">Total</p>
                          <p className="font-semibold text-dark-50">${quote.total.toLocaleString()}</p>
                        </div>
                      </div>
                      <Link to={`/quotes/${quote.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-xl font-bold mb-4 text-dark-50">Quick Actions</h3>
              <div className="space-y-3">
                <Link to="/quote-request" className="block">
                  <Button variant="primary" size="md" className="w-full">
                    Request New Quote
                  </Button>
                </Link>
                <Link to="/products" className="block">
                  <Button variant="outline" size="md" className="w-full">
                    Browse Products
                  </Button>
                </Link>
                <Link to="/cart" className="block">
                  <Button variant="outline" size="md" className="w-full">
                    View Cart
                  </Button>
                </Link>
                <Link to="/find-a-rep" className="block">
                  <Button variant="outline" size="md" className="w-full">
                    Contact Your Rep
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-dark-700 to-dark-600 border-primary-500">
              <h3 className="font-semibold mb-2 text-dark-50">Account Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-dark-200">Name</p>
                  <p className="font-medium text-dark-50">{user?.name}</p>
                </div>
                <div>
                  <p className="text-dark-200">Email</p>
                  <p className="font-medium text-dark-50">{user?.email}</p>
                </div>
                <div>
                  <p className="text-dark-200">Company</p>
                  <p className="font-medium text-dark-50">{user?.company}</p>
                </div>
              </div>
              <Link to="/account/settings" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  Edit Profile
                </Button>
              </Link>
            </Card>

            {user?.role === 'admin' && (
              <Card className="bg-gradient-to-br from-primary-900 to-secondary-900 border-2 border-primary-500">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-dark-50">
                  <span>👑</span> Admin Access
                </h3>
                <p className="text-sm text-dark-100 mb-3">
                  You have administrator privileges
                </p>
                <Link to="/admin">
                  <Button variant="primary" size="sm" className="w-full">
                    Admin Panel
                  </Button>
                </Link>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;


