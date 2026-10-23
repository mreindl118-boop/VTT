// The 2014 class spell lists, read from the official PDF. The SRD 5.1 prints them in two columns (pages 105–114); the
// your5e Markdown dropped seven of the entries, and a 2014 spell names its classes only in these lists. `pdftotext`
// with a crop box reads one column at a time, in order. The result is committed
// (scripts/books/pdf/<book>-spell-lists.json) so a build without the PDF checks the same thing, and the converter's
// spells are compared with it: every spell must carry exactly the classes whose list names it.
import { execFileSync } from 'node:child_process';

/** Class → spell level (0 for cantrips) → spell names, in the PDF's order. */
export type SpellLists = Record<string, Record<string, string[]>>;

/** Parse the column text: 'Bard Spells', 'Cantrips (0 Level)', '1st Level', then one spell per line. */
export function parseSpellLists(text: string): SpellLists {
  const out: SpellLists = {};
  let cls = '', lvl = -1;
  for (const raw of text.split('\n')) {
    const l = raw.replace(/[\t\r ]/g, ' ').replace(/’/g, "'").replace(/\s+/g, ' ').trim();
    if (!l || /^System Reference Document/.test(l) || /^\d+$/.test(l) || l === 'Spell Lists') continue;
    if (/^Spell Descriptions/.test(l)) break;
    const c = /^(\w+) Spells$/.exec(l);
    if (c) { cls = c[1]; lvl = -1; continue; }
    const v = /^(?:Cantrips|(\d)(?:st|nd|rd|th) Level)/.exec(l);
    if (v) { lvl = v[1] ? +v[1] : 0; continue; }
    if (cls && lvl >= 0) ((out[cls] ??= {})[String(lvl)] ??= []).push(l);
  }
  return out;
}

/** The lists from the PDF (pages `from`–`to`, left column then right of each), or null when pdftotext is missing. */
export function pdfSpellLists(pdf: string, [from, to]: [number, number]): SpellLists | null {
  const cols: string[] = [];
  try {
    for (let p = from; p <= to; p++) for (const x of [0, 306]) {
      cols.push(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-x', String(x), '-y', '0', '-W', '306', '-H', '760', '-enc', 'UTF-8', pdf, '-'], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }).toString('utf8'));
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  return parseSpellLists(cols.join('\n'));
}

/** Differences between the lists and the classes the converter gave each spell (empty when they agree). */
export function compareSpellLists(lists: SpellLists, spells: { name: string; classes: string[] }[]): string[] {
  const key = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
  const want = new Map<string, Set<string>>();
  for (const [cls, levels] of Object.entries(lists)) for (const names of Object.values(levels)) for (const n of names) {
    const k = key(n);
    if (!want.has(k)) want.set(k, new Set());
    want.get(k)!.add(cls);
  }
  const out: string[] = [];
  const have = new Set(spells.map((s) => key(s.name)));
  for (const n of want.keys()) if (!have.has(n)) out.push(`listed but not a spell: ${n}`);
  for (const s of spells) {
    const w = [...(want.get(key(s.name)) ?? [])].sort().join(', '), g = [...s.classes].sort().join(', ');
    if (w !== g) out.push(`${s.name}: lists say [${w}], converter says [${g}]`);
  }
  return out;
}
