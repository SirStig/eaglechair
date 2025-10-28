import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import axios from 'axios';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  FileText, 
  Building2,
  Calendar
} from 'lucide-react';

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [categoryStats, setCategoryStats] = useState([]);
  const [conversionRates, setConversionRates] = useState(null);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, 1y

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDaysFromRange = (range) => {
    const daysMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    return daysMap[range] || 30;
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const days = getDaysFromRange(timeRange);

      // Fetch all analytics data in parallel
      const [
        statsRes,
        categoryRes,
        conversionRes,
        productsRes
      ] = await Promise.all([
        axios.get('/api/v1/admin/dashboard/stats'),
        axios.get('/api/v1/admin/dashboard/analytics/category-stats'),
        axios.get('/api/v1/admin/dashboard/analytics/conversion-rates'),
        axios.get(`/api/v1/admin/dashboard/analytics/popular-products?limit=5&days=${days}`)
      ]);

      setStats(statsRes.data);
      setCategoryStats(categoryRes.data.items || []);
      setConversionRates(conversionRes.data);
      setPopularProducts(productsRes.data.items || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const productCategoryData = categoryStats.map(item => ({
    name: item.category?.name || 'Unknown',
    value: item.product_count || 0
  }));

  const companyStatusData = [
    { name: 'Active', value: stats?.active_companies || 0 },
    { name: 'Pending', value: stats?.pending_companies || 0 },
    { name: 'Inactive', value: (stats?.total_companies || 0) - (stats?.active_companies || 0) - (stats?.pending_companies || 0) },
  ];

  const COLORS = {
    primary: '#D4A574',
    accent: '#8B7355',
    green: '#10b981',
    blue: '#3b82f6',
    red: '#ef4444',
    yellow: '#f59e0b',
  };

  const PIE_COLORS = [COLORS.primary, COLORS.accent, COLORS.green, COLORS.blue];

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Analytics Dashboard</h2>
          <p className="text-dark-300 mt-1">Track your business performance and trends</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-dark-700 p-1 rounded-lg">
          {[
            { label: '7D', value: '7d' },
            { label: '30D', value: '30d' },
            { label: '90D', value: '90d' },
            { label: '1Y', value: '1y' },
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`
                px-4 py-2 rounded-md font-medium transition-all
                ${timeRange === range.value
                  ? 'bg-primary-500 text-dark-900'
                  : 'text-dark-300 hover:text-dark-50'
                }
              `}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-5 h-5 text-primary-500" />
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm text-dark-300 mb-1">Total Products</p>
            <p className="text-2xl font-bold text-dark-50">{stats?.total_products || 0}</p>
            <p className="text-xs text-dark-400 mt-1">{stats?.active_products || 0} active</p>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-accent-500" />
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm text-dark-300 mb-1">Total Quotes</p>
            <p className="text-2xl font-bold text-dark-50">{stats?.total_quotes || 0}</p>
            <p className="text-xs text-dark-400 mt-1">{stats?.pending_quotes || 0} pending</p>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="w-5 h-5 text-green-500" />
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm text-dark-300 mb-1">Active Companies</p>
            <p className="text-2xl font-bold text-dark-50">{stats?.active_companies || 0}</p>
            <p className="text-xs text-dark-400 mt-1">{stats?.total_companies || 0} total</p>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              {conversionRates?.quote_to_accepted >= 50 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-yellow-500" />
              )}
            </div>
            <p className="text-sm text-dark-300 mb-1">Approval Rate</p>
            <p className="text-2xl font-bold text-dark-50">
              {conversionRates?.quote_to_accepted?.toFixed(0) || 0}%
            </p>
            <p className="text-xs text-dark-400 mt-1">{stats?.accepted_quotes || 0} accepted</p>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-500" />
            Recent Activity (Last 30 Days)
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-500/20 rounded-lg">
                  <FileText className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <p className="text-dark-50 font-medium">Quote Requests</p>
                  <p className="text-xs text-dark-400">New quote submissions</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-dark-50">{stats?.recent_quotes_30d || 0}</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Building2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-dark-50 font-medium">New Companies</p>
                  <p className="text-xs text-dark-400">Company registrations</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-dark-50">{stats?.recent_companies_30d || 0}</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-dark-50 font-medium">Pending Reviews</p>
                  <p className="text-xs text-dark-400">Awaiting response</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-dark-50">{stats?.pending_quotes || 0}</p>
            </div>
          </div>
        </Card>

        {/* Product Categories */}
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            Products by Category
          </h3>
          {productCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={productCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {productCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-dark-400">
              No category data available
            </div>
          )}
        </Card>

        {/* Company Status */}
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-500" />
            Company Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companyStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
              <Bar dataKey="value" fill={COLORS.green} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue Stats */}
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Revenue Overview
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-dark-700 rounded-lg">
              <p className="text-sm text-dark-400 mb-1">Total Revenue (Accepted Quotes)</p>
              <p className="text-3xl font-bold text-green-500">
                ${((stats?.total_revenue || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-4 bg-dark-700 rounded-lg">
              <p className="text-sm text-dark-400 mb-1">Potential Revenue (Quoted)</p>
              <p className="text-3xl font-bold text-primary-500">
                ${((stats?.potential_revenue || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-dark-700 rounded-lg">
                <p className="text-xs text-dark-400 mb-1">Accepted Quotes</p>
                <p className="text-xl font-bold text-dark-50">{stats?.accepted_quotes || 0}</p>
              </div>
              <div className="p-3 bg-dark-700 rounded-lg">
                <p className="text-xs text-dark-400 mb-1">Conversion Rate</p>
                <p className="text-xl font-bold text-dark-50">
                  {conversionRates?.quote_to_accepted?.toFixed(1) || 0}%
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Popular Products */}
      {popularProducts.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            Most Requested Products ({timeRange.toUpperCase()})
          </h3>
          <div className="space-y-3">
            {popularProducts.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/20 text-primary-500 font-bold text-sm">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-dark-50 font-medium">
                      {item.product?.name || 'Unknown Product'}
                    </p>
                    <p className="text-xs text-dark-400">
                      Model: {item.product?.model_number || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-dark-50 font-semibold">{item.quote_count} quotes</p>
                  <p className="text-xs text-dark-400">{item.total_quantity} units total</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Analytics;
