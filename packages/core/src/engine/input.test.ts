import { describe, it, expect, vi } from 'vitest';
import { PointerRecognizer, bindPointerInput, type GestureEnd } from './input';

describe('PointerRecognizer', () => {
  it('emits start → move → end for a single drag', () => {
    const start = vi.fn();
    const move = vi.fn();
    const end = vi.fn();
    const rec = new PointerRecognizer({ onStart: start, onMove: move, onEnd: end });

    rec.down(1, 10, 10, 0);
    rec.move(1, 30, 10, 10);
    rec.up(1, 30, 10, 20);

    expect(start).toHaveBeenCalledWith({ x: 10, y: 10, t: 0 });
    expect(move).toHaveBeenCalledWith({ x: 30, y: 10, dx: 20, dy: 0 });
    const end0 = end.mock.calls[0]?.[0] as GestureEnd;
    expect(end0.dx).toBe(20);
    expect(end0.dt).toBe(20);
    expect(end0.canceled).toBe(false);
  });

  it('flags a fast flick as a swipe', () => {
    const end = vi.fn();
    const rec = new PointerRecognizer({ onEnd: end });
    rec.down(1, 0, 0, 0);
    rec.move(1, 20, 0, 10); // 2 px/ms — well over the 0.3 threshold
    rec.up(1, 20, 0, 12);
    expect((end.mock.calls[0]?.[0] as GestureEnd).swipe).toBe(true);
  });

  it('does not flag a slow drag as a swipe', () => {
    const end = vi.fn();
    const rec = new PointerRecognizer({ onEnd: end });
    rec.down(1, 0, 0, 0);
    rec.move(1, 2, 0, 100); // 0.02 px/ms — under threshold
    rec.up(1, 2, 0, 200);
    expect((end.mock.calls[0]?.[0] as GestureEnd).swipe).toBe(false);
  });

  it('never swipes on cancel, even from a fast move', () => {
    const end = vi.fn();
    const rec = new PointerRecognizer({ onEnd: end });
    rec.down(1, 0, 0, 0);
    rec.move(1, 20, 0, 10);
    rec.cancel(1, 20, 0, 12);
    const g = end.mock.calls[0]?.[0] as GestureEnd;
    expect(g.canceled).toBe(true);
    expect(g.swipe).toBe(false);
  });

  it('tracks only the first pointer and ignores extra ones', () => {
    const move = vi.fn();
    const rec = new PointerRecognizer({ onMove: move });
    rec.down(1, 0, 0, 0);
    rec.down(2, 100, 100, 1); // second finger ignored
    rec.move(2, 200, 200, 2); // ignored
    rec.move(1, 5, 0, 3);
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith({ x: 5, y: 0, dx: 5, dy: 0 });
  });

  it('reports active only between down and up', () => {
    const rec = new PointerRecognizer();
    expect(rec.active).toBe(false);
    rec.down(1, 0, 0, 0);
    expect(rec.active).toBe(true);
    rec.up(1, 0, 0, 1);
    expect(rec.active).toBe(false);
  });
});

describe('bindPointerInput', () => {
  it('forwards pointer events from a target and unbinds cleanly', () => {
    const target = new EventTarget();
    const events: string[] = [];
    const rec = new PointerRecognizer({
      onStart: () => events.push('start'),
      onEnd: () => events.push('end'),
    });
    const unbind = bindPointerInput(target, rec);

    const fire = (type: string, props: Record<string, number>): void => {
      target.dispatchEvent(Object.assign(new Event(type), props));
    };
    fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    fire('pointerup', { pointerId: 1, clientX: 10, clientY: 10 });
    expect(events).toEqual(['start', 'end']);

    unbind();
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    expect(events).toEqual(['start', 'end']); // no new events after unbind
  });
});
