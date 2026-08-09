/**
 * The rail beside the book that the thumbnail and outline lists both sit in.
 *
 * It exists to solve one problem shared by every such panel: the container's measured box is what
 * the renderer sizes the book from and what pointer hit-testing maps into, so a panel must not
 * live inside it. Instead the book (and its docked toolbar, if any) is wrapped in a flex row with
 * the panel as its sibling, and `destroy` unwinds that again.
 *
 * The rail is absolutely positioned inside a holder that stretches to the book's height, so a
 * long list scrolls internally instead of running past the bottom of the book.
 */
export class Sidebar {
  /** The scrolling list; panels append their rows here. */
  readonly root: HTMLElement;
  #holder: HTMLElement;
  #wrap: HTMLElement | null = null;

  constructor(
    doc: Document,
    container: HTMLElement,
    options: { className: string; label: string; width: number },
  ) {
    this.#holder = doc.createElement('div');
    this.#holder.className = 'zine-panel-holder';
    this.#holder.style.width = `${options.width}px`;

    this.root = doc.createElement('div');
    this.root.className = `zine-panel ${options.className}`;
    this.root.setAttribute('role', 'listbox');
    this.root.setAttribute('aria-label', options.label);
    this.#holder.appendChild(this.root);

    // In the overlay fallback the rail sits inside the book, where the book's own gesture
    // handlers would otherwise read a click on a row as a page tap.
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'wheel']) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }

    this.#place(doc, container);
  }

  /** Resize the rail, e.g. once a thumbnail list knows whether it needs one column or two. */
  setWidth(px: number): void {
    this.#holder.style.width = `${px}px`;
  }

  #place(doc: Document, container: HTMLElement): void {
    const parent = container.parentNode;
    if (!parent) {
      // Not in a document yet: overlay rather than lose the panel.
      this.#holder.classList.add('zine-panel-overlay');
      container.appendChild(this.#holder);
      return;
    }
    // A docked toolbar already wrapped the book; wrap that whole assembly so the rail sits
    // beside book *and* toolbar rather than between them.
    const existing = container.closest('.zine-controls-wrap');
    const target = (existing ?? container) as HTMLElement;
    const wrap = doc.createElement('div');
    wrap.className = 'zine-panel-wrap';
    target.parentNode!.insertBefore(wrap, target);
    wrap.append(this.#holder, target);
    this.#wrap = wrap;
  }

  destroy(): void {
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
