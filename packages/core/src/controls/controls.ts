import { registerWidgets, Toolbar } from './toolbar';
import { ContextMenu } from './contextMenu';
import type { ContextMenuOptions, ControlsOptions } from './types';
import type { Zine } from '../zine';

export { defineControl, getControl, DEFAULT_ITEMS } from './registry';
export { ICONS, createIcon } from './icons';
export type {
  ContextMenuOptions,
  ControlContext,
  ControlDef,
  ControlItem,
  ControlsColorScheme,
  ControlsOptions,
  ControlsPosition,
} from './types';

/**
 * Build the toolbar inside `container` and return its teardown.
 *
 * This module is the lazy chunk `zine.ts` reaches through a dynamic `import()`, so a book built
 * with `controls: false` never downloads the toolbar, its icons or its stylesheet. The file is
 * named `controls.ts` rather than `index.ts` so the emitted chunk is `controls-<hash>.js`, which
 * is what the size-limit budget watches.
 */
export function mountControls(
  zine: Zine,
  container: HTMLElement,
  options: ControlsOptions = {},
  hidden: ReadonlySet<string> = new Set(),
): () => void {
  const toolbar = new Toolbar(zine, container, options, hidden);
  // Built-ins and the instance-bound widgets have to exist before the layout resolves ids.
  registerWidgets(toolbar);
  toolbar.mount(options);
  return () => toolbar.destroy();
}

/**
 * Attach the right-click menu to `container` and return its teardown.
 *
 * Shares this lazy chunk with {@link mountControls}, so a book that wants only the context menu
 * (`controls: false`, `contextMenu: true`) still reuses the same icons and control definitions.
 */
export function mountContextMenu(
  zine: Zine,
  container: HTMLElement,
  options: ContextMenuOptions = {},
  hidden: ReadonlySet<string> = new Set(),
): () => void {
  const menu = new ContextMenu(zine, container, options, hidden);
  return () => menu.destroy();
}
