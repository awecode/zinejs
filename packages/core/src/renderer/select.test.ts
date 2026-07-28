import { describe, it, expect } from 'vitest';
import { selectRenderer, detectCapabilities } from './select';
import { CssRenderer } from './cssRenderer';
import type { Renderer, LayoutMetrics } from './types';

const noGpu = { gpu: false };
const gpu = { gpu: true };

describe('selectRenderer', () => {
  it("resolves 'auto' to the CSS renderer on a non-GPU device", async () => {
    expect(await selectRenderer('auto', noGpu)).toBeInstanceOf(CssRenderer);
  });

  it("resolves 'auto' to CSS even on a GPU device (Pixi ships later)", async () => {
    expect(await selectRenderer('auto', gpu)).toBeInstanceOf(CssRenderer);
  });

  it("forces the CSS renderer when asked", async () => {
    expect(await selectRenderer('css', gpu)).toBeInstanceOf(CssRenderer);
  });

  it('walks an order array and picks the first loadable kind', async () => {
    expect(await selectRenderer(['pixi', 'css'], gpu)).toBeInstanceOf(CssRenderer);
  });

  it("throws a descriptive error when 'pixi' is forced without a GPU", async () => {
    await expect(selectRenderer('pixi', noGpu)).rejects.toThrow(/no GPU/);
  });

  it("throws when 'pixi' is forced on a GPU device but not yet shipped", async () => {
    await expect(selectRenderer('pixi', gpu)).rejects.toThrow(/later release/);
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
