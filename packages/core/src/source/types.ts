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
  /** Decode/resolve a single page to a raster. */
  get(index: number): Promise<PageContent>;
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
   * Optional: the page's plain text, for search. Sources backed by images can't have any and
   * simply omit this — `Zine.canSearch()` reports whether a book is searchable at all.
   */
  getText?(index: number): Promise<string>;
}
