import { describe, it, expect } from 'vitest';
import { flipProgressToPose } from './flipProgressToPose';

describe('flipProgressToPose', () => {
  it('lies flat and shadowless at the start (t=0)', () => {
    const pose = flipProgressToPose(0);
    expect(pose.angle).toBe(0);
    expect(pose.curl).toBeCloseTo(0);
    expect(pose.shadowAlpha).toBeCloseTo(0);
  });

  it('is fully turned and flat at the end (t=1)', () => {
    const pose = flipProgressToPose(1);
    expect(pose.angle).toBeCloseTo(Math.PI);
    expect(pose.curl).toBeCloseTo(0);
    expect(pose.shadowAlpha).toBeCloseTo(0);
  });

  it('stands edge-on with peak curl/shadow at the midpoint (t=0.5)', () => {
    const pose = flipProgressToPose(0.5);
    expect(pose.angle).toBeCloseTo(Math.PI / 2);
    expect(pose.curl).toBeCloseTo(1);
    expect(pose.shadowAlpha).toBeCloseTo(1);
  });

  it('maps angle linearly in t (no easing baked in)', () => {
    expect(flipProgressToPose(0.25).angle).toBeCloseTo(Math.PI / 4);
    expect(flipProgressToPose(0.75).angle).toBeCloseTo((3 * Math.PI) / 4);
  });

  it('clamps out-of-range progress to [0,1]', () => {
    expect(flipProgressToPose(-1)).toEqual(flipProgressToPose(0));
    expect(flipProgressToPose(2)).toEqual(flipProgressToPose(1));
  });
});
