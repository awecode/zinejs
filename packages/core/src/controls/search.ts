import { Sidebar, type PanelOptions } from './sidebar';
import type { SearchHit, Zine } from '../zine';

/** Rail width in px. Matches the outline: both hold text, not pictures. */
const RAIL_WIDTH = 208;
/** Wait after the last keystroke before searching, so typing does not scan per character. */
const DEBOUNCE_MS = 180;
/** Shorter queries match too much to be useful. */
const MIN_QUERY = 2;

/** The query and its results, so a closed panel can be reopened where the reader left it rather
 *  than blank. Held by the toolbar (which outlives the panel) and handed back on reopen. */
export interface SearchState {
  query: string;
  results: SearchHit[];
}

/** Panel options plus the optional state to reopen with. */
export interface SearchOptions extends PanelOptions {
  /** Query and results from a previous open, put back so the reader continues where they left off. */
  state?: SearchState;
}

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
  #onDismiss?: () => void;
  /** The last query and results, kept so the toolbar can restore them on reopen. */
  #results: SearchHit[] = [];

  constructor(zine: Zine, container: HTMLElement, options: SearchOptions = {}) {
    this.#zine = zine;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#onDismiss = options.onDismiss;
    this.#bar = new Sidebar(doc, container, {
      className: 'zine-search',
      label: 'Search results',
      width: RAIL_WIDTH,
      onDismiss: options.onDismiss,
      rtl: zine.getDirection() === 'rtl',
      overlay: true, // floats over the book's edge on a wide screen rather than shrinking it
      pageBox: () => zine.getPageBox(),
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

    // Reopened where the reader left off: put the query and its results straight back, without
    // re-scanning the document. A later keystroke supersedes them the usual way.
    const initial = options.state;
    if (initial && initial.query) {
      this.#input.value = initial.query;
      this.#run++; // any restored render belongs to this run, not a stale one
      this.#renderResults(initial.query, initial.results);
    }

    this.#input.focus();
  }

  /** The query and results as they stand, for the toolbar to stash across a close. */
  getState(): SearchState {
    return { query: this.#input.value, results: this.#results };
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
      this.#results = [];
      this.#hits.replaceChildren();
      return;
    }
    this.#note('Searching…');
    const results = await this.#zine.search(query);
    if (mine !== this.#run || !this.#bar.root.isConnected) return; // superseded, or closed
    this.#renderResults(query, results);
  }

  /** Paint a completed search: a note when empty, one clickable row per hit otherwise. Shared by
   *  a live search and the restore of a reopened panel, so both render identically. */
  #renderResults(query: string, results: SearchHit[]): void {
    this.#results = results;
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
        row.addEventListener('click', () => {
          this.#zine.flipTo(hit.page);
          this.#onDismiss?.(); // jump to the hit, then get the rail out of the way
        });
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
