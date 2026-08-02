/**
 * Curl type identifiers and the deform contract. Kept free of the deform
 * implementations so the engine (and CSS-only builds) can reference the union and the
 * validation list without pulling the WebGL-only curl math into the eager bundle.
 */
import type { PageMesh } from './mesh';

/** Where a corner-anchored curl folds from: y in [0,1], 0 = top edge, 1 = bottom edge. */
export interface CurlAnchor {
  y: number;
}

export type CurlDeform = (mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor) => void;

export interface CurlModel {
  readonly deform: CurlDeform;
  /** Single-page (fill) variant for curls whose spread form assumes a centered spine or a
   *  neighbouring page. Used in fill mode when present; otherwise `deform` is used as-is. */
  readonly deformFill?: CurlDeform;
  /** True when the fold originates at a corner (`anchor.y`) rather than the whole edge. */
  readonly anchored: boolean;
}

export type CurlType = 'roll' | 'simple' | 'fold' | 'peel';

export const CURL_TYPES: CurlType[] = ['roll', 'simple', 'fold', 'peel'];

export const DEFAULT_CURL: CurlType = 'roll';
