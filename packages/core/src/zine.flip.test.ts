import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine } from './zine';
import type { Source } from './source/types';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  SpreadContent,
} from './renderer/types';
import type { Spread } from './engine/spread';

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
    return { width: 1, height: 1 } as unknown as PageContent;
  }
  prefetch(indices: number[]): void {
    this.prefetched.push(...indices);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

class MockRenderer implements Renderer {
  readonly flips: Array<[number, FlipDirection]> = [];
  readonly rendered: Spread[] = [];
  readonly begun: FlipDirection[] = [];
  mount(_container: HTMLElement): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(spread: Spread, _content: SpreadContent): void {
    this.rendered.push(spread);
  }
  beginFlip(_from: SpreadContent, _to: SpreadContent, direction: FlipDirection): void {
    this.begun.push(direction);
  }
  setFlipProgress(t: number, direction: FlipDirection): void {
    this.flips.push([t, direction]);
  }
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

let now = 0;
let rafCbs: FrameRequestCallback[] = [];
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

function tick(dt: number): void {
  now += dt;
  const cbs = rafCbs;
  rafCbs = [];
  for (const cb of cbs) cb(now);
}

beforeEach(() => {
  now = 0;
  rafCbs = [];
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// EventTarget + appendChild satisfies option validation and the input binding;
// these tests drive flips programmatically and never dispatch pointer events.
const el = Object.assign(new EventTarget(), { appendChild() {} }) as unknown as HTMLElement;

async function makeZine(pageCount = 4, startPage = 0): Promise<{ zine: Zine; renderer: MockRenderer; source: FakeSource }> {
  const source = new FakeSource(pageCount);
  const renderer = new MockRenderer();
  const zine = new Zine(el, { source, renderer, startPage, flipDuration: 500, spreadMode: 'double' });
  await zine.ready;
  return { zine, renderer, source };
}

describe('Zine — slice 2 (programmatic flips)', () => {
  it('flipNext animates forward and lands on the next spread', async () => {
    const { zine, renderer } = await makeZine(4); // spreads [0,1] and [2,3]
    zine.flipNext();
    await flush(); // stage destination content + schedule first frame
    tick(250); // t = 0.5
    tick(250); // t = 1 → commit
    await flush();

    expect(renderer.begun).toEqual(['forward']);
    expect(renderer.flips.every(([, dir]) => dir === 'forward')).toBe(true);
    expect(renderer.flips.length).toBeGreaterThanOrEqual(2);
    expect(renderer.rendered.at(-1)).toEqual({ left: 2, right: 3 });
    expect(zine.getPage()).toBe(2);
  });

  it('emits flipStart then pageChanged and flipEnd', async () => {
    const { zine } = await makeZine(4);
    const events: string[] = [];
    zine.on('flipStart', (p) => events.push(`start:${p.from}->${p.to}`));
    zine.on('pageChanged', (p) => events.push(`page:${p.page}`));
    zine.on('flipEnd', (p) => events.push(`end:${p.page}`));

    zine.flipNext();
    await flush();
    tick(500);
    await flush();

    expect(events).toEqual(['start:0->2', 'page:2', 'end:2']);
  });

  it('flipPrev animates backward', async () => {
    const { zine, renderer } = await makeZine(4, 2); // start on spread 1
    zine.flipPrev();
    await flush();
    tick(500);
    await flush();

    expect(renderer.begun).toEqual(['backward']);
    expect(renderer.flips.every(([, dir]) => dir === 'backward')).toBe(true);
    expect(zine.getPage()).toBe(0);
  });

  it('interrupts an in-flight fold and starts the requested flip at once', async () => {
    const { zine } = await makeZine(6); // spreads [0,1] [2,3] [4,5]
    const starts: string[] = [];
    zine.on('flipStart', (p) => starts.push(`${p.from}->${p.to}`));

    zine.flipNext(); // 0 -> 2
    await flush(); // stage content + schedule frames; the fold is now animating
    tick(100); // partway through (duration 500)
    zine.flipNext(); // interrupt: land 0->2 immediately, then begin 2->4
    await flush();
    tick(500);
    await flush();

    // Both turns took effect; the second stepped on from where the first landed.
    expect(starts).toEqual(['0->2', '2->4']);
    expect(zine.getPage()).toBe(4);
  });

  it('queues a flip requested before the fold begins animating, replaying it on settle', async () => {
    const { zine } = await makeZine(6);
    const starts: string[] = [];
    zine.on('flipStart', (p) => starts.push(`${p.from}->${p.to}`));

    zine.flipNext(); // locks state synchronously; #runFlip staging is still async
    zine.flipNext(); // no animation to cut short yet → queued, not dropped
    expect(starts).toEqual(['0->2']);

    await flush();
    tick(500); // first flip settles → queued flip replays
    await flush();
    tick(500);
    await flush();

    expect(starts).toEqual(['0->2', '2->4']);
    expect(zine.getPage()).toBe(4);
  });

  it('is a no-op at the ends of the book', async () => {
    const { zine } = await makeZine(4, 2); // last spread
    const starts = vi.fn();
    zine.on('flipStart', starts);
    zine.flipNext(); // nowhere to go
    expect(starts).not.toHaveBeenCalled();
  });

  it('debug.setFlipProgress seeks without animating or changing state', async () => {
    const { zine, renderer } = await makeZine(4);
    const events = vi.fn();
    zine.on('pageChanged', events);
    zine.debug.setFlipProgress(0.5, 'forward');

    expect(renderer.flips).toEqual([[0.5, 'forward']]);
    expect(events).not.toHaveBeenCalled();
    expect(zine.getPage()).toBe(0);
  });
});
