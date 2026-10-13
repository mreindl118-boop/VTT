# Item 2, the nested world: verify, report and release (handoff to ChatGPT)

Owner (Matt), 2026-10-13: "finish the build step, then prepare verify and report as a handoff to GPT and instruct them to continue." The cloud Claude Code session finishes the world-map build step and pushes it. ChatGPT does everything from there: the verification, the one fix pass, the completeness check, the report, and the release. Read `AGENTS.md` first; it has the rules, the branches and the commit trailer.

## 1. State at handoff

Filled in by the cloud session when the world-map step ends. Until then: the branch head is `4f3cad9` (the world map built), its two reviewers started at 16:21 UTC on 2026-10-13, and the one fix pass follows if they find anything.

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
