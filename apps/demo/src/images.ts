import { Zine, ImageSource } from '@zinejs/core';

const book = document.getElementById('book')!;

const zine = new Zine(book, {
  source: new ImageSource([
    'sample-images/page-01.png',
    'sample-images/page-02.png',
    'sample-images/page-03.png',
    'sample-images/page-04.png',
    'sample-images/page-05.png',
    'sample-images/page-06.png',
    'sample-images/page-07.png',
    'sample-images/page-08.png',
    'sample-images/page-09.png',
    'sample-images/page-10.png',
    'sample-images/page-11.png',
    'sample-images/page-12.png',
    'sample-images/page-13.png',
    'sample-images/page-14.png',
    'sample-images/page-15.png',
    'sample-images/page-16.png',
    'sample-images/page-17.png',
    'sample-images/page-18.png',
    'sample-images/page-19.png',
    'sample-images/page-20.png',
  ]),
});

// Flip by dragging a page corner (or clicking near an edge); zoom with
// double-click / Ctrl+wheel / pinch — all built in.
//
// Prev/next/zoom UI controls will be baked into zinejs later. Until then you can
// drive it via the instance:
//   zine.flipNext();  zine.flipPrev();  zine.setZoom(2);
//   zine.on('pageChanged', ({ page }) => { ... });
