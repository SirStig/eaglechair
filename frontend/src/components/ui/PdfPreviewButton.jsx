import { useState } from 'react';
import { Eye } from 'lucide-react';
import PDFViewerModal from './PDFViewerModal';

/**
 * "Preview" control for a document in a list: opens the file in the in-page
 * viewer (PDFs, and images such as image catalogs) so you can see what it is
 * without downloading it.
 *
 * variant: 'icon' (table action, admin), 'pill' (small labelled admin button),
 *          'link' (inline text link on the public site). className overrides
 *          the look.
 */
export default function PdfPreviewButton({
  url,
  title,
  fileType = 'PDF',
  variant = 'icon',
  label = 'Preview',
  className,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  const looks = {
    icon: 'p-2 text-dark-300 hover:text-primary-400 hover:bg-dark-700 rounded transition-colors',
    pill: 'inline-flex items-center gap-1.5 rounded-lg border border-dark-600 px-2.5 py-1 text-xs font-medium text-dark-100 hover:border-primary-500/60 hover:bg-dark-700 transition-colors',
    link: 'inline-flex items-center gap-1 underline text-slate-700 hover:text-slate-900',
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
          onOpen?.();
        }}
        className={className || looks[variant]}
        title={`${label}${title ? `: ${title}` : ''}`}
        aria-label={`${label}${title ? ` ${title}` : ''}`}
      >
        <Eye className={variant === 'icon' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {variant !== 'icon' && <span>{label}</span>}
      </button>
      <PDFViewerModal isOpen={open} onClose={() => setOpen(false)} fileUrl={url} fileName={title} fileType={fileType} />
    </>
  );
}
