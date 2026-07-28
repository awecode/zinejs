import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageSource } from './imageSource';

function fakeBitmap(): ImageBitmap {
  return { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap;
}

function okResponse(): Response {
  return { ok: true, status: 200, blob: async () => ({}) } as unknown as Response;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('ImageSource', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => fakeBitmap()));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes pageCount and defaults', () => {
    const src = new ImageSource(['a', 'b', 'c']);
    expect(src.pageCount).toBe(3);
    expect(src.fit).toBe('contain');
  });

  it('honors the fit option', () => {
    expect(new ImageSource(['a'], { fit: 'cover' }).fit).toBe('cover');
  });

  it('decodes a requested page to a bitmap', async () => {
    const src = new ImageSource(['a', 'b', 'c'], { preload: 0 });
    const bitmap = await src.get(0);
    expect(bitmap.width).toBe(10);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('memoizes decodes so a repeat get does not refetch', async () => {
    const src = new ImageSource(['a'], { preload: 0 });
    await src.get(0);
    await src.get(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('prefetches immediate neighbors on access', async () => {
    const src = new ImageSource(['a', 'b', 'c'], { preload: 1 });
    await src.get(1); // decodes 1, prefetches 0 and 2
    await flush();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects an out-of-range page', async () => {
    const src = new ImageSource(['a'], { preload: 0 });
    await expect(src.get(5)).rejects.toBeInstanceOf(RangeError);
  });

  it('rejects on a failed fetch and evicts so a retry can refetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Response)
      .mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const src = new ImageSource(['a'], { preload: 0 });
    await expect(src.get(0)).rejects.toThrow(/HTTP 404/);
    await expect(src.get(0)).resolves.toBeDefined(); // retried, not a cached rejection
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('closes decoded bitmaps on destroy', async () => {
    const bmp = fakeBitmap();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp));
    const src = new ImageSource(['a'], { preload: 0 });
    await src.get(0);
    src.destroy();
    await flush();
    expect(bmp.close).toHaveBeenCalled();
  });
});
