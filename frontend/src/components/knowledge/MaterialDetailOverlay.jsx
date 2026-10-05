import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, m } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ChevronLeft, ChevronRight, X, ExternalLink, ZoomIn } from 'lucide-react';
import ResponsiveImage from '../ui/ResponsiveImage';
import SwatchImage from '../ui/SwatchImage';
import { resolveImageUrl } from '../../utils/apiHelpers';
import { trackMaterialView } from '../../utils/analytics';

const navBtn =
  'flex items-center justify-center w-10 h-10 rounded-full border border-cream-300 bg-white text-slate-700 hover:border-primary-500 hover:text-primary-700 disabled:opacity-40 disabled:pointer-events-none transition-colors';

/**
 * Full-detail view of one material (see materialDetails.js for the item shape).
 * Steps through `items` with the arrows or ← / → keys; Esc or the backdrop closes.
 */
const MaterialDetailOverlay = ({ items, index, onIndexChange, onClose }) => {
  const isOpen = index != null && items?.[index] != null;
  const item = isOpen ? items[index] : null;

  // Portal only after mount, so server render and hydration match
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [imageIdx, setImageIdx] = useState(0);
  useEffect(() => setImageIdx(0), [index]);

  const closeRef = useRef(null);
  const openerRef = useRef(null);
  const firstShownRef = useRef(null);

  // Focus the dialog on open and hand focus back to the card on close
  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      openerRef.current?.focus?.();
      firstShownRef.current = null;
    };
  }, [isOpen]);

  // The card tap already counts the first view; count items reached with the arrows
  useEffect(() => {
    if (!item) return;
    if (firstShownRef.current == null) {
      firstShownRef.current = item.id;
      return;
    }
    trackMaterialView(item.materialType, [item.title, item.code].filter(Boolean).join(' · '));
  }, [item]);

  const hasPrev = isOpen && index > 0;
  const hasNext = isOpen && index < items.length - 1;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1);
      else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, index, hasPrev, hasNext, onClose, onIndexChange]);

  const image = item?.images[imageIdx] || item?.images[0];

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div key="material-detail" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/70"
          />

          <m.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-detail-title"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header: position in the group, prev / next, close */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-cream-200">
              {items.length > 1 && (
                <>
                  <button type="button" onClick={() => onIndexChange(index - 1)} disabled={!hasPrev} aria-label="Previous" className={navBtn}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => onIndexChange(index + 1)} disabled={!hasNext} aria-label="Next" className={navBtn}>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-slate-500 tabular-nums">
                    {index + 1} of {items.length}
                  </span>
                </>
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto flex items-center justify-center w-10 h-10 rounded-full text-slate-500 hover:bg-cream-100 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain md:grid md:grid-cols-2 md:overflow-hidden md:flex-1 md:min-h-0">
              {/* Image */}
              <div className="md:overflow-y-auto p-3 sm:p-4 md:border-r md:border-cream-200 bg-cream-50">
                {image ? (
                  <div className={`relative aspect-square rounded-xl overflow-hidden ${item.fit === 'contain' ? 'bg-white' : 'bg-dark-900'}`}>
                    <TransformWrapper
                      key={`${item.id}-${imageIdx}`}
                      initialScale={1}
                      minScale={1}
                      maxScale={5}
                      centerOnInit
                      doubleClick={{ mode: 'toggle', step: 1.5 }}
                      wheel={{ step: 0.1 }}
                      panning={{ velocityDisabled: true }}
                    >
                      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                        <ResponsiveImage
                          src={resolveImageUrl(image.src)}
                          sizes="(min-width: 768px) 450px, 100vw"
                          alt={image.caption || item.title}
                          className={`w-full h-full ${item.fit === 'contain' ? 'object-contain p-4' : 'object-cover'}`}
                        />
                      </TransformComponent>
                    </TransformWrapper>
                    <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-[11px]">
                      <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="sm:hidden">Pinch to zoom</span>
                      <span className="hidden sm:inline">Double-click or scroll to zoom</span>
                    </span>
                  </div>
                ) : (
                  <SwatchImage item={item.swatch} size="card" rounded="lg" zoom={false} kind={item.kind} alt={item.title} className="w-full" />
                )}

                {image?.caption && <p className="mt-2 text-xs text-slate-500 text-center">{image.caption}</p>}

                {item.images.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Photos">
                    {item.images.map((img, i) => (
                      <button
                        key={img.src}
                        type="button"
                        aria-pressed={i === imageIdx}
                        aria-label={img.caption || `Photo ${i + 1}`}
                        onClick={() => setImageIdx(i)}
                        className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 bg-white ${i === imageIdx ? 'border-primary-600' : 'border-transparent hover:border-primary-300'}`}
                      >
                        <ResponsiveImage
                          src={resolveImageUrl(img.src)}
                          sizes="56px"
                          alt=""
                          className={`w-full h-full ${item.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="md:overflow-y-auto p-4 sm:p-6">
                {item.eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.eyebrow}</p>}
                <h2 id="material-detail-title" className="text-2xl font-bold text-slate-800 leading-tight mt-1">
                  {item.title}
                </h2>
                {item.code && <p className="text-sm font-mono text-primary-700 mt-1">{item.code}</p>}

                {item.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.badges.map((b) => (
                      <span key={b} className="px-2 py-0.5 text-xs bg-cream-100 text-slate-700 rounded">
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {item.facts.length > 0 && (
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {item.facts.map(([label, value]) => (
                      <div key={label} className={String(value).length > 28 ? 'col-span-2' : ''}>
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className="text-slate-800 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {item.notes.map(([heading, text]) => (
                  <section key={heading} className="mt-5">
                    <h3 className="text-sm font-semibold text-slate-800">{heading}</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{text}</p>
                  </section>
                ))}

                {item.materialType !== 'hardware' && (
                  <p className="mt-5 text-xs text-slate-500">
                    Colors on screen are approximate. Ask for a physical sample before you specify.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/contact"
                    onClick={onClose}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    {item.materialType === 'hardware' ? 'Ask about this part' : 'Request a sample'}
                  </Link>
                  {item.link && (
                    <a
                      href={item.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:border-slate-500 transition-colors"
                    >
                      {item.link.label}
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );

  return mounted ? createPortal(content, document.body) : null;
};

export default MaterialDetailOverlay;
