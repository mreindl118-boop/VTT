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

## Working on the maps together

Matt, 2026-10-18: "The maps should not be proprietary to any agent." No map, generator script, scene or shared file
belongs to one agent. Claude Code and ChatGPT both work on any map, the framework included. To keep two agents from
editing the same thing at once:

1. **Claim before you edit.** Add a row to the Claims table below: the map or file (one map's generator script and
   its scene files, or one shared module), who, the time in UTC, what you are doing, and when you expect it on the
   main branch. Release the claim (delete the row) when the change is on main. A claim older than 12 hours with no
   commit on its branch is stale: anyone may take it over, and says so in Status.
2. **Small, regenerated commits.** Change the script, regenerate the scene (never hand-edit the JSON), run the build,
   the unit tests and `audit-outdoor.py`, commit with a message that names the maps you regenerated and looked at,
   push to your branch, and merge the main branch into your branch at least once a day.
3. **Shared files** (`authorlib.py`, `wildlib.py`, the kit's shared modules, `materials.ts`, `backdrop.ts`,
   `worldland.ts`, `movement.ts`, `light.ts`, the audits and tests) follow the same claim rule, plus: keep a change
   opt-in or behaviour-preserving unless the change is the point; add or extend the test that proves it; always
   check Death House, Vallaki and the Sheep Chase square afterwards, and say so in the commit.
4. **Conflicts.** Whoever merges second resolves them, keeping both sides' behaviour. Never resolve a generated file
   by hand: merge the scripts and re-run them. If both sides changed the same logic, read both commit messages and
   combine them; if any choice loses behaviour, ask Matt.
5. **Nothing is owned, everything is recorded.** The framework (item 2f) is shared machinery either agent may extend;
   the per-map corrections (item 2e) may use it; either agent may fix a map the other built. Write what you changed
   and checked in Status so nobody redoes it, and read the other agent's Status entries before starting a map.

## Claims

| What | Who | Since (UTC) | Doing | Expected on main |
|---|---|---|---|---|
| `scripts/authoring/barovia-world.py`, `locations/ch02/barovia-region/world.json`, a new `tests/world-roads.test.ts`; for the lakes (2f-1c) `app/src/render/worldland.ts` (the lake functions only), `app/src/render/worldcarto.ts` (the lakes only), `app/src/ui/worldmap.ts` (the lakes only), `scripts/world-atlas.ts` and `tests/atlas.test.ts` (the shore rule only) (item 2f-1a/c) | Claude, cloud | 2026-10-19 14:25 | the region's roads, rivers and lakes as measured shapes, on `claude/wip/item2f-1-roads` | 2026-10-19/20, with 2f-1b as one release |
| `app/src/app.ts` (only `activate`'s `travel` flag and `moveWorld`), `app/src/render/worldstage.ts` (only `drawTrail`), a new `app/src/render/worldroads.ts` (item 2f-1b) | Claude, cloud | 2026-10-19 14:25 | the trail recorded on explicit travel only and drawn along the road graph, on `claude/wip/item2f-1-roads` | with 2f-1a |
| `scripts/authoring/castle-ravenloft.py`, `locations/ch04/K`, `print/castle-ravenloft/` (item 2g) | Claude, cloud (castle session) | 2026-10-18 21:08 | the playable castle + print set on `claude/wip/castle-playable`; waiting for Matt's approval, then build/tests on a machine with npm | after Matt approves and 0.3.3 lands |

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

### Claude, 2026-10-19 16:30 UTC (cloud): Yester Hill reads as a pyramid from the valley; filed under framework release 7

- Matt, 2026-10-19: "weird pyramid yester hill context" (Yester Hill from above: a square stepped block with the summit
  track on top). The map is five flat square terraces (0 to 272 ft) joined by stairs behind invisible walls (0.3.2's
  item 7 made it climbable that way), so the world draws it as a ziggurat. The fix is the framework plan's release 7,
  question 3: the land as one surface with ground-following levels, Yester Hill rebuilt as one sloped level under a
  claim on `yester-hill.py`, judged on a dev slope first (`docs/MAPS-FRAMEWORK.md`). Four of today's reports land in
  release 7 (the Vallaki terrace, the Amber approach, "the whole world has cohesion issues", Yester Hill); it needs
  Matt's go on that release and its questions 3, 9 and 10 (recommended yes), after item 2f-1.

### Claude, 2026-10-19 16:20 UTC (cloud): Matt's upload of the castle print set's manifest and README, filed for items 2g, 2g-1 and 2f-3

- Matt, 2026-10-19: "these files may help with the ravenloft improvement": the `manifest.json` and `README.md` that
  `print/castle-ravenloft/build.py` wrote on 2026-10-18 from the castle branch (895 files, all manifold, 12 levels:
  dungeon -80 ft, larders -40, ground 0, grand landing +30, court +50, weeping +90, spires +130, south tower +150, tower
  roofs and the bridge +190, north peak +240, north roof +250, high peak +300; the mountain base 64 mm; thirteen colour
  groups on four AMS slots). Print outputs are never committed; the files are kept with the cloud's castle scratch and
  the StudioBook session regenerates the same set from the branch. What they settle: for 2f-3 (the castle's presence)
  the silhouette's true heights above the courtyard, +300 ft at the high peak on the thousand-foot Pillarstone; for
  2g-1 (the front wall and drawbridge) that the castle scene already carries the approach from J, the fifty-foot chasm
  and the drawbridge (`castle-ravenloft.py`, the approach comment near line 70), so the J map's standalone curtain wall
  duplicates the castle's own front and is the part to fold back into the castle.

### Claude, 2026-10-19 15:50 UTC (cloud): three more owner reports; 2f-1 is running (workflow wf_e683c233-add)

- Matt, 2026-10-19: (1) "more world map road logic clarity needed; the whole world has cohesion issues like this"
  (the village a speck beside a broken dashed road far from it): the road part is item 2f-1a, running now (every road
  through the places it serves, ending on a pin or a junction, meeting each map's road exit); the cohesion of maps
  with the land round them (the terraces, the seams, the approaches) is framework release 7 and item 10, which still
  wait for his go on the plan's questions. (2) "how's anyone supposed to get in here?" (the Amber Temple's terrace and
  the Tsolenka gate tower as two flat plateaus with no way between): the Tsolenka road reaching T and X is 2f-1a; the
  terrace edges and the climb between the two maps are release 7 / ChatGPT's 2e "Tsolenka approaches". (3) "this looks
  cool but it's supposed to be attached to and part of Ravenloft and the new improved 3D model" (the Gates of Ravenloft
  map's curtain wall and drawbridge standing alone): queue item 2g-1, part of the castle's claim (item 2g, the
  StudioBook session): the wall, drawbridge and gate tower become the castle's own front on the Pillarstone; J stays the
  road gate. The StudioBook prompt was written before this; whoever runs item 2g reads this entry first.
- Running: item 2f-1 (roads, lakes, trail) as workflow `wf_e683c233-add` on the lean setting; nothing else runs.

### Claude, 2026-10-19 15:30 UTC (cloud): one more owner request queued (the village's streets and Death House); 2f-1 launched

- Matt, 2026-10-19, two screenshots of the village of Barovia: "death house is just stapled over a road, not logically
  placed"; "roads don't do that". Queue item 2f-4: `village-roads.py` lays each street as one cobble slab per segment
  with a disc at each joint (blunt ends in the grass, kinks, streets that do not meet), and `village-map.py` puts Death
  House where a street runs. Its own lean job after 2f-1, 2f-2 and 2f-3, claimed when it starts.
- Order of the owner's requests, all approved by his words today: 2f-1 (roads, trail, lakes; running), 2f-2 (Krezk's
  crag), 2f-3 (the castle's presence), 2f-4 (the village's streets and Death House). Item 10 / release 7 hold the
  Vallaki seam.

### Claude, 2026-10-19 15:15 UTC (cloud): three more owner requests queued (lakes, Krezk's crag, the castle's presence); 2f-1 runs

- Matt, 2026-10-19, in a burst with screenshots: (1) "all of these unnatural oval lakes aren't looking good" (the inked
  valley: Lake Zarovich a perfect ellipse); (2) "krezk mountain thing is too steep, is broken texture; make it more
  realistic in scale and texture" (the abbey's cutting from below); (3) "ravenloft in the distance should be more
  visible and imposing even across distances; it's an ever-present moment in the module" (the castle a speck on the
  horizon from the Svalich road). (1) joins item 2f-1 as part (c): the lakes are ellipses in `world.json`
  (`lakes[].center/r`), consumed analytically by `worldland.ts` `lakeNear`/`levelOf`, the carto shader's `uLakes`
  and `worldmap.ts`; measured outlines replace them in the same job as the roads, since the same map page is measured.
  (2) is queue item 2f-2 and (3) item 2f-3, each its own lean job after 2f-1, each claimed when it starts. The Vallaki
  seam stays with item 10 / framework release 7 (14:25 entry).
- Item 2f-1 (roads, trail, lakes) is being built now on `claude/wip/item2f-1-roads` (worktree `.claude/worktrees/roads`)
  as one workflow on the lean setting: a measuring scout on the 200-dpi page render (scratch only), one builder per
  part in sequence, a verifier, two reviewers, one fix pass; then the release at the next version in order.

### Claude, 2026-10-19 14:25 UTC (cloud): Matt's go on the roads and the trail; item 2f-1 started

- Matt, 2026-10-19: "go on", on the 14:10 proposal. Queue item 2f-1 (under 2f-0) and the two claim rows above; branch
  `claude/wip/item2f-1-roads` from main `0bc2613`. One job on the lean setting (builder, two reviewers, one fix pass),
  (a) the road graph first, (b) the trail on it, one release at the next version in order. The regional map page is
  read from `reference/module/curse-of-strahd.pdf` (gitignored) at the generator's own 200-dpi frame; only measured
  positions enter the repository, never the art. ChatGPT's item 2e branch touches `worldland.ts` only; this item
  touches no renderer but `drawTrail`.
- Matt, 2026-10-19 (screenshot of Vallaki from the north): "weird topographical issue in Vallaki": the town's flat map
  plane standing as a terrace over the valley with straight diagonal edges and a dark wedge at the seam. That is the
  map-to-land flattening band (`worldland.ts`: the land flattened to each map's base inside `FLATTEN_IN..FLATTEN_OUT`
  of its rectangle, overlapping bands normalised; `docs/WORLD.md`: Vallaki's 1.7-mile map blends two bases), already
  carried by queue item 10 (Vallaki terrain, built at `c0fd014`, waiting on item 8) and by the framework plan's release 7
  ("no step where a map meets its valley"). Not folded into 2f-1 (ChatGPT's files, a different fix); it waits for
  Matt's order on item 10 / release 7.

### Claude, 2026-10-19 14:10 UTC (cloud): Matt's report on the valley's roads; diagnosis and a proposal, nothing built

- **Matt, 2026-10-19 (with four screenshots: the castle and gates, the Wizard of Wines, the Balinok slopes, Raven River
  Crossroads, Old Bonegrinder): "there's these floating dotted lines and the main roads are all messed up, they don't
  seem to go logically on the main map nor through the areas they connect"; "see the lack of road logic here?"**
- **Two different things are on screen.** (1) The bright red straight rays, dashed and solid, fanning out from one
  place across the whole valley are not roads: they are the party's trail (`.nesttrail`, `worldstage.ts:499-506`),
  the last 12 world moves drawn as straight lines between the places' positions. Opening a place from its name with
  `travel` set records a move (`app.ts:878`, `moveWorld`), so every map the DM opened while looking round became a
  ray from the previous place; where the trail doubles back, two dashed strokes out of phase read as one solid line.
  (2) The dark winding ribbons are the real roads, and their data is the problem: `locations/ch02/barovia-region/
  world.json` holds 35 road pieces (the Old Svalich Road alone in 17 fragments, many of 2-4 points); 43 of the 70
  fragment ends lie at no pin and no other road within half a mile (the dead-end stubs); every place except Tser Pool,
  Tsolenka and the Amber Temple sits 0.25-0.47 mi from the nearest road point (the roads skirt the places they
  connect); Castle Ravenloft is 1.08 mi, Berez 1.65, Yester Hill 1.90 off the net; and a 2-3 point fragment with a
  tight turn, smoothed (`chaikin` in `worldcarto.ts:491`), makes the hooks seen at Bonegrinder and the Balinoks. The
  rivers are 12 pieces with two identical pairs (ChatGPT's 2e plan noted them). World roads also stop at each map's
  edge by rule (`worldland.ts:380-411`), so a map whose road exits do not line up with the valley road shows a gap.
- **Already tracked, not started:** ChatGPT's item 2e plan (`docs/handoff/item2e-032-plan.md` step 3, "the connected
  regional land, water and road model": shared endpoints, tangent continuity, graph connectivity, no draping over
  noise) and framework release 7 consume it; ChatGPT's branch touches `worldland.ts` only (+27/-5), not the data.
- **Proposal for Matt (two bounded jobs, his go needed; see Questions):** A. the road net as one graph: re-digitise
  the roads in `world.json` from the regional map as connected polylines between the places (3-8 points per mile, every
  end on a pin or a junction, each road meeting its map's road exits at the map edge), the rivers de-duplicated and
  joined, with a unit test that holds it (every end on a pin or junction; every road place within 0.1 mi of a road; no
  hook); claim on `world.json`, `barovia-world.py` and that test. B. the trail: a move is recorded only on an explicit
  travel (a drag of the party or a Travel choice), not when the DM opens a map to look, and the drawn trail follows
  the road graph between places instead of a straight line; claim on `app.ts` (`moveWorld`, the `travel` open) and
  `worldstage.ts` (`drawTrail`). Nothing is built until he answers.

### Claude, 2026-10-19 13:30 UTC (cloud): CI is green on main again on the pinned runner; the ci.yml claim is released

- **All four runs with the pin are green:** `3f017e8` (39244566085 main, 67 min; 39244610015 wip, 73 min) and `1f80b99`
  (39244730107 main, 80 min; 39244773241 wip, 85 min), each the full suite on `ubuntu-24.04`. **ChatGPT: `desktop-v0.3.3`
  from main's head is cleared; main's CI has been green on every commit since 0.3.3's release commit `b62fd04`.** The
  claim row for `.github/workflows/ci.yml` is released; the pin stays until Matt decides on a Playwright upgrade.
- No new commits on any other branch, no desktop tags yet, no new comments on issue #3, nothing new in GeneralStorage.
  Nothing is running. Waiting on Matt as listed in the 11:30, 09:50 and 04:50 entries.

### Claude, 2026-10-19 11:30 UTC (cloud): CI broke for every commit at 09:30 (the hosted image moved); the runner is pinned

- **Both runs on `722dc04` (doc-only) failed in one minute at `npx playwright install --with-deps chromium`:** since
  about 09:30 UTC GitHub's `ubuntu-latest` label resolves to the `ubuntu-26.04` image (version 20261012.163.1), and
  Playwright 1.56.1 refuses it ("Playwright does not support chromium on ubuntu26.04-x64"). Typecheck, the 569 unit
  tests and the 21 desktop checks passed before that step; no browser test ran. The 07:24 runs, green, were on the
  earlier image. Not the code, not the tests: every push from any branch would fail the same way, ChatGPT's and the
  castle's included, and `desktop-v0.3.3` needs green CI on main's head.
- **Fix, one line, reversible, on main as `3f017e8` and on the wip branch:** `runs-on: ubuntu-24.04` in
  `.github/workflows/ci.yml`, the image CI ran on until this morning, with a comment saying why; claim row above. On
  the first run with the pin (39244566085) the install step passes and the browser suite is running; its result is read
  at the next check-in, and the claim row is released when it is green. The alternative, a Playwright upgrade that
  supports 26.04, changes the tested browser and is Matt's call, not a check-in's.
- No new commits on any other branch, no desktop tags yet, no new comments on issue #3, nothing new in GeneralStorage.
  Nothing else is running. Waiting on Matt as listed in the 09:50 and 04:50 entries.

### Claude, 2026-10-19 09:50 UTC (cloud): check-in; CI green on main again; the world suite's three flaky checks, named

- **CI on `4850a52` (doc-only): green on main (run 39215743890, 84 min); the wip branch's duplicate run (39215746871,
  67 min) failed a different check than last time: `e2e/world.spec.ts:602` expected all 32 shown valley names
  clickable and found 31.** Nothing is changed; no test is touched. 0.3.3 stands; ChatGPT's `desktop-v0.3.3` is still
  cleared from main's head.
- **The world suite has three timing-sensitive checks that fail only on the hosted runners, and did so before 0.3.3:**
  4 of the last 20 CI runs failed, every one in `e2e/world.spec.ts`, every one on code that passed the same suite
  elsewhere (the identical commit on the other branch, or locally). (1) The valley fit (line 511): after
  `frameWorld('fly')` the test waits on `settled()`, which gives up after a hard 4 s whatever the flight is doing
  (`app/src/render/world.ts:497`), so a slow runner measures the valley mid-flight and finds pins S, W and Y off-screen
  (run 39188832664 on `a790925`, the 0.3.2 code plus a doc commit, 2026-10-19 02:11). (2) The zoom-out chip (line
  542): the test's 420 s budget covers two flights and a 180 s wait; an 89-min runner ran out of it (run 39203701651).
  (3) The names' clickable count (line 642): a name is "clickable" when the app's nearest-mark hit-test at its box
  centre returns itself; where two marks share space the nearest wins by design, so one near-tie flips with sub-pixel
  layout differences (run 39215746871). Locally, on the 0.3.3 build with software rendering, the two tests pass 8 of 8
  (four repeats each, 4.2 min). The app is not at fault in any of the three; the fixes are test-side (wait on the
  flight's own state instead of the 4 s cap, judge the count by the app's own rule, size the chip wait to the flight)
  and no assertion gets loosened. **Question for Matt below: run that as a bounded job, or leave CI as it is and
  read a duplicate run's red as noise.**
- No new commits on any other branch, no desktop tags yet, no new comments on issue #3, nothing new in GeneralStorage.
  Nothing is running. Waiting on Matt as listed in the 04:50 entry.

### Claude, 2026-10-19 07:30 UTC (cloud): check-in after 0.3.3; CI green on main, one slow-runner timeout on the wip copy

- **CI on 0.3.3:** green on main for both the release commit `b62fd04` (run 39203636870, 69 min) and the Status commit
  `f31b97a` (run 39203701462, 70 min), and on the wip branch for `b62fd04` (run 39194635859). **ChatGPT: `desktop-v0.3.3`
  from main's head `f31b97a` is cleared.** The wip branch's duplicate run of `f31b97a` (39203701651) failed: its runner
  took 89 min for the same suite and the valley flight test (`e2e/world.spec.ts:497`, a 420 s budget that covers two
  flights and a 180 s wait) ran out of time at the zoom-out chip; 266 passed, 55 device skips, 1 timed out. The
  identical commit passed on main 19 min faster, so this is a slow runner, not the code; nothing changed, no test
  touched. Lesson: push a release to main first and the wip branch after, not both in one push, so two identical
  runs do not race on the same minute.
- No new commits on any other branch, no desktop tags yet, no new comments on issue #3, nothing new in GeneralStorage.
  Nothing is running. Waiting on Matt as listed in the 04:50 entry.

### Claude, 2026-10-19 04:50 UTC (cloud): 0.3.3 (item 2f-0, homogenization) is on the main branch and published

- **0.3.3 is on the main branch (release commit `b62fd04`; main's head is this entry's commit) and published to the
  mistLAB link (artifact version 45, bundle `index-B2qu1Jpx.js`). ChatGPT: publish `desktop-v0.3.3` from
  main's head once CI is green on it.** Item 2f-0 is ticked; its claim row is released. Visual-Aide: a root-table row
  only (`34e1b1f`), because nothing looks different. Versions from here, by the standing rule (next number in release
  order): ChatGPT's all-map logic release (item 2e) takes 0.3.4; the castle (item 2g) takes the next number free when
  Matt approves it (its claim row says "after 0.3.3 lands", which is now).
- What changed: `app/src/kit/shapes.ts` (the shape helpers up to 18 site modules declared by copy), `app/src/kit/mist.ts`
  (one `fogMat` with one cache, for the seven copies), `scripts/authoring/geomlib.py` (the plane-geometry helpers copied
  26 times across 17 generator scripts), and wild-b using wild's weed tuft; 39 files, +340/-635 before the release docs.
  Nothing looks or plays differently.
- Proofs on the release head: build passes; `npx vitest run` 569 passed, 2 environment skips, 2 todo (new
  `tests/compact-frame.test.ts`); browser suite 267 passed, 55 device skips, 0 failed (1.0 h, software rendering);
  all 45 scenes' entry frames pixel-identical with equal draw calls, triangles and meshes against the 0.3.2 build
  (`2fd728a`), captured twice (on the consolidated code at version 0.3.2, then on the release bundle); the object
  fingerprint identical (789 kinds, 3012 builds); 14 generators regenerate their scenes byte-identical; the changelog
  entry has no eight-word run from the module; no model names in the diff. One harness lesson, for whoever captures
  next: the scene-graph mesh count the capture also records jitters by one or two on scenes with a world-stage proxy
  (the proxy's detail mesh streams in at a variable moment, on the 0.3.2 build just the same, and is not drawn in the
  frame), and the "What's new" card must be suppressed by seeding the exact app version or its backdrop dims every frame;
  the gate reads pixels, draw calls and triangles.
- Review (two reviewers, one fix pass): the review caught one behaviour change the fingerprint could not see (the shared
  `compact` drops the root scale a sleeping werewolf-wolf relies on, and no scene passes `sleeping`): `t.ts` keeps its own
  world-frame `compact`, with a test that failed first; two claim-boundary overreaches were reverted (call-site
  reordering in the site modules; the `props.ts` helpers restored as local copies).
- For Matt: `vallaki-town.py` cannot reproduce the committed `ch05/N` scene without `reference/imports/vallaki-houses.json`
  (pre-existing, not from this release; the scene was not regenerated). The later rounds change behaviour and wait for
  his go: one mist piece, the three overlapping land systems, the two world maps, the castle generator (item 2g's claim).

### Claude, 2026-10-19 02:30 UTC (cloud): item 2f-0, homogenization, started on Matt's go

- Matt, 2026-10-19: "Go ahead and work on homogenization and smoothing of features stacking things together where they
  belong. Making sure that things are not redundant, making sure that there's no bloat." Queue item 2f-0 (above item
  3) and the claim row above. Scope of this first round, pure consolidation with no visual or logic change: the shape
  helpers declared in up to 18 site modules, the ten `fogMat` copies and the fog-sheet builders, the creature and prop
  builders copied across site modules, and the authoring helpers copied across generator scripts, each to one home.
  Gate: every scene's entry frame pixel-identical and draw counts equal against the build before (the capture of all
  45 scenes from `2fd728a` is the baseline), every scene regenerated byte-identical, build, unit tests and the audit
  unchanged. Left for later rounds, with Matt: the one mist piece (a visual change), the three overlapping land
  systems (ChatGPT's files), the two world maps (a feature question), the castle generator (item 2g's claim).

### Claude, 2026-10-19 01:20 UTC (cloud): the map-logic audit is in; CI is green on 0.3.2

- **CI run 39179350076 on `2fd728a` (0.3.2) completed green at 01:14 UTC. ChatGPT: publish `desktop-v0.3.2` from
  that commit.** Both audits are done and the cloud's background runs are all stopped.
- **`docs/handoff/map-logic-audit-2026-10-18.md`** (findings only, on 0.3.1; a spot check notes what 0.3.2 changed):
  40 families, 2 blockers, 21 major, 13 minor, 2 nits, 2 reported elsewhere but not reproduced on main; a scorecard
  for all 45 scenes: 13 play clean, 20 play with faults, 10 broken for at least one thing a table would do (E5, K, N1,
  N3, N4, N6, S10, Y at 0.3.1, wsc/02-street and the sealed Vallaki interiors). The blockers: the party spawns off
  every floor polygon on S10 and the Sheep Chase square, so Players cannot move at all; and the link loop keeps
  scanning after a transition, so 56 of 348 stair activations on 7 maps land on the wrong floor or fire more than
  once. The three fixes that clear the most: a generator contract in `authorlib` (spawn and link ends on floor, no
  wall over a door, floor both sides of a door, rooms reachable unless flagged sealed, polygons simple); the
  vertical-link loop fixed to one hop per move with one marker per destination and origin-aware snapping; land
  flattened to the entry level with the footprint as the union of every level. Nine questions for Matt are in the
  report's "For Matt to decide". The report's numbers agree with item 11, ChatGPT's all-map and transition reports
  and the framework survey where they overlap, and say where they differ. Nothing is queued or built from it.

### Claude, 2026-10-19 00:35 UTC (cloud): the ease-of-use audit is in

- **`docs/handoff/ease-of-use-audit-2026-10-18.md`** (findings only, on 0.3.1): 55 findings after merging and
  refuting, 1 blocker, 7 major, 30 minor, 17 nit, each with the smallest fix and the queue item that already covers
  it. The blocker: on a phone both DM menus (Tools and View) open off the left edge, so no fog tool, Measure, Walls,
  Mist or Player Display can be reached. Majors: the Death House spiral stair carries the party two floors in one
  step (item 11 / 2e); Players view leaves the Library, World map, Back, floor picker, Whole building, Section and
  the DM tab live for the table (item 22); the phone's floor row runs under the DM/Players slider; the phone roster's
  ticks and Initiative inputs are off-screen; the turn bar covers the clock, minimap and compass on the phone; Vallaki
  opens from 17,000 ft on the phone; the inn hands over at 12 ft on floorboards. Seven findings have no queue home and
  are questions for Matt (section 4 of the report). Nothing is queued or built from it without him.
- The map-logic audit (findings only, on 0.3.1) resumes now from its cached static stages.

### Claude, 2026-10-19 00:55 UTC (cloud): new owner request on the castle (item 2g)

- Matt, 2026-10-19: "Notice how the walls in Ravenloft as they are are like 0 mm thin. That shouldn't be the case. They
  should be proportionately sized walls where possible. Borrowing from the space around them and kind of distorting the
  place just slightly to make it logical." Diagnosis: walls are centreline segments with no thickness in the data;
  `app/src/render/build.ts` draws every wall of every map as a box `WALL_T` = 0.6 ft thick (`app/src/kit/pieces.ts`),
  and `print/castle-ravenloft/build.py` prints them 3 mm thick (the same 0.6 ft at 25.4 mm per cell). Proposed shape,
  for Matt's go: an opt-in `thicknessFt` on `Wall` (schema), honoured by the wall, door and window boxes in
  `build.ts` and by the print set, default unchanged so every other map draws the same pixels; the castle generator
  sets it per wall class and insets each room's floor by half the thickness so the walls take their space from the
  rooms, never below one clear cell. The castle session holds the claim; whoever builds it claims `schema.ts`,
  `build.ts` and the castle generator first and writes the before/after pair.

### Claude, 2026-10-19 00:40 UTC (cloud)

- **0.3.2 is on the main branch (`2fd728a`) and published to the mistLAB link (artifact version 44, bundle
  `index-DNdaqxu6.js`). ChatGPT: publish `desktop-v0.3.2` from that commit once CI is green on it.** Item 7 (the
  unfinished maps) is ticked; its claim is released. The release's single review passed with nits only (recorded in
  the review, none blocking). The merged head was built and unit-tested again (567 passed, 2 environment skips, 2
  todo); the six maps' text has no eight-word run from the module. Screenshots for 0.3.1 and 0.3.2 are in Visual-Aide
  (`releases/0.3.1-nested-world/`, `releases/0.3.2-unfinished-maps/`, commits `fcd3e79` and `d37e19b`). CI run
  39179350076 on `2fd728a` was still running at 00:20 UTC. The ease-of-use and map-logic audits resume next, one at a time, against a served
  copy of the 0.3.1 build they started on.
- From this commit on, the cloud's commits carry `Co-Authored-By: Claude <noreply@anthropic.com>` without a model
  name, as the rule "model names stay out of the repo" requires (the earlier trailers stay as they are: history is
  never rewritten).

### Claude, 2026-10-19 00:05 UTC (cloud; resumed after the usage reset)

- **Castle Ravenloft (item 2g, `claude/wip/castle-playable` at `06f01ce`): the checks the castle session could not run,
  done in a worktree with npm. Nothing on the branch was changed; its claim stands.** `npm run build` passes.
  `npx vitest run`: 541 passed, 2 skipped (the two SRD-cache blocks, as on main), 2 todo. `audit-outdoor.py` exits 1
  on main and on the branch alike (the pre-existing tavern-facade findings), and the castle's 67 off-ground objects
  are the same on both. The generator re-run reproduces the committed scene exactly, but `npm run build` regenerates
  `manifests/world-atlas.json` (objects 386 → 387): the branch needs that manifest regenerated and committed.
- Runtime probe under Players rules on all 12 levels (one browser, software rendering): the party stands on floor on
  every level and takes all four first steps on 11 of them (2 of 4 at the courtyard's K1 start); 45 of 67 doors pass
  both ways when open; none refuses to open; 1 opens but still blocks (`K37-north-b`, Rooms of Weeping: the tower's
  diagonal wall `weeping-w-7` runs through its gap); 19 doors open onto ground that is not walkable floor: 4 from the
  keep into the courtyard (`K11-door`, `K7-outer`, `K23-courtyard`, `K23-west`; the courtyard is terrain, not floor,
  so the party cannot pass between keep and courtyard in Players mode) and 15 into corridors with no floor polygon
  (`K78-north`, `K80-door`, `K72-door`, `K70-south`, `court-K11-door`, `K25-south-door`, `K30-west`, `K34-south`,
  `K37-north-a`, `K37-south`, `K37-west`, `K40-doors`, `K42-east`, `K36-north`; `K30-east`, `K42-south`, `K49-K48`
  have floor 5-7.5 ft off). No spawn is authored, so the scene still opens on the courtyard with the party in the
  dungeon (levels[0]). Screenshots at 1366x768 and 390x844, DM and Players, on ground, court, dungeon and weeping:
  no page errors; walls, open stair wells and the straight stairs draw in place; Players view shows the unexplored
  keep as the usual black mass. The probe script and shots are in the cloud's scratch folder, not in the repo.
- **Copied-text gate: the branch's reworded descriptions add 11 eight-word runs matching the module's OCR** (main's
  castle scene has 1, the tomb's name): the K4, K46, K51, K63 and K72 descriptions and the K39 secret doors in
  `castle-ravenloft.py`. They must be reworded before this can release. No model names; no print outputs committed.
- The 0.3.2 release's review (one agent) is running; then the release, then the two audits resume, one at a time.

### Claude, 2026-10-18 21:15 UTC (cloud; PAUSED under USAGE.md until the five-hour window resets at 23:40 UTC)

- **Matt's usage rule binds every agent** (GeneralStorage `USAGE.md`, branch `claude/coworking-ack`, 2026-10-18). This
  session has no readable meter; the account's five-hour window read 86% at 21:08 UTC (another Claude session's
  handoff), reset 23:40 UTC, seven-day window 25%. So: nothing new started, every background run stopped, this
  handoff written, resume at 23:50 UTC (the check-in is re-armed to then), one lean job at a time.
- **Stopped mid-run, resumable from their cached stages, nothing pushed from them yet:** the 0.3.2 release
  (`wf_87fec1ac-32e`: integrate done, release commit `a447725`, head `5593e4e` on `item7-unfinished-maps`, main merged
  three times; browser suite 266 passed, 55 device skips, 1 failed, fixed at its cause by test commit `38143c9` and
  re-run green; vitest 567 passed, 2 pre-existing environment skips, 2 todo; the review stage was in flight and is
  redone on resume, then the release is published); the ease-of-use audit (`wf_6aeedc2c-d18`, done: inventory, heuristics; the desktop walk was in
  flight); the map-logic audit (`wf_fe7ebc32-113`, done: scout, static:placement-doors, static:rooms-links, static:lattice-placement; the runtime pass was in flight). Both audits are
  findings only.
- **Castle Ravenloft (Matt, 2026-10-18, issue #3; queue item 2g):** a second cloud session Matt opened by voice built
  it at 21:08 UTC (its entry is below): the playable pass, the regenerated scene and `print/castle-ravenloft/` on
  `claude/wip/castle-playable`, brief in `docs/handoff/castle-playable.md`. This session's own claim, written seven
  minutes later without seeing that entry, is withdrawn: one plan, one branch, that one. What that session could not
  run (no npm there) and this one can, after the usage reset and if nobody has by then: `npm run build`,
  `npx vitest run`, `audit-outdoor.py`, the Players-mode start test on every castle level, the in-app look on desktop
  and phone as DM and Players, written here with the commit hash; then Matt approves or not. Rhino refinement,
  trinket sculpting, GPU inspection and fabrication acceptance wait for StudioBook (Matt back about 01:00 UTC; the
  laptop connection and Rhino/GPU are verified then). Nothing merges or releases before Matt's yes and 0.3.3.
- The item 2f plan (`docs/MAPS-FRAMEWORK.md`) awaits Matt's go. ChatGPT's draft PR #2 is acknowledged, not merged.
### Claude, 2026-10-18 21:08 UTC (cloud; a second cloud session Matt opened for the castle)

- **New item 2g (Matt, 2026-10-18, by voice): Castle Ravenloft playable + print set + trinket**, on `claude/wip/castle-playable`
  (from main `97f3bee` + the castle part of `claude/wip/item6-village-castle`). Brief and co-working instructions:
  `docs/handoff/castle-playable.md`. Done: the generator's playable pass, the regenerated scene, `print/castle-ravenloft/`
  (stack, trinket, previews, README) and a first full output set delivered to Matt as a zip. **Not done:** `npm run build`,
  the unit tests and the in-app look (this session had no npm access). Whoever has npm next: run them on the branch and
  write the result here. **Nothing from this item merges until Matt approves the playable castle**; it releases after
  ChatGPT's 0.3.3 (merge main, re-run `castle-ravenloft.py`, never hand-merge the scene JSON).
- Claimed above: the castle generator, its scene files and `print/castle-ravenloft/`. ChatGPT's item 2e castle edits
  (K22 door, K28 partition, maps 6/7 re-registration, K51 hatch) were **not** taken onto this branch; they come in with
  0.3.3 and the merge is theirs to carry over by re-running the script.
- Matt also said "set up co-work instructions" for the other assistant on this item: they are the "Co-working on item
  2g" section of the brief. Nothing in it changes the claims-and-merge rules above.

### Claude, 2026-10-18 20:45 UTC (cloud)

- **The item 2f plan is written: `docs/MAPS-FRAMEWORK.md`.** Eight small releases on the lean setting, visual first with
  the two "cannot move" engine fixes pulled to the front: 1 the party always starts on a floor it can leave, a step is
  instant, a refusal says why, and a map contract counts every map's findings (report mode); 2 the light rig and the
  measuring tools (before/after pairs, an address-bar switch per feature); 3 one mist piece, and fog of war that reads
  as mist; 4 the grid stays on the map, towns open framed, pins fold away; 5 ground colour, grain and contact
  darkening (a port of the reviewed item 6 render work); 6 level of detail, instancing, prop shapes, hard per-map
  budgets; 7 land as one surface, ground-following levels, water and height fog (after ChatGPT's Status line on
  `worldland.ts`/`backdrop.ts`, or its 0.3.3); 8 the browser walks every map, the contract turns hard, one regeneration
  of all 44 scenes with save migrations (after 0.3.3). Releases 1-6 touch no file ChatGPT's branches change. Part C of
  the plan is this item's paragraph for "Working on the maps together": claims, not ownership. **Nothing is built until
  Matt approves the plan**; his ten questions are under Questions for Matt below (Part A of the plan has the detail).
- Two audits Matt asked for at 20:20 UTC are running, findings only: an ease-of-use audit of 0.3.1 (desktop and phone,
  DM and Players) and a map-logic audit of all 45 scenes (starts, steps, doors, rooms, links, ground, lattice, nested
  placement). Their reports land in `docs/handoff/` when done; nothing is queued from them without Matt.

### Claude, 2026-10-18 20:10 UTC (cloud)

- Read ChatGPT's draft PR #2 (`docs/coworking-20261018`, from `0bab66f`: a README link to the private GeneralStorage
  coworking guide, a Status note and a ledger row). Acknowledged on the PR. Two things for whoever merges it: its
  "work remains with its existing owners" is superseded by Matt's rule on main (`256cc49`, "Working on the maps
  together" above), and the cloud session cannot read GeneralStorage (it is not among this session's repositories),
  so for this repository the Claims table above is the claims record and nothing on main depends on that guide.
  Merging the draft is ChatGPT's or Matt's call; the cloud does not merge another assistant's draft.
- Item 7 → 0.3.2: the release run is in the full browser suite on the merged head `fd65aea` (version bumped,
  changelog written, main merged twice). Item 2f: the survey-and-design run is writing its synthesis; its designs and
  judging ran before Matt's shared-maps rule, so its boundary section is rewritten as the claims-and-merge protocol
  (no ownership) before any of it enters this file. Nothing is built for 2f until Matt approves the plan.

### Claude, 2026-10-18 (cloud; back after the usage-limit reset)

- **New item 2f, the general map improvement framework (Matt, 2026-10-18).** Shared machinery that lifts every map:
  visual quality (lighting, materials, land and the map-to-land seam, water, fog, scenery detail, decluttering) and
  movement logic (generator-time assertions, a runtime walk audit, engine fixes for whole failure families). The
  cloud is surveying and designing it now and shows the plan to Matt before building. **Nobody owns it or any map**
  (Matt, 2026-10-18): see "Working on the maps together" and the Claims table above. The design run was told the same.

- Read everything ChatGPT did: 0.3.0 and 0.3.1 are on the main branch (head `39e06f3`, package.json 0.3.1), with the
  desktop host Matt asked for. The cloud checked main: no forbidden files, `npm run build` passes, 541 unit tests pass.
- **Publishing now:** 0.3.1 goes to the mistLAB link and its screenshots to Visual-Aide (the cloud's job).
- **Versions:** Matt was asked which version item 7 takes and had no preference, so the standing rule applies: the next
  version in release order. **Item 7 (unfinished maps) releases now as 0.3.2** from `item7-unfinished-maps`
  (`0db19b9`, the finished and tested fix), merging main first. **ChatGPT's all-map logic release (item 2e) takes the
  next number after it lands (0.3.3)**; its branch should merge main after 0.3.2 so its Amber and Yester work starts
  from the fixed maps. Neither agent commits to a branch the other is working on without a claim; the work meets on main.
- ChatGPT's commits since 2026-10-13 are reviewed and logged in the ledger as part of the 0.3.2 release (grouped by
  release, not one row per commit).
- **0.3.1 is published to the mistLAB link** (artifact version 43) from a build of main `39e06f3`; its bundle hash
  `index-CoeOhM3n.js` matches ChatGPT's frozen 0.3.1 build, so the link and the desktop app carry the same bytes.
- **Matt, 2026-10-18: "I want the artifact to be auto updating to the new app window so there's version consistency
  in the ways I access and test the app."** So, from now on, one release means three things from the same source
  commit: (1) the release on the main branch; (2) the mistLAB link, which the cloud republishes from that commit's
  build at its next check-in (within about two hours), and after every release it makes itself; (3) the desktop
  distribution tag `desktop-vX.Y.Z` (`scripts/desktop/publish.mjs`), which the installed app picks up on its next
  launch. **The held desktop tag is now approved by that decision: ChatGPT publishes `desktop-v0.3.1` from its frozen
  0.3.1 fingerprint, and `desktop-v0.3.2` once the cloud's 0.3.2 is on main with green CI** (the cloud will write
  "0.3.2 is on the main branch" here). The tag puts the compiled app in the already-public repository; the source is
  public already and no book content is ever in a build.

### ChatGPT, 2026-10-14 07:58 UTC, bounded 0.3.1 source-release record

- Bounded 0.3.1 has passed final acceptance, correctness and regression reconciliation. Exact versioned candidate `1c8d94a` passed CI `38510870342`; build `index-CoeOhM3n.js` passed 543 units, 21 desktop-host checks and 267 GPU checks with 55 existing device skips and zero failures. Acceptance independently rehashed all 204 frozen files without a mismatch.
- This release-record commit changes documentation only. Root verifies its output against the frozen versioned build and exact-head CI before advancing main; fresh main `785421c` is already included. Queue 2d and HANDOFF are prepared for that source release. Public compiled bundle/feed, distribution tag and screenshot publication remain held.
- Comprehensive all-map logic continues separately on `claude/wip/item2e-map-logic-laptop` at `4e2d63a`; the reviewed map-access batch is not yet committed. Its staged export passes build, 673 units (two existing TODOs) and five focused GPU marker checks. Independent integration reviews remain pending. Terrain, Castle save-migration activation/roof compatibility, J/K placement and all-map runtime/source/visual gates remain open.
- Preserve the coordinator-plus-one-worker pacing and sequential reviews through 13:00 UTC. No power, access, credentials, security settings or shared history changes.


Each agent rewrites this section when it stops. Newest first. Keep it short and exact: versions, branches, commits,
what is done, what is next, what is blocked.

### ChatGPT, 2026-10-14, approved Amber correction verified; release gates remain

- Matt resolved the scope boundary: "Every map's logic should be correct for 0.3.2." Finish bounded 0.3.1 with explicit remaining-issue notes, then comprehensive terrain, roads, water, placement, doors, stairs and source-backed geometry across both campaigns in item 2e. No blanket item 7 merge or unrelated work; identify any necessary component and preserve adaptations. Both package versions and the 0.3.1 changelog are prepared; final versioned verification and CI precede the main release. Public desktop distribution remains held.
- The parent confirmed the cloud fallback at `55b118e`: build, units, desktop tests and the 346-transition probe work; Chromium software rendering is available. Cloud owns the independent 0.3.2 vertical-transition dispatch/arrival correction and narrow tests; laptop root has made no transition implementation edits and retains regional terrain/hydrology/placement plus integration/release ownership. Await its exact file claim before related edits. The sanitized overnight plan is being prepared; licensed sources and ignored authoring imports are not copied into Git.
- Sanitized overnight plan is ready in `docs/handoff/item2e-032-plan.md`: all 46 maps / 122 levels, independent source/implementation/runtime/visual gates, dependency order, numeric/source constraints and cloud prerequisites. Candidate `81b02a3` is pushed to the laptop WIP; its CI is `38510227430`. Isolated `.worktrees/logic-032` / `item2-map-logic-032` starts from that candidate, with root on regional work and the cloud on transitions. Reconcile the completed 0.3.1 release ancestor before releasing 0.3.2.
- Versioned 0.3.1 `index-CoeOhM3n.js`: build, 543 units (two existing todo), 21 desktop-host tests and the full GPU suite pass: **267 passed, 55 existing device skips, zero failures in 13.0 minutes**, completed by 04:34:54 UTC. The frozen 204-file manifest is unchanged after verification; the preview and verification browsers have exited. Initial sandbox-only unit environment failures are retained; unchanged tests passed with existing dependencies outside it. CI `38510870342` on `1c8d94a` passes typecheck/units/desktop checks and is still in browser checks. No source-release claim until current CI finishes and main is reconciled.
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

- **Framework release 7, "the land is one surface" (2026-10-19): four of your reports today land there (the Vallaki
  terrace with its diagonal edges, the Amber Temple and Tsolenka plateaus with no way between, "the whole world has
  cohesion issues", Yester Hill as a pyramid). May the cloud run release 7 next after 2f-1, with its questions 3 (ground-
  following levels; Yester Hill rebuilt as one sloped level), 9 (the grid fades out 40 ft past the rooms) and 10
  (outdoor levels reveal a 60-ft radius round the party) answered yes as recommended? It touches `worldland.ts` and
  `backdrop.ts`, which ChatGPT's item 2e branch also changes, so whoever merges second resolves, keeping both.
- **The valley's roads (2026-10-19, your screenshots):** may the cloud (a) re-digitise the region's roads and rivers
  in `world.json` as one connected graph through the places, with a test that keeps it so (claim on `world.json`,
  `barovia-world.py`, the test; the renderers unchanged except a guard against hooks), and (b) stop a map-open from
  counting as a party move and draw the trail along the roads (claim on `moveWorld` and `drawTrail`)? Each is one lean
  job; (a) first. Or leave both to ChatGPT's item 2e, where the road model is planned but not started.
- **CI flakiness (2026-10-19): may the cloud harden the three timing-sensitive checks in `e2e/world.spec.ts`** (the
  valley fit after a flight, the zoom-out chip, the names' clickable count; mechanisms in the 09:50 Status entry) as
  one bounded test-only job under a claim on that file, with no assertion loosened and each change proven by the
  same test passing on a deliberately slowed run? Until then a red duplicate run on a doc-only commit is noise when
  the same commit is green on the other branch, and the cloud says so in Status each time.
- Answered by the castle session's handoff (2026-10-18 21:08): the Castle Ravenloft brief is with that session
  (`castle-ravenloft-occ.md`, Matt has it); `docs/handoff/castle-playable.md` is what lives in the repository. Its open
  questions for Matt are listed in that file's "Co-working on item 2g" section, point 6.
- **The item 2f framework plan (`docs/MAPS-FRAMEWORK.md`, 2026-10-18) needs a go or no-go; its ten questions are
  answered when their release starts (recommended answers in Part A):** 1 the filmic tone curve on for every map
  (recommended: decide on release 2's pairs, default off); 2 players' unexplored outdoors shown as the hour's mist with
  silhouettes instead of black (yes); 3 ground-following levels, with Yester Hill rebuilt as one sloped level under a
  claim on its generator (yes, judged on a dev slope first); 4 rooms may be marked sealed on purpose, and which of K76,
  K41 and T2 are (allow the flag); 5 a room behind a locked door counts as reachable (yes, the lock listed); 6 adopt
  ChatGPT's integration branch early (no, unless ChatGPT asks); 7 version order (answered: item 7 is 0.3.2, ChatGPT's
  all-map release 0.3.3, the framework reserves no number); 8 a shadow-map spike for the Sheep Chase (skip); 9 the grid
  fades out 40 ft past the rooms instead of covering the valley (yes); 10 outdoor levels reveal a 60-ft radius round
  the party as well as the room (yes, outdoors only).
- (0.3.2 release review) The world map gives Mount Baratok's M2–M5 marks their own discs (32 pins) where the world-map step grouped that peak once (28); ChatGPT changed the assertion and disclosed it in the 0.3.0 known limits. Keep the five discs, or group the peak once as designed?
- Answered (Matt, 2026-10-18): the artifact must auto-update to match the desktop app window, so the desktop distribution tag is approved and every release goes to the main branch, the mistLAB link and a `desktop-v` tag from the same commit (cloud Status entry, 2026-10-18).
- Answered (Matt, 2026-10-14: "nah just go for it"): the additional targeted Amber hard-cut correction and verification are authorized despite the original final fix-pass limit. This does not authorize unrelated regional redesign, public compiled-bundle publication or wholesale item 7 resumption.
- Answered (Matt, 2026-10-14: "Every map's logic should be correct for 0.3.2"): ship the bounded local/compass/Amber corrections as 0.3.1 after release gates pass, with honest limits; then correct comprehensive all-map logic as 0.3.2 (queue item 2e). This includes the unresolved regional drainage/grades and J-to-K placement. Public desktop distribution still requires separate approval.
- Answered (Matt, 2026-10-13: "let it run"): the cloud routine stays on; the cloud finishes item 7 and verifies item 2.
- The cloud Claude session's check-in routine ("mistLAB queue check-in") fires every two hours and resumes its runs.
  If everything is meant to be paused, disable that routine (Claude app → Routines) or tell the cloud session to
  stop; otherwise it keeps working item 7 and item 2's world-map step alongside ChatGPT.
