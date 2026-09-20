/**
 * Front-end bootstrap. Finds every .zine-flipbook container and mounts a ZineJS flipbook on it,
 * reading options from the container's data-zine attribute.
 *
 * Two dependencies load on demand, once, and only when a book needs them: pdf.js (PDF books) and
 * the curls module (the non-bundled curl styles roll/leaf/flick/silk, which must be passed to the
 * engine as model objects rather than by name). See ZINEJS_WP, set by wp_localize_script.
 */
(function () {
  'use strict';
  var CFG = window.ZINEJS_WP || {};
  var IMPORTABLE_CURLS = ['roll', 'leaf', 'flick', 'silk'];
  var pdfjsPromise = null;
  var curlsPromise = null;

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

  // pdf.js: load once and expose as the global the UMD PDF source reads.
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(CFG.pdfjs).then(function (m) {
        if (CFG.worker && m.GlobalWorkerOptions) m.GlobalWorkerOptions.workerSrc = CFG.worker;
        window.pdfjsLib = m;
        return m;
      });
    }
    return pdfjsPromise;
  }

  // The curls module (roll/leaf/flick/silk models): load once.
  function loadCurls() {
    if (!curlsPromise) curlsPromise = import(CFG.curls);
    return curlsPromise;
  }

  function mount(el) {
    if (el.getAttribute('data-zine-mounted') || !window.ZineJS) return;
    var cfg = parse(el);
    var opts = cfg.zine || {};

    var needsPdf = !!cfg.pdf;
    if (needsPdf && !CFG.pdfjs) {
      if (window.console) console.error('[zinejs] pdf.js URL is not configured');
      return;
    }
    var curlName = typeof opts.curl === 'string' ? opts.curl : null;
    var needsCurls = curlName && IMPORTABLE_CURLS.indexOf(curlName) !== -1 && CFG.curls;

    el.setAttribute('data-zine-mounted', '1');

    Promise.all([
      needsPdf ? loadPdfjs() : Promise.resolve(),
      needsCurls ? loadCurls() : Promise.resolve(null),
    ])
      .then(function (res) {
        var curlsMod = res[1];
        // Swap the curl name for the imported model, or drop it (falls back to the default) if the
        // module or export is missing, so a bad curl never blocks the book.
        if (needsCurls) {
          if (curlsMod && curlsMod[curlName]) opts.curl = curlsMod[curlName];
          else delete opts.curl;
        }
        var source = cfg.pdf
          ? new window.ZineJS.PdfSource(cfg.pdf)
          : cfg.images && cfg.images.length
            ? new window.ZineJS.ImageSource(cfg.images)
            : null;
        if (!source) return;
        opts.source = source;
        try {
          new window.ZineJS.Zine(el, opts);
        } catch (e) {
          if (window.console) console.error('[zinejs] could not create flipbook', e);
        }
      })
      .catch(function (e) {
        if (window.console) console.error('[zinejs] failed to load a dependency', e);
      });
  }

  function start() {
    books().forEach(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
