// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from '../zine';
import { defineControl, DEFAULT_ITEMS, resolveControl } from './registry';
import type { OutlineItem, Source } from '../source/types';
import type {
  FlipDirection,
  LayoutMetrics,
  PageContent,
  Renderer,
  SpreadContent,
} from '../renderer/types';

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

/** A source with text, so the search control has something to be visible for. */
class TextSource extends FakeSource {
  #pages: string[];
  constructor(pages: string[]) {
    super(pages.length);
    this.#pages = pages;
  }
  async getText(index: number): Promise<string> {
    return this.#pages[index] ?? '';
  }
}

/** A source with an original file behind it, like a PDF loaded from a URL. */
class DownloadableSource extends FakeSource {
  async getDownload(): Promise<{ url: string; filename: string }> {
    return { url: '/brochure.pdf', filename: 'brochure.pdf' };
  }
}

/** A document-shaped source, as a PDF is: it has text and an outline, so the side panels apply. */
class DocSource extends FakeSource {
  #outline: OutlineItem[];
  constructor(pageCount: number, outline: OutlineItem[] = []) {
    super(pageCount);
    this.#outline = outline;
  }
  async getText(): Promise<string> {
    return '';
  }
  async getOutline(): Promise<OutlineItem[]> {
    return this.#outline;
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

/** Books built by `mount`, torn down after each test so no rail or toolbar outlives it — the
 *  teardown assertions search the whole document. */
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
    // Land flips immediately: these tests are about what a control does, not how it animates,
    // and a real duration would need the clock driven frame by frame.
    flipDuration: 0,
    ...opts,
  });
  mounted.push(zine);
  await zine.ready;
  await flush(); // the controls chunk is imported after first paint
  return { zine, el };
}

/**
 * The outermost element the library wrapped around the book — the toolbar and the thumbnail rail
 * both live inside it. Docking wraps the container once, and opening the rail wraps *that* again,
 * so a fixed number of hops up would miss whichever went on last.
 */
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
const toolbar = (el: HTMLElement): HTMLElement | null =>
  scope(el).querySelector('.zine-controls');
const buttons = (el: HTMLElement): HTMLButtonElement[] => [
  ...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-bar .zine-controls-btn'),
];
const byLabel = (el: HTMLElement, label: string): HTMLButtonElement | undefined =>
  buttons(el).find((b) => b.getAttribute('aria-label') === label);

/** The thumbnails entry inside an open ⋮ menu; its label flips with state. */
const thumbsItem = (el: HTMLElement): HTMLButtonElement =>
  [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')].find((b) =>
    (b.getAttribute('aria-label') ?? '').includes('thumbnails'),
  )!;

/** Open the ⋮ menu and turn the rail on. */
async function openThumbs(el: HTMLElement): Promise<void> {
  byLabel(el, 'More')!.click();
  thumbsItem(el).click();
  await flush();
}

describe('controls registry', () => {
  it('resolves a registered control by id', () => {
    defineControl({ id: 'test:noop', title: 'Noop' });
    expect(resolveControl('test:noop').title).toBe('Noop');
  });

  it('layers a partial definition over the registered one', () => {
    defineControl({ id: 'test:base', title: 'Base', icon: '<path/>' });
    const merged = resolveControl({ id: 'test:base', title: 'Renamed' });
    expect(merged.title).toBe('Renamed');
    expect(merged.icon).toBe('<path/>'); // untouched fields survive
  });

  it('names the offending control when an id is unknown', () => {
    expect(() => resolveControl('test:missing')).toThrow(/unknown control 'test:missing'/);
  });

  it('accepts a wholly inline definition without registering it', () => {
    expect(resolveControl({ id: 'test:inline', title: 'Inline' }).title).toBe('Inline');
  });
});

describe('controls toolbar', () => {
  it('renders by default and tears down with the book', async () => {
    const { zine, el } = await mount();
    expect(toolbar(el)).not.toBeNull();
    zine.destroy();
    expect(toolbar(el)).toBeNull();
  });

  it('renders nothing when controls are off', async () => {
    const { el } = await mount({ controls: false });
    expect(toolbar(el)).toBeNull();
  });

  it('docks outside the book by default, leaving the container free of toolbar DOM', async () => {
    // The renderer measures the container to size the book, so a docked bar must not live in it.
    const { el } = await mount();
    expect(el.querySelector('.zine-controls')).toBeNull();
    const root = toolbar(el)!;
    expect(root.classList.contains('zine-controls-docked')).toBe(true);
    expect(root.parentElement?.classList.contains('zine-controls-wrap')).toBe(true);
    expect(el.parentElement).toBe(root.parentElement); // siblings in the wrapper
  });

  it('restores the original DOM shape on destroy', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const el = document.createElement('div');
    host.append(el);
    const zine = new Zine(el, { source: new FakeSource(8), renderer: new MockRenderer() });
    await zine.ready;
    await flush();
    expect(el.parentElement).not.toBe(host); // wrapped
    zine.destroy();
    expect(el.parentElement).toBe(host); // unwrapped again
    expect(host.querySelector('.zine-controls-wrap')).toBeNull();
  });

  it('floats inside the container when docked is false', async () => {
    const { el } = await mount({ controls: { docked: false } });
    const root = el.querySelector('.zine-controls')!;
    expect(root.classList.contains('zine-controls-floating')).toBe(true);
    expect(root.parentElement).toBe(el); // a child of the book, overlaying it
  });

  it('honours a custom layout and position', async () => {
    const { el } = await mount({ controls: { position: 'top', items: ['next'] } });
    const root = toolbar(el)!;
    expect(root.classList.contains('zine-controls-top')).toBe(true);
    expect(buttons(el)).toHaveLength(1);
    expect(buttons(el)[0]?.getAttribute('aria-label')).toBe('Next page');
  });

  it('puts a top-positioned bar before the book, a bottom one after', async () => {
    const top = await mount({ controls: { position: 'top' } });
    expect(toolbar(top.el)!.nextElementSibling).toBe(top.el);
    const bottom = await mount({ controls: { position: 'bottom' } });
    expect(toolbar(bottom.el)!.previousElementSibling).toBe(bottom.el);
  });

  it('flips the page when next is pressed', async () => {
    const { zine, el } = await mount();
    expect(zine.getPage()).toBe(0);
    byLabel(el, 'Next page')!.click();
    await flush();
    expect(zine.getPage()).toBeGreaterThan(0);
  });

  it('disables previous on the first spread and enables it after turning', async () => {
    const { zine, el } = await mount();
    expect(byLabel(el, 'Previous page')!.disabled).toBe(true);
    zine.flipNext();
    await flush();
    expect(byLabel(el, 'Previous page')!.disabled).toBe(false);
  });

  it('does not let a floating control press reach the book as a page tap', async () => {
    // Only floating mode puts the toolbar inside the container. Gestures are bound there and
    // never check event.target, so without stopPropagation a button press would also flip.
    const { el } = await mount({ controls: { docked: false } });
    const seen: string[] = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      el.addEventListener(type, () => seen.push(type));
    }
    const next = byLabel(el, 'Next page')!;
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      next.dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(seen).toEqual([]);
  });

  it('keeps arrow keys in a floating toolbar from flipping the page', async () => {
    // The container is tabindex=0 with a keydown handler, so an un-stopped ArrowRight from a
    // focused button would both move toolbar focus and turn the page.
    const { el } = await mount({ controls: { docked: false } });
    const seen: string[] = [];
    el.addEventListener('keydown', (e) => seen.push((e as KeyboardEvent).key));
    byLabel(el, 'Next page')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(seen).toEqual([]);
  });

  it('shows the current page and jumps on submit', async () => {
    const { zine, el } = await mount();
    const input = scope(el).querySelector<HTMLInputElement>('.zine-controls-page input')!;
    expect(input.value).toBe('1');
    input.value = '5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(zine.getPage()).toBe(4);
  });

  it('opens a submenu and closes it again on a second press', async () => {
    const { el } = await mount({ source: new DownloadableSource(8) });
    const menu = byLabel(el, 'More')!;
    menu.click();
    expect(scope(el).querySelector('.zine-controls-menu')).not.toBeNull();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    menu.click();
    expect(scope(el).querySelector('.zine-controls-menu')).toBeNull();
    expect(menu.hasAttribute('aria-expanded')).toBe(false);
  });

  it('closes an open submenu on Escape', async () => {
    const { el } = await mount({ source: new DownloadableSource(8) });
    byLabel(el, 'More')!.click();
    toolbar(el)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(scope(el).querySelector('.zine-controls-menu')).toBeNull();
  });

  it('puts share and fullscreen on the bar, in the documented order', async () => {
    const { el } = await mount();
    const order = buttons(el)
      .map((b) => b.getAttribute('aria-label'))
      .filter((l) => ['Search', 'Share', 'More', 'Fullscreen'].includes(l ?? ''));
    expect(order).toEqual(['Search', 'Share', 'More', 'Fullscreen']);
  });

  it('jumps to the ends of the book from the menu', async () => {
    const { zine, el } = await mount({ source: new FakeSource(12) });
    const item = (name: string): HTMLButtonElement => {
      byLabel(el, 'More')!.click();
      return [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')].find(
        (b) => b.getAttribute('aria-label') === name,
      )!;
    };

    item('Last page').click();
    await flush();
    expect(zine.getPage()).toBe(10); // the last spread of a 12-page double book

    item('First page').click();
    await flush();
    expect(zine.getPage()).toBe(0);
  });

  it('disables an end jump the book is already at', async () => {
    const { zine, el } = await mount({ source: new FakeSource(12) });
    const item = (name: string): HTMLButtonElement => {
      byLabel(el, 'More')!.click();
      return [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')].find(
        (b) => b.getAttribute('aria-label') === name,
      )!;
    };

    expect(item('First page').disabled).toBe(true); // already on page 1
    expect(item('Last page').disabled).toBe(false);

    zine.flipTo(11);
    await flush();
    expect(item('First page').disabled).toBe(false);
    expect(item('Last page').disabled).toBe(true);
  });

  it('disables an end jump on the bar rather than moving its neighbours', async () => {
    const { zine, el } = await mount({
      source: new FakeSource(12),
      controls: { items: ['first', 'prev', 'next', 'last'] },
    });
    const first = byLabel(el, 'First page')!;
    expect(first.disabled).toBe(true);
    expect(first.style.display).not.toBe('none'); // still holding its place

    zine.flipTo(4);
    await flush();
    expect(first.disabled).toBe(false);
  });

  it('applies the same state predicates to a custom render widget', async () => {
    // The predicates live on ControlDef, so honouring them only for buttons would make the same
    // field mean different things depending on how a control drew itself.
    defineControl({
      id: 'test:widget',
      title: 'Widget',
      render: () => {
        const wrap = document.createElement('div');
        wrap.className = 'test-widget';
        wrap.appendChild(document.createElement('input'));
        return wrap;
      },
      isDisabled: (ctx) => !ctx.zine.canFlipPrev(),
    });
    const { zine, el } = await mount({
      source: new FakeSource(12),
      controls: { items: ['test:widget', 'next'] },
    });
    const widget = scope(el).querySelector<HTMLElement>('.test-widget')!;
    const input = widget.querySelector('input')!;
    expect(input.disabled).toBe(true); // on page 1, nothing to go back to
    expect(widget.classList.contains('zine-controls-off')).toBe(true);

    zine.flipTo(6);
    await flush();
    expect(input.disabled).toBe(false);
    expect(widget.classList.contains('zine-controls-off')).toBe(false);
  });

  it('hides a custom widget that does not apply to the book', async () => {
    defineControl({
      id: 'test:hidden',
      title: 'Hidden',
      render: () => {
        const el = document.createElement('div');
        el.className = 'test-hidden';
        return el;
      },
      isVisible: (ctx) => ctx.zine.canSearch(),
    });
    const { el } = await mount({ controls: { items: ['test:hidden'] } });
    expect(scope(el).querySelector<HTMLElement>('.test-hidden')!.style.display).toBe('none');
  });

  it('draws a custom widget inside a submenu rather than a plain button', async () => {
    defineControl({
      id: 'test:menuwidget',
      title: 'Menu widget',
      render: () => {
        const el = document.createElement('div');
        el.className = 'test-menu-widget';
        return el;
      },
    });
    const { el } = await mount({
      controls: { items: [{ id: 'group', title: 'Group', children: ['test:menuwidget'] }] },
    });
    byLabel(el, 'Group')!.click();
    expect(scope(el).querySelector('.test-menu-widget')).not.toBeNull();
  });

  it('removes a control that does not apply to the book at all', async () => {
    // Unlike the ends of the book, this will not come back, so the space goes with it.
    const { el } = await mount({ controls: { items: ['prev', 'search', 'next'] } });
    expect(byLabel(el, 'Search')?.style.display).toBe('none');
  });

  it('offers Print only when there is an original document', async () => {
    const { el } = await mount({ source: new DownloadableSource(8) });
    byLabel(el, 'More')!.click();
    const labels = [...scope(el).querySelectorAll('.zine-controls-menu button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toContain('Print');

    const plain = await mount(); // an image book has no file to print
    byLabel(plain.el, 'More')!.click();
    const plainLabels = [...scope(plain.el).querySelectorAll('.zine-controls-menu button')].map(
      (b) => b.getAttribute('aria-label'),
    );
    expect(plainLabels).not.toContain('Print');
  });

  it('offers Download PDF in the menu when the source has a file', async () => {
    const { el } = await mount({ source: new DownloadableSource(8) });
    byLabel(el, 'More')!.click();
    const items = [...scope(el).querySelectorAll('.zine-controls-menu button')];
    expect(items.map((b) => b.getAttribute('aria-label'))).toContain('Download PDF');
  });

  it('leaves Download PDF out for a book with no original file', async () => {
    const { el } = await mount(); // plain image book
    byLabel(el, 'More')!.click();
    const items = [...scope(el).querySelectorAll('.zine-controls-menu button')];
    expect(items.map((b) => b.getAttribute('aria-label'))).not.toContain('Download PDF');
  });

  it('hides a submenu whose entries have all hidden themselves', async () => {
    const { el } = await mount({
      controls: { items: [{ id: 'empty', title: 'Empty', children: ['download'] }] },
    });
    expect(byLabel(el, 'Empty')?.style.display).toBe('none');
  });

  it('saves the file when Download PDF is chosen', async () => {
    const { el } = await mount({ source: new DownloadableSource(8) });
    const clicked: { href: string; download: string }[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
    };
    try {
      byLabel(el, 'More')!.click();
      const item = [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')].find(
        (b) => b.getAttribute('aria-label') === 'Download PDF',
      )!;
      item.click();
      await flush();
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(clicked).toEqual([{ href: '/brochure.pdf', download: 'brochure.pdf' }]);
  });

  it('toggles the thumbnail rail from the menu', async () => {
    const { el } = await mount({ source: new DocSource(8) });
    byLabel(el, 'More')!.click();
    expect(thumbsItem(el).getAttribute('aria-label')).toBe('Show thumbnails');
    thumbsItem(el).click();
    await flush();
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();

    byLabel(el, 'More')!.click();
    expect(thumbsItem(el).getAttribute('aria-label')).toBe('Hide thumbnails'); // follows state
    thumbsItem(el).click();
    await flush();
    expect(scope(el).querySelector('.zine-thumbs')).toBeNull();
  });

  it('offers neither panel on an image book', async () => {
    const { el } = await mount(); // plain images: no text, no outline
    byLabel(el, 'More')!.click();
    const labels = [...scope(el).querySelectorAll('.zine-controls-menu button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).not.toContain('Show thumbnails');
    expect(labels).not.toContain('Show outline');
  });

  it('gives the rail one row per spread, pairing pages as the book does', async () => {
    // 8 pages in 'double' → 4 rows of two.
    const { el } = await mount({ source: new DocSource(8), spreadMode: 'double' });
    await openThumbs(el);
    const rows = [...scope(el).querySelectorAll('.zine-thumbs-row')];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute('aria-label')).toBe('Pages 1–2');
    expect(rows[0]?.querySelectorAll('.zine-thumbs-cell')).toHaveLength(2);
  });

  it('gives a single-page book one page per row and a one-page-wide rail', async () => {
    const { el } = await mount({ source: new DocSource(8), spreadMode: 'single' });
    await openThumbs(el);
    const rail = scope(el).querySelector('.zine-thumbs')!;
    const rows = [...rail.querySelectorAll('.zine-thumbs-row')];
    expect(rows).toHaveLength(8);
    expect(rows[0]?.getAttribute('aria-label')).toBe('Page 1');
    // No page pairs anywhere, so the rail is not two thumbs wide.
    expect(rail.classList.contains('zine-thumbs-solo')).toBe(true);
    expect(rows.every((r) => r.querySelectorAll('.zine-thumbs-cell').length === 1)).toBe(true);
  });

  it('centres a lone cover between the two columns a paired book uses', async () => {
    // 'cover': page 1 alone, then pairs — so the rail keeps two columns and singles out row 0.
    const { el } = await mount({ source: new DocSource(8), spreadMode: 'cover' });
    await openThumbs(el);
    const rail = scope(el).querySelector('.zine-thumbs')!;
    const rows = [...rail.querySelectorAll('.zine-thumbs-row')];
    expect(rail.classList.contains('zine-thumbs-solo')).toBe(false); // still two columns
    expect(rows[0]?.classList.contains('zine-thumbs-row-lone')).toBe(true);
    expect(rows[0]?.querySelectorAll('.zine-thumbs-cell')).toHaveLength(1); // no blank filler
    expect(rows[1]?.classList.contains('zine-thumbs-row-lone')).toBe(false);
  });

  it('takes the rail down with the book', async () => {
    const { zine, el } = await mount({ source: new DocSource(8) });
    await openThumbs(el);
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();
    zine.destroy();
    expect(document.querySelector('.zine-panel')).toBeNull();
  });
});

describe('controls page arrows', () => {
  const arrows = (el: HTMLElement): HTMLButtonElement[] => [
    ...scope(el).querySelectorAll<HTMLButtonElement>('.zine-arrow'),
  ];
  const arrow = (el: HTMLElement, label: string): HTMLButtonElement =>
    arrows(el).find((b) => b.getAttribute('aria-label') === label)!;

  it('flanks the book with a back and a forward arrow', async () => {
    const { el } = await mount();
    expect(arrows(el).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Previous page',
      'Next page',
    ]);
  });

  it('keeps the arrows outside the container, which the renderer measures', async () => {
    const { el } = await mount();
    expect(el.querySelector('.zine-arrow')).toBeNull();
  });

  it('turns the page when pressed', async () => {
    const { zine, el } = await mount();
    expect(zine.getPage()).toBe(0);
    arrow(el, 'Next page').click();
    await flush();
    expect(zine.getPage()).toBeGreaterThan(0);
  });

  it('hides an arrow that has nowhere to go, and brings it back', async () => {
    const { zine, el } = await mount();
    const back = arrow(el, 'Previous page');
    expect(back.classList.contains('zine-arrow-hidden')).toBe(true);
    expect(back.disabled).toBe(true); // inert as well as invisible
    zine.flipNext();
    await flush();
    expect(back.classList.contains('zine-arrow-hidden')).toBe(false);
    expect(back.disabled).toBe(false);
  });

  it('keeps a hidden arrow in the layout so the book does not slide across', async () => {
    // Removing it from the flow would shift the book sideways at every cover.
    const { el } = await mount();
    expect(arrow(el, 'Previous page').isConnected).toBe(true);
  });

  it('renders none when arrows are turned off', async () => {
    const { el } = await mount({ controls: { arrows: false } });
    expect(arrows(el)).toHaveLength(0);
  });

  it('leaves the DOM as it found it on destroy', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const el = document.createElement('div');
    host.append(el);
    const zine = new Zine(el, { source: new FakeSource(8), renderer: new MockRenderer() });
    await zine.ready;
    await flush();
    expect(el.parentElement).not.toBe(host); // wrapped by toolbar and arrows
    zine.destroy();
    expect(el.parentElement).toBe(host);
    expect(host.querySelector('.zine-arrows-wrap')).toBeNull();
  });
});

describe('controls outline panel', () => {
  const toc = (): OutlineItem[] => [
    { title: 'Introduction', page: 0, children: [{ title: 'Background', page: 1, children: [] }] },
    { title: 'Results', page: 4, children: [] },
    { title: 'Broken link', page: null, children: [] },
  ];
  /** The outline control only appears once the document is known to have entries, and that
   *  answer arrives through a chain of promises rather than in a single microtask. */
  const outlineItem = async (el: HTMLElement): Promise<HTMLButtonElement> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      byLabel(el, 'More')?.click();
      const found = [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')]
        .find((b) => (b.getAttribute('aria-label') ?? '').includes('outline'));
      if (found) return found;
      await flush();
    }
    throw new Error('the outline control never appeared');
  };
  const openOutline = async (el: HTMLElement): Promise<void> => {
    (await outlineItem(el)).click();
    await flush();
    await flush(); // the panel then resolves and renders it
  };

  it('lists every heading, nested ones indented', async () => {
    const { el } = await mount({ source: new DocSource(8, toc()) });
    await openOutline(el);
    const rows = [...scope(el).querySelectorAll<HTMLElement>('.zine-outline-row')];
    expect(rows.map((r) => r.textContent)).toEqual([
      'Introduction',
      'Background',
      'Results',
      'Broken link',
    ]);
    // The child is indented one level past its parent.
    expect(rows[1]!.style.paddingLeft).not.toBe(rows[0]!.style.paddingLeft);
  });

  it('turns to a heading’s page when clicked', async () => {
    const { zine, el } = await mount({ source: new DocSource(8, toc()) });
    await openOutline(el);
    const results = [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-outline-row')].find(
      (r) => r.textContent === 'Results',
    )!;
    results.click();
    await flush();
    expect(zine.getPage()).toBe(4);
  });

  it('shows an unresolvable heading but does not let it be clicked', async () => {
    const { el } = await mount({ source: new DocSource(8, toc()) });
    await openOutline(el);
    const broken = [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-outline-row')].find(
      (r) => r.textContent === 'Broken link',
    )!;
    expect(broken.disabled).toBe(true);
  });

  it('does not offer the outline when the document has none', async () => {
    // A control whose only outcome is reporting its own emptiness is worse than no control.
    const { el } = await mount({ source: new DocSource(8, []) });
    for (let i = 0; i < 5; i++) await flush(); // give the lookup every chance to settle
    byLabel(el, 'More')!.click();
    const labels = [...scope(el).querySelectorAll('.zine-controls-menu button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).not.toContain('Show outline');
    expect(labels).toContain('Show thumbnails'); // the page rail is still on offer
  });

  it('offers the outline once its entries are known', async () => {
    const { el } = await mount({ source: new DocSource(8, toc()) });
    expect(await outlineItem(el)).toBeTruthy();
  });

  it('opens search in the same rail, replacing whichever panel was up', async () => {
    const { el } = await mount({ source: new DocSource(8, toc()) });
    await openThumbs(el);
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();
    byLabel(el, 'Search')!.click();
    await flush();
    expect(scope(el).querySelector('.zine-search')).not.toBeNull();
    expect(scope(el).querySelector('.zine-thumbs')).toBeNull(); // one rail, one panel
  });

  it('closes search on a second press of its button', async () => {
    const { el } = await mount({ source: new DocSource(8, toc()) });
    // The label flips to 'Hide search' once open, so hold the element rather than re-find it.
    const button = byLabel(el, 'Search')!;
    button.click();
    await flush();
    expect(scope(el).querySelector('.zine-search')).not.toBeNull();
    button.click();
    await flush();
    expect(scope(el).querySelector('.zine-search')).toBeNull();
  });

  it('replaces the thumbnail rail rather than stacking beside it', async () => {
    // Both panels want the same space, so opening one closes the other.
    const { el } = await mount({ source: new DocSource(8, toc()) });
    await openThumbs(el);
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();
    await openOutline(el);
    expect(scope(el).querySelector('.zine-outline')).not.toBeNull();
    expect(scope(el).querySelector('.zine-thumbs')).toBeNull();
  });

  it('hides search on a book whose source has no text', async () => {
    const { el } = await mount();
    expect(byLabel(el, 'Search')?.style.display).toBe('none');
  });

  it('shows search when the source can produce text', async () => {
    const { el } = await mount({ source: new TextSource(['alpha', 'beta', 'gamma', 'delta']) });
    expect(byLabel(el, 'Search')?.style.display).not.toBe('none');
  });

  it('marks up the toolbar as a labelled toolbar landmark', async () => {
    const { el } = await mount();
    const root = toolbar(el)!;
    expect(root.getAttribute('role')).toBe('toolbar');
    expect(root.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not add a second aria-live region', async () => {
    const { el } = await mount();
    expect(el.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  });

  it('ships the documented default layout', () => {
    expect(DEFAULT_ITEMS).toContain('prev');
    expect(DEFAULT_ITEMS).toContain('next');
    expect(DEFAULT_ITEMS).toContain('pageInput');
  });
});

describe('Zine.search', () => {
  it('reports whether the book is searchable', async () => {
    const plain = await mount();
    expect(plain.zine.canSearch()).toBe(false);
    const rich = await mount({ source: new TextSource(['a', 'b']) });
    expect(rich.zine.canSearch()).toBe(true);
  });

  it('finds matching pages case-insensitively with an excerpt', async () => {
    const { zine } = await mount({
      source: new TextSource(['nothing here', 'the Invoice total is due', 'nor here']),
    });
    const hits = await zine.search('invoice');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.page).toBe(1);
    expect(hits[0]?.excerpt).toContain('Invoice');
  });

  it('returns nothing for an empty query or an unsearchable book', async () => {
    const { zine } = await mount({ source: new TextSource(['alpha']) });
    expect(await zine.search('   ')).toEqual([]);
    const plain = await mount();
    expect(await plain.zine.search('alpha')).toEqual([]);
  });
});

describe('Zine.print', () => {
  it('reports whether the book can be printed', async () => {
    expect((await mount()).zine.canPrint()).toBe(false);
    expect((await mount({ source: new DownloadableSource(4) })).zine.canPrint()).toBe(true);
  });

  it('resolves false for a book with no original document', async () => {
    const { zine } = await mount();
    expect(await zine.print()).toBe(false);
  });

  it('hands the document to an offscreen frame rather than printing the page', async () => {
    // Printing the host page would capture the toolbar and one spread; the browser paginates
    // the PDF itself.
    const { zine } = await mount({ source: new DownloadableSource(8) });
    const printed: string[] = [];
    // happy-dom does not navigate iframes, so stand in for the frame's own window.
    const define = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        return { focus: () => {}, print: () => printed.push((this as HTMLIFrameElement).src) };
      },
    });
    try {
      const done = zine.print();
      const frame = document.querySelector('iframe')!;
      expect(frame.src).toContain('/brochure.pdf');
      frame.dispatchEvent(new Event('load'));
      expect(await done).toBe(true);
      expect(printed).toEqual(['/brochure.pdf']);
    } finally {
      if (define) Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', define);
    }
  });
});

describe('Zine.download', () => {
  it('reports whether the book has an original file', async () => {
    expect((await mount()).zine.canDownload()).toBe(false);
    expect((await mount({ source: new DownloadableSource(4) })).zine.canDownload()).toBe(true);
  });

  it('resolves false for a book with nothing to save', async () => {
    const { zine } = await mount();
    expect(await zine.download()).toBe(false);
  });

  it('resolves false when the source declines to hand over a file', async () => {
    // A PDF built from a caller-owned pdf.js document: getDownload exists but yields null.
    class NoFile extends FakeSource {
      async getDownload(): Promise<null> {
        return null;
      }
    }
    const { zine } = await mount({ source: new NoFile(4) });
    expect(zine.canDownload()).toBe(true);
    expect(await zine.download()).toBe(false);
  });
});
