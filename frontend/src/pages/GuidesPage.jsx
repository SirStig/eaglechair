import { BookOpen } from 'lucide-react';
import { useCatalogs } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import DocumentList from '../components/knowledge/DocumentList';
import { filterByTypes } from '../utils/catalogTypes';

const SECTIONS = [
  {
    id: 'installation',
    title: 'Layout & Installation',
    description: 'Booth and table layout rules of thumb, seating heights and spacing, and base and glide installation.',
    types: ['installation_guide'],
  },
  {
    id: 'care',
    title: 'Care & Maintenance',
    description: 'Cleaning and upkeep for wood, vinyl and laminate.',
    types: ['care_guide'],
  },
  {
    id: 'reference',
    title: 'Warranty & Reference',
    description: 'Warranty terms and planning references.',
    types: ['other'],
  },
];

const GuidesPage = () => {
  const { data: catalogs = [], loading } = useCatalogs();
  const sections = SECTIONS.map((s) => ({ ...s, docs: filterByTypes(catalogs, s.types) })).filter(
    (s) => s.docs.length > 0
  );

  return (
    <KnowledgePageLayout
      pageKey="guides"
      seo={SEO.pages.guides}
      title="Installation & Care"
      subtitle="Planning, installation and care guides, plus our warranty."
      loading={loading}
    >
      {sections.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-xl font-semibold text-slate-700">No guides available yet</h2>
        </div>
      ) : (
        <>
          {sections.length > 1 && (
            <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-2 mb-8 text-sm">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-primary-600 hover:text-primary-700 font-medium">
                  {s.title} ({s.docs.length})
                </a>
              ))}
            </nav>
          )}
          <div className="space-y-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-800">{s.title}</h2>
                <p className="text-slate-600 mt-1 mb-4">{s.description}</p>
                <DocumentList documents={s.docs} />
              </section>
            ))}
          </div>
        </>
      )}
    </KnowledgePageLayout>
  );
};

export default GuidesPage;
