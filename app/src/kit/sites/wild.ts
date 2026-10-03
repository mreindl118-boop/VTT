// Props and figures for the Lands of Barovia wilderness maps (chapter 2: A, B, D, F, H, I, J, L, M, P, R).
// Register with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); use mat() for every material.
// Feet; origin at the floor centre; +z is plan south. Fog and mist are the only see-through pieces (as the kit's chasm).
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { FLOOR_COLOR, PALETTE } from '../palette';
import { surfaceFor, type Surface } from '../surfaces';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  ashlar: '#77736b', ashlarDeep: '#66625b', statue: '#858078', fieldStone: '#5f5b55', turret: '#747b84', turretDeep: '#5d636b',
  bridge: '#6e6a62', bridgeDeep: '#5a5750', deck: '#625e57', gargoyle: '#5e5d57', voidDark: '#15191d',
  moss: '#38432f', blackMoss: '#232a20', mold: '#3a4a32', reed: '#5f6b3e', reedDry: '#857b4c', weed: '#55613a', weedDry: '#7d7a4a',
  iron: '#2e2f33', rust: '#4a3329', gallows: '#4f3f30', gallowsDeep: '#3e3226', rope: '#8c7b5c', burlap: '#8f7d58', twine: '#6e5f45',
  lacquer: '#17151b', lacquerTrim: '#3a1218', running: '#1f1c22', brass: '#9a7a3a', glassDark: '#0d0c10',
  hull: '#5d4a36', hullTrim: '#4a3a2a', oar: '#7a6248', shedBoard: '#574634', shedRoof: '#3b3a3f', net: '#4f4a40', cork: '#a8916a',
  rock: '#5a5853', rockDeep: '#4e4c48', rockPale: '#66635d', gorge: '#46454a', post: '#4d3b2b', arm: '#6e5a43', letter: '#b9ad94',
  bark: '#45362a', cut: '#9c8a68', slime: '#6c8f2e', fall: '#8ea4b5', fallPale: '#a9bccb', fallDeep: '#7f97aa', foam: '#d6dee4',
  mist0: '#dcdee2', mist1: '#c7cad0', mist2: '#b3b7be', deep0: '#24252a', deep1: '#383a41', deep2: '#555962', deep3: '#767b85',
  corpseSkin: '#9a9c94', corpseCloth: '#4e4f52', corpseTrim: '#3a3b3d', horseBlack: '#1d1b20', maneBlack: '#0f0e11', harness: '#2a1a1e',
  elk: '#6a5038', elkPale: '#b8a07a', elkDark: '#3f2f22', antler: '#d2c3a2', robe: '#141216', robeTrim: '#232026', mageHair: '#2c2a2c', beard: '#6e6c6c',
  trap: '#2a221b', lampIron: '#2a2a2e', slit: '#16151a', shellFloor: '#3a3b3e', corpseHair: '#2a2826',
} as const;
surfaceFor([C.ashlar, C.ashlarDeep, C.turret, C.bridge, C.bridgeDeep], 'ashlar');
surfaceFor([C.statue, C.fieldStone, C.gargoyle, C.turretDeep, C.shellFloor], 'stone');
surfaceFor([C.deck], 'flag');
surfaceFor([C.moss, C.blackMoss, C.mold, C.reed, C.weed], 'foliage');
surfaceFor([C.reedDry, C.weedDry], 'thatch');
surfaceFor([C.iron, C.rust, C.brass, C.lampIron], 'metal');
surfaceFor([C.trap, C.gallows, C.gallowsDeep, C.lacquer, C.lacquerTrim, C.running, C.hull, C.hullTrim, C.oar, C.shedBoard, C.post, C.arm, C.cut, C.cork], 'wood');
surfaceFor([C.bark], 'bark');
surfaceFor([C.rope, C.burlap, C.twine, C.net, C.corpseCloth, C.robe, C.robeTrim], 'cloth');
surfaceFor([C.shedRoof], 'shingle');
surfaceFor([C.rock, C.rockDeep, C.rockPale, C.gorge], 'rock');
surfaceFor([C.fall, C.fallPale, C.fallDeep], 'water');
surfaceFor([C.foam, C.mist0, C.mist1, C.mist2, C.voidDark, C.glassDark, C.slit, C.deep2, C.deep3], 'none');
surfaceFor([C.deep0, C.deep1], 'rock');
surfaceFor([C.letter, C.slime, C.corpseSkin, C.corpseTrim, C.corpseHair, C.horseBlack, C.maneBlack, C.harness, C.elk, C.elkPale, C.elkDark, C.antler, C.mageHair, C.beard], 'generic');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 8) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 6) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c)), x, y, z);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
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
/** Unlit see-through material (cached), drawn without depth writes like the kit's chasm fog: for what glows of itself. */
const veils = new Map<string, THREE.MeshBasicMaterial>();
function veil(color: string, opacity: number): THREE.MeshBasicMaterial {
  const k = color + opacity;
  let m = veils.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); veils.set(k, m); }
  return m;
}
/** A soft-edged flat blob (a wisp of fog lying on the ground), radius r, in the xz plane. */
function wisp(r: number, seed: number, color: string, opacity: number): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, k = r * (0.65 + 0.45 * hash(i, seed)); pts.push(new THREE.Vector2(Math.cos(a) * k * 1.5, Math.sin(a) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, fogMat(color, opacity));
}
function weedTuft(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = grp();
  for (let i = 0; i < 5; i++) { const b = cone(0.16 * s, (1.2 + hash(i, seed) * 0.9) * s, i % 2 ? C.weedDry : C.weed, x + (hash(i, seed + 1) - 0.5) * 0.7 * s, (0.6 + hash(i, seed) * 0.45) * s, z + (hash(i, seed + 2) - 0.5) * 0.7 * s, 4); b.rotation.z = (hash(i, seed + 3) - 0.5) * 0.6; b.rotation.x = (hash(i, seed + 4) - 0.5) * 0.6; g.add(b); }
  return g;
}

// ---------------------------------------------------------------- the Mists
/** Fog: the palette's mist grey, lit like everything else (it darkens at night) but see-through, drawn without depth
 *  writes. Cached per colour and opacity so a map's fog merges into a handful of meshes. */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** A ragged-edged sheet `L` × `D` in the xz plane (a layer of fog seen from above). */
function fogSheet(L: number, D: number, seed: number, mat_: THREE.Material): THREE.Mesh {
  const pts: THREE.Vector2[] = [], n = Math.max(4, Math.round(L / 7)), m = Math.max(2, Math.round(D / 7));
  const j = (i: number, k: number) => (hash(i, seed + k) - 0.5);
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L + j(i, 1) * 3, -D / 2 - Math.abs(j(i, 2)) * D * 0.35));
  for (let i = 1; i <= m; i++) pts.push(new THREE.Vector2(L / 2 + Math.abs(j(i, 3)) * 6, -D / 2 + (i / m) * D));
  for (let i = n - 1; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L + j(i, 4) * 3, D / 2 + Math.abs(j(i, 5)) * D * 0.35));
  for (let i = m - 1; i >= 1; i--) pts.push(new THREE.Vector2(-L / 2 - Math.abs(j(i, 6)) * 6, -D / 2 + (i / m) * D));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, mat_);
}
/** The Mists of Ravenloft: a wall (or, low, a bank) of fog `len` long (local x), `h` high and `d` deep. Fog cards for
 *  volume: stacked layers that shrink toward the top (so it reads from above), ragged curtains across its depth (so it
 *  reads from the side), a few soft billows at its foot, and wisps creeping out along the ground. */
export function mist(d: Dims): THREE.Group {
  const g = mistBody(d);
  // Drawn after the grid overlay (renderOrder 1), so the fog veils the squares under it instead of the lines showing
  // through crisp. That order only holds for a piece built on its own: maps give their fog the 'explored' class, which
  // players see exactly as 'player' but which the level does not merge into its static scatter.
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.renderOrder = 2; });
  return g;
}
function mistBody(d: Dims): THREE.Group {
  const L = d.len ?? 60, H = d.h ?? 30, D = d.d ?? 16, g = grp();
  if (H < 10) {
    // a low bank lying on the ground: one thin sheet and drifting wisps at differing heights, nothing standing
    const sh = fogSheet(L * 0.9, D * 0.8, 5, fogMat(C.mist0, 0.18)); sh.position.y = H * 0.35; g.add(sh);
    const n = Math.max(4, Math.round((L * D) / 260));
    for (let i = 0; i < n; i++) g.add(place(wisp(4 + hash(i, 1) * 7, i + 90, i % 2 ? C.mist0 : C.mist1, 0.22), (hash(i, 2) - 0.5) * L, 0.4 + hash(i, 3) * H, (hash(i, 4) - 0.5) * D, hash(i, 5) * 6));
    return g;
  }
  const nl = Math.max(2, Math.round(H / 4.5));
  for (let k = 0; k < nl; k++) {
    const t = (k + 0.5) / nl, sh = fogSheet(L * (1 - 0.18 * t), D * (1.05 - 0.55 * t), k * 7 + 3, fogMat(k % 2 ? C.mist1 : C.mist0, 0.3));
    sh.position.set((hash(k, 2) - 0.5) * 4, t * H * 0.95, (hash(k, 3) - 0.5) * D * 0.15); g.add(sh);
  }
  const nc = Math.max(2, Math.round(D / 5));
  for (let c = 0; c < nc; c++) {
    const pts = [new THREE.Vector2(-L / 2, 0), new THREE.Vector2(L / 2, 0)], m = Math.max(6, Math.round(L / 8));
    for (let i = m; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / m) * L, H * (0.55 + 0.5 * hash(i, c + 11))));
    const card = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), fogMat(C.mist1, 0.2)); card.position.z = -D / 2 + ((c + 0.5) / nc) * D; g.add(card);
  }
  const nb = Math.max(2, Math.round(L / 10));
  for (let i = 0; i < nb; i++) for (const s of [-1, 1]) {
    const r = Math.min(H * 0.5, 4 + hash(i, s + 5) * 4);
    const b = lump(r, C.mist0, i * 2 + s, 1.4, 0.7, 1.1, 1); b.material = fogMat(C.mist0, 0.45);
    g.add(place(b, -L / 2 + (i + 0.5) * (L / nb), r * 0.4, s * D * 0.45, hash(i, 1) * 6));
  }
  const nw = Math.max(3, Math.round(L / 14));
  for (let i = 0; i < nw; i++) for (const s of [-1, 1]) g.add(place(wisp(5 + hash(i, s + 9) * 5, i * 3 + s, C.mist0, 0.3), -L / 2 + (i + 0.5) * (L / nw), 0.5 + hash(i, s) * 0.8, s * (D / 2 + 3 + hash(i, s + 4) * 6), hash(i, 2) * 3));
  return g;
}

// ---------------------------------------------------------------- B: the Gates of Barovia
/** Iron gate leaf, `w` wide and `h` high, built from its hinge (x = 0) toward local -x. */
function gateLeaf(w: number, h: number): THREE.Group {
  const g = grp(), n = Math.max(4, Math.round(w / 0.85));
  for (let i = 0; i < n; i++) {
    const x = -(i + 0.5) * (w / n), bh = h - 0.4;
    g.add(box(0.24, bh, 0.24, i % 4 === 0 ? C.rust : C.iron, x, bh / 2, 0), cone(0.22, 0.9, C.iron, x, bh + 0.45, 0, 4));
  }
  for (const y of [0.6, h * 0.48, h - 0.7]) g.add(box(w, 0.3, 0.32, C.iron, -w / 2, y, 0));
  g.add(box(0.5, h, 0.42, C.iron, -0.25, h / 2, 0), box(0.4, h - 0.6, 0.36, C.iron, -w + 0.2, (h - 0.6) / 2, 0));   // stiles
  // a ring of scrollwork in the upper panel
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(1.6, w * 0.16), 0.12, 5, 14), mat(C.iron)); ring.position.set(-w / 2, h * 0.72, 0); g.add(ring);
  for (const s of [0.3, 0.7]) { const st = box(0.14, h * 0.5, 0.14, C.iron, -w * s, h * 0.48 + h * 0.25, 0); st.rotation.z = (s - 0.5) * 1.2; g.add(st); }
  return g;
}
/** The gates across the Old Svalich Road: two massive stepped piers flanking a `w`-ft opening (local x across the road,
 *  the road running along local z), buttress wings striding out `wing` ft into the woods, and the huge rusted iron
 *  gates hung on the stonework, swung `open` (0 shut … 1 wide) toward local -z. */
export function baroviaGate(d: Dims): THREE.Group {
  const w = d.w ?? 22, h = d.h ?? 34, wing = d.wing ?? 30, open = d.open ?? 0, g = grp();
  for (const s of [-1, 1]) {
    const px = s * (w / 2 + 3.5);
    g.add(box(9, 3, 11, C.ashlarDeep, px, 1.5, 0), box(7, h - 6, 8.6, C.ashlar, px, 3 + (h - 6) / 2, 0), box(7.8, 1.2, 9.4, C.ashlarDeep, px, h - 2.4, 0), box(8.4, 1.4, 10, C.ashlarDeep, px, h - 1.1, 0));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.6, 5.5, 4), mat(C.ashlarDeep)); place(cap, px, h + 2.7, 0, Math.PI / 4); g.add(cap);
    // stepped buttresses leaning on the pier, before and behind the gate
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) { const bh = h * (0.7 - k * 0.2), bd = 2.2; g.add(box(5.6 - k * 0.6, bh, bd, k % 2 ? C.ashlar : C.ashlarDeep, px + s * 0.3, bh / 2, sz * (4.3 + bd / 2 + k * bd))); }
    // the wing wall into the woods, stepping down, with a buttress at every bay
    const n = Math.max(1, Math.round(wing / 10)), bay = wing / n;
    for (let i = 0; i < n; i++) {
      const x = px + s * (3.5 + (i + 0.5) * bay), hh = h * (0.62 - (0.25 * i) / n);
      g.add(box(bay + 0.1, hh, 3.2, C.ashlar, x, hh / 2, 0), box(bay + 0.2, 0.6, 3.8, C.ashlarDeep, x, hh + 0.3, 0));
      for (const sz of [-1, 1]) g.add(box(2.4, hh * 0.75, 3, C.ashlarDeep, x + s * bay / 2, hh * 0.375, sz * 3));
    }
    // moss in the joints, weeds at the foot
    for (let k = 0; k < 4; k++) g.add(box(1.6 + hash(k, s) * 1.6, 2 + hash(k, s + 1) * 4, 0.2, C.moss, px + (hash(k, s + 2) - 0.5) * 5, 4 + hash(k, s + 3) * (h - 10), (k % 2 ? 1 : -1) * 4.35));
    g.add(weedTuft(px - s * 4.6, 5.8, 1.2, 3 + s), weedTuft(px - s * 4.2, -6.2, 1, 5 + s));
    const leaf = gateLeaf(w / 2, h * 0.55); place(leaf, s * w / 2, 0, 0, -s * open * 1.45); if (s < 0) leaf.scale.x = -1; g.add(leaf);
    g.add(box(0.5, 0.9, 0.9, C.iron, s * (w / 2 - 0.1), h * 0.12, 0), box(0.5, 0.9, 0.9, C.iron, s * (w / 2 - 0.1), h * 0.45, 0));   // hinge pins
  }
  return g;
}
/** A larger-than-life armed guardian in grey stone on its plinth, its head broken from the neck. v: 0 greatsword
 *  planted point-down under both hands, 1 spear and kite shield. Faces local +z. */
export function headlessStatue(d: Dims): THREE.Group {
  const k = 1.65, y0 = 4.4, S = C.statue, SD = C.ashlarDeep, v = d.v ?? 0;
  const g = grp(box(5.2, 1, 5.2, SD, 0, 0.5, 0), box(4.3, 2.8, 4.3, S, 0, 2.4, 0), box(4.9, 0.6, 4.9, SD, 0, 4.1, 0));
  for (const x of [-0.42, 0.42]) g.add(cyl(0.36 * k, 0.3 * k, 2.6 * k, S, x * k, y0 + 1.3 * k, 0, 7), box(0.5 * k, 0.45 * k, 0.8 * k, SD, x * k, y0 + 0.22 * k, 0.1 * k));
  g.add(cyl(0.92 * k, 1.12 * k, 1.25 * k, S, 0, y0 + 2.95 * k, 0, 8));                                       // the armoured skirt
  const torso = cyl(0.98 * k, 0.8 * k, 2.2 * k, S, 0, y0 + 4.6 * k, 0, 8); torso.scale.z = 0.7; g.add(torso);
  for (const sx of [-1, 1]) g.add(place(lump(0.5 * k, S, 3 + sx, 1.1, 0.8, 1, 1), sx * 1.05 * k, y0 + 5.45 * k, 0));
  g.add(cyl(0.3 * k, 0.36 * k, 0.4 * k, S, 0, y0 + 5.85 * k, 0, 7), place(lump(0.3 * k, SD, 11, 1, 0.45, 1, 0), 0, y0 + 6.08 * k, 0));   // the broken neck
  if (v === 0) {
    for (const sx of [-1, 1]) { const a = box(0.34 * k, 1.9 * k, 0.34 * k, S, sx * 0.62 * k, y0 + 4.45 * k, 0.45 * k); a.rotation.set(-0.55, 0, sx * 0.35); g.add(a); }
    g.add(box(0.26 * k, 3.6 * k, 0.1 * k, PALETTE.mist3, 0, y0 + 1.8 * k, 0.95 * k), box(1.3 * k, 0.2 * k, 0.24 * k, S, 0, y0 + 3.65 * k, 0.95 * k), box(0.2 * k, 0.6 * k, 0.2 * k, SD, 0, y0 + 4.0 * k, 0.95 * k));
  } else {
    const ar = box(0.34 * k, 2.2 * k, 0.34 * k, S, 1.1 * k, y0 + 4.2 * k, 0.3 * k); ar.rotation.x = -0.3; g.add(ar);
    g.add(box(0.16 * k, 7 * k, 0.16 * k, S, 1.25 * k, y0 + 3.6 * k, 0.55 * k), cone(0.24 * k, 0.9 * k, S, 1.25 * k, y0 + 7.5 * k, 0.55 * k, 4));
    const sh = cyl(1.0 * k, 0.55 * k, 0.24 * k, S, -1.0 * k, y0 + 3.9 * k, 0.55 * k, 8); sh.rotation.x = Math.PI / 2; sh.scale.set(1, 1, 1.45); g.add(sh);
  }
  for (let i = 0; i < 4; i++) g.add(box(0.8 + hash(i, 4) * 0.9, 0.5 + hash(i, 5), 0.15, C.moss, (hash(i, 6) - 0.5) * 1.6 * k, y0 + (1 + hash(i, 7) * 4) * k, 0.62 * k));
  return g;
}
/** A guardian's helmeted stone head lying on its side among the weeds. */
export function statueHead(): THREE.Group {
  const S = C.statue, head = place(lump(0.95, S, 21, 0.92, 1.05, 0.95, 1), 0, 0.85, 0, 0, 0, 1.35);
  const helm = cyl(1.05, 1.0, 0.5, C.ashlarDeep, -0.25, 0.9, 0, 9); helm.rotation.z = 1.35;
  const crest = box(0.3, 1.6, 0.25, C.ashlarDeep, -0.95, 0.8, 0); crest.rotation.z = 1.35;
  return grp(head, helm, crest, box(0.25, 0.4, 0.3, S, 0.3, 0.75, 0.85), weedTuft(1.3, 0.8, 1.1, 2), weedTuft(-1.2, -0.9, 1, 4), weedTuft(0.4, -1.4, 0.8, 6));
}

// ---------------------------------------------------------------- F: the crossroads gallows and the graveyard wall
/** The gallows: a rotting platform `h` ft high (10 ft square) on posts, a short stair down its front (+z), an
 *  upright and a beam with a frayed rope over the trap. The rope hangs at local (1.2, 0). */
export function gallows(d: Dims): THREE.Group {
  const h = d.h ?? 5, W = C.gallows, WD = C.gallowsDeep, g = grp();
  for (const x of [-4.6, 0, 4.6]) for (const z of [-4.6, 4.6]) g.add(box(0.7, h, 0.7, WD, x, h / 2, z));
  for (const z of [-4.6, 4.6]) { const b = box(6.4, 0.35, 0.3, W, -2.3, h / 2, z); b.rotation.z = Math.atan2(h - 1, 4.6); g.add(b); const b2 = box(6.4, 0.35, 0.3, W, 2.3, h / 2, z); b2.rotation.z = -Math.atan2(h - 1, 4.6); g.add(b2); }
  for (let i = 0; i < 12; i++) { if (i === 3 || i === 8) continue; g.add(box(10, 0.3, 0.78, i % 3 ? W : WD, 0, h + 0.15 + (i % 4 === 1 ? -0.06 : 0), -4.55 + i * 0.83)); }   // the deck, two planks rotted through
  g.add(box(3.2, 0.34, 3.2, C.trap, 1.2, h + 0.17, 0), box(3.4, 0.1, 0.25, C.iron, 1.2, h + 0.36, 1.5));                                // the trap
  const steps = Math.max(3, Math.round(h / 0.75));
  for (let i = 0; i < steps; i++) g.add(box(3.4, 0.25, 0.85, W, -2.4, h - (i + 1) * (h / (steps + 1)) + 0.1, 5.4 + i * 0.85));
  for (const x of [-4.2, -0.6]) { const s = box(0.3, 0.6, steps * 0.85 + 1.6, WD, x, h / 2, 5 + (steps * 0.85) / 2); s.rotation.x = Math.atan2(h, steps * 0.85 + 0.8); g.add(s); }
  g.add(box(0.9, 10.5, 0.9, WD, -2.8, h + 5.25, 0), box(5.8, 0.8, 0.8, WD, -0.4, h + 10.1, 0));
  const brace = box(0.4, 3.6, 0.4, W, -1.7, h + 8.6, 0); brace.rotation.z = -0.75; g.add(brace);
  g.add(box(0.12, 3.3, 0.12, C.rope, 1.2, h + 8.1, 0));
  const noose = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 4, 10), mat(C.rope)); place(noose, 1.2, h + 6.15, 0, 0, 0.2); g.add(noose);
  for (let i = 0; i < 3; i++) { const f = box(0.05, 0.5, 0.05, C.rope, 1.2 + (i - 1) * 0.08, h + 5.5, 0); f.rotation.z = (i - 1) * 0.3; g.add(f); }
  return g;
}
/** A lifeless grey body hanging from a rope, its feet a foot above the local origin; the rope rises 10 ft. Turned a
 *  little on the rope. Place it at the gallows' rope with y = the platform's height. */
export function hangedFigure(): THREE.Group {
  const body = humanoid({ skin: C.corpseSkin, cloth: C.corpseCloth, trim: C.corpseTrim, hair: C.corpseHair });
  place(body, 0, 0.9, 0, 0.6, 0.05, 0.06);
  return grp(body, box(0.12, 3.6, 0.12, C.rope, 0, 8.4, 0), place(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 4, 8), mat(C.rope)), 0, 6.55, 0, 0, Math.PI / 2));
}
/** A low dry-stone wall `len` ft long (local x), `h` high, crumbled in places: those stretches drop to a course or two
 *  and their stones lie tumbled at the foot. `seed` varies where it has fallen. */
export function fieldWall(d: Dims): THREE.Group {
  const L = d.len ?? 12, H = d.h ?? 3, T = d.t ?? 2, sd = d.seed ?? 0, g = grp(), COL = ['#6d6a66', '#7a766f', C.fieldStone];
  const n = Math.max(2, Math.round(L / 1.7)), sw = L / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * sw, crumb = (d.gaps ?? 1) > 0 && hash(i, sd) < 0.2;
    const top = crumb ? H * (0.2 + hash(i, sd + 1) * 0.25) : H * (0.85 + hash(i, sd + 2) * 0.2);
    let y = 0, c = 0;
    while (y < top - 0.15) {
      const sh = Math.min(top - y, 0.65 + hash(i * 7 + c, sd + 3) * 0.4);
      g.add(box(sw * (0.92 + hash(c, i) * 0.1), sh * 0.96, T * (0.95 - 0.08 * c), COL[(i + c) % 3], x + (hash(c, i + sd) - 0.5) * 0.2, y + sh / 2, (hash(i, c + sd) - 0.5) * 0.2, (hash(i + c, sd) - 0.5) * 0.12));
      y += sh; c++;
    }
    if (!crumb) g.add(box(sw * 1.02, 0.32, T * 0.82, COL[(i + 1) % 3], x, y + 0.16, 0));
    else for (const s of [-1, 1]) g.add(place(lump(0.55, COL[i % 3], i + s, 1.2, 0.6, 1, 0, 'stone'), x + (hash(i, s) - 0.5), 0.25, s * (T / 2 + 0.7 + hash(i, s + 2))));
  }
  return g;
}

// ---------------------------------------------------------------- I / J: the black carriage and its horses
function carriageWheel(r: number): THREE.Group {
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.2, 5, 14), mat(C.running));
  const g = grp(rim, place(cyl(0.45, 0.45, 0.6, C.brass, 0, 0, 0, 8), 0, 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 8; i++) { const s = box(0.14, r * 2 - 0.2, 0.14, C.lacquerTrim, 0, 0, 0); s.rotation.z = (i / 8) * Math.PI; g.add(s); }
  return g;
}
/** Strahd's black carriage: a lacquered coach on four wheels (front toward local +x), the coachman's box, lamps lit
 *  at its corners, the pole running out to where the team stands. `open` 1 swings the near-side (+z) door open. */
export function blackCarriage(d: Dims): THREE.Group {
  const B = C.lacquer, T = C.lacquerTrim, g = grp();
  g.add(box(11.5, 0.5, 1, C.running, 0.5, 2.2, 0), box(1, 0.4, 5.2, C.running, -3, 2.4, 0), box(1, 0.4, 4.2, C.running, 3.2, 2.0, 0));   // perch and axle beds
  for (const z of [-1.8, 1.8]) for (const x of [-3, 2.2]) { const sp = box(2.2, 0.35, 0.5, C.iron, x, 2.75, z); sp.rotation.z = 0.08; g.add(sp); }          // the leaf springs
  g.add(box(7.4, 1.4, 4.9, B, -0.5, 3.6, 0), box(7.8, 4.4, 5.5, B, -0.5, 6.4, 0), box(8.2, 0.45, 5.9, B, -0.5, 8.8, 0), box(7.2, 0.5, 5.0, B, -0.5, 9.2, 0));
  for (const s of [-1, 1]) {
    g.add(box(7.9, 0.3, 0.12, T, -0.5, 4.5, s * 2.78), box(7.9, 0.2, 0.12, T, -0.5, 8.4, s * 2.78));                          // belt and cant rails
    g.add(box(1.5, 1.6, 0.12, C.glassDark, -3.0, 6.9, s * 2.79), box(1.5, 1.6, 0.12, C.glassDark, 2.0, 6.9, s * 2.79));          // quarter windows
    for (const x of [-4.4, 3.4]) g.add(box(0.12, 0.12, 5.9, C.brass, x, 9.55, 0)); g.add(box(7.8, 0.12, 0.12, C.brass, -0.5, 9.55, s * 2.9));  // roof rail
  }
  // the door on the near side, with its window and step; swung open on its front hinge when `open`
  const door = grp(box(2.6, 4.2, 0.18, B, -1.3, 0, 0), box(1.6, 1.5, 0.2, C.glassDark, -1.3, 0.9, 0), box(2.2, 0.2, 0.22, T, -1.3, -0.7, 0), box(0.25, 0.25, 0.3, C.brass, -2.3, -0.2, 0.15));
  place(door, 0.8, 6.3, 2.82, (d.open ?? 1) ? -1.25 : 0); g.add(door, box(1.6, 0.25, 1.1, C.running, -0.5, 2.9, 3.3));
  // the coachman's box, footboard and lamps
  g.add(box(2.2, 1.6, 4.6, B, 4.3, 5.0, 0), box(1.5, 0.45, 4.4, B, 4.7, 6.1, 0), box(0.3, 1.4, 4.4, B, 4.0, 6.9, 0), box(1.6, 0.25, 5.0, B, 5.9, 4.3, 0));
  for (const z of [-2.7, 2.7]) {
    g.add(box(0.15, 1.3, 0.15, C.iron, 3.3, 7.6, z), box(0.6, 0.85, 0.6, C.lampIron, 3.3, 8.5, z));
    g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.44), mat(PALETTE.amber, { emissive: '#8a5a1a' })), 3.3, 8.5, z));
  }
  // wheels: big at the back, smaller under the box
  for (const z of [-3.05, 3.05]) { g.add(place(carriageWheel(2.4), -3, 2.4, z)); g.add(place(carriageWheel(1.8), 3.2, 1.8, z)); }
  // the pole and the swingletree for a pair
  g.add(box(9, 0.35, 0.35, C.running, 9.6, 2.9, 0), box(0.35, 0.35, 4.6, C.running, 6.6, 2.9, 0), box(0.5, 0.5, 0.5, C.brass, 14.1, 2.9, 0));
  return g;
}
/** One of the carriage's two black horses: the kit horse in black, a dark harness, steam at the nostrils. Faces +x. */
export function blackHorse(d: Dims): THREE.Group {
  const g = horse(d), s = (d.scale ?? 1) * 1.75;
  g.traverse((c) => {
    const m = c as THREE.Mesh; if (!m.isMesh) return;
    const hex = '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString();
    if (hex === '#4a3a2e') m.material = mat(C.horseBlack); else if (hex === '#2a2020') m.material = mat(C.maneBlack);
  });
  const collar = box(0.5 * s, 1.0 * s, 1.15 * s, C.harness, 1.95 * s, 4.1 * s, 0); collar.rotation.z = -0.65; g.add(collar);
  g.add(box(2.6 * s, 0.22 * s, 1.72 * s, C.harness, 0.2 * s, 3.95 * s, 0), box(0.25 * s, 0.25 * s, 1.75 * s, C.brass, 2.1 * s, 4.25 * s, 0));
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry((0.14 + i * 0.09) * s, 1), fogMat(C.mist0, 0.3 - i * 0.08)); p.position.set((3.9 + i * 0.3) * s, (4.72 - i * 0.04) * s, 0); g.add(p); }
  return g;
}

// ---------------------------------------------------------------- J: the turrets, the gargoyles, the portcullis
/** A run of curtain wall `len` ft long (local x), `t` thick and `h` high: battered plinth, ashlar courses, a string
 *  course, arrow slits on both faces, and the wall walk between merlons on top. Built as masonry so it stands at its
 *  full height in every view (the map's walls along it only block sight and movement). */
export function curtainWall(d: Dims): THREE.Group {
  const L = d.len ?? 60, T = d.t ?? 20, H = d.h ?? 90, g = grp(box(L, 4, T + 2, C.ashlarDeep, 0, 2, 0), box(L, H - 4, T, C.ashlar, 0, 2 + (H - 2) / 2, 0));
  g.add(box(L + 0.2, 1, T + 0.8, C.ashlarDeep, 0, H * 0.72, 0), box(L + 0.2, 1.4, T + 1.0, C.ashlarDeep, 0, H - 0.7, 0));
  const n = Math.max(1, Math.floor(L / 24));
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) for (const y of [H * 0.35, H * 0.55, H * 0.85]) g.add(box(0.7, 3.2, 0.3, C.slit, -L / 2 + (i + 0.5) * (L / n), y, s * (T / 2 + 0.1)));
  const m = Math.max(2, Math.floor(L / 5));
  for (const s of [-1, 1]) for (let i = 0; i < m; i++) g.add(box(2.8, 3.4, 1.4, C.ashlar, -L / 2 + (i + 0.5) * (L / m), H + 1.7, s * (T / 2 - 0.7)));
  for (let i = 0; i < Math.round(L / 20); i++) g.add(box(2 + hash(i, 3) * 3, 3 + hash(i, 4) * 6, 0.2, C.moss, (hash(i, 5) - 0.5) * L * 0.9, 3 + hash(i, 6) * 10, (i % 2 ? 1 : -1) * (T / 2 + 0.12)));
  return g;
}
/** A broken guard turret: a round shell of stone `r` ft across its outer face, its wall snapped off at differing
 *  heights up to `h`, open inside, rubble at its foot. */
export function ruinedTurret(d: Dims): THREE.Group {
  const r = d.r ?? 6, h = d.h ?? 24, t = 1.7, n = 14, sd = d.seed ?? 0, g = grp(cyl(r + 0.9, r + 1.2, 1.6, C.turretDeep, 0, 0.8, 0, 14));
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2, chord = 2 * r * Math.sin(Math.PI / n) + 0.2;
    const hh = h * Math.max(0.25, Math.min(1, 0.55 + 0.45 * Math.sin(a * 1.0 + 0.8 + sd) + (hash(i, sd) - 0.5) * 0.35));
    const seg = box(chord, hh, t, i % 3 ? C.turret : C.turretDeep, Math.cos(a) * (r - t / 2), hh / 2, Math.sin(a) * (r - t / 2)); seg.rotation.y = -a + Math.PI / 2; g.add(seg);
    if (hash(i, sd + 1) > 0.4) { const nb = box(chord * 0.6, 0.9, t * 0.9, C.turretDeep, Math.cos(a) * (r - t / 2), hh + 0.45, Math.sin(a) * (r - t / 2)); nb.rotation.y = -a + Math.PI / 2 + 0.1; g.add(nb); }
    if (i % 4 === 1 && hh > 9) { const sl = box(0.4, 2.4, 0.3, C.slit, Math.cos(a) * (r + 0.02), Math.min(hh - 2, 9), Math.sin(a) * (r + 0.02)); sl.rotation.y = -a + Math.PI / 2; g.add(sl); }
    if (i % 3 === 0) g.add(box(1.2, 1.4 + hash(i, 3) * 2, 0.2, C.moss, Math.cos(a) * (r + 0.05), 2 + hash(i, 4) * 5, Math.sin(a) * (r + 0.05), -a + Math.PI / 2));
  }
  g.add(cyl(r - t, r - t, 0.3, C.shellFloor, 0, 0.2, 0, 12));
  for (let i = 0; i < 9; i++) { const a = hash(i, sd + 5) * Math.PI * 2, rr = r + 1 + hash(i, 6) * 3; g.add(place(lump(0.6 + hash(i, 7) * 0.9, i % 2 ? C.turret : C.turretDeep, i, 1.2, 0.6, 1, 0, 'stone'), Math.cos(a) * rr, 0.3, Math.sin(a) * rr)); }
  return g;
}
/** A gargoyle cloaked in black moss, crouched on its haunches and leering forward (local +x). `ped` 1 sets it on a
 *  stone pedestal (3 ft); 0 leaves it to sit on a parapet or wall top. */
export function gargoyleStatue(d: Dims): THREE.Group {
  const S = C.gargoyle, y0 = (d.ped ?? 1) ? 3 : 0, g = grp();
  if (y0) g.add(box(2.8, 2.6, 2.8, C.bridge, 0, 1.3, 0), box(3.2, 0.4, 3.2, C.ashlarDeep, 0, 2.8, 0));
  for (const z of [-0.6, 0.6]) g.add(place(lump(0.75, S, 2 + z, 1.1, 0.8, 0.8, 1), -0.35, y0 + 0.75, z), box(0.7, 0.3, 0.45, S, 0.5, y0 + 0.15, z));
  g.add(place(lump(0.95, S, 7, 1, 1.15, 0.85, 1), 0.2, y0 + 1.95, 0, 0, 0, -0.35));
  const head = place(lump(0.55, S, 9, 1.15, 0.9, 0.95, 1), 1.05, y0 + 2.75, 0); g.add(head, box(0.55, 0.3, 0.6, S, 1.5, y0 + 2.5, 0));
  for (const z of [-0.3, 0.3]) { const hn = cone(0.12, 0.7, S, 0.85, y0 + 3.3, z, 4); hn.rotation.z = 0.5; hn.rotation.x = z * 1.2; g.add(hn); }
  for (const z of [-0.5, 0.5]) { const arm = box(0.28, 1.5, 0.28, S, 0.85, y0 + 1.1, z); arm.rotation.z = -0.25; g.add(arm); }
  for (const z of [-1, 1]) { const wg = box(1.9, 2.2, 0.16, S, -0.55, y0 + 2.7, z * 0.85); wg.rotation.set(z * 0.35, 0, 0.55); g.add(wg); }
  const tail = box(1.8, 0.2, 0.2, S, -1.3, y0 + 0.3, 0.3); tail.rotation.y = 0.6; g.add(tail);
  for (let i = 0; i < 6; i++) g.add(place(lump(0.28 + hash(i, 2) * 0.2, C.blackMoss, i, 1.3, 0.45, 1.1, 0), (hash(i, 3) - 0.5) * 1.6, y0 + 1.4 + hash(i, 4) * 1.7, (hash(i, 5) - 0.5) * 1.2));
  return g;
}
/** A rotting wooden portcullis green with growth, `w` wide and `h` tall, drawn up (set its height with the object's y). */
export function rottenPortcullis(d: Dims): THREE.Group {
  const w = d.w ?? 20, h = d.h ?? 14, g = grp(), n = Math.round(w / 1.6);
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n); g.add(box(0.5, h, 0.5, i % 3 ? C.gallows : C.gallowsDeep, x, h / 2, 0), cone(0.3, 0.9, C.iron, x, -0.3, 0, 4).rotateX(Math.PI)); }
  for (let j = 0; j < 4; j++) g.add(box(w, 0.45, 0.6, C.gallowsDeep, 0, 1 + j * ((h - 2) / 3), 0));
  for (let i = 0; i < 10; i++) g.add(place(lump(0.5 + hash(i, 1) * 0.6, C.mold, i, 1.3, 1.6, 0.4, 0), (hash(i, 2) - 0.5) * w, 1 + hash(i, 3) * (h - 2), 0.3));
  return g;
}
/** A patch of green slime clinging to the woodwork, drips hanging from it. */
export function greenSlime(): THREE.Group {
  const sl = mat(C.slime, { emissive: '#18260a' }), g = grp();
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), sl); b.scale.set(1.5, 0.8, 0.5); g.add(b);
  for (let i = 0; i < 6; i++) { const dr = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9 + hash(i, 1) * 1.1, 5), sl); dr.rotation.x = Math.PI; dr.position.set((hash(i, 2) - 0.5) * 2.6, -0.8 - hash(i, 3) * 0.4, 0.1); g.add(dr); }
  return g;
}

// ---------------------------------------------------------------- D, H, R: bridges; H: the gorge and the falls
/** An arching stone bridge `len` ft long (local x) and `w` wide: a paved deck humped `rise` ft at the crown, parapets
 *  `par` ft high with a coping, newel posts at the four corners (their tops at 0.15 + par + 0.6), the arch ring and its
 *  shadowed opening on both faces, cutwaters, and mould on the old stone. */
export function stoneBridge(d: Dims): THREE.Group {
  const L = d.len ?? 60, W = d.w ?? 15, R = d.rise ?? 1.5, P = d.par ?? 3, g = grp(), n = Math.max(10, Math.round(L / 3));
  const yAt = (x: number) => 0.15 + R * Math.max(0, 1 - (2 * x / (L - 6)) ** 2);
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + (i * L) / n, x1 = x0 + L / n, xm = (x0 + x1) / 2, y0 = yAt(x0), y1 = yAt(x1), ym = (y0 + y1) / 2, sl = Math.atan2(y1 - y0, L / n);
    const len = L / n / Math.cos(sl) + 0.06;
    const deck = box(len, 0.6, W - 1.6, i % 2 ? C.deck : C.bridgeDeep, xm, ym - 0.3, 0); deck.rotation.z = sl; g.add(deck);
    for (const s of [-1, 1]) {
      const par = box(len, P + 0.6, 0.85, C.bridge, xm, ym + P / 2 - 0.3, s * (W / 2 - 0.42)); par.rotation.z = sl; g.add(par);
      const cop = box(len + 0.04, 0.35, 1.15, C.bridgeDeep, xm, ym + P + 0.15, s * (W / 2 - 0.42)); cop.rotation.z = sl; g.add(cop);
      g.add(box(L / n + 0.06, ym + 1.2, 0.5, C.bridgeDeep, xm, (ym - 1.2) / 2, s * (W / 2 - 0.12)));                       // spandrel face down to the water
      if (hash(i, s + 3) > 0.62) g.add(box(L / n * 0.8, 0.5 + hash(i, s) * 1.4, 0.12, C.mold, xm, ym + 0.6 + hash(i, s + 1) * 1.2, s * (W / 2 + 0.03)));
    }
  }
  // the arch on each face: the shadow of the opening, ringed by voussoirs
  const span = L - 10, ar = Math.max(0.9, R + 0.5);
  for (const s of [-1, 1]) {
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI; pts.push(new THREE.Vector2(Math.cos(t) * span / 2, Math.sin(t) * ar)); }
    const shadow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mat(C.voidDark)); place(shadow, 0, 0.08, s * (W / 2 + 0.16), s > 0 ? 0 : Math.PI); g.add(shadow);
    for (let k = 0; k < 15; k++) { const t = ((k + 0.5) / 15) * Math.PI, v = box(span / 14, 0.55, 0.3, k % 2 ? C.bridge : C.bridgeDeep, Math.cos(t) * (span / 2 + 0.2), Math.sin(t) * (ar + 0.25) + 0.08, s * (W / 2 + 0.2)); v.rotation.z = Math.atan2(Math.cos(t) * ar, -Math.sin(t) * span / 2); g.add(v); }
  }
  // newel posts at the corners, wing walls flaring out at both ends, cutwaters under the parapets
  for (const sx of [-1, 1]) for (const s of [-1, 1]) {
    g.add(box(1.7, P + 1.2, 1.7, C.bridgeDeep, sx * (L / 2 - 0.85), yAt(sx * L / 2) + P / 2, s * (W / 2 - 0.42)), box(2, 0.35, 2, C.ashlarDeep, sx * (L / 2 - 0.85), yAt(sx * L / 2) + P + 0.4, s * (W / 2 - 0.42)));
    const wing = box(6, P + 0.6, 0.85, C.bridge, sx * (L / 2 + 2.6), (P + 0.6) / 2, s * (W / 2 + 0.6)); wing.rotation.y = sx * s * -0.35; g.add(wing);
    const cw = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 4), mat(C.bridgeDeep)); place(cw, sx * (span / 2 - 1.5), 0.4, s * (W / 2 + 1.2), Math.PI / 4, s * Math.PI / 2); cw.scale.set(1, 1, 0.6); g.add(cw);
  }
  return g;
}
/** A gorge `w` ft across (local x) running `len` ft (local z): rock faces plunging into the depths, broken rock along both
 *  lips (none within `bw` of a bridge at local z `bz`), and the fog that fills it: an opaque floor of mist just above the
 *  ground, dark under the walls and paler in the middle, with drifting wisps, so it reads as a drop whether or not the
 *  land is drawn beyond the map. */
export function gorge(d: Dims): THREE.Group {
  const w = d.w ?? 60, L = d.len ?? 100, D = 260, g = grp();
  for (const sx of [-1, 1]) {
    const face = new THREE.BoxGeometry(6, D, L, 1, 8, Math.max(2, Math.round(L / 12))); face.translate(sx * (w / 2 + 3), -D / 2 - 0.2, 0);
    const pv = face.attributes.position; for (let i = 0; i < pv.count; i++) if (Math.abs(pv.getX(i)) < w / 2 + 3) pv.setX(i, pv.getX(i) - sx * (((i * 7919) % 13) / 13) * 3.5);
    face.computeVertexNormals(); g.add(new THREE.Mesh(face, mat(C.gorge)));
  }
  const n = Math.max(3, Math.round(L / 6));
  for (let i = 0; i < n; i++) for (const sx of [-1, 1]) {
    const r = 0.9 + hash(i, sx) * 2.2, z = -L / 2 + (i + hash(i, sx + 4)) * (L / n);
    if (d.bz !== undefined && Math.abs(z - d.bz) < (d.bw ?? 14) + r) continue;
    g.add(place(lump(r, i % 3 ? C.rock : C.rockDeep, i * 2 + sx, 1.3, 0.5, 1, 0, 'rock'), sx * (w / 2 - 0.4 + hash(i, sx + 2) * 1.6), r * 0.18, z, hash(i, 7) * 3));
  }
  // the depths: shadow under the walls lightening to the fog that fills the middle (above the ground plane, so the land
  // drawn beyond a map never shows through), ragged where the bands meet
  const band = (ww: number, y: number, color: string, k: number) => {
    const pts: THREE.Vector2[] = [], n = Math.max(4, Math.round(L / 9));
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(-ww / 2 - hash(i, k) * w * 0.05, -L / 2 + (i / n) * L));
    for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(ww / 2 + hash(i, k + 1) * w * 0.05, -L / 2 + (i / n) * L));
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    return new THREE.Mesh(geo, mat(color));
  };
  g.add(band(w + 0.5, 0.07, C.deep0, 1), band(w * 0.74, 0.085, C.deep1, 3), band(w * 0.48, 0.1, C.deep2, 5), band(w * 0.24, 0.115, C.deep3, 7));
  // wisps and rising curtains keep clear of a bridge across it (`bz`: its local z, `bw`: the half-width kept clear)
  const clear = (z: number, r: number) => d.bz === undefined || Math.abs(z - d.bz) > (d.bw ?? 14) + r;
  const nw = Math.max(2, Math.round(L / 16));
  for (let i = 0; i < nw; i++) {
    const r = w * 0.14 + hash(i, 3) * w * 0.1, z = -L / 2 + (i + 0.5) * (L / nw);
    if (clear(z, r * 1.2)) g.add(place(wisp(r, i + 40, C.mist0, 0.3), (hash(i, 1) - 0.5) * w * 0.4, 0.4 + hash(i, 2) * 1.4, z, hash(i, 5) * 3));
  }
  // mist rising out of it in ragged curtains
  const nc = Math.max(1, Math.round(L / 40));
  for (let i = 0; i < nc; i++) {
    const cl = Math.min(L * 0.6, 30 + hash(i, 8) * 30), z = -L / 2 + (i + 0.5) * (L / nc), pts = [new THREE.Vector2(-cl / 2, 0), new THREE.Vector2(cl / 2, 0)];
    if (!clear(z, cl / 2)) continue;
    for (let k = 6; k >= 0; k--) pts.push(new THREE.Vector2(-cl / 2 + (k / 6) * cl, 2 + hash(k, i + 20) * 6));
    const card = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), fogMat(C.mist1, 0.18));
    place(card, (hash(i, 9) - 0.5) * w * 0.3, 0.1, z, Math.PI / 2 + (hash(i, 10) - 0.5) * 0.4); g.add(card);
  }
  return g;
}
/** A waterfall `w` ft wide spilling from a lip `h` ft up (facing local +z) down to the local origin, a foam curl at the
 *  lip and a cloud of spray at its foot. */
export function waterfall(d: Dims): THREE.Group {
  const W = d.w ?? 20, H = d.h ?? 60, g = grp(), COL = [C.fall, C.fallPale, C.fallDeep], n = Math.max(4, Math.round(W / 2.2));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n), ww = (W / n) * (0.95 + hash(i, 1) * 0.35), top = H * (0.95 + hash(i, 2) * 0.05), z = (hash(i, 3) - 0.5) * 0.9 + 0.6;
    const sh = top * (0.3 + hash(i, 4) * 0.35);
    g.add(box(ww, top, 0.8, COL[i % 3], x, top / 2, z), box(0.3, sh, 0.85, C.foam, x + (hash(i, 5) - 0.5) * ww * 0.6, top - sh / 2 - hash(i, 6) * (top - sh), z + 0.05));
  }
  const lip = box(W + 1.2, 1.4, 2.6, C.foam, 0, H - 0.2, 0.2); lip.rotation.x = -0.35; g.add(lip, box(W + 0.6, 0.8, 1.6, C.fallPale, 0, H + 0.4, -0.8));
  for (let i = 0; i < 12; i++) { const sp = place(lump(2.2 + hash(i, 1) * 2.4, C.mist0, i + 3, 1.4, 0.65, 1.1, 1), (hash(i, 2) - 0.5) * (W + 6), 0.8 + hash(i, 3) * 2.5, 2.5 + hash(i, 4) * 6); sp.material = fogMat(i % 2 ? C.mist0 : C.mist1, 0.5); g.add(sp); }
  for (let i = 0; i < 4; i++) g.add(place(wisp(6 + hash(i, 2) * 4, i + 60, C.mist0, 0.28), (hash(i, 5) - 0.5) * W, 4 + i * 3, 6 + hash(i, 6) * 6));
  return g;
}
/** A crag: a faceted mass of living rock `w` × `d` and `h` high, with shoulder rocks, a ledge or two and moss on top.
 *  `top` 1 gives it a flat stance at `h` (a spur something can stand on). */
export function crag(d: Dims): THREE.Group {
  const W = d.w ?? 20, D = d.d ?? 14, H = d.h ?? 16, sd = d.seed ?? 0, g = grp(), COL = [C.rock, C.rockDeep, C.rockPale];
  const mass = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, k: number) => g.add(place(lump(r, COL[k % 3], sd * 13 + k, sx, sy, sz, 1, 'rock'), x, y, z, hash(k, sd) * 6));
  mass(1, W / 2, H * 0.62, D / 2, 0, H * 0.32, 0, 0);
  const m = 2 + Math.round(hash(1, sd) * 2);
  for (let k = 1; k <= m; k++) { const a = hash(k, sd + 1) * Math.PI * 2, f = 0.35 + hash(k, sd + 2) * 0.25; mass(1, W * f / 2, H * f * 0.75, D * f / 2, Math.cos(a) * W * 0.36, H * f * 0.28, Math.sin(a) * D * 0.36, k); }
  for (let k = 0; k < 2; k++) g.add(box(W * 0.3, 0.8, D * 0.3, C.rockDeep, (hash(k, sd + 5) - 0.5) * W * 0.4, H * (0.45 + k * 0.25), (hash(k, sd + 6) - 0.5) * D * 0.4, hash(k, sd) * 3));
  for (let k = 0; k < 5; k++) g.add(place(lump(0.6 + hash(k, sd + 7) * 0.9, C.moss, k, 1.4, 0.4, 1.2, 0), (hash(k, sd + 8) - 0.5) * W * 0.5, H * (0.7 + hash(k, sd + 9) * 0.25), (hash(k, sd + 10) - 0.5) * D * 0.5));
  if (d.top) g.add(place(lump(1, C.rockDeep, sd + 99, W * 0.24, 0.6, D * 0.24, 1, 'rock'), 0, H - 0.55, 0), box(W * 0.34, 0.5, D * 0.3, C.rockDeep, 0, H - 0.25, 0, 0.3));   // a flat stance on top
  return g;
}

// ---------------------------------------------------------------- I: the old cobbles
/** A patch of old setts showing through the mud of a road, about `r` ft across, a few loose stones at its edge. Sits a
 *  hair above the road surface; its colour is the cobble floor's, so it shares that floor's grain. */
export function paving(d: Dims): THREE.Group {
  const r = d.r ?? 6, sd = d.seed ?? 0, pts: THREE.Vector2[] = [];
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, k = r * (0.6 + 0.5 * hash(i, sd)); pts.push(new THREE.Vector2(Math.cos(a) * k * 1.3, Math.sin(a) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.13, 0);
  const g = grp(new THREE.Mesh(geo, mat(FLOOR_COLOR.cobble)));
  for (let i = 0; i < 7; i++) { const a = hash(i, sd + 3) * Math.PI * 2, k = r * (1.0 + hash(i, sd + 4) * 0.4); g.add(box(0.9, 0.3, 0.8, FLOOR_COLOR.cobble, Math.cos(a) * k * 1.3, 0.15, Math.sin(a) * k, hash(i, sd + 5) * 3)); }
  return g;
}
// ---------------------------------------------------------------- signposts
/** A fingerpost. Arms point along the plan bearings `a0`..`a3` (degrees clockwise from map north, with the object's
 *  rotY left at 0), stacked down the post. `broken` 1: only the lower half, snapped and thrust up at an angle;
 *  2: the top half with its arms, lying in the weeds. */
export function fingerpost(d: Dims): THREE.Group {
  const arms: number[] = []; for (let i = 0; i < 4; i++) if (d['a' + i] !== undefined) arms.push(d['a' + i]);
  if (!arms.length) arms.push(90, 270);
  const top = grp(box(0.42, 4.0, 0.42, C.post, 0, 1.6, 0), place(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), mat(C.post)), 0, 3.95, 0, Math.PI / 4));
  arms.forEach((b, i) => {
    const r = (b * Math.PI) / 180, ux = Math.sin(r), uz = -Math.cos(r);
    const arm = grp(box(3.1, 0.68, 0.2, C.arm, 1.8, 0, 0), box(2.1, 0.16, 0.22, C.letter, 1.65, 0.05, 0), place(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.2), mat(C.arm)), 3.35, 0, 0, 0, 0, Math.PI / 4));
    place(arm, 0, 3.1 - i * 0.82, 0, Math.atan2(-uz, ux)); top.add(arm);
  });
  const broken = d.broken ?? 0;
  if (broken === 2) { place(top, 0, 0.45, 0, 0.4, Math.PI / 2 - 0.08); return grp(top, weedTuft(1.2, 1.4, 1.3, 3), weedTuft(-1.4, 0.6, 1.2, 5), weedTuft(0.4, -1.6, 1.1, 7)); }
  if (broken === 1) {
    const stump = grp(box(0.42, 4.4, 0.42, C.post, 0, 2.2, 0)); for (let i = 0; i < 3; i++) stump.add(cone(0.12, 0.7, C.post, (i - 1) * 0.13, 4.6, (i % 2) * 0.1, 4));
    stump.rotation.z = 0.38; return grp(stump, weedTuft(0.5, 0.5, 1, 2));
  }
  top.position.y = 4.6;
  return grp(box(0.42, 4.6, 0.42, C.post, 0, 2.3, 0), box(1.1, 0.5, 1.1, C.post, 0, 0.25, 0), top);
}

// ---------------------------------------------------------------- L: the shore
/** A rowboat about 12 ft long (bow toward local +x): planked hull, floorboards, two thwarts, oars shipped. `hauled` 1
 *  tilts it as if dragged up the shingle; `pole` 1 adds a fishing pole over the stern. */
export function rowboat(d: Dims): THREE.Group {
  const outline = (k: number) => [[-5.6, -1.75], [1.8, -2.15], [4.6, -1.35], [5.9, 0], [4.6, 1.35], [1.8, 2.15], [-5.6, 1.75]].map(([x, y]) => new THREE.Vector2(x * k, y * k));
  const shell = (k: number, inset: number, h: number, y: number, color: string) => {
    const sh = new THREE.Shape(outline(k)); sh.holes.push(new THREE.Path(outline(k).map((p) => p.clone().multiplyScalar(1 - inset / 2)).reverse()));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    return new THREE.Mesh(geo, mat(color));
  };
  const floor = new THREE.ShapeGeometry(new THREE.Shape(outline(0.84))); floor.rotateX(-Math.PI / 2); floor.translate(0, 0.35, 0);
  const g = grp(shell(0.86, 0.3, 0.7, 0, C.hullTrim), shell(1, 0.22, 1.05, 0.65, C.hull), new THREE.Mesh(floor, mat(C.shedBoard)));
  g.add(box(0.2, 0.25, 4.3, C.hullTrim, -5.5, 1.75, 0));
  for (const x of [-2.6, 1.2]) g.add(box(0.95, 0.22, 4.0 - Math.abs(x) * 0.12, C.oar, x, 1.15, 0));
  g.add(box(1.6, 0.22, 3.4, C.oar, -4.6, 1.15, 0));
  if (d.oars ?? 1) for (const z of [-0.9, 0.9]) { const o = box(8.5, 0.14, 0.22, C.oar, -0.4, 1.45, z); o.rotation.y = z * 0.05; g.add(o, box(1.6, 0.08, 0.6, C.oar, -4.3, 1.45, z)); }
  if (d.pole) { const p = box(0.1, 9, 0.1, C.oar, -6.6, 4.2, 0.6); p.rotation.z = 0.95; g.add(p, box(0.03, 5.5, 0.03, C.mist2, -10.6, 3.1, 0.6)); }
  if (d.hauled) { g.rotation.z = 0.09; g.rotation.x = 0.06; g.position.y = 0.2; }
  return grp(g);
}
/** A fisherman's net shed: a lean-to of weathered boards on corner stones, shingled roof sloping to the back, open door,
 *  and a drying rack hung with nets and cork floats beside it. Faces local +z. */
export function netShed(): THREE.Group {
  const W = 10, D = 8, H = 7.5, g = grp();
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) g.add(box(1.2, 0.8, 1.2, C.fieldStone, x, 0.4, z));
  g.add(box(W, 0.4, D, C.shedBoard, 0, 0.9, 0));
  g.add(box(W, H - 1.4, 0.35, C.shedBoard, 0, 1.1 + (H - 1.4) / 2 - 0.4, -D / 2), box(0.35, H - 1.4, D, C.shedBoard, -W / 2, 1.1 + (H - 1.4) / 2 - 0.4, 0), box(0.35, H - 1.4, D, C.shedBoard, W / 2, 1.1 + (H - 1.4) / 2 - 0.4, 0));
  g.add(box(3, H - 0.4, 0.35, C.shedBoard, -3.5, (H + 0.6) / 2, D / 2), box(3, H - 0.4, 0.35, C.shedBoard, 3.5, (H + 0.6) / 2, D / 2), box(4, 1.4, 0.35, C.shedBoard, 0, H + 0.3, D / 2));
  g.add(box(4, 5.6, 0.2, C.slit, 0, 3.9, D / 2 - 0.05));                                          // the dark doorway
  for (const x of [-2.15, 2.15]) g.add(box(0.4, 6, 0.5, C.hullTrim, x, 4.0, D / 2 + 0.05)); g.add(box(4.8, 0.45, 0.55, C.hullTrim, 0, 7.1, D / 2 + 0.05));
  const roof = box(W + 1.6, 0.4, D + 2, C.shedRoof, 0, H + 0.6, 0.2); roof.rotation.x = -0.24; g.add(roof, box(W + 1.8, 0.45, 0.5, C.hullTrim, 0, H + 1.65, D / 2 + 1));
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) for (const z of [-D / 2 + 0.2, D / 2 - 0.2]) g.add(box(0.5, H, 0.5, C.hullTrim, x, H / 2 + 0.4, z));
  // the drying rack, nets, floats
  for (const z of [-2, 4]) g.add(box(0.4, 6.5, 0.4, C.hullTrim, W / 2 + 4, 3.25, z)); g.add(box(0.35, 0.35, 6.6, C.hullTrim, W / 2 + 4, 6.3, 1));
  const net = box(0.12, 4.2, 5.6, C.net, W / 2 + 4.15, 4.1, 1); net.rotation.x = 0.05; g.add(net);
  for (let i = 0; i < 5; i++) g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(C.cork)), W / 2 + 4.25, 6.0, -1.4 + i * 1.2));
  g.add(box(1.8, 0.9, 1.2, C.hullTrim, -W / 2 - 1.6, 0.45, D / 2 - 1));                              // a fish box
  return g;
}
/** Reeds and rushes at the water's edge: a clump `r` ft across. */
export function reeds(d: Dims): THREE.Group {
  const r = d.r ?? 2, n = d.n ?? 9, g = grp();
  for (let i = 0; i < n; i++) { const a = hash(i, 1) * Math.PI * 2, rr = r * Math.sqrt(hash(i, 2)), h = 2.5 + hash(i, 3) * 2.5; const b = box(0.12, h, 0.12, i % 3 ? C.reed : C.reedDry, Math.cos(a) * rr, h / 2, Math.sin(a) * rr); b.rotation.z = (hash(i, 4) - 0.5) * 0.35; b.rotation.x = (hash(i, 5) - 0.5) * 0.35; g.add(b); if (i % 4 === 0) g.add(box(0.22, 0.7, 0.22, C.elkDark, b.position.x, h + 0.2, b.position.z)); }
  return g;
}
/** Tall weeds and dry grass. */
export function weeds(d: Dims): THREE.Group { const g = grp(), n = d.n ?? 4, r = d.r ?? 1.5; for (let i = 0; i < n; i++) g.add(weedTuft((hash(i, 1) - 0.5) * r * 2, (hash(i, 2) - 0.5) * r * 2, 0.9 + hash(i, 3) * 0.5, i)); return g; }
/** A fallen trunk `len` ft long (local x), bark grey with lichen, a pale broken end, snapped branch stubs, moss. */
export function log(d: Dims): THREE.Group {
  const L = d.len ?? 16, r = d.r ?? 1.1, g = grp(place(cyl(r * 0.85, r, L, C.bark, 0, r * 0.9, 0, 8), 0, r * 0.9, 0, 0, 0, Math.PI / 2));
  g.add(place(cyl(r * 0.84, r * 0.84, 0.12, C.cut, 0, 0, 0, 8), L / 2 + 0.02, r * 0.9, 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 4; i++) { const b = box(0.25, 1.4 + hash(i, 1) * 1.2, 0.25, C.bark, -L / 2 + (i + 0.6) * (L / 4.5), r * 1.6, (hash(i, 2) - 0.5) * r); b.rotation.set((hash(i, 3) - 0.5) * 1.2, 0, (hash(i, 4) - 0.5) * 0.9); g.add(b); }
  for (let i = 0; i < 3; i++) g.add(place(lump(0.5 + hash(i, 5) * 0.4, C.moss, i, 1.6, 0.35, 1, 0), -L / 3 + i * (L / 3), r * 1.75, (hash(i, 6) - 0.5) * 0.6));
  return g;
}
/** The invisible doorway of a magnificent mansion, as the DM sees it: a faint violet frame in the air. */
export function shimmerDoor(): THREE.Group {
  const m = veil(PALETTE.violet, 0.55), g = grp();
  for (const [w, h, x, y] of [[0.3, 8, -2.1, 4], [0.3, 8, 2.1, 4], [4.5, 0.3, 0, 8.1], [4.5, 0.2, 0, 0.1]] as const) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), m); b.position.set(x, y, 0); g.add(b); }
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 7.8), veil(PALETTE.violet, 0.14)); pane.position.y = 4; g.add(pane);
  return g;
}

// ---------------------------------------------------------------- figures
/** A burlap sack tied with rope, lying in the boat with a child bound inside. */
export function sackedChild(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp(place(lump(1, C.burlap, 3, 1.75, 0.55, 0.75, 1), 0, 0.55, 0), cone(0.35, 0.6, C.burlap, 1.95, 0.6, 0, 5).rotateZ(-Math.PI / 2));
  for (const x of [-0.7, 0.5, 1.5]) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(x > 1 ? 0.33 : 0.62, 0.07, 4, 10), mat(C.twine)), x, 0.55, 0, Math.PI / 2));
  g.scale.setScalar(s); return g;
}
/** An elk with a full rack of antlers (faces +x). */
export function elk(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.55, g = grp();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1 * s, 1), mat(C.elk)); body.scale.set(2.1, 0.95, 0.82); body.position.set(0, 3.3 * s, 0); g.add(body);
  g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), mat(C.elkPale)), -1.75 * s, 3.4 * s, 0));
  for (const [x, z] of [[-1.45, -0.42], [1.5, -0.42], [-1.45, 0.42], [1.5, 0.42]]) g.add(cyl(0.2 * s, 0.13 * s, 2.7 * s, C.elkDark, x * s, 1.4 * s, z * s, 6), cyl(0.15 * s, 0.17 * s, 0.25 * s, '#1d1916', x * s, 0.12 * s, z * s, 6));
  const neck = cyl(0.42 * s, 0.62 * s, 2.0 * s, C.elkDark, 2.05 * s, 4.25 * s, 0, 7); neck.rotation.z = -0.8; neck.scale.z = 0.8; g.add(neck);
  const head = box(1.5 * s, 0.6 * s, 0.62 * s, C.elk, 3.0 * s, 5.0 * s, 0); head.rotation.z = -0.45; g.add(head, cone(0.12 * s, 0.45 * s, C.elk, 2.55 * s, 5.55 * s, -0.3 * s), cone(0.12 * s, 0.45 * s, C.elk, 2.55 * s, 5.55 * s, 0.3 * s));
  for (const z of [-1, 1]) {
    const beam = box(0.12 * s, 2.6 * s, 0.12 * s, C.antler, 2.3 * s, 6.6 * s, z * 0.55 * s); beam.rotation.set(z * 0.35, 0, 0.55); g.add(beam);
    for (let k = 0; k < 4; k++) { const t = box(0.09 * s, (0.8 - k * 0.1) * s, 0.09 * s, C.antler, (2.6 - k * 0.38) * s, (6.0 + k * 0.42) * s, z * (0.42 + k * 0.1) * s); t.rotation.set(z * 0.25, 0, -0.35); g.add(t); }
  }
  g.add(cone(0.35 * s, 0.9 * s, C.elkDark, 2.35 * s, 3.85 * s, 0, 5).rotateZ(Math.PI));                     // the dewlap
  return g;
}
/** The Mad Mage: a gaunt man in tattered black robes, long black hair and beard streaked with grey, eyes crackling. */
export function madMage(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#d6b496', cloth: C.robe, trim: C.robeTrim, hair: C.mageHair, robe: true, weapon: 'none', scale: s });
  const hy = 5.67 * s;
  g.add(box(0.85 * s, 1.7 * s, 0.25 * s, C.mageHair, 0, hy - 0.75 * s, -0.36 * s), box(0.15 * s, 0.9 * s, 0.26 * s, C.beard, 0.18 * s, hy - 0.4 * s, -0.37 * s));
  g.add(cone(0.33 * s, 1.35 * s, C.mageHair, 0, hy - 0.85 * s, 0.27 * s, 6).rotateX(Math.PI), box(0.1 * s, 0.9 * s, 0.1 * s, C.beard, 0.1 * s, hy - 0.75 * s, 0.38 * s));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(box(0.35 * s, (0.3 + hash(i, 2) * 0.5) * s, 0.12 * s, C.robe, Math.cos(a) * 1.05 * s, 0.25 * s, Math.sin(a) * 1.05 * s, -a + Math.PI / 2)); }
  const spark = mat('#9fd0ff', { emissive: '#4a7ab0' });
  for (const x of [-0.15, 0.15]) g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.07 * s, 0.05 * s), spark), x * s, hy + 0.05 * s, 0.4 * s));
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s, 0), spark); sp.position.set((i % 2 ? 1 : -1) * (0.95 + hash(i, 1) * 0.3) * s, (2.9 + hash(i, 2) * 0.6) * s, (0.3 + hash(i, 3) * 0.3) * s); g.add(sp); }
  return g;
}

Object.assign(PROPS_V1, {
  mist, 'barovia-gate': baroviaGate, 'headless-statue': headlessStatue, 'statue-head': statueHead, gallows, 'hanged-figure': hangedFigure, 'field-wall': fieldWall,
  'black-carriage': blackCarriage, 'curtain-wall': curtainWall, 'ruined-turret': ruinedTurret, 'gargoyle-statue': gargoyleStatue, 'rotten-portcullis': rottenPortcullis, 'green-slime': greenSlime,
  'stone-bridge': stoneBridge, gorge, waterfall, crag, paving, fingerpost, rowboat, 'net-shed': netShed, reeds, weeds, log, 'shimmer-door': shimmerDoor,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'black-horse': (d) => blackHorse(d), 'sacked-child': (d) => sackedChild(d), elk: (d) => elk(d), 'mad-mage': (d) => madMage(d) } as Record<string, (d: Dims) => THREE.Group>);
