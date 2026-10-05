import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, SearchX } from 'lucide-react';
import EmptyResults from '../components/ui/EmptyResults';
import { useLaminates } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import SwatchCard from '../components/knowledge/SwatchCard';
import MaterialDetailOverlay from '../components/knowledge/MaterialDetailOverlay';
import { laminateDetail } from '../components/knowledge/materialDetails';
import { safeHref } from '../utils/safeUrl';
import { useTrackedQuery } from '../hooks/useMaterialInterest';

const LaminatesPage = () => {
  const { data: laminates = [], loading } = useLaminates();
  const [query, setQuery] = useState('');
  useTrackedQuery('Laminate search', query);
  const [detail, setDetail] = useState(null); // { items, index } while the overlay is open

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    (laminates || [])
      .filter((l) => l.isActive !== false)
      .filter(
        (l) =>
          !q ||
          [l.patternName, l.patternCode, l.brand, l.colorFamily, l.description]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q))
      )
      .forEach((l) => {
        const brand = l.brand || 'Other';
        if (!map.has(brand)) map.set(brand, []);
        map.get(brand).push(l);
      });
    return [...map.entries()];
  }, [laminates, query]);

  return (
    <KnowledgePageLayout
      pageKey="laminates"
      seo={SEO.pages.laminates}
      subtitle="Laminates for table tops, grouped by brand. Ask us if you need a pattern that isn't listed."
      loading={loading}
      toolbar={
        <label className="block">
          <span className="sr-only">Search laminates</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by pattern name, code or brand…"
            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </label>
      }
    >
      {groups.length === 0 ? (
        <EmptyResults
          icon={query ? SearchX : Layers}
          title={query ? 'No laminates found' : 'No laminates listed yet'}
          message={query ? 'Try a different laminate name or code.' : undefined}
        />
      ) : (
        <div className="space-y-12">
          {groups.map(([brand, items]) => {
            const site = safeHref(items.find((l) => l.supplierWebsite)?.supplierWebsite);
            return (
              <section key={brand}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <h2 className="text-2xl font-bold text-slate-800">{brand}</h2>
                  {site && (
                    <a href={site} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700">
                      Full {brand} range →
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {items.map((l, i) => (
                    <SwatchCard
                      key={l.id}
                      onOpen={() => setDetail({ items: items.map(laminateDetail), index: i })}
                      item={l}
                      kind="laminate"
                      title={l.patternName}
                      code={l.patternCode}
                      facts={[l.colorFamily, l.finishType, l.grade]}
                      description={l.description}
                      badges={[l.isPopular && 'Popular']}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-12 text-sm text-slate-600">
        Caring for laminate tops?{' '}
        <Link to="/resources/guides#care" className="text-primary-600 hover:text-primary-700 font-medium">
          See the care guides →
        </Link>
      </p>
      <MaterialDetailOverlay
        items={detail?.items}
        index={detail?.index}
        onIndexChange={(index) => setDetail((d) => ({ ...d, index }))}
        onClose={() => setDetail(null)}
      />
    </KnowledgePageLayout>
  );
};

export default LaminatesPage;
