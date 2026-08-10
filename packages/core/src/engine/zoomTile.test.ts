import { describe, it, expect } from 'vitest';
import { planTiles, sameTile, type TilePage, type TilePlan } from './zoomTile';

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

  it('asks each page for the quarter of itself still on screen', () => {
    // At 2x anchored top-left, the viewport covers the top-left quarter of the spread — which is
    // the left half of page 0 and nothing of page 1.
    const plans = planTiles(spread, { scale: 2, tx: 0, ty: 0 }, viewport);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.index).toBe(0);
    expect(plans[0]!.request.region).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(plans[0]!.dest).toEqual({ x: 0, y: 0, width: 400, height: 600 });
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
