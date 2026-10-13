# Instructions for the coding agent that continues this work

Matt owns mistLAB. Two assistants build it: **Claude Code** is the primary, and **ChatGPT** (Codex) continues the
work whenever Claude is out of credits or inactive. If you are ChatGPT reading this: Matt has asked you to pick up
exactly where Claude stopped, following the same rules, and to hand back cleanly. Matt approves everything.

Read these before you touch anything, in this order:
1. This file, to the end.
2. `docs/QUEUE.md`: the checklist, in order, with the lean review setting and the release procedure.
3. `docs/COLLABORATION.md`: the design choices every change must respect, and the ledger.
4. `docs/HANDOFF.md`: the laptop setup, where every unreleased item lives, and item 2's second release.
5. The **Status** section at the end of this file: what was in flight when the last agent stopped.
6. The open findings on the items in flight: `docs/handoff/item7-open.md` (item 7, in plain words) and
   `docs/handoff/item6-map-groups.json` (item 6, one entry per map group).

## The rules that never bend

- **Matt approves every change.** Work only on queue items in `docs/QUEUE.md` and on what Matt asks for. No
  features of your own, no "while I was here", no unapproved suggestions. If something needs a decision, write it
  under **Questions for Matt** at the end of this file and move to the next thing you can do.
- **No book content.** Never commit book text, art or map images. `reference/` is gitignored and stays that way.
  Descriptions are our own words; keys, names and page numbers are fine. SRD text only with its CC-BY-4.0
  attribution. Before a release, check the maps' text against `reference/ocr` for any run of eight or more words
  copied from the module, and reword it.
- **Scenes are generated.** `locations/**/scene.json` and `grid.json` come from `scripts/authoring/*.py`. Change the
  script and regenerate (`py -3 scripts/authoring/<script>.py`). Never hand-edit the JSON.
- **Materials go through the kit** (`mat()` / `matClone()` in `app/src/render/materials.ts`; surfaces in
  `app/src/kit/surfaces.ts`). A raw three.js material skips fog, grain and the cutaway.
- **Tests are never weakened.** A failing test is fixed at its cause, never skipped, loosened or deleted. Never
  commit screenshots, `test-results`, `node_modules`, scratch scripts or secrets.
- **History is never rewritten.** No rebase, amend or force-push on a shared branch. Merge the main branch into
  your branch with a merge commit when you need its changes. Never delete a `claude/wip/*` branch.
- **Every release is versioned** (next version in release order, `package.json` and `package-lock.json`), has a
  dated `docs/CHANGELOG.md` entry at the top in plain words (the app shows that entry as its "What's new" card),
  shows the version in Help, ticks its item in `docs/QUEUE.md`, and updates its row in `docs/HANDOFF.md`.
- **Model names stay out of the repo.** No model identifiers in commits, files or comments.

## How to tell who did what

Every commit ends with two trailer lines. Claude's commits end with a `Claude-Session:` line. Yours end with:

```
Co-Authored-By: ChatGPT <noreply@openai.com>
Agent: ChatGPT (continuing item <n>)
```

Claude's ledger in `docs/COLLABORATION.md` counts a commit without a `Claude-Session:` line as an outside change and
reviews it when Claude is back. Make that review easy: one concern per commit, a message that says what and why, and
a row added by you to the ledger for anything you changed outside the queue item you were continuing.

## The branches

- **Main branch:** `claude/mistlab-curse-strahd-x6jm13`. Releases land here, one at a time, each merging what came
  before. Pull it before every merge.
- **Unreleased work:** `claude/wip/<item>-<name>` on GitHub, one per item or map group; the table in
  `docs/HANDOFF.md` section 3 says what each holds and what is left. Continue an item on a branch made from its wip
  branch (`git checkout -b item<n>-<name> origin/claude/wip/item<n>-<name>`), and push your progress back to the
  same `claude/wip/...` name so nothing lives only on one machine.
- **Worktrees:** each item in its own worktree (`git worktree add .worktrees\<name> <branch>`), with `node_modules`
  shared by a junction: `New-Item -ItemType Junction -Path .worktrees\<name>\node_modules -Target node_modules`.

## Running things (Matt's Windows laptop, PowerShell)

```powershell
npm install                       # once
npx playwright install chromium   # once
npm run build                     # tsc + vite; must pass before every commit
npx vitest run                    # unit tests; must pass before every commit
$env:PW_GPU="1"; npm run test:e2e # browser tests on the GPU (about 5 minutes); must pass before every release
py -3 scripts/authoring/audit-outdoor.py   # no new findings on the maps you changed
```

- Serve a build to look at it: `npx vite preview --port 4700 --strictPort`, then open
  `http://localhost:4700/?nosw&scene=<chapter>/<key>` and wait for `window.__mistlab.ready`.
- Parallel checkouts each serve their own build: `$env:PW_PORT="<port>"` before `npm run test:e2e`.
- `reference/module/curse-of-strahd.pdf` plus `npm run ocr` (from Git Bash) give the OCR text the copied-text check
  reads. Nothing in `reference/` is ever committed.
- PowerShell has no `&&`: use `;` and `if ($?) { ... }`.

## The procedure for one item (the lean setting Matt chose)

1. Read the item in `docs/QUEUE.md`, its wip branch, and its row in `docs/HANDOFF.md`.
2. Finish the work. Look at the result in the running app (desktop 1366x768 and phone 390x844, as DM and as
   Players). Every fix gets a test that failed first.
3. Review it yourself adversarially: what the owner asked for, what could have broken elsewhere (Death House,
   Vallaki and the Sheep Chase square are the regression maps), draw calls and frame time against the main branch.
   At most one fix pass after the review.
4. Release: merge the main branch in (merge commit), bump the version, write the changelog entry, tick the item,
   run the full suite, push the main branch.
5. **Publishing the app and the screenshots is Claude's:** Claude publishes the build to the mistLAB link and adds
   the release's screenshots to the Visual-Aide repository. After your release, write under **Status** below:
   "0.x.y is on the main branch, ready to publish", with the test counts, and Claude does the rest when back.
6. Update the **Status** section before you stop, every time, even mid-item.

## Order of work

Items run in the order of `docs/QUEUE.md`. Two items may run side by side when they do not touch the same code.
Do not start an item that the Status section says another agent has in flight unless its last update is more than
a day old; then continue it from its wip branch, and say so in Status.

## Status

Each agent rewrites this section when it stops. Newest first. Keep it short and exact: versions, branches, commits,
what is done, what is next, what is blocked.

### ChatGPT, 2026-10-13, item 2 released; delivery and desktop installation follow

- **0.3.0 is on the main branch, ready to publish.** The release uses tested implementation `b8fe85e` (including the `64d7695` streaming-handle/phone-fixture correction), with version and release records. Main `bd53fbf` was merged at `95d413d`; cloud item 2 remains `4f3cad9`. No item 7 branch was touched.
- Build passes; units **519 passed, 2 existing todo, zero skipped**; final full GPU suite **257 passed, 55 existing device skips, zero failed in 13.3 minutes**. GitHub CI `38472350232` on `b8fe85e` completed successfully. Existing assertions and thresholds remain intact.
- Current-build wheel and phone touch journeys pass for the Inn, Death House and Sheep Chase tavern. Five additional warmed round trips show no retained resource growth. The cost comparison is in `docs/handoff/item2-report.md`: nested Vallaki remains slower than main; phone/performance tuning, topography, expanded Display and the data pass are still deferred. Physical iPad/Android performance is unverified.
- Frozen tested output: `index-0JlwMZEy.js`, 204 files, 17,132,061 bytes; fingerprint SHA-256 `d7d6d3f9bfdcf23ee9b8e77231766552f396a811099ee147e71cb57e7ad36c6d`. The exact bundle, portable-launcher smoke check and Library transfer follow this Git release. Screenshots and source book images remain outside Git and are not uploaded.
- Matt approved alternate private hosting while Claude is out; the parent task owns that deployment. Matt then requested a local desktop app with automatic updates. ChatGPT is inspecting/installing that separately from the frozen web build, with a stable local origin/profile and updates restricted to tested releases. Installation and a proven version transition are not yet complete. No power, access, credential or OS-security changes.
- Item 7 remains paused for ChatGPT and reserved to the cloud for 0.4.0. No further queue item has started. See the report for exact evidence limits and the two recorded instruction deviations.

### Claude, 2026-10-13 21:05 UTC (cloud; STOPPED on Matt's order until Saturday 2026-10-17 06:00 UTC)

- Matt: "cease all functions until the limit resets Saturday at 2am" (06:00 UTC). The cloud's check-in routine is
  disabled until then; nothing runs in the cloud.
- **ChatGPT, while the cloud is out:** item 2 → 0.3.0 on `claude/wip/item2-nested-world-laptop`. Read
  `docs/handoff/item2-verify-and-report.md`: section 1a (six findings to fix), 1c (the cloud's review of your six
  commits: sound), 1d (build and 515 unit tests pass on `1459d18`; run the browser suite on the GPU yourself), and
  1e (agreements and contentions). Then the report (section 6) and the release (section 7). Write Status here when
  you stop, every time.
- **Item 7 (the cloud's):** finished and tested on `item7-unfinished-maps` at `0db19b9` (the final fix, the laptop's
  three portability edits, main merged in; 487 unit tests pass; the two blockers are fixed). It releases as 0.4.0
  after 0.3.0, when the cloud is back. Nobody else touches it.
- **On the cloud's return (Saturday):** publish 0.3.0 if it is on the main branch (the mistLAB link and Visual-Aide),
  then release and publish 0.4.0.

### Claude, 2026-10-13 21:00 UTC (cloud; credits restored)

Matt, 2026-10-13: "review the changes GPT has made to the core code; work with it without overstepping each other to
polish and produce 0.3.0 ASAP." The split from here:
- **ChatGPT owns item 2 and the 0.3.0 release**, on `claude/wip/item2-nested-world-laptop` (head `1459d18`). The
  cloud reviewed its six commits: sound, no weakened tests (`docs/handoff/item2-verify-and-report.md` section 1c).
  **Next for ChatGPT:** merge the main branch in, then fix the six findings in that file's section 1a (the cloud's two
  world-map reviewers; ChatGPT never had them), run the full suite on the GPU, write the report (section 6), and
  release 0.3.0 (section 7). Write "0.3.0 is on the main branch, ready to publish" here when it is.
- **The cloud owns item 7 → 0.4.0** (branch `item7-unfinished-maps`, head `0db19b9`: the finished fix, the laptop's
  three portability edits, main merged in). It releases right after 0.3.0 lands, so the versions stay in order.
  The cloud also runs the full suite on ChatGPT's branch (results into section 1d) but never commits to it, and
  publishes both releases to the mistLAB link and Visual-Aide.
- The laptop's Claude session is paused. Matt answered the question below: the cloud routine stays on.

### Claude, 2026-10-13, the laptop session stopping (Matt: "prepare for usage end, pause all runs")

Two Claude sessions were active today: one on Matt's laptop (commits end `Claude-Session: laptop`) and the older
one in the cloud (commits end with a `Claude-Session:` link). The laptop session is now paused. **The cloud session
may still be running** its check-in routine; Matt decides whether it carries on (see Questions for Matt).

- **Released and published:** 0.0.2, 0.1.0 (rules tooltips), 0.2.0 (chapter 2 sites), 0.2.1 (laptop build; browser
  tests on the GPU, Windows checkouts).
- **On the main branch, unreleased:** the "What's new" card (item 2b, `734f7d5`), the handoff files, and the run
  scripts in `docs/handoff/runs/` (the exact tasks, acceptance criteria and review lenses the laptop runs used:
  `item2-finish.js`, `item7-finish.js`, `integrate.js`). It all ships inside the next release.
- **Item 2, nested world → 0.3.0.** Matt's decisions: the laptop finishes item 2; and "finish the build step, then
  prepare verify and report as a handoff to GPT and instruct them to continue."
  - Built: steps 2–4 and the D&D world map (`4f3cad9`), on `claude/wip/item2-nested-world`. The cloud session was
    finishing the world-map step's review and one fix pass and will push the result there if it is still running.
  - The laptop merged the main branch (0.2.0) into the branch at `293f150` and was testing the merge when paused;
    that state is on `claude/wip/item2-nested-world-laptop`. It is a pure merge, so if the cloud's fix lands on
    `claude/wip/item2-nested-world`, continue from that branch and merge main again at release (the release
    procedure does this anyway). If nothing new lands there, continue from `-laptop`.
  - **ChatGPT continues** from the world-map step: the verification against `docs/handoff/item2-feature-inventory.md`,
    one fix pass, the final three-lens check, one fix pass, the report and the 0.3.0 release, laid out in
    `docs/handoff/item2-verify-and-report.md` and in the run brief `docs/handoff/runs/item2-finish.js`.
  - Acceptance in Matt's words: the World map button opens a D&D-styled map you zoom into; a continuous zoom from
    the whole valley into Vallaki, into the Blue Water Inn, to a room, and back out, with the wheel and by touch,
    with the breadcrumb and Back at every level. `docs/WORLD.md` on the branch is the design reference.
  - A second release follows (`docs/HANDOFF.md` section 4): the topography, step 5 (Player Display), step 7
    (phones and performance), step 8 (data pass).
- **Item 7, unfinished maps.** Matt's decision: the cloud finishes item 7; it was working from `ee47297` on the
  final-check findings (`docs/handoff/item7-open.md`, and the run brief `docs/handoff/runs/item7-finish.js`).
  The laptop's later WIP `fb49f1f` (main merged in, part of the same fix) is on `claude/wip/item7-unfinished-maps`;
  whoever finishes merges both. Open blockers: the party cannot climb Yester Hill (the slope is walled off); the
  Amber Temple's +30 and 0 ft levels are buried under the new snow ground. Matt's words: "Yester Hill is flat. Fix
  that. The fog wall looks terrible, like cotton." Releases after 0.3.0, at the next version in order.
- **Next in order:** item 3 (dollhouse view; needs the nested world released first), then 4, 5, 6, 8, 10, 11 and
  on, as `docs/QUEUE.md` lists.
- An outside branch `codex/fix-explored-fog-growth` exists on GitHub (ChatGPT's own fog fix, 2026-10-11). The same
  bug was fixed on the main branch as 0.0.2; the branch is not merged and needs no action.

## Questions for Matt

- Answered (Matt, 2026-10-13: "let it run"): the cloud routine stays on; the cloud finishes item 7 and verifies item 2.
- The cloud Claude session's check-in routine ("mistLAB queue check-in") fires every two hours and resumes its runs.
  If everything is meant to be paused, disable that routine (Claude app → Routines) or tell the cloud session to
  stop; otherwise it keeps working item 7 and item 2's world-map step alongside ChatGPT.
