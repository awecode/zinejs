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
/* A button mid-slow-action (fetching a file to save or print): a spinner, kept full-strength
   rather than dimmed so it reads as "working", not "disabled". */
.zine-controls-btn.zine-controls-busy { opacity: 1; cursor: default; position: relative; }
.zine-controls-btn.zine-controls-busy::after {
  content: '';
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  opacity: 0.7;
  animation: zine-controls-spin 0.7s linear infinite;
}
/* Icon-only bar button: hide the glyph and center the spinner over its place. */
.zine-controls-btn.zine-controls-busy > svg { visibility: hidden; }
.zine-controls-btn.zine-controls-busy::after {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -7px 0 0 -7px;
}
/* Menu item (glyph + label): let the glyph and label stand, and trail the spinner after them. */
.zine-controls-menu .zine-controls-btn.zine-controls-busy > svg { visibility: visible; }
.zine-controls-menu .zine-controls-btn.zine-controls-busy::after { position: static; }
@keyframes zine-controls-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .zine-controls-btn.zine-controls-busy::after { animation-duration: 1.6s; }
}
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
/* Replace the browser's default (white) focus ring with the accent ring the other controls use. */
.zine-search-input:focus-visible {
  outline: none;
  border-color: var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  box-shadow: 0 0 0 1px var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
}
.zine-search-hits {
  flex: 1 1 auto;
  overflow-y: auto;
  /* Chain overscroll up to the page: once the list is at its end (or too short to scroll at all),
     a further wheel scrolls the page behind, the same as scrolling over the book itself does. */
  overscroll-behavior: auto;
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
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;
  /* Light on a light page, dark on a dark one. The shadow below carries the contrast. */
  color: var(--zine-controls-fg, light-dark(#f4f4f5, #18181b));
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  /* No grey tap box on touch; the :active tint below is the press feedback instead. */
  -webkit-tap-highlight-color: transparent;
}
.zine-arrow svg {
  width: 36px;
  height: 36px;
  stroke-width: 2.25;
  /* No backing disc, so a subtle offset shadow keeps the chevron from disappearing into a
     matching background. It contrasts the fill: a light chevron (light mode) casts a soft dark
     shadow, a dark chevron (dark mode) a soft light one, offset rather than a glowing halo. */
  filter: drop-shadow(0 1px 2px light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.35)));
}
/* Feedback intensifies the chevron toward its extreme (white in light mode, black in dark)
   rather than tinting it, so no new colour is introduced. Not tied to --zine-controls-fg: that
   sets the resting fill, and hover has to differ from it to read as feedback. :active clears on
   release, so tap and click feel the same; :hover is behind (hover: hover) so it never sticks on
   touch. */
.zine-arrow:active:not(:disabled) { color: light-dark(#ffffff, #000000); }
@media (hover: hover) {
  .zine-arrow:hover:not(:disabled) { color: light-dark(#ffffff, #000000); }
}
.zine-arrow:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 2px;
  border-radius: 8px;
}
/* Nothing to turn to: invisible, but still occupying its slot so the book does not slide across
   as the reader reaches a cover. */
.zine-arrow-hidden { visibility: hidden; }
/* Device-scoped arrows (controls.arrows: 'desktop' | 'mobile'). The split follows the same 640px
   breakpoint as the flank/overlay layouts below, so the arrows appear and disappear live as the
   window crosses it. */
@media (max-width: 640px) {
  .zine-arrows-desktop > .zine-arrow { display: none; }
}
@media (min-width: 641px) {
  .zine-arrows-mobile > .zine-arrow { display: none; }
}
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
    /* Sit back over the page so the reader can look at the book. */
    opacity: 0.7;
  }
  .zine-arrow:first-child { left: -2px; }
  .zine-arrow:last-child { right: -2px; }
}
@media (prefers-reduced-motion: no-preference) {
  .zine-arrow { transition: background 120ms ease; }
}

/* Side panels (thumbnails, outline, search). The rail wraps the book and its docked toolbar so it
   sits beside them as a flex sibling. On a wide screen the book shrinks to make room (below); on a
   narrow one the rail becomes a drawer over the book.
   align-items:flex-start, not stretch: the book sizes its height from its width through its own
   aspect-ratio, and that height is 'auto' from flex's point of view, so a stretch would override it
   and blow the book (and the rail matched to it) up to the flex line's cross size. Left as auto, the
   book keeps its aspect height and the holder alone stretches down to meet it (below). */
.zine-panel-wrap { display: flex; align-items: flex-start; gap: 8px; position: relative; }

/* The book-side slot (the bare container, or the docked-toolbar wrapper around it) yields space to
   the fixed-width rail instead of overflowing: flex-shrink lets it fall below its own width, and
   min-width:0 removes the automatic content floor that would otherwise stop it. The book only
   actually shrinks if its width is elastic (a %, max-width, or the demo's min(...) with a % term);
   a hard-coded pixel width has nothing for the % to resolve smaller against. */
.zine-panel-wrap > *:not(.zine-panel-holder):not(.zine-panel-scrim) {
  flex: 0 1 auto;
  min-width: 0;
}
/* With a docked toolbar the book lives inside .zine-controls-wrap, whose children are pinned
   flex:0 0 auto (so the bar keeps its size). Inside a panel wrap the book child — everything but
   the bar itself — must instead be allowed to shrink, so left/right docking flanks like the rest.
   Top/bottom docking already shrinks through the container's own % width. */
.zine-panel-wrap .zine-controls-wrap > *:not(.zine-controls) {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
}
@media (prefers-reduced-motion: no-preference) {
  .zine-panel-wrap > *:not(.zine-panel-holder):not(.zine-panel-scrim) {
    transition: flex-basis 160ms ease, width 160ms ease;
  }
}

/* The holder stretches to the book's height; the rail is absolutely positioned inside it so a
   long list scrolls rather than growing the row and running past the bottom of the book. */
.zine-panel-holder {
  position: relative;
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 0;
}
/* The scrim dims the book behind the narrow-screen drawer. It exists on every screen but only
   shows under the breakpoint below, so on a wide screen it takes no flex slot and never intercepts
   a click. */
.zine-panel-scrim { display: none; }
.zine-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  /* Chain overscroll up to the page: once the list is at its end (or too short to scroll at all),
     a further wheel scrolls the page behind, the same as scrolling over the book itself does. */
  overscroll-behavior: auto;
  /* Reserve the scrollbar's lane whether or not it is showing, so rows never sit under the bar
     and the close button (inset past this lane below) has a fixed edge to clear. */
  scrollbar-gutter: stable;
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
/* The rail sits flush against the book's reading-start edge (left, or right in RTL), so its outer
   corners there would round away from that edge and leave a gap. Square them; keep the interior
   corners, which face the page, rounded. */
.zine-panel { border-radius: 0 8px 8px 0; }
.zine-panel-wrap-rtl .zine-panel { border-radius: 8px 0 0 8px; }
/* Overlay fallback, used when the container has no parent to wrap. */
.zine-panel-overlay { position: absolute; inset: 0 auto 0 0; z-index: 3; }
.zine-panel-active { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.18))); }
.zine-panel-note { padding: 8px; opacity: 0.66; line-height: 1.4; }
/* Discoverable dismiss, floated in the rail's trailing-top (interior) corner, away from the book.
   It sits in the holder above the scrolling list so the list scrolls under it. A translucent
   backdrop keeps the glyph legible over a thumbnail or a line of text. */
.zine-panel-close {
  position: absolute;
  top: 6px;
  /* Inset past the reserved scrollbar gutter so the button never overlaps the bar. */
  right: 12px;
  z-index: 1;
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  /* Opaque so a light thumbnail underneath never shows through and dims the glyph. */
  background: light-dark(#f4f4f5, #27272a);
  color: inherit;
  cursor: pointer;
}
.zine-panel-close svg { width: 15px; height: 15px; }
/* Opaque hover, not the translucent hover token: a see-through backdrop over a light thumbnail
   would wash the glyph out. Solid neutrals keep the X readable in both themes over anything. */
.zine-panel-close:hover { background: light-dark(#e4e4e7, #3f3f46); }
.zine-panel-close:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-panel-wrap-rtl .zine-panel-close { right: auto; left: 12px; }
/* End the search field just before the close button rather than running under it, so the two sit
   side by side and the field's border reads cleanly. The button's inner edge is ~30px from the
   panel's content edge (24px wide, its right edge 6px in once the reserved scrollbar gutter is
   accounted for), so 30px leaves them flush with a hair of breathing room. width:auto lets the
   column's stretch fill the rest, so the margin shortens the field instead of overflowing 100%. */
.zine-search .zine-search-input { width: auto; align-self: stretch; margin-right: 30px; }
.zine-panel-wrap-rtl .zine-search .zine-search-input { margin-right: 0; margin-left: 30px; }

/* Overlay panels (outline, search) on a wide screen: float over the book's start edge instead of
   flanking it, so the book never resizes. The wrap drops to a block, laying the book out exactly as
   it was before the panel opened; the holder sits absolute over it at full book height, with a
   shadow so it reads as lifted off the page. thumbnails is not overlaid — it stays a flex flank and
   shrinks the book only when the two will not otherwise both fit. */
@media (min-width: 641px) {
  .zine-panel-wrap-overlay { display: block; }
  .zine-panel-wrap-overlay .zine-panel-holder {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 4;
    box-shadow: 0 0 24px light-dark(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.55));
  }
  .zine-panel-wrap-overlay.zine-panel-wrap-rtl .zine-panel-holder { inset: 0 0 0 auto; }
  /* Opaque over the page it floats on, unlike a flanking rail that sits against empty margin. */
  .zine-panel-wrap-overlay .zine-panel {
    background: var(--zine-controls-bg, light-dark(#ffffff, #18181b));
  }
  /* A click-away layer over the book, so pressing the page behind the floating rail closes it the
     way tapping the scrim does on a narrow screen. Transparent here — the wide-screen rail only
     covers an edge, so there is no need to dim the page the reader is still looking at. It sits
     under the holder (z-index) so the rail's own rows still take their clicks. */
  .zine-panel-wrap-overlay .zine-panel-scrim {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: transparent;
  }
}
@media (min-width: 641px) and (prefers-reduced-motion: no-preference) {
  .zine-panel-wrap-overlay .zine-panel-holder { animation: zine-drawer-in 180ms ease; }
  .zine-panel-wrap-overlay.zine-panel-wrap-rtl .zine-panel-holder { animation-name: zine-drawer-in-rtl; }
}

/* Narrow screen: no room to flank, so the rail becomes a drawer over the book and the scrim dims
   the page behind it. The wrap is position:relative, so the absolute holder and scrim below are
   measured against it — i.e. against the book's own box. */
@media (max-width: 640px) {
  /* No flanking here — the rail and scrim both overlay absolutely — so drop the flex row entirely.
     As a plain block wrap the book keeps the exact box it had before a panel opened (its own width,
     margin and aspect-ratio height); a flex row would instead re-resolve the book's width and, with
     it, its aspect-derived height, enlarging the canvas and pushing the page down. */
  .zine-panel-wrap {
    display: block;
  }
  .zine-panel-holder {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 4;
    /* Cap the drawer so it never eats the whole book; its inline width still applies under this. */
    max-width: 80%;
    box-shadow: 0 0 24px light-dark(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6));
  }
  /* RTL reads from the right, so the drawer enters from there. */
  .zine-panel-wrap-rtl .zine-panel-holder { inset: 0 0 0 auto; }
  /* Opaque over the page, unlike the wide-screen rail which can sit against empty margin. */
  .zine-panel {
    background: var(--zine-controls-bg, light-dark(#ffffff, #18181b));
  }
  .zine-panel-scrim {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: rgba(0, 0, 0, 0.4);
  }
}
@media (max-width: 640px) and (prefers-reduced-motion: no-preference) {
  .zine-panel-holder { animation: zine-drawer-in 180ms ease; }
  .zine-panel-wrap-rtl .zine-panel-holder { animation-name: zine-drawer-in-rtl; }
  .zine-panel-scrim { animation: zine-scrim-in 180ms ease; }
}
@keyframes zine-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes zine-drawer-in-rtl { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes zine-scrim-in { from { opacity: 0; } to { opacity: 1; } }

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
/* No gap: a hairline between rows is the separator instead, so a title that wraps to two lines
   still reads as one entry rather than blending into its neighbours. */
.zine-outline { gap: 0; }
.zine-outline-row {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-bottom: 1px solid var(--zine-controls-divider, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.1)));
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
.zine-outline-row:last-child { border-bottom: 0; }
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
