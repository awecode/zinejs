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

  describe('spine trim (gutterOverlap)', () => {
    function page(w = 300, h = 400): HTMLCanvasElement {
      return Object.assign(document.createElement('canvas'), { width: w, height: h });
    }
    const canvas = (c: HTMLElement, cls: string): HTMLCanvasElement => c.querySelector(cls) as HTMLCanvasElement;

    it('narrows both pages of a two-page spread by the trim, keeping their height', async () => {
      const { container, r } = await mounted();
      r.renderSpread({ left: 0, right: 1 }, { left: page(), right: page(), spineTrim: 0.1 });
      expect(canvas(container, '.zine-page-left').width).toBe(270);
      expect(canvas(container, '.zine-page-right').width).toBe(270);
      expect(canvas(container, '.zine-page-left').height).toBe(400);
    });

    it('draws the trimmed book narrower but keeps the container at the untrimmed shape', async () => {
      const { r } = await mounted(800, 600);
      r.renderSpread({ left: 0, right: 1 }, { left: page(), right: page(), spineTrim: 0.1 });
      const m = r.measure();
      expect(m.containerAspect).toBeCloseTo(1.5); // 2 x 300/400: no layout shift from the trim
      expect(m.book!.width / m.book!.height).toBeCloseTo(1.35); // 2 x 270/400
    });

    it('never trims a lone page', async () => {
      const { container, r } = await mounted();
      r.renderSpread({ left: null, right: 0 }, { left: null, right: page(), spineTrim: 0.1 });
      expect(canvas(container, '.zine-page-right').width).toBe(300);
    });

    it('keeps each leaf face at the trim of its own spread through a flip', async () => {
      const { container, r } = await mounted();
      r.beginFlip(
        { left: page(), right: page(), spineTrim: 0.1 }, // from: trimmed
        { left: page(), right: page() }, // to: no repeat found
        'forward',
      );
      expect(canvas(container, '.zine-leaf-front').width).toBe(270); // from.right
      expect(canvas(container, '.zine-leaf-back').width).toBe(300); // to.left
    });
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

  it('turns a full-width leaf about one edge in single-page (fill) flips', async () => {
    const { container, r } = await mounted();
    r.beginFlip(blank, blank, 'forward', { fill: true });
    const leaf = container.querySelector('.zine-leaf') as HTMLElement;
    const pageRight = container.querySelector('.zine-page-right') as HTMLElement;
    expect(leaf.style.width).toBe('100%');
    expect(leaf.style.transformOrigin).toBe('left center');
    expect(pageRight.style.display).toBe('none');
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
