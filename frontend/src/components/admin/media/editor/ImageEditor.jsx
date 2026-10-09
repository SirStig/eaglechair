import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronDown, Copy, Crop, Download, Eraser, Eye, FlipHorizontal2, FlipVertical2, Frame,
  Loader2, Lock, Redo2, RotateCcw, RotateCw, Save, Scaling, SlidersHorizontal, Sparkles, Undo2, Unlock,
  WandSparkles, X,
} from 'lucide-react';
import CropOverlay from './CropOverlay';
import {
  DEFAULT_ADJUSTMENTS, applyAdjustments, applyPixels, blobToCanvas, borderSeeds, canvasToBlob,
  centeredAspectRect, contentBounds, crop, dominantBorderColor, eraseSimilar, flip, fromPixels,
  hasTransparency, isNeutral, placeOnCanvas, previewCopy, readPixels, resize, rotate90, rotateFree,
} from './imageOps';
import { fetchImageBlob, getMediaCapabilities, removeBackground, replaceMedia } from '../../../../services/mediaManagerService';
import { uploadImage } from '../../../../utils/imageUpload';
import { errorText } from '../mediaFormat';

const MAX_UNDO = 20;

const TOOLS = [
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
  { id: 'background', label: 'Background', icon: Eraser },
  { id: 'resize', label: 'Resize', icon: Scaling },
  { id: 'canvas', label: 'Canvas', icon: Frame },
];

const ASPECTS = [
  { id: 'free', label: 'Free', value: null },
  { id: 'original', label: 'Original', value: 'original' },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '3:2', label: '3:2', value: 3 / 2 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
];

const CANVAS_ASPECTS = ASPECTS.filter((a) => a.id !== 'original').map((a) => (a.id === 'free' ? { ...a, label: 'Fit' } : a));

const ADJUST_SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
];

const PRESETS = [
  { label: 'Original', adj: {} },
  { label: 'Brighten', adj: { brightness: 12, contrast: 8, shadows: 15 } },
  { label: 'Punchy', adj: { contrast: 22, saturation: 18, sharpen: 25 } },
  { label: 'Clean white', adj: { exposure: 10, highlights: 25, contrast: 6 } },
  { label: 'Warm', adj: { warmth: 25, saturation: 6 } },
  { label: 'Cool', adj: { warmth: -25 } },
  { label: 'B&W', adj: { grayscale: true, contrast: 15 } },
  { label: 'Sepia', adj: { sepia: true } },
];

const FORMATS = [
  { id: 'original', label: 'Same as original' },
  { id: 'image/png', label: 'PNG (keeps transparency)' },
  { id: 'image/jpeg', label: 'JPEG (smallest photos)' },
  { id: 'image/webp', label: 'WebP' },
];

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const EDITABLE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const PREVIEW_BACKGROUNDS = {
  checker: 'bg-[length:20px_20px] bg-[linear-gradient(45deg,#2a2a2a_25%,transparent_25%),linear-gradient(-45deg,#2a2a2a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#2a2a2a_75%),linear-gradient(-45deg,transparent_75%,#2a2a2a_75%)] bg-dark-800',
  white: 'bg-white',
  dark: 'bg-black',
};

const baseName = (filename = 'image') => filename.replace(/\.[^.]+$/, '').replace(/(_\d{9,11})(_[0-9a-f]{6})?$/, '') || 'image';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-dark-200">
        <span>{label}</span>
        <button
          type="button"
          className="tabular-nums text-dark-100 hover:text-primary-400"
          onDoubleClick={() => onChange(min < 0 ? 0 : min)}
          title="Double-click to reset"
        >
          {value > 0 && min < 0 ? '+' : ''}{value}{suffix}
        </button>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(min < 0 ? 0 : min)}
        className="w-full accent-primary-500"
      />
    </label>
  );
}

function Chip({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        active ? 'border-primary-500 bg-primary-500/15 text-primary-300' : 'border-dark-500 text-dark-100 hover:border-dark-300 hover:text-dark-50'
      }`}
    >
      {children}
    </button>
  );
}

function ActionButton({ icon: Icon, children, onClick, disabled, primary = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? 'bg-primary-500 text-dark-900 hover:bg-primary-400' : 'bg-dark-600 text-dark-50 hover:bg-dark-500'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

const Section = ({ title, children, hint }) => (
  <div className="space-y-2.5 border-b border-dark-600 px-4 py-4 last:border-0">
    {title && <h3 className="text-[11px] font-semibold uppercase tracking-wider text-dark-300">{title}</h3>}
    {children}
    {hint && <p className="text-[11px] leading-relaxed text-dark-300">{hint}</p>}
  </div>
);

/**
 * Built-in image editor (full screen). Crop, rotate / flip / straighten,
 * tone and colour adjustments, background removal (white-backdrop and AI on
 * the server, colour / magic eraser in the browser), resize and canvas
 * padding. Saves as a new version of the image (records follow it, the old
 * file is kept), as a separate copy, or downloads.
 *
 * onSaved({ url, mode: 'version' | 'copy' }) after a save.
 */
export default function ImageEditor({ isOpen, onClose, url, filename, folder = 'general', canReplace = true, onSaved }) {
  const [history, setHistory] = useState({ items: [], index: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tool, setTool] = useState('crop');
  const [sourceType, setSourceType] = useState('image/png');
  const [aiAvailable, setAiAvailable] = useState(false);

  const [cropRect, setCropRect] = useState(null);
  const [cropAspect, setCropAspect] = useState('free');
  const [straighten, setStraighten] = useState(0);
  const [adjust, setAdjust] = useState(DEFAULT_ADJUSTMENTS);
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [padding, setPadding] = useState(0);
  const [canvasAspect, setCanvasAspect] = useState('free');
  const [fillMode, setFillMode] = useState('transparent');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(18);
  const [contiguous, setContiguous] = useState(true);
  const [eraser, setEraser] = useState(false);

  const [compare, setCompare] = useState(false);
  const [previewBg, setPreviewBg] = useState('checker');
  const [saveOpen, setSaveOpen] = useState(false);
  const [format, setFormat] = useState('original');
  const [quality, setQuality] = useState(90);
  const [confirmClose, setConfirmClose] = useState(false);

  const stageRef = useRef(null);
  const displayRef = useRef(null);
  const originalRef = useRef(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const current = history.items[history.index] || null;
  const canUndo = history.index > 0;
  const canRedo = history.index < history.items.length - 1;

  // ---- load ---------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !url) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotice(null);
    setError(null);
    setHistory({ items: [], index: 0 });
    setTool('crop');
    setAdjust(DEFAULT_ADJUSTMENTS);
    setStraighten(0);
    setPadding(0);
    setCanvasAspect('free');
    setFillMode('transparent');
    setEraser(false);
    setFormat('original');
    setSaveOpen(false);
    setConfirmClose(false);
    (async () => {
      try {
        const blob = await fetchImageBlob(url);
        const type = (blob.type || '').toLowerCase();
        if (!EDITABLE_TYPES.includes(type)) throw new Error('Only JPEG, PNG and WebP images can be edited.');
        const { canvas, downscaled, original } = await blobToCanvas(blob);
        if (cancelled) return;
        originalRef.current = canvas;
        setSourceType(type);
        setHistory({ items: [canvas], index: 0 });
        if (downscaled) {
          setNotice(`This image is ${original.width} × ${original.height}; it was reduced to ${canvas.width} × ${canvas.height} for editing.`);
        }
      } catch (err) {
        if (!cancelled) setLoadError(await errorText(err, 'Could not open the image'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    getMediaCapabilities().then((c) => !cancelled && setAiAvailable(Boolean(c?.ai_background_removal))).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, url]);

  // Reset per-tool inputs when the image changes
  useEffect(() => {
    if (!current) return;
    setCropRect({ x: 0, y: 0, width: current.width, height: current.height });
    setCropAspect('free');
    setResizeW(current.width);
    setResizeH(current.height);
  }, [current]);

  // ---- stage size ---------------------------------------------------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !isOpen) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, loading]);

  // ---- history ------------------------------------------------------------
  const push = useCallback((canvas) => {
    setHistory((prev) => {
      let items = [...prev.items.slice(0, prev.index + 1), canvas];
      if (items.length > MAX_UNDO) items = items.slice(items.length - MAX_UNDO);
      return { items, index: items.length - 1 };
    });
  }, []);

  const undo = useCallback(() => setHistory((p) => ({ ...p, index: Math.max(0, p.index - 1) })), []);
  const redo = useCallback(() => setHistory((p) => ({ ...p, index: Math.min(p.items.length - 1, p.index + 1) })), []);

  // ---- pending (live-previewed) edits ---------------------------------------
  const previewBase = useMemo(() => (current ? previewCopy(current) : null), [current]);

  const canvasOptions = useMemo(() => ({
    padding,
    aspect: CANVAS_ASPECTS.find((a) => a.id === canvasAspect)?.value || null,
    fill: fillMode === 'transparent' ? null : fillMode === 'white' ? '#ffffff' : fillColor,
  }), [padding, canvasAspect, fillMode, fillColor]);

  const canvasPending = padding > 0 || canvasOptions.aspect || canvasOptions.fill;
  const cropPending = Boolean(current && cropRect && (cropRect.width !== current.width || cropRect.height !== current.height));
  const resizePending = Boolean(current && (resizeW !== current.width || resizeH !== current.height) && resizeW > 0 && resizeH > 0);

  const pending = useMemo(() => {
    if (tool === 'crop') return cropPending;
    if (tool === 'rotate') return straighten !== 0;
    if (tool === 'adjust') return !isNeutral(adjust);
    if (tool === 'resize') return resizePending;
    if (tool === 'canvas') return Boolean(canvasPending);
    return false;
  }, [tool, cropPending, straighten, adjust, resizePending, canvasPending]);

  const shown = useMemo(() => {
    if (!current) return null;
    if (compare) return originalRef.current;
    if (tool === 'adjust' && !isNeutral(adjust)) return fromPixels(applyAdjustments(readPixels(previewBase), adjust));
    if (tool === 'rotate' && straighten) return rotateFree(previewBase, straighten);
    if (tool === 'canvas' && canvasPending) return placeOnCanvas(previewBase, canvasOptions);
    return current;
  }, [current, compare, tool, adjust, previewBase, straighten, canvasPending, canvasOptions]);

  /** Full-resolution result of the open tool's pending edit, or null. */
  const pendingResult = useCallback(() => {
    if (!current || !pending) return null;
    if (tool === 'crop') return crop(current, cropRect);
    if (tool === 'rotate') return rotateFree(current, straighten);
    if (tool === 'adjust') return fromPixels(applyAdjustments(readPixels(current), adjust));
    if (tool === 'resize') return resize(current, resizeW, resizeH);
    if (tool === 'canvas') return placeOnCanvas(current, canvasOptions);
    return null;
  }, [current, pending, tool, cropRect, straighten, adjust, resizeW, resizeH, canvasOptions]);

  const resetPending = useCallback(() => {
    setStraighten(0);
    setAdjust(DEFAULT_ADJUSTMENTS);
    setPadding(0);
    setCanvasAspect('free');
    setFillMode('transparent');
  }, []);

  /** Apply the open tool's pending edit; returns the canvas that is now current. */
  const applyPending = useCallback(async () => {
    const result = pendingResult();
    if (!result) return current;
    setBusy('Applying…');
    await nextFrame();
    try {
      push(result);
      resetPending();
      return result;
    } finally {
      setBusy(null);
    }
  }, [pendingResult, current, push, resetPending]);

  const switchTool = async (next) => {
    if (next === tool) return;
    await applyPending();
    setEraser(false);
    setTool(next);
  };

  /** Run a whole-image operation with a busy indicator. */
  const run = async (label, fn) => {
    setError(null);
    setBusy(label);
    await nextFrame();
    try {
      const out = await fn(current);
      if (out) push(out);
    } catch (err) {
      setError(await errorText(err, 'That didn’t work'));
    } finally {
      setBusy(null);
    }
  };

  // ---- display ------------------------------------------------------------
  const layout = useMemo(() => {
    if (!shown || !stage.w) return null;
    const pad = 24;
    const scale = Math.min((stage.w - pad * 2) / shown.width, (stage.h - pad * 2) / shown.height, 2);
    const w = shown.width * scale;
    const h = shown.height * scale;
    return { scale, w, h, x: (stage.w - w) / 2, y: (stage.h - h) / 2 };
  }, [shown, stage]);

  useEffect(() => {
    const el = displayRef.current;
    if (!el || !shown || !layout) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.max(1, Math.round(layout.w * dpr));
    el.height = Math.max(1, Math.round(layout.h * dpr));
    const ctx = el.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(shown, 0, 0, el.width, el.height);
  }, [shown, layout]);

  // ---- keyboard -----------------------------------------------------------
  const dirty = canUndo || pending;
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }, [busy, dirty, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) && e.target.type !== 'range';
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (saveOpen) setSaveOpen(false);
        else if (confirmClose) setConfirmClose(false);
        else requestClose();
        return;
      }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, saveOpen, confirmClose, requestClose, undo, redo]);

  // ---- tool actions -------------------------------------------------------
  const setAspect = (id) => {
    setCropAspect(id);
    if (!current) return;
    const preset = ASPECTS.find((a) => a.id === id);
    const value = preset?.value === 'original' ? current.width / current.height : preset?.value;
    if (value) setCropRect(centeredAspectRect(current.width, current.height, value));
  };
  const cropAspectValue = (() => {
    const preset = ASPECTS.find((a) => a.id === cropAspect)?.value;
    if (preset === 'original') return current ? current.width / current.height : null;
    return preset || null;
  })();

  const onResizeW = (v) => {
    const w = Math.max(1, Math.round(v) || 0);
    setResizeW(w);
    if (lockRatio && current) setResizeH(Math.max(1, Math.round((w * current.height) / current.width)));
  };
  const onResizeH = (v) => {
    const h = Math.max(1, Math.round(v) || 0);
    setResizeH(h);
    if (lockRatio && current) setResizeW(Math.max(1, Math.round((h * current.width) / current.height)));
  };
  const fitLongest = (side) => {
    if (!current) return;
    const s = side / Math.max(current.width, current.height);
    setResizeW(Math.max(1, Math.round(current.width * s)));
    setResizeH(Math.max(1, Math.round(current.height * s)));
  };

  const serverCutout = (method) => run(method === 'ai' ? 'Removing background with AI…' : 'Removing white background…', async (canvas) => {
    const blob = await canvasToBlob(canvas, 'image/png');
    const png = await removeBackground(blob, method);
    const { canvas: out } = await blobToCanvas(png);
    setPreviewBg('checker');
    return out;
  });

  const removeBackdrop = () => run('Removing backdrop…', (canvas) => applyPixels(canvas, (px) => {
    const color = dominantBorderColor(px);
    if (!color) throw new Error('The edges are already transparent');
    setPreviewBg('checker');
    return eraseSimilar(px, borderSeeds(px.width, px.height), { tolerance, colors: [color] });
  }));

  const trimEdges = () => run('Trimming…', (canvas) => {
    const px = readPixels(canvas);
    const transparent = hasTransparency(px);
    const bounds = contentBounds(px, transparent ? {} : { trimColor: dominantBorderColor(px), tolerance });
    if (!bounds) throw new Error('Nothing left to keep');
    if (bounds.width === canvas.width && bounds.height === canvas.height) throw new Error('No empty edges to trim');
    return crop(canvas, bounds);
  });

  const flatten = (color) => run('Filling background…', (canvas) => placeOnCanvas(canvas, { fill: color }));

  const onStageClick = (e) => {
    if (tool !== 'background' || !eraser || !layout || !current || busy) return;
    const box = displayRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - box.left) / box.width) * current.width);
    const y = Math.floor(((e.clientY - box.top) / box.height) * current.height);
    if (x < 0 || y < 0 || x >= current.width || y >= current.height) return;
    run('Erasing…', (canvas) => applyPixels(canvas, (px) =>
      eraseSimilar(px, [y * px.width + x], { tolerance, contiguous })));
  };

  // ---- save ---------------------------------------------------------------
  const outputType = () => {
    const chosen = format === 'original' ? sourceType : format;
    return EDITABLE_TYPES.includes(chosen) ? chosen : 'image/png';
  };

  const encode = async () => {
    const canvas = await applyPending();
    let type = outputType();
    let note = null;
    if (type === 'image/jpeg' && hasTransparency(readPixels(canvas))) {
      if (format === 'original') {
        type = 'image/png';
        note = 'Saved as PNG to keep the transparent background.';
      }
    }
    const source = type === 'image/jpeg' ? placeOnCanvas(canvas, { fill: '#ffffff' }) : canvas;
    const blob = await canvasToBlob(source, type, quality / 100);
    return { blob, type, name: `${baseName(filename)}.${EXT[type]}`, note };
  };

  const save = async (mode) => {
    setSaveOpen(false);
    setError(null);
    setBusy(mode === 'download' ? 'Preparing download…' : 'Saving…');
    try {
      const { blob, type, name, note } = await encode();
      if (mode === 'download') {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        if (note) setNotice(note);
        return;
      }
      if (mode === 'version') {
        const res = await replaceMedia('image', url, blob, { action: 'edited', filename: name });
        onSaved?.({ url: res.url, mode, updated: res.updated || [], note });
      } else {
        const newUrl = await uploadImage(new File([blob], name, { type }), folder || 'general');
        onSaved?.({ url: newUrl, mode, updated: [], note });
      }
      onClose();
    } catch (err) {
      setError(await errorText(err, 'Could not save the image'));
    } finally {
      setBusy(null);
    }
  };

  if (!isOpen) return null;

  // ---- tool panels --------------------------------------------------------
  const applyBar = pending && (
    <div className="flex gap-2 px-4 py-3">
      <ActionButton icon={X} onClick={() => {
        resetPending();
        if (current) {
          setCropRect({ x: 0, y: 0, width: current.width, height: current.height });
          setCropAspect('free');
          setResizeW(current.width);
          setResizeH(current.height);
        }
      }}>Reset</ActionButton>
      <ActionButton icon={Check} primary onClick={applyPending}>Apply</ActionButton>
    </div>
  );

  const panels = {
    crop: (
      <>
        <Section title="Aspect ratio" hint="Drag the box or its handles. Changes apply when you switch tools or save.">
          <div className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => <Chip key={a.id} active={cropAspect === a.id} onClick={() => setAspect(a.id)}>{a.label}</Chip>)}
          </div>
        </Section>
        {current && cropRect && (
          <Section title="Size">
            <p className="text-sm tabular-nums text-dark-100">{Math.round(cropRect.width)} × {Math.round(cropRect.height)} px</p>
          </Section>
        )}
      </>
    ),
    rotate: (
      <>
        <Section title="Rotate & flip">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton icon={RotateCcw} onClick={() => run('Rotating…', (c) => rotate90(c, false))}>Left</ActionButton>
            <ActionButton icon={RotateCw} onClick={() => run('Rotating…', (c) => rotate90(c, true))}>Right</ActionButton>
            <ActionButton icon={FlipHorizontal2} onClick={() => run('Flipping…', (c) => flip(c, true))}>Flip H</ActionButton>
            <ActionButton icon={FlipVertical2} onClick={() => run('Flipping…', (c) => flip(c, false))}>Flip V</ActionButton>
          </div>
        </Section>
        <Section title="Straighten" hint="Crops automatically so no empty corners show.">
          <Slider label="Angle" value={straighten} min={-45} max={45} step={0.5} suffix="°" onChange={setStraighten} />
        </Section>
      </>
    ),
    adjust: (
      <>
        <Section title="Presets">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p.label} onClick={() => setAdjust({ ...DEFAULT_ADJUSTMENTS, ...p.adj })}>{p.label}</Chip>
            ))}
          </div>
        </Section>
        <Section title="Light & colour" hint="Double-click a slider to reset it.">
          {ADJUST_SLIDERS.map((s) => (
            <Slider key={s.key} {...s} value={adjust[s.key]} onChange={(v) => setAdjust((a) => ({ ...a, [s.key]: v }))} />
          ))}
          <div className="flex gap-1.5 pt-1">
            <Chip active={adjust.grayscale} onClick={() => setAdjust((a) => ({ ...a, grayscale: !a.grayscale }))}>Black & white</Chip>
            <Chip active={adjust.sepia} onClick={() => setAdjust((a) => ({ ...a, sepia: !a.sepia }))}>Sepia</Chip>
          </div>
        </Section>
      </>
    ),
    background: (
      <>
        <Section title="Automatic" hint="White backdrop works best for studio product photos and keeps white parts inside the product.">
          <ActionButton icon={WandSparkles} primary onClick={() => serverCutout('white')} disabled={Boolean(busy)}>Remove white background</ActionButton>
          {aiAvailable && (
            <ActionButton icon={Sparkles} onClick={() => serverCutout('ai')} disabled={Boolean(busy)}>Remove any background (AI)</ActionButton>
          )}
        </Section>
        <Section title="By colour">
          <Slider label="Tolerance" value={tolerance} min={1} max={60} onChange={setTolerance} />
          <ActionButton icon={Eraser} onClick={removeBackdrop} disabled={Boolean(busy)}>Remove edge colour</ActionButton>
          <ActionButton
            icon={Eraser}
            primary={eraser}
            onClick={() => {
              setEraser((v) => !v);
              setPreviewBg('checker');
            }}
          >
            {eraser ? 'Magic eraser on: click the image' : 'Magic eraser'}
          </ActionButton>
          <label className="flex items-center gap-2 text-xs text-dark-200">
            <input type="checkbox" checked={contiguous} onChange={(e) => setContiguous(e.target.checked)} className="accent-primary-500" />
            Only connected areas
          </label>
        </Section>
        <Section title="Finish">
          <ActionButton onClick={trimEdges} disabled={Boolean(busy)}>Trim empty edges</ActionButton>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={() => flatten('#ffffff')} disabled={Boolean(busy)}>Fill white</ActionButton>
            <ActionButton onClick={() => flatten(fillColor)} disabled={Boolean(busy)}>
              <span className="h-3.5 w-3.5 rounded-sm border border-dark-300" style={{ background: fillColor }} /> Fill colour
            </ActionButton>
          </div>
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} aria-label="Fill colour" className="h-8 w-full cursor-pointer rounded border border-dark-500 bg-dark-800" />
        </Section>
      </>
    ),
    resize: current && (
      <>
        <Section title="Dimensions" hint="Product photos look sharpest uploaded at 1600–2400 px; the site makes smaller sizes itself.">
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-dark-200">
              Width
              <input type="number" min={1} value={resizeW} onChange={(e) => onResizeW(e.target.value)} className="mt-1 w-full rounded-lg border border-dark-500 bg-dark-800 px-2 py-1.5 text-sm text-dark-50" />
            </label>
            <button type="button" onClick={() => setLockRatio((v) => !v)} className="mb-1 rounded-md p-1.5 text-dark-200 hover:bg-dark-600" aria-label={lockRatio ? 'Unlock ratio' : 'Lock ratio'}>
              {lockRatio ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
            <label className="flex-1 text-xs text-dark-200">
              Height
              <input type="number" min={1} value={resizeH} onChange={(e) => onResizeH(e.target.value)} className="mt-1 w-full rounded-lg border border-dark-500 bg-dark-800 px-2 py-1.5 text-sm text-dark-50" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[2400, 1600, 1200, 800].map((s) => <Chip key={s} onClick={() => fitLongest(s)}>{s}px</Chip>)}
            <Chip onClick={() => onResizeW(Math.round(current.width / 2))}>50%</Chip>
          </div>
          {resizeW > current.width && <p className="text-[11px] text-amber-300">Enlarging won’t add detail and may look soft.</p>}
        </Section>
      </>
    ),
    canvas: (
      <>
        <Section title="Shape" hint="Square canvases keep product grids tidy.">
          <div className="flex flex-wrap gap-1.5">
            {CANVAS_ASPECTS.map((a) => <Chip key={a.id} active={canvasAspect === a.id} onClick={() => setCanvasAspect(a.id)}>{a.label}</Chip>)}
          </div>
          <Slider label="Padding" value={padding} min={0} max={40} suffix="%" onChange={setPadding} />
        </Section>
        <Section title="Background">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={fillMode === 'transparent'} onClick={() => setFillMode('transparent')}>Transparent</Chip>
            <Chip active={fillMode === 'white'} onClick={() => setFillMode('white')}>White</Chip>
            <Chip active={fillMode === 'custom'} onClick={() => setFillMode('custom')}>Colour</Chip>
          </div>
          {fillMode === 'custom' && (
            <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} aria-label="Background colour" className="h-8 w-full cursor-pointer rounded border border-dark-500 bg-dark-800" />
          )}
        </Section>
      </>
    ),
  };

  const sizeLabel = current ? `${current.width} × ${current.height}` : '';

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex flex-col bg-dark-900 text-dark-50" role="dialog" aria-modal="true" aria-label="Image editor">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-dark-600 bg-dark-800 px-3 py-2 sm:px-4">
        <button type="button" onClick={requestClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-200 hover:bg-dark-600 hover:text-dark-50" aria-label="Close editor">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{filename || 'Image'}</p>
          <p className="truncate text-[11px] text-dark-300">{sizeLabel}{dirty ? ' · unsaved changes' : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo || Boolean(busy)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-100 hover:bg-dark-600 disabled:opacity-30" aria-label="Undo" title="Undo (⌘Z)">
            <Undo2 className="h-5 w-5" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo || Boolean(busy)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-100 hover:bg-dark-600 disabled:opacity-30" aria-label="Redo" title="Redo (⇧⌘Z)">
            <Redo2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onPointerDown={() => setCompare(true)}
            onPointerUp={() => setCompare(false)}
            onPointerLeave={() => setCompare(false)}
            disabled={!current}
            className={`hidden h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium sm:inline-flex ${compare ? 'bg-primary-500/20 text-primary-300' : 'text-dark-100 hover:bg-dark-600'}`}
            title="Hold to see the original"
          >
            <Eye className="h-4 w-4" /> Hold to compare
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSaveOpen((v) => !v)}
              disabled={!current || Boolean(busy)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary-500 px-3 text-sm font-semibold text-dark-900 hover:bg-primary-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save <ChevronDown className="h-4 w-4" />
            </button>
            {saveOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-dark-500 bg-dark-700 p-3 shadow-2xl">
                <label className="block text-xs text-dark-200">
                  Format
                  <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 w-full rounded-lg border border-dark-500 bg-dark-800 px-2 py-1.5 text-sm text-dark-50">
                    {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </label>
                {['image/jpeg', 'image/webp'].includes(outputType()) && (
                  <div className="mt-2"><Slider label="Quality" value={quality} min={50} max={100} onChange={setQuality} /></div>
                )}
                <div className="mt-3 space-y-2">
                  {canReplace && (
                    <button type="button" onClick={() => save('version')} className="w-full rounded-lg bg-primary-500 px-3 py-2 text-left text-sm font-semibold text-dark-900 hover:bg-primary-400">
                      Save as new version
                      <span className="block text-[11px] font-normal text-dark-800">Everything using this image updates. The original is kept in its version history.</span>
                    </button>
                  )}
                  <button type="button" onClick={() => save('copy')} className="flex w-full items-start gap-2 rounded-lg bg-dark-600 px-3 py-2 text-left text-sm font-medium hover:bg-dark-500">
                    <Copy className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Save as a copy<span className="block text-[11px] font-normal text-dark-200">New image in “{folder || 'general'}”; nothing else changes.</span></span>
                  </button>
                  <button type="button" onClick={() => save('download')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-dark-100 hover:bg-dark-600">
                    <Download className="h-4 w-4" /> Download
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(notice || error) && (
        <div className={`border-b px-4 py-2 text-xs ${error ? 'border-red-900/60 bg-red-950/50 text-red-200' : 'border-dark-600 bg-dark-800 text-dark-100'}`} role="status">
          <div className="flex items-center gap-2">
            <span className="flex-1">{error || notice}</span>
            <button type="button" onClick={() => (error ? setError(null) : setNotice(null))} className="text-dark-300 hover:text-dark-50" aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Tool rail */}
        <nav className="order-3 flex shrink-0 gap-1 overflow-x-auto border-t border-dark-600 bg-dark-800 px-2 py-1.5 lg:order-1 lg:w-20 lg:flex-col lg:border-r lg:border-t-0 lg:px-1.5 lg:py-3" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTool(t.id)}
              disabled={!current || Boolean(busy)}
              aria-pressed={tool === t.id}
              className={`flex min-w-[64px] flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                tool === t.id ? 'bg-primary-500/15 text-primary-300' : 'text-dark-200 hover:bg-dark-600 hover:text-dark-50'
              }`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Stage */}
        <div
          ref={stageRef}
          className={`relative order-1 min-h-[260px] flex-1 overflow-hidden lg:order-2 ${PREVIEW_BACKGROUNDS[previewBg]} ${tool === 'background' && eraser ? 'cursor-crosshair' : ''}`}
          onClick={onStageClick}
          role="presentation"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-dark-100">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening image…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-red-200">{loadError}</p>
              <button type="button" onClick={onClose} className="rounded-lg bg-dark-600 px-4 py-2 text-sm hover:bg-dark-500">Close</button>
            </div>
          )}
          {layout && (
            <canvas
              ref={displayRef}
              className="absolute shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              style={{ left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
            />
          )}
          {layout && tool === 'crop' && !compare && current && cropRect && shown === current && (
            <CropOverlay
              rect={cropRect}
              onChange={setCropRect}
              scale={layout.scale}
              offset={{ x: layout.x, y: layout.y }}
              imageWidth={current.width}
              imageHeight={current.height}
              aspect={cropAspectValue}
            />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <p className="flex items-center gap-2 rounded-lg bg-dark-800 px-4 py-2 text-sm shadow-xl">
                <Loader2 className="h-4 w-4 animate-spin" /> {busy}
              </p>
            </div>
          )}
          {/* Preview background */}
          <div className="absolute bottom-3 right-3 flex gap-1 rounded-lg bg-dark-800/90 p-1" onClick={(e) => e.stopPropagation()} role="group" aria-label="Preview background">
            {Object.keys(PREVIEW_BACKGROUNDS).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPreviewBg(k)}
                aria-pressed={previewBg === k}
                title={`${k[0].toUpperCase()}${k.slice(1)} background`}
                className={`h-6 w-6 rounded border ${previewBg === k ? 'border-primary-500' : 'border-dark-500'} ${PREVIEW_BACKGROUNDS[k]}`}
              />
            ))}
          </div>
          {compare && <span className="absolute left-3 top-3 rounded bg-black/75 px-2 py-1 text-xs">Original</span>}
        </div>

        {/* Options */}
        <aside className="order-2 max-h-[38dvh] shrink-0 overflow-y-auto border-t border-dark-600 bg-dark-700 lg:order-3 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          {current && panels[tool]}
          {applyBar}
        </aside>
      </div>

      {confirmClose && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-dark-500 bg-dark-700 p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Discard your edits?</h2>
            <p className="mt-1 text-sm text-dark-200">The image hasn’t been saved. Closing now loses the changes.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmClose(false)} className="rounded-lg px-4 py-2 text-sm text-dark-100 hover:bg-dark-600">Keep editing</button>
              <button type="button" onClick={onClose} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
