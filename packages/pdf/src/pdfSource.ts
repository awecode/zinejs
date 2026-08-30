import type {
  DownloadInfo,
  LoadProgress,
  OutlineItem,
  PageContent,
  PageRequest,
  Source,
} from '@zinejs/core';

/** Minimal shapes of the pdf.js API we rely on (avoids a hard type dependency). */
interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  /** `transform` is an affine matrix applied before painting, used to offset a cropped tile. */
  render(opts: { canvasContext: unknown; viewport: unknown; transform?: number[] }): {
    promise: Promise<void>;
  };
  /** Optional: absent on scanned PDFs with no text layer, and on hand-rolled document stubs. */
  getTextContent?(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }>;
}
/** A pdf.js outline entry. `dest` is either a named destination or an explicit array whose first
 *  element references the target page. */
interface PdfOutlineNode {
  title?: string;
  dest?: string | unknown[] | null;
  items?: PdfOutlineNode[];
}
interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy?(): void;
  /** Optional: absent on documents without a table of contents, and on hand-rolled stubs. */
  getOutline?(): Promise<PdfOutlineNode[] | null>;
  getDestination?(id: string): Promise<unknown[] | null>;
  getPageIndex?(ref: unknown): Promise<number>;
}
interface DocParams {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  disableAutoFetch?: boolean;
}
/** pdf.js's loading task: the document promise, plus an assignable download-progress callback. */
interface PdfLoadingTask {
  promise: Promise<PdfDocumentLike>;
  onProgress?: (p: LoadProgress) => void;
}
interface PdfjsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: DocParams): PdfLoadingTask;
  /** Present on real pdf.js builds; used to pick a matching CDN worker as a last resort. */
  version?: string;
}

/** A URL, raw bytes, or a pre-created pdf.js document. */
export type PdfSrc = string | ArrayBuffer | Uint8Array | PdfDocumentLike;

export interface PdfSourceOptions {
  /** URL to pdf.js's worker. Optional: auto-resolved from your bundler (`?url` / `new URL`) or
   *  `pdfjs-dist` install, then a version-matched CDN when `cdnFallback` is true. Pass it for
   *  CDN / UMD / CSP / offline, or if auto-resolve fails. */
  workerSrc?: string;
  /** Allow falling back to a version-matched jsDelivr worker when no local worker can be
   *  resolved (no bundler rewrite, no reachable install). Default true. Set false for
   *  CSP-restricted or offline apps, where a network worker would fail opaquely — you must
   *  then pass `workerSrc` (or set GlobalWorkerOptions.workerSrc). */
  cdnFallback?: boolean;
  /** Base render scale; each page is rasterized at `renderScale × devicePixelRatio`. Default 1. */
  renderScale?: number;
  /** How many adjacent pages to prefetch around a requested page. Default 1. */
  preload?: number;
  /** Soft cap on cached page bytes; least-recently-used pages evict beyond it. Default ~256 MB. */
  maxCacheBytes?: number;
  /** Paint a low-res page first, then swap to crisp (faster first paint). Default false. */
  progressive?: boolean;
  /** Ask pdf.js to fetch only the byte ranges visible pages need (range-capable servers). Default false. */
  disableAutoFetch?: boolean;
  /**
   * Load pdf.js's legacy build (transpiled with polyfills) instead of the modern one. The legacy
   * build runs on both old and modern browsers; the modern build is smaller and a touch faster but
   * needs a recent engine. Default true, favouring reach. Set false to serve the lean modern build
   * when your audience is on current browsers. Ignored when a pre-created pdf.js document or a
   * global `pdfjsLib` is supplied — those already picked their build.
   */
  legacy?: boolean;
}

const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;
// Linear-resolution fraction for the progressive low-res first pass (~1/9 the pixels).
const PROGRESSIVE_LOW_RATIO = 0.35;
// Ceiling on zoom-tile magnification. Past roughly this point a screen pixel already holds more
// detail than the reader can resolve, and rasterizing further only costs memory and time.
const MAX_ZOOM_RENDER_SCALE = 6;

/** Free a canvas's backing store. Safari in particular holds the memory until the surface is
 *  resized away, and a zoomed page is large enough for that to matter. */
function releaseCanvas(content: PageContent): void {
  if (typeof HTMLCanvasElement !== 'undefined' && content instanceof HTMLCanvasElement) {
    content.width = 0;
    content.height = 0;
  }
}

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

/** Last path segment of a URL, for naming a download. Falls back when the URL has no filename
 *  (a directory, a data: URI, or something unparseable). */
function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url, 'http://x').pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last && /\.[a-z0-9]+$/i.test(last) ? decodeURIComponent(last) : 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

/** True when `url` responds OK (HEAD, then GET). Used to pick a local worker path that exists. */
async function resourceExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) return true;
    // Some hosts reject HEAD; a tiny ranged GET still proves the file is there.
    if (head.status === 405 || head.status === 501) {
      const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/** Version-matched jsDelivr URL for the pdf.js worker (CDN last resort). */
export function cdnWorkerUrl(version: string, subpath: string): string {
  return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/${subpath}`;
}

let cdnWarned = false;

function warnCdnOnce(cdn: string): void {
  if (cdnWarned) return;
  cdnWarned = true;
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  console.warn(
    `@zinejs/pdf: couldn't resolve the pdf.js worker from your bundler or install; ` +
      `loading it from a CDN (${cdn}). This fails under strict CSP or offline. ` +
      `Pass workerSrc (or set pdfjsLib.GlobalWorkerOptions.workerSrc) to self-host, ` +
      `or set cdnFallback: false to disable this fallback.`,
  );
}

/** @internal Reset the CDN warn-once flag between unit tests. Tree-shaken from the bundle. */
export function __resetCdnWarnedForTests(): void {
  cdnWarned = false;
}

async function tryViteWorkerUrl(legacy: boolean): Promise<string | undefined> {
  // Vite (and Nuxt) rewrite `?url` imports to a served asset when they process the dep.
  // `webpackIgnore` keeps webpack/rspack from emitting an orphan worker chunk for this
  // Vite-only specifier; they throw at runtime, we catch, and the static new URL branch wins.
  try {
    const mod = legacy
      ? await import(
          /* webpackIgnore: true */ 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
        )
      : await import(
          /* webpackIgnore: true */ 'pdfjs-dist/build/pdf.worker.min.mjs?url'
        );
    const url = (mod as { default?: unknown }).default;
    return typeof url === 'string' && url ? url : undefined;
  } catch {
    return undefined;
  }
}

async function tryBundledWorkerUrl(legacy: boolean): Promise<string | undefined> {
  // Webpack 5 / rspack: static package-specifier new URL is rewritten to an emitted asset.
  // Specifiers must be string literals (not concatenated) for the bundler to see them.
  // Vite leaves this as a runtime join against @zinejs/pdf/dist → 404; resourceExists skips it.
  try {
    const bundled = legacy
      ? new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href
      : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    return (await resourceExists(bundled)) ? bundled : undefined;
  } catch {
    return undefined;
  }
}

async function trySiblingWorkerUrl(subpath: string): Promise<string | undefined> {
  // From `@zinejs/pdf/dist/index.js`, `../../../pdfjs-dist` is the package's node_modules
  // sibling under both pnpm (nested) and npm/yarn (hoisted). Concatenate so Vite does not
  // treat this as an import.meta.url asset rewrite (those need a static relative literal).
  // UMD rewrites `import.meta` to `{}`, so `.url` is undefined — skip rather than
  // `new URL(..., undefined)` throwing into the catch.
  const base = import.meta.url;
  if (!base) return undefined;
  try {
    const local = new URL('../../../pdfjs-dist/' + subpath, base).href;
    return (await resourceExists(local)) ? local : undefined;
  } catch {
    return undefined;
  }
}

/** The local worker probes, in resolution order. Real functions in production; unit tests pass a
 *  substitute set to {@link resolveWorkerSrc} to drive the CDN / opt-out branches deterministically. */
export type WorkerProbes = {
  vite: (legacy: boolean) => Promise<string | undefined>;
  bundled: (legacy: boolean) => Promise<string | undefined>;
  sibling: (subpath: string) => Promise<string | undefined>;
};

const defaultWorkerProbes: WorkerProbes = {
  vite: tryViteWorkerUrl,
  bundled: tryBundledWorkerUrl,
  sibling: trySiblingWorkerUrl,
};

/**
 * Resolve pdf.js's worker URL: explicit `workerSrc` → already-configured global → local probes
 * (Vite `?url`, webpack `new URL`, sibling install) → version-matched CDN (when `cdnFallback`).
 * Exported (not from the package entry) so tests can inject probe results; production calls it via
 * {@link PdfSource} with {@link defaultWorkerProbes}, so no test-only code ships in the bundle.
 */
export async function resolveWorkerSrc(
  args: {
    workerSrc: string | undefined;
    configured: string;
    legacy: boolean;
    cdnFallback: boolean;
    pdfjsVersion: string | undefined;
  },
  probes: WorkerProbes = defaultWorkerProbes,
): Promise<string> {
  if (args.workerSrc) return args.workerSrc;
  if (args.configured) return args.configured;

  const subpath = args.legacy ? 'legacy/build/pdf.worker.min.mjs' : 'build/pdf.worker.min.mjs';

  const vite = await probes.vite(args.legacy);
  if (vite) return vite;
  const bundled = await probes.bundled(args.legacy);
  if (bundled) return bundled;
  const sibling = await probes.sibling(subpath);
  if (sibling) return sibling;

  // Last resort: same version as the loaded library (avoids API/worker mismatch).
  if (args.pdfjsVersion && args.cdnFallback) {
    const cdn = cdnWorkerUrl(args.pdfjsVersion, subpath);
    warnCdnOnce(cdn);
    return cdn;
  }

  throw new Error(
    "PdfSource: couldn't auto-resolve pdf.js's worker. Pass a `workerSrc` URL " +
      '(see the @zinejs/pdf README, "The pdf.js worker"), set pdfjs ' +
      'GlobalWorkerOptions.workerSrc yourself, enable `cdnFallback`, ' +
      'or pass a pre-created pdf.js document.',
  );
}

/**
 * Load pdf.js. CDN / UMD hosts typically expose `globalThis.pdfjsLib` from a
 * `<script>` of pdf.js; bundlers have no global and resolve the dynamic import.
 *
 * `legacy` picks the transpiled build, which runs on older engines too. Its entry and worker are a
 * matched pair, so `#resolveWorkerSrc` reads the same flag. Each specifier is a plain string literal
 * so a bundler can see and emit the chosen chunk; the branch means only the selected one is fetched.
 */
async function loadPdfjs(legacy: boolean): Promise<PdfjsModule> {
  const g = globalThis as typeof globalThis & { pdfjsLib?: PdfjsModule };
  if (g.pdfjsLib) return g.pdfjsLib;
  const mod = legacy ? await import('pdfjs-dist/legacy/build/pdf.mjs') : await import('pdfjs-dist');
  return mod as unknown as PdfjsModule;
}

/**
 * Renders PDF pages to canvases for zinejs. pdf.js is a dependency of this
 * package, loaded lazily so it never lands in the core bundle. Async — pass it
 * to `new Zine`, which calls `open()` (learning the page count) before building
 * spreads.
 */
export class PdfSource implements Source {
  pageCount = 0;
  #src: PdfSrc;
  #workerSrc: string | undefined;
  #cdnFallback: boolean;
  #renderScale: number;
  #preload: number;
  #doc: PdfDocumentLike | null = null;
  #maxCacheBytes: number;
  #progressive: boolean;
  #disableAutoFetch: boolean;
  #legacy: boolean;
  #onProgress: ((progress: LoadProgress) => void) | null = null;
  #cache = new Map<number, CacheEntry>();
  #cachedBytes = 0;
  #onUpdate: ((index: number) => void) | null = null;
  /** Zoomed page rasters keyed `index@scale`, apart from #cache: one is worth many normal pages
   *  and would evict the whole spread from a byte cap sized for fit-to-screen. */
  #zoomCache = new Map<string, Promise<PageContent>>();

  /** Extracted page text, kept apart from #cache: text is scale-independent and negligible next
   *  to a raster, so it has no place in the byte budget that evicts bitmaps. */
  #textCache = new Map<number, Promise<string>>();

  constructor(src: PdfSrc, options: PdfSourceOptions = {}) {
    this.#src = src;
    this.#workerSrc = options.workerSrc;
    this.#cdnFallback = options.cdnFallback ?? true;
    this.#renderScale = options.renderScale ?? 1;
    this.#preload = options.preload ?? 1;
    this.#maxCacheBytes = options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES;
    this.#progressive = options.progressive ?? false;
    this.#disableAutoFetch = options.disableAutoFetch ?? false;
    this.#legacy = options.legacy ?? true;
  }

  /** Register a handler called when a page upgrades from its progressive low-res pass to crisp. */
  onPageUpdate(handler: (index: number) => void): void {
    this.#onUpdate = handler;
  }

  /** Register a handler called as the document downloads, driving a loading indicator. */
  onProgress(handler: (progress: LoadProgress) => void): void {
    this.#onProgress = handler;
  }

  async open(): Promise<void> {
    if (isPdfDocument(this.#src)) {
      this.#doc = this.#src;
    } else {
      const pdfjs = await loadPdfjs(this.#legacy);
      pdfjs.GlobalWorkerOptions.workerSrc = await this.#resolveWorkerSrc(
        pdfjs.GlobalWorkerOptions.workerSrc,
        pdfjs.version,
      );
      const params: DocParams =
        typeof this.#src === 'string' ? { url: this.#src } : { data: this.#src };
      if (this.#disableAutoFetch) params.disableAutoFetch = true;
      const task = pdfjs.getDocument(params);
      if (this.#onProgress) task.onProgress = this.#onProgress;
      this.#doc = await task.promise;
    }
    this.pageCount = this.#doc.numPages;
  }

  /**
   * Precedence: explicit `workerSrc` → already-configured global → auto default (Vite `?url`,
   * webpack `new URL`, sibling install, then version-matched CDN when `cdnFallback`). The ordering
   * and probes live in {@link resolveWorkerSrc}; this just forwards this source's settings.
   */
  #resolveWorkerSrc(configured: string, pdfjsVersion: string | undefined): Promise<string> {
    return resolveWorkerSrc({
      workerSrc: this.#workerSrc,
      configured,
      legacy: this.#legacy,
      cdnFallback: this.#cdnFallback,
      pdfjsVersion,
    });
  }

  get(index: number, opts?: PageRequest): Promise<PageContent> {
    // A zoomed request wants detail the fit-to-screen raster never had. PDF pages are vector, so
    // re-render at the magnification being viewed. Memoized per zoom level, not in the byte-capped
    // page cache: a zoomed page is many times the size of a normal one and would evict the whole
    // spread, and a reader who zooms out and back in should not pay to render it twice.
    if (opts && opts.scale > 1) return this.#renderZoomed(index, opts.scale, opts.maxSize);

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

  /**
   * The page's text, for search. Empty for a page with no text layer (a scan, or a pdf.js build
   * without text extraction) — callers treat that as "nothing to match" rather than an error.
   */
  getText(index: number): Promise<string> {
    const cached = this.#textCache.get(index);
    if (cached) return cached;
    const pending = this.#extractText(index).catch(() => '');
    this.#textCache.set(index, pending);
    return pending;
  }

  /**
   * The document's table of contents, flattened into the shape the outline panel wants.
   *
   * Empty when the PDF has no outline, which is common. Destinations are resolved to page
   * indices here rather than in the UI: doing it once, up front, keeps clicking an entry
   * instant, and an entry whose destination cannot be resolved is kept with a null page so the
   * heading still shows.
   */
  async getOutline(): Promise<OutlineItem[]> {
    const doc = this.#doc;
    if (!doc || typeof doc.getOutline !== 'function') return [];
    let nodes: PdfOutlineNode[] | null;
    try {
      nodes = await doc.getOutline();
    } catch {
      return [];
    }
    if (!nodes?.length) return [];
    const convert = async (list: PdfOutlineNode[]): Promise<OutlineItem[]> =>
      Promise.all(
        list.map(async (node) => ({
          title: (node.title ?? '').trim() || 'Untitled',
          page: await this.#destinationPage(node.dest),
          children: node.items?.length ? await convert(node.items) : [],
        })),
      );
    return convert(nodes);
  }

  /** Resolve a pdf.js destination to a zero-based page index, or null if it cannot be. */
  async #destinationPage(dest: string | unknown[] | null | undefined): Promise<number | null> {
    const doc = this.#doc;
    if (!doc || dest == null) return null;
    try {
      // A named destination has to be looked up before it yields the usual explicit array.
      const explicit =
        typeof dest === 'string' ? await doc.getDestination?.(dest) : (dest as unknown[]);
      const ref = explicit?.[0];
      if (ref == null) return null;
      // Some destinations carry a bare page number instead of a reference.
      if (typeof ref === 'number') return ref;
      const index = await doc.getPageIndex?.(ref);
      return typeof index === 'number' ? index : null;
    } catch {
      return null; // a broken destination should not cost us the whole outline
    }
  }

  /**
   * The original PDF, for a download control.
   *
   * Null when the source was handed a pre-opened pdf.js document: the bytes belong to whoever
   * created it, and re-fetching them is not this class's call to make.
   */
  async getDownload(): Promise<DownloadInfo | null> {
    const src = this.#src;
    if (typeof src === 'string') {
      return { url: src, filename: filenameFromUrl(src) };
    }
    if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
      const blob = new Blob([src as BlobPart], { type: 'application/pdf' });
      return { url: URL.createObjectURL(blob), filename: 'document.pdf', revoke: true };
    }
    return null;
  }

  async #extractText(index: number): Promise<string> {
    if (this.#doc === null) {
      throw new Error('PdfSource: use after open() — the document is not loaded.');
    }
    const page = await this.#doc.getPage(index + 1); // pdf.js pages are 1-indexed
    if (typeof page.getTextContent !== 'function') return '';
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue; // marked-content entries carry no text
      text += item.str;
      // pdf.js splits a visual line into runs; only hasEOL ends one.
      text += item.hasEOL ? '\n' : '';
    }
    return text;
  }

  destroy(): void {
    this.#doc?.destroy?.();
    this.#cache.clear();
    for (const pending of this.#zoomCache.values()) {
      void pending.then(releaseCanvas).catch(() => {});
    }
    this.#zoomCache.clear();
    this.#textCache.clear();
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

    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const full = this.#renderScale * dpr;
    const firstScale = this.#progressive ? full * PROGRESSIVE_LOW_RATIO : full;

    const entry: CacheEntry = { promise: undefined as unknown as Promise<PageContent>, bytes: 0 };
    entry.promise = this.#rasterize(index, firstScale).then(
      (content) => {
        entry.bytes = content.width * content.height * 4; // RGBA
        this.#cachedBytes += entry.bytes;
        this.#evictToFit(index);
        if (this.#progressive) this.#upgrade(index, entry, full);
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

  /** Progressive: re-render at full resolution, swap it into the cache, and signal an update. */
  #upgrade(index: number, entry: CacheEntry, fullScale: number): void {
    void this.#rasterize(index, fullScale)
      .then((hi) => {
        if (this.#cache.get(index) !== entry) return; // evicted or replaced meanwhile
        this.#cachedBytes -= entry.bytes;
        entry.promise = Promise.resolve(hi);
        entry.bytes = hi.width * hi.height * 4;
        this.#cachedBytes += entry.bytes;
        this.#evictToFit(index);
        this.#onUpdate?.(index);
      })
      .catch(() => {}); // keep the low-res if the upgrade fails
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

  /**
   * Render a whole page at zoom magnification, memoized by page and zoom level.
   *
   * Whole-page rather than a crop of what is visible: the renderer draws a page as one texture, so
   * a partial raster cannot be handed to it, and a crop would have to be re-rendered on every pan
   * anyway. Held apart from the byte-capped page cache, which is sized for fit-to-screen rasters.
   */
  #renderZoomed(index: number, zoom: number, maxSize?: number): Promise<PageContent> {
    const scale = Math.min(zoom, MAX_ZOOM_RENDER_SCALE);
    const key = `${index}@${scale}`;
    const cached = this.#zoomCache.get(key);
    if (cached) return cached;

    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const promise = this.#rasterize(index, this.#renderScale * dpr * scale, maxSize).catch(
      (error: unknown) => {
        this.#zoomCache.delete(key); // let a later zoom retry
        throw error;
      },
    );
    // One zoom level at a time, but both pages of the spread at that level.
    for (const [k, pending] of this.#zoomCache) {
      if (!k.endsWith(`@${scale}`)) {
        this.#zoomCache.delete(k);
        void pending.then(releaseCanvas).catch(() => {});
      }
    }
    this.#zoomCache.set(key, promise);
    return promise;
  }

  async #rasterize(index: number, scale: number, maxSize?: number): Promise<PageContent> {
    if (this.#doc === null) throw new Error('PdfSource: use after open() — the document is not loaded.');
    const page = await this.#doc.getPage(index + 1); // pdf.js pages are 1-indexed
    // Cap the scale so neither axis exceeds the GPU's texture limit: past it the upload paints black
    // (the renderer downscales as a backstop, but rendering to fit avoids the wasted memory spike).
    if (maxSize !== undefined && maxSize > 0) {
      const base = page.getViewport({ scale: 1 });
      const fit = maxSize / Math.max(base.width, base.height);
      scale = Math.min(scale, fit);
    }
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
}
