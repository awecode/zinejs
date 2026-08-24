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
  const zine = new Zine(el, { source: new FakeSource(pageCount), renderer, startPage, flipDuration: 500, spreadMode: 'double', hints: false });
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

  it('lands an animating flip when a new grab presses in, without starting a spurious flip', async () => {
    const { zine, el } = await makeZine(6);
    const start = vi.fn();
    zine.on('flipStart', start);

    zine.flipNext(); // programmatic flip → animating toward spread 1
    await flush();
    // Pressing in mid-animation now lands that flip at once (so a chained grab can carry on
    // from there), rather than being ignored. The press alone must not fire a second flipStart.
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(zine.getPage()).toBe(2); // the running flip was committed, not left mid-turn
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

  it('chains a second flick that lands during the first flick\'s settle', async () => {
    const { zine, renderer, el } = await makeZine(6); // spreads [0,1] [2,3] [4,5]
    await swipe(el, 300, 760, 360); // forward flick → settling toward spread 1
    // Do NOT tick the settle: fire the next flick while the first is still animating. Its
    // pointerdown must land the running settle and chain straight on, the way repeat taps do.
    await swipe(el, 300, 760, 360); // second forward flick, on from where the first landed
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward', 'forward']);
    expect(zine.getPage()).toBe(4); // advanced two spreads, not stuck on one
  });

  it('flips forward on a leftward flick from the middle of the page', async () => {
    const { zine, renderer, el } = await makeZine(4); // spreads [0,1], [2,3]
    await swipe(el, 300, 400, 100); // starts dead center, not an edge zone → leftward flick
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(zine.getPage()).toBe(2);
  });

  it('flips backward on a rightward flick from the middle of the page', async () => {
    const { zine, renderer, el } = await makeZine(4, 2); // start on spread 1
    await swipe(el, 300, 400, 700); // center → rightward flick
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['backward']);
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip on a slow horizontal drag from the middle (only a flick turns)', async () => {
    const { zine, renderer, el } = await makeZine(4);
    // Center press, dragged far but slowly (every segment under the 0.3 px/ms threshold): no edge
    // grab is armed there, and without flick velocity nothing turns.
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 400, clientY: 300 });
    fireAt(el, 'pointermove', 2000, { pointerId: 1, clientX: 200, clientY: 300 });
    await flush();
    fireAt(el, 'pointerup', 4000, { pointerId: 1, clientX: 100, clientY: 300 });
    await flush();
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual([]);
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip on a vertical flick from the middle (page-scroll intent)', async () => {
    const { zine, renderer, el } = await makeZine(4);
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 400, clientY: 100 });
    fireAt(el, 'pointermove', 10, { pointerId: 1, clientX: 400, clientY: 300 });
    fireAt(el, 'pointermove', 20, { pointerId: 1, clientX: 400, clientY: 500 }); // fast, but vertical
    fireAt(el, 'pointerup', 22, { pointerId: 1, clientX: 400, clientY: 500 });
    await flush();
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

  it('cancels a peel dragged past halfway then flung back toward the edge', async () => {
    const { zine, renderer, el } = await makeZine(4);
    // Peel the right edge well past halfway, then flick back toward the edge to let go — the
    // mobile counterpart of dragging back to cancel on desktop. Position says commit, but the
    // release velocity points back, so it must snap home.
    await dragThrough(el, [
      { x: 760, y: 300, t: 0 },
      { x: 300, y: 300, t: 2000 }, // dx=-460 → t≈0.58, past halfway; grab promoted here
      { x: 340, y: 300, t: 2010 }, // fast rightward: vx=+4 px/ms back toward the edge, t≈0.53
      { x: 340, y: 300, t: 2012 },
    ]);
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']); // it did peel…
    expect(zine.getPage()).toBe(0); // …but the throw-back cancelled it
  });

  it('commits a peel released short of halfway when flung onward', async () => {
    const { zine, renderer, el } = await makeZine(4);
    // Barely peeled (short of halfway), but flicked onward on release — velocity carries it over.
    await dragThrough(el, [
      { x: 760, y: 300, t: 0 },
      { x: 700, y: 300, t: 2000 }, // dx=-60 → t≈0.08, short of halfway; grab promoted
      { x: 500, y: 300, t: 2010 }, // fast leftward: vx=-20 px/ms onward
      { x: 500, y: 300, t: 2012 },
    ]);
    tick(1000);
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(zine.getPage()).toBe(2); // the onward flick carried it over
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

describe('Zine — touch-action (browser keeps vertical scroll at rest)', () => {
  it('claims only horizontal gestures at rest, so the page still scrolls vertically', async () => {
    const { el } = await makeZine(4);
    expect(el.style.touchAction).toBe('pan-y');
  });

  it('takes both axes when zoomed and hands vertical back on reset', async () => {
    const { zine, el } = await makeZine(4);
    zine.setZoom(2);
    expect(el.style.touchAction).toBe('none');
    zine.resetZoom();
    expect(el.style.touchAction).toBe('pan-y');
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

  it('replaces the browser menu by default (the book menu takes over)', async () => {
    expect(rightClick(await mount({}))).toBe(true);
  });

  it('leaves the browser menu alone when the book menu is off', async () => {
    expect(rightClick(await mount({ contextMenu: false }))).toBe(false);
  });

  it('suppresses it with nothing in its place when asked', async () => {
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
