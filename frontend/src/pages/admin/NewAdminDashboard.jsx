import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  Tags, 
  Users2, 
  Palette, 
  Droplet,
  Armchair,
  Layers,
  FileText,
  Wrench, 
  Building2, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  User,
  Upload,
  DollarSign,
  Mail
} from 'lucide-react';

// Import admin sections
import DashboardOverview from '../../components/admin/sections/DashboardOverview';
import ProductCatalog from '../../components/admin/sections/ProductCatalog';
import ProductEditor from '../../components/admin/sections/ProductEditor';
import CategoryManagement from '../../components/admin/sections/CategoryManagement';
import FamilyManagement from '../../components/admin/sections/FamilyManagement';
import ColorManagement from '../../components/admin/sections/ColorManagement';
import FinishManagement from '../../components/admin/sections/FinishManagement';
import UpholsteryManagement from '../../components/admin/sections/UpholsteryManagement';
import LaminateManagement from '../../components/admin/sections/LaminateManagement';
import CatalogManagement from '../../components/admin/sections/CatalogManagement';
import HardwareManagement from '../../components/admin/sections/HardwareManagement';
import CompanyManagement from '../../components/admin/sections/CompanyManagement';
import QuoteManagement from '../../components/admin/sections/QuoteManagement';
import LegalDocumentManagement from '../../components/admin/sections/LegalDocumentManagement';
import PricingTierManagement from '../../components/admin/sections/PricingTierManagement';
import SiteSettings from '../../components/admin/sections/SiteSettings';
import Analytics from '../../components/admin/sections/Analytics';
import VirtualCatalogUpload from '../../components/admin/sections/VirtualCatalogUpload';
import EditTmpProduct from '../../components/admin/sections/EditTmpProduct';
import EmailTemplateManagement from '../../components/admin/sections/EmailTemplateManagement';

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
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine active section from URL
  const getActiveSectionFromPath = () => {
    const path = location.pathname;
    if (path.includes('/admin/analytics')) return 'analytics';
    if (path.includes('/admin/catalog/virtual-upload/edit/')) return 'edit-tmp-product';
    if (path.includes('/admin/catalog/virtual-upload')) return 'virtual-catalog';
    if (path.includes('/admin/catalog')) return 'catalog';
    if (path.includes('/admin/categories')) return 'categories';
    if (path.includes('/admin/families')) return 'families';
    if (path.includes('/admin/colors')) return 'colors';
    if (path.includes('/admin/finishes')) return 'finishes';
    if (path.includes('/admin/upholstery')) return 'upholstery';
    if (path.includes('/admin/laminates')) return 'laminates';
    if (path.includes('/admin/resources/catalogs')) return 'catalogs';
    if (path.includes('/admin/hardware')) return 'hardware';
    if (path.includes('/admin/companies')) return 'companies';
    if (path.includes('/admin/quotes')) return 'quotes';
    if (path.includes('/admin/pricing-tiers')) return 'pricing-tiers';
    if (path.includes('/admin/legal-documents')) return 'legal-documents';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/emails')) return 'emails';
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState(getActiveSectionFromPath());

  // Sync active section with URL
  useEffect(() => {
    const path = location.pathname;
    let section = 'overview';
    if (path.includes('/admin/analytics')) section = 'analytics';
    else if (path.includes('/admin/catalog/virtual-upload/edit/')) section = 'edit-tmp-product';
    else if (path.includes('/admin/catalog/virtual-upload')) section = 'virtual-catalog';
    else if (path.includes('/admin/resources/catalogs')) section = 'catalogs';
    else if (path.includes('/admin/catalog')) section = 'catalog';
    else if (path.includes('/admin/categories')) section = 'categories';
    else if (path.includes('/admin/families')) section = 'families';
    else if (path.includes('/admin/colors')) section = 'colors';
    else if (path.includes('/admin/finishes')) section = 'finishes';
    else if (path.includes('/admin/upholstery')) section = 'upholstery';
    else if (path.includes('/admin/laminates')) section = 'laminates';
    else if (path.includes('/admin/hardware')) section = 'hardware';
    else if (path.includes('/admin/companies')) section = 'companies';
    else if (path.includes('/admin/quotes')) section = 'quotes';
    else if (path.includes('/admin/pricing-tiers')) section = 'pricing-tiers';
    else if (path.includes('/admin/legal-documents')) section = 'legal-documents';
    else if (path.includes('/admin/settings')) section = 'settings';
    else if (path.includes('/admin/emails')) section = 'emails';
    
    setActiveSection(section);
  }, [location.pathname]);

  // Check if user is admin
  const isAdmin = user?.type === 'admin' || 
                  user?.role === 'super_admin' || 
                  user?.role === 'admin' ||
                  user?.role === 'editor';

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Navigation sections with paths
  const navSections = [
    {
      id: 'main',
      title: 'Main',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
      ]
    },
    {
      id: 'products',
      title: 'Product Management',
      items: [
        { id: 'catalog', label: 'Product Catalog', icon: Package, path: '/admin/catalog' },
        { id: 'virtual-catalog', label: 'Virtual Catalog Upload', icon: Upload, path: '/admin/catalog/virtual-upload' },
        { id: 'categories', label: 'Categories', icon: Tags, path: '/admin/categories' },
        { id: 'families', label: 'Product Families', icon: Users2, path: '/admin/families' },
        { id: 'colors', label: 'Colors', icon: Droplet, path: '/admin/colors' },
        { id: 'finishes', label: 'Finishes', icon: Palette, path: '/admin/finishes' },
        { id: 'upholstery', label: 'Upholstery', icon: Armchair, path: '/admin/upholstery' },
        { id: 'laminates', label: 'Laminates', icon: Layers, path: '/admin/laminates' },
        { id: 'catalogs', label: 'Virtual Catalogs', icon: FileText, path: '/admin/resources/catalogs' },
        { id: 'hardware', label: 'Hardware', icon: Wrench, path: '/admin/hardware' },
      ]
    },
    {
      id: 'business',
      title: 'Business',
      items: [
        { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies' },
        { id: 'quotes', label: 'Quotes', icon: FileText, path: '/admin/quotes' },
        { id: 'pricing-tiers', label: 'Pricing Tiers', icon: DollarSign, path: '/admin/pricing-tiers' },
        { id: 'legal-documents', label: 'Legal Documents', icon: FileText, path: '/admin/legal-documents' },
      ]
    },
    {
      id: 'system',
      title: 'System',
      items: [
        { id: 'emails', label: 'Email Templates', icon: Mail, path: '/admin/emails' },
        { id: 'settings', label: 'Site Settings', icon: Settings, path: '/admin/settings' },
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
      case 'virtual-catalog':
        return <VirtualCatalogUpload />;
      case 'edit-tmp-product':
        return <EditTmpProduct />;
      case 'categories':
        return <CategoryManagement />;
      case 'families':
        return <FamilyManagement />;
      case 'colors':
        return <ColorManagement />;
      case 'finishes':
        return <FinishManagement />;
      case 'upholstery':
        return <UpholsteryManagement />;
      case 'laminates':
        return <LaminateManagement />;
      case 'catalogs':
        return <CatalogManagement />;
      case 'hardware':
        return <HardwareManagement />;
      case 'companies':
        return <CompanyManagement />;
      case 'quotes':
        return <QuoteManagement />;
      case 'pricing-tiers':
        return <PricingTierManagement />;
      case 'legal-documents':
        return <LegalDocumentManagement />;
      case 'settings':
        return <SiteSettings />;
      case 'emails':
        return <EmailTemplateManagement />;
      default:
        return <DashboardOverview onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-900">
      {/* Sidebar */}
      <div
        style={{ width: sidebarCollapsed ? 80 : 280 }}
        className="bg-dark-800 border-r border-dark-600 flex flex-col sticky top-0 h-screen transition-all duration-300"
      >
        {/* Logo / Header */}
        <div className="p-6 border-b border-dark-600">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="Eagle Chair" className="w-10 h-10" />
              <div>
                <h1 className="text-xl font-bold text-dark-50">Eagle Chair</h1>
                <p className="text-xs text-dark-300">Admin Panel</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <img src="/favicon.svg" alt="Eagle Chair" className="w-10 h-10" />
            </div>
          )}
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
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(item.path);
                        setSelectedProduct(null);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                        transition-all duration-200 group
                        ${activeSection === item.id && !selectedProduct
                          ? 'bg-primary-900 border border-primary-500 text-primary-400'
                          : 'text-dark-200 hover:bg-dark-700 hover:text-dark-50'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="font-medium text-sm">{item.label}</span>
                      )}
                    </button>
                  );
                })}
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
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-dark-800 border-b border-dark-600 px-8 py-4 sticky top-0 z-10">
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
                className="px-4 py-2 text-sm font-medium text-dark-200 hover:text-dark-50 border border-dark-600 rounded-lg hover:border-dark-500 transition-all flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Site
              </a>
              <div className="flex items-center gap-3 pl-4 border-l border-dark-600">
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-50">{user?.username || 'Admin'}</p>
                  <p className="text-xs text-dark-400">{user?.role || 'Administrator'}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-500 rounded-full flex items-center justify-center text-dark-900">
                  <User className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 bg-dark-900">
          <AnimatePresence mode="wait">
            <div
              key={selectedProduct ? 'editor' : activeSection}
            >
              {renderSection()}
            </div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default NewAdminDashboard;
