export interface Vec2 {
  x: number;
  y: number;
}

export interface PageRect {
  width: number;
  height: number;
}

export interface FoldLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Fold {
  /** Crease line, clipped to the page rect (page-local coords). */
  foldLine: FoldLine;
  /** Crease orientation in radians (atan2 of the crease direction). */
  angle: number;
  /** Fold-shadow intensity, 0..1. */
  shadowAlpha: number;
}

const EPS = 1e-6;

/**
 * Book-fold geometry from a dragged corner.
 *
 * The folded flap reflects the grabbed `corner` onto the pointer `point`, so the
 * crease is the perpendicular bisector of the segment corner→point. Coordinates
 * are page-local: (0,0) top-left, x right, y down, page spanning (0,0)..(width,height).
 */
export function foldFromPointer(point: Vec2, corner: Vec2, pageRect: PageRect): Fold {
  const { width, height } = pageRect;
  const dx = point.x - corner.x;
  const dy = point.y - corner.y;
  const dist = Math.hypot(dx, dy);

  // Rest state: no drag → crease sits on the vertical edge through the corner.
  if (dist < EPS) {
    return {
      foldLine: { x1: corner.x, y1: 0, x2: corner.x, y2: height },
      angle: Math.PI / 2,
      shadowAlpha: 0,
    };
  }

  const mid: Vec2 = { x: (point.x + corner.x) / 2, y: (point.y + corner.y) / 2 };
  // Crease direction is perpendicular to the drag vector.
  const cx = -dy;
  const cy = dx;

  return {
    foldLine: clipLineToRect(mid, cx, cy, width, height),
    angle: Math.atan2(cy, cx),
    shadowAlpha: Math.min(1, dist / Math.hypot(width, height)),
  };
}

/** Clip the infinite line through `p` with direction (dx,dy) to [0,w]×[0,h]. */
function clipLineToRect(p: Vec2, dx: number, dy: number, w: number, h: number): FoldLine {
  const cand: { s: number; x: number; y: number }[] = [];
  const consider = (s: number): void => {
    const x = p.x + s * dx;
    const y = p.y + s * dy;
    if (x >= -EPS && x <= w + EPS && y >= -EPS && y <= h + EPS) {
      cand.push({ s, x, y });
    }
  };
  if (Math.abs(dx) > EPS) {
    consider((0 - p.x) / dx);
    consider((w - p.x) / dx);
  }
  if (Math.abs(dy) > EPS) {
    consider((0 - p.y) / dy);
    consider((h - p.y) / dy);
  }
  cand.sort((a, b) => a.s - b.s);
  const a = cand.at(0);
  const b = cand.at(-1);
  // Fewer than two border crossings → crease lies outside the page; collapse to a point.
  if (!a || !b || a === b) {
    return { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
  }
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}
