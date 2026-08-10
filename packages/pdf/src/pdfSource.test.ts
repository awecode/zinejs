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

describe('PdfSource — getText', () => {
  const textDoc = () => {
    const page = {
      getViewport: () => ({ width: 120, height: 160 }),
      render: () => ({ promise: Promise.resolve() }),
      getTextContent: vi.fn(async () => ({
        items: [
          { str: 'Invoice', hasEOL: false },
          { str: ' total', hasEOL: true },
          { type: 'beginMarkedContent', id: 'm1' }, // no `str` — must be skipped
          { str: 'due', hasEOL: false },
        ],
      })),
    };
    const getPage = vi.fn(async () => page);
    return { page, getPage, doc: { numPages: 5, getPage, destroy: () => {} } as unknown as PdfSrc };
  };

  it('joins text runs, honouring line ends and skipping marked content', async () => {
    const { doc } = textDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    expect(await src.getText(0)).toBe('Invoice total\ndue');
  });

  it('asks pdf.js for the 1-indexed page', async () => {
    const { getPage, doc } = textDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    await src.getText(0);
    expect(getPage).toHaveBeenCalledWith(1);
  });

  it('extracts each page only once', async () => {
    const { page, doc } = textDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    await src.getText(2);
    await src.getText(2);
    expect(page.getTextContent).toHaveBeenCalledTimes(1);
  });

  it('is empty for a page with no text layer rather than throwing', async () => {
    const page = {
      getViewport: () => ({ width: 120, height: 160 }),
      render: () => ({ promise: Promise.resolve() }),
    }; // a scan: no getTextContent at all
    const doc = { numPages: 2, getPage: async () => page, destroy: () => {} } as unknown as PdfSrc;
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    expect(await src.getText(0)).toBe('');
  });

  it('drops cached text on destroy', async () => {
    const { page, doc } = textDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    await src.getText(0);
    src.destroy();
    expect(await src.getText(0)).toBe(''); // no document → resolves empty, not a rejection
    expect(page.getTextContent).toHaveBeenCalledTimes(1);
  });
});

describe('PdfSource — zoom tiles', () => {
  /** A document whose viewport tracks scale, so a tile's dimensions are meaningful. */
  const zoomDoc = () => {
    // Typed parameter, not `() =>`: it is what lets the assertions below read back the transform.
    const render = vi.fn((_opts: { transform?: number[] }) => ({ promise: Promise.resolve() }));
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 120 * scale, height: 160 * scale }),
      render,
    };
    const getPage = vi.fn(async () => page);
    return { render, getPage, doc: { numPages: 3, getPage, destroy: () => {} } as unknown as PdfSrc };
  };

  const tile = { scale: 4, region: { x: 0.25, y: 0.5, width: 0.5, height: 0.25 } };

  it('rasterizes only the visible region, at the magnification being viewed', async () => {
    const { doc } = zoomDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();

    const canvas = (await src.get(0, tile)) as HTMLCanvasElement;
    // Page is 120x160 at 1x, so 480x640 at 4x; the region is half its width and a quarter its
    // height. The tile covers just that: the whole point is that it does not grow with the zoom.
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(160);
  });

  it('offsets the page so the requested region lands in the tile', async () => {
    const { render, doc } = zoomDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();
    await src.get(0, tile);

    // Without the shift pdf.js would paint the top-left corner and the reader would pan to find
    // the wrong part of the page magnified.
    expect(render.mock.calls[0]?.[0].transform).toEqual([1, 0, 0, 1, -0.25 * 480, -0.5 * 640]);
  });

  it('caps how far it will rasterize, so a deep zoom cannot run away with memory', async () => {
    const { doc } = zoomDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();

    const full = { x: 0, y: 0, width: 1, height: 1 };
    const at6 = (await src.get(0, { scale: 6, region: full })) as HTMLCanvasElement;
    const at100 = (await src.get(0, { scale: 100, region: full })) as HTMLCanvasElement;
    expect(at100.width).toBe(at6.width);
  });

  it('serves the ordinary cached page when the reader is not zoomed', async () => {
    const { getPage, doc } = zoomDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();

    await src.get(0);
    await src.get(0, { scale: 1, region: { x: 0, y: 0, width: 1, height: 1 } });
    expect(getPage).toHaveBeenCalledTimes(1); // scale 1 is not a zoom: no re-render
  });

  it('does not cache tiles, which change with every pan', async () => {
    const { getPage, doc } = zoomDoc();
    const src = new PdfSource(doc, { preload: 0 });
    await src.open();

    await src.get(0, tile);
    await src.get(0, tile);
    expect(getPage).toHaveBeenCalledTimes(2);
  });
});

describe('PdfSource — getDownload', () => {
  it('offers the source URL for download, named from its last path segment', async () => {
    const src = new PdfSource('/docs/brochure-2024.pdf');
    expect(await src.getDownload()).toEqual({
      url: '/docs/brochure-2024.pdf',
      filename: 'brochure-2024.pdf',
    });
  });

  it('wraps raw bytes in a revocable object URL', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:fake' });
    try {
      const info = await new PdfSource(new ArrayBuffer(8)).getDownload();
      expect(info).toEqual({ url: 'blob:fake', filename: 'document.pdf', revoke: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('declines for a caller-owned document, whose bytes are not ours to hand out', async () => {
    const doc = { numPages: 2, getPage: async () => ({}), destroy: () => {} } as unknown as PdfSrc;
    expect(await new PdfSource(doc).getDownload()).toBeNull();
  });
});

describe('PdfSource — getOutline', () => {
  /** pdf.js hands back a tree whose destinations are either a named string or an explicit array
   *  starting with a page ref; both have to be resolved to a page index. */
  const outlineDoc = (nodes: unknown[]) =>
    ({
      numPages: 10,
      getPage: async () => ({}),
      destroy: () => {},
      getOutline: async () => nodes,
      getDestination: async (id: string) => (id === 'named' ? [{ num: 7 }] : null),
      getPageIndex: async (ref: { num: number }) => ref.num,
    }) as unknown as PdfSrc;

  it('resolves explicit and named destinations, and nests children', async () => {
    const src = new PdfSource(
      outlineDoc([
        {
          title: 'Introduction',
          dest: [{ num: 0 }],
          items: [{ title: 'Background', dest: [{ num: 2 }], items: [] }],
        },
        { title: 'Appendix', dest: 'named', items: [] },
      ]),
    );
    await src.open();
    expect(await src.getOutline()).toEqual([
      {
        title: 'Introduction',
        page: 0,
        children: [{ title: 'Background', page: 2, children: [] }],
      },
      { title: 'Appendix', page: 7, children: [] },
    ]);
  });

  it('keeps a heading whose destination cannot be resolved, with a null page', async () => {
    const src = new PdfSource(outlineDoc([{ title: 'Dangling', dest: 'missing', items: [] }]));
    await src.open();
    expect(await src.getOutline()).toEqual([{ title: 'Dangling', page: null, children: [] }]);
  });

  it('is empty for a document with no outline', async () => {
    const src = new PdfSource(outlineDoc([]));
    await src.open();
    expect(await src.getOutline()).toEqual([]);
  });

  it('is empty when pdf.js cannot provide outlines at all', async () => {
    const doc = { numPages: 2, getPage: async () => ({}), destroy: () => {} } as unknown as PdfSrc;
    const src = new PdfSource(doc);
    await src.open();
    expect(await src.getOutline()).toEqual([]);
  });
});
