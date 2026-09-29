// Cross-check manifests/*.json against the OCR'd book. Prints mismatches to FLAG; never renames anything.
// Usage: node --experimental-strip-types scripts/manifest-report.ts [ocrDir]
// Writes reference/manifest-report.md (gitignored). Only keys, names and page numbers are compared.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ocrDir = process.argv[2] ?? 'reference/ocr';
if (!existsSync(ocrDir)) { console.error(`no OCR at ${ocrDir}; run npm run ocr first`); process.exit(1); }
const loc = JSON.parse(readFileSync('manifests/locations.json', 'utf8'));
const chars = JSON.parse(readFileSync('manifests/characters.json', 'utf8'));

interface Page { index: number; printed: number | null; lines: string[] }
const pages: Page[] = readdirSync(ocrDir).filter((f) => /^page-\d+\.txt$/.test(f)).sort().map((f) => {
  const lines = readFileSync(join(ocrDir, f), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  // Printed folio: a bare number within the first/last 3 lines.
  const edge = [...lines.slice(0, 3), ...lines.slice(-3)];
  const folio = edge.map((l) => l.match(/^(\d{1,3})$/)?.[1] ?? l.match(/^(\d{1,3})\s*\|/)?.[1] ?? l.match(/\|\s*(\d{1,3})$/)?.[1]).find(Boolean);
  return { index: Number(f.match(/\d+/)![0]), printed: folio ? Number(folio) : null, lines };
});

const norm = (s: string) => s.toUpperCase().replace(/[’']/g, "'").replace(/[^A-Z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Area headings look like "K12. TURRET POST" or "E5f. Chapel"; tolerate OCR noise (l/1, O/0) in the key.
const HEADING = /^([A-Z]\d{1,2}[a-z]?|\d{1,2})\s*[.,]\s+(.{3,60})$/;
const found = new Map<string, { name: string; page: number | null; index: number }[]>();
for (const p of pages)
  for (const l of p.lines) {
    const m = l.match(HEADING);
    if (!m) continue;
    const key = m[1].replace(/^([A-Z])[lI]/, '$11').replace(/^([A-Z]\d)O/, '$10');
    const arr = found.get(key) ?? [];
    arr.push({ name: m[2], page: p.printed, index: p.index });
    found.set(key, arr);
  }

const out: string[] = ['# Manifest vs OCR report', '', `OCR pages: ${pages.length}; headings found: ${found.size}`, ''];
let missing = 0, renamed = 0, ok = 0;
const manifestKeys = new Set<string>();
for (const l of loc.locations) {
  const rows: string[] = [];
  for (const a of l.areas) {
    if (/^\d+$/.test(a.key) && l.id !== 'death-house') continue;
    manifestKeys.add(a.key);
    const hits = found.get(a.key) ?? [];
    const exact = hits.find((h) => norm(h.name).startsWith(norm(a.name)) || norm(a.name).startsWith(norm(h.name)));
    if (exact) { ok++; if (a.page == null && exact.page) rows.push(`| ${a.key} | ${a.name} | ok | page → ${exact.page} |`); continue; }
    if (hits.length) { renamed++; rows.push(`| ${a.key} | ${a.name} | **FLAG name** | book: "${hits[0].name}" (p.${hits[0].page ?? '?'}, pdf ${hits[0].index}) |`); }
    else { missing++; rows.push(`| ${a.key} | ${a.name} | **FLAG not found** | |`); }
  }
  if (rows.length) out.push(`## ${l.id} — ${l.name}`, '', '| key | manifest | status | note |', '|---|---|---|---|', ...rows, '');
}
const extra = [...found.keys()].filter((k) => /^[A-Z]\d/.test(k) && !manifestKeys.has(k)).sort();
out.push('## Keys in the book but not in the manifest', '', extra.length ? extra.map((k) => `- ${k}: "${found.get(k)![0].name}" (p.${found.get(k)![0].page ?? '?'})`).join('\n') : '_none_', '');

const text = pages.map((p) => p.lines.join(' ')).join('\n').toUpperCase();
const absent = chars.characters.filter((c: { name: string; kind: string }) => c.kind !== 'pc' && c.kind !== 'token' && c.kind !== 'generic' && !text.includes(c.name.toUpperCase().replace(/ \(.*\)$/, '')));
out.push('## Characters whose names were not found in the OCR (verify spelling)', '', absent.map((c: { id: string; name: string }) => `- ${c.id}: ${c.name}`).join('\n') || '_none_', '');
const refs = [...new Set(text.match(/SEE APPENDIX D/g) ?? [])].length;
out.push(`Appendix D references seen: ${refs ? 'yes' : 'no'}`, '');

writeFileSync('reference/manifest-report.md', out.join('\n'));
console.log(`areas ok ${ok} · name flags ${renamed} · not found ${missing} · book-only keys ${extra.length} · characters to verify ${absent.length}`);
console.log('full report: reference/manifest-report.md');
