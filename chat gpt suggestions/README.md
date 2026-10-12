# mistLAB source audit and suggestions

## A note from ChatGPT to Matt, Claude and future contributors

Hello, I'm ChatGPT. Matt asked me to provide an independent secondary source of review and inspiration for mistLAB. This folder is my contribution: evidence-backed observations, possible improvements and questions to consider alongside the project's existing work. Matt remains the decision-maker.

Claude, please evaluate each suggestion against the current code, project instructions, roadmap, active work and Matt's latest decisions. Explain whether it still applies, what it would improve, its tradeoffs and how it relates to work already planned or completed. Then ask Matt whether he wants that item implemented, revised, deferred or rejected before acting on it. A useful question is: “This suggestion appears to address [specific issue], with [tradeoff or overlap]. Would you like me to implement it, adjust it, or leave it for now?”

The presence of a report in this folder is not an implementation instruction, approval to change the app, a new requirement or permission to reorder the work queue. Matt's approval to publish these documents is not approval to implement their suggestions. Respect existing project instructions and user decisions; if an item conflicts with them or has already been resolved, explain that rather than treating this review as higher authority.

These reports are advisory. Source-confirmed findings describe evidence in the reviewed commit; the proposed runtime reproductions and acceptance tests have not been run. Revalidate against the current target branch before relying on any finding. Recommendations, severity and implementation ideas may change with new evidence or Matt's intended behavior.

Each item can evolve, be accepted, deferred, rejected or removed independently. Keep useful context and decisions with the relevant item when Matt chooses to proceed. This folder does not establish an ongoing review schedule or give ChatGPT or any other assistant continuing authority to make changes.

## Review overview

This review identifies practical ways to make mistLAB safer and more dependable at the game table. The strongest issues concern saved campaigns, player-visible secrets, encounter transitions, map changes and long-session reliability.

Reviewed repository: [mreindl118-boop/VTT](https://github.com/mreindl118-boop/VTT)  
Reviewed branch: claude/mistlab-curse-strahd-x6jm13  
Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4  
Review date: 2026-10-12 UTC

## Verification status

This is a source audit, not a completed hands-on acceptance test. No repository code or tests were executed during this review. Findings labeled code-confirmed are supported by control flow or configuration; their proposed runtime reproductions remain unrun.

The existing [GitHub CI run](https://github.com/mreindl118-boop/VTT/actions/runs/38197034901) completed successfully for this exact commit, including npm installation, typecheck, Vitest and Playwright. That is evidence for the existing suite only. It does not establish that the new failure scenarios pass or have been reproduced.

See [coverage and limitations](COVERAGE.md) before interpreting this as an exhaustive review.

## What the application is for

mistLAB is a browser-first, iPad-first 3D tabletop for running an in-person role-playing campaign. Its original focus is Curse of Strahd; the current registry also supports A Wild Sheep Chase. It organizes original low-poly maps by the module's chapter, location and area keys, with DM and player views, scene exploration and a companion Player Display.

The project deliberately avoids bundling the source books, scans or book artwork. Source PDFs and OCR are local authoring inputs. That remains an important boundary for future content work.

Sources: [README](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/README.md), [campaign registry binding](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/campaigns.ts), [campaign documentation](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/CAMPAIGNS.md).

## Current capability map

| Area | Present in the reviewed source | Important boundary |
|---|---|---|
| Campaign and location library | Two campaign registries, per-campaign world maps and saved state, 45 scene JSON files | A file's presence does not prove its visual or content completion |
| 3D maps | Three.js geometry, procedural props and creatures, floors, doors, walls, terrain, backdrops and section cuts | Large-map appearance and performance were not measured |
| Table controls | Pan, orbit, zoom, minimap, floor selection, area search, low walls and section slider | Native iPad touch and Safari were not exercised |
| Player knowledge | DM/Player slider, reveal tools, fog and explored memory, secret-door treatment, player aliases | Several cross-surface inconsistencies are documented below |
| Tokens and encounters | Party token, placed creatures, character roster, initiative, movement and range helpers | This is not a complete rules engine or full character-sheet product |
| Regional play | World pins, party travel trail, reveal controls, clock and lighting | Nested continuous world navigation is a stated next priority |
| Local persistence | IndexedDB campaign records and local browser preferences | Saves belong to that browser origin; reliability concerns are documented |
| Player Display | Second-window state and camera synchronization over BroadcastChannel | Same-browser communication, not a network transport between physical devices |
| PWA | Manifest and production service worker | Offline readiness and install behavior require the documented fixes and testing |

## Architecture and environment

The runtime is TypeScript, Three.js and Vite with ordinary DOM/CSS UI. Pure logic lives in app/src/core; rendering in app/src/render; procedural pieces in app/src/kit; UI modules in app/src/ui; IndexedDB and display messaging in app/src/state. Location JSON is loaded through Vite dynamic imports. No backend account, external database or API key is required for the current app.

For a clean environment, use Node 24 or a Node 22 release at least 22.12. The package declares Node >=22, but the committed Vite and Vitest dependencies require the higher 22.12 minimum. Install with npm ci.

- npm run dev: development server, normally port 5173; Vite enables LAN access
- npm run typecheck: TypeScript validation
- npm test: Vitest
- npx playwright install --with-deps chromium: browser-test prerequisites
- npm run test:e2e: build and preview-based browser tests
- npm run build: production output in dist
- npm run preview: preview on port 4173
- OCR and asset authoring separately require tools such as Python, Poppler and Tesseract plus the user's source material

Sources: [package](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/package.json), [lockfile](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/package-lock.json), [Vite](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/vite.config.ts), [Playwright](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/playwright.config.ts), [CI](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/.github/workflows/ci.yml), [OCR script](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/scripts/ocr.sh).

## Independent review items

Each folder contains one reviewable topic with evidence, impact, remediation and acceptance criteria. These are suggestions for evaluation; they do not change the existing work queue or mark any work accepted.

P1 means a high-priority correctness, secrecy, data-safety or session-reliability concern. P2 means a narrower correctness or robustness concern. Priorities are recommendations, not an instruction to override the owner's current order.

| Priority | Review item | Context |
|---|---|---|
| P1 | [Restore the party after encounters](restore-party-after-encounters/README.md) | State identity |
| P1 | [Make stair traversal single hop](make-stair-traversal-single-hop/README.md) | Known roadmap defect |
| P1 | [Protect campaign saves](protect-campaign-storage/README.md) | Existing safety goal; detailed failure paths |
| P1 | [Hide live creatures at the Players slider endpoint](player-slider-live-creatures/README.md) | Visibility contract |
| P1 | [Apply hidden identities to initiative and ranges](player-initiative-visibility/README.md) | Known issue with additional overlay evidence |
| P1 | [Keep the separate Player Display read only](player-display-state-authority/README.md) | State authority |
| P1 | [Guard scene navigation in Players mode](players-mode-scene-navigation/README.md) | Known issue with additional callback evidence |
| P1 | [Stop exploration growing without movement](explored-fog-expands-without-movement/README.md) | Coverage logic |
| P1 | [Dispose obsolete GPU resources](dispose-obsolete-map-and-range-resources/README.md) | Resource lifetime; severity needs measurement |
| P1 | [Make offline preparation reliable](reliable-offline-install-and-cache/README.md) | PWA cache completeness and lifecycle |
| P2 | [Make location changes atomic](make-location-navigation-atomic/README.md) | Async race and failure recovery |
| P2 | [Synchronize display floors and explored memory](synchronize-display-navigation-and-memory/README.md) | State replication |
| P2 | [Hide unrevealed painted landmarks](world-map-hidden-landmarks/README.md) | Known roadmap defect |
| P2 | [Evaluate all reachable firing positions](ranged-overlay-line-of-sight-correctness/README.md) | Tactical range correctness |

The table is a review index, not an implementation sequence. Individual folders can be accepted, rejected, revised or removed independently.

## Existing roadmap overlap

Several findings are already recognized in [ROADMAP.md](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/ROADMAP.md), especially one-hop stairs, player initiative identity, unrevealed world symbols and hiding DM navigation during player handover. Their documents add current-source verification and specific tests. They should not be presented as newly discovered product requirements.

Campaign backups, performance, player safety and offline/cross-device operation are also existing goals. This audit traces particular failure paths rather than claiming those broader goals are new. It did not inspect every historical planning document or the WIP commits mentioned in the queue.

## Grounded next opportunities

The [current queue](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/QUEUE.md) identifies three leading product improvements:

1. A continuous nested world, progressing from region to town to building to room. Resolve atomic loading, resource cleanup and player-safe state projection before making more scenes coexist.
2. Styled D&D rules tooltips backed by the selected SRD data. Use the same alias/visibility projection across cards, initiative, labels and overlays, and verify data/licensing accuracy before incorporation.
3. A generic camera-aware dollhouse cutaway. Preserve unrevealed-room concealment, section-slider behavior and the Player Display contract in its acceptance tests.

The queue also identifies backup/restore and movable-panel work awaiting further verification or integration. Reconcile those existing implementations before starting replacements.

Quality improvements directly supporting the stated iPad-first and offline goals are a Safari/WebKit and target-device test pass, a service-worker-enabled offline suite, repeated/interrupted navigation tests, storage fault tests, and a per-map performance baseline. These are focused validation opportunities; this review does not recommend expanding into accounts, hosted multiplayer, chat or unrelated platform features.

## Content readiness

A structural metadata pass read 44 of the 45 scene JSON files. Within the 38 read Curse of Strahd scenes, excluding the test fixture and Sheep Chase, it found 668 room records, 74 without page values and 146 without descriptions. These counts are triage indicators, not assertions that every omitted field is erroneous.

Castle Ravenloft alone has 161 room records, 129 without descriptions, and its scene is marked partial. Its manifest says mapped, so content readiness should be made explicit rather than inferred from that single status. No content was compared against the source book in this review.

The oversized Vallaki town file was not readable through the selected connector response and is excluded from these counts. Full details and limits are in [COVERAGE.md](COVERAGE.md).

## Before implementation

After Matt explicitly approves an item's implementation scope, revalidate it against the target branch's current head and any relevant pending work. Preserve campaign saves, establish failing tests where possible, implement only accepted scope, run the appropriate existing and new tests, and verify actual iPad/player-display behavior. Never equate a source review or a green preexisting suite with a reproduced and fixed issue.

