# Published map coverage audit

Base: `aea9fc9243106beef21dea9d78113e73e63abfda`. Test-only verification on 2026-10-14; no runtime, generator, migration, roof, hydrology or renderer edits. This does not reconstruct unavailable laptop work or diagnose its unreported single unit failure.

## Discovery and reproducibility

`tests/audits/mapCoverage.ts` reads every JSON manifest with a locations array, records its campaign associations, unions every declared location path with recursively discovered scene/world files, and sorts its output. Development paths are explicitly separate. Missing campaign manifests, unbuilt entries and unregistered scenes remain visible. The production scan uses discovered scenes and their actual levels, never the historical audit inventory or a fixed list of map names.

Run from repository root:

```sh
MAP_COVERAGE_OUTPUT=/tmp/mistlab-coverage.json npx vitest run --maxWorkers=1 tests/map-coverage-audit.test.ts
```

The optional output contains a row per map, level, direction and door. It has no timestamps or sourcebook content. Without the environment variable the audit writes no file. Repeated audit output is asserted identical. Temporary fixture tests verify discovery of new manifests, unregistered scenes, regions, development fixtures and unbuilt entries; geometry fixtures distinguish collinear overlap from a crossing, a touch and parallel walls.

## Results and evidence boundaries

| Measure | Result | Meaning |
|---|---:|---|
| Discovered location paths | 48 | Includes the two explicitly separated entries below |
| Built production maps | 46 | 44 scenes and two regions |
| Production levels | 122 | Every discovered scene level accounted for |
| Explicit link directions | 346 | Exact endpoint selection in both link-array orders; each marker retained once |
| Authored endpoint floor predicate | 328 inside, 18 outside | Point-in-polygon observation only; no snapping, clearance or source judgment |
| Door/secret-door records | 418 | Every authored record checked; secrets explicitly modelled as revealed doors |
| Closed/open target-blocker states | 418 block / 418 unblock | Isolated `moveBlockers` state behavior, not an actual crossing |
| Positive collinear overlaps with other current blockers | 0 | Does not test crossing walls, nearby obstacles or full route reachability |

The unbuilt `ch02/encounter-terrain` entry and development `dev/m0-test-room` are reported separately. Region maps have no scene-level transition/door test; their roads, terrain and hydrology are untested here. All direction and door rows explicitly carry untested runtime categories. This audit does not check automatic triggers, snapping, approach/departure, secret-reveal actions, lock actions, token clearance, persistence, browser UI, rendering or GPU behavior. Door counts include secrets and differ from the earlier 365-door probe; these are not directly comparable coverage totals.

The floor observation uses the existing point-in-polygon predicate, including its boundary behavior. An outside observation can require geometry or intended link-kind interpretation. None is silently discarded or declared fixed.

## Retained off-floor observations

| Map | Link | Endpoint |
|---|---|---|
| `ch02/F` | `F-knoll-stair` | to |
| `ch02/I` | `I-scramble-post` | to |
| `ch02/R` | `R-ford-east` | from |
| `ch02/R` | `R-ford-west` | from |
| `ch08/S` | `lk-ladder-a` | to |
| `ch08/S` | `lk-ladder-b` | to |
| `ch08/S` | `lk-ladder-c` | to |
| `ch08/S` | `lk-ladder-f` | to |
| `ch08/S` | `lk-ladder-g` | to |
| `ch08/S` | `lk-ladder-h` | to |
| `ch08/S` | `lk-ladder-i` | to |
| `ch08/S` | `lk-ladder-j` | to |
| `ch11/V` | `V-lift-1` | to |
| `ch11/V` | `V-lift-2` | from |
| `ch11/V` | `V-lift-2` | to |
| `ch11/V` | `V-lift-3` | from |
| `ch12/W` | `W13` | from |
| `ch12/W` | `W16-hole` | from |

## Focused validation

Build and typecheck pass; standard atlas/massing build steps produced no tracked changes. Seven focused test files pass **112 tests** in 14.92 seconds: new coverage audit plus existing landing geometry, E5 geometry, Vallaki apertures, WSC walkable floor, movement-blocker endpoints and link markers. The new audit alone has three tests. The full 675-unit suite and browser/GPU suites were not rerun. No existing assertions, timeouts or skips were changed. Evidence JSON and logs remain outside Git under `/workspace/vtt-cloud-evidence`.

One sequential independent read-only review completed with no blocker. Known migration, roof, regional terrain and broader all-map acceptance gates remain open; CPU coverage is not all-map certification.
