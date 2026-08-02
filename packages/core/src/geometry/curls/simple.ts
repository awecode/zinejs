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
