import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { EditModeProvider } from './contexts/EditModeContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import EditModeToggle from './components/admin/EditModeToggle';

// Pages
import HomePage from './pages/HomePage';
import ProductCatalogPage from './pages/ProductCatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import SearchPage from './pages/SearchPage';
import GalleryPage from './pages/GalleryPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FindARepPage from './pages/FindARepPage';
import CartPage from './pages/CartPage';
import QuoteRequestPage from './pages/QuoteRequestPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import GeneralInformationPage from './pages/GeneralInformationPage';
import DashboardPage from './pages/DashboardPage';
import NewAdminDashboard from './pages/admin/NewAdminDashboard';

// Resource Pages
import VirtualCatalogsPage from './pages/VirtualCatalogsPage';
import WoodFinishesPage from './pages/WoodFinishesPage';
import HardwarePage from './pages/HardwarePage';
import LaminatesPage from './pages/LaminatesPage';
import UpholsteryPage from './pages/UpholsteryPage';
import GuidesPage from './pages/GuidesPage';
import SeatBackTermsPage from './pages/SeatBackTermsPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AdminAuthProvider>
          <EditModeProvider>
            <ScrollToTop />
            <EditModeToggle />
            <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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

            {/* Protected User Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotes"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotes/:id"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
          </Routes>
          </EditModeProvider>
        </AdminAuthProvider>
      </Router>
    </QueryClientProvider>
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
