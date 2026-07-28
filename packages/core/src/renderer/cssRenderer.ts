import { flipProgressToPose } from '../geometry/flipProgressToPose';
import type { Spread } from '../engine/spread';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  SpreadContent,
} from './types';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Baseline renderer: a 2-panel CSS-3D fold. Runs on every browser, no GPU. Pages
 * are <canvas> elements; the turning leaf rotates about the spine driven by
 * flipProgressToPose(), with a gradient shadow overlay for depth.
 *
 * The leaf currently paints the departing page's face; wiring the arriving page
 * onto its back face needs adjacent-spread content and is an engine concern.
 */
export class CssRenderer implements Renderer {
  #container: HTMLElement | null = null;
  #viewport!: HTMLDivElement;
  #book!: HTMLDivElement;
  #pageLeft!: HTMLCanvasElement;
  #pageRight!: HTMLCanvasElement;
  #leaf!: HTMLDivElement;
  #leafFace!: HTMLCanvasElement;
  #leafShadow!: HTMLDivElement;
  #content: SpreadContent = { left: null, right: null };

  mount(container: HTMLElement): Promise<void> {
    const doc = container.ownerDocument;
    this.#container = container;

    this.#viewport = doc.createElement('div');
    this.#viewport.className = 'zine-viewport';
    this.#viewport.style.cssText =
      'position:relative;width:100%;height:100%;overflow:hidden;transform-origin:0 0;';

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

    this.#leafFace = doc.createElement('canvas');
    this.#leafFace.className = 'zine-leaf-face';
    this.#leafFace.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

    this.#leafShadow = doc.createElement('div');
    this.#leafShadow.className = 'zine-leaf-shadow';
    this.#leafShadow.style.cssText =
      'position:absolute;inset:0;opacity:0;background:linear-gradient(to right,rgba(0,0,0,0.35),rgba(0,0,0,0));';

    this.#leaf.append(this.#leafFace, this.#leafShadow);
    this.#book.append(this.#pageLeft, this.#pageRight, this.#leaf);
    this.#viewport.append(this.#book);
    container.append(this.#viewport);

    return Promise.resolve();
  }

  destroy(): void {
    this.#viewport?.remove();
    this.#container = null;
  }

  renderSpread(_spread: Spread, content: SpreadContent): void {
    this.#content = content;
    this.#paint(this.#pageLeft, content.left);
    this.#paint(this.#pageRight, content.right);
    // A fresh spread cancels any in-progress flip.
    this.#leaf.style.display = 'none';
    this.#leaf.style.transform = '';
    this.#leafShadow.style.opacity = '0';
  }

  setFlipProgress(t: number, direction: FlipDirection): void {
    const pose = flipProgressToPose(t);
    const deg = pose.angle * RAD_TO_DEG;
    const forward = direction === 'forward';

    // Forward: the right page lifts and swings left about the spine (its left edge).
    // Backward: the left page swings right about its right edge.
    this.#paint(this.#leafFace, forward ? this.#content.right : this.#content.left);

    this.#leaf.style.display = 'block';
    this.#leaf.style.left = forward ? '50%' : '0';
    this.#leaf.style.transformOrigin = forward ? 'left center' : 'right center';
    this.#leaf.style.transform = `rotateY(${forward ? -deg : deg}deg)`;
    this.#leafShadow.style.opacity = String(pose.shadowAlpha);
  }

  setViewTransform(scale: number, x: number, y: number): void {
    this.#viewport.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  measure(): LayoutMetrics {
    const el = this.#container;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h };
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
