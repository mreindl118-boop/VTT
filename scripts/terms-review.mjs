// npm run terms:review: run the rules-link pipeline (app/src/ui/terms.ts) over every module string, for both audiences
// and both rules editions, and write docs/TERMS_REVIEW.md. With --json <file>, also write the rows as JSON.
// Loads the TypeScript through Vite's module runner, the same way the tests do.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runnerImport } from 'vite';

const root = join(import.meta.dirname, '..');
const { module: c } = await runnerImport(join(root, 'scripts/terms-corpus.ts'), { root, configFile: false, logLevel: 'error' });
await c.loadBooks();
const fields = c.corpusFields();
const rows = c.reviewRows(fields);
writeFileSync(join(root, 'docs/TERMS_REVIEW.md'), c.reviewMarkdown(rows, fields));
const j = process.argv.indexOf('--json');
if (j > 0) { const text = new Map(fields.map((f) => [`${f.scene}|${f.entity}|${f.field}`, f.text])); writeFileSync(process.argv[j + 1], JSON.stringify(rows.map((r) => ({ ...r, ftext: text.get(`${r.scene}|${r.entity}|${r.field}`) })))); }
const unreviewed = rows.filter((r) => r.status === 'unreviewed').length;
console.log(`docs/TERMS_REVIEW.md: ${fields.length} fields, ${rows.length} links, ${unreviewed} unreviewed`);
