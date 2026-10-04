import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = resolve(__dirname);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  root: resolve(root, 'app'),
  publicDir: resolve(root, 'app/public'),
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // Help shows the running version
  server: { host: true, fs: { allow: [root] } },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1200 },
  resolve: { alias: { '@core': resolve(root, 'app/src/core'), '@manifests': resolve(root, 'manifests'), '@locations': resolve(root, 'locations') } },
  test: {
    root,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
