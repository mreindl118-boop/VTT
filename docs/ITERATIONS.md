# mistLAB missing-features check and five-iteration plan

This plan supersedes the version numbers of increments 0.3.0 to 0.7.0 in `docs/UPGRADES.md`; the increments it does not cover keep their scope and take the next numbers when they are built. Version 0.2.0 (backups and the private broadcast) ships first.

Round one of the "5 iteration VTT missing features check and implementation". Checked on 2026-10-04 against the current build of branch `claude/mistlab-curse-strahd-x6jm13`.

## Summary

- **Catalogue rows checked: 111** (68 marked missing and 43 marked partial in `docs/UPGRADES.md`).
  - **64 still missing.** Five of these are being built elsewhere (0.2.0, A29 panels, the Books reader).
  - **44 partial.** This includes 3 rows that were catalogued as missing.
  - **3 now present.** All three were mis-catalogued: authored lights already work as secondary lights, the wall roles already exist, and hidden creatures are already marked for the DM.
  - **5 new rows** come from the 2025-2026 web check.
- **The 15 known bugs: all 15 still happen.**
  - Bug 2 is worse than recorded. Only 2 of the 13 Vallaki sites can now be entered by tapping, because N9 lost its Enter.
  - Bug 3 also affects the phone in landscape.
  - Bug 4 shows on the Player Display only inside the state message, because the display has no turn bar.
  - Bug 5 is narrower than recorded. In Players mode `n` already does nothing and `/` opens a finder nobody can see.
- **Five iterations.** All are additive and none uses an approval item.
  1. **0.3.0 Reach and undo on night one.** Enter from object cards, hidden things listed per room, a session action history with Undo and Redo, a key guard, three small settings fixes, and a better fit on phones.
  2. **0.4.0 The table screen under the DM's hand.** A live status for the Player Display, Curtain and Freeze, Send view and Frame for players, read-aloud captions and show cards, pointer pings, and display rotation and margins.
  3. **0.5.0 Combat bookkeeping at the table.** Conditions with SRD rules text, durations, lair and legendary actions, HP math and size override, a DM combat line, a DM roller and log, and Large controls.
  4. **0.6.0 The keyed area.** An area panel, DM notes and a session pad, loot ticks, entry prompts, and an honest fidelity report.
  5. **0.7.0 Templates, auras and better measuring.** Area-of-effect templates, auras, a path measure tool, hex parity with a colour-blind palette, a fly flag, and a distances list.
- **Blocked behind approvals.**
  - Night-one fixes: A1 to A9, covering bugs 1, 4, 5, 6, 7 (pick order), 9, 10, 11, 13 and 15.
  - Features waiting on an approval: A11, A12, A14, A16, A17, A18, A19, A20, A22, A25, A26 and A27.
  - Players'-side combat work gated on A2: roll all foes, the players' turn ring and banner, and Start encounter here.
  - A15 needs no decision: it asks for behaviour the app already has.

## How the check was done

- **Build.**
  - `dist/` was built at 14:06 on Oct 3 from commit 6a8324d.
  - Since then only docs and `playwright.config.ts` have changed, so app, locations and manifests in `dist/` are identical to HEAD 3d8c751. No rebuild was needed.
  - Served with `vite preview` on port 4803.
- **Runtime checks.**
  - Chromium (SwiftShader) driven by Playwright through `window.__mistlab`.
  - Script: `missing-check.tmp.mjs`, a copy kept in this folder.
  - Results: `result-*.json`. Screenshots: `shots/`.
  - Sections:
    - DOM inventory of every DM surface
    - keys
    - Player Display and broadcast
    - the 15 bugs
    - a Vallaki Enter sweep (13 sites × 2 camera presets × 3 tap points)
    - world map
    - seven viewports: 390x844, 844x390, 768x1024, 810x1080, 1180x820, 1024x768 and 1440x900
    - a load and draw-call sweep of all 39 Curse of Strahd locations
    - WebGL context loss
    - authored lights
    - creature numbering
- **Static checks.**
  - String probes of the built bundle `index-bLSXEj8P.js` (1.2 MB) and the CSS. Examples: `storage.persist` 0 hits, `aura` 0, `emplate` 0, `arokka` 0, `TEXTAREA` 0.
  - Code reading of `app/src` and counts over all 45 `scene.json` files and the manifests.
- **Test suites today.**
  - Unit: 15 tracked files, 155 passed, 2 todo.
  - End-to-end: 74 passed in 5.3 minutes against this build.
- **In-progress work.** Read only, never touched:

| Work in progress | Where | Catalogue rows it covers |
|---|---|---|
| 0.2.0 backups, persistent storage, players' state projection, Help non-goals | commit a732b0f on `worktree-wf_e3f86663-d95-1` (`core/playersView.ts`, `state/backup.ts`, `state/persist.ts`, `ui/backups.ts`) | #10, #58, #59. Every later payload builds on `core/playersView.ts`. |
| A29 movable and collapsible panels | d60e45e and eead144 on `worktree-wf_cb633e01-5a1-1`, plus fix round 2 not yet committed (`ui/panels.ts`) | #34. Most of #106 and bug 3: the compass frame no longer eats taps, menus stay on screen, layout is saved per device. |
| SRD 5.1 / 5.2.1 rules books, Books reader, typed lookup | not yet committed in `worktree-wf_646bc177-602-2` (`app/src/books/lookup.ts`, `ui/books.ts`, `public/books/`) | #23. Rules text for #15 and #86. A Rules edition preference (2024 by default). Save for offline. |
| Bestiary of SRD monster models with a DM stat-block tooltip | in progress elsewhere | The stat-block half of #86; sizes (pitfall 27) |
| Four clarity iterations with a shared tooltip component and colour-coded rules tooltips | in progress elsewhere | The tooltip used by #15 and #3 |
| D&D-inspired UI theme | in progress elsewhere | none |
| Map passes: natural land, nested world (64506d2), smoothing, wilderness rebuilds (4fe418a, 06e685e, f761546, 8e6cbca, a587138, 64526a7), stylization, surroundings, landform (`wf_082d66f9`), Vallaki interiors (16f40ae) | various worktrees | #94 (A28). They change every scene's draw cost, which is why the perf baseline (#104) waits for them. |

## The 15 known bugs today

All 15 still happen.

| # | Bug | Today | Evidence | Where it goes |
|---|---|---|---|---|
| 1 | Multi-floor stairs skip a floor | still happens | From Death House Floor 1, `takeLink('lk-spiral-1-2')` (the '↑ Floor 2' marker) and stepping on (22.5, 27.5) both land on `f3` with status 'Took the stairs → Floor 3' | approval A5 |
| 2 | Keyed town buildings cannot be entered by tap | still happens, and worse | Vallaki sweep (tabletop and overhead, centre plus two offsets): Enter offered on 5 of 78 taps and only for N1 (1 of 6) and N8 (4 of 6). N2, N3, N4, N5, N6, N7, N9 and N8a-d always open the building's object card without Enter. N9 (the big tent) was reachable in round zero. | 0.3.0 feature 1 |
| 3 | Phone portrait unusable | still happens; also in landscape | **At 390x844:** Zoom in and Zoom out are covered by the compass frame; Find party, Follow and Help are covered by `.scalebar`. The Tools panel spans x = −150..70 and the View panel x = −71..184. On N2 the Section bar (240..506, 215..243) overlaps the view slider track (329..373, 226..546). The initiative roster is a 678-px table in a 366-px sheet. HP buttons are 30×30. **At 844x390:** every button is reachable, but the view slider overlaps the top bar groups and the compass frame. Root cause: the CSS rule `#ui > * { pointer-events: auto }` is still in place. | A29 fix round 2 (frame, menus) plus 0.3.0 feature 6 (roster, touch targets, phone projects) |
| 4 | Hidden creature named in the players' turn bar | still happens | A hidden Wolf in initiative. The Players-mode turn bar reads 'Rogue 21 · Wolf 19 · Fighter 10'. The Player Display has no turn bar (0 UI elements), but its 'state' message carries the hidden wolf (name 'Wolf', hp 11/11), the roster (5 sheets) and the encounter. | approval A2 (projection in 0.2.0) |
| 5 | Players mode exposes DM navigation | still happens | **Visible in Players view:** Floor, Section, Library, World, the DM tab and the camera cluster. Switching the Floor select to Dungeon works; Library opens. **Not affected:** `n` does not advance the turn; `/` opens a finder kept `display:none`. `[` moves the hidden slider value to 0.9, with no visible effect at T = 0. One tap on the DM tab leaves Players mode. | approval A1 |
| 6 | Unexplored dungeon plan visible on the players' side | still happens | Fresh campaign, Death House dungeon, overhead, t = 0, no dungeon reveals. Walls account for 2.53% and floors for 13.05% of the canvas pixels. Screenshot `bug6_dungeon_players_view.png` shows the whole maze as dark massing. | approval A3 |
| 7 | Library secret door unreachable from the map | still happens | 6 of 6 Reveal-tool taps at `f2-sdo-lib` (tabletop and overhead, at 0, 3 and 6 ft) revealed nothing. Hover tips read 'Wall', 'Wall · 9 Secret Room' or '4B · Pantry'. The DM label 'Secret door behind the bookshelf (DC 13)' has `pointer-events: none`. | the list half in 0.3.0 feature 2; the pick-order half is approval A7 |
| 8 | Hex during an encounter leaves the square overlay | still happens | `range-overlay` is present on the square grid and still present after `setGrid('hex')` | 0.3.0 feature 5; hex ranges in 0.7.0 |
| 9 | Castle Ravenloft party spawns in the catacombs | still happens | Fresh campaign, `ch04/K`: party on 'dungeon' (Dungeon and catacombs, −80 ft); view on 'ground' (`scene.entry`); the dropdown shows 'Courtyard and main floor' | approval A6 |
| 10 | World-map names collide | still happens | At 1366x768: 5 overlapping pairs (Village of Barovia / Tser Pool Encampment, Gates of Ravenloft / Castle Ravenloft, three Mount Baratok pairs). The party marker covers 'Village of Barovia' and 'Castle Ravenloft'. | approval A9 |
| 11 | Overhead preset not north-up | still happens | Death House Floor 1 overhead: `cameraFrame().north` = −90°, compass CSS `rotate(-90deg)`; level north is −x | approval A8 |
| 12 | Walls low/full does nothing on stacked sites | still happens | On N2, toggling Walls changes `aria-pressed` from false to true, changes 0 pixels, and sets no `aria-disabled` | 0.3.0 feature 5 |
| 13 | Labels under the top bar; token tags over room keys | still happens | Death House Floor 2 with Labels = all at 1024x768: 'Secret door behind the bookshelf (DC 13)' sits under the top bar. With 6 creatures on 6 key spots: 2 tag/key overlaps and 0 tags decluttered. | approval A9 |
| 14 | Diagonal rule has no control | still happens | A 3-cell diagonal measures 15 ft, or 20 ft only via localStorage `mistlab.diagonal`. The View menu has 8 rows and none for diagonals. | 0.3.0 feature 5 |
| 15 | Players' world map paints unrevealed places | still happens | In Players view only pin E is visible, but `paint()` draws a symbol for every pin. Screenshot `bug15_world_players.png` shows castle, settlement and camp symbols for Krezk, Ravenloft, the camps and the towers. | approval A4 |

## Catalogue check: the 68 rows marked missing

Statuses: **still missing**, **partial** (part exists today), **now present**, and **in progress** (being built elsewhere, not in this build).

| # | Feature | Today | Evidence | Plan |
|---|---|---|---|---|
| 1 | Primary versus secondary lights | **now present** (mis-catalogued) | Authored scene lights already light the players' view, and only where the party has line of sight. `recompute()` passes `l.lights`; `canSee()` needs the viewer's line of sight. In Castle Ravenloft's dungeon (darkness), a lightless viewer beside an authored light sees 1,024 cells with the lights and 0 without. A campfire behind a closed door stays dark. | The 'secondary' half of A14 is already true; the lit/doused half stays A14 |
| 2 | Outdoor vision limit in the mists | still missing | `ambientNow()` returns the sky's ambient; coverage has no distance cap in daylight | approval A25 |
| 3 | Lighting diagnostics (why players cannot see this) | still missing | DM hover on a dim room says only 'Not revealed · p.213', with no reason | later |
| 4 | Animated doors and door sounds | still missing (skipped) | The door marker flips its icon | not built |
| 5 | Soft-edged fog | still missing | 1-ft coverage texture with linear filtering only | approval A26 |
| 6 | Reveal brush kept inside the room | still missing | The brush paints a 3-ft radius anywhere (`app.ts` `cov.brush(p, 3)`) | later |
| 7 | Reveal whole floor and re-fog floor | still missing | Tools menu: Reveal/hide, Paint reveal, Paint fog, Measure, Undo reveal | later |
| 8 | Hover preview of a room reveal | still missing | No outline while the Reveal tool hovers | later |
| 9 | Lock reveals | still missing | An engine flag `app.autoReveal` exists (`app.ts` L82) but has no control | later |
| 10 | Players' window receives only the players' view | still missing, **in progress** (0.2.0) | A BroadcastChannel listener sees 'state' with the roster, the encounter and the hidden wolf (name and hp) | 0.2.0 |
| 11 | Automatic bloodied and down for players | still missing | Tokens look the same at any HP | approval A11 (0.5.0 adds marks on the DM side only) |
| 12 | Auras attached to a token | still missing | 'aura' is absent from the bundle; Token has no aura field | 0.7.0 |
| 13 | Fly flag | still missing | `moveBlockers()` does not consider the token | 0.7.0 |
| 14 | Cross-level openings | still missing | Levels render per stack | approval (waits on A27) |
| 15 | Condition picker with badges | still missing | 'conditions' is absent from the bundle. Token panel buttons: −, +, Reveal to players, Reach, Initiative, Remove. | 0.5.0 |
| 16 | Coloured-ring condition mode | still missing | none | 0.5.0 (option) |
| 17 | Durations with expiry | still missing | `nextTurn()` only advances the turn and round | 0.5.0 |
| 18 | Skip downed, hide defeated | still missing | `nextTurn()` includes 0 HP creatures | later (A30 would make it the default) |
| 19 | Turn marker ring | still missing | The current combatant gets only the range overlay | later (the players' side needs A2) |
| 20 | 'Your turn' banner | still missing | none | later (A2) |
| 21 | Combat survives a location change | still missing | `encounter` is filtered by location (`app.ts` L332) | approval A16 |
| 22 | Clickable dice and DC text in notes | still missing | No dice parser and no notes | 0.5.0 (stat blocks) and 0.6.0 (notes) |
| 23 | Rules quick-reference sheet | still missing, **in progress** (Books reader) | No rules text in the bundle ('SRD' 0 hits) | covered by the books work |
| 24 | Roll log with timestamps | still missing | The only roll is the hidden initiative d20 (`ui/encounter.ts` L6) | 0.5.0 |
| 25 | Area-of-effect templates | still missing | 'emplate' 0 hits in the bundle | 0.7.0 |
| 26 | Distances to every visible creature | still missing | The token panel has none | 0.7.0 |
| 27 | Pings with modes and an edge arrow | still missing | No Pointer tool; the Tools menu has 5 items | 0.4.0 |
| 28 | Large controls | still missing | HP −/+ are 30×30 px and initiative inputs 30 px tall at every size from 390x844 to 1440x900 | 0.5.0 |
| 29 | Freehand drawing | still missing (skipped) | none | not built |
| 30 | Props and stickers | still missing (skipped) | none | not built |
| 31 | Improvised battle map | still missing | The Library has no Improvise section; the wilderness card has no 'Fight here' | later |
| 32 | DM's own notes and a session pad | still missing | CampaignState has no notes; 'notes' hits in the bundle are manifest strings | 0.6.0 |
| 33 | Honest labels for partial and unmapped content | **partial** (new) | The pin card already reads 'No battle map here yet; run it theatre-of-the-mind or pick a nearby place.' (checked on the M2 pin), and so does a wilderness drop. The Library shows 'open' on every built row, including Castle Ravenloft, whose scene is flagged partial. | 0.6.0 (the badge) |
| 34 | Movable, collapsible panels | still missing, **in progress** (A29) | Fixed positions in this build | A29 |
| 35 | Show a creature, object or caption to the table | still missing | Object card buttons: Close, Open. No Show action anywhere. | 0.4.0 |
| 36 | Call for a roll | still missing | none | later |
| 37 | Handout library | still missing | IndexedDB 'mistlab' v1 holds only the store 'kv' | later |
| 38 | Link field on NPCs and handouts | still missing | none | later |
| 39 | Ambient audio | still missing (skipped) | none | not built |
| 40 | Curtain, blank and freeze | still missing | The only 'curtain' hits are prop names (flame-curtain, curtain-wall) | 0.4.0 |
| 41 | Viewbox and display-connected indicator | still missing | 0 messages in 5 s of DM idleness; no banner 7 s after the DM window closed; no chip | 0.4.0 |
| 42 | Display rotation, margins, turn-bar position | still missing | The display has 0 UI elements and no options | 0.4.0 (rotation, margins); later (turn bar) |
| 43 | Floor chip and date chip on the display | still missing | none | later |
| 44 | Physical-scale table mode | still missing (skipped) | none | not built |
| 45 | Player Display over the LAN | still missing (deferred) | `state/channel.ts` uses BroadcastChannel only | blocked on the projection, A2 and hidden-token stripping |
| 46 | Weather particles | still missing (skipped) | none | not built |
| 47 | Clock advances 6 s per round | still missing | `nextTurn()` never touches the clock | approval A17 |
| 48 | Random encounters by terrain and time | still missing | `encounters.json`: 3 tables with `rows: []`, 18 terrain spawn sets, 22 events. The app never imports it. | later |
| 49 | Strahd's spies | still missing | none | later |
| 50 | Tarokka reading record | still missing | 'arokka' 0 hits in the bundle | later |
| 51 | Session journal | still missing | none | later |
| 52 | 'Previously on' recap | still missing | none | later |
| 53 | Tonight's plan, recents, preload | still missing | none | later |
| 54 | NPC tracker | still missing | `characters.json`: 174 entries tagged by location (Strahd `["K"]`), with no status fields | later |
| 55 | Stage keyed NPCs, start the encounter here | still missing | NPCs are tagged by location, not by area key, so staging by key needs data first | later (start needs A2) |
| 56 | Encounter scaling by party size | still missing | none | later |
| 57 | Numbered duplicate creatures | **partial** (new) | DM names are already numbered ('Wolf', 'Wolf 2', 'Wolf 3', `app.ts` L832); player aliases are not ('Wolf' ×3) | later (alias numbering) |
| 58 | Export, persistent storage, snapshots, backup nudge | still missing, **in progress** (0.2.0) | No Campaign section in the Library. `navigator.storage.persisted()` returns false. 'storage.persist' and 'navigator.share' are absent from the bundle. | 0.2.0 |
| 59 | Non-goals in Help | still missing, **in progress** (0.2.0) | Help has 9 sections, no non-goals and no version line | 0.2.0 |
| 60 | Save picture and print a floor plan | still missing | 'toBlob' and 'window.print' are absent from the bundle | later |
| 61 | WebGL context-loss recovery | **partial** (new) | three.js r180 restores by itself: after `loseContext()` and `restoreContext()` both events fired, the next frame differs by 0.00% and state changes still render. There is no app fallback if the context never comes back (an iPad GPU process killed) and no test. | later (with the perf work) |
| 62 | Never swap the app version mid-session | still missing | `sw.js` calls `skipWaiting()` and `clients.claim()` | approval A20 |
| 63 | Marching order | still missing (skipped) | none | not built |
| 64 | Split the party | still missing (deferred) | One party token outside initiative | later |
| 65 | DM's own PDF at the page | still missing (deferred) | none | later |
| 66 | Cover and line-of-sight check | still missing (skipped) | none | not built |
| 67 | Prefabs and saved encounters | still missing (skipped) | none | not built |
| 68 | Spoiler-stripped player companion | still missing (skipped) | none | not built |

## Catalogue check: the 43 rows marked partial

| # | Feature | Today | Evidence | Plan |
|---|---|---|---|---|
| 69 | Darkvision greyscale on the players' side | partial | `perceive()` returns `grayscale` (`core/light.ts` L88-96); no shader reads it | approval A12 |
| 70 | Placed and carried lights, toggleable | partial (the catalogue's description was wrong) | Authored lights already feed the players' view (Ravenloft dungeon: 1,024 cells against 0). Token.light and LIGHT_PRESETS exist. Lights cannot be lit or doused, and the DM cannot drop one. | approval A14 (lit and doused) |
| 71 | Scene darkness by the clock, with an override | partial | Outdoor levels follow the hour (`ambientNow`); the View menu has no override | later |
| 72 | Wall roles: window, terrain, invisible, ethereal | **now present** (mis-catalogued) | `core/light.ts`: windows and invisible walls pass sight, windows block movement, ethereal walls never block movement, and terrain walls need two to block sight. Authored: 335 window, 111 terrain, 94 ethereal and 37 invisible segments. Tested in `tests/vision.test.ts` L44 and `tests/movement.test.ts` L25. Present since M0 (60f543f). | A15 is moot |
| 73 | Secret doors and hidden things reachable from a list | partial | The Rooms sheet has 57 rows, each with only a go button and an eye. Floor 2 lists 6 rooms and no secret door. The library door failed 6 of 6 map taps. | 0.3.0 |
| 74 | Manual fog by shape | partial | Room reveal, two brushes and Undo reveal; no rectangle | later |
| 75 | Never show a floor the party has not reached | partial | In Players view the Floor dropdown shows and switching to Dungeon works (bug 5) | approval A1 |
| 76 | Token HUD with typed HP math | partial | Token panel has − and + (30×30 px) and no field | 0.5.0 |
| 77 | Per-token size override | partial | Size comes from the record; no control | 0.5.0 |
| 78 | Hidden tokens marked for the DM | **now present** | A hidden wolf draws at 45% opacity with its tag at 55% opacity in italic (`lbl token creature hidden`); hover says 'Hidden from players' | done (night contrast is checked in 0.5.0) |
| 79 | Creature 'identified' toggle | partial | Only the 'Players see' alias field | later |
| 80 | Path measure with waypoints | partial | The second tap ends the measure: '15 ft · 3 squares · tap to measure again'. A third tap starts a new one. | 0.7.0 |
| 81 | Send everyone's camera to the party | partial | Only the 'Players follow my camera' lock | 0.4.0 |
| 82 | Occluded tokens and picking under the cut | partial | Tapping anywhere on a token's base ring picks it. Picking ignores walls above the 5-ft cut only, not the section cut. | later (pick order is A7) |
| 83 | Roll initiative for all foes | partial | 'Roll initiative' rolls every ticked sheet and creature; no group or same-roll option | later (A2) |
| 84 | Custom tracker entries and a visible round | partial | 'Round 1' shows in the DM and Players-mode turn bar; the display has no turn bar; no custom entries | 0.5.0 |
| 85 | Hidden and aliased combatants in the players' tracker | partial | 'Rogue 21 · Wolf 19 · Fighter 10' with the wolf hidden (bug 4) | approval A2 |
| 86 | Stat block from the token with click-to-roll | partial, **in progress** (books and bestiary) | Token panel header: 'medium · AC 13 · 40 ft · CR 1/4'. No block and no rolls. | stat blocks from the books and bestiary work; click-to-roll in 0.5.0 |
| 87 | Private GM roller with show-to-table | partial | A hidden d20 for initiative only | 0.5.0 |
| 88 | Measurement shown on the table screen | partial | DM screen only: 0 ruler labels on the Player Display after a DM measure | 0.7.0 |
| 89 | Hex range overlays and a colour-blind palette | partial | `refreshRange()` skips hex; the stale square overlay stays (bug 8) | 0.3.0 (clear) and 0.7.0 (hex) |
| 90 | Diagonal rule setting | partial | localStorage only (bug 14) | 0.3.0 |
| 91 | Area panel | partial | The room tap menu holds the description and DM note plus 'Reveal 1A …', 'Move party here', 'Frame 1A' | 0.6.0 |
| 92 | Page references and a fidelity report | partial | 54 of 579 manifest keys have `page: null`. Of 716 scene rooms, 112 lack a page, 162 a description and 264 a DM note. No report exists. | 0.6.0 |
| 93 | Castle Ravenloft complete and legible | partial | Scene flagged partial; 129 of 161 rooms lack a description | approval A27 |
| 94 | Wilderness fidelity and the mist wall | partial, **in progress** (A28 map passes) | Not in this build | A28 |
| 95 | Display camera modes | partial | Lock on mirrors the DM; lock off leaves the display where it was | 0.4.0 (Stay, Send view, Frame); follow modes later |
| 96 | Undo and redo for DM actions | partial | Ctrl-Z after a party move does nothing. 'Undo reveal' then popped the move's automatic reveal of room 3. | 0.3.0 |
| 97 | Keyboard nudges and a focus guard | partial (the guard is weaker than catalogued) | Typing r in a textarea rotated the camera and / opened the finder; r with the Floor select focused rotated it; the arrow keys do not move a selected token | 0.3.0 (guard); nudge later |
| 98 | Room entry prompts | partial | No prompt. Authored: 26 trap-like objects and 458 hidden-creature slots. | 0.6.0 (option) |
| 99 | Per-campaign calendar and dated reminders | partial | Harptos months only (Hammer, Alturiak, Ches …); no reminders | later |
| 100 | Rests logged against the clock | partial | Only +1 h and +8 h | later |
| 101 | Road-graph travel distances | partial | Straight line only: '10.8 mi as the crow flies · about 3 h 37 min' | later |
| 102 | Wake authored creature slots | partial | 458 hidden-creature slots remain scenery | approval A22 |
| 103 | Loot taken ticks | partial | 65 containers hold contents; the card shows them; no tick | 0.6.0 |
| 104 | Performance guard and quality options | partial | **Exists:** a DPR cap and render-on-demand. **No guard:** the e2e suite has no perf spec. **Sweep** (SwiftShader, 1024x768): 10 of 39 locations take over 3 s to the first frame (Vallaki 6.25 s); 23 exceed 100 draw calls (Abbey 794, Amber Temple 713, Castle 453); 6 exceed 300k triangles (Vallaki 1.17 M). | a relative perf compare in 0.3.0; baseline and options later |
| 105 | Non-blocking loading with progress | partial | Vallaki opens in one long task of 6.2 s; no progress | later |
| 106 | Touch layout on phones | partial, mostly **in progress** (A29) | Bug 3 numbers above | 0.3.0 plus A29 |
| 107 | Enter a building from anything you tap | partial | 2 of 13 Vallaki sites (bug 2) | 0.3.0 |
| 108 | Camera presets and a reachable Find party | partial | Find party, Follow and Help are covered on the phone (bug 3); overhead is not north-up (bug 11) | 0.3.0 plus A29 (reach); A8 (north) |
| 109 | Label declutter including token tags | partial | 2 tag/key overlaps; 0 tags decluttered (bug 13) | approval A9 |
| 110 | Portrait-card initiative strip | partial (skipped) | The turn bar has name chips | not built |
| 111 | Pop-out DM panels | partial (skipped) | Only the Player Display popup | not built |

**The 9 rows marked 'have'** were exercised along the way rather than re-audited one by one. Line-of-sight vision, doors (including locked and secret ones), explored memory, shared exploration, stacked floors with the section cut, player text kept separate from DM notes, the popup display, built maps and the GM peek all behaved as recorded. The 74 end-to-end tests pass.

## New from the web check (2025-2026)

Many sites were blocked by the egress proxy: foundryvtt.com, dndbeyond.com, blog.roll20.net, vice.com and most review sites. The evidence below comes from search-engine summaries of those pages plus GitHub and raw.githubusercontent.com, which were reachable. Only rows with real evidence of use and a fit for a physical table were added.

| # | Feature | What it does | Evidence | Fit for mistLAB | Plan |
|---|---|---|---|---|---|
| N1 | Legendary-action pips that reset on the creature's turn | A boss's legendary actions show as pips that refill automatically each round | Foundry dnd5e 4.2.0 (21 Jan 2025): "Legendary actions now replenish automatically… reset at the start of a combat and at the end of the legendary creature's turn" ([release notes](https://github.com/foundryvtt/dnd5e/releases/tag/release-4.2.0)). Dedicated trackers track legendary and lair actions ([Initiative Forge](https://initiativeforge.lovable.app/)). | Strahd takes 3 legendary actions and has lair actions on initiative 20 in Castle Ravenloft. The DM tracks them on paper today. DM-side bookkeeping only. | 0.5.0 |
| N2 | DM-side AC, bloodied/down marks and condition icons on monster tokens in combat | The DM sees a monster's AC and health state on the map during combat | D&D Beyond Maps changelog: 17 Aug 2026, bloodied and dead effects at 50% and 0% hp, hideable for players; 28 Sep 2026, "Show AC on monster tokens during combat" and "Show Condition Icons on tokens" ([changelog](https://www.dndbeyond.com/changelog)) | The DM at the table answers 'does 15 hit?' and 'is it hurt?' without opening a panel. DM view only, so additive; the players' side stays A11. | 0.5.0 |
| N3 | Theatre-of-the-mind organizer | A board for scenes with no battle map: zones, who is in each, the scene's prep | D&D Beyond, 8 Sep 2026: Theater of the Mind Organizer "useful if you play in person", alongside Scene Prep pins ([how to use Scene Prep](https://www.dndbeyond.com/posts/2236-how-to-use-scene-prep-d-d-beyonds-new-prep-tool), [Vice](https://www.vice.com/en/article/dungeons-and-dragons-huge-dd-beyond-update-adds-dm-scene-prep-and-theater-of-the-mind-support/)) | Fits the 'No battle map here yet' spots and social scenes. Most pins now have maps, so value is moderate. | later |
| N4 | DM-written rollable tables | The DM writes d-tables (loot, names, weather) and rolls them from prep | D&D Beyond 2026 roadmap: "embed rules, lore and rollable tables" ([roadmap](https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap)); Owlbear Loot Tables and Tables Plus extensions ([extensions list](https://raw.githubusercontent.com/owlbear-rodeo/extensions/main/extensions.json), [Loot Tables](https://raw.githubusercontent.com/thp21000/loot-tables-for-OBR/main/public/store.md)); Roll20 rollable tables | Curse of Strahd runs on tables. The rows must be the DM's own (no book text). Shares an engine with #48. | later |
| N5 | Encounter XP budget readout (2024 rules) | Shows a group's XP against the Low/Moderate/High budget for the party | The 2024 rules use a per-character XP budget. The D&D Beyond builder was not updated, so DMs use Kobold+, Shieldmaiden and AideDD ([D&D Beyond forum](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/215302-encounter-builder-2024), [2026 roundup](https://char-gen.com/blogs/best-dnd-encounter-generators-2026)) | Useful for improvised fights; monster XP comes from the SRD entries. | later |

**New evidence for rows already in the catalogue:**
- Foundry v13 (2025): combat turn markers (#19), movement history with revert (#96), animated doors (#4) ([13.341](https://foundryvtt.com/releases/13.341)).
- Foundry v14 (1 Apr 2026): Scene Levels ('have'), pop-out applications (#111), and template regions that "can even be attached to Tokens" (#12, #25) ([14.359](https://foundryvtt.com/releases/14.359)).
- Roll20, Sep 2026: more aura shapes (#12) ([change log](https://help.roll20.net/hc/en-us/articles/360037772613-Change-Log)).
- Roll20 2025: Foreground Layer and Reactions; tokens trigger traps on overlap (#98) ([2025 recap](https://blog.roll20.net/posts/what-you-missed-in-2025-on-roll20/)).
- Roll20 Curse of Strahd remaster (Mar 2026): Map Pins with room descriptions (#91) and traps that "trigger automatically when a character steps on them" (#98) ([blog](http://blog.roll20.net/posts/curse-of-strahd-is-remastered-on-roll20-major-improvements-inside/)).
- D&D Beyond Scene Prep (2026): #32, #91.
- Dungeon Scrawl "Send to Tabletop" for in-person TV play (Mar 2026): 'have' second output ([Roll20 forum](https://app.roll20.net/forum/post/12702310/march-2026-update-send-to-tabletop-custom-presets-and-more)).

**Considered and not added:**
- Owlbear 2.4 Forecast automatic fog: our maps are authored ([release notes](https://blog.owlbear.rodeo/owlbear-rodeo-2-4-release-notes/)).
- Owlbear countdown timers Ticker!, Owlbear Timer and Multi Timer: thin evidence of success.
- Alchemy's rebuilt tactical engine (v1.36-1.38, Sep 2026): no new gameplay idea.
- Pixels smart dice: covered by the 'electronic dice' non-goal.

## The five iterations

**Rules for every iteration:**
- Additive only: new tools, panels and options whose defaults keep today's behaviour. Nothing from `docs/APPROVALS.md` except the already approved A28 and A29.
- At most seven features each.
- Ships only when its acceptance tests, the full unit and end-to-end suites, the no-book-content test and the relative perf compare from 0.3.0 all pass.
- Each bumps `package.json`, adds a dated changelog section, and is published as its own version.
- The labels assume 0.2.0 ships first. If another in-progress round claims a number, shift the labels and keep the order.

**Why this order:**
- **0.3.0 removes night-one pain without approvals.** Mis-taps move the party with no undo; the Death House secret door is unreachable; Vallaki buildings cannot be entered. Risk is low.
- **0.4.0 gives the DM control of the table's screen.** That screen is the product's edge for in-person play.
- **0.5.0 is the first iteration that needs the books and bestiary work merged.** It covers the bookkeeping a DM does in every fight.
- **0.6.0 turns the keyed area into the unit of play.** It needs 0.3.0's list and 0.4.0's Show.
- **0.7.0 adds the mechanical aids for the second fight.** It needs 0.4.0's display layer and 0.3.0's diagonal setting and perf compare.

### 0.3.0 · Reach and undo on night one

**Features**
1. **Enter from object cards.**
   - The DM's object info card and hover tip offer 'Enter <room name>' whenever the tapped object stands in a room whose `enter` names a built location. `TapHit.room.enter` is already computed for object hits.
   - One tap opens the building; Back returns to the town.
   - Players' cards never show Enter. Nothing else on the card changes.
2. **Hidden things listed per room.**
   - Each Rooms-sheet row gains a collapsed '▸ n hidden' disclosure.
   - It lists the room's secret doors, traps, hidden objects and hidden-creature slots: scene objects of class secret-door, hidden-object, trap or hidden-creature whose position lies in the room.
   - Each item has an eye (the same `revealSecretDoor` or `toggleObject` commit as the map) and Frame.
   - Room rows, their eyes and their taps behave as today.
3. **Session action history with Undo and Redo.**
   - A pure `core/history.ts` keeps this session's last 50 DM actions:
     - party and token moves, including level changes and the automatic 'explored' reveals each move appended
     - door toggles
     - container open and close, with the object reveals an opening added
     - object and secret-door reveal toggles
     - HP changes
   - Controls: Ctrl/Cmd-Z undoes and Shift-Ctrl/Cmd-Z redoes. Undo and Redo buttons sit in the Tools menu.
   - Feedback: the status line names what was undone, and a ring marks the cell for 1.5 s.
   - Scope: not persisted, and cleared on a location change.
   - The 'Undo reveal' button and its persisted log are unchanged. History entries pop exactly the reveal entries they appended.
   - DM only: Players mode and the display ignore it.
4. **Key guard and one keymap.**
   - `ui/keys.ts` holds every global shortcut in one KEYMAP; `main.ts` and `ui/viewSlider.ts` read it.
   - Shortcuts are ignored when focus is in an INPUT, TEXTAREA, SELECT or contenteditable. In a field, the first Esc blurs.
   - `tests/keys.test.ts` asserts no duplicate binding.
   - Outside fields every key does what it does today.
5. **Three small settings fixes.**
   - View menu: a 'Diagonals 5-5-5 / 5-10-5' control backed by the existing `mistlab.diagonal` key, default 5-5-5.
   - On stacked sites the Walls button gets `aria-disabled` and a title saying the section cut sets the wall height.
   - Switching the grid to hex removes the square range overlay, and the status line says 'Ranges need the square grid'.
6. **Phone fit and phone test projects.**
   - Two new Playwright projects: 'phone' (390x844, DPR 2, touch) and 'phone-landscape' (844x390).
   - Below 600 px the initiative roster shows one card per combatant instead of the 678-px table.
   - On touch phones the HP −/+ buttons and the roster's initiative inputs get 44-px targets.
   - The compass frame and the menus are fixed by A29 fix round 2, which this iteration asserts.

**Infrastructure** (not a feature): `e2e/perf.spec.ts` compares a build with its parent on the same machine.
- Scenes: Death House, Vallaki, Castle Ravenloft 'Whole', the Abbey and the Amber Temple.
- Method: median of 3 runs.
- It fails at +20% draw calls or triangles, or +30% time to first frame.

**Acceptance**
- **Enter (bug 2).**
  - Vallaki `ch05/N`, tabletop and overhead, with this check's three-point tap sweep: every tap that opens a card or menu on N1-N9 and N8a-d offers Enter (today 5 of 78 taps and 2 of 13 sites).
  - Enter then Back is 2 taps and leaves `controls.target` within 1 ft of where it was.
  - The same taps in Players mode show no Enter.
  - The Berez U3 hut card offers Enter.
- **Hidden things (bug 7, list half).**
  - Death House Floor 2: Rooms, then '▸ hidden' under 8 Library, then the eye: 3 taps.
  - `state.reveals` gains `{ type: 'secret-door', id: 'f2-sdo-lib' }`. It survives a reload; the Player Display shows the door; the party passes once it is opened in Players mode.
  - The dungeon's hidden chests and 'dungeon-centipedes' are listed and revealable.
- **Undo.**
  - Reveal room 3, then move the party into an unexplored room so it is auto-revealed. Ctrl-Z puts the party back and hides that room again; room 3 stays revealed.
  - A second Ctrl-Z hides room 3; Shift-Ctrl-Z reveals it again.
  - Through the spiral stair then Ctrl-Z: the previous cell and level return and the display follows.
  - Undo of a door, a container (with its revealed contents) and an HP change works.
  - `tests/undo.test.ts`: 51 moves keep the last 50, and reveal entries never pop twice in any interleaving.
- **Existing undo unchanged.**
  - Reveal, reload, 'Undo reveal': the room is hidden again (the existing test passes unchanged).
  - Ctrl-Z and Shift-Ctrl-Z in Players mode and on the display leave the state deep-equal.
- **Key guard.**
  - Typing r, f, / and n into a textarea, and r with the Floor select focused, leaves the camera azimuth, the finder and the turn unchanged (today r rotates and / opens the finder).
  - Outside fields, R, F, /, N, Esc, [, ] and \ behave as before (`ui.spec` unchanged). `keys.test` finds no duplicate binding.
- **Settings (bugs 8, 12, 14).**
  - A 3-cell diagonal measures 15 ft. After Diagonals 5-10-5 it measures 20 ft, and still does after a reload.
  - On N2, Walls has `aria-disabled="true"`.
  - An encounter on square, then Hex: no `range-overlay` object remains (today it remains).
- **Phone layouts.**
  - At 390x844 and 844x390, `elementFromPoint` at the centre returns Zoom in, Zoom out, Find party, Follow, Help, Tools, View, Rooms and the Undo button.
  - The Tools and View panels lie inside the viewport (today they start at x = −150 and −71 px on the phone).
  - The Section and view-slider boxes do not intersect on N2.
  - The roster's scrollWidth is at most its clientWidth.
  - HP buttons are at least 44×44 on touch phones.
- **iPad and desktop.**
  - At 768x1024, 810x1080, 1180x820, 1024x768 and 1440x900, the `slider.spec` and `grid.spec` screenshots are unchanged within the existing tolerance.
  - With the Rooms sheet open on iPad portrait, at least 50% of the map's width still takes taps.
- **Tap counts.** Undo is one key or 2 taps (Tools, Undo). Enter is 2 taps. A secret door from the list is 3 taps.
- **Perf and iPad.**
  - `perf.spec` stays within +20% calls and triangles and +30% first frame of 0.2.0.
  - A manual iPad row (Rooms list, Tools then Undo, Enter on Vallaki N2) is recorded in the changelog.

**Pitfalls guarded:** 14, 15, 16, 17, 24, 31, 32, 39, 1, 2.

**Files**
- `app/src/main.ts`: the object card in `onTap`, `renderRooms`, the Tools and View menus, keydown
- `app/src/app.ts`:
  - `tap()` gives object hits their `room.enter`
  - history hooks in `moveTokenTo`, `takeLink`, `afterPartyMove`, `toggleDoor`, `toggleOpen`, `toggleObject`, `revealSecretDoor` and `adjustHp`
  - `layoutChanged` calls `refreshRange`
  - `distanceFt`
- `app/src/core/history.ts` (new)
- `app/src/ui/keys.ts` (new)
- `app/src/ui/viewSlider.ts`
- `app/src/ui/encounter.ts`: roster cards
- `app/src/styles.css`
- `playwright.config.ts`
- `e2e/reach.spec.ts` (new)
- `e2e/perf.spec.ts` (new)
- `e2e/ui.spec.ts`
- `e2e/move.spec.ts`
- `e2e/grid.spec.ts`
- `tests/undo.test.ts` (new)
- `tests/keys.test.ts` (new)
- `tests/grid.test.ts`

**Depends on**
- 0.2.0 shipped. The history leaves Import and Restore alone.
- A29 merged. Undo and Redo live in the Tools panel, and the phone reach assertions rely on its fix round 2.

**Risk:** Low-medium. The only subtle part is the history interleaving with the persisted reveal log, which unit tests cover in both orders. Enter must stay DM-only.

### 0.4.0 · The table screen under the DM's hand

**Features**
1. **Display status, heartbeat and sequence numbers.**
   - A DM chip reads 'Display live' or 'No display', with Relaunch.
   - Once a display has said hello, the DM sends `{ kind: 'beat', seq }` every 2 s. Every message carries `seq`, and the display drops stale ones.
   - After 6 s of silence the display shows 'Waiting for the DM'.
   - Test hook: `__mist.pauseBeats()` under `?test=1`.
2. **Curtain and Freeze.** Two one-tap buttons on the chip.
   - Curtain blanks the display to the campaign title over a CSS mist, with no second WebGL context.
   - Freeze holds the display's last frame while the DM works; Unfreeze catches up to the latest state.
   - Option 'Curtain during location loads', default off.
   - Held in a small broadcast 'table' record, so a display reload keeps it. A tap or key on the display never clears it.
3. **Send view, Frame for players and Stay.**
   - Mirror (today's lock) stays the default.
   - Stay keeps the display's frame while the DM browses.
   - 'Send view' pushes the DM's current view once. 'Frame for players' on the room menu frames a room on the display only.
   - Both travel as camera intents in world units (target, distance, azimuth, polar) fitted to the display's aspect.
   - The minimap outlines the display's frame when it differs from the DM's.
4. **Read-aloud captions and show cards.**
   - 'Show to table' on the room menu: the room name and player description.
   - On a revealed creature's token panel: the alias, player description and colour chip.
   - On object cards: the player label and player description.
   - Payloads come only from `core/playersView.ts`. Hidden creatures have no Show button, and a forged request is rejected.
   - Clear, auto-clear (off, 20 s or 60 s) and a 'Showing' chip on the DM screen.
5. **Pointer pings.**
   - A Pointer tool in the Tools menu. With it, a 400-ms press pings a ripple on the DM screen and the display.
   - Display mode: ripple, pan or both; default ripple.
   - An edge arrow shows when the point is off the display's frame.
   - Pings land only in revealed or explored cells.
   - Suppressed while curtained, frozen or showing a caption, and never replayed.
6. **Display rotation and margins.** Rotation of 0, 90, 180 or 270 degrees and margins per edge, set from the chip and stored in the display window's own localStorage. Defaults equal today.

**Acceptance**
- **Defaults.** The existing `slider.spec` Player Display tests pass unchanged. An open display with no action taken matches today's pixels within 0.5%.
- **Heartbeat.**
  - `pauseBeats()`: the banner appears within 6-8 s and is gone within 3 s after resume.
  - An idle DM with beats running shows no banner for 60 s (today: 0 messages in 5 s).
  - Closing the display makes the chip read 'No display' within 4 s.
  - `tests/channel.test.ts`: a stale seq is dropped.
- **Curtain.**
  - 1 tap. The display is covered within 300 ms.
  - The title text is at least 18 px with contrast of at least 4.5:1.
  - A click and a key on the display leave it; a display reload keeps it.
  - With 'Curtain during location loads' on, every frame sampled by `__mist.onFrame` during Death House → Vallaki has unrevealed regions within 12/255 of the fog colour.
- **Freeze.**
  - 1 tap. Revealing 3 rooms and moving the party leave the display within 0.5% of before.
  - After Unfreeze the display equals DM t = 0 within 0.5%.
- **Frame for players.**
  - Frame for players on room 8: room 8's box fits the display at 1280x720, 1024x768 and 768x1024, and the DM camera does not move.
  - A DM pan afterwards leaves the display camera unchanged.
  - Send view is 2 taps.
- **Show.**
  - Showing the revealed Ghoul puts its alias and description on the display within 300 ms. A hidden creature has no Show.
  - The `player-safety` fuzz finds no DM note, real name of a hidden token or hidden id in any show or ping payload.
  - Auto-clear 20 s clears at 20 ± 1 s.
  - A display reload re-shows an active caption, and Clear still works after the reload.
  - A room caption is 2 taps.
- **Ping.**
  - Over 5 pings the median drawAt − sentAt is under 250 ms.
  - A ping in an unrevealed room draws nothing on the display; one outside the frame draws an edge arrow.
  - While frozen or curtained nothing draws, and nothing replays afterwards.
  - Without the Pointer tool a 400-ms press does what it does today.
- **Rotation and margins.** At rotation 180 the display compass reads 180° ± 1°. With 40-px margins the caption stays inside them.
- **Layouts.**
  - At 390x844 and 844x390, the chip, Curtain, Freeze and Pointer pass `elementFromPoint`.
  - At 768x1024, 1180x820 and 1024x768 the chip overlaps neither the top-bar groups nor the view slider.
  - Every players'-side text node is at least 18 px at 1280x720, with contrast of at least 4.5:1.
- **Leaks.** No 'dm' key appears in any message (listener on the display page), and each window keeps one WebGL canvas.

**Pitfalls guarded:** 3, 4, 5, 6, 9, 10, 12, 13, 20, 30, 35, 36, 37, 42.

**Files**
- `app/src/state/channel.ts`: beat, seq, table, show, ping and intent kinds
- `app/src/core/playersView.ts` (from 0.2.0): show and ping payloads
- `app/src/app.ts`: broadcast with seq, heartbeat, intents in `sendCamera`, display-side `onMsg`
- `app/src/render/world.ts`: intents, rotation, ripple
- `app/src/ui/display.ts` (new): the DM chip and the display overlays
- `app/src/ui/minimap.ts`: the display frame
- `app/src/main.ts`: chip, Pointer tool, Show buttons, room menu items
- `app/src/styles.css`
- `e2e/display.spec.ts` (new)
- `tests/channel.test.ts` (new)
- `tests/player-safety.test.ts`

**Depends on**
- 0.2.0: `core/playersView.ts` and the projected channel path
- 0.3.0: the KEYMAP, the phone projects and the perf compare
- A29: the chip is a panel

**Risk:** Medium. There must be one camera authority per window through Mirror, Stay and one-shot intents. BroadcastChannel timing in tests needs the seq and heartbeat hooks.

### 0.5.0 · Combat bookkeeping at the table

**Features**
1. **Conditions with rules text.**
   - `Token.conditions`, set from a picker on the token panel: the SRD conditions plus an Exhaustion level and Concentrating.
   - Each condition's rules text comes from the books lookup (`lookup('<name> condition', rulesEdition())`) in the shared tooltip.
   - Conditions are listed beside the combatant in the DM turn bar.
   - Screen-space pips on revealed tokens: at most 3 plus '+n'; at least 10×10 px on a phone and 18 px on the display; decluttered with the labels.
   - Nothing for hidden tokens.
   - Option 'Conditions as rings', default pips.
2. **Durations that expire.**
   - A condition can last until the start or end of a named combatant's turn, or for N rounds.
   - `nextTurn()` expires it on the DM screen and the display.
3. **Tracker entries: lair action, reminders, legendary actions.**
   - DM entries in the order that Next passes through: 'Lair action' at 20, losing ties, and free-text reminders. Players see an entry only when it is ticked visible.
   - Legendary-action pips per creature. The DM types the count, or it comes from the stat block when the bestiary has one. They reset at the start of that creature's turn, and a tap spends one.
4. **Token panel edits.**
   - An HP field beside the existing − and + that takes '-7', '+5' or '15'. The value is clamped to 0..max and recorded in 0.3.0's history.
   - A size select (T, S, M, L, H, G) defaulting to the record. The base ring and the occupied cells follow it.
5. **The DM's combat line and health marks.**
   - The DM turn bar's 'now' line adds AC and hit points for creatures, in DM view only.
   - Option 'Health marks (DM)', default off: bloodied (at or below half) and down (0) marks on creature tokens. Shown in DM view only, fading with the DM labels below t = 0.5, never on the display.
6. **DM roller and roll log.**
   - `core/dice.ts`: NdM±K, advantage, disadvantage, critical doubling, seedable.
   - A roll field in the DM turn bar.
   - Click-to-roll on the attack and damage lines of the DM stat-block tooltip.
   - A DM-only log stamped with the campaign clock (`CampaignState.rolls`, classified 'dm').
   - 'Show result' sends a caption through 0.4.0, and only when tapped.
7. **Large controls.** Option, default off: the HP field and buttons, initiative inputs and turn-bar buttons become at least 56 px.

**Acceptance**
- **Conditions.**
  - Prone and Paralyzed on a revealed Ghoul show two pips on the DM screen, in Players mode and on the display.
  - On a hidden Ghoul nothing shows on the players' side, in the DOM or in the display state.
  - The picker is 2 taps from a picked-up token.
- **Rules text.**
  - With the 2024 book saved for offline and the network off, the Prone tooltip shows the SRD 5.2.1 text. With the edition set to 2014 it shows SRD 5.1.
  - With no book saved it shows the name and raises no error.
- **Durations.** 'Until the end of Rogue's next turn' clears exactly when Next leaves Rogue's next turn, on the DM screen and the display. `tests/conditions.test.ts` covers start, end and rounds.
- **Pips.**
  - Five conditions show 3 pips plus '+2'. Pips are at least 10×10 px at 390x844.
  - With 12 tokens no pip overlaps a visible label.
  - At 23:00 with mist, pip pixels contrast at least 3:1 with their surround.
  - The Rings option replaces pips with rings. Defaults leave screenshots unchanged.
- **Tracker entries.**
  - A Lair action at 20 sorts before a combatant who rolled 20. Next stops on it. The players' bar shows it only when ticked visible.
  - Legendary pips at 3: spend 2, then Next round to the creature's turn, and the pips are back at 3.
- **HP.**
  - '-7' on 22 gives 15; '+30' gives max; '15' gives 15; Ctrl-Z restores the previous value.
  - No HP number appears on the players' side: `player-safety` checks the Players-mode DOM and every display message.
- **Size.**
  - Large: the ring radius equals `baseRingFt('large')` (unit test), and `rangeOf` treats the token as 2×2.
  - `tests/bestiary.test.ts`: every entry has a size in T/S/M/L/H/G.
- **Combat line and health marks.**
  - The DM line reads 'Wolf · AC 13 · 11/11 hp'; Players mode shows only the name.
  - Health marks on: a wolf at 5/11 shows the bloodied mark at t = 1, and none at t = 0, in Players mode or on the display. Off: screenshots unchanged.
- **Rolls.**
  - `tests/dice.test.ts` (seeded): ranges for '2d6+3', advantage and disadvantage, and a critical doubles only the dice.
  - Tapping Bite on the Wolf stat block logs one line with to-hit and damage, stamped 'Day 1 · 14:00'.
  - No roll and no 'rolls' key appears in any display message. 'Show result' is the only path to the display.
- **Large controls.** On: the HP field and initiative inputs have a boundingBox height of at least 56. Off: unchanged.
- **Layouts.**
  - The picker, HP field, roller and pips pass the phone sweep at 390x844 and 844x390.
  - On 768x1024 the token panel and turn bar do not overlap.
  - Defaults at 1024x768 and 1440x900 are unchanged.
- **Migration and perf.**
  - A `campaign-io` fixture: a 0.4.0 save without conditions, rolls or size loads unchanged.
  - `perf.spec`: Vallaki with 12 tokens carrying conditions stays within the band.

**Pitfalls guarded:** 1, 4, 9, 15, 19, 21, 23, 25, 26, 27, 28, 39, 49.

**Files**
- `app/src/state/campaign.ts`: `Token.conditions`, `Token.sizeOverride`, `Encounter.entries`, legendary counts, `rolls`
- `app/src/core/conditions.ts` (new)
- `app/src/core/dice.ts` (new)
- `app/src/core/playersView.ts` (from 0.2.0): classifies conditions as 'player' and rolls as 'dm'
- `app/src/app.ts`: pips and health marks in `syncTokens`, expiry and legendary reset in `nextTurn`, `setHp`, a 'pip' declutter kind
- `app/src/ui/encounter.ts`: entries, legendary field, combat line, roll field
- `app/src/ui/conditions.ts` (new)
- `app/src/ui/rolllog.ts` (new)
- `app/src/main.ts`: token panel
- `app/src/ui/icons.ts`
- `app/src/render/rangeOverlay.ts`: ring mode
- `app/src/bestiary.ts`
- `app/src/styles.css`
- `tests/conditions.test.ts` (new)
- `tests/dice.test.ts` (new)
- `tests/bestiary.test.ts`
- `tests/player-safety.test.ts`
- `tests/campaign-io.test.ts` (from 0.2.0)
- `e2e/combat.spec.ts` (new)
- `e2e/display.spec.ts` (from 0.4.0)

**Depends on**
- The books work: `books/lookup.ts` and the Rules edition preference
- The bestiary models with the DM stat-block tooltip: click-to-roll hooks and sizes
- The clarity work's shared tooltip component
- 0.3.0: history for HP undo; the phone projects
- 0.4.0: Show result; the display overlay layer

**Risk:** Medium.
- Seven features is the limit.
- Pips must stay screen-space and decluttered to keep the frame rate.
- The rules text depends on books saved for offline.

### 0.6.0 · The keyed area: panel, notes and honest gaps

**Features**
1. **Area panel.**
   - A DM-only drawer for one area key. It is a bottom sheet below 820 px and is registered with the A29 panels so it can be moved and folded.
   - Contents:
     - key, page, player description and DM note
     - the DM's own note
     - the hidden things from 0.3.0, with eye and Frame
     - containers with contents and Taken ticks
     - doors (open, locked) and stairs and links
     - creature slots, and the NPCs `characters.json` tags to the location
     - 'Show to table'
   - Opened by a new 'Panel' item in the room menu, an icon on each Rooms row, or a secondary button on '/' results.
   - A 'Follow party' toggle keeps it on the party's room.
   - '/' Enter and key labels behave as today.
2. **DM notes and a session pad.**
   - `CampaignState.notes`, keyed by location and key, object, token or world pin, plus one session pad.
   - Autosaves after 500 ms. Classified 'dm', so it is never projected. Included in 0.2.0's export and snapshots.
   - A dot marks Rooms rows that have a note.
   - Dice expressions (NdM±K) and 'DC n' in notes become roll buttons using 0.5.0's roller.
3. **Loot taken ticks.** A 'Taken' tick per container, in the panel and on the DM object card. Saved per campaign, never projected.
4. **Entry prompts (option, default off).**
   - When the party enters a room holding a trap or a hidden-creature slot, a DM-only chip names it, for example 'Entering 26 · hidden pit'.
   - A tap opens the panel. Nothing reaches the display.
5. **Honest gaps.**
   - `scripts/fidelity-report.ts` writes `docs/FIDELITY.md` with per-location counts of keys without a page and rooms without a description or DM note.
   - `tests/fidelity.test.ts` fails if any count gets worse than the committed report.
   - The Library shows a 'partial' badge on scenes flagged partial, which today means Castle Ravenloft.

**Acceptance**
- **Panel content.** The Death House '8 Library' panel shows p.213, the bookshelf secret door with its eye, and the desk with its iron key. The no-book-content test passes over the panel text.
- **Tap counts.**
  - Room, then Panel: 2 taps. Rooms, then the row icon: 2 taps.
  - '/', '8', Enter still jumps and frames (`ui.spec` unchanged).
- **Notes.**
  - A note on key 8 survives a reload and Export, Reset, Import.
  - It never appears in Players mode or in any display message; a listener asserts no 'notes' key.
  - Typing r, /, n and Ctrl-Z in it leaves the camera, finder, turn and party unchanged. The first Esc blurs, the second closes.
  - '2d6+3' in a note rolls into the log.
- **Render churn.** With Follow party on, walking 1A → 1B → 2A causes at most 3 panel renders (counter hook).
- **Layouts.**
  - At 390x844 with the panel folded, a 200-px map drag moves `controls.target` by more than 1 m.
  - Panel controls pass the phone sweep at 390x844 and 844x390.
  - On 768x1024 and 810x1080 the sheet covers at most 50% of the height.
  - At 1024x768 and 1440x900 the map's centre stays clear.
- **Loot.** A Taken tick on `f2-desk` persists and is absent from display messages.
- **Entry prompt.** On: entering 26 (the hidden pit) shows the chip once, on the DM screen only. Off by default.
- **Fidelity.**
  - `fidelity.test` fails on a fixture that drops a page.
  - The committed report starts from this check's counts: 54 of 579 manifest keys without a page; 112, 162 and 264 of 716 rooms without a page, description and DM note.
  - The Castle Ravenloft row shows 'partial'; other rows are unchanged.
- **Migration.** A 0.5.0 save without notes or taken ticks loads unchanged.

**Pitfalls guarded:** 4, 10, 11, 15, 17, 24, 28, 32, 39, 43, 48, 50.

**Files**
- `app/src/ui/areaPanel.ts` (new)
- `app/src/ui/notes.ts` (new)
- `app/src/state/campaign.ts`: notes, taken
- `app/src/core/playersView.ts` (from 0.2.0)
- `app/src/app.ts`: entry prompt in `afterPartyMove`; panel model
- `app/src/main.ts`: room menu item, Rooms icon, finder button, object card tick
- `app/src/ui/library.ts`: partial badge
- `app/src/styles.css`
- `scripts/fidelity-report.ts` (new)
- `docs/FIDELITY.md` (new, generated)
- `tests/fidelity.test.ts` (new)
- `tests/player-safety.test.ts`
- `tests/campaign-io.test.ts` (from 0.2.0)
- `e2e/panel.spec.ts` (new)
- `e2e/ui.spec.ts`

**Depends on**
- 0.3.0: the hidden-things list and the key guard
- 0.4.0: Show to table
- 0.5.0: dice in notes
- A29: the drawer is a panel
- 0.2.0: export and snapshots carry notes

**Risk:** Medium. Screen space on iPad portrait and render churn while the party walks; both are measured.

### 0.7.0 · Templates, auras and better measuring

**Features**
1. **Area-of-effect templates.**
   - A Template tool with sphere or cylinder (radius), cone, line and cube.
   - Cells come from `core/range.ts` on square grids (with 0.3.0's diagonal rule) and on hex, stopping at walls that block sight.
   - The DM sees outline and cells. Players and the display see cells only, with no text, and nothing over unrevealed cells.
   - Named zones persist until cleared. A brief flash on placement.
2. **Auras.** `Token.aura` (radius, colour), set on the token panel. The cells on the token's floor follow it. Hidden with the token.
3. **Path measure with Show to table.**
   - A Path tool: taps add waypoints, and a double-tap or Esc ends.
   - Shows segment and total distances.
   - 'Show to table' draws the path on the display when every point is revealed or explored.
   - The two-tap Measure tool is unchanged.
4. **Hex parity and a colour-blind palette.** Move and strike overlays on hex grids. Option 'Colour-blind ranges' (blue and orange), default off.
5. **Fly flag.** A per-token 'Flying' toggle that ignores terrain blockers in movement. Walls and closed doors still block.
6. **Distances from the picked-up token.** A DM-only list in the token panel with each visible creature's distance on the grid rule, plus the height difference to creatures on other floors.

**Acceptance**
- **Template cells.** `tests/range.test.ts` fixtures:
  - a 20-ft sphere on square (5-5-5 and 5-10-5) and on hex
  - a 15-ft cone on square and on hex
  - a wall cutting the set
- **Tap counts.** Template, shape, tap: 3 taps. Clear: 2 taps.
- **Templates on the display.**
  - The display shows the cells and no text.
  - A template centred in an unrevealed room draws nothing on the display (pixels within 12/255 of the fog colour) until the room is revealed.
- **Auras.** A 10-ft aura on a hidden token draws nothing on the display or in Players mode until Reveal.
- **Measuring.**
  - The `grid.spec` two-tap measure passes unchanged.
  - A Path with two waypoints equals the sum of its segments.
  - Show to table draws only when all points are revealed.
- **Hex.** In a hex encounter the move/strike overlay exists and its cells match `hexDistanceFt`.
- **Fly.** A flying token crosses a terrain blocker but not a wall (`tests/movement.test.ts`).
- **Distances.** The list shows '15 ft' for a wolf three cells away, and a height difference for one on another floor.
- **Perf.** `perf.spec`: Vallaki with 5 templates and 3 auras stays within +20% draw calls and +30% first frame of 0.6.0, using merged meshes.
- **Layouts.** New controls pass the phone sweep at 390x844 and 844x390. Screenshots at 768x1024, 1180x820 and 1024x768 are unchanged with defaults. The colour-blind option is off by default.

**Pitfalls guarded:** 1, 8, 9, 13, 15, 22, 23, 39.

**Files**
- `app/src/core/range.ts`
- `app/src/core/grid.ts`
- `app/src/core/movement.ts`
- `app/src/core/templates.ts` (new)
- `app/src/render/rangeOverlay.ts`
- `app/src/render/templateOverlay.ts` (new)
- `app/src/app.ts`
- `app/src/state/campaign.ts`: templates, `Token.aura`, `Token.flying`
- `app/src/core/playersView.ts` (from 0.2.0)
- `app/src/state/channel.ts`
- `app/src/main.ts`
- `app/src/styles.css`
- `tests/range.test.ts`
- `tests/movement.test.ts`
- `tests/templates.test.ts` (new)
- `e2e/grid.spec.ts`
- `e2e/templates.spec.ts` (new)

**Depends on**
- 0.3.0: the diagonal setting, history for placing and clearing, the phone projects and the perf compare
- 0.4.0: the display drawing layer with its curtain and freeze suppression; Show to table
- 0.5.0: the token panel layout

**Risk:** Low-medium. Hex cell math and draw calls on the big maps.

## Left for later, and why

- **Performance baseline and quality options.** This covers the committed baseline, low power, auto quality, the display's own tier, non-blocking loading with progress, preloading recents, the iPad checklist and a fallback for a context that never comes back.
  - Why later: the in-progress map passes (landform, terrain-following ground, wilderness rebuilds, stylization, nested world) change every scene's cost.
  - Meanwhile: 0.3.0's relative compare guards each iteration. Record the baseline once the map passes land.
  - Evidence: Vallaki opens in one 6.2-s long task.
- **Fog tools.** Whole floor, rectangle, re-fog, brush kept in the room, reveal preview, lighting reasons, lock reveals. Valuable, but 0.3.0's undo removes the night-one risk. Next after 0.7.0.
- **Arrow-key nudge and clamp.** It needs a keyboard; little value on an iPad.
- **Display, second pass.** Follow-party and follow-combatant modes, turn-bar position, the Present button, floor and date chips, call for a roll. These wait until 0.4.0 proves the camera state machine.
- **Staging and improvising.** Stage keyed NPCs, Identify, numbered aliases, party-size scaling, improvised battle maps and the encounter XP budget (N5). Three reasons:
  - `characters.json` tags NPCs by location, not by key, so staging by key needs data first.
  - Start encounter here is gated on A2.
  - Generic battle maps overlap the in-progress wilderness rebuilds.
- **Handouts, save picture, print floor plans, link fields.** They need an IndexedDB v2 blob store, with Safari quotas, and print memory is a problem on iPad. Paper still works at the table.
- **Campaign memory.** Journal, Tonight plan, NPC tracker and recap all build on 0.6.0's notes.
- **Barovia pacing.** Tarokka record, events, spies, dated reminders, random encounters, rollable tables (N4), rest log, a Barovian calendar option, road miles and a scene-light override. The scope is broad, and it needs notes and a roads graph first.
- **Theatre-of-the-mind organizer (N3).** Most pins now have maps. Revisit after 0.4.0's captions.
- **Clickable DM labels.** Today a tap on a label falls through to the map. Changing that would change a gesture, and 0.3.0's list already solves the reach problem.
- **Skip downed and hide defeated options; the turn ring and 'you're up' banner.** The players'-side versions are gated on A2.
- **Skipped as not built.** Animated doors, drawing, stickers, audio, weather particles, physical-scale mode, the LAN display, marching order, split party, the DM's PDF, the cover check, prefabs, the player companion, the portrait strip and pop-out panels.

## Blocked behind approvals

- **Night-one fixes, recommended for 0.2.1:**

  | Approval | Fixes |
  |---|---|
  | A1 | Bug 5 and #75 |
  | A2 | Bug 4 and #85. It also gates #83 roll all foes, #19 and #20 on the players' side, #55 Start encounter here, and #45 the LAN display. |
  | A3 | Bug 6 |
  | A4 | Bug 15 |
  | A5 | Bug 1 |
  | A6 | Bug 9 |
  | A7 | The pick-order half of bug 7, and #82 |
  | A8 | Bug 11, and the north-up part of #108 |
  | A9 | Bugs 10 and 13, and #109 |

- **Features waiting on an approval:**

  | Approval | Rows |
  |---|---|
  | A11 | #11. 0.5.0 adds marks on the DM side only. |
  | A12 | #69 |
  | A14 | #70 lit and doused lights (the rest of #1 is already true) |
  | A16 | #21 |
  | A17 | #47 |
  | A18 | Barovian as the default calendar |
  | A19 | Road time drives the clock |
  | A20 | #62 |
  | A21 | Display camera bounded to revealed extents |
  | A22 | #102 |
  | A25 | #2 |
  | A26 | #5 |
  | A27 | #93; #14 waits on it too |

- **Not needed by this plan.** A10, A13, A23 (0.6.0 uses separate buttons), A24 (0.7.0 adds a separate Path tool), A30 and A31 (0.3.0 keeps the persisted reveal undo).
- **A15 is moot.** Windows already pass sight and block movement.
- **Approved and in progress elsewhere:** A28 (#94) and A29 (#34 and most of #106).

## Corrections the docs need

1. **Authored scene lights.** They already feed the players' view, and only within the party's line of sight. A14's 'today' and catalogue rows #1 and #70 understate this.
2. **Wall roles.** Window, invisible, ethereal and terrain roles have existed since M0, with tests. A15 describes a change that is already the behaviour.
3. **Hidden creatures.** They are already marked for the DM, so the planned 'Mark hidden creatures' option is unnecessary.
4. **Unmapped places.** 'No battle map here yet' already appears on pin cards without a map.
5. **Creature numbering.** DM copies are already numbered ('Wolf 2'); only the players' aliases are not.
6. **Context loss.** three.js already restores a lost context on Chromium; what is missing is the fallback for a context that never returns.
7. **Undo reveal.** It pops the automatic 'explored' entry a party move appended. 0.3.0's history ties that entry to the move.
8. **Bug records.** Bug 2 (2 of 13 sites), bug 3 (landscape), bug 4 (the display has no turn bar; the leak is in the message) and bug 5 (`n` inert, `/` opens an invisible finder) need updating.
9. **Bestiary list.** It still stops at 60 rows with no 'more' hint.
10. **Staging data.** `characters.json` tags NPCs by location (Strahd `["K"]`), not by area key; staging by key needs that data.
