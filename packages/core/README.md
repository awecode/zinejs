# @zinejs/core

Framework-agnostic flipbook engine for the web. Turn a list of images (or a PDF, via [`@zinejs/pdf`](https://www.npmjs.com/package/@zinejs/pdf)) into a page-flip book. Zero dependencies.

Where WebGL2 is available it uses the GPU renderer (page-curl, lighting). Elsewhere it falls back to CSS on its own.

> **Docs, live demos, and guides:** [zinejs.com/docs](https://zinejs.com/docs/) · [examples](https://zinejs.com/examples)

## Install

```bash
npm install @zinejs/core
```

Also ships a **UMD** build at `dist/index.umd.js` (global `ZineJS`) for [CDN / `<script>` hosts](https://zinejs.com/examples/html-cdn). The ESM build code-splits the CSS and WebGL2 renderers (and the toolbar); the UMD build inlines the renderers so a single script is enough.

## Image book

```js
import { Zine, ImageSource } from '@zinejs/core'

new Zine(document.getElementById('book'), {
  source: new ImageSource([
    'page-01.png',
    'page-02.png',
    'page-03.png',
    'page-04.png',
  ]),
})
```

Drag a corner or click near an edge to turn. Double-click, pinch, or Ctrl/Cmd+wheel to zoom.

## PDF book

Install [`@zinejs/pdf`](https://www.npmjs.com/package/@zinejs/pdf) as well:

```js
import { Zine } from '@zinejs/core'
import { PdfSource } from '@zinejs/pdf'

new Zine(document.getElementById('book'), {
  source: new PdfSource('document.pdf'),
})
```

See [PdfSource](https://zinejs.com/docs) for worker setup, `legacy`, and CDN.

## Options and API

Only `source` is required. Common options: `spreadMode`, `curl` (`'cone'` or `'simple'` by name; other curls from `@zinejs/core/curls`), `zoom`, `controls`, `renderer` (`'auto'` prefers GPU). A JSON Schema is at `@zinejs/core/options.schema.json`.

```js
const zine = new Zine(el, {
  source,
  spreadMode: 'cover',
  zoom: { max: 4 },
})

await zine.ready
zine.on('pageChanged', ({ page }) => console.log(page))
zine.flipNext()
zine.flipTo(12)
```

The toolbar loads as a separate chunk, so `controls: false` never downloads it. Full options, methods, events, and curl models: [zinejs.com/docs](https://zinejs.com/docs/) and the [GitHub README](https://github.com/awecode/zinejs#readme).
