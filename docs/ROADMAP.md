# mistLAB roadmap: five QA versions

Five versions proposed by the round-zero assessment (`docs/FEATURES.md`). Each version ships on its own, keeps `tests/no-book-content.test.ts` green and, from V1 on, keeps the performance baseline green. Castle Ravenloft completion runs as a parallel authoring track that lands level by level.

## Gaps the versions close

| Gap | Why it matters | Fit | Effort |
|---|---|---|---|
| First-session breakage: multi-floor stairs skip a floor, keyed buildings cannot be entered by tap, Castle Ravenloft party spawns in the catacombs | A DM hits all three in Death House and Vallaki on night one; the data is right and the glue is wrong (afterPartyMove loops every link after a hop, Enter lives only in the bare-ground menu, ensureDefaultToken ignores scene.entry). | core | small |
| Players mode with no DM chrome and no leaks (Floor/Section/Library/World map hidden, hidden combatants aliased or omitted in the turn bar, no unexplored wall silhouettes, no unrevealed world symbols), with a deliberate DM-return gesture that still works | The product promise is a screen that can be turned toward the table or handed to a player; today it leaks in four places while Owlbear's cast view and Arkenforge's player screen never do. Must be airtight before any player device runs it, and the DM must still be able to get back without the slider. | core | medium |
| Phone-width layout that works (pointer-events bug, menus on screen, sliders not stacked, stacked roster, reachable Help, landscape project) | A DM glancing at a phone or an iPad in Split View is the second-screen reality, and players' own devices will be phones; today the camera and help buttons cannot be tapped at 390 px (styles.css L25 vs L348). | core | small |
| List-based access to every hidden thing (secret doors, traps, hidden objects, hidden creature slots) per room, clickable DM labels, Reveal-tool pick priority | Roll20's GM layer and Foundry's hidden Map Notes are one click away; ours require hitting a 1-ft door behind a bookshelf. Nothing mid-session should need precision tapping. | core | small |
| Undo for token moves (incl. level), door toggles and container opens; today only reveals | 'Nothing fiddly mid-session': a mis-tap on night one moves the party across the map with no way back. commit() already exists; a bounded snapshot history is small. | core | small |
| Campaign state safety: navigator.storage.persist() plus export/import of the campaign JSON (later with handout blobs) | Safari evicts IndexedDB on an uninstalled PWA; a year of reveals is otherwise unrecoverable, and the DM cannot move a campaign between iPad and laptop. Foundry/FGU/Arkenforge users own their files. | core | small |
| Performance baseline and regression guard: per-scene load time, draw calls and triangles recorded by e2e against a committed baseline; docs/PIPELINE.md budget reconciled with reality | Every later version adds overlays, labels, panels and state to maps that already exceed the written budget (Vallaki 1.18 M triangles, Abbey 796 draw calls); without a guard the castle, pips, lights and journal will regress the existing maps unnoticed, and acceptance criteria that cite 'the PIPELINE budget' are untestable while the budget is fiction. | core | small |
| Area panel: everything the book keys to the room the party is in (key, page, player text, DM note, your note, secrets, containers, doors, links, creature slots and tagged NPCs with stat blocks); replaces the description half of the room tap menu rather than adding a fourth surface | The module's unit of play is the keyed area; mistLAB holds all of this data but spreads it over taps that are hard to land. The structured analogue of Roll20 Map Pins, DDB Scene Prep and FGU story entries without shipping the text (task #51). | core | medium |
| Wake authored creature slots into live tokens and 'Start encounter here'; stage the creatures tagged to a key | 458 slots already say who is in the room; one tap should give them HP, a player alias and an initiative entry instead of re-finding them in the repository. Roll20/FGU/Shard pre-place monsters; ours is wiring, not content. Regenerating 44 scenes needs a golden-diff test. | core | medium |
| SRD stat blocks (CC-BY-4.0 SRD 5.1) and condition glossary from the token panel, bestiary and area panel, with a DM-only roller that rolls attacks, damage, saves and checks straight from the block; DM-typed numbers for module-only NPCs | 'Rules at hand' is the lens item every competitor beats us on; the SRD is open content so it does not touch the no-book-content rule (task #38). Click-to-roll from the block is the thing FGU/Shard/DDB DMs actually use; players keep their physical dice, but the DM runs six wolves and wants the bite rolled where the block is. | core | medium |
| Conditions, bloodied/down and concentration on tokens with optional round/turn expiry, visible to players as pips | At a physical table the shared screen is where players look for 'is it bloodied'; DDB Maps and FGU show it on the token. nextTurn already exists to expire durations. | strong | medium |
| DM's own notes on any key, object, token, NPC or pin, plus a free-text session notes pad, saved with the campaign | README promises it, only authored notes exist; annotating as the campaign diverges from the book is campaign tracking at its most basic, and a scratchpad for tonight is what a DM reaches for before any journal. | core | small |
| Legibility: north-up overhead, DM labels clear of the top bar, token tags in declutter, world-map name collisions | Correctness nits a DM notices in the first hour but none blocks play; grouped so V1 stays a bug-fix round. | strong | small |
| Fidelity backfill: 54 missing pages, Castle Ravenloft complete and described, E/E5/G/C/N1 descriptions, a test gating 'mapped' on page+desc+dm; mist wall and wilderness visuals | Completeness of the prepared content is the value proposition and the centrepiece castle is mostly undescribed and reads as a grey slab; Roll20 and DDB Maps ship 7-8 castle maps. Content work a CoS DM judges the product by; runs as a parallel authoring track. | core | large |
| Show-to-players on the Player Display and in Players mode: read-aloud captions, creature portraits with alias, revealed objects, a 'Send view' director camera and a DM pointer/ping drawn on the table screen | Reveal is the table's moment: Monster Reveals (DDB), Theatre (Owlbear), Show Players (Foundry). Our display can only mirror the DM camera, so the DM cannot look things up while players look at the room, and cannot point at the TV across the table (Owlbear/Foundry/Roll20 sync pointers and pings). The player wording already exists on every room, object and creature. | strong | medium |
| Snapshot and print: save the current view (DM or players' version) as PNG; print a north-up floor plan per level with grid and keys | The one thing every competitor can do that nobody in the roadmap carried over: a paper Death House plan for the table, a players'-view picture for a Discord channel, a handout made from the map itself. render-on-demand already draws to a canvas; a print stylesheet and toBlob are small. | strong | small |
| Split the party: detach a member token outside initiative with its own vision and movement, rejoin on contact | Death House sends the rogue upstairs in session one; one party token cannot model it, yet member tokens, per-token light and vision coverage already exist for initiative. Foundry/Owlbear/Roll20 give every token vision. Also the prerequisite for a seat owning 'their' token on a phone. | strong | medium |
| Handout library: DM-imported images and text (IndexedDB blobs, never bundled) shown on the table screen and linked to keys/pins | Every competitor with CoS can push a letter or portrait to the table; blobs stay on the device so no licensing issue. | strong | medium |
| Player Display and players' phones on any device on the same Wi-Fi: Transport interface behind Channel, optional one-file LAN relay riding the Vite dev/preview server, join by QR/code, view-only first then validated intents; HTTPS on the LAN so the PWA installs on the iPad and phones | At many tables the shared screen is a TV stick and players hold phones; BroadcastChannel cannot reach them. State is tiny and the players'-side rules already exist in App, so this is plumbing. Stays local, no accounts; a tunnel reaches remote players as a side effect. Service workers need a secure context, so plain http over the LAN is why the iPad has no offline cache today. | strong | large |
| Seats and three permissions (who may move the party, open doors, open containers; owner moves own member token in initiative) plus a thin phone player shell | Once several devices can act, 'the players' must become people, but the party-token model keeps permissions small. Needed before player phones may touch anything. | strong | medium |
| Session journal with clock-stamped auto entries, NPC tracker (status, location override), Tarokka reading record and special-events checklist, session plan | CoS is NPC- and event-driven over months of play; the reveal log and trail hold raw events without time or narrative, and the reading decides the campaign's shape. No card text or event text shipped, only the DM's own results and the manifests' stage keys. Journal lives in its own IndexedDB store so commit() stays small. | strong | medium |
| Random encounters by terrain and time from encounters.json spawn slots; rest semantics (Ravenloft rest-check prompt, journal entry) attached to the existing +1 h / +8 h clock buttons | Chapter 2 pacing is encounter-driven and the data exists but is never imported; rests are the most common time jump and the clock already has the two buttons, so rests are labels and prompts, not new controls. | strong | small |
| Toggleable and DM-dropped light sources as light tokens (Token.light already exists) feeding the vision model | core/light.ts and Token.light exist but only the party torch is dynamic; Ravenloft DMs light braziers every session in Foundry/Owlbear/Arkenforge. A new CampaignState.lights store would duplicate Token.light. | strong | medium |
| Open the DM's own PDF at the page (local file in IndexedDB, pdf.js bundled and precached, DM-only) | Turns every 'p.212' into the book page without shipping a word; the OCR pipeline already assumes the DM owns the PDF. Must be bundled, not loaded from a CDN, or the offline PWA promise breaks. | strong | medium |
| Area-of-effect templates (sphere, cone, line, cube in 5 ft cells) on square and hex, visible to players | The first thing a DM asks in the second fight (fireball, burning hands, dragon breath); every 2D VTT has them and core/range.ts already walks cells. | strong | small |
| Hex range overlays and hex movement budgets; SRD 5.2.1 (2024) stat-block variant | Coherence (the square overlay goes stale on hex today) but CoS is a square-grid module; the stale overlay is fixed in V1, parity later. The 2024 SRD doubles the data, so it waits for the lazy chunk. | optional | medium |
| Shared dice roller and map pings from players' phones | Physical dice are on the table, so only initiative-from-your-phone and a ping have table value once phones are connected; chat and whispers are not needed when everyone is in the room. | optional | medium |
| Weather FX (rain, snow, heavier mist) on outdoor maps from sky.ts, and a per-scene ambience slot (DM's own audio file on the Player Display) | FGU/Arkenforge/Menyr weather and Arkenforge's mixer are standouts, but most DMs run Syrinscape or Spotify already; hooks, not engines. | optional | medium |
| Internet-grade WebRTC transport with signalling/TURN, reconnect by sequence, state deltas, stream layout | Makes remote play one tap, but the lens is a physical table; the LAN relay through a tunnel is the ceiling for this roadmap and WebRTC is the riskiest piece (NAT, cellular, Safari). | optional | large |
| Full character sheets, built-in voice/video, chat, hosted server/accounts, plugin API, other game systems, shipping module text or art | Paper sheets and Discord are at the table; hosting contradicts the offline PWA; the book stays the book (tests/no-book-content.test.ts). Foundry and Owlbear own the platform space. | poor | large |

## V1: Night one works: the blocking and 'fix' bugs, Players mode sealed, phone usable, hidden things reachable from a list, undo for mis-taps, campaign safe to keep, and a performance baseline so nothing later breaks the maps

### Navigation fixes: stairs hop once, Enter from anything you tap, Ravenloft spawns at the entry

Extract the vertical hop from afterPartyMove into a pure linkHop() in core/movement.ts that takes at most one link per move and never re-triggers a link whose endpoint is the arrival cell; the object info card and hover tip in main.ts carry 'Enter <building>' whenever hit.room.enter is a built path (TapHit already carries room.enter from floorPoint); ensureDefaultToken prefers scene.entry, then a spawn object, then the entry level's first room; ch04/K scene.json gets entry = courtyard.

Acceptance:
- Death House Floor 1: clicking the '↑ Floor 2' marker or stepping on the spiral-stair cell lands the party on f2 (status 'Took the stairs → Floor 2'); from f3 down lands on f2; tests/movement.test.ts covers chained lk-spiral links within 5.5 ft and e2e/move.spec.ts covers both directions
- Playwright sweep: all 13 Vallaki keyed sites (N1-N9, N8a-d), Berez U3, Krezk S5-S9 and Village E1-E7 offer Enter from a tap on roof, wall or square in tabletop and overhead presets; Back returns to the town with the camera where it was; Players view shows the read-only card without Enter
- Fresh campaign on ch04/K: Floor dropdown shows the courtyard level as 'party here' and the party token is inside the opening camera frustum (e2e asserts project(party) within the viewport)

Files: `app/src/app.ts (afterPartyMove ~L497-515, takeLink ~L472, ensureDefaultToken ~L308-325, hover ~L1115, tap ~L1172)`, `app/src/core/movement.ts (linkHop)`, `app/src/main.ts (object info card ~L369-395, room tap menu ~L405-420)`, `locations/ch04/K/scene.json (entry)`, `tests/movement.test.ts`, `e2e/move.spec.ts`, `e2e/ui.spec.ts`

Risk: Low. Link-order dependence disappears; check Castle Ravenloft shafts and Old Bonegrinder stairs for authored links that relied on chaining.

### Players mode sealed, with a DM-return gesture

Floor dropdown, Section slider, Whole, Library, World map, Back and the View/Tools menus become .dm-only (or are not rendered) when app.view === 'players'; their keyboard shortcuts and '/' and 'n' are inert under app.restricted; the existing way out of Players mode stays but becomes deliberate (press-and-hold 1 s on the status strip or the ']' key held, documented in Help) so a player cannot leave it by accident while the DM on a keyboard still can; the Player Display window ignores all shortcuts. The turn bar resolves each combatant through its token and shows playerName for revealed creatures and omits hidden ones entirely on the players' side (DM bar unchanged). Unexplored walls and doors render fully transparent at fogCurve 1 instead of a dark massing (materials.ts fog branch for shell roles); explored memory look unchanged. The painted world map skips settlement/castle/camp symbols for unrevealed pins in Players view and on the Player Display. Help text and docs/SLIDER.md match.

Acceptance:
- Players view and the Player Display: dmOnlyVisible 0, no select.levels, .section, Library or World buttons; '/', 'n', '[' and the floor shortcuts do nothing; the hold gesture returns to DM view in e2e and a 200 ms tap does not; tests/player-safety.test.ts extended
- Hidden Wolf in initiative: players' turn bar and Player Display read 'Rogue 21 \| Fighter 10'; after Reveal, the alias ('A grey wolf 19') appears, never 'Wolf'
- Death House dungeon at t=0 with nothing revealed: fewer than 0.5% of pixels inside the dungeon's projected bounding box differ from the fog background colour by more than 12/255 in any channel (helper in e2e/helpers.ts); revealed rooms still show walls; the 16-combo grid-on-floor pixel suite and the DM t=0.5 screenshot are unchanged within the existing tolerance (e2e/slider.spec.ts)
- Players' world map with N and O revealed: sampling the base layer at the K, G and S symbol positions returns the parchment colour, the DM map does not

Files: `app/src/main.ts (buildDmUi topbar ~L60-75, refresh ~L230-275, showHelp ~L484)`, `app/src/styles.css (L91 .dm-only, body[data-view='players'] ~L175-176)`, `app/src/ui/encounter.ts (turnBar ~L85-95)`, `app/src/ui/viewSlider.ts (return gesture)`, `app/src/app.ts (applySlider ~L600-660, syncTokens, key handling)`, `app/src/render/materials.ts`, `app/src/render/build.ts`, `app/src/ui/worldmap.ts (paint ~L60)`, `docs/SLIDER.md`, `tests/player-safety.test.ts`, `e2e/slider.spec.ts`

Risk: Medium for the silhouette: the fog shader is shared with the DM slider curves; a regression shows as walls vanishing for the DM at t=0.5. Locking the DM out of their own screen is the other failure mode; the hold gesture is tested both ways.

### Phone layout: buttons tappable, menus on screen, sliders apart, tables that fit

Give '#ui > .mapframe' pointer-events: none at equal specificity (or move the frame under #stage) so the compass/scale bar never intercepts taps; menu panels become position: fixed with left/right 8px, max-width calc(100vw - 16px) and flip side when they would clip; below 820 px the Section control moves into the Floor row so it never overlaps the view slider; the initiative roster stacks card-per-row below 760 px; the cam cluster wraps with Help first; DPR cap 1.25 under 500 px width; add 'phone' (390x844) and 'phone-landscape' (844x390) Playwright projects alongside the existing 1024x768 chromium project.

Acceptance:
- 390x844: elementFromPoint at the centre of Zoom in/out, Find party, Follow and Help returns the button; Playwright taps Help and the sheet opens
- View and Tools panels have boundingBox.left >= 0 and right <= 390
- Section slider and view slider bounding boxes do not intersect on ch05/N2
- Initiative sheet has scrollWidth <= clientWidth at 390 px and every input is reachable by scrollIntoView + tap
- 844x390 screenshot completes with the top bar clear of the floor row; the 1024x768 desktop screenshots in slider.spec and grid.spec are unchanged within tolerance; Vallaki load time on the phone project is recorded in the perf baseline (not gated here)

Files: `app/src/styles.css (L25 #ui > *, L348 .mapframe, L360 .menu-panel, L166-176 media queries, roster)`, `app/src/main.ts (cam group, menus, section placement)`, `app/src/ui/encounter.ts (roster markup)`, `app/src/render/world.ts (DPR cap)`, `playwright.config.ts`, `e2e/ui.spec.ts`

Risk: Low-medium. CSS regressions on iPad landscape; the existing e2e grid/slider suites run on all three projects as the guard.

### Hidden things reachable without precision taps

The Rooms sheet lists under each room its secret doors, traps, hidden objects and hidden creature slots with eye buttons and Frame; DM labels for secret doors and hidden things become clickable (LabelSpec carries the target id; App.open wires the click to revealSecretDoor/toggleObject); the Reveal tool prefers a secret-door panel or hidden target within 1.5 ft of the hit point before accepting 'Wall' or 'Bookshelf', in DM view only.

Acceptance:
- Death House Floor 2 Rooms sheet shows 'Secret door behind the bookshelf' under 8 Library; its eye adds the secret-door reveal (state.reveals has f2-sdo-lib), persists across reload, and the party can pass once opened from the players' side
- Reveal tool tap within one cell of f2-sdo-lib from tabletop and overhead reveals it on the first try (e2e)
- Dungeon hidden chests and 'dungeon-centipedes' are revealable from the sheet and their cards open from the list; the reveal reaches the Player Display

Files: `app/src/main.ts (renderRooms ~L318-330)`, `app/src/app.ts (pick ~L928, tap reveal branch ~L1197-1226, revealSecretDoor ~L742, open)`, `app/src/render/build.ts (LabelSpec for secret doors ~L229, hidden objects ~L253, targets)`, `app/src/styles.css (.rooms)`, `e2e/slider.spec.ts`

Risk: Low. Pick priority could open a secret-door card when the DM aims at a bookshelf; restrict it to the Reveal tool and DM view.

### Undo for moves, doors and containers

Generalise the reveal-only undo (app.ts L789) into a bounded history of CampaignState snapshots per commit kind (move incl. level change, door, open/close, reveal); Undo button beside the tools and Cmd/Ctrl-Z; status line names what was undone ('Undid: party moved'); history never crosses a location change, is capped at 50 and is not persisted.

Acceptance:
- Mis-tap the party across the map and through a stair, Undo: back to the previous cell and level, camera follows, the Player Display follows
- Undo a locked-door toggle and a container open; reveal undo behaves exactly as before (existing tests unchanged); 51 moves keep only the last 50 (tests/containers.test.ts and a new tests/undo.test.ts)

Files: `app/src/app.ts (commit, undo ~L789)`, `app/src/state/campaign.ts`, `app/src/main.ts (keyboard, button)`, `tests/containers.test.ts`, `tests/undo.test.ts (new)`

Risk: Low.

### Encounter nits: stale hex overlay, diagonal rule UI, walls button on stacked sites

layoutChanged calls refreshRange so a grid change clears the stale square overlay (status 'Ranges need the square grid' until hex parity in V5); View menu gets a Diagonals 5-5-5 / 5-10-5 control backed by the existing localStorage key; Walls low/full is aria-disabled with a tooltip on stacked sites and the changelog corrected. (North-up overhead, label clipping and world-map collisions move to V2 'Legibility' so V1 stays a bug round.)

Acceptance:
- Start an encounter, switch to Hex: rangeMesh undefined, no squares drawn (e2e/grid.spec.ts)
- Measure a 3-cell diagonal: 15 ft; toggle in the View menu: 20 ft; persists across reload (tests/grid.test.ts)
- N2 stacked: Walls button has aria-disabled and a title; on Death House it still toggles (existing screenshot 71 unchanged)

Files: `app/src/app.ts (layoutChanged ~L1254, refreshRange ~L408, diagonal read ~L961)`, `app/src/main.ts (View menu, refresh ~L257)`, `app/src/core/grid.ts`, `docs/CHANGELOG.md`, `e2e/grid.spec.ts`, `tests/grid.test.ts`

Risk: Low.

### Campaign safety: persistent storage and export/import

Request navigator.storage.persist() on first commit and show the result in Help; the Library sheet gains a Campaign section with Export (JSON download of CampaignState + scene path + schema version), Import (file picker, validated, replaces after confirm) and the existing Reset; works offline and across campaigns (cos/wsc).

Acceptance:
- Export on desktop, import on a fresh profile or a phone private window: reveals, doors, opened, tokens, roster, clock, world position deep-equal (tests with fake-indexeddb)
- Help sheet shows 'Storage: persistent' or a warning with the install-as-app hint
- Import of a malformed file or a wsc export while cos is active is handled: refused with a message, or switches campaign correctly; state otherwise untouched

Files: `app/src/state/idb.ts`, `app/src/state/campaign.ts (serialize/deserialize, schema version)`, `app/src/ui/library.ts`, `app/src/main.ts (help sheet)`, `tests/campaign-io.test.ts (new)`

Risk: Low. iOS Safari may deny persist() silently; the warning path is the mitigation.

### Performance baseline and regression guard

e2e/perf.spec.ts opens every built location on the desktop and phone projects and records load-to-first-frame, renderer.info.render.calls and triangles, writing e2e/perf-baseline.json on demand (npm run perf:baseline) and failing when a scene regresses more than 20% in calls/triangles or 30% in load time against the committed baseline; docs/PIPELINE.md budget is rewritten to the measured tiers (small site, town, castle) so later acceptance criteria can cite it honestly.

Acceptance:
- perf-baseline.json committed with 44 rows; a deliberate 30% draw-call bump on Death House (test fixture) fails the spec; the unchanged tree passes on both projects
- docs/PIPELINE.md lists the per-tier budget and names the three scenes over it today (Vallaki, Abbey, Amber Temple) as known debt

Files: `e2e/perf.spec.ts (new)`, `e2e/perf-baseline.json (new)`, `e2e/helpers.ts`, `package.json (perf:baseline script)`, `docs/PIPELINE.md`

Risk: Low. SwiftShader timings are noisy; load time uses a 30% band and three-run median.

QA for this version:
- DM, desktop: fresh campaign, open ch04/K and confirm the party stands in the courtyard; open appB/death-house, take the Floor 1 spiral stair (lands on Floor 2), go down again, through the trapdoor; mis-tap the party and Undo; reveal the library secret door from the Rooms sheet, then with the Reveal tool from overhead; undo; reload and confirm persistence
- DM, desktop and iPad: open ch05/N, tap roof, wall and square of each of N1-N9 and N8a-d and Enter; Back each time; repeat on Krezk S and Berez U; switch to Hex mid-encounter and back; measure diagonals under both rules; try the Walls button on N2 and read the tooltip
- Players, desktop (Players mode and the Player Display window): confirm no Floor, Section, Library or World map controls and inert shortcuts; try to leave Players mode with a tap (stays) and with the hold gesture (returns); dungeon at t=0 shows no wall massing and walls appear as rooms are revealed; start initiative with a hidden Wolf and read the turn bar (no name until Reveal, then the alias); players' world map shows symbols only for revealed places
- DM, phone 390x844 and 844x390: tap Help, Zoom in/out, Find party, Follow, Undo; open View and Tools menus and read every row; move the Section slider on N2 without touching the view slider; open Initiative and edit a speed
- Players, phone 390x844: Players mode shows only the map, turn bar, status and read-only cards; pinch, pan, pick up and walk the party; try a locked door (refused) and a wall ('No way through'); tap a revealed creature for its card
- DM, desktop then phone: Export campaign, Reset, Import on the phone, confirm reveals, doors, clock and world position are back; Help shows storage status; run the perf spec and read the baseline


## V2: The keyed area is the unit of play: an area panel that gathers everything the book keys to the room, encounters that start from it, SRD numbers with a DM roller, conditions, the DM's own notes, pages complete, labels legible

### Area panel

A dm-only panel (right drawer on desktop, bottom sheet on phone; new ui/areaPanel.ts) opened from a key label, the Rooms sheet, '/' search or when the party enters a room: key, name, page, level, player description, authored DM note, your note (below), then sections Creatures here (slots with DM label and alias, Wake/Stage buttons), Secrets (secret doors, traps, hidden objects with eyes), Containers (open/locked, contents), Doors, Links (stairs with destination), NPCs tagged to this key in characters.json with Place beside party and stat buttons, neighbouring keys. Every row has Frame and Reveal/Hide. The room tap menu shrinks to its actions (Reveal/Move party/Frame/Enter/Open panel) so description text lives in one place; a Rooms sheet row expands into the panel. Follows the party when follow is on, debounced to one rebuild per move; pinnable; mutually exclusive with the Rooms aside and the token panel.

Acceptance:
- Death House '8 Library': panel shows '8 Library p.213', the secret door, the bookshelf, the desk with its iron key, each with Frame/Reveal; no book prose (no-book-content test runs over the rendered panel text)
- Blue Water Inn N2f: panel lists the slot creatures and the NPCs tagged N2f from characters.json; ch03/E4 lists Ireena and Ismark with Place beside party
- Players view and Player Display never render it (e2e); at 390 px it is a swipe-up sheet and the map still pans with it collapsed; Esc closes it; walking 1A -> 1B -> 2A in one second causes at most 3 panel renders (counter exposed on app for e2e)

Files: `app/src/ui/areaPanel.ts (new)`, `app/src/main.ts (open from renderRooms, finder, onTap, room tap menu ~L405-420, afterPartyMove hook)`, `app/src/app.ts (roomAt, isRevealed, toggleObject, revealSecretDoor, containerOf; new roomInventory(key))`, `app/src/bestiary.ts (byTag(key))`, `app/src/styles.css`, `e2e/ui.spec.ts`, `tests/player-safety.test.ts`

Risk: Medium. Screen real estate on iPad portrait and competition with the Rooms sheet; the panel must collapse to a strip. Depends on V1's hidden-things data.

### Wake creature slots into live tokens; Stage keyed creatures; Start encounter here

A hidden-creature SceneObject whose kind (or new schema field creature, with optional count) resolves to a characters.json id gets Wake in its card and the area panel: creates Tokens at the slot (role creature, hidden, playerName alias, hp from STATS, sheet via creatureSheet) and marks the slot consumed in CampaignState.woken so it stops rendering as scenery. 'Stage keyed creatures' places every characters.json entry tagged to the key as hidden tokens (idempotent). 'Start encounter here' wakes/stages the room, rolls initiative for them and the ticked PCs and opens the turn bar; a staged group can be revealed together. Authoring scripts add creature ids and counts to the 123 slots whose kind is not a character id and regenerate scenes; a golden-diff test asserts the regenerated scene.json files differ from the committed ones only in the new creature/count fields.

Acceptance:
- Death House 38: the shadows slot with count wakes as that many tokens with SRD hp each; woken slots no longer draw as scenery; reload keeps tokens and consumed slots
- ch03/E4 Stage: Ireena and Ismark appear hidden with aliases; staging twice does not duplicate; Reveal all shows them
- Blue Water Inn attic 'Start encounter here' puts the slot creatures in initiative under their aliases on the players' side
- tests/manifests.test.ts: every hidden-creature slot resolves to a characters.json id or carries creature; scripts/scene-diff.ts reports zero differences outside objects[].creature and objects[].count for all 44 scenes; perf.spec baseline unchanged

Files: `app/src/core/schema.ts (SceneObject.creature, count)`, `app/src/state/campaign.ts (woken)`, `app/src/app.ts (wakeSlot, stageKey, startEncounterHere, placeCreature, syncTokens skip consumed slots, applySlider)`, `app/src/ui/encounter.ts`, `app/src/ui/areaPanel.ts`, `app/src/bestiary.ts (byTag)`, `scripts/authoring/*.py and locations/**/scene.json (regenerated)`, `scripts/scene-diff.ts (new)`, `manifests/characters.json (tag audit)`, `tests/manifests.test.ts`, `tests/bestiary.test.ts`

Risk: Medium. Regenerating 44 scenes from scripts is the biggest risk to the existing maps in the whole roadmap; the golden diff and the perf baseline are the gates. Tag coverage in characters.json is uneven.

### SRD stat blocks, condition glossary and a DM roller (CC-BY-4.0)

Generate manifests/srd-creatures.json from SRD 5.1 data for the ids already in STATS, with ATTRIBUTION.md and an attribution line in Help; manifests/srd-rules.json holds conditions, cover, light, exhaustion, concentration and vision in SRD wording; both load as a lazy chunk on first use so the app shell's first paint is unchanged. Bestiary rows, the token panel and the area panel open a stat-block drawer (abilities, saves, skills, senses, traits, actions with to-hit and damage); terms in DM notes and blocks get hover/tap tooltips. core/dice.ts (pure, unit-tested: NdM+K, advantage, crit doubling) backs a DM-only roller: every to-hit, damage, save and check in a block is a button that rolls into a DM-only status line with the breakdown ('Bite 1d20+4 = 17 hit · 2d4+2 = 7'), and the initiative sheet's private d20 moves onto it. Nothing rolled reaches the players' side in this version. Module-only NPCs stay number-free with DM-editable AC/HP/speed fields persisted in CampaignState.statOverrides. The seed script refuses non-SRD ids.

Acceptance:
- Tap a placed Ghoul: drawer shows the SRD block incl. CR and XP; Wolf shows Bite, Pack Tactics, Keen Hearing and Smell; tapping Bite rolls and the status line shows the breakdown; tests/dice.test.ts covers parsing, advantage and crits with a seeded RNG
- Hover 'Perception' or 'Paralyzed' in a DM note or stat block: tooltip with the SRD definition
- tests/no-book-content.test.ts still passes; a new test asserts every srd id maps to a STATS/characters.json creature and that ATTRIBUTION.md exists; Strahd shows empty fields the DM fills, persisted and exported; tests/player-safety covers the roll status line
- Block fits a 390 px phone as a scrollable bottom sheet; the SRD chunk is under 350 KB gzipped and absent from the initial bundle (vite build output asserted in a test)

Files: `manifests/srd-creatures.json (new, generated)`, `manifests/srd-rules.json (new)`, `manifests/ATTRIBUTION.md (new)`, `scripts/seed/srd.mjs (new)`, `app/src/core/dice.ts (new)`, `app/src/bestiary.ts (STATS -> statBlockOf)`, `app/src/ui/bestiary.ts`, `app/src/ui/statblock.ts (new)`, `app/src/ui/encounter.ts (d20 -> core/dice)`, `app/src/main.ts (token panel, tooltip wiring, help attribution)`, `app/src/ui/areaPanel.ts`, `app/src/state/campaign.ts (statOverrides)`, `tests/bestiary.test.ts`, `tests/dice.test.ts (new)`, `tests/no-book-content.test.ts`

Risk: Medium. Licence hygiene (SRD 5.1 text only, attribution); bundle size for offline first load, mitigated by the lazy chunk. SRD 5.2.1 variant deferred to V5.

### Conditions, bloodied/down and concentration on tokens

Token gains conditions: {id, until?: {round, turnOf}}[] and concentration?: string; a condition picker on the token panel; pips on token labels in both views for revealed tokens (never for hidden ones), included in V1's declutter as kind 'token'; auto bloodied at half HP and a flat/greyed 'down' state at 0 on the players' side; member tokens gain optional hp so a PC can be marked down; nextTurn expires conditions whose until matches; the turn bar lists the current combatant's conditions; End encounter clears only on confirm.

Acceptance:
- Apply Paralyzed and Prone to a Ghoul: two pips on the token in DM and Players views, listed in the turn bar on its turn; pip glyph box at least 10x10 CSS px on the phone project
- Set HP 10/22: bloodied marker; 0: token lies flat/greyed on the players' side, still hidden if hidden
- 'Frightened until end of Rogue's next turn' on the Wolf disappears exactly when that turn ends on the DM screen and the Player Display; conditions persist across reload; 12 tokens with pips beside keys produce no overlapping .lbl boxes

Files: `app/src/state/campaign.ts (Token)`, `app/src/app.ts (syncTokens ~L519-560, setHp, nextTurn, declutter ~L672)`, `app/src/main.ts (token panel)`, `app/src/ui/encounter.ts (turnBar)`, `app/src/ui/icons.ts`, `app/src/styles.css (.lbl.token pips)`, `tests/movement.test.ts`

Risk: Low. Label clutter in crowded fights; declutter is the mitigation.

### DM notes on anything, and a session notes pad

CampaignState.notes keyed by campaign/location/key\|objectId\|npcId\|pin plus a 'session' key for free text; an editable note field in the area panel, room tap menu, info card, token panel and world-pin card, shown beside the authored DM note with an 'added by you' tag and in the hover tip as 'Your note'; a Notes button in the top bar opens the session pad (plain textarea, autosaved, DM-only); never written to scene.json; the tap menu must not close on pointerdown inside the textarea.

Acceptance:
- Type a note on Death House room 8, reload: present in the panel, the Rooms sheet row and the hover tip; never in Players view or on the Player Display
- Note on world pin K shows in the pin tooltip for the DM only; notes are independent per campaign (cos/wsc); the session pad keeps 10 KB of text across reload and export
- Export/import carries notes; tests/player-safety.test.ts covers the notes paths

Files: `app/src/state/campaign.ts (notes)`, `app/src/ui/areaPanel.ts`, `app/src/ui/notes.ts (new, session pad)`, `app/src/main.ts (tapmenu roomhead, info card, token panel, renderRooms, top bar)`, `app/src/ui/worldmap.ts (pin card)`, `app/src/app.ts (hover)`, `tests/player-safety.test.ts`

Risk: Low.

### Legibility: north-up overhead, labels clear of the top bar, token tags decluttered, world names uncollided

The overhead preset rotates to level.north; declutter reserves the top bar band and includes token name tags (label kind 'token'); the world-map names layer offsets or hides the lower-priority label of a colliding pair and the party marker clears the Castle Ravenloft label; changelog corrected.

Acceptance:
- Death House overhead: compass within 2 degrees of 0; iso snap still correct on Vallaki and the castle (existing screenshots within tolerance)
- Labels=all on Death House Floor 2: no .lbl box intersects .topbar; a Wolf placed beside key 8 never overlaps the key pill
- Default zoom at 1366x768 and 1024x768: zero intersecting .wm-name boxes on both world maps, 'The Tavern' clear of 'The Street'

Files: `app/src/app.ts (declutter ~L672, labelDensity ~L660)`, `app/src/render/world.ts (setPreset/frame ~L167-207)`, `app/src/ui/worldmap.ts (.wm-names layout)`, `docs/CHANGELOG.md`, `e2e/ui.spec.ts`

Risk: Low. North-up changes the iso snap on maps with north = -x; verify the compass on Death House, Vallaki and the castle.

### Page references complete and a fidelity report

Run the OCR cross-check for the 54 page:null keys (Q4-Q53 set, N3 letters, N4, N2, K10/K31a/K31b, S2, S12, W10/W11, Z1, Death House 37, D, M) and fill manifests/locations.json; rooms inherit pages into scene.json; extend scripts/manifest-report.ts with a coverage section (page/desc/dm percentages per location, and the reconciled count of Castle K keys in the manifest versus rooms in the scene) that V4's castle work is measured against.

Acceptance:
- No area key in a built location has page:null (new assertion in tests/manifests.test.ts); Argynvostholt Rooms sheet shows a page on every row
- manifest-report.md 'coverage' lists desc/dm/page percentages per location, names rooms without desc, and states one authoritative K key count

Files: `manifests/locations.json`, `scripts/manifest-report.ts`, `scripts/authoring/argynvostholt.py, vallaki-sites.py, castle-ravenloft.py (page fields)`, `tests/manifests.test.ts`

Risk: Low. A few Q headings may be unreadable by OCR and need the DM's page lookup by hand.

QA for this version:
- DM, desktop: '/ ritual' opens the area panel for 38 (altar, slot creatures, p. ref); Start encounter here fills the turn bar; roll the shadows' Strength Drain from the block; apply conditions and set HP to bloodied and 0; End folds back; walk 1 -> 8, watch the panel follow, open the desk, reveal the secret door from the panel, write a note; reload
- DM, desktop: place a Ghoul and a Wolf, read both SRD blocks, roll Bite with advantage, hover a condition term; edit Strahd's AC; open Argynvostholt and confirm a page on every Rooms row; open the session pad and type tonight's plan
- Players, desktop and Player Display: a woken hidden creature is invisible; after Reveal it shows its alias and 'seen as' text; pips, bloodied and down states visible; no panel, notes, stat blocks, roll results or page buttons anywhere on the players' side
- DM, phone: area panel as a bottom sheet; Wake one creature; apply a condition from the token panel; add a note with the on-screen keyboard without the menu closing; read a stat block and roll from it in the bottom sheet
- Players, phone: move the party into a room; only the room card appears; pips legible at arm's length
- Regression: Death House and Vallaki e2e suites on desktop and both phone projects; perf baseline unchanged after scene regeneration; manifests fidelity report generated


## V3: The table screen tells the story, on any screen on the table: show cards, read-aloud, portraits and a DM pointer, a director camera, handouts, snapshots and printed plans, a split party, and the Player Display on a second device over the same Wi-Fi

### Show-to-players: read-aloud, portraits, revealed objects, director camera and DM pointer

Rooms get 'Read to the table' (the original player description as a lower-third caption), creature tokens 'Show what they see' (figure rendered large via an offscreen three.js target + alias + 'seen as' text, fallback to the base-ring chip if context creation fails), revealed objects 'Show'; sent as a channel message kind 'show' and drawn as a dismissable overlay on the Player Display and in Players mode; DM has Clear; the card survives a display reload while held; hidden creatures and dm-only text can never be sent (button absent, message validated). Beside the camera lock, 'Send view' pushes the DM's current camera, level and location to the display once without lock and 'Frame for players' on rooms frames that room on the display; the display's camera stays put until the next send or lock; location changes still follow. A Pointer tool (hold on the DM map) sends a 'ping' message that draws a fading ring at that world point on every display for 2 s, in the players' view only if the point is in a revealed room.

Acceptance:
- Show the Ghoul: Player Display shows the figure, 'A shambling corpse' and its description; DM screen unaffected; Clear removes it
- Read room 1B: caption on the display and as a lower-third in Players mode for 20 s or until the DM dismisses; a player tap does not dismiss it
- Lock off, DM frames room 8, Send view: display shows room 8; DM pans to the dungeon: display unchanged; level changes on the display only when sent or locked; Send view reachable in the phone cam group
- Hold on the desk in room 8: a ring appears on the display at the desk's projected position within 100 ms of the message; a ping in an unrevealed room draws nothing there
- tests/player-safety.test.ts: no code path can put dm text, a hidden creature, a real name or an unrevealed position into a show or ping message

Files: `app/src/state/channel.ts (Msg 'show', 'ping', camera send-once)`, `app/src/main.ts (player-mode overlay, DM actions on cards and in the area panel, cam group, room menu)`, `app/src/ui/showcard.ts (new)`, `app/src/app.ts (renderPortrait, broadcast ~L1251, camera message handling ~L1282, pointer tool)`, `app/src/render/world.ts (frame animate, ping ring)`, `app/src/kit/creatures.ts`, `app/src/styles.css`, `tests/player-safety.test.ts`

Risk: Medium. A second WebGL context for the portrait on iPad Safari; the sprite fallback is the mitigation.

### Snapshot and print

View menu gains 'Save picture' (render-on-demand draws one frame to a canvas and downloads a PNG of the current camera, as the DM sees it or as the players would at t=0, labels composited from the DOM) and 'Print floor plan' (opens a print sheet: overhead north-up render of the chosen level or all levels, grid, key pills, scale bar and page refs, title with location and chapter, @media print CSS, letter and A4); both DM-only; the players' version respects reveals.

Acceptance:
- Save picture (players' version) on Death House Floor 1 with room 1A revealed: downloaded PNG dimensions equal the canvas, pixels over unrevealed room 3 match the fog colour, no DM note text in the composite (Playwright download + pixel check)
- Print floor plan for all Death House levels: the print sheet has one page section per level, page.emulateMedia('print') screenshot shows keys and grid, no UI chrome; on Krezk (open stack) the plan uses the Whole cut
- Buttons absent in Players view and on displays

Files: `app/src/render/world.ts (snapshot render, preserveDrawingBuffer only for the frame)`, `app/src/ui/print.ts (new)`, `app/src/main.ts (View menu)`, `app/src/styles.css (@media print)`, `e2e/ui.spec.ts`

Risk: Low. iOS Safari download handling (use a share-sheet fallback via navigator.share where available).

### Split the party: a scout with their own vision

From the roster or a member of the party, 'Scout' detaches a member token outside initiative at the party's cell with the sheet's darkvision and an optional carried light (Token.light); it moves under the same players'-side rules as the party; vision coverage is the union of the party's and every detached member's sources on the current level, explored memory grows from both; camera follow targets the last-moved token; 'Rejoin' when adjacent or by button folds the member back; starting initiative keeps detached members where they stand.

Acceptance:
- Detach the Rogue on Death House Floor 1, walk it up the stairs to Floor 2: Floor 2 rooms it enters become explored while the party's Floor 1 view is unchanged; players' side sees the Rogue's token and vision; Rejoin from Floor 2 is refused until adjacent
- tests/coverage.test.ts: union of two sources covers what either alone covers and nothing more; vision.test.ts: darkvision-only scout explores dim cells; perf baseline on Vallaki with two sources within 20%
- Start encounter with a detached Rogue: its member token keeps its cell; End returns it to the party only if it was not detached before

Files: `app/src/state/campaign.ts (Token.role 'member' outside encounter, detached flag)`, `app/src/app.ts (detach/rejoin, coverage union, follow target, startEncounter/endEncounter)`, `app/src/core/coverage.ts`, `app/src/core/light.ts`, `app/src/main.ts (roster/token panel actions)`, `tests/coverage.test.ts`, `tests/vision.test.ts`, `e2e/move.spec.ts`

Risk: Medium. Coverage today assumes one source; the union path must be cached per level (Vallaki already debounces). Encounter start/end logic has the most edge cases.

### Handout library

DM imports images (JPG/PNG/WebP, downscaled to 1600 px) or writes text handouts; blobs in a new IndexedDB 'blobs' store (DB version 2), metadata in CampaignState.handouts with optional key/pin/npc links; a Handouts sheet with Show/Hide/Pin to key; the area panel lists handouts linked to the key; revealed pin-linked handouts show as an icon on the players' world map; export includes handouts as base64 behind a size warning.

Acceptance:
- Import a 3 MB PNG, link it to E4, reload offline: listed and loads from IndexedDB; Show displays it full-screen on the Player Display until Hide while the DM screen shows a 'Showing to players' chip
- In Players mode (one screen) Show opens the same view; pinch-zoom on the image does not move the map; only the DM dismisses
- Reveal a letter linked to G: players' world map shows an icon at G that opens it; export/import round-trips handouts

Files: `app/src/state/idb.ts (version 2, blobs store)`, `app/src/state/campaign.ts (handouts)`, `app/src/ui/handouts.ts (new)`, `app/src/state/channel.ts`, `app/src/main.ts`, `app/src/ui/worldmap.ts`, `app/src/ui/areaPanel.ts`, `app/src/styles.css`

Risk: Medium. Safari IndexedDB blob quotas; test on iPadOS Safari.

### Player Display on any device on the same Wi-Fi (view-only), served over HTTPS

Replace the 17-line channel.ts with a Transport interface (send, onMessage, peers, close) and two implementations: local (BroadcastChannel, unchanged) and relay (WebSocket). scripts/relay.mjs is a ~80-line Node 'ws' room relay (rooms by code, single host, fan-out, 1 MB cap, logs only room codes) and a Vite plugin mounts it on the dev and preview servers so the LAN serve the DM already uses carries it; the preview server gains an optional self-signed certificate (@vitejs/plugin-basic-ssl, dev-only) so the iPad, TV browser and phones get a secure context, the service worker registers and the PWA installs over the LAN. Messages gain seq and room; welcome carries full state + location + level + layout; clients ignore stale seq. A Session sheet shows the room code, join URL and an inline QR; ?display=player&join=CODE opens a view-only display on a TV browser or a player's phone; 'show', 'ping', camera and handout messages flow over it (handout blobs chunked at 16 KiB, hash-checked); a 'DM disconnected' banner keeps the last state and resumes without reload. docs/REMOTE.md documents the LAN flow, the certificate step on iOS, and the tunnel option for a remote guest.

Acceptance:
- With 'npm run preview', a TV browser and a phone on the LAN open the join URL and receive welcome + state, render the same location and level, follow moves, reveals, floor changes, show cards, pings and handouts; e2e/display.spec.ts records the welcome and move round-trip times in the perf baseline and fails only above 2 s
- Closing the DM tab shows the banner on every display; reopening with the same code resumes them without reload; the relay refuses a second host and over-cap messages (unit tests against the relay with two ws clients)
- Existing slider.spec Player Display tests pass unchanged on the local transport; display.spec runs DM and display pages in separate browser contexts through the preview relay; the Session sheet lists peers
- Over the https preview, navigator.serviceWorker.controller is non-null on the display page; the display still renders after the server's Wi-Fi is cut, from the SW cache, and reconnects when it returns

Files: `app/src/state/channel.ts (-> transport facade)`, `app/src/state/transport.ts, transport/local.ts, transport/relay.ts (new)`, `scripts/relay.mjs (new)`, `vite.config.ts (configureServer/configurePreviewServer, basic-ssl)`, `app/src/ui/session.ts (new, QR encoder inline)`, `app/src/main.ts (View menu: Pair a display; ?join handling)`, `app/src/app.ts (hello/state resend, seq)`, `package.json (ws, @vitejs/plugin-basic-ssl, dev-only)`, `docs/REMOTE.md (new)`, `e2e/display.spec.ts (new)`, `tests/relay.test.ts (new)`

Risk: Medium-high. First runtime dependencies beyond three (ws and basic-ssl, dev-only) and a server process the DM must run; the self-signed certificate must be trusted once per device on iOS; keep BroadcastChannel the default and the relay opt-in. Full-state messages grow with woken tokens and handout metadata; the journal (V4) must not ride on them.

QA for this version:
- DM, desktop + Player Display popup: Send view of room 8, then pan the DM camera elsewhere; Show the Ghoul; Read 1B aloud; hold to ping the desk; Clear; lock the camera and confirm follow resumes; Save picture in both versions and print the Death House plan
- DM, laptop running the https preview relay, iPad as the DM screen over LAN: trust the certificate once, install the PWA on the iPad, create a session, open the display join link on a TV browser, scan the QR with a phone; move the party, open doors, reveal rooms, change floor on N2, show a handout, ping: all screens agree; close the DM tab, see the banner, reopen and resume; pull the Wi-Fi and reconnect
- DM, desktop: detach the Rogue in Death House, send it upstairs with a torch, watch two vision pools on the Player Display; start initiative with the Rogue upstairs; End; Rejoin
- Players, desktop (Players mode on the DM screen) and the TV display: a show card is visible, dismissable by the DM only, never carries DM-only text; handout full-screen; pings only in revealed rooms; nothing but map, turn bar, cards and captions
- DM, phone: import a photo from the camera roll as a handout, link it to E4, Show it in Players mode; Send view and Show players from the token panel; Save picture via the share sheet
- Players, phone as a view-only display (?display=player&join=CODE): follows the DM, shows captions and handouts legibly in portrait, pinch on the handout does not pan the map; airplane mode then back resumes
- Offline: hotspot with no internet, reload the display from the SW cache and show a stored handout; Playwright display.spec in CI with two contexts; perf baseline unchanged


## V4: Prep, pacing and campaign memory: tonight's plan, a clock-stamped journal in its own store, NPC tracker, the Tarokka record and events, random encounters and rests on the existing clock buttons, and Castle Ravenloft finished as a parallel authoring track

### Session plan

A 'Tonight' list in the Library and a compact plan strip in the top bar (collapses to a chip on phones): ordered entries of location + optional area key + one-line DM note, added from Library rows, Rooms sheet, pin cards or the area panel; one tap opens the scene and frames the key; check mark when done; saved in CampaignState.plan; the V2 session pad is reachable from the strip.

Acceptance:
- Add 'ch05/N2 N2a' and 'ch06/O O1', jump between them in under 2 taps each; done marks persist
- Plan hidden in Players view and on every display; persists and exports

Files: `app/src/ui/plan.ts (new)`, `app/src/ui/library.ts`, `app/src/state/campaign.ts (plan)`, `app/src/main.ts`, `app/src/styles.css`

Risk: Low.

### Session journal

Journal entries {at: campaign day/hour, wall: Date, location, level, key?, kind, text} live in their own IndexedDB store (DB version 3) keyed by campaign, appended per event, so CampaignState and relay state messages stay small; pure builders in core/journal.ts; auto entries for room first explored, door opened, container opened, secret door revealed, creature revealed or down, encounter start/end with rounds, world move with miles and time, travel/rest clock advances, handout or card shown; free text and an 'end session' marker; repeats within a minute coalesced. Journal sheet grouped by campaign day with filters by location and kind, rendering only the visible window; tapping an entry frames the key; the world trail dots open their entry for the DM; export includes the journal.

Acceptance:
- Walk 1A -> 1B -> 2A and open the desk: four entries stamped 'Day 1, 18:00' in order; travel 12 mi difficult: 'Village of Barovia -> Tser Pool, 8 h' plus the clock entry
- End session splits Day 1 from Day 2; with 1000 entries the sheet holds fewer than 80 .entry elements in the DOM and the serialised CampaignState is unchanged in size; never shown in Players view or on displays; relay state messages carry no journal
- tests/journal.test.ts covers builders, grouping and coalescing; campaign-io.test.ts covers export/import of the journal store

Files: `app/src/state/idb.ts (version 3, journal store)`, `app/src/core/journal.ts (new)`, `app/src/app.ts (hooks in afterPartyMove, toggleDoor, toggleOpen, revealSecretDoor, toggleObject, startEncounter/endEncounter, moveWorld, setClock)`, `app/src/ui/journal.ts (new)`, `app/src/ui/worldmap.ts (trail taps)`, `app/src/main.ts`, `tests/journal.test.ts (new)`, `tests/campaign-io.test.ts`

Risk: Low-medium. A second store means two writes per commit for journal-producing events; batch within one transaction.

### NPC tracker

An NPCs tab in the bestiary sheet listing characters.json npcs with status (unmet/met/ally/hostile/dead), current location override (pin or key), attitude note and 'last seen' from the journal; stored in CampaignState.npcs. Status drives the alias (met => real name shown to players), the area panel ('Ismark, met, ally'; dead slots struck through) and world pin cards ('Ireena is here').

Acceptance:
- Mark Ireena met: her token card shows 'Ireena Kolyana' to players instead of 'A stranger'; mark Kolyan dead: his E4 slot is struck through and a journal entry is recorded
- Move Ireena to N1: the N1 area panel lists her, E4 no longer does; export includes npcs

Files: `app/src/state/campaign.ts (npcs)`, `app/src/bestiary.ts (aliasFor reads status)`, `app/src/ui/bestiary.ts`, `app/src/ui/areaPanel.ts`, `app/src/ui/worldmap.ts`, `manifests/characters.json (role defaults)`

Risk: Low.

### Tarokka reading record and special-events checklist

A Reading sheet with five slots (three treasures, the ally, Strahd's whereabouts) where the DM picks a location/area key or NPC id after their own draw; stored in CampaignState.tarokka; DM-only markers on the world map, in the Library and in the area panel of the chosen keys. Events checklist from encounters.json specialEvents (name, stage key, page) with done/pending, 'Go to stage' framing and a journal entry when ticked. No card names, meanings or the card-to-location table are shipped.

Acceptance:
- Choose 'Tome: K37' and 'Ally: Ezmerelda': DM-only markers at K and the ally's current location; players' map and displays show nothing
- Tick 'St. Andral's Feast' done: journal entry on the current day; the checklist shows the 22 events with pages where known
- tests/no-book-content plus a grep test confirm no Tarokka card text; exports with the campaign

Files: `app/src/ui/reading.ts (new)`, `app/src/state/campaign.ts (tarokka, events)`, `app/src/campaigns.ts (import encounters.json)`, `app/src/ui/worldmap.ts (dm markers)`, `app/src/ui/library.ts`, `manifests/encounters.json (pages for events)`, `tests/manifests.test.ts`

Risk: Low. Scope creep toward the deck itself is the only risk; keep wording generic.

### Random encounters, and rests on the clock buttons that already exist

The clock panel's existing +1 h and +8 h buttons gain rest semantics instead of new controls: each offers 'as a short/long rest' which writes a journal entry, and on scenes with restCheckMinutes (Ravenloft) prompts with the checks due and rolls them with core/dice.ts; long rest relights outdoor maps as today. core/encounters.ts (pure, unit-tested) picks a terrain set from encounters.json by scene floor materials and day/night and rolls a creature from its spawnSlots; 'Roll an encounter' on the world map (cover under the party and the clock), on outdoor maps (places hidden at a chosen distance along the road) and once per travel segment; result card offers Place at the party / stat block / open the nearest wilderness map; re-roll or dismiss; journal records rolls. The three d-tables keep rows: [] unless the DM enters rows in a local-only editor.

Acceptance:
- +8 h as a long rest at 22:00 -> 06:00 next day, moon and lighting update, displays follow, journal entry 'Long rest'; +1 h as a short rest in ch04/K shows and rolls the Ravenloft checks as a DM-only status; the plain +1 h / +8 h still work exactly as before (existing clock tests unchanged)
- Party in forest at night on the world map, Roll: a creature from forest-road-night with a count; Place puts hidden tokens at the party on the current battle map or offers the nearest wilderness map; on ch02/C the helper places it 60 ft down the road hidden
- tests: every spawnSlot id resolves to characters.json; travel.test.ts covers one check per segment; manifests test asserts table rows stay empty in the repo

Files: `manifests/encounters.json (terrain -> scene mapping, restCheckMinutes)`, `app/src/core/encounters.ts (new)`, `app/src/core/dice.ts`, `app/src/core/travel.ts`, `app/src/core/sky.ts`, `app/src/ui/worldmap.ts`, `app/src/main.ts (clock panel ~L180-200)`, `app/src/app.ts (addCreature at a road point)`, `tests/encounters.test.ts (new)`, `tests/travel.test.ts`, `tests/sky.test.ts`

Risk: Medium. Keeping the rows original while useful; the Ravenloft list needs an authored spawn set that is not the book's.

### Castle Ravenloft complete and legible (parallel authoring track, ships level by level)

Finish locations/ch04/K from scripts/authoring/castle-ravenloft.py against the reconciled key count from V2's coverage report: the unbuilt K keys (K84 crypts 1-40 as rooms in the catacombs, K2, K52, K18a) and original player descriptions and DM notes for every undescribed room; per-level floor materials so the castle no longer reads as a slab; stairs/shafts linked, detents and Whole verified, label density tuned for 12 levels; E, E5, G, C and N1 get descriptions and notes; tests gate 'mapped' on page+desc+dm. Each level lands behind the partial flag; the flag is removed only when coverage is 100% and the perf guard passes.

Acceptance:
- sceneAreaKeys(K) covers every K key in manifests/locations.json; scene.partial removed; every K room has page, desc and dm (fidelity gate in tests/manifests.test.ts)
- perf.spec: K's load time, draw calls and triangles within the castle tier of the rewritten docs/PIPELINE.md budget on desktop and phone projects; main-floor screenshot at the tabletop preset shows no .lbl overlaps after declutter
- Floor dropdown and section detents name all 12 levels; Rooms sheet 'here' resolves in the courtyard on a fresh campaign

Files: `scripts/authoring/castle-ravenloft.py`, `scripts/authoring/ravenloft-exterior.py`, `scripts/authoring/import-ml.py (E, E5, G, C)`, `scripts/authoring/vallaki-sites.py (N1)`, `locations/ch04/K/scene.json, grid.json`, `locations/ch03/E*/scene.json`, `app/src/render/materials.ts (per-level floors)`, `tests/manifests.test.ts`, `tests/scale.test.ts`, `tests/no-book-content.test.ts`, `e2e/perf-baseline.json`

Risk: High effort, medium risk: performance of a 12-level stacked scene with 40 crypt rooms and label clutter; the perf guard and declutter are the gates; wording must stay original (player-safety test extended to every scene). Authoring runs in parallel with V3 and V4 code work.

QA for this version:
- DM, desktop: build tonight's plan (E4 -> N2 -> O1) and jump through it; stage E4, mark Ireena met and show her to the table; run a 20-minute mock session in Death House and read the journal's order and timestamps; enter a Tarokka reading and tick an event
- DM, desktop: drag the party into the woods at night on the world map, roll an encounter, place it, open the wilderness map; +8 h as a long rest in the Village at night and confirm dawn lighting; +1 h as a short rest in the castle and resolve the checks; plain +1 h still just moves the clock
- DM, desktop: open K fresh, confirm the courtyard start, walk every stair from courtyard to the crypts, Whole building, labels readable at each floor, Rooms sheet shows every K key with a page; read the perf row for K
- Players, desktop and both displays (popup and TV): plan strip, journal, NPC statuses, Tarokka markers, roll results and staged creatures never appear; a met NPC shows its real name; staged creatures invisible until revealed; relay state messages carry no journal (devtools)
- DM, phone: plan strip collapses to a chip; journal, NPC and Reading sheets as bottom sheets; edit a note with the on-screen keyboard; Stage and Roll reachable from the area bottom sheet; K opens and pans smoothly
- Players, phone as display: K in Players mode pans and pinches; export/import with journal, npcs, plan and reading; reload after every step and compare IndexedDB state with the journal


## V5: Players' own devices act, and the book is within reach: seats and permissions for phones at the table, DM-controlled lights as light tokens, the DM's own PDF at the page, AoE templates and hex parity, wilderness fidelity

### Player phones that act: permissions, intents, seats

The players'-side checks scattered through moveTokenTo, toggleOpen, toggleDoor, takeLink and tap move into pure functions in core/permissions.ts taking (state, scene, level, actor); the DM tab applies the same rules to a remote intent as to the local Players view. Protocol adds intent {id, op} from clients and deny {id, reason} from the host; ?join=CODE opens an interactive restricted client (App.interactive beside mode; installPointer active; optimistic local apply, host state overwrites). Sheet gains owner (client id in localStorage) and state.session holds seats and three DM rules: moveParty, doors, containers each 'anyone' \| 'owners' \| 'dm'; a joining player claims a free roster Sheet or spectator; the DM approves or reassigns in the Session sheet; a seat's owner may move their own detached scout (V3) and, in initiative, only their member token, and may roll their own initiative; the touch-table toggle lets the TV display accept the same intents. Under 700 px the player client uses a thin bottom sheet with Map, Initiative ('your turn' banner, navigator.vibrate) and My seat (name, speed, reach, range) tabs.

Acceptance:
- tests/permissions.test.ts: a player may not pass a closed door, open a locked container, move anything but the party or their own scout outside initiative or anyone but the current combatant inside it; the DM may do all; the local Players view behaves exactly as before (move.spec, ui.spec unchanged)
- Phone joins, claims 'Rogue', taps a cell: the party walks on every screen within one round trip (display.spec records the time); a wall-blocked move is refused locally and never reaches the host (relay log asserts no intent); a forged intent moving a hidden creature is denied and the phone's status line shows the deny reason; with moveParty = 'owners' a spectator is denied
- Fighter's owner cannot move the Rogue's token ('Not your token'); the DM can; seats persist and reattach by client id after a phone reload; the DM reassigns a seat in one tap
- e2e/remote.spec.ts runs DM, TV display and two player contexts through the preview relay; the player client never renders dm-note labels, hidden targets or DM chrome

Files: `app/src/core/permissions.ts (new)`, `app/src/app.ts (restricted move path ~L1174-1230, onMsg intents, interactive)`, `app/src/state/transport.ts (intent, deny, presence)`, `app/src/state/campaign.ts (Sheet.owner, session)`, `app/src/ui/session.ts`, `app/src/ui/encounter.ts`, `app/src/ui/playerShell.ts (new)`, `app/src/main.ts (?join, player-mode input)`, `tests/permissions.test.ts (new)`, `tests/player-safety.test.ts`, `e2e/remote.spec.ts (new)`

Risk: Medium-high. Refactoring the rule checks out of App touches the most-tested paths; optimistic apply vs host overwrite can flicker on slow links (last writer from the DM window wins); a second UI entry point beside buildDmUi must stay thin.

### Light sources the DM can toggle or drop, as light tokens

Authored lights (braziers, hearths, candles, lanterns) get Light/Douse on their object card and in the area panel, state in CampaignState.lit (object id -> boolean); the DM drops a torch (20/40) or lantern (30/60) on a cell as a Token with role 'light' and the existing Token.light field (no new store) and picks it up again; vision/coverage reuses V3's multi-source union, debounced and cached per level; V1 undo covers both; relay clients follow.

Acceptance:
- Douse the Death House hearth: players' vision shrinks on the displays; relight restores it; Undo reverses each
- Drop a torch in the dungeon corridor: players' explored area grows from it; pick it up; persists across reload; the token is invisible as a figure and shows only its glow on the players' side
- Vallaki with 10 toggled lights stays within its perf baseline band (tests/vision.test.ts covers coverage with extra sources)

Files: `app/src/state/campaign.ts (lit; Token.role 'light')`, `app/src/core/light.ts`, `app/src/core/coverage.ts`, `app/src/app.ts (coverage refresh, tap menu, undo kinds)`, `app/src/render/build.ts (light meshes, flicker)`, `app/src/main.ts`, `app/src/ui/areaPanel.ts`, `tests/vision.test.ts`

Risk: Medium. Coverage recompute cost on huge maps; the V3 union cache is the mitigation.

### The DM's own book at the page

The DM picks their PDF once (input type=file); the blob lives in the IndexedDB blobs store; every 'p.212' in cards, panels and the Rooms sheet becomes a DM-only button that opens a reader sheet rendered with pdf.js at printed page + offset, one page at a time at device DPR, releasing each page before the next, never broadcast. pdf.js is an npm dependency loaded as a lazy chunk and precached by the service worker (no CDN, or the offline PWA breaks); three books mapped by file name for PHB/DMG/MM links in SRD tooltips; blobs removable from the Library sheet; the SRD 5.2.1 (2024) stat-block variant lands here as a second lazy chunk behind a toggle.

Acceptance:
- Load the PDF, tap p.212 on room 1A: the reader shows the Death House page, offline on reload with the network disabled in Playwright; pinch-zoom works on the phone project; after opening ten pages in sequence the reader holds at most two live page canvases and pdfjs destroys each PDFPageProxy (counter asserted in e2e)
- Reader and page buttons never appear in Players mode, on displays or player clients (e2e); without a PDF the page stays a plain label and no request for book content is ever made (network log asserted)
- vite build: pdf.js in its own chunk, absent from the initial bundle; the SW precache manifest includes it; the 2024 toggle swaps the Wolf's block

Files: `app/src/ui/reader.ts (new)`, `app/src/state/idb.ts (blobs)`, `app/src/main.ts (page buttons)`, `app/src/ui/areaPanel.ts`, `app/src/ui/library.ts`, `app/src/ui/statblock.ts (2024 toggle)`, `manifests/srd-creatures-2024.json (new, generated)`, `package.json (pdfjs-dist)`, `vite.config.ts (worker chunk, SW precache)`, `docs/PIPELINE.md`

Risk: Medium-high. pdf.js memory on iPad Safari for a 260-page scan; render one page at a time and cache nothing. Manual QA watches memory on the iPad; the automated gate is the canvas/proxy count.

### Hex range overlays, hex movement, and area-of-effect templates

core/range.ts computes move/strike cells on the hex lattice (hexDistanceFt, neighbours by orientation, difficult floors); render/rangeOverlay.ts draws hex tiles; movement budgets and the measure tool agree with the hex count; hex snapping verified by test; refreshRange's early return lifted. An AoE tool (sphere, cone, line, cube; radius/length in feet; square and hex) placed by two taps draws a template visible to players (as a shape only, no name) and lists which revealed tokens it covers for the DM; templates clear on End encounter or Esc.

Acceptance:
- Hex encounter: green/red hexes drawn, moveCells matches speed in hexes minus blocked, strike ring is one hex for reach 5; switching square <-> hex mid-encounter redraws correctly
- tests/range.test.ts hex cases incl. a 30 ft hex move with a blocking wall; snap test for hex cells
- 20 ft sphere at a point in Death House 8 on a square grid covers the SRD cell set (tests/range.test.ts fixture); 15 ft cone from the Wolf covers the expected cells on square and hex; the DM list names only revealed tokens; the players' side shows the shape and no text

Files: `app/src/core/range.ts`, `app/src/core/grid.ts`, `app/src/render/rangeOverlay.ts`, `app/src/render/gridOverlay.ts`, `app/src/app.ts (refreshRange, aoe tool)`, `app/src/main.ts (Tools menu)`, `tests/range.test.ts`, `tests/grid.test.ts`

Risk: Low-medium. Hex orientation handling per level; cone geometry rules differ by table, so the template follows the SRD 'any square touched' rule and says so.

### Wilderness fidelity and the mist wall

Rebuild the eleven generic chapter-2 spots (B, D, F, H, I, J, L, M, P, R and the Old Svalich Road mist on A) as unique maps from the text with descriptions, DM notes and hidden slots; the mist wall becomes a volumetric band from a kit prop instead of white blobs; iPad Split View one-third width layout verified alongside the phone projects.

Acceptance:
- Each of the eleven scenes has a distinct silhouette in loc_ch02_*.png (pairwise pixel difference above the e2e threshold) and page/desc/dm on every room (fidelity gate); the mist wall renders as a continuous bank; perf baseline rows for ch02 within the small-site tier
- 1024x1366 Split View at 320-508 px: all controls hit-testable, no horizontal page scroll (e2e/ui.spec.ts)

Files: `scripts/authoring/wilderness.py, wildlib.py`, `app/src/kit/sites/wild-*.ts`, `app/src/kit/props.ts (mist bank)`, `app/src/render/backdrop.ts`, `locations/ch02/*/scene.json`, `app/src/styles.css`, `tests/manifests.test.ts`, `e2e/ui.spec.ts`

Risk: Low technical risk; authoring effort.

QA for this version:
- DM, iPad, hybrid table: start a session, approve four phones claiming Fighter/Rogue/Cleric/Wizard with moveParty = 'owners'; a fifth phone joins as spectator and is refused a move; enable the touch-table toggle on the TV, move the party from it, try a locked door and a wall; disable and confirm taps are ignored; reassign a seat after a phone reload
- Players, phones: walk the party, open an unlocked door (opens everywhere), be refused a locked one; detach as a scout and move only your own figure; feel the vibration when your turn comes and move only your own token; roll your own initiative; try to move another seat's token (refused); airplane mode 20 s and reconnect with the seat intact
- DM, desktop: douse the hearth, drop a torch in the dungeon and watch players' vision on the TV and phones; Undo each; place a fireball template over three goblins and read the covered list; load the PDF and tap p.212 on 1A; open ten pages on the iPad and watch memory in Safari's inspector
- Players, desktop (Players mode) and all displays: no reader, page buttons, lights UI or DM chrome; hidden creatures still aliased; the AoE shape visible with no text; hex encounter on the Sheep Chase tavern shows only the current combatant's hexes
- DM, phone landscape and iPad Split View one-third: full session loop (open, move, reveal, initiative, clock, Send view) with every control reachable; reader and stat blocks as bottom sheets
- Regression: full e2e on desktop, phone, phone-landscape and remote projects; perf baseline green for all 44 locations; manifests fidelity gate green; ch02 silhouettes distinct

## How the plan was shaped

What the critic changed, and why. (1) Competitor strengths nobody had carried over: exporting or printing a map (every competitor can; mistLAB cannot even snapshot the players' view) is now a V3 feature and a matrix row; a DM pointer/ping on the table screen (Owlbear, Foundry, Roll20 all sync pointers) joins the V3 show-to-players feature; click-to-roll from the stat block (FGU/Shard/DDB) becomes a DM-only roller in V2 built on a pure core/dice.ts that also replaces the private d20 in ui/encounter.ts, while players' dice stay optional because physical dice are on the table; per-token vision for a split party (every 2D VTT) becomes V3 'Scout', which Death House demands in session one and which V5 seats need anyway; AoE templates (every 2D VTT, asked for in the second fight) join V5 with hex parity; weather FX is listed as optional. (2) Duplicates of what mistLAB already has: V4's 'Short rest (+1 h) and Long rest (+8 h)' duplicated the clock panel's existing +1 h and +8 h buttons, so rests are now semantics attached to those buttons; V5's new CampaignState.lights duplicated Token.light (campaign.ts already models a carried light on any token), so dropped lights are light tokens; the area panel would have been a fourth description surface beside the Rooms sheet, the room tap menu and info cards, so the tap menu shrinks to actions; V3's undo scope listed 'lights' two versions before lights exist. (3) Untestable acceptance criteria rewritten: 'under the e2e noise floor' became a pixel percentage and channel delta; 'Vallaki under 6 s on the phone' (today 8.9 s) and the 300/500 ms relay latencies became recorded perf-baseline metrics with a generous gate; '1000 entries under 100 ms' became a DOM-row count; 'memory stable on iPad Safari' became a canvas/proxy count plus manual QA; 'draw calls within docs/PIPELINE.md budget' was untestable because the written budget (<= 100 draw calls, <= 300k triangles, < 3 s) is already broken by Vallaki, Abbey and Amber Temple, so V1 gains a perf baseline spec and the budget is rewritten to measured tiers; 'the phone flashes the reason' became a status-line assertion; the castle gate cited 150 keys in one place and 161 in another, so V2's coverage report must publish one count the V4 gate cites. (4) Version size: V1 had every nit plus a shader change and new Playwright projects; north-up, label clipping and world-name collisions move to a V2 'Legibility' feature, and Undo moves into V1 because a mis-tap is a night-one problem and commit() already exists; the castle is marked explicitly as a parallel authoring track that lands level by level so V4 is not a single round of code. (5) Risks to existing maps and performance now named: regenerating all 44 scene.json files in V2 gets a golden-diff script that allows only the new creature/count fields; the journal moves to its own IndexedDB store so the whole-state commit() and the relay's full-state messages do not grow; conditions pips are forced through V1's declutter; coverage becomes a cached multi-source union in V3 so V5 lights reuse it; pdf.js must be bundled and precached, not loaded from cdnjs, or the offline PWA promise breaks; and the V3 relay now includes HTTPS on the LAN because a service worker only registers in a secure context, which also explains why the iPad reached over http has no offline cache today. (6) Players-mode sealing added a tested DM-return gesture so making '[' inert does not lock the DM out of their own screen. (7) Session notes a DM reaches for before any journal are folded into V2's notes feature as a free-text pad; SRD 5.2.1 is deferred to V5 as a lazy chunk to protect first load.

The order of the five versions is unchanged because its logic held: V1 fixes what breaks on night one and seals the view every later version will put on screens the DM cannot see; V2 turns data already in the repo into the area panel, woken slots, SRD numbers and notes; V3 turns the Player Display from a mirror into a stage and moves it onto any device over the table's Wi-Fi as view-only first; V4 is prep, pacing and memory from the manifests plus the castle track; V5 lets phones act only after the sealed view, the transport and the show messages have proven themselves. Each version still ships on its own, leaves tests/no-book-content.test.ts green, and from V1 on leaves the perf baseline green, which is the guard this roadmap previously lacked.

