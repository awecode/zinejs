import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

/**
 * Peak S-curve amplitude in radians. Mid-turn the tangent oscillates about the
 * spine angle so the cross-section forms a true inflection (two opposite bends).
 * ~30° reads as thick stock turned by hand, not a knife crease.
 */
const S_AMP = 0.52;

/**
 * Early free-edge peel lead in radians. The grabbed tip lifts ahead of the body
 * — first motion of a careful hand turn. Strongest near t≈0.35, gone by rest.
 */
const PEEL_LEAD = 0.62;

/**
 * How much rows far from the grab trail the driven corner (0 = rigid across height).
 * Builds the soft diagonal of a corner-led hand turn.
 */
const ROW_LAG = 0.5;

/**
 * Power on spine progress for full-width lone pages. >1 delays the flop so the
 * S develops over the sheet before the leaf dissolves off the edge hinge.
 */
const FILL_RHO_POWER = 1.12;

/**
 * Silk — hand-turned S-curve page.
 *
 * This is not a traveling contact wave (`leaf`), not a cone wrap (`cone`), not a
 * cylinder roll (`roll`), and not a single-mode inertial cantilever (`flick`).
 *
 * Real paper turned by hand takes an S-shaped cross-section: a main bend through
 * the near half and a reverse bend through the far half (the flap over the
 * fingers). The sheet is a developable strip clamped at the spine and driven
 * through a base rotation ρ(t) = πt. Along the width the tangent is:
 *
 *   θ(u) = ρ + env·S·sin(2πu) + peel(t)·u²
 *
 * where:
 *  - sin(2πu) is a full-period S (zero net at spine and free edge, opposite
 *    bends in the two halves) — a true inflection that none of the other
 *    models produce mid-turn,
 *  - u² is an early peel lead that lifts the free edge first, then releases.
 *
 * env = sin(πt) holds the S through the middle and forces exact flat rests.
 * Rows far from the tap lag so a corner grab draws a living diagonal.
 * Arc length is integrated with the unit tangent (trapezoid per grid cell), so
 * the paper never stretches.
 */
export function deformSilk(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const cols = mesh.cols;
  const pos = mesh.positions;
  const ds = W / cols;
  const fill = !!anchor.fill;

  // Exact rests: shaping terms vanish with env, but pin the mesh explicitly.
  if (t <= 1e-7 || t >= 1 - 1e-7) {
    const side = t < 0.5 ? 1 : -1;
    for (let j = 0; j < ny; j++) {
      const y = (j / mesh.rows) * H;
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3;
        pos[k] = side * (i / mesh.cols) * W;
        pos[k + 1] = y;
        pos[k + 2] = 0;
      }
    }
    computeNormals(mesh);
    return;
  }

  // Spine rotation. On a fill leaf, delay slightly so the S develops on-page.
  const rhoT = fill ? Math.pow(t, FILL_RHO_POWER) : t;
  const rho = Math.PI * rhoT;

  // S envelope: 0 at rests, full through the middle third.
  const env = Math.pow(Math.sin(Math.PI * t), 0.8);
  const sAmp = S_AMP * env;

  // Early peel lead on the free edge: peaks before mid-turn, zero at both rests.
  // sin(πt)·(1−t) peaks near t≈0.35 — corner lifts while the body catches up.
  const peelAmp = PEEL_LEAD * Math.sin(Math.PI * t) * (1 - t);

  for (let j = 0; j < ny; j++) {
    const v = j / mesh.rows;
    const y = v * H;
    // Grabbed row is driven hardest; far rows trail (soft diagonal).
    const rowLead = 1 - ROW_LAG * Math.abs(v - anchor.y);
    const rowS = sAmp * (0.75 + 0.25 * rowLead);
    const rowPeel = peelAmp * rowLead;

    let x = 0;
    let z = 0;
    let cosPrev = Math.cos(rho);
    let sinPrev = Math.sin(rho);
    pos[j * nx * 3] = 0;
    pos[j * nx * 3 + 1] = y;
    pos[j * nx * 3 + 2] = 0;

    for (let i = 1; i < nx; i++) {
      const u = i / cols;
      // S inflection + early free-edge peel. Spine (u=0) is exactly ρ.
      const theta = rho + rowS * Math.sin(2 * Math.PI * u) + rowPeel * u * u;
      const cosCur = Math.cos(theta);
      const sinCur = Math.sin(theta);
      x += 0.5 * (cosPrev + cosCur) * ds;
      z += 0.5 * (sinPrev + sinCur) * ds;
      cosPrev = cosCur;
      sinPrev = sinCur;

      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
    }
  }

  computeNormals(mesh);
}
