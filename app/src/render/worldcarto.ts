// The inked map: the valley's own 3-D land, seen from high above, drawn as a hand-inked map. Nothing here is an image:
// every mark is computed from the land the 3-D world stands on (worldland.ts's LandField, baked to a texture once),
// so the contours, hachures and water lie exactly where the 3-D hills and lakes are, and the map turns into the real
// world as the camera comes down.
//
//  - Paper: a parchment ground tinted by land cover (open ground, hills, rock, snow with height), a NW hillshade and a
//    grain whose scale is snapped to powers of two (it never swims while zooming).
//  - Relief: contour lines (125 ft · 2^n by zoom, index lines heavier) and hachures, short strokes down the fall line
//    whose weight grows with the slope and on the shadow side.
//  - Forest: stippled crowns, lit from the NW with dark gaps (gothic) or paper between (pastoral); an edge shadow.
//  - Water: a pale wash, a shore ink line with a light casing, concentric ripples spaced wider toward the middle.
//  - Roads, trails, rivers: ribbons whose width is held in screen pixels (rivers taper from source to mouth).
//  - The hex grid at the map's own scale, under the canopy; a mist edge round the region.
//  - Massing (the places' proxies, the crags) becomes pale blocks with ink shadow sides.
//  - Lettering: CSS labels in the bundled display faces with paper halos; a title and a compass rose at region fit.
// One factor, `k`, a pure function of the camera (feet per CSS pixel at the target), blends the map over the 3-D
// colours: 1 above ~24 ft/px, 0 below ~5 ft/px. The loaded maps are washed toward the paper's ink by the same factor
// (materials.ts uCartoWash) so a town stays one drawing with the land round it.
import * as THREE from 'three';
import type { WorldData } from '../campaigns';
import { MI_FT } from '../core/frames';
import type { Vec2 } from '../core/geometry';
import { fogUniforms, surfaceUniforms } from './materials';
import type { LandField } from './worldland';

export type CartoStyleId = 'gothic' | 'pastoral';
/** A map's palette (sRGB hex) and its line weights. */
interface CartoStyle {
  paper: string; paper2: string; ink: string; forest: string; forest2: string; hill: string; rock: string; snow: string;
  water: string; waterInk: string; mist: string; road: string; roadCase: string;
  /** Height (ft, as drawn) where the land starts to whiten. */
  snowFt: number;
  /** Index contour every this many feet. */
  indexFt: number;
  /** Crown cell (CSS px) and how much of the forest is covered by crowns. */
  crownPx: number; crownFill: number;
  /** Strength of the hachures (0..1.5), and the slope they start at. */
  hach: number; hachS0: number;
  /** Pastoral only: the meadow wash and the deckled edge's rim. */
  meadow?: [string, string]; deckle?: string;
  title: string;
}
export const CARTO_STYLES: Record<CartoStyleId, CartoStyle> = {
  // Barovia: a dim, cold parchment; dark forest-green canopy with black gaps; uplands pale toward white summits; sepia ink
  gothic: { paper: '#d9cfb4', paper2: '#c4b897', ink: '#2c241c', forest: '#4a5e45', forest2: '#1f2a20', hill: '#b3a98a', rock: '#a29f94', snow: '#f1efe8', water: '#9db3b8', waterInk: '#2f4650', mist: '#dcdcdf', road: '#7a2a22', roadCase: '#3a1712', snowFt: 4200, indexFt: 1000, crownPx: 6.5, crownFill: 0.96, hach: 1.0, hachS0: 0.1, title: 'grenze' },
  // the Sheep Chase: warm cream, bright meadows, rounded bubbly trees with paper between, soft brown ink
  pastoral: { paper: '#f1e6c4', paper2: '#e3d3a4', ink: '#5a4630', forest: '#7fa35a', forest2: '#58803f', hill: '#dccb98', rock: '#c9bfa6', snow: '#fbf8ef', water: '#a9cfe0', waterInk: '#4f7f99', mist: '#f6f4ee', road: '#9a5a32', roadCase: '#5c3a22', snowFt: 3800, indexFt: 500, crownPx: 9, crownFill: 0.82, hach: 0.75, hachS0: 0.14, meadow: ['#b5cb7b', '#a3bd6a'], deckle: '#a48458', title: 'fraunces' },
};

/** Feet per texel of the baked land (1/32 mile). */
const TEX_FT = MI_FT / 32;
/** The bake reaches this far past the region (the mist edge fades out inside it). */
const MARGIN_FT = MI_FT;
/** Up to this many lakes are drawn analytically (world.json's ellipses). */
const MAX_LAKES = 8;

const col = (hex: string) => new THREE.Color(hex);
/** A phone: a coarse pointer and a small screen (its shorter side at most 900 px). */
const phoneTier = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 900;

/** The uniforms every inked material shares (one set per stage). */
export function cartoUniforms(field: LandField, style: CartoStyle) {
  const W = field.world, b = W.bounds;
  const [x0, z0] = field.feet([b.minX, b.minY]), [x1, z1] = field.feet([b.maxX, b.maxY]);
  const lakes = Array.from({ length: MAX_LAKES }, () => new THREE.Vector4(0, 0, 1, 1));
  W.lakes.slice(0, MAX_LAKES).forEach((l, i) => { const [x, z] = field.feet(l.center); lakes[i].set(x, z, l.r[0] * MI_FT, l.r[1] * MI_FT); });
  return {
    uCarto: { value: 0 },
    /** 2·tan(fov/2) / viewport CSS height: feet per CSS pixel per foot of depth. */
    uPxK: { value: 0.001 },
    uDpr: { value: 1 },
    uAnchor: { value: new THREE.Vector3() },
    uOrigin: { value: new THREE.Vector2(x0 - MARGIN_FT, z0 - MARGIN_FT) },
    uSize: { value: new THREE.Vector2(x1 - x0 + 2 * MARGIN_FT, z1 - z0 + 2 * MARGIN_FT) },
    uRegion: { value: new THREE.Vector4(x0, z0, x1, z1) },
    uHexFt: { value: ((W as WorldData & { milesPerHex?: number }).milesPerHex ?? 1) * MI_FT },
    uHexOrigin: { value: new THREE.Vector2(...field.feet([0, 0])) },
    uHexOn: { value: 1 },
    uIndexFt: { value: style.indexFt },
    uSnowFt: { value: style.snowFt },
    uCrownPx: { value: style.crownPx },
    uCrownFill: { value: style.crownFill },
    uHach: { value: style.hach },
    uHachS0: { value: style.hachS0 },
    uPastoral: { value: style.meadow ? 1 : 0 },
    /** The phone tier (a coarse pointer on a small screen): one octave each of crowns, hachures, grain and stamps. */
    uPhone: { value: phoneTier() ? 1 : 0 },
    uLakes: { value: lakes },
    uLakeN: { value: Math.min(MAX_LAKES, W.lakes.length) },
    tLand: { value: null as THREE.Texture | null },
    tCover: { value: null as THREE.Texture | null },
    tGrain: surfaceUniforms.uNoise,
    cPaper: { value: col(style.paper) }, cPaper2: { value: col(style.paper2) }, cInk: { value: col(style.ink) },
    cForest: { value: col(style.forest) }, cForest2: { value: col(style.forest2) }, cHill: { value: col(style.hill) },
    cRock: { value: col(style.rock) }, cSnow: { value: col(style.snow) }, cWater: { value: col(style.water) },
    cWaterInk: { value: col(style.waterInk) }, cMist: { value: col(style.mist) },
    cRoad: { value: col(style.road) }, cRoadCase: { value: col(style.roadCase) },
    cMeadow: { value: col(style.meadow?.[0] ?? style.paper) }, cMeadow2: { value: col(style.meadow?.[1] ?? style.paper) }, cDeckle: { value: col(style.deckle ?? style.ink) },
  };
}
export type CartoUniforms = ReturnType<typeof cartoUniforms>;

/** The inked map's measures of a view (a pure function of the camera and its canvas): feet per CSS pixel at the
 *  target, the view's ground width over the region's (`fit`, 1 = the whole region across), and the map's strength
 *  `k` = band(24 → 5 ft/px): 1 at or above 24 ft/px, 0 at or below 5. */
export function cartoBands(cam: THREE.PerspectiveCamera, target: THREE.Vector3, canvas: HTMLElement, regionFt: number): { ftPerPx: number; fit: number; k: number; pxK: number } {
  const d = cam.position.distanceTo(target), cssH = canvas.clientHeight || 1, cssW = canvas.clientWidth || 1;
  const pxK = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / cssH, ftPerPx = d * pxK;
  return { ftPerPx, pxK, fit: (ftPerPx * cssW) / Math.max(1, regionFt), k: band(ftPerPx, 24, 5) };
}
/** smoothstep over log2(ftPerPx) between log2(lo) and log2(hi): 1 at or above hi, 0 at or below lo. */
export function band(ftPerPx: number, hi: number, lo: number): number {
  return THREE.MathUtils.smoothstep(Math.log2(Math.max(1e-3, ftPerPx)), Math.log2(lo), Math.log2(hi));
}

/** Bake the land once: RGBA half floats (height as drawn, its x and z gradient, the placed maps' clearings) and RGBA bytes of cover
 *  (forest, hills, mountains, water), at 1/32 mile, over the region and a mile round it. A generator: it yields every
 *  few rows, so its caller spreads it over frames (the page never stalls). */
export function* bakeLand(field: LandField, u: CartoUniforms): Generator<void, { land: THREE.DataTexture; cover: THREE.DataTexture; ms: number }> {
  /** 1 on a placed map's footprint and its felled clearing, falling to 0 a little beyond. */
  const site = (x: number, z: number): number => {
    let m = 0;
    // an ellipse through the footprint's corners' midpoints, so a town's clearing is round, not its map's rectangle
    for (const st of field.sites) {
      const b = st.bounds, hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2, cx = b.minX + hx, cz = b.minZ + hz;
      const e = Math.hypot((x - cx) / (hx * 0.85), (z - cz) / (hz * 0.85)), d = (e - 1) * Math.min(hx, hz) * 0.85, r = Math.max(120, st.clearingFt);
      if (d < r + 500) m = Math.max(m, 1 - THREE.MathUtils.smoothstep(d, r, r + 500));
    }
    return m;
  };
  let ms = 0, t0 = performance.now();
  const o = u.uOrigin.value, s = u.uSize.value, nx = Math.ceil(s.x / TEX_FT) + 1, nz = Math.ceil(s.y / TEX_FT) + 1;
  // the texture spans exactly nx·TEX_FT: texel centres sit on the lattice
  u.uSize.value.set(nx * TEX_FT, nz * TEX_FT);
  const H = new Float32Array(nx * nz), t = field.terrain;
  for (let r = 0; r < nz; r++) {
    for (let k = 0; k < nx; k++) H[r * nx + k] = field.height(o.x + (k + 0.5) * TEX_FT, o.y + (r + 0.5) * TEX_FT);
    if (r % 8 === 7) { ms += performance.now() - t0; yield; t0 = performance.now(); }
  }
  const half = new Uint16Array(nx * nz * 4), cov = new Uint8Array(nx * nz * 4), toHalf = THREE.DataUtils.toHalfFloat;
  const h = (r: number, k: number) => H[Math.min(nz - 1, Math.max(0, r)) * nx + Math.min(nx - 1, Math.max(0, k))];
  for (let r = 0; r < nz; r++) for (let k = 0; k < nx; k++) {
    if (k === 0 && r % 8 === 7) { ms += performance.now() - t0; yield; t0 = performance.now(); }
    const i = r * nx + k, gx = (h(r, k + 1) - h(r, k - 1)) / (2 * TEX_FT), gz = (h(r + 1, k) - h(r - 1, k)) / (2 * TEX_FT);
    half[i * 4] = toHalf(H[i]); half[i * 4 + 1] = toHalf(gx); half[i * 4 + 2] = toHalf(gz); half[i * 4 + 3] = toHalf(site(o.x + (k + 0.5) * TEX_FT, o.y + (r + 0.5) * TEX_FT));
    if (t.hasCover) {
      const [mx, my] = field.miles(o.x + (k + 0.5) * TEX_FT, o.y + (r + 0.5) * TEX_FT);
      cov[i * 4] = Math.round(255 * Math.min(1, t.cover('f', mx, my) * 1.15)); cov[i * 4 + 1] = Math.round(255 * t.cover('h', mx, my));
      cov[i * 4 + 2] = Math.round(255 * Math.min(1, t.cover('m', mx, my) + t.cover('x', mx, my) * 0.3)); cov[i * 4 + 3] = Math.round(255 * t.cover('w', mx, my));
    }
  }
  const land = new THREE.DataTexture(half, nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
  const cover = new THREE.DataTexture(cov, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const tx of [land, cover]) { tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.generateMipmaps = false; tx.needsUpdate = true; }
  u.tLand.value = land; u.tCover.value = cover;
  return { land, cover, ms: ms + performance.now() - t0 };
}

// ------------------------------------------------------------------ GLSL

const DECL = /* glsl */ `
uniform float uCarto, uPxK, uDpr, uHexFt, uHexOn, uIndexFt, uSnowFt, uCrownPx, uCrownFill, uHach, uHachS0, uPastoral, uPhone;
uniform vec3 uAnchor;
uniform vec2 uOrigin, uSize, uHexOrigin;
uniform vec4 uRegion;
uniform sampler2D tLand, tCover, tGrain;
uniform vec4 uLakes[${MAX_LAKES}];
uniform int uLakeN;
uniform vec3 cPaper, cPaper2, cInk, cForest, cForest2, cHill, cRock, cSnow, cWater, cWaterInk, cMist, cMeadow, cMeadow2, cDeckle;
varying vec3 vCartoW;
varying float vCartoDepth;
varying vec3 vCartoN;
`;

const FUNCS = /* glsl */ `
float cHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 cHash2(vec2 p) { float a = cHash(p); return vec2(a, cHash(p + a * 17.17 + 3.1)); }
// cubic B-spline from four bilinear taps (GPU Gems 2, ch. 20): smooth contours, no lattice facets
vec4 cBicubic(sampler2D t, vec2 uv) {
  vec2 ts = vec2(textureSize(t, 0)), st = uv * ts - 0.5, i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / ts, h1 = (i + 1.5 + w3 / g1) / ts;
  return g0.y * (g0.x * texture(t, h0) + g1.x * texture(t, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)) + g1.x * texture(t, h1));
}
// an antialiased line on the integers of f, wpx device pixels wide
float cLine(float f, float wpx) { float d = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-6); return 1.0 - smoothstep(wpx * 0.5 - 0.5, wpx * 0.5 + 0.5, d); }
// grain at a scale snapped to powers of two, cross-faded, so the paper never swims under a zoom
float cGrain(vec2 p, float ftpx) {
  float l = log2(ftpx * 90.0), l0 = floor(l), t = l - l0;
  float a = texture(tGrain, p / exp2(l0)).r;
  if (uPhone > 0.5) return a;
  float b = texture(tGrain, p / exp2(l0 + 1.0)).r;
  return mix(a, b, t);
}
// one hachure per cell: a short stroke down the fall line, its half-width hw and the antialias aa in cell units
float cHachCell(vec2 p, float cell, vec2 dir, float hw, float aa) {
  vec2 q = p / cell, id = floor(q), f = fract(q) - 0.5 - (cHash2(id) - 0.5) * 0.36;
  float along = dot(f, dir), across = dot(f, vec2(-dir.y, dir.x));
  float len = 0.36 + 0.1 * cHash(id + 3.7);
  return (1.0 - smoothstep(hw - aa, hw + aa, abs(across))) * (1.0 - smoothstep(len - aa, len + aa, abs(along)));
}
// one crown per cell: inside (0..1), lit side (0..1), rim (0..1)
vec3 cCrownCell(vec2 p, float cell, float dens, float aa) {
  vec2 q = p / cell, id = floor(q), f = fract(q) - 0.5;
  vec2 c = (cHash2(id + 1.3) - 0.5) * 0.2; float rad = 0.34 + 0.13 * cHash(id + 5.1);
  vec2 d = (f - c) / rad; float dd = length(d), a = aa / rad;
  float inside = (1.0 - smoothstep(1.0 - a, 1.0 + a, dd)) * step(cHash(id + 9.7), dens);
  float lit = clamp(0.55 - 0.65 * dot(d, vec2(0.7071)), 0.0, 1.0);
  float rim = smoothstep(0.62, 0.95, dd);
  return vec3(inside, lit, rim);
}
// two staggered lattices (the second offset by half a cell and turned), so the canopy has no rows
vec3 cCrownPair(vec2 p, float cell, float dens, float aa) {
  vec3 a = cCrownCell(p, cell, dens, aa / cell);
  vec2 pb = mat2(0.8, -0.6, 0.6, 0.8) * p + cell * vec2(0.5, 0.37);
  vec3 b = cCrownCell(pb, cell * 0.92, dens, aa / (cell * 0.92));
  // b lies over a where both are present (its rim darkens a's crown), else whichever is present
  return b.x > 0.5 ? b : vec3(max(a.x, b.x), a.x > 0.5 ? a.y : b.y, a.x > 0.5 ? a.z : b.z);
}
vec3 cCrowns(vec2 p, float ftpx, float dens) {
  float l = log2(uCrownPx * ftpx), l0 = floor(l), t = l - l0, s0 = exp2(l0), aa = 0.75 * ftpx / uDpr;
  if (uPhone > 0.5) return cCrownPair(p, s0, dens, aa);
  return mix(cCrownPair(p, s0, dens, aa), cCrownPair(p, 2.0 * s0, dens, aa), t);
}
// signed distance (ft) to the nearest lake's shore (negative in the water), from world.json's ellipses
float cLakeSd(vec2 p) {
  float sd = 1e9;
  for (int i = 0; i < ${MAX_LAKES}; i++) {
    if (i >= uLakeN) break;
    vec4 L = uLakes[i]; vec2 d = (p - L.xy) / L.zw; float rho = max(length(d), 1e-4);
    vec2 g = d / (L.zw * rho);
    sd = min(sd, (rho - 1.0) / max(length(g), 1e-9));
  }
  return sd;
}
// smoothstep over log2(ftpx) between log2(lo) and log2(hi): 1 at or above hi, 0 at or below lo (the spec's bands)
float cBand(float ftpx, float hi, float lo) { return smoothstep(log2(lo), log2(hi), log2(ftpx)); }
// a pastoral stamp in a map-space cell (cell ft, aa in cell units): a broadleaf tree (kind 0) or a hill bump (kind 1);
// x = ink, y = fill, z = lit side, w = the stamp's presence
vec4 cStamp(vec2 p, float cell, float kind, float aa) {
  vec2 q = p / cell, id = floor(q), f = fract(q) - 0.5 - (cHash2(id + 7.7) - 0.5) * 0.3;
  float ink = 0.0, fill = 0.0, lit = 0.0;
  if (kind < 0.5) {
    // three round crowns over a trunk
    vec2 c0 = vec2(0.0, -0.08), c1 = vec2(-0.13, 0.04), c2 = vec2(0.13, 0.04);
    float d = min(min(length(f - c0) - 0.18, length(f - c1) - 0.14), length(f - c2) - 0.14);
    vec2 tr = abs(f - vec2(0.0, 0.2)) - vec2(0.03, 0.08); float dt = max(tr.x, tr.y);
    fill = 1.0 - smoothstep(-aa, aa, min(d, dt));
    ink = 1.0 - smoothstep(0.0, aa * 1.6, abs(min(d, dt)) - aa * 0.4);
    lit = step(f.x + f.y, -0.05) * step(d, 0.0);
  } else {
    // a half-ellipse bump, its east half shaded, an ink arc and three ticks
    vec2 e = (f - vec2(0.0, 0.12)) / vec2(0.4, 0.35); float d = (length(e) - 1.0) * 0.35;
    float inside = (1.0 - smoothstep(-aa, aa, d)) * step(f.y, 0.12);
    fill = inside; lit = inside * step(f.x, 0.0);
    ink = (1.0 - smoothstep(0.0, aa * 1.6, abs(d) - aa * 0.4)) * step(f.y, 0.12);
    float tick = step(abs(fract((f.x + 0.4) / 0.2) - 0.5), 0.08) * step(abs(f.x), 0.25) * step(f.y, 0.0) * step(-0.12, f.y) * step(d, -0.02);
    ink = max(ink, tick * 0.8);
  }
  float keep = kind < 0.5 ? step(cHash(id + 2.3), 0.35) : step(cHash(id + 4.1), 0.6);
  return vec4(ink, fill, lit, 1.0) * keep;
}
vec4 cStamps(vec2 p, float ftpx, float kind, float aa) {
  float l = log2(14.0 * ftpx), l0 = floor(l), t = l - l0, s0 = exp2(l0);
  vec4 a = cStamp(p, s0, kind, aa / s0), b = cStamp(p, 2.0 * s0, kind, aa / (2.0 * s0));
  return uPhone > 0.5 ? a : mix(a, b, t);
}
// the inked map at an absolute point of the land
vec3 cartoLand(vec3 col3d) {
  if (uCarto <= 0.001) return col3d;
  vec2 p = vCartoW.xz + uAnchor.xz;
  float aniso = max(length(dFdx(p)), length(dFdy(p))) * uDpr;
  float ftpx = max(max(vCartoDepth * uPxK, min(aniso, vCartoDepth * uPxK * 4.0)), 0.05), ftdev = ftpx / uDpr;
  vec2 uv = (p - uOrigin) / uSize;
  vec4 L = cBicubic(tLand, uv); float h = L.r; vec2 g = L.gb; float slope = length(g);
  vec4 C = texture(tCover, uv);
  float big = texture(tGrain, p / 9000.0).r, mid = texture(tGrain, p / 2300.0).g;
  float grain = cGrain(p, ftpx);
  // the region's edge: gothic, the map dissolves into the mist; pastoral, a deckled sheet (relief ink stops short of
  // it, so the survey's rim never draws as contoured walls)
  float out_ = max(max(uRegion.x - p.x, p.x - uRegion.z), max(uRegion.y - p.y, p.y - uRegion.w));
  float outD = out_ + (texture(tGrain, p / 1900.0).r - 0.5) * 0.12 * 5280.0;
  float reliefMask = uPastoral > 0.5 ? 1.0 - smoothstep(-0.35 * 5280.0, -0.25 * 5280.0, out_) : 1.0 - smoothstep(-600.0, 400.0, out_);
  // L1 paper, L2 cover and height
  vec3 c = mix(cPaper, cPaper2, smoothstep(0.35, 0.75, big) * 0.55) * (0.95 + 0.1 * grain);
  c = mix(c, cHill, C.g * 0.5);
  c = mix(c, cRock, smoothstep(0.2, 0.8, C.b) * 0.55);
  float alt = smoothstep(uSnowFt * 0.6, uSnowFt * 1.25, h + (mid - 0.5) * 500.0);
  c = mix(c, cSnow, alt * 0.85);
  // forest mask: the cover with a wandering edge; a placed map's own ground and its felled clearing stay open
  float fo = smoothstep(0.42, 0.62, C.r + (big - 0.5) * 0.45 + (mid - 0.5) * 0.2) * (1.0 - smoothstep(0.3, 0.9, L.a + (mid - 0.5) * 0.6));
  // pastoral: the open lowland is pasture
  if (uPastoral > 0.5) c = mix(c, mix(cMeadow, cMeadow2, step(0.5, mid)), 0.55 * (1.0 - smoothstep(1000.0, 1400.0, h)) * (1.0 - C.g) * (1.0 - smoothstep(0.2, 0.6, C.b)) * (1.0 - fo));
  // L3 hillshade from the NW (x east, z south: the light comes from −x, −z, high), the relief exaggerated ×2.2
  vec3 n = normalize(vec3(-g.x * 2.2, 1.0, -g.y * 2.2)), Ld = normalize(vec3(-0.6, 0.75, -0.6));
  float lam = dot(n, Ld) / Ld.y;
  c *= mix(1.0, clamp(lam, 0.55, 1.18), 0.6);
  // the canopy's shadow falls on open ground to the SE
  if (uPhone < 0.5) {
    vec2 sh = vec2(-0.7071) * 3.0 * ftpx;
    float fs = smoothstep(0.42, 0.62, texture(tCover, (p + sh - uOrigin) / uSize).r + (big - 0.5) * 0.45);
    c *= 1.0 - 0.28 * fs * (1.0 - fo);
  }
  // L4 contours: 125 ft · 2^n by zoom (500 ft at region fit), the finer set fading as it crowds; index lines heavier
  float nz = clamp(log2(ftpx / 12.0), 0.0, 2.0), n0 = floor(nz), fade = nz - n0, I0 = 125.0 * exp2(n0);
  // (the levels are offset a hair, so a plateau flattened to a round height is not one solid contour)
  float hc = h + 0.731, fh = hc / I0, crowd = fwidth(fh);
  float wMinor = 0.8 * uDpr, wIndex = 1.4 * uDpr;
  float minor = max(cLine(fh, max(1.0, wMinor)) * (1.0 - fade), cLine(hc / (2.0 * I0), max(1.0, wMinor))) * (1.0 - smoothstep(0.18, 0.4, crowd));
  float fi = hc / uIndexFt;
  float idx = cLine(fi, max(1.0, wIndex)) * (1.0 - smoothstep(0.3, 0.6, fwidth(fi)));
  float contour = max(minor * 0.55, idx * 0.85) * (1.0 - fo * 0.75) * (1.0 - alt * 0.4) * reliefMask;
  // L5 hachures down the fall line, heavier on steep ground and on the shadow side; combed (darker) just below a
  // contour, as the regional handouts do it
  float shadow = clamp(1.0 - lam, 0.0, 1.0);
  float wpx = clamp((slope - uHachS0) * 4.0, 0.0, 1.5) * (0.55 + 0.9 * shadow) * uHach;
  vec2 dir = slope > 1e-5 ? g / slope : vec2(0.0, 1.0);
  float hl = log2(5.0 * ftpx), h0 = floor(hl), ht = hl - h0, s0 = exp2(h0), s1 = 2.0 * s0;
  float hach = cHachCell(p, s0, dir, 0.5 * wpx * ftpx / s0, 0.6 * ftdev / s0);
  if (uPhone < 0.5) hach = mix(hach, cHachCell(p, s1, dir, 0.5 * wpx * ftpx / s1, 0.6 * ftdev / s1), ht);
  float below = (1.0 - fract(fh)) * I0 / max(slope, 1e-3) / ftpx;   // px down to here from the contour above
  float comb = 1.0 - smoothstep(3.0, 5.0, below);
  hach *= step(0.02, wpx) * (1.0 - fo) * mix(0.45, 0.85, comb) * cBand(ftpx, 30.0, 8.0) * reliefMask;
  // L6 the hex grid (pointy-top, flat-to-flat = uHexFt, on the flat sheet's lattice), on open ground and water only
  vec2 hq = p - uHexOrigin; float hf = uHexFt, hh = 2.0 * hf / sqrt(3.0); vec2 hs = vec2(hf, 1.5 * hh);
  vec2 ha = mod(hq, hs) - 0.5 * hs, hb = mod(hq - 0.5 * hs, hs) - 0.5 * hs;
  vec2 hv = dot(ha, ha) < dot(hb, hb) ? ha : hb; vec2 av = abs(hv);
  float he = 0.5 * hf - max(av.x, dot(av, vec2(0.5, 0.8660254)));
  float hexw = max(1.0, 0.75 * uDpr);
  float hex = (1.0 - smoothstep(hexw * 0.5 - 0.5, hexw * 0.5 + 0.5, he / ftdev)) * smoothstep(9.0, 16.0, hf / ftpx) * smoothstep(2.5, 3.5, ftpx) * uHexOn * 0.22;
  // compose: relief ink, hex, then the canopy over them, the pastoral stamps, then water, then the edge
  c = mix(c, cInk, hach);
  c = mix(c, cInk, contour);
  c = mix(c, cInk, hex * (1.0 - fo));
  vec3 cr = cCrowns(p, ftpx, uCrownFill);
  vec3 crownC = mix(cForest * 0.78, cForest * 1.3, cr.y);
  crownC = mix(crownC, cForest2 * 0.7, cr.z * 0.6);
  vec3 gap = uPastoral > 0.5 ? mix(c, cForest, 0.35) : cForest2 * 0.8;
  vec3 wood = mix(gap, crownC, cr.x);
  c = mix(c, wood, fo);
  if (uPastoral > 0.5) {
    float sb = cBand(ftpx, 30.0, 12.0), aa = 0.8 * ftdev;
    // broadleaf trees in the thin woods (a third of the cells), hill bumps on the hills
    vec4 tr = cStamps(p, ftpx, 0.0, aa);
    float tw = sb * step(0.08, C.r) * step(C.r, 0.42) * (1.0 - fo) * reliefMask;
    c = mix(c, mix(vec3(0.369, 0.620, 0.275), vec3(0.549, 0.769, 0.400), tr.z), tr.y * tw);
    c = mix(c, vec3(0.133, 0.220, 0.122), tr.x * tw);
    vec4 hb2 = cStamps(p + 7.0 * ftpx, ftpx, 1.0, aa);
    float hw = sb * smoothstep(0.35, 0.5, C.g) * (1.0 - fo) * reliefMask;
    c = mix(c, mix(vec3(0.490, 0.608, 0.298), vec3(0.663, 0.769, 0.427), hb2.z), hb2.y * hw * 0.85);
    c = mix(c, cInk, hb2.x * hw * 0.8);
  }
  // L9 water: lakes from their ellipses (wash, casing, shore ink, ripples), the cover's wet cells as a wash
  float sd = cLakeSd(p), sdp = sd / ftpx;
  float wet = max(1.0 - smoothstep(-0.6, 0.6, sd / ftdev), smoothstep(0.45, 0.7, C.a) * 0.8);
  float u = max(0.0, -sd) / (ftpx * 4.5), k = sqrt(2.0 * u + 0.25) - 0.5;
  float rip = cLine(k, max(1.0, 0.9 * uDpr)) * pow(0.74, floor(k + 0.5)) * step(0.6, k) * (1.0 - step(5.5, k));
  if (uPastoral > 0.5 && k > 3.5) rip *= step(fract(atan(p.y - 0.5, p.x) * 3.0 + k), 0.6);
  vec3 wc = mix(cWater, cPaper, smoothstep(-3.5, -1.0, sdp) * 0.55);
  wc = mix(wc, cWaterInk, rip * 0.7);
  c = mix(c, wc, wet);
  c = mix(c, cWaterInk * 0.8, 1.0 - smoothstep(0.5, 1.4, abs(sd) / ftdev));
  // L12 the region's edge
  if (uPastoral > 0.5) {
    c = mix(c, cPaper, smoothstep(-0.15 * 5280.0, 0.0, outD));
    c = mix(c, cDeckle, 0.6 * (1.0 - smoothstep(0.5, 1.5, abs(outD) / ftdev / 1.5)));
    c = mix(c, cMist, smoothstep(0.0, 2.0 * ftpx, outD));
  } else {
    c = mix(c, cMist, smoothstep(-1800.0, 3500.0, out_ + (big - 0.5) * 4200.0));
  }
  return mix(col3d, c, uCarto);
}
// massing (proxies, crags): pale blocks with ink shadow sides, lit from the NW
vec3 cartoObject(vec3 col3d) {
  if (uCarto <= 0.001) return col3d;
  vec3 Ld = normalize(vec3(-0.6, 0.75, -0.6));
  float lam = clamp(dot(normalize(vCartoN), Ld), 0.0, 1.0);
  float l = dot(col3d, vec3(0.299, 0.587, 0.114));
  vec3 c = mix(cInk, mix(cPaper, cPaper2, 0.3), smoothstep(0.1, 0.85, lam));
  c = mix(c, c * (0.75 + 0.6 * l), 0.4);
  return mix(col3d, c, uCarto);
}
`;

/** Make a stage material draw the inked map as the camera climbs: 'land' paints the whole map at its absolute
 *  position (the land, the aprons, the lakes); 'object' turns massing into pale blocks with ink shadow sides. Chains
 *  after patchFog when the material has it. */
export function patchCarto<T extends THREE.Material>(m: T, u: CartoUniforms, mode: 'land' | 'object', style: CartoStyleId): T {
  if (m.userData.carto) return m;
  m.userData.carto = mode;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, u);
    sh.uniforms.uCartoWash = { value: 0 }; // the stage paints itself; only the maps are washed
    const nrm = sh.vertexShader.includes('objectNormal') ? 'normalize(mat3(modelMatrix) * objectNormal)' : 'vec3(0.0, 1.0, 0.0)';
    sh.vertexShader = 'varying vec3 vCartoW;\nvarying float vCartoDepth;\nvarying vec3 vCartoN;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>\n vCartoW = (modelMatrix * vec4(transformed, 1.0)).xyz; vCartoDepth = -mvPosition.z; vCartoN = ${nrm};`);
    const call = mode === 'land' ? 'cartoLand' : 'cartoObject';
    sh.fragmentShader = DECL + FUNCS + sh.fragmentShader;
    const hook = 'gl_FragColor.rgb = mistApply(gl_FragColor.rgb);';
    sh.fragmentShader = sh.fragmentShader.includes(hook)
      ? sh.fragmentShader.replace(hook, `${hook}\n gl_FragColor.rgb = ${call}(gl_FragColor.rgb);`)
      : sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n gl_FragColor.rgb = ${call}(gl_FragColor.rgb);`);
  };
  m.customProgramCacheKey = () => `${prevKey.call(m)}|carto-${mode}-${style}`;
  m.needsUpdate = true;
  return m;
}

// ------------------------------------------------------------------ ink ribbons (roads, trails, rivers)

const INK_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aDir;   // the offset direction (x, z) and the side (±1)
attribute vec4 aInfo;  // kind (0 road, 1 trail, 2 river), t along a river (0 source … 1 mouth), arc length (ft), true half width (ft)
uniform float uPxK;
varying float vSide, vU, vKind, vT, vFpp;
varying vec3 vW;
void main() {
  vec4 wc = modelMatrix * vec4(position, 1.0);
  float fpp = max(1.0, -(viewMatrix * wc).z) * uPxK;
  float kind = aInfo.x, t = aInfo.y;
  float wpx = kind < 0.5 ? 3.4 : kind < 1.5 ? 2.4 : mix(2.0, 5.0, pow(t, 0.7));
  float hw = max(aInfo.w, 0.5 * wpx * fpp);
  wc.xz += aDir.xy * aDir.z * hw;
  wc.y += 2.0 + 0.6 * hw;
  vSide = aDir.z; vU = aInfo.z; vKind = kind; vT = t; vFpp = fpp; vW = wc.xyz;
  gl_Position = projectionMatrix * viewMatrix * wc;
  #include <logdepthbuf_vertex>
}`;
const INK_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uCarto, uDpr;
uniform vec3 uAnchor;
uniform vec2 uOrigin, uSize;
uniform sampler2D tLand;
uniform vec4 uLakes[${MAX_LAKES}];
uniform int uLakeN;
uniform vec3 cRoad, cRoadCase, cWater, cWaterInk;
varying float vSide, vU, vKind, vT, vFpp;
varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vW.xz + uAnchor.xz;
  float sd = 1e9;
  for (int i = 0; i < ${MAX_LAKES}; i++) { if (i >= uLakeN) break; vec4 L = uLakes[i]; vec2 d = (p - L.xy) / L.zw; float rho = max(length(d), 1e-4); sd = min(sd, (rho - 1.0) / max(length(d / (L.zw * rho)), 1e-9)); }
  float s = abs(vSide), aa = fwidth(vSide) * 1.2;
  vec3 c; float a;
  if (vKind < 0.5) { c = mix(cRoad, cRoadCase, smoothstep(0.42 - aa, 0.42 + aa, s)); a = 1.0 - smoothstep(1.0 - aa, 1.0, s); }
  else if (vKind < 1.5) { float ph = fract(vU / (vFpp * 6.0)) - 0.5; float d = length(vec2(ph * 6.0 / 1.2, vSide)); c = cRoadCase; a = 1.0 - smoothstep(0.75, 1.05, d); }
  else { c = mix(mix(cWater, cWaterInk, 0.35), cWaterInk, smoothstep(0.7 - aa, 0.7 + aa, s)); a = (1.0 - smoothstep(1.0 - aa, 1.0, s)) * step(0.0, sd); }
  // inside a placed map's ground the town's own streets carry on: no ink over them until the map is mostly paper
  if (uCarto < 0.6 && texture2D(tLand, (p - uOrigin) / uSize).a > 0.5) discard;
  if (a * uCarto < 0.004) discard;
  gl_FragColor = vec4(c, a * uCarto);
  #include <colorspace_fragment>
}`;

type InkPath = { pts: Vec2[]; kind: 0 | 1 | 2; halfFt: number };

/** Roads, trails and rivers from the world data as one ribbon mesh whose width is held in screen pixels. */
export function buildInk(field: LandField, u: CartoUniforms): THREE.Mesh {
  const W = field.world, paths: InkPath[] = [];
  const chaikin = (pts: Vec2[], n = 2): Vec2[] => {
    let a = pts;
    for (let it = 0; it < n; it++) { const o: Vec2[] = [a[0]]; for (let i = 0; i + 1 < a.length; i++) { const p = a[i], q = a[i + 1]; o.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]); } o.push(a[a.length - 1]); a = o; }
    return a;
  };
  const densify = (pts: Vec2[], step = 200): Vec2[] => {
    const out: Vec2[] = [];
    for (let i = 0; i < pts.length; i++) { if (i) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } out.push(pts[i]); }
    return out;
  };
  for (const r of W.roads) { const trail = r.kind === 'trail' || /path|trail|track/i.test(r.name); paths.push({ pts: densify(chaikin(r.pts.map((p) => field.feet(p)))), kind: trail ? 1 : 0, halfFt: trail ? 4.5 : 8 }); }
  for (const r of W.rivers) paths.push({ pts: densify(chaikin(r.pts.map((p) => field.feet(p)))), kind: 2, halfFt: 20 });
  const P: number[] = [], D: number[] = [], I: number[] = [], idx: number[] = [];
  for (const r of paths) {
    const n = r.pts.length; if (n < 2) continue;
    const v0 = P.length / 3; let s = 0; const lens = [0];
    for (let i = 1; i < n; i++) { s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); lens.push(s); }
    for (let i = 0; i < n; i++) {
      const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const [x, z] = r.pts[i], y = field.height(x, z);
      for (const side of [1, -1]) { P.push(x, y, z); D.push(-dz / L, dx / L, side); I.push(r.kind, lens[i] / Math.max(1, s), lens[i], r.halfFt); }
    }
    for (let i = 0; i + 1 < n; i++) { const a = v0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(D, 3)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(I, 4));
  g.setIndex(idx); g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius += 2000;
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: INK_VERT, fragmentShader: INK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'carto-ink'; mesh.renderOrder = 5; mesh.frustumCulled = false; mesh.userData.role = 'stage';
  return mesh;
}

/** The map's wash over loaded maps (materials.ts): the same ink and paper. */
export function setWash(k: number, style: CartoStyle): void {
  fogUniforms.uCartoWash.value = k;
  fogUniforms.uWashInk.value.set(style.ink); fogUniforms.uWashPaper.value.set(style.paper);
}
