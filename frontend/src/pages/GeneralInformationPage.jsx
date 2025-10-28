import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IS_DEMO, demoLegalDocuments } from '../data/demoData';
import { legalDocuments } from '../data/contentData';

const GeneralInformationPage = () => {
  const [activeSection, setActiveSection] = useState(null);

  // Filter and sort documents (use demo or production data)
  const legalData = IS_DEMO ? demoLegalDocuments : legalDocuments;
  const documents = legalData
    .filter(doc => doc.is_active || doc.isActive)
    .sort((a, b) => (a.display_order || a.displayOrder || 0) - (b.display_order || b.displayOrder || 0));

  // Scroll to section
  const scrollToSection = (slug) => {
    const element = document.getElementById(slug);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(slug);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Page Header */}
      <div className="bg-dark-900/80 border-b border-dark-700 sticky top-[80px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <span className="text-dark-50 font-semibold hidden sm:block">General Information</span>
            </Link>
            <Link 
              to="/" 
              className="text-primary-500 hover:text-primary-400 transition-colors text-sm"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24">
              <h2 className="text-xl font-bold text-dark-50 mb-4 px-4">Navigation</h2>
              <nav className="space-y-1 bg-dark-800 border border-dark-700 rounded-lg p-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => scrollToSection(doc.slug)}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === doc.slug
                        ? 'bg-primary-600 text-white'
                        : 'text-dark-200 hover:bg-dark-700 hover:text-dark-50'
                    }`}
                  >
                    {doc.title}
                  </button>
                ))}
              </nav>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-dark-50 mb-4">General Information</h1>
              <p className="text-dark-200 text-lg">
                All policies, terms, warranties, and important information regarding Eagle Chair products and services.
              </p>
            </div>

            <div className="space-y-8">
              {documents.map((doc, index) => (
                <motion.section
                  key={doc.id}
                  id={doc.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-dark-800 border border-dark-700 rounded-lg p-8 scroll-mt-24"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-dark-50 mb-2">
                        {doc.title}
                      </h2>
                      {(doc.short_description || doc.shortDescription) && (
                        <p className="text-primary-500 text-sm">
                          {doc.short_description || doc.shortDescription}
                        </p>
                      )}
                    </div>
                    {doc.version && (
                      <span className="text-xs text-dark-300 bg-dark-700 px-3 py-1 rounded-full">
                        v{doc.version}
                      </span>
                    )}
                  </div>

                  <div className="prose prose-invert max-w-none">
                    <div className="text-dark-200 whitespace-pre-wrap leading-relaxed">
                      {doc.content}
                    </div>
                  </div>

                  {(doc.effective_date || doc.effectiveDate) && (
                    <div className="mt-6 pt-4 border-t border-dark-700 text-sm text-dark-300">
                      Effective Date: {doc.effective_date || doc.effectiveDate}
                    </div>
                  )}

                  <div className="mt-4">
                    <button
                      onClick={() => scrollToSection(doc.slug)}
                      className="text-primary-500 hover:text-primary-400 text-sm inline-flex items-center gap-1"
                    >
                      <span>↑</span> Back to Top
                    </button>
                  </div>
                </motion.section>
              ))}
            </div>

            {/* Footer CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-12 bg-gradient-to-r from-primary-900/50 to-primary-800/50 border border-primary-700 rounded-lg p-8 text-center"
            >
              <h3 className="text-2xl font-bold text-dark-50 mb-2">
                Questions About Our Policies?
              </h3>
              <p className="text-dark-200 mb-6">
                Our team is here to help. Contact us for clarification on any of our terms and conditions.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/contact">
                  <button className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors">
                    Contact Us
                  </button>
                </Link>
                <Link to="/quote">
                  <button className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-dark-50 font-semibold rounded-lg transition-colors border border-dark-600">
                    Request a Quote
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default GeneralInformationPage;
