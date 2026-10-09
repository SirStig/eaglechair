import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { uploadImage } from '../../../utils/imageUpload';
import MediaLibraryModal from './MediaLibraryModal';

/**
 * Ordered list of admin images (galleries, hover images, additional images).
 * "Add" opens the media library in multi-select mode; files dropped on the
 * add tile upload directly. Removing only takes the image off this list.
 *
 * value / onChange use an array of URL strings.
 */
const ImageListField = ({
  value,
  onChange,
  subfolder = 'general',
  label,
  help,
  max,
  disabled = false,
  libraryTitle,
  tileClassName = 'h-28 w-28',
}) => {
  const urls = (Array.isArray(value) ? value : []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const canAdd = !max || urls.length < max;

  const add = (incoming) => {
    const next = [...urls];
    for (const u of incoming) if (u && !next.includes(u)) next.push(u);
    onChange(max ? next.slice(0, max) : next);
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= urls.length) return;
    const next = [...urls];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(files.length);
    setError(null);
    const results = await Promise.allSettled(files.map((f) => uploadImage(f, subfolder)));
    setUploading(0);
    add(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));
    if (results.some((r) => r.status === 'rejected')) setError('Some images failed to upload');
  };

  return (
    <div className="space-y-2">
      {label && (
        <span className="block text-sm font-medium text-dark-200">
          {label} {urls.length > 0 && <span className="text-dark-400">({urls.length}{max ? `/${max}` : ''})</span>}
        </span>
      )}
      <ul className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <li key={url} className={`group relative overflow-hidden rounded-lg border border-dark-600 bg-dark-900 ${tileClassName}`}>
            <ResponsiveImage sizes="160px" fullResolution={false} src={resolveImageUrl(url)} alt="" className="h-full w-full object-contain" />
            {index === 0 && urls.length > 1 && (
              <span className="absolute left-1 top-1 rounded bg-dark-950/85 px-1.5 py-0.5 text-[10px] font-medium text-dark-100">1st</span>
            )}
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(urls.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-md bg-red-600/90 p-1 text-white opacity-90 transition-opacity hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  aria-label="Remove image"
                  title="Remove from list (file stays in the library)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {urls.length > 1 && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-90 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier" className="rounded bg-dark-950/85 p-0.5 text-dark-50 disabled:invisible">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === urls.length - 1} aria-label="Move later" className="rounded bg-dark-950/85 p-0.5 text-dark-50 disabled:invisible">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
        {canAdd && !disabled && (
          <li className={tileClassName}>
            <button
              type="button"
              onClick={() => setOpen(true)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              disabled={uploading > 0}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-dark-600 text-dark-300 transition-colors hover:border-primary-500 hover:text-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              <span className="text-xs">{uploading ? `Uploading ${uploading}…` : 'Add images'}</span>
            </button>
          </li>
        )}
      </ul>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {help && <p className="text-xs text-dark-300">{help}</p>}

      <MediaLibraryModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={add}
        multiple
        subfolder={subfolder}
        title={libraryTitle || (label ? `Add ${label.toLowerCase()}` : undefined)}
        selectedUrls={urls}
      />
    </div>
  );
};

export default ImageListField;
