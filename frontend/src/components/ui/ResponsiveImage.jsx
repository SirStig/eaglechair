import { useCallback, useMemo, useState } from 'react';
import { ensureResolvedImageUrl, getImageSrcSet } from '../../utils/apiHelpers';

/**
 * <img> with an automatic srcset built from the backend's WebP width variants
 * (`{stem}.w{320,640,1024,1600}.webp`) for uploads under /uploads/images/.
 *
 * - `src` may be raw (e.g. "/uploads/images/x.jpg" or {url}) or already
 *   resolved; it is only resolved when needed.
 * - Non-upload URLs (wp-content, /assets, svg, data:, ...) render without srcset.
 * - If a variant fails to load (e.g. not backfilled yet), the srcset is dropped
 *   and the original src is retried before the caller's onError runs.
 * - `priority` => eager + fetchpriority="high"; otherwise lazy.
 */
const ResponsiveImage = ({
  src,
  sizes,
  alt = '',
  width,
  height,
  priority = false,
  loading,
  decoding = 'async',
  fetchpriority,
  onError,
  ...rest
}) => {
  const resolvedSrc = useMemo(() => ensureResolvedImageUrl(src) || undefined, [src]);
  const srcSet = useMemo(() => getImageSrcSet(resolvedSrc), [resolvedSrc]);

  // Track which src the srcset failed for, so the fallback resets whenever src changes.
  const [failedSrc, setFailedSrc] = useState(null);
  const useSrcSet = Boolean(srcSet) && failedSrc !== resolvedSrc;

  const handleError = useCallback(
    (e) => {
      if (useSrcSet) {
        // A variant is missing: retry with the original master image only.
        setFailedSrc(resolvedSrc);
        return;
      }
      if (onError) onError(e);
    },
    [useSrcSet, resolvedSrc, onError]
  );

  const priorityAttr = fetchpriority ?? (priority ? 'high' : undefined);

  return (
    <img
      // key forces a fresh element when falling back so the browser
      // re-evaluates src without the stale srcset candidate.
      key={useSrcSet ? 'srcset' : 'src'}
      src={resolvedSrc}
      srcSet={useSrcSet ? srcSet : undefined}
      sizes={useSrcSet && sizes ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      decoding={decoding}
      fetchpriority={priorityAttr}
      onError={handleError}
      {...rest}
    />
  );
};

export default ResponsiveImage;
