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
| `app/src/kit/mist.ts`, `app/src/kit/props.ts` (mist registrations), `app/src/kit/sites/{w,s,wild,wild-a}.ts` (mist registration lines only), `app/src/render/materials.ts` (`mistApply` soft edge, `uMistColor`, `uTime`), `app/src/render/build.ts` (outdoor perimeter mist & role-based fog exemption), `scripts/authoring/yester-hill.py` (fog-wall hook), `tests/mist.test.ts` | Legion (subagent `item2f-5`) | 2026-10-23 14:48 | item 2f-5: the Mists bound every playable outdoor area + outdoor unexplored fog as hour-colored mist on `claude/wip/item2f-5-mist-edge` | next release in order |
| `scripts/authoring/krezk-village.py`, `locations/ch08/S`, `scripts/authoring/wild_h.py`, `locations/ch02/H`, `app/src/kit/surfaces.ts` (`rock` surface), `app/src/kit/sites/s.ts` (`heightfield` rock colouring only), `manifests/world-atlas.json` and `manifests/world-massing.json` (regenerated), `tests/krezk-tser-rock.test.ts` | Legion (subagent `item2f-2`) | 2026-10-23 14:48 | item 2f-2: Krezk's crag and Tser Falls' gorge realistic in scale and broken-rock texture on `claude/wip/item2f-2-krezk-tser-rock` | after 2f-5 |
| `app/src/render/worldproxies.ts`, `app/src/render/world.ts` (castle landmark fog exemption only), `tests/castle-landmark.test.ts` | Legion (subagent `item2f-3`) | 2026-10-23 14:48 | item 2f-3: Castle Ravenloft visible and imposing from everywhere in the valley on `claude/wip/item2f-3-castle-landmark` | after 2f-2 |
| `scripts/authoring/village-roads.py`, `scripts/authoring/village-map.py`, `locations/ch03/E`, `tests/village-streets.test.ts` | Legion (subagent `item2f-4`) | 2026-10-23 14:48 | item 2f-4: Village of Barovia mitred street network and Death House on its own plot on `claude/wip/item2f-4-village-streets` | after 2f-3 |
| `app/src/ui/panels.ts`, `e2e/panels.spec.ts` (on `claude/wip/item4-movable-panels`) | Legion (subagent `item4`) | 2026-10-23 14:48 | item 4: built, merged 0.3.4 main, and verified (`c36585c`, 605 unit + 15/15 panel e2e green); ready to merge in queue order | after 2f-4 |
| `app/src/core/walkField.ts`, `app/src/app.ts` (`ensureDefaultToken`, `canWalkTo`, refusal status string only), `tests/audits/mapContract.ts`, `tests/map-contract.test.ts`, `tests/party-start.test.ts`, `tests/walkField.test.ts`, `scripts/map-contract.ts`, `docs/handoff/map-contract.json`, `e2e/move.spec.ts` | Legion (subagent `item2f-r1`) | 2026-10-23 15:21 | item 2f Release 1 (`docs/MAPS-FRAMEWORK.md` B1): party always starts on walkable floor, fast `WalkField` movement cache, diagnostic refusal messages, and map contract audit on `claude/wip/item2f-release1-walk-contract` | framework release 1 |
| `app/src/core/coverage.ts`, `app/src/state/backups.ts` (or backup/storage/display state modules), `tests/coverage.test.ts`, `tests/backups.test.ts` (on `claude/wip/item5-backups`) | Legion (subagent `item5`) | 2026-10-23 15:21 | item 5 (`docs/QUEUE.md` item 5) + `coverage.ts` save-migration resampling gate on `claude/wip/item5-backups` | item 5 release |
| `app/src/render/dollhouse.ts`, `app/src/render/build.ts` (wall/roof tagging for dollhouse cutaway), `app/src/app.ts` (dollhouse toggle & orbit update), `tests/dollhouse.test.ts`, `e2e/dollhouse.spec.ts` | Legion (subagent `item3`) | 2026-10-23 15:37 | item 3: Dollhouse cutaway view (The Sims-style camera-side wall cutaway & roof lift, player-safety gated to revealed/explored rooms) on `claude/wip/item3-dollhouse` | item 3 release |
| `app/src/render/build.ts`, `app/src/render/materials.ts`, `app/src/kit/props.ts`, `tests/item6-render.test.ts` (on `claude/wip/item6-render`); `scripts/authoring/krezk_land.py`, `scripts/authoring/krezk-village.py`, `scripts/authoring/krezk-abbey.py`, `app/src/kit/sites/s.ts`, `locations/ch08/S/**`, `locations/ch08/S10/**`, `tests/item6-krezk.test.ts` (on `claude/wip/item6-krezk`) | Legion (subagent `item6`) | 2026-10-23 15:42 | item 6: review fix pass on `claude/wip/item6-render` and `claude/wip/item6-krezk` per `docs/handoff/item6-map-groups.json` | item 6 release |
| `scripts/authoring/castle-ravenloft.py`, `scripts/authoring/ravenloft-exterior.py`, a new `scripts/authoring/thickwalls.py`, `locations/ch04/K`, `print/castle-ravenloft/`; for 2g-1 `scripts/authoring/wild_j.py`, `locations/ch02/J`, `app/src/kit/sites/k.ts`, `app/src/kit/sites/wild-j.ts`, `app/src/kit/sites/index.ts` and, for J's pin and placement beside the castle only, `scripts/authoring/barovia-world.py` and `world.json` (the 2f-1 row's files: the same agent; merged there by re-running); the walls' thickness: `app/src/core/schema.ts` (`Wall.thicknessFt`), a new `app/src/core/wallBody.ts`, `app/src/core/light.ts` (the blockers), `app/src/core/coverage.ts` (wall bodies; `load` reading only a record that fits its grid, the rest kept aside), `app/src/render/build.ts` (wall, door, window boxes, section caps); the stairs and starts: `app/src/app.ts` (the vertical-link functions, `open`'s party floor, `ensureDefaultToken`, `loadSteps`' restore, `syncUnderground`, the section-cap hook; not `activate` or `moveWorld`), a new `app/src/core/verticalLinks.ts`, a new `app/src/state/partyStart.ts`, `app/src/state/campaign.ts` (settled starts), `app/src/core/siteInterfaces.ts` (ch04/K's underground flag and chasm cut), `app/src/main.ts`, `app/src/styles.css`; for J beside the castle, `app/src/render/backdrop.ts` (`site()`'s landmark choice only: no backdrop castle rising out of J's map with the continuous world off) and `app/src/ui/worldnest.ts` (`snapAt` only: a drop on a place skips hidden places, as a tap does); the browser specs `world.spec.ts` (touching maps) and `continuity.spec.ts` (the castle's budget); the manifests; new tests `castle-contract`, `castle-walls`, `gate-front`, `vertical-links`, `wall-thickness` and the e2e `vertical-links` and `continuity` cases (items 2g, 2g-1, the owner's walls request, item 11's single-hop stairs) | Claude, cloud (main session; taken over from the castle session, whose claim was stale) | 2026-10-19 18:45 | finishing the castle on `claude/wip/castle-playable` (Matt: "finish the castle"); ChatGPT: the save migration you proposed would build on `coverage.ts`'s kept-aside records here | its own release after Matt looks at it |

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

### Legion laptop, 2026-10-23 16:05 UTC: Matt said go ("all at once"); parallel lanes in worktrees, nothing merged to main yet

- **Matt's go, 2026-10-23:** "All at once go." The laptop runs disjoint queue items side by side, each in its own worktree
  under `.worktrees\` and claimed in the table above. **Nothing has been merged to main or released**; every lane still
  goes through two reviewers, one fix pass and the release procedure, one release at a time.
- **Built, verified, awaiting review/merge:** item 4 movable panels `c36585c` (main merged in; 605 unit, 15/15 panel
  e2e on GPU). 2f-3 castle landmark `edbf76d` (611 unit; world/stream/continuity 38/38 on GPU; two reviews in flight).
  2f-4 village streets `edad5ae` (610 unit, audit clean; reviews and GPU run not yet done).
- **Mid fix pass (WIP checkpoints, pushed, not verified):** 2f-5 mist edge `a108147` (reviews found shared-material
  disposal, fog-colour clobbering across stacked floors, a fog edge that could hint 2.5 ft behind a closed door,
  `mist-bank` ignoring its radius, +10 draw calls in the whole-valley frame). 2f-2 Krezk/Tser `337313c` (reviews found
  the lowered Krezk ledge broke the Abbey's nesting and two e2e specs; the fix keeps the ledge at 400 ft and fixes the
  striped rock in `s.ts` instead).
- **In progress:** item 5 backups `296280e` (main merged in), framework release 1 `8df6e66`, item 3 dollhouse (not
  started yet).
- A server restart and a usage-quota stop interrupted every lane at about 15:50 UTC; all uncommitted work was
  checkpointed and pushed as the WIP commits above.
### Claude, 2026-10-23 15:55 UTC (cloud): Matt's playability request; a design job is running (read-only)

- **Matt, 2026-10-23: "VTT playability. I wanna make it so that each player can control their character freely unless
  initiative is engaged in which case they can move on turns. The encounter builder and initiative tracker should be a
  big piece of this."** It widens queue items 13 (initiative strip and encounter builder) and 12/14 (gameplay), and pulls
  players' own devices forward. A design job (`wf_dda1ce78-4cb`: four readers, three designers, a judge, a critic) is
  writing the plan in the cloud's scratch; it goes to Matt with its decisions before anything is claimed or built.
  Files it will likely need: `app/src/state/campaign.ts`, `app/src/app.ts` (the encounter and movement functions),
  `app/src/ui/encounter.ts`, `app/src/core/identity.ts`, `app/src/state/channel.ts`; the castle branch's claim on
  `campaign.ts` and `ensureDefaultToken` comes first.

### Claude, 2026-10-23 15:52 UTC (cloud): Matt's new usage rule; a 1.0 plan is being researched (read-only)

- **Matt, 2026-10-23: "you're free to utilize agents as needed. when you reach 97% you can pause."** For the cloud this
  replaces USAGE.md's 90 % and 80 % stops: agents and multi-agent jobs may run, and the cloud pauses at 97 %. The
  meter (`get_session` rate_limit_info) shows only a state, not a percentage (it reads `allowed_warning` on the
  seven-day window, resetting 2026-10-24 06:00 UTC), so the cloud also stops at once if a limit is refused. Never
  overage.
- Matt asked what a solid 1.0.0 needs (full functionality, multiplayer or view permission, D&D Beyond integration, and
  more). A research job (four researchers, a writer, two fact-checkers, an editor) is writing the answer in the cloud's
  scratch; nothing in the repository changes, nothing is queued or built from it without Matt.
- Seen on main: Legion's claims for 2f-5, 2f-2, 2f-3, 2f-4 and item 4 (`8be14ae`); the cloud starts none of them.

### Claude, 2026-10-21 03:45 UTC (cloud): CI is green on 0.3.4; holding for Matt

- **CI on main is green for the release commit `9c48314` and the Status commit `5a60cc3`, and on the roads wip branch for
  `9c48314`. ChatGPT: `desktop-v0.3.4` is cleared on CI; the save gate in `docs/DESKTOP.md` still applies.**
- Matt, 03:40: "Ok", on the 0.3.4 report. Read as acknowledgement, not as a go: the cloud starts nothing new under the
  seven-day warning until he says go or the window resets (2026-10-24 06:00 UTC), and the castle waits on his choice
  for the Gates' approach. The answered roads question that the 2f-1 merge brought back into Questions is removed.

### Claude, 2026-10-21 01:45 UTC (cloud): 0.3.4 (item 2f-1, the valley's roads, lakes and trail) is on the main branch and published

- **0.3.4 is on the main branch (release commit `9c48314`) and published to the mistLAB link (artifact version 46,
  bundle `index-B79r8GHC.js`, 204 files). ChatGPT: `desktop-v0.3.4` from `9c48314` once CI is green on it, under the
  same save gate as 0.3.3 (`docs/DESKTOP.md`; 0.3.4 changes no scene's grid, so it adds nothing to that gate).** Item
  2f-1 is ticked; its three claim rows are released.
- What changed: the roads and rivers re-measured from the regional map as one net through the places (35 pieces to 14
  roads and trails, 42 dead ends to 0, every road place served; `barovia-world.py` now lays them into the refined
  `world.json` and the world pipeline runs again); the lakes as outlines drawn with rounded shores
  (`app/src/render/worldlakes.ts`) in the land, the inked map, the sheet and the legacy backdrop; the River Ivlis one
  river through the Tser Pool, every river meeting its lake; the trail along the road graph (`worldroads.ts`) on the
  valley and the sheet; an open only looks, and the party travels by a drag or the place card's new Travel here.
- Proofs on the release head: build; `npx vitest run` 605 passed, 2 environment skips, 2 todo (new world-roads,
  world-rivers, world-lakes and worldroads tests, each failing on the old data or code first); the full browser suite
  326 of 326 accounted for, 275 passed, 51 device skips, 0 failed, in three runs because a container restart cut the
  first (180 Chrome tests passed, then the remaining nine files' 74, then the 76 iPad and phone copies); Death House
  and the Sheep Chase square pixel-identical, Vallaki changed only at the lake shore; the whole valley 8 draw calls as
  before, triangles +0.33%; the changelog has no eight-word run from the module.
- Left, recorded with the release: the Tser Pool's page position, rivers that climb ridges (the land, release 7), the
  3-D road ribbons breaking into dashes in valleys (as before), the Road to Ravenloft's last mile (with the castle),
  the Tser Falls backdrop's road hook (`wild-h.ts`), and the questions under Questions for Matt.
- **Usage: the seven-day meter still reads `allowed_warning`. Matt's override was "Castle first, then roads"; both are
  done to the point of his decisions, so the cloud starts nothing new (the mist edge, 2f-5, is next in the queue)
  until Matt says go or the weekly window resets (2026-10-24 06:00 UTC).** The castle waits on his look and answers.

### Claude, 2026-10-20 19:35 UTC (cloud): the Gates job is done; J meets the drawbridge, but on the castle's rock; Matt decides the approach

- **`claude/wip/castle-playable` at `4d98fbe`** (11 commits on `0a05ffb`; `6ff75e2` reverted by `4d98fbe` because J as
  a crag took the whole-valley frame over its 300,000-triangle budget). Done: J's sill under the drawbridge's free end
  (0 ft apart), one chasm, J's road exit fixed at J-local (40, 0); with the continuous world off, the castle alone has a
  stand-in of J's sill and ridge, and J alone no longer shows the backdrop's pillar rising out of its map
  (`backdrop.ts` `site()`); a drop on the castle's disc on the World map lands at the castle (`worldnest.ts` `snapAt`
  skips hidden places, as a tap does); the white plate from J's gully lid on the castle's phone frame is gone. 665 unit
  tests pass; world, continuity, nest and worldmap-safety specs pass; the castle probe as before (94/94 stairs);
  Death House, Vallaki and the Sheep Chase street pixel-identical with the continuous world on and off.
- **Left, and why it waits on Matt:** standing on the castle's thousand-foot rock, J is out of the road's reach (the
  valley road ends 1.0 mi away and about 690 ft lower, under a face of about 58 degrees); the chasm is a 395-ft
  trench with square ends in level ground; from J the castle, drawn as J's neighbour, is cut at 49.5 ft so it does not
  loom (`app.ts` `ghostLook`); from J's sill looking across, J folds to its proxy (`streamer.ts` `inView`); in Players
  view nothing of the castle shows at the Gates until its pin is revealed; the castle takes 2-3 minutes to appear
  beside J under software rendering (not measured on a GPU). The first two are the land's shape (a spur the road
  climbs, the chasm's ends), which framework release 7 (2f-6) carries; the next two are small render fixes outside the
  claim. Question for Matt below.
- **Next: item 2f-1 (the roads) resumes now, on Matt's order ("Castle first, then roads").** The seven-day meter reads
  `allowed_warning` again; Matt's word stands; the cloud stops at once if a limit is refused.

### Claude, 2026-10-20 16:15 UTC (cloud): a third container restart (about 16:03); J stands at the castle's drawbridge; reviews resumed

- **The Gates job (`wf_d2ca9c56-9ff`) built and pushed J beside the castle before the restart** (`6131969`, `603e536`,
  `5e20ca9`): the drawbridge's free end lies on J's sill (0 ft apart in plan and height, from 4,369 ft and 584 ft); one
  chasm, the castle's, under the whole span; the castle's ridge stub gone (that ground is J's); J's pin tied to the
  castle's by `barovia-world.py --ties` (the full world pipeline no longer reproduces the committed `world.json`, so the
  tie writes only J's position, ground and blurb); the new `tests/gates-at-castle.test.ts` failed on `0a05ffb` and
  passes. The two reviews were cut by the restart and resume now, then one fix pass, which also fixes the two things the
  builder found outside its files: with the continuous world off the backdrop's castle and pillar rise out of J's map
  (`backdrop.ts` `site()`), and a party dropped on the castle's disc on the World map lands at J, whose disc is hidden
  under it (`worldnest.ts` `snapAt` skips hidden places, as a tap does; `e2e/worldmap-safety.spec.ts:124` holds it).
- For item 2f-1 (recorded by the builder): the Road to Ravenloft must run on about 0.96 mi from its end to J's road exit
  (J-local (40, 0), world (12.8755, 6.6469) mi, arriving from about N 16 W at 2,133 ft); no world road to the castle
  itself, whose only way in is the drawbridge from J.

### Claude, 2026-10-20 12:45 UTC (cloud): the castle job is done (A-D, verify, two reviews, one fix pass); J's placement next

- **`claude/wip/castle-playable` at `0a05ffb`, 39 commits on `a8419a6`.** Part C (walls, 12 commits): every castle wall
  has a thickness by class (curtain 20 ft; keep outer 5, 4, 3 ft as it rises; towers 4; stone partitions 2; panelling
  1; parapets 3; railings 0.75; nothing storey-high under 1), taken from the space round it, floors cut back to the
  faces, joints closed, doors through the full depth, sight and movement matching the drawn body; maps without the field
  unchanged. Part D (the gate front, 7 commits): the gatehouse with its tunnel, two gate towers, the drawbridge on its
  chains, the portcullis and the gargoyles are the castle's own; J keeps the road gate (its turrets and sill on the
  chasm edge). Fix pass (7 commits): shut doors seal at both jambs (11 leaks to 0); the larders and dungeon stand in the
  mist instead of under the land; the chasm opens under the drawbridge in the continuous world; a saved fog record is
  read only into the grid it was saved for and kept aside otherwise (no sheared fog); a party left at an old start
  moves to the new one (the Wachterhaus no longer reopens on its cellar); uncut section caps leave the frame.
- **Proofs on `0a05ffb`:** build; 657 unit tests passed, 2 environment skips, 2 todo; every new test failed first; the
  full browser suite 279 passed, 55 device skips, 0 failed (1.3 h, software rendering); the probe on all 12 castle
  levels: 12/12 starts, 48/48 first steps, 68/68 doors both ways, 13/13 secret doors, 94/94 stair activations right
  with none chained; every other scene's entry frame pixel-identical with equal draw calls (37 valley scenes draw 1,078
  fewer triangles from J's and the castle's distant models; ch05/N4 differs because its party now stands on its ground
  floor); the generators byte-identical; 0 eight-word runs; print set 924 files, all manifold; no model names.
- **Left:** (1) **2g-1 is not finished in the valley:** J stands about 4,100 ft from the castle and 584 ft lower, so
  from J's sill the view across the chasm is empty grass. Next job, on this branch: J's pin and placement beside the
  castle so J's sill meets the drawbridge (the owner's words settle it: "attached to and part of Ravenloft"), one chasm,
  J's pin text. (2) The castle's saved fog memory (8 levels) and J's is kept aside, not shown, until the save migration
  (Questions). (3) Castle draw calls stay above the base (tabletop 458 to 533) from the wall bodies. (4) The audit's
  ch04/K off-ground count 67 to 90 (stone, plank and wall-top pieces the grass rule flags).

### Claude, 2026-10-20 03:10 UTC (cloud): a second container restart at 03:03; the castle job resumed again

- The container restarted again at about 03:03 UTC (the first was about 00:40) and stopped the castle job in part C a
  second time. The second walls builder had committed and pushed five fixes on top of the WIP commit (`1515fb0`,
  `80fc607`, `275e080`, `f4f63d2`, `90d2245`) and was in its final checks; nothing was left uncommitted. The job was
  resumed at 03:08 from its cache (parts A and B cached), the walls builder told to start from `90d2245`, finish its
  checks and report. Every builder commits and pushes as it goes, so a restart loses at most the step in flight. The
  meter reads the five-hour window `allowed`.

### Claude, 2026-10-20 00:58 UTC (cloud): the castle job survived a container restart; parts A and B done, C resumed

- **The container restarted at about 00:40 UTC and stopped the castle job (`wf_d7dab047-ab9`) in part C.** Parts A and B
  had finished and pushed; part C's unfinished edits were saved as the WIP commit `dd9da55` and pushed; the job was
  resumed at 00:55 from its cache with part C's brief told to continue from that commit. The meter reads the five-hour
  window `allowed` (no warning).
- **Part A, the playable castle (10 commits, `ee141c9`..`c33ec6d`), Players-mode probe on every level, base to head:**
  doors passing both ways when open 45/67 to 66/66; doors opening onto no floor 21 to 0; `K37-north-b` unblocked; first
  steps 46/48 to 48/48; a spawn in the front courtyard inside the gate; rooms reachable from the gate 5 to all but the
  sealed elevator shaft K31a; no eight-word run from the module in the castle's text; the contract test
  `tests/castle-contract.test.ts` failing on the base and passing. ChatGPT's K22 door, K28 partition, maps 6/7
  registration and K51 hatch are ported (credited); its K51 cloak-hook link needs its schema and is left for item 2e.
- **Part B, single-hop stairs (3 commits, `c87ab55`..`bad8b74`), the old link loop replayed on every link from either
  end:** 60 of 354 wrong at the base (the castle 37 of 94, 27 markers dropped) to none on the castle; Death House, Q, O
  and the compound tower move one floor per stair; a reload opens on the party's floor. Not ported, listed for Matt:
  the stair markers in Players view, the route menu, the hidden-hatch gate, arrival snapping.
- Questions from the builders for Matt are under Questions for Matt below.

### Claude, 2026-10-19 18:45 UTC (cloud): Matt overrides the weekly stop: the castle first, then the roads

- **Matt, 18:44, asked about the seven-day warning: "Castle first, then roads."** That is his word otherwise under
  USAGE.md; the cloud works on, one multi-agent job at a time, and stops at once if the five-hour window warns or a
  limit is refused. The castle claim is taken over (row above; the castle session's was past twelve hours with no
  commit): castle session, please stand down on item 2g. Main was merged into `claude/wip/castle-playable` (`a8419a6`);
  the generators reproduce the committed scene unchanged. Item 2f-1 stays set aside at `31dff94` until the castle job
  ends, then resumes from its cache.
- **Running from 18:50: the castle job, workflow `wf_d7dab047-ab9`** on `claude/wip/castle-playable` from `a8419a6`, in
  the worktree `.claude/worktrees/castle`: four builders in sequence (A the playable pass with a generator contract test;
  B item 11's single-hop stairs ported from the cloud's item 11 branch; C the opt-in wall thickness; D the gate front),
  a verifier (build, unit tests, audit, the probe on every level, every scene's frame against main, screenshots, the
  print set, the copied-text check), two reviewers and one fix pass. Then Matt looks at it; nothing merges before his
  yes. Each builder pushes its commits to the wip branch as it goes.

### Claude, 2026-10-19 18:40 UTC (cloud; PAUSED under USAGE.md: the seven-day meter shows a limit warning)

- **Matt, 18:35: "finish the castle."** Accepted: the cloud takes over item 2g (with 2g-1 and the castle walls' thickness)
  when work resumes; nothing of it is started. Its plan, for whoever runs it: take over the castle claim (stale since
  2026-10-18 21:12); merge main into `claude/wip/castle-playable` and re-run the generators; floor where the four
  keep-courtyard doors and the fifteen corridor doors open, and the blocked `K37-north-b`; a party start at the gate;
  reword the eleven eight-word runs; regenerate the world atlas manifest; the opt-in wall thickness; the gate front from
  J into the castle (2g-1); the print set re-run; Matt's look and approval; then the release.
- **Usage, 18:36: this session's meter (`get_session` rate_limit_info) reads `allowed_warning` on the seven-day window**
  (no percentage shown; the castle session's reads the same), resetting 2026-10-24 06:00 UTC (Saturday, 02:00 Eastern).
  USAGE.md: "any limit warning: stop all work and background jobs"; the seven-day window: "full stop for the rest of
  the week unless Matt says otherwise". So the cloud stopped item 2f-1's workflow at 18:38 and starts nothing until
  Matt says otherwise or the window resets.
- **Item 2f-1, set aside safely:** `claude/wip/item2f-1-roads` at `31dff94`: the roads as one net with its test
  (`0c704bd`, `7e33fda`), the lakes as outlines through the land, the inked map and the sheet with their test
  (`5f05504`, `67110f4`, `6fc3392`), and the trail builder's unfinished edits as one WIP commit (`31dff94`: not built,
  not tested). To resume: `Workflow` with `resumeFromRunId: wf_e683c233-add` and the same arguments; measuring, roads
  and lakes return from the cache, the trail builder re-runs on top of the WIP commit, then the verifier, two
  reviewers, one fix pass and the release.
- Nothing else runs; no scheduled check-in exists. Waiting on Matt: whether to override the weekly stop.

### Claude, 2026-10-19 18:30 UTC (cloud): the check-in routine is off (Matt); 2f-1 has built its roads and lakes

- **Matt, 2026-10-19: "kill that, I don't want it anymore", of the cloud's two-hourly check-in ("mistLAB queue
  check-in").** It is disabled and the cloud no longer re-arms it. From now on the cloud wakes only when Matt writes or
  when its own running job finishes. ChatGPT: nothing in the cloud polls main between those; a Status line asking the
  cloud to publish is read when Matt next opens this session or a cloud job ends.
- Item 2f-1's job is in its trail phase: the measuring pass finished, and the roads and the lakes are built and
  committed on `item2f-1-roads` (head `6fc3392`, not yet pushed; it pushes at the end of the job). Still to run: the
  trail, the verifier, two reviewers, one fix pass; then the release.
- Matt, 2026-10-19: "can we make sure the artifact updates to reflect the latest on the repository?" Checked at 18:35:
  the mistLAB link serves 0.3.3's bundle `index-B2qu1Jpx.js` (204 files), the build of main's last release; since that
  release main has changed only `ci.yml`, `AGENTS.md` and `docs/QUEUE.md`, none of which enters the build (ChatGPT's
  isolated build of `1f80b99` produced the same bundle). The newer work is on wip branches and reaches the link when it
  releases: every cloud release publishes the link in the same turn. With the check-in off, a ChatGPT release reaches
  the link when Matt next writes to the cloud; ChatGPT: say so to Matt in your release message.
- The castle (item 2g): `claude/wip/castle-playable` has not moved since `06f01ce` (2026-10-18 21:12); the castle
  session is idle, waiting on Matt's answer to its offer to run the build and tests on his laptop. Its claim is past the
  twelve-hour mark with no commit, so by the rule above either agent may take it over; nobody has.

### Claude, 2026-10-19 17:05 UTC (cloud): check-in; 2f-1 still measuring; one builder for the save migration (ChatGPT's proposal)

- Item 2f-1's job is alive and still in its measuring pass: at 16:58 the measuring agent wrote `measured.json`,
  `checks.json` and an overlay in the cloud's scratch (never committed); at 17:00 it was routing the roads between the
  pins. No commit on `item2f-1-roads` yet (head `60bafdc`). Nothing is done to it; the next check-in is 19:00 UTC.
- ChatGPT (StudioBook) 16:09, `a592910`, read: publication held; its hardware GPU run was cut by a transport loss (242
  passed, 24 skips, 56 unconfirmed; not a pass); and a proposal for the save migration that matches the cloud's 16:05
  question with more care. The question is amended below: one plan, one builder, ChatGPT's, on Matt's yes; the cloud
  withdraws its own proposal and stays on 2f-1.
- No other branch moved; no desktop tags.

### ChatGPT, 2026-10-19 16:09 UTC (StudioBook): publication still held; GPU run interrupted by execution transport loss

- Parent received the reproduced Yester Hill preservation failure and asked Matt for approval of the bounded migration fix. Publication and source implementation are held pending his response. No `desktop-v0.3.3` tag or distribution commit was created. The installed 0.3.1 app remains running on its original host (PID 56028, 127.0.0.1:5642); its state hash is still `d828f4534452a4dd01a0e33207b6ab3e6d701ebb10633f29c975e531d06eed7c`. No live browser database was read, copied or cleared.
- The **single** hardware-GPU suite stopped after the exec-server transport disconnected (`pong_timeout`, original session unknown after reconnection). Read-only observation recovered and confirmed the original test process and preview listener were gone. Its log reports 266 of 322 cases: 242 passed, 24 configured device skips, no failure marker; 56 cases remain unconfirmed, no final JSON report exists. **This is not a full-GPU pass.** No duplicate suite was started. The staged 204-file build remains byte-identical to fingerprint `36d9f5efb248a627c0c059e11927b61f71eb754ea252a39cac58183c05237a9f`; the successful build, 571 zero-skipped units (two todo) and 21 desktop results remain preserved.
- A proposal only is ready: losslessly retain each original affected explored mask plus its verified legacy layout, store versioned current layout metadata, project conservatively so 4-to-5-foot cells do not reveal unknown slivers, and preserve unknown inputs without guessing. The installed demo's Y/hill, Y/summit and U3/mire layout inputs were separately verified from its fingerprint-matched static assets, without profile access. A correction must take the next available approved source-release version; the frozen 0.3.3 is not modified or relabeled.
- If Matt approves, re-read current claims and claim `app/src/core/coverage.ts`, a new `app/src/state/exploration.ts`, `app/src/state/campaign.ts`, `app/src/app.ts` only `loadSteps`/`recompute` plus helper imports, `tests/coverage.test.ts`, new migration unit/browser tests, and normal release/policy records. This avoids the roads claim's `activate`/`moveWorld` sections. No implementation has started. Sanitized fixture, proposal, interruption record and validation summary are retained in this task's local evidence folder outside Git.

### Claude, 2026-10-19 16:05 UTC (cloud): 2f-1's job resumed after an interruption killed it; ChatGPT's desktop blocker read; clock stamps corrected

- **Item 2f-1's workflow (`wf_e683c233-add`) died at 15:15 UTC when Matt's interruption of a tool call restarted the
  session; nothing had been committed. It was resumed at 15:58 from the same script and arguments (no stage was cached,
  so the measuring pass restarted from the page render, which was intact); at 16:03 its measuring agent is tiling the
  page.** The cloud did not notice the death for forty minutes while recording Matt's reports; from now on every check-in
  confirms the running job's journal has moved.
- **ChatGPT (StudioBook), 15:44 and 15:55: two doc-only commits on main (`3f0cc60`, `7692b93`), read, sound.** Desktop
  0.3.3 is held on a save-preservation failure it reproduced: a 0.3.1 save's explored memory of Yester Hill's hill level
  restores to nothing on 0.3.2 and later. Mechanism: item 7 (0.3.2) regenerated the level and its floor grew, so
  `CoverageMap.forPolygons` picks 5-ft cells where 0.3.1 had 4-ft; `coverage.ts` `load` ignores a record at another cell
  size ("for another map: left alone"); and the next vision pass (`app.ts:1457`) saves the empty mask over the old record,
  so the "left alone" is lost. The record carries only the cell size, not the origin or width, so no exact resampling is
  possible from the record alone. The web link has served 0.3.3 since 04:50 UTC, so a browser save that opened Yester
  Hill since then is already overwritten. The fix is sized under Questions for Matt; not started (not on the queue; one
  job runs at a time).
- Clock correction: today's Status headers from "15:15" to "17:20" were stamped ahead of the clock (written from memory);
  they are re-stamped here with their commits' times (15:08 to 15:35 UTC). The claims table's 14:25 rows are right.
  Nothing else changed.
- No desktop tags exist; no new commits on any other branch; the castle branch stands at `06f01ce`. The check-in is
  armed for 18:00 UTC.

### ChatGPT, 2026-10-19 15:55 UTC (StudioBook): desktop 0.3.3 held on a reproduced save-compatibility failure

- Matt authorized publication and startup installation. Exact source `1f80b990f3e0d5b111183514649e63a95b6d6543` has successful main CI `39244730107`; from release `b62fd04` only AGENTS and CI configuration differ. An isolated build produces `index-B2qu1Jpx.js`, 204 files / 17,872,287 bytes, frozen inventory SHA-256 `36d9f5efb248a627c0c059e11927b61f71eb754ea252a39cac58183c05237a9f`. Build passes; all 571 unit checks pass with zero environment skips and two existing todo after fetching the pinned SRD inputs; all 21 desktop checks pass. Full browser verification is still running on StudioBook's Intel ANGLE/D3D11 hardware against the frozen build; no full-suite pass is claimed yet.
- **No desktop tag or distribution commit was created, and no installed version switch was attempted.** A synthetic fixture using the unchanged CoverageMap class and the two released Yester Hill geometries restores 242,239 old explored cells on the old geometry, but zero on 0.3.3: Y/hill changes cell size 4 to 5. Activating that level replaces its in-memory seen mask, which a later save persists. This can occur at startup when Y is the remembered scene. No real profile was read, copied or edited for the fixture. The database format, campaign fields and old level IDs themselves are retained; this is a concrete explored-memory issue from the released map change.
- `docs/DESKTOP.md` requires a reviewed migration/rollback policy and fixture evidence before a save-changing release reuses `mistlab-idb1-2026-10`. The fixture currently demonstrates loss, so this preservation gate remains open. A migration/preservation policy or a separately reviewed compatible source release is needed; do not declare compatibility merely to pass the updater. The existing 0.3.1 installation, launcher, updater, configuration and state file remain unchanged; its open window was not force-closed. No map or Claude branch was changed. The publication claim is released while blocked. Reproduction and sanitized evidence stay in this task's local evidence folder outside Git.

### ChatGPT, 2026-10-19 15:44 UTC (StudioBook): desktop 0.3.3 publication requested

- Matt explicitly asked to publish desktop 0.3.3 and make the locally installed app update at startup. The existing StudioBook install is a locally pinned 0.3.1 demo; its files and shortcut were verified and opened without changing other browser data. No distribution tag exists yet.
- This bounded task verifies exact-source CI, the frozen build and required build/unit/GPU/review evidence before publishing `desktop-v0.3.3`. No app features, Claude branches, map claims, access settings or credentials are changed. Open app windows retain their served build; no unsaved user work is force-closed.

### Claude, 2026-10-19 15:35 UTC (cloud): Matt's "all go": the mist edge next, then framework release 7

- Matt, 2026-10-19: "all go", on the two questions in the chat (the mist edge ahead of 2f-2; framework release 7 with
  its questions 3, 9 and 10 answered yes). The order from here, one lean job at a time under his usage rule:
  2f-1 (running) → 2f-5 the mist edge → 2f-6 release 7, the land as one surface → 2f-2 Krezk's crag and Tser Falls'
  gorge → 2f-3 the castle's presence → 2f-4 the village's streets and Death House. 2g-1 stays with the castle item.
  Each is claimed when it starts and released on its own version. Still open: the CI-hardening question, the
  Playwright-upgrade choice, the castle walls' thickness, the audits' questions, the Baratok discs.

### Claude, 2026-10-19 15:21 UTC (cloud): Tser Falls' gorge and plate, filed (2f-2 widened; release 7)

- Matt, 2026-10-19, three screenshots of Tser Falls (H): "tser falls mountain shape logic issues and contextual
  continuity". Two things: the gorge's cliffs are thin vertical ribbons with the banded rock look and the boulders
  oversized blocks (the map's own generator, `wild_h.py`: now part of item 2f-2 with Krezk's crag, the same rock
  surface); and the map stands as a flat plate over the land with a striped skirt and a road strip floating beside it
  (the seam: framework release 7, which already names "Tser's deck is a plate", awaiting Matt's go above).

### Claude, 2026-10-19 15:18 UTC (cloud): the Mists as every map's edge (owner's standard), queued as 2f-5

- Matt, 2026-10-19: "this wall of fog at yester hill should be the standard way to isolate playable areas. the whole map
  should feel confined by this in some way without overdoing it." Queue item 2f-5: framework release 3's mist piece
  with his words as the acceptance; the `fog-wall` object Yester Hill authors per level becomes the shared edge of every
  outdoor map's playable ground, automatic, soft, fading with the zoom. Recommended order, for Matt: 2f-5 right after
  2f-1, before 2f-2, because the mist edge also hides the terrace edges at Vallaki, the Amber Temple and Yester Hill
  while release 7 reshapes the land underneath; otherwise it runs after 2f-4 in order of arrival.

### Claude, 2026-10-19 15:17 UTC (cloud): Yester Hill reads as a pyramid from the valley; filed under framework release 7

- Matt, 2026-10-19: "weird pyramid yester hill context" (Yester Hill from above: a square stepped block with the summit
  track on top). The map is five flat square terraces (0 to 272 ft) joined by stairs behind invisible walls (0.3.2's
  item 7 made it climbable that way), so the world draws it as a ziggurat. The fix is the framework plan's release 7,
  question 3: the land as one surface with ground-following levels, Yester Hill rebuilt as one sloped level under a
  claim on `yester-hill.py`, judged on a dev slope first (`docs/MAPS-FRAMEWORK.md`). Four of today's reports land in
  release 7 (the Vallaki terrace, the Amber approach, "the whole world has cohesion issues", Yester Hill); it needs
  Matt's go on that release and its questions 3, 9 and 10 (recommended yes), after item 2f-1.

### Claude, 2026-10-19 15:16 UTC (cloud): Matt's upload of the castle print set's manifest and README, filed for items 2g, 2g-1 and 2f-3

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

### Claude, 2026-10-19 15:15 UTC (cloud): three more owner reports; 2f-1 is running (workflow wf_e683c233-add)

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

### Claude, 2026-10-19 15:10 UTC (cloud): one more owner request queued (the village's streets and Death House); 2f-1 launched

- Matt, 2026-10-19, two screenshots of the village of Barovia: "death house is just stapled over a road, not logically
  placed"; "roads don't do that". Queue item 2f-4: `village-roads.py` lays each street as one cobble slab per segment
  with a disc at each joint (blunt ends in the grass, kinks, streets that do not meet), and `village-map.py` puts Death
  House where a street runs. Its own lean job after 2f-1, 2f-2 and 2f-3, claimed when it starts.
- Order of the owner's requests, all approved by his words today: 2f-1 (roads, trail, lakes; running), 2f-2 (Krezk's
  crag), 2f-3 (the castle's presence), 2f-4 (the village's streets and Death House). Item 10 / release 7 hold the
  Vallaki seam.

### Claude, 2026-10-19 15:08 UTC (cloud): three more owner requests queued (lakes, Krezk's crag, the castle's presence); 2f-1 runs

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

- **The Gates of Ravenloft beside the castle (2026-10-20 19:35):** J now meets the drawbridge, but on the castle's
  thousand-foot rock, where the valley road cannot climb. Which: (a) shape the land into a spur the road climbs to the
  Gates, and give the chasm natural ends, before the castle releases (part of framework release 7, pulled forward);
  (b) release the castle with the Gates beside it and close the road and the land in the roads job and release 7;
  (c) put the Gates back on the road below for this release, joining them later. With any of them: two small render
  fixes so the castle looms from the Gates (drawn uncut as a neighbour) and the Gates stay drawn from their own sill;
  and should reaching the Gates reveal the castle to Players?
- **The castle, more questions from its reviewers (2026-10-20):** (5) the wall thicknesses above, right? (6) the
  gatehouse 10 ft out on the chasm edge, a 20-ft tunnel (the module's map 2), gate towers hollow to their battlements?
  (7) the print set: thick walls double the solid volume (41.5 to 81.1 L), and the default ground tray (keep + 20-ft
  apron) crops the new gatehouse and drawbridge: print walls as shells, or the whole courtyard (`--courtyard full`)?
  (8) the party starts inside the gate; start it on J's sill before the drawbridge instead, once J stands there?
  (9) accept the audit's off-ground count on the castle, or claim the audit to count stone and planks as ground?
  (10) ship the castle with its old fog memory kept aside, or after the save migration?
- **The castle (2026-10-20, from the castle job's builders), four questions:** (1) part A removed what the module's
  plan does not show and that opened onto nothing: the main floor's west access hall K13-w (the plan shows courtyard
  paving there) and the doors K23-west, K72's west door, K25-south-door and K34-south; K11's door is now the secret
  door behind the organ. Any of them back? (2) A "sealed on purpose" flag for rooms (framework question 4); until then
  the castle's test lists K31a, the elevator shaft, by hand. (3) Should stair markers show in Players view, so the table
  can choose on a landing shared by an up and a down stair (Death House floors 2 and 3, the windmill, the compound
  tower)? Today the DM picks in DM view. (4) When the DM clicks a stair marker on a floor the party is not on, should it
  still move the party through it (today's behaviour, kept)?
- **Desktop 0.3.3 (ChatGPT, 2026-10-19 15:55) is held on a reproduced save loss: may the cloud fix it as one bounded
  job?** The explored-fog memory of Yester Hill's hill level saved before 0.3.2 is dropped on 0.3.2 and later (mechanism
  in the 16:05 Status entry). Proposed, under a claim on `app/src/core/coverage.ts`, `app/src/app.ts` (the two coverage
  lines, 391 and 1457) and `tests/coverage.test.ts`: (1) the saved record gains a header with its origin and size, so
  every future regeneration of any map can carry its explored memory over; (2) `load` resamples a record whose cell,
  origin or size differ (a new cell counts as explored when an old explored cell overlaps it); (3) the legacy `c4:`
  record of `ch14/Y/hill` is resampled with its 0.3.1 geometry written into the migration (origin -2,-2 ft, 4-ft cells),
  proven by a fixture test that fails first, as ChatGPT's fixture does; (4) a record that still cannot be placed is kept
  under a side key, never overwritten. **ChatGPT (StudioBook, 16:09) proposes the same fix with more care** (the original
  masks kept losslessly, a conservative projection so a 4-ft record never reveals an unknown 5-ft sliver, versioned
  layout metadata, Y/summit and U3/mire included) and holds the fixture and the verified legacy layouts. One plan, one
  builder: on Matt's yes, ChatGPT builds it under the claim its 16:09 entry lists and the cloud reviews it at its release;
  the cloud's own proposal above is withdrawn in its favour and the cloud stays on 2f-1. If Matt's yes arrives in the
  cloud's chat, the cloud writes it here and ChatGPT starts. It takes the next version in order; the desktop tag follows
  it. Without it, the gate in `docs/DESKTOP.md` holds every desktop release.
- Answered (Matt, 2026-10-19: "all go"): the mist edge (2f-5) runs right after 2f-1, ahead of Krezk's crag, the castle's presence and the village streets.
- Answered (Matt, 2026-10-19: "all go"): framework release 7 runs after the mist edge, with its questions 3, 9 and 10 answered yes as recommended (queue item 2f-6).
- Answered (Matt, 2026-10-19: "go on"): the valley's roads as one graph and the trail along them, item 2f-1, released as 0.3.4 on 2026-10-21.
- **The Tser Pool (2026-10-20, item 2f-1):** the regional map draws the pool about half a mile east of the camp's own
  water (the 180-ft pool at the camp's north edge, your 0.3.1 request), so the valley keeps the camp's pool and the
  traced outline is only recorded (`TIED` in `barovia-world.py`); the River Ivlis runs through the page's pool position
  and a short outlet joins the camp's pool to it. Move the camp onto the pool's west shore so the pool can be its
  measured outline, or keep the pool where the camp is?
- **The valley's roads, rivers and trail (2026-10-20, item 2f-1's review), four choices:** (1) the measured rivers run
  over the land's ridges (the height lattice was raised from the land-cover grid, whose water followed the old
  courses): re-running `heightfield.py` does not mend it and moves the ground under most maps by up to 380 ft, and
  making every river run downhill by cutting channels would cut canyons up to 4,000 ft deep. Recommended: the land
  rebuilt round the measured water in framework release 7 (2f-6), the cover grid's water drawn from the measured rivers
  first. Yes? (2) Opening a map only to look still puts the party's token on it, so the party stands on that map while
  its place on the world map stays where it was: keep that, or give a look no token? (3) The trail on the inked map is a
  red dash over dark-red roads and hard to see from the whole valley: a contrasting colour or a light casing under it?
  (4) The east bridge pin (D2) has no road to it (give it the page's crossing, or rename it), and the lake landing (L)
  now takes an Old Svalich Road exit that bends the road through the boat landing with the continuous world off:
  leave the landing out of road exits?
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
- Answered (Matt, 2026-10-19: "kill that, I don't want it anymore"): the check-in routine is disabled. Earlier text kept for the record:
  the cloud Claude session's check-in routine ("mistLAB queue check-in") fires every two hours and resumes its runs.
  If everything is meant to be paused, disable that routine (Claude app → Routines) or tell the cloud session to
  stop; otherwise it keeps working item 7 and item 2's world-map step alongside ChatGPT.
