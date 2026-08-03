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

// roll's single-page (fill) variant: the lift-and-settle flip for a lone full-width sheet.
describe("roll fill variant (lift-and-settle)", () => {
  const fill = CURLS.roll.deformFill!;
  const fillMesh = (t: number): PageMesh => {
    const mesh = createPageMesh(COLS, ROWS);
    fill(mesh, W, H, t, ANCHOR);
    return mesh;
  };

  it('lies flat at the spine edge at t=0', () => {
    const mesh = fillMesh(0);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 2);
      expect(x).toBeCloseTo((i / COLS) * W, 2);
    }
  });

  it('mirrors flat onto the far side at t=1', () => {
    const mesh = fillMesh(1);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 1);
      expect(x).toBeCloseTo(-((i / COLS) * W), 1);
    }
  });

  it('keeps the chord flat through the lift, then swings it over', () => {
    const freeEdgeX = (t: number): number => vertex(fillMesh(t), COLS, 0)[0];
    // Phase 1 (lift): the sheet curls up in place, so the free edge stays on the near side
    // rather than sweeping across — it has not yet crossed back over the spine (x ≥ 0).
    expect(freeEdgeX(0.25)).toBeGreaterThan(-1);
    // Phase 2 (settle): the chord has swung over, carrying the free edge onto the far side.
    expect(freeEdgeX(0.75)).toBeLessThan(0);
  });

  it('lifts well off the surface mid-turn', () => {
    const mesh = fillMesh(0.5);
    let maxZ = 0;
    for (let k = 2; k < mesh.positions.length; k += 3) maxZ = Math.max(maxZ, Math.abs(mesh.positions[k]!));
    expect(maxZ).toBeGreaterThan(1);
  });

  it('produces finite, unit-length normals across the turn', () => {
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      const mesh = fillMesh(t);
      for (const v of mesh.positions) expect(Number.isNaN(v)).toBe(false);
      for (let k = 0; k < mesh.normals.length; k += 3) {
        const l = Math.hypot(mesh.normals[k]!, mesh.normals[k + 1]!, mesh.normals[k + 2]!);
        expect(l).toBeCloseTo(1, 3);
      }
    }
  });
});
