# Rules books: the 2014 and 2024 rules

mistLAB ships the two open rules cores of fifth edition as a book list in the Library (Books tab), for the DM only:

| Book | Edition label | Directory |
|---|---|---|
| System Reference Document 5.2.1 | 2024 rules · SRD 5.2.1 | `app/public/books/srd-5.2.1/` |
| System Reference Document 5.1 | 2014 rules · SRD 5.1 | `app/public/books/srd-5.1/` |

Both are released by Wizards of the Coast under the Creative Commons Attribution 4.0 International licence
(CC-BY-4.0, https://creativecommons.org/licenses/by/4.0/legalcode), which allows redistribution with attribution.
This is the only book text in the repo. Curse of Strahd is not open and stays out: `tests/no-book-content.test.ts`
guards every other path and exempts only `app/public/books/srd-*` and `catalog.json`.

## Attribution

Copied verbatim (curly quotes included) from page 1, "Legal Information", of each official PDF. The statements live in
`app/src/books/attribution.ts`, are written into every generated file (`attribution` field), into each book's
`ATTRIBUTION.md`, onto each book's title page in the reader, onto every page footer, into every lookup result
(`RuleEntry.attribution`, for card footers) and into Help.

SRD 5.2.1:

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

SRD 5.1:

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Both PDFs ask that no other attribution to Wizards be added, so none is. CC-BY-4.0 section 3(a) also asks us to say
that the material was changed; this line (ours, not attributed to Wizards) goes with every file:

> Converted from the official PDF to Markdown (by the your5e/5e-srd-markdown project) and from there to HTML and JSON, reformatted and indexed for mistLAB. No rules text was changed.

## Sources

Pinned in `scripts/books/sources.json` with URL, SHA-256 and retrieval date. The build stops on a hash mismatch.

| Source | Use | Licence |
|---|---|---|
| your5e/5e-srd-markdown `dnd/521/SRD_CC_v5.2.1.md` at f1f5060 | The 2024 book: chapters, entries, index | SRD text, CC-BY-4.0 |
| your5e/5e-srd-markdown `dnd/51/SRD_CC_v5.1.md` at f1f5060 | The 2014 book | SRD text, CC-BY-4.0 |
| 5e-bits/5e-srd-api `packages/5e-database/src/2024/en` (Monsters, Spells) at 05c109e | Cross-check of parsed stat blocks and spells (not shipped) | Data is SRD text; code MIT (not used) |
| 5e-bits/5e-srd-api `packages/5e-database/src/2014/en` (Monsters, Spells) at 05c109e | Cross-check for the 2014 book (not shipped) | as above |
| Official `SRD_CC_v5.2.1.pdf` (sha256 8974902d…) via the your5e mirror | Fidelity check with `pdftotext` (never shipped or committed) | CC-BY-4.0 |
| Official `SRD_CC_v5.1.pdf` (sha256 2504d2a0…) via the your5e mirror | Fidelity check (never shipped or committed) | CC-BY-4.0 |

Why this choice: your5e is the only complete, clean 5.2.1 conversion (5e-bits and Open5e hold 5.2, which lacks the 15
magic items restored in 5.2.1, the Octopus and the Rules Glossary). One text source per book keeps the reader and the
lookups in agreement; the 5e-bits JSON is an independent conversion used to catch parsing errors. Not used:
Open5e (5.2 only, no glossary), Tabyltop (share-alike label on its monster JSON), downfallx (non-conforming
attribution), springbov and sycarion (incomplete). The official hosts (wizards.com, dndbeyond.com) were blocked from
the build container, so the PDFs come from the your5e mirror; two independent copies of the 5.2.1 PDF share its hash.

## Regenerating

```
npm run books              # download (or reuse scripts/books/.cache), verify hashes, convert, write app/public/books/**
npm run books -- --offline # use only the cache
npm run books:check        # write nothing; fail unless a fresh build is byte-identical to the committed data
npm run books -- --no-pdf  # skip the PDF fidelity check (it needs pdftotext)
```

The cache (`scripts/books/.cache/`) is gitignored. The generated data is committed, so the app builds and works
without network. Each run prints counts and the two checks, for example (2024 book): 339 spells, 330 monsters,
455 items, 15 conditions, 226 rules; 323 of 323 monsters found in 5e-bits agree on AC, HP, CR, Str, Dex and Wis;
910 of 910 spell, monster, condition and rule names appear in the official PDF. Known differences against 5e-bits
are errors or edition changes on their side (Cult Fanatic's 33 hit points and the evocation healing spells are as
printed in SRD 5.1).

## Layout of a book

```
<book>/index.json        title, edition label, version, licence, attribution, changes, sources, chapters,
                         pages, every heading [anchor, title, level, page, entry type] (the search index), files, size
<book>/p/<page>.json     one lazy page of HTML (a chapter, or ~90 KB of one at section boundaries)
<book>/e/spells.json     typed entries by id: spell, monster, item, rules (condition, rule, damage, ability, skill,
     monsters.json       creature type) and character (feat, class, class feature, species, background)
     items.json ...
<book>/terms.json        term index: names, aliases, plurals, abbreviations and common-word flags
<book>/ATTRIBUTION.md    attribution, changes, licence, sources
catalog.json             the book list (ids, labels, sizes, file lists for Save for offline)
```

Section anchors are stable: an entry's anchor is its id with `-` for `:` (`spell-fireball`, `condition-prone`,
`monster-wolf`), chapters use their slug (`rules-glossary`). Deep links are `#book/<book>/<anchor>`.

Nothing loads until a book is opened: the reader's code is its own chunk, the data is fetched on demand, and
**Save for offline** caches every file of a book (plus the reader's code) through the service worker's
`cache-pack` message into the `mistlab-books-v1` cache, which survives app updates.

## Lookup API (for rules tooltips and stat blocks)

`app/src/books/lookup.ts`:

- `lookup(termOrId, edition?, { type?, fallback? })` returns a `RuleEntry` `{ id, type, name, edition, book, summary,
  text, html, section: { book, anchor, href }, attribution }`. It accepts ids (`spell:fireball`), names, plurals
  (`wolves`), cue words (`prone condition`, `fire damage`), abbreviations (`AC`, `Str`) and inverted item names.
  With no edition it uses the **Rules edition** preference (2024 by default, 2014 as the option; Library, Books tab).
- `lookupAll(term)` returns every meaning (Shield is a spell and armour).
- `findTerms(text, await termIndex())` returns the spans of rules terms in running text. Names that are also
  ordinary English words (light, shield, command, guidance, fly, prone, fire …) count only when tagged
  (`[[Light]]`, `[[spell:light]]`, `[[Command|the command spell]]`), capitalised mid-sentence, or followed by
  their cue word (`light cantrip`, `prone condition`, `fire damage`).
- Types: spell, condition, monster, item, rule (glossary terms, actions, weapon and mastery properties),
  damage, ability, skill, creature-type, feat, class, feature, species, background. `TYPE_META` gives each a label
  and a colour token (`--t-spell`, `--t-condition` …) for colour-coded cards.

## Maintenance

- 5e-bits/5e-database was archived on 2026-09-23; its data lives on in 5e-bits/5e-srd-api.
- Wizards numbers later errata 5.2.2 and so on. To move to a new version, add its sources to `sources.json`, update
  `scripts/books/config.ts` (chapters, attribution copied from the new PDF's page 1) and run `npm run books`.
