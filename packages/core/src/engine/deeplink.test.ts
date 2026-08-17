import { describe, it, expect, vi } from 'vitest';
import { bindDeepLink, hashWithPage, pageFromHash } from './deeplink';

describe('deeplink — reading a page from the hash', () => {
  it('reads a 1-based page as a 0-based index', () => {
    expect(pageFromHash('#page=12')).toBe(11);
    expect(pageFromHash('page=1')).toBe(0); // the leading # is optional
  });

  it('finds its page among other keys', () => {
    expect(pageFromHash('#section=intro&page=4&zoom=2')).toBe(3);
  });

  it('ignores a hash with no page, or a nonsensical one', () => {
    for (const hash of ['', '#', '#section=intro', '#page=0', '#page=-2', '#page=abc', '#page=1.5']) {
      expect(pageFromHash(hash)).toBeNull();
    }
  });
});

describe('deeplink — writing the page back', () => {
  it('names the page 1-based', () => {
    expect(hashWithPage('', 0)).toBe('#page=1');
  });

  it('leaves everything else in the hash alone', () => {
    // The hash is shared ground: an app may be routing on it too.
    expect(hashWithPage('#section=intro&zoom=2', 3)).toBe('#section=intro&zoom=2&page=4');
  });

  it('replaces a page already there rather than appending a second', () => {
    expect(hashWithPage('#page=2', 8)).toBe('#page=9');
  });
});

describe('deeplink — binding', () => {
  const fakeWindow = (hash = '') => {
    const listeners: Record<string, ((e: Event) => void)[]> = {};
    const win = {
      location: { hash },
      history: {
        state: null,
        replaceState: vi.fn((_s: unknown, _t: string, url: string) => {
          win.location.hash = url;
        }),
      },
      addEventListener: (type: string, fn: (e: Event) => void) => {
        (listeners[type] ??= []).push(fn);
      },
      removeEventListener: (type: string, fn: (e: Event) => void) => {
        listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
      },
      fire: (type: string) => {
        for (const fn of listeners[type] ?? []) fn(new Event(type));
      },
    };
    return win as typeof win & Window;
  };

  it('replaces rather than pushes, so flipping does not fill the back button', () => {
    const win = fakeWindow();
    bindDeepLink(win, () => {});
    win.history.replaceState.mock.calls.length = 0;
    bindDeepLink(win, () => {}).push(4);
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '#page=5');
  });

  it('navigates when the hash changes underneath it', () => {
    const win = fakeWindow('#page=1');
    const seen: number[] = [];
    bindDeepLink(win, (page) => seen.push(page));
    win.location.hash = '#page=7';
    win.fire('hashchange');
    expect(seen).toEqual([6]);
  });

  it('does not navigate in response to its own write', () => {
    // Otherwise every page turn would echo back as a navigation to the page just reached.
    const win = fakeWindow();
    const seen: number[] = [];
    const handle = bindDeepLink(win, (page) => seen.push(page));
    handle.push(3);
    win.fire('hashchange');
    expect(seen).toEqual([]);
  });

  it('ignores a repeat of the page it is already showing', () => {
    // Following a link calls back, which turns the page, which pushes again: without this the
    // echo would be taken for a fresh navigation and turn the page a second time.
    const win = fakeWindow('#page=1');
    const seen: number[] = [];
    const handle = bindDeepLink(win, (page) => {
      seen.push(page);
      handle.push(page); // what Zine does once the flip lands
    });
    win.location.hash = '#page=7';
    win.fire('hashchange');
    win.fire('hashchange'); // the echo from that push
    expect(seen).toEqual([6]);
  });

  it('stops listening once torn down', () => {
    const win = fakeWindow();
    const seen: number[] = [];
    const handle = bindDeepLink(win, (page) => seen.push(page));
    handle.stop();
    win.location.hash = '#page=9';
    win.fire('hashchange');
    expect(seen).toEqual([]);
  });
});
