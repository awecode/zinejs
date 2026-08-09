import { createIcon, ICONS } from './icons';
import type { Zine } from '../zine';

/**
 * Big page-turn arrows flanking the book.
 *
 * They sit *beside* the book rather than over it, for the same reason the docked toolbar does:
 * the container's measured box is what the renderer sizes pages from and what pointer
 * hit-testing maps into, so anything inside it would shrink the book and skew every tap. The
 * book (with whatever the toolbar already wrapped around it) goes in a flex row between them.
 *
 * An arrow disables itself at the end of the book rather than disappearing, so the layout does
 * not jump as the reader reaches the covers.
 */
export class Arrows {
  #zine: Zine;
  #prev: HTMLButtonElement;
  #next: HTMLButtonElement;
  #wrap: HTMLElement | null = null;
  #unsubscribe: (() => void)[] = [];

  constructor(zine: Zine, container: HTMLElement) {
    this.#zine = zine;
    const doc = container.ownerDocument!;

    const rtl = zine.getDirection() === 'rtl';
    // The arrows point where the page goes, so in RTL they swap: "back" is to the right.
    this.#prev = this.#button(doc, rtl ? ICONS.next : ICONS.prev, 'Previous page', () =>
      zine.flipPrev(),
    );
    this.#next = this.#button(doc, rtl ? ICONS.prev : ICONS.next, 'Next page', () =>
      zine.flipNext(),
    );

    this.#place(doc, container);

    const refresh = (): void => this.#refresh();
    this.#unsubscribe.push(zine.on('pageChanged', refresh));
    this.#unsubscribe.push(zine.on('flipEnd', refresh));
    this.#refresh();
  }

  #button(
    doc: Document,
    icon: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'zine-arrow';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.appendChild(createIcon(doc, icon));
    btn.addEventListener('click', onClick);
    // The book's gesture handlers sit on the container; an arrow press is not a page tap.
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      btn.addEventListener(type, (e) => e.stopPropagation());
    }
    return btn;
  }

  #place(doc: Document, container: HTMLElement): void {
    // Wrap the outermost thing the library has already built around the book — a docked toolbar
    // or a side panel — so the arrows flank the whole assembly, not just the pages.
    const outer =
      container.closest('.zine-panel-wrap') ??
      container.closest('.zine-controls-wrap') ??
      container;
    const parent = outer.parentNode;
    if (!parent) return; // not in a document; nothing sensible to flank
    const wrap = doc.createElement('div');
    wrap.className = 'zine-arrows-wrap';
    parent.insertBefore(wrap, outer);
    wrap.append(this.#prev, outer, this.#next);
    this.#wrap = wrap;
  }

  /**
   * Hide an arrow that has nowhere to go — no back arrow on the first page.
   *
   * Hidden rather than removed so its slot stays reserved: dropping it from the flow would slide
   * the book sideways every time the reader reached a cover. `disabled` comes along for the ride
   * so the button is inert even if a consumer's own CSS makes it visible again.
   */
  #refresh(): void {
    for (const [btn, canTurn] of [
      [this.#prev, this.#zine.canFlipPrev()],
      [this.#next, this.#zine.canFlipNext()],
    ] as const) {
      btn.disabled = !canTurn;
      btn.classList.toggle('zine-arrow-hidden', !canTurn);
    }
  }

  destroy(): void {
    for (const off of this.#unsubscribe) off();
    this.#unsubscribe = [];
    this.#prev.remove();
    this.#next.remove();
    const wrap = this.#wrap;
    if (wrap?.parentNode) {
      // The arrows are gone, so what is left is the book; put it back where the wrapper was.
      while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }
    this.#wrap = null;
  }
}
