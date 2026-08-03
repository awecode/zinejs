import { computeNormals, type PageMesh } from './mesh';

/**
 * Roll-and-flop. The leaf wraps a cylinder whose wrap angle grows 0→π over the first
 * half while its radius (= W/theta) shrinks, so the sheet rolls up off the surface in
 * place; over the second half it unwraps π→0 while rigidly rotating around the spine
 * 0→-π down onto the far side. Arc length across the width is exactly preserved.
 */
export function deformRoll(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  const theta = Math.max(1e-6, t < 0.5 ? t * 2 * Math.PI : (1 - (t - 0.5) * 2) * Math.PI);
  const radius = W / theta;
  const rot = t < 0.5 ? 0 : -(t - 0.5) * 2 * Math.PI;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  for (let i = 0; i < nx; i++) {
    const rad = (i / mesh.cols) * theta;
    const cx = Math.sin(rad) * radius;
    const cz = (1 - Math.cos(rad)) * radius;
    const X = cx * cosR + cz * sinR;
    const Z = -cx * sinR + cz * cosR;
    for (let j = 0; j < ny; j++) {
      const k = (j * nx + i) * 3;
      pos[k] = X;
      pos[k + 1] = (j / mesh.rows) * H;
      pos[k + 2] = Z;
    }
  }

  computeNormals(mesh);
}

/** Peak curl (radians) reached at mid-flip by {@link deformLiftSettle}. π would wrap the leaf
 *  into a full half-cylinder (the spread roll's tightest point); a touch under that keeps it a
 *  pronounced lift rather than a closed tube. Raise toward π for more curl, lower for a gentler
 *  bow. */
const LIFT_WRAP = 2.6;

/** Smooth 0→1 ramp with zero slope at both ends (Hermite), so the settle eases in and out. */
function smoothstep(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/**
 * Lift-and-settle flip: the single-page (fill) form of {@link deformRoll}, whose spread shape
 * assumes a centered spine and a neighbouring half to flop onto. It mirrors the spread roll's
 * two-phase motion so a lone full-width sheet reads as paper instead of a rigid door swinging on
 * its hinge:
 *
 *  - First half — the chord stays flat on the surface while the sheet curls up off it in place,
 *    the free edge lifting and rolling back over the spine (rotation ρ = 0, curl β rising).
 *  - Second half — the sheet unrolls (β falling) as its chord swings over the spine edge (ρ: 0→π),
 *    settling flat on the far side and revealing the page beneath.
 *
 * Each column is a constant-curvature arc leaving the spine at angle ρ and bending by β to the
 * free edge, so arc length across the width is exactly preserved (R·β = W). Flat at both ends.
 */
export function deformLiftSettle(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  // Chord rotation: pinned flat through the lift, then eased 0→π through the settle.
  const rho = t < 0.5 ? 0 : Math.PI * smoothstep((t - 0.5) * 2);
  // Curl across the width: 0 at both ends, peaking mid-flip. Deep enough that the sheet's facing
  // swings across it, so the shared fold shading + glossy highlight ride over the paper.
  const beta = Math.max(1e-6, LIFT_WRAP * Math.sin(Math.PI * t));
  const R = W / beta; // arc radius: arc length W subtends β radians
  const sinRho = Math.sin(rho);
  const cosRho = Math.cos(rho);

  for (let i = 0; i < nx; i++) {
    const f = i / mesh.cols; // 0 at spine → 1 at free edge
    const a = rho + beta * f; // tangent angle at this column
    const X = R * (Math.sin(a) - sinRho);
    const Z = R * (cosRho - Math.cos(a));
    for (let j = 0; j < ny; j++) {
      const k = (j * nx + i) * 3;
      pos[k] = X;
      pos[k + 1] = (j / mesh.rows) * H;
      pos[k + 2] = Z;
    }
  }

  computeNormals(mesh);
}
