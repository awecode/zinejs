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
 * Work out which part of each page is visible, and at what magnification.
 *
 * The renderer paints a page into `rect` and then scales the whole viewport about the container
 * origin, so a page occupies `rect * scale + t` on screen. Inverting that gives the part of the
 * page inside the viewport, which is the only part worth rasterizing sharply.
 *
 * Returns the plan in untransformed container coordinates: the caller draws it under the same
 * transform the renderer uses, so the tile tracks the page without any extra bookkeeping.
 */
export function planTiles(pages: TilePage[], view: View, viewport: Rect): TilePlan[] {
  const { scale, tx, ty } = view;
  if (scale <= 1) return [];

  // The viewport in untransformed container space — what the reader can currently see.
  const visible: Rect = {
    x: (viewport.x - tx) / scale,
    y: (viewport.y - ty) / scale,
    width: viewport.width / scale,
    height: viewport.height / scale,
  };

  const plans: TilePlan[] = [];
  for (const page of pages) {
    const hit = intersect(page.rect, visible);
    if (!hit || page.rect.width <= 0 || page.rect.height <= 0) continue;
    plans.push({
      index: page.index,
      request: {
        scale,
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

/** Whether two plans ask for the same pixels, so a re-render can be skipped while panning. */
export function sameTile(a: TilePlan, b: TilePlan): boolean {
  if (a.index !== b.index || a.request.scale !== b.request.scale) return false;
  const p = a.request.region;
  const q = b.request.region;
  // A fraction of a page-pixel apart is the same tile; exact equality would re-render every frame.
  const EPS = 1e-4;
  return (
    Math.abs(p.x - q.x) < EPS &&
    Math.abs(p.y - q.y) < EPS &&
    Math.abs(p.width - q.width) < EPS &&
    Math.abs(p.height - q.height) < EPS
  );
}

/**
 * A canvas laid over the book that paints crisp tiles on top of the magnified page.
 *
 * It sits outside the renderer on purpose: both renderers stretch a page raster to a fixed panel,
 * so neither can place a partial-page tile, and teaching them to would mean the same geometry
 * twice. The overlay applies the same transform the renderer does, so the tiles register exactly
 * over the pixels they replace and simply disappear when the reader zooms out.
 */
export class ZoomOverlay {
  #clip: HTMLDivElement;
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;
  #shown: TilePlan[] = [];
  /** The view the pixels on the canvas were painted for; null while nothing is painted. */
  #paintedUnder: View | null = null;

  constructor(doc: Document, container: HTMLElement) {
    // The canvas is transformed to follow a pan, which would carry it outside the book — the
    // renderers clip against their own element, and the container itself does not clip at all.
    // A wrapper holds the clip so the transform has something to be cut against.
    this.#clip = doc.createElement('div');
    this.#clip.className = 'zine-zoom-clip';
    this.#clip.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;' +
      'opacity:0;transition:opacity 120ms linear;';

    this.#canvas = doc.createElement('canvas');
    this.#canvas.className = 'zine-zoom-overlay';
    // transform-origin 0 0 matches the renderer, which scales about the container origin.
    this.#canvas.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;';
    this.#clip.append(this.#canvas);
    container.append(this.#clip);
    this.#ctx = this.#canvas.getContext('2d');
  }

  /**
   * Follow a view change immediately, without re-rasterizing.
   *
   * Re-rendering a tile takes long enough to be debounced, but the page underneath moves with the
   * reader's finger. Left alone the overlay would sit still on top of it, freezing the page until
   * a fresh tile landed. Shifting the painted pixels by the same amount keeps them registered
   * over the page, so the pan tracks the cursor and the crisper tile just arrives afterwards.
   */
  track(view: View): void {
    const base = this.#paintedUnder;
    if (!base) return;
    // Painted pixels sit at base.scale * p + base.t; they need to sit at view.scale * p + view.t.
    const a = view.scale / base.scale;
    const bx = view.tx - a * base.tx;
    const by = view.ty - a * base.ty;
    this.#canvas.style.transform =
      a === 1 && bx === 0 && by === 0 ? '' : `translate(${bx}px, ${by}px) scale(${a})`;
  }

  /** Drop every tile and hide the overlay, revealing the renderer's own pixels again. */
  clear(): void {
    if (this.#shown.length === 0) return;
    this.#shown = [];
    this.#paintedUnder = null;
    this.#clip.style.opacity = '0';
    this.#canvas.style.transform = '';
    const ctx = this.#ctx;
    if (ctx) ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  /** The plans currently painted, so the caller can skip re-rendering an unchanged view. */
  get shown(): readonly TilePlan[] {
    return this.#shown;
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
      const w = Math.max(1, Math.ceil(viewport.width * dpr));
      const h = Math.max(1, Math.ceil(viewport.height * dpr));
      if (this.#canvas.width !== w || this.#canvas.height !== h) {
        this.#canvas.width = w;
        this.#canvas.height = h;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      // Match the renderer: scale about the container origin, then translate.
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);
      for (const { plan, content } of tiles) {
        const d = plan.dest;
        ctx.drawImage(content, d.x, d.y, d.width, d.height);
      }
    }

    // Recorded whether or not the paint happened: the bookkeeping is what lets a later pan move
    // these pixels, and skipping it on a context-less canvas would strand them.
    this.#shown = tiles.map((t) => t.plan);
    // Freshly painted for this view, so any tracking shift from an earlier pan is spent.
    this.#paintedUnder = { ...view };
    this.#canvas.style.transform = '';
    this.#clip.style.opacity = '1';
  }

  destroy(): void {
    this.#clip.remove();
    this.#ctx = null;
  }
}
