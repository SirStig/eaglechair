import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADJUSTMENTS,
  applyAdjustments,
  borderSeeds,
  centeredAspectRect,
  constrainRect,
  contentBounds,
  dominantBorderColor,
  eraseSimilar,
  hasTransparency,
  isNeutral,
  rotatedCropSize,
} from './imageOps';

/** w x h image filled with `bg`, with a `fg` box at [x0,y0,x1) x [y0,y1) */
function image(w, h, bg, fg = null, box = null) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = box && x >= box[0] && x < box[2] && y >= box[1] && y < box[3];
      const [r, g, b, a = 255] = inside ? fg : bg;
      data.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h };
}

const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

describe('adjustments', () => {
  it('neutral settings leave pixels unchanged', () => {
    const src = image(4, 4, [10, 120, 240]);
    expect(isNeutral(DEFAULT_ADJUSTMENTS)).toBe(true);
    expect(Array.from(applyAdjustments(src, DEFAULT_ADJUSTMENTS).data)).toEqual(Array.from(src.data));
  });

  it('brightness lifts, grayscale equalises channels, alpha is kept', () => {
    const src = image(2, 2, [100, 50, 200, 128]);
    const bright = applyAdjustments(src, { ...DEFAULT_ADJUSTMENTS, brightness: 50 });
    expect(bright.data[0]).toBeGreaterThan(100);
    expect(bright.data[3]).toBe(128);
    const gray = applyAdjustments(src, { ...DEFAULT_ADJUSTMENTS, grayscale: true });
    expect(gray.data[0]).toBe(gray.data[1]);
    expect(gray.data[1]).toBe(gray.data[2]);
  });
});

describe('background removal', () => {
  it('removes the backdrop connected to the border and keeps enclosed areas', () => {
    // White backdrop, dark ring, white hole inside the ring
    const img = image(20, 20, [255, 255, 255], [30, 30, 30], [5, 5, 15, 15]);
    for (let y = 8; y < 12; y++) for (let x = 8; x < 12; x++) img.data.set([255, 255, 255, 255], (y * 20 + x) * 4);
    const out = eraseSimilar(img, borderSeeds(20, 20), { tolerance: 10 });
    expect(alphaAt(out, 0, 0)).toBe(0);
    expect(alphaAt(out, 6, 6)).toBe(255);
    expect(alphaAt(out, 10, 10)).toBe(255); // enclosed white stays
    expect(hasTransparency(out)).toBe(true);
  });

  it('non-contiguous mode removes every matching pixel', () => {
    const img = image(20, 20, [255, 255, 255], [30, 30, 30], [5, 5, 15, 15]);
    for (let y = 8; y < 12; y++) for (let x = 8; x < 12; x++) img.data.set([255, 255, 255, 255], (y * 20 + x) * 4);
    const out = eraseSimilar(img, [0], { tolerance: 10, contiguous: false });
    expect(alphaAt(out, 10, 10)).toBe(0);
  });

  it('finds the dominant border colour and content bounds', () => {
    const img = image(30, 20, [250, 250, 250], [0, 0, 0], [10, 4, 20, 16]);
    expect(dominantBorderColor(img)).toEqual([250, 250, 250]);
    expect(contentBounds(img, { trimColor: [250, 250, 250] })).toEqual({ x: 10, y: 4, width: 10, height: 12 });
    expect(contentBounds(image(3, 3, [0, 0, 0, 0]))).toBeNull();
  });
});

describe('geometry', () => {
  it('straighten crop shrinks with the angle and is identity at 0', () => {
    expect(rotatedCropSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
    const r = rotatedCropSize(400, 300, 10);
    expect(r.width).toBeLessThan(400);
    expect(r.height).toBeLessThan(300);
  });

  it('aspect rects fit and constrain', () => {
    expect(centeredAspectRect(400, 300, 1)).toEqual({ x: 50, y: 0, width: 300, height: 300 });
    expect(constrainRect({ x: 390, y: -5, width: 100, height: 50 }, 400, 300)).toEqual({ x: 300, y: 0, width: 100, height: 50 });
    expect(constrainRect({ x: 0, y: 0, width: 200, height: 50 }, 400, 300, { aspect: 1 })).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});
