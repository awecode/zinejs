# @zinejs/pdf

PDF content source for [zinejs](https://github.com/), powered by [pdf.js](https://mozilla.github.io/pdf.js/). Renders PDF pages to canvases that the zinejs core paints as a flipbook.

## Install

```bash
npm install @zinejs/core @zinejs/pdf
```

`pdfjs-dist` is a normal dependency of `@zinejs/pdf`, so it installs with the package. The plugin still loads it lazily (dynamic `import`) so it never lands in the `@zinejs/core` bundle. If your app already depends on `pdfjs-dist`, the package manager will typically dedupe to one copy — keep major versions compatible so the worker matches the library.

## Usage

```js
import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

const book = new Zine(document.getElementById('book'), {
  source: new PdfSource('document.pdf'),
});
```

Under a bundler that's all you need — the pdf.js worker is resolved for you.

### CDN / no bundler

Both packages ship **UMD** builds (`dist/index.umd.js`) that share the `ZineJS` global — load **core first**, then pdf (the pdf build uses `extend: true` so it merges into `ZineJS` instead of replacing it).

Modern `pdfjs-dist` is ESM-only, so load it in a module script first, expose
`globalThis.pdfjsLib`, then use classic deferred `<script>` tags for the UMD
builds (and pass an explicit `workerSrc` — no bundler rewrites the worker URL):

```html
<script type="module">
  import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.min.mjs';
  globalThis.pdfjsLib = pdfjsLib;
</script>

<script defer src="https://cdn.jsdelivr.net/npm/@zinejs/core/dist/index.umd.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/@zinejs/pdf/dist/index.umd.js"></script>
<script defer>
  const book = new ZineJS.Zine(document.getElementById('book'), {
    source: new ZineJS.PdfSource('document.pdf', {
      workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.mjs',
    }),
  });
</script>
```

Image-only books can skip pdf.js and use a plain classic script:

```html
<script src="https://cdn.jsdelivr.net/npm/@zinejs/core/dist/index.umd.js"></script>
<script>
  new ZineJS.Zine(document.getElementById('book'), {
    source: new ZineJS.ImageSource(['page-01.png', 'page-02.png']),
  });
</script>
```

`PdfSource` prefers `globalThis.pdfjsLib` when present (CDN), otherwise dynamic-imports `pdfjs-dist` (bundlers).

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
  renderScale: 1,      // pages rasterize at renderScale × devicePixelRatio
  preload: 1,          // adjacent pages to prefetch around a requested page
  maxCacheBytes,       // soft cap on cached page bytes (default ~256 MB); LRU-evicts beyond it
  progressive: true,   // paint a low-res page first, then swap to crisp (faster first paint)
  disableAutoFetch: true, // fetch only the byte ranges visible pages need (range-capable servers)
});
```

`src` is a URL string, `ArrayBuffer`/`Uint8Array` of PDF bytes, or a pre-created pdf.js document.
