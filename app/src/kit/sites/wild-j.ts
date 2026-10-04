// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'j-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// J, the Gates of Ravenloft: the road's end on a spur of rock, the fog-filled chasm, the old drawbridge on its chains,
// the gate in the castle's west wall and the one warm light beyond it. Feet; origin at the floor centre; +z is plan
// south for an unturned piece; fog and veils are the only see-through things.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor, type Surface } from '../surfaces';
import { merge } from '../pieces';
import { blackCarriage, gargoyleStatue } from './wild';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  rock: '#5a5853', rockDeep: '#4e4c48', rockPale: '#66635d', rockDark: '#3f3e3b', scree: '#77736c', screeDark: '#5f5b55',
  frost: '#c3ccd3', ice: '#1d262d', iceSheen: '#33414b', icicle: '#bccdd9',
  wall: '#77736b', wallDeep: '#66625b', slit: '#16151a', flag: '#6d6a64',
  timber: '#5d5145', timberDeep: '#463c33', plank: '#6e6255', plankRot: '#3f382f', plankPale: '#7d725f',
  iron: '#2e2f33', rust: '#4a3329', streak: '#6b4a35', greased: '#8d949c',
  turf: '#4d5a3f', moss: '#38432f', mud: '#4a4038', rut: '#352f2a',
  pine: PALETTE.pine, pineDeep: PALETTE.pineDeep, bark: '#45362a', barkDead: '#6b625a',
  bone: PALETTE.bone, mail: '#57514a', leather: '#3d2c22', purse: '#5a4632',
  amber: PALETTE.amber, glow: '#ffb54d', glass: '#0d0c10', shard: '#9aa6b0', charcoal: '#1c1a1a',
  cloak: '#120f14', cloakTrim: '#2a1a22', pale: '#d8d3d0', bat: '#1a161b', batWing: '#26202a',
  mist0: '#dcdee2', mist1: '#c7cad0', deep0: '#24252a', deep1: '#383a41', deep2: '#555962', deep3: '#767b85',
} as const;
surfaceFor([C.rock, C.rockDeep, C.rockPale, C.rockDark, C.scree], 'rock');
surfaceFor([C.screeDark], 'stone');
surfaceFor([C.wall, C.wallDeep], 'ashlar');
surfaceFor([C.flag], 'flag');
surfaceFor([C.timber, C.timberDeep, C.plank, C.plankRot, C.plankPale], 'wood');
surfaceFor([C.iron, C.rust, C.greased], 'metal');
surfaceFor([C.turf], 'grass');
surfaceFor([C.moss], 'foliage');
surfaceFor([C.mud, C.rut], 'dirt');
surfaceFor([C.bark, C.barkDead], 'bark');
surfaceFor([C.ice, C.iceSheen], 'water');
surfaceFor([C.frost, C.icicle, C.slit, C.glass, C.shard, C.mist0, C.mist1, C.deep2, C.deep3, C.charcoal, C.glow, C.streak], 'none');
surfaceFor([C.deep0, C.deep1], 'rock');
surfaceFor([C.cloak, C.cloakTrim, C.leather, C.purse, C.mail], 'cloth');
surfaceFor([C.pale, C.bat, C.batWing], 'generic');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 8) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 6) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c)), x, y, z);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const glowMat = (c: string, e: string) => mat(c, { emissive: e });
/** A faceted lump (rock, billow, sack): an icosahedron with its vertices pushed in and out, then squashed. */
function lump(r: number, color: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1, surface?: Surface): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, surface ? { surface } : {}));
}
/** A rod (a trunk, a strut, a bone) from a to b, radius r0 at a and r1 at b. */
function rod(a: [number, number, number], b: [number, number, number], r0: number, r1: number, c: string, seg = 6): THREE.Mesh {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length() || 0.01;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, seg), mat(c));
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
/** A flat plate of the given plan outline (x, z pairs) lying at height y. */
function plate(pts: [number, number][], y: number, c: string | THREE.Material): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c);
}
/** A ragged roughly elliptical outline rx × rz (plan), for patches of ice, mud and fog. */
function ragged(rx: number, rz: number, seed: number, n = 12, j = 0.3): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 - j / 2 + j * hash(i, seed); out.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]); }
  return out;
}
/** One wheel rut `len` long along local x at local z: broken lengths of churned mud with darker water-filled hollows. */
function rutLine(len: number, z: number, seed: number, y: number, w = 1.1, color: string = C.mud): THREE.Group {
  const g = grp(), n = Math.max(2, Math.round(len / 4.5));
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + (i / n) * len, seg = (len / n) * (0.75 + hash(i, seed) * 0.35), x = x0 + seg / 2 + (hash(i, seed + 1) - 0.5) * 0.6;
    g.add(box(seg, 0.04, w * (0.8 + hash(i, seed + 2) * 0.4), color, x, y, z + (hash(i, seed + 3) - 0.5) * 0.25));
    if (color === C.mud && hash(i, seed + 4) > 0.55) g.add(box(seg * 0.5, 0.05, w * 0.45, C.rut, x, y + 0.01, z));
  }
  return g;
}
/** Fog: the palette's mist grey, lit like everything else but see-through and drawn without depth writes (cached). */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; m.flatShading = false; fogMats.set(k, m); }
  return m;
}
/** Unlit see-through glow (cached): light pooled on stone, which is not lit by anything else. */
const veils = new Map<string, THREE.MeshBasicMaterial>();
function veil(color: string, opacity: number): THREE.MeshBasicMaterial {
  const k = color + opacity;
  let m = veils.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); veils.set(k, m); }
  return m;
}
/** One mesh per material: a piece that is drawn on its own (fog, hidden things, the chasm) costs a few draws, not dozens. */
function fuse(g: THREE.Group): THREE.Group {
  g.updateMatrixWorld(true);
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; const k = m.material as THREE.Material; const a = by.get(k) ?? []; a.push(m.geometry.clone().applyMatrix4(m.matrixWorld)); by.set(k, a); });
  const out = new THREE.Group();
  for (const [m, gs] of by) out.add(new THREE.Mesh(merge(gs), m));
  return out;
}

// ---------------------------------------------------------------- the land: crag, scree, ice, terraces, pines
/** A frost-split crag wall `len` long (local x), its face toward local +z, `h` high and `d` deep: columns of rock
 *  broken at differing heights, ledges, cracks, moss and rime on the steps, talus at its foot. */
export function cragWall(d: Dims): THREE.Group {
  const L = d.len ?? 60, H = d.h ?? 70, D = d.d ?? 30, sd = d.seed ?? 0, g = grp(), COL = [C.rock, C.rockDeep, C.rockPale];
  const n = Math.max(3, Math.round(L / 8));
  for (let i = 0; i < n; i++) {
    const w = (L / n) * (0.95 + hash(i, sd) * 0.3), x = -L / 2 + (i + 0.5) * (L / n), hh = H * (0.55 + 0.45 * hash(i, sd + 1)), dd = D * (0.6 + 0.4 * hash(i, sd + 2));
    const z = -dd / 2 + (hash(i, sd + 3) - 0.5) * 3;
    const col = box(w, hh, dd, COL[i % 3], x, hh / 2, z, (hash(i, sd + 4) - 0.5) * 0.16); col.rotation.x = (hash(i, sd + 5) - 0.6) * 0.06; g.add(col);
    g.add(place(lump(w * 0.55, COL[(i + 1) % 3], sd * 7 + i, 1, 0.55, dd / w * 0.9, 0, 'rock'), x, hh, z));                 // a broken, rounded top
    for (let k = 0; k < 2; k++) if (hash(i * 3 + k, sd + 6) > 0.35) {
      const y = hh * (0.25 + 0.5 * hash(i * 3 + k, sd + 7));
      g.add(box(w * 0.8, 0.9, 2.2, C.rockDark, x + (hash(k, i) - 0.5) * 2, y, z + dd / 2 + 0.6));                            // a ledge
      g.add(box(w * 0.7, 0.25, 1.6, k && hash(i, sd + 14) > 0.6 ? C.frost : C.moss, x + (hash(k, i) - 0.5) * 2, y + 0.55, z + dd / 2 + 0.5));           // rime or moss on it
    }
    if (hash(i, sd + 8) > 0.45) g.add(box(0.5, hh * 0.6, 0.3, C.slit, x + w * (hash(i, sd + 9) - 0.5) * 0.7, hh * 0.45, z + dd / 2 + 0.05)); // a frost crack
  }
  for (let i = 0; i < Math.round(L / 3); i++) g.add(place(lump(0.5 + hash(i, sd + 11) * 1.3, COL[i % 3], i + sd, 1.3, 0.6, 1.1, 0, 'rock'), (hash(i, sd + 12) - 0.5) * L, 0.3, 1 + hash(i, sd + 13) * 4));
  return g;
}

/** A fan of loose grey scree spilling from a crag foot (local -z) onto a road verge (local +z), `w` across, `d` long. */
export function screeFan(d: Dims): THREE.Group {
  const W = d.w ?? 40, D = d.d ?? 30, g = grp(), COL = [C.scree, C.rockPale, C.rock, C.screeDark];
  const fan: [number, number][] = [[-W * 0.12, -D / 2], [W * 0.12, -D / 2], [W * 0.5, D * 0.35], [W * 0.3, D / 2], [0, D * 0.55], [-W * 0.32, D / 2], [-W * 0.5, D * 0.3]];
  g.add(plate(fan, 0.1, C.screeDark));
  const n = Math.min(110, Math.round((W * D) / 11));
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt(hash(i, 1)), z = -D / 2 + t * D, x = (hash(i, 2) - 0.5) * W * (0.2 + 0.8 * t), r = 0.3 + hash(i, 3) * (0.5 + t * 0.9);
    g.add(place(lump(r, COL[i % 4], i, 1.3, 0.55, 1.1, 0, i % 4 === 3 ? 'stone' : 'rock'), x, r * 0.25, z, hash(i, 4) * 6));
  }
  return g;
}

/** Black ice glazing the road where a seep crosses it: `len` along the road (local x), `w` across. Hoof and wheel
 *  scores in the glaze, a frozen trickle from the crag side (local -z) and icicles from a rock lip `lip` ft beyond. */
export function verglas(d: Dims): THREE.Group {
  const L = d.len ?? 30, W = d.w ?? 16, lip = d.lip ?? 3, g = grp();
  g.add(plate(ragged(L / 2 + 1, W / 2 + 0.8, 3, 16, 0.18), 0.12, C.frost), plate(ragged(L / 2, W / 2, 5, 16, 0.2), 0.14, C.ice), plate(ragged(L / 3, W / 3.2, 9, 10, 0.3), 0.15, C.iceSheen));
  for (let i = 0; i < 14; i++) { const s = box(1.6 + hash(i, 1) * 3, 0.03, 0.14, i % 3 ? C.frost : C.shard, (hash(i, 2) - 0.5) * L * 0.8, 0.16, (hash(i, 3) - 0.5) * W * 0.7, (hash(i, 4) - 0.5) * 0.5); g.add(s); }
  for (let i = 0; i < 6; i++) g.add(place(lump(0.6 + hash(i, 5) * 0.5, C.icicle, i, 1.6, 0.3, 0.9, 0), (hash(i, 6) - 0.5) * 6, 0.2, -W / 2 - i * 0.9));   // the frozen seep
  // a frozen fall down the crag face and a fringe of icicles from the lip above the verge
  const zl = -W / 2 - lip;
  g.add(box(L * 0.55, 1.1, 2.6, C.rockDark, 0, 8.2, zl - 0.6), box(3.2, 8, 0.8, C.icicle, -2, 4, zl - 1.4), box(2, 6, 0.7, C.frost, 2.5, 3.6, zl - 1.5));
  g.add(box(L * 0.6, 8, 3.2, C.rockDeep, 0, 4, zl - 3.4), place(lump(3, C.rock, 7, 1.6, 1.2, 0.8, 0, 'rock'), -L * 0.22, 2.2, zl - 3), place(lump(2.6, C.rockPale, 9, 1.4, 1, 0.8, 0, 'rock'), L * 0.24, 1.8, zl - 3.2));   // the rock outcrop the lip juts from
  for (let i = 0; i < 16; i++) { const ic = cone(0.16 + hash(i, 7) * 0.12, 1.2 + hash(i, 8) * 2.6, i % 2 ? C.icicle : C.frost, -L * 0.25 + (i / 15) * L * 0.5, 7.6 - (0.6 + hash(i, 8) * 1.3), zl + 0.3 + hash(i, 9) * 0.6, 5); ic.rotation.x = Math.PI; g.add(ic); }
  return g;
}

/** A stepped rock edge `len` long (local x), the ground falling `h` ft toward local +z: a broken lip of tilted slabs,
 *  the steep face drawn as a band of dark shelving rock, talus at its foot. `talus` 0 leaves the foot to the fog. */
export function rockTerrace(d: Dims): THREE.Group {
  const L = d.len ?? 60, H = d.h ?? 12, sd = d.seed ?? 0, g = grp(), F = Math.min(9, 2.5 + H * 0.35);
  const n = Math.max(3, Math.round(L / 4.2));
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n) + (hash(i, sd) - 0.5) * 1.5, w = 3.4 + hash(i, sd + 1) * 2.2;
    if (hash(i, sd + 2) > 0.18) { const s = box(w, 0.9 + hash(i, sd + 3) * 1.2, 2 + hash(i, sd + 4) * 1.6, i % 3 ? C.rockPale : C.rock, x, 0.35, -0.4, (hash(i, sd + 5) - 0.5) * 0.4); s.rotation.x = 0.18 + hash(i, sd + 6) * 0.3; g.add(s); }
    for (let k = 0; k < 3; k++) {   // the face: shelving slabs stepping down and out
      const z = 0.8 + (k + 0.5) * (F / 3), s = box(w * (0.9 - k * 0.12), 0.35, F / 3 + 0.4, k === 1 ? C.rockDark : C.rockDeep, x + (hash(i * 3 + k, sd + 7) - 0.5) * 1.2, 0.3 - k * 0.07, z, (hash(i * 3 + k, sd + 8) - 0.5) * 0.3);
      s.rotation.x = 0.28; g.add(s);
    }
  }
  if (d.talus ?? 1) for (let i = 0; i < Math.round(L / 2.2); i++) g.add(place(lump(0.4 + hash(i, sd + 9) * 0.9, i % 2 ? C.rock : C.scree, i + sd, 1.3, 0.5, 1.1, 0, 'rock'), (hash(i, sd + 10) - 0.5) * L, 0.2, F + 1 + hash(i, sd + 11) * H * 0.4));
  return g;
}

/** A wind-flagged dwarf pine: a short trunk leaning downwind (local +x), every bough streaming to the lee side, the
 *  windward side bare and silvered. `h` its height, `scale`, `seed`. */
export function krummholz(d: Dims): THREE.Group {
  const s = d.scale ?? 1, H = (d.h ?? 11) * s, sd = d.seed ?? 0, g = grp(), lean = 0.12 + hash(1, sd) * 0.14;
  const p1: [number, number, number] = [H * lean, H * 0.5, (hash(2, sd) - 0.5) * 0.6], p2: [number, number, number] = [H * lean * 2.1, H * 0.9, (hash(3, sd) - 0.5) * 0.8];
  g.add(rod([0, 0, 0], p1, 0.42 * s, 0.3 * s, C.bark), rod(p1, p2, 0.3 * s, 0.14 * s, C.bark), rod(p2, [p2[0] - 0.3, H * 1.05, p2[2]], 0.12 * s, 0.05 * s, C.barkDead));
  g.add(cyl(0.6 * s, 0.85 * s, 0.6 * s, C.bark, 0, 0.3 * s, 0, 6));
  g.add(place(lump(1, C.pineDeep, sd + 9, H * 0.42, 0.9 * s, H * 0.22, 0), H * 0.3, 0.5 * s, 0));               // the low mat of boughs hugging the ground to leeward
  for (let i = 0; i < 4; i++) {
    const t = 0.24 + i * 0.18, y = H * t, tx = H * lean * 2.1 * t, len = H * (0.78 - i * 0.12) * (0.9 + hash(i, sd + 4) * 0.3);
    const pad = lump(1, i % 2 ? C.pineDeep : C.pine, sd + i, len * 0.55, (0.8 + 0.3 * s) * (1 - i * 0.1), H * (0.2 - i * 0.03), 0);
    g.add(place(pad, tx + len * 0.4, y, (hash(i, sd + 5) - 0.5) * 1.2, 0, 0, -0.1));
    g.add(rod([tx, y, 0], [tx - 1.1 * s, y + 0.3, (hash(i, sd + 6) - 0.5)], 0.08 * s, 0.03 * s, C.barkDead, 4));   // a dead windward twig
  }
  return g;
}

// ---------------------------------------------------------------- the road's end: apron, ruts, loop, spout, notch
/** The old thoroughfare's setts showing through the dirt over `w` × `d`: mud lying over the cobbles toward the west end,
 *  loose setts at the edges, one pair of wheel ruts down its length and a carved gutter along its south side. */
export function cobbleApron(d: Dims): THREE.Group {
  const W = d.w ?? 85, D = d.d ?? 50, g = grp();
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + hash(i, 1) * W * (i < 5 ? 0.35 : 1), z = (hash(i, 2) - 0.5) * D * 0.9;
    g.add(place(plate(ragged(4 + hash(i, 3) * 7, 2.5 + hash(i, 4) * 4, i + 20, 10, 0.4), 0.16, C.mud), x, 0, z));
  }
  for (let i = 0; i < 40; i++) { const e = i % 2 ? 1 : -1, x = (hash(i, 5) - 0.5) * W, z = e * (D / 2 - hash(i, 6) * 3); g.add(box(0.9, 0.35, 0.7, i % 3 ? '#5f6167' : C.screeDark, x, 0.17, z, hash(i, 7) * 3)); }
  for (const z of [-3.05, 3.05]) g.add(rutLine(W, z, z + 5, 0.17));
  // the gutter: two kerbs and the dark channel between them, running east to the spout
  const gz = D / 2 - 1.6, gx0 = -W / 2 + 10;
  g.add(box(W / 2 - gx0, 0.5, 0.6, C.wallDeep, (gx0 + W / 2) / 2, 0.25, gz - 0.75), box(W / 2 - gx0, 0.5, 0.6, C.wallDeep, (gx0 + W / 2) / 2, 0.25, gz + 0.75), box(W / 2 - gx0, 0.08, 0.9, C.rut, (gx0 + W / 2) / 2, 0.12, gz));
  return g;
}
/** One pair of carriage ruts `len` ft along local x, `gauge` apart; `deep` 1 cuts them wide with mud pushed up. */
export function ruts(d: Dims): THREE.Group {
  const L = d.len ?? 20, G = d.gauge ?? 6.1, deep = d.deep ?? 0, g = grp();
  for (const z of [-G / 2, G / 2]) {
    g.add(rutLine(L, z, (d.seed ?? 0) + z, 0.17, deep ? 1.5 : 1.1));
    if (deep) for (const s of [-1, 1]) g.add(rutLine(L * 0.9, z + s * 1.0, z + s + 7, 0.19, 0.4, PALETTE.dirt));
  }
  return g;
}
/** The carriage's ruts sweeping out of the cobbles (local -z edge) through the turf in a loop and back, `w` × `d`,
 *  the turf between them worn to earth. `fresh` 1 draws only the pale fresh-cut edges (what a tracker reads). */
export function turningLoop(d: Dims): THREE.Group {
  const W = d.w ?? 70, D = d.d ?? 45, fresh = d.fresh ?? 0, g = grp(), A = W * 0.42, n = 34;
  const at = (t: number) => new THREE.Vector2(-A * Math.cos(Math.PI * t), -D / 2 + D * 0.95 * Math.sin(Math.PI * t));
  for (let i = 0; i < n; i++) {
    const a = at(i / n), b = at((i + 1) / n), m = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a), len = dir.length() + 0.15, ang = Math.atan2(-dir.y, dir.x);
    const nx = -dir.y / dir.length(), nz = dir.x / dir.length();
    for (const s of [-1, 1]) {
      if (fresh) { if (i % 2) g.add(box(len * 0.6, 0.05, 0.1, C.plankPale, m.x + nx * s * 3.75, 0.2, m.y + nz * s * 3.75, ang)); continue; }
      g.add(box(len, 0.04, 1.7, C.mud, m.x + nx * s * 3.05, 0.13, m.y + nz * s * 3.05, ang));
      if (hash(i, s + 3) > 0.3) g.add(box(len * 0.8, 0.05, 0.5, C.rut, m.x + nx * s * 3.05, 0.15, m.y + nz * s * 3.05, ang));
    }
  }
  return g;
}
/** A weathered beast-mouth spout at the end of the apron's gutter, jutting over the chasm lip (local +x) and dripping;
 *  `run` ft of gutter lead to it from local -x. */
export function spout(d: Dims): THREE.Group {
  const R = d.run ?? 22, g = grp();
  g.add(box(R, 0.5, 0.6, C.wallDeep, -R / 2, 0.25, -0.75), box(R, 0.5, 0.6, C.wallDeep, -R / 2, 0.25, 0.75), box(R, 0.08, 0.9, C.rut, -R / 2, 0.12, 0));
  g.add(box(3.4, 1.3, 2.2, C.wallDeep, 0.9, 0.45, 0), box(2.6, 0.3, 0.7, C.rut, 0.8, 1.12, 0));
  const head = place(lump(1.05, C.wall, 5, 1.25, 0.85, 0.95, 1, 'stone'), 2.9, 0.8, 0); g.add(head);
  g.add(box(1.3, 0.35, 1.2, C.wallDeep, 3.5, 0.25, 0), box(0.5, 0.4, 0.9, C.slit, 3.7, 0.62, 0));                        // the jaw and the gaping mouth
  for (const z of [-0.45, 0.45]) { g.add(place(lump(0.16, C.slit, 3, 1, 1, 1, 0), 3.2, 1.25, z)); const h = cone(0.16, 0.8, C.wallDeep, 2.4, 1.75, z, 4); h.rotation.z = 0.8; g.add(h); }
  for (let i = 0; i < 4; i++) { const dr = cone(0.1, 0.8 + i * 0.35, C.icicle, 3.9 + i * 0.08, -0.1 - i * 0.2, (i - 1.5) * 0.18, 4); dr.rotation.x = Math.PI; g.add(dr); }
  g.add(box(4.5, 0.06, 1.6, C.moss, 1.5, 0.92, 0));
  return g;
}
/** A worn bite in the chasm rim (local +x is the chasm): the turf scuffed to bare rock, the lip broken and scored by
 *  fingers. `evidence` 1 draws only what a tracker finds there: the finger-scores and one dropped boot. */
export function rimNotch(d: Dims): THREE.Group {
  const g = grp();
  const scores = () => { for (let i = 0; i < 7; i++) g.add(box(1.4 + hash(i, 2) * 1.2, 0.06, 0.09, C.plankPale, 2.6 + hash(i, 3) * 0.8, 0.22, -2.4 + i * 0.7, 0.3 + hash(i, 4) * 0.4)); };
  if (d.evidence) {
    scores();
    const boot = grp(box(0.6, 1.4, 0.55, C.leather, 0, 0.7, 0), box(1.25, 0.45, 0.6, C.leather, 0.32, 0.22, 0), box(0.68, 0.12, 0.6, C.rut, 0, 1.38, 0));
    g.add(place(boot, -1.6, 0.05, 1.2, 0.6, 0, Math.PI / 2 - 0.15));
    return g;
  }
  g.add(plate(ragged(5.5, 7.5, 31, 12, 0.35).map(([x, z]) => [x - 0.5, z] as [number, number]), 0.14, C.rockPale), plate(ragged(3.2, 4.5, 33, 10, 0.3), 0.16, C.screeDark));
  for (let i = 0; i < 7; i++) g.add(place(lump(0.5 + hash(i, 5) * 0.8, i % 2 ? C.rock : C.rockPale, i, 1.3, 0.5, 1, 0, 'rock'), -4 + hash(i, 6) * 3, 0.2, -6 + i * 2));
  scores();
  return g;
}

// ---------------------------------------------------------------- the bridge and its fittings
/** The mainland sill: a squared stone abutment on the lip (local +x faces the chasm), 24 ft long across the road, an
 *  iron-shod rest worn into a trough where the bridge's end lands, ruts across it, and two worn bollards. */
export function bridgeSill(): THREE.Group {
  const g = grp(box(12, 1.2, 24, C.wall, 0, -0.3, 0), box(12.4, 0.3, 24.4, C.wallDeep, 0, 0.12, 0));
  g.add(box(1.4, 9, 24, C.wallDeep, 6.3, -4.2, 0));                                         // its face going down into the chasm
  g.add(box(6.2, 0.18, 15.8, C.iron, 3, 0.36, 0), box(6.2, 0.4, 0.5, C.rust, 3, 0.45, -8), box(6.2, 0.4, 0.5, C.rust, 3, 0.45, 8));   // the shod rest
  for (const z of [-3.05, 3.05]) g.add(box(6, 0.05, 0.75, C.rut, -3, 0.3, z));
  for (const z of [-10.6, 10.6]) g.add(cyl(0.9, 1.1, 3, C.wallDeep, 1.5, 1.5, z, 8), cyl(1.0, 1.0, 0.3, C.wall, 1.5, 3.1, z, 8));
  for (let i = 0; i < 8; i++) g.add(box(0.8 + hash(i, 1), 0.05, 0.3, C.moss, -5 + hash(i, 2) * 10, 0.29, -11 + hash(i, 3) * 22));
  return g;
}
/** The castle-side pivot: a stone threshold at the tunnel mouth, the bridge's hinge beam on two iron pintles. */
export function hingeSill(): THREE.Group {
  const g = grp(box(5, 0.6, 22, C.wallDeep, 0.5, 0.0, 0), box(5.2, 0.15, 22, C.flag, 0.5, 0.35, 0));
  const beam = cyl(0.55, 0.55, 15.4, C.timberDeep, -0.9, 0.55, 0, 8); beam.rotation.x = Math.PI / 2; g.add(beam);
  for (const z of [-5.5, 5.5]) { g.add(box(1.6, 1.4, 0.8, C.iron, -0.9, 0.55, z), box(2.4, 0.3, 1.2, C.iron, 0.3, 0.42, z)); const pin = cyl(0.22, 0.22, 1.4, C.rust, -0.9, 0.55, z, 6); pin.rotation.x = Math.PI / 2; g.add(pin); }
  return g;
}
/** The drawbridge: `len` (56) ft of old beams and planks running from its hinge (the origin) toward local -x, `w` (15)
 *  wide, boards missing by `seed`, struts and patches underneath, iron eyes for the chains at its free end. `up` 1
 *  stands it raised against the gate, the road ending in air. */
export function drawbridge(d: Dims): THREE.Group {
  const L = d.len ?? 56, W = d.w ?? 15, sd = d.seed ?? 3, deck = grp();
  for (const z of [-W / 2 + 0.7, 0, W / 2 - 0.7]) deck.add(box(L, 0.38, 0.9, C.timberDeep, -L / 2, 0.19, z));                       // stringers
  const n = Math.floor(L / 1.25), COL = [C.plank, C.timber, C.plankPale, C.plank];
  for (let i = 0; i < n; i++) {
    const x = -L + 0.7 + i * 1.25, h = hash(i, sd);
    if (i > 1 && i < n - 2 && (h < 0.07 || i % 13 === 7)) continue;                                                   // a missing board
    if (h > 0.86) { const cut = (hash(i, sd + 1) - 0.5) * W * 0.6; deck.add(box(1.12, 0.24, W / 2 + cut - 0.6, COL[i % 4], x, 0.5, -W / 4 + cut / 2 - 0.3), box(1.12, 0.24, W / 2 - cut - 1.6, C.plankRot, x, 0.47, W / 4 + cut / 2 + 0.8, 0.04)); continue; }  // split board
    deck.add(box(1.12, 0.24, W - (h > 0.6 ? 0.6 : 0), h > 0.78 ? C.plankRot : COL[i % 4], x, 0.5, (h - 0.5) * 0.5, (hash(i, sd + 2) - 0.5) * 0.03));
  }
  for (const z of [-W / 2 + 0.25, W / 2 - 0.25]) deck.add(box(L, 0.45, 0.5, C.timberDeep, -L / 2, 0.85, z));                          // curbs
  for (let k = 1; k < 7; k++) deck.add(box(0.5, 0.08, W - 0.4, C.iron, -k * (L / 7), 0.66, 0));                                    // iron straps
  for (let k = 0; k < 4; k++) { const s = box(L / 4 * 1.1, 0.3, 0.4, C.timberDeep, -L / 8 - k * (L / 4), -0.15, 0, (k % 2 ? 1 : -1) * 0.25); deck.add(s); }   // cross bracing, seen through the gaps
  for (const x of [-L * 0.2, -L * 0.45, -L * 0.7]) deck.add(box(1.4, 0.5, W - 1, C.timber, x, -0.05, 0));                         // patched shoring
  deck.add(box(0.8, 0.55, W, C.iron, -L + 0.4, 0.42, 0), box(1.4, 0.7, W, C.timberDeep, -0.7, 0.4, 0));                            // shod free end, heel beam
  for (const z of [-W / 2 + 0.4, W / 2 - 0.4]) { const eye = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 5, 10), mat(C.iron)); place(eye, -L + 1.3, 1.25, z, Math.PI / 2); deck.add(eye, box(1.2, 0.5, 0.7, C.iron, -L + 1.3, 0.85, z)); }
  const g = grp(deck);
  if (d.up) deck.rotation.z = -Math.PI / 2;
  return g;
}
/** A drawbridge chain from the iron eye at the bridge's free end (the origin) up to a slot in the wall face, `dx` ft
 *  out along local x, `rise` up and `dz` across, sagging `sag` ft at mid-span (`taut` 1: straight). At the top, the dark
 *  slot with its iron lip, and rust running down the stone below it. */
export function chain(d: Dims): THREE.Group {
  const dx = d.dx ?? 56, rise = d.rise ?? 59, dz = d.dz ?? 0, sag = d.taut ? 0 : d.sag ?? 3, g = grp();
  const P = (t: number) => new THREE.Vector3(dx * t, rise * t - sag * 4 * t * (1 - t), dz * t);
  const L = Math.hypot(dx, rise, dz) + sag, n = Math.max(4, Math.round(L / 0.8)), X = new THREE.Vector3(1, 0, 0), roll = new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2);
  const geoA = new THREE.BoxGeometry(0.95, 0.36, 0.12), mI = mat(C.iron), mR = mat(C.rust);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = P(t), dir = P(Math.min(1, t + 0.01)).sub(P(Math.max(0, t - 0.01))).normalize();
    const link = new THREE.Mesh(geoA, i % 5 === 2 ? mR : mI); link.position.copy(p); link.quaternion.setFromUnitVectors(X, dir); if (i % 2) link.quaternion.multiply(roll); g.add(link);
  }
  g.add(box(0.5, 3.2, 2.6, C.slit, dx + 0.1, rise + 0.6, dz), box(0.7, 0.45, 3.2, C.iron, dx - 0.1, rise - 1.2, dz), box(0.5, 0.4, 3, C.wallDeep, dx - 0.1, rise + 2.4, dz));
  for (let i = 0; i < 4; i++) { const h = 4 + hash(i, dz + 3) * 9; g.add(box(0.06, h, 0.22 + hash(i, 4) * 0.3, i % 2 ? C.streak : C.rust, dx + 0.15, rise - 1.5 - h / 2, dz + (i - 1.5) * 0.6)); }
  return g;
}
/** A rotten board in the deck (local x across the board), shown to whoever looks along it: dark, split and sagging. */
export function weakBoard(): THREE.Group {
  return grp(box(1.15, 0.26, 13.4, C.plankRot, 0, 0.52, 0), box(0.12, 0.27, 6, C.slit, 0.1, 0.55, -2), place(box(1.1, 0.2, 3, C.plankRot, 0, 0.42, 4.5), 0, 0.42, 4.5, 0, 0.12));
}

// ---------------------------------------------------------------- the castle side
/** A squared gate tower 16 ft on a side and `h` (100) tall, its ironbound door on local +x (the courtyard), slits up its
 *  faces, a battlemented head whose deck stands level with the wall-walk (h − 10). `mirror` 1 puts its side slits on −z. */
export function gateTower(d: Dims): THREE.Group {
  const H = d.h ?? 100, S = 16, top = H - 10, m = d.mirror ? -1 : 1, g = grp();
  g.add(box(S + 1.6, 3, S + 1.6, C.wallDeep, 0, 1.5, 0), box(S, top - 3.3, S, C.wall, 0, 3 + (top - 3.3) / 2, 0));
  for (const y of [30, 62]) g.add(box(S + 0.6, 0.8, S + 0.6, C.wallDeep, 0, y, 0));
  for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) { const a = (k * Math.PI) / 2, off = -6 + i * 4; g.add(place(box(1.1, 1.6, 1.4, C.wallDeep), Math.cos(a) * (S / 2 + 0.5) - Math.sin(a) * off, top - 1.4, Math.sin(a) * (S / 2 + 0.5) + Math.cos(a) * off, -a)); }
  for (let k = 0; k < 4; k++) {   // the parapet round the head and its merlons
    const a = (k * Math.PI) / 2, cx = Math.cos(a) * (S / 2 + 0.1), cz = Math.sin(a) * (S / 2 + 0.1);
    g.add(place(box(S + 1.4, 5, 1.2, C.wall), cx, top + 2.5, cz, -a + Math.PI / 2));
    for (let i = 0; i < 3; i++) { const off = -5.6 + i * 5.6; g.add(place(box(2.8, H - top - 5, 1.3, C.wall), cx - Math.sin(a) * off, top + 5 + (H - top - 5) / 2, cz + Math.cos(a) * off, -a + Math.PI / 2)); }
  }
  g.add(box(S - 0.4, 0.3, S - 0.4, C.flag, 0, top - 0.25, 0), box(3, 0.25, 3, C.timberDeep, -3, top - 0.05, 3));                    // the deck and its hatch
  // the ironbound door on the courtyard face, a lintel and a step
  g.add(box(0.7, 10.4, 6.6, C.wallDeep, S / 2 + 0.2, 5.6, 0), box(0.35, 8.6, 5, C.timberDeep, S / 2 + 0.45, 4.7, 0), box(1.6, 0.5, 6.4, C.wallDeep, S / 2 + 0.8, 0.25, 0));
  for (const y of [1.6, 4.4, 7.4]) g.add(box(0.2, 0.4, 5.1, C.iron, S / 2 + 0.66, y, 0));
  g.add(box(0.3, 0.9, 0.7, C.iron, S / 2 + 0.7, 4.6, 1.5), new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 4, 8), mat(C.iron)).translateX(S / 2 + 0.85).translateY(4.6).translateZ(-1.2));
  for (const y of [22, 44, 72]) g.add(box(0.3, 3.4, 0.7, C.slit, S / 2 + 0.05, y, 0));
  for (const y of [36, 58, 80]) g.add(box(0.7, 3.2, 0.3, C.slit, 3, y, m * (S / 2 + 0.05)));
  for (let i = 0; i < 4; i++) g.add(box(2 + hash(i, 2) * 3, 4 + hash(i, 3) * 6, 0.2, C.moss, S / 2 + 0.12, 3 + hash(i, 4) * 6, (hash(i, 5) - 0.5) * 12).rotateY(Math.PI / 2));
  return g;
}
/** The latch in a gate tower: a winch drum on its frame, a toothed ratchet and a pawl lever, chain wound on the drum. */
export function latch(): THREE.Group {
  const g = grp(box(0.6, 5, 0.6, C.timberDeep, -2.5, 2.5, 0), box(0.6, 5, 0.6, C.timberDeep, 2.5, 2.5, 0), box(6, 0.6, 1.2, C.timberDeep, 0, 0.3, 0));
  const drum = cyl(1.2, 1.2, 4.4, C.timber, 0, 3.6, 0, 10); drum.rotation.z = Math.PI / 2; g.add(drum);
  for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 4, 12), mat(C.iron)); place(r, -1.6 + i * 0.8, 3.6, 0, Math.PI / 2); g.add(r); }
  const rat = cyl(1.6, 1.6, 0.3, C.iron, 2.4, 3.6, 0, 12); rat.rotation.z = Math.PI / 2; g.add(rat);
  g.add(place(box(0.25, 3.4, 0.3, C.iron), 2.8, 5, 0.6, 0, 0, 0.5), box(0.5, 0.5, 0.5, C.rust, 3.6, 6.4, 0.6));
  return g;
}
/** Bright, greased iron in a chain slot: the sheave the chain runs over, kept clean while all round it rusts. */
export function slotIron(): THREE.Group {
  const sh = cyl(0.9, 0.9, 0.5, C.greased, 0, 0, 0, 10); sh.rotation.x = Math.PI / 2;
  return grp(sh, box(0.3, 0.3, 1.8, C.greased, 0, -0.9, 0));
}
/** The keep's open doors seen down the gate tunnel, painted as a backdrop `w` wide and `h` high (forced: the keep stands
 *  150 ft beyond the gate; this face stands at the courtyard's edge, a little smaller than life), its front on local +z:
 *  torches guttering in sconces either side, the hall's warm light flooding the steps and flagstones, and the round
 *  window high above with its broken glass and no light in it. */
export function litDoorway(d: Dims): THREE.Group {
  const W = d.w ?? 100, H = d.h ?? 66, g = grp();
  g.add(box(W, H, 10, C.wall, 0, H / 2, -5), box(W + 2, 3, 12, C.wallDeep, 0, 1.5, -5), box(W + 1, 1, 11, C.wallDeep, 0, H * 0.45, -5));
  for (let i = 0; i < Math.floor(W / 6); i++) g.add(box(3, 4, 2, C.wall, -W / 2 + 3 + i * 6, H + 2, -0.5));
  for (const x of [-W / 2 + 3, -17, 17, W / 2 - 3]) g.add(box(4.5, H * 0.92, 3, C.wallDeep, x, H * 0.46, 1.2), box(5, 4, 4, C.wallDeep, x, H * 0.92 + 1, 1.2).rotateX(0.0));
  // the doorway: a deep frame, the lit hall within, two leaves swung open, the pointed head
  const DW = 14, DH = 21;
  g.add(box(DW + 3, DH + 3, 1.2, C.wallDeep, 0, (DH + 3) / 2, 0.6));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.4), glowMat(C.amber, C.glow)), 0, DH / 2 + 0.1, 1.3));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(DW * 0.55, DH * 0.6, 0.2), glowMat('#ffd9a0', '#ffc070')), 0, DH * 0.38, 1.55));     // the hall's depth, brighter at its heart
  for (const s of [-1, 1]) { const leaf = grp(box(DW / 2, DH - 0.6, 0.5, C.timberDeep, s * DW / 4, (DH - 0.6) / 2, 0)); for (const y of [3, 9, 15]) leaf.add(box(DW / 2 - 0.4, 0.4, 0.6, C.iron, s * DW / 4, y, 0.05)); place(leaf, s * DW / 2, 0, 1.6, s * -1.15); g.add(leaf); }
  for (const s of [-1, 1]) { const arch = box(DW / 2 + 2, 1.6, 1.4, C.wallDeep, s * DW / 4, DH + 2.2, 1.4); arch.rotation.z = s * -0.38; g.add(arch); }
  for (let k = 0; k < 4; k++) g.add(box(DW + 10 - k * 2, 0.8, 3, k % 2 ? C.flag : C.wallDeep, 0, 0.4 + k * 0.8 - 0.4, 3.5 + (3 - k) * 2.2 - 2.2));          // steps
  // torches either side
  for (const s of [-1, 1]) {
    const x = s * (DW / 2 + 4.5);
    g.add(box(0.5, 1.6, 0.5, C.iron, x, 11, 0.6), place(box(0.3, 2.2, 0.3, C.iron), x, 12.4, 1.4, 0, 0.5), cyl(0.28, 0.2, 2.4, C.timberDeep, x, 13.2, 2.0, 5));
    g.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 5), glowMat(C.amber, C.glow)), x, 15.1, 2.1), place(new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glowMat('#ffe0a0', '#ffd080')), x, 14.6, 2.1));
  }
  // the round window, 50 ft up as the eye reads it: iron frame, dark broken glass
  const wy = H * 0.72, ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.7, 6, 18), mat(C.iron)); place(ring, 0, wy, 0.4); g.add(ring);
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(6, 18), mat(C.glass)), 0, wy, 0.35), box(12, 0.4, 0.3, C.iron, 0, wy, 0.5), box(0.4, 12, 0.3, C.iron, 0, wy, 0.5));
  for (let i = 0; i < 6; i++) { const a = hash(i, 9) * Math.PI * 2, r = 2.5 + hash(i, 10) * 2.8, sh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), mat(C.shard)); place(sh, Math.cos(a) * r, wy + Math.sin(a) * r, 0.45, 0, Math.PI / 2, a); sh.scale.z = 0.2; g.add(sh); }
  g.add(box(16, 1.2, 1.4, C.wallDeep, 0, wy - 7.4, 0.6), box(16, 1.2, 1.4, C.wallDeep, 0, wy + 7.4, 0.6));
  for (const x of [-30, 30]) g.add(box(4, 12, 0.3, C.glass, x, H * 0.6, 0.15), box(5, 0.8, 1, C.wallDeep, x, H * 0.6 - 6.4, 0.5));        // dark lancets
  // the warm wash on the flagstones before the doors: unlit, see-through, fanning out toward the gate
  const fan = (w0: number, w1: number, L: number, y: number, op: number) => g.add(plate([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, L], [-w1 / 2, L]], y, veil(C.amber, op)));
  fan(DW, 34, 44, 0.24, 0.16); fan(DW - 2, 22, 28, 0.27, 0.18);
  return g;
}

// ---------------------------------------------------------------- the turrets and what lies by them
/** A round guard turret broken by weather: shell `r` ft out, `h` high at its tallest, walls snapped lower toward the
 *  weather side; a doorway facing `door` (degrees from local +x, toward −z), one arrow slit facing `slit`, a heap of
 *  fallen stair in it (`stair`), a ravens' roost of sticks on its broken top (`nest`). */
export function turret(d: Dims): THREE.Group {
  const r = d.r ?? 8, H = d.h ?? 26, sd = d.seed ?? 0, t = 1.9, n = 18, g = grp(cyl(r + 1, r + 1.4, 1.6, C.wallDeep, 0, 0.8, 0, 16));
  const doorA = ((d.door ?? 180) * Math.PI) / 180, slitA = ((d.slit ?? 0) * Math.PI) / 180;
  const near = (a: number, b: number, w: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < w;
  let topY = 0, topA = 0, slitH = 0;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2, chord = 2 * r * Math.sin(Math.PI / n) + 0.25, x = Math.cos(a) * (r - t / 2), z = -Math.sin(a) * (r - t / 2);
    let hh = H * Math.max(0.3, Math.min(1, 0.62 + 0.38 * Math.cos(a - 0.6 - sd) + (hash(i, sd) - 0.5) * 0.3));
    if (near(a, doorA, 0.2)) { g.add(place(box(chord, Math.max(1, hh - 8), t, C.wall), x, 8 + (hh - 8) / 2, z, a + Math.PI / 2)); g.add(place(box(chord + 0.3, 0.8, t + 0.4, C.wallDeep), x, 7.6, z, a + Math.PI / 2)); continue; }
    if (hh > topY) { topY = hh; topA = a; }
    if (near(a, slitA, Math.PI / n + 0.01)) slitH = Math.max(slitH, hh);
    g.add(place(box(chord, hh, t, i % 4 ? C.wall : C.wallDeep), x, hh / 2, z, a + Math.PI / 2));
    if (hash(i, sd + 1) > 0.45) g.add(place(box(chord * 0.6, 0.8, t * 0.9, C.wallDeep), x, hh + 0.4, z, a + Math.PI / 2 + 0.12));
    if (i % 3 === 0) g.add(place(box(1.3, 1.6 + hash(i, 3) * 2.5, 0.22, C.moss), Math.cos(a) * (r + 0.05), 2 + hash(i, 4) * 6, -Math.sin(a) * (r + 0.05), a + Math.PI / 2));
  }
  // the slit sits in whatever height of wall survives on its side; where the wall has broken down below it, none is left
  if (slitH >= 7) g.add(place(box(0.55, 3, t + 0.2, C.slit), Math.cos(slitA) * (r - t / 2), Math.min(12, slitH - 3), -Math.sin(slitA) * (r - t / 2), slitA));
  g.add(cyl(r - t, r - t, 0.3, '#3a3b3e', 0, 0.25, 0, 14));
  if (d.stair ?? 0) for (let i = 0; i < 9; i++) { const a = doorA + Math.PI + 0.5 + i * 0.28, rr = r - t - 1.6; g.add(place(box(2.6, 0.7, 1.4, i % 2 ? C.wall : C.wallDeep), Math.cos(a) * rr, 0.6 + Math.min(i, 4) * 0.7, -Math.sin(a) * rr, a + Math.PI / 2 + 0.3, hash(i, 5) * 0.3)); }
  for (let i = 0; i < 10; i++) { const a = hash(i, sd + 5) * Math.PI * 2, rr = r + 1 + hash(i, 6) * 3.5; g.add(place(lump(0.6 + hash(i, 7) * 0.9, i % 2 ? C.wall : C.wallDeep, i, 1.2, 0.6, 1, 0, 'stone'), Math.cos(a) * rr, 0.3, Math.sin(a) * rr)); }
  if (d.nest) {
    const x = Math.cos(topA) * (r - t / 2), z = -Math.sin(topA) * (r - t / 2);
    for (let i = 0; i < 14; i++) g.add(place(box(2.2, 0.12, 0.12, i % 2 ? C.barkDead : C.bark), x + (hash(i, 8) - 0.5) * 1.6, topY + 0.2 + (i % 3) * 0.12, z + (hash(i, 9) - 0.5) * 1.6, hash(i, 10) * 3));
    for (let i = 0; i < 18; i++) g.add(place(box(0.25, 0.08, 0.6, C.slit), (hash(i, 11) - 0.5) * r * 1.4, 0.45, (hash(i, 12) - 0.5) * r * 1.4, hash(i, 13) * 3));   // droppings and feathers within
  }
  return g;
}
/** A rusted iron wall bracket for a signal brazier (local +z off the wall), a ring basket, charcoal in the rubble below. */
export function brazierBracket(): THREE.Group {
  const g = grp(box(1.2, 2, 0.2, C.rust, 0, 6, 0), place(box(0.2, 0.2, 2.2, C.iron), 0, 6.6, 1.1, 0, -0.35));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 4, 10), mat(C.iron)); place(ring, 0, 7.1, 2.2, 0, Math.PI / 2); g.add(ring);
  for (let i = 0; i < 4; i++) g.add(place(box(0.08, 0.9, 0.08, C.iron), Math.cos(i * 1.57) * 0.8, 6.7, 2.2 + Math.sin(i * 1.57) * 0.8, 0, 0, 0));
  for (let i = 0; i < 7; i++) g.add(place(lump(0.22 + hash(i, 1) * 0.15, C.charcoal, i, 1.2, 0.7, 1, 0), (hash(i, 2) - 0.5) * 2, 0.25, 1.4 + hash(i, 3) * 1.5));
  return g;
}
/** The gargoyle that fell from the wall, face up and half sunk in turf, its snapped wing beside it. `detail` 1 draws
 *  only its eye sockets, drilled clean through (what a close look finds). */
export function fallenGargoyle(d: Dims): THREE.Group {
  const out = grp(); out.scale.setScalar(GARGOYLE_SCALE);   // the wall's gargoyles are bigger than a garden statue
  if (d.detail) { for (const z of [-0.22, 0.22]) out.add(cyl(0.14, 0.14, 0.4, C.slit, -2.62, 1.42, z, 6)); return out; }
  const statue = gargoyleStatue({ ped: 0 }); statue.rotation.z = Math.PI / 2; statue.position.y = -0.1;
  const g = grp(statue);
  const wing = box(2.2, 2.0, 0.22, C.rock, 2.6, 0.3, 2.4, 0.5); wing.rotation.x = -1.35; g.add(wing);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(place(lump(0.9 + hash(i, 1) * 0.5, i % 3 ? C.turf : C.mud, i, 1.4, 0.4, 1.1, 0), Math.cos(a) * 3.2 - 0.6, 0.15, Math.sin(a) * 1.9)); }
  g.add(box(4, 0.05, 2.4, C.mud, 1, 0.12, 0.6));
  out.add(g);
  return out;
}
const GARGOYLE_SCALE = 1.7;
/** One of the stone gargoyles along the wall top, leaning out over the chasm (local +x) from a corbel set in the parapet:
 *  the kit's crouching gargoyle at the wall's own scale, tipped forward to leer down at the bridge. */
export function wallGargoyle(): THREE.Group {
  const k = GARGOYLE_SCALE, st = gargoyleStatue({ ped: 0 }), g = grp();
  st.scale.setScalar(k); st.rotation.z = -0.32; st.position.set(1.4, 0.2, 0); g.add(st);
  g.add(box(4.6, 0.9, 3.2, C.wallDeep, 1.1, -0.45, 0), box(2.2, 1.6, 2.6, C.wall, -0.6, -1.7, 0));   // the corbel it crouches on
  for (let i = 0; i < 3; i++) g.add(box(0.12, 2 + hash(i, 4) * 4, 0.25, C.streak, 3.3, -1.8 - hash(i, 5) * 2, (i - 1) * 0.6));   // weather stains below it
  return g;
}

// ---------------------------------------------------------------- fog
/** Fog boiling up out of a drop and rolling over its rims: billows and torn curtains rising `h` ft over `len` (local x)
 *  by `w` (local z), wisps tonguing out over the ground on both sides. Merged to a few meshes. */
export function fogBoil(d: Dims): THREE.Group {
  const L = d.len ?? 60, W = d.w ?? 40, H = d.h ?? 24, sd = d.seed ?? 0, root = grp(), g = grp(); root.add(g); g.position.set(d.ox ?? 0, 0, d.oz ?? 0);
  const nb = Math.max(3, Math.round((L * W) / 520));
  for (let i = 0; i < nb; i++) {
    const r = 4 + hash(i, sd + 1) * 6, b = lump(r, C.mist0, i + sd, 1.6, 0.6, 1.25, 1);
    b.material = fogMat(i % 3 ? C.mist0 : C.mist1, 0.1 + Math.round(hash(i, sd) * 2) * 0.04);
    g.add(place(b, (hash(i, sd + 2) - 0.5) * L, 0.5 + Math.pow(hash(i, sd + 3), 1.6) * H, (hash(i, sd + 4) - 0.5) * W, hash(i, sd + 5) * 6));
  }
  const nc = Math.max(1, Math.round(L / 35));
  for (let c = 0; c < nc; c++) {
    const cl = Math.min(L, 22 + hash(c, sd + 6) * 20), pts = [new THREE.Vector2(-cl / 2, 0), new THREE.Vector2(cl / 2, 0)], m = 7;
    for (let i = m; i >= 0; i--) pts.push(new THREE.Vector2(-cl / 2 + (i / m) * cl, H * (0.45 + 0.55 * hash(i, sd + c + 11))));
    const card = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), fogMat(C.mist1, 0.13));
    g.add(place(card, -L / 2 + (c + 0.5) * (L / nc), 0.2, (hash(c, sd + 7) - 0.5) * W * 0.5, (hash(c, sd + 8) - 0.5) * 0.5));
  }
  for (let i = 0; i < Math.max(2, Math.round(L / 18)); i++) for (const s of [-1, 1]) {
    const wv = plate(ragged(6 + hash(i, sd + s + 9) * 6, 3 + hash(i, sd + 10) * 3, i * 3 + s + sd, 9, 0.5), 0, fogMat(C.mist0, 0.2));
    g.add(place(wv, -L / 2 + (i + 0.5) * (L / Math.max(2, Math.round(L / 18))), 0.6 + hash(i, s) * 1.2, s * (W / 2 + 2 + hash(i, s + 4) * 5)));
  }
  return fuse(root);
}

// ---------------------------------------------------------------- the chasm ledge (35 ft down)
/** The chasm as seen from its ledge, 35 ft down: the two sheer faces `w` apart (local x) over `len` (local z), rising
 *  `top` ft to the rims, streaked and seeping; the fog floor `fog` ft below the ledge. The land drawn beyond the map
 *  would otherwise lie over the gap, so this piece opens the land's surface over its own footprint (the land's material
 *  is clipped to everything outside this box; the map's own fog covers the gap from above). */
export function chasmShaft(d: Dims): THREE.Group {
  const w = d.w ?? 50, L = d.len ?? 200, top = d.top ?? 35, fog = d.fog ?? 10, g = grp();
  for (const sx of [-1, 1]) {
    const face = new THREE.BoxGeometry(6, top + fog + 40, L, 1, 10, Math.max(4, Math.round(L / 10)));
    face.translate(sx * (w / 2 + 3), (top - fog - 40) / 2, 0);
    const pv = face.attributes.position; for (let i = 0; i < pv.count; i++) if (Math.abs(pv.getX(i)) < w / 2 + 3) pv.setX(i, pv.getX(i) - sx * (((i * 7919) % 13) / 13) * 2.6);
    face.computeVertexNormals(); g.add(new THREE.Mesh(face, mat(C.rockDeep, { surface: 'rock' })));
    for (let k = 0; k < Math.round(L / 9); k++) {
      const z = -L / 2 + (k + hash(k, sx)) * 9, y = -fog + 2 + hash(k, sx + 2) * (top + fog - 4);
      g.add(box(0.8, 0.7 + hash(k, sx + 3) * 0.6, 4 + hash(k, sx + 4) * 6, k % 3 ? C.rock : C.rockDark, sx * (w / 2 - 0.4), y, z));
      if (k % 3 === 1) g.add(box(0.2, 6 + hash(k, sx + 5) * 10, 1.2, k % 2 ? C.moss : C.rockDark, sx * (w / 2 - 0.3), y - 3, z + 1.5));
    }
  }
  const band = (ww: number, y: number, color: string, k: number) => {
    const pts: [number, number][] = [], m = Math.max(4, Math.round(L / 9));
    for (let i = 0; i <= m; i++) pts.push([-ww / 2 - hash(i, k) * w * 0.05, -L / 2 + (i / m) * L]);
    for (let i = m; i >= 0; i--) pts.push([ww / 2 + hash(i, k + 1) * w * 0.05, -L / 2 + (i / m) * L]);
    return plate(pts, y, color);
  };
  g.add(band(w + 1, -fog, C.deep0, 1), band(w * 0.74, -fog + 0.4, C.deep1, 3), band(w * 0.48, -fog + 0.8, C.deep2, 5), band(w * 0.24, -fog + 1.2, C.deep3, 7));
  for (let i = 0; i < Math.round(L / 14); i++) {   // the fog itself, lying in slow billows over the floor of it
    const r = 4 + hash(i, 21) * 5, bl = lump(r, C.mist0, i + 50, 1.5, 0.45, 1.3, 1); bl.material = fogMat(i % 2 ? C.mist0 : C.mist1, 0.22);
    g.add(place(bl, (hash(i, 22) - 0.5) * w * 0.7, -fog + 1.5 + hash(i, 23) * 3, -L / 2 + (i + 0.5) * 14, hash(i, 24) * 6));
  }
  const out = fuse(g);
  // open the land over the shaft (the land beyond the map is the backdrop's 'land' mesh; see the note above)
  const hook = out.children[0] as THREE.Mesh;
  hook.onBeforeRender = (_r, scene) => {
    const land = scene.getObjectByName('backdrop')?.getObjectByName('land') as THREE.Mesh | undefined;
    if (!land || land.userData.jShaft === out.uuid) return;
    out.updateMatrixWorld(true);
    const c = new THREE.Vector3().setFromMatrixPosition(out.matrixWorld), a = new THREE.Euler().setFromRotationMatrix(out.matrixWorld).y;
    const ux = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), uz = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    // a fragment is dropped only when it lies inside all four planes (clipIntersection): inside the shaft's plan box
    const pl = (n: THREE.Vector3, off: number) => new THREE.Plane().setFromNormalAndCoplanarPoint(n, c.clone().addScaledVector(n, off));
    const m = land.material as THREE.Material;
    m.clippingPlanes = [pl(ux.clone(), w / 2 - 0.3), pl(ux.clone().negate(), w / 2 - 0.3), pl(uz.clone(), L / 2), pl(uz.clone().negate(), L / 2)];
    m.clipIntersection = true; m.needsUpdate = true; land.userData.jShaft = out.uuid;
  };
  return out;
}
/** The ledge itself and what the fall left on it: a rock shelf jutting from the face (local −x), a jammed drift of
 *  broken planks. `part` 1 draws instead the skeleton in rusted mail among the boards, the snapped lantern and the purse. */
export function boardDrift(d: Dims): THREE.Group {
  const g = grp();
  if (d.part) {
    g.add(box(1.7, 0.7, 2.6, C.mail, 0.6, 0.6, 0.4, 0.3), place(lump(0.45, C.bone, 2, 1, 1.1, 1, 1), 1.0, 0.75, -1.4));
    for (const [a, b] of [[[0.2, 0.5, 1.7], [-0.4, 0.4, 3.6]], [[1.1, 0.5, 1.7], [1.8, 0.45, 3.5]], [[-0.1, 0.6, -0.4], [-1.6, 0.9, -1.2]], [[1.4, 0.6, -0.5], [2.6, 0.5, 0.6]]] as [number, number, number][][]) g.add(rod(a, b, 0.12, 0.1, C.bone, 4));
    const lantern = grp(box(0.9, 1.2, 0.9, C.iron, 0, 0.6, 0), box(0.7, 0.8, 0.72, C.shard, 0, 0.6, 0), place(box(0.5, 0.5, 0.5, C.iron), 0.9, 0.2, 0.4, 0, 0, 1.2));
    g.add(place(lantern, -1.8, 0.1, 2.4, 0.4, 0, 1.4), place(lump(0.38, C.purse, 4, 1.2, 0.8, 1, 0), 2.1, 0.35, 1.6));
    for (let i = 0; i < 4; i++) g.add(cyl(0.13, 0.13, 0.05, C.greased, 2.5 + hash(i, 1) * 0.8, 0.3, 1.9 + hash(i, 2) * 0.6, 7));
    return g;
  }
  g.add(box(12.4, 1.2, 30.4, C.rock, 0, -0.52, 0), place(lump(1, C.rockDeep, 3, 6, 5, 15, 1, 'rock'), -2, -4.5, 0));
  for (let i = 0; i < 18; i++) {
    const len = 5 + hash(i, 1) * 9, b = box(0.95, 0.24, len, i % 3 ? C.plank : C.plankRot, -2 + hash(i, 2) * 7, 0.25 + hash(i, 3) * 1.6, (hash(i, 4) - 0.5) * 22, hash(i, 5) * 3);
    b.rotation.x = (hash(i, 6) - 0.5) * 0.7; b.rotation.z = (hash(i, 7) - 0.5) * 0.6; g.add(b);
  }
  for (let i = 0; i < 3; i++) { const s = box(0.9, 7, 0.24, C.plankRot, -4.8 + i * 0.4, 2.8, -6 + i * 5); s.rotation.z = 0.25; g.add(s); }
  return g;
}

// ---------------------------------------------------------------- figures
/** A tall figure in a black cloak with a high collar, watching from the wall (for the DM's choice of welcome). */
function watcher(d: Dims): THREE.Group {
  const g = humanoid({ skin: C.pale, cloth: C.cloak, trim: C.cloakTrim, hair: '#0d0b0f', cloak: true, scale: (d.scale ?? 1) * 1.08 });
  g.add(box(1.6, 1.1, 0.25, C.cloak, 0, 5.4, -0.45), box(0.2, 0.1, 0.05, '#7a1f2b', 0.15, 5.65, 0.44));
  return g;
}
/** A column of bats boiling up out of the fog: small black wings spiralling round a dark core. */
function batSwarm(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39, y = 1 + (i / 26) * 9 * s, r = (1.2 + hash(i, 1) * 1.8) * s, bat = grp(box(0.35 * s, 0.25 * s, 0.5 * s, C.bat, 0, 0, 0));
    for (const k of [-1, 1]) bat.add(place(box(0.9 * s, 0.06 * s, 0.5 * s, C.batWing, k * 0.55 * s, 0.1 * s, 0), 0, 0, 0, 0, 0, k * (0.3 + hash(i, 2) * 0.5)).translateX(k * 0.55 * s));
    g.add(place(bat, Math.cos(a) * r, y, Math.sin(a) * r, -a));
  }
  return g;
}

Object.assign(PROPS_V1, {
  'j-crag-wall': cragWall, 'j-scree-fan': screeFan, 'j-verglas': verglas, 'j-rock-terrace': rockTerrace, 'j-krummholz': krummholz,
  'j-cobble-apron': cobbleApron, 'j-ruts': ruts, 'j-turning-loop': (d: Dims) => (d.fresh ? fuse(turningLoop(d)) : turningLoop(d)), 'j-spout': spout,
  'j-rim-notch': (d: Dims) => (d.evidence ? fuse(rimNotch(d)) : rimNotch(d)),
  'j-bridge-sill': bridgeSill, 'j-hinge-sill': hingeSill, 'j-drawbridge': drawbridge, 'j-chain': chain, 'j-weak-board': () => fuse(weakBoard()),
  'j-gate-tower': gateTower, 'j-latch': () => fuse(latch()), 'j-slot-iron': () => fuse(slotIron()), 'j-lit-doorway': litDoorway,
  'j-turret': turret, 'j-brazier-bracket': () => fuse(brazierBracket()), 'j-fallen-gargoyle': (d: Dims) => (d.detail ? fuse(fallenGargoyle(d)) : fallenGargoyle(d)),
  'j-wall-gargoyle': wallGargoyle, 'j-fog-boil': fogBoil, 'j-chasm-shaft': chasmShaft, 'j-board-drift': (d: Dims) => (d.part ? fuse(boardDrift(d)) : boardDrift(d)),
  'j-carriage': (d: Dims) => fuse(blackCarriage(d)),
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'j-watcher': (d) => watcher(d), 'j-bat-swarm': (d) => batSwarm(d) } as Record<string, (d: Dims) => THREE.Group>);
