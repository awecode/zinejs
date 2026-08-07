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

const buttons = (el: HTMLElement): HTMLButtonElement[] => [
  ...el.querySelectorAll<HTMLButtonElement>('.zine-controls-bar .zine-controls-btn'),
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
    expect(el.querySelector('.zine-controls')).not.toBeNull();
    zine.destroy();
    expect(el.querySelector('.zine-controls')).toBeNull();
  });

  it('renders nothing when controls are off', async () => {
    const { el } = await mount({ controls: false });
    expect(el.querySelector('.zine-controls')).toBeNull();
  });

  it('honours a custom layout and position', async () => {
    const { el } = await mount({ controls: { position: 'top', items: ['next'] } });
    const root = el.querySelector('.zine-controls')!;
    expect(root.classList.contains('zine-controls-top')).toBe(true);
    expect(buttons(el)).toHaveLength(1);
    expect(buttons(el)[0]?.getAttribute('aria-label')).toBe('Next page');
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

  it('does not let a control press reach the book as a page tap', async () => {
    // Gestures are bound on the container and never check event.target, so without the
    // toolbar's own stopPropagation a button press would also register as a tap-to-flip.
    const { el } = await mount();
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

  it('keeps arrow keys inside the toolbar rather than flipping the page', async () => {
    const { el } = await mount();
    const seen: string[] = [];
    el.addEventListener('keydown', (e) => seen.push((e as KeyboardEvent).key));
    byLabel(el, 'Next page')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(seen).toEqual([]);
  });

  it('shows the current page and jumps on submit', async () => {
    const { zine, el } = await mount();
    const input = el.querySelector<HTMLInputElement>('.zine-controls-page input')!;
    expect(input.value).toBe('1');
    input.value = '5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(zine.getPage()).toBe(4);
  });

  it('opens a submenu and closes it again on a second press', async () => {
    const { el } = await mount();
    const menu = byLabel(el, 'More')!;
    menu.click();
    expect(el.querySelector('.zine-controls-menu')).not.toBeNull();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    menu.click();
    expect(el.querySelector('.zine-controls-menu')).toBeNull();
    expect(menu.hasAttribute('aria-expanded')).toBe(false);
  });

  it('closes an open submenu on Escape', async () => {
    const { el } = await mount();
    byLabel(el, 'More')!.click();
    el.querySelector('.zine-controls')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(el.querySelector('.zine-controls-menu')).toBeNull();
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
    const root = el.querySelector('.zine-controls')!;
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
