import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSiteSettings } from '../../hooks/useContent';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { data: siteSettings } = useSiteSettings();
  const footerLinks = []; // Footer links should come from API/siteSettings
  
  // Use siteSettings if available
  const contact = siteSettings;

  return (
    <footer className="bg-dark-900 text-dark-100 border-t border-dark-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div className="lg:col-span-1 sm:col-span-2 md:col-span-1 text-center sm:text-left">
            <div className="flex flex-col items-center sm:items-start">
              {siteSettings?.logoUrl ? (
                <img 
                  src={siteSettings.logoUrl} 
                  alt={siteSettings.companyName || 'Eagle Chair'} 
                  className="h-14 sm:h-16 w-auto mb-3 sm:mb-4 opacity-80"
                  onError={(e) => {
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = '/assets/eagle-chair-logo.png';
                  }}
                />
              ) : (
                <img src="/assets/eagle-chair-logo.png" alt="Eagle Chair" className="h-14 sm:h-16 w-auto mb-3 sm:mb-4 opacity-80" />
              )}
              <p className="text-sm mb-3 sm:mb-4 text-dark-200 max-w-xs">Family-owned manufacturer since 1984.</p>
              <div className="flex space-x-4 justify-center sm:justify-start">
                {siteSettings?.facebookUrl && (<motion.a href={siteSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500" whileHover={{ scale: 1.15 }}><svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></motion.a>)}
                {siteSettings?.instagramUrl && (<motion.a href={siteSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500" whileHover={{ scale: 1.15 }}><svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg></motion.a>)}
                {siteSettings?.linkedinUrl && (<motion.a href={siteSettings.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500" whileHover={{ scale: 1.15 }}><svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></motion.a>)}
              </div>
            </div>
          </div>
          <div className="lg:col-span-1"><h4 className="text-dark-50 font-semibold mb-3 sm:mb-4">Products</h4><ul className="space-y-2">{footerLinks.products.map((link) => (<li key={link.path}><Link to={link.path} className="text-sm text-dark-200 hover:text-primary-500">{link.name}</Link></li>))}</ul></div>
          <div className="lg:col-span-1"><h4 className="text-dark-50 font-semibold mb-3 sm:mb-4">Company</h4><ul className="space-y-2">{footerLinks.company.map((link) => (<li key={link.path}><Link to={link.path} className="text-sm text-dark-200 hover:text-primary-500">{link.name}</Link></li>))}</ul></div>
          <div className="lg:col-span-1"><h4 className="text-dark-50 font-semibold mb-3 sm:mb-4">Resources</h4><ul className="space-y-2">{footerLinks.resources.map((link) => (<li key={link.path}><Link to={link.path} className="text-sm text-dark-200 hover:text-primary-500">{link.name}</Link></li>))}</ul></div>
          <div className="lg:col-span-1"><h4 className="text-dark-50 font-semibold mb-3 sm:mb-4">Contact</h4><div className="mb-3 sm:mb-4"><p className="text-sm mb-1 text-dark-200">{contact.addressLine1}</p><p className="text-sm mb-1 text-dark-200">{contact.city}, {contact.state} {contact.zipCode}</p><p className="text-sm mb-1 text-dark-200">Phone: <span className="text-primary-500">{contact.primaryPhone}</span></p><p className="text-sm mb-2 text-dark-200">Email: <span className="text-primary-500">{contact.primaryEmail}</span></p></div><ul className="space-y-1">{footerLinks.legal.map((link) => (<li key={link.path}><Link to={link.path} className="text-xs text-dark-200 hover:text-primary-500">{link.name}</Link></li>))}</ul></div>
        </div>
        <div className="border-t border-dark-700 pt-6 sm:pt-8 mt-6 sm:mt-8">
          <p className="text-sm text-center text-dark-200"> {currentYear} {siteSettings?.companyName || 'Eagle Chair'}. All rights reserved. Family-owned and operated since 1984.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
