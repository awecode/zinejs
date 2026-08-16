import { Sidebar, type PanelOptions } from './sidebar';
import type { OutlineItem } from '../source/types';
import type { Zine } from '../zine';

/** Rail width in px. Wider than the thumbnail rail because it holds headings, not pictures. */
const RAIL_WIDTH = 208;
/** Indent per nesting level, in px. */
const INDENT = 12;

/**
 * The document's table of contents beside the book.
 *
 * One row per heading, nested entries indented under their parent. Clicking a row turns to the
 * page it points at; a heading whose destination could not be resolved is still listed, just not
 * clickable. Unlike the thumbnail rail this is a single column — headings are text, and a second
 * column would only make them narrower.
 */
export class Outline {
  /** The panel's themed root, so the toolbar can stamp its colour scheme. */
  readonly root: HTMLElement;
  #zine: Zine;
  #doc: Document;
  #bar: Sidebar;
  #rows: { el: HTMLElement; page: number }[] = [];
  #unsubscribe: (() => void)[] = [];

  constructor(zine: Zine, container: HTMLElement, options: PanelOptions = {}) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#bar = new Sidebar(doc, container, {
      className: 'zine-outline',
      label: 'Outline',
      width: RAIL_WIDTH,
      onDismiss: options.onDismiss,
      rtl: zine.getDirection() === 'rtl',
    });
    this.root = this.#bar.root;

    this.#note('Loading…');
    void this.#build();

    this.#unsubscribe.push(zine.on('pageChanged', () => this.#markCurrent()));
  }

  #note(text: string): void {
    const note = this.#doc.createElement('div');
    note.className = 'zine-panel-note';
    note.textContent = text;
    this.#bar.root.replaceChildren(note);
  }

  async #build(): Promise<void> {
    const items = await this.#zine.getOutline();
    if (!this.#bar.root.isConnected) return; // closed while the outline was loading
    if (items.length === 0) {
      // The toolbar hides the control when there is nothing to list, so this is only reachable
      // through a hand-written layout that names 'outline' regardless.
      this.#note('This document has no outline.');
      return;
    }
    this.#bar.root.replaceChildren();
    this.#addLevel(items, 0);
    this.#markCurrent();
  }

  #addLevel(items: OutlineItem[], depth: number): void {
    for (const item of items) {
      const row = this.#doc.createElement('button');
      row.type = 'button';
      row.className = 'zine-outline-row';
      row.setAttribute('role', 'option');
      row.style.paddingLeft = `${8 + depth * INDENT}px`;
      row.textContent = item.title;
      row.title = item.title;
      if (item.page === null) {
        // Keep the heading visible but inert: it still tells the reader what is in the document.
        row.disabled = true;
      } else {
        const page = item.page;
        row.setAttribute('aria-label', `${item.title}, page ${page + 1}`);
        row.addEventListener('click', () => this.#zine.flipTo(page));
        this.#rows.push({ el: row, page });
      }
      this.#bar.root.appendChild(row);
      if (item.children.length > 0) this.#addLevel(item.children, depth + 1);
    }
  }

  /**
   * Mark the entry the reader is inside — the last one at or before the current page, rather
   * than an exact match, since a section spans many pages and rarely starts on the one shown.
   */
  #markCurrent(): void {
    const current = this.#zine.getPage();
    let best: HTMLElement | null = null;
    let bestPage = -1;
    for (const { el, page } of this.#rows) {
      el.classList.remove('zine-panel-active');
      el.removeAttribute('aria-selected');
      if (page <= current && page >= bestPage) {
        best = el;
        bestPage = page;
      }
    }
    if (!best) return;
    best.classList.add('zine-panel-active');
    best.setAttribute('aria-selected', 'true');
    best.scrollIntoView?.({ block: 'nearest' });
  }

  destroy(): void {
    for (const off of this.#unsubscribe) off();
    this.#unsubscribe = [];
    this.#bar.destroy();
  }
}
