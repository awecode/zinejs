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
 * This module is the lazy chunk `zine.ts` reaches through a dynamic `import()`, so a book built
 * with `controls: false` never downloads the toolbar, its icons or its stylesheet. The file is
 * named `controls.ts` rather than `index.ts` so the emitted chunk is `controls-<hash>.js`, which
 * is what the size-limit budget watches.
 */
export function mountControls(
  zine: Zine,
  container: HTMLElement,
  options: ControlsOptions = {},
): () => void {
  const toolbar = new Toolbar(zine, container, options);
  // Built-ins and the instance-bound widgets have to exist before the layout resolves ids.
  registerWidgets(toolbar);
  toolbar.mount(options);
  return () => toolbar.destroy();
}
