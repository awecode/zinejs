// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from './zine';
import type { Source } from './source/types';
import type { LayoutMetrics, PageContent, Renderer, SpreadContent, FlipDirection } from './renderer/types';
import type { Spread } from './engine/spread';

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

let rafCbs: Array<() => void> = [];
let now = 0;
const flush = (): Promise<void> => new Promise((r) => setTimeout(r));
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
function tick(dt: number): void {
  now += dt;
  const cbs = rafCbs;
  rafCbs = [];
  for (const cb of cbs) cb();
}
function tap(el: EventTarget, x: number, y: number): void {
  el.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
  el.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }));
}
/** The library pairs two raw clicks into its own double-click (the browser's `dblclick` is
 *  unreliable on rapid streaks), so drive it with two same-spot clicks in the pairing window. */
function doubleClick(el: EventTarget, x: number, y: number): void {
  const click = (): boolean =>
    el.dispatchEvent(Object.assign(new Event('click', { bubbles: true, cancelable: true }), { clientX: x, clientY: y }));
  click();
  click();
}

beforeEach(() => {
  rafCbs = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => rafCbs.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeZine(startPage = 0, opts: Partial<ZineOptions> = {}): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, { source: new FakeSource(4), renderer: new MockRenderer(), startPage, spreadMode: 'double', ...opts });
  await zine.ready;
  return { zine, el };
}

/** Run an instant (no-delay) click-flip to completion. */
async function settleInstant(): Promise<void> {
  await flush(); // #startFlip already ran synchronously → stage + schedule first frame
  tick(1000);
  await flush();
}

/** Run a delayed click-flip: wait out the window, then finish the animation. */
async function settleDelayed(): Promise<void> {
  await wait(300); // > clickFlipDelay
  await flush();
  tick(1000);
  await flush();
}

describe('Zine — click to flip (edge default: instant, no delay)', () => {
  it('flips forward instantly on a tap near the right edge', async () => {
    const { zine, el } = await makeZine();
    tap(el, 790, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(2);
  });

  it('does nothing tapping the center dead zone', async () => {
    const { zine, el } = await makeZine();
    tap(el, 400, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('a tap on the opposite edge mid-flip turns back, not the same way again', async () => {
    // 8 pages → spreads [0,1] [2,3] [4,5] [6,7]; start in the middle so both ways are open.
    const { zine, el } = await makeZine(2, { source: new FakeSource(8) });
    expect(zine.getPage()).toBe(2);

    tap(el, 790, 300); // right edge → forward
    tap(el, 10, 300); // left edge while that flip is still in flight → must go backward
    await settleInstant();
    await settleInstant();

    // Forward then back lands where it started. Reading a stale press instead would turn
    // forward twice and end on page 6.
    expect(zine.getPage()).toBe(2);
  });

  it('a reversing tap mid-flip turns back from where the book landed', async () => {
    const { zine, el } = await makeZine(4, { source: new FakeSource(12) });
    expect(zine.getPage()).toBe(4); // spread 2

    tap(el, 790, 300); // forward: spread 2 → 3
    await flush(); // let the fold actually start animating, so the next tap interrupts it
    tap(el, 10, 300); // reverse
    await settleInstant();
    await settleInstant();

    // Interrupting lands the forward turn on spread 3, and the reversal steps back from
    // there to spread 2 — the neighbour of what is now on screen. What must never happen is
    // the reversal moving the book *forward* again.
    expect(zine.getPage()).toBe(4); // spread 2
  });

  it('flipPrev during a flipNext moves back, never further forward', async () => {
    const { zine } = await makeZine(4, { source: new FakeSource(12) });
    expect(zine.getPage()).toBe(4); // spread 2

    zine.flipNext(); // → spread 3
    await flush();
    zine.flipPrev(); // reverse, from spread 3 → spread 2
    await settleInstant();
    await settleInstant();

    expect(zine.getPage()).toBe(4); // spread 2, not 6
  });

  it('does nothing when the tap would go past the ends', async () => {
    const { zine, el } = await makeZine(0);
    tap(el, 10, 300); // left edge at the first spread
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('does not flip when clickToFlip is off', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'off' });
    tap(el, 790, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(0);
  });

  it('a double-click on an edge does not zoom (left to click-to-flip)', async () => {
    const { zine, el } = await makeZine();
    doubleClick(el, 790, 300); // inside the right edge zone
    await flush();
    expect(zine.getZoom()).toBe(1);
  });

  it('a double-click in the center still zooms', async () => {
    const { zine, el } = await makeZine();
    doubleClick(el, 400, 300);
    await flush();
    expect(zine.getZoom()).toBe(2);
  });

  it('does not pair two clicks that fall outside the double-click window', async () => {
    const { zine, el } = await makeZine();
    const click = (): void =>
      void el.dispatchEvent(Object.assign(new Event('click', { bubbles: true }), { clientX: 400, clientY: 300 }));
    click();
    now += 400; // > the 250ms pairing window
    click();
    await flush();
    expect(zine.getZoom()).toBe(1); // two lone clicks, no double-click, no zoom
  });

  it('zooms on a double-click in the dead back zone of the first spread', async () => {
    // Left edge at the first spread: the zone is real but the flip has nowhere to land,
    // so it must zoom rather than defer to a turn that can never happen.
    const { zine, el } = await makeZine(0);
    doubleClick(el, 10, 300);
    await flush();
    expect(zine.getZoom()).toBe(2);
  });

  it('zooms on a double-click in the dead forward zone of the last spread', async () => {
    // 4 pages, double mode → spreads [0,1] [2,3]; start on the last one.
    const { zine, el } = await makeZine(2);
    expect(zine.getPage()).toBe(2);
    doubleClick(el, 790, 300); // right edge with no next spread → dead → zoom
    await flush();
    expect(zine.getZoom()).toBe(2);
  });

  it('still leaves a live forward zone to the flip (no zoom) on the first spread', async () => {
    const { zine, el } = await makeZine(0);
    doubleClick(el, 790, 300); // right edge, next spread exists → flip zone, not zoom
    await flush();
    expect(zine.getZoom()).toBe(1);
  });

  it('does not zoom in the dead forward zone when a flip just landed (streak tail)', async () => {
    // Rapid-flip to the last spread, then keep tapping the same edge: those trailing clicks are
    // the reader still flipping, not asking to zoom. A flip landing on their heels suppresses it.
    const { zine, el } = await makeZine(0); // spreads [0,1] [2,3]
    tap(el, 790, 300); // forward: spread 0 → 1
    await settleInstant();
    expect(zine.getPage()).toBe(2); // last spread; forward zone now dead
    now += 100; // a fast tap, well inside the streak window
    doubleClick(el, 790, 300);
    await flush();
    expect(zine.getZoom()).toBe(1); // swallowed, not zoomed
  });

  it('still zooms in the dead forward zone once the reader pauses past the streak window', async () => {
    const { zine, el } = await makeZine(0);
    tap(el, 790, 300); // forward: spread 0 → 1
    await settleInstant();
    expect(zine.getPage()).toBe(2);
    now += 600; // paused on the end page, past 2 × DOUBLE_CLICK_MS (500ms)
    doubleClick(el, 790, 300);
    await flush();
    expect(zine.getZoom()).toBe(2); // a deliberate zoom
  });

  it('does not zoom in the centre dead zone when a flip just landed (layout shifted under the pair)', async () => {
    // The cover/lone-page glitch generalised: the flip zone can sit mid-screen, so the first click
    // turns the page and the second — same spot — lands in the centre of the spread it flipped to.
    // A centre double-click normally zooms; on a streak tail it must not.
    const { zine, el } = await makeZine(0);
    tap(el, 790, 300); // forward: spread 0 → 1
    await settleInstant();
    now += 100; // fast pair, inside the streak window
    doubleClick(el, 400, 300); // centre dead zone
    await flush();
    expect(zine.getZoom()).toBe(1); // swallowed, not zoomed
  });

  it('does not zoom in the centre dead zone while a flip is still folding', async () => {
    // A long flip is mid-fold when the paired click arrives: the machine is animating, so even
    // before any landing this is plainly a streak, not a zoom.
    const { zine, el } = await makeZine(0, { flipDuration: 500 });
    tap(el, 790, 300); // start a forward flip
    await flush(); // staged + first frame scheduled, but not ticked → still animating
    doubleClick(el, 400, 300); // centre, mid-fold
    await flush();
    expect(zine.getZoom()).toBe(1);
  });

  it('still zooms in the centre dead zone once the reader pauses past the streak window', async () => {
    const { zine, el } = await makeZine(0);
    tap(el, 790, 300);
    await settleInstant();
    now += 600; // paused, past the window
    doubleClick(el, 400, 300);
    await flush();
    expect(zine.getZoom()).toBe(2); // a deliberate centre zoom
  });
});

// A book narrower than its container is letterboxed, so container x and book x differ.
// Everything that hit-tests a pointer has to subtract that offset or the zones drift.
class LetterboxedRenderer extends MockRenderer {
  override measure(): LayoutMetrics {
    // 800px container holding a 600px-wide book → 100px bars on each side.
    return {
      containerWidth: 800,
      containerHeight: 600,
      pageWidth: 300,
      pageHeight: 600,
      book: { x: 100, y: 0, width: 600, height: 600 },
      content: { x: 100, y: 0, width: 600, height: 600 },
    };
  }
}

describe('Zine — click zones on a letterboxed book', () => {
  const letterboxed = { renderer: new LetterboxedRenderer() } as Partial<ZineOptions>;

  it('leaves the flip zones near a letterbox bar to the flip, not zoom', async () => {
    // 6 pages, double mode → spreads [0,1] [2,3] [4,5]; start on the middle one so both
    // edge zones have somewhere to turn (otherwise a dead zone would zoom, tested elsewhere).
    const { zine, el } = await makeZine(2, { ...letterboxed, source: new FakeSource(6) });
    // x=110 is 10px into the book: inside the left bar's shadow, but the book's own
    // left edge zone ends at 100+64=164, so this IS a live flip zone → must not zoom.
    doubleClick(el, 110, 300);
    await flush();
    expect(zine.getZoom()).toBe(1);

    // x=700 sits on the book's right edge (100+600); the dead zone runs 164..636 in
    // container px, so 700 is an edge zone too → still no zoom.
    doubleClick(el, 700, 300);
    await flush();
    expect(zine.getZoom()).toBe(1);
  });

  it('does not zoom in the center, and does zoom outside the flip zones', async () => {
    const { zine, el } = await makeZine(0, letterboxed);
    // Dead center of the book (100 + 300 = 400) is a dead zone → zoom is allowed.
    doubleClick(el, 400, 300);
    await flush();
    expect(zine.getZoom()).toBe(2);
  });

  it('treats the far right of the book as a flip zone, not a zoom', async () => {
    const { zine, el } = await makeZine(0, letterboxed);
    // 690 is 590px into the 600px-wide book — deep inside the right edge zone.
    // Measured against the *container* width (800) it would look like the dead
    // zone, which is exactly the bug: the double-click would zoom instead of flip.
    doubleClick(el, 690, 300);
    await flush();
    expect(zine.getZoom()).toBe(1);
  });
});

describe('Zine — click to flip (half mode: delayed, double-click zoom on)', () => {
  it('flips from the right half after the delay', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half' });
    tap(el, 500, 300);
    await settleDelayed();
    expect(zine.getPage()).toBe(2);
  });

  it('a double-click zooms and cancels the queued flip', async () => {
    const { zine, el } = await makeZine(0, { clickToFlip: 'half' });
    tap(el, 500, 300); // queues a delayed flip
    doubleClick(el, 500, 300); // honored → cancels flip + zooms
    await settleDelayed();
    expect(zine.getPage()).toBe(0);
    expect(zine.getZoom()).toBeGreaterThan(1);
  });
});

describe('Zine — cursor hints', () => {
  /** Move the mouse to a point over the container and read back the cursor it set. */
  function hover(el: HTMLElement, x: number, y: number): string {
    el.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), { pointerId: 1, clientX: x, clientY: y }),
    );
    return el.style.cursor;
  }
  /** Press, move past the drag threshold, without releasing — promotes an edge grab to a live peel. */
  function pressAndMove(el: HTMLElement, fromX: number, toX: number, y: number): void {
    el.dispatchEvent(
      Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientX: fromX, clientY: y }),
    );
    el.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), { pointerId: 1, clientX: toX, clientY: y }),
    );
  }

  it('shows a pointer over a live click-to-flip zone', async () => {
    // 6 pages, middle spread → both edges can turn.
    const { el } = await makeZine(2, { source: new FakeSource(6) });
    expect(hover(el, 790, 300)).toBe('pointer'); // right edge, forward
    expect(hover(el, 10, 300)).toBe('pointer'); // left edge, backward
  });

  it('shows zoom-in over the centre dead zone', async () => {
    const { el } = await makeZine(2, { source: new FakeSource(6) });
    expect(hover(el, 400, 300)).toBe('zoom-in');
  });

  it('shows zoom-in on the peel band outside the click zone (a drag still peels)', async () => {
    // x=100 is past the 64px click zone; the edge peel band no longer gets its own cursor, so it
    // falls through to the zoom-in hint like the rest of the page.
    const { el } = await makeZine(2, { source: new FakeSource(6) });
    expect(hover(el, 100, 300)).toBe('zoom-in');
  });

  it('does not offer a flip cursor where the turn is dead at the ends', async () => {
    // First spread: the back (left) zone cannot turn, so it falls through to zoom-in, not pointer.
    const { el } = await makeZine(0);
    expect(hover(el, 10, 300)).toBe('zoom-in');
  });

  it('re-derives the cursor when a page turn kills the zone under a resting pointer', async () => {
    // 4 pages → spreads [0,1] [2,3]. Rest on the forward edge, then turn to the last spread: the
    // forward zone goes dead, so the cursor must drop from pointer without the mouse moving.
    const { zine, el } = await makeZine(0);
    expect(hover(el, 790, 300)).toBe('pointer');
    tap(el, 790, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(2); // last spread; forward zone now dead
    expect(el.style.cursor).toBe('zoom-in'); // updated in place, no new hover
  });

  it('keeps the zoom-in hint everywhere when zoomed (click-to-flip is off, a drag pans)', async () => {
    const { zine, el } = await makeZine(2, { source: new FakeSource(6) });
    expect(hover(el, 790, 300)).toBe('pointer'); // right edge turns the page at scale 1
    zine.setZoom(2);
    expect(el.style.cursor).toBe('zoom-in'); // re-derived on zoom; the edge no longer flips
    expect(hover(el, 400, 300)).toBe('zoom-in'); // centre too
  });

  it('shows grabbing while a peel is dragged', async () => {
    // Hovering stays calm, but once the hand actually has hold of the page the drag is called out.
    const { el } = await makeZine(2, { source: new FakeSource(6) });
    pressAndMove(el, 790, 700, 300); // grab the right edge and drag inward
    expect(el.style.cursor).toBe('grabbing');
  });

  it('shows the default cursor over a letterbox bar', async () => {
    const { el } = await makeZine(2, { renderer: new LetterboxedRenderer(), source: new FakeSource(6) });
    expect(hover(el, 50, 300)).toBe(''); // left of the book's 100px inset
  });

  it('never sets a cursor when cursorHints is false', async () => {
    const { zine, el } = await makeZine(2, { source: new FakeSource(6), cursorHints: false });
    expect(hover(el, 790, 300)).toBe('');
    zine.setZoom(2);
    expect(el.style.cursor).toBe('');
  });
});

describe('Zine — click to flip (config overrides)', () => {
  it('edge + doubleClickInFlipZone: click waits and a double-click cancels + zooms', async () => {
    const { zine, el } = await makeZine(0, { zoom: { doubleClickInFlipZone: true } });
    tap(el, 790, 300); // queues a delayed flip in the edge zone
    doubleClick(el, 790, 300);
    await settleDelayed();
    expect(zine.getPage()).toBe(0); // flip cancelled
    expect(zine.getZoom()).toBeGreaterThan(1);
  });

  it('clickFlipDelay 0 flips instantly and suppresses double-click zoom in flip zones (even half)', async () => {
    // 6 pages so the forward zone still has somewhere to turn after the first flip; a dead
    // zone would zoom regardless of the delay, which is a separate rule tested elsewhere.
    const { zine, el } = await makeZine(0, { clickToFlip: 'half', clickFlipDelay: 0, source: new FakeSource(6) });
    tap(el, 500, 300);
    await settleInstant();
    expect(zine.getPage()).toBe(2); // instant, no delay
    doubleClick(el, 500, 300); // live flip zone (spread 1 of 3) → suppressed
    await flush();
    expect(zine.getZoom()).toBe(1);
  });
});
