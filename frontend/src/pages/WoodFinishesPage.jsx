import { useMemo, useState } from 'react';
import { Palette, SearchX } from 'lucide-react';
import EmptyResults from '../components/ui/EmptyResults';
import { useCatalogs, useFinishes } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import SwatchCard from '../components/knowledge/SwatchCard';
import DocumentList from '../components/knowledge/DocumentList';
import { FINISH_GUIDE_TYPES, filterByTypes } from '../utils/catalogTypes';

const GRADE_ORDER = ['Standard', 'Premium', 'Premium Plus', 'Artisan'];

const WoodFinishesPage = () => {
  const { data: finishes = [], loading } = useFinishes();
  const { data: catalogs = [] } = useCatalogs();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = (finishes || []).filter(
      (f) =>
        f.isActive !== false &&
        (!q ||
          f.name?.toLowerCase().includes(q) ||
          f.finishCode?.toLowerCase().includes(q) ||
          f.colorFamily?.toLowerCase().includes(q))
    );
    const grades = [...GRADE_ORDER, ...new Set(visible.map((f) => f.grade).filter((g) => g && !GRADE_ORDER.includes(g)))];
    return grades
      .map((grade) => ({ grade, items: visible.filter((f) => (f.grade || 'Standard') === grade) }))
      .filter((g) => g.items.length > 0);
  }, [finishes, query]);

  const guides = filterByTypes(catalogs, FINISH_GUIDE_TYPES);

  return (
    <KnowledgePageLayout
      pageKey="finishes"
      seo={SEO.pages.woodFinishes}
      subtitle="Stains and finishes grouped by grade. Swatches are a guide — wood grain and screens vary, so ask for a physical sample before you specify."
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
      {groups.length === 0 ? (
        <EmptyResults
          icon={query ? SearchX : Palette}
          title={query ? 'No finishes found' : 'No finishes available'}
          message={query ? 'Try a finish name or code, like 14-210.' : undefined}
        />
      ) : (
        <div className="space-y-12">
          {groups.length > 1 && (
            <nav aria-label="Grades" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {groups.map((g) => (
                <a key={g.grade} href={`#grade-${g.grade.replace(/\s+/g, '-')}`} className="text-primary-600 hover:text-primary-700 font-medium">
                  {g.grade} ({g.items.length})
                </a>
              ))}
            </nav>
          )}
          {groups.map((g) => (
            <section key={g.grade} id={`grade-${g.grade.replace(/\s+/g, '-')}`} className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{g.grade}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {g.items.map((f) => (
                  <SwatchCard
                    key={f.id}
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
        </div>
      )}

      {guides.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Finish Guides</h2>
          <DocumentList documents={guides} />
        </section>
      )}
    </KnowledgePageLayout>
  );
};

export default WoodFinishesPage;
