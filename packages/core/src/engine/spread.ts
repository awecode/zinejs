export type Direction = 'ltr' | 'rtl';

export interface Spread {
  /** Page index shown on the left, or null for a blank side. */
  left: number | null;
  /** Page index shown on the right, or null for a blank side. */
  right: number | null;
}

export interface SpreadOptions {
  direction?: Direction;
  /** First page is a lone cover on the leading side; interior pages pair up after it. */
  cover?: boolean;
  /** One page per spread (narrow/portrait viewports). Takes precedence over `cover`. */
  singlePage?: boolean;
}

/**
 * Map a flat page list (indices 0..pageCount-1) into display spreads.
 *
 * Reading order is always preserved; `direction` only mirrors each spread's
 * left/right positions, so RTL is just an LTR layout with the sides swapped.
 * Out-of-range slots are `null` (a blank half on odd counts / the back cover).
 */
export function buildSpreads(pageCount: number, options: SpreadOptions = {}): Spread[] {
  const { direction = 'ltr', cover = false, singlePage = false } = options;
  if (pageCount <= 0) return [];

  const page = (i: number): number | null => (i >= 0 && i < pageCount ? i : null);
  const spreads: Spread[] = [];

  if (singlePage) {
    for (let i = 0; i < pageCount; i++) {
      spreads.push({ left: null, right: i });
    }
  } else if (cover) {
    spreads.push({ left: null, right: 0 });
    for (let i = 1; i < pageCount; i += 2) {
      spreads.push({ left: page(i), right: page(i + 1) });
    }
  } else {
    for (let i = 0; i < pageCount; i += 2) {
      spreads.push({ left: page(i), right: page(i + 1) });
    }
  }

  return direction === 'rtl'
    ? spreads.map((s) => ({ left: s.right, right: s.left }))
    : spreads;
}

/** Whether a container this wide should fall back to one page per spread. */
export function shouldSinglePage(containerWidth: number, threshold: number): boolean {
  return containerWidth < threshold;
}
