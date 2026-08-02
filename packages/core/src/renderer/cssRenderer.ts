import { flipProgressToPose } from '../geometry/flipProgressToPose';
import type { Spread } from '../engine/spread';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  RenderOptions,
  SpreadContent,
} from './types';

const RAD_TO_DEG = 180 / Math.PI;

/** How far to shift a spread to centre a lone page, in units of a quarter container width:
 *  -1 = only a right page (cover), +1 = only a left page (back), 0 = a full spread. */
function shiftUnit(content: SpreadContent): number {
  const lone = (content.left === null) !== (content.right === null);
  return lone ? (content.right !== null ? -1 : 1) : 0;
}

/**
 * Layered gradients painted over the turning leaf to fake paper depth on the flat
 * fold: a crease shadow at the spine, a soft curve sheen, and a free-edge shade.
 * The spine is the leaf's pivot edge — left for a forward flip, right for backward.
 */
function foldOverlay(direction: FlipDirection): string {
  const dir = direction === 'forward' ? 'to right' : 'to left';
  return [
    `linear-gradient(${dir}, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0) 60%)`,
    `linear-gradient(${dir}, transparent 40%, rgba(255,255,255,0.32) 66%, transparent 90%)`,
    `linear-gradient(${dir}, transparent 66%, rgba(0,0,0,0.35))`,
  ].join(',');
}

/**
 * Baseline renderer: a 2-panel CSS-3D fold. Runs on every browser, no GPU. Pages
 * are <canvas> elements; the turning leaf (front + back faces, backface-hidden)
 * rotates about the spine driven by flipProgressToPose(), with a gradient shadow
 * overlay for depth. `beginFlip` stages the surfaces; `setFlipProgress` animates.
 */
export class CssRenderer implements Renderer {
  #container: HTMLElement | null = null;
  #clip!: HTMLDivElement;
  #viewport!: HTMLDivElement;
  #book!: HTMLDivElement;
  #pageLeft!: HTMLCanvasElement;
  #pageRight!: HTMLCanvasElement;
  #leaf!: HTMLDivElement;
  #leafFront!: HTMLCanvasElement;
  #leafBack!: HTMLCanvasElement;
  #leafShadow!: HTMLDivElement;
  // Lone-page centering, interpolated across a flip (see the WebGL renderer).
  #fromShiftUnit = 0;
  #toShiftUnit = 0;
  // Book aspect fit: the spread is letterboxed to the page aspect (see the WebGL renderer).
  #pageAspect = 0;
  #bookW = 0;
  #fill = false;
  #contentShift = 0; // shiftUnit of the current static spread (nonzero = lone page, centered)

  mount(container: HTMLElement): Promise<void> {
    const doc = container.ownerDocument;
    this.#container = container;

    // Fixed-size clip box; NOT transformed, so zoom can't scale the crop region.
    this.#clip = doc.createElement('div');
    this.#clip.className = 'zine-clip';
    this.#clip.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';

    // Transform target for zoom/pan; lives inside the clip.
    this.#viewport = doc.createElement('div');
    this.#viewport.className = 'zine-viewport';
    this.#viewport.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;';

    this.#book = doc.createElement('div');
    this.#book.className = 'zine-book';
    this.#book.style.cssText =
      'position:absolute;inset:0;perspective:2000px;transform-style:preserve-3d;';

    this.#pageLeft = this.#makeCanvas(doc, 'zine-page-left', 'left:0;');
    this.#pageRight = this.#makeCanvas(doc, 'zine-page-right', 'right:0;');

    this.#leaf = doc.createElement('div');
    this.#leaf.className = 'zine-leaf';
    this.#leaf.style.cssText =
      'position:absolute;top:0;width:50%;height:100%;transform-style:preserve-3d;display:none;';

    this.#leafFront = doc.createElement('canvas');
    this.#leafFront.className = 'zine-leaf-front';
    this.#leafFront.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;';

    this.#leafBack = doc.createElement('canvas');
    this.#leafBack.className = 'zine-leaf-back';
    this.#leafBack.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;transform:rotateY(180deg);';

    this.#leafShadow = doc.createElement('div');
    this.#leafShadow.className = 'zine-leaf-shadow';
    this.#leafShadow.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;';
    this.#leafShadow.style.background = foldOverlay('forward'); // default; beginFlip sets per direction

    this.#leaf.append(this.#leafFront, this.#leafBack, this.#leafShadow);
    this.#book.append(this.#pageLeft, this.#pageRight, this.#leaf);
    this.#viewport.append(this.#book);
    this.#clip.append(this.#viewport);
    container.append(this.#clip);

    return Promise.resolve();
  }

  destroy(): void {
    this.#clip?.remove();
    this.#container = null;
  }

  renderSpread(_spread: Spread, content: SpreadContent, options?: RenderOptions): void {
    if (options?.fill) {
      // Single-page mode: the lone page fills the container; hide the other panel.
      this.#pageLeft.style.width = '100%';
      this.#pageRight.style.display = 'none';
      this.#paint(this.#pageLeft, content.right ?? content.left);
    } else {
      this.#pageLeft.style.width = '50%';
      this.#pageRight.style.display = '';
      this.#paint(this.#pageLeft, content.left);
      this.#paint(this.#pageRight, content.right);
    }
    this.#fill = options?.fill ?? false;
    this.#contentShift = this.#fill ? 0 : shiftUnit(content);
    this.#trackAspect(content);
    this.#layoutBook();
    this.#applyShift(this.#contentShift);
    // A fresh spread cancels any in-progress flip.
    this.#leaf.style.display = 'none';
    this.#leaf.style.transform = '';
    this.#leafShadow.style.opacity = '0';
  }

  beginFlip(
    from: SpreadContent,
    to: SpreadContent,
    direction: FlipDirection,
    options?: RenderOptions,
  ): void {
    if (options?.fill) {
      // Single-page: a full-width leaf turns about one edge, revealing `to` underneath.
      this.#pageLeft.style.width = '100%';
      this.#pageRight.style.display = 'none';
      this.#leaf.style.width = '100%';
      this.#leaf.style.left = '0';
      this.#leaf.style.transformOrigin = direction === 'forward' ? 'left center' : 'right center';
      this.#paint(this.#pageLeft, to.right ?? to.left);
      this.#paint(this.#leafFront, from.right ?? from.left);
      this.#paint(this.#leafBack, to.right ?? to.left);
    } else {
      this.#pageLeft.style.width = '50%';
      this.#pageRight.style.display = '';
      this.#leaf.style.width = '50%';
      if (direction === 'forward') {
        // Right page lifts and swings left about the spine. Left stays; right reveals `to`.
        this.#paint(this.#pageLeft, from.left);
        this.#paint(this.#pageRight, to.right);
        this.#paint(this.#leafFront, from.right);
        this.#paint(this.#leafBack, to.left);
        this.#leaf.style.left = '50%';
        this.#leaf.style.transformOrigin = 'left center';
      } else {
        // Left page swings right about its right edge. Right stays; left reveals `to`.
        this.#paint(this.#pageRight, from.right);
        this.#paint(this.#pageLeft, to.left);
        this.#paint(this.#leafFront, from.left);
        this.#paint(this.#leafBack, to.right);
        this.#leaf.style.left = '0';
        this.#leaf.style.transformOrigin = 'right center';
      }
    }
    this.#fromShiftUnit = options?.fill ? 0 : shiftUnit(from);
    this.#toShiftUnit = options?.fill ? 0 : shiftUnit(to);
    this.#fill = options?.fill ?? false;
    this.#trackAspect(to);
    this.#layoutBook();
    this.#applyShift(this.#fromShiftUnit);
    this.#leaf.style.display = 'block';
    this.#leaf.style.transform = 'rotateY(0deg)';
    this.#leafShadow.style.background = foldOverlay(direction);
    this.#leafShadow.style.opacity = '0';
  }

  setFlipProgress(t: number, direction: FlipDirection): void {
    const pose = flipProgressToPose(t);
    const deg = pose.angle * RAD_TO_DEG;
    this.#applyShift(this.#fromShiftUnit + (this.#toShiftUnit - this.#fromShiftUnit) * t);
    this.#leaf.style.display = 'block';
    this.#leaf.style.transform = `rotateY(${direction === 'forward' ? -deg : deg}deg)`;
    this.#leafShadow.style.opacity = String(pose.shadowAlpha);
  }

  #applyShift(unit: number): void {
    const px = unit * (this.#bookW / 4);
    this.#book.style.transform = px ? `translateX(${px}px)` : '';
  }

  /** Remember the page aspect (width/height) so the book can be letterboxed to it. */
  #trackAspect(content: SpreadContent): void {
    const p = content.left ?? content.right;
    if (p && p.height) this.#pageAspect = p.width / p.height;
  }

  /** Letterbox the 2-page book to the page aspect, centered in the container, so pages
   *  fill their halves without stretching; the surround is the container background. */
  #layoutBook(): void {
    const b = this.#bookBox();
    this.#bookW = b.width;
    const s = this.#book.style;
    s.inset = 'auto';
    s.left = `${b.x}px`;
    s.top = `${b.y}px`;
    s.width = `${b.width}px`;
    s.height = `${b.height}px`;
  }

  /** The fitted book rect in container px (letterbox aware) — a stable 2-page area. */
  #bookBox(): { x: number; y: number; width: number; height: number } {
    const cw = this.#container?.clientWidth ?? 0;
    const ch = this.#container?.clientHeight ?? 0;
    if (this.#pageAspect <= 0 || cw <= 0 || ch <= 0) return { x: 0, y: 0, width: cw, height: ch };
    const ba = (this.#fill ? 1 : 2) * this.#pageAspect;
    let bw = cw;
    let bh = ch;
    if (ba > cw / ch) bh = cw / ba;
    else bw = ch * ba;
    return { x: (cw - bw) / 2, y: (ch - bh) / 2, width: bw, height: bh };
  }

  /** Where the current spread is actually painted: the book, or its centered half for a lone
   *  page (mirrors #applyShift). This is what the engine hit-tests against. */
  #contentBox(): { x: number; y: number; width: number; height: number } {
    const b = this.#bookBox();
    return this.#contentShift !== 0 ? { x: b.x + b.width / 4, y: b.y, width: b.width / 2, height: b.height } : b;
  }

  setViewTransform(scale: number, x: number, y: number): void {
    this.#viewport.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  measure(): LayoutMetrics {
    const el = this.#container;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const known = this.#pageAspect > 0;
    const book = known ? this.#bookBox() : undefined;
    const content = known ? this.#contentBox() : undefined;
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h, book, content };
  }

  #makeCanvas(doc: Document, className: string, extra: string): HTMLCanvasElement {
    const c = doc.createElement('canvas');
    c.className = className;
    c.style.cssText = `position:absolute;top:0;width:50%;height:100%;${extra}`;
    return c;
  }

  #paint(canvas: HTMLCanvasElement, content: PageContent | null): void {
    const ctx = canvas.getContext('2d');
    if (content === null) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    canvas.width = content.width;
    canvas.height = content.height;
    ctx?.drawImage(content, 0, 0);
  }
}
