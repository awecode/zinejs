import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

const CREASE = 0.04; // crease radius as a fraction of width — small = a hard, flat fold
const DIAG = 0.6; // how far the dragged corner pulls toward the vertical centre mid-turn

/**
 * Flat origami fold. The tapped corner (`anchor.y`) is dragged across the spine; the
 * sheet folds along the perpendicular bisector of corner→pointer, reflecting the corner
 * region flat over the rest with a tight rounded crease. Off-centre taps give a diagonal
 * fold; the fold sweeps to the spine and the page lands (near) flat on the far side.
 */
export function deformFold(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;
  const r = Math.max(1e-4, CREASE * W);

  const cy = anchor.y * H;
  const px = W - 2 * W * t; // corner sweeps free edge -> across the spine
  const py = cy + (0.5 * H - cy) * DIAG * Math.sin(Math.PI * t);
  const dx = W - px; // corner - pointer
  const dy = cy - py;
  const len = Math.hypot(dx, dy);

  if (len < 1e-4) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3;
        pos[k] = (i / mesh.cols) * W;
        pos[k + 1] = (j / mesh.rows) * H;
        pos[k + 2] = 0;
      }
    }
    computeNormals(mesh);
    return;
  }

  const nX = dx / len; // toward the corner (fold "past" direction)
  const nY = dy / len;
  const fX = -nY; // along the fold line (preserved)
  const fY = nX;
  const midX = (W + px) / 2;
  const midY = (cy + py) / 2;

  for (let j = 0; j < ny; j++) {
    const y0 = (j / mesh.rows) * H;
    for (let i = 0; i < nx; i++) {
      const x0 = (i / mesh.cols) * W;
      const relX = x0 - midX;
      const relY = y0 - midY;
      const d = relX * nX + relY * nY; // signed distance past the fold (+ = corner side)
      const e = relX * fX + relY * fY; // position along the fold line
      const k = (j * nx + i) * 3;

      if (d <= 0) {
        pos[k] = x0;
        pos[k + 1] = y0;
        pos[k + 2] = 0;
        continue;
      }

      const theta = Math.min(d / r, Math.PI); // wrap the crease, then lie flat
      const extra = Math.max(0, d - r * Math.PI);
      const nComp = r * Math.sin(theta) - extra;
      pos[k] = midX + fX * e + nX * nComp;
      pos[k + 1] = midY + fY * e + nY * nComp;
      pos[k + 2] = r * (1 - Math.cos(theta));
    }
  }

  computeNormals(mesh);
}
