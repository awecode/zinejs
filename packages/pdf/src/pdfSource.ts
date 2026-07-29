import type { PageContent, Source } from '@zinejs/core';

/** Minimal shapes of the pdf.js API we rely on (avoids a hard type dependency). */
interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void> };
}
interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy?(): void;
}
interface PdfjsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: string | { data: ArrayBuffer | Uint8Array }): { promise: Promise<PdfDocumentLike> };
}

/** A URL, raw bytes, or a pre-created pdf.js document. */
export type PdfSrc = string | ArrayBuffer | Uint8Array | PdfDocumentLike;

export interface PdfSourceOptions {
  /** URL to pdf.js's worker (pdf.worker.min.mjs). Required unless a pre-created document is passed. */
  workerSrc?: string;
  /** Base render scale; each page is rasterized at `renderScale × devicePixelRatio`. Default 1. */
  renderScale?: number;
  /** How many adjacent pages to prefetch around a requested page. Default 1. */
  preload?: number;
}

function isPdfDocument(src: PdfSrc): src is PdfDocumentLike {
  return (
    typeof src === 'object' &&
    src !== null &&
    'numPages' in src &&
    typeof (src as PdfDocumentLike).getPage === 'function'
  );
}

/**
 * Renders PDF pages to canvases for zinejs. pdf.js is a peer dependency, loaded
 * lazily so it never lands in the core bundle. Async — pass it to `new Zine`,
 * which calls `open()` (learning the page count) before building spreads.
 */
export class PdfSource implements Source {
  pageCount = 0;
  #src: PdfSrc;
  #workerSrc: string | undefined;
  #renderScale: number;
  #preload: number;
  #doc: PdfDocumentLike | null = null;
  #cache = new Map<number, Promise<PageContent>>();

  constructor(src: PdfSrc, options: PdfSourceOptions = {}) {
    this.#src = src;
    this.#workerSrc = options.workerSrc;
    this.#renderScale = options.renderScale ?? 1;
    this.#preload = options.preload ?? 1;
  }

  async open(): Promise<void> {
    if (isPdfDocument(this.#src)) {
      this.#doc = this.#src;
    } else {
      if (this.#workerSrc === undefined) {
        throw new Error(
          "PdfSource: `workerSrc` is required — point it at pdf.js's worker, e.g. " +
            "workerSrc: new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href. " +
            'Not needed only when you pass a pre-created pdf.js document.',
        );
      }
      const pdfjs = (await import('pdfjs-dist')) as unknown as PdfjsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = this.#workerSrc;
      const params = typeof this.#src === 'string' ? this.#src : { data: this.#src };
      this.#doc = await pdfjs.getDocument(params).promise;
    }
    this.pageCount = this.#doc.numPages;
  }

  get(index: number): Promise<PageContent> {
    const decoded = this.#renderPage(index);
    for (let d = 1; d <= this.#preload; d++) {
      this.prefetch([index - d, index + d]);
    }
    return decoded;
  }

  prefetch(indices: number[]): void {
    for (const i of indices) {
      if (i >= 0 && i < this.pageCount) {
        void this.#renderPage(i).catch(() => {}); // prefetch failures surface on a real get()
      }
    }
  }

  destroy(): void {
    this.#doc?.destroy?.();
    this.#cache.clear();
    this.#doc = null;
  }

  #renderPage(index: number): Promise<PageContent> {
    const cached = this.#cache.get(index);
    if (cached) return cached;

    const promise = this.#rasterize(index).catch((error: unknown) => {
      this.#cache.delete(index); // let a later get() retry
      throw error;
    });
    this.#cache.set(index, promise);
    return promise;
  }

  async #rasterize(index: number): Promise<PageContent> {
    if (this.#doc === null) throw new Error('PdfSource: use after open() — the document is not loaded.');
    const page = await this.#doc.getPage(index + 1); // pdf.js pages are 1-indexed
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const viewport = page.getViewport({ scale: this.#renderScale * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
}
