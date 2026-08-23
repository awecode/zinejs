import { defineConfig, type Plugin } from 'vite';

// The pdf.js worker URL expressions in pdfSource.ts, one per build it can load: the legacy worker
// (the default) and the modern one. Each must reach the CONSUMER's bundler verbatim (see
// preservePdfWorkerUrl below). Matched by regex rather than a fixed string so both branches are
// covered and a future path change fails loudly (as a bundled worker) rather than silently.
const WORKER_URL_RE =
  /new URL\((['"`])(pdfjs-dist\/(?:legacy\/)?build\/pdf\.worker\.min\.mjs)\1, import\.meta\.url\)\.href/g;
// The placeholder carries the matched specifier so generateBundle restores the exact expression.
const workerPlaceholder = (spec: string): string => `@@ZINE_PDF_WORKER:${spec}@@`;
// Vite/rolldown may re-quote the placeholder as '…', "…", or `…` (UMD minify); capture the specifier.
const PLACEHOLDER_RE =
  /(['"`])@@ZINE_PDF_WORKER:(pdfjs-dist\/(?:legacy\/)?build\/pdf\.worker\.min\.mjs)@@\1/g;

// pdf.js requires the worker and the main library to be the SAME version, and
// `pdfjs-dist` is an external runtime dependency (not bundled into our package) —
// so we must NOT emit a worker into `dist/` (that would freeze a build-time copy
// and risk "API version does not match Worker version" against the install the
// consumer resolves). Instead each
// `new URL('pdfjs-dist/…/pdf.worker.min.mjs', import.meta.url)` literal has to pass
// through our build untouched so the CONSUMER's bundler resolves and emits the
// worker from their installed `pdfjs-dist`. Vite's import.meta.url asset pass would
// otherwise inline the ~1.6 MB worker, so we hide each expression behind a placeholder
// before that pass and restore it verbatim into the final bundle.
function preservePdfWorkerUrl(): Plugin {
  return {
    name: 'zine:preserve-pdf-worker-url',
    // Build only: the transform's placeholder is undone in generateBundle, which
    // doesn't run under vitest/dev — so applying it there would leave the placeholder
    // in the live module. Under vitest the real `new URL(...)` literal runs as-is.
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('pdfSource')) return null;
      WORKER_URL_RE.lastIndex = 0;
      if (!WORKER_URL_RE.test(code)) return null;
      WORKER_URL_RE.lastIndex = 0;
      return {
        code: code.replace(WORKER_URL_RE, (_m, _q, spec) => `"${workerPlaceholder(spec)}"`),
        map: null,
      };
    },
    generateBundle(options, bundle) {
      // ESM: restore the import.meta.url expression so the consumer's bundler
      // can rewrite it. UMD is a classic <script> — import.meta is a SyntaxError
      // there (and V8 may mis-report it as a private-field error), so throw into
      // the existing catch and require an explicit workerSrc for CDN hosts.
      const isEsm = options.format === 'es' || options.format === 'esm';
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code.includes('@@ZINE_PDF_WORKER:')) continue;
        chunk.code = chunk.code.replace(PLACEHOLDER_RE, (_m, _q, spec) =>
          isEsm
            ? `(new URL('${spec}', import.meta.url).href)`
            : `(() => { throw new Error('PdfSource: pass workerSrc for UMD/CDN'); })()`,
        );
      }
    },
  };
}

// Keep pdf.js (and its worker) out of our published bundle — the consumer's
// install resolves it at app-build time (ESM) or via a global (UMD / CDN).
export default defineConfig({
  plugins: [preservePdfWorkerUrl()],
  build: {
    lib: {
      entry: 'src/index.ts',
      // Same global as @zinejs/core so CDN scripts can do ZineJS.PdfSource.
      // `extend: true` merges into an existing ZineJS rather than replacing it.
      name: 'ZineJS',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.js'),
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) => id === 'pdfjs-dist' || id.startsWith('pdfjs-dist/'),
      output: {
        // UMD: expect pdf.js from a prior <script> as `pdfjsLib` (pdf.js's UMD name).
        // ESM still uses the dynamic import; loadPdfjs() also accepts the global.
        globals: {
          'pdfjs-dist': 'pdfjsLib',
        },
        extend: true,
      },
    },
  },
});
