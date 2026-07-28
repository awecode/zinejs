export interface GestureStart {
  x: number;
  y: number;
  t: number;
}

export interface GestureMove {
  x: number;
  y: number;
  /** Displacement from the start point. */
  dx: number;
  dy: number;
}

export interface GestureEnd {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Elapsed time from start to end (ms). */
  dt: number;
  /** Velocity of the final move segment (px/ms). */
  vx: number;
  vy: number;
  /** A fast flick: final speed exceeded the swipe threshold and the gesture was not canceled. */
  swipe: boolean;
  /** The pointer was canceled (e.g. pointercancel) rather than lifted. */
  canceled: boolean;
}

export interface PointerHandlers {
  onStart?: (g: GestureStart) => void;
  onMove?: (g: GestureMove) => void;
  onEnd?: (g: GestureEnd) => void;
}

/** Flick threshold in px/ms; a release faster than this is a swipe. */
const SWIPE_VELOCITY = 0.3;

interface Sample {
  x: number;
  y: number;
  t: number;
}

/**
 * Recognizes a single-pointer drag from raw pointer samples and reports normalized
 * gestures. DOM-agnostic on purpose: `bindPointerInput` maps real PointerEvents onto
 * it, but the kinematics stay pure and unit-testable. Extra pointers are ignored
 * (multi-touch pinch is a separate recognizer).
 */
export class PointerRecognizer {
  #handlers: PointerHandlers;
  #activeId: number | null = null;
  #start: Sample | null = null;
  #prev: Sample | null = null;
  #last: Sample | null = null;

  constructor(handlers: PointerHandlers = {}) {
    this.#handlers = handlers;
  }

  get active(): boolean {
    return this.#activeId !== null;
  }

  down(id: number, x: number, y: number, t: number): void {
    if (this.#activeId !== null) return; // single-pointer; ignore extra pointers
    this.#activeId = id;
    const s: Sample = { x, y, t };
    this.#start = s;
    this.#prev = s;
    this.#last = s;
    this.#handlers.onStart?.({ x, y, t });
  }

  move(id: number, x: number, y: number, t: number): void {
    if (id !== this.#activeId || this.#start === null) return;
    this.#prev = this.#last;
    this.#last = { x, y, t };
    this.#handlers.onMove?.({ x, y, dx: x - this.#start.x, dy: y - this.#start.y });
  }

  up(id: number, x: number, y: number, t: number): void {
    this.#end(id, x, y, t, false);
  }

  cancel(id: number, x: number, y: number, t: number): void {
    this.#end(id, x, y, t, true);
  }

  #end(id: number, x: number, y: number, t: number, canceled: boolean): void {
    if (id !== this.#activeId || this.#start === null) return;
    const start = this.#start;
    // Velocity comes from the last move segment, not the release point — on lift the
    // pointer usually stops, so release-relative velocity would kill every flick.
    const last = this.#last ?? start;
    const prev = this.#prev ?? start;
    const segDt = last.t - prev.t;
    const vx = segDt > 0 ? (last.x - prev.x) / segDt : 0;
    const vy = segDt > 0 ? (last.y - prev.y) / segDt : 0;
    const speed = Math.hypot(vx, vy);
    this.#reset();
    this.#handlers.onEnd?.({
      x,
      y,
      dx: x - start.x,
      dy: y - start.y,
      dt: t - start.t,
      vx,
      vy,
      swipe: !canceled && speed > SWIPE_VELOCITY,
      canceled,
    });
  }

  #reset(): void {
    this.#activeId = null;
    this.#start = null;
    this.#prev = null;
    this.#last = null;
  }
}

/**
 * Wire real PointerEvents from `target` into a recognizer. Returns an unbind
 * function that removes every listener. Coordinates are passed through as
 * client-space; mapping to page-local space is the engine's job.
 */
export function bindPointerInput(target: EventTarget, recognizer: PointerRecognizer): () => void {
  const down = (e: Event): void => {
    const p = e as PointerEvent;
    recognizer.down(p.pointerId, p.clientX, p.clientY, p.timeStamp);
  };
  const move = (e: Event): void => {
    const p = e as PointerEvent;
    recognizer.move(p.pointerId, p.clientX, p.clientY, p.timeStamp);
  };
  const up = (e: Event): void => {
    const p = e as PointerEvent;
    recognizer.up(p.pointerId, p.clientX, p.clientY, p.timeStamp);
  };
  const cancel = (e: Event): void => {
    const p = e as PointerEvent;
    recognizer.cancel(p.pointerId, p.clientX, p.clientY, p.timeStamp);
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
  };
}

/**
 * Wire PointerEvents from `target` into a drag recognizer and/or a pinch
 * recognizer at once, so a single pointer stream feeds both. Returns an unbind.
 */
export function bindGestures(
  target: EventTarget,
  recognizers: { pointer?: PointerRecognizer; pinch?: PinchRecognizer },
): () => void {
  const { pointer, pinch } = recognizers;
  const down = (e: Event): void => {
    const p = e as PointerEvent;
    pointer?.down(p.pointerId, p.clientX, p.clientY, p.timeStamp);
    pinch?.down(p.pointerId, p.clientX, p.clientY);
  };
  const move = (e: Event): void => {
    const p = e as PointerEvent;
    pointer?.move(p.pointerId, p.clientX, p.clientY, p.timeStamp);
    pinch?.move(p.pointerId, p.clientX, p.clientY);
  };
  const up = (e: Event): void => {
    const p = e as PointerEvent;
    pointer?.up(p.pointerId, p.clientX, p.clientY, p.timeStamp);
    pinch?.up(p.pointerId);
  };
  const cancel = (e: Event): void => {
    const p = e as PointerEvent;
    pointer?.cancel(p.pointerId, p.clientX, p.clientY, p.timeStamp);
    pinch?.cancel(p.pointerId);
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
  };
}

export interface PinchStart {
  centerX: number;
  centerY: number;
  /** Distance between the two pointers at pinch start. */
  distance: number;
}

export interface PinchMove {
  centerX: number;
  centerY: number;
  /** Current distance / start distance. */
  scale: number;
}

export interface PinchHandlers {
  onPinchStart?: (g: PinchStart) => void;
  onPinchMove?: (g: PinchMove) => void;
  onPinchEnd?: () => void;
}

interface Pt {
  x: number;
  y: number;
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Recognizes a two-pointer pinch and reports zoom scale (relative to the start
 * distance) and the live center point. No timestamps: pinch drives zoom, not a
 * flick. A third pointer is ignored; lifting either tracked pointer ends the pinch.
 * Coordinating this with the drag recognizer (a second finger should suspend a
 * single-finger drag) is the engine's job.
 */
export class PinchRecognizer {
  #handlers: PinchHandlers;
  #points = new Map<number, Pt>();
  #startDistance = 0;
  #pinching = false;

  constructor(handlers: PinchHandlers = {}) {
    this.#handlers = handlers;
  }

  get pinching(): boolean {
    return this.#pinching;
  }

  down(id: number, x: number, y: number): void {
    if (this.#points.has(id) || this.#points.size >= 2) return; // track only two
    this.#points.set(id, { x, y });
    if (this.#points.size === 2) {
      const { a, b } = this.#pair();
      this.#startDistance = distance(a, b);
      this.#pinching = true;
      this.#handlers.onPinchStart?.({
        centerX: (a.x + b.x) / 2,
        centerY: (a.y + b.y) / 2,
        distance: this.#startDistance,
      });
    }
  }

  move(id: number, x: number, y: number): void {
    const p = this.#points.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (!this.#pinching) return;
    const { a, b } = this.#pair();
    this.#handlers.onPinchMove?.({
      centerX: (a.x + b.x) / 2,
      centerY: (a.y + b.y) / 2,
      scale: this.#startDistance > 0 ? distance(a, b) / this.#startDistance : 1,
    });
  }

  up(id: number): void {
    this.#remove(id);
  }

  cancel(id: number): void {
    this.#remove(id);
  }

  #remove(id: number): void {
    if (!this.#points.delete(id)) return;
    if (this.#pinching && this.#points.size < 2) {
      this.#pinching = false;
      this.#startDistance = 0;
      this.#handlers.onPinchEnd?.();
    }
  }

  #pair(): { a: Pt; b: Pt } {
    const values = [...this.#points.values()];
    const a = values[0];
    const b = values[1];
    if (!a || !b) throw new Error('pinch requires two active pointers');
    return { a, b };
  }
}
