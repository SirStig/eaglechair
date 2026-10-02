import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import { previewPage } from '../../../../services/catalogToolsService';
import { PAGE_HEIGHT, PAGE_WIDTH } from './pageModel';

const DEBOUNCE_MS = 350;
const pct = (value, total) => `${(value / total) * 100}%`;

/**
 * Server-rendered preview of one catalog page (exactly what the PDF will
 * look like) with drag handles over the photos. Dragging moves a photo,
 * the +/- buttons or Alt+wheel scale it, arrow keys nudge it (Shift = 10pt).
 * Adjustments are reported in PDF points via onAdjust(itemIndex, {dx, dy, scale}).
 */
const PagePreview = ({ document, pageIndex, selectedItem, onSelectItem, getAdjust, onAdjust }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(null); // {index, startX, startY, dx, dy}
  const containerRef = useRef(null);

  // Re-render only when the page content (or numbering) actually changes
  const requestKey = useMemo(() => JSON.stringify(document), [document]);

  useEffect(() => {
    if (pageIndex == null || !document?.pages?.[pageIndex]) {
      setPreview(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await previewPage(JSON.parse(requestKey), pageIndex, { signal: controller.signal });
        setPreview(result);
      } catch (err) {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setError(err?.response?.data?.detail || 'Preview failed');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `document` is covered by requestKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, pageIndex]);

  const pointsPerPixel = () => PAGE_WIDTH / (containerRef.current?.clientWidth || PAGE_WIDTH);

  const adjust = (index, change) => {
    const current = getAdjust(index);
    onAdjust(index, {
      dx: Math.round((current.dx + (change.dx || 0)) * 10) / 10,
      dy: Math.round((current.dy + (change.dy || 0)) * 10) / 10,
      scale: Math.min(4, Math.max(0.2, Math.round(current.scale * (change.scaleBy || 1) * 100) / 100)),
    });
  };

  const onPointerDown = (event, index) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectItem(index);
    containerRef.current?.focus({ preventScroll: true });
    setDrag({ index, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 });
  };

  const onPointerMove = (event) => {
    if (!drag) return;
    const ratio = pointsPerPixel();
    setDrag((d) => ({ ...d, dx: (event.clientX - d.startX) * ratio, dy: (event.clientY - d.startY) * ratio }));
  };

  const onPointerUp = () => {
    if (!drag) return;
    if (Math.abs(drag.dx) > 0.5 || Math.abs(drag.dy) > 0.5) adjust(drag.index, { dx: drag.dx, dy: drag.dy });
    setDrag(null);
  };

  const onKeyDown = (event) => {
    if (selectedItem == null || !preview?.slots?.some((s) => s.item === selectedItem)) return;
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: { dx: -step }, ArrowRight: { dx: step }, ArrowUp: { dy: -step }, ArrowDown: { dy: step } };
    if (moves[event.key]) {
      event.preventDefault();
      adjust(selectedItem, moves[event.key]);
    }
  };

  const onWheel = (event, index) => {
    if (!event.altKey) return; // React wheel listeners are passive: no preventDefault
    adjust(index, { scaleBy: event.deltaY < 0 ? 1.05 : 1 / 1.05 });
  };

  const slots = preview?.slots || [];

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-[640px] shadow-2xl bg-dark-700 outline-none focus:ring-2 focus:ring-primary-500/40"
        style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
      >
        {preview?.image && (
          <img src={preview.image} alt="Page preview" className="absolute inset-0 w-full h-full select-none" draggable={false} />
        )}

        {slots.map((slot) => {
          const [x0, y0, x1, y1] = slot.rect;
          const width = x1 - x0;
          const height = y1 - y0;
          const active = selectedItem === slot.item;
          const dragging = drag?.index === slot.item;
          const ratio = 1 / pointsPerPixel();
          return (
            <div
              key={`${slot.item}-${x0}-${y0}`}
              role="button"
              tabIndex={-1}
              aria-label={`Photo ${slot.item + 1}`}
              onPointerDown={(e) => onPointerDown(e, slot.item)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => onWheel(e, slot.item)}
              className={`absolute cursor-move ${active ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-primary-400/60'}`}
              style={{
                left: pct(x0, PAGE_WIDTH),
                top: pct(y0, PAGE_HEIGHT),
                width: pct(width, PAGE_WIDTH),
                height: pct(height, PAGE_HEIGHT),
                transform: dragging ? `translate(${drag.dx * ratio}px, ${drag.dy * ratio}px)` : undefined,
                // While dragging, carry the rendered photo along with the handle
                backgroundImage: dragging && preview?.image ? `url(${preview.image})` : undefined,
                backgroundSize: `${(PAGE_WIDTH / width) * 100}% ${(PAGE_HEIGHT / height) * 100}%`,
                backgroundPosition: `${(x0 / (PAGE_WIDTH - width || 1)) * 100}% ${(y0 / (PAGE_HEIGHT - height || 1)) * 100}%`,
                opacity: dragging ? 0.85 : 1,
              }}
            >
              {active && !dragging && (
                <div
                  className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-dark-900/95 border border-dark-600 rounded-md px-1 py-0.5 shadow-lg"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Move className="w-3.5 h-3.5 text-dark-400 mx-1" />
                  <button type="button" className="p-1 text-dark-100 hover:text-primary-400" title="Smaller" onClick={() => adjust(slot.item, { scaleBy: 1 / 1.1 })}>
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 text-dark-100 hover:text-primary-400" title="Larger" onClick={() => adjust(slot.item, { scaleBy: 1.1 })}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-dark-100 hover:text-primary-400"
                    title="Reset position and size"
                    onClick={() => onAdjust(slot.item, { dx: 0, dy: 0, scale: 1 })}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {(loading || (!preview && !error)) && (
          <div className="absolute top-2 right-2 bg-dark-900/80 rounded-full p-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
          </div>
        )}
        {error && <div className="absolute inset-x-4 top-4 bg-red-900/80 text-red-100 text-sm rounded p-2">{error}</div>}
      </div>
      <p className="text-xs text-dark-400 text-center">
        {preview
          ? `Page ${preview.page_number}${preview.physical_pages > 1 ? `–${preview.page_number + preview.physical_pages - 1}` : ''} of ${preview.total_pages}. `
          : ''}
        Drag photos to move them · Alt + scroll or +/− to resize · arrow keys nudge (Shift = 10pt)
      </p>
    </div>
  );
};

export default PagePreview;
