/**
 * The toolbar's stylesheet, injected once per document.
 *
 * The rest of the library styles elements inline, but a toolbar needs `:hover`, `:focus-visible`
 * and `:disabled` — states inline styles cannot express — so this is the one place a `<style>`
 * element is warranted. Everything is scoped under `.zine-controls`.
 *
 * Colours come from custom properties so a consumer can retheme without overriding rules. Left
 * unset, each falls back to `light-dark(light, dark)`, which resolves against the element's used
 * `color-scheme`: the toolbar follows the host page's scheme with no configuration, and a host
 * with a theme toggle only has to set `color-scheme` on its root for the controls to match. The
 * `colorScheme` control option can force `light` or `dark` regardless of the page, and a set
 * `--zine-controls-*` token still wins over both.
 */
const STYLE_ID = 'zine-controls-style';

export const CSS = `
/* Docked mode wraps the book so the bar can sit beside it without shrinking the container,
   whose measured box the renderer and hit-testing both depend on.
   The wrapper deliberately does not stretch or grow its children: the container keeps whatever
   width, aspect-ratio and auto-margins the consumer's own CSS gave it. */
.zine-controls-wrap { display: flex; }
/* Stacked: children keep their own width (so a percentage or auto-margin still resolves against
   the wrapper) and take only the height they ask for. */
.zine-controls-wrap-top,
.zine-controls-wrap-bottom { flex-direction: column; align-items: stretch; }
/* Side by side: the bar is only as wide as its buttons, and both are vertically centred. */
.zine-controls-wrap-left,
.zine-controls-wrap-right { flex-direction: row; align-items: center; }
/* min-height:0 matters as much as min-width here. A flex item's automatic minimum size floors it
   at its content, so once the canvas has grown for a taller layout the book cannot shrink back —
   its aspect-ratio is restored but ignored, leaving the extra height behind. */
.zine-controls-wrap > * { flex: 0 0 auto; min-width: 0; min-height: 0; }

.zine-controls {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 5px;
  z-index: 2;
  box-sizing: border-box;
  font: 500 12px/1.2 system-ui, sans-serif;
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  touch-action: auto;
  -webkit-user-select: none;
  user-select: none;
}
.zine-controls-docked { flex: 0 0 auto; justify-content: center; align-items: center; }
.zine-controls-floating {
  position: absolute;
  /* Transparent to the book except on the buttons themselves, so gaps stay draggable. */
  pointer-events: none;
}
.zine-controls-bar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border-radius: 8px;
  pointer-events: auto;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.82)));
  backdrop-filter: blur(8px);
}
/* Floating: lifted off the page it covers. Docked: flat, with an outline so it reads as a
   control strip rather than a shadow hanging in empty space. */
.zine-controls-floating .zine-controls-bar { box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28); }
.zine-controls-docked .zine-controls-bar {
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.14)));
}
.zine-controls-floating.zine-controls-bottom { inset: auto 0 0 0; justify-content: center; }
.zine-controls-floating.zine-controls-top    { inset: 0 0 auto 0; justify-content: center; }
.zine-controls-floating.zine-controls-left   { inset: 0 auto 0 0; align-items: center; }
.zine-controls-floating.zine-controls-right  { inset: 0 0 0 auto; align-items: center; }
/* A bar on a vertical edge stacks its buttons, docked or floating. */
.zine-controls-left .zine-controls-bar,
.zine-controls-right .zine-controls-bar { flex-direction: column; }

.zine-controls-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.zine-controls-btn svg { width: 15px; height: 15px; }
.zine-controls-btn:hover:not(:disabled) { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-controls-btn:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 1px;
}
.zine-controls-btn:disabled { opacity: 0.38; cursor: default; }
/* A custom widget cannot always be disabled itself, so it is marked instead and reads the same. */
.zine-controls-off { opacity: 0.38; }
.zine-controls-off[aria-disabled='true'] { pointer-events: none; }
.zine-controls-btn[aria-pressed="true"],
.zine-controls-btn[aria-expanded="true"] { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }

.zine-controls-sep {
  width: 1px;
  align-self: stretch;
  margin: 3px 3px;
  background: currentColor;
  opacity: 0.22;
}
.zine-controls-left .zine-controls-sep,
.zine-controls-right .zine-controls-sep { width: auto; height: 1px; margin: 3px 3px; }

.zine-controls-page {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 3px;
  pointer-events: auto;
  white-space: nowrap;
}
.zine-controls-page input {
  width: 2.2em;
  padding: 2px 3px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 4px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.25));
  color: inherit;
  font: inherit;
  text-align: center;
  -moz-appearance: textfield;
}
.zine-controls-page input::-webkit-outer-spin-button,
.zine-controls-page input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.zine-controls-page input:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 0;
}

.zine-controls-menu {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 152px;
  padding: 4px;
  border-radius: 8px;
  pointer-events: auto;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.94)));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(8px);
}
.zine-controls-menu .zine-controls-btn {
  width: 100%;
  height: auto;
  gap: 8px;
  padding: 6px 8px;
  justify-content: flex-start;
}

/* Search shares the rail: a query field pinned at the top over a scrolling list of hits. */
.zine-search { gap: 0; overflow: hidden; }
.zine-search-input {
  flex: 0 0 auto;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 6px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.25));
  color: inherit;
  font: inherit;
  box-sizing: border-box;
}
.zine-search-hits {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-top: 5px;
  scrollbar-width: thin;
}
.zine-search-hit {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.zine-search-hit:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-search-hit:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-search-page { display: block; font-size: 0.9em; opacity: 0.85; }
.zine-search-hit small {
  display: block;
  margin-top: 2px;
  opacity: 0.62;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

/* Page-turn arrows flanking the book. Like the docked toolbar and the side panels, they sit
   outside the container so they never shrink the book or intercept its gestures. */
.zine-arrows-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.zine-arrows-wrap > *:not(.zine-arrow) { flex: 1 1 auto; min-width: 0; min-height: 0; }
.zine-arrow {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.82)));
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-user-select: none;
  user-select: none;
}
.zine-arrow svg { width: 22px; height: 22px; }
/* Hover mixes toward the page in dark mode (a lighter circle) but away from it in light mode:
   a light-mode hover that lightened would wash the arrow into a near-white disc against a light
   page, so it darkens instead and keeps its edge. */
.zine-arrow:hover:not(:disabled) { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.22))); }
.zine-arrow:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 2px;
}
/* Nothing to turn to: invisible, but still occupying its slot so the book does not slide across
   as the reader reaches a cover. */
.zine-arrow-hidden { visibility: hidden; }
/* Too narrow to flank without squeezing the pages, so overlay the arrows on the book's edges
   instead. The wrap sits outside the container, so painting them over it leaves the container's
   measured box (which sizes the book and maps taps) untouched. */
@media (max-width: 640px) {
  .zine-arrows-wrap { position: relative; }
  .zine-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
  }
  .zine-arrow:first-child { left: 6px; }
  .zine-arrow:last-child { right: 6px; }
}
@media (prefers-reduced-motion: no-preference) {
  .zine-arrow { transition: background 120ms ease; }
}

/* Side panels (thumbnails, outline). The rail wraps the book and its docked toolbar so it sits
   beside them without shrinking the container the renderer measures. */
.zine-panel-wrap { display: flex; align-items: stretch; gap: 8px; }

/* The holder stretches to the book's height; the rail is absolutely positioned inside it so a
   long list scrolls rather than growing the row and running past the bottom of the book. */
.zine-panel-holder {
  position: relative;
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 0;
}
.zine-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  box-sizing: border-box;
  border-radius: 8px;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.82)));
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  font: 500 11px/1.2 system-ui, sans-serif;
  scrollbar-width: thin;
  touch-action: auto;
  -webkit-user-select: none;
  user-select: none;
}
/* Overlay fallback, used when the container has no parent to wrap. */
.zine-panel-overlay { position: absolute; inset: 0 auto 0 0; z-index: 3; }
.zine-panel-active { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.18))); }
.zine-panel-note { padding: 8px; opacity: 0.66; line-height: 1.4; }

.zine-thumbs { align-items: center; }

.zine-thumbs-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  width: 100%;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  box-sizing: border-box;
}
.zine-thumbs-row:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-thumbs-row:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-thumbs-row.zine-panel-active .zine-thumbs-cell {
  outline: 1px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
}

/* Outline: a single column of headings, indented by depth. */
.zine-outline { gap: 1px; }
.zine-outline-row {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  line-height: 1.35;
  cursor: pointer;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}
.zine-outline-row:hover:not(:disabled) {
  background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14)));
}
.zine-outline-row:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
/* A heading whose destination could not be resolved: shown, but nothing to click through to. */
.zine-outline-row:disabled { opacity: 0.5; cursor: default; }

.zine-thumbs-cell {
  flex: 1 1 0;
  min-width: 0;
  min-height: 24px;
  display: flex;
  background: light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.3));
  border-radius: 2px;
  overflow: hidden;
}
/* A lone page in a book that pairs elsewhere (a cover, a back page) keeps one page's width and
   centres, instead of stretching across both columns. */
.zine-thumbs-row-lone .zine-thumbs-cell { flex: 0 0 calc(50% - 1px); }
.zine-thumbs-img { display: block; width: 100%; height: auto; }
.zine-thumbs-caption { flex: 1 0 100%; text-align: center; opacity: 0.7; }

/* Share dialog. Centred over the page rather than in the side rail: a QR and six destinations
   need more room than the rail gives, and sharing is a brief interruption, not a browsing mode. */
.zine-share-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
  font: 500 13px/1.4 system-ui, sans-serif;
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
}
.zine-share {
  width: min(320px, 100%);
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--zine-share-bg, light-dark(#ffffff, #1c1c20));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}
.zine-share-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.zine-share-head strong { font-size: 15px; }
.zine-share-close {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.zine-share-close svg { width: 16px; height: 16px; }
.zine-share-close:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }

.zine-share-qr {
  align-self: center;
  line-height: 0;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
}
.zine-share-qr svg { display: block; }

.zine-share-link { display: flex; gap: 6px; }
.zine-share-link input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 7px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3));
  color: inherit;
  font: inherit;
}
.zine-share-copy {
  flex: 0 0 auto;
  min-width: 74px;
  padding: 7px 12px;
  border: 0;
  border-radius: 7px;
  background: var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  color: light-dark(#ffffff, #06202c);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.zine-share-socials { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.zine-share-social {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
  color: inherit;
  text-decoration: none;
}
.zine-share-social svg { width: 19px; height: 19px; }
.zine-share-social:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.12), rgba(255,255,255,0.18))); }
.zine-share-close:focus-visible,
.zine-share-copy:focus-visible,
.zine-share-social:focus-visible,
.zine-share-link input:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .zine-controls-btn { transition: background 120ms ease; }
}
`;

/** Add the stylesheet to `doc` if it is not already there. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (doc.head ?? doc.documentElement)?.appendChild(style);
}

/**
 * Pin an element's colour scheme so the `light-dark()` fallbacks resolve to one palette.
 *
 * `'auto'` does nothing: `color-scheme` inherits, so the element keeps the page's used scheme and
 * `light-dark()` follows it. `'light'` / `'dark'` set the property on the element itself, which its
 * themed descendants (buttons, menu, dialog) inherit in turn. An unset `--zine-controls-*` reads
 * the forced palette; a set one still overrides it, since the tokens sit outside `light-dark()`.
 */
export function applyColorScheme(el: HTMLElement, scheme: 'light' | 'dark' | 'auto'): void {
  if (scheme !== 'auto') el.style.colorScheme = scheme;
}
