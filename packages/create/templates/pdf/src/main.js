import { Zine } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

// A flipbook from a PDF. Replace public/sample.pdf with your own document.
// Under a bundler (Vite here) the pdf.js worker is resolved for you.
new Zine(document.getElementById('book'), {
  source: new PdfSource('/sample.pdf'),
});
