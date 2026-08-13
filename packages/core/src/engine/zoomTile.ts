import type { PageContent } from '../renderer/types';
import type { PageRequest } from '../source/types';

/** A rectangle in container pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The current view: the zoom scale and the translate applied about the container origin. */
export interface View {
  scale: number;
  tx: number;
  ty: number;
}

/** One page of the spread, and where it is painted when unzoomed. */
export interface TilePage {
  index: number;
  rect: Rect;
  /** Which edge of this page meets the spine: +1 right, -1 left, 0 for a lone page. */
  gutterSide: -1 | 0 | 1;
}

/**
 * The gutter shadow the WebGL renderer bakes into every page: the inner tenth darkens toward the
 * spine, so a spread reads as a bound book rather than two flat panels.
 *
 * The overlay has to reproduce it. A tile is a raw page raster with no shading of its own, so
 * without this the shadow vanishes wherever the overlay covers the page and returns the moment it
 * hides, which reads as a shadow flickering on and off along the spine as the reader pans.
 *
 * Kept in step with FLAT_FRAG in renderer/webglRenderer.ts.
 */
export const GUTTER_DEPTH = 0.72;
export const GUTTER_WIDTH = 0.1;

/** What to draw: a page's raster region, and the container-space box it belongs in. */
export interface TilePlan {
  index: number;
  request: PageRequest;
  /** Where the tile lands on screen, in *untransformed* container pixels. */
  dest: Rect;
  /** The whole page's box, so the gutter shading spans the page and not just this tile. */
  page: Rect;
  /** Which edge of the page meets the spine; see {@link TilePage}. */
  gutterSide: -1 | 0 | 1;
}

/** Intersection of two rectangles, or null when they do not overlap. */
function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * What the reader can see, in untransformed container pixels.
 *
 * The renderer paints the book at its natural size and then scales the whole viewport about the
 * container origin, so a point p appears at `scale * p + t`. Inverting that gives the part of the
 * book inside the viewport.
 */
export function visibleRect(view: View, viewport: Rect): Rect {
  return {
    x: (viewport.x - view.tx) / view.scale,
    y: (viewport.y - view.ty) / view.scale,
    width: viewport.width / view.scale,
    height: viewport.height / view.scale,
  };
}

/** Whether two views are the same, so already-painted pixels still apply. */
export function sameView(a: View | null, b: View): boolean {
  return a !== null && a.scale === b.scale && a.tx === b.tx && a.ty === b.ty;
}

/**
 * Work out which part of each page is worth rasterizing sharply, and at what magnification.
 *
 * Returns the plan in untransformed container coordinates: the caller draws it under the same
 * transform the renderer uses, so the tile registers exactly over the pixels it replaces.
 */
export function planTiles(pages: TilePage[], view: View, viewport: Rect): TilePlan[] {
  if (view.scale <= 1) return [];
  const visible = visibleRect(view, viewport);

  const plans: TilePlan[] = [];
  for (const page of pages) {
    if (page.rect.width <= 0 || page.rect.height <= 0) continue;
    const hit = intersect(page.rect, visible);
    if (!hit) continue;
    plans.push({
      index: page.index,
      request: {
        scale: view.scale,
        region: {
          x: (hit.x - page.rect.x) / page.rect.width,
          y: (hit.y - page.rect.y) / page.rect.height,
          width: hit.width / page.rect.width,
          height: hit.height / page.rect.height,
        },
      },
      dest: hit,
      page: page.rect,
      gutterSide: page.gutterSide,
    });
  }
  return plans;
}

/**
 * A canvas laid over the book that paints crisp tiles on top of the magnified page.
 *
 * It sits outside the renderer on purpose: both renderers stretch a page raster to a fixed panel,
 * so neither can place a partial-page tile, and teaching them to would mean the same geometry
 * twice.
 *
 * **The overlay is a settled-state artifact.** It is hidden the instant the view starts changing
 * and shown again only once it stops. Three attempts to keep it registered on a moving page all
 * failed the same way: a tile covers one rectangle of one view, so the moment the view moves it is
 * wrong, and every scheme for correcting it mid-gesture (shift it, redraw it, fade it out) puts
 * two versions of the same text on screen at once. While the reader is panning they now see
 * exactly what an image book shows, a uniformly magnified page, which has nothing to disagree
 * with itself. The sharpening happens when the view is still, where it reads as the page
 * resolving rather than as the page tearing.
 */
export class ZoomOverlay {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;
  /** The view the pixels on the canvas were painted for; null when the canvas is blank. */
  #paintedFor: View | null = null;
  #visible = false;

  constructor(doc: Document, container: HTMLElement) {
    this.#canvas = doc.createElement('canvas');
    this.#canvas.className = 'zine-zoom-overlay';
    // No transition: an opacity animation runs on the compositor thread, independently of the
    // renderer's own redraw, which is precisely how two versions of the page end up on screen
    // together. Showing and hiding are instant, and only ever happen while the view is still.
    // pointer-events:none keeps every gesture reaching the container underneath. The canvas is
    // exactly the container's size, so it clips its own tiles and needs no wrapper to cut them.
    this.#canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;';
    container.append(this.#canvas);
    this.#ctx = this.#canvas.getContext('2d');
  }

  /** Whether the canvas already holds pixels painted for exactly this view. */
  matches(view: View): boolean {
    return sameView(this.#paintedFor, view);
  }

  /**
   * Drop back to the renderer's own magnified page, keeping the painted pixels for later.
   *
   * Called on every view change. The pixels stay on the canvas so a view that returns to where it
   * was can show them again without rasterizing.
   */
  hide(): void {
    if (!this.#visible) return;
    this.#visible = false;
    this.#canvas.style.opacity = '0';
  }

  /** Reveal pixels that are already painted for the current view. */
  show(): void {
    if (this.#visible || !this.#paintedFor) return;
    this.#visible = true;
    this.#canvas.style.opacity = '1';
  }

  /** Forget everything painted, e.g. when the page under the overlay changes. */
  clear(): void {
    this.hide();
    this.#paintedFor = null;
    const ctx = this.#ctx;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
  }

  /**
   * Paint `tiles` as the crisp pixels for `view`, and show them.
   *
   * The backing store matches the device pixel grid so the tiles are not resampled a second time
   * on the way to the screen.
   */
  draw(tiles: { plan: TilePlan; content: PageContent }[], view: View, viewport: Rect): void {
    if (tiles.length === 0) {
      this.clear();
      return;
    }

    const ctx = this.#ctx;
    if (ctx) {
      const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
      const w = Math.max(1, Math.round(viewport.width * dpr));
      const h = Math.max(1, Math.round(viewport.height * dpr));
      if (this.#canvas.width !== w || this.#canvas.height !== h) {
        this.#canvas.width = w;
        this.#canvas.height = h;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      // Match the renderer exactly: scale about the container origin, then translate.
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);
      for (const { plan, content } of tiles) {
        const d = plan.dest;
        ctx.drawImage(content, d.x, d.y, d.width, d.height);
        this.#shadeGutter(ctx, plan);
      }
    }

    // Recorded whether or not the paint happened: without a 2D context there are no pixels to
    // show, but the bookkeeping still has to stay consistent.
    this.#paintedFor = { ...view };
    this.#visible = false; // force show() past its no-op guard
    this.show();
  }

  /**
   * Darken a tile toward the spine, matching the shading the renderer bakes into the page.
   *
   * The gradient spans the whole page, not the tile: the tile is whatever part happens to be on
   * screen, so measuring from its edge would drag the shadow around as the reader pans.
   */
  #shadeGutter(ctx: CanvasRenderingContext2D, plan: TilePlan): void {
    if (plan.gutterSide === 0) return;
    const p = plan.page;
    const band = p.width * GUTTER_WIDTH;
    // From the spine edge inward, so the darkest point sits exactly on the fold.
    const spineX = plan.gutterSide > 0 ? p.x + p.width : p.x;
    const innerX = plan.gutterSide > 0 ? spineX - band : spineX + band;

    const d = plan.dest;
    const overlap = Math.min(d.x + d.width, Math.max(spineX, innerX)) - Math.max(d.x, Math.min(spineX, innerX));
    if (overlap <= 0) return; // this tile does not reach the gutter

    const gradient = ctx.createLinearGradient(spineX, 0, innerX, 0);
    // The renderer multiplies the page by mix(GUTTER_DEPTH, 1, smoothstep(d)), so paint the
    // complement in black. Sampled rather than a two-stop ramp because a linear fade against a
    // smoothstep one is visibly different where they meet, along the length of the spine.
    const STEPS = 8;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const s = t * t * (3 - 2 * t); // smoothstep(0, 1, t)
      gradient.addColorStop(t, `rgba(0, 0, 0, ${(1 - GUTTER_DEPTH) * (1 - s)})`);
    }
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(d.x, d.y, d.width, d.height);
    ctx.restore();
  }

  destroy(): void {
    this.#canvas.remove();
    this.#ctx = null;
  }
}
