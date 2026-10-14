# Sheep Chase square walkable ground

Item 2e / 0.3.2, 2026-10-14. Both independent initial reviews are complete; the one allowed correction pass is complete and verified with focused CPU tests. The candidate is held for root integration and acceptance. No overall build, GPU test, commit, atlas change or publication was performed in this lane.

## Scope and diagnosis

The actual generated square is `locations/wsc/02-street`, not `01-town-square`. Its accepted authored town layout is retained. The tavern scene, inn/world registration and regional data remain with their existing owners; this is not a full source or visual certification.

The square drew grass and a dirt ring around the central cobbles, but its grid contained only the six keyed room polygons. Their union had three disconnected components. The unchanged spawn at x50/z67.5 stood 15.9099026 ft outside that floor. Temple and tavern yard gaps were covered by drawn ground but lacked walkable floor. Regenerating with the separately reviewed wall correction also removes the stale artificial square-edge walls that blocked the streets.

## Implementation

- `scripts/authoring/wsc-town.py` derives the square's floor from the existing grass extent, excluding solid house/temple envelopes with no playable interiors. The final mask contains 33 nonoverlapping rectangles and one connected outdoor ground component. The stable remains walkable inside and uses its real walls and door to control access.
- Building exclusions use the existing rendered objects' positions and dimensions. No building is resized or relocated. The template supports right-angle rotations explicitly and rejects unsupported building rotations instead of silently producing a wrong mask.
- New `--square-only` regenerates just the square scene/grid. The ordinary generator still emits both sites and refreshes the manifest when that option is absent. This narrow mode prevents unrelated tavern/manifest writes during independently owned work.
- Shared `authorlib.py` correction is owned by the wall lane, checkpoint `832897a`, and was confirmed stable before this regeneration. Root allowed output writes after checkpoint `37ae2ff`. Its wall reconciliation changes the square's wall count from 36 to 26; it preserves both authored door IDs and geometry. It explicitly serializes the tavern shell door's existing default closed state.

## Failing-first and verification evidence

`tests/wsc-walkable.test.ts` uses the actual generated scene/grid, `canWalk` and `moveBlockers`, without replacing production walls. Corrected initial fixture extraction projects the spawn's 3D position onto x/z. Against the unchanged square, the final 18-test fixture had **10 failures and eight passes**: spawn support/departure; west/east routes; temple/tavern yards; two grass approaches; ring movement; stable approach; and temple-footprint exclusion. The new file briefly participated in the root's concurrent wall checkpoint; root retained that failed run as unfinished-lane evidence. At root's request it was moved outside test discovery unchanged, then restored before regeneration. No assertion was skipped or loosened.

Initial regeneration: **18/18 pass**. Coverage includes the unchanged spawn and a five-foot departure, both street exits, both yards, two grass approaches, 16 successive ring-route pairs, stable entry/exit with its actual door open, blocked stable entry when closed, and exclusion of all eight solid building bodies plus ground outside the rendered extent. That initial mask had 23 rectangles, one valid floor component and area 36,721 square feet. The reviews found that nominal building-body coverage did not include the temple's protrusions; the correction below supersedes that mask. These are CPU routing checks, not an exhaustive browser traversal or physical-device claim.

Two consecutive commands produced byte-identical square outputs:

```text
python -B scripts/authoring/wsc-town.py --square-only
npx vitest run tests/wsc-walkable.test.ts
```

Initial candidate SHA-256:

| File | SHA-256 |
|---|---|
| `locations/wsc/02-street/scene.json` | `2c86f2d280eb2984973a0d04b2742128a8e514967c889ee52baf7465b8766422` |
| `locations/wsc/02-street/grid.json` | `9dd8d9f29c2923ce05e1acf99a91c594c62aa40ce2aee985fccf28bdb17b0b29` |

Hash checks confirm the tavern scene, tavern grid and WSC manifest were unchanged by both runs. Structural comparison confirms square objects, rooms, terrain, lights, elevation, ceiling and north orientation are unchanged; only regenerated walls and the grid differ. The temporary pending test outside the checkout was restored and no longer remains there.

## Independent reviews and the single correction pass

Root relayed both independent review results: each confirmed the same P2 defect. The initial mask used the temple's nominal 30x45-ft body while its drawn closed door and four buttresses project beyond that body. A token could occupy the closed door at x75/z190.25 or z190.3 and buttresses at x59.4 or x90.6 / z161.875 or z173.125. `app/src/kit/props.ts`, `temple()` supplies the exact component geometry: a 31x46-ft ground plinth, a 6x0.6-ft closed-door footprint extending south of the body, and four 1.2x2-ft buttresses whose bases reach ground. Roof/eave overhangs do not form ground obstacles.

Before the correction, eight new solid-edge probes failed and all 24 other tests passed. Those failures cover both door positions, all four buttresses, and two plinth edges. Six additional approach probes already passed and guard against an oversized blanket exclusion.

The one authorized correction pass adds the plinth, closed-door and individual buttress envelopes to the generated mask, deriving their placement from the existing temple dimensions/rotation. It preserves space around and between the protrusions. No renderer or movement-engine behavior was changed.

Final verification: **32/32 focused tests pass**. Two consecutive square-only regenerations are byte-identical. Final floor geometry is valid, consists of 33 rectangles in one connected component, and has area 36,638.8 square feet. The square scene itself is byte-identical to the initial candidate; only its grid changed during this correction. The tavern scene/grid and manifest again remained byte-identical to their protected pre-run hashes.

Final candidate SHA-256:

| File | SHA-256 |
|---|---|
| `locations/wsc/02-street/scene.json` | `2c86f2d280eb2984973a0d04b2742128a8e514967c889ee52baf7465b8766422` |
| `locations/wsc/02-street/grid.json` | `e4dbcf8715003752a03ece89f02f8b9a8b29dfea9ea8120f710bb3e3acff0710` |

## Remaining gates

Both initial reviews and the single correction pass are complete. No further fix pass is implied; any new blocker goes to root. The root still owns integrated build/units, GPU and desktop/phone DM/Players inspection, stable-door and square movement in the real app, atlas/inn registration, saved-state regression and release gates. In particular, excluding the solid tavern shell from outdoor floor does not resolve the separate parent/child doorway registration request. No full-source or complete all-map claim is made.
