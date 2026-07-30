# @zinejs/pdf

PDF content source for [zinejs](https://github.com/), powered by [pdf.js](https://mozilla.github.io/pdf.js/). Renders PDF pages to canvases that the zinejs core paints as a flipbook.

## Install

```bash
npm install @zinejs/core @zinejs/pdf pdfjs-dist
```

`pdfjs-dist` is a **peer dependency** — you install it, and the plugin loads it lazily so it never lands in the core bundle.

## Usage

```js
import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

const book = new Zine(document.getElementById('book'), {
  source: new PdfSource('document.pdf'),
});
```

Under a bundler that's all you need — the pdf.js worker is resolved for you.

## The pdf.js worker (`workerSrc`)

pdf.js parses and rasterizes in a Web Worker, a separate file the host must locate. By default `PdfSource` resolves it to:

```js
new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
```

Resolution precedence: an explicit `workerSrc` option → an already-set `pdfjsLib.GlobalWorkerOptions.workerSrc` → the auto-default above. You only pass `workerSrc` when the default can't apply.

### Vite / webpack 5 / esbuild

Nothing to do — these bundlers statically rewrite the `new URL(..., import.meta.url)` above and emit the worker asset:

```js
new PdfSource('document.pdf');
```

### CDN / `<script>` (UMD)

No bundler to rewrite the URL, so point at a hosted worker matching your pdf.js version:

```js
new ZineJS.PdfSource('document.pdf', {
  workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.mjs',
});
```

### Custom path

Serving the worker yourself (copied to your public dir, etc.):

```js
new PdfSource('document.pdf', { workerSrc: '/assets/pdf.worker.min.mjs' });
```

### Already configuring pdf.js yourself

If your app sets `GlobalWorkerOptions.workerSrc`, `PdfSource` leaves it alone — no `workerSrc` needed.

## Passing bytes or a pre-created document

```js
new PdfSource(arrayBuffer);              // raw PDF bytes (ArrayBuffer | Uint8Array)
new PdfSource(await getDocument(...).promise); // a pdf.js document you created; no workerSrc needed
```

## Options

```ts
new PdfSource(src, {
  workerSrc,          // string — override the auto-resolved worker URL (see above)
  renderScale: 1,     // pages rasterize at renderScale × devicePixelRatio
  preload: 1,         // adjacent pages to prefetch around a requested page
  maxCacheBytes,      // soft cap on cached page bytes (default ~256 MB); LRU-evicts beyond it
});
```

`src` is a URL string, `ArrayBuffer`/`Uint8Array` of PDF bytes, or a pre-created pdf.js document.
