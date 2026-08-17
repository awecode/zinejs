# @zinejs/pdf

PDF content source for [zinejs](https://zinejs.com/docs/), powered by [pdf.js](https://mozilla.github.io/pdf.js/). Renders PDF pages to canvases that [`@zinejs/core`](https://www.npmjs.com/package/@zinejs/core) paints as a flipbook.

> **Docs and examples:** [zinejs.com/docs](https://zinejs.com/docs/) · [CDN example](https://zinejs.com/examples/html-cdn)

## Install

```bash
npm install @zinejs/core @zinejs/pdf
```

`pdfjs-dist` installs with this package. It is loaded lazily (dynamic `import`) so it never lands in the `@zinejs/core` bundle. If your app already depends on `pdfjs-dist`, keep major versions compatible so the worker matches the library.

## Usage

```js
import { Zine } from '@zinejs/core'
import { PdfSource } from '@zinejs/pdf'

new Zine(document.getElementById('book'), {
  source: new PdfSource('document.pdf'),
})
```

Under a bundler that is all you need: the pdf.js worker is resolved for you.

`src` can also be raw bytes or a pdf.js document you already opened:

```js
new PdfSource(arrayBuffer)
new PdfSource(await getDocument(url).promise)
```

## The pdf.js worker

pdf.js parses and rasterizes in a Web Worker. By default `PdfSource` points at the **legacy** worker (because `legacy` defaults to `true`):

```js
new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href
```

Vite, webpack 5, and esbuild rewrite that literal and emit the asset. Resolution order: `workerSrc` option, then `pdfjsLib.GlobalWorkerOptions.workerSrc`, then the auto-default. Pass `workerSrc` only for CDN / UMD or a file you copied yourself, and keep it on the same build as the library (legacy vs modern).

If you already set `GlobalWorkerOptions.workerSrc`, leave `workerSrc` off. A pre-created pdf.js document needs no worker from this package.

CDN / no bundler: load pdf.js first, expose `globalThis.pdfjsLib`, then the UMD builds (core first). See the [HTML CDN example](https://zinejs.com/examples/html-cdn).

## Options

```js
new PdfSource(src, {
  workerSrc,           // override the auto-resolved worker URL
  renderScale: 1,      // pages rasterize at renderScale × devicePixelRatio
  preload: 1,          // adjacent pages to prefetch (default 1)
  maxCacheBytes,       // soft cap on cached page bytes (default ~256 MB)
  progressive: false,  // true: low-res first, then crisp
  disableAutoFetch: false, // true: fetch only the ranges visible pages need
  legacy: true,        // false: lean modern pdf.js (recent engines only)
})
```

### Legacy vs modern (`legacy`)

pdf.js ships two builds. The **legacy** build is transpiled with polyfills and is the default, so PDF books stay usable on older engines as well as current ones. The **modern** build is smaller and a touch faster. Pass `legacy: false` when your audience is on recent browsers:

```js
new PdfSource('document.pdf', { legacy: false })
```

The flag also picks the matching worker. It is ignored when you pass a pre-created document or set `globalThis.pdfjsLib`, since those already chose their build.

Mozilla documents legacy as Chrome 125+, Firefox ESR, Safari 18+, and Chromium Edge. We have seen PDF text rasterize correctly back to Chrome 114. Full notes: [browser support](https://github.com/awecode/zinejs#browser-support).
