// @vitest-environment happy-dom
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
  // One object per page, returned by identity: a fixed-resolution source has nothing sharper to
  // give, so the engine's upgrade pass drops the (identical) result and never repaints — which is
  // what keeps these zoom/pan tests measuring only the view transforms they assert on.
  #pages = new Map<number, PageContent>();
  constructor(pageCount: number) {
    this.pageCount = pageCount;
  }
  async get(index: number): Promise<PageContent> {
    let page = this.#pages.get(index);
    if (!page) {
      page = { width: 1, height: 1 } as unknown as PageContent;
      this.#pages.set(index, page);
    }
    return page;
  }
  prefetch(): void { }
  destroy(): void { }
}

class MockRenderer implements Renderer {
  readonly views: Array<[number, number, number]> = [];
  readonly begun: FlipDirection[] = [];
  mount(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): void { }
  renderSpread(): void { }
  beginFlip(_from: SpreadContent, _to: SpreadContent, direction: FlipDirection): void {
    this.begun.push(direction);
  }
  setFlipProgress(): void { }
  setViewTransform(scale: number, x: number, y: number): void {
    this.views.push([scale, x, y]);
  }
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
function fire(target: EventTarget, type: string, props: Record<string, number>): void {
  target.dispatchEvent(Object.assign(new Event(type), props));
}

beforeEach(() => {
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => { });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeZine(): Promise<{ zine: Zine; renderer: MockRenderer; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const renderer = new MockRenderer();
  const zine = new Zine(el, { source: new FakeSource(4), renderer, zoom: { max: 4 } });
  await zine.ready;
  return { zine, renderer, el };
}

describe('Zine — slice 4a (zoom + pan)', () => {
  it('zooms about the container center by default', async () => {
    const { zine, renderer } = await makeZine();
    const zoomed = vi.fn();
    zine.on('zoomChanged', zoomed);

    zine.setZoom(2); // center (400,300): tx=400-2*400=-400, ty=300-2*300=-300
    expect(zine.getZoom()).toBe(2);
    expect(renderer.views.at(-1)).toEqual([2, -400, -300]);
    expect(zoomed).toHaveBeenCalledWith({ scale: 2 });
  });

  it('clamps scale to [1, zoom.max]', async () => {
    const { zine } = await makeZine();
    zine.setZoom(99);
    expect(zine.getZoom()).toBe(4);
    zine.setZoom(0.1);
    expect(zine.getZoom()).toBe(1);
  });

  it('resetZoom returns to scale 1 with no translation', async () => {
    const { zine, renderer } = await makeZine();
    zine.setZoom(3);
    zine.resetZoom();
    expect(zine.getZoom()).toBe(1);
    expect(renderer.views.at(-1)).toEqual([1, 0, 0]);
  });

  it('ignores zoom when disabled', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const renderer = new MockRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, zoom: { enabled: false } });
    await zine.ready;
    zine.setZoom(3);
    expect(zine.getZoom()).toBe(1);
    expect(renderer.views).toEqual([]);
  });

  it('zooms on Ctrl+wheel but ignores a plain wheel', async () => {
    const { zine, el } = await makeZine();
    const wheel = (props: Record<string, unknown>): void => {
      el.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), props));
    };
    wheel({ deltaY: -200, clientX: 400, clientY: 300 }); // no modifier → scroll, not zoom
    expect(zine.getZoom()).toBe(1);
    wheel({ deltaY: -200, ctrlKey: true, clientX: 400, clientY: 300 });
    expect(zine.getZoom()).toBeGreaterThan(1);
  });

  it('does not wheel-zoom when zoom.wheel is false', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      zoom: { wheel: false },
    });
    await zine.ready;
    el.dispatchEvent(
      Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
        deltaY: -200,
        ctrlKey: true,
        clientX: 400,
        clientY: 300,
      }),
    );
    expect(zine.getZoom()).toBe(1);
  });

  it('cycles zoom levels on double-click (1 → 2 → 4 → 1)', async () => {
    const { zine, el } = await makeZine(); // default doubleClick [1, 2, 4]
    // The library detects double-clicks by pairing two raw clicks itself, so fire a pair.
    const click = (): void => {
      el.dispatchEvent(
        Object.assign(new Event('click', { cancelable: true, bubbles: true }), {
          clientX: 400,
          clientY: 300,
        }),
      );
    };
    const dbl = (): void => {
      click();
      click();
    };
    dbl();
    expect(zine.getZoom()).toBe(2);
    dbl();
    expect(zine.getZoom()).toBe(4);
    dbl();
    expect(zine.getZoom()).toBe(1);
  });

  it('cycles again on a continuous run of clicks (every second click zooms)', async () => {
    const { zine, el } = await makeZine(); // default doubleClick [1, 2, 4]
    const click = (): void => {
      el.dispatchEvent(
        Object.assign(new Event('click', { cancelable: true, bubbles: true }), { clientX: 400, clientY: 300 }),
      );
    };
    // Four uninterrupted clicks in one spot must read as two double-clicks: the browser would
    // fire at most one native `dblclick` across such a streak, which is why the library pairs
    // clicks itself. Clicks 2 and 4 each complete a pair and cycle the zoom.
    click(); // 1 → pending
    click(); // 2 → pair → zoom 2
    expect(zine.getZoom()).toBe(2);
    click(); // 3 → pending (pair was consumed on click 2)
    click(); // 4 → pair → zoom 4
    expect(zine.getZoom()).toBe(4);
  });

  it('does not double-click zoom when doubleClick is false', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new FakeSource(4),
      renderer: new MockRenderer(),
      zoom: { doubleClick: false },
    });
    await zine.ready;
    const click = (): void =>
      void el.dispatchEvent(
        Object.assign(new Event('click', { cancelable: true, bubbles: true }), {
          clientX: 400,
          clientY: 300,
        }),
      );
    click();
    click(); // a full pair; still must not zoom when doubleClick is disabled
    expect(zine.getZoom()).toBe(1);
  });

  it('pans instead of flipping when zoomed in', async () => {
    const { zine, renderer, el } = await makeZine();
    zine.setZoom(2); // tx=-400, ty=-300
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 450, clientY: 320 }); // dx=50, dy=20
    fire(el, 'pointerup', { pointerId: 1, clientX: 450, clientY: 320 });
    await flush();

    // translate = base(-400,-300) + (50,20), clamped to [-800,0]/[-600,0]
    expect(renderer.views.at(-1)).toEqual([2, -350, -280]);
    expect(renderer.begun).toEqual([]); // never started a flip
  });

  it('lands a pan on whole device pixels', async () => {
    // A fractional offset makes every screen pixel a different bilinear blend of the same texels,
    // so as the page slides the strokes of each glyph thicken and thin: text that shimmers and
    // seems to change weight rather than simply moving.
    vi.stubGlobal('devicePixelRatio', 2);
    const { zine, renderer, el } = await makeZine();
    zine.setZoom(2); // tx=-400, ty=-300
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 410.3, clientY: 320.9 });
    await flush();

    const [, tx, ty] = renderer.views.at(-1)!;
    expect(tx * 2).toBe(Math.round(tx * 2)); // whole device pixels at dpr 2
    expect(ty * 2).toBe(Math.round(ty * 2));
    expect(tx).toBeCloseTo(-389.5, 5); // -400 + 10.3 snapped to the half-pixel grid
  });

  it('clamps a pan so content keeps covering the viewport', async () => {
    const { zine, renderer, el } = await makeZine();
    zine.setZoom(2);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 9999, clientY: 9999 }); // huge drag
    fire(el, 'pointerup', { pointerId: 1, clientX: 9999, clientY: 9999 });
    await flush();

    // can't pan past 0 (top-left edge)
    expect(renderer.views.at(-1)).toEqual([2, 0, 0]);
  });

  it('flips (not pans) when at scale 1', async () => {
    const { renderer, el } = await makeZine();
    fire(el, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 10 }); // right corner
    fire(el, 'pointermove', { pointerId: 1, clientX: 600, clientY: 10 }); // move → promote to a flip
    await flush();
    expect(renderer.begun).toEqual(['forward']);
  });
});

describe('Zine — zoom tiles', () => {
  /** A renderer that reports where the spread is painted, so tiles can be planned against it. */
  class BoxRenderer extends MockRenderer {
    override measure(): LayoutMetrics {
      return {
        containerWidth: 800,
        containerHeight: 600,
        pageWidth: 400,
        pageHeight: 600,
        book: { x: 0, y: 0, width: 800, height: 600 },
        content: { x: 0, y: 0, width: 800, height: 600 },
      };
    }
  }

  /** A source that ignores the zoom hint, as any image-backed source does. */
  class FixedSource implements Source {
    readonly pageCount = 4;
    calls = 0;
    #page = { width: 800, height: 600 } as unknown as PageContent;
    async get(): Promise<PageContent> {
      this.calls++;
      return this.#page; // the same object every time, hint or no hint
    }
    prefetch(): void { }
    destroy(): void { }
  }

  const overlay = (el: HTMLElement): HTMLElement | null => el.querySelector('.zine-zoom-overlay');

  it('paints no tiles for a source with nothing sharper to give', async () => {
    // Regression: the check compared aspect ratios, so a full page whose shape happened to match
    // the visible region passed as a tile. It was then drawn over the book and, once panned,
    // dragged outside it. The page a source hands back unchanged is not an upgrade.
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      document.body.append(el);
      const source = new FixedSource();
      const zine = new Zine(el, { source, renderer: new BoxRenderer(), zoom: { max: 4 } });
      await zine.ready;

      zine.setZoom(2);
      await vi.advanceTimersByTimeAsync(200); // past the re-render debounce
      expect(overlay(el)).toBeNull(); // nothing drawn, so no overlay was ever created
      zine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Zine — display-aware base raster', () => {
  /** Reports a fixed painted box, so the fit gap between raster and display is deterministic. */
  class ContentRenderer extends MockRenderer {
    paints = 0;
    constructor(private readonly contentWidth: number) {
      super();
    }
    override renderSpread(): void {
      this.paints++;
    }
    override measure(): LayoutMetrics {
      const box = { x: 0, y: 0, width: this.contentWidth, height: 600 };
      return {
        containerWidth: this.contentWidth,
        containerHeight: 600,
        pageWidth: this.contentWidth / 2,
        pageHeight: 600,
        book: box,
        content: box,
      };
    }
  }

  /** A vector source (like PDF): re-rasterizes at whatever `scale` it is asked for, so a fit or
   *  zoom request gets a genuinely larger, distinct raster. Records the scale of every request. */
  class VectorSource implements Source {
    readonly pageCount = 4;
    readonly requests: Array<number | undefined> = [];
    #cache = new Map<string, PageContent>();
    constructor(private readonly base = 100) { }
    async get(index: number, opts?: { scale: number }): Promise<PageContent> {
      this.requests.push(opts?.scale);
      const scale = opts?.scale ?? 1;
      const key = `${index}@${scale}`;
      let page = this.#cache.get(key);
      if (!page) {
        page = { width: this.base * scale, height: this.base * scale } as unknown as PageContent;
        this.#cache.set(key, page);
      }
      return page;
    }
    prefetch(): void { }
    destroy(): void { }
  }

  it('sharpens a single-page spread painted larger than its raster, at rest', async () => {
    // The page fills 800 device px but the source rasterizes it at 100: an 8x fit gap, so the
    // engine should ask for a sharper raster even though the reader has not zoomed.
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      document.body.append(el);
      const source = new VectorSource();
      const renderer = new ContentRenderer(800);
      const zine = new Zine(el, { source, renderer, spreadMode: 'single', zoom: { max: 4 } });
      await zine.ready;

      const paintsAfterBase = renderer.paints;
      await vi.advanceTimersByTimeAsync(200); // past the upgrade debounce

      // Asked for a raster sharper than fit (capped at MAX_PAGE_UPGRADE 2.5) with no zoom involved.
      expect(source.requests.some((s) => s !== undefined && s > 1)).toBe(true);
      expect(renderer.paints).toBeGreaterThan(paintsAfterBase); // the sharper raster was painted
      zine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('supersamples a raster matched 1:1 to a low-dpr display, at rest', async () => {
    // Two 400px pages fill the two halves of an 800px box exactly, so device coverage is already
    // 1:1 (dpr 1 in this env). A 1:1 raster still reads soft, so the engine lifts it to the
    // TEXT_SUPERSAMPLE crispness floor (1.5), even with no fit gap and no zoom.
    // A well-fit double lands on that step, not the 2.5 a stretched single-page spread would demand.
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      document.body.append(el);
      const source = new VectorSource(400);
      const renderer = new ContentRenderer(800);
      const zine = new Zine(el, { source, renderer, spreadMode: 'double', zoom: { max: 4 } });
      await zine.ready;

      await vi.advanceTimersByTimeAsync(200);

      expect(source.requests).toContain(1.5); // lifted to the crispness floor
      expect(source.requests.some((s) => s === 2.5)).toBe(false); // not over-rasterized
      zine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a retina-density raster alone at rest', async () => {
    // Same 1:1-to-device raster as above, but on a retina screen: two 800px rasters over two
    // 400px-CSS halves is already ~2x CSS px, so the crispness floor (scaled by 1/dpr) is satisfied
    // and nothing is re-requested. This is why the floor costs retina users no extra memory.
    vi.useFakeTimers();
    try {
      vi.stubGlobal('devicePixelRatio', 2);
      const el = document.createElement('div');
      document.body.append(el);
      const source = new VectorSource(800);
      const renderer = new ContentRenderer(800);
      const zine = new Zine(el, { source, renderer, spreadMode: 'double', zoom: { max: 4 } });
      await zine.ready;

      const paintsAfterBase = renderer.paints;
      await vi.advanceTimersByTimeAsync(200);

      expect(source.requests.every((s) => s === undefined || s <= 1)).toBe(true);
      expect(renderer.paints).toBe(paintsAfterBase); // no upgrade repaint
      zine.destroy();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('requests a fit upgrade from a fixed source but drops the unchanged raster', async () => {
    // A fit gap exists, so the engine still asks; an image-backed source hands back the same
    // raster, and the engine must not repaint it (that was the pan-outside-the-box regression).
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      document.body.append(el);
      const page = { width: 100, height: 100 } as unknown as PageContent;
      const requests: Array<number | undefined> = [];
      const source: Source = {
        pageCount: 4,
        async get(_index: number, opts?: { scale: number }) {
          requests.push(opts?.scale);
          return page; // same object every time, hint or no hint
        },
        prefetch() { },
        destroy() { },
      };
      const renderer = new ContentRenderer(800);
      const zine = new Zine(el, { source, renderer, spreadMode: 'single', zoom: { max: 4 } });
      await zine.ready;

      const paintsAfterBase = renderer.paints;
      await vi.advanceTimersByTimeAsync(200);

      expect(requests.some((s) => s !== undefined && s > 1)).toBe(true); // it was asked
      expect(renderer.paints).toBe(paintsAfterBase); // but the identical raster was dropped
      zine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('compounds zoom over the fit factor on its tuned 0.5 steps', async () => {
    // Regression guard for folding the crispness floor into #upgradeScale. Two 800px rasters over
    // two 400px-CSS halves are already 2x CSS px, so the floor is met and rest does not upgrade
    // (fit 0.5 x floor 2 = 1). Zooming then drives the request purely by the fit factor: 4x zoom
    // over a half-density fit lands on a clean 2x step (0.5 x 4), not a fractional value.
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      document.body.append(el);
      const source = new VectorSource(800);
      const renderer = new ContentRenderer(800); // two 400px-CSS pages, stays double
      const zine = new Zine(el, { source, renderer, spreadMode: 'double', zoom: { max: 4 } });
      await zine.ready;
      await vi.advanceTimersByTimeAsync(200); // rest pass: no upgrade, raster already 2x CSS px

      source.requests.length = 0;
      zine.setZoom(4);
      await vi.advanceTimersByTimeAsync(200);

      expect(source.requests).toContain(2);
      expect(source.requests.some((s) => s !== undefined && s !== 2)).toBe(false);
      zine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Zine — zooming a lone page', () => {
  /** A cover/back spread: the page is painted in the middle half of the container. */
  class LoneRenderer extends MockRenderer {
    override measure(): LayoutMetrics {
      const content = { x: 200, y: 0, width: 400, height: 600 };
      return {
        containerWidth: 800,
        containerHeight: 600,
        pageWidth: 400,
        pageHeight: 600,
        book: { x: 0, y: 0, width: 800, height: 600 },
        content,
        // WebGL2's lone-page shift sits outside the view scale, so it stays a fixed 200px
        // offset however far the reader zooms. Mirrored here because that asymmetry is
        // exactly what the clamp has to respect.
        screenAt: (scale: number) => ({
          x: (content.x - 200) * scale + 200,
          y: content.y * scale,
          width: content.width * scale,
          height: content.height * scale,
        }),
      };
    }
  }

  const makeLone = async (): Promise<{ zine: Zine; renderer: LoneRenderer; el: HTMLElement }> => {
    const el = document.createElement('div');
    document.body.append(el);
    const renderer = new LoneRenderer();
    const zine = new Zine(el, { source: new FakeSource(4), renderer, zoom: { max: 4 } });
    await zine.ready;
    return { zine, renderer, el };
  };

  it('keeps the page filling the viewport rather than sliding off to one side', async () => {
    // At 2x the page spans 200..1000 with no pan: 800 wide in an 800 viewport, so there is
    // nothing to explore horizontally and the only valid translate is the one that seats it.
    // Clamping to the container would allow slack and let the reader drag it half off screen.
    const { zine, renderer, el } = await makeLone();
    zine.setZoom(2);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 900, clientY: 300 }); // hard drag right
    await flush();

    expect(renderer.views.at(-1)![1]).toBe(-200); // pinned flush against the viewport
  });

  it('lets the reader reach the left edge of a lone page', async () => {
    // The bug this covers: text cut off at the left with empty space at the right, and no way
    // to pan any further. The shift is fixed in screen space, so the page spans 200..1800 at
    // 4x and its left edge needs tx = -200 to reach the viewport's.
    const { zine, renderer, el } = await makeLone();
    zine.setZoom(4);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: 4000, clientY: 300 }); // drag hard right
    await flush();

    expect(renderer.views.at(-1)![1]).toBe(-200);
  });

  it('lets the reader reach the right edge of a lone page', async () => {
    const { zine, renderer, el } = await makeLone();
    zine.setZoom(4);
    fire(el, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
    fire(el, 'pointermove', { pointerId: 1, clientX: -4000, clientY: 300 }); // drag hard left
    await flush();

    // Right edge sits at 1800 with no pan; the viewport ends at 800, so tx = -1000.
    expect(renderer.views.at(-1)![1]).toBe(-1000);
  });

  it('still centres the page when zoom returns to 1', async () => {
    const { zine, renderer } = await makeLone();
    zine.setZoom(3);
    zine.setZoom(1);
    expect(renderer.views.at(-1)).toEqual([1, 0, 0]);
  });
});
