import { Zine, ImageSource } from '@zinejs/core';

// Dev/verification page for the WebGL2 renderer (Phase 2, in progress). Opts in
// explicitly via `renderer: 'webgl2'`; the showcases (index.html / pdf.html) stay
// on the default CSS renderer.
const pages = Array.from(
  { length: 20 },
  (_, i) => `sample-images/page-${String(i + 1).padStart(2, '0')}.png`,
);

const book = document.getElementById('book')!;

new Zine(book, {
  source: new ImageSource(pages),
  renderer: 'webgl2',
});
