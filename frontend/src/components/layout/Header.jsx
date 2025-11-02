import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Badge from '../ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import ProductsDropdown from './ProductsDropdown';
import MobileProductsMenu from './MobileProductsMenu';
import ResourcesDropdown from './ResourcesDropdown';
import { useSiteSettings } from '../../hooks/useContent';
import productService from '../../services/productService';
import logger from '../../utils/logger';

const CONTEXT = 'Header';

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // Subscribe to cart state properly - this will trigger re-renders on cart changes
  const cartItemCount = useCartStore((state) => {
    const items = state.isAuthenticated && state.backendCart 
      ? (state.backendCart.items || [])
      : state.guestItems;
    return items.reduce((sum, item) => sum + item.quantity, 0);
  });
  
  const { data: siteSettings } = useSiteSettings();

  // Search products as user types using fuzzy search
  useEffect(() => {
    const searchProductsAsync = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const results = await productService.searchProducts(searchQuery.trim(), {
            limit: 5,
            threshold: 60
          });
          
          setSearchResults(results || []);
          setShowSearchResults(true);
          logger.debug(CONTEXT, `Search for "${searchQuery}" found ${results?.length || 0} results`);
        } catch (error) {
          logger.error(CONTEXT, 'Error searching products', error);
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    };

    const timeoutId = setTimeout(searchProductsAsync, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e, options = {}) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchResults(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      logger.info(CONTEXT, `Navigating to search page with query: ${searchQuery}`);
      if (options.closeMenu) {
        setIsMobileMenuOpen(false);
      }
    }
  };

  const handleResultClick = (productSlug) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(`/products/${productSlug}`);
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-dark-800/95 backdrop-blur-md shadow-lg border-b border-dark-500 z-50" style={{ '--header-height': '72px' }}>
      <style>{`
        @media (min-width: 640px) {
          header { --header-height: 88px; }
        }
        @media (min-width: 768px) {
          header { --header-height: 80px; }
        }
      `}</style>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Navigation */}
        <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <Motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              {/* Eagle Chair Logo Image */}
              {siteSettings?.logoUrl ? (
                <img 
                  src={siteSettings.logoUrl} 
                  alt={siteSettings.companyName || 'Eagle Chair'}
                  className="h-12 sm:h-14 md:h-16 lg:h-16 w-auto object-contain"
                />
              ) : (
                <img 
                  src="/assets/eagle-chair-logo.png" 
                  alt="Eagle Chair" 
                  className="h-12 sm:h-14 md:h-16 lg:h-16 w-auto object-contain"
                />
              )}
            </Motion.div>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Products Dropdown */}
            <Dropdown
              trigger={(isOpen) => (
                <Button variant="transparent" className="font-medium hover-lift">
                  Products
                  <Motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </Motion.svg>
                </Button>
              )}
              contentClassName="w-screen max-w-none !rounded-none shadow-2xl !border-t-0 !border-l-0 !border-r-0"
              align="left"
            >
              <ProductsDropdown />
            </Dropdown>

            {/* Gallery */}
            <Link to="/gallery">
              <Button variant="transparent" className="font-medium hover-lift">
                Gallery
              </Button>
            </Link>

            {/* Resources Dropdown */}
            <Dropdown
              trigger={(isOpen) => (
                <Button variant="transparent" className="font-medium hover-lift">
                  Resources
                  <Motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </Motion.svg>
                </Button>
              )}
              contentClassName="w-64"
            >
              <ResourcesDropdown />
            </Dropdown>

            {/* About Us */}
            <Link to="/about">
              <Button variant="transparent" className="font-medium hover-lift">
                About Us
              </Button>
            </Link>

            {/* Connect Dropdown */}
            <Dropdown
              trigger={(isOpen) => (
                <Button variant="transparent" className="font-medium hover-lift">
                  Connect
                  <Motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </Motion.svg>
                </Button>
              )}
              align="right"
              contentClassName="w-48"
            >
              <div className="py-2">
                <Link
                  to="/find-a-rep"
                  className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                >
                  Find a Rep
                </Link>
                <Link
                  to="/contact"
                  className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                >
                  Contact Us
                </Link>
              </div>
            </Dropdown>
          </nav>

          {/* Right Side: Search, Account, Cart */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Search with Results Dropdown - Hidden on mobile */}
            <form onSubmit={handleSearch} className="hidden lg:block relative flex-shrink-0" ref={searchRef}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Delay to allow clicking on results
                    setTimeout(() => setIsSearchFocused(false), 200);
                  }}
                  className={`
                    h-10 pl-10 pr-4 border rounded-lg 
                    bg-dark-700 text-dark-50 placeholder-dark-200
                    transition-all duration-300 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                    ${isSearchFocused ? 'w-64 xl:w-72' : 'w-40 xl:w-48'}
                  `}
                  style={{
                    WebkitTransition: 'width 0.3s ease-in-out',
                    MozTransition: 'width 0.3s ease-in-out',
                    msTransition: 'width 0.3s ease-in-out'
                  }}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-dark-300 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchResults && searchResults.length > 0 && (
                  <Motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full mt-2 w-full bg-dark-600 border border-dark-500 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
                  >
                    <div className="py-2">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleResultClick(product.slug)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-700 transition-colors text-left"
                        >
                          <img
                            src={product.image || '/placeholder-product.png'}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e) => {
                              e.target.onerror = null; // Prevent infinite loop
                              e.target.src = '/placeholder-product.png';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-50 truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-dark-200">
                              {product.category || 'Product'}
                            </p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={(event) => handleSearch(event)}
                        className="w-full px-4 py-2 text-sm text-primary-500 hover:bg-dark-700 transition-colors text-center border-t border-dark-500"
                      >
                        View all results →
                      </button>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Account */}
            <div className="hidden lg:block flex-shrink-0">
              {user ? (
                <Dropdown
                  trigger={(isOpen) => (
                    <Button variant="transparent" size="sm" className="hover-lift">
                      <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {user.companyName || user.username || 'User'}
                      <Motion.svg 
                        className="ml-1 h-4 w-4 inline-block" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </Motion.svg>
                    </Button>
                  )}
                  align="right"
                  contentClassName="w-48"
                >
                  <div className="py-2">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/dashboard/quotes"
                      className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                    >
                      My Quotes
                    </Link>
                    {(user.role === 'super_admin' || user.role === 'admin' || user.type === 'admin') && (
                      <Link
                        to="/admin/dashboard"
                        className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                    >
                      Logout
                    </button>
                  </div>
                </Dropdown>
              ) : (
                <Link to="/login" className="block">
                  <Button variant="outline" size="sm" className="hover-lift">
                    Login / Register
                  </Button>
                </Link>
              )}
            </div>

            {/* Cart */}
            <Link to="/cart" className="relative hidden lg:block flex-shrink-0">
              <Motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button variant="transparent" size="sm">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0z" />
                  </svg>
                  {cartItemCount > 0 && (
                    <Badge variant="danger" size="sm" className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 flex items-center justify-center">
                      {cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Motion.div>
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden text-dark-50 hover:text-primary-500 transition-colors flex-shrink-0 p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <Motion.svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                animate={{ 
                  rotate: isMobileMenuOpen ? 90 : 0,
                  scale: isMobileMenuOpen ? 0.9 : 1
                }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 18h16" />
                  </>
                )}
              </Motion.svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

export const MobileMenu = ({ isMobileMenuOpen, setIsMobileMenuOpen, searchQuery, setSearchQuery, handleSearch, user, logout, cartItemCount }) => {
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  
  const handleMobileLinkClick = (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-40 w-[85vw] max-w-sm bg-dark-900 border-l border-dark-600 shadow-2xl overflow-y-auto"
            style={{ top: 'var(--header-height, 80px)' }}
          >
            <div className="flex flex-col h-full">
              <div className="px-4 py-4 space-y-6 flex-grow overflow-y-auto">
                <form onSubmit={(event) => handleSearch(event, { closeMenu: true })}>
                  <label htmlFor="mobile-search" className="sr-only">
                    Search products
                  </label>
                  <div className="relative">
                    <input
                      id="mobile-search"
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-lg border border-dark-600 bg-dark-800 text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-300 pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </form>

                <nav className="flex flex-col gap-3 text-base text-dark-50">
                  {/* Products Dropdown */}
                  <div>
                    <button 
                      onClick={() => setIsProductsOpen(!isProductsOpen)}
                      className="flex items-center justify-between w-full py-2 hover:text-primary-400 transition-colors"
                    >
                      <span>Products</span>
                      <Motion.svg 
                        className="h-4 w-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        animate={{ rotate: isProductsOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </Motion.svg>
                    </button>
                    
                    <MobileProductsMenu 
                      isOpen={isProductsOpen} 
                      onNavigate={() => setIsMobileMenuOpen(false)} 
                    />
                  </div>
                  
                  <Link to="/gallery" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-primary-400 transition-colors">
                    Gallery
                  </Link>
                  <Link to="/about" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-primary-400 transition-colors">
                    About Us
                  </Link>
                  <Link to="/virtual-catalogs" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-primary-400 transition-colors">
                    Resources
                  </Link>
                  
                  {/* Connect Dropdown */}
                  <div>
                    <button 
                      onClick={() => setIsConnectOpen(!isConnectOpen)}
                      className="flex items-center justify-between w-full py-2 hover:text-primary-400 transition-colors"
                    >
                      <span>Connect</span>
                      <Motion.svg 
                        className="h-4 w-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        animate={{ rotate: isConnectOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </Motion.svg>
                    </button>
                    
                    <AnimatePresence>
                      {isConnectOpen && (
                        <Motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden ml-4 mt-2 space-y-2"
                        >
                          <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm hover:text-primary-400 transition-colors">
                            Contact Us
                          </Link>
                          <Link to="/find-a-rep" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm hover:text-primary-400 transition-colors">
                            Find a Rep
                          </Link>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <Link to="/quote-request" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-primary-400 transition-colors">
                    Request a Quote
                  </Link>
                </nav>

                <div className="border-t border-dark-700 pt-4 space-y-3">
                  {user ? (
                    <div className="space-y-2">
                      <p className="text-xs text-dark-300 uppercase tracking-wide">Account</p>
                      <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-dark-50 hover:text-primary-400 transition-colors">
                        Dashboard
                      </Link>
                      <Link to="/dashboard/quotes" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-dark-50 hover:text-primary-400 transition-colors">
                        My Quotes
                      </Link>
                      {(user.role === 'super_admin' || user.role === 'admin' || user.type === 'admin') && (
                        <Link to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-dark-50 hover:text-primary-400 transition-colors">
                          Admin Panel
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMobileLinkClick(logout)}
                        className="block text-left py-2 text-dark-50 hover:text-primary-400 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg border border-primary-500 text-primary-500 font-semibold hover:bg-primary-500/10 transition-colors text-sm">
                      Login / Register
                    </Link>
                  )}

                  <Link
                    to="/cart"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-dark-700 text-dark-50 hover:border-primary-500 hover:text-primary-400 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0z" />
                      </svg>
                      <span>Cart</span>
                    </span>
                    {cartItemCount > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white w-5 h-5">
                        {cartItemCount}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            </div>
          </Motion.aside>

          <Motion.button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-[39] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        </>
      )}
    </AnimatePresence>
  );
};
