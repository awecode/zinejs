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
  /**
   * True when the sheet is flat by mid-turn, so a lone page can start dissolving earlier: there
   * is no curl left to read. Defaults to false, which suits a model still bent as it lands.
   */
  readonly flat?: boolean;
  /**
   * False to drop the specular highlight, for a sheet that never bends and so has no curve to
   * catch the light. Defaults to true.
   */
  readonly gloss?: boolean;
}

/**
 * The curl models carried in the bundle: the default, and the flat turn reduced motion falls
 * back to. Everything else is imported from `@zinejs/core/curls` and passed as a model, so a
 * book that never uses it never pays for it.
 */
export type CurlType = 'cone' | 'simple';

export const CURL_TYPES: CurlType[] = ['cone', 'simple'];

/**
 * Curl models that exist but are not bundled. Named only so passing one as a string can say what
 * to do about it instead of failing as an unknown value.
 */
export const IMPORTABLE_CURLS = ['roll', 'leaf', 'flick', 'silk'];

export const DEFAULT_CURL: CurlType = 'cone';

/** What the `curl` option accepts: a bundled name, or a model imported (or written) by the caller. */
export type CurlSpec = CurlType | CurlModel;
