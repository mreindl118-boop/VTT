// The tactical grid's GLSL, shared by the overlay (render/gridOverlay.ts) and the draped grid in the floors' own shader
// (render/materials.ts patchFog): one definition of the lines, whichever way they are drawn. No imports, so both can use it.

/** The grid's lines as a function of plan feet: the cell lines and the 10/50/100/500-ft orders (square) or the hex
 *  edges, each order fading with the zoom. Shared by the overlay below and by the draped grid in the floors' shader. */
export const GRID_FN = `
uniform float uCell;
uniform float uHex;       // 0 square, 1 hex
uniform float uPointy;    // 1 pointy-top, 0 flat-top
uniform float uHexSize;
uniform float uPxPerFt;   // what a foot is worth on screen: decides which grid orders show

// A line of a given spacing (feet): 1 on the line, 0 off it; bold widens it; w: a pixel's footprint in feet.
float lineAt(vec2 p, float spacing, float bold, float w) {
  vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(0.06 * bold, 0.06 * bold + 1.2 * w, d);
}
// How much an order of lines shows at this zoom: fading in once its spacing spans ~10 px, full by ~40 px.
float orderWeight(float spacing) { return smoothstep(10.0, 40.0, spacing * uPxPerFt); }
// Drafting-style regridding: the cell lines, then every 10, 50, 100 and 500 ft stronger, each order fading as the
// camera pulls back past it and the next order taking over. An order with no weight at this zoom (the weight is a
// uniform, so the branch is the same for every pixel) costs nothing; the pixel's footprint is taken once.
float squareLine(vec2 p) {
  float w = max(fwidth(p.x), fwidth(p.y)), a = 0.0, k;
  k = orderWeight(uCell); if (k > 0.0) a = lineAt(p, uCell, 1.0, w) * k * 0.55;
  k = orderWeight(10.0); if (k > 0.0) a = max(a, lineAt(p, 10.0, 1.3, w) * k * 0.7);
  k = orderWeight(50.0); if (k > 0.0) a = max(a, lineAt(p, 50.0, 1.7, w) * k * 0.85);
  k = orderWeight(100.0); if (k > 0.0) a = max(a, lineAt(p, 100.0, 2.1, w) * k * 1.0);
  k = orderWeight(500.0); if (k > 0.0) a = max(a, lineAt(p, 500.0, 2.6, w) * k * 1.1);
  return min(1.0, a);
}

// Distance (feet) to the nearest hex edge.
float hexLine(vec2 p) {
  if (uPointy < 0.5) p = p.yx;
  float s = uHexSize;
  vec2 r = vec2(sqrt(3.0) * s, 3.0 * s);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 q = dot(a, a) < dot(b, b) ? a : b;
  q = abs(q);
  float inner = max(q.x, dot(q, vec2(0.5, sqrt(3.0) * 0.5)));
  float d = (sqrt(3.0) * 0.5 * s) - inner;
  float w = max(fwidth(p.x), fwidth(p.y));
  return (1.0 - smoothstep(0.06, 0.06 + 1.2 * w, d)) * max(orderWeight(uHexSize * 1.5), 0.0);
}
float gridLine(vec2 p) { return uHex > 0.5 ? hexLine(p) : squareLine(p); }
`;

/** The draped grid, mixed into a ground's colour at the very end of its shader (after the mist and the distance fog,
 *  as the overlay is blended over them): plan feet from the mesh's own frame (the level's), the same lines, the same
 *  fog-of-war clip, out to the same extent as the flat overlay (past the map, over the land beyond), feathered at it. */
export const GRID_DRAPE_DECL = `
${GRID_FN}
uniform vec3 uGridColor;
uniform float uGridOpacity;
uniform vec2 uGridOrigin;
uniform float uGridOn;
uniform vec4 uGridBounds;
uniform vec4 uGridHole;   // where another ground lies over this one and draws the grid itself (the land under the map)
varying vec2 vGridP;
vec3 gridApply(vec3 c) {
  if (uGridOn < 0.5) return c;
  float outside = max(max(uGridBounds.x - vGridP.x, vGridP.x - uGridBounds.z), max(uGridBounds.y - vGridP.y, vGridP.y - uGridBounds.w));
  if (outside >= 40.0) return c; // the land far beyond the grid's extent pays nothing for it
  if (vGridP.x > uGridHole.x && vGridP.x < uGridHole.z && vGridP.y > uGridHole.y && vGridP.y < uGridHole.w) return c; // hidden
  float a = gridLine(vGridP - uGridOrigin) * uGridOpacity;
  a *= 1.0 - smoothstep(0.0, 40.0, outside);
  if (uCovEnabled > 0.5) a *= mix(1.0, step(0.25, mistCoverage()), uFog);
  return mix(c, uGridColor, clamp(a, 0.0, 1.0));
}
`;

