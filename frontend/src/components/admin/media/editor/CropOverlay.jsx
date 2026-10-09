import { useRef } from 'react';
import { constrainRect } from './imageOps';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_POS = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

/** New rect after dragging `handle` by (dx, dy) image px, keeping `aspect` when set. */
function resizeRect(start, handle, dx, dy, aspect) {
  let { x, y, width: w, height: h } = start;
  const right = x + w;
  const bottom = y + h;
  if (handle.includes('e')) w = start.width + dx;
  if (handle.includes('w')) w = start.width - dx;
  if (handle.includes('s')) h = start.height + dy;
  if (handle.includes('n')) h = start.height - dy;
  if (aspect) {
    // Edge handles drive one side; corners follow the larger change
    if (handle === 'n' || handle === 's') w = h * aspect;
    else if (handle === 'e' || handle === 'w') h = w / aspect;
    else if (Math.abs(w - start.width) / aspect > Math.abs(h - start.height)) h = w / aspect;
    else w = h * aspect;
  }
  w = Math.max(8, w);
  h = Math.max(8, h);
  if (handle.includes('w')) x = right - w;
  if (handle.includes('n')) y = bottom - h;
  if (aspect && (handle === 'n' || handle === 's')) x = start.x + (start.width - w) / 2;
  if (aspect && (handle === 'e' || handle === 'w')) y = start.y + (start.height - h) / 2;
  return { x, y, width: w, height: h };
}

/**
 * Crop box over the displayed image. `rect` is in image pixels; `scale` maps
 * image px to display px and `offset` is the image's top-left on screen.
 */
export default function CropOverlay({ rect, onChange, scale, offset, imageWidth, imageHeight, aspect }) {
  const drag = useRef(null);

  const start = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, rect };
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / scale;
    const dy = (e.clientY - d.y) / scale;
    let next;
    if (d.mode === 'move') {
      next = { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy };
      onChange(constrainRect(next, imageWidth, imageHeight));
      return;
    }
    next = resizeRect(d.rect, d.mode, dx, dy, aspect);
    // Clamp to the image without breaking the aspect
    if (next.x < 0) {
      next.width += next.x;
      next.x = 0;
    }
    if (next.y < 0) {
      next.height += next.y;
      next.y = 0;
    }
    next.width = Math.min(next.width, imageWidth - next.x);
    next.height = Math.min(next.height, imageHeight - next.y);
    onChange(constrainRect(next, imageWidth, imageHeight, { aspect }));
  };

  const end = () => {
    drag.current = null;
  };

  const style = {
    left: offset.x + rect.x * scale,
    top: offset.y + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };

  return (
    <div className="absolute inset-0 touch-none" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div
        className="absolute cursor-move border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
        style={style}
        onPointerDown={start('move')}
        role="presentation"
      >
        {/* Rule-of-thirds guides */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
        </div>
        {HANDLES.map((h) => (
          <span
            key={h}
            onPointerDown={start(h)}
            className={`absolute h-4 w-4 rounded-sm border-2 border-white bg-primary-500 sm:h-3 sm:w-3 ${HANDLE_POS[h]}`}
          />
        ))}
        <span className="pointer-events-none absolute -top-7 left-0 whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white">
          {Math.round(rect.width)} × {Math.round(rect.height)}
        </span>
      </div>
    </div>
  );
}
