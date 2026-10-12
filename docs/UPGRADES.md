# mistLAB gameplay upgrades

A plan built from a sweep of what successful virtual tabletops do and what reviewers say goes wrong, fitted to mistLAB: a DM running Curse of Strahd at a physical table on one screen, with an optional players' display. Every feature has a source. Pitfalls and the rules that guard against them are in `docs/PITFALLS.md`. Changes to existing major features are listed in `docs/APPROVALS.md` and are not built until the owner approves them.

## How versions work

- Each increment below is one version. It bumps `package.json`, adds a dated `docs/CHANGELOG.md` section, shows the version in Help, and is published as its own artifact version.
- Increments contain additive work only: new panels, tools and options whose defaults keep today's behaviour.
- Each increment ships only when its acceptance tests, the full unit and end-to-end suites, the no-book-content test and the performance baseline (from increment 2 on) all pass.

## Increments

### 0.2.0 · Increment 1: Backups, persistent storage and a private broadcast

- **Persistent storage status.** navigator.storage.persist() on the first commit; result shown in Help with an install hint.
- **Export/import with share sheet.** Library Campaign section. Export JSON with schemaVersion via navigator.share({files}) where canShare, otherwise a download. Import validates and asks once (ROADMAP V1).
- **Rolling snapshots and backup nudge.** Last 5 snapshots in IndexedDB with Restore. A 'Back up campaign' chip after 2 h without an export.
- **Players' state projection.** core/playersView.ts projectState(). channel.ts 'state' carries the projection. Every CampaignState key is classified 'player' or 'dm'. No visible change to the display.
- **Help non-goals.** A 'What mistLAB does not do' section.

Acceptance:
- tests/campaign-io.test.ts (fake-indexeddb): Export, Reset, Import deep-equals reveals, doors, opened, tokens, roster, encounter, clock and world. A malformed file and a wsc file while cos is active are refused, and state is unchanged.
- persist() mocked to resolve true: Help shows exactly 'Storage: persistent'. Mocked false: Help shows the warning containing 'Install'.
- With navigator.canShare and share mocked, Export calls share once with a File matching /mistlab-cos-.*\.json/. Without them, Playwright waitForEvent('download') yields that filename.
- After 60 commits the Library lists at least 1 snapshot, and Restore deep-equals it.
- Date.now mocked 2 h past the last export: the chip is visible; after Export it is gone.
- tests/player-safety.test.ts: a key added to CampaignState without a classification fails. projectState() output has no 'dm' key.
- e2e: a BroadcastChannel listener on the display page records 'state' messages; none contains a 'dm' key. The existing slider.spec Player Display tests pass unchanged.
- ui.spec: the Help text contains 'remote play' and 'character sheets' under the non-goals heading.

Pitfalls guarded: Browser storage silently evicted; Client-side trust: the players' window receives the full DM state; Updates and schema changes break a live campaign; Setup sprawl, too many clicks, and feature creep.

Files: `app/src/core/playersView.ts (new)`, `app/src/state/channel.ts`, `app/src/state/campaign.ts`, `app/src/state/idb.ts`, `app/src/app.ts (broadcast)`, `app/src/ui/library.ts`, `app/src/main.ts (showHelp)`, `tests/campaign-io.test.ts (new)`, `tests/player-safety.test.ts`, `e2e/ui.spec.ts`, `e2e/slider.spec.ts`

Risk: Low. iOS may ignore persist(); the warning and share-sheet export cover that case.

### 0.3.0 · Increment 2: Performance guard, loading and quality

- **Perf baseline.** e2e/perf.spec.ts across 44 locations plus Castle 'Whole'. Desktop and phone (390x844, DPR 2) gated against their own baselines at +20% calls or triangles and +30% load. WebKit load recorded and gated at +50%. docs/PIPELINE.md lists the measured tiers.
- **iPad release checklist.** docs/PERF-IPAD.md: Death House, Vallaki and Castle load times on a named iPad, filled before each release.
- **Non-blocking loading.** build.ts yields between object batches; a DM progress bar; status line 'Could not build N objects'.
- **Context-loss recovery and soak.** webglcontextlost/restored rebuild the scene from state; a 10-switch and 200-move soak test.
- **Quality options.** Low power (DPR 1.0, mist off), Auto quality (steps down DPR then mist on slow frames) and a display-own tier. All default off.
- **Preload recents.** Option, default off: prefetch and parse the last 3 locations' scene.json in idle time.

Acceptance:
- perf-baseline.json has 45 rows per project. A fixture adding 30% draw calls to Death House fails desktop and phone. The unchanged tree passes.
- During Vallaki open on desktop, the PerformanceObserver longtask maximum is under 400 ms, and the progress value is observed rising at least 3 times.
- A fixture scene with one malformed object opens, and the status line reads 'Could not build 1 object'.
- loseContext() then restoreContext(): within 3 s the same location and level show, reveals are unchanged and the console has no errors.
- After 10 location switches, renderer.info.memory is within 10% of the first visit. Commit time after 200 moves is within 20% of the first 10.
- Low power on: getPixelRatio() === 1. With Auto quality on and the __mist.fakeFps(15) test hook, the status shows 'Quality: balanced' and the DPR drops. With all options off, existing screenshots are unchanged.
- Castle Whole: in the screenshot region above the projected cut line, pixels differ from the sky colour by under 0.5%.
- Preload on: reopening a recent location makes no network request for its scene.json (page.on('request')).

Pitfalls guarded: Lighting, vision and overlays drag performance down until the table stalls; Testing only on Chromium while the target is iPad Safari; iPad Safari kills WebGL contexts under GPU memory pressure; Long sessions drift; Section cut fails on large buildings.

Files: `e2e/perf.spec.ts (new)`, `e2e/perf-baseline.json (new)`, `playwright.config.ts (phone, phone-landscape, webkit projects)`, `docs/PIPELINE.md`, `docs/PERF-IPAD.md (new)`, `app/src/render/build.ts`, `app/src/render/world.ts`, `app/src/app.ts`, `app/src/data.ts`, `app/src/main.ts (View menu)`

Risk: Medium. SwiftShader noise (median of 3) and WebKit WebGL on Linux, hence the wider band. Chunked build must keep build order deterministic.

### 0.4.0 · Increment 3: Reach and tap

- **Enter from object cards.** Object card and hover tip offer 'Enter <building>' (bug 2, V1); Players view unchanged.
- **Hidden things per room and clickable DM labels.** The Rooms sheet lists secret doors, traps, hidden objects and slots with eye and Frame; DM labels open their card (bug 7 list part).
- **Settings fixes.** Diagonal control (bug 14), Walls button aria-disabled on stacked sites (bug 12), stale hex overlay cleared (bug 8).
- **Phone layout.** .mapframe pointer-events fix; menus inside the viewport; Section moved into the Floor row only at max-width 600 px; phone and phone-landscape projects (bug 3).
- **Large controls and focus guard.** 'Large controls' option, default off. The keydown guard in main.ts extends to TEXTAREA, SELECT and contenteditable. tests/keys.test.ts checks KEYMAP uniqueness.

Acceptance:
- Vallaki sweep: tapping N1-N9 and N8a-d in two presets shows Enter, which opens the building, and Back returns. Players-view cards have no Enter.
- Death House Floor 2 Rooms sheet lists the library secret door. Its eye adds f2-sdo-lib, which persists after reload and shows on the display.
- A 3-cell diagonal measures 15 ft by default and 20 ft after switching; the choice persists.
- N2: Walls has aria-disabled='true'. Encounter plus hex: rangeMesh is undefined.
- At 390x844 and 844x390, elementFromPoint at the centre of Zoom in, Zoom out, Find party, Follow and Help returns that button. View and Tools panel boxes lie within the viewport. The Section and view-slider bounding boxes do not intersect; the floor-row and top-bar boxes do not intersect.
- At 768x1024 and 810x1080 (iPad portrait) and 1024x768, slider and grid screenshots are unchanged within tolerance.
- Large controls on: the HP and initiative inputs' boundingBox height is at least 56. Off: unchanged.
- Typing '/' and 'f' in a test textarea opens no finder and leaves the camera unchanged. keys.test finds no duplicate binding.

Pitfalls guarded: Hidden things that need precision taps; Touch input fragile; overlays intercept taps; new panels unreachable on phones; Hotkey collisions: one key doing two things, or shortcuts firing while typing; 3D camera disorientation; Occlusion hides tokens and blocks picking.

Files: `app/src/main.ts`, `app/src/app.ts`, `app/src/render/build.ts`, `app/src/ui/encounter.ts`, `app/src/styles.css`, `playwright.config.ts`, `e2e/ui.spec.ts`, `e2e/grid.spec.ts`, `tests/grid.test.ts`, `tests/keys.test.ts (new)`

Risk: Low-medium. The phone-only breakpoint protects iPad portrait.

### 0.5.0 · Increment 4: Action undo and fog tools

- **Action history.** Session-only, 50 entries: moves including level changes, doors, containers, object toggles, HP. Ctrl/Cmd-Z walks one session timeline in which reveal entries delegate to the existing reveals.pop(). Shift redoes. Status line plus a 1.5 s highlight. The 'Undo reveal' button and its persisted log are unchanged (V1).
- **Whole-floor and rectangle reveal.** 'Reveal whole floor', 'Re-fog floor' and a rectangle mode, each recorded as a reveal-log entry, so Undo reveal covers them and they persist. Hidden things are untouched.
- **Reveal aids.** Hover outline with an 'open to <key>' warning; DM reason hover; options (default off) Brush stays in room, Lock reveals, and Mark hidden creatures.
- **Arrow nudge and clamp.** DM arrow keys move the selected token one cell. Every commit clamps positions to level bounds.

Acceptance:
- Reveal room 3, reload, press Undo reveal: room 3 is hidden again (existing tests pass).
- Reveal room 3, move the party, Ctrl-Z: the move is undone and room 3 is still revealed. Ctrl-Z again: room 3 is hidden. Shift-Ctrl-Z re-reveals it.
- Moving the party through the spiral stair, then Ctrl-Z: previous cell and level are restored, and the display follows.
- tests/undo.test.ts: 51 moves keep the last 50; door and container undo; a forged out-of-bounds move is clamped.
- Ctrl-Z and arrows in Players view and on the display: state is unchanged. Ctrl-Z inside the finder input: party position unchanged.
- Re-fog Floor 1 after 6 reveals: Floor 1 rooms equal the fog colour on DM t=0 and the display. Secret-door reveals and doorsOpen unchanged. After reload, Undo reveal restores the pixels.
- A 3x6 rectangle adds one reveal entry and a hidden chest inside stays hidden. Brush option on: a stroke from 1A into 2 reveals no cell of 2. Lock reveals on: walking 1A to 1B adds none.
- With defaults, existing slider and ui screenshots are unchanged. At 390x844 and 844x390, the undo, redo and lock chips pass elementFromPoint.

Pitfalls guarded: Accidental reveals and destructive mass actions without undo; Replacing a shipped behaviour while calling it additive; Players' input can undo or leave DM state; Mass fog operations that sweep secrets or doors along; Items become unreachable off-map; Vision leaks through geometry; Hotkey collisions: one key doing two things, or shortcuts firing while typing.

Files: `app/src/app.ts (commit, undo, history, describe, installPointer)`, `app/src/state/campaign.ts (reveal kinds 'rect' and 'level', migration)`, `app/src/core/coverage.ts`, `app/src/main.ts (Rooms sheet, keydown, Tools menu)`, `app/src/styles.css`, `tests/undo.test.ts (new)`, `tests/manifests.test.ts (closed rooms, doors on walls)`, `e2e/move.spec.ts`, `e2e/slider.spec.ts`

Risk: Low-medium. The interleaved timeline must not double-pop reveals; unit tests cover the order.

### 0.6.0 · Increment 5: Player Display control

- **Status, heartbeat, sequence numbers.** Top-bar chip 'Display live / No display' with Relaunch. The DM sends {kind:'beat'} every 2 s while a display has said hello. The display shows 'DM disconnected' after 6 s of silence. Messages carry seq, and stale ones are dropped.
- **Camera modes and intents.** Mirror (today's lock) / Stay / Follow party / Follow combatant; Send view and Frame for players in world units; viewbox on the minimap.
- **Curtain and Freeze.** Curtain (black, title, mist) and Freeze. Option 'curtain during loads', default off. A test-only __mist.onFrame hook when ?test=1.
- **Display layout options.** Rotation, per-edge margins, turn-bar top or bottom, a 'Present' button where navigator.presentation exists. Options, default off: floor chip (the party's level only, and only while displayed) and date/time chip.

Acceptance:
- With defaults, the existing slider.spec display tests pass unchanged.
- Frame room 8: the room's bounding box fits the display at 1280x720, 1024x768 and 768x1024. When the DM then pans, the display camera is unchanged.
- Follow combatant: after N, the display target is within one cell of the new combatant. Follow party: the target moves no further than the token's displacement plus one cell.
- Curtain-during-load on, switching location: every frame sampled via __mist.onFrame has unrevealed-room regions within 12/255 of the fog colour.
- Freeze: DM reveals and moves leave the display unchanged. Unfreeze: under 0.5% of pixels differ from DM t=0.
- __mist.pauseBeats() on the DM: banner within 6-8 s, gone within 3 s after resume. Idle DM with beats running: no banner for 60 s. Closing the display: chip reads 'No display' within 4 s.
- Rotation 180: compass reads 180 ±1. Margins 40 px: turn bar inside. Floor chip on: shows 'Floor 1' with the party there; absent when the DM browses Lower dungeon.
- Every visible display text node is at least 18 px with contrast at least 4.5:1. The display ignores taps and keys. At 390x844 and 844x390, the DM chip and View-menu display items pass elementFromPoint.

Pitfalls guarded: Camera features fight each other; Framing differs between DM and display; Bezels and orientation crop or invert the table screen; The player window closes silently or looks live when the DM is idle; Per-user fog diverges and the GM cannot see the players' actual view; Players lose track of floors, and stairs land wrong; Players'-side text too small or too faint at arm's length; Explorable fog can flatten dread.

Files: `app/src/state/channel.ts`, `app/src/app.ts (broadcast, sendCamera, heartbeat)`, `app/src/render/world.ts`, `app/src/main.ts`, `app/src/ui/minimap.ts`, `app/src/ui/encounter.ts`, `app/src/styles.css`, `e2e/display.spec.ts (new)`, `e2e/slider.spec.ts`

Risk: Medium. Camera authority is kept in one mode state machine.

### 0.7.0 · Increment 6: Show, tell and point

- **Payload projection.** playersView builds every show, caption, roll-call and ping payload.
- **Read to the table and show cards.** Room caption; creature and object cards (alias, player description, colour chip); Clear, auto-clear, 'Showing' chip; held in state (V3).
- **Call for a roll.** Card without a DC on the display; DM-only tick list.
- **Pointer pings.** Pointer tool hold. Mode: ripple / pan the display / both. Revealed rooms only, edge arrow, suppressed while curtained, frozen or showing an overlay.

Acceptance:
- Show the revealed Ghoul: the display shows its alias and description. A hidden creature has no Show button, and a forged message is rejected (unit).
- Caption: a tap on the display leaves it. Auto-clear at 20 s removes it at 20 ±1 s. A display reload re-shows it.
- The roll-call tick list never appears in any display message.
- Ping: over 5 pings, median drawAt - sentAt (message timestamps) under 250 ms. A ping in an unrevealed room draws nothing. A ping outside the frame draws an arrow. Pan mode moves the display target to the point.
- While frozen or curtained, a ping draws nothing, and nothing replays after unfreezing.
- Fuzz in player-safety finds no DM notes, real names or hidden ids in any payload. All new display text is at least 18 px with AA contrast. New DM buttons pass the phone sweep.

Pitfalls guarded: Hidden names and positions leak through side channels; Showing a picture or card drags the secret along; Overlays on the table screen that cannot be dismissed; Pings, pointers and captions shown at the wrong moment; Players'-side text too small or too faint at arm's length.

Files: `app/src/core/playersView.ts`, `app/src/ui/showcard.ts (new)`, `app/src/state/channel.ts`, `app/src/state/campaign.ts`, `app/src/app.ts`, `app/src/render/world.ts`, `app/src/main.ts`, `app/src/styles.css`, `tests/player-safety.test.ts`, `e2e/display.spec.ts`

Risk: Low-medium.

### 0.8.0 · Increment 7: Area panel, DM notes and honest gaps

- **Area panel.** DM-only drawer (bottom sheet below 820 px) opened from a new 'Panel' item in the room menu, a Rooms-row icon and a secondary button on '/' results. '/' Enter and key labels are unchanged (V2).
- **Notes and session pad.** CampaignState.notes, classified 'dm'; autosaving textareas; Esc blurs first.
- **Loot ticks and entry prompt.** Per-item taken tick. Option (default off): a DM prompt on entering a room with a trap or slot.
- **Fidelity report and honest labels.** scripts/fidelity-report.ts writes docs/FIDELITY.md (V2). Library 'partial' badge. 'No battle map here yet' on unmapped pin cards (task #68).

Acceptance:
- The Death House '8 Library' panel shows p.213, the secret door and the desk with its key; no-book-content runs over the panel text.
- '/' then 'ritual' then Enter still switches level and frames (existing ui.spec passes).
- A note survives reload and export; it never appears in Players view or in display messages. Ctrl-Z typed in the note leaves the party position unchanged; the first Esc keeps the sheet open.
- At 390x844 with the panel collapsed, a 200 px map drag moves controls.target by more than 1 m. Walking 1A to 1B to 2A causes at most 3 panel renders.
- The fidelity test fails if page, description or DM-note counts drop below the committed ones. The Castle Ravenloft row shows the 'partial' badge. An unmapped chapter 2 pin card reads 'No battle map here yet'.
- With defaults, the room menu shows exactly one new item and nothing else changes. Panel controls pass the phone sweep.

Pitfalls guarded: Content gaps behind the map undermine trust; Over-promising partial content; Campaign memory lives on paper; Hotkey collisions: one key doing two things, or shortcuts firing while typing; Replacing a shipped behaviour while calling it additive; Client-side trust: the players' window receives the full DM state.

Files: `app/src/ui/areaPanel.ts (new)`, `app/src/ui/notes.ts (new)`, `app/src/state/campaign.ts`, `app/src/app.ts`, `app/src/bestiary.ts`, `app/src/main.ts`, `app/src/ui/library.ts`, `app/src/ui/worldmap.ts`, `scripts/fidelity-report.ts (new)`, `docs/FIDELITY.md (new)`, `tests/manifests.test.ts`, `tests/player-safety.test.ts`, `e2e/ui.spec.ts`

Risk: Medium: screen space on iPad portrait.

### 0.9.0 · Increment 8: SRD stat blocks, sizes and a private roller

- **SRD data.** srd-creatures.json and srd-rules.json (SRD 5.1, CC-BY-4.0) with ATTRIBUTION.md, as a lazy chunk precached via 'cache-pack' with URLs from Vite's manifest (V2, task #38).
- **Stat block, dice and log.** Drawer from bestiary, token and panel; core/dice.ts; DM-only log (classified 'dm'); 'Show result'; clickable dice in notes; quick-reference sheet.
- **Token edits.** HP field accepts -7/+5 (undoable); size override; statOverrides.
- **Roll all foes.** Plus the 'same roll for identical' toggle; behind the A2 flag.

Acceptance:
- Tapping Bite on the Wolf block logs a to-hit and damage line. tests/dice.test.ts covers parse, advantage and crit with a seed.
- Fresh context: load once without opening a block, setOffline(true), reload, open the Wolf block: it renders.
- The initial bundle excludes SRD; the chunk is under 350 KB gzipped.
- -7 on 22 gives 15; +30 caps at max; Ctrl-Z reverts.
- Every bestiary entry has a size in T/S/M/L/H/G. A Large override changes the ring radius (unit).
- A2 flag off: no 'Roll all foes' button. Flag on, with A2 shipped: six wolves get values in one tap.
- No roll and no statOverrides in display messages. ATTRIBUTION.md exists. no-book-content passes. Drawer controls pass the phone sweep.

Pitfalls guarded: Over-automation slows the table; Exact HP shown to players; Third-party dependencies and lazy chunks break offline play; Mislabelled creature sizes break 5e space on the grid; Hidden names and positions leak through side channels.

Files: `manifests/srd-creatures.json (new)`, `manifests/srd-rules.json (new)`, `manifests/ATTRIBUTION.md (new)`, `scripts/seed/srd.mjs (new)`, `app/src/core/dice.ts (new)`, `app/src/ui/statblock.ts (new)`, `app/src/bestiary.ts`, `app/src/ui/bestiary.ts`, `app/src/ui/encounter.ts`, `app/src/main.ts`, `app/src/state/campaign.ts`, `app/src/kit/creatures.ts`, `tests/dice.test.ts (new)`, `tests/bestiary.test.ts`, `tests/no-book-content.test.ts`, `e2e/ui.spec.ts`

Risk: Medium: licence hygiene and chunk precaching.

### 0.10.0 · Increment 9: Conditions, durations and combat bookkeeping

- **Conditions.** Token.conditions with until {round, turnOf}; picker; expiry in nextTurn; listed in the DM turn bar.
- **Pips and ring mode.** Screen-space pips on revealed tokens (decluttered); option 'Conditions as rings'.
- **Custom entries.** Lair action and reminders; visible to players when ticked; round on the display.
- **Options (default off).** Turn ring, 'you're up' banner, ghost-ring budget colours, skip downed, hide defeated from players. Players'-side turn cues sit behind the A2 flag.

Acceptance:
- Paralyzed and Prone on a revealed Ghoul draw two pips in all views; a hidden Ghoul shows nothing on the players' side.
- 'Until end of Rogue's next turn' expires exactly then, on both the DM screen and the display.
- Five conditions show three pips plus '+2'. Pips are at least 10x10 px on the phone. No label overlap with 12 tokens.
- 23:00 with mist: ring and pip pixels contrast at least 3:1 with their surround.
- Skip downed on: N passes over a 0 HP wolf. Off: today's order.
- A2 flag off: no players'-side ring or banner, even with the options on. Defaults: screenshots unchanged. Banner text is at least 18 px with AA contrast.
- Migration fixture added. Picker controls pass the phone sweep.

Pitfalls guarded: Status icons too small, too many, or covering labels; Atmosphere defeats readability at night and in mist; Overlays that obstruct play or cannot be turned off; Hidden names and positions leak through side channels; Exact HP shown to players.

Files: `app/src/state/campaign.ts`, `app/src/app.ts (syncTokens, nextTurn, declutter)`, `app/src/main.ts`, `app/src/ui/encounter.ts`, `app/src/ui/icons.ts`, `app/src/render/rangeOverlay.ts`, `app/src/styles.css`, `tests/conditions.test.ts (new)`, `tests/player-safety.test.ts`, `e2e/display.spec.ts`

Risk: Low-medium.

### 0.11.0 · Increment 10: Templates, auras and better measuring

- **AoE templates.** Cells via core/range.ts on square and hex, stopping at walls; players see cells only; persistent zones; flash on placement (V5, moved earlier).
- **Auras and fly flag.** Token.aura, hidden with the token; per-token Flying flag skipping terrain blockers.
- **Hex ranges and palette.** Hex move/strike overlays; colour-blind palette option.
- **Path measure tool.** A separate tool with waypoints and 'Show to table'; two-tap measure unchanged. Option: dashed route preview around closed doors. DM distance list.

Acceptance:
- range.test fixtures: 20 ft sphere; 15 ft cone on square and hex; a wall cuts the set.
- The display shows template cells and no text; nothing for unrevealed rooms.
- A 10 ft aura on a hidden token shows nothing on the display until Reveal.
- The two-tap measure still ends on the second tap (existing grid.spec). Path measure with two waypoints equals the sum of cell distances.
- A flying token crosses a terrain blocker but not a wall. Route preview passes through the open door and not the closed one.
- Vallaki with 5 templates and 3 auras stays within the perf band. New tool buttons pass the phone sweep.

Pitfalls guarded: Grid versus Euclidean template disputes; Hidden names and positions leak through side channels; Overlays that obstruct play or cannot be turned off; Lighting, vision and overlays drag performance down until the table stalls; Replacing a shipped behaviour while calling it additive.

Files: `app/src/core/range.ts`, `app/src/core/grid.ts`, `app/src/core/movement.ts`, `app/src/render/rangeOverlay.ts`, `app/src/render/gridOverlay.ts`, `app/src/app.ts`, `app/src/state/campaign.ts`, `app/src/main.ts`, `tests/range.test.ts`, `tests/movement.test.ts`, `e2e/grid.spec.ts`

Risk: Low-medium.

### 0.12.0 · Increment 11: Stage, start and improvise

- **Stage keyed NPCs.** Places characters.json NPCs tagged to the key, hidden; idempotent; group reveal.
- **Start encounter here.** Rolls the tokens already in the room plus the staged ones; 'reveal on first turn' option; behind the A2 flag.
- **Identify, numbering, scaling.** Token-panel Identify (undoable); 'Number copies' options; party-size multiplier on Place here and Place by tap.
- **Improvised battle maps.** 'Svalich road' and 'Forest clearing' kit scenes in a Library 'Improvise' section; 'Fight here' on the wilderness world-map card.

Acceptance:
- ch03/E4 Stage places Ireena and Ismark hidden; staging again does not duplicate; Reveal group shows both.
- A2 flag on: Start encounter here in a room with 3 placed wolves puts 3 combatants in initiative under aliases on the players' side. With 'reveal on first turn', a wolf stays hidden until its turn.
- Identify on the Ghoul: the players' card name changes; Ctrl-Z restores the alias.
- Number copies on: six wolves are named Wolf 1 to Wolf 6. Off: names unchanged.
- From a wilderness card: 'Fight here' then Forest clearing in 2 taps or fewer; three wolves placed with Place by tap.
- scripts/scene-diff.ts reports zero differences for the 44 existing scenes. The new scenes pass the closed-room and door tests and have perf rows. Controls pass the phone sweep.

Pitfalls guarded: Building the map eats prep and improvisation stalls; Hidden names and positions leak through side channels; Updates and schema changes break a live campaign; Lighting, vision and overlays drag performance down until the table stalls; Visibility inherited from another object's permission.

Files: `app/src/app.ts (stageKey, startEncounterHere, identify)`, `app/src/ui/encounter.ts`, `app/src/ui/areaPanel.ts`, `app/src/ui/bestiary.ts`, `app/src/ui/library.ts`, `app/src/ui/worldmap.ts`, `app/src/bestiary.ts`, `app/src/state/campaign.ts`, `scripts/scene-diff.ts (new)`, `scripts/authoring/*.py`, `locations/improvise/*/scene.json (new)`, `manifests/characters.json`, `tests/manifests.test.ts`, `e2e/perf-baseline.json`

Risk: Medium: new scenes must meet the same authoring tests.

### 0.13.0 · Increment 12: Handouts, pictures and print

- **Handout store.** IndexedDB v2 'blobs' store (kv kept); images downscaled to 1600 px; text handouts; explicit visibility (hidden by default); links to keys, pins and NPCs; DM-only link field (V3).
- **Show handouts.** Full screen on the display and in Players mode; rotate 90/180; mirrored two-up; DM-only dismiss; auto-clear; pings suppressed while showing.
- **Save picture.** DM-only PNG of the DM view or the players' t=0 view; share-sheet fallback.
- **Print floor plans.** North-up per level, rendered one at a time into the main renderer at up to 2048 px; @media print.

Acceptance:
- Importing a 3 MB PNG and linking it to a revealed E4 leaves it hidden on the display; Show displays it; Hide removes it.
- Pinch via CDP Input.dispatchTouchEvent on the shown image leaves controls.target unchanged; a player tap does not dismiss it; a ping while showing draws nothing.
- Two-up shows two copies 180 degrees apart. Export/import round-trips handouts. A v1 database upgrade keeps kv (migration test).
- Players' picture: pixels over unrevealed rooms and an unrevealed roofed building within 12/255 of the fog colour; labels only player-visible.
- Printing all Castle Ravenloft levels on the phone project: no webglcontextlost, canvas count unchanged, performance.memory.usedJSHeapSize growth under 150 MB.
- Handout text is at least 18 px with AA contrast. The link field is never in display messages. Sheet controls pass the phone sweep.

Pitfalls guarded: Visibility inherited from another object's permission; Showing a picture or card drags the secret along; Overlays on the table screen that cannot be dismissed; Pings, pointers and captions shown at the wrong moment; iPad Safari kills WebGL contexts under GPU memory pressure; Global rather than local un-occlusion exposes hidden areas; Secrets betrayed by rendering: silhouettes, markers, map edges.

Files: `app/src/state/idb.ts`, `app/src/state/campaign.ts`, `app/src/ui/handouts.ts (new)`, `app/src/ui/print.ts (new)`, `app/src/ui/showcard.ts`, `app/src/state/channel.ts`, `app/src/render/world.ts`, `app/src/app.ts`, `app/src/main.ts`, `app/src/styles.css`, `tests/campaign-io.test.ts`, `e2e/display.spec.ts`, `e2e/ui.spec.ts`

Risk: Medium: Safari blob quotas and the print path's memory.

### 0.14.0 · Increment 13: Campaign memory: journal, plan, NPCs and recap

- **Session journal.** IndexedDB v3 store; clock-stamped auto entries; end session; windowed list (V4).
- **Tonight and preload.** Tonight list and strip; recents; Tonight entries preloaded when the preload option is on.
- **NPC tracker.** Status, location and note; DM-only link field; real name only via Identify.
- **Recap card.** 'Previously' caption built from DM-written text plus the player names of rooms explored last session, via playersView.

Acceptance:
- Walking 1A to 1B to 2A and opening the desk gives 4 stamped entries in order.
- With 1000 entries, under 80 entry elements and an unchanged CampaignState size; nothing appears on the players' side.
- Each plan entry is reached in 2 taps or fewer. Preload on: no scene.json request when opening a Tonight entry.
- Moving Ireena to N1 lists her in the N1 panel; her players' name changes only after Identify.
- The recap payload contains no DM note, real name of a hidden or unidentified creature, or unrevealed room name (player-safety fuzz).
- journal.test and campaign-io pass. Controls pass the phone sweep.

Pitfalls guarded: Campaign memory lives on paper; Browser storage silently evicted; Updates and schema changes break a live campaign; Showing a picture or card drags the secret along; Visibility inherited from another object's permission.

Files: `app/src/state/idb.ts`, `app/src/core/journal.ts (new)`, `app/src/ui/journal.ts (new)`, `app/src/ui/plan.ts (new)`, `app/src/ui/library.ts`, `app/src/ui/bestiary.ts`, `app/src/state/campaign.ts`, `app/src/core/playersView.ts`, `app/src/app.ts`, `app/src/main.ts`, `tests/journal.test.ts (new)`, `tests/campaign-io.test.ts`, `tests/player-safety.test.ts`

Risk: Low-medium.

### 0.15.0 · Increment 14: Barovia pacing

- **Tarokka record.** Five DM-chosen outcomes, classified 'dm'; DM markers; optional flip of five backs.
- **Events, spies, reminders.** Events checklist; dawn/dusk spy chip; dated reminders that raise a chip when the clock reaches the day.
- **Random encounters and rest log.** core/encounters.ts. A rest chip after +1 h or +8 h; a long rest offers to clear expired conditions and reset member HP.
- **Calendar, roads, light.** 'Barovian' calendar option; road miles beside crow-flies; leg captions from DM text; scene light override in broadcast state.

Acceptance:
- Reading 'Tome: K37': DM markers appear and nothing reaches the players. no-book-content scans every 1-4-word n-gram in app/src and manifests against tests/fixtures/tarokka-titles.sha256 (distinctive titles only, hashed).
- The flip payload has no slot purpose or location.
- Crossing 17:00 raises the spy chip once, on the DM screen only. A reminder for day 5 appears when the clock reaches day 5.
- With tests/fixtures/encounters-forest.json loaded, a forest-night roll returns a creature from that set and Place adds hidden tokens. Without the fixture, the table is empty.
- +8 h at 22:00 shows the rest chip. Ignoring it leaves state and the sky tests unchanged. Accepting a long rest clears an expired condition and resets HP.
- Barovian calendar: sunrise at 07:00. Harptos default: existing tests unchanged.
- Tser Pool to the crossroads shows the road miles; the clock advance is unchanged; the footpath is flagged.
- Scene light 'night' at noon: the display's ambientNow equals the DM's; interiors unchanged; at 23:00, ring contrast is at least 3:1. Controls pass the phone sweep.

Pitfalls guarded: A random Tarokka draw wrecks pacing and spoilers reach the screen; Barovia's calendar and roads do not match generic tools; Day/night flips unexpectedly or a client pushes lighting; Atmosphere defeats readability at night and in mist; Client-side trust: the players' window receives the full DM state.

Files: `app/src/ui/reading.ts (new)`, `app/src/core/encounters.ts (new)`, `app/src/core/calendar.ts (new)`, `app/src/core/sky.ts`, `app/src/core/travel.ts`, `app/src/campaigns.ts`, `app/src/ui/worldmap.ts`, `app/src/ui/library.ts`, `app/src/main.ts`, `app/src/app.ts`, `app/src/state/campaign.ts`, `manifests/encounters.json`, `manifests/roads.json (new)`, `tests/encounters.test.ts (new)`, `tests/sky.test.ts`, `tests/travel.test.ts`, `tests/no-book-content.test.ts`, `tests/fixtures/ (new)`

Risk: Medium, mostly breadth. Split Tarokka and events from encounters and calendar if it runs long.

## Feature catalogue

Every gameplay feature the research found, judged against mistLAB today. "Increment" names the version that builds it; "approval" means it changes an existing feature and waits on `docs/APPROVALS.md`.

### Missing (68)

| Feature | What it does | Evidence | How it fits mistLAB | Where |
|---|---|---|---|---|
| Primary versus secondary lights | A secondary light shows only where a player light already reaches, so an enemy campfire behind a closed door does not glow through the fog. | Owlbear Dynamic Fog primary and secondary lights; Dungeon Master Map Tool per-light fog-reveal modes. [1](https://github.com/owlbear-rodeo/dynamic-fog/blob/main/docs/store.md) [2](https://github.com/Bowtie8904/DungeonMasterMapTool) | Part of approval A14: authored lights default to secondary, and the party light stays the only primary source unless the DM marks another. | approval |
| Outdoor vision limit in the Barovian mists | A per-scene cap on how far anyone sees outdoors, whatever the light. | EncounterPlus Vision Limit setting; TaleSpire per-creature vision limit. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/battle-maps/line-of-sight.md) [2](https://talespire.com/vision-limits) | A Curse of Strahd-specific rule: in daylight on the Village or Svalich Road the fog still closes in at a distance. Because it changes outdoor coverage and fog, it is approval A25. | approval |
| Lighting diagnostics: why players cannot see this | A GM overlay or hover text explaining why an area is dark to players. | Roll20's diagnostics footer and Dynamic Lighting Checklist exist because setup errors were the top support issue; many Roll20 threads report players who cannot see the map. [1](https://help.roll20.net/hc/en-us/articles/25289127045143-VTT-Quality-of-Life-Feature-Improvements) [2](https://help.roll20.net/hc/en-us/articles/360044771413-Dynamic-Lighting-Checklist) [3](https://app.roll20.net/forum/post/10835499/players-can-see-token-but-not-map) | DM-side hover reason on a dim room: Not revealed / Out of the party's light / Door closed / Another floor. Never shown on the players' side. | increment 4 |
| Animated doors and door sounds | Doors swing or slide and creak, instead of a marker flipping. | Foundry v13 animated doors and door sounds. [1](https://github.com/foundryvtt/foundryvtt/issues/11708) | Skipped (see notBuilt). | — |
| Soft-edged fog on the players' side | Feathered fog edges instead of hard cell edges. | Shard soft brush, EncounterPlus Soft Edges toggle, Owlbear Dynamic Fog edge softness; reported to read better from across a room. [1](https://www.shardtabletop.com/blog/smart-fog) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/battle-maps/line-of-sight.md) | Reads better on a TV, but it edits the fog shader shared with the DM slider, so even as an option it is approval A26. | approval |
| Reveal brush constrained to the room | The brush stops at room boundaries. | Shard Smart Fog. [1](https://www.shardtabletop.com/blog/smart-fog) | Option 'Brush stays in the room', default off (today's behaviour). | increment 4 |
| Reveal whole floor and re-fog floor | Group-wide mass reveal and reset that reach every view. | Foundry #8987 reveal-for-all; #3140 and #7613, where resets did not reach players; DDB users losing work to an accidental Reveal All. [1](https://github.com/foundryvtt/foundryvtt/issues/8987) [2](https://github.com/foundryvtt/foundryvtt/issues/3140) [3](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/216288-maps-feedback-feature-request-undo) | Two Rooms-sheet actions per level, each with one confirm. Each is recorded as a reveal-log entry, so the existing Undo reveal button reverses it. They never touch secret doors, hidden objects, slots or door state. | increment 4 |
| Hover preview of a room reveal | Hovering outlines what a click would reveal and warns when the room leaks into a neighbour. | Dungeon Master Map Tool's Reveal room preview. [1](https://github.com/Bowtie8904/DungeonMasterMapTool) | With the Reveal tool active, the DM sees the cell outline and a warning such as 'room open to 2A'. | increment 4 |
| Lock reveals while the DM repositions | Suspend auto-reveal so dragging tokens around never exposes rooms. | DM Cast documentation advises turning off 'torch follows DM movement' to avoid mid-drag spoilers. [1](https://netox.itch.io/dungeon-map-cast/devlog/1104195/dm-cast-v110-major-update) | A 'Lock reveals' toggle, default off, with a lock chip on the DM screen. Making DM free moves reveal only the destination is approval A13. | increment 4 |
| Players' window receives only the players' view | The message that leaves the DM context is already filtered, so a player client never holds DM data. | WVTT enforces hidden information before it reaches clients; in TaleSpire #531 a player could see everything the GM had. [1](https://github.com/mastervash/wvtt) [2](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/531) | channel.ts posts the whole CampaignState to ?display=player. core/playersView.ts projectState() drops every key classified 'dm' before sending, with no visible change to the display. Stripping hidden tokens' real names joins approval A2, and the LAN relay is blocked until both ship. | increment 1 |
| Automatic bloodied and down visuals with descriptive health for players | A bloodied marker at half HP and a down state at 0; players see words, the DM sees numbers. | DDB Maps automatic Bloodied/Dead; Health Estimate; Owlbear Simple HP Tracker. [1](https://www.dndbeyond.com/changelog) [2](https://github.com/mclemente/healthEstimate) [3](https://raw.githubusercontent.com/jtaccinelli/simple-hp-tracker/refs/heads/main/docs/store.md) | This changes how tokens render to players, so it is approval A11. Numbers stay DM-only. | approval |
| Auras attached to a token | A radius that follows a token and hides with it. | Roll20 auras, EncounterPlus auras, Owlbear Auras and Emanations. [1](https://help.roll20.net/hc/en-us/articles/360039674573-Token-Features) [2](https://raw.githubusercontent.com/desain/owlbear-emanation/main/docs/store.md) | Cells on the token's floor computed by core/range.ts. Players see only the shape, with no text, and nothing while the token is hidden. | increment 10 |
| Fly flag on a token | Flying tokens are not stopped by pits or terrain blockers. | Foundry v13 movement types; Elevation Ruler. [1](https://foundryvtt.com/releases/13.341) [2](https://github.com/caewok/fvtt-elevation-ruler) | Per-token 'Flying' toggle, default off, that skips terrain blockers in movement. Walls and closed doors still block. | increment 10 |
| Cross-level openings (balconies, shafts) | Openings and elevated surfaces visible across levels. | Foundry v14 Reveal Elevated Surface. [1](https://foundryvtt.com/releases/14.355) | Skipped (see notBuilt). | approval |
| Condition picker with badges on tokens and in the tracker | Standard conditions from a picker, drawn as pips on the token and listed beside the combatant. | Foundry status effects, DFreds Convenient Effects, Roll20 markers, DDB conditions, Owlbear Condition Markers. [1](https://github.com/DFreds/dfreds-convenient-effects) [2](https://raw.githubusercontent.com/SeamusFinlayson/conditionmarkers/main/docs/store.md) [3](https://www.dndbeyond.com/changelog) | Screen-space pips on revealed tokens: at least 10x10 px on a phone and at least 18 px on the display, solid background, three plus '+n'. Never shown on hidden tokens. The DM taps a pip for the SRD definition. | increment 9 |
| Coloured-ring condition mode | Conditions drawn as coloured rings around the base, with a gap so the name stays readable. | Owlbear Colored Rings (first-party) and Colored Shapes. [1](https://raw.githubusercontent.com/owlbear-rodeo/colored-rings/main/docs/store.md) [2](https://raw.githubusercontent.com/anthonyhauck/colored-shapes/main/docs/store.md) | Option 'Conditions as rings', default pips, for crowded fights. | increment 9 |
| Durations in rounds and turns with automatic expiry | Effects such as 'until end of X's next turn' drop off as the tracker advances. | FGU effects, Foundry Times Up; DDB users list it among the 32 features missing from Maps. [1](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996642031/5E+Effects+for+Advanced+Automation) [2](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/228828-32-features-missing-from-the-mapsvtt-roadmap) | Conditions carry until {round, turnOf}; nextTurn expires them, and the display mirrors the result (ROADMAP V2). | increment 9 |
| Skip downed combatants and hide defeated foes from players | Creatures at 0 HP are skipped by Next and removed from the players' side. | Monk's Combat Details auto-hides defeated foes; Simple HP Tracker shows 'Down'. [1](https://github.com/ironmonk88/monks-combat-details) [2](https://raw.githubusercontent.com/jtaccinelli/simple-hp-tracker/refs/heads/main/docs/store.md) | Two options, both default off: 'Skip downed in turn order' and 'Hide defeated foes from players'. Making them the default is approval A30. | increment 9 |
| Turn marker ring under the active combatant | An animated ring under whoever's turn it is, fading once they move. | Foundry v13 core turn markers; Monk's Combat Marker auto-hides after the first move. [1](https://github.com/ironmonk88/monks-combat-marker) [2](https://foundryvtt.com/packages/combatbooster) | Display option, default off, for revealed combatants only. The players'-side ring requires approval A2. | increment 9 |
| 'Your turn / next up' banner on the table screen | A large on-screen notice for the current and next combatant. | Monk's Combat Details large animated notices. [1](https://github.com/ironmonk88/monks-combat-details) | Option, default off: a lower-third banner, at least 18 px and AA contrast, for revealed combatants. Requires approval A2. | increment 9 |
| Combat that survives a location change | The encounter follows the combatants onto another map. | Foundry v13 unlinked combats from scenes. [1](https://foundryvtt.com/releases/13.341) | Approval A16. | approval |
| Clickable dice and DC text in notes | Dice expressions inside notes and stat blocks roll in place. | Foundry inline rolls; EncounterPlus auto-detects dice in traits. [1](https://foundryvtt.com/article/macros/) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/dice.md) | A parser turns NdM+K and 'DC 12' in DM notes and blocks into DM-only roll buttons. | increment 8 |
| Rules quick-reference sheet | SRD tables to hand. | Owlbear DM Screen; Foundry GM Screen. [1](https://raw.githubusercontent.com/johneckert/owlbear-dmscreen/main/docs/store.md) [2](https://calego.itch.io/gm-screen) | A DM-only sheet and glossary tooltips built from srd-rules.json. | increment 8 |
| Roll log with timestamps | Every roll logged with its time. | Owlbear OBR Tracker. [1](https://github.com/redweller/obr_tracker) | A DM-only log stamped with the campaign clock, classified 'dm' in the projection. | increment 8 |
| Area-of-effect templates in grid cells, stopping at walls | Sphere, cone, line and cube templates computed by grid distance. | Foundry grid-based template shapes (#10476), Walled Templates, EncounterPlus, DDB, SpellTable. [1](https://github.com/foundryvtt/foundryvtt/issues/10476) [2](https://github.com/caewok/fvtt-walled-templates) [3](https://github.com/paulpaul168/SpellTable) | Cell sets from core/range.ts on square and hex grids, stopping at walls. Players see the cells only, with no text. Persistent named zones stay until cleared (ROADMAP V5, moved earlier). | increment 10 |
| Distances from a token to every visible creature, including height | Height-aware distances from the selected token. | Owlbear Character Distances; FGU 5E Enhancer. [1](https://raw.githubusercontent.com/Croebh/owlbear-distances/main/docs/store.md) [2](https://github.com/StyrmirThorarins/FG-5E-Enhancer) | A DM-only list in the token panel, using floor elevations. | increment 10 |
| Pings with modes and an off-screen arrow | Hold to ping; ripple only, pan the display there, or both; an edge arrow when the point is off-screen. | Foundry Pings, Roll20 ping, EncounterPlus Point / Camera Move / Camera Point. [1](https://foundryvtt.com/article/pings/) [2](https://wiki.roll20.net/Ping) [3](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/battle-map.md) | A Pointer tool only, never a side effect. Pings draw only inside revealed rooms and are suppressed while the display is curtained, frozen or showing an overlay. | increment 6 |
| Large controls setting | Enlarged HP and initiative entry for fingers. | EncounterPlus 'Large' input windows; TouchVTT enlarged buttons. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/combat.md) [2](https://github.com/Oromis/touch-vtt) | Option 'Large controls', default off: HP, initiative and turn-bar buttons at least 56 px. | increment 3 |
| Freehand drawing and DM-only scribbles | Lines, shapes and text on a player layer or a GM layer. | Roll20 layers, DDB Draw, EncounterPlus DM layer. [1](https://help.roll20.net/hc/en-us/articles/360039675053-Layers) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/battle-maps/drawing-and-effects.md) | Skipped (see notBuilt). | — |
| Props and stickers dropped mid-session | Drop rubble, fire or corpses onto a map. | DDB Maps stickers; Owlbear Prop type. [1](https://www.dndbeyond.com/changelog) | Skipped (see notBuilt). | — |
| Improvised battle map | A generic road, forest or clearing map, opened instantly when an unplanned fight breaks out, to drop creatures on. | TaleSpire reviews give 20-40 minutes to build an encounter and say improvising is hard; Sigil prep criticism. [1](https://advancedrpgs.com/talespire-review-3d-battle-maps-table-use-and-limits/) [2](https://dungeonsanddragonsfan.com/sigil-vtt-shut-down/) | Two new kit-built scenes ('Svalich road', 'Forest clearing') in a Library 'Improvise' section, plus 'Fight here' on the world-map wilderness card. Creatures go in with the existing Place by tap. No authoring at the table. | increment 11 |
| DM's own notes on anything plus a session pad | GM-private notes pinned to keys, objects, tokens and pins. | Foundry map notes, DDB Scene Prep, Roll20 Map Pins, Owlbear Map Location Keys. [1](https://foundryvtt.com/article/journal/) [2](https://www.dndbeyond.com/posts/2236-how-to-use-scene-prep-d-d-beyonds-new-prep-tool) [3](https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins) | CampaignState.notes, classified 'dm' in the projection. Textareas autosave, and global shortcuts ignore them (ROADMAP V2). | increment 7 |
| Honest labels for partial and unmapped content | A 'partial' badge on unfinished maps and 'No battle map here yet' on unmapped spots. | Over-promising complaints about Menyr and DDB Maps. [1](https://steamcommunity.com/app/2499260/discussions/) [2](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/229375-first-impressions-of-ddb-and-maps-vtt) | Library badge for Castle Ravenloft and DM pin cards for unmapped chapter 2 spots (task #68). | increment 7 |
| Movable, collapsible panels with saved layout | Panels can be collapsed to a strip, moved, and their layout remembered. | Groupfinder praise for a clean interface; FGU window-clutter complaints. [1](https://groupfinder.gg/library/owlbear-rodeo) [2](https://steamcommunity.com/app/1196310/discussions/0/3049482570175423082/) | New panels collapse to a strip. Moving existing panels (task #69) changes the layout, so it is approval A29. | approval |
| Show a creature, object or read-aloud caption to the table | Push a card or text to the players' screen; only the DM dismisses it. | DDB Reveals, Owlbear Theatre!, Foundry Show Players, EncounterPlus overlays. [1](https://screenrant.com/dnd-beyond-maps-reveals-update/) [2](https://extensions.owlbear.rodeo/theatre) [3](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/player-screen.md) | Payloads come only from playersView, text is at least 18 px with AA contrast, and an overlay has Clear, auto-clear and a 'Showing' chip (ROADMAP V3). | increment 6 |
| Call for a roll banner | The GM asks the table for a save or check with the DC hidden. | Monk's TokenBar, Roll20 GroupCheck, FGU party sheet. [1](https://github.com/ironmonk88/monks-tokenbar) [2](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641997/5E+Party+Sheet) | A card on the display with no DC, and a DM-only tick list of who passed. | increment 6 |
| Handout library shown on the table screen | DM-imported images and text, shown full screen and rotatable. | Roll20 handouts, DDB Custom Reveals, Dungeon Master Map Tool rotate and mirror. [1](https://wiki.roll20.net/Journal) [2](https://github.com/Bowtie8904/DungeonMasterMapTool) | Blobs in IndexedDB, each with an explicit visibility state. Linking a handout to a key, pin or NPC never changes its visibility (ROADMAP V3). | increment 12 |
| Link field on NPCs and handouts | An optional URL on an entry (wiki, PDF, sheet). | Owlbear External Links; Sheet from Beyond. [1](https://raw.githubusercontent.com/GravityDeficient/obr-external-links/main/docs/store.md) | A DM-only field that opens in a new tab and is classified 'dm'. It is never sent to the display. | increment 12 |
| Ambient audio and playlists | Scene music and ambience. | Foundry playlists, Arkenforge, Kenku FM. [1](https://foundryvtt.com/article/ambient-sound/) [2](https://github.com/owlbear-rodeo/kenku-fm) | Skipped (see notBuilt). | — |
| Curtain, blank and freeze for the table screen | Blank the players' screen, freeze it, or fade it during loads. | EncounterPlus themes, SpellTable blanking, Dungeon Master Map Tool Freeze, Foundry v14 transitions. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/external-screen.md) [2](https://github.com/paulpaul168/SpellTable) [3](https://github.com/Bowtie8904/DungeonMasterMapTool) | Curtain and Freeze toggles, plus a 'curtain during location loads' option that defaults off. Theatre-of-the-mind scenes get a one-tap blank. | increment 5 |
| Viewbox and display-connected indicator | The DM sees the players' frame and knows whether the display is live. | LockView viewbox, Dungeon Master Map Tool player-view rectangle, Dungeon Revealer LIVE indicator. [1](https://github.com/MaterialFoundry/LockView/wiki) [2](https://github.com/dungeon-revealer/dungeon-revealer) | Display frame drawn on the minimap, and a top-bar chip driven by a 2 s heartbeat. | increment 5 |
| Display rotation, safe-area margins and turn-bar position | Rotate the table view on its own, keep chrome inside the bezel, choose where the tracker sits. | Crit VTT player-only rotation; EncounterPlus margins and overscan. [1](https://github.com/themightyzq/Crit-VTT) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/external-screen.md) | Per-display options stored in the display's own localStorage; defaults match today. | increment 5 |
| Floor name chip and date/time chip on the table screen | Players see which floor they are on and the in-game day and hour. | TaleSpire floor confusion; Levels ISSUES; Simple Calendar player view. [1](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/844) [2](https://github.com/vigoren/foundryvtt-simple-calendar) | Both are options, default off. The floor chip names the party's level, and only while the display shows that level. The date chip is read-only. | increment 5 |
| Physical-scale table mode for miniatures | An overhead view where one square equals one inch. | EncounterPlus TableTop Mode, LockView autoscale, Arcane Atlas. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/external-screen.md) [2](https://github.com/EricEngineering/ArcaneAtlas) | Skipped (see notBuilt). | — |
| Player Display on other devices over the LAN | A TV browser or phones join by QR code. | EncounterPlus web client, Dungeon Revealer. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/remote-play.md) [2](https://github.com/dungeon-revealer/dungeon-revealer) | Deferred (see notBuilt). It is blocked until the projection, A2 and hidden-token stripping have shipped. | — |
| Weather particles, outdoors only | Rain, snow and heavier mist. | FXMaster, Owlbear Weather. [1](https://foundryvtt.com/article/year-in-review-2025/) | Skipped (see notBuilt). | — |
| Clock advancing 6 seconds per round | Initiative rounds advance the in-game clock. | Simple Timekeeping. [1](https://foundryvtt.com/packages/simple-timekeeping) | Approval A17. | approval |
| Random encounters by terrain and time | Roll an encounter by terrain and day or night. | Roll20 rollable tables; encounters.json exists. [1](https://raw.githubusercontent.com/thp21000/loot-tables-for-OBR/main/public/store.md) | core/encounters.ts. Rows are filled by the DM locally (ROADMAP V4). | increment 14 |
| Strahd's spies at dawn and dusk | Daily and nightly spy checks. | Reloaded spy table. [1](https://github.com/DragnaCarta/Curse-of-Strahd-Reloaded/blob/main/Chapter%203%20-%20Running%20the%20Game/Running%20the%20Adventure.md) | DM-only chip and list, classified 'dm'. | increment 14 |
| Tarokka reading record with a table reveal | The DM fixes the five outcomes; the table watches the cards flip. | tarokka.com, mcdoh/tarokka, Foundry modules. [1](https://github.com/mratzloff/tarokka) [2](https://github.com/mcdoh/tarokka) | DM-chosen and classified 'dm'. The flip sequence carries no text and no card text ships. | increment 14 |
| Session journal | An automatic, clock-stamped campaign log. | DDB Journals; the Realmweaver study. [1](https://www.dndbeyond.com/changelog) [2](https://github.com/DaveGerson/Realmweaver/blob/main/docs/design/dm-archetypes.md) | Its own IndexedDB store, DM-only (ROADMAP V4). | increment 13 |
| Players'-safe 'previously on' recap | A recap of the last session shown on the table screen. | DDB forum requests for session summaries; in-person tools treat the TV as a first-class surface. [1](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/229375-first-impressions-of-ddb-and-maps-vtt) | DM-written text plus the player names of rooms explored last session, sent as a caption card through playersView. | increment 13 |
| Tonight's plan, recents and preloading | A prep list, one-tap jumps, and warm loads. | Crit VTT and Dungeon Master Map Tool recents; Foundry Preload Scene. [1](https://github.com/themightyzq/Crit-VTT) [2](https://foundryvtt.com/article/scenes/) | Increment 2 preloads recents (option). Increment 13 adds the Tonight list and preloads its entries. | increment 13 |
| NPC tracker | Status, location and attitude for each NPC. | cos-universe; Realmweaver names NPC tracking as a top pain. [1](https://github.com/marc-gardiner/cos-universe) | An NPCs tab. The real name reaches players only through the explicit Identify action. | increment 13 |
| Stage keyed NPCs and start the encounter from the room | Place a key's NPCs hidden, and start initiative with the room's creatures in one tap. | Shard one-click drop; DDB add all tokens to the encounter. [1](https://www.dndbeyond.com/posts/1816-the-official-d-d-vtt-navigating-maps-on-d-d-beyond) | Stage places characters.json NPCs tagged to the key, hidden. 'Start encounter here' rolls tokens already in the room. Both require approval A2. | increment 11 |
| Encounter scaling by party size | Creature counts per party size. | Reloaded combat template. [1](https://github.com/DragnaCarta/Curse-of-Strahd-Reloaded/blob/main/_other/templates/combat.md) | A count multiplier from roster size on Place here and Place by tap. | increment 11 |
| Numbered duplicate creatures | Wolf 1, Wolf 2. | Roll20 TokenNameNumber; EncounterPlus. [1](https://app.roll20.net/forum/post/10374311/5e-must-have-macros-apis-addons-etc) | Options, default off, for DM names and for player aliases. | increment 11 |
| Campaign export, persistent storage, snapshots and backup nudge | Own the data, with an iOS share-sheet path. | Owlbear 1.0 data-loss post-mortem; EncounterPlus backups; vwag-table export advice. [1](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/advanced.md) [3](https://github.com/nickodimus/vwag-table) | persist() status shown in Help; Export uses navigator.share({files}) where canShare, otherwise a download; Import; rolling snapshots; a 'Back up campaign' chip after 2 h without an export (ROADMAP V1). | increment 1 |
| Non-goals in Help | State what the tool does not do. | TabletopFog and Crit VTT 'what it does NOT do' sections. [1](https://github.com/TheFirstCaptain/TabletopFog) [2](https://github.com/themightyzq/Crit-VTT) | A Help section listing remote play, accounts, player dice, character sheets and rules automation as non-goals. | increment 1 |
| Save picture and print a floor plan | A PNG of the view and a printable plan per level. | TaleSpire screenshot mode; FGU print. [1](https://foundryvtt.com/packages/gambitsImageViewer) | DM-only. The players' version renders at t=0. Printing renders levels one by one into the main renderer, at most 2048 px each (ROADMAP V3). | increment 12 |
| WebGL context-loss recovery | Rebuild the renderer from state. | Apple forum threads on Safari context loss. [1](https://developer.apple.com/forums/thread/778735) | Handlers that reopen the current location and level. | increment 2 |
| Never swap the app version mid-session | Updates apply on next launch. | Foundry #12690. [1](https://github.com/foundryvtt/foundryvtt/issues/12690) | sw.js calls skipWaiting today, so changing this is approval A20. | approval |
| Marching order and single-file movement | Party members move in formation or follow the leader. | EncounterPlus Standard and Snake modes. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/battle-maps/tokens.md) | Outside initiative the party is one token, so formation is moot; inside initiative each member moves on their own turn. Skipped (see notBuilt). | — |
| Split the party | A scout with its own vision. | SharedVision. [1](https://github.com/CDeenen/SharedVision) | Deferred (see notBuilt). | — |
| DM's own PDF at the page | Open the DM's book at the referenced page. | PDF readers in EncounterPlus and Owlbear. [1](https://raw.githubusercontent.com/owlbear-rodeo/extensions/main/extensions.json) | Deferred (see notBuilt). | — |
| Cover and line-of-sight check | Drag from attacker to target to see clear or blocked sight lines. | Owlbear Peekaboo. [1](https://raw.githubusercontent.com/desain/owlbear-peekaboo/main/docs/store.md) | Skipped (see notBuilt). | — |
| Prefabs and saved encounters | Save a group of tokens and drop it later. | Owlbear Prefabs. [1](https://raw.githubusercontent.com/owlbear-rodeo/prefabs/main/docs/store.md) | Skipped (see notBuilt). | — |
| Spoiler-stripped player companion | Players read notes on their phones. | cnorick vault scripts. [1](https://github.com/cnorick/curse-of-strahd-notes) | Skipped (see notBuilt). | — |

### Partial (43)

| Feature | What it does | Evidence | How it fits mistLAB | Where |
|---|---|---|---|---|
| Darkvision drawn as greyscale on the players' side | Cells seen only through darkvision render without colour; lit cells keep their colour. | Foundry Darkvision mode, Roll20 Nocturnal Vision, and AboveVTT darkvision presets added after user requests. [1](https://foundryvtt.com/article/tokens/) [2](https://wiki.roll20.net/Updated_Dynamic_Lighting) [3](https://github.com/cyruzzo/AboveVTT/issues/899) | core/light.ts perceive() already returns grayscale, but nothing renders it. It needs a fog-shader branch shared with the slider, so it is approval A12. Colour is decided per cell by light level, never by which token is selected. | approval |
| Placed and carried light sources, toggleable | Torches, lanterns and braziers with bright and dim radii that can be lit, doused, dropped or carried, and that feed vision. | Foundry ambient lights and the Torch module, the Roll20 Torch script, Owlbear Dynamic Fog lights, EncounterPlus lights. [1](https://foundryvtt.com/releases/13.341) [2](https://github.com/GregoryWarn/torch) [3](https://wiki.roll20.net/Script:Torch) | Token.light and LIGHT_PRESETS exist, but only the party torch drives vision. Letting authored lights feed vision is approval A14. DM-dropped light tokens wait on that approval (see notBuilt). | approval |
| Scene darkness driven by the clock, with a manual override | One scene-level darkness value that normally follows the in-game hour and that the DM can override for a scene. | Foundry Darkness Level and calendar modules, Roll20 Daylight Mode, TaleSpire and Menyr time of day; Foundry #10194 asks for a way to lock darkness. [1](https://foundryvtt.com/article/scenes/) [2](https://foundryvtt.com/packages/simple-timekeeping) [3](https://github.com/foundryvtt/foundryvtt/issues/10194) | Outdoor maps already follow the hour and moon. Add a View-menu option, Scene light: follow clock / day / dusk / night, defaulting to follow clock. It travels in broadcast state; interiors keep their authored ambient. | increment 14 |
| Wall roles: window, terrain, invisible, ethereal | Walls carry separate movement and sight flags, so a window passes sight but blocks movement. | Foundry's six wall types; FGU line-of-sight windows and terrain; UVTT exporters. [1](https://foundryvtt.com/article/walls/) [2](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996640584/Map+Line+of+Sight+Style+Guide) [3](https://github.com/foundry-vtt-community/wiki/blob/main/Walls.md) | Terrain blockers exist (Blocker.terrain); there is no window role. Adding one changes walking, vision and authored data, so it is approval A15. | approval |
| Secret doors, traps and hidden things reachable from a list | Reveal a secret door or hidden object from a list instead of having to hit it on the map. | Foundry secret-door conversion, Roll20 GM layer complaints; mistLAB bug 7 (the library secret door cannot be tapped). [1](https://foundryvtt.com/article/walls/) [2](https://app.roll20.net/forum/post/4938393/gm-info-layer-nearly-useless) | The Rooms sheet lists secret doors, traps, hidden objects and creature slots under each room, each with an eye and Frame. DM labels for them become clickable (ROADMAP V1). The pick-priority change itself is approval A7. | increment 3 |
| Manual fog by shape: room, rectangle, brush | Reveal or hide by room, rectangle or brush, snapped to the grid, with each stroke undoable. | Roll20 Hide/Reveal, Owlbear polygon and rectangle fog, DDB polygonal fog, Shard soft brush, Dungeon Revealer, TabletopFog. [1](https://docs.owlbear.rodeo/docs/fog/) [2](https://github.com/dungeon-revealer/dungeon-revealer) [3](https://github.com/themightyzq/Crit-VTT) | Room reveal, brushes and the persisted reveal undo exist. Add a rectangle-of-cells mode to the Reveal tool, recorded as one reveal-log entry so the existing Undo reveal button covers it. Hidden things inside the rectangle stay hidden. | increment 4 |
| Never show a floor the party has not reached | A per-floor hide, so the players' view never shows another level. | TaleSpire hide volumes; the Foundry #14409 cross-level leak. [1](https://talespire.com/faq) [2](https://github.com/foundryvtt/foundryvtt/issues/14409) | Unexplored floors are fogged, but Players mode exposes the Floor and Section controls (bug 5); sealing them is approval A1. The optional floor chip in increment 5 names only the party's own level. | approval |
| Token HUD with typed HP math | Type -7 or +5 into the HP field; the value clamps to range. | Foundry Token HUD math input; Owlbear Stat Bubbles inline math. [1](https://github.com/foundry-vtt-community/wiki/blob/main/Token-HUD.md) [2](https://raw.githubusercontent.com/SeamusFinlayson/Bubbles-for-Owlbear-Rodeo/master/docs/store.md) | The token panel has +/- buttons. Add a field that accepts -7 or +5 from the iPad keyboard, clamped to 0..max and undoable. | increment 8 |
| Per-token size override | The DM sets a token's size category; the base ring and occupied cells follow. | TaleSpire #26 lists mislabelled sizes and asks for DM resizing; EncounterPlus token size. [1](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/26) | The base ring already scales by size category. Add a DM size field on the token panel, defaulting to the creature record; a bestiary test asserts every entry has a valid size. | increment 8 |
| Hidden tokens visibly marked for the DM | Hidden tokens are hatched or translucent for the GM and absent for players. | Foundry hidden state, GM Vision hatching, Roll20 GM layer. [1](https://github.com/dev7355608/gm-vision) [2](https://github.com/foundry-vtt-community/wiki/blob/main/Token-HUD.md) | Option 'Mark hidden creatures', default off: a dashed ring and a hidden glyph in DM view only. | increment 4 |
| Creature 'identified' toggle | After a reveal, players see the alias until the DM marks the creature identified; then they see its real name. | FGU NPC ID toggle and non-ID name; Foundry Anonymous reveal icon. [1](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641934/5E+NPCs+and+Encounters) [2](https://github.com/reonZ/anonymous) | Tokens have playerName aliases. Add an explicit, undoable 'Identify' action in the token panel (bestiary creatures and NPCs) that sets identified=true, so players' surfaces show the real name. It never happens automatically. | increment 11 |
| Path measurement with waypoints, budget colouring and route preview | Path distance per segment, waypoints, blocked segments, and colour by movement left. | Foundry v13 drag measurement, Drag Ruler, Owlbear Path Measure, EncounterPlus advanced pathfinding. [1](https://foundryvtt.com/releases/13.341) [2](https://github.com/manuelVo/foundryvtt-drag-ruler) [3](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/battle-map.md) | A new 'Path measure' tool with waypoints; the shipped two-tap measure stays as is, and changing it is approval A24. Two options, both default off: colour the ghost ring by movement left, and draw a dashed route preview that paths around closed doors. | increment 10 |
| Send everyone's camera to where the party arrived | Place the party and pull every view to it. | Roll20 Place Party and Focus Ping; Foundry scene activation. [1](https://blog.roll20.net/posts/define-and-place-party/) [2](https://foundryvtt.com/article/scenes/) | 'Send view' and 'Frame for players' push one camera intent, in world units, to the display. | increment 5 |
| Occluded tokens and picking under roofs and the cut | Tokens stay visible and pickable when scenery covers them; picking ignores geometry that has been cut away. | TaleSpire #714, #816 and #406; Foundry TokensVisible. [1](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/714) [2](https://github.com/David-Zvekic/TokensVisible) | List access (increments 3 and 7) is the additive fallback. Changing pick order is part of approval A7. | increment 3 |
| Roll initiative for all foes, identical creatures as one group | One tap rolls every foe, optionally once per identical group. | Roll20 GroupInitiative is called a 'must have'; Owlbear GM's Grimoire; Foundry Roll NPCs. [1](https://app.roll20.net/forum/post/6684278/your-favourite-api-scripts) [2](https://raw.githubusercontent.com/kamejosh/owlbear-hp-tracker/master/docs/store.md) [3](https://foundryvtt.com/article/combat/) | Adds 'Roll all foes' and a 'same roll for identical creatures' toggle. Because it adds foes to the players' turn bar, it is enabled only once approval A2 has shipped. | increment 8 |
| Custom tracker entries and a visible round counter | A lair action at 20, reminders, and a round counter players can see. | Roll20 custom items and round calculation; years of round-counter requests. [1](https://wiki.roll20.net/Turn_Tracker) [2](https://app.roll20.net/forum/post/9639777/add-a-round-counter-to-the-initiative-tracker-or-at-the-least-some-sort-of-duration-counter) | DM custom entries that N passes through, shown to players only when ticked. The round is shown on the display. | increment 9 |
| Hidden and aliased combatants in the players' tracker | The players' turn order omits hidden combatants and shows aliases for revealed ones. | Combat Tracker Extensions, Anonymous, FGU non-ID names; mistLAB bug 4. [1](https://github.com/reonZ/anonymous) [2](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641934/5E+NPCs+and+Encounters) [3](https://app.roll20.net/forum/post/7071606/theaaron-group-init-turnmarker-hiding-names-on-combat-tracker-as-an-option) | Approval A2, recommended first. It gates the players'-side parts of increments 8, 9 and 11. | approval |
| Stat block from the token with click-to-roll | Open a monster's block from its token and roll from it. | DDB Maps, AboveVTT, Owlbear GM's Grimoire, FGU; Token Action HUD is at 24.65% installs. [1](https://www.dndbeyond.com/posts/1816-the-official-d-d-vtt-navigating-maps-on-d-d-beyond) [2](https://docs.dddice.com/docs/integrations/game-master-s-grimoire/) [3](https://foundryvtt.com/article/year-in-review-2026/) | SRD 5.1 blocks as a lazy chunk, precached through the existing sw.js 'cache-pack' message, with DM-only roll buttons (ROADMAP V2, task #38). | increment 8 |
| Private GM roller with optional show-to-table | GM-only rolls, with a deliberate option to show a result to the table. | Foundry gmroll and blindroll; EncounterPlus public/private mode. [1](https://foundryvtt.com/article/dice/) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/dice.md) | core/dice.ts with a DM-only log. 'Show result' sends a show card through the projection. | increment 8 |
| Measurement shown on the table screen | The ruler is optionally visible to everyone. | Owlbear ruler synced to all players; Roll20 waypoints. [1](https://foundryvtt.com/article/measurement/) [2](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dev-log-3/) | A per-measure 'Show to table' that draws only when both ends lie in revealed space. | increment 10 |
| Hex range overlays and a colour-blind palette | Move and strike overlays on hex grids, plus colour-blind themes. | Owlbear Ranges themes; mistLAB bug 8. [1](https://raw.githubusercontent.com/owlbear-rodeo/ranges/main/docs/store.md) | Increment 3 clears the stale square overlay; increment 10 adds hex parity and a palette option. | increment 10 |
| Diagonal rule setting | Choose 5-5-5 or 5-10-5 diagonals. | Foundry and Owlbear measurement settings; mistLAB bug 14. [1](https://github.com/foundryvtt/foundryvtt/issues/10476) [2](https://docs.owlbear.rodeo/docs/measure/) | A View-menu control backed by mistlab.diagonal, default 5-5-5. | increment 3 |
| Area panel: everything keyed to the room | One panel per key with its text, secrets, containers, doors, creatures and NPCs. | Roll20 Map Pins, DDB Scene Prep, Owlbear Map Location Keys. [1](https://raw.githubusercontent.com/alvarocavalcanti/map-location-keys/main/public/store.md) [2](https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins) | An additive DM-only drawer, opened from a new 'Panel' item in the room menu, a Rooms-row icon and a secondary button on '/' results. '/' Enter and key labels keep their current behaviour; changing them is approval A23. | increment 7 |
| Page-reference completeness and fidelity report | Every key carries a page, a description and a DM note; gaps are measured. | DDB scene data with missing pins; the muncher's known limitations. [1](https://github.com/ForgeVTT/ddb-meta-data) [2](https://github.com/MrPrimate/ddb-adventure-muncher) | scripts/fidelity-report.ts writes docs/FIDELITY.md; a test fails if coverage drops below the committed counts (ROADMAP V2). | increment 7 |
| Castle Ravenloft complete and legible | Every castle level built and readable. | Community castle-only navigators exist; ddb-meta-data has no castle scenes. [1](https://github.com/Jackson98Tomphson/Castel-Ravenloft-Interactive-Map) [2](https://github.com/ForgeVTT/ddb-meta-data) | Changes an existing scene, so it is approval A27, with the golden diff as the gate (ROADMAP V4). | approval |
| Wilderness fidelity and the mist wall | Better outdoor maps and a convincing mist border. | FEATURES calls the mist wall 'a crude column of white blobs'; Menyr and TaleSpire sell on atmosphere. [1](https://store.steampowered.com/app/2499260/Menyr/) | Changes existing scenes and visuals, so it is approval A28 (ROADMAP V5). | approval |
| Display camera modes | Mirror the DM, stay, follow the party, or follow the current combatant. | LockView, Stream View, Monk's Common Display. [1](https://github.com/MaterialFoundry/LockView/wiki) [2](https://github.com/spoidar/fvtt-module-stream-view) | The default equals today's lock toggle. Follow modes are additive options. | increment 5 |
| Undo and redo for DM actions | Ctrl-Z reverts moves, doors and containers; redo exists; the changed area is highlighted. | Foundry undo history, DDB undo requests, Dungeon Master Map Tool highlight. [1](https://foundryvtt.com/releases/13.341) [2](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/216288-maps-feedback-feature-request-undo) [3](https://github.com/Bowtie8904/DungeonMasterMapTool) | The persisted, campaign-wide reveal log and its Undo reveal button stay exactly as they are. A new session-only action history (50 entries) covers moves, level changes, doors, containers and HP. Ctrl-Z walks one session timeline in which reveal entries delegate to the existing reveals.pop(). Redo, a 1.5 s highlight and a named status line come with it. Replacing everything with one stack is approval A31. | increment 4 |
| Keyboard nudges with a focus guard | Arrow keys move the selected token one cell; shortcuts never fire inside text fields. | EncounterPlus shortcuts; TaleSpire #934 key collisions. [1](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/tips-and-tricks.md) [2](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/934) | main.ts ignores keys only on INPUT. Increment 3 extends the guard to TEXTAREA, SELECT and contenteditable; increment 4 adds the arrow nudge, clamped to level bounds. | increment 4 |
| Room entry prompts and difficult terrain | Regions fire on entry or change movement cost. | Foundry Scene Regions, Monk's Active Tile Triggers. [1](https://foundryvtt.com/article/scene-regions/) [2](https://github.com/ironmonk88/monks-active-tiles) | Option, default off: a DM-only prompt when the party enters a room with a trap or a hidden slot. Terrain cost is skipped. | increment 7 |
| Per-campaign calendar with dated reminders | Custom months, moon and sun times; notes on dates. | Simple Calendar; Reloaded's Barovian calendar. [1](https://github.com/vigoren/foundryvtt-simple-calendar) [2](https://github.com/DragnaCarta/Curse-of-Strahd-Reloaded/blob/main/Chapter%202%20-%20The%20Land%20of%20Barovia/Lore%20of%20Barovia.md) | A 'Barovian' option (default Harptos) and DM reminders on a date that raise a chip when the clock reaches the day. Making Barovian the default is approval A18. | increment 14 |
| Rests logged against the clock | Short and long rests, rest checks, and long-rest housekeeping. | Rest Recovery 5e; GM's Grimoire rest buttons. [1](https://foundryvtt.com/packages/rest-recovery) [2](https://raw.githubusercontent.com/kamejosh/owlbear-hp-tracker/master/docs/store.md) | +1 h and +8 h stay unchanged. Afterwards a chip offers to log a short or long rest; a long rest also offers to clear expired conditions and reset member HP. | increment 14 |
| Road-graph travel distances and leg captions | Per-leg road miles and times; narration per leg. | Reloaded per-leg distances and narration; the Map Tracker app. [1](https://github.com/DragnaCarta/Curse-of-Strahd-Reloaded/blob/main/Act%20I%20-%20Into%20the%20Mists/Arc%20C%20-%20Into%20the%20Valley.md) [2](https://github.com/Bosurgi/Curse-Of-Strahd-Map-Tracker) | Road figures shown beside the crow-flies figure, plus the DM's own leg text as a caption. Driving the clock by road time is approval A19. | increment 14 |
| Wake authored creature slots | Pre-placed module creatures become live tokens. | FGU encounters, DDB add all tokens. [1](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641984/5E+Combat+Tracker) [2](https://github.com/ForgeVTT/ddb-meta-data) | Requires regenerating 44 scene.json files and changes how slots render and reveal, so it is approval A22. | approval |
| Loot taken ticks | Mark container items as taken. | Item Piles, Monk's TokenBar. [1](https://github.com/fantasycalendar/FoundryVTT-ItemPiles) | A per-item tick in the area panel. | increment 7 |
| Performance guard, low power, auto quality and the display's own tier | Quality tiers and a regression guard. | WVTT auto tiers; EncounterPlus Low Power Mode. [1](https://github.com/mastervash/wvtt) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/settings/battle-map.md) | A committed baseline gated on desktop and phone; a WebKit project; an iPad release checklist. Options, all default off: Low power, Auto quality, and a separate quality tier for the display. | increment 2 |
| Non-blocking scene loading with progress and build errors | Loading shows progress, never freezes input, and reports broken objects. | foundry-3d-model-doctor; Gnome Stew on 3D Canvas lag. [1](https://github.com/charliesuits/foundry-3d-model-doctor) [2](https://gnomestew.com/a-3d-vtt-roundup-and-review/) | build.ts yields between batches; a progress bar on the DM screen; status line 'Could not build N objects'. | increment 2 |
| Touch layout on phones with tappable controls | 44 px targets and menus that stay inside the viewport. | Foundry #9060; mistLAB bug 3. [1](https://github.com/foundryvtt/foundryvtt/issues/9060) | CSS fix behind a phone-only breakpoint (max-width 600 px), so iPad portrait layouts are unchanged; phone and phone-landscape projects added. | increment 3 |
| Enter a building from anything you tap | Every keyed building tap offers Enter. | mistLAB bug 2. [1](https://github.com/foundryvtt/foundryvtt/issues/4554) | An 'Enter' item added to object cards (ROADMAP V1). | increment 3 |
| Camera presets, bounded follow and one reachable Find party | Stop steering: presets, home, double-tap to frame. | TaleSpire #126, #134, #199; WVTT recentre. [1](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/126) [2](https://github.com/mastervash/wvtt) | Presets exist. Find party becomes reachable on phones in increment 3. A north-up overhead preset is approval A8. | increment 3 |
| Label declutter including token tags | Tags and keys never overlap. | mistLAB bug 13; DDB shrank its token menu. [1](https://www.dndbeyond.com/changelog) | Approval A9. Pips get their own declutter kind in increment 9. | approval |
| Portrait-card initiative strip | Combatant cards with art. | Combat Carousel. [1](https://github.com/death-save/combat-carousel/wiki) | Skipped (see notBuilt). | — |
| Pop-out DM panels | Sheets in separate windows. | PopOut!. [1](https://www.foundryvtt-hub.com/package/popout/) | Skipped (see notBuilt). | — |

### Have (9)

| Feature | What it does | Evidence | How it fits mistLAB | Where |
|---|---|---|---|---|
| Line-of-sight vision from walls with a per-token sight radius | Walls and doors block sight; each token has a light or sight radius, and players see the union of what their tokens see. | Core in Foundry, Roll20 UDL, FGU, Shard, EncounterPlus, Arkenforge and AboveVTT; Owlbear offers it through Dynamic Fog. DDB Maps users call its absence a non-starter. [1](https://foundryvtt.com/article/walls/) [2](https://help.roll20.net/hc/en-us/articles/360039675053-Layers) [3](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/228828-32-features-missing-from-the-mapsvtt-roadmap) | Already derived from the party torch (20/40 ft) and darkvision over authored walls, doors and rooms per level (core/coverage.ts, core/light.ts). Keep the authored room graph rather than per-frame raycasts. The remaining gap is the unexplored-wall silhouette leak (approval A3), not the model. | — |
| Doors with open, closed, locked and secret states | Doors are wall segments with a control; players open unlocked ones, locked ones need the GM, and secret doors look like wall. | Foundry walls, Roll20 UDL doors, Owlbear Smoke and Spectre, FGU line-of-sight doors, UVTT portals. [1](https://foundryvtt.com/article/walls/) [2](https://extensions.owlbear.rodeo/smoke) | Keep. On the players' side, door markers stay derived from the revealed-room set on every commit. | — |
| Explored memory distinct from live vision | Areas already seen stay visible in a muted style; never-seen areas stay fogged. | Foundry fog exploration, Roll20 Explorer Mode, FGU, Arkenforge. [1](https://foundryvtt.com/article/scenes/) [2](https://wiki.roll20.net/Advanced_Fog_of_War) | Shipped per level. Keep the explored style distinct from live light. | — |
| Shared party exploration | One exploration record for the whole party. | Foundry v14 shared fog mode (#13672); Roll20's per-token AFoW was criticised. [1](https://github.com/foundryvtt/foundryvtt/issues/13672) [2](https://wiki.roll20.net/Advanced_Fog_of_War) | The single party token gives this by construction. A future scout must keep one union record per level. | — |
| Native stacked floors with a section cut | Multi-level scenes with per-floor vision and a world-space cut. | Foundry v14 Scene Levels and the Levels module; TaleSpire cutbox complaints (#543, #546). [1](https://www.foundryvtt.store/news/2026-04-01-foundry-vtt-v14) [2](https://github.com/Bouncyrock/TaleSpire-Beta-Public-Issue-Tracker/issues/543) | mistLAB is ahead here. Protect it with a Castle Ravenloft 'Whole' (332 ft) perf and cut row in increment 2; the stair fix is approval A5. | — |
| Player text kept separate from DM notes | Every object has a player description and GM-private notes. | Roll20 Bio vs GM Notes threads. [1](https://app.roll20.net/forum/post/6856662/gm-showing-a-pic-of-a-monster-but-not-bio-to-players) | Already split. Every new surface reads only the player field. | — |
| Second output on an external screen | The player view as a window, a cast, AirPlay or HDMI. | Owlbear Presentation API, DDB Spectator, EncounterPlus AirPlay. [1](https://docs.owlbear.rodeo/docs/casting/) [2](https://apps.apple.com/us/app/encounter-virtual-tabletop/id1170693487) | The popup exists. A 'Present' button appears only where navigator.presentation exists. | increment 5 |
| Minutes to first map with prebuilt module content | Open and play with no configuration. | Owlbear's praised simplicity; TaleSpire build time. [1](https://alternativeto.net/software/owlbear-rodeo/about/) | 44 built locations. Every new feature defaults off or collapsed. | — |
| GM vision: see everything, peek at the players' view | Translucent GM fog and a one-tap peek at what players see. | GM Vision, Less Fog. [1](https://github.com/dev7355608/gm-vision) [2](https://github.com/trdischat/lessfog) | The slider and peek button. Keep their curves stable. | — |

### Not-applicable (8)

| Feature | What it does | Evidence | How it fits mistLAB | Where |
|---|---|---|---|---|
| Detection senses (tremorsense, blindsight) | Per-token detection modes decide which hidden or invisible tokens a token perceives. | Foundry detection modes; FGU vision types. [1](https://foundryvtt.com/article/tokens/) [2](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/1315930113/Player+and+NPC+Token+Vision+on+Maps) | With one shared screen and one party token, the DM adjudicates special senses by revealing the creature. Per-sense views would need a screen per player. | — |
| Universal VTT (.dd2vtt) import and export | JSON walls, portals and lights so maps move between VTTs. | Roll20 native UVTT, the Foundry importer, the Owlbear scene-importer. [1](https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support) [2](https://github.com/Eppinguin/scene-importer) | Every map is authored, so import has no use, and exporting to other VTTs falls outside the physical-table lens. | — |
| Long-press as the touch context menu | Long press opens what right-click opens. | EncounterPlus and TouchVTT long-press menus. [1](https://github.com/Oromis/touch-vtt) [2](https://raw.githubusercontent.com/encounterplus/docs/main/src/content/docs/guides/tips-and-tricks.md) | mistLAB has no right-click menus: every menu already opens on a tap. Long-press is reserved for the ping hold in increment 6, so no gesture means two things. | — |
| Player phones that act (seats and permissions) | Players move their own token from their phones. | Arcane Atlas, EncounterPlus interaction levels. [1](https://github.com/EricEngineering/ArcaneAtlas) | mistLAB is single-device; this needs the relay and approval A1 first. | — |
| Touch table: players move tokens on the TV | Touches on the shared screen move tokens. | TouchVTT, Arkenforge touch client. [1](https://github.com/Oromis/touch-vtt) | The display ignores input by design. | — |
| Rules-effects automation | Effects that modify rolls. | FGU effects, Midi QoL. [1](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996642031/5E+Effects+for+Advanced+Automation) | Players roll physical dice. | — |
| 3D dice, chat, voice, character sheets | Shared dice, chat and full character sheets. | Dice So Nice installed in 55% of Foundry worlds. [1](https://foundryvtt.com/article/year-in-review-2026/) | Physical dice and paper sheets stay at the table. | — |
| Spell and attack animations | Animated effects. | Sequencer. [1](https://foundryvtt.com/article/year-in-review-2025/) | A brief flash when a template is placed (increment 10) gives the same beat. | — |

## Deliberately not built

| Feature | Why not |
|---|---|
| Split the party (scout with its own vision) | Needs a cached multi-source coverage union and handling for encounter edge cases (ROADMAP V3); planned for after this plan. |
| Toggleable authored lights and DM-dropped light tokens | Depends on approval A14 and the multi-source coverage union; risky for Vallaki's frame rate. |
| Player Display and phones over the LAN | Adds the first runtime dependencies and a server process. Blocked until the projection (increment 1), A2 and hidden-token stripping have shipped. |
| Player phones that act, and the touch table | Needs the relay and approval A1 (ROADMAP V5). |
| DM's own PDF at the page | pdf.js memory use on iPad Safari (ROADMAP V5). |
| Physical-scale table mode | Needs an orthographic display camera and per-screen calibration. |
| Weather particles and mood presets | Frame cost on the iPad; the mist-wall work is approval A28. |
| Ambient audio | There is one speaker at the table, and autoplay needs a tap on the display. |
| Animated doors and door sounds | The marker flip already conveys the state; animation costs frames. |
| Freehand drawing | Pings, captions and templates cover pointing; drawing on a 3D map needs a projected layer. |
| Props and stickers | Needs a prop store and picking; low value against fully authored scenes. |
| Universal VTT export | Outside the physical-table lens. |
| Cross-level balcony vision | Waits for the castle authoring work (A27). |
| Difficult terrain regions | Adds data across all 44 scenes for little value at the table. |
| Cover check tool | The DM judges cover on the 3D view. |
| Prefabs and saved encounters | Staging and the improvised maps cover the need. |
| Detection senses | Would need a screen per player. |
| Marching order and single-file movement | Outside initiative the party is one token, and inside initiative each member moves on their own turn. |
| 3D dice, chat, voice, sheets, rules automation, animations, electronic dice | Physical dice and paper sheets stay at the table. |
| Remote play, hosting, accounts, marketplace, plugin API | Contradicts the local-only PWA. |
| Portrait initiative strip with rendered figures | A second WebGL context on iPad Safari risks context loss. |
| Pop-out DM panels | Of no use on an iPad. |
| Level-of-detail rebuild of Vallaki, Abbey and Amber Temple | Content work; increment 2 records these as named debt. |
| Spoiler-stripped player companion and safety signal | Need player devices. |
| Per-token elevation field | Floors already are levels; extra numbers add clutter (Levels #149). |

## Review notes

A completeness critic reviewed the first draft. Its findings were folded into this plan:

The plan is broadly sound: the catalog covers the research, it fits the physical-table lens, and most pitfalls have concrete tests. It needs revision before it is accepted, for six reasons.  1. **The one real data leak.** channel.ts posts the whole CampaignState to the Player Display. Increments 8, 9, 14 and 15 add DM notes, the roll log, statOverrides, the Tarokka record and the spy list to that state. The plan's leak tests (core/playersView.ts and player-safety) cover only overlay payloads, so the state broadcast itself must become a projection and be tested.  2. **Night-one fixes are left unscheduled.** Bug 1 (stairs skip a floor, severity 'block'), sealing Players mode, bug 4 and bug 6 sit only in approvals and are not in any increment. Yet increments 9, 10 and 12 build on the aliased turn bar from approval A2. Schedule A1, A2, A3 and A5 into 0.2.0 or 0.3.0, conditional on sign-off, or gate the dependent increments on them. ROADMAP V1 puts these first.  3. **Undo regresses.** Increment 4 silently replaces the persisted, campaign-wide reveal-undo log with a per-location, non-persisted history. That is a change to an existing feature, not an addition.  4. **Seven items are mislabelled additive:** reveal undo, the always-on hidden-creature ring, the Section control relocation that hits iPad portrait, the display floor chip, slot waking with scene regeneration, the area panel opening from '/' and key labels, and measure waypoints.  5. **Several dropped pitfalls touch planned work:**    - from the 3D lens: camera, occlusion and picking, hotkey collisions, readability at night, creature sizes;    - arm's-length legibility of players'-side text;    - pings while the display is frozen or curtained;    - explicit handout visibility;    - WebKit testing;    - improvisation.     Most new DM panels after increment 8 also lack the phone and phone-landscape assertions that the plan's own phone-layout rule requires.  6. **Missing features.** The catalog omits:    - a generic battle map for improvising;    - marching order;    - a vision limit for the outdoor Barovian mists;    - a creature 'identified' toggle and per-token size override;    - non-blocking scene loading and preloading;    - a date/time chip on the display;    - three roadmap items: the page-reference fidelity report, Castle Ravenloft completion, and wilderness and mist-wall fidelity.     My web check found nothing major beyond a player-safe session recap and the in-person tools' emphasis on phone controls, which the plan defers on purpose.  About fourteen acceptance criteria cannot be tested as written; they are listed above. The catalog's increment numbers are also off by one or two from the actual 0.x increments, which breaks traceability.

