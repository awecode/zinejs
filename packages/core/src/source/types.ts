import type { PageContent } from '../renderer/types';

/**
 * Resolves page indices to renderable rasters. `ImageSource` is the default; a
 * `PdfSource` (Phase 3) implements the same shape. Output is renderer-agnostic —
 * the same raster feeds the CSS and Pixi renderers.
 */
export interface Source {
  readonly pageCount: number;
  /** Decode/resolve a single page to a raster. */
  get(index: number): Promise<PageContent>;
  /** Hint that these pages will be needed soon; out-of-range indices are ignored. */
  prefetch(indices: number[]): void;
  /** Release any decoded resources. */
  destroy(): void;
}
