import { buildSpreads, type Direction, type Spread } from './engine/spread';
import { Virtualizer } from './engine/virtualizer';
import { Emitter, type ZineEventMap } from './engine/emitter';
import { FlipMachine } from './engine/stateMachine';
import { selectRenderer, type RendererOption } from './renderer/select';
import type { FlipDirection, Renderer, SpreadContent } from './renderer/types';
import type { Source } from './source/types';

export interface ZineOptions {
  /** Content source (e.g. an ImageSource). Required. */
  source: Source;
  /** Renderer selection; default 'auto'. */
  renderer?: RendererOption;
  /** Reading direction; default 'ltr'. */
  direction?: Direction;
  /** First page is a lone cover; default false. */
  cover?: boolean;
  /** Page to open on; default 0. */
  startPage?: number;
  /** Flip animation duration in ms; default 500. */
  flipDuration?: number;
}

/**
 * The public flipbook. Composes the engine (spreads, virtualizer, events), a
 * lazily-selected renderer, and a content source. Construction is synchronous
 * but setup is async — await `ready` (or listen for the `ready` event) before
 * driving it.
 */
export class Zine {
  #container: HTMLElement;
  #source: Source;
  #emitter = new Emitter<ZineEventMap>();
  #virtualizer = new Virtualizer(2);
  #machine = new FlipMachine();
  #spreads: Spread[];
  #current = 0;
  #currentPage: number;
  #currentContent: SpreadContent = { left: null, right: null };
  #flipDuration: number;
  #renderer: Renderer | null = null;
  #raf: number | null = null;
  #ready: Promise<void>;

  /** Stable seek API: drive the fold to a fixed progress without animating (visual regression). */
  readonly debug = {
    setFlipProgress: (t: number, direction: FlipDirection): void => {
      this.#renderer?.setFlipProgress(t, direction);
    },
  };

  constructor(container: HTMLElement, options: ZineOptions) {
    this.#container = container;
    this.#source = options.source;
    const direction = options.direction ?? 'ltr';
    const cover = options.cover ?? false;
    this.#spreads = buildSpreads(this.#source.pageCount, { direction, cover });
    this.#currentPage = clamp(options.startPage ?? 0, 0, Math.max(0, this.#source.pageCount - 1));
    this.#current = this.#spreadIndexForPage(this.#currentPage);
    this.#flipDuration = options.flipDuration ?? 500;
    this.#ready = this.#init(options.renderer ?? 'auto');
  }

  /** Resolves once the renderer is mounted and the first spread is painted. */
  get ready(): Promise<void> {
    return this.#ready;
  }

  getPageCount(): number {
    return this.#source.pageCount;
  }

  getPage(): number {
    return this.#currentPage;
  }

  flipNext(): void {
    this.#startFlip(this.#current + 1);
  }

  flipPrev(): void {
    this.#startFlip(this.#current - 1);
  }

  flipTo(page: number): void {
    const target = clamp(page, 0, Math.max(0, this.#source.pageCount - 1));
    this.#startFlip(this.#spreadIndexForPage(target));
  }

  on<K extends keyof ZineEventMap>(
    event: K,
    listener: (payload: ZineEventMap[K]) => void,
  ): () => void {
    return this.#emitter.on(event, listener);
  }

  destroy(): void {
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#renderer?.destroy();
    this.#source.destroy();
    this.#emitter.clear();
  }

  #startFlip(targetIndex: number): void {
    if (targetIndex < 0 || targetIndex >= this.#spreads.length || targetIndex === this.#current) {
      return;
    }
    // `flip` is legal only from idle; otherwise a flip/drag is already in flight.
    if (this.#machine.send('flip') === null) return;

    const direction: FlipDirection = targetIndex > this.#current ? 'forward' : 'backward';
    const toPage = this.#leadPage(targetIndex);
    // State is already locked (send('flip') above), so re-entrant flips are rejected
    // even though staging the destination content below is async.
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: toPage });
    void this.#runFlip(targetIndex, direction, toPage);
  }

  async #runFlip(targetIndex: number, direction: FlipDirection, toPage: number): Promise<void> {
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction);
    this.#animate(targetIndex, direction, toPage, toContent);
  }

  #animate(
    targetIndex: number,
    direction: FlipDirection,
    toPage: number,
    toContent: SpreadContent,
  ): void {
    const duration = this.#flipDuration;
    const start = performance.now();
    const step = (now: number): void => {
      // Easing lives here; flipProgressToPose stays linear so seeks are deterministic.
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      this.#renderer?.setFlipProgress(easeInOutCubic(t), direction);
      if (t < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = null;
        this.#commit(targetIndex, toPage, toContent);
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  #commit(targetIndex: number, toPage: number, toContent: SpreadContent): void {
    const spread = this.#spreads[targetIndex];
    this.#current = targetIndex;
    this.#currentPage = toPage;
    this.#currentContent = toContent;
    // renderSpread paints the landed spread and clears the turning leaf.
    if (spread) this.#renderer?.renderSpread(spread, toContent);
    this.#prefetchWindow();
    this.#machine.send('settle');
    this.#emitter.emit('pageChanged', { page: toPage });
    this.#emitter.emit('flipEnd', { page: toPage });
  }

  #leadPage(spreadIndex: number): number {
    const spread = this.#spreads[spreadIndex];
    if (!spread) return this.#currentPage;
    const pages = [spread.left, spread.right].filter((p): p is number => p !== null);
    return pages.length > 0 ? Math.min(...pages) : this.#currentPage;
  }

  async #init(rendererOption: RendererOption): Promise<void> {
    // Load the renderer chunk and decode the first spread concurrently.
    const rendererPromise = selectRenderer(rendererOption);
    const spread = this.#spreads[this.#current];
    const contentPromise: Promise<SpreadContent> = spread
      ? this.#resolveContent(spread)
      : Promise.resolve({ left: null, right: null });

    const renderer = await rendererPromise;
    await renderer.mount(this.#container);
    this.#renderer = renderer;

    if (spread) {
      this.#currentContent = await contentPromise;
      renderer.renderSpread(spread, this.#currentContent);
    }
    this.#prefetchWindow();
    this.#emitter.emit('ready');
  }

  async #resolveContent(spread: Spread): Promise<SpreadContent> {
    const [left, right] = await Promise.all([
      spread.left === null ? Promise.resolve(null) : this.#source.get(spread.left),
      spread.right === null ? Promise.resolve(null) : this.#source.get(spread.right),
    ]);
    return { left, right };
  }

  #prefetchWindow(): void {
    const { toMount } = this.#virtualizer.update(this.#current, this.#spreads.length);
    const pages: number[] = [];
    for (const index of toMount) {
      const spread = this.#spreads[index];
      if (spread?.left != null) pages.push(spread.left);
      if (spread?.right != null) pages.push(spread.right);
    }
    this.#source.prefetch(pages);
  }

  #spreadIndexForPage(page: number): number {
    const index = this.#spreads.findIndex((s) => s.left === page || s.right === page);
    return index === -1 ? 0 : index;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
