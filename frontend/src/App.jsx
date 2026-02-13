import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { EditModeProvider } from './contexts/EditModeContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import EditModeToggle from './components/admin/EditModeToggle';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy load all pages for route-based code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const ProductCatalogPage = lazy(() => import('./pages/ProductCatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ProductFamilyDetailPage = lazy(() => import('./pages/ProductFamilyDetailPage'));
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

// Resource Pages
const VirtualCatalogsPage = lazy(() => import('./pages/VirtualCatalogsPage'));
const WoodFinishesPage = lazy(() => import('./pages/WoodFinishesPage'));
const HardwarePage = lazy(() => import('./pages/HardwarePage'));
const LaminatesPage = lazy(() => import('./pages/LaminatesPage'));
const UpholsteryPage = lazy(() => import('./pages/UpholsteryPage'));
const GuidesPage = lazy(() => import('./pages/GuidesPage'));
const SeatBackTermsPage = lazy(() => import('./pages/SeatBackTermsPage'));

// Create a client with industry-standard retry configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3, // Industry standard: 3 retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s (max 30s)
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
    },
  },
});

function CartSync() {
  const authIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const cartIsAuthenticated = useCartStore((state) => state.isAuthenticated);
  const switchToGuestMode = useCartStore((state) => state.switchToGuestMode);

  useEffect(() => {
    if (!authIsAuthenticated && cartIsAuthenticated) {
      switchToGuestMode();
    }
  }, [authIsAuthenticated, cartIsAuthenticated, switchToGuestMode]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
          <Router>
            <CartSync />
            <AdminAuthProvider>
            <EditModeProvider>
              <ToastProvider>
                <ScrollToTop />
                <EditModeToggle />
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin Routes (No Layout - Full Screen) */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requireAdmin={true}>
                <NewAdminDashboard />
              </ProtectedRoute>
            }
          />

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
          <Route path="/resources/woodfinishes" element={<WoodFinishesPage />} />
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
          </Router>
        </QueryClientProvider>
      </ErrorBoundary>
  );
}

// 404 Not Found Component
const NotFound = () => (
  <div className="min-h-screen bg-dark-800 flex items-center justify-center">
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
