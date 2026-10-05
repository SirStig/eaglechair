import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import SEOHead from '../SEOHead';
import useLegalDocuments from '../../hooks/useLegalDocuments';
import { findLegalDocument } from '../../utils/legalDocumentsLoader';
import { LegalPageError, LegalPageLoading, LegalPageMessage } from './LegalPageStatus';

/**
 * Single legal document page (Terms, Privacy). The document is matched by
 * type first since admins can edit slugs.
 */
const LegalDocumentPage = ({ seo, type, slug, name, related }) => {
  const { documents, loading, error, retry } = useLegalDocuments();
  const doc = findLegalDocument(documents, { type, slug });

  let body;
  if (loading) {
    body = <LegalPageLoading />;
  } else if (error) {
    body = <LegalPageError onRetry={retry} />;
  } else if (!doc) {
    body = (
      <LegalPageMessage
        title={`${name} unavailable`}
        message={`Our ${name} isn't published online right now. Contact us and we'll send you a copy.`}
      />
    );
  } else {
    const shortDescription = doc.shortDescription || doc.short_description;
    const effectiveDate = doc.effectiveDate || doc.effective_date;
    body = (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-[1400px] mx-auto py-12 px-4"
      >
        <article className="bg-dark-800 rounded-lg shadow-xl p-8 md:p-12 border border-dark-700">
          <Link to="/" className="inline-block mb-6 text-primary-500 hover:text-primary-400">
            ← Back to Home
          </Link>

          <h1 className="text-4xl font-bold text-dark-50 mb-4">{doc.title}</h1>
          {shortDescription && <p className="text-dark-300 mb-8">{shortDescription}</p>}

          {effectiveDate && (
            <div className="text-sm text-dark-400 mb-8">
              <strong>Effective Date:</strong> {effectiveDate}
            </div>
          )}

          <div className="text-dark-200 whitespace-pre-wrap leading-relaxed max-w-none">
            {doc.content}
          </div>

          <div className="mt-12 pt-8 border-t border-dark-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link to={related.path} className="text-primary-500 hover:text-primary-400">
              View {related.name} →
            </Link>
            <Link to="/general-information" className="text-primary-500 hover:text-primary-400">
              View All Policies →
            </Link>
          </div>
        </article>
      </m.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <SEOHead {...seo} />
      {body}
    </div>
  );
};

export default LegalDocumentPage;
