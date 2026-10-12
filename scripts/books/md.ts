// A small Markdown reader for the cleaned SRD conversions: headings, paragraphs, (nested) lists, pipe tables,
// block quotes, emphasis, strong and links. Enough for these two files; not a general CommonMark parser.

export interface Item { text: string; sub?: ListBlock }
export interface ListBlock { k: 'ul' | 'ol'; items: Item[] }
export type Block =
  | { k: 'h'; level: number; text: string; line: number }
  | { k: 'p'; lines: string[] }
  | ListBlock
  | { k: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { k: 'quote'; blocks: Block[] };

const isTableRow = (l: string) => /^\|.*\|\s*$/.test(l);
const isSep = (l: string) => /^\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(l);
const listRe = /^( *)(-|\d+\.) (.*)$/;

export function splitRow(l: string): string[] {
  const s = l.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur.trim());
  return out;
}

export function parseBlocks(src: string, firstLine = 1): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,6}) +(.*?)\s*#*\s*$/.exec(l);
    if (h) { out.push({ k: 'h', level: h[1].length, text: h[2], line: firstLine + i }); i++; continue; }
    if (isTableRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(l);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      out.push({ k: 'table', head, rows });
      continue;
    }
    if (l.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^> ?/, '')); i++; }
      out.push({ k: 'quote', blocks: parseBlocks(q.join('\n')) });
      continue;
    }
    if (listRe.test(l)) {
      const [list, next] = parseList(lines, i, (listRe.exec(l)![1]).length);
      out.push(list); i = next; continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,6} /.test(lines[i]) && !listRe.test(lines[i]) && !lines[i].startsWith('>')
      && !(isTableRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))) { para.push(lines[i].trim()); i++; }
    out.push({ k: 'p', lines: para });
  }
  return out;
}

function parseList(lines: string[], start: number, indent: number): [ListBlock, number] {
  const first = listRe.exec(lines[start])!;
  const list: ListBlock = { k: first[2] === '-' ? 'ul' : 'ol', items: [] };
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      // A blank line ends the list unless the next line continues it at this indent.
      const n = lines[i + 1] !== undefined ? listRe.exec(lines[i + 1]) : null;
      if (n && n[1].length >= indent && (n[2] === '-') === (list.k === 'ul')) { i++; continue; }
      break;
    }
    const m = listRe.exec(l);
    if (!m) { // continuation line of the previous item
      if (list.items.length && /^ {2,}\S/.test(l)) { list.items[list.items.length - 1].text += ' ' + l.trim(); i++; continue; }
      break;
    }
    const ind = m[1].length;
    if (ind < indent) break;
    if (ind > indent) {
      const [sub, next] = parseList(lines, i, ind);
      const last = list.items[list.items.length - 1];
      if (last) last.sub = sub; else list.items.push({ text: '', sub });
      i = next; continue;
    }
    if ((m[2] === '-') !== (list.k === 'ul')) break;
    list.items.push({ text: m[3] });
    i++;
  }
  return [list, i];
}

// ---- inline

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ESC = '\u0000';
/** Markdown inline → HTML. */
export function inline(md: string): string {
  const escs: string[] = [];
  let s = md.replace(/\\([\\`*_{}[\]()#+\-.!|"'])/g, (_, c: string) => { escs.push(c); return `${ESC}${escs.length - 1}${ESC}`; });
  const links: string[] = [];
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, t: string, u: string) => { links.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${inlineCore(t)}</a>`); return `${ESC}L${links.length - 1}${ESC}`; });
  s = inlineCore(s);
  s = s.replace(new RegExp(`${ESC}L(\\d+)${ESC}`, 'g'), (_, n: string) => links[+n]);
  return s.replace(new RegExp(`${ESC}(\\d+)${ESC}`, 'g'), (_, n: string) => escapeHtml(escs[+n]));
}

function inlineCore(s: string): string {
  s = escapeHtml(s);
  s = s.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1<em>$2</em>');
  return s;
}

/** Markdown inline → plain text (for search, summaries and term counts). */
export function plain(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1')
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1')
    .replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|"'])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- blocks → HTML

const numCell = /^[+\-−–]?\d[\d,./ ]*(?:\s?(?:gp|sp|cp|ep|pp|GP|SP|CP|EP|PP|lb\.|ft\.|feet|%))?$|^—$|^[+\-]\d+$|^\d+d\d+(?: ?[+\-] ?\d+)?$/;

export interface RenderOpts {
  /** Heading level shift (chapter grouping) and the anchor for each heading block. */
  shift?: number;
  anchors?: Map<Block, string>;
  /** Open/close wrappers around ranges of blocks (entries). */
  before?: Map<Block, string>;
  after?: Map<Block, string>;
}

export function renderBlocks(blocks: Block[], o: RenderOpts = {}): string {
  const out: string[] = [];
  for (const b of blocks) {
    const pre = o.before?.get(b); if (pre) out.push(pre);
    out.push(renderBlock(b, o));
    const post = o.after?.get(b); if (post) out.push(post);
  }
  return out.join('\n');
}

function renderList(b: ListBlock): string {
  return `<${b.k}>${b.items.map((it) => `<li>${inline(it.text)}${it.sub ? renderList(it.sub) : ''}</li>`).join('')}</${b.k}>`;
}

function renderBlock(b: Block, o: RenderOpts): string {
  switch (b.k) {
    case 'h': {
      const lv = Math.min(6, Math.max(1, b.level + (o.shift ?? 0)));
      const id = o.anchors?.get(b);
      return `<h${lv}${id ? ` id="${id}"` : ''}>${inline(b.text)}</h${lv}>`;
    }
    case 'p': return `<p>${b.lines.map(inline).join('<br>')}</p>`;
    case 'ul': case 'ol': return renderList(b);
    case 'quote': return `<blockquote>${renderBlocks(b.blocks, { shift: o.shift })}</blockquote>`;
    case 'table': {
      const cols = b.head.length;
      const id = o.anchors?.get(b);
      const caption = b.caption ? `<caption>${inline(b.caption)}</caption>` : '';
      const num = b.head.map((_, c) => b.rows.length > 0 && b.rows.every((r) => !r[c] || numCell.test(plain(r[c]))));
      const cell = (tag: string, s: string, c: number) => `<${tag}${num[c] ? ' class="n"' : ''}>${inline(s ?? '')}</${tag}>`;
      const head = b.head.some((h) => h.trim()) ? `<thead><tr>${b.head.map((h, c) => cell('th', h, c)).join('')}</tr></thead>` : '';
      const rows = b.rows.map((r) => `<tr>${Array.from({ length: cols }, (_, c) => cell(c === 0 && /^\*\*.*\*\*$/.test(r[0] ?? '') ? 'th' : 'td', r[c] ?? '', c)).join('')}</tr>`).join('');
      // A stat block's ability table (Str. … Cha.) is marked, so it can be laid out to fit a phone wherever it appears.
      const abil = b.head.some((h) => /^Str\.?$/.test(plain(h))) && b.head.some((h) => /^Cha\.?$/.test(plain(h)));
      return `<div class="tbl"${id ? ` id="${id}"` : ''}><table${abil ? ' class="abil"' : ''}>${caption}${head}<tbody>${rows}</tbody></table></div>`;
    }
  }
}

/** Plain text of blocks (for full-text search and summaries). */
export function blocksText(blocks: Block[]): string {
  const t: string[] = [];
  const list = (b: ListBlock) => { for (const it of b.items) { t.push(plain(it.text)); if (it.sub) list(it.sub); } };
  for (const b of blocks) {
    if (b.k === 'h' || b.k === 'p') t.push(plain(b.k === 'h' ? b.text : b.lines.join(' ')));
    else if (b.k === 'ul' || b.k === 'ol') list(b);
    else if (b.k === 'table') { if (b.caption) t.push(plain(b.caption)); t.push(b.head.map(plain).join(' ')); for (const r of b.rows) t.push(r.map(plain).join(' ')); }
    else if (b.k === 'quote') t.push(blocksText(b.blocks));
  }
  return t.join('\n');
}

export function slug(s: string): string {
  return plain(s).toLowerCase().replace(/[’']/g, '').replace(/\[[^\]]*\]/g, '').replace(/&/g, ' and ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

// ---- source repairs

/** The PDF set some full stops in italics after a word in roman ('knocked prone_._', 'see "Playing the Game_."_'): an
 *  emphasis around nothing but punctuation shows as stray underscores, so it is dropped. */
export const dropItalicPunctuation = (md: string): string => md.replace(/(?<=[A-Za-z])_([.,;:!?]["”]?)_(?![A-Za-z0-9])/g, '$1');

/**
 * Rejoin words the PDF extraction split in two ('Na ture', 'Leather Ar mor', 'de pending'): two adjacent fragments
 * join when the joined word occurs at least twice elsewhere in the book and one fragment is rare there (six times or fewer).
 * Phrases in `keep` ('a bout') stay apart. Returns the text and what was joined, for the build log and the tests.
 */
const RARE = 6;
export function repairSplitWords(md: string, keep: string[] = []): { md: string; joined: Map<string, number> } {
  const count = new Map<string, number>();
  for (const w of md.match(/[A-Za-z]+/g) ?? []) { const k = w.toLowerCase(); count.set(k, (count.get(k) ?? 0) + 1); }
  const n = (w: string) => count.get(w.toLowerCase()) ?? 0;
  const stay = new Set(keep.map((x) => x.toLowerCase()));
  const joined = new Map<string, number>();
  let skip = -1; // a fragment just joined to the word before it is not the start of another pair
  // Only the first word and the space are consumed, so 'has nu merous' still tries 'nu merous'.
  const out = md.replace(/(?<![A-Za-z'’-])([A-Za-z]+) (?=([a-z]+)(?![A-Za-z-]))/g, (all: string, a: string, b: string, at: number) => {
    if (at === skip) return all;
    const w = a + b;
    if (w.length < 5 || stay.has(`${a} ${b}`.toLowerCase())) return all;
    if (n(w) < 2 || (n(a) > RARE && n(b) > RARE)) return all;
    joined.set(`${a} ${b}`, (joined.get(`${a} ${b}`) ?? 0) + 1);
    skip = at + all.length;
    return a;
  });
  return { md: out, joined };
}
