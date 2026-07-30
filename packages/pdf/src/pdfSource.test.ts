// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfSource, type PdfSrc } from './pdfSource';

type PdfjsGlobal = { GlobalWorkerOptions: { workerSrc: string } };
const pdfjsMock = async () => (await import('pdfjs-dist')) as unknown as PdfjsGlobal;

vi.mock('pdfjs-dist', () => {
  const page = {
    getViewport: () => ({ width: 120, height: 160 }),
    render: () => ({ promise: Promise.resolve() }),
  };
  const doc = { numPages: 3, getPage: async () => page, destroy: () => {} };
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => ({ promise: Promise.resolve(doc) }),
  };
});

describe('PdfSource', () => {
  beforeEach(async () => {
    (await pdfjsMock()).GlobalWorkerOptions.workerSrc = ''; // reset the shared global between tests
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
});
