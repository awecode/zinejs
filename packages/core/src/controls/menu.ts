import { createIcon } from './icons';
import { resolveControl } from './registry';
import type { ControlContext, ControlDef, ControlItem } from './types';

/**
 * The shared menu machinery.
 *
 * A `.zine-controls-menu` is built the same way in two places: the toolbar's overflow (the ⋮
 * button) and the right-click context menu. Rather than let those drift, both build their items,
 * read their state, and run their actions through the helpers here, so a menu looks and behaves
 * identically wherever it is anchored. Placement and dismissal stay with each owner, because a
 * popover hanging off a toolbar button and one opening at the cursor differ only there.
 */

/** A control's label, which may depend on the current state. */
export function titleOf(def: ControlDef, ctx: ControlContext): string {
  return typeof def.title === 'function' ? def.title(ctx) : def.title;
}

/** A control's glyph, which may likewise depend on state (an RTL mirror, say). */
export function iconOf(def: ControlDef, ctx: ControlContext): string | undefined {
  return typeof def.icon === 'function' ? def.icon(ctx) : def.icon;
}

/** The element itself if it can be disabled, else any inputs/buttons it wraps. */
export function formFields(el: HTMLElement): (HTMLButtonElement | HTMLInputElement)[] {
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) return [el];
  return [...el.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')];
}

/** Toggle the pending-action state on a button: a trailing spinner, disabled while it spins. */
export function setBusy(btn: HTMLButtonElement, busy: boolean): void {
  btn.classList.toggle('zine-controls-busy', busy);
  btn.setAttribute('aria-busy', String(busy));
  btn.disabled = busy;
}

/**
 * Run a control's action, holding the button busy while a slow one (a cross-origin file fetched to
 * save or print) settles. `onAfter` re-reads state once the action has run, and again when a
 * pending one finishes. A disabled or already-busy button does nothing.
 */
export function activateControl(
  def: ControlDef,
  trigger: HTMLButtonElement,
  ctx: ControlContext,
  onAfter: () => void,
): void {
  if (def.isDisabled?.(ctx)) return;
  if (trigger.classList.contains('zine-controls-busy')) return;
  const result = def.action?.(ctx);
  if (result && typeof result.then === 'function') {
    setBusy(trigger, true);
    void result.finally(() => {
      setBusy(trigger, false);
      onAfter();
    });
  }
  onAfter();
}

/**
 * A control button. Bar buttons are icon-only with the title as tooltip; menu items and any
 * control without an icon also carry a visible label. `onActivate` is left to the caller so the
 * toolbar can route a press through its submenu logic while a menu item just acts.
 */
export function buildControlButton(
  doc: Document,
  def: ControlDef,
  className: string,
  ctx: ControlContext,
  onActivate: (def: ControlDef, btn: HTMLButtonElement) => void,
  withLabel = false,
): HTMLButtonElement {
  const btn = doc.createElement('button');
  const title = titleOf(def, ctx);
  const icon = iconOf(def, ctx);
  btn.type = 'button';
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  if (icon) btn.appendChild(createIcon(doc, icon));
  if (withLabel || !icon) {
    const label = doc.createElement('span');
    label.className = 'zine-controls-label';
    label.textContent = title;
    btn.appendChild(label);
  }
  btn.addEventListener('click', () => onActivate(def, btn));
  return btn;
}

/**
 * Re-read one control's state after the book changes and reflect it on its element.
 *
 * Applies to custom `render` widgets as well as plain buttons: the predicates live on `ControlDef`,
 * so a widget may be any element and each piece of state is applied however that element supports
 * it. `visible` overrides the `isVisible` predicate for a control whose visibility is decided
 * elsewhere (a submenu shown only when it has visible children).
 */
export function applyControlItemState(
  el: HTMLElement,
  def: ControlDef,
  ctx: ControlContext,
  doc: Document,
  visible?: boolean,
): void {
  const applies = visible ?? def.isVisible?.(ctx);
  if (applies !== undefined) el.style.display = applies ? '' : 'none';

  // A button running a slow action stays disabled until it settles, whatever its predicate says.
  const busy = el.classList.contains('zine-controls-busy');
  const disabled = (def.isDisabled?.(ctx) ?? false) || busy;
  const fields = formFields(el);
  // A wrapper element cannot be disabled, so mark it and disable the fields inside.
  for (const field of fields) field.disabled = disabled;
  if (!fields.length) el.setAttribute('aria-disabled', String(disabled));
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
    el.querySelector('svg')?.replaceWith(createIcon(doc, def.icon(ctx)));
  }
}

/**
 * A `.zine-controls-menu`: a column of control items with `role=menu`. Owns the items it builds so
 * it can re-read their state and clean up after itself. The owner supplies the context (whose
 * `close()` dismisses this menu) and drives when to build, refresh, and destroy; where the menu is
 * placed and how it is dismissed are the owner's business.
 */
export class ControlMenu {
  readonly el: HTMLElement;
  #doc: Document;
  #context: () => ControlContext;
  #onAfterAction: () => void;
  /** Every item on screen, buttons and `render` widgets alike, so {@link refresh} can reach them. */
  #items: { el: HTMLElement; def: ControlDef }[] = [];

  constructor(doc: Document, context: () => ControlContext, onAfterAction: () => void) {
    this.#doc = doc;
    this.#context = context;
    this.#onAfterAction = onAfterAction;
    this.el = doc.createElement('div');
    this.el.className = 'zine-controls-menu';
    this.el.setAttribute('role', 'menu');
  }

  /** Fill the menu from a list of controls, dropping separators and anything not applicable. */
  build(children: readonly ControlItem[]): void {
    this.el.replaceChildren();
    this.#items = [];
    const ctx = this.#context();
    for (const child of children) {
      if (child === '|') continue;
      const def = resolveControl(child);
      if (def.isVisible && !def.isVisible(ctx)) continue;
      let item: HTMLElement;
      if (def.render) {
        item = def.render(this.#context());
      } else {
        item = buildControlButton(
          this.#doc,
          def,
          'zine-controls-btn',
          ctx,
          (d, btn) => activateControl(d, btn, this.#context(), this.#onAfterAction),
          true,
        );
      }
      item.setAttribute('role', 'menuitem');
      this.el.appendChild(item);
      this.#items.push({ el: item, def });
    }
  }

  /** Re-read every item's state. */
  refresh(): void {
    const ctx = this.#context();
    for (const { el, def } of this.#items) applyControlItemState(el, def, ctx, this.#doc);
  }

  /** Whether the menu (or something inside it) contains `node`. */
  contains(node: Node | null): boolean {
    return node !== null && this.el.contains(node);
  }

  focusFirst(): void {
    this.el.querySelector('button')?.focus();
  }

  destroy(): void {
    this.el.remove();
    this.#items = [];
  }
}

/** A submenu is only worth showing if something inside it is. Keeps a menu trigger from opening
 *  onto nothing when every entry has hidden itself. */
export function hasVisibleChildren(def: ControlDef, ctx: ControlContext): boolean {
  if (def.isVisible && !def.isVisible(ctx)) return false;
  return (def.children ?? []).some((child) => {
    if (child === '|') return false;
    const childDef = resolveControl(child);
    return childDef.isVisible ? childDef.isVisible(ctx) : true;
  });
}
