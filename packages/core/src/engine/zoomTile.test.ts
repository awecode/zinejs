// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { planTiles, sameTile, ZoomOverlay, type TilePage, type TilePlan } from './zoomTile';

/** A two-page spread filling an 800x600 container, each page 400 wide. */
const spread: TilePage[] = [
  { index: 0, rect: { x: 0, y: 0, width: 400, height: 600 } },
  { index: 1, rect: { x: 400, y: 0, width: 400, height: 600 } },
];
const viewport = { x: 0, y: 0, width: 800, height: 600 };

const plan = (region: TilePlan['request']['region'], index = 0, scale = 2): TilePlan => ({
  index,
  request: { scale, region },
  dest: { x: 0, y: 0, width: 1, height: 1 },
});

describe('planTiles', () => {
  it('asks for nothing while the book is not zoomed', () => {
    expect(planTiles(spread, { scale: 1, tx: 0, ty: 0 }, viewport)).toEqual([]);
  });

  it('asks only for the part of a page still on screen', () => {
    // At 2x anchored top-left the viewport shows 400x300 of the spread: the whole width of page 0
    // (it is 400 wide), the top half of its height, and nothing of page 1.
    const plans = planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.index).toBe(0);
    expect(plans[0]!.request.region).toEqual({ x: 0, y: 0, width: 1, height: 0.5 });
    expect(plans[0]!.dest).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('follows the reader across the gutter as they pan', () => {
    // Panning left by a full container width at 2x brings the right-hand page into view.
    const plans = planTiles(spread, { scale: 2, tx: -800, ty: 0 }, viewport);
    expect(plans.map((p) => p.index)).toEqual([1]);
    expect(plans[0]!.request.region.x).toBeCloseTo(0);
    expect(plans[0]!.request.region.width).toBeCloseTo(1);
  });

  it('splits the request when both pages are partly visible', () => {
    // Centred on the gutter: the right half of page 0 and the left half of page 1.
    const plans = planTiles(spread, { scale: 2, tx: -400, ty: 0 }, viewport);
    expect(plans.map((p) => p.index)).toEqual([0, 1]);
    expect(plans[0]!.request.region.x).toBeCloseTo(0.5);
    expect(plans[1]!.request.region.x).toBeCloseTo(0);
  });

  it('requests a smaller slice the further in the reader zooms', () => {
    const at2 = planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport)[0]!;
    const at8 = planTiles(spread, { scale: 8, tx: 0, ty: 0 }, viewport)[0]!;
    // This is what holds the cost flat: deeper zoom means less page, not more pixels.
    expect(at8.request.region.width).toBeLessThan(at2.request.region.width);
    expect(at8.request.scale).toBe(8);
  });

  it('keeps the region inside the page when the view overhangs it', () => {
    // A pan past the edge must not ask for negative or beyond-1 fractions: the source would have
    // to guess what to do with them, and a clamped region is exactly the visible part anyway.
    for (const tx of [200, -2000]) {
      for (const p of planTiles(spread, { scale: 3, tx, ty: 40 }, viewport)) {
        const r = p.request.region;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(r.y + r.height).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('skips a lone page that is scrolled entirely off screen', () => {
    const plans = planTiles(spread, { scale: 4, tx: -3000, ty: 0 }, viewport);
    expect(plans.every((p) => p.index === 1)).toBe(true);
  });
});

describe('ZoomOverlay.track', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
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
    const { clip } = mount();
    expect(clip.style.overflow).toBe('hidden');
  });

  it('shifts painted tiles to follow a pan, without waiting for a re-render', () => {
    // The bug this covers: the page slides under the reader's finger while a fresh tile is still
    // being rasterized. An overlay that stayed put read as the page having frozen mid-drag.
    const { overlay, el } = mount();
    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    expect(el.style.transform).toBe('');

    overlay.track({ scale: 2, tx: -120, ty: -40 });
    expect(el.style.transform).toBe('translate(-120px, -40px) scale(1)');
  });

  it('scales as well as shifts, so a pinch keeps the tiles registered', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], { scale: 2, tx: -100, ty: 0 }, viewport);

    // Painted at 2x/-100; now showing 4x/-300. Pixels at 2p-100 must land at 4p-300, so they
    // scale by 2 and shift by -300 - 2*(-100) = -100.
    overlay.track({ scale: 4, tx: -300, ty: 0 });
    expect(el.style.transform).toBe('translate(-100px, 0px) scale(2)');
  });

  it('spends the tracking shift when a fresh tile is painted', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    overlay.track({ scale: 2, tx: -120, ty: 0 });
    overlay.draw([tile()], { scale: 2, tx: -120, ty: 0 }, viewport);
    // The new pixels are already in the right place; keeping the shift would double it.
    expect(el.style.transform).toBe('');
  });

  it('does nothing before anything is painted, and drops the shift on clear', () => {
    const { overlay, el } = mount();
    overlay.track({ scale: 3, tx: -50, ty: -50 });
    expect(el.style.transform).toBe(''); // no pixels to move

    overlay.draw([tile()], { scale: 2, tx: 0, ty: 0 }, viewport);
    overlay.track({ scale: 2, tx: -60, ty: 0 });
    overlay.clear();
    expect(el.style.transform).toBe('');
  });
});

describe('sameTile', () => {
  it('treats a sub-pixel drift as the same tile', () => {
    // Otherwise every frame of a pan would re-rasterize the page for no visible gain.
    const a = plan({ x: 0.25, y: 0, width: 0.5, height: 1 });
    const b = plan({ x: 0.25 + 1e-6, y: 0, width: 0.5, height: 1 });
    expect(sameTile(a, b)).toBe(true);
  });

  it('separates tiles that differ by page, zoom, or region', () => {
    const base = plan({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(sameTile(base, plan({ x: 0.25, y: 0, width: 0.5, height: 1 }, 1))).toBe(false);
    expect(sameTile(base, plan({ x: 0.25, y: 0, width: 0.5, height: 1 }, 0, 4))).toBe(false);
    expect(sameTile(base, plan({ x: 0.6, y: 0, width: 0.5, height: 1 }))).toBe(false);
  });
});
