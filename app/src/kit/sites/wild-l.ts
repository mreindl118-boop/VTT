// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'l-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// L, Lake Zarovich: the south-shore landing north of Vallaki. Black still water with a pale pebble shelf that ends in
// one hard line, a shingle strip with the fishers' boats, a rocky knoll whose bluff drops into deep water, and a mist
// lid lying on the lake. Pieces drawn over the lake's floor sit under the grid's lift (0.04 ft) so the squares stay.
// Shape-driven pieces take a polyline in their dims as `n`, `x0`,`z0`, ... in feet relative to the piece's own position.
import * as THREE from 'three';
import { PROPS_V1, pine } from '../props';
import { CREATURES } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { merge } from '../pieces';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Dims = Record<string, number>;
type P2 = [number, number];

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  ink: '#0f1418', deep: '#141b20', fade1: '#1f2a32', fade2: '#2d3d48', fade3: '#3e5260', deep2: '#182128', sheen: '#26313a', sheen2: '#33404a', cloud: '#4a5762', ring: '#45535e',
  shelf: '#4f5a5c', shelfPale: '#5f696a', lip: '#7c8486', pebble: '#7a7d78', pebble2: '#686c6b', pebble3: '#8b8a82', pebbleWet: '#565c5e',
  shingle: '#6e6d68', shingle2: '#7d7b74', shingleDark: '#55544f', mud: '#5a554c', mudDark: '#3a332c', scale: '#c3ccd0',
  stake: '#4a3d31', stakeTop: '#2f2924', rope: '#8a7a5c', ropeDark: '#6b5e46', cord: '#9a9078', hook: '#3a3b40', bread: '#b49a6a',
  bark: '#45362a', barkWorn: '#6f604f', barkWet: '#2e2720', root: '#3e3128', rootEarth: '#4a3f33', needleBrown: '#5a4a32',
  board: '#6f6a60', boardDark: '#58534b', tar: '#3a3631', netDark: '#4a453d', cork: '#a8916a', bucket: '#5a4a38',
  fish: '#7b7a6c', fishBurnt: '#1d1a19', fishSplit: '#8c5a3e', nail: '#2e2f33',
  slab: '#6a6a66', slabTop: '#727068', stain: '#3b2a26', knifeHandle: '#d6ccb4', blade: '#8c8f93',
  bone: '#d8cfb8', boneGrey: '#a9a393', boneDark: '#8a8476', fly: '#2a2a2e',
  pike: '#4b3c2e', skull: '#e2d9c2', skullShade: '#bdb39d', wire: '#3a3b40', board2: '#5d4d3c', paint: '#7a1f2b', paintPale: '#9c8a68',
  blaze: '#b9a782', blazeLip: '#7d6a4c', cloth: '#6e5a5a', clothFade: '#8a7d72',
  tooth: '#2a2a2c', toothDark: '#1e1e20', weed: '#2f3a26', weedSlick: '#3c4a2c', bleach: '#a8a59a', iron: '#2e2f33', rust: '#5a3a2a', guano: '#cfcabc',
  rock: '#5a5853', rockDeep: '#4b4945', rockPale: '#6c6a64', lichen: '#6f7457', lichenPale: '#8a8a6a', moss: '#38432f', mossDeep: '#2b3526',
  turf: '#3d5241', turfDry: '#4d5a3f', duff: '#4a4234',
  plank: '#5b5245', plankMoss: '#45503a', stone: '#6a6862', brook: '#3a4a52', brookPale: '#58707c', brookBed: '#6f7069', foam: '#c9d2d6',
  drift: '#a49d8c', driftDeep: '#8a8373', jug: '#7a5a3e', jugDark: '#5e432e', bobbin: '#6b4a33',
  offer: '#5d5c57', copper: '#4f7a62', copperPale: '#6f9a80', ribbon: '#7a2a32', charm: '#c8c1ae',
  burlap: '#8f7d58', burlapWet: '#5f5340', bubble: '#aebcc4', twine: '#6e5f45',
  pole: '#7a6248', line: '#b9b4a6', float: '#c9b893', floatRed: '#8a3a32',
  silt: '#3c3a33', siltPale: '#4a473e', siltDark: '#2e2c27', murk: '#2b3a36', shaft: '#6f8f7a', logBlack: '#2a241e', logGrey: '#3a352e',
  skiff: '#3e3428', skiffDark: '#2c251d', anchor: '#3b2b22', clay: '#6e5038',
  crate: '#5a4c3c', crateRot: '#40382d', mist0: '#dcdee2', mist1: '#c7cad0',
  heron: '#d2cbb8', reedDry: '#857b4c', crag: '#686761', cragLichen: '#6e7258', cragDeep: '#56554f', cragPale: '#75736b', drowned: '#10140f',
  cane: '#a39a76', coat: '#4a4236', coatDark: '#3a342b', breeches: '#3b352c', skin: '#c99a84', hair: '#4a3a2a', hat: '#2f2b26', boot: '#2b2420',
} as const;
surfaceFor([C.fade1, C.fade2, C.fade3, C.ink, C.deep, C.deep2, C.sheen, C.sheen2, C.cloud, C.ring, C.brook, C.brookPale, C.bubble, C.foam, C.mist0, C.mist1, C.shaft, C.murk], 'none');
surfaceFor([C.lip, C.pebble, C.pebble2, C.pebble3, C.pebbleWet, C.brookBed], 'rubble');
surfaceFor([C.shelf, C.shelfPale], 'dirt');          // silt and grit under clear water: the pebbles are pieces of their own
surfaceFor([C.crag, C.cragLichen, C.cragDeep, C.cragPale], 'stone');        // the knoll's bare crown: weathered rock, not laid stones
surfaceFor([C.shingle, C.shingle2, C.shingleDark], 'dirt');
surfaceFor([C.mud, C.mudDark, C.rootEarth, C.duff, C.silt, C.siltPale, C.siltDark, C.needleBrown], 'dirt');
surfaceFor([C.stake, C.stakeTop, C.board, C.boardDark, C.bucket, C.plank, C.pike, C.board2, C.crate, C.crateRot, C.skiff, C.skiffDark, C.pole, C.bobbin, C.cane], 'wood');
surfaceFor([C.coat, C.coatDark, C.breeches, C.hat], 'cloth');
surfaceFor([C.skin, C.hair, C.boot], 'generic');
surfaceFor([C.bark, C.barkWorn, C.barkWet, C.root, C.logBlack, C.logGrey], 'bark');
surfaceFor([C.drift, C.driftDeep, C.blaze, C.blazeLip], 'wood');
surfaceFor([C.rope, C.ropeDark, C.cord, C.tar, C.netDark, C.cloth, C.clothFade, C.ribbon, C.burlap, C.burlapWet, C.twine, C.line], 'cloth');
surfaceFor([C.rock, C.rockDeep, C.rockPale, C.tooth, C.toothDark, C.slab, C.slabTop, C.offer, C.stone], 'rock');
surfaceFor([C.lichen, C.lichenPale, C.moss, C.mossDeep, C.weed, C.weedSlick, C.plankMoss, C.reedDry], 'foliage');
surfaceFor([C.turf, C.turfDry], 'grass');
surfaceFor([C.hook, C.nail, C.iron, C.rust, C.wire, C.blade, C.anchor, C.copper, C.copperPale], 'metal');
surfaceFor([C.fish, C.fishBurnt, C.fishSplit, C.scale, C.bone, C.boneGrey, C.boneDark, C.skull, C.skullShade, C.knifeHandle, C.stain, C.fly, C.paint, C.paintPale, C.bleach, C.guano,
  C.jug, C.jugDark, C.clay, C.charm, C.cork, C.float, C.floatRed, C.bread, C.heron], 'generic');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 7) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 6) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c)), x, y, z);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A faceted lump (a rock, a sack, a heap): an icosahedron pushed in and out, then squashed. */
function lump(r: number, color: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1, m?: THREE.Material): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, m ?? mat(color));
}
/** A polyline from dims: `n` points `x{i}`,`z{i}` (and `w{i}` where given). */
function dimsLine(d: Dims, p = ''): { pts: P2[]; w: number[] } {
  const n = d[p + 'n'] ?? 0, pts: P2[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) { pts.push([d[`${p}x${i}`] ?? 0, d[`${p}z${i}`] ?? 0]); w.push(d[`${p}w${i}`] ?? 0); }
  return { pts, w };
}
/** Split triangles until no edge is longer than `max` ft: the depth buffer is logarithmic, and a long sliver of a flat
 *  sheet laid a hair over another surface loses to it in places when its depth is only right at its corners. */
function tess(geo: THREE.BufferGeometry, max = 30): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo, p = src.attributes.position, out: number[] = [];
  const stack: THREE.Vector3[][] = [];
  for (let i = 0; i < p.count; i += 3) stack.push([0, 1, 2].map((k) => new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k))));
  while (stack.length) {
    const t = stack.pop()!, e = [t[0].distanceTo(t[1]), t[1].distanceTo(t[2]), t[2].distanceTo(t[0])], k = e.indexOf(Math.max(...e));
    if (e[k] <= max) { for (const v of t) out.push(v.x, v.y, v.z); continue; }
    const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3], m = a.clone().add(b).multiplyScalar(0.5);
    stack.push([a, m, c], [m, b, c]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals(); return g;
}
/** A flat polygon in the xz plane at height y, facing up. */
function flat(pts: P2[], y: number, m: THREE.Material, fine = true): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(fine ? tess(geo) : geo, m);
}
/** An invisible sentinel that shows or hides the land drawn round the map whenever its own level is drawn. The lakebed
 *  lies forty feet under the lake, below the land and water drawn beyond the map, which would cover it; while the
 *  lakebed is the level in view that scenery steps aside, and the shore level's sentinel brings it back. */
function backdropSwitch(show: boolean): THREE.Mesh {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -500, 0, 0, -500, 0, 0, -500, 0], 3));
  const m = new THREE.Mesh(geo, mat(C.siltDark)); m.frustumCulled = false;
  m.onBeforeRender = (renderer, scene, camera) => {
    const bd = scene.getObjectByName('backdrop'); if (!bd) return;
    if (!show && bd.visible) { bd.visible = false; bd.userData.lHidden = true; }
    else if (show && bd.userData.lHidden) { bd.visible = true; delete bd.userData.lHidden; }
    else return;
    requestAnimationFrame(() => renderer.render(scene, camera));
  };
  return m;
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
/** Points every `step` ft along a polyline, with unit tangent and interpolated width. */
function densify(pts: P2[], w: number[], step: number): { p: P2; t: P2; w: number }[] {
  const out: { p: P2; t: P2; w: number }[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(1, Math.round(L / step)), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (let s = 0; s < k; s++) { const f = s / k; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], t, w: lerp(w[i] ?? 0, w[i + 1] ?? 0, f) }); }
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  out.push({ p: [...b] as P2, t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], w: w[pts.length - 1] ?? 0 });
  for (let i = 1; i + 1 < out.length; i++) { const p = out[i - 1].t, q = out[i + 1].t, tx = p[0] + q[0], tz = p[1] + q[1], L2 = Math.hypot(tx, tz) || 1; out[i].t = [tx / L2, tz / L2]; }
  return out;
}
/** A flat ribbon along a polyline, `off0`..`off1` ft to the left of it (left = the tangent turned toward -x when it runs +z). */
function ribbon(D: { p: P2; t: P2; w: number }[], off0: (q: { w: number }, i: number) => number, off1: (q: { w: number }, i: number) => number, y: number): THREE.BufferGeometry {
  const v: THREE.Vector3[] = [];
  const at = (i: number, o: number) => { const q = D[i], nx = q.t[1], nz = -q.t[0]; return new THREE.Vector3(q.p[0] + nx * o, y, q.p[1] + nz * o); };
  for (let i = 0; i + 1 < D.length; i++) {
    const a0 = at(i, off0(D[i], i)), a1 = at(i, off1(D[i], i)), b0 = at(i + 1, off0(D[i + 1], i + 1)), b1 = at(i + 1, off1(D[i + 1], i + 1));
    v.push(a0, a1, b1, a0, b1, b0);
  }
  return upTris(v);
}
/** Collapse a piece to one mesh per material (hidden pieces and figures are not merged by the level), each keeping the
 *  latest draw order of the meshes it took in. */
function compact(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>(), order = new Map<THREE.Material, number>(), out = new THREE.Group();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
    order.set(mt, Math.max(order.get(mt) ?? 0, m.renderOrder));
  });
  for (const [mt, gs] of by) { const mesh = new THREE.Mesh(merge(gs), mt); mesh.renderOrder = order.get(mt) ?? 0; out.add(mesh); }
  return out;
}
/** Fog: lit, see-through, no depth writes, never under the fog of war (it reaches past the map); cached per colour and opacity. */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color, true); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** A ragged soft blob in the xz plane. */
function wisp(r: number, seed: number, sx = 1.5): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, k = r * (0.8 + 0.12 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 1.7)); pts.push([Math.cos(a) * k * sx, Math.sin(a) * k]); }
  return pts;
}
const ringGeo = (r0: number, r1: number, y: number, seg = 40) => { const g = new THREE.RingGeometry(r0, r1, seg); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };

// ---------------------------------------------------------------- the water
/** The water's sheets lie side by side at one height (`WATER_Y`, under the grid's lift), never stacked: a sheet a hair
 *  over another flickers at a distance. The drop line is cut into tiles shared by the shelf, the drop's lip and ink band,
 *  and the black water, all from one densified line so their edges meet exactly. Floors lie a hair under them, so close
 *  that far off their depths round to the same value and whichever is drawn later shows: every water sheet is drawn
 *  after the floors (`AFTER_FLOOR`), and anything resting on the water (rings, bubbles) sits at `RING_Y`,
 *  high enough over the black that it never rounds into it. The sheets lie level with the floor (which `stillFloor`
 *  silences), a full grid's lift under the squares and 0.05 ft over the grass laid under the whole map. */
const WATER_Y = 0, LIP = 1.2, INK0 = 0.6, INK1 = 3.8, AFTER_FLOOR = 1, RING_Y = 0.3;
/** The water's own sheets: drawn after everything solid (`AFTER_FLOOR`), tested as if a hair nearer than they are
 *  (one part in ten thousand of the distance, about a tenth of a foot from across the map) so the grass and floors laid
 *  under the whole map never come up through them, and leaving the depth as they found it, so the grid and anything
 *  low on the water still show over them while whatever is under the surface stays under it. */
const waterMats = new Map<string, THREE.MeshLambertMaterial>();
function waterMat(color: string): THREE.MeshLambertMaterial {
  let m = waterMats.get(color);
  if (m) return m;
  m = matClone(color); m.depthWrite = false;
  const compile = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    compile.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <logdepthbuf_fragment>', '#include <logdepthbuf_fragment>\n#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth * 0.9999 ) * logDepthBufFC * 0.5;\n#endif');
  };
  m.customProgramCacheKey = () => key.call(m) + ':l-water';
  waterMats.set(color, m);
  return m;
}
const dropLine = (d: Dims) => { const drop = dimsLine(d, 'd').pts; return drop.length > 1 ? densify(drop, drop.map(() => 0), 5) : []; };
const offsetPts = (D: { p: P2; t: P2 }[], o: number): P2[] => D.map((q) => [q.p[0] + q.t[1] * o, q.p[1] - q.t[0] * o] as P2);
const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
/** See-through sheets whose opacity is painted per vertex (fades with no edge): one material per colour, lit, never
 *  under the fog of war (they reach past the map). Their meshes are never merged with others (that drops the paint). */
const fadeMats = new Map<string, THREE.MeshLambertMaterial>();
function fadeMat(color: string): THREE.MeshLambertMaterial {
  let m = fadeMats.get(color);
  if (!m) { m = matClone(color, true); m.transparent = true; m.depthWrite = false; m.side = THREE.DoubleSide; m.vertexColors = true; fadeMats.set(color, m); }
  return m;
}
/** A flat lattice of quads over x0..x1 × z0..z1 (cells about `step` ft) at height y, each vertex's opacity from `alpha`;
 *  cells that are clear at all four corners are left out. */
function fadeGrid(x0: number, x1: number, z0: number, z1: number, step: number, y: number, alpha: (x: number, z: number) => number): THREE.BufferGeometry | null {
  const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step)), P: number[] = [], A: number[] = [];
  const at = (i: number, j: number): [number, number, number] => { const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz; return [x, z, alpha(x, z)]; };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
    if (Math.max(a[2], b[2], c[2], e[2]) < 0.004) continue;
    for (const v of [a, e, c, a, c, b]) { P.push(v[0], y, v[1]); A.push(1, 1, 1, v[2]); }
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(A, 4)); g.computeVertexNormals();
  return g;
}
/** The lake's own floor (the room's shallow-water slab) lies just under the water's sheets, which cover all of it; drawn
 *  as one long fan of slivers it comes up through them in streaks at a distance, its depth there worse than the hair
 *  between them. So once the water is drawn its level's lake floor stops painting (it stays for picking and the rules). */
const quiet = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function stillFloor(water: THREE.Mesh): void {
  water.frustumCulled = false;
  water.onBeforeRender = (renderer, scene, camera) => {
    let lv: THREE.Object3D | null = water.parent; while (lv && !lv.name.startsWith('level:')) lv = lv.parent;
    const floor = lv?.children.find((c) => c.name === 'floor:shallow-water') as THREE.Mesh | undefined;
    if (!floor || floor.material === quiet) return;
    floor.material = quiet;
    requestAnimationFrame(() => renderer.render(scene, camera));
  };
}
/** The still lake: the deep, ink-black water beyond the drop (`d` line, west to east) out to the outline `n`,`x{i}`,`z{i}`
 *  (from the drop's east end round the north to its west end), then `b` (the shore under the bluff, back toward the
 *  drop), the overcast sky laid on it in faint pale lenses. Past the map's edges (`mx0`,`mx1`,`mz0`; the shore at `sw`
 *  west and `se` east) the same black carries on and thins away over `fade` ft into the paler water drawn beyond the
 *  map, so the map's water is one piece with the lake rather than a dark box set in it. */
export function lakeMirror(d: Dims): THREE.Group {
  const outer = dimsLine(d).pts, bluff = dimsLine(d, 'b').pts, D = dropLine(d), g = grp();
  if (outer.length < 2 || D.length < 2) return g;
  const pts: P2[] = [...outer, ...bluff, ...offsetPts(D, INK1)];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const inPoly = (x: number, z: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
  // the sky laid on the water: long thin lenses across the lake, none touching another
  const bands: P2[][] = [], boxes: number[][] = [];
  for (let i = 0; i < 40 && bands.length < 16; i++) {
    const cx = lerp(d.ux0 ?? x0, d.ux1 ?? x1, hash(i, 3)), cz = lerp(d.uz0 ?? z0, d.uz1 ?? z1 - 70, hash(i, 4)), L = 50 + hash(i, 5) * 130, w = 3 + hash(i, 6) * 7;
    if (![[cx - L / 2, cz], [cx + L / 2, cz], [cx, cz - w], [cx, cz + w]].every(([x, z]) => inPoly(x, z))) continue;
    if (boxes.some(([a, b, c, e]) => cx - L / 2 - 6 < c && cx + L / 2 + 6 > a && cz - w - 6 < e && cz + w + 6 > b)) continue;
    const band: P2[] = []; for (let k = 0; k <= 10; k++) { const t = k / 10; band.push([cx - L / 2 + t * L, cz - w * Math.sin(t * Math.PI) * (0.6 + 0.4 * hash(k, i))]); }
    for (let k = 9; k >= 1; k--) { const t = k / 10; band.push([cx - L / 2 + t * L, cz + w * 0.5 * Math.sin(t * Math.PI)]); }
    bands.push(band); boxes.push([cx - L / 2, cz - w, cx + L / 2, cz + w]);
  }
  const base = flat(pts, WATER_Y, waterMat(C.deep), false); base.renderOrder = AFTER_FLOOR; g.add(base); stillFloor(base);
  // the sky's sheen: faint veils over the black (see-through and not depth-writing, so they never fight it)
  bands.forEach((b, i) => { const v = flat(b, WATER_Y + 0.04, fogMat(C.cloud, i % 3 === 0 ? 0.32 : 0.22), false); v.renderOrder = 1; g.add(v); });
  // beyond the map: the black runs on past the west, north and east edges and thins to nothing over `fade` ft, its reach
  // wavering a little so the fade has no straight front; one lattice, the cells laid on the map's edge lines so the
  // strips meet without a seam
  if (d.mx1 !== undefined) {
    const X0 = d.mx0 ?? 0, X1 = d.mx1, Z0 = d.mz0 ?? 0, SW = d.sw ?? 0, SE = d.se ?? 0, R = d.fade ?? 480, S = 24, T = 96;
    const alpha = (x: number, z: number) => {
      const dx = Math.max(X0 - x, 0, x - X1), dz = Math.max(Z0 - z, 0), dist = Math.hypot(dx, dz);
      const reach = R * (0.82 + 0.1 * Math.sin(x * 0.006 + 1.3) + 0.08 * Math.sin(z * 0.011 + x * 0.004));
      const shore = x <= X0 ? SW : x >= X1 ? SE : Z0;   // past the side shores the black runs a little way on and thins out
      return Math.pow(1 - smooth(dist / reach), 1.4) * (1 - smooth((z - shore) / T));
    };
    const y = WATER_Y + 0.03;   // past the map the land drawn round it has an edge level with the map's own ground: stay over it
    const parts = [fadeGrid(X0 - R, X0, Z0 - R, SW + T, S, y, alpha), fadeGrid(X0, X1, Z0 - R, Z0, S, y, alpha), fadeGrid(X1, X1 + R, Z0 - R, SE + T, S, y, alpha)].filter((p): p is THREE.BufferGeometry => !!p);
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts)!, fadeMat(C.deep)); m.renderOrder = AFTER_FLOOR; g.add(m); }
  }
  return g;
}
/** The shelf and the drop-off: the pale pebbled shallows between the shore (`s` line, west to east) and the drop line
 *  (`d` line, west to east), every stone seen through clear water, a pale lip of stones and the ink band where the bed
 *  falls away (its outer edge is where the black water of l-lake-mirror begins). */
export function dropOff(d: Dims): THREE.Group {
  const shore = dimsLine(d, 's').pts, drop = dimsLine(d, 'd').pts, D = dropLine(d), g = grp();
  if (shore.length < 2 || D.length < 2) return g;
  // the shelf, and a paler band near the shore where the water is a hand deep (side by side, never stacked)
  const S = densify(shore, shore.map(() => 0), 5);
  const lineZ0 = (L: P2[], x: number) => { for (let i = 0; i + 1 < L.length; i++) if (x >= L[i][0] && x <= L[i + 1][0]) return lerp(L[i][1], L[i + 1][1], (x - L[i][0]) / ((L[i + 1][0] - L[i][0]) || 1)); return x < L[0][0] ? L[0][1] : L[L.length - 1][1]; };
  const near: P2[] = S.slice(1, -1).map((q) => [q.p[0], Math.max(lineZ0(drop, q.p[0]) + 4, q.p[1] - 14 - hash(Math.round(q.p[0]), 2) * 6)] as P2);
  const inner = offsetPts(D, -LIP);
  const sheets = [flat([...inner, ...[...near].reverse()], WATER_Y, waterMat(C.shelf), false), flat([S[0].p, ...near, S[S.length - 1].p, ...[...S].reverse().slice(1, -1).map((q) => q.p)], WATER_Y, waterMat(C.shelfPale), false),
    // the lip and the ink band
    new THREE.Mesh(ribbon(D, () => -LIP, () => INK0, WATER_Y), waterMat(C.lip)), new THREE.Mesh(ribbon(D, () => INK0, () => INK1, WATER_Y), waterMat(C.ink))];
  for (const m of sheets) { m.renderOrder = AFTER_FLOOR; g.add(m); }
  // pebbles on the shelf: flat faceted stones, more toward the shore
  const geo: Record<string, THREE.BufferGeometry[]> = {};
  const add = (c: string, gg: THREE.BufferGeometry) => (geo[c] ??= []).push(gg);
  const xs = shore.map((p) => p[0]), xmin = Math.min(...xs), xmax = Math.max(...xs);
  const lineZ = (L: P2[], x: number) => { for (let i = 0; i + 1 < L.length; i++) if (x >= L[i][0] && x <= L[i + 1][0]) return lerp(L[i][1], L[i + 1][1], (x - L[i][0]) / ((L[i + 1][0] - L[i][0]) || 1)); return x < L[0][0] ? L[0][1] : L[L.length - 1][1]; };
  for (let i = 0; i < (d.stones ?? 420); i++) {
    const x = lerp(xmin, xmax, hash(i, 41)), zs = lineZ(shore, x), zd = lineZ(drop, x); if (zs - zd < 4) continue;
    const z = lerp(zd + 2, zs - 1, Math.pow(hash(i, 42), 0.7)), r = 0.35 + hash(i, 43) * 0.9;
    const s = new THREE.IcosahedronGeometry(r, 0); s.scale(1.3, 0.22, 1); s.rotateY(hash(i, 44) * 6); s.translate(x, 0.03, z);
    add([C.pebble, C.pebble2, C.pebble3, C.pebbleWet][i % 4], s);
  }
  // (drawn after the shelf they lie in, or its sheet would cover the lower stones where their depths round together)
  for (const [c, gs] of Object.entries(geo)) { const m = new THREE.Mesh(merge(gs), mat(c)); m.renderOrder = AFTER_FLOOR + 1; g.add(m); }
  return g;
}
/** A lid of fog lying on the water: `len` × `d` ft, thin and torn along the last `span` ft of its southern (+z) edge,
 *  thick toward the north where it swallows the far shore; never higher than `h` ft. Its sheets are painted thin at
 *  every edge (their opacity falls away over `edge` ft at the east, west and north, over a few tens of feet behind each
 *  wavering front) so the lid has no rim and no steps where its layers end. */
export function mistShelf(d: Dims): THREE.Group {
  const L = d.len ?? 600, D = d.d ?? 250, H = d.h ?? 3, sp = d.span ?? D, E = d.edge ?? 280;
  // layers: each covers from the north edge to a soft wavering southern front, the fronts stepping north as it thickens
  const layers = [[1.0, 0.07, C.mist1], [0.84, 0.08, C.mist0], [0.66, 0.1, C.mist0], [0.46, 0.13, C.mist1], [0.26, 0.2, C.mist0]] as const;
  const byCol = new Map<string, THREE.BufferGeometry[]>();
  layers.forEach(([reach, op, col], k) => {
    const front = D / 2 - (1 - reach) * sp, Lk = L * (1 - 0.06 * k), ramp = 36 + 10 * k;
    const zf = (x: number) => front - 9 - 7 * Math.sin(x * 0.021 + k * 1.3) - 5 * Math.sin(x * 0.057 + k * 2.1) - 3 * Math.sin(x * 0.13 + k);
    const alpha = (x: number, z: number) => {
      const side = Math.min(x + Lk / 2, Lk / 2 - x) - 25 * (1 + Math.sin(z * 0.03 + k * 2.2)), north = z + D / 2;
      return op * smooth((zf(x) - z) / ramp) * smooth(side / E) * smooth(north / E);
    };
    const geo = fadeGrid(-Lk / 2, Lk / 2, -D / 2, front + 4, 18, 0.5 + (k / layers.length) * H, alpha);
    if (geo) (byCol.get(col) ?? byCol.set(col, []).get(col)!).push(geo);
  });
  // drifting wisps over the front and loose tatters out onto the clear water, thickest at the middle, gone at the rim
  for (let i = 0; i < 30; i++) {
    const x = -L / 2 + hash(i, 7) * L, z = D / 2 - sp * (0.55 - hash(i, 8) * 0.62), y = 0.6 + hash(i, 10) * H, rim = wisp(5 + hash(i, 9) * 9, i + 50, 2.6);
    const P: number[] = [], A: number[] = [];
    rim.forEach(([a, b], j) => { const [c, e] = rim[(j + 1) % rim.length]; P.push(x, y, z, x + a, y, z + b, x + c, y, z + e); A.push(1, 1, 1, 0.16, 1, 1, 1, 0, 1, 1, 1, 0); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(A, 4)); geo.computeVertexNormals();
    const col = i % 2 ? C.mist0 : C.mist1; (byCol.get(col) ?? byCol.set(col, []).get(col)!).push(geo);
  }
  const sheet = grp();   // one mesh per colour
  for (const [col, gs] of byCol) { const m = new THREE.Mesh(mergeGeometries(gs)!, fadeMat(col)); m.renderOrder = 2; sheet.add(m); }
  sheet.position.z = d.dz ?? 0;   // the piece may stand on the map while its sheet reaches far past the edge
  return grp(sheet, backdropSwitch(true));
}
/** Rings spreading on still water round something sitting in it (`r` the innermost radius, `n` rings). */
export function rippleRing(d: Dims): THREE.Group {
  const r = d.r ?? 6, n = d.n ?? 3, gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) { const rr = r * (1 + i * 0.8); gs.push(ringGeo(rr, rr + 0.35 + i * 0.3, RING_Y + i * 0.002, 48)); }
  return grp(new THREE.Mesh(merge(gs), mat(C.ring)));
}

// ---------------------------------------------------------------- the shore
/** The fishers' landing: grey shingle and packed mud over `n`,`x{i}`,`z{i}` (a closed outline), a raised lip at the back
 *  (`b` and `c` lines, either side of the trail), two keel furrows (`k0`/`k1` lines) and fish scales glinting in the stones; a flat stepping stone out
 *  into the shallows at (`sx`,`sz`). */
export function shingleBeach(d: Dims): THREE.Group {
  const { pts } = dimsLine(d), g = grp();
  if (pts.length < 3) return g;
  g.add(flat(pts, 0.1, mat(C.shingle)));
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const inPoly = (x: number, z: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
  // patches of mud where the boats are dragged, and the stones
  for (let i = 0; i < 6; i++) { const cx = lerp(x0 + 10, x1 - 10, hash(i, 1)), cz = lerp(z0 + 6, z1 - 8, hash(i, 2)); if (inPoly(cx, cz)) g.add(flat(wisp(2.5 + hash(i, 3) * 3, i, 1.6).map(([a, b]) => [a + cx, b + cz] as P2), 0.12, mat(C.mud))); }
  const geo: Record<string, THREE.BufferGeometry[]> = {};
  for (let i = 0; i < 520; i++) {
    const x = lerp(x0, x1, hash(i, 11)), z = lerp(z0, z1, hash(i, 12)); if (!inPoly(x, z)) continue;
    const r = 0.25 + hash(i, 13) * 0.6, s = new THREE.IcosahedronGeometry(r, 0); s.scale(1.2, 0.45, 1); s.rotateY(hash(i, 14) * 6); s.translate(x, 0.14, z);
    (geo[[C.shingle2, C.shingleDark, C.pebble3, C.pebble][i % 4]] ??= []).push(s);
  }
  for (let i = 0; i < 70; i++) { const x = lerp(x0, x1, hash(i, 21)), z = lerp(z0, z1, hash(i, 22)); if (!inPoly(x, z)) continue; const s = new THREE.CircleGeometry(0.13, 5); s.rotateX(-Math.PI / 2); s.translate(x, 0.2, z); (geo[C.scale] ??= []).push(s); }
  for (const [c, gs] of Object.entries(geo)) g.add(new THREE.Mesh(merge(gs), mat(c)));
  // the keel furrows: dark grooves with a ridge of pushed-up gravel each side
  for (const k of ['k0', 'k1']) {
    const line = dimsLine(d, k).pts; if (line.length < 2) continue;
    const D = densify(line, line.map(() => 0), 2);
    g.add(new THREE.Mesh(ribbon(D, () => -0.55, () => 0.55, 0.13), mat(C.mudDark)));
    for (const s of [-1, 1]) g.add(new THREE.Mesh(ribbon(D, () => s * 0.55, () => s * 1.3, 0.2), mat(C.shingle2)));
  }
  // the raised lip of stones at the back where the pines begin
  for (const k of ['b', 'c']) { const back = dimsLine(d, k).pts;
  if (back.length > 1) for (const q of densify(back, back.map(() => 0), 2.2)) g.add(place(lump(0.9 + hash(Math.round(q.p[0] * 3), 1) * 0.6, [C.shingleDark, C.shingle2, C.rockDeep][((Math.round(q.p[0]) % 3) + 3) % 3], Math.round(q.p[0]), 1.4, 0.45, 1, 0), q.p[0], 0.2, q.p[1] + (hash(Math.round(q.p[0]), 5) - 0.5) * 1.5)); }
  if (d.sx !== undefined) g.add(place(lump(1.6, C.slab, 9, 1.5, 0.28, 1.1, 1), d.sx, 0.15, d.sz ?? 0));
  return g;
}
/** A weathered mooring stake driven into the shallows, about 4 ft out of the water, rope-burned at the top; `painter` 1
 *  trails a frayed rope end into the water. */
export function mooringStake(d: Dims): THREE.Group {
  const tilt = (hash(d.seed ?? 1, 1) - 0.5) * 0.14, g = grp();
  const st = grp(cyl(0.32, 0.4, 5.2, C.stake, 0, 2.0, 0, 6), cyl(0.33, 0.33, 0.5, C.stakeTop, 0, 3.6, 0, 6), cone(0.32, 0.4, C.stakeTop, 0, 4.8, 0, 6));
  st.rotation.set(tilt, 0, -tilt * 0.6); g.add(st, place(new THREE.Mesh(ringGeo(0.45, 0.75, RING_Y, 12), mat(C.ring)), 0, 0, 0));
  if (d.painter) {
    g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 4, 10), mat(C.rope)), 0, 3.4, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) { const r = box(0.13, 0.13, 1.3, C.ropeDark, 0.2 + i * 0.25, 3.0 - i * 0.85, 0.4 + i * 0.4); r.rotation.x = 0.9; g.add(r); }
    g.add(box(0.12, 0.05, 2.4, C.ropeDark, 1.1, 0.03, 2.2, 0.3));
  }
  return g;
}
/** Bluto's trotline: two stakes `len` ft apart along local x, a sagging cord between them and two dozen droppers with
 *  bare hooks, a lump of bread on one or two. */
export function trotline(d: Dims): THREE.Group {
  const L = d.len ?? 60, g = grp();
  for (const s of [-1, 1]) g.add(grp(cyl(0.22, 0.3, 4.2, C.stake, s * L / 2, 1.6, 0, 5), cone(0.22, 0.3, C.stakeTop, s * L / 2, 3.85, 0, 5)));
  const sag = (x: number) => 3.3 - 2.9 * (1 - (2 * x / L) ** 2);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const xa = -L / 2 + (i / n) * L, xb = -L / 2 + ((i + 1) / n) * L, ya = sag(xa), yb = sag(xb), len = Math.hypot(xb - xa, yb - ya);
    const seg = box(len, 0.06, 0.06, C.cord, (xa + xb) / 2, (ya + yb) / 2, 0); seg.rotation.z = Math.atan2(yb - ya, xb - xa); g.add(seg);
  }
  for (let i = 1; i < 24; i++) {
    const x = -L / 2 + (i / 24) * L, y = sag(x); g.add(box(0.035, 0.9, 0.035, C.cord, x, y - 0.45, 0), box(0.12, 0.12, 0.05, C.hook, x, y - 0.95, 0));
    if (i === 7 || i === 16) g.add(place(lump(0.22, C.bread, i, 1, 0.8, 1, 0), x, y - 1.1, 0));
  }
  g.add(place(new THREE.Mesh(ringGeo(1.2, 1.5, RING_Y, 16), mat(C.ring)), 0, 0, 0));
  return g;
}
/** The fallen pier-pine: a whole shore pine blown over into the lake, `len` ft along local -x from its upturned root
 *  plate (at the origin, on the bank) out to where its crown sinks; bark worn smooth along the top where boots go. */
export function pierPine(d: Dims): THREE.Group {
  const L = d.len ?? 70, dry = d.dry ?? 52, g = grp();
  // the root plate: a ragged disc of roots and earth stood on edge
  const plate = grp();
  const disc = new THREE.CylinderGeometry(4.6, 5.2, 1.4, 9); disc.rotateZ(Math.PI / 2);
  const dp = disc.attributes.position; for (let i = 0; i < dp.count; i++) { const k = 0.8 + 0.35 * hash(i, 4); dp.setY(i, dp.getY(i) * k); dp.setZ(i, dp.getZ(i) * k); }
  disc.computeVertexNormals(); plate.add(new THREE.Mesh(disc, mat(C.rootEarth)));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 3.8 + hash(i, 6) * 2, rt = box(0.35, 0.35, 3 + hash(i, 7) * 2.5, C.root, 0.9, Math.sin(a) * r, Math.cos(a) * r); rt.rotation.x = -a; rt.rotation.y = (hash(i, 8) - 0.5) * 0.6; plate.add(rt); }
  for (let i = 0; i < 5; i++) plate.add(place(lump(0.6 + hash(i, 9) * 0.5, C.rockDeep, i, 1, 0.8, 1, 0), 1.0, (hash(i, 10) - 0.5) * 8, (hash(i, 11) - 0.5) * 9));
  plate.position.set(1.5, 4.0, 0); g.add(plate);
  g.add(place(lump(3.2, C.mudDark, 3, 1.0, 0.18, 1.3, 1), 4.2, 0, 0));   // the pit the roots tore out of
  // the trunk: dry over the bank and shelf, then going under, the top worn pale
  const trunk = new THREE.CylinderGeometry(1.0, 1.55, L, 8); trunk.rotateZ(Math.PI / 2); trunk.translate(-L / 2, 0, 0);
  const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i); tp.setY(i, tp.getY(i) + 2.4 * Math.max(0, 1 + x / dry) - 1.4 * Math.max(0, (-x - dry) / (L - dry))); }
  trunk.computeVertexNormals(); g.add(new THREE.Mesh(trunk, mat(C.bark)));
  { // the worn strip along the trunk's top
    const v: THREE.Vector3[] = []; const top = (x: number) => 2.4 * Math.max(0, 1 + x / dry) + lerp(1.55, 1.0, -x / L) * 0.98;
    for (let x = 0; x > -dry; x -= 4) { const x2 = Math.max(-dry, x - 4); v.push(new THREE.Vector3(x, top(x), -0.5), new THREE.Vector3(x2, top(x2), -0.5), new THREE.Vector3(x2, top(x2), 0.5), new THREE.Vector3(x, top(x), -0.5), new THREE.Vector3(x2, top(x2), 0.5), new THREE.Vector3(x, top(x), 0.5)); }
    g.add(new THREE.Mesh(upTris(v), mat(C.barkWorn)));
  }
  // branch stubs along the dry part, the drowned crown dark under the surface beyond
  for (let i = 0; i < 7; i++) { const x = -8 - i * 6.5, b = box(0.3, 2.2 + hash(i, 1) * 1.5, 0.3, C.bark, x, 2.4 * (1 + x / dry) + 1.6, (hash(i, 2) - 0.5) * 2); b.rotation.set((hash(i, 3) - 0.5) * 1.8, 0, (hash(i, 4) - 0.5) * 0.8); g.add(b); }
  // the drowned crown: dark boughs just under the glassy surface, a few snag tips breaking it
  for (let i = 0; i < 14; i++) {
    const x = -dry + 2 - hash(i, 5) * (L - dry + 8), side = i % 2 ? 1 : -1, len = 5 + hash(i, 6) * 7, a = side * (0.7 + hash(i, 8) * 0.6);
    const bough: P2[] = [[0, -0.6], [len, -1.6], [len * 1.05, 0], [len, 1.6], [0, 0.6]];
    g.add(flat(bough.map(([u, v]) => [x + Math.cos(a) * u - Math.sin(a) * v * 0.5, Math.sin(a) * u + Math.cos(a) * v] as P2), WATER_Y + 0.04, fogMat(i % 3 ? C.drowned : C.mossDeep, i % 3 ? 0.6 : 0.45), false));
    if (i % 3 === 0) { const t = box(0.22, 1.4, 0.22, C.barkWet, x + Math.cos(a) * len * 0.7, 0.4, Math.sin(a) * len * 0.7); t.rotation.z = (hash(i, 9) - 0.5) * 0.8; g.add(t); }
  }
  g.add(place(new THREE.Mesh(ringGeo(2.2, 2.6, RING_Y, 20), mat(C.ring)), -dry, 0, 0));
  return g;
}
/** A 12-ft pole rack along local x: tarred nets draped over the bar, cork floats, a coil of hempen rope at one end and
 *  two bait buckets under it. */
export function netRack(d: Dims): THREE.Group {
  const L = d.len ?? 12, g = grp();
  for (const x of [-L / 2, 0, L / 2]) g.add(box(0.35, 6.4, 0.35, C.boardDark, x, 3.2, 0), box(0.6, 0.4, 0.6, C.stone, x, 0.2, 0));
  g.add(box(L + 1, 0.3, 0.3, C.boardDark, 0, 6.2, 0));
  for (const s of [-1, 1]) { const net = box(L * 0.92, 3.8, 0.1, s < 0 ? C.tar : C.netDark, 0, 4.3, s * 0.55); net.rotation.x = s * 0.22; g.add(net); }
  for (let i = 0; i < 9; i++) g.add(place(lump(0.22, C.cork, i, 1.3, 0.8, 1, 0), -L / 2 + 0.6 + i * (L / 8.6), 2.6 + (i % 2) * 0.3, (i % 2 ? 1 : -1) * 0.95));
  for (let k = 0; k < 4; k++) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(1.0 - k * 0.12, 0.17, 4, 12), mat(k % 2 ? C.rope : C.ropeDark)), L / 2 + 1.8, 0.2 + k * 0.28, 0.6, 0, Math.PI / 2));
  for (const x of [-2, 1.6]) g.add(cyl(0.75, 0.6, 1.3, C.bucket, x, 0.65, 1.6, 8), cyl(0.62, 0.62, 0.05, C.mudDark, x, 1.25, 1.6, 8));
  return g;
}
/** One dried fish nailed up at `h` ft: blackened and split down one flank, its spine kinked (on a post of its own when
 *  `post` is 1). */
export function scorchedFish(d: Dims): THREE.Group {
  const h = d.h ?? 5, g = grp();
  if (d.post) g.add(box(0.45, h + 1.5, 0.45, C.boardDark, 0, (h + 1.5) / 2, -0.3));
  const fish = grp(place(lump(0.5, C.fishBurnt, 2, 0.6, 2.1, 0.22, 1), 0, 0.05, 0), place(lump(0.45, C.fish, 3, 0.55, 1.8, 0.2, 1), 0.08, 0.2, 0.02));
  fish.add(cone(0.42, 0.7, C.fishBurnt, 0, -1.25, 0, 4).rotateZ(Math.PI), box(0.08, 1.6, 0.06, C.fishSplit, 0.18, 0.1, 0.1), box(0.1, 0.1, 0.22, C.nail, 0, 0.9, 0.1));
  fish.rotation.z = 0.12; fish.position.set(0, h, 0.1); g.add(fish);
  return g;
}
/** The gutting slab: a flat lake stone on two boulders at waist height, scored and stained, a bone-handled knife stuck in
 *  a crack. */
export function guttingSlab(): THREE.Group {
  const g = grp(place(lump(1.2, C.rockDeep, 4, 1.1, 1.2, 1, 1), -1.6, 1.1, 0), place(lump(1.2, C.rock, 5, 1.1, 1.25, 1, 1), 1.6, 1.1, 0.1));
  const top = new THREE.CylinderGeometry(2.9, 3.1, 0.6, 7); top.scale(1.35, 1, 0.75); g.add(place(new THREE.Mesh(top, mat(C.slab)), 0, 2.7, 0));
  g.add(flat(wisp(1.4, 3, 1.8).map(([x, z]) => [x * 1.1, z] as P2), 3.02, mat(C.stain)));
  for (let i = 0; i < 6; i++) g.add(box(1.4 + hash(i, 1), 0.04, 0.07, C.slabTop, -1.6 + i * 0.6, 3.02, (hash(i, 2) - 0.5) * 1.6, 0.4 + hash(i, 3) * 0.6));
  const knife = grp(box(0.12, 1.0, 0.36, C.blade, 0, 0.3, 0), box(0.2, 0.9, 0.24, C.knifeHandle, 0, 1.25, 0)); knife.position.set(1.4, 2.9, 0.4); knife.rotation.z = 0.25; g.add(knife);
  for (let i = 0; i < 6; i++) g.add(place(lump(0.18, C.boneGrey, i, 1.8, 0.5, 0.7, 0), (hash(i, 7) - 0.5) * 5, 0.08, 1.6 + hash(i, 8) * 1.5, hash(i, 9) * 6));
  return g;
}
/** A low heap of old fish bones and heads, dried grey, with a faint haze of flies. */
export function offalMidden(d: Dims): THREE.Group {
  const r = d.r ?? 5, g = grp(place(lump(r, C.duff, 2, 1.1, 0.22, 0.9, 1), 0, 0, 0));
  for (let i = 0; i < 46; i++) {
    const a = hash(i, 1) * Math.PI * 2, rr = r * Math.sqrt(hash(i, 2)) * 0.9, x = Math.cos(a) * rr * 1.1, z = Math.sin(a) * rr * 0.9, y = r * 0.22 * (1 - (rr / r) ** 2) * 0.8 + 0.15;
    if (i % 3 === 0) g.add(place(lump(0.35, i % 2 ? C.boneGrey : C.bone, i, 1.2, 0.7, 0.8, 0), x, y + 0.1, z, a));          // heads
    else g.add(box(1.0 + hash(i, 3) * 0.8, 0.07, 0.08, i % 2 ? C.bone : C.boneDark, x, y, z, a));                             // spines
  }
  for (let i = 0; i < 10; i++) g.add(box(0.12, 0.12, 0.12, C.fly, (hash(i, 5) - 0.5) * r, 1.4 + hash(i, 6) * 1.6, (hash(i, 7) - 0.5) * r));
  return g;
}
/** A 7-ft pike with a weathered wolf skull on top, jaw wired shut, and a flaking painted board nailed under it. */
export function wolfHeadStake(): THREE.Group {
  const g = grp(cyl(0.22, 0.3, 7.6, C.pike, 0, 3.6, 0, 6), place(lump(0.7, C.rockDeep, 1, 1.4, 0.5, 1.4, 0), 0, 0.15, 0));
  const skull = grp(
    box(1.0, 0.85, 1.2, C.skull, 0, 0, 0), box(0.75, 0.5, 1.3, C.skull, 0, -0.12, 1.1), box(0.62, 0.22, 1.15, C.skullShade, 0, -0.5, 1.0),
    box(0.18, 0.16, 0.12, C.ink, -0.28, 0.12, 0.62), box(0.18, 0.16, 0.12, C.ink, 0.28, 0.12, 0.62), box(0.16, 0.12, 0.1, C.ink, 0, -0.08, 1.78),
    cone(0.12, 0.3, C.skullShade, -0.2, -0.42, 1.45, 4).rotateX(Math.PI), cone(0.12, 0.3, C.skullShade, 0.2, -0.42, 1.45, 4).rotateX(Math.PI),
  );
  for (const z of [0.6, 1.2]) skull.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 4, 10), mat(C.wire)), 0, -0.3, z, 0, 0, 0));
  skull.position.set(0, 7.75, 0); skull.rotation.x = -0.15; g.add(skull);
  const board = grp(box(2.6, 1.0, 0.14, C.board2, 0, 0, 0), box(1.9, 0.14, 0.16, C.paint, -0.15, 0.2, 0.01), box(1.2, 0.14, 0.16, C.paintPale, 0.25, -0.18, 0.01), box(0.5, 0.14, 0.16, C.paint, -0.8, -0.18, 0.01));
  board.position.set(0, 4.6, 0.3); board.rotation.z = 0.06; g.add(board);
  return g;
}
/** A shore pine (scale `scale`) with an old axe blaze healed into a pale lipped scar at chest height facing local +z;
 *  `cloth` 1 ties a faded strip of cloth on a high branch. */
export function blazedPine(d: Dims): THREE.Group {
  const s = d.scale ?? 1.2, g = pine({ h: 26, r: 6, scale: s });
  const r = 0.8 * s * 0.92;
  g.add(box(0.9, 1.5, 0.3, C.blazeLip, 0, 4.5, r - 0.05), box(0.6, 1.1, 0.25, C.blaze, 0, 4.5, r + 0.06));
  if (d.cloth) { const y = 26 * s * 0.3; g.add(box(0.28, 0.28, 3.5, C.bark, 0, y, 1.8)); const c = box(0.5, 2.6, 0.06, C.clothFade, 0.1, y - 1.3, 3.2); c.rotation.z = 0.12; g.add(c, box(0.6, 0.35, 0.3, C.cloth, 0.1, y, 3.2)); }
  return g;
}
/** The Black Tooth: one dark weed-slick rock 12 ft across standing 4 ft out of the still water, a bleached band at the
 *  waterline, a rusted iron ring on top, guano where the ravens sit, a ring on the water round its foot. */
export function blackTooth(): THREE.Group {
  const g = grp(place(lump(6.2, C.tooth, 7, 1.0, 0.95, 0.85, 1), 0, -1.6, 0), place(lump(3.2, C.toothDark, 8, 1, 1, 1, 1), 2.4, 1.6, -1));
  g.add(place(lump(6.45, C.bleach, 9, 1.0, 0.07, 0.86, 1), 0, 0.15, 0));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(place(lump(0.9 + hash(i, 1) * 0.6, i % 2 ? C.weed : C.weedSlick, i, 1.6, 0.5, 1, 0), Math.cos(a) * 5.6, 0.55, Math.sin(a) * 4.8)); }
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.13, 5, 12), mat(C.rust)), 1.6, 4.2, -0.6, 0, Math.PI / 2 - 0.4), box(0.4, 0.4, 0.4, C.iron, 1.6, 3.85, -0.6));
  for (let i = 0; i < 6; i++) g.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.4 + hash(i, 3) * 0.5, 6).rotateX(-Math.PI / 2), mat(C.guano)), -1.5 + hash(i, 4) * 4, 3.0 + hash(i, 5) * 0.8, -2 + hash(i, 6) * 3));
  const rings: THREE.BufferGeometry[] = []; for (const r of [7.4, 10.5]) rings.push(ringGeo(r, r + 0.35, RING_Y, 32));
  g.add(new THREE.Mesh(merge(rings), mat(C.ring)));
  return g;
}

// ---------------------------------------------------------------- the Watch Knoll
/** The knoll's height (ft) at map point (x, z): a rounded rocky rise peaking at about 35 ft near (55, 552), cut off on
 *  the north by the bluff line z = 506 + 12·x/130 (north of it is the lake). Shared, number for number, with wild_l.py. */
export function knollH(x: number, z: number): number {
  const zb = 506 + 12 * Math.min(1, Math.max(0, x / 130));
  if (z < zb) return 0;
  const u = (x - 55) / (x < 55 ? 70 : 80), v = z > 552 ? (z - 552) / 88 : 0, r2 = u * u + v * v;
  if (r2 >= 1) return 0;
  return 35 * Math.pow(1 - r2, 1.35) + 1.6 * Math.sin(x * 0.11) * Math.cos(z * 0.09) * (1 - r2);
}
/** The Watch Knoll as a faceted landform: the heightfield above, drawn from map x 0..`w`, z from the bluff to `d`
 *  (the piece stands at map (`ox`,`oz`)); steep facets bare rock, the rest turf and needle duff. */
export function watchKnoll(d: Dims): THREE.Group {
  const ox = d.ox ?? 0, oz = d.oz ?? 0, W = d.w ?? 140, D = d.d ?? 650, step = 5, g = grp();
  const buckets: Record<string, THREE.Vector3[]> = { rock: [], turf: [], duff: [], lichen: [] };
  const zb = (x: number) => 506 + 12 * Math.min(1, Math.max(0, x / 130));
  const pt = (x: number, z: number) => new THREE.Vector3(x - ox, knollH(x, Math.max(z, zb(x) + 0.01)) + 0.02, z - oz);
  for (let x = 0; x < W; x += step) for (let z = 500; z < D; z += step) {
    const x1 = x + step, z1 = z + step;
    // clamp the cell's north edge to the bluff line so the top meets the face
    const za = Math.max(z, zb(x)), zc = Math.max(z, zb(x1)); if (z1 <= za && z1 <= zc) continue;
    const q = [pt(x, za), pt(x1, zc), pt(x1, z1), pt(x, z1)];
    if (Math.max(...q.map((p) => p.y)) < 0.15) continue;
    // one surface per cell, in broad patches: bare rock where it is steep or on the crown, needle duff under the pines
    const nrm = new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[0])).normalize();
    const cx = x + step / 2, cz = z + step / 2, hh = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
    const patch = Math.sin(cx * 0.045 + 1.3) + Math.cos(cz * 0.052 + 0.4) + 0.6 * Math.sin((cx + cz) * 0.11);
    const k = Math.abs(nrm.y) < 0.82 || (hh > 29 && patch > 0.2) ? (patch > 1.1 ? 'lichen' : 'rock') : patch < -1.35 ? 'duff' : 'turf';
    buckets[k].push(q[0], q[1], q[2], q[0], q[2], q[3]);
  }
  const col: Record<string, string> = { rock: C.crag, turf: C.turf, duff: C.duff, lichen: C.cragLichen };
  for (const [k, v] of Object.entries(buckets)) if (v.length) g.add(new THREE.Mesh(upTris(v), mat(col[k])));
  // outcrops breaking the slope, and loose stones at the knoll's foot
  for (let i = 0; i < 22; i++) {
    const x = 6 + hash(i, 11) * 120, z = zb(x) + 4 + hash(i, 12) * 110, h = knollH(x, z); if (h < 3) continue;
    g.add(place(lump(1.8 + hash(i, 13) * 2.6, i % 3 ? C.rock : C.rockDeep, i, 1.3, 0.7, 1, 1), x - ox, h - 0.4, z - oz, hash(i, 14) * 6));
  }
  return g;
}
/** The bluff: the knoll's north face, a rock wall from below the waterline up to the knoll's lip along z = 506 + 12·x/130
 *  for map x 0..`w` (the piece stands at map (`ox`,`oz`)); lichen and moss in its seams, a stunted pine on the lip. */
export function bluffFace(d: Dims): THREE.Group {
  const ox = d.ox ?? 0, oz = d.oz ?? 0, W = d.w ?? 132, g = grp();
  const zb = (x: number) => 506 + 12 * Math.min(1, Math.max(0, x / 130));
  const faces: Record<string, THREE.Vector3[]> = { a: [], b: [], c: [] };
  const step = 4;
  for (let x = 0; x < W; x += step) {
    const x1 = Math.min(W, x + step), h0 = knollH(x, zb(x) + 0.01), h1 = knollH(x1, zb(x1) + 0.01);
    if (h0 < 0.3 && h1 < 0.3) continue;
    // the face in three bands, each jutting by its own amount, so it reads as broken rock not a wall
    const bands = [0, 0.33, 0.66, 1];
    for (let b = 0; b < 3; b++) {
      const j0 = 0.3 + hash(Math.round(x) + b * 17, 1) * 3.6, j1 = 0.3 + hash(Math.round(x1) + b * 17, 1) * 3.6;
      const ya0 = lerp(-3, h0, bands[b]), yb0 = lerp(-3, h0, bands[b + 1]), ya1 = lerp(-3, h1, bands[b]), yb1 = lerp(-3, h1, bands[b + 1]);
      const p = (xx: number, y: number, j: number) => new THREE.Vector3(xx - ox, y, zb(xx) - j - oz);
      const A = p(x, ya0, j0), B = p(x1, ya1, j1), Cc = p(x1, yb1, j1 * 0.7), Dd = p(x, yb0, j0 * 0.7);
      faces['abc'[(Math.round(x / step) + b) % 3]].push(A, Cc, B, A, Dd, Cc);
    }
  }
  const tone: Record<string, string> = { a: C.crag, b: C.cragDeep, c: C.cragPale };
  for (const [k, v] of Object.entries(faces)) if (v.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flatMap((p) => [p.x, p.y, p.z]), 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, mat(tone[k]))); }
  // seams of lichen and moss, ledges, fallen blocks at the waterline
  for (let i = 0; i < 18; i++) {
    const x = 4 + hash(i, 21) * (W - 12), h = knollH(x, zb(x) + 0.01); if (h < 4) continue;
    const y = h * (0.2 + hash(i, 22) * 0.7);
    g.add(place(lump(0.9 + hash(i, 23), i % 2 ? C.lichen : C.moss, i, 1.8, 0.5, 0.6, 0), x - ox, y, zb(x) - 2.6 - oz));
    if (i % 3 === 0) g.add(box(3 + hash(i, 24) * 3, 0.6, 1.4, C.rockDeep, x - ox, y + 1.5, zb(x) - 2.4 - oz));
  }
  for (let i = 0; i < 9; i++) { const x = 6 + hash(i, 31) * (W - 20); g.add(place(lump(1.4 + hash(i, 32) * 1.6, i % 2 ? C.rockDeep : C.tooth, i, 1.2, 0.8, 1, 1), x - ox, 0.2, zb(x) - 4.5 - hash(i, 33) * 4 - oz)); }
  // the stunted pine leaning out over the water from the lip
  const sx = d.px ?? 46, sh = knollH(sx, zb(sx) + 3), tree = pine({ h: 14, r: 4, scale: 0.9 }); tree.position.set(sx - ox, sh - 0.3, zb(sx) + 2.5 - oz); tree.rotation.x = -0.32; g.add(tree);
  return g;
}

// ---------------------------------------------------------------- the brook, the path, the trail
/** The brook: a narrow clear stream along `n`,`x{i}`,`z{i}` (half-width `w{i}`), a pebble bed showing through, a pale
 *  thread of current down its middle and a fan of water where it meets the lake at its last point. */
export function brook(d: Dims): THREE.Group {
  const { pts, w } = dimsLine(d), g = grp();
  if (pts.length < 2) return g;
  const D = densify(pts, w, 3);
  g.add(new THREE.Mesh(ribbon(D, (q) => -q.w - 1.0, (q) => q.w + 1.0, 0.04), mat(C.brookBed)));
  g.add(new THREE.Mesh(ribbon(D, (q) => -q.w, (q) => q.w, 0.07), mat(C.brook)));
  g.add(new THREE.Mesh(ribbon(D, (q, i) => -0.25 + Math.sin(i * 0.8) * q.w * 0.35, (q, i) => 0.25 + Math.sin(i * 0.8) * q.w * 0.35, 0.09), mat(C.brookPale)));
  for (let i = 0; i < D.length; i += 2) { const q = D[i], s = hash(i, 3) > 0.5 ? 1 : -1, nx = q.t[1], nz = -q.t[0]; g.add(place(lump(0.35 + hash(i, 4) * 0.5, i % 3 ? C.stone : C.mossDeep, i, 1.3, 0.55, 1, 0), q.p[0] + nx * s * (q.w + 0.5), 0.1, q.p[1] + nz * s * (q.w + 0.5))); }
  const [ex, ez] = pts[pts.length - 1]; g.add(flat(wisp(5, 11, 1.4).map(([a, b]) => [a + ex, b + ez - 3] as P2), 0.05, mat(C.brook)));
  return g;
}
/** Two mossy planks laid across stones over a brook along local z (the planks run along local x, `len` ft), one cracked. */
export function plankCrossing(d: Dims): THREE.Group {
  const L = d.len ?? 10, g = grp();
  for (const s of [-1, 1]) g.add(place(lump(1.2, C.stone, s + 3, 1.1, 0.55, 1.3, 1), s * (L / 2 - 0.6), 0.35, 0));
  const p0 = box(L, 0.3, 1.3, C.plank, 0, 0.95, -0.72, 0.02), p1a = box(L * 0.52, 0.3, 1.2, C.plank, -L * 0.24, 0.95, 0.72), p1b = box(L * 0.5, 0.3, 1.2, C.plank, L * 0.25, 0.85, 0.74);
  p1b.rotation.z = 0.08; p1a.rotation.z = -0.05; g.add(p0, p1a, p1b);
  for (let i = 0; i < 5; i++) g.add(place(lump(0.4 + hash(i, 1) * 0.3, C.plankMoss, i, 1.6, 0.35, 1, 0), -L / 2 + 1 + i * (L / 5), 1.12, (i % 2 ? 0.7 : -0.7)));
  return g;
}
/** The trail's wear along `n`,`x{i}`,`z{i}`: two handcart ruts, pine roots across it (`roots` of them), needles drifted
 *  (needles: the forest floor's own colour). */
export function trailRuts(d: Dims): THREE.Group {
  const { pts } = dimsLine(d), g = grp();
  if (pts.length < 2) return g;
  const D = densify(pts, pts.map(() => 0), 3);
  for (const s of [-1, 1]) g.add(new THREE.Mesh(ribbon(D, () => s * 1.15 - 0.18, () => s * 1.15 + 0.18, 0.17), mat(C.mudDark)));
  const n = d.roots ?? 9;
  for (let i = 0; i < n; i++) {
    const q = D[Math.floor(((i + 0.5) / n) * (D.length - 1))], a = Math.atan2(q.t[1], q.t[0]);
    const r = box(6 + hash(i, 1) * 3, 0.35, 0.4, C.root, q.p[0], 0.2, q.p[1], -(a + Math.PI / 2 + (hash(i, 2) - 0.5) * 0.7)); g.add(r);
  }
  return g;
}
/** A rotted fish crate dropped at a bend, its slats sprung. */
export function fishCrate(): THREE.Group {
  const g = grp(box(3, 0.2, 2, C.crateRot, 0, 0.1, 0));
  for (const s of [-1, 1]) g.add(box(3, 1.2, 0.2, C.crate, 0, 0.7, s * 0.9), box(0.2, 1.2, 1.8, C.crateRot, s * 1.4, 0.7, 0));
  const sl = box(3.1, 0.15, 0.6, C.crate, 0.4, 0.3, 1.6, 0.4); sl.rotation.z = 0.2; g.add(sl, box(2.6, 0.15, 0.5, C.crateRot, -0.6, 0.12, -1.7, -0.3));
  return g;
}

// ---------------------------------------------------------------- the west end of the shingle
/** A bleached drift log 18 ft long (local x), scored by keels, with three empty clay wine jugs and a line bobbin beside it. */
export function driftLog(d: Dims): THREE.Group {
  const L = d.len ?? 18, g = grp(place(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, L, 8).rotateZ(Math.PI / 2), mat(C.drift)), 0, 1.0, 0));
  g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 8).rotateZ(Math.PI / 2), mat(C.driftDeep)), L / 2 + 0.02, 1.0, 0));
  for (let i = 0; i < 5; i++) g.add(box(0.08, 0.06, 1.6, C.driftDeep, -L / 2 + 2 + i * 3.2, 2.05, 0, 0.3));
  for (let i = 0; i < 3; i++) { const b = box(0.3, 1.8, 0.3, C.driftDeep, -L / 2 + 3 + i * 5.5, 1.9, -0.6); b.rotation.set(-0.6, 0, 0.4); g.add(b); }
  const jug = (x: number, z: number, lying: boolean) => { const j = grp(cyl(0.45, 0.6, 1.3, C.jug, 0, 0.65, 0, 8), cyl(0.18, 0.4, 0.5, C.jug, 0, 1.5, 0, 8), cyl(0.14, 0.14, 0.3, C.jugDark, 0, 1.85, 0, 6)); if (lying) { j.rotation.z = Math.PI / 2; j.position.y = 0.6; } j.position.x = x; j.position.z = z; return j; };
  g.add(jug(-2, 1.8, false), jug(-0.6, 2.2, false), jug(1.4, 2.0, true));
  g.add(cyl(0.35, 0.35, 0.7, C.bobbin, 3.2, 0.35, 1.8, 8), cyl(0.28, 0.28, 0.72, C.line, 3.2, 0.36, 1.8, 8));
  return g;
}
/** The offering stone: a flat stone half in the water, green copper coins, a fish-bone charm and a knotted ribbon
 *  pressed into the mud round it. */
export function offeringStone(): THREE.Group {
  const g = grp(place(lump(2.4, C.offer, 6, 1.5, 0.3, 1.1, 1), 0, 0.25, 0));
  for (let i = 0; i < 16; i++) { const a = hash(i, 1) * Math.PI * 2, r = 3.4 + hash(i, 2) * 1.6; g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 7), mat(i % 3 ? C.copper : C.copperPale)), Math.cos(a) * r, 0.14, Math.sin(a) * r * 0.8, 0, (hash(i, 3) - 0.5) * 0.5)); }
  g.add(box(0.1, 0.06, 1.2, C.charm, 2.4, 0.95, -0.4, 0.5), box(0.6, 0.06, 0.08, C.charm, 2.4, 0.95, -0.4, 0.5));
  const rib = box(0.25, 0.05, 2.4, C.ribbon, -2.6, 0.1, 1.2, 0.7); g.add(rib, place(lump(0.25, C.ribbon, 3, 1, 0.6, 1, 0), -2.2, 0.15, 0.6));
  g.add(place(new THREE.Mesh(ringGeo(4.6, 4.9, RING_Y, 24), mat(C.ring)), 0, 0, 0));
  return g;
}
/** A heron's skeleton tangled in reeds: long neck bones, the skull and bill, a splay of rib and leg. */
export function heronBones(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 7; i++) g.add(box(0.12, 0.12, 0.7, C.heron, 0, 0.15 + i * 0.05, i * 0.62, (i % 2 ? 0.15 : -0.15)));
  g.add(box(0.3, 0.3, 0.45, C.heron, 0, 0.5, 4.6), box(0.08, 0.08, 1.4, C.boneGrey, 0, 0.5, 5.5));
  for (let i = 0; i < 5; i++) { const r = box(0.07, 0.07, 1.1, C.heron, -0.5 + i * 0.25, 0.2, -0.6, 0.6 + i * 0.25); r.rotation.x = 0.4; g.add(r); }
  for (const s of [-1, 1]) g.add(box(0.06, 0.06, 2.6, C.boneGrey, s * 0.4, 0.1, -2, s * 0.3));
  for (let i = 0; i < 8; i++) { const h = 3 + hash(i, 1) * 2.5, b = box(0.12, h, 0.12, C.reedDry, (hash(i, 2) - 0.5) * 3, h / 2, (hash(i, 3) - 0.5) * 6); b.rotation.z = (hash(i, 4) - 0.5) * 0.5; g.add(b); }
  return g;
}

// ---------------------------------------------------------------- the boat and the sack
/** A long cane pole leaning out over the water to local +x at `a` rad, its butt at height `y0`, its line slack to a cork
 *  float. `held` 1: nothing holds it but the hands of whoever sits behind it (Bluto, see `blutoSeated`); otherwise it is
 *  clamped to a gunwale. */
export function fishingPole(d: Dims): THREE.Group {
  const L = d.len ?? 12, a = d.a ?? 0.42, y0 = d.y0 ?? 1.8, g = grp();
  const pole = cyl(0.05, 0.11, L, C.cane, (L / 2) * Math.cos(a), y0 + (L / 2) * Math.sin(a), 0, 6); pole.rotation.z = a - Math.PI / 2; g.add(pole);
  for (let i = 1; i < 6; i++) { const t = (i / 6) * L * 0.8; g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.012, 0.13 - i * 0.012, 0.08, 6), mat(C.pole)), t * Math.cos(a), y0 + t * Math.sin(a), 0, 0, 0, a - Math.PI / 2)); }
  if (!d.held) g.add(box(0.5, 0.5, 0.4, C.iron, 0.2, y0, 0));
  const tx = L * Math.cos(a), ty = y0 + L * Math.sin(a), fx = tx + 2.2;
  const ln = box(0.03, Math.hypot(fx - tx, ty), 0.03, C.line, (tx + fx) / 2, ty / 2, 0); ln.rotation.z = Math.atan2(fx - tx, ty); g.add(ln);
  g.add(place(lump(0.22, C.float, 1, 1, 1.3, 1, 0), fx, 0.15, 0), cone(0.1, 0.3, C.floatRed, fx, 0.5, 0, 5));
  g.add(place(new THREE.Mesh(ringGeo(0.6, 0.75, RING_Y, 14), mat(C.ring)), fx, 0, 0));
  return g;
}
/** Where Bluto's pole lies relative to his figure (shared with wild_l.py): its butt `BLUTO_POLE.z` ft in front of his
 *  hips at `BLUTO_POLE.y` over the boards, rising at `BLUTO_POLE.a` rad straight ahead of him. */
export const BLUTO_POLE = { z: 0.5, y: 0.95, a: 0.55 };
/** A limb: a tapered cylinder from a to b. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: string): THREE.Mesh {
  const dir = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, dir.length(), 6), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return m;
}
/** Bluto Krogarov sitting slumped on a thwart, facing local +z: origin on the boards under his hips, the seat 0.9 ft up,
 *  knees drawn up, back bowed and head hung over them, elbows on his knees and both fists on the butt of his pole (the
 *  separate l-fishing-pole, laid where `BLUTO_POLE` says), a shapeless felt hat. About 4 ft tall as he sits. */
export function blutoSeated(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp(), V = (x: number, y: number, z: number) => new THREE.Vector3(x * s, y * s, z * s);
  // legs: thighs forward and a little up from the seat, shins down to boots on the boards
  for (const sx of [-1, 1]) {
    const hip = V(sx * 0.3, 1.12, 0.05), knee = V(sx * 0.44, 1.55, 1.18), ankle = V(sx * 0.38, 0.32, 1.36);
    g.add(limb(hip, knee, 0.26 * s, 0.22 * s, C.breeches), limb(knee, ankle, 0.21 * s, 0.17 * s, C.breeches), place(new THREE.Mesh(new THREE.SphereGeometry(0.23 * s, 6, 4), mat(C.breeches)), knee.x, knee.y, knee.z));
    g.add(box(0.46 * s, 0.5 * s, 0.82 * s, C.boot, sx * 0.38 * s, 0.25 * s, 1.52 * s));
  }
  g.add(box(1.15 * s, 0.5 * s, 0.85 * s, C.breeches, 0, 1.15 * s, 0.02 * s));
  // the body bowed forward from the hips, the shoulders rounded and dropped
  const up = grp(); up.position.set(0, 1.3 * s, 0); up.rotation.x = 0.62; g.add(up);
  const torso = cyl(0.7 * s, 0.62 * s, 2.0 * s, C.coat, 0, 1.0 * s, 0, 7); torso.scale.z = 0.66; up.add(torso);
  up.add(cyl(0.68 * s, 0.82 * s, 0.6 * s, C.coat, 0, 0.15 * s, 0.02 * s, 7), cyl(0.66 * s, 0.66 * s, 0.2 * s, C.coatDark, 0, 0.38 * s, 0, 7));   // skirt of the coat, belt
  const hump = place(new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 7, 5), mat(C.coat)), 0, 1.72 * s, -0.2 * s); hump.scale.set(1.2, 0.75, 0.85); up.add(hump);
  for (const sx of [-1, 1]) up.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 6, 4), mat(C.coat)), sx * 0.7 * s, 1.8 * s, 0.02 * s));
  up.add(place(cyl(0.16 * s, 0.2 * s, 0.4 * s, C.skin, 0, 2.12 * s, 0.14 * s), 0, 2.12 * s, 0.14 * s, 0, 0.35));
  // the head hung low, chin on the chest, under a sagging hat
  const head = grp(); head.position.set(0, 2.52 * s, 0.32 * s); head.rotation.x = 0.45; up.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), mat(C.skin)); skull.scale.set(0.92, 1.05, 0.95); head.add(skull);
  head.add(box(0.13 * s, 0.2 * s, 0.16 * s, C.skin, 0, -0.06 * s, 0.42 * s), place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.43 * s, 1), mat(C.hair)), 0, 0.02 * s, -0.12 * s));
  const crown = place(new THREE.Mesh(new THREE.SphereGeometry(0.46 * s, 8, 5), mat(C.hat)), 0, 0.2 * s, -0.02 * s); crown.scale.y = 0.62; head.add(crown);
  const brim = cyl(0.64 * s, 0.64 * s, 0.06 * s, C.hat, 0, 0.12 * s, 0.02 * s, 10); brim.rotation.x = 0.12; head.add(brim);
  // arms: shoulder to an elbow on the knee to a fist on the pole
  g.updateMatrixWorld(true);
  const tan = Math.tan(BLUTO_POLE.a), onPole = (u: number) => V(0, BLUTO_POLE.y + u * tan, BLUTO_POLE.z + u);
  for (const [sx, u] of [[-1, 0.72], [1, 1.28]] as const) {
    const sh = new THREE.Vector3(sx * 0.7 * s, 1.8 * s, 0.02 * s).applyMatrix4(up.matrixWorld), hand = onPole(u).add(V(sx * 0.07, 0.1, 0)), elbow = V(sx * 0.66, 1.78, 1.02 + u * 0.25);
    g.add(limb(sh, elbow, 0.2 * s, 0.17 * s, C.coat), limb(elbow, hand, 0.17 * s, 0.14 * s, C.coat), place(new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 6, 4), mat(C.skin)), hand.x, hand.y, hand.z));
  }
  return g;
}
/** The sack: `s` 0 going under beside the boat, half sunk in a ring of bubbles; `s` 1 lying in the silt on the bottom. */
export function sinkingSack(d: Dims): THREE.Group {
  const g = grp(), sunk = (d.s ?? 0) === 1;
  const body = grp(place(lump(1, sunk ? C.burlapWet : C.burlap, 3, 1.75, 0.6, 0.8, 1), 0, 0.6, 0), cone(0.35, 0.6, C.burlap, 1.95, 0.6, 0, 5).rotateZ(-Math.PI / 2));
  for (const x of [-0.7, 0.5, 1.5]) body.add(place(new THREE.Mesh(new THREE.TorusGeometry(x > 1 ? 0.33 : 0.62, 0.07, 4, 10), mat(C.twine)), x, 0.6, 0, Math.PI / 2));
  if (sunk) { body.rotation.y = 0.6; g.add(body, place(lump(2.4, C.siltPale, 5, 1.4, 0.18, 1.1, 1), 0.2, 0, 0)); }
  else {
    body.position.y = -0.55; body.rotation.z = 0.5; g.add(body);
    for (let i = 0; i < 14; i++) { const a = hash(i, 1) * Math.PI * 2, r = 1.2 + hash(i, 2) * 2.2; g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + hash(i, 3) * 0.14, 0), mat(C.bubble)), Math.cos(a) * r, RING_Y * 0.6, Math.sin(a) * r)); }
    g.add(new THREE.Mesh(merge([ringGeo(2.6, 2.9, RING_Y, 24), ringGeo(4.4, 4.65, RING_Y, 28)]), mat(C.ring)));
  }
  return g;
}
/** Hidden finds as small things on the ground: `v` 0 coins and a silver charm in the mud, 1 a sealed clay jar,
 *  2 a coil of hempen rope and an empty burlap sack with a child's ribbon caught on a nail above them. */
export function cache(d: Dims): THREE.Group {
  const v = d.v ?? 0, g = grp();
  if (v === 0) { for (let i = 0; i < 9; i++) g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 7), mat(i === 4 ? C.charm : C.copper)), (hash(i, 1) - 0.5) * 2.4, 0.05, (hash(i, 2) - 0.5) * 1.8)); }
  else if (v === 1) g.add(cyl(0.5, 0.65, 1.3, C.clay, 0, 0.65, 0, 8), cyl(0.3, 0.45, 0.35, C.clay, 0, 1.45, 0, 8), cyl(0.32, 0.32, 0.12, C.bucket, 0, 1.65, 0, 8));
  else {
    for (let k = 0; k < 3; k++) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.8 - k * 0.1, 0.14, 4, 12), mat(C.rope)), -0.8, 0.15 + k * 0.24, 0, 0, Math.PI / 2));
    g.add(place(lump(0.8, C.burlap, 4, 1.4, 0.25, 1, 0), 1.0, 0.15, 0.2), box(0.08, 0.08, 0.3, C.nail, 0.2, 4.6, -0.3), box(0.15, 1.1, 0.04, C.ribbon, 0.2, 4.0, -0.25));
  }
  return g;
}

// ---------------------------------------------------------------- the lakebed level
/** The lakebed forty feet down: grey-brown silt over `w` × `d` ft with ripple marks and bands of murk, the bed rising at
*  the south (+z) edge toward the shelf, weed in clumps, and a faint green shaft of light falling at (`lx`,`lz`) (local ft). */
export function lakebedSilt(d: Dims): THREE.Group {
  const W = d.w ?? 300, D = d.d ?? 400, g = grp();
  g.add(flat([[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]], 0.02, mat(C.silt)));
  // ripple marks: long low ridges across the bed
  const rip: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) { const x = (hash(i, 1) - 0.5) * W * 0.95, z = (hash(i, 2) - 0.5) * D * 0.9, L = 8 + hash(i, 3) * 14; const b = new THREE.BoxGeometry(L, 0.2, 0.5); b.rotateY(0.25 + (hash(i, 4) - 0.5) * 0.3); b.translate(x, 0.1, z); rip.push(b); }
  g.add(new THREE.Mesh(merge(rip), mat(C.siltPale)));
  for (let i = 0; i < 12; i++) { const x = (hash(i, 5) - 0.5) * W * 0.9, z = (hash(i, 6) - 0.5) * D * 0.9; g.add(flat(wisp(10 + hash(i, 7) * 14, i, 1.8).map(([a, b]) => [a + x, b + z] as P2), 0.03, mat(C.siltDark))); }
  // the rise toward the shelf along the south edge
  const v: THREE.Vector3[] = [], n = 16;
  for (let i = 0; i < n; i++) {
    const xa = -W / 2 + (i / n) * W, xb = -W / 2 + ((i + 1) / n) * W, ja = hash(i, 9) * 4, jb = hash(i + 1, 9) * 4;
    const A = new THREE.Vector3(xa, 0, D / 2 - 30 - ja), B = new THREE.Vector3(xb, 0, D / 2 - 30 - jb), Cc = new THREE.Vector3(xb, 30, D / 2 + jb * 0.5), Dd = new THREE.Vector3(xa, 30, D / 2 + ja * 0.5);
    v.push(A, Cc, B, A, Dd, Cc);
  }
  g.add(new THREE.Mesh(upTris(v), mat(C.siltPale)));
  // murk hanging over the bed, and the light from above
  for (let i = 0; i < 26; i++) { const x = (hash(i, 61) - 0.5) * W * 0.9, z = (hash(i, 62) - 0.5) * D * 0.85; for (let k = 0; k < 4; k++) { const h = 1.5 + hash(i * 4 + k, 63) * 3.5, b = box(0.25, h, 0.12, k % 2 ? C.weed : C.weedSlick, x + (hash(k, i) - 0.5) * 2, h / 2, z + (hash(k, i + 9) - 0.5) * 2); b.rotation.z = (hash(k, i + 3) - 0.5) * 0.6; g.add(b); } }
  g.add(backdropSwitch(false));
  if (d.lx !== undefined) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6, 13, 38, 10, 1, true), fogMat(C.shaft, 0.12)); shaft.position.set(d.lx, 19, d.lz ?? 0); g.add(shaft);
    g.add(flat(wisp(11, 3, 1.2).map(([a, b]) => [a + d.lx!, b + (d.lz ?? 0)] as P2), 0.05, fogMat(C.shaft, 0.25)));
  }
  return g;
}
/** A rotted rowboat lying on its side in the silt, ribs showing, a rusted anchor and a sealed clay jar inside it. */
export function sunkenSkiff(): THREE.Group {
  const hull = grp();
  for (let i = 0; i < 8; i++) { const x = -5 + i * 1.4, w = 3.6 - Math.abs(x) * 0.25; const rib = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.24, 4, 10, Math.PI), mat(C.skiffDark)); rib.position.set(x, 0, 0); rib.rotation.set(0, Math.PI / 2, Math.PI); hull.add(rib); }
  hull.add(box(12, 0.3, 0.6, C.skiff, 0, -1.8, 0), box(10, 1.1, 0.18, C.skiff, -0.3, -1.1, -1.5), box(6, 0.9, 0.18, C.skiff, 1.5, -0.8, 1.6));
  hull.rotation.x = 1.15; hull.position.y = 1.6;
  const g = grp(hull, place(lump(2.6, C.siltPale, 2, 1.8, 0.25, 1.2, 1), 0, 0, 0.5));
  g.scale.setScalar(1.25);
  const anchor = grp(box(0.25, 2.2, 0.25, C.anchor, 0, 1.1, 0), box(1.8, 0.25, 0.25, C.anchor, 0, 0.2, 0), place(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 4, 8), mat(C.anchor)), 0, 2.4, 0));
  anchor.rotation.z = 1.3; anchor.position.set(-2.4, 0.3, 1.2); g.add(anchor);
  g.add(cyl(0.45, 0.6, 1.2, C.clay, 2.0, 0.6, 1.1, 8), cyl(0.3, 0.42, 0.3, C.clay, 2.0, 1.35, 1.1, 8));
  return g;
}
/** The pier-pine's drowned crown where it hangs over the drop-off on the bed: dark limbs and weed. */
export function drownedCrown(): THREE.Group {
  const g = grp(place(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 22, 7).rotateX(Math.PI / 2), mat(C.logBlack)), 0, 9, 4, 0, -0.75));
  for (let i = 0; i < 14; i++) { const len = 5 + hash(i, 1) * 7, b = box(len, 0.3, 0.3, C.logBlack, (hash(i, 2) - 0.5) * 8, 2 + hash(i, 3) * 14, (hash(i, 4) - 0.5) * 10); b.rotation.set((hash(i, 5) - 0.5) * 1.2, hash(i, 6) * 6, (hash(i, 7) - 0.5) * 1.4); g.add(b); }
  for (let i = 0; i < 6; i++) g.add(place(lump(1.2 + hash(i, 8), C.weed, i, 1.2, 1.8, 1, 0), (hash(i, 9) - 0.5) * 8, 3 + hash(i, 10) * 8, (hash(i, 11) - 0.5) * 8));
  return g;
}

const L_PROPS: Record<string, (d: Dims) => THREE.Object3D> = {
  'l-lake-mirror': lakeMirror, 'l-drop-off': dropOff, 'l-mist-shelf': mistShelf, 'l-ripple-ring': rippleRing, 'l-shingle-beach': shingleBeach, 'l-mooring-stake': mooringStake,
  'l-trotline': trotline, 'l-pier-pine': pierPine, 'l-net-rack': netRack, 'l-scorched-fish': scorchedFish, 'l-gutting-slab': guttingSlab, 'l-offal-midden': offalMidden,
  'l-wolf-head-stake': wolfHeadStake, 'l-blazed-pine': blazedPine, 'l-black-tooth': blackTooth, 'l-watch-knoll': watchKnoll, 'l-bluff-face': bluffFace,
  'l-brook': brook, 'l-plank-crossing': plankCrossing, 'l-trail-ruts': trailRuts, 'l-fish-crate': fishCrate, 'l-drift-log': driftLog, 'l-offering-stone': offeringStone,
  'l-heron-bones': heronBones, 'l-fishing-pole': fishingPole, 'l-sinking-sack': sinkingSack, 'l-cache': cache,
  'l-lakebed-silt': lakebedSilt, 'l-sunken-skiff': sunkenSkiff, 'l-drowned-crown': drownedCrown,
};
// the water and the fog lid are drawn whole (their sheets carry painted opacity and their own draw order); everything
// else collapses to a mesh per material
const WHOLE = new Set(['l-lake-mirror', 'l-mist-shelf', 'l-lakebed-silt']);
Object.assign(PROPS_V1, Object.fromEntries(Object.entries(L_PROPS).map(([k, f]) => [k, WHOLE.has(k) ? f : (d: Dims) => compact(f(d))])));
// Bluto sits in his boat: a figure of his own (the standing villager would have him upright at the stern)
Object.assign(CREATURES, { 'l-bluto': (d: Dims) => blutoSeated(d) });
void PALETTE;
