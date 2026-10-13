# The nested world

One continuous environment: from a 3D view of the whole valley the DM zooms in; as the camera nears a place its map
streams in at its true position and orientation; zoom into a town's building and its floors appear in place inside
the town; zoom out and it folds back up. This document is the reference for the frames, the atlas, the thresholds,
the budgets and the fallback. It grows with the build steps; today it covers **step 0: frames and the atlas**,
**step 1: the placement seam** (shader basis, floating origin, scene ↔ drawn conversions), **step 2: the valley**
(the world stage, every pin's map opening in place, flights in and out, the switch, both screens), **step 3:
streaming** (maps built in place as the camera nears them, ghosts, activation by the camera, folding and freeing), with
the two review findings it rests on (everything that leaves is freed; opening a map is one step), and **step 4:
nesting** (buildings, area maps and dungeons in place inside their towns, the depth deciding the active map, Back and
the breadcrumb).

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
extent, levels[].bbox                        (children: the whole stack, and each level, in its own frame)
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
the map (`reanchor`), so the map draws exactly where it always did and the valley round it. `dev/*` opens the legacy way; since step 4
area maps and buildings hang in their towns (see Nesting).

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

**Budgets measured** (swiftshader, 1180 × 820): the whole valley draws in 11 calls and 232k triangles whatever map is
active (it folds into its proxy at valley zoom, step 3; asserted under 70 and 300k). The stage is about 214k triangles
and builds in about 0.4 s.

A staged map's grid stops 10 ft past its own floors (`gridOverlay.clipGrid`; the legacy way keeps its 12 % pad), so it
never runs out over the valley, and it fades out as a foot drops under 0.6 px (`fadeGridBelow`: the town and road
bands), so a town seen from the road is not netted with its 500-ft squares; the legacy way keeps every order at every
zoom.

Known for later steps: the minimap still shows the open map's plan at valley zoom (step 6), the world map button still
opens the 2D sheet (step 6 makes it the nested map; the sheet stays as the fallback). On a portrait phone the whole
valley is small (it is twice as wide as it is deep), and A Wild Sheep Chase's skirt shows as a pale slope round it in
that theme's light mist.

## Freeing and opening (review findings 9 and 11)

**Everything that leaves is freed** (`render/dispose.ts`). Removing an object from a three.js scene frees nothing on
the GPU. `disposeTree(root)` takes a subtree out and disposes its geometries, its materials and the textures they own,
and removes its labels' page elements. It runs on every map that is released (`App.release`), on the backdrop and the
surroundings they replace, on the range overlay at each refresh, on each token figure that `syncTokens` rebuilds, and on
a build nobody waits for any more. Objects many maps share are registered with `markShared` and never freed: the palette
materials (`materials.ts mat()`) and the crags' mist texture. It is a registry, not a `userData` flag, because a cloned
material copies its `userData` and the clone is its own. Five round trips through the village, Tser Pool, the test room
and Death House end within 5 % of the first visit's GPU objects; before this change they grew from 714 to 2,226
geometries. A hundred range refreshes and forty view toggles add nothing.

**Opening a map is one step** (`App.open`). The new map is read and built while the old one stays on screen. Then, with
nothing left to wait for, the old one is released and the new one placed and activated between two frames. Every
`open()` takes a number and only the latest may change the world, so an open overtaken by a later one frees its build
and changes nothing. A campaign's save is read first and switched only at that step. A map that cannot be fetched (a
scene chunk offline) keeps the open map, its campaign and its save, and the status line says *Couldn't open … (offline?)*.
`open()` resolves to whether the map opened and never rejects. A scene chunk that failed stays failed in the browser's
module map for the life of the page, so `data.ts` asks for it again under a query once the network is back. The
browser's error names the file in Chromium and Firefox; Safari's does not, and there the first error stands until a
reload. Each file is asked for again once at a time and, once it has come, never again: every later read shares that
module (one download, one copy in memory). A retry that fails too is forgotten, and the next read tries the next query.

## Streaming (step 3)

`render/streamer.ts` decides and `App` carries out. Each tick (at most every 100 ms while the camera moves, and while
anything is pending) measures every pin root of the open campaign. The measure is the footprint's diagonal on screen in
CSS pixels, seen from the eye to the nearest point of the footprint, so a town the camera stands over is big. Seen
edge-on from low down a footprint is foreshortened: it counts √(sin e) × 1.15 of its size (e the eye's elevation angle
over its middle; at least 0.3 of it, at most all). A map is in view if its middle or a corner falls within 1.5
half-screens of the middle of the view, or the target is near it, and if at least a fifth of its nearest point shows
through the mist (FogExp2: exp(−(density × d)²) ≥ 0.2). A town thirty thousand feet off in the mist is not wanted.

| rule | when |
|---|---|
| prefetch the scene files | ≥ 60 px × units, in view |
| build, then draw it in place | ≥ 140 px × units, in view; one build at a time, none during a glide or while the user's hand moves the camera (a wheel turn in the last 300 ms, a drag or pinch that moved in the last 300 ms). The place holding the camera's target goes first, then the nearest to the target, then the biggest on screen |
| drop a build | its place fell under the fold line or out of view before the build was done (it is freed) |
| fold into its proxy | < 70 px × units, or out of view (at once, with a crossfade) |
| free it | folded for 4 s, unless it is the active map; or at once when the cap needs room (least recently wanted first) |
| cap | 4 units resident, 2 on a small device (`navigator.deviceMemory < 4`, or a phone-sized screen); Vallaki and Krezk are 2 units (atlas `units`). The active map does not count while it is folded away, so a phone can still stream Vallaki in from the valley |
| make it active | the drawn map whose footprint (10 ft pad) holds the camera's target, the smallest if several; the active map keeps the role until the target is a quarter of its half-diagonal outside it. Never during a glide. Only on the DM's screen: the Player Display follows the DM's choice |

`planStream` is the pure rule (`tests/streamer.test.ts`). These thresholds are first guesses to tune with the HUD
(`?hud=1` lists the resident maps, the active one starred and the folded ones marked, the units against the cap, and
the last build's time, slices and longest slice). A glide carries the camera through places it does not stop at, so
nothing folds, unfolds, builds or activates on the way; the map flown to stands ready, and the rule runs again on
landing.

**Building in slices.** `render/build.ts buildLevelSteps` is `buildLevel` as a generator: it yields between walls,
objects, merged pieces and parts. Each piece is flattened as it is merged, not all at once at the end. `App.loadSteps`
yields again after each level's coverage map. The streamer runs it for at most 8 ms after each drawn frame and waits
out glides. Then `World.upload` gets the map onto the GPU a little at a time by drawing it into one corner pixel, a
megabyte and a half of vertices or three materials not yet drawn as they are a draw, with the scene's lights, so the
programs built are exactly the ones the real frame uses. It runs three times: as an opaque ghost, as a half-faded
ghost (the crossfade's state) and with the map's own materials on its ghost-look levels (the state it will draw in
once active). `compileAsync` is not used: three.js's `compile()` does not set each material's clipping state, so for
the cut walls it built programs no frame used, all in one task.

**The lamp count.** three.js builds a shader program per point-light count. A ghost's lamps are hidden, so when the
camera made a lamp-lit map active its lamps appeared, the old map's went, and every lit material of the valley was
compiled again in one frame: 17 programs, a frame of 2.4 to 22 s on swiftshader. In the continuous world `World`
therefore makes up the visible lamps to `World.LAMPS` (6) with dark lamps before every render (black, intensity 0, out
of reach: they add exactly nothing to a pixel). The count the shaders see never changes when a map becomes active, so
nothing is compiled (measured: 51 → 51 programs at Tser Pool's activation, against 50 → 67 before). A map with more
than six lamps in view recompiles as before. The legacy way has no pad.
Measured on swiftshader with two test runs sharing four cores: the Old Svalich Road builds in about 37 slices (longest
31 ms), Krezk in 144 (longest 25–52 ms) and Vallaki in about 395 (7 s in all, longest 58–90 ms). The plan allowed Vallaki half a second to a second in
one piece. Opening a map by name, the library or the world map still builds it in one go, as before.

**Ghosts** (`render/ghost.ts`). A map drawn in the valley that is not the active one looks as it would if it were
active, from where the DM looks at it: its ground level and the floors standing on it, cut at 5 ft over the floor
(stacked sites just under the ground floor's ceiling), roof caps hidden with low walls. Each mesh's material is swapped
for a plain copy with the same colour, surface and shading. The copy ignores the active map's fog of war, clips at the
ghost's own cut (re-read on every reanchor) and can fade and take a faint tint of the mist (12 %). The originals wait on
`userData.liveMat`. What makes a map active is not drawn on a ghost: the grid, markers, light rings, labels, tokens,
hidden things the players have not been shown, and its lamps (point lights would change the light count and recompile
every material). In Players view an interior's ghost is not drawn at all. At tint 0 a ghost draws exactly the live
map's pixels (measured: 0 pixels differ with the grid off), so becoming active shows no change. The tint glides off over
250 ms first, and only then are the materials swapped.

**Crossfades.** A streamed map comes in as a ghost at opacity 0 over its proxy and fades in over 250 ms. Then the
proxy's faces collapse. Folding is the reverse: the proxy comes back at once and the map fades out over it, then
hides. The active map folds too at valley zoom: it becomes a ghost that looks exactly like it, fades, and stays active
(its tokens, tools and minimap). Drawn again, it takes its own materials back once the fade is done.

**Activation by the camera** (`App.switchActive`). No flight, no framing and no travel: the party stays where it is, so
no party token is added and the world-map marker does not move. Only the old active map's selection, ruler, range and
token figures go, and it steps down to a ghost whose tint comes on gently. The new one comes alive with today's tail of
`open()`: fog, sky, level, tokens, slider and the floating origin moved onto it. The device remembers it as the map
to open next time is still the one the party was taken to (`mistlab.scene` is written by opens only: looking is not
travelling, so a reload does not move the party). The Player Display is told. `App.open` of a map the valley already
holds opens it without a build; if the streamer stands its own copy of the map in the valley while `open` is reading
it, that copy opens and `open`'s build is freed. The map left behind stays a ghost and the streamer folds and frees it as the camera leaves. Opening a legacy map
(a building, a dev map) or another campaign frees every map the valley holds and drops any build in flight.

**The party's '&'** stands on the land at the party's place while the party's map is not drawn. If that map is drawn
but is not the active one (a ghost has no token figures), the '&' stands on the party token's own spot. It is hidden
while the party's map is the active one and drawn, because the token itself shows.

**The Player Display** streams by the DM's camera (each camera message ticks its streamer) but never activates by
itself. When the DM's camera makes a map active, the `state` message names it and the display opens it: without a build
if it already holds it, and without framing (its camera is the DM's). With the players' camera unlocked the display
stays on the party's map (the message carries `look: { home }` when the DM's active map is not the one the party was
taken to, and `camLocked`): the DM looking elsewhere does not take the players' grid and token away. Locked again, it
follows the DM's map.

**While a map loads** the DM's status line says *Loading …* (the title still names the active map until the camera
makes the new one active).

**Detailed proxies** (`render/proxydetail.ts`, data from `scripts/world-massing.ts` → `manifests/world-massing.json`,
a chunk of its own read when the valley is first built). At valley zoom every place is its plain massing
(`worldproxies.ts`, all places in one draw). Once a place is 24 px across per atlas unit on screen (and in view, not lost
in the mist), its detailed proxy is built in 6-ms steps and drawn instead (the plain one again under 14 px; one not
wanted for 30 s is freed). It is the map's own massing, as its ghost would show it: the ground's floor materials on a
lattice, trees as cones, houses as a body and a gable roof in the house kit's own tones (`kit/props.ts houseLook`),
palisades, fences and vine rows as boxes, walls up to the ghost's cut, and every other big piece (Krezk's rock and
road, prisms, crags, towers, cottages, the church) built with the map's own kit. Its colours lean 12 % toward the mist,
as a ghost's do. So when the map streams in over it, the crossfade changes detail, not shape: at Krezk's build line
the last proxy frame and the first map frame differ in under 1 % of the pixels of Krezk's own rectangle on screen,
against several times that with the plain massing (e2e). Castle Ravenloft keeps its proxy from its exterior plans.

A place whose map cannot be read while streaming keeps its proxy, is not tried again for 20 s, and the status line says
*Couldn't load … (offline?)* once.

Known: the surface detail's noise is sampled in drawn space, so it slides by the floating origin's move when a map
becomes active. The detail fades out beyond 4 ft a pixel, and activation happens from town zoom, so this does not show.
The warm-up draws lines too (a lamp's ring was the last program Tser Pool built at activation). Krezk's activation may
still build one program (a transparent basic material its props take when the active map styles them). A real iPad has
not been measured.

## Nesting (step 4)

A map with an atlas `parent` (a building, an area map, a dungeon: depth 1 today, any depth by the same rules) opens
**inside its town** in the continuous world: `App.stageEntry` takes it when its chain of parents ends in a pin root of
the open campaign. Its root hangs in its parent's root at the atlas placement (`WorldStage.placeChild`: the centre of
its open-air level on the centroid of the room that opens it, turned by the two norths, `NEST_LIFT` over the parent's
floor), so three.js composes the frames; the floating origin moves onto the child's absolute position
(`App.absOf`), and everything the table does stays in the child's own feet as in step 1.

**Opening.** `App.open(child)` brings the chain: each map it hangs in that the valley does not hold is read and built
first (root first) and stands as a ghost round it, then the child opens in place and is made active, the camera
gliding there from wherever it was (`chainOf`; one step, the latest request wins, a map that cannot be fetched changes
nothing, as before). `?scene=ch05/N2`, the library, the Player Display and Enter on a building's card all go this way.

**Streaming children** (render/streamer.ts `DEPTHS`). The candidates are the pin roots and the children of every map
the valley holds, measured where they hang (their footprint and floor in W, composed through their parents:
`App.streamSite`). A child is measured by its whole stack, the atlas `extent` (every level's rooms and terrain: the
abbey of Saint Markovia's ledge 400 ft over the foot of its cliff, Death House's dungeon under its yard); its `bbox`
stays its open-air level's, which places it. A child is built only big on screen and near the camera's target, and
folds far from it:

| depth | prefetch | build and draw | fold |
|---|---|---|---|
| 0, a pin's root | 60 px × units | 140 px × units | under 70 px × units, or out of view |
| 1, a building or area map | 120 px, target within 1,000 ft | 220 px, target within 600 ft | under 110 px, or target farther than 1,000 ft |
| 2, a building of an area map | 160 px, within 400 ft | 260 px, within 250 ft | under 130 px, or farther than 400 ft |

A child is one unit. While a child is the active map its whole chain is pinned (the town is never freed under its
inn). Freeing a map frees the children hanging in it first.

**Hidden massing** (render/hideUnder.ts). While a child is drawn whole (not during its fade in; at once when it folds),
its town's own model of it goes: on each level of the parent, the objects whose footing lies inside what the child
covers there (in the parent's frame, plus 8 ft): the child's levels that stand within that level's height, from its
floor to its ceiling (atlas `levels[].bbox`), and always the open-air level on the level of the room that opens it. So
the inn hides the town's house on the street, and the abbey hides the village's model of it on the ledge level 400 ft
up while the pines at the foot of the cliff stay. Faces of merged meshes (`scatter`, `merged-roofs`, not indexed, with `userData.ranges`)
collapse onto their first vertex (nothing drawn, rays miss them) with their nine floats kept aside and put back exactly;
objects that stand alone are left out of the frame by their layers (the slider, the section and the ghosts own
`visible`); the parent's area-key labels there take `nest-hidden`. The parent's ground stays. A blowout bigger than its
plot takes its neighbours inside its extent too (the Blue Water Inn is three and a half times its plot), the trade
buildContext makes; overlapping children are undone and redone together. On the players' side an interior that is not
the active map is not drawn, so the town's house stays there.

**The depth decides the active map.** A child drawn under the camera's target takes the role from its parent once its
footprint is big on screen, `enterPx` = the larger of 1.6 × its build line and 0.45 × the screen's smaller side (352 px
at 768), and gives it back under `leavePx` = 0.6 × that, or when the target leaves it. In between nothing changes,
whichever map is active. So zooming in goes town → building and zooming out climbs back building → town; out over the
valley the role climbs to the town even while both are folded (the building is freed later). A map of another town
never takes the role from a town that holds the target. The active map's floor picker, section slider, Whole building,
tokens and fog of war are the child's; the town round it is a ghost (no clipping by the child's section). The section
plane of a stacked child is set on shell materials the maps share (render/materials.ts `mat()`); when a map that is not
stacked takes the role back, `applySlider` takes the plane off its non-wall materials again (`sectionClip(…, false)`),
or the town's houses would stand cut open at 5 ft. The camera's target rides the active map's floor anywhere over its
whole stack (an abbey on its ledge), its town's ground off it, the land beyond.

**Under the town.** A child's floor below its own open-air level (Death House's dungeon, the church's undercroft) lies
under its town's grass: while one is shown the valley and the other maps are left out of the frame by their layers
(the child itself stays) and the mist floor lies under it, as the legacy way hides the surroundings. Every map in the
valley is veiled or unveiled whole and then the active map is unveiled (`syncUnderground`); nothing is skipped, so
leaving the dungeon by Back, a crumb or the camera brings the village back whatever map is active then.

**Back and the breadcrumb** (ui/breadcrumb.ts). The title is a breadcrumb in the valley: *Barovia › Town of Vallaki ›
Blue Water Inn › Ground floor* (the world's name, every map up the chain, the active map, its floor when it has
several, unless that floor is named as its map: Krezk's 'Village of Krezk'). Each crumb frames its scope, flying: the valley whole (`frameWorld`), a map up the chain whole (it becomes
the active map, `App.climb`; a town whose open-air level runs far out over its fields, Vallaki's, is framed round
the place just left, at least 1,400 ft across, rather than whole), the active map whole, its floor. Back (`openParent` → `climb(parent)`) opens nothing: the
camera pulls back over the building just left, same heading, to half way between the two activation lines, so the
building stays drawn in its street, small, and the town takes the role (looking is not travelling: the party stays in
the building, and the '&' marks it there). On a phone the breadcrumb keeps its last two places (the town and the building, in full: the floor picker names
the floor). On touch each crumb is a finger-sized target (44 px tall, the extra reaching over the bar's padding) with
wider gaps round the separators.

**One navigation at a time.** Every open and every climb takes a new number (`navSeq`); a camera activation still
fading in (`switchActive`) is dropped when one starts (`cancelSwitch`: its map's tint glides back on), and its swap
checks the number, so Enter pressed while the town is taking the role back wins. An open of a map the valley already
holds leaves it where it stands (a building streamed in stays in its town's root). On the players' side the
crumbs are plain names. The zoom-out chip no longer offers the town (the far limit is the whole valley's whatever map
is active, and zooming out climbs to the town by itself): at the far limit it offers the whole valley, and from there
the world map. The zoom fix's derived parent, `anchorIn` (the surroundings round the room entered from) and the chip's
town remain the legacy way's (`?nested=0`), unchanged; in the valley a child stands at its one atlas anchor.

Known: the ghost of a stacked building shows its ground floor cut under its ceiling (its rooms, not its roof) as the
active map would; Krezk's abbey stands at its atlas anchor (S5) whichever room it is entered from. Children are
measured by their whole extent (a blowout, a dungeon), so a big inn takes the role over a little of its street, and
Death House over its dungeon's reach under the village. The abbey's own 'Below the ledge' level repeats the village's
cottages, walls and cliff (it is kept for the legacy way, where the abbey opens alone): in the valley they draw over
the village's own in the same places, for the data pass (step 8) to settle. Inside a building the whole town is drawn
round it: measured inside the Blue Water Inn on the software renderer, 155 draw calls, 1.34 M triangles and 81 shader
programs against 141, 249 k and 51 for the inn alone the legacy way; step 7 budgets it (the town's far blocks folded or
its proxy while a building is active, on low tiers). The Player Display mirrors the DM's camera into a building but
keeps the town as its active map and its party token there; following the party into nested children is step 5.

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
- `e2e/stream.spec.ts` (review findings 9 and 11; each test failed before the change):
  - Five round trips through four maps stay within 5 % of the first visit's geometries and textures, and the test room
    draws the same pixels after them (shared materials stay live).
  - A hundred range refreshes and forty view toggles leave the geometry count where it was.
  - Two opens at once: the later one wins whatever order the files arrive in, its root is the only one mounted and no
    stray label is left.
  - A map that cannot be fetched, in the same campaign and in another, leaves the open map mounted with its labels, its
    campaign and its save, and the status line says so. Once the network is back the same map opens.
- `tests/streamer.test.ts`: the rule's thresholds, units, hysteresis, the 4-s linger, the cap and its least recently
  wanted eviction (the active map kept, and not counted while folded), activation (the smallest footprint, the active
  map holding the target, never mid-glide, never on the Player Display).
- `e2e/stream.spec.ts` (step 3, second round; each failed on the first round's build):
  - A camera activation (Tser Pool, three lamps, over the lampless village) builds at most one program, and no frame
    round it costs more than 2.5 × a plain frame of the same view + 300 ms.
  - After the camera alone made Tser Pool active, a reload opens the village with the party there and one party token.
  - With the players' camera unlocked the Player Display stays on the village (its level, its party token, no ghost
    materials) while the DM looks at Tser Pool; locked again, it follows.
  - Over Tser Pool, 1,500 ft up and looking along the valley: Tser Pool is built first and Vallaki, in the mist, never.
  - A scene chunk cut once is fetched again exactly once for five later reads.
  - Krezk at its build line: the detailed proxy and the map that streams in over it differ in under 1.5 % of the pixels (measured 0.4 %, against 4.6 % on the first round)
    of Krezk's rectangle on screen.
  - In Players view at 1024 px the floor picker and the section slider stay on screen.
- `tests/streamer.test.ts` (second round): the place under the target first, then the nearest, never while the wheel
  turns; a build whose place fell under the fold line is dropped.
- `tests/streamer.test.ts` (step 4): a child is built only big on screen and near the target and folds far from it;
  it takes the role over its town at `enterPx`, keeps it down to `leavePx` and gives it back under it or off its
  footprint; out over the valley the role climbs to the folded town; another town's building never takes it.
- `e2e/nest.spec.ts` (step 4; every test fails before it):
  - Zooming into Vallaki's Blue Water Inn with the camera alone: it streams in under Vallaki's root at its atlas
    placement, the town's own house on its plot collapses, the inn takes the role closer in (no open, no travel, the
    origin on it, the title *Barovia › Town of Vallaki › Blue Water Inn › Ground floor*); pulling back the town takes
    the role while the inn is still drawn, then the inn folds and every vertex of the town comes back exactly; at the
    whole valley the inn is freed and the town stays active.
  - Enter on Death House's card in the village flies into it inside the village (the village a ghost round it, its
    house hidden); the lower dungeon stands alone in the mist; Back pulls out over the house, same heading, the
    village takes the role and the house stays drawn and does not take it back; in Players view the house is not
    drawn and the village's house shows; the camera alone takes the house back; the village's crumb frames the
    village and the valley's crumb frames the valley, where the house is freed.
  - After the inn gave the role back, no material of the town's own levels other than a wall's or a door's carries the
    section plane (the inn's cut does not leave the town's houses cut open).
  - Opening Krezk's abbey: it hangs in Krezk's root and stays the active map (it holds the target over its whole
    stack, the target rides its floor on the ledge, 400 ft up); the village's model of it on the ledge level goes;
    Back climbs to the village and the title reads *Barovia › Village of Krezk* (no second crumb for its level).
  - Death House's lower dungeon, left by the village's crumb and again by Back: the village and the valley come back
    whole (no object of the village keeps the 'under' reason), the mist floor goes.
  - Enter on the Blue Water Inn while Vallaki is taking the role back (its fade under way): the Enter wins, the inn
    stays the active map in the town's root, the town's tint comes back; the town's crumb then frames the town round
    the inn (under 4,000 ft out, over its plot), not the whole level with its fields.
  - On a 390 × 844 phone the breadcrumb shows the village and the house in full (no ellipsis), a point 10 px above or
    below a crumb's text still presses it, and a tap on Back climbs to the village.
- `e2e/zoom.spec.ts`: card Enter with Back for Vallaki, and Players mode, run in the continuous world as well as the
  legacy way.
- The legacy way's surroundings tests (world.spec's Death House and church, zoom.spec) run with `?nested=0`.
- `e2e/stream.spec.ts` (step 3):
  - A camera glide over Tser Pool, with no button pressed and no `open()`, streams its map in at its atlas placement
    and makes it active (the origin moves onto it). The party stays in the village and the '&' marks it.
  - At the whole valley Tser Pool folds into its proxy and stays active, within the draw budget.
  - Back on the village it unfolds and becomes active again, with its party token. Tser Pool is freed and the GPU's
    geometries and textures return to within 5 of what they were.
  - Two places either side of the target are ghosts: ghost materials only, no lamps, labels, grid or proxy, a tint,
    and walls cut 5 ft over the floor.
  - Flying into one makes it active with its own materials while the other stays a ghost.
  - A tour of four places with the cap at 3 never holds more than 3 units, and every build ran in several short slices.
  - The Player Display draws what the DM's camera streamed in and follows the map it made active, with the same anchor
    and camera; the party stays put.

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
