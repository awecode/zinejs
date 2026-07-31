import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';
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
  width = 800;
  readonly rendered: Spread[] = [];
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(spread: Spread, _content: SpreadContent): void {
    this.rendered.push(spread);
  }
  beginFlip(): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: this.width, containerHeight: 600, pageWidth: this.width / 2, pageHeight: 600 };
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
let roCallbacks: Array<() => void> = [];
let rafCbs: Array<() => void> = [];

class FakeResizeObserver {
  constructor(cb: () => void) {
    roCallbacks.push(cb);
  }
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  roCallbacks = [];
  rafCbs = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => 0 });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const el = Object.assign(new EventTarget(), { appendChild() {} }) as unknown as HTMLElement;

describe('Zine — slice 5 (resize + single-page mode)', () => {
  it('opens in single-page mode when the container is narrow', async () => {
    const source = new FakeSource(4);
    const renderer = new MockRenderer();
    renderer.width = 500; // below default threshold 600
    const zine = new Zine(el, { source, renderer });
    await zine.ready;

    expect(renderer.rendered.at(-1)).toEqual({ left: null, right: 0 }); // one page per spread
    zine.flipNext();
    await flush();
    // duration=500, drive the flip to completion
    for (const cb of rafCbs.splice(0)) cb();
    for (const cb of rafCbs.splice(0)) cb();
    await flush();
    expect(zine.getPage()).toBe(1); // advanced one page, not two
  });

  it('update() switches from double to single page, keeping the current page', async () => {
    const renderer = new MockRenderer(); // starts wide (800) → double
    const zine = new Zine(el, { source: new FakeSource(4), renderer, spreadMode: 'double' });
    await zine.ready;
    expect(renderer.rendered.at(-1)).toEqual({ left: 0, right: 1 });

    renderer.width = 400; // now narrow
    zine.update();
    await flush();
    expect(renderer.rendered.at(-1)).toEqual({ left: null, right: 0 });
  });

  it('a ResizeObserver notification triggers an rAF-throttled update', async () => {
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, spreadMode: 'double' });
    await zine.ready;
    expect(roCallbacks.length).toBe(1);

    renderer.width = 400;
    roCallbacks[0]?.(); // simulate a resize
    roCallbacks[0]?.(); // coalesced — still one scheduled update
    for (const cb of rafCbs.splice(0)) cb();
    await flush();

    expect(renderer.rendered.at(-1)).toEqual({ left: null, right: 0 });
  });

  it('does not re-render on resize while a flip is animating', async () => {
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, spreadMode: 'double' });
    await zine.ready;
    const rerenders = renderer.rendered.length;

    zine.flipNext(); // → animating
    await flush();
    renderer.width = 400;
    zine.update(); // ignored: not idle
    expect(renderer.rendered.length).toBe(rerenders); // no extra static render
  });
});
