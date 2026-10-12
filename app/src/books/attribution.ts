// The attribution the CC-BY-4.0 rules books require, copied verbatim (curly quotes included) from page 1,
// "Legal Information", of each official PDF. The converter writes these into every book file; Help lists them.
// Kept tiny and dependency-free: Help loads it on demand (it is not in the main bundle).

export const ATTRIBUTION = {
  'srd-5.2.1': 'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  'srd-5.1': 'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
} as const;

/** The licensor's notice about CC-BY-4.0's disclaimer (s.3(a)(1)(A)(iv)), verbatim from page 1 of both PDFs. */
export const DISCLAIMER = 'Section 5 of CC-BY-4.0 includes a Disclaimer of Warranties and Limitation of Liability that limits our liability to you.';

/** CC-BY-4.0 section 3(a)(1)(B): what was changed, per book. Ours, not attributed to Wizards. */
export const CHANGES = {
  'srd-5.2.1': 'Converted from the official PDF to Markdown by the your5e/5e-srd-markdown project, which lists its own changes: it removed the table of contents; renumbered the steps of D20 Tests; moved tables and sidebars to where they are used and removed their titles and the sentences that named them (for example “as shown on the Travel Pace table. The table states” became “The table states”); changed “on [the] table” to “in [the] table”; gave tables with several header rows a single header row; restructured side-by-side tables; split tables at their mid-table headings; and laid out the monster ability tables as score, modifier and saving throw. mistLAB converted that Markdown to HTML and JSON, reformatted and indexed it, and, checked against the official PDF, restored the table titles (not the sentences that named them), rejoined words split by the PDF extraction, merged the Travel Pace header into one row, set the Efreeti Bottle table’s die back to 1d10 as printed, rejoined the licence URL on the legal page and removed stray italics around punctuation. Apart from formatting and these changes, no rules text was changed.',
  'srd-5.1': 'Converted from the official PDF to Markdown by the your5e/5e-srd-markdown project, which lists its own changes: it gave class tables with several header rows a single header row; added a “Traits” heading to stat blocks; fixed the “Components” typo in Contagion; set “Petrifying Gaze” in bold italics like other traits; split the Armor, Saddles, Scrying, Tack, Harness, and Drawn Vehicles and Weapons tables at their mid-table headings; moved each pantheon’s table of deities into its description; added subclass introduction headings to the Barbarian, Bard, Cleric and Druid; and laid out the monster ability tables as score, modifier and saving throw in place of the Saving Throws line. mistLAB converted that Markdown to HTML and JSON, reformatted and indexed it, and, checked against the official PDF, restored what the Markdown had dropped: seven spell-list entries (Heroes’ Feast for the Cleric and Druid, Hunter’s Mark for the Ranger, Enlarge/Reduce for the Sorcerer and Wizard, Arcanist’s Magic Aura and Control Weather for the Wizard), the Grimlock’s Blind Senses trait, the Jokers row of the Deck of Illusions table, the Cleric Level column of the Destroy Undead table and the Saving Throws line of each stat block. It also made “Meat, chunk” its own row of the Food, Drink, and Lodging table as printed, set the Warlock table’s “Bonus Proficiency” heading back to “Proficiency Bonus” as printed, rejoined “Tent, two-person” and removed stray italics around punctuation. Apart from formatting and these changes, no rules text was changed.',
} as const;

/** This module's own URL (its chunk in a build), so Save for offline can keep it: Help needs it with no network. */
export const ATTRIBUTION_URL = import.meta.url;

/** The Help sheet's entry for the books (loaded with Help, so the main bundle stays the same size). */
export const HELP_BOOKS = 'Library, then Books: the 2014 rules (SRD 5.1) and the 2024 rules (SRD 5.2.1) with contents, search and Save for offline. Search a condition, spell or monster to jump straight to it; Map takes you back. Rules edition picks which book answers look-ups. Players never see the books.';

/** Fill Help's placeholder (<dt data-attrib>) with the books entry and every attribution statement. */
export function helpInto(root: ParentNode): void {
  const dt = root.querySelector('[data-attrib]');
  if (!dt) return;
  dt.removeAttribute('data-attrib');
  const dd = (cls: string, t: string) => `<dd${cls ? ` class="${cls}"` : ''}>${t}</dd>`;
  dt.insertAdjacentHTML('afterend', [
    dd('', HELP_BOOKS), '<dt>Rules text</dt>',
    dd('attrib', ATTRIBUTION['srd-5.2.1']), dd('attrib', ATTRIBUTION['srd-5.1']), dd('attrib', DISCLAIMER),
    // The changes notes are long: one tap opens each, so Help stays short (CC-BY's indication of changes is the summary).
    dd('attrib changes', `<details><summary>What this copy of SRD 5.2.1 changed</summary>${CHANGES['srd-5.2.1']}</details>`),
    dd('attrib changes', `<details><summary>What this copy of SRD 5.1 changed</summary>${CHANGES['srd-5.1']}</details>`),
  ].join(''));
}
