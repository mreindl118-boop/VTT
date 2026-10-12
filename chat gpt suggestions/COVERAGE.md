# Audit coverage and limitations

Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4  
Review date: 2026-10-12 UTC  
Method: read-only GitHub source, configuration, commit and CI inspection; static metadata analysis of fetched JSON. No repository checkout, build, test execution, deployment or browser session was performed.

## Reviewed substantially

- App entrypoint and orchestration: main.ts and app.ts, including mode handling, party/encounter lifecycle, scene navigation, labels, input handlers, saving and display synchronization
- UI: encounter, world map, library, minimap and view slider; relevant CSS
- State: campaign types, BroadcastChannel wrapper and IndexedDB wrapper
- Core: coverage, range, light and scene schema; geometry and movement in relevant flows
- Rendering: renderer/camera lifecycle, range overlays, relevant scene-building, material, visibility and backdrop allocation paths
- Configuration: package.json, dependency-engine entries in package-lock.json, tsconfig, Vite, Playwright, CI, PWA manifest, service worker and gitignore
- Tests: coverage, range, vision, movement, player-safety and manifest tests; the four E2E specification files and helpers, emphasizing scenarios related to the findings
- Documentation: README, current queue, campaign and pipeline documentation, slider contract, and relevant changelog/roadmap sections

Reading a file for relevant logic does not certify every line or every interaction in that file.

## Structural data pass

The repository tree contained 248 tracked file blobs and 45 scene JSON files. Of those scene files, 44 were fetched and parsed. The pass counted levels, rooms, object records and optional room metadata, and checked discovered entry/parent/room-entry references against the available path inventory. It was not a visual map review or full semantic validator.

The 44 read scenes contain 702 room records and 17,165 object records. The totals include the development fixture and Sheep Chase. Missing optional page/description/note values can be intentional and require content triage; they are not automatically bugs.

No duplicate level IDs or unknown entry/parent/discovered room-entry paths were found in that limited pass. This does not validate links, geometry, stairs, collisions, object identities, secret text, source-book measurements or runtime imports comprehensively.

| Scene file | Levels | Rooms | Objects | Partial flag |
|---|---:|---:|---:|---|
| locations/appB/death-house/scene.json | 6 | 57 | 472 | no |
| locations/ch02/A/scene.json | 1 | 1 | 670 | no |
| locations/ch02/B/scene.json | 1 | 1 | 630 | no |
| locations/ch02/C/scene.json | 1 | 1 | 178 | no |
| locations/ch02/D/scene.json | 1 | 2 | 427 | no |
| locations/ch02/F/scene.json | 1 | 3 | 703 | no |
| locations/ch02/G/scene.json | 1 | 1 | 81 | no |
| locations/ch02/H/scene.json | 1 | 2 | 527 | no |
| locations/ch02/I/scene.json | 1 | 1 | 633 | no |
| locations/ch02/J/scene.json | 1 | 3 | 379 | no |
| locations/ch02/L/scene.json | 1 | 2 | 208 | no |
| locations/ch02/M/scene.json | 1 | 1 | 482 | no |
| locations/ch02/P/scene.json | 1 | 1 | 829 | no |
| locations/ch02/R/scene.json | 1 | 2 | 906 | no |
| locations/ch03/E/scene.json | 1 | 7 | 173 | no |
| locations/ch03/E5/scene.json | 2 | 7 | 39 | no |
| locations/ch04/K/scene.json | 12 | 161 | 386 | yes |
| locations/ch05/N/scene.json | unread | unread | unread | unread |
| locations/ch05/N1/scene.json | 1 | 6 | 44 | no |
| locations/ch05/N2/scene.json | 3 | 20 | 136 | no |
| locations/ch05/N3/scene.json | 3 | 23 | 127 | no |
| locations/ch05/N4/scene.json | 3 | 28 | 129 | no |
| locations/ch05/N5/scene.json | 1 | 4 | 35 | no |
| locations/ch05/N6/scene.json | 2 | 8 | 64 | no |
| locations/ch05/N7/scene.json | 1 | 3 | 17 | no |
| locations/ch05/N8/scene.json | 1 | 5 | 56 | no |
| locations/ch05/N9/scene.json | 1 | 18 | 68 | no |
| locations/ch06/O/scene.json | 4 | 4 | 64 | no |
| locations/ch07/Q/scene.json | 6 | 77 | 427 | no |
| locations/ch08/S/scene.json | 3 | 24 | 2564 | no |
| locations/ch08/S10/scene.json | 5 | 42 | 421 | no |
| locations/ch09/T/scene.json | 4 | 13 | 154 | no |
| locations/ch10/U/scene.json | 2 | 11 | 1393 | no |
| locations/ch10/U3/scene.json | 2 | 2 | 52 | no |
| locations/ch11/V/scene.json | 4 | 9 | 368 | no |
| locations/ch12/W/scene.json | 4 | 30 | 633 | no |
| locations/ch13/X/scene.json | 3 | 62 | 461 | no |
| locations/ch14/Y/scene.json | 2 | 12 | 1737 | no |
| locations/ch15/Z/scene.json | 2 | 14 | 261 | no |
| locations/dev/m0-test-room/scene.json | 2 | 4 | 10 | no |
| locations/wsc/01-tavern/scene.json | 2 | 14 | 91 | no |
| locations/wsc/02-street/scene.json | 1 | 6 | 42 | no |
| locations/wsc/03-compound/scene.json | 4 | 7 | 46 | no |
| locations/wsc/03a-road/scene.json | 1 | 2 | 7 | no |
| locations/wsc/03b-path/scene.json | 1 | 1 | 35 | no |

The connector returned an empty content field for locations/ch05/N/scene.json, whose repository tree size is 1,180,516 bytes. It remains unreviewed and is excluded from totals. This is a retrieval limit, not evidence that the repository file is empty.

Selected content-readiness indicators:
- Castle Ravenloft: 161 room records; 129 without descriptions; 6 without page values; scene partial=true
- Read Curse of Strahd scenes excluding dev and Sheep Chase: 38 scenes; 668 rooms; 74 missing page values; 146 missing descriptions
- Many hidden authored objects outside Death House lack an explicit playerLabel, but fallback naming was not exhaustively reviewed. Do not label all such records as leaks without checking the actual player-facing projection.

Sources: [repository tree](https://github.com/mreindl118-boop/VTT/tree/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/locations), [Castle scene](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/locations/ch04/K/scene.json), [manifest](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/manifests/locations.json).

## Existing automated assurance

The reviewed tree has 15 Vitest test files and 4 Playwright specification files. The Chromium suite uses a 1024×768 viewport and software rendering flags. Its standard boot helper disables the service worker. The shared scene fixtures focus on the test room and two Death House floors, although some individual tests exercise other campaign/navigation flows.

[CI run 38197034901](https://github.com/mreindl118-boop/VTT/actions/runs/38197034901) passed for 7cea5b32cddfe9ffb3c9e660dd179a815facbce4. Its successful steps were dependency installation, typecheck, unit tests, Chromium installation and E2E tests.

Those results are externally observed CI results, not tests executed during this audit. The new fixtures and proposed acceptance tests in the finding documents remain unrun.

## Explicitly unreviewed or unverified

- Runtime reproduction of every finding, exact browser timing, screenshots and pixel-level severity
- Native Safari/iPad, touch, orientation, split view, installation, background/resume, quota behavior and offline operation
- Full geometry and visual fidelity of all 45 maps and procedural kit models
- Vallaki town scene contents
- Exhaustive accuracy of page references, descriptions, creature statistics and D&D rules against their source material
- Full sky, terrain, travel, grid and unit-math edge cases
- All authoring Python scripts and reproducibility of generated assets
- Every historical design document and queue-referenced WIP commit
- Dependency vulnerability analysis, license audit and adversarial network security
- Full keyboard, screen-reader and accessibility audit
- Actual performance budgets, draw-call counts, GPU memory growth rates and iPad crash thresholds
- Full protection against a person deliberately inspecting the app's bundled data or using DevTools; the current product is a same-browser table display rather than an authentication boundary

## Coverage needed for the next validation pass

1. Revalidate the 14 findings against the chosen current branch and pending work.
2. Add focused regressions before fixes; prioritize data safety, player secrecy and encounter continuity.
3. Run full existing checks plus fault-injection, stale-request, repeated-update and multi-window cases.
4. Add a service-worker-enabled production/offline suite.
5. Exercise representative large, multi-level, outdoor, nested-parent and second-campaign maps on target devices.
6. Record a repeatable performance and memory baseline.
7. Review source-derived content readiness with the owner without committing book text or scans.

This is a broad source audit with explicit sampling boundaries, not a claim that every file or behavior is fully reviewed.

