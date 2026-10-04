// The two open rules books and the pinned sources they are built from. Everything here is checked into git;
// `npm run books` downloads the sources listed in sources.json, verifies their SHA-256 and regenerates
// app/public/books/** byte for byte.
import type { BookId, Edition } from '../../app/src/books/types.ts';
import { ATTRIBUTION, CHANGES } from '../../app/src/books/attribution.ts';

export { CHANGES };

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
  chapters: ChapterSpec[];
}

export const LICENSE = { name: 'Creative Commons Attribution 4.0 International (CC-BY-4.0)', url: 'https://creativecommons.org/licenses/by/4.0/legalcode' };

// The statements below are copied verbatim (curly quotes included) from page 1, "Legal Information", of each official PDF.
export const BOOKS: BookConfig[] = [
  {
    id: 'srd-5.2.1', title: 'System Reference Document 5.2.1', short: 'SRD 5.2.1', edition: '2024', editionLabel: '2024 rules · SRD 5.2.1', version: '5.2.1',
    markdown: 'your5e-srd-5.2.1-md', crosscheck: { monsters: '5e-bits-2024-monsters', spells: '5e-bits-2024-spells' }, pdf: 'wotc-srd-5.2.1-pdf',
    attribution: ATTRIBUTION['srd-5.2.1'],
    attributionNote: 'Please do not include any other attribution to Wizards or its parent or affiliates other than that provided above. You may, however, include a statement on your work indicating that it is “compatible with fifth edition” or “5E compatible.”',
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
      { title: 'Traps, Diseases and Hazards', start: [1, 'Traps'], group: true },
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
