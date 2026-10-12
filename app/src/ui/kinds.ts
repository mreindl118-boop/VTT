// Rules kinds: what each kind of rules link and card is called, which colour family it belongs to, which emblem it
// carries and its exact kicker word. The five families (docs/THEME.md) each have their own underline style, so a link's
// kind reads without colour too. The switch is exhaustive: a new entry type fails the build until it is mapped here.
import type { Edition, EntryType } from '../books/types';

/** Every kind a rules link or card can have: the books' entry types plus the derived and structural kinds. */
export type RuleKind = EntryType | 'action' | 'sense' | 'magic-item' | 'gear' | 'check' | 'dice' | 'area' | 'person' | 'pageref';
export type Family = 'condition' | 'magic' | 'monster' | 'rules' | 'pageref';
export type Underline = 'dashed' | 'double' | 'wavy' | 'dotted' | 'solid';

/** The 18 emblems shipped in the sprite (ui/emblems.svg), by id without the 'gi-' prefix. */
export const EMBLEM_IDS = [
  'bleeding-wound', 'boot-prints', 'checked-shield', 'crossed-swords', 'dice-twenty-faces-twenty', 'evil-bat', 'hearts', 'hourglass',
  'knockout', 'magic-swirl', 'open-book', 'rolling-dices', 'rule-book', 'semi-closed-eye', 'sheep', 'skull-crossed-bones', 'swap-bag', 'wolf-head',
] as const;
export type EmblemId = (typeof EMBLEM_IDS)[number];

export const UNDERLINE: Record<Family, Underline> = { condition: 'dashed', magic: 'double', monster: 'wavy', rules: 'dotted', pageref: 'solid' };
/** The CSS colour of a family (page reference is the page's own ink). */
export const familyColor = (f: Family): string => (f === 'pageref' ? 'var(--p-ink)' : `var(--k-${f})`);

/** Kinds that may link on the players' side. Everything else (monsters, people, areas, checks, dice) is DM only. */
export const PLAYER_KINDS: ReadonlySet<RuleKind> = new Set<RuleKind>(['condition', 'rule', 'action', 'sense', 'damage', 'ability', 'skill']);

/** Rules entries that are senses (vision and light), in either edition. */
export const SENSE_IDS: readonly string[] = [
  'rule:blindsight', 'rule:darkvision', 'rule:tremorsense', 'rule:truesight', 'rule:vision-and-light', 'rule:bright-light',
  'rule:dim-light', 'rule:darkness', 'rule:lightly-obscured', 'rule:heavily-obscured', 'rule:obscured-areas',
];

export interface KindInfo {
  family: Family;
  /** The class on .rt and .rl ('item' for magic items too, with the rarity class beside it). */
  cls: string;
  emblem: EmblemId;
  /** The kicker's first word, unique per kind. */
  word: string;
}

/** The kind table (docs/THEME.md 'Rules tooltip card', the tooltip spec's D7). */
export function kindInfo(k: RuleKind): KindInfo {
  switch (k) {
    case 'spell': return { family: 'magic', cls: 'spell', emblem: 'magic-swirl', word: 'spell' };
    case 'magic-item': return { family: 'magic', cls: 'item magic', emblem: 'swap-bag', word: 'magic item' };
    case 'item': return { family: 'rules', cls: 'item', emblem: 'swap-bag', word: 'item' };
    case 'gear': return { family: 'rules', cls: 'item', emblem: 'swap-bag', word: 'gear' };
    case 'condition': return { family: 'condition', cls: 'condition', emblem: 'knockout', word: 'condition' };
    case 'monster': return { family: 'monster', cls: 'monster', emblem: 'wolf-head', word: 'monster' };
    case 'creature-type': return { family: 'monster', cls: 'monster', emblem: 'wolf-head', word: 'creature type' };
    case 'rule': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'rule' };
    case 'action': return { family: 'rules', cls: 'action', emblem: 'crossed-swords', word: 'action' };
    case 'sense': return { family: 'rules', cls: 'sense', emblem: 'semi-closed-eye', word: 'sense' };
    case 'damage': return { family: 'rules', cls: 'damage', emblem: 'bleeding-wound', word: 'damage type' };
    case 'ability': return { family: 'rules', cls: 'ability', emblem: 'checked-shield', word: 'ability' };
    case 'skill': return { family: 'rules', cls: 'skill', emblem: 'dice-twenty-faces-twenty', word: 'skill' };
    case 'check': return { family: 'rules', cls: 'check', emblem: 'dice-twenty-faces-twenty', word: 'check' };
    case 'dice': return { family: 'rules', cls: 'dice', emblem: 'rolling-dices', word: 'dice' };
    case 'feat': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'feat' };
    case 'class': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'class' };
    case 'feature': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'class feature' };
    case 'species': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'species' };
    case 'background': return { family: 'rules', cls: 'rule', emblem: 'rule-book', word: 'background' };
    case 'area': return { family: 'pageref', cls: 'pageref', emblem: 'open-book', word: 'area' };
    case 'person': return { family: 'pageref', cls: 'pageref', emblem: 'open-book', word: 'person' };
    case 'pageref': return { family: 'pageref', cls: 'pageref', emblem: 'open-book', word: 'module page' };
    default: { const never: never = k; throw new Error(`unmapped rules kind ${String(never)}`); }
  }
}

export const familyOf = (k: RuleKind): Family => kindInfo(k).family;
export const emblemOf = (k: RuleKind): EmblemId => kindInfo(k).emblem;
export const underlineOf = (k: RuleKind): Underline => UNDERLINE[familyOf(k)];

/** Every kind, for tests and the Help colour key. */
export const ALL_KINDS: readonly RuleKind[] = [
  'spell', 'condition', 'monster', 'item', 'rule', 'damage', 'ability', 'skill', 'creature-type', 'feat', 'class', 'feature', 'species', 'background',
  'action', 'sense', 'magic-item', 'gear', 'check', 'dice', 'area', 'person', 'pageref',
];
/** The entry types (EntryType), so a test can prove each one is mapped. */
export const ENTRY_TYPES: readonly EntryType[] = ['spell', 'condition', 'monster', 'item', 'rule', 'damage', 'ability', 'skill', 'creature-type', 'feat', 'class', 'feature', 'species', 'background'];

/** The parts of an entry the kind depends on (a RuleEntry or a stored entry both fit). */
export interface KindSource { id: string; type: EntryType; summary?: unknown; s?: unknown }
const sumOf = (e: KindSource): Record<string, unknown> => ((e.summary ?? e.s ?? {}) as Record<string, unknown>);

/** The kind of a rules entry: items split into magic items and gear, actions and senses out of the rules. */
export function kindOf(e: KindSource): RuleKind {
  const s = sumOf(e);
  if (e.type === 'item') return s.magic ? 'magic-item' : 'gear';
  if (e.type === 'rule') {
    if (SENSE_IDS.includes(e.id)) return 'sense';
    if (s.tag === 'Action') return 'action';
  }
  return e.type;
}

/** The rarity class of a magic item ('Very Rare' → 'veryrare'), or '' when it has none. */
export function rarityOf(e: KindSource): string {
  const r = String(sumOf(e).rarity ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return RARITIES.find((x) => r.startsWith(x)) ?? '';
}
export const RARITIES = ['common', 'uncommon', 'rare', 'veryrare', 'legendary', 'artifact'] as const;

const ORD = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const lc = (v: unknown): string => String(v ?? '').trim().toLowerCase();

/** The kicker text of an entry's card: the kind's word plus the exact type ('spell · 1st level · enchantment'). */
export function kickerOf(e: KindSource & { name?: string }, edition: Edition): string {
  const k = kindOf(e), s = sumOf(e), w = kindInfo(k).word;
  switch (k) {
    case 'spell': {
      const lv = Number(s.level ?? 0), school = lc(s.school);
      return lv === 0 ? `cantrip${school ? ` · ${school}` : ''}` : `spell · ${ORD[lv] ?? `${lv}th`} level${school ? ` · ${school}` : ''}`;
    }
    case 'magic-item': { const r = lc(s.rarity); return r ? `${w} · ${r}` : w; }
    case 'gear': { const c = lc(s.subcategory || s.category); return c ? `${w} · ${c}` : w; }
    case 'monster': return s.cr ? `${w} · CR ${String(s.cr)}` : w;
    case 'rule': return s.tag ? `${w} · ${lc(s.tag)}` : w;
    case 'skill': return s.ability ? `${w} · ${lc(s.ability)}` : w;
    case 'species': return edition === '2014' ? 'race' : w;
    default: return w;
  }
}
