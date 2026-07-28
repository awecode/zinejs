import { describe, it, expect } from 'vitest';
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
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(_spread: Spread, _content: SpreadContent): void {}
  beginFlip(): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

function fakeContainer(): HTMLElement {
  return Object.assign(new EventTarget(), {
    appendChild() {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  }) as unknown as HTMLElement;
}

const src = (n = 4): FakeSource => new FakeSource(n);

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Zine option validation', () => {
  it('rejects a non-element container', () => {
    expect(() => new Zine(null as any, { source: src() })).toThrow(/container/);
  });

  it('rejects a missing source', () => {
    expect(() => new Zine(fakeContainer(), {} as any)).toThrow(/source/);
  });

  it('rejects a source with no pages', () => {
    expect(() => new Zine(fakeContainer(), { source: src(0) })).toThrow(/at least 1 page/);
  });

  it('rejects an out-of-range startPage with the valid range', () => {
    expect(() => new Zine(fakeContainer(), { source: src(4), startPage: 9 })).toThrow(
      /startPage 9 is out of range .*0\.\.3/,
    );
  });

  it('rejects an invalid direction', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), direction: 'up' as any })).toThrow(
      /direction/,
    );
  });

  it('rejects a negative flipDuration', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), flipDuration: -5 })).toThrow(
      /flipDuration/,
    );
  });

  it('rejects maxZoom below 1', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), maxZoom: 0.5 })).toThrow(/maxZoom/);
  });

  it('rejects an unknown renderer token', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), renderer: 'webgl' as any })).toThrow(
      /renderer/,
    );
  });

  it('accepts a well-formed options object', () => {
    expect(
      () => new Zine(fakeContainer(), { source: src(), renderer: new MockRenderer() }),
    ).not.toThrow();
  });
});
