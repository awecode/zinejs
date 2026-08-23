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
  const zine = new Zine(el, { source: new FakeSource(4), renderer, hints: false });
  await zine.ready;
  return { zine, renderer, el };
}

describe('Zine — slice 4b (pinch to zoom)', () => {
  it('zooms as two fingers spread apart', async () => {
    const { zine, el } = await makeZine();
    const zoomed = vi.fn();
    zine.on('zoomChanged', zoomed);

    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointerdown', { pointerId: 2, clientX: 400, clientY: 320 }); // start dist 20
    fire(el, 'pointermove', { pointerId: 2, clientX: 400, clientY: 340 }); // dist 40 → scale 2
    fire(el, 'pointerup', { pointerId: 2, clientX: 400, clientY: 340 });
    fire(el, 'pointerup', { pointerId: 1, clientX: 400, clientY: 300 });

    expect(zine.getZoom()).toBe(2);
    expect(zoomed).toHaveBeenCalledWith({ scale: 2 });
  });

  it('a second finger cancels an in-progress corner flip', async () => {
    const { zine, renderer, el } = await makeZine();
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 }); // corner grab → flip drag
    fire(el, 'pointerdown', { pointerId: 2, clientX: 400, clientY: 300 }); // pinch → cancels flip
    fire(el, 'pointermove', { pointerId: 2, clientX: 200, clientY: 300 }); // spread apart
    await flush();

    expect(zine.getPage()).toBe(0); // flip never landed
    expect(zine.getZoom()).toBeGreaterThan(1); // pinch took over
    // no flip content was ever staged (drag was abandoned before it resolved)
    expect(renderer.begun).toEqual([]);
  });

  it('does not flip on single-finger moves while pinching', async () => {
    const { zine, el } = await makeZine();
    const start = vi.fn();
    zine.on('flipStart', start);

    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointerdown', { pointerId: 2, clientX: 400, clientY: 320 });
    // finger 1 wanders toward a corner mid-pinch — must not start a flip
    fire(el, 'pointermove', { pointerId: 1, clientX: 790, clientY: 10 });
    await flush();

    expect(start).not.toHaveBeenCalled();
  });
});
