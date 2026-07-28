import { describe, it, expect, vi } from 'vitest';
import { PinchRecognizer } from './input';

describe('PinchRecognizer', () => {
  it('starts pinching when the second pointer goes down', () => {
    const start = vi.fn();
    const rec = new PinchRecognizer({ onPinchStart: start });
    rec.down(1, 0, 0);
    expect(rec.pinching).toBe(false);
    rec.down(2, 0, 10);
    expect(rec.pinching).toBe(true);
    expect(start).toHaveBeenCalledWith({ centerX: 0, centerY: 5, distance: 10 });
  });

  it('reports scale relative to the start distance and the live center', () => {
    const move = vi.fn();
    const rec = new PinchRecognizer({ onPinchMove: move });
    rec.down(1, 0, 0);
    rec.down(2, 0, 10); // start distance 10
    rec.move(2, 0, 20); // distance 20
    expect(move).toHaveBeenLastCalledWith({ centerX: 0, centerY: 10, scale: 2 });
    rec.move(2, 0, 5); // distance 5
    expect(move).toHaveBeenLastCalledWith({ centerX: 0, centerY: 2.5, scale: 0.5 });
  });

  it('ends the pinch when a pointer lifts', () => {
    const end = vi.fn();
    const rec = new PinchRecognizer({ onPinchEnd: end });
    rec.down(1, 0, 0);
    rec.down(2, 0, 10);
    rec.up(1);
    expect(end).toHaveBeenCalledTimes(1);
    expect(rec.pinching).toBe(false);
  });

  it('never pinches with a single pointer', () => {
    const start = vi.fn();
    const move = vi.fn();
    const rec = new PinchRecognizer({ onPinchStart: start, onPinchMove: move });
    rec.down(1, 0, 0);
    rec.move(1, 50, 50);
    expect(start).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
  });

  it('ignores a third pointer', () => {
    const start = vi.fn();
    const rec = new PinchRecognizer({ onPinchStart: start });
    rec.down(1, 0, 0);
    rec.down(2, 0, 10);
    rec.down(3, 100, 100); // ignored
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('ends the pinch on cancel', () => {
    const end = vi.fn();
    const rec = new PinchRecognizer({ onPinchEnd: end });
    rec.down(1, 0, 0);
    rec.down(2, 0, 10);
    rec.cancel(2);
    expect(end).toHaveBeenCalledTimes(1);
    expect(rec.pinching).toBe(false);
  });
});
