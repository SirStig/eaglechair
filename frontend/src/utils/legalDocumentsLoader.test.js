import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./contentDataLoader', () => ({
  loadContentData: vi.fn(async () => ({ legalDocuments: [{ id: 9, slug: 'fallback' }] })),
}));

const docs = [
  { id: 1, documentType: 'conditions_of_sale', slug: 'renamed-terms' },
  { id: 2, documentType: 'privacy_policy', slug: 'privacy-policy' },
  { id: 3, documentType: 'warranty', slug: 'conditions-of-sale' },
];

const jsonResponse = (body) => ({ ok: true, json: async () => body });

const freshLoader = async () => {
  vi.resetModules();
  return import('./legalDocumentsLoader');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('findLegalDocument', () => {
  it('matches by type before slug, so renamed slugs still resolve', async () => {
    const { findLegalDocument } = await freshLoader();
    expect(findLegalDocument(docs, { type: 'conditions_of_sale', slug: 'conditions-of-sale' }).id).toBe(1);
  });

  it('falls back to slug and returns null when missing', async () => {
    const { findLegalDocument } = await freshLoader();
    expect(findLegalDocument(docs, { type: 'nope', slug: 'privacy-policy' }).id).toBe(2);
    expect(findLegalDocument(docs, { type: 'nope', slug: 'nope' })).toBeNull();
    expect(findLegalDocument(null, { type: 'x', slug: 'y' })).toBeNull();
  });
});

describe('loadLegalDocuments', () => {
  it('shares one request between concurrent callers and keeps a stale copy', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonResponse({ legalDocuments: docs }));
    vi.stubGlobal('fetch', fetchMock);
    const loader = await freshLoader();

    expect(loader.getCachedLegalDocuments()).toBeNull();
    const [a, b] = await Promise.all([loader.loadLegalDocuments(), loader.loadLegalDocuments()]);
    expect(a).toBe(docs);
    expect(b).toBe(docs);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past the freshness window the cached copy is still available instantly
    vi.advanceTimersByTime(120000);
    expect(loader.getCachedLegalDocuments()).toBe(docs);
    await loader.loadLegalDocuments();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to contentData when the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const loader = await freshLoader();
    expect(await loader.loadLegalDocuments()).toEqual([{ id: 9, slug: 'fallback' }]);
  });
});
