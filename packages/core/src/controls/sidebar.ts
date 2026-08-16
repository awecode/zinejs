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

/** The book's painted box inside the container, in container px (see Zine.getPageBox). */
type PageBox = { x: number; y: number; width: number; height: number };

export class Sidebar {
  /** The scrolling list; panels append their rows here. */
  readonly root: HTMLElement;
  #holder: HTMLElement;
  #wrap: HTMLElement | null = null;
  #scrim: HTMLElement | null = null;
  #onKeydown: ((e: KeyboardEvent) => void) | null = null;
  #doc: Document;
  #pageBox: (() => PageBox | null) | null = null;
  #resizeObserver: ResizeObserver | null = null;

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
      /** Float over the book's edge instead of flanking it (so the book never resizes). Panels
       *  whose width is fixed and modest — the outline and search rails — prefer this; the wider
       *  thumbnail rail flanks so both stay fully visible. Only affects wide screens: below the
       *  breakpoint every panel is a drawer regardless. */
      overlay?: boolean;
      /** The book's painted box in container px. The rail stands exactly as tall as the page rather
       *  than the whole container, which is taller whenever the page is letterboxed (its aspect not
       *  matching the container's) or a docked toolbar padded the wrap. Re-read on every resize. */
      pageBox?: () => PageBox | null;
    },
  ) {
    this.#doc = doc;
    this.#holder = doc.createElement('div');
    this.#holder.className = 'zine-panel-holder';
    this.#holder.style.width = `${options.width}px`;
    this.#pageBox = options.pageBox ?? null;

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

    this.#place(doc, container, options.rtl ?? false, options.overlay ?? false);

    if (options.onDismiss) this.#armDismiss(doc, options.onDismiss);

    this.#trackPage(container);
  }

  /**
   * Keep the rail sized to the painted page. The page box changes whenever the container resizes
   * (window, flanking shrink) or its aspect-ratio does (spread-mode toggle), and a ResizeObserver
   * on the container fires on all of those, so re-fitting there catches every case with no event
   * wiring. Falls back to the full-height CSS when there is no observer or no box yet (e.g. tests).
   */
  #trackPage(container: HTMLElement): void {
    if (!this.#pageBox) return;
    this.#fitToPage();
    if (typeof ResizeObserver === 'undefined') return;
    this.#resizeObserver = new ResizeObserver(() => this.#fitToPage());
    this.#resizeObserver.observe(container);
  }

  #fitToPage(): void {
    const box = this.#pageBox?.();
    if (!box) return;
    // top+height (and bottom:auto so an absolute drawer is not over-constrained back to full height)
    // work whether the holder is a relative flex item (flank) or absolutely placed (overlay/drawer).
    this.#holder.style.top = `${box.y}px`;
    this.#holder.style.bottom = 'auto';
    this.#holder.style.height = `${box.height}px`;
  }

  /** Resize the rail, e.g. once a thumbnail list knows whether it needs one column or two. */
  setWidth(px: number): void {
    this.#holder.style.width = `${px}px`;
  }

  #place(doc: Document, container: HTMLElement, rtl: boolean, overlay: boolean): void {
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
    // An overlay panel floats over the book's edge rather than flanking it, so the book keeps its
    // size on a wide screen too — the flex-row shrink is off for this wrap.
    if (overlay) wrap.classList.add('zine-panel-wrap-overlay');
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
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
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
