// Guard: the repo is public. The book, its scans, OCR text and page images must never be committed.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTION } from '../app/src/books/attribution';

// The one exemption: the open rules books. The System Reference Document 5.1 and 5.2.1 are released by Wizards of
// the Coast under the Creative Commons Attribution 4.0 International licence (CC-BY-4.0), which allows redistribution
// with attribution. `npm run books` (scripts/books) writes them to app/public/books/srd-* with that attribution in
// every file. Curse of Strahd is not open: it stays out, and every other path stays guarded.
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
});

describe('the CC-BY rules books carry their attribution', () => {
  const root = 'app/public/books';
  const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
  it('there are exactly the two SRD books', () => expect(dirs.sort()).toEqual(['srd-5.1', 'srd-5.2.1']));
  for (const d of dirs) {
    it(`${d}: ATTRIBUTION.md, the index and every data file carry the exact statement and the changes note`, () => {
      const statement = ATTRIBUTION[d as keyof typeof ATTRIBUTION];
      expect(statement).toMatch(/^This work includes material (taken )?from the System Reference Document 5\.[12](\.1)? \(“SRD 5\.[12](\.1)?”\) by Wizards of the Coast LLC/);
      expect(readFileSync(join(root, d, 'ATTRIBUTION.md'), 'utf8')).toContain(statement);
      const walk = (p: string): string[] => readdirSync(p).flatMap((f) => (statSync(join(p, f)).isDirectory() ? walk(join(p, f)) : [join(p, f)]));
      const json = walk(join(root, d)).filter((f) => f.endsWith('.json'));
      expect(json.length).toBeGreaterThan(10);
      for (const f of json) {
        const j = JSON.parse(readFileSync(f, 'utf8')) as { attribution?: string; changes?: string };
        expect(j.attribution, f).toBe(statement);
        expect(j.changes, f).toMatch(/Converted from the official PDF/);
      }
    });
  }
});
