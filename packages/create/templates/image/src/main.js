import { Zine, ImageSource } from '@zinejs/core';

// A flipbook from a list of image URLs. Drop your own pages in public/pages/.
new Zine(document.getElementById('book'), {
  source: new ImageSource([
    '/pages/page-1.png',
    '/pages/page-2.png',
    '/pages/page-3.png',
    '/pages/page-4.png',
  ]),
});
