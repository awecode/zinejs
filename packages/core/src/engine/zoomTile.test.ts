// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { planTiles, ZoomOverlay, type TilePage, type TilePlan } from './zoomTile';

/** A two-page spread filling an 800x600 container, each page 400 wide. */
const spread: TilePage[] = [
  { index: 0, rect: { x: 0, y: 0, width: 400, height: 600 } },
  { index: 1, rect: { x: 400, y: 0, width: 400, height: 600 } },
];
const viewport = { x: 0, y: 0, width: 800, height: 600 };

describe('planTiles', () => {
  // Margin 0 throughout: these pin the viewport-to-page mapping itself. The margin the engine
  // actually uses is covered separately below.
  it('asks for nothing while the book is not zoomed', () => {
    expect(planTiles(spread, { scale: 1, tx: 0, ty: 0 }, viewport, 0)).toEqual([]);
  });

  it('asks only for the part of a page still on screen', () => {
    // At 2x anchored top-left the viewport shows 400x300 of the spread: the whole width of page 0
    // (it is 400 wide), the top half of its height, and nothing of page 1.
    const plans = planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport, 0);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.index).toBe(0);
    expect(plans[0]!.request.region).toEqual({ x: 0, y: 0, width: 1, height: 0.5 });
    expect(plans[0]!.dest).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('follows the reader across the gutter as they pan', () => {
    // Panning left by a full container width at 2x brings the right-hand page into view.
    const plans = planTiles(spread, { scale: 2, tx: -800, ty: 0 }, viewport, 0);
    expect(plans.map((p) => p.index)).toEqual([1]);
    expect(plans[0]!.request.region.x).toBeCloseTo(0);
    expect(plans[0]!.request.region.width).toBeCloseTo(1);
  });

  it('splits the request when both pages are partly visible', () => {
    // Centred on the gutter: the right half of page 0 and the left half of page 1.
    const plans = planTiles(spread, { scale: 2, tx: -400, ty: 0 }, viewport, 0);
    expect(plans.map((p) => p.index)).toEqual([0, 1]);
    expect(plans[0]!.request.region.x).toBeCloseTo(0.5);
    expect(plans[1]!.request.region.x).toBeCloseTo(0);
  });

  it('requests a smaller slice the further in the reader zooms', () => {
    const at2 = planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport, 0)[0]!;
    const at8 = planTiles(spread, { scale: 8, tx: 0, ty: 0 }, viewport, 0)[0]!;
    // This is what holds the cost flat: deeper zoom means less page, not more pixels.
    expect(at8.request.region.width).toBeLessThan(at2.request.region.width);
    expect(at8.request.scale).toBe(8);
  });

  it('keeps the region inside the page when the view overhangs it', () => {
    // A pan past the edge must not ask for negative or beyond-1 fractions: the source would have
    // to guess what to do with them, and a clamped region is exactly the visible part anyway.
    for (const tx of [200, -2000]) {
      for (const p of planTiles(spread, { scale: 3, tx, ty: 40 }, viewport, 0)) {
        const r = p.request.region;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(r.y + r.height).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('skips a lone page that is scrolled entirely off screen', () => {
    const plans = planTiles(spread, { scale: 4, tx: -3000, ty: 0 }, viewport, 0);
    expect(plans.every((p) => p.index === 1)).toBe(true);
  });
});

describe('planTiles margin', () => {
  it('reaches past the viewport so a pan has crisp pixels in reserve', () => {
    // The seam this prevents: rasterizing only what is visible means the trailing edge of a drag
    // exposes page the tile never covered, magnified and soft against the sharp tile.
    const tight = planTiles(spread, { scale: 4, tx: -600, ty: -400 }, viewport, 0)[0]!;
    const padded = planTiles(spread, { scale: 4, tx: -600, ty: -400 }, viewport, 0.3)[0]!;

    const r = padded.request.region;
    const t = tight.request.region;
    expect(r.width).toBeGreaterThan(t.width);
    expect(r.height).toBeGreaterThan(t.height);
    // and it still contains what is actually on screen
    expect(r.x).toBeLessThanOrEqual(t.x);
    expect(r.x + r.width).toBeGreaterThanOrEqual(t.x + t.width);
  });

  it('still clamps to the page, however wide the margin', () => {
    for (const p of planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport, 2)) {
      const r = p.request.region;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('ZoomOverlay', () => {
  const tile = (): { plan: TilePlan; content: HTMLCanvasElement } => ({
    plan: {
      index: 0,
      request: { scale: 2, region: { x: 0, y: 0, width: 1, height: 0.5 } },
      dest: { x: 0, y: 0, width: 400, height: 300 },
    },
    content: document.createElement('canvas'),
  });

  const mount = (): { overlay: ZoomOverlay; el: HTMLCanvasElement; clip: HTMLElement } => {
    const host = document.createElement('div');
    document.body.append(host);
    const overlay = new ZoomOverlay(document, host);
    return {
      overlay,
      el: host.querySelector('canvas')!,
      clip: host.querySelector('.zine-zoom-clip')!,
    };
  };

  it('clips the tiles to the book, so a pan cannot carry them outside it', () => {
    // The canvas is transformed to follow the pan; without a clipping wrapper those pixels spill
    // across the page, since the container itself does not clip.
    expect(mount().clip.style.overflow).toBe('hidden');
  });

  it('shifts painted tiles to follow a pan, without waiting for a re-render', () => {
    // Otherwise the page slides under the reader's finger while the overlay stays put, which
    // reads as the page having frozen mid-drag.
    const { overlay, el, clip } = mount();
    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    expect(el.style.transform).toBe('');

    overlay.track({ scale: 2, tx: -120, ty: -40 }, viewport);
    expect(el.style.transform).toBe('translate(-120px, -40px) scale(1)');
    expect(clip.style.opacity).toBe('1');
  });

  it('scales as well as shifts, so a pinch keeps the tiles registered', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], { scale: 4, tx: -100, ty: 0 }, viewport);
    // Painted at 4x/-100, now showing 5x/-140: pixels at 4p-100 must land at 5p-140, so they
    // scale by 1.25 and shift by -140 - 1.25*(-100) = -15.
    overlay.track({ scale: 5, tx: -140, ty: 0 }, viewport);
    expect(el.style.transform).toBe('translate(-15px, 0px) scale(1.25)');
  });

  it('hides rather than show tiles that no longer cover the screen', () => {
    // The seam this exists to prevent: a tile ending part-way across the page puts sharp pixels
    // beside magnified ones, and that boundary is far more visible than uniform softness.
    const { overlay, clip } = mount();
    overlay.draw([tile()], { scale: 4, tx: -400, ty: -300 }, viewport);
    expect(clip.style.opacity).toBe('1');

    overlay.track({ scale: 4, tx: -2000, ty: -300 }, viewport); // panned clean past the reserve
    expect(clip.style.opacity).toBe('0');
  });

  it('re-renders once the reader pans past what is painted', () => {
    const { overlay } = mount();
    const view = { scale: 4, tx: -400, ty: -300 };
    overlay.draw([tile()], view, viewport);

    expect(overlay.isStale(view, viewport)).toBe(false);
    expect(overlay.isStale({ ...view, tx: -430 }, viewport)).toBe(false); // inside the margin
    expect(overlay.isStale({ ...view, tx: -2000 }, viewport)).toBe(true);
  });

  it('re-renders on zooming in, where the painted area alone would say it need not', () => {
    // Regression: staleness was area-only. A 2x tile still spans the smaller viewport of a 4x
    // view, so the re-render was skipped and 2x pixels were stretched to 4x — soft at exactly
    // the zoom that wants detail most.
    const { overlay } = mount();
    overlay.draw([tile()], { scale: 2, tx: -400, ty: -300 }, viewport);

    expect(overlay.isStale({ scale: 4, tx: -400, ty: -300 }, viewport)).toBe(true);
    // Zooming back out is not stale: those pixels are finer than the view now needs.
    overlay.draw([tile()], { scale: 4, tx: -400, ty: -300 }, viewport);
    expect(overlay.isStale({ scale: 2, tx: -400, ty: -300 }, viewport)).toBe(false);
  });

  it('keeps a stretched tile on screen while the sharper one is rendering', () => {
    // It still beats the page underneath, and dropping it would flash the soft page instead.
    const { overlay, clip } = mount();
    overlay.draw([tile()], { scale: 2, tx: -400, ty: -300 }, viewport);
    overlay.track({ scale: 4, tx: -400, ty: -300 }, viewport);
    expect(clip.style.opacity).toBe('1');
  });

  it('spends the tracking shift when a fresh tile is painted', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    overlay.track({ scale: 2, tx: -120, ty: 0 }, viewport);
    overlay.draw([tile()], { scale: 2, tx: -120, ty: 0 }, viewport);
    // The new pixels are already in the right place; keeping the shift would double it.
    expect(el.style.transform).toBe('');
  });

  it('does nothing before anything is painted, and drops the shift on clear', () => {
    const { overlay, el } = mount();
    overlay.track({ scale: 3, tx: -50, ty: -50 }, viewport);
    expect(el.style.transform).toBe(''); // no pixels to move

    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    overlay.track({ scale: 2, tx: -60, ty: 0 }, viewport);
    overlay.clear();
    expect(el.style.transform).toBe('');
    expect(overlay.isStale({ scale: 2, tx: 0, ty: 0 }, viewport)).toBe(true);
  });
});
