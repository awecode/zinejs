// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  SpreadContent,
} from './renderer/types';
import type { Spread } from './engine/spread';

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

class MockRenderer implements Renderer {
  readonly begun: FlipDirection[] = [];
  readonly rendered: Spread[] = [];
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(spread: Spread, _content: SpreadContent): void {
    this.rendered.push(spread);
  }
  beginFlip(_from: SpreadContent, _to: SpreadContent, direction: FlipDirection): void {
    this.begun.push(direction);
  }
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

let now = 0;
let rafCbs: FrameRequestCallback[] = [];
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
function tick(dt: number): void {
  now += dt;
  const cbs = rafCbs;
  rafCbs = [];
  for (const cb of cbs) cb(now);
}
function fire(target: EventTarget, type: string, props: Record<string, number>): void {
  target.dispatchEvent(Object.assign(new Event(type), props));
}

/** Fire a pointer event carrying a timestamp, so the recognizer can measure flick velocity
 *  (happy-dom's Event.timeStamp is read-only, hence defineProperty). */
function fireAt(target: EventTarget, type: string, t: number, props: Record<string, number>): void {
  const e = Object.assign(new Event(type), props);
  Object.defineProperty(e, 'timeStamp', { value: t, configurable: true });
  target.dispatchEvent(e);
}

/** Play a pointer gesture through timestamped samples: the first is the press, the last the
 *  release, the rest are moves. Flushes after each move so a promoted grab can stage its content
 *  (that staging is async) before the next event — the release is misread as a tap otherwise. */
async function dragThrough(
  target: EventTarget,
  samples: Array<{ x: number; y: number; t: number }>,
): Promise<void> {
  const down = samples[0]!;
  const up = samples[samples.length - 1]!;
  const moves = samples.slice(1, -1);
  fireAt(target, 'pointerdown', down.t, { pointerId: 1, clientX: down.x, clientY: down.y });
  for (const m of moves) {
    fireAt(target, 'pointermove', m.t, { pointerId: 1, clientX: m.x, clientY: m.y });
    await flush();
  }
  fireAt(target, 'pointerup', up.t, { pointerId: 1, clientX: up.x, clientY: up.y });
  await flush();
}

/** A fast horizontal flick from x0 to x1 at height y: the last move segment clears the
 *  recognizer's 0.3 px/ms swipe threshold (200px in 10ms). */
async function swipe(target: EventTarget, y: number, x0: number, x1: number): Promise<void> {
  await dragThrough(target, [
    { x: x0, y, t: 0 },
    { x: (x0 + x1) / 2, y, t: 10 },
    { x: x1, y, t: 20 }, // last segment sets the release velocity
    { x: x1, y, t: 22 },
  ]);
}

beforeEach(() => {
  now = 0;
  rafCbs = [];
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeZine(
  pageCount = 4,
  startPage = 0,
): Promise<{ zine: Zine; renderer: MockRenderer; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const renderer = new MockRenderer();
  const zine = new Zine(el, { source: new FakeSource(pageCount), renderer, startPage, flipDuration: 500, spreadMode: 'double' });
  await zine.ready;
  return { zine, renderer, el };
}

describe('Zine — slice 3 (drag to flip)', () => {
  it('completes a forward flip when a right-corner drag passes the halfway point', async () => {
    const { zine, renderer, el } = await makeZine(4); // spreads [0,1], [2,3]
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 }); // right corner
    fire(el, 'pointermove', { pointerId: 1, clientX: 390, clientY: 10 }); // dx=-400 → promote + t=0.5
    await flush(); // drag promoted on move → stage content → beginFlip
    fire(el, 'pointerup', { pointerId: 1, clientX: 390, clientY: 10 });
    await flush();
    tick(1000); // finish the settle animation
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(zine.getPage()).toBe(2);
    expect(renderer.rendered.at(-1)).toEqual({ left: 2, right: 3 });
  });

  it('cancels and stays put when the drag falls short', async () => {
    const { zine, el } = await makeZine(4);
    const pageChanged = vi.fn();
    zine.on('pageChanged', pageChanged);

    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 });
    await flush();
    fire(el, 'pointermove', { pointerId: 1, clientX: 700, clientY: 10 }); // dx=-90 → t≈0.11
    fire(el, 'pointerup', { pointerId: 1, clientX: 700, clientY: 10 });
    await flush();
    tick(1000);
    await flush();

    expect(zine.getPage()).toBe(0);
    expect(pageChanged).not.toHaveBeenCalled();
  });

  it('drives a backward flip from a left-corner drag', async () => {
    const { zine, renderer, el } = await makeZine(4, 2); // start on spread 1
    fire(el, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }); // left corner
    fire(el, 'pointermove', { pointerId: 1, clientX: 410, clientY: 10 }); // dx=+400 → promote + t=0.5
    await flush();
    fire(el, 'pointerup', { pointerId: 1, clientX: 410, clientY: 10 });
    await flush();
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['backward']);
    expect(zine.getPage()).toBe(0);
  });

  it('ignores a press away from the side edges', async () => {
    const { zine, el } = await makeZine(4);
    const start = vi.fn();
    zine.on('flipStart', start);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 }); // center, no edge band
    fire(el, 'pointermove', { pointerId: 1, clientX: 100, clientY: 300 });
    fire(el, 'pointerup', { pointerId: 1, clientX: 100, clientY: 300 });
    await flush();
    expect(start).not.toHaveBeenCalled();
  });

  it('ignores a corner grab while a flip is already animating', async () => {
    const { zine, el } = await makeZine(6);
    const start = vi.fn();
    zine.on('flipStart', start);

    zine.flipNext(); // programmatic flip → animating
    await flush();
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 }); // busy → ignored
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('Zine — slice 3 (peel/swipe to flip from a side edge)', () => {
  it('flips forward on a leftward flick from the vertical middle of the right edge', async () => {
    const { zine, renderer, el } = await makeZine(4); // spreads [0,1], [2,3]
    await swipe(el, 300, 760, 360); // right edge, dead-center height → leftward flick
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(zine.getPage()).toBe(2);
  });

  it('flips backward on a rightward flick from the middle of the left edge', async () => {
    const { zine, renderer, el } = await makeZine(4, 2); // start on spread 1
    await swipe(el, 300, 40, 440); // left edge → rightward flick
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['backward']);
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip on a flick from the middle of the page', async () => {
    const { zine, renderer, el } = await makeZine(4);
    await swipe(el, 300, 400, 100); // starts dead center, not an edge zone
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual([]);
    expect(zine.getPage()).toBe(0);
  });

  it('peels and flips on a slow drag from the mid-edge that crosses halfway', async () => {
    const { zine, renderer, el } = await makeZine(4);
    // Slow (every segment under the 0.3 px/ms swipe threshold), so no flick shortcut — it
    // flips only because the peel is dragged past the halfway point, following the finger.
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 760, clientY: 300 });
    fireAt(el, 'pointermove', 2000, { pointerId: 1, clientX: 460, clientY: 300 });
    await flush(); // grab promoted on this move → stage content before the release
    fireAt(el, 'pointermove', 3000, { pointerId: 1, clientX: 360, clientY: 300 }); // dx=-400 → t=1.0
    fireAt(el, 'pointerup', 3000, { pointerId: 1, clientX: 360, clientY: 300 });
    await flush();
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(zine.getPage()).toBe(2);
  });

  it('cancels a mid-edge peel that is released before halfway', async () => {
    const { zine, renderer, el } = await makeZine(4);
    // Grabs the mid-edge and drags only a little (dx=-80, t≈0.1), slowly, then lets go.
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 760, clientY: 300 });
    fireAt(el, 'pointermove', 2000, { pointerId: 1, clientX: 720, clientY: 300 });
    await flush(); // grab promoted on this move → stage content before the release
    fireAt(el, 'pointermove', 3000, { pointerId: 1, clientX: 680, clientY: 300 });
    fireAt(el, 'pointerup', 3000, { pointerId: 1, clientX: 680, clientY: 300 });
    await flush();
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']); // it did peel (a fold began)…
    expect(zine.getPage()).toBe(0); // …but fell short, so the book stays put
  });

  it('does not turn the page on a purely vertical drag from the edge', async () => {
    const { zine, el } = await makeZine(4);
    // A vertical throw carries no horizontal progress (t stays ~0), so whatever peel it arms
    // snaps straight back. The guarantee that matters is that the book does not turn.
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 760, clientY: 100 });
    fireAt(el, 'pointermove', 10, { pointerId: 1, clientX: 760, clientY: 300 });
    fireAt(el, 'pointermove', 20, { pointerId: 1, clientX: 760, clientY: 500 }); // vertical throw
    fireAt(el, 'pointerup', 22, { pointerId: 1, clientX: 760, clientY: 500 });
    await flush();
    tick(1000);
    await flush();

    expect(zine.getPage()).toBe(0);
  });

  it('does not flip past the end on a forward flick at the last spread', async () => {
    const { zine, renderer, el } = await makeZine(4, 2); // last spread [2,3]
    swipe(el, 300, 760, 360); // forward flick with nowhere to go
    await flush();
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual([]);
    expect(zine.getPage()).toBe(2);
  });
});

describe('Zine — context menu', () => {
  /** Right-click, and report whether anything suppressed the menu. */
  const rightClick = (el: HTMLElement): boolean =>
    !el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));

  const mount = async (options: Record<string, unknown>): Promise<HTMLElement> => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      spreadMode: 'double',
      ...options,
    });
    await zine.ready;
    return el;
  };

  it('leaves the browser menu alone by default', async () => {
    expect(rightClick(await mount({}))).toBe(false);
  });

  it('suppresses it when asked', async () => {
    expect(rightClick(await mount({ disableContextMenu: true }))).toBe(true);
  });

  it('stops suppressing it once the book is destroyed', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      disableContextMenu: true,
    });
    await zine.ready;
    expect(rightClick(el)).toBe(true);
    zine.destroy();
    expect(rightClick(el)).toBe(false); // the listener went with it
  });
});
