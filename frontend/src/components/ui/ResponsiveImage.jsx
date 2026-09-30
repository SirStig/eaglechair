import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureResolvedImageUrl, getImageRenditions } from '../../utils/apiHelpers';

/**
 * Progressive <img> for uploads under /uploads/images/ (see getImageRenditions):
 *
 *   1. placeholder: a ~32px WebP, shown blurred right away (< 1 KB)
 *   2. sized:       the srcset width that fits the layout, fetched when the
 *                   image nears the viewport, then swapped in (blur clears)
 *   3. full:        the full-resolution rendition, swapped in afterwards when
 *                   the image is displayed larger than the largest width we
 *                   loaded (big/retina screens) or when `fullResolution` is set
 *
 * Non-upload URLs (wp-content, /assets, svg, data:, ...) render as a plain img.
 * Any missing rendition (e.g. not backfilled yet) falls back to the original,
 * and the caller's onError only runs if the original fails too.
 *
 * Props: `sizes` as for <img>; `priority` loads immediately with high fetch
 * priority (use for the LCP image); `fullResolution` = 'auto' | true | false;
 * `placeholder={false}` skips the blurred stage (use where the image sizes
 * itself from its intrinsic width, since the placeholder is only 32px wide).
 */

const LAZY_ROOT_MARGIN = '300px';
const BLUR_STYLE = { filter: 'blur(12px)' };
const SHARP_STYLE = { filter: 'none', transition: 'filter 300ms ease-out' };

const widthFromUrl = (url) => {
  const match = /\.w(\d+)\.webp(?:$|\?)/i.exec(url || '');
  return match ? Number(match[1]) : 0;
};

// Load an image off-DOM and resolve once decoded (or reject on error).
const preload = ({ src, srcSet, sizes, fetchPriority }) => {
  const img = new Image();
  img.decoding = 'async';
  // Off-DOM images always fetch at low priority unless told otherwise
  if (fetchPriority) img.fetchPriority = fetchPriority;
  if (sizes) img.sizes = sizes;
  if (srcSet) img.srcset = srcSet;
  img.src = src;
  const done = img.decode ? img.decode() : new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  return done.then(() => img);
};

const ResponsiveImage = ({
  src,
  sizes,
  alt = '',
  width,
  height,
  priority = false,
  fullResolution = 'auto',
  placeholder = true,
  loading,
  decoding = 'async',
  fetchpriority,
  onError,
  style,
  ...rest
}) => {
  const resolvedSrc = useMemo(() => ensureResolvedImageUrl(src) || undefined, [src]);
  const renditions = useMemo(() => getImageRenditions(resolvedSrc), [resolvedSrc]);

  // placeholder -> sized -> full, or 'original' when renditions are missing.
  // Tied to the src it belongs to so a new src starts over in the same render.
  const initialStage = !renditions ? 'original' : placeholder ? 'placeholder' : 'sized';
  const [state, setState] = useState({ forSrc: resolvedSrc, stage: initialStage, stageSrc: resolvedSrc });
  if (state.forSrc !== resolvedSrc) {
    setState({ forSrc: resolvedSrc, stage: initialStage, stageSrc: resolvedSrc });
  }
  const current = state.forSrc === resolvedSrc ? state : { stage: initialStage, stageSrc: resolvedSrc };
  const { stage, stageSrc } = current;
  const setStage = useCallback(
    (next, nextSrc) => setState((prev) => (
      prev.forSrc === resolvedSrc
        ? { ...prev, stage: next, stageSrc: nextSrc ?? prev.stageSrc }
        : prev
    )),
    [resolvedSrc]
  );
  const imgRef = useRef(null);

  // Stage 1 -> 2: fetch the sized rendition once the image is (nearly) visible
  useEffect(() => {
    if (!renditions || stage !== 'placeholder') return undefined;
    let cancelled = false;

    const start = () => {
      preload({
        src: resolvedSrc,
        srcSet: renditions.srcSet,
        sizes,
        fetchPriority: priority ? 'high' : undefined,
      })
        .then(() => { if (!cancelled) setStage('sized'); })
        .catch(() => { if (!cancelled) setStage('original'); });
    };

    const el = imgRef.current;
    if (priority || !el || typeof IntersectionObserver === 'undefined') {
      start();
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: LAZY_ROOT_MARGIN });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [renditions, stage, resolvedSrc, sizes, priority, setStage]);

  // Stage 2 -> 3: upgrade to full resolution when the loaded width falls short.
  // The browser picks the smallest srcset width that covers the display, so a
  // shortfall is only possible once it has picked the largest one.
  const maybeUpgrade = useCallback(() => {
    const el = imgRef.current;
    if (!renditions || !el || fullResolution === false) return;
    const loadedUrl = el.currentSrc;
    const loadedWidth = widthFromUrl(loadedUrl);
    if (fullResolution !== true) {
      const neededWidth = el.clientWidth * (window.devicePixelRatio || 1);
      const largest = renditions.widths[renditions.widths.length - 1];
      if (loadedWidth < largest || neededWidth <= loadedWidth * 1.1) return;
    }

    // el.naturalWidth is density-corrected when srcset is used, so check the
    // file's real pixel width (already cached): renditions of a small original
    // are saved at native size, in which case there is nothing more to fetch.
    const realWidth = loadedWidth
      ? preload({ src: loadedUrl }).then((img) => img.naturalWidth).catch(() => 0)
      : Promise.resolve(0);
    realWidth
      .then((pixels) => {
        if (fullResolution !== true && pixels && pixels < loadedWidth) return null;
        return preload({ src: renditions.full }).then(() => {
          if (imgRef.current === el) setStage('full', renditions.full);
        });
      })
      .catch(() => { /* keep the sized rendition */ });
  }, [renditions, fullResolution, setStage]);

  const handleLoad = (e) => {
    if (stage === 'sized') maybeUpgrade();
    if (rest.onLoad) rest.onLoad(e);
  };

  const handleError = (e) => {
    if (stage === 'placeholder') {
      // No placeholder on disk: go straight for the real image
      setStage('original');
      return;
    }
    if (stage === 'sized' || stage === 'full') {
      setStage('original', resolvedSrc);
      return;
    }
    if (onError) onError(e);
  };

  let imgSrc = stageSrc;
  let imgSrcSet;
  let stageStyle;
  if (stage === 'placeholder') {
    imgSrc = renditions.placeholder;
    stageStyle = BLUR_STYLE;
  } else if (stage === 'sized') {
    imgSrcSet = renditions.srcSet;
    stageStyle = SHARP_STYLE;
  } else if (stage === 'full') {
    stageStyle = SHARP_STYLE;
  }

  // Renditions are only rendered after they've been fetched (so eager is free);
  // the original fallback may still be offscreen, so leave it to native lazy loading.
  const eager = priority || stage === 'sized' || stage === 'full';

  return (
    <img
      {...rest}
      ref={imgRef}
      src={imgSrc}
      srcSet={imgSrcSet}
      sizes={imgSrcSet && sizes ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={loading ?? (eager ? 'eager' : 'lazy')}
      decoding={decoding}
      fetchpriority={fetchpriority ?? (priority ? 'high' : undefined)}
      style={stageStyle ? { ...style, ...stageStyle } : style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

export default ResponsiveImage;
