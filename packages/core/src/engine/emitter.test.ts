import { describe, it, expect, vi } from 'vitest';
import { Emitter } from './emitter';

interface TestEvents {
  ping: { n: number };
  ready: void;
}

describe('Emitter', () => {
  it('delivers the payload to a subscribed listener', () => {
    const e = new Emitter<TestEvents>();
    const fn = vi.fn();
    e.on('ping', fn);
    e.emit('ping', { n: 1 });
    expect(fn).toHaveBeenCalledWith({ n: 1 });
  });

  it('emits void events with no payload', () => {
    const e = new Emitter<TestEvents>();
    const fn = vi.fn();
    e.on('ready', fn);
    e.emit('ready');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fans out to every listener', () => {
    const e = new Emitter<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    e.on('ping', a);
    e.on('ping', b);
    e.emit('ping', { n: 2 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after the returned unsubscribe runs', () => {
    const e = new Emitter<TestEvents>();
    const fn = vi.fn();
    const off = e.on('ping', fn);
    off();
    e.emit('ping', { n: 3 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('off() removes a specific listener', () => {
    const e = new Emitter<TestEvents>();
    const fn = vi.fn();
    e.on('ping', fn);
    e.off('ping', fn);
    e.emit('ping', { n: 4 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('lets a listener unsubscribe itself mid-emit without disturbing others', () => {
    const e = new Emitter<TestEvents>();
    const order: string[] = [];
    const off = e.on('ping', () => {
      order.push('a');
      off();
    });
    e.on('ping', () => order.push('b'));
    e.emit('ping', { n: 5 });
    e.emit('ping', { n: 6 });
    expect(order).toEqual(['a', 'b', 'b']);
  });
});
