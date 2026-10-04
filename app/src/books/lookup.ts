// Rules lookups for the rest of the app (rules tooltips, stat blocks, the glossary): find a spell, condition,
// monster, item or rule by name or id in the chosen edition, and find rules terms inside running text.
// Everything loads lazily from app/public/books/<book>/ (terms.json first, then the one entry file needed).
import { loadEntries, loadTerms } from './store';
import { BOOK_OF, EDITION_OF, ENTRY_FILE, TYPE_META, type BookId, type Edition, type EntryType, type StoredEntry, type Summary, type TermFile } from './types';

export { TYPE_META, BOOK_OF, type Edition, type EntryType };

/** A rules entry ready for a card. */
export interface RuleEntry {
  id: string; type: EntryType; name: string; edition: Edition; book: BookId;
  /** Typed summary fields (spell level and school, monster AC/HP/CR, item rarity, condition effects …). */
  summary: Summary;
  /** Short plain text for a tooltip. */
  text: string;
  /** Full body as HTML. */
  html: string;
  /** Where it is in the book: open the reader at `href`. */
  section: { book: BookId; anchor: string; href: string };
  /** The book's attribution statement (CC-BY-4.0), for the card's footer. */
  attribution: string;
}

// ---- the 'Rules edition' preference

const PREF = 'mistlab.rulesEdition';
export const EDITION_EVENT = 'mistlab:rules-edition';

/** Which rules answer a lookup: 2024 (SRD 5.2.1) by default, or 2014 (SRD 5.1). */
export function rulesEdition(): Edition {
  try { return localStorage.getItem(PREF) === '2014' ? '2014' : '2024'; } catch { return '2024'; }
}
export function setRulesEdition(e: Edition): void {
  try { localStorage.setItem(PREF, e); } catch { /* private mode: the default stays */ }
  if (typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent(EDITION_EVENT, { detail: e }));
}

// ---- lookup

const CUES: Partial<Record<EntryType, RegExp>> = {
  condition: /\s+condition$/, spell: /\s+(spell|cantrip)$/, rule: /\s+action$/, damage: /\s+damage$/, skill: /\s+(check|skill)$/,
};
export const normTerm = (s: string): string => s.toLowerCase().replace(/[’]/g, "'").replace(/\s*\\?\[[^\]]*\\?\]\s*/g, ' ').replace(/\s+/g, ' ').trim();

function toEntry(e: StoredEntry, book: BookId, attribution: string): RuleEntry {
  return { id: e.id, type: e.type, name: e.name, edition: EDITION_OF[book], book, summary: e.s, text: e.text, html: e.html, section: { book, anchor: e.anchor, href: `#book/${book}/${e.anchor}` }, attribution };
}

async function entryById(book: BookId, id: string, type: EntryType): Promise<RuleEntry | undefined> {
  const f = await loadEntries(book, ENTRY_FILE[type]);
  const e = f.entries[id];
  return e ? toEntry(e, book, f.attribution) : undefined;
}

/** Candidate entry indexes for a term in one book's term index, most relevant first. */
export function candidates(t: TermFile, term: string, type?: EntryType): number[] {
  const raw = term.trim();
  if (t.abbr[raw]) return t.abbr[raw].filter((i) => !type || t.entries[i][2] === type);
  let k = normTerm(raw);
  let hint = type;
  let list = t.forms[k];
  if (!list) for (const [ty, re] of Object.entries(CUES) as [EntryType, RegExp][]) {
    if (re.test(k)) { const base = k.replace(re, ''); if (t.forms[base]) { k = base; list = t.forms[base]; hint ??= ty; break; } }
  }
  if (!list) return [];
  if (!hint) return list;
  const typed = list.filter((i) => t.entries[i][2] === hint);
  return type ? typed : [...typed, ...list.filter((i) => t.entries[i][2] !== hint)];
}

/**
 * Look up a rules entry by id ('spell:fireball') or by name or term ('Fireball', 'prone condition', 'AC', 'wolves')
 * in the given edition (default: the 'Rules edition' preference). With `fallback`, the other edition answers
 * when the chosen one has no such entry.
 */
export async function lookup(termOrId: string, edition: Edition = rulesEdition(), opts: { type?: EntryType; fallback?: boolean } = {}): Promise<RuleEntry | undefined> {
  const order: Edition[] = opts.fallback === false ? [edition] : [edition, edition === '2024' ? '2014' : '2024'];
  for (const ed of order) {
    const book = BOOK_OF[ed];
    const t = await loadTerms(book);
    const m = /^([a-z-]+):([a-z0-9-]+)$/.exec(termOrId.trim());
    if (m && m[1] in ENTRY_FILE) {
      const e = await entryById(book, termOrId.trim(), m[1] as EntryType);
      if (e) return e;
      continue;
    }
    const c = candidates(t, termOrId, opts.type);
    if (c.length) { const [id, , type] = t.entries[c[0]]; return entryById(book, id, type); }
  }
  return undefined;
}

/** Every entry a term could mean (a 'Shield' is a spell and a piece of armour), in relevance order. */
export async function lookupAll(term: string, edition: Edition = rulesEdition()): Promise<RuleEntry[]> {
  const book = BOOK_OF[edition];
  const t = await loadTerms(book);
  const out: RuleEntry[] = [];
  for (const i of candidates(t, term)) { const [id, , type] = t.entries[i]; const e = await entryById(book, id, type); if (e) out.push(e); }
  return out;
}

// ---- terms inside running text

export interface TermSpan {
  start: number; end: number; text: string;
  id: string; type: EntryType; name: string;
  /** Written as an explicit tag: [[Fireball]] or [[spell:light]]. */
  explicit: boolean;
}

/** The term index of the chosen edition, for findTerms. */
export const termIndex = (edition: Edition = rulesEdition()): Promise<TermFile> => loadTerms(BOOK_OF[edition]);

const TYPE_CUE: Partial<Record<EntryType, RegExp>> = {
  condition: /^\s+condition\b/i, spell: /^\s+(spell|cantrip)\b/i, rule: /^\s+action\b/i, damage: /^\s+damage\b/i,
  skill: /^\s+(check|skill|\()/i, ability: /^\s+(check|saving throw|save|score|modifier)\b/i, 'creature-type': /^\s+(creature|type)\b/i,
};

/**
 * Find rules terms in a string. Longest match wins; names that are also ordinary English words (light, shield,
 * command, guidance, fly, prone, fire …) count only when tagged ([[Light]], [[spell:light]]), capitalised
 * mid-sentence, or followed by their cue word ('fire damage', 'prone condition', 'light cantrip').
 */
export function findTerms(text: string, t: TermFile, opts: { explicitOnly?: boolean } = {}): TermSpan[] {
  const spans: TermSpan[] = [];
  const common = new Set(t.common);
  const byId = new Map(t.entries.map((e, i) => [e[0], i]));
  // Explicit tags first.
  const tagRe = /\[\[(?:([a-z-]+):)?([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
  let m: RegExpExecArray | null;
  const taken: [number, number][] = [];
  while ((m = tagRe.exec(text))) {
    const type = m[1] as EntryType | undefined, name = m[2];
    let i = type ? byId.get(`${type}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`) : undefined;
    if (i === undefined) i = candidates(t, name, type && type in TYPE_META ? type : undefined)[0];
    if (i === undefined) continue;
    const [id, ename, etype] = t.entries[i];
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[3] ?? name, id, type: etype, name: ename, explicit: true });
    taken.push([m.index, m.index + m[0].length]);
  }
  if (opts.explicitOnly) return spans;
  const words: { s: number; e: number }[] = [];
  const wre = /[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]|\+\d/g;
  while ((m = wre.exec(text))) words.push({ s: m.index, e: m.index + m[0].length });
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);
  const maxWords = 6;
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(maxWords, words.length - i); n >= 1; n--) {
      const s = words[i].s; let e = words[i + n - 1].e;
      if (!free(s, e)) continue;
      let seg = text.slice(s, e);
      if (n > 1 && /[^\s'’A-Za-z,+-]|\s{2,}|\n/.test(seg)) continue; // a term never spans punctuation
      let idx = t.abbr[seg];
      let key = '';
      if (!idx) { key = normTerm(seg); idx = t.forms[key]; }
      if (!idx?.length && /['’]s$/.test(seg)) { // possessive: the wolf's bite
        key = normTerm(seg.slice(0, -2)); idx = t.forms[key];
        if (idx?.length) { e -= 2; seg = seg.slice(0, -2); }
      }
      if (!idx?.length) continue;
      let pick = idx[0];
      const after = text.slice(e, e + 20);
      // A cue word picks the meaning: 'light cantrip' is the spell, 'fire damage' the damage type.
      const cued = idx.find((k) => TYPE_CUE[t.entries[k][2]]?.test(after));
      if (cued !== undefined) pick = cued;
      const [id, name, type] = t.entries[pick];
      if (key && common.has(key)) {
        const cue = cued !== undefined;
        const capital = seg.split(/\s+/).every((w) => /^[A-Z+]/.test(w));
        const before = text.slice(0, s).trimEnd();
        const sentenceStart = !before || /[.!?:;"“(\n]$/.test(before);
        if (!cue && !(capital && !sentenceStart)) continue;
      }
      spans.push({ start: s, end: e, text: seg, id, type, name, explicit: false });
      taken.push([s, e]);
      i += n - 1;
      break;
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
