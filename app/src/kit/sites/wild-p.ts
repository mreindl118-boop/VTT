// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'p-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// P, the Luna River Crossroads: an X of roads on a wooded shoulder with a snapped four-armed signpost, the wolf-skull
// pine, a smashed wine cask in the ditch, a sunken cart-track between root-bound banks, a corduroy causeway over a bog,
// a granite knoll crown, the wet hay terrace (rick, skinned wolf, reed hollows), and the low two-arched stone bridge
// over the Luna in its trench. The trench lies below the map's ground: p-river-trench draws its banks and water and
// cuts the land drawn round the map out of the column above it (see landClip).
// Shape-driven pieces take a polyline in their dims as `n`, `x0`,`z0`, ... in feet relative to the piece's position.
import * as THREE from 'three';
import { PROPS_V1, pine } from '../props';
import { CREATURES, humanoid, horse } from '../creatures';
import { mat, matClone, patchFog, setSurface } from '../../render/materials';
import { FLOOR_COLOR } from '../palette';
import { surfaceFor } from '../surfaces';
import { merge } from '../pieces';

type Dims = Record<string, number>;
type P2 = [number, number];

// ---------------------------------------------------------------- colours and what they are made of
// a tight palette: the static pieces merge into one mesh per colour, so near-twins share one value
const DE = '#332d26', ME = '#4b4234', WAT = '#141c21', GRN = '#55603a', MOS = '#3a4932', DRY = '#7c7748', HAY = '#8a8162', HAYD = '#625c49';
const ST1 = '#67645c', ST2 = '#57534d', WD = '#594a39', WDD = '#45392c', PALEW = '#a08c6a', LEAF = '#6b5536', LEAFD = '#4f3f2a', RED = '#5e2a26';
const C = {
  ashlar: '#7f7b72', ashlarDeep: '#67645c', ashlarPale: '#8c887e', ashlarWet: '#565650', soffit: '#4c4a46',
  deck: '#6c685f', groove: DE, grooveWet: DE, gravel: '#77736a', gravelDark: ST1, gravelPale: '#8d887c', kerb: ST1, kerbDark: ST2,
  water: WAT, sheen: '#34434c', foam: '#a9b2b4', ditch: DE, ditchWater: WAT,
  bankEarth: ME, bankDark: DE, bankMud: DE, sedge: GRN, sedgeDry: DRY, silt: '#5a5446',
  granite: '#77756d', graniteDeep: '#615f58', granitePale: '#88857b', lichen: '#7c8360', lichenOchre: '#8f7c52', lichenPale: '#8d887c', crack: DE,
  duff: ME, duffDark: DE, needle: LEAF,
  root: WDD, rootPale: WD, moss: MOS, mossDark: MOS, turf: '#56603e',
  oak: WD, oakDark: WDD, splinter: PALEW, paint: '#c9c1ad', paintGrey: '#8d887c', fieldStone: ST1, fieldStoneDark: ST2,
  hay: HAY, hayDark: HAYD, hayStreak: HAYD, thatch: HAYD, fork: WD, iron: '#2e2f33', rust: '#5a3a2a',
  skull: '#d8cfb8', skullShade: '#b1a891', socket: DE, hide: '#6a645b', hideDark: '#4f4a43', notch: PALEW, bark: WDD, deadBough: '#8d877b',
  cask: WD, caskDark: WDD, wine: '#4d1119', wineDry: RED, board: WD, earthRaw: ME,
  flesh: '#7a3b33', fleshDark: RED, fascia: '#b1a891', fur: '#6a645b', furDark: '#4f4a43', bolt: WD, fletch: DE, mud: ME, print: DE, blood: RED,
  raven: '#141218', ravenSheen: '#25232d', beak: DE,
  log: WD, logEnd: PALEW, logMoss: MOS, bog: DE, bogWater: WAT,
  reed: GRN, reedDry: DRY, cattail: LEAFD, pool: WAT, poolRim: DE,
  nettle: MOS, nettleDark: MOS, dock: GRN, dockRust: LEAF, thistle: DRY, thistleHead: LEAFD, strawFlat: DRY, weedTint: '#46523c',
  willow: DRY, willowRot: HAYD, line: '#c9c1ad',
  post: WD, boardPaint: '#8d887c', boardBare: WDD, slogan: RED,
  alder: '#8d877b', alderDark: '#6e675c', leaves: LEAF, leavesDark: LEAFD, pebble: ST1, pebbleDark: ST2,
  tussock: DRY, tussockPale: HAY, tussockGreen: GRN,
  eye: '#d8e07a', bat: '#141218', batWing: '#25232d', rag: '#2a2622', ragPale: '#3a332c', glassDark: '#16151a', lantern: '#2e2f33',
  scarf: '#7a3a3a', sash: '#7a3a3a', pipe: DE, skin: '#b08a6a', vCloth0: '#6b4a5a', vCloth1: '#4f5a4a', vCloth2: '#6e5a3e', stitch: DE,
  mist0: '#dcdee2',
} as const;
surfaceFor([C.ashlar, C.ashlarDeep, C.ashlarPale, C.ashlarWet], 'ashlar');
surfaceFor([C.soffit, C.kerb, C.kerbDark, C.fieldStone, C.fieldStoneDark], 'stone');
surfaceFor([C.deck], 'flag');
surfaceFor([C.gravel, C.gravelDark, C.gravelPale, C.pebble, C.pebbleDark], 'rubble');
surfaceFor([C.granite, C.graniteDeep, C.granitePale, C.crack], 'rock');
surfaceFor([C.water, C.sheen, C.foam, C.ditchWater, C.pool, C.bogWater, C.eye, C.mist0, C.glassDark], 'none');
surfaceFor([C.groove, C.grooveWet, C.ditch, C.bankEarth, C.bankDark, C.bankMud, C.silt, C.duff, C.duffDark, C.needle, C.mud, C.print, C.bog, C.poolRim, C.earthRaw, C.blood, C.wineDry, C.wine], 'dirt');
surfaceFor([C.sedge, C.sedgeDry, C.lichen, C.lichenOchre, C.lichenPale, C.moss, C.mossDark, C.reed, C.nettle, C.nettleDark, C.dock, C.dockRust, C.thistle, C.thistleHead, C.leaves, C.leavesDark, C.logMoss, C.tussockGreen], 'foliage');
surfaceFor([C.turf, C.weedTint], 'grass');
surfaceFor([C.hay, C.hayDark, C.hayStreak, C.thatch, C.reedDry, C.strawFlat, C.tussock, C.tussockPale, C.willow, C.willowRot], 'thatch');
surfaceFor([C.oak, C.oakDark, C.splinter, C.fork, C.cask, C.caskDark, C.board, C.bolt, C.post, C.boardBare, C.logEnd, C.notch], 'wood');
surfaceFor([C.root, C.rootPale, C.bark, C.deadBough, C.log, C.alder, C.alderDark, C.cattail], 'bark');
surfaceFor([C.iron, C.rust, C.lantern], 'metal');
surfaceFor([C.rag, C.ragPale, C.scarf, C.sash, C.line, C.hide, C.hideDark, C.fur, C.furDark], 'cloth');
surfaceFor([C.paint, C.paintGrey, C.boardPaint, C.slogan, C.skull, C.skullShade, C.socket, C.flesh, C.fleshDark, C.fascia, C.fletch, C.raven, C.ravenSheen, C.beak, C.bat, C.batWing, C.pipe, C.skin,
  C.vCloth0, C.vCloth1, C.vCloth2, C.stitch, C.cattail], 'generic');
// the shared values last, so each keeps the grain of what most of its pieces are made of
surfaceFor([DE, ME, C.silt], 'dirt'); surfaceFor([GRN, MOS, LEAF, LEAFD], 'foliage'); surfaceFor([DRY, HAY, HAYD], 'thatch'); surfaceFor([ST1, ST2], 'stone');
surfaceFor([WD, WDD, PALEW], 'wood'); surfaceFor([WAT], 'none'); surfaceFor([C.alder, C.alderDark], 'bark'); surfaceFor([RED], 'generic');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 7) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 5) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c)), x, y, z);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** A faceted lump (a rock, a sack, a heap): an icosahedron pushed in and out, then squashed. */
function lump(r: number, color: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color));
}
/** A rod from a to b (a root, a branch, a stave): a thin cylinder turned onto the segment. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, c: string, seg = 5): THREE.Mesh {
  const L = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, seg), mat(c));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** A polyline from dims: `n` points `x{i}`,`z{i}` (with a prefix). */
function dimsLine(d: Dims, p = ''): P2[] {
  const n = d[p + 'n'] ?? 0, pts: P2[] = [];
  for (let i = 0; i < n; i++) pts.push([d[`${p}x${i}`] ?? 0, d[`${p}z${i}`] ?? 0]);
  return pts;
}
/** Points every `step` ft along a polyline with the unit tangent, the distance along and the left normal (-tz, tx). */
type Station = { p: P2; t: P2; n: P2; s: number };
function densify(pts: P2[], step: number): Station[] {
  const out: Station[] = []; let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(1, Math.round(L / step)), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (let s = 0; s < k; s++) { const f = s / k; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], t, n: [-t[1], t[0]], s: acc + f * L }); }
    acc += L;
  }
  if (pts.length > 1) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    out.push({ p: [...b] as P2, t, n: [-t[1], t[0]], s: acc });
  }
  for (let i = 1; i + 1 < out.length; i++) { const p = out[i - 1].t, q = out[i + 1].t, tx = p[0] + q[0], tz = p[1] + q[1], L2 = Math.hypot(tx, tz) || 1; out[i].t = [tx / L2, tz / L2]; out[i].n = [-tz / L2, tx / L2]; }
  return out;
}
/** Triangles from a flat list of points, every face turned to look up. */
function upTris(v: THREE.Vector3[]): THREE.BufferGeometry {
  const P: number[] = [];
  for (let i = 0; i + 2 < v.length; i += 3) {
    let [a, b, c] = [v[i], v[i + 1], v[i + 2]];
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (ny < 0) [b, c] = [c, b];
    P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
/** Triangles as given (both windings drawn by the caller's choice of material); normals computed. */
function tris(v: THREE.Vector3[]): THREE.BufferGeometry {
  const P: number[] = []; for (const p of v) P.push(p.x, p.y, p.z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
/** A flat ribbon along stations between offsets o0 and o1 (along the left normal) at height y(i). */
function band(D: Station[], o0: (i: number) => number, o1: (i: number) => number, y: (i: number) => number): THREE.BufferGeometry {
  const v: THREE.Vector3[] = [];
  const at = (i: number, o: number) => V(D[i].p[0] + D[i].n[0] * o, y(i), D[i].p[1] + D[i].n[1] * o);
  for (let i = 0; i + 1 < D.length; i++) { const a0 = at(i, o0(i)), a1 = at(i, o1(i)), b0 = at(i + 1, o0(i + 1)), b1 = at(i + 1, o1(i + 1)); v.push(a0, a1, b1, a0, b1, b0); }
  return upTris(v);
}
/** A flat polygon in the xz plane at height y, facing up. */
function flat(pts: P2[], y: number, color: string | THREE.Material): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
}
/** A ragged blob outline in the xz plane. */
function blobPts(r: number, seed: number, sx = 1, n = 11): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (0.72 + 0.4 * hash(i, seed)); pts.push([Math.cos(a) * k * sx, Math.sin(a) * k]); }
  return pts;
}
function inPoly(x: number, z: number, pts: P2[]): boolean {
  let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c;
}
function segDist(px: number, pz: number, a: P2, b: P2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
const lineDist = (x: number, z: number, L: P2[]) => { let m = Infinity; for (let i = 0; i + 1 < L.length; i++) m = Math.min(m, segDist(x, z, L[i], L[i + 1])); return m; };
/** Collapse a piece to one mesh per material (hidden pieces and figures are not merged by the level). */
function compact(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>(), out = new THREE.Group();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
  });
  for (const [mt, gs] of by) out.add(new THREE.Mesh(merge(gs), mt));
  return out;
}
/** See-through fog and water sheen: lit, no depth writes; cached per colour and opacity. */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** Split a geometry with material groups (an extrusion's faces and sides) into one geometry per group. */
function splitGroups(geo: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position, nor = g.attributes.normal, out: THREE.BufferGeometry[] = [];
  const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
  const PS: number[][] = [], NS: number[][] = [];
  for (const gr of groups) {
    const idx = gr.materialIndex ?? 0, P = (PS[idx] ??= []), N = (NS[idx] ??= []);
    for (let i = gr.start; i < Math.min(pos.count, gr.start + gr.count); i++) { P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); N.push(nor.getX(i), nor.getY(i), nor.getZ(i)); }
  }
  for (let k = 0; k < PS.length; k++) { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(PS[k] ?? [], 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(NS[k] ?? [], 3)); out.push(b); }
  return out;
}
/** A tuft of grass, sedge or reed blades: thin cones leaning out from a point. */
function tuft(g: THREE.Group, x: number, y: number, z: number, h: number, colors: string[], seed: number, n = 5, spread = 0.35, r = 0.1) {
  for (let i = 0; i < n; i++) {
    const b = cone(r, h * (0.7 + hash(i, seed) * 0.5), colors[i % colors.length], x + (hash(i, seed + 1) - 0.5) * spread, 0, z + (hash(i, seed + 2) - 0.5) * spread, 4);
    b.position.y = y + (b.geometry as THREE.ConeGeometry).parameters.height / 2;
    b.rotation.set((hash(i, seed + 3) - 0.5) * 0.5, 0, (hash(i, seed + 4) - 0.5) * 0.5); g.add(b);
  }
}

// ---------------------------------------------------------------- the land: the knoll and its granite crown
/** The knoll's earth mound (ft) at map feet; the same numbers as knollH() in scripts/authoring/wild_p.py. */
export function knollH(x: number, z: number): number {
  const dx = x - 120, dz = z - 330, rx = dx > 0 ? 62 : 118, rz = dz < 0 ? 96 : 90, q = (dx / rx) ** 2 + (dz / rz) ** 2;
  return q >= 1 ? 0 : 7.5 * Math.pow(1 - q, 1.4);
}
/** The knoll: a low mound of needle duff under the old pines, its rim sunk just under the turf (origin at its crown). */
export function knoll(): THREE.Group {
  const g = grp(), step = 5, vs: THREE.Vector3[][] = [[], []];
  const H = (x: number, z: number) => { const h = knollH(120 + x, 330 + z); return h - 0.09 + (h > 0.6 ? 0.25 * Math.sin(x * 0.31) * Math.cos(z * 0.27) : 0); };
  for (let x = -125; x < 70; x += step) for (let z = -100; z < 95; z += step) {
    const hs = [knollH(120 + x, 330 + z), knollH(120 + x + step, 330 + z), knollH(120 + x, 330 + z + step), knollH(120 + x + step, 330 + z + step)];
    if (Math.max(...hs) < 0.05) continue;
    const a = V(x, H(x, z), z), b = V(x + step, H(x + step, z), z), c = V(x, H(x, z + step), z + step), d = V(x + step, H(x + step, z + step), z + step);
    const k = hash(Math.floor((x + 200) / 25) * 13 + Math.floor((z + 200) / 25), 3) > 0.7 ? 1 : 0;
    vs[k].push(a, c, b, b, c, d);
  }
  g.add(new THREE.Mesh(upTris(vs[0]), mat(C.duff)), new THREE.Mesh(upTris(vs[1]), mat(C.duffDark)));
  return g;
}
/** One tier of the granite: an irregular slab from y0 to y1 whose walls bulge and whose top edge is chamfered. */
function graniteTier(poly: P2[], y0: number, y1: number, seed: number, topColor: string, wallColor: string): THREE.Mesh[] {
  const n = poly.length, cx = poly.reduce((a, p) => a + p[0], 0) / n, cz = poly.reduce((a, p) => a + p[1], 0) / n;
  const ring = (k: number, y: number, j: number) => poly.map((p, i) => { const kk = k + (hash(i, seed + j) - 0.5) * 0.16; return V(cx + (p[0] - cx) * kk + (hash(i, seed + j + 4) - 0.5) * 1.2, y + (hash(i, seed + j + 9) - 0.5) * (j ? 1.6 : 0.5), cz + (p[1] - cz) * kk + (hash(i, seed + j + 5) - 0.5) * 1.2); });
  const rTop = ring(0.86, y1, 0), rCh = ring(1.0, y1 - 1.4, 1), rMid = ring(1.06, lerp(y0, y1 - 0.9, 0.5), 2), rBot = ring(0.98, y0, 3);
  const walls: THREE.Vector3[] = [];
  const strip = (A: THREE.Vector3[], B: THREE.Vector3[]) => { for (let i = 0; i < n; i++) { const j = (i + 1) % n; walls.push(A[i], B[i], B[j], A[i], B[j], A[j]); } };
  strip(rTop, rCh); strip(rCh, rMid); strip(rMid, rBot);
  // outward-facing: wind each quad so its normal points away from the centre
  const fix: THREE.Vector3[] = [];
  for (let i = 0; i < walls.length; i += 3) {
    const a = walls[i], b = walls[i + 1], c = walls[i + 2], nrm = b.clone().sub(a).cross(c.clone().sub(a)), mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (nrm.x * (mid.x - cx) + nrm.z * (mid.z - cz) < 0) fix.push(a, c, b); else fix.push(a, b, c);
  }
  const top: THREE.Vector3[] = []; const ctr = V(cx, y1 + 0.15, cz);
  for (let i = 0; i < n; i++) top.push(ctr, rTop[i], rTop[(i + 1) % n]);
  return [new THREE.Mesh(upTris(top), mat(topColor)), new THREE.Mesh(tris(fix), mat(wallColor))];
}
/** The knoll crown: a knob of lichen-blotched granite 60 ft across in three tiers (polylines `b`, `m`, `t` from the
 *  map script) on the knoll's mound (base `hb`), ledges on its south-east face stepping down toward the crossing, a flat
 *  top at `top` (the crown level stands on it), lichen and needles in its hollows, loose blocks at its foot. */
export function rockOutcrop(d: Dims): THREE.Group {
  const g = grp(), hb = d.hb ?? 5, hm = d.hm ?? 9.5, ht = d.ht ?? 14.2, top = d.top ?? 18.1;
  const B = dimsLine(d, 'b'), M = dimsLine(d, 'm'), T = dimsLine(d, 't');
  g.add(...graniteTier(B, hb - 2.5, hm, 1, C.graniteDeep, C.granite), ...graniteTier(M, hm - 1, ht, 2, C.granite, C.graniteDeep), ...graniteTier(T, ht - 1, top + 0.05, 3, C.granite, C.granitePale));
  // the scramble: ledges stepping down the south-east face toward the X
  const ledges: [number, number, number, number, number][] = [[20, 12, 7.5, 13.2, 11], [26.5, 18.5, 6.2, 9.0, 12], [31, 22.5, 5, 5.6, 13]];
  for (const [x, z, r, y, s] of ledges) g.add(...graniteTier(blobPts(r, s, 1.25, 8).map(([a, b]) => [a + x, b + z] as P2), hb - 2, y, s, C.granitePale, C.graniteDeep));
  // lichen blotches and needle drifts on the top and the ledges, cracks across the top
  const tops: [P2[], number][] = [[T, top - 0.02], [M, ht + 0.12], [B, hm + 0.12]];
  let k = 0;
  for (const [poly, y] of tops) {
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    for (let i = 0; i < 12; i++) {
      const x = lerp(Math.min(...xs), Math.max(...xs), hash(i, 31 + k)), z = lerp(Math.min(...zs), Math.max(...zs), hash(i, 37 + k));
      if (!inPoly(x / 0.86, z / 0.86, poly)) continue;
      const kind = hash(i, 41 + k), r = 0.6 + hash(i, 43 + k) * 1.8;
      g.add(flat(blobPts(r, i + k, 1.2, 7).map(([a, b]) => [a + x, b + z] as P2), y + 0.02 + (i % 3) * 0.004, kind < 0.35 ? C.lichen : kind < 0.5 ? C.lichenOchre : kind < 0.65 ? C.lichenPale : C.duff));
    }
    k += 7;
  }
  for (let i = 0; i < 5; i++) { const c = box(4 + hash(i, 3) * 6, 0.06, 0.18, C.crack, (hash(i, 4) - 0.5) * 18 - 4, top + 0.03, (hash(i, 5) - 0.5) * 14 - 4); c.rotation.y = hash(i, 6) * 3; g.add(c); }
  for (let i = 0; i < 16; i++) { const a = hash(i, 51) * Math.PI * 2, r = 26 + hash(i, 52) * 10; g.add(place(lump(1.6 + hash(i, 53) * 2.6, i % 2 ? C.granite : C.graniteDeep, i, 1.3, 0.8, 1.1), Math.cos(a) * r, hb - 0.4 + hash(i, 54) * 1.6, Math.sin(a) * r, hash(i, 55) * 3)); }
  return g;
}

// ---------------------------------------------------------------- the river: trench, water, the land round the map
type LandHit = { y: number; c: THREE.Color };
type Sampler = (x: number, z: number) => LandHit | null;
/** Height and colour of the backdrop's land mesh at plan (x, z): its triangles near the map binned on a coarse grid. */
function landSampler(land: THREE.Mesh, cx: number, cz: number, half = 9000, cell = 150): Sampler {
  const pos = land.geometry.attributes.position as THREE.BufferAttribute, col = land.geometry.attributes.color as THREE.BufferAttribute | undefined;
  const nC = Math.ceil((2 * half) / cell), x0 = cx - half, z0 = cz - half, bins = new Map<number, number[]>();
  for (let t = 0; t < Math.floor(pos.count / 3); t++) {
    let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
    for (let k = 0; k < 3; k++) { const x = pos.getX(3 * t + k), z = pos.getZ(3 * t + k); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); e = Math.max(e, z); }
    if (b < x0 || a > x0 + 2 * half || e < z0 || c > z0 + 2 * half) continue;
    const i0 = Math.max(0, Math.floor((a - x0) / cell)), i1 = Math.min(nC - 1, Math.floor((b - x0) / cell)), j0 = Math.max(0, Math.floor((c - z0) / cell)), j1 = Math.min(nC - 1, Math.floor((e - z0) / cell));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * nC + j; let L = bins.get(k); if (!L) bins.set(k, (L = [])); L.push(t); }
  }
  return (x, z) => {
    const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
    if (i < 0 || j < 0 || i >= nC || j >= nC) return null;
    for (const t of bins.get(i * nC + j) ?? []) {
      const A = 3 * t, ax = pos.getX(A), az = pos.getZ(A), bx = pos.getX(A + 1), bz = pos.getZ(A + 1), qx = pos.getX(A + 2), qz = pos.getZ(A + 2);
      const det = (bz - qz) * (ax - qx) + (qx - bx) * (az - qz); if (Math.abs(det) < 1e-9) continue;
      const l1 = ((bz - qz) * (x - qx) + (qx - bx) * (z - qz)) / det, l2 = ((qz - az) * (x - qx) + (ax - qx) * (z - qz)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const c = new THREE.Color(1, 1, 1);
      if (col) c.setRGB(l1 * col.getX(A) + l2 * col.getX(A + 1) + l3 * col.getX(A + 2), l1 * col.getY(A) + l2 * col.getY(A + 1) + l3 * col.getY(A + 2), l1 * col.getZ(A) + l2 * col.getZ(A + 1) + l3 * col.getZ(A + 2));
      return { y: l1 * pos.getY(A) + l2 * pos.getY(A + 1) + l3 * pos.getY(A + 2), c };
    }
    return null;
  };
}
/** A strip laid on the land along a polyline (world ft): vertices `step` ft apart, across it at offsets `across(s)`
 *  (ft from the centre line, left to right), each at the land's height plus `lift(s)` and coloured by `color`. */
function laidStrip(line: P2[], step: number, across: (s: number) => number[], lift: (s: number, y: number) => number, color: (s: number, j: number, land: THREE.Color) => THREE.Color, sample: Sampler, fallY: number): THREE.BufferGeometry {
  const D = densify(line, step), P: number[] = [], Cs: number[] = [];
  const row = D.map((st) => across(st.s).map((o, j) => {
    const x = st.p[0] + st.n[0] * o, z = st.p[1] + st.n[1] * o, h = sample(x, z), y = lift(st.s, h ? h.y : fallY);
    return { v: V(x, y, z), c: color(st.s, j, h ? h.c : new THREE.Color(FLOOR_COLOR.grass)) };
  }));
  const push = (a: { v: THREE.Vector3; c: THREE.Color }, b: typeof a, c: typeof a) => {
    let [p, q, r] = [a, b, c];
    if ((q.v.z - p.v.z) * (r.v.x - p.v.x) - (q.v.x - p.v.x) * (r.v.z - p.v.z) < 0) [q, r] = [r, q];
    for (const k of [p, q, r]) { P.push(k.v.x, k.v.y, k.v.z); Cs.push(k.c.r, k.c.g, k.c.b); }
  };
  for (let i = 0; i + 1 < row.length; i++) for (let j = 0; j + 1 < Math.min(row[i].length, row[i + 1].length); j++) {
    const a = row[i][j], b = row[i][j + 1], c = row[i + 1][j], e = row[i + 1][j + 1]; push(a, b, e); push(a, e, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cs, 3)); g.computeVertexNormals();
  return g;
}
/** Lit like the backdrop's own land (no distance fog; the mist of war passes over it), coloured per vertex. */
function landMat(surf: 'dirt' | 'none'): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, flatShading: true }); setSurface(m, surf); return patchFog(m, true);
}
const lineLen = (L: P2[]) => L.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) : 0), 0);

/** The sentinel that fits the land round the map to it, once for each backdrop (rebuilt for every map and theme) and once
 *  for each build of the trench, on the first frame both are drawn:
 *  - the land, forest and ribbons drawn round the map are cut out of the trench's column (world feet x0..x1, from the
 *    map's north edge to its south and on until the land there has fallen to the water), so the trench, which lies below
 *    the map's ground, shows; the trench's own lengths past the map's edges are laid onto that falling land;
 *  - the Luna runs on from the trench's ends over the land: north out of Lake Zarovich's shore, south to where the
 *    region's river carries on (its ribbon is hidden in between, box `rb*`);
 *  - the world map's roads give way near the map (within `cut` ft of its edges and `vcut` of Vallaki as drawn, where
 *    they met in a phantom junction off the west edge), and this map's four roads run on from its edges instead: the
 *    hard road over the bridge to Vallaki and on east, and south-west to where the world's road carries on; the
 *    cart-track and the Berez trail fade into the forest. The forest steps off them, and back onto the rides it had
 *    left for the world's roads. Lines (world ft) from the map script: ne, ve, sw, nw, se (roads), rn, rs (river). */
function landClip(d: Dims, x0: number, x1: number, z0: number, z1: number): THREE.Mesh {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -500, 0, 0, -500, 0, 0, -500, 0], 3));
  const m = new THREE.Mesh(geo, mat(C.bankDark)); m.frustumCulled = false; m.userData.pClip = true; m.userData.pDims = d;
  const MW = d.mw ?? 1300, MH = d.mh ?? 800, wy = d.wy ?? -10, ox = d.ox ?? 0;
  const bx0 = ox + (d.t0 ?? 5), bx1 = ox + (d.t1 ?? 67), xc = ox + ((d.wx0 ?? 15) + (d.wx1 ?? 55)) / 2;
  const mapDist = (x: number, z: number) => Math.max(0, -x, x - MW, -z, z - MH);
  const planes = [new THREE.Plane(V(-1, 0, 0), x0), new THREE.Plane(V(1, 0, 0), -x1), new THREE.Plane(V(0, 0, -1), z0), new THREE.Plane(V(0, 0, 1), -z1)];
  m.onBeforeRender = (renderer, scene, camera) => {
    const bd = scene.getObjectByName('backdrop'); if (!bd) return;
    const trench = m.parent;
    if (bd.userData.pTrench && (!trench || trench.userData.pFitted)) return;
    const land = bd.getObjectByName('land') as THREE.Mesh | undefined;
    const sample: Sampler = (bd.userData.pSampler ??= land ? landSampler(land, MW / 2, MH / 2) : () => null);
    const T = (x: number, z: number) => { const h = sample(x, z); return h ? h.y + 0.4 : 0; };   // the land's top where our turf would lie
    // the trench runs on past each edge until both its bank tops have come down to the water
    let zN = z0, zS = z1;
    if (land) {
      for (let z = 0; z >= z0; z -= 10) if (Math.max(T(bx0, z), T(bx1, z)) <= wy + 0.7) { zN = z; break; }
      for (let z = MH; z <= z1; z += 10) if (Math.max(T(bx0, z), T(bx1, z)) <= wy + 0.7) { zS = z; break; }
    }
    planes[2].constant = zN; planes[3].constant = -zS;
    if (trench && !trench.userData.pFitted) { trench.userData.pFitted = true; if (land) fitTrench(trench, m, T, zN, zS); }
    if (bd.userData.pTrench) return;
    bd.userData.pTrench = true;
    const mats = new Set<THREE.Material>(), rib = new Set<THREE.Material>(), roads: THREE.Mesh[] = [], rivers: THREE.Mesh[] = [], forests: THREE.InstancedMesh[] = [];
    bd.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) forests.push(o as THREE.InstancedMesh);
      const col = mesh.geometry.attributes.color as THREE.BufferAttribute | undefined, mt = mesh.material as THREE.Material;
      if (col && !Array.isArray(mesh.material) && mt.type === 'MeshBasicMaterial') {
        // the region map's ribbons: rivers are blue, roads brown
        if (col.getZ(0) > col.getX(0) + 0.06) { rib.add(mt); rivers.push(mesh); } else { roads.push(mesh); mats.add(mt); }
        return;
      }
      for (const q of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mats.add(q);
    });
    // the world's roads give way near the map: their triangles there fold to nothing
    const vx = d.vx ?? 4200, vz = d.vz ?? -1870, CUT = d.cut ?? 5000, VC = d.vcut ?? 2700;
    const cutAt = (x: number, z: number) => mapDist(x, z) < CUT || Math.hypot(x - vx, z - vz) < VC;
    const gone: P2[] = [];
    for (const r of roads) {
      const pa = r.geometry.attributes.position as THREE.BufferAttribute;
      for (let t = 0; t + 2 < pa.count; t += 3) {
        const cx = (pa.getX(t) + pa.getX(t + 1) + pa.getX(t + 2)) / 3, cz = (pa.getZ(t) + pa.getZ(t + 1) + pa.getZ(t + 2)) / 3;
        if (!cutAt(cx, cz)) continue;
        gone.push([cx, cz]); for (let k = 1; k < 3; k++) pa.setXYZ(t + k, pa.getX(t), pa.getY(t), pa.getZ(t));
      }
      pa.needsUpdate = true; r.geometry.computeBoundingSphere();
    }
    // the ribbon's height and colour where a line of ours meets it
    const near = (list: THREE.Mesh[], x: number, z: number, R: number) => {
      let n = 0, y = 0; const c = new THREE.Color(0, 0, 0);
      for (const r of list) {
        const pa = r.geometry.attributes.position as THREE.BufferAttribute, ca = r.geometry.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < pa.count; i++) { if (Math.abs(pa.getX(i) - x) > R || Math.abs(pa.getZ(i) - z) > R) continue; n++; y += pa.getY(i); c.r += ca.getX(i); c.g += ca.getY(i); c.b += ca.getZ(i); }
      }
      return n ? { y: y / n, c: c.multiplyScalar(1 / n) } : null;
    };
    // the region's river ribbon is hidden from the lake shore to where our own Luna meets it, and the land in the trench column
    const rb = [new THREE.Plane(V(-1, 0, 0), d.rbx0 ?? x0 - 900), new THREE.Plane(V(1, 0, 0), -(d.rbx1 ?? x1 + 1400)), new THREE.Plane(V(0, 0, -1), d.rbz0 ?? z0 - 2600), new THREE.Plane(V(0, 0, 1), -(d.rbz1 ?? z1 + 2600))];
    for (const mt of rib) { mt.clippingPlanes = rb; mt.clipIntersection = true; mt.needsUpdate = true; }
    for (const mt of mats) { mt.clippingPlanes = planes; mt.clipIntersection = true; mt.needsUpdate = true; }
    // ---- our lines on the land
    const fallY = T(MW / 2, MH + 40) - 0.4, laid: P2[][] = [], clearW: number[] = [];
    const dirtM = landMat('dirt'), waterM = landMat('none');
    const dirt = new THREE.Color(FLOOR_COLOR.dirt), road = new THREE.Color('#7a6c5a'), wet = new THREE.Color(C.water), mud = new THREE.Color(C.bankMud), sedge = new THREE.Color(C.sedge);
    // each road starts as the map's own does at that edge (gravel east of the bridge, the gravel road's ditches to the
    // south-west, turf on the cart-track) and weathers into the backdrop's road colour, or fades out into the forest
    const gravel = new THREE.Color(C.gravel).multiplyScalar(0.8), dirt0 = dirt.clone().multiplyScalar(0.92), turf = new THREE.Color(C.turf).lerp(dirt, 0.45), ditch = new THREE.Color(C.ditch).lerp(wet, 0.4);
    const roadDefs: [string, number, number, boolean, THREE.Color, boolean][] = [['ne', 20, 20, false, gravel, false], ['ve', 16, 16, false, road, false], ['sw', 20, 20, false, dirt0, true], ['nw', 12, 6, true, turf, false], ['se', 6, 5, true, dirt0, false]];
    for (const [k, w0, w1, fade, c0, ditches] of roadDefs) {
      const L0 = dimsLine(d, k); if (L0.length < 2) continue;
      const L = lineLen(L0), end = L0[L0.length - 1], meet = fade ? null : near(roads, end[0], end[1], 70);
      const hw = (s: number) => lerp(w0, w1, smooth(0, 900, s)) / 2 * (fade ? 1 - smooth(L - 450, L, s) : 1);
      const g = laidStrip(L0, 15, (s) => { const h = hw(s); return [-h - 8, -h - 5, -h - 2, -h, -h * 0.4, h * 0.4, h, h + 2, h + 5, h + 8]; },
        (s, y) => { const yy = y + 0.5; return meet ? lerp(yy, meet.y, smooth(L - 160, L, s)) : yy; },
        (s, j, lc) => {
          const far = lc.clone().lerp(meet ? meet.c : road, 0.55), c = c0.clone().lerp(dirt, smooth(0, 160, s)).lerp(far, smooth(60, 700, s));
          if (fade) c.lerp(lc, smooth(L - 500, L, s));
          if (j === 0 || j === 9) return lc.clone();
          if (j <= 2 || j >= 7) return ditches ? ditch.clone().lerp(lc.clone().lerp(c, 0.25), smooth(80, 320, s)) : lc.clone().lerp(c, j === 1 || j === 8 ? 0.1 : 0.25);
          return j === 3 || j === 6 ? c.lerp(lc, 0.2) : c;
        }, sample, fallY);
      const mesh = new THREE.Mesh(g, dirtM); mesh.name = `p-road-${k}`; bd.add(mesh); laid.push(L0); clearW.push(w0 / 2 + 12);
    }
    for (const k of ['rn', 'rs']) {
      let L0 = dimsLine(d, k); if (L0.length < 2) continue;
      // start where the trench ends, a few feet back inside it
      const zEnd = k === 'rn' ? zN : zS, inMap = (p: P2) => (k === 'rn' ? p[1] > zEnd - 12 : p[1] < zEnd + 12);
      L0 = [[xc, k === 'rn' ? zEnd + 14 : zEnd - 14], ...L0.filter((p) => !inMap(p))];
      const L = lineLen(L0), end = L0[L0.length - 1], meet = near(rivers, end[0], end[1], 80), hw = 20;
      const g = laidStrip(L0, 18, () => [-hw - 8, -hw, -hw * 0.5, 0, hw * 0.5, hw, hw + 8],
        (s, y) => { const yy = y + 0.2 + 0.25 * smooth(0, 40, s); return meet && k === 'rs' ? lerp(yy, meet.y, smooth(L - 200, L, s)) : yy; },
        (s, j, lc) => {
          if (j === 0 || j === 6) return mud.clone().lerp(sedge, 0.4).lerp(lc, 0.35 + 0.4 * smooth(200, 2500, s));
          // unlit, the region's ribbon reads paler than this lit water: the far end is lifted to meet it
          return wet.clone().lerp((meet ? meet.c : new THREE.Color('#3b4e5c')).clone().multiplyScalar(1.25), smooth(L * 0.25, L * 0.95, s));
        }, sample, fallY);
      const mesh = new THREE.Mesh(g, waterM); mesh.name = `p-luna-${k}`; bd.add(mesh); laid.push(L0); clearW.push(hw + 18);
    }
    // ---- the forest: out of the trench column and off our lines, back into the rides it left for the world's roads
    const B = 120, key = (x: number, z: number) => Math.floor(x / B) * 100003 + Math.floor(z / B);
    const goneBins = new Map<number, P2[]>(); for (const p of gone) { const k = key(p[0], p[1]); (goneBins.get(k) ?? goneBins.set(k, []).get(k)!).push(p); }
    const nearGone = (x: number, z: number, r: number) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of goneBins.get(key(x + i * B, z + j * B)) ?? []) if (Math.hypot(p[0] - x, p[1] - z) < r) return true; return false; };
    const segs: [P2, P2, number][] = []; laid.forEach((L, i) => { for (let k = 0; k + 1 < L.length; k++) segs.push([L[k], L[k + 1], clearW[i]]); });
    const onLaid = (x: number, z: number) => segs.some(([a, b, w]) => Math.abs(x - a[0]) < 400 + w && Math.abs(z - a[1]) < 400 + w && segDist(x, z, a, b) < w);
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), cl = new THREE.Color();
    for (const inst of forests) {
      const live = new Map<number, number[]>();
      for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m4); m4.decompose(p, q, s); if (s.x > 0) { const k = key(p.x, p.z); (live.get(k) ?? live.set(k, []).get(k)!).push(i); } }
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, m4); m4.decompose(p, q, s);
        if (s.x === 0 && inst.instanceColor && mapDist(p.x, p.z) > 80 && nearGone(p.x, p.z, 34)) {
          // a ride cut for a road that is no longer drawn: plant it again from the nearest standing tree
          let best = -1, bd2 = 260;
          for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const j of live.get(key(p.x + a * B, p.z + b * B)) ?? []) { inst.getMatrixAt(j, m4); const e = m4.elements, dd = Math.hypot(e[12] - p.x, e[14] - p.z); if (dd < bd2) { bd2 = dd; best = j; } }
          const h = sample(p.x, p.z);
          if (best >= 0 && h) { inst.getMatrixAt(best, m4); const e = m4.elements, k = Math.hypot(e[0], e[1], e[2]); inst.getColorAt(best, cl); s.set(k * (0.9 + hash(i, 3) * 0.2), k * (0.85 + hash(i, 4) * 0.35), k); p.y = h.y + 2; inst.setColorAt(i, cl); }
        }
        const inCol = p.x > x0 - 14 && p.x < x1 + 14 && p.z > zN - 14 && p.z < zS + 14;
        if (inCol || onLaid(p.x, p.z)) s.set(0, 0, 0);   // trees standing in the column or on our lines step aside
        m4.compose(p, q, s); inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
    requestAnimationFrame(() => renderer.render(scene, camera));
  };
  return m;
}
/** Lay the trench's lengths past the map's edges onto the land (it falls away there): its turf follows the land's top
 *  `T`, its water comes down with the lower bank, its banks shrink between; beyond `zN`/`zS`, where both bank tops have
 *  come down to the water, it is folded away and the river runs on over the land. Done once, on the merged meshes. */
function fitTrench(trench: THREE.Object3D, sentinel: THREE.Object3D, T: (x: number, z: number) => number, zN: number, zS: number) {
  const d = (sentinel.userData.pDims ?? {}) as Dims, MH = d.mh ?? 800, wy = d.wy ?? -10, ox = d.ox ?? 0;
  const bx0 = ox + (d.t0 ?? 5), bx1 = ox + (d.t1 ?? 67);
  trench.updateMatrixWorld(true);
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  for (const o of trench.children) {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || o === sentinel) continue;
    const pa = mesh.geometry.attributes.position as THREE.BufferAttribute; inv.copy(mesh.matrixWorld).invert();
    const W = new Map<number, number>(), Wat = (z: number) => { const k = Math.round(z / 4); let w = W.get(k); if (w === undefined) { w = Math.min(wy, Math.min(T(bx0, k * 4), T(bx1, k * 4)) - 0.35); W.set(k, w); } return w; };
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
      const past = v.z < 0 ? -v.z : v.z > MH ? v.z - MH : 0; if (!past) continue;
      const t = T(v.x, v.z), w = Wat(v.z), y = v.y;
      const yn = y >= 0 ? t + y : y >= wy ? t + (y / wy) * (w - t) : w + (y - wy);
      v.y = y + (yn - y) * smooth(0, 40, past); v.applyMatrix4(inv); pa.setXYZ(i, v.x, v.y, v.z);
    }
    // past where the land meets the water nothing of the trench is left
    for (let t = 0; t + 2 < pa.count; t += 3) {
      let zs = 0; for (let k = 0; k < 3; k++) zs += v.fromBufferAttribute(pa, t + k).applyMatrix4(mesh.matrixWorld).z;
      if (zs / 3 < zN || zs / 3 > zS) for (let k = 1; k < 3; k++) pa.setXYZ(t + k, pa.getX(t), pa.getY(t), pa.getZ(t));
    }
    pa.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
  }
}
/** The Luna in its trench (origin on the terrace west of it): sedge banks from the bank tops `t0`/`t1` down to the water
 *  edges `wx0`/`wx1` (x, local ft), black water at `wy` running from `z0` to `z1` (past the map's edges `mz0`/`mz1`,
 *  where the terrace either side is drawn too), the dry flood gully `gx0..gx1` × `gz0..gz1` hollowed to `gy`. */
export function riverTrench(d: Dims): THREE.Group {
  const g = grp(), wy = d.wy ?? -10, t0 = d.t0 ?? 5, t1 = d.t1 ?? 67, wx0 = d.wx0 ?? 15, wx1 = d.wx1 ?? 55, z0 = d.z0 ?? -660, z1 = d.z1 ?? 660, mz0 = d.mz0 ?? -400, mz1 = d.mz1 ?? 400;
  const ox = d.ox ?? 0, oz = d.oz ?? 0, WY = wy + 0.15;
  // the banks: a profile across each, jittered station by station (every 8 ft), in three bands: lip, earth face, mud foot
  const nZ = Math.round((z1 - z0) / 8), lip: THREE.Vector3[] = [], face: THREE.Vector3[] = [], faceD: THREE.Vector3[] = [], foot: THREE.Vector3[] = [];
  const prof = (side: number, i: number): THREE.Vector3[] => {
    const z = z0 + (i / nZ) * (z1 - z0), out = z < mz0 || z > mz1, yT = out ? -0.35 : -0.05, j = (k: number) => (hash(i, k + (side > 0 ? 0 : 50)) - 0.5) * 1.3;
    if (side < 0) return [V(t0, yT, z), V(t0 + 1.6 + j(1) * 0.5, -1.2, z), V(t0 + 3.8 + j(2), -4.6 + j(3), z), V(t0 + 6.4 + j(4), -7.6 + j(5) * 0.5, z), V(wx0 - 0.8, wy + 0.3, z), V(wx0 + 1.2, wy - 0.6, z)];
    return [V(t1, yT, z), V(t1 - 1.3 - j(1) * 0.4, -1.6, z), V(t1 - 3.2 - j(2) * 0.8, -5.2 + j(3), z), V(t1 - 5.6 - j(4) * 0.6, -8.2 + j(5) * 0.5, z), V(wx1 + 0.8, wy + 0.3, z), V(wx1 - 1.2, wy - 0.6, z)];
  };
  for (const side of [-1, 1]) for (let i = 0; i < nZ; i++) {
    const A = prof(side, i), B = prof(side, i + 1);
    for (let k = 0; k < 5; k++) {
      const list = k === 0 ? lip : k >= 3 ? foot : hash(Math.floor(i / 4) + side * 31, k) < 0.35 ? faceD : face;
      // wind so the faces look up and out over the water
      if (side < 0) list.push(A[k], B[k], B[k + 1], A[k], B[k + 1], A[k + 1]); else list.push(A[k], B[k + 1], B[k], A[k], A[k + 1], B[k + 1]);
    }
  }
  // the trench's two ends, past the map's edges: earth walls closing it off under the land
  const caps: THREE.Vector3[] = [];
  for (const [z, s2] of [[z0, 1], [z1, -1]] as [number, number][]) {
    const W2 = [V(t0, -0.4, z), V(t1, -0.4, z), V(t1, wy - 1.5, z), V(t0, wy - 1.5, z)];
    if (s2 > 0) caps.push(W2[0], W2[2], W2[1], W2[0], W2[3], W2[2]); else caps.push(W2[0], W2[1], W2[2], W2[0], W2[2], W2[3]);
  }
  g.add(new THREE.Mesh(tris(caps), mat(C.bankDark)));
  g.add(new THREE.Mesh(tris(lip), mat(C.sedge)), new THREE.Mesh(tris(face), mat(C.bankEarth)), new THREE.Mesh(tris(faceD), mat(C.bankDark)), new THREE.Mesh(tris(foot), mat(C.bankMud)));
  // past the map's north and south edges the terrace and the east bank are drawn here (the land there is cut away)
  const X0 = (d.cx0 ?? ox - 35) - ox, X1 = (d.cx1 ?? ox + 71) - ox, GR = FLOOR_COLOR.grass;
  // (a grid, so the sentinel can lay these lengths onto the land, which falls away past the edges: see fitTrench)
  const sheet = (xa: number, xb: number, za: number, zb: number, y: number, dx: number, dz: number) => {
    const v: THREE.Vector3[] = [], nx = Math.max(1, Math.round((xb - xa) / dx)), nz = Math.max(1, Math.round((zb - za) / dz));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const a = lerp(xa, xb, i / nx), b = lerp(xa, xb, (i + 1) / nx), c = lerp(za, zb, k / nz), e = lerp(za, zb, (k + 1) / nz);
      v.push(V(a, y, c), V(b, y, c), V(b, y, e), V(a, y, c), V(b, y, e), V(a, y, e));
    }
    return upTris(v);
  };
  for (const [za, zb] of [[z0, mz0], [mz1, z1]]) g.add(new THREE.Mesh(sheet(X0, t0, za, zb, -0.36, 10, 8), mat(GR)), new THREE.Mesh(sheet(t1, X1, za, zb, -0.36, 4, 8), mat(GR)));
  // the water: black and slow, the overcast laid on it in long faint lenses, a few flecks of foam and leaves riding it
  for (const [za, zb] of [[z0, mz0], [mz0, mz1], [mz1, z1]]) g.add(new THREE.Mesh(sheet(wx0 - 1.5, wx1 + 1.5, za, zb, WY, 11, za === mz0 ? 400 : 8), mat(C.water)));
  for (let i = 0; i < 22; i++) {
    const cx = lerp(wx0 + 4, wx1 - 4, hash(i, 5)), cz = lerp(z0 + 60, z1 - 60, hash(i, 6)), L = 40 + hash(i, 7) * 110, w = 1.2 + hash(i, 8) * 3.5, pts: P2[] = [];
    for (let k = 0; k <= 8; k++) pts.push([cx - w * Math.sin((k / 8) * Math.PI), cz - L / 2 + (k / 8) * L]);
    for (let k = 7; k >= 1; k--) pts.push([cx + w * 0.6 * Math.sin((k / 8) * Math.PI), cz - L / 2 + (k / 8) * L]);
    const v = flat(pts, WY + 0.03, fogMat(C.sheen, i % 3 ? 0.35 : 0.5)); v.renderOrder = 1; g.add(v);
  }
  for (let i = 0; i < 70; i++) g.add(box(0.3 + hash(i, 9) * 0.5, 0.04, 0.2 + hash(i, 10) * 0.3, i % 3 ? C.leaves : C.foam, lerp(wx0 + 1, wx1 - 1, hash(i, 11)), WY + 0.05, lerp(z0 + 20, z1 - 20, hash(i, 12)), hash(i, 13) * 3));
  // sedge along the lip and the toe of both banks, stones at the toe
  const sg = grp();
  for (let i = 0; i < nZ; i += 1) for (const side of [-1, 1]) {
    const z = z0 + ((i + hash(i, side + 20)) / nZ) * (z1 - z0);
    if (hash(i, side + 21) < 0.55) tuft(sg, side < 0 ? t0 + 0.6 : t1 - 0.6, side < 0 ? -0.6 : -0.7, z, 1.6, [C.sedge, C.sedgeDry], i * 3 + side, 5, 0.6, 0.12);
    if (hash(i, side + 22) < 0.7) tuft(sg, side < 0 ? wx0 - 0.3 : wx1 + 0.3, wy + 0.1, z + 3, 2.2, [C.sedge, C.reedDry, C.sedgeDry], i * 5 + side, 6, 0.9, 0.12);
    if (hash(i, side + 23) < 0.18) sg.add(place(lump(0.7 + hash(i, side + 24) * 0.9, C.fieldStoneDark, i, 1.3, 0.6, 1), side < 0 ? wx0 - 0.2 : wx1 + 0.2, wy + 0.1, z, hash(i, 3) * 3));
  }
  g.add(sg);
  // the flood gully: a dry hollow on the terrace edge, silt-floored, rising to the turf at its rim
  const gx0 = d.gx0 ?? -29, gx1 = d.gx1 ?? -3, gz0 = d.gz0 ?? -370, gz1 = d.gz1 ?? -210, gy = d.gy ?? -4.5;
  const gh = (x: number, z: number) => { const ex = Math.min(x - gx0, gx1 - x), ez = Math.min(z - gz0, gz1 - z); return gy * smooth(0, 5.5, ex) * smooth(0, 32, ez) - 0.05; };
  const gv: THREE.Vector3[][] = [[], []], gs = 2;
  for (let x = gx0; x < gx1 - 0.01; x += gs) for (let z = gz0; z < gz1 - 0.01; z += gs * 2) {
    const xb = Math.min(gx1, x + gs), zb = Math.min(gz1, z + gs * 2);
    const a = V(x, gh(x, z), z), b = V(xb, gh(xb, z), z), c = V(x, gh(x, zb), zb), e = V(xb, gh(xb, zb), zb);
    const k = (a.y + e.y) / 2 < gy * 0.55 ? 0 : 1;
    gv[k].push(a, c, b, b, c, e);
  }
  g.add(new THREE.Mesh(upTris(gv[0]), mat(C.silt)), new THREE.Mesh(upTris(gv[1]), mat(C.sedge)));
  for (let i = 0; i < 7; i++) { const z = lerp(gz0 + 40, gz1 - 40, hash(i, 61)), x = lerp(gx0 + 7, gx1 - 7, hash(i, 62)); g.add(rod(V(x - 2, gh(x, z) + 0.2, z - 1), V(x + 2 + hash(i, 63) * 3, gh(x, z) + 0.25, z + 1.5), 0.12, 0.08, C.alderDark)); }
  // reeds crowd both mouths of the gully; its middle, under the arch, stays dry
  for (let i = 0; i < 34; i++) {
    const end = i % 2 ? gz0 + 6 + hash(i, 64) * 30 : gz1 - 6 - hash(i, 64) * 30, x = lerp(gx0 + 3, gx1 - 3, hash(i, 65));
    tuft(sg, x, gh(x, end) + 0.02, end, 3.6 + hash(i, 66) * 1.6, [C.reed, C.reedDry], i * 11, 7, 1.1, 0.1);
  }
  g.add(landClip(d, d.cx0 ?? ox - 35, d.cx1 ?? ox + 71, d.cz0 ?? oz + z0, d.cz1 ?? oz + z1));
  return g;
}

// ---------------------------------------------------------------- the bridge
/** The deck's height (ft over the terrace) at x along the bridge: level over the flood arch, humped over the main arch. */
const deckY = (x: number, mx: number) => 0.6 + 0.75 * Math.max(0, 1 - ((x - mx) / 48) ** 2);
/** The Luna bridge, built along local x from its anchor at the flood arch's centre: the 12-ft flood arch over the dry
 *  gully (springing at ±6, crown 3 ft over its floor), a 25-ft pier on the bank top, the 50-ft main arch centred at `mx`
 *  (springing at the water `wy`, soffit crowned 8 ft above it), the east abutment in the far bank; a 15-ft deck humped over
 *  the main arch with waist-high parapets and mud-filled wheel grooves, voussoir rings and cutwaters, mossy at the water,
 *  and the raised gravel causeways out to `xw` (west) and `xc` (east). */
export function lunaBridge(d: Dims): THREE.Group {
  const g = grp(), mx = d.mx ?? 55.9, wy = d.wy ?? -10, xa = -10, xe = 90, xw = d.xw ?? -79, xc = d.xc ?? 120, W = 15, HW = W / 2;
  const ma0 = mx - 25, ma1 = mx + 25, R = (625 + 64) / 16, cy = wy + 8 - R, Rf = 7.5, cyf = -8.5;
  // the body: one outline (deck line over the top, the arches and footings along the bottom) extruded across the width
  const top: P2[] = []; for (let x = xa; x <= xe + 0.01; x += 2.5) top.push([x, deckY(x, mx) - 0.05]);
  const bot: P2[] = [[xe, -0.6], [85.5, -0.6], [83.5, -4.5], [82, -8.5], [ma1 + 0.6, wy - 0.8]];
  for (let k = 0; k <= 24; k++) { const x = ma1 - (k / 24) * 50; bot.push([x, cy + Math.sqrt(Math.max(0, R * R - (x - mx) ** 2))]); }
  bot.push([ma0 - 0.6, wy - 0.8], [28, -8.6], [25.5, -4.8], [23, -1.1], [22, -0.6], [14.5, -0.6], [13.5, -2.2], [11.5, -4.2], [9.5, -4.9], [6.4, -4.9]);
  for (let k = 0; k <= 12; k++) { const x = 6 - (k / 12) * 12; bot.push([x, cyf + Math.sqrt(Math.max(0, Rf * Rf - x * x))]); }
  bot.push([-6.4, -4.9], [-8.2, -4.3], [xa, -2.8]);
  const outline = [...top, ...bot];
  const ext = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), { depth: W, bevelEnabled: false, curveSegments: 1 });
  ext.translate(0, 0, -HW);
  const [faces, sides] = splitGroups(ext);
  g.add(new THREE.Mesh(faces, mat(C.ashlar)), new THREE.Mesh(sides, mat(C.soffit)));
  // the deck: worn flags, two wheel grooves packed with mud, moss along the parapets' feet
  const DX: number[] = []; for (let x = xa; x <= xe + 0.01; x += 2.5) DX.push(x);
  const deckStrip = (z0: number, z1: number, dy: number, c: string) => {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i + 1 < DX.length; i++) { const a = DX[i], b = DX[i + 1], ya = deckY(a, mx) + dy, yb = deckY(b, mx) + dy; v.push(V(a, ya, z0), V(a, ya, z1), V(b, yb, z1), V(a, ya, z0), V(b, yb, z1), V(b, yb, z0)); }
    return new THREE.Mesh(upTris(v), mat(c));
  };
  g.add(deckStrip(-6.6, 6.6, 0.02, C.deck));
  for (const s of [-1, 1]) g.add(deckStrip(s * 2.2, s * 3.1, 0.05, C.groove), deckStrip(s * 6.1, s * 6.6, 0.04, C.moss));
  for (let i = 0; i < 9; i++) { const x = lerp(xa + 4, xe - 4, hash(i, 71)), s = i % 2 ? 1 : -1; g.add(flat(blobPts(0.5 + hash(i, 72) * 0.7, i, 2.2, 7).map(([a, b]) => [a + x, b + s * 2.65] as P2), deckY(x, mx) + 0.075, C.grooveWet)); }
  // parapets: waist-high, a coping on top, stones gone here and there, moss and stains
  const n = Math.round((xe - xa) / 2.5);
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const x0 = xa + (i * (xe - xa)) / n, x1 = x0 + (xe - xa) / n, xm = (x0 + x1) / 2, y0 = deckY(x0, mx), y1 = deckY(x1, mx), ym = (y0 + y1) / 2, sl = Math.atan2(y1 - y0, x1 - x0), len = (x1 - x0) / Math.cos(sl) + 0.05;
    const par = box(len, 3.0, 0.9, i % 4 === 1 ? C.ashlarDeep : C.ashlarPale, xm, ym + 1.5, s * (HW - 0.45)); par.rotation.z = sl; g.add(par);
    if (hash(i, s + 80) > 0.12) { const cop = box(len + 0.04, 0.35, 1.2, C.ashlarDeep, xm, ym + 3.17, s * (HW - 0.45)); cop.rotation.z = sl; g.add(cop); }
    if (hash(i, s + 81) > 0.72) g.add(box(len * (0.5 + hash(i, s + 3) * 0.7), 0.25, 0.1, C.moss, xm + (hash(i, s + 4) - 0.5), ym + 0.35, s * (HW + 0.02)));
    if (hash(i, s + 82) > 0.7) tuft(g, xm, ym + 0.02, s * (HW - 1.1), 0.9, [C.sedgeDry, C.sedge], i + s * 40, 4, 0.5, 0.08);
  }
  for (const x of [xa + 0.9, xe - 0.9]) for (const s of [-1, 1]) g.add(box(1.8, 4.0, 1.8, C.ashlarDeep, x, deckY(x, mx) + 1.9, s * (HW - 0.6)), box(2.1, 0.4, 2.1, C.ashlar, x, deckY(x, mx) + 4.0, s * (HW - 0.6)));
  // a string course under the parapets on both faces
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const x0 = xa + (i * (xe - xa)) / n, x1 = x0 + (xe - xa) / n, y0 = deckY(x0, mx), y1 = deckY(x1, mx), sl = Math.atan2(y1 - y0, x1 - x0);
    const sc = box((x1 - x0) / Math.cos(sl) + 0.05, 0.45, 0.4, C.ashlarDeep, (x0 + x1) / 2, (y0 + y1) / 2 - 0.45, s * (HW + 0.12)); sc.rotation.z = sl; g.add(sc);
  }
  // voussoir rings round both arches on both faces, a keystone at each crown
  const ringOf = (cx: number, ccy: number, r: number, a0: number, a1: number, nb: number, s: number) => {
    for (let k = 0; k < nb; k++) {
      const t = a0 + ((k + 0.5) / nb) * (a1 - a0), x = cx + Math.sin(t) * (r + 0.85), y = ccy + Math.cos(t) * (r + 0.85), key = k === Math.floor(nb / 2);
      const v = box(((a1 - a0) * r) / nb - 0.08, key ? 2.2 : 1.7, 0.32, k % 2 ? C.ashlarPale : C.ashlarDeep, x, y, s * (HW + 0.14)); v.rotation.z = -t; g.add(v);
    }
  };
  const am = Math.asin(25 / R), af = Math.asin(6 / Rf);
  for (const s of [-1, 1]) { ringOf(mx, cy, R, -am, am, 29, s); ringOf(0, cyf, Rf, -af, af, 9, s); }
  // cutwaters on the upstream (north, -z) face at the main arch's west springing and the east abutment
  const cutwater = (xc0: number, y0: number, y1: number, half: number, depth: number) => {
    const sh = new THREE.Shape([new THREE.Vector2(xc0 - half, HW - 0.1), new THREE.Vector2(xc0 + half, HW - 0.1), new THREE.Vector2(xc0, HW + depth)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
    // after the turn the triangle lies in x / -y_shape: (x, y0..y1, -(HW + depth)) — the upstream face
    const [f, sd] = splitGroups(geo); g.add(new THREE.Mesh(f, mat(C.ashlarDeep)), new THREE.Mesh(sd, mat(C.ashlar)));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), mat(C.ashlarDeep)); cap.scale.set(half * 1.15, 1.8, depth * 0.85);
    cap.position.set(xc0, y1 + 0.9, -(HW + depth * 0.42)); cap.rotation.y = Math.PI; g.add(cap);
  };
  cutwater(31, wy - 1, -3.6, 4, 4.5); cutwater(81.5, wy - 1, -5, 3, 3.2);
  // the wet stone at the waterline: dark moss and weeping stains down both faces
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [[ma0 - 2, ma0 + 6], [ma1 - 6, ma1 + 2]]) g.add(box(x1 - x0, 1.6, 0.12, C.mossDark, (x0 + x1) / 2, wy + 1.0, s * (HW + 0.08)));
    for (let i = 0; i < 10; i++) { const x = lerp(xa + 3, xe - 3, hash(i, s + 90)), h = 1.2 + hash(i, s + 91) * 2.2; g.add(box(0.22 + hash(i, s + 92) * 0.25, h, 0.08, C.ashlarWet, x, deckY(x, mx) - 1.0 - h / 2, s * (HW + 0.07))); }
  }
  // the causeways: raised gravel banks with a stone-faced batter, kerbs on top, the grooves running on, black-water ditches
  const cause = (x0: number, x1: number, y0: number, y1: number) => {
    const xs: number[] = [], ys: number[] = [], m = Math.max(2, Math.round(Math.abs(x1 - x0) / 3));
    for (let i = 0; i <= m; i++) { const t = i / m; xs.push(lerp(x0, x1, t)); ys.push(lerp(y0, y1, t)); }
    const yb = ys.map(() => 0);
    // the batter from the ground up to the top edge: drawn from the ground (y 0) at its foot
    const v: THREE.Vector3[] = [], vt: THREE.Vector3[] = [];
    for (let i = 0; i + 1 < xs.length; i++) for (const s of [-1, 1]) {
      const a = V(xs[i], yb[i] - 0.05, s * 10.6), b = V(xs[i], ys[i] - 0.1, s * 7.7), c = V(xs[i + 1], yb[i + 1] - 0.05, s * 10.6), e = V(xs[i + 1], ys[i + 1] - 0.1, s * 7.7);
      v.push(a, b, e, a, e, c);
    }
    for (let i = 0; i + 1 < xs.length; i++) { const a = V(xs[i], ys[i], -7.7), b = V(xs[i], ys[i], 7.7), c = V(xs[i + 1], ys[i + 1], -7.7), e = V(xs[i + 1], ys[i + 1], 7.7); vt.push(a, b, e, a, e, c); }
    g.add(new THREE.Mesh(upTris(v), mat(C.kerbDark)), new THREE.Mesh(upTris(vt), mat(C.gravel)));
    const yAt = (x: number) => lerp(y0, y1, (x - x0) / (x1 - x0));
    for (const s of [-1, 1]) {
      for (let x = Math.min(x0, x1) + 0.6; x < Math.max(x0, x1); x += 1.25) if (hash(Math.round(x * 3), s + 100) > 0.08) g.add(box(1.0, 0.32, 0.7, hash(Math.round(x * 3), s + 101) > 0.5 ? C.kerb : C.kerbDark, x, yAt(x) + 0.1, s * 7.25, (hash(Math.round(x), s) - 0.5) * 0.3));
      const gv: THREE.Vector3[] = [];
      for (let i = 0; i + 1 < xs.length; i++) { const a = V(xs[i], ys[i] + 0.04, s * 2.2), b = V(xs[i], ys[i] + 0.04, s * 3.1), c = V(xs[i + 1], ys[i + 1] + 0.04, s * 2.2), e = V(xs[i + 1], ys[i + 1] + 0.04, s * 3.1); gv.push(a, b, e, a, e, c); }
      g.add(new THREE.Mesh(upTris(gv), mat(C.groove)));
      // the ditch beside it, black water and reeds
      g.add(flat([[x0, s * 11.2], [x1, s * 11.2], [x1, s * 14.2], [x0, s * 14.2]], 0.03, C.ditch));
      for (let k = 0; k < 4; k++) { const xx = lerp(x0, x1, 0.12 + k * 0.24 + hash(k, s) * 0.08), L = 4 + hash(k, s + 3) * 7; g.add(flat([[xx - L / 2, s * 11.9], [xx + L / 2, s * 11.7], [xx + L / 2 - 1, s * 13.4], [xx - L / 2 + 1, s * 13.6]], 0.05, C.ditchWater)); }
      for (let k = 0; k < 6; k++) tuft(g, lerp(x0, x1, hash(k, s + 7)), 0.03, s * (11 + hash(k, s + 8) * 3.6), 2.6, [C.reed, C.reedDry], k * 9 + s, 6, 0.8, 0.1);
    }
    // gravel crumbs on the top
    for (let i = 0; i < Math.abs(x1 - x0) * 3; i++) { const x = lerp(x0, x1, hash(i, 110)), z = (hash(i, 111) - 0.5) * 13; g.add(box(0.25 + hash(i, 112) * 0.3, 0.12, 0.2 + hash(i, 113) * 0.3, i % 3 ? C.gravelDark : C.gravelPale, x, yAt(x) + 0.05, z, hash(i, 114) * 3)); }
  };
  cause(xw, xa, 0.25, 0.6); cause(xe, xc, 0.6, 0.2);
  // ravens on the parapet's coping
  const rv: [number, number, number, number][] = [[46, -1, 3.3, 0], [49.5, -1, 1.2, 1], [62, -1, 2.9, 0], [70, 1, 0.3, 0]];
  for (const [x, s, ry, fl] of rv.slice(0, d.ravens ?? 0)) g.add(place(ravenPerched({ flap: fl }), x, deckY(x, mx) + 3.36, s * (HW - 0.45), ry));
  return g;
}

// ---------------------------------------------------------------- under the bridge
/** The gravel shoal under the main arch's west footing: a low bar standing out of knee-deep water (the water at +0.15
 *  over this piece's floor), a drowned alder snag caught on its upstream end, dead leaves drifted behind it. */
export function gravelShoal(): THREE.Group {
  const g = grp(), outer: P2[] = [[-10, -26], [7, -22], [12, -2], [9, 22], [-6, 25], [-11, 2]];
  const ring = (k: number, y: number) => outer.map(([x, z], i) => V(x * k + (hash(i, 5) - 0.5) * k, y, z * k));
  const R = [ring(1.18, -0.45), ring(1.0, 0.12), ring(0.78, 0.45), ring(0.45, 0.68)], ctr = V(-1, 0.72, 0), v: THREE.Vector3[] = [], vt: THREE.Vector3[] = [];
  for (let r = 0; r + 1 < R.length; r++) for (let i = 0; i < outer.length; i++) { const j = (i + 1) % outer.length; (r === 0 ? v : vt).push(R[r][i], R[r + 1][i], R[r + 1][j], R[r][i], R[r + 1][j], R[r][j]); }
  for (let i = 0; i < outer.length; i++) vt.push(ctr, R[3][i], R[3][(i + 1) % outer.length]);
  g.add(new THREE.Mesh(upTris(v), mat(C.bankMud)), new THREE.Mesh(upTris(vt), mat(C.silt)));
  for (let i = 0; i < 160; i++) { const x = (hash(i, 1) - 0.5) * 20, z = (hash(i, 2) - 0.5) * 46; if (!inPoly(x, z, outer.map(([a, b]) => [a * 0.92, b * 0.92] as P2))) continue; g.add(place(lump(0.2 + hash(i, 3) * 0.45, i % 3 ? C.pebble : i % 2 ? C.pebbleDark : C.gravel, i, 1.3, 0.55, 1, 0), x, 0.35 + hash(i, 4) * 0.3, z, hash(i, 5) * 3)); }
  // the snag: a bleached alder, root plate up on the bar's north end, trunk out across the current
  const root = V(-2, 1.4, -21);
  g.add(place(lump(2.3, C.alderDark, 4, 1.0, 1.0, 0.35, 1), root.x, root.y, root.z, 0.4, 0, 0));
  const tipT = V(14, -0.2, -33);
  g.add(rod(V(root.x + 0.6, 0.55, root.z - 0.6), tipT, 0.6, 0.32, C.alder, 7));
  for (let i = 0; i < 6; i++) { const t = 0.3 + i * 0.11, p = V(lerp(root.x, tipT.x, t), lerp(0.55, -0.2, t), lerp(root.z, tipT.z, t)); g.add(rod(p, V(p.x + (hash(i, 7) - 0.3) * 5, p.y + 1 + hash(i, 8) * 3, p.z + (hash(i, 9) - 0.5) * 6), 0.18, 0.06, i % 2 ? C.alder : C.alderDark, 5)); }
  // the leaf drift on the upstream side of the snag
  g.add(flat(blobPts(5.5, 3, 1.6, 12).map(([a, b]) => [a + 6, b - 31] as P2), 0.2, C.leavesDark), flat(blobPts(3, 5, 1.4, 9).map(([a, b]) => [a + 3, b - 28] as P2), 0.22, C.leaves));
  for (let i = 0; i < 8; i++) g.add(rod(V(-1 + hash(i, 20) * 12, 0.24, -34 + hash(i, 21) * 8), V(1 + hash(i, 22) * 12, 0.24, -32 + hash(i, 23) * 6), 0.07, 0.05, C.alderDark, 4));
  return g;
}
/** A rotted willow fish trap on its side against the stone, a coil of line and an iron hook beside it. */
export function fishTrap(): THREE.Group {
  const g = grp(), L = 3.2;
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) continue;   // rotted through
    const a = (i / 9) * Math.PI * 2, p0 = V(-L / 2, 0.75 + Math.cos(a) * 0.7, Math.sin(a) * 0.7), p1 = V(L / 2, 0.75 + Math.cos(a) * 0.25, Math.sin(a) * 0.25);
    g.add(rod(p0, p1, 0.05, 0.04, i % 2 ? C.willow : C.willowRot, 4));
  }
  for (const [x, r] of [[-1.5, 0.72], [-0.2, 0.52], [1.2, 0.32]] as [number, number][]) { const h = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 4, 10), mat(C.willowRot)); h.rotation.y = Math.PI / 2; h.position.set(x, 0.75, 0); g.add(h); }
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 4, 12), mat(C.line)); coil.rotation.x = Math.PI / 2; coil.position.set(0.6, 0.08, 1.3); g.add(coil);
  g.add(box(0.06, 0.06, 0.4, C.iron, 1.1, 0.06, 1.5), box(0.06, 0.25, 0.06, C.iron, 1.1, 0.15, 1.7));
  return g;
}
/** The flood mark on the upstream cutwater (origin at the cutwater's tip, the bridge's face +z of it): a scored line
 *  round both faces six feet over the water, a chiselled notch at the tip, dead reed jammed in the joints at that height. */
export function floodMark(): THREE.Group {
  const g = grp();
  for (const s of [-1, 1]) {
    const L = Math.hypot(4, 4.5), a = Math.atan2(4.5, s * 4), b = box(L, 0.16, 0.12, C.crack, (s * 4) / 2 + s * 0.06, 0, 4.5 / 2 - 0.06, -a);
    g.add(b);
    for (let k = 0; k < 4; k++) { const t = 0.15 + k * 0.22, x = s * 4 * t + s * 0.12, z = 4.5 * t - 0.05; const r = box(0.06, 0.06, 0.9 + hash(k, s) * 0.6, C.reedDry, x, 0.25 + hash(k, s + 1) * 0.2, z); r.rotation.set(0.2, -a + Math.PI / 2, (hash(k, s + 2) - 0.5) * 0.8); g.add(r); }
  }
  const n1 = box(0.1, 0.7, 0.1, C.crack, -0.14, 0.15, -0.02); n1.rotation.z = 0.4; const n2 = box(0.1, 0.7, 0.1, C.crack, 0.14, 0.15, -0.02); n2.rotation.z = -0.4; g.add(n1, n2);
  return g;
}

// ---------------------------------------------------------------- the crossing
/** The snapped signpost's lower half: a 6-in oak post splintered off about four feet up, leaning 25 deg toward local +x
 *  out of its packing of field stones, an old iron band near its foot. */
export function signpostStub(): THREE.Group {
  const g = grp(), post = grp();
  post.add(box(0.5, 3.7, 0.5, C.oak, 0, 1.85, 0), box(0.54, 0.22, 0.54, C.rust, 0, 0.9, 0));
  for (let i = 0; i < 6; i++) { const sp = cone(0.07 + hash(i, 1) * 0.06, 0.5 + hash(i, 2) * 0.7, i % 2 ? C.splinter : C.oak, (hash(i, 3) - 0.5) * 0.36, 3.85 + hash(i, 4) * 0.2, (hash(i, 5) - 0.5) * 0.36, 4); sp.rotation.set((hash(i, 6) - 0.5) * 0.5, 0, (hash(i, 7) - 0.5) * 0.5); post.add(sp); }
  post.add(box(0.46, 0.08, 0.46, C.splinter, 0, 3.72, 0));
  post.rotation.z = -0.436; g.add(post);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + hash(i, 9), r = 0.75 + hash(i, 10) * 0.35; g.add(place(lump(0.35 + hash(i, 11) * 0.25, i % 2 ? C.fieldStone : C.fieldStoneDark, i, 1.2, 0.7, 1, 0), Math.cos(a) * r, 0.16, Math.sin(a) * r, hash(i, 12) * 3)); }
  tuft(g, -0.9, 0, 0.6, 2.2, [C.nettle, C.thistle], 3, 5, 0.6, 0.1);
  return g;
}
/** One carved arm of the signpost (pointing local +x): a board with a pointed end, its painted letters flaking. */
function signArm(seed: number, cracked = false): THREE.Group {
  const g = grp(), L = 3.3;
  const board = (x0: number, x1: number, dz = 0, dy = 0) => g.add(box(x1 - x0, 0.62, 0.16, C.oak, (x0 + x1) / 2, dy, dz));
  if (cracked) { board(0.25, 1.4); board(1.48, L - 0.3, 0.02, 0.05); g.add(box(0.1, 0.64, 0.17, C.splinter, 1.44, 0.02, 0)); } else board(0.25, L - 0.3);
  const tip = box(0.44, 0.44, 0.16, C.oak, L - 0.3, cracked ? 0.05 : 0, 0); tip.rotation.z = Math.PI / 4; g.add(tip);
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) if (hash(k, seed + s) > 0.3) g.add(box(0.2 + hash(k, seed + 5) * 0.16, 0.24, 0.02, k % 3 ? C.paint : C.paintGrey, 0.6 + k * 0.33, (hash(k, seed + 7) - 0.5) * 0.06, s * 0.09));
  return g;
}
/** The signpost's upper half: a short shaft with a capped top and four carved arms. Lying face-up in the weeds (one arm
 *  cracked and cocked at the sky, one driven into the turf); with `rejoined` 1 the whole post set right on its stub, the
 *  arms along the plan bearings `a0`..`a3`. */
export function signpostCrown(d: Dims): THREE.Group {
  const g = grp();
  if (d.rejoined) {
    g.add(box(0.5, 4.0, 0.5, C.oak, 0, 2.0, 0), box(0.5, 3.6, 0.5, C.oakDark, 0, 5.8, 0), box(0.56, 0.08, 0.56, C.splinter, 0, 4.02, 0));
    const capR = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), mat(C.oakDark)); place(capR, 0, 7.95, 0, Math.PI / 4); g.add(capR);
    for (let i = 0; i < 4; i++) { const b = ((d['a' + i] ?? i * 90) * Math.PI) / 180, arm = signArm(i * 7, false); place(arm, 0, 7.2 - i * 0.78, 0, Math.atan2(Math.cos(b), Math.sin(b))); g.add(arm); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = 0.8; g.add(place(lump(0.35, i % 2 ? C.fieldStone : C.fieldStoneDark, i, 1.2, 0.7, 1, 0), Math.cos(a) * r, 0.16, Math.sin(a) * r)); }
    return g;
  }
  const shaft = grp(box(3.6, 0.5, 0.5, C.oakDark, 0, 0, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), mat(C.oakDark)); cap.rotation.set(Math.PI / 4, 0, -Math.PI / 2); cap.position.set(2.15, 0, 0); shaft.add(cap);
  for (let i = 0; i < 5; i++) { const sp = cone(0.08, 0.6, C.splinter, -1.85, (hash(i, 1) - 0.5) * 0.35, (hash(i, 2) - 0.5) * 0.35, 4); sp.rotation.z = Math.PI / 2 + (hash(i, 3) - 0.5) * 0.5; shaft.add(sp); }
  // arms round the shaft: flat to +z, flat to -z, one driven into the turf, the cracked one cocked up at the sky
  const flatArm = (arm: THREE.Group, x: number, toward: number) => { arm.rotation.x = Math.PI / 2; const o = grp(arm); place(o, x, -0.05, toward * 0.25, -toward * Math.PI / 2); shaft.add(o); };
  flatArm(signArm(1), 1.5, 1); flatArm(signArm(2), 0.9, -1);
  const a2 = signArm(3); a2.scale.x = 0.45; place(a2, 0.3, -0.2, 0, 0, 0, -Math.PI / 2 - 0.3); shaft.add(a2);
  const a3 = signArm(4, true); place(a3, -0.3, 0.2, 0.05, 0, 0, Math.PI / 2 - 0.35); shaft.add(a3);
  shaft.position.y = 0.32; shaft.rotation.x = 0.06; g.add(shaft);
  for (let i = 0; i < 7; i++) tuft(g, (hash(i, 20) - 0.5) * 6, 0, (hash(i, 21) - 0.5) * 6, 2.4, [C.nettle, C.dock, C.thistle], i * 5, 4, 0.6, 0.1);
  return g;
}
/** The weed wedge between the two eastern roads (polygon `n`/`x`/`z`): nettle, dock and dead thistle, a paler wash of
 *  dry grass under them, and the furrow (line `f`) flattened through it from the stump to the Berez trail. */
export function weedTriangle(d: Dims): THREE.Group {
  const g = grp(), poly = dimsLine(d), fur = dimsLine(d, 'f'), sd = d.seed ?? 1;
  if (poly.length < 3) return g;
  g.add(flat(poly, 0.02, C.weedTint));
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]), X0 = Math.min(...xs), X1 = Math.max(...xs), Z0 = Math.min(...zs), Z1 = Math.max(...zs);
  let placed = 0;
  for (let i = 0; i < 1600 && placed < 330; i++) {
    const x = lerp(X0, X1, hash(i, sd)), z = lerp(Z0, Z1, hash(i, sd + 1));
    if (!inPoly(x, z, poly) || (fur.length > 1 && lineDist(x, z, fur) < 1.8)) continue;
    placed++;
    const t = hash(i, sd + 2);
    if (t < 0.45) tuft(g, x, 0, z, 3.0 + hash(i, 3) * 1.4, [C.nettle, C.sedge], i, 6, 1.1, 0.16);
    else if (t < 0.75) {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + hash(i, 4), lf = box(1.3, 0.08, 0.5, k % 4 === 3 ? C.dockRust : C.dock, x + Math.cos(a) * 0.65, 0.25 + k * 0.05, z + Math.sin(a) * 0.65); lf.rotation.set(0, -a, 0.35); g.add(lf); }
      g.add(rod(V(x, 0, z), V(x + 0.2, 3 + hash(i, 5), z + 0.1), 0.06, 0.04, C.dockRust, 4));
    } else {
      const h = 3 + hash(i, 6) * 1.2; g.add(rod(V(x, 0, z), V(x + (hash(i, 7) - 0.5) * 0.6, h, z), 0.07, 0.04, C.thistle, 4), place(lump(0.24, C.thistleHead, i, 1, 0.9, 1, 0), x + (hash(i, 7) - 0.5) * 0.6, h + 0.1, z));
      for (let k = 0; k < 3; k++) { const lf = cone(0.12, 1.0, C.thistle, x, 0.9 + k * 0.6, z, 3); lf.rotation.set(0, k * 2.1, 1.1); g.add(lf); }
    }
  }
  if (fur.length > 1) {
    const D = densify(fur, 2);
    g.add(new THREE.Mesh(band(D, () => -1.3, () => 1.3, () => 0.04), mat(C.hayDark)), new THREE.Mesh(band(D, () => 1.3, () => 1.9, () => 0.035), mat(C.mud)), new THREE.Mesh(band(D, () => -1.9, () => -1.3, () => 0.035), mat(C.mud)));
    for (let i = 0; i < D.length * 2; i++) { const q = D[Math.floor(hash(i, 30) * D.length)], o = (hash(i, 31) - 0.5) * 2.2; const st = box(1.8 + hash(i, 32), 0.05, 0.06, i % 2 ? C.strawFlat : C.thistle, q.p[0] + q.n[0] * o, 0.08, q.p[1] + q.n[1] * o); st.rotation.y = Math.atan2(-q.t[1], q.t[0]) + (hash(i, 33) - 0.5) * 0.8; g.add(st); }
  }
  return g;
}
/** Oversized wolf prints in the furrow mud: pairs down both edges of the line `n`/`x`/`z`, a ring of them at its start. */
export function wolfPrints(d: Dims): THREE.Group {
  const g = grp(), L = dimsLine(d), D = L.length > 1 ? densify(L, 3.2) : [];
  const print = (x: number, z: number, a: number) => {
    const pad = flat(blobPts(0.26, 1, 1.25, 7), 0, C.print); pad.position.set(x, 0.09, z); pad.rotation.y = a; g.add(pad);
    for (let k = 0; k < 4; k++) { const tx = 0.42, tz = (k - 1.5) * 0.17; g.add(flat(blobPts(0.09, k, 1, 5).map(([p, q]) => [p + x + Math.cos(-a) * tx - Math.sin(-a) * tz, q + z + Math.sin(-a) * tx + Math.cos(-a) * tz] as P2), 0.09, C.print)); }
  };
  D.forEach((q, i) => { for (const s of [-1, 1]) if (hash(i, s + 5) > 0.25) print(q.p[0] + q.n[0] * s * (1.5 + hash(i, s) * 0.4), q.p[1] + q.n[1] * s * (1.5 + hash(i, s) * 0.4), Math.atan2(-q.t[1], q.t[0]) + (hash(i, s + 9) - 0.5) * 0.4); });
  if (L.length) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; print(L[0][0] + Math.cos(a) * 3.2, L[0][1] + Math.sin(a) * 2.6, a + Math.PI / 2); }
  return g;
}
/** The wolf-skull pine: an old pine (dims as the kit pine) with a column of a dozen wolf skulls nailed up its trunk on its
 *  local +z face, the highest still in its hide, knife-notch tallies scored in rows beside them. */
function trunkR(y: number, sc: number) { const h = 26 * sc; return Math.max(0.2, 0.8 * sc - 0.35 * sc * (y / (h * 0.34))); }
function wolfSkull(seed: number, wet = false): THREE.Group {
  const k = grp(place(lump(0.38, wet ? C.skullShade : C.skull, seed, 1.0, 0.8, 1.1, 1), 0, 0, 0.1), place(lump(0.2, wet ? C.skullShade : C.skull, seed + 1, 0.9, 0.7, 1.6, 0), 0, -0.12, 0.55));
  for (const s of [-1, 1]) k.add(box(0.12, 0.1, 0.06, C.socket, s * 0.16, 0.06, 0.42));
  k.add(box(0.06, 0.06, 0.2, C.iron, 0, 0.12, 0.42));
  if (wet) k.add(place(lump(0.25, C.blood, seed + 2, 1.2, 0.5, 1.0, 0), 0, -0.25, 0.15));
  return k;
}
export function wolfSkullPine(d: Dims): THREE.Group {
  const sc = d.scale ?? 1.75, g = pine({ h: 26, r: 6, scale: sc });
  for (let i = 0; i < 12; i++) {
    const y = 2.6 + i * 0.95, r = trunkR(y, sc), sk = wolfSkull(i * 3 + 1); sk.position.set((hash(i, 2) - 0.5) * 0.3, y, r + 0.3); sk.rotation.set(0.25, 0, (hash(i, 3) - 0.5) * 0.3); g.add(sk);
    if (i === 11) { g.add(place(lump(0.6, C.hide, 9, 1.1, 0.9, 0.5, 1), 0, y + 0.05, r + 0.55), cone(0.12, 0.35, C.hideDark, -0.22, y + 0.5, r + 0.5, 4), cone(0.12, 0.35, C.hideDark, 0.22, y + 0.5, r + 0.5, 4), place(lump(0.35, C.hideDark, 4, 0.8, 1.6, 0.3, 0), 0, y - 0.6, r + 0.45)); }
  }
  for (let row = 0; row < 7; row++) for (let k = 0; k < 6; k++) {
    if (hash(row * 7 + k, 4) < 0.18) continue;
    const y = 3.2 + row * 1.35, x = 0.5 + k * 0.13, r = trunkR(y, sc), zz = Math.sqrt(Math.max(0.01, r * r - x * x));
    const m = box(0.05, k === 5 ? 0.75 : 0.38, 0.05, C.notch, k === 5 ? 0.78 : x, y, zz + 0.01); if (k === 5) m.rotation.z = 1.1; g.add(m);
  }
  for (let i = 0; i < 5; i++) { const a = hash(i, 8) * Math.PI * 2, y = 4 + i * 1.6, r = trunkR(y, sc); g.add(rod(V(Math.cos(a) * r, y, Math.sin(a) * r), V(Math.cos(a) * (r + 1.4 + hash(i, 9) * 1.2), y - 0.8, Math.sin(a) * (r + 1.4 + hash(i, 9) * 1.2)), 0.14, 0.06, C.deadBough, 4)); }
  return g;
}
/** The pine's lean, as the kit pine draws it from its size: the fresh skull below leans with its tree. */
function pineLean(sc: number): [number, number] {
  const h = 26 * sc, r = 6 * sc, seed = Math.floor(Math.abs(Math.sin(h * 91.7 + r * 13.1)) * 1000);
  return [(((seed >> 3) % 7) - 3) * 0.012, ((seed % 7) - 3) * 0.012];
}
/** A fresh wolf skull just nailed at the top of the pine's column, still wet, and bright new notches beside it. */
export function freshSkull(d: Dims): THREE.Group {
  const sc = d.scale ?? 1.75, g = grp(), inner = grp(), [lx, lz] = pineLean(sc), y = 14.3, r = trunkR(y, sc);
  const sk = wolfSkull(77, true); sk.position.set(0.1, y, r + 0.3); sk.rotation.x = 0.2; inner.add(sk);
  for (let k = 0; k < 5; k++) { const x = -0.6 - k * 0.12, zz = Math.sqrt(Math.max(0.01, r * r - x * x)); inner.add(box(0.06, 0.42, 0.06, C.paint, x, y + 0.2, zz + 0.02)); }
  inner.rotation.set(lx, 0, lz); g.add(inner);
  return g;
}
/** A roadside pine: the kit pine with dead grey lower boughs and broken stubs on its trunk. */
export function gauntPine(d: Dims): THREE.Group {
  const g = pine(d), sc = d.scale ?? 1, seed = Math.round(sc * 977);
  for (let i = 0; i < 7; i++) {
    const a = hash(i, seed) * Math.PI * 2, y = (3 + i * 1.1) * sc, r = trunkR(y, sc), L = (1.6 + hash(i, seed + 1) * 2.6) * sc;
    g.add(rod(V(Math.cos(a) * r * 0.8, y, Math.sin(a) * r * 0.8), V(Math.cos(a) * (r + L), y - L * 0.45, Math.sin(a) * (r + L)), 0.1 * sc, 0.035, C.deadBough, 4));
  }
  return g;
}
/** The smashed wine cask in the ditch (local x along the road, the bank up toward +z, the road at -z): a burst cask, a
 *  cart's tailboard, a hoop and staves strewn up the bank, a wine stain, a wheel gouge torn into the verge. */
function stave(x: number, y: number, z: number, ry: number, rx: number, c: string): THREE.Mesh { const s = box(0.38, 0.1, 2.4, c, x, y, z, ry); s.rotation.x = rx; s.scale.set(1, 1, 1); return s; }
export function wineCaskWreck(): THREE.Group {
  const g = grp();
  g.add(flat(blobPts(2.6, 3, 1.6, 10).map(([a, b]) => [a + 0.5, b - 1.2] as P2), 0.06, C.wine), flat(blobPts(1.6, 5, 1.4, 8).map(([a, b]) => [a + 2.6, b - 0.4] as P2), 0.065, C.wineDry));
  // the cask on its side, burst open along its top
  const cask = grp();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2; if (a > 0.3 && a < 1.9) continue;
    const st = box(0.42, 0.1, 2.5, i % 3 ? C.cask : C.caskDark, Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0); st.rotation.z = a + Math.PI / 2; cask.add(st);
  }
  for (const z of [-0.9, 0.9]) { const h = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 4, 14), mat(C.iron)); h.position.z = z; cask.add(h); }
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 12), mat(C.caskDark)); head.rotation.x = Math.PI / 2; head.position.z = -1.22; cask.add(head);
  place(cask, 0.6, 0.85, -1.0, 0.3, 0, 0.2); g.add(cask);
  // the tailboard, iron-strapped, nose-down in the ditch
  const tb = grp(box(6, 1.6, 0.22, C.board, 0, 0, 0)); for (const x of [-2.3, 2.3]) tb.add(box(0.2, 1.62, 0.26, C.iron, x, 0, 0)); tb.add(box(5.8, 0.1, 0.24, C.caskDark, 0, 0.3, 0));
  place(tb, -4.2, 0.55, -1.8, 0.15, 1.15, 0.12); g.add(tb);
  // a hoop up the bank, staves scattered, a broken spoke
  const hp = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 4, 14), mat(C.rust)); hp.rotation.x = Math.PI / 2 - 0.1; hp.position.set(3.6, 0.1, 4.6); g.add(hp);
  for (let i = 0; i < 7; i++) g.add(stave(-3 + hash(i, 1) * 9, 0.08, 0.8 + hash(i, 2) * 6.5, hash(i, 3) * 3, 0, i % 2 ? C.cask : C.caskDark));
  g.add(rod(V(-1.5, 0.1, 2.4), V(0.8, 0.3, 3.4), 0.09, 0.07, C.board, 5));
  // the gouge: raw earth torn from the road edge into the ditch, turf lumps thrown up beside it
  g.add(flat([[-9, -4.6], [-6, -4.0], [-2.5, -2.4], [-1.5, -1.4], [-3, -1.9], [-6.6, -3.4], [-9.4, -4.0]], 0.08, C.earthRaw));
  for (let i = 0; i < 5; i++) g.add(place(lump(0.45 + hash(i, 5) * 0.3, C.turf, i, 1.4, 0.5, 1, 0), -8 + i * 1.5, 0.12, -2.3 + hash(i, 6) * 0.8));
  return g;
}
/** A carter's purse and a burned stave: a leather pouch, three copper coins, the winery's mark on a stave end. */
export function coinPouch(): THREE.Group {
  const g = grp(place(lump(0.32, C.hideDark, 3, 1.2, 0.7, 1, 1), 0, 0.2, 0), box(0.1, 0.1, 0.4, C.hide, 0.1, 0.4, 0));
  for (let i = 0; i < 3; i++) g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 8), mat(C.lichenOchre)), 0.5 + i * 0.18, 0.04, 0.2 - i * 0.1));
  g.add(stave(-0.8, 0.08, 0.6, 0.6, 0, C.cask), box(0.3, 0.02, 0.3, C.socket, -0.7, 0.14, 1.4));
  return g;
}

// ---------------------------------------------------------------- the roads
/** The hard road's verges along the centreline `n`/`x`/`z` (half-width `hw`): cobble edging along both edges with
 *  stones gone here and there, loose gravel on the surface, and (unless `ditch` is 0) a ditch outside each edge holding
 *  black water and fallen needles. */
export function roadVerge(d: Dims): THREE.Group {
  const g = grp(), L = dimsLine(d), hw = d.hw ?? 10, sd = d.seed ?? 1; if (L.length < 2) return g;
  const D = densify(L, 1.15);
  D.forEach((q, i) => {
    for (const s of [-1, 1]) {
      if (hash(i, sd + s) < 0.07) continue;
      const o = s * (hw - 0.55 + (hash(i, sd + s + 2) - 0.5) * 0.25);
      g.add(box(0.95, 0.3, 0.72, hash(i, sd + s + 4) > 0.5 ? C.kerb : C.kerbDark, q.p[0] + q.n[0] * o, 0.17, q.p[1] + q.n[1] * o, Math.atan2(-q.t[1], q.t[0]) + (hash(i, sd + s + 6) - 0.5) * 0.25));
    }
    for (let k = 0; k < 2; k++) { const o = (hash(i * 2 + k, sd + 9) - 0.5) * (hw * 1.7); g.add(box(0.28 + hash(i, k + 3) * 0.3, 0.06, 0.24 + hash(i, k + 4) * 0.3, (i + k) % 3 ? C.gravelDark : C.gravelPale, q.p[0] + q.n[0] * o + q.t[0] * hash(i, k), 0.11, q.p[1] + q.n[1] * o + q.t[1] * hash(i, k), hash(i, k + 5) * 3)); }
  });
  if (d.ditch !== 0) {
    const DD = densify(L, 6);
    for (const s of [-1, 1]) {
      g.add(new THREE.Mesh(band(DD, (i) => s * (hw + 0.7 + hash(i, s) * 0.3), (i) => s * (hw + 4.0 + hash(i, s + 1) * 0.6), () => 0.03), mat(C.ditch)));
      DD.forEach((q, i) => {
        if (hash(i, sd + s + 20) < 0.45) { const o = s * (hw + 2.4), pts = blobPts(1.1, i, 2.6, 8); g.add(flat(pts.map(([a, b]) => [q.p[0] + q.n[0] * (o + b * 0.5) + q.t[0] * a, q.p[1] + q.n[1] * (o + b * 0.5) + q.t[1] * a] as P2), 0.05, C.ditchWater)); }
        if (hash(i, sd + s + 21) < 0.5) { const o = s * (hw + 1.2 + hash(i, s + 22) * 2.6); g.add(box(0.5, 0.04, 0.35, C.needle, q.p[0] + q.n[0] * o, 0.06, q.p[1] + q.n[1] * o, hash(i, 23) * 3)); }
      });
    }
  }
  return g;
}
/** Wheel ruts along `n`/`x`/`z`, gauge ±`g`. mode 0: the hard road's grooves, mud pooling in them; 1: the cart-track's,
 *  turf between and needles in them; 2: old hay-cart ruts on the terrace, standing water in them; 3: the swerve through the X. */
export function wheelRuts(d: Dims): THREE.Group {
  const g = grp(), L = dimsLine(d), mode = d.mode ?? 0, ga = d.g ?? 2.6, sd = d.seed ?? 1; if (L.length < 2) return g;
  const D = densify(L, 3), w = mode === 2 ? 0.55 : 0.45, y = mode === 1 ? 0.1 : 0.12;
  const col = mode === 0 ? C.groove : mode === 1 ? C.duff : mode === 2 ? C.mud : C.grooveWet;
  for (const s of [-1, 1]) {
    const wob = (i: number) => s * ga + (hash(i, sd + s) - 0.5) * 0.25;
    g.add(new THREE.Mesh(band(D, (i) => wob(i) - w, (i) => wob(i) + w, () => y), mat(col)));
    D.forEach((q, i) => {
      const pool = mode === 2 ? hash(i, sd + s + 3) < 0.55 : mode === 1 ? false : hash(i, sd + s + 3) < 0.12;
      if (pool) { const o = wob(i), pts = blobPts(0.45, i, mode === 2 ? 4.2 : 2.8, 7); g.add(flat(pts.map(([a, b]) => [q.p[0] + q.n[0] * (o + b * 0.6) + q.t[0] * a, q.p[1] + q.n[1] * (o + b * 0.6) + q.t[1] * a] as P2), y + 0.02, mode === 2 ? C.pool : C.ditchWater)); }
      if (mode === 1 && hash(i, sd + s + 5) < 0.4) g.add(box(0.4, 0.03, 0.3, C.needle, q.p[0] + q.n[0] * wob(i), y + 0.02, q.p[1] + q.n[1] * wob(i), hash(i, 6) * 3));
    });
  }
  if (mode === 3) g.add(new THREE.Mesh(band(D, () => -ga - 1.6, () => ga + 1.6, () => 0.09), mat(C.mud)));
  return g;
}
/** The sunken lane's bank along `n`/`x`/`z` (its foot at the lane's edge), rising on side `side` (±1, along the left
 *  normal): a root-bound earth face `h` ft high (ramping up over the first `ramp` ft), a needled crest, a long back
 *  slope into the wood; pine roots loop out of the face, stones show in it, moss on its lip. */
export function hollowLaneBank(d: Dims): THREE.Group {
  const g = grp(), L = dimsLine(d), side = d.side ?? 1, H = d.h ?? 3.6, ramp = d.ramp ?? 60, sd = d.seed ?? 1; if (L.length < 2) return g;
  const D = densify(L, 3), prof: [number, number][] = [[-0.4, 0.02], [0.5, 0.55], [1.1, 0.95], [2.2, 1.0], [4.5, 0.85], [13, -0.06]];
  const hAt = (i: number) => H * Math.min(1, 0.18 + D[i].s / ramp) * (0.88 + 0.24 * hash(i, sd));
  const P = (i: number, k: number) => { const o = side * prof[k][0], y = prof[k][1] < 0 ? prof[k][1] : hAt(i) * prof[k][1]; return V(D[i].p[0] + D[i].n[0] * o, y, D[i].p[1] + D[i].n[1] * o); };
  const faceV: THREE.Vector3[] = [], topV: THREE.Vector3[] = [], backV: THREE.Vector3[] = [];
  for (let i = 0; i + 1 < D.length; i++) for (let k = 0; k + 1 < prof.length; k++) {
    const a = P(i, k), b = P(i, k + 1), c = P(i + 1, k), e = P(i + 1, k + 1), list = k < 2 ? faceV : k < 4 ? topV : backV;
    list.push(a, c, b, b, c, e);
  }
  // the face is near-vertical: wind it to look back at the lane; the rest look up
  const faceT: THREE.Vector3[] = [];
  for (let i = 0; i < faceV.length; i += 3) {
    // the lane lies on the -side of the bank: each face's normal should point back at it
    const a = faceV[i], b = faceV[i + 1], c = faceV[i + 2], nrm = b.clone().sub(a).cross(c.clone().sub(a)), k = Math.min(D.length - 1, Math.floor(i / 12));
    if (-side * (nrm.x * D[k].n[0] + nrm.z * D[k].n[1]) < 0) faceT.push(a, c, b); else faceT.push(a, b, c);
  }
  g.add(new THREE.Mesh(tris(faceT), mat(C.bankEarth)), new THREE.Mesh(upTris(topV), mat(C.duff)), new THREE.Mesh(upTris(backV), mat(C.duffDark)));
  D.forEach((q, i) => {
    const h = hAt(i), ox = q.n[0] * side, oz = q.n[1] * side, at = (o: number, y: number, a = 0) => V(q.p[0] + ox * o + q.t[0] * a, y, q.p[1] + oz * o + q.t[1] * a);
    if (h > 1.2 && hash(i, sd + 3) < 0.75) { const y0 = h * (0.45 + hash(i, sd + 4) * 0.35); g.add(rod(at(0.75, y0 + 0.5, -0.6), at(0.05, y0, 0.2), 0.12, 0.09, C.root, 5), rod(at(0.05, y0, 0.2), at(0.35, y0 - 0.7, 1.1), 0.09, 0.06, i % 2 ? C.root : C.rootPale, 5)); }
    if (hash(i, sd + 5) < 0.2) g.add(place(lump(0.3 + hash(i, 6) * 0.25, C.fieldStoneDark, i, 1.2, 0.8, 0.8, 0), q.p[0] + ox * 0.55, h * 0.35, q.p[1] + oz * 0.55));
    if (hash(i, sd + 7) < 0.5) g.add(place(lump(0.45, C.moss, i, 1.6, 0.4, 1.0, 0), q.p[0] + ox * 1.4, h * 0.98, q.p[1] + oz * 1.4));
    if (hash(i, sd + 8) < 0.3) tuft(g, q.p[0] + ox * 2.6, h * 0.95, q.p[1] + oz * 2.6, 1.3, [C.sedgeDry, C.nettle], i + sd, 4, 0.5, 0.08);
  });
  return g;
}
/** Corduroy: pine logs laid side by side across a bog, `len` ft along local x, `w` wide; half sunk, slick, some gone,
 *  moss on their uphill (+z) ends; black water in the gaps and pools in the mud either side. */
export function corduroyLogs(d: Dims): THREE.Group {
  const g = grp(), L = d.len ?? 80, Wd = d.w ?? 8, sd = d.seed ?? 1;
  g.add(flat(blobPts(1, sd, 1, 14).map(([a, b]) => [a * (L / 2 + 8), b * (Wd / 2 + 7)] as P2), 0.035, C.bog));
  for (let i = 0; i < 10; i++) { const x = (hash(i, sd + 1) - 0.5) * L, s = i % 2 ? 1 : -1; g.add(flat(blobPts(1.2 + hash(i, 2) * 1.8, i, 1.8, 8).map(([a, b]) => [a + x, b + s * (Wd / 2 + 2 + hash(i, 3) * 3)] as P2), 0.05, C.bogWater)); }
  const n = Math.round(L / 0.95);
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n);
    if (hash(i, sd + 4) < 0.06) { g.add(flat([[x - 0.45, -Wd / 2], [x + 0.45, -Wd / 2], [x + 0.45, Wd / 2], [x - 0.45, Wd / 2]], 0.06, C.bogWater)); continue; }
    const r = 0.38 + hash(i, sd + 5) * 0.12, len = Wd * (hash(i, sd + 6) < 0.08 ? 0.55 : 0.92 + hash(i, sd + 7) * 0.18), zc = (hash(i, sd + 8) - 0.5) * 0.8 + (len < Wd * 0.7 ? -Wd * 0.2 : 0);
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 7), mat(i % 4 === 0 ? C.bark : C.log)); lg.rotation.set(Math.PI / 2, 0, 0); lg.rotation.z = (hash(i, sd + 9) - 0.5) * 0.12; lg.position.set(x, r * 0.35 - hash(i, 10) * 0.15, zc); g.add(lg);
    g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.05, 7), mat(C.logEnd)), x, r * 0.35 - hash(i, 10) * 0.15, zc - len / 2 - 0.02, 0, Math.PI / 2));
    if (hash(i, sd + 11) < 0.7) g.add(place(lump(r * 1.1, C.logMoss, i, 0.9, 0.6, 1.6, 0), x, r * 0.6, zc + len / 2 - 0.5));
  }
  for (let i = 0; i < 14; i++) tuft(g, (hash(i, 40) - 0.5) * L, 0.03, (i % 2 ? 1 : -1) * (Wd / 2 + 1 + hash(i, 41) * 4), 2.0, [C.sedge, C.reedDry], i * 3, 5, 0.7, 0.1);
  return g;
}

// ---------------------------------------------------------------- the terrace
/** A reed hollow: a ragged pool of black water `r` ft across (or, `water` 0, dry silt) with `n` clumps of reeds and a
 *  few cattails round it. */
export function reedHollow(d: Dims): THREE.Group {
  const g = grp(), r = d.r ?? 6, n = d.n ?? 12, sd = d.seed ?? 1;
  g.add(flat(blobPts(r, sd, 1.3, 12), 0.04, d.water === 0 ? C.silt : C.poolRim));
  if (d.water !== 0) g.add(flat(blobPts(r * 0.72, sd + 3, 1.3, 11), 0.06, C.pool));
  for (let i = 0; i < n; i++) {
    const a = hash(i, sd + 1) * Math.PI * 2, k = r * (0.45 + hash(i, sd + 2) * 0.65), x = Math.cos(a) * k * 1.3, z = Math.sin(a) * k;
    tuft(g, x, 0.03, z, 3.4 + hash(i, sd + 3) * 2, [C.reed, C.reedDry, C.reed], i * 7 + sd, 7, 1.0, 0.1);
    if (hash(i, sd + 4) < 0.3) { const h = 4.2 + hash(i, 5); g.add(rod(V(x + 0.3, 0, z), V(x + 0.35, h, z + 0.1), 0.04, 0.03, C.reed, 3), place(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 5), mat(C.cattail)), x + 0.35, h - 0.3, z + 0.1)); }
  }
  return g;
}
/** The hay meadow on the terrace: tussocks scattered over the polygon `n`/`x`/`z`, never on the road (`r` line), in the
 *  gully, or within the circles `cx{i}`,`cz{i}`,`cr{i}`. */
export function hayMeadow(d: Dims): THREE.Group {
  const g = grp(), poly = dimsLine(d), road = dimsLine(d, 'r'), cn = d.cn ?? 0, count = d.count ?? 400, sd = d.seed ?? 1;
  if (poly.length < 3) return g;
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]), X0 = Math.min(...xs), X1 = Math.max(...xs), Z0 = Math.min(...zs), Z1 = Math.max(...zs);
  // the meadow's mottle: wetter dark swales and paler dry knolls under the tussocks
  for (let i = 0; i < 46; i++) {
    const x = lerp(X0 + 20, X1 - 20, hash(i, sd + 50)), z = lerp(Z0 + 20, Z1 - 20, hash(i, sd + 51));
    if (!inPoly(x, z, poly) || (road.length > 1 && lineDist(x, z, road) < 22)) continue;
    g.add(flat(blobPts(9 + hash(i, sd + 52) * 16, i, 1.3 + hash(i, 53), 12).map(([a, b]) => [a + x, b + z] as P2), 0.012 + (i % 3) * 0.002, i % 3 ? '#383f31' : '#474c38'));
  }
  let placed = 0;
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const x = lerp(X0, X1, hash(i, sd)), z = lerp(Z0, Z1, hash(i, sd + 1));
    if (!inPoly(x, z, poly) || (road.length > 1 && lineDist(x, z, road) < 17)) continue;
    if (d.gx0 !== undefined && x > d.gx0 - 2 && x < (d.gx1 ?? 0) + 2 && z > (d.gz0 ?? 0) - 2 && z < (d.gz1 ?? 0) + 2) continue;
    let skip = false; for (let k = 0; k < cn; k++) if (Math.hypot(x - d[`cx${k}`], z - d[`cz${k}`]) < d[`cr${k}`]) skip = true;
    if (skip) continue;
    placed++;
    const t = hash(i, sd + 2), cols = t < 0.4 ? [C.tussock, C.tussockPale] : t < 0.75 ? [C.tussock, C.tussockGreen] : [C.tussockGreen, C.sedge];
    tuft(g, x, 0, z, 1.6 + hash(i, sd + 3) * 1.8, cols, i, 5 + (i % 3), 1.8, 0.26);
  }
  return g;
}
/** Last season's hay rick, grey and slumped, its thatch cap slid off beside it, a pitchfork stuck in its side. */
export function hayRick(): THREE.Group {
  const g = grp(place(lump(6, C.hay, 4, 1.0, 0.68, 0.92, 2), 0, 2.6, 0), place(lump(4.2, C.hayDark, 7, 1.1, 0.55, 1.0, 1), 1.2, 4.6, -0.6, 0.6));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(place(lump(1.4 + hash(i, 1), i % 2 ? C.hay : C.hayDark, i, 1.6, 0.35, 1.2, 0), Math.cos(a) * 6.4, 0.25, Math.sin(a) * 5.8, a)); }
  for (let i = 0; i < 6; i++) { const a = hash(i, 3) * Math.PI * 2; g.add(box(0.5, 2.2, 0.1, C.hayStreak, Math.cos(a) * 5.4, 2.6, Math.sin(a) * 5.0, -a + Math.PI / 2)); }
  const capM = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.2, 9), mat(C.thatch)); place(capM, 7.6, 1.6, 3.2, 0.4, 0.3, 1.2); g.add(capM);
  const fork = grp(box(0.16, 6.2, 0.16, C.fork, 0, 3.1, 0), box(0.9, 0.12, 0.12, C.iron, 0, 0.1, 0)); for (const x of [-0.38, 0, 0.38]) fork.add(box(0.07, 1.2, 0.07, C.iron, x, -0.5, 0));
  place(fork, -4.3, 2.8, 2.6, 0.3, -0.55, 0.65); g.add(fork);
  return g;
}
/** A grey wolf skinned for its pelt (head toward local +x): flayed body, ribs showing, the head and paws still furred, two
 *  crossbow bolts in its ribs, in a stain of trampled mud ringed with big paw prints. */
export function wolfCarcass(): THREE.Group {
  const g = grp(flat(blobPts(4.6, 2, 1.3, 12), 0.03, C.mud), flat(blobPts(2.2, 4, 1.4, 9), 0.045, C.blood));
  g.add(place(lump(1.05, C.flesh, 3, 1.9, 0.52, 0.72, 1), 0, 0.55, 0), place(lump(0.6, C.fascia, 5, 1.6, 0.4, 0.6, 0), -0.3, 0.88, -0.2));
  for (let i = 0; i < 6; i++) g.add(box(0.12, 0.08, 1.2, C.fascia, -0.9 + i * 0.32, 0.72, 0.25, 0.1));
  g.add(place(lump(0.5, C.fur, 6, 1.2, 0.8, 0.8, 1), 2.3, 0.55, 0.1), place(lump(0.28, C.furDark, 7, 1.6, 0.6, 0.7, 0), 2.95, 0.42, 0.15), cone(0.14, 0.4, C.furDark, 2.15, 1.0, -0.15, 4), cone(0.14, 0.4, C.furDark, 2.15, 1.0, 0.3, 4));
  for (const [x, z] of [[1.4, 0.7], [1.6, -0.6], [-1.5, 0.8], [-1.7, -0.5]] as P2[]) g.add(rod(V(x * 0.7, 0.5, z * 0.5), V(x, 0.25, z * 1.2), 0.13, 0.1, C.fleshDark, 5), place(lump(0.2, C.fur, x * 10, 1.3, 0.7, 1, 0), x * 1.05, 0.18, z * 1.25));
  for (const [x, a] of [[-0.2, 0.5], [0.5, -0.3]] as P2[]) { const b = grp(box(0.06, 1.5, 0.06, C.bolt, 0, 0.75, 0), box(0.02, 0.35, 0.22, C.fletch, 0, 1.4, 0)); place(b, x, 0.8, 0.45, 0, a + 0.8, 0.3); g.add(b); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + hash(i, 9) * 0.3, r = 5.2 + hash(i, 10) * 2.2, x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r, ang = a + Math.PI / 2;
    g.add(flat(blobPts(0.3, i, 1.2, 7).map(([p, q]) => [p + x, q + z] as P2), 0.06, C.print));
    for (let k = 0; k < 4; k++) { const tx = 0.48, tz = (k - 1.5) * 0.19; g.add(flat(blobPts(0.1, k, 1, 5).map(([p, q]) => [p + x + Math.cos(ang) * tx - Math.sin(ang) * tz, q + z + Math.sin(ang) * tx + Math.cos(ang) * tz] as P2), 0.06, C.print)); }
  }
  return g;
}
/** A raven (facing local +x): folded and hunched, or with `flap` 1 its wings half open. */
export function ravenPerched(d: Dims): THREE.Group {
  const g = grp(place(lump(0.32, C.raven, 3, 1.5, 0.9, 0.85, 1), 0, 0.42, 0), place(lump(0.19, C.raven, 4, 1, 1, 1, 0), 0.42, 0.72, 0));
  g.add(cone(0.07, 0.32, C.beak, 0.7, 0.7, 0, 4).rotateZ(-Math.PI / 2), box(0.55, 0.06, 0.26, C.ravenSheen, -0.55, 0.38, 0));
  for (const z of [-0.09, 0.09]) g.add(box(0.04, 0.3, 0.04, C.beak, 0.02, 0.12, z));
  if (d.flap) for (const s of [-1, 1]) { const w = box(0.8, 0.05, 1.1, C.ravenSheen, -0.05, 0.62, s * 0.62); w.rotation.x = s * -0.6; g.add(w); }
  else for (const s of [-1, 1]) g.add(box(0.7, 0.18, 0.08, C.ravenSheen, -0.1, 0.5, s * 0.25));
  return g;
}
/** The slogan board at the causeway's end: a weathered painted board on a post leaning toward the road (local +z), its
 *  pale ground and dark-red letters half flaked away. */
export function sloganBoard(): THREE.Group {
  const g = grp(box(0.45, 7.0, 0.45, C.post, 0, 3.5, 0)), b = grp(box(5.2, 1.8, 0.16, C.boardBare, 0, 0, 0));
  for (let i = 0; i < 9; i++) if (hash(i, 1) > 0.25) b.add(box(0.5 + hash(i, 2) * 0.9, 1.5, 0.02, C.boardPaint, -2.2 + i * 0.55, (hash(i, 3) - 0.5) * 0.1, 0.09));
  for (let r = 0; r < 2; r++) for (let k = 0; k < 11; k++) if (hash(r * 13 + k, 4) > 0.42) b.add(box(0.22, 0.42, 0.02, C.slogan, -2.15 + k * 0.42, 0.35 - r * 0.7, 0.1));
  place(b, 0, 5.5, 0.3, 0, 0.14, 0.06); g.add(b, box(0.08, 0.08, 0.3, C.iron, 0, 5.5, 0.25));
  for (let i = 0; i < 5; i++) g.add(place(lump(0.4, C.fieldStoneDark, i, 1.2, 0.7, 1, 0), Math.cos(i * 1.3) * 0.7, 0.18, Math.sin(i * 1.3) * 0.7));
  return g;
}

// ---------------------------------------------------------------- hidden things
/** Eye-shine among the trees after dark: `n` pairs of pale green-gold points along local z over `span` ft. */
export function eyeShine(d: Dims): THREE.Group {
  const g = grp(), n = d.n ?? 5, span = d.span ?? 200, m = mat(C.eye, { emissive: '#8a9030' });
  for (let i = 0; i < n; i++) {
    const z = (i / Math.max(1, n - 1) - 0.5) * span + (hash(i, 1) - 0.5) * 20, x = (hash(i, 2) - 0.5) * 12, y = 2.8 + hash(i, 3) * 1.2;
    for (const s of [-1, 1]) g.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), m), x - 0.3, y, z + s * 0.28));
  }
  return g;
}
/** A steel-jawed hunting trap set under the needles, its chain run to a stake. */
export function huntingTrap(): THREE.Group {
  const g = grp(flat(blobPts(1.8, 2, 1.2, 9), 0.04, C.needle));
  const base = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 4, 14), mat(C.rust)); base.rotation.x = Math.PI / 2; base.position.y = 0.1; g.add(base);
  for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 4, 10, Math.PI), mat(C.iron)); j.rotation.set(s * 0.5, 0, 0); j.position.y = 0.12; g.add(j); for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI; g.add(cone(0.05, 0.18, C.iron, Math.cos(a) * 0.7, 0.12 + Math.sin(a) * 0.7 * Math.cos(0.5), s * Math.sin(a) * 0.7 * Math.sin(0.5), 3)); } }
  for (let k = 0; k < 6; k++) g.add(box(0.18, 0.06, 0.1, C.iron, 0.9 + k * 0.2, 0.05, 0.1 * (k % 2)));
  g.add(box(0.12, 0.9, 0.12, C.oakDark, 2.2, 0.25, 0));
  return g;
}

// ---------------------------------------------------------------- figures
/** A skeleton in rags on a warhorse skeleton (both facing local +x), an unlit lantern held up. */
export function skeletalRider(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp(), h = horse({ bone: 1, scale: s });
  g.add(h);
  for (const z of [-1, 1]) for (let i = 0; i < 6; i++) g.add(box(0.16 * s, 1.0 * s, 0.05, C.socket, (-1.2 + i * 0.45) * s, 5.6 * s, z * 1.36 * s));
  const rider = humanoid({ skin: '#d6cdb6', cloth: C.rag, trim: C.ragPale, hunch: 0.15, scale: s });
  rider.position.set(-0.2 * s, 4.55 * s, 0); rider.rotation.y = Math.PI / 2; g.add(rider);
  g.add(box(0.16 * s, 2.2 * s, 0.16 * s, C.ragPale, 0.3 * s, 10.3 * s, -0.95 * s), box(0.5 * s, 0.7 * s, 0.5 * s, C.lantern, 0.4 * s, 11.7 * s, -1.0 * s), box(0.36 * s, 0.5 * s, 0.36 * s, C.glassDark, 0.4 * s, 11.7 * s, -1.0 * s));
  return g;
}
const zombieFig = (d: Dims) => {
  const v = d.v ?? 0, g = humanoid({ skin: v === 1 ? '#8f9a80' : '#8a9a7c', cloth: v === 2 ? '#3f3a32' : '#4a4238', trim: '#3b352c', hunch: 0.4, scale: d.scale ?? 1 });
  g.rotation.z = (v - 1) * 0.05; return g;
};
const strahdZombieFig = (d: Dims) => {
  const s = d.scale ?? 1, g = humanoid({ skin: '#8f9a86', cloth: '#3a2e2a', trim: '#2a211e', hunch: 0.5, claws: true, scale: s });
  for (let i = 0; i < 4; i++) g.add(box(0.9 * s, 0.05 * s, 0.05 * s, C.stitch, 0, (3.4 + i * 0.5) * s, 0.48 * s));
  g.add(box(0.05 * s, 0.05 * s, 0.6 * s, C.stitch, 0, 5.25 * s, 0.1 * s));
  return g;
};
const vistaniFig = (d: Dims) => {
  const v = d.v ?? 0, s = d.scale ?? 1, cloth = [C.vCloth0, C.vCloth1, C.vCloth2][v % 3];
  const g = humanoid({ skin: C.skin, cloth, trim: '#3b2d22', hair: '#1a1410', weapon: v === 0 ? 'sword' : 'none', scale: s });
  g.add(cyl(0.47 * s, 0.47 * s, 0.3 * s, C.scarf, 0, 5.9 * s, -0.02 * s, 8), cyl(0.66 * s, 0.66 * s, 0.25 * s, C.sash, 0, 3.27 * s, 0, 8));
  if (v === 1) g.add(box(0.08 * s, 0.08 * s, 0.5 * s, C.pipe, 0.1 * s, 5.55 * s, 0.6 * s));
  if (v === 2) g.add(place(lump(0.35 * s, C.hideDark, 2, 1, 1.3, 0.7, 0), -0.75 * s, 3.4 * s, 0.25 * s));
  return g;
};
/** A swarm of bats: a cloud of small dark winged shapes about 10 ft across. */
export function batSwarm(d: Dims): THREE.Group {
  const g = grp(), s = d.scale ?? 1;
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 5 * s, y = (1 + hash(i, 3) * 5) * s, b = grp(place(lump(0.16, C.bat, i, 1.4, 0.8, 0.8, 0), 0, 0, 0));
    for (const z of [-1, 1]) { const w = box(0.5, 0.03, 0.55, C.batWing, 0, 0.05, z * 0.32); w.rotation.x = z * (0.3 + hash(i, 4) * 0.8); b.add(w); }
    place(b, Math.cos(a) * r, y, Math.sin(a) * r, hash(i, 5) * 6); g.add(b);
  }
  return g;
}

// ---------------------------------------------------------------- registration
const P_PROPS: Record<string, (d: Dims) => THREE.Object3D> = {
  'p-knoll': knoll, 'p-rock-outcrop': rockOutcrop, 'p-luna-bridge': lunaBridge, 'p-gravel-shoal': gravelShoal, 'p-fish-trap': fishTrap, 'p-flood-mark': floodMark,
  'p-signpost-stub': signpostStub, 'p-signpost-crown': signpostCrown, 'p-weed-triangle': weedTriangle, 'p-wolf-prints': wolfPrints, 'p-wolf-skull-pine': wolfSkullPine,
  'p-fresh-skull': freshSkull, 'p-gaunt-pine': gauntPine, 'p-wine-cask-wreck': wineCaskWreck, 'p-coin-pouch': coinPouch, 'p-road-verge': roadVerge, 'p-wheel-ruts': wheelRuts,
  'p-hollow-lane-bank': hollowLaneBank, 'p-corduroy-logs': corduroyLogs, 'p-reed-hollow': reedHollow, 'p-hay-meadow': hayMeadow, 'p-hay-rick': hayRick,
  'p-wolf-carcass': wolfCarcass, 'p-raven-perched': ravenPerched, 'p-slogan-board': sloganBoard, 'p-eye-shine': eyeShine, 'p-hunting-trap': huntingTrap,
};
// everything collapses to a mesh per material; the trench keeps its sentinel (it cuts the land beyond the map) apart
Object.assign(PROPS_V1, Object.fromEntries(Object.entries(P_PROPS).map(([k, f]) => [k, (d: Dims) => compact(f(d))])));
Object.assign(PROPS_V1, {
  'p-river-trench': (d: Dims) => {
    const raw = riverTrench(d), clip = raw.children.find((c) => c.userData.pClip);
    if (clip) raw.remove(clip);
    const out = compact(raw); if (clip) out.add(clip); return out;
  },
});
Object.assign(CREATURES, {
  'p-skeletal-rider': (d: Dims) => compact(skeletalRider(d)), 'p-zombie': (d: Dims) => compact(zombieFig(d)), 'p-strahd-zombie': (d: Dims) => compact(strahdZombieFig(d)),
  'p-vistani-bandit': (d: Dims) => compact(vistaniFig(d)), 'p-bat-swarm': (d: Dims) => compact(batSwarm(d)),
} as Record<string, (d: Dims) => THREE.Group>);
