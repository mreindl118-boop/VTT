// Rules links in module text (docs/CLARITY.md 'Rules tooltip pass'): which words of a room, object, pin or creature
// text open a rules card, and the HTML that links them. One pipeline, in this order:
//   1. overrides (app/src/books/term-overrides.json): force-link, suppress or relabel one occurrence;
//   2. structural sources, DM only: 'DC 15 Dex (thieves' tools)' checks, '2d6 + 3' dice, key references '(X26)',
//      and the creature a hidden-creature slot holds;
//   3. the gazetteer of places and people (manifests, world pins, the scene's rooms): a rules word inside a name never
//      links ('Order of the Silver Dragon', 'Werewolf Den'); on the DM side the whole name links to its area or person;
//   4. the books' term matcher (books/lookup.ts findTerms), then the ordinary-word guard: a word that is also ordinary
//      English links only with a cue ('scroll of', 'DC 15', 'save', 'fire damage', 'casts', 'n×'), and never for players;
//   5. the audience filter: the players' side keeps only PLAYER_KINDS (conditions, rules, actions, senses, damage
//      types, abilities and skills) and never sees a structural or gazetteer link.
// Nothing here edits module data and nothing matches inside HTML: spans are offsets into the plain string, and
// renderSpans escapes every slice.
import { findTerms, normTerm, rulesEdition, termIndex, type TermSpan } from '../books/lookup';
import { loadEntries } from '../books/store';
import { BOOK_OF, type Edition, type EntryType, type TermFile } from '../books/types';
import characters from '../../../manifests/characters.json';
import { CAMPAIGNS, campaignOf, manifestOf, worldOf } from '../campaigns';
import type { SceneFile, SceneObject } from '../core/schema';
import OVERRIDES from '../books/term-overrides.json';
import { kindInfo, PLAYER_KINDS, SENSE_IDS, type RuleKind } from './kinds';
import { esc } from './text';

export type Audience = 'player' | 'dm';
/** Why a span links: a tag, the name itself, a cue, a structural source, the gazetteer, or an override. */
export type SpanVia = 'tag' | 'name' | 'cue' | 'structural' | 'gazetteer' | 'override';

export interface CheckData { dc: number; ability?: string; skill?: string; save?: boolean }
export interface DiceData { expr: string; avg: number; max: number }
export interface AreaData { key?: string; name: string; scene?: string; floor?: string; desc?: string }
export interface PersonData { name: string; role?: string; home?: string }

export interface Span {
  start: number; end: number;
  /** The text the span covers (module text: our own words). */
  text: string;
  kind: RuleKind;
  /** The books id ('spell:bless'), or a module id ('area:appB/death-house#21', 'person:rose-durst', 'creature:mongrelfolk',
   *  'check:dc15-dex-thieves-tools', 'dice:2d6+3'). */
  id?: string;
  /** What the card is called: the entry's name, or a normalised label ('DC 15 · DEX (Thieves' Tools)'). */
  label: string;
  via: SpanVia;
  /** The rule that fired, for the review list ('cue: scroll of', 'gazetteer: place', 'count', 'name'). */
  why: string;
  check?: CheckData; dice?: DiceData; area?: AreaData; person?: PersonData;
}

export interface SpanCtx {
  audience: Audience;
  edition: Edition;
  /** The field the text comes from: 'desc', 'dm', 'label', 'playerLabel', 'contents', 'seenAs', 'blurb' … */
  field: string;
  /** 'appB/death-house', 'ch02/barovia-region' (a world), or 'bestiary'. */
  scenePath?: string;
  /** 'room:f1/2A', an object id, 'pin:K', 'creature:ghoul'. */
  entityId?: string;
  /** A token's creature (its card and links come from it). */
  creatureId?: string;
}

// ---- loading

const terms = new Map<Edition, TermFile>();
/** Item and rule kinds that need the entry's summary (magic item or gear; an action), once the entry files are in. */
const refined = new Map<Edition, Map<string, RuleKind>>();

/** Load what spansFor needs: the term index of both editions (books data, cached for offline). Until it resolves,
 *  spansFor returns no books links and text renders plain. */
export async function ready(edition: Edition): Promise<void> {
  const eds: Edition[] = [edition, edition === '2024' ? '2014' : '2024'];
  await Promise.all(eds.map(async (e) => { if (!terms.has(e)) terms.set(e, await termIndex(e)); }));
}

/** Also load the item and rules summaries of an edition, so magic items, gear and actions get their own kinds. The
 *  app starts it after `ready` without waiting; the review list and the tests wait for it. */
export async function readyKinds(edition: Edition): Promise<void> {
  if (refined.has(edition)) return;
  const book = BOOK_OF[edition];
  const [items, rules] = await Promise.all([loadEntries(book, 'items'), loadEntries(book, 'rules')]);
  const m = new Map<string, RuleKind>();
  for (const e of Object.values(items.entries)) m.set(e.id, (e.s as { magic?: boolean }).magic ? 'magic-item' : 'gear');
  for (const e of Object.values(rules.entries)) if (e.type === 'rule' && (e.s as { tag?: string }).tag === 'Action') m.set(e.id, 'action');
  refined.set(edition, m);
}

/** The DM window's preload: the open scene's rooms come from the app, the term files of both editions load now, and
 *  the item and rules summaries after them. */
export async function preload(source: (path: string) => SceneFile | undefined): Promise<void> {
  setSceneSource(source);
  const ed = rulesEdition();
  await ready(ed);
  await readyKinds(ed);
}

/** The kind a books entry links as. */
export function termKind(id: string, type: EntryType, edition: Edition): RuleKind {
  const r = refined.get(edition)?.get(id);
  if (r) return r;
  if (type === 'rule' && SENSE_IDS.includes(id)) return 'sense';
  return type;
}

// ---- scenes (rooms and objects by id, for key references, hidden creatures and overrides)

interface SceneInfo {
  path: string;
  rooms: Map<string, { key: string; name: string; level: string; desc?: string }>;
  objects: Map<string, SceneObject>;
}
const scenes = new Map<string, SceneInfo>();
const gazCache = new Map<string, GazName[]>();
const sceneFiles = new Map<string, SceneFile>();
let sceneSource: ((path: string) => SceneFile | undefined) | undefined;

/** Where the app's open scene comes from (the matcher reads its rooms and objects on first use). */
export function setSceneSource(f: (path: string) => SceneFile | undefined): void { sceneSource = f; }

/** The rooms and objects of a scene: registered, or the app's open one. */
function sceneInfo(path: string | undefined): SceneInfo | undefined {
  if (!path) return undefined;
  const s = sceneSource?.(path);
  if (s && sceneFiles.get(path) !== s) useScene(path, s);
  return scenes.get(path);
}

/** Tell the matcher about a scene (the review list does this for every scene; the app through setSceneSource). */
export function useScene(path: string, scene: SceneFile): void {
  sceneFiles.set(path, scene);
  const rooms = new Map<string, { key: string; name: string; level: string; desc?: string }>();
  const objects = new Map<string, SceneObject>();
  for (const l of scene.levels) {
    for (const r of l.rooms) if (!rooms.has(r.key)) rooms.set(r.key, { key: r.key, name: r.name, level: l.name, desc: r.desc });
    for (const o of l.objects) objects.set(o.id, o);
  }
  scenes.set(path, { path, rooms, objects });
  gazCache.delete(path);
}

// ---- overrides

export interface Override {
  scene: string; entity: string; field: string;
  /** The text the entry is about (module text), and which occurrence of it in the field (0 = the first). */
  match: string; occurrence?: number;
  action: 'link' | 'suppress' | 'label';
  kind?: RuleKind; id?: string; label?: string;
  reason: string;
}
export interface GazExtra { name: string; kind: 'area' | 'person'; campaign?: string; role?: string; reason: string }
export interface OverridesFile {
  note: string;
  overrides: Override[];
  /** Names the manifests do not hold (orders, planes, short names): they stay names, and link on the DM side. */
  gazetteer: GazExtra[];
  /** The review: per scene, the links that were read and are right ('kind:id' as the review list shows them). */
  accepted: Record<string, string[]>;
  /** Books names that the module's prose uses as plain words. */
  ordinary: string[];
  /** Books names the term files count as ordinary words that are not ordinary in module prose ('thunderwave'). */
  notOrdinary: string[];
  /** People's names that are also English words ('Rose', 'Thorn'): not a name at a sentence start before a lower-case word. */
  wordNames: string[];
}
export const overridesFile = OVERRIDES as unknown as OverridesFile;
/** Books names that are ordinary words in the module's prose too ('dark red sap', 'a commune', 'Weird Insight'): the
 *  guard treats them like the term files' own ordinary words. */
const ORDINARY = new Set(overridesFile.ordinary);
const NOT_ORDINARY = new Set(overridesFile.notOrdinary);

const nth = (text: string, needle: string, n: number): number => {
  let at = -1;
  for (let i = 0; i <= n; i++) { at = text.indexOf(needle, at + 1); if (at < 0) return -1; }
  return at;
};

// ---- the gazetteer

interface GazName { name: string; kind: 'area' | 'person'; id: string; label: string; area?: AreaData; person?: PersonData;
  /** A one-word name that is also an ordinary word or a generic room name: never at a sentence start before a lower-case word. */
  plainWord: boolean }

const TITLES = new Set(['Sir', 'Lady', 'Lord', 'Baron', 'Baroness', 'Father', 'Madam', 'Mad', 'The', 'Baba', 'Brother', 'Sister', 'Mother', 'Saint', 'St.']);
interface Character { id: string; name: string; kind: string; tags?: string[]; role?: string }
const NPCS = (characters as { characters: Character[] }).characters.filter((c) => c.kind === 'npc');

/** The names a person goes by: the full name, without a title, the given name, and a surname nobody else shares. */
function personNames(): Map<string, Character> {
  const out = new Map<string, Character>(), clash = new Set<string>();
  const add = (n: string, c: Character) => { if (!n || n.length < 3) return; const o = out.get(n); if (o && o !== c) clash.add(n); else out.set(n, c); };
  for (const c of NPCS) {
    add(c.name, c);
    const w = c.name.split(' ');
    const bare = TITLES.has(w[0]) && w.length > 1 ? w.slice(1) : w;
    add(bare.join(' '), c);
    if (bare.length > 1 && /^[A-Z]/.test(bare[0])) add(bare[0], c);
    const particle = bare.findIndex((x) => /^(von|van|der|d'|de)$/i.test(x));
    if (particle > 0) add(bare.slice(particle).join(' '), c);
    else if (bare.length === 2 && /^[A-Z]/.test(bare[1]) && !/^(the|II|III)$/.test(bare[1])) add(bare[1], c);
  }
  for (const n of clash) out.delete(n);
  return out;
}
const PEOPLE = personNames();

/** Place names: drop a leading 'The', a bracketed note and a trailing ', ground floor'. */
const placeName = (n: string) => n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^The\s+/, '').replace(/,.*$/, '').trim();

/**
 * A person's home for the person card: their manifest tags resolved to place names through both location manifests.
 * K reads 'Castle Ravenloft', N2 'Blue Water Inn (Town of Vallaki)', death-house 'Death House'. A tag that names no
 * location or keyed area is left out, a place already named inside a more exact one is dropped, and no tag at all
 * gives undefined (the card then has no Home field).
 */
export function homeOf(tags: readonly string[] | undefined): string | undefined {
  if (!tags?.length) return undefined;
  const locs = CAMPAIGNS.flatMap((c) => manifestOf(c).locations);
  const tidy = (n: string) => n.replace(/^The\s+/, '').trim();
  const one = (t: string): string | undefined => {
    const loc = locs.find((l) => l.id === t);
    if (loc) return tidy(loc.name);
    const holders = locs.filter((l) => l.areas.some((a) => a.key === t));
    const host = holders.find((l) => l.status !== 'regional' && t.startsWith(l.id)) ?? holders.find((l) => l.status !== 'regional') ?? holders[0];
    if (!host) return undefined;
    const area = tidy(host.areas.find((a) => a.key === t)!.name);
    return host.status === 'regional' ? area : `${area} (${placeName(host.name)})`;
  };
  const names = [...new Set(tags.map(one).filter((n): n is string => !!n))];
  const out = names.filter((n) => !names.some((m) => m !== n && m.endsWith(`(${n})`)));
  return out.length ? out.join('; ') : undefined;
}

function gazetteer(scenePath = ''): GazName[] {
  const sc = sceneInfo(scenePath);
  let g = gazCache.get(scenePath);
  if (g) return g;
  const camp = campaignOf(scenePath || 'ch02/x');
  const list: GazName[] = [];
  const seen = new Set<string>();
  const add = (x: GazName) => { if (x.name.length < 3 || seen.has(x.name)) return; seen.add(x.name); list.push(x); };
  // The scene's own rooms first: a name here is that room.
  if (sc) for (const r of sc.rooms.values()) {
    const n = placeName(r.name);
    add({ name: n, kind: 'area', id: `area:${scenePath}#${r.key}`, label: `${r.key} · ${n}`, area: { key: r.key, name: r.name, scene: scenePath, floor: r.level, desc: r.desc }, plainWord: !n.includes(' ') });
  }
  for (const x of overridesFile.gazetteer) if (!x.campaign || x.campaign === camp.id) {
    const slug = x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    add(x.kind === 'person'
      ? { name: x.name, kind: 'person', id: `person:${slug}`, label: x.name, person: { name: x.name, role: x.role }, plainWord: false }
      : { name: x.name, kind: 'area', id: `place:${slug}`, label: x.name, area: { name: x.name }, plainWord: false });
  }
  const man = manifestOf(camp);
  for (const l of man.locations) {
    const n = placeName(l.name);
    add({ name: n, kind: 'area', id: `place:${l.path.replace(/^locations\//, '')}`, label: n, area: { name: n, scene: l.path.replace(/^locations\//, '') }, plainWord: !n.includes(' ') });
  }
  const w = worldOf(camp);
  for (const p of w.pins) {
    const n = placeName(p.name);
    add({ name: n, kind: 'area', id: `place:${camp.world}#${p.key}`, label: n, area: { key: p.key, name: n, scene: camp.world }, plainWord: !n.includes(' ') });
  }
  // The other names lettered on the world map: rivers, lakes, peaks, woods.
  for (const x of [...w.rivers, ...w.lakes, ...w.peaks, ...w.woods, ...(w.labels ?? [])]) {
    const n = placeName(x.name), slug = n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    add({ name: n, kind: 'area', id: `place:${camp.world}#${slug}`, label: n, area: { name: n, scene: camp.world }, plainWord: !n.includes(' ') });
  }
  if (camp.id === CAMPAIGNS[0].id) for (const [n, c] of PEOPLE) {
    add({ name: n, kind: 'person', id: `person:${c.id}`, label: c.name, person: { name: c.name, role: c.role, home: homeOf(c.tags) }, plainWord: overridesFile.wordNames.includes(n) });
  }
  g = list.sort((a, b) => b.name.length - a.name.length);
  gazCache.set(scenePath, g);
  return g;
}

/** Gazetteer names in a text, longest first, case-sensitive, on word boundaries. */
function gazetteerHits(text: string, scenePath?: string): { s: number; e: number; g: GazName }[] {
  const out: { s: number; e: number; g: GazName }[] = [];
  const free = (s: number, e: number) => !out.some((h) => s < h.e && e > h.s);
  for (const g of gazetteer(scenePath)) {
    let at = text.indexOf(g.name);
    while (at >= 0) {
      const e = at + g.name.length;
      const okL = at === 0 || !/[A-Za-z0-9'’-]/.test(text[at - 1]);
      const okR = e === text.length || !/[A-Za-z0-9]/.test(text[e]) || /^['’]s\b/.test(text.slice(e));
      // 'The stairs rose' is not Rose: a one-word name at a sentence start before a lower-case word is a word.
      const before = text.slice(0, at).trimEnd();
      const sentenceStart = !before || /[.!?:;"“(\n—–]$/.test(before);
      const plainStart = g.plainWord && sentenceStart && /^\s+[a-z]/.test(text.slice(e)) && !/^\s+(and|or|&)\b/.test(text.slice(e));
      if (okL && okR && !plainStart && free(at, e)) out.push({ s: at, e, g });
      at = text.indexOf(g.name, at + 1);
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

// ---- structural sources (DM only)

const ABIL: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature',
  'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'];
const ABIL_RE = '(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|(?:Str|Dex|Con|Int|Wis|Cha)(?![A-Za-z])\\.?)(?![A-Za-z])';
const SKILL_RE = `(${SKILLS.join('|')}|[A-Za-z]+(?:'s|s')? (?:tools|supplies|kit)|search)(?![A-Za-z])`;
/** 'DC 15', 'DC 15 Dexterity (thieves' tools)', 'DC 12 Perception', 'DC 16 Wisdom save', 'DC 13 Wisdom (Perception) check', 'DC 15 Dex with thieves' tools'. */
const DC_RE = new RegExp(`\\bDC\\s?(\\d{1,2})\\b(?:\\s+${ABIL_RE}(?:\\s+\\(${SKILL_RE}\\)|\\s+with\\s+${SKILL_RE})?|\\s+${SKILL_RE})?(?:\\s+(save|saving throw|check)(?![A-Za-z]))?`, 'gi');
/** The committed DC pattern the check-link count is held to (tests/fixtures/terms-gold.json). */
export const DC_COUNT_RE = /\bDC\s?\d{1,2}\b/g;
const DICE_RE = /\b(\d{1,2})d(\d{1,3})(?:\s*([+−-])\s*(\d{1,3})(?![\dd]))?\b/g;

const title = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");

function checkSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(DC_RE)) {
    if (m[0].slice(0, 2) !== 'DC') continue; // case-insensitive for the words after it, never for 'dc'
    const dc = Number(m[1]);
    const ab = m[2] ? ABIL[m[2].slice(0, 3).toLowerCase()] : undefined;
    const sk = (m[3] ?? m[4] ?? m[5]);
    const skill = sk ? title(sk.toLowerCase()) : undefined;
    const save = !!m[6] && /^sav/i.test(m[6]);
    const label = [`DC ${dc}`, [ab, save ? 'save' : '', skill ? (ab ? `(${skill})` : skill) : ''].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const id = `check:${['dc' + dc, ab, skill, save ? 'save' : ''].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    // Only the 'DC n' and the words that belong to it: a trailing 'check' or 'save' stays inside the link.
    out.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], kind: 'check', id, label, via: 'structural', why: 'DC', check: { dc, ability: ab, skill, save } });
  }
  return out;
}

export function diceOf(expr: string): DiceData | undefined {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+−-])\s*(\d+))?\s*$/i.exec(expr);
  if (!m) return undefined;
  const n = Number(m[1]), d = Number(m[2]), k = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
  return { expr: expr.replace(/\s+/g, ' ').trim(), avg: Math.floor((n * (d + 1)) / 2 + k), max: n * d + k };
}

function diceSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(DICE_RE)) {
    const d = diceOf(m[0]);
    if (!d || Number(m[1]) < 1) continue;
    out.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], kind: 'dice', id: `dice:${m[0].replace(/\s+/g, '').replace('−', '-')}`, label: `${d.expr} · avg ${d.avg} · max ${d.max}`, via: 'structural', why: 'dice', dice: d });
  }
  return out;
}

/** Key references to the scene's rooms: '(21)', '(X26)', '(X8, X17)', 'area 32', and a lettered key on its own ('into X39'). */
function keySpans(text: string, sc: SceneInfo | undefined): Span[] {
  if (!sc) return [];
  const out: Span[] = [];
  const room = (k: string, s: number, why: string) => {
    const r = sc.rooms.get(k);
    if (!r) return;
    out.push({ start: s, end: s + k.length, text: k, kind: 'area', id: `area:${sc.path}#${k}`, label: `${k} · ${placeName(r.name) || r.name}`, via: 'structural', why, area: { key: k, name: r.name, scene: sc.path, floor: r.level, desc: r.desc } });
  };
  const KEY = /[A-Z]{0,2}\d{1,3}[A-Za-z]?/y;
  const list = (from: number, to: number, why: string) => {
    // '21', 'X8, X17', '23E/23F', '7A and 12A'
    const re = /[A-Z]{0,2}\d{1,3}[A-Za-z]?/g;
    for (const m of text.slice(from, to).matchAll(re)) room(m[0], from + m.index!, why);
  };
  for (const m of text.matchAll(/\(([^()]{1,40})\)/g)) {
    const inner = m[1], s = m.index! + 1;
    const parts = inner.split(/\s*(?:,|\/|\band\b|\bor\b)\s*/).filter(Boolean);
    if (parts.length && parts.every((p) => { KEY.lastIndex = 0; return KEY.test(p) && KEY.lastIndex === p.length && sc.rooms.has(p); })) list(s, s + inner.length, 'key ref');
  }
  for (const m of text.matchAll(/\bareas? ((?:[A-Z]{0,2}\d{1,3}[A-Za-z]?)(?:(?:,\s*|\s+and\s+|\s*\/\s*)[A-Z]{0,2}\d{1,3}[A-Za-z]?)*)\b/g)) {
    const s = m.index! + m[0].length - m[1].length;
    list(s, s + m[1].length, 'key ref');
  }
  // A lettered key ('X39', 'Q50', 'N2a') is a reference wherever it stands.
  for (const m of text.matchAll(/(?<![A-Za-z0-9-])([A-Z]{1,2}\d{1,3}[a-z]?)(?![A-Za-z0-9])/g)) room(m[1], m.index!, 'key');
  const seen = new Set<number>();
  return out.filter((x) => (seen.has(x.start) ? false : (seen.add(x.start), true)));
}

/** The creature a hidden-creature slot or a token holds: its id in the books (monster) or the module's own id. */
function creatureOf(kind: string, t: TermFile): { id: string; name: string; forms: string[] } | undefined {
  const c = (characters as { characters: Character[] }).characters.find((x) => x.id === kind);
  if (c?.kind === 'npc') return undefined; // a person: the gazetteer links them
  const tries = [kind.replace(/^x-/, '').replace(/-/g, ' '), c?.name.toLowerCase() ?? '', kind.replace(/^x-|^krezk-/, '').replace(/-(wolf|human)$/, '').replace(/-/g, ' ')];
  for (const k of tries) {
    const i = (t.forms[k] ?? []).find((x) => t.entries[x][2] === 'monster');
    if (i !== undefined) {
      const [id, name] = t.entries[i];
      const forms = Object.entries(t.forms).filter(([, l]) => l.includes(i)).map(([f]) => f);
      return { id, name, forms: [...new Set([...forms, k, ...(c ? [c.name.toLowerCase()] : [])])] };
    }
  }
  const name = c?.name ?? kind.replace(/^x-/, '').replace(/-/g, ' ');
  return { id: `creature:${kind}`, name, forms: [name.toLowerCase(), kind.replace(/-/g, ' ')] };
}

function creatureSpans(text: string, ctx: SpanCtx, t: TermFile | undefined): Span[] {
  if (!t || (ctx.field !== 'label' && ctx.field !== 'dm')) return [];
  const sc = sceneInfo(ctx.scenePath);
  const o = ctx.entityId ? sc?.objects.get(ctx.entityId) : undefined;
  const kind = ctx.creatureId ?? (o?.vis === 'hidden-creature' ? o.kind : undefined);
  if (!kind) return [];
  const cr = creatureOf(kind, t);
  if (!cr) return [];
  const lower = text.toLowerCase();
  let best: { s: number; e: number } | undefined;
  for (const f of cr.forms.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![a-z])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'g');
    for (const m of lower.matchAll(re)) if (!best || m.index! < best.s) best = { s: m.index!, e: m.index! + f.length };
  }
  if (!best || PEOPLE.has(text.slice(best.s, best.e)) || PEOPLE.has(text.slice(best.s, best.e).replace(/^\w/, (c) => c.toUpperCase()))) return [];
  // A module creature whose words hold a books monster ('Brown bear', 'a Martikov draft horse'): the matcher links that.
  if (cr.id.startsWith('creature:') && findTerms(text, t).some((x) => x.type === 'monster' && x.start <= best!.s && x.end >= best!.e)) return [];
  return [{ start: best.s, end: best.e, text: text.slice(best.s, best.e), kind: 'monster', id: cr.id, label: cr.name.replace(/\b[a-z]/g, (c) => c.toUpperCase()), via: 'structural', why: 'creature slot' }];
}

// ---- the ordinary-word guard

const COUNT = /(?:\b\d+\s*[×x]\s*|\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a dozen|dozens of|a pack of|a swarm of|a flock of)\s+)$/i;
const ENCOUNTER_AFTER = /^\s+(?:attacks?|lurks?|waits?|hides?|nests?|rises?|emerges?|appears?|manifests?|fights?|sleeps?|slumbers?|stalks?|prowls?|bursts?|swoops?|pounces?|ambush(?:es)?)\b/i;
const ENCOUNTER_BEFORE = /\b(?:summons?|brings?|frees?|raises?|releases?|provokes?|wakes?|awakens?)\s+(?:(?:the|a|an|her|his|its|their|\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+){0,2}$/i;
/** The cue a common word needs in module text (CLARITY's list), or '' when it has none. */
function cueOf(text: string, s: number, e: number, type: EntryType): string {
  const before = text.slice(Math.max(0, s - 100), s), after = text.slice(e, e + 40);
  const clause = before.split(/[.;!?]/).pop() ?? '';
  if (type === 'spell' || type === 'item') {
    if (/\bscrolls? of\s+$/i.test(before)) return 'scroll of';
    if (/\bpotions? of\s+$/i.test(before)) return 'potion of';
    // 'scrolls of bless, protection from poison and spiritual weapon': a list after 'scrolls of' keeps the cue.
    if (/\bscrolls? of\s+[^.;:()]*(?:,|\band)\s+$/i.test(before) && type === 'spell') return 'scroll of';
  }
  if (type === 'spell') {
    if (/\b(?:cast|casts|casting|recast)\s+$/i.test(before)) return 'cast';
    if (/^\s+(?:spell|cantrip)\b/i.test(after)) return 'spell';
    // A gift or an item's charges: 'scrying 3 times', 'suggestion once a day'.
    if (/^\s+(?:\d+|once|twice|three)\s+(?:times?|a day|per day)\b|^\s+once\b/i.test(after)) return 'n times';
    // 'in elk form (polymorph)': a spell named on its own in brackets.
    if (/\(\s*$/.test(before) && /^\s*\)/.test(after)) return 'spell parenthesis';
  }
  if (type === 'damage' && /^\s+damage\b/i.test(after)) return 'damage';
  // '1d6 bludgeoning', '4d10 necrotic': a damage type after its dice.
  if (type === 'damage' && /\b\d+d\d+(?:\s*[+−-]\s*\d+)?\s+$/.test(before)) return 'damage';
  if (type === 'condition') {
    if (/^\s+condition\b/i.test(after)) return 'condition';
    if (/\b(?:DC\s?\d{1,2}|save|saving throw)\b/i.test(clause)) return 'save';
  }
  if (type === 'ability' && /^\s+(?:save|saving throw|check|score|modifier)\b/i.test(after)) return 'save';
  if (type === 'monster' || type === 'creature-type') {
    if (/^\s*\((?:AC|HP|CR|\d+\s*hp)\b/i.test(after)) return 'stat parenthesis';
    // 'four ghouls', '3× wolf'; not 'CR 11 construct', '20 ft giant' or 'four giant vats'.
    // 'Vilnius (mage)', 'Milivoj (commoner, Str 15)': a creature named for its stat block.
    if (type === 'monster' && /\(\s*$/.test(before) && /^\s*[),;]/.test(after)) return 'stat parenthesis';
    // An encounter in a DM note: 'a grick lurks here', 'the specter appears', 'frees two ghasts', 'summons the ghosts'.
    if (type === 'monster' && (ENCOUNTER_AFTER.test(after) || ENCOUNTER_BEFORE.test(before))) return 'encounter';
    if (type === 'monster' && COUNT.test(before) && !/\b(?:CR|AC|DC|hp|HP|ft|lb|gp|sp)\s*\d+\s*$/.test(before) && !/^[ -](?:[a-z]+ )?(?:vats?|skulls?|statues?|carvings?|figurines?|heads?|skins?|swarms?)\b/.test(after)) return 'count';
  }
  return '';
}

/** A capitalised term inside a longer capitalised name ('Seriach, the Hell Hound Whisperer', 'the Silver Dragon Order'). */
function insideName(text: string, s: number, e: number): boolean {
  if (!/^[A-Z]/.test(text.slice(s, e))) return false;
  if (/^ (?:of (?:the )?)?[A-Z][a-z]/.test(text.slice(e, e + 12))) return true;
  const prev = /([A-Za-z][A-Za-z'’-]*) $/.exec(text.slice(Math.max(0, s - 30), s));
  const before = text.slice(0, s).trimEnd();
  return !!prev && /^[A-Z]/.test(prev[1]) && !/[.!?:;"“(]$/.test(before.slice(0, -prev[1].length).trimEnd() || '.') && !/^(The|A|An|Each|Every|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Some|No|Its|His|Her|Their)$/.test(prev[1]);
}
/** A creature named as a thing, not met as a foe: 'a stuffed brown bear', 'a dire wolf's head over the hearth'. */
function trophy(text: string, s: number, e: number): boolean {
  return /\b(?:stuffed|carved|painted|stone|wooden|toy|mounted)\s+$/i.test(text.slice(Math.max(0, s - 12), s))
    || /^['’]s\s+(?:\w+\s+)?(?:head|skull|tongue|pelt|hide|skin|bones|carcass)\b/i.test(text.slice(e, e + 30));
}

// ---- the pipeline

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && a.end > b.start;

/** The rules links in one module string, for one audience and edition. */
export function spansFor(text: string, ctx: SpanCtx): Span[] {
  if (!text) return [];
  const dm = ctx.audience === 'dm';
  const out: Span[] = [];
  const blocked: { start: number; end: number }[] = [];
  const free = (x: { start: number; end: number }) => !out.some((y) => overlaps(x, y)) && !blocked.some((y) => overlaps(x, y));
  const labels: { start: number; end: number; label: string }[] = [];
  const t = terms.get(ctx.edition);

  // 1. Overrides.
  for (const o of overridesFile.overrides) {
    if (o.scene !== (ctx.scenePath ?? '') || o.entity !== (ctx.entityId ?? '') || o.field !== ctx.field) continue;
    const at = nth(text, o.match, o.occurrence ?? 0);
    if (at < 0) continue;
    const r = { start: at, end: at + o.match.length };
    if (o.action === 'suppress') blocked.push(r);
    else if (o.action === 'label') labels.push({ ...r, label: o.label ?? o.match });
    else if (o.kind && free(r)) {
      const name = o.id && t ? t.entries.find((x) => x[0] === o.id)?.[1] : undefined;
      out.push({ ...r, text: o.match, kind: o.kind, id: o.id, label: o.label ?? name ?? o.match, via: 'override', why: `override: ${o.reason}` });
    }
  }
  // 2. Structural sources, DM only.
  if (dm) {
    const sc = sceneInfo(ctx.scenePath);
    for (const x of [...checkSpans(text), ...diceSpans(text), ...keySpans(text, sc), ...creatureSpans(text, ctx, t)]) if (free(x)) out.push(x);
  }
  // 3. The gazetteer: names stay names.
  for (const h of gazetteerHits(text, ctx.scenePath)) {
    const r = { start: h.s, end: h.e };
    if (!free(r)) continue;
    if (dm) out.push({ ...r, text: text.slice(h.s, h.e), kind: h.g.kind, id: h.g.id, label: h.g.label, via: 'gazetteer', why: `gazetteer: ${h.g.kind === 'person' ? 'person' : 'place'}`, area: h.g.area, person: h.g.person });
    else blocked.push(r);
  }
  // 4. The books' matcher, then the ordinary-word guard.
  if (t) {
    const held: TermSpan[] = [];
    for (const m of findTerms(text, t, { keepCommon: true })) {
      const r = { start: m.start, end: m.end };
      if (!free(r)) continue;
      if (m.via !== 'tag' && (insideName(text, m.start, m.end) || (m.type === 'monster' && trophy(text, m.start, m.end)))) continue;
      let via: SpanVia = m.via === 'tag' ? 'tag' : 'name', why: string = m.via;
      if ((m.common && !NOT_ORDINARY.has(m.text.toLowerCase())) || ORDINARY.has(m.text.toLowerCase())) {
        // The capital alone does not count in module text, and players never get an ordinary word as a link.
        if (!dm) continue;
        const cue = cueOf(text, m.start, m.end, m.type);
        if (!cue) { held.push(m); continue; }
        via = 'cue'; why = `cue: ${cue}`;
      }
      out.push({ ...r, text: m.text, kind: termKind(m.id, m.type, ctx.edition), id: m.id, label: m.name, via, why });
    }
    if (dm) spellLists(text, t, out, held, ctx.edition);
  }
  // A monster word in apposition to a named person and followed by that person's own numbers ('Exethanter the lich
  // (99 hp, … CR 10)') is a one-off variant: the books' stat block would show the wrong numbers at a glance, so the
  // person link stands and the monster link goes. Without the numbers ('Helwa the gladiator') the stat block is right.
  const people = out.filter((x) => x.kind === 'person');
  for (let i = out.length - 1; i >= 0; i--) {
    const x = out[i];
    if (x.kind !== 'monster' || x.via === 'override' || !/^\s*\([^)]*\b(?:\d+\s*hp|hp\s*\d+|CR\s*\d)/i.test(text.slice(x.end))) continue;
    if (people.some((p) => p.end <= x.start && /^,?\s+the\s+(?:[a-z]+\s+)?$/.test(text.slice(p.end, x.start)))) out.splice(i, 1);
  }
  // 5. The audience filter.
  const kept = dm ? out : out.filter((x) => PLAYER_KINDS.has(x.kind) && (x.via === 'name' || x.via === 'tag' || x.via === 'override'));
  for (const l of labels) for (const x of kept) if (overlaps(x, l)) x.label = l.label;
  return kept.sort((a, b) => a.start - b.start);
}

/** A list of spells ('scrolls of bless, protection from poison and spiritual weapon', 'a spellbook (1st: disguise self,
 *  identify, mage armor …; 2nd: darkvision, hold person, invisibility …)'): a name in the list is a spell too, even an
 *  ordinary word ('identify') or one that is also a sense ('darkvision'). */
function spellLists(text: string, t: TermFile, out: Span[], held: TermSpan[], edition: Edition): void {
  const SEP = /^\s*(?:[,;]|,?\s*(?:and|or)\b)\s*(?:\d(?:st|nd|rd|th)(?:\s+level)?:\s*)?$/i;
  const spellOf = (form: string) => (t.forms[normTerm(form)] ?? []).find((i) => t.entries[i][2] === 'spell');
  const isSpell = (x: Span) => x.kind === 'spell';
  const nextTo = (s: number, e: number) => out.some((x) => isSpell(x) && ((x.end <= s && SEP.test(text.slice(x.end, s))) || (x.start >= e && SEP.test(text.slice(e, x.start)))));
  for (let changed = true; changed;) {
    changed = false;
    for (const x of out) if (!isSpell(x) && x.via !== 'structural' && x.via !== 'gazetteer' && x.via !== 'override') {
      const i = spellOf(x.text);
      if (i !== undefined && nextTo(x.start, x.end)) { [x.id, x.label] = [t.entries[i][0], t.entries[i][1]]; x.kind = 'spell'; x.why = 'cue: spell list'; changed = true; }
    }
    for (let k = held.length - 1; k >= 0; k--) {
      const m = held[k], i = spellOf(m.text);
      if (i === undefined || !nextTo(m.start, m.end) || out.some((y) => overlaps(y, { start: m.start, end: m.end }))) continue;
      out.push({ start: m.start, end: m.end, text: m.text, kind: termKind(t.entries[i][0], 'spell', edition), id: t.entries[i][0], label: t.entries[i][1], via: 'cue', why: 'cue: spell list' });
      held.splice(k, 1); changed = true;
    }
  }
}

/** The key a span is counted under ('spell:bless', 'check:dc15-dex', 'area:…'): one link per key per card. */
export const spanKey = (x: Span): string => x.id ?? `${x.kind}:${x.label}`;

/** The HTML of a text with its links: every slice escaped, only the first occurrence of each term per card linked
 *  (pass one `seen` set for all the fields of one card). */
export function renderSpans(text: string, spans: Span[], seen: Set<string> = new Set()): string {
  let html = '', at = 0;
  for (const x of spans) {
    if (x.start < at) continue;
    html += esc(text.slice(at, x.start));
    const k = spanKey(x);
    if (seen.has(k)) html += esc(text.slice(x.start, x.end));
    else {
      seen.add(k);
      html += linkHtml(x, text.slice(x.start, x.end));
    }
    at = x.end;
  }
  return html + esc(text.slice(at));
}

function linkHtml(x: Span, shown: string): string {
  const k = kindInfo(x.kind);
  const a: [string, string | number | undefined][] = [['data-kind', x.kind], ['data-term', x.id ?? x.label], ['data-label', x.label], ['aria-expanded', 'false']];
  if (x.check) a.push(['data-dc', x.check.dc], ['data-ability', x.check.ability ? `${x.check.ability}${x.check.save ? ' save' : ''}` : x.check.save ? 'save' : undefined], ['data-skill', x.check.skill]);
  if (x.dice) a.push(['data-expr', x.dice.expr]);
  if (x.area) a.push(['data-key', x.area.key], ['data-name', x.area.name], ['data-floor', x.area.floor], ['data-desc', x.area.desc]);
  if (x.person) a.push(['data-name', x.person.name], ['data-role', x.person.role], ['data-home', x.person.home]);
  const attrs = a.filter(([, v]) => v !== undefined && v !== '').map(([n, v]) => ` ${n}="${esc(v)}"`).join('');
  return `<button type="button" class="rl ${k.cls}"${attrs}>${esc(shown)}</button>`;
}
