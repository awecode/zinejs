/** Spread indices that should be mounted around `current`, clamped to the book. */
export function mountWindow(current: number, spreadCount: number, radius: number): number[] {
  const window: number[] = [];
  const from = Math.max(0, current - radius);
  const to = Math.min(spreadCount - 1, current + radius);
  for (let i = from; i <= to; i++) {
    window.push(i);
  }
  return window;
}

export interface VirtualizerDelta {
  toMount: number[];
  toEvict: number[];
}

/**
 * Tracks which spreads are mounted and, on each move, reports the difference:
 * spreads entering the ±radius window (`toMount`) and those leaving it
 * (`toEvict`). Default radius 2 = current spread ±2.
 */
export class Virtualizer {
  #radius: number;
  #mounted = new Set<number>();

  constructor(radius = 2) {
    this.#radius = radius;
  }

  get mounted(): number[] {
    return [...this.#mounted].sort((a, b) => a - b);
  }

  /** Recenter on `current`; mounts/evicts to match the window and returns the delta. */
  update(current: number, spreadCount: number): VirtualizerDelta {
    const window = new Set(mountWindow(current, spreadCount, this.#radius));
    const toMount = [...window].filter((i) => !this.#mounted.has(i)).sort((a, b) => a - b);
    const toEvict = [...this.#mounted].filter((i) => !window.has(i)).sort((a, b) => a - b);
    for (const i of toEvict) this.#mounted.delete(i);
    for (const i of toMount) this.#mounted.add(i);
    return { toMount, toEvict };
  }
}
