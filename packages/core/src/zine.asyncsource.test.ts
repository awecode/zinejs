import { describe, it, expect } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';
import type { Spread } from './engine/spread';

/** A source whose page count is only known after an async open() (like a PDF). */
class FakeAsyncSource implements Source {
  pageCount = 0;
  opened = false;
  constructor(private readonly count: number) {}
  async open(): Promise<void> {
    await Promise.resolve();
    this.pageCount = this.count;
    this.opened = true;
  }
  async get(): Promise<PageContent> {
    return { width: 1, height: 1 } as unknown as PageContent;
  }
  prefetch(): void {}
  destroy(): void {}
}

class MockRenderer implements Renderer {
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
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const el = Object.assign(new EventTarget(), { appendChild() {} }) as unknown as HTMLElement;

describe('Zine — async source (open)', () => {
  it('opens the source before building spreads, then exposes its page count', async () => {
    const source = new FakeAsyncSource(6);
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source, renderer, spreadMode: 'double' });
    expect(source.opened).toBe(false); // open() runs during init, not construction
    await zine.ready;
    expect(source.opened).toBe(true);
    expect(zine.getPageCount()).toBe(6);
    expect(renderer.rendered.at(-1)).toEqual({ left: 0, right: 1 });
  });

  it('validates startPage against the post-open page count via ready', async () => {
    const source = new FakeAsyncSource(4);
    const zine = new Zine(el, { source, renderer: new MockRenderer(), startPage: 9 });
    await expect(zine.ready).rejects.toThrow(/out of range/);
  });
});
