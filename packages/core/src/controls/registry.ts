import type { ControlDef, ControlItem } from './types';

/**
 * The control registry.
 *
 * Deliberately just the mechanism — no icons, no built-in definitions — because `defineControl`
 * has to be callable before the toolbar chunk loads, so this module lands in the base bundle.
 * The built-ins live in `./builtins`, which the lazy chunk pulls in along with the icon set.
 */
const registry = new Map<string, ControlDef>();

/**
 * Add a control, or replace one by reusing its id. Returns the definition so it can be dropped
 * straight into a layout.
 *
 * ```js
 * defineControl({ id: 'print', title: 'Print', icon: '<path d="…"/>', action: () => print() });
 * new Zine(el, { source, controls: { items: ['prev', 'next', 'print'] } });
 * ```
 */
export function defineControl(def: ControlDef): ControlDef {
  registry.set(def.id, def);
  return def;
}

/** Look up a registered control. */
export function getControl(id: string): ControlDef | undefined {
  return registry.get(id);
}

/**
 * Turn a layout entry into a concrete definition. A bare string names a registered control; an
 * object with only some fields is layered over the registered one, so `{ id: 'next', title: 'Go
 * on' }` relabels the built-in without reimplementing it.
 */
export function resolveControl(item: ControlItem): ControlDef {
  if (typeof item === 'string') {
    const found = registry.get(item);
    if (!found) {
      throw new Error(
        `controls: unknown control '${item}'. Register it with defineControl() or pass a definition object.`,
      );
    }
    return found;
  }
  const base = registry.get(item.id);
  if (!base) return item as ControlDef;
  return { ...base, ...item };
}

/** The toolbar shown when `items` is not given. */
export const DEFAULT_ITEMS: readonly ControlItem[] = [
  'prev',
  'pageInput',
  'next',
  '|',
  'zoomOut',
  'zoomIn',
  '|',
  'search',
  'menu',
];
