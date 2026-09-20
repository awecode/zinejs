import { describe, it, expect } from 'vitest';
import { defaultStrings, resolveStrings, type ZineStrings } from './strings';

describe('resolveStrings', () => {
  it('returns the English defaults when no overrides are given', () => {
    expect(resolveStrings()).toBe(defaultStrings);
    expect(resolveStrings().nextPage).toBe('Next page');
  });

  it('merges a partial override over the defaults, keeping the rest English', () => {
    const s = resolveStrings({ nextPage: 'Página siguiente' });
    expect(s.nextPage).toBe('Página siguiente'); // overridden
    expect(s.prevPage).toBe('Previous page'); // untouched default
  });

  it('lets a dynamic entry be overridden with different word order', () => {
    const s = resolveStrings({ pageAnnounce: (c, t) => `Página ${c} de ${t}` });
    expect(s.pageAnnounce(3, 20)).toBe('Página 3 de 20');
  });

  it('keeps the default dynamic entries callable', () => {
    expect(defaultStrings.pageAnnounce(3, 20)).toBe('Page 3 of 20');
    expect(defaultStrings.noMatches('cat')).toBe('No matches for “cat”');
    expect(defaultStrings.thumbnailAria(['3', '4'])).toBe('Pages 3–4');
    expect(defaultStrings.thumbnailAria(['5'])).toBe('Page 5');
  });

  it('builds the zoom hint from whichever gestures are enabled', () => {
    expect(defaultStrings.zoomHint({ doubleClick: true, wheel: true, mac: false })).toBe(
      'Double-click or Ctrl-scroll to zoom',
    );
    expect(defaultStrings.zoomHint({ doubleClick: true, wheel: true, mac: true })).toBe(
      'Double-click or ⌘-scroll to zoom',
    );
    expect(defaultStrings.zoomHint({ doubleClick: false, wheel: true, mac: false })).toBe(
      'Ctrl-scroll to zoom',
    );
  });

  it('exposes every key as a string or function (no undefined)', () => {
    for (const [key, value] of Object.entries(defaultStrings) as [keyof ZineStrings, unknown][]) {
      expect(['string', 'function'], `${key}`).toContain(typeof value);
    }
  });
});
