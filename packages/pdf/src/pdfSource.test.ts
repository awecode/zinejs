// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfSource, type PdfSrc } from './pdfSource';

type PdfjsGlobal = { GlobalWorkerOptions: { workerSrc: string } };
const pdfjsMock = async () => (await import('pdfjs-dist')) as unknown as PdfjsGlobal;

const mock = vi.hoisted(() => {
  const page = {
    getViewport: () => ({ width: 120, height: 160 }),
    render: () => ({ promise: Promise.resolve() }),
  };
  const doc = { numPages: 3, getPage: async () => page, destroy: () => {} };
  return { getDocument: vi.fn(() => ({ promise: Promise.resolve(doc) })) };
});

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mock.getDocument,
}));

describe('PdfSource', () => {
  beforeEach(async () => {
    (await pdfjsMock()).GlobalWorkerOptions.workerSrc = ''; // reset the shared global between tests
    mock.getDocument.mockClear();
    // CDN path prefers this global — keep it off unless a test sets it.
    delete (globalThis as { pdfjsLib?: unknown }).pdfjsLib;
  });

  it('opens a URL PDF (with workerSrc) and reports its page count', async () => {
    const src = new PdfSource('doc.pdf', { workerSrc: '/pdf.worker.mjs' });
    await src.open();
    expect(src.pageCount).toBe(3);
  });

  it('renders a page to a sized canvas', async () => {
    const src = new PdfSource('doc.pdf', { workerSrc: '/pdf.worker.mjs' });
    await src.open();
    const canvas = (await src.get(0)) as HTMLCanvasElement;
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(160);
  });

  it('memoizes a decoded page', async () => {
    const src = new PdfSource('doc.pdf', { workerSrc: '/pdf.worker.mjs' });
    await src.open();
    expect(src.get(0)).toBe(src.get(0)); // same cached promise
  });

  it('auto-resolves the worker when none is provided', async () => {
    const src = new PdfSource('doc.pdf');
    await src.open();
    expect((await pdfjsMock()).GlobalWorkerOptions.workerSrc).toMatch(/pdf\.worker\.min\.mjs$/);
    expect(src.pageCount).toBe(3);
  });

  it('prefers an explicit workerSrc over the default', async () => {
    const src = new PdfSource('doc.pdf', { workerSrc: '/custom-worker.mjs' });
    await src.open();
    expect((await pdfjsMock()).GlobalWorkerOptions.workerSrc).toBe('/custom-worker.mjs');
  });

  it('respects an already-configured global workerSrc', async () => {
    (await pdfjsMock()).GlobalWorkerOptions.workerSrc = '/preset-worker.mjs';
    const src = new PdfSource('doc.pdf'); // no explicit option
    await src.open();
    expect((await pdfjsMock()).GlobalWorkerOptions.workerSrc).toBe('/preset-worker.mjs');
  });

  it('uses globalThis.pdfjsLib when present (CDN / UMD host)', async () => {
    const g = globalThis as typeof globalThis & { pdfjsLib?: unknown };
    const prev = g.pdfjsLib;
    const page = {
      getViewport: () => ({ width: 80, height: 100 }),
      render: () => ({ promise: Promise.resolve() }),
    };
    const doc = { numPages: 2, getPage: async () => page, destroy: () => {} };
    g.pdfjsLib = {
      GlobalWorkerOptions: { workerSrc: '/from-global-worker.mjs' },
      getDocument: vi.fn(() => ({ promise: Promise.resolve(doc) })),
    };
    try {
      const src = new PdfSource('cdn.pdf');
      await src.open();
      expect(src.pageCount).toBe(2);
      expect((g.pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc).toBe(
        '/from-global-worker.mjs',
      );
      // Prefer the global: the module mock's getDocument must not have been used for this open.
      expect(mock.getDocument).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete g.pdfjsLib;
      else g.pdfjsLib = prev;
    }
  });

  it('accepts a pre-created document without a workerSrc', async () => {
    const doc = {
      numPages: 5,
      getPage: async () => ({
        getViewport: () => ({ width: 10, height: 10 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
      destroy: () => {},
    } as unknown as PdfSrc;
    const src = new PdfSource(doc);
    await src.open();
    expect(src.pageCount).toBe(5);
  });

  // A pre-created document lets us spy on getPage and count (re-)renders.
  const spyDoc = () => {
    const page = {
      getViewport: () => ({ width: 120, height: 160 }), // 120*160*4 = 76,800 bytes / page
      render: () => ({ promise: Promise.resolve() }),
    };
    const getPage = vi.fn(async () => page);
    return { getPage, doc: { numPages: 5, getPage, destroy: () => {} } as unknown as PdfSrc };
  };

  it('evicts least-recently-used pages past the byte cap', async () => {
    const { getPage, doc } = spyDoc();
    const src = new PdfSource(doc, { maxCacheBytes: 100_000, preload: 0 }); // fits one page, not two
    await src.open();

    await src.get(0);
    await src.get(1); // over cap → page 0 evicted
    expect(getPage).toHaveBeenCalledTimes(2);

    await src.get(1); // most-recently-used → still cached
    expect(getPage).toHaveBeenCalledTimes(2);

    await src.get(0); // was evicted → re-renders
    expect(getPage).toHaveBeenCalledTimes(3);
  });

  it('keeps pages cached while under the byte cap', async () => {
    const { getPage, doc } = spyDoc();
    const src = new PdfSource(doc, { maxCacheBytes: 10_000_000, preload: 0 });
    await src.open();

    await src.get(0);
    await src.get(1);
    await src.get(0); // under cap → never evicted → no re-render
    expect(getPage).toHaveBeenCalledTimes(2);
  });

  it('passes disableAutoFetch through to pdf.js getDocument', async () => {
    mock.getDocument.mockClear();
    const src = new PdfSource('doc.pdf', { workerSrc: '/w.mjs', disableAutoFetch: true });
    await src.open();
    expect(mock.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'doc.pdf', disableAutoFetch: true }),
    );
  });

  it('progressive: paints low-res first, upgrades to crisp, and signals an update', async () => {
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 200 * scale, height: 200 * scale }),
      render: () => ({ promise: Promise.resolve() }),
    };
    const getPage = vi.fn(async () => page);
    const doc = { numPages: 3, getPage, destroy: () => {} } as unknown as PdfSrc;
    const src = new PdfSource(doc, { progressive: true, preload: 0 });
    await src.open();

    const updates: number[] = [];
    src.onPageUpdate((i) => updates.push(i));

    const low = (await src.get(0)) as HTMLCanvasElement;
    await new Promise((r) => setTimeout(r)); // let the high-res upgrade run

    expect(getPage).toHaveBeenCalledTimes(2); // low pass + high pass
    expect(updates).toEqual([0]); // upgrade signaled
    const hi = (await src.get(0)) as HTMLCanvasElement;
    expect(hi).not.toBe(low);
    expect(hi.width).toBeGreaterThan(low.width); // crisper (more pixels)
  });
});
