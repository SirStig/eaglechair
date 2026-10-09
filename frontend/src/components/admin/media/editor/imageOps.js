/**
 * Image editor operations.
 *
 * Pixel work runs on ImageData-like objects ({ data, width, height }, RGBA
 * bytes) so it can be unit tested without a canvas; the canvas helpers at the
 * bottom wrap them for the editor.
 */

export const clamp = (v, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export const DEFAULT_ADJUSTMENTS = {
  brightness: 0, // -100..100
  contrast: 0, // -100..100
  saturation: 0, // -100..100
  warmth: 0, // -100..100 (blue <-> amber)
  exposure: 0, // -100..100 (multiplicative, in fractions of a stop)
  highlights: 0, // -100..100
  shadows: 0, // -100..100
  sharpen: 0, // 0..100
  grayscale: false,
  sepia: false,
};

export const isNeutral = (adj) =>
  Object.keys(DEFAULT_ADJUSTMENTS).every((k) => adj[k] === DEFAULT_ADJUSTMENTS[k]);

/** Lookup table per channel for the tone adjustments (cheap per pixel). */
function toneTable({ brightness, contrast, exposure, highlights, shadows }) {
  const table = new Uint8ClampedArray(256);
  const gain = 2 ** (exposure / 50); // ±2 stops at the extremes
  const c = contrast * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < 256; i++) {
    let v = i * gain;
    v += brightness * 1.28;
    v = cf * (v - 128) + 128;
    const t = clamp(v) / 255;
    // Lift / pull the dark and bright ends separately, fading toward the middle
    v += shadows * 0.8 * (1 - t) ** 2;
    v += highlights * 0.8 * t ** 2;
    table[i] = clamp(Math.round(v));
  }
  return table;
}

/** Returns a new ImageData-like object with the adjustments applied. */
export function applyAdjustments(src, adj) {
  const { width, height } = src;
  const out = new Uint8ClampedArray(src.data);
  const table = toneTable(adj);
  const sat = 1 + adj.saturation / 100;
  const warm = adj.warmth * 0.4;
  for (let i = 0; i < out.length; i += 4) {
    let r = table[out[i]];
    let g = table[out[i + 1]];
    let b = table[out[i + 2]];
    if (warm) {
      r += warm;
      b -= warm;
    }
    if (sat !== 1 || adj.grayscale) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s = adj.grayscale ? 0 : sat;
      r = l + (r - l) * s;
      g = l + (g - l) * s;
      b = l + (b - l) * s;
    }
    if (adj.sepia) {
      const rr = 0.393 * r + 0.769 * g + 0.189 * b;
      const gg = 0.349 * r + 0.686 * g + 0.168 * b;
      const bb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = rr;
      g = gg;
      b = bb;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  const result = { data: out, width, height };
  return adj.sharpen > 0 ? sharpen(result, adj.sharpen / 100) : result;
}

/** Unsharp-style 3x3 sharpen; `amount` 0..1. */
export function sharpen(src, amount) {
  const { data, width, height } = src;
  const out = new Uint8ClampedArray(data);
  const k = amount * 1.5;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = data[i + c];
        const sum =
          data[i - 4 + c] + data[i + 4 + c] + data[i - width * 4 + c] + data[i + width * 4 + c];
        out[i + c] = center + k * (4 * center - sum);
      }
    }
  }
  return { data: out, width, height };
}

// ---------------------------------------------------------------------------
// Background removal (client side)
// ---------------------------------------------------------------------------

const colorDistance = (data, i, r, g, b) => {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 4.42; // 0..100
};

/**
 * Make pixels similar to the reference colours transparent. Flood fill
 * (4-way) from `seeds` (pixel indexes) through pixels within `tolerance`
 * (0..100) of the nearest reference colour; with `contiguous` false, every
 * matching pixel in the image goes. `colors` defaults to the seeds' own
 * colours (at most MAX_REFERENCE_COLORS distinct ones). Pixels just past the
 * edge fade by how close they are (`feather`, in tolerance units), so
 * cut-outs aren't jagged.
 */
const MAX_REFERENCE_COLORS = 6;

export function eraseSimilar(src, seeds, { tolerance = 15, contiguous = true, feather = 8, colors = null } = {}) {
  const { width, height } = src;
  const data = new Uint8ClampedArray(src.data);
  const total = width * height;
  const removed = new Uint8Array(total);

  let refs = colors;
  if (!refs) {
    const seen = new Map();
    for (const p of seeds) {
      if (p < 0 || p >= total || data[p * 4 + 3] === 0) continue;
      const i = p * 4;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      if (!seen.has(key)) seen.set(key, { n: 0, rgb: [data[i], data[i + 1], data[i + 2]] });
      seen.get(key).n += 1;
    }
    refs = [...seen.values()].sort((a, b) => b.n - a.n).slice(0, MAX_REFERENCE_COLORS).map((e) => e.rgb);
  }
  if (!refs.length) return { data, width, height };
  const nearest = (i) => {
    let best = Infinity;
    for (const [r, g, b] of refs) {
      const d = colorDistance(data, i, r, g, b);
      if (d < best) best = d;
    }
    return best;
  };

  if (contiguous) {
    const stack = new Int32Array(total);
    let top = 0;
    const visit = (n) => {
      if (removed[n]) return;
      if (data[n * 4 + 3] === 0 || nearest(n * 4) <= tolerance) {
        removed[n] = 1;
        stack[top++] = n;
      }
    };
    for (const p of seeds) {
      if (p >= 0 && p < total && !removed[p] && nearest(p * 4) <= tolerance) {
        removed[p] = 1;
        stack[top++] = p;
      }
    }
    while (top) {
      const p = stack[--top];
      const x = p % width;
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p + width < total) visit(p + width);
    }
  } else {
    for (let p = 0; p < total; p++) if (nearest(p * 4) <= tolerance) removed[p] = 1;
  }

  for (let p = 0; p < total; p++) {
    if (removed[p]) {
      data[p * 4 + 3] = 0;
      continue;
    }
    if (!feather) continue;
    const x = p % width;
    const touches =
      (x > 0 && removed[p - 1]) || (x < width - 1 && removed[p + 1]) ||
      (p >= width && removed[p - width]) || (p + width < total && removed[p + width]);
    if (!touches) continue;
    const over = nearest(p * 4) - tolerance;
    if (over < feather) {
      data[p * 4 + 3] = Math.min(data[p * 4 + 3], Math.round((255 * Math.max(over, 0)) / feather));
    }
  }
  return { data, width, height };
}

/** Pixel indexes around the image border (every `step`th), the seeds for "remove backdrop". */
export function borderSeeds(width, height, step = 1) {
  const seeds = [];
  for (let x = 0; x < width; x += step) seeds.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y += step) seeds.push(y * width, y * width + width - 1);
  return seeds;
}

/** True when any pixel is not fully opaque. */
export function hasTransparency(src) {
  const { data } = src;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * Bounding box of the content: pixels that aren't transparent and (with
 * `trimColor`) differ from that colour by more than `tolerance`. Null when
 * nothing is left.
 */
export function contentBounds(src, { tolerance = 10, trimColor = null } = {}) {
  const { data, width, height } = src;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] <= 8) continue;
      if (trimColor && colorDistance(data, i, ...trimColor) <= tolerance) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Most common colour along the border (quantised), as [r, g, b]. */
export function dominantBorderColor(src) {
  const { data, width, height } = src;
  const counts = new Map();
  for (const p of borderSeeds(width, height, Math.max(1, Math.floor((width + height) / 400)))) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    const entry = counts.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    entry.n += 1;
    entry.r += data[i];
    entry.g += data[i + 1];
    entry.b += data[i + 2];
    counts.set(key, entry);
  }
  let best = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round) : null;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Largest axis-aligned rectangle (centered) inside a w x h image rotated by
 * `degrees`, so straightening doesn't leave empty corners.
 */
export function rotatedCropSize(w, h, degrees) {
  const a = Math.abs(((degrees % 180) * Math.PI) / 180);
  const sin = Math.abs(Math.sin(a));
  const cos = Math.abs(Math.cos(a));
  if (sin < 1e-9) return { width: w, height: h };
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  let wr;
  let hr;
  if (shortSide <= 2 * sin * cos * longSide || Math.abs(sin - cos) < 1e-10) {
    const x = 0.5 * shortSide;
    if (w >= h) {
      wr = x / sin;
      hr = x / cos;
    } else {
      wr = x / cos;
      hr = x / sin;
    }
  } else {
    const cos2 = cos * cos - sin * sin;
    wr = (w * cos - h * sin) / cos2;
    hr = (h * cos - w * sin) / cos2;
  }
  return { width: Math.max(1, Math.floor(wr)), height: Math.max(1, Math.floor(hr)) };
}

/** Crop rectangle of `aspect` (w/h) as large as fits, centered. */
export function centeredAspectRect(width, height, aspect) {
  if (!aspect) return { x: 0, y: 0, width, height };
  let w = width;
  let h = Math.round(width / aspect);
  if (h > height) {
    h = height;
    w = Math.round(height * aspect);
  }
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
}

/** Keep a crop rect inside the image and at least `min` px, with an optional fixed aspect. */
export function constrainRect(rect, width, height, { aspect = null, min = 8 } = {}) {
  let { x, y, width: w, height: h } = rect;
  w = Math.max(min, Math.min(w, width));
  h = Math.max(min, Math.min(h, height));
  if (aspect) {
    if (w / h > aspect) w = Math.round(h * aspect);
    else h = Math.round(w / aspect);
  }
  x = Math.max(0, Math.min(x, width - w));
  y = Math.max(0, Math.min(y, height - h));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

// ---------------------------------------------------------------------------
// Canvas helpers (browser only)
// ---------------------------------------------------------------------------

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

const ctx2d = (canvas) => canvas.getContext('2d', { willReadFrequently: true });

export const readPixels = (canvas) => ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);

export function fromPixels({ data, width, height }) {
  const canvas = makeCanvas(width, height);
  ctx2d(canvas).putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

export function cloneCanvas(src) {
  const canvas = makeCanvas(src.width, src.height);
  ctx2d(canvas).drawImage(src, 0, 0);
  return canvas;
}

export function rotate90(src, clockwise = true) {
  const canvas = makeCanvas(src.height, src.width);
  const ctx = ctx2d(canvas);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return canvas;
}

export function flip(src, horizontal = true) {
  const canvas = makeCanvas(src.width, src.height);
  const ctx = ctx2d(canvas);
  if (horizontal) {
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, src.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(src, 0, 0);
  return canvas;
}

/** Rotate by any angle; `autoCrop` trims to the largest rectangle with no empty corners. */
export function rotateFree(src, degrees, { autoCrop = true } = {}) {
  if (!degrees) return src;
  const rad = (degrees * Math.PI) / 180;
  const size = autoCrop
    ? rotatedCropSize(src.width, src.height, degrees)
    : {
      width: Math.ceil(Math.abs(src.width * Math.cos(rad)) + Math.abs(src.height * Math.sin(rad))),
      height: Math.ceil(Math.abs(src.width * Math.sin(rad)) + Math.abs(src.height * Math.cos(rad))),
    };
  const canvas = makeCanvas(size.width, size.height);
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return canvas;
}

export function crop(src, rect) {
  const canvas = makeCanvas(rect.width, rect.height);
  ctx2d(canvas).drawImage(src, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
}

/** High-quality resize: halves step by step when shrinking a lot. */
export function resize(src, width, height) {
  let current = src;
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const half = makeCanvas(current.width / 2, current.height / 2);
    const hctx = ctx2d(half);
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  const canvas = makeCanvas(width, height);
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, width, height);
  return canvas;
}

/**
 * Place the image on a new canvas: `padding` (percent of the longer side)
 * around it, optionally squared / set to an aspect, filled with `fill`
 * (a CSS colour) or left transparent.
 */
export function placeOnCanvas(src, { padding = 0, aspect = null, fill = null } = {}) {
  const pad = Math.round((Math.max(src.width, src.height) * padding) / 100);
  let w = src.width + pad * 2;
  let h = src.height + pad * 2;
  if (aspect) {
    if (w / h > aspect) h = Math.round(w / aspect);
    else w = Math.round(h * aspect);
  }
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(src, Math.round((w - src.width) / 2), Math.round((h - src.height) / 2));
  return canvas;
}

export function applyPixels(src, fn) {
  return fromPixels(fn(readPixels(src)));
}

export const canvasToBlob = (canvas, type = 'image/png', quality = 0.92) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), type, quality);
  });

export async function blobToCanvas(blob, { maxDimension = 8192, maxPixels = 40_000_000 } = {}) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = makeCanvas(width, height);
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const original = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return { canvas, downscaled: scale < 1, original };
}

/** Downscaled copy for fast live previews. */
export function previewCopy(src, maxSide = 1200) {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (scale === 1) return src;
  return resize(src, Math.round(src.width * scale), Math.round(src.height * scale));
}
