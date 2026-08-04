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

function maxAbsZ(mesh: PageMesh): number {
  let z = 0;
  for (let k = 2; k < mesh.positions.length; k += 3) z = Math.max(z, Math.abs(mesh.positions[k]!));
  return z;
}

describe('curl registry', () => {
  it('registers a model for every curl type', () => {
    expect(CURL_TYPES.sort()).toEqual(['cone', 'flick', 'leaf', 'roll', 'silk', 'simple']);
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
    expect(maxAbsZ(mesh)).toBeGreaterThan(1);
  });
});

describe.each(['roll', 'simple', 'cone', 'leaf', 'flick', 'silk'] as CurlType[])('symmetric curl lands flat: %s', (type) => {
  it('mirrors flat onto the far side at t=1', () => {
    const mesh = deformed(type, 1);
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 2);
      expect(x).toBeCloseTo(-((i / COLS) * W), 2);
    }
  });
});

describe('cone curl', () => {
  it('advances the anchored bottom corner ahead of the far corner', () => {
    // Early in the turn the leading free-edge corner has smaller x (further into the flop).
    const mesh = deformed('cone', 0.3);
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xBottom).toBeLessThan(xTop);
  });

  it('advances the anchored top corner ahead of the far corner', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.cone.deform(mesh, W, H, 0.3, { y: 0 });
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xTop).toBeLessThan(xBottom);
  });

  it('keeps more of the sheet over the page mid-turn on a full-width fill leaf', () => {
    // Fill delays the spine flop, so at mid-turn the free edge has advanced less than
    // the spread (non-fill) cone — the peel develops over the page before swinging off.
    const spread = createPageMesh(COLS, ROWS);
    const fill = createPageMesh(COLS, ROWS);
    CURLS.cone.deform(spread, W, H, 0.5, { y: 1 });
    CURLS.cone.deform(fill, W, H, 0.5, { y: 1, fill: true });
    const [xSpread] = vertex(spread, COLS, ROWS);
    const [xFill] = vertex(fill, COLS, ROWS);
    expect(xFill).toBeGreaterThan(xSpread + 2);
  });

  it('lands flat on a fill leaf at t=1', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.cone.deform(mesh, W, H, 1, { y: 1, fill: true });
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 2);
      expect(x).toBeCloseTo(-((i / COLS) * W), 2);
    }
  });

  it('still lets the grabbed corner lead on a fill leaf', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.cone.deform(mesh, W, H, 0.35, { y: 1, fill: true });
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xBottom).toBeLessThan(xTop);
  });
});

describe('leaf curl', () => {
  it('has flat paper on both sides of one finite rounded bend', () => {
    const mesh = deformed('leaf', 0.5);
    const mid = Math.floor(ROWS / 2);
    let untouched = 0;
    let curved = 0;
    let turned = 0;
    let maxZ = 0;
    for (let i = 0; i <= COLS; i++) {
      const [, , z] = vertex(mesh, i, mid);
      maxZ = Math.max(maxZ, z);
    }
    for (let i = 0; i <= COLS; i++) {
      const [, , z] = vertex(mesh, i, mid);
      if (Math.abs(z) < 1e-3) untouched++;
      else if (Math.abs(z - maxZ) < 1e-3) turned++;
      else curved++;
    }
    expect(untouched).toBeGreaterThan(2);
    expect(curved).toBeGreaterThan(2);
    expect(turned).toBeGreaterThan(2);
  });

  it('preserves row length while wrapping the paper', () => {
    const mesh = deformed('leaf', 0.5);
    const mid = Math.floor(ROWS / 2);
    let length = 0;
    for (let i = 1; i <= COLS; i++) {
      const a = vertex(mesh, i - 1, mid);
      const b = vertex(mesh, i, mid);
      length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    expect(length).toBeGreaterThan(W * 0.99);
    expect(length).toBeLessThanOrEqual(W * 1.001);
  });

  it('lets the grabbed bottom corner lead the opposite corner', () => {
    const mesh = deformed('leaf', 0.35);
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xBottom).toBeLessThan(xTop);
  });

  it('mirrors the ruling tilt for a top-corner grab', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.leaf.deform(mesh, W, H, 0.35, { y: 0 });
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xTop).toBeLessThan(xBottom);
  });
});

describe('flick curl', () => {
  it('trails the rigid rotation while the turn accelerates', () => {
    // First half: inertia bends the free edge behind the spine rotation, so the
    // tip sits at a smaller rotation angle (larger x) than the rigid `simple` turn.
    const flick = deformed('flick', 0.3);
    const simple = deformed('simple', 0.3);
    const [xFlick] = vertex(flick, COLS, ROWS);
    const [xSimple] = vertex(simple, COLS, ROWS);
    expect(xFlick).toBeGreaterThan(xSimple + 1);
  });

  it('follows through past the rigid rotation while the turn decelerates', () => {
    // Second half: the sign of the angular acceleration flips, so the free edge
    // overtakes the rigid rotation before settling (follow-through).
    const flick = deformed('flick', 0.7);
    const simple = deformed('simple', 0.7);
    const [xFlick] = vertex(flick, COLS, ROWS);
    const [xSimple] = vertex(simple, COLS, ROWS);
    expect(xFlick).toBeLessThan(xSimple - 1);
  });

  it('passes through a straight sheet at peak speed mid-turn', () => {
    // ρ̈ = 0 at t = 0.5, so the inertial bend vanishes and the page is momentarily flat.
    const mesh = deformed('flick', 0.5);
    const mid = Math.floor(ROWS / 2);
    for (let i = 0; i <= COLS; i++) {
      const [x] = vertex(mesh, i, mid);
      expect(x).toBeCloseTo(0, 3);
    }
  });

  it('never stretches the paper', () => {
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const mesh = deformed('flick', t);
      const mid = Math.floor(ROWS / 2);
      let length = 0;
      for (let i = 1; i <= COLS; i++) {
        const a = vertex(mesh, i - 1, mid);
        const b = vertex(mesh, i, mid);
        length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      }
      expect(length).toBeGreaterThan(W * 0.999);
      expect(length).toBeLessThanOrEqual(W * 1.001);
    }
  });

  it('makes rows far from the grabbed bottom corner lag hardest', () => {
    const mesh = deformed('flick', 0.3);
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xTop).toBeGreaterThan(xBottom);
  });

  it('mirrors the diagonal lag for a top-corner grab', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.flick.deform(mesh, W, H, 0.3, { y: 0 });
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xBottom).toBeGreaterThan(xTop);
  });
});

describe('silk curl', () => {
  /** Segment tangent angles along a row (atan2 of successive edges). */
  function rowTangents(mesh: PageMesh, row: number): number[] {
    const out: number[] = [];
    for (let i = 1; i <= COLS; i++) {
      const a = vertex(mesh, i - 1, row);
      const b = vertex(mesh, i, row);
      out.push(Math.atan2(b[2] - a[2], b[0] - a[0]));
    }
    return out;
  }

  it('forms an S-curve mid-turn (tangent deviations change sign)', () => {
    // Unlike flick (straight sheet at t=0.5) and leaf (single-sign bend zone),
    // silk's sin(2πu) mode makes the tangent oscillate about the spine angle.
    const mesh = deformed('silk', 0.5);
    const mid = Math.floor(ROWS / 2);
    const tangents = rowTangents(mesh, mid);
    const rho = Math.PI / 2;
    let sawPos = false;
    let sawNeg = false;
    for (const th of tangents) {
      let d = th - rho;
      // unwrap into (−π, π]
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      if (d > 0.04) sawPos = true;
      if (d < -0.04) sawNeg = true;
    }
    expect(sawPos).toBe(true);
    expect(sawNeg).toBe(true);
  });

  it('is not a straight cantilever at mid-turn (unlike flick)', () => {
    const silk = deformed('silk', 0.5);
    const flick = deformed('flick', 0.5);
    const mid = Math.floor(ROWS / 2);
    // flick is edge-on and straight: every vertex sits near x=0.
    for (let i = 0; i <= COLS; i++) {
      const [xF] = vertex(flick, i, mid);
      expect(Math.abs(xF)).toBeLessThan(1);
    }
    // silk's S pushes material off the spine plane — free edge leaves x=0.
    const [xSilk] = vertex(silk, COLS, mid);
    expect(Math.abs(xSilk)).toBeGreaterThan(5);
  });

  it('has no large flat untouched region mid-turn (unlike leaf)', () => {
    // leaf keeps a strip of front-facing paper at z≈0 ahead of its wave.
    // silk is spine-driven: the whole strip is rotating, so z rises across the row.
    const silk = deformed('silk', 0.5);
    const leaf = deformed('leaf', 0.5);
    const mid = Math.floor(ROWS / 2);
    let silkFlat = 0;
    let leafFlat = 0;
    for (let i = 0; i <= COLS; i++) {
      if (Math.abs(vertex(silk, i, mid)[2]!) < 1e-3) silkFlat++;
      if (Math.abs(vertex(leaf, i, mid)[2]!) < 1e-3) leafFlat++;
    }
    expect(leafFlat).toBeGreaterThan(2);
    expect(silkFlat).toBeLessThanOrEqual(2);
  });

  it('preserves row length (isometric strip)', () => {
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const mesh = deformed('silk', t);
      const mid = Math.floor(ROWS / 2);
      let length = 0;
      for (let i = 1; i <= COLS; i++) {
        const a = vertex(mesh, i - 1, mid);
        const b = vertex(mesh, i, mid);
        length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      }
      expect(length).toBeGreaterThan(W * 0.999);
      expect(length).toBeLessThanOrEqual(W * 1.001);
    }
  });

  it('lets the grabbed bottom corner lead the opposite corner', () => {
    const mesh = deformed('silk', 0.3);
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xBottom).toBeLessThan(xTop);
  });

  it('mirrors the corner lead for a top-corner grab', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.silk.deform(mesh, W, H, 0.3, { y: 0 });
    const [xBottom] = vertex(mesh, COLS, ROWS);
    const [xTop] = vertex(mesh, COLS, 0);
    expect(xTop).toBeLessThan(xBottom);
  });

  it('delays the flop on a full-width fill leaf', () => {
    const spread = createPageMesh(COLS, ROWS);
    const fill = createPageMesh(COLS, ROWS);
    CURLS.silk.deform(spread, W, H, 0.45, { y: 1 });
    CURLS.silk.deform(fill, W, H, 0.45, { y: 1, fill: true });
    // Delayed ρ keeps the free edge further forward (larger x) on fill.
    const [xSpread] = vertex(spread, COLS, ROWS);
    const [xFill] = vertex(fill, COLS, ROWS);
    expect(xFill).toBeGreaterThan(xSpread + 1);
  });

  it('lands flat on a fill leaf at t=1', () => {
    const mesh = createPageMesh(COLS, ROWS);
    CURLS.silk.deform(mesh, W, H, 1, { y: 1, fill: true });
    for (let i = 0; i <= COLS; i++) {
      const [x, , z] = vertex(mesh, i, 0);
      expect(z).toBeCloseTo(0, 2);
      expect(x).toBeCloseTo(-((i / COLS) * W), 2);
    }
  });
});

// The lone-page turn reuses this same roll; the renderer dissolves the leaf as it lands rather
// than swapping in a different deform, so there is no fill-specific geometry to cover here.
