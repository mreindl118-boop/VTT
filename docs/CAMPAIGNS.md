# Campaigns

mistLAB runs more than one module. Each campaign has its own manifest (the module's own organization), its
own world map, and its own saved state (reveals, tokens, roster, encounter, world position). The library's
top row switches between them; opening any location switches to its campaign automatically, saving the
previous one first.

| campaign | id | manifest | locations | world map | home |
|---|---|---|---|---|---|
| Curse of Strahd | `cos` | `manifests/locations.json` (chapters → locations → area keys) | `locations/{appB,ch02,ch03,dev}` | `locations/ch02/barovia-region/world.json` | `appB/death-house` |
| A Wild Sheep Chase | `wsc` | `manifests/wsc-locations.json` (sections → sites; pointers for scenes that reuse a map) | `locations/wsc` | `locations/wsc/00-region/world.json` | `wsc/01-tavern` |

The registry is `manifests/campaigns.json`; `app/src/campaigns.ts` binds each entry to its manifest and world
data. Saved state lives in IndexedDB under `campaign:<id>` (`cos` keeps the original `campaign:default`).

## Adding a campaign

1. Put the source export or measurements under `reference/imports/<id>/` (gitignored; the repo is public and
   ships geometry and notes only, never a module's text or art).
2. Generate scenes into `locations/<id>/<site>/{scene.json,grid.json}` with a script under `scripts/authoring/`
   (see `import-mapset.py` for the `tabletop-mapset 1.0` format, `death-house.py` for hand authoring, and
   `village-map.py` for measuring a printed map).
3. Write `manifests/<id>-locations.json` (chapters or sections, locations with area keys and paths) and a
   `world.json` (pins with `scenes`, roads, rivers, lakes, peaks, high ground, woods, in miles).
4. Add the entry to `manifests/campaigns.json` and the two imports in `app/src/campaigns.ts`. The unit test
   `tests/manifests.test.ts` cross-checks every built scene against its campaign's manifest.

## Conventions carried over from the mapset method

The `tabletop-mapset` export's method (its `INSTRUCTIONS.md`, kept under `reference/imports/wsc/`) matches
ours and is the reference for new work: 1 square = 5 ft; the grid lives on the floor plane only; measure a
printed map's pitch and frame before tracing; un-flatten composite drawings into levels with elevations from
the text; stairs and bridges are listed on both levels they join and drawn once; when the map and the text
disagree, the map wins and the difference is logged; everything is generated from a small spec, never
hand-edited output; every map records the regional hex it sits in so routes can be drawn on the region.
