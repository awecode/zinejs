import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

const book = document.getElementById('book')!;

const zine = new Zine(book, {
  source: new PdfSource('pdf/sample.pdf'),
});

// Flip by dragging a page corner (or clicking near an edge); zoom with
// double-click / Ctrl+wheel / pinch — all built in.
//
// Prev/next/zoom UI controls will be baked into zinejs later. Until then you can
// drive it via the instance:
//   zine.flipNext();  zine.flipPrev();  zine.setZoom(2);
//   zine.on('pageChanged', ({ page }) => { ... });
