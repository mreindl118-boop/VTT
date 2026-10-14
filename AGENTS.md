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

### ChatGPT, 2026-10-14, active 0.3.2 integration checkpoint

- Bounded 0.3.1 remains separate in `item2-continuity-031`, remote laptop WIP `1c8d94a`. Its versioned frozen build `index-CoeOhM3n.js` passes build, 543 units (two existing TODOs), 21 desktop tests and the full GPU suite: 267 passed, 55 existing device skips, zero failures in 13.0 minutes. The 204-file manifest is unchanged after verification. Current CI `38510870342` remains in browser checks after passing earlier steps; main/release and public distribution are unchanged.
- Active 0.3.2 branch `item2-map-logic-032` merged cloud transition commit `166259b` at `b65d789`: build and 557 laptop units pass (two existing TODOs, no skips with existing public SRD cache). Cloud owns transition/marker follow-ups, including the hidden phone Players return marker. Dispatch coverage is not complete marker/traversal coverage.
- Root owns regional terrain/hydrology/roads, H/G/D geometry, E5's reproducible import recipe, atlas integration and release. Parent transferred the authored landings back to root; the local landing lane now owns Castle/Abbey/Tsolenka/R generators and their four scene/grid pairs. Cloud exclusively owns transition methods, `main.ts` prior-pose wiring, `app.ts` endpoint-aware marker choices/reload, `render/build.ts` endpoint metadata and Players return-marker visibility. Shared wall implementation is committed at `832897a`; its authoring lane now owns `vallaki-sites.py` and its N1/N2/N3/N4/N5/N6/N7/N9 output pairs. WSC owns `wsc-town.py` and only `wsc/02-street` for connected outdoor floor. Ivlis owns its hydrology generator and only Ivlis/Tser data in regional `world.json`. Root alone regenerates atlas/massing; no overlapping app/data edits by those lanes.
- N9 burial reproduced against actual apron triangles; correction `b461609` has two independent reviews and one fix pass, with four new CPU regressions plus all 15 continuity checks passing. Latest integrated build and 561 units pass (two existing TODOs, no skips); 14 wall Python checks also pass. No mesh/draw count or save-schema change. Full integrated visual/GPU/cost verification remains open; see `docs/handoff/land-footprint-report.md`.
- Shared wall correction completed two reviews and one fix pass: 14 focused Python checks pass, including independent invisible/ethereal layers and collision-safe IDs. Write-suppressed checks cover 26 generators / 106 levels, 102 passing with 23 overlapping apertures reduced to zero. Four strict N4/N5/K malformed-aperture requests require their generator owners. Actual output regeneration, all-map runtime and visual gates remain open; see `docs/handoff/wall-topology-report.md`.
- Source contract is recorded in `docs/handoff/regional-logic-contract.md`. H/G/D still fails the retained downhill-water regression; directed profiles, connected catchments, channel meshes and road grades are active work, not completed. Additional owner requests are queued in `docs/QUEUE.md` under "Owner backup backlog after 0.3.2". They do not divert implementation capacity from item 2e; the grid-icon idea was withdrawn.

### ChatGPT, 2026-10-14, production transition UI checkpoint

- Parent extended item 11 ownership to production menu, endpoint markers, Players visibility and reload restoration. Continued the isolated cloud branch from `f1b632e`; all four caller/UI gates below are now implemented. Terrain, authoring and integration remain laptop-owned. See `docs/handoff/item11-ui-report.md` for exact files and integration surface.
- Final build and 565 units pass (two existing skips, two TODOs). All 31 software browser regressions pass, including real pointer/touch/menu/reload controls and all 346 link directions with zero wrong levels or multiple hops. Desktop/phone DM/Players chooser captures inspected. Two implementation reviews and three final review passes completed; one icon correction applied. No tests weakened.
- Software rendering is not hardware GPU verification. Laptop integration, GPU, CI and release remain pending; six authored landing defects and broader all-map findings remain open. Published laptop WIP is `1c8d94a`; parent-reported local `b65d789` was not fetchable. No main/release/version/publication changes.

### ChatGPT, 2026-10-14, scoped transition follow-up

- Continued `claude/wip/item11-vertical-transitions-cloud` from tested `166259b`, under parent assignment. Automatic dispatch chooses the unique nearest newly entered endpoint; equal-distance choices require explicit selection. Endpoint-aware `takeLink` and previous-aware DM dispatch APIs are ready. No main.ts, renderer-module, authoring or generated-map edits.
- Three failing-first unit regressions and the DM dispatcher browser regression reproduced the defects. Build and 560 units pass (two existing source-cache skips, two TODOs); 14 browser checks pass (including all 346 directions), with the remaining pointer continuation passing separately after ordinary Floor-selector navigation. The initial reload-view failure is retained, not counted as a clean 15-test run. Two implementation reviews and three final reviews found no dispatcher blocker. See `docs/handoff/item11-followup-report.md`.
- Production caller gates remain: main.ts context action must pass previous pose; marker creation/listeners must preserve choices and endpoint direction. Actual context-menu no-op/walk-off failure and invisible Players return marker are retained as failures, not claimed fixed. Six authoring proposals and the 48-entry suppressed marker inventory are in the follow-up report. Hardware GPU, integrated CI and release remain laptop-owned.

### ChatGPT, 2026-10-14, independent 0.3.2 transition checkpoint

- Parent assigned CORE-NAV from `55b118e` on dedicated `claude/wip/item11-vertical-transitions-cloud`; laptop retains terrain, placement and integration. Explicit links now use the requested endpoint exactly once; automatic entry is one hop with safe walk-off/reload handling. Amber's valid fissure landing survives unsafe grid snapping. No generated-map, renderer-module, version, main or publication change.
- Failing-first browser checks reproduce the defects. Untouched baseline's real-app sweep confirms 56 wrong levels / 22 multiple transitions in 346 activations, plus six wrong endpoints on the correct floor. Final candidate: all 346 directions pass with zero wrong levels/multiple transitions; 12 software browser tests pass, build and 555 units pass (two existing source-cache skips, two existing TODOs). Two independent reviews completed. Software rendering is not GPU verification.
- Six authored landing cases remain for map owners; three old short-probe failures permit five-foot exits. Shared-landing marker deduplication hides some onward choices; ownership extension requested before touching label creation. Full GPU/integrated CI and these map/UI gates remain open. See `docs/handoff/item11-transition-report.md`. Newer laptop WIP `1c8d94a` was inspected for overlap, not merged or overwritten.

### ChatGPT, 2026-10-14, approved Amber correction verified; release gates remain

- Matt resolved the scope boundary: "Every map's logic should be correct for 0.3.2." Finish bounded 0.3.1 with explicit remaining-issue notes, then comprehensive terrain, roads, water, placement, doors, stairs and source-backed geometry across both campaigns in item 2e. No blanket item 7 merge or unrelated work; identify any necessary component and preserve adaptations. Both package versions and the 0.3.1 changelog are prepared; final versioned verification and CI precede the main release. Public desktop distribution remains held.
- The parent confirmed the cloud fallback at `55b118e`: build, units, desktop tests and the 346-transition probe work; Chromium software rendering is available. Cloud owns the independent 0.3.2 vertical-transition dispatch/arrival correction and narrow tests; laptop root has made no transition implementation edits and retains regional terrain/hydrology/placement plus integration/release ownership. Await its exact file claim before related edits. The sanitized overnight plan is being prepared; licensed sources and ignored authoring imports are not copied into Git.
- Sanitized overnight plan is ready in `docs/handoff/item2e-032-plan.md`: all 46 maps / 122 levels, independent source/implementation/runtime/visual gates, dependency order, numeric/source constraints and cloud prerequisites. Candidate `81b02a3` is pushed to the laptop WIP; its CI is `38510227430`. Isolated `.worktrees/logic-032` / `item2-map-logic-032` starts from that candidate, with root on regional work and the cloud on transitions. Reconcile the completed 0.3.1 release ancestor before releasing 0.3.2.
- Versioned 0.3.1 `index-CoeOhM3n.js`: build, 543 units (two existing todo) and 21 desktop-host tests pass. Full GPU checks are running against a separate frozen copy on port 5644. The initial sandbox-only unit environment failures are retained; unchanged tests passed with existing dependencies outside it. No release claim until final checks and current CI finish.
- Documentation clarification: the Amber rendered-ground regression is resolved; contradictory historical wording is corrected. The report's release-scope table names the Tsolenka approaches, downstream water, J/K adjacency and Amber mountain-envelope outcomes now assigned to 0.3.2. Do not describe all geographic logic as complete. Exact checkpoint CI `38508583254` on `55b118e` has passed typecheck/units/desktop-host checks and is still in browser tests. Fresh main `785421c` is already an ancestor; cloud item 2 stays `4f3cad9`.
- Worktree `.worktrees/continuity`, branch `item2-continuity-031`, base `785421c`. Commits: compass `068fd15`, local terrain `080fed5`, one-field prose gate `f18f087`. Installed 0.3.0 unchanged; no 0.3.1 release, publication or distribution tag. See `docs/handoff/item2-continuity-report.md`.
- Before the additional Amber correction, both build steps received two reviews and one fix pass; final correctness/regression/acceptance reviews and the original final fix pass were complete. Build and 540 units passed (two existing todo, zero skips), two Python checks, nine repeated compass/budget GPU checks and six focused continuity GPU checks pass. The final full GPU run on `index-CF69xAqx.js`: **266 passed, 55 existing device skips, one failure, 12.8 minutes**.
- Matt explicitly approved the additional Amber correction/retest ("nah just go for it") after being told it exceeds the original one-fix allowance. The exception covers this correction and its verification only. The renderer keeps separate heights on opposite sides of hard excavation edges and closes the vertical seams. The production raycast reproduced the exact 24.7616-ft failure before the change; a review then caught two culled wall directions, reproduced by a failing horizontal-ray test and corrected. Two focused reviews are complete. Build, 543 units (two existing todo) and all 15 continuity units pass on final `index-DSh4mmpD.js`.
- Final `index-DSh4mmpD.js`: **267 GPU tests passed, 55 existing device skips, zero failures in 13.5 minutes**, served from an untouched frozen copy. The unchanged ground-height and 300,000-triangle checks pass. Exact outdoor ground error is now 0.00015625 ft; immediate whole-valley frame is 298,844 triangles / 49 draws. Twelve refreshed Amber desktop/phone DM/Players images were inspected locally. All verification browsers exited and GPU use was released by 03:50 UTC.
- Approved implementation `e37734d` and test acceleration `f9e099c` are pushed to the laptop WIP. CI `38505511097` failed the new exhaustive test at its unchanged five-second timeout; pruning only disjoint triangles resolved it. CI `38505966683` on `f9e099c` passes typecheck/units/desktop-host steps and was running browser checks at 03:47:57 UTC. Earlier interruption for SD and a non-frozen app-load timeout are preserved in the report, not counted as clean runs. Added apron cost: 876 triangles, 446 vertices, zero draws; median CPU land construction 241.5 -> 261.8 ms. No 0.3.1 release or publication.
- Tser is now beside north-side water and the gorge is open under Tsolenka. Regional approach/drainage incoherence and the J/K 4,598-ft entrance gap remain for the now-authorized 0.3.2. No wholesale item 7 merge; identify only the components necessary for all-map logic.
- All-map inventory: 46 production maps, 44 scenes / 122 levels. All 45 schemas and 120 rigid-placement assertions pass. First desktop DM images cover all 122 levels; initial Players movement passes 42/44 and desktop wheel responds both ways in 44/44. The final-build phone pass inspected 92 images across all 44 DM/Players scene views after movement probes; zoom responds both ways in all 44, movement passes 42/44, and page errors are zero. A qualified CPU probe covered 365 doors across all levels: 290 open passes, 28 blocked cases (25 overlap another normal blocking wall), 47 without an applicable two-sided floor probe. These are not full traversal certification.
- Source work: 13 chapter2 maps / 34 levels / 47 narrative comparisons; five structure maps / 31 levels / 45 plan/narrative comparisons; six Sheep Chase maps / nine levels / 15 authored-reference comparisons. The remaining 21 Strahd scenes / 48 levels now have 48 comparisons, all 18 primary map pages and 48 CPU diagrams inspected. All 39 Strahd scenes / 113 levels have declared source evidence; full source/runtime certification is still open. Sheep Chase's original PDF review is blocked by download challenge and browser-tool startup failure; its prior local export is available. No book art or screenshots enter Git.
- Checkpoint `3da4420` is pushed to the laptop WIP; main remains `785421c`, cloud item2 `4f3cad9`. That earlier checkpoint was superseded by `576d740`, then the approved Amber commits above; use their current CI rather than this older run. Two-region desktop/phone DM/Players zoom checks pass in all eight combinations. Castle dungeon burial reproduces on frozen 0.3.0. All 173 vertical links were probed; isolated exact transition methods reproduce 56 wrong destinations and 22 multiple transitions across 346 activations, unchanged from baseline and tracked by item 11. Public compiled-bundle publication remains held by the parent.

### ChatGPT, 2026-10-13, desktop installed; update publication held; 0.3.1 requested

- 0.3.0 source release is `e254c88c585c1304f3c9d52698ea04d26346902c`, on main and the laptop WIP. Exact ZIP passed its extracted-launch smoke test and is in Library; the parent owns private hosting. Its SHA-256 is `72698ce833b11055429d0c9118ed80d1a9090e373da08a1e3de765fd5f62cedb`. No screenshot or book-source upload.
- Matt's desktop request is installed at `C:\Users\mrein\AppData\Local\mistLAB`, with `C:\Users\mrein\Desktop\mistLAB.lnk`. The app window and local 0.3.0 status were verified. The dedicated profile preserves future desktop saves; other website/browser saves remain untouched and are not automatically imported.
- Desktop support: 21 focused CPU checks pass, two independent source reviews complete, and a real isolated Edge campaign/party/roster/rules-preference survives restart, 0.2.1 -> 0.3.0 -> compatible rollback -> 0.3.0. Two actual Edge app windows preserve the second when the first closes and stop the host after the last closes. Both checks used software rendering; the live profile was untouched. Details: `docs/DESKTOP.md`.
- The update publisher is ready but **no distribution tag is published**. The repository is already public; the parent's latest direction holds a new public compiled bundle pending distribution clarification. Exact-source CI `38481827736` on `e254c88` was still running at the latest check. No visibility, credential, access, security or power changes. The installed 0.3.0 remains usable independently.
- Matt now requests a separate **0.3.1** landscape-continuity release: source-backed Tsolenka crossings/approaches, Ravenloft duplicate ownership, Tser Pool beside its pool, Amber Temple's exposed entrance/structure, coherent parent/local/building interfaces, and compass click/tap/keyboard north alignment preserving target, distance and pitch. Work on a separate branch after the bounded desktop handoff. Inspect the cloud's parked Amber Temple fix before adapting anything; do not merge or resume the rest of item 7. No speculative whole-region remapping.

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

- Answered (Matt, 2026-10-14: "nah just go for it"): the additional targeted Amber hard-cut correction and verification are authorized despite the original final fix-pass limit. This does not authorize unrelated regional redesign, public compiled-bundle publication or wholesale item 7 resumption.
- Answered (Matt, 2026-10-14: "Every map's logic should be correct for 0.3.2"): ship the bounded local/compass/Amber corrections as 0.3.1 after release gates pass, with honest limits; then correct comprehensive all-map logic as 0.3.2 (queue item 2e). This includes the unresolved regional drainage/grades and J-to-K placement. Public desktop distribution still requires separate approval.
- Answered (Matt, 2026-10-13: "let it run"): the cloud routine stays on; the cloud finishes item 7 and verifies item 2.
- The cloud Claude session's check-in routine ("mistLAB queue check-in") fires every two hours and resumes its runs.
  If everything is meant to be paused, disable that routine (Claude app → Routines) or tell the cloud session to
  stop; otherwise it keeps working item 7 and item 2's world-map step alongside ChatGPT.
