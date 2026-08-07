import { registerWidgets, Toolbar } from './toolbar';
import type { ControlsOptions } from './types';
import type { Zine } from '../zine';

export { defineControl, getControl, DEFAULT_ITEMS } from './registry';
export { ICONS, createIcon } from './icons';
export type {
  ControlContext,
  ControlDef,
  ControlItem,
  ControlsOptions,
  ControlsPosition,
} from './types';

/**
 * Build the toolbar inside `container` and return its teardown.
 *
 * This module is the lazy chunk: `zine.ts` reaches it through a dynamic `import()`, so a book
 * built with `controls: false` never downloads any of it.
 */
export function mountControls(
  zine: Zine,
  container: HTMLElement,
  options: ControlsOptions = {},
): () => void {
  const toolbar = new Toolbar(zine, container, options);
  registerWidgets(toolbar);
  // Widgets are registered against this instance, so build the layout after they exist.
  toolbar.mount(options);
  return () => toolbar.destroy();
}
