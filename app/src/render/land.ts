// The land beyond the map, drawn as one smooth, natural place at every zoom (docs/STYLE.md, "Ground"):
//  - one height model (`yAt`) for everything that stands on the land: the region's heightfield read as a C1 surface,
//    flattened to the map's own ground near it, cut by Ravenloft's line of sight, with every lake lying in a real basin
//    (a 1:15 bank through the water line, so the shore is where the ellipse is, whatever the mesh resolution) and every
//    river in a shallow channel;
//  - the mesh as a quadtree of square tiles (fine round the map, along shores and wherever the camera looks; coarse
//    toward the horizon, reading a filtered heightfield so far ridges never alias into spikes), each tile an indexed
//    grid with smooth normals and a short skirt, so no fans, facets or cracks show;
//  - water as lit, fogged, feather-edged surfaces (lakes as ellipses, rivers and roads as ribbons lying on the mesh
//    actually drawn, kept at least a few pixels wide from far away);
//  - one atmosphere: the land, water and landmarks take the scene's own mist near the camera (so the map and the land
//    fade alike and no seam shows), capped so the valley's far walls and the castle still stand in it, and dissolve
//    into the sky at the rim.
import * as THREE from 'three';
import type { Theme, WorldData } from '../campaigns';
import { FLOOR_COLOR } from '../kit/palette';
import { patchFog, setSurface } from './materials';
import { gridUniforms } from './gridOverlay';
import type { Terrain } from '../core/terrain';
import type { Surface } from '../kit/surfaces';

type P = [number, number];
export interface PathPt { x: number; z: number }
export interface Path { pts: PathPt[]; w: number; hex: string }
export interface Rect { minX: number; minZ: number; maxX: number; maxZ: number }

export interface LandOpts {
  center: P; yTop: number; crag: number; bounds: Rect; terrain: Terrain; world: WorldData; theme: Theme; ground?: string;
  /** Plan feet → world miles and back (the map's north decides the axes). */
  toMiles: (x: number, z: number) => P; toPlan: (w: P) => P; hPin: number; FT: number;
  /** Ravenloft's brow as seen from this map: a notch is cut through whatever ridge stands between. */
  sight: { x: number; z: number; top: number } | null;
  roads: Path[]; rivers: Path[];
  /** Felled ground round the map (ft): the wood starts beyond it. */
  clearing?: number;
}
export interface Land {
  group: THREE.Group;
  /** The height model: what the land is at (x, z). Trees, sites and boats stand on this. */
  yAt: (x: number, z: number) => number;
  /** The height of the mesh actually drawn at (x, z) (the tile grid, interpolated): ribbons lie on this so they never cross it. */
  surfaceAt: (x: number, z: number) => number;
  lakeLevel: Map<object, number>;
  /** The lit colour of the wood seen from above: trees match it. */
  canopy: THREE.Color;
  /** How thick the wood that hems the map in stands at (x, z), 0..1: the trees are planted by it and the land under
   *  them takes the canopy colour by it, so from high up the wood is a colour, not specks. */
  wood: (x: number, z: number) => number;
  /** Called as the camera moves: refines the tiles round the target (a few ms at a time) and sets the haze for the zoom. */
  update: (target: { x: number; z: number }, pxPerFt: number, camDist: number, invalidate?: () => void) => void;
  /** What the land is doing (for the diagnostics): tiles shown, triangles drawn, the last selection and build times. */
  stats: () => { tiles: number; tris: number; selectMs: number; buildMs: number; built: number; ribbonMs: number; initMs: number; steps: number };
}

// ---------------------------------------------------------------------------------------------------------------------
// Atmosphere. Backdrop materials use the scene's own fog colour (it follows the hour) with their own law: the scene's
// mist up to a cap, so the land next to the map fades exactly as the map's floors do, then an aerial haze by the
// distance beyond the camera's target (what is under the eye stays clear from any height, what lies beyond it recedes
// into the mist as it does from the table), reaching the sky at the rim of the world.
export const atmos = { uHazeDist: { value: 32000 }, uHazeCap: { value: 0.4 }, uRim: { value: 90000 }, uCamDist: { value: 400 }, uCentre: { value: new THREE.Vector2() } };
const HAZE_FRAG = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float mlFog = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float mlFog = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  // the aerial haze beyond the target, and the rim: by the eye's distance and by the distance from the map, so the edge of
  // the world is mist from any height
  float mlLaw = max(1.0 - exp(-max(0.0, vFogDepth - uCamDist) / uHazeDist), max(smoothstep(0.5 * uRim, uRim, vFogDepth), smoothstep(0.55 * uRim, uRim, length(vMistWorld.xz - uCentre))));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, max(min(mlFog, uHazeCap), mlLaw));
#endif`;
/** Give a material the backdrop's atmosphere (after patchFog). Idempotent. */
export function hazePatch<T extends THREE.Material>(m: T): T {
  if (m.userData.haze) return m;
  m.userData.haze = true; (m as THREE.Material & { fog?: boolean }).fog = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, atmos);
    sh.fragmentShader = 'uniform float uHazeDist; uniform float uHazeCap; uniform float uRim; uniform float uCamDist; uniform vec2 uCentre;\n' + sh.fragmentShader.replace('#include <fog_fragment>', HAZE_FRAG);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|haze';
  return m;
}
/** Per-vertex alpha (`aAlpha`) and, for ribbons, a minimum on-screen half width: each vertex is pushed out along its
 *  stored side vector (`aSide`, scaled by its row) until the half width (`aHalf`) is worth `minPx` px, and a widened
 *  ribbon fades by `thin` of the widening (a road far off is a faint trace, a river stays water). */
function softPatch<T extends THREE.Material>(m: T, ribbon?: { minPx: number; thin: number }): T {
  const push = !!ribbon;
  m.transparent = true; m.depthWrite = false; m.side = THREE.DoubleSide;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, { uPxPerFt: gridUniforms.uPxPerFt });
    sh.vertexShader = 'attribute float aAlpha; varying float vAlpha;\n' + (push ? 'attribute vec3 aSide; attribute float aHalf; uniform float uPxPerFt;\n' : '') +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vAlpha = aAlpha;' + (ribbon ? `
 float mlHw = max(aHalf, ${ribbon.minPx.toFixed(2)} / max(uPxPerFt, 1e-4));
 transformed += aSide * (mlHw - aHalf);
 vAlpha *= mix(1.0, sqrt(aHalf / mlHw), ${ribbon.thin.toFixed(2)});` : ''))
        // a ribbon is drawn a few thousandths of its distance nearer the eye along its own sight line: no parallax, but the
        // creases of a coarse tile under it never poke through
        .replace('#include <project_vertex>', push ? '#include <project_vertex>\n mvPosition.xyz *= 0.996; gl_Position = projectionMatrix * mvPosition;' : '#include <project_vertex>');
    sh.fragmentShader = 'varying float vAlpha;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vAlpha;');
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + (ribbon ? `|ribbon${ribbon.minPx}:${ribbon.thin}` : '|soft');
  return m;
}
/** Trees that would be a few pixels tall shade like the ground they stand on (their normals bend up) and shrink a
 *  little, so a wood seen from high up is the land's canopy colour, not a field of dark specks. */
export function treeFade<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, { uPxPerFt: gridUniforms.uPxPerFt, uCamDist: atmos.uCamDist });
    sh.vertexShader = 'uniform float uPxPerFt; uniform float uCamDist; varying float vTreeFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec4 mlIp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
  vec4 mlIp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
  float mlPx = 25.0 * uPxPerFt * uCamDist / max(1.0, -(viewMatrix * mlIp).z); // the tree's height on screen, px
  vTreeFade = 1.0 - smoothstep(3.0, 10.0, mlPx);
  transformed *= 1.0 - 0.45 * vTreeFade;`);
    sh.fragmentShader = 'varying float vTreeFade;\n' + sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), vTreeFade));');
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|tree';
  return m;
}
const lit = (color: THREE.ColorRepresentation, surf: Surface, extra: THREE.MeshLambertMaterialParameters = {}) => {
  const m = new THREE.MeshLambertMaterial({ color, fog: true, flatShading: false, ...extra }); setSurface(m, surf); return hazePatch(patchFog(m, true));
};

// ---------------------------------------------------------------------------------------------------------------------
const N = 16;            // quads per tile side
const Q0 = 25;           // the finest quad, feet
const LEVELS = 9;        // quads 25 .. 6400 ft; tiles 400 .. 102,400 ft; two by two root tiles cover ±102,400 ft
const K = 1.0;           // a tile splits while the focus is nearer than its own width
const smooth = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hash = (i: number, j: number) => { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v; };

interface Lake { l: object; c0: number; c1: number; r0: number; r1: number; rmax: number; L: number }
interface Seg { ax: number; az: number; bx: number; bz: number; w: number; minX: number; minZ: number; maxX: number; maxZ: number }
interface Tile { key: number; l: number; i: number; j: number; x0: number; z0: number; q: number; s: number; h: Float32Array; slot: number; inst: number }
interface Want { key: number; l: number; i: number; j: number; x0: number; z0: number; s: number }

export function buildLand(o: LandOpts): Land {
  const tInit = performance.now();
  const { terrain, world: W, theme: T, FT } = o, HF = terrain.hasHeight;
  const [cx, cz] = o.center, yTop = o.yTop, crag = o.crag, bbm = o.bounds, flatY = yTop - 0.4;
  const mapDist = (x: number, z: number) => Math.max(0, bbm.minX - x, x - bbm.maxX, bbm.minZ - z, z - bbm.maxZ);
  const group = new THREE.Group(); group.name = 'land';
  atmos.uCentre.value.set(cx, cz);
  const gx0 = terrain.x0, gy0 = terrain.y0, gx1 = terrain.x0 + terrain.cols * terrain.cell, gy1 = terrain.y0 + terrain.rows * terrain.cell;

  // --- the height model -----------------------------------------------------------------------------------------
  /** The surveyed land (relief a quarter steeper than surveyed, as a mapmaker would), notched for the castle's gaze,
   *  on its crag if the site has one, flattened to the map's own ground near the map. The heightfield is read more
   *  smoothly the further from the map (about what a quad there spans), as one function of position: every tile, coarse
   *  or fine, and everything standing on the land sample the same surface, so neighbouring tiles meet. */
  const baseAt = (x: number, z: number): number => {
    if (!HF) return flatY - crag;
    const [mx, my] = o.toMiles(x, z), d = mapDist(x, z);
    // beyond the surveyed grid the edge's heights would run on as straight ridges: read them ever more broadly instead
    const outside = Math.max(0, gx0 - mx, mx - gx1, gy0 - my, my - gy1);
    let h = yTop + (terrain.heightSmoothAt(mx, my, Math.max(d / 12 / FT, outside * 0.8)) - o.hPin) * 1.25;
    const sight = o.sight;
    if (sight) {
      const vx = sight.x - cx, vz = sight.z - cz, L2 = vx * vx + vz * vz, tt = ((x - cx) * vx + (z - cz) * vz) / L2;
      if (tt > 0.02 && tt < 0.94) {
        const lat = Math.abs((x - cx) * vz - (z - cz) * vx) / Math.sqrt(L2), wdt = 350 + tt * 2600;
        if (lat < wdt * 1.6) { const los = yTop + 40 + (sight.top - yTop - 40) * tt - 60, k = smooth(wdt * 1.6, wdt * 0.7, lat); if (h > los) h = h + (los - h) * k; }
      }
    }
    if (crag > 0) { const cliff = yTop - crag; return cliff + (h - cliff) * smooth(320, 1400, d); }
    return flatY + (h - flatY) * smooth(120, 900, d);
  };
  // Lakes: each ellipse's level, from the land round its rim (or the map's own ground when its shore reaches the map).
  const lakeLevel = new Map<object, number>();
  const lakes: Lake[] = [];
  for (const l of W.lakes) {
    let lo = Infinity, touches = false;
    for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2, [px, pz] = o.toPlan([l.center[0] + Math.cos(a) * l.r[0], l.center[1] + Math.sin(a) * l.r[1]]); lo = Math.min(lo, baseAt(cx + px, cz + pz)); if (mapDist(cx + px, cz + pz) < 700) touches = true; }
    const [qx, qz] = o.toPlan(l.center), L = touches ? yTop - 2.5 : Math.min(lo, baseAt(cx + qx, cz + qz)) - 4;
    lakeLevel.set(l, L);
    lakes.push({ l, c0: l.center[0], c1: l.center[1], r0: l.r[0], r1: l.r[1], rmax: Math.max(l.r[0], l.r[1]), L });
  }
  /** Signed distance (ft) from a lake's shore: negative inside, by the ellipse's gradient (exact at the shore). */
  const lakeS = (lk: Lake, mx: number, my: number) => {
    const u = (mx - lk.c0) / lk.r0, v = (my - lk.c1) / lk.r1, e = Math.hypot(u, v), g = Math.hypot(u / lk.r0, v / lk.r1) / Math.max(e, 1e-6);
    return (e - 1) * FT / Math.max(g, 1 / lk.rmax);
  };
  // Rivers cut a channel, roads none; both are segments with a loose box for the distance test.
  const segs = (paths: Path[]): Seg[] => { const out: Seg[] = []; for (const p of paths) for (let i = 0; i + 1 < p.pts.length; i++) { const a = p.pts[i], b = p.pts[i + 1], m = p.w * 2.5 + 10; out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, w: p.w, minX: Math.min(a.x, b.x) - m, maxX: Math.max(a.x, b.x) + m, minZ: Math.min(a.z, b.z) - m, maxZ: Math.max(a.z, b.z) + m }); } return out; };
  const riverSegs = segs(o.rivers);
  /** Distance to the nearest river's centreline, and that river's width (Infinity when none is near). */
  const riverAt = (x: number, z: number): { d: number; w: number } => {
    let best = Infinity, w = 40;
    for (const s of riverSegs) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1, t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1);
      const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t); if (d < best) { best = d; w = s.w; }
    }
    return { d: best, w };
  };
  interface Sample { y: number; s: number; rd: number; rw: number }
  /** The land at (x, z): height, how far from the nearest shore, how far from the nearest river. */
  const sampleAt = (x: number, z: number): Sample => {
    const hT = baseAt(x, z), [mx, my] = o.toMiles(x, z);
    let y = hT, s = Infinity, L = 0;
    for (const lk of lakes) { const v = lakeS(lk, mx, my); if (v < s) { s = v; L = lk.L; } }
    if (s < 6000) {
      if (s >= 0) {
        // the bank: a 1:15 beach up from the water line to the land's own height (at most 13 ft of climb), then a blend to
        // the surveyed land over a band wide enough to keep the slope gentle; the land round a lake never dips below it
        const p = clamp(hT - L, 1.5, 13.3), ramp = L + Math.min(s / 15, p);
        const hT2 = Math.max(hT, L + 1.5 - Math.max(0, s - 200) / 20), band = Math.max(300, 1.2 * Math.abs(hT2 - ramp));
        y = ramp + (hT2 - ramp) * smooth(200, 200 + band, s);
      } else {
        // the bed: the same slope on down, then a basin some forty feet deep (never seen: the water is opaque)
        y = L + Math.max(s, -200) / 15 - 26 * smooth(-200, -900, s);
      }
    }
    const rv = riverAt(x, z);
    if (rv.d < rv.w * 2.5) y -= 6 * smooth(rv.w * 2.5, rv.w * 0.5, rv.d) * smooth(60, 400, mapDist(x, z));
    return { y, s, rd: rv.d, rw: rv.w };
  };
  const yAt = (x: number, z: number) => sampleAt(x, z).y;

  // --- colours ---------------------------------------------------------------------------------------------------
  const GRASS = new THREE.Color(FLOOR_COLOR[(o.ground ?? 'grass') as keyof typeof FLOOR_COLOR] ?? FLOOR_COLOR.grass);
  const rock = new THREE.Color('#6a6d74'), hillC = new THREE.Color('#66705f'), forestC = new THREE.Color(T.forest[0]), snowC = new THREE.Color('#c9ced6'), wetC = new THREE.Color('#3f4a46');
  const apronC = new THREE.Color(T.forest[1]).lerp(new THREE.Color(T.apron), 0.35);
  const snowLine = 4200, pinsHigh = W.pins.filter((q) => q.heightFt).map((q) => { const [qx, qz] = o.toPlan(q.pos); return { x: cx + qx, z: cz + qz }; });
  /** The map's own ground gives way to the land's cover along a ragged line, not the map's rectangle. */
  const ragged = (x: number, z: number) => mapDist(x, z) + (noise(x / 1100, z / 1100) - 0.5) * 1100 + (noise(x / 330 + 7.3, z / 330) - 0.5) * 360 + (noise(x / 110 + 3.1, z / 110 + 5.7) - 0.5) * 90;
  /** The wood pressing up to the map: thickening over the first hundred yards past the clearing, thinning out along a
   *  ragged line a third of a mile or so beyond, only where the land is wooded (not in water, on bare rock or open
   *  ground), in clumps. */
  const clearing = o.clearing ?? 0, spanK = 0.12 * Math.max(bbm.maxX - bbm.minX, bbm.maxZ - bbm.minZ); // a big town's wood stands further off, in a broader band
  const wood = (x: number, z: number): number => {
    const md = mapDist(x, z); if (md > 3200 + 2 * spanK || md < clearing + 40) return 0;
    const edge = clearing + 60 + noise(x / 520 + 1.9, z / 520 + 6.1) * 380 + noise(x / 1700 + 4.4, z / 1700 + 0.7) * 900; // the felled ground runs out raggedly, not along the map's rectangle
    let k = smooth(edge, edge + 260 + spanK, md) * (1 - smooth(1700 + spanK, 2800 + 2 * spanK, md + (noise(x / 700 + 3.7, z / 700 + 1.3) - 0.5) * 900));
    if (k <= 0) return 0;
    const [mx, my] = o.toMiles(x, z);
    if (terrain.hasCover) {
      const f = terrain.cover('f', mx, my), w = terrain.cover('w', mx, my), m = terrain.cover('m', mx, my);
      k *= clamp((f - 0.05) / 0.3, 0, 1) * (1 - smooth(0.2, 0.35, w)) * (1 - smooth(0.5, 0.65, m));
    }
    for (const lk of lakes) { const v = lakeS(lk, mx, my); if (v < 120) k *= smooth(20, 120, v); }
    return clamp(k * (0.55 + 0.7 * noise(x / 260 + 9.1, z / 260 + 4.2)), 0, 1);
  };
  const colAt = (x: number, z: number, sm: Sample, out: THREE.Color, slope = 0): THREE.Color => {
    const [mx, my] = o.toMiles(x, z);
    out.copy(apronC);
    if (terrain.hasCover) {
      const f = terrain.cover('f', mx, my), m = terrain.cover('m', mx, my), hl = terrain.cover('h', mx, my), mist = terrain.cover('x', mx, my);
      out.lerp(forestC, Math.min(1, f * 1.6)); out.lerp(hillC, hl); out.lerp(rock, Math.min(1, m * 1.1 + mist * 0.8));
    }
    for (const q of pinsHigh) { const dd = Math.hypot(x - q.x, z - q.z) / FT; if (dd < 0.3) out.lerp(rock, 1 - dd / 0.3); }
    out.lerp(GRASS, 1 - smooth(500, 2400, ragged(x, z)));
    const wd = wood(x, z); if (wd > 0) out.lerp(forestC, 0.85 * wd); // the ground under the trees is the canopy seen from above
    // wet banks: the bed and the first yards of every shore and river are dark, damp ground
    if (sm.s < 60) out.lerp(wetC, 0.7 * (1 - smooth(0, 60, sm.s)));
    if (sm.rd < sm.rw * 1.8) out.lerp(wetC, 0.5 * (1 - smooth(sm.rw * 0.6, sm.rw * 1.8, sm.rd)));
    // steep ground is bare rock, and snow lies on the gentler high ground, thinning in over a broad band, not a contour
    if (slope > 0.45) out.lerp(rock, 0.55 * smooth(0.45, 1.1, slope));
    const above = sm.y - yTop + o.hPin + (noise(x / 900 + 2.3, z / 900 + 8.1) - 0.5) * 900;
    if (above > snowLine) out.lerp(snowC, 0.9 * smooth(snowLine, snowLine + 2600, above) * (1 - 0.7 * smooth(0.7, 1.4, slope)));
    return out;
  };

  // --- tiles -----------------------------------------------------------------------------------------------------
  const landMat = lit('#ffffff', o.ground === 'snow' ? 'snow' : 'grass', { vertexColors: true });
  const ox = cx - N * Q0 * 2 ** (LEVELS - 1), oz = cz - N * Q0 * 2 ** (LEVELS - 1);
  // every tile is one slot of a single batched mesh (one draw for the whole land); a tile put away keeps its slot in the
  // cache until the slot is wanted for a new one, so panning back costs nothing
  const NV = (N + 1) * (N + 1) + 4 * N, NI = N * N * 6 + 4 * N * 6, SLOTS = 640;
  const batch = new THREE.BatchedMesh(SLOTS, SLOTS * NV, SLOTS * NI, landMat);
  batch.name = 'land-tiles'; batch.userData.role = 'backdrop'; batch.frustumCulled = false; batch.perObjectFrustumCulled = true; batch.sortObjects = false;
  group.add(batch);
  const cache = new Map<number, Tile>(), shown = new Map<number, Tile>();
  const keyOf = (l: number, i: number, j: number) => (l << 20) | (i << 10) | j;
  const tmpC = new THREE.Color(), tmpGeo = new THREE.BufferGeometry(), I4 = new THREE.Matrix4();
  /** The ground's slope at a fixed scale (not the quad's), so a mountainside is the same colour at every tile level. */
  const slopeAt = (x: number, z: number, q: number) => { if (!HF) return 0; const e = Math.max(150, q / 2); return Math.hypot(baseAt(x + e, z) - baseAt(x - e, z), baseAt(x, z + e) - baseAt(x, z - e)) / (2 * e); };
  const buildTile = (w: Want): Tile => {
    const q = Q0 * 2 ** w.l, M = N + 3, H = new Float32Array(M * M), S: Sample[] = [];
    for (let jj = 0; jj < M; jj++) for (let ii = 0; ii < M; ii++) { const sm = sampleAt(w.x0 + (ii - 1) * q, w.z0 + (jj - 1) * q); H[jj * M + ii] = sm.y; S.push(sm); }
    const nv = (N + 1) * (N + 1), ring = 4 * N, pos = new Float32Array((nv + ring) * 3), nor = new Float32Array((nv + ring) * 3), col = new Float32Array((nv + ring) * 3), h = new Float32Array(nv);
    for (let jj = 0; jj <= N; jj++) for (let ii = 0; ii <= N; ii++) {
      const k = jj * (N + 1) + ii, x = w.x0 + ii * q, z = w.z0 + jj * q, hi = (jj + 1) * M + ii + 1, y = H[hi];
      h[k] = y; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const dx = (H[hi + 1] - H[hi - 1]) / (2 * q), dz = (H[hi + M] - H[hi - M]) / (2 * q), L = Math.hypot(dx, 1, dz);
      nor[k * 3] = -dx / L; nor[k * 3 + 1] = 1 / L; nor[k * 3 + 2] = -dz / L;
      colAt(x, z, S[hi], tmpC, slopeAt(x, z, q)); col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
    const idx: number[] = [];
    for (let jj = 0; jj < N; jj++) for (let ii = 0; ii < N; ii++) { const a = jj * (N + 1) + ii, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    // the skirt: the border ring copied down and a little outward (under the neighbour), so a coarser neighbour never
    // shows a crack; slanted, not sheer, because a wall seen edge-on from above rasterises as a hairline whose depth,
    // read at the pixel centre beyond the sliver, can land in front of the water
    const drop = q * 1.2 + 3, border: number[] = [], out: [number, number][] = [];
    for (let ii = 0; ii < N; ii++) { border.push(ii); out.push([ii ? 0 : -1, -1]); }
    for (let jj = 0; jj < N; jj++) { border.push(jj * (N + 1) + N); out.push([1, jj ? 0 : -1]); }
    for (let ii = N; ii > 0; ii--) { border.push(N * (N + 1) + ii); out.push([ii < N ? 0 : 1, 1]); }
    for (let jj = N; jj > 0; jj--) { border.push(jj * (N + 1)); out.push([-1, jj < N ? 0 : 1]); }
    for (let k = 0; k < ring; k++) {
      const b = border[k], t = nv + k, [dx, dz] = out[k];
      pos[t * 3] = pos[b * 3] + dx * drop * 0.5; pos[t * 3 + 1] = pos[b * 3 + 1] - drop; pos[t * 3 + 2] = pos[b * 3 + 2] + dz * drop * 0.5;
      for (let c = 0; c < 3; c++) { nor[t * 3 + c] = nor[b * 3 + c]; col[t * 3 + c] = col[b * 3 + c]; }
      const k1 = (k + 1) % ring; idx.push(b, border[k1], t, border[k1], nv + k1, t);
    }
    const geo = tmpGeo;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    // a slot: a fresh one while there are any, else the one of the tile least recently shown
    let slot = -1, inst = -1;
    if (cache.size < SLOTS) { slot = batch.addGeometry(geo); inst = batch.addInstance(slot); batch.setMatrixAt(inst, I4); }
    else { for (const [k, t] of cache) if (!shown.has(k)) { slot = t.slot; inst = t.inst; cache.delete(k); batch.setGeometryAt(slot, geo); break; } }
    batch.setVisibleAt(inst, false);
    return { key: w.key, l: w.l, i: w.i, j: w.j, x0: w.x0, z0: w.z0, q, s: w.s, h, slot, inst };
  };
  /** The drawn mesh's height at (x, z): the finest tile shown there, interpolated on its own triangles. */
  const surfaceAt = (x: number, z: number): number => {
    for (let l = 0; l < LEVELS; l++) {
      const s = N * Q0 * 2 ** l, i = Math.floor((x - ox) / s), j = Math.floor((z - oz) / s), t = shown.get(keyOf(l, i, j));
      if (!t) continue;
      const fx = (x - t.x0) / t.q, fz = (z - t.z0) / t.q, ii = clamp(Math.floor(fx), 0, N - 1), jj = clamp(Math.floor(fz), 0, N - 1), u = clamp(fx - ii, 0, 1), v = clamp(fz - jj, 0, 1);
      const a = jj * (N + 1) + ii, ya = t.h[a], yb = t.h[a + 1], yc = t.h[a + N + 1], yd = t.h[a + N + 2];
      return u + v < 1 ? ya + (yb - ya) * u + (yc - ya) * v : yd + (yb - yd) * (1 - v) + (yc - yd) * (1 - u);
    }
    return yAt(x, z);
  };

  // --- which tiles: a quadtree refined round the map, along shores and rivers, and round the camera's target ------
  const span = Math.max(bbm.maxX - bbm.minX, bbm.maxZ - bbm.minZ);
  const qMap = Q0 * 2 ** Math.ceil(Math.log2(Math.max(1, span / 120 / Q0)));
  let qTarget = qMap;
  const rectDist = (x0: number, z0: number, x1: number, z1: number, r: Rect) => Math.hypot(Math.max(0, r.minX - x1, x0 - r.maxX), Math.max(0, r.minZ - z1, z0 - r.maxZ));
  const lakesPlan = lakes.map((lk) => { const [lx, lz] = o.toPlan([lk.c0, lk.c1]); const reach = lk.rmax * FT + 400; return { lk, x: cx + lx, z: cz + lz, reach }; });
  const shoreTile = (x0: number, z0: number, s: number) => {
    for (const { lk, x, z, reach } of lakesPlan) {
      if (x >= x0 && x <= x0 + s && z >= z0 && z <= z0 + s) return true;
      if (Math.max(0, x0 - x, x - x0 - s) > reach || Math.max(0, z0 - z, z - z0 - s) > reach) continue; // the lake is nowhere near
      let lo = Infinity, hi = -Infinity;
      for (let jj = 0; jj <= 4; jj++) for (let ii = 0; ii <= 4; ii++) { const [mx, my] = o.toMiles(x0 + ii * s / 4, z0 + jj * s / 4); const v = lakeS(lk, mx, my); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (lo < 320 && hi > -260) return true;
    }
    return false;
  };
  const riverTile = (x0: number, z0: number, s: number) => { const x1 = x0 + s, z1 = z0 + s; for (const g of riverSegs) if (g.minX < x1 && g.maxX > x0 && g.minZ < z1 && g.maxZ > z0) return true; return false; };
  const select = (target: { x: number; z: number }): Want[] => {
    const out: Want[] = [];
    const visit = (l: number, i: number, j: number) => {
      const q = Q0 * 2 ** l, s = N * q, x0 = ox + i * s, z0 = oz + j * s, x1 = x0 + s, z1 = z0 + s;
      if (rectDist(x0, z0, x1, z1, { minX: cx, maxX: cx, minZ: cz, maxZ: cz }) > 110000) return; // beyond the rim: nothing but mist
      const dRect = rectDist(x0, z0, x1, z1, bbm), dT = rectDist(x0, z0, x1, z1, { minX: target.x, maxX: target.x, minZ: target.z, maxZ: target.z });
      const inset = Math.min(x0 - bbm.minX, bbm.maxX - x1, z0 - bbm.minZ, bbm.maxZ - z1);
      let want = Infinity;
      if (dRect < s * K) want = Math.min(want, qMap);
      if (dT < s * K) want = Math.min(want, qTarget);
      // shores and river banks are drawn finer than the land round them, the more so the nearer the map or the eye
      const near = Math.min(dRect, dT), qWater = Math.max(100, 2 ** Math.ceil(Math.log2(Math.max(1, near / 50))));
      if (q > qWater && near < 48000 && shoreTile(x0, z0, s)) want = Math.min(want, qWater);
      if (q > qWater && near < 12000 && riverTile(x0, z0, s)) want = Math.min(want, qWater);
      if (inset > 250 && dT > s) want = Math.max(want, 200); // under the map's own floors: nothing to see
      if (l > 0 && q > want) { visit(l - 1, i * 2, j * 2); visit(l - 1, i * 2 + 1, j * 2); visit(l - 1, i * 2, j * 2 + 1); visit(l - 1, i * 2 + 1, j * 2 + 1); }
      else out.push({ key: keyOf(l, i, j), l, i, j, x0, z0, s });
    };
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(LEVELS - 1, i, j);
    // balance: no tile borders one more than a level coarser, so a T-junction is never more than one coarse quad's
    // chord and the skirts always cover it (on a steep mountainside a fine shore tile next to a much coarser one would
    // otherwise open a crack)
    const leaves = new Map<number, Want>(); for (const w of out) leaves.set(w.key, w);
    const find = (x: number, z: number): Want | undefined => {
      for (let l = 0; l < LEVELS; l++) { const s = N * Q0 * 2 ** l, w = leaves.get(keyOf(l, Math.floor((x - ox) / s), Math.floor((z - oz) / s))); if (w) return w; }
      return undefined;
    };
    const split = (w: Want) => {
      leaves.delete(w.key);
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const l = w.l - 1, i = w.i * 2 + di, j = w.j * 2 + dj, s = w.s / 2; leaves.set(keyOf(l, i, j), { key: keyOf(l, i, j), l, i, j, x0: ox + i * s, z0: oz + j * s, s }); }
    };
    for (let pass = 0, changed = true; changed && pass < 10; pass++) {
      changed = false;
      for (const w of [...leaves.values()]) {
        if (!leaves.has(w.key)) continue;
        const x1 = w.x0 + w.s, z1 = w.z0 + w.s, xm = w.x0 + w.s / 2, zm = w.z0 + w.s / 2;
        for (const [x, z] of [[w.x0 - 1, zm], [x1 + 1, zm], [xm, w.z0 - 1], [xm, z1 + 1], [w.x0 - 1, w.z0 + 1], [w.x0 - 1, z1 - 1], [x1 + 1, w.z0 + 1], [x1 + 1, z1 - 1], [w.x0 + 1, w.z0 - 1], [x1 - 1, w.z0 - 1], [w.x0 + 1, z1 + 1], [x1 - 1, z1 + 1]] as const) {
          const n = find(x, z); if (n && n.l > w.l + 1) { split(n); changed = true; }
        }
      }
    }
    // the tiles nearest the eye are built first
    return [...leaves.values()].sort((a, b) => Math.hypot(a.x0 + a.s / 2 - target.x, a.z0 + a.s / 2 - target.z) - Math.hypot(b.x0 + b.s / 2 - target.x, b.z0 + b.s / 2 - target.z));
  };

  // --- water and ribbons -----------------------------------------------------------------------------------------
  const waterHex = FLOOR_COLOR['shallow-water'];
  const lakeMat = softPatch(lit(new THREE.Color(waterHex).lerp(new THREE.Color('#5e7d94'), 0.55), 'water'));
  const riverMat = softPatch(lit(new THREE.Color(waterHex).lerp(new THREE.Color('#5e7d94'), 0.4), 'water'), { minPx: 1.5, thin: 0.35 });
  const roadMats = new Map<string, THREE.MeshLambertMaterial>();
  const roadMat = (hex: string) => { let m = roadMats.get(hex); if (!m) { m = softPatch(lit(hex, 'dirt'), { minPx: 0.9, thin: 0.8 }); roadMats.set(hex, m); } return m; };
  {
    // each lake: a fan of rings at its level, opaque to within yards of the shore, fading out across the beach so the
    // water line is soft and the bed shows through the shallows
    const pos: number[] = [], al: number[] = [], idx: number[] = [], SEG = 128;
    for (const lk of lakes) {
      const base = pos.length / 3, [lx, lz] = o.toPlan([lk.c0, lk.c1]), x = cx + lx, z = cz + lz;
      pos.push(x, lk.L, z); al.push(1);
      const rings: [number, number, boolean][] = [[0.5, 1, false], [-45, 1, true], [0, 0.72, true], [70, 0, true]]; // [e or s, alpha, by s]
      for (const [v, a, byS] of rings) for (let k = 0; k < SEG; k++) {
        const ang = (k / SEG) * Math.PI * 2, u = Math.cos(ang), w = Math.sin(ang);
        const e = byS ? 1 + (v / FT) * Math.hypot(u / lk.r0, w / lk.r1) : v; // s ft out along the gradient
        const [px, pz] = o.toPlan([lk.c0 + u * lk.r0 * e, lk.c1 + w * lk.r1 * e]); pos.push(cx + px, lk.L, cz + pz); al.push(a);
      }
      // (plan +z is south: a loop that runs with the angle is clockwise seen from above, so the triangles run against it)
      for (let k = 0; k < SEG; k++) idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
      for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < SEG; k++) { const a0 = base + 1 + r * SEG + k, a1 = base + 1 + r * SEG + ((k + 1) % SEG), b0 = a0 + SEG, b1 = a1 + SEG; idx.push(a0, a1, b0, a1, b1, b0); }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(al, 1));
      const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1; geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, lakeMat); m.name = 'lakes'; m.userData.role = 'backdrop'; m.renderOrder = 2; group.add(m);
    }
  }
  const ribbons = new THREE.Group(); ribbons.name = 'ribbons'; group.add(ribbons);
  let focus = { x: cx, z: cz }, ribbonMs = 0;
  const rebuildRibbons = () => {
    const t0 = performance.now();
    for (const c of [...ribbons.children]) { ribbons.remove(c); (c as THREE.Mesh).geometry.dispose(); }
    const build = (paths: Path[], mat: THREE.Material, lift: number, river: boolean, name: string) => {
      const pos: number[] = [], side: number[] = [], half: number[] = [], al: number[] = [], idx: number[] = [];
      for (const p of paths) {
        // resample along the polyline (the mesh under it bends every quad), then four rows across: the outer two fade out
        const pts: PathPt[] = [];
        for (let i = 0; i < p.pts.length; i++) {
          if (i) {
            const a = p.pts[i - 1], b = p.pts[i], far = Math.min(mapDist(a.x, a.z), mapDist(b.x, b.z), Math.hypot(a.x - focus.x, a.z - focus.z), Math.hypot(b.x - focus.x, b.z - focus.z));
            const step = clamp(far / 20, 40, 400), n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
            for (let k = 1; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
          }
          pts.push(p.pts[i]);
        }
        const h = p.w / 2, base = pos.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, q = pts[i];
          const [mx, my] = o.toMiles(q.x, q.z); let inLake = 0; for (const lk of lakes) inLake = Math.max(inLake, 1 - smooth(-80, 0, lakeS(lk, mx, my)));
          const fade = smooth(0, 90, mapDist(q.x, q.z)) * (river ? 1 - inLake : 1);
          for (const [f, a0] of [[-1, 0], [-0.62, 1], [0.62, 1], [1, 0]] as const) {
            const x = q.x + nx * h * f, z = q.z + nz * h * f;
            pos.push(x, surfaceAt(x, z) + lift, z); side.push(nx * f, 0, nz * f); half.push(h); al.push(a0 * fade);
          }
          if (i) { const r0 = base + (i - 1) * 4, r1 = base + i * 4; for (let c = 0; c < 3; c++) idx.push(r0 + c, r0 + c + 1, r1 + c, r0 + c + 1, r1 + c + 1, r1 + c); }
        }
      }
      if (!pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 3)); geo.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1)); geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(al, 1));
      const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1; geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.role = 'backdrop'; m.renderOrder = river ? 3 : 2; m.frustumCulled = false; ribbons.add(m);
    };
    build(o.rivers, riverMat, 0.7, true, 'rivers');
    const byHex = new Map<string, Path[]>(); for (const r of o.roads) { const a = byHex.get(r.hex) ?? []; a.push(r); byHex.set(r.hex, a); }
    for (const [hex, paths] of byHex) build(paths, roadMat(hex), 0.5, false, 'roads');
    ribbonMs = performance.now() - t0;
  };

  // --- showing tiles: the desired set is built a few milliseconds at a time; an old tile stays until every finer tile
  //     over it is ready, so the land never has a hole --------------------------------------------------------------
  let desired: Want[] = [], lastKey = '', pending = false, raf = 0, selectMs = 0, buildMs = 0, builtN = 0, steps = 0, dirtyRibbons = false, initMs = 0;
  const overlaps = (a: { x0: number; z0: number; s: number }, b: { x0: number; z0: number; s: number }) => a.x0 < b.x0 + b.s && b.x0 < a.x0 + a.s && a.z0 < b.z0 + b.s && b.z0 < a.z0 + a.s;
  const step = (budgetMs: number, invalidate?: () => void) => {
    const t0 = performance.now(); let built = 0;
    for (const d of desired) { if (cache.has(d.key)) continue; if (built && performance.now() - t0 > budgetMs) break; cache.set(d.key, buildTile(d)); built++; }
    buildMs = performance.now() - t0; builtN = built;
    const want = new Set(desired.map((d) => d.key)); let changed = false;
    for (const d of desired) { const t = cache.get(d.key); if (t && !shown.has(d.key)) { batch.setVisibleAt(t.inst, true); shown.set(d.key, t); cache.delete(d.key); cache.set(d.key, t); changed = true; } }
    for (const [k, t] of shown) if (!want.has(k) && desired.every((d) => !overlaps(d, t) || cache.has(d.key))) { batch.setVisibleAt(t.inst, false); shown.delete(k); changed = true; }
    pending = desired.some((d) => !cache.has(d.key)); steps++;
    dirtyRibbons ||= changed;
    if (!pending && dirtyRibbons) { dirtyRibbons = false; rebuildRibbons(); changed = true; } // the ribbons follow the land once it has settled
    if (pending) { if (!raf) raf = requestAnimationFrame(() => { raf = 0; step(budgetMs, invalidate); }); }
    if (changed) invalidate?.();
  };
  const update = (target: { x: number; z: number }, pxPerFt: number, camDist: number, invalidate?: () => void) => {
    atmos.uCamDist.value = camDist;
    // the quads under the camera's target are worth a few pixels at least; nothing finer than the finest level
    qTarget = Q0 * 2 ** clamp(Math.round(Math.log2(Math.max(1, 6 / Math.max(pxPerFt, 1e-3) / Q0))), 0, LEVELS - 1);
    const key = `${Math.round(target.x / 100)}:${Math.round(target.z / 100)}:${qTarget}`;
    if (key !== lastKey) { lastKey = key; focus = { x: target.x, z: target.z }; const t0 = performance.now(); desired = select(target); selectMs = performance.now() - t0; pending = true; }
    if (pending) step(2, invalidate);
  };
  // the first build: everything round the map, at once
  desired = select({ x: cx, z: cz }); lastKey = ''; step(Infinity); initMs = performance.now() - tInit;

  const stats = () => { let tris = 0; for (const t of shown.values()) tris += t.s > 0 ? NI / 3 : 0; return { tiles: shown.size, tris, selectMs, buildMs, built: builtN, ribbonMs, initMs, steps }; };
  return { group, yAt, surfaceAt, lakeLevel, canopy: forestC.clone(), wood, update, stats };
}
