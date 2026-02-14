import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CARD_MIN_WIDTH = 280;

const ProductCarousel = ({ children, className = '' }) => {
  const scrollRef = useRef(null);
  const items = Array.isArray(children) ? children : [children];

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  const btnClass = 'flex-shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-cream-50 hover:text-slate-800 transition z-10';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => scroll('prev')}
          className={btnClass}
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto overflow-y-hidden py-2 min-w-0 flex-1 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'thin' }}
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
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => scroll('next')}
          className={btnClass}
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default ProductCarousel;
