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

### 1d. The cloud's full test run on `1459d18`

(filled in when the run finishes: build, unit tests, the full browser suite)

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
