// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { PageContent, Renderer, LayoutMetrics } from './renderer/types';

class FakeSource implements Source {
  readonly pageCount: number;
  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(): Promise<PageContent> {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    return canvas;
  }
  prefetch(): void {}
  destroy(): void {}
}

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

// A renderer whose mount fails, standing in for a WebGL2 context that can't be created.
function failingRenderer(): Renderer {
  return {
    mount: () => Promise.reject(new Error('no WebGL2 context')),
    destroy: () => {},
    renderSpread: () => {},
    beginFlip: () => {},
    setFlipProgress: () => {},
    setViewTransform: () => {},
    measure: (): LayoutMetrics => ({
      containerWidth: 800,
      containerHeight: 600,
      pageWidth: 400,
      pageHeight: 600,
    }),
  };
}

describe('Zine — renderer fallback', () => {
  it('falls back to the CSS renderer when the chosen renderer cannot mount', async () => {
    const el = container();
    const events: Array<{ from: string; to: string }> = [];
    const zine = new Zine(el, { source: new FakeSource(4), renderer: failingRenderer() });
    zine.on('rendererFallback', (e) => events.push(e));

    await zine.ready;

    expect(events).toEqual([{ from: 'webgl2', to: 'css' }]);
    expect(el.querySelector('.zine-viewport')).not.toBeNull(); // CSS renderer mounted
    expect(zine.getPageCount()).toBe(4);
  });
});
