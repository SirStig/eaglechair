import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// Import admin sections
import DashboardOverview from '../../components/admin/sections/DashboardOverview';
import ProductCatalog from '../../components/admin/sections/ProductCatalog';
import ProductEditor from '../../components/admin/sections/ProductEditor';
import CategoryManagement from '../../components/admin/sections/CategoryManagement';
import FamilyManagement from '../../components/admin/sections/FamilyManagement';
import FinishManagement from '../../components/admin/sections/FinishManagement';
import UpholsteryManagement from '../../components/admin/sections/UpholsteryManagement';
import CompanyManagement from '../../components/admin/sections/CompanyManagement';
import QuoteManagement from '../../components/admin/sections/QuoteManagement';
import SiteSettings from '../../components/admin/sections/SiteSettings';
import Analytics from '../../components/admin/sections/Analytics';

/**
 * Comprehensive Admin Dashboard
 * 
 * Full-width modern admin interface with:
 * - Left sidebar navigation
 * - Multiple management sections
 * - Smooth animations
 * - Responsive design
 */
const NewAdminDashboard = () => {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if user is admin
  const isAdmin = user?.type === 'admin' || 
                  user?.role === 'super_admin' || 
                  user?.role === 'admin' ||
                  user?.role === 'editor';

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Navigation sections
  const navSections = [
    {
      id: 'main',
      title: 'Main',
      items: [
        { id: 'overview', label: 'Dashboard', icon: '📊' },
        { id: 'analytics', label: 'Analytics', icon: '📈' },
      ]
    },
    {
      id: 'products',
      title: 'Product Management',
      items: [
        { id: 'catalog', label: 'Product Catalog', icon: '📦' },
        { id: 'categories', label: 'Categories', icon: '🏷️' },
        { id: 'families', label: 'Product Families', icon: '👨‍👩‍👧‍👦' },
        { id: 'finishes', label: 'Finishes', icon: '🎨' },
        { id: 'upholstery', label: 'Upholstery', icon: '🪑' },
      ]
    },
    {
      id: 'business',
      title: 'Business',
      items: [
        { id: 'companies', label: 'Companies', icon: '🏢' },
        { id: 'quotes', label: 'Quotes', icon: '📋' },
      ]
    },
    {
      id: 'system',
      title: 'System',
      items: [
        { id: 'settings', label: 'Site Settings', icon: '⚙️' },
      ]
    }
  ];

  const renderSection = () => {
    if (selectedProduct) {
      return (
        <ProductEditor 
          product={selectedProduct} 
          onBack={() => setSelectedProduct(null)}
        />
      );
    }

    switch (activeSection) {
      case 'overview':
        return <DashboardOverview onNavigate={setActiveSection} />;
      case 'analytics':
        return <Analytics />;
      case 'catalog':
        return <ProductCatalog onEdit={setSelectedProduct} />;
      case 'categories':
        return <CategoryManagement />;
      case 'families':
        return <FamilyManagement />;
      case 'finishes':
        return <FinishManagement />;
      case 'upholstery':
        return <UpholsteryManagement />;
      case 'companies':
        return <CompanyManagement />;
      case 'quotes':
        return <QuoteManagement />;
      case 'settings':
        return <SiteSettings />;
      default:
        return <DashboardOverview onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 280 }}
        transition={{ duration: 0.3 }}
        className="bg-dark-800 border-r border-dark-600 flex flex-col overflow-hidden"
      >
        {/* Logo / Header */}
        <div className="p-6 border-b border-dark-600">
          <motion.div
            initial={false}
            animate={{ opacity: sidebarCollapsed ? 0 : 1 }}
            className="flex items-center gap-3"
          >
            {!sidebarCollapsed && (
              <>
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🦅</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-dark-50">Eagle Chair</h1>
                  <p className="text-xs text-dark-300">Admin Panel</p>
                </div>
              </>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">🦅</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navSections.map((section) => (
            <div key={section.id} className="mb-6">
              {!sidebarCollapsed && (
                <h3 className="px-4 mb-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setSelectedProduct(null);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                      transition-all duration-200 group
                      ${activeSection === item.id && !selectedProduct
                        ? 'bg-primary-900 border border-primary-500 text-primary-500'
                        : 'text-dark-200 hover:bg-dark-700 hover:text-dark-50'
                      }
                    `}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Toggle Sidebar Button */}
        <div className="p-4 border-t border-dark-600">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-dark-300 hover:bg-dark-700 hover:text-dark-50 transition-colors"
          >
            <span>{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <header className="bg-dark-800 border-b border-dark-600 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-dark-50">
                {selectedProduct ? 'Product Editor' : navSections
                  .flatMap(s => s.items)
                  .find(i => i.id === activeSection)?.label || 'Dashboard'}
              </h2>
              <p className="text-sm text-dark-300 mt-1">
                {selectedProduct 
                  ? `Editing: ${selectedProduct.name}`
                  : 'Manage your store content and settings'
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium text-dark-200 hover:text-dark-50 border border-dark-600 rounded-lg hover:border-dark-500 transition-all"
              >
                View Site
              </a>
              <div className="flex items-center gap-3 pl-4 border-l border-dark-600">
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-50">{user?.username || 'Admin'}</p>
                  <p className="text-xs text-dark-400">{user?.role || 'Administrator'}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-500 rounded-full flex items-center justify-center text-dark-900 font-bold">
                  {(user?.username || 'A')[0].toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-dark-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedProduct ? 'editor' : activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default NewAdminDashboard;
