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
