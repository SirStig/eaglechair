import { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { uploadImage } from '../../../utils/imageUpload';
import MediaLibraryModal from './MediaLibraryModal';

const CHECKER =
  'bg-dark-900 bg-[length:16px_16px] bg-[linear-gradient(45deg,#1f1f1f_25%,transparent_25%),linear-gradient(-45deg,#1f1f1f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f1f_75%),linear-gradient(-45deg,transparent_75%,#1f1f1f_75%)]';

/**
 * Single admin image field. Clicking the preview (or "Choose") opens the
 * media library, where an admin can reuse any uploaded image or upload a new
 * one; a file dropped straight on the preview uploads without the overlay.
 * Removing only clears the field, the file stays in the library.
 *
 * onChange receives the new URL ('' when removed).
 */
const ImagePickerField = ({
  value,
  onChange,
  subfolder = 'general',
  label,
  help,
  previewClassName = 'h-40 w-full',
  objectFit = 'contain',
  disabled = false,
  libraryTitle,
}) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
    if (!file || disabled) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file, subfolder));
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
        aria-label={value ? `Change ${label || 'image'}` : `Choose ${label || 'image'}`}
        className={`group relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed ${
          dragOver ? 'border-primary-500' : value ? 'border-dark-600 hover:border-dark-400' : 'border-dark-600 hover:border-primary-500'
        } ${value ? CHECKER : 'bg-dark-800/60'} ${previewClassName}`}
      >
        {value ? (
          <>
            <ResponsiveImage
              sizes="448px"
              fullResolution={false}
              src={resolveImageUrl(value)}
              alt=""
              className={`h-full w-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-dark-950/60 text-sm font-medium text-dark-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Change image
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center">
            <ImagePlus className="h-8 w-8 text-dark-400" />
            <span className="text-sm text-dark-200">Choose or upload</span>
            <span className="text-xs text-dark-400">Browse the library or drop a file</span>
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
          {value ? 'Replace…' : 'Choose image…'}
        </button>
        {value && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => onChange('')}
            className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/30 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {help && <p className="text-xs text-dark-300">{help}</p>}

      <MediaLibraryModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={(url) => onChange(url)}
        subfolder={subfolder}
        title={libraryTitle || (label ? `Choose ${label.toLowerCase()}` : undefined)}
        selectedUrls={value ? [value] : []}
      />
    </div>
  );
};

export default ImagePickerField;
