import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import Button from './Button';
import EditableWrapper from '../admin/EditableWrapper';
import ResponsiveImage from './ResponsiveImage';
import { ensureResolvedImageUrl } from '../../utils/apiHelpers';
import { safeHref } from '../../utils/safeUrl';

const SLIDE_DURATION_MS = 9000;
const FADE_DURATION_MS = 1800;
const CTA_VARIANTS = new Set(['primary', 'secondary', 'outline']);

const HeroCarousel = ({ slides, onUpdateSlide, loading, renderSkeleton }) => {
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

  const nextIndex = (currentIndex + 1) % slides.length;
  const prevIndex = (currentIndex - 1 + slides.length) % slides.length;

  return (
    <div className="relative w-full h-screen h-[100dvh] overflow-hidden">
      {slides.map((slide, index) => {
        // Only mount the image for the first, current, upcoming and outgoing
        // (still fading) slides, so hidden slides don't all download upfront.
        const mountImage = index === 0 || index === currentIndex || index === nextIndex || index === prevIndex;
        const imageSrc = slide.background_image_url || slide.image;
        // CMS links only render when they pass the URL policy
        const ctaText = slide.cta_text || slide.ctaText || slide.cta;
        const ctaLink = safeHref(slide.cta_link || slide.ctaLink);
        const ctaStyle = slide.cta_style || slide.ctaStyle;
        const ctaVariant = CTA_VARIANTS.has(ctaStyle) ? ctaStyle : 'primary';
        const secondaryText = slide.secondary_cta_text || slide.secondaryCtaText;
        const secondaryLink = safeHref(slide.secondary_cta_link || slide.secondaryCtaLink);
        return (
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
            label={`Slide ${index + 1}`}
            className="w-full h-full"
          >
            <div className="relative w-full h-full min-h-full pt-[var(--header-height)]">
              {mountImage && imageSrc && (
                <ResponsiveImage
                  src={ensureResolvedImageUrl(imageSrc)}
                  sizes="100vw"
                  alt={slide.title}
                  className="absolute inset-0 w-full h-full min-w-full min-h-full object-cover object-center img-sharp"
                  priority={index === 0}
                />
              )}
              <div className="absolute inset-0 bg-black/50" />

              <div className="absolute inset-0 flex items-end justify-start pb-[22vh] pl-[5vw] sm:pl-[8vw] md:pl-[10vw] lg:pl-[12vw]">
                <div className="container">
                  <div className="max-w-2xl">
                    <m.div
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
                      <div className="flex flex-wrap justify-start gap-3 mt-5 sm:mt-6">
                        {ctaText && (
                          <Link to={ctaLink || '#'}>
                            <Button size="lg" variant={ctaVariant} className="px-8 sm:px-10 py-3.5 text-base">
                              {ctaText}
                            </Button>
                          </Link>
                        )}
                        {secondaryText && secondaryLink && (
                          <Link to={secondaryLink}>
                            <Button size="lg" variant="outline" className="px-8 sm:px-10 py-3.5 text-base">
                              {secondaryText}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </m.div>
                  </div>
                </div>
              </div>
            </div>
          </EditableWrapper>
        </div>
        );
      })}
    </div>
  );
};

export default HeroCarousel;
