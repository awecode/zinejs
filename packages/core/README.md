# @zinejs/core

Framework-agnostic flipbook engine: turn images or PDFs into a page-flipping book. Zero dependencies. Ships a **CSS renderer** (works everywhere, no GPU) and a **WebGL2 renderer** (page-curl, auto-selected where a GPU is available), behind one API — you never choose a renderer.

> Pre-1.0 and under active development. Licensed **PolyForm Noncommercial 1.0.0** (free for non-commercial use).

## Install

```bash
npm install @zinejs/core
```

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
  cover: false,              // treat the first page as a standalone cover
  startPage: 0,
  flipDuration: 800,         // ms
  singlePageThreshold: 640,  // px: below this, show one page at a time
  clickToFlip: 'edge',       // 'edge' | 'half' | 'off'
  zoom: { enabled: true, max: 4, wheel: true, doubleClick: [1, 2, 4] },
  renderer: 'auto',          // 'auto' | 'css' | 'webgl2' | a custom Renderer
});
```

## Methods & events

```js
book.flipNext(); book.flipPrev(); book.flipTo(12);
book.getPage(); book.getPageCount();
book.setZoom(2); book.resetZoom();
book.update(); book.destroy();

book.on('ready' | 'pageChanged' | 'flipStart' | 'flipEnd' | 'zoomChanged' | 'sourceError' | 'rendererFallback', handler);
```

A JSON Schema for the options is published at `@zinejs/core/options.schema.json`.
