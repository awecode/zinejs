import { getControl } from './registry';
import { registerBuiltins } from './builtins';
import { ControlMenu } from './menu';
import { applyColorScheme, ensureStyles } from './styles';
import type {
  ContextMenuOptions,
  ControlContext,
  ControlItem,
  ControlsColorScheme,
} from './types';
import type { Zine } from '../zine';

/** The controls a right-click offers by default: the reading and viewing actions that suit a
 *  pointer, each hidden by its own `isVisible` when it does not apply to this book. */
const DEFAULT_ITEMS: readonly ControlItem[] = [
  'zoomIn',
  'zoomOut',
  '|',
  'prev',
  'next',
  '|',
  'fullscreen',
  '|',
  'print',
  'download',
  'share',
];

/** Toolbar-only controls: they need the Toolbar instance registered per-book, so a context menu
 *  running without a toolbar cannot resolve them. Silently dropped rather than throwing. */
const TOOLBAR_ONLY = new Set(['pageInput', 'thumbnails', 'outline', 'search']);

/**
 * A right-click menu of reading controls, opened at the cursor over the book.
 *
 * It reuses the toolbar's control definitions and its {@link ControlMenu} body, so the same icons
 * and actions appear whether a reader reaches them from the toolbar or a right-click. It is opt-in
 * (`contextMenu` off by default), because overriding the browser's own menu is a real cost to pay
 * only when asked. Works with `controls: false` too, which is the point: a bare book with no
 * toolbar can still offer a right-click menu.
 */
export class ContextMenu {
  #zine: Zine;
  #container: HTMLElement;
  #doc: Document;
  #items: readonly ControlItem[];
  #colorScheme: ControlsColorScheme;
  #menu: ControlMenu | null = null;
  #unbind: (() => void)[] = [];

  constructor(zine: Zine, container: HTMLElement, options: ContextMenuOptions = {}) {
    this.#zine = zine;
    this.#container = container;
    this.#doc = container.ownerDocument!;
    // The built-ins have to exist before the layout resolves ids; harmless if the toolbar has
    // already registered them (the registry replaces by id).
    registerBuiltins();
    ensureStyles(this.#doc);
    this.#colorScheme = options.colorScheme ?? 'auto';
    // Drop toolbar-only controls a bare book cannot resolve, so a custom list never throws for one.
    this.#items = (options.items ?? DEFAULT_ITEMS).filter(
      (item) => typeof item !== 'string' || !TOOLBAR_ONLY.has(item) || getControl(item) !== undefined,
    );

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault(); // replace the browser's own menu with ours
      this.#open(event.clientX, event.clientY);
    };
    this.#container.addEventListener('contextmenu', onContextMenu);
    this.#unbind.push(() => this.#container.removeEventListener('contextmenu', onContextMenu));

    // Dismiss on a press anywhere outside the menu, and on Escape. Captured on the document so a
    // press on the book (which the gesture layer would otherwise swallow) still closes the menu.
    const onDocPointer = (event: Event): void => {
      if (this.#menu && !this.#menu.contains(event.target as Node)) this.#close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && this.#menu) {
        this.#close();
        event.preventDefault();
      }
    };
    this.#doc.addEventListener('pointerdown', onDocPointer, true);
    this.#doc.addEventListener('keydown', onKey, true);
    this.#unbind.push(() => this.#doc.removeEventListener('pointerdown', onDocPointer, true));
    this.#unbind.push(() => this.#doc.removeEventListener('keydown', onKey, true));

    // Keep an open menu honest if the book changes under it (a keyboard turn, a programmatic zoom):
    // the disabled and active states are re-read, just as the toolbar does.
    const refresh = (): void => this.#menu?.refresh();
    this.#unbind.push(zine.on('pageChanged', refresh));
    this.#unbind.push(zine.on('zoomChanged', refresh));
    this.#unbind.push(zine.on('flipEnd', refresh));
  }

  #context(): ControlContext {
    return { zine: this.#zine, close: () => this.#close(), colorScheme: this.#colorScheme };
  }

  #open(clientX: number, clientY: number): void {
    this.#close();
    // On action, re-read the menu's state (a zoom-out greys once at 1x). Closing is the action's
    // own call: terminal ones (fullscreen, print, share, page ends) call ctx.close(); incremental
    // ones (page turn, zoom step) leave the menu up to be repeated, as the overflow menu does.
    const menu = new ControlMenu(this.#doc, () => this.#context(), () => this.#menu?.refresh());
    menu.build(this.#items);
    // Nothing applies to this book (an image book with zoom off, say): no menu rather than an empty
    // box. The native menu is already suppressed, but an empty popup would be worse than none.
    if (!menu.el.querySelector('button')) return;
    // Fixed to the viewport so it lands under the cursor without depending on the container being a
    // positioning context; the layer isolates its own events from the book's gesture handlers.
    const layer = this.#doc.createElement('div');
    layer.className = 'zine-context-layer';
    applyColorScheme(layer, this.#colorScheme);
    layer.appendChild(menu.el);
    this.#container.appendChild(layer);
    this.#menu = menu;
    menu.refresh(); // read state before first paint, so a disabled entry shows disabled at once
    this.#place(menu.el, clientX, clientY);
    menu.focusFirst();
  }

  /** Pin the menu at the cursor, nudged to stay inside the book's box. */
  #place(el: HTMLElement, clientX: number, clientY: number): void {
    const rect = this.#container.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (!box.width) {
      // Not laid out (e.g. happy-dom has no layout): just pin it at the cursor.
      el.style.left = `${clientX}px`;
      el.style.top = `${clientY}px`;
      return;
    }
    const left = Math.min(clientX, rect.right - box.width - 4);
    const top = Math.min(clientY, rect.bottom - box.height - 4);
    el.style.left = `${Math.max(rect.left + 4, left)}px`;
    el.style.top = `${Math.max(rect.top + 4, top)}px`;
  }

  #close(): void {
    if (!this.#menu) return;
    const layer = this.#menu.el.parentElement;
    const hadFocus = this.#doc.activeElement !== null && this.#menu.contains(this.#doc.activeElement);
    this.#menu.destroy();
    layer?.remove();
    this.#menu = null;
    // Return focus to the book so keyboard control is not stranded on a removed node.
    if (hadFocus && typeof this.#container.focus === 'function') this.#container.focus();
  }

  destroy(): void {
    this.#close();
    for (const off of this.#unbind) off();
    this.#unbind = [];
  }
}
