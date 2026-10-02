import { useState } from 'react';
import { Eye, Download } from 'lucide-react';
import CatalogCoverImage from '../ui/CatalogCoverImage';
import PDFViewerModal from '../ui/PDFViewerModal';
import { formatFileSize, resolveFileUrl } from '../../utils/apiHelpers';
import { formatCatalogType, getCatalogType } from '../../utils/catalogTypes';

const fileUrlOf = (doc) => doc.fileUrl || doc.file_url;
const isPdf = (doc) =>
  (doc.fileType || '').toLowerCase() === 'pdf' || fileUrlOf(doc)?.toLowerCase().endsWith('.pdf');

const DocActions = ({ doc, onView, compact = false }) => {
  const url = fileUrlOf(doc);
  if (!url) return null;
  const btn = compact ? 'px-3 py-1.5 text-sm' : 'flex-1 px-4 py-2';
  return (
    <div className={`flex gap-2 ${compact ? '' : 'w-full'}`}>
      {isPdf(doc) && (
        <button
          type="button"
          onClick={() => onView(doc)}
          className={`${btn} inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors`}
        >
          <Eye className="w-4 h-4" aria-hidden />
          View
        </button>
      )}
      <a
        href={resolveFileUrl(url)}
        download
        aria-label={`Download ${doc.title}`}
        className={`${btn} inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors`}
      >
        <Download className="w-4 h-4" aria-hidden />
        {compact ? <span className="sr-only sm:not-sr-only">Download</span> : 'Download'}
      </a>
    </div>
  );
};

const metaLine = (doc, showType) =>
  [
    showType && formatCatalogType(getCatalogType(doc)),
    doc.year,
    doc.fileSize ? formatFileSize(doc.fileSize) : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Lists downloadable documents. `variant="cards"` for a handful of featured items (catalogs),
 * `variant="list"` for long libraries — compact rows with a small cover.
 */
const DocumentList = ({ documents, variant = 'list', showType = false }) => {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      {variant === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {documents.map((doc) => (
            <article
              key={doc.id}
              className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-colors duration-300 group flex flex-col"
            >
              <CatalogCoverImage catalog={doc} imgClassName="group-hover:scale-105" />
              <div className="p-5 flex flex-col flex-1">
                {metaLine(doc, showType) && (
                  <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                    {metaLine(doc, showType)}
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-800 mb-2">{doc.title}</h3>
                {doc.description && (
                  <p className="text-slate-600 text-sm mb-4 line-clamp-3">{doc.description}</p>
                )}
                <div className="mt-auto">
                  <DocActions doc={doc} onView={setViewing} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 bg-white rounded-lg border border-cream-200">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="w-10 sm:w-12 flex-shrink-0 rounded border border-cream-200 overflow-hidden">
                <CatalogCoverImage catalog={doc} compact />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800 leading-snug">{doc.title}</h3>
                {doc.description && (
                  <p className="text-sm text-slate-600 line-clamp-1">{doc.description}</p>
                )}
                {metaLine(doc, showType) && (
                  <p className="text-xs text-slate-500 mt-0.5">{metaLine(doc, showType)}</p>
                )}
              </div>
              <DocActions doc={doc} onView={setViewing} compact />
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <PDFViewerModal
          isOpen
          onClose={() => setViewing(null)}
          fileUrl={fileUrlOf(viewing)}
          fileName={viewing.title}
          fileType="PDF"
        />
      )}
    </>
  );
};

export default DocumentList;
