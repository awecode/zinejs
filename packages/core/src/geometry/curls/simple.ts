import { computeNormals, type PageMesh } from './mesh';

/**
 * Flat page turn — the plainest flip, matching the CSS renderer. The leaf stays a rigid
 * flat sheet and rotates around the spine (angle 0→π), going edge-on at the midpoint. No
 * cylinder bend; GPU-rendered here with the shared perspective so it reads like the CSS fold.
 */
export function deformSimple(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  const angle = t * Math.PI;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (let i = 0; i < nx; i++) {
    const x0 = (i / mesh.cols) * W; // distance from the spine
    const X = x0 * cosA;
    const Z = x0 * sinA;
    for (let j = 0; j < ny; j++) {
      const k = (j * nx + i) * 3;
      pos[k] = X;
      pos[k + 1] = (j / mesh.rows) * H;
      pos[k + 2] = Z;
    }
  }

  computeNormals(mesh);
}

/**
 * Bent page flip: the single-page (fill) form for spine curls whose spread shape assumes a
 * centered spine or a neighbour (roll). The leaf rotates about its spine edge (0→π) like the
 * flat turn, but the sheet also curves into a shallow arc that peaks mid-flip and flattens at
 * both ends, so the paper visibly bends as it turns instead of staying rigid. Reduces to the
 * flat turn when the bend is zero; arc length across the width is preserved.
 */
export function deformBentFlip(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  const phi = t * Math.PI; // spine rotation, 0 → π
  // Curl across the width, 0 at the ends. Deep enough that the sheet's facing varies across
  // its width, so the shared fold shading + glossy highlight ride across it as it turns.
  const bend = Math.max(1e-3, 1.6 * Math.sin(Math.PI * t));
  const R = W / bend; // arc radius: arc length W subtends `bend` radians
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  for (let i = 0; i < nx; i++) {
    const x0 = (i / mesh.cols) * W;
    const a = phi + bend * (x0 / W); // tangent angle at this column (spine → free edge)
    const X = R * (Math.sin(a) - sinPhi);
    const Z = R * (cosPhi - Math.cos(a));
    for (let j = 0; j < ny; j++) {
      const k = (j * nx + i) * 3;
      pos[k] = X;
      pos[k + 1] = (j / mesh.rows) * H;
      pos[k + 2] = Z;
    }
  }

  computeNormals(mesh);
}
