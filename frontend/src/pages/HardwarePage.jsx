import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cog } from 'lucide-react';
import { useHardware } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import ImagePlaceholder from '../components/ui/ImagePlaceholder';
import { resolveImageUrl } from '../utils/apiHelpers';

const CATEGORY_ORDER = [
  'Glides',
  'Swivels',
  'Footrings',
  'Scuff Plates',
  'Chair Legs',
  'Brackets & Fasteners',
  'Table Bases',
  'Table Edge Profiles',
  'Other Hardware',
];

const HardwareCard = ({ item }) => {
  const img = item.imageUrl || item.thumbnailUrl;
  const facts = [
    item.material && ['Material', item.material],
    item.finish && ['Finish', item.finish],
    item.dimensions && ['Size', item.dimensions],
    item.weightCapacity && ['Capacity', item.weightCapacity],
    item.compatibleWith && ['Fits', item.compatibleWith],
  ].filter(Boolean);

  return (
    <article className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-colors duration-300 flex flex-col">
      {img ? (
        <div className="aspect-[4/3] bg-white border-b border-cream-100">
          <ResponsiveImage
            src={resolveImageUrl(img)}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            alt={item.name}
            className="w-full h-full object-contain p-3"
            loading="lazy"
          />
        </div>
      ) : (
        <ImagePlaceholder kind="metal" label="Photo coming soon" title={item.name} className="aspect-[4/3]" />
      )}
      <div className="p-3 sm:p-4 flex-1">
        <h3 className="font-semibold text-slate-800 leading-snug">{item.name}</h3>
        {item.modelNumber && <p className="text-xs font-mono text-primary-700 mt-0.5">{item.modelNumber}</p>}
        {item.description && <p className="text-sm text-slate-600 mt-2 line-clamp-3">{item.description}</p>}
        {facts.length > 0 && (
          <dl className="mt-2 text-xs text-slate-600 space-y-0.5">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-medium text-slate-700">{k}: </dt>
                <dd className="inline">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
};

const HardwarePage = () => {
  const { data: hardware = [], loading } = useHardware();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const active = useMemo(() => (hardware || []).filter((h) => h.isActive !== false), [hardware]);
  const categories = useMemo(() => {
    const present = new Set(active.map((h) => h.category || 'Other Hardware'));
    return [...CATEGORY_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CATEGORY_ORDER.includes(c))];
  }, [active]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = active.filter(
      (h) =>
        !q ||
        [h.name, h.modelNumber, h.sku, h.description, h.compatibleWith]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
    );
    return categories
      .filter((c) => category === 'all' || c === category)
      .map((c) => [c, matches.filter((h) => (h.category || 'Other Hardware') === c)])
      .filter(([, items]) => items.length > 0);
  }, [active, categories, category, query]);

  return (
    <KnowledgePageLayout
      pageKey="hardware"
      seo={SEO.pages.hardware}
      subtitle="Glides, swivels, footrings and other chair hardware, plus the table bases and edge profiles we build with."
      loading={loading}
      toolbar={
        <div className="space-y-4">
          <label className="block">
            <span className="sr-only">Search hardware</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or part number (e.g. WCG-12, T3V-22)…"
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </label>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {['all', ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    category === c
                      ? 'bg-slate-800 border-slate-800 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
                  }`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      {groups.length === 0 ? (
        <div className="text-center py-16">
          <Cog className="w-16 h-16 text-slate-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-xl font-semibold text-slate-700">{query ? 'No hardware found' : 'No hardware listed yet'}</h2>
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{cat}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {items.map((h) => (
                  <HardwareCard key={h.id} item={h} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-sm text-slate-600">
        Installing glides or bases?{' '}
        <Link to="/resources/guides#installation" className="text-primary-600 hover:text-primary-700 font-medium">
          See the installation guides →
        </Link>
      </p>
    </KnowledgePageLayout>
  );
};

export default HardwarePage;
