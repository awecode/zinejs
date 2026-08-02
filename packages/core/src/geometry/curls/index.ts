/**
 * Page-curl registry. Each model turns a 0→1 flip progress into a bent page mesh; the
 * WebGL2 renderer picks one by the `curl` option. `anchored` models fold from a corner
 * given by `anchor.y` (0 = top, 1 = bottom — where the reader tapped); the others roll
 * the whole free edge and ignore it.
 *
 * Importing this module pulls in the deform math, so only the WebGL2 renderer does.
 * The engine references the lightweight `./types` (union + validation list) instead.
 */
import { deformRoll } from './roll';
import { deformSimple, deformBentFlip } from './simple';
import { deformFold } from './fold';
import { deformPeel } from './peel';
import type { CurlModel, CurlType } from './types';

export { createPageMesh, computeNormals, type PageMesh } from './mesh';
export { CURL_TYPES, DEFAULT_CURL } from './types';
export type { CurlAnchor, CurlDeform, CurlModel, CurlType } from './types';

export const CURLS: Record<CurlType, CurlModel> = {
  roll: { deform: deformRoll, deformFill: deformBentFlip, anchored: false },
  simple: { deform: deformSimple, anchored: false },
  fold: { deform: deformFold, anchored: true },
  peel: { deform: deformPeel, anchored: true },
};
