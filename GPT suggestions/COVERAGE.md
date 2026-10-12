# Review coverage

Review date: 2026-10-12 UTC. Source snapshot: `f615be1d92d5b7a8c31adc4f7808a422644fe55d`.
Repository: `mreindl118-boop/VTT`. Existing branch: `claude/mistlab-curse-strahd-x6jm13`.

## Method and boundaries

Read source directly using the connected GitHub tools. The unsuccessful clone attempt created no local checkout or branch; no clone was retried after Matt's correction. This review spans every executable source/test module in the snapshot, with the different reading depths recorded below.

The repository tree contains 265 tracked files. Its 121 TypeScript, Python, JavaScript, shell, and CSS files contain approximately 1.87 MB of source. Full-module review does not establish correctness of every possible interaction.

| Area | Source files | Review depth |
|---|---:|---|
| App entry/orchestration, data bindings, campaigns, bestiary | 5 | Fully read |
| Core logic, state, UI, and unit tests | 37 | Fully read: 12 core, 3 state, 7 UI, 15 test files |
| Rendering and styles | 8 | Fully read: 7 render modules and CSS |
| Procedural kit | 24 | Complete retrieval and structural scans of every module; fully read 16 smaller modules, focused body reads in 8 large modules |
| Authoring and maintenance scripts | 39 | All algorithm/control-flow/serialization paths reviewed; long description and scenery tables structurally scanned and sampled |
| Service worker, browser tests, and TS build/test configuration | 8 | Fully read: service worker, 5 E2E files, Vite and Playwright configurations |
| **Total** | **121** | All source modules covered; detailed geometry/content verification remains open |

For the kit, the 16 full reads comprise creatures, palette, pieces, surfaces, site index, and eleven wild-* stubs. The eight larger bodies are props and sites q/s/t/u/w/wild/x. Individual mesh/vertex literals were sampled. Authoring contains 36 Python map/helper scripts plus the seed builder, manifest report, and OCR script.

Additional contextual reads included README, collaboration guidance, queue, approvals, campaign/pipeline/slider documentation, the existing audit overview/coverage, and relevant prior reports. Historical planning documents were consulted selectively. Package metadata, dependency engine requirements, tsconfig, gitignore, HTML, PWA manifest, and SVG icon were inspected.

## Structural data pass

Parsed all **98 tracked location/manifest JSON files**, including all **45 scenes** and **45 grids**, two regional worlds, one Castle exterior record, and five manifests. Vallaki's 1,180,516-byte scene was retrieved by blob SHA after the file reader returned empty content.

The scenes contain **103 levels, 716 rooms, and 19,752 objects**. Checks found no duplicate level/object/wall/link IDs within their checked scene namespaces, missing grid records for scene levels, unresolved link levels, unresolved entry/parent/child-scene paths in the checked fields, unresolved object wall references, or missing world-pin scene paths.

Those checks establish structural consistency only. The authoring findings show that absent intended geometry can still satisfy such checks: an authored doorway omitted entirely has no broken JSON reference.

Eight grid levels require coarse coverage under the current size-selection rule. Six have origins misaligned with a world-zero cell lattice, including Vallaki, the Village of Barovia, Krezk, Berez, and both Yester Hill levels. This supports G03's concrete map exposure.

A focused E5-to-N1 object comparison found 23 copied objects whose source dimensions are absent from the N1 copy. This supports G17; intentional differences require Claude/Matt review.

## Existing decisions and concurrent work

The earlier audit's fourteen proposals have already been folded into queue items by Matt. They were reviewed for overlap and linked, rather than republished as new pending decisions.

Claude updated README and collaboration guidance while this review was underway. Comparison from the reviewed snapshot to `58997dabe6d91ab985e31bb5c580ad60a6273f79` showed only those two documentation paths changed. Their current guidance was read before preparing this handoff.

The branch then advanced to `ef608520324b3a368c15e791324e5728116df24e`, adding Claude's [independent review](../docs/REVIEW.md), an approved explored-memory dilation fix, its regression tests/version update, and queue guidance. These concurrent changes are preserved. The current coverage source was reread: G03's origin mismatch remains unchanged and is distinct from the repaired dilation. The earlier audit's explored-growth issue is now recorded as completed queue item 0. Claude's review overview and additional-issue list were checked for overlap with this document's new proposals.

Publication uses the current branch head and preserves concurrent changes; future code changes may invalidate snapshot findings.

## Verification limits

No application build, unit/E2E test execution, browser session, generator regeneration, OCR, or deployment was performed. This task publishes Markdown review documents only.

Still to verify, where approved:
- Runtime reproductions and the proposed regression checks.
- iPad/Safari behavior, touch interaction, offline operation, and multi-window timing.
- Actual visual geometry, clipping, shader compilation, and performance/memory measurements.
- Content/statistics accuracy against source material and every literal authoring/mesh table.
- Current work branches or patches referenced by the queue, which are outside this source snapshot.
- Exhaustive accessibility, dependency vulnerability, and licensing audits.

## Complete source inventory

```text
app/public/sw.js
app/src/app.ts
app/src/bestiary.ts
app/src/campaigns.ts
app/src/core/coverage.ts
app/src/core/geometry.ts
app/src/core/grid.ts
app/src/core/light.ts
app/src/core/movement.ts
app/src/core/range.ts
app/src/core/schema.ts
app/src/core/sky.ts
app/src/core/slider.ts
app/src/core/terrain.ts
app/src/core/travel.ts
app/src/core/units.ts
app/src/data.ts
app/src/kit/creatures.ts
app/src/kit/palette.ts
app/src/kit/pieces.ts
app/src/kit/props.ts
app/src/kit/sites/index.ts
app/src/kit/sites/q.ts
app/src/kit/sites/s.ts
app/src/kit/sites/t.ts
app/src/kit/sites/u.ts
app/src/kit/sites/w.ts
app/src/kit/sites/wild-a.ts
app/src/kit/sites/wild-b.ts
app/src/kit/sites/wild-d.ts
app/src/kit/sites/wild-f.ts
app/src/kit/sites/wild-h.ts
app/src/kit/sites/wild-i.ts
app/src/kit/sites/wild-j.ts
app/src/kit/sites/wild-l.ts
app/src/kit/sites/wild-m.ts
app/src/kit/sites/wild-p.ts
app/src/kit/sites/wild-r.ts
app/src/kit/sites/wild.ts
app/src/kit/sites/x.ts
app/src/kit/surfaces.ts
app/src/main.ts
app/src/render/backdrop.ts
app/src/render/build.ts
app/src/render/gridOverlay.ts
app/src/render/materials.ts
app/src/render/openable.ts
app/src/render/rangeOverlay.ts
app/src/render/world.ts
app/src/state/campaign.ts
app/src/state/channel.ts
app/src/state/idb.ts
app/src/styles.css
app/src/ui/bestiary.ts
app/src/ui/encounter.ts
app/src/ui/icons.ts
app/src/ui/library.ts
app/src/ui/minimap.ts
app/src/ui/viewSlider.ts
app/src/ui/worldmap.ts
e2e/grid.spec.ts
e2e/helpers.ts
e2e/move.spec.ts
e2e/slider.spec.ts
e2e/ui.spec.ts
playwright.config.ts
scripts/authoring/amber-temple.py
scripts/authoring/argynvostholt.py
scripts/authoring/audit-outdoor.py
scripts/authoring/authorlib.py
scripts/authoring/barovia-cover.py
scripts/authoring/barovia-world.py
scripts/authoring/berez.py
scripts/authoring/castle-ravenloft.py
scripts/authoring/creeping-hut.py
scripts/authoring/death-house.py
scripts/authoring/heightfield.py
scripts/authoring/import-mapset.py
scripts/authoring/import-ml.py
scripts/authoring/krezk-abbey.py
scripts/authoring/krezk-village.py
scripts/authoring/krezk_land.py
scripts/authoring/noke-tower.py
scripts/authoring/old-bonegrinder.py
scripts/authoring/ravenloft-exterior.py
scripts/authoring/settle.py
scripts/authoring/stl-terrain.py
scripts/authoring/tsolenka-pass.py
scripts/authoring/vallaki-sites.py
scripts/authoring/vallaki-square.py
scripts/authoring/vallaki-town.py
scripts/authoring/van-richten-tower.py
scripts/authoring/village-map.py
scripts/authoring/village-roads.py
scripts/authoring/werewolf-den.py
scripts/authoring/wilderness.py
scripts/authoring/wildlib.py
scripts/authoring/wire-sites.py
scripts/authoring/wizard-of-wines.py
scripts/authoring/wsc-cover.py
scripts/authoring/wsc-town.py
scripts/authoring/yester-hill.py
scripts/manifest-report.ts
scripts/ocr.sh
scripts/seed/build-manifests.py
tests/bestiary.test.ts
tests/containers.test.ts
tests/coverage.test.ts
tests/grid.test.ts
tests/manifests.test.ts
tests/movement.test.ts
tests/no-book-content.test.ts
tests/player-safety.test.ts
tests/range.test.ts
tests/scale.test.ts
tests/sky.test.ts
tests/slider.test.ts
tests/travel.test.ts
tests/units.test.ts
tests/vision.test.ts
vite.config.ts
```
