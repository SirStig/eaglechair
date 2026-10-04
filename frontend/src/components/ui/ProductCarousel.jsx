import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollEdges } from '../../hooks/useScrollEdges';

const CARD_MIN_WIDTH = 280;

// Arrows float over the faded edges (see useScrollEdges) instead of taking
// width from the track, which matters on phones.
const ProductCarousel = ({ children, className = '' }) => {
  const items = Array.isArray(children) ? children : [children];
  const { ref: scrollRef, canPrev, canNext, maskStyle } = useScrollEdges({ deps: [items.length] });

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  const btnClass = 'absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-800 transition-opacity disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto overflow-y-hidden py-2 scroll-smooth snap-x snap-mandatory scrollbar-hide"
        style={maskStyle}
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
