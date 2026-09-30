import { describe, it, expect } from 'vitest';
import { matchOverlap, detectOverlap } from './gutter';

const W = 60; // strip width (columns)
const H = 100; // strip height (rows)

/** Deterministic textured "artwork": a luma per (x, y) with enough structure to match on. */
function art(seed: number): (x: number, y: number) => number {
  return (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return 30 + (((h ^ (h >>> 16)) >>> 0) % 170); // 30..199: all ink
  };
}

/** An RGBA strip of `W` columns taken from `paint` starting at artboard column `x0`. */
function strip(paint: (x: number, y: number) => number, x0: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x0 + x, y);
      const i = (y * W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}

describe('matchOverlap', () => {
  it('finds an exact repeat across the spine', () => {
    // One continuous artwork: the right page starts 17 columns before the left page ends.
    const board = art(1);
    expect(matchOverlap(strip(board, 0), strip(board, W - 17), W, H)).toBe(17);
  });

  it('finds repeats of different widths', () => {
    const board = art(2);
    for (const n of [5, 12, 30, 48]) {
      expect(matchOverlap(strip(board, 0), strip(board, W - n), W, H)).toBe(n);
    }
  });

  it('reports none when the two pages do not repeat each other', () => {
    expect(matchOverlap(strip(art(3), 0), strip(art(4), 0), W, H)).toBe(0);
  });

  it('reports none for blank margins, which would otherwise match at any width', () => {
    const white = strip(() => 255, 0);
    expect(matchOverlap(white, white, W, H)).toBe(0);
  });

  it('reports none for a uniform colour band, which has no sharp best width', () => {
    const band = strip(() => 90, 0);
    expect(matchOverlap(band, band, W, H)).toBe(0);
  });

  it('tolerates small antialiasing differences in a true repeat', () => {
    const board = art(5);
    const noisy = (x: number, y: number): number => board(x, y) + ((x + y) % 3) - 1; // +/-1 luma
    expect(matchOverlap(strip(board, 0), strip(noisy, W - 20), W, H)).toBe(20);
  });
});

describe('detectOverlap', () => {
  it('never matches pages of different sizes (their rows would not line up)', () => {
    const a = { width: 800, height: 1200 } as unknown as ImageBitmap;
    const b = { width: 780, height: 1200 } as unknown as ImageBitmap;
    expect(detectOverlap(a, b)).toBe(0);
  });
});
