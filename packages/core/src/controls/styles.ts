/**
 * The toolbar's stylesheet, injected once per document.
 *
 * The rest of the library styles elements inline, but a toolbar needs `:hover`, `:focus-visible`
 * and `:disabled` — states inline styles cannot express — so this is the one place a `<style>`
 * element is warranted. Everything is scoped under `.zine-controls`, and the colours come from
 * custom properties so a consumer can retheme without overriding rules.
 */
const STYLE_ID = 'zine-controls-style';

export const CSS = `
.zine-controls {
  position: absolute;
  display: flex;
  gap: 4px;
  padding: 6px;
  z-index: 2;
  /* Transparent to the book except on the buttons themselves, so gaps stay draggable. */
  pointer-events: none;
  box-sizing: border-box;
  font: 500 13px/1.2 system-ui, sans-serif;
  color: var(--zine-controls-fg, #f4f4f5);
  touch-action: auto;
  -webkit-user-select: none;
  user-select: none;
}
.zine-controls-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  pointer-events: auto;
  background: var(--zine-controls-bg, rgba(24, 24, 27, 0.82));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}
.zine-controls-bottom { inset: auto 0 0 0; justify-content: center; }
.zine-controls-top    { inset: 0 0 auto 0; justify-content: center; }
.zine-controls-left   { inset: 0 auto 0 0; align-items: center; }
.zine-controls-right  { inset: 0 0 0 auto; align-items: center; }
.zine-controls-left .zine-controls-bar,
.zine-controls-right .zine-controls-bar { flex-direction: column; }

.zine-controls-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.zine-controls-btn svg { width: 18px; height: 18px; }
.zine-controls-btn:hover:not(:disabled) { background: var(--zine-controls-hover, rgba(255,255,255,0.14)); }
.zine-controls-btn:focus-visible {
  outline: 2px solid var(--zine-controls-accent, #7dd3fc);
  outline-offset: 1px;
}
.zine-controls-btn:disabled { opacity: 0.38; cursor: default; }
.zine-controls-btn[aria-pressed="true"],
.zine-controls-btn[aria-expanded="true"] { background: var(--zine-controls-hover, rgba(255,255,255,0.14)); }

.zine-controls-sep {
  width: 1px;
  align-self: stretch;
  margin: 4px 2px;
  background: currentColor;
  opacity: 0.22;
}
.zine-controls-left .zine-controls-sep,
.zine-controls-right .zine-controls-sep { width: auto; height: 1px; margin: 2px 4px; }

.zine-controls-page {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  pointer-events: auto;
  white-space: nowrap;
}
.zine-controls-page input {
  width: 2.6em;
  padding: 3px 4px;
  border: 1px solid var(--zine-controls-hover, rgba(255,255,255,0.2));
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font: inherit;
  text-align: center;
  -moz-appearance: textfield;
}
.zine-controls-page input::-webkit-outer-spin-button,
.zine-controls-page input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.zine-controls-page input:focus-visible {
  outline: 2px solid var(--zine-controls-accent, #7dd3fc);
  outline-offset: 0;
}

.zine-controls-menu {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 168px;
  padding: 5px;
  border-radius: 10px;
  pointer-events: auto;
  background: var(--zine-controls-bg, rgba(24, 24, 27, 0.94));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(8px);
}
.zine-controls-menu .zine-controls-btn {
  width: 100%;
  height: auto;
  gap: 9px;
  padding: 7px 9px;
  justify-content: flex-start;
}

.zine-controls-search {
  position: absolute;
  display: flex;
  flex-direction: column;
  width: min(300px, 84%);
  max-height: 260px;
  padding: 6px;
  border-radius: 10px;
  pointer-events: auto;
  background: var(--zine-controls-bg, rgba(24, 24, 27, 0.94));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(8px);
}
.zine-controls-search input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--zine-controls-hover, rgba(255,255,255,0.2));
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font: inherit;
  box-sizing: border-box;
}
.zine-controls-hits { overflow-y: auto; margin-top: 5px; }
.zine-controls-hit {
  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.zine-controls-hit:hover { background: var(--zine-controls-hover, rgba(255,255,255,0.14)); }
.zine-controls-hit:focus-visible {
  outline: 2px solid var(--zine-controls-accent, #7dd3fc);
  outline-offset: -2px;
}
.zine-controls-hit small { display: block; opacity: 0.62; font-size: 0.85em; }
.zine-controls-note { padding: 8px 9px; opacity: 0.66; }

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
