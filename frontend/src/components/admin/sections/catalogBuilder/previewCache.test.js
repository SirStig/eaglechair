import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewPayload, newPage } from './pageModel';

vi.mock('../../../../services/catalogToolsService', () => ({
  previewPage: vi.fn(),
}));

const { previewPage } = await import('../../../../services/catalogToolsService');
const { clearPreviewCache, getCachedPreview, loadPreview, prefetchPreviews, previewKey } = await import('./previewCache');

const productPage = (title, extra = {}) => ({
  ...newPage('product'),
  title,
  items: [{ product_id: 1, variation_id: null, dx: 0, dy: 0, scale: 1 }],
  features: 'Long features text '.repeat(20),
  ...extra,
});

const doc = (pages) => ({ settings: { copyright: 'c', page_numbers: true, title: '' }, pages });

describe('previewPayload', () => {
  it('sends the previewed page whole and only numbering fields for the rest', () => {
    const pages = [newPage('cover'), ...Array.from({ length: 10 }, (_, i) => productPage(`Family ${i}`))];
    const payload = previewPayload(doc(pages), 1);
    expect(payload.pages[1]).toBe(pages[1]);
    expect(Object.keys(payload.pages[2]).sort()).toEqual(['id', 'include_in_toc', 'title', 'toc_label', 'type']);
    expect(JSON.stringify(payload).length).toBeLessThan(JSON.stringify(doc(pages)).length / 4);
  });

  it('keeps the key stable when another page’s content changes', () => {
    const pages = [productPage('Lobo'), productPage('Voda')];
    const before = previewKey(previewPayload(doc(pages), 0), 0);
    const edited = [pages[0], { ...pages[1], features: 'changed', items: [] }];
    expect(previewKey(previewPayload(doc(edited), 0), 0)).toBe(before);
  });

  it('changes the key when another page’s title changes (the contents and numbering depend on it)', () => {
    const pages = [productPage('Lobo'), productPage('Voda')];
    const before = previewKey(previewPayload(doc(pages), 0), 0);
    const edited = [pages[0], { ...pages[1], title: 'Volta' }];
    expect(previewKey(previewPayload(doc(edited), 0), 0)).not.toBe(before);
  });

  it('gives a contents page the model ids of product sheets', () => {
    const pages = [newPage('toc'), productPage('Lobo')];
    const payload = previewPayload(doc(pages), 0);
    expect(payload.pages[1].items).toEqual([{ product_id: 1, variation_id: null }]);
    expect(payload.pages[1].features).toBeUndefined();
  });
});

describe('preview cache', () => {
  beforeEach(() => {
    clearPreviewCache();
    previewPage.mockReset();
    previewPage.mockImplementation(async (_doc, index) => ({ image: `img-${index}`, slots: [] }));
  });

  it('shares one request between concurrent callers and caches the result', async () => {
    const payload = previewPayload(doc([productPage('Lobo')]), 0);
    const [a, b] = await Promise.all([loadPreview(payload, 0), loadPreview(payload, 0)]);
    expect(a).toBe(b);
    await loadPreview(payload, 0);
    expect(previewPage).toHaveBeenCalledTimes(1);
    expect(getCachedPreview(previewKey(payload, 0))).toBe(a);
  });

  it('evicts the least recently used entries beyond its limit', async () => {
    const pages = Array.from({ length: 70 }, (_, i) => productPage(`Family ${i}`));
    for (let i = 0; i < 70; i += 1) await loadPreview(previewPayload(doc(pages), i), i);
    expect(getCachedPreview(previewKey(previewPayload(doc(pages), 0), 0))).toBeUndefined();
    expect(getCachedPreview(previewKey(previewPayload(doc(pages), 69), 69))).toBeDefined();
  });

  it('prefetches only pages that exist and are not cached yet', async () => {
    const d = doc([productPage('A'), productPage('B'), productPage('C')]);
    await loadPreview(previewPayload(d, 2), 2);
    previewPage.mockClear();
    prefetchPreviews(d, [-1, 1, 2, 3]);
    await new Promise((r) => setTimeout(r, 0));
    expect(previewPage).toHaveBeenCalledTimes(1);
    expect(previewPage.mock.calls[0][1]).toBe(1);
  });
});
