import { Zine, ImageSource, type Source } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

// E2E fixture (not the human-facing showcase): exposes controls, labels, and the
// URL knobs the Playwright specs drive. The clean usage examples are index.html
// (images) and pdf.html.
const params = new URLSearchParams(location.search);

function makeSource(): Source {
  if (params.has('pdf')) {
    return new PdfSource('pdf/sample.pdf');
  }
  const pages = Array.from(
    { length: 20 },
    (_, i) => `sample-images/page-${String(i + 1).padStart(2, '0')}.png`,
  );
  return new ImageSource(pages);
}

const book = document.getElementById('book')!;
const zine = new Zine(book, {
  source: makeSource(),
  direction: params.get('direction') === 'rtl' ? 'rtl' : 'ltr',
  spreadMode: params.has('cover') ? 'cover' : 'double',
  startPage: Number(params.get('start') ?? 0),
  // The gesture specs click and drag raw coordinates across the book, so the toolbar is off
  // unless a test asks for it (`?controls=1`) and would otherwise sit under those hit points.
  controls: params.has('controls'),
});

const pageLabel = document.getElementById('page')!;
const zoomLabel = document.getElementById('zoom')!;
function refresh(): void {
  pageLabel.textContent = `page ${zine.getPage() + 1} / ${zine.getPageCount()}`;
  zoomLabel.textContent = `${zine.getZoom().toFixed(1)}×`;
}
zine.on('ready', refresh);
zine.on('pageChanged', refresh);
zine.on('zoomChanged', refresh);

document.getElementById('prev')!.addEventListener('click', () => zine.flipPrev());
document.getElementById('next')!.addEventListener('click', () => zine.flipNext());
document.getElementById('zoomout')!.addEventListener('click', () => zine.setZoom(zine.getZoom() / 1.5));
document.getElementById('zoomin')!.addEventListener('click', () => zine.setZoom(zine.getZoom() * 1.5));
document.getElementById('zoomreset')!.addEventListener('click', () => zine.resetZoom());
