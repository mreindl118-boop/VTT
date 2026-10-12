# Work queue

One checklist, worked top to bottom, one item at a time. Nothing runs in parallel.

An item is ticked only after the owner confirms it. For each item: finish the work, test it, show the result, then wait for the owner's OK before merging, releasing or ticking it.

## Checklist

- [ ] 1. **Nested world (top priority).** One zoomable world: the region, then a town, then a building, then a room, each map placed at its pin and streaming in as you zoom.
  - Done: frame maths and the world atlas (step 0, `64506d2`); the floating origin and shader basis (step 1, `9e6ba78`).
  - Next: fold in the zoom and nesting fix (`c3557f9`: Enter from a building, Back keeps your place, zoom while gliding, zoom toward the cursor, the phone zoom buttons).
  - Then: step 2, the valley with maps opening in place (WIP `7c75a17`); step 3, streaming; step 4, nesting with breadcrumbs; step 5, the Player Display; step 6, the UI; step 7, performance and phones; step 8, the data pass.
  - Each step is shown to the owner before the next.
- [ ] 2. **D&D-style rules tooltips (top priority).** Styled cards, not block text, with a colour per type: spells, conditions and effects, monsters, items by rarity, rules, damage types.
  - Built on the SRD books data (`c058977`; finish its remaining accuracy fixes first) and the tooltip card from `THEME.md`.
  - Shown on every place a rule, spell, monster or effect appears.
- [ ] 3. **Movable panels.** Built and fixed (`5aa32c7`); unit tests pass. Left: the panel browser tests, then merge.
- [ ] 4. **Backups 0.2.0.** Built (`a732b0f`, WIP `f89512c`). Left: Restore must give back exactly the saved state (explored-memory bug 16) and one misleading message must be fixed. Then test and merge.
- [ ] 5. **Map smoothing: finished maps.** Krezk, render grain, region, backdrop, Vallaki interiors, Death House, Sheep Chase, Argynvostholt, Tsolenka and the Werewolf Den, the Village and Castle Ravenloft. Left: fix the issues found on Krezk and render, check the rest, merge.
- [ ] 6. **Map smoothing: unfinished maps.** Yester Hill (flat hill, cotton fog), the winery, the Amber Temple (WIP `a1cdc36`), and Berez with Van Richten's tower.
- [ ] 7. **Natural land and water.** Diagnosis done; build WIP `066e37d`.
- [ ] 8. **Chapter 2 sites.** A, B, D, F, H, I, J, L, M, P and R are built (A WIP `e3987b6`). Left: one fix round each, including Tser Falls as a cliff over the pool with Vallaki in view.
- [ ] 9. **Vallaki terrain.** Built (`c0fd014`). Merge after item 7.
- [ ] 10. **Night-one fixes 0.2.1.** Approvals A1–A9.
- [ ] 11. **Gameplay 0.3.0–0.4.0.** Per `ITERATIONS.md`.
- [ ] 12. **Initiative strip and encounter builder.** 0.5.0 and 0.5.1, using 2024 SRD budgets only.
- [ ] 13. **Gameplay 0.6.0–0.8.0.**
- [ ] 14. **Clarity and the D&D-inspired theme for the rest of the UI.** `CLARITY.md`, `THEME.md`.
- [ ] 15. **Landform on every map.** Four passes.
- [ ] 16. **Surroundings.** Built from the audits already done.
- [ ] 17. **Stylization per model type.** Built from the surveys already done.
- [ ] 18. **Environmental feel.**
- [ ] 19. **Two small fixes.** The Bonegrinder mill is invisible from the attic level, and building maps are cluttered.
- [ ] 20. **Bestiary.** Needs the open-model sites allowed.

## Owner decisions (2026-10-05)

- **Bestiary models:** the owner will allow the open-model hosts (quaternius.com, poly.pizza, quaternius.itch.io, opengameart.org, creativecommons.org).
  - Check each licence on its own page before use.
  - Creatures without an open model are built in-house.
- **Encounter builder:** 2024 SRD 5.2.1 budgets only. No 2014 table.
