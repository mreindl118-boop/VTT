# The mistLAB look: a D&D-inspired UI system

One design system for every UI element in both campaigns: "a lit page on an iron table". It is inspired by the genre (parchment and ink, small-capital headings, ruled dividers, wax seals, ribbons, initiative shields), never a copy of any brand's logo or trade dress. Built in steps alongside the clarity iterations (`docs/CLARITY.md`); each step ships as its own version.

> **Initiative:** the owner has since asked for a Baldur's Gate 3-style initiative strip across the top of the screen. The initiative component in step T3 follows that encounter design rather than restyling today's bottom turn bar.

## Concept

"A lit page on an iron table." The 3D diorama is the table. Two surfaces sit on top of it and every component belongs to exactly one:
- CHROME is what you press: toolbars, sliders, the turn bar, the status line, menus.
- PAGE is what you read: cards, sheets, tooltips, stat blocks, Books.

The genre's visual language comes in through type (small-capital headings, one display face per campaign used only at 28 px and above), a few cheap CSS motifs (a ruled divider, a wax seal for DM-only content, a swallowtail ribbon on the Player Display, initiative shields, coin slider thumbs, metal pressed states) and five rules families, each with a colour, an underline style, an emblem and a kicker word. Ornament stays at edges and headings. It never appears inside dense rows or over the map.

Barovia (Curse of Strahd, gothic):
- Chrome is tarnished iron: bruised violet-black #1f1b24 with a silver highlight. Pressed controls are dull silver.
- Pages are cool grey parchment #ebe2cc with wine #7a1f2b accents.
- Candle amber #f2b35b marks focus, the current turn and the 'on' state, as a glow or a lit bar, never a fill.
- The rule is a double iron hairline with a centred lozenge. Sheet titles are set in Grenze Gotisch.

A Wild Sheep Chase (pastoral):
- The same components with different tokens: cream chrome #fbf5e6 with brass pressed states, warm paper #fdf7e8 with pine #2f5a3a accents, a lit amber-brown 'on' state (#9a5a12) and an amber glow.
- Rounder radii, a brass lozenge rule, and sheet titles in Fraunces.

The layout is identical in both campaigns. Measured: the top bar is 124 px tall at 1366, 1024 and 844 wide and 186 px at 390, in both campaigns. Both campaigns set the top-bar location in the same heading face, so the widths match. The OS dark scheme turns Barovia's pages into night vellum, with a candle-amber accent, and turns the Sheep Chase chrome and pages into walnut.

Clarity rules (each is a mechanical check in the build):
- No element gets more words, smaller text or lower contrast than today.
- No sans text is below 13 px. The only exceptions are map-label sub-lines and condition pips at 11 px, against today's 9.5 px sub-lines.
- Every text node passes 4.5:1 (3:1 when large) against the rendered pixels behind it, not only against flat tokens.
- Every tap target's own box is at least 44 x 44.
- No chrome panel overlaps another at 390x844, 844x390, 1024x768 or 1366x768.
- Meaning never rests on colour alone. Each colour comes with a word, an emblem, an underline style, a stripe, or a lit bar plus bold.

Trade dress:
- No D&D wordmark, no dragon ampersand, no Wizards of the Coast fonts or look-alikes, no art from the books.
- No orange-bar frame, no green note box, no gilt drop cap.
- No red small-caps monster name, no red property labels and no red wedge divider. The stat block is set in ink, and the accent appears only on its section hairline.
- All hues are our own, taken from the palette in STYLE.md.
- The party marker stays a plain red & in our bundled UI face (Atkinson 700). On dark surfaces it uses a lighter red, so it keeps at least 3:1.

## Tokens

Source: (prototype, local), sections 2-4. Tokens hang on [data-campaign] (the app already sets body.dataset.campaign) plus [data-scheme='dark'], which in the app becomes the existing prefers-color-scheme / :root[data-theme=dark] gate.

SURFACE SCOPING (the key mechanism):
- Every chrome element (.topbar .group, .camcluster, .vslider, .minimap, .mapframe, .turnbar, .status, .toast, .menu-panel, .finder, .pn-toggle, .panel) re-points the legacy names --bg, --panel, --ink, --ink-2, --hair and --accent to the --c-* tokens, and also --edge, --sunk, --raise, --focus, --primary, --primary-ink, --party-ui, --danger and the four --k-* family colours.
- Every page element (.sheet, .infocard, .tapmenu, .tip, .tokpanel, .rooms, .clockpop, .world-card, .world-tip, .world-key, .dialog, .rt, .statblock, .book, .credits) points the same names at the --p-* tokens.
- So existing rules, and the movable-panels CSS (--panel, --hair, --ink, --ink-2, --accent), keep working unchanged inside either surface.

SHARED:
- Fonts: --font-ui 'Atkinson Next'; --font-head 'Alegreya SC'; --font-book 'Alegreya'; --font-mark Atkinson (the &); --font-display per campaign.
- Type scale: --t-1 13, --t-2 14, --t-3 16, --t-4 18, --t-5 22, --t-6 28; --t-kicker 16; --t-h3 18; --t-loc 20.
- Line heights: --lh-ui 1.3, --lh-book 1.5, --lh-display 1.08.
- Spacing: --sp-1..6 = 4/8/12/16/24/32. --hit 44px. --emblem-min 20px.
- Party: --party #c0392b (unchanged) on the map and light surfaces, with --party-halo #f3ead6 (4.55:1 on its halo). --party-on-dark #e8604f on dark chrome and dark pages measures 3.88 to 5.54 on every dark surface; 3:1 is required for a 26 px bold glyph.
- HP bands (dark tag; DM only; behind View > HP bars, which defaults to off): --hp-ok #7cc68a, --hp-hurt #f0b75e, --hp-low #ec8a7c.
- Measured layout variables, set by a ResizeObserver per panel the same way --turnbar-h is set today: --topbar-h, --turnbar-h, --cam-w/h, --mf-w/h, --mm-w/h, --vs-w.

RULES FAMILIES (shared with the tooltip pass). Five inline families, each a light / dark pair, and each with its own underline style:
- condition: #87560e / #e9d973, ochre / straw, dashed underline. Pip fill is the -d colour.
- magic (spells and magic items): #3b367d / #b1a8ee, violet, double underline.
- monster: #ad2c73 / #ed85b3, raspberry, moved off the Barovia wine. Wavy underline.
- rules (rule, action, sense, damage type, mundane gear): #016a80 / #9ed8e7, slate-teal, dotted underline.
- page reference: the page's own ink with a solid 1 px underline. No hue.

Measured by tokens.py:
- Pairwise distance is 22.3 to 54.0 dE2000. The closest pair is magic and monster on dark.
- Distance from every campaign accent in all four themes is at least 15.7 dE2000. The closest is condition-d against candle amber; the Barovia dark-page accent is now amber, not #ec8a7c.
- Under protan and deutan simulation (Machado 2009), every pair stays at least 8.2 dE2000 apart.
- Every family is at least 10 dE2000 from ink-2 (closest 13.7), so a link never reads as secondary text.
- Contrast is at least 4.5:1 on bg, raise and both card-gradient stops in all four themes. The lowest pixel-sampled family text is 4.64.

ITEM RARITY, used only on a magic-item card's kicker word and name (the stripe is the magic family). Light / dark:
- common #55504a / #c9c2b8
- uncommon #2e6b2a / #8fd08a
- rare #1f4f8a / #8fb6ea
- very rare #74297f / #d79be6
- legendary #8f4300 / #f5a65a
- artifact #6e3a1e / #e0a982
Each is at least 4.5:1 on its page.

BAROVIA [data-campaign=cos]:
- Chrome:
  - --c-bg #1f1b24 (alpha rgba(31,27,36,.94)), --c-raise #2b2631, --c-sunk #141117, --c-edge #4a4352
  - --c-ink #ede5d3 (13.5:1), --c-ink-2 #b3a99b (7.31)
  - --c-accent, --c-on and --c-focus: candle #f2b35b (9.17 on bg, 7.99 on raise)
  - --c-primary #f2b35b with --c-primary-ink #231a10; --c-ok #8fc79c; --c-warn #f0b75e; --c-bad #ec8a7c
  - --c-metal: a silver gradient #565c65 / #40444c / #34373e. The top stop was darkened, so --c-metal-ink #f6d9a8 measures 4.95 / 7.17 / 8.75.
  - --c-coin: a radial silver. --c-party = --party-on-dark.
- Page:
  - --p-bg #ebe2cc, --p-raise #f4eddc, --p-sunk #dfd4b9, --p-edge #b2a07c
  - --p-ink #2a1d14, --p-ink-2 #5c4b3a, --p-accent wine #7a1f2b
  - --p-primary #7a1f2b with ink #f6eedd; --p-dm: 9% wine; --p-party #c0392b; --p-danger #9b2c1c (a UI state colour, not a rules family)
- Motifs:
  - --rule-col #7a1f2b
  - --seal: radial #a83a46 / #7a1f2b / #4d1119, with ink #f6e3d0 at 5.01 / 8.17 / 11.93
  - --ribbon #7a1f2b with ink #f6eedd
  - --glow: a 2 px amber ring plus a 16 px amber bloom
  - --pin-bg #f7f1e3, --pin-ink #7b2d26
- Radii 4/6/10.
- Minimap tokens replace the TS literals: --mm-ground #3a4a3d, --mm-room, --mm-wall #111, --mm-cam #f2b35b.
- Map labels: --lbl-bg rgba(28,22,34,.78), --lbl-ink #f3ecdc.

SHEEP CHASE [data-campaign=wsc]:
- Chrome:
  - --c-bg #fbf5e6, --c-raise #fffaf0, --c-sunk #eee2c6, --c-edge #c8b285
  - --c-ink #2b2216 (14.37), --c-ink-2 #65553e (6.61)
  - --c-accent and --c-focus: pine #2f5a3a
  - --c-on #9a5a12, a lit amber-brown at 5.02 on bg and 5.25 on raise. It drives the menu bar, the lit icon, the view-slider fill and the 'on' end label.
  - --c-primary #2f5a3a with #fbf5e6
  - --c-metal: brass #efd690 / #cfa75a / #b98f44 with ink #2b2216 (10.94 / 6.95 / 5.27). --c-party #c0392b (5.00 on bg).
- Page:
  - --p-bg #fdf7e8, --p-raise #fffcf3, --p-sunk #f2e7cc, --p-edge #cdb88c
  - --p-ink #2a2016, --p-ink-2 #66563f, --p-accent pine #2f5a3a
  - --p-danger #9b2c1c
- Motifs:
  - lozenge rule 5 px #9a6b2e
  - seal radial #3d6e48 / #2f5a3a / #1e3128 with #f3f0dc (5.20 at the lightest stop)
  - pine ribbon; amber #c9822e glow
- Radii 6/10/14.
- Minimap: --mm-ground #9cb77e, --mm-wall #3a2f24, --mm-cam #c9822e.

DARK SCHEME OVERRIDES:
- Barovia pages: #2a2430, raise #332c3a. Ink #ede5d3 and ink-2 #b8ad9e. Accent and focus candle #f2b35b. Primary #8e2633 with #f6eedd. --p-party #e8604f, --p-danger #f19a8a.
- Sheep Chase chrome: walnut #2a241c. Ink #f3ead6 and ink-2 #c2b59c. On, focus and primary #e6c27a. Accent #8fc79c. --c-party #e8604f.
- Sheep Chase pages: #2f2820. Accent #8fc79c, --p-party #e8604f, --p-danger #f19a8a.

STATES:
- hover: --hair wash.
- pressed, toggled or selected: the metal gradient (drawn inside the 44 px box for segments) plus an inset shadow and bold. In menus, add a 3 px glowing --c-on bar and a lit --c-on icon.
- focus-visible: 2 px --focus outline at 2 px offset.
- disabled: opacity .4 (exempt from contrast, per WCAG).
- current turn: --glow.

CONTRAST, MEASURED THREE WAYS:
- tokens.py (269 checks, all pass) covers every family on every page surface, every gradient stop under text (metal, seal, primary, ribbon), the on state and the party mark on every surface.
- shieldPaint is swept over 4,913 colours (17 levels per channel). The worst digit is 4.50:1.
- check.mjs samples the rendered pixels behind every visible text node (text hidden, page screenshotted, glyph band sampled, covered text skipped) in all four themes plus the phone scene and the TV: 440 / 431 nodes per gallery and 33-35 per phone scene. Nothing is below its threshold. The lowest are 4.57 (a 13 px room page reference on night vellum), 4.64 (a rules link on parchment) and 5.21 (shield digits).

## Type

ROLES (all bundled):
- UI and controls: Atkinson Hyperlegible Next, variable 400-700 (19,252 B). Every button, label, menu, input, table cell, number and status message. tabular-nums is set on body. The UI face is never italic.
- Headings: Alegreya SC 700 (18,736 B). Used for:
  - the top-bar location (20 px; 18 px on phones; was 15 px SF 600)
  - card titles 21-22, stat-block names 26, section h3 18 and kickers 16 lowercase
  - Library campaign tab names 20, dialog titles 24, the turn-bar 'Round' 16, the compass N 13
  - The kicker's 8.1 px small caps beat the 7.2 px caps of today's 10 px tags. Section h3 is 9.1 px against 8.6.
- Display, one face per campaign, only at 28 px and above:
  - Barovia: Grenze Gotisch 600 (16,556 B). Sheep Chase: Fraunces Soft 700 (17,940 B).
  - Used for sheet h2 (28), the world-map header (28), Books h1 (36) and the Player Display ribbon (32-48).
  - Never used for labels, buttons, numbers, tabs, dialog titles, initials or the top bar. The .display class enforces max(28px, 1em).
- Book and stat text: Alegreya 400-700 (43,900 B) and Alegreya Italic 400-700 (44,812 B, subset then instanced).
  - Used for stat blocks, Books, read-aloud, world-map place names (replacing Georgia, which rendered as DejaVu Serif on Linux) and the display caption.
  - Set with lining-nums tabular-nums for stats. It is the only italic in the system.

LOADING:
- First load: Atkinson and Alegreya SC, preloaded. Measured in a fresh context, scene only, from navigation to 'load' plus 2 s idle: 37,988 B of woff2 in both campaigns. Nothing else is fetched.
- The display face and Alegreya load on first use through @font-face (font-display: swap) when a sheet, the world map, a stat block or Books opens.
- All four are added to the existing sw.js 'cache-pack' message, using Vite manifest URLs, on the first idle callback at least 3 s after __mistlab.ready. So a later offline session has them, and sw.js itself does not change.

SIZES, desktop and iPad (CSS px):
- UI body 16; secondary 14; meta 13; card titles 18-22; top-bar location 20; sheet titles 28.
- Icon buttons, menu rows, fields, segments, chips, list rows and text buttons are 44 px boxes.

Phone:
- The same sizes, except the location is 18 (still above today's 15).
- .sub and the 'Section' word are hidden, as today.
- The turn bar keeps one row. The current combatant shows its name; every other combatant shows a 13 px three-letter abbreviation under its shield, in turn order, so the next one is the first abbreviation. Full names stay in the accessibility tree, visually hidden, never font-size 0.

Map labels (CSS2D):
- Key 12/700 with an 11 px sub-line (today 11 and 9.5).
- Token tag 13/700 (today 11). Pips 11/700 on a 22x20 pill.

Player Display: the stage does not scale. Fixed CSS px, with clamp() on every size:
- ribbon clamp(32px, 2.5vw, 48px)
- floor chip clamp(20px, 1.35vw, 26px) in uppercase Alegreya SC
- turn names clamp(18px, 1.25vw, 24px); shield digits clamp(20px, 1.6vw, 28px)
- waiting banner clamp(18px, 1.25vw, 24px); caption clamp(22px, 1.67vw, 32px); tags clamp(18px, 1.05vw, 20px)
- Measured with script and style tags excluded: minimum visible text 24 px at 1920x1080 and 18 px at 1280x720. Every TV text passes 4.5:1 on rendered pixels.

## Components

### Panel chrome and the movable-panels pieces (.panel, .pn-handle, .pn-grip, .pn-fold, .pn-toggle)

All chrome panels share one recipe: a --c-grad background, a 1 px --c-edge border, --r-3 radius and --c-shadow. backdrop-filter is removed.
- .pn-grip shows 2x3 rivets. .pn-fold shows a chevron. The folded pill has a 4 px --c-accent bookmark edge.
- .pn-toggle (hide panels): the button's own box is 44x64 at the screen edge, and the 26 px ribbon is drawn inside it by ::before. It sits under the top bar at top: calc(var(--topbar-h) + 24px), so it collides with nothing.
- Hand-off to the panels pass: the grip (30x30) and fold (30x26) remain the only controls under 44. The tap sweep reports them separately (2 per page) and does not fail on them. The panels pass should make the grip one full-height 44 px strip, where a tap folds and a drag moves. The theme does not change that behaviour.

### Buttons

- button.icon and summary.icon are 44x44 (were 40, and the summary was 22x27), with --r-2 corners and a hover wash.
- Pressed (aria-pressed, an open details, .active): the --c-metal gradient, --c-metal-ink and an inset shadow.
- Disabled: .4 opacity.
- .btn (text): min 44x44, --raise fill, --edge border, 600 weight.
- .btn.primary: --primary. On chrome it is candle with dark ink in Barovia and pine with cream in the Sheep Chase; on pages it is wine or pine. This replaces today's three primaries.
- .btn.quiet: accent text only (End, Cancel).
- .btn.danger: a --danger outline (Remove). --danger is a state colour, not a rules family.
- The party '&' inside buttons is .amp: Atkinson 700 26 px in --party-ui, which is #e8604f on dark chrome and pages and #c0392b on light ones.

### Segmented controls (DM/Players, Grid, pace)

A sunk track with an inset shadow. Every segment's own box is 44 px tall (min 44 wide). The selected state is a metal pill drawn by ::before, inset 3 px inside that box, plus bold. There is no pseudo-element hit extension. The track may wrap on a narrow phone (flex-wrap, max-width 100%), so it never widens the page. The same component serves aria-selected tabs and aria-checked radios.

### Menus (details.menu Tools/View)

The .menu-panel is a chrome surface with min-width min(268px, 100vw - 16px) and max-width 100vw - 16px, holding 44 px rows of icon plus label.
- Toggled rows (aria-pressed) get a 3 px glowing --c-on bar, a lit --c-on icon and a bold label. In the Sheep Chase the bar and icon are now amber-brown, not ink.
- .menu-row wraps when a segment does not fit. .menu-sep is a hairline.
- Clamping the panel into the viewport on phones is the layout's job; the max-width above guarantees it fits.

### Tabs (Library campaign tabs, Books contents)

- Campaign tabs (role=tab) are page cards at least 64 px tall: an emblem (evil-bat or sheep, 34 px), the campaign name in Alegreya SC 700 20 px (the same face for both, so the Library never loads the other campaign's display face) and a 13 px sub-line.
- The tab grid is repeat(auto-fit, minmax(230px, 1fr)), so on narrow sheets the tabs stack full width and 'A Wild Sheep Chase' stays on one line.
- The selected tab gets an accent border, a 4 px inset bottom bar and an accent emblem.
- Books contents links are 44 px rows. The current one is bold ink on --p-bg with a 3 px accent bar. On phones the contents sit behind a 44 px 'Contents' icon button in the running head.

### Chips, tags and swatches

Two classes, so the tap sweep knows which is a target:
- .chip: an interactive toggle (button, aria-pressed). Its own box is at least 44x44, and the 30 px pill is drawn inside it by ::before (isolation: isolate). Pressed adds accent text, bold and an accent-tinted pill. Used for 'Hidden from players' / 'Shown to players' on the world card. Always an icon plus a word.
- .tag: a non-interactive label (span), 24 px, 13/600. Used for 'map' and 'open' in key lists and Library rows, and 'Hidden' in the token-panel header. Never a tap target; the row around it is.
- .swatch: always a 22 px circle (inline-block, aspect-ratio 1, a 2 px ring).

### Fields, selects, search, checkboxes, switch

One field style, 44 px tall, everywhere, including roster cells and the finder (no 40 or 42 px overrides).
- --r-1 corners, an --edge border, an inset shadow, 16 px text, max-width 100%. Fields use --sunk on chrome and --raise on pages.
- select.f: appearance none with a CSS chevron.
- Search: a CSS-drawn clear button.
- label.check: min 44x44 with justify-content center when it has no visible text. The 22 px box gets a --primary fill and a CSS tick when checked.
- .switch: a 46x44 box with a 28 px track and a 22 px coin drawn inside.
- Roster inputs have min-width 64 (name and kind 120). The roster table sits in a horizontal scroller (.rosterwrap), so on a 390 px phone the cells keep 44 px boxes and the page never widens.

### Sliders (range inputs and the vertical view slider)

- Range: an engraved 6 px groove (accent up to --pct, sunk beyond) and a 26 px metal coin thumb, in a 44 px tall input.
- View slider: a 64 px chrome column (56 on phones) from top: calc(var(--topbar-h) + 24px) down to the map frame. The groove has a --c-on fill and lozenge detents.
- The coin's own box is 44x44, with the 34 px coin as its content box (background-clip: content-box) and a drop-shadow filter, so there is no pseudo extension.
- The 'DM' and 'Players' end labels sit outside the thumb's travel; the end you are at lights in --c-on.
- Peek is a 44 px icon button.

### Top bar, floor picker, section, finder

The grid areas are today's (styles.css lines 161-176): one row above 1400 px; 'left right' / 'center center' at 1400 and below; three rows at 760 and below. Only sizes change.
- Title: the location in Alegreya SC 700 20 px (18 on phones, truncating) over a 13 px .sub. The same face in both campaigns, so wrapping is identical.
- Floor: select.f, 44 px. On phones it shrinks (max 160 px, ellipsis) so the centre group fits 374 px.
- Section: a range (140 px; 80 on phones) plus a bold ft readout.
- Initiative: a new 1.5 px line d20. It lands in the same commit as the clarity pass's Help wording change (see T1).
- Creatures keeps the line paw.
- Finder: a chrome search field (44 px input) over a page results list of 44 px rows (key, name, floor).
- Measured --topbar-h: 124 px at 1366, 1024 and 844 wide, and 186 px at 390, identical in both campaigns.

### Cards: info card, room tap menu, hover tip

All are page surfaces (--p-grad, an edge, --p-shadow, max-width 100%).
- Info card (360 px):
  - h2 in Alegreya SC 22 ink, capitalised (fixes lowercase 'gate').
  - The .where line: a .keybox, the area, and the page reference as an ink .rl.pageref.
  - The rule; the description at 16/1.45; the 'Players see' line.
  - .dmnote: a 30 px wax seal 'DM' (aria-label 'DM only') on a tinted block with a 3 px accent bar. It replaces the uppercase 'DM ONLY' tag and the violet box, with fewer words.
  - The state line with an icon, then .btn actions.
- Tap menu: a roomhead (SC 18 title, page reference, description, DM seal block) and 44 px icon rows.
- Hover tip: a 16/700 title over a 13 px sub-line (today 13/11). It is transient and hidden on phones.

### Stat-block card (bestiary page; DM tooltip, token panel expansion)

A min(400px, 100%) page in Alegreya 16/1.38 with lining tabular numerals. Our own layout:
- A kicker row: a wolf-head emblem (20 px, ink-2) and the word 'monster'.
- The name in Alegreya SC 26, in ink, not red. The italic meta line in ink-2. The campaign rule.
- Four tiles: AC (checked-shield), HP plus dice (hearts), Speed (boot-prints) and CR (skull-crossed-bones). Each is an Atkinson 20/700 number over a 13 px word, with a 22 px emblem in ink-2.
- The rule, then a six-column ability grid: Alegreya SC 17 lowercase headings in ink-2, the score bold, the modifier in ink-2. Then the rule again.
- Property lines with ink-bold labels. Values carry typed rules links.
- h5 'Actions' in SC 19 ink on a 1.5 px accent hairline. That hairline is the only accent in the block. Action names are bold italic.
- Footer: the source (SRD 5.1 · CC BY 4.0) in ink-2 and a 44 px d20 'Roll' button. Per pitfall 25, nothing reaches the display without 'Show result'.
- Trade-dress reasoning, recorded in STYLE.md: the official look is the sum of a red small-caps name, red labels, a red tapered wedge and orange bars. We keep the 5e reading order, but render the name and labels in ink, use our own divider (Barovia: double hairline with a lozenge; Sheep Chase: brass lozenge) and keep the tile row and ability grid, which have no counterpart there.

### Rules tooltip card (.rt) and inline rules link (.rl)

Card:
- A min(340px, 100%) page card with a 5 px stripe in the family colour (--k).
- Kicker row: a 20 px emblem plus a lowercase small-caps word in the family colour. The words: 'condition', 'spell · 1st level · enchantment', 'magic item · uncommon', 'monster · CR 1/4', 'rule', 'action', 'sense', 'damage type', 'module page'. The kicker word carries the exact type.
- Title in Alegreya SC 21 ink, then a 14/1.45 body (short bullets allowed).
- Footer hairline with the source in ink-2, and a 44x44 pin icon button.
- Magic items: the stripe is the magic family, and the kicker word and the name take the rarity colour (.rt.item.rare and so on). Rarity colour appears nowhere else.

Inline .rl: the family colour, 600 weight and the family's own underline:
- dotted: rules (rule, action, sense, damage)
- dashed: condition
- double: spell and magic item
- wavy: monster
- solid ink: page reference
Type is readable before hover even without colour. Inline links use WCAG 2.5.8's inline exception; the card's pin button and every other control are 44 px.

The class API for the tooltip pass is .rt.<kind> and .rl.<kind>, with kinds condition, spell, magic, monster, rule, action, sense, damage, item, pageref, plus the rarities common, uncommon, rare, veryrare, legendary and artifact (with .item on cards). Kinds map onto the five families.

### Initiative tracker (turn bar and roster sheet)

Turn bar (chrome):
- It docks above the bottom row, between the minimap and the view slider: left calc(12 + --mm-w + 12), right calc(12 + --vs-w + 12), bottom calc(12 + --cam-h + 12).
- Width max-content, capped to that band. The shield row scrolls sideways instead of wrapping, so it can never grow into a neighbour. Measured: x 370-890 at 1024x768, between the minimap (ends 312) and the slider (starts 948).
- Each combatant .cb is a 32x36 clip-path shield. The fill and digit ink come from shieldPaint(tok):
  - dark ink #1a1410 on a tok-to-80%-tint gradient when both stops give 4.5:1;
  - otherwise white on tok darkened until it passes.
  - The worst case over 4,913 colours is 4.50:1. There is no text-shadow, and 16/700 digits.
- Then the name 14/600. The current combatant (.cb.now) gets a raised fill plus the candle --glow.
- The line: '<b>Round 1</b> · Fighter · <ok>30 ft</ok> of 30 ft left'. Actions: prev chevron, find '&', primary 'Next turn', quiet 'End'.
- Phone: one row; the current combatant shows its name, the others a 13 px three-letter abbreviation under the shield (.ab), with the full name visually hidden (.nm).
- Landscape phone: order on top, then line and actions on one row (116 px tall).

Roster sheet:
- A page sheet with a display-face h2 'Initiative', a 'Roll for all' button with the rolling-dices emblem, and a padded hint.
- Headers are SC lowercase 16 (were 11 px). Rows have 44 px fields in a horizontal scroller, round swatches and 44 px checkbox labels.
- The footer ends with a primary 'Start encounter'.

### Token tags (CSS2D), HP bars (option) and condition pips (increment 9)

Plain over the map, with no ornament.
- Tag: one dark .tagbox (rgba(20,16,24,.86), hairline white border) holding the name row: a 6 px --tok notch and a 13/700 ivory name. Foes use #ffd6c8.
- Hidden creatures get a dashed border plus an eye-off glyph, instead of italic at .55 opacity.
- HP bar: a 64x6 bar inside the same box, in bands of more than 50% green, up to 50% amber and up to 25% coral. It renders only when View > HP bars on tags is on, which defaults to off (pitfall 23). It is DM only; numbers stay in the token panel and nothing goes to the players' side (pitfall 26).
- Pips: they ship only with increment 9. Up to 3 22x20 pips plus '+n', inside the same box under the HP bar, so they can never land on a neighbour's name. Ink #231a10 on condition-d #e9d973.
- Pip codes come from a fixed, unit-tested table: Bl, Ch, De, Ex, Fr, Gr, Ic (incapacitated), Iv (invisible), Pa, Pe, Po, Pr, Re, St, Un. The full name is in the title and aria-label.
- Party: a 26 px red '&' with a 4 px bone halo (paint-order stroke), 4.55:1 against its halo.

### Token panel

A 330 px page card:
- Header: swatch, name in SC 22 ink, and a non-interactive 'Hidden' .tag. Reveal and Hide stay the action button.
- Stat pills (AC with shield, speed with boots, size, CR), with 20 px emblems. The words are the same as today's grey run.
- A 'Players see' field.
- An HP row: 44 px −/+ buttons around 'n / max hp' with an 8 px accent bar.
- Actions: primary Reveal, Reach (boots), Initiative (d20) and Remove (.btn.danger; data-a=remove kept).

### Library and Books reader

Library (page sheet):
- Campaign tabs as above.
- Chapter headings in SC 18 ink over a 60%-width campaign rule.
- Rows are 44 px buttons: an auto-width key column (.keybox, so '03-compound' fits), the name, a meta line and an 'open' .tag.

Books (two-pane page):
- Contents: a sunk background with SC kicker group heads and 44 px links.
- Article in Alegreya 17/1.5 at a 68 ch measure:
  - a running head in SC lowercase, with a 44 px Contents button on phones;
  - h1 in the display face at 36, then the rule;
  - a chapter-opening illuminated initial: initial-letter 3, Alegreya SC 700 in accent, in a 1.5 px accent frame on --raise. Only on p.open and read-aloud starts.
- .readaloud: a raised box with a 4 px accent rule, in italic.
- h2 in SC 22 ink on an accent hairline. Rules links inline.

### World map (sheet, pins, party, cards, key list)

- Header: a display-face title (28) plus an SC lowercase scale line, the pace segment, and the hex (line icon L hex, pressed when on), zoom and close icon buttons.
- Pins: a 44 px tap circle with the 30 px parchment disc (--pin-bg, a --pin-ink ring and an Alegreya SC 16 letter) drawn inside it. Pins with a scene add a 3 px candle ring.
  - In the app's SVG this is an invisible circle with a 22 px screen radius per pin (scaled by 1/zoom) plus the visible disc.
  - Pin names are pointer-events none, so they never steal a neighbour's tap.
- Names: Alegreya italic 600 15 with a parchment halo.
- Party: the draggable '&' gets a 44x44 box (34 px glyph with a halo); its title is 'The party · drag to travel' as today.
- world-card (page): key disc, SC title, the 'Hidden from players' .chip (44 px box), the blurb, a DM seal block, the travel line with the hourglass emblem, and a primary 'Open …'.
- world-key: 44 px rows (li[data-key], tappable). Each row has a letter disc, the name, a 'map' .tag and the eye.
- data-key, data-reveal and data-scene stay as they are.
- Data gap (content, not theme): the Sheep Chase pins need key letters.

### Dialogs (themed confirm, behind a flag)

A centred page card (max 420, role alertdialog) over an rgba(10,6,14,.55) backdrop with no blur.
- A 52 px wax seal sits half above the top edge, holding a 26 px crossed-swords emblem.
- An Alegreya SC 24 title, a 16 px ink-2 body, then a quiet Cancel and a primary confirm.
- Same words and outcome as window.confirm('End the encounter? Combatants fold back into the party marker.').
- It ships behind the themed-confirm flag, with the native confirm as the default, until the new APPROVALS row ('Themed confirm dialog') is approved. Then it is reusable for the pitfall 14 confirms.

### Status line (default) and toast queue (behind a flag)

Default, unchanged behaviour: today's single .status element, the same text and the same timing, now a chrome pill.
- At least 44 px, 14/600, with a 4 px ink-2 left edge and pointer-events none.
- It sits in the status lane: the top band directly under the measured top bar at left 56 px (beside the hide tab), top calc(var(--topbar-h) + 24px), max-width min(560px, the space left of the view slider).
- On phones: left 52, top topbar-h + 16, two lines at most. It never sits over the middle of the map.

Behind the toast-queue flag (new APPROVALS row 'Status toast queue'): a .toasts stack in the same lane, with severities (tool lit --c-on icon, info ink-2, ok --c-ok plus a check, warn --c-warn plus an alert).

### Clock (minimap button and popover)

- Minimap: a chrome frame with an inset plan. The canvas colours come from --mm-* tokens through getComputedStyle, with no hex literals in minimap.ts. The 'N' is SC 14 on a --c-bg-a plate.
- Clock button: a 44 px raised chrome pill. It keeps today's line sun/moon icons (in --c-on and --c-ink-2), so the first scene needs no emblem chunk. The time is 16/700 and the day 13 (was 9.5).
- Popover (page):
  - Head: a .moonphase disc, the time in SC 22 ink, and the day plus phase at 13.
  - The rule, an Hour range, and Day and Hours steppers as 44 px buttons.
  - A 'Travel' SC h3, miles, pace and 44 px checkbox labels, then the result plus a primary 'Travel: advance …' with the hourglass emblem.

### Compass, scale, rooms sheet, help, HUD, map labels, credits

- Compass: a 48 px chrome medallion with a lozenge needle (north #c0392b). The 'N' is SC 13 on a --c-raise plate (was 12 on the ring, 4.42:1).
- Scale bar: a 2 px ink bracket with a 13 px label.
- Rooms: a page side sheet with SC h3 per floor. Rows are 44 px: keybox, name, a 13 px ink-2 page reference and the eye. The eye's 'on' state is a primary fill, and the party room gets an amber tint.
- Help: a page sheet with a display-face title. Its prose belongs to the clarity pass.
- HUD: chrome tokens only.
- Key, object, note, door and link labels keep their form, with tokenised colours and sizes 12/11.
- Credits: an About / Credits page panel (.credits) in the Help sheet footer. It shows fonts/CREDITS.txt verbatim (pre-wrap), added in T2.

### Player Display (?display=player), classes and fixture only

T3 ships the classes and a static fixture page. Nothing new renders on the display until its owner lands, and pitfall 23 makes every new overlay default to today's view:
- Location ribbon (swallowtail, display face, clamp 32-48), floor chip (uppercase SC, clamp 20-26; party level only, pitfall 38) and waiting banner (hourglass, clamp 18-24): increment 5.
- Turn order (44x50 shields, digits clamp 20-28, names clamp 18-24, candle glow, no HP): only behind the A2 build flag (pitfalls 9 and 26). The fixture shows it only with ?a2=1, sorted by initiative.
- Caption (page card, Alegreya italic clamp 22-32).
- Measured: every text at least 24 px at 1920x1080 and at least 18 px at 1280x720, with at least 4.5:1 on rendered pixels, in both campaigns, with and without A2.

## Icons

THREE SOURCES, ONE RULE FOR EACH:
- L: today's icons.ts line set (24 grid, 1.5 px stroke, currentColor). Used for every action in toolbars, menus and buttons, and for the clock's sun/moon.
- L+: new line icons drawn the same way and added to icons.ts: d20, chevL, chevR, chevD, plus, minus, check, alert, trash, frame, layers, pin, move, toc. Paths are in proto/index.html const P.
- G: game-icons.net fill emblems (CC BY 3.0). Content only: rules kickers, stat tiles, dice, campaign tabs, the dialog seal, the travel line and the display's waiting banner.
  - Never a toolbar or header button.
  - Never below 20 px. The DOM measure finds 31 emblems on the page and 0 under 20.

THE SHIPPED SET is 18 symbols, nothing reserved:
- bleeding-wound, boot-prints, checked-shield, crossed-swords, dice-twenty-faces-twenty, evil-bat, hearts, hourglass, knockout, magic-swirl, open-book, rolling-dices, rule-book, semi-closed-eye, sheep, skull-crossed-bones, swap-bag, wolf-head
- 16,375 B raw / 6,815 B gzip.
- Shipped as ui/emblems.ts, a dynamic import that injects one inline sprite on first use by a sheet, a tooltip, a stat block, Books or the display. It is its own chunk, never in main, and is precached through cache-pack.
- tokens.py asserts that the sprite holds exactly the referenced symbols.
- Lucide is not bundled.

MAPPING (Ln = line icon, Gn = game-icon emblem):
- Top bar:
  - Library L library; World map L map; Back L rotateL (the clarity pass may change it)
  - DM/Players: text. Floor: select. Whole building L+ layers. Section: range.
  - Tools L reveal; Creatures L paw; Initiative L+ d20 (replaces swords)
  - Go to area L search; Rooms L list; View L grid, hex or gridOff (as today)
- Tools menu: Reveal/hide L reveal, Paint reveal L brush, Paint fog L fog, Measure L ruler, Undo reveal L undo.
- View menu: Snap L grid, Walls L walls, Mist L fog, Labels L label, labelKeys or labelOff, Players follow L lock or unlock, Player display L display, and HP bars on tags L token (new option, default off).
- Camera: rotate L rotateL and rotateR; tilt L top; zoom L zoomIn and zoomOut; find party: the '&' glyph; follow L token; help L help.
- Other chrome:
  - View slider peek L eye. Clock button L sun or moon.
  - Turn bar: previous L+ chevL; find '&'.
- Token panel:
  - HP L+ minus and plus; Reveal or Hide L eye or eyeOff; Remove L+ trash
  - Reach G boot-prints; Initiative G dice-twenty-faces-twenty
  - Stat pills: AC G checked-shield, speed G boot-prints
- Stat block: kicker G wolf-head; AC G checked-shield; HP G hearts; Speed G boot-prints; CR G skull-crossed-bones; Roll G dice-twenty-faces-twenty. Roster: Roll for all G rolling-dices.
- Rules kickers, one distinct emblem per kind:
  - condition G knockout; spell G magic-swirl; monster G wolf-head
  - item (any rarity; the word carries the rarity) G swap-bag
  - rule G rule-book; action G crossed-swords; sense G semi-closed-eye
  - damage G bleeding-wound (CR keeps the skull); page reference G open-book
- Cards: Frame L+ frame; Open door L doorClosed; Move party here '&'; Reveal secret door L eye; locked state L lock.
- Rooms and world key: L eye and eyeOff.
- World map header: the hex toggle is L hex (not the treasure-map emblem). Travel line G hourglass.
- Clock popover Travel button: G hourglass.
- Status: no icon by default (today's text only). In the flagged queue: tool L reveal, placing L+ pin, ok L+ check, warn L+ alert.
- Library tabs: G evil-bat, G sheep. Dialog seal: G crossed-swords.
- Panels: grip CSS rivets; fold L+ chevL and chevR; hide tab L+ chevL. Books on phone: L+ toc.
- Player Display waiting banner: G hourglass.

LABEL RULES:
- Every icon-only button has aria-label and title with the word, plus the shortcut where one exists ('Go to area (/)'). check.mjs taps 181-197 controls per page.
- In menus, cards, toasts and tooltips every icon is paired with its word.
- Emblems carry aria-hidden and always sit beside their word.
- The Player Display never relies on an icon without a word.
- The party mark is the '&' character in Atkinson 700: #c0392b on the map and light surfaces, #e8604f on dark surfaces. Never decorated, never a dragon, never set between letters.
- Initiative's icon change ships in the same commit as the clarity pass's Help rewrite of 'The crossed-swords button opens the roster', so Help never names an icon that is gone.

## Motifs

THE MOTIFS (all pure CSS, zero bytes of images):
1. Rule (.taper):
   - Barovia: a double 1 px hairline (2 px and 6 px from the top of a 9 px band) with a centred 7 px lozenge, like an iron strap. It replaces the left-to-right wedge, which was the classic stat-block divider shape.
   - Sheep Chase: a centred brass lozenge swell, 5 px, full width.
   - Where: under card and stat-block headers, between stat-block bands, under Library chapter heads (60% width), under the Books h1 (40%) and under the clock popover head.
2. Small-capital section heading on a hairline: h3.sec, stat-block h5 (the only accent in a stat block), Books h2, rooms h3, roster th, world-key head.
3. Wax seal (.seal, a 24-scallop clip-path over a radial gradient, wine or pine; ink at least 5.01:1 on its lightest stop):
   - 30 px 'DM' (aria-label 'DM only'). It is the single DM-only marker.
   - 52 px with an emblem heads the flagged confirm dialog.
4. Swallowtail ribbon (.ribbon): the Player Display location only (increment 5). The hide-panels tab uses the ribbon colour.
5. Illuminated initial: initial-letter 3, Alegreya SC 700, accent, framed. Only on Books chapter openings and read-aloud starts. Never blackletter, never gilt.
6. Initiative shields: the turn bar and the Player Display turn order (A2 flag). A shield is also the AC emblem.
7. Metal states: a silver or brass gradient for pressed and selected controls, drawn inside their 44 px boxes. Coin thumbs on sliders and switches; rivets on grips.
8. Candle glow (--glow): only focus, the current turn, the lit 'on' bar and the view-slider fill. Never a fill behind text.
9. Key box (.keybox): area keys in cards, rows and the Library.

HOW MUCH:
- At most one rule and one seal per card.
- One ribbon per screen.
- No frames inside lists.

WHERE NEVER:
- Inside dense rows (menu rows, roster cells, rooms, finder results, key lists, Library rows). Only the keybox, the swatch and a .tag appear there.
- Over the map: CSS2D labels, token tags, pips, doors and links get tokens only, with no rules, seals or ribbons.
- On the Player Display beyond the ribbon, floor chip, shields, waiting banner and caption.
- On buttons other than the metal pressed state.
- Display type below 28 px.

NEVER COPIED:
- No bitmap paper texture (pitfall 3).
- No gold-gradient text, no dragon '&', no PHB green box, no MM orange bars.
- No red wedge divider, no red small-caps creature name.
- No watercolour, no scroll rollers.

## Bundled assets and licences

FONTS. Every file is in proto/fonts/, subset to Latin (U+0020-007E, U+00A0-00FF, plus the typographic extras) with fontTools 4.66.1. All are SIL OFL 1.1, and none declares a Reserved Font Name.
- atkinson-next-400-700.woff2: 19,252 B. First load, preloaded.
- alegreya-sc-700.woff2: 18,736 B. First load, preloaded.
- grenze-gotisch-600.woff2: 16,556 B. On first use (sheet titles, Books h1, the display ribbon); precached.
- fraunces-wonk-soft-700.woff2: 17,940 B (opsz 72, SOFT 100, WONK 1). On first use; precached.
- alegreya-400-700.woff2: 43,900 B. On first use; precached.
- alegreya-italic-400-700.woff2: 44,812 B. On first use; precached.

Totals:
- First load measured: 37,988 B in both campaigns.
- All bundled fonts: 161,196 B.

ICONS:
- proto/icons/emblems.svg: 18 symbols, 16,375 B raw / 6,815 B gzip.
- Paths are rounded to whole units and drawn in currentColor, with no other changes.
- bleeding-wound was fetched from github.com/game-icons/icons/blob/master/lorc/bleeding-wound.svg on 2026-10-04. The others come from the existing gi-sprite-r0.svg source.

LICENCE FILES: OFL-alegreya.txt, OFL-alegreyasc.txt, OFL-atkinsonhyperlegiblenext.txt, OFL-fraunces.txt, OFL-grenzegotisch.txt and game-icons-license.txt, in proto/fonts/ and theme/assets/recommended/.
- On 2026-10-04 each was compared byte for byte with the project's own file:
  - github.com/googlefonts/atkinson-hyperlegible-next OFL.txt
  - github.com/huertatipografica/Alegreya OFL.txt (Alegreya SC is published from the same project; google/fonts ofl/alegreyasc/OFL.txt is identical)
  - github.com/Omnibus-Type/Grenze-Gotisch OFL.txt
  - github.com/undercasetype/Fraunces OFL.txt
  - github.com/game-icons/icons license.txt
- All six are identical.
- The fetched copies are in theme/lic/.

CREDITS.txt is regenerated from the shipped set (proto/fonts/CREDITS.txt, mirrored in theme/assets/recommended/CREDITS.txt; it ships as app/public/fonts/CREDITS.txt). It lists:
- each font with its file names, copyright line, licence file name and upstream URL, and the retrieval date;
- the game-icons licence and source URL;
- the per-author attribution that game-icons asks for, filtered to the 18 shipped symbols:
  - 'Icons made by Delapouite: dice-twenty-faces-twenty, rolling-dices, rule-book, sheep.'
  - 'Icons made by Lorc: bleeding-wound, boot-prints, checked-shield, crossed-swords, evil-bat, hourglass, magic-swirl, open-book, semi-closed-eye, skull-crossed-bones, swap-bag, wolf-head.'
  - 'Icons made by Skoll: hearts, knockout.'
There is no Lucide line and no DarkZaitzev line (nothing of theirs ships), and there is no bare 'OFL.txt' reference. tokens.py asserts that every woff2, every licence file and every symbol id appears in CREDITS.txt. T2 adds the Credits panel that shows it.

STAT-BLOCK CONTENT shown in the prototype (Ghoul, Wolf, condition and spell summaries) is from SRD 5.1 / 5.2.1 under CC BY 4.0, paraphrased. There is no art from the books.

OFFLINE: sw.js is unchanged (same CACHE name, same install list, update policy left to A20). After the first scene is ready, the app posts the existing 'cache-pack' message with the four on-demand woff2 URLs and the emblem chunk URL, taken from Vite's manifest (pitfall 49).

## Build steps

### T0 (rides with clarity iteration 1): tokens, fonts, layout variables, STYLE.md, approvals rows

- docs/STYLE.md: rewrite the UI paragraph. It replaces 'applefy … no RPG chrome, no parchment' and covers:
  - the two surfaces, the type roles (display face only at 28 px and above) and the motif list with where-never;
  - the five rules families with their underline styles;
  - the trade-dress line, including the stat-block reasoning;
  - the party & rule (#c0392b on light surfaces, #e8604f on dark).
- docs/APPROVALS.md: add two pending rows, numbered next free at landing (A32 and A33 today): 'Themed confirm dialog replaces window.confirm' and 'Status line becomes a toast queue with severities'.
- Bundle the 6 woff2 files, the OFL and game-icons licence files and CREDITS.txt in app/public/fonts/.
- Fonts:
  - @font-face rules; preload Atkinson and Alegreya SC only.
  - After __mistlab.ready, on the first idle callback at least 3 s later, post the existing cache-pack message with the four other woff2 URLs from the Vite manifest. sw.js is untouched.
- Put the token block (theme.css sections 2-4) at the top of styles.css and alias --bg-2 (currently undefined).
- Replace the hex literals in the UI scope only: styles.css 77, minimap.ts 13, icons.ts 1 (party fill becomes var(--party)) and main.ts 2 (compass). The minimap reads --mm-* through getComputedStyle.
  - Excluded: encounter.ts 3 (token colour presets, data), worldmap.ts 39 (canvas paint) and every THREE.Color or material.
- Global :focus-visible and scrollbar styling.
- Body font Atkinson at the new sizes, and the top-bar location in Alegreya SC 20.
- ResizeObserver for --topbar-h, --cam-w/h, --mf-w/h, --mm-w/h and --vs-w (beside the existing --turnbar-h). The view slider's top and the status lane read --topbar-h.

Files: `docs/STYLE.md`, `docs/APPROVALS.md`, `app/public/fonts/*.woff2`, `app/public/fonts/OFL-*.txt`, `app/public/fonts/game-icons-license.txt`, `app/public/fonts/CREDITS.txt`, `app/index.html`, `app/src/styles.css`, `app/src/ui/minimap.ts`, `app/src/ui/icons.ts`, `app/src/main.ts`, `app/src/app.ts`

Acceptance:
- tests/theme-tokens.test.ts (a port of tokens.py) passes all 269 checks:
- dE2000 at least 15 between families and from every accent in all four themes, and at least 8 under protan/deutan;
- family contrast on bg, raise and both gradient stops;
- every gradient stop under text (metal, seal, primary, ribbon);
- the on state, and the party mark at least 3:1 on every surface;
- the shieldPaint cube sweep at least 4.5;
- credits coverage.
- e2e/theme-layout.spec.ts: rectangle overlap of every pair of visible chrome panels (top-bar groups, status, view slider, minimap, camera, map frame, turn bar, hide tab), and panels clipped by the viewport.
- Run at 390x844, 844x390, 1024x768 and 1366x768, in both campaigns and both schemes, on inventory states 01, 13, 17 and 25.
- 0 failures; the 1024x768 run is required in T0 because the body face changes widths.
- --topbar-h equals the top bar's height in both campaigns.
- Font bytes: fresh context, scene only, page and service-worker woff2 bytes from navigation to 'load' plus 2 s idle at most 40,000 B in both campaigns (prototype 37,988). A dist test asserts all bundled woff2 total at most 162,000 B.
- Offline e2e: fresh context, load online, wait for the cache-pack fetches, go offline, reload. Open the world map (display face, Alegreya italic names) and the Wolf stat block (Alegreya, italic). document.fonts reports those families 'loaded', with no failed requests. Books joins this test when it lands.
- Words unchanged: a Playwright text-node dump of #ui (both campaigns, 25 inventory states) is identical before and after, except for whitespace.
- Hex grep for #[0-9a-f]{3,8} outside the token block, in styles.css, minimap.ts, icons.ts and the main.ts compass, returns 0. worldmap.ts, encounter.ts presets and three.js colours are not scanned.
- All existing e2e specs pass. Screenshots of inventory states 01, 13, 17 and 25 for both campaigns go to scratchpad.

### T1 (rides with clarity iteration 2, after the movable-panels pass): chrome components

Apply the chrome recipe to:
- .topbar groups, .camcluster, .vslider (44 px coin box), .minimap, .mapframe, .finder, .menu-panel, .status (the same single element, restyled into the status lane) and .pn-* (44 px hide-tab box);
- 44 px button.icon and summary.icon, and the metal pressed state;
- segmented controls with 44 px boxes;
- ranges and coins, the view-slider groove with labels outside the thumb, menu rows with the lit bar;
- .btn, .btn.primary, .btn.quiet and .btn.danger (--danger);
- one 44 px field style, select, check, switch;
- .chip (interactive, 44 px box) and .tag (label), and round swatches.
Icons: add the L+ icons. The d20 replaces swords for Initiative in the same commit as the clarity pass's Help rewrite of 'The crossed-swords button opens the roster'. Drop the 6 copy-pasted glass recipes and backdrop-filter.

Files: `app/src/styles.css`, `app/src/main.ts`, `app/src/ui/icons.ts`, `app/src/ui/viewSlider.ts`, `app/src/ui/panels.ts (class hooks only)`

Acceptance:
- e2e/theme-taps.spec.ts on the phone and phone-landscape projects (pitfall 39) and on desktop:
- every visible interactive element in #ui and every open sheet (button, a, input, select, summary, [role=slider\|tab\|radio], label.check, li[tabindex]; not inline .rl, not .lbl) is scrolled into view;
- elementFromPoint at its centre and at ±21 px horizontally and vertically returns it or a descendant;
- its box is at least 43.5 px each way.
The panels-pass grip and fold are listed, not failed. Menus open inside the viewport at 390 px.
- Every icon-only button has a non-empty aria-label and title (DOM query, both campaigns).
- Pressed, toggled and selected states differ from rest by a non-colour cue: a sampled pixel diff on the inset shadow or lit bar, plus a computed font-weight of at least 700 in menus. In the Sheep Chase the lit bar is #9a5a12, not ink.
- Rendered-pixel contrast (the check.mjs method: hide text, screenshot, sample the glyph band, skip covered nodes) over every #ui text node, in four themes: each at least 4.5:1, or 3:1 when large.
- The theme-layout overlap spec from T0 still passes, plus: no .lbl intersects the status in the inventory states. A9's reserved band, once approved, makes this hold everywhere.
- Words unchanged, except the Help sentence the clarity pass rewrites with the d20. Computed font-size of every #ui text node is at least the T0 baseline at the same node path.
- The existing e2e passes, including .topbar, [data-act], [data-cam], [data-view], [data-tool], [data-grid], .vslider and .status.

### T2 (rides with clarity iteration 3): page components, sheets, dialogs, credits

- The page recipe for .sheet, .infocard, .tapmenu, .tip, .rooms, .clockpop, .world-card, .world-tip and .world-key.
- The .dmnote with the wax seal replaces the DM-only tags.
- .taper (double hairline and lozenge, or brass lozenge) and .keybox. h2 in Alegreya SC ink, capitalised.
- Library: tabs in Alegreya SC, stacking with auto-fit; 44 px rows with .tag; chapter heads plus rule.
- World map:
  - 44 px invisible SVG tap circles around 30 px pin discs, with pointer-events none on names;
  - a 44 px party box;
  - the L hex toggle and the display-face header.
- The roster sheet: padded hint, SC headers, 44 px fields in .rosterwrap.
- The clock popover restyle, with .moonphase and the line sun/moon kept.
- The Credits panel in the Help sheet footer, showing fonts/CREDITS.txt.
- Behind flags, off by default:
  - the themed confirm (ui/dialog.ts) for End encounter;
  - the toast queue (ui/toast.ts).
  - Both stay off until their APPROVALS rows are approved; window.confirm and the single status line remain the defaults.

Files: `app/src/styles.css`, `app/src/main.ts`, `app/src/ui/library.ts`, `app/src/ui/worldmap.ts`, `app/src/ui/encounter.ts`, `app/src/ui/dialog.ts (new, flagged)`, `app/src/ui/toast.ts (new, flagged)`

Acceptance:
- These selectors and texts still resolve: .wm-pin[data-key], .world-tip, .world-card [data-scene], .world-key li[data-key] [data-reveal], .wm-party, .crow [data-a=here], .csearch, .tip b and .sheet.world h2; and 'Hidden from players', 'Country', 'Tser Pool Encampment', 'T2', 'No way through', 'Dire wolf' and /Fighter/.
- Words: the text dump differs only by removed words ('DM ONLY' becomes the seal's 'DM' plus its aria-label). The diff is listed in the PR.
- The tap sweep from T1 extended to every sheet: Library rows and tabs, rooms, the finder, world pins, the world-key rows, the party, the world-card chip, the roster cells and checks, and the clock steppers. 0 failures.
- Library: no .keybox overflows its row in either campaign (scrollWidth at most clientWidth for '03-compound'). Tabs never exceed 64 px tall at a 390 px sheet width.
- Overflow: in a 390 px isMobile context innerWidth stays 390 with every sheet open, and in a non-mobile 390 context document scrollWidth is at most 390.
- Flag defaults: with flags off, End calls window.confirm, and a status update produces exactly one .status with today's text. With the confirm flag on, the dialog e2e checks that End shows .dialog, Cancel keeps the encounter, and End encounter ends it; Esc cancels, Enter confirms, and focus is trapped.
- Credits: a test asserts that every file in app/public/fonts and every symbol id in the emblem chunk appears in CREDITS.txt, and that the Help sheet shows it.
- Rendered-pixel contrast on every sheet in four themes: at least 4.5:1, or 3:1 when large.

### T3 (rides with clarity iteration 4): initiative, token tags, minimap and compass, Player Display classes

- Turn bar:
  - shields via shieldPaint() in encounter.ts;
  - docked between the minimap and the view slider from the measured variables, with a scrolling order row;
  - the phone layout with a name for the current combatant and 13 px abbreviations for the rest (.nm visually hidden, .ab);
  - --turnbar-h kept.
- Token tags in one .tagbox. The HP bar ships behind a new View-menu option, 'HP bars on tags', which defaults to off. Pips are classes only, with the code table; they render when increment 9 lands.
- The compass medallion with the N plate, and map labels tokenised (12/11).
- Player Display: the .pd-* classes and a static fixture page (tests/fixtures/display.html) only. Ribbon, floor chip and waiting banner render when increment 5 lands. The turn order renders only behind the A2 build flag.

Files: `app/src/ui/encounter.ts`, `app/src/render/world.ts`, `app/src/app.ts`, `app/src/main.ts`, `app/src/styles.css`, `tests/fixtures/display.html (new)`

Acceptance:
- tests/theme-shield.test.ts: shieldPaint over 17 levels per channel (4,913 colours) gives a digit at least 4.5:1 on both stops.
- tests/theme-pips.test.ts: the condition code table is complete for the 15 conditions, unique and two letters.
On the fixture with the HP option on and pips, at 390x844 and 844x390:
- pip boxes are at least 10x10;
- at most 3 pips plus '+n';
- no pip or tag box intersects another tag's text box (pitfall 19).
- Default view unchanged (pitfall 23): with default settings, inventory screenshots show no HP bar and no pip, and the View menu shows the new option off.
- Player-safety grep: no HP numbers, .hp elements or pip elements in the players' DOM or payload (pitfall 26). The display fixture's turn order exists only with the A2 flag.
- Display fixture at 1920x1080 and 1280x720, with and without A2, script and style excluded: every visible text node at least 18 px at 1280x720 (fixture measures 24 / 18) and at least 4.5:1 on rendered pixels, including shield digits (pitfall 20).
- Night plus mist pixel test (pitfall 21): tag, ring and pip pixels differ from their surround by the existing threshold at 23:00 with mist on, in both campaigns.
- The T0 overlap spec with an encounter running at all four sizes: the turn bar intersects no other panel and no status.

### T4 (rides with the rules tooltip pass, the Bestiary stat-block tooltip and the Books reader)

- Ship .rt and .rl with the kinds condition, spell, magic, monster, rule, action, sense, damage, item, pageref and the rarities. They map to the five families with underline styles.
- ui/emblems.ts: the 18-symbol sprite as a dynamic-import chunk that injects one inline sprite on first use, precached through cache-pack.
- The .statblock in ink with the accent hairline only.
- The token panel with stat pills, the HP row and .btn.danger.
- Books typography: Alegreya, the running head with the phone Contents button, the display h1, the illuminated initial and .readaloud.
The rules tooltip, bestiary and Books passes consume these classes; the theme supplies none of their content.

Files: `app/src/ui/emblems.ts (new, lazy chunk)`, `app/src/styles.css`, `app/src/ui/rules-tooltip.ts (pass-owned)`, `app/src/ui/bestiary.ts`, `app/src/ui/books.ts (pass-owned)`, `app/src/main.ts (tokpanel)`

Acceptance:
- One DOM test per kind: a stripe, a 20 px emblem and a kicker word. Inline .rl computed text-decoration-style is dotted, dashed, double or wavy per family, and solid for pageref.
- The emblem chunk is not in the main chunk (Vite manifest), is at most 16,500 B raw / 7,000 B gzip, and holds exactly the referenced symbols. No svg.e renders below 20 px (DOM measure).
- Stat block on the Ghoul and Wolf SRD entries:
- the name and property labels compute to the page ink colour;
- the only accent-coloured border is the h5 hairline;
- the 6 ability cells use lining tabular numerals;
- no horizontal overflow at 390 px.
- Offline (pitfall 49 e2e): fresh context, load once without opening a stat block, go offline, reload, open the Wolf block. Emblems and Alegreya render from cache.
- Books: initial-letter applies only to p.open and read-aloud starts. Contents links are 44 px. The phone Contents button passes the tap sweep.
- The rendered-pixel contrast sweep over rules cards, stat blocks and Books in four themes: 0 failures.

## What does not change

- Behaviour of every button, gesture and key (pitfall 15).
- The two swaps that would change behaviour, the themed confirm and the toast queue, ship behind flags that default to today's window.confirm and single status line. Each gets a new pending APPROVALS row.
- The service worker is untouched: the same CACHE name and install list; fonts and the emblem chunk ride the existing cache-pack message; the update policy is left to A20.
- No feature is added by the theme without its gate:
- HP bars on tags are a View option that defaults to off.
- Condition pips are classes only until increment 9.
- The Player Display ribbon, floor chip and waiting banner are classes until increment 5.
- The display turn order is behind the A2 flag (pitfalls 9, 23, 26).
- Every class, data attribute and asserted text in the inventory constraints:
- Classes and selectors: .wm-pin[data-key], .world-tip, .world-card [data-scene], .world-key li[data-key] [data-reveal], .wm-party, .wm-pin.t-camp, .section input, .labels .lbl, .crow [data-a=here], .csearch, .vslider, .turnbar .cb.now, .topbar, .tokpanel header b, .tokpanel [data-a=remove], .tip b, .status (still one element), .sheet.world h2, canvas.gl and [data-act/cam/view/tool/grid].
- Texts: 'Hidden from players', 'Country', 'Tser Pool Encampment', 'T2', 'No way through', 'Dire wolf' and /Fighter/.
- The movable-panels pass's class names and legacy token names (--panel, --hair, --ink, --ink-2, --accent), which now resolve per surface.
- Word count: no element gains words.
- 'DM ONLY' becomes the seal 'DM'; 'tap to pin' is a pin icon.
- Phone turn-bar abbreviations replace hidden names; they are not additions.
- The one Help sentence about crossed swords is rewritten by the clarity pass together with the d20 icon.
- Text size and contrast: nothing is smaller or fainter than today.
- Sans text is at least 13 px, except map labels (12/11 against today's 11/9.5) and pips (11).
- Every text node is at least 4.5:1 on rendered pixels (lowest measured 4.57). The party mark is at least 3:1 on every surface and 4.55 on its halo.
- The top-bar grid areas, the panel anchoring model and the layout ownership (the movable-panels pass). The theme supplies measured variables and the wrap budget, docks the turn bar and the status into free lanes, and reports the grip/fold shortfall. It does not take over drag, fold or saved layout.
- The 3D world: its palette, lighting, materials and the world-map canvas paint. Also the CSS2D label behaviour (zoom gating, declutter, players'-view hiding); only label colours and sizes become tokens. A9's reserved band, pending, stays with A9.
- The party marker is still a plain red & (#c0392b on the map and light surfaces). On dark surfaces it uses #e8604f for contrast. Only the font becomes our bundled Atkinson.
- Help prose, tooltip copy, rules and stat content and Books content belong to the clarity, rules-tooltip, bestiary and Books passes. The theme supplies classes only.
- Persistence, state, channel payloads and the players' projection: no data changes. HP stays DM-only.
- No CDN or runtime dependency. No bitmap textures. backdrop-filter is removed rather than added. Lucide is not bundled.
- The repo: this design task wrote nothing in /home/user/VTT (git status clean). All work is under scratchpad/theme (proto/, proto-r4/, tools/, lic/, spec.json).

## Review notes

A critic checked the first draft against the prototype (contrast in both themes, legibility on a TV and a phone, touch targets, licences, weight, trade dress). This is the revision that fixes its findings:

Not ready to build as specified. The system is right: two surfaces, one token set, per-campaign display faces and the class API for .rt/.rl, .statblock and the panels. But I re-measured the prototype at (prototype, local) (served on :4193, then stopped; repo untouched), and it fails several of the spec's own claims:
- Text on composited backgrounds fails contrast: initiative shield digits measure 1.6 to 2.9:1, the party & on dark chrome 2.7:1, and Barovia's silver pressed state 4.07:1. The window.__audit only checks flat token pairs, so it never sees these.
- The bigger chrome collides with itself on the iPad, the primary device: the top bar wraps over the view-slider thumb, and the turn bar covers the minimap and camera cluster. On phone the toast covers the floor picker. The Sheep Chase wraps even at 1366, so "layout identical in both campaigns" is false.
- The phone gallery lays out at 511 px inside a 390 px viewport, so mobile Chromium zooms everything out to 76%. The overflow check missed it.
- The 44 px claim fails outside the live scene: chips, roster fields and checkboxes, the Books contents links, the finder field, the Roll button and the hide-panels tab, all checked by tapping-point tests.
- The rules colours are not a usable colour code. Several pairs are near-identical, and two match a campaign accent exactly.
- The stat block sits close to the official 5e stat-block look.
- Some steps add features or change behaviour without the required approvals or option flags: HP bars, condition pips, the display's turn order, the toast queue, the themed confirm and the service-worker change.
Fix the issues below and re-run them as automated checks. Then T0 can start.
