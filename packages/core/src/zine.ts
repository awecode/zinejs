import { buildSpreads, shouldSinglePage, type Direction, type Spread } from './engine/spread';
import { Virtualizer } from './engine/virtualizer';
import { Emitter, type ZineEventMap } from './engine/emitter';
import { FlipMachine } from './engine/stateMachine';
import { PointerRecognizer, PinchRecognizer, bindGestures, type GestureEnd } from './engine/input';
import { hitTest } from './geometry/hitTest';
import { selectRenderer, type RendererOption } from './renderer/select';
import type { FlipDirection, Renderer, SpreadContent } from './renderer/types';
import type { Source } from './source/types';

/** Grab-zone size as a fraction of the smaller container dimension. */
const CORNER_FRACTION = 0.25;

interface DragState {
  direction: FlipDirection;
  targetIndex: number;
  toPage: number;
  toContent: SpreadContent;
  width: number;
  t: number;
}

export interface ZineOptions {
  /** Content source (e.g. an ImageSource). Required. */
  source: Source;
  /** Renderer selection; default 'auto'. */
  renderer?: RendererOption;
  /** Reading direction; default 'ltr'. */
  direction?: Direction;
  /** First page is a lone cover; default false. */
  cover?: boolean;
  /** Page to open on; default 0. */
  startPage?: number;
  /** Flip animation duration in ms; default 500. */
  flipDuration?: number;
  /** Maximum zoom scale; default 4. */
  maxZoom?: number;
  /** Container widths below this (px) switch to one page per spread; default 600. */
  singlePageThreshold?: number;
}

/**
 * The public flipbook. Composes the engine (spreads, virtualizer, events), a
 * lazily-selected renderer, and a content source. Construction is synchronous
 * but setup is async — await `ready` (or listen for the `ready` event) before
 * driving it.
 */
export class Zine {
  #container: HTMLElement;
  #source: Source;
  #emitter = new Emitter<ZineEventMap>();
  #virtualizer = new Virtualizer(2);
  #machine = new FlipMachine();
  #direction: Direction;
  #cover: boolean;
  #singlePageThreshold: number;
  #singlePage = false;
  #spreads: Spread[];
  #current = 0;
  #currentPage: number;
  #currentContent: SpreadContent = { left: null, right: null };
  #flipDuration: number;
  #maxZoom: number;
  #resizeObserver: ResizeObserver | null = null;
  #updateScheduled = false;
  #scale = 1;
  #tx = 0;
  #ty = 0;
  #renderer: Renderer | null = null;
  #raf: number | null = null;
  #drag: DragState | null = null;
  #pan: { baseTx: number; baseTy: number } | null = null;
  #pinching = false;
  #pinchBaseScale = 1;
  #unbindInput: (() => void) | null = null;
  #ready: Promise<void>;

  /** Stable seek API: drive the fold to a fixed progress without animating (visual regression). */
  readonly debug = {
    setFlipProgress: (t: number, direction: FlipDirection): void => {
      this.#renderer?.setFlipProgress(t, direction);
    },
  };

  constructor(container: HTMLElement, options: ZineOptions) {
    validateOptions(container, options);
    this.#container = container;
    this.#source = options.source;
    const direction = options.direction ?? 'ltr';
    const cover = options.cover ?? false;
    this.#direction = direction;
    this.#cover = cover;
    this.#singlePageThreshold = options.singlePageThreshold ?? 600;
    this.#spreads = buildSpreads(this.#source.pageCount, { direction, cover });
    this.#currentPage = clamp(options.startPage ?? 0, 0, Math.max(0, this.#source.pageCount - 1));
    this.#current = this.#spreadIndexForPage(this.#currentPage);
    this.#flipDuration = options.flipDuration ?? 500;
    this.#maxZoom = options.maxZoom ?? 4;
    this.#ready = this.#init(options.renderer ?? 'auto');
  }

  /** Resolves once the renderer is mounted and the first spread is painted. */
  get ready(): Promise<void> {
    return this.#ready;
  }

  getPageCount(): number {
    return this.#source.pageCount;
  }

  getPage(): number {
    return this.#currentPage;
  }

  flipNext(): void {
    this.#startFlip(this.#current + 1);
  }

  flipPrev(): void {
    this.#startFlip(this.#current - 1);
  }

  flipTo(page: number): void {
    const target = clamp(page, 0, Math.max(0, this.#source.pageCount - 1));
    this.#startFlip(this.#spreadIndexForPage(target));
  }

  getZoom(): number {
    return this.#scale;
  }

  /** Zoom to `scale` (clamped to [1, maxZoom]), keeping `center` (container-local) fixed. */
  setZoom(scale: number, center?: { x: number; y: number }): void {
    if (!this.#renderer) return;
    const s2 = clamp(scale, 1, this.#maxZoom);
    const m = this.#renderer.measure();
    const focal = center ?? { x: m.containerWidth / 2, y: m.containerHeight / 2 };
    const s1 = this.#scale;
    // Solve for the translate that keeps the focal screen point fixed as s1→s2.
    let tx = s2 === 1 ? 0 : focal.x - (s2 / s1) * (focal.x - this.#tx);
    let ty = s2 === 1 ? 0 : focal.y - (s2 / s1) * (focal.y - this.#ty);
    [tx, ty] = this.#clampPan(tx, ty, s2, m.containerWidth, m.containerHeight);
    this.#scale = s2;
    this.#tx = tx;
    this.#ty = ty;
    this.#renderer.setViewTransform(s2, tx, ty);
    this.#emitter.emit('zoomChanged', { scale: s2 });
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  #clampPan(tx: number, ty: number, scale: number, w: number, h: number): [number, number] {
    // Keep the scaled content covering the viewport (transform-origin is 0,0).
    return [clamp(tx, w * (1 - scale), 0), clamp(ty, h * (1 - scale), 0)];
  }

  on<K extends keyof ZineEventMap>(
    event: K,
    listener: (payload: ZineEventMap[K]) => void,
  ): () => void {
    return this.#emitter.on(event, listener);
  }

  destroy(): void {
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#resizeObserver?.disconnect();
    this.#unbindInput?.();
    this.#renderer?.destroy();
    this.#renderer = null;
    this.#source.destroy();
    this.#emitter.clear();
  }

  #startFlip(targetIndex: number): void {
    if (targetIndex < 0 || targetIndex >= this.#spreads.length || targetIndex === this.#current) {
      return;
    }
    // `flip` is legal only from idle; otherwise a flip/drag is already in flight.
    if (this.#machine.send('flip') === null) return;

    const direction: FlipDirection = targetIndex > this.#current ? 'forward' : 'backward';
    const toPage = this.#leadPage(targetIndex);
    // State is already locked (send('flip') above), so re-entrant flips are rejected
    // even though staging the destination content below is async.
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: toPage });
    void this.#runFlip(targetIndex, direction, toPage);
  }

  async #runFlip(targetIndex: number, direction: FlipDirection, toPage: number): Promise<void> {
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction);
    this.#animateProgress(0, 1, direction, () => this.#commit(targetIndex, toPage, toContent));
  }

  /** Animate the fold from `fromT` to `toT`, easing per-frame, then run `onDone`. */
  #animateProgress(
    fromT: number,
    toT: number,
    direction: FlipDirection,
    onDone: () => void,
  ): void {
    const duration = this.#flipDuration * Math.abs(toT - fromT);
    if (duration <= 0) {
      this.#renderer?.setFlipProgress(toT, direction);
      onDone();
      return;
    }
    const start = performance.now();
    const step = (now: number): void => {
      // Easing lives here; flipProgressToPose stays linear so seeks are deterministic.
      const raw = Math.min(1, (now - start) / duration);
      this.#renderer?.setFlipProgress(fromT + (toT - fromT) * easeInOutCubic(raw), direction);
      if (raw < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = null;
        onDone();
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  #commit(targetIndex: number, toPage: number, toContent: SpreadContent): void {
    const spread = this.#spreads[targetIndex];
    this.#current = targetIndex;
    this.#currentPage = toPage;
    this.#currentContent = toContent;
    // renderSpread paints the landed spread and clears the turning leaf.
    if (spread) this.#paintSpread(spread, toContent);
    this.#prefetchWindow();
    this.#machine.send('settle');
    this.#emitter.emit('pageChanged', { page: toPage });
    this.#emitter.emit('flipEnd', { page: toPage });
  }

  #leadPage(spreadIndex: number): number {
    const spread = this.#spreads[spreadIndex];
    if (!spread) return this.#currentPage;
    const pages = [spread.left, spread.right].filter((p): p is number => p !== null);
    return pages.length > 0 ? Math.min(...pages) : this.#currentPage;
  }

  #onDragStart(clientX: number, clientY: number): void {
    if (this.#pinching || !this.#renderer || this.#machine.state !== 'idle') return;
    // Zoomed in → a drag pans; at scale 1 → a corner drag flips (§9 mode switch).
    if (this.#scale > 1) {
      if (this.#machine.send('panStart') === null) return;
      this.#pan = { baseTx: this.#tx, baseTy: this.#ty };
      return;
    }
    const rect = this.#container.getBoundingClientRect();
    const point = { x: clientX - rect.left, y: clientY - rect.top };
    const { containerWidth, containerHeight } = this.#renderer.measure();
    const cornerSize = Math.min(containerWidth, containerHeight) * CORNER_FRACTION;
    if (hitTest(point, { width: containerWidth, height: containerHeight }, cornerSize) !== 'corner') {
      return;
    }
    // Right-side corner turns the page left (forward) in LTR; RTL mirrors it.
    const rightSide = point.x > containerWidth / 2;
    const forward = this.#direction === 'rtl' ? !rightSide : rightSide;
    const targetIndex = this.#current + (forward ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= this.#spreads.length) return;
    if (this.#machine.send('grab') === null) return;

    const direction: FlipDirection = forward ? 'forward' : 'backward';
    const toPage = this.#leadPage(targetIndex);
    this.#drag = {
      direction,
      targetIndex,
      toPage,
      toContent: { left: null, right: null },
      width: containerWidth,
      t: 0,
    };
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: toPage });
    void this.#stageDrag(targetIndex, direction);
  }

  async #stageDrag(targetIndex: number, direction: FlipDirection): Promise<void> {
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    // The drag may have ended (or retargeted) while content was resolving.
    if (this.#drag?.targetIndex !== targetIndex) return;
    this.#drag.toContent = toContent;
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction);
    this.#renderer?.setFlipProgress(this.#drag.t, direction);
  }

  #onDragMove(dx: number, dy: number): void {
    if (this.#pinching) return;
    if (this.#pan) {
      if (!this.#renderer) return;
      const m = this.#renderer.measure();
      const [tx, ty] = this.#clampPan(
        this.#pan.baseTx + dx,
        this.#pan.baseTy + dy,
        this.#scale,
        m.containerWidth,
        m.containerHeight,
      );
      this.#tx = tx;
      this.#ty = ty;
      this.#renderer.setViewTransform(this.#scale, tx, ty);
      return;
    }
    const drag = this.#drag;
    if (!drag) return;
    const signed = drag.direction === 'forward' ? -dx : dx;
    drag.t = clamp(signed / drag.width, 0, 1);
    this.#renderer?.setFlipProgress(drag.t, drag.direction);
  }

  #onDragEnd(gesture: GestureEnd): void {
    if (this.#pinching) return;
    if (this.#pan) {
      this.#pan = null;
      this.#machine.send('panEnd');
      return;
    }
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    this.#machine.send('release');

    const swiped =
      gesture.swipe &&
      (drag.direction === 'forward' ? gesture.dx < 0 : gesture.dx > 0);
    if (drag.t >= 0.5 || swiped) {
      this.#animateProgress(drag.t, 1, drag.direction, () =>
        this.#commit(drag.targetIndex, drag.toPage, drag.toContent),
      );
    } else {
      this.#animateProgress(drag.t, 0, drag.direction, () => this.#cancelFlip());
    }
  }

  #cancelFlip(): void {
    const spread = this.#spreads[this.#current];
    if (spread) this.#paintSpread(spread, this.#currentContent);
    this.#machine.send('settle');
    this.#emitter.emit('flipEnd', { page: this.#currentPage });
  }

  #onPinchStart(): void {
    // A second finger abandons any single-pointer gesture in flight.
    if (this.#drag) {
      this.#drag = null;
      this.#machine.send('release');
      this.#machine.send('settle');
      const spread = this.#spreads[this.#current];
      if (spread) this.#paintSpread(spread, this.#currentContent);
    } else if (this.#pan) {
      this.#pan = null;
      this.#machine.send('panEnd');
    }
    this.#pinching = true;
    this.#pinchBaseScale = this.#scale;
  }

  #onPinchMove(centerX: number, centerY: number, scale: number): void {
    if (!this.#pinching) return;
    const rect = this.#container.getBoundingClientRect();
    this.setZoom(this.#pinchBaseScale * scale, { x: centerX - rect.left, y: centerY - rect.top });
  }

  #onPinchEnd(): void {
    this.#pinching = false;
  }

  async #init(rendererOption: RendererOption): Promise<void> {
    // Warm the current page's decode in parallel with loading the renderer chunk.
    const rendererPromise = selectRenderer(rendererOption);
    this.#source.prefetch([this.#currentPage]);

    const renderer = await rendererPromise;
    await renderer.mount(this.#container);
    this.#renderer = renderer;

    // Now that we can measure, apply single-page mode if the container is narrow.
    this.#applySinglePage(renderer.measure().containerWidth);

    const pointer = new PointerRecognizer({
      onStart: (g) => this.#onDragStart(g.x, g.y),
      onMove: (g) => this.#onDragMove(g.dx, g.dy),
      onEnd: (g) => this.#onDragEnd(g),
    });
    const pinch = new PinchRecognizer({
      onPinchStart: () => this.#onPinchStart(),
      onPinchMove: (g) => this.#onPinchMove(g.centerX, g.centerY, g.scale),
      onPinchEnd: () => this.#onPinchEnd(),
    });
    this.#unbindInput = bindGestures(this.#container, { pointer, pinch });

    await this.#renderCurrent();
    this.#observeResize();
    this.#prefetchWindow();
    this.#emitter.emit('ready');
  }

  /** Re-measure and re-render; call after the container resizes. */
  update(): void {
    if (!this.#renderer || this.#machine.state !== 'idle') return;
    this.#applySinglePage(this.#renderer.measure().containerWidth);
    void this.#renderCurrent();
  }

  #applySinglePage(containerWidth: number): void {
    const single = shouldSinglePage(containerWidth, this.#singlePageThreshold);
    if (single === this.#singlePage) return;
    this.#singlePage = single;
    this.#spreads = buildSpreads(this.#source.pageCount, {
      direction: this.#direction,
      cover: this.#cover,
      singlePage: single,
    });
    this.#current = this.#spreadIndexForPage(this.#currentPage);
  }

  async #renderCurrent(): Promise<void> {
    const spread = this.#spreads[this.#current];
    if (!spread || !this.#renderer) return;
    this.#currentContent = await this.#resolveContent(spread);
    this.#paintSpread(spread, this.#currentContent);
  }

  #paintSpread(spread: Spread, content: SpreadContent): void {
    this.#renderer?.renderSpread(spread, content, { fill: this.#singlePage });
  }

  #observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.#resizeObserver = new ResizeObserver(() => this.#scheduleUpdate());
    this.#resizeObserver.observe(this.#container);
  }

  #scheduleUpdate(): void {
    if (this.#updateScheduled) return;
    this.#updateScheduled = true;
    requestAnimationFrame(() => {
      this.#updateScheduled = false;
      this.update();
    });
  }

  async #resolveContent(spread: Spread): Promise<SpreadContent> {
    const [left, right] = await Promise.all([
      spread.left === null ? Promise.resolve(null) : this.#source.get(spread.left),
      spread.right === null ? Promise.resolve(null) : this.#source.get(spread.right),
    ]);
    return { left, right };
  }

  #prefetchWindow(): void {
    const { toMount } = this.#virtualizer.update(this.#current, this.#spreads.length);
    const pages: number[] = [];
    for (const index of toMount) {
      const spread = this.#spreads[index];
      if (spread?.left != null) pages.push(spread.left);
      if (spread?.right != null) pages.push(spread.right);
    }
    this.#source.prefetch(pages);
  }

  #spreadIndexForPage(page: number): number {
    const index = this.#spreads.findIndex((s) => s.left === page || s.right === page);
    return index === -1 ? 0 : index;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/** Validate constructor inputs up front, throwing agent-actionable errors. */
function validateOptions(container: unknown, options: unknown): void {
  if (
    typeof container !== 'object' ||
    container === null ||
    typeof (container as { appendChild?: unknown }).appendChild !== 'function' ||
    typeof (container as { addEventListener?: unknown }).addEventListener !== 'function'
  ) {
    throw new Error(`Zine: container must be a DOM element; received ${typeName(container)}.`);
  }
  if (typeof options !== 'object' || options === null) {
    throw new Error('Zine: an options object with a `source` is required.');
  }
  const o = options as Record<string, unknown>;

  const source = o.source as { get?: unknown; pageCount?: unknown } | undefined;
  if (
    typeof source !== 'object' ||
    source === null ||
    typeof source.get !== 'function' ||
    typeof source.pageCount !== 'number'
  ) {
    throw new Error('Zine: `source` is required and must be a Source, e.g. new ImageSource(urls).');
  }
  const pageCount = source.pageCount;
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`Zine: source has ${pageCount} pages; a Source must have at least 1 page.`);
  }

  const startPage = o.startPage;
  if (
    startPage !== undefined &&
    (typeof startPage !== 'number' ||
      !Number.isInteger(startPage) ||
      startPage < 0 ||
      startPage >= pageCount)
  ) {
    throw new Error(
      `Zine: startPage ${JSON.stringify(startPage)} is out of range for a ${pageCount}-page book (valid 0..${pageCount - 1}).`,
    );
  }

  const direction = o.direction;
  if (direction !== undefined && direction !== 'ltr' && direction !== 'rtl') {
    throw new Error(`Zine: direction must be 'ltr' or 'rtl'; got ${JSON.stringify(direction)}.`);
  }

  assertMin(o.flipDuration, 'flipDuration', 0);
  assertMin(o.maxZoom, 'maxZoom', 1);
  assertMin(o.singlePageThreshold, 'singlePageThreshold', 0);
  validateRendererOption(o.renderer);
}

function assertMin(value: unknown, name: string, min: number): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new Error(`Zine: ${name} must be a number >= ${min}; got ${JSON.stringify(value)}.`);
  }
}

function validateRendererOption(renderer: unknown): void {
  if (renderer === undefined) return;
  if (typeof renderer === 'string') {
    if (renderer !== 'auto' && renderer !== 'css' && renderer !== 'pixi') {
      throw new Error(
        `Zine: renderer '${renderer}' is not recognized; use 'auto', 'css', 'pixi', an array of those, or a custom Renderer.`,
      );
    }
    return;
  }
  if (Array.isArray(renderer)) {
    for (const kind of renderer) {
      if (kind !== 'css' && kind !== 'pixi') {
        throw new Error(
          `Zine: renderer order array may only contain 'css' or 'pixi'; got ${JSON.stringify(kind)}.`,
        );
      }
    }
    return;
  }
  if (
    typeof renderer === 'object' &&
    renderer !== null &&
    typeof (renderer as { mount?: unknown }).mount === 'function'
  ) {
    return;
  }
  throw new Error(
    "Zine: renderer must be 'auto', 'css', 'pixi', an array of those, or a custom Renderer instance.",
  );
}
