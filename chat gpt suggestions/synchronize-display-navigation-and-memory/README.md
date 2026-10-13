# Synchronize display navigation and explored memory

The Player Display can retain the wrong floor and stale explored-memory buffers. Publish navigation consistently and apply authoritative state and its derived coverage together.

## Review metadata

- Repository: `mreindl118-boop/VTT`
- Reviewed commit: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P2**
- Status: **Code-confirmed; runtime-unverified**
- Review date: 2026-10-12 UTC
- Method: Read-only navigation, synchronization, coverage, and test inspection. Two-window reproductions and snapshot tests below were not executed.
- Roadmap context: The roadmap contains broader Player Display and transport improvements. No exact resolution of these two current synchronization mechanisms was established in the reviewed sections. This finding addresses the existing same-origin display protocol, not planned remote-player capabilities.

## Finding one Floor changes are not published

The floor dropdown calls `setLevel()` directly. That method updates the DM's geometry, coverage, and camera but never broadcasts the active level. Camera messages contain no level. The display remains on its prior floor until another action broadcasts state.

- [main.ts lines 270–282](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L270-L282): floor select handler at line 272 and an additional direct level-button path at line 281.
- [app.ts lines 258–277](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L258-L277): `setLevel()` updates local state without broadcasting.
- [app.ts lines 1248–1284](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L1248-L1284): level is present in state messages, while camera messages carry position and target only.

## Finding two Incoming explored memory is not installed

`onMsg()` assigns incoming campaign state and recomputes using existing `CoverageMap` instances. Saved `seen` data is loaded only while `open()` builds those instances, before `onMsg()` assigns the incoming state. `recompute()` subsequently serializes the existing local buffer back into `state.seen`.

- [app.ts lines 182–190](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L182-L190): coverage hydration during open.
- [app.ts lines 1269–1274](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L1269-L1274): incoming state assignment after awaited open, followed by recomputation.
- [app.ts lines 555–571](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L555-L571): existing coverage is reused and serialized over the received memory field.

These are two separate failure mechanisms within one display-state reconciliation boundary. Fixing a missing broadcast alone does not repair coverage hydration.

## User impact

The display's floor can disagree with the DM while its camera follows the DM's new elevation. Separately, authoritative explored cells absent from the local display buffer can be lost locally, and stale local exploration can survive an authoritative replacement.

The exact visual symptom and timing depend on the scene and current coverage. No browser reproduction or screenshot has been produced.

## Reproduction to run

1. Open a DM window and Player Display on Death House.
2. Change floors using only the dropdown, with no reveal or layout action, and compare `levelId`.
3. Repeat with camera lock enabled and disabled.
4. With the same scene loaded on both, deliver an authoritative state containing explored cells outside current token vision and absent from the display's local buffer.
5. Verify that those cells remain explored after `onMsg()` completes.
6. Repeat with an authoritative snapshot that removes previously explored cells.

For the memory test, use controlled coverage data and no room-reveal log that would independently restamp the target cells. This distinguishes authoritative-memory hydration from ordinary room-reveal behavior.

## Recommended change

Publish navigation changes consistently. Apply state, level, layout, coverage, and camera as a coherent display snapshot. Hydrate or replace per-level coverage from authoritative memory before deriving current visibility. Keep display-side derivation from silently rewriting received authoritative memory. Coordinate asynchronous loads with the latest-request-wins scene transition described in the navigation finding.

## Acceptance tests

- Dropdown, room search, Find Party, stairs, and scene navigation synchronize the intended floor.
- Cover camera lock enabled and disabled.
- A late or reloaded display reproduces authoritative explored memory outside current vision.
- Replacing memory removes stale cells as well as adding new ones.
- Rapid successive snapshots converge on the newest state.
- Coverage state and texture agree after navigation and snapshot replacement.
- Unchanged authoritative state remains stable under repeated delivery.

## Existing coverage and limits

[e2e/slider.spec.ts lines 50–90](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/slider.spec.ts#L50-L90) verifies display isolation from the DM slider and synchronization of reveals. It does not cover direct floor changes or authoritative explored-memory replacement. This review did not exercise remote transport, unsupported browsers, or multiple simultaneous DM hosts.
