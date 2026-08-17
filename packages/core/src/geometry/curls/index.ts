/**
 * Page-curl registry. Each model turns a 0→1 flip progress into a bent page mesh; the
 * WebGL2 renderer picks one by the `curl` option. `anchored` models fold from a corner
 * given by `anchor.y` (0 = top, 1 = bottom — where the reader tapped); the others roll
 * or rotate the whole free edge and ignore it.
 *
 * Only `cone` (the default) and `simple` (used for reduced motion) are reachable from the
 * engine, so only those two are bundled. The rest are exported here as individual models for
 * callers to import and pass to `curl` — see `@zinejs/core/curls`. Each is a separate binding
 * rather than a member of one object, which is what lets a bundler drop the ones nobody names.
 */
import { deformRoll } from './roll';
import { deformLeaf } from './leaf';
import { deformFlick } from './flick';
import { deformSilk } from './silk';
import type { CurlModel } from './types';

export { createPageMesh, computeNormals, type PageMesh } from './mesh';
export { CURL_TYPES, DEFAULT_CURL, IMPORTABLE_CURLS } from './types';
export type { CurlAnchor, CurlDeform, CurlModel, CurlType, CurlSpec } from './types';
export { cone, simple, BUNDLED_CURLS } from './bundled';

// `flat` says the sheet is already flat by mid-turn, so a lone page may dissolve on the earlier
// schedule. Roll qualifies despite bending: it rolls up and flops over well before it lands.
export const roll: CurlModel = { deform: deformRoll, anchored: false, flat: true };
export const leaf: CurlModel = { deform: deformLeaf, anchored: true };
export const flick: CurlModel = { deform: deformFlick, anchored: true };
export const silk: CurlModel = { deform: deformSilk, anchored: true };
