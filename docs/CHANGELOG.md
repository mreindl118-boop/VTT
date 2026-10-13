# Changelog

## 0.3.0 One world to zoom through - 2026-10-13

- World map opens an inked map of the active campaign: gothic Barovia or the pastoral Sheep Chase countryside. Zoom continuously from the region into a town, a building and a room, with the wheel or touch. Breadcrumbs and Back keep the route clear.
- Places, hover tips, the hex grid, travel pace and the draggable party marker carry over. Maps load as you approach and return to simple outlines as you leave. View > Continuous world off, or `?nested=0`, keeps the flat-map fallback available.
- Players see only known landmarks. Switching to Players or the slider's player end clears private notes and controls, including pending cards and wilderness directions.
- Help shows the release number separately from its What's new link. After an update, the DM sees the newest changes once; the Player Display does not show that card.
- Reworded map descriptions where they overlapped the source module, preserving their facts, rules links and map geometry.

Known limits: the separate topography, expanded Player Display, phone/performance and data passes remain for item 2's second release. Nested towns and interiors retain surrounding scenery and can render more slowly than the flat fallback. All 32 keyed places currently have discs, including Mount Baratok's extra M2-M5 markers; the original design grouped that peak once, and the owner may choose that presentation later. Existing map and movement issues remain in their own queue items; item 7 is paused.

## 0.2.1 Built and tested on the owner's laptop — 2026-10-13

The first release made on the owner's laptop instead of a cloud machine. Nothing changes at the table.

- The browser tests now render on the laptop's graphics card (`PW_GPU=1`): the full suite runs in 5 minutes instead
  of 25, with the same results (171 passed, 55 skipped by device, 0 failed; 461 unit tests passed).
- Windows checkouts work: scene names in the rules-terms tooling use forward slashes on every platform, and a
  `.gitattributes` keeps every text file on LF, so the generated files the tests compare byte for byte are identical
  on Windows and Linux.

Known limits: none new. The nested world (item 2) and the unfinished maps (item 7) are in their final checks and
release next.

## 0.2.0 Chapter 2 sites — 2026-10-13

For the DM:
- Eleven chapter 2 places in the Svalich Woods that had only a stand-in map are now real outdoor maps of their own, each
  with its rooms, props, creatures, DM notes and players' views:
  - A, Old Svalich Road: a tunnel of leaning giant pines, scouts behind a buttress root, and the road leaving into the
    Mists.
  - B, Gates of Barovia: the stone gate in its rock cutting, the corduroy causeway and the fog behind the bars.
  - D, River Ivlis: the village bridge on the river's elbow, the shingle bar and the bluff.
  - F, River Ivlis Crossroads: the gallows on its knoll, the open grave and the roads that meet there.
  - H, Tser Falls: a real cliff over Tser Pool a thousand feet down, the bridge over the falls, and the valley with
    Vallaki and Castle Ravenloft in view.
  - I, the Black Carriage: the fork on the Count's road, the guard-post shell, the Cut Block and the falls window.
  - J, Gates of Ravenloft: the road's end on its spur, the drawbridge over the chasm and the gate.
  - L, Lake Zarovich: the fishers' landing on the south shore, the black lake under its mist, Bluto out in his boat.
  - M, Mount Baratok: the fog-line shelf where the Mad Mage lives as an elk, the cascade and the scree.
  - P, Luna River Crossroads: the crossing, the snapped signpost and the two-arched bridge over the Luna.
  - R, Raven River Crossroads: the ford, the rapids, the trappers' ledge path and the rookery.
- The land, roads and rivers around each map now carry on past its edges: on the Old Svalich Road the world road
  leaves both ends of the map, and Tser Falls shapes the valley round itself. Only those two maps ask for this; the
  distant roads round every other map are drawn as before.
- The new places' notes carry the rules links: every check, creature, spell and condition on them opens its card.
- The rules-link review list grew with them: docs/TERMS_REVIEW.md is now an index, with one file per chapter under
  docs/terms-review/.

For the players:
- Opening any of these places shows the woods, roads, rock and water the party is standing in, built for that place,
  instead of the old stand-in map.
- On Lake Zarovich's own map the distant scenery no longer draws a second copy of Bluto's boat.

Known limits: the item had one build, one review and one fix pass on each map. P and R passed review. 23 defects remain
on the other nine, none blocking play, waiting for the owner:
- A, Old Svalich Road (4): the fog hollow sits level with the road instead of 10 ft below it; the ravens and the
  wereraven stand at the foot of the dead tree instead of perching in it and circling above; the skeletal rider
  overlaps the second wagon; the wall of Mists is see-through, and the road runs on visibly beyond it.
- B, Gates of Barovia (1): the first view shows the gate small, with a fog bank filling the right side; the map's own
  camera view is stored but not used yet.
- D, River Ivlis (3): the village bank is no higher than the far bank; the road stops short of the scenery road at
  the north edge; east of the map the river looks like two rivers, with scenery pines standing in the water.
- F, River Ivlis Crossroads (3): the hanged man stands on the trapdoor instead of hanging; the open grave reads as a
  flat frame, not a pit; in the low woods the grid and tokens float above the falling ground.
- H, Tser Falls (3): a second road runs into the north-west corner and ends in the rocks; the east side ends in a
  straight cliff along the map edge; the saddle's floor reads as cobbled street, and the pool floor is marsh green
  instead of bare rock.
- I, the Black Carriage (2): the slope down to the falls window is flat (one level is missing); a token can walk into
  the crag.
- J, Gates of Ravenloft (3): the wheel ruts and turning loop look like a railway track; the north crag looks like a
  lone drum instead of the ridge face; the two terraces at the brink are flat paving instead of step-downs.
- L, Lake Zarovich (3): the mist barely shows and the far shore's edge is a hard line; Mount Baratok behind looks like
  a painted curtain; outside the map the land is bare grass instead of forest.
- M, Mount Baratok (1): the scree slope rises over the shelf's grid, so a token placed on it sits inside the rock.
## Zoom and nesting fixes — 2026-10-04

The owner reported that zooming in and out across nested maps did not work as intended. Nesting is still one map at
a time (Enter and Back), and zoom is still a camera that pulls back to a limit. Six things in that design were
broken; each is fixed here. The continuous streaming world (docs/WORLD.md on the nested-world branch) comes later.

- **Enter from a building.** A tap on a house, a church, the Vistani tent, Baba Lysaga's hut or anything else
  standing in a room that opens a map now offers *Enter <room>* on its card, and the hover tip says so too. The
  action is the same as the room menu's Enter, shown only to the DM (never in Players mode). Before, the tap hit
  the building and its card had no Enter, so only 2 of Vallaki's 13 sites could be entered by tap. Now all 13 can,
  plus Berez's hut, Krezk's road and ledge sites, and the village of Barovia's Death House and church (village
  rooms E7 and E5 now open those maps). A thing on a card belongs to the room it stands in (its area key, else
  where it stands), not to the ground the tap's ray meets behind a tall roof, so St. Andral's church also gets
  its *N1* line and *Frame N1*.
- **The zoom buttons on a phone.** The compass and scale-bar frame no longer takes taps. The `#ui > *` rule gave
  it pointer events back, so on a phone it swallowed presses on the zoom, find-party, follow and help buttons it
  covers. On a screen 700 px wide or less the frame now sits above the camera row and under any card. A control
  placed in the frame later has to take taps by a rule of its own.
- **Back keeps your place.** Back (and the zoom-out chip below) opens the town framed on the site you just left,
  at about the building map's span, on that site's level, with the same compass heading. Before, it showed the
  whole of Vallaki. Death House and the church now have a working Back to the village. On a top-level map Back
  is hidden (it was shown there and did nothing, because `button.icon` overrode `[hidden]`).
- **Zoom during a glide.** A zoom press scales from where the glide in flight is heading, so two quick presses
  reach 0.78 × 0.78 of the distance instead of losing part of the first. A wheel turn during a glide changes where
  the glide is going, instead of being undone by it. The wheel and a pinch now zoom toward the pointer rather than
  the middle of the screen.
- **Zooming out goes up a level.** At the far limit, one more zoom out (button, wheel or pinch) shows a small chip:
  *Zoom out to the Town of Vallaki* on a building, or *Zoom out to the Lands of Barovia* (or the Sheep Chase
  country) on a top-level map, which opens the world map centred on that map's place. One tap goes. The chip
  fades after five seconds and never goes anywhere by itself. It is the DM's only, never in Players mode. Area maps
  can now pull back far enough to show some of the town drawn round them.
- **The abbey's surroundings.** The parent's surroundings round an area map now stand round the room the DM came
  in by (remembered at Enter, and sent to the Player Display so both screens agree). Without one, they stand round
  a room on the level at the height of the map's ground floor. Before, the first matching room was used, so the
  Krezk abbey always sat on the Winding Road and never on the ledge 400 ft up. The surroundings hide while a floor
  below their ground is shown, so the abbey's cellar and a Vallaki cellar are not buried under them.
- Tests: `e2e/zoom.spec.ts` covers all of the above on a 1366×768 desktop and a 390×844 touch phone.
- Merged with release 0.1.0: the object card's *Enter* button sits on the rules-linked card (`ui/cards.ts`), the
  hover tip's *Enter* line is drawn by the shared tooltip, and the measure tool's line and label still hang from the
  active map's root. At the slider's players' end an unfound room's Enter reads *Enter this place*.

## 0.1.0 D&D rules tooltips and the SRD books — 2026-10-12

For the DM:
- The Library has a Books tab with the free D&D rules: SRD 5.1 (2014 rules) and SRD 5.2.1 (2024 rules). Read them
  like a book, search them, and save them for offline play. Pick which edition's rules the cards show.
- Rules words in the module text are now links: spells, monsters, conditions, magic items and gear, checks ('DC 15
  Perception'), damage types, dice, and the module's own rooms, people and places. Hover or tap one and a parchment
  card opens beside it: a coloured stripe and small-caps heading say what kind of thing it is, monsters show a full
  stat block, and magic items show their rarity colour.
- Each family has its own link colour and underline (dashed condition, double spell, wavy monster, dotted rule, solid
  page reference); Help has a Colours key with one sample of each.
- The links and cards are everywhere a rule shows up: room and object cards, notes, the token panel (its AC, HP,
  speed and CR are pills that open their rules), the Creatures sheet ('Stat block' unfolds the full block in the
  row), the Initiative sheet and turn bar, the clock and travel pace, the measure readout, world-map pins, Help and
  the Books reader itself.
- A creature's numbers come from one place: the books' stat block for your chosen edition, or the module's own
  numbers marked 'Module stats'. A creature with neither says 'Module creature: no open stat block'.
- Every button's small hint is now a styled tip instead of the browser's plain tooltip.
- Help shows the release number (mistLAB 0.1.0).

For the players:
- On the players' side the links cover only conditions, rules, actions, senses, damage types, abilities and skills:
  never monsters, spells, items or the module's rooms and people, so nothing gives away what the DM has not shown.
- The turn bar leaves out hidden creatures and calls each revealed one by its token's name, so the players never read
  a hidden creature's real name. Moving out of turn says 'Not your turn'.

Known limits: the list of labelled examples that checks the link-finder (tests/fixtures/terms-gold.json) was labelled
by the builder and still waits for the owner's sign-off. Words the link-finder gets wrong are fixed one at a time in
app/src/books/term-overrides.json; docs/TERMS_REVIEW.md lists every link for checking.

## Rules cards on every surface (queue item 1, in progress) — 2026-10-12

- The room tap menu, the object card and the players' room and creature cards now show their rules links: tap 'DC 12
  Perception' in Death House 2A, the scrolls of bless, protection from poison and spiritual weapon in the chest of
  room 9, or 'sympathy' and '(X26)' in the Amber Temple's West Shrine, and its card opens. The players' cards link only
  conditions, rules, actions, senses, damage types, abilities and skills. Every word on a card is escaped: a label
  with '<b>' in it shows the brackets.
- The token panel's name opens the creature's stat block, and its size, AC, HP, speed and CR are pills that open
  their rules. The panel and the card read the same numbers: the books' entry for the chosen Rules edition, or the
  module's own under 'Module stats'; a mongrelfolk says 'Module creature: no open stat block'. Remove is
  red, and the hit points have a bar.
- The Creatures sheet: names open stat blocks, the meta is the same pills, a location tag opens the place it names,
  and 'Stat block' unfolds the full block in the row with its traits and actions linked.
- The Initiative sheet's Speed, Reach, Range, Darkvision and Initiative headers open their rules. The clock's
  'Difficult terrain', 'Mounted' and pace open theirs, and the pace's effect follows the Rules edition (2014: −5
  passive Perception, able to use stealth; 2024: read from the 2024 book); miles, hours and days are unchanged. The
  Rooms sheet's page numbers and a world-map pin's words link too.
- The players never read a hidden creature's name: on the players' side (Players view and the slider's players'
  end) the turn bar leaves hidden combatants out, shows only 'Round 1' on their turn, calls each revealed creature by
  its own token's alias (two ghouls renamed differently keep their names), and has no tips; map tags and the hover
  tip follow the same rule, and a blocked move says 'Not your turn'. The DM still sees every name.
- The Books reader links each entry's sibling rules in the same edition, once per section and never to itself, and
  reads like a book: Alegreya at a comfortable measure, a small-capitals running head with a Contents button on
  phones, the chapter title in the campaign's display face, an illuminated first letter on each chapter's opening
  paragraph, and contents links big enough to tap.
- Help has a Colours row: one sample link per family (dashed condition, double spell, wavy monster, dotted rule,
  solid page reference).
- Fixed: a monster card's 'More' did nothing for most stat blocks (the books give their Actions headings at several
  levels); the full block now opens for every monster.
- Fixed after review: links inside the DM-only note (tap menu and object card) were below 4.5:1 on Barovia's light
  page; the note's wash is lighter now and every family reads at 4.5:1 or more on it. 'Not your turn' sat under the
  turn bar; it now shows above it. In a stat block 'DC 10' is one link and keeps its full stop on the line, 'Saving
  Throws Dex +8' no longer reads as one long link (ability abbreviations stay text), and two links never touch. The
  Creatures sheet's token colour is a round dot, not a stray oval. Help's Colours key is one family per line, so a
  sample's card opens beside it instead of over it. At the slider's players' end, tapping a room the players have
  not found shows no name or words ('Reveal this room'), and a hidden secret door is not offered, as in the hover tip.

## Rules links in module text (queue item 1, in progress) — 2026-10-12

- New app/src/ui/terms.ts finds the rules words in room, object, pin and creature text and links them, coloured and
  underlined by family. On the DM side: spells, magic items and gear, monsters, conditions, checks ('DC 15 Dexterity
  (thieves' tools)' becomes one link labelled 'DC 15 · DEX (Thieves' Tools)'), dice with their average and maximum,
  key references ('(X26)') as area links, and the module's people and places. On the players' side only conditions,
  rules, actions, senses, damage types, abilities and skills, and never an ordinary word.
- Names stay names: 'Order of the Silver Dragon', 'Werewolf Den', 'Raven River' and the rest never link a rules
  word inside them; on the DM side the whole name links to its place or person. 'The stairs rose' is not Rose.
- A word that is also plain English (gate, light, shield, guard, wolf …) links only with a cue: 'scroll of', 'casts',
  'fire damage', 'four ghouls', 'Vilnius (mage)', 'a grick lurks', a list of spells, a save or a DC.
- Every link decision that is not a rule lives in app/src/books/term-overrides.json; no scene, world map or manifest
  changed. `npm run terms:review` writes docs/TERMS_REVIEW.md, every link over all 45 scenes and both world maps, and
  the test fails on any link nobody has reviewed.
- tests/fixtures/terms-gold.json holds 337 labelled spans from eight scenes for precision and recall. It waits for the
  owner's review before release.
- The cards themselves arrive on the room menus, object cards, token panel and sheets in the next step.
- A person card's Home names the place ('Castle Ravenloft', 'Blue Water Inn'), not the manifest tag ('K', 'N2').
- 'Exethanter the lich (99 hp, … CR 10)' is Exethanter: a monster word beside a named person who has their own hp or CR
  no longer opens the books' stat block (which would read CR 21, 315 hp). 'Helwa the gladiator' still links.
- Person and area cards have their own emblems (a hood, a map pin). A check card's title is the link's label, and
  thieves' tools are filed under Tool. XP reads 1,800, not 1800.
- The light condition, monster and rules colours are a little darker, so links stay at least 4.5:1 on the sunk page.

## 0.0.2 Explored fog stays where the party has looked — 2026-10-12

- Fixed: explored memory no longer spreads by itself. Before, every update (each step, each clock change) grew the remembered area one foot further, even through closed doors and walls. After about twenty ordinary actions, a whole floor showed to the players as rooms they had "seen".
- Explored memory now holds only what the party has actually seen, plus the wall right beside it.
- Known limit: a campaign saved before this fix keeps the extra explored area it already gained. The DM can fog it back with the fog brush.

## Books: one rule per name, and the PDF's own words — 2026-10-12

- In the 2014 rules, 'bonus action' now means the combat rule, not the spellcasting note. Dim light, bright light,
  darkness and lightly or heavily obscured each answer with their own paragraph, and a table's name (Object Armor
  Class, Creating Spell Slots, Beast Shapes) answers with its table rather than the next rule's paragraph. The build
  now stops if one name could mean two rules.
- The 2024 rules answer Mounted Combat, Underwater Combat, Vision and Light, Resting, Spell Slots, Components and the
  other sections the glossary leaves out, so a 2024 table no longer gets a 2014 card for them. 'DC' works in 2014.
- The text matches the printed books word for word: the hyphens and dashes lost in the Markdown are back ('5-foot-wide'
  in every dragon's breath), the Thrown property no longer says 'wwizareapon', and Confusion's table says 'Behavior'.
  Both changes notes list every correction, and a test fails if any word of the books is not in the official PDF.
- Running text links Enlarge/Reduce and other names with a slash, a stat block's 'grappled (escape DC 13)' and
  'knocks the target prone', and leaves 'Book of Shadows' alone. 'Inn stays' and 'meals' find the group, and 2024's
  'Studded Leather' finds its armour.
- On the title page, a long chapter name keeps its number on its first line.

## Books: the last gaps in the rules data — 2026-10-12

- The 2014 Destroy Undead table has its Cleric Level column again (5th to 17th), and the Warlock table's column
  reads Proficiency Bonus as printed. The changes note says so, and a test makes sure no table is left with one column.
- Holy symbols, arcane and druidic foci are named as the book groups them (Holy Symbol, Amulet …), and Holy Symbol,
  Arcane Focus, Druidic Focus, Saddle, Gaming Set, Musical Instrument, Inn Stay and Meal are things you can look up,
  with the book's paragraph and every kind and price. A bare Orb or Wand is no longer a link.
- Look-ups find what a Curse of Strahd page says: Turn Undead, Sacred Weapon, Potion of Greater Healing, +1 mace,
  Wisdom (Perception) check, Multiattack, Legendary Actions and Lair Actions.
- Running text links the same way in both editions, and plain words stay plain: the blight, the druid, a veteran
  soldier, a scout. Conditions link when a saving throw leads to them ('or be poisoned', 'knocked prone'), and a
  spell when someone casts it.
- Every rules entry has a short tooltip line, classes and backgrounds included.
- The Books tab says why it is empty when the device went offline before its code was ever fetched, and the app now
  fetches that code early for the DM. On the phone, Help's licence links wrap and a feature's tables inside another
  feature fit the screen. Search results for gear and for the monsters' grapple rules show their type.
- The main script is about 270 bytes larger (about 100 bytes compressed) for the Books tab's offline message and the
  early fetch.

## Books: the rest of the 2014 rules, sharper look-ups — 2026-10-12

- The 2014 book has what its Markdown source had dropped, each checked against the printed PDF: seven spell-list
  entries (Hunter's Mark for the Ranger, Enlarge/Reduce, Arcanist's Magic Aura, Control Weather and Heroes' Feast),
  so every 2014 spell names its classes; the Grimlock's Blind Senses; the Jokers of the Deck of Illusions; and each
  stat block's Saving Throws line as printed. The build now reads the class spell lists from the PDF and stops if
  any spell disagrees with them.
- Look-ups answer with the right section: in the 2014 rules Hit Points, Difficult Terrain and Initiative are the
  combat rules and AC is the armour rule; Wild Shape, Ki, Metamagic, Fighting Style, Font of Magic, Pact Boon and
  Channel Divinity are class features, with their parts (Beast Shapes, Flurry of Blows, Archery …) under them.
- The 2024 tools are items: Thieves' Tools, Herbalism Kit, Smith's Tools, the instruments and gaming sets, each with
  its ability, Utilize and Craft. The 2014 saddles are “Saddle, Military” and so on, and ordinary words like pack,
  feed or hammer no longer turn into links.
- Creatures the 2024 rules renamed are found by their 2014 names (thug, veteran, cult fanatic, acolyte, kobold …),
  as Curse of Strahd writes them. Every entry has a one-line tooltip text, a monster's being its stat line.
- On iPad portrait and the phone, the contents sheet closes when you switch books or search, so the results are
  never hidden. A book not saved for offline says so by name and offers the way back. Stat blocks inside spells and
  magic items fit the phone too.
- Offline, Help still shows both attributions, the disclaimer and what each copy changed: Save for offline keeps
  Help's attribution, and the app fetches it once the service worker is ready. The changes notes now keep the
  Markdown project's own list of changes and list everything this copy restored; in Help and the page footers they
  open with one tap.
- The main script is about 300 bytes larger (90 bytes compressed) for Help's offline fallback and the early fetch of
  the attribution.

## Books: the 2014 and 2024 rules — 2026-10-04

- The Library has a new Books tab with the two open rules books: the 2024 rules (System Reference Document 5.2.1)
  and the 2014 rules (System Reference Document 5.1). Each row shows the edition, the size and whether the book is
  saved on this device. Save for offline stores every chapter, so a book still opens with no network.
- A reader for the DM: contents down the side (a sheet on the phone), large type for an iPad at arm's length,
  previous and next, and a Map button that goes back to the table in one tap. Search looks in one book or both,
  groups the results by book and chapter, and can search the full text. Typing a condition, spell or monster
  and pressing Enter jumps straight to it. Links like `#book/srd-5.2.1/condition-prone` open the right place and
  survive a reload.
- Spells, monsters with full stat blocks, equipment and magic items, conditions and glossary rules are also stored as
  typed entries with stable ids, for the coming rules tooltips and stat blocks (`app/src/books/lookup.ts`). A Rules
  edition setting picks which book answers: 2024 by default, 2014 if you prefer.
- The players never see the books: not in Players mode and not on the Player Display.
- Checked against the printed books: the 2024 book has its table titles back (Travel Pace, XP Budget per Character,
  Trinkets …, found by search), words the PDF split are whole again ("Nature", "Leather Armor"), the Efreeti Bottle
  is rolled on a d10 as printed, the Young Green Dragon's attacks sit under Actions, and price lists are no longer
  mistaken for items. The 2014 book lists the Figurine of Wondrous Power as an item and calls races races.
- A rules look-up answers only from the edition you chose; a term the 2014 rules don't have finds nothing rather
  than a 2024 rule. It understands more ways of saying things: grapple, shove, hit dice, half cover, plate, goblin,
  reaction or reactions. The reader's search knows these names too, and marks a table found by its title as a table.
- On the phone, a monster's six ability scores fit the screen, and the closed contents sheet leaves no shadow.
- The text is Creative Commons Attribution 4.0. Each book's first page, its files and Help carry the exact
  attribution statement the licence asks for, the licence's disclaimer notice and a note of what this copy changed.
  `npm run books` rebuilds the data from pinned sources, and docs/BOOKS.md says where it comes from. Curse of Strahd
  text stays out of the repo, as before.
- Nothing loads until a book is opened, so starting the app is no slower. Help's books entry loads with Help. The
  app's main script is 855 bytes larger (about 0.4 KB compressed): the Books tab button, the `#book/` link hook and
  Help's loader, which have to be there before a book is opened.
- Offline: the service worker now really keeps what it fetches, and finds files saved for offline whatever
  headers the server sent, so a saved book opens with the network cut.

## M0 Foundations — 2026-09-29

- Vite + TypeScript + three.js PWA shell (manifest, service worker, offline cache-first), iPad-first touch.
- Docs: `UNITS.md`, `SLIDER.md`, `STYLE.md`, `PIPELINE.md`.
- Core (pure, unit-tested): units and footprints, square/hex grid math (5 ft and 5-10-5 diagonals),
  slider curves and visibility classes, the 5e light and vision model (PHB presets, darkvision, cones,
  Foundry-style wall flags), 1-ft explored/visible coverage maps, PHB travel pace.
- Renderer: procedural low-poly kit v0 in the palette, coverage fog injected into every material,
  floor-only grid overlay (square and pointy/flat hex) clipped to `grid.json` polygons, secret doors that
  are pixel-identical to wall at t = 0, low/full wall toggle, tabletop/top-down cameras, CSS labels.
- DM tools: view slider (detents, peek, keyboard), reveal/hide room, object or secret door, paint reveal/fog,
  door toggles, undo, token drag with snapped distance readout. Campaign state in IndexedDB.
- Player Display (`?display=player`) over BroadcastChannel: pinned at t = 0, camera follows the DM, no DM UI.
- Manifests seeded from the prompt: 37 locations / 529 area keys, 174 characters, encounter terrain + events.
- Book pipeline: `npm run ocr` (tesseract @ 300 DPI) and `scripts/manifest-report.ts` (flags mismatches).
- Tests: 40 Vitest unit tests (+2 todo waiting on OCR/M2) and 21 Playwright acceptance tests (grid-on-floor
  pixel proof in 16 camera/wall/grid/slider combos, secret-door pixel identity, slider 0/0.5/1, Player
  Display isolation, reveal persistence).

## Book verification — 2026-09-30

- Book scanned into `reference/module/` (local only), OCR'd with `npm run ocr` (258 pages, ~9 min).
- `scripts/manifest-report.ts` hardened for real OCR: small-caps sub-letters (E5r → E5f), O/l digit
  confusions (QOl3 → Q13), fuzzy name match, Appendix B-only numbered keys, printed page = PDF page − 1.
- `manifests/locations.json`: printed pages filled for 476 area keys; added E6 Cemetery and E7 Haunted
  House (village keys missing from the seed); named K31a Elevator Shaft and K31b Shaft Access.
- 46 keys whose headings the OCR couldn't read (mostly Argynvostholt Q19–Q53, some Vallaki interiors) keep
  `page: null`; they get pages when their chapter is modeled.

## M1 Death House — 2026-09-30

- `locations/appB/death-house/`: all 38 keyed areas (plus the book's lettered sub-areas 1A–25E, 63 keys) across
  six levels: first, second, third floor, attic, dungeon, lower dungeon. Authored from the p.216 map at its
  printed scale (one square = 5 ft) by `scripts/authoring/death-house.py` (cells → feet; walls derived from
  room polygons, then doors, windows, openings, railings and secret doors stamped over them).
- Wired: 5 secret/concealed doors, the hidden spiked pit (26), the hidden trapdoor (3/32), the padlocked
  door (20), the portcullis (37), crypt slabs, 20 hidden-creature slots (broom, specter, animated armor,
  Rose & Thorn, centipedes, grick, 4 ghouls, 5 shadows, mimic, 2 ghasts, Lorghoth), ~35 hidden-object
  slots (chests, relic niches, remains, keys), page refs on every key, vertical links (spiral stair, attic
  stair, the 21 shaft, dumbwaiter, trapdoor, stairs to 35), a party spawn in the portico.
- Kit v1 props: spiral stair, fireplace, chairs, bookshelves, desk, wardrobe, stoves, oven, crib,
  harpsichord, harp, armor, statue, altar, well, portcullis, ledges, octagonal dais, pallets, niches, trunks,
  cabinets, sheeted furniture, refuse mound, trapdoors, gate, wheel, skeletons, pit cover, dollhouse, lamps,
  dumbwaiter. Straight stairs can now run along x.
- Schema: per-level `ambient` (house `interior-dim`, dungeon `darkness`) and `north` (this map prints north
  to the left); `spawn` objects; `dumbwaiter` links.
- The default party token carries a torch (20/40) so unlit levels are playable immediately.
- Tests: scale acceptance for area 38 (forty-foot square = 8 × 8 cells); manifest ↔ scene no-orphan check
  covers all 63 Death House keys; Playwright grid-on-floor and slider suites now run on the test room, Death
  House second floor and the lower dungeon (63 acceptance tests).
- Known: draw calls on the dungeon level are ~170 (props are separate meshes); instancing lands with M4's
  performance pass. Room labels overlap at DM view on dense levels; label declutter is queued for M9.

## M1.1 Characterization pass — 2026-09-30

- Kit v2 (`app/src/kit/creatures.ts`, `props.ts`): a modular low-poly humanoid (skin, cloth, hunch, claws,
  robe, cloak, wolf-helm, weapons) with ghoul, ghast, cultist, adventurer and animated-armor variants;
  translucent ghosts, specter and shadows; the mimic as a door with a maw; Lorghoth as a shambling mound;
  the grick; insect swarm; the broom; wolves (live and stuffed). The party token is now an adventurer.
- Death House props now follow the room descriptions: wrought-iron gate and chained oil lamps (1A), the
  Durst coat-of-arms and portraits (1B), black marble fireplace and the longsword (2A), cloaks and top hat
  (2B), stag's head, three stuffed wolves, fur chairs, cask and candelabrum, chandelier (3), the domed oven
  and stocked shelves (4), crystal chandelier, red silk drapes, tapestry and painting (5), suits of armor
  with wolf helms and the family portrait (6), the floor-to-ceiling shelves, ladder and windmill picture
  (8), the clawed-foot chest with the skeleton (9), brass chandelier, stained-glass hangings, harpsichord
  and harp (10), four-poster beds, vanity and mirror, tiger rug, burgundy drapes (12), clawed tub, stove and
  spigot barrel (13), the shrouded crib (15B), ivy-framed mirror (15A), child beds, the two small skeletons,
  windmill toy chest and dollhouse (20), sheeted furniture (18), the doll in the window (17); earthen
  tunnels with timber braces every 5 ft and wooden posts (dungeon), slabs and biers (23), the well (25),
  benches and strewn bones (27), the Strahd statue with the wolf and the shackled skeletons (31), the
  ghoul-carved altar with hanging chains, pillars, ledges and dais (38), shackles in the prison alcoves (36).
- Cobwebs on the third floor, attic and dungeon; wall materials `paneling`, `paneling-dusty`, `earth`, `brick`.
- UI: label density toggle (keys / all / none), default keys only.
- Tests: acceptance diff threshold raised from 2 to 6 levels (transparent-sort blending noise); 63 e2e green.

## M1.2 Run mode — 2026-09-30

- DM / Players switch on one screen: Players mode pins the view to t = 0 and hides every DM affordance
  (slider, tools, labels, finder); DM mode restores them. The separate Player Display window remains.
- Token-driven play: moving the party token reveals and remembers the room it enters (`autoReveal`),
  stepping within a cell of a stair / trapdoor / dumbwaiter endpoint changes level, the camera follows
  (`follow`, toggle in the camera cluster). Level tabs show a dot where the party is.
- Camera rig: fixed tabletop tilt (45°) or top-down, yaw in 90° steps (buttons, R / Shift-R), drag to pan,
  pinch / scroll to zoom, zoom buttons, "find the party" (F), double-tap a room to frame it, damped motion.
- Find any area: search box (/) jumps to a key or name across levels; Rooms sheet lists every key per level
  with page ref, revealed state (eye toggles reveal / hide) and the party's room highlighted.
- Readability: DM work-light scales with the slider (players keep the true darkness), doors in warm wood
  with a red band when locked, lighter floors, smaller key pills, level names shortened, first-run help.
- docs/SLIDER.md: Players mode documented alongside the Player Display.

## M1.3 Affordances + M2 seeds — 2026-09-30

- Right-drag / two-finger twist rotates the camera freely; the buttons still turn in 90° steps.
- Every door carries a tappable marker (open/closed/locked); every stair, trapdoor and dumbwaiter end carries a
  level marker that moves the party. Tapping a room, door or secret door opens a menu of what you can do.
- Info card: tapping any asset in DM mode shows its name, area key and page, a player-facing description, DM
  notes, its visibility state and actions; in Players mode only the description, and only if it is in view.
  Death House carries 83 descriptions / 88 DM notes (own wording) plus generic descriptions by kind.
- Breathing room: 45° tabletop framing from further back, 40° FOV, walls 0.7 ft, smaller labels.
- Imported the uploaded seed locations via `scripts/authoring/import-ml.py`: Church E5 (ground + undercroft,
  E5a–E5g), Tser Pool Encampment (G), Svalich Woods road kit (C), Village of Barovia placement layer (E1–E7).
  Outdoor kit: pines, bushes, dead trees, boulders, gravestones, fences, water, tents, wagons, signposts,
  braziers, houses, church massing, gate arch; horses, scarecrow, vampire spawn, gargoyle, wyrmling.
- Schema: `terrain` (unkeyed ground floors), `placementFt` / `kind: placement` (no fog, no grid).
- Scatter props merge into one mesh per material (road kit 678 → 74 draw calls).
- 151 character figure recipes (skin, cloth, hair, hat, weapon) attached to `manifests/characters.json`.

## M1.4 Scale and atmosphere — 2026-09-30

- Walls and doors keep their real height. The low-walls view is now a cutaway: a clipping plane trims
  everything above 5 ft over the floor instead of squashing the wall group, so doors stay door-sized.
- Tighter, closer camera (30° field of view) with room around the framed level; walls 0.6 ft thick.
- Atmosphere: soft background gradient, exponential ground fog, and a mist floor that follows the
  current level's elevation (no longer covering the dungeon). Lighter floor and wall palette; softer grid.
- Instant camera moves cancel any glide still in flight (fixed a timing-dependent grid test failure).
- Esc closes the help sheet and other sheets.

## M1.5 Player-side rules — 2026-09-30

- Moving is two deliberate taps: tap a token to pick it up (white ring), then tap where it goes. Tap it
  again or press Esc to cancel. Swiping from a token pans the camera instead of moving anyone. With a
  mouse, a ghost ring and the distance preview the landing cell.
- Players' side (Players view and the Player Display) walks: `core/movement.ts` searches a 2.5-ft
  lattice over the floor and never crosses a wall, window, closed door or undiscovered secret door. Open
  doors and revealed, opened secret doors let the party through. A blocked move keeps the token picked up.
  Locked doors cannot be opened from the players' side. The DM still places tokens anywhere.
- DM secrets stay secret: info cards on the players' side use a player-facing name (`playerLabel`) and
  description, never the DM label. DM cards tag notes "DM only" and show what players will call the thing.

## M1.6 Details, openables, UI hygiene — 2026-09-30

- Death House details from the module: purpose-built props replace placeholders (mounted longsword,
  crossbow rack, desk key, jewelry box, tiger-skin rug, swaddled bundle, crystal orb); new pieces for table
  settings, pantry stores, hanging cookware and the dumbwaiter bell, linens, sheeted storage shapes, a
  bricked-up window, a rolling ladder, and old footprints across the dungeon (none over the hidden pit).
- Every room has a player description and a DM-only note (original wording), shown in a room card.
- Openables: every chest, trunk, footlocker, cabinet, wardrobe, coffin, desk, nightstand and jewelry box
  opens (lids lift, doors swing, drawers slide). Contents are mapped from the module; locked ones need the
  DM; opening reveals hidden contents (the den's crossbows, the library key, the jewelry box).
- Hover tooltips name what is under the mouse. A new location clears the old one's labels. Search opens
  from a button and the top bar lays out in rows without overlapping.

## M1.7 Real-world proportions — 2026-09-30

- Measured every kit piece in feet against real sizes. Humanoids are now ~6 ft tall with ~1.4-ft shoulders
  and a human-sized head (they were 3+ ft wide). Tables take a real size per use at 2.5 ft high (the den's
  side table 3 × 2, card table 4 × 4, dining 10 × 4.5, parlor 3 × 3). Base rings draw at ~60% of the
  square. Result: rooms read at true scale with floor to move across.
- Camera: 40° lens (was a telephoto 30°) with distances matched so things keep their on-screen size, and a
  slightly more oblique tabletop angle for natural depth.
- Grid test: the players'-end, full-wall tabletop case needs fewer visible grid pixels (walls hide most of
  the one revealed room); the no-leak check is unchanged.

## M2.0 World map — 2026-09-30

- `locations/ch02/barovia-region/world.json` (generated by `scripts/authoring/barovia-world.py`): the 26
  lettered locations of the regional map with positions measured at one quarter-mile hex ≈ 17.6 px, plus
  roads, rivers, lakes, peaks, high ground and woods. Only positions and names; the map art is original.
  Yester Hill sits off the printed crop and is placed approximately.
- World map view (map button beside the library): pan and zoom, lettered pins (minor names on hover), a
  party marker linked to campaign state. The DM drags the party to a pin or into the wilderness; the card
  gives straight-line miles and travel time at slow / normal / fast pace, and opens the built battle maps at
  that pin (Village of Barovia: village, church, Death House; Tser Pool; the Svalich Woods road). Opening a
  location moves the marker to its pin; a trail of recent moves is kept.

## M2.1 Outdoors — 2026-09-30

- Distant scenery for outdoor locations (`render/backdrop.ts`): the land runs on past the map edge, a
  forest ring closes in, ridges rise where the world map has high ground in that direction, the named
  peaks stand snow-capped at their bearings, and Castle Ravenloft crowns its pillar of rock where the
  world map puts it. Outdoor camera may tilt lower toward the horizon; fog is thinner outdoors.
- Village of Barovia remapped from the book map (p.42, one square = 40 ft): 116 building footprints
  measured from the roof shapes at 200 dpi (`scripts/authoring/village-map.py`), E1–E7 squares placed on
  their markers, the seed's roads and props carried into the measured frame. Houses are now gabled
  timber-framed Barovian houses with shutters and chimneys, varied per house.
- Placement layers say so in the subtitle ("40-ft placement squares") and frame an area with its
  neighbourhood.

## M2.2 Initiative and tactical ranges — 2026-09-30

- Roster of character sheets (name, colour, speed, reach, range, darkvision, initiative modifier; PC or foe),
  edited in the Initiative sheet and saved with the campaign. Tick who is in, roll or type initiative, start.
- An encounter gives every combatant its own token (coloured base, name label) placed around the party
  marker; ending it folds them back into one party marker.
- On each turn a Fire-Emblem-style overlay shows green squares the combatant can still move to (5e grid
  movement with the chosen diagonal rule, no corner cutting, closed doors and other creatures block), red
  squares it could strike in melee from anywhere it can reach, and a paler red for ranged reach with a clear
  line. Moving onto a green square spends that movement; the players' side may not move outside it or on
  someone else's turn. The DM may place a token anywhere (no movement spent). `core/range.ts` is unit-tested.
- Turn bar with the order, round, movement left, Next (or N) / previous / End; shown on the Player Display too.

## M2.3 Campaigns — 2026-09-30

- Campaign registry (`manifests/campaigns.json`, `app/src/campaigns.ts`): each campaign has its own manifest,
  world map and saved state; the library's top row switches between them and opening a location switches to
  its campaign, saving the previous one. See `docs/CAMPAIGNS.md`.
- A Wild Sheep Chase (Winghorn Press) imported from a `tabletop-mapset 1.0` export with
  `scripts/authoring/import-mapset.py`: the tavern (two floors), the street, the main road, the side path and
  Noke's tower (four platforms at 0/10/20/30 ft with stair runs and vertical links). Floors → rooms and terrain,
  walls clipped by their openings with door and window flags, posts → oaks and timber posts, raised patches →
  prisms (undergrowth noted as difficult terrain), the stream → water, decals → terrain. The export's DM notes
  ride along as room notes; pointer sections show in the library as "uses …". Regional hex map → world map
  with the route's five stops as pins.
- New kit pieces: `stairs-run` (any bearing), `prism` (polygon-shaped block), `oak`, `post-round`. World-map
  terrain density scales with the map; one label per named tract; the outdoor ground apron is a full disc.

## M2.4 Sheep Chase town, painted world maps, themes — 2026-09-30

- The tavern (`scripts/authoring/wsc-town.py`, shared helpers in `authorlib.py`): a 60 × 50 ft inn with a
  round table for six under the chandelier, the bar along the north side under a mezzanine with casks racked
  in the wall, an innkeeper's office with a strongbox, kitchen and store, stairs to a gallery, a railed landing
  and three inn rooms; a yard with a well and cart, and stables with three stalls and two horses.
- The town square replaces the street: a cobbled square around the well for a town of fifty, the tavern
  (same footprint, front door in the same place), a temple with a bell tower, the town hall, a dozen houses,
  the stables; Guz, his wolves and the bear placed for the DM. New kit: cask rack, hay, trough, round table,
  bar top, temple, sheep.
- Campaign themes: A Wild Sheep Chase is pastoral (light sky, green ground, thin fog, bright daylight);
  Curse of Strahd stays gothic. Backdrops, page gradient, fog and lights follow the theme.
- Noke's tower is a stacked site: every platform below the current one stays visible so the treehouse reads
  as one, framing takes the whole site, and its backdrop is a deeper wooded valley with taller ridges.
- World maps are painted: textured ground, forests of tree symbols with shadows, shaded hills and snow-capped
  mountains, lakes with banks and ripples, cased roads and dashed paths, town, castle, camp and ruin
  symbols, serif place names, a key panel listing every place (click to centre), a hex grid at the map's own
  scale (¼ mile in Barovia, 1 mile round the town), a scale bar that follows the zoom, and a compass.
- Camera: more glide (lower damping), gentler zoom steps, and a zoom-out limit that grows with the map.

## M2.5 Distant sites at true scale, real creature sizes, the section slicer — 2026-09-30

- Every outdoor map shows the other mapped places in the distance at their real distance and bearing from
  the world map (miles × 5280 ft), as silhouettes only: settlements, camps, castles, towers, temples, ruins
  and Tser Falls (a 1,000-ft cliff, white water, the stone arch bridge, mist and the river below), with the
  near ridges opened toward mapped neighbours and haze thickening with distance. Castle Ravenloft is only
  named at K.
- Creatures are modelled at real size; the size category sets the base ring, not the model. Horses stand
  about 5½ ft at the shoulder, the bear and the ape are new, the humanoids keep real proportions.
- Small buildings (the tavern, Death House) are stacked sites: every floor renders at once and the Section
  slider beside the floor tabs cuts the building at any height, up through the roof or down into the cellar.
  The cut follows the floor you pick (5 ft up with low walls, just under the ceiling with full walls) until
  you move it; the arrow button snaps it back. Only the current floor is annotated. A house and the dungeon
  under its garden are separate stacks; open sites (Noke's tower) keep the cut above the top platform so the
  whole tower stays in view.
- Facades: houses have timber frames, gabled roofs with chimneys, shutters and sills; the tavern on the
  square is the same building seen from outside.
- Wall tops stop a hair under the ceiling so they never fight the floor slab above them.

## M2.6 Castle Ravenloft, world-map places, roads — 2026-10-01

- Castle Ravenloft (`locations/ch04/K`, `scripts/authoring/castle-ravenloft.py`): a reconstruction of the
  whole castle from the book's isometric plates. Each plate is rectified into plan view (the two grid
  directions measured, the squares warped square) and the rooms read off a labelled grid, then placed in one
  frame registered on the towers. Twelve levels: dungeon and catacombs (-80, the 40 crypts and the tombs),
  the larders (-40), courtyard and main floor, the grand landing (+30), the court of the count (+50), the
  rooms of weeping (+90), the spires (+130), the witches' floor of the south tower (+150), the tower roofs
  and the bridge (+190), the north tower peak and roof (+240/+250) and the high tower peak (+300). Every
  keyed area K1–K88 with the dungeon cells, the stair towers rising through every floor, the elevator
  shaft, secret doors, own-wording descriptions and DM notes, and stair links between the floors. The
  castle is a stacked site: lift the section above the high tower and the whole castle stands.
- A keyed area split into several rooms uses `KEY-part`; a scene can be `partial` while it is built; a scene
  can name its `entry` level; the level that meets the open air decides the fog and the backdrop.
- Labels thin out with distance: far out only the area keys remain.
- World map: every place carries a player blurb and a DM note; hovering shows them; a tap on a place with a
  map opens it; the DM reveals places to the players (the players' map shows only known places).
- Roads and rivers from the world map run in and out of every outdoor map at true scale, joined to the
  map's own road at its edge, with gaps in the forest and the ridges along them.
- The section slider snaps to each floor's default cut.

## M2.7 Creatures on the map, free movement — 2026-10-01

- The creature repository (paw button): every person, monster and beast the module names, from the
  characters manifest, searchable by name, kind and area. Place one beside the party or place by tap, as many
  as you like. Each gets a figure (the characterised humanoid from the manifest, or the kit beast), a base
  ring by size, a players' name (people appear as strangers until the DM names them), hit points for the
  open-content monsters, and starts hidden from the players.
- Tap a placed creature: the panel shows what players see (rename it), hit points, Reveal/Hide, the Reach
  helper, Initiative and Remove. Players who tap a revealed creature get its name and what they make of it.
- The DM moves any creature or combatant anywhere at any time; players move only the party and only where
  it can walk. The Reach helper draws the picked-up token's move and strike squares outside initiative; in
  initiative the current combatant's ranges show as before. Placed creatures join the initiative with their
  own tokens from the roster sheet.
- Castle Ravenloft stands on its crag in the valley views, in full, with lit windows; from the castle the
  valley lies a thousand feet below.

## M2.8 Vallaki — 2026-10-01

- The Town of Vallaki (`locations/ch05/N`): a placement map from the book's town plan (scale bar), the palisade with
  gates where the roads cross it, the streets, 186 houses from the map's roof blobs, and the keyed sites N1–N9.
  Tap a keyed building for "Enter …"; the back button returns to the town.
- Every site as its own map (`scripts/authoring/vallaki-sites.py`): the Blue Water Inn (three floors: stable and
  loft, taproom under its balconies, kitchen, the hidden hall, guest rooms, the wereravens' attic), the
  Burgomaster's Mansion (foyer and gallery, library, the locked closet, the spirit mirror, Victor's attic
  workroom), Wachterhaus (the bay den and library, Stella's room, Nikolai in his bed, the cellar and the cult's
  pentagram), the Coffin Maker's Shop (thirteen coffins, the nest of crates upstairs), the Vistani Camp (the
  hill, the tent, the ring of wagons, the dusk elf hovels), and, from their text alone, St. Andral's Church
  (the village church's plan without the undercroft), Blinsky Toys and the Arasek Stockyard with Rictavio's wagon.
  Every keyed area with furniture, people, secret doors, lights, descriptions and DM notes.
- The section cut only slices the shell (floors, walls, doors, roofs). Furniture, people and things are never
  cut through: they show whole until the cut drops below their floor. The follow cut sits just under the floor
  above (the roof, on the top storey), so each room shows entire.
- A blowout without a world pin of its own takes its parent's for the backdrop.

## M2.9 The map, the frame and the measure — 2026-10-01

- A measure tool: two taps lay a ruler with the distance in feet and squares.
- Every map carries a north arrow that turns with the camera and a scale bar that follows the zoom, in the
  bottom-right corner.
- The Lands of Barovia read off the printed regional map at 400 dpi (`scripts/authoring/barovia-cover.py`):
  every lettered site (the Mount Baratok markers and the Ivlis bridges included), the roads and dotted
  trails, the three rivers, the lakes in their true shapes, and a land-cover grid at an eighth of a mile
  (forest, hills, mountains, water, mist) that the world map is painted from. Names lettered where the
  page letters them.
- Vallaki opens in two seconds, not fourteen: the coverage map takes a coarser cell on a map that large and
  caches which cells are floor.
- Realism: `scripts/authoring/settle.py` settles every outdoor map (houses pushed off the streets, terraces the
  roof extraction had run together split into houses, overlaps nudged apart or dropped, the palisade never
  through a house, every keyed site with its building on it, the ground under everything), and
  `audit-outdoor.py` checks it. Mist thins as the camera pulls back, so a map read from above never greys out.
  Token markers and name tags no longer follow the party into the next map.
- Legibility: the DM starts at the DM end of the view slider (the whole floor, every key, no fog); labels thin
  by what a foot is worth on screen, so a framed building shows its keys and names and keeps page numbers and
  stair rises for when you lean in; the default framing is a notch closer.
- The grid is a feature of the ground: one plane under the whole level, not a texture clipped to each floor.
  Settled buildings sit on the 5-ft lattice, turned in 45° steps.
- Camera presets: tabletop (free turn), isometric (true 35° pitch, snapped to the grid's diagonals) and
  overhead (north up, square to the grid); the tilt button cycles them.
- The top-right bar folds into two menus (Tools: reveal, paint, measure, undo; View: grid, walls, mist, labels,
  player camera, player display, a grid opacity slider and a snap-to-grid toggle) beside the four everyday buttons, and every bar wraps instead of running off the
  edge. The clock rides on a new bottom-left minimap: a north-up plan of the current level (ground, streets,
  rooms, walls, a faint grid, the party, the wedge the camera looks at); tap it to look there.
- The clock popover edits the calendar directly (day of the campaign, Harptos month and day, the festival
  days) and carries a travel calculator from the pace table (slow, normal, fast; difficult terrain halves it; a
  mount gallops its first hour) that advances the clock by the journey, eight travelling hours to a day.

## M3.0 The lie of the land — 2026-10-01

- Every region has a heightfield (`scripts/authoring/heightfield.py`): Barovia's rises by land cover read off
  the printed map (valley and forest low, hills, mountains, the mists walling the rim), with Mount Ghakis,
  Mount Baratok and the Balinok range as true summits and the Pillarstone of Ravenloft as a true crag; the
  Sheep Chase country's rises from its hills, the fell and the stream's cut. Heights are relative to the lowest
  settlement, on the cover lattice (`height` in world.json).
- Outdoor backdrops stand on that land (`core/terrain.ts`): one low-poly mesh from the map edge to the
  horizon, coloured by cover (forest, hill, rock, snow above the snow line, water, mist) with the light baked in;
  the map's own ground is flattened into it, a crag site drops away just past its walls; roads and rivers drape
  over it; the forest stands where the cover says; every other place sits at its own height. From the village
  the mountains close the valley and Ravenloft stands on its height; from Vallaki, Lake Zarovich and Baratok;
  from Noke's tower, Ramsback Fell. Nothing on stilts.
- Noke's Tower rebuilt (`scripts/authoring/noke-tower.py`): a round stone tower of three floors over its ground
  hall, a conical roof (new `roof-cone` prop), the spiral stair up the inside of the wall, windows on the
  valley; the shepherd hut, the outhouse with the bear, the yard and the track climbing to the door; the oaks
  round about. Same levels and area keys as before. An upper floor's grid stays within its own walls.
- Vallaki on its lake: the pin sits on the shore, the valley floor climbs away from the water toward the hills,
  the town's ground stops at a belt round the palisade so the lake and slopes show beyond, every tree within
  200 yards of the walls is a stump, the forest stands back a quarter mile. Streets smoothed (two corner-cutting
  passes); the Old Svalich Road the only cobbled street; bare earth under every house; a few worn desire paths.
- The town square (N8) is a 150 × 110 ft plaza with the festival stage, two pillories, the well and braziers, and
  four shops round it (smithy and armourer, the jeweller round the corner, an alchemist, a general store), on the
  town map and as its own area map (`scripts/authoring/vallaki-square.py`).
- Grid: drafting-style orders (cells, then 10, 50, 100, 500 ft) that strengthen as the camera pulls back; Square /
  Hex / Off in the View menu. The camera may look straight down.
- Tser Falls is the land's own drop, not a standing block; Ravenloft stands on a sheer pillar of bare rock.
- Castle Ravenloft's exterior is built from its own plans (`scripts/authoring/ravenloft-exterior.py` →
  `locations/ch04/K/exterior.json`): every 5-ft column rises to its highest roofed room with a slate cap, the
  courtyards stay open, the 90-ft curtain walls carry battlements, every stair tower is a round tower to its top
  with a conical cap, windows burn along the outer faces. It stands on the Pillarstone: a cluster of jagged rock
  shards, not a drum.
- The Vistani camp (N9) has its look: painted barrel-topped vardos, the striped great tent, campfires with pots on
  tripods, washing lines, horse pickets, and the dusk elves' sod-roofed hill homes (new `vardo`, `campfire`,
  `big-tent`, `mound`, `washline` props; turf roofs). On the Vallaki map the camp shows outside the west wall: the
  hill, the great tent on top, a ring of vardos, fires and the hovels round its foot.
- Ravenloft looms: the land carries a broad shoulder to under half the Pillarstone's height and the rest is a sheer,
  jointed column of rock crowded with spurs, talus at its foot and soft mist pooled round it, so the castle stands
  far above the village on a cliff a real crag could make. Relief beyond every map is drawn a quarter steeper and
  a thick wood presses up to each map's edge wherever the land cover is forest (one instanced draw).
- Context: an area map stands in its surroundings. The parent map's houses, trees, streets and props within a few
  hundred feet of the room that opens it are drawn round it as muted scenery (moved into the area map's frame and
  north), and the backdrop forest keeps out of the town. The town square sits among Vallaki's streets.
- Indoors legibility: one compact stair marker per stair (the destination shows on hover), room labels slimmer,
  and a declutter pass hides any label that would overlap a more important one. Roofs raised over walls go when the
  walls are cut down; hovering a roof describes the room beneath.
- Ravenloft's gaze: a notch is cut through any ridge between a map and the castle, so it stands on the skyline from
  every place in the valley, except the Tser Pool camp, sheltered in the gorge at the foot of the falls. Distant
  landmarks are drawn nearer than surveyed (true distance to 3,000 ft, then under half the rest) with less haze,
  and the moonlight on the castle is stronger.
- The moon: a great disc low over the mountains in its true phase from the clock, with a halo, behind Ravenloft
  wherever the castle is in view.
- Argynvostholt is a ruined manor with its beacon tower on a ridge, not a dark column.
- Vallaki's palisade: 22-ft timber trunks sharpened to points, binding rails, a fighting walk on the town side,
  guard towers every 300 ft and a pair at each gate (`palisade`, `watchtower` props). A livery stable with its
  paddock and horses north of the main road; worn paths to Blinsky Toys. The stray dot under the toolbar is gone.
- Old Bonegrinder (ch06/O, `scripts/authoring/old-bonegrinder.py`): the brick windmill on its hill, four storeys
  from the map and text: the filthy kitchen with the oven, the ichor barrel, the painted cabinet, the toad trunk
  and the coop (O1, 8 ft); the bone mill with the millstone and gear shaft and the rotten platform round the mill
  (O2, 8 ft); the bedroom with the canopied bed, the closet and the three crates (O3, 9 ft); the domed attic under
  the onion dome with the dead sails (O4). Morgantha, Bella and Offalia, Freek and Myrtle, every secret from the
  text; the path from the road and the four megaliths at the forest's edge. Opens from the world map. New
  `millstone`, `gear-shaft`, `onion-dome`, `mill-sails`, `standing-stone` props.
- The mountains per the module: Mount Baratok is one monolith climbing from the north shore of Lake Zarovich (the
  M markers are its base), Mount Ghakis the snowy height to the south; high ground stands clear of the haze.
- Lake Zarovich lies level with its shore: a lake that reaches a map sits at the town's own ground, any other at
  the lowest point of its shore; Vallaki's ground stops short of the water. Bluto's rowboat is out on the lake off
  Vallaki, a man fishing and a sack at his feet.
- Old-growth forest: denser, a quarter taller.
- The moon rises at six in the evening in the east, stands highest at midnight and sets at six in the morning in
  the west, a quarter smaller than before, in its phase; Barovia's sun is a small pale disc behind the overcast.
- Floors are a dropdown (no more cut-off tabs) with a Whole building button that lifts the cut and frames every
  floor at once.
- Ravenloft's approach (p.37-38), on the castle map and in every view of it: the road along the ridge from the
  Gates of Ravenloft, the fifty-foot chasm (its faces dropping into fog), the drawbridge of old shored-up beams with
  boards missing and its chains, the two gate towers either side of the entry tunnel, the portcullis; the board-
  breaking rule as a DM note. Under a crag site's map the land falls away at once, so the chasm shows its depth.
  From afar: the gate towers, the drawbridge and the far rock spur carrying the road down the ridge.
