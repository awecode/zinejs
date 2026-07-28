// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type { PageContent } from './renderer/types';

class FakeSource implements Source {
  readonly pageCount: number;
  readonly getCalls: number[] = [];
  readonly prefetched: number[] = [];
  destroyed = false;

  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(index: number): Promise<PageContent> {
    this.getCalls.push(index);
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    return canvas;
  }
  prefetch(indices: number[]): void {
    this.prefetched.push(...indices);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function container(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

describe('Zine — slice 1 (construct → mount → first spread)', () => {
  it('mounts a renderer and paints the first spread', async () => {
    const el = container();
    const source = new FakeSource(4);
    const zine = new Zine(el, { source, renderer: 'css' });
    await zine.ready;

    expect(el.querySelector('.zine-viewport')).not.toBeNull();
    expect(source.getCalls).toContain(0);
    expect(source.getCalls).toContain(1); // spread 0 = pages 0 and 1
  });

  it('reports page count and current page', async () => {
    const el = container();
    const zine = new Zine(el, { source: new FakeSource(4), renderer: 'css' });
    await zine.ready;
    expect(zine.getPageCount()).toBe(4);
    expect(zine.getPage()).toBe(0);
  });

  it('opens on startPage, resolving the spread that contains it', async () => {
    const el = container();
    const source = new FakeSource(4);
    const zine = new Zine(el, { source, renderer: 'css', startPage: 2 });
    await zine.ready;
    expect(zine.getPage()).toBe(2);
    expect(source.getCalls).toContain(2);
    expect(source.getCalls).toContain(3); // spread 1 = pages 2 and 3
  });

  it('emits ready', async () => {
    const el = container();
    const zine = new Zine(el, { source: new FakeSource(2), renderer: 'css' });
    const onReady = vi.fn();
    zine.on('ready', onReady);
    await zine.ready;
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('prefetches the surrounding spread window', async () => {
    const el = container();
    const source = new FakeSource(4); // spreads: [0,1] and [2,3]
    const zine = new Zine(el, { source, renderer: 'css' });
    await zine.ready;
    expect(source.prefetched).toContain(2);
    expect(source.prefetched).toContain(3);
  });

  it('tears down renderer and source on destroy', async () => {
    const el = container();
    const source = new FakeSource(4);
    const zine = new Zine(el, { source, renderer: 'css' });
    await zine.ready;
    zine.destroy();
    expect(source.destroyed).toBe(true);
    expect(el.querySelector('.zine-viewport')).toBeNull();
  });
});
