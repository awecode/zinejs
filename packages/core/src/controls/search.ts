import { Sidebar, type PanelOptions } from './sidebar';
import type { Zine } from '../zine';

/** Rail width in px. Matches the outline: both hold text, not pictures. */
const RAIL_WIDTH = 208;
/** Wait after the last keystroke before searching, so typing does not scan per character. */
const DEBOUNCE_MS = 180;
/** Shorter queries match too much to be useful. */
const MIN_QUERY = 2;

/**
 * Full-text search beside the book: a query field over its results.
 *
 * It lives in the same rail as the thumbnails and outline rather than a popover, because results
 * are an open-ended list — a floating panel over the book would either cover the page being
 * searched or clip the very results it found.
 */
export class Search {
  /** The panel's themed root, so the toolbar can stamp its colour scheme. */
  readonly root: HTMLElement;
  #zine: Zine;
  #doc: Document;
  #bar: Sidebar;
  #input: HTMLInputElement;
  #hits: HTMLElement;
  /** Increments per query so a slow search that resolves late cannot overwrite a newer one. */
  #run = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(zine: Zine, container: HTMLElement, options: PanelOptions = {}) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#bar = new Sidebar(doc, container, {
      className: 'zine-search',
      label: 'Search results',
      width: RAIL_WIDTH,
      onDismiss: options.onDismiss,
      rtl: zine.getDirection() === 'rtl',
      overlay: true, // floats over the book's edge on a wide screen rather than shrinking it
    });
    this.root = this.#bar.root;

    this.#input = doc.createElement('input');
    this.#input.type = 'search';
    this.#input.className = 'zine-search-input';
    this.#input.placeholder = 'Search…';
    this.#input.setAttribute('aria-label', 'Search the document');
    this.#input.addEventListener('input', () => {
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = setTimeout(() => void this.#search(), DEBOUNCE_MS);
    });
    // Enter searches at once rather than waiting out the debounce.
    this.#input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      if (this.#timer) clearTimeout(this.#timer);
      void this.#search();
    });

    this.#hits = doc.createElement('div');
    this.#hits.className = 'zine-search-hits';

    this.#bar.root.append(this.#input, this.#hits);
    this.#input.focus();
  }

  #note(text: string): void {
    const note = this.#doc.createElement('div');
    note.className = 'zine-panel-note';
    note.textContent = text;
    this.#hits.replaceChildren(note);
  }

  async #search(): Promise<void> {
    const query = this.#input.value.trim();
    const mine = ++this.#run;
    if (query.length < MIN_QUERY) {
      this.#hits.replaceChildren();
      return;
    }
    this.#note('Searching…');
    const results = await this.#zine.search(query);
    if (mine !== this.#run || !this.#bar.root.isConnected) return; // superseded, or closed
    if (results.length === 0) {
      this.#note(`No matches for “${query}”`);
      return;
    }
    this.#hits.replaceChildren(
      ...results.map((hit) => {
        const row = this.#doc.createElement('button');
        row.type = 'button';
        row.className = 'zine-search-hit';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-label', `Page ${hit.page + 1}: ${hit.excerpt}`);
        const label = this.#doc.createElement('span');
        label.className = 'zine-search-page';
        label.textContent = `Page ${hit.page + 1}`;
        const excerpt = this.#doc.createElement('small');
        excerpt.textContent = hit.excerpt;
        row.append(label, excerpt);
        row.addEventListener('click', () => this.#zine.flipTo(hit.page));
        return row;
      }),
    );
  }

  destroy(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#run++; // any search still in flight is now stale
    this.#bar.destroy();
  }
}
