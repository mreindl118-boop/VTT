# Work queue

One checklist, worked top to bottom, one item at a time. Nothing runs in parallel.

On 2026-10-12 the owner approved going through the whole list in order: "Complete every task on the task list. One task at a time in succession, not concurrently, in order as they exist."

For each item, in order:
1. Finish the work and verify it.
2. Merge it onto the main branch.
3. Bump the version (item N ships as 0.N.0).
4. Write the changelog entry.
5. Pass the full test suite.
6. Push and publish.
7. Tick the item, then start the next one.

## Checklist

- [x] 0. **Explored-fog leak (owner 2026-10-12: fix it now).** Explored memory grew by a cell through walls on every update, so ordinary actions revealed whole floors to the players (bug 16; review finding 8). Fix and tests, released as 0.0.2 (`336f7d5`; unit 158 passed, browser suite 74 passed; published as artifact version 39).
- [ ] 1. **D&D-style rules tooltips (first, owner 2026-10-12).** Styled cards, not block text, with a colour per type: spells, conditions and effects, monsters, items by rarity, rules, damage types.
  - Built on the SRD books data (`c058977`; finish its remaining accuracy fixes first) and the tooltip card from `THEME.md`.
  - Shown on every place a rule, spell, monster or effect appears.
- [ ] 1b. **Verify ChatGPT's suggestions G01–G17** (`GPT suggestions/REVIEW.md`, arrived 2026-10-12 during item 1). Check each against the code, then bring each to Matt to approve or deny. Nothing is built until he decides.
- [ ] 2. **Nested world (top priority).** One zoomable world: the region, then a town, then a building, then a room, each map placed at its pin and streaming in as you zoom.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/dispose-obsolete-map-and-range-resources`, `chat gpt suggestions/make-location-navigation-atomic`, `chat gpt suggestions/world-map-hidden-landmarks`. Re-check each against the code, then fix it with a failing test first.
  - Done: frame maths and the world atlas (step 0, `64506d2`); the floating origin and shader basis (step 1, `9e6ba78`).
  - Next: fold in the zoom and nesting fix (`c3557f9`: Enter from a building, Back keeps your place, zoom while gliding, zoom toward the cursor, the phone zoom buttons).
  - Then: step 2, the valley with maps opening in place (WIP `7c75a17`); step 3, streaming; step 4, nesting with breadcrumbs; step 5, the Player Display; step 6, the UI; step 7, performance and phones; step 8, the data pass.
  - Each step is shown to the owner before the next.
  - Paused 2026-10-12 for the tooltips: the surveys finished; prototypes inked-relief and painted-atlas were interrupted (patches in the scratchpad); resume run wf_6907b12e-aa2.
- [ ] 3. **Dollhouse view.** A cutaway toggle built into the app, working on every map with walls; nothing is authored per map.
  - When on, the walls on the camera's side of each building and room disappear, and they update as you orbit (like The Sims). Roofs and ceilings above lift away.
  - The far walls, the outside of the building, the street and the neighbouring buildings stay, so you see where the party is inside the building and in its surroundings.
  - DM: everything cuts away.
  - Players and the Player Display: only rooms the players have revealed or explored open up. Unrevealed rooms keep their walls and give nothing away.
  - Works across floors with the section slider, and in the nested world.
  - To settle at design time: how it sits beside today's low-walls toggle and the section slider.
- [ ] 4. **Movable panels.** Built and fixed (`5aa32c7`); unit tests pass. Left: the panel browser tests, then merge.
- [ ] 5. **Backups 0.2.0.** Built (`a732b0f`, WIP `f89512c`). Left: Restore must give back exactly the saved state (explored-memory bug 16) and one misleading message must be fixed. Then test and merge.
  - New issues from `docs/REVIEW.md` folded in (owner 2026-10-12): N2 the Player Display rebuilds every figure on every DM action without freeing them; N3 the display's save on a campaign switch (already fixed on the branch: confirm); N4 a failed save write hangs campaign switching; N5 the save is read twice at start; N7 an imported backup's token names reach the page unescaped; N8 hidden creatures' names still reach the display through the projection.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/explored-fog-expands-without-movement`, `chat gpt suggestions/protect-campaign-storage`, `chat gpt suggestions/player-display-state-authority`, `chat gpt suggestions/synchronize-display-navigation-and-memory`. Re-check each against the code, then fix it with a failing test first.
- [ ] 6. **Map smoothing: finished maps.** Krezk, render grain, region, backdrop, Vallaki interiors, Death House, Sheep Chase, Argynvostholt, Tsolenka and the Werewolf Den, the Village and Castle Ravenloft. Left: fix the issues found on Krezk and render, check the rest, merge.
- [ ] 7. **Map smoothing: unfinished maps.** Yester Hill (flat hill, cotton fog), the winery, the Amber Temple (WIP `a1cdc36`), and Berez with Van Richten's tower.
- [ ] 8. **Natural land and water.** Diagnosis done; build WIP `066e37d`.
- [ ] 9. **Chapter 2 sites.** A, B, D, F, H, I, J, L, M, P and R are built (A WIP `e3987b6`). Left: one fix round each, including Tser Falls as a cliff over the pool with Vallaki in view.
- [ ] 10. **Vallaki terrain.** Built (`c0fd014`). Merge after item 8.
- [ ] 11. **Night-one fixes 0.2.1.** Approvals A1–A9.
  - New issues from `docs/REVIEW.md` folded in (owner 2026-10-12): N1 during an encounter a placed creature, even hidden, becomes "the party", so the DM moving it reveals rooms and players' Find party centres on it; N6 a double tap in Players mode frames an unexplored room.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/make-stair-traversal-single-hop`, `chat gpt suggestions/players-mode-scene-navigation`, `chat gpt suggestions/player-initiative-visibility`. Re-check each against the code, then fix it with a failing test first.
- [ ] 12. **Gameplay 0.3.0–0.4.0.** Per `ITERATIONS.md`.
- [ ] 13. **Initiative strip and encounter builder.** 0.5.0 and 0.5.1, using 2024 SRD budgets only.
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/restore-party-after-encounters`, `chat gpt suggestions/player-initiative-visibility`. Re-check each against the code, then fix it with a failing test first.
- [ ] 14. **Gameplay 0.6.0–0.8.0.**
  - Review suggestions folded in (owner decision, 2026-10-12): `chat gpt suggestions/ranged-overlay-line-of-sight-correctness`. Re-check each against the code, then fix it with a failing test first.
- [ ] 15. **Clarity and the D&D-inspired theme for the rest of the UI.** `CLARITY.md`, `THEME.md`.
- [ ] 16. **Landform on every map.** Four passes.
- [ ] 17. **Surroundings.** Built from the audits already done.
- [ ] 18. **Stylization per model type.** Built from the surveys already done.
- [ ] 19. **Environmental feel.**
- [ ] 20. **Two small fixes.** The Bonegrinder mill is invisible from the attic level, and building maps are cluttered.
- [ ] 21. **Bestiary.** Needs the open-model sites allowed.
- [ ] 22. **Table safety and offline.** The two review suggestions with no other home: `chat gpt suggestions/player-slider-live-creatures` and `chat gpt suggestions/reliable-offline-install-and-cache`.

## Owner decisions

- 2026-10-12: the independent review's 14 suggestions fold into their matching items. The two with no other home become item 22.
- 2026-10-12: the owner's terrain model (STL) is unavailable; item 2's topography uses the module's Lands of Barovia map and world.json.
- 2026-10-12: Claude Code's own review (`docs/REVIEW.md`) found eight more issues; they fold into items 5 and 11. The explored-fog leak is fixed first, as item 0.

### 2026-10-05

- **Bestiary models:** the owner will allow the open-model hosts (quaternius.com, poly.pizza, quaternius.itch.io, opengameart.org, creativecommons.org).
  - Check each licence on its own page before use.
  - Creatures without an open model are built in-house.
- **Encounter builder:** 2024 SRD 5.2.1 budgets only. No 2014 table.
