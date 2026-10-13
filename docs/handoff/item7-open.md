# Item 7, unfinished maps: what is still open

Written 2026-10-13 by Claude Code from its final check of branch `claude/wip/item7-unfinished-maps`. The three map groups were built on their own branches, reviewed, fixed once, and merged at `bb393fe`. The final check (three reviewers) then found the issues below. A fixer started on them and was interrupted; its half-finished edits are the WIP commit `ee47297` on the same branch. Read that diff first, keep what is sound, and finish the rest.

Matt's own words for Yester Hill: "Yester Hill is flat. Fix that. The fog wall looks terrible, like cotton."

## Blocks (must be fixed before the release)

1. **Yester Hill (`ch14/Y`): the party cannot climb the hill.** On the hill level, 120 invisible walls fence the players onto the forest floor at the foot and cut across the trail. The only way up is one stairs link that jumps from the foot of the trail straight to the summit, 272 ft up and about 1,300 ft away, so the party never climbs. The outer cairn track is on no level at all, so players can never reach it.
   - Fix in `scripts/authoring/yester-hill.py`, without an engine change: add an outer-track level at the outer track's height, whose floor is the outer ring and whose rooms are the outer Y2 sectors, with the same land drawn. Split the trail into stairs links: foot to outer track where the trail crosses the outer ring, then outer track to summit. Put Kavan's cairn back on its ring. In Players mode a token must be able to walk from the foot to the summit circle.
2. **Amber Temple (`ch13/X`): the upper (+30 ft) and lower (0 ft) levels are buried.** The new snow ground under the mountain covers them, so nobody can see the X23 balcony, and the approved G11 fix (the balcony is open) cannot be seen in the app even though its test passes.
   - Fix in `scripts/authoring/amber-temple.py`: keep the grounding snow out from over the upper and lower room footprints (a ring under the flank feet with a hole, or strips under each ring). `audit-outdoor.py` must stay at 29 findings on `ch13/X`. Add an assertion to `tests/amber-mountain.test.ts`.

## Fixes (real defects)

3. **Amber Temple, Players view: the mountain is a solid black wall** behind the facade, at desktop and phone sizes. The table never sees a cliff with a doorway carved into it; this is worse than the main branch, where the backdrop's mountains show. Make the rock-flank and grounding pieces exempt from the players' dimming, with the fog-of-war-exempt `matClone` copies the way Yester Hill does. Or ask Matt to accept the black mountain and record it in `docs/QUEUE.md`.
4. **Amber Temple, from a distance: the massif reads as a terraced pyramid** (level snow shelves, vertical bands, a flat top). Vary each ring's height along its length, slope the shelves up toward the next ring, give the peak a ridge, and jitter the foot drifts.
5. **Amber Temple cost: the facade level is 31% heavier in triangles** (262k to 343k), on what was already the costliest of these maps. Most of it is the snow drifts and boulders at the foot of the 241 rock-flank pieces. Set `snow: 0` on pieces whose foot never shows (inner-ring faces on a shelf, back and end faces). Aim for about 300k. Re-measure.
6. **Yester Hill, Players view on the summit: a hard black arc** runs along the inner track behind the Y3 boulder ring, and broken pieces of grid float in the north-east wedge. Keep the Y2 room floors flush with or below the exempt land, or stop the low Y3 ring blocking sight.
7. **Yester Hill: looking west from the summit, the fog does not hide the backdrop mountains.** Their ridge shows above the bank, so the fog's top reads as a band under a hard skyline. Raise the back sheets, or add a far, taller sheet that stays opaque up to the summit's eye line.
8. **Yester Hill: the summit level's DM grid hangs past the inner track**, because the grid is drawn over the bounding box of the floor. Split the summit floor into polygons whose bounding boxes stay inside the inner track, or clip the DM grid in `gridOverlay.ts`.
9. **A required test became flaky.** `tests/terms.test.ts`, "the DC count is pinned", timed out at 5 s on one run in twelve; the main branch never did. The branch's new heavy tests (`tests/yester-hill.test.ts` builds the real backdrop) slow the run. Do not touch `terms.test.ts`: make the new tests lighter instead. Build the backdrop once per file (`beforeAll`), sample the seam on fewer points, and avoid building every scenery kind's full geometry. Then run `terms.test.ts` three times; it must pass every time.

## Nits (polish; fix if cheap)

- Yester Hill's summit costs more to draw than on the main branch (a trade for keeping the hill, cairns and fog visible). Matt has not signed it off: ask him, or thin the summit's forest copy.
- The fog wall is 11 stacked transparent sheets up to 950 ft tall; hiding it takes 25–40% off the frame on the hill level. Fewer front sheets would help on iPads.
- Yester Hill's download grew about six times. Acceptable for an offline app.
- `e2e/players-sweep.spec.ts` is about 7% slower on the branch.

## Done on this branch (keep it)

- Amber Temple: the mountain is a closed, grounded massif round the temple (no longer a one-sided shell), the X23 balcony is open (G11, with `tests/amber-mountain.test.ts` written first), the X1a ceiling matches its note.
- Yester Hill: the land ends on flat forest floor that the backdrop continues (no step at the edge); the levels are restructured so each level's floor is where its rooms are; all scenery uses the fog-exempt materials so Players view is no longer a black frame; the fog is one bank of eleven sheets with per-vertex alpha; the land is coloured by slope and height; the trail meets both tracks level.
- Winery (`ch12/W`): one off-ground fence fixed.
- Berez (`ch10/U`): reeds thinned from 900 to 708 and lighter per clump; the menhir greys declared as rock.
- Baba Lysaga's hut (`ch10/U3`): the mire is a ragged patch about 120 ft across instead of a hard square.
- Van Richten's tower (`ch11/V`): the V5 and V6 room polygons are valid; the lift links no longer land over the shaft hole; the buttresses sit on the plinth.

## Checks before the release

`npm run build`; `npx vitest run` (three clean runs); `python3 scripts/authoring/audit-outdoor.py` (no new findings on these maps: `ch11/V` stays at 58, `ch13/X` at 29); the full `npm run test:e2e`; screenshots of every map here at desktop and phone size, DM and Players, that you look at.
