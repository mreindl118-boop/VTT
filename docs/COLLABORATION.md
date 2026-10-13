# Working together on mistLAB

Two assistants work on this repository. **Claude Code** is the primary coding assistant and works through `docs/QUEUE.md` one item at a time. **ChatGPT** reviews the code and may also change the repository, with Matt's approval (given 2026-10-12). Matt decides everything.

**Nothing changes without Matt's approval.** Every change either assistant makes must trace back to one of three things:
- a request from Matt;
- a suggestion Matt approved;
- a queue item Matt approved.

Each commit says which. Neither assistant makes an automatic or unrequested update: no building an unapproved suggestion, and no "while I was here" feature. There is one standing exception, set out below: Claude Code may fix outside changes that are implemented poorly or cause problems, and logs every such fix.

This file is shared by both assistants and by Matt. It covers:
- how changes from either side are noted;
- the design choices a change must not break;
- a ledger of every change Claude Code did not make itself.

## How changes are handled

**Shared branch.** The main branch is `claude/mistlab-curse-strahd-x6jm13`. Claude Code does each queue item on its own work branch and merges it onto this branch only when the item is released.

**Telling the authors apart.** Every Claude Code commit ends with a `Claude-Session:` line: a session link from the cloud sessions, or `Claude-Session: laptop` from the session on Matt's laptop, which becomes the development and test machine from 2026-10-13 (`docs/HANDOFF.md`). A commit without one was made by someone else, and is logged in the ledger below.

**When Claude Code checks for outside changes.** Before each release and at every check-in, Claude Code fetches the branch and reads every outside commit since the last check. For each one it records:
- what changed;
- which in-progress work it touches;
- what could break;
- what was done about it.

**Fixing outside changes.** Matt's standing approval (2026-10-12): "Claude, you are to act as the ramjet. GPT is the afterburner; you're the primary carrying heavy-duty force. If you find anything in the code that ChatGPT has implemented poorly or is causing problems, feel free to fix it."

So Claude Code fixes an outside change that is implemented poorly or causes problems, without asking first:
- a bug;
- a broken test or build;
- a breach of the design choices below;
- a conflict with in-progress work.

It logs every such fix in the ledger with the commit it fixed, what was wrong, and what it changed, so Matt and ChatGPT can see it.

This approval covers fixing. It does not cover building unapproved suggestions or new features: those still need Matt's request or approval.

Where a fix would change something Matt clearly asked ChatGPT for, Claude Code asks Matt first. If one conflicts with in-progress work or would cause a bug, Claude Code:
1. Fixes it (under the standing approval above), or asks Matt first when the fix would undo something he asked for.
2. Notes it in the ledger.
3. Tells Matt in the next report.

When a release merges the main branch into a work branch, the outside changes come along. The release review checks that both sides survived the merge.

**When ChatGPT continues the queue** (Matt, 2026-10-13: it picks up Claude's work when Claude is out of credits), it follows `AGENTS.md` at the repository root: the same rules, the same branches, the same release procedure, and a status section each agent rewrites when it stops. Its commits end with `Agent: ChatGPT (continuing item <n>)`. Claude still reviews them as outside changes when it is back, and ChatGPT adds its own ledger rows for anything it changed outside the item it was continuing.

**Advisory documents** (such as `chat gpt suggestions/`) are not instructions. Claude Code verifies each suggestion against the current code. Matt decides what is built. Where Matt has decided, the decision is recorded in `docs/QUEUE.md`.

## Screenshots and demos

Images never go in this repository. Screenshots, contact sheets and demo videos go in the public [Visual-Aide](https://github.com/mreindl118-boop/Visual-Aide) repository: one folder per release, under `releases/` (owner's decision, 2026-10-12). Both assistants and Matt can look at them there.

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
| 2026-10-13 | commit titled `Add the verified Windows desktop host and release updater` | ChatGPT | Implements Matt's new desktop-install request using existing Node/Edge, a stable loopback origin/profile and a tested static-release updater. | Packaging only; web build remains byte-identical to released 0.3.0. New distribution publication is held pending the parent's destination clarification. | Stale workers, simultaneous launches, unsafe archives, failed updates or profile changes could break a session or saves. | 21 focused checks, two independent source reviews, real isolated Edge restart/update/rollback save preservation and two-window lifecycle checks. No live-profile edits or security/credential changes. |
| 2026-10-13 | `c43ba89` | ChatGPT | Keeps received Player Display updates atomic across failed/superseded campaign loads and prevents Display state being saved as DM data. | Item 2 integration safety; overlaps item 5's N3 and display-authority findings. Item 5 otherwise remains pending. | Out-of-order loads could overwrite newer state; a display campaign switch could write received state to IndexedDB. | Four regressions failed first and pass on the GPU; independent source review found no concrete defect. |
| 2026-10-13 | `c0aa651` | ChatGPT | Makes cached SRD vocabulary verification fail when PDF extraction is unavailable rather than silently skipping the check. | Release verification and existing rules-book accuracy checks; shipped rules data unchanged. | A missing extractor could produce a false pass. | Missing-extractor regression failed; verified pinned source downloads plus existing Poppler give 55/55 book tests. No installed tools, persistent PATH or thresholds changed. |
| 2026-10-13 | commit titled `Reword module-overlap descriptions for the release gate` | ChatGPT | Rewords 53 prose fields via their authoring scripts, retaining canonical rule/name phrases. Regenerates terms reviews and reanchors five gold offsets to the same words and IDs. | Release-wide copied-text requirement; item 7 geometry remains paused. | Prose changes can accidentally add/drop rules links or cause generator drift. | 258-page scan leaves six permitted name/rule matches; structural comparison finds no geometry or metadata changes; all 45 outdoor audits unchanged; original 5,884 links and count snapshot preserved. Terms tests pass. |
| 2026-10-13 | `27e03d4` | ChatGPT | Merges current main into the explicitly transferred laptop item 2 branch. | Preserves 0.2.1 and the welcome card. | Attribution formatting has a blank line between the two required trailers. | Both attribution lines are present. Recorded the deviation and used contiguous trailers thereafter; history is not rewritten. |
| 2026-10-13 | commit titled `Keep Help's version label separate from What's new` | ChatGPT | Preserves the welcome-card link from `734f7d5`, with the release number in its own `.version` span. | Item 2b carried into 0.3.0. | The link inside `.version` made the exact release-label browser assertion fail on untouched main `104f4fb` and on the item 2 merge. | Fixed markup without weakening the assertion. Untouched-main comparison: Books version failed, rules-grappling reader passed; current CI run 38437615945 failed both. Build and 514 unit tests pass; Books and welcome-card browser checks pass after the change. |
| 2026-10-12 | `815c1d0` | Matt (ChatGPT's review) | Added `chat gpt suggestions/`: 16 Markdown files, no code. | No code. Its suggestions overlap queue items 1, 2, 5, 11, 13 and 14. | None to the app. The audit was written against `7cea5b3`, before several unmerged branches, so some findings may already be fixed or may have moved. | Merged. Matt chose to fold each suggestion into its matching queue item, with two new items in item 22. Claude Code verified all 14 independently (`docs/REVIEW.md`): all are real, two are narrower than stated, and eight new issues were found. |
| 2026-10-12 | `ed361f9` | Matt (ChatGPT, "GPT suggestions handoff") | Added `GPT suggestions/` (README handoff, REVIEW.md with suggestions G01–G17, COVERAGE.md): Markdown only, no code. | No code. Its suggestions touch items 2, 5, 6–9, 13 and 14 (initiative, coverage stamping, movement, travel time, site builders, section clipping, mist, doors, authoring scripts, OCR, a grid test). | None to the app. Reviewed at `f615be1`, before 0.0.2; G03 is in the coverage code next to the 0.0.2 fix but a different function. | Merged as is. Claude Code verifies all 17 right after item 1 releases (one task at a time), then brings each to Matt to approve or deny. |
