import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Books write their page into the URL, and every file in a run shares one window; the setup
    // clears that between tests so one book cannot decide where the next one opens.
    setupFiles: ['./vitest.setup.ts'],
  },
});
