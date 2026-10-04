import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CARD_MIN_WIDTH = 280;
const FADE = 'clamp(40px, 8vw, 72px)';

// Fades cards out only on the side(s) that still have more to scroll, so the
// arrows can float over the track instead of taking width from it.
const edgeMask = (fadeLeft, fadeRight) => {
  const left = fadeLeft ? `transparent 0, #000 ${FADE}` : '#000 0';
  const right = fadeRight ? `#000 calc(100% - ${FADE}), transparent 100%` : '#000 100%';
  return `linear-gradient(to right, ${left}, ${right})`;
};

const ProductCarousel = ({ children, className = '' }) => {
  const scrollRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const items = Array.isArray(children) ? children : [children];

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, items.length]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  const mask = edgeMask(canPrev, canNext);
  const btnClass = 'absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-800 transition-opacity disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto overflow-y-hidden py-2 scroll-smooth snap-x snap-mandatory scrollbar-hide"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {items.map((child, i) => (
          <div
            key={i}
            className="flex-shrink-0 snap-start"
            style={{ minWidth: CARD_MIN_WIDTH, maxWidth: CARD_MIN_WIDTH }}
          >
            {child}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scroll('prev')}
        disabled={!canPrev}
        className={`${btnClass} left-1`}
        aria-label="Previous"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => scroll('next')}
        disabled={!canNext}
        className={`${btnClass} right-1`}
        aria-label="Next"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ProductCarousel;
