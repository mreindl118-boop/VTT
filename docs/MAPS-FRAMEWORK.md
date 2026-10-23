# The general map improvement framework (queue item 2f): the final plan

Written 2026-10-18 by the cloud session, synthesised from three designs (visual first, the winner by the owner's lens;
logic first, the winner by the engineer's lens; incremental), two judges and four surveys (the pipeline, the movement
logic, the visual audits, ChatGPT's in-flight branches), all made in the session's scratch folder and not committed
(they can be added to `docs/handoff/` if Matt wants them). Main branch `claude/mistlab-curse-strahd-x6jm13` at
`0bab66f` (0.3.1), read only; nothing in the repo was changed or committed. ChatGPT's four branches are at their
2026-10-14 heads (`cc19ed5`, `8b0f149`, `bb018e9`, `4ae764c`), read with `git show` and `git diff` only.

Matt's words this plan answers: "Work on the general map improvement framework to increase visual quality and smooth
logic." "Yester Hill is flat. Fix that. The fog wall looks terrible, like cotton." "players can't move anywhere; door
logic is a good thing to have but it seems to be broken right now." The Abbey of Saint Markovia walled the party in on
Players mode. "building maps are cluttered."

The shape in one paragraph: **visual first, with the two engine fixes for "cannot move" pulled to the front.** Eight
small versioned releases, each on the lean setting (one builder or two on disjoint files, two reviewers, one fix pass,
the release procedure). Every release lifts all 46 maps at once; nothing is behind a per-map switch. The first six
releases are runtime-only (the renderer, the kit, a few lines of `app.ts` outside ChatGPT's hunks, new test files):
no generator runs, no scene regenerates, no file ChatGPT has changed is edited. The last two wait for ChatGPT's all-map logic
release (0.3.3; item 7 is 0.3.2) and then finish the logic track: the browser walks every map, the contract turns hard check by
check, and the one regeneration of all 44 scenes happens at an announced quiet moment with one command.

---

## Part A. For Matt: what you will see, release by release

Each row is one release with its own "What's new" card. Wall-clock is from the builder starting to the push, on the
lean setting, with the cloud running one release at a time; the laptop's GPU suite (13-15 min) is part of each release.
Releases 1-5 are each under a day. Dates assume the cloud starts on approval and ChatGPT's 0.3.3 lands when it lands.

| # | Release | What you will see | Where to look | Wall clock |
|---|---|---|---|---|
| 1 | **The party can always take its first step, and a step costs nothing** | Open the Abbey of Saint Markovia or the Sheep Chase square in Players view: the party token stands on the floor and can step in every open direction (today 0 of 4 moves on both). A tap on Yester Hill or Vallaki answers at once (today four taps on Yester Hill cost 43 seconds of CPU; on a phone that reads as "players can't move"). When a step is refused, the status says why: "a closed door", "the party is off the floor", "a window". The What's new card shows a number: how many map findings the new contract still records across all 44 maps, and it can only go down from here, release by release, as ChatGPT's per-map work lands. | Abbey (S10), the square (wsc/02-street), Yester Hill, Vallaki town, Death House, in Players view, on the phone | ~6.5 h |
| 2 | **Every map is lit by the sky, and the measuring tools are in** | Roofs have a lit side and a shaded side (the big roof on the square measures 1.09 lit/shaded today, 1.18 after; subtle but real at table zoom, strong when you lean in), walls a top and a bottom, a candle is yellow and a hearth orange, a stacked site lights only the floor you are on (Amber's 675 draw calls fall). Barovia stays grey and soft; no hard shadows. A filmic tone curve is built but **off**, behind a try-before-release address-bar switch (`?fx=tone:on`): you decide on the before/after pairs whether it goes on for every map (question 1 below). | The Sheep Chase square, the village, Death House, Blue Water Inn, Amber facade, Castle ground | ~6.5 h |
| 3 | **The Mists are mist, not cotton; players see mist, not black** | Yester Hill's fog wall is a soft, slow bank the colour of the hour, with no skyline through it; every other mist in the module (Krezk, the Abbey, Tsolenka, the chapter-2 Mists) is the same piece. On the players' side the unexplored hillside is lost in the Mists instead of a hard black wedge (today 7 % of the phone frame on Yester Hill, 21 % on the square), and an unexplored house outdoors is a grey mass with a roof, not a black box on the lawn. Interiors keep the dark fog. | Yester Hill DM and Players, Death House f1 Players on the phone, the square Players, Amber facade Players, Krezk | ~6.5 h |
| 4 | **The grid stays on the map, a town opens on its streets, pins fold away** | No grid running to the horizon on the village, Vallaki, Krezk or the Amber ledge; Vallaki opens framed on the town (today it frames the camp 2,500 ft away and shows the town as a sliver); on a building floor the pins fold to dots until you zoom in, never over a room name; players see no pins from across the room. This is the shared half of "building maps are cluttered". | The village, Vallaki town, Amber facade, Krezk, Yester Hill summit, Death House f1, Blue Water Inn, Tser deck | ~5.5 h |
| 5 | **Ground is ground, dark stone keeps its grain** | A field is not one flat green from edge to horizon; turf, earth and snow drift in tone; slopes shade by aspect; slate roofs and black boulders keep their texture; glass is glass; four colour collisions in the kit are fixed (a mist grey declared as metal, a wood declared as cloth). This is the already-reviewed item 6 render work from 3 October, ported. | The village, Vallaki, Krezk, Yester Hill, Amber, the square, Death House | ~5.5 h |
| 6 | **Towns and woods run light, trees and rocks have shapes** | Vallaki, Krezk and Yester Hill open faster and orbit smoother on the laptop and the iPad (Vallaki draws 1.41 M triangles today against a 300k budget; ceiling after: 600k; Death House in the nested world 399k, of which 228k is the valley drawn under the house, ceiling 300k). Pines, oaks, boulders, bushes, cairns and fences are reshaped in the same grammar. Nothing looks different where the party stands. From here every map has a hard per-map budget that no release may raise without saying so in What's new. | Vallaki, Yester Hill, Krezk, Tser Pool, the village, Death House nested, the square | ~6.5 h |
| 7 | **The land is one surface** (after ChatGPT's 0.3.2 lands, or its Status line on `worldland.ts`/`backdrop.ts`) | No step where a map meets its valley (Krezk's corner is 485 ft against -138 ft today, Tser's deck is a plate); hills shaded by aspect and altitude; a wood reads as a wood from above; mist pools in the low ground; water moves and has a shore. A dev slope (`dev/m1-slope`) shows a level that follows the ground: the party walks up a hill and the token rises, the cliff refuses without an invisible fence. **Yester Hill becomes a real hill when `yester-hill.py` is rebuilt on it: after 0.3.2 the hill is five flat terraces (0 to 272 ft) joined by stairs behind 120 invisible walls, and turning that into one sloped level is a rewrite of its generator, not one line; under the shared-maps rule the cloud claims `yester-hill.py` for that rewrite in this release unless ChatGPT's WEST-SITES lane already holds it** (question 3). | Tser Falls, Krezk, Amber, Vallaki and its lake, Yester Hill, the village, Tsolenka, the Sheep Chase road, `dev/m1-slope` | ~7 h |
| 8 | **Every map is checked before it ships** (after ChatGPT's 0.3.3) | The browser has walked every map in Players view: from the start, through every door both ways, every stair both directions, into every room it can reach; the ledger says which rooms are never reached and a release can only lower that number. A map where the party starts off the floor, a wall sits under a door, a stair lands in a wall, a room is sealed by accident or a level is buried **cannot be committed**: `npx vitest run` names the map and the check. The one regeneration of all 44 scenes happens here, at a quiet moment announced a day ahead, and your saved campaigns keep their open doors and explored cells. | All 44 maps; Death House, Vallaki, the square as the regression trio | ~6.5 h + the laptop's copied-text check |

Two tools you can use yourself from release 2 on: `?fx=<feature>:off` (or `:on` for something not yet on) in the
address bar turns one shared feature off or on for a look, on any map, on a branch build before anything is approved;
and every release's before/after pairs (desktop and phone, DM and Players) go to the Visual-Aide repository as today.

Death House, Vallaki town and the Sheep Chase square are checked side by side with the previous release every time.
Every release has a test that failed first, draw calls and frame time against the main branch, and no test is weakened.

### Questions only you can answer (asked when their release starts, not before; the recommended answer is in bold)

1. **Tone curve (release 2).** Should the filmic tone curve (roofs stop going black, snow stops burning out; the whole
   picture shifts slightly) go on for every map? It recompiles every shader once at load and re-pins every pixel test.
   **Recommended: decide on the release-2 pairs with `?fx=tone:on`; default no until you have seen it.** You did not
   ask for a global look change; the light rig alone gives most of the lift at zero cost.
2. **Players' fog outdoors as mist (release 3).** Outdoors by day, unexplored ground and buildings become the hour's
   mist grey with their silhouette (a house reads as a house the party has not entered). Interiors stay dark.
   **Recommended: yes.** It is the black wedge and the black box you saw; silhouettes of exteriors are not a secret.
3. **Ground-following levels (release 7).** A level may carry a coarse height grid (`level.relief`); tokens, markers,
   the grid and the camera follow it; a cliff blocks by grade without invisible walls. Yes means item 7's five-level
   Yester Hill (four 400-600 ft stairs behind 120 invisible walls) is rebuilt as one sloped level: a claimed rewrite
   of `yester-hill.py` (no map belongs to an agent; the cloud takes it in release 7 unless ChatGPT's WEST-SITES lane
   has a claim on it), regenerated and walked from the foot to the summit circle in Players view. **Recommended: yes,
   judged on `dev/m1-slope` first, then Yester Hill as the first production map in the same release, so your sentence
   is closed by the framework and not left for later.**
4. **Sealed rooms (release 8).** May a room be marked sealed on purpose, so the contract stops counting it? Which of
   K76, K41 and T2 are meant to be sealed? **Recommended: allow the flag; until you name them, the three stay in the
   ledger as findings, not failures.**
5. **Locked doors in reachability (release 8).** Is a room behind a locked door "reachable" (the party can find the
   key) or sealed? **Recommended: reachable, with the lock listed in the ledger.**
6. **Early adoption of ChatGPT's integration branch.** The cloud could release ChatGPT's already-reviewed shared engine
   pieces (`item2e-cloud-integration-032`: stairs land once, walls under doors refused by the library) ahead of its
   0.3.3, with its agreement in Status. **Recommended: no, unless ChatGPT asks for it in Status.** It leapfrogs its
   release, puts new wall-id rules on main while 33 maps carry old ids, and nothing in releases 1-6 needs it.
7. **Version order: answered** (the cloud's Status, 2026-10-18: item 7 is 0.3.2, in its browser suite now; ChatGPT's
   all-map logic release takes 0.3.3 and merges main after 0.3.2). The framework reserves no number: release 1 takes
   the next free number after whatever is on main when it ships, and the later release always merges the earlier.
8. **Shadow map for the Sheep Chase.** The live probe drew no shadow (92 casters, map allocated, zero shadow draws)
   and STYLE.md says Barovia has no hard shadows. **Recommended: skip; a 1.5 h spike only if you want sunny Sheep
   Chase shadows later.**
9. **The grid beyond the rooms (release 4).** 0.3.1 decided that "the ground outside the floor polygons carries the
   grid" (`e2e/grid.spec.ts:24`). Release 4 keeps the grid on the map's own ground and fades it out 40 ft past the
   rooms, so it no longer nets the valley on the village, Vallaki, Krezk and Amber. **Recommended: yes; a level that
   sets `clipToFloors` keeps its exact clip.**
10. **What a step reveals outdoors (release 1).** A move reveals the room the party enters and nothing else; on a
   street or a road that is floor but no room the party stands on unexplored ground for good. Should an outdoor level
   reveal a radius round the party (60 ft, the module's daylight sight in the mists) as well as the room? **Recommended:
   yes, outdoors only; interiors keep room-by-room reveal.** The reveal code (`afterPartyMove`, 1365-1382) is inside
   ChatGPT's `app.ts` hunk, so a yes lands in release 8 after the merge; release 1 only counts the cells.

---

## Part B. For the builders

### B0. The rules every release follows

- The lean setting: one builder (or two on disjoint files), two reviewers in parallel with the lenses named per step,
  at most one fix pass, then the release procedure in `AGENTS.md` (merge main with a merge commit, bump
  `package.json`/`package-lock.json` to the next version in release order, dated plain-words `docs/CHANGELOG.md`
  entry at the top, version in Help, tick the 2f sub-item in `docs/QUEUE.md`, row in `docs/HANDOFF.md`,
  `npm run build`, `npx vitest run`, the browser suite on the laptop GPU, push main; the cloud publishes the link,
  the desktop tag and the pairs to Visual-Aide).
- Every fix has a test that failed first. No test is loosened, skipped or deleted; a pixel baseline is re-pinned only
  by a release whose changelog line says so.
- Branch per release: `claude/wip/item2f-<n>-<name>`, pushed as progress is made.
- **Reviewer (b)'s mechanical check, every release:** `git diff claude/mistlab-curse-strahd-x6jm13...origin/claude/wip/<branch>`
  for each of ChatGPT's four branches (`item2e-map-logic-laptop`, `item2e-coverage-audit-032`,
  `item2e-cloud-integration-032`, `item11-vertical-transitions-cloud`) on every shared file the release touches:
  **zero overlapping hunks**, or the release does not ship. ChatGPT's hunks today: `app.ts` at 7, 29, 204-207,
  287-300, 296-310, 375-391, 397-431, 418-431, **874-886 (`open()`: the level-choice line)**, 1334-1382 (`takeLink`,
  `afterPartyMove`), 1468, 1504-1520, **1551-1565 (`declutter`: the `PRI` line)**, 1769, **2026 (`moveTokenTo`)**;
  `movement.ts` lines 2-23 (`CONTACT_EPS`, `onSegment`, `crosses`); `worldland.ts` `LandField.height` and
  `flattenInner`; `schema.ts` `LinkEndpoint.hiddenObjectId`/`validateScene`; `build.ts` `LabelSpec`; `main.ts` +9;
  `authorlib.py` `unit_edges`/`_wall_intervals`/`build_walls`; `state/*`.
- **The base is main after item 7's 0.3.2, not `0bab66f`.** Item 7 (`claude/wip/item7-unfinished-maps`, merged head
  `fd65aea`, in its browser suite on 2026-10-18) lands before any framework release and changes files this plan edits:
  `movement.ts` 22-54 (`canWalk`'s lattice becomes lazy: `known`/`ok(n)`, so the whole function is a hunk),
  `gridOverlay.ts` (a per-level `clip` flag beside main's `clipToFloors`), `schema.ts` (`GridLevel.clip`),
  `backdrop.ts` (`landHole`/`underBox`/`cutLand`), `app.ts` (`groundFt`, `belowGround`, the `cutLand` call near 653),
  `w.ts` (+287: `fogWall` is already a bank of sheets with per-vertex alpha, registered at `w.ts:647`), `t.ts`, `u.ts`,
  `authorlib.py` (+22), and regenerates X, Y, U, U3, V, W (Y becomes five flat levels at 0 / 94.5 / 178.1 / 254.5 /
  272 ft with 120 invisible walls on `hill` and one `fog-wall` per level). Every framework branch is made from main
  once 0.3.2 is on it; reviewer (b)'s diff check also lists item 7's files until then; every number in Part G for Y
  and X (659k triangles, 675 calls, 7.2 % black, 43 s per four taps, ~4,800 fog triangles) is re-measured by
  release 2's harness before it is written into a ledger, a threshold or a changelog line.
- **Neutrality, every release that claims not to change a map:** `e2e/neutral.spec.ts` (from release 2) opens the
  nine neutrality maps (Death House f1, Vallaki N town, the Sheep Chase square, Yester Hill hill, Amber facade, the
  Abbey ground, Krezk, the village, Tser Falls) with `?t=0` (frozen `World.clockSeconds`) and `?fx=<new>:off`,
  `frameLevel('tabletop')`, `renderNow()`, and asserts `renderer.info` calls/triangles/programs equal
  `e2e/baselines/render-counts.json` and **zero differing pixels** against the previous build's snap (the existing
  `snap`/`diff` helpers in `e2e/helpers.ts` with tolerance 0 for this spec). Verified feasible: two loads of the same
  build differ in 0 of 1,049,088 pixels on this machine. Shader toggles are **uniforms, never defines**, so no program
  recompiles across resident maps and the shader-text snapshot of the unchanged branches stays byte-identical.
- **Pairs, every release:** `scripts/shots/pair.mjs` (new in release 2) serves main and the branch on two ports
  and writes `<map>-<view>-<size>-before.png`/`-after.png` for the judged maps at 1366x768 and 390x844, DM and Players,
  into `test-results/pairs/` (gitignored, never committed); it seeds `localStorage mistlab.seenVersion` so the What's
  new card does not cover the frame (the owner judge's probe shots were covered). Reviewers look at the pairs.
- **The kill switch:** `app/src/core/fx.ts` (new, release 2) reads `?fx=a:on,b:off` once, the `nestedPref()` pattern
  (`app.ts` 67-72, outside ChatGPT's hunks), exposed as `__mistlab.fx`. Dev-only, read once, never a per-map sidecar
  file. Every shared feature from release 2 on has a name there so Matt can A/B it on any map.
- Browser work on the shared cloud machine (4 cores, another run alongside) is serial and short: the judged maps plus
  the regression trio. The browser suite gates every release: on the laptop GPU when the laptop runs the release, on CI's
  `npm run test:e2e` plus the cloud's own SwiftShader run when the cloud does (as item 7's 0.3.2 is gated today); the
  frame times in a changelog come from a GPU run when there is one.

### B1. Release 1: the party can always take its first step, and a step costs nothing

Two builders on disjoint files (engine; contract), one review.

**What (1a, engine).**
- `app.ts ensureDefaultToken()` (lines 1172-1189; no ChatGPT hunk): if the chosen cell is off every floor polygon of
  its level, search the 2.5-ft lattice outward from the authored point for the nearest floor cell reachable without
  crossing a blocking wall, place the party there and reveal its room. The search prefers, in order, a cell in the room the authored point lies
  in or is nearest to, then outdoor terrain floor, then any floor; it never settles in a room whose every boundary
  edge is a closed wall or door (a shop interior passes "one move allowed" and still traps the party), and a fallback
  farther than 100 ft from the authored point is reported in the status, not silent. The same fallback runs on load
  for a saved party whose cell is off every floor (Matt's existing campaigns on S10 and the square otherwise keep the
  symptom). Outdoors, `afterPartyMove` reveals only the room the party stands in (`roomAt`, line 1382; there is no
  vision-radius reveal), so a party on floor that is no room (a street made floor by `outdoor_floor()`, the Abbey
  road) stands on unexplored ground for ever: the contract's `floor-has-room` check counts those cells, and
  question 10 asks whether outdoor levels should reveal by radius. Door logic untouched. The contract (1b) still
  flags the authored spawn, so the fallback hides nothing. **Not in this release:** "open() shows the party's level
  when `scene.entry` disagrees" (K opens on the courtyard with the party in the dungeon; N4 likewise): that line is
  inside ChatGPT's `open()` hunk at 874-886, whose `savedLevel` change already covers the DM case; it lands with
  release 8 after the merge.
- New `app/src/core/walkField.ts`: a `WalkField` object with `canWalk(from, to)` and `invalidate()`, built once per
  (level id, floor polygons, wall-state hash: doors open, secrets revealed) and cached; the BFS bounded to a window
  around `from` and `to` plus a margin with the full lattice as the fallback; `attach` joins a point to a node only
  when the straight step between them is on the floor (G04, approved under item 14). It carries its own lattice and
  step test (about 40 lines) rather than editing `movement.ts`, whose lines 2-23 are ChatGPT's hunk (`canWalk` starts
  at line 17 of 57). An equivalence test pins it to `canWalk`'s verdicts; when ChatGPT's `CONTACT_EPS` lands in 0.3.3,
  `walkField` adopts it in release 8. `app.ts canWalkTo` (line 1657, clear of hunks) uses the field; the "No way
  through" status names the cause: the nearest closed door, "the party is off the floor", or the wall kind (window,
  railing, invisible).

**What (1b, the contract in report mode).** One pure checker `tests/audits/mapContract.ts` that loads `scene.json`,
`grid.json` and the atlas and runs the real engine (`core/movement.ts canWalk` read-only, `core/light.ts
moveBlockers`, `core/grid.ts` snapping with the level's origin, `core/geometry.ts`). Nine checks now, named so the
failure reads like the owner's sentence, with today's counts from `survey_logic.py`:

| check | asserts | fails on main today |
|---|---|---|
| `start-on-floor` | the authored spawn (or `rooms[0]`'s centre) snapped with the level's grid origin and grid kind (`ch02/C` is the one hex map) lies on a floor polygon and has one allowed 5-ft move in Players rules | S10, wsc/02-street |
| `entry-matches-start` | `scene.entry` is the level the party starts on | K, N4 |
| `spawn-declared` | every scene has a `spawn` object | 23 scenes |
| `floor-covers-ground` | on an outdoor level the floor covers the drawn walkable terrain minus solid footprints | wsc, S10, wildlib sites that used `self.walk` |
| `no-wall-over-door` | no blocking wall collinear over a door, secret door or window segment | 32 doors on E5, K, N2, N3, N4, N6 |
| `room-reachable` | every room has a passable boundary edge or a link endpoint inside, unless `sealed: true` (schema field added in release 8) | 58 rooms |
| `level-connected` | a walk from the start or any link endpoint, doors passable, reaches every room not sealed | the Castle gate, N1's church |
| `link-on-floor` | both endpoints and their snapped cells are on their level's floor with one reversible departure; co-located endpoints within 5.5 ft listed | 24 arrivals, 10 trapped, 75 co-located |
| `polygons-valid` | every room, floor and terrain polygon is simple, closed, no repeated vertices, no self-intersection | 25 polygons on 8 maps |
| `floor-has-room` | on an outdoor level every floor cell lies inside some room, because a move reveals rooms only (`roomAt`) and a cell outside every room stays unexplored under the party | the square's ring road and S10's road (both after `outdoor_floor()`), wildlib sites whose floor is the whole rectangle; counted on the first run |

The eleventh check, `level-not-buried`, needs `LandField` (in `worldland.ts`, which imports three.js and which ChatGPT's
`b461609` changed): it lands in release 8 after the merge, with the pure height function split into `core/landfield.ts`.

**The ledger rule.** `docs/handoff/map-contract.json` holds, per map and check, the count at the release. One `it()`
per map (a slow map cannot fail the file). The test fails when any count rises or a check at zero gains a finding;
`--update` rewrites the ledger and the diff is reviewed. A check whose count is zero on every map becomes a hard failure
with no ledger entry (release 8 onward). ChatGPT may lower a row when its fix lands, never raise one. The count goes
into What's new. Also `node --experimental-strip-types scripts/map-contract.ts <scene dir>` for any author right after
writing.

**Files.** 1a: `app/src/app.ts` (`ensureDefaultToken`, `canWalkTo`, the status string only), new
`app/src/core/walkField.ts`, `tests/movement.test.ts` (additive cases), new `tests/party-start.test.ts`,
`tests/walkField.test.ts`, `e2e/move.spec.ts` (two cases). 1b: new `tests/audits/mapContract.ts`,
`tests/map-contract.test.ts`, `scripts/map-contract.ts`, `docs/handoff/map-contract.json`,
`tests/fixtures/contract/*` (one small scene per check).

**Tests that fail first.** `tests/party-start.test.ts` over the real `ch08/S10` and `wsc/02-street` data: the start
cell is on the floor, one move is allowed in Players rules, and from that cell, doors as authored, the walk reaches a
second room or a link (a fallback into a sealed room fails the test) (fails on main). `tests/walkField.test.ts`: verdicts equal
`canWalk` on 2,000 random moves over ten maps; the G04 gap case (two floors 4 ft apart, no floor between: refused;
`canWalk` allows it today); open a door and the same query flips; a move on the Vallaki town floor (7,100 x 3,500 ft,
300 polygons) under 50 ms warm and 500 ms cold (today 1.5 M nodes per call). `e2e/move.spec.ts`: one Players-view
first step on the Abbey and on the square (0 of 4 today). `tests/map-contract.test.ts` red on about 12 maps with an
empty ledger, green against the recorded one; each fixture fails its check.

**Maps judged.** S10 and the square in Players view on the phone (the owner's two sentences); Yester Hill and Vallaki
town (tap latency: 43,489 ms for four `canWalkTo` calls on Y today); Death House and `dev/m0-test-room` (every existing
movement test); the regression trio.

**Review lenses.** (a) the owner's ask on the five maps in the running app, desktop and phone, DM and Players; (b)
reviewer (b)'s diff check, draw calls unchanged (this release draws nothing new), vitest, the e2e suite.

**Changelog line.** "The party always starts on a floor it can leave, a move on a big map is instant, and when a step
is refused the status says why. Every map is now checked against a contract: N findings remain across M maps, and that
number can only fall."

### B2. Release 2: the light rig, and the measuring tools

Two builders on disjoint files (rig; harness), one review.

**What (2a, rig).** `app/src/render/world.ts setWorkLight`: the DM work light moves from the hemisphere into the key
(today hemi `base + 1.8k`, key `base + 0.6k`: DM hemi 3.8 vs key 1.45; after: hemi 1.4 / key 3.8, measured live: roof
faces 73/62, ratio 1.09 -> 1.18 at 90 draws both times); `setSky` indoor key from the map's north-west instead of a
fixed (-40, 90, 50); `app/src/core/sky.ts skyAt` presets rebalanced the same way for gothic and pastoral (same totals;
"Barovia dreary at noon, the Sheep Chase bright" test stays). `build.ts`: `PointLight` colour from `l.preset` (candle,
torch, hearth, green flame); lamps grouped per level and `padLamps` keeps the shown level's and its neighbours' (Castle
27 lamps, Amber 20 on one level: 675 calls). Tone mapping (ACESFilmic or AgX, exposure ~0.95) is built behind
`fx.tone`, **default off**, with the `mistApply`/`cartoWash` hook moved from after `<opaque_fragment>` to after
`<colorspace_fragment>` so fog-of-war and the inked wash never pass through a tone curve (that move is harmless with
tone off and is what lets Matt try it). No shadow map.

**What (2b, harness).** `app/src/core/fx.ts` and `?t=0` (`World.clockSeconds` pinned); `e2e/look.spec.ts`: twelve
reference frames (Death House f1 DM and Players, desktop and phone; Vallaki town; the Blue Water Inn; the village;
Krezk; Tser deck; Yester Hill hill DM and Players; Amber facade; the square), screenshots to `test-results/`, per frame:
draw calls, triangles, programs, roof-face ratio, ground value spread, fraction of fog-colour pixels in Players view,
largest luminance step across the mist bank's edge, into `docs/handoff/look-baselines.json` (re-pinned only by a
changelog line). `e2e/counts.spec.ts`: `renderer.info` after `frameLevel('tabletop')` on all 44 scenes in DM view,
recorded now into `e2e/baselines/render-counts.json` (asserted +-5 % from release 6 with the ceilings; serial, desktop,
about 10 min on SwiftShader, 3 on the laptop GPU). `e2e/neutral.spec.ts` and `scripts/shots/pair.mjs` as in B0.

**Files.** 2a: `app/src/render/world.ts`, `app/src/core/sky.ts`, `app/src/render/materials.ts` (hook position,
`uTone` uniform), `app/src/render/build.ts` (lamp colour, lamps per level; not the `LabelSpec` lines), `manifests/
campaigns.json` theme block, `docs/STYLE.md` (the light rule in words), `tests/sky.test.ts`. 2b: new
`app/src/core/fx.ts`, `app/src/app.ts` (one read next to `nestedPref`, lines 67-72), `app/src/render/world.ts`
(`clockSeconds`), new `e2e/look.spec.ts`, `e2e/counts.spec.ts`, `e2e/neutral.spec.ts`, `e2e/baselines/render-counts.json`,
`docs/handoff/look-baselines.json`, `scripts/shots/pair.mjs`.

**Tests that fail first.** `e2e/look.spec.ts`: lit/shaded roof-face ratio >= 1.18 on the square and the village (1.09
today); Death House f1 Players: the unexplored house is exactly the fog colour (pins the hook move); Amber facade: draw
calls <= 300 (675 today). `tests/sky.test.ts`: "the key outshines the hemisphere by day in both styles". `e2e/
slider.spec.ts` (secret door pixel-identical to wall at t = 0) and `e2e/world.spec.ts` (placed vs unplaced) are relative
checks and pass unchanged. `neutral.spec.ts` with `?fx=light:off`: zero pixels on the nine maps (the first use of the
harness is its own acceptance).

**Maps judged.** The square, the village (E), Death House f1 (DM and Players, desktop and phone), the Blue Water Inn,
Amber facade (lamps), Castle ground (lamps per level); the regression trio side by side with main.

**Review lenses.** (a) look: the twelve frames and the pairs, desktop and phone, DM and Players, looked at; (b) cost
and boundary: draw calls and triangles unchanged within 1 % except Amber's and the Castle's (which fall), programs
stable after warm-up, reviewer (b)'s diff check, vitest and the pixel suites.

**Changelog line.** "Maps are lit by the sky, not a flat glow: roofs have a lit and a shaded side, lamps take the colour
of their flame, a stacked site lights only the floor you are on."

### B3. Release 3: one mist piece, and fog of war that reads as mist

**What.** New `app/src/kit/mist.ts`: one shared piece built from the best of today's seven (`kit/sites/wild.ts
mistBody`: lit, transparent, ragged sheets, curtains, wisps), per-vertex alpha so every sheet fades to nothing at its
edges and at the ground, `uMistColor` from the hour next to `fogUniforms`, depth write off, a slow drift from `uTime`
(`World.clockSeconds`; frozen by `?t=0`), `renderOrder 2` so it veils the grid, fog-of-war exempt (`matClone(c, true)`),
three modes `bank` (low drift), `wall` (tall, back sheets dense to the eye line so the skyline behind is hidden: item 7
open #7), `wisp`. Registered for the kinds `mist`, `mist-bank`, `mist-wall`, `fog-wall`, so Yester Hill, Krezk, the
Abbey, Tsolenka and the chapter-2 Mists change **without their generators changing**; the four site modules that
register those kinds (`w.ts:647` on 0.3.2, `'fog-wall': once('fog-wall', fogWall)`, where item 7's `fogWall` is
already eleven sheets with per-vertex alpha up to 950 ft, costing 25-40 % of the hill frame; `s.ts:579 'mist-bank':
mistBank`; `wild.ts mist`; `wild-a.ts mistWall`) keep their functions but their registration lines point at the kit (four one-line edits, announced in
Status). The chasm fog in `props.ts` (a raw `MeshBasicMaterial`, a kit exception to the materials rule) folds into the
piece. Budget: a 180-ft `fog-wall` piece <= 600 triangles (today ~4,800 opaque icosahedron puffs).

Fog of war in the open: `materials.ts mistApply` takes four taps over the coverage texture at +-1.5 cells and a
smoothstep instead of `step(0.75, cov)`, and outdoors by day the unexplored colour is the hour's mist grey-violet
(`app.ts applySky`, line 1706, clear of hunks, feeds `uFogColor`/`uMistColor`) instead of page black (`#16151a`).
Interiors keep the dark fog. "Outdoors" is the rule `app.ts:846` already uses for the mist (the first level with terrain,
`ambient !== 'darkness'`), applied per level that has terrain: on such a level everything unexplored, the inside of a
house included, turns the hour's grey; a level without terrain (f2, a cellar, a dungeon) keeps `#16151a`. The soft edge
leaks nothing: the four taps are over the coverage texture, not the colour, so a cell one or more cells from any
explored cell is exactly the fog colour (asserted in `e2e/look.spec.ts` on Death House f1 behind the closed main-hall
door, and on the square behind a closed shop door). The exemption rule ("backdrop, context, landform and mist pieces
are never darkened; buildings and props are") moves from each site module into `build.ts`, by role, and
`tests/kinds.test.ts` fails on any `matClone(c, true)` outside `build.ts` and the kit, so no map decides its own
players' fog again (Yester Hill on 0.3.2 exempts all its scenery, the village exempts none: today the rule is per site). Both behind `fx.mist` and `fx.fogsoft` as kill switches (uniforms).

**Files.** New `app/src/kit/mist.ts`; `app/src/kit/props.ts` (register the kinds, chasm fog), `app/src/kit/sites/
{w,s,wild,wild-a}.ts` (registration lines only), `app/src/render/materials.ts` (`mistApply` soft edge, `uMistColor`,
`uTime`), `app/src/render/world.ts` (`renderNow` advances `uTime`, invalidates at a low rate while mist is in frame),
`app/src/app.ts` (`applySky` only), `app/src/render/build.ts` (exempt by role; not `LabelSpec`), new `tests/mist.test.ts`.

**Tests that fail first.** `tests/mist.test.ts`: every registered mist kind builds through `mat`/`matClone` (no raw
material), is transparent with depth write off and the exempt flag, and a 180-ft `fog-wall` is <= 600 triangles (fails
at ~4,800 on main's puffs; against item 7's sheets the cap is set from their measured count, and the tests that fail
first on Y are the skyline, the hard edge and the frame cost item 7 left open). `tests/kinds.test.ts`: every fog kind in every scene resolves to the shared piece. `e2e/look.spec.ts`:
Yester Hill Players: pixels at the page-black fog colour < 2 % of the frame (the wedge is ~7-12 % today) and the largest
luminance step across the mist bank's edge < 40 (a hard white edge today); Death House f1 Players: the unexplored house
is the mist grey and its roof silhouette's two faces differ; the hill level's triangle count falls in `counts.spec.ts`.
`e2e/players-sweep.spec.ts` and `tests/player-safety.test.ts` unchanged (players never read a DM thing).
`neutral.spec.ts` with `?fx=mist:off,fogsoft:off`: zero pixels.

**Maps judged.** Yester Hill (hill, summit; DM and Players; desktop and phone), Krezk and the Abbey (`mist-bank`),
Tsolenka, the chapter-2 Mists (A, B, I, L), Death House f1 Players on the phone, the square Players on the phone (21 %
near-black today), Amber facade Players (a grey mass, not a black wall).

**Review lenses.** (a) the owner's two sentences on the pairs; (b) budget (the hill level falls), player safety specs,
reviewer (b)'s diff check (the four registration lines are in per-site files: announced, not ChatGPT's hunks).

**Changelog line.** "The Mists are mist: soft, slow, coloured by the hour, never cotton. What the party has not explored
outdoors is lost in the mist instead of painted black."

### B4. Release 4: the grid stays on the map, the camera frames the town, pins fold away

**What.** (a) `app/src/render/gridOverlay.ts buildGridOverlay` (line 105: `pad = ground ? max(30, 0.12 * extent)`):
the DM grid is clipped to the union of the level's floor polygons with a 40-ft feather past the **rooms'** bounding box,
not the terrain's; it fades to 15 % when a foot is under a pixel; the 100/500-ft orders lightened. Both already written
on `claude/wip/item8-natural-land` (`uBounds`, `zoomFade`) and `claude/wip/item6-backdrop` (union of floors), re-ported. Main already has an opt-in exact clip (`GridLevel.clipToFloors`, set by `camp-continuity.py` and `tsolenka-pass.py`; item 7 adds `clip` for Yester Hill's levels): a level that sets it keeps the exact polygon clip, and the feathered rooms'-bbox clip is the default for every other ground level. `e2e/grid.spec.ts:24` records 0.3.1's decision that "the ground outside the floor polygons carries the grid now"; this release reverses it for the land beyond the rooms, which is question 9.
(b) `app.ts frameLevel` (1111-1154, clear of hunks) frames the rooms' main cluster, not every room: a room is left
out only when it lies more than 500 ft (or three times the median room-to-room gap) from the rest, and never on a
level with fewer than 20 rooms (a percentile rule would drop one of Death House's eight rooms) (Vallaki is framed from
10,700 ft because the camp 2,500 ft away is in the bbox; Tser's deck is a sliver). (c) Pins (door,
object, tread, note) fold to 6-px dots below the mid zoom band and open on hover or selection, never over a room label;
Players view shows no pins beyond 400 ft. **Implemented as CSS on a `data-zoom` band attribute that the camera handler
already sets, plus `labelDensity`**, not inside `declutter()`: its `PRI` line at 1551-1565 is ChatGPT's hunk.

**Files.** `app/src/render/gridOverlay.ts`, `app/src/app.ts` (`frameLevel`, `labelDensity`; **not** `declutter`, no
level/link/door/transition code), `app/src/styles.css` (`[data-zoom]` dot rules for `.pin`), `docs/FEATURES.md`,
`e2e/grid.spec.ts`, new `tests/frame.test.ts`, `e2e/ui.spec.ts`.

**Tests that fail first.** `e2e/grid.spec.ts` (today only records `r.outside`): at the default framing on E, N and X
the grid pixels outside the floor mask are < 3 % of grid pixels. `tests/frame.test.ts`: Vallaki town's framing distance
excludes the camp (< 6,000 ft; 10,700 today). `e2e/ui.spec.ts`: Blue Water Inn at the far band: no pin expanded, none
over a room label's box; Death House f1 at the far band: full pins 0, dots 9, labels 8; Players view beyond 400 ft: no
pin. `neutral.spec.ts` with `?fx=grid:off`: zero pixels on interiors (the grid change is outdoor-only).

**Maps judged.** The village, Vallaki town, Amber facade, Krezk, Yester Hill summit (the grid past the inner track,
item 7 open #8), Death House f1 and the Blue Water Inn (pins), Tser deck (framing).

**Changelog line.** "The grid stays on the map instead of running to the horizon, a town opens framed on its streets,
and the pins on a building floor fold away until you zoom in."

### B5. Release 5: grain, ground colour and surface conflicts (a port)

**What.** Port `claude/wip/item6-render` (`92dcd69`, 2026-10-03, 7 files +232/-78, reviewed, never merged; verified
with `git merge-tree` to merge onto main with zero conflicts, main having moved only +81/-12 in those files): an
additive-safe grain floor (`c * s + (s - 1) * max(c, 0.035)`) so slate, `#2e2f33` boulders and obsidian keep texture;
soils and snow stronger, rock's crazy-paving joints weaker with strata; marsh its own surface; window glass surface
`none`; `amber` as a real surface; the hex collisions fixed (`#5a5d63` mist3 declared metal by `s.ts`, `#a8956f` wood vs
cloth, `#3b3a3f`, `#4a3a2c`) with `surfaceFor` refusing a conflicting re-declaration. Plus the survey's two additions: a
low-frequency hue and value drift in grass, dirt and snow (the same noise texture) and a slope-and-aspect shade term
(`uShadeDir`) for ground surfaces, which lets `worldland.ts colourer()` keep its baked NW shade near maps at half
strength instead of switching it off within 1,400 ft of every map. Same `SURF` branch count: no new programs.

**What (5b, contact darkening: the second builder, `build.ts` and one shader term).** The visual survey's second lever,
missing from every design: nothing on any map casts a shadow, so houses, trees and walls sit on the ground like
cut-outs (looked at: Death House f1 DM, the village, the square). A height-above-floor term in `mistSurface` driven by
a per-level `uFloorY` darkens the lowest 2-3 ft of every wall and prop above its level's floor and the floor within
~2 ft of a wall (a contact-AO term, no shadow map, iPad-safe), plus one instanced soft-disc decal under trees and
houses placed by `build.ts` from the prop's footprint (role `floor`, fog-of-war like the floor). Barovia stays
shadowless as STYLE.md says; this is the substitute the survey names for its "no hard shadows". Behind `fx.contact`.

**Files.** `app/src/render/materials.ts` (`mistSurface` SURF 3/9/10/16/17/18 branches, the floor, `uShadeDir`,
the `uFloorY` contact term), `app/src/render/build.ts` (the decal pass; not `LabelSpec`),
`app/src/kit/surfaces.ts` (conflict guard; chimney, coping, dome, dais, ledge declared once), `app/src/render/
worldland.ts` (`colourer` only: the `near` factor and the drift; **not** `LandField.height/cut`), `app/src/render/
build.ts` (window glass `none`, creature merge and `privatize` sharing from the branch), `app/src/kit/sites/*.ts` only
where a colour is re-declared (the declaration line moves). New `tests/surfaces.test.ts`.

**Tests that fail first.** `tests/surfaces.test.ts`: no colour is declared with two surfaces across `app/src/kit`
(fails on four today); every `PALETTE` entry has a surface. `e2e/look.spec.ts`: ground value spread (luminance standard
deviation over a 200x100 px grass region) on the village and Vallaki >= 6 (about 2 today); a boulder's faces on Yester
Hill are not one value; on Death House f1 the mean luminance of a wall's lowest 2 ft is at least 8 % below its
mid-height band, and on the village a house's ground ring is darker than the open turf beside it (both equal today).
`e2e/surfaces.spec.ts` style checks re-pinned knowingly (the review reads the diff). `neutral.spec.ts` with
`?fx=grain:off,contact:off`: zero pixels.

**Maps judged.** The village, Vallaki town, Krezk (the pine wall, the church's iron), Yester Hill (boulders, cairns),
Amber (snow, amber rooms), the square (pasture), Death House f1 (walls and floors).

**Changelog line.** "Ground is no longer one flat colour: turf, earth and snow drift in tone, slopes shade by their
aspect, dark stone keeps its grain, glass is glass, and houses, trees and walls sit on the ground instead of floating
on it."

### B6. Release 6: scenery with level of detail, instanced pines, the prop pass, the valley hidden under interiors, hard budgets

Two builders on disjoint files (`build.ts`/`worldstage.ts`; `props.ts`/`pieces.ts`), one review.

**What (6a).** Two-tier scatter: prop builders tag sub-foot pieces `userData.tier = 'near'`, and `build.ts` tags any
static prop whose bounding box is under 3 ft (chairs, stools, crockery, candles: 36 chairs in Death House alone)
`near` as well, so Players view and the far zoom band hide them beyond 150 ft and the DM's View menu gains
"Furniture: all / key / none" (key = objects with a key, openables, hidden-object markers): the other half of
"building maps are cluttered", which release 4's pins do not touch. `build.ts` buckets by
(material, role, tier) and merges `near` buckets into ~500-ft tiles under a `THREE.LOD` (near < 900 ft). Map pines
become one `InstancedMesh` per level per scale bucket with per-instance colour jitter (the stage forest already does
this), picking by instance id instead of face ranges, the far level the stage's 2-tier tree. `mergeByMaterial` keeps
indexed geometry when its inputs are indexed. **The stage's land hides under a resident map** once the camera target is
inside the map's footprint and under ~600 ft: it is 228k triangles and ~35 draws under every interior in the nested
world (Death House f1 399k -> ~170k). Hard ceilings in `e2e/budget.spec.ts` over all 44 scenes from the release-2
ledger: Vallaki town <= 600k triangles (1.41 M), Yester Hill hill <= 400k (659k), Death House f1 nested <= 300k (399k),
Amber facade <= 300 calls (675, mostly done in release 2), Krezk <= 250 calls (374); +-5 % on every other level; a
release may lower a ceiling, never raise one without a changelog line. The existing whole-valley 300,000-triangle test
stays as it is.

**What (6b).** The eight shared props that ~12,000 placed objects use, reshaped in the same grammar with the same
dims and placement (so every scene keeps working without regeneration): boulder, bush, pine, oak (<= 400 triangles,
628 today), dead tree, stump, cairn, fence. This is the shared part of item 18.

**Files.** 6a: `app/src/render/build.ts` (scatter merge, instancing, `hitObjectId` for instances, LOD tiles; not
`LabelSpec`), `app/src/render/hideUnder.ts` (instance ranges), `app/src/render/worldstage.ts` (land hidden under a
resident map; `stats()`), `app/src/render/streamer.ts` only if the LOD needs a hook, new `e2e/budget.spec.ts`,
`docs/handoff/map-budgets.json`. 6b: `app/src/kit/props.ts` (lines 296-345, 580, 803 and the tags), `app/src/kit/
pieces.ts` (indexed merge), `tests/props.test.ts`.

**Tests that fail first.** `e2e/budget.spec.ts` ceilings (five fail today). `tests/props.test.ts`: each prop's triangle
count under its cap; a boulder's lowest vertices lie on one plane; a raycast on a built level names a pine instance's
object. `e2e/world.spec.ts` 'maps that leave are disposed' and the 300k whole-valley check stay. `e2e/look.spec.ts`:
at 300 ft the near picture equals the pre-LOD picture (the LOD is inside its near range); Death House f1 in Players
view at the tabletop framing draws no `near` furniture, and the same frame in DM view with "all" equals release 5's;
with the stage land hidden under Death House f1 and the Blue Water Inn, no pixel of the canvas shows the page gradient
(`scene.background` is null, so a hole in the land shows the page through the canvas: the mist floor and `fogIn` must
cover what the land no longer draws, or the budget test passes while the horizon has a hole). The iPad project of the
e2e suite for the LOD switch.

**Maps judged.** Vallaki town, Yester Hill hill, Krezk, Tser Pool (P), the village, Death House f1 nested (the valley
under it), the square (oaks).

**Changelog line.** "Towns and woods draw at a fraction of the cost and trees, rocks and bushes have shapes instead of
blobs; far scenery sheds its small parts and the valley does not draw itself under a house. Every map now has a cost
ceiling no release may raise quietly."

### B7. Release 7: land as one surface (waits for ChatGPT's Status line on `worldland.ts`/`backdrop.ts`, or for its 0.3.3)

Two builders on disjoint files (land; fog and water), one review. **Gate:** before the builder starts, ChatGPT says in
Status whether its laptop worktrees have touched `worldland.ts`, `backdrop.ts`, `heightfield.py` or `authorlib.py`
(function names); if so, that diff is merged first, never rewritten. If 0.3.3 has landed, main is merged first and
`LandField.height` is its version. A day of silence after the ask counts as no (the AGENTS.md rule).

**What (7a, land).** Smooth normals on the land lattice (the one exception to flat shading, as item 8's STYLE.md diff
states); the apron takes each map's **edge heights** (`LandSite.edgeHeights`, ~64 samples per side taken by
`scripts/world-atlas.ts` from the generated scene's terrain slabs, prisms and, when present, `level.relief`) so Krezk's
mountain no longer ends in a step and Tser's deck is not a plate; the colourer adds aspect, altitude bands (turf, heath,
scree, snow) and the forest tint under the instanced pines; the legacy `backdrop.ts` land is no longer built when the
stage is on. The shared landform kind: `s.ts heightfield()` lifted into `kit/landform.ts` (packed 12-bit lattice,
slope-coloured faces, frost line, skirt), role `floor`. **Ground-following levels (question 3):** `core/relief.ts` (the
sampler from `claude/wip/item10-vallaki-terrain`, `ReliefData v1`: `origin`, `cell`, `cols`, `rows`, `h` in tenths of a
foot above `elevationFt`), `render/terrainMesh.ts` and `gridGlsl.ts` re-based from that branch, tokens, markers, pins
and the camera target at `elevationFt + relief(x, z)` (`moveTokenTo` is ChatGPT's hunk at 2026: this part lands only
after 0.3.3 is merged), a grade rule in `walkField` (a 5-ft step rises at most `maxRiseFt`, default 3), `level.relief`
optional in `schema.ts`, and `wildlib.Site.write(..., relief=None)` / `authorlib.Level.to_json(relief=None)` as
**keyword arguments whose default is today's derivation**, so every unchanged generator regenerates byte-identical
output. New `scripts/authoring/dev-slope.py` writes `locations/dev/m1-slope` (a ramp, a cliff, a graded path, one hut
on a pad): the fixture every relief test walks. **Yester Hill (question 3 yes):** the cloud claims `yester-hill.py` (unless
ChatGPT's WEST-SITES lane holds a claim on it) and rebuilds item 7's five terraces as one `relief` level
(`relief=wildlib.hill(...)`: the trail a graded path, the cliffs refused by grade, no invisible ring walls, the cairn
tracks on the slope), regenerates Y, and `e2e/relief.spec.ts` walks the party from the foot to the summit circle in
Players view: the first production adopter and the one scene release 7 regenerates.

**What (7b, fog and water).** Height fog in the shared shader: the mist's density scaled by `exp(-(y - groundY) / 40)`
with `groundY` the active map's elevation (later the land's surface), so mist pools in gorges and hilltops stand clear.
Water: one shared water material (`kit/water.ts`, SURF 17) with the `uTime` ripple, view-angle lightening toward the
sky, a little specular toward the key, a shore band from per-vertex alpha (item 8's `softPatch`); `worldland.ts
buildWater`, `backdrop.ts` lake discs and the maps' `shallow-water` floors use it; sites keep their shapes and lose
their shaders.

**Files.** 7a: `app/src/render/worldland.ts` (`landMaterial`, `buildAprons`/`apronY`, `colourer`; `LandField.height/
cut` only as merged from ChatGPT), `app/src/render/backdrop.ts` (skip the land when staged; `SITE_SHAPERS` untouched),
`scripts/world-atlas.ts` + `manifests/world-atlas.json` (`edgeHeights`; the manifest is rebuilt, never hand-merged), new
`app/src/kit/landform.ts`, `app/src/core/relief.ts`, `app/src/render/terrainMesh.ts`, `gridGlsl.ts`, `app/src/core/
schema.ts` (`level.relief?`), `app/src/core/walkField.ts` (grade rule), `scripts/authoring/wildlib.py` and `authorlib.py`
(the keyword only), new `scripts/authoring/dev-slope.py`, `locations/dev/m1-slope/*` (generated), `docs/WORLD.md`.
7b: `app/src/render/materials.ts` (height fog term, SURF 17), new `app/src/kit/water.ts`, `app/src/render/worldland.ts
buildWater`, `app/src/render/build.ts` water kind.

**Tests that fail first.** `e2e/world.spec.ts` 'ground meets every map' stays at +-0.4 ft and extends to a map with edge
heights (Krezk NE corner within 2 ft of the map's edge sample; 485 vs -138 ft today). `tests/landform.test.ts`: the kind
builds through the kit, its top is role `floor`, `walkField` runs on its polygon. `tests/atlas.test.ts`: every placed
map has 4 x 64 edge samples. `tests/relief.test.ts` (the 11 from the item 10 branch, re-based) plus grade cases (a 4-ft
rise over 5 ft refused, 2 ft allowed, downhill always). `e2e/relief.spec.ts` on `dev/m1-slope`: the token's y rises
with the path, the cliff refuses, the grid lies on the slope, the land meets the edge with no step. `e2e/look.spec.ts`:
Tser deck: no luminance step > 30 across the map's edge; Vallaki's lake: no one-pixel hard shore. Regeneration proof:
every tracked-input generator run twice with `relief` absent is byte-identical to `locations/**` (the keyword is
opt-in). `budget.spec.ts` ceilings hold. `neutral.spec.ts` with `?fx=land:off,water:off,heightfog:off`: zero pixels.

**Maps judged.** Tser Falls deck (H), Krezk (S), Amber (X), Vallaki and its lake (N), Yester Hill (seam and colour; the
hill itself waits for its generator), the village (E), Tsolenka (T), the Sheep Chase road, `dev/m1-slope`.

**Changelog line.** "The land is one surface: no step where a map meets its valley, hills shade by aspect and altitude,
mist pools in the low ground, water moves and has a shore. A level can now follow the ground; Yester Hill climbs the
day its map says so."

### B8. Release 8: every map is checked before it ships (after ChatGPT's 0.3.3 is on main)

Two builders on disjoint files (the walk and the hard contract; the library and the regeneration), one review.

**What (8a, the runtime walk and the hard contract).** Merge main (0.3.3): its seven shared pieces (`_wall_intervals`,
`CONTACT_EPS/onSegment`, `LandField.height`, `hiddenObjectId`, the item 11 transition engine, the migration engine,
`tests/audits/mapCoverage.ts`) become the cloud's; `walkField` adopts the contact test; `ensureDefaultToken` gains
"open() shows the party's level" in the now-merged `open()`; `core/landfield.ts` is split out of `worldland.ts` for the
tenth check `level-not-buried` (Amber upper and lower, the Castle dungeon, the N9 camp on 0.3.1). New
`e2e/players-walk.spec.ts`, modelled on `players-sweep.spec.ts` (same boot, `__mistlab.scenes()`, `app.open(path)`,
`setView('players')`): per scene, from the start try the 8 neighbours; for every door `toggleDoor`, cross both ways,
close it and confirm the block (locked: confirm "Locked", per question 5); for every link `takeLink` each direction and
check level, floor and one departure; BFS the party through every room it can reach and record what it never reaches;
writes `docs/handoff/map-walk.json`, asserts zero regressions against the committed ledger; `__mistlab.audit(path)` hook
in `main.ts` for one map from the console. Serial, desktop only, inside the 600 s class the players' sweep uses (it needs
release 1's cache; if it still exceeds the budget it splits by campaign into two specs, never loosens). ChatGPT's
`e2e/vertical-links.spec.ts` is imported, not rewritten. Each contract check at zero across all maps flips to hard-fail
with no ledger entry.

**What (8b, the library and the one regeneration).** Additive, defaulted helpers in `authorlib.py` (shared; edited under this release's claim):
`Level.spawn(x, z)`, `Level.room(..., sealed=True)` (question 4), one shared `outdoor_floor(level, bounds, solids)`
replacing the three hand copies (`wsc-town.py outdoor_floor()`, `krezk-abbey.py GRID_EXTRA`, `self.walk`) when those
generators switch, `finalize()` that runs the contract checker on every write; `wildlib.Site.write()` calls `finalize`
(default behaviour otherwise unchanged). `scripts/authoring/check.py` runs the same checks from Python for an author.
New `scripts/authoring/regen-all.py`: every tracked-input generator in dependency order (`barovia-world -> heightfield
-> sites -> site-continuity -> atlas`), lists the five it cannot run without `reference/` (`import-ml.py`,
`import-mapset.py`, `barovia-cover.py`, `village-map.py`, `wsc-cover.py`) for the laptop (`stl-terrain.py` imports an
optional STL mesh and is not part of a regeneration), runs the post-processors in their order (`village-map.py` then
`village-roads.py`; `castle-ravenloft.py` then `ravenloft-exterior.py`; `import-ml.py` then `camp-continuity.py`; the
sites then `site-continuity.py`; `wire-sites.py` last), leaves alone the two scenes no generator writes (`ch02/G`, the
Tser camp, whose rooms and props are a retained import that `camp-continuity.py` only post-processes; `dev/m0-test-room`,
hand-written) and still runs the checker on them, snaps `ch02/C` (the one hex-grid map) with its grid kind, then the
checker on each output; `--check`
regenerates into a scratch directory and diffs, twice (determinism is a test). Migrations: ChatGPT's `state/
mapMigrations.ts` engine generalised to read `locations/<map>/migrations.json` (revision, room polygons before/after,
door and secret-door ids before/after) that the generator emits; the Castle table hard-coded today becomes the first
`locations/ch04/K/migrations.json`. **The one regeneration:** announced in Status a day ahead; one commit made by one
command carrying the library, all 44 scenes, every `migrations.json` and the rebuilt atlas and massing manifests;
ChatGPT merges main after it and regenerates its in-flight maps with the same command. The laptop runs the copied-text
check against `reference/ocr` before the release (the cloud has no `reference/`).

**Files.** 8a: new `e2e/players-walk.spec.ts`, `docs/handoff/map-walk.json`, `app/src/core/landfield.ts`, `app/src/
main.ts` (the hook), `e2e/helpers.ts`, `app/src/app.ts` (`open()` level line, after the merge), `app/src/core/
walkField.ts` (contact test), `tests/audits/mapContract.ts` (`level-not-buried`, hard-fail at zero), `app/src/core/
schema.ts` (`Room.sealed?`). 8b: `scripts/authoring/authorlib.py` (the helpers, `finalize`), `wildlib.py` (`write()`
calls `finalize`), new `scripts/authoring/check.py`, `regen-all.py`, `app/src/state/mapMigrations.ts`, `campaignLoad.ts`,
every `locations/**/scene.json`, `grid.json`, new `migrations.json`, `manifests/world-atlas.json`, `world-massing.json`.

**Tests that fail first.** The two walk fixtures (a room behind a wall-under-door; a stair into a wall) fail the walk
before the fixes; `tests/map-migrations.test.ts` (adopted) plus a save made on 0.3.1 against Vallaki N2 loading with its
doors and reveals intact after the regeneration; `regen-all.py --check` diffs empty on the second run; the contract and
walk ledgers unchanged or lower; `tests/authorlib.test.ts` spawns `python3 scripts/authoring/test-wall-topology.py`
(skipped with a reason only when no Python is on the machine; CI has one); the three regression maps' walk results
written into the spec as fixed expectations (every Death House room reachable with its doors; the Vallaki town gates;
the square and its tavern).

**Maps judged.** All 44 scenes / 122 levels through the walk ledger; the Abbey and the square (now fixed in data, not
only by the fallback); Castle and N4 (open on the party); the regression trio's saves.

**Changelog line.** "Every map is checked before it ships: the party starts on a floor it can leave, doors are doors,
stairs land where they should, and the browser has walked every room. Saved campaigns carry over."

### Optional, not on the path

- **Release A, adopt the integration branch early** (`item2e-cloud-integration-032`, `bb018e9`, 26 files, no scene
  files): only on ChatGPT's yes in Status (question 6). 6 agent-hours, 5 wall. Otherwise its content arrives in
  release 8's merge of 0.3.3.
- **Shadow-map spike** (question 8): 1.5 h, Sheep Chase only, off on phones, go/no-go.

---

## Part C. The section for AGENTS.md (verbatim; written under "Working on the maps together" when Matt approves the plan, before release 1; rewritten as claims-and-merge, no ownership, after Matt's rule of 2026-10-18 and the Status note of 20:10 UTC)

```
## Item 2f: the framework and the per-map work, under "Working on the maps together"

No map, generator, scene or shared file belongs to an agent (Matt, 2026-10-18); the rules above (claim before you
edit, small regenerated commits, shared files opt-in or behaviour-preserving with a test and the three regression
maps, whoever merges second resolves, generated files never resolved by hand) are the whole boundary. This section
only says how the framework's releases use them.

- A framework release is a claim: before its builder edits anything, a row in the Claims table names the release
  (`item2f-<n>-<name>`), every file it will touch (by function for app.ts, worldland.ts, build.ts and authorlib.py),
  the time, and the day it is expected on main; the row goes when the release is on main. A stale claim (12 hours,
  no commit) may be taken over by either agent, said in Status.
- Before the builder starts, the release's files are checked against every claim in the table and against
  `git diff claude/mistlab-curse-strahd-x6jm13...origin/<branch>` for each branch with unreleased work (ChatGPT's
  item2e-map-logic-laptop, item2e-coverage-audit-032, item2e-cloud-integration-032, item11-vertical-transitions-cloud;
  item 7's branch until 0.3.2 is on main): a file another agent has claimed, or a hunk another branch has changed, is
  not edited; the framework asks in Status ("need X in authorlib because Y") or waits for that work to land and
  merges it. Reviewer (b) repeats the check at review: zero overlapping hunks, or the release does not ship.
- While ChatGPT's all-map release (0.3.3) is in flight, its own lanes in docs/handoff/item2e-032-plan.md (GEN-TOPO
  authorlib.py; WILD wildlib.py and wild_*.py; REGION heightfield.py, barovia-world.py, both world.json; TERRAIN
  siteInterfaces.ts, terrain.ts, backdrop.ts; CORE-NAV the transition code in app.ts and movement.ts; INTEGRATION
  world-atlas.ts, world-massing.ts, the schema) are treated as standing claims: releases 1-6 touch none of them;
  release 7's `relief=` keyword on wildlib.Site.write and authorlib.Level.to_json is additive with today's behaviour
  as its default (byte-identical output when absent) and is announced in Status before it is written; releases 7 and
  8 start after ChatGPT's Status line on worldland.ts/backdrop.ts (7) or after 0.3.3 is on main (8). ChatGPT's
  committed shared changes (832897a, b461609, aea9fc9's movement and schema hunks, the item 11 commits, 7d008e4's
  migration engine) are merged as they are, never rewritten. Item 7's shared changes (0.3.2: the lazy lattice in
  movement.ts, GridLevel.clip, landHole/cutLand, the fogWall sheets) are the base every framework branch starts from.
- The same holds the other way: a framework file in a claimed release (kit/mist.ts, core/walkField.ts, the contract
  checker, the ledgers) is not edited by the other agent while the claim stands; afterwards either agent may, under
  the same rules. Either agent may lower a map's row in a ledger when its fix lands; a row rises only with a changelog
  line.
- Either agent may rebuild any map on the framework's seams (Yester Hill on `relief`, Krezk on `edgeHeights`) with a
  claim on that map's generator; the first production adopter of each seam is named in its release.

The seams, all data, all optional with defaults so an unchanged generator regenerates byte-identical output:
- Prop kinds are the seam for pieces: the kit draws mist, mist-bank, mist-wall, fog-wall, water, landform, pine, oak,
  boulder, bush, stump, dead-tree, cairn, fence, house; a site registers its own kinds. Four registration lines in
  w.ts, s.ts, wild.ts and wild-a.ts point the mist kinds at the kit (release 3, announced). Promoting a site piece
  to the kit is a framework edit, asked for in Status.
- level.relief (ReliefData v1: origin, cell, cols, rows, h in tenths of a foot above elevationFt) is the only
  per-map terrain input the engine reads; a generator writes it with wildlib.Site.write(relief=) or
  authorlib.Level.to_json(relief=); the sampler in core/relief.ts reads it. Per-map values in core/siteInterfaces.ts
  move into scene.land later; until then a new map adds one data row there, no code.
- The contract: tests/audits/mapContract.ts and its checks are shared machinery; a map's findings are fixed in its
  generator or its data, never by loosening a check; a check at zero everywhere becomes a hard failure. Level.spawn,
  Level.room(sealed=) and outdoor_floor() are the helpers every generator codes to (release 8).
- Save migrations: the engine (app/src/state) applies what the generator emits as locations/<map>/migrations.json.
- Kit footprints: generators do not copy kit geometry by hand (wild_r.py, wsc-town.py, krezk-abbey.py do today, citing
  the function; tolerated until manifests/kit-footprints.json is exported).
- manifests/world-atlas.json and world-massing.json are build outputs: never hand-merged, rebuilt by whoever merges last.

Regeneration: framework releases 1-6 regenerate nothing (runtime-only, or an opt-in keyword with byte-identical
default); release 7 regenerates Yester Hill alone if question 3 is yes, under a claim on yester-hill.py. A framework
change that alters every generated output (wall ids, new scene fields, floor polygons) lands once, in release 8, in
one commit with all 44 regenerated scenes and their migrations.json, made by `py -3 scripts/authoring/regen-all.py`,
at a quiet moment announced in Status a day ahead; the five generators that need reference/ (import-ml.py,
import-mapset.py, barovia-cover.py, village-map.py, wsc-cover.py) run on the laptop; ch02/G and dev/m0-test-room have
no generator and are checked, not regenerated. The other agent merges main after it and regenerates its in-flight
maps with the same command. Wall ids are saved-state keys: that commit carries the door and secret-door id migration.

Framework releases are small and versioned in order; the framework reserves no version number. Neither agent commits
to a branch the other is working on without a claim; the work meets on main.
```

---

## Part D. The regeneration plan

| Release | Regenerates scenes? | Why |
|---|---|---|
| 1 | No | `app.ts`, a new core file, new tests, a ledger |
| 2 | No | `world.ts`, `sky.ts`, `materials.ts`, `build.ts` lamps, new harness files |
| 3 | No | the kit piece replaces builders by kind; the generators' `dims` (`len`, `h`, `seed`) are unchanged |
| 4 | No | grid overlay, framing, CSS |
| 5 | No | materials and surfaces are runtime |
| 6 | No | props keep their dims and placement; instancing and LOD are build-side |
| 7 | **Yester Hill only, if question 3 is yes** (a claimed rewrite of `yester-hill.py`, one scene, announced in Status); otherwise no production scene. `locations/dev/m1-slope` is new, written by `dev-slope.py`. The `relief=` keyword defaults to today's derivation; the test runs every tracked-input generator twice and diffs against `locations/**`: byte-identical. | opt-in interface |
| 8 | **Yes, all 44 scenes, once.** | `_wall_intervals` renumbers anonymous walls (`<level>-w-<i>`, `-part-N`) and `finalize()` adds `spawn`/`sealed` fields; wall ids key `state.doorsOpen` and `revealSets().secretWalls`, so the commit carries `migrations.json` per map and the generalised engine |

**The one command:** `py -3 scripts/authoring/regen-all.py` (on the laptop; `python3` in the cloud and CI). It runs
every tracked-input generator in dependency order (`barovia-world.py -> heightfield.py -> sites -> site-continuity.py
-> npm run atlas / massing`), then the contract checker on each output, and prints the five generators it cannot run
without `reference/` (`import-ml.py`, `import-mapset.py`, `barovia-cover.py`, `village-map.py`, `wsc-cover.py`) so the
laptop runs them; `ch02/G` and `dev/m0-test-room` have no generator and are checked, not regenerated. `--check` regenerates into a scratch directory and diffs against
`locations/**`; run twice, it is the determinism test. Until release 8 the check reports "would change" on the 33 maps
ChatGPT has not regenerated with `_wall_intervals`, which is expected and listed, not a failure.

**The rule:** a regenerating commit is announced in Status a day ahead, is one commit from one command with the library
change, all scenes and the migration data, lands at a quiet moment, and is followed by the laptop's copied-text check
against `reference/ocr` before the release. ChatGPT merges main and regenerates its in-flight maps with the same command.

---

## Part E. Cost by step (lean setting)

Builder 2-3 h (two in parallel on disjoint files where marked); two reviewers 1 h each in parallel; one fix pass
1-1.5 h; release (merge, bump, changelog, queue and handoff rows, full suite with the laptop's 13-15 min GPU run,
push, publish) about 1 h of one agent.

| Release | Builders | Reviewers | Fix | Release | Agent-hours | Wall clock |
|---|---|---|---|---|---|---|
| 1 First step, fast walk, contract (report) | 2 x 3 h | 2 x 1 h | 1.5 h | 1 h | 10.5 | ~6.5 h |
| 2 Light rig, harness, kill switch, counts | 2 x 2.5 h | 2 x 1 h | 1 h | 1 h | 9 | ~6 h |
| 3 Mist piece, fog of war as mist | 1 x 3 h | 2 x 1 h | 1.5 h | 1 h | 7.5 | ~6.5 h |
| 4 Grid, framing, pins | 1 x 2.5 h | 2 x 1 h | 1 h | 1 h | 6.5 | ~5.5 h |
| 5 Grain, ground and contact darkening (a port plus one term) | 2 x 2.5 h | 2 x 1 h | 1 h | 1 h | 9 | ~5.5 h |
| 6 LOD, instancing, props, furniture tier, valley, budgets | 2 x 3.5 h | 2 x 1 h | 1.5 h | 1 h | 11.5 | ~7 h |
| 7 Land, relief, height fog, water, Yester Hill on relief (question 3) | 2 x 3 h + 3 h for Y + 0.5 h gate note | 2 x 1 h | 1.5 h | 1 h | 14 | ~8 h |
| 8 Walk, hard contract, library, regeneration | 2 x 3 h | 2 x 1 h | 1.5 h | 1 h + laptop text check | 10.5 | ~6.5 h |
| **Total** | | | | | **~79 agent-hours** | **~52 h wall clock, 8 releases** |
| Optional A: adopt the integration branch early | 1 x 2 h | 2 x 1 h | 1 h | 1 h | 6 | ~5 h |
| Optional: shadow-map spike | 1 x 1.5 h | - | - | - | 1.5 | - |

Releases 1-6 run now, one at a time, beside ChatGPT's work, with no shared edit in flight on both sides: about six
working days. Releases 7 and 8 wait for ChatGPT's 0.3.3 (or, for 7, its Status line); each is a day when it unblocks.
Release 6 (`build.ts`, `props.ts`) and release 5 (`materials.ts`, `surfaces.ts`) could run side by side if two builders
are free; the others share files and run in order.

---

## Part F. Risks

- **ChatGPT's uncommitted laptop work** (terrain, roof, J/K, hydrology worktrees) may touch `worldland.ts`,
  `backdrop.ts`, `heightfield.py`, `authorlib.py`. Releases 1-6 touch none of them except `worldland.ts colourer()`
  (release 5), which `b461609` did not change; release 7 is gated on its Status line; release 8 on 0.3.2 itself.
- **The two hunks nearest the framework's edits** are `open()` (874-886: the level-choice line) and `declutter()`
  (1551-1565: the `PRI` line). The plan routes around both (the party-level fix waits for release 8; pins fold in CSS
  and `labelDensity`). Reviewer (b)'s diff check is the guard.
- **`walkField` duplicates ~40 lines of `canWalk`** until 0.3.3 lands. The equivalence test (2,000 random moves over
  ten maps) pins the two together; release 8 adopts the contact test and the duplication can then collapse into one
  exported step test in `movement.ts`.
- **Tone mapping** shifts every pixel and recompiles every program (26 -> 51 measured). It ships off; the hook move
  that makes it safe is pinned by the Death House fog-colour test.
- **Pixel baselines** (`surfaces.spec.ts`, `grid.spec.ts`, the 0.3.1 Amber hard-cut tests) must pass or be re-pinned
  knowingly with a changelog line; `neutral.spec.ts` asserts equality and cannot be re-pinned quietly.
- **SwiftShader is not the laptop GPU.** Cloud numbers are draw calls and triangles (exact) and CPU times (a signal);
  frame times come from the laptop's GPU suite at each release; per-pixel-cost changes (height fog, water, the soft fog
  edge) are measured there before release, and the iPad project of the e2e suite runs.
- **The runtime walk's time** (release 8) on SwiftShader and CI: it needs release 1's cache; if it exceeds the 600 s
  class it splits by campaign, never loosens.
- **Instancing changes picking and hiding** (`hitObjectId`, `hideUnder` on face ranges today): release 6's tests keep
  taps, labels and nested-world masking working.
- **Players-view fog as mist by day reveals silhouettes** of unexplored exteriors: that is the intent (question 2);
  interiors keep the dark fog; `player-safety` and `players-sweep` stay strict.
- **"Yester Hill is flat" is closed only if release 7 also rebuilds Y:** the kind, the sampler, the seam and the paint
  are shared; the rewrite of `yester-hill.py` (item 7's five terraces into one `relief` level) is one map's work under
  a claim. If ChatGPT's WEST-SITES lane has claimed it first, the framework hands over the seam and the dev fixture and
  the sentence closes on that schedule; the risk is both at once, hence the claim.
- **Version order** is settled (item 7 is 0.3.2, ChatGPT's all-map release 0.3.3; question 7); the framework reserves
  no number and the later release merges the earlier.
- **Rules:** no rebase or amend, no screenshots or `test-results` committed, no book content (the mist and land
  changes add no prose), materials only through `mat`/`matClone`, scenes only by regeneration (none before release 7's Yester Hill, if
  question 3 is yes; all 44 only in release 8).

---

## Part G. Facts this plan rests on (checked today in the read-only checkout)

- Main was `0bab66f` (0.3.1) when the surveys ran and is `90cfa32` now (`256cc49`, the shared-maps rule and the Claims
  table, and a Status note); item 7's merged head `fd65aea` is in its browser suite as 0.3.2 and changes the files
  listed in B0; ChatGPT's branches at their 2026-10-14 heads; `item2e-map-logic-laptop` is the superset
  (80 files, 21 scene/grid files in 11 maps). ChatGPT's `movement.ts` hunk is lines 2-23 of a 57-line file; its
  `app.ts` hunks are listed in B0; `ensureDefaultToken` (1172-1189), `canWalkTo` (1657), `applySky` (1706),
  `frameLevel` (1111-1154) and `nestedPref` (67-72) are outside them.
- Owner-lens probe (phone viewport, Players, `shots-judge/judge-probe.json`): `wsc/02-street` start `[52.5, 67.5]`
  off floor, 0 of 4 moves, 21.3 % near-black frame; `ch14/Y` hill start on floor, 4 of 4 moves, four `canWalkTo` calls
  43,489 ms, 7.2 % near-black. Logic survey: S10 start `[137.5, -7.5]` off floor, 0 of 4; K and N4 open on a level
  the party is not on; 32 walls over doors, 58 sealed rooms, 24 off-floor arrivals, 25 invalid polygons.
- Visual probe (`probe/shots2/probe.json`): hemi 1.4 / key 3.8 gives roof-face ratio 1.09 -> 1.18 at 90 draws; with
  ACES 1.24 and programs 26 -> 51; the shadow map drew nothing. Costs: Vallaki town 1.41 M frame triangles, Death
  House f1 nested 399k (stage 228k, 8,435 forest instances, ~35 draws), Yester Hill hill 659k, Amber facade 675
  calls, Krezk 374 calls / 644k.
- Determinism: two loads of one build differ in 0 of 1,049,088 pixels (Death House f1, 164 calls / 398,688 tris;
  Yester Hill 44 / 658,502).
- `claude/wip/item6-render` (`92dcd69`) merges onto main with zero conflict markers (`git merge-tree`); `item8-natural-land`
  (`066e37d`), `item10-vallaki-terrain` (`c0fd014`) and `item6-backdrop` (`a50e5b0`) hold the grid, relief and
  floor-union pieces named above.
- `e2e/players-sweep.spec.ts:44` `test.setTimeout(600_000)`; `e2e/helpers.ts` has `snap`/`diff`; `w.ts:440` (main) or
  `w.ts:647` (item 7) and `s.ts:579` register `fog-wall` and `mist-bank`; `yester-hill.py:219` writes `fog-wall` with `dims={'len':180,'h':140,'seed':i}`.
- No browser run was made for this synthesis (the machine is shared); the numbers are the designs' and judges' own,
  whose scripts and shots are in this folder.
