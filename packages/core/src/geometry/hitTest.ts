import type { PageRect, Vec2 } from './foldFromPointer';

export type HitRegion = 'corner' | 'page' | 'outside';

/**
 * Classify a page-local point into a hit region.
 *
 * Coordinates are page-local (see `foldFromPointer`): (0,0) top-left,
 * page spanning (0,0)..(width,height). `cornerSize` is the width/height of each
 * grabbable corner box. All four corners report `corner`; the engine decides
 * which are actually grabbable for the current spread layout (LTR/RTL, cover).
 */
export function hitTest(point: Vec2, pageRect: PageRect, cornerSize: number): HitRegion {
  const { width, height } = pageRect;
  if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
    return 'outside';
  }
  const nearX = point.x <= cornerSize || point.x >= width - cornerSize;
  const nearY = point.y <= cornerSize || point.y >= height - cornerSize;
  return nearX && nearY ? 'corner' : 'page';
}
