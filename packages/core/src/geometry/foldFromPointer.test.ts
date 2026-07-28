import { describe, it, expect } from 'vitest';
import { foldFromPointer } from './foldFromPointer';

const page = { width: 100, height: 100 };
const topRight = { x: 100, y: 0 };

describe('foldFromPointer', () => {
  it('returns a flat, shadowless fold at rest (no drag)', () => {
    const fold = foldFromPointer(topRight, topRight, page);
    expect(fold.shadowAlpha).toBe(0);
    expect(fold.foldLine).toEqual({ x1: 100, y1: 0, x2: 100, y2: 100 });
  });

  it('creases vertically at the midpoint for a straight horizontal drag', () => {
    const fold = foldFromPointer({ x: 0, y: 0 }, topRight, page);
    // corner (100,0) → pointer (0,0): perpendicular bisector is x = 50, full height.
    expect(fold.foldLine.x1).toBeCloseTo(50);
    expect(fold.foldLine.x2).toBeCloseTo(50);
    const ys = [fold.foldLine.y1, fold.foldLine.y2].sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(0);
    expect(ys[1]).toBeCloseTo(100);
    expect(fold.shadowAlpha).toBeCloseTo(100 / Math.hypot(100, 100));
  });

  it('places the crease as the perpendicular bisector of corner→pointer', () => {
    const point = { x: 20, y: 80 };
    const fold = foldFromPointer(point, topRight, page);
    const mid = { x: (point.x + topRight.x) / 2, y: (point.y + topRight.y) / 2 };
    // (1) midpoint lies on the crease
    const onLine =
      (fold.foldLine.x2 - fold.foldLine.x1) * (mid.y - fold.foldLine.y1) -
      (fold.foldLine.y2 - fold.foldLine.y1) * (mid.x - fold.foldLine.x1);
    expect(onLine).toBeCloseTo(0);
    // (2) crease is perpendicular to the drag vector
    const drag = { x: point.x - topRight.x, y: point.y - topRight.y };
    const crease = {
      x: fold.foldLine.x2 - fold.foldLine.x1,
      y: fold.foldLine.y2 - fold.foldLine.y1,
    };
    expect(drag.x * crease.x + drag.y * crease.y).toBeCloseTo(0);
    // (3) both endpoints sit on the page border
    const endpoints: Array<[number, number]> = [
      [fold.foldLine.x1, fold.foldLine.y1],
      [fold.foldLine.x2, fold.foldLine.y2],
    ];
    for (const [x, y] of endpoints) {
      const onBorder =
        Math.abs(x) < 1e-6 ||
        Math.abs(x - 100) < 1e-6 ||
        Math.abs(y) < 1e-6 ||
        Math.abs(y - 100) < 1e-6;
      expect(onBorder).toBe(true);
    }
  });

  it('keeps shadowAlpha within [0,1] and growing with drag distance', () => {
    const near = foldFromPointer({ x: 90, y: 10 }, topRight, page);
    const far = foldFromPointer({ x: 0, y: 100 }, topRight, page);
    expect(near.shadowAlpha).toBeGreaterThanOrEqual(0);
    expect(far.shadowAlpha).toBeLessThanOrEqual(1);
    expect(far.shadowAlpha).toBeGreaterThan(near.shadowAlpha);
  });
});
