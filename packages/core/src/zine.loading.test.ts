// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Zine } from './zine';
import { CSS as LOADING_CSS } from './loading/loading';
import type { LoadProgress, Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer } from './renderer/types';

/** A PDF-like source: page count known only after open(), and it reports download progress. Its
 *  open() is gated so a test can hold the book in its loading state and inspect the overlay. */
class GatedSource implements Source {
  pageCount = 0;
  #resolveOpen!: () => void;
  #rejectOpen!: (error: unknown) => void;
  #gate = new Promise<void>((resolve, reject) => {
    this.#resolveOpen = resolve;
    this.#rejectOpen = reject;
  });
  #progress: ((p: LoadProgress) => void) | null = null;

  async open(): Promise<void> {
    await this.#gate;
    this.pageCount = 4;
  }
  finishOpen(): void {
    this.#resolveOpen();
  }
  failOpen(error: unknown): void {
    this.#rejectOpen(error);
  }
  emitProgress(p: LoadProgress): void {
    this.#progress?.(p);
  }
  onProgress(handler: (p: LoadProgress) => void): void {
    this.#progress = handler;
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

/** Wait for the lazily-imported overlay to appear (or not). The loader chunk is fetched with a
 *  dynamic import() that can settle across several ticks on first load, so poll rather than
 *  assume a single flush is enough. */
async function waitForOverlay(el: HTMLElement): Promise<Element | null> {
  for (let i = 0; i < 20; i++) {
    const found = el.querySelector('.zine-loading');
    if (found) return found;
    await flush();
  }
  return el.querySelector('.zine-loading');
}

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

describe('Zine — built-in loading indicator', () => {
  it('shows the overlay while an async source loads and removes it once ready', async () => {
    const el = container();
    const source = new GatedSource();
    const zine = new Zine(el, { source, renderer: new MockRenderer() });

    expect(await waitForOverlay(el)).not.toBeNull();

    source.finishOpen();
    await zine.ready;
    expect(el.querySelector('.zine-loading')).toBeNull();
  });

  it('re-emits download progress as a public `progress` event', async () => {
    const el = container();
    const source = new GatedSource();
    const zine = new Zine(el, { source, renderer: new MockRenderer() });

    const seen: LoadProgress[] = [];
    zine.on('progress', (p) => seen.push(p));
    source.emitProgress({ loaded: 5, total: 10 });
    expect(seen).toEqual([{ loaded: 5, total: 10 }]);

    source.finishOpen();
    await zine.ready;
  });

  it('mounts no overlay when loading is false, but still emits progress', async () => {
    const el = container();
    const source = new GatedSource();
    const zine = new Zine(el, { source, renderer: new MockRenderer(), loading: false });

    const seen: LoadProgress[] = [];
    zine.on('progress', (p) => seen.push(p));
    source.emitProgress({ loaded: 3, total: 8 });

    for (let i = 0; i < 5; i++) await flush(); // give a would-be loader chunk the chance it never takes
    expect(el.querySelector('.zine-loading')).toBeNull();
    expect(seen).toEqual([{ loaded: 3, total: 8 }]);

    source.finishOpen();
    await zine.ready;
  });

  it('tears the overlay down when open() rejects, then rejects ready', async () => {
    const el = container();
    const source = new GatedSource();
    const zine = new Zine(el, { source, renderer: new MockRenderer() });

    expect(await waitForOverlay(el)).not.toBeNull(); // overlay mounts

    source.failOpen(new Error('bad url'));
    await expect(zine.ready).rejects.toThrow(/bad url/);
    expect(el.querySelector('.zine-loading')).toBeNull();
  });

  // Regression guard for a container sized by width alone: during download the book is not yet
  // measured, so the container has no aspect-ratio (and thus no height). Without a floor the
  // absolutely-positioned overlay collapses to a strip and the spinner overflows. happy-dom does
  // not lay out, so assert the rule the fix relies on rather than a rendered height.
  it('floors the overlay height so a not-yet-measured container cannot crush it', () => {
    expect(LOADING_CSS).toMatch(/\.zine-loading\s*\{[^}]*min-height:/);
  });
});
