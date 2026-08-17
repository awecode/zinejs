import { defineConfig, type Plugin } from 'vite';

// The pdf.js worker URL referenced in pdfSource.ts. It must reach the CONSUMER's
// bundler verbatim (see preservePdfWorkerUrl below).
const WORKER_URL_EXPR = "new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href";
const WORKER_PLACEHOLDER = '@@ZINE_PDF_WORKER_URL@@';

// pdf.js requires the worker and the main library to be the SAME version, and
// `pdfjs-dist` is an external runtime dependency (not bundled into our package) —
// so we must NOT emit a worker into `dist/` (that would freeze a build-time copy
// and risk "API version does not match Worker version" against the install the
// consumer resolves). Instead the plugin's
// `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` literal has to pass
// through our build untouched so the CONSUMER's bundler resolves and emits the
// worker from their installed `pdfjs-dist`. Vite's import.meta.url asset pass would
// otherwise inline the ~1.6 MB worker, so we hide the expression behind a placeholder
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
      if (id.includes('pdfSource') && code.includes(WORKER_URL_EXPR)) {
        return { code: code.split(WORKER_URL_EXPR).join(`"${WORKER_PLACEHOLDER}"`), map: null };
      }
      return null;
    },
    generateBundle(options, bundle) {
      // Vite/rolldown may emit the placeholder as '…', "…", or `…` (UMD minify).
      const marker = new RegExp(`(['"\`])${WORKER_PLACEHOLDER}\\1`, 'g');
      // ESM: restore the import.meta.url expression so the consumer's bundler
      // can rewrite it. UMD is a classic <script> — import.meta is a SyntaxError
      // there (and V8 may mis-report it as a private-field error), so throw into
      // the existing catch and require an explicit workerSrc for CDN hosts.
      const isEsm = options.format === 'es' || options.format === 'esm';
      const replacement = isEsm
        ? `(${WORKER_URL_EXPR})`
        : `(() => { throw new Error('PdfSource: pass workerSrc for UMD/CDN'); })()`;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.code.includes(WORKER_PLACEHOLDER)) {
          chunk.code = chunk.code.replace(marker, replacement);
        }
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
