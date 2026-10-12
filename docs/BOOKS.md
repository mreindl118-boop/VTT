# Rules books: the 2014 and 2024 rules

mistLAB ships the two open rules cores of fifth edition as a book list in the Library (Books tab), for the DM only:

| Book | Edition label | Directory |
|---|---|---|
| System Reference Document 5.2.1 | 2024 rules · SRD 5.2.1 | `app/public/books/srd-5.2.1/` |
| System Reference Document 5.1 | 2014 rules · SRD 5.1 | `app/public/books/srd-5.1/` |

Both are released by Wizards of the Coast under the Creative Commons Attribution 4.0 International licence
(CC-BY-4.0, https://creativecommons.org/licenses/by/4.0/legalcode), which allows redistribution with attribution.
This is the only book text in the repo. Curse of Strahd is not open and stays out: `tests/no-book-content.test.ts`
guards every other path and exempts only `app/public/books/srd-*` and `catalog.json`. Beside the converter sit two
small files of SRD data read from the PDFs (`scripts/books/titles/srd-5.2.1.json`, the table titles, and
`scripts/books/pdf/srd-5.1-spell-lists.json`, the class spell lists); each carries its book's attribution, and the
guard checks that.

## Attribution

Copied verbatim (curly quotes included) from page 1, "Legal Information", of each official PDF. The statements live in
`app/src/books/attribution.ts`, are written into every generated file (`attribution` field), into each book's
`ATTRIBUTION.md`, onto each book's title page in the reader, onto every page footer, into every lookup result
(`RuleEntry.attribution`, for card footers) and into Help.

SRD 5.2.1:

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

SRD 5.1:

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Both PDFs ask that no other attribution to Wizards be added, so none is. Both also carry the licensor's notice
about CC-BY-4.0's disclaimer, which goes into every `ATTRIBUTION.md`, onto each title page and into Help:

> Section 5 of CC-BY-4.0 includes a Disclaimer of Warranties and Limitation of Liability that limits our liability to you.

CC-BY-4.0 section 3(a)(1)(B) also asks us to say what was changed. These notes (ours, not attributed to Wizards) go
with every file of each book (`CHANGES` in `app/src/books/attribution.ts`):

SRD 5.2.1:

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

SRD 5.1:

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

On the title page each note is shown in full; in Help and in each page's footer it sits behind a one-tap
“what changed” summary, so the statement that the copy was changed stays visible and the long list does not.

## Corrections against the PDF

The converter reads the your5e Markdown, then repairs what that conversion got wrong, each repair checked against the
official PDF (`scripts/books/config.ts`, `prepare()` and `placeTitles()` in `scripts/books/convert.ts`):

- **Table titles (SRD 5.2.1).** The Markdown keeps 94 of the PDF's table titles as headings and drops the rest.
  `scripts/books/titles.ts` reads every title back from the PDF with `pdftohtml -xml` (the titles are set in
  GillSans SemiBold 16 pt, the header row under them in 14–15 pt) and writes `scripts/books/titles/srd-5.2.1.json`
  (committed, so a build without the PDF gives the same data). Each title goes onto its table as a `<caption>` with an
  anchor (`#book/srd-5.2.1/table-travel-pace`), and the search index lists it, so "XP Budget per Character" or
  "Trinkets" is found by name. 193 of the 194 titles land; Rare Languages has no table in the Markdown (it became a
  list). The sentences that named the tables stay as the Markdown reworded them; the changes note says so.
- **Patches** (`patches` in the config; the build stops if a patch no longer matches exactly once): the Efreeti
  Bottle table's die (1d100 in the Markdown, 1d10 in the PDF), the Travel Pace header (the PDF's two-row header was
  merged into "Distance Traveled Per - Minute"), and a space inside the licence URL on the 2024 legal page. The
  legal pages get the PDF's curly quotes, so they quote the attribution exactly.
- **Split words (SRD 5.2.1).** The PDF extraction split some words ("Na ture", "Leather Ar mor", "de pending").
  Two adjacent fragments are joined when the whole word occurs at least twice elsewhere in the book and one fragment
  is rare there; real phrases that the rule would join ("a bout", "a loud", "arm or") are kept apart by a list.
  The build prints every join. SRD 5.1 has none.
- **Stat blocks.** A Traits section that runs on into Multiattack or an attack (Young Green Dragon, 2024) gets its
  Actions heading back. 2014 stat blocks print the PDF's **Saving Throws** line again (the saves that differ from
  the modifier, which are the proficient ones); the Markdown had replaced it with a row of every save. All 92 lines
  agree with the PDF text.
- **What the 2014 Markdown dropped (SRD 5.1).** Patches restore, each checked against the PDF: seven entries of the
  class spell lists (Heroes' Feast for the Cleric and Druid, Hunter's Mark for the Ranger, Enlarge/Reduce for the
  Sorcerer and Wizard, Arcanist's Magic Aura and Control Weather for the Wizard), the Grimlock's Blind Senses trait,
  the Jokers row of the Deck of Illusions table, “Meat, chunk” as its own row (the Markdown had made it one of the
  Meals) and “Tent, two-person”. A list patch is scoped with `within` (the class's list, then the level), since the
  same two spells sit next to each other in other lists.
- **The 2014 spell lists, read from the PDF.** A 2014 spell names its classes only in the lists, so
  `scripts/books/spelllists.ts` reads pages 105–114 of the PDF one column at a time (`pdftotext` with a crop box)
  and the build stops unless every spell carries exactly the classes whose list names it (778 entries, 8 classes).
  The lists are committed as `scripts/books/pdf/srd-5.1-spell-lists.json`, with the book's attribution, so a build
  or a test without the PDF checks the same thing.
- **Stray italics.** The PDF set some full stops in italics after a roman word (`prone_._`, `"Playing the Game_."_`);
  the emphasis around nothing but punctuation is dropped (nine places).
- **Equipment names.** Rows that are kinds of one thing are named after it, as the PDF groups them
  (`groupedRows`: the 2014 saddles are “Saddle, Exotic” …, the holy symbols “Holy Symbol, Amulet” …, the arcane and
  druidic foci likewise; 2024 tables inside an item's own section, such as Holy Symbol's, the same way), so no bare
  “Orb”, “Wand” or “Exotic” is an item name. The thing itself is an item too (Holy Symbol, Arcane Focus, Druidic
  Focus, Saddle, Gaming Set, Musical Instrument, Inn Stay, Meal), with the book's paragraph about it and its kinds as
  `variants`; a kind with no paragraph of its own shows its group's (a 2014 Lute shows the Musical Instrument
  paragraph). Unpriced rows (2014 “Vehicles (land or water)”, a proficiency) are not items; grouped lifestyle prices
  read “Inn Stay (Poor)”, “Meals (Poor)” in both books.
- **Lost columns and headings (2014).** The Destroy Undead table had lost its Cleric Level column (5th … 17th), and
  the Warlock table read “Bonus Proficiency” where the PDF prints “Proficiency Bonus”. Both are patched back, and a
  test checks that no table in either book is left with a single column.
- **2024 tools** (Alchemist's Supplies … Thieves' Tools, 25 of them) are items of category Tool with cost, weight,
  ability, Utilize, Craft and variants; a variant answers by its own name (lute, playing cards).

`npm run books` prints all of this. A unit test checks that every table rolled on NdX runs up to N×X.

## Sources

Pinned in `scripts/books/sources.json` with URL, SHA-256 and retrieval date. The build stops on a hash mismatch.

| Source | Use | Licence |
|---|---|---|
| your5e/5e-srd-markdown `dnd/521/SRD_CC_v5.2.1.md` at f1f5060 | The 2024 book: chapters, entries, index | SRD text, CC-BY-4.0 |
| your5e/5e-srd-markdown `dnd/51/SRD_CC_v5.1.md` at f1f5060 | The 2014 book | SRD text, CC-BY-4.0 |
| 5e-bits/5e-srd-api `packages/5e-database/src/2024/en` (Monsters, Spells) at 05c109e | Cross-check of parsed stat blocks and spells (not shipped) | Data is SRD text; code MIT (not used) |
| 5e-bits/5e-srd-api `packages/5e-database/src/2014/en` (Monsters, Spells) at 05c109e | Cross-check for the 2014 book (not shipped) | as above |
| Official `SRD_CC_v5.2.1.pdf` (sha256 8974902d…) via the your5e mirror | Fidelity check with `pdftotext` (never shipped or committed) | CC-BY-4.0 |
| Official `SRD_CC_v5.1.pdf` (sha256 2504d2a0…) via the your5e mirror | Fidelity check, and the class spell lists read by `spelllists.ts` (never shipped or committed) | CC-BY-4.0 |

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
npm run books -- --no-pdf  # skip the PDF steps (fidelity check with pdftotext, table titles with pdftohtml);
                           # the committed scripts/books/titles/*.json is used instead
```

The cache (`scripts/books/.cache/`) is gitignored. The generated data is committed, so the app builds and works
without network. Each run prints counts and the two checks, for example (2024 book): 339 spells, 330 monsters,
449 items, 15 conditions, 226 rules; 323 of 323 monsters found in 5e-bits agree on AC, HP, CR, Str, Dex and Wis;
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
**Save for offline** caches every file of a book (plus the reader's code and Help's small attribution chunk, so
Help still shows the attribution with no network) through the service worker's
`cache-pack` message into the `mistlab-books-v1` cache, which survives app updates.

## Lookup API (for rules tooltips and stat blocks)

`app/src/books/lookup.ts`:

- `lookup(termOrId, edition?, { type?, fallback? })` returns a `RuleEntry` `{ id, type, label, name, edition, book,
  summary, text, html, section: { book, anchor, href }, attribution }`. It accepts ids (`spell:fireball`), names,
  singular and plural forms (`wolves`, `reaction`/`reactions`), cue words (`prone condition`, `fire damage`),
  abbreviations (`AC`, `Str`), inverted item names and per-edition aliases (`aliases` in `scripts/books/config.ts`:
  grapple, shove, advantage, hit dice, half cover, passive perception, plate, goblin, healing potion, +1 weapon …).
  With no edition it uses the **Rules edition** preference (2024 by default, 2014 as the option; Library, Books tab).
  Only that edition answers: a term the chosen rules do not have returns nothing. `fallback: true` lets the other
  edition answer; the entry's `edition` then differs from the one asked for, and a card must show it ('2014 rules').
  `label` is the type's name in that edition ('Race' in 2014, 'Species' in 2024).
  It also reads names the way running text writes them: in quotes, with a possessive or an article
  (`“Prone.”`, `the wolf's`, `the prone condition`), with a cue word (`Strength saving throw`, `undead creature`),
  and a '+1, +2, or +3' item by its own name (`wand of the war mage`, `+2 wand of the war mage`) or by the weapon or
  armour it is (`+1 mace`, `longsword +2`, `+3 plate armor` find Weapon or Armor, +1, +2, or +3). A check written
  `Wisdom (Perception)` or `Dexterity (Stealth) check` is the skill. The kinds in a magic item's own table are found
  (`potion of greater healing` is the Potion of Healing), and so is the part of a name after its colon (`Turn
  Undead` is 2014's Channel Divinity: Turn Undead); Channel Divinity's options in both books (Turn Undead, Sacred
  Weapon, Preserve Life) are entries. Within one kind, an entry named exactly so comes before one that only answers
  to the name (`shield` is the Shield, not Shield +1; `inn stay` is Inn Stay, not Inn Stay (Squalid)).
- The parts of a stat block answer from the monsters' introduction: Multiattack and Legendary Actions in both books,
  Lair Actions and Legendary Creatures in 2014 (the 2024 SRD has no lair actions). Neither SRD has a general rule
  for Legendary Resistance (each stat block states its own), so that finds nothing. In 2014, Hit Dice answers with
  Short Rest, the rule that says how they are spent.
- Where two sections share a name, the one that answers is set per edition (`ruleSources` in the config, and the
  build stops if a path is missing): in 2014, Hit Points, Difficult Terrain and Initiative are the combat rules (not
  the Constitution, travel or Dexterity paragraphs), Armor Class is the Armor section's definition and Tremorsense is
  the monsters' one. 2014 class features with parts of their own (Wild Shape, Ki, Metamagic, Fighting Style, Font of
  Magic, Pact Boon, Spellcasting, Channel Divinity) are entries; each part (Beast Shapes, Flurry of Blows, Archery)
  is one too, naming its feature in `summary.feature`, and `summary.subclass` is only ever a real subclass.
- The 2024 rules renamed some creatures; their 2014 names, which modules like Curse of Strahd use, find the 2024 stat
  block (thug → Tough, veteran → Warrior Veteran, cult fanatic → Cultist Fanatic, acolyte → Priest Acolyte, kobold →
  Kobold Warrior, flying sword → Animated Flying Sword …), and their plurals too.
- Every entry has a short `text` for a tooltip (a test checks there is no empty one): a monster's is its stat line
  ('Medium beast, unaligned. AC 13 (natural armor), HP 11 (2d8 + 2), Speed 40 ft. CR 1/4 (XP 50).'), a class's its
  Hit Die, primary ability and saves, a background's its fields, a 2014 condition's its effects, gear without a
  description its table row ('Mount or vehicle (Saddles): Cost 20 gp, 30 lb.'), a table-only section its rows
  ('5th: 1/2 or lower; 8th: 1 or lower …').
- `lookupAll(term)` returns every meaning (Shield is a spell and armour).
- `findTerms(text, await termIndex())` returns the spans of rules terms in running text. Names that are also
  ordinary English words count only when tagged (`[[Light]]`, `[[spell:light]]`, `[[Command|the command spell]]`),
  capitalised mid-sentence, followed by their cue word (`light cantrip`, `prone condition`, `fire damage`) or led
  by one (`casts blight`, `a saving throw or be poisoned`, `knocked prone`). The ordinary words are the CLARITY
  plan's list (light, shield, command, guard, wolf, blight, druid, gate, shadow, charm, hold …), the people and
  animals a module names in passing (veteran, scout, soldier, noble, priest, thug, acolyte, raven, horse …), and any
  one-word name the prose of either book uses in lower case three times or more (counted over both books, so the two
  editions link a sentence the same way); a name and its plural are ordinary together or not at all (thug and
  thugs). A name of several words (short rest, dim light, holy water, thieves' tools) is never treated as ordinary,
  nor are darkvision, blindsight, truesight, tremorsense and multiattack. Mundane gear named in one word (Hammer,
  Rope, Feed) counts as an ordinary word, and a capitalised word after another capitalised word that is not an
  article or the like (‘Exotic Feed’, ‘the Blue Light Inn’) is part of that name, not the rules term.
  `Wisdom (Perception)` is one span, the skill, and `+1 mace` is one span, the magic weapon.
- Types: spell, condition, monster, item, rule (glossary terms, actions, weapon and mastery properties),
  damage, ability, skill, creature-type, feat, class, feature, species, background. `TYPE_META` gives each a label
  and a colour token (`--t-spell`, `--t-condition` …) for colour-coded cards.

## Maintenance

- 5e-bits/5e-database was archived on 2026-09-23; its data lives on in 5e-bits/5e-srd-api.
- Wizards numbers later errata 5.2.2 and so on. To move to a new version, add its sources to `sources.json`, update
  `scripts/books/config.ts` (chapters, attribution copied from the new PDF's page 1) and run `npm run books`.
