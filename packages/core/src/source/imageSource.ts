import type { PageContent } from '../renderer/types';
import type { Source } from './types';

export type ImageFit = 'contain' | 'cover';

export interface ImageSourceOptions {
  /** How many adjacent pages to prefetch around a requested page. Default 1. */
  preload?: number;
  /** How each image fits its page; a hint consumed by the render layer. Default 'contain'. */
  fit?: ImageFit;
}

/**
 * Default content source for image books: decodes a list of image URLs to
 * ImageBitmaps, memoizes them, and prefetches neighbors on access.
 */
export class ImageSource implements Source {
  readonly pageCount: number;
  readonly fit: ImageFit;
  #urls: string[];
  #preload: number;
  #cache = new Map<number, Promise<ImageBitmap>>();

  constructor(urls: string[], options: ImageSourceOptions = {}) {
    this.#urls = urls;
    this.pageCount = urls.length;
    this.#preload = options.preload ?? 1;
    this.fit = options.fit ?? 'contain';
  }

  get(index: number): Promise<PageContent> {
    const decoded = this.#decode(index);
    for (let d = 1; d <= this.#preload; d++) {
      this.prefetch([index - d, index + d]);
    }
    return decoded;
  }

  prefetch(indices: number[]): void {
    for (const i of indices) {
      if (i >= 0 && i < this.pageCount) {
        void this.#decode(i).catch(() => {}); // swallow: prefetch failures surface on real get()
      }
    }
  }

  destroy(): void {
    for (const pending of this.#cache.values()) {
      void pending.then((bitmap) => bitmap.close()).catch(() => {});
    }
    this.#cache.clear();
  }

  #decode(index: number): Promise<ImageBitmap> {
    const cached = this.#cache.get(index);
    if (cached) return cached;

    const url = this.#urls[index];
    if (url === undefined) {
      return Promise.reject(
        new RangeError(`ImageSource: page ${index} is out of range (0..${this.pageCount - 1}).`),
      );
    }

    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`ImageSource: failed to fetch page ${index} (${url}) — HTTP ${res.status}.`);
      }
      return createImageBitmap(await res.blob());
    })().catch((err: unknown) => {
      this.#cache.delete(index); // drop the failed entry so a later get() can retry
      throw err;
    });

    this.#cache.set(index, promise);
    return promise;
  }
}
