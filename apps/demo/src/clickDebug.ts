import type { Zine } from '@zinejs/core';

/**
 * Click / double-click diagnostics for the demo.
 *
 * The library detects double-clicks itself by pairing two raw `click` events within a short
 * window and spot (it does not rely on the browser's `dblclick`, which drops out on rapid
 * streaks). So when a double-click "does not zoom", the cause is one of:
 *
 *  1. the two clicks were too far apart in time or space to pair, so the library saw two
 *     separate single clicks, or
 *  2. they did pair, but the point landed in a live click-to-flip edge zone, where by design a
 *     double-click turns the page instead of zooming.
 *
 * This mirrors the library's pairing state and logs, per click, whether it paired, where it
 * landed relative to the book, and — for a real pair — whether the zoom actually changed.
 */

/** Default of `ZineOptions.clickZoneSize`; the demo does not expose it as a control. */
const DEFAULT_CLICK_ZONE = 64;

/** Mirror of the library's own click-pairing window (`DOUBLE_CLICK_MS` / `DOUBLE_CLICK_MOVE` in
 *  zine.ts): two clicks this close in time and space are treated as a double-click by the book,
 *  regardless of whether the browser fired a native `dblclick`. Kept in sync by hand. */
const LIB_PAIR_MS = 250;
const LIB_PAIR_MOVE = 24;

const TAG = '[zine:click]';

interface Options {
  clickToFlip: 'edge' | 'half' | 'off';
  clickZoneSize?: number;
}

/**
 * The rect the current spread is actually painted into, in container-local CSS px.
 *
 * This is not simply the container: a lone page (a cover, or single mode) is drawn as a
 * centered half, and the book as a whole is letterboxed when the container's shape differs
 * from the page's. The library hit-tests clicks against this painted region, so the
 * diagnosis has to use the same frame or it will describe the wrong zone.
 *
 * The renderer's own `measure()` is internal, so this recovers the region from the canvas
 * instead: read back the pixels and find the columns/rows that are not the cleared
 * background. That measures what is genuinely on screen, whatever the mode.
 */
function contentRect(
  el: HTMLElement,
): { x: number; y: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  const full = { x: 0, y: 0, width: r.width, height: r.height };
  const canvas = el.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return full;

  // preserveDrawingBuffer is on for this renderer, so the last frame is still readable.
  const probe = document.createElement('canvas');
  const w = (probe.width = Math.min(canvas.width, 400));
  const h = (probe.height = Math.min(canvas.height, 400));
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return full;
  try {
    ctx.drawImage(canvas, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // The renderer clears to transparent; anything painted has alpha.
        if (data[(y * w + x) * 4 + 3]! > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return full; // nothing painted yet
    return {
      x: (minX / w) * r.width,
      y: (minY / h) * r.height,
      width: ((maxX - minX + 1) / w) * r.width,
      height: ((maxY - minY + 1) / h) * r.height,
    };
  } catch {
    return full; // tainted canvas or no 2d context
  }
}

/** Which zone a book-local x lands in. Mirrors the library's own rule so the log can explain a
 *  refusal to zoom; if the two ever disagree, that disagreement is itself the bug. */
function zoneAt(x: number, bookWidth: number, opts: Options): 'left-flip' | 'right-flip' | 'dead' {
  if (opts.clickToFlip === 'off') return 'dead';
  if (opts.clickToFlip === 'half') return x > bookWidth / 2 ? 'right-flip' : 'left-flip';
  const zone = opts.clickZoneSize ?? DEFAULT_CLICK_ZONE;
  if (x <= zone) return 'left-flip';
  if (x >= bookWidth - zone) return 'right-flip';
  return 'dead';
}

/** Whether a click in `zone` will actually be claimed by click-to-flip (and so refuse to zoom).
 *  An edge zone only blocks zoom when the flip has somewhere to land: at the first spread the
 *  left zone is dead and at the last spread the right zone is dead, so a double-click there zooms.
 *  This mirrors the library's #canFlip gate via its public canFlipPrev/canFlipNext. */
function zoneBlocksZoom(zone: 'left-flip' | 'right-flip' | 'dead', zine: Zine): boolean {
  if (zone === 'left-flip') return zine.canFlipPrev();
  if (zone === 'right-flip') return zine.canFlipNext();
  return false;
}

export function installClickDebug(container: HTMLElement, zine: Zine, opts: Options): void {
  let lastClickAt: number | null = null;
  let lastClickPos: { x: number; y: number } | null = null;
  // Mirrors the library's own #lastClick: the first click of a pending pair, or null when the
  // last click already completed a pair (and so was consumed). Lets the log say, per click,
  // whether the library will treat THIS click as the second of a double-click.
  let libFirstClick: { t: number; x: number; y: number } | null = null;
  let seq = 0;

  const describe = (event: MouseEvent): { local: string; zone: string; blocks: boolean } => {
    // Zones only gate zooming at scale 1; once zoomed, a double-click always cycles the level.
    // Measuring is also only meaningful there, since the painted region is the magnified page
    // rather than the layout rect the library hit-tests against.
    if (zine.getZoom() > 1) {
      return { local: `zoom ${zine.getZoom().toFixed(2)}x`, zone: 'n/a (zoomed)', blocks: false };
    }
    const r = container.getBoundingClientRect();
    const b = contentRect(container);
    const x = event.clientX - r.left - b.x;
    const y = event.clientY - r.top - b.y;
    const zone = zoneAt(x, b.width, opts);
    const outside = x < 0 || y < 0 || x > b.width || y > b.height;
    return {
      local: `page(${x.toFixed(0)}, ${y.toFixed(0)}) of ${b.width.toFixed(0)}x${b.height.toFixed(0)}${outside ? ' — OUTSIDE THE PAGE' : ''}`,
      zone,
      // At scale 1 an edge zone belongs to click-to-flip and will not zoom, but only when the
      // flip can land: a dead edge zone (first spread back, last spread forward) zooms instead.
      blocks: zoneBlocksZoom(zone, zine),
    };
  };

  container.addEventListener('click', (event: MouseEvent) => {
    const now = performance.now();
    const gap = lastClickAt === null ? null : now - lastClickAt;
    const moved =
      lastClickPos === null
        ? null
        : Math.hypot(event.clientX - lastClickPos.x, event.clientY - lastClickPos.y);
    const { local, zone, blocks } = describe(event);
    seq += 1;

    console.log(
      `${TAG} click #${seq} detail=${event.detail}` +
        `${gap === null ? '' : ` gap=${gap.toFixed(0)}ms`}` +
        `${moved === null ? '' : ` moved=${moved.toFixed(0)}px`}` +
        ` ${local} zone=${zone}`,
    );

    lastClickAt = now;
    lastClickPos = { x: event.clientX, y: event.clientY };

    // Mirror the library's own click-pairing (see #bindDoubleClickZoom): it holds the first
    // click, and a second one within the window and spot completes a double-click (consuming
    // both, so the next click starts fresh). We report the library's verdict for THIS click
    // regardless of whether the browser bothered to fire a native `dblclick` — which it drops
    // on rapid streaks, the whole reason the library pairs clicks itself.
    const near =
      libFirstClick !== null &&
      Math.hypot(event.clientX - libFirstClick.x, event.clientY - libFirstClick.y) <= LIB_PAIR_MOVE;
    const inWindow = libFirstClick !== null && now - libFirstClick.t <= LIB_PAIR_MS;
    if (libFirstClick !== null && inWindow && near) {
      libFirstClick = null; // pair consumed → the next click starts a fresh pair
      if (blocks) {
        // A live flip zone owns this double-click at zoom 1, so the book turns instead of zooming.
        console.warn(
          `${TAG} double-click #${seq} lands in the ${zone} zone, which belongs to click-to-flip ` +
            `at zoom 1, so it turns the page instead of zooming. Double-click nearer the middle ` +
            `to zoom, or set zoom.doubleClickInFlipZone.`,
        );
      } else {
        const before = zine.getZoom();
        console.log(`${TAG} library double-click #${seq}: ${local} zone=${zone} — book zooms/cycles here.`);
        // The library zooms synchronously in its click listener, so the outcome is settled by
        // the next task: if the scale did not move, something rejected it.
        setTimeout(() => {
          const after = zine.getZoom();
          if (after === before) {
            console.warn(`${TAG} double-click #${seq} was in a zoomable spot but the scale stayed ${after.toFixed(2)}x.`);
          }
        }, 0);
      }
    } else {
      // Not a pair: either a fresh first click, or one that arrived too late/far to pair with the
      // pending first click. Say which, so a "double-click did nothing" is explainable.
      if (libFirstClick !== null && !(inWindow && near)) {
        const reasons: string[] = [];
        if (!inWindow) reasons.push(`${(now - libFirstClick.t).toFixed(0)}ms after the last click, past the ${LIB_PAIR_MS}ms window`);
        if (!near) reasons.push(`${Math.hypot(event.clientX - libFirstClick.x, event.clientY - libFirstClick.y).toFixed(0)}px from it, past the ${LIB_PAIR_MOVE}px spot`);
        console.log(`${TAG} click #${seq} did NOT pair (${reasons.join('; ')}) — it starts a new pair instead.`);
      }
      libFirstClick = { t: now, x: event.clientX, y: event.clientY }; // first of a possible pair
    }
  });

  zine.on('zoomChanged', ({ scale }) => console.log(`${TAG} zoom -> ${scale.toFixed(2)}x`));

  console.log(
    `${TAG} click diagnostics on (clickToFlip='${opts.clickToFlip}', ` +
      `clickZoneSize=${opts.clickZoneSize ?? DEFAULT_CLICK_ZONE}px). Add ?clickdebug=0 to silence.`,
  );
}
