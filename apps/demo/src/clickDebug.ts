import type { Zine } from '@zinejs/core';

/**
 * Click / double-click diagnostics for the demo.
 *
 * When double-click zoom "does not work", the cause is ambiguous from the outside. Either:
 *
 *  1. the browser never paired the two clicks into a `dblclick` at all (they were too far
 *     apart in time, or the pointer drifted between them), so the flipbook never heard
 *     about it, or
 *  2. the browser did fire `dblclick`, and the flipbook deliberately ignored it because the
 *     point landed in a click-to-flip edge zone (by design, the tap turns the page there).
 *
 * Those need opposite fixes, so this logs the deciding evidence for each click: how long
 * since the previous one, how far the pointer moved, whether the browser counted it as the
 * second of a pair (`detail`), where it landed relative to the book, and whether the zoom
 * actually changed afterwards.
 */

/** How long to wait after a click before calling it a lone single click. Comfortably longer
 *  than any platform double-click threshold (Windows defaults to 500ms, and users can raise it). */
const PAIR_WINDOW_MS = 700;

/** Default of `ZineOptions.clickZoneSize`; the demo does not expose it as a control. */
const DEFAULT_CLICK_ZONE = 64;

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

export function installClickDebug(container: HTMLElement, zine: Zine, opts: Options): void {
  let lastClickAt: number | null = null;
  let lastClickPos: { x: number; y: number } | null = null;
  let pendingSingle: ReturnType<typeof setTimeout> | null = null;
  let sawDblClick = false;
  let zoomAtLastClick = zine.getZoom();
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
      // At scale 1 an edge zone belongs to click-to-flip, so a dblclick there will not zoom.
      blocks: zone !== 'dead',
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
    zoomAtLastClick = zine.getZoom();

    // Wait out the pairing window; if no dblclick arrives, say why it probably did not.
    if (pendingSingle !== null) clearTimeout(pendingSingle);
    sawDblClick = false;
    const thisGap = gap;
    const thisMoved = moved;
    const thisDetail = event.detail;
    pendingSingle = setTimeout(() => {
      pendingSingle = null;
      if (sawDblClick) return;
      if (thisDetail >= 2) {
        console.warn(
          `${TAG} the browser paired these clicks (detail=${thisDetail}) but fired no dblclick. ` +
            `That is unusual: something is swallowing the event.`,
        );
        return;
      }
      if (thisGap === null) return; // first click of the session, nothing to pair with
      const reasons: string[] = [];
      if (thisGap > 500) reasons.push(`the two clicks were ${thisGap.toFixed(0)}ms apart, past the usual ~500ms limit`);
      if (thisMoved !== null && thisMoved > 4) reasons.push(`the pointer moved ${thisMoved.toFixed(0)}px between them, so the browser did not treat them as one spot`);
      if (reasons.length > 0) {
        console.warn(`${TAG} NO double-click: ${reasons.join('; ')}. ${blocks ? '' : 'A faster click here would have zoomed.'}`);
      }
    }, PAIR_WINDOW_MS);
  });

  container.addEventListener('dblclick', (event: MouseEvent) => {
    sawDblClick = true;
    const { local, zone, blocks } = describe(event);
    console.log(`${TAG} dblclick ${local} zone=${zone} zoom=${zine.getZoom().toFixed(2)}x`);
    if (blocks) {
      console.warn(
        `${TAG} will NOT zoom: this is the ${zone} zone, which belongs to click-to-flip at ` +
          `zoom 1. Double-click nearer the middle to zoom, or set zoom.doubleClickInFlipZone.`,
      );
    }
    // The library zooms synchronously in its own dblclick listener, so by the next task the
    // outcome is settled: if the scale did not move, something rejected it.
    const before = zoomAtLastClick;
    setTimeout(() => {
      const after = zine.getZoom();
      if (after === before && !blocks) {
        console.warn(`${TAG} dblclick fired in a zoomable spot but the scale stayed ${after.toFixed(2)}x.`);
      }
    }, 0);
  });

  zine.on('zoomChanged', ({ scale }) => console.log(`${TAG} zoom -> ${scale.toFixed(2)}x`));

  console.log(
    `${TAG} click diagnostics on (clickToFlip='${opts.clickToFlip}', ` +
      `clickZoneSize=${opts.clickZoneSize ?? DEFAULT_CLICK_ZONE}px). Add ?clickdebug=0 to silence.`,
  );
}
