import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    products: [
      { name: 'Chairs', path: '/products/chairs' },
      { name: 'Barstools', path: '/products/barstools' },
      { name: 'Tables', path: '/products/tables' },
      { name: 'Booths', path: '/products/booths' },
      { name: 'Outdoor', path: '/products/outdoor' },
    ],
    company: [
      { name: 'About Us', path: '/about' },
      { name: 'Gallery', path: '/gallery' },
      { name: 'Find a Rep', path: '/find-a-rep' },
      { name: 'Contact', path: '/contact' },
    ],
    resources: [
      { name: 'Product Catalog', path: '/resources/catalog' },
      { name: 'Fabric Swatches', path: '/resources/fabrics' },
      { name: 'Installation Guides', path: '/resources/guides' },
      { name: 'CAD Files', path: '/resources/cad' },
    ],
    legal: [
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Shipping Policy', path: '/shipping' },
      { name: 'Return Policy', path: '/returns' },
    ],
  };

  return (
    <footer className="bg-dark-900 text-dark-100 border-t border-dark-500">
      <div className="container mx-auto py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <img 
              src="/assets/eagle-chair-logo.png" 
              alt="Eagle Chair" 
              className="h-12 w-auto mb-4 opacity-80"
            />
            <p className="text-sm mb-4 text-dark-200">
              Family-owned manufacturer of high-quality commercial furniture since 1984.
            </p>
            <div className="flex space-x-4">
              <motion.a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-primary-500 transition-colors"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </motion.a>
              <motion.a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-primary-500 transition-colors"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </motion.a>
              <motion.a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-primary-500 transition-colors"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </motion.a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-dark-50 font-semibold mb-4">Products</h4>
            <ul className="space-y-2">
              {footerLinks.products.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="footer-link text-sm text-dark-200 hover:text-primary-500 transition-all inline-block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-dark-50 font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="footer-link text-sm text-dark-200 hover:text-primary-500 transition-all inline-block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-dark-50 font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="footer-link text-sm text-dark-200 hover:text-primary-500 transition-all inline-block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h4 className="text-dark-50 font-semibold mb-4">Contact</h4>
            <p className="text-sm mb-2 text-dark-200">123 Furniture Lane</p>
            <p className="text-sm mb-2 text-dark-200">Grand Rapids, MI 49504</p>
            <p className="text-sm mb-2 text-dark-200">Phone: <span className="text-primary-500">(616) 555-0100</span></p>
            <p className="text-sm mb-4 text-dark-200">Email: <span className="text-primary-500">info@eaglechair.com</span></p>
            <ul className="space-y-1">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="footer-link text-xs text-dark-200 hover:text-primary-500 transition-all inline-block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-dark-700 pt-8 mt-8">
          <p className="text-sm text-center text-dark-200">
            © {currentYear} Eagle Chair. All rights reserved. Family-owned and operated since 1984.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


