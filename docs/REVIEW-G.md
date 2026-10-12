> Claude Code's independent verification of ChatGPT's suggestions G01–G17 (`GPT suggestions/REVIEW.md`), done 2026-10-12 against release 0.1.0 and the unmerged branches. Reproduction scripts lived in the session scratchpad and are not committed. Matt approves or denies each; decisions are recorded in `docs/QUEUE.md`.

# Independent check of the G01–G17 suggestions (`GPT suggestions/REVIEW.md`)

I checked these against main `23ac1c1` (release 0.1.0). The suggestions were written at `f615be1`. Every cited code path is unchanged on main; only line numbers moved (for example `removeToken` is now at `app.ts:871` and the travel arithmetic at `main.ts:241`).

**Worktrees I checked (read-only, with `git show` and `git grep`):**
- nested world `53d3b41`
- zoom fix `c3557f9`
- panels `5aa32c7`
- backups `f89512c`
- map smoothing `252-6` to `252-18`
- chapter 2 `4e3-23` to `4e3-33`
- natural land `066e37d`
- Vallaki terrain `c0fd014`

**How I reproduced things:**
- **Unit checks:** three vitest files (`zz-review-g*.test.ts` here). Each was copied into `tests/`, run on its own, then deleted.
- **Browser runs:** two runs of one Playwright script (`pw-g.mjs`) against a build in this scratchpad, served on port 5871. The server is stopped.
- **OCR:** a stubbed run (`ocr/`) with fake `pdfinfo`, `pdftoppm` and `tesseract`.
- **Generated scenes:** Python scans of `locations/`.

**Clean-up:** `git status` is clean on main and in every worktree.

## Summary

| ID | Suggestion | Verdict | My sev. | Reproduced? | Already fixed somewhere? | Queue item | Owner decision? |
|---|---|---|---|---|---|---|---|
| G01 | Roll the intended roster when nothing is ticked | CONFIRMED | P2 | Yes (browser) | No | 13 | Small: confirm "nothing ticked = everyone" |
| G02 | Keep the active combatant when another is removed | CONFIRMED, plus removing the active one | P2 | Yes (browser) | No | 13 | Yes: what happens when the active one is removed |
| G03 | One cell origin for coarse fog | CONFIRMED (shift of up to one cell, on 7 coarse levels) | P3 | Yes (unit) | No | 5 | No |
| G04 | Walking must stay on floor | CONFIRMED (unit); not measured on real maps | P3 | Yes (unit) | No | 14 | **Yes: the walking/gap rule** |
| G05 | Travel time at exactly 8 h | CONFIRMED, and the readout disagrees with the button | P2 | Yes (unit) | No | 14 (0.8.0, A19) | **Yes: the travel-day convention** |
| G06 | Site builders overwrite each other | CONFIRMED (only `divan` and `candelabra` collide) | P2 | Yes (unit) | No | 6 | No |
| G07 | Clipped shells need their own materials | CONFIRMED, and broader: leaks to later, ordinary maps | P2 | Yes (unit, built in Node) | No | 6 | No |
| G08 | Ground mist after switching it back on | CONFIRMED, plus the reverse bug after the floor-mask view | P3 | Yes (browser) | No (same lines in nested world, unchanged) | 11 (touches 2) | No |
| G09 | Locked-door band moves with the leaf | CONFIRMED | P3 | Yes (browser) | No | 6 | No |
| G10 | The Tower's world-map link survives regeneration | CONFIRMED mechanism; V's entry already fixed on a branch | P3 | Yes (regex check) | **Partly: `252-9` sets V's scenes; the regex is still fragile** | 6 (region) | No |
| G11 | Boundary overrides must match emitted segments | CONFIRMED, and worse: the WSC square is sealed from both streets | P2 | Yes (scene scan and canWalk) | No | 6 (WSC), 7 (Amber Temple) | No |
| G12 | Retry failed OCR pages | CONFIRMED (latent: 0 of 259 pages carry the marker today) | P3 | Yes (stubbed run) | No | none (tooling); 22 or any time | No |
| G13 | Make the grid occlusion check meaningful | CONFIRMED (the assert can never fail) | P3 | By inspection | No | 6 (render) | Small: what the test should promise |
| G14 | Detect authored doors that vanish | CONFIRMED, and broader: 45 of 87 Vallaki doors, plus K28 and K63 | P2 (P1 for Vallaki in Players mode until `252-10` lands) | Yes (scene scan) | **Vallaki: yes, `252-10` emits them all. Castle: no** | 6 | Yes, small: whether door or opening wins |
| G15 | Counters and railings as real geometry | CONFIRMED (Krezk 0 of 6, WSC street and stalls lost) | P3 | Yes (scene scan) | No (`252-6` still emits none) | 6 | No |
| G16 | Leave the Castle's entry passages open | CONFIRMED | P2 | Yes (canWalk on the real scene) | No (`252-11` unchanged) | 6 | No |
| G17 | Keep geometry when reusing the church | PARTLY: 23 copies lose dims, but benches and altar look the same | P3 | Yes (scene diff) | No (`252-10` copies the same way) | 6 | Yes, small: which differences are intended |

I found nothing to DISAGREE with. One verdict is narrower than claimed (G17). Six findings are broader than claimed: G02, G05, G07, G08, G11 and G14. The most useful finds:
- **G07:** once a stacked site such as Death House has been opened, the section plane stays on shared palette materials. Props on later, ordinary maps then get cut at the 5-ft low-wall line.
- **G11, G14, G16:** players' tokens can't walk into the Castle gate, the WSC square, or many Vallaki rooms.

---

## G01: Roll initiative with nothing ticked rolls only the first roster member

**Verdict: CONFIRMED.**

**Code:** In `ui/encounter.ts:65`, `inits.size === 0` is tested inside the roster loop. The first sheet it adds makes the map non-empty, so later sheets are skipped.

**Reproduced** (browser): 4 roster sheets, none ticked, then Roll gives ticks `[true,false,false,false]`.

**Also:** if only placed creatures are ticked, Roll still drags in the first roster member, because the test ignores `cinits`.

**At the table:** the DM presses Roll expecting the whole party and gets one character. They have to tick everyone by hand. Annoying, not dangerous.

**Severity:** P2.

**Queue and branches:** item 13. No branch changes it.

**Fix:** read `const all = inits.size === 0` before the loop. Decide whether ticked creatures count as "a selection". I'd say no: rolling with no PCs ticked should still roll everyone. A one-line change.

**Proving test:** a component or e2e test. With 3 sheets and nothing ticked, Roll gives all 3 initiatives. With 1 ticked, only that one. With an empty roster, nothing.

## G02: Removing a creature shifts whose turn it is

**Verdict: CONFIRMED, and it also mishandles removing the active combatant.**

**Code:** `app.ts:871-874` filters the order but keeps the numeric `turn` and `movedFt`.

**Reproduced** (browser):
- Setup: order [Fighter, Rogue, Cleric], Rogue active, 10 ft spent.
- Removing the Fighter makes **Cleric** active, still with 10 ft spent.

**Also:**
- Removing the active combatant hands the turn to the next one with the spent movement intact.
- If the removed one was last, the turn wraps to index 0 without advancing the round.

**At the table:** killing and removing a monster earlier in the order silently skips the current creature's turn, and the next one starts short of movement.

**Severity:** P2.

**Queue and branches:** item 13. All branches carry the same line.

**Fix:**
- Keep the active `tokenId`, filter, then set `turn = order.findIndex(id)`.
- If the active one was removed: keep the same index (the next in order), reset `movedFt`, and if it wraps, `round++`.

**Owner decision:** confirm "removing the active creature passes the turn to the next, fresh, and wrapping starts a new round".

**Proving test:** unit test on App (or extract the order logic to `core/`). Remove before, after, and the active one, and assert the active identity, `movedFt`, `turn` and `round`.

## G03: Coarse fog uses two different cell grids

**Verdict: CONFIRMED, small in effect.**

**Code:**
- `coverage.ts` `idx` and `updateVision` use origin-based cells.
- `cellsIn`, used by `stamp` and by the vision floor mask, and `brush` walk a lattice anchored at zero.

**Reproduced** (unit):
- `CoverageMap(1,1,2,2,2)` stamped with `rect(1,1,2,2)` reveals nothing (paint `[0,0,0,0]`).
- On a Vallaki-like map (origin 56,746, 10-ft cells), a tiny brush at a cell's own centre doesn't reveal that cell.
- An aligned room stamp still came out right: the shift only shows at edges.

**Where it applies:** 7 levels have coarse cells with origins off the lattice: E village, N town, S village and walls, U berez, Y hill and summit. At 1-ft cells nothing changes.

**At the table:** on town-sized maps, reveal stamps, the brush and the vision floor mask sit up to one cell (2–10 ft) off. That can leave a strip of a revealed area dark, or light a strip past it. Dilation hides most of it.

**Severity:** P3.

**Queue and branches:** item 5 (explored memory). No branch touches `coverage.ts`.

**Fix:** make `cellsIn` and `brush` iterate map indices `i, j` and test `originX + (i + 0.5) * cell`. Then all three paths share one lattice. It's cheap. Recompute the cached floor mask.

**Proving test:** the unit fixture above: the cell centred at [2,2] is revealed. Add a misaligned brush case.

## G04: A walk can jump a gap between floors

**Verdict: CONFIRMED in pure code; not measured on authored maps.**

**Code:** In `movement.ts:28-34`, `attach` links a point to any floor node up to two lattice steps away (about 5 ft) if no wall is crossed. It never checks the floor in between. Adjacent steps (2.5 ft) can only skip gaps narrower than the lattice.

**Reproduced** (unit): `rect(0,0,5,5)` and `rect(8,0,5,5)` with no walls. `canWalk([3.75,1.25] → [8.75,1.25])` is **true**: the start attaches straight to the goal's node across the 3-ft gap.

**At the table:** this only matters where floors are separated by un-walled gaps of under about 5 ft: a chasm edge, a pit cut out of the floor, a stream gap. Players' tokens could step across. Most rooms are walled, so it's rare.

**Severity:** P3.

**Queue and branches:** item 14 (gameplay movement). No branch changes it.

**Fix:** in `attach`, also require the segment to stay on floor: sample its midpoint, or step every 1 ft with `onFloor`. **Owner decision needed:** may a walking creature hop gaps under 5 ft (a jump), or only cross floor? If jumps are wanted, make them explicit, for example a "jump" or "difficult" crossing, not an accident of attachment.

**Proving test:** the 3-ft gap case returns false. Adjoining floors, an L-shaped room and a narrow corridor stay true.

## G05: Exactly 8 h of travel advances the clock a whole day

**Verdict: CONFIRMED, and the panel contradicts itself.**

**Code:** `main.ts:241` is `elapsed = floor(h/8)*24 + h%8`.

**Reproduced** (unit):

| Walking time | Clock advance |
|---|---|
| 0 h | 0 h |
| 7.5 h | 7.5 h |
| 8 h | **24 h** |
| 8.5 h | 24.5 h |
| 16 h | **48 h** |
| 16.5 h | 48.5 h |

**Also:** for 8 h the readout says "8 h 0 min" with no "days of travel" note, because it only shows days when `th > 8`. The button still says "Travel: advance 1 d 0 h".

**At the table:** a normal-pace day's walk (24 mi) lands the party at dawn the next day instead of that evening. Night, Strahd's timing and rests all shift.

**Severity:** P2.

**Queue and branches:** item 14 (0.8.0, A18/A19 Barovian time and road travel). No branch touches it.

**Fix:** `h + 16 * max(0, ceil(h/8) - 1)` (rest only *between* travel days), using the same day count as the readout. **Owner decision needed:** does a trip of exactly one travel day end on arrival (my recommendation), or include the night's rest?

**Proving test:** a unit table over 0, 7.5, 8, 8.5, 16, 16.5 and 24 h, and a check that the label agrees with the button. Extract `elapsed` into `core/travel.ts` to test it.

## G06: Q, S and X overwrite each other's `divan` and `candelabra`

**Verdict: CONFIRMED.** A scan of every `Object.assign(PROPS_V1, …)` finds these two collisions and no others.

**Reproduced** (unit, importing the site index): `PROPS_V1.divan` is X's and `PROPS_V1.candelabra` is S's. Effects in the current scenes:
- **Argynvostholt Q6/Q7:** the three divans show X's divan, which carries a spellbook. `ground-Q6-divan2`'s `tipped: 1` is ignored.
- **Q13:** the two floor candelabras become S's gold tabletop fixture, floating at its default `y` of 2.5 ft.
- **S13 and X27:** look as intended.

**At the table:** players see a "spellbook" on Argynvostholt's divans that isn't there, and odd floating candlesticks. A misleading clue, not a broken map.

**Severity:** P2.

**Queue and branches:** item 6 (map smoothing: Argynvostholt, Krezk). `252-6`, `252-7` and `252-16` touch these files but keep the same names.

**Fix:**
- Rename the site-specific kinds (`amber-divan`, `gold-candelabra`) in `x.ts` and `s.ts` and their generators, then regenerate X and S10.
- Add a registration guard: in dev or test, throw on a duplicate key.

**Proving test:** a unit test that imports `kit/sites` and asserts no key is registered twice. Wrap `PROPS_V1` in a proxy, or register through a helper.

## G07: The section plane leaks onto shared palette materials

**Verdict: CONFIRMED, and broader than described.**

**Code:**
- `sectionClip` (`materials.ts:263`) sets `clippingPlanes` on the materials of shell-role meshes.
- Static props and roofs merge per *material object* (`build.ts:260-288`). Floors use the cached `mat()`.
- So a roof built with `mat(iron)` and a stove built with `mat(iron)` share one material, and the plane is never removed.

**Reproduced** (unit; `buildLevel` runs in Node):
- On Q's roof level, `sectionClip` leaves 2 of 20 prop meshes carrying the plane: the stove pipe the suggestion predicts.
- After building Death House and Q, I built ordinary maps without any sectioning. They already had clipped props:
  - Arasek Stockyard N5: 11 of 37 prop meshes, colour `#3a3b40`
  - St Andral's N1: 1 of 30
  - WSC street: 1 of 35 (the roof-cone colour)
- `lowWalls` defaults to true, so on those maps those props are cut at floor + 5 ft.

**At the table:** after the DM visits any stacked site in a session, tall iron props on other maps appear sliced open at waist height until the page is reloaded. On stacked sites, props on the current floor that share a colour with a shell are cut by the slider, against the "props are never cut" rule.

**Severity:** P2. Visual only, but visible and confusing.

**Queue and branches:** item 6 (render). `252-7` and the Vallaki terrain branch rework `materials.ts` and `build.ts`, but neither changes `sectionClip` or the sharing.

**Fix:**
- At build time, give shell-role meshes (floor, wall, door, roof, including the merged-roofs bucket and floors) private materials via `matClone`, which is already fog- and grain-patched. Then have `sectionClip` refuse to touch a material that is in the `mat()` cache.
- Tradeoff: a few more materials, but no extra shader programs (the same `customProgramCacheKey`).

**Proving test:** a unit test. `buildLevel` Q roof, then `sectionClip(on)`: no `role:'prop'` mesh carries `WALL_CLIP`. Then build N5: zero clipped props.

## G08: Ground mist stays off after switching it back on

**Verdict: CONFIRMED, plus the opposite bug.**

**Code:** `world.ts:105` is `mistFloor.visible = on && mistFloor.visible`.

**Reproduced** (browser, Death House): mist floor visible, then off (false), then on with `layoutChanged` still **false**.

**Also:** with mist off, going to the floor-mask render mode and back sets it **true** (`app.ts:1362` ignores `fogOn`). The Player Display applies `setFog` from the layout message (`app.ts:1321`), so it shows the same thing.

**At the table:** after toggling mist off and on, the dark ground disc under indoor maps is gone until the floor changes. The map floats on the page background.

**Severity:** P3.

**Queue and branches:** item 11 (a small night-one fix). The nested world (item 2) rewrites the neighbouring lines (`!this.staged`) but keeps `setFog` as is, so fix it there or after.

**Fix:** one helper, `syncMistFloor()`, giving `visible = fogOn && !backdrop && renderMode === 'normal' && !staged`. Call it from `setFog`, `setLevel` and `setRenderMode`.

**Proving test:** e2e. Mist off, then on: the floor is visible. Mist off, then mask, then normal: the floor stays hidden.

## G09: The locked-door band stays when the door opens

**Verdict: CONFIRMED.**

**Code:** `build.ts:173` adds the wine band to `wallsGroup`; only the slab goes into `doors`. Unlocked doors' iron straps are added to the slab, so those are fine.

**Reproduced** (browser, T `pass`): after opening `T4-door`, the slab is hidden and the band is still visible. 63 locked doors across 12 sites are affected.

**At the table:** an open locked door leaves a red bar hanging across the doorway. It reads as "still shut". Movement and sight follow the wall data, so play isn't blocked.

**Severity:** P3.

**Queue and branches:** item 6 (render). `252-7` and the Vallaki terrain branch still add the band to `wallsGroup`.

**Fix:** `slab.add(band)` with its geometry in the same frame, as the straps do. One line. The picking still works because the band keeps `role:'door'` and `wallId`.

**Proving test:** e2e. Toggle `T4-door`: every mesh with `wallId === 'T4-door'`, except the frame, is hidden. Reload with it persisted open: same result.

## G10: Regenerating the world can drop Van Richten's Tower link

**Verdict: CONFIRMED mechanism; the V entry is already fixed on a branch.**

**Code:** the `wire-sites.py:27` regex needs `'Name'`. V's name is double-quoted because of the apostrophe, so the substitution silently misses. On main the generator has `('V', "Van Richten's Tower", …, [])`, while world.json has `ch11/V`. `keep_notes` keeps only `blurb` and `dm`, so a regenerated world loses V's scene.

**Reproduced:** the regex matches A, S and Q but not V.

**Branches:** `252-9` (region) writes `['ch11/V']` into the table by hand, but the regex is still fragile.

**At the table:** only after a regeneration. The tower pin would stop opening its map.

**Severity:** P3.

**Queue:** item 6 (the region).

**Fix:**
- Have `wire-sites.py` import the PIN table, or keep `SCENES` as the single source that `barovia-world.py` reads.
- At minimum, fail loudly when a wired key isn't matched.
- Have `keep_notes` also keep `scenes`.

**Proving test:** run `barovia-world.py` into a temp path, then assert every pin in `SCENES` keeps its scenes, V included.

## G11: Whole-edge overrides miss the per-cell wall segments

**Verdict: CONFIRMED, and the consequence is worse than "walls retained".**

**Code:** `authorlib.unit_edges` splits axis-aligned edges into 1-cell keys. `wsc-town.py:144` and the Amber Temple's `open_seg` key the whole edge, so axis-aligned sides never match. Diagonals do match.

**Reproduced:**
- **WSC street:** walls remain on all four axis sides of the octagon (`L0-w-0` to `L0-w-9`).
  - The square's shared sides with Main Street (x=45 ft) and East Lane (x=105 ft) are solid.
  - On the real scene, `canWalk` from Main Street into the square, and from East Lane into it, is **false**.
  - It becomes **true** when only those walls are removed.
- **Amber Temple:** `upper-w-266` to `upper-w-271` are 30-ft walls along X23's broken edge. They are unchanged on `252-13`.

**At the table:** in Players mode the party can't walk from either street into the WSC town square, and can't see in. The X23 balcony is walled where it should be a drop.

**Severity:** P2. The DM can drag tokens.

**Queue and branches:** item 6 (WSC), item 7 (Amber Temple). No branch fixes it.

**Fix:**
- Give the `Level` class one `override(a, b, **kw)` that routes axis-aligned edges through `_stamp` and others through a direct key. Use it in `wsc-town.py` and amber-temple's `open_seg`.
- Have `build_walls` report every override key that matched no emitted segment (and no `extra`).

**Proving test:** run the generators into temp output. On WSC, `canWalk` from Main Street and from East Lane into the square is true. On X, no wall overlaps the X23 broken edge. The generator's "unmatched overrides" list is empty.

## G12: A failed OCR page is never retried

**Verdict: CONFIRMED, latent.**

**Reproduced** (fake `pdfinfo`, `pdftoppm` and `tesseract`):
- Run 1 fails, so both pages hold the timeout marker.
- Run 2 succeeds, but both pages still hold the marker: they are skipped.

Today's `reference/ocr` has 259 pages and none hold the marker.

**At the table:** none directly. A future re-OCR could silently keep holes in the reference text.

**Severity:** P3.

**Queue and branches:** no item (tooling). It fits item 22 or any idle moment.

**Fix:**
- Skip a page only if it is non-empty and not the marker. Better: write failures to `page-NNN.failed`, not `.txt`.
- Run tesseract into `$base.tmp` and `mv` it on success, so an interrupted run never leaves a partial page that looks done.

**Proving test:** the stubbed fail-then-succeed run here, as a shell test.

## G13: The grid occlusion assertion can't fail

**Verdict: CONFIRMED.**

**Code:** `e2e/grid.spec.ts:25` is `expect(r.outside).toBeGreaterThanOrEqual(0)`. The comment above it still says "the leak check below stays strict". The file's header promises that walls, props and characters occlude the grid, and nothing checks that now. All worktrees have the same line.

**At the table:** none directly. A grid painted over walls or props would pass the suite.

**Severity:** P3.

**Queue and branches:** item 6 (render; `252-8` changes `gridOverlay.ts`, so this test matters there).

**Fix:** add an occluder mask mode, or reuse the floor mask's black-wall materials, that paints walls, props and tokens black and *all* ground, apron included, white. Assert that `outside` (grid pixels on occluders) stays under a small tolerance. Fix the stale comment.

**Owner decision (small):** confirm the promise is "never over foreground", not "only on floor polygons".

**Proving test:** temporarily set the grid material's `depthTest = false`. The new assertion fails. Restore it and it passes.

## G14: Authored doors silently disappear

**Verdict: CONFIRMED, and much broader.**

**Reproduced** (scan of every literal `door(…, id=…)` against the generated walls):
- **Vallaki (`vallaki-sites.py`):** 45 of 87 authored doors are missing on main. Among them:
  - all of N3a-front, N4a-front and N4e-back
  - N5d-door
  - most of N2, N3 and N4
  - N1 has **0** doors (its 5 church doors are lost)
- **Castle Ravenloft:** K63-door is missing (an `Op` over the same span sets `open_wall`, which wins). So is **K28-doors**, which the suggestion didn't name.

**At the table:**
- Where a door sat on a room edge whose split didn't match, the edge stays a solid wall, so players' tokens can't enter rooms of the Burgomaster's mansion, the Wachterhaus or the inn.
- Where the door was inside a room (N5d), there's simply no door to lock.
- K63 is an open hole with no door.

**Severity:** P2. Until `252-10` lands, it's P1 for Vallaki interiors in Players mode.

**Queue and branches:** item 6.
- **`252-10` (Vallaki interiors) already fixes the Vallaki half.** Its N1 to N7 output has every scripted door: N1 has 5, N3 has 25, N4 has 25. The church reuse keeps its doors.
- The Castle (`252-11`) still lacks K28-doors and K63-door.

**Fix:**
- Make `build_walls` (or a post-generation check) assert that every door ID passed to `door()` exists in the output, and fail the generator if not.
- For K63, decide the precedence: a door stamped over an opening should replace it, so `door()` should clear `open_wall`. Or narrow the `Op`.
- Find out why K28's span doesn't land.

**Owner decision (small):** a door stamped onto an opening wins.

**Proving test:** a unit test over `locations/` and the scripts, like the scan here: every literal door ID in `scripts/authoring/*.py` appears among its scene's walls.

## G15: Counters and railings off room edges are dropped

**Verdict: CONFIRMED.**

**Code:** `counter` and `railing` only stamp overrides (`authorlib.py:87-92`). `build_walls` emits overrides only on room edges.

**Reproduced:**
- **Krezk S10:** no 3.5-ft walls on any level. All 6 calls are lost, including S20's L-shaped counter. Unchanged on `252-6`.
- **WSC street:** the stable railings are lost. The tavern's ground-floor stall partitions are lost too.
- **WSC tavern:** the bar counter survives, because it lies on a room edge.

**At the table:** these low barriers don't block movement where the book has them, and S20's counter isn't drawn at all.

**Severity:** P3.

**Queue and branches:** item 6. No branch fixes it.

**Fix:** if a counter or railing segment has no matching room edge, add it to `extra` with `heightFt: 3.5` and its material. Report orphan overrides, as in G11.

**Proving test:** run the generators to temp output and assert S20's two counter segments and the abbey railings exist as walls with `heightFt: 3.5`.

## G16: The Castle's outer curtain wall seals the gate and the postern

**Verdict: CONFIRMED.**

**Code:** `castle-ravenloft.py:68-69` adds four whole `extra` walls. `extra` bypasses overrides, so `ground-x-3` (x=0) and `ground-x-1` (x=380) cross the openings at (0, 165–175) and (380, 160–170).

**Reproduced** (canWalk on the real ground level):
- Drawbridge into the gatehouse passage: **false**. Into the K6 overlook through the postern: **false**.
- Both become **true** with only `x-1` and `x-3` removed.
- `252-11` is unchanged.

**At the table:** in Players mode the party can't walk through Castle Ravenloft's main gate or the postern, and the players can't see through them.

**Severity:** P2. The DM can drag.

**Queue and branches:** item 6 (Castle). No branch fixes it.

**Fix:** split the two curtain walls around the gate (z 165–175) and the postern (z 160–170), or route them through `_stamp` so the openings win. Regenerate K.

**Proving test:** the canWalk pair above returns true, and the rest of the outer curtain still blocks: a probe at z=100 across x=0 stays false.

## G17: The church reuse drops object dimensions

**Verdict: PARTLY.**

**Confirmed:** `vallaki-sites.py:544` copies only kind, x/z and rotation. 23 of the 27 copied E5 objects lose their dims, matching the suggestion's count.

**Narrower than claimed:**
- The eight benches (`l: 8`) don't change, because `bench`'s default length is 8.
- The altar builder ignores dims.
- Every E5 object sits at y=0, so no elevation is lost.

**What really changes:**
- 5 candlesticks (h 4 or 1.5 become 3.5)
- the rug (8×12 becomes 8×6)
- the bookshelf
- the beds
- 3 pines
- the fence (20 ft becomes 10 ft)

`252-10` copies the same way.

**At the table:** slightly wrong furniture sizes in St Andral's. Cosmetic.

**Severity:** P3.

**Queue and branches:** item 6 (with `252-10`).

**Fix:** pass `dims=o.get('dims')` and `y=o['pos'][1]` through `ch.prop`. List any deliberate exceptions in a dict beside `NAMES1`.

**Owner decision (small):** whether N1 should be an exact copy of E5's furnishings.

**Proving test:** a unit test comparing E5 and N1: for each copied object, `dims` and y are equal unless the object is listed as an exception.
