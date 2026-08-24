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

/** A plain image book: no original file, so download/print stay hidden on their own. */
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

/** A downloadable book, so the download and print controls apply and would show unless hidden. */
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
    source: new DownloadableSource(8),
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

/** The outermost wrapper the library put around the book: toolbar and rail both live inside it. */
function scope(el: HTMLElement): HTMLElement {
  let node = el;
  while (
    node.parentElement?.classList.contains('zine-controls-wrap') ||
    node.parentElement?.classList.contains('zine-panel-wrap') ||
    node.parentElement?.classList.contains('zine-arrows-wrap')
  ) {
    node = node.parentElement;
  }
  return node;
}

const barButtons = (el: HTMLElement): HTMLButtonElement[] => [
  ...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-bar .zine-controls-btn'),
];
const byBarLabel = (el: HTMLElement, label: string): HTMLButtonElement | undefined =>
  barButtons(el).find((b) => b.getAttribute('aria-label') === label);

/** Labels inside the toolbar's ⋮ overflow menu, opened first. */
async function overflowLabels(el: HTMLElement): Promise<string[]> {
  byBarLabel(el, 'More')!.click();
  await flush();
  return [
    ...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button'),
  ].map((b) => b.getAttribute('aria-label') ?? '');
}

/** Fire a right-click over the book and read back its menu labels. */
async function contextLabels(el: HTMLElement): Promise<string[]> {
  el.dispatchEvent(new MouseEvent('contextmenu', { clientX: 60, clientY: 60, bubbles: true, cancelable: true }));
  await flush();
  return [
    ...el.querySelectorAll<HTMLButtonElement>('.zine-context-layer .zine-controls-menu button'),
  ].map((b) => b.getAttribute('aria-label') ?? '');
}

describe('hideControls', () => {
  it('shows print and download on both surfaces when nothing is hidden', async () => {
    const { el } = await mount();
    expect(await overflowLabels(el)).toEqual(expect.arrayContaining(['Print', 'Download PDF']));
    expect(await contextLabels(el)).toEqual(expect.arrayContaining(['Print', 'Download PDF']));
  });

  it('hides named controls from the toolbar overflow', async () => {
    const { el } = await mount({ hideControls: ['print', 'download'] });
    const labels = await overflowLabels(el);
    expect(labels).not.toContain('Print');
    expect(labels).not.toContain('Download PDF');
    // Its siblings in the overflow are untouched.
    expect(labels).toContain('First page');
  });

  it('hides the same controls from the context menu in one declaration', async () => {
    const { el } = await mount({ hideControls: ['print', 'download'] });
    const labels = await contextLabels(el);
    expect(labels).not.toContain('Print');
    expect(labels).not.toContain('Download PDF');
    // The rest of the right-click menu still stands.
    expect(labels).toContain('Share');
  });

  it('hides a control that sits directly on the bar', async () => {
    const { el } = await mount({ hideControls: ['fullscreen'] });
    expect(byBarLabel(el, 'Fullscreen')).toBeUndefined();
    // A neighbour on the bar survives.
    expect(byBarLabel(el, 'Search')).toBeDefined();
  });

  it('drops a submenu trigger when every one of its children is hidden', async () => {
    // The ⋮ overflow ('menu') holds first/last/spread/thumbnails/outline/print/download; hide the
    // lot and the trigger has nothing to open onto, so it hides itself (as any emptied submenu does:
    // built into the bar, then display:none once its state is read).
    const { el } = await mount({
      controls: { items: ['prev', 'next', 'menu'] },
      hideControls: ['first', 'last', 'spread', 'thumbnails', 'outline', 'print', 'download'],
    });
    expect(byBarLabel(el, 'More')!.style.display).toBe('none');
  });

  it('leaves the bar tidy when hiding a control between separators', async () => {
    // zoomOut/zoomIn sit between '|' separators in the default layout; hide both and the run of
    // separators they leave behind must collapse, not stack up empty dividers.
    const { el } = await mount({ hideControls: ['zoomOut', 'zoomIn'] });
    const seps = scope(el).querySelectorAll('.zine-controls-bar .zine-controls-sep');
    // No two separators are adjacent, and the bar neither starts nor ends on one.
    const kids = [...scope(el).querySelector('.zine-controls-bar')!.children];
    kids.forEach((node, i) => {
      if (node.classList.contains('zine-controls-sep')) {
        expect(kids[i - 1]?.classList.contains('zine-controls-sep')).not.toBe(true);
        expect(kids[i + 1]?.classList.contains('zine-controls-sep')).not.toBe(true);
      }
    });
    expect(kids[0]?.classList.contains('zine-controls-sep')).toBe(false);
    expect(kids[kids.length - 1]?.classList.contains('zine-controls-sep')).toBe(false);
    // And zoom really is gone.
    expect(seps.length).toBeLessThan(3);
    expect(byBarLabel(el, 'Zoom in')).toBeUndefined();
  });

  it('does nothing when the hide-list is empty', async () => {
    const { el } = await mount({ hideControls: [] });
    expect(await contextLabels(el)).toContain('Print');
  });

  it('throws when hideControls is not an array of strings', () => {
    const el = document.createElement('div');
    document.body.append(el);
    expect(
      () =>
        new Zine(el, {
          source: new FakeSource(8),
          renderer: new MockRenderer(),
          hideControls: ['print', 7] as unknown as string[],
        }),
    ).toThrow(/hideControls must be an array/);
  });
});
