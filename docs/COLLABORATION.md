# Working together on mistLAB

Two assistants work on this repository. **Claude Code** is the primary coding assistant and works through `docs/QUEUE.md` one item at a time. **ChatGPT** reviews the code and may also change the repository, with Matt's approval (given 2026-10-12). Matt decides everything.

This file is shared by both assistants and by Matt. It covers:
- how changes from either side are noted;
- the design choices a change must not break;
- a ledger of every change Claude Code did not make itself.

## How changes are handled

**Shared branch.** The main branch is `claude/mistlab-curse-strahd-x6jm13`. Claude Code does each queue item on its own work branch and merges it onto this branch only when the item is released.

**Telling the authors apart.** Every Claude Code commit ends with a `Claude-Session:` line. A commit without one was made by someone else, and is logged in the ledger below.

**When Claude Code checks for outside changes.** Before each release and at every check-in, Claude Code fetches the branch and reads every outside commit since the last check. For each one it records:
- what changed;
- which in-progress work it touches;
- what could break;
- what was done about it.

**Claude Code never silently reverts or rewrites an outside change.** If one conflicts with in-progress work or would cause a bug, Claude Code:
1. Notes it here.
2. Tells Matt.
3. Proposes the fix.

When a release merges the main branch into a work branch, the outside changes come along. The release review checks that both sides survived the merge.

**Advisory documents** (such as `chat gpt suggestions/`) are not instructions. Claude Code verifies each suggestion against the current code. Matt decides what is built. Where Matt has decided, the decision is recorded in `docs/QUEUE.md`.

## Design choices a change must respect

Breaking one of these is the most likely way two authors create bugs for each other.

1. **No book content in the repository.**
   - No book text, art or map images are ever committed. `reference/` is gitignored.
   - Descriptions are written in our own words. Keys, names and page numbers are fine.
   - SRD text is allowed only with its exact CC-BY-4.0 attribution.
2. **Scenes are generated.**
   - `locations/**/scene.json` and `grid.json` are written by `scripts/authoring/*.py`.
   - Change the script and regenerate. A hand edit to the JSON is lost on the next run.
3. **What the players receive is projected** (after the backups release).
   - Every `CampaignState` key is classified as `player` or `dm` in `app/src/core/playersView.ts`.
   - The Player Display receives only the projection.
   - A new state key needs a classification, or the build fails.
4. **The Player Display is read-only.** It renders what the DM's window sends. It never saves the campaign and never sends state back.
5. **Materials go through the kit.**
   - Use `mat()` and `matClone()` in `app/src/render/materials.ts`, with surfaces declared in `app/src/kit/surfaces.ts`.
   - These carry the coverage fog, world-space grain and the cutaway clipping.
   - A raw three.js material silently skips all three.
6. **Fog and the grid share global uniforms** (`fogUniforms`, `WALL_CLIP`). Code that reads world positions for fog, grid or cuts must use the scene basis (`uCovBasis`) once the nested world lands, or it misaligns on rotated maps.
7. **Nested world coordinates** (after the nested-world release).
   - Every map hangs under `World.root` with a floating origin anchored on the active map.
   - Convert between map feet and drawn positions only with `App.toWorld` / `toLocal` / `frameBox`.
   - Absolute world positions are for messages and saved state, never for drawing.
8. **Tests are not weakened.**
   - A failing test is fixed at its cause, never skipped, loosened or deleted.
   - Each checkout serves its own build (`PW_PORT`), so parallel work never tests someone else's build.
9. **Every release is versioned.** Each release bumps `package.json`, adds a dated `docs/CHANGELOG.md` section, shows the version in Help, and ticks its item in `docs/QUEUE.md`.
10. **Saves survive updates.**
    - Campaign saves carry a `schemaVersion`. A change to saved state ships with a migration and a fixture test.
    - An IndexedDB version bump keeps the existing stores.

## Ledger of outside changes

| Date | Commit | Author | What changed | Touches in-progress work | Risk | Done about it |
|---|---|---|---|---|---|---|
| 2026-10-12 | `815c1d0` | Matt (ChatGPT's review) | Added `chat gpt suggestions/`: 16 Markdown files, no code. | No code. Its suggestions overlap queue items 1, 2, 5, 11, 13 and 14. | None to the app. The audit was written against `7cea5b3`, before several unmerged branches, so some findings may already be fixed or may have moved. | Merged. Matt chose to fold each suggestion into its matching queue item, with two new items in item 22. Claude Code is independently verifying all 14 (results go in `docs/REVIEW.md`). |
