import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { newestEntry } from './scripts/changelog-entry.ts';

const root = resolve(__dirname);
// The release number Help shows, read from package.json at build time.
const version = (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }).version;
// The newest changelog entry, for the "What's new" card shown once after each update (scripts/changelog-entry.ts).
const whatsNew = newestEntry(readFileSync(resolve(root, 'docs/CHANGELOG.md'), 'utf8')) ?? { version, title: '', date: '', body: '' };

export default defineConfig({
  root: resolve(root, 'app'),
  publicDir: resolve(root, 'app/public'),
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version), __WHATS_NEW__: JSON.stringify(whatsNew) },
  server: { host: true, fs: { allow: [root] } },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1200 },
  resolve: { alias: { '@core': resolve(root, 'app/src/core'), '@manifests': resolve(root, 'manifests'), '@locations': resolve(root, 'locations') } },
  test: {
    root,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
