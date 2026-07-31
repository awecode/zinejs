// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from './zine';
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
function doubleClick(el: EventTarget, x: number, y: number): void {
  el.dispatchEvent(Object.assign(new Event('dblclick', { bubbles: true, cancelable: true }), { clientX: x, clientY: y }));
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

async function makeZine(startPage = 0, opts: Partial<ZineOptions> = {}): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, { source: new FakeSource(4), renderer: new MockRenderer(), startPage, spreadMode: 'double', ...opts });
  await zine.ready;
  return { zine, el };
}

/** Run an instant (no-delay) click-flip to completion. */
async function settleInstant(): Promise<void> {
  await flush(); // #startFlip already ran synchronously → stage + schedule first frame
  tick(1000);
  await flush();
}

/** Run a delayed click-flip: wait out the window, then finish the animation. */
async function settleDelayed(): Promise<void> {
  await wait(300); // > clickFlipDelay
  await flush();
  tick(1000);
  await flush();
}

describe('Zine — click to flip (edge default: instant, no delay)', () => {
  it('flips forward instantly on a tap near the right edge', async () => {
    const { zine, el } = await makeZine();
    tap(el, 790, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(2);
  });

  it('does nothing tapping the center dead zone', async () => {
    const { zine, el } = await makeZine();
    tap(el, 400, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('does nothing when the tap would go past the ends', async () => {
    const { zine, el } = await makeZine(0);
    tap(el, 10, 300); // left edge at the first spread
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip when clickToFlip is off', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'off' });
    tap(el, 790, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('a double-click on an edge does not zoom (left to click-to-flip)', async () => {
    const { zine, el } = await makeZine();
    doubleClick(el, 790, 300); // inside the right edge zone
    await flush();
    expect(zine.getZoom()).toBe(1);
  });

  it('a double-click in the center still zooms', async () => {
    const { zine, el } = await makeZine();
    doubleClick(el, 400, 300);
    await flush();
    expect(zine.getZoom()).toBe(2);
  });
});

describe('Zine — click to flip (half mode: delayed, double-click zoom on)', () => {
  it('flips from the right half after the delay', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half' });
    tap(el, 500, 300);
    await settleDelayed();
    expect(zine.getPage()).toBe(2);
  });

  it('a double-click zooms and cancels the queued flip', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half' });
    tap(el, 500, 300); // queues a delayed flip
    doubleClick(el, 500, 300); // honored → cancels flip + zooms
    await settleDelayed();
    expect(zine.getPage()).toBe(0);
    expect(zine.getZoom()).toBeGreaterThan(1);
  });
});

describe('Zine — click to flip (config overrides)', () => {
  it('edge + doubleClickInFlipZone: click waits and a double-click cancels + zooms', async () => {
    const { zine, el } = await makeZine(0, { zoom: { doubleClickInFlipZone: true } });
    tap(el, 790, 300); // queues a delayed flip in the edge zone
    doubleClick(el, 790, 300);
    await settleDelayed();
    expect(zine.getPage()).toBe(0); // flip cancelled
    expect(zine.getZoom()).toBeGreaterThan(1);
  });

  it('clickFlipDelay 0 flips instantly and suppresses double-click zoom in flip zones (even half)', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half', clickFlipDelay: 0 });
    tap(el, 500, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(2); // instant, no delay
    doubleClick(el, 500, 300); // whole area is a flip zone → suppressed
    await flush();
    expect(zine.getZoom()).toBe(1);
  });
});
