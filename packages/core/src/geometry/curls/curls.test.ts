import { describe, it, expect } from 'vitest';
import { CURLS, CURL_TYPES, createPageMesh, type CurlType, type PageMesh } from './index';

const COLS = 40;
const ROWS = 40;
const W = 400;
const H = 560;
const ANCHOR = { y: 1 };

function deformed(type: CurlType, t: number): PageMesh {
  const mesh = createPageMesh(COLS, ROWS);
  CURLS[type].deform(mesh, W, H, t, ANCHOR);
  return mesh;
}

function vertex(mesh: PageMesh, i: number, j: number): [number, number, number] {
  const k = (j * (mesh.cols + 1) + i) * 3;
  return [mesh.positions[k]!, mesh.positions[k + 1]!, mesh.positions[k + 2]!];
}

describe('curl registry', () => {
  it('registers a model for every curl type', () => {
    expect(CURL_TYPES.sort()).toEqual(['fold', 'peel', 'roll', 'simple']);
    for (const type of CURL_TYPES) {
      expect(typeof CURLS[type].deform).toBe('function');
    }
  });
});

describe.each(CURL_TYPES)('curl model: %s', (type) => {
  it('lies flat at t=0', () => {
    const mesh = deformed(type, 0);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 3);
      expect(x).toBeCloseTo((i / COLS) * W, 3);
    }
  });

  it('keeps UVs static (no texture swimming)', () => {
    const before = Float32Array.from(createPageMesh(COLS, ROWS).uvs);
    const mesh = deformed(type, 0.5);
    expect(Array.from(mesh.uvs)).toEqual(Array.from(before));
  });

  it('produces finite, unit-length normals across the turn', () => {
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      const mesh = deformed(type, t);
      for (const v of mesh.positions) expect(Number.isNaN(v)).toBe(false);
      for (let k = 0; k < mesh.normals.length; k += 3) {
        const l = Math.hypot(mesh.normals[k]!, mesh.normals[k + 1]!, mesh.normals[k + 2]!);
        expect(l).toBeCloseTo(1, 3);
      }
    }
  });

  it('lifts the leaf off the surface mid-turn', () => {
    const mesh = deformed(type, 0.5);
    let maxZ = 0;
    for (let k = 2; k < mesh.positions.length; k += 3) maxZ = Math.max(maxZ, Math.abs(mesh.positions[k]!));
    expect(maxZ).toBeGreaterThan(1);
  });
});

describe.each(['roll', 'simple'] as CurlType[])('symmetric curl lands flat: %s', (type) => {
  it('mirrors flat onto the far side at t=1', () => {
    const mesh = deformed(type, 1);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 2);
      expect(x).toBeCloseTo(-((i / COLS) * W), 2);
    }
  });
});

// The lone-page turn reuses this same roll; the renderer dissolves the leaf as it lands rather
// than swapping in a different deform, so there is no fill-specific geometry to cover here.
