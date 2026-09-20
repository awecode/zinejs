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

const el = Object.assign(new EventTarget(), { appendChild() {}, style: {} }) as unknown as HTMLElement;

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

describe('Zine — container aspect-ratio convergence', () => {
  /** A renderer whose reported book box aspect jitters by a sub-pixel between measurements, the way a
   *  real container does after `aspect-ratio` is written to it (rounding shifts the measured box). */
  class JitterRenderer extends MockRenderer {
    aspect = 1.3289; // book width / height; tests flip it by a sub-pixel amount
    override measure(): LayoutMetrics {
      const book = { x: 0, y: 0, width: this.aspect, height: 1 };
      return {
        containerWidth: 800, // wide → stays double, so mode never toggles
        containerHeight: 600,
        pageWidth: 400,
        pageHeight: 600,
        book,
        content: book,
      };
    }
  }

  /** A container whose `style.aspectRatio` writes are recorded, so a rewrite storm is observable. */
  function spyContainer(): { el: HTMLElement; writes: string[] } {
    const writes: string[] = [];
    const style = {} as { aspectRatio?: string; _v?: string };
    Object.defineProperty(style, 'aspectRatio', {
      configurable: true,
      get() {
        return this._v;
      },
      set(v: string) {
        this._v = v;
        writes.push(v);
      },
    });
    const el = Object.assign(new EventTarget(), { appendChild() {}, style }) as unknown as HTMLElement;
    return { el, writes };
  }

  it('stops rewriting aspect-ratio when the measured book box only jitters sub-pixel', async () => {
    // Regression: `#applyContainerAspect` compared the ratio for exact equality and rewrote
    // `style.aspectRatio` on any change. Writing it resizes the container, whose ResizeObserver
    // re-measures a box off by a sub-pixel and rewrites again — an endless resize→measure→write loop
    // that re-rasterizes a PDF each turn and freezes the tab. A tolerance must let it settle.
    const { el, writes } = spyContainer();
    const renderer = new JitterRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, spreadMode: 'double', hints: false });
    await zine.ready;

    const afterReady = writes.length; // however many writes the initial render made
    // Jitter the measured aspect by ~0.001 (a sub-pixel on a real box) across many update cycles,
    // exactly what the resize→measure feedback would feed in.
    const jitter = [1.3289, 1.3276];
    for (let i = 0; i < 8; i++) {
      renderer.aspect = jitter[i % 2]!;
      zine.update();
      await flush();
    }

    // With the tolerance the sub-pixel jitter is ignored, so it never rewrites (the old exact
    // comparison rewrote on every cycle, the loop). At most one settling write is acceptable.
    expect(writes.length - afterReady).toBeLessThanOrEqual(1);
  });

  it('sizes the container from the stable containerAspect, not the per-spread book box', async () => {
    // A document with off-size pages: the painted book aspect changes per spread, but the renderer
    // reports a fixed containerAspect (from the first page). The container must follow that stable
    // value so navigating across a page-size boundary does not resize it (the reported layout shift).
    class MixedRenderer extends JitterRenderer {
      override measure(): LayoutMetrics {
        return { ...super.measure(), containerAspect: 1.3274 };
      }
    }
    const { el, writes } = spyContainer();
    const renderer = new MixedRenderer();
    const zine = new Zine(el, { source: new FakeSource(6), renderer, spreadMode: 'double', hints: false });
    await zine.ready;
    const afterReady = writes.length;

    // Navigate across page-size boundaries: the painted book aspect swings, containerAspect holds.
    for (const a of [1.3289, 1.31, 1.345, 1.31]) {
      renderer.aspect = a;
      zine.update();
      await flush();
    }

    expect(writes.length - afterReady).toBe(0); // container never re-sized
    expect(writes.every((w) => w === '1.3274')).toBe(true); // it used the stable containerAspect
  });
});

describe('Zine — responsiveSpread', () => {
  const narrow = async (options: Record<string, unknown> = {}) => {
    const renderer = new MockRenderer();
    renderer.width = 500; // below the default 640 threshold
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer,
      spreadMode: 'double',
      ...options,
    });
    await zine.ready;
    return { zine, renderer };
  };

  it('holds the configured mode on a narrow container when turned off', async () => {
    const { zine, renderer } = await narrow({ responsiveSpread: false });
    expect(zine.isResponsiveSingle()).toBe(false);
    expect(renderer.rendered.at(-1)).toEqual({ left: 0, right: 1 }); // still two pages
  });

  it('collapses to one page by default', async () => {
    const { zine, renderer } = await narrow();
    expect(zine.isResponsiveSingle()).toBe(true);
    expect(renderer.rendered.at(-1)).toEqual({ left: null, right: 0 });
  });

  it('restores the configured mode when switched off at runtime', async () => {
    const { zine, renderer } = await narrow();
    expect(zine.isResponsiveSingle()).toBe(true);

    zine.setResponsiveSpread(false);
    await flush();
    expect(zine.getResponsiveSpread()).toBe(false);
    expect(zine.isResponsiveSingle()).toBe(false);
    expect(renderer.rendered.at(-1)).toEqual({ left: 0, right: 1 });
  });

  it('collapses again when switched back on', async () => {
    const { zine, renderer } = await narrow({ responsiveSpread: false });
    zine.setResponsiveSpread(true);
    await flush();
    expect(zine.isResponsiveSingle()).toBe(true);
    expect(renderer.rendered.at(-1)).toEqual({ left: null, right: 0 });
  });

  it('keeps the reader on the same page across the switch', async () => {
    // A page's spread index moves when the grouping changes; the page itself must not.
    const renderer = new MockRenderer();
    renderer.width = 500;
    const zine = new Zine(el, {
      source: new FakeSource(8),
      renderer,
      spreadMode: 'double',
      startPage: 5,
    });
    await zine.ready;
    expect(zine.getPage()).toBe(5);
    zine.setResponsiveSpread(false);
    await flush();
    expect(zine.getPage()).toBe(5);
  });

  it('leaves a wide book alone either way', async () => {
    const renderer = new MockRenderer(); // 800, comfortably above the threshold
    const zine = new Zine(el, { source: new FakeSource(4), renderer, spreadMode: 'double' });
    await zine.ready;
    const before = renderer.rendered.length;
    zine.setResponsiveSpread(false);
    expect(zine.isResponsiveSingle()).toBe(false);
    expect(renderer.rendered.length).toBe(before); // nothing was being overridden
  });
});
