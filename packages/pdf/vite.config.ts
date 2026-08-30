import { defineConfig, type Plugin } from 'vite';

/**
 * Worker URL expressions must reach the CONSUMER's bundler verbatim.
 *
 * If Vite resolved them during our library build, we would emit a frozen worker into
 * `dist/` and risk "API version does not match Worker version" against the consumer's
 * `pdfjs-dist`. Hide each expression behind a placeholder before Vite's asset pass, then
 * restore it in the ESM bundle:
 *
 * - `await import(/* webpackIgnore: true *\/ 'pdfjs-dist/…/pdf.worker.min.mjs?url')` — Vite/Nuxt
 *   (`webpackIgnore` skips webpack's orphan chunk; Vite ignores the comment)
 * - `new URL('pdfjs-dist/…/pdf.worker.min.mjs', import.meta.url).href` — webpack 5 / rspack
 *
 * UMD still requires an explicit `workerSrc` (no import.meta / ?url there).
 */
const WORKER_SPEC = 'pdfjs-dist/(?:legacy/)?build/pdf\\.worker\\.min\\.mjs';

// Optional webpack magic comment between `import(` and the specifier string.
const WEBPACK_IGNORE =
  '(?:\\/\\*\\s*webpackIgnore\\s*:\\s*true\\s*\\*\\/\\s*)?';

const WORKER_URL_IMPORT_RE = new RegExp(
  `await import\\(\\s*${WEBPACK_IGNORE}(['"\`])(${WORKER_SPEC}\\?url)\\1\\s*\\)`,
  'g',
);
const WORKER_NEW_URL_RE = new RegExp(
  `new URL\\((['"\`])(${WORKER_SPEC})\\1,\\s*import\\.meta\\.url\\)\\.href`,
  'g',
);

const importPlaceholder = (spec: string): string => `@@ZINE_PDF_WORKER_IMPORT:${spec}@@`;
const newUrlPlaceholder = (spec: string): string => `@@ZINE_PDF_WORKER_NEWURL:${spec}@@`;

const PLACEHOLDER_IMPORT_CALL_RE = new RegExp(
  `await import\\((['"\`])@@ZINE_PDF_WORKER_IMPORT:(${WORKER_SPEC}\\?url)@@\\1\\)`,
  'g',
);
const PLACEHOLDER_NEW_URL_RE = new RegExp(
  `(['"\`])@@ZINE_PDF_WORKER_NEWURL:(${WORKER_SPEC})@@\\1`,
  'g',
);

function preservePdfWorkerUrls(): Plugin {
  return {
    name: 'zine:preserve-pdf-worker-urls',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('pdfSource')) return null;
      WORKER_URL_IMPORT_RE.lastIndex = 0;
      WORKER_NEW_URL_RE.lastIndex = 0;
      if (!WORKER_URL_IMPORT_RE.test(code) && !WORKER_NEW_URL_RE.test(code)) return null;
      WORKER_URL_IMPORT_RE.lastIndex = 0;
      WORKER_NEW_URL_RE.lastIndex = 0;
      let next = code.replace(
        WORKER_URL_IMPORT_RE,
        (_m, _q, spec) => `await import("${importPlaceholder(spec)}")`,
      );
      next = next.replace(
        WORKER_NEW_URL_RE,
        (_m, _q, spec) => `"${newUrlPlaceholder(spec)}"`,
      );
      return { code: next, map: null };
    },
    generateBundle(options, bundle) {
      const isEsm = options.format === 'es' || options.format === 'esm';
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        if (
          !chunk.code.includes('@@ZINE_PDF_WORKER_IMPORT:') &&
          !chunk.code.includes('@@ZINE_PDF_WORKER_NEWURL:')
        ) {
          continue;
        }
        chunk.code = chunk.code.replace(PLACEHOLDER_IMPORT_CALL_RE, (_m, _q, spec) =>
          isEsm
            ? `await import(/* webpackIgnore: true */ '${spec}')`
            : `await Promise.reject(new Error('PdfSource: pass workerSrc for UMD/CDN'))`,
        );
        chunk.code = chunk.code.replace(PLACEHOLDER_NEW_URL_RE, (_m, _q, spec) =>
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
  plugins: [preservePdfWorkerUrls()],
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
      // Sibling worker probe still reads `import.meta.url` (concatenated path, not
      // placeholderable). UMD rewrites that to `{}.url`; we guard at runtime. Suppress
      // only this known-noise warning so a future real misuse still surfaces.
      onwarn(warning, warn) {
        if (warning.code === 'EMPTY_IMPORT_META') return;
        warn(warning);
      },
      external: (id) =>
        id === 'pdfjs-dist' ||
        id.startsWith('pdfjs-dist/') ||
        id.includes('@@ZINE_PDF_WORKER_'),
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
