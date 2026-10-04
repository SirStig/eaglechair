import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../SEOHead';
import { useScrollEdges } from '../../hooks/useScrollEdges';
import LoadingSpinner from '../ui/LoadingSpinner';
import { PRODUCT_KNOWLEDGE_PAGES, getKnowledgePage } from '../../config/productKnowledge';

/**
 * Shared shell for every Product Knowledge page: breadcrumb, title, a section switcher
 * so visitors can hop between pages, and a closing contact prompt.
 */
const KnowledgePageLayout = ({
  pageKey,
  seo,
  title,
  subtitle,
  loading = false,
  toolbar = null,
  footerNote = null,
  children,
}) => {
  const page = getKnowledgePage(pageKey);
  const heading = title || page?.name;
  const { ref: tabsRef, maskStyle: tabsMask } = useScrollEdges({ fade: '40px' });

  // On phones the section tabs are one scrolling row; bring the current one
  // into view (horizontally only, so the page itself doesn't jump).
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = offset - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pageKey, tabsRef]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-cream-100">
      {seo && <SEOHead {...seo} />}

      <div className="bg-cream-50/90 border-b border-cream-200 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-2">
            <Link to="/" className="hover:text-primary-600">Home</Link>
            <span className="mx-2" aria-hidden>/</span>
            <span>Product Knowledge</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800">{heading}</h1>
          {subtitle && <p className="text-slate-600 mt-2 max-w-3xl">{subtitle}</p>}

          <nav
            ref={tabsRef}
            aria-label="Product Knowledge sections"
            className="mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible"
            style={tabsMask}
          >
            {PRODUCT_KNOWLEDGE_PAGES.map((p) => {
              const active = p.key === pageKey;
              const Icon = p.icon;
              return (
                <Link
                  key={p.key}
                  to={p.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm border transition-colors ${
                    active
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-cream-200 text-slate-700 hover:border-primary-500 hover:text-primary-700'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  {p.shortName || p.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toolbar && (
          <div className="bg-white rounded-lg p-4 sm:p-6 border border-cream-200 mb-8">{toolbar}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner />
          </div>
        ) : (
          children
        )}

        <div className="mt-16 rounded-lg border border-cream-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {footerNote?.title || "Can't find what you need?"}
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              {footerNote?.text || 'Ask our team about samples, drawings or details for a specific model.'}
            </p>
          </div>
          <Link
            to={footerNote?.to || '/contact'}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors"
          >
            {footerNote?.cta || 'Contact us'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default KnowledgePageLayout;
