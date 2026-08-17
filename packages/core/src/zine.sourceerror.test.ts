import { describe, it, expect, vi } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';
import type { Spread } from './engine/spread';

/** Source whose decode rejects for one specific page index. */
class FailingSource implements Source {
  readonly pageCount: number;
  constructor(pageCount: number, private readonly failIndex: number) {
    this.pageCount = pageCount;
  }
  async get(index: number): Promise<PageContent> {
    if (index === this.failIndex) throw new Error(`boom ${index}`);
    return { width: 1, height: 1 } as unknown as PageContent;
  }
  prefetch(): void {}
  destroy(): void {}
}

class MockRenderer implements Renderer {
  lastContent: SpreadContent | null = null;
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(_spread: Spread, content: SpreadContent): void {
    this.lastContent = content;
  }
  beginFlip(): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const el = Object.assign(new EventTarget(), { appendChild() {}, style: {} }) as unknown as HTMLElement;

describe('Zine — source errors', () => {
  it('emits sourceError with the page index and renders that page blank', async () => {
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source: new FailingSource(4, 1), renderer, spreadMode: 'double' }); // spread 0 = pages 0,1
    const errors: Array<{ index: number; error: unknown }> = [];
    zine.on('sourceError', (e) => errors.push(e));

    await expect(zine.ready).resolves.toBeUndefined(); // mounts gracefully, does not reject

    expect(errors).toHaveLength(1);
    expect(errors[0]?.index).toBe(1);
    expect(renderer.lastContent).toEqual({ left: expect.anything(), right: null }); // page 1 blank
  });

  it('does not emit sourceError when every page decodes', async () => {
    const onError = vi.fn();
    const zine = new Zine(el, { source: new FailingSource(4, 99), renderer: new MockRenderer() });
    zine.on('sourceError', onError);
    await zine.ready;
    expect(onError).not.toHaveBeenCalled();
  });
});
