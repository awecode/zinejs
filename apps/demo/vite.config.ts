import { defineConfig } from 'vite';

// Alias the packages to their source so the demo hot-reloads on edits (no build step).
export default defineConfig({
  resolve: {
    alias: {
      '@zinejs/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
      '@zinejs/pdf': new URL('../../packages/pdf/src/index.ts', import.meta.url).pathname,
    },
  },
});

