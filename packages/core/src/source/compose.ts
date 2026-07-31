import type { PageContent } from '../renderer/types';
import type { Source } from './types';

export interface CompositionOptions {
  /** Image URL prepended as a lone front cover (adds a page). */
  frontCover?: string | null;
  /** Image URL appended as a lone back cover (adds a page). */
  backCover?: string | null;
  /** Replace source pages with image URLs, keyed by 0-based source index (negative = from the end). */
  pages?: Record<number, string> | null;
}

/**
 * Wrap `base` so image covers/replacements sit alongside it, or return `base`
 * unchanged when nothing is requested. Covers ADD pages (front prepended, back
 * appended); `pages` REPLACE existing source pages. `pages` indexes the base's own
 * pages, so it is unaffected by an added cover.
 */
export function composeSource(base: Source, options: CompositionOptions): Source {
  const hasFront = typeof options.frontCover === 'string';
  const hasBack = typeof options.backCover === 'string';
  const hasPages = options.pages != null && Object.keys(options.pages).length > 0;
  if (!hasFront && !hasBack && !hasPages) return base;
  return new CompositeSource(base, options);
}

function loadImage(url: string): Promise<ImageBitmap> {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`zine: could not load image "${url}" (HTTP ${res.status}).`);
      return res.blob();
    })
    .then((blob) => createImageBitmap(blob));
}

class CompositeSource implements Source {
  #base: Source;
  #front: string | null;
  #back: string | null;
  #rawPages: Record<number, string>;
  #resolved = new Map<number, string>(); // base-index → url (negatives resolved)
  #cache = new Map<string, Promise<ImageBitmap>>();
  open?: () => Promise<void>;
  onPageUpdate?: (handler: (index: number) => void) => void;

  constructor(base: Source, options: CompositionOptions) {
    this.#base = base;
    this.#front = typeof options.frontCover === 'string' ? options.frontCover : null;
    this.#back = typeof options.backCover === 'string' ? options.backCover : null;
    this.#rawPages = options.pages ?? {};

    if (typeof base.open === 'function') {
      // Async base: page count (and negative indices) known only after open().
      this.open = async (): Promise<void> => {
        await base.open!();
        this.#resolvePages();
      };
    } else {
      this.#resolvePages(); // sync base: count is known now
    }

    if (typeof base.onPageUpdate === 'function') {
      // Forward base page updates, shifting to book indices (past the front cover).
      this.onPageUpdate = (handler) => {
        base.onPageUpdate!((src) => handler(src + (this.#front !== null ? 1 : 0)));
      };
    }
  }

  get pageCount(): number {
    return this.#base.pageCount + (this.#front !== null ? 1 : 0) + (this.#back !== null ? 1 : 0);
  }

  get(index: number): Promise<PageContent> {
    const frontOffset = this.#front !== null ? 1 : 0;
    if (this.#front !== null && index === 0) return this.#image(this.#front);
    if (this.#back !== null && index === this.pageCount - 1) return this.#image(this.#back);
    const src = index - frontOffset;
    const override = this.#resolved.get(src);
    return override !== undefined ? this.#image(override) : this.#base.get(src);
  }

  prefetch(indices: number[]): void {
    const frontOffset = this.#front !== null ? 1 : 0;
    const baseIndices: number[] = [];
    for (const index of indices) {
      if (this.#front !== null && index === 0) {
        void this.#image(this.#front).catch(() => {});
      } else if (this.#back !== null && index === this.pageCount - 1) {
        void this.#image(this.#back).catch(() => {});
      } else {
        const src = index - frontOffset;
        const override = this.#resolved.get(src);
        if (override !== undefined) void this.#image(override).catch(() => {});
        else baseIndices.push(src);
      }
    }
    this.#base.prefetch(baseIndices);
  }

  destroy(): void {
    this.#base.destroy();
    for (const promise of this.#cache.values()) {
      void promise.then((bmp) => bmp.close()).catch(() => {});
    }
    this.#cache.clear();
  }

  #resolvePages(): void {
    const n = this.#base.pageCount;
    this.#resolved.clear();
    for (const [key, url] of Object.entries(this.#rawPages)) {
      const raw = Number(key);
      const src = raw < 0 ? n + raw : raw;
      if (Number.isInteger(src) && src >= 0 && src < n) this.#resolved.set(src, url);
    }
  }

  #image(url: string): Promise<ImageBitmap> {
    let promise = this.#cache.get(url);
    if (promise === undefined) {
      promise = loadImage(url).catch((error: unknown) => {
        this.#cache.delete(url); // let a later get() retry
        throw error;
      });
      this.#cache.set(url, promise);
    }
    return promise;
  }
}
