// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebglRenderer } from './webglRenderer';
import type { SpreadContent } from './types';
import type { Spread } from '../engine/spread';

/**
 * A no-op WebGL2 context that records the calls the "no white screen" guarantees hinge on:
 * program (re)creation and draw calls. happy-dom has no real GL, so the renderer talks to this.
 * Methods are all-lowercase/camelCase; GL constants are ALL_CAPS, so the Proxy returns a number
 * for a constant read and a no-op function for any un-modelled method.
 */
function fakeGl() {
  const calls = { createProgram: 0, drawArrays: 0, drawElements: 0, clear: 0 };
  let lost = false;
  const explicit: Record<string, unknown> = {
    createProgram: () => {
      calls.createProgram++;
      return {};
    },
    createShader: () => ({}),
    createBuffer: () => ({}),
    createVertexArray: () => ({}),
    createTexture: () => ({}),
    getProgramParameter: () => true, // LINK_STATUS ok
    getShaderParameter: () => true, // COMPILE_STATUS ok
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getUniformLocation: () => ({}),
    getAttribLocation: () => 0,
    getParameter: () => 4096, // MAX_TEXTURE_SIZE
    getExtension: () => ({ loseContext: () => {} }),
    isContextLost: () => lost,
    clear: () => {
      calls.clear++;
    },
    drawArrays: () => {
      calls.drawArrays++;
    },
    drawElements: () => {
      calls.drawElements++;
    },
  };
  const gl = new Proxy(explicit, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      if (/^[A-Z0-9_]+$/.test(prop)) return 0x1; // a GL constant read
      return () => {}; // an un-modelled GL method
    },
  }) as unknown as WebGL2RenderingContext;
  return { gl, calls, setLost: (v: boolean) => (lost = v) };
}

function stubContext(gl: WebGL2RenderingContext): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never);
}

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

function page(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 100;
  c.height = 100;
  return c;
}

const spread: Spread = { left: 0, right: 1 };
const content = (): SpreadContent => ({ left: page(), right: page() });

const lostEvent = (): Event => new Event('webglcontextlost', { cancelable: true });
const restoredEvent = (): Event => new Event('webglcontextrestored');

const sized = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('WebglRenderer — book aspect', () => {
  it('keeps a stable container aspect across off-size spreads (no layout shift)', async () => {
    const { gl } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);

    r.renderSpread(spread, { left: sized(100, 150), right: sized(100, 150) });
    const first = r.measure().containerAspect;

    // A later spread with a differently sized page must not change the container aspect.
    r.renderSpread(spread, { left: sized(100, 160), right: sized(100, 160) });
    expect(r.measure().containerAspect).toBeCloseTo(first!, 5);
    r.destroy();
  });

  it('contain (default) letterboxes an off-size spread without distorting it', async () => {
    const { gl } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);

    r.renderSpread(spread, { left: sized(100, 150), right: sized(100, 150) });
    // A taller page: its painted book keeps the page's true aspect (a half is 100x160 -> 0.625).
    r.renderSpread(spread, { left: sized(100, 160), right: sized(100, 160) });
    const book = r.measure().book!;
    expect(book.width / 2 / book.height).toBeCloseTo(100 / 160, 3); // no distortion
    r.destroy();
  });

  it('fill stretches an off-size spread to the document book shape', async () => {
    const { gl } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);

    r.renderSpread(spread, { left: sized(100, 150), right: sized(100, 150) }, { fit: 'fill' });
    r.renderSpread(spread, { left: sized(100, 160), right: sized(100, 160) }, { fit: 'fill' });
    const book = r.measure().book!;
    // Under fill the book keeps the first page's shape; the off-size page is stretched into it.
    expect(book.width / 2 / book.height).toBeCloseTo(100 / 150, 3);
    r.destroy();
  });
});

describe('WebglRenderer — runtime context loss', () => {
  it('repaints the retained spread after the context is lost and restored (no white screen)', async () => {
    const { gl, calls, setLost } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);
    r.renderSpread(spread, content());
    expect(calls.drawArrays).toBeGreaterThan(0); // painted once
    const canvas = el.querySelector('canvas')!;

    setLost(true);
    canvas.dispatchEvent(lostEvent());
    const programsAtLoss = calls.createProgram;
    const drawsAtLoss = calls.drawArrays;

    setLost(false);
    canvas.dispatchEvent(restoredEvent());

    // Restore must rebuild GL resources and repaint the spread the renderer still holds,
    // so the reader never sees a blank canvas.
    expect(calls.createProgram).toBeGreaterThan(programsAtLoss);
    expect(calls.drawArrays).toBeGreaterThan(drawsAtLoss);
    r.destroy();
  });

  it('suppresses drawing while the context is lost', async () => {
    const { gl, calls, setLost } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);
    r.renderSpread(spread, content());
    const canvas = el.querySelector('canvas')!;

    setLost(true);
    canvas.dispatchEvent(lostEvent());
    const drawsAtLoss = calls.drawArrays;
    r.setViewTransform(2, 0, 0); // would normally repaint

    expect(calls.drawArrays).toBe(drawsAtLoss); // no draw against a dead context
    r.destroy();
  });

  it('signals onFatal (which drives the CSS fallback) when restore never arrives', async () => {
    vi.useFakeTimers();
    const { gl } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);
    r.renderSpread(spread, content());
    let fatal = 0;
    r.onFatal(() => fatal++);
    const canvas = el.querySelector('canvas')!;

    canvas.dispatchEvent(lostEvent());
    vi.advanceTimersByTime(4000); // RESTORE_TIMEOUT_MS

    expect(fatal).toBe(1);
    r.destroy();
  });

  it('does not signal onFatal when the context restores before the timeout', async () => {
    vi.useFakeTimers();
    const { gl, setLost } = fakeGl();
    stubContext(gl);
    const el = container();
    const r = new WebglRenderer();
    await r.mount(el);
    r.renderSpread(spread, content());
    let fatal = 0;
    r.onFatal(() => fatal++);
    const canvas = el.querySelector('canvas')!;

    canvas.dispatchEvent(lostEvent());
    vi.advanceTimersByTime(3999);
    setLost(false);
    canvas.dispatchEvent(restoredEvent()); // in time
    vi.advanceTimersByTime(5000);

    expect(fatal).toBe(0);
    r.destroy();
  });
});
