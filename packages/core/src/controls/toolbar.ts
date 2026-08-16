import { createIcon, ICONS } from './icons';
import { DEFAULT_ITEMS, defineControl, resolveControl } from './registry';
import { registerBuiltins } from './builtins';
import { applyColorScheme, ensureStyles } from './styles';
import { Thumbnails } from './thumbnails';
import { Outline } from './outline';
import { Search } from './search';
import { Arrows } from './arrows';

/** The side panels, all of which share the one rail beside the book. */
const PANELS = { thumbnails: Thumbnails, outline: Outline, search: Search };
type PanelKind = keyof typeof PANELS;
/** What every panel has in common: build itself on construction, and clean up after itself. */
type Panel = InstanceType<(typeof PANELS)[PanelKind]>;
import type {
  ControlContext,
  ControlDef,
  ControlItem,
  ControlsColorScheme,
  ControlsOptions,
  ControlsPosition,
} from './types';
import type { Zine } from '../zine';

/**
 * Events the container listens to for flipping, zooming and dragging. The gesture layer binds
 * these on the container and never checks `event.target`, so anything the toolbar handles has to
 * be stopped here or a button press would also register as a page tap.
 */
const SWALLOWED = ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'wheel', 'keydown'];

interface Popover {
  el: HTMLElement;
  trigger: HTMLElement;
}

export class Toolbar {
  #zine: Zine;
  #doc: Document;
  #root: HTMLElement;
  #bar: HTMLElement;
  /** Every control on screen, buttons and `render` widgets alike, so #refresh can reach them. */
  #buttons: { el: HTMLElement; def: ControlDef }[] = [];
  #popover: Popover | null = null;
  #unsubscribe: (() => void)[] = [];
  #pageInput: HTMLInputElement | null = null;
  /** The flex wrapper docked mode inserts around the container; unwound on destroy. */
  #wrap: HTMLElement | null = null;
  #container: HTMLElement;
  /** The side panel currently in the rail. Only one at a time — they share the space. */
  #panel: Panel | null = null;
  #panelKind: PanelKind | null = null;
  /** Whether the document turned out to have any outline entries. Null until known: the answer
   *  is async, and the outline control stays hidden rather than flash in and out. */
  #hasOutline: boolean | null = null;
  #arrows: Arrows | null = null;
  /** Which palette the built-in colours resolve to. Passed on to the arrows, panels and share
   *  dialog, each of which mounts its own root outside this one and so must be stamped too. */
  #colorScheme: ControlsColorScheme;

  constructor(zine: Zine, container: HTMLElement, options: ControlsOptions) {
    this.#zine = zine;
    this.#container = container;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    ensureStyles(doc);

    this.#colorScheme = options.colorScheme ?? 'auto';
    const position = options.position ?? 'bottom';
    const docked = options.docked ?? true;
    this.#root = doc.createElement('div');
    this.#root.className = [
      'zine-controls',
      `zine-controls-${position}`,
      docked ? 'zine-controls-docked' : 'zine-controls-floating',
      options.className,
    ]
      .filter(Boolean)
      .join(' ');
    this.#root.setAttribute('role', 'toolbar');
    this.#root.setAttribute('aria-label', 'Flipbook controls');
    applyColorScheme(this.#root, this.#colorScheme);

    this.#bar = doc.createElement('div');
    this.#bar.className = 'zine-controls-bar';
    this.#root.appendChild(this.#bar);

    // Toolbar keys are handled first, then every listed event is stopped so none of it reaches
    // the book's gesture, zoom or keyboard handlers on the container.
    this.#root.addEventListener('keydown', (e) => this.#onKeyDown(e as KeyboardEvent));
    for (const event of SWALLOWED) {
      this.#root.addEventListener(event, (e) => this.#isolate(e));
    }
    this.#place(container, position, docked);

    const refresh = (): void => this.#refresh();
    this.#unsubscribe.push(zine.on('pageChanged', refresh));
    this.#unsubscribe.push(zine.on('zoomChanged', refresh));
    this.#unsubscribe.push(zine.on('flipEnd', refresh));
    const onDocPointer = (e: Event): void => {
      if (this.#popover && !this.#popover.el.contains(e.target as Node)) this.#closePopover();
    };
    doc.addEventListener('pointerdown', onDocPointer, true);
    this.#unsubscribe.push(() => doc.removeEventListener('pointerdown', onDocPointer, true));
  }

  /**
   * Put the toolbar in the page.
   *
   * Floating is simple: a child of the container, absolutely positioned over the book.
   *
   * Docked has to sit *outside* the container, because the container's measured box is what the
   * renderer sizes the book from and what pointer hit-testing maps into — a bar inside it would
   * shrink the book and skew every tap. So the container is wrapped in a flex column (or row),
   * with the toolbar as its sibling. The wrapper inherits the container's own layout box so the
   * arrangement the consumer's CSS set up is preserved.
   */
  #place(container: HTMLElement, position: ControlsPosition, docked: boolean): void {
    if (!docked) {
      container.appendChild(this.#root);
      return;
    }
    const parent = container.parentNode;
    if (!parent) {
      // Not in a document yet: fall back to overlaying rather than losing the toolbar.
      this.#root.classList.replace('zine-controls-docked', 'zine-controls-floating');
      container.appendChild(this.#root);
      return;
    }
    const wrap = this.#doc.createElement('div');
    wrap.className = `zine-controls-wrap zine-controls-wrap-${position}`;
    parent.insertBefore(wrap, container);
    wrap.appendChild(container);
    // 'top'/'left' put the bar first; flex-direction (set in CSS) handles the axis.
    if (position === 'top' || position === 'left') wrap.insertBefore(this.#root, container);
    else wrap.appendChild(this.#root);
    this.#wrap = wrap;
  }

  /** Build the layout. Separate from construction so instance-bound widgets (the page field, the
   *  search panel) can be registered against this toolbar first. */
  mount(options: ControlsOptions): void {
    this.#build(options.items ?? DEFAULT_ITEMS);
    // After #place, so the arrows can wrap whatever it built around the book.
    if (options.arrows ?? true)
      this.#arrows = new Arrows(this.#zine, this.#container, this.#colorScheme);
    this.#refresh();
    this.#probeOutline();
  }

  destroy(): void {
    for (const off of this.#unsubscribe) off();
    this.#unsubscribe = [];
    this.#closePopover();
    this.#panel?.destroy();
    this.#panel = null;
    this.#panelKind = null;
    this.#root.remove();
    // Unwrap from the inside out: the arrows enclose the toolbar's wrapper, so removing theirs
    // first would leave this one orphaned outside the document.
    const wrap = this.#wrap;
    if (wrap?.parentNode) {
      wrap.parentNode.insertBefore(wrap.firstChild!, wrap);
      wrap.remove();
    }
    this.#wrap = null;
    this.#arrows?.destroy();
    this.#arrows = null;
  }

  /** Keep toolbar interaction from reaching the book's own gesture/zoom/keyboard handlers. */
  #isolate(event: Event): void {
    event.stopPropagation();
  }

  #context(close: () => void = () => this.#closePopover()): ControlContext {
    return { zine: this.#zine, close, colorScheme: this.#colorScheme };
  }

  #build(items: readonly ControlItem[]): void {
    for (const item of items) {
      if (item === '|') {
        const sep = this.#doc.createElement('div');
        sep.className = 'zine-controls-sep';
        this.#bar.appendChild(sep);
        continue;
      }
      const def = resolveControl(item);
      let el: HTMLElement;
      if (def.render) {
        el = def.render(this.#context());
        // Registered like any button so its predicates are re-read on every change; #button
        // does this for the controls it builds.
        this.#buttons.push({ el, def });
      } else {
        el = this.#button(def, 'zine-controls-btn');
      }
      this.#bar.appendChild(el);
    }
  }

  /** A control button. Bar buttons are icon-only with the title as tooltip; menu items and any
   *  control without an icon also carry a visible label. */
  /** A control's label, which may be a function of the current state. */
  #titleOf(def: ControlDef): string {
    return typeof def.title === 'function' ? def.title(this.#context()) : def.title;
  }

  /** A control's glyph, which may likewise depend on state (an RTL mirror, say). */
  #iconOf(def: ControlDef): string | undefined {
    return typeof def.icon === 'function' ? def.icon(this.#context()) : def.icon;
  }

  #button(def: ControlDef, className: string, withLabel = false): HTMLButtonElement {
    const btn = this.#doc.createElement('button');
    const title = this.#titleOf(def);
    const icon = this.#iconOf(def);
    btn.type = 'button';
    btn.className = className;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    if (icon) btn.appendChild(createIcon(this.#doc, icon));
    if (withLabel || !icon) {
      const label = this.#doc.createElement('span');
      label.className = 'zine-controls-label';
      label.textContent = title;
      btn.appendChild(label);
    }
    btn.addEventListener('click', () => this.#activate(def, btn));
    this.#buttons.push({ el: btn, def });
    return btn;
  }

  #activate(def: ControlDef, trigger: HTMLButtonElement): void {
    if (def.isDisabled?.(this.#context())) return;
    // A submenu toggles its popover; a second press on the same trigger closes it.
    if (def.children) {
      if (this.#popover?.trigger === trigger) this.#closePopover();
      else this.#openMenu(def, trigger);
      return;
    }
    def.action?.(this.#context());
    this.#refresh();
  }

  #openMenu(def: ControlDef, trigger: HTMLButtonElement): void {
    this.#closePopover();
    const menu = this.#doc.createElement('div');
    menu.className = 'zine-controls-menu';
    menu.setAttribute('role', 'menu');
    const ctx = this.#context();
    for (const child of def.children ?? []) {
      if (child === '|') continue;
      const childDef = resolveControl(child);
      if (childDef.isVisible && !childDef.isVisible(ctx)) continue;
      let item: HTMLElement;
      if (childDef.render) {
        item = childDef.render(this.#context());
        this.#buttons.push({ el: item, def: childDef });
      } else {
        item = this.#button(childDef, 'zine-controls-btn', true);
      }
      item.setAttribute('role', 'menuitem');
      menu.appendChild(item);
    }
    this.#showPopover(menu, trigger);
    // The entries were only just built, so nothing has evaluated their state yet: without this
    // a menu opens with every entry enabled until the next page turn happens to refresh it.
    this.#refresh();
    menu.querySelector('button')?.focus();
  }

  #showPopover(el: HTMLElement, trigger: HTMLElement): void {
    this.#root.appendChild(el);
    this.#popover = { el, trigger };
    trigger.setAttribute('aria-expanded', 'true');
    this.#placePopover(el, trigger);
  }

  /** Anchor a popover to its trigger, flipped to stay inside the book. */
  #placePopover(el: HTMLElement, trigger: HTMLElement): void {
    const root = this.#root.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (!root.width || !box.width) return; // not laid out (e.g. jsdom): leave to CSS
    let left = anchor.left - root.left + anchor.width / 2 - box.width / 2;
    left = Math.max(4, Math.min(left, root.width - box.width - 4));
    el.style.left = `${left}px`;
    // Prefer opening away from the edge the toolbar sits on.
    const below = anchor.bottom - root.top + 6;
    const above = anchor.top - root.top - box.height - 6;
    el.style.top = `${above >= 0 ? above : below}px`;
  }

  #closePopover(): void {
    if (!this.#popover) return;
    const { el, trigger } = this.#popover;
    this.#popover = null;
    trigger.removeAttribute('aria-expanded');
    // Drop buttons that belonged to the popover so #refresh stops touching detached nodes.
    this.#buttons = this.#buttons.filter((b) => !el.contains(b.el));
    el.remove();
    if (this.#doc.activeElement && el.contains(this.#doc.activeElement)) trigger.focus();
  }

  /** Arrow keys move between controls; Escape dismisses an open popover. */
  #onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.#popover) {
      const { trigger } = this.#popover;
      this.#closePopover();
      trigger.focus();
      event.preventDefault();
      return;
    }
    const focusables = [...this.#root.querySelectorAll<HTMLElement>('button, input')];
    const at = focusables.indexOf(this.#doc.activeElement as HTMLElement);
    if (at < 0) return;
    // Let the page-number field use its own arrows for text editing.
    if (this.#doc.activeElement instanceof HTMLInputElement) return;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    const next = focusables[(at + step + focusables.length) % focusables.length];
    next?.focus();
    event.preventDefault();
  }

  /**
   * Re-read every control's state after the book changes.
   *
   * Applies to custom widgets built with `render` as well as to plain buttons: the predicates
   * are on `ControlDef`, so honouring them only for button-shaped controls would make the same
   * field mean different things depending on how a control chose to draw itself. A widget may be
   * any element, so each piece of state is applied in whatever way that element supports.
   */
  #refresh(): void {
    const ctx = this.#context();
    for (const { el, def } of this.#buttons) {
      // Does not apply to this book at all: take the space back, it is not coming again.
      const applies = def.children ? this.#hasVisibleChildren(def, ctx) : def.isVisible?.(ctx);
      if (applies !== undefined) el.style.display = applies ? '' : 'none';

      const disabled = def.isDisabled?.(ctx) ?? false;
      // A wrapper element cannot be disabled, so mark it and disable the fields inside.
      for (const field of this.#formFields(el)) field.disabled = disabled;
      if (!this.#formFields(el).length) el.setAttribute('aria-disabled', String(disabled));
      el.classList.toggle('zine-controls-off', disabled);

      if (def.isActive) el.setAttribute('aria-pressed', String(def.isActive(ctx)));
      if (typeof def.title === 'function') {
        const title = def.title(ctx);
        el.title = title;
        el.setAttribute('aria-label', title);
        const label = el.querySelector('.zine-controls-label');
        if (label) label.textContent = title;
      }
      if (typeof def.icon === 'function') {
        el.querySelector('svg')?.replaceWith(createIcon(this.#doc, def.icon(ctx)));
      }
    }
    if (this.#pageInput && this.#doc.activeElement !== this.#pageInput) {
      this.#pageInput.value = String(this.#zine.getPage() + 1);
    }
  }

  /** The element itself if it can be disabled, else any inputs/buttons it wraps. */
  #formFields(el: HTMLElement): (HTMLButtonElement | HTMLInputElement)[] {
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) return [el];
    return [...el.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')];
  }

  /** A submenu is only worth showing if something inside it is. Keeps the overflow button from
   *  opening onto nothing when every entry has hidden itself. */
  #hasVisibleChildren(def: ControlDef, ctx: ControlContext): boolean {
    if (def.isVisible && !def.isVisible(ctx)) return false;
    return (def.children ?? []).some((child) => {
      if (child === '|') return false;
      const childDef = resolveControl(child);
      return childDef.isVisible ? childDef.isVisible(ctx) : true;
    });
  }

  /** Registered lazily by {@link registerWidgets} so the widget can reach this instance. */
  makePageInput(): HTMLElement {
    const wrap = this.#doc.createElement('div');
    wrap.className = 'zine-controls-page';
    const input = this.#doc.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(this.#zine.getPageCount());
    input.value = String(this.#zine.getPage() + 1);
    input.setAttribute('aria-label', 'Page number');
    const total = this.#doc.createElement('span');
    total.textContent = `/ ${this.#zine.getPageCount()}`;

    // Enter commits and then blurs, and the blur commits again; a click-away blur commits on its
    // own. Guard so only the first call per editing session navigates: flipTo animates, so a
    // second commit right after would read the still-old getPage() and turn the book back to it —
    // the page that is (still) in the URL hash. Re-armed on focus for the next edit.
    let committed = false;
    const commit = (): void => {
      if (committed) return;
      committed = true;
      const n = Number(input.value);
      const last = Math.max(0, this.#zine.getPageCount() - 1);
      const target = Number.isFinite(n)
        ? Math.min(Math.max(Math.round(n) - 1, 0), last)
        : this.#zine.getPage();
      if (target !== this.#zine.getPage()) {
        this.#zine.flipTo(target); // #refresh (pageChanged/flipEnd) resyncs the field once it lands
      } else {
        input.value = String(this.#zine.getPage() + 1); // no navigation: restore the display now
      }
    };
    input.addEventListener('focus', () => {
      committed = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commit();
        input.blur();
      }
    });
    input.addEventListener('blur', commit);
    wrap.append(input, total);
    this.#pageInput = input;
    return wrap;
  }

  /** Which side panel is showing, if any. */
  openPanel(): PanelKind | null {
    return this.#panelKind;
  }

  /**
   * Whether this document has a table of contents worth offering.
   *
   * Many PDFs have none, and a control that can only report its own emptiness is a dead end, so
   * the outline button stays hidden until the outline is known to be non-empty. The first call
   * kicks off the lookup and refreshes the toolbar when it lands; `Zine.getOutline` memoizes, so
   * the panel does not pay for it twice.
   */
  hasOutline(): boolean {
    return this.#hasOutline === true;
  }

  /** Ask the document whether it has an outline, and refresh once the answer lands. Started as
   *  the toolbar mounts so the button settles into place immediately rather than on first use. */
  #probeOutline(): void {
    if (this.#hasOutline !== null || !this.#zine.canOutline()) return;
    this.#hasOutline = false; // assume not, until we hear otherwise
    void this.#zine.getOutline().then((items) => {
      if (items.length === 0) return;
      this.#hasOutline = true;
      this.#refresh();
      // The menu may already be open with the entry missing; rebuild it so it appears.
      const popover = this.#popover;
      if (popover) {
        const def = this.#buttons.find((b) => b.el === popover.trigger)?.def;
        this.#closePopover();
        if (def) this.#openMenu(def, popover.trigger as HTMLButtonElement);
      }
    });
  }

  /**
   * Show one of the side panels, or close it if it is already up. They share the rail beside the
   * book, so opening one closes the others. Rebuilt each time, so the thumbnail rail always
   * matches the current spread grouping (which `spreadMode` and the responsive fallback change).
   */
  togglePanel(kind: PanelKind): void {
    const wasOpen = this.#panelKind;
    this.#panel?.destroy();
    this.#panel = null;
    this.#panelKind = null;
    if (wasOpen !== kind) {
      this.#panel = new PANELS[kind](this.#zine, this.#container);
      applyColorScheme(this.#panel.root, this.#colorScheme);
      this.#panelKind = kind;
    }
    this.#refresh();
  }

}

/**
 * Controls that need the toolbar itself (a DOM widget, or a panel to open) are registered per
 * instance, since the registry is module-level and shared.
 */
export function registerWidgets(toolbar: Toolbar): void {
  registerBuiltins();
  defineControl({
    id: 'thumbnails',
    title: () => (toolbar.openPanel() === 'thumbnails' ? 'Hide thumbnails' : 'Show thumbnails'),
    icon: ICONS.thumbnails,
    // Documents only, for now: an image book is already a short, flat list of pictures.
    isVisible: (ctx) => ctx.zine.isDocument(),
    isActive: () => toolbar.openPanel() === 'thumbnails',
    action: (ctx) => {
      toolbar.togglePanel('thumbnails');
      ctx.close();
    },
  });
  defineControl({
    id: 'outline',
    title: () => (toolbar.openPanel() === 'outline' ? 'Hide outline' : 'Show outline'),
    icon: ICONS.outline,
    // Only when the document actually has entries to show.
    isVisible: () => toolbar.hasOutline(),
    isActive: () => toolbar.openPanel() === 'outline',
    action: (ctx) => {
      toolbar.togglePanel('outline');
      ctx.close();
    },
  });
  defineControl({
    id: 'pageInput',
    title: 'Page',
    render: () => toolbar.makePageInput(),
  });
  defineControl({
    id: 'search',
    title: () => (toolbar.openPanel() === 'search' ? 'Hide search' : 'Search'),
    icon: ICONS.search,
    isVisible: (ctx) => ctx.zine.canSearch(),
    isActive: () => toolbar.openPanel() === 'search',
    action: () => toolbar.togglePanel('search'),
  });
}
