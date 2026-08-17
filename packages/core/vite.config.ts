import { defineConfig } from 'vite';

/**
 * Built in two passes because Vite rejects multiple entries alongside UMD.
 *
 * ESM ships an extra `curls` entry so a caller can import one curl model and leave the rest out
 * of their bundle. UMD is a single self-contained script that cannot express that, so it keeps
 * the one entry and carries every curl, as it already does for the renderers and controls.
 *
 * `vite build` runs the ESM pass; `UMD=1 vite build` the UMD one. See package.json's build script.
 */
const umd = process.env.UMD === '1';

export default defineConfig({
    build: {
        // The UMD pass must not wipe the ESM output written moments earlier.
        emptyOutDir: !umd,
        lib: umd
            ? {
                  entry: 'src/index.ts',
                  name: 'ZineJS',
                  formats: ['umd'],
                  fileName: () => 'index.umd.js',
              }
            : {
                  entry: { index: 'src/index.ts', curls: 'src/geometry/curls/index.ts' },
                  formats: ['es'],
                  fileName: (_format, name) => `${name}.js`,
              },
        sourcemap: true,
    },
});
