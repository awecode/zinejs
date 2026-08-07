# @zinejs/core

Framework-agnostic flipbook engine: turn images or PDFs into a page-flipping book. Zero dependencies. Ships a **CSS renderer** (works everywhere, no GPU) and a **WebGL2 renderer** (page-curl, auto-selected where a GPU is available), behind one API — you never choose a renderer.

> Pre-1.0 and under active development. Licensed **PolyForm Noncommercial 1.0.0** (free for non-commercial use).

## Install

```bash
npm install @zinejs/core
```

Also ships a **UMD** build at `dist/index.umd.js` (global `ZineJS`) for CDN / `<script>` hosts. The ESM build code-splits the CSS and WebGL2 renderers; the UMD build inlines both so a single script is enough.

## Image book

```js
import { Zine, ImageSource } from '@zinejs/core';

const book = new Zine(document.getElementById('book'), {
  source: new ImageSource([
    'page-01.png',
    'page-02.png',
    'page-03.png',
    'page-04.png',
  ]),
});
```

Give the container a size (e.g. `#book { width: 900px; height: 560px; }`). Flip by dragging a corner or clicking near an edge; zoom with double-click, Ctrl/⌘+wheel, or pinch.

## PDF book

Install the plugin (see [`@zinejs/pdf`](https://www.npmjs.com/package/@zinejs/pdf)):

```js
import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

new Zine(document.getElementById('book'), {
  source: new PdfSource('document.pdf'),
});
```

## Options

```ts
new Zine(container, {
  source,                    // ImageSource | PdfSource (required)
  direction: 'ltr',          // 'ltr' | 'rtl'
  spreadMode: 'cover',       // 'double' | 'single' | 'cover' (lone first page) | 'book' (lone first & last)
  curl: 'cone',              // WebGL2 only: 'cone' | 'roll' | 'leaf' | 'flick' | 'silk' | 'simple'
  frontCover: 'front.jpg',   // optional image prepended as a lone front cover
  backCover: 'back.jpg',     // optional image appended as a lone back cover
  pages: { 4: 'ad.jpg' },    // optional: replace source pages with images (0-based; -1 = last)
  startPage: 0,
  flipDuration: 800,         // ms (spread timing; a lone page stretches it and eases out)
  singlePageThreshold: 640,  // px: below this, show one page at a time
  clickToFlip: 'edge',       // 'edge' | 'half' | 'off'
  zoom: { enabled: true, max: 4, wheel: true, doubleClick: [1, 2, 4] },
  renderer: 'auto',          // 'auto' | 'css' | 'webgl2' | a custom Renderer
  controls: true,            // built-in toolbar; false for none, or { position, items, … }
});
```

## Controls

A toolbar (paging, page number, zoom, search, share, a `⋮` menu with download, and fullscreen)
is rendered below the book by default. Turn it off with `controls: false`, move it with
`controls: { position: 'top' }`, float it over the book with `controls: { docked: false }`, or
choose the buttons with `controls: { items: [...] }`. Register your own with `defineControl`.

The toolbar and its icons load as a separate chunk, so a book with `controls: false` never
downloads them. See the [full docs](https://github.com/awecode/zinejs#controls).

See the [root README](../../README.md#curl-models) for what each curl model does.
## Methods & events

```js
book.flipNext(); book.flipPrev(); book.flipTo(12);
book.getPage(); book.getPageCount();
book.setZoom(2); book.resetZoom();
book.update(); book.destroy();

book.on('ready' | 'pageChanged' | 'flipStart' | 'flipEnd' | 'zoomChanged' | 'sourceError' | 'rendererFallback', handler);
```

A JSON Schema for the options is published at `@zinejs/core/options.schema.json`.
