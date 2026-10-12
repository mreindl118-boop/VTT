// The two open rules books and the pinned sources they are built from. Everything here is checked into git;
// `npm run books` downloads the sources listed in sources.json, verifies their SHA-256 and regenerates
// app/public/books/** byte for byte.
import type { BookId, Edition } from '../../app/src/books/types.ts';
import { ATTRIBUTION, CHANGES, DISCLAIMER } from '../../app/src/books/attribution.ts';

export { CHANGES, DISCLAIMER };

/** A correction to the source Markdown, checked against the official PDF. Applied before parsing; the build stops
 *  if `find` does not occur exactly `count` times (default 1), so a changed source cannot be patched silently.
 *  `within` narrows the search to one part of the book, for a line that is not unique in the whole of it (an item of one
 *  class's spell list): each marker of `from` is found after the one before it, and the part ends at the next `to`.
 *  The build stops if a marker is missing. */
export interface Patch { find: string; replace: string; count?: number; within?: { from: string[]; to: string }; why: string }

/** Insert a spell the Markdown dropped into one class's spell list, between the two spells the PDF prints around it. */
const listItem = (cls: string, level: string, after: string, spell: string, before: string): Patch => ({
  within: { from: [`\n## ${cls} Spells\n`, `\n### ${level}\n`], to: '\n#' },
  find: `- _${after}_\n- _${before}_\n`,
  replace: `- _${after}_\n- _${spell}_\n- _${before}_\n`,
  why: `${cls} spell list, ${level}: ${spell} restored between ${after} and ${before}, as in the PDF`,
});

/** A rules section that answers a name several sections share ('Hit Points' is both a Constitution paragraph and the
 *  combat rule). `path` names the section by its heading and the headings above it, nearest last
 *  ('Damage and Healing / Hit Points'); `lead` picks a lead-in paragraph inside it ('Armor Class (AC)'). The build
 *  stops if the path is not found. */
export interface RuleSource { name: string; path: string; lead?: string }

export interface ChapterSpec {
  title: string;
  /** Heading that starts the chapter: [markdown level, exact heading text]. */
  start: [number, string];
  /** Chapter made of several top-level headings: they become sections under a synthetic chapter heading. */
  group?: boolean;
  /** Promote a sub-heading (e.g. '## Animals') to its own chapter: shift headings up by this many levels. */
  promote?: number;
}

export interface BookConfig {
  id: BookId; title: string; short: string; edition: Edition; editionLabel: string; version: string;
  /** Source id (sources.json) of the cleaned single-file Markdown. */
  markdown: string;
  /** Source ids used only to cross-check parsed stat blocks and spells (not shipped). */
  crosscheck: { monsters: string; spells: string };
  /** Source id of the official PDF (fidelity reference only; never shipped or committed). */
  pdf: string;
  attribution: string;
  attributionNote: string;
  /** CC-BY-4.0 s.3(a)(1)(B): what this copy changed. */
  changes: string;
  chapters: ChapterSpec[];
  /** Corrections to the source Markdown (errata against the PDF). */
  patches: Patch[];
  /** Rejoin words that the PDF extraction split ('Na ture', 'ar mor'); real phrases listed here stay apart. */
  repairWords?: { keep: string[] };
  /** Restore table titles the Markdown dropped, from the PDF (scripts/books/titles/<id>.json, made by titles.ts). */
  tableTitles?: boolean;
  /** PDF pages of the class spell lists (2014): the build reads them (spelllists.ts, committed as
   *  scripts/books/pdf/<id>-spell-lists.json) and stops unless every spell's classes agree with them. */
  spellListPages?: [number, number];
  /** Extra names for entries: lower-case alias → entry id. The build stops if an id is missing. */
  aliases: Record<string, string>;
  /** Rules whose name several sections share: the section that answers (2014 has no glossary to settle it). */
  ruleSources?: RuleSource[];
  /** Equipment rows that are kinds of one thing ('Saddles': Exotic, Military …; '_Holy symbol:_ Amulet'): the table
   *  header or row prefix → the thing's name. The group becomes an item of its own (with the book's paragraph about it
   *  and its kinds as variants), and each row is named after it ('Saddle, Exotic', 'Holy Symbol, Amulet') unless
   *  `keepRows` (a Lute stays a Lute; it still shows the Musical Instrument paragraph). The build stops if a group is
   *  not found. (2024 tables inside an item's own section, such as Holy Symbol's, are grouped the same way.) */
  groupedRows?: Record<string, string | { name: string; keepRows: true }>;
}

export const LICENSE = { name: 'Creative Commons Attribution 4.0 International (CC-BY-4.0)', url: 'https://creativecommons.org/licenses/by/4.0/legalcode' };

// The statements below are copied verbatim (curly quotes included) from page 1, "Legal Information", of each official PDF.
export const BOOKS: BookConfig[] = [
  {
    id: 'srd-5.2.1', title: 'System Reference Document 5.2.1', short: 'SRD 5.2.1', edition: '2024', editionLabel: '2024 rules · SRD 5.2.1', version: '5.2.1',
    markdown: 'your5e-srd-5.2.1-md', crosscheck: { monsters: '5e-bits-2024-monsters', spells: '5e-bits-2024-spells' }, pdf: 'wotc-srd-5.2.1-pdf',
    attribution: ATTRIBUTION['srd-5.2.1'],
    attributionNote: 'Please do not include any other attribution to Wizards or its parent or affiliates other than that provided above. You may, however, include a statement on your work indicating that it is “compatible with fifth edition” or “5E compatible.”',
    changes: CHANGES['srd-5.2.1'],
    patches: [
      { find: 'the GM rolls on the table to determine what happens.\n\n| 1d100 ', replace: 'the GM rolls on the table to determine what happens.\n\n| 1d10  ', why: 'Efreeti Bottle: the PDF table is rolled on 1d10 (rows 1, 2–9, 10)' },
      { find: '| Pace   | Distance Traveled Per - Minute   | Hour    | Day      |', replace: '| Pace | Distance Traveled per Minute | per Hour | per Day |', why: 'Travel Pace: the PDF’s two-row header (“Distance Traveled Per …” over Minute, Hour, Day) was merged into one garbled row' },
      { find: 'https://creativecommons.org/licenses/by/4.0/ legalcode.', replace: 'https://creativecommons.org/licenses/by/4.0/legalcode.', why: 'Legal Information: a line break inside the licence URL became a space' },
    ],
    repairWords: { keep: ['a bout', 'a loud', 'arm or'] }, // real phrases the rule would otherwise join
    // What a stat block's parts mean, from the Monsters chapter.
    ruleSources: [
      { name: 'Multiattack', path: 'Actions / Multiattack' },
      { name: 'Legendary Actions', path: 'Parts of a Stat Block / Legendary Actions' },
    ],
    tableTitles: true,
    aliases: {
      grapple: 'rule:grappling', grapples: 'rule:grappling', grappling: 'rule:grappling',
      shove: 'rule:unarmed-strike', shoving: 'rule:unarmed-strike', 'shove a creature': 'rule:unarmed-strike',
      'advantage and disadvantage': 'rule:advantage',
      suffocating: 'rule:suffocation',
      'hit dice': 'rule:hit-point-dice', 'hit die': 'rule:hit-point-dice', 'hit point die': 'rule:hit-point-dice',
      'proficiency bonus': 'rule:proficiency',
      inspiration: 'rule:heroic-inspiration',
      'half cover': 'rule:cover', 'three-quarters cover': 'rule:cover', 'total cover': 'rule:cover',
      'passive checks': 'rule:passive-perception', 'passive check': 'rule:passive-perception',
      plate: 'item:plate-armor',
      goblin: 'monster:goblin-warrior', goblins: 'monster:goblin-warrior',
      'healing potion': 'item:potion-of-healing', 'healing potions': 'item:potion-of-healing',
      '+1 weapon': 'item:weapon-1-2-or-3', '+2 weapon': 'item:weapon-1-2-or-3', '+3 weapon': 'item:weapon-1-2-or-3',
      '+1 armor': 'item:armor-1-2-or-3', '+2 armor': 'item:armor-1-2-or-3', '+3 armor': 'item:armor-1-2-or-3',
      // The 2014 names of creatures the 2024 rules renamed, so a module written for 2014 finds the 2024 stat block.
      thug: 'monster:tough', veteran: 'monster:warrior-veteran', 'cult fanatic': 'monster:cultist-fanatic', acolyte: 'monster:priest-acolyte',
      bugbear: 'monster:bugbear-warrior', centaur: 'monster:centaur-trooper', gnoll: 'monster:gnoll-warrior', hobgoblin: 'monster:hobgoblin-warrior',
      kobold: 'monster:kobold-warrior', merfolk: 'monster:merfolk-skirmisher', sahuagin: 'monster:sahuagin-warrior', minotaur: 'monster:minotaur-of-baphomet',
      shrieker: 'monster:shrieker-fungus', 'flying sword': 'monster:animated-flying-sword', 'rug of smothering': 'monster:animated-rug-of-smothering',
      'poisonous snake': 'monster:venomous-snake', 'giant poisonous snake': 'monster:giant-venomous-snake', 'swarm of poisonous snakes': 'monster:swarm-of-venomous-snakes',
      'sea horse': 'monster:seahorse', 'giant sea horse': 'monster:giant-seahorse', 'swarm of quippers': 'monster:swarm-of-piranhas',
      ki: 'feature:monks-focus', 'ki points': 'feature:monks-focus',
      'legendary action': 'rule:legendary-actions',
    },
    chapters: [
      { title: 'Legal Information', start: [1, 'Legal Information'] },
      { title: 'Playing the Game', start: [1, 'Playing the Game'] },
      { title: 'Character Creation', start: [1, 'Character Creation'] },
      { title: 'Classes', start: [1, 'Classes'] },
      { title: 'Character Origins', start: [1, 'Character Origins'] },
      { title: 'Feats', start: [1, 'Feats'] },
      { title: 'Equipment', start: [1, 'Equipment'] },
      { title: 'Spells', start: [1, 'Spells'] },
      { title: 'Rules Glossary', start: [1, 'Rules Glossary'] },
      { title: 'Gameplay Toolbox', start: [1, 'Gameplay Toolbox'] },
      { title: 'Magic Items', start: [1, 'Magic Items'] },
      { title: 'Monsters', start: [1, 'Monsters'] },
      { title: 'Monsters A-Z', start: [1, 'Monsters A-Z'] },
      { title: 'Animals', start: [2, 'Animals'], promote: 1 },
    ],
  },
  {
    id: 'srd-5.1', title: 'System Reference Document 5.1', short: 'SRD 5.1', edition: '2014', editionLabel: '2014 rules · SRD 5.1', version: '5.1',
    markdown: 'your5e-srd-5.1-md', crosscheck: { monsters: '5e-bits-2014-monsters', spells: '5e-bits-2014-spells' }, pdf: 'wotc-srd-5.1-pdf',
    attribution: ATTRIBUTION['srd-5.1'],
    attributionNote: 'Please do not include any other attribution regarding Wizards other than that provided above. You may, however, include a statement on your work that it is “compatible with fifth edition” or “5E compatible.”',
    changes: CHANGES['srd-5.1'],
    // What the Markdown dropped or garbled, each checked against the official PDF (pages 105–113 for the spell lists,
    // read column by column).
    patches: [
      listItem('Cleric', '6th Level', 'Heal', 'Heroes\' Feast', 'Planar Ally'),
      listItem('Druid', '6th Level', 'Heal', 'Heroes\' Feast', 'Move Earth'),
      listItem('Ranger', '1st Level', 'Goodberry', 'Hunter\'s Mark', 'Jump'),
      listItem('Sorcerer', '2nd Level', 'Enhance Ability', 'Enlarge/Reduce', 'Gust of Wind'),
      listItem('Wizard', '2nd Level', 'Arcane Lock', 'Arcanist\'s Magic Aura', 'Blindness/Deafness'),
      listItem('Wizard', '2nd Level', 'Detect Thoughts', 'Enlarge/Reduce', 'Flaming Sphere'),
      listItem('Wizard', '8th Level', 'Clone', 'Control Weather', 'Demiplane'),
      {
        find: '#### Traits\n\n_**Keen Hearing and Smell.**_ The grimlock has advantage',
        replace: '#### Traits\n\n_**Blind Senses.**_ The grimlock can\'t use its blindsight while deafened and unable to smell.\n\n_**Keen Hearing and Smell.**_ The grimlock has advantage',
        why: 'Grimlock: the Blind Senses trait, the first of its traits in the PDF, was missing',
      },
      {
        find: '| Two of clubs      | Kobold                           |\n',
        replace: '| Two of clubs      | Kobold                           |\n| Jokers (2)        | You (the deck\'s owner)          |\n',
        why: 'Deck of Illusions: the table\'s last row, Jokers (2), was missing',
      },
      {
        find: '| Meals (per day), Meat, chunk     | 3 sp   |',
        replace: '| Meat, chunk                      | 3 sp   |',
        why: 'Food, Drink, and Lodging: “Meat, chunk” is its own row in the PDF, not one of the Meals',
      },
      {
        find: '| Destroys Undead of CR   |\n|-------------------------|\n| 1/2 or lower            |\n| 1 or lower              |\n| 2 or lower              |\n| 3 or lower              |\n| 4 or lower              |\n',
        replace: '| Cleric Level | Destroys Undead of CR |\n|---|---|\n| 5th | 1/2 or lower |\n| 8th | 1 or lower |\n| 11th | 2 or lower |\n| 14th | 3 or lower |\n| 17th | 4 or lower |\n',
        why: 'Destroy Undead: the table had lost its Cleric Level column (5th, 8th, 11th, 14th, 17th)',
      },
      {
        find: '| Level   |   Bonus Proficiency |',
        replace: '| Level   |   Proficiency Bonus |',
        why: 'The Warlock table: the column is “Proficiency Bonus” in the PDF, as in every other class table',
      },
      {
        find: '| Tent, two -person                   |',
        replace: '| Tent, two-person                    |',
        why: 'Adventuring Gear: “Tent, two-person” had a space before the hyphen',
      },
    ],
    // Sections that share a name with another: the combat rule answers, not the ability's paragraph or the travel note.
    ruleSources: [
      { name: 'Hit Points', path: 'Damage and Healing / Hit Points' },
      { name: 'Difficult Terrain', path: 'Movement and Position / Difficult Terrain' },
      { name: 'Initiative', path: 'The Order of Combat / Initiative' },
      // 2014 has no Armor Class rule of its own; the Armor section's lead-in defines it.
      { name: 'Armor Class', path: 'Equipment / Armor', lead: 'Armor Class (AC)' },
      // The one sense that Vision and Light leaves out is described with the monsters.
      { name: 'Tremorsense', path: 'Senses / Tremorsense' },
      // What a stat block's parts mean, from the monsters' introduction (the Hunter's Multiattack is a class feature).
      { name: 'Multiattack', path: 'Actions / Multiattack' },
      { name: 'Grapple Rules for Monsters', path: 'Grapple Rules for Monsters' },
      { name: 'Legendary Creatures', path: 'Monsters / Legendary Creatures' },
      { name: 'Legendary Actions', path: 'Legendary Creatures / Legendary Actions' },
      { name: 'Lair Actions', path: 'A Legendary Creature\'s Lair / Lair Actions' },
    ],
    groupedRows: {
      Saddles: 'Saddle', 'Holy symbol': 'Holy Symbol', 'Arcane focus': 'Arcane Focus', 'Druidic focus': 'Druidic Focus',
      'Gaming set': { name: 'Gaming Set', keepRows: true }, 'Musical instrument': { name: 'Musical Instrument', keepRows: true },
    },
    spellListPages: [105, 114],
    aliases: {
      grapple: 'rule:grappling', grapples: 'rule:grappling',
      shove: 'rule:shoving-a-creature', shoving: 'rule:shoving-a-creature', 'shove a creature': 'rule:shoving-a-creature',
      advantage: 'rule:advantage-and-disadvantage', disadvantage: 'rule:advantage-and-disadvantage',
      suffocation: 'rule:suffocating',
      'hit dice': 'rule:short-rest', 'hit die': 'rule:short-rest',
      'half cover': 'rule:cover', 'three-quarters cover': 'rule:cover', 'total cover': 'rule:cover',
      'passive perception': 'rule:passive-checks', 'passive check': 'rule:passive-checks',
      vulnerability: 'rule:damage-resistance-and-vulnerability', vulnerabilities: 'rule:damage-resistance-and-vulnerability',
      resistance: 'rule:damage-resistance-and-vulnerability', resistances: 'rule:damage-resistance-and-vulnerability',
      immunity: 'rule:damage-resistance-and-vulnerability', immunities: 'rule:damage-resistance-and-vulnerability',
      'unarmed strike': 'rule:melee-attacks', 'unarmed strikes': 'rule:melee-attacks',
      'plate armor': 'item:plate',
      'healing potion': 'item:potion-of-healing', 'healing potions': 'item:potion-of-healing',
      '+1 weapon': 'item:weapon-1-2-or-3', '+2 weapon': 'item:weapon-1-2-or-3', '+3 weapon': 'item:weapon-1-2-or-3',
      '+1 armor': 'item:armor-1-2-or-3', '+2 armor': 'item:armor-1-2-or-3', '+3 armor': 'item:armor-1-2-or-3',
      'heroic inspiration': 'rule:inspiration',
      'spell slot': 'rule:spell-slots',
      'playing cards': 'item:playing-card-set', 'playing card': 'item:playing-card-set', dice: 'item:dice-set',
      'lair action': 'rule:lair-actions', 'legendary action': 'rule:legendary-actions',
      'lightly obscured': 'rule:vision-and-light', 'heavily obscured': 'rule:vision-and-light', 'bright light': 'rule:vision-and-light', 'dim light': 'rule:vision-and-light',
    },
    chapters: [
      { title: 'Legal Information', start: [1, 'Legal Information'] },
      { title: 'Races', start: [1, 'Races'] },
      { title: 'Classes', start: [1, 'Barbarian'], group: true },
      { title: 'Character Options', start: [1, 'Beyond 1st Level'], group: true },
      { title: 'Equipment', start: [1, 'Equipment'], group: true },
      { title: 'Feats', start: [1, 'Feats'], group: true },
      { title: 'Using Ability Scores', start: [1, 'Using Ability Scores'], group: true },
      { title: 'Adventuring', start: [1, 'Time'], group: true },
      { title: 'Combat', start: [1, 'The Order of Combat'], group: true },
      { title: 'Spellcasting', start: [1, 'Spellcasting'], group: true },
      { title: 'Spells', start: [1, 'Spell Descriptions'] },
      { title: 'Traps, Diseases, Madness, Objects and Poisons', start: [1, 'Traps'], group: true },
      { title: 'Magic Items', start: [1, 'Magic Items'], group: true },
      { title: 'Monsters', start: [1, 'Monsters'], group: true },
      { title: 'Appendix PH-A: Conditions', start: [1, 'Appendix PH-A: Conditions'] },
      { title: 'Appendix PH-B: Fantasy-Historical Pantheons', start: [1, 'Appendix PH-B: Fantasy-Historical Pantheons'] },
      { title: 'Appendix PH-C: The Planes of Existence', start: [1, 'Appendix PH-C: The Planes of Existence'] },
      { title: 'Appendix MM-A: Miscellaneous Creatures', start: [1, 'Appendix MM-A: Miscellaneous Creatures'] },
      { title: 'Appendix MM-B: Nonplayer Characters', start: [1, 'Appendix MM-B: Nonplayer Characters'] },
    ],
  },
];
