# Make location navigation atomic

Overlapping scene loads can mount multiple maps or replace a newer selection with an older one. A failed load removes the current map before a replacement exists. Prepare the new scene before committing a single latest-request-wins transition.

## Review metadata

- Repository: `mreindl118-boop/VTT`
- Reviewed commit: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P2**
- Status: **Code-confirmed; runtime-unverified**
- Review date: 2026-10-12 UTC
- Method: Read-only control-flow and caller inspection. Delayed-import, race, and rejection tests were not executed.
- Roadmap context: [QUEUE.md](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/QUEUE.md) identifies nested-world and navigation work on other commits. This finding concerns the current `App.open()` lifecycle. The proposed branches were not inspected, so it is not a claim about their behavior.

## Finding and evidence

`open()` tears down the current scene before awaiting the new location. On completion it unconditionally adds roots and replaces `cur`. There is no request generation, cancellation, serialization, or rollback.

With two overlapping opens, both can tear down the same original map. The first completion mounts its scene. The second completion mounts another scene without removing the first, because its teardown already occurred before the await. The later-resolving request wins even if it was the older user selection.

- [app.ts lines 164–227](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L164-L227): teardown at 166–175; await at 177; root insertion at 186; unconditional `cur` replacement at 227.
- [main.ts lines 272–311](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L272-L311): library, Back, and world-map navigation fire asynchronous opens without rejection handling.
- [main.ts lines 405–414](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L405-L414): room-entry navigation does the same.
- [app.ts lines 1267–1274](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L1267-L1274): incoming display messages can also initiate overlapping opens.
- [data.ts lines 11–16](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/data.ts#L11-L16): scene and grid are asynchronous imports and can reject.

## User impact

Fast navigation or slow scene imports can show the wrong destination, leave unrelated geometry or labels mounted, or mismatch campaign state and scene context. A rejected import leaves `cur` pointing at the old scene after its roots and textures have already been removed or disposed.

The race follows from the inspected control flow. Its frequency, actual render result, and device-specific timings have not been measured.

## Reproduction to run

1. Start on location A.
2. Delay B's scene import.
3. Request B, then C, allowing C to finish first.
4. Resolve B.
5. Assert that the selected scene remains C and only C's roots, labels, and tokens are mounted.
6. Repeat with a rejected import, two requests for the same destination, and cross-campaign navigation.
7. During a delayed Player Display load, send additional authoritative state messages for the same destination and verify there is only one final scene.

## Recommended change

Prepare a candidate scene without replacing the live one, then commit only the latest navigation request. Treat campaign identity, loaded state, roots, coverage, and active level as one transition. Dispose abandoned candidates. Retain the previous usable scene and show a recoverable error if loading fails. Suppress stale completions and coalesce redundant display loads.

Do not rely only on disabling one navigation button: opens originate from several controls and synchronization messages.

## Acceptance tests

- Latest request wins under every completion order.
- No stale roots, labels, tokens, or context meshes remain after overlapping loads.
- Failed loads preserve the previous functional scene.
- Cross-campaign state stays associated with its correct storage key and theme.
- Repeated display messages do not start conflicting scene swaps.
- Obsolete candidates release resources after cancellation or rejection.
- Navigation errors surface once without unhandled promise rejections.

## Existing coverage and limits

[e2e/ui.spec.ts](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/ui.spec.ts) checks sequential location label cleanup and sequential campaign switching. It does not establish safety under reversed load completion or rejection. No runtime loading, performance, or memory measurements were performed in this review.
