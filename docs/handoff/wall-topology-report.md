# Shared wall topology: reviewed implementation and single fix pass

ChatGPT, continuing queue item 2e, 2026-10-14. Authority: Matt's comprehensive 0.3.2 request and overnight parallel-work direction, as recorded in `AGENTS.md`, `docs/QUEUE.md`, and `item2e-032-plan.md`. Root assigned this lane only `scripts/authoring/authorlib.py`, `scripts/authoring/test-wall-topology.py`, and this report. Root remains integration owner; no commits, generated location files, app code, builds, browser runs, or publication were performed by this lane.

Baseline inspected: `ef64809f7ff1ef4489fb4498bc19401a7001cb05`; root then integrated cloud transitions as `b65d78953c49d03639b31cf47bf91bfaf3bd8ed3`. The authorlib baseline is identical across those commits. Implementation writes waited for root's integration commit. No `.agents/skills` directory is present in this checkout.

## Cause and bounded correction

`Level.build_walls()` previously matched overrides to exact unit-edge keys. Adjacent polygons often divide a shared line differently, especially with half-cell coordinates and diagonal edges. Stamping one door could therefore leave a second normal wall over its opening, or lose the requested aperture entirely. Explicit extra secret panels were appended after room walls, leaving the original blocking wall behind them. Fusing every segment with the same ID could also bridge a gap between disconnected doors.

The implementation nodes coincident room boundaries, explicit partitions, and override intervals at all their endpoints before applying the override. Coincident room boundaries share one atomic interval; semantically independent explicit layers remain separate. Door/window/secret intervals replace the coincident normal wall only within their extent. Normal wall portions outside an aperture remain, including custom heights and materials. Doors keep their authored IDs, flags and open state; secret objects retain their wall references. Distinct overlapping aperture identities/states fail instead of choosing silently. Reused aperture IDs must form one contiguous straight interval.

Door, window and non-extra secret override intervals must be completely supported and consumed; otherwise generation raises `ValueError` with their exact segments. Explicit extra secrets remain allowed as authored standalone partitions. Ordinary/open-wall overrides retain their existing ability to cover intervals without a room boundary; this change does not claim to repair standalone counter/railing authoring or validate every outdoor opening's semantic intent.

Supporting-line bucketing and endpoint keys round only floating-point arithmetic noise, far below the exported 0.001-ft coordinate precision. Existing ordinary wall order/IDs are retained on the unchanged integer fixture. A named normal partition cut into disconnected portions keeps its first ID and receives deterministic available `-part-N` suffixes for later portions, reserving authored and emitted identities before suffix allocation. Explicit names beginning with the generated-wall prefix are retained. Ordinary-wall IDs may change where previously overlapping geometry is normalized; door and secret identities are the save-sensitive contract tested here.

## Failing-first and passing checks

Run directly from the repository root:

```text
python scripts/authoring/test-wall-topology.py
```

Eight tests cover the production-like N2 fractional shared boundary, diagonal aperture, closed/locked/secret preservation, explicit extra secret, door through an extra partition, wholly/partly unsupported apertures, disconnected reuse of an aperture ID, and unchanged integer geometry/IDs.

- Before implementation: seven test methods failed, with 12 failure records including the subtests; the unchanged integer-ID fixture passed. The N2-style fixture produced both `kitchen` and a residual `ground-w-17` at the aperture.
- After the initial implementation: **8 tests passed**, zero failures, approximately 0.002 seconds on Python 3.12.
- `git diff --check` passed for the implementation.

A separate read-only compatibility probe executed 14 current generators with all write-mode `open` calls redirected to memory and `os.makedirs` suppressed. It called both the baseline and new `build_walls()` for each level, so no generated scene or grid was written. The generators were `vallaki-sites.py`, `castle-ravenloft.py`, `death-house.py`, `argynvostholt.py`, `krezk-abbey.py`, `tsolenka-pass.py`, `wizard-of-wines.py`, `van-richten-tower.py`, `old-bonegrinder.py`, `werewolf-den.py`, `wsc-town.py`, `noke-tower.py`, `creeping-hut.py`, and `yester-hill.py`.

- Reached **73 authored levels**; **69 passed** the new topology/consumption checks, while four exposed existing invalid aperture coordinates listed below. These counts include authored generator levels and are not a replacement for the production 122-level coverage ledger.
- On the 69 passing levels, **23 door/secret apertures overlapped normal walls before, zero after** in a positive-collinear-overlap check. This check includes secrets and is different from the original 365-door movement probe; do not subtract it from the original 28 blocked doors or claim every route now passes.
- The 69 passing levels returned identical wall lists on repeated construction, with unique IDs.
- **256 existing door/secret records retained identical ID, endpoints, flags and open fields.** One additional existing door, Sheep Chase `sq-tavern-front`, now explicitly emits `open: false`; its old field was absent, with the same runtime default. No existing aperture endpoints or flags changed in these passing levels.

## Independent review and the single fix pass

Root completed both initial independent reviews and assigned one consolidated fix pass. All four assigned findings were reproduced before correction:

1. Split-wall suffixes could collide with an authored `partition-part-2`, including a door with that name. The related explicit `ground-w-0` door case also reproduced renaming an authored ID as if it were generated. Allocation now reserves authored names and all emitted identities, and only renumbers genuinely anonymous walls.
2. J intentionally places coincident `invisible` and `ethereal` extra walls for separate movement and sight behavior. The initial implementation collapsed them. A fixture using the real generator, with only its duplicate polygon vertex removed in memory to isolate this test, reproduced **14 invisible walls becoming zero**. Both sets now remain **14 invisible and 14 ethereal walls**, including the exact coincident gate segment `(450, 0) -> (450, 165)` feet. Independent non-aperture extra layers keep their original extent and identity.
3. Raw J contains a repeated consecutive room vertex at `(75.2, 70.4)` cells. The initial implementation rejected the resulting zero-length boundary. `unit_edges()` now ignores a repeated polygon vertex; the unmodified raw generator builds without emitting a zero-length wall. Explicit zero-length walls, doors, windows and secrets still raise an error.
4. A room `opening()` erased an intentional coincident extra rail. Room openings now affect the derived room boundary, leaving explicit normal partitions/counters/rails intact. The regression opens `(0, 0) -> (4, 0)` cells and retains the 3.5-ft-high extra rail on `(1, 0) -> (3, 0)`.

The expanded suite's red run produced **five assertion failures and one error** (the split-ID test includes two failing subtests); the original eight tests and the explicit-zero-length guard stayed green. After this one fix pass, **all 14 tests pass**, zero failures/errors, approximately 0.113 seconds. No existing assertions were weakened.

Final write-suppressed production diagnostic expanded the previous 14 generators to **26**, adding `vallaki-square.py` and all 11 `wild_*.py` generators. It captured **34 production scenes / 106 unique scene levels**, matching 106 `Level.build_walls()` calls. **102 levels pass** and the same **four levels fail** the strict missing-aperture guard listed below. For the 102 passing levels, repeated construction is identical, IDs are unique, and no zero-length walls are emitted. Door/secret apertures with positive normal-wall overlap remain **23 before / zero after** on those passing levels. **259 existing door/secret records** retain identical ID, endpoints, flags and open fields; the sole field difference remains Sheep Chase's explicit `open: false` default. These are CPU authoring diagnostics, not complete source/runtime/visual certification or all-122-level coverage.

Only this lane's three assigned files were changed. The short initial tool transport interruption recovered on one harmless read retry; it caused no partial edit or ownership transfer. No generated outputs, build, GPU run or commit was produced during the fix pass.

## Generator compatibility findings requiring their owners

These are real existing requests previously dropped without an error. Coordinates below are authoring cells; multiply by five for scene feet. The new strict checks intentionally stop affected generation until its owner corrects the intended boundary. No coordinate repair was attempted in this shared-library lane.

| Generator / site / level | Unsupported request | Ownership / next step |
|---|---|---|
| `vallaki-sites.py`, N4, ground | Windows `(3, 7.5) -> (4, 7.5)` and `(3, 13.5) -> (4, 13.5)` | Local Vallaki owner must resolve intended wall geometry. |
| `vallaki-sites.py`, N5, yard | `N5d-door`, `(11, 17) -> (11, 18)` | Local Vallaki owner must resolve stockyard access. |
| `castle-ravenloft.py`, K, ground | `K22-door`, `(22, 26) -> (22, 28)` | Cloud Castle generator owner; communicate before regeneration. |
| `castle-ravenloft.py`, K, court | `K28-doors`, `(50, 33) -> (50, 35)` | Cloud Castle generator owner; communicate before regeneration. |

N4 ground and Castle court also contain baseline coincident-wall aperture failures, but they are not counted as corrected until their whole levels pass the consumption guard. Parent/root was notified of the exact four failures and file ownership.

`import-ml.py` has a separate exact-key wall builder and emits E5; it does not use this correction. `amber-temple.py` overrides `Level.build_walls()` and likewise requires separate review. No claim is made that all 25 previously observed normal-wall overlaps, all 47 previously unprobed doors, non-collinear crossing barriers, or complete movement routes are resolved by this change.

## Review and integration gates

Both initial independent reviews are complete and the **single permitted fix pass is complete**. Root retains final verification and any decision about further findings; this lane has stopped implementation. Full build/unit checks, actual deterministic scene regeneration and diff review, all-map movement reprobes, door state/browser tests, source and visual verification, and release CI remain the integration owner's gates. No GPU or visual claim is made here. The three final release review lenses remain pending.

After review and generator-owner corrections, regenerate the affected scenes through their scripts, then run the existing movement algorithm against actual generated wall geometry. Explicitly exercise closed, locked, open and revealed-secret states; do not make movement ignore normal walls to hide authoring failures. Preserve source geometry and record any newly required saved-state migration with actual fixtures.

Required attribution for an eventual integrating commit:

```text
Co-Authored-By: ChatGPT <noreply@openai.com>
Agent: ChatGPT (continuing item 2)
```
