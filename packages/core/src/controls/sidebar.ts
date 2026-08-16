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
 *
 * On a wide screen the rail flanks the book and the book shrinks to make room (see styles.ts). On
 * a narrow one there is no room to flank, so the rail becomes a drawer over the book and a scrim
 * dims the page behind it; tapping the scrim or pressing Escape dismisses it through `onDismiss`.
 */
/** Shared options a toolbar threads into every panel constructor. */
export interface PanelOptions {
  /** Called when the reader dismisses the narrow-screen drawer (scrim tap or Escape). */
  onDismiss?: () => void;
}

export class Sidebar {
  /** The scrolling list; panels append their rows here. */
  readonly root: HTMLElement;
  #holder: HTMLElement;
  #wrap: HTMLElement | null = null;
  #scrim: HTMLElement | null = null;
  #onKeydown: ((e: KeyboardEvent) => void) | null = null;
  #doc: Document;

  constructor(
    doc: Document,
    container: HTMLElement,
    options: {
      className: string;
      label: string;
      width: number;
      /** Called when the reader dismisses the drawer (scrim tap or Escape). Omit to disable both. */
      onDismiss?: () => void;
      /** Reading direction; the drawer slides in from the right instead of the left when true. */
      rtl?: boolean;
    },
  ) {
    this.#doc = doc;
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

    this.#place(doc, container, options.rtl ?? false);

    if (options.onDismiss) this.#armDismiss(doc, options.onDismiss);
  }

  /** Resize the rail, e.g. once a thumbnail list knows whether it needs one column or two. */
  setWidth(px: number): void {
    this.#holder.style.width = `${px}px`;
  }

  #place(doc: Document, container: HTMLElement, rtl: boolean): void {
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
    if (rtl) wrap.classList.add('zine-panel-wrap-rtl');
    target.parentNode!.insertBefore(wrap, target);
    wrap.append(this.#holder, target);
    this.#wrap = wrap;
  }

  /**
   * Wire the drawer's two dismiss affordances (only reachable under the narrow-screen media query;
   * on a wide screen the scrim is display:none and the drawer needs no dismiss of its own). The
   * scrim is a sibling of the holder so it can dim the book area without the flex row reserving a
   * column for it. When there is no wrap (the parentless overlay fallback), there is no book beside
   * it to dim, so only the Escape key is armed.
   */
  #armDismiss(doc: Document, onDismiss: () => void): void {
    if (this.#wrap) {
      const scrim = doc.createElement('div');
      scrim.className = 'zine-panel-scrim';
      // Before the holder so the drawer paints on top of the dim; z-index in CSS makes it explicit.
      this.#wrap.insertBefore(scrim, this.#holder);
      for (const type of ['pointerdown', 'click']) {
        scrim.addEventListener(type, (e) => {
          e.stopPropagation();
          onDismiss();
        });
      }
      this.#scrim = scrim;
    }
    this.#onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    doc.addEventListener('keydown', this.#onKeydown);
  }

  destroy(): void {
    if (this.#onKeydown) {
      this.#doc.removeEventListener('keydown', this.#onKeydown);
      this.#onKeydown = null;
    }
    this.#scrim?.remove();
    this.#scrim = null;
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
