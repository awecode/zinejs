// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';

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
  beginFlip(): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

async function makeZine(startPage = 0): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = container();
  const zine = new Zine(el, { source: new FakeSource(6), renderer: new MockRenderer(), startPage, spreadMode: 'double' });
  await zine.ready;
  return { zine, el };
}

beforeEach(() => {
  // Keep flips from auto-progressing; we only assert synchronous flip starts.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => 0 });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Zine — accessibility (1.7)', () => {
  it('makes the container focusable and labels it', async () => {
    const { el } = await makeZine();
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('aria-roledescription')).toBe('flipbook');
  });

  it('ArrowRight flips forward, ArrowLeft flips back', async () => {
    const { zine, el } = await makeZine(2); // spread 1 (has neighbors both ways)
    const start = vi.fn();
    zine.on('flipStart', start);
    key(el, 'ArrowRight');
    expect(start).toHaveBeenLastCalledWith({ from: 2, to: 4 });
  });

  it('Home and End jump to the first and last pages', async () => {
    const first = await makeZine(4);
    const startA = vi.fn();
    first.zine.on('flipStart', startA);
    key(first.el, 'Home');
    expect(startA).toHaveBeenLastCalledWith({ from: 4, to: 0 });

    const last = await makeZine(0);
    const startB = vi.fn();
    last.zine.on('flipStart', startB);
    key(last.el, 'End');
    expect(startB).toHaveBeenLastCalledWith({ from: 0, to: 4 }); // last spread of 6 pages = {4,5}
  });

  it('announces the current page in an aria-live region', async () => {
    const { el } = await makeZine();
    const live = el.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Page 1 of 6');
  });

  it('reduced motion swaps pages without animating (no rAF needed)', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {} }));
    const { zine } = await makeZine();
    zine.flipNext();
    await flush();
    expect(zine.getPage()).toBe(2); // committed immediately, no frames ticked
  });
});
