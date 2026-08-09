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
  /**
   * Tooltip and accessible name. A function is re-read whenever the book changes, so a toggle
   * can say what it will do next ("Show thumbnails" / "Hide thumbnails").
   */
  readonly title: string | ((ctx: ControlContext) => string);
  /**
   * Inner SVG markup, drawn inside a 24x24 viewBox. See `./icons`. A function is re-read
   * whenever the book changes, so a control can mirror its glyph in RTL or swap it for state.
   */
  readonly icon?: string | ((ctx: ControlContext) => string);
  /** Nested controls. A control with children opens a submenu instead of acting. */
  readonly children?: readonly ControlItem[];
  /** What the button does. Ignored when `children` is present. */
  action?(ctx: ControlContext): void;
  /** Build a custom element instead of a button — for inputs and other non-button widgets. */
  render?(ctx: ControlContext): HTMLElement;
  /**
   * Whether the control applies at all — search on a book with no text, download with no file.
   * A control that fails this is removed outright, since it will not come back.
   */
  isVisible?(ctx: ControlContext): boolean;
  /**
   * Whether the control has anything to do *right now* — "first page" on the first page.
   *
   * Unlike `isVisible` this comes and goes as the reader moves, so on the toolbar the control
   * keeps its slot while hidden, and the bar does not shrink and reshuffle under the cursor. In
   * a menu, which is rebuilt on every open, the entry is simply left out.
   */
  isAvailable?(ctx: ControlContext): boolean;
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
  /** Which edge of the book the toolbar sits on; default 'bottom'. */
  position?: ControlsPosition;
  /**
   * Sit outside the book (default) or float over it.
   *
   * Docked is the default because a bar over the page hides content. It also keeps the book's
   * own box untouched — the container's measured size drives layout, hit-testing and the
   * aspect-ratio the library writes — so the toolbar goes in as a sibling of the container
   * rather than a child of it, and its clicks never reach the book's gesture handlers at all.
   *
   * Set `false` to overlay the toolbar on the book instead.
   */
  docked?: boolean;
  /** The toolbar layout. Omit for the default set; pass an array to replace it outright. */
  items?: readonly ControlItem[];
  /**
   * Large page-turn arrows flanking the book, as most flipbooks show. Default true. They sit
   * beside the pages rather than over them, so they never cover content.
   */
  arrows?: boolean;
  /** Extra class on the toolbar root, for styling hooks. */
  className?: string;
}
