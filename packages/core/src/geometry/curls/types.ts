/**
 * Curl type identifiers and the deform contract. Kept free of the deform
 * implementations so the engine (and CSS-only builds) can reference the union and the
 * validation list without pulling the WebGL-only curl math into the eager bundle.
 */
import type { PageMesh } from './mesh';

/** Where a corner-anchored curl folds from: y in [0,1], 0 = top edge, 1 = bottom edge. */
export interface CurlAnchor {
  y: number;
  /**
   * Full-width lone page (single-page mode). The leaf hinges at the container edge and
   * has no facing half to land on — deforms may soften and delay the flop so the curl
   * reads naturally before the renderer dissolves the sheet.
   */
  fill?: boolean;
}

export type CurlDeform = (mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor) => void;

export interface CurlModel {
  readonly deform: CurlDeform;
  /** True when the fold originates at a corner (`anchor.y`) rather than the whole edge. */
  readonly anchored: boolean;
}

export type CurlType = 'roll' | 'cone' | 'leaf' | 'flick' | 'simple';

export const CURL_TYPES: CurlType[] = ['roll', 'cone', 'leaf', 'flick', 'simple'];

export const DEFAULT_CURL: CurlType = 'cone';
