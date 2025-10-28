import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';
import { 
  Package, 
  FileText, 
  Building2, 
  TrendingUp, 
  PlusCircle, 
  Tags, 
  ClipboardList, 
  Settings as SettingsIcon,
  ArrowRight
} from 'lucide-react';

/**
 * Dashboard Overview
 * 
 * Main dashboard page with:
 * - Quick stats
 * - Recent activity
 * - Quick actions
 */
const DashboardOverview = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/v1/admin/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Add Product', icon: PlusCircle, action: () => onNavigate('catalog'), color: 'primary' },
    { label: 'Manage Categories', icon: Tags, action: () => onNavigate('categories'), color: 'accent' },
    { label: 'View Quotes', icon: ClipboardList, action: () => onNavigate('quotes'), color: 'green' },
    { label: 'Site Settings', icon: SettingsIcon, action: () => onNavigate('settings'), color: 'blue' },
  ];

  const statCards = [
    {
      title: 'Total Products',
      value: stats?.total_products || 0,
      change: `${stats?.active_products || 0} active`,
      icon: Package,
      color: 'primary',
      bgGradient: 'from-primary-500/10 to-primary-600/5',
    },
    {
      title: 'Pending Quotes',
      value: stats?.pending_quotes || 0,
      change: `${stats?.total_quotes || 0} total quotes`,
      icon: FileText,
      color: 'accent',
      bgGradient: 'from-accent-500/10 to-accent-600/5',
    },
    {
      title: 'Active Companies',
      value: stats?.active_companies || 0,
      change: `${stats?.total_companies || 0} total companies`,
      icon: Building2,
      color: 'green',
      bgGradient: 'from-green-500/10 to-green-600/5',
    },
    {
      title: 'Total Quotes',
      value: stats?.total_quotes || 0,
      change: `${stats?.pending_quotes || 0} pending`,
      icon: TrendingUp,
      color: 'blue',
      bgGradient: 'from-blue-500/10 to-blue-600/5',
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-dark-50 mb-2">Welcome Back!</h1>
        <p className="text-dark-300">Here's what's happening with your store today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.bgGradient} rounded-bl-full opacity-50`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 bg-${stat.color}-900/30 border border-${stat.color}-500/50 rounded-lg group-hover:border-${stat.color}-500 transition-colors`}>
                      <Icon className={`w-6 h-6 text-${stat.color}-500`} />
                    </div>
                    {loading && <div className="w-4 h-4 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />}
                  </div>
                  <p className="text-sm text-dark-300 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-dark-50 mb-2">{stat.value}</p>
                  <p className="text-xs text-dark-400">{stat.change}</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-xl font-bold text-dark-50 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.action}
                className={`
                  p-6 rounded-lg border-2 border-dashed border-dark-600
                  hover:border-${action.color}-500 hover:bg-${action.color}-900/10
                  transition-all duration-200 group
                  flex flex-col items-center gap-3
                `}
              >
                <Icon className="w-8 h-8 text-dark-300 group-hover:text-${action.color}-500 transition-colors" />
                <span className="font-medium text-dark-200 group-hover:text-dark-50 transition-colors">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-500" />
            Recent Quotes
          </h3>
          <div className="space-y-3">
            {stats?.recent_quotes?.length > 0 ? (
              stats.recent_quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors cursor-pointer"
                  onClick={() => onNavigate('quotes')}
                >
                  <div>
                    <p className="font-medium text-dark-50">Quote #{quote.quote_number}</p>
                    <p className="text-sm text-dark-300">{quote.company_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${quote.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : ''}
                      ${quote.status === 'approved' ? 'bg-green-900/30 text-green-500' : ''}
                      ${quote.status === 'draft' ? 'bg-dark-600 text-dark-300' : ''}
                    `}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-dark-400 text-center py-8">No recent quotes</p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => onNavigate('quotes')}
          >
            View All Quotes
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-500" />
            Recent Companies
          </h3>
          <div className="space-y-3">
            {stats?.recent_companies?.length > 0 ? (
              stats.recent_companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors cursor-pointer"
                  onClick={() => onNavigate('companies')}
                >
                  <div>
                    <p className="font-medium text-dark-50">{company.company_name}</p>
                    <p className="text-sm text-dark-300">{company.rep_email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${company.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : ''}
                      ${company.status === 'active' ? 'bg-green-900/30 text-green-500' : ''}
                      ${company.status === 'inactive' ? 'bg-dark-600 text-dark-300' : ''}
                    `}>
                      {company.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-dark-400 text-center py-8">No recent companies</p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => onNavigate('companies')}
          >
            View All Companies
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;
