import { useMemo, useState } from 'react';
import { FileText, SearchX } from 'lucide-react';
import EmptyResults from '../components/ui/EmptyResults';
import { useCatalogs } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import DocumentList from '../components/knowledge/DocumentList';
import { SPEC_LIBRARY_TYPES, filterByTypes, formatCatalogType, getCatalogType } from '../utils/catalogTypes';

const TABS = [
  { key: 'all', label: 'All' },
  ...SPEC_LIBRARY_TYPES.map((t) => ({ key: t, label: `${formatCatalogType(t)}s` })),
];

// Group under the first letter of the title; numbers (model-only titles) go under "#".
const letterOf = (title = '') => {
  const ch = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
};

const SpecSheetsPage = () => {
  const { data: catalogs = [], loading } = useCatalogs();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const library = useMemo(() => filterByTypes(catalogs, SPEC_LIBRARY_TYPES), [catalogs]);
  const counts = useMemo(() => {
    const c = { all: library.length };
    library.forEach((d) => {
      const t = getCatalogType(d);
      c[t] = (c[t] || 0) + 1;
    });
    return c;
  }, [library]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = library
      .filter((d) => tab === 'all' || getCatalogType(d) === tab)
      .filter((d) => !q || d.title?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    const byLetter = new Map();
    matches.forEach((d) => {
      const l = letterOf(d.title);
      if (!byLetter.has(l)) byLetter.set(l, []);
      byLetter.get(l).push(d);
    });
    return [...byLetter.entries()];
  }, [library, tab, query]);

  const visibleTabs = TABS.filter((t) => t.key === 'all' || counts[t.key]);

  const toolbar = (
    <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
      <label className="flex-1">
        <span className="sr-only">Search spec sheets</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by collection name or model number…"
          className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </label>
      {visibleTabs.length > 2 && (
        <div role="tablist" aria-label="Document type" className="flex flex-wrap gap-2">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                tab === t.key
                  ? 'bg-slate-800 border-slate-800 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
              }`}
            >
              {t.label} <span className="opacity-70">({counts[t.key] || 0})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <KnowledgePageLayout
      pageKey="specs"
      seo={SEO.pages.specSheets}
      subtitle="Line sheets, spec sheets and line drawings for individual models and collections."
      loading={loading}
      toolbar={toolbar}
      footerNote={{
        title: 'Need CAD, Revit or a custom shop drawing?',
        text: "We don't publish CAD files, but we can prepare drawings for your project on request.",
        cta: 'Request drawings',
      }}
    >
      {groups.length === 0 ? (
        <EmptyResults
          icon={query ? SearchX : FileText}
          title={query ? 'No matching documents' : 'No documents available yet'}
          message={query ? 'Try a collection name or a 4-digit model number.' : undefined}
        />
      ) : (
        <>
          {groups.length > 4 && (
            <nav aria-label="Jump to letter" className="flex flex-wrap gap-1 mb-6">
              {groups.map(([letter]) => (
                <a
                  key={letter}
                  href={`#specs-${letter}`}
                  className="w-8 h-8 inline-flex items-center justify-center rounded border border-cream-200 bg-white text-sm font-medium text-slate-700 hover:border-primary-500 hover:text-primary-700"
                >
                  {letter}
                </a>
              ))}
            </nav>
          )}
          <div className="space-y-8">
            {groups.map(([letter, docs]) => (
              <section key={letter} id={`specs-${letter}`} className="scroll-mt-24">
                <h2 className="text-lg font-bold text-slate-800 mb-3">{letter}</h2>
                <DocumentList documents={docs} showType={tab === 'all'} />
              </section>
            ))}
          </div>
        </>
      )}
    </KnowledgePageLayout>
  );
};

export default SpecSheetsPage;
