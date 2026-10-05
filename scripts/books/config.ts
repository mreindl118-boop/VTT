// The two open rules books and the pinned sources they are built from. Everything here is checked into git;
// `npm run books` downloads the sources listed in sources.json, verifies their SHA-256 and regenerates
// app/public/books/** byte for byte.
import type { BookId, Edition } from '../../app/src/books/types.ts';
import { ATTRIBUTION, CHANGES, DISCLAIMER } from '../../app/src/books/attribution.ts';

export { CHANGES, DISCLAIMER };

/** A correction to the source Markdown, checked against the official PDF. Applied before parsing; the build stops
 *  if `find` does not occur exactly `count` times (default 1), so a changed source cannot be patched silently. */
export interface Patch { find: string; replace: string; count?: number; why: string }

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
  /** Extra names for entries: lower-case alias → entry id. The build stops if an id is missing. */
  aliases: Record<string, string>;
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
    patches: [],
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
