import {
  buildSpreads,
  shouldSinglePage,
  type Direction,
  type Spread,
  type SpreadMode,
} from './engine/spread';
import { Virtualizer } from './engine/virtualizer';
import { Emitter, type ZineEventMap } from './engine/emitter';
import { FlipMachine } from './engine/stateMachine';
import { PointerRecognizer, PinchRecognizer, bindGestures, type GestureEnd } from './engine/input';
import { hitTest } from './geometry/hitTest';
import { CURL_TYPES, DEFAULT_CURL, type CurlType } from './geometry/curls/types';
import { selectRenderer, type RendererOption } from './renderer/select';
import type { FlipDirection, PageContent, Renderer, SpreadContent } from './renderer/types';
import type { Source } from './source/types';
import { composeSource } from './source/compose';

/** Grab-zone size as a fraction of the smaller container dimension. */
const CORNER_FRACTION = 0.25;

/** Wheel-zoom sensitivity: scale multiplies by exp(-deltaY * this) per wheel event. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

/** Pointer movement (px) beyond which a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6;

/** Window (ms) a single click waits to rule out a double-click before flipping. */
const DOUBLE_CLICK_MS = 250;

/** The single-page roll turns with a bent flip (no spread to roll onto); it reads better a
 *  touch slower than the spread roll, so its flip duration is scaled up by this automatically. */
const SINGLE_PAGE_ROLL_SLOWDOWN = 1.75;

interface DragState {
  direction: FlipDirection;
  targetIndex: number;
  toPage: number;
  toContent: SpreadContent;
  width: number;
  t: number;
}

export interface ZoomOptions {
  /** Whether zooming is allowed at all; default true. */
  enabled?: boolean;
  /** Maximum zoom scale; default 4. */
  max?: number;
  /** Zoom on Ctrl/⌘ + wheel (also how trackpad pinch arrives on desktop); default true. */
  wheel?: boolean;
  /** Zoom levels cycled by double-click (wraps to the first); `false` disables. Default [1, 2, 4]. */
  doubleClick?: number[] | false;
  /**
   * Listen for double-click zoom inside the click-to-flip zones. Default: off in 'edge' mode
   * (edges flip instantly, no delay), on in 'half' mode. Turning it on in 'edge' mode makes
   * clicks wait out `clickFlipDelay` so a double-click can preempt them with a zoom.
   */
  doubleClickInFlipZone?: boolean;
}

export interface ZineOptions {
  /** Content source (e.g. an ImageSource). Required. */
  source: Source;
  /** Renderer selection; default 'auto'. */
  renderer?: RendererOption;
  /** Page-curl model for the WebGL2 renderer: 'roll' | 'simple' | 'fold' | 'peel'. Default 'roll'. */
  curl?: CurlType;
  /** Fixed container width in px; omit to let the container/CSS drive the size. */
  width?: number;
  /** Fixed container height in px; omit to let the container/CSS drive the size. */
  height?: number;
  /** Reading direction; default 'ltr'. */
  direction?: Direction;
  /** How pages group into spreads: 'double' | 'single' | 'cover' | 'book'. Default 'cover'. */
  spreadMode?: SpreadMode;
  /** Image URL prepended as a lone front cover (adds a page). */
  frontCover?: string;
  /** Image URL appended as a lone back cover (adds a page). */
  backCover?: string;
  /** Replace source pages with image URLs, keyed by 0-based source index (negative = from the end). */
  pages?: Record<number, string>;
  /** Page to open on; default 0. */
  startPage?: number;
  /** Flip animation duration in ms; default 500. */
  flipDuration?: number;
  /** How a tap/click turns pages: near an edge ('edge'), by page half ('half'), or 'off'. Default 'edge'. */
  clickToFlip?: 'edge' | 'half' | 'off';
  /** Edge-zone size in px per side, used when clickToFlip is 'edge'. Default 64. */
  clickZoneSize?: number;
  /**
   * Delay (ms) a click waits before flipping, so a double-click can preempt it with a zoom.
   * Omit for auto: 0 when double-click zoom is inactive, 250 when it's active.
   */
  clickFlipDelay?: number;
  /** Zoom behavior. */
  zoom?: ZoomOptions;
  /** Container widths below this (px) switch to one page per spread; default 640. */
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
  #spreadMode: SpreadMode;
  #curl: CurlType;
  #anchorY = 1; // where the last tap/drag grabbed (0=top, 1=bottom); drives anchored curls
  #clickToFlip: 'edge' | 'half' | 'off';
  #clickZoneSize: number;
  #honorDoubleClickInFlipZone: boolean;
  #clickFlipDelayValue: number;
  #singlePageThreshold: number;
  #singlePage = false;
  #narrow = false; // responsive: container currently below singlePageThreshold
  #lastAspect = ''; // last container aspect-ratio written (avoids redundant style writes)
  #startPageOption: number | undefined;
  #spreads: Spread[] = [];
  #current = 0;
  #currentPage = 0;
  #currentContent: SpreadContent = { left: null, right: null };
  #flipDuration: number;
  #zoomEnabled: boolean;
  #wheelZoom: boolean;
  #doubleClickLevels: number[] | null;
  #maxZoom: number;
  #resizeObserver: ResizeObserver | null = null;
  #updateScheduled = false;
  #scale = 1;
  #tx = 0;
  #ty = 0;
  #renderer: Renderer | null = null;
  #fellBack = false;
  #destroyed = false;
  #raf: number | null = null;
  #drag: DragState | null = null;
  #pendingGrab: { direction: FlipDirection; targetIndex: number; toPage: number; width: number } | null = null;
  #press: { x: number; y: number } | null = null;
  #pendingClickTimer: ReturnType<typeof setTimeout> | null = null;
  // Latest flip intent requested while one was already animating; replayed on settle so
  // clicks/keys during a turn aren't dropped and continuous flipping keeps advancing.
  #queuedFlip: (() => void) | null = null;
  // The fold animation currently on screen, so a new flip request can land it instantly
  // (snap to its end pose + commit) and start immediately instead of waiting it out.
  #activeAnim: { toT: number; direction: FlipDirection; onDone: () => void } | null = null;
  #pan: { baseTx: number; baseTy: number } | null = null;
  #pinching = false;
  #pinchBaseScale = 1;
  #reducedMotion = false;
  #liveRegion: HTMLElement | null = null;
  #unbindInput: (() => void) | null = null;
  #unbindWheel: (() => void) | null = null;
  #unbindDblClick: (() => void) | null = null;
  #a11yCleanup: (() => void) | null = null;
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
    if (options.width !== undefined) container.style.width = `${options.width}px`;
    if (options.height !== undefined) container.style.height = `${options.height}px`;
    this.#source = composeSource(options.source, {
      frontCover: options.frontCover,
      backCover: options.backCover,
      pages: options.pages,
    });
    const direction = options.direction ?? 'ltr';
    this.#direction = direction;
    this.#spreadMode = options.spreadMode ?? 'cover';
    this.#curl = options.curl ?? DEFAULT_CURL;
    this.#clickToFlip = options.clickToFlip ?? 'edge';
    this.#clickZoneSize = options.clickZoneSize ?? 64;
    this.#singlePageThreshold = options.singlePageThreshold ?? 640;
    this.#startPageOption = options.startPage;
    // Sync sources (a known page count) build spreads now — so bad pageCount/startPage
    // throw immediately from `new Zine`. Async sources (an `open()`) defer to #init.
    if (typeof this.#source.open !== 'function') {
      this.#buildSpreadModel();
    }
    this.#flipDuration = options.flipDuration ?? 800;
    this.#zoomEnabled = options.zoom?.enabled ?? true;
    this.#wheelZoom = options.zoom?.wheel ?? true;
    const dbl = options.zoom?.doubleClick;
    const levels = dbl === false ? [] : [...(dbl ?? [1, 2, 4])].sort((a, b) => a - b);
    this.#doubleClickLevels = levels.length > 0 ? levels : null;
    this.#maxZoom = options.zoom?.max ?? 4;

    // Arbitrate click-to-flip vs double-click zoom inside the flip zones.
    // Listen for double-click zoom in flip zones: default off in 'edge', on in 'half'.
    // clickFlipDelay === 0 hard-disables it. When honored, a delay lets a click wait
    // out a possible double-click; auto default 250 ms, overridable.
    const doubleClickZoomActive = this.#zoomEnabled && this.#doubleClickLevels !== null;
    const listenInFlipZone = options.zoom?.doubleClickInFlipZone ?? (this.#clickToFlip === 'half');
    this.#honorDoubleClickInFlipZone =
      this.#clickToFlip !== 'off' &&
      doubleClickZoomActive &&
      listenInFlipZone &&
      options.clickFlipDelay !== 0;
    this.#clickFlipDelayValue = this.#honorDoubleClickInFlipZone
      ? (options.clickFlipDelay ?? DOUBLE_CLICK_MS)
      : 0;

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
    this.#requestFlip(() => this.#startFlip(this.#current + 1));
  }

  flipPrev(): void {
    this.#requestFlip(() => this.#startFlip(this.#current - 1));
  }

  flipTo(page: number): void {
    const target = clamp(page, 0, Math.max(0, this.#source.pageCount - 1));
    this.#requestFlip(() => this.#startFlip(this.#spreadIndexForPage(target)));
  }

  /** Run a flip now. If a fold is animating, land it instantly first so the new turn starts
   *  immediately on this click (thunks read `#current` lazily, so it steps on from where the
   *  interrupted turn landed). A drag in flight can't be interrupted this way, so its request
   *  is queued and replayed on settle instead. */
  #requestFlip(run: () => void): void {
    if (this.#machine.state === 'idle') {
      run();
    } else if (this.#activeAnim) {
      this.#finishActiveAnim(); // lands the current turn → machine back to idle
      run();
    } else {
      this.#queuedFlip = run; // dragging: no animation to cut short, so wait for release
    }
  }

  /** Snap the in-flight fold to its end pose and commit it now, cancelling its RAF loop. */
  #finishActiveAnim(): void {
    const anim = this.#activeAnim;
    if (!anim) return;
    this.#activeAnim = null;
    if (this.#raf !== null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
    this.#renderer?.setFlipProgress(anim.toT, anim.direction);
    anim.onDone();
  }

  /** After an animation settles, fire whatever flip was requested mid-turn. */
  #drainQueuedFlip(): void {
    const queued = this.#queuedFlip;
    if (!queued) return;
    this.#queuedFlip = null;
    queued();
  }

  getZoom(): number {
    return this.#scale;
  }

  /** Zoom to `scale` (clamped to [1, zoom.max]), keeping `center` (container-local) fixed. */
  setZoom(scale: number, center?: { x: number; y: number }): void {
    if (!this.#renderer || !this.#zoomEnabled) return;
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
    this.#destroyed = true;
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#activeAnim = null;
    this.#queuedFlip = null;
    this.#clearPendingClickFlip();
    this.#resizeObserver?.disconnect();
    this.#a11yCleanup?.();
    this.#unbindWheel?.();
    this.#unbindDblClick?.();
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
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction, {
      fill: this.#singlePage,
      curl: this.#curl,
      anchor: { y: this.#anchorY },
    });
    this.#animateProgress(0, 1, direction, () => this.#commit(targetIndex, toPage, toContent));
  }

  /** Animate the fold from `fromT` to `toT`, easing per-frame, then run `onDone`. */
  #animateProgress(
    fromT: number,
    toT: number,
    direction: FlipDirection,
    onDone: () => void,
  ): void {
    const duration = this.#effectiveDuration() * Math.abs(toT - fromT);
    if (duration <= 0) {
      // Reduced motion (or zero-duration): swap without the curl sweep.
      this.#renderer?.setFlipProgress(toT, direction);
      onDone();
      return;
    }
    // Remembered so a mid-turn flip request can #finishActiveAnim() to land it at once.
    // Object identity also tags this run: if #finishActiveAnim (or a new flip) replaces it,
    // a stale frame that still fires bails instead of re-committing or rescheduling itself.
    const anim = { toT, direction, onDone };
    this.#activeAnim = anim;
    const start = performance.now();
    const step = (now: number): void => {
      if (this.#activeAnim !== anim) return; // superseded/interrupted → this frame is void
      // Easing lives here; flipProgressToPose stays linear so seeks are deterministic.
      const raw = Math.min(1, (now - start) / duration);
      this.#renderer?.setFlipProgress(fromT + (toT - fromT) * easeInOutCubic(raw), direction);
      if (raw < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = null;
        this.#activeAnim = null;
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
    this.#announce();
    this.#emitter.emit('pageChanged', { page: toPage });
    this.#emitter.emit('flipEnd', { page: toPage });
    this.#drainQueuedFlip();
  }

  #leadPage(spreadIndex: number): number {
    const spread = this.#spreads[spreadIndex];
    if (!spread) return this.#currentPage;
    const pages = [spread.left, spread.right].filter((p): p is number => p !== null);
    return pages.length > 0 ? Math.min(...pages) : this.#currentPage;
  }

  #onDragStart(clientX: number, clientY: number): void {
    if (this.#pinching || !this.#renderer || this.#machine.state !== 'idle') return;
    this.#clearPendingClickFlip(); // a new press cancels a click-flip still waiting out its window
    // Zoomed in → a drag pans; at scale 1 → a corner drag flips (§9 mode switch).
    if (this.#scale > 1) {
      if (this.#machine.send('panStart') === null) return;
      this.#pan = { baseTx: this.#tx, baseTy: this.#ty };
      return;
    }
    const rect = this.#container.getBoundingClientRect();
    const b = this.#contentRect();
    // Points are relative to the letterboxed book, so zones/corners track the page, not the bars.
    const point = { x: clientX - rect.left - b.x, y: clientY - rect.top - b.y };
    this.#press = point; // remembered for tap classification / click-to-flip zone
    const cornerSize = Math.min(b.width, b.height) * CORNER_FRACTION;
    if (hitTest(point, { width: b.width, height: b.height }, cornerSize) !== 'corner') {
      return; // not a corner — no drag; a tap here may still click-to-flip on release
    }
    this.#anchorY = clamp(point.y / b.height, 0, 1); // fold anchors at the grabbed corner
    // Arm a potential drag; it only becomes a real flip once the pointer moves
    // (so a corner *tap* never fires a spurious flipStart). Right-side corner
    // turns the page forward in LTR; RTL mirrors it.
    const rightSide = point.x > b.width / 2;
    const forward = this.#direction === 'rtl' ? !rightSide : rightSide;
    const targetIndex = this.#current + (forward ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= this.#spreads.length) return;
    this.#pendingGrab = {
      direction: forward ? 'forward' : 'backward',
      targetIndex,
      toPage: this.#leadPage(targetIndex),
      width: b.width,
    };
  }

  /** Turn an armed corner press into a live drag flip once the pointer has moved. */
  #promoteGrab(): void {
    const grab = this.#pendingGrab;
    if (!grab) return;
    this.#pendingGrab = null;
    if (this.#machine.send('grab') === null) return;
    this.#drag = {
      direction: grab.direction,
      targetIndex: grab.targetIndex,
      toPage: grab.toPage,
      toContent: { left: null, right: null },
      width: grab.width,
      t: 0,
    };
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: grab.toPage });
    void this.#stageDrag(grab.targetIndex, grab.direction);
  }

  async #stageDrag(targetIndex: number, direction: FlipDirection): Promise<void> {
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    // The drag may have ended (or retargeted) while content was resolving.
    if (this.#drag?.targetIndex !== targetIndex) return;
    this.#drag.toContent = toContent;
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction, {
      fill: this.#singlePage,
      curl: this.#curl,
      anchor: { y: this.#anchorY },
    });
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
    // An armed corner press becomes a real flip once it moves past the threshold.
    if (this.#pendingGrab && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this.#promoteGrab();
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
    if (!drag) {
      // Never became a drag → it was a tap; maybe flip via clickToFlip.
      this.#pendingGrab = null;
      this.#maybeClickFlip(gesture);
      return;
    }
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

  #maybeClickFlip(gesture: GestureEnd): void {
    if (this.#clickToFlip === 'off' || this.#scale > 1 || !this.#press) return;
    // A tap barely moves; anything more was a drag we already ignored.
    if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) return;
    const direction = this.#clickFlipDirection(this.#press);
    if (!direction) return;
    const step = direction === 'forward' ? 1 : -1;
    if (this.#current + step < 0 || this.#current + step >= this.#spreads.length) return;
    // Anchor the fold at the tapped height (the fold/peel curls fold from where you tap).
    this.#anchorY = clamp(this.#press.y / this.#contentRect().height, 0, 1);
    // Read `#current` lazily so a tap queued mid-turn steps on from wherever the page lands.
    const flip = (): void => this.#startFlip(this.#current + step);
    this.#clearPendingClickFlip();
    if (this.#clickFlipDelayValue <= 0) {
      // No double-click competing here → flip right away (or queue if mid-turn).
      this.#requestFlip(flip);
      return;
    }
    // Wait out the window; a double-click (zoom) cancels this.
    this.#pendingClickTimer = setTimeout(() => {
      this.#pendingClickTimer = null;
      this.#requestFlip(flip);
    }, this.#clickFlipDelayValue);
  }

  /** Which way a tap at `point` (container-local) turns the page, or null for a dead zone. */
  /** Where the current spread is actually drawn (lone pages centered), as the renderer reports
   *  it — the region taps/drags map into. Falls back to book, then the full container. */
  #contentRect(): { x: number; y: number; width: number; height: number } {
    const m = this.#renderer!.measure();
    return m.content ?? m.book ?? { x: 0, y: 0, width: m.containerWidth, height: m.containerHeight };
  }

  #clickFlipDirection(point: { x: number; y: number }): FlipDirection | null {
    if (!this.#renderer) return null;
    const containerWidth = this.#contentRect().width;
    let side: 'left' | 'right' | null;
    if (this.#clickToFlip === 'half') {
      side = point.x > containerWidth / 2 ? 'right' : 'left';
    } else if (point.x <= this.#clickZoneSize) {
      side = 'left';
    } else if (point.x >= containerWidth - this.#clickZoneSize) {
      side = 'right';
    } else {
      side = null; // center dead zone in 'edge' mode
    }
    if (!side) return null;
    const forwardSide = this.#direction === 'rtl' ? 'left' : 'right';
    return side === forwardSide ? 'forward' : 'backward';
  }

  #clearPendingClickFlip(): void {
    if (this.#pendingClickTimer !== null) {
      clearTimeout(this.#pendingClickTimer);
      this.#pendingClickTimer = null;
    }
  }

  #cancelFlip(): void {
    const spread = this.#spreads[this.#current];
    if (spread) this.#paintSpread(spread, this.#currentContent);
    this.#machine.send('settle');
    this.#emitter.emit('flipEnd', { page: this.#currentPage });
    this.#drainQueuedFlip();
  }

  #onPinchStart(): void {
    // A second finger abandons any single-pointer gesture in flight.
    this.#pendingGrab = null;
    this.#clearPendingClickFlip();
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

  #bindWheelZoom(): void {
    const onWheel = (event: WheelEvent): void => {
      // Ctrl/⌘ + wheel only — this is also what a desktop trackpad pinch emits.
      if (!this.#wheelZoom || !this.#zoomEnabled || !(event.ctrlKey || event.metaKey)) return;
      // Override the browser's native page zoom.
      event.preventDefault();
      const rect = this.#container.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
      this.setZoom(this.#scale * factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    this.#container.addEventListener('wheel', onWheel as EventListener, { passive: false });
    this.#unbindWheel = () =>
      this.#container.removeEventListener('wheel', onWheel as EventListener);
  }

  #bindDoubleClickZoom(): void {
    const onDoubleClick = (event: MouseEvent): void => {
      const levels = this.#doubleClickLevels;
      if (!this.#zoomEnabled || levels === null) return;
      // At scale 1 a double-click inside a flip zone belongs to click-to-flip, not zoom,
      // unless we're honoring double-click zoom there.
      if (this.#scale <= 1 && this.#clickToFlip !== 'off' && !this.#honorDoubleClickInFlipZone) {
        const rect = this.#container.getBoundingClientRect();
        const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (this.#clickFlipDirection(local) !== null) return; // in a flip zone → leave it to click-to-flip
      }
      // A double-click means the single-click flip we may have queued was really a zoom.
      this.#clearPendingClickFlip();
      event.preventDefault();
      // Next configured level above the current scale, else wrap to the first.
      const next = levels.find((l) => l > this.#scale + 1e-6) ?? levels[0] ?? this.#scale;
      const rect = this.#container.getBoundingClientRect();
      this.setZoom(next, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    this.#container.addEventListener('dblclick', onDoubleClick as EventListener);
    this.#unbindDblClick = () =>
      this.#container.removeEventListener('dblclick', onDoubleClick as EventListener);
  }

  async #init(rendererOption: RendererOption): Promise<void> {
    // Load the renderer chunk while opening an async source (e.g. a PDF) in parallel.
    const rendererPromise = selectRenderer(rendererOption);
    if (typeof this.#source.open === 'function') {
      await this.#source.open();
      this.#buildSpreadModel(); // page count known now; validates + builds spreads
    }
    this.#source.prefetch([this.#currentPage]);

    const selected = await rendererPromise;
    const renderer = await this.#mountWithFallback(selected);
    this.#renderer = renderer;

    // Re-render the current spread when a source upgrades one of its pages in place.
    this.#source.onPageUpdate?.((index) => this.#onPageUpdate(index));

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
    this.#bindWheelZoom();
    this.#bindDoubleClickZoom();
    this.#setupReducedMotion();
    this.#a11yCleanup = this.#setupA11y();

    await this.#renderCurrent();
    this.#observeResize();
    this.#prefetchWindow();
    this.#announce();
    this.#emitter.emit('ready');
  }

  /** Mount `renderer`; if it can't initialize (e.g. no WebGL2 context) fall back to CSS. */
  async #mountWithFallback(renderer: Renderer): Promise<Renderer> {
    try {
      await renderer.mount(this.#container);
      renderer.onFatal?.(() => {
        void this.#fallbackToCss();
      });
      return renderer;
    } catch {
      renderer.destroy();
      const css = await selectRenderer('css');
      await css.mount(this.#container);
      this.#fellBack = true;
      this.#emitter.emit('rendererFallback', { from: 'webgl2', to: 'css' });
      return css;
    }
  }

  /** Runtime fallback: a live renderer signaled an unrecoverable failure (§8.4). */
  async #fallbackToCss(): Promise<void> {
    if (this.#fellBack || this.#destroyed) return;
    this.#fellBack = true;
    this.#renderer?.destroy();
    this.#renderer = null;
    const css = await selectRenderer('css');
    if (this.#destroyed) {
      css.destroy();
      return;
    }
    await css.mount(this.#container);
    this.#renderer = css;
    this.#applySinglePage(css.measure().containerWidth);
    await this.#renderCurrent();
    this.#emitter.emit('rendererFallback', { from: 'webgl2', to: 'css' });
  }

  #setupReducedMotion(): void {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    this.#reducedMotion = query.matches;
    query.addEventListener?.('change', (e) => {
      this.#reducedMotion = e.matches;
    });
  }

  /** Wire keyboard nav + an aria-live page announcer. Skips non-DOM containers. */
  #setupA11y(): (() => void) | null {
    const container = this.#container;
    const doc = container.ownerDocument;
    if (!doc || typeof container.setAttribute !== 'function') return null;

    if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
    container.setAttribute('aria-roledescription', 'flipbook');
    const onKey = (e: KeyboardEvent): void => this.#onKeyDown(e);
    container.addEventListener('keydown', onKey);

    const live = doc.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    container.appendChild(live);
    this.#liveRegion = live;

    return () => {
      container.removeEventListener('keydown', onKey);
      live.remove();
      this.#liveRegion = null;
    };
  }

  #onKeyDown(event: KeyboardEvent): void {
    const forwardKey = this.#direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        if (event.key === forwardKey) this.flipNext();
        else this.flipPrev();
        event.preventDefault();
        break;
      case 'Home':
        this.flipTo(0);
        event.preventDefault();
        break;
      case 'End':
        this.flipTo(this.#source.pageCount - 1);
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  #announce(): void {
    if (this.#liveRegion) {
      this.#liveRegion.textContent = `Page ${this.#currentPage + 1} of ${this.#source.pageCount}`;
    }
  }

  #effectiveDuration(): number {
    if (this.#reducedMotion) return 0;
    const singleRoll = this.#singlePage && this.#curl === 'roll';
    return this.#flipDuration * (singleRoll ? SINGLE_PAGE_ROLL_SLOWDOWN : 1);
  }

  /** Re-measure and re-render; call after the container resizes. */
  update(): void {
    if (!this.#renderer || this.#machine.state !== 'idle') return;
    this.#applySinglePage(this.#renderer.measure().containerWidth);
    void this.#renderCurrent();
  }

  /** The layout to actually use: the responsive narrow fallback forces 'single'. */
  #effectiveMode(): SpreadMode {
    return this.#narrow || this.#spreadMode === 'single' ? 'single' : this.#spreadMode;
  }

  #applySinglePage(containerWidth: number): void {
    const narrow = shouldSinglePage(containerWidth, this.#singlePageThreshold);
    if (narrow === this.#narrow) return;
    this.#narrow = narrow;
    const mode = this.#effectiveMode();
    this.#singlePage = mode === 'single';
    this.#spreads = buildSpreads(this.#source.pageCount, { direction: this.#direction, mode });
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
    this.#applyContainerAspect();
  }

  /** Match the container's aspect-ratio to the book so it fits with no letterbox bars.
   *  Non-destructive: `aspect-ratio` only drives whichever dimension the consumer leaves
   *  auto (fit-width when they set a width), and is ignored if both are fixed. */
  #applyContainerAspect(): void {
    const b = this.#renderer?.measure().book;
    if (!b || b.width <= 0 || b.height <= 0) return;
    const ratio = (b.width / b.height).toFixed(4);
    if (ratio === this.#lastAspect) return;
    this.#lastAspect = ratio;
    this.#container.style.aspectRatio = ratio;
  }

  /** A source upgraded a page's content (e.g. progressive PDF); repaint if it's on screen and idle. */
  #onPageUpdate(index: number): void {
    if (this.#machine.state !== 'idle') return; // don't disturb an in-flight flip
    const spread = this.#spreads[this.#current];
    if (spread && (spread.left === index || spread.right === index)) {
      void this.#renderCurrent();
    }
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
    const [left, right] = await Promise.all([this.#getPage(spread.left), this.#getPage(spread.right)]);
    return { left, right };
  }

  /** Decode one page; on failure emit `sourceError` and degrade to a blank (null) page. */
  async #getPage(index: number | null): Promise<PageContent | null> {
    if (index === null) return null;
    try {
      return await this.#source.get(index);
    } catch (error) {
      this.#emitter.emit('sourceError', { index, error });
      return null;
    }
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

  /** Validate the (now-known) page count + startPage and build the spread model. */
  #buildSpreadModel(): void {
    const pageCount = this.#source.pageCount;
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error(`Zine: source has ${pageCount} pages; a Source must have at least 1 page.`);
    }
    const startPage = this.#startPageOption;
    if (
      startPage !== undefined &&
      (!Number.isInteger(startPage) || startPage < 0 || startPage >= pageCount)
    ) {
      throw new Error(
        `Zine: startPage ${JSON.stringify(startPage)} is out of range for a ${pageCount}-page book (valid 0..${pageCount - 1}).`,
      );
    }
    const mode = this.#effectiveMode();
    this.#singlePage = mode === 'single';
    this.#spreads = buildSpreads(pageCount, { direction: this.#direction, mode });
    this.#currentPage = clamp(startPage ?? 0, 0, pageCount - 1);
    this.#current = this.#spreadIndexForPage(this.#currentPage);
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
  // Note: pageCount >= 1 and startPage-in-range are validated in #buildSpreadModel —
  // synchronously for a sync source, or after open() for an async one (e.g. PdfSource).

  const startPage = o.startPage;
  if (startPage !== undefined && (typeof startPage !== 'number' || !Number.isInteger(startPage) || startPage < 0)) {
    throw new Error(`Zine: startPage must be a non-negative integer; got ${JSON.stringify(startPage)}.`);
  }

  const direction = o.direction;
  if (direction !== undefined && direction !== 'ltr' && direction !== 'rtl') {
    throw new Error(`Zine: direction must be 'ltr' or 'rtl'; got ${JSON.stringify(direction)}.`);
  }

  const clickToFlip = o.clickToFlip;
  if (clickToFlip !== undefined && !['edge', 'half', 'off'].includes(clickToFlip as string)) {
    throw new Error(`Zine: clickToFlip must be 'edge', 'half', or 'off'; got ${JSON.stringify(clickToFlip)}.`);
  }

  const curl = o.curl;
  if (curl !== undefined && !CURL_TYPES.includes(curl as CurlType)) {
    throw new Error(`Zine: curl must be one of ${CURL_TYPES.join(', ')}; got ${JSON.stringify(curl)}.`);
  }

  const spreadMode = o.spreadMode;
  if (spreadMode !== undefined && !['double', 'single', 'cover', 'book'].includes(spreadMode as string)) {
    throw new Error(
      `Zine: spreadMode must be 'double', 'single', 'cover', or 'book'; got ${JSON.stringify(spreadMode)}.`,
    );
  }

  for (const key of ['frontCover', 'backCover'] as const) {
    const value = o[key];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`Zine: ${key} must be an image URL string; got ${JSON.stringify(value)}.`);
    }
  }
  const pages = o.pages;
  if (pages !== undefined && (typeof pages !== 'object' || pages === null || Array.isArray(pages))) {
    throw new Error('Zine: pages must be an object mapping page indices to image URLs.');
  }

  assertMin(o.width, 'width', 1);
  assertMin(o.height, 'height', 1);
  assertMin(o.flipDuration, 'flipDuration', 0);
  assertMin(o.clickZoneSize, 'clickZoneSize', 0);
  assertMin(o.clickFlipDelay, 'clickFlipDelay', 0);
  assertMin(o.singlePageThreshold, 'singlePageThreshold', 0);
  validateZoomOption(o.zoom);
  validateRendererOption(o.renderer);
}

function assertMin(value: unknown, name: string, min: number): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new Error(`Zine: ${name} must be a number >= ${min}; got ${JSON.stringify(value)}.`);
  }
}

function validateZoomOption(zoom: unknown): void {
  if (zoom === undefined) return;
  if (typeof zoom !== 'object' || zoom === null || Array.isArray(zoom)) {
    throw new Error('Zine: zoom must be an object, e.g. { max: 4 }.');
  }
  const z = zoom as Record<string, unknown>;
  if (z.enabled !== undefined && typeof z.enabled !== 'boolean') {
    throw new Error(`Zine: zoom.enabled must be a boolean; got ${JSON.stringify(z.enabled)}.`);
  }
  if (z.wheel !== undefined && typeof z.wheel !== 'boolean') {
    throw new Error(`Zine: zoom.wheel must be a boolean; got ${JSON.stringify(z.wheel)}.`);
  }
  if (z.doubleClickInFlipZone !== undefined && typeof z.doubleClickInFlipZone !== 'boolean') {
    throw new Error(
      `Zine: zoom.doubleClickInFlipZone must be a boolean; got ${JSON.stringify(z.doubleClickInFlipZone)}.`,
    );
  }
  if (z.doubleClick !== undefined && z.doubleClick !== false) {
    const levels = z.doubleClick;
    if (
      !Array.isArray(levels) ||
      levels.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 1)
    ) {
      throw new Error(
        'Zine: zoom.doubleClick must be false or an array of zoom levels >= 1, e.g. [1, 2, 4].',
      );
    }
  }
  assertMin(z.max, 'zoom.max', 1);
}

function validateRendererOption(renderer: unknown): void {
  if (renderer === undefined) return;
  if (typeof renderer === 'string') {
    if (renderer !== 'auto' && renderer !== 'css' && renderer !== 'webgl2') {
      throw new Error(
        `Zine: renderer '${renderer}' is not recognized; use 'auto', 'css', 'webgl2', an array of those, or a custom Renderer.`,
      );
    }
    return;
  }
  if (Array.isArray(renderer)) {
    for (const kind of renderer) {
      if (kind !== 'css' && kind !== 'webgl2') {
        throw new Error(
          `Zine: renderer order array may only contain 'css' or 'webgl2'; got ${JSON.stringify(kind)}.`,
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
    "Zine: renderer must be 'auto', 'css', 'webgl2', an array of those, or a custom Renderer instance.",
  );
}
