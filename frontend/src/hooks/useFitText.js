import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * useFitText Hook
 *
 * Shrinks an element's font size until its text fits the space it has,
 * within `maxLines` lines. Long single words ("Booths/Banquettes") overflow
 * a narrow column at a fixed font size and get clipped; this measures the
 * real rendered size and picks the largest font size that still fits.
 *
 * Re-measures when the containing column resizes (column count changes,
 * window resize) or the text changes.
 *
 * @param {string} text - The text being rendered (re-fits when it changes)
 * @param {Object} options
 * @param {number} options.min - Smallest allowed font size in px
 * @param {number} options.max - Largest allowed font size in px
 * @param {number} options.maxLines - Lines the text may wrap onto
 * @param {number} options.lineHeight - Line height as a multiple of font size
 * @returns {{ref: Object, fontSize: number, lineHeight: number}}
 */
export function useFitText(text, { min = 14, max = 30, maxLines = 2, lineHeight = 1.15 } = {}) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(max);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;

    const fits = (size) => {
      el.style.fontSize = `${size}px`;
      return (
        el.scrollWidth <= el.clientWidth + 0.5 &&
        el.scrollHeight <= size * lineHeight * maxLines + 0.5
      );
    };

    // Binary search for the largest size that fits, to half-pixel precision
    let low = min;
    let high = max;
    let best = min;

    while (high - low > 0.5) {
      const mid = (low + high) / 2;
      if (fits(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    if (fits(high)) best = high;

    const rounded = Math.round(best * 100) / 100;
    // Apply directly as well as through state: when the value is unchanged
    // React won't re-render, and the element must keep the measured size.
    el.style.fontSize = `${rounded}px`;
    setFontSize(rounded);
  }, [min, max, maxLines, lineHeight]);

  useLayoutEffect(() => {
    fit();
  }, [fit, text]);

  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    // Observe the container, not the text element: measuring changes the
    // text element's own height, which would retrigger the observer.
    // lastWidth starts unset so the first callback always re-fits.
    let lastWidth = null;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === lastWidth) return;
      lastWidth = container.clientWidth;
      fit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    // The first measurement can run against a fallback font whose metrics
    // differ from the web font, so re-fit once the real fonts are ready.
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [fit]);

  return { ref, fontSize, lineHeight };
}

export default useFitText;
