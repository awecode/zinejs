import type { Zine } from '../zine';

/** Where the toolbar sits relative to the book. */
export type ControlsPosition = 'top' | 'bottom' | 'left' | 'right';

/** What a control is handed when it runs or reports its state. */
export interface ControlContext {
  /** The flipbook this toolbar drives. */
  readonly zine: Zine;
  /** Dismiss the submenu this control lives in (no-op at the top level). */
  close(): void;
}

/**
 * One button in the toolbar.
 *
 * A control is either an action (`action`), a submenu (`children`), or a bespoke widget
 * (`render`) — the page-number field is the built-in example of the last. The `is*` predicates are
 * re-read whenever the book changes, so a control reflects state without subscribing to anything.
 */
export interface ControlDef {
  /** Unique key; also how a layout refers to this control. */
  readonly id: string;
  /** Tooltip and accessible name. */
  readonly title: string;
  /** Inner SVG markup, drawn inside a 24x24 viewBox. See `./icons`. */
  readonly icon?: string;
  /** Nested controls. A control with children opens a submenu instead of acting. */
  readonly children?: readonly ControlItem[];
  /** What the button does. Ignored when `children` is present. */
  action?(ctx: ControlContext): void;
  /** Build a custom element instead of a button — for inputs and other non-button widgets. */
  render?(ctx: ControlContext): HTMLElement;
  /** Hide the control entirely, e.g. search on a book whose source has no text. */
  isVisible?(ctx: ControlContext): boolean;
  /** Grey out and block the action, e.g. "previous" on the first spread. */
  isDisabled?(ctx: ControlContext): boolean;
  /** Mark as currently on, e.g. fullscreen while engaged. */
  isActive?(ctx: ControlContext): boolean;
}

/**
 * An entry in a layout: a registered control's id, a `'|'` separator, or an inline definition.
 * Inline definitions may also be a partial override of a registered control — `{ id: 'next',
 * title: 'Forward' }` keeps the built-in behaviour and changes only the label.
 */
export type ControlItem = string | ControlDef | (Partial<ControlDef> & { id: string });

export interface ControlsOptions {
  /** Which edge the toolbar sits on; default 'bottom'. */
  position?: ControlsPosition;
  /**
   * Float over the book (default) or sit outside it. Floating keeps the book's own size intact,
   * which matters because the container's measured box drives layout and hit-testing.
   */
  docked?: boolean;
  /** The toolbar layout. Omit for the default set; pass an array to replace it outright. */
  items?: readonly ControlItem[];
  /** Extra class on the toolbar root, for styling hooks. */
  className?: string;
}
