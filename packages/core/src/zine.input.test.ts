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

  it('ignores a press that is not on a corner', async () => {
    const { zine, el } = await makeZine(4);
    const start = vi.fn();
    zine.on('flipStart', start);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 }); // center
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
