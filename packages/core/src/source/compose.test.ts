import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { composeSource } from './compose';
import type { Source } from './types';
import type { PageContent } from '../renderer/types';

// Stubs: fetch → a blob carrying its url; createImageBitmap → a marker { img: url }.
beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, blob: async () => ({ url }) }));
  vi.stubGlobal('createImageBitmap', async (blob: { url: string }) => ({ img: blob.url }));
});
afterEach(() => vi.unstubAllGlobals());

class FakeBase implements Source {
  pageCount: number;
  readonly getCalls: number[] = [];
  readonly prefetched: number[] = [];
  destroyed = false;
  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(index: number): Promise<PageContent> {
    this.getCalls.push(index);
    return { page: index } as unknown as PageContent;
  }
  prefetch(indices: number[]): void {
    this.prefetched.push(...indices);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

const img = (url: string): unknown => ({ img: url });
const page = (i: number): unknown => ({ page: i });

describe('composeSource', () => {
  it('returns the base unchanged when nothing is composed', () => {
    const base = new FakeBase(4);
    expect(composeSource(base, {})).toBe(base);
    expect(composeSource(base, { pages: {} })).toBe(base);
    expect(composeSource(base, { frontCover: undefined })).toBe(base);
  });

  it('prepends a front cover as an added lone page', async () => {
    const base = new FakeBase(4);
    const s = composeSource(base, { frontCover: 'front.jpg' });
    expect(s.pageCount).toBe(5);
    expect(await s.get(0)).toEqual(img('front.jpg'));
    expect(await s.get(1)).toEqual(page(0)); // base page 0 shifts to book index 1
    expect(base.getCalls).toEqual([0]);
  });

  it('appends a back cover as an added lone page', async () => {
    const base = new FakeBase(4);
    const s = composeSource(base, { backCover: 'back.jpg' });
    expect(s.pageCount).toBe(5);
    expect(await s.get(4)).toEqual(img('back.jpg'));
    expect(await s.get(3)).toEqual(page(3));
  });

  it('replaces source pages via `pages` (indexes the base, not the composed book)', async () => {
    const base = new FakeBase(4);
    const s = composeSource(base, { frontCover: 'front.jpg', pages: { 0: 'ad.jpg' } });
    expect(await s.get(0)).toEqual(img('front.jpg')); // the added cover
    expect(await s.get(1)).toEqual(img('ad.jpg')); // book index 1 = base page 0, replaced
    expect(base.getCalls).toEqual([]); // base page 0 never fetched
  });

  it('resolves negative page indices from the end', async () => {
    const base = new FakeBase(4);
    const s = composeSource(base, { pages: { '-1': 'last.jpg' } });
    expect(await s.get(3)).toEqual(img('last.jpg'));
    expect(await s.get(0)).toEqual(page(0));
  });

  it('memoizes an image and forwards non-overridden prefetches to the base', async () => {
    const base = new FakeBase(6);
    const s = composeSource(base, { frontCover: 'front.jpg', pages: { 2: 'x.jpg' } });
    s.prefetch([0, 1, 3]); // 0 = cover, 1 = base 0, 3 = base 2 (overridden)
    expect(base.prefetched).toEqual([0]); // only base page 0 forwarded (book 1)
    expect(await s.get(0)).toBe(await s.get(0)); // same cached promise
  });

  it('destroys the base', () => {
    const base = new FakeBase(4);
    composeSource(base, { frontCover: 'f.jpg' }).destroy();
    expect(base.destroyed).toBe(true);
  });

  it('waits for an async base before resolving page count and negatives', async () => {
    class AsyncBase extends FakeBase {
      opened = false;
      constructor() {
        super(0);
      }
      open(): Promise<void> {
        this.opened = true;
        this.pageCount = 4;
        return Promise.resolve();
      }
    }
    const base = new AsyncBase();
    const s = composeSource(base, { backCover: 'back.jpg', pages: { '-1': 'last.jpg' } });
    expect(typeof s.open).toBe('function');
    await s.open!();
    expect(base.opened).toBe(true);
    expect(s.pageCount).toBe(5); // 4 base + back cover
    expect(await s.get(4)).toEqual(img('back.jpg')); // back cover
    expect(await s.get(3)).toEqual(img('last.jpg')); // base page 3 replaced (negative index)
  });
});

describe('composeSource — onProgress', () => {
  class ProgressBase extends FakeBase {
    handler: ((p: { loaded: number; total: number }) => void) | null = null;
    onProgress(handler: (p: { loaded: number; total: number }) => void): void {
      this.handler = handler;
    }
  }

  it('is absent when the base does not report progress', () => {
    const s = composeSource(new FakeBase(4), { frontCover: 'front.jpg' });
    expect(s.onProgress).toBeUndefined();
  });

  it('forwards download progress straight through from the base', () => {
    const base = new ProgressBase(4);
    const s = composeSource(base, { frontCover: 'front.jpg' });
    const seen: Array<{ loaded: number; total: number }> = [];
    s.onProgress!((p) => seen.push(p));
    base.handler!({ loaded: 5, total: 10 }); // covers do not shift a document-level signal
    expect(seen).toEqual([{ loaded: 5, total: 10 }]);
  });
});

describe('composeSource — getText', () => {
  class TextBase extends FakeBase {
    readonly textCalls: number[] = [];
    async getText(index: number): Promise<string> {
      this.textCalls.push(index);
      return `text ${index}`;
    }
  }

  it('is absent when the base has no text', () => {
    const s = composeSource(new FakeBase(4), { frontCover: 'front.jpg' });
    expect(s.getText).toBeUndefined();
  });

  it('shifts book indices back to base indices past the front cover', async () => {
    const base = new TextBase(4);
    const s = composeSource(base, { frontCover: 'front.jpg' });
    expect(await s.getText!(1)).toBe('text 0'); // book page 1 is base page 0
    expect(base.textCalls).toEqual([0]);
  });

  it('returns nothing for covers and replaced pages, which are images', async () => {
    const base = new TextBase(4);
    const s = composeSource(base, {
      frontCover: 'front.jpg',
      backCover: 'back.jpg',
      pages: { 1: 'ad.jpg' },
    });
    expect(await s.getText!(0)).toBe(''); // front cover
    expect(await s.getText!(s.pageCount - 1)).toBe(''); // back cover
    expect(await s.getText!(2)).toBe(''); // base page 1, replaced by an image
    expect(base.textCalls).toEqual([]); // the base was never consulted
  });
});
