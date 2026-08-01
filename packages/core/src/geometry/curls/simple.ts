import { computeNormals, type PageMesh } from './mesh';

/**
 * Rotate-and-bend cylinder — the simplest smooth page turn. The leaf rotates
 * continuously around the spine (angle 0→π) while bending into a cylinder whose
 * curvature peaks edge-on at t=0.5 and vanishes flat at both ends, so the whole sheet
 * turns and bends at once.
 */
export function deformSimple(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  const angle = t * Math.PI;
  const bend = Math.sin(t * Math.PI) * 1.5;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const arc = bend > 0.001;
  const radius = W / (arc ? bend : 1);

  for (let i = 0; i < nx; i++) {
    const u = i / mesh.cols;
    let xw: number;
    let zw: number;
    if (arc) {
      const phi = u * bend;
      xw = Math.sin(phi) * radius;
      zw = (1 - Math.cos(phi)) * radius;
    } else {
      xw = u * W;
      zw = 0;
    }
    const X = xw * cosA - zw * sinA;
    const Z = xw * sinA + zw * cosA;
    for (let j = 0; j < ny; j++) {
      const k = (j * nx + i) * 3;
      pos[k] = X;
      pos[k + 1] = (j / mesh.rows) * H;
      pos[k + 2] = Z;
    }
  }

  computeNormals(mesh);
}
