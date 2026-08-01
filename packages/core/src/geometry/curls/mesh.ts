/**
 * Shared grid mesh + normal utilities for the page-curl models.
 *
 * A curl model fills `positions`/`normals` in place each frame; UVs are static grid
 * coordinates (no texture swimming). All models bend the same (cols+1)×(rows+1) grid.
 */

export interface PageMesh {
  readonly cols: number;
  readonly rows: number;
  /** ((cols+1)*(rows+1))*2 — static grid UVs (u across width, v down height). */
  readonly uvs: Float32Array;
  /** *3 — deformed positions, updated by the curl model. */
  readonly positions: Float32Array;
  /** *3 — per-vertex normals, updated by the curl model. */
  readonly normals: Float32Array;
}

/** Allocate a (cols+1)×(rows+1) grid mesh with static UVs (positions/normals filled by a curl). */
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

/** Per-vertex normals from central differences of the deformed grid (front = +z when flat). */
export function computeNormals(mesh: PageMesh): void {
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
