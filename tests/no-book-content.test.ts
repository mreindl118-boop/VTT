// Guard: the repo is public. The book, its scans, OCR text and page images must never be committed.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTION, CHANGES, DISCLAIMER } from '../app/src/books/attribution';

// The one exemption: the open rules books. The System Reference Document 5.1 and 5.2.1 are released by Wizards of
// the Coast under the Creative Commons Attribution 4.0 International licence (CC-BY-4.0), which allows redistribution
// with attribution. `npm run books` (scripts/books) writes them to app/public/books/srd-* with that attribution in
// every file. Curse of Strahd is not open: it stays out, and every other path stays guarded. Two small files of SRD data
// read from the official PDFs sit beside the converter (scripts/books/titles/*.json: table titles; scripts/books/pdf/*.json:
// the 2014 class spell lists); each carries its book's attribution too (checked below).
const CC_BY_BOOKS = /^app\/public\/books\/(srd-[\d.]+\/|catalog\.json$)/;

function tracked(): string[] | null {
  try { return execSync('git ls-files --cached', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return null; }
}

describe('no book content in git', () => {
  it('nothing under reference/ is tracked except READMEs, and no PDFs or scans anywhere', () => {
    const files = tracked();
    if (!files) return;
    const bad = files.filter((f) => (f.startsWith('reference/') && !f.endsWith('README.md')) || /\.(pdf|tiff?|djvu|cbz)$/i.test(f));
    expect(bad).toEqual([]);
  });
  it('no book-length prose (Markdown, text or HTML over 150 KB) outside the CC-BY rules books', () => {
    const files = tracked();
    if (!files) return;
    const bad = files.filter((f) => /\.(md|txt|html?)$/i.test(f) && !CC_BY_BOOKS.test(f) && statSync(f, { throwIfNoEntry: false })?.size! > 150_000);
    expect(bad).toEqual([]);
  });
  it('app/public/books holds only the CC-BY SRD books', () => {
    const files = tracked();
    if (!files) return;
    expect(files.filter((f) => f.startsWith('app/public/books/') && !CC_BY_BOOKS.test(f))).toEqual([]);
  });
  it('app/public/books holds exactly the files the catalog lists, nothing else slipped in beside them', () => {
    const files = tracked();
    if (!files) return;
    const cat = JSON.parse(readFileSync('app/public/books/catalog.json', 'utf8')) as { books: { id: string; files: string[] }[] };
    const listed = ['app/public/books/catalog.json', ...cat.books.flatMap((b) => b.files.map((f) => `app/public/books/${b.id}/${f}`))].sort();
    expect(files.filter((f) => f.startsWith('app/public/books/')).sort()).toEqual(listed);
  });
});

describe('the CC-BY rules books carry their attribution', () => {
  const root = 'app/public/books';
  const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
  it('there are exactly the two SRD books', () => expect(dirs.sort()).toEqual(['srd-5.1', 'srd-5.2.1']));
  for (const d of dirs) {
    it(`${d}: ATTRIBUTION.md, the index and every data file carry the exact statement and the changes note`, () => {
      const statement = ATTRIBUTION[d as keyof typeof ATTRIBUTION];
      expect(statement).toMatch(/^This work includes material (taken )?from the System Reference Document 5\.[12](\.1)? \(“SRD 5\.[12](\.1)?”\) by Wizards of the Coast LLC/);
      const md = readFileSync(join(root, d, 'ATTRIBUTION.md'), 'utf8');
      expect(md).toContain(statement);
      expect(md).toContain(DISCLAIMER); // CC-BY-4.0 s.3(a)(1)(A)(iv)
      expect(md).toContain(CHANGES[d as keyof typeof CHANGES]);
      const walk = (p: string): string[] => readdirSync(p).flatMap((f) => (statSync(join(p, f)).isDirectory() ? walk(join(p, f)) : [join(p, f)]));
      const json = walk(join(root, d)).filter((f) => f.endsWith('.json'));
      expect(json.length).toBeGreaterThan(10);
      for (const f of json) {
        const j = JSON.parse(readFileSync(f, 'utf8')) as { attribution?: string; changes?: string };
        expect(j.attribution, f).toBe(statement);
        expect(j.changes, f).toBe(CHANGES[d as keyof typeof CHANGES]);
      }
    });
  }
});

describe('SRD data beside the converter carries its attribution, and the changes notes say what changed', () => {
  const dirs = ['scripts/books/titles', 'scripts/books/pdf'];
  it('every file of PDF data names its book and carries the exact statement', () => {
    const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => join(d, f)));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      const j = JSON.parse(readFileSync(f, 'utf8')) as { book: keyof typeof ATTRIBUTION; attribution: string };
      expect(j.attribution, f).toBe(ATTRIBUTION[j.book]);
    }
  });
  it('each changes note keeps the Markdown project\'s own list of changes and lists what mistLAB restored', () => {
    const c24 = CHANGES['srd-5.2.1'], c14 = CHANGES['srd-5.1'];
    for (const c of [c24, c14]) { expect(c).toContain('your5e/5e-srd-markdown project, which lists its own changes'); expect(c).not.toMatch(/Otherwise no rules text was changed/); expect(c).toMatch(/Apart from formatting and these changes, no rules text was changed\.$/); }
    for (const x of ['renumbered the steps of D20 Tests', 'changed “on [the] table” to “in [the] table”', 'removed their titles', 'a single header row', 'merged the Travel Pace header', '1d10']) expect(c24, x).toContain(x);
    expect(c24).toContain('corrected “wwizareapon” to “weapon”');
    expect(c14).toContain('“Behaviour” back to “Behavior”');
    for (const x of ['“Components” typo in Contagion', 'Heroes’ Feast', 'Hunter’s Mark', 'Blind Senses', 'Jokers', 'Saving Throws line', 'Tent, two-person', 'Cleric Level column of the Destroy Undead table', '“Proficiency Bonus”']) expect(c14, x).toContain(x);
  });
  it('each changes note names every hyphen and counts every dash put back from the PDF (scripts/books/pdf/<book>-repairs.json)', () => {
    for (const book of ['srd-5.2.1', 'srd-5.1'] as const) {
      const r = JSON.parse(readFileSync(`scripts/books/pdf/${book}-repairs.json`, 'utf8')) as { hyphens: Record<string, string>; dashes: unknown[] };
      expect(Object.keys(r.hyphens).length, book).toBeGreaterThan(5);
      const list = /put back the hyphens [^(]*\(([^)]*)\)/.exec(CHANGES[book])![1].split(', ');
      expect(list, book).toEqual([...new Set(Object.values(r.hyphens).map((h) => h.toLowerCase()))].sort());
      expect(CHANGES[book], book).toContain(`the ${r.dashes.length} dashes it had dropped there`);
    }
  });
});
