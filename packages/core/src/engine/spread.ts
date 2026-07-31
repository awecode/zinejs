export type Direction = 'ltr' | 'rtl';

/**
 * How pages group into spreads:
 * - `double`: paired from the start — `[0|1] [2|3] …`
 * - `single`: one page per spread — `[0] [1] …`
 * - `cover`: first page alone, then paired — `[·|0] [1|2] …`
 * - `book`: first AND last alone (front + back cover) — `[·|0] [1|2] … [N-1|·]`
 */
export type SpreadMode = 'double' | 'single' | 'cover' | 'book';

export interface Spread {
  /** Page index shown on the left, or null for a blank side. */
  left: number | null;
  /** Page index shown on the right, or null for a blank side. */
  right: number | null;
}

export interface SpreadOptions {
  direction?: Direction;
  mode?: SpreadMode;
}

/**
 * Map a flat page list (indices 0..pageCount-1) into display spreads.
 *
 * Reading order is always preserved; `direction` only mirrors each spread's
 * left/right positions, so RTL is just an LTR layout with the sides swapped.
 * Out-of-range slots are `null` (a blank half on odd counts / a lone cover).
 */
export function buildSpreads(pageCount: number, options: SpreadOptions = {}): Spread[] {
  const { direction = 'ltr', mode = 'cover' } = options;
  if (pageCount <= 0) return [];

  const page = (i: number): number | null => (i >= 0 && i < pageCount ? i : null);
  const spreads: Spread[] = [];

  if (mode === 'single') {
    for (let i = 0; i < pageCount; i++) spreads.push({ left: null, right: i });
  } else if (mode === 'double') {
    for (let i = 0; i < pageCount; i += 2) spreads.push({ left: page(i), right: page(i + 1) });
  } else if (mode === 'cover') {
    spreads.push({ left: null, right: 0 });
    for (let i = 1; i < pageCount; i += 2) spreads.push({ left: page(i), right: page(i + 1) });
  } else {
    // book: front cover alone, interior paired, back cover alone
    spreads.push({ left: null, right: 0 });
    if (pageCount > 1) {
      for (let i = 1; i <= pageCount - 2; i += 2) {
        spreads.push({ left: page(i), right: i + 1 <= pageCount - 2 ? page(i + 1) : null });
      }
      spreads.push({ left: pageCount - 1, right: null });
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
