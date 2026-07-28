import { describe, it, expect } from 'vitest';
import { buildSpreads, shouldSinglePage } from './spread';

describe('buildSpreads', () => {
  it('returns nothing for an empty book', () => {
    expect(buildSpreads(0)).toEqual([]);
  });

  it('pairs pages two-up by default', () => {
    expect(buildSpreads(4)).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 3 },
    ]);
  });

  it('leaves a blank half on an odd page count', () => {
    expect(buildSpreads(5)).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 3 },
      { left: 4, right: null },
    ]);
  });

  it('shows a lone cover, then pairs the interior', () => {
    expect(buildSpreads(5, { cover: true })).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
    ]);
  });

  it('leaves a lone back cover when cover mode runs out on an even count', () => {
    expect(buildSpreads(4, { cover: true })).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: null },
    ]);
  });

  it('mirrors left/right for RTL while preserving reading order', () => {
    expect(buildSpreads(4, { direction: 'rtl' })).toEqual([
      { left: 1, right: 0 },
      { left: 3, right: 2 },
    ]);
  });

  it('emits one page per spread in single-page mode', () => {
    expect(buildSpreads(3, { singlePage: true })).toEqual([
      { left: null, right: 0 },
      { left: null, right: 1 },
      { left: null, right: 2 },
    ]);
  });

  it('single-page mode takes precedence over cover', () => {
    expect(buildSpreads(2, { singlePage: true, cover: true })).toEqual([
      { left: null, right: 0 },
      { left: null, right: 1 },
    ]);
  });
});

describe('shouldSinglePage', () => {
  it('is true strictly below the threshold', () => {
    expect(shouldSinglePage(599, 600)).toBe(true);
    expect(shouldSinglePage(600, 600)).toBe(false);
    expect(shouldSinglePage(601, 600)).toBe(false);
  });
});
