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
  'srd-5.2.1': 'Converted from the official PDF to Markdown by the your5e/5e-srd-markdown project, then to HTML and JSON, reformatted and indexed for mistLAB. That Markdown conversion dropped most table titles and reworded the sentences that named them (for example “as shown on the Travel Pace table. The table states” became “The table states”); mistLAB restored the table titles from the official PDF, but not those sentences. mistLAB also rejoined words split by the PDF extraction and set the Efreeti Bottle table’s die back to 1d10 as printed. Otherwise no rules text was changed.',
  'srd-5.1': 'Converted from the official PDF to Markdown by the your5e/5e-srd-markdown project (which lists its own small corrections, such as a typo fixed in Contagion), then to HTML and JSON, reformatted and indexed for mistLAB. Apart from formatting and those corrections, no rules text was changed.',
} as const;

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
    dd('attrib changes', CHANGES['srd-5.2.1']), dd('attrib changes', CHANGES['srd-5.1']),
  ].join(''));
}
