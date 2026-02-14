import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const ImageLightboxModal = ({ isOpen, onClose, images = [], initialIndex = 0 }) => {
  const transformRef = useRef(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
  }, [isOpen, initialIndex, images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (images.length === 0) return null;

  const currentIndex = index;
  const currentSrc = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goPrev = (e) => {
    e.stopPropagation();
    if (hasPrev) setIndex((i) => i - 1);
  };

  const goNext = (e) => {
    e.stopPropagation();
    if (hasNext) setIndex((i) => i + 1);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose();
  };

  const btnClass = 'flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px] rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-lg transition-colors touch-manipulation';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white p-2 sm:p-4"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <button
            type="button"
            onClick={handleClose}
            className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-20 ${btnClass}`}
            aria-label="Close"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={!hasPrev}
                className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 ${btnClass} disabled:opacity-40 disabled:pointer-events-none`}
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!hasNext}
                className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 ${btnClass} disabled:opacity-40 disabled:pointer-events-none`}
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => transformRef.current?.zoomOut()}
              className={btnClass}
              aria-label="Zoom out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => transformRef.current?.resetTransform()}
              className="px-3 py-2 rounded-full bg-white/90 hover:bg-white text-slate-800 text-sm font-medium shadow-lg touch-manipulation"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => transformRef.current?.zoomIn()}
              className={btnClass}
              aria-label="Zoom in"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 sm:top-4 z-20 px-3 py-1.5 rounded-full bg-white/90 text-slate-800 text-sm font-medium shadow-lg">
            {currentIndex + 1} / {images.length}
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              ref={transformRef}
              key={currentIndex}
              initialScale={1}
              minScale={0.5}
              maxScale={5}
              centerOnInit
              doubleClick={{ mode: 'zoomIn', step: 0.7 }}
              wheel={{ step: 0.1 }}
              panning={{ velocityDisabled: true }}
            >
              <TransformComponent
                wrapperClass="!w-full !h-full flex items-center justify-center"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img
                  src={currentSrc}
                  alt=""
                  className="max-w-full max-h-[calc(100vh-140px)] sm:max-h-[calc(100vh-160px)] object-contain select-none"
                  draggable={false}
                  style={{ touchAction: 'none' }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageLightboxModal;
