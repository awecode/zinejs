// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from './zine';
import type { Source } from './source/types';
import type { FlipDirection, LayoutMetrics, PageContent, Renderer, SpreadContent } from './renderer/types';

// Count FlipSound constructions to prove the chunk loads only when sound is actually audible.
// The subclass keeps the real behavior (real decode/play against the stubbed AudioContext).
const soundMock = vi.hoisted(() => ({ constructs: 0 }));
vi.mock('./sound/flipSound', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./sound/flipSound')>();
  return {
    ...orig,
    FlipSound: class extends orig.FlipSound {
      constructor(options?: import('./sound/flipSound').FlipSoundOptions) {
        super(options);
        soundMock.constructs++;
      }
    },
  };
});

class FakeSource implements Source {
  readonly pageCount: number;
  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(): Promise<PageContent> {
    return { width: 1, height: 1 } as unknown as PageContent;
  }
  prefetch(): void {}
  destroy(): void {}
}

class MockRenderer implements Renderer {
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void {}
  renderSpread(): void {}
  beginFlip(_f: SpreadContent, _t: SpreadContent, _d: FlipDirection): void {}
  setFlipProgress(): void {}
  setViewTransform(): void {}
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

/** Tallies buffer sources started (sounds played), contexts created, and resume() calls. */
let plays = 0;
let contexts = 0;
let resumes = 0;

class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = {};
  constructor() {
    contexts++;
  }
  resume = vi.fn(async () => {
    resumes++;
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createGain(): { gain: { value: number }; connect: () => void } {
    return { gain: { value: 1 }, connect: () => {} };
  }
  createBufferSource(): { buffer: unknown; connect: () => void; start: () => void } {
    return { buffer: null, connect: () => {}, start: () => void plays++ };
  }
  decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
}

let now = 0;
const flush = (): Promise<void> => new Promise((r) => setTimeout(r));
/** Settle decode + playback microtasks. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    await flush();
  }
}
/** Poll until a condition holds — deterministic where a fixed number of ticks is not enough (the
 *  lazy sound-controller import resolves at an unpredictable tick under full-suite load). */
async function waitFor(pred: () => boolean, tries = 100): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (pred()) return;
    await Promise.resolve();
    await flush();
  }
}
/** The lazy sound controller has finished importing + constructing. */
const soundLoaded = (): boolean => soundMock.constructs >= 1;
/** Dispatch a pointer event carrying a timestamp, so the recognizer measures real velocity
 *  (happy-dom's Event.timeStamp is read-only 0 otherwise → a bogus infinite flick). */
function fireAt(target: EventTarget, type: string, t: number, props: Record<string, number>): void {
  now = t;
  const e = Object.assign(new Event(type, { bubbles: true }), props);
  Object.defineProperty(e, 'timeStamp', { value: t, configurable: true });
  target.dispatchEvent(e);
}

const mounted: Zine[] = [];

beforeEach(() => {
  plays = 0;
  contexts = 0;
  resumes = 0;
  now = 0;
  soundMock.constructs = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })));
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  for (const z of mounted.splice(0)) z.destroy();
  vi.unstubAllGlobals();
});

async function mount(opts: Partial<ZineOptions> = {}): Promise<Zine> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(6),
    renderer: new MockRenderer(),
    spreadMode: 'double',
    flipDuration: 0, // land flips instantly so a commit resolves within the test
    controls: false,
    hints: false,
    ...opts,
  });
  mounted.push(zine);
  await zine.ready;
  await settle(); // wait out the lazy sound-controller import + decode
  return zine;
}

describe('flip sound', () => {
  it('plays on a committed page turn when sound is enabled', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' } });
    expect(zine.isSoundEnabled()).toBe(true);
    await waitFor(soundLoaded);
    expect(soundMock.constructs).toBe(1); // audible → loaded eagerly on ready
    zine.flipNext();
    await settle();
    expect(plays).toBe(1);
  });

  it('does not play, or even create a context, when sound is off (default)', async () => {
    const zine = await mount(); // no sound option
    expect(zine.isSoundEnabled()).toBe(false);
    zine.flipNext();
    await settle();
    expect(plays).toBe(0);
    expect(contexts).toBe(0);
  });

  it('does not play while muted', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' } });
    zine.setSoundMuted(true);
    expect(zine.isSoundMuted()).toBe(true);
    zine.flipNext();
    await settle();
    expect(plays).toBe(0);
  });

  it('plays again once unmuted', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' } });
    await waitFor(soundLoaded);
    zine.setSoundMuted(true);
    zine.flipNext();
    await settle();
    expect(plays).toBe(0);
    zine.setSoundMuted(false);
    zine.flipNext();
    await settle();
    expect(plays).toBe(1);
  });

  it('resumes a gesture-locked (suspended) context and never throws', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' } });
    await waitFor(soundLoaded);
    expect(() => zine.flipNext()).not.toThrow();
    await settle();
    expect(resumes).toBeGreaterThan(0);
    expect(plays).toBe(1);
  });

  it('sound: { muted: true } offers sound but starts silent until the reader unmutes', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3', muted: true } });
    expect(zine.isSoundEnabled()).toBe(true); // the feature is available (control shows)
    expect(zine.isSoundMuted()).toBe(true); // but starts silent
    zine.flipNext();
    await settle();
    expect(plays).toBe(0);

    zine.setSoundMuted(false); // the reader turns it on
    await waitFor(soundLoaded); // unmuting lazily loads the chunk; wait for it to arrive
    zine.flipNext();
    await settle();
    expect(plays).toBe(1);
  });

  it('does not load the sound chunk while starting muted, only once unmuted', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3', muted: true } });
    // Deferred: a book that starts muted pays nothing for audio until the reader turns it on.
    expect(soundMock.constructs).toBe(0);
    zine.flipNext();
    await settle();
    expect(soundMock.constructs).toBe(0); // flipping while muted still loads nothing

    zine.setSoundMuted(false);
    await waitFor(soundLoaded);
    expect(soundMock.constructs).toBe(1); // unmuting is the first time the clip is needed
  });

  it('mute API is a no-op and reports false when sound is disabled', async () => {
    const zine = await mount(); // sound off
    zine.setSoundMuted(true);
    expect(zine.isSoundMuted()).toBe(false);
    expect(zine.isSoundEnabled()).toBe(false);
  });

  it('makes no sound when a turn is rejected at the boundary', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' }, startPage: 0 });
    zine.flipTo(zine.getPageCount() - 1); // jump to the last spread
    await settle();
    plays = 0; // ignore the jump's own turn sound
    zine.flipNext(); // nowhere to go: rejected before the sound hook
    await settle();
    expect(plays).toBe(0);
  });

  it('an abandoned peel (released before commit) makes no sound', async () => {
    const zine = await mount({ sound: { url: '/flip.mp3' }, clickToFlip: 'off' });
    const el = zine.container;
    // Grab the right edge, drag a little, release slowly (0.05 px/ms — well under the 0.3 flick
    // threshold) and below the halfway commit point: the peel snaps back, no turn, no sound.
    fireAt(el, 'pointerdown', 0, { pointerId: 1, clientX: 790, clientY: 300 });
    fireAt(el, 'pointermove', 200, { pointerId: 1, clientX: 780, clientY: 300 });
    await flush();
    fireAt(el, 'pointerup', 400, { pointerId: 1, clientX: 780, clientY: 300 });
    await settle();
    expect(plays).toBe(0);
    expect(zine.getPage()).toBe(0); // nothing turned
  });
});
