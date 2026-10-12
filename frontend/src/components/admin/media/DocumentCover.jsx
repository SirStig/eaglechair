import { useEffect, useState } from 'react';
import { resolveApiUrl, resolveImageUrl } from '../../../utils/apiHelpers';

/**
 * Cover image for a document library item. Tries the uploaded cover
 * (cover_url), then the rendered first page of the PDF (preview_url), and
 * renders `fallback` (the file icon) when neither exists or both fail to load.
 */
const coverSources = (item) => [
  item?.cover_url && resolveImageUrl(item.cover_url),
  item?.preview_url && resolveApiUrl(item.preview_url),
].filter(Boolean);

export default function DocumentCover({ item, fallback = null, className = '', ...rest }) {
  const sources = coverSources(item);
  const key = sources.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [key]);

  if (index >= sources.length) return fallback;
  return (
    <img
      key={sources[index]}
      src={sources[index]}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setIndex((i) => i + 1)}
      {...rest}
    />
  );
}
