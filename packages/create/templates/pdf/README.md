# zinejs flipbook (PDF book)

A flipbook built from a PDF, powered by [zinejs](https://zinejs.com/docs/) and
[@zinejs/pdf](https://www.npmjs.com/package/@zinejs/pdf).

## Develop

```bash
npm install
npm run dev
```

## Your document

Replace `public/sample.pdf` with your own and update the path in `src/main.js`.
Under a bundler the pdf.js worker is resolved automatically; see the
[worker notes](https://zinejs.com/docs/) for CDN / offline setups. Drag a corner
or click near an edge to turn; pinch or Ctrl/Cmd+wheel to zoom.

`vite.config.js` excludes `@zinejs/pdf` from dependency pre-bundling so Vite can
resolve the pdf.js worker; keep it when you add your own config.

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build
```

Docs and options: https://zinejs.com/docs/
