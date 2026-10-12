import { useEffect, useState } from 'react';
import { resolveApiUrl, resolveImageUrl } from '../../utils/apiHelpers';
import ResponsiveImage from './ResponsiveImage';
import ImagePlaceholder from './ImagePlaceholder';
import { FileText } from 'lucide-react';

// Stand-in cover: catalog title set on a paper texture with a spine edge.
// `compact` (thumbnail-sized) shows a document icon instead of the unreadable title.
const FallbackCover = ({ title, className = '', compact = false }) => compact ? (
  <div className={`w-full h-full flex items-center justify-center bg-cream-100 text-cream-700 ${className}`}>
    <FileText className="w-1/2 h-1/2" aria-hidden />
  </div>
) : (
  <ImagePlaceholder kind="neutral" title={title} className={`w-full h-full ${className}`}>
    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-cream-500/50 to-cream-300/0" aria-hidden />
    <div className="relative flex flex-col items-center text-center px-8">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cream-700">Eagle Chair</span>
      <span className="my-3 h-px w-10 bg-primary-600/60" aria-hidden />
      <span className="font-serif text-lg sm:text-xl leading-snug text-cream-900 line-clamp-4">{title}</span>
    </div>
  </ImagePlaceholder>
);

// Rendered first page of the PDF: by file URL for uploads, by catalog id for
// legacy rows that store only a filename.
const pdfCoverUrl = (catalog, fileUrl) => {
  if (!fileUrl?.split('?')[0].toLowerCase().endsWith('.pdf')) return null;
  if (fileUrl.includes('/uploads/documents/')) {
    return resolveApiUrl(`/api/v1/content/document-cover?url=${encodeURIComponent(fileUrl)}`);
  }
  return catalog.id ? resolveApiUrl(`/api/v1/content/catalogs/${catalog.id}/pdf-thumbnail`) : null;
};

const CatalogCoverImage = ({ catalog, className = 'aspect-[3/4]', imgClassName = '', compact = false }) => {
  const coverUrl = catalog.coverImageUrl || catalog.thumbnailUrl || catalog.thumbnail_url;
  const fileUrl = catalog.fileUrl || catalog.file_url;
  // Uploaded cover first, then the rendered PDF page, then the stand-in cover
  const sources = [coverUrl && resolveImageUrl(coverUrl), pdfCoverUrl(catalog, fileUrl)].filter(Boolean);
  const sourcesKey = sources.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [sourcesKey]);
  const src = sources[index];

  if (!src) {
    return (
      <div className={`${className} overflow-hidden`}>
        <FallbackCover title={catalog.title} compact={compact} />
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden bg-cream-100 relative`}>
      <div className="absolute inset-0">
        <FallbackCover title={catalog.title} compact={compact} />
      </div>
      <ResponsiveImage
        key={src}
        src={src}
        sizes={compact ? '48px' : '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw'}
        alt={catalog.title}
        className={`relative z-10 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300 ${imgClassName}`}
        loading="lazy"
        decoding="async"
        onError={() => setIndex((i) => i + 1)}
      />
    </div>
  );
};

export default CatalogCoverImage;
