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
