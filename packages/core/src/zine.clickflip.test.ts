// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent, FlipDirection } from './renderer/types';
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
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(): void {}
  beginFlip(_f: SpreadContent, _t: SpreadContent, _d: FlipDirection): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

let rafCbs: Array<() => void> = [];
let now = 0;
const flush = (): Promise<void> => new Promise((r) => setTimeout(r));
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
function tick(dt: number): void {
  now += dt;
  const cbs = rafCbs;
  rafCbs = [];
  for (const cb of cbs) cb();
}
function tap(el: EventTarget, x: number, y: number): void {
  el.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
  el.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
}

beforeEach(() => {
  rafCbs = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeZine(
  startPage = 0,
  opts: Partial<{ clickToFlip: 'edge' | 'half' | 'off' }> = {},
): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(4),
    renderer: new MockRenderer(),
    startPage,
    ...opts,
  });
  await zine.ready;
  return { zine, el };
}

/** Drive a queued click-flip to completion: wait out the window, then run its animation. */
async function settleClickFlip(): Promise<void> {
  await wait(300); // > DOUBLE_CLICK_MS → the click-flip fires
  await flush(); // #startFlip stages + schedules the first frame
  tick(1000); // finish the animation
  await flush(); // commit
}

describe('Zine — click to flip', () => {
  it('flips forward on a tap near the right edge (edge mode)', async () => {
    const { zine, el } = await makeZine();
    tap(el, 790, 300); // x >= 800 - 64
    await settleClickFlip();
    expect(zine.getPage()).toBe(2);
  });

  it('does nothing tapping the center dead zone in edge mode', async () => {
    const { zine, el } = await makeZine();
    tap(el, 400, 300);
    await settleClickFlip();
    expect(zine.getPage()).toBe(0);
  });

  it('does nothing when the tap would go past the ends', async () => {
    const { zine, el } = await makeZine(0);
    tap(el, 10, 300); // left edge at the first spread → nowhere to go
    await settleClickFlip();
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip when clickToFlip is off', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'off' });
    tap(el, 790, 300);
    await settleClickFlip();
    expect(zine.getPage()).toBe(0);
  });

  it('flips from the right half in half mode', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half' });
    tap(el, 500, 300); // right of center
    await settleClickFlip();
    expect(zine.getPage()).toBe(2);
  });

  it('a double-click cancels the queued click-flip and zooms instead', async () => {
    const { zine, el } = await makeZine();
    tap(el, 790, 300); // queues a click-flip
    el.dispatchEvent(
      Object.assign(new Event('dblclick', { bubbles: true, cancelable: true }), {
        clientX: 790,
        clientY: 300,
      }),
    );
    await settleClickFlip();
    expect(zine.getPage()).toBe(0); // flip was cancelled
    expect(zine.getZoom()).toBeGreaterThan(1); // zoom happened
  });
});
