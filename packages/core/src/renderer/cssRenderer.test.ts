// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { CssRenderer } from './cssRenderer';

function makeContainer(w = 800, h = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true });
  document.body.append(el);
  return el;
}

async function mounted(w?: number, h?: number): Promise<{ container: HTMLElement; r: CssRenderer }> {
  const container = makeContainer(w, h);
  const r = new CssRenderer();
  await r.mount(container);
  return { container, r };
}

describe('CssRenderer', () => {
  it('mounts a viewport/book/pages structure into the container', async () => {
    const { container } = await mounted();
    expect(container.querySelector('.zine-viewport')).not.toBeNull();
    expect(container.querySelector('.zine-book')).not.toBeNull();
    expect(container.querySelector('.zine-page-left')).not.toBeNull();
    expect(container.querySelector('.zine-page-right')).not.toBeNull();
    expect(container.querySelector('.zine-leaf')).not.toBeNull();
  });

  it('measure reports container and half-width page dimensions', async () => {
    const { r } = await mounted(800, 600);
    expect(r.measure()).toEqual({
      containerWidth: 800,
      containerHeight: 600,
      pageWidth: 400,
      pageHeight: 600,
    });
  });

  it('setViewTransform writes a translate+scale transform on the viewport', async () => {
    const { container, r } = await mounted();
    r.setViewTransform(2, 10, 20);
    const vp = container.querySelector('.zine-viewport') as HTMLElement;
    expect(vp.style.transform).toBe('translate(10px, 20px) scale(2)');
  });

  it('fills the container with a lone page when fill is set (single-page mode)', async () => {
    const { container, r } = await mounted();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    r.renderSpread({ left: null, right: 2 }, { left: null, right: canvas }, { fill: true });
    const pageLeft = container.querySelector('.zine-page-left') as HTMLElement;
    const pageRight = container.querySelector('.zine-page-right') as HTMLElement;
    expect(pageLeft.style.width).toBe('100%');
    expect(pageRight.style.display).toBe('none');
  });

  it('renderSpread sizes a page canvas to its content', async () => {
    const { container, r } = await mounted();
    const content = document.createElement('canvas');
    content.width = 300;
    content.height = 400;
    r.renderSpread({ left: 0, right: 1 }, { left: content, right: null });
    const pageLeft = container.querySelector('.zine-page-left') as HTMLCanvasElement;
    expect(pageLeft.width).toBe(300);
    expect(pageLeft.height).toBe(400);
  });

  const blank = { left: null, right: null };

  it('beginFlip stages the leaf on the correct side per direction', async () => {
    const { container, r } = await mounted();
    const leaf = container.querySelector('.zine-leaf') as HTMLElement;

    r.beginFlip(blank, blank, 'forward');
    expect(leaf.style.display).toBe('block');
    expect(leaf.style.left).toBe('50%');
    expect(leaf.style.transformOrigin).toBe('left center');

    r.beginFlip(blank, blank, 'backward');
    expect(leaf.style.left).toBe('0px');
    expect(leaf.style.transformOrigin).toBe('right center');
  });

  it('setFlipProgress rotates the leaf about the spine with a shadow (forward)', async () => {
    const { container, r } = await mounted();
    r.beginFlip(blank, blank, 'forward');
    r.setFlipProgress(0.5, 'forward'); // pose.angle = π/2 → 90deg
    const leaf = container.querySelector('.zine-leaf') as HTMLElement;
    expect(leaf.style.display).toBe('block');
    expect(leaf.style.transform).toBe('rotateY(-90deg)');
    const shadow = container.querySelector('.zine-leaf-shadow') as HTMLElement;
    expect(Number(shadow.style.opacity)).toBeCloseTo(1);
  });

  it('backward flip rotates the other way', async () => {
    const { container, r } = await mounted();
    r.beginFlip(blank, blank, 'backward');
    r.setFlipProgress(0.5, 'backward');
    const leaf = container.querySelector('.zine-leaf') as HTMLElement;
    expect(leaf.style.transform).toBe('rotateY(90deg)');
  });

  it('renderSpread cancels an in-progress flip', async () => {
    const { container, r } = await mounted();
    r.beginFlip(blank, blank, 'forward');
    r.setFlipProgress(0.5, 'forward');
    r.renderSpread({ left: 0, right: 1 }, { left: null, right: null });
    const leaf = container.querySelector('.zine-leaf') as HTMLElement;
    expect(leaf.style.display).toBe('none');
  });

  it('destroy removes the mounted DOM', async () => {
    const { container, r } = await mounted();
    r.destroy();
    expect(container.querySelector('.zine-viewport')).toBeNull();
  });
});
