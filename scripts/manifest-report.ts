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

// Most folios don't OCR; derive printed page = pdf index - offset from the ones that do (mode).
const offsets = new Map<number, number>();
for (const p of pages) if (p.printed != null) offsets.set(p.index - p.printed, (offsets.get(p.index - p.printed) ?? 0) + 1);
const OFFSET = [...offsets].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
for (const p of pages) p.printed = p.index - OFFSET;
// Numbered keys (Death House) only exist in Appendix B.
const appendixB = new Set(pages.filter((p) => p.lines.some((l) => /APPENDIX B/.test(l))).map((p) => p.index));

const norm = (s: string) => s.toUpperCase().replace(/[’']/g, "'").replace(/[^A-Z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Area headings look like "K12. TURRET POST", "E5f. CHAPEL", "A. OLD SVALICH ROAD", "12. MASTER SUITE".
// Sub-letters are small caps, so OCR reads them as any letter/case ("E5r" for E5f): match by family + name.
const HEADING = /^([A-Z](?:[0-9OlI|]{1,3}[A-Za-z]?)?|\d{1,2})\s*[.,]\s+(.{3,60})$/;
const fixKey = (k: string) => k.replace(/^([A-Z])([0-9OlI|]+)/, (_, a, d) => a + (d.replace(/O/g, '0').replace(/[lI|]/g, '1').replace(/^0+(?=\d)/, '')));
const family = (k: string) => k.toUpperCase().match(/^([A-Z]?\d*)/)![1];
interface Hit { key: string; name: string; page: number | null; index: number }
const found = new Map<string, Hit[]>();
const byFamily = new Map<string, Hit[]>();
for (const p of pages)
  for (const l of p.lines) {
    const m = l.match(HEADING);
    if (!m) continue;
    if (/^\d/.test(m[1]) && !appendixB.has(p.index)) continue;
    const key = fixKey(m[1]);
    const hit = { key, name: m[2].replace(/[_\s]+$/, ''), page: p.printed, index: p.index };
    for (const [map, k] of [[found, key.toUpperCase()], [byFamily, family(key)]] as const) { const a = map.get(k) ?? []; a.push(hit); map.set(k, a); }
  }
// Crypts inside K84: "CRYPT 12" headings.
for (const p of pages) for (const l of p.lines) {
  const m = l.match(/^CRYPT\s+(\d{1,2})\b[.,]?\s*(.*)$/i);
  if (m) { const k = `K84-${m[1]}`; const a = found.get(k) ?? []; a.push({ key: k, name: `Crypt ${m[1]}`, page: p.printed, index: p.index }); found.set(k, a); }
}
function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
// Small caps OCR as mixed junk ("SouUTH", "Kinc's"): compare case-folded with an edit-distance allowance.
const nameMatch = (h: Hit, name: string) => {
  const a = norm(h.name).replace(/[^A-Z ]/g, ''), b = norm(name).replace(/[^A-Z ]/g, '');
  if (a.startsWith(b) || b.startsWith(a) || (a.length > 6 && b.includes(a.slice(0, 8)))) return true;
  const a2 = a.slice(0, b.length + 2);
  return lev(a2, b) <= Math.max(1, Math.floor(b.length * 0.2));
};

const out: string[] = ['# Manifest vs OCR report', '', `OCR pages: ${pages.length}; headings found: ${found.size}`, ''];
let missing = 0, renamed = 0, ok = 0;
const manifestKeys = new Set<string>();
const pageOf = new Map<string, number | null>();
for (const l of loc.locations) {
  const rows: string[] = [];
  for (const a of l.areas) {
    if (/^\d+$/.test(a.key) && l.id !== 'death-house') continue;
    manifestKeys.add(a.key);
    const hits = found.get(a.key.toUpperCase()) ?? [];
    // Fallbacks for OCR-mangled keys: same family (E5r for E5f), then same letter + name (N20 for N2o).
    const exact = hits.find((h) => nameMatch(h, a.name)) ?? (byFamily.get(family(a.key)) ?? []).find((h) => nameMatch(h, a.name))
      ?? (/^[A-Z]\d/.test(a.key) ? [...found.values()].flat().find((h) => h.key[0] === a.key[0] && h.key[1] === a.key[1] && nameMatch(h, a.name)) : undefined);
    if (exact) { ok++; const note = exact.key !== a.key ? `OCR read key as "${exact.key}"` : ''; rows.push(`| ${a.key} | ${a.name} | ok | p.${exact.page ?? '?'} (pdf ${exact.index}) ${note} |`); pageOf.set(`${l.id}/${a.key}`, exact.page ?? null); continue; }
    if (hits.length) { renamed++; rows.push(`| ${a.key} | ${a.name} | **FLAG name** | book: "${hits[0].name}" (p.${hits[0].page ?? '?'}, pdf ${hits[0].index}) |`); }
    else { missing++; rows.push(`| ${a.key} | ${a.name} | **FLAG not found** | |`); }
  }
  if (rows.length) out.push(`## ${l.id} — ${l.name}`, '', '| key | manifest | status | note |', '|---|---|---|---|', ...rows, '');
}
const familiesMatched = new Set([...manifestKeys].map(family));
const extra = [...found.keys()].filter((k) => /^[A-Z]\d/.test(k) && !manifestKeys.has(k) && !familiesMatched.has(family(k))).sort();
out.push('## Keys in the book but not in the manifest', '', extra.length ? extra.map((k) => `- ${k}: "${found.get(k)![0].name}" (p.${found.get(k)![0].page ?? '?'})`).join('\n') : '_none_', '');

const text = pages.map((p) => p.lines.join(' ')).join('\n').toUpperCase();
const absent = chars.characters.filter((c: { name: string; kind: string }) => c.kind !== 'pc' && c.kind !== 'token' && c.kind !== 'generic' && !text.includes(c.name.toUpperCase().replace(/ \(.*\)$/, '')));
out.push('## Characters whose names were not found in the OCR (verify spelling)', '', absent.map((c: { id: string; name: string }) => `- ${c.id}: ${c.name}`).join('\n') || '_none_', '');
const refs = [...new Set(text.match(/SEE APPENDIX D/g) ?? [])].length;
out.push(`Appendix D references seen: ${refs ? 'yes' : 'no'}`, '');

writeFileSync('reference/manifest-report.md', out.join('\n'));
writeFileSync('reference/pages.json', JSON.stringify(Object.fromEntries(pageOf), null, 1));
console.log(`printed page = pdf page - ${OFFSET} · areas ok ${ok} · name flags ${renamed} · not found ${missing} · book-only keys ${extra.length} · characters to verify ${absent.length}`);
console.log('full report: reference/manifest-report.md');
