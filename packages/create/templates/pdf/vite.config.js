import { defineConfig } from 'vite';

// @zinejs/pdf loads the pdf.js worker through a `?url` import that Vite's dependency
// pre-bundler cannot follow. Excluding it lets Vite's normal pipeline resolve the
// worker, so PDF books work in dev and build. See https://zinejs.com/docs/ (worker notes).
export default defineConfig({
  optimizeDeps: {
    exclude: ['@zinejs/pdf'],
  },
});
