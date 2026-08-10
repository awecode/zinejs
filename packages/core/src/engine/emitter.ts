import type { SpreadMode } from './spread.js';

export type Listener<T> = (payload: T) => void;

/** Events typed as `void` are emitted with no payload argument. */
type PayloadArgs<T> = [T] extends [void] ? [] : [payload: T];

/** Minimal typed event emitter keyed by an event map. */
export class Emitter<Events> {
  #listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  /** Subscribe; returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(type, listener);
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.#listeners.get(type)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(type: K, ...args: PayloadArgs<Events[K]>): void {
    const payload = args[0] as Events[K];
    // Copy so a listener that unsubscribes mid-emit doesn't disturb iteration.
    const set = this.#listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  clear(): void {
    this.#listeners.clear();
  }
}

/**
 * Public event surface of a Zine instance. Payloads are provisional and will
 * firm up as the engine wires the emitters that fire them.
 */
export interface ZineEventMap {
  ready: void;
  flipStart: { from: number; to: number };
  flipEnd: { page: number };
  pageChanged: { page: number };
  /** Pages regrouped: the spread mode changed, or a narrow container forced one page. */
  spreadChanged: { mode: SpreadMode; singlePage: boolean };
  zoomChanged: { scale: number };
  sourceError: { index: number; error: unknown };
  rendererFallback: { from: string; to: string };
}

export type ZineEmitter = Emitter<ZineEventMap>;
