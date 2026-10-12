// npm run books: download the pinned SRD sources, convert both books and write app/public/books/**.
//   --offline   use only scripts/books/.cache (no network)
//   --check     write nothing; fail if the committed data differs from a fresh build
//   --no-pdf    skip the PDF steps: the fidelity check (pdftotext) and reading table titles (pdftohtml); the
//               committed scripts/books/titles/<book>.json is used instead
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { BOOKS, type BookConfig } from './config.ts';
import { convertBook, normForm, otherProseOf, placeTitles, prepare, type BuiltBook } from './convert.ts';
import { fetchSource, loadSources } from './fetch.ts';
import { parseBlocks } from './md.ts';
import { pdfTitles, type PdfTitle } from './titles.ts';
import { compareSpellLists, pdfSpellLists, type SpellLists } from './spelllists.ts';
import type { Catalog, Source } from '../../app/src/books/types.ts';

/** scripts/books/titles/<book>.json */
export interface TitlesFile { book: string; attribution: string; note: string; titles: PdfTitle[] }
/** scripts/books/pdf/<book>-spell-lists.json */
export interface SpellListsFile { book: string; attribution: string; note: string; lists: SpellLists }
const PDFDATA = join(import.meta.dirname, 'pdf');

/** Write (or with --check, compare) a file of data read from the PDF; it is committed so builds without the PDF agree. */
function keepPdfData(file: string, text: string): void {
  if (check) { if (!existsSync(file) || readFileSync(file, 'utf8') !== text) { console.error(`${relative(ROOT, file)} differs from the PDF`); process.exit(1); } }
  else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
}

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'app', 'public', 'books');
const TITLES = join(import.meta.dirname, 'titles');
const args = new Set(process.argv.slice(2));
const offline = args.has('--offline'), check = args.has('--check'), pdf = !args.has('--no-pdf');

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? listFiles(p) : [p]; });
}

/** Parsed stat blocks and spells against the 5e-bits JSON (an independent conversion). */
function crosscheck(cfg: BookConfig, b: BuiltBook, monsters: string, spells: string): string[] {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const out: string[] = [];
  const M = JSON.parse(readFileSync(monsters, 'utf8')) as { name: string; armor_class: { value: number }[]; hit_points: number; challenge_rating: number; strength: number; dexterity: number; wisdom: number }[];
  const byName = new Map(M.map((m) => [key(m.name), m]));
  let n = 0, same = 0;
  const diffs: string[] = [];
  for (const e of b.entries) {
    if (e.type !== 'monster') continue;
    const m = byName.get(key(e.name));
    if (!m) continue;
    n++;
    const s = e.s as { ac: number; hp: number; cr: string; abilities: { str: number; dex: number; wis: number } };
    const [cn, cd] = s.cr.split('/');
    const crv = cd ? Number(cn) / Number(cd) : Number(cn);
    const ok = s.ac === m.armor_class[0]?.value && s.hp === m.hit_points && Math.abs(crv - m.challenge_rating) < 1e-6
      && s.abilities.str === m.strength && s.abilities.dex === m.dexterity && s.abilities.wis === m.wisdom;
    if (ok) same++; else diffs.push(`${e.name}: ours AC ${s.ac} HP ${s.hp} CR ${s.cr} / 5e-bits AC ${m.armor_class[0]?.value} HP ${m.hit_points} CR ${m.challenge_rating}`);
  }
  out.push(`monsters: ${same}/${n} matched by name agree on AC, HP, CR, Str, Dex, Wis${diffs.length ? `; differ: ${diffs.slice(0, 6).join('; ')}${diffs.length > 6 ? ' …' : ''}` : ''}`);
  const S = JSON.parse(readFileSync(spells, 'utf8')) as { name: string; level: number; school: { name: string }; concentration: boolean; ritual: boolean }[];
  const sp = new Map(S.map((x) => [key(x.name), x]));
  let k = 0, sameS = 0;
  const sd: string[] = [];
  for (const e of b.entries) {
    if (e.type !== 'spell') continue;
    const x = sp.get(key(e.name));
    if (!x) continue;
    k++;
    const s = e.s as { level: number; school: string; concentration: boolean; ritual: boolean };
    if (s.level === x.level && s.school.toLowerCase() === x.school.name.toLowerCase() && s.concentration === x.concentration && s.ritual === x.ritual) sameS++;
    else sd.push(`${e.name}`);
  }
  out.push(`spells: ${sameS}/${k} agree on level, school, concentration and ritual${sd.length ? `; differ: ${sd.slice(0, 8).join(', ')}` : ''}`);
  if (n < 250 || same / n < 0.9 || k < 250 || sameS / k < 0.95) throw new Error(`${cfg.id}: cross-check failed\n  ${out.join('\n  ')}`);
  return out;
}

/** Every spell, monster, condition and glossary name must appear in the official PDF's text. */
function fidelity(b: BuiltBook, pdfFile: string): string {
  let text: string;
  try { text = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', pdfFile, '-'], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch { return 'fidelity: pdftotext not available, skipped'; }
  const norm = (s: string) => normForm(s).replace(/[‐-―−-]/g, '-').replace(/[^a-z0-9]+/g, '');
  const hay = norm(text);
  const want = b.entries.filter((e) => ['spell', 'monster', 'condition', 'rule'].includes(e.type) && e.node);
  const missing = want.filter((e) => !hay.includes(norm(e.name)));
  if (missing.length > want.length * 0.01) throw new Error(`fidelity: ${missing.length} of ${want.length} names not found in the PDF: ${missing.slice(0, 20).map((e) => e.name).join(', ')}`);
  return `fidelity: ${want.length - missing.length}/${want.length} spell, monster, condition and rule names found in the official PDF${missing.length ? ` (not found: ${missing.map((e) => e.name).join(', ')})` : ''}`;
}

async function main(): Promise<void> {
  const sources = loadSources();
  const byId = new Map(sources.map((s) => [s.id, s]));
  const need = (id: string): Source => { const s = byId.get(id); if (!s) throw new Error(`unknown source ${id}`); return s; };
  const out = new Map<string, string>(); // path relative to OUT → contents
  const catalog: Catalog = { books: [] };
  const mds = new Map<string, string>();
  for (const cfg of BOOKS) mds.set(cfg.id, readFileSync(await fetchSource(need(cfg.markdown), offline), 'utf8'));
  for (const cfg of BOOKS) {
    console.log(`${cfg.id} (${cfg.editionLabel})`);
    const md = mds.get(cfg.id)!;
    // Table titles: read from the PDF when it and pdftohtml are at hand, else the committed list.
    let titles: PdfTitle[] = [];
    const titlesFile = join(TITLES, `${cfg.id}.json`);
    if (cfg.tableTitles) {
      let fresh: PdfTitle[] | null = null;
      if (pdf) { try { fresh = pdfTitles(await fetchSource(need(cfg.pdf), offline)); } catch (e) { if (!(offline && /not in/.test(String(e)))) throw e; } }
      if (fresh) {
        // SRD text (table titles and the header cells under them), so it carries the book's attribution like the book.
        const file: TitlesFile = { book: cfg.id, attribution: cfg.attribution, note: 'Table titles read from the official PDF by scripts/books/titles.ts; see docs/BOOKS.md.', titles: fresh };
        const text = JSON.stringify(file, null, 1) + '\n';
        if (check) { if (!existsSync(titlesFile) || readFileSync(titlesFile, 'utf8') !== text) { console.error(`${relative(ROOT, titlesFile)} differs from the PDF`); process.exit(1); } }
        else { mkdirSync(TITLES, { recursive: true }); writeFileSync(titlesFile, text); }
        titles = fresh;
      } else titles = (JSON.parse(readFileSync(titlesFile, 'utf8')) as TitlesFile).titles;
      const probe = placeTitles(parseBlocks(prepare(cfg, md).md), titles);
      console.log(`  table titles: ${probe.placed} restored from the PDF (${titles.length} in the PDF; ${probe.missed.length} with no table in the Markdown${probe.missed.length ? `: ${probe.missed.map((t) => t.title).join(', ')}` : ''})`);
    }
    const prep = prepare(cfg, md);
    if (prep.joined.size) console.log(`  rejoined split words: ${[...prep.joined].map(([w, n]) => `${w}${n > 1 ? ` ×${n}` : ''}`).join(', ')}`);
    for (const p of cfg.patches) console.log(`  patched: ${p.why}`);
    const b = convertBook(cfg, md, sources, titles, { otherProse: otherProseOf(cfg, (o) => mds.get(o.id)!) });
    for (const [p, s] of b.files) out.set(`${cfg.id}/${p}`, s);
    if (cfg.spellListPages) {
      const listsFile = join(PDFDATA, `${cfg.id}-spell-lists.json`);
      let lists: SpellLists | null = null;
      if (pdf) { try { lists = pdfSpellLists(await fetchSource(need(cfg.pdf), offline), cfg.spellListPages); } catch (e) { if (!(offline && /not in/.test(String(e)))) throw e; } }
      if (lists) {
        const file: SpellListsFile = { book: cfg.id, attribution: cfg.attribution, note: `The class spell lists read from the official PDF (pages ${cfg.spellListPages.join('–')}) by scripts/books/spelllists.ts; see docs/BOOKS.md.`, lists };
        keepPdfData(listsFile, JSON.stringify(file, null, 1) + '\n');
      } else lists = (JSON.parse(readFileSync(listsFile, 'utf8')) as SpellListsFile).lists;
      const diffs = compareSpellLists(lists, b.entries.filter((e) => e.type === 'spell').map((e) => ({ name: e.name, classes: (e.s as { classes: string[] }).classes })));
      if (diffs.length) throw new Error(`${cfg.id}: spell lists differ from the PDF:\n  ${diffs.slice(0, 20).join('\n  ')}`);
      const n = Object.values(lists).reduce((a, l) => a + Object.values(l).flat().length, 0);
      console.log(`  spell lists: all ${n} entries of ${Object.keys(lists).length} classes agree with the PDF`);
    }
    const count = (t: string) => b.entries.filter((e) => e.type === t).length;
    console.log(`  ${b.chapters.length} chapters, ${b.index.pages.length} pages, ${b.index.sections.length} sections, ${(b.index.bytes / 1024).toFixed(0)} KB`);
    console.log(`  entries: ${['spell', 'monster', 'item', 'condition', 'rule', 'damage', 'ability', 'skill', 'creature-type', 'feat', 'class', 'feature', 'species', 'background'].map((t) => `${count(t)} ${t}`).join(', ')}`);
    try {
      const [m, s] = await Promise.all([fetchSource(need(cfg.crosscheck.monsters), offline), fetchSource(need(cfg.crosscheck.spells), offline)]);
      for (const l of crosscheck(cfg, b, m, s)) console.log(`  ${l}`);
    } catch (e) { if (offline && /not in/.test(String(e))) console.log('  cross-check skipped (not cached)'); else throw e; }
    if (pdf) {
      try { console.log(`  ${fidelity(b, await fetchSource(need(cfg.pdf), offline))}`); } catch (e) { if (offline && /not in/.test(String(e))) console.log('  fidelity skipped (PDF not cached)'); else throw e; }
    }
    const { id, title, short, edition, editionLabel, version, bytes, files } = b.index;
    catalog.books.push({ id, title, short, edition, editionLabel, version, license: 'CC-BY-4.0', bytes, files });
  }
  out.set('catalog.json', JSON.stringify(catalog) + '\n');

  const existing = new Set(listFiles(OUT).map((f) => relative(OUT, f)));
  if (check) {
    const bad = [...out].filter(([p, s]) => !existing.has(p) || readFileSync(join(OUT, p), 'utf8') !== s).map(([p]) => p);
    const extra = [...existing].filter((p) => !out.has(p));
    if (bad.length || extra.length) { console.error(`books differ from a fresh build: ${[...bad, ...extra].slice(0, 10).join(', ')}`); process.exit(1); }
    console.log(`check: ${out.size} files identical`);
    return;
  }
  for (const p of existing) if (!out.has(p)) rmSync(join(OUT, p));
  for (const [p, s] of out) { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), s); }
  console.log(`wrote ${out.size} files to ${relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
