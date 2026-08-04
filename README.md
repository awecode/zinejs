# zinejs

A framework-agnostic, GPU-accelerated flipbook for the web. Turn a list of images or a PDF into an interactive page-flip book with realistic paper curls, pinch/wheel zoom, and a CSS fallback for devices without WebGL2.

> **📖 Full reference, live demos, and guides: [zinejs.com/docs](https://zinejs.com/docs/)**

The sections below are a compact reference for every option, method, and event. See the docs for detailed explanations and examples.

## Packages

| Package | What it is |
| --- | --- |
| [`@zinejs/core`](packages/core) | The flipbook engine (renderer, gestures, zoom, spreads, curls). |
| [`@zinejs/pdf`](packages/pdf) | PDF content source, powered by pdf.js. |

## Install

```bash
npm install @zinejs/core
# for PDFs, also:
npm install @zinejs/pdf
```

## Quick start

The container needs a size — give it one via CSS, or the `width`/`height` options.

```js
import { Zine, ImageSource } from '@zinejs/core';

const zine = new Zine(document.getElementById('book'), {
  source: new ImageSource([
    '/pages/01.jpg',
    '/pages/02.jpg',
    '/pages/03.jpg',
    '/pages/04.jpg',
  ]),
  spreadMode: 'cover', // lone first page, then paired
  curl: 'cone',        // natural conical page turn (WebGL2)
  zoom: { max: 4 },
});

await zine.ready;

zine.on('pageChanged', ({ page }) => console.log('now on page', page));

document.querySelector('#next').addEventListener('click', () => zine.flipNext());
document.querySelector('#prev').addEventListener('click', () => zine.flipPrev());
```

PDFs are a drop-in swap of the source (bundlers auto-resolve the pdf.js worker):

```js
import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

new Zine(document.getElementById('book'), {
  source: new PdfSource('/brochure.pdf', { progressive: true }),
});
```

## `new Zine(container, options)`

`container` is an `HTMLElement`. Options (only `source` is required):

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `Source` | — | Content source, e.g. `new ImageSource(urls)` or `new PdfSource(...)`. **Required.** |
| `renderer` | `'auto' \| 'css' \| 'webgl2'` \| `('css' \| 'webgl2')[]` \| `Renderer` | `'auto'` | Renderer or ordered fallback list. `'auto'` prefers GPU, falls back to CSS. |
| `curl` | `'roll' \| 'cone' \| 'leaf' \| 'flick' \| 'silk' \| 'simple'` | `'cone'` | Page-curl model (WebGL2 only — see [Curl models](#curl-models)). |
| `spreadMode` | `'double' \| 'single' \| 'cover' \| 'book'` | `'cover'` | How pages group into spreads (see below). |
| `direction` | `'ltr' \| 'rtl'` | `'ltr'` | Reading direction. |
| `startPage` | `number` | `0` | Zero-based page to open on. |
| `flipDuration` | `number` (ms) | `800` | Flip animation duration. Timed for a two-page spread; a lone page stretches this and eases out harder (no facing landing). |
| `width` | `number` (px) | — | Fixed container width; omit to let CSS size it. |
| `height` | `number` (px) | — | Fixed container height; omit to let CSS size it. |
| `frontCover` | `string` (URL) | — | Image prepended as a lone front cover (adds a page). |
| `backCover` | `string` (URL) | — | Image appended as a lone back cover (adds a page). |
| `pages` | `Record<number, string>` | — | Replace source pages with image URLs, keyed by 0-based index (negative = from the end). |
| `clickToFlip` | `'edge' \| 'half' \| 'off'` | `'edge'` | Tap/click to turn: near an edge, by page half, or off. |
| `clickZoneSize` | `number` (px) | `64` | Edge-zone width per side, when `clickToFlip: 'edge'`. |
| `clickFlipDelay` | `number` (ms) | auto | Delay before a click flips, so a double-click zoom can preempt it. Auto: `0` normally, `250` when double-click zoom is active in the flip zone. |
| `singlePageThreshold` | `number` (px) | `640` | Below this container width, show one page per spread; `0` disables the responsive fallback. |
| `zoom` | `ZoomOptions` | see below | Zoom behavior. |

### `spreadMode`

- `double` — pages paired from page 0 (`[0,1] [2,3] …`).
- `single` — one page per spread.
- `cover` — lone first page, then paired (magazine/catalog cover).
- `book` — lone first **and** last page.

### `zoom` options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Whether zooming is allowed. |
| `max` | `number` | `4` | Maximum zoom scale. |
| `wheel` | `boolean` | `true` | Zoom on Ctrl/Cmd + wheel. |
| `doubleClick` | `number[] \| false` | `[1, 2, 4]` | Zoom levels cycled by double-click (wraps); `false` disables. |
| `doubleClickInFlipZone` | `boolean` | off in `'edge'`, on in `'half'` | Listen for double-click zoom inside click-to-flip zones. Enabling makes clicks wait out `clickFlipDelay`. |

## Curl models

The WebGL2 renderer bends the turning leaf with one of six models (`curl` option). The CSS fallback ignores this and does a plain spine rotation.

| `curl` | Motion | Anchored to tap? |
| --- | --- | --- |
| `cone` (default) | Natural conical curl (PARC / iBooks-style): stiff paper wraps a breathing cone, then settles flat. | Yes |
| `roll` | Rolls up into a cylinder in place, then unwraps and flops onto the far side. | No |
| `leaf` | Traveling smooth-curvature wave: flat paper bends without stretching, then leaves as a flat turned flap. | Yes |
| `flick` | Inertial follow-through: the sheet trails the accelerating turn, swings through vertical, then overtakes and settles as it brakes. | Yes |
| `silk` | Hand-turned S-curve: spine-driven rotation with a true inflection (body bend + free-edge reverse curl), early peel lead, corner lag. | Yes |
| `simple` | Plain flat page turn: a rigid spine rotation, edge-on at the midpoint, no bend. | No |

For anchored models (`cone`, `leaf`, `flick`, `silk`), the fold originates at the corner nearest where the reader taps/grabs.

On a lone page (`single` mode, or a cover/back page), `roll` turns exactly as it does on a spread, but since there is no facing page to flop onto it dissolves into the arriving page as it lands. A lone page also sweeps the full container width rather than half of it, so it takes longer than `flipDuration` and eases out harder — there is no facing landing to watch, only the peel and fade. `cone` also softens and slightly delays its flop on full-width lone pages so the peel stays over the sheet; the other models are otherwise unchanged.

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `ready` (getter) | `Promise<void>` | Resolves once the renderer is mounted and the first spread is painted. |
| `flipNext()` | `void` | Turn to the next spread. |
| `flipPrev()` | `void` | Turn to the previous spread. |
| `flipTo(page)` | `void` | Animate to the spread containing zero-based `page`. |
| `getPage()` | `number` | Current leading page index. |
| `getPageCount()` | `number` | Total page count (including covers/replacements). |
| `getZoom()` | `number` | Current zoom scale (`1` = fit). |
| `setZoom(scale, center?)` | `void` | Zoom to `scale`, keeping container-local `center` `{x, y}` fixed. |
| `resetZoom()` | `void` | Zoom back to `1`. |
| `on(event, listener)` | `() => void` | Subscribe to an event; returns an unsubscribe function. |
| `update()` | `void` | Re-measure and repaint after a layout change (also handled automatically via `ResizeObserver`). |
| `destroy()` | `void` | Tear down DOM, listeners, and any GPU context. |

## Events

Subscribe with `zine.on(event, listener)`; it returns an unsubscribe function.

| Event | Payload | Fires when |
| --- | --- | --- |
| `ready` | `void` | Renderer mounted and first spread painted. |
| `flipStart` | `{ from: number; to: number }` | A page turn begins. |
| `flipEnd` | `{ page: number }` | A page turn finishes. |
| `pageChanged` | `{ page: number }` | The current page changes. |
| `zoomChanged` | `{ scale: number }` | The zoom scale changes. |
| `sourceError` | `{ index: number; error: unknown }` | A page fails to load/decode. |
| `rendererFallback` | `{ from: string; to: string }` | The renderer falls back (e.g. `webgl2` → `css`). |

## Sources

A source resolves page indices to rasters. Two are built in; any object implementing the `Source` interface works.

### `ImageSource(urls, options?)`

```js
new ImageSource(['/a.jpg', '/b.jpg'], { preload: 1, fit: 'contain' });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preload` | `number` | `1` | Adjacent pages to prefetch around a requested page. |
| `fit` | `'contain' \| 'cover'` | `'contain'` | How each image fits its page. |

### `PdfSource(src, options?)` — from `@zinejs/pdf`

`src` is a URL `string`, a PDF `ArrayBuffer`/`Uint8Array`, or a pre-created pdf.js document.

```js
new PdfSource('/doc.pdf', { renderScale: 1, progressive: true });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `workerSrc` | `string` | auto | pdf.js worker URL. Auto-resolved under bundlers; pass it for CDN/UMD/custom paths. |
| `renderScale` | `number` | `1` | Base scale; pages rasterize at `renderScale × devicePixelRatio`. |
| `preload` | `number` | `1` | Adjacent pages to prefetch. |
| `maxCacheBytes` | `number` | ~256 MB | Soft cap on cached page bytes (LRU-evicted). |
| `progressive` | `boolean` | `false` | Paint a low-res page first, then swap to crisp (faster first paint). |
| `disableAutoFetch` | `boolean` | `false` | Fetch only the byte ranges visible pages need (range-capable servers). |

`pdfjs-dist` ships as a dependency of `@zinejs/pdf` (no separate install). The plugin loads it lazily so it never lands in the core bundle. See [`@zinejs/pdf`](packages/pdf) for worker setup under Vite, webpack, CDN, and custom paths.

## Covers and page replacement

Compose a source without rebuilding it:

```js
new Zine(el, {
  source: new PdfSource('/catalog.pdf'),
  frontCover: '/cover.jpg',   // adds a lone front page
  backCover: '/back.jpg',     // adds a lone back page
  pages: { 0: '/hero.jpg', -1: '/last.jpg' }, // replace by index (negative = from end)
});
```

## Renderers

- **WebGL2** (`webgl2`) — GPU mesh curl with per-pixel lighting and the [curl models](#curl-models) above.
- **CSS** (`css`) — DOM/CSS-transform fallback with a plain spine rotation; used automatically when WebGL2 is unavailable.

With `renderer: 'auto'` (default), zinejs picks WebGL2 when available and falls back to CSS, emitting `rendererFallback`.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) · [github.com/awecode/zinejs](https://github.com/awecode/zinejs)

---

**📖 Full documentation, guides, live demos, and API reference: [zinejs.com/docs](https://zinejs.com/docs/)**
