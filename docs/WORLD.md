# The nested world

One continuous environment: from a 3D view of the whole valley the DM zooms in; as the camera nears a place its map
streams in at its true position and orientation; zoom into a town's building and its floors appear in place inside
the town; zoom out and it folds back up. This document is the reference for the frames, the atlas, the thresholds,
the budgets and the fallback. It grows with the build steps; today it covers **step 0: frames and the atlas**.

## Frames (`app/src/core/frames.ts`, pure, unit-tested in `tests/frames.test.ts`)

All frames are plan feet, x east, z south, y up, **north = −z**, exactly as scenes are authored.

| constant | value | meaning |
|---|---|---|
| `MI_FT` | 5280 | world-map miles → plan feet |
| `RELIEF` | 1.25 | the heightfield is drawn a quarter steeper than surveyed (backdrop.ts's 1.25, now the one global constant so neighbouring sites agree about the land between them) |
| `NEST_LIFT` | 0.2 ft | a child map's floor sits this far above its parent's ground (above the parent's cobble at +0.12) |
| `FLATTEN_IN / FLATTEN_OUT` | 120 / 900 ft | the land is flattened to a map's base out to 120 ft past its edge and blends to the heightfield by 900 ft (`smooth(120, 900, mapDist)`) |
| `CRAG_IN / CRAG_OUT` | 320 / 1400 ft | the same for a site on a crag (Ravenloft) |

**World frame W.** A world.json point (mx, my) in miles → `Wx = (mx − cx)·MI_FT`, `Wz = (my − cy)·MI_FT` with (cx, cy)
the centre of `world.bounds` (`worldOfMiles`). Ground: `groundY = heightAt(mx, my) · RELIEF`; a pin's ground adds its
`heightFt` (`pinY`: Ravenloft's thousand-foot Pillarstone).

**Yaw.** `yawOf(north)` is the three.js `rotation.y` that turns a level's north onto world north: `'-z' → 0`,
`'+z' → π`, `'-x' → −π/2`, `'+x' → +π/2`. A plan point turns as three.js turns it: `(x cos θ + z sin θ, −x sin θ + z cos θ)`.
Pinned by tests against backdrop.ts's `toPlan` E/S basis and buildContext's `th` (the village ← Death House rotation
is −π/2: a step to x−10 in the house is a step to z−10 in the village).

**Root placement** (`rootPlacement`): a scene listed on a pin with no `parent`. `l0` = the first level with terrain,
else `levels[0]`; `c` = the centre of `bounds(l0.rooms ∪ l0.terrain)`. `rotationY = yawOf(l0.north)`,
`position = (Wx, Ypin, Wz) − R(θ)·(c.x, l0.elevationFt, c.z)`: the map's centre lands on its pin, its open-air floor on
the ground.

**Child placement** (`childPlacement`): a scene with `parent = P`. The parent room `r` is the first with
`r.enter === path && r.key === scene.location`, else the first with `r.enter === path` (`enterRoomOf`, buildContext's
lookup). `a = centroid(r.polygon)`, `dθ = yawOf(child.l0.north) − yawOf(parentLevel.north)`; the child root is a
three.js child of the parent root with `rotation.y = dθ` and
`position = (a.x, parentLevel.elevationFt − child.l0.elevationFt + NEST_LIFT, a.z) − R(dθ)·(c.x, 0, c.z)`.
Nesting composes like three.js (`compose`, `invert`, `matrixOf`, `placementOf`); depth is unbounded.

`toWorld(p, local)` / `toLocal(p, world)` move plan points across one placement; `boundsInParent` is a local extent
seen from the parent; `flattenWeight(bounds, x, z, crag)` is how far the land there is pulled to the map's base;
`siteRoads` + `roadExit` are backdrop.ts's rule for where a world road leaving a site starts.

## The atlas (`scripts/world-atlas.ts` → `manifests/world-atlas.json`)

`npm run atlas` (also the first step of `npm run build`) reads every `locations/**/scene.json` and both world.json
files and writes the atlas with plain node (`--experimental-transform-types`). `tests/atlas.test.ts` checks the
committed file is fresh and that the data is sound. Per scene:

```
path, campaign, name, location, pin?, alsoAt?, parent?, enterRoom? {key, level}, depth, root, orphan?,
l0, north, elevationFt, bbox, centre, levels [{id, name, elevationFt, ceilingFt}], stacked, outdoor, interior, clearingFt?,
roadExits [{road, bearing, x, z}]            (roots: in the map's own frame)
placement {position, rotationY}              (roots: in W; children: in the parent's frame)
worldBounds, bandFt, crag?                   (roots: footprint and flatten reach in W)
anchor {x, z, dTheta}, footprintInParent, blowout   (children)
objects, units                               (units: 2 for ≥ 2,000 objects — Vallaki, Krezk — else 1)
```

plus `pins` (every pin with `world`, `groundY`, its `root` or `proxyOnly`), `bandOverlaps`, `warnings` and `errors`.

Rules: a pin's root is its listed scene without `parent` that has terrain (ch03/E for pin E). A scene listed at two
pins (ch02/B at B and B2, ch02/D at D and D2) is placed at the first; the second pin keeps a proxy and a label only.
A scene with a pin but no root placement and no anchor is an error. `outdoor` = l0 has terrain and is not in
darkness (App.open's rule); `interior` = no terrain on l0, or darkness / interior-dim (hidden from players when
resident but not active). Blowouts more than 1.5× their plot (the Vallaki buildings, the church, Death House) are
warnings: neighbours inside that extent are hidden under the open building, the trade buildContext makes today.

Findings today: one pair of root flatten bands overlaps — the Luna River Crossroads (ch02/P) lies 792 ft off the west
edge of Vallaki's 1.7-mile map. The land blends the two bases there (weights normalised); the data pass (step 8)
decides whether to move the pin, shrink the band or accept the seam. The world's roads stop at Vallaki's edge, so
Vallaki has no road exits (the backdrop finds the same today).

## Verification

- `tests/frames.test.ts`: yaw per north against backdrop.ts's `toPlan` E/S basis and buildContext's `th`/`tf`, round trips
  through a rotated child in a rotated root, `compose` against three.js matrix products, the Blue Water Inn on room N2's
  centroid, Ravenloft a thousand feet up, E → K = 1.44 mi, `flattenWeight`, `roadExit`.
- `tests/atlas.test.ts`: the committed atlas is fresh (`npm run atlas` when a scene changes), every scene present, every
  parent resolves, duplicate-pin scenes, roots on their pins, band overlaps, blowout warnings, no errors.
- `e2e/world.spec.ts`: Death House and the church open inside the village (context drawn, Back leads to the village);
  every village house the running app draws round Death House stands where the atlas's placement puts the village's own
  rendering of it (to 0.01 ft): the frame maths and the app's buildContext agree; the village hides under the dungeon.

## Data

Blowouts carry `parent`; the room that opens them carries `enter`. Step 0 added `enter: 'ch03/E5'` to village room E5
and `enter: 'appB/death-house'` to room E7, and `parent: 'ch03/E'` to the church and Death House: both now open with
the village drawn round them and Back leads to the village, like the Vallaki buildings. Death House's map has north to
the left (`north: '-x'`), so it stands turned −π/2 in the village.

The surroundings stand on the parent's ground, so `App.syncContext` hides them while a floor below that ground is shown
(Death House's dungeon would otherwise lie buried under the village's grass) and in the floor-mask render, like the
backdrop. The church's map is in darkness (`ambient`), so it has no backdrop of its own; the village still stands round it.

## Fallback

`?nested=0` (and the View-menu toggle, once step 2 lands) runs today's path byte for byte: one map at a time, the
backdrop to the horizon, the parent's surroundings round an area map. Scenes with no pin and no parent (`dev/*`)
always open that way.
