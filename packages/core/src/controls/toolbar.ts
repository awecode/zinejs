import { ICONS } from './icons';
import { DEFAULT_ITEMS, defineControl, resolveControl } from './registry';
import { registerBuiltins } from './builtins';
import {
  activateControl,
  applyControlItemState,
  buildControlButton,
  ControlMenu,
  filterHidden,
  hasVisibleChildren,
} from './menu';
import { applyColorScheme, ensureStyles } from './styles';
import { Thumbnails } from './thumbnails';
import { Outline } from './outline';
import { Search, type SearchState } from './search';
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
  menu: ControlMenu;
  trigger: HTMLElement;
}

/**
 * Tidy the separator runs a hide-list can leave behind on the bar: drop leading and trailing
 * separators, and collapse consecutive ones to a single divider. The overflow menu drops all
 * separators anyway, so this only matters for the bar itself.
 */
function collapseSeparators(items: readonly ControlItem[]): ControlItem[] {
  const out: ControlItem[] = [];
  for (const item of items) {
    if (item === '|' && (out.length === 0 || out[out.length - 1] === '|')) continue;
    out.push(item);
  }
  if (out[out.length - 1] === '|') out.pop();
  return out;
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
  /** The last search's query and results, so reopening the search rail restores them rather than
   *  starting blank. Panels are rebuilt on every open, so this outlives the panel that holds it. */
  #searchState: SearchState | null = null;
  /** Whether the document turned out to have any outline entries. Null until known: the answer
   *  is async, and the outline control stays hidden rather than flash in and out. */
  #hasOutline: boolean | null = null;
  #arrows: Arrows | null = null;
  /** Which palette the built-in colours resolve to. Passed on to the arrows, panels and share
   *  dialog, each of which mounts its own root outside this one and so must be stamped too. */
  #colorScheme: ControlsColorScheme;
  /** The edge the bar sits on, kept so a popover can open away from it. */
  #position: ControlsPosition;
  /** Control ids hidden everywhere by the top-level `hideControls` option: off the bar, out of the
   *  overflow menu. Empty when nothing is hidden. */
  #hidden: ReadonlySet<string>;

  constructor(
    zine: Zine,
    container: HTMLElement,
    options: ControlsOptions,
    hidden: ReadonlySet<string> = new Set(),
  ) {
    this.#zine = zine;
    this.#container = container;
    this.#hidden = hidden;
    const doc = container.ownerDocument!;
    this.#doc = doc;
    ensureStyles(doc);

    this.#colorScheme = options.colorScheme ?? 'auto';
    const position = options.position ?? 'bottom';
    this.#position = position;
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
    this.#root.setAttribute('aria-label', this.#zine.strings.controlsLabel);
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
      if (!this.#popover) return;
      const target = e.target as Node;
      // Leave a press on the trigger to its own click handler, which toggles the menu shut —
      // closing here first would let that click reopen it, so it would never close.
      if (this.#popover.menu.contains(target) || this.#popover.trigger.contains(target)) return;
      this.#closePopover();
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
    // After #place, so the arrows can wrap whatever it built around the book. A string value picks
    // the device the arrows show on; only an explicit false suppresses them entirely.
    const arrows = options.arrows ?? true;
    if (arrows !== false)
      this.#arrows = new Arrows(
        this.#zine,
        this.#container,
        this.#colorScheme,
        arrows === true ? null : arrows,
      );
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
    return { zine: this.#zine, close, colorScheme: this.#colorScheme, strings: this.#zine.strings };
  }

  #build(items: readonly ControlItem[]): void {
    for (const item of collapseSeparators(filterHidden(items, this.#hidden))) {
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
      } else {
        el = buildControlButton(this.#doc, def, 'zine-controls-btn', this.#context(), (d, btn) =>
          this.#activate(d, btn),
        );
      }
      // Registered so its predicates are re-read on every change, whichever way it draws itself.
      this.#buttons.push({ el, def });
      this.#bar.appendChild(el);
    }
  }

  #activate(def: ControlDef, trigger: HTMLButtonElement): void {
    if (def.isDisabled?.(this.#context())) return;
    // A submenu toggles its popover; a second press on the same trigger closes it.
    if (def.children) {
      if (this.#popover?.trigger === trigger) this.#closePopover();
      else this.#openMenu(def, trigger);
      return;
    }
    activateControl(def, trigger, this.#context(), () => this.#refresh());
  }

  #openMenu(def: ControlDef, trigger: HTMLButtonElement): void {
    this.#closePopover();
    const menu = new ControlMenu(this.#doc, () => this.#context(), () => this.#refresh(), this.#hidden);
    menu.build(def.children ?? []);
    this.#root.appendChild(menu.el);
    this.#popover = { menu, trigger };
    trigger.setAttribute('aria-expanded', 'true');
    this.#placePopover(menu.el, trigger);
    // The entries were only just built, so nothing has evaluated their state yet: without this
    // a menu opens with every entry enabled until the next page turn happens to refresh it.
    menu.refresh();
    menu.focusFirst();
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
    const below = anchor.bottom - root.top + 6;
    const above = anchor.top - root.top - box.height - 6;
    // A bottom bar opens its menu upward (above the button), so it never spills off the bottom
    // edge — the book above always has the room. Every other edge keeps the pick-whichever-fits
    // behaviour, preferring upward only when there is space for it.
    el.style.top = `${this.#position === 'bottom' ? above : above >= 0 ? above : below}px`;
  }

  #closePopover(): void {
    if (!this.#popover) return;
    const { menu, trigger } = this.#popover;
    this.#popover = null;
    trigger.removeAttribute('aria-expanded');
    const hadFocus = this.#doc.activeElement !== null && menu.contains(this.#doc.activeElement);
    // The menu owns its own items, so tearing it down keeps #refresh off detached nodes.
    menu.destroy();
    if (hadFocus) trigger.focus();
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
      // A submenu trigger shows only while something inside it does; every other control follows
      // its own isVisible. Undefined leaves the element's display alone.
      const visible = def.children ? hasVisibleChildren(def, ctx, this.#hidden) : def.isVisible?.(ctx);
      applyControlItemState(el, def, ctx, this.#doc, visible);
    }
    // The open overflow menu owns its items, so refresh them through it.
    this.#popover?.menu.refresh();
    if (this.#pageInput && this.#doc.activeElement !== this.#pageInput) {
      this.#pageInput.value = String(this.#zine.getPage() + 1);
    }
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
    input.setAttribute('aria-label', this.#zine.strings.pageNumberLabel);
    const total = this.#doc.createElement('span');
    total.textContent = this.#zine.strings.pageTotal(this.#zine.getPageCount());

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
    // Remember the query and results before tearing the search rail down, so its next open picks
    // up where the reader left it instead of blank. Only search carries state worth keeping;
    // thumbnails and the outline are rebuilt from the document each time by design.
    if (this.#panel instanceof Search) this.#searchState = this.#panel.getState();
    this.#panel?.destroy();
    this.#panel = null;
    this.#panelKind = null;
    if (wasOpen !== kind) {
      // Reopening the same kind toggles it shut, the same path the toolbar button takes, so the
      // scrim and Escape can dismiss the narrow-screen drawer without any new close machinery.
      this.#panel = new PANELS[kind](this.#zine, this.#container, {
        onDismiss: () => this.togglePanel(kind),
        ...(kind === 'search' && this.#searchState ? { state: this.#searchState } : {}),
      });
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
    title: (ctx) =>
      toolbar.openPanel() === 'thumbnails' ? ctx.strings.hideThumbnails : ctx.strings.showThumbnails,
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
    title: (ctx) =>
      toolbar.openPanel() === 'outline' ? ctx.strings.hideOutline : ctx.strings.showOutline,
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
    title: (ctx) => ctx.strings.pageWidgetLabel,
    render: () => toolbar.makePageInput(),
  });
  defineControl({
    id: 'search',
    title: (ctx) => (toolbar.openPanel() === 'search' ? ctx.strings.searchClose : ctx.strings.searchOpen),
    icon: ICONS.search,
    isVisible: (ctx) => ctx.zine.canSearch(),
    isActive: () => toolbar.openPanel() === 'search',
    action: () => toolbar.togglePanel('search'),
  });
}
