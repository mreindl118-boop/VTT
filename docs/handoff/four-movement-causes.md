# Four movement findings: diagnostic closure

2026-10-14. Runtime/map base `aea9fc9243106beef21dea9d78113e73e63abfda`; preceding evidence `45ca922a7cdef3be8ff71976446c8999d18f1c91`. Coordinator-only, read-only diagnostic. No runtime, map, generator or renderer edits; no workers, broad reruns or new GPU claims.

A temporary instrumented copy of the published `canWalk` records BFS parents and rejection reasons without changing floor, lattice, attachment or collision rules. Its gate and K37 booleans were compared with the unmodified production function. The trace's gate route has zero blocked edges under the actual segment collision predicate. Two small diagnostic runs completed (1.05s and 1.35s). All counterfactual segment changes below were **in memory only**; they are causal tests, not proposed ready-to-apply patches.

## 1. Krezk closed gate: route around the unrepresented cliff

Fixture: `ch08/S`, `village`, close `S2-gate`; move `[417.5,757.5]` to `[417.5,752.5]`.

- The gate collision segment is `[409,755] → [427,755]`. Direct crossing is blocked correctly.
- Actual BFS accepts a **659.629-ft route with 218 vertices**, not the five-foot straight crossing. Representative route coordinates: `[417.5,757.5] → [421.25,756.25] → [521.25,756.25] → [571.25,706.25] → [571.25,548.75] → [568.75,546.25] → [568.75,543.75] → [568.75,541.25] → [566.25,538.75] → [566.25,536.25] → [563.75,533.75] → [561.25,536.25]`, then southwest through the interior and back to `[417.5,752.5]`. These are selected vertices, not a replacement simplified collision path; the full trace is retained locally.
- Relevant real blockers: `kw-0 [565,536] → [568.75,547.5]`, `kw-1 [568.75,547.5] → [568.75,707.5]`, `kw-2 [568.75,707.5] → [521.25,755]`, `kw-3 [521.25,755] → [427,755]`, and the closed gate. The traced route crosses none of them.
- `krezk_land.py` deliberately ends physical walls where the cliff replaces them: the unwalled boundary is `[413.75,155] → [565,536]`. `krezk-village.py` emits collision from `WALL_RUNS`, leaving this cliff edge absent. The accepted route crosses that boundary on `[566.25,536.25] → [563.75,533.75]` at approximately **`[564.342,534.342]`**. Movement checks two-dimensional floor and blockers, not terrain grade/height.
- Adding only that diagnostic cliff segment to the in-memory blockers changes production `canWalk` from **true to false** for this fixture.

**Conclusion:** a valid path under the current 2D collision data bypasses the gate via the unwalled cliff boundary. This is not a closed-gate collision leak. **Owner recommendation:** represent the intended cliff/access restrictions in movement data, while preserving S5 and other intended level connections. Do not blindly add a physical masonry wall or seal the entire boundary without resolving legitimate access. Keep the closed-gate end-to-end fixture as a regression for the intended enclosure behavior.

## 2. Castle K37-north-b: a diagonal tower wall blocks the open route

Fixture: `ch04/K`, `weeping`, open `K37-north-b`; move `[172.5,162.5]` to `[172.5,157.5]`.

Both points have runtime floor and attach to movement nodes. BFS visits 95 nodes but cannot connect them. The doorway itself spans `[165,160] → [175,160]`; opening it correctly removes that blocker. The remaining crossing blocker is **`weeping-w-7 [162.5,152.2485] → [172.7515,162.5]`**, a normal ashlar diagonal belonging to the octagonal K20 tower boundary. K37's rectangular room reaches z160; the tower's diagonal crosses that entrance region.

Removing only `weeping-w-7` from the in-memory open-door blockers changes production `canWalk` from **false to true**. The earlier zero-collinear-overlap audit could not catch this non-collinear crossing.

**Owner recommendation:** reconcile the intended K37/K20 connection and author a real shared opening, or correct the doorway placement. Do not remove the whole tower wall merely because the diagnostic removal passes. Minimal regression: both floor points remain valid; closed door rejects passage; the corrected open connection permits forward and reverse passage without deleting unrelated tower collision.

## 3. Castle K35: exact competing transition identified

Fixture: on `weeping`, move `[157.5,232.5] → [162.5,232.5]` toward locked `K35-door` (`[165,225] → [165,235]`).

The unique newly entered transition is **`lk-k64-weep`, its `to` endpoint `[162.5,237.5]` on weeping**. Previous distance is **7.0711 ft**, new distance **5 ft**. The current 5.5-ft automatic trigger therefore resolves to **`court [162.5,237.5]`**, exactly matching the prior browser observation. No array-order ambiguity or door-state error is involved.

**Owner recommendation:** review the authored approach and automatic-trigger eligibility near K35. A proximity-only stair trigger currently intercepts this door approach. Preserve a fixture asserting that this exact move resolves `lk-k64-weep` today; any intended behavior change needs an explicit doorway/stair geometry or interaction decision. Moving the link or globally shrinking the trigger is not justified by this one observation alone.

## 4. Krezk ladder-a: one-cell wall-walk stub

Fixture: `ch08/S`, `walls`, raw ladder top `[566.4,541.91]`, arrival `[567.5,542.5]`.

The runtime room `S2-a` polygon is `[[568.3,539.66],[569.26,542.6],[564.5,544.15],[563.54,541.21]]`: approximately **3.093 × 5.006 ft**. Its wall segment `kw-0` is only approximately 12.1 ft long; the generator trims 4.5 ft at each end before creating the walk strip. Thus the very short terminal run leaves a floor stub rather than a continuous five-foot walk.

All eight adjacent snapped destinations are outside runtime floor: `[572.5,542.5]`, `[572.5,547.5]`, `[567.5,547.5]`, `[562.5,547.5]`, `[562.5,542.5]`, `[562.5,537.5]`, `[567.5,537.5]`, `[572.5,537.5]`. Rejection occurs at the destination-floor check, before lattice attachment or wall collision. The starting point touches no collision wall. Production `canWalk([567.5,542.5],[566.4,541.91],...)` **passes** without snapping, confirming local floor exists.

**Owner recommendation:** decide whether this short run is an intentional ladder platform or should connect to a neighboring wall/tower. If a walkable connection is intended, author that supported connection and add a snapped-departure regression. If it is intentionally only a platform, test its explicit ladder interaction and communicate that constraint; do not weaken global movement or invent floor outside its footprint.

## Evidence and stop condition

Full trace and minimal fixtures: `/workspace/vtt-cloud-evidence/four-causes.json`, `four-causes.test.ts`, `traceMovement.ts`, and `four-causes-confirmation.log`. The temporary tracer was derived from the published movement source; it was not installed into the app. No book text/art, screenshots or private saves were copied. All four cases now have a causal explanation; remaining decisions concern intended authored geometry/access. No further pass was started.
