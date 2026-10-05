import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import SEOHead from '../components/SEOHead';
import { SEO } from '../config/seoConfig';
import useLegalDocuments from '../hooks/useLegalDocuments';
import { LegalPageError, LegalPageLoading, LegalPageMessage } from '../components/legal/LegalPageStatus';

const scrollBehavior = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

const GeneralInformationPage = () => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);
  // Last section scrolled to, so our own hash updates don't re-trigger a jump
  const scrolledTo = useRef(null);
  const { documents: legalDocuments, loading, error, retry } = useLegalDocuments();

  // Filter and sort documents
  const documents = legalDocuments
    .filter(doc => doc.isActive ?? doc.is_active ?? true)
    .sort((a, b) => (a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0));

  // Deep links (/general-information#warranty) only resolve once documents render
  const targetSlug = hash ? decodeURIComponent(hash.slice(1)) : null;
  const hasDocuments = documents.length > 0;
  useEffect(() => {
    if (!targetSlug || !hasDocuments || scrolledTo.current === targetSlug) return;
    const element = document.getElementById(targetSlug);
    if (element) {
      element.scrollIntoView({ behavior: 'auto', block: 'start' });
      scrolledTo.current = targetSlug;
      setActiveSection(targetSlug);
    }
  }, [targetSlug, hasDocuments]);

  // Scroll to section and keep it in the URL so it can be shared
  const scrollToSection = (slug) => {
    const element = document.getElementById(slug);
    if (element) {
      element.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      setActiveSection(slug);
      scrolledTo.current = slug;
      navigate({ hash: slug }, { replace: true, preventScrollReset: true });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };

  if (loading || error || !hasDocuments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        <SEOHead {...SEO.pages.generalInfo} />
        {loading ? (
          <LegalPageLoading />
        ) : error ? (
          <LegalPageError onRetry={retry} />
        ) : (
          <LegalPageMessage
            title="General Information"
            message="Our policies aren't published online right now. Contact us and we'll send you a copy."
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <SEOHead {...SEO.pages.generalInfo} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header - Not Sticky */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-dark-50">General Information</h1>
            <Link 
              to="/" 
              className="text-primary-500 hover:text-primary-400 transition-colors text-sm font-medium"
            >
              ← Back to Home
            </Link>
          </div>
          <p className="text-dark-200 text-lg">
            All policies, terms, warranties, and important information regarding Eagle Chair products and services.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Sidebar Navigation - Not Sticky */}
          <m.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <h2 className="text-lg font-bold text-dark-50 mb-3 px-2">Contents</h2>
              <nav className="space-y-1">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => scrollToSection(doc.slug)}
                    aria-current={activeSection === doc.slug ? 'location' : undefined}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
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
          </m.div>

          {/* Main Content - Wider */}
          <m.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-4"
          >

            <div className="space-y-8">
              {documents.map((doc, index) => (
                <m.section
                  key={doc.id}
                  id={doc.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 6) * 0.04 }}
                  className="scroll-mt-[calc(var(--header-height,0px)+1rem)] bg-dark-800 border border-dark-700 rounded-lg p-6 md:p-8"
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
                      onClick={scrollToTop}
                      className="text-primary-500 hover:text-primary-400 text-sm inline-flex items-center gap-1"
                    >
                      <span aria-hidden="true">↑</span> Back to Top
                    </button>
                  </div>
                </m.section>
              ))}
            </div>

            {/* Footer CTA */}
            <m.div
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
                <Link
                  to="/contact"
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Contact Us
                </Link>
                <Link
                  to="/quote-request"
                  className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-dark-50 font-semibold rounded-lg transition-colors border border-dark-600"
                >
                  Request a Quote
                </Link>
              </div>
            </m.div>
          </m.div>
        </div>
      </div>
    </div>
  );
};

export default GeneralInformationPage;
