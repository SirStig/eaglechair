import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { trackFilter, trackMaterialView } from '../utils/analytics';

const HOVER_DWELL_MS = 1000;

/**
 * Pointer handlers for a material card (finish, fabric, laminate, hardware).
 * Records one "material viewed" event when it's tapped / clicked or hovered
 * long enough to read, so scrolling past a grid doesn't count.
 */
export function useMaterialInterest(materialType, name) {
  const sentRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const send = () => {
    if (sentRef.current) return;
    sentRef.current = true;
    trackMaterialView(materialType, name);
  };

  return {
    onClick: send,
    onPointerEnter: (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(send, HOVER_DWELL_MS);
    },
    onPointerLeave: () => clearTimeout(timerRef.current),
  };
}

/** Records what visitors search for on a materials page, once they stop typing. */
export function useTrackedQuery(facet, query) {
  const settled = useDebounce((query || '').trim().toLowerCase(), 1200);
  useEffect(() => {
    if (settled.length >= 2) trackFilter(facet, settled);
  }, [facet, settled]);
}
