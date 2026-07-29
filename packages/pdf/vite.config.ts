import { defineConfig } from 'vite';

// pdf.js is a peer dependency, dynamically imported at runtime — keep it out of
// the plugin bundle (the consumer provides it). ESM-only for now; a UMD build is
// a later slice.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['pdfjs-dist'],
    },
  },
});
