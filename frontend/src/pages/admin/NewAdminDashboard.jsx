import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useStandalone } from '../../hooks/useStandalone';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import FloatingAIButton from '../../components/admin/ai/FloatingAIButton';
import AIChatWidget from '../../components/admin/ai/AIChatWidget';
import { useAuthStore } from '../../store/authStore';
import { AdminRefreshProvider, useAdminRefresh } from '../../contexts/AdminRefreshContext';
import AdminSidebar from '../../components/admin/layout/AdminSidebar';
import AdminTopbar from '../../components/admin/layout/AdminTopbar';
import AdminCommandPalette from '../../components/admin/layout/AdminCommandPalette';
import { getAdminNavItem, sectionFromPath } from '../../components/admin/adminNav';
import { useStackedTables } from '../../components/admin/useStackedTables';

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
import EmailTemplateManagement from '../../components/admin/sections/EmailTemplateManagement';
import InquiryManagement from '../../components/admin/sections/InquiryManagement';
import AdminDownloads from '../../components/admin/sections/AdminDownloads';
import ProductRegister from '../../components/admin/sections/ProductRegister';
import CatalogBuilder from '../../components/admin/sections/CatalogBuilder';
import apiClient from '../../config/apiClient';

const SIDEBAR_COLLAPSED_KEY = 'ec-admin-sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Admin console shell: sidebar navigation, top bar (breadcrumb, ⌘K jump,
 * account menu) and the active management section. The URL is the source of
 * truth for which section is shown.
 */
const NewAdminDashboardInner = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { invalidate } = useAdminRefresh();
  const isStandalone = useStandalone();
  const isTabletOrSmaller = useMediaQuery('(max-width: 767px)');
  const showBottomNav = isStandalone && isTabletOrSmaller;
  // Tablets (md) always get the icon rail; desktop (lg+) honours the collapse toggle
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsed);
  const railCollapsed = !isDesktop || sidebarCollapsed;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inquiryUnread, setInquiryUnread] = useState(0);
  const contentRef = useRef(null);
  useStackedTables(contentRef);

  const activeSection = useMemo(() => {
    // Deep links like /admin/dashboard?edit=12 open the product editor
    if (new URLSearchParams(location.search).get('edit')) return 'catalog';
    return sectionFromPath(location.pathname);
  }, [location.pathname, location.search]);
  const activeItem = getAdminNavItem(activeSection);

  // Unread contact-form inquiries for the nav badge
  useEffect(() => {
    apiClient.get('/api/v1/admin/inquiries', { params: { page_size: 1 } })
      .then((res) => setInquiryUnread(res?.unread || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const editId = new URLSearchParams(location.search).get('edit');
    if (!editId) return;
    const pid = parseInt(editId, 10);
    if (isNaN(pid)) return;
    apiClient.get(`/api/v1/admin/products/${pid}`)
      .then((product) => setSelectedProduct(product))
      .catch(() => {});
  }, [location.pathname, location.search]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeSection, selectedProduct]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // Storage unavailable (private mode) — the preference just won't persist
    }
  }, [sidebarCollapsed]);

  // ⌘K / Ctrl+K opens the quick switcher; Esc closes the mobile drawer
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNavigate = useCallback((path, sectionId) => {
    invalidate(sectionId);
    navigate(path);
    setSelectedProduct(null);
    setIsMobileMenuOpen(false);
  }, [invalidate, navigate]);

  const navigateToSection = useCallback((sectionId) => {
    handleNavigate(getAdminNavItem(sectionId).path, sectionId);
  }, [handleNavigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Check if user is admin
  const isAdmin = user?.type === 'admin' ||
                  user?.role === 'super_admin' ||
                  user?.role === 'admin' ||
                  user?.role === 'editor';

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleBackFromEditor = () => {
    invalidate('catalog');
    setSelectedProduct(null);
    if (location.search.includes('edit=')) navigate(activeItem.path, { replace: true });
  };

  const crumbs = [
    { label: activeItem.group },
    { label: activeItem.label, onClick: selectedProduct ? handleBackFromEditor : undefined },
    ...(selectedProduct ? [{ label: selectedProduct.name || 'Edit product' }] : []),
  ];

  const renderSection = () => {
    if (selectedProduct) {
      return (
        <ProductEditor
          product={selectedProduct}
          onBack={handleBackFromEditor}
        />
      );
    }

    switch (activeSection) {
      case 'overview':
        return <DashboardOverview onNavigate={navigateToSection} inquiryUnread={inquiryUnread} />;
      case 'analytics':
        return <Analytics />;
      case 'catalog':
        return <ProductCatalog onEdit={setSelectedProduct} />;
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
      case 'register':
        return <ProductRegister />;
      case 'catalog-builder':
        return <CatalogBuilder />;
      case 'hardware':
        return <HardwareManagement />;
      case 'companies':
        return <CompanyManagement />;
      case 'quotes':
        return <QuoteManagement />;
      case 'inquiries':
        return <InquiryManagement onUnreadChange={setInquiryUnread} />;
      case 'pricing-tiers':
        return <PricingTierManagement />;
      case 'legal-documents':
        return <LegalDocumentManagement />;
      case 'settings':
        return <SiteSettings />;
      case 'emails':
        return <EmailTemplateManagement />;
      case 'downloads':
        return <AdminDownloads />;
      default:
        return <DashboardOverview onNavigate={navigateToSection} inquiryUnread={inquiryUnread} />;
    }
  };

  return (
    // overflow-x-clip, not hidden: hidden makes this a scroll container and
    // breaks the sticky top bar
    <div className="admin-theme relative min-h-[100dvh] bg-dark-900 overflow-x-clip">
      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <AdminSidebar
        activeSection={activeSection}
        badges={{ inquiries: inquiryUnread }}
        collapsed={railCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={isMobileMenuOpen}
        onNavigate={handleNavigate}
        bottomPadding={showBottomNav}
      />

      {!showBottomNav && <FloatingAIButton />}
      <AIChatWidget />
      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => handleNavigate(item.path, item.id)}
      />

      <main
        className={`flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip transition-[padding] duration-300 ease-out ${
          railCollapsed ? 'md:pl-[4.5rem]' : 'md:pl-[17rem]'
        }`}
      >
        {/* Safe-area top spacer — env() is 0px in browser, non-zero on notched standalone */}
        <div className="pt-safe flex-shrink-0 bg-dark-900" />
        <AdminTopbar
          crumbs={crumbs}
          mobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenAI={showBottomNav ? () => navigate('/admin/ai') : undefined}
          user={user}
          onLogout={handleLogout}
        />

        <div ref={contentRef} className="flex-1 overflow-x-hidden">
          <div key={selectedProduct ? 'editor' : activeSection} className="animate-admin-in">
            {renderSection()}
          </div>
          {showBottomNav && <div className="h-nav-spacer flex-shrink-0" />}
        </div>
      </main>
    </div>
  );
};

const NewAdminDashboard = () => (
  <AdminRefreshProvider>
    <NewAdminDashboardInner />
  </AdminRefreshProvider>
);

export default NewAdminDashboard;
