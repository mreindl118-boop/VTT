# 0.3.2 map-access integration checkpoint

2026-10-14; base `4e2d63a8c74ed216337d2cbd6a6f3ec48cd253e7`. This is tested WIP, not a release or all-map certification.

The reviewed movement blocker, Sheep Chase square, Vallaki aperture, Castle/Abbey/Tsolenka/R landing and E5 batches are integrated. Their separate reports retain failing-first evidence, two independent reviews and each bounded correction pass. Abbey village postprocessing restored its 62 town props; the nine changed village wall endpoints preserve the same segments. Ravenloft exterior and the world atlas/massing were regenerated from the staged map data. Unfinished regional hydrology and save-migration activation are excluded from this checkpoint.

## Marker/data integration

Moving Tsolenka's upper stair onto its supported landing puts it within twelve feet of the ladder. All 346 directions remain represented. The original 48 grouped choices remain asserted using the former Tsolenka landing, while the current layout asserts exactly 49 and the specific stair/ladder pair. No distance threshold or destination assertion was loosened.

K51's safe arrival is `[210,257.5]`; its concealed wall hook remains four feet away at `[210,0,261.5]`. An optional endpoint `hiddenObjectId` now explicitly relates those two objects. Exact co-location remains the fallback; nearby sacks, pressure plates and hidden furnishings do not infer a gate. The generator authors only K51's lower-direction reference. The existing concealed upper trapdoor still supplies its own gate.

Initial failing-first marker verification: five failures, four passes. Two independent reviews then identified malformed empty/null and wrong-floor references that could appear public or unlock after an unrelated reveal. The one consolidated correction rejects every invalid explicit reference, including missing or non-hidden objects, before any map graphics allocation. Five stricter regressions failed first. Both runtime grouping and scene validation require a nonempty ID naming a hidden object on that endpoint's floor.

## Verification

An export of the Git index isolates this batch from unfinished local terrain/migration work. Final export build `index-CWlyiRy1.js` passes; the full unit suite passes **675 tests**, with two existing TODOs and zero skips, in 16.83 seconds. Six focused laptop GPU marker tests pass in 16.6 seconds, including shared choices, concealed hatches, the displaced K51 hook, traversal and rejection before graphics allocation. The initial integration run's two marker failures and earlier E5 type error are retained in local evidence, not counted as passing runs.

E5's review correction adds an explicit 15-foot ceiling assertion before its TypeScript non-null use; geometry is unchanged. Root typechecking plus migration/coverage focused checks separately passed. Outdoor audit findings on changed maps did not increase. Local logs and source images remain outside Git; no screenshots, book content or private saves are published.

## Remaining gates

Castle saved-state migration is reviewed but its activation/save/reload integration is not part of this checkpoint. Roof/body/source compatibility, J/K placement, regional drainage/terrain, comprehensive doorway/link journeys, source reconciliation and desktop/phone DM/Players visual evidence remain open. The full integrated GPU suite and exact final CI are release gates. Neither the 46-map inventory nor this focused marker pass certifies every map.
