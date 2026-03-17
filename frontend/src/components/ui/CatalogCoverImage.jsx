import { Book } from 'lucide-react';
import { resolveApiUrl, resolveImageUrl } from '../../utils/apiHelpers';

const CatalogCoverImage = ({ catalog, className = 'aspect-[3/4]', imgClassName = '' }) => {
  const coverUrl = catalog.coverImageUrl || catalog.thumbnailUrl || catalog.thumbnail_url;
  const fileUrl = catalog.fileUrl || catalog.file_url;
  const isPdf = fileUrl?.toLowerCase().endsWith('.pdf');
  const hasCover = coverUrl || (catalog.id && isPdf);

  if (!hasCover) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center overflow-hidden`}>
        <Book className="w-16 h-16 text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden bg-slate-100 relative`}>
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <Book className="w-16 h-16 text-slate-400" />
      </div>
      <img
        src={coverUrl ? resolveImageUrl(coverUrl) : resolveApiUrl(`/api/v1/content/catalogs/${catalog.id}/pdf-thumbnail`)}
        alt={catalog.title}
        className={`relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${imgClassName}`}
        onError={(e) => { e.target.style.visibility = 'hidden'; }}
      />
    </div>
  );
};

export default CatalogCoverImage;
