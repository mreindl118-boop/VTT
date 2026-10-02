# Style: low-poly gothic diorama

- **Geometry**: chunky silhouettes, flat/faceted shading (`flatShading: true`), no normal maps, no photo
  textures, no AI imagery. Bevel only where it reads at 45°.
- **Surfaces**: no image textures. Every palette colour is declared as a material in `app/src/kit/surfaces.ts`
  (dressed stone, rubble, living rock, boards, timber, bark, log, plaster, cobble, flagstone, earth, grass, shingle,
  brick, thatch, cloth, iron, water, foliage) and the shared shader draws its grain in world space from one small
  tiling noise texture: stone courses 2.6 × 1.3 ft, boards 0.75 ft, setts about 1 ft, shingle courses 0.75 ft. The
  grain only modulates the colour's own tone (never a new hue), fades out with distance, and is the same everywhere,
  so a wall of dressed stone reads alike in Death House, the village and the castle.
- **One detail level**: every built thing carries the same grammar, so nothing reads as a placeholder beside its
  neighbours. Buildings stand on a plinth, roofs have a ridge beam, openings have frames (doors a lintel and iron
  straps, windows a sill, head and mullions or shutters), free walls a coping. Trees share one spruce tier on and off
  the map; figures share one humanoid (boots, belted tunic, two-part arms, hands, neck, head with hair).
- **Ground**: the map's ground and the land beyond it are one surface: same grass colour (the campaign's `grass`:
  Barovia's dark turf, the Sheep Chase's pasture), same Lambert lighting through day and night, blended over the first
  quarter mile. No seam, no lighter rectangle.
- **Paint and cloth** are weathered: even the Vistani's bright vardos and tents are faded by Barovian weather; full
  saturation is kept for light sources (flames, lit windows, embers) only.
- **Colour**: vertex/material colours drawn from one palette (`app/src/kit/palette.ts`), baked to a 256×256
  atlas for GLB export. Palette families:
  - mist grays `#d9dadc … #5a5d63`
  - bruised violet `#5b4a6b`, `#3b2f47`
  - pine green `#2f4a3a`, `#1e3128`
  - wet-stone blue-gray `#6f7b86`, `#4b5560`
  - candle amber `#f2b35b`, `#c9822e`
  - wine/blood red accents `#7a1f2b`, `#4d1119`
  - bone ivory `#e8dfc8`
- **Light rigs**: candle/torch = warm point lights (amber, quadratic falloff capped at the 5e dim radius);
  cool blue-gray hemisphere fill; fog planes/cards for volume. Barovian overcast preset = bright,
  desaturated, no hard shadows.
- **Readability**: every piece must read from a 45° tabletop camera and from straight down. Floors are a
  step darker than walls so the grid reads.
- **UI** (applefy): light, quiet, one type family (system UI / SF Pro), hairline dividers
  (`0.5px` on retina), SF-Symbols-style 1.5 px line icons, no RPG chrome, no parchment.
