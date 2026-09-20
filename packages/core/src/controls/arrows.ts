import { createIcon, ICONS } from './icons';
import { applyColorScheme } from './styles';
import type { ControlsColorScheme } from './types';
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
  #device: 'desktop' | 'mobile' | null;
  #unsubscribe: (() => void)[] = [];

  constructor(
    zine: Zine,
    container: HTMLElement,
    colorScheme: ControlsColorScheme = 'auto',
    // null: show everywhere. 'desktop'/'mobile': show only on that device; a class on the wrap
    // lets CSS hide the arrows on the other side of the layout breakpoint (see styles.ts).
    device: 'desktop' | 'mobile' | null = null,
  ) {
    this.#zine = zine;
    this.#device = device;
    const doc = container.ownerDocument!;

    const rtl = zine.getDirection() === 'rtl';
    // The arrows point where the page goes, so in RTL they swap: "back" is to the right.
    this.#prev = this.#button(doc, rtl ? ICONS.next : ICONS.prev, zine.strings.prevPage, () =>
      zine.flipPrev(),
    );
    this.#next = this.#button(doc, rtl ? ICONS.prev : ICONS.next, zine.strings.nextPage, () =>
      zine.flipNext(),
    );

    this.#place(doc, container);
    // The wrap holds both arrow buttons; color-scheme inherits, so stamping it themes both. In
    // the parentless fallback there is no wrap, so stamp the buttons directly instead.
    if (this.#wrap) applyColorScheme(this.#wrap, colorScheme);
    else for (const btn of [this.#prev, this.#next]) applyColorScheme(btn, colorScheme);

    // pageChanged fires at the animation lead and carries the landed page; flipEnd is the safety
    // net for a landing that never led (reduced motion, a canceled lead). See #refresh for why the
    // page matters.
    this.#unsubscribe.push(zine.on('pageChanged', ({ page }) => this.#refresh(page)));
    this.#unsubscribe.push(zine.on('flipEnd', () => this.#refresh()));
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
    if (this.#device) wrap.classList.add(`zine-arrows-${this.#device}`);
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
  #refresh(page?: number): void {
    const { prev, next } = this.#edges(page);
    for (const [btn, canTurn] of [
      [this.#prev, prev],
      [this.#next, next],
    ] as const) {
      btn.disabled = !canTurn;
      btn.classList.toggle('zine-arrow-hidden', !canTurn);
    }
  }

  /**
   * Which arrows have somewhere to go.
   *
   * `canFlipPrev`/`canFlipNext` read the committed spread index, which only updates once a flip
   * lands — so refreshing off them at the animation lead (when `pageChanged` fires, a few ms
   * before the commit) leaves the arrow a step behind until the fold fully settles. When the
   * event hands us the page that just landed, resolve its spread from the public spread model so
   * the arrow corrects the instant the fold reads as landed. Fall back to the committed edge state
   * when there is no page in hand (initial paint, `flipEnd`) or the page is not in any spread.
   */
  #edges(page?: number): { prev: boolean; next: boolean } {
    if (page !== undefined) {
      const spreads = this.#zine.getSpreads();
      const index = spreads.findIndex((s) => s.left === page || s.right === page);
      if (index >= 0) return { prev: index > 0, next: index + 1 < spreads.length };
    }
    return { prev: this.#zine.canFlipPrev(), next: this.#zine.canFlipNext() };
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
