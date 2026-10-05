import { useMemo, useState } from 'react';
import { Palette, SearchX } from 'lucide-react';
import EmptyResults from '../components/ui/EmptyResults';
import { useCatalogs, useFinishes , useMaterialSources } from '../hooks/useContent';
import SupplierLinks from '../components/ui/SupplierLinks';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import SwatchCard from '../components/knowledge/SwatchCard';
import MaterialDetailOverlay from '../components/knowledge/MaterialDetailOverlay';
import { finishDetail } from '../components/knowledge/materialDetails';
import DocumentList from '../components/knowledge/DocumentList';
import { FINISH_GUIDE_TYPES, filterByTypes } from '../utils/catalogTypes';
import { useTrackedQuery } from '../hooks/useMaterialInterest';

const GRADE_ORDER = ['Standard', 'Premium', 'Premium Plus', 'Artisan'];
// Metal frame finishes live in the same table; they get their own sections.
const METAL_TYPES = ['Powder Coat', 'Plated'];
const isMetal = (f) => METAL_TYPES.includes(f.finishType);

const WoodFinishesPage = () => {
  const { data: finishes = [], loading } = useFinishes();
  const { data: suppliers = [] } = useMaterialSources('finish');
  const { data: catalogs = [] } = useCatalogs();
  const [query, setQuery] = useState('');
  useTrackedQuery('Wood finish search', query);
  const [detail, setDetail] = useState(null); // { items, index } while the overlay is open

  const { groups, metalGroups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = (finishes || []).filter(
      (f) =>
        f.isActive !== false &&
        (!q ||
          f.name?.toLowerCase().includes(q) ||
          f.finishCode?.toLowerCase().includes(q) ||
          f.colorFamily?.toLowerCase().includes(q) ||
          f.finishType?.toLowerCase().includes(q))
    );
    const wood = visible.filter((f) => !isMetal(f));
    const grades = [...GRADE_ORDER, ...new Set(wood.map((f) => f.grade).filter((g) => g && !GRADE_ORDER.includes(g)))];
    return {
      groups: grades
        .map((grade) => ({ grade, items: wood.filter((f) => (f.grade || 'Standard') === grade) }))
        .filter((g) => g.items.length > 0),
      metalGroups: METAL_TYPES
        .map((type) => ({ type, items: visible.filter((f) => f.finishType === type) }))
        .filter((g) => g.items.length > 0),
    };
  }, [finishes, query]);

  const guides = filterByTypes(catalogs, FINISH_GUIDE_TYPES);

  return (
    <KnowledgePageLayout
      pageKey="finishes"
      seo={SEO.pages.woodFinishes}
      subtitle="Wood stains grouped by grade, plus powder coat and plated finishes for metal frames and bases. Swatches are a guide — grain, texture and screens vary, so ask for a physical sample before you specify."
      loading={loading}
      toolbar={
        <label className="block">
          <span className="sr-only">Search finishes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or finish code (e.g. 14-210)…"
            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </label>
      }
      footerNote={{ title: 'Want to see it in person?', text: 'Ask us for finish samples or about matching a custom finish.', cta: 'Request samples' }}
    >
      <SupplierLinks variant="cards" sources={suppliers} className="mb-12" />
      {groups.length === 0 && metalGroups.length === 0 ? (
        suppliers.length > 0 && !query ? null : <EmptyResults
          icon={query ? SearchX : Palette}
          title={query ? 'No finishes found' : 'No finishes available'}
          message={query ? 'Try a finish name or code, like 14-210.' : undefined}
        />
      ) : (
        <div className="space-y-12">
          {groups.length + metalGroups.length > 1 && (
            <nav aria-label="Finish groups" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {groups.map((g) => (
                <a key={g.grade} href={`#grade-${g.grade.replace(/\s+/g, '-')}`} className="text-primary-600 hover:text-primary-700 font-medium">
                  {g.grade} ({g.items.length})
                </a>
              ))}
              {metalGroups.map((g) => (
                <a key={g.type} href={`#metal-${g.type.replace(/\s+/g, '-')}`} className="text-primary-600 hover:text-primary-700 font-medium">
                  {g.type} ({g.items.length})
                </a>
              ))}
            </nav>
          )}
          {groups.map((g) => (
            <section key={g.grade} id={`grade-${g.grade.replace(/\s+/g, '-')}`} className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{g.grade}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {g.items.map((f, i) => (
                  <SwatchCard
                    key={f.id}
                    onOpen={() => setDetail({ items: g.items.map((x) => finishDetail(x)), index: i })}
                    item={f}
                    kind="wood"
                    title={f.name}
                    code={f.finishCode}
                    facts={[f.colorFamily]}
                    description={f.description}
                    badges={[f.isPopular && 'Popular']}
                  />
                ))}
              </div>
            </section>
          ))}
          {metalGroups.length > 0 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Metal Finishes</h2>
                <p className="text-slate-600 mt-1">
                  All metal frames and bases are powder coated or plated. Powder coat is available in virtually any RAL color; minimum quantities and a surcharge may apply.
                </p>
              </div>
              {metalGroups.map((g) => (
                <section key={g.type} id={`metal-${g.type.replace(/\s+/g, '-')}`} className="scroll-mt-24">
                  <h3 className="text-xl font-semibold text-slate-800 mb-4">{g.type}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {g.items.map((f, i) => (
                      <SwatchCard
                        key={f.id}
                        onOpen={() => setDetail({ items: g.items.map((x) => finishDetail(x, { metal: true })), index: i })}
                        item={f}
                        kind="metal"
                        title={f.name}
                        code={f.finishCode}
                        facts={[f.isCustom && 'Custom']}
                        description={f.description}
                        badges={[]}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {guides.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Finish Guides</h2>
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

export default WoodFinishesPage;
