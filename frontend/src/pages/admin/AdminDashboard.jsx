import { useState } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import CategoriesManager from '../../components/admin/CategoriesManager';
import SiteSettingsManager from '../../components/admin/SiteSettingsManager';

/**
 * AdminDashboard Component
 * 
 * Main admin dashboard for managing all content
 * Includes:
 * - Site settings management
 * - Categories management
 * - Quick stats
 * - Navigation to edit pages
 */
const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Check if user is admin
  const isAdmin = user?.type === 'admin' || 
                  user?.role === 'super_admin' || 
                  user?.role === 'admin' ||
                  user?.role === 'editor';

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'settings', label: 'Site Settings', icon: '⚙️' },
    { id: 'categories', label: 'Categories', icon: '🏷️' },
  ];

  const quickLinks = [
    { name: 'Home Page', path: '/', description: 'Edit hero slides, features, and CTAs' },
    { name: 'About Page', path: '/about', description: 'Manage team, values, and milestones' },
    { name: 'Gallery', path: '/gallery', description: 'Add or edit installation photos' },
    { name: 'Products', path: '/products', description: 'Manage product catalog' },
    { name: 'Sales Reps', path: '/find-a-rep', description: 'Update sales representative info' },
    { name: 'Contact Page', path: '/contact', description: 'Edit contact information' },
  ];

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-dark-50 mb-2">Admin Dashboard</h1>
          <p className="text-lg text-dark-100">
            Manage your site content, settings, and more
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex gap-2 border-b border-dark-600">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-primary-500'
                    : 'text-dark-200 hover:text-dark-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-900 border border-primary-500 rounded-lg">
                      <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-dark-200">Edit Mode</p>
                      <p className="text-2xl font-bold text-dark-50">Active</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent-900 border border-accent-500 rounded-lg">
                      <svg className="w-8 h-8 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-dark-200">Pages</p>
                      <p className="text-2xl font-bold text-dark-50">{quickLinks.length}</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-900 border border-green-500 rounded-lg">
                      <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-dark-200">Status</p>
                      <p className="text-2xl font-bold text-dark-50">Live</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Quick Edit Links */}
              <Card>
                <h2 className="text-2xl font-bold text-dark-50 mb-4">Quick Edit Links</h2>
                <p className="text-dark-100 mb-6">
                  Navigate to any page to start editing. Edit mode is automatically enabled for admins.
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quickLinks.map((link) => (
                    <a
                      key={link.path}
                      href={link.path}
                      className="block p-4 bg-dark-700 border border-dark-500 rounded-lg hover:border-primary-500 hover:bg-dark-600 transition-all group"
                    >
                      <h3 className="font-semibold text-dark-50 group-hover:text-primary-500 transition-colors mb-1">
                        {link.name}
                      </h3>
                      <p className="text-sm text-dark-200">{link.description}</p>
                    </a>
                  ))}
                </div>
              </Card>

              {/* Help Section */}
              <Card className="bg-gradient-to-br from-primary-900/20 to-accent-900/20 border-primary-500">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-900 border border-primary-500 rounded-lg">
                    <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-dark-50 mb-2">How to Edit Content</h3>
                    <ul className="space-y-2 text-dark-100">
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500">•</span>
                        <span>Click on any highlighted element on any page to edit it directly</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500">•</span>
                        <span>Use the "Add" buttons to create new content items</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500">•</span>
                        <span>Hover over items to see edit and delete options</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500">•</span>
                        <span>Changes are saved immediately to the database</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && <SiteSettingsManager />}
          {activeTab === 'categories' && <CategoriesManager />}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;

