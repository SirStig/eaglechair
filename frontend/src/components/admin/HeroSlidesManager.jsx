import { useCallback } from 'react';
import Modal from '../ui/Modal';
import EditableList from './EditableList';
import { ensureResolvedImageUrl } from '../../utils/apiHelpers';
import {
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
} from '../../services/cmsAdminService';

/**
 * Admin panel for the homepage hero carousel: add, edit, delete and reorder
 * slides (drag or the arrow buttons). Any number of slides is supported.
 *
 * Writes go through cmsAdminService, which refreshes the shared content
 * caches, so the carousel behind the panel updates on its own.
 */
const HeroSlidesManager = ({ isOpen, onClose, slides = [] }) => {
  // Escape inside the slide editor (or its confirm dialogs) closes that
  // dialog only, not this panel
  const handleClose = useCallback(() => {
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    onClose();
  }, [onClose]);

  const handleReorder = (reordered) => reorderHeroSlides(reordered.map((slide) => slide.id));

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Hero Slides (${slides.length})`} size="lg">
      <p className="mb-4 text-sm text-dark-200">
        Slides play in this order. Drag a slide or use the arrows to move it; changes go live right away.
      </p>
      <EditableList
        items={slides}
        onUpdate={updateHeroSlide}
        onCreate={createHeroSlide}
        onDelete={deleteHeroSlide}
        onReorder={handleReorder}
        itemType="hero-slide"
        addButtonText="Add Slide"
        defaultNewItem={{ ctaStyle: 'primary', displayOrder: slides.length }}
        className="flex flex-col gap-3"
        renderItem={(slide, index) => (
          <div className="flex items-center gap-3 rounded-lg bg-dark-700 p-2 pr-36">
            <span className="w-6 shrink-0 text-center text-sm font-semibold text-dark-200">{index + 1}</span>
            {slide.image ? (
              <img
                src={ensureResolvedImageUrl(slide.image)}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className="h-14 w-24 shrink-0 rounded object-cover bg-dark-800"
              />
            ) : (
              <div className="h-14 w-24 shrink-0 rounded bg-dark-800" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-dark-50">{slide.title || 'Untitled slide'}</div>
              {slide.subtitle && <div className="truncate text-sm text-dark-200">{slide.subtitle}</div>}
            </div>
          </div>
        )}
      />
      {slides.length === 0 && (
        <p className="py-6 text-center text-sm text-dark-200">No slides yet. The hero is hidden until you add one.</p>
      )}
    </Modal>
  );
};

export default HeroSlidesManager;
