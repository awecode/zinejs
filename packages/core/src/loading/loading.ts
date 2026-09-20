import type { LoadProgress } from '../source/types';
import type { ZineStrings } from '../strings';

/**
 * The built-in loading overlay: a spinner, a status line, and a download progress bar.
 *
 * This module is the lazy chunk `zine.ts` reaches through a dynamic `import()`, so a book built
 * with `loading: false`, or one whose source never reports progress, never downloads it. The file
 * is named `loading.ts` rather than `index.ts` so the emitted chunk is `loading-<hash>.js`, which
 * is what the size-limit budget watches (the same trick as `controls/controls.ts`).
 *
 * Everything is scoped under `.zine-loading`, and the colours come from custom properties so a
 * consumer can retheme without overriding rules. Each falls back to `light-dark(light, dark)`, which
 * resolves against the used `color-scheme`, so the overlay follows the host page's light or dark
 * theme with no configuration (the same approach as the controls). A consumer who wants a wholly
 * different indicator passes `loading: false` and drives their own UI from the `progress` event and
 * the `ready` promise.
 */

const STYLE_ID = 'zine-loading-style';

// Wait this long before showing the overlay: a small or cached PDF resolves in a few frames, and
// flashing a spinner for that is worse than showing nothing.
const REVEAL_DELAY_MS = 150;

export const CSS = `
.zine-loading {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  /* The overlay shows during download, before the book is measured and the container gets its
     aspect-ratio (and thus its height). A consumer who sizes the container by width alone leaves it
     near-zero-height meanwhile, which would crush the overlay to a strip and clip the spinner.
     A floor keeps it tall enough to lay out; the box snaps to the book's ratio once it paints. */
  min-height: 160px;
  padding: 24px;
  box-sizing: border-box;
  text-align: center;
  font: 500 14px/1.4 system-ui, sans-serif;
  color: var(--zine-loading-fg, light-dark(#3f3f46, #d4d4d8));
  background: var(--zine-loading-bg, light-dark(#fafafa, #0c0c11));
  border-radius: inherit;
  opacity: 0;
  transition: opacity 150ms ease;
}
.zine-loading-shown { opacity: 1; }
.zine-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--zine-loading-track, light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.14)));
  border-top-color: var(--zine-loading-accent, light-dark(#0284c7, #7dd3fc));
  border-radius: 50%;
  animation: zine-loading-spin 0.8s linear infinite;
}
@keyframes zine-loading-spin { to { transform: rotate(360deg); } }
.zine-loading-text { font-variant-numeric: tabular-nums; }
.zine-loading-bar {
  width: min(240px, 70%);
  height: 6px;
  background: var(--zine-loading-track, light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.14)));
  border-radius: 3px;
  overflow: hidden;
}
.zine-loading-fill {
  width: 0;
  height: 100%;
  background: var(--zine-loading-accent, light-dark(#0284c7, #7dd3fc));
  border-radius: 3px;
  transition: width 150ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .zine-loading { transition: none; }
  .zine-loading-spinner { animation-duration: 2s; }
  .zine-loading-fill { transition: none; }
}
`;

/** Add the stylesheet to `doc` if it is not already there. */
function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (doc.head ?? doc.documentElement)?.appendChild(style);
}

/** Handle the engine uses to drive and tear down the overlay. */
export interface LoaderHandle {
  /** Download phase: reflect bytes fetched, showing a percentage bar when a total is known. */
  update(progress: LoadProgress): void;
  /** Downloading is done; the wait is now rasterizing the first spread. */
  preparing(): void;
  /** Remove the overlay and restore anything it changed on the container. */
  destroy(): void;
}

/**
 * Build the overlay inside `container` and return a handle to drive it.
 *
 * The overlay is hidden for the first {@link REVEAL_DELAY_MS} so a fast load never flashes it;
 * `destroy()` before then cancels the reveal outright.
 */
export function mountLoading(container: HTMLElement, strings: ZineStrings): LoaderHandle {
  const doc = container.ownerDocument;
  ensureStyles(doc);

  const overlay = doc.createElement('div');
  overlay.className = 'zine-loading';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const spinner = doc.createElement('div');
  spinner.className = 'zine-loading-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const text = doc.createElement('div');
  text.className = 'zine-loading-text';
  text.textContent = strings.loadingOpening;

  const bar = doc.createElement('div');
  bar.className = 'zine-loading-bar';
  bar.style.display = 'none';
  const fill = doc.createElement('div');
  fill.className = 'zine-loading-fill';
  bar.appendChild(fill);

  overlay.append(spinner, text, bar);
  container.appendChild(overlay);

  // The overlay is absolutely positioned; a statically-positioned container would let it escape.
  // Give the container a positioning context and restore it on teardown. getComputedStyle is
  // absent under some test DOMs, so guard it.
  let restorePosition: string | null = null;
  const computed =
    typeof globalThis.getComputedStyle === 'function' ? globalThis.getComputedStyle(container) : null;
  if (!computed || computed.position === 'static' || computed.position === '') {
    restorePosition = container.style.position;
    container.style.position = 'relative';
  }

  let revealed = false;
  const revealTimer = setTimeout(() => {
    revealed = true;
    overlay.classList.add('zine-loading-shown');
  }, REVEAL_DELAY_MS);

  return {
    update(progress: LoadProgress): void {
      if (progress.total > 0) {
        const pct = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
        text.textContent = strings.downloadingPercent(pct);
        bar.style.display = '';
        fill.style.width = `${pct}%`;
      } else {
        text.textContent = strings.downloadingSize(progress.loaded / 1024 / 1024);
        bar.style.display = 'none';
      }
    },
    preparing(): void {
      text.textContent = strings.loadingPreparing;
      bar.style.display = 'none';
    },
    destroy(): void {
      if (!revealed) clearTimeout(revealTimer);
      overlay.remove();
      if (restorePosition !== null) container.style.position = restorePosition;
    },
  };
}
