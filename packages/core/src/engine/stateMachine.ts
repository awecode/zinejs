export type FlipState = 'idle' | 'dragging' | 'animating' | 'zoomed-panning';

export type FlipEvent = 'grab' | 'release' | 'settle' | 'panStart' | 'panEnd' | 'flip';

/**
 * Legal transitions. A flip drag runs idle → dragging → animating → idle; a
 * programmatic flip jumps idle → animating directly via `flip`; zoom panning
 * (only reachable when zoomed in) is a separate branch idle → zoomed-panning →
 * idle. Any (state, event) pair absent here is illegal.
 */
const TRANSITIONS: Record<FlipState, Partial<Record<FlipEvent, FlipState>>> = {
  idle: { grab: 'dragging', panStart: 'zoomed-panning', flip: 'animating' },
  dragging: { release: 'animating' },
  animating: { settle: 'idle' },
  'zoomed-panning': { panEnd: 'idle' },
};

/** Pure transition: the next state, or null if `event` is illegal from `state`. */
export function nextState(state: FlipState, event: FlipEvent): FlipState | null {
  return TRANSITIONS[state][event] ?? null;
}

/** Stateful holder around `nextState`; illegal events are ignored. */
export class FlipMachine {
  #state: FlipState;

  constructor(initial: FlipState = 'idle') {
    this.#state = initial;
  }

  get state(): FlipState {
    return this.#state;
  }

  /** Apply `event`; returns the new state, or null (no-op) if the event was illegal. */
  send(event: FlipEvent): FlipState | null {
    const next = nextState(this.#state, event);
    if (next !== null) {
      this.#state = next;
    }
    return next;
  }
}
