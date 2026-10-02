/**
 * Catalog Builder editor performance on a large catalog (300 pages).
 *
 * Budgets are generous for jsdom (a real browser is several times faster);
 * the structural checks (how many rows re-render, how many requests go out)
 * are the ones that catch regressions that make the editor laggy.
 */
import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Count sortable row renders: useSortable runs once per SortablePage render
const sortableRenders = { count: 0 };
vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSortable: (...args) => {
      sortableRenders.count += 1;
      return actual.useSortable(...args);
    },
  };
});

vi.mock('../../../../services/catalogToolsService', () => ({
  previewPage: vi.fn(async (_doc, index) => ({
    image: 'data:image/jpeg;base64,', slots: [], page_number: index + 1, physical_pages: 1, total_pages: 300,
  })),
  getProductsByIds: vi.fn(async (ids) => ids.map((id) => ({
    id, model_number: String(3000 + id), model_suffix: '', name: `Chair ${id}`, family_name: `Family ${id}`,
    images: [], default_image: null, variations: [],
  }))),
  saveProject: vi.fn(async () => ({})),
  exportCatalog: vi.fn(),
  suggestPages: vi.fn(async () => ({ pages: [] })),
  saveBlob: vi.fn(),
  searchProducts: vi.fn(async () => []),
  listFamilies: vi.fn(async () => []),
  uploadCatalogImage: vi.fn(),
}));

const service = await import('../../../../services/catalogToolsService');
const { clearPreviewCache } = await import('./previewCache');
const { ToastProvider } = await import('../../../../contexts/ToastContext');
const { default: CatalogBuilderEditor } = await import('./CatalogBuilderEditor');

const PAGE_COUNT = 300;

const bigProject = () => {
  const pages = [
    { id: 'cover', type: 'cover', title: 'New Traditions', items: [] },
    { id: 'toc', type: 'toc', title: 'Contents' },
  ];
  for (let i = 0; pages.length < PAGE_COUNT; i += 1) {
    pages.push({
      id: `p${i}`, type: i % 2 ? 'gallery' : 'product', title: `Family ${Math.floor(i / 2)}`,
      items: [{ product_id: i + 1, variation_id: null, image_url: null, caption: null, show_specs: true, dx: 0, dy: 0, scale: 1 }],
      features: 'Original modern American design. '.repeat(10),
    });
  }
  return { id: 1, name: 'Big catalog', document: { settings: {}, pages } };
};

const commits = [];
const onRender = (_id, phase, actualDuration) => commits.push({ phase, actualDuration });

const mount = () => render(
  <ToastProvider>
    <Profiler id="editor" onRender={onRender}>
      <CatalogBuilderEditor project={bigProject()} onBack={() => {}} />
    </Profiler>
  </ToastProvider>,
);

const previewCallsFor = (index) => service.previewPage.mock.calls.filter(([, i]) => i === index).length;
const sleep = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeEach(() => {
  clearPreviewCache();
  vi.clearAllMocks();
  sortableRenders.count = 0;
  commits.length = 0;
});
afterEach(cleanup);

describe('Catalog Builder editor performance (300 pages)', () => {
  it('mounts quickly and renders each page row once', async () => {
    const start = performance.now();
    mount();
    const elapsed = performance.now() - start;
    expect(screen.getByText(`Pages (${PAGE_COUNT})`)).toBeTruthy();
    expect(elapsed).toBeLessThan(3000);
    expect(sortableRenders.count).toBeLessThanOrEqual(PAGE_COUNT * 2);
  });

  it('typing re-renders only the edited row, and each keystroke commits fast', async () => {
    mount();
    await sleep(50);
    const title = screen.getByLabelText('Headline');
    sortableRenders.count = 0;
    commits.length = 0;

    const keystrokes = 40;
    const start = performance.now();
    for (let i = 1; i <= keystrokes; i += 1) {
      fireEvent.change(title, { target: { value: `New Traditions ${'x'.repeat(i)}` } });
    }
    const perKeystroke = (performance.now() - start) / keystrokes;

    // Only the cover row shows the edited title: not 300 rows per keystroke
    expect(sortableRenders.count).toBeLessThanOrEqual(keystrokes * 2);
    const updates = commits.filter((c) => c.phase === 'update');
    const average = updates.reduce((sum, c) => sum + c.actualDuration, 0) / Math.max(updates.length, 1);
    expect(average).toBeLessThan(40);
    expect(perKeystroke).toBeLessThan(60);
  });

  it('a burst of typing sends one preview request and one autosave', async () => {
    mount();
    await waitFor(() => expect(previewCallsFor(0)).toBe(1));
    service.previewPage.mockClear();

    const title = screen.getByLabelText('Headline');
    for (let i = 1; i <= 25; i += 1) {
      fireEvent.change(title, { target: { value: `Headline ${i}` } });
    }
    await sleep(500);
    expect(previewCallsFor(0)).toBe(1);

    await sleep(1700);
    expect(service.saveProject).toHaveBeenCalledTimes(1);
    expect(service.saveProject.mock.calls[0][1].document.pages[0].title).toBe('Headline 25');
  });

  it('preview requests stay small on a large catalog', async () => {
    mount();
    await waitFor(() => expect(previewCallsFor(0)).toBe(1));
    const [payload] = service.previewPage.mock.calls[0];
    const full = JSON.stringify(bigProject().document).length;
    expect(JSON.stringify(payload).length).toBeLessThan(full / 4);
  });

  it('going back to a page shows the cached preview without a new request', async () => {
    mount();
    await waitFor(() => expect(previewCallsFor(0)).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(previewCallsFor(1)).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
    await sleep(400);
    expect(previewCallsFor(0)).toBe(1);
  });

  it('prefetches the next page while idle so paging forward is instant', async () => {
    mount();
    await waitFor(() => expect(previewCallsFor(0)).toBe(1));
    await sleep(800); // idle: neighbours are fetched in the background
    expect(previewCallsFor(1)).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await sleep(50);
    expect(previewCallsFor(1)).toBe(1); // served from the cache, no wait
  });
});
