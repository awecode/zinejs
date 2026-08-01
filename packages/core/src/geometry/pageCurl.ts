/**
 * Page-turn deformation (renderer-neutral, pure geometry).
 *
 * Models the turn the way flipbook-vue does. The leaf wraps around a cylinder whose
 * wrap angle `theta` grows 0 -> π over the first half of the flip while its radius
 * (= W/theta) shrinks, so the sheet rolls up off the surface in place. Over the second
 * half `theta` unwraps π -> 0 while the whole leaf rigidly rotates around the spine
 * (0 -> -π) down onto the far side. Arc length across the width is exactly preserved
 * (radius·theta = W), so it reads as real paper rolling and flopping over rather than a
 * rigid panel rotating on an axis.
 *
 * UVs are the static grid coordinates (no texture swimming); normals are computed from
 * the deformed positions so lighting and front/back facing are correct as the page rolls.
 */

export interface PageMesh {
  readonly cols: number;
  readonly rows: number;
  /** ((cols+1)*(rows+1))*2 — static grid UVs (u across width, v down height). */
  readonly uvs: Float32Array;
  /** *3 — deformed positions, updated by deformPageTurn. */
  readonly positions: Float32Array;
  /** *3 — per-vertex normals, updated by deformPageTurn. */
  readonly normals: Float32Array;
}

/** Allocate a (cols+1)×(rows+1) grid mesh with static UVs (positions/normals filled by deform). */
export function createPageMesh(cols: number, rows: number): PageMesh {
  const nx = cols + 1;
  const ny = rows + 1;
  const count = nx * ny;
  const uvs = new Float32Array(count * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      uvs[k * 2] = i / cols;
      uvs[k * 2 + 1] = j / rows;
    }
  }
  return {
    cols,
    rows,
    uvs,
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
  };
}

/**
 * Deform `mesh` in place for a leaf of size W×H turning around its spine (the x=0
 * edge). `t` is the flip progress in [0, 1]; x runs 0..W from spine to free edge, y
 * runs 0..H. Positions come out in leaf-local px with +z toward the viewer.
 */
export function deformPageTurn(mesh: PageMesh, W: number, H: number, t: number): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;

  // Wrap angle rolls 0 -> π (first half) then unwraps π -> 0 (second half); radius
  // = W/theta keeps the width arc length equal to W (inextensible).
  const theta = Math.max(1e-6, t < 0.5 ? t * 2 * Math.PI : (1 - (t - 0.5) * 2) * Math.PI);
  const radius = W / theta;
  // Rigid rotation about the spine: none while rolling up, then 0 -> -π onto the far side.
  const rot = t < 0.5 ? 0 : -(t - 0.5) * 2 * Math.PI;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  for (let i = 0; i < nx; i++) {
    const rad = (i / mesh.cols) * theta; // arc angle from the spine for this column
    const cx = Math.sin(rad) * radius; // position along the rolled sheet
    const cz = (1 - Math.cos(rad)) * radius; // lift off the surface
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

/** Per-vertex normals from central differences of the deformed grid (front = +z when flat). */
function computeNormals(mesh: PageMesh): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;
  const nrm = mesh.normals;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const iPrev = i > 0 ? i - 1 : i;
      const iNext = i < nx - 1 ? i + 1 : i;
      const jPrev = j > 0 ? j - 1 : j;
      const jNext = j < ny - 1 ? j + 1 : j;

      const a = (j * nx + iNext) * 3;
      const b = (j * nx + iPrev) * 3;
      const c = (jNext * nx + i) * 3;
      const e = (jPrev * nx + i) * 3;

      const tuX = pos[a]! - pos[b]!;
      const tuY = pos[a + 1]! - pos[b + 1]!;
      const tuZ = pos[a + 2]! - pos[b + 2]!;
      const tvX = pos[c]! - pos[e]!;
      const tvY = pos[c + 1]! - pos[e + 1]!;
      const tvZ = pos[c + 2]! - pos[e + 2]!;

      let nx0 = tuY * tvZ - tuZ * tvY;
      let ny0 = tuZ * tvX - tuX * tvZ;
      let nz0 = tuX * tvY - tuY * tvX;
      const l = Math.hypot(nx0, ny0, nz0) || 1;
      nx0 /= l;
      ny0 /= l;
      nz0 /= l;

      const k = (j * nx + i) * 3;
      nrm[k] = nx0;
      nrm[k + 1] = ny0;
      nrm[k + 2] = nz0;
    }
  }
}
