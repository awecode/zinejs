import { describe, it, expect } from 'vitest';
import { buildSpreads, shouldSinglePage } from './spread';

describe('buildSpreads', () => {
  it('returns nothing for an empty book', () => {
    expect(buildSpreads(0)).toEqual([]);
  });

  it('defaults to cover mode (lone first page)', () => {
    expect(buildSpreads(4)).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: null },
    ]);
  });

  it('double: pairs two-up from the start', () => {
    expect(buildSpreads(4, { mode: 'double' })).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 3 },
    ]);
  });

  it('double: leaves a blank half on an odd count', () => {
    expect(buildSpreads(5, { mode: 'double' })).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 3 },
      { left: 4, right: null },
    ]);
  });

  it('cover: lone first page, then paired interior', () => {
    expect(buildSpreads(5, { mode: 'cover' })).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
    ]);
  });

  it('book: front and back covers both alone', () => {
    expect(buildSpreads(6, { mode: 'book' })).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
      { left: 5, right: null },
    ]);
  });

  it('book: forces the last page alone even when it would otherwise pair', () => {
    expect(buildSpreads(5, { mode: 'book' })).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: null },
      { left: 4, right: null },
    ]);
  });

  it('book: a single-page book is just a front cover', () => {
    expect(buildSpreads(1, { mode: 'book' })).toEqual([{ left: null, right: 0 }]);
  });

  it('single: one page per spread', () => {
    expect(buildSpreads(3, { mode: 'single' })).toEqual([
      { left: null, right: 0 },
      { left: null, right: 1 },
      { left: null, right: 2 },
    ]);
  });

  it('mirrors left/right for RTL while preserving reading order', () => {
    expect(buildSpreads(4, { mode: 'double', direction: 'rtl' })).toEqual([
      { left: 1, right: 0 },
      { left: 3, right: 2 },
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
