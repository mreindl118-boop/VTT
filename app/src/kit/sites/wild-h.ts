// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'h-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// H, Tser Falls: a map on two floors a thousand feet apart. The deck level carries a chasm whose walls drop far below
// the level's ground; the land drawn round every outdoor map lies flush with that ground, so the chasm's depths would
// be hidden under it. Pieces below the deck are therefore drawn with "void" materials: a fragment below the ground
// plane is kept only where the eye looks at it through the chasm's opening, and it takes a depth just under that
// opening (ordered among themselves by their true depth), so the land under the map never covers what lies in the
// chasm, while the bridge, the lips and the figures in front still do.
import * as THREE from 'three';
import { PROPS_V1, pineTier } from '../props';
import { CREATURES, horse, skeletonStanding } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { merge } from '../pieces';

type Dims = Record<string, number>;
type P2 = [number, number];

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  wet: '#3e403f', rock: '#4c4a45', rockMid: '#55534e', rockLight: '#615f59', rockPale: '#7a766d', raw: '#8d887c', rawDeep: '#77736a',
  slab: '#5d5b55', slabDark: '#4e4c47', slabPale: '#67645d', lichen: '#676c55', lichenPale: '#7d7b64', glossy: '#323538', cut: '#2e2d2b', cutTop: '#2b2a28', cutLump: '#353431',
  band0: '#47453f', band1: '#4a4946', band2: '#525358', band3: '#606369', band4: '#757980', band5: '#8d9298', band6: '#a7abb0',
  wall0: '#3b3a37', wall1: '#45454a', wall2: '#55585d', wall3: '#6c7076', wall4: '#868b91', wall5: '#a3a7ac', wall6: '#bdc0c5',
  wet0: '#2f302f', wet1: '#383a3e', wet2: '#474b51', wet3: '#5d6269', wet4: '#787e85', wet5: '#969ba1', wet6: '#b3b7bc',
  bandW0: '#3b3a36', bandW1: '#3d3e3d', bandW2: '#454850', bandW3: '#53575e', bandW4: '#6a6f77', bandW5: '#848a91', bandW6: '#a1a6ac',
  shadowMist: '#a2a7ae',
  streak: '#2a2b2c', wetSheen: '#5c7383', trickle: '#a2b5c3', fern: '#3d5a3a', fernDeep: '#2d4530',
  bridge: '#50544b', bridgeDeep: '#43473f', bridgeRing: '#3a3e36', deck: '#4f524a', deckWet: '#454941', mould: '#2e3b29', blackMoss: '#20271d',
  tarn: '#1a2328', tarnEdge: '#26333a', current: '#34464f', currentPale: '#465b65', river: '#2b3a41', riffle: '#7f97aa',
  fall: '#8ea4b5', fallPale: '#a9bccb', fallDeep: '#7f97aa', foam: '#d6dee4', churn: '#c4ced4',
  pool: '#4d6965', poolDeep: '#3a5452', poolShallow: '#667e78',
  mist0: '#dcdee2', mist1: '#c7cad0', mist2: '#b3b7be',
  scorch: '#1b1918', soot: '#262322', glassy: '#2c3138', craze: '#8d949b', char: '#141213',
  dung: '#d8d4c8', dungGrey: '#b9b5a9', bone: '#e2d9c2', brass: '#9a7a3a', iron: '#2e2f33', rust: '#4a3329', spoon: '#8c8f93',
  needle: '#6b5a3a', bark: '#45362a', barkDark: '#3a2c22', bleached: '#b3a996', bleachedDeep: '#9f9686', bleachedPale: '#c6bdaa',
  shingle: '#6c6b67', shingle2: '#82807a', shingle3: '#5c5b58', silt: '#7a7973', siltDark: '#5f5e59', leather: '#5a3f2a', boot: '#3b2f26',
  rope: '#7e6f55', ropeWet: '#5f5442', hide: '#6b5640', hideDark: '#53412f', mud: '#77756e', ash: '#59544f', axe: '#5f5b55',
  scree: '#6d6b66', screeLight: '#7f7c75', screeDark: '#5a5853', cloth: '#5b5446', clothTie: '#3e3528', bat: '#1d1b20', batWing: '#2a2630',
  lantern: '#2a2a2e', lanternGlass: '#16151a', pine: PALETTE.pine, pineDeep: PALETTE.pineDeep, sky: '#2a2b2f', spark: '#f2b35b',
} as const;
surfaceFor([C.wet, C.rock, C.rockMid, C.rockLight, C.rockPale, C.raw, C.rawDeep, C.glossy, C.cut, C.cutTop, C.cutLump, C.streak, C.scree, C.screeLight, C.screeDark, C.axe], 'rock');
surfaceFor([C.slab, C.slabDark, C.slabPale, C.band0, C.band1, C.band2, C.band3, C.band4, C.wall0, C.wall1, C.wall2, C.wall3, C.wall4, C.wet0, C.wet1, C.wet2, C.wet3, C.wet4, C.bandW0, C.bandW1, C.bandW2, C.bandW3, C.bandW4], 'generic');
surfaceFor([C.band5, C.band6, C.wall5, C.wall6, C.wet5, C.wet6, C.bandW5, C.bandW6, C.mist0, C.mist1, C.mist2, C.shadowMist, C.foam, C.churn, C.spark, C.lanternGlass, C.sky], 'none');
surfaceFor([C.lichen, C.lichenPale, C.fern, C.fernDeep, C.mould, C.blackMoss], 'foliage');
surfaceFor([C.bridge, C.bridgeDeep, C.bridgeRing], 'ashlar');
surfaceFor([C.deck, C.deckWet], 'flag');
surfaceFor([C.tarn, C.tarnEdge, C.current, C.currentPale, C.river, C.riffle, C.fall, C.fallPale, C.fallDeep, C.pool, C.poolDeep, C.poolShallow, C.wetSheen, C.trickle], 'water');
surfaceFor([C.scorch, C.soot, C.glassy, C.craze, C.char, C.dung, C.dungGrey, C.bone, C.needle, C.bat, C.batWing, C.silt, C.siltDark, C.mud, C.ash], 'generic');
surfaceFor([C.brass, C.iron, C.rust, C.spoon, C.lantern], 'metal');
surfaceFor([C.bark, C.barkDark], 'bark');
surfaceFor([C.bleached, C.bleachedDeep, C.bleachedPale], 'wood');
surfaceFor([C.shingle, C.shingle2, C.shingle3], 'rubble');
surfaceFor([C.leather, C.boot, C.rope, C.ropeWet, C.hide, C.hideDark, C.cloth, C.clothTie], 'cloth');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smooth value noise along one axis (period 1), seeded. */
const noise1 = (x: number, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u) * 2 - 1; };
type MatFn = (c: string) => THREE.Material;
const M: MatFn = (c) => mat(c);
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0, m: MatFn = M) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 7, m: MatFn = M) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 6, m: MatFn = M) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m(c)), x, y, z);
/** A faceted lump (rock, billow): an icosahedron with its vertices pushed in and out, then squashed. */
function lumpGeo(r: number, seed: number, sx = 1, sy = 1, sz = 1, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return geo;
}
const lump = (r: number, c: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1, m: MatFn = M) => new THREE.Mesh(lumpGeo(r, seed, sx, sy, sz, detail), m(c));
/** An angular, fresh-broken block (low detail: big flat facets). */
const shard = (r: number, c: string, seed: number, sx = 1, sy = 1, sz = 1, m: MatFn = M) => new THREE.Mesh(lumpGeo(r, seed, sx, sy, sz, 0), m(c));
/** A flat polygon in the xz plane at height y (plan points). */
function flat(poly: P2[], y: number, c: string, m: MatFn = M): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))));
  geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, m(c));
}
/** An irregular blob outline of radius about r (stretched sx along x), n points. */
const blobPts = (r: number, seed: number, sx = 1, n = 11, j = 0.3): P2[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = r * (1 - j / 2 + j * hash(i, seed)); return [Math.cos(a) * k * sx, Math.sin(a) * k] as P2; });
/** Polyline from dims: `${p}n` points at `${p}x${i}`, `${p}z${i}` (and widths `${p}w${i}`). */
function dimsLine(d: Dims, p = ''): { pts: P2[]; w: number[] } {
  const n = d[p + 'n'] ?? 0, pts: P2[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) { pts.push([d[`${p}x${i}`] ?? 0, d[`${p}z${i}`] ?? 0]); w.push(d[`${p}w${i}`] ?? 0); }
  return { pts, w };
}
/** Fog: lit like everything else but see-through and drawn without depth writes; cached per colour and opacity. */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** A ragged fog sheet over a plan polygon at height y. */
function fogFlat(poly: P2[], y: number, color: string, opacity: number, m?: THREE.Material): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))));
  geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, m ?? fogMat(color, opacity));
}
/** A strip surface through rows of points (rows[j][i]); flat-shaded, non-indexed. Winding flips with `flip`. */
function strip(rows: THREE.Vector3[][], flip = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  for (let j = 0; j + 1 < rows.length; j++) for (let i = 0; i + 1 < rows[j].length; i++) {
    const a = rows[j][i], b = rows[j][i + 1], c = rows[j + 1][i], e = rows[j + 1][i + 1];
    if (flip) { push(a); push(c); push(b); push(b); push(c); push(e); } else { push(a); push(b); push(c); push(b); push(e); push(c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
/** Like strip(), keeping only the columns `pick` accepts (so one wall splits into dry and streaming runs). */
function stripCols(rows: THREE.Vector3[][], pick: (i: number) => boolean, flip = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  for (let j = 0; j + 1 < rows.length; j++) for (let i = 0; i + 1 < rows[j].length; i++) {
    if (!pick(i)) continue;
    const a = rows[j][i], b = rows[j][i + 1], c = rows[j + 1][i], e = rows[j + 1][i + 1];
    if (flip) { push(a); push(c); push(b); push(b); push(c); push(e); } else { push(a); push(b); push(c); push(b); push(e); push(c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
/** One mesh per material: a piece built from many parts draws in a handful of calls (and a hidden piece, which the
 *  level does not merge, stays cheap). */
function compact(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
  });
  const out = new THREE.Group();
  for (const [mt, gs] of by) out.add(new THREE.Mesh(merge(gs), mt));
  return out;
}
/** Points every `step` ft along a polyline, each with its unit tangent and interpolated width. */
function densify(pts: P2[], w: number[], step: number, closed = false): { p: P2; t: P2; w: number }[] {
  const out: { p: P2; t: P2; w: number }[] = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(1, Math.round(L / step)), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (let s = 0; s < k; s++) { const f = s / k; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], t, w: lerp(w[i] ?? 0, w[(i + 1) % n] ?? 0, f) }); }
  }
  if (!closed) { const a = pts[n - 2], b = pts[n - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ p: [...b] as P2, t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], w: w[n - 1] ?? 0 }); }
  // smooth the tangents at the joints
  for (let i = 1; i + 1 < out.length; i++) { const a = out[i - 1].t, b = out[i + 1].t, tx = a[0] + b[0], tz = a[1] + b[1], L = Math.hypot(tx, tz) || 1; out[i].t = [tx / L, tz / L]; }
  return out;
}

// ---------------------------------------------------------------- the void: what lies below the deck
const VOID_N = 12;
const VOID = {
  uVoidY: { value: 1e6 },
  uVoidN: { value: 0 },
  uVoidP: { value: Array.from({ length: VOID_N }, () => new THREE.Vector3()) },
};
const VOID_DECL = `
uniform float uVoidY;
uniform int uVoidN;
uniform vec3 uVoidP[${VOID_N}];
bool hVoidHole(vec2 q) {
  for (int i = 0; i < ${VOID_N - 1}; i++) {
    if (i + 1 >= uVoidN) break;
    vec3 a = uVoidP[i], b = uVoidP[i + 1];
    vec2 ab = b.xy - a.xy;
    float t = clamp(dot(q - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    if (length(q - a.xy - ab * t) < mix(a.z, b.z, t)) return true;
  }
  return false;
}
#ifndef USE_LOGARITHMIC_DEPTH_BUFFER
uniform mat4 projectionMatrix;
#endif
`;
// After the depth is written: a fragment under the ground plane survives only where it is seen through the opening,
// and takes the depth of a plane a hair over the ground (over the grid too, so no squares are drawn on thin air, but
// under anything standing there), ordered among the chasm's own pieces by their true distance: the land drawn under
// the map loses to it, and the bridge, the lips and the figures in front still win.
const VOID_BODY = `
#ifndef USE_LOGARITHMIC_DEPTH_BUFFER
  gl_FragDepth = gl_FragCoord.z;
#endif
  if (!isOrthographic) {
    vec3 hP = vMistWorld;
    vec3 hV = normalize(cameraPosition - hP);
    if (hP.y < uVoidY - 0.01 && cameraPosition.y > uVoidY && hV.y > 1e-3) {
      vec3 hQ = hP + hV * ((uVoidY - hP.y) / hV.y);
      if (!hVoidHole(hQ.xz)) discard;
      // the depths are packed, nearest first, into the sliver between two planes just over the ground: above the grid,
      // below the bridge's deck and anything standing there
      vec3 hQd = hP + hV * ((uVoidY + 0.19 - hP.y) / hV.y), hQb = hP + hV * ((uVoidY + 0.055 - hP.y) / hV.y);
      float hwQ = -(viewMatrix * vec4(hQd, 1.0)).z, hwB = -(viewMatrix * vec4(hQb, 1.0)).z, hwP = -(viewMatrix * vec4(hP, 1.0)).z;
      float hwE = hwQ + (hwB - hwQ) * (1.0 - exp(-max(hwP - hwQ, 0.0) / 70.0));
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
      gl_FragDepth = log2(1.0 + hwE) * logDepthBufFC * 0.5;
#else
      vec4 hc = projectionMatrix * vec4(0.0, 0.0, -hwE, 1.0);
      gl_FragDepth = (hc.z / hc.w) * 0.5 + 0.5;
#endif
    }
  }
`;
const voidMats = new Map<string, THREE.MeshLambertMaterial>();
/** A palette material that is drawn through the chasm's opening when it lies below the deck (cached per colour). */
function vmat(color: string, opacity = 1, double = false): THREE.MeshLambertMaterial {
  const k = `${color}:${opacity}:${double}`;
  let m = voidMats.get(k);
  if (m) return m;
  m = matClone(color, true); // the depths are geography seen from afar: never under the fog of war
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  if (double || opacity < 1) m.side = THREE.DoubleSide;
  const base = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    Object.assign(sh.uniforms, VOID);
    sh.fragmentShader = VOID_DECL + sh.fragmentShader.replace('#include <logdepthbuf_fragment>', '#include <logdepthbuf_fragment>\n' + VOID_BODY);
  };
  m.customProgramCacheKey = () => key() + ':h-void';
  voidMats.set(k, m);
  return m;
}
const V: MatFn = (c) => vmat(c);
const dmats = new Map<string, THREE.MeshLambertMaterial>();
/** A palette material drawn from both sides (for open surfaces seen from either: a chute, a rib of rock). */
const DS: MatFn = (c) => { let m = dmats.get(c); if (!m) { m = matClone(c); m.side = THREE.DoubleSide; dmats.set(c, m); } return m; };
const VD: MatFn = (c) => vmat(c, 1, true);

/** The chasm's outline: the lips round a chain of capsules along the axis (world ft), with the inward normal at each
 *  lip point. North lip east→west, the round head, the south lip west→east, the round tail. */
function chasmOutline(axis: P2[], hw: number[], step = 5): { p: P2; n: P2 }[] {
  const D = densify(axis, hw, step), out: { p: P2; n: P2 }[] = [];
  const side = (q: { p: P2; t: P2; w: number }, s: number) => { const nx = q.t[1] * s, nz = -q.t[0] * s; return { p: [q.p[0] + nx * q.w, q.p[1] + nz * q.w] as P2, n: [-nx, -nz] as P2 }; };
  for (let i = D.length - 1; i >= 0; i--) out.push(side(D[i], 1));
  // the head: from the north lip round the upstream end (the -t side) to the south lip
  const q0 = D[0], nN0: P2 = [q0.t[1], -q0.t[0]], k0 = Math.max(4, Math.round((Math.PI * q0.w) / step));
  for (let j = 1; j < k0; j++) { const th = (j / k0) * Math.PI, vx = nN0[0] * Math.cos(th) - q0.t[0] * Math.sin(th), vz = nN0[1] * Math.cos(th) - q0.t[1] * Math.sin(th); out.push({ p: [q0.p[0] + vx * q0.w, q0.p[1] + vz * q0.w], n: [-vx, -vz] }); }
  for (let i = 0; i < D.length; i++) out.push(side(D[i], -1));
  // the tail: from the south lip round the far end (the +t side) to the north lip
  const q = D[D.length - 1], nN: P2 = [q.t[1], -q.t[0]], k = Math.max(4, Math.round((Math.PI * q.w) / step));
  for (let j = 1; j < k; j++) { const th = (j / k) * Math.PI, vx = -nN[0] * Math.cos(th) + q.t[0] * Math.sin(th), vz = -nN[1] * Math.cos(th) + q.t[1] * Math.sin(th); out.push({ p: [q.p[0] + vx * q.w, q.p[1] + vz * q.w], n: [-vx, -vz] }); }
  return out;
}
/** How far the chasm wall stands in from its lip at depth d (ft), before the rock's own jitter. */
const lean = (d: number) => 6 * (1 - Math.exp(-d / 40));
const leanAmp = (d: number) => (d < 1 ? 0 : 1.2 + Math.min(d, 200) * 0.018);

/** The chasm at Tser Falls: a slot in the mountain along a bending axis (world-ft points `x{i}`,`z{i}` with half-widths
 *  `w{i}`; the object stands at world (`ox`,`oz`), unturned; `y0` is the deck's elevation). Sheer wet walls lean in and
 *  pale with depth into the mist, water streaks down them, layer on layer of fog fills it and a billowing floor of cloud
 *  hides the bottom some 230 ft down. Lip boulders keep clear of a bridge (`bx`,`bz`, radius `br`) and of the falls'
 *  head (the first axis point). */
export function chasm(d: Dims): THREE.Group {
  const g = grp(), { pts, w } = dimsLine(d), ox = d.ox ?? 0, oz = d.oz ?? 0, floorY = -(d.depth ?? 230);
  if (pts.length < 2) return g;
  // the opening, for the void materials (world ft), a little generous so no sliver of land shows at the lip
  VOID.uVoidY.value = d.y0 ?? 0; VOID.uVoidN.value = Math.min(VOID_N, pts.length);
  pts.slice(0, VOID_N).forEach((p, i) => VOID.uVoidP.value[i].set(p[0], p[1], w[i] + 1));
  const loc = pts.map(([x, z]) => [x - ox, z - oz] as P2), O = chasmOutline(loc, w, 5), n = O.length;
  // walls: rows of points down from the lip; ribs (jointing) run down the face, ledges break it
  const ROWS = [0, 4, 10, 18, 28, 40, 55, 72, 92, 115, 140, 168, 198, 232, 270, 310];
  const BANDS: [number, number, string, string][] = [[0, 2, C.band0, C.bandW0], [2, 4, C.band1, C.bandW1], [4, 6, C.band2, C.bandW2], [6, 8, C.band3, C.bandW3], [8, 10, C.band4, C.bandW4], [10, 12, C.band5, C.bandW5], [12, 15, C.band6, C.bandW6]];
  const off = (k: number, depth: number) => lean(depth) + leanAmp(depth) * (0.65 * noise1(k / 2.6, 3) + 0.35 * noise1(k / 1.1 + depth / 23, 7));
  const at = (k: number, depth: number) => { const o = O[((k % n) + n) % n], f = off(k, depth); return new THREE.Vector3(o.p[0] + o.n[0] * f, -depth, o.p[1] + o.n[1] * f); };
  // water streams down some runs of the wall (darker, wetter rock); the rest is dry
  const wetRun = (k: number) => noise1(k / 1.9, 17) > 0.25 || hash(k, 19) > 0.88;
  for (const [r0, r1, col, wcol] of BANDS) {
    const rows: THREE.Vector3[][] = [];
    for (let j = r0; j <= r1; j++) { const row: THREE.Vector3[] = []; for (let k = 0; k <= n; k++) row.push(at(k, ROWS[j])); rows.push(row); }
    g.add(new THREE.Mesh(stripCols(rows, (k) => !wetRun(k)), VD(col)), new THREE.Mesh(stripCols(rows, wetRun), VD(wcol)));
  }
  // water streaming down the walls: narrow wet ribs standing a little proud of the face, pale threads in them
  const nearBridge = (p: P2) => d.br !== undefined && Math.hypot(p[0] + ox - (d.bx ?? 0), p[1] + oz - (d.bz ?? 0)) < (d.br ?? 0);
  const nearHead = (p: P2) => Math.hypot(p[0] - loc[0][0], p[1] - loc[0][1]) < w[0] + 12;
  // wet, glossy rock where seepage comes over the lip into a streaming run
  for (let s = 0; s < 12; s++) {
    const k = Math.floor(hash(s, 41) * n), o = O[k];
    if (nearBridge(o.p) || nearHead(o.p) || o.p[0] + ox > 600 || !wetRun(k)) continue;
    const c0 = at(k, 0);
    g.add(place(lump(0.8, C.wetSheen, s, 1.6, 0.4, 1, 0, V), c0.x - o.n[0] * 0.6, 0.05, c0.z - o.n[1] * 0.6));
  }
  // fog: thin layers filling the slot, thicker with depth, then the cloud floor that hides the bottom
  const ring = (depth: number, extra: number): P2[] => O.filter((_, i) => i % 2 === 0).map((o, i) => { const f = lean(depth) - extra - hash(i, depth) * 3; return [o.p[0] + o.n[0] * f, o.p[1] + o.n[1] * f] as P2; });
  for (const [dd, op, col] of [[95, 0.1, C.mist0], [150, 0.16, C.mist1], [195, 0.24, C.mist1]] as [number, number, string][]) g.add(fogFlat(ring(dd, 4), -dd, col, op, vmat(col, op)));
  // the cloud floor: shadowed where it meets the walls, bright in the middle where the light falls into the slot
  g.add(fogFlat(ring(-floorY, 8), floorY, C.shadowMist, 1, vmat(C.shadowMist)));
  g.add(fogFlat(ring(-floorY, -9), floorY + 2, C.mist2, 1, vmat(C.mist2)), fogFlat(ring(-floorY, -17), floorY + 4, C.mist1, 1, vmat(C.mist1)));
  // billows on the cloud floor, along the axis, heaped toward the head where the falls boil up
  const DA = densify(loc, w, 9);
  DA.forEach((q, i) => {
    const head = Math.max(0, 1 - i / 8);
    for (let k = 0; k < 2 + Math.round(head * 3); k++) {
      const s = i * 7 + k, lat = (hash(s, 51) - 0.5) * q.w * 1.2, r = q.w * (0.3 + hash(s, 52) * 0.35) * (1 + head * 0.4);
      g.add(place(new THREE.Mesh(lumpGeo(r, s, 1.3, 0.38 + head * 0.25, 1, 1), vmat(k % 2 ? C.mist0 : C.mist1)), q.p[0] + q.t[1] * lat * 0.6, floorY + 3 + r * 0.1 + head * 18, q.p[1] - q.t[0] * lat * 0.6, hash(s, 53) * 3));
    }
  });
  // cold air spilling over the lips: wisps hanging a little way down the walls
  for (let s = 0; s < 16; s++) {
    const k = Math.floor(hash(s, 61) * n), o = O[k];
    if (nearBridge(o.p) || o.p[0] + ox > 620) continue;
    const c = at(k, 14), card = new THREE.Mesh(new THREE.PlaneGeometry(14 + hash(s, 62) * 16, 22 + hash(s, 63) * 20), vmat(C.mist0, 0.1));
    place(card, c.x + o.n[0] * 3, -14, c.z + o.n[1] * 3, Math.atan2(o.n[0], o.n[1])); g.add(card);
  }
  // broken rock and moss along both lips (on the ground: ordinary materials)
  for (let k = 0; k < n; k += 2) {
    const o = O[k]; if (nearBridge(o.p) || nearHead(o.p) || o.p[0] + ox > 615 || hash(k, 71) < 0.15) continue;
    const r = 0.7 + hash(k, 72) * 1.9, back = 0.6 + hash(k, 73) * 2.2;
    g.add(place(lump(r, k % 3 ? C.rockMid : C.rock, k, 1.3, 0.55, 1.05, 0), o.p[0] - o.n[0] * back, r * 0.2, o.p[1] - o.n[1] * back, hash(k, 74) * 3));
    if (hash(k, 75) > 0.6) g.add(place(lump(0.6 + hash(k, 76) * 0.7, C.blackMoss, k + 3, 1.6, 0.35, 1.2, 0), o.p[0] - o.n[0] * (back + 1.5), 0.12, o.p[1] - o.n[1] * (back + 1.5)));
  }
  return g;
}

/** The sill where the tarn goes over (local +x downstream, the lip `w` ft wide across local z at x = 0): an undercut
 *  rock lip glossy with wet, the water sliding over it in a curl and dropping into the chasm, lost in its own cloud
 *  within a few dozen feet. `curve`: how far the lip's ends stand downstream of its middle (it follows a round head). */
export function fallsSill(d: Dims): THREE.Group {
  const W = d.w ?? 45, g = grp(), n = Math.max(6, Math.round(W / 3)), CV = d.curve ?? 0, lipX = (z: number) => CV * (z / (W / 2)) ** 2;
  // the lip: a long block of glossy rock, the water's bed on top of it, undercut below
  g.add(place(lump(1, C.glossy, 3, 7, 1.6, W / 2 + 7, 1), -4, -0.6, 0));
  for (const s of [-1, 1]) {
    g.add(place(lump(4.5, C.glossy, 5 + s, 1.6, 0.9, 1.1, 1), CV - 1, 0.6, s * (W / 2 + 4.5), 0.3));
    g.add(place(lump(2.4, C.wet, 8 + s, 1.3, 1, 1, 0), CV + 2.5, 1.2, s * (W / 2 + 2.5)));
    g.add(place(lump(2.8, C.lichen, 9 + s, 2.2, 0.25, 1.6, 0), -9, 0.2, s * (W / 2 + 7)));
  }
  // the undercut: the face under the lip recedes, black and streaming
  for (let i = 0; i < 6; i++) g.add(place(lump(5 + hash(i, 2) * 3, C.wet, i + 20, 0.9, 1.6, 1.3, 1, V), -5 - hash(i, 3) * 3, -8 - i * 9, -W / 2 + (i + 0.5) * (W / 6)));
  // the water: a smooth tongue speeding up toward the lip, the curl over it, the sheet falling away
  for (let i = 0; i < n; i++) {
    const z = -W / 2 + (i + 0.5) * (W / n), ww = (W / n) * 1.04, col = [C.fall, C.fallPale, C.fallDeep][i % 3], lx = lipX(z);
    g.add(place(new THREE.Mesh(new THREE.BoxGeometry(14 + lx, 0.3, ww), mat(i % 2 ? C.current : C.currentPale)), -7 + lx / 2, 0.42, z));
    const curl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, ww, 6, 1, true, 0, Math.PI / 2), V(col)); curl.rotation.x = Math.PI / 2; curl.position.set(lx, -2.2, z); g.add(curl);
    // the falling sheet: drifting out from the wall as it drops, broken into ropes of white
    const drop = 26 + hash(i, 4) * 26;
    for (let j = 0; j < 4; j++) { const y0 = -2.2 - j * (drop / 4), y1 = y0 - drop / 4; const seg = box(ww, drop / 4 + 0.3, 1.4, j % 2 ? col : C.fallPale, lx + 2.6 + (j + 0.5) * 1.6, (y0 + y1) / 2, z, 0, VD); seg.rotation.z = -0.06; g.add(seg); }
    if (i % 2 === 0) g.add(box(0.6, drop * 0.8, 1.5, C.foam, lx + 3.4 + hash(i, 5), -2.5 - drop * 0.4, z + (hash(i, 6) - 0.5) * ww * 0.6, 0, VD));
  }
  for (let i = 0; i < n; i++) { const z = -W / 2 + (i + 0.5) * (W / n); g.add(place(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, (W / n) * 1.1), mat(C.foam)), lipX(z) + 0.6, 0.15, z)); }
  // the cloud the sheet vanishes into, boiling up the head of the chasm
  for (let i = 0; i < 16; i++) {
    const r = 7 + hash(i, 11) * 9, m = i % 3 === 0 ? vmat(C.foam, 0.92) : vmat(i % 2 ? C.mist0 : C.mist1, 0.72);
    g.add(place(new THREE.Mesh(lumpGeo(r, i + 30, 1.25, 0.8, 1.1, 1), m), CV + 9 + hash(i, 12) * 22, -22 - hash(i, 13) * 70, (hash(i, 14) - 0.5) * (W + 10)));
  }
  return g;
}

/** Cold mist boiling up and drifting with the wind (local +x): a dense source `r` ft round at the origin thinning
 *  along `len` ft of drift, up to `h` ft high. `ring` > 0 lays a ring of wet dark rock that wide on the ground. */
export function sprayCloud(d: Dims): THREE.Group {
  const R = d.r ?? 18, L = d.len ?? 120, H = d.h ?? 26, g = grp(), n = d.n ?? 26;
  for (let i = 0; i < n; i++) {
    const f = Math.pow(hash(i, 1), 1.4), x = f * L, r = R * (0.55 + hash(i, 2) * 0.5) * (1 - f * 0.35), y = 2 + hash(i, 3) * H * (1 - f * 0.5);
    const op = Math.max(0.06, (d.op ?? 0.24) * (1 - f * 0.75));
    g.add(place(new THREE.Mesh(lumpGeo(r, i + 7, 1.6, 0.42, 1, 1), fogMat(i % 3 ? C.mist0 : C.mist1, Math.round(op * 40) / 40)), x, y, (hash(i, 4) - 0.5) * R * (1.4 + f * 1.4), hash(i, 5) * 3));
  }
  for (let i = 0; i < 3; i++) g.add(fogFlat(blobPts(R * (1.1 + i * 0.4), i + 90, 2.2, 13, 0.5).map(([x, z]) => [x + L * (0.15 + i * 0.25), z] as P2), 3 + i * 5, C.mist0, 0.08));
  if (d.ring) {
    const ring = d.ring;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = ring * (0.8 + hash(i, 21) * 0.3); g.add(place(lump(1.8 + hash(i, 22) * 2, i % 2 ? C.wet : C.glossy, i, 1.6, 0.3, 1.2, 0), Math.cos(a) * rr, 0.1, Math.sin(a) * rr)); }
  }
  return g;
}

/** The tarn above the falls: a cold black pond (`rx` × `rz` ft half-sizes) held against the sill on its east side
 *  (`sill` ft east of the centre, the spill `sw` ft wide centred `sz` ft south of it), current lines converging on the
 *  spill, a stony shore and shallow margin, and the fast clear river (`iw` ft wide) coming in from `inflow` ft west. */
export function tarn(d: Dims): THREE.Group {
  const RX = d.rx ?? 65, RZ = d.rz ?? 45, SX = d.sill ?? 72, SW = d.sw ?? 45, SZ = d.sz ?? 12, g = grp(), sd = d.seed ?? 4;
  const N = 30, poly: P2[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, k = 0.9 + 0.18 * hash(i, sd); let x = Math.cos(a) * RX * k, z = Math.sin(a) * RZ * k;
    if (x > SX - 22) { x = Math.min(SX, x + 10); z = Math.max(SZ - SW / 2 - 4, Math.min(SZ + SW / 2 + 4, z)); }
    poly.push([x, z]);
  }
  const scale = (k: number, dx = 0): P2[] => poly.map(([x, z]) => [x * k + dx, z * k]);
  g.add(flat(scale(1.05), 0.06, C.tarnEdge), flat(poly, 0.12, C.tarn), flat(scale(0.55, -8), 0.13, '#141b1f'));
  // the inflow: fast and clear over stones
  const IN = d.inflow ?? 80, IW = d.iw ?? 24;
  g.add(flat([[-IN - 2, -IW / 2 + 4], [-RX * 0.8, -IW / 2 - 2], [-RX * 0.8, IW / 2 + 2], [-IN - 2, IW / 2 + 2]], 0.1, C.river));
  for (let i = 0; i < 9; i++) { const x = -IN + hash(i, 31) * (IN - RX * 0.8), z = (hash(i, 32) - 0.5) * IW * 0.8; g.add(place(new THREE.Mesh(new THREE.BoxGeometry(5 + hash(i, 33) * 6, 0.12, 0.5), mat(C.riffle)), x, 0.16, z, (hash(i, 34) - 0.5) * 0.4)); }
  for (let i = 0; i < 14; i++) { const x = -IN + hash(i, 35) * (IN - RX * 0.75), s = i % 2 ? 1 : -1; g.add(place(lump(0.7 + hash(i, 36), C.rockMid, i, 1.2, 0.6, 1, 0), x, 0.25, s * (IW / 2 + 0.5 + hash(i, 37) * 2))); }
  // current lines: pale threads drawn toward the spill, closer together as they near it
  for (let l = 0; l < 8; l++) {
    const z0 = (l / 7 - 0.5) * RZ * 1.5, x0 = -RX * (0.7 - Math.abs(z0) / RZ * 0.3), pts: P2[] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, e = t * t; pts.push([lerp(x0, SX - 2, t), lerp(z0, SZ + (l / 7 - 0.5) * SW * 0.7, e) + Math.sin(t * 5 + l) * 1.5]); }
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az);
      if (hash(l * 9 + k, 38) < 0.25) continue;
      g.add(place(new THREE.Mesh(new THREE.BoxGeometry(L * 0.85, 0.06, 0.35 + (k / 8) * 0.3), mat(k > 5 ? C.currentPale : C.current)), (ax + bx) / 2, 0.15, (az + bz) / 2, -Math.atan2(bz - az, bx - ax)));
    }
  }
  // pine needles turning slowly toward the sill
  for (let i = 0; i < 26; i++) g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.1), mat(C.needle)), lerp(-RX * 0.5, SX - 8, hash(i, 41)), 0.17, (hash(i, 42) - 0.5) * RZ, hash(i, 43) * 3));
  // the stony shore: rounded stones in the margin, thicker on the north side
  for (let i = 0; i < N * 3; i++) {
    const k = i % N, p = poly[k], q = poly[(k + 1) % N], f = hash(i, 51), x = lerp(p[0], q[0], f), z = lerp(p[1], q[1], f);
    if (x > SX - 18 && Math.abs(z - SZ) < SW / 2 + 2) continue;
    if (z > 0 && hash(i, 52) < 0.45) continue;
    const r = 0.5 + hash(i, 53) * (z < 0 ? 1.6 : 1.0), out = 1.03 + hash(i, 54) * 0.08;
    g.add(place(lump(r, i % 3 ? C.rockLight : C.rockMid, i, 1.2, 0.55, 1, 0), x * out, r * 0.18, z * out, hash(i, 55) * 3));
  }
  return g;
}

/** The bridge over the chasm (local +x from its south end at the origin to its north end at `len`): a single arch of
 *  green-black stone leaping a void `span` ft wide, its intrados springing `deep` ft under the deck; a slightly humped
 *  deck `w` ft wide, parapets `par` ft high with a coping furred in black moss, four corner newels (tops at
 *  rise(0) + par + 0.6) for the gargoyles, wing walls on the ground, mould hanging from the spandrels. `xc`: where along
 *  the deck the void's middle lies (the arch's crown). */
export function hBridge(d: Dims): THREE.Group {
  const L = d.len ?? 90, W = d.w ?? 15, SP = d.span ?? 70, DEEP = d.deep ?? 42, R = d.rise ?? 0.6, P = d.par ?? 3, g = grp(), xc = d.xc ?? L / 2;
  const yAt = (x: number) => 0.2 + R * Math.max(0, 1 - ((x - L / 2) / (L / 2 - 4)) ** 2);
  const n = Math.max(12, Math.round(L / 3));
  for (let i = 0; i < n; i++) {
    const x0 = (i * L) / n, x1 = x0 + L / n, xm = (x0 + x1) / 2, y0 = yAt(x0), y1 = yAt(x1), ym = (y0 + y1) / 2, sl = Math.atan2(y1 - y0, L / n), len = L / n / Math.cos(sl) + 0.06;
    const deck = box(len, 2.4, W - 1.7, i % 2 ? C.deck : C.deckWet, xm, ym - 1.2, 0, 0, V); deck.rotation.z = sl; g.add(deck);
    for (const s of [-1, 1]) {
      const par = box(len, P + 0.6, 0.95, C.bridge, xm, ym + P / 2 - 0.3, s * (W / 2 - 0.47), 0, V); par.rotation.z = sl; g.add(par);
      const cop = box(len + 0.04, 0.35, 1.25, C.bridgeDeep, xm, ym + P + 0.15, s * (W / 2 - 0.47)); cop.rotation.z = sl; g.add(cop);
      // the coping furred like an animal: shaggy moss along it, hanging down the outer face
      for (let k = 0; k < 2; k++) { const fx = x0 + (k + hash(i * 2 + k, s + 5)) * (L / n) / 2; g.add(place(lump(0.55 + hash(i * 2 + k, s + 6) * 0.35, k ? C.blackMoss : C.mould, i * 2 + k, 1.6, 0.55, 1.1, 0), fx, yAt(fx) + P + 0.4, s * (W / 2 - 0.4))); }
      if (hash(i, s + 9) > 0.45) g.add(place(lump(0.7, C.mould, i + 40, 1.3, 2.2, 0.45, 0, V), xm + (hash(i, s + 11) - 0.5) * 2, ym - 2.5 - hash(i, s + 12) * 3, s * (W / 2 + 0.2)));
    }
  }
  // the arch: spandrels and abutments extruded across the bridge, the intrados a semicircle-like segment
  const prof = new THREE.Shape(), a = SP / 2, s0 = DEEP - 6, Rr = (a * a + s0 * s0) / (2 * s0), cy = -6 - Rr;
  prof.moveTo(0, -1.2);
  for (let k = 0; k <= 12; k++) { const x = (k / 12) * L; prof.lineTo(x, yAt(x) - 2.3); }
  prof.lineTo(L, -DEEP - 14); prof.lineTo(xc + a + 4, -DEEP - 10);
  const th0 = Math.asin(Math.min(1, a / Rr));
  for (let k = 0; k <= 20; k++) { const th = th0 - (k / 20) * 2 * th0; prof.lineTo(xc + Math.sin(th) * Rr, cy + Math.cos(th) * Rr); }
  prof.lineTo(xc - a - 4, -DEEP - 10); prof.lineTo(0, -DEEP - 14); prof.closePath();
  const body = new THREE.ExtrudeGeometry(prof, { depth: W - 1.0, bevelEnabled: false }); body.translate(0, 0, -(W - 1.0) / 2);
  g.add(new THREE.Mesh(body, V(C.bridgeDeep)));
  // the arch ring standing proud of both faces
  const ring = new THREE.Shape();
  for (let k = 0; k <= 20; k++) { const th = -th0 + (k / 20) * 2 * th0; const p = [xc + Math.sin(th) * (Rr + 3.4), cy + Math.cos(th) * (Rr + 3.4)]; if (k === 0) ring.moveTo(p[0], p[1]); else ring.lineTo(p[0], p[1]); }
  for (let k = 20; k >= 0; k--) { const th = -th0 + (k / 20) * 2 * th0; ring.lineTo(xc + Math.sin(th) * Rr, cy + Math.cos(th) * Rr); }
  const rg = new THREE.ExtrudeGeometry(ring, { depth: W + 1.2, bevelEnabled: false }); rg.translate(0, 0, -(W + 1.2) / 2);
  g.add(new THREE.Mesh(rg, V(C.bridgeRing)));
  // mould and black moss hanging from the ring and the spandrels; drips under the soffit
  for (let i = 0; i < 26; i++) {
    const th = -th0 + hash(i, 61) * 2 * th0, s = i % 2 ? 1 : -1, rr = Rr + 1 + hash(i, 62) * 3;
    g.add(place(lump(0.9 + hash(i, 63) * 0.8, i % 3 ? C.mould : C.blackMoss, i + 70, 1.1, 2.4, 0.5, 0, V), xc + Math.sin(th) * rr, cy + Math.cos(th) * rr - 1.5, s * (W / 2 + 0.9)));
  }
  for (let i = 0; i < 14; i++) { const th = -th0 * 0.8 + hash(i, 64) * 1.6 * th0; g.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2 + hash(i, 65) * 2.5, 4), V(C.mould)), xc + Math.sin(th) * Rr, cy + Math.cos(th) * Rr - 1.2, (hash(i, 66) - 0.5) * (W - 2), 0, Math.PI)); }
  // newels at the corners, wing walls flaring out on the ground at both ends
  for (const ex of [0, L]) for (const s of [-1, 1]) {
    const sx = ex === 0 ? 1 : -1, y = yAt(ex);
    g.add(box(1.9, P + 1.2, 1.9, C.bridgeDeep, ex + sx * 0.95, y + P / 2, s * (W / 2 - 0.47)), box(2.2, 0.35, 2.2, C.bridgeRing, ex + sx * 0.95, y + P + 0.42, s * (W / 2 - 0.47)));
    g.add(place(lump(0.7, C.blackMoss, s + ex, 1.5, 0.6, 1.5, 0), ex + sx * 0.95, y + P + 0.75, s * (W / 2 - 0.47)));
    const wing = box(7, P + 0.4, 0.95, C.bridge, ex - sx * 3.2, (P + 0.4) / 2, s * (W / 2 + 0.9)); wing.rotation.y = sx * s * 0.38; g.add(wing);
    g.add(box(1.3, P + 0.8, 1.3, C.bridgeDeep, ex - sx * 6.4, (P + 0.8) / 2, s * (W / 2 + 2.2)));
    for (let k = 0; k < 4; k++) g.add(place(lump(0.6 + hash(k, s + ex) * 0.5, C.mould, k + ex, 1.6, 0.4, 1.2, 0), ex - sx * (1 + k * 1.6), 0.15, s * (W / 2 + 1.6 + hash(k, 3) * 1.2)));
  }
  // spray-wet sheen on the deck: darker patches
  for (let i = 0; i < 10; i++) { const x = 8 + hash(i, 81) * (L - 16); g.add(place(new THREE.Mesh(new THREE.BoxGeometry(2 + hash(i, 82) * 4, 0.05, 1.5 + hash(i, 83) * 3), mat(C.deckWet)), x, yAt(x) + 0.02, (hash(i, 84) - 0.5) * (W - 5))); }
  return g;
}

/** A raw pale scar on a rock face (the face in local x across, facing +z, `h` ft high) and the fan of fresh angular
 *  boulders spilling `len` ft down-slope along +z, widening to `w`; the biggest is wagon-sized, none lichened. */
export function rockfallScar(d: Dims): THREE.Group {
  const H = d.h ?? 26, Lf = d.len ?? 38, Wf = d.w ?? 30, g = grp();
  for (let i = 0; i < 14; i++) { const y = 3 + hash(i, 1) * (H - 4), x = (hash(i, 2) - 0.5) * 14 * (0.5 + y / H); g.add(place(shard(2.2 + hash(i, 3) * 2.6, i % 3 ? C.raw : C.rawDeep, i + 5, 1.3, 1.1, 0.55), x, y, -1.2 - hash(i, 4) * 1.5, hash(i, 5) * 3, hash(i, 6) * 0.6)); }
  for (let i = 0; i < 46; i++) {
    const f = Math.sqrt(hash(i, 11)), z = 2 + f * Lf, x = (hash(i, 12) - 0.5) * (8 + f * Wf), r = 0.5 + hash(i, 13) * (1 + f * 1.6) + (i === 0 ? 5.2 : i < 4 ? 2.8 : i < 9 ? 1.2 : 0);
    g.add(place(shard(r, [C.raw, C.rawDeep, C.rockPale][i % 3], i + 20, 1.15, 0.8, 1), i === 0 ? 2 : x, r * 0.45, i === 0 ? Lf * 0.86 : z, hash(i, 14) * 6, hash(i, 15) * 0.5, hash(i, 16) * 0.5));
  }
  for (let i = 0; i < 30; i++) { const f = hash(i, 21), z = 3 + f * Lf * 0.8, x = (hash(i, 22) - 0.5) * (6 + f * Wf * 0.7); g.add(place(shard(0.25 + hash(i, 23) * 0.35, C.raw, i + 90), x, 0.15, z)); }
  return g;
}

/** A star of black scorch burned into a bare slab (`r` ft out to its points), the rock at its heart fused to a dull,
 *  crazed glass the size of a shield, and a pine's stump charred a foot high beside it, its roots traced in soot. */
export function lightningStar(d: Dims): THREE.Group {
  const R = d.r ?? 7.5, g = grp(), n = 11;
  g.add(flat(blobPts(R * 0.42, 3, 1, 12, 0.35), 0.05, C.soot));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, 1) * 0.3, L = R * (0.6 + hash(i, 2) * 0.4), wd = 0.5 + hash(i, 3) * 0.6;
    const ray: P2[] = [[Math.cos(a - 0.12) * R * 0.3, Math.sin(a - 0.12) * R * 0.3], [Math.cos(a) * L, Math.sin(a) * L], [Math.cos(a + 0.12) * R * 0.3, Math.sin(a + 0.12) * R * 0.3]];
    g.add(flat(ray, 0.06, C.scorch));
    if (hash(i, 4) > 0.5) { const b = a + (hash(i, 5) - 0.5) * 0.9, bl = L * 0.6; g.add(flat([[Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55], [Math.cos(b) * (L * 0.55 + bl * 0.5), Math.sin(b) * (L * 0.55 + bl * 0.5)], [Math.cos(a) * L * 0.6 + wd * 0.2, Math.sin(a) * L * 0.6]], 0.065, C.scorch)); }
  }
  g.add(flat(blobPts(1.4, 9, 1.1, 9, 0.2), 0.09, C.glassy));
  for (let i = 0; i < 9; i++) { const a = hash(i, 11) * Math.PI * 2, l = 0.5 + hash(i, 12) * 0.9; g.add(place(new THREE.Mesh(new THREE.BoxGeometry(l, 0.03, 0.06), mat(C.craze)), Math.cos(a) * l * 0.5, 0.11, Math.sin(a) * l * 0.5, -a)); }
  // the stump, a foot high, burned black, its roots traced in soot across the rock
  const sx = R * 0.42, sz = -R * 0.3;
  g.add(cyl(0.6, 0.85, 1, C.char, sx, 0.5, sz, 7), cyl(0.55, 0.55, 0.08, C.soot, sx, 1.02, sz, 7));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, l = 1.6 + hash(i, 21) * 2; g.add(place(new THREE.Mesh(new THREE.BoxGeometry(l, 0.12, 0.28), mat(C.char)), sx + Math.cos(a) * (l / 2 + 0.5), 0.07, sz + Math.sin(a) * (l / 2 + 0.5), -a)); }
  for (let i = 0; i < 7; i++) { const a = hash(i, 31) * Math.PI * 2, rr = R * (0.5 + hash(i, 32) * 0.5); g.add(place(shard(0.25 + hash(i, 33) * 0.3, C.scorch, i), Math.cos(a) * rr, 0.12, Math.sin(a) * rr)); }
  return g;
}

/** A mass of living rock (a faceted lump `sx` × `sy` × `sz` about its centre), cut flat at `top` and at the ground. */
function rockMass(c: string, seed: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, top: number, ry = 0): THREE.Mesh {
  const geo = lumpGeo(1, seed, sx, sy, sz, 2); geo.rotateY(ry); geo.translate(x, y, z);
  const pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) pv.setY(i, Math.max(0, Math.min(top, pv.getY(i))));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(c));
}

/** The Wizard's Precipice: a spur of rock with a flat stance `w` × `d` on top at `h` ft, sheer on three sides, a
 *  scramble of broken steps down its shoulder toward local +x. */
export function precipice(d: Dims): THREE.Group {
  const H = d.h ?? 35, TW = d.w ?? 25, TD = d.d ?? 20, sd = d.seed ?? 7, g = grp();
  // the spur: a core of rock cut flat at the stance, buttresses round it reaching most of the way up
  g.add(rockMass(C.rock, sd, TW * 0.62, H * 0.75, TD * 0.66, 0, H * 0.45, 0, H));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4, f = 0.55 + hash(k, sd) * 0.35;
    g.add(rockMass(k % 2 ? C.rockMid : C.rock, sd + k + 3, TW * 0.3, H * f * 0.75, TD * 0.3, Math.cos(a) * TW * 0.42, H * f * 0.45, Math.sin(a) * TD * 0.45, H * f, a));
  }
  // the stance on top: a flat weathered slab, broken stones at its rim
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 9), mat(C.slab)); top.scale.set(TW * 0.52, 1, TD * 0.52); top.position.y = H - 0.42; g.add(top);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(place(lump(1 + hash(i, sd + 3) * 0.9, C.rockMid, i + sd, 1.5, 0.5, 1.2, 0), Math.cos(a) * TW * 0.5, H - 0.1, Math.sin(a) * TD * 0.5, hash(i, 5) * 3)); }
  // the scramble down the +x shoulder: broken blocks stepping down to the road
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / (steps + 1), x = TW * 0.42 + i * 6, y = Math.max(2.5, H * (1 - t)), z = (hash(i, sd + 9) - 0.5) * 5;
    g.add(rockMass(i % 2 ? C.rockMid : C.rock, sd + 40 + i, 5.5, y * 0.75, 5.5 - i * 0.3, x, y * 0.45, z, y, hash(i, sd + 10)));
    g.add(place(lump(0.8 + hash(i, 11) * 0.6, C.rockLight, i + 60, 1.4, 0.5, 1.2, 0), x + 1.5, y + 0.1, z + 1.5));
  }
  // lichen on the north (sheltered) side, boulders at the foot
  for (let i = 0; i < 8; i++) g.add(place(lump(1 + hash(i, 21), C.lichen, i + 80, 1.6, 0.3, 1.3, 0), (hash(i, 22) - 0.5) * TW, 4 + hash(i, 23) * (H - 8), -TD * 0.66));
  for (let i = 0; i < 10; i++) { const a = hash(i, 31) * Math.PI * 2; g.add(place(lump(1.2 + hash(i, 32) * 2, C.rockMid, i + 90, 1.3, 0.7, 1.1, 0), Math.cos(a) * TW * 0.85, 0.6, Math.sin(a) * TD * 0.9)); }
  return g;
}

/** The shelf road's dressing (the road itself is the map's dirt): along a polyline (`x{i}`,`z{i}` in world ft, the object
 *  at world `ox`,`oz`) of half-width `hw`, a cut rock wall `wall` ft high on the uphill (left of travel) side, a
 *  crumbling lip of loose stone on the downhill side with bites where the edge has gone (`gaps` of them), and two
 *  wheel ruts holding water. */
export function shelfRoad(d: Dims): THREE.Group {
  const g = grp(), { pts } = dimsLine(d), ox = d.ox ?? 0, oz = d.oz ?? 0, HW = d.hw ?? 7, WH = d.wall ?? 11;
  if (pts.length < 2) return g;
  const D = densify(pts.map(([x, z]) => [x - ox, z - oz] as P2), pts.map(() => 0), 4), n = D.length;
  // the cut wall: a jagged face, its top broken back into the slope
  const rows: THREE.Vector3[][] = [];
  for (const [yy, back] of [[0, 0], [WH * 0.35, 0.5], [WH * 0.7, 1.2], [WH, 2.6], [WH + 3, 7]] as [number, number][]) {
    rows.push(D.map((q, i) => { const lx = q.t[1], lz = -q.t[0], j = 1.2 * noise1(i / 2.2 + yy * 0.2, 5) + 0.8, off = HW + 1 + back + j, hh = yy * (0.75 + 0.5 * (noise1(i / 3.1, 9) * 0.5 + 0.5)); return new THREE.Vector3(q.p[0] + lx * off, hh, q.p[1] + lz * off); }));
  }
  g.add(new THREE.Mesh(strip(rows), mat(C.rock)));
  for (let i = 0; i < n; i += 3) { const q = D[i], lx = q.t[1], lz = -q.t[0]; if (hash(i, 7) > 0.55) g.add(place(lump(0.8 + hash(i, 8) * 1.3, i % 2 ? C.rockMid : C.rockLight, i, 1.3, 0.7, 1, 0), q.p[0] + lx * (HW + 0.6), 0.4, q.p[1] + lz * (HW + 0.6))); if (hash(i, 9) > 0.7) g.add(place(lump(0.9, C.lichen, i + 3, 1.5, 0.3, 1.2, 0), q.p[0] + lx * (HW + 4), WH * 0.95, q.p[1] + lz * (HW + 4))); }
  // the crumbling lip
  const gaps = Array.from({ length: d.gaps ?? 3 }, (_, k) => Math.floor((0.2 + 0.6 * hash(k, 13)) * n));
  for (let i = 0; i < n; i++) {
    const q = D[i], rx = -q.t[1], rz = q.t[0], bite = gaps.some((k) => Math.abs(i - k) < 3);
    if (bite) { if (i % 2 === 0) g.add(place(lump(0.5 + hash(i, 14) * 0.5, C.screeDark, i + 30, 1.3, 0.4, 1, 0), q.p[0] + rx * (HW + 3 + hash(i, 15) * 3), 0.15, q.p[1] + rz * (HW + 3 + hash(i, 15) * 3))); continue; }
    if (hash(i, 16) < 0.25) continue;
    const r = 0.5 + hash(i, 17) * 1.1; g.add(place(lump(r, i % 3 ? C.rockMid : C.rock, i + 50, 1.3, 0.6, 1, 0), q.p[0] + rx * (HW + 0.8 + hash(i, 18) * 0.8), r * 0.25, q.p[1] + rz * (HW + 0.8 + hash(i, 18) * 0.8), hash(i, 19) * 3));
  }
  // ruts and puddles
  for (const s of [-2.6, 2.6]) for (let i = 0; i + 1 < n; i++) {
    const a = D[i], b = D[i + 1], lx = a.t[1], lz = -a.t[0], L = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const puddle = hash(i, s > 0 ? 21 : 22) > 0.72;
    g.add(place(new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.04, puddle ? 1.3 : 0.75), mat(puddle ? C.river : C.siltDark)), (a.p[0] + b.p[0]) / 2 + lx * s, 0.1, (a.p[1] + b.p[1]) / 2 + lz * s, -Math.atan2(b.p[1] - a.p[1], b.p[0] - a.p[0])));
  }
  return g;
}

/** A wagon-sized slab split cleanly in two (the split along local z), the halves a foot apart, on bare rock. */
export function anvilBlock(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(6 * s, 6.5 * s, 8 * s, 2, 2, 2), pv = geo.attributes.position;
    for (let i = 0; i < pv.count; i++) {
      const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), inner = x * side < -2.9 * s;
      const j = (k: number) => (hash(i + side * 50, k) - 0.5) * 0.9 * s;
      pv.setXYZ(i, inner ? x : x * (y > 0 ? 1.12 : 0.92) + j(1), y + (y > 0 ? j(2) * 0.6 : 0), z * (y > 0 ? 1.08 : 0.95) + (inner ? 0 : j(3)));
    }
    geo.computeVertexNormals(); geo.translate(side * 3.5 * s, 3.25 * s, 0);
    g.add(new THREE.Mesh(geo, mat(side > 0 ? C.rockMid : C.rock)));
    for (let k = 0; k < 3; k++) g.add(place(lump(0.8 + hash(k, side + 3) * 0.6, C.lichenPale, k + side, 1.6, 0.3, 1.2, 0), side * (3.5 + (hash(k, side) - 0.5) * 3) * s, 6.6 * s, (hash(k, side + 8) - 0.5) * 6 * s));
  }
  g.add(box(0.9 * s, 0.05, 7.5 * s, C.scorch, 0, 0.04, 0));
  for (let i = 0; i < 8; i++) { const a = hash(i, 11) * Math.PI * 2, r = (6 + hash(i, 12) * 4) * s; g.add(place(lump(0.5 + hash(i, 13) * 0.7, C.rockMid, i + 20, 1.3, 0.6, 1, 0), Math.cos(a) * r, 0.25, Math.sin(a) * r)); }
  return g;
}

/** White droppings under a raven perch, scattered with what the birds bring up from the river: fish spines, a vole's
 *  skull, small bones, a button or two, a buckle and a bent spoon. About `r` ft across. */
export function ravenLitter(d: Dims): THREE.Group {
  const R = d.r ?? 6, g = grp();
  for (let i = 0; i < 9; i++) { const a = hash(i, 1) * Math.PI * 2, rr = R * Math.sqrt(hash(i, 2)) * 0.8; g.add(flat(blobPts(0.8 + hash(i, 3) * 1.6, i, 1.4, 8, 0.6).map(([x, z]) => [x + Math.cos(a) * rr, z + Math.sin(a) * rr] as P2), 0.05 + i * 0.002, i % 3 ? C.dung : C.dungGrey)); }
  for (let i = 0; i < 4; i++) { const z = (hash(i, 5) - 0.5) * R, x = (hash(i, 6) - 0.5) * R; const sp = grp(box(1.6, 0.06, 0.08, C.bone)); for (let k = 0; k < 6; k++) sp.add(box(0.05, 0.05, 0.6, C.bone, -0.65 + k * 0.26, 0, 0)); place(sp, x, 0.1, z, hash(i, 7) * 3); g.add(sp); }
  g.add(place(lump(0.25, C.bone, 3, 1.4, 0.8, 1, 0), R * 0.2, 0.15, -R * 0.15));
  for (let i = 0; i < 7; i++) g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.5 + hash(i, 9) * 0.5, 0.08, 0.08), mat(C.bone)), (hash(i, 10) - 0.5) * R * 1.2, 0.1, (hash(i, 11) - 0.5) * R, hash(i, 12) * 3));
  for (let i = 0; i < 3; i++) g.add(cyl(0.12, 0.12, 0.05, i ? C.brass : C.bone, (hash(i, 14) - 0.5) * R, 0.1, (hash(i, 15) - 0.5) * R, 8));
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 8), mat(C.iron)), -R * 0.25, 0.1, R * 0.2, 0, Math.PI / 2));
  const spoon = grp(box(0.8, 0.04, 0.08, C.spoon, 0, 0, 0), place(new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), mat(C.spoon)), 0.5, 0, 0)); spoon.children[0].rotation.z = 0.4; place(spoon, R * 0.3, 0.12, R * 0.25, 1.2); g.add(spoon);
  // streaks down the newel's face, above the litter
  if (d.streak) for (let i = 0; i < 4; i++) g.add(box(0.35, 1.5 + hash(i, 21) * 1.5, 0.05, C.dung, -1 + i * 0.6, 1.2 + hash(i, 22), -R * 0.5));
  return g;
}

/** A wind-bent pine, leaning toward local +x (away from the gorge), sparse on its windward side. */
export function bentPine(d: Dims): THREE.Group {
  const s = d.scale ?? 1, lean = ((d.lean ?? 16) * Math.PI) / 180, h = 24 * s, g = grp();
  // the trunk in three lengths, each bent further over than the last
  let px = 0, py = 0;
  const trunkX: [number, number][] = [[0, 0]];
  for (let k = 0; k < 3; k++) {
    const ang = lean * (0.4 + k * 0.45), segL = h * 0.3, seg = cyl((0.55 - k * 0.13) * s, (0.78 - k * 0.13) * s, segL, C.bark, px + (Math.sin(ang) * segL) / 2, py + (Math.cos(ang) * segL) / 2, 0, 6);
    seg.rotation.z = -ang; g.add(seg); px += Math.sin(ang) * segL; py += Math.cos(ang) * segL; trunkX.push([py, px]);
  }
  const xAt = (y: number) => { for (let k = 0; k + 1 < trunkX.length; k++) { const [y0, x0] = trunkX[k], [y1, x1] = trunkX[k + 1]; if (y <= y1 || k === trunkX.length - 2) return lerp(x0, x1, Math.min(1, (y - y0) / (y1 - y0 || 1))); } return px; };
  for (let i = 0; i < 4; i++) {
    const t = i / 4, tr = 6 * s * (1 - t * 0.55), th = h * (0.3 - t * 0.04), y = h * (0.28 + t * 0.2) + th / 2;
    const tier = new THREE.Mesh(pineTier(tr, th, 7, i + Math.round(s * 10)), mat(i % 2 ? C.pineDeep : C.pine));
    tier.position.set(xAt(y) + tr * 0.4, y, 0); tier.scale.set(1.2, 1, 0.75); tier.rotation.z = -lean * 0.6; g.add(tier);
  }
  for (let k = 0; k < 3; k++) { const b = box(5 * s, 0.25 * s, 0.25 * s, C.barkDark, -1.5 * s, h * (0.35 + k * 0.17), (k - 1) * 0.6 * s); b.rotation.z = 0.25; g.add(b); }
  g.add(place(lump(1.3 * s, C.rockMid, 3, 1.6, 0.6, 1.3, 0), -1.2 * s, 0.3, 0.8 * s));
  return g;
}

/** Rusted iron pins down a rock face with a frayed rope tied to the top one. The rope runs `run` ft along local +z on
 *  the ground (from the pin at the origin) to the edge, then hangs `len` ft down, standing off the face as the chasm
 *  wall leans (`lean` 1) or straight down a sheer face (`lean` 0). `top` raises the whole line (a rope seen from a
 *  ledge below, coming down to it). */
export function climbRope(d: Dims): THREE.Group {
  const RUN = d.run ?? 0, LEN = d.len ?? 120, TOP = d.top ?? 0, LEANS = d.lean ?? 1, g = grp(), m: MatFn = LEANS ? V : M;
  const off = (dd: number) => RUN + 0.8 + (LEANS ? lean(dd) + leanAmp(dd) + 0.6 : 0);
  // the top pin, driven into a crack, the knot round it
  g.add(cyl(0.12, 0.12, 2.2, C.rust, 0, TOP + 0.6, 0, 5), place(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 4, 8), mat(C.iron)), 0, TOP + 1.5, 0.1, 0, 0, 0), place(lump(0.45, C.rope, 2, 1.3, 1, 1.3, 0), 0, TOP + 1.3, 0.25));
  if (RUN > 0) { const r = box(0.2, 0.15, RUN, C.rope, 0.2, TOP + 0.12, RUN / 2 + 0.3); r.rotation.y = 0.04; g.add(r); }
  // the hanging line: segments with a little sway, pins every 35 ft, the end frayed into strands
  let prev = new THREE.Vector3(0.2, TOP, off(0));
  for (let dd = 3; dd <= LEN; dd += 6) {
    const p = new THREE.Vector3(0.2 + Math.sin(dd * 0.07) * 0.4, TOP - dd, off(dd)), mid = prev.clone().add(p).multiplyScalar(0.5), L = prev.distanceTo(p);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.2, L + 0.05, 0.2), m(dd > LEN * 0.6 ? C.ropeWet : C.rope)); seg.position.copy(mid); seg.lookAt(p); seg.rotateX(Math.PI / 2); g.add(seg);
    prev = p;
  }
  for (let dd = 30; dd < LEN; dd += 35) { const z = off(dd) - 1.1; g.add(box(0.14, 0.14, 1.6, C.rust, -0.6, TOP - dd, z, 0, m), place(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 6), m(C.iron)), -0.6, TOP - dd - 0.2, z + 0.7)); }
  for (let k = 0; k < 5; k++) { const st = box(0.06, 1.3, 0.06, C.rope, prev.x + (k - 2) * 0.1, prev.y - 0.6, prev.z, 0, m); st.rotation.z = (k - 2) * 0.25; g.add(st); }
  return g;
}

/** A bare rock slab lying on the ground: the plan polygon `x{i}`,`z{i}` (local ft), `h` ft thick, weathered edge stones
 *  and lichen spots on top. `tone` 0..2 picks how dark. */
export function slab(d: Dims): THREE.Group {
  const g = grp(), { pts } = dimsLine(d), H = d.h ?? 0.8, tone = d.tone ?? 0;
  if (pts.length < 3) return g;
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(geo, mat([C.slab, C.slabDark, C.slabPale][tone % 3])));
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  pts.forEach((p, i) => { if (hash(i, 3) > 0.55) g.add(place(lump(0.5 + hash(i, 4) * 0.9, C.rockMid, i, 1.3, 0.6, 1, 0), p[0] + (cx - p[0]) * 0.05, H * 0.6, p[1] + (cz - p[1]) * 0.05)); });
  for (let i = 0; i < Math.min(9, pts.length); i += 3) { const f = 0.25 + hash(i, 6) * 0.5, p = pts[i]; g.add(flat(blobPts(0.5 + hash(i, 7) * 0.8, i + 20, 1.2, 7, 0.5).map(([x, z]) => [x + lerp(cx, p[0], f), z + lerp(cz, p[1], f)] as P2), H + 0.03, i % 2 ? C.lichen : C.lichenPale)); }
  return g;
}

// ---------------------------------------------------------------- the canyon floor and the Vistana's ledge
/** A steep chute of loose grey stone between rock ribs, from the origin (its head) running `len` ft along local +x while
 *  dropping `drop` ft, `w` ft wide; `fan` > 0 spreads a talus cone that wide at its foot. */
export function screeGully(d: Dims): THREE.Group {
  const L = d.len ?? 120, DR = d.drop ?? 150, W = d.w ?? 14, g = grp(), n = 10;
  const at = (t: number, s: number, up = 0) => new THREE.Vector3(t * L + Math.sin(t * 4) * 3, -DR * (t + 0.15 * Math.sin(t * Math.PI)) + up, s * (W / 2) * (1 + t * 0.3));
  const rows: THREE.Vector3[][] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; rows.push([-1, -0.4, 0.4, 1].map((s, k) => at(t, s, (k === 1 || k === 2 ? -0.6 : 0) + hash(i * 4 + k, 3) * 0.8))); }
  g.add(new THREE.Mesh(strip(rows), DS(C.scree)));
  for (const s of [-1, 1]) {
    const rib: THREE.Vector3[][] = [];
    for (const up of [0, 5, 10]) { const row: THREE.Vector3[] = []; for (let i = 0; i <= n; i++) { const p = at(i / n, s); row.push(new THREE.Vector3(p.x, p.y + up + hash(i, s + up) * 3, p.z + s * (1 + up * 0.25))); } rib.push(row); }
    g.add(new THREE.Mesh(strip(rib), DS(C.rock)));
  }
  for (let i = 0; i < 70; i++) { const t = hash(i, 11), p = at(t, (hash(i, 12) - 0.5) * 1.6); g.add(place(shard(0.35 + hash(i, 13) * 0.8, [C.scree, C.screeLight, C.screeDark][i % 3], i, 1.2, 0.6, 1), p.x, p.y + 0.3, p.z, hash(i, 14) * 3)); }
  if (d.fan) { const f = d.fan, e = at(1, 0); for (let i = 0; i < 40; i++) { const a = (hash(i, 21) - 0.5) * Math.PI * 1.2, r = Math.sqrt(hash(i, 22)) * f; g.add(place(shard(0.4 + hash(i, 23) * 1.2, [C.scree, C.screeLight, C.screeDark][i % 3], i + 40, 1.2, 0.6, 1), e.x + Math.cos(a) * r, e.y + 0.3 + (1 - r / f) * 2, e.z + Math.sin(a) * r)); } g.add(place(lump(f * 0.6, C.scree, 5, 1.2, 0.25, 1.4, 1), e.x + f * 0.2, e.y, e.z)); }
  return g;
}

/** The falls seen from the canyon floor: a sheet `w` ft wide across local z coming down from `h` ft (its top `drift` ft
 *  toward local -x), white ropes of foam, paling into cloud above ~200 ft, a mist curtain and churn at its foot. */
export function fallsColumn(d: Dims): THREE.Group {
  const W = d.w ?? 45, H = d.h ?? 900, DR = d.drift ?? 14, FO = d.focus ?? 0, g = grp(), n = Math.max(8, Math.round(W / 3));
  const TOP = Math.min(H, FO + (d.reach ?? 300));
  const ys = [...new Set([0, 12, 30, 60, 100, 150, 210, 290, 400, 560, FO - 160, FO - 90, FO - 40, FO, FO + 40, FO + 90, FO + 160, TOP].filter((y) => y >= Math.max(0, FO - (d.reach ?? 300)) && y <= TOP).map(Math.round))].sort((a, b) => a - b);
  const far = (y: number) => Math.abs(y - FO);
  const bandCol = (y: number) => (far(y) < 70 ? null : far(y) < 150 ? C.fallPale : far(y) < 260 ? C.mist2 : far(y) < 480 ? C.mist1 : C.mist0);
  for (let i = 0; i < n; i++) {
    const z = -W / 2 + (i + 0.5) * (W / n), ww = (W / n) * 1.06;
    for (let j = 0; j + 1 < ys.length; j++) {
      const y0 = ys[j], y1 = ys[j + 1], x0 = -DR * Math.pow(y0 / H, 0.6), x1 = -DR * Math.pow(y1 / H, 0.6);
      const col = bandCol((y0 + y1) / 2) ?? [C.fall, C.fallPale, C.fallDeep][(i + j) % 3];
      const fy = far((y0 + y1) / 2), sheet = box(ww, y1 - y0 + 0.4, 4 + (fy > 260 ? 6 : 0), col, (x0 + x1) / 2, (y0 + y1) / 2, z + (hash(i * 13 + j, 1) - 0.5) * 1.2, 0, fy > 200 ? (c) => fogMat(c, fy > 330 ? 0.22 : 0.5) : M);
      sheet.rotation.z = Math.atan2(x1 - x0, y1 - y0) * -1; g.add(sheet);
    }
    if (i % 2 === 0) { const len = 140 + hash(i, 3) * 140, mid = Math.max(len / 2, FO + (hash(i, 7) - 0.5) * 60); g.add(box(0.8, len, 4.6, C.foam, -DR * Math.pow(mid / H, 0.6) + 0.6, mid, z + (hash(i, 4) - 0.5) * ww)); }
  }
  // the curtain of spray and the churn at the foot
  if (!d.nofoot) for (let i = 0; i < 16; i++) { const a = hash(i, 11) * Math.PI * 2, r = 10 + hash(i, 12) * 24, s = 5 + hash(i, 13) * 7; g.add(place(new THREE.Mesh(lumpGeo(s, i + 3, 1.3, 0.8, 1.1, 1), fogMat(i % 3 ? C.mist0 : C.foam, i % 3 ? 0.22 : 0.45)), Math.cos(a) * r, 3 + hash(i, 14) * 22, Math.sin(a) * r * 1.2)); }
  if (!d.nofoot) for (let i = 0; i < 14; i++) { const z = (hash(i, 21) - 0.5) * W; g.add(place(lump(2.5 + hash(i, 22) * 3, C.foam, i + 30, 1.4, 0.5, 1.2, 1), 4 + hash(i, 23) * 6, 0.6, z)); }
  return g;
}

/** The plunge pool: grey-green water `rx` × `rz` ft (half-sizes), white and heaving where the falls hit it (`ix`,`iz`),
 *  ringed by a standing wave; deep and dark on the overhung side, shelving to pale shallows toward local +x. `cut` > 0
 *  leaves the shore stones off its north side (where the pool meets the wall). */
export function plungePool(d: Dims): THREE.Group {
  const RX = d.rx ?? 75, RZ = d.rz ?? 60, IX = d.ix ?? 0, IZ = d.iz ?? 0, g = grp(), sd = d.seed ?? 6, N = 26;
  const poly = blobPts(1, sd, 1, N, 0.18).map(([x, z]) => [x * RX, z * RZ] as P2);
  g.add(flat(poly.map(([x, z]) => [x * 1.04, z * 1.04] as P2), 0.12, C.poolShallow), flat(poly, 0.16, C.pool));
  g.add(flat(poly.map(([x, z]) => [x * 0.62 - RX * 0.15, z * 0.66] as P2), 0.18, C.poolDeep));
  g.add(flat(poly.map(([x, z]) => [x * 0.42 + RX * 0.5, z * 0.5 + 4] as P2), 0.17, C.poolShallow));
  // the boil under the falls and the standing wave round it
  for (let i = 0; i < 22; i++) { const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 20; g.add(place(lump(2 + hash(i, 3) * 3, i % 3 ? C.foam : C.churn, i, 1.4, 0.35, 1.2, 1), IX + Math.cos(a) * r, 0.5, IZ + Math.sin(a) * r * 1.2)); }
  const wave = new THREE.Mesh(new THREE.TorusGeometry(30, 1.6, 4, 28), mat(C.churn)); wave.rotation.x = Math.PI / 2; wave.scale.set(1, 1.25, 0.5); wave.position.set(IX, 0.35, IZ); g.add(wave);
  for (let i = 0; i < 30; i++) { const a = hash(i, 5) * Math.PI * 2, r = 34 + hash(i, 6) * 26; g.add(place(new THREE.Mesh(new THREE.BoxGeometry(1.4 + hash(i, 7) * 3, 0.06, 0.4), mat(C.foam)), IX + Math.cos(a) * r, 0.22, IZ + Math.sin(a) * r * 1.1, -a + Math.PI / 2)); }
  // the shore: wet stones round the margin, none against the wall
  for (let i = 0; i < N * 2; i++) {
    const k = i % N, p = poly[k], q = poly[(k + 1) % N], f = hash(i, 9), x = lerp(p[0], q[0], f), z = lerp(p[1], q[1], f);
    if (d.cut && z < -RZ * 0.35) continue;
    const r = 0.6 + hash(i, 10) * 1.6; g.add(place(lump(r, i % 2 ? C.wet : C.rockMid, i + 40, 1.3, 0.55, 1, 0), x * 1.06, r * 0.2, z * 1.06));
  }
  return g;
}

/** The Cauldron's walls (and the canyon's beyond it), from the canyon floor up out of sight. The wall's foot is the
 *  polyline `x{i}`,`z{i}` (local ft), ordered so the canyon lies on the side (t.z, -t.x) of travel; when `cut` > 0 the
 *  rock outside it is drawn as a solid cut level at that height out to `mx0`..`mx1`, `mz0`..`mz1` (a section through the
 *  mountain), the polyline's ends lying on that box's edge. Above the cut (or from `below` ft under the origin) the
 *  faces rise to `h` ft, leaning in toward the top by up to `over` ft, black-streaked and wet, paling into cloud;
 *  ferns grow from the lower cracks. The faces are drawn from the canyon side only, so a view from outside looks in.
 *  A second polyline `ux{i}`,`uz{i}` (same order) gives the faces' foot where it differs from the cut's (a cave mouth
 *  bridged over). */
export function cauldronWall(d: Dims): THREE.Group {
  const g = grp(), { pts } = dimsLine(d), CUT = d.cut ?? 0, H = d.h ?? 900, OVER = d.over ?? 40, BELOW = d.below ?? 0;
  if (pts.length < 2) return g;
  const F = densify(pts, pts.map(() => 0), 6), up = dimsLine(d, 'u').pts, D = up.length > 1 ? densify(up, up.map(() => 0), 6) : F, n = D.length;
  if (CUT > 0) {
    const sh = new THREE.Shape(), [x0, x1, z0, z1] = [d.mx0 ?? -400, d.mx1 ?? 1000, d.mz0 ?? -400, d.mz1 ?? 900];
    const foot = F.map((q, i) => [q.p[0] - q.t[1] * (noise1(i / 2.4, 3) * 2.5), q.p[1] + q.t[0] * (noise1(i / 2.4, 3) * 2.5)] as P2);
    foot.forEach(([x, z], i) => (i === 0 ? sh.moveTo(x, -z) : sh.lineTo(x, -z)));
    // round the box from the last foot point back to the first, the long way (outside the canyon)
    const last = foot[foot.length - 1], first = foot[0], corners: P2[] = [[x1, z1], [x0, z1], [x0, z0], [x1, z0]];
    const ang = (p: P2) => Math.atan2(p[1] - (z0 + z1) / 2, p[0] - (x0 + x1) / 2);
    const a0 = ang(last), a1 = ang(first), sweep = (a: number) => ((a - a0 + Math.PI * 4) % (Math.PI * 2));
    corners.filter((c) => sweep(ang(c)) < sweep(a1)).sort((p, q) => sweep(ang(p)) - sweep(ang(q))).forEach(([x, z]) => sh.lineTo(x, -z));
    sh.closePath();
    const mass = new THREE.ExtrudeGeometry(sh, { depth: CUT, bevelEnabled: false }); mass.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(mass, mat(C.cutTop)));
    // the cut's top broken by lumps and moss near the rim
    for (let i = 0; i < F.length; i++) { const q = F[i], ox = -q.t[1], oz = q.t[0], back = 3 + hash(i, 5) * 26; g.add(place(lump(2 + hash(i, 6) * 5, i % 3 ? C.cutLump : C.rock, i, 1.4, 0.5, 1.2, 0), q.p[0] + ox * back, CUT, q.p[1] + oz * back, hash(i, 7) * 3)); }
    // the section's top: broken rock, scree and moss further out, so it reads as mountain and not as a floor
    for (let i = 0; i < (d.lumps ?? 260); i++) {
      const q = F[Math.floor(hash(i, 41) * F.length)], ox = -q.t[1], oz = q.t[0], back = 25 + Math.pow(hash(i, 42), 0.7) * 260, r = 3 + hash(i, 43) * 9;
      const x = q.p[0] + ox * back + (hash(i, 44) - 0.5) * 30, z = q.p[1] + oz * back + (hash(i, 45) - 0.5) * 30;
      if (x < x0 + r || x > x1 - r || z < z0 + r || z > z1 - r) continue;
      g.add(place(lump(r, [C.cutLump, C.cut, C.cutLump][i % 3], i + 300, 1.3, 0.35 + hash(i, 46) * 0.5, 1.1, 0), x, CUT - 0.4, z, hash(i, 47) * 3));
    }
  }
  // the faces: rows of points up the wall, ribs running up it, leaning in toward the top
  const y0 = CUT > 0 ? CUT - 0.5 : -BELOW;
  const YS = [y0, ...[-300, -200, -120, -60, -20, 20, 45, 80, 125, 180, 250, 340, 450, 580, 740].filter((y) => y > y0 + 4 && y < H - 4), H];
  const seam = (y: number) => (d.seam ? Math.min(1, Math.abs(y) / 40) : 1);
  const off = (i: number, y: number) => OVER * Math.pow(Math.max(0, y) / H, 1.6) + seam(y) * (2.2 + Math.min(Math.abs(y), 200) * 0.02) * (0.7 * noise1(i / 2.2, 11) + 0.3 * noise1(i / 0.9 + y / 31, 13));
  const at = (i: number, y: number) => { const q = D[i], ix = q.t[1], iz = -q.t[0], f = off(i, y); return new THREE.Vector3(q.p[0] + ix * f, y, q.p[1] + iz * f); };
  // dark and wet low down, paling into the cloud above (and into the cloud below, seen from a ledge)
  const colAt = (y: number) => (y < -200 ? C.wall6 : y < -120 ? C.wall5 : y < -60 ? C.wall4 : y < -20 ? C.wall2 : y < 70 ? C.wall0 : y < 140 ? C.wall1 : y < 230 ? C.wall2 : y < 330 ? C.wall3 : y < 460 ? C.wall4 : y < 620 ? C.wall5 : C.wall6);
  const WET: Record<string, string> = { [C.wall0]: C.wet0, [C.wall1]: C.wet1, [C.wall2]: C.wet2, [C.wall3]: C.wet3, [C.wall4]: C.wet4, [C.wall5]: C.wet5, [C.wall6]: C.wet6 };
  const wetRun = (i: number) => noise1(i / 1.6, 23) > 0.2 || hash(i, 29) > 0.86;
  for (let j = 0; j + 1 < YS.length; j++) {
    const rows = [YS[j], YS[j + 1]].map((y) => D.map((_, i) => at(i, y))), col = colAt((YS[j] + YS[j + 1]) / 2);
    g.add(new THREE.Mesh(stripCols(rows, (i) => !wetRun(i), true), mat(col)), new THREE.Mesh(stripCols(rows, wetRun, true), mat(WET[col])));
  }
  // ferns hanging from the lower cracks, in the wet runs
  for (let s = 0; s < Math.round(n / 4); s++) {
    const i = Math.floor(hash(s, 31) * (n - 1)), y = Math.max(y0 + 3, 6) + hash(s, 32) * 70, q = D[i], ix = q.t[1], iz = -q.t[0];
    if (y > H - 2 || !wetRun(i)) continue;
    const c = at(i, y), f = grp(place(lump(0.9, C.fernDeep, s, 1.4, 0.7, 1.2, 0), 0, 0, 0));
    for (let k = 0; k < 4; k++) { const fr = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6 + hash(k, s) * 1.4, 4), mat(k % 2 ? C.fern : C.fernDeep)); fr.position.set((k - 1.5) * 0.6, -1.1, 0.3); fr.rotation.set(Math.PI + (hash(k, s + 1) - 0.5) * 0.6, 0, (k - 1.5) * 0.25); f.add(fr); }
    f.position.set(c.x + ix * 0.9, y, c.z + iz * 0.9); f.rotation.y = Math.atan2(ix, iz); g.add(f);
  }
  return g;
}

/** The undercut behind the falls' north edge: a cave mouth facing local +z, `w` ft wide and `h` high, running `depth`
 *  ft back (local -z); drawn open (no roof) so its floor reads from above, a dripping lintel over the mouth; dry at the
 *  back, with a dead fire ring, mud-caked hides and a chipped stone axe head. */
export function sprayCave(d: Dims): THREE.Group {
  const W = d.w ?? 16, H = d.h ?? 12, DP = d.depth ?? 40, g = grp();
  const floor: P2[] = [[-W / 2, 0], [-W / 2 - 4, -DP * 0.4], [-W / 2 - 2, -DP * 0.8], [-3, -DP], [W / 2, -DP * 0.85], [W / 2 + 3, -DP * 0.45], [W / 2, 0]];
  g.add(flat(floor, 0.08, C.siltDark), flat(floor.map(([x, z]) => [x * 0.7, z * 0.7 - DP * 0.25] as P2), 0.1, C.ash));
  // the walls of the cave, low lumps of rock (its roof is cut away)
  for (let i = 0; i < floor.length - 1; i++) {
    const [ax, az] = floor[i], [bx, bz] = floor[i + 1], L = Math.hypot(bx - ax, bz - az), k = Math.max(2, Math.round(L / 4));
    for (let j = 0; j < k; j++) { const f = (j + 0.5) / k; g.add(place(lump(2.6, j % 2 ? C.wet : C.rock, i * 9 + j, 1.1, H / 4.5, 1.1, 0), lerp(ax, bx, f) * 1.08, H / 2.4, lerp(az, bz, f) * 1.03)); }
  }
  // the lintel over the mouth, dripping
  g.add(place(lump(1, C.wet, 7, W / 2 + 3, 2.4, 3.5, 1), 0, H + 1.2, -1));
  for (let i = 0; i < 9; i++) g.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4 + hash(i, 3) * 1.6, 4), mat(C.wetSheen)), -W / 2 + (i + 0.5) * (W / 9), H - 1, 0.8, 0, Math.PI));
  // the fire ring, dead
  const fx = -1.5, fz = -DP * 0.62;
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(place(lump(0.45, C.rockMid, i + 30, 1.2, 0.8, 1, 0), fx + Math.cos(a) * 1.7, 0.35, fz + Math.sin(a) * 1.7)); }
  g.add(cyl(1.3, 1.3, 0.08, C.ash, fx, 0.14, fz, 9), box(2.2, 0.3, 0.3, C.char, fx, 0.3, fz, 0.6), box(1.8, 0.3, 0.3, C.char, fx, 0.32, fz, -0.7));
  // hides caked in grey mud, and the axe head
  for (let i = 0; i < 3; i++) { const hx = 2.5 + i * 1.6, hz = -DP * (0.5 + i * 0.13), hide = flat(blobPts(2.1, i + 40, 1.4, 8, 0.4), 0.16 + i * 0.03, i % 2 ? C.hide : C.hideDark); hide.position.set(hx, 0, hz); hide.rotation.y = hash(i, 41) * 3; g.add(hide); g.add(place(flat(blobPts(0.9, i + 50, 1.3, 7, 0.5), 0.24 + i * 0.03, C.mud), hx + 0.4, 0, hz - 0.3)); }
  const axe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 4), mat(C.axe)); axe.scale.set(1, 1, 0.35); place(axe, -5, 0.3, -DP * 0.75, 0.7, 0, Math.PI / 2); g.add(axe);
  return g;
}

/** A pine stake driven into shingle, a coil of wet rope and a four-pronged iron hook hung on it; the rope's free end
 *  trails `trail` ft along local +x (across the jam). */
export function scavengerStake(d: Dims): THREE.Group {
  const T = d.trail ?? 22, g = grp();
  const stake = cyl(0.18, 0.28, 5.2, C.bark, 0, 2.3, 0, 6); stake.rotation.z = 0.12; g.add(stake, cone(0.28, 0.8, C.bark, 0.05, -0.15, 0, 6).rotateX(Math.PI));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(place(lump(0.4 + hash(i, 1) * 0.3, C.shingle2, i, 1.2, 0.6, 1, 0), Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9)); }
  for (let k = 0; k < 4; k++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(0.75 - k * 0.04, 0.11, 4, 12), mat(C.ropeWet)); coil.position.set(0.25 + 0.1 * k, 2.4 - k * 0.12, 0.25); coil.rotation.set(0.2, 0.4, 0.1); g.add(coil); }
  // the hook: a shank, a ring and four curved prongs
  const hook = grp(cyl(0.07, 0.07, 1.6, C.iron, 0, 0.8, 0, 5), place(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 4, 8), mat(C.rust)), 0, 1.7, 0));
  for (let k = 0; k < 4; k++) { const pr = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 4, 8, Math.PI * 0.75), mat(k % 2 ? C.iron : C.rust)); pr.rotation.set(0, (k / 4) * Math.PI * 2, Math.PI * 0.95); pr.position.set(Math.cos((k / 4) * Math.PI * 2) * 0.42, 0.1, -Math.sin((k / 4) * Math.PI * 2) * 0.42); hook.add(pr); }
  place(hook, 0.7, 0.1, -0.9, 0, 0, 1.25); g.add(hook);
  // the free end, lying out across the drift
  let px = 0.5, py = 0.2;
  for (let i = 0; i < Math.round(T / 2); i++) { const nx = px + 2, ny = 0.2 + Math.abs(Math.sin(i * 1.3)) * (i > 3 ? 1.4 : 0.3), seg = box(2.1, 0.16, 0.16, C.ropeWet, (px + nx) / 2, (py + ny) / 2, Math.sin(i * 0.6) * 0.6); seg.rotation.z = Math.atan2(ny - py, 2); g.add(seg); px = nx; py = ny; }
  return g;
}

/** Bleached dead pines wedged across the river (local z across, the jam `w` ft wide), roots in the air, polished
 *  bone-smooth, foam piled on the upstream side (what it has caught is 'h-jam-scraps'). */
export function snagJam(d: Dims): THREE.Group {
  const W = d.w ?? 50, g = grp();
  for (let i = 0; i < 10; i++) {
    const L = 22 + hash(i, 1) * 22, r = 0.8 + hash(i, 2) * 0.7, a = (hash(i, 3) - 0.5) * 1.3 + (i % 2 ? 0.2 : -0.2), y = 0.8 + (i % 4) * 0.9, z = (hash(i, 4) - 0.5) * W * 0.6, x = (hash(i, 5) - 0.5) * 12;
    const trunk = grp(cyl(r * 0.55, r, L, i % 3 ? C.bleached : C.bleachedDeep, 0, 0, 0, 7));
    trunk.children[0].rotation.x = Math.PI / 2;
    if (hash(i, 6) > 0.4) { const rootPlate = grp(); for (let k = 0; k < 7; k++) { const rt = box(0.35, 0.35, 3.5 + hash(k, i) * 2.5, C.bleachedPale, 0, 0, 0); rt.rotation.set((k / 7) * Math.PI * 2, 0, 0); rt.translateZ(1.6); rootPlate.add(rt); } rootPlate.position.z = -L / 2; rootPlate.rotation.y = Math.PI / 2; trunk.add(rootPlate); }
    for (let k = 0; k < 3; k++) { const st = box(0.25, 0.25, 2, C.bleachedPale, 0, r * 0.6, (hash(k, i + 9) - 0.5) * L * 0.8); st.rotation.x = 0.8; trunk.add(st); }
    place(trunk, x, y, z, a, (hash(i, 7) - 0.5) * 0.25, (hash(i, 8) - 0.5) * 0.3); g.add(trunk);
  }
  for (let i = 0; i < 12; i++) g.add(place(lump(1.2 + hash(i, 11) * 1.8, C.foam, i, 1.5, 0.3, 1.1, 1), -6 - hash(i, 12) * 4, 0.4, (hash(i, 13) - 0.5) * W * 0.9));
  return g;
}
/** What the jam has caught, found by a search: a satchel strap and buckle, a rotted boot, a thigh bone. */
export function jamScraps(): THREE.Group {
  const g = grp(box(0.12, 0.08, 4.5, C.leather, 0, 2.2, -1.6, 0.5), place(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 4, 6), mat(C.brass)), 0.4, 2.25, 0.4, 0.5, Math.PI / 2));
  g.add(box(0.7, 1.1, 0.5, C.boot, -2.4, 1.6, 2.2, 0.3), box(1.1, 0.4, 0.5, C.boot, -2, 1.1, 2.2, 0.3));
  g.add(cyl(0.16, 0.16, 1.6, C.bone, 1.6, 1.3, 1.2, 6).rotateZ(1.2), place(lump(0.3, C.bone, 4, 1, 0.8, 0.9, 0), 2.3, 1.6, 1.2));
  return g;
}
/** A rusted iron wolf trap half buried in pine needles: open jaws, a chain to a stake. */
export function wolfTrap(): THREE.Group {
  const g = grp(cyl(0.9, 0.9, 0.12, C.rust, 0, 0.08, 0, 10));
  for (const s of [-1, 1]) { const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 3, 10, Math.PI), mat(C.iron)); jaw.rotation.set(-Math.PI / 2 + s * 0.35, 0, s > 0 ? 0 : Math.PI); jaw.position.y = 0.2; g.add(jaw); }
  for (let i = 0; i < 6; i++) g.add(box(0.22, 0.12, 0.12, C.rust, 1.1 + i * 0.28, 0.06, 0.1 * (i % 2)));
  g.add(cyl(0.08, 0.1, 0.8, C.iron, 2.9, 0.3, 0.1, 5));
  for (let i = 0; i < 18; i++) g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.08), mat(C.needle)), (hash(i, 1) - 0.5) * 2.6, 0.14 + hash(i, 4) * 0.08, (hash(i, 2) - 0.5) * 2.6, hash(i, 3) * 3));
  return g;
}

/** A bar of rounded grey shingle across a river's outlet (`rx` × `rz` ft half-sizes), with a bank of fine grey silt
 *  behind it (offset `sx`,`sz`, `sr` ft round) that holds bare footprints and the drag of something heavy, all heading
 *  toward local -z. */
export function gravelBar(d: Dims): THREE.Group {
  const RX = d.rx ?? 22, RZ = d.rz ?? 32, SX = d.sx ?? -30, SZ = d.sz ?? 30, SR = d.sr ?? 18, g = grp();
  g.add(flat(blobPts(1, 3, 1, 14, 0.25).map(([x, z]) => [x * RX, z * RZ] as P2), 0.2, C.shingle3));
  g.add(place(new THREE.Mesh(lumpGeo(1, 5, RX * 0.85, 0.9, RZ * 0.85, 1), mat(C.shingle)), 0, -0.2, 0));
  for (let i = 0; i < 150; i++) { const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 0.95, x = Math.cos(a) * r * RX, z = Math.sin(a) * r * RZ, s = 0.3 + hash(i, 3) * 0.7, top = 0.75 * (1 - r * r) + 0.1; g.add(place(new THREE.Mesh(lumpGeo(s, i, 1.3, 0.55, 1, 0), mat([C.shingle, C.shingle2, C.shingle3][i % 3])), x, top + s * 0.15, z, hash(i, 4) * 3)); }
  const silt = blobPts(SR, 9, 1.5, 12, 0.35).map(([x, z]) => [x + SX, z + SZ] as P2);
  g.add(flat(silt, 0.14, C.silt));
  // bare footprints in pairs and the drag, from the bank across toward the wall
  for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) {
    const t = i / 7, x = SX + 6 - t * 4 + k * 4.5, z = SZ + SR * 0.55 - t * SR * 1.1 + k * 1.3, s = i % 2 ? 1 : -1;
    const fp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 7), mat(C.siltDark)); fp.geometry.rotateX(-Math.PI / 2); fp.scale.set(0.55, 1, 1.2); place(fp, x + s * 0.45, 0.16, z, 0.3); g.add(fp);
  }
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, SR * 1.2), mat(C.siltDark)), SX + 2, 0.165, SZ - 2, 0.25));
  return g;
}

/** The bridge seen from the canyon floor, a thousand feet up: a thin dark arch against the cloud (`len` ft long along
 *  local x), drawn facing down so it shows only from below; `spark` 1 adds a traveller's torch on it. */
export function skyBridge(d: Dims): THREE.Group {
  const L = d.len ?? 90, W = d.w ?? 15, g = grp(), n = 16, m = mat(C.sky);
  const rows: THREE.Vector3[][] = [];
  for (const z of [-W / 2, W / 2]) { const row: THREE.Vector3[] = []; for (let i = 0; i <= n; i++) { const t = i / n, x = (t - 0.5) * L, y = -6 - 30 * (1 - Math.cos((t - 0.5) * Math.PI)) * (Math.abs(t - 0.5) > 0.38 ? 1.3 : 1); row.push(new THREE.Vector3(x, y, z)); } rows.push(row); }
  g.add(new THREE.Mesh(strip(rows), m));
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(L + 10, W), m); deck.rotation.x = Math.PI / 2; deck.position.y = -1; g.add(deck);
  if (d.spark) g.add(place(new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({ color: C.spark })), L * 0.18, 1.5, W / 2 + 1));
  return g;
}

/** A floor of cloud filling a gulf (`w` × `d` ft), billows heaped on it; seen from a ledge above, it hides the depths. */
export function cloudFloor(d: Dims): THREE.Group {
  const W = d.w ?? 400, D = d.d ?? 300, g = grp();
  g.add(flat([[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]], 0, C.mist1));
  const n = Math.round((W * D) / 2600);
  for (let i = 0; i < n; i++) { const r = 14 + hash(i, 1) * 26; g.add(place(new THREE.Mesh(lumpGeo(r, i, 1.4, 0.35, 1.1, 1), mat(i % 3 ? C.mist0 : C.mist2)), (hash(i, 2) - 0.5) * W, r * 0.08, (hash(i, 3) - 0.5) * D, hash(i, 4) * 3)); }
  for (let i = 0; i < 5; i++) g.add(fogFlat(blobPts(W * 0.18, i + 30, 1.6, 12, 0.5).map(([x, z]) => [x + (hash(i, 5) - 0.5) * W * 0.6, z + (hash(i, 6) - 0.5) * D * 0.6] as P2), 14 + i * 6, C.mist0, 0.18));
  return g;
}

/** A stand of pines on the valley floor beyond the map (`w` × `d` ft about the origin, `n` trees), merged into one
 *  mesh per colour so a whole forest draws in three calls; fog lies in it. */
export function pineStand(d: Dims): THREE.Group {
  const W = d.w ?? 400, D = d.d ?? 300, N = d.n ?? 60, g = grp(), bark: THREE.BufferGeometry[] = [], a: THREE.BufferGeometry[] = [], b: THREE.BufferGeometry[] = [];
  for (let i = 0; i < N; i++) {
    const x = (hash(i, 1) - 0.5) * W, z = (hash(i, 2) - 0.5) * D, s = 1.1 + hash(i, 3) * 0.6, h = 26 * s;
    bark.push(new THREE.CylinderGeometry(0.45 * s, 0.8 * s, h * 0.34, 5).translate(x, h * 0.17, z));
    for (let k = 0; k < 3; k++) { const tr = 6 * s * (1 - k * 0.26), th = h * (0.36 - k * 0.03); (k % 2 ? b : a).push(pineTier(tr, th, 6, k + i).translate(x, h * 0.26 + k * h * 0.22 + th / 2, z)); }
  }
  g.add(new THREE.Mesh(merge(bark), mat(C.bark)), new THREE.Mesh(merge(a), mat(C.pine)), new THREE.Mesh(merge(b), mat(C.pineDeep)));
  for (let i = 0; i < 4; i++) g.add(fogFlat(blobPts(Math.min(W, D) * 0.4, i + 70, 1.5, 12, 0.5).map(([x, z]) => [x + (hash(i, 9) - 0.5) * W * 0.5, z + (hash(i, 10) - 0.5) * D * 0.5] as P2), 10 + i * 7, C.mist0, 0.2));
  return g;
}

// ---------------------------------------------------------------- hidden things
/** A leather-wrapped bundle of plain clothes stuffed in a crack, tied with cord. */
export function bundle(): THREE.Group {
  const g = grp(place(lump(1, C.leather, 3, 1.3, 0.6, 0.8, 1), 0, 0.55, 0), place(lump(0.6, C.cloth, 5, 1.2, 0.6, 1, 1), 0.8, 0.75, 0.2));
  for (const x of [-0.4, 0.4]) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 4, 10), mat(C.clothTie)), x, 0.55, 0, Math.PI / 2));
  return g;
}
/** A small glint of metal in the droppings: a trinket a raven brought up. */
export function trinket(): THREE.Group {
  return grp(place(new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat(C.brass, { emissive: '#2a2010' })), 0, 0.2, 0), place(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 3, 10), mat(C.brass)), 0.5, 0.06, 0.2, 0, Math.PI / 2));
}

// ---------------------------------------------------------------- figures
/** A swarm of bats: a loose knot of small dark wings boiling at head height. */
export function batSwarm(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39, r = (0.5 + hash(i, 1) * 2) * s, y = (2.5 + hash(i, 2) * 4) * s, bat = grp(place(lump(0.22 * s, C.bat, i, 1.4, 0.8, 0.8, 0), 0, 0, 0));
    for (const z of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 0.9 * s, 3), mat(C.batWing)); w.scale.set(1, 1, 0.12); w.rotation.set(z * (Math.PI / 2 - 0.3 - hash(i, z + 3) * 0.6), 0, 0); w.position.z = z * 0.45 * s; bat.add(w); }
    bat.position.set(Math.cos(a) * r, y, Math.sin(a) * r); bat.rotation.y = -a + hash(i, 5); g.add(bat);
  }
  return g;
}
/** A skeletal rider on a skeletal warhorse (facing +x), a rusted lantern held up that sheds no light. */
export function skeletalRider(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp(horse({ bone: 1, scale: s }));
  const rider = skeletonStanding(); rider.scale.setScalar(s); rider.position.set(-0.3 * s, 2.55 * s, 0); g.add(rider);
  const pole = box(0.12, 3.6, 0.12, C.lantern, 0.9 * s, 7.4 * s, 0.75 * s); pole.rotation.z = -0.25; g.add(pole);
  g.add(box(0.7, 0.9, 0.7, C.rust, 1.45 * s, 9.1 * s, 0.75 * s), box(0.55, 0.65, 0.75, C.lanternGlass, 1.45 * s, 9.1 * s, 0.75 * s), cone(0.5, 0.4, C.rust, 1.45 * s, 9.75 * s, 0.75 * s, 4));
  return g;
}

const H_PROPS: Record<string, (d: Dims) => THREE.Object3D> = {
  'h-chasm': chasm, 'h-falls-sill': fallsSill, 'h-spray-cloud': sprayCloud, 'h-tarn': tarn, 'h-bridge': hBridge, 'h-rockfall-scar': rockfallScar,
  'h-lightning-star': lightningStar, 'h-precipice-stance': precipice, 'h-shelf-road': shelfRoad, 'h-anvil-block': anvilBlock, 'h-raven-litter': ravenLitter,
  'h-bent-pine': bentPine, 'h-climb-rope': climbRope, 'h-slab': slab, 'h-scree-gully': screeGully, 'h-falls-column': fallsColumn, 'h-plunge-pool': plungePool,
  'h-cauldron-wall': cauldronWall, 'h-spray-cave': sprayCave, 'h-scavenger-stake': scavengerStake, 'h-snag-jam': snagJam, 'h-gravel-bar': gravelBar,
  'h-sky-bridge': skyBridge, 'h-cloud-floor': cloudFloor, 'h-pine-stand': pineStand, 'h-bundle': bundle, 'h-trinket': trinket, 'h-jam-scraps': jamScraps, 'h-wolf-trap': wolfTrap,
};
// each piece collapsed to one mesh per material (hidden pieces are not merged by the level, so this keeps them cheap)
Object.assign(PROPS_V1, Object.fromEntries(Object.entries(H_PROPS).map(([k, f]) => [k, (d: Dims) => compact(f(d))])));
Object.assign(CREATURES, { 'h-bat-swarm': (d) => batSwarm(d), 'h-skeletal-rider': (d) => skeletalRider(d) } as Record<string, (d: Dims) => THREE.Group>);
