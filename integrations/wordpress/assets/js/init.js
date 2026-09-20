/**
 * Front-end bootstrap. Finds every .zine-flipbook container and mounts a ZineJS flipbook on it,
 * reading options from the container's data-zine attribute. pdf.js (needed only for PDF books) is
 * loaded once and its worker pointed at the plugin-bundled file, since there is no bundler here to
 * resolve it. See ZINEJS_WP, set by wp_localize_script in the plugin.
 */
(function () {
  'use strict';
  var CFG = window.ZINEJS_WP || {};

  function books() {
    return Array.prototype.slice.call(document.querySelectorAll('.zine-flipbook[data-zine]'));
  }

  function parse(el) {
    try {
      return JSON.parse(el.getAttribute('data-zine') || '{}');
    } catch (e) {
      return {};
    }
  }

  function mount(el, pdfReady) {
    if (el.getAttribute('data-zine-mounted') || !window.ZineJS) return;
    var cfg = parse(el);
    var opts = cfg.zine || {};
    var source;
    if (cfg.pdf) {
      if (!pdfReady) return; // deferred until pdf.js is loaded
      source = new window.ZineJS.PdfSource(cfg.pdf);
    } else if (cfg.images && cfg.images.length) {
      source = new window.ZineJS.ImageSource(cfg.images);
    } else {
      return;
    }
    el.setAttribute('data-zine-mounted', '1');
    opts.source = source;
    try {
      new window.ZineJS.Zine(el, opts);
    } catch (e) {
      if (window.console) console.error('[zinejs] could not create flipbook', e);
    }
  }

  function start() {
    var els = books();
    if (!els.length) return;

    var needsPdf = els.some(function (el) {
      return !!parse(el).pdf;
    });
    if (!needsPdf) {
      els.forEach(function (el) {
        mount(el, false);
      });
      return;
    }

    if (!CFG.pdfjs) {
      if (window.console) console.error('[zinejs] pdf.js URL is not configured');
      return;
    }
    // The UMD PDF source reads globalThis.pdfjsLib, so load pdf.js and expose it before mounting.
    import(CFG.pdfjs)
      .then(function (pdfjsLib) {
        if (CFG.worker && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.worker;
        }
        window.pdfjsLib = pdfjsLib;
        els.forEach(function (el) {
          mount(el, true);
        });
      })
      .catch(function (e) {
        if (window.console) console.error('[zinejs] failed to load pdf.js', e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
