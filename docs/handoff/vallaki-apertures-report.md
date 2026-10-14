# Vallaki aperture authoring: reviewed implementation and single fix pass

ChatGPT, continuing queue item 2e, 2026-10-14. Authority: Matt's comprehensive 0.3.2 request, overnight parallel-work direction and explicit resume instruction, with the current `AGENTS.md`, `docs/QUEUE.md`, `docs/COLLABORATION.md`, `docs/HANDOFF.md` and `item2e-032-plan.md`. Root delegated this separate authoring step after the shared wall library completed its reviews and single fix pass. Root remains integration owner. This lane changed only `scripts/authoring/vallaki-sites.py`, its emitted Vallaki scene files, `tests/vallaki-apertures.test.ts`, and this report. No `.agents/skills` directory exists in this checkout.

Baseline: `37ae2ffc9b1638919fe493ff6a8397552f2e36c5`. Initial generator/output writes waited for root's checkpoint clearance. The executor was available on resumption. The shared library was not reopened; no app code, other generator, atlas, massing, build, GPU/browser run, commit or publication was performed.

## Source and correction

The licensed local PDF was inspected using the read-only PDF skill. Printed page 111's Wachterhaus plan shows windows on the short horizontal sides of the den's bay. The existing authored bay outline already places those sides at z=7 and z=14 cells; two window requests instead used z=7.5 and z=13.5, inside the room. Those two requests now lie on the existing boundary, retaining their x=3..4 extent and 5-ft width. In emitted feet, the windows are `(15,35) -> (20,35)` and `(15,70) -> (20,70)`. This does not resize or recanonicalize the rest of the authored house.

Printed page 115 describes the wagon's locked rear entrance. N5 has no dimensioned stockyard plan, so the existing authored layout remains an accepted adaptation. Its front-seat feature is north and its rear-door clue is south. The old `N5d-door` stamp ran vertically inside the wagon at cells `(11,17) -> (11,18)` and was silently absent from the old production scene. It now occupies the middle of the south boundary at `(10.5,22) -> (11.5,22)`, or feet `(52.5,110) -> (57.5,110)`. Its authored ID, 5-ft width, locked flag and closed initial state remain. Room outlines, props and other placement decisions remain unchanged.

Only these three aperture requests were edited. Strict aperture consumption in `authorlib.py` remains intact. Local source images/OCR were not copied into the repository, and no source prose or art was added.

## Initial generated result

Executed the complete `vallaki-sites.py`, which emits **N1, N2, N3, N4, N5, N6, N7 and N9: eight scenes, 15 levels, 16 scene/grid files**. N8 is owned by a different script and was untouched. N1 reads the existing E5 scene as input; root confirmed that input was stable for this run.

The reviewed wall library also restores existing authored apertures lost by the previous exact-edge matching. Wall counts below are records, not physical lengths; normalization can split walls and windows.

| Scene | Walls before/after | Door or secret records before/after | Window records before/after |
| --- | --- | --- | --- |
| N1 | 28 / 48 | 0 / 5 | 0 / 12 |
| N2 | 345 / 361 | 13 / 22 | 8 / 40 |
| N3 | 306 / 368 | 9 / 25 | 11 / 39 |
| N4 | 262 / 299 | 15 / 29 | 15 / 33 |
| N5 | 108 / 109 | 9 / 10 | 0 / 0 |
| N6 | 133 / 167 | 5 / 10 | 4 / 24 |
| N7 | 34 / 34 | 3 / 3 | 4 / 4 |
| N9 | 184 / 184 | 7 / 7 | 0 / 0 |
| Total | 1400 / 1570 | 61 / 111 | 42 / 152 |

All 61 existing door/secret IDs, endpoints, flags and open states remain. Fifty previously omitted authored door/secret records now appear. Seventeen existing doors change only their wall material as the library recognizes a shared interior boundary: N2's six affected doors use `paneling` instead of `half-timber`; N3's six and N4's three use `paneling` instead of `ashlar`; N6's two use `paneling-dusty` instead of `half-timber`. This follows each level's existing interior material. Ordinary wall identities can change with normalization, as already documented for the library; no existing portal identity was removed.

Structural comparison to the baseline confirmed that every scene's non-wall payload and all eight grids are identical. N7 and N9 scenes have no Git diff. The six changed scenes are N1 through N6. All 15 levels have unique wall IDs and no zero-length walls.

## Verification

- Failing first: `npm exec vitest run tests/vallaki-apertures.test.ts` against unchanged baseline output produced **23 failed tests**. The two N4 windows and N5 door were absent; all 19 replayed Vallaki movement probes were blocked even after projecting the target portal open.
- After correction and regeneration: the same command produced **23 passed, zero failed, zero skipped**. Tests use the application's production `moveBlockers`, `sightBlockers`, `segmentsIntersect` and `canWalk` with complete current scene walls and grid polygons. N4 windows transmit sight but block movement; N5 remains blocked when closed and permits its crossing when opened. The other 19 cases replay the existing all-map movement audit's coordinates, including revealed/opened secret doors.
- Targeted existing schema/key checks: `npm exec vitest -- run tests/manifests.test.ts -t 'ch05.N[1-79]'` produced **16 passed**. Its 79 unrelated tests were excluded by the command's name filter; no test was edited or disabled. An earlier slash-only filter selected no tests on Windows and was corrected before accepting this result.
- Outdoor audit: called the existing `audit-outdoor.py` audit function for all eight current scenes and the same baseline scenes loaded from Git into memory. Each was **zero findings before and after**.
- Ran the full generator a second time and compared SHA-256 hashes of all 16 output files: **all byte-identical**. Python 3.12 ran with `-B -X utf8`; no bytecode artifacts were produced by these commands.
- `git diff --check` passed for the owned generator and outputs. Git emitted only its existing CRLF-to-LF notices.

The initial temporary-file form of the outdoor comparison hit the sandbox's redirected Temp permissions. The successful comparison used in-memory baseline input and needed no permission changes. The Vite native-config `__dirname` warning was pre-existing and did not affect the tests.

Initial changed scene SHA-256 values after repeat generation (working-copy bytes; N2 is superseded by the fix-pass hashes below):

```text
N1 79f14accf9138c7e9dea442a498d14cced2871a2bbfb8759811e4b44ef4b896e
N2 976a141d9bbde2e8b1b8c041745b37803b2d134befc3aaccc8fbc4eea48bcf72
N3 609e36a4a56cb2f33dfbcbeee619273108bcd9aa2f5c37047e6671f13a73119c
N4 e75a1a9308769b07b416c8afdd0d1631fa6f57ea45760c67057ee034d1688ab8
N5 7e14fe66842db68a036d58fca709295c341431609c5af8c7593aa7885a8cdb50
N6 67b081cce3d78154303619735c50834fdd9062a265a08bd12b16a7a672dfe090
```

## Independent reviews and the single correction pass

Root completed both independent initial reviews and assigned two confirmed N2 findings to this step's one correction pass. Three additional tests failed before correction while the original 23 remained green: the guest-room entrance was at the wrong position, its wall retained `heightFt: 3.5`, and the closed front-door flank admitted movement at x=115 ft.

1. **N2m access and wall height.** The initial regeneration exposed the authored door at feet `(120,97.5) -> (125,97.5)`, opening into the taproom void, with a railing's 3.5-ft height. The enlarged local printed p99 plan shows N2m's entrance at its north-east corner from **N2k, the east guest balcony**. It does not show a bridge across the void from the west great balcony N2j. N2m's east boundary now extends from cells x=29.5 to x=31.5, directly beneath N2k. Its stable `N2m-door` moves to cells `(30,19.5) -> (31,19.5)`, or feet `(150,97.5) -> (155,97.5)`. The erroneous railing override across N2m's north wall is removed, giving that wall and the new doorway their normal full height. The real railings around the other sides of the void remain. No floor is added within the open-to-below area.
2. **N2c front-door bypass.** The broad 27.5-ft opening shared with the porch left both sides of the 7.5-ft entrance unblocked. Removed that broad opening request, preserving the authored door and its initial open state. With all portals closed, crossings at x=115, 118.75, 126.25, 132.5 and 137.5 ft now fail. Opening only `N2c-front` admits its central crossing; direct flanking crossings still meet solid walls.

After correction, **all 26 focused tests pass**, with no skips. The guest-room test uses production floors and movement: both sides of the corrected door have floor, the central and southern taproom void probes remain unfloored, the route from east balcony `(152.5,90)` to room interior `(122.5,110)` is blocked closed and succeeds when only N2m's door opens. The metadata test verifies the doorway has no short railing height and the wall facing the void is full-height normal wall, removing the negative-height door-header input to the existing renderer.

The complete generator ran twice again. **Only N2's scene and grid changed relative to the initial implementation**, and all 16 emitted files were byte-identical on repetition. Outside walls, the exact scene delta is only the two eastern x coordinates of N2m's polygon, from 147.5 to 157.5 ft, mirrored in its grid polygon. Objects, other rooms, links, keys, elevations and all other scenes remain unchanged. Existing saves in N2m's old footprint remain on its floor; its door state keeps the same ID while the interaction moves to the corrected entrance. The new room strip adds 225 square feet south of the void.

Final N2 has **362 walls, 22 door/secret records and 40 window records**; totals across this script are **1571 walls, 111 door/secret records and 152 window records**. N2's wall IDs are unique, with no zero-length walls. Its existing schema/key tests passed again (2 selected tests; 93 unrelated excluded), outdoor audit remains clean, and `git diff --check` passed. No renderer, core, UI or library code was changed.

Final N2 SHA-256 values, working-copy bytes:

```text
scene ff65a4b988985ce060a3e890560b816398cbad6cd6569a0dc8fbfcf518dea325
grid  342de321e2f9c6e58f070738e2e84f229dbeb2f706390292bde436937b2d53b8
```

One transient executor disconnect occurred before the new tests could be written. Root confirmed recovery, the unchanged test was checked, and the failing-first run and corrections then completed normally.

## Final handoff and remaining work

**Both initial reviews and the single permitted fix pass are complete.** No further corrective iteration is authorized by this lane's bounded procedure. Root owns the final acceptance checks, integration, all-map coverage, full build/unit/browser verification, atlas/massing regeneration, ledger/status/version/changelog updates and release gates. No release-readiness claim is made from focused checks. Wider existing source-plan discrepancies remain outside this bounded step. K, E5 and WSC remain in their separately assigned lanes.
