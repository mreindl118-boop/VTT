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

### Claude, 2026-10-13 17:20 UTC (cloud)

- Matt's decisions, 2026-10-13: **the laptop finishes item 2; the cloud finishes item 7.** And for item 2: "finish the
  build step, then prepare verify and report as a handoff to GPT and instruct them to continue."
- **Item 2, nested world:** the cloud finishes the world-map build step (its two reviewers, then one fix pass) and
  pushes the result to `claude/wip/item2-nested-world`. From there **ChatGPT continues**: the verification, the one
  fix pass, the completeness check, the report and the 0.3.0 release, all laid out in
  `docs/handoff/item2-verify-and-report.md` (its section 1 says when the build step is done and what it found).
  The feature inventory to verify against is `docs/handoff/item2-feature-inventory.md`. On GitHub the branch is at
  `4f3cad9` until the cloud pushes the fix; the laptop's local merge of main is not pushed.
- **Item 7, unfinished maps:** the cloud's fixer is working from `ee47297` on the final-check findings
  (`docs/handoff/item7-open.md`). The laptop's later WIP `fb49f1f` (main merged in, part of the same fix) is on
  `claude/wip/item7-unfinished-maps`; the cloud merges it into its branch before the release, keeping both.
- Both of this session's commits end with its `Claude-Session:` link; the laptop's end with `Claude-Session: laptop`.

### Claude, 2026-10-13 (laptop)

- Released: 0.0.2, 0.1.0 (rules tooltips), 0.2.0 (chapter 2 sites), 0.2.1 (laptop build). All published.
- On the main branch, unreleased: the "What's new" card (item 2b, `734f7d5`). It ships inside the next release.
- **Item 2, nested world, in flight (Claude):** branch `item2-nested-world` on the laptop, pushed as
  `claude/wip/item2-nested-world`. Steps 2–4 and the D&D world map are built; the main branch (0.2.0) is merged in
  at `293f150`. Left: the world-map review and one fix, the final three-lens check and one fix, then release as
  **0.3.0**. The topography, step 5 (Player Display), step 7 (phones and performance) and step 8 (data pass) are a
  second release (`docs/HANDOFF.md` section 4). If you pick this up: `docs/WORLD.md` on the branch is the design
  reference; the acceptance is a continuous zoom from the whole valley into Vallaki, into the Blue Water Inn, to a
  room, and back out, with the wheel and by touch, and the breadcrumb and Back at every level.
- **Item 7, unfinished maps, paused by Matt:** `claude/wip/item7-unfinished-maps` at `fb49f1f` (a WIP of the final
  fix). Open blockers from the final check: the party cannot climb Yester Hill (the slope is walled off; in
  Players mode a token must walk from the foot to the summit circle); the Amber Temple's +30 and 0 ft levels are
  buried under the new snow ground. Fix-level: the mountain draws as a black wall in Players view; the massif reads
  as a terraced pyramid; a black arc on the summit track; the fog bank does not hide the backdrop mountains; the
  summit grid hangs past its floor; the Amber facade is 31% heavier in triangles; `tests/terms.test.ts` "the DC
  count is pinned" went flaky on the combined branch (fix the cause). Matt's words: "Yester Hill is flat. Fix that.
  The fog wall looks terrible, like cotton."
- Next in order after those: item 3 (dollhouse view; needs the nested world released first), then 4, 5, 6, 8, 10,
  11 and on, as `docs/QUEUE.md` lists.
- An outside branch `codex/fix-explored-fog-growth` exists on GitHub (ChatGPT's own fog fix, 2026-10-11). The
  same bug was fixed on the main branch as 0.0.2; the branch is not merged and needs no action.

## Questions for Matt

- (none open)
