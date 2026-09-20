import type { Zine } from '../zine';
import type { ZineStrings } from '../strings';

/** Where the toolbar sits relative to the book. */
export type ControlsPosition = 'top' | 'bottom' | 'left' | 'right';

/** How the controls decide between their light and dark palettes. */
export type ControlsColorScheme = 'light' | 'dark' | 'auto';

/** What a control is handed when it runs or reports its state. */
export interface ControlContext {
  /** The flipbook this toolbar drives. */
  readonly zine: Zine;
  /** Dismiss the submenu this control lives in (no-op at the top level). */
  close(): void;
  /** The controls' resolved colour scheme, for a control that mounts its own root outside the
   *  toolbar (the share dialog) and so has to carry the scheme across to it. */
  readonly colorScheme: ControlsColorScheme;
  /** Resolved reader-facing text (English defaults merged with the `strings` option). */
  readonly strings: ZineStrings;
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
  /**
   * What the button does. Ignored when `children` is present. May return a promise: while it is
   * pending the toolbar marks the button busy (a spinner, disabled) and — for a control in a
   * submenu — holds the menu open until it settles, so a slow action (fetching a cross-origin file
   * to download or print) shows progress rather than appearing to do nothing.
   */
  action?(ctx: ControlContext): void | Promise<void>;
  /** Build a custom element instead of a button — for inputs and other non-button widgets. */
  render?(ctx: ControlContext): HTMLElement;
  /**
   * Whether the control applies at all — search on a book with no text, download with no file.
   * A control that fails this is removed outright, since it will not come back.
   *
   * For something that comes and goes as the reader moves, prefer `isDisabled`: a control that
   * vanished and reappeared would shift every button beside it on the bar.
   */
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

export interface ContextMenuOptions {
  /** The menu layout. Omit for the default set; pass an array to replace it outright. */
  items?: readonly ControlItem[];
  /** Which palette the menu uses; follows the toolbar's when mounted alongside one. */
  colorScheme?: ControlsColorScheme;
}

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
   *
   * `true` shows them everywhere, `false` nowhere. `'desktop'` shows them only on wide screens
   * (where they flank the book) and `'mobile'` only on narrow ones (where they overlay the book
   * edges) — the split follows the same width breakpoint as the two layouts, so it tracks a live
   * window resize rather than the device it first loaded on.
   */
  arrows?: boolean | 'desktop' | 'mobile';
  /** Extra class on the toolbar root, for styling hooks. */
  className?: string;
  /**
   * Which palette the built-in controls use, when their colours have not been overridden.
   *
   * `'auto'` (the default) follows the host page: left unset, every colour falls back to
   * `light-dark()`, which resolves against the element's used `color-scheme`. Because
   * `color-scheme` inherits, a page that declares `color-scheme: light` (or `dark`) on its root
   * — as any page with a theme toggle should — gets controls that match, with no configuration.
   * `'light'` or `'dark'` forces that palette on the controls regardless of the page.
   *
   * A set `--zine-controls-*` custom property always wins over this, so branding is unaffected
   * either way.
   */
  colorScheme?: ControlsColorScheme;
}
