import { Link } from 'react-router-dom';
import { Book } from 'lucide-react';
import { useCatalogs } from '../hooks/useContent';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';
import DocumentList from '../components/knowledge/DocumentList';
import { CATALOG_PAGE_TYPES, filterByTypes, getCatalogType } from '../utils/catalogTypes';

const VirtualCatalogsPage = () => {
  const { data: catalogs = [], loading } = useCatalogs();

  // Catalogs and brochures only — line sheets live in the spec library, guides on the guides page.
  const documents = filterByTypes(catalogs, CATALOG_PAGE_TYPES);
  const fullCatalogs = documents.filter((d) => getCatalogType(d) === 'full_catalog');
  const priceLists = documents.filter((d) => getCatalogType(d) === 'price_list');

  return (
    <KnowledgePageLayout
      pageKey="catalogs"
      seo={SEO.pages.virtualCatalogs}
      title="Catalogs"
      subtitle="Our full catalogs and collection brochures. Looking for a single model? Its line sheet and spec sheet are in Spec Sheets & Drawings."
      loading={loading}
    >
      {documents.length === 0 ? (
        <div className="text-center py-16">
          <Book className="w-16 h-16 text-slate-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">No catalogs available</h2>
          <p className="text-slate-500">Check back soon for downloadable catalogs.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {fullCatalogs.length > 0 && (
            <section>
              <DocumentList documents={fullCatalogs} variant="cards" />
            </section>
          )}
          {priceLists.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Price Lists</h2>
              <DocumentList documents={priceLists} />
            </section>
          )}
          <p className="text-sm text-slate-600">
            Need a single collection?{' '}
            <Link to="/resources/spec-sheets" className="text-primary-600 hover:text-primary-700 font-medium">
              Browse line sheets by name →
            </Link>
          </p>
        </div>
      )}
    </KnowledgePageLayout>
  );
};

export default VirtualCatalogsPage;
