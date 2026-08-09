// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zine, type ZineOptions } from '../zine';
import { defineControl, DEFAULT_ITEMS, resolveControl } from './registry';
import type { Source } from '../source/types';
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

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount(opts: Partial<ZineOptions> = {}): Promise<{ zine: Zine; el: HTMLElement }> {
  const el = document.createElement('div');
  document.body.append(el);
  const zine = new Zine(el, {
    source: new FakeSource(8),
    renderer: new MockRenderer(),
    spreadMode: 'double',
    ...opts,
  });
  await zine.ready;
  await flush(); // the controls chunk is imported after first paint
  return { zine, el };
}

/** The toolbar is a sibling of the container when docked, a child when floating — search from
 *  whichever ancestor holds both. */
const scope = (el: HTMLElement): HTMLElement => (el.parentElement ?? el) as HTMLElement;
const toolbar = (el: HTMLElement): HTMLElement | null =>
  scope(el).querySelector('.zine-controls');
const buttons = (el: HTMLElement): HTMLButtonElement[] => [
  ...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-bar .zine-controls-btn'),
];
const byLabel = (el: HTMLElement, label: string): HTMLButtonElement | undefined =>
  buttons(el).find((b) => b.getAttribute('aria-label') === label);

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
    const { el } = await mount();
    const open = (): HTMLButtonElement =>
      [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')].find((b) =>
        (b.getAttribute('aria-label') ?? '').includes('thumbnails'),
      )!;

    byLabel(el, 'More')!.click();
    expect(open().getAttribute('aria-label')).toBe('Show thumbnails');
    open().click();
    await flush();
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();

    byLabel(el, 'More')!.click();
    expect(open().getAttribute('aria-label')).toBe('Hide thumbnails'); // label follows state
    open().click();
    await flush();
    expect(scope(el).querySelector('.zine-thumbs')).toBeNull();
  });

  it('gives the rail one row per spread, pairing pages as the book does', async () => {
    // 8 pages in 'double' → 4 rows of two.
    const { el } = await mount({ spreadMode: 'double' });
    (el as HTMLElement).ownerDocument.body.focus();
    byLabel(el, 'More')!.click();
    [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')]
      .find((b) => (b.getAttribute('aria-label') ?? '').includes('thumbnails'))!
      .click();
    await flush();
    const rows = [...scope(el).querySelectorAll('.zine-thumbs-row')];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute('aria-label')).toBe('Pages 1–2');
  });

  it('gives a single-page book one page per row', async () => {
    const { el } = await mount({ spreadMode: 'single' });
    byLabel(el, 'More')!.click();
    [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')]
      .find((b) => (b.getAttribute('aria-label') ?? '').includes('thumbnails'))!
      .click();
    await flush();
    const rows = [...scope(el).querySelectorAll('.zine-thumbs-row')];
    expect(rows).toHaveLength(8);
    expect(rows[0]?.getAttribute('aria-label')).toBe('Page 1');
  });

  it('takes the rail down with the book', async () => {
    const { zine, el } = await mount();
    byLabel(el, 'More')!.click();
    [...scope(el).querySelectorAll<HTMLButtonElement>('.zine-controls-menu button')]
      .find((b) => (b.getAttribute('aria-label') ?? '').includes('thumbnails'))!
      .click();
    await flush();
    expect(scope(el).querySelector('.zine-thumbs')).not.toBeNull();
    zine.destroy();
    expect(document.querySelector('.zine-thumbs')).toBeNull();
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
