import { defineConfig } from 'vite';

const root = (p: string) => new URL(p, import.meta.url).pathname;

// Alias the packages to their source so the demo hot-reloads on edits (no build step).
export default defineConfig({
  resolve: {
    alias: {
      '@zinejs/core': root('../../packages/core/src/index.ts'),
      '@zinejs/pdf': root('../../packages/pdf/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: root('index.html'),
        imageWebgl: root('image-webgl.html'),
        pdfWebgl: root('pdf-webgl.html'),
        imageCss: root('image-css.html'),
        pdfCss: root('pdf-css.html'),
        fixture: root('fixture.html'),
      },
    },
  },
});
