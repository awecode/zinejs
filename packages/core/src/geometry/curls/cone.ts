import { computeNormals, type PageMesh } from './mesh';
import type { CurlAnchor } from './types';

/**
 * Cone angle at peak curl. π/2 is flat; smaller values wind the sheet tighter.
 * ~30° gives a soft, paper-like ridge without self-intersection on typical page
 * aspect ratios (Hong / Nuon / Project Austin all land in the 18–35° band).
 */
const THETA_MIN = (30 * Math.PI) / 180;
/** Gentler opening for full-width lone pages — a tight cone reads as a funnel when
 *  the leaf owns the whole viewport and hinges at the edge. */
const THETA_MIN_FILL = (44 * Math.PI) / 180;

/**
 * How far past the page the cone apex sits, as a fraction of height, at rest.
 * Closer mid-turn sharpens the diagonal; farther reads more cylindrical.
 * Kept moderately distant so the sheet stays page-like without cloth-y sliding.
 */
const APEX_REST = 1.35;
const APEX_PEAK = 0.7;
/** Farther apex on fill: softer diagonal, less cloth-y twist across the full leaf. */
const APEX_REST_FILL = 1.85;
const APEX_PEAK_FILL = 1.15;

/**
 * Above this |anchor.y − 0.5| the deform is a pure cone; at the mid-edge it
 * blends fully to a cylinder (Project Austin’s conicContribution).
 */
const CORNER_PURE = 0.42;

/**
 * Power on fill flop progress. Slightly >1 delays spine rotation so the cone develops
 * over the page before the leaf swings past the edge hinge — kept close to 1 so the
 * flop isn't packed into a late whip (lone pages dissolve rather than land).
 */
const FILL_RHO_POWER = 1.08;

/**
 * Curl envelope ends before t=1 so the last stretch is a flat spine settle.
 * Holding sin(πt) curl into the 0.9s left a tall residual ridge that deflated
 * while the free edge was already nearly home — that read as a rebound bounce.
 */
const CURL_END = 0.84;

/**
 * Spine rotation reaches ±π before t=1 and holds. Flip easing decelerates hard into
 * the end (a near-still tail after PAGE_LEAD); finishing the flop early keeps that
 * tail from slowly dropping the leaf into place (the settle/rebound feel).
 */
const RHO_END = 0.88;

/**
 * Natural conical page curl — the Xerox PARC / iBooks model.
 *
 * The leaf wraps an imaginary right circular cone whose apex rides the spine and
 * whose opening angle θ breathes over the turn (Hong, Card & Chen, 2004). A corner
 * grab yields a diagonal cone; a mid-edge grab blends toward a cylinder so the
 * free edge lifts as one. The curled sheet then rotates about the spine and settles
 * flat on the far side. Arc length from the apex is preserved, so the paper never
 * stretches — the motion reads as stiff, premium stock rather than cloth.
 *
 * On a full-width lone page (`anchor.fill`) the hinge is the container edge with no
 * facing half to land on: the cone softens, the flop is delayed so the peel stays
 * over the page longer, and the renderer dissolves the sheet as it finishes.
 */
export function deformCone(mesh: PageMesh, W: number, H: number, t: number, anchor: CurlAnchor): void {
  const nx = mesh.cols + 1;
  const ny = mesh.rows + 1;
  const pos = mesh.positions;
  const fill = !!anchor.fill;

  // Curl envelope: 0 at the ends (flat), 1 near mid-turn. Span ends at CURL_END
  // so the ridge is gone before the spine holds the landed pose through the ease tail.
  const curlT = t >= CURL_END ? 1 : t / CURL_END;
  const curl = Math.sin(Math.PI * curlT);

  // θ: π/2 (identity) → THETA_MIN (pronounced curl) → π/2.
  const thetaMin = fill ? THETA_MIN_FILL : THETA_MIN;
  const theta = Math.PI / 2 - curl * (Math.PI / 2 - thetaMin);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const invSinTheta = 1 / Math.max(sinTheta, 1e-6);

  // Apex distance: pulled in as the curl develops for a tighter diagonal.
  const apexRest = fill ? APEX_REST_FILL : APEX_REST;
  const apexPeak = fill ? APEX_PEAK_FILL : APEX_PEAK;
  const apexDist = H * (apexRest + (apexPeak - apexRest) * curl);

  // Corner bias: −1 = top edge, +1 = bottom. Near 0 → cylinder blend.
  const bias = (anchor.y - 0.5) * 2;
  const fromBottom = bias >= 0;
  const absBias = Math.abs(bias);
  let conic = Math.min(1, absBias / CORNER_PURE);
  const cylWeight = 1 - conic;

  // Cylinder radius matched to the cone’s free-edge cross-section (Austin), so
  // the blend is continuous as the grab slides from corner to mid-edge.
  // Apex sits past the *leading* edge (below for a bottom grab, above for top).
  const AyRef = fromBottom ? H + apexDist : -apexDist;
  const cylR = Math.hypot(W, 0.5 * H - AyRef);
  const cylRadius = Math.max(cylR * sinTheta, W / Math.PI);

  // Spine rotation: concurrent with the cone so the page flops while it curls.
  // Same x–z convention as `roll` (ρ: 0 → −π). On fill, delay the flop so the
  // peel develops over the page before the leaf swings past the edge hinge.
  // On a spread, finish by RHO_END and hold — the ease-out tail stays still.
  const rhoT = fill ? Math.pow(t, FILL_RHO_POWER) : Math.min(1, t / RHO_END);
  const rho = -Math.PI * rhoT;
  const cosR = Math.cos(rho);
  const sinR = Math.sin(rho);

  // Near the rests the cone is the identity plane. A finite-radius cylinder blend
  // still carries a tiny residual arc — skip it and rotate the flat sheet.
  if (curl < 1e-4) {
    for (let j = 0; j < ny; j++) {
      const y = (j / mesh.rows) * H;
      for (let i = 0; i < nx; i++) {
        const x0 = (i / mesh.cols) * W;
        const k = (j * nx + i) * 3;
        pos[k] = x0 * cosR;
        pos[k + 1] = y;
        pos[k + 2] = -x0 * sinR;
      }
    }
    computeNormals(mesh);
    return;
  }

  for (let j = 0; j < ny; j++) {
    const y0 = (j / mesh.rows) * H;
    for (let i = 0; i < nx; i++) {
      const x0 = (i / mesh.cols) * W;

      let cx = x0;
      let cy = y0;
      let cz = 0;

      if (conic > 1e-5) {
        // Canonical cone: apex above the page (A < 0) makes the *near* edge lead.
        // In our y-down leaf, that means the top. For a bottom grab we flip into
        // that space, deform, then flip back — one code path for both corners.
        const yIn = fromBottom ? H - y0 : y0;
        const A = -apexDist;
        const R = Math.hypot(x0, yIn - A);
        if (R > 1e-8) {
          const r = R * sinTheta;
          const beta = Math.asin(Math.min(1, Math.max(0, x0 / R))) * invSinTheta;
          const oneCos = 1 - Math.cos(beta);
          const yCone = R + A - r * oneCos * sinTheta;
          cx = r * Math.sin(beta);
          cy = fromBottom ? H - yCone : yCone;
          cz = r * oneCos * cosTheta;
        }
      }

      let bx = cx;
      let by = cy;
      let bz = cz;

      if (cylWeight > 1e-5) {
        const beta = x0 / cylRadius;
        const sx = cylRadius * Math.sin(beta);
        const sz = cylRadius * (1 - Math.cos(beta));
        bx = conic * cx + cylWeight * sx;
        by = conic * cy + cylWeight * y0;
        bz = conic * cz + cylWeight * sz;
      }

      const k = (j * nx + i) * 3;
      pos[k] = bx * cosR + bz * sinR;
      pos[k + 1] = by;
      pos[k + 2] = -bx * sinR + bz * cosR;
    }
  }

  computeNormals(mesh);
}
