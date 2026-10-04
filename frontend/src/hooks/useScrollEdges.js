import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a horizontal scroller has more content to either side, and
 * returns a mask style that fades only those edges. Lets arrows or the next
 * item sit over the faded edge instead of being hard-clipped.
 *
 * Re-measures on scroll, on resize and whenever `deps` change.
 */
export function useScrollEdges({ fade = 'clamp(40px, 8vw, 72px)', deps = [] } = {}) {
  const ref = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);

  const left = canPrev ? `transparent 0, #000 ${fade}` : '#000 0';
  const right = canNext ? `#000 calc(100% - ${fade}), transparent 100%` : '#000 100%';
  const mask = `linear-gradient(to right, ${left}, ${right})`;

  return {
    ref,
    canPrev,
    canNext,
    update,
    maskStyle: canPrev || canNext ? { maskImage: mask, WebkitMaskImage: mask } : undefined,
  };
}
