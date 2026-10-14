# Bounded movement follow-up

2026-10-14, published coverage candidate `ca63a732b656a683457fe3321ef5714551195a47`, runtime/data `aea9fc9243106beef21dea9d78113e73e63abfda`. Reused frozen build `index-CWlyiRy1.js`. Evidence-only pass; no implementation or generator changes. Stopped after the requested scenes and 18 observations were classified.

## Method and limits

The previous 18 observations used grid floor polygons alone. Production movement and arrival use **grid polygons plus room polygons** (`app.ts`, `canWalkTo` and `traversePartyLink`). This distinction resolves eight apparent wall-walk floor omissions before any map edit.

CPU diagnostics evaluated real `canWalk` paths with current blockers and runtime floor union, not only wall overlap or link dispatch. Across WSC street, N1–N6, E5, S/S10, Castle, Tsolenka and R, 225 door/secret records were enumerated: 126 supported the two-sided probe, 64 exceeded the 12,000-cell CPU budget, and 35 lacked two-sided floor at the chosen raw offsets. Unsupported probes are not passes. The initial larger-budget diagnostic was interrupted and is not counted as completed evidence.

System Chromium/SwiftShader then exercised 17 selected ordinary-door sequences in the running app, with initial fixture placement followed by **production `moveTokenTo` calls in Players view**, grid-snapped approach, closed crossing, opening through `toggleDoor` in DM view, open crossing, and return. Initial placement was the only teleport; no `takeLink` calls established these crossing results. The door under test was initialized closed. Each scene used a fresh browser page/context; cases within a scene were sequential, so previously opened doors could remain open. These are not independent all-doors-default fixtures and do not certify player lock/reveal UI. They exercise the production movement handler and persistence/reveal side effects, **not pointer hit-testing or an animated traced path**. Pathfinding may take an alternative route.

Endpoint departure probes initialized an arrival pose and its arrival guard, then attempted real movements. A separate bounded approach search used valid-floor points outside the 5.5-ft trigger radius, then actual movement to a valid-floor point inside it. Successful floor changes below are automatic approach results, not direct dispatch. Failed searches and failed movements are retained. Software rendering is not hardware GPU verification. No full suite was repeated or acceptance thresholds changed.

## Eighteen endpoint observations

Coordinates are local scene feet `[x,z]`. `from`/`to` names the observed endpoint. All listed off-grid observations remain in the earlier ledger; this table adds classification rather than deleting them.

| Map / link / end | Raw point → arrival | Classification / runtime evidence |
|---|---|---|
| `ch02/F` / `F-knoll-stair` / to | [246, 242] → [247.5, 242.5] | Center remains outside runtime floor; valid approach [237.5, 252.5] → [242.5, 242.5] triggers day [262.5, 242.5]. Off-floor center alone does not prove unusable route. |
| `ch02/I` / `I-scramble-post` / to | [264, 112] → [262.5, 112.5] | Center remains outside runtime floor; valid approach [277.5, 112.5] → [267.5, 112.5] triggers day [272.5, 187.5]. Off-floor center alone does not prove unusable route. |
| `ch02/R` / `R-ford-east` / from | [298.1, 297.4] → [297.5, 297.5] | Center remains outside runtime floor; valid approach [312.5, 297.5] → [302.5, 297.5] triggers river [272.5, 287.5]. Off-floor center alone does not prove unusable route. |
| `ch02/R` / `R-ford-west` / from | [211.9, 262.6] → [212.5, 262.5] | Center remains outside runtime floor; valid approach [202.5, 267.5] → [207.5, 262.5] triggers river [237.5, 272.5]. Off-floor center alone does not prove unusable route. |
| `ch08/S` / `lk-ladder-a` / to | [566.4, 541.91] → [567.5, 542.5] | Room polygon supplies floor (grid-only omission). Eight local snapped departure attempts failed; no bounded snapped approach candidate. Owner review required. |
| `ch08/S` / `lk-ladder-b` / to | [568.25, 627.5] → [567.5, 627.5] | Room polygon supplies floor (grid-only omission). Approach [567.5, 637.5] → [567.5, 632.5] triggers village [562.5, 627.5]. |
| `ch08/S` / `lk-ladder-c` / to | [544.65, 730.9] → [542.5, 732.5] | Room polygon supplies floor (grid-only omission). Approach [537.5, 737.5] → [542.5, 732.5] triggers village [542.5, 727.5]. |
| `ch08/S` / `lk-ladder-f` / to | [176.6, 658.4] → [177.5, 657.5] | Room polygon supplies floor (grid-only omission). Approach [187.5, 667.5] → [177.5, 662.5] triggers village [182.5, 652.5]. |
| `ch08/S` / `lk-ladder-g` / to | [81.75, 437.5] → [82.5, 437.5] | Room polygon supplies floor (grid-only omission). Approach [82.5, 447.5] → [82.5, 442.5] triggers village [87.5, 437.5]. |
| `ch08/S` / `lk-ladder-h` / to | [180.36, 213.48] → [182.5, 212.5] | Room polygon supplies floor (grid-only omission). Approach [172.5, 222.5] → [177.5, 217.5] triggers village [182.5, 217.5]. |
| `ch08/S` / `lk-ladder-i` / to | [327.5, 114.25] → [327.5, 112.5] | Room polygon supplies floor (grid-only omission). Approach [337.5, 112.5] → [332.5, 112.5] triggers village [327.5, 117.5]. |
| `ch08/S` / `lk-ladder-j` / to | [395.25, 134.71] → [395.25, 134.71] | Room polygon supplies floor (grid-only omission). Approach [402.5, 142.5] → [397.5, 137.5] triggers village [392.5, 137.5]. |
| `ch11/V` / `V-lift-1` / to | [252.5, 222.5] → [252.5, 222.5] | Intentional lift opening (keyhole floor in van-richten-tower.py); bounded walking approach not found. Four records describe two opening positions. Do not fill the shaft to satisfy a floor test. |
| `ch11/V` / `V-lift-2` / from | [252.5, 222.5] → [252.5, 222.5] | Intentional lift opening (keyhole floor in van-richten-tower.py); bounded walking approach not found. Four records describe two opening positions. Do not fill the shaft to satisfy a floor test. |
| `ch11/V` / `V-lift-2` / to | [252.5, 222.5] → [252.5, 222.5] | Intentional lift opening (keyhole floor in van-richten-tower.py); bounded walking approach not found. Four records describe two opening positions. Do not fill the shaft to satisfy a floor test. |
| `ch11/V` / `V-lift-3` / from | [252.5, 222.5] → [252.5, 222.5] | Intentional lift opening (keyhole floor in van-richten-tower.py); bounded walking approach not found. Four records describe two opening positions. Do not fill the shaft to satisfy a floor test. |
| `ch12/W` / `W13` / from | [52, 117.5] → [52.5, 117.5] | Center remains outside runtime floor; valid approach [42.5, 122.5] → [47.5, 117.5] triggers cellar [67.5, 117.5]. Off-floor center alone does not prove unusable route. |
| `ch12/W` / `W16-hole` / from | [85, 90] → [87.5, 92.5] | Intentional loading-shaft opening (W16 polygon in wizard-of-wines.py); no bounded ordinary walking approach. Requires shaft-specific acceptance, not an invented floor patch. |

Twelve observations support valid nearby automatic return/entry approaches: seven Krezk wall-walk endpoints plus F, I, both R fords and W13. The other six are ladder-a and the five intentional-opening records. No concealed-gate explanation was established for these 18; hidden guard creatures on Krezk walls are not hatch-reveal gates.

Krezk `lk-ladder-j` specifically preserves its raw safe arrival `[395.25,134.71]`, but snapping a return toward it targets `[397.5,132.5]`, which is rejected. The nearby approach in the table still works. This is a reproducible click-target usability observation, not proof that the ladder route is disconnected.

## Door results and exact reproductions

In each sequence below, coordinates are **initial → approach → other side**. A full result means approach succeeds, crossing is rejected closed, crossing succeeds open and return succeeds, all on the stated level. Initial results and the one bounded coordinate retry are retained separately in local evidence.

| Scene / level / door | Coordinates | Result |
|---|---|---|
| `wsc/02-street` / L0 / `sq-stable-door` | [72.5, 42.5] → [77.5, 42.5] → [82.5, 42.5] | Full sequence passes. |
| `ch05/N1` / ground / `N1-ground-w-55` | [22.5, 27.5] → [27.5, 27.5] → [32.5, 27.5] | Full sequence passes. |
| `ch05/N2` / ground / `N2f-north` | [32.5, 42.5] → [32.5, 37.5] → [32.5, 32.5] | Full sequence passes. |
| `ch05/N2` / ground / `N2f-small` | [52.5, 42.5] → [57.5, 42.5] → [62.5, 42.5] | Initial target lies on perpendicular closed secret door. Offset retry passes full sequence: [52.5,37.5] → [57.5,37.5] → [62.5,37.5]. |
| `ch05/N2` / upper / `N2l-s-door` | [152.5, 97.5] → [157.5, 97.5] → [162.5, 97.5] | Approach point is unsuitable/on wall. Open crossing succeeds in initial or offset retry; full approach/return sequence not certified. |
| `ch05/N3` / ground / `N3h-f` | [37.5, 27.5] → [42.5, 27.5] → [47.5, 27.5] | Approach point is unsuitable/on wall. Open crossing succeeds in initial or offset retry; full approach/return sequence not certified. |
| `ch05/N3` / upper / `N3k-door` | [102.5, 27.5] → [107.5, 27.5] → [112.5, 27.5] | Approach point is unsuitable/on wall. Open crossing succeeds in initial or offset retry; full approach/return sequence not certified. |
| `ch05/N4` / ground / `N4k-door` | [22.5, 52.5] → [27.5, 52.5] → [32.5, 52.5] | Full sequence passes. |
| `ch05/N5` / yard / `N5-gate` | [62.5, 7.5] → [62.5, 2.5] → [62.5, -2.5] | Full sequence passes. |
| `ch05/N6` / ground / `N6b-a` | [62.5, 107.5] → [62.5, 102.5] → [62.5, 97.5] | Full sequence passes. |
| `ch03/E5` / ground / `ground-w-55` | [22.5, 27.5] → [27.5, 27.5] → [32.5, 27.5] | Full sequence passes. |
| `ch08/S` / village / `S2-gate` | [417.5, 762.5] → [417.5, 757.5] → [417.5, 752.5] | Closed state still permits route. Alternative-path versus gate-blocking cause is unresolved; not a closed-door pass. |
| `ch08/S10` / upper / `S20-walk-door` | [172.5, 172.5] → [177.5, 172.5] → [182.5, 172.5] | Full sequence passes. |
| `ch04/K` / larders / `K70-north` | [162.5, 122.5] → [162.5, 117.5] → [162.5, 112.5] | Full sequence passes. |
| `ch04/K` / weeping / `K37-north-b` | [172.5, 167.5] → [172.5, 162.5] → [172.5, 157.5] | Approach succeeds; open crossing still fails. Offset retries lack suitable floor; retained owner finding. |
| `ch04/K` / weeping / `K35-door` | [157.5, 232.5] → [162.5, 232.5] → [167.5, 232.5] | Interrupted: approach triggers a floor transition; remaining movements are not door verification. |
| `ch09/T` / pass / `T4-door` | [242.5, 357.5] → [247.5, 357.5] → [252.5, 357.5] | Full sequence passes. |

Eleven full door sequences pass (ten initial, plus N2f-small's corrected probe). This is a selected-site sample, not all 225 doors. R has no authored door records; its two ford approaches are covered above. S gate and K35 are excluded from closed-door correctness counts.

The N2/N3 raw normal-offset probes can snap onto wall planes. N2f-small's original destination `[62.5,42.5]` lies on `ground-sd-kitchen-stair`; N2l-s-door's original start `[152.5,97.5]` lies on `N2m-door`; N3k-door's original start `[102.5,27.5]` lies on `upper-w-170`. These do not establish blocked apertures. Offset retries let N2l-s-door and N3k-door cross after opening, but their nominal approach/return targets still land on adjacent wall planes; retain that coverage limit rather than calling the whole sequence passed. N3h-f similarly permits open crossing/return in its initial probe but not the requested approach.

## Actionable owner follow-up (no fixes made)

1. **Krezk ladder-a:** on `S/walls`, initialize the real arrival `[567.5,542.5]` for raw `[566.4,541.91]`. Eight snapped five-foot radial departures fail. Runtime room floor exists, but no suitable snapped twelve-foot-to-four-foot approach was found in 32 directions. Review narrow diagonal wall-walk/lattice compatibility; do not blindly add grid floor over the whole settlement.
2. **Castle K37-north-b:** `weeping`, approach `[172.5,167.5] → [172.5,162.5]` succeeds; crossing to `[172.5,157.5]` is rejected with the door closed **and open**. The door spans `[165,160] → [175,160]`. Offsets −5, +5 and −10 ft did not supply two valid floor sides. Determine intended landing/floor connection before changing the door or movement engine.
3. **Krezk S2-gate:** `village`, `[417.5,762.5] → [417.5,757.5] → [417.5,752.5]` remains reachable after forcing the effective gate closed. Trace whether the path legitimately routes around the enclosure. The boolean route result does not prove a direct wall crossing.
4. **Castle K35-door:** approach `[157.5,232.5] → [162.5,232.5]` moves the party from `weeping` to `court [162.5,237.5]` before a door crossing. Owner should assess stair-trigger proximity versus intended access; this test must not count later court movements as K35 passage.
5. **Lift/shaft acceptance:** V's f2/f3 opening and W16's shaft need a route-specific interaction journey. Their authored openings are intentional; this walking-only pass does not establish failure of the intended lift/drop mechanic. The first f3 departure probe tried only its first eligible CPU candidate and failed; it is not evidence that every exit fails.

## Reproduction and evidence

Open `/?nosw&scene=<path>`, await `window.__mistlab.ready`, and use the listed local coordinates. Fixture setup uses `m.moveParty(level,...start)`, `a.setView('players')`, and the specific door closed state; movement uses `a.moveTokenTo(a.party.id,a.snap(target))`. Open the door through `a.setView('dm'); a.toggleDoor(id); a.setView('players')`, then retry the exact target and return. Record both position **and level** after each action. For endpoint approaches, clear only the transient arrival guard in the fresh fixture, then move from the listed far point to near point; do not call `takeLink` to establish approach success.

Local-only, source-derived evidence: `/workspace/vtt-cloud-evidence/bounded-runtime.json`, `bounded-browser.json`, `bounded-followup.json`, their scripts/logs and `endpoint-approaches.json`. No screenshots, sourcebook text/art or private campaign data were published. This report contains coordinate results only. One sequential independent read-only review verified the counts, coordinates and qualification of findings against the recorded evidence; no blocker found.
