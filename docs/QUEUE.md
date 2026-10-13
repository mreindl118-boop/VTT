# Work queue

One checklist, worked top to bottom, one item at a time. Nothing runs in parallel.

On 2026-10-12 the owner approved going through the whole list in order: "Complete every task on the task list. One task at a time in succession, not concurrently, in order as they exist."

**Lean setting (owner, 2026-10-12), for every item:**
- Work broadly to finish sooner (owner, 2026-10-13). Items that don't touch the same code may run side by side, and independent parts within an item may too. Each runs in its own worktree. Releases still land on the main branch one at a time, each merging what came before. This machine allows two agents at once per run.
- Builders work at full effort.
- Two reviewers per build step, run side by side, at a lighter setting.
- At most one fix pass per step; polish-only findings don't trigger one.
- A final check with three reviewers.

The goal is to save usage and time without lowering the quality of the work.

For each item, in order:
1. Finish the work and verify it.
2. Merge it onto the main branch.
3. Bump the version: each release takes the next minor version, in release order.
4. Write the changelog entry.
5. Pass the full test suite.
6. Push and publish, and add the release's screenshots and demo to the [Visual-Aide](https://github.com/mreindl118-boop/Visual-Aide) repo (`releases/<version>-<name>/`).
7. Tick the item, then start the next one.

## Checklist

- [x] 0. **Explored-fog leak (owner 2026-10-12: fix it now).** Explored memory grew by a cell through walls on every update, so ordinary actions revealed whole floors to the players (bug 16; review finding 8). Fix and tests, released as 0.0.2 (`336f7d5`; unit 158 passed, browser suite 74 passed; published as artifact version 39).
- [x] 1. **D&D-style rules tooltips (first, owner 2026-10-12).** Styled cards, not block text, with a colour per type: spells, conditions and effects, monsters, items by rarity, rules, damage types.
  - Built on the SRD books data (`c058977`; finish its remaining accuracy fixes first) and the tooltip card from `THEME.md`.
  - Shown on every place a rule, spell, monster or effect appears.
  - Released as 0.1.0 (unit 463 passed, 2 todo; browser suite 171 passed, 55 skipped by device project). The gold set `tests/fixtures/terms-gold.json` still waits for the owner's sign-off.
- [x] 1b. **Verify ChatGPT's suggestions G01–G17** (`GPT suggestions/REVIEW.md`, arrived 2026-10-12 during item 1). Check each against the code, then bring each to Matt to approve or deny. Nothing is built until he decides. Done: `docs/REVIEW-G.md` (16 confirmed, G17 partly); the owner approved all 17 on 2026-10-12.
- [x] 2. **Nested world, first release (released as 0.3.0).** One zoomable world: the region, then a town, then a building, then a room, each map placed at its pin and streaming in as you zoom.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/dispose-obsolete-map-and-range-resources`, `chat gpt suggestions/make-location-navigation-atomic`, `chat gpt suggestions/world-map-hidden-landmarks`. Re-check each against the code, then fix it with a failing test first.
  - Done: frame maths and the world atlas (step 0, `64506d2`); the floating origin and shader basis (step 1, `9e6ba78`).
  - Included: the zoom and nesting fix (`c3557f9`: Enter from a building, Back keeps your place, zoom while gliding, zoom toward the cursor, the phone zoom buttons).
  - First release includes step 2, the valley with maps opening in place; step 3, streaming; step 4, nesting with breadcrumbs; and the D&D world map. Independent reviews and fixes are recorded in `docs/handoff/item2-report.md`.
  - [ ] Second release: topography, step 5 (expanded Player Display), step 7 (performance and phones) and step 8 (data pass).
  - ~~Each step is shown to the owner before the next.~~ Owner 2026-10-13: "No need, just finish it up and implement it in the main." Build the remaining steps (including 5 the Player Display, 7 performance and phones, 8 the data pass), then release onto the main branch with no stop for a preview.
  - Owner 2026-10-13, "Ship what works now" (after hearing each step takes 6–8 hours here): release steps 2–4 and the D&D world map as soon as the world-map step is reviewed and the final check passes. The topography, step 5 (the Player Display), step 7 (performance and phones) and step 8 (the data pass) follow as a second release.
  - The earlier world-map prototype pause is superseded by this implementation; the remaining second-release scope stays pending.
- [x] 2b. **"What's new" card (owner 2026-10-13: "when 0.3.0 publishes I want a welcome splash to appear once with a 'What's new'; this should be refreshed on update").** Built on the laptop the same day: after each update the DM's window shows the newest changelog entry once (the version the owner last saw is remembered); the first run ever shows Help instead; Help has a "What's new" link to reopen it; the Player Display never shows it. The card reads `docs/CHANGELOG.md` at build time, so every release refreshes it by writing its changelog. Ships inside 0.3.0.
- [x] 2c. **Local desktop app (owner, 2026-10-13).** Installed 0.3.0 using existing Node/Edge, with a desktop shortcut and persistent profile. The tested updater stages only verified repository releases and preserves saves; see `docs/DESKTOP.md`.
  - [ ] First update-channel publication: held by the parent's latest direction while the new compiled public-bundle destination is clarified; exact-source release CI must also pass. No distribution tag is published yet.
- [ ] 2d. **0.3.1 continuity fixes (owner, 2026-10-13).** Source-backed terrain/road/river/bridge and parent-child landscape continuity, starting at Tsolenka Pass, duplicate Ravenloft, poolside Tser Pool and Amber Temple's exposed approach; compass activation aligns north without resetting the view. Diagnose first, preserve canonical relationships, regression-test and inspect before/after movement and zoom. This narrow request does not resume the rest of item 7 or the entire deferred topography pass.
- [ ] 3. **Dollhouse view.** A cutaway toggle built into the app, working on every map with walls; nothing is authored per map.
  - When on, the walls on the camera's side of each building and room disappear, and they update as you orbit (like The Sims). Roofs and ceilings above lift away.
  - The far walls, the outside of the building, the street and the neighbouring buildings stay, so you see where the party is inside the building and in its surroundings.
  - DM: everything cuts away.
  - Players and the Player Display: only rooms the players have revealed or explored open up. Unrevealed rooms keep their walls and give nothing away.
  - Works across floors with the section slider, and in the nested world.
  - To settle at design time: how it sits beside today's low-walls toggle and the section slider.
- [ ] 4. **Movable panels.** Built and fixed (`5aa32c7`); unit tests pass. Left: the panel browser tests, then merge.
- [ ] 5. **Backups 0.2.0.** Built (`a732b0f`, WIP `f89512c`). Left: Restore must give back exactly the saved state (explored-memory bug 16) and one misleading message must be fixed. Then test and merge.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G03 (coarse fog: one cell grid for stamps and brushes). Fix each with a failing test first.
  - New issues from `docs/REVIEW.md` folded in (owner 2026-10-12): N2 the Player Display rebuilds every figure on every DM action without freeing them; N3 the display's save on a campaign switch (already fixed on the branch: confirm); N4 a failed save write hangs campaign switching; N5 the save is read twice at start; N7 an imported backup's token names reach the page unescaped; N8 hidden creatures' names still reach the display through the projection.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/explored-fog-expands-without-movement`, `chat gpt suggestions/protect-campaign-storage`, `chat gpt suggestions/player-display-state-authority`, `chat gpt suggestions/synchronize-display-navigation-and-memory`. Re-check each against the code, then fix it with a failing test first.
- [ ] 6. **Map smoothing: finished maps.** Krezk, render grain, region, backdrop, Vallaki interiors, Death House, Sheep Chase, Argynvostholt, Tsolenka and the Werewolf Den, the Village and Castle Ravenloft. Left: fix the issues found on Krezk and render, check the rest, merge.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G06 (duplicate site builders: divan, candelabra), G07 (section cut left on shared materials), G09 (locked-door band moves with the door), G10 (the Tower V world-map link survives regeneration), G11 (Sheep Chase square sealed from both streets), G13 (a grid occlusion test that can fail), G14 (authored doors that vanish: Vallaki, K28, K63; the generators fail on a lost door), G15 (counters and railings as geometry), G16 (Castle gate and postern open), G17 (the church copy keeps object sizes). Fix each with a failing test first.
- [ ] 7. **Map smoothing: unfinished maps.** Yester Hill (flat hill, cotton fog), the winery, the Amber Temple (WIP `a1cdc36`), and Berez with Van Richten's tower.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G11 (Amber Temple X23 balcony open). Fix each with a failing test first.
- [ ] 8. **Natural land and water.** Diagnosis done; build WIP `066e37d`.
- [x] 9. **Chapter 2 sites.** A, B, D, F, H, I, J, L, M, P and R are built (A WIP `e3987b6`). Left: one fix round each, including Tser Falls as a cliff over the pool with Vallaki in view.
  - Open after the one fix pass: 23 defects on A, B, D, F, H, I, J, L and M (see the 0.2.0 changelog), waiting for the owner.
- [ ] 10. **Vallaki terrain.** Built (`c0fd014`). Merge after item 8.
- [ ] 11. **Night-one fixes 0.2.1.** Approvals A1–A9.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G08 (ground mist comes back after toggling, and after the floor-mask view). Fix each with a failing test first.
  - New issues from `docs/REVIEW.md` folded in (owner 2026-10-12): N1 during an encounter a placed creature, even hidden, becomes "the party", so the DM moving it reveals rooms and players' Find party centres on it; N6 a double tap in Players mode frames an unexplored room.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/make-stair-traversal-single-hop`, `chat gpt suggestions/players-mode-scene-navigation`, `chat gpt suggestions/player-initiative-visibility`. Re-check each against the code, then fix it with a failing test first.
  - **Players can't move (owner bug report, 2026-10-13; "this needs to get fixed on the checklist but not now"; "it's simply an issue of the players can't move anywhere. Door logic is a good thing to have but it seems to be broken right now").**
    - Seen at the Abbey of Saint Markovia (`ch08/S10`), ground floor, Players mode on a phone. Every move says "No way through: walls block the party. Open a door first.", and the view is black except the party token.
    - Keep door logic (walls and closed doors stop the players), but make it work.
    - Where to look: in Players mode every move goes through `canWalk` (`app/src/core/movement.ts`). It refuses a move unless the token and the target both link to the current floor's walkable area without crossing a wall or a closed door. A token that starts off that area, or doors that don't count as openings, block every move.
    - Item 6's Krezk rework (`966a0f2`) also rebuilds the abbey, so check it there too.
    - Test first, on every map: from the party's start in Players mode, at least one move must be allowed, and opening a door must let the party through it.
- [ ] 12. **Gameplay 0.3.0–0.4.0.** Per `ITERATIONS.md`.
- [ ] 13. **Initiative strip and encounter builder.** 0.5.0 and 0.5.1, using 2024 SRD budgets only.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G01 (Roll with nothing ticked rolls everyone), G02 (removing a combatant keeps the active one; removing the active one: the next takes a fresh turn, removing the last starts the next round). Fix each with a failing test first.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/restore-party-after-encounters`, `chat gpt suggestions/player-initiative-visibility`. Re-check each against the code, then fix it with a failing test first.
- [ ] 14. **Gameplay 0.6.0–0.8.0.**
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G04 (walking stays on floor: a gap needs a door, a link or the DM's drag), G05 (a trip ends on arrival: 8 h of walking = 8 h; 16 h = 32 h). Fix each with a failing test first.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/ranged-overlay-line-of-sight-correctness`. Re-check each against the code, then fix it with a failing test first.
- [ ] 15. **Clarity and the D&D-inspired theme for the rest of the UI.** `CLARITY.md`, `THEME.md`.
- [ ] 16. **Landform on every map.** Four passes.
- [ ] 17. **Surroundings.** Built from the audits already done.
- [ ] 18. **Stylization per model type.** Built from the surveys already done.
- [ ] 19. **Environmental feel.**
- [ ] 20. **Two small fixes.** The Bonegrinder mill is invisible from the attic level, and building maps are cluttered.
- [ ] 21. **Bestiary.** Needs the open-model sites allowed.
- [ ] 22. **Table safety and offline.** The two review suggestions with no other home: `chat gpt suggestions/player-slider-live-creatures` and `chat gpt suggestions/reliable-offline-install-and-cache`.
  - ChatGPT suggestions approved by the owner (2026-10-12; `GPT suggestions/REVIEW.md`, verified in `docs/REVIEW-G.md`): G12 (failed OCR pages are retried). Fix each with a failing test first.

## Owner decisions

- 2026-10-12: the independent review's 14 suggestions fold into their matching items. The two with no other home become item 22.
- 2026-10-12: the owner's terrain model (STL) is unavailable; item 2's topography uses the module's Lands of Barovia map and world.json.
- 2026-10-12: the owner approved ChatGPT's G01–G17, folded into items 5, 6, 7, 11, 13, 14 and 22; decisions: a trip ends on arrival (G05), removing the active combatant gives the next a fresh turn (G02), walking stays on floor (G04).
- 2026-10-12: Claude Code's own review (`docs/REVIEW.md`) found eight more issues; they fold into items 5 and 11. The explored-fog leak is fixed first, as item 0.

### 2026-10-05

- **Bestiary models:** the owner will allow the open-model hosts (quaternius.com, poly.pizza, quaternius.itch.io, opengameart.org, creativecommons.org).
  - Check each licence on its own page before use.
  - Creatures without an open model are built in-house.
- **Encounter builder:** 2024 SRD 5.2.1 budgets only. No 2014 table.
