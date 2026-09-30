// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';

const detect = vi.fn((_l: PageContent, _r: PageContent) => 0.03);
vi.mock('./engine/gutter', () => ({ detectOverlap: (l: PageContent, r: PageContent) => detect(l, r) }));

class FakeSource implements Source {
  readonly pageCount = 6;
  async get(): Promise<PageContent> {
    return { width: 800, height: 1200 } as unknown as PageContent;
  }
  prefetch(): void {}
  destroy(): void {}
}

class MockRenderer implements Renderer {
  last: SpreadContent | null = null;
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(_spread: unknown, content: SpreadContent): void {
    this.last = content;
  }
  beginFlip(): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const books: Zine[] = [];
async function open(opts: Partial<ZineOptions>): Promise<{ zine: Zine; renderer: MockRenderer }> {
  const renderer = new MockRenderer();
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(),
    renderer,
    controls: false,
    hints: false,
    flipDuration: 0,
    ...opts,
  });
  books.push(zine);
  await zine.ready;
  return { zine, renderer };
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  detect.mockReset().mockImplementation(() => 0.03);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  for (const z of books.splice(0)) z.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('gutterOverlap', () => {
  it('is off by default: content carries no trim', async () => {
    const { renderer } = await open({ spreadMode: 'double' });
    expect(renderer.last?.spineTrim).toBeUndefined();
  });

  it('a number trims half the overlap from each page of a two-page spread', async () => {
    const { renderer } = await open({ spreadMode: 'double', gutterOverlap: 0.04 });
    expect(renderer.last?.spineTrim).toBeCloseTo(0.02);
  });

  it('never trims a lone page (the cover), only the paired spreads after it', async () => {
    const cover = await open({ spreadMode: 'cover', gutterOverlap: 0.04 });
    expect(cover.renderer.last?.right).not.toBeNull();
    expect(cover.renderer.last?.left).toBeNull();
    expect(cover.renderer.last?.spineTrim).toBeUndefined();

    const inside = await open({ spreadMode: 'cover', gutterOverlap: 0.04, startPage: 1 });
    expect(inside.renderer.last?.spineTrim).toBeCloseTo(0.02);
  });

  it('never trims in single-page mode, where no page has a facing page', async () => {
    const { renderer } = await open({ spreadMode: 'single', gutterOverlap: 0.04 });
    expect(renderer.last?.spineTrim).toBeUndefined();
  });

  it("'auto' trims by what the detector finds, half per side", async () => {
    const { renderer } = await open({ spreadMode: 'double', gutterOverlap: 'auto' });
    expect(detect).toHaveBeenCalledTimes(1);
    expect(renderer.last?.spineTrim).toBeCloseTo(0.015);
  });

  it("'auto' leaves a spread untrimmed when nothing is found", async () => {
    detect.mockReturnValueOnce(0);
    const { renderer } = await open({ spreadMode: 'double', gutterOverlap: 'auto' });
    expect(renderer.last?.spineTrim).toBeUndefined();
  });

  it("'auto' measures each page pair once, not on every revisit", async () => {
    const { zine, renderer } = await open({ spreadMode: 'double', gutterOverlap: 'auto' });
    zine.flipNext();
    await settle();
    zine.flipPrev();
    await settle();
    expect(detect).toHaveBeenCalledTimes(2); // pages 0-1, then 2-3; back to 0-1 reuses the first
    expect(renderer.last?.spineTrim).toBeCloseTo(0.015);
  });

  it("'auto' survives a progressive source sharpening one page before the other", async () => {
    // Like a progressive PDF: every page arrives low-res, then upgrades to crisp one at a time.
    const sharp = new Set<number>();
    let notify: (index: number) => void = () => {};
    const source: Source = {
      pageCount: 6,
      get: async (i) => (sharp.has(i) ? { width: 800, height: 1200 } : { width: 400, height: 600 }) as unknown as PageContent,
      prefetch() {},
      destroy() {},
      onPageUpdate: (handler) => (notify = handler),
    };
    // The real detector declines to compare rasters of different sizes.
    detect.mockImplementation((l, r) => (l.width === r.width ? 0.03 : 0));
    const { renderer } = await open({ spreadMode: 'double', gutterOverlap: 'auto', source });
    expect(renderer.last?.spineTrim).toBeCloseTo(0.015); // measured on the low-res pair

    sharp.add(0);
    notify(0); // left is crisp, right still low-res: not comparable
    await settle();
    expect(renderer.last?.spineTrim).toBeCloseTo(0.015); // keeps the last measurement, no flicker

    sharp.add(1);
    notify(1); // both crisp: now measured properly
    await settle();
    expect(renderer.last?.spineTrim).toBeCloseTo(0.015);
    expect(detect).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 800 }),
      expect.objectContaining({ width: 800 }),
    );
  });

  it('rejects values that are not a sensible overlap', () => {
    const el = document.createElement('div');
    for (const bad of ['yes', -0.1, 0.6, Number.NaN]) {
      expect(
        () => new Zine(el, { source: new FakeSource(), renderer: new MockRenderer(), gutterOverlap: bad as never }),
      ).toThrow(/gutterOverlap must be 'auto' or a number from 0 to 0.5/);
    }
  });
});
