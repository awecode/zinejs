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

pdf.js parses and rasterizes in a Web Worker. By default `PdfSource` finds the worker via Vite's
`?url` import, webpack's `new URL('pdfjs-dist/…', import.meta.url)` emit, or the sibling
`pdfjs-dist` install. If that cannot be resolved, it falls back to a jsDelivr URL pinned to the
same `pdfjs-dist` version that loaded, and warns once in the console. Set `cdnFallback: false`
for CSP-restricted or offline apps (then pass `workerSrc`, or the open fails clearly instead of
loading a network worker that CSP would block).

Resolution order: `workerSrc` option, then `pdfjsLib.GlobalWorkerOptions.workerSrc`, then that
auto-default. Pass `workerSrc` for CDN / UMD, offline / CSP setups, or if auto-resolve fails in
your bundler:

```js
import { PdfSource } from '@zinejs/pdf'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

new PdfSource('document.pdf', { workerSrc })
// CSP / offline: also disable the CDN last resort
new PdfSource('document.pdf', { workerSrc, cdnFallback: false })
```

Keep the worker on the same build as the library (`legacy` vs modern). If you already set
`GlobalWorkerOptions.workerSrc`, leave `workerSrc` off. A pre-created pdf.js document needs no
worker from this package.

### Vite: exclude from dependency pre-bundling

Vite's dependency optimizer may not be able to follow the worker's `?url` import, so pre-bundling
`@zinejs/pdf` fails to start the dev server (`Could not load .../pdf.worker.min.mjs?url`).
Exclude it so Vite's normal pipeline resolves the worker:

```js
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['@zinejs/pdf'] },
})
```

(`npm create @zinejs` sets this up for you in the PDF starter.)

CDN / no bundler: load pdf.js first, expose `globalThis.pdfjsLib`, then the UMD builds (core
first). See the [HTML CDN example](https://zinejs.com/examples/html-cdn). A UMD host has no
bundler to resolve the worker locally, so it uses your `workerSrc`, an already-set
`GlobalWorkerOptions.workerSrc`, or the version-matched CDN fallback (matched to the global
pdf.js's version; silent here, since a CSP/offline failure surfaces through the browser and pdf.js
anyway). Set `cdnFallback: false` to require explicit configuration instead.

## Options

```js
new PdfSource(src, {
  workerSrc,           // override the auto-resolved worker URL
  cdnFallback: true,   // false: never load the worker from jsDelivr (CSP / offline)
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
