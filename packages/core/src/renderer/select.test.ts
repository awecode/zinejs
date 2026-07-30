import { describe, it, expect } from 'vitest';
import { selectRenderer, detectCapabilities } from './select';
import { CssRenderer } from './cssRenderer';
import { WebglRenderer } from './webglRenderer';
import type { Renderer, LayoutMetrics } from './types';

const noGpu = { gpu: false };
const gpu = { gpu: true };

describe('selectRenderer', () => {
  it("resolves 'auto' to the CSS renderer on a non-GPU device", async () => {
    expect(await selectRenderer('auto', noGpu)).toBeInstanceOf(CssRenderer);
  });

  it("resolves 'auto' to CSS even on a GPU device (WebGL2 not auto-selected yet)", async () => {
    expect(await selectRenderer('auto', gpu)).toBeInstanceOf(CssRenderer);
  });

  it("forces the CSS renderer when asked", async () => {
    expect(await selectRenderer('css', gpu)).toBeInstanceOf(CssRenderer);
  });

  it("resolves 'webgl2' to the WebGL2 renderer on a GPU device", async () => {
    expect(await selectRenderer('webgl2', gpu)).toBeInstanceOf(WebglRenderer);
  });

  it('walks an order array and picks the first loadable kind', async () => {
    expect(await selectRenderer(['webgl2', 'css'], gpu)).toBeInstanceOf(WebglRenderer);
  });

  it("throws a descriptive error when 'webgl2' is forced without WebGL2", async () => {
    await expect(selectRenderer('webgl2', noGpu)).rejects.toThrow(/WebGL2/);
  });

  it('returns a custom Renderer instance as-is', async () => {
    const custom: Renderer = {
      mount: () => Promise.resolve(),
      destroy: () => {},
      renderSpread: () => {},
      beginFlip: () => {},
      setFlipProgress: () => {},
      setViewTransform: () => {},
      measure: (): LayoutMetrics => ({
        containerWidth: 0,
        containerHeight: 0,
        pageWidth: 0,
        pageHeight: 0,
      }),
    };
    expect(await selectRenderer(custom, noGpu)).toBe(custom);
  });
});

describe('detectCapabilities', () => {
  it('reports no GPU in a headless (no-DOM) environment', () => {
    expect(detectCapabilities()).toEqual({ gpu: false });
  });
});
