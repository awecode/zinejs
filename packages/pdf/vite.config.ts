import { defineConfig, type Plugin } from 'vite';

/**
 * `?url` imports of the pdf.js worker must reach the CONSUMER's bundler verbatim.
 * If Vite resolved them during our library build, we would emit a frozen worker into
 * `dist/` and risk "API version does not match Worker version" against the consumer's
 * `pdfjs-dist`. Hide each import behind a placeholder before Vite's asset pass, then
 * restore the exact dynamic import in the ESM bundle. UMD still requires an explicit
 * `workerSrc` (no import.meta / ?url there).
 */
const WORKER_URL_IMPORT_RE =
  /await import\((['"`])(pdfjs-dist\/(?:legacy\/)?build\/pdf\.worker\.min\.mjs\?url)\1\)/g;
const workerPlaceholder = (spec: string): string => `@@ZINE_PDF_WORKER_URL:${spec}@@`;
// Match the whole `await import("@@…@@")` so restore does not nest another import().
const PLACEHOLDER_CALL_RE =
  /await import\((['"`])@@ZINE_PDF_WORKER_URL:(pdfjs-dist\/(?:legacy\/)?build\/pdf\.worker\.min\.mjs\?url)@@\1\)/g;

function preservePdfWorkerUrlImport(): Plugin {
  return {
    name: 'zine:preserve-pdf-worker-url-import',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('pdfSource')) return null;
      WORKER_URL_IMPORT_RE.lastIndex = 0;
      if (!WORKER_URL_IMPORT_RE.test(code)) return null;
      WORKER_URL_IMPORT_RE.lastIndex = 0;
      return {
        code: code.replace(
          WORKER_URL_IMPORT_RE,
          (_m, _q, spec) => `await import("${workerPlaceholder(spec)}")`,
        ),
        map: null,
      };
    },
    generateBundle(options, bundle) {
      const isEsm = options.format === 'es' || options.format === 'esm';
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code.includes('@@ZINE_PDF_WORKER_URL:')) continue;
        chunk.code = chunk.code.replace(PLACEHOLDER_CALL_RE, (_m, _q, spec) =>
          isEsm
            ? `await import('${spec}')`
            : `await Promise.reject(new Error('PdfSource: pass workerSrc for UMD/CDN'))`,
        );
      }
    },
  };
}

// Keep pdf.js (and its worker) out of our published bundle — the consumer's
// install resolves it at app-build time (ESM) or via a global (UMD / CDN).
export default defineConfig({
  plugins: [preservePdfWorkerUrlImport()],
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
      external: (id) =>
        id === 'pdfjs-dist' ||
        id.startsWith('pdfjs-dist/') ||
        id.includes('@@ZINE_PDF_WORKER_URL:'),
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
