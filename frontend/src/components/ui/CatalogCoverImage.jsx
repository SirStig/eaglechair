import { resolveApiUrl, resolveImageUrl } from '../../utils/apiHelpers';
import ResponsiveImage from './ResponsiveImage';
import ImagePlaceholder from './ImagePlaceholder';

// Stand-in cover: catalog title set on a paper texture with a spine edge
const FallbackCover = ({ title, className = '' }) => (
  <ImagePlaceholder kind="neutral" title={title} className={`w-full h-full ${className}`}>
    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-cream-500/50 to-cream-300/0" aria-hidden />
    <div className="relative flex flex-col items-center text-center px-8">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cream-700">Eagle Chair</span>
      <span className="my-3 h-px w-10 bg-primary-600/60" aria-hidden />
      <span className="font-serif text-lg sm:text-xl leading-snug text-cream-900 line-clamp-4">{title}</span>
    </div>
  </ImagePlaceholder>
);

const CatalogCoverImage = ({ catalog, className = 'aspect-[3/4]', imgClassName = '' }) => {
  const coverUrl = catalog.coverImageUrl || catalog.thumbnailUrl || catalog.thumbnail_url;
  const fileUrl = catalog.fileUrl || catalog.file_url;
  const isPdf = fileUrl?.toLowerCase().endsWith('.pdf');
  const hasCover = coverUrl || (catalog.id && isPdf);

  if (!hasCover) {
    return (
      <div className={`${className} overflow-hidden`}>
        <FallbackCover title={catalog.title} />
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden bg-cream-100 relative`}>
      <div className="absolute inset-0">
        <FallbackCover title={catalog.title} />
      </div>
      <ResponsiveImage
        src={coverUrl ? resolveImageUrl(coverUrl) : resolveApiUrl(`/api/v1/content/catalogs/${catalog.id}/pdf-thumbnail`)}
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
        alt={catalog.title}
        className={`relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${imgClassName}`}
        loading="lazy"
        decoding="async"
        onError={(e) => { e.target.style.visibility = 'hidden'; }}
      />
    </div>
  );
};

export default CatalogCoverImage;
