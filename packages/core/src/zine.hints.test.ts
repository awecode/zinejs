// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent, FlipDirection } from './renderer/types';

class FakeSource implements Source {
  readonly pageCount: number;
  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(): Promise<PageContent> {
    return { width: 1, height: 1 } as unknown as PageContent;
  }
  prefetch(): void {}
  destroy(): void {}
}

/** Records the flip calls the hints drive, so a test can tell a peek (staged, seeked, never
 *  committed) from a real turn without inspecting pixels. */
class SpyRenderer implements Renderer {
  beginFlips = 0;
  progress: number[] = [];
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(): void {}
  beginFlip(_f: SpreadContent, _t: SpreadContent, _d: FlipDirection): void {
    this.beginFlips++;
  }
  setFlipProgress(t: number): void {
    this.progress.push(t);
  }
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

let rafCbs: Array<() => void> = [];
let now = 0;
function tick(dt: number): void {
  now += dt;
  const cbs = rafCbs;
  rafCbs = [];
  for (const cb of cbs) cb();
}
/** Let queued microtasks (async content resolution inside a peek/flip) run to completion. */
async function micro(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
/** Drive an in-flight flip animation to its landing (stage, then run the rAF to raw >= 1). */
async function settleFlip(): Promise<void> {
  await micro();
  tick(2000);
  await micro();
}
function tap(el: EventTarget, x: number, y: number): void {
  el.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
  el.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
}
/** Press and move without releasing — a live drag, used to pan while zoomed. */
function pressAndMove(el: EventTarget, fromX: number, toX: number, y: number): void {
  el.dispatchEvent(
    Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: fromX, clientY: y }),
  );
  el.dispatchEvent(
    Object.assign(new Event('pointermove', { bubbles: true }), { pointerId: 1, clientX: toX, clientY: y }),
  );
}
/** A single click at a point, carrying the pointerType the zoom hint gates on (default mouse). */
function click(el: EventTarget, x: number, y: number, pointerType = 'mouse'): void {
  el.dispatchEvent(
    Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y, pointerType }),
  );
  el.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
  el.dispatchEvent(Object.assign(new Event('click', { bubbles: true }), { clientX: x, clientY: y }));
}
const CAPTION = '.zine-hint-caption';

/** happy-dom here ships no localStorage, so give persist tests a minimal in-memory one. */
function makeLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  rafCbs = [];
  now = 0;
  vi.useFakeTimers();
  // Our own rAF/performance stubs override the fake-timer versions so peeks and flips seek by hand.
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('localStorage', makeLocalStorage());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function makeZine(
  opts: Partial<ZineOptions> = {},
): Promise<{ zine: Zine; el: HTMLElement; spy: SpyRenderer }> {
  const spy = new SpyRenderer();
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(6),
    renderer: spy,
    spreadMode: 'double',
    controls: false,
    deepLink: false,
    ...opts,
  });
  await zine.ready;
  return { zine, el, spy };
}

describe('Zine — discoverability hints', () => {
  it('peeks the leading corner once on ready, without turning the page', async () => {
    const { zine, spy } = await makeZine();
    await micro(); // let the peek resolve its content and schedule the first frame
    expect(spy.beginFlips).toBe(1); // staged the next spread
    tick(360); // out to the lift
    tick(360); // and back to rest
    expect(Math.max(...spy.progress)).toBeGreaterThan(0.1); // it lifted
    expect(spy.progress[spy.progress.length - 1]).toBeCloseTo(0, 5); // and settled flat
    expect(zine.getPage()).toBe(0); // never committed a turn
  });

  it('does not peek on ready when the reader has already learned to turn (persisted)', async () => {
    localStorage.setItem('zine:hints-learned', JSON.stringify({ turn: true, zoom: false, pan: false }));
    const { spy } = await makeZine({ hints: { persist: true } });
    await micro();
    expect(spy.beginFlips).toBe(0); // the peek is silent for a reader who knows
  });

  it('replays the peek once if the reader sits idle without turning a page', async () => {
    const { spy } = await makeZine();
    await micro();
    tick(720); // finish the ready peek
    const afterReady = spy.beginFlips;
    await vi.advanceTimersByTimeAsync(7000); // idle past the nudge window
    await micro();
    expect(spy.beginFlips).toBe(afterReady + 1); // the nudge fired one more peek
  });

  it('cancels the idle nudge once a page is turned', async () => {
    const { zine, el, spy } = await makeZine();
    await micro();
    tap(el, 790, 300); // turn forward before the idle window elapses
    await settleFlip();
    expect(zine.getPage()).toBe(2);
    const afterTurn = spy.beginFlips;
    await vi.advanceTimersByTimeAsync(7000);
    await micro();
    expect(spy.beginFlips).toBe(afterTurn); // no nudge — the reader already knows
  });

  it('shows the pan caption on first zoom, then removes it when the reader pans', async () => {
    const { zine, el } = await makeZine();
    await micro();
    zine.setZoom(2);
    expect(el.querySelector('.zine-hint-caption')?.textContent).toBe('Drag to move');
    pressAndMove(el, 400, 520, 300); // a pan while zoomed
    expect(el.querySelector('.zine-hint-caption')).toBeNull();
  });

  it('does not show the pan caption again on a later zoom once panning is learned', async () => {
    const { zine, el } = await makeZine();
    await micro();
    zine.setZoom(2);
    pressAndMove(el, 400, 520, 300); // learn to pan
    zine.setZoom(1);
    zine.setZoom(2); // zoom in again
    expect(el.querySelector('.zine-hint-caption')).toBeNull();
  });

  it('under reduced motion, suppresses the peek but still shows the caption (without a fade)', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: /reduce/.test(q),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { zine, el, spy } = await makeZine();
    await micro();
    tick(720);
    expect(spy.beginFlips).toBe(0); // the peek is a motion cue; reduced motion drops it
    zine.setZoom(2);
    const caption = el.querySelector('.zine-hint-caption') as HTMLElement | null;
    expect(caption?.textContent).toBe('Drag to move'); // the text still informs
    expect(caption?.style.transition).toBe(''); // but it appears without the opacity fade
  });

  it('does nothing at all when hints is false', async () => {
    const { zine, el, spy } = await makeZine({ hints: false });
    await micro();
    tick(720);
    expect(spy.beginFlips).toBe(0); // no peek
    zine.setZoom(2);
    expect(el.querySelector('.zine-hint-caption')).toBeNull(); // no caption
    await vi.advanceTimersByTimeAsync(7000);
    await micro();
    expect(spy.beginFlips).toBe(0); // no idle nudge
  });

  it('records a learned gesture to localStorage under persist, and leaves it alone otherwise', async () => {
    const { zine: persisted } = await makeZine({ hints: { persist: true } });
    await micro();
    persisted.setZoom(2); // learns zoom
    const stored = JSON.parse(localStorage.getItem('zine:hints-learned') ?? '{}');
    expect(stored.zoom).toBe(true);

    localStorage.clear();
    const { zine: ephemeral } = await makeZine({ hints: true }); // default persist: false
    await micro();
    ephemeral.setZoom(2);
    expect(localStorage.getItem('zine:hints-learned')).toBeNull(); // in-memory only
  });
});

describe('Zine — zoom hint on a dead-zone lone click', () => {
  it('shows a zoom caption after a lone mouse click in the dead centre where only a double-click acts', async () => {
    const { el } = await makeZine();
    await micro();
    tick(720); // let the ready peek finish
    click(el, 400, 300); // centre dead zone: a single click does nothing, a double-click would zoom
    expect(el.querySelector(CAPTION)).toBeNull(); // nothing yet — waiting out the pairing window
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)?.textContent).toBe('Double-click or Ctrl-scroll to zoom');
  });

  it('does not show it for a real double-click (that zooms, which teaches zoom directly)', async () => {
    const { zine, el } = await makeZine();
    await micro();
    tick(720);
    click(el, 400, 300);
    click(el, 400, 300); // pairs within the window → a double-click
    await vi.advanceTimersByTimeAsync(250);
    expect(zine.getZoom()).toBe(2); // it zoomed
    // Zooming legitimately fires the first-zoom pan caption (hint C); the zoom *hint* never did.
    expect(el.querySelector(CAPTION)?.textContent).toBe('Drag to move');
  });

  it('stays silent for touch (no double-click gesture there)', async () => {
    const { el } = await makeZine();
    await micro();
    tick(720);
    click(el, 400, 300, 'touch');
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)).toBeNull();
  });

  it('stays silent in a live flip zone (a click there does something)', async () => {
    // 6 pages, middle spread → the right edge can turn, so it is not a dead zone.
    const { el } = await makeZine({ startPage: 2 });
    await micro();
    tick(720);
    click(el, 790, 300); // live forward flip zone
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)).toBeNull();
  });

  it('teaches at most once — a second dead-zone click does not re-show it', async () => {
    const { el } = await makeZine();
    await micro();
    tick(720);
    click(el, 400, 300);
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2200); // let the first caption time out
    expect(el.querySelector(CAPTION)).toBeNull();
    tick(400); // move the clock on so this click cannot pair with the stale first one
    click(el, 400, 300); // try again
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)).toBeNull(); // already taught this session
  });

  it('does nothing when hints is false', async () => {
    const { el } = await makeZine({ hints: false });
    await micro();
    click(el, 400, 300);
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)).toBeNull();
  });

  it('names only double-click when wheel zoom is off', async () => {
    const { el } = await makeZine({ zoom: { wheel: false } });
    await micro();
    tick(720);
    click(el, 400, 300);
    await vi.advanceTimersByTimeAsync(250);
    expect(el.querySelector(CAPTION)?.textContent).toBe('Double-click to zoom');
  });
});
