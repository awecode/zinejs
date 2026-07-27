import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'ZineJS',
            formats: ['es', 'umd'],
            fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.cjs'),
        },
        sourcemap: true,
    },
});