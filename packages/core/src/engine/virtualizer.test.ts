import { describe, it, expect } from 'vitest';
import { mountWindow, Virtualizer } from './virtualizer';

describe('mountWindow', () => {
  it('spans current ± radius', () => {
    expect(mountWindow(5, 20, 2)).toEqual([3, 4, 5, 6, 7]);
  });

  it('clamps to the start of the book', () => {
    expect(mountWindow(0, 20, 2)).toEqual([0, 1, 2]);
  });

  it('clamps to the end of the book', () => {
    expect(mountWindow(19, 20, 2)).toEqual([17, 18, 19]);
  });
});

describe('Virtualizer', () => {
  it('mounts the initial window with nothing to evict', () => {
    const v = new Virtualizer(2);
    expect(v.update(0, 20)).toEqual({ toMount: [0, 1, 2], toEvict: [] });
    expect(v.mounted).toEqual([0, 1, 2]);
  });

  it('mounts entrants and evicts leavers on a jump', () => {
    const v = new Virtualizer(2);
    v.update(0, 20); // mounted [0,1,2]
    const delta = v.update(5, 20); // window [3,4,5,6,7]
    expect(delta.toMount).toEqual([3, 4, 5, 6, 7]);
    expect(delta.toEvict).toEqual([0, 1, 2]);
    expect(v.mounted).toEqual([3, 4, 5, 6, 7]);
  });

  it('keeps overlap mounted when stepping by one', () => {
    const v = new Virtualizer(2);
    v.update(5, 20); // [3,4,5,6,7]
    const delta = v.update(6, 20); // [4,5,6,7,8]
    expect(delta.toMount).toEqual([8]);
    expect(delta.toEvict).toEqual([3]);
    expect(v.mounted).toEqual([4, 5, 6, 7, 8]);
  });

  it('is a no-op when the window does not change', () => {
    const v = new Virtualizer(2);
    v.update(5, 20);
    expect(v.update(5, 20)).toEqual({ toMount: [], toEvict: [] });
  });
});
