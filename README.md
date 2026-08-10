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

Both packages also ship **UMD** builds for CDN / `<script>` hosts (`dist/index.umd.js`). Core exposes the `ZineJS` global; the PDF package **extends** the same global (load core first). See [`@zinejs/pdf`](packages/pdf) for a full CDN example with pdf.js + `workerSrc`.

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
| `singlePageThreshold` | `number` (px) | `640` | Below this container width, show one page per spread. |
| `responsiveSpread` | `boolean` | `true` | Whether a narrow container may override `spreadMode`. `false` holds the configured mode at every width. |
| `zoom` | `ZoomOptions` | see below | Zoom behavior. |
| `controls` | `boolean \| ControlsOptions` | `true` | Built-in toolbar (see [Controls](#controls)). `false` renders none. |
| `deepLink` | `boolean` | `true` | Keep the page in the URL hash (see [Deep links](#deep-links)). |
| `disableContextMenu` | `boolean` | `false` | Suppress the browser's right-click menu over the book. A deterrent, not protection — the pages stay in the DOM — and it also removes Inspect and "Open image in new tab" for everyone. |

### `spreadMode`

- `double` — pages paired from page 0 (`[0,1] [2,3] …`).
- `single` — one page per spread.
- `cover` — lone first page, then paired (magazine/catalog cover).
- `book` — lone first **and** last page.

Below `singlePageThreshold` the container is too narrow for two pages, so the book shows one at a
time whatever `spreadMode` says. Pass `responsiveSpread: false` to hold the configured mode at
every width, or change it later with `setResponsiveSpread()`.

### `zoom` options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Whether zooming is allowed. |
| `max` | `number` | `4` | Maximum zoom scale. |
| `wheel` | `boolean` | `true` | Zoom on Ctrl/Cmd + wheel. |
| `doubleClick` | `number[] \| false` | `[1, 2, 4]` | Zoom levels cycled by double-click (wraps); `false` disables. |
| `doubleClickInFlipZone` | `boolean` | off in `'edge'`, on in `'half'` | Listen for double-click zoom inside click-to-flip zones. Enabling makes clicks wait out `clickFlipDelay`. |

## Controls

A toolbar is rendered below the book by default, in normal flow so it never covers a page.

```js
new Zine(el, { source, controls: false });                    // no toolbar
new Zine(el, { source, controls: { position: 'top' } });      // move it
new Zine(el, { source, controls: { docked: false } });        // float it over the book
new Zine(el, { source, controls: { items: ['prev', 'next'] } }); // choose the buttons
```

### `controls` options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Which edge of the book the toolbar sits on. |
| `docked` | `boolean` | `true` | Sit outside the book. `false` floats the toolbar over it. |
| `items` | `ControlItem[]` | see below | The layout. Replaces the default set entirely. |
| `arrows` | `boolean` | `true` | Large page-turn arrows flanking the book. |
| `className` | `string` | — | Extra class on the toolbar root, for styling. |

### Page arrows

Large back/forward arrows sit either side of the book, as most flipbooks show. They are placed
*beside* it, not over it, so they never cover a page — the library wraps your container in a flex
row and puts them on the outside, leaving the container's own size untouched. In RTL they swap, so
each arrow still points the way the page will turn. An arrow with nowhere to go is not shown —
there is no back arrow on the first page — though it keeps its place in the layout so the book
does not slide across as the reader reaches a cover. Both hide below 640px where there is no room
to flank. Turn them off with `controls: { arrows: false }`.

A docked toolbar is placed as a **sibling** of your container, inside a flex wrapper the library
adds around it — the container's own size is left alone, since the renderer measures it to size
the book. `destroy()` unwraps it again. A floating toolbar is a child of the container instead,
absolutely positioned, and lets clicks through everywhere except the buttons themselves.

### Built-in controls

`prev`, `next`, `first`, `last`, `pageInput` (an editable page number), `zoomIn`, `zoomOut`,
`search`, `thumbnails`, `outline`, `print`, `download`, `share`, `fullscreen`, `menu`. A `'|'` in
`items` draws a separator.

The default layout is:

```js
['prev', 'pageInput', 'next', '|', 'zoomOut', 'zoomIn', 'search', 'share', 'menu', 'fullscreen']
```

`menu` is the `⋮` overflow, holding
`['first', 'last', 'thumbnails', 'outline', 'print', 'download']`.

### Side panels

`thumbnails`, `outline` and `search` each open a rail beside the book. They share that space, so
opening one closes the others, and all are as tall as the book and scroll internally — a long list
never runs past the bottom. All three are for documents (a PDF), not image books.

**`thumbnails`** shows the pages. Its rows mirror the book's own spread grouping, so it always
matches what the reader sees, including the responsive fallback on a narrow container:

- `double` — two pages per row, and the rail is two thumbs wide.
- `single` — one page per row, and the rail narrows to a single thumb.
- `cover` / `book` — two columns for the paired interior, with the lone first (and last) page
  centred between them rather than stretched across.

Clicking a row turns to that spread, and pages decode only as they scroll into view.

**`outline`** shows the document's table of contents: one heading per row, nested entries indented,
in a single column. Clicking a heading turns to its page, and the entry containing the current page
stays highlighted. A heading whose destination cannot be resolved is still listed, just not
clickable. Many PDFs carry no outline, so the control only appears once the document is known to
have one.

**`search`** puts a query field over its results: one row per matching page, showing the page
number and the matching text in context. Clicking a row turns to that page. It appears only for a
source that can produce text — see [Search](#search).

Controls hide themselves when they cannot work: `search` unless the source can produce text (see
[Search](#search)), `download` unless there is an original file to save (see
[Download](#download)), and `fullscreen` where the Fullscreen API is unavailable. A submenu whose
entries have all hidden themselves hides too, rather than opening onto nothing — so `menu`
disappears on a book with no downloadable file.

### Custom controls

Register one with `defineControl`, then name it in `items`. A control with `children` becomes a
submenu, nested as deeply as you like.

```js
import { Zine, defineControl } from '@zinejs/core';

defineControl({
  id: 'print',
  title: 'Print',
  icon: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  action: ({ zine }) => window.print(),
});

new Zine(el, {
  source,
  controls: { items: ['prev', 'next', '|', { id: 'tools', title: 'Tools', children: ['print', 'share'] }] },
});
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique key; how `items` refers to it. Reusing an id replaces that control. |
| `title` | `string \| (ctx) => string` | Tooltip and accessible name. A function is re-read on every change, so a toggle can say what it will do next. |
| `icon` | `string \| (ctx) => string` | Inner SVG markup, drawn in a 24×24 `viewBox` with `currentColor`. A function is re-read on every change, so a glyph can mirror in RTL or follow state. |
| `children` | `ControlItem[]` | Nested controls; makes this a submenu. |
| `action` | `(ctx) => void` | What it does. `ctx` is `{ zine, close }`. |
| `render` | `(ctx) => HTMLElement` | Build a custom widget instead of a button. |
| `isVisible` | `(ctx) => boolean` | Whether the control applies to this book at all — search with no text, download with no file. Failing it removes the control. For something that comes and goes as the reader moves, prefer `isDisabled`, so the bar does not reshuffle. |
| `isDisabled` | `(ctx) => boolean` | Grey out and block the action. |
| `isActive` | `(ctx) => boolean` | Mark as currently on. |

Naming an id in `items` with only some fields overrides just those: `{ id: 'next', title: 'Forward' }`
relabels the built-in without reimplementing it.

### Styling

The toolbar reads these custom properties, so it can be rethemed without overriding rules:

```css
.zine-controls {
  --zine-controls-bg: rgba(24, 24, 27, 0.82);
  --zine-controls-fg: #f4f4f5;
  --zine-controls-hover: rgba(255, 255, 255, 0.14);
  --zine-controls-accent: #7dd3fc;
}
```

## Deep links

The current page lives in the URL hash, so a link opens where the reader was and back/forward move
through the book:

```
yoursite.com/brochure#page=12
```

Only the `page` key is read or written — anything else in the hash is left alone, so an app routing
on it is unaffected — and updates use `replaceState`, so turning fifty pages does not put fifty
entries in the reader's history. A page in the URL takes precedence over `startPage`, since the
reader followed a link to it.

`zine.pageLink(page?)` returns the URL for a page, defaulting to the current one. Pass
`deepLink: false` if your app owns the hash.

Only one book per page can own the hash — with two on a page they would overwrite each other, and
the second to load would open on the first one's page. The first claims it; the rest work
normally, they just do not appear in the address bar.

## Share

The `share` control opens a dialog with a QR code for the current page, the link with a copy
button, and buttons for Facebook, X (Twitter), LinkedIn, WhatsApp, Pinterest and email.

The dialog, its brand marks and the QR encoder are a separate lazy chunk, downloaded the first
time a reader presses Share — a book nobody shares pays nothing for it. The QR is generated
locally rather than through an image service, so no reader's URL leaves the page, and the social
buttons are plain share links with no third-party scripts or trackers.

## Search

`zine.search(query)` resolves to `{ page, excerpt }[]` for every page whose text contains `query`,
case-insensitively. It needs a source that can produce text: `PdfSource` can, `ImageSource` cannot.

```js
if (zine.canSearch()) {
  const hits = await zine.search('invoice');
  zine.flipTo(hits[0].page);
}
```

Text is pulled per page on demand and cached, so the first search over a long document costs one
extraction per page and later ones are cheap. Pages replaced by an image (`pages`, `frontCover`,
`backCover`) report no text, since the PDF text underneath is not what the reader sees.

To make a custom source searchable, implement the optional `getText(index): Promise<string>`.

## Download

`zine.download()` saves the original document. It works for a `PdfSource` created from a URL or
from raw bytes; a PDF opened from a pdf.js document you created yourself has no file of its own,
and an image book is not a single file at all — both resolve `false`.

```js
if (zine.canDownload()) await zine.download();
```

The `download` control in the `⋮` menu calls this, and hides itself (taking the empty menu with
it) when `canDownload()` is false.

## Print

`zine.print()` prints the document. It hands the original file to the browser in an offscreen
frame rather than printing the host page — printing the page would capture the toolbar and
whichever single spread is on screen, while the browser paginates a PDF properly by itself.

Like download, it needs a source with an original file, so the `print` control appears for PDFs
and not for image books.
To make a custom source downloadable, implement the optional
`getDownload(): Promise<DownloadInfo | null>`, returning `{ url, filename, revoke? }`. Set `revoke`
when `url` came from `URL.createObjectURL` so it is released after the save.

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
| `canFlipNext()` | `boolean` | Whether a spread follows the current one. |
| `canFlipPrev()` | `boolean` | Whether a spread precedes the current one. |
| `getSpreads()` | `readonly Spread[]` | How pages are grouped, one entry per spread. Reflects `spreadMode` and the responsive fallback. |
| `getSpreadIndex()` | `number` | Which spread is on screen; indexes into `getSpreads()`. |
| `getDirection()` | `'ltr' \| 'rtl'` | Reading direction. |
| `getResponsiveSpread()` | `boolean` | Whether a narrow container may override `spreadMode`. |
| `setResponsiveSpread(on)` | `void` | Allow or forbid that override, re-laying out at once. |
| `isResponsiveSingle()` | `boolean` | Whether one page is showing *because* the container is narrow. |
| `getPageImage(index)` | `Promise<PageContent \| null>` | One page's raster, for thumbnails or export. `null` if it cannot be decoded. |
| `getZoom()` | `number` | Current zoom scale (`1` = fit). |
| `getMaxZoom()` | `number` | The ceiling `setZoom` clamps to. |
| `canSearch()` | `boolean` | Whether this book's source can produce text. |
| `search(query, opts?)` | `Promise<SearchHit[]>` | Pages matching `query`; see [Search](#search). |
| `canDownload()` | `boolean` | Whether the original document can be saved. |
| `download()` | `Promise<boolean>` | Save the original; `false` if there is nothing to save. |
| `canPrint()` | `boolean` | Whether the book can be printed. |
| `print()` | `Promise<boolean>` | Print the original; `false` if there is nothing to print. |
| `isDocument()` | `boolean` | Whether the book is a document (a PDF) rather than loose images. |
| `pageLink(page?)` | `string` | URL that opens the book at `page` (default: current). |
| `canOutline()` | `boolean` | Whether the source can supply a table of contents. |
| `getOutline()` | `Promise<OutlineItem[]>` | The table of contents; empty when there is none. |
| `container` (getter) | `HTMLElement` | The element the flipbook was mounted into. |
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
