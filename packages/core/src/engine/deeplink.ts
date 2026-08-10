/**
 * Keeping the page in the URL, so a link opens where the reader was.
 *
 * The hash is treated as shared ground rather than ours: only a `page` key is read or written,
 * anything else in it is preserved, and updates go through `replaceState` so turning pages does
 * not fill the reader's back button with history entries.
 */
const KEY = 'page';

/**
 * Whether some book on this page already owns the hash.
 *
 * Two books sharing one URL would each overwrite the other's page, and the second to load would
 * open on the first one's page. Only the first claims it; the rest still work, they just do not
 * appear in the address bar.
 */
let claimed = false;

/** Take the hash if it is going, and report whether this caller got it. */
export function claimHash(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

/** Give the hash back, so a book that replaces this one can own it. */
export function releaseHash(): void {
  claimed = false;
}

/** Read the 1-based page from a hash, as a 0-based index. Null when it carries no page. */
export function pageFromHash(hash: string): number | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = params.get(KEY);
  if (raw === null) return null;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page - 1 : null;
}

/** The hash that names `page` (0-based), leaving any other keys in `hash` untouched. */
export function hashWithPage(hash: string, page: number): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  params.set(KEY, String(page + 1));
  return `#${params.toString()}`;
}

export interface DeepLinkHandle {
  /** Write the current page into the address bar. */
  push(page: number): void;
  stop(): void;
}

/**
 * Mirror the reader's page in the URL, and follow it when the URL changes (back/forward, or a
 * pasted link). `onNavigate` fires only for a page the book is not already on.
 */
export function bindDeepLink(win: Window, onNavigate: (page: number) => void): DeepLinkHandle {
  let last: string | null = null;
  const onHashChange = (): void => {
    if (win.location.hash === last) return; // our own write coming back to us
    const page = pageFromHash(win.location.hash);
    if (page !== null) onNavigate(page);
  };
  win.addEventListener('hashchange', onHashChange);
  return {
    push(page) {
      const hash = hashWithPage(win.location.hash, page);
      if (hash === win.location.hash) return;
      last = hash;
      // replaceState, not assignment: a reader flipping through fifty pages should not have to
      // press Back fifty times to leave.
      win.history?.replaceState?.(win.history.state, '', hash);
    },
    stop() {
      win.removeEventListener('hashchange', onHashChange);
    },
  };
}
