import type { PageContent } from '../renderer/types';

/**
 * Resolves page indices to renderable rasters. `ImageSource` is the default; a
 * `PdfSource` (Phase 3) implements the same shape. Output is renderer-agnostic —
 * the same raster feeds the CSS and WebGL2 renderers.
 */
export interface Source {
  readonly pageCount: number;
  /**
   * Optional async initialization (e.g. loading a PDF to learn its page count).
   * Zine awaits this before reading `pageCount` / building spreads. Sources with a
   * synchronously-known page count (e.g. ImageSource) can omit it.
   */
  open?(): Promise<void>;
  /**
   * Decode/resolve a single page to a raster.
   *
   * `opts` is a hint, not a contract: it is passed only while the reader is zoomed in, and a
   * source is free to ignore it and return its normal full-page raster. Sources backed by a
   * fixed-resolution original (images) have nothing sharper to offer; vector sources (PDF) can
   * re-rasterize the requested region to recover the detail that magnifying pixels loses.
   */
  get(index: number, opts?: PageRequest): Promise<PageContent>;
  /** Hint that these pages will be needed soon; out-of-range indices are ignored. */
  prefetch(indices: number[]): void;
  /** Release any decoded resources. */
  destroy(): void;
  /**
   * Optional: register a handler called when a page's content has been upgraded
   * (e.g. a progressive PDF render swapping low-res for crisp), so the engine can
   * re-render that page if it's on screen.
   */
  onPageUpdate?(handler: (index: number) => void): void;
  /**
   * Optional: register a handler called as the document downloads, for a loading indicator.
   * Only sources that fetch bytes over the network (a PDF from a URL) report progress; image
   * books and sources built from already-in-memory bytes have nothing to report and omit this.
   */
  onProgress?(handler: (progress: LoadProgress) => void): void;
  /**
   * Optional: the page's plain text, for search. Sources backed by images can't have any and
   * simply omit this — `Zine.canSearch()` reports whether a book is searchable at all.
   */
  getText?(index: number): Promise<string>;
  /**
   * Optional: the original document, for a download control. Return null when there is nothing
   * to hand over — a source built from a pre-opened document has no bytes of its own, and an
   * image book is not a single file at all.
   */
  getDownload?(): Promise<DownloadInfo | null>;
  /**
   * Optional: the document's table of contents, for an outline panel. Return an empty array when
   * the document has none — PDFs frequently do not.
   */
  getOutline?(): Promise<OutlineItem[]>;
}

/**
 * A request for part of a page at a particular magnification, sent when the reader zooms in.
 *
 * A source that honours it returns a raster of `region` alone, rendered at `scale` times the
 * resolution it would normally use. Returning the whole page instead is always valid: the engine
 * tells the two apart by comparing the raster's aspect against the region's.
 */
export interface PageRequest {
  /** How much sharper than the fit-to-screen raster to render, matching the reader's zoom. */
  scale: number;
  /** The visible part of the page, as fractions of its width and height in [0,1]. */
  region: { x: number; y: number; width: number; height: number };
  /**
   * Upper bound (px) on either raster dimension the caller can upload; a source honouring it caps
   * its render scale so the tile fits the GPU. A hint, like the rest of PageRequest.
   */
  maxSize?: number;
}

/** One entry in a document's table of contents. */
export interface OutlineItem {
  /** The heading text. */
  title: string;
  /** Zero-based page it points at, or null when the destination cannot be resolved. */
  page: number | null;
  /** Nested entries; empty for a leaf. */
  children: OutlineItem[];
}

/** How far a document's download has got, for a loading indicator. */
export interface LoadProgress {
  /** Bytes fetched so far. */
  loaded: number;
  /** Total bytes when the server declares a content-length; 0 when it does not (chunked). */
  total: number;
}

/** A downloadable original document. */
export interface DownloadInfo {
  /** Where to fetch it, or a blob/object URL the caller can link to directly. */
  url: string;
  /** Suggested file name, used for the download attribute. */
  filename: string;
  /** True when `url` was created with `URL.createObjectURL` and must be revoked after use. */
  revoke?: boolean;
}
