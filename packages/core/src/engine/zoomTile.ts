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
}

/** What to draw: a page's raster region, and the container-space box it belongs in. */
export interface TilePlan {
  index: number;
  request: PageRequest;
  /** Where the tile lands on screen, in *untransformed* container pixels. */
  dest: Rect;
}

/**
 * How far past the viewport to rasterize, as a fraction of its size on each side.
 *
 * This is the reserve a pan draws on. Within it the sharp pixels are already on the canvas and
 * simply slide; past it they run out and the book falls back to the renderer's own raster.
 */
export const TILE_MARGIN = 0.3;

/** Intersection of two rectangles, or null when they do not overlap. */
function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** Whether `inner` lies entirely inside `outer`, give or take a rounding error. */
function contains(outer: Rect, inner: Rect): boolean {
  const EPS = 1e-6;
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  );
}

/**
 * What the reader can see, in untransformed container pixels.
 *
 * The renderer paints the book at its natural size and then scales the whole viewport about the
 * container origin, so a point p appears at `scale * p + t`. Inverting that gives the part of the
 * book inside the viewport. `margin` widens it by a fraction of the viewport on every side.
 */
export function visibleRect(view: View, viewport: Rect, margin = 0): Rect {
  const w = viewport.width / view.scale;
  const h = viewport.height / view.scale;
  return {
    x: (viewport.x - view.tx) / view.scale - w * margin,
    y: (viewport.y - view.ty) / view.scale - h * margin,
    width: w * (1 + 2 * margin),
    height: h * (1 + 2 * margin),
  };
}

/**
 * Work out which part of each page is worth rasterizing sharply, and at what magnification.
 *
 * Returns the plan in untransformed container coordinates: the caller draws it under the same
 * transform the renderer uses, so the tile registers exactly over the pixels it replaces.
 */
export function planTiles(
  pages: TilePage[],
  view: View,
  viewport: Rect,
  margin = TILE_MARGIN,
): TilePlan[] {
  if (view.scale <= 1) return [];
  const visible = visibleRect(view, viewport, margin);

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
 * The tiles are shown **only while they cover everything visible**. A tile that ended part-way
 * across the page would put sharp pixels beside magnified ones, and that boundary reads as a
 * shadow far more plainly than the softness it was there to fix. Falling back to a uniformly
 * magnified page has no edge to notice, so panning past the reserve degrades instead of tearing.
 */
export class ZoomOverlay {
  #clip: HTMLDivElement;
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;
  /** The view the pixels were painted under, and the area they cover; null when nothing is up. */
  #painted: { view: View; area: Rect } | null = null;

  constructor(doc: Document, container: HTMLElement) {
    // The canvas is transformed to follow a pan, which would carry it outside the book: the
    // renderers clip against their own element and the container does not clip at all. A wrapper
    // holds the clip so the transform has something to be cut against.
    this.#clip = doc.createElement('div');
    this.#clip.className = 'zine-zoom-clip';
    this.#clip.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;' +
      'opacity:0;transition:opacity 120ms linear;';

    // left/top/transform-origin are set in draw(), which reaches the canvas past the viewport to
    // hold the margin.
    this.#canvas = doc.createElement('canvas');
    this.#canvas.className = 'zine-zoom-overlay';
    this.#canvas.style.cssText = 'position:absolute;';
    this.#clip.append(this.#canvas);
    container.append(this.#clip);
    this.#ctx = this.#canvas.getContext('2d');
  }

  /** Whether the painted pixels still span everything on screen. */
  #spansScreen(view: View, viewport: Rect): boolean {
    const p = this.#painted;
    return p !== null && contains(p.area, visibleRect(view, viewport));
  }

  /**
   * Whether re-rasterizing would improve on what is painted.
   *
   * Two ways to fall behind, and the second is easy to miss: the reader pans past the edge of the
   * reserve, or zooms *in*, so the pixels are stretched past the resolution they were rendered at.
   * A tile from a lower zoom still spans the smaller viewport of a higher one, so asking about
   * area alone calls it good and leaves the page soft at the very zoom that needs detail most.
   */
  isStale(view: View, viewport: Rect): boolean {
    const p = this.#painted;
    if (!p || !this.#spansScreen(view, viewport)) return true;
    return p.view.scale < view.scale - 1e-6;
  }

  /**
   * Follow a view change immediately, without re-rasterizing.
   *
   * Re-rendering is slow enough to need debouncing, but the page underneath moves with the
   * reader's finger. Left alone the tiles would sit still on top of it and the page would look
   * frozen; shifted, they stay registered and the pan tracks the cursor.
   */
  track(view: View, viewport: Rect): void {
    const p = this.#painted;
    if (!p) return;
    // Spanning the screen is the whole test here, resolution is not: a tile stretched by a zoom
    // still beats the page underneath, and a sharper one is already on its way. Only a tile that
    // stops mid-page has to go, since its edge is what reads as a seam.
    if (!this.#spansScreen(view, viewport)) {
      this.#clip.style.opacity = '0';
      return;
    }
    // transform-origin is the container origin, so this is exactly the renderer's own transform
    // rebased from the view the pixels were painted under to the current one.
    const a = view.scale / p.view.scale;
    this.#canvas.style.transform = `translate(${view.tx - a * p.view.tx}px, ${
      view.ty - a * p.view.ty
    }px) scale(${a})`;
    this.#clip.style.opacity = '1';
  }

  /** Drop every tile and hide the overlay, revealing the renderer's own pixels again. */
  clear(): void {
    if (!this.#painted) return;
    this.#painted = null;
    this.#clip.style.opacity = '0';
    this.#canvas.style.transform = '';
    const ctx = this.#ctx;
    if (ctx) {
      // Reset first: the transform left over from draw() would clear the wrong region.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
  }

  /**
   * Paint `tiles` under `view`. Sizes the backing store to the device pixel grid so the tiles are
   * not resampled a second time on the way to the screen.
   */
  draw(tiles: { plan: TilePlan; content: PageContent }[], view: View, viewport: Rect): void {
    if (tiles.length === 0) {
      this.clear();
      return;
    }

    const ctx = this.#ctx;
    if (ctx) {
      const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
      // The canvas reaches past the viewport by the same margin the tiles do. Sized to the
      // viewport alone it would clip the reserve away, leaving a pan nothing to draw on.
      const padX = viewport.width * TILE_MARGIN;
      const padY = viewport.height * TILE_MARGIN;
      const cssW = viewport.width + 2 * padX;
      const cssH = viewport.height + 2 * padY;
      const w = Math.max(1, Math.ceil(cssW * dpr));
      const h = Math.max(1, Math.ceil(cssH * dpr));
      if (this.#canvas.width !== w || this.#canvas.height !== h) {
        this.#canvas.width = w;
        this.#canvas.height = h;
      }
      this.#canvas.style.left = `${-padX}px`;
      this.#canvas.style.top = `${-padY}px`;
      this.#canvas.style.width = `${cssW}px`;
      this.#canvas.style.height = `${cssH}px`;
      // Pin the CSS transform to the container origin, so track() can rebase the renderer's
      // transform without having to account for the padding as well.
      this.#canvas.style.transformOrigin = `${padX}px ${padY}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // Into the padded canvas, then the renderer's own transform: container point p lands at
      // pad + view.scale * p + view.t.
      ctx.translate(padX, padY);
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);
      for (const { plan, content } of tiles) {
        const d = plan.dest;
        ctx.drawImage(content, d.x, d.y, d.width, d.height);
      }
    }

    // Recorded whether or not the paint happened: this bookkeeping is what lets a later pan move
    // these pixels, and skipping it on a context-less canvas would strand them.
    this.#painted = { view: { ...view }, area: visibleRect(view, viewport, TILE_MARGIN) };
    this.#canvas.style.transform = '';
    this.#clip.style.opacity = '1';
  }

  destroy(): void {
    this.#clip.remove();
    this.#ctx = null;
  }
}
