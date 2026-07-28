export interface FlipPose {
  /** Turning-page rotation about the spine, radians: 0 (flat/open) → π (fully turned). */
  angle: number;
  /** Mesh cylinder-wrap curl, 0..1 — flat at the ends, peaks edge-on at t=0.5. CSS renderer ignores it. */
  curl: number;
  /** Fold-shadow intensity, 0..1 — peaks edge-on at t=0.5. */
  shadowAlpha: number;
}

/**
 * Map a 0→1 flip progress to a renderer-neutral fold pose.
 *
 * Linear in `t` on purpose — easing belongs to the animator that produces `t`,
 * so seeking to a fixed progress (e.g. the 0/.25/.5/.75/1 visual-regression stops)
 * is deterministic. The CSS renderer consumes `angle` as a spine `rotateY`; the
 * Pixi renderer additionally bends its mesh by `curl`.
 */
export function flipProgressToPose(t: number): FlipPose {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const arc = Math.sin(clamped * Math.PI);
  return {
    angle: clamped * Math.PI,
    curl: arc,
    shadowAlpha: arc,
  };
}
