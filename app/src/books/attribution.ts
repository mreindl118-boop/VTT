// The attribution the CC-BY-4.0 rules books require, copied verbatim (curly quotes included) from page 1,
// "Legal Information", of each official PDF. The converter writes these into every book file; Help lists them.
// Kept tiny and dependency-free: the main bundle imports it for the Help sheet.

export const ATTRIBUTION = {
  'srd-5.2.1': 'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  'srd-5.1': 'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
} as const;

/** CC-BY-4.0 section 3(a)(1)(B): say that the material was changed. Not attributed to Wizards. */
export const CHANGES = 'Converted from the official PDF to Markdown (by the your5e/5e-srd-markdown project) and from there to HTML and JSON, reformatted and indexed for mistLAB. No rules text was changed.';
