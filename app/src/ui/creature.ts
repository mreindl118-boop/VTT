// A creature's one source of numbers (docs/CLARITY.md: one source per card, never a field-by-field merge): the books'
// stat block for the chosen Rules edition when the open rules have the creature, else the module's own numbers
// (bestiary STATS) under 'Module stats', else nothing but a note. The stat-block card, the token panel's stat pills,
// the bestiary rows and the DM's hover line all read it, so they can never disagree. DM only; loaded on demand.
import { lookup, rulesEdition, type Edition, type RuleEntry } from '../books/lookup';
import type { MonsterSummary } from '../books/types';
import { creatureById, statsOf, type Stats } from '../bestiary';
import { emblem, ensureEmblems } from './emblems';
import { monsterIdFor, ready } from './terms';
import { esc } from './text';

export type CreatureSource =
  | { kind: 'srd'; entry: RuleEntry; s: MonsterSummary; edition: Edition }
  | { kind: 'module'; name: string; stats?: Stats; edition: Edition };

/** What the card says when the open rules have no stat block for a creature (either campaign's module). */
export const NO_OPEN_BLOCK = 'Module creature: no open stat block';
export const MODULE_STATS = 'Module stats';

const memo = new Map<string, Promise<CreatureSource>>();

/** The source of a module creature's numbers in an edition (the preference by default). */
export function creatureSource(creatureId: string, edition: Edition = rulesEdition()): Promise<CreatureSource> {
  const k = `${edition}|${creatureId}`;
  let p = memo.get(k);
  if (!p) memo.set(k, (p = resolve(creatureId, edition)));
  return p;
}

async function resolve(creatureId: string, edition: Edition): Promise<CreatureSource> {
  const e = creatureById(creatureId);
  // A creature the bestiary does not hold still gets a readable name: 'giant-bat-swarm' reads 'Giant Bat Swarm'.
  const name = e?.name ?? titleCase(creatureId);
  // People are the module's own; only creatures the open rules know have a books entry.
  if (e?.kind !== 'npc') {
    try {
      await ready(edition);
      await ready(edition === '2024' ? '2014' : '2024');
      const id = monsterIdFor(creatureId, edition) ?? monsterIdFor(creatureId, edition === '2024' ? '2014' : '2024');
      const entry = id ? await lookup(id, edition, { fallback: true }) : undefined;
      if (entry?.type === 'monster') return { kind: 'srd', entry, s: entry.summary as MonsterSummary, edition };
    } catch { /* the books are not available (offline and never saved): the module's numbers */ }
  }
  return { kind: 'module', name, stats: e ? statsOf(e) : undefined, edition };
}

function titleCase(id: string): string {
  return id.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** The numbers a panel or row shows, from one source. */
export interface Numbers { size?: string; ac?: string; hp?: string; speed?: string; cr?: string; from: string; note?: string }
export function numbersOf(src: CreatureSource, size?: string): Numbers {
  if (src.kind === 'srd') {
    const s = src.s;
    return { size: s.size ?? size, ac: String(s.ac), hp: String(s.hp), speed: String(s.speed ?? '').split(/[,;]/)[0].replace(/\.$/, ''), cr: String(s.cr), from: `${src.entry.edition} · ${src.entry.book === 'srd-5.2.1' ? 'SRD 5.2.1' : 'SRD 5.1'}` };
  }
  const st = src.stats;
  return st
    ? { size, ac: String(st.ac), hp: String(st.hp), speed: st.speed.split(',')[0], cr: st.cr, from: MODULE_STATS }
    : { size, from: MODULE_STATS, note: NO_OPEN_BLOCK };
}

/** The DM's one-line stat summary (the hover tip on a creature token). */
export function statLine(src: CreatureSource): string {
  const n = numbersOf(src);
  return [n.ac && `AC ${n.ac}`, n.hp && `HP ${n.hp}`, n.cr && `CR ${n.cr}`, n.from === MODULE_STATS ? MODULE_STATS : ''].filter(Boolean).join(' · ');
}

/** Rules entries the stat pills open: size (space), armour class, hit points, speed, challenge rating. */
export const PILL_TERMS = { size: 'rule:creature-size', ac: 'rule:armor-class', hp: 'rule:hit-points', speed: 'rule:speed', cr: 'rule:challenge-rating' } as const;

const pill = (term: string, icon: Parameters<typeof emblem>[0], word: string, label: string) =>
  `<button type="button" class="rl rule pill" data-kind="rule" data-term="${term}" data-label="${esc(label)}" aria-expanded="false">${emblem(icon)}<span>${esc(word)}</span></button>`;

/** The stat pills (THEME T4): size, AC, HP, speed and CR, each a rules link, all from one source. */
export function statPills(n: Numbers): string {
  if (typeof document !== 'undefined') ensureEmblems();
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  return [
    n.size ? pill(PILL_TERMS.size, 'position-marker', cap(n.size), 'Size') : '',
    n.ac ? pill(PILL_TERMS.ac, 'checked-shield', `AC ${n.ac}`, 'Armor Class') : '',
    n.hp ? pill(PILL_TERMS.hp, 'hearts', `${n.hp} hp`, 'Hit Points') : '',
    n.speed ? pill(PILL_TERMS.speed, 'boot-prints', n.speed, 'Speed') : '',
    n.cr ? pill(PILL_TERMS.cr, 'skull-crossed-bones', `CR ${n.cr}`, 'Challenge Rating') : '',
  ].join('');
}
