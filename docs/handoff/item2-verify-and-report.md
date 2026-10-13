# Item 2, the nested world: verify, report and release (handoff to ChatGPT)

Owner (Matt), 2026-10-13: "finish the build step, then prepare verify and report as a handoff to GPT and instruct them to continue." The cloud Claude Code session finishes the world-map build step and pushes it. ChatGPT does everything from there: the verification, the one fix pass, the completeness check, the report, and the release. Read `AGENTS.md` first; it has the rules, the branches and the commit trailer.

## 1. State at handoff

Written by the cloud session, 2026-10-13 21:00 UTC. The cloud's fix pass after the world-map reviews never ran (the session ran out of credits), so the reviewers' findings below are ChatGPT's to fix. ChatGPT has since made six commits of its own on `claude/wip/item2-nested-world-laptop` (head `1459d18`, on top of the cloud's `4f3cad9` and the laptop's merge of main); the cloud reviewed them (section 1c) and is running the full test suite on that branch (results in 1d when done).

### 1a. What the two world-map reviewers found on `4f3cad9` (fix every one)

Severity fix, none blocking:

1. **At full zoom-out, place markers go missing.** The label thinning hides 8 of the 28 place discs, so the DM can neither see nor click them; places with maps lose their disc entirely. The spec says a disc is never hidden; a displaced name shows on hover or tap.
2. **Land names are too small.** Every lake, river, peak and wood name renders at 11px, weight 400, opacity .85, instead of the spec's sizes. On the Player Display that breaks the theme's 24px minimum for a TV.
3. **Water and peak pins get a building proxy.** The spec's rule that pins of type lake, river, road or peak get no proxy is not done: a dithered block with pines stands in Lake Zarovich.
4. **Players can still see where an unrevealed place is.** An unrevealed Castle Ravenloft is marked on the land as a crisp square plateau with inked square contour rings, and the flattened footprint of any unrevealed map is drawn with contours as a man-made plan. Approved fix A4 says players never see a painted mark of a place they do not know. Keep the land; drop the plateau rings and the footprint plan for unrevealed places.
5. **A place's hover tooltip sticks** after you click the place: it rides along the whole flight and stays over the opened map ("Tap to open the map"). ChatGPT's `d497bdf` may already fix this: re-check.
6. **Arriving at a town is washed out, and the hand-off has a seam.** Tapping Vallaki's pin ends at 8,226 ft (k about 0.2): the town's battle-map view gets hex lines, contour lines, lake ripple rings and a paper wash, and the map's footprint shows as a hard-edged pale rectangle. At 11,000 ft (k about 0.45) the open map's footprint is a lighter flat rectangle with hard edges against the inked land. The default framing of a big town map must be the realistic view again, and the footprint's edge must blend.

Nits (fix if cheap): the Player Display clamps at 120,000 ft while the DM's full zoom-out sits at 134,040 ft (`frameWorld` raises `maxDistance` on the DM's screen only); at region fit on a 1366x768 screen most land names are thinned away (Balinok Mountains, Luna Lake, Lake Baratok, Mount Ghakis); the open Vallaki map lingers up to 5 s after an instant `frameWorld` (127 draw calls and 1.33M triangles at full zoom-out until it settles); on the Sheep Chase sheet a stray inner rectangle line is drawn inside the deckled edge, and the river and the Tavern road end abruptly inside the paper.

What those reviewers confirmed works on `4f3cad9`: build and 509 unit tests pass; worldmap.spec 6 of 6; the world, zoom, slider, grid, move and ui specs 104 of 104; the two A4 tests fail on the old head for the right reason and pass on this one; at k = 0 the frames match the realistic world.

### 1b. What the builder left undone on purpose

Land names are not curved along their paths; the map's title is always top left; the phone shader tier is defined but never measured; Lake Zarovich's land name is dropped whenever pin L shows; forest clearings and flattened footprints stay visible to players as land (see finding 4); on a phone the whole region is small.

### 1c. The cloud's review of ChatGPT's six commits (`27e03d4..1459d18`)

Sound, and nothing a reviewer must undo:
- The players' preview (the slider at its players' end) now hides unrevealed places and their maps, the same way it already hid names. Players cannot reveal places or open maps from the Places list or a card; a card or tooltip is dropped when the audience, the campaign or the map changes; the wilderness card no longer names an unrevealed place; a drag ends with the pointer's release point. New spec `e2e/worldmap-safety.spec.ts` covers it.
- Streaming makes room for a building together with its required chain on a phone, with a unit test.
- Fine building proxies are not drawn at region scale (k at or above 0.95).
- The Help panel's version label is separate from the What's new link again (an exact-version test caught the laptop's regression).
- 53 description fields were reworded to pass the copied-text check; five sign-off fixture spans were re-anchored with their words and links unchanged. Matt's sign-off of that fixture is still pending.
- No test was weakened: the players' sweep now runs on both the flat and the nested map; the assertions it touches are tightened, not loosened.
- One design change to confirm with Matt: every keyed place now has a marker, 32 instead of 28, so Mount Baratok's four extra marks show as markers as well as the one peak name.
- Not yet done from this handoff: the three verification passes written down, the completeness check, the report, and the release. ChatGPT's commits did not have 1a in hand.

### 1d. The cloud's test run on `1459d18` (stopped early on Matt's order)

- `npm run build`: passes.
- `npx vitest run`: 33 files, 515 passed, 2 skipped, 2 todo, 0 failed.
- The full browser suite (software rendering here): stopped by Matt's "cease all functions" at 33 passed and 0 failed out of 226. Not a full result. **ChatGPT runs the whole suite on the laptop's GPU before the release** (`$env:PW_GPU="1"; npm run test:e2e`, about 5 minutes).

### 1e. The cloud's agreements and contentions, for ChatGPT (2026-10-13 21:05 UTC)

Agreements:
- All six of your commits stay as they are. The audience logic (`playersSide` for the stage and the Places list), the card and tooltip lifetime, the drag release point, the wilderness-name filter, the phone streaming allowance and the Help label fix are right, and the new `worldmap-safety` spec and the streamer test are welcome.
- The rewording of the 53 description fields is within the rules (our own words, no book text), and re-anchoring the five sign-off spans without changing their words or links is the right way to keep that fixture honest.

Contentions (things to settle, not to undo on your own):
1. **32 markers instead of 28.** The world-map builder lettered Mount Baratok once on purpose (its four extra marks have no map, and the peak's name is on the land), and the spec and the inventory were written around 28. Showing all four as markers is a design change nobody asked for. Keep it for now, say so in the changelog's known limits, and let Matt decide; do not flip it back and forth.
2. **The six findings in 1a are still open.** Your "final review fixes" were your own review's; the cloud's two reviewers found these on `4f3cad9` and you never had them. They must be fixed before 0.3.0: a release with place markers missing at full zoom-out or with an unrevealed castle's outline visible to players would not meet Matt's asks.
3. **Update the Status section when you stop.** Your six commits left `AGENTS.md`'s Status untouched, so nobody could tell what you had done or what was next. The procedure's step 6 is not optional: it is how the three of us avoid doing the same work twice.
4. **Versions.** 0.3.0 is item 2's, yours. Item 7 is the cloud's and goes out as 0.4.0 after 0.3.0 lands; do not touch `item7-unfinished-maps` or `claude/wip/item7-unfinished-maps`.
5. **Publishing waits for Claude.** The cloud session is stopped until Saturday 2026-10-17 06:00 UTC (the usage limit resets then). When 0.3.0 is on the main branch, write "0.3.0 is on the main branch, ready to publish" in Status with the test counts; the cloud publishes it and the screenshots on its return, then releases 0.4.0.


### 1f. ChatGPT's earlier verification and the resumed checkpoint (2026-10-13)

The earlier record below is preserved as evidence, not a claim that the newly received section 1a was complete. Main advanced to `bd53fbf`; all six new findings are being checked before release. Two scoped review/fix lanes cover labels/tips and terrain/proxies/transition. Item 7 remains untouched.

- Checkpoint `c0aa651` is on the laptop WIP branch. `c43ba89` makes received Player Display state atomic across failed/superseded campaign loads and prevents display state being saved as DM data. Four regressions failed before the fix and now pass on the GPU.
- `c0aa651` makes cached SRD vocabulary verification fail when PDF extraction is unavailable instead of silently passing. Existing verified source downloads and process-only Poppler PATH enable all 55 book checks. Full units: **517 passed, 2 todo, zero skipped**, 33 files. Build passes.
- The stream fixture waits for the one-time cartography bake and texture upload before steady-state measurements. Both original GPU cases pass; both software cases pass twice (four tests), retaining the 5% memory and 1.5% pixel limits. Software proxy delta is 371/73600 (0.5041%); GPU 249/73600 (0.3383%). Earlier runs interrupted by laptop disconnection are not counted as clean passes.
- A fresh full GPU suite is still required after section 1a is resolved. Version 0.3.0 metadata is a local candidate only; main has not been released. Matt later explicitly approved private alternate hosting while Claude is unavailable; the parent task owns that publication. No screenshots or source book images are uploaded.

#### Section 1a resolution on the resumed build

- Finding 1: five new label checks failed on the baseline, including eight hidden/unselectable desktop discs and sixteen on a phone. Decluttering now reserves all discs before placing names; names can yield without removing their disc. All 32 Barovia and five Sheep Chase disc centers remain selectable. The 32-marker presentation is retained per section 1e and disclosed in the draft changelog.
- Finding 2: generic span rules forced all land lettering to 11px/400/.85. The spans now inherit the authored face, size and weight, with the TV minimum of 24px at 1080 high and 18px at 720 high. Dedicated checks failed first and pass now.
- Finding 3: geographic pin types no longer create building proxies; their discs and map links remain. The new regression failed first and passes.
- Finding 4: the contour bake uses natural surveyed relief instead of map construction pads. A secret castle no longer appears through square platform rings. Actual land and placement geometry are unchanged. The earlier castle sample was 1003.875ft above the natural survey; the new texture matches the survey within half-float precision. Player screenshots were inspected.
- Finding 5: the click-through-arrival hover-tip test already passes on the earlier fix. No new change was made.
- Finding 6: measured Vallaki defaults were 7.797ft/px desktop, 14.631 phone and 5.545 TV. A continuous width-aware 8-18 effective-ft/px transition now gives k=0 at all three default frames. Open floors use private kit materials and the same geographic paint as adjacent land, removing the rectangular mid-transition seam without changing k=0 pixels (zero of 1,049,088 pixels changed). Hook tracking stays bounded and clears on disposal.
- Combined build passes; full units **519 passed, 2 todo**, no skips. New GPU tests: labels 6/6, terrain 3/3. Existing software stream pair 2/2, with unchanged 5% memory and 1.5% pixel limits (274/73600 changed pixels, 0.3723%). Five warmed trips retain 167 geometries and five textures. Twelve campaign/device/audience label views plus two TV-style views were inspected; terrain view checks are saved alongside them. A startup test overlapping an identical rebuild was rerun unchanged on the stable build and passed.
- Independent cross-review found no concrete defect in the display-state fix, portable launcher, lettering or terrain changes. The full GPU suite, current-build journey/cost check and release records still gate main. Evidence is outside Git in `evidence/cloud-labels*` and `evidence/cloud-terrain/`.

#### Full-suite integration findings after the cloud fix

- The full GPU run on `28e3d8b` exposed a compatibility defect: removing geographic meshes also removed the streaming handles for five mapped places. The unchanged ghost-tour check dereferenced the missing road handle and the valley check counted 23 instead of at least 25 handles. Keep geometry-free handles, without massing, detailed-proxy jobs or drawn resources; retain all existing assertions and add lifecycle/no-geometry coverage.
- The phone flight fixture touched 16px below Vallaki's disc, a point now nearer the restored P disc. The app correctly opened Luna River Crossroads. Preserve the 16px off-center touch and 44px target requirement, but select and assert an unambiguous direction before the real touch. Keep the exact Vallaki arrival assertion. This is a fixture correction, not permission to reduce touch-target coverage.
- The strengthened geographic regression failed on the unchanged build because A had no handle. The corrected phone fixture passed on that same build with mouse-miss/touch-N assertions. After the empty-handle fix, all six focused GPU checks pass: ghost tour, valley handle/draw budget, phone target/flight, both 32-disc viewports and geographic lifecycle/no-mesh coverage. Build and all 519 units pass, with two existing TODOs and no skips. Independent source review found no concrete defect. The completed prior full run was 254 passed, 55 existing device skips and three failures; it is not a release pass.
- Main remains gated on a fresh complete GPU run and current-build final journey/cost review after these findings are resolved.
- Frozen-build regression check: corrected phone fixture passes; strengthened geographic lifecycle check fails on the missing A handle. After the narrow source correction, build and all 519 unit tests pass (2 existing TODOs, no skips); all four targeted GPU checks pass (22.1 seconds), including both unchanged stream/valley checks. Independent source review found no additional defect. The rebuilt candidate is `index-0JlwMZEy.js`; its 204-file fingerprint is recorded outside Git before final validation.

#### Earlier verification record

- Continuation baseline: cloud `4f3cad9`, laptop `293f150`; current main `104f4fb` merged cleanly at `27e03d41901a33e7a66358f27bee14f8e728aaa9`. Remote heads rechecked before the fix; no newer cloud fix.
- First independent UX and regression/cost reviews: **block** retained DM card and hover-tip content after switching to Players; a stale reveal action could mutate state. **Fix** preview at t=0 retained Places controls/unknown landmarks; stale asynchronous cards reopened after dismissal or superseded a newer same-pin request; drag drop ignored the final pointer-up coordinates; Places lacked keyboard activation. Seven new browser regressions failed on the baseline before code changes.
- One first fix pass: invalidate cards/tips by audience and campaign; identify each pending card request; recheck actions against current permissions; use the player-facing audience for landmark visibility; process release coordinates before clearing a drag; expose a semantic Places action button. Merge integration also updates nested-world test fixtures to the existing `quiet()` helper so the welcome card does not obstruct unrelated tests. Its dedicated tests remain intact. Help's version-label regression is a separate concern recorded in the collaboration ledger.
- Journey evidence: desktop wheel-only valley -> Vallaki -> Blue Water Inn -> room distance -> valley passed without camera injection. Real iPad touch journeys passed for the Inn, Death House, and Sheep Chase tavern. Phone Sheep Chase passed; phone Inn and Death House require the final journey review to resolve gesture aiming. Both fallback sheets, campaign titles and six viewport/campaign toolbar layouts were checked. These results do not claim exhaustive inventory coverage.
- Cost/safety: real Intel Graphics ANGLE D3D11; five additional warmed round trips stayed at 172 geometries, 5 textures, 66 programs; post-GC heap 79,697,141 -> 80,655,128 bytes (+1.20%); no non-local requests in that journey. Concurrent-load timings are provisional, not a frame-budget pass. Full measurements and known second-release limits go in the report.
- Still open for final review: 32 inventory markers versus 28 implemented markers (M2-M5 consolidated into the Mount Baratok label); phone child entry; exhaustive inventory evidence; quiet performance timing; full browser suite; copied-text check. No claim that the cloud's earlier reviewers completed.
- Baseline and first-fix build pass; unit suite 33 files, 514 passed, 2 skipped, 2 todo. Initial full browser baseline was interrupted after the welcome-card obstruction was identified in nested specs. CI 38437615945 is now complete: 173 passed, 55 skipped, 2 failed (Books version label and rules-grappling reader). Untouched-main local comparison reproduced the version-label failure; the reader case passed. Final counts are pending.

### Final three-lens check and its one fix pass (ChatGPT, 2026-10-13)

- Journey: **block**, phone capacity two could not admit the Inn beneath the two-unit Vallaki parent. The failing pure-planner regression now passes with an allowance limited to the child under the camera and its necessary ancestors; unrelated maps retain the original cap. Real phone pan/pinch now reaches the Inn at room scale and returns to the valley; Back and root breadcrumbs pass.
- Look: **fix**, M2-M5 markers were missing against inventory 7/32; all 32 keys now have markers and the Places list still has one mountain row. The phone pastoral title clipped in inspected screenshots; it now wraps within available width. Its automated bounding-box test did not reproduce the earlier clipping, so screenshots are the original evidence. Three viewport sizes and both campaigns were inspected; the known land/topography limits remain deferred.
- Safety: **block**, a wilderness card could name an unrevealed landmark after switching to Players or t=0; **fix**, Escape during a pending name lookup could reopen the card. Both were reproduced before fixes and now pass dedicated browser regressions. The flat card uses the same filtered nearest-name helper. Cancellation and repeated travel preserved state and restored camera controls.
- Full first-fix GPU suite: 230 passed, 55 skipped by existing device rules, 7 failed. The failures were two flat-selector pin sweeps, one flat-selector rules surface, a lazy-texture memory baseline, a full-region triangle excess and two building-card fixtures crossing into streamed child maps. Fallback tests now explicitly select the flat sheet and also exercise nested cards; memory baselines warm persistent world resources without loosening limits; full-region rendering uses existing simple proxies; building-card fixtures frame outside the child handover with streaming enabled. Targeted reruns pass all seven cases. Final full versioned run remains required.
- The original 300,000 triangle and 70 draw limits pass; region rendering measured 233,886 triangles and 8 calls. Five additional warmed trips retain exactly 170 geometries, 5 textures and 66 programs; post-GC heap grows 1.10%. The report records synchronized timing and comparison caveats.
- Release text gate: all 258 OCR pages checked. Reworded 53 generated prose fields through 14 authoring sources; no geometry, grid, page or parent metadata changed. Six remaining matches are permitted canonical names/rule phrases. Rules links remain 5,884 over 6,108 fields, with no unreviewed link; five gold offsets were reanchored to the same words and IDs, and the count snapshot is unchanged. All 45 outdoor audit results are identical before/after sanitation.
- Evidence is outside the repo at `C:/Users/mrein/Documents/Codex/2026-10-13/task-10/evidence/`: `final-journey/`, `final-look/`, `safety/`, `final-targeted/`, copied-text and regeneration/audit summaries. No screenshots or OCR are committed. See `item2-report.md` for final release status and compliance.

### Release integration check (ChatGPT, 2026-10-13)

- First versioned full GPU suite: 243 passed, 55 existing device skips, one failed in 12.7 minutes. The unchanged valley-label regression expected tooltip metadata on all 32 markers and found 28. Actual nested hover already worked for M2-M5, but mapless markers lost the simple DM name metadata.
- Independent review approved one narrow integration fix, `1459d18`: retain the DM name on every marker, omit the flight subtitle when there is no scene path, and still remove both metadata fields for Players. No test assertion changed.
- Independent corrected build and units pass (33 files; 515 passed, 2 skipped, 2 todo). Focused Books, welcome-card and world-map safety run: 28 passed. Full corrected GPU run and final runtime inspection are in progress; main release remains gated.

## 2. What you are continuing

- **Branch:** `claude/wip/item2-nested-world` on GitHub. Make your own branch from it and merge the main branch in with a merge commit:
  ```powershell
  git fetch origin
  git checkout -b item2-nested-world-gpt origin/claude/wip/item2-nested-world
  git merge claude/mistlab-curse-strahd-x6jm13
  ```
  If `AGENTS.md`'s Status says the laptop's Claude session already has a local `item2-nested-world` branch with the main branch merged in, start from that one instead.
- **Design reference:** `docs/WORLD.md` on the branch. Its last section, "The world map", says what was built, what players see, and what is not done.
- **What is built:** the valley with every map opening in place at its pin (step 2); maps streaming in and out as the camera moves (step 3); nesting, so buildings, area maps and dungeons open inside their town as you keep zooming, with a breadcrumb and Back (step 4); and the World map button opening the nested world as an inked D&D map that blends into the 3D world as you zoom in, with every feature of the old flat sheet carried over (`app/src/ui/worldnest.ts`, `app/src/render/worldcarto.ts`, `worldletters.ts`, `worldglyphs.ts`).
- **Not in this release** (Matt's decision, 2026-10-13): the topography, step 5 (the Player Display), step 7 (phones and performance) and step 8 (the data pass). They are the second release: `docs/HANDOFF.md` section 4. List them under known limits; do not build them now.
- **The old sheet stays reachable** as the fallback: `?nested=0`, or View › Continuous world off.

## 3. What Matt asked for (the acceptance)

- "All lands maps and areas need to be nested smoothly into a world map at full zoom out."
- "The zoom in zoom out nesting doesn't seem to be functioning as intended." It must work now: a continuous zoom from the whole valley into a town, into a building, to a room, and back out, with the wheel and by touch.
- "The world map button should be a nested D&D stylized map that you can zoom into."
- Earlier asks the world map must still honour: D&D stylization; a hex scale overlay; visible features, not just markers; click a place to open it; hover tips for the DM and for players, with the DM hiding and revealing them; the party marker that mirrors the campaign and can be dragged to travel, with the travel card.
- Players and the Player Display never see the symbol, label, proxy or map of a place they do not know (approved fix A4).

## 4. Verification: three passes, each written down

Write each pass's findings into section 1 of this file as you go, with severity: **block** (an ask above not met, or something broke), **fix** (a real defect), **nit** (polish). Be adversarial: do not confirm what you have not seen or measured yourself.

**Pass 1, the journey.** As DM, start from the World map button. Zoom with the wheel only, continuously, from the whole region to Vallaki, into the Blue Water Inn, to a room, and back out to the region. Then the same by touch on a phone-sized window (390x844). Then the village of Barovia and Death House. Then A Wild Sheep Chase, from its region to the tavern. Record every pop, hitch, wrong placement, lost input, and place you cannot reach. Then go through `docs/handoff/item2-feature-inventory.md` and prove that each feature of the old sheet works in the nested map and in the `?nested=0` fallback.

**Pass 2, the look.** Judge the D&D styling at full zoom-out, at mid zoom, and at the hand-off into the 3D world, in both campaigns (Barovia gothic, the Sheep Chase pastoral), at desktop (1366x768), phone (390x844) and TV (1920x1080) sizes. Does it read as a D&D map? Are mountains, forests, rivers, lakes, roads and places visible and legible? Does the realistic world take over without a clash? Do not judge the land's heights against the module map; that is the later topography release. Do check that nothing this release added breaks the land, or how an outdoor map meets it.

**Pass 3, cost and safety.** `npm run build`; `npx vitest run`; the full browser suite on the GPU (`$env:PW_GPU="1"; npm run test:e2e`). Measure draw calls, triangles, ms per frame and JS heap at full zoom-out, over Vallaki, and inside a building, against the main branch. Check `?nested=0` renders as before; the Player Display mirrors the DM; players never see unrevealed places, DM notes or hidden tokens; five map round trips keep memory flat; nothing loads from the network at runtime.

**The one fix pass.** Fix every block and fix issue at its root, with a test that failed first where a test fits. Re-run what the fix touched. Nits only if cheap. Then re-screenshot what changed and look.

## 5. Completeness check

Ask: what is missing against Matt's words? A feature of the old world map not carried over; a place you cannot zoom into; a claim nobody verified with evidence; a step left half done. List each gap with what it would take. Gaps that belong to the second release go under known limits. Small gaps go into the fix pass. The rest are listed, not built.

Things the builder already knows are not done: land names are not curved along their paths; the map's title is always top left; the phone shader tier is defined but was never measured; Lake Zarovich's land name is dropped whenever pin L shows; forest clearings and flattened map footprints stay visible to players as land; on a phone the whole region is small.

## 6. The report

Write `docs/handoff/item2-report.md` in plain words for Matt: what the World map button does now; what you can zoom into; what still does not work; the test and performance numbers; the head commit. Take six screenshots of the journey for Barovia and six for the Sheep Chase, and a short screen recording if it is easy. **Save them outside the repository** (images are never committed) and say where in the report. Claude Code adds them to the Visual-Aide repository when it is back.

## 7. The release

Follow the procedure in `docs/QUEUE.md`: merge the main branch in (merge commit), set `package.json` and `package-lock.json` to the next minor version in release order (0.3.0 unless the main branch has moved past it), add the dated changelog entry at the top of `docs/CHANGELOG.md` in plain words for the DM and the players with a line of known limits (including the second release), make sure Help shows the version, pass the full test suite, tick item 2 in `docs/QUEUE.md`, update its row in `docs/HANDOFF.md`, push the main branch, and write under Status in `AGENTS.md`: "0.3.0 is on the main branch, ready to publish", with the test counts. Publishing to the mistLAB link and the Visual-Aide screenshots are Claude Code's.

Before pushing, check the branch's text against `reference/ocr` for any run of eight or more words copied from the module, and reword it (names and rules phrases are fine).
