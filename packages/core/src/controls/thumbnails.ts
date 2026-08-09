import type { Zine } from '../zine';

/** Rail width in px. Wide enough for a two-page spread to stay legible. */
const RAIL_WIDTH = 168;

/**
 * A rail of page thumbnails beside the book.
 *
 * Rows mirror the book's own spread model, so a `double` book shows two pages side by side, a
 * `single` book one, and a `cover`/`book` layout gets its lone first and last pages — including
 * the responsive fallback that forces single-page on a narrow container. Clicking a row turns to
 * that spread.
 *
 * Pages are drawn only as they scroll into view: a long PDF would otherwise decode every page at
 * once the moment the rail opened.
 */
export class Thumbnails {
  #zine: Zine;
  #doc: Document;
  #root: HTMLElement;
  #rows: { el: HTMLElement; spread: number }[] = [];
  #observer: IntersectionObserver | null = null;
  #unsubscribe: (() => void)[] = [];
  #wrap: HTMLElement | null = null;

  constructor(zine: Zine, container: HTMLElement) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;

    this.#root = doc.createElement('div');
    this.#root.className = 'zine-thumbs';
    this.#root.setAttribute('role', 'listbox');
    this.#root.setAttribute('aria-label', 'Pages');
    this.#root.style.width = `${RAIL_WIDTH}px`;
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
      this.#root.classList.add('zine-thumbs-overlay');
      container.appendChild(this.#root);
      return;
    }
    const existing = container.closest('.zine-controls-wrap');
    // A docked toolbar already wrapped the book; wrap that whole assembly so the rail sits
    // beside book *and* toolbar rather than between them.
    const target = (existing ?? container) as HTMLElement;
    const wrap = this.#doc.createElement('div');
    wrap.className = 'zine-thumbs-wrap';
    target.parentNode!.insertBefore(wrap, target);
    wrap.append(this.#root, target);
    this.#wrap = wrap;
  }

  #build(): void {
    const spreads = this.#zine.getSpreads();
    const rtl = this.#zine.getDirection() === 'rtl';
    for (const [index, spread] of spreads.entries()) {
      const row = this.#doc.createElement('button');
      row.type = 'button';
      row.className = 'zine-thumbs-row';
      row.setAttribute('role', 'option');
      if (rtl) row.style.flexDirection = 'row-reverse';

      // A spread's blank half (a lone cover, or an odd final page) is left as an empty slot so
      // the pages line up in the same columns as the book shows them.
      const pages = [spread.left, spread.right];
      const labels: number[] = [];
      for (const page of pages) {
        const cell = this.#doc.createElement('span');
        cell.className = page === null ? 'zine-thumbs-cell zine-thumbs-blank' : 'zine-thumbs-cell';
        if (page !== null) {
          cell.dataset.page = String(page);
          labels.push(page + 1);
        }
        row.appendChild(cell);
      }
      row.setAttribute(
        'aria-label',
        labels.length > 1 ? `Pages ${labels[0]}–${labels.at(-1)}` : `Page ${labels[0] ?? ''}`,
      );

      const caption = this.#doc.createElement('span');
      caption.className = 'zine-thumbs-caption';
      caption.textContent = labels.join('–');
      row.appendChild(caption);

      row.addEventListener('click', () => {
        const first = pages.find((p): p is number => p !== null);
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
    const canvas = this.#doc.createElement('canvas');
    const w = (content as { width: number }).width;
    const h = (content as { height: number }).height;
    if (!w || !h) return;
    // Draw at the rail's scale rather than full page size; a spread shares the width.
    const target = RAIL_WIDTH / 2;
    canvas.width = Math.max(1, Math.round(target));
    canvas.height = Math.max(1, Math.round((target * h) / w));
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
    this.#root.remove();
    const wrap = this.#wrap;
    if (wrap?.parentNode) {
      // Put the book back where it was; the rail was the wrapper's other child.
      while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }
    this.#wrap = null;
  }
}
