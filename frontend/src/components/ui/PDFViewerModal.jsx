import { X, Download, ExternalLink } from 'lucide-react';
import { resolveFileUrl } from '../../utils/apiHelpers';

/**
 * PDF Viewer Modal Component
 * Displays PDF files in an iframe for in-browser viewing
 */
const PDFViewerModal = ({ isOpen, onClose, fileUrl, fileName, fileType = 'PDF' }) => {
  if (!isOpen) return null;

  const resolvedUrl = resolveFileUrl(fileUrl);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName || 'catalog.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(resolvedUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-7xl mx-4 my-4 flex flex-col bg-dark-900 rounded-lg shadow-2xl border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-dark-50 truncate max-w-md">
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
              <a href={resolvedUrl} download className="text-primary-400 hover:text-primary-300 underline ml-1">
                Click here to download the PDF
              </a>
            </p>
          </object>
        </div>

        {/* Footer with close button */}
        <div className="p-4 border-t border-dark-700 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;

