import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = resolve(__dirname);

export default defineConfig({
  root: resolve(root, 'app'),
  publicDir: resolve(root, 'app/public'),
  base: './',
  server: { host: true, fs: { allow: [root] } },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1200 },
  resolve: { alias: { '@core': resolve(root, 'app/src/core'), '@manifests': resolve(root, 'manifests'), '@locations': resolve(root, 'locations') } },
  test: {
    root,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
