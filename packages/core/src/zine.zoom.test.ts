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
  readonly views: Array<[number, number, number]> = [];
  readonly begun: FlipDirection[] = [];
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(): void {}
  beginFlip(_from: SpreadContent, _to: SpreadContent, direction: FlipDirection): void {
    this.begun.push(direction);
  }
  setFlipProgress(): void {}
  setViewTransform(scale: number, x: number, y: number): void {
    this.views.push([scale, x, y]);
  }
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
function fire(target: EventTarget, type: string, props: Record<string, number>): void {
  target.dispatchEvent(Object.assign(new Event(type), props));
}

beforeEach(() => {
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeZine(): Promise<{ zine: Zine; renderer: MockRenderer; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const renderer = new MockRenderer();
  const zine = new Zine(el, { source: new FakeSource(4), renderer, zoom: { max: 4 } });
  await zine.ready;
  return { zine, renderer, el };
}

describe('Zine — slice 4a (zoom + pan)', () => {
  it('zooms about the container center by default', async () => {
    const { zine, renderer } = await makeZine();
    const zoomed = vi.fn();
    zine.on('zoomChanged', zoomed);

    zine.setZoom(2); // center (400,300): tx=400-2*400=-400, ty=300-2*300=-300
    expect(zine.getZoom()).toBe(2);
    expect(renderer.views.at(-1)).toEqual([2, -400, -300]);
    expect(zoomed).toHaveBeenCalledWith({ scale: 2 });
  });

  it('clamps scale to [1, zoom.max]', async () => {
    const { zine } = await makeZine();
    zine.setZoom(99);
    expect(zine.getZoom()).toBe(4);
    zine.setZoom(0.1);
    expect(zine.getZoom()).toBe(1);
  });

  it('resetZoom returns to scale 1 with no translation', async () => {
    const { zine, renderer } = await makeZine();
    zine.setZoom(3);
    zine.resetZoom();
    expect(zine.getZoom()).toBe(1);
    expect(renderer.views.at(-1)).toEqual([1, 0, 0]);
  });

  it('ignores zoom when disabled', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, zoom: { enabled: false } });
    await zine.ready;
    zine.setZoom(3);
    expect(zine.getZoom()).toBe(1);
    expect(renderer.views).toEqual([]);
  });

  it('zooms on Ctrl+wheel but ignores a plain wheel', async () => {
    const { zine, el } = await makeZine();
    const wheel = (props: Record<string, unknown>): void => {
      el.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), props));
    };
    wheel({ deltaY: -200, clientX: 400, clientY: 300 }); // no modifier → scroll, not zoom
    expect(zine.getZoom()).toBe(1);
    wheel({ deltaY: -200, ctrlKey: true, clientX: 400, clientY: 300 });
    expect(zine.getZoom()).toBeGreaterThan(1);
  });

  it('does not wheel-zoom when zoom.wheel is false', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      zoom: { wheel: false },
    });
    await zine.ready;
    el.dispatchEvent(
      Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
        deltaY: -200,
        ctrlKey: true,
        clientX: 400,
        clientY: 300,
      }),
    );
    expect(zine.getZoom()).toBe(1);
  });

  it('cycles zoom levels on double-click (1 → 2 → 4 → 1)', async () => {
    const { zine, el } = await makeZine(); // default doubleClick [1, 2, 4]
    const dbl = (): void => {
      el.dispatchEvent(
        Object.assign(new Event('dblclick', { cancelable: true, bubbles: true }), {
          clientX: 400,
          clientY: 300,
        }),
      );
    };
    dbl();
    expect(zine.getZoom()).toBe(2);
    dbl();
    expect(zine.getZoom()).toBe(4);
    dbl();
    expect(zine.getZoom()).toBe(1);
  });

  it('does not double-click zoom when doubleClick is false', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      zoom: { doubleClick: false },
    });
    await zine.ready;
    el.dispatchEvent(
      Object.assign(new Event('dblclick', { cancelable: true, bubbles: true }), {
        clientX: 400,
        clientY: 300,
      }),
    );
    expect(zine.getZoom()).toBe(1);
  });

  it('pans instead of flipping when zoomed in', async () => {
    const { zine, renderer, el } = await makeZine();
    zine.setZoom(2); // tx=-400, ty=-300
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 450, clientY: 320 }); // dx=50, dy=20
    fire(el, 'pointerup', { pointerId: 1, clientX: 450, clientY: 320 });
    await flush();

    // translate = base(-400,-300) + (50,20), clamped to [-800,0]/[-600,0]
    expect(renderer.views.at(-1)).toEqual([2, -350, -280]);
    expect(renderer.begun).toEqual([]); // never started a flip
  });

  it('clamps a pan so content keeps covering the viewport', async () => {
    const { zine, renderer, el } = await makeZine();
    zine.setZoom(2);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 9999, clientY: 9999 }); // huge drag
    fire(el, 'pointerup', { pointerId: 1, clientX: 9999, clientY: 9999 });
    await flush();

    // can't pan past 0 (top-left edge)
    expect(renderer.views.at(-1)).toEqual([2, 0, 0]);
  });

  it('flips (not pans) when at scale 1', async () => {
    const { renderer, el } = await makeZine();
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 }); // right corner
    fire(el, 'pointermove', { pointerId: 1, clientX: 600, clientY: 10 }); // move → promote to a flip
    await flush();
    expect(renderer.begun).toEqual(['forward']);
  });
});
