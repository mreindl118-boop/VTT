# The nested world

One continuous environment: from a 3D view of the whole valley the DM zooms in; as the camera nears a place its map
streams in at its true position and orientation; zoom into a town's building and its floors appear in place inside
the town; zoom out and it folds back up. This document is the reference for the frames, the atlas, the thresholds,
the budgets and the fallback. It grows with the build steps; today it covers **step 0: frames and the atlas**,
**step 1: the placement seam** (shader basis, floating origin, scene ↔ drawn conversions) and **step 2: the valley**
(the world stage, every pin's map opening in place, flights in and out, the switch, both screens).

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
`heightFt` (`pinY`: Ravenloft's thousand-foot Pillarstone). A pin may carry `groundFt`, its ground in drawn feet, where
the heightfield is wrong for it: Lake Zarovich's map stands on the lake's south shore at the lake's level (4.2 ft, as
Vallaki beside it), not on the survey's hump inside the lake.

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

## The placement seam (step 1, pixel-neutral)

Every loaded scene hangs from its own `Loaded.root` group (its levels, its backdrop and its surroundings), and that group
hangs from `World.root` at the scene's **absolute** world position (feet, W). Until step 2 places scenes, every root is
the identity and nothing renders differently.

- **Floating origin.** `World.root.position = −World.anchor`. `World.reanchor(abs)` moves the origin to an absolute point
  and shifts the root, the camera, its target, the mist floor and any glide in flight by the same amount, so nothing
  moves on screen; `onReanchor` lets the app re-read what it caches. With the origin on the active scene its vertices,
  the camera and the shaders' world positions stay small however far across the valley the map stands.
  `toAbsolute`/`toAnchored` convert; the Player Display's camera messages are absolute and each end draws round its own
  anchor.
- **Scene ↔ drawn.** `App.placement` is the active root's `matrixWorld` (drawn, i.e. anchored) and `placementInv` its
  inverse, re-read by `syncPlacement()` in `setLevel` and on reanchor. `toWorld`/`toLocal` (xz) and
  `toWorld3`/`toLocal3` are used by `floorPoint`, `cameraGround`, `pick`'s wall-cut test, `frameLevel`/`jumpTo`
  (`frameBox`), `findParty`, the initiative follow in `nextTurn`, `lookAt`, `cameraFrame().north`, the mist floor and
  `__mistlab.screenOf`. The ruler and the move ghost ring hang from the scene root, in scene feet, like the tokens.
  The wall-cut plane is the cut plus the placement's lift (`placementY`): placements only turn about y.
- **Shader basis.** `fogUniforms.uCovBasis` (a `Matrix3`, identity) maps world xz to the active scene's plan xz
  (`covBasisOf` in frames.ts; `covUv` mirrors the shader in TS). `mistCoverage()` and the grid shader apply it before
  `uCovOrigin`/`uCovSize` and the grid origin, so fog of war and the grid stay in scene feet on a turned, moved scene.
- **Continuous-world camera** (`World.setNested`, on whenever a map stands in the valley): far plane 300,000 ft,
  `maxDistance` 120,000 ft (`frameLevel` stops lowering it; the stage raises it to fit the whole valley), the mist's
  pull-back floor 0.0008 instead of 0.12 (identical below ~2,170 ft; the mist between the eye and the ground stays as
  thick as over a map out to 325,000 ft), and the pitch floor rising from 0.46π (outdoors) to 0.3π between 5,000 and
  20,000 ft. It leaves `zoomToCursor` alone: the wheel and a pinch zoom toward the pointer on every map, in the valley
  or not (the zoom fix), so a legacy map opened after the valley keeps it.
  `World.flyTo(target, dist, ms?)` glides for 420–900 ms by the log of the zoom ratio and the ground covered.
- **Test hook.** `__mistlab.setPlacement([x, y, z], rotationY, reanchor = true)` stands the active scene elsewhere and
  keeps the camera's view of it; `__mistlab.placement`, `toWorld`, `toLocal` and `anchor` expose the seam.

## The valley (step 2)

A pin's root map (atlas `depth 0`, not an orphan, with a pin in the open campaign) opens **in place**: `App.place`
builds the campaign's `WorldStage` once (render/worldstage.ts; the land, aprons, ribbons and lakes from
render/worldland.ts; the proxies and sky from render/worldproxies.ts), stands the map at its atlas placement
(`placeRoot`), hides its proxy (`setResident`), turns on the continuous-world camera and moves the floating origin onto
the map (`reanchor`), so the map draws exactly where it always did and the valley round it. Area maps, buildings and
`dev/*` still open the legacy way in this step (step 4 hangs children in their towns).

| part | where | what |
|---|---|---|
| land | `worldland.buildLand` | the heightfield at 330 ft (the world lattice ×2), every footprint flattened to its base (120–900 ft, a crag 320–1,400 ft), lakes cut to their level, a coarse skirt that falls away 1,200 ft below the valley over 3 miles into the mist (the valley stands like an island; the heightfield's edge is not repeated as a shelf); snow above 4,200 ft except on steep faces, where the rock shows, at an albedo the valley's light does not clip to white; relief shading lit from the north-west (up to ×1.3 on slopes facing it, down to ×0.45 on the far sides, flat ground and the land beside a map unchanged), so ridges read from the whole valley |
| aprons | `buildAprons` | every footprint's rings out to 3,000 ft, one mesh, present whether or not the map is open (nothing changes shape when it opens) |
| roads, rivers, lakes, Bluto's boat, crags | `worldPaths`, `buildRibbons`, `buildWater`, `buildCrag` | drawn once for the region; roads stop at each map's road exits; a lakeshore map's water part reads as water. A lake lies just under its lowest shore; a map on the shore sets the level only when it stands no higher than the middle of the shore's heights (Lake Zarovich by its own map, at 2 ft; Luna Lake and Lake Baratok no longer stand at a nearby map's height, 3,700 and 440 ft over the land, on walls). Land under the level climbs to the shore over 1.8 radii, land over it falls to the water within 1.3; the cover's water colour shows only on flat ground, so a bank where the drawn lake and the heightfield disagree is earth or rock, not blue streaks |
| forest | `WorldStage.fillForest` | one instanced pool of 12,000 pines (6,000 when `navigator.deviceMemory < 4`), refilled per one-mile tile round the target, hidden past 25,000 ft |
| proxies | `worldproxies.siteMassing` | each place's massing at true scale in two shared meshes; a place's faces collapse while its map is open |
| names | `WorldStage` labels | `N · Town of Vallaki` over each place in the valley and road bands; players see only revealed places; the DM taps one to fly there and open its map (`onPick`). The names take **no pointer** (a wheel or a pinch over one zooms like anywhere else; zoom-to-cursor slides the open map's own name under the cursor, which used to stall the zoom at 14–21k ft): the canvas's tap and mouse hover ask `WorldStage.labelAt` (on touch a 44 px target round the name's middle), the hovered name lights up and the canvas tip says where a tap goes. A gesture that had a second finger down is never a tap. Declutter, in order of importance: the full name where it has room inside the view and clear of the page's panels (`World.chrome`), else its key alone as a small tag, else nothing |
| sky, party | `buildSky`, `setParty` | the moon and sun round the eye; the `&` on the land when the party's place is not the open map |

**Camera.** `WorldStage.fit` frames the whole valley by projection, not a bounding sphere: the region's edges at the
land's height, its peaks and its places must all fall inside the view less the bars along its edges (the top bar, the
camera buttons, the side slider: `World.chrome().bars`, set by main.ts), 10 px in, from the camera's present heading
and tilt; the target slides so the valley sits in the middle of that clear part. `fitCamera` makes that distance the
far limit (about 126,000 ft at 1440 × 900, 152,000 on a 1024 × 768 iPad, 522,000 on a 390 × 844 phone, where the
valley fits its width beside the slider; never under 120,000) and puts the far plane past the far side. Off the open
map the camera's target rides on the ground (`App.followGround`: a pan onto Mount Baratok lifts it onto the mountain,
the eye keeps its distance), so zooming in there comes down onto the land; on the map the level's floor holds it.
Zoom bands on `body[data-band]`: valley (under 0.02 px/ft), road (under 0.1), town (under 1), map.

**Flying.** `App.open(path)` from one pin's map to another glides (`World.flyTo`: 420–900 ms by the log of the zoom
ratio and the ground covered, rising over the middle of a long flight) and **resolves on arrival** (`World.settled()`,
capped at 4 s for a hidden tab); `World.flights` counts the glides. Out: zoom out to the far limit (button, wheel or
pinch) and the chip offers *Zoom out to the whole valley* (`frameWorld('fly')`); at the whole valley the next one offers
the world map sheet, as before. In: tap a place's name. The world map sheet, the library and `?scene=` open maps with
`App.open`, so they fly too.

**The switch.** View › *Continuous world* (`App.setNestedMode`) writes `localStorage mistlab.nested` and opens the open
map again the other way on the same level; off disposes the stage. `?nested=0|1` overrides the device's choice at
load. The Player Display follows the DM's: the `state` and `layout` messages carry `nested`, the display reopens the
map the same way (camera messages are absolute feet, so both ends must stand in the same world), and on each camera
message it re-reads the zoom band, the valley's forest and the names.

**Budgets measured** (swiftshader, 1180 × 820): the whole valley with the village open draws in under 70 calls and
300k triangles (asserted); with Vallaki or Krezk open the town is still fully drawn at valley zoom (147 calls, 1.27M
triangles) until step 3 streams it out. The stage is about 214k triangles and builds in about 0.4 s.

Known for later steps: the minimap still shows the open map's plan at valley zoom (step 6), the world map button still
opens the 2D sheet (step 6 makes it the nested map; the sheet stays as the fallback), proxies collapse at once rather
than fading (step 3), the square grid of a big map (Vallaki, Krezk) draws its placement squares over the whole map at
town zoom exactly as it does the legacy way, but a staged map's grid now stops 10 ft past its own floors
(`gridOverlay.clipGrid`; the legacy way keeps its 12 % pad), so it no longer runs out over the valley. On a portrait
phone the whole valley is small (it is twice as wide as it is deep), and A Wild Sheep Chase's skirt shows as a pale
slope round it in that theme's light mist.

## Verification

- `tests/frames.test.ts`: yaw per north against backdrop.ts's `toPlan` E/S basis and buildContext's `th`/`tf`, round trips
  through a rotated child in a rotated root, `compose` against three.js matrix products, the Blue Water Inn on room N2's
  centroid, Ravenloft a thousand feet up, E → K = 1.44 mi, `flattenWeight`, `roadExit`.
- `tests/atlas.test.ts`: the committed atlas is fresh (`npm run atlas` when a scene changes), every scene present, every
  parent resolves, duplicate-pin scenes, roots on their pins, band overlaps, blowout warnings, no errors.
- `e2e/world.spec.ts`: Death House and the church open inside the village (context drawn, Back leads to the village);
  every village house the running app draws round Death House stands where the atlas's placement puts the village's own
  rendering of it (to 0.01 ft): the frame maths and the app's buildContext agree; the village hides under the dungeon.
- `tests/covbasis.test.ts`: the coverage basis is exactly the identity unplaced, and for −π/2, 50,000 ft out, π and an
  odd angle maps every placed point to the uv of the unplaced one; it inverts a three.js root's `matrixWorld`.
- `e2e/world.spec.ts` (step 1): the test room stood 50,000 ft out and turned −π/2, with the origin on it and without:
  north on screen, the scale and the ground the camera sees agree with the unplaced room; the grid's pixels and the
  players' fog land on the unplaced pixels (≤ 3 % off by a pixel); `screenOf` lands on the party token as the scene
  graph draws it; the secret door is pixel-identical to wall at t = 0 in every view; taps select, walls block, the door
  lets the party through, the ruler reads 20 ft; `reanchor` far away and back changes no pixel; `setNested` on and off.
- `e2e/world.spec.ts` (step 2): the whole valley from above with every other place as its proxy within the draw budget;
  the land flush with every placed map; the village on its pin with the origin on it and Tsolenka turned to world north
  (the compass turns by +π/2: clockwise on screen, the opposite sign of the three.js yaw); pin maps of both campaigns
  open in their own valley while area maps, buildings and dev maps keep the legacy way, zoom-to-cursor staying on; the
  whole valley fits on screen, Krezk's name flies into its map in place, the chip flies back out to the valley and then
  offers the world map; the View-menu switch off and on, remembered over a reload, with the Player Display following
  (same mode, same absolute camera, same band); the target riding Mount Baratok, the halved forest, the players' names;
  real wheel turns over the village's own name zoom out to the far limit and its chip, and in over Castle Ravenloft's;
  on a 390 × 844 phone the whole valley fits beside the slider with every name on screen and clear of the panels, a
  CDP pinch with a finger on the village's name zooms out to the far limit and asks for the chip, and a finger 16 px
  below Vallaki's name flies there.
- `tests/atlas.test.ts`: Lake Zarovich's map on the south shore at the lake's level beside Vallaki (a second, deliberate
  band seam: both bases agree).

## Data

Blowouts carry `parent`; the room that opens them carries `enter`. Step 0 added `enter: 'ch03/E5'` to village room E5
and `enter: 'appB/death-house'` to room E7, and `parent: 'ch03/E'` to the church and Death House: both now open with
the village drawn round them and Back leads to the village, like the Vallaki buildings. Death House's map has north to
the left (`north: '-x'`), so it stands turned −π/2 in the village.

The surroundings stand on the parent's ground, so `App.syncContext` hides them while a floor below that ground is shown
(Death House's dungeon would otherwise lie buried under the village's grass) and in the floor-mask render, like the
backdrop. The church's map is in darkness (`ambient`), so it has no backdrop of its own; the village still stands round it.

## Fallback

`?nested=0` (and the View menu's *Continuous world*) runs today's path byte for byte: one map at a time, the
backdrop to the horizon, the parent's surroundings round an area map. Scenes with no pin and no parent (`dev/*`)
always open that way.
