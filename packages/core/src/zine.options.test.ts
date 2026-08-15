import { describe, it, expect } from 'vitest';
import { Zine } from './zine';
import { silk } from './geometry/curls';
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
    style: {},
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

  // The accepting cases have to get past validation into #init, so unlike the rejecting ones
  // they need a renderer that will not reach for a real document.
  const accepts = (curl: unknown): Zine =>
    new Zine(fakeContainer(), { source: src(), renderer: new MockRenderer(), curl: curl as any });

  it('accepts a bundled curl by name', () => {
    expect(() => accepts('simple').destroy()).not.toThrow();
  });

  it('accepts an imported curl model, and any custom model of the same shape', () => {
    expect(() => accepts(silk).destroy()).not.toThrow();
    expect(() => accepts({ deform: () => {}, anchored: false }).destroy()).not.toThrow();
  });

  it('tells a caller naming an unbundled curl how to import it', () => {
    // The curl is real, just not bundled — an "invalid value" message would send them hunting
    // for a typo instead of to the import.
    expect(() => new Zine(fakeContainer(), { source: src(), curl: 'silk' as any })).toThrow(
      /not bundled.*@zinejs\/core\/curls/s,
    );
  });

  it('rejects a model that could not be deformed with', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), curl: { anchored: true } as any })).toThrow(
      /deform/,
    );
  });

  it('rejects a curl that is neither bundled nor importable', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), curl: 'origami' as any })).toThrow(
      /curl must be/,
    );
  });

  it('rejects an invalid clickToFlip', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), clickToFlip: 'corner' as any })).toThrow(
      /clickToFlip/,
    );
  });

  it('rejects an invalid spreadMode', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), spreadMode: 'triple' as any })).toThrow(
      /spreadMode/,
    );
  });

  it('rejects a non-positive width', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), width: 0 })).toThrow(/width/);
  });

  it('rejects a negative flipDuration', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), flipDuration: -5 })).toThrow(
      /flipDuration/,
    );
  });

  it('rejects zoom.max below 1', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), zoom: { max: 0.5 } })).toThrow(
      /zoom\.max/,
    );
  });

  it('rejects a zoom.doubleClick with an out-of-range level', () => {
    expect(
      () => new Zine(fakeContainer(), { source: src(), zoom: { doubleClick: [1, 0.5] } }),
    ).toThrow(/doubleClick/);
  });

  it('rejects a non-boolean zoom.doubleClickInFlipZone', () => {
    expect(
      () => new Zine(fakeContainer(), { source: src(), zoom: { doubleClickInFlipZone: 'yes' as any } }),
    ).toThrow(/doubleClickInFlipZone/);
  });

  it('rejects an unknown renderer token', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), renderer: 'webgl' as any })).toThrow(
      /renderer/,
    );
  });

  it('rejects a non-boolean loading', () => {
    expect(() => new Zine(fakeContainer(), { source: src(), loading: 'yes' as any })).toThrow(
      /loading/,
    );
  });

  it('accepts a well-formed options object', () => {
    expect(
      () => new Zine(fakeContainer(), { source: src(), renderer: new MockRenderer() }),
    ).not.toThrow();
  });
});
