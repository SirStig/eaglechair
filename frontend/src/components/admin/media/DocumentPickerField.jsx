import { useState } from 'react';
import { ExternalLink, FilePlus, FileText, Loader2 } from 'lucide-react';
import { resolveFileUrl } from '../../../utils/apiHelpers';
import { uploadDocument } from '../../../services/documentLibraryService';
import PdfPreviewButton from '../../ui/PdfPreviewButton';
import DocumentLibraryModal from './DocumentLibraryModal';

const ACCEPTS = {
  pdf: /\.pdf$/i,
  word: /\.docx?$/i,
  zip: /\.zip$/i,
};

/**
 * Single admin document field, the document counterpart of ImagePickerField.
 * Clicking the card (or "Choose") opens the document library, where an admin
 * can reuse any uploaded document or upload a new one; a file dropped
 * straight on the card uploads without the overlay. Removing only clears the
 * field, the file stays in the library.
 *
 * onChange receives the new URL ('' when removed). `kinds` limits what can
 * be picked or uploaded (default PDFs only).
 */
const DocumentPickerField = ({
  value,
  onChange,
  subfolder = 'general',
  label,
  help,
  kinds = ['pdf'],
  disabled = false,
  libraryTitle,
  previewTitle,
}) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const accepts = (file) => kinds.some((k) => ACCEPTS[k]?.test(file.name));
  const filename = value ? decodeURIComponent(value.split(/[?#]/)[0].split('/').pop() || value) : '';

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = Array.from(e.dataTransfer?.files || []).find(accepts);
    if (!file) {
      if (e.dataTransfer?.files?.length) setError(`Only ${kinds.map((k) => k.toUpperCase()).join(', ')} files can be used here.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadDocument(file, subfolder));
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <span className="block text-sm font-medium text-dark-200">{label}</span>}

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => setOpen(true)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        aria-label={value ? `Change ${label || 'document'}` : `Choose ${label || 'document'}`}
        className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border-2 border-dashed p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed ${
          dragOver ? 'border-primary-500' : value ? 'border-dark-600 bg-dark-700 hover:border-dark-400' : 'min-h-[8rem] justify-center border-dark-600 bg-dark-800/60 hover:border-primary-500'
        }`}
      >
        {value ? (
          <>
            <FileText className="h-8 w-8 shrink-0 text-primary-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-dark-50">{filename}</span>
              <span className="block truncate text-xs text-dark-400">{value}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-dark-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Change
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center">
            <FilePlus className="h-8 w-8 text-dark-400" />
            <span className="text-sm text-dark-200">Choose or upload</span>
            <span className="text-xs text-dark-400">Browse the document library or drop a file</span>
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-dark-950/70 text-sm text-dark-50">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </span>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[36px] items-center rounded-lg bg-dark-600 px-3 text-sm font-medium text-dark-50 transition-colors hover:bg-dark-500 disabled:opacity-50"
        >
          {value ? 'Replace…' : 'Choose document…'}
        </button>
        {value && (
          <>
            <PdfPreviewButton variant="pill" url={value} title={previewTitle || filename} />
            <a
              href={resolveFileUrl(value)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-dark-100 transition-colors hover:bg-dark-600"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange('')}
              className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/30 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {help && <p className="text-xs text-dark-300">{help}</p>}

      <DocumentLibraryModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={(url) => onChange(url)}
        subfolder={subfolder}
        kinds={kinds}
        title={libraryTitle || (label ? `Choose ${label.toLowerCase()}` : undefined)}
        selectedUrls={value ? [value] : []}
      />
    </div>
  );
};

export default DocumentPickerField;
