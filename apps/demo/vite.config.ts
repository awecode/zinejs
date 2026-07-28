import { defineConfig } from 'vite';

// Alias the package to its source so the demo hot-reloads on core edits
// (no build step needed during development).
export default defineConfig({
  resolve: {
    alias: {
      '@zinejs/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
    },
  },
});
