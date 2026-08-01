import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

const LEAD = 0.7; // how far the anchored corner runs ahead of the far edge (diagonal peel)

/**
 * Diagonal corner peel. Each row runs the roll-and-flop, but rows near the tapped corner
 * (`anchor.y`) lead and rows far behind lag, so the sheet lifts from that corner and
 * sweeps across on a diagonal — a smooth 3D peel. Every row still reaches t=1 together,
 * so the page lands flat.
 */
export function deformPeel(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  for (let j = 0; j < ny; j++) {
    const v = j / mesh.rows;
    const d = Math.abs(v - anchor.y); // 0 at the tapped corner, up to 1 at the far edge
    const tRow = Math.min(1, Math.max(0, t * (1 + LEAD) - LEAD * d));

    const theta = Math.max(1e-6, tRow < 0.5 ? tRow * 2 * Math.PI : (1 - (tRow - 0.5) * 2) * Math.PI);
    const radius = W / theta;
    const rot = tRow < 0.5 ? 0 : -(tRow - 0.5) * 2 * Math.PI;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const y = v * H;

    for (let i = 0; i < nx; i++) {
      const rad = (i / mesh.cols) * theta;
      const cx = Math.sin(rad) * radius;
      const cz = (1 - Math.cos(rad)) * radius;
      const k = (j * nx + i) * 3;
      pos[k] = cx * cosR + cz * sinR;
      pos[k + 1] = y;
      pos[k + 2] = -cx * sinR + cz * cosR;
    }
  }

  computeNormals(mesh);
}
