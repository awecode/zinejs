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
  getDocument(src: { url: string } | { data: ArrayBuffer | Uint8Array }): { promise: Promise<PdfDocumentLike> };
}

/** A URL, raw bytes, or a pre-created pdf.js document. */
export type PdfSrc = string | ArrayBuffer | Uint8Array | PdfDocumentLike;

export interface PdfSourceOptions {
  /** URL to pdf.js's worker. Optional: auto-resolved under bundlers; pass it for CDN / UMD / custom paths. */
  workerSrc?: string;
  /** Base render scale; each page is rasterized at `renderScale × devicePixelRatio`. Default 1. */
  renderScale?: number;
  /** How many adjacent pages to prefetch around a requested page. Default 1. */
  preload?: number;
  /** Soft cap on cached page bytes; least-recently-used pages evict beyond it. Default ~256 MB. */
  maxCacheBytes?: number;
}

const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;

interface CacheEntry {
  promise: Promise<PageContent>;
  bytes: number; // 0 until the render resolves and its size is known
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
  #maxCacheBytes: number;
  #cache = new Map<number, CacheEntry>();
  #cachedBytes = 0;

  constructor(src: PdfSrc, options: PdfSourceOptions = {}) {
    this.#src = src;
    this.#workerSrc = options.workerSrc;
    this.#renderScale = options.renderScale ?? 1;
    this.#preload = options.preload ?? 1;
    this.#maxCacheBytes = options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES;
  }

  async open(): Promise<void> {
    if (isPdfDocument(this.#src)) {
      this.#doc = this.#src;
    } else {
      const pdfjs = (await import('pdfjs-dist')) as unknown as PdfjsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = this.#resolveWorkerSrc(pdfjs.GlobalWorkerOptions.workerSrc);
      const params = typeof this.#src === 'string' ? { url: this.#src } : { data: this.#src };
      this.#doc = await pdfjs.getDocument(params).promise;
    }
    this.pageCount = this.#doc.numPages;
  }

  /** Precedence: an explicit `workerSrc` → an already-configured global → an auto-resolved default. */
  #resolveWorkerSrc(configured: string): string {
    if (this.#workerSrc) return this.#workerSrc;
    if (configured) return configured;
    try {
      // Bundlers (Vite / webpack 5 / esbuild) statically rewrite this and emit the worker,
      // so the common case needs no `workerSrc`. Non-bundler / UMD hosts pass it explicitly.
      return new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    } catch {
      throw new Error(
        "PdfSource: couldn't auto-resolve pdf.js's worker. Pass a `workerSrc` URL " +
          '(see the @zinejs/pdf README, "The pdf.js worker"), set pdfjs ' +
          'GlobalWorkerOptions.workerSrc yourself, or pass a pre-created pdf.js document.',
      );
    }
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
    this.#cachedBytes = 0;
    this.#doc = null;
  }

  #renderPage(index: number): Promise<PageContent> {
    const existing = this.#cache.get(index);
    if (existing) {
      // Mark most-recently-used: re-insert so it sits at the end of the Map's order.
      this.#cache.delete(index);
      this.#cache.set(index, existing);
      return existing.promise;
    }

    const entry: CacheEntry = { promise: undefined as unknown as Promise<PageContent>, bytes: 0 };
    entry.promise = this.#rasterize(index).then(
      (content) => {
        entry.bytes = content.width * content.height * 4; // RGBA
        this.#cachedBytes += entry.bytes;
        this.#evictToFit(index);
        return content;
      },
      (error: unknown) => {
        this.#cache.delete(index); // let a later get() retry
        throw error;
      },
    );
    this.#cache.set(index, entry);
    return entry.promise;
  }

  /** Drop least-recently-used pages (front of the Map) until under the byte cap. */
  #evictToFit(keepIndex: number): void {
    for (const [index, entry] of this.#cache) {
      if (this.#cachedBytes <= this.#maxCacheBytes) break;
      if (index === keepIndex || entry.bytes === 0) continue; // keep the newest; skip in-flight renders
      this.#cache.delete(index);
      this.#cachedBytes -= entry.bytes;
    }
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
