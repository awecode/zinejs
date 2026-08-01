import { describe, it, expect } from 'vitest';
import { createPageMesh, deformPageTurn, type PageMesh } from './pageCurl';

const COLS = 40;
const ROWS = 40;
const W = 400;
const H = 560;

function deformed(t: number): PageMesh {
  const mesh = createPageMesh(COLS, ROWS);
  deformPageTurn(mesh, W, H, t);
  return mesh;
}

function vertex(mesh: PageMesh, i: number, j: number): [number, number, number] {
  const k = (j * (mesh.cols + 1) + i) * 3;
  return [mesh.positions[k]!, mesh.positions[k + 1]!, mesh.positions[k + 2]!];
}

describe('createPageMesh', () => {
  it('lays out static grid UVs', () => {
    const mesh = createPageMesh(2, 2);
    expect(Array.from(mesh.uvs)).toEqual([0, 0, 0.5, 0, 1, 0, 0, 0.5, 0.5, 0.5, 1, 0.5, 0, 1, 0.5, 1, 1, 1]);
  });
});

describe('deformPageTurn', () => {
  it('lies flat on the near side at t=0', () => {
    const mesh = deformed(0);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 3);
      expect(x).toBeCloseTo((i / COLS) * W, 3);
    }
    for (let k = 0; k < mesh.normals.length; k += 3) {
      expect(mesh.normals[k + 2]).toBeCloseTo(1, 5); // front faces the viewer
    }
  });

  it('lands flat and mirrored on the far side at t=1', () => {
    const mesh = deformed(1);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 3);
      expect(x).toBeCloseTo(-((i / COLS) * W), 3); // spine stays put, free edge at -W
    }
    for (let k = 0; k < mesh.normals.length; k += 3) {
      expect(mesh.normals[k + 2]).toBeCloseTo(-1, 4); // now the back faces the viewer
    }
  });

  it('keeps UVs static (no texture swimming)', () => {
    const before = Float32Array.from(createPageMesh(COLS, ROWS).uvs);
    const mesh = deformed(0.5);
    expect(Array.from(mesh.uvs)).toEqual(Array.from(before));
  });

  it('is ~inextensible: every grid edge keeps its length mid-turn', () => {
    const mesh = deformed(0.5);
    const nx = mesh.cols + 1;
    const ny = mesh.rows + 1;
    const hx = W / mesh.cols;
    const hy = H / mesh.rows;
    let maxErr = 0;
    const dist = (a: [number, number, number], b: [number, number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p = vertex(mesh, i, j);
        if (i + 1 < nx) maxErr = Math.max(maxErr, Math.abs(dist(p, vertex(mesh, i + 1, j)) - hx) / hx);
        if (j + 1 < ny) maxErr = Math.max(maxErr, Math.abs(dist(p, vertex(mesh, i, j + 1)) - hy) / hy);
      }
    }
    expect(maxErr).toBeLessThan(0.03);
  });

  it('produces unit-length normals with no NaNs mid-turn', () => {
    const mesh = deformed(0.5);
    for (let k = 0; k < mesh.normals.length; k += 3) {
      const l = Math.hypot(mesh.normals[k]!, mesh.normals[k + 1]!, mesh.normals[k + 2]!);
      expect(Number.isNaN(l)).toBe(false);
      expect(l).toBeCloseTo(1, 4);
    }
    for (const v of mesh.positions) expect(Number.isNaN(v)).toBe(false);
  });

  it('rolls up off the surface before crossing the spine (two-phase turn)', () => {
    const spine = 0;
    const freeCol = COLS;
    const mid = Math.floor(ROWS / 2);
    // First half: rolled up in place — free edge lifted but still on the near side.
    const early = deformed(0.25);
    expect(vertex(early, spine, mid)[2]).toBeCloseTo(0, 3); // spine pinned
    expect(vertex(early, freeCol, mid)[2]).toBeGreaterThan(1); // free edge lifted
    expect(vertex(early, freeCol, mid)[0]).toBeGreaterThan(0); // not yet past the spine
    // Second half: rotated across — free edge now on the far side, still lifted.
    const late = deformed(0.75);
    expect(vertex(late, freeCol, mid)[0]).toBeLessThan(0);
    expect(vertex(late, freeCol, mid)[2]).toBeGreaterThan(1);
  });
});
