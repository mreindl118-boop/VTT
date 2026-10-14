# Vertical-transition checkpoint for 0.3.2

2026-10-14. Parent assigned this independent portion of Matt's approved all-map logic correction. Base: `55b118e0b78a89b04d0780dd0c713f0a54632c9c`, from `claude/wip/item2-nested-world-laptop`. Dedicated checkpoint branch: `claude/wip/item11-vertical-transitions-cloud`. Laptop remains the terrain, hydrology, placement and release integration owner. No generated map, renderer module, version, release tag, main branch or publication changes.

## Correction

Explicit link actions resolve only the requested link from the party's current level. For a link whose two endpoints share a level, the nearer endpoint determines direction. Automatic movement resolves once against the original position and level, never recursively against the arrival. An arrival suppresses nearby automatic links until the party leaves its trigger area; explicit onward/return actions remain available immediately.

Movement also distinguishes entering a trigger from walking away from one. This prevents a real first step off the landing after reloading from reversing the last transition. An unchanged position does not trigger stairs. These guards are transient; no saved-state schema changes or migration are introduced.

Arrival uses the destination square-grid origin. If snapping a valid authored landing would put it outside floor or across a blocking wall, the party stays at the authored position. It does not search for another floor, cross a closed/secret wall, or invent a replacement for invalid map geometry. Existing collision rules remain unchanged. The Player Display cannot dispatch a link independently, but continues to receive the DM's committed destination.

Changed implementation: `app/src/app.ts` transition methods and movement call; new `app/src/core/verticalLinks.ts`. Tests: `tests/vertical-links.test.ts` and `e2e/vertical-links.spec.ts`.

## Evidence and review

Before the correction, browser regressions reproduce Death House's Floor 2 marker landing on Floor 3, explicit Floor 2-to-3 selection landing on Floor 1, and automatic walking skipping a floor. Amber's fissure arrives at snapped `[22.5,257.5]` and cannot take the tested departure; its authored `[24.5,258]` permits it. These are actual running-app failures, not just isolated-method observations.

The CPU test exercises all 346 production link directions, including reversed array order and exact endpoint identity. It caught same-level links that a destination-level-only test misses. Additional tests cover shared landings, stairs/dumbwaiters/trapdoors/elevators/ladders, unknown IDs/unrelated floors, actor/scene isolation, destination origin, blocked snap segments and preserving invalid geometry as an authoring issue.

The untouched `55b118e` browser sweep independently reproduces exactly **56 wrong destination levels and 22 multiple transitions across 346 activations**. Its full destination/one-transition assertion flags 62 directions in total. Thus the original two counts are genuine runtime defects, not artifacts of the isolated-method harness. The first attempt exceeded the unchanged 240-second new sweep timeout under competing browser load; a serial run completed in 2.3 minutes and failed on the expected assertions. The initial corrected six-test browser run completed all 346 directions without a destination failure; final reviewed verification follows below.

Two independent read-only reviews were completed. The first identified the reload walk-off case (reproduced by a failing regression and corrected) and the marker-choice issue below. The second found no further implementation defect and strengthened the reload test to require successful movement and exact position, not merely an unchanged floor. The marker event test invokes the actual DOM listener; it does not certify marker discoverability or screen-space clickability.

Initial corrected software browser run: six tests passed, including all 346 running-app directions, persistence, movement and Player Display synchronization. The final reviewed run and final build/unit counts are recorded below before checkpointing. All browser execution here uses preinstalled Chromium with SwiftShader, not a hardware GPU. Pinned Playwright Chromium was absent; the previously denied download was not retried or bypassed. An external, uncommitted config selects the installed executable; committed Playwright config is unchanged.

## Ten reported blocked arrivals, reconciled

The old probe tried eight moves only 2.5 ft from each snapped endpoint. Current-WIP browser diagnosis repeated those moves and added five- and ten-foot candidates using the real `canWalkTo` and effective wall states. It separately tested authored and snapped positions.

| Arrival | Result / disposition |
|---|---|
| X / X-fissure → upper | Confirmed snapping defect. Authored point is on floor and can depart to `[27,255.5]`; snapped point has no tested departure. Fixed without map changes. |
| F / F-knoll-stair → knoll | Short-probe artifact as a claim of being trapped: three five-foot exits succeed. Raw point remains 1 ft outside floor, a separate authoring qualification. |
| V / V-lift-1 → f2 | Short-probe artifact: six five-foot exits succeed from the shaft opening. The old dispatch also skipped to f4; the dispatch correction is separate. |
| V / V-lift-2 from f2 | Same shared opening and six five-foot exits; not a confirmed blocked departure. |
| K / lk-k51 → south-tower | No tested 2.5/5/10-ft departure from raw or snapped position; authored point is 1 ft outside floor. Map-owner follow-up. |
| T / T-stair → tower-upper | No tested departure; authored point is about 1.743 ft outside floor. Map-owner follow-up. |
| R / R-ledge-steps → notch | No tested departure; authored point about 5.323 ft outside floor. Map-owner follow-up. |
| R / R-shelf-climb → notch | No tested departure; authored point about 23.186 ft outside floor. Map-owner follow-up. |
| E5 / lk-ground-undercroft → undercroft | No tested departure; authored point 8 ft outside floor. Map-owner follow-up. |
| S10 / lk-road → ground | No tested departure; authored point about 67.546 ft outside declared walkable floor. Custom-ground/approach authoring needs review. |

These are bounded traversal probes, not exhaustive route searches or new source-map sign-offs. Six unresolved authored landing cases were deliberately not repaired by relocating the party or expanding walkable floor.

## Marker ownership boundary

Existing `app.ts` label creation suppresses every stair marker within 12 ft of another. Death House Floor 2 therefore exposes the Floor 1 marker but suppresses the separate Floor 3 choice. Direct `takeLink` calls and automatic dispatch correctness cannot certify that every explicit choice is available in the UI. Renderer/marker changes were outside the initially reported narrow dispatch scope; parent coordination was requested before editing label generation. This remains a separate integration gate unless explicitly transferred.

## Verification record

Final build passes: `index-CdC2w9xd.js`, package version still 0.3.0 on this isolated base. Full units: **555 passed, two existing cached-public-SRD-dependent skips, two existing TODOs, zero failures**, 36 files. All 14 new focused unit checks pass. Final software browser run: **12 passed in 3.9 minutes**, covering six new transition tests and six existing movement/Display-state regressions. The real-app all-map sweep completes **346 activations, zero wrong levels, zero multiple transitions and zero destination failures** in 2.4 minutes. The same tests on untouched baseline reproduce 56 wrong levels, 22 multiple transitions and six additional wrong endpoints on the correct level.

The final serial unit run supersedes a resource-contended attempt that timed out two existing tests (`continuity` camp apron and `terms` DC count) at their unchanged five-second limits while browser work was active. No assertion, timeout or existing skip was changed. This is not a full browser-suite or laptop GPU sign-off. Existing source-cache skips are not counted as passing checks.

Frozen final output: 204 files / 17,146,753 bytes; manifest SHA-256 `e7c541f973c8af11802250197b267171725c2739c1eff6b5bf30cdfe25b55c8a` (SHA-256 of compact, key-sorted JSON records containing relative path, byte count and per-file SHA-256, in sorted path order). The build stayed unchanged during final browser verification.

Eight post-transition views were inspected locally: Death House Floor 2 and Amber upper level, each at desktop 1366×768 and phone 390×844, in DM and Players modes. The visible level selectors and party positions agree with the tested destinations; Players visibility remains limited around the arrival. These software-rendered views do not certify hardware rendering, all-map layout, or the unresolved shared-marker choices. Images remain outside Git.

Ownership was refreshed before checkpointing: laptop WIP advanced to `1c8d94a26764eeafc91a12db234976f2b8f9bb7f` with 0.3.1 version preparation and the 0.3.2 task matrix, with no overlapping transition edits. Its plan explicitly preserves this lane's `55b118e` base and CORE-NAV assignment. That newer branch was inspected, not merged or overwritten. Full laptop GPU regression and exact integrated-head CI remain required.

Local evidence outside Git: `/workspace/vtt-cloud-evidence/vertical-red.log`, `arrival-red.log`, `arrival-runtime.json`, `noop-reload-red.log`, `walkoff-reload-red.log`, `vertical-green.log` and final verification logs. No screenshots, test output, private campaign exports or licensed source pages are committed or uploaded.

For integration: merge the dedicated tested checkpoint into the laptop's current 0.3.2 branch under the integration owner's control, preserve its separate terrain work, reconcile the six map-owned landing cases and marker choices, then run the complete GPU and interaction regression. The final 0.3.1 release ancestor must also be present before releasing 0.3.2. This checkpoint does not release 0.3.1 or 0.3.2 or clear publication holds.
