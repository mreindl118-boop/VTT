# Style: low-poly gothic diorama

- **Geometry**: chunky silhouettes, flat/faceted shading (`flatShading: true`), no normal maps, no photo
  textures, no AI imagery. Bevel only where it reads at 45°.
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
