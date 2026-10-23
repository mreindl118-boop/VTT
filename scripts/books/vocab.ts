// The official PDF's words, for two checks of the Markdown's running text. The your5e conversion joined some hyphenated
// words that the PDF breaks at a line end ('5-foot-wide' became '5-footwide', 'life-threatening' 'lifethreatening').
// `hyphenRepairs` finds each word of the Markdown that the PDF never prints, which the PDF prints with a hyphen
// ('foot-wide' on one line, or a hard hyphen at a line end), and gives it its hyphen back. The result is committed
// (scripts/books/pdf/<book>-repairs.json) so a build without the PDF makes the same text. The converter test runs
// every page of the books against the same vocabulary, so a garbled word ('wwizareapon') cannot slip through again.
import { execFileSync } from 'node:child_process';

export interface PdfVocabulary {
  /** Every word the PDF prints, lower case: whole on a line, or rejoined across a line-end break of any kind. */
  words: Set<string>;
  /** Words the PDF prints in one piece: on one line, or across a soft (discretionary) line-end hyphen. */
  whole: Set<string>;
  /** Hyphenated pairs ('foot-wide'), lower case: on one line, or broken at a line end by a hard hyphen. */
  hyphenated: Set<string>;
}

/** Characters the PDFs use around a hyphen: SRD 5.1 prints '-', U+00AD, U+2010, U+2011 together; SRD 5.2.1 marks a hard
 *  line-end hyphen with U+200B, and a discretionary one is a bare '-' or U+00AD. */
const RUN = /[-­‐‑​]+/;

/** The vocabulary of `pdftotext -raw` output. */
export function vocabularyOf(text: string): PdfVocabulary {
  const lines = text.replace(/ /g, ' ').replace(/[\t\r\f]/g, ' ').toLowerCase().replace(/[’]/g, "'").split('\n');
  const words = new Set<string>(), whole = new Set<string>(), hyphenated = new Set<string>();
  const addLine = (l: string) => {
    for (const w of l.match(/[a-z]+/g) ?? []) { words.add(w); whole.add(w); }
    // A run of hyphen characters between letters is one hyphen.
    for (const m of l.matchAll(/(?=([a-z]+)[-­‐‑​]+([a-z]+))/g)) {
      const at = m.index ?? 0;
      if (at > 0 && /[a-z]/.test(l[at - 1])) continue;
      hyphenated.add(`${m[1]}-${m[2]}`);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimEnd();
    addLine(l.replace(/[-­‐‑​]+$/, ' '));
    const end = new RegExp(`([a-z]+)(${RUN.source})$`).exec(l);
    const next = /^\s*([a-z]+)/.exec(lines[i + 1] ?? '');
    if (!end || !next) continue;
    const [a, run, b] = [end[1], end[2], next[1]];
    words.add(a + b);
    const hard = run.length >= 2 && /[-‐‑]/.test(run);
    if (hard) hyphenated.add(`${a}-${b}`);
    else if (run === '­') whole.add(a + b);
  }
  return { words, whole, hyphenated };
}

export function pdfText(pdf: string): string | null {
  try { return execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', pdf, '-'], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch { return null; }
}

/**
 * Joined words of `md` to hyphenate again: lower-case word → its hyphenated form ('footwide' → 'foot-wide'). A word
 * qualifies when neither PDF prints it in one piece and they print exactly one split of it with a hyphen. (The other
 * book counts too: SRD 5.2.1 breaks 'long-dead' at a line end with a hyphen that may be a discretionary one, and the
 * same sentence of SRD 5.1 has a hard one.)
 */
export function hyphenRepairs(md: string, own: PdfVocabulary, others: PdfVocabulary[] = []): Record<string, string> {
  const all = [own, ...others];
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const m of md.matchAll(/[A-Za-z]+/g)) {
    const w = m[0].toLowerCase();
    if (seen.has(w)) continue;
    seen.add(w);
    if (w.length < 6 || all.some((v) => v.whole.has(w))) continue;
    const splits: string[] = [];
    for (let i = 2; i <= w.length - 2; i++) { const h = `${w.slice(0, i)}-${w.slice(i)}`; if (all.some((v) => v.hyphenated.has(h))) splits.push(h); }
    if (splits.length === 1) out[w] = splits[0];
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** A dash the Markdown lost: the words around it as the Markdown prints them, and the same with the dash. */
export interface DashRepair { find: string; replace: string }

/**
 * Dashes the conversion dropped where the PDF breaks a line right after one ('adventuring—' / 'noticing danger' became
 * 'adventuring noticing danger'). Each PDF line that ends in a dash after a word is looked up in `md` by the three words
 * before it and the two after; a single match with only a space where the dash was is a repair, written as the
 * Markdown writes its other dashes (' — ').
 */
export function dashRepairs(md: string, pdf: string): DashRepair[] {
  const t = pdf.replace(/[\u00a0\t\r\f]/g, ' ').replace(/([A-Za-z]+) *([—–]) *\n */g, '$1\u0001$2 ').replace(/\s+/g, ' ');
  const out: DashRepair[] = [];
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of t.matchAll(/([A-Za-z]+)\u0001([—–]) /g)) {
    const at = m.index ?? 0;
    const before = (t.slice(Math.max(0, at - 80), at).match(/[A-Za-z]+/g) ?? []).slice(-3);
    const after = (t.slice(at + m[0].length, at + m[0].length + 60).match(/[A-Za-z]+/g) ?? []).slice(0, 3);
    if (before.length < 3 || after.length < 3) continue;
    const gap = '[^A-Za-z\\n]+';
    const re = new RegExp(`(?<![A-Za-z])(${[...before, m[1]].map(esc).join(gap)}) (${after.map(esc).join(gap)})(?![A-Za-z])`, 'g');
    const hits = [...md.matchAll(re)];
    if (hits.length !== 1) continue;
    out.push({ find: hits[0][0], replace: `${hits[0][1]} ${m[2]} ${hits[0][2]}` });
  }
  return out;
}

/** Put the dashes back; the build stops if a repair no longer matches exactly once. */
export function applyDashes(md: string, repairs: DashRepair[], book: string): string {
  for (const r of repairs) {
    const n = md.split(r.find).length - 1;
    if (n !== 1) throw new Error(`${book}: dash repair expected 1 match, found ${n}: ${JSON.stringify(r.find)}`);
    md = md.replace(r.find, r.replace);
  }
  return md;
}

/** Put the hyphens back: every whole-word occurrence, keeping the case of its first letter. */
export function applyHyphens(md: string, repairs: Record<string, string>): { md: string; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const keys = Object.keys(repairs);
  if (!keys.length) return { md, counts };
  const re = new RegExp(`(?<![A-Za-z])(${keys.join('|')})(?![A-Za-z])`, 'gi');
  const out = md.replace(re, (w: string) => {
    const k = w.toLowerCase(), to = repairs[k];
    counts.set(k, (counts.get(k) ?? 0) + 1);
    return /^[A-Z]/.test(w) ? to[0].toUpperCase() + to.slice(1) : to;
  });
  return { md: out, counts };
}
