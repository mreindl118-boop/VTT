# Handoff: the owner's laptop becomes the development and test machine

Owner, 2026-10-13: "I want this laptop to be the testing grounds and development space for the VTT."

Until now, Claude Code worked on mistLAB in a cloud session. That machine had 4 cores and no graphics card, so every 3D browser test rendered in software, and each queue step took 6–8 hours. From now on the work runs in a Claude Code session on the owner's laptop, on its GPU.

The cloud session finishes the two items it has in flight, then stops taking new items:
- item 7 (unfinished maps);
- item 2 (nested world, first release).

If Claude Code is out of credits or inactive, ChatGPT continues the work by `AGENTS.md` at the repository root, whose Status section says where each item is right now.

## 1. Set up the laptop (once)

1. **Install:**
   - Node.js 22 or newer;
   - Git;
   - Python 3.11 or newer, with `pip install numpy scipy shapely pillow` (the map generators in `scripts/authoring/` use them);
   - for OCR: Poppler (`pdftoppm`) and Tesseract;
   - optional: ffmpeg, for demo GIFs.
2. **Get the code:**
   ```sh
   git clone https://github.com/mreindl118-boop/VTT.git
   cd VTT
   git checkout claude/mistlab-curse-strahd-x6jm13
   npm install
   npx playwright install chromium
   ```
3. **Restore `reference/`.** It is gitignored and was never on GitHub.
   - Put your copy of the module at `reference/module/curse-of-strahd.pdf`, then run `npm run ocr` to rebuild `reference/ocr/`.
   - Put the files you imported earlier back in `reference/imports/`. `scripts/authoring/import-ml.py`, `import-mapset.py`, `village-map.py` and `wsc-cover.py` read them.
4. **Check it works:**
   ```sh
   npm run build
   npx vitest run
   PW_GPU=1 npm run test:e2e
   ```
   `PW_GPU=1` makes the browser tests render on the laptop's graphics card. Without it they use software rendering, as in the cloud. If a test passes in software but not on the GPU, note it in `docs/PITFALLS.md` and run that one test without `PW_GPU`.
5. **Start Claude Code in the `VTT` folder,** with `claude` or `claude remote-control`, or open the folder in the Claude Desktop app. Then tell it: "Read docs/HANDOFF.md, docs/QUEUE.md and docs/COLLABORATION.md, then continue the queue."

## 2. Rules that carry over

- **The queue:** `docs/QUEUE.md` is the checklist, the lean review setting and the release procedure.
- **Working with ChatGPT:** `docs/COLLABORATION.md` covers the approval rules, the design choices and the ledger.
- **Never commit:** book text, art or map images, screenshots, scratch files, `test-results` or `node_modules`.
- **Commit trailer:** every commit from the laptop session ends with a line naming the model that wrote it, then the session line:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: laptop
  ```
  The `Claude-Session:` line is how the ledger tells Claude Code's commits from outside changes.
- **Releases:** each one bumps the version in release order, adds a changelog entry, and shows the version in Help. It is then published, and its screenshots go to [Visual-Aide](https://github.com/mreindl118-boop/Visual-Aide) under `releases/<version>-<name>/`. Visual-Aide is shared with the Simulacrum project: fetch and merge before pushing.
- **Publishing:** the mistLAB link is https://claude.ai/artifact/WWdBTAFL2cbyyqghYUYmvN, published from `dist/` with `index.html` renamed to `mistlab.html`.
- **One shared branch:** the cloud session keeps pushing to the shared branch until items 2 and 7 have released. Start the laptop on other items, and pull before every merge.

## 3. Where each item stands

The unreleased work is on GitHub under `claude/wip/`.

| Item | Branch | State and what is left |
|---|---|---|
| 2. Nested world | `claude/wip/item2-nested-world-laptop` | Released on main as 0.3.0: steps 2-4 and the D&D world map verified and fixed by ChatGPT; build, 519 units and 257 GPU browser checks pass (55 existing device skips). The parent task owns the owner-approved alternate private publication; that deployment is separate from this Git release. See `handoff/item2-report.md`. Second release remains pending (section 4). |
| 2d. Bounded 0.3.1 continuity release | `claude/wip/item2-nested-world-laptop`; source release 0.3.1 | Final acceptance, correctness and regression reconciliations pass for verified candidate `1c8d94a`. Versioned `index-CoeOhM3n.js`: build, 543 units, 21 desktop checks and 267 GPU passes / 55 existing device skips / zero failures; CI `38510870342` succeeded. Original ground and triangle limits remain intact. This release records only local/compass/Amber corrections; comprehensive geography remains item 2e. Public compiled-bundle/update-feed publication stays held. See `handoff/item2-continuity-report.md`. |
| 2e. Comprehensive 0.3.2 map logic | Start after bounded 0.3.1 from the laptop WIP; root integrates while online | Matt: "Every map's logic should be correct for 0.3.2." Both campaigns, all 46 maps / 122 levels: terrain, connected roads/rivers/bridges, placements, doors, stairs and source geometry. Separate source, implementation, runtime and visual evidence. Prepare sanitized cloud continuation; preserve source adaptations, identify only essential item 7 components, and do not publish licensed sources or private data. See `handoff/allmap-audit-report.md` and item 2e in the queue. |
| 3. Dollhouse view | none, start from the main branch | Not started. It needs the nested world, so start it after item 2 releases. |
| 4. Movable panels | `claude/wip/item4-movable-panels` (`5aa32c7`) | Built and fixed; unit tests pass. Left: two failing panel browser tests, then merge. |
| 5. Backups | `claude/wip/item5-backups` (WIP `f89512c`) | Left: as `docs/QUEUE.md` item 5 lists. Restore must give back exactly the saved state; one misleading message; G03; N2–N8; four folded suggestions. |
| 6. Finished maps | ten branches `claude/wip/item6-<group>` | One branch per map group. Each group's brief, its issues, the fixer's result and the review are in [`docs/handoff/item6-map-groups.json`](handoff/item6-map-groups.json). Krezk and render were reviewed and still have issues. The other eight are built but not reviewed. Left: review each, run one fix pass, merge the ten, then fix G06, G07, G09–G11 and G13–G17 (each with a failing test first). `item6-backdrop` touches `app.ts`, `backdrop.ts` and `gridOverlay.ts`: merge it after item 2. |
| 7. Unfinished maps | `claude/wip/item7-unfinished-maps` | Released as 0.3.2 (2026-10-18): Yester Hill climbs stretch by stretch, the Amber Temple's closed mountain with its upper and lower levels visible, the winery's cellar, Berez, the hut and the tower. Only the nits in [`docs/handoff/item7-open.md`](handoff/item7-open.md) remain, for the owner to decide. |
| 8. Natural land and water | `claude/wip/item8-natural-land` (WIP `066e37d`) | The diagnosis is done; the build is a WIP. |
| 10. Vallaki terrain | `claude/wip/item10-vallaki-terrain` (`c0fd014`) | Built. Merge after item 8. |
| 11–22 | none, start from the main branch | As `docs/QUEUE.md` lists. Item 11 now includes the owner's report "players can't move anywhere" (door logic). |

## 4. Item 2's second release

The owner moved these four nested-world steps to a second release. Each runs: build, two reviewers, at most one fix pass. They all touch the same code, so run them one after another.

1. **Topography.** The land's heights follow the module's Lands of Barovia map: roads in valleys, lakes in basins, rivers running downhill. Every outdoor map meets its land with no gap or step. Regenerate everything derived from the height with the repo's scripts. (The owner's STL model is unavailable.)
2. **Step 5, the Player Display.**
   - The display window (`?display=player`) follows the DM through the nested world: valley, towns, buildings, the breadcrumb and Back.
   - It stays read-only.
   - It receives only the players' projection.
   - It never shows a place, room or creature the players haven't found.
   - Prove it with tests that open the display beside the DM window.
3. **Step 7, performance and phones.**
   - Measure frame time, draw calls, triangles and memory at full zoom-out, over Vallaki, inside the Blue Water Inn and over Castle Ravenloft, on desktop and on a phone-sized screen. Budget: about 16 ms a frame on desktop, about 33 ms on a phone, no hitch over 100 ms when a map streams in, and memory steady over five round trips.
   - Fix what is over budget at its root.
   - Make every nested-world control work by touch.
4. **Step 8, the data pass.**
   - Every map the atlas places sits at its pin with the right scale, rotation and height.
   - Every building interior sits on its town's model of that building.
   - Duplicate models are hidden.
   - Settle the items `docs/WORLD.md` leaves for "the data pass".
   - Add a test that checks every placement.

## 5. Desktop delivery and the owner's 0.3.1 request

0.3.0 is installed as a local Node/Edge desktop app, with a fixed loopback origin and dedicated persistent profile. The parent owns the alternate private web deployment. `docs/DESKTOP.md` records the tested update protocol and publishing procedure. No desktop distribution tag has been published: new public compiled-bundle publication is held pending the parent's destination clarification, and the exact source release CI must pass first. Existing website/browser campaign data remains untouched, not silently migrated.

The owner subsequently requested a separate 0.3.1 release for concrete landscape-continuity defects, plus compass north alignment; queue item 2d records the scope. The cloud's parked Amber Temple correction must be inspected first to avoid duplicating its work. This new narrow authority covers the requested exposed entrance/terrain correction, not a wholesale item 7 merge or its other maps. Keep its branches intact and record any reused source commits.

On 2026-10-14 Matt assigned comprehensive all-map logic to 0.3.2 and authorized an overnight effort with independent agents and cloud continuation if this laptop goes offline. Finish bounded 0.3.1 first with explicit known limits. For 0.3.2 use source descriptions, physical logic and connected landscape context: Tser Falls must include a credible upstream channel, crest/drop, broad gorge/pool and downstream continuation, with bridge/road approaches and regional blending. Label canonical constraints versus interpolation. The parent provisions the cloud fallback; root retains integration ownership while online. Checkpoint code and sanitized evidence in Git, never licensed PDFs/art, personal files, credentials or campaign saves. Public desktop distribution remains separately held.
