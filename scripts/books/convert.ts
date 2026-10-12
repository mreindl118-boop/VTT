// SRD Markdown → book data: chapters split into lazy pages (HTML), typed rules entries, a search index and a
// term index. Pure: takes the Markdown text and the book config, returns the files to write.
import { blocksText, dropItalicPunctuation, inline, parseBlocks, plain, renderBlocks, repairSplitWords, slug, type Block, type ListBlock } from './md.ts';
import { DISCLAIMER, LICENSE, type BookConfig } from './config.ts';
import type { PdfTitle } from './titles.ts';
import type {
  BookIndex, EntryFile, EntryType, PageFile, Source, StoredEntry, Summary, TermFile, MonsterSummary, SpellSummary, ItemSummary,
} from '../../app/src/books/types.ts';
import { ENTRY_FILE } from '../../app/src/books/types.ts';

type H = Extract<Block, { k: 'h' }>;
export interface Node {
  h: H; level: number; title: string; name: string; tag?: string;
  start: number; end: number; children: Node[]; parent?: Node; chapter: Chapter; anchor: string;
}
export interface Chapter { idx: number; id: string; title: string; blocks: Block[]; nodes: Node[]; root: Node }
export interface Entry extends StoredEntry { node?: Node; at: Node; wrap: boolean; extra: string[] }

/** Target size of one lazy page (HTML bytes). Chapters above it are split at section boundaries. */
const PAGE_TARGET = 90_000;

// ---------------------------------------------------------------- chapters and the heading tree

// ---------------------------------------------------------------- source repairs (before parsing)

export interface Prepared { md: string; joined: Map<string, number> }

/** The Markdown as the converter reads it: errata patches, the legal page's quotes, split words rejoined. */
export function prepare(cfg: BookConfig, md: string): Prepared {
  for (const p of cfg.patches) {
    let from = 0, to = md.length;
    if (p.within) {
      for (const m of p.within.from) {
        const i = md.indexOf(m, from);
        if (i < 0) throw new Error(`${cfg.id}: patch (${p.why}): marker not found: ${JSON.stringify(m)}`);
        from = i + m.length;
      }
      const end = md.indexOf(p.within.to, from);
      to = end < 0 ? md.length : end + 1; // a \n that starts the end marker stays inside, so a last line can match
    }
    const part = md.slice(from, to);
    const n = part.split(p.find).length - 1;
    if (n !== (p.count ?? 1)) throw new Error(`${cfg.id}: patch (${p.why}) expected ${p.count ?? 1} match(es), found ${n}`);
    md = md.slice(0, from) + part.split(p.find).join(p.replace) + md.slice(to);
  }
  md = dropItalicPunctuation(md);
  // The legal page is quoted to readers as printed: curly quotes, as in the PDF.
  const legalEnd = md.indexOf('\n# ', md.indexOf('# Legal Information') + 1);
  if (legalEnd > 0) md = md.slice(0, legalEnd).replace(/(^|[\s(])"([^"\n]+)"/g, '$1“$2”') + md.slice(legalEnd);
  if (!cfg.repairWords) return { md, joined: new Map() };
  return repairSplitWords(md, cfg.repairWords.keep);
}

type T = Extract<Block, { k: 'table' }>;
const ACTION_LINE = /^(?:_\*\*|\*\*_?)Multiattack\b|(?:Attack Roll|Weapon Attack|Spell Attack):/;

/** A stat block whose Traits run on into its actions (Young Green Dragon, 2024): start Actions at the first action. */
function splitTraits(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let traits: Extract<Block, { k: 'h' }> | null = null;
  for (const b of blocks) {
    if (b.k === 'h') traits = plain(b.text) === 'Traits' ? b : null;
    else if (traits && b.k === 'p' && ACTION_LINE.test(b.lines[0])) {
      out.push({ k: 'h', level: traits.level, text: 'Actions', line: traits.line });
      traits = null;
    }
    out.push(b);
  }
  return out;
}

/**
 * 2014 stat blocks as printed: the Markdown turned the 'Saving Throws' line into a row of every save under the ability
 * scores. The row goes, and the saves that differ from the modifier (the proficient ones) become the printed line,
 * 'Saving Throws Dex +9, Wis +7, Cha +9', ahead of the other fields.
 */
function savesAsPrinted(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.k !== 'table' || !b.head.some((h) => /^Str\.?$/.test(h.trim()))) { out.push(b); continue; }
    const row = (re: RegExp) => b.rows.find((r) => re.test(plain(r[0])));
    const mod = row(/^Modifier$/), save = row(/^Saving Throws?$/);
    if (!mod || !save) { out.push(b); continue; }
    const prof = b.head.flatMap((h, c) => (c > 0 && plain(save[c]) !== plain(mod[c]) ? [`${plain(h).replace(/\.$/, '')} ${plain(save[c])}`] : []));
    out.push({ ...b, rows: b.rows.filter((r) => r !== save) });
    if (!prof.length) continue;
    const item = { text: `**Saving Throws** ${prof.join(', ')}` };
    const next = blocks[i + 1];
    if (next?.k === 'ul') { out.push({ ...next, items: [item, ...next.items] }); i++; } else out.push({ k: 'ul', items: [item] });
  }
  return out;
}

const words = (s: string) => new Set(normForm(plain(s)).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean));

/**
 * Put each PDF table title on its table: titles and tables are walked in order, a title going to the next table
 * whose header row matches the header printed under it. A title that only repeats the heading just above stays off.
 */
export function placeTitles(blocks: Block[], titles: PdfTitle[]): { placed: number; missed: PdfTitle[] } {
  const tables = blocks.map((b, i) => [b, i] as const).filter((x): x is readonly [T, number] => x[0].k === 'table');
  let p = 0, placed = 0;
  const missed: PdfTitle[] = [];
  const used = new Set<number>();
  // 'Wizard Class Features' is the heading over the table the PDF calls 'Wizard Features'.
  const headingBefore = (j: number) => { const b = blocks[tables[j][1] - 1]; return b?.k === 'h' ? normForm(plain(b.text)).replace(/ class features$/, ' features') : ''; };
  for (const t of titles) {
    const pw = words(t.head.join(' ')), name = normForm(t.title);
    // A table right under a heading of the title's own name is certainly it; otherwise the first table nearby whose
    // header row shares most of its words with the header printed under the title.
    // Forward from the last match, then a few tables back: the Markdown sometimes orders two tables of one PDF page
    // differently (Skills before Actions, the vehicles before Food, Drink, and Lodging).
    const order = [...Array.from({ length: 40 }, (_, k) => p + k), ...Array.from({ length: 6 }, (_, k) => p - 1 - k)].filter((j) => j >= 0 && j < tables.length && !used.has(j));
    const weak = (j: number) => {
      const mw = words(tables[j][0].head.join(' '));
      if (j >= p + 30 || !mw.size || !pw.size || (headingBefore(j) && titles.some((x) => normForm(x.title) === headingBefore(j)))) return false;
      const both = [...mw].filter((w) => pw.has(w)).length;
      return both >= Math.min(2, mw.size, pw.size) && both / pw.size >= 0.6 && both / mw.size >= 0.3;
    };
    const hit = order.find((j) => headingBefore(j) === name) ?? order.find(weak) ?? -1;
    if (hit < 0) { missed.push(t); continue; }
    used.add(hit);
    p = Math.max(p, hit + 1);
    const [tb, i] = tables[hit];
    const prev = blocks[i - 1];
    if (prev?.k === 'h' && normForm(plain(prev.text)) === normForm(t.title)) continue;
    tb.caption = t.title;
    placed++;
  }
  return { placed, missed };
}

function chaptersOf(cfg: BookConfig, md: string, titles: PdfTitle[]): Chapter[] {
  let blocks = splitTraits(parseBlocks(md));
  if (cfg.edition === '2014') blocks = savesAsPrinted(blocks);
  if (cfg.tableTitles) placeTitles(blocks, titles);
  const starts: number[] = [];
  let from = 0;
  for (const spec of cfg.chapters) {
    const i = blocks.findIndex((b, j) => j >= from && b.k === 'h' && b.level === spec.start[0] && plain(b.text) === spec.start[1]);
    if (i < 0) throw new Error(`${cfg.id}: chapter start not found: ${spec.start.join(' ')}`);
    starts.push(i); from = i + 1;
  }
  return cfg.chapters.map((spec, idx) => {
    let bs = blocks.slice(starts[idx], starts[idx + 1] ?? blocks.length);
    const shift = spec.group ? 1 : spec.promote ? -spec.promote : 0;
    // A grouped chapter whose first part has the chapter's own name (Equipment, Feats …) keeps that part as the
    // chapter's opening rather than nesting it under a copy of itself.
    const keepFirst = spec.group && plain((bs[0] as H).text) === spec.title;
    const firstEnd = keepFirst ? bs.findIndex((b, i) => i > 0 && b.k === 'h' && b.level === 1) : 0;
    if (shift) bs = bs.map((b, i) => (b.k === 'h' && (!keepFirst || i >= (firstEnd < 0 ? bs.length : firstEnd)) ? { ...b, level: Math.min(6, b.level + shift) } : b));
    if (spec.group && !keepFirst) bs = [{ k: 'h', level: 1, text: spec.title, line: (bs[0] as H).line }, ...bs];
    const title = plain((bs[0] as H).text);
    const ch: Chapter = { idx, id: slug(title), title, blocks: bs, nodes: [], root: undefined as unknown as Node };
    buildTree(ch);
    return ch;
  });
}

const TAG = /\s*\\?\[([A-Za-z ]+)\\?\]\s*$/;

function buildTree(ch: Chapter): void {
  const stack: Node[] = [];
  ch.blocks.forEach((b, i) => {
    if (b.k !== 'h') return;
    while (stack.length && stack[stack.length - 1].level >= b.level) stack.pop()!.end = i;
    const title = plain(b.text);
    const tag = TAG.exec(b.text)?.[1];
    const n: Node = { h: b, level: b.level, title, name: plain(b.text.replace(TAG, '')), tag, start: i, end: ch.blocks.length, children: [], parent: stack[stack.length - 1], chapter: ch, anchor: '' };
    n.parent?.children.push(n);
    ch.nodes.push(n);
    stack.push(n);
  });
  ch.root = ch.nodes[0];
}

const body = (n: Node): Block[] => n.chapter.blocks.slice(n.start + 1, n.end);
/** Blocks before the node's first sub-heading. */
const own = (n: Node): Block[] => n.chapter.blocks.slice(n.start + 1, n.children[0]?.start ?? n.end);
const firstLine = (n: Node): string | undefined => { const b = own(n)[0]; return b?.k === 'p' && b.lines.length === 1 ? b.lines[0] : undefined; };
const find = (nodes: Node[], f: (n: Node) => boolean) => nodes.find(f);
function* descendants(n: Node): Generator<Node> { for (const c of n.children) { yield c; yield* descendants(c); } }

/** `- **Key:** value` / `- **Key** value` bullets in the node's own blocks. */
function fields(blocks: Block[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of blocks) if (b.k === 'ul') for (const it of b.items) {
    const r = /^\*\*(.+?)\*\*:?\s*(.*)$/.exec(it.text);
    if (r) m.set(plain(r[1]).replace(/:$/, '').toLowerCase(), plain(r[2]));
  }
  return m;
}

/** Lead-in paragraphs: `_**Name.**_ text` or `**Name.** text`. */
function leads(blocks: Block[]): { name: string; text: string; block: Block }[] {
  const out: { name: string; text: string; block: Block }[] = [];
  for (const b of blocks) {
    if (b.k !== 'p') continue;
    const r = /^(?:_\*\*|\*\*_?)(.+?)\.?(?:\*\*_|_?\*\*)\.?\s*(.*)$/.exec(b.lines[0]);
    if (r) out.push({ name: plain(r[1]).replace(/\.$/, ''), text: plain([r[2], ...b.lines.slice(1)].join(' ')), block: b });
  }
  return out;
}

const short = (s: string, n = 260) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n - 1))} …`);
/** The first paragraph of prose (not a field list or an italic type line); `deep` looks past sub-headings too. */
function firstProse(blocks: Block[], skip = 0, deep = false): string {
  let k = 0;
  for (const b of blocks) {
    if (b.k === 'h') { if (deep) continue; break; }
    if (b.k === 'p' && !/^_[^_]+_$/.test(b.lines[0]) && !/^\*\*[^*]+:\*\*/.test(b.lines[0])) { if (k++ >= skip) return short(plain(b.lines.join(' '))); }
  }
  return '';
}
const html = (blocks: Block[]) => renderBlocks(blocks);
/** Entry body for a card: the whole section, or for a long one its opening and the names of its parts. */
const ENTRY_HTML_MAX = 8000;
function entryHtml(n: Node): string {
  const all = html(body(n));
  if (all.length <= ENTRY_HTML_MAX || !n.children.length) return all;
  return `${html(own(n))}<p class="more">Continues in the book: ${n.children.map((c) => inline(c.h.text)).join(' · ')}</p>`;
}

// ---------------------------------------------------------------- entry recognisers

const SIZES = 'Tiny|Small|Medium|Large|Huge|Gargantuan';
const MONSTER_LINE = new RegExp(`^_((?:${SIZES})(?:(?:,| or) (?:${SIZES}))*) (.+), ([^,]+)_$`, 'i');
const SPELL_24 = /^_(?:Level (\d) ([A-Z][a-z]+)|([A-Z][a-z]+) Cantrip) \(([^)]*)\)_$/;
const SPELL_14 = /^_(?:(\d)(?:st|nd|rd|th)-level ([a-z]+)|([a-z]+) cantrip)( \(ritual\))?_$/i;
const RARITY = /, ((?:rarity varies|rarity by [^,()]+|varies|common|uncommon|rare|very rare|legendary|artifact)\b.*)$/i;
const cap = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const num = (s: string | undefined) => { const m = /-?\d[\d,]*/.exec(s ?? ''); return m ? Number(m[0].replace(/,/g, '')) : NaN; };

export const DAMAGE = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
export const ABILITIES: [string, string][] = [['Strength', 'Str'], ['Dexterity', 'Dex'], ['Constitution', 'Con'], ['Intelligence', 'Int'], ['Wisdom', 'Wis'], ['Charisma', 'Cha']];
export const SKILLS: [string, string][] = [['Acrobatics', 'Dexterity'], ['Animal Handling', 'Wisdom'], ['Arcana', 'Intelligence'], ['Athletics', 'Strength'], ['Deception', 'Charisma'], ['History', 'Intelligence'], ['Insight', 'Wisdom'], ['Intimidation', 'Charisma'], ['Investigation', 'Intelligence'], ['Medicine', 'Wisdom'], ['Nature', 'Intelligence'], ['Perception', 'Wisdom'], ['Performance', 'Charisma'], ['Persuasion', 'Charisma'], ['Religion', 'Intelligence'], ['Sleight of Hand', 'Dexterity'], ['Stealth', 'Dexterity'], ['Survival', 'Wisdom']];

class Entries {
  list: Entry[] = [];
  byId = new Map<string, Entry>();
  add(type: EntryType, name: string, s: Summary, at: Node, o: { node?: Node; html?: string; text?: string; wrap?: boolean; disamb?: string; extra?: string[]; merge?: boolean } = {}): Entry | undefined {
    let id = `${type}:${slug(name)}`;
    const prev = this.byId.get(id);
    if (prev) {
      if (o.merge) { for (const [k, v] of Object.entries(s)) if (v !== undefined && (prev.s as Record<string, unknown>)[k] === undefined) (prev.s as Record<string, unknown>)[k] = v; return undefined; }
      if (!o.disamb) return undefined; // first one wins
      id = `${id}-${slug(o.disamb)}`;
      for (let k = 2; this.byId.has(id); k++) id = `${type}:${slug(name)}-${slug(o.disamb)}-${k}`;
    }
    const n = o.node;
    const e: Entry = {
      id, type, name, s, anchor: '', at, node: n, wrap: o.wrap ?? !!n, extra: o.extra ?? [],
      html: o.html ?? (n ? entryHtml(n) : ''),
      text: o.text ?? (n ? firstProse(body(n)) || firstProse(body(n), 0, true) : ''),
    };
    this.list.push(e); this.byId.set(id, e);
    return e;
  }
}

function spell(cfg: BookConfig, n: Node, classes14: Map<string, string[]>): Summary | undefined {
  const l = firstLine(n);
  if (!l) return;
  let level: number, school: string, classes: string[], ritual = false;
  const a = SPELL_24.exec(l), b = SPELL_14.exec(l);
  if (cfg.edition === '2024' && a) { level = a[1] ? +a[1] : 0; school = a[2] ?? a[3]; classes = a[4].split(/,\s*/); }
  else if (cfg.edition === '2014' && b) { level = b[1] ? +b[1] : 0; school = cap(b[2] ?? b[3]); ritual = !!b[4]; classes = classes14.get(n.name.toLowerCase()) ?? []; }
  else return;
  const f = fields(own(n));
  if (!f.has('casting time')) return;
  const castingTime = f.get('casting time')!, duration = f.get('duration') ?? '', components = f.get('components') ?? '';
  if (/ritual/i.test(castingTime)) ritual = true;
  const s: SpellSummary = {
    level, school, castingTime, range: f.get('range') ?? '', components: components.replace(/\s*\(.*\)$/, ''), duration,
    concentration: /^concentration/i.test(duration), ritual, classes,
  };
  const mat = /M \((.*)\)$/.exec(components)?.[1];
  if (mat) s.material = mat;
  return s;
}

function monster(n: Node): MonsterSummary | undefined {
  const l = firstLine(n);
  const m = l ? MONSTER_LINE.exec(l) : null;
  if (!m) return;
  const blocks = own(n), f = fields(blocks);
  const ac = f.get('ac') ?? f.get('armor class'), hp = f.get('hp') ?? f.get('hit points');
  if (!ac || !hp) return;
  const t = blocks.find((b): b is Extract<Block, { k: 'table' }> => b.k === 'table' && b.head.some((h) => /^Str\.?$/.test(h)));
  const score = t?.rows.find((r) => /score/i.test(r[0])) ?? t?.rows[0];
  const ab = (i: number) => num(score?.[i + 1]);
  const cr = f.get('cr') ?? f.get('challenge') ?? '';
  const s: MonsterSummary = {
    size: cap(m[1]).replace(/ Or /g, ' or '), creatureType: m[2], alignment: m[3], ac: num(ac), hp: num(hp), speed: f.get('speed') ?? '',
    cr: /^([\d/]+)/.exec(cr)?.[1] ?? cr,
    abilities: { str: ab(0), dex: ab(1), con: ab(2), int: ab(3), wis: ab(4), cha: ab(5) },
  };
  const acNote = /\((.*)\)/.exec(ac)?.[1]; if (acNote) s.acNote = acNote;
  const dice = /\((.*)\)/.exec(hp)?.[1]; if (dice) s.hpDice = dice;
  const xp = /XP ([\d,]+)|([\d,]+) XP/.exec(cr); if (xp) s.xp = num(xp[1] ?? xp[2]);
  const pb = /PB ([+\-]\d+)/.exec(cr)?.[1]; if (pb) s.pb = pb;
  if (f.get('initiative')) s.initiative = f.get('initiative');
  const opt: [keyof MonsterSummary, string[]][] = [
    ['saves', ['saving throws']], ['skills', ['skills']], ['senses', ['senses']], ['languages', ['languages']],
    ['resistances', ['resistances', 'damage resistances']], ['vulnerabilities', ['vulnerabilities', 'damage vulnerabilities']],
    ['immunities', ['immunities', 'damage immunities']], ['conditionImmunities', ['condition immunities']], ['gear', ['gear']],
  ];
  for (const [k, keys] of opt) { const v = keys.map((x) => f.get(x)).find(Boolean); if (v) (s as unknown as Record<string, string>)[k] = v; }
  return s;
}

/** A monster's tooltip line: 'Medium or Small Undead, Lawful Evil. AC 16, HP 195 (23d8 + 92), Speed 40 ft. … CR 13 (XP 10,000).' */
function statLine(s: MonsterSummary): string {
  return `${s.size} ${s.creatureType}, ${s.alignment}. AC ${s.ac}${s.acNote ? ` (${s.acNote})` : ''}, HP ${s.hp}${s.hpDice ? ` (${s.hpDice})` : ''}, Speed ${s.speed.replace(/\.$/, '')}. CR ${s.cr}${s.xp ? ` (XP ${s.xp.toLocaleString('en-US')})` : ''}.`;
}

function itemLine(s: ItemSummary): string {
  const parts = [s.damage, s.properties, s.ac && `AC ${s.ac}`, s.strength, s.stealth && `Stealth ${s.stealth}`, s.cost && `Cost ${s.cost}`, s.weight].filter(Boolean);
  return `${s.category}${s.subcategory ? ` (${s.subcategory})` : ''}${parts.length ? `: ${parts.join(', ').replace(/\.$/, '')}` : ''}.`;
}

function magicItem(n: Node): ItemSummary | undefined {
  const l = firstLine(n);
  if (!l || !/^_(Armor|Weapon|Wondrous [Ii]tem|Potion|Ring|Rod|Scroll|Staff|Wand|Ammunition|Shield)\b/.test(l)) return;
  const t = l.slice(1, -1);
  // Split at the first top-level ", <rarity>".
  let depth = 0, cut = -1;
  for (let i = 0; i < t.length && cut < 0; i++) {
    if (t[i] === '(') depth++; else if (t[i] === ')') depth--;
    else if (depth === 0 && t[i] === ',' && RARITY.test(t.slice(i))) cut = i;
  }
  if (cut < 0) return;
  const category = t.slice(0, cut).trim(), rest = t.slice(cut + 1).trim();
  const att = /\((requires attunement[^)]*)\)/i.exec(rest);
  const s: ItemSummary = { category: cap(category.replace(/\s*\(.*$/, '')), magic: true, rarity: rest.replace(/\s*\(requires attunement[^)]*\)/i, '').trim() };
  const sub = /\((.*)\)/.exec(category)?.[1]; if (sub) s.subcategory = sub;
  if (att) s.attunement = /^requires attunement$/i.test(att[1]) ? true : att[1].replace(/^requires attunement\s*/i, '');
  return s;
}

const normName = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Every rules entry of one book. */
function recognise(cfg: BookConfig, chapters: Chapter[]): Entries {
  const E = new Entries();
  const all = chapters.flatMap((c) => c.nodes);
  const chap = (title: string) => chapters.find((c) => c.title === title);
  const v24 = cfg.edition === '2024';

  // 2014 spells name their classes only in the Spell Lists.
  const classes14 = new Map<string, string[]>();
  const lists = find(all, (n) => n.name === 'Spell Lists');
  if (lists) for (const c of lists.children) {
    const cls = c.name.replace(/ Spells$/, '');
    for (const b of body(c)) if (b.k === 'ul') for (const it of b.items) { const k = plain(it.text).toLowerCase(); classes14.set(k, [...(classes14.get(k) ?? []), cls]); }
  }

  // Conditions first: they are the most common lookups.
  if (v24) {
    const defs = find(all, (n) => n.name === 'Rules Definitions');
    for (const n of defs?.children ?? []) {
      if (n.tag !== 'Condition') continue;
      const eff = [...leads(own(n)).map((x) => `${x.name}. ${x.text}`), ...own(n).flatMap((b) => (b.k === 'ul' || b.k === 'ol' ? b.items.map((i) => plain(i.text)) : []))];
      E.add('condition', n.name, { effects: eff }, n, { node: n, text: firstProse(own(n)) || short(eff.join(' ')) });
    }
  } else {
    const app = find(all, (n) => n.name === 'Appendix PH-A: Conditions');
    for (const n of app?.children ?? []) {
      const eff: string[] = [];
      for (const b of own(n)) {
        if (b.k === 'ul' || b.k === 'ol') eff.push(...b.items.map((i) => plain(i.text)));
        if (b.k === 'table') eff.push(...b.rows.map((r) => `${plain(r[0])}: ${plain(r[1])}`));
      }
      E.add('condition', n.name, { effects: eff }, n, { node: n, text: firstProse(own(n)) || short(eff.join(' ')) });
    }
  }

  // Spells, monsters and magic items are recognised by their header lines.
  for (const n of all) {
    const ch = n.chapter.title;
    if (/Spell/.test(ch)) { const s = spell(cfg, n, classes14); if (s) { E.add('spell', n.name, s, n, { node: n }); continue; } }
    if (/Monster|Animals|Appendix MM/.test(ch)) { const s = monster(n); if (s) { E.add('monster', n.name, s, n, { node: n, text: statLine(s as MonsterSummary) }); continue; } }
    if (/Magic Items/.test(ch)) { const s = magicItem(n); if (s) { E.add('item', n.name, s, n, { node: n }); continue; } }
  }

  // Rules glossary (2024): every definition, typed by its bracketed tag.
  if (v24) {
    for (const n of find(all, (x) => x.name === 'Rules Definitions')?.children ?? []) {
      if (n.tag === 'Condition') continue;
      E.add('rule', n.name, n.tag ? { tag: n.tag } : {}, n, { node: n });
    }
  }

  // Weapon properties and mastery properties.
  const props = find(all, (n) => n.chapter.title === 'Equipment' && (n.name === 'Properties' || n.name === 'Weapon Properties'));
  if (props) {
    if (props.name === 'Properties') for (const c of props.children) E.add('rule', c.name, { tag: 'Weapon Property' }, c, { node: c, disamb: 'weapon property' });
    for (const x of leads(own(props))) if (x.name !== 'Special') E.add('rule', x.name, { tag: 'Weapon Property' }, props, { html: `<p>${inline(x.text)}</p>`, text: short(x.text), disamb: 'weapon property' });
  }
  const mastery = find(all, (n) => n.name === 'Mastery Properties');
  for (const c of mastery?.children ?? []) E.add('rule', c.name, { tag: 'Mastery Property' }, c, { node: c, disamb: 'mastery property' });

  // Damage types.
  const dmgNodes = all.filter((n) => n.name === 'Damage Types');
  for (const d of DAMAGE) {
    for (const n of dmgNodes) {
      const lead = leads(own(n)).find((x) => x.name === d);
      const row = own(n).flatMap((b) => (b.k === 'table' ? b.rows : [])).find((r) => plain(r[0]) === d);
      const text = lead?.text ?? (row ? plain(row[1]) : '');
      if (!text) continue;
      E.add('damage', d, {}, n, { html: `<p>${inline(lead ? lead.text : row![1])}</p>`, text: short(text) });
      break;
    }
  }

  // Abilities and skills.
  const sixTable = all.map((n) => [n, own(n).find((b) => b.k === 'table' && plain(b.head[0]) === 'Ability')] as const).find(([, t]) => t);
  const eachAbility = find(all, (n) => n.name === 'Using Each Ability');
  for (const [name, abbr] of ABILITIES) {
    const row = sixTable && (sixTable[1] as Extract<Block, { k: 'table' }>).rows.find((r) => plain(r[0]) === name);
    const node = eachAbility?.children.find((c) => c.name === name);
    if (node) E.add('ability', name, { abbr }, node, { html: html(own(node)), text: firstProse(own(node)) });
    else if (row && sixTable) E.add('ability', name, { abbr }, sixTable[0], { html: `<p>${inline(row[1])}</p>`, text: plain(row[1]) });
  }
  const skillTable = all.map((n) => [n, own(n).find((b) => b.k === 'table' && plain(b.head[0]) === 'Skill' && plain(b.head[1] ?? '') === 'Ability')] as const).find(([, t]) => t);
  for (const [name, ability] of SKILLS) {
    if (skillTable) {
      const t = skillTable[1] as Extract<Block, { k: 'table' }>;
      const row = t.rows.find((r) => plain(r[0]) === name);
      if (row) { E.add('skill', name, { ability: plain(row[1]) }, skillTable[0], { html: `<p>${inline(row[2] ?? '')}</p>`, text: plain(row[2] ?? '') }); continue; }
    }
    if (eachAbility) for (const n of [eachAbility, ...descendants(eachAbility)]) {
      const lead = leads(own(n)).find((x) => x.name === name);
      if (!lead) continue;
      const i = n.chapter.blocks.indexOf(lead.block);
      const next = n.chapter.blocks[i + 1];
      const extra = next && (next.k === 'ul') ? html([next]) : '';
      E.add('skill', name, { ability }, n, { html: `<p>${inline(lead.text)}</p>${extra}`, text: short(lead.text) });
      break;
    }
  }

  // Creature types: "**Aberrations** are …" in the monsters' introduction.
  const typeNode = find(all, (n) => /Monster/.test(n.chapter.title) && /^(Creature )?Type$/.test(n.name) && own(n).some((b) => b.k === 'ul'));
  for (const b of typeNode ? own(typeNode) : []) if (b.k === 'ul') for (const it of b.items) {
    const r = /^\*\*(\w+)\*\* (.*)$/.exec(it.text);
    if (!r) continue;
    const name = r[1] === 'Fey' || r[1] === 'Undead' ? r[1] : r[1].replace(/ies$/, 'y').replace(/s$/, '');
    E.add('creature-type', name, {}, typeNode!, { html: `<p>${inline(it.text)}</p>`, text: short(plain(it.text)) });
  }

  // Feats.
  const featNodes = v24
    ? (find(all, (n) => n.name === 'Feat Descriptions')?.children ?? []).filter((c) => / Feats$/.test(c.name)).flatMap((c) => c.children.map((f) => [f, c.name.replace(/ Feats$/, '')] as const))
    : (chap('Feats')?.root.children ?? []).filter((c) => c.name !== 'Feats').map((f) => [f, undefined] as const);
  for (const [n, category] of featNodes) {
    const l = firstLine(n) ?? '';
    const pre = /Prerequisite:?\s*([^)_]+)/.exec(l)?.[1]?.trim();
    E.add('feat', n.name, { ...(category ? { category } : {}), ...(pre ? { prerequisite: pre } : {}) }, n, { node: n });
  }

  // Classes and their features.
  const classes = chap('Classes')!.root.children;
  for (const c of classes) {
    const core = c.children.find((x) => /^Core .* Traits$/.test(x.name));
    const tableRow = (k: string) => core && own(core).flatMap((b) => (b.k === 'table' ? [b.head, ...b.rows] : [])).find((r) => plain(r[0]) === k)?.[1];
    const f = fields(c.children.flatMap((x) => (/^Class Features$/.test(x.name) ? x.children.flatMap(own) : [])));
    const hitDie = tableRow('Hit Point Die') ?? f.get('hit dice');
    const s = { ...(hitDie ? { hitDie: plain(hitDie) } : {}), ...(tableRow('Primary Ability') ? { primaryAbility: plain(tableRow('Primary Ability')!) } : {}), ...((tableRow('Saving Throw Proficiencies') ?? f.get('saving throws')) ? { saves: plain(tableRow('Saving Throw Proficiencies') ?? f.get('saving throws')!) } : {}) };
    const intro = own(c), first = c.children[0];
    E.add('class', c.name, s, c, { node: c, wrap: false, html: html([...intro, ...(first ? [first.h, ...body(first)] : [])]), text: firstProse(intro) || firstProse(first ? body(first) : []) });
    for (const x of descendants(c)) {
      let name = x.name, level: number | undefined, subclass: string | undefined, feature: string | undefined;
      if (v24) {
        const m = /^Level (\d+): (.+)$/.exec(x.name);
        if (!m) continue;
        level = +m[1]; name = m[2];
        subclass = /Subclass: (.+)$/.exec(x.parent?.name ?? '')?.[1];
      } else {
        // 2014: the class's own features are the headings of 'The <Class>' (Rage, Wild Shape, Ki …), each an entry even
        // when it has parts of its own (Wild Shape's Beast Shapes, Ki's Flurry of Blows, the Fighting Styles), and
        // those parts are entries too, under their feature. The other sections list the subclasses (Primal Paths →
        // Path of the Berserker) or options (Eldritch Invocations); what is under a subclass is that subclass's.
        if (x.level < c.level + 2) continue;
        if (x.parent && /^Class Features$/.test(x.parent.name)) continue;
        if (/^(Hit Points|Proficiencies|Equipment|Quick Build|Spellcasting Ability|Cantrips|Spell Slots|Spells Known.*|Ritual Casting|Spellcasting Focus|Preparing and Casting Spells|Learning Spells.*|Your Spellbook)$/.test(x.name)) continue;
        const section = ancestors(x).find((a) => a.parent === c) ?? x;
        const core = section.name === `The ${c.name}`;
        const top = ancestors(x).find((a) => a.parent === section); // the feature, subclass or option it belongs to
        if (core) { if (top) feature = top.name; }
        else if (x.children.length && x.level === c.level + 2) continue; // a subclass itself: its parts are the entries
        else if (top) subclass = top.name;
        // Circle of the Land's terrain lists: 'Circle Spells (Arctic)' of the Circle of the Land.
        if (x.parent?.name === 'Circle Spells' && x.parent.parent) { name = `Circle Spells (${x.name})`; subclass = x.parent.parent.name; }
      }
      if (/Subclass$|^Ability Score Improvement$|^Epic Boon$|^Subclass Feature$/i.test(name)) continue;
      E.add('feature', name, { className: c.name, ...(level ? { level } : {}), ...(subclass ? { subclass } : {}), ...(feature ? { feature } : {}) }, x, { node: x, disamb: c.name });
    }
  }

  // Species (2024) or races (2014), and backgrounds.
  const species = v24 ? find(all, (n) => n.name === 'Species Descriptions')?.children ?? [] : (chap('Races')?.root.children ?? []).filter((c) => c.name !== 'Racial Traits');
  for (const n of species) E.add('species', n.name, {}, n, { node: n });
  const bgs = v24 ? find(all, (n) => n.name === 'Background Descriptions')?.children ?? [] : all.filter((n) => n.chapter.title === 'Character Options' && n.name === 'Acolyte');
  for (const n of bgs) E.add('background', n.name, {}, n, { node: n });

  // Rules whose name several sections share: the configured section answers (it is added first, so it wins).
  for (const r of cfg.ruleSources ?? []) {
    const want = r.path.split(' / ');
    const hits = all.filter((n) => { const chain = [n, ...ancestors(n)].map((a) => a.name); return want.every((w, i) => chain[want.length - 1 - i] === w); });
    if (hits.length !== 1) throw new Error(`${cfg.id}: rule source '${r.name}': ${hits.length} sections match '${r.path}'`);
    const n = hits[0];
    if (!r.lead) { E.add('rule', r.name, {}, n, { node: n }); continue; }
    const x = leads(own(n)).find((l) => l.name === r.lead);
    if (!x) throw new Error(`${cfg.id}: rule source '${r.name}': no lead-in '${r.lead}' in '${r.path}'`);
    E.add('rule', r.name, {}, n, { html: `<p>${inline(x.text)}</p>`, text: short(x.text) });
  }

  // 2014 rules (it has no glossary): the headings of the rules chapters. 2024 adds the Gameplay Toolbox's.
  const ruleChapters = v24 ? ['Gameplay Toolbox'] : ['Using Ability Scores', 'Adventuring', 'Combat', 'Spellcasting', 'Traps, Diseases, Madness, Objects and Poisons'];
  const SKIP = /^(Variant|The |Your |Using |Making |Actions in Combat$|Combat Step by Step|Example|Sample |Spell Lists|.* Spells$|Cantrips \(|\d|Step \d|Beyond 1st|Rules Glossary|Gameplay Toolbox|Adventuring$|Combat$|Spellcasting$|Traps, Diseases)/;
  for (const title of ruleChapters) for (const n of chap(title)?.nodes ?? []) {
    if (n === n.chapter.root || SKIP.test(n.name) || ABILITIES.some(([a]) => a === n.name)) continue;
    const tag = n.parent?.name === 'Actions in Combat' ? 'Action' : undefined;
    E.add('rule', n.name, tag ? { tag } : {}, n, { node: n });
  }
  // 2014 rules that live outside the rules chapters, under the names the 2024 glossary gives them.
  if (!v24) {
    for (const [ch, name] of [['Character Options', 'Inspiration'], ['Character Options', 'Alignment'], ['Magic Items', 'Attunement']] as const) {
      const n = chap(ch)?.nodes.find((x) => x.name === name);
      if (n) E.add('rule', name, {}, n, { node: n });
    }
  }
  // 2014 actions under their 2024 names, so ids line up across editions.
  if (!v24) { const u = E.byId.get('rule:use-an-object'); if (u) u.extra.push('utilize', 'utilize action'); }

  // Mundane equipment from the equipment tables (and its descriptions where the chapter has them).
  const eq = chap('Equipment')!;
  const descs = new Map<string, { node: Node; blocks: Block[]; text: string }>();
  for (const n of eq.nodes) {
    if (!descs.has(normName(n.name))) descs.set(normName(n.name.replace(/\s*\(.*\)$/, '')), { node: n, blocks: body(n), text: firstProse(body(n)) });
    for (const x of leads(own(n))) if (!descs.has(normName(x.name))) descs.set(normName(x.name), { node: n, blocks: [x.block], text: short(x.text) });
  }
  let cur: Node = eq.root;
  const groupsSeen = new Set<string>();
  eq.blocks.forEach((b) => {
    const hn = b.k === 'h' ? eq.nodes.find((x) => x.h === b) : undefined;
    if (hn) { cur = hn; return; }
    if (b.k !== 'table') return;
    const H = b.head.map((h) => plain(h));
    const col = (re: RegExp) => H.findIndex((h, i) => i > 0 && re.test(h));
    const costC = col(/^(Cost|Price)$/i);
    // Price lists (spellcasting services, scroll costs by spell level) and lifestyles are not items.
    if (costC < 0 || /^(Cost|Lifestyle|Service|Coin|Spell Level)/i.test(H[0])) return;
    const lifestyle = /^(Inn Stay|Meal)/i.test(H[0]) ? H[0].replace(/\s+per\s+Day$/i, '') : '';
    const path = [cur, ...ancestors(cur)].map((x) => x.name).join(' / ') + ' / ' + H[0];
    const category = /Weapon/.test(path) ? 'Weapon' : /Armor/.test(path) ? 'Armor' : /Tool|Artisan|Gaming|Musical/.test(path) ? 'Tool'
      : /Mount|Vehicle|Saddle|Tack|Waterborne|Drawn/.test(path) ? 'Mount or vehicle' : /Food|Drink|Lodging/.test(path) ? 'Food, drink and lodging' : /Gear/.test(path) ? 'Adventuring gear' : cur.name;
    let sub = /^(Item|Tools|Name|Armor|Weapons?|Type)$/i.test(H[0]) || !H[0] ? undefined : H[0].replace(/\s*\(.*\)$/, '');
    // Rows that are kinds of one thing ('Saddles': Exotic, Military …) are named after it: 'Saddle, Exotic'.
    const group = cfg.groupedRows?.[H[0]];
    if (group) groupsSeen.add(H[0]);
    for (const r of b.rows) {
      const cells = r.map((c) => plain(c));
      if (!cells[0]) continue;
      if (cells.slice(1).every((c) => !c)) { sub = cells[0]; continue; }
      let name = cells[0], rsub = sub;
      if (/^(\d[\d,]*(?:[-–]\d+)?(?:st|nd|rd|th)?|Cantrip)$/i.test(name)) continue; // a price row, not an item
      if (/^\*$/.test(cells[costC])) continue; // unpriced: 'Vehicles (land or water)' is a proficiency, not an item
      if (group) name = `${group}, ${name}`;
      if (lifestyle) name = `${lifestyle} (${name})`; // 'Inn Stay (Poor)', 'Meal (Poor)'
      const pre = /^_([^_:]+):?_:? (.+)$/.exec(r[0].trim());
      if (pre) { rsub = plain(pre[1]); name = plain(pre[2]); }
      // A lifestyle row of a grouped price ('Inn Stay (per day), Poor') is named like the 2024 rows: 'Inn Stay (Poor)'.
      name = name.replace(/^(.+?) \(per [^)]*\), (\w+)$/, '$1 ($2)');
      name = name.replace(/\s*\((?:\d[^)]*|vial|flask|bottle|pint|pot|bag of [^)]*|per [^)]*|[^)]*\bfeet\b[^)]*|one week|quiver of [^)]*)\)$/i, '').replace(/\s+per (?:day|person)$/i, '').trim();
      const get = (re: RegExp) => { const i = col(re); return i > 0 && cells[i] && cells[i] !== '—' ? cells[i] : undefined; };
      const s: ItemSummary = { category, magic: false, ...(rsub ? { subcategory: rsub } : {}) };
      const add = (k: keyof ItemSummary, v: string | undefined) => { if (v) (s as unknown as Record<string, string>)[k] = v; };
      add('cost', get(/^(Cost|Price)$/i)); add('weight', get(/^Weight$/i)); add('damage', get(/^Damage$/i)); add('properties', get(/^Properties$/i));
      add('mastery', get(/^Mastery$/i)); add('ac', get(/Armor Class/i)); add('strength', get(/^Strength$/i)); add('stealth', get(/^Stealth$/i));
      const d = descs.get(normName(name));
      const extra = category === 'Armor' && !/armor|mail|plate|shirt|breastplate|shield/i.test(name) ? [`${name} armor`] : [];
      E.add('item', name, s, d?.node ?? cur, { html: d ? html(d.blocks) : '', text: d?.text ?? '', merge: true, extra });
    }
  });
  for (const g of Object.keys(cfg.groupedRows ?? {})) if (!groupsSeen.has(g)) throw new Error(`${cfg.id}: grouped rows: no equipment table headed '${g}'`);

  // Tools described one by one (2024: '#### Thieves' Tools' with Cost, Ability, Weight, Utilize, Craft and Variants).
  for (const n of eq.nodes) {
    const f = fields(own(n));
    if (!f.has('cost') || !f.has('ability') || !f.has('utilize')) continue;
    const s: ItemSummary = { category: 'Tool', magic: false, ...(n.parent && n.parent !== eq.root && n.parent.name !== 'Tools' ? { subcategory: n.parent.name } : {}) };
    const add = (k: keyof ItemSummary, v: string | undefined) => { if (v && v !== '—') (s as unknown as Record<string, string>)[k] = v; };
    add('cost', f.get('cost')); add('weight', f.get('weight')); add('ability', f.get('ability')); add('utilize', f.get('utilize')); add('craft', f.get('craft')); add('variants', f.get('variants'));
    // Each variant is found by its own name too: 'lute' is a Musical Instrument, 'playing cards' a Gaming Set.
    const extra = (f.get('variants') ?? '').split(/,\s*(?![^()]*\))/).map((v) => v.replace(/\s*\(.*\)$/, '').trim()).filter(Boolean);
    E.add('item', n.name, s, n, { node: n, text: short(`${f.get('ability')}. Utilize: ${f.get('utilize')}${f.get('craft') ? `. Craft: ${f.get('craft')}` : ''}.`), extra });
  }
  // Gear that has a table row and no description still gets a tooltip line: 'Weapon (Martial Melee): 1d8 slashing …'.
  for (const e of E.list) if (e.type === 'item' && !e.text) e.text = itemLine(e.s as ItemSummary);
  return E;
}

function ancestors(n: Node): Node[] { const out: Node[] = []; for (let p = n.parent; p; p = p.parent) out.push(p); return out; }

// ---------------------------------------------------------------- anchors, pages, index

function assignAnchors(chapters: Chapter[], E: Entries): Map<Block, string> {
  const used = new Set<string>();
  const claim = (n: Node, a: string) => { n.anchor = a; used.add(a); };
  for (const c of chapters) claim(c.root, c.id);
  for (const e of E.list) if (e.node && !e.node.anchor) claim(e.node, e.id.replace(':', '-'));
  for (const c of chapters) for (const n of c.nodes) {
    if (n.anchor) continue;
    let a = slug(n.title);
    for (let p = n.parent; used.has(a) && p; p = p.parent) a = `${p.anchor}-${slug(n.title)}`;
    for (let k = 2; used.has(a); k++) a = `${slug(n.title)}-${k}`;
    claim(n, a);
  }
  for (const e of E.list) e.anchor = (e.node ?? e.at).anchor;
  // Titled tables get anchors too, so search can land on 'Travel Pace' or 'XP Budget per Character'.
  const tables = new Map<Block, string>();
  for (const c of chapters) for (const b of c.blocks) {
    if (b.k !== 'table' || !b.caption) continue;
    let a = `table-${slug(b.caption)}`;
    for (let k = 2; used.has(a); k++) a = `table-${slug(b.caption)}-${k}`;
    used.add(a); tables.set(b, a);
  }
  return tables;
}

interface Page { id: string; title: string; chapter: Chapter; blocks: Block[]; html: string }

function pagesOf(c: Chapter, E: Entries, tableAnchors: Map<Block, string>): Page[] {
  const before = new Map<Block, string>(), after = new Map<Block, string>(), anchors = new Map<Block, string>(tableAnchors);
  const inside = new Set<Block>(); // headings strictly inside a wrapped entry: never a page break
  for (const n of c.nodes) anchors.set(n.h, n.anchor);
  for (const e of E.list) {
    const n = e.node;
    if (!e.wrap || !n || n.chapter !== c) continue;
    before.set(n.h, (before.get(n.h) ?? '') + `<section class="entry t-${e.type}" data-id="${e.id}">`);
    const last = c.blocks[n.end - 1];
    after.set(last, '</section>' + (after.get(last) ?? ''));
    for (let i = n.start + 1; i < n.end; i++) inside.add(c.blocks[i]);
  }
  const render = (bs: Block[]) => renderBlocks(bs, { anchors, before, after });
  const whole = render(c.blocks);
  if (whole.length <= PAGE_TARGET) return [{ id: c.id, title: c.title, chapter: c, blocks: c.blocks, html: whole }];

  // Split at h2, then (for oversized pieces) at h3; never inside an entry.
  const cutAt = (bs: Block[], level: number) => {
    const parts: Block[][] = [[]];
    for (const b of bs) { if (b.k === 'h' && b.level === level && !inside.has(b) && parts[parts.length - 1].length) parts.push([]); parts[parts.length - 1].push(b); }
    return parts;
  };
  const pieces: { blocks: Block[]; title: string }[] = [];
  const headOf = (bs: Block[]) => { const h = bs.find((b) => b.k === 'h') as H | undefined; return h ? plain(h.text) : c.title; };
  for (const p of cutAt(c.blocks, 2)) {
    if (render(p).length <= PAGE_TARGET) { pieces.push({ blocks: p, title: headOf(p) }); continue; }
    const subs = cutAt(p, 3);
    const parent = headOf(p);
    subs.forEach((s, i) => pieces.push({ blocks: s, title: i === 0 ? parent : `${parent}: ${headOf(s)}` }));
  }
  // Pack consecutive pieces up to the target; a small first or last piece may stretch a page by 30 % rather than stand alone.
  const pages: { blocks: Block[]; titles: string[] }[] = [];
  const sizes = pieces.map((p) => render(p.blocks).length);
  let size = Infinity;
  pieces.forEach((p, k) => {
    const n = sizes[k];
    const stretch = size + n <= PAGE_TARGET * 1.3 && (size < PAGE_TARGET * 0.2 || (k === pieces.length - 1 && n < PAGE_TARGET * 0.2));
    if (size + n > PAGE_TARGET && !stretch) { pages.push({ blocks: [], titles: [] }); size = 0; }
    const pg = pages[pages.length - 1];
    pg.blocks.push(...p.blocks); pg.titles.push(p.title); size += n;
  });
  // A short tail joins the page before it.
  if (pages.length > 1 && size < PAGE_TARGET * 0.2 && render(pages[pages.length - 2].blocks).length + size <= PAGE_TARGET * 1.3) {
    const tail = pages.pop()!;
    pages[pages.length - 1].blocks.push(...tail.blocks); pages[pages.length - 1].titles.push(...tail.titles);
  }
  const span = (a: string, b: string) => {
    if (a === b) return a;
    const pa = /^(.*?): (.*)$/.exec(a), pb = /^(.*?): (.*)$/.exec(b);
    return pa && pb && pa[1] === pb[1] ? `${pa[1]}: ${pa[2]} – ${pb[2]}` : `${a} – ${b}`;
  };
  return pages.map((p, i) => {
    const rest = i === 0 ? p.titles.slice(1) : p.titles;
    const title = i === 0 ? c.title + (pages.length > 1 && rest.length ? ` (${span(rest[0], rest[rest.length - 1])})` : '') : span(rest[0], rest[rest.length - 1]);
    return { id: pages.length === 1 ? c.id : `${c.id}--${i + 1}`, title, chapter: c, blocks: p.blocks, html: render(p.blocks) };
  });
}

// ---------------------------------------------------------------- term index

const PRIORITY: EntryType[] = ['condition', 'rule', 'spell', 'monster', 'item', 'damage', 'skill', 'ability', 'creature-type', 'feat', 'feature', 'class', 'species', 'background'];

/** Names that are ordinary English words whatever their frequency in the book. */
const ALWAYS_COMMON = new Set(('light shield command guidance fly help hide search ready dodge attack magic study influence utilize dash disengage ' +
  'sleep alarm bane bless blur confusion darkness daylight fear haste heal harm jump knock mending message slow wish friends gate sanctuary ' +
  'silence banishment contagion counterspell sending shatter suggestion thunderwave web wall entangle goodberry identify longstrider resistance ' +
  'acid cold fire force lightning necrotic piercing poison psychic radiant slashing thunder bludgeoning nature history religion medicine performance ' +
  'survival insight deception persuasion intimidation investigation perception stealth arcana athletics acrobatics ' +
  'blinded charmed deafened exhaustion frightened grappled incapacitated invisible paralyzed petrified poisoned prone restrained stunned unconscious ' +
  'beast beasts dragon dragons giant giants plant plants undead fiend fiends fey construct constructs ooze oozes celestial elemental humanoid monstrosity aberration ' +
  'action reaction speed reach size target object creature monster spell weapon armor initiative cover dead stable surprise ' +
  'strength dexterity constitution intelligence wisdom charisma net mule cat deer rope torch lamp book bell chain lock ' +
  'magic study influence search hide grapple shove inspiration advantage disadvantage resistance immunity vulnerability ' +
  'poor modest comfortable wealthy squalid wretched aristocratic ' +
  'hammer leather feed pack riding military exotic saddle dice drum flute horn lute lyre viol shawm bagpipes dulcimer').split(/\s+/));

function plural(w: string): string {
  const irregular: Record<string, string> = { wolf: 'wolves', werewolf: 'werewolves', elf: 'elves', dwarf: 'dwarves', thief: 'thieves', knife: 'knives', man: 'men', woman: 'women', mouse: 'mice', foot: 'feet', tooth: 'teeth', ox: 'oxen', fungus: 'fungi', efreeti: 'efreet', djinni: 'djinn', fish: 'fish', sheep: 'sheep', deer: 'deer', undead: 'undead', fey: 'fey', swarm: 'swarms' };
  const lw = w.toLowerCase();
  if (irregular[lw]) return irregular[lw];
  if (/[^aeiou]y$/.test(lw)) return lw.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(lw)) return lw + 'es';
  return lw + 's';
}

export const normForm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

function formsOf(e: Entry): string[] {
  const n = normForm(e.name), out = new Set<string>([n]);
  const bare = n.replace(/\s*\([^)]*\)\s*$/, '').trim(); out.add(bare);
  const inv = /^([^,]+), ([^,+]+)$/.exec(bare); if (inv && e.type === 'item') { out.add(`${inv[2]} ${inv[1]}`); out.add(inv[1]); }
  // 'Wand of the War Mage, +1, +2, or +3' is also 'wand of the war mage', '+1 wand of the war mage', 'wand of the war mage +2'.
  const plus = /^(.+), \+1, \+2, or \+3$/.exec(bare);
  if (plus && e.type === 'item') { out.add(plus[1]); for (const k of [1, 2, 3]) { out.add(`+${k} ${plus[1]}`); out.add(`${plus[1]} +${k}`); } }
  const words = bare.split(' ');
  if (e.type === 'item' && words[1] === 'of' && /s$/.test(words[0])) out.add([words[0].replace(/ies$/, 'y').replace(/s$/, ''), ...words.slice(1)].join(' '));
  if (['monster', 'item', 'creature-type', 'species', 'class', 'feat'].includes(e.type) && !/[,+]/.test(bare)) {
    const of = words.indexOf('of');
    if (of > 0) out.add([...words.slice(0, of - 1), plural(words[of - 1]), ...words.slice(of)].join(' '));
    else out.add([...words.slice(0, -1), plural(words[words.length - 1])].join(' '));
  }
  if (e.type === 'rule' && !/[,()]/.test(bare)) {
    // Both numbers of a rule's name: 'Reactions' answers 'reaction', 'Reaction' answers 'reactions'.
    if (/[^su]s$/.test(bare) && !/(ss|us|is)$/.test(bare)) out.add(bare.replace(/s$/, ''));
    else if (/die$/.test(bare)) out.add(bare.replace(/die$/, 'dice'));
    else if (!/(ing|ness|ed|s|light|magic|water|food|time|movement|space|cover|surprise)$/.test(bare)) out.add([...words.slice(0, -1), plural(words[words.length - 1])].join(' '));
  }
  for (const x of e.extra) out.add(normForm(x));
  out.delete('');
  return [...out];
}

function lowerNgrams(md: string, maxN = 3): Map<string, number> {
  // Prose only: headings and italic/bold references (spell and item names in 2014 text) are not ordinary usage.
  const text = md.split('\n').filter((l) => !/^#/.test(l)).join('\n')
    .replace(/_\*\*[^*]+\*\*_/g, ' . ').replace(/\*\*[^*]+\*\*/g, ' . ').replace(/(^|[^\w])_[^_\n]+_(?!\w)/g, '$1 . ');
  const counts = new Map<string, number>();
  for (const chunk of text.split(/[.,;:!?()\[\]|"“”\n—–]+/)) {
    const w = chunk.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
    for (let i = 0; i < w.length; i++) for (let n = 1; n <= maxN && i + n <= w.length; n++) {
      const g = w.slice(i, i + n);
      if (!g.every((x) => /^[a-z]/.test(x))) break;
      const k = normForm(g.join(' '));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
}

function termIndex(cfg: BookConfig, E: Entries, md: string): TermFile {
  const allForms = new Map(E.list.map((e) => [e, formsOf(e)]));
  // Weapon and mastery properties (Light, Reach, Push …) rank below spells and items of the same name.
  const rank = (e: Entry) => (e.type === 'rule' && /Property$/.test((e.s as { tag?: string }).tag ?? '') ? PRIORITY.indexOf('item') + 0.5 : PRIORITY.indexOf(e.type));
  const order = [...E.list].sort((a, b) => rank(a) - rank(b));
  const idx = new Map(E.list.map((e, i) => [e, i]));
  const forms: Record<string, number[]> = {};
  const add = (f: string, e: Entry) => { const l = (forms[f] ??= []); const i = idx.get(e)!; if (!l.includes(i)) l.push(i); };
  // Aliases first: they are deliberate ('grapple' is the Grappling rule, 'goblin' the 2024 Goblin Warrior).
  const aliased = new Map<string, number>();
  const alias = (f: string, e: Entry) => { const k = normForm(f); (forms[k] ??= []).unshift(idx.get(e)!); aliased.set(k, idx.get(e)!); };
  for (const [a, id] of Object.entries(cfg.aliases)) {
    const e = E.byId.get(id);
    if (!e) throw new Error(`${cfg.id}: alias '${a}' names a missing entry ${id}`);
    alias(a, e);
    // A creature's alias answers for a group too: 'thugs' like 'thug'.
    if (e.type === 'monster' && !/s$/.test(a)) { const w = a.split(' '); alias([...w.slice(0, -1), plural(w[w.length - 1])].join(' '), e); }
  }
  for (const e of order) for (const f of allForms.get(e)!) add(f, e);
  // Within a kind, an entry named exactly so comes before one that only answers to the form ('shield' is the Shield
  // before 'Shield, +1, +2, or +3'); the aliases stay first.
  const named = (i: number, f: string) => (normForm(E.list[i].name).replace(/\s*\([^)]*\)\s*$/, '') === f ? 0 : 1);
  for (const [f, l] of Object.entries(forms)) {
    const head = aliased.has(f) ? l.filter((i) => i === aliased.get(f)) : [];
    const rest = l.filter((i) => !head.includes(i));
    const pos = new Map(rest.map((i, k) => [i, k]));
    rest.sort((a, b) => rank(E.list[a]) - rank(E.list[b]) || named(a, f) - named(b, f) || pos.get(a)! - pos.get(b)!);
    forms[f] = [...head, ...rest];
  }
  const abbr: Record<string, number[]> = {};
  const addAbbr = (a: string, id: string) => { const e = E.byId.get(id); if (e) (abbr[a] ??= []).push(idx.get(e)!); };
  for (const [name, ab] of ABILITIES) { const id = `ability:${slug(name)}`; addAbbr(ab, id); addAbbr(`${ab}.`, id); addAbbr(ab.toUpperCase(), id); }
  for (const [a, id] of [['AC', 'rule:armor-class'], ['HP', 'rule:hit-points'], ['DC', 'rule:difficulty-class'], ['CR', 'rule:challenge-rating'], ['XP', 'rule:experience-points'], ['PB', 'rule:proficiency'], ['PB', 'rule:proficiency-bonus']] as const) addAbbr(a, id);
  const counts = lowerNgrams(md);
  const isCommon = (f: string) => ALWAYS_COMMON.has(f) || (counts.get(f) ?? 0) >= 3;
  const common = new Set(Object.keys(forms).filter(isCommon));
  // A piece of mundane gear named in one word (Hammer, Rope, Saddle, Feed) is an ordinary noun in running text.
  for (const [e, fs] of allForms) if (e.type === 'item' && !(e.s as ItemSummary).magic) for (const f of fs) if (/^[a-z'-]+$/.test(f)) common.add(f);
  // An inflected form of a common word is common too: 'hides' like 'hide', 'nets' like 'net'.
  for (const [e, fs] of allForms) {
    const base = normForm(e.name).replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!isCommon(base)) continue;
    const n = base.split(' ').length;
    for (const f of fs) if (f.split(' ').length === n) common.add(f);
  }
  const sortedForms: Record<string, number[]> = {};
  for (const k of Object.keys(forms).sort()) sortedForms[k] = forms[k];
  const sortedAbbr: Record<string, number[]> = {};
  for (const k of Object.keys(abbr).sort()) sortedAbbr[k] = abbr[k];
  return { book: cfg.id, edition: cfg.edition, attribution: cfg.attribution, changes: cfg.changes, entries: E.list.map((e) => [e.id, e.name, e.type]), forms: sortedForms, abbr: sortedAbbr, common: [...common].sort() };
}

// ---------------------------------------------------------------- the whole book

export interface BuiltBook {
  index: BookIndex;
  files: Map<string, string>; // path inside the book directory → file contents
  entries: Entry[];
  chapters: Chapter[];
}

const json = (v: unknown) => JSON.stringify(v) + '\n';

export function convertBook(cfg: BookConfig, source: string, sources: Source[], titles: PdfTitle[] = []): BuiltBook {
  const { md } = prepare(cfg, source);
  const chapters = chaptersOf(cfg, md, titles);
  const E = recognise(cfg, chapters);
  const tableAnchors = assignAnchors(chapters, E);
  const files = new Map<string, string>();
  const base = { book: cfg.id, attribution: cfg.attribution, changes: cfg.changes };

  const pages = chapters.flatMap((c) => pagesOf(c, E, tableAnchors));
  const pageOf = new Map<Node, number>();
  pages.forEach((p, i) => { for (const b of p.blocks) if (b.k === 'h') { const n = p.chapter.nodes.find((x) => x.h === b); if (n) pageOf.set(n, i); } });
  const typeOf = new Map<Node, EntryType>();
  for (const e of E.list) if (e.node) typeOf.set(e.node, e.type);

  const pageMeta: BookIndex['pages'] = [];
  pages.forEach((p, i) => {
    const file: PageFile = { ...base, id: p.id, title: p.title, chapter: p.chapter.id, html: p.html };
    const s = json(file);
    files.set(`p/${p.id}.json`, s);
    pageMeta.push({ id: p.id, title: p.title, chapter: p.chapter.idx, bytes: Buffer.byteLength(s) });
    void i;
  });

  const groups = new Map<string, Record<string, StoredEntry>>();
  for (const e of E.list) {
    const g = ENTRY_FILE[e.type];
    const rec = groups.get(g) ?? {};
    rec[e.id] = { id: e.id, type: e.type, name: e.name, s: e.s, text: e.text, html: e.html, anchor: e.anchor };
    groups.set(g, rec);
  }
  for (const g of ['spells', 'monsters', 'items', 'rules', 'character']) {
    const f: EntryFile = { ...base, entries: groups.get(g) ?? {} };
    files.set(`e/${g}.json`, json(f));
  }
  files.set('terms.json', json(termIndex(cfg, E, md)));
  files.set('ATTRIBUTION.md', attributionMd(cfg, sources));

  // Every heading, and every titled table (level 6, so search finds it and the contents list does not).
  const sections: BookIndex['sections'] = [];
  const pageOfBlock = new Map<Block, number>();
  pages.forEach((p, i) => { for (const b of p.blocks) pageOfBlock.set(b, i); });
  for (const c of chapters) {
    const byH = new Map(c.nodes.map((n) => [n.h as Block, n]));
    for (const b of c.blocks) {
      const n = byH.get(b);
      if (n) sections.push([n.anchor, n.title, n.level, pageOf.get(n) ?? 0, typeOf.get(n) ?? '']);
      else if (b.k === 'table' && b.caption && tableAnchors.has(b)) sections.push([tableAnchors.get(b)!, plain(b.caption), 6, pageOfBlock.get(b) ?? 0, '']);
    }
  }

  const index: BookIndex = {
    id: cfg.id, title: cfg.title, short: cfg.short, edition: cfg.edition, editionLabel: cfg.editionLabel, version: cfg.version,
    license: LICENSE, attribution: cfg.attribution, attributionNote: cfg.attributionNote, disclaimer: DISCLAIMER, changes: cfg.changes,
    sources: sources.filter((s) => s.id === cfg.markdown || s.id === cfg.pdf),
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, pages: pages.flatMap((p, i) => (p.chapter === c ? [i] : [])) })),
    pages: pageMeta, sections, files: [], bytes: 0,
  };
  const names = ['index.json', ...[...files.keys()].sort()];
  index.files = names;
  // Size of everything (the index's own size is measured with the final list in place).
  let bytes = [...files.values()].reduce((a, s) => a + Buffer.byteLength(s), 0);
  index.bytes = bytes;
  bytes += Buffer.byteLength(json(index));
  index.bytes = bytes;
  files.set('index.json', json(index));
  return { index, files, entries: E.list, chapters };
}

function attributionMd(cfg: BookConfig, sources: Source[]): string {
  const used = sources.filter((s) => s.id === cfg.markdown || s.id === cfg.pdf);
  return [
    `# ${cfg.title} (${cfg.editionLabel})`, '',
    'This directory holds rules text from the System Reference Document, shipped under the Creative Commons Attribution 4.0 International licence.', '',
    '## Attribution', '', cfg.attribution, '',
    '## Changes', '', cfg.changes, '',
    '## Licence', '', `${LICENSE.name}: ${LICENSE.url}`, '', DISCLAIMER, '',
    '## Sources', '', ...used.map((s) => `- ${s.name}\n  ${s.url}\n  SHA-256 ${s.sha256}, retrieved ${s.retrieved}`), '',
    'Regenerate with `npm run books` (see docs/BOOKS.md).', '',
  ].join('\n');
}

export { blocksText };
export type { ListBlock };
