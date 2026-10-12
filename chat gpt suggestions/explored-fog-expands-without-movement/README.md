# Explored fog expands without movement

Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4

Priority: P1

Original audit evidence status: Code-confirmed logic defect; runtime verification was pending at the original review. The implementation and verification update below supersedes that status.

Existing work: The roadmap discusses fog and exploration reliability, but this exact repeated-dilation mechanism was independently identified here. No claim is made that it is absent from every historical note or WIP commit.

## Matt-approved fix and coordination with Claude — 2026-10-12

Matt explicitly approved this focused fix and asked ChatGPT to let Claude know what is changing and why.

- **Work:** [draft PR #1](https://github.com/mreindl118-boop/VTT/pull/1), branch `codex/fix-explored-fog-growth`, based on `58997da`.
- **Scope:** `CoverageMap.updateVision` now dilates only freshly computed visibility once, then unions that bounded result into `seen`. Historical exploration is never used as dilation input. The one-texel wall rim and reveal/forced-fog behavior stay intact.
- **Why:** unchanged recomputations were repeatedly expanding already-expanded history into closed rooms; removing the feedback loop makes those updates idempotent.
- **Tests:** regressions cover all seven supported cell sizes, 50 identical passes, closed rooms, an exact one-texel rim, no viewers, total darkness, legitimate exploration, door close/reopen, reload, and DM paint. A browser regression checks view toggles, saved history, texture bytes, rendered pixels, and reload without party movement.
- **Verification at publication:** the unmodified production code failed 28 of the 38 focused cases; the patched code passed all 38. Full unit suite: 190 passed and 2 existing TODOs. Typecheck and production build passed. Local browser startup was blocked by cloud-shell socket restrictions before tests executed; GitHub CI is being checked on the PR. See the PR's verification section and Checks for the current exact-commit result.
- **Integration:** this finding is already folded into backups queue item 5. This isolated draft does not reorder the queue, merge a release, or change the separate restore/display-synchronization work. Other review findings remain advisory unless Matt separately approves them.
- **Save limit:** existing explored history is preserved. This prevents new false exploration; it does not infer or erase cells already incorrectly recorded in old saves.

## Intended behavior

Explored memory should record areas the party has actually seen, plus a bounded wall rim. It should not expand when the viewer and world remain unchanged.

## Finding and evidence

[CoverageMap.updateVision](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/core/coverage.ts#L88-L128) resets current visible cells but retains historical seen cells. It marks directly visible cells in seen at lines 100–101, then calls dilateInto on visible and seen at lines 106–107. The dilation at lines 120–128 expands every set texel into its eight neighbors.

The already-expanded history becomes the next update's input. Consequently, each unchanged vision recomputation grows explored territory another texel. [App.recompute](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L555-L578) calls this logic and serializes the enlarged history at line 571. The current [coverage tests](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/tests/coverage.test.ts#L10-L20) do not check repeated unchanged-view idempotence.

## Impact

Fog can gradually disclose never-visited rooms or terrain across closed walls. The false exploration becomes saved campaign state. Coarse coverage cells on large maps increase each expansion's physical extent. The exact visible appearance has not been captured in a browser.

## Reproduction to run

1. Extend the existing two-room coverage fixture.
2. Keep the middle door closed and the viewer fixed at [10, 10].
3. Call updateVision repeatedly with identical inputs.
4. The right room's center must remain Unexplored, and serialized seen must stop changing after the first identical update.
5. Confirm the same invariant in a browser while triggering nonmovement recomputations.

## Recommended remediation

Dilate only newly computed current visibility, or a temporary wall-rim mask, then merge that bounded result into historical seen. Do not repeatedly dilate accumulated history. Preserve explicit reveal and forced-fog semantics.

## Acceptance tests

- Fifty identical updates leave serialized seen unchanged.
- The closed neighboring room stays unexplored.
- Moving through an opened doorway adds legitimate exploration.
- Closing, reopening and reloading retain exactly that history.
- Repeat at every supported coverage cell size.
- Preserve the intended one-texel wall margin.

## Review boundary

This is distinct from the display-synchronization finding, which concerns replacing coverage buffers with authoritative state. Fixing one does not fix the other.

