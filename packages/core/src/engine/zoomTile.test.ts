// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  planTiles,
  sameView,
  GUTTER_DEPTH,
  ZoomOverlay,
  type TilePage,
  type TilePlan,
} from './zoomTile';

/** A two-page spread filling an 800x600 container, each page 400 wide. */
const spread: TilePage[] = [
  { index: 0, rect: { x: 0, y: 0, width: 400, height: 600 }, gutterSide: 1 },
  { index: 1, rect: { x: 400, y: 0, width: 400, height: 600 }, gutterSide: -1 },
];
const viewport = { x: 0, y: 0, width: 800, height: 600 };

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

describe('ZoomOverlay', () => {
  const tile = (): { plan: TilePlan; content: HTMLCanvasElement } => ({
    plan: {
      index: 0,
      request: { scale: 2, region: { x: 0, y: 0, width: 1, height: 0.5 } },
      dest: { x: 0, y: 0, width: 400, height: 300 },
      page: { x: 0, y: 0, width: 400, height: 600 },
      gutterSide: 1,
    },
    content: document.createElement('canvas'),
  });

  const mount = (): { overlay: ZoomOverlay; el: HTMLCanvasElement } => {
    const host = document.createElement('div');
    document.body.append(host);
    const overlay = new ZoomOverlay(document, host);
    return { overlay, el: host.querySelector('canvas')! };
  };

  const view = { scale: 4, tx: -400, ty: -300 };

  it('never animates its visibility', () => {
    // An opacity transition runs on the compositor thread, independently of the renderer's own
    // redraw, which is how two versions of the page end up on screen at once. The overlay only
    // ever appears and disappears while the view is still, so a fade buys nothing and costs that.
    expect(mount().el.style.transition).toBe('');
  });

  it('shows itself once tiles are painted', () => {
    const { overlay, el } = mount();
    expect(el.style.opacity).toBe('0');
    overlay.draw([tile()], view, viewport);
    expect(el.style.opacity).toBe('1');
  });

  it('hides on any view change, rather than show pixels meant for another view', () => {
    // The heart of the fix: a tile is crisp for one view only. Showing it while the view moves
    // puts sharp text over the page's own moving text, which reads as a double image.
    const { overlay, el } = mount();
    overlay.draw([tile()], view, viewport);
    overlay.hide();
    expect(el.style.opacity).toBe('0');
  });

  it('knows when the view has returned to what it already painted', () => {
    // A pinch that lands where it started, or a pan clamped at the edge of the book: the pixels
    // are still exactly right, so they can come back with no rasterizing at all.
    const { overlay } = mount();
    overlay.draw([tile()], view, viewport);

    expect(overlay.matches(view)).toBe(true);
    expect(overlay.matches({ ...view, tx: view.tx - 1 })).toBe(false);
    expect(overlay.matches({ ...view, scale: 2 })).toBe(false);
  });

  it('shows again without repainting when the view comes back', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], view, viewport);
    overlay.hide();
    overlay.show();
    expect(el.style.opacity).toBe('1');
  });

  it('forgets its pixels on clear, so they cannot reappear over a different page', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], view, viewport);
    overlay.clear();

    expect(el.style.opacity).toBe('0');
    expect(overlay.matches(view)).toBe(false);
    overlay.show(); // nothing painted, so this must stay hidden
    expect(el.style.opacity).toBe('0');
  });

  it('clears rather than paint an empty tile set', () => {
    const { overlay, el } = mount();
    overlay.draw([tile()], view, viewport);
    overlay.draw([], view, viewport);
    expect(el.style.opacity).toBe('0');
    expect(overlay.matches(view)).toBe(false);
  });
});

describe('gutter shadow', () => {
  /** Record the gradient stops and fills the overlay asks a 2D context for. */
  const spy = (): { overlay: ZoomOverlay; stops: number[]; fills: number } => {
    const host = document.createElement('div');
    document.body.append(host);
    const stops: number[] = [];
    let fills = 0;
    const proto = window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown };
    const original = proto.getContext;
    proto.getContext = () =>
      ({
        setTransform: () => {},
        clearRect: () => {},
        translate: () => {},
        scale: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        fillRect: () => {
          fills++;
        },
        createLinearGradient: () => ({
          addColorStop: (_o: number, c: string) => stops.push(Number(/([\d.]+)\)$/.exec(c)![1])),
        }),
      }) as unknown as CanvasRenderingContext2D;
    const overlay = new ZoomOverlay(document, host);
    proto.getContext = original;
    return { overlay, stops, fills };
  };

  const view = { scale: 4, tx: -400, ty: -300 };
  const plan = (gutterSide: -1 | 0 | 1, dest = { x: 0, y: 0, width: 400, height: 600 }): TilePlan => ({
    index: 0,
    request: { scale: 2, region: { x: 0, y: 0, width: 1, height: 1 } },
    dest,
    page: { x: 0, y: 0, width: 400, height: 600 },
    gutterSide,
  });

  it('darkens a tile toward the spine, as the renderer does to the page', () => {
    // A tile is a raw page raster with no shading of its own, so without this the spine shadow
    // disappears wherever the overlay covers the page and returns the instant it hides.
    const { overlay, stops, fills } = spy();
    overlay.draw([{ plan: plan(1), content: document.createElement('canvas') }], view, viewport);

    expect(fills).toBe(1);
    expect(stops[0]).toBeCloseTo(1 - GUTTER_DEPTH); // darkest on the fold
    expect(stops[stops.length - 1]).toBe(0); // clear at the inner edge
  });

  it('eases the shadow rather than ramping it linearly', () => {
    // The renderer uses smoothstep; a linear fade beside it is visibly different along the spine.
    const { overlay, stops } = spy();
    overlay.draw([{ plan: plan(1), content: document.createElement('canvas') }], view, viewport);

    const mid = stops[Math.floor(stops.length / 2)]!;
    expect(mid).toBeCloseTo((1 - GUTTER_DEPTH) * 0.5); // smoothstep(0.5) = 0.5
    const quarter = stops[Math.floor(stops.length / 4)]!;
    expect(quarter).toBeGreaterThan((1 - GUTTER_DEPTH) * 0.75); // eased, not straight
  });

  it('leaves a lone page unshaded, which has no spine to shade against', () => {
    const { overlay, fills } = spy();
    overlay.draw([{ plan: plan(0), content: document.createElement('canvas') }], view, viewport);
    expect(fills).toBe(0);
  });

  it('skips a tile too far from the spine to reach the gutter', () => {
    // Panned deep into the outer edge of the page: no part of the band is on screen.
    const { overlay, fills } = spy();
    const far = plan(1, { x: 0, y: 0, width: 100, height: 600 });
    overlay.draw([{ plan: far, content: document.createElement('canvas') }], view, viewport);
    expect(fills).toBe(0);
  });
});

describe('sameView', () => {
  const v = { scale: 2, tx: -10, ty: -20 };

  it('holds only when every component matches', () => {
    expect(sameView(v, { ...v })).toBe(true);
    expect(sameView(v, { ...v, tx: -11 })).toBe(false);
    expect(sameView(v, { ...v, ty: -21 })).toBe(false);
    expect(sameView(v, { ...v, scale: 3 })).toBe(false);
  });

  it('is false against nothing painted yet', () => {
    expect(sameView(null, v)).toBe(false);
  });
});
