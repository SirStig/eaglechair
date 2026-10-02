import { useCallback, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '../ui/ProductCard';

// Fades the cards out at both viewport edges instead of hard-clipping them.
const EDGE_FADE = 'linear-gradient(to right, transparent 0, #000 clamp(24px, 6vw, 96px), #000 calc(100% - clamp(24px, 6vw, 96px)), transparent 100%)';

const shuffle = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Edge-to-edge, horizontally scrolling row of featured products.
 * Touch/trackpad users swipe; mouse users get prev/next arrows (md+).
 * Order is shuffled on each visit, after mount so SSR hydration still matches.
 */
const FeaturedProductsStrip = ({ products, onQuickView }) => {
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [ordered, setOrdered] = useState(products);

  useEffect(() => {
    setOrdered(shuffle(products));
  }, [products]);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, ordered.length]);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const arrowClass = 'hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg ring-1 ring-slate-200 transition-opacity hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className="relative w-full">
      <div
        ref={trackRef}
        className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth scrollbar-hide py-4 px-[clamp(24px,6vw,96px)] scroll-px-[clamp(24px,6vw,96px)]"
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
        role="region"
        aria-label="Featured products"
        tabIndex={0}
      >
        {ordered.map((product, index) => (
          <m.div
            key={product.id}
            className="flex-shrink-0 snap-start w-[75vw] sm:w-[300px] lg:w-[320px]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(index, 4) * 0.1 }}
          >
            <ProductCard product={product} onQuickView={onQuickView} darkMode={false} />
          </m.div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        disabled={!canPrev}
        className={`${arrowClass} left-4 lg:left-8`}
        aria-label="Scroll featured products left"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        disabled={!canNext}
        className={`${arrowClass} right-4 lg:right-8`}
        aria-label="Scroll featured products right"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};

export default FeaturedProductsStrip;
