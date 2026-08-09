import { Sidebar } from './sidebar';
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
  #bar: Sidebar;
  #rows: { el: HTMLElement; spread: number }[] = [];
  #observer: IntersectionObserver | null = null;
  #unsubscribe: (() => void)[] = [];

  constructor(zine: Zine, container: HTMLElement) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#bar = new Sidebar(doc, container, {
      className: 'zine-thumbs',
      label: 'Pages',
      width: THUMB_WIDTH + RAIL_PAD * 2,
    });

    this.#build();

    const onPage = (): void => this.#markCurrent();
    this.#unsubscribe.push(zine.on('pageChanged', onPage));
    this.#markCurrent();
  }

  #build(): void {
    const spreads = this.#zine.getSpreads();
    const rtl = this.#zine.getDirection() === 'rtl';
    // Two columns only if the book actually pairs pages somewhere. A wholly single-page book
    // gets a one-page-wide rail rather than a column of half-empty rows.
    const paired = spreads.some((s) => s.left !== null && s.right !== null);
    this.#bar.root.classList.toggle('zine-thumbs-solo', !paired);
    if (paired) this.#bar.setWidth(THUMB_WIDTH * 2 + CELL_GAP + RAIL_PAD * 2);

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
        if (pages.length > 0) this.#zine.flipTo(Math.min(...pages));
      });
      this.#bar.root.appendChild(row);
      this.#rows.push({ el: row, spread: index });
    }
    this.#observeRows();
  }

  /** Decode a row's pages the first time it comes into view. */
  #observeRows(): void {
    const cells = [...this.#bar.root.querySelectorAll<HTMLElement>('.zine-thumbs-cell[data-page]')];
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
      { root: this.#bar.root, rootMargin: '200px' },
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
    // One page's worth of pixels, whatever the rail's column count, so thumbs stay a consistent
    // size between modes. Scaled by dpr so they are not soft on a retina screen.
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
      el.classList.toggle('zine-panel-active', active);
      el.setAttribute('aria-selected', String(active));
      if (active) el.scrollIntoView?.({ block: 'nearest' });
    }
  }

  destroy(): void {
    for (const off of this.#unsubscribe) off();
    this.#unsubscribe = [];
    this.#observer?.disconnect();
    this.#observer = null;
    this.#bar.destroy();
  }
}
