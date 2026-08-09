import type { Zine } from '../zine';

/** Width of one page thumbnail, in px. A paired rail fits two of these side by side. */
const THUMB_WIDTH = 78;
/** Padding inside the rail, per side. */
const RAIL_PAD = 6;
/** Gap between the two pages of a spread. */
const CELL_GAP = 2;

/**
 * A rail of page thumbnails beside the book.
 *
 * Rows mirror the book's own spread model, so a `double` book shows two pages per row and a
 * `single` book one — including the responsive fallback that forces single-page on a narrow
 * container. A book that mixes the two (`cover`, `book`) keeps two columns so pairs line up, and
 * centres its lone first/last page between them. Clicking a row turns to that spread.
 *
 * Pages are drawn only as they scroll into view: a long PDF would otherwise decode every page at
 * once the moment the rail opened.
 */
export class Thumbnails {
  #zine: Zine;
  #doc: Document;
  #root: HTMLElement;
  /** Stretches to the book's height; the rail scrolls inside it. */
  #holder: HTMLElement;
  #rows: { el: HTMLElement; spread: number }[] = [];
  #observer: IntersectionObserver | null = null;
  #unsubscribe: (() => void)[] = [];
  #wrap: HTMLElement | null = null;

  constructor(zine: Zine, container: HTMLElement) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;

    this.#holder = doc.createElement('div');
    this.#holder.className = 'zine-thumbs-holder';

    this.#root = doc.createElement('div');
    this.#root.className = 'zine-thumbs';
    this.#root.setAttribute('role', 'listbox');
    this.#root.setAttribute('aria-label', 'Pages');
    this.#holder.appendChild(this.#root);

    // The rail sits inside the book's container in overlay mode, where the book's own gesture
    // handlers would otherwise read a click on a thumbnail as a page tap.
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'wheel']) {
      this.#root.addEventListener(type, (e) => e.stopPropagation());
    }

    this.#place(container);
    this.#build();

    const onPage = (): void => this.#markCurrent();
    this.#unsubscribe.push(zine.on('pageChanged', onPage));
    this.#markCurrent();
  }

  /** Insert the rail as a sibling of the book, so it does not shrink the container the renderer
   *  measures. Falls back to overlaying if the container has no parent to wrap. */
  #place(container: HTMLElement): void {
    const parent = container.parentNode;
    if (!parent) {
      this.#holder.classList.add('zine-thumbs-overlay');
      container.appendChild(this.#holder);
      return;
    }
    // A docked toolbar already wrapped the book; wrap that whole assembly so the rail sits
    // beside book *and* toolbar rather than between them.
    const existing = container.closest('.zine-controls-wrap');
    const target = (existing ?? container) as HTMLElement;
    const wrap = this.#doc.createElement('div');
    wrap.className = 'zine-thumbs-wrap';
    target.parentNode!.insertBefore(wrap, target);
    wrap.append(this.#holder, target);
    this.#wrap = wrap;
  }

  #build(): void {
    const spreads = this.#zine.getSpreads();
    const rtl = this.#zine.getDirection() === 'rtl';
    // Two columns only if the book actually pairs pages somewhere. A wholly single-page book
    // gets a one-page-wide rail rather than a column of half-empty rows.
    const paired = spreads.some((s) => s.left !== null && s.right !== null);
    this.#root.classList.toggle('zine-thumbs-solo', !paired);
    this.#holder.style.width = `${
      (paired ? THUMB_WIDTH * 2 + CELL_GAP : THUMB_WIDTH) + RAIL_PAD * 2
    }px`;

    for (const [index, spread] of spreads.entries()) {
      const row = this.#doc.createElement('button');
      row.type = 'button';
      row.className = 'zine-thumbs-row';
      row.setAttribute('role', 'option');
      if (rtl) row.style.flexDirection = 'row-reverse';

      const pages = [spread.left, spread.right].filter((p): p is number => p !== null);
      // A lone page in a book that pairs elsewhere keeps a single page's width and sits in the
      // middle, rather than stretching across both columns or hugging one side.
      if (paired && pages.length === 1) row.classList.add('zine-thumbs-row-lone');

      for (const page of pages) {
        const cell = this.#doc.createElement('span');
        cell.className = 'zine-thumbs-cell';
        cell.dataset.page = String(page);
        row.appendChild(cell);
      }

      const labels = [...pages].sort((a, b) => a - b).map((p) => p + 1);
      row.setAttribute(
        'aria-label',
        labels.length > 1 ? `Pages ${labels[0]}–${labels.at(-1)}` : `Page ${labels[0] ?? ''}`,
      );

      const caption = this.#doc.createElement('span');
      caption.className = 'zine-thumbs-caption';
      caption.textContent = labels.join('–');
      row.appendChild(caption);

      row.addEventListener('click', () => {
        const first = pages.length > 0 ? Math.min(...pages) : undefined;
        if (first !== undefined) this.#zine.flipTo(first);
      });
      this.#root.appendChild(row);
      this.#rows.push({ el: row, spread: index });
    }
    this.#observeRows();
  }

  /** Decode a row's pages the first time it comes into view. */
  #observeRows(): void {
    const cells = [...this.#root.querySelectorAll<HTMLElement>('.zine-thumbs-cell[data-page]')];
    if (typeof IntersectionObserver === 'undefined') {
      for (const cell of cells) void this.#paint(cell);
      return;
    }
    this.#observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          obs.unobserve(entry.target);
          void this.#paint(entry.target as HTMLElement);
        }
      },
      { root: this.#root, rootMargin: '200px' },
    );
    for (const cell of cells) this.#observer.observe(cell);
  }

  async #paint(cell: HTMLElement): Promise<void> {
    const page = Number(cell.dataset.page);
    const content = await this.#zine.getPageImage(page);
    if (!content || !cell.isConnected) return;
    const w = (content as { width: number }).width;
    const h = (content as { height: number }).height;
    if (!w || !h) return;
    // One page's worth of pixels, whatever the rail's column count, so thumbs stay a
    // consistent size between modes. Scaled by dpr so they are not soft on a retina screen.
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const canvas = this.#doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(THUMB_WIDTH * dpr));
    canvas.height = Math.max(1, Math.round(((THUMB_WIDTH * h) / w) * dpr));
    canvas.className = 'zine-thumbs-img';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(content as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    } catch {
      return; // an unusable raster is not worth breaking the rail over
    }
    cell.replaceChildren(canvas);
  }

  /** Highlight the spread on screen and keep it scrolled into view. */
  #markCurrent(): void {
    const current = this.#zine.getSpreadIndex();
    for (const { el, spread } of this.#rows) {
      const active = spread === current;
      el.classList.toggle('zine-thumbs-active', active);
      el.setAttribute('aria-selected', String(active));
      if (active) el.scrollIntoView?.({ block: 'nearest' });
    }
  }

  destroy(): void {
    for (const off of this.#unsubscribe) off();
    this.#unsubscribe = [];
    this.#observer?.disconnect();
    this.#observer = null;
    this.#holder.remove();
    const wrap = this.#wrap;
    if (wrap?.parentNode) {
      // The rail is gone, so what is left is the book; put it back where the wrapper was.
      while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }
    this.#wrap = null;
  }
}
