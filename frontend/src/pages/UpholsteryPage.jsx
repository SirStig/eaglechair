import { useMemo, useState } from 'react';
import { Spool, SearchX } from 'lucide-react';
import EmptyResults from '../components/ui/EmptyResults';
import { useCatalogs, useUpholsteries } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import SwatchCard from '../components/knowledge/SwatchCard';
import MaterialDetailOverlay from '../components/knowledge/MaterialDetailOverlay';
import { upholsteryDetail } from '../components/knowledge/materialDetails';
import DocumentList from '../components/knowledge/DocumentList';
import { UPHOLSTERY_GUIDE_TYPES, filterByTypes } from '../utils/catalogTypes';
import { useTrackedQuery } from '../hooks/useMaterialInterest';

// Section heading for a material: the mill/brand when known, otherwise its grade, otherwise its type.
const groupOf = (u) => u.manufacturer || (u.grade ? `${u.grade} ${u.materialType || ''}`.trim() : u.materialType || 'Other');

const UpholsteryPage = () => {
  const { data: upholsteries = [], loading } = useUpholsteries();
  const { data: catalogs = [] } = useCatalogs();
  const [query, setQuery] = useState('');
  useTrackedQuery('Upholstery search', query);
  const [type, setType] = useState('all');
  const [detail, setDetail] = useState(null); // { items, index } while the overlay is open

  const active = useMemo(() => (upholsteries || []).filter((u) => u.isActive !== false), [upholsteries]);
  const types = useMemo(() => [...new Set(active.map((u) => u.materialType).filter(Boolean))], [active]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    active
      .filter((u) => type === 'all' || u.materialType === type)
      .filter(
        (u) =>
          !q ||
          [u.name, u.fabricCode, u.color, u.manufacturer, u.pattern, u.description]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q))
      )
      .forEach((u) => {
        const g = groupOf(u);
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(u);
      });
    return [...map.entries()];
  }, [active, query, type]);

  const guides = filterByTypes(catalogs, UPHOLSTERY_GUIDE_TYPES);

  return (
    <KnowledgePageLayout
      pageKey="upholstery"
      seo={SEO.pages.upholstery}
      subtitle="Vinyls and leathers we upholster with, plus nail head and trim options. Colors on screen are approximate — ask for samples."
      loading={loading}
      toolbar={
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex-1">
            <span className="sr-only">Search upholstery</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by color, pattern or brand…"
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </label>
          {types.length > 1 && (
            <label className="md:w-56">
              <span className="sr-only">Material type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All materials</option>
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      }
      footerNote={{ title: 'Need a sample or using your own material?', text: 'Ask us for vinyl samples or yardage for customer-supplied material.', cta: 'Contact us' }}
    >
      {groups.length === 0 ? (
        <EmptyResults
          icon={query ? SearchX : Spool}
          title={query ? 'No materials found' : 'No materials listed yet'}
          message={query ? 'Try a different material, grade, or supplier.' : undefined}
        />
      ) : (
        <div className="space-y-12">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{group}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {items.map((u, i) => (
                  <SwatchCard
                    key={u.id}
                    onOpen={() => setDetail({ items: items.map(upholsteryDetail), index: i })}
                    item={u}
                    kind="fabric"
                    title={u.name}
                    code={u.fabricCode}
                    facts={[u.pattern, u.color, u.grade && !group.includes(u.grade) ? u.grade : null]}
                    description={u.description}
                    badges={[u.isPopular && 'Popular', u.durabilityRating, u.flameRating]}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {guides.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Upholstery Guides</h2>
          <DocumentList documents={guides} />
        </section>
      )}
      <MaterialDetailOverlay
        items={detail?.items}
        index={detail?.index}
        onIndexChange={(index) => setDetail((d) => ({ ...d, index }))}
        onClose={() => setDetail(null)}
      />
    </KnowledgePageLayout>
  );
};

export default UpholsteryPage;
