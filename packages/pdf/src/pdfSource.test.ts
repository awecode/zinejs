// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { PdfSource, type PdfSrc } from './pdfSource';

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

  it('throws a descriptive error when workerSrc is missing for a URL', async () => {
    const src = new PdfSource('doc.pdf');
    await expect(src.open()).rejects.toThrow(/workerSrc/);
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
});
