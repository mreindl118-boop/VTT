// Shapes of the generated rules books (app/public/books/**), shared by the converter (scripts/books) and the app.
// The data is SRD text under CC-BY-4.0; every file carries its book's attribution.

export type BookId = 'srd-5.1' | 'srd-5.2.1';
/** Which rules answer a lookup: the 2014 rules (SRD 5.1) or the 2024 rules (SRD 5.2.1). */
export type Edition = '2014' | '2024';

export const BOOK_OF: Record<Edition, BookId> = { '2014': 'srd-5.1', '2024': 'srd-5.2.1' };
export const EDITION_OF: Record<BookId, Edition> = { 'srd-5.1': '2014', 'srd-5.2.1': '2024' };

export type EntryType =
  | 'spell' | 'condition' | 'monster' | 'item' | 'rule' | 'damage' | 'ability' | 'skill'
  | 'creature-type' | 'feat' | 'class' | 'feature' | 'species' | 'background';

/** Label and colour family per entry type. The colour is the type's rules family (ui/kinds.ts familyOf; tests/kinds.test.ts
 *  checks the two agree), a token from styles.css. */
export const TYPE_META: Record<EntryType, { label: string; color: string }> = {
  spell: { label: 'Spell', color: 'var(--k-magic)' },
  condition: { label: 'Condition', color: 'var(--k-condition)' },
  monster: { label: 'Monster', color: 'var(--k-monster)' },
  item: { label: 'Item', color: 'var(--k-rules)' },
  rule: { label: 'Rule', color: 'var(--k-rules)' },
  damage: { label: 'Damage type', color: 'var(--k-rules)' },
  ability: { label: 'Ability', color: 'var(--k-rules)' },
  skill: { label: 'Skill', color: 'var(--k-rules)' },
  'creature-type': { label: 'Creature type', color: 'var(--k-monster)' },
  feat: { label: 'Feat', color: 'var(--k-rules)' },
  class: { label: 'Class', color: 'var(--k-rules)' },
  feature: { label: 'Class feature', color: 'var(--k-rules)' },
  species: { label: 'Species', color: 'var(--k-rules)' },
  background: { label: 'Background', color: 'var(--k-rules)' },
};

/** The 2014 rules call species 'races'. */
export const typeLabel = (type: EntryType, edition: Edition): string => (type === 'species' && edition === '2014' ? 'Race' : TYPE_META[type].label);

/** Which entry file holds a type. */
export const ENTRY_FILE: Record<EntryType, string> = {
  spell: 'spells', monster: 'monsters', item: 'items',
  condition: 'rules', rule: 'rules', damage: 'rules', ability: 'rules', skill: 'rules', 'creature-type': 'rules',
  feat: 'character', class: 'character', feature: 'character', species: 'character', background: 'character',
};

export interface SpellSummary {
  level: number; school: string; castingTime: string; range: string; components: string; material?: string;
  duration: string; concentration: boolean; ritual: boolean; classes: string[];
}
export interface MonsterSummary {
  size: string; creatureType: string; alignment: string; ac: number; acNote?: string; initiative?: string;
  hp: number; hpDice?: string; speed: string; cr: string; xp?: number; pb?: string;
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>;
  saves?: string; skills?: string; senses?: string; languages?: string;
  resistances?: string; vulnerabilities?: string; immunities?: string; conditionImmunities?: string; gear?: string;
}
export interface ItemSummary {
  category: string; subcategory?: string; magic: boolean; rarity?: string; attunement?: string | boolean;
  cost?: string; weight?: string; damage?: string; properties?: string; mastery?: string; ac?: string; strength?: string; stealth?: string;
  /** Tools (2024): the ability its checks use, what the Utilize action does with it, what it crafts, its variants. */
  ability?: string; utilize?: string; craft?: string; variants?: string;
}
export interface ConditionSummary { effects: string[] }
export interface RuleSummary { tag?: string }
export interface SkillSummary { ability: string }
export interface AbilitySummary { abbr: string }
export interface FeatSummary { category?: string; prerequisite?: string }
export interface ClassSummary { hitDie?: string; primaryAbility?: string; saves?: string }
/** A class feature: its class, the level it comes at (2024), the subclass it belongs to, and for a part of a larger
 *  feature (Beast Shapes of Wild Shape, Flurry of Blows of Ki) that feature's name. */
export interface FeatureSummary { className: string; level?: number; subclass?: string; feature?: string }
export type Summary = SpellSummary | MonsterSummary | ItemSummary | ConditionSummary | RuleSummary | SkillSummary
  | AbilitySummary | FeatSummary | ClassSummary | FeatureSummary | Record<string, never>;

/** One rules entry as stored in e/<file>.json. */
export interface StoredEntry {
  id: string; type: EntryType; name: string;
  /** Typed summary fields for the card. */
  s: Summary;
  /** Short plain text for a tooltip. */
  text: string;
  /** Full body as HTML (no heading, no ids). */
  html: string;
  /** Anchor in the book (deep link #book/<book>/<anchor>). */
  anchor: string;
}

export interface EntryFile {
  book: BookId; attribution: string; changes: string;
  entries: Record<string, StoredEntry>;
}

export interface PageFile {
  book: BookId; attribution: string; changes: string;
  id: string; title: string; chapter: string; html: string;
}

/** Term index (terms.json): names, aliases and inflected forms for finding rules terms in running text. */
export interface TermFile {
  book: BookId; edition: Edition; attribution: string; changes: string;
  /** [id, name, type] per entry; forms point at these by index. */
  entries: [string, string, EntryType][];
  /** Lower-cased form → entry indexes (most relevant first). */
  forms: Record<string, number[]>;
  /** Case-sensitive abbreviations (AC, HP, DC, Str.) → entry indexes. */
  abbr: Record<string, number[]>;
  /** Forms that are also ordinary English words: link only when tagged, capitalised mid-sentence, or followed by a cue. */
  common: string[];
}

export interface Source { id: string; name: string; url: string; sha256: string; retrieved: string; license: string; role: string }

export interface BookIndex {
  id: BookId; title: string; short: string; edition: Edition; editionLabel: string; version: string;
  license: { name: string; url: string };
  attribution: string;
  /** What Wizards asks of everyone who uses the text, quoted from the legal page. */
  attributionNote: string;
  /** The licensor's notice about CC-BY-4.0's disclaimer of warranties, from the legal page. */
  disclaimer: string;
  changes: string;
  sources: Source[];
  chapters: { id: string; title: string; pages: number[] }[];
  pages: { id: string; title: string; chapter: number; bytes: number }[];
  /** Every heading, and every titled table at level 6: [anchor, title, level, page index, entry type or ''] in reading order. */
  sections: [string, string, number, number, EntryType | ''][];
  files: string[];
  bytes: number;
}

export interface Catalog {
  books: { id: BookId; title: string; short: string; edition: Edition; editionLabel: string; version: string; license: string; bytes: number; files: string[] }[];
}
