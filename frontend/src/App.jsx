import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { LazyMotion } from 'framer-motion';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import SEOHead from './components/SEOHead';
import { EditModeProvider } from './contexts/EditModeContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { useEditMode } from './contexts/useEditMode';
import { useAuthStore, startAuthInit } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { installAnalytics, trackPageView } from './utils/analytics';

// Animation features (domAnimation) load in a separate chunk; m.* components
// render their initial state until it arrives. The request starts as soon as
// this module runs (in parallel with the route chunk), not after first render.
const motionFeatures = import('./utils/motionFeatures').then((mod) => mod.default);
const loadMotionFeatures = () => motionFeatures;

// Admin-only chrome: loaded on demand so public visitors never download it
const AdminShell = lazy(() => import('./components/admin/AdminShell'));
const EditModeToggle = lazy(() => import('./components/admin/EditModeToggle'));

// Lazy load all pages for route-based code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const ProductCatalogPage = lazy(() => import('./pages/ProductCatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ProductFamilyDetailPage = lazy(() => import('./pages/ProductFamilyDetailPage'));
const RelatedProductsPage = lazy(() => import('./pages/RelatedProductsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const FindARepPage = lazy(() => import('./pages/FindARepPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const QuoteRequestPage = lazy(() => import('./pages/QuoteRequestPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const GeneralInformationPage = lazy(() => import('./pages/GeneralInformationPage'));
const NewAdminDashboard = lazy(() => import('./pages/admin/NewAdminDashboard'));
const AIChatPage = lazy(() => import('./pages/admin/AIChatPage'));
const AdminSecuritySetupPage = lazy(() => import('./pages/admin/AdminSecuritySetupPage'));

// Resource Pages
const VirtualCatalogsPage = lazy(() => import('./pages/VirtualCatalogsPage'));
const WoodFinishesPage = lazy(() => import('./pages/WoodFinishesPage'));
const HardwarePage = lazy(() => import('./pages/HardwarePage'));
const LaminatesPage = lazy(() => import('./pages/LaminatesPage'));
const UpholsteryPage = lazy(() => import('./pages/UpholsteryPage'));
const GuidesPage = lazy(() => import('./pages/GuidesPage'));
const SpecSheetsPage = lazy(() => import('./pages/SpecSheetsPage'));
const SeatBackTermsPage = lazy(() => import('./pages/SeatBackTermsPage'));
function ManifestInjector() {
  const location = useLocation();
  useEffect(() => {
    const isAdmin = location.pathname.startsWith('/admin');
    const manifestId = 'pwa-manifest';
    const href = isAdmin ? '/manifest-admin.json' : '/manifest.json';
    let link = document.getElementById(manifestId);
    if (link) {
      if (link.getAttribute('href') !== href) {
        link.setAttribute('href', href);
      }
    } else {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = href;
      link.id = manifestId;
      document.head.appendChild(link);
    }
  }, [location.pathname]);
  return null;
}

// Anonymous first-party analytics: a page view per route change plus
// site-wide download link tracking. Admin pages are skipped by the tracker.
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    installAnalytics();
  }, []);
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

// Only fetch the edit-mode toggle chunk once an admin session is detected
function AdminEditModeToggle() {
  const { isAdmin } = useEditMode();
  if (!isAdmin) return null;
  return (
    <Suspense fallback={null}>
      <EditModeToggle />
    </Suspense>
  );
}

// Restore/validate the session after mount, never before hydration: the
// server can't see localStorage, so the first client render must match the
// logged-out SSR markup. Rendered inside the route Suspense boundary.
function AuthInit() {
  useEffect(() => {
    startAuthInit();
  }, []);
  return null;
}

function CartSync() {
  const authIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authIsInitializing = useAuthStore((state) => state.isInitializing);
  const cartIsAuthenticated = useCartStore((state) => state.isAuthenticated);
  const switchToGuestMode = useCartStore((state) => state.switchToGuestMode);

  useEffect(() => {
    // Wait for the session check; auth starts logged-out until it finishes
    if (authIsInitializing) return;
    if (!authIsAuthenticated && cartIsAuthenticated) {
      switchToGuestMode();
    }
  }, [authIsAuthenticated, authIsInitializing, cartIsAuthenticated, switchToGuestMode]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <LazyMotion features={loadMotionFeatures} strict>
          <ManifestInjector />
          <AnalyticsTracker />
          <CartSync />
          <AdminAuthProvider>
            <EditModeProvider>
              <ToastProvider>
                <ScrollToTop />
                <AdminEditModeToggle />
                <Suspense fallback={null}>
                  {/* Inside the route boundary on purpose: its effect runs only
                      after the (lazy) page has hydrated, so the auth store
                      update can't interrupt hydration (React error #421). */}
                  <AuthInit />
                  <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin Routes - shared AIChatProvider for chat state persistence */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="setup-security" element={<AdminSecuritySetupPage />} />
            <Route path="dashboard" element={<NewAdminDashboard />} />
            <Route path="ai/:chatId?" element={<AIChatPage />} />
            <Route path="*" element={<NewAdminDashboard />} />
          </Route>

          {/* Routes with Layout */}
          <Route element={<Layout />}>
            {/* Home */}
            <Route path="/" element={<HomePage />} />

            {/* Legal & Information Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/general-information" element={<GeneralInformationPage />} />

            {/* Products - ORDER MATTERS! More specific routes first */}
            <Route path="/products" element={<ProductCatalogPage />} />
            <Route path="/products/category/:category" element={<ProductCatalogPage />} />
            <Route path="/products/category/:category/:subcategory" element={<ProductCatalogPage />} />
            
            {/* Product Families */}
            <Route path="/families/:familySlug" element={<ProductFamilyDetailPage />} />
            
            {/* Product detail with full category path */}
            <Route path="/products/:categorySlug/:subcategorySlug/:productSlug" element={<ProductDetailPage />} />
            <Route path="/products/:productId/related" element={<RelatedProductsPage />} />
            {/* Fallback for direct ID/slug access */}
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/search" element={<SearchPage />} />

          {/* Info Pages */}
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/find-a-rep" element={<FindARepPage />} />

          {/* Resource Pages */}
          <Route path="/virtual-catalogs" element={<VirtualCatalogsPage />} />
          <Route path="/resources/guides" element={<GuidesPage />} />
          <Route path="/resources/spec-sheets" element={<SpecSheetsPage />} />
          <Route path="/resources/finishes" element={<WoodFinishesPage />} />
          <Route path="/resources/woodfinishes" element={<Navigate to="/resources/finishes" replace />} />
          <Route path="/resources/hardware" element={<HardwarePage />} />
          <Route path="/resources/laminates" element={<LaminatesPage />} />
          <Route path="/resources/upholstery" element={<UpholsteryPage />} />
          <Route path="/resources/seat-back-terms" element={<SeatBackTermsPage />} />

          {/* Shopping & Quotes */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/quote-request" element={<QuoteRequestPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
                  </Routes>
                </Suspense>
              </ToastProvider>
            </EditModeProvider>
          </AdminAuthProvider>
      </LazyMotion>
      </ErrorBoundary>
  );
}

// 404 Not Found Component
const NotFound = () => (
  <div className="min-h-screen bg-dark-800 flex items-center justify-center">
    <SEOHead title="Page Not Found | Eagle Chair" description="The page you're looking for doesn't exist or has been moved." noindex />
    <div className="text-center px-4">
      <h1 className="text-6xl font-bold text-dark-300 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2 text-dark-50">Page Not Found</h2>
      <p className="text-dark-100 mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        href="/"
        className="inline-block px-6 py-3 bg-primary-500 text-dark-900 rounded-lg hover:bg-primary-600 transition-colors font-semibold"
      >
        Go Home
      </a>
    </div>
  </div>
);

export default App;
