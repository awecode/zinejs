import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

/**
 * Peak inertial tip lag in radians (~30°). How far the free edge trails the
 * spine rotation at the height of the acceleration phase, and symmetrically how
 * far it follows through while the turn decelerates.
 */
const SWAY = 0.52;

/**
 * Extra lag for rows far from the grabbed corner (0 = whole edge moves as one).
 * The driven corner is held; the diagonal remainder of the sheet trails it.
 */
const LAG = 0.45;

/**
 * Inertial follow-through page flick.
 *
 * The leaf is a cantilever clamped at the spine and driven through a rotation
 * ρ(t) = πt. Paper inertia (the Euler force, ∝ −ρ̈) bends the sheet opposite the
 * angular acceleration with a first-mode-like profile — zero curvature at the
 * clamped spine, maximal at the free edge. Under an eased turn the acceleration
 * changes sign at mid-flight, so the free edge trails while the turn winds up,
 * swings through vertical, then overtakes and settles as the turn slows: the
 * follow-through/overlapping-action principle, grounded in base-rotated
 * cantilever dynamics. Tangent angles are integrated along the width, so the
 * sheet never stretches, and the curvature direction reversing over the turn is
 * what none of the wrap-style curls do.
 *
 * Rows far from the grabbed corner lag slightly more than the driven row, so a
 * corner grab pulls a soft living diagonal across the sheet.
 */
export function deformFlick(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const cols = mesh.cols;
  const pos = mesh.positions;
  const ds = W / cols;

  // Base rotation about the spine, 0 → π (same landing convention as `simple`).
  const rho = Math.PI * t;

  // Inertial amplitude ∝ −ρ̈ of an eased unit turn: the tip trails (negative)
  // while accelerating, leads (positive) while braking, and is zero at both
  // rests and at peak speed mid-turn.
  const amplitude = -SWAY * Math.sin(2 * Math.PI * t);

  for (let j = 0; j < ny; j++) {
    const v = j / mesh.rows;
    // The grabbed row is driven directly; distance from it adds trailing inertia.
    const rowAmplitude = amplitude * (1 + LAG * Math.abs(v - anchor.y));
    const y = v * H;

    // Integrate the unit tangent of θ(u) = ρ + A·u² across the width (trapezoid
    // per grid cell). u² is the first-mode tangent shape: clamped flat at the
    // spine, curving ever more freely toward the edge. Exact arc length.
    let x = 0;
    let z = 0;
    let cosPrev = Math.cos(rho);
    let sinPrev = Math.sin(rho);
    pos[(j * nx) * 3] = 0;
    pos[(j * nx) * 3 + 1] = y;
    pos[(j * nx) * 3 + 2] = 0;
    for (let i = 1; i < nx; i++) {
      const u = i / cols;
      const theta = rho + rowAmplitude * u * u;
      const cosCur = Math.cos(theta);
      const sinCur = Math.sin(theta);
      x += 0.5 * (cosPrev + cosCur) * ds;
      z += 0.5 * (sinPrev + sinCur) * ds;
      cosPrev = cosCur;
      sinPrev = sinCur;

      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
    }
  }

  computeNormals(mesh);
}
