import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from './Button';
import EditableWrapper from '../admin/EditableWrapper';

const SLIDE_DURATION_MS = 9000;
const FADE_DURATION_MS = 1800;

const HeroCarousel = ({ slides, onUpdateSlide, refetch, loading, renderSkeleton }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(goNext, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [slides.length, goNext]);

  if (loading && renderSkeleton) return renderSkeleton();
  if (!slides?.length) return null;

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id ?? index}
          className="absolute inset-0"
          style={{
            opacity: index === currentIndex ? 1 : 0,
            pointerEvents: index === currentIndex ? 'auto' : 'none',
            zIndex: index === currentIndex ? 2 : 1,
            transition: `opacity ${FADE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        >
          <EditableWrapper
            id={`hero-slide-${slide.id ?? index}`}
            type="hero-slide"
            data={slide}
            onSave={(newData) => onUpdateSlide(slide.id, newData)}
            refetch={refetch}
            cacheKey="hero-slides"
            label={`Slide ${index + 1}`}
          >
            <div className="relative min-h-screen pt-[var(--header-height)]">
              <img
                src={slide.background_image_url || slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover img-sharp"
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding={index === 0 ? 'sync' : 'async'}
                fetchpriority={index === 0 ? 'high' : 'auto'}
              />
              <div className="absolute inset-0 bg-black/50" />

              <div className="absolute inset-0 flex items-end justify-start pb-[22vh] pl-[5vw] sm:pl-[8vw] md:pl-[10vw] lg:pl-[12vw]">
                <div className="container">
                  <div className="max-w-2xl">
                    <motion.div
                      key={slide.id ?? index}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.7 }}
                      className="relative text-white text-left py-6 pr-8 sm:py-8 sm:pr-12"
                    >
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 sm:mb-4 leading-snug tracking-tight [text-shadow:0_0_24px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.9)]">
                        {slide.title}
                      </h1>
                      <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/95 leading-relaxed tracking-wide max-w-xl [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)]">
                        {slide.subtitle}
                      </p>
                      <div className="flex justify-start mt-5 sm:mt-6">
                        <Link to={slide.cta_link || slide.ctaLink || '#'}>
                          <Button size="lg" variant="primary" className="px-8 sm:px-10 py-3.5 text-base">
                            {slide.cta_text || slide.ctaText || slide.cta}
                          </Button>
                        </Link>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </EditableWrapper>
        </div>
      ))}
    </div>
  );
};

export default HeroCarousel;
