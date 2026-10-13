// npm run terms:review: run the rules-link pipeline (app/src/ui/terms.ts) over every module string, for both audiences
// and both rules editions, and write docs/TERMS_REVIEW.md (the index) and docs/terms-review/<chapter>.md (the rows).
// With --json <file>, also write the rows as JSON.
// Loads the TypeScript through Vite's module runner, the same way the tests do.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runnerImport } from 'vite';

const root = join(import.meta.dirname, '..');
const { module: c } = await runnerImport(join(root, 'scripts/terms-corpus.ts'), { root, configFile: false, logLevel: 'error' });
await c.loadBooks();
const fields = c.corpusFields();
const rows = c.reviewRows(fields);
const files = c.reviewFiles(rows, fields);
mkdirSync(join(root, c.REVIEW_DIR), { recursive: true });
// A chapter whose links are all gone leaves no stale part behind.
for (const f of readdirSync(join(root, c.REVIEW_DIR))) if (!files.has(`${c.REVIEW_DIR}/${f}`)) rmSync(join(root, c.REVIEW_DIR, f));
for (const [path, text] of files) writeFileSync(join(root, path), text);
const j = process.argv.indexOf('--json');
if (j > 0) { const text = new Map(fields.map((f) => [`${f.scene}|${f.entity}|${f.field}`, f.text])); writeFileSync(process.argv[j + 1], JSON.stringify(rows.map((r) => ({ ...r, ftext: text.get(`${r.scene}|${r.entity}|${r.field}`) })))); }
const unreviewed = rows.filter((r) => r.status === 'unreviewed').length;
console.log(`docs/TERMS_REVIEW.md and ${files.size - 1} parts: ${fields.length} fields, ${rows.length} links, ${unreviewed} unreviewed`);
