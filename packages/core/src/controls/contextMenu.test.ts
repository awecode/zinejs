// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from '../zine';
import type { Source } from '../source/types';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  SpreadContent,
} from '../renderer/types';

/** A plain image-shaped book: no text, no original file, so download/print/search stay hidden. */
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

/** A downloadable book, so the download and print controls are visible. */
class DownloadableSource extends FakeSource {
  async getDownload(): Promise<{ url: string; filename: string }> {
    return { url: '/brochure.pdf', filename: 'brochure.pdf' };
  }
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

const flush = (): Promise<void> => new Promise((r) => setTimeout(r));

const mounted: Zine[] = [];

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  for (const zine of mounted.splice(0)) zine.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function mount(opts: Partial<ZineOptions> = {}): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(8),
    renderer: new MockRenderer(),
    spreadMode: 'double',
    flipDuration: 0,
    contextMenu: true,
    ...opts,
  });
  mounted.push(zine);
  await zine.ready;
  await flush(); // the controls chunk is imported after first paint
  return { zine, el };
}

/** Fire a right-click at a point over the book and let any resulting build settle. */
async function rightClick(el: HTMLElement, x = 120, y = 90): Promise<MouseEvent> {
  const event = new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  await flush();
  return event;
}

const layer = (el: HTMLElement): HTMLElement | null => el.querySelector('.zine-context-layer');
const menu = (el: HTMLElement): HTMLElement | null =>
  el.querySelector('.zine-context-layer .zine-controls-menu');
const items = (el: HTMLElement): HTMLButtonElement[] => [
  ...el.querySelectorAll<HTMLButtonElement>('.zine-context-layer .zine-controls-menu button'),
];
const byLabel = (el: HTMLElement, label: string): HTMLButtonElement | undefined =>
  items(el).find((b) => (b.getAttribute('aria-label') ?? '') === label);

describe('context menu', () => {
  it('is on by default', async () => {
    const { el } = await mount({ contextMenu: undefined });
    const event = await rightClick(el);
    expect(event.defaultPrevented).toBe(true);
    expect(menu(el)).not.toBeNull();
  });

  it('stays off when the book only asked to suppress the native menu', async () => {
    // disableContextMenu removes the browser's menu with nothing in its place; the default-on
    // context menu must not quietly fill that gap.
    const { el } = await mount({ contextMenu: undefined, disableContextMenu: true });
    await rightClick(el);
    expect(layer(el)).toBeNull();
  });

  it('leaves the browser menu alone when turned off', async () => {
    const { el } = await mount({ contextMenu: false });
    const event = await rightClick(el);
    expect(event.defaultPrevented).toBe(false);
    expect(layer(el)).toBeNull();
  });

  it('opens at the cursor on right-click and suppresses the native menu', async () => {
    const { el } = await mount();
    const event = await rightClick(el, 120, 90);
    expect(event.defaultPrevented).toBe(true);
    const box = menu(el)!;
    expect(box).not.toBeNull();
    expect(box.getAttribute('role')).toBe('menu');
    // happy-dom has no layout, so placement pins the raw cursor coordinates.
    expect(box.style.left).toBe('120px');
    expect(box.style.top).toBe('90px');
  });

  it('offers the reading controls that apply to this book', async () => {
    const { el } = await mount();
    await rightClick(el);
    const labels = items(el).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Zoom in');
    expect(labels).toContain('Zoom out');
    expect(labels).toContain('Next page');
    expect(labels).toContain('Share');
  });

  it('greys a control that does not apply right now (zoom out at 1x)', async () => {
    const { el } = await mount();
    await rightClick(el);
    expect(byLabel(el, 'Zoom out')!.disabled).toBe(true);
    expect(byLabel(el, 'Zoom in')!.disabled).toBe(false);
  });

  it('keeps the menu open for an incremental action and re-reads its state', async () => {
    const { zine, el } = await mount();
    await rightClick(el);
    byLabel(el, 'Zoom in')!.click();
    await flush();
    expect(zine.getZoom()).toBeGreaterThan(1);
    // The menu stays up so the reader can repeat the step; zoom out is now live.
    expect(menu(el)).not.toBeNull();
    expect(byLabel(el, 'Zoom out')!.disabled).toBe(false);
  });

  it('closes the menu for a terminal action (share)', async () => {
    const { el } = await mount();
    await rightClick(el);
    byLabel(el, 'Share')!.click();
    await flush();
    expect(layer(el)).toBeNull();
  });

  it('dismisses on a press outside the menu', async () => {
    const { el } = await mount();
    await rightClick(el);
    expect(menu(el)).not.toBeNull();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flush();
    expect(layer(el)).toBeNull();
  });

  it('dismisses on Escape', async () => {
    const { el } = await mount();
    await rightClick(el);
    expect(menu(el)).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(layer(el)).toBeNull();
  });

  it('reopens at the new point when right-clicked again', async () => {
    const { el } = await mount();
    await rightClick(el, 40, 40);
    await rightClick(el, 200, 150);
    // Only one menu — the first was closed before the second opened.
    expect(el.querySelectorAll('.zine-context-layer').length).toBe(1);
    expect(menu(el)!.style.left).toBe('200px');
  });

  it('replaces the layout when custom items are given', async () => {
    const { el } = await mount({ contextMenu: { items: ['next', 'prev'] } });
    await rightClick(el);
    const labels = items(el).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Next page', 'Previous page']);
  });

  it('opens no empty menu when nothing in a custom list applies', async () => {
    // An image book cannot download, so a download-only menu has no visible entry.
    const { el } = await mount({ contextMenu: { items: ['download'] } });
    const event = await rightClick(el);
    expect(event.defaultPrevented).toBe(true); // native menu still suppressed
    expect(layer(el)).toBeNull(); // but no empty popup
  });

  it('works with the toolbar off', async () => {
    const { el } = await mount({ controls: false });
    expect(el.parentElement).toBe(document.body); // no toolbar wrapper
    await rightClick(el);
    expect(menu(el)).not.toBeNull();
  });

  it('shows download and print for a downloadable book', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const zine = new Zine(el, {
      source: new DownloadableSource(8),
      renderer: new MockRenderer(),
      spreadMode: 'double',
      flipDuration: 0,
      controls: false,
      contextMenu: true,
    });
    mounted.push(zine);
    await zine.ready;
    await flush();
    await rightClick(el);
    const labels = items(el).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Download PDF');
    expect(labels).toContain('Print');
  });

  it('tears the menu down with the book', async () => {
    const { zine, el } = await mount();
    await rightClick(el);
    expect(menu(el)).not.toBeNull();
    zine.destroy();
    expect(layer(el)).toBeNull();
    // A right-click after teardown is inert: the listener is gone.
    const event = await rightClick(el);
    expect(event.defaultPrevented).toBe(false);
  });

  it('throws when disableContextMenu and contextMenu are both enabled', () => {
    const el = document.createElement('div');
    document.body.append(el);
    expect(
      () =>
        new Zine(el, {
          source: new FakeSource(8),
          renderer: new MockRenderer(),
          disableContextMenu: true,
          contextMenu: true,
        }),
    ).toThrow(/mutually exclusive/);
  });
});
