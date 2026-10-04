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

/** Label and colour family per entry type. Colours are CSS custom properties defined with the reader styles. */
export const TYPE_META: Record<EntryType, { label: string; color: string }> = {
  spell: { label: 'Spell', color: 'var(--t-spell, #6b4fa0)' },
  condition: { label: 'Condition', color: 'var(--t-condition, #b8661c)' },
  monster: { label: 'Monster', color: 'var(--t-monster, #9b2335)' },
  item: { label: 'Item', color: 'var(--t-item, #1f7a6d)' },
  rule: { label: 'Rule', color: 'var(--t-rule, #3a5f8f)' },
  damage: { label: 'Damage type', color: 'var(--t-damage, #b0412e)' },
  ability: { label: 'Ability', color: 'var(--t-ability, #4b5d1f)' },
  skill: { label: 'Skill', color: 'var(--t-skill, #5f7a1f)' },
  'creature-type': { label: 'Creature type', color: 'var(--t-creature, #7a4a2e)' },
  feat: { label: 'Feat', color: 'var(--t-feat, #8a6d1f)' },
  class: { label: 'Class', color: 'var(--t-class, #2e5e4e)' },
  feature: { label: 'Class feature', color: 'var(--t-feature, #2e6e6e)' },
  species: { label: 'Species', color: 'var(--t-species, #6d4d7a)' },
  background: { label: 'Background', color: 'var(--t-background, #6e6253)' },
};

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
}
export interface ConditionSummary { effects: string[] }
export interface RuleSummary { tag?: string }
export interface SkillSummary { ability: string }
export interface AbilitySummary { abbr: string }
export interface FeatSummary { category?: string; prerequisite?: string }
export interface ClassSummary { hitDie?: string; primaryAbility?: string; saves?: string }
export interface FeatureSummary { className: string; level?: number; subclass?: string }
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
  changes: string;
  sources: Source[];
  chapters: { id: string; title: string; pages: number[] }[];
  pages: { id: string; title: string; chapter: number; bytes: number }[];
  /** Every heading: [anchor, title, level, page index, entry type or ''] in reading order. */
  sections: [string, string, number, number, EntryType | ''][];
  files: string[];
  bytes: number;
}

export interface Catalog {
  books: { id: BookId; title: string; short: string; edition: Edition; editionLabel: string; version: string; license: string; bytes: number; files: string[] }[];
}
