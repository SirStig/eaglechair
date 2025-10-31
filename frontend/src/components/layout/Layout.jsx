import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header, { MobileMenu } from './Header';
import Footer from './Footer';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuthStore();
  
  // Subscribe to cart state properly - this will trigger re-renders on cart changes
  const cartItemCount = useCartStore((state) => {
    const items = state.isAuthenticated && state.backendCart 
      ? (state.backendCart.items || [])
      : state.guestItems;
    return items.reduce((sum, item) => sum + item.quantity, 0);
  });

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e, options = {}) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
      if (options.closeMenu) {
        setIsMobileMenuOpen(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-dark-800">
      <Header isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <MobileMenu 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        user={user}
        logout={logout}
        cartItemCount={cartItemCount}
      />
      <main className="flex-grow pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;

