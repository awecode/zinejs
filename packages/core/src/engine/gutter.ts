import type { PageContent } from '../renderer/types';

/**
 * Print-gutter duplicate detection (the `gutterOverlap: 'auto'` option).
 *
 * Print PDFs sometimes repeat a strip at the spine: the left page's last N columns show the same
 * artwork as the right page's first N, so nothing is lost in the binding. Shown flat on screen
 * the strip appears twice. We look for that exact repeat and report its width; the renderers then
 * hide half of it on each page so the spread joins seamlessly.
 *
 * Conservative by design: anything short of a sharp, near-exact match reports 0 and the spread
 * renders as-is.
 */

/** Widest overlap searched, as a fraction of page width. Print allowances are a few percent. */
const MAX_OVERLAP = 0.06;
/** Rows sampled per strip (the strip is scaled vertically to this; columns stay native). */
const ROWS = 400;
/** Narrowest overlap considered, in columns. */
const MIN_COLUMNS = 3;
/** Luma below this counts as ink; near-white margin pixels are ignored so blank edges can't match. */
const INK = 235;
/** A match must be this close (mean absolute luma difference, 0..255) to count as a duplicate. */
const MAX_DIFF = 16;
/** Widths either side of the best match must differ by at least this factor and margin, which
 *  rejects uniform strips (solid colour matches at every width, so it has no sharp minimum). */
const CONTRAST_RATIO = 2.5;
const CONTRAST_MARGIN = 6;

function luma(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = (rgba[i * 4]! + rgba[i * 4 + 1]! + rgba[i * 4 + 2]!) / 3;
  return out;
}

/**
 * Find a repeated strip across the spine. `left` and `right` are RGBA pixels of two strips of the
 * same size (`width` columns, `height` rows): `left` ends at the left page's spine edge, `right`
 * starts at the right page's. Returns the overlap in columns, or 0 when there is no clear repeat.
 */
export function matchOverlap(
  left: Uint8ClampedArray,
  right: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const a = luma(left);
  const b = luma(right);
  const diff = new Float64Array(width + 1).fill(Infinity);
  let best = 0;
  for (let n = MIN_COLUMNS; n <= width; n++) {
    let sum = 0;
    let inked = 0;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let i = 0; i < n; i++) {
        const la = a[row + width - n + i]!;
        const lb = b[row + i]!;
        if (la < INK || lb < INK) {
          sum += Math.abs(la - lb);
          inked++;
        }
      }
    }
    // Too little ink to judge: the strip is mostly blank margin at this width.
    if (inked < Math.max(64, 0.02 * n * height)) continue;
    diff[n] = sum / inked;
    if (best === 0 || diff[n]! < diff[best]!) best = n;
  }
  if (best === 0 || diff[best]! > MAX_DIFF) return 0;

  const floor = Math.max(diff[best]! * CONTRAST_RATIO, diff[best]! + CONTRAST_MARGIN);
  const offset = Math.max(2, Math.round(best / 4));
  const neighbours = [best - offset, best + offset].filter((n) => n >= MIN_COLUMNS && n <= width);
  if (neighbours.length === 0 || neighbours.some((n) => diff[n]! < floor)) return 0;
  return best;
}

function stripPixels(page: PageContent, x: number, width: number): Uint8ClampedArray | null {
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, ROWS)
      : Object.assign(document.createElement('canvas'), { width, height: ROWS });
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (ctx === null) return null;
  ctx.drawImage(page, x, 0, width, page.height, 0, 0, width, ROWS);
  return ctx.getImageData(0, 0, width, ROWS).data;
}

/**
 * The print-gutter overlap between two facing pages, as a fraction of page width (0 = none found).
 * Pages of different sizes are never matched: their rows would not line up.
 */
export function detectOverlap(left: PageContent, right: PageContent): number {
  if (left.width !== right.width || left.height !== right.height || left.width === 0) return 0;
  const width = Math.max(MIN_COLUMNS, Math.ceil(left.width * MAX_OVERLAP));
  try {
    const a = stripPixels(left, left.width - width, width);
    const b = stripPixels(right, 0, width);
    if (a === null || b === null) return 0;
    return matchOverlap(a, b, width, ROWS) / left.width;
  } catch {
    // An unreadable raster (e.g. a tainted cross-origin image) just skips detection.
    return 0;
  }
}
