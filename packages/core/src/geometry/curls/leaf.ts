import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

/** Peak material width occupied by the bending wave. */
const MAX_BEND_LENGTH = 0.34;

/** Maximum tilt of the rolling axis for a corner-led turn. */
const MAX_TILT = (11 * Math.PI) / 180;

const PROFILE_STEPS = 128;

/**
 * Unit-length raised-cosine curvature profile.
 *
 * κ(s) = π(1 - cos(2πs)), so its integrated tangent angle is
 * θ(s) = πs - ½sin(2πs). Curvature is exactly zero at both ends and integrates
 * to π: the incoming and outgoing planes are flat, opposite-facing, and meet
 * the bend without a crease. X/Z are arc-length integrals of cos(θ)/sin(θ).
 */
function makeProfile(): { x: Float64Array; z: Float64Array } {
  const x = new Float64Array(PROFILE_STEPS + 1);
  const z = new Float64Array(PROFILE_STEPS + 1);
  const ds = 1 / PROFILE_STEPS;
  const theta = (s: number): number => Math.PI * s - 0.5 * Math.sin(2 * Math.PI * s);
  for (let i = 1; i <= PROFILE_STEPS; i++) {
    const a = theta((i - 1) * ds);
    const b = theta(i * ds);
    x[i] = x[i - 1]! + 0.5 * (Math.cos(a) + Math.cos(b)) * ds;
    z[i] = z[i - 1]! + 0.5 * (Math.sin(a) + Math.sin(b)) * ds;
  }
  // Symmetry makes this analytically zero; remove accumulated floating-point drift.
  x[PROFILE_STEPS] = 0;
  return { x, z };
}

const PROFILE = makeProfile();
const PROFILE_HEIGHT = PROFILE.z[PROFILE_STEPS]!;

function sampleProfile(s: number): [x: number, z: number] {
  const p = Math.max(0, Math.min(1, s)) * PROFILE_STEPS;
  const i = Math.min(PROFILE_STEPS - 1, Math.floor(p));
  const f = p - i;
  return [
    PROFILE.x[i]! + (PROFILE.x[i + 1]! - PROFILE.x[i]!) * f,
    PROFILE.z[i]! + (PROFILE.z[i + 1]! - PROFILE.z[i]!) * f,
  ];
}

/**
 * Traveling smooth-curvature leaf curl.
 *
 * Inspired by rolling-cylinder page curls and modern developable-surface book
 * simulations, but with a compact raised-cosine curvature wave instead of a
 * constant-radius cylinder. The sheet has three regions:
 *
 *  1. untouched paper before the wave,
 *  2. an isometric bend whose curvature smoothly rises and falls,
 *  3. a flat, reflected flap after the wave.
 *
 * The wave travels from the free edge to just beyond the spine while its width grows
 * and collapses. Integrating a unit tangent preserves material length exactly; straight
 * ruling lines preserve distance along the curl axis. Curvature reaches zero at both
 * seams, eliminating the hard crease shared by circular/fold models.
 */
export function deformLeaf(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  // Exact rest poses avoid the tiny numerical ridge left by a vanishing wave.
  if (t <= 1e-7 || t >= 1 - 1e-7) {
    const side = t < 0.5 ? 1 : -1;
    for (let j = 0; j < ny; j++) {
      const y = (j / mesh.rows) * H;
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3;
        pos[k] = side * (i / mesh.cols) * W;
        pos[k + 1] = y;
        pos[k + 2] = 0;
      }
    }
    computeNormals(mesh);
    return;
  }

  // The wave broadens through the middle, then tightens as the leaf settles.
  const envelope = Math.pow(Math.sin(Math.PI * t), 0.72);
  const bendLength = Math.max(1e-6, W * MAX_BEND_LENGTH * envelope);

  // Bottom grabs tilt the ruling clockwise in page coordinates; top grabs mirror it.
  // The tilt fades at both rest states so the page lands exactly square.
  const anchorBias = Math.max(-1, Math.min(1, (anchor.y - 0.5) * 2));
  const tilt = anchorBias * MAX_TILT * Math.pow(Math.sin(Math.PI * t), 1.15);
  const nX = Math.cos(tilt);
  const nY = Math.sin(tilt);
  const fX = -nY;
  const fY = nX;

  // Place the axis outside the whole rectangle at t=0 and beyond the spine at t=1.
  // Accounting for tilt keeps every row in the correct physical region at the ends.
  const diagonalReach = Math.abs(nY) * H * 0.5;
  const startX = W + diagonalReach / nX;
  const endX = -(bendLength + diagonalReach) / nX;
  const axisX = startX + (endX - startX) * t;
  const axisY = H * 0.5;

  for (let j = 0; j < ny; j++) {
    const y0 = (j / mesh.rows) * H;
    for (let i = 0; i < nx; i++) {
      const x0 = (i / mesh.cols) * W;
      const relX = x0 - axisX;
      const relY = y0 - axisY;
      const d = relX * nX + relY * nY;
      const e = relX * fX + relY * fY;
      const k = (j * nx + i) * 3;

      if (d <= 0) {
        // The wave has not reached this point: untouched front-facing paper.
        pos[k] = x0;
        pos[k + 1] = y0;
        pos[k + 2] = 0;
        continue;
      }

      let normalDistance: number;
      let z: number;
      if (d < bendLength) {
        // Scale the unit arc-length profile by the material width of this wave.
        const [profileX, profileZ] = sampleProfile(d / bendLength);
        normalDistance = bendLength * profileX;
        z = bendLength * profileZ;
      } else {
        // The tangent has rotated by π; paper leaves the wave flat and reversed.
        normalDistance = -(d - bendLength);
        z = bendLength * PROFILE_HEIGHT;
      }

      pos[k] = axisX + fX * e + nX * normalDistance;
      pos[k + 1] = axisY + fY * e + nY * normalDistance;
      pos[k + 2] = z;
    }
  }

  computeNormals(mesh);
}
