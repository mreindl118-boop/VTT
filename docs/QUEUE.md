# Work queue

One checklist, worked top to bottom, one item at a time. Nothing runs in parallel.

An item is ticked only after the owner confirms it. For each item: finish the work, test it, show the result, then wait for the owner's OK before merging, releasing or ticking it.

## Checklist

- [ ] 1. **Movable panels.** Built and fixed (`5aa32c7`). Left: run the panel tests, then merge and release.
- [ ] 2. **Zoom and nesting fix.** Built (`c3557f9`); its zoom tests pass 8 of 8. Left: merge and release.
- [ ] 3. **Backups 0.2.0.** Built (`a732b0f`, WIP `f89512c`). Left: Restore must give back exactly the saved state (explored-memory bug 16), fix one misleading backup message, test, merge.
- [ ] 4. **Map smoothing: finished maps.** Krezk, render grain, region, backdrop, Vallaki interiors, Death House, Sheep Chase, Argynvostholt, Tsolenka and the Werewolf Den, the Village and Castle Ravenloft. Left: Krezk's and render's checks found issues; fix them, check the rest, merge.
- [ ] 5. **Map smoothing: unfinished maps.**
  - Yester Hill: the hill is flat and the fog wall looks like cotton.
  - The winery, the Amber Temple (WIP `a1cdc36`), and Berez with Van Richten's tower.
  - Left: build, check, merge.
- [ ] 6. **Natural land and water.** Diagnosis done, build partly written (WIP `066e37d`). Left: lake shores, smooth land, the map seam, the far grid, rivers. Then check and merge.
- [ ] 7. **Chapter 2 sites.** A, B, D, F, H, I, J, L, M, P and R are built (A has WIP `e3987b6`). Left: one fix round on each site's check findings, including Tser Falls as a cliff over the pool with Vallaki in view. Then merge.
- [ ] 8. **Vallaki terrain.** Built (`c0fd014`): gentle slopes and a grid draped over the ground. Left: merge after item 6, then trim the far-view cost.
- [ ] 9. **Nested world.** Steps 1 and 2 built (`9e6ba78`, WIP `7c75a17`). Left: streaming the maps into one zoomable world, then the remaining steps.
- [ ] 10. **SRD books.** Built and fixed once (`c058977`). Left: the remaining fidelity, table and licence-wording issues. Then merge.
- [ ] 11. **Night-one fixes 0.2.1.** Approvals A1–A9.
- [ ] 12. **Gameplay 0.3.0–0.4.0.** Per `ITERATIONS.md`.
- [ ] 13. **Initiative strip and encounter builder.** 0.5.0 and 0.5.1: a BG3-style strip and a D&D Beyond-style builder, using 2024 SRD budgets only.
- [ ] 14. **Gameplay 0.6.0–0.8.0.** Per `ITERATIONS.md`.
- [ ] 15. **Clarity and D&D-inspired UI.** Four clarity iterations with theme steps T0–T4 (`CLARITY.md`, `THEME.md`).
- [ ] 16. **Rules tooltips.** Colour-coded cards for spells, conditions, monsters, items and rules, plus the DM reference sidebar and full stat blocks.
- [ ] 17. **Landform on every map.** The Vallaki terrain approach applied to the other outdoor maps, in four passes.
- [ ] 18. **Surroundings.** Logic, sightlines and feature clarity on every map. Built from the audits already done.
- [ ] 19. **Stylization.** Five stylistic and five realism improvements per model type. Built from the surveys already done.
- [ ] 20. **Environmental feel.** Mist, wind, water, weather, light, life and sound. Built from the research already done.
- [ ] 21. **Two small fixes.** The Old Bonegrinder mill is invisible from the attic level, and building maps are cluttered at human scale.
- [ ] 22. **Bestiary.** Every SRD monster as a model with a DM stat-block tooltip (`BESTIARY.md`). Needs the open-model sites allowed in the network settings.

## Owner decisions (2026-10-05)

- **Bestiary models:** the owner will allow the open-model hosts (quaternius.com, poly.pizza, quaternius.itch.io, opengameart.org, creativecommons.org).
  - Check each licence on its own page before use.
  - Creatures without an open model are built in-house.
- **Encounter builder:** 2024 SRD 5.2.1 budgets only. No 2014 table.
