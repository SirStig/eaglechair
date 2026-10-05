import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink } from 'lucide-react';
import { resolveFileUrl } from '../../utils/apiHelpers';
import { trackCatalogRead } from '../../utils/analytics';

/**
 * Reports how long a document stays open (visible tab time only). The PDF is
 * rendered by the browser's own viewer, so pages turned can't be seen.
 */
function useReadingTime(isOpen, title) {
  useEffect(() => {
    if (!isOpen || !title) return undefined;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    let ms = 0;
    const report = () => {
      if (visibleSince !== null) {
        ms += Date.now() - visibleSince;
        visibleSince = null;
      }
      trackCatalogRead(title, ms / 1000);
      ms = 0;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report();
      else if (visibleSince === null) visibleSince = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', report);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', report);
      report();
    };
  }, [isOpen, title]);
}

/**
 * PDF Viewer Modal Component
 * Displays PDF files in an iframe for in-browser viewing
 */
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i;

const PDFViewerModal = ({ isOpen, onClose, fileUrl, fileName, fileType = 'PDF' }) => {
  useReadingTime(isOpen, fileName);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const resolvedUrl = resolveFileUrl(fileUrl);
  const isImage = String(fileType).toUpperCase() === 'IMAGE' || IMAGE_FILE.test(resolvedUrl || '');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName || 'catalog.pdf';
    link.dataset.trackIgnore = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(resolvedUrl, '_blank');
  };

  // Portalled to <body> so a transformed / overflow-clipped ancestor (admin
  // layout, table rows) can't trap the fixed overlay
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={fileName || 'Document preview'}
    >
      <div className="relative flex h-full w-full max-w-7xl flex-col rounded-lg border border-dark-700 bg-dark-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-base font-semibold text-dark-50 sm:text-xl">
              {fileName || 'PDF Viewer'}
            </h2>
            <span className="text-xs text-dark-400 bg-dark-800 px-2 py-1 rounded">
              {fileType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="p-2 text-dark-300 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-dark-300 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 relative overflow-hidden">
          {isImage ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto bg-dark-950 p-4">
              <img src={resolvedUrl} alt={fileName || ''} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
          <object
            data={resolvedUrl}
            type="application/pdf"
            className="w-full h-full border-0"
            style={{ minHeight: '600px' }}
          >
            <iframe
              src={resolvedUrl}
              className="w-full h-full border-0"
              title={fileName || 'PDF Viewer'}
              style={{ minHeight: '600px' }}
            />
            <p className="text-dark-300 p-4">
              Your browser does not support PDFs. 
              <a href={resolvedUrl} download data-track-ignore className="text-primary-400 hover:text-primary-300 underline ml-1">
                Click here to download the PDF
              </a>
            </p>
          </object>
          )}
        </div>

        {/* Footer with close button */}
        <div className="hidden p-3 border-t border-dark-700 sm:flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PDFViewerModal;

