import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Badge from '../ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import ProductsDropdown from './ProductsDropdown';
import ResourcesDropdown from './ResourcesDropdown';
import { demoProducts } from '../../data/demoData';
import logger from '../../utils/logger';

const CONTEXT = 'Header';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();

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

  // Search products as user types
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = demoProducts.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);
      
      setSearchResults(results);
      setShowSearchResults(true);
      logger.debug(CONTEXT, `Search for "${searchQuery}" found ${results.length} results`);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchResults(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      logger.info(CONTEXT, `Navigating to search page with query: ${searchQuery}`);
    }
  };

  const handleResultClick = (productSlug) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(`/products/${productSlug}`);
  };

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="fixed top-0 left-0 w-full bg-dark-800/95 backdrop-blur-md shadow-lg border-b border-dark-500 z-50">
      <div className="container mx-auto">
        {/* Main Navigation */}
        <div className="flex items-center justify-between py-4 gap-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              className="flex items-center gap-2"
            >
              <img 
                src="/assets/eagle-chair-logo.png" 
                alt="Eagle Chair" 
                className="h-12 w-auto object-contain"
              />
            </motion.div>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Products Dropdown */}
            <Dropdown
              trigger={(isOpen) => (
                <Button variant="transparent" className="font-medium hover-lift">
                  Products
                  <motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </Button>
              )}
              contentClassName="w-screen max-w-4xl"
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
                  <motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
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
                  <motion.svg 
                    className="ml-1 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
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
          <div className="flex items-center gap-4">
            {/* Search with Results Dropdown */}
            <form onSubmit={handleSearch} className="hidden md:block relative" ref={searchRef}>
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
                    ${isSearchFocused ? 'w-72' : 'w-48'}
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
                  <motion.div
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
                            src={product.image}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-50 truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-dark-200">
                              {product.category}
                            </p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={handleSearch}
                        className="w-full px-4 py-2 text-sm text-primary-500 hover:bg-dark-700 transition-colors text-center border-t border-dark-500"
                      >
                        View all results →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Account */}
            {user ? (
              <Dropdown
                trigger={(isOpen) => (
                  <Button variant="transparent" size="sm" className="hover-lift">
                    <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {user.name}
                    <motion.svg 
                      className="ml-1 h-4 w-4 inline-block" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
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
                    to="/quotes"
                    className="block px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
                  >
                    My Quotes
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
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
              <Link to="/login">
                <Button variant="outline" size="sm" className="hover-lift">
                  Login / Register
                </Button>
              </Link>
            )}

            {/* Cart */}
            <Link to="/cart" className="relative">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button variant="transparent" size="sm">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {cartItemCount > 0 && (
                    <Badge variant="danger" size="sm" className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 flex items-center justify-center">
                      {cartItemCount}
                    </Badge>
                  )}
                </Button>
              </motion.div>
            </Link>

            {/* Mobile Menu Button */}
            <button className="lg:hidden text-dark-50 hover:text-primary-500 transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
