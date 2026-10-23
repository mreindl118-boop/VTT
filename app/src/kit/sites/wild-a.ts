// Props and figures for A, the Old Svalich Road at the edge of the Mists (chapter 2): the giant trees whose crowns are
// lost in the fog, the black mirror-pools drowning the road, the weeping bank, the fallen giant, the hunters' signs and
// the things that come up the road out of the fog. Every kind registered here starts with 'a-' so it never collides
// with another site's. Built from THREE meshes with mat() so the world-space surface grain applies; new colours are
// declared with surfaceFor. Feet; origin at the floor centre; +z is plan south; local +x is east when rotY is 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PROPS_V1, vardo } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { SITE_SHAPERS } from '../../render/backdrop';
import { box, cone, cyl, grp, hash, lump, place } from '../shapes';
import { fogMat, mistWall as kitMistWall } from '../mist';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  bark: '#3a2a20', barkDeep: '#241a14', barkGrey: '#4a3f36', root: '#5a4634', rootPale: '#7a6246', snag: '#9c9b95', snagDeep: '#7d7c77',
  bough: '#1e3128', boughDeep: '#162419', moss: '#38432f', blackMoss: '#232a20', needles: '#4f4330', twig: '#5a4a3a',
  earth: '#2b221c', earthWet: '#1d1714', mud: '#2a241e', mudPale: '#3a3229', spoil: '#33281f',
  water: '#0a0d11', waterRim: '#141a1e', rill: '#2c3a44', glint: '#9fb3c2', stain: '#2a1414',
  mist0: '#dcdee2', mist1: '#c7cad0', smoke: '#9a9ca1', voidDark: '#15191d',
  stone: '#6a675f', stoneDeep: '#55534d', bone: '#e8dfc8', boneOld: '#cfc4a8', mail: '#45474c', rust: '#4a3329', iron: '#2e2f33',
  leather: '#5a3f2a', twine: '#8c7b5c', fur: '#4e4d52', furDeep: '#35343a', pelt: '#6b5a45', peltDeep: '#4a3c2e',
  hunterCloth: '#4a4a3c', hunterTrim: '#3b2d22', hunterSkin: '#c9a784', hunterHair: '#3a2a1a', cloakGrey: '#5a5955', trapperTrim: '#3b352c',
  vistRed: '#7a3030', vistGreen: '#2f4d3c', vistBlue: '#34405f', vistGold: '#b08a44', vistSkin: '#b8865a', vistHair: '#1e1a18',
  raven: '#141216', ravenSheen: '#1f1d26', lantern: '#2a2a2e', lanternGlass: '#0d0c10', shroud: '#2a2428',
} as const;
surfaceFor([C.bark, C.barkDeep, C.barkGrey, C.root, C.rootPale, C.twig], 'bark');
surfaceFor([C.snag, C.snagDeep], 'wood');
surfaceFor([C.bough, C.boughDeep, C.moss, C.blackMoss], 'foliage');
surfaceFor([C.needles], 'thatch');
surfaceFor([C.earth, C.earthWet, C.mud, C.mudPale, C.spoil], 'dirt');
surfaceFor([C.rill], 'water');
surfaceFor([C.water, C.waterRim, C.glint, C.stain, C.mist0, C.mist1, C.smoke, C.voidDark, C.lanternGlass], 'none');
surfaceFor([C.stone, C.stoneDeep], 'stone');
surfaceFor([C.mail, C.rust, C.iron, C.lantern], 'metal');
surfaceFor([C.leather, C.twine, C.fur, C.furDeep, C.pelt, C.peltDeep, C.hunterCloth, C.hunterTrim, C.cloakGrey, C.trapperTrim, C.vistRed, C.vistGreen, C.vistBlue, C.vistGold, C.shroud], 'cloth');
surfaceFor([C.bone, C.boneOld, C.hunterSkin, C.hunterHair, C.vistSkin, C.vistHair, C.raven, C.ravenSheen], 'generic');

// ---------------------------------------------------------------- helpers
/** An irregular flat blob in the xz plane, `w` × `d`, lifted `y`: a pool, a stain, a patch of needles. */
function blobGeo(w: number, d: number, seed: number, y: number, n = 11): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.72 + 0.32 * hash(i, seed); pts.push(new THREE.Vector2(Math.cos(a) * (w / 2) * k, Math.sin(a) * (d / 2) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return geo;
}
const blob = (w: number, d: number, seed: number, y: number, color: string, n = 11) => new THREE.Mesh(blobGeo(w, d, seed, y, n), mat(color));
/** A ragged-edged sheet `L` × `D` in the xz plane (a layer of fog seen from above). */
function fogSheetGeo(L: number, D: number, seed: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [], n = Math.max(4, Math.round(L / 6)), m = Math.max(2, Math.round(D / 6));
  const j = (i: number, k: number) => hash(i, seed + k) - 0.5;
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L + j(i, 1) * 3, -D / 2 - Math.abs(j(i, 2)) * D * 0.35));
  for (let i = 1; i <= m; i++) pts.push(new THREE.Vector2(L / 2 + Math.abs(j(i, 3)) * 5, -D / 2 + (i / m) * D));
  for (let i = n - 1; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L + j(i, 4) * 3, D / 2 + Math.abs(j(i, 5)) * D * 0.35));
  for (let i = m - 1; i >= 1; i--) pts.push(new THREE.Vector2(-L / 2 - Math.abs(j(i, 6)) * 5, -D / 2 + (i / m) * D));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2);
  return geo.toNonIndexed();
}
/** A soft flat wisp of fog, radius r, at (x, y, z), turned ry. */
function wispGeo(r: number, seed: number, x: number, y: number, z: number, ry: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, k = r * (0.65 + 0.45 * hash(i, seed)); pts.push(new THREE.Vector2(Math.cos(a) * k * 1.5, Math.sin(a) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.rotateY(ry); geo.translate(x, y, z);
  return geo.toNonIndexed();
}
/** A tapered limb from the origin along local +x, lifted `up` radians and turned `ry`, forking into two twigs. */
function limb(L: number, r: number, color: string, up: number, ry: number, seed: number, forks = 2): THREE.Group {
  const g = grp(); g.rotation.set(0, ry, up);
  const b = cyl(r * 0.45, r, L, color, L / 2, 0, 0, 6); b.rotation.z = -Math.PI / 2; g.add(b);
  for (let k = 0; k < forks; k++) {
    const tl = L * (0.3 + hash(k, seed) * 0.2), s = k % 2 ? 1 : -1;
    const t = cyl(r * 0.2, r * 0.45, tl, color, 0, 0, 0, 5); t.rotation.z = -Math.PI / 2;
    const tg = grp(t); t.position.x = tl / 2; tg.position.set(L * (0.8 + 0.2 * hash(k, seed + 2)), 0, 0); tg.rotation.set(s * (0.3 + hash(k, seed + 3) * 0.5), 0, 0.35 + hash(k, seed + 4) * 0.4); g.add(tg);
    const t2 = cyl(r * 0.1, r * 0.2, tl * 0.5, color, tl * 0.25, 0, 0, 4); t2.rotation.z = -Math.PI / 2; const t2g = grp(t2); t2g.position.set(tl, 0, 0); t2g.rotation.set(0, 0, -0.5 - hash(k, seed + 5) * 0.4); tg.add(t2g);
  }
  return g;
}

/** Collapse a group's meshes into one mesh per material (world transforms baked), so a hidden prop or a figure costs a
 *  handful of draw calls instead of one per box. */
function mergeByMat<T extends THREE.Object3D>(root: T): T {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), local = new THREE.Matrix4();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Object3D[] = [];
  root.traverse((c) => {
    const m = c as THREE.Mesh; if (!m.isMesh || Array.isArray(m.material)) return;
    local.multiplyMatrices(inv, m.matrixWorld);
    let g = m.geometry.clone().applyMatrix4(local);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) { const ng = g.toNonIndexed(); g.dispose(); g = ng; }
    const arr = buckets.get(m.material) ?? []; arr.push(g); buckets.set(m.material, arr);
    drop.push(m);
  });
  for (const m of drop) m.parent?.remove(m);
  for (const [material, gs] of buckets) { const merged = new THREE.Mesh(mergeGeometries(gs)!, material); merged.renderOrder = material.transparent ? 2 : 0; root.add(merged); }
  return root;
}

// ---------------------------------------------------------------- the giants
/** A colossal old-growth conifer: a trunk `r` ft in radius at the base (8–12 ft across), fissured bark, buttress
 *  roots flaring out to about twice its radius, bare lower limbs clawing upward, one dark tier of boughs at 50 ft and
 *  above it the fog that swallows the crown: the trunk stops at 64 ft, hidden in grey. `threshold` 1 adds the long
 *  bare limbs, 40 ft, reaching out along local +x as if holding the Mists back. `seed` varies limbs and roots. */
export function giantPine(d: Dims): THREE.Group {
  const r = (d.r ?? 5) * (d.scale ?? 1), H = 64 * (d.scale ?? 1), sd = d.seed ?? 0, g = grp();
  g.add(cyl(r * 0.55, r, H, C.bark, 0, H / 2, 0, 9));
  // the bark's deep fissures and a flare at the foot
  for (let i = 0; i < 4; i++) { const a = hash(i, sd) * Math.PI * 2, rr = r * (0.98 - 0.4 * 0.35), fh = H * (0.25 + hash(i, sd + 1) * 0.4); g.add(box(0.35, fh, 0.6, C.barkDeep, Math.cos(a) * rr, fh / 2 + 2 + hash(i, sd + 2) * 10, Math.sin(a) * rr, -a)); }
  g.add(cyl(r * 1.02, r * 1.3, 3.2, C.bark, 0, 1.6, 0, 9));
  // buttress roots: a ring of flattened lumps running out from the trunk, with root fingers beyond them
  const nr = 7;
  for (let i = 0; i < nr; i++) {
    const a = ((i + hash(i, sd) * 0.6) / nr) * Math.PI * 2, L = r * (1.3 + hash(i, sd + 3) * 0.7);
    const rt = place(lump(r * 0.42, C.bark, sd * 3 + i, 2.3, 0.5, 0.9, 1), Math.cos(a) * (r * 0.55 + L / 2), r * 0.16, Math.sin(a) * (r * 0.55 + L / 2), -a);
    rt.rotation.z = 0.12; g.add(rt);
    const f = box(r * (0.6 + hash(i, sd + 6) * 0.5), r * 0.14, r * 0.16, C.root, 0, r * 0.06, 0); f.rotation.y = -a + (hash(i, sd + 7) - 0.5) * 0.5;
    const fx = Math.cos(a) * (r * 0.55 + L + r * 0.3), fz = Math.sin(a) * (r * 0.55 + L + r * 0.3); f.position.set(fx, r * 0.06, fz); g.add(f);
    if (i % 2 === 0) g.add(place(lump(r * 0.14, C.moss, i + sd, 1.5, 0.4, 1.1, 0), Math.cos(a) * r * 1.4, r * 0.26, Math.sin(a) * r * 1.4));
  }
  // bare lower limbs, clawing upward and out
  const nl = 6;
  for (let i = 0; i < nl; i++) {
    const a = ((i + 0.5 * hash(i, sd + 9)) / nl) * Math.PI * 2 + sd, y = H * (0.36 + 0.42 * (i / nl)) + hash(i, sd + 10) * 3, L = r * (2.6 + hash(i, sd + 11) * 1.4);
    const lb = limb(L, r * 0.2, C.barkGrey, 0.5 + hash(i, sd + 12) * 0.45, -a, sd * 7 + i); lb.position.set(Math.cos(a) * r * 0.75, y, Math.sin(a) * r * 0.75); g.add(lb);
  }
  // the threshold trees: long bare limbs out along +x, nearly level, holding the fog back
  if (d.threshold) for (let i = 0; i < 3; i++) {
    const y = H * (0.5 + 0.16 * i), ry = (i - 1) * 0.42, lb = limb(40 - i * 6, r * 0.28, C.barkGrey, 0.1 + i * 0.08, ry, sd * 11 + i, 3);
    lb.position.set(Math.cos(ry) * r * 0.8, y, -Math.sin(ry) * r * 0.8); g.add(lb);
  }
  // the tunnel trees: long limbs out along +x, climbing over the road, hung with dark boughs that meet the other side's
  if (d.lean) for (let i = 0; i < 3; i++) {
    const y = H * (0.5 + 0.1 * i), ry = (i - 1) * 0.35, L = 30 + hash(i, sd + 30) * 8, up = 0.2 + i * 0.07;
    const lb = limb(L, r * 0.22, C.barkGrey, up, ry, sd * 13 + i, 2); lb.position.set(Math.cos(ry) * r * 0.8, y, -Math.sin(ry) * r * 0.8); g.add(lb);
    for (let k = 0; k < 3; k++) {
      const t = 0.45 + k * 0.25, lx = Math.cos(ry) * (r * 0.8 + L * t * Math.cos(up)), lz = -Math.sin(ry) * (r * 0.8 + L * t * Math.cos(up));
      g.add(place(lump(4.5 + hash(k, sd + i) * 2, k % 2 ? C.bough : C.boughDeep, sd * 17 + i * 3 + k, 1.7, 0.42, 1.3, 1), lx, y + L * t * Math.sin(up) - 1.5, lz, hash(k, sd + i + 5) * 3));
    }
  }
  // one dark tier of boughs where the fog begins, then the fog itself: billows round the top of the trunk and a thin
  // ragged sheet lying over them, so the crown is a grey cloud from every angle
  const tier = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, H * 0.24, 8, 1, true), mat(C.bough)); tier.position.y = H * 0.82; g.add(tier);
  const fa: THREE.BufferGeometry[] = [], fb: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + sd, rr = r * (1.15 + hash(k, sd + 3) * 0.55), b = lump(rr, C.mist0, sd * 5 + k, 1.5, 0.8, 1.3, 1);
    b.geometry.rotateY(hash(k, sd + 4) * 6); b.geometry.translate(Math.cos(a) * r * 1.25, H * (0.9 + 0.08 * hash(k, sd + 5)), Math.sin(a) * r * 1.25); (k % 2 ? fa : fb).push(b.geometry);
  }
  const top = lump(r * 1.5, C.mist0, sd + 40, 1.4, 0.75, 1.4, 1); top.geometry.translate(0, H * 1.02, 0); fa.push(top.geometry);
  fb.push(wispGeo(r * 2.4, sd + 9, 0, H * 0.87, 0, hash(1, sd) * 3), wispGeo(r * 2.0, sd + 19, (hash(2, sd) - 0.5) * r, H * 0.96, (hash(3, sd) - 0.5) * r, hash(4, sd) * 3));
  g.add(new THREE.Mesh(mergeGeometries(fa)!, fogMat(C.mist0, 0.42)), new THREE.Mesh(mergeGeometries(fb)!, fogMat(C.mist1, 0.3)));
  return g;
}
/** The Grey Mast: a dead giant stripped of bark, silver-grey and `h` ft tall, its crown snapped off in jagged
 *  splinters, broken limbs, and the ravens that gather on it to watch the road. */
export function ravenSnag(d: Dims): THREE.Group {
  const H = d.h ?? 90, r = 3.6, g = grp(cyl(r * 0.36, r, H, C.snag, 0, H / 2, 0, 8), cyl(r * 1.05, r * 1.35, 2.4, C.snagDeep, 0, 1.2, 0, 8));
  for (let i = 0; i < 3; i++) { const a = hash(i, 3) * Math.PI * 2, fh = H * (0.3 + hash(i, 4) * 0.4); g.add(box(0.3, fh, 0.5, C.snagDeep, Math.cos(a) * r * 0.62, fh / 2 + 4, Math.sin(a) * r * 0.62, -a)); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.7, rr = r * (0.2 + hash(i, 5) * 0.2), hh = 5 + hash(i, 6) * 7; g.add(cone(rr, hh, C.snag, Math.cos(a) * r * 0.2, H + hh / 2 - 1, Math.sin(a) * r * 0.2, 4)); }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, y = H * (0.42 + 0.09 * i), L = 7 + hash(i, 7) * 9;
    const lb = limb(L, 0.55, C.snag, 0.25 + hash(i, 8) * 0.4, -a, 30 + i, i % 2 ? 1 : 2); lb.position.set(Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5); g.add(lb);
    // a raven on the limb's end, and one aloft above the crown
    const ex = Math.cos(a) * (r * 0.5 + L * 0.8 * Math.cos(0.4)), ez = Math.sin(a) * (r * 0.5 + L * 0.8 * Math.cos(0.4)), ey = y + L * 0.8 * Math.sin(0.4) + 0.4;
    g.add(box(0.55, 0.35, 0.95, C.raven, ex, ey, ez, -a), cone(0.1, 0.4, C.raven, ex, ey + 0.05, ez, 4).rotateX(Math.PI / 2));
  }
  for (let i = 0; i < 3; i++) g.add(box(0.5, 0.3, 0.9, C.raven, (hash(i, 9) - 0.5) * 3, H + 2 + i * 1.5, (hash(i, 10) - 0.5) * 3, hash(i, 11) * 3));
  for (let i = 0; i < 2; i++) { const ry = hash(i, 12) * 3, w = grp(box(2.4, 0.08, 0.7, C.raven, 0, 0, 0), box(0.5, 0.3, 1.0, C.raven, 0, 0, 0)); place(w, (hash(i, 13) - 0.5) * 10, H + 6 + i * 4, (hash(i, 14) - 0.5) * 10, ry); g.add(w); }
  return g;
}
/** A toppled giant `len` ft long lying along local +x: its 15-ft root plate torn out and standing like a wall at -x, the
 *  trunk tapering to a hollow mouth at +x, snapped branch stubs on top and moss. Its top stands about 2 r up. */
export function fallenGiant(d: Dims): THREE.Group {
  const L = d.len ?? 110, r = d.r ?? 4.5, g = grp();
  const trunk = cyl(r * 0.62, r, L, C.bark, 0, r * 0.88, 0, 10); trunk.rotation.z = -Math.PI / 2; g.add(trunk);
  for (let i = 0; i < 5; i++) g.add(box(L * (0.25 + hash(i, 1) * 0.3), 0.3, 0.5, C.barkDeep, -L / 2 + (hash(i, 2) + 0.2) * L * 0.6, r * (0.88 + 0.75 * Math.sin(1 + i)), r * 0.85 * Math.cos(1 + i)));
  // the root plate: a flattened disc of earth and roots standing on end, root fingers radiating from it
  const plate = place(lump(r * 1.55, C.earth, 5, 0.3, 1.05, 1.05, 1), -L / 2 - r * 0.3, r * 1.5, 0); g.add(plate);
  g.add(place(lump(r * 1.1, C.root, 6, 0.26, 1, 1, 1), -L / 2 - r * 0.55, r * 1.5, 0));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rl = r * (1.4 + hash(i, 3) * 1.2); const f = box(rl, r * 0.16, r * 0.14, C.root, 0, 0, 0); f.rotation.set(0, 0, 0); const fg = grp(f); f.position.x = rl / 2; fg.position.set(-L / 2 - r * 0.6, r * 1.5, 0); fg.rotation.set(a, Math.PI / 2 + (hash(i, 4) - 0.5) * 0.5, 0); g.add(fg); }
  g.add(place(lump(r * 0.8, C.spoil, 7, 1.6, 0.4, 1.2, 1), -L / 2 - r * 0.2, 0.2, r * 0.9), place(lump(r * 0.6, C.spoil, 8, 1.4, 0.4, 1.1, 1), -L / 2 + r * 0.4, 0.15, -r * 1.1));
  // the hollow mouth at the far end
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 9), mat(C.voidDark)); place(mouth, L / 2 + 0.03, r * 0.8, 0, Math.PI / 2); g.add(mouth);
  g.add(cyl(r * 0.64, r * 0.64, 0.4, C.barkDeep, L / 2 - 0.1, r * 0.88, 0, 10).rotateZ(Math.PI / 2));
  // snapped branch stubs, and moss along the top
  for (let i = 0; i < 6; i++) { const x = -L / 2 + L * (0.15 + 0.12 * i) + hash(i, 5) * 4, rr = r * (1 - 0.38 * ((x + L / 2) / L)); const st = cyl(0.3, 0.5, 2.5 + hash(i, 6) * 3, C.barkGrey, x, rr * 1.8 + 0.8, (hash(i, 7) - 0.5) * rr); st.rotation.set((hash(i, 8) - 0.5) * 0.9, 0, (hash(i, 9) - 0.5) * 0.7); g.add(st); }
  for (let i = 0; i < 7; i++) { const x = -L / 2 + (i + 0.5) * (L / 7), rr = r * (1 - 0.38 * ((x + L / 2) / L)); g.add(place(lump(0.9 + hash(i, 10) * 0.8, i % 2 ? C.moss : C.blackMoss, i, 2.2, 0.35, 1.2, 0), x, rr * 1.86, (hash(i, 11) - 0.5) * rr * 0.8)); }
  return g;
}

// ---------------------------------------------------------------- the black water and the churned road
/** A still black pool `w` × `d` with a soft mud rim: a near-black smooth surface (the mirror), a darker ring at the
 *  edge, and two pale streaks lying on it, the grey sky reflected. */
export function blackPool(d: Dims): THREE.Group {
  const w = d.w ?? 16, dd = d.d ?? 12, sd = d.seed ?? 0;
  const g = grp(blob(w + 3.2, dd + 3.2, sd, 0.14, C.mud), blob(w + 1.1, dd + 1.1, sd, 0.165, C.waterRim), blob(w, dd, sd, 0.185, C.water));
  for (let k = 0; k < 2; k++) { const s = new THREE.Mesh(blobGeo(w * (0.28 + 0.1 * k), dd * 0.16, sd + 3 + k, 0.2, 7), fogMat(C.mist1, 0.14)); s.position.set((hash(k, sd) - 0.5) * w * 0.4, 0, (hash(k, sd + 1) - 0.5) * dd * 0.45); s.rotation.y = (hash(k, sd + 2) - 0.5) * 0.6; g.add(s); }
  for (let k = 0; k < 4; k++) { const a = hash(k, sd + 7) * Math.PI * 2; g.add(place(lump(0.5 + hash(k, sd + 8) * 0.6, C.mudPale, k + sd, 1.4, 0.25, 1, 0), Math.cos(a) * (w / 2 + 1.2), 0.2, Math.sin(a) * (dd / 2 + 1.2))); }
  return g;
}
/** The turning circle: a ring of churned wheel ruts and hoofprints `r` ft in radius, the ruts brimming with black water. */
export function turningCircle(d: Dims): THREE.Group {
  const r = d.r ?? 25, g = grp();
  const ring = (ri: number, ro: number, y: number, color: string, a0 = 0, al = Math.PI * 2, m?: THREE.Material) => { const geo = new THREE.RingGeometry(ri, ro, 40, 1, a0, al); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return new THREE.Mesh(geo, m ?? mat(color)); };
  g.add(ring(r - 7, r + 1.5, 0.12, C.mud), ring(r * 0.18, r * 0.5, 0.115, C.mudPale));
  for (let k = 0; k < 7; k++) { const a0 = hash(k, 1) * Math.PI * 2, al = 0.5 + hash(k, 2) * 1.6, rr = r - 5 + hash(k, 3) * 4.5; g.add(ring(rr - 0.45, rr + 0.45, 0.15, C.water, a0, al)); }
  for (let k = 0; k < 5; k++) { const a0 = hash(k, 4) * Math.PI * 2, al = 0.3 + hash(k, 5) * 0.9, rr = r - 3 + hash(k, 6) * 3; g.add(ring(rr - 0.3, rr + 0.3, 0.145, C.mudPale, a0, al)); }
  for (let k = 0; k < 26; k++) { const a = hash(k, 7) * Math.PI * 2, rr = r * (0.3 + hash(k, 8) * 0.65); g.add(place(new THREE.Mesh(blobGeo(0.9, 1.2, k, 0.16, 6), mat(C.earthWet)), Math.cos(a) * rr, 0, Math.sin(a) * rr, hash(k, 9) * 3)); }
  return g;
}
/** Two deep wheel ruts `len` ft long (local x), `w` ft apart, brimming with black water, mud ridged beside them. */
export function wagonRuts(d: Dims): THREE.Group {
  const L = d.len ?? 40, w = d.w ?? 6, g = grp();
  for (const s of [-1, 1]) {
    g.add(box(L, 0.05, 0.95, C.water, 0, 0.165, s * w / 2), box(L, 0.22, 0.55, C.mud, 0, 0.12, s * (w / 2 + 0.8)), box(L, 0.18, 0.45, C.mudPale, 0, 0.11, s * (w / 2 - 0.75)));
  }
  for (let k = 0; k < Math.max(2, Math.round(L / 9)); k++) g.add(place(new THREE.Mesh(blobGeo(1.1, 1.4, k, 0.15, 6), mat(C.earthWet)), -L / 2 + (k + 0.5) * (L / Math.max(2, Math.round(L / 9))), 0, (hash(k, 3) - 0.5) * (w - 2.5), hash(k, 4) * 3));
  return g;
}
/** A thin rill of spring water crossing the ground `len` ft (local x): a narrow dark wet strip with glints on it. */
export function seepRill(d: Dims): THREE.Group {
  const L = d.len ?? 30, g = grp(box(L, 0.05, 1.3, C.rill, 0, 0.17, 0), box(L, 0.04, 2.4, C.earthWet, 0, 0.145, 0));
  for (let k = 0; k < Math.round(L / 4); k++) g.add(box(0.5 + hash(k, 1) * 0.6, 0.03, 0.18, C.glint, -L / 2 + (k + 0.5) * (L / Math.round(L / 4)), 0.2, (hash(k, 2) - 0.5) * 0.8));
  return g;
}
/** The weeping bank: a cut face of black earth `len` ft long (local x) and `h` high, its face toward local +z, leaning
 *  back a little, turf at the lip, roots hanging out of it, seep stains and drips, moss. `ladder` 1 adds the druids'
 *  root ladder up the middle. */
export function rootBank(d: Dims): THREE.Group {
  const L = d.len ?? 40, h = d.h ?? 7, sd = d.seed ?? 0, g = grp();
  const face = box(L, h + 0.4, 1.8, C.earth, 0, h / 2, -0.9); face.rotation.x = -0.1; g.add(face);
  g.add(box(L + 0.2, 0.7, 2.2, C.moss, 0, h + 0.05, -0.9));
  const nr = Math.max(3, Math.round(L / 3.2));
  for (let i = 0; i < nr; i++) {
    const x = -L / 2 + (i + 0.5) * (L / nr) + (hash(i, sd) - 0.5) * 1.5, top = h * (0.55 + hash(i, sd + 1) * 0.45), rl = 1.5 + hash(i, sd + 2) * (h * 0.5);
    const rt = cyl(0.08, 0.2, rl, i % 3 ? C.root : C.rootPale, x, top - rl / 2, 0.25 - (h - top) * 0.1, 5); rt.rotation.set((hash(i, sd + 3) - 0.5) * 0.3, 0, (hash(i, sd + 4) - 0.5) * 0.45); g.add(rt);
    if (i % 2 === 0) g.add(place(lump(0.35 + hash(i, sd + 5) * 0.4, C.moss, i + sd, 1.4, 0.6, 0.5, 0), x + 0.8, h * (0.2 + hash(i, sd + 6) * 0.6), 0.2));
    if (i % 3 === 1) g.add(box(0.6 + hash(i, sd + 7) * 0.8, h * (0.3 + hash(i, sd + 8) * 0.5), 0.08, C.earthWet, x - 0.6, h * 0.35, 0.18));
    g.add(box(0.12, 0.12, 0.12, C.glint, x + (hash(i, sd + 9) - 0.5) * 2, 0.4 + hash(i, sd + 10) * (h - 1), 0.22));
  }
  for (let i = 0; i < Math.round(L / 8) + 1; i++) g.add(place(lump(0.5 + hash(i, sd + 11) * 0.5, C.earth, i + sd * 3, 1.5, 0.5, 1.1, 0), -L / 2 + hash(i, sd + 12) * L, 0.25, 0.9 + hash(i, sd + 13)));
  if (d.ladder) {
    for (const x of [-1.2, 1.2]) g.add(cyl(0.15, 0.22, h + 0.6, C.rootPale, x, h / 2 + 0.1, 0.3, 5));
    for (let k = 0; k < Math.round(h / 1.3); k++) g.add(box(2.9, 0.26, 0.3, C.root, (hash(k, 1) - 0.5) * 0.3, 0.9 + k * 1.3, 0.35));
  }
  return g;
}
/** The tunnel west: the crowns of the trees on both verges closing over the road, `len` along local x and `d` across, a
 *  vault of dark boughs sagging lowest at the verges (`h` ft) and highest over the crown of the road, hung with drooping
 *  bough-ends, a ragged fog crown lying on top, and a dark shade on the ground below so the road reads as roofed. Merged:
 *  five draw calls. */
export function tunnelRoof(d: Dims): THREE.Group {
  const L = d.len ?? 120, D = d.d ?? 40, H = d.h ?? 42, sd = d.seed ?? 0, g = grp();
  const deep: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], hang: THREE.BufferGeometry[] = [], fogA: THREE.BufferGeometry[] = [], fogB: THREE.BufferGeometry[] = [];
  const vault = (z: number) => H + 12 * (1 - Math.min(1, (2 * Math.abs(z)) / D) ** 2);
  const nx = Math.max(4, Math.round(L / 9)), nz = 5;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const j = i * 7 + k, x = -L / 2 + ((i + 0.5 + (hash(j, sd) - 0.5) * 0.6) / nx) * L, z = -D / 2 + ((k + 0.5 + (hash(j, sd + 1) - 0.5) * 0.5) / nz) * D;
    const b = lump(5 + hash(j, sd + 2) * 3, C.bough, sd * 31 + j, 1.6, 0.4, 1.25, 1);
    b.geometry.rotateY(hash(j, sd + 3) * 6); b.geometry.translate(x, vault(z) + (hash(j, sd + 4) - 0.5) * 3, z); ((i + k) % 2 ? deep : dark).push(b.geometry);
    // a drooping bough-spray under the vault: flat, tilted, more of them toward the verges
    if (hash(j, sd + 5) < 0.3 + Math.abs(z) / D) {
      const len = 4 + hash(j, sd + 6) * 6, c = new THREE.ConeGeometry(2.6 + hash(i, sd + 7) * 1.6, len, 6);
      c.scale(1, 1, 0.45); c.rotateX(Math.PI + (hash(j, sd + 10) - 0.5) * 0.7); c.rotateY(hash(j, sd + 11) * 6);
      c.translate(x + (hash(k, sd + 8) - 0.5) * 4, vault(z) - 0.5 - len / 2, z + (hash(i, sd + 9) - 0.5) * 3); hang.push(c);
    }
  }
  // the sides come down: long boughs hanging from both verges almost to head height, so the road runs in a corridor
  const ns = Math.max(6, Math.round(L / 6));
  for (const side of [-1, 1]) for (let i = 0; i < ns; i++) {
    const j = i + (side > 0 ? 500 : 0), x = -L / 2 + ((i + 0.5 + (hash(j, sd + 20) - 0.5) * 0.8) / ns) * L, z = side * (D / 2 - 1 - hash(j, sd + 21) * 4);
    const len = 14 + hash(j, sd + 22) * 12, c = new THREE.ConeGeometry(3.2 + hash(j, sd + 23) * 2, len, 6);
    c.scale(1, 1, 0.5); c.rotateX(Math.PI - side * (0.15 + hash(j, sd + 24) * 0.25)); c.translate(x, vault(z) + 1 - len / 2, z); hang.push(c);
  }
  // the fog crown on top: the trees' heads are lost in it, as everywhere on this road
  for (let k = 0; k < 2; k++) { const sh = fogSheetGeo(L * (1.05 - 0.12 * k), D * (1.1 - 0.2 * k), sd * 5 + k); sh.translate(0, H + 13 + k * 5, 0); (k ? fogB : fogA).push(sh); }
  for (let i = 0; i < Math.round(L / 14); i++) { const b = lump(6 + hash(i, sd + 11) * 4, C.mist0, sd + i * 3, 1.6, 0.6, 1.2, 1); b.geometry.translate(-L / 2 + ((i + 0.5) / Math.round(L / 14)) * L, H + 14 + hash(i, sd + 12) * 4, (hash(i, sd + 13) - 0.5) * D * 0.7); fogA.push(b.geometry); }
  g.add(new THREE.Mesh(mergeGeometries(deep)!, mat(C.boughDeep)), new THREE.Mesh(mergeGeometries(dark)!, mat(C.bough)), new THREE.Mesh(mergeGeometries(hang.map((h) => h.toNonIndexed()))!, mat(C.boughDeep)));
  const f1 = new THREE.Mesh(mergeGeometries(fogA.map((h) => (h.index ? h.toNonIndexed() : h)))!, fogMat(C.mist0, 0.4)), f2 = new THREE.Mesh(mergeGeometries(fogB)!, fogMat(C.mist1, 0.3));
  // the shade it throws on the road: darkest down the middle
  const shade = new THREE.Mesh(fogSheetGeo(L * 0.95, D * 0.75, sd + 77), fogMat(C.voidDark, 0.5)); shade.position.y = 0.35;
  for (const m of [f1, f2, shade]) { m.renderOrder = 2; g.add(m); }
  return g;
}
/** A buttress root of a giant breaking out of the verge: a long arched hump `len` ft along local x, `h` ft high, mossy on
 *  top, with root fingers at its end; cover to crouch behind. */
export function buttressRoot(d: Dims): THREE.Group {
  const L = d.len ?? 16, h = d.h ?? 4, sd = d.seed ?? 0, g = grp();
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4, x = -L / 2 + t * L, y = h * (0.45 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3)));
    g.add(place(lump(h * 0.6 * (1.15 - t * 0.35), C.bark, sd * 5 + i, 1.5, 0.75, 0.8, 1), x, y * 0.55, 0, hash(i, sd) * 0.3));
  }
  g.add(place(lump(h * 0.35, C.moss, sd + 9, 2.4, 0.35, 0.9, 1), -L * 0.1, h * 0.85, 0));
  for (let k = 0; k < 3; k++) { const f = box(L * 0.3, 0.6, 0.7, C.root, L / 2 + L * 0.1, 0.25, (k - 1) * 1.3, (k - 1) * 0.5); g.add(f); }
  return g;
}
/** Low ground fog `w` × `d`, knee-high (`h`): three thinning ragged sheets and drifting wisps, see-through. */
export function groundFog(d: Dims): THREE.Group {
  const W = d.w ?? 40, D = d.d ?? 30, H = d.h ?? 3, sd = d.seed ?? 0, g = grp();
  const a: THREE.BufferGeometry[] = [], b: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) { const t = (k + 0.5) / 3, sh = fogSheetGeo(W * (1 - 0.25 * t), D * (1 - 0.3 * t), sd * 7 + k); sh.translate((hash(k, sd) - 0.5) * W * 0.1, 0.25 + t * H, (hash(k, sd + 1) - 0.5) * D * 0.1); (k % 2 ? b : a).push(sh); }
  const nw = Math.max(3, Math.round((W * D) / 220));
  for (let i = 0; i < nw; i++) (i % 2 ? a : b).push(wispGeo(4 + hash(i, sd + 2) * 6, i + sd, (hash(i, sd + 3) - 0.5) * W * 1.1, 0.4 + hash(i, sd + 4) * H * 1.2, (hash(i, sd + 5) - 0.5) * D * 1.1, hash(i, sd + 6) * 3));
  g.add(new THREE.Mesh(mergeGeometries(a)!, fogMat(C.mist0, 0.2)), new THREE.Mesh(mergeGeometries(b)!, fogMat(C.mist1, 0.17)));
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.renderOrder = 2; });
  return g;
}
/** The Mists: a wall of fog `len` long (local x), `h` high and `d` deep, built like the kit's mist (stacked layers that
 *  shrink toward the top, ragged curtains across its depth, billows at its foot, wisps creeping out along the ground) but
 *  merged into a handful of meshes: a 440-ft wall costs five draw calls, not two hundred. Drawn after the grid. */
export function mistWall(d: Dims): THREE.Group {
  const L = d.len ?? 60, H = d.h ?? 30, D = d.d ?? 16, g = grp();
  const sheets0: THREE.BufferGeometry[] = [], sheets1: THREE.BufferGeometry[] = [], curtains: THREE.BufferGeometry[] = [], billows: THREE.BufferGeometry[] = [], wisps: THREE.BufferGeometry[] = [];
  const nl = Math.max(2, Math.round(H / 4.5));
  for (let k = 0; k < nl; k++) { const t = (k + 0.5) / nl, sh = fogSheetGeo(L * (1 - 0.18 * t), D * (1.05 - 0.55 * t), k * 7 + 3); sh.translate((hash(k, 2) - 0.5) * 4, t * H * 0.95, (hash(k, 3) - 0.5) * D * 0.15); (k % 2 ? sheets1 : sheets0).push(sh); }
  const nc = Math.max(2, Math.round(D / 5));
  for (let c = 0; c < nc; c++) {
    const pts = [new THREE.Vector2(-L / 2, 0), new THREE.Vector2(L / 2, 0)], m = Math.max(6, Math.round(L / 8));
    for (let i = m; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / m) * L, H * (0.55 + 0.5 * hash(i, c + 11))));
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)).toNonIndexed(); geo.translate(0, 0, -D / 2 + ((c + 0.5) / nc) * D); curtains.push(geo);
  }
  const nb = Math.max(2, Math.round(L / 10));
  for (let i = 0; i < nb; i++) for (const s of [-1, 1]) {
    const r = Math.min(H * 0.5, 4 + hash(i, s + 5) * 4), b = lump(r, C.mist0, i * 2 + s, 1.4, 0.7, 1.1, 1);
    b.geometry.rotateY(hash(i, 1) * 6); b.geometry.translate(-L / 2 + (i + 0.5) * (L / nb), r * 0.4, s * D * 0.45); billows.push(b.geometry);
  }
  const nw = Math.max(3, Math.round(L / 14));
  for (let i = 0; i < nw; i++) for (const s of [-1, 1]) wisps.push(wispGeo(5 + hash(i, s + 9) * 5, i * 3 + s, -L / 2 + (i + 0.5) * (L / nw), 0.5 + hash(i, s) * 0.8, s * (D / 2 + 3 + hash(i, s + 4) * 6), hash(i, 2) * 3));
  g.add(new THREE.Mesh(mergeGeometries(sheets0)!, fogMat(C.mist0, 0.3)), new THREE.Mesh(mergeGeometries(sheets1)!, fogMat(C.mist1, 0.3)), new THREE.Mesh(mergeGeometries(curtains)!, fogMat(C.mist1, 0.2)),
        new THREE.Mesh(mergeGeometries(billows)!, fogMat(C.mist0, 0.45)), new THREE.Mesh(mergeGeometries(wisps)!, fogMat(C.mist0, 0.3)));
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.renderOrder = 2; });
  return g;
}
/** Pipe smoke: a thin grey column of puffs rising and spreading, 15 ft up. */
export function pipeSmoke(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + i * 0.3, 1), fogMat(C.smoke, 0.24)); p.position.set((hash(i, 1) - 0.5) * (0.6 + i * 0.5), 5.5 + i * 1.9, (hash(i, 2) - 0.5) * (0.6 + i * 0.5)); g.add(p); }
  return mergeByMat(g);
}

// ---------------------------------------------------------------- what the hunters left, and what is hidden
/** A wolf skull spiked to bark 8 ft up (the prop's local +z faces out from the trunk): the skull, the iron spike through
 *  it, a deep-cut arrow beneath pointing down the road, and a column of tally scratches beside. */
export function skullBlaze(d: Dims): THREE.Group {
  const y = d.h ?? 8, g = grp();
  const skull = place(lump(0.55, C.bone, 2, 1, 0.9, 1.1, 1), 0, y, 0.55); g.add(skull);
  g.add(box(0.5, 0.42, 0.9, C.bone, 0, y - 0.22, 1.05), box(0.42, 0.18, 0.75, C.boneOld, 0, y - 0.5, 1.0));
  for (let i = 0; i < 4; i++) g.add(cone(0.05, 0.22, C.bone, -0.18 + i * 0.12, y - 0.42, 1.45, 4).rotateX(Math.PI));
  for (const x of [-0.2, 0.2]) g.add(box(0.16, 0.16, 0.1, C.voidDark, x, y + 0.08, 1.05));
  g.add(cyl(0.05, 0.05, 1.3, C.iron, 0, y + 0.1, 0.5, 5).rotateX(Math.PI / 2), box(0.22, 0.22, 0.12, C.rust, 0, y + 0.1, 1.17));
  // the arrow cut into the bark, pointing down; tally cuts in a column to the right of it
  g.add(box(0.22, 2.2, 0.12, C.rootPale, 0, y - 2.2, 0.08), box(0.22, 0.9, 0.12, C.rootPale, -0.32, y - 3.0, 0.08, 0).rotateZ(-0.75), box(0.22, 0.9, 0.12, C.rootPale, 0.32, y - 3.0, 0.08).rotateZ(0.75));
  for (let i = 0; i < 7; i++) g.add(box(0.5, 0.09, 0.1, C.rootPale, 1.1 + (i % 2) * 0.1, y - 1.2 - i * 0.42, 0.08).rotateZ((hash(i, 4) - 0.5) * 0.3));
  return g;
}
/** A grey wolf dead on its side, two boar-spears and three crossbow bolts in it, a dark stain in the mud. Local +x is
 *  the way its head points. */
export function wolfCarcass(): THREE.Group {
  const g = grp(blob(9, 6, 4, 0.13, C.stain));
  g.add(place(lump(1.1, C.fur, 1, 2.3, 0.75, 1.3, 1), 0, 0.85, 0), place(lump(0.75, C.furDeep, 2, 1.2, 0.9, 1.2, 1), 1.4, 0.9, 0.1));
  g.add(box(1.0, 0.75, 0.8, C.fur, 2.6, 0.75, 0.2, 0.2), box(0.8, 0.45, 0.45, C.fur, 3.4, 0.6, 0.35), cone(0.14, 0.4, C.fur, 2.7, 1.1, -0.15, 4).rotateX(-0.6), cone(0.14, 0.4, C.fur, 2.5, 1.15, 0.55, 4).rotateX(-0.6));
  for (let i = 0; i < 4; i++) { const lg = cyl(0.1, 0.17, 1.9, C.fur, -1.1 + (i % 2) * 2.0, 0.55, 1.1 + Math.floor(i / 2) * 0.55, 5); lg.rotation.set(-1.25 + (i % 2) * 0.25, 0, (hash(i, 1) - 0.5) * 0.5); g.add(lg); }
  const tail = cone(0.24, 1.6, C.furDeep, -2.2, 0.45, -0.4); tail.rotation.set(0.3, 0, 1.75); g.add(tail);
  // the boar spears: long ash shafts with a leaf blade and the cross-lugs, driven in at a slant
  for (const [x, z, rz, rx] of [[-0.3, -0.3, 0.55, 0.25], [0.9, 0.2, -0.4, -0.35]] as const) {
    const sp = grp(cyl(0.07, 0.09, 7.5, C.twig, 0, 3.75, 0, 5), box(0.5, 0.12, 0.12, C.iron, 0, 1.5, 0), cone(0.1, 0.6, C.iron, 0, 1.05, 0, 4).rotateX(Math.PI));
    place(sp, x, 0.9, z, 0, rx, rz); g.add(sp);
  }
  for (let i = 0; i < 3; i++) { const b = grp(cyl(0.035, 0.035, 1.5, C.twig, 0, 0.75, 0, 4), box(0.15, 0.25, 0.04, C.mudPale, 0, 1.45, 0)); place(b, -1.5 + i * 1.1, 0.95, -0.6 + (i % 2) * 1.1, 0, (hash(i, 2) - 0.5) * 0.9, 0.5 + hash(i, 3) * 0.6); g.add(b); }
  return g;
}
/** An old soldier's grave: a cairn of grey stones 8 ft long (v 0), or (v 1, the default) broken open: the dark hole,
 *  spoil heaped beside it, stones tumbled about, bones in rusted mail half lifted out, and a spade standing in the spoil. */
export function grave(d: Dims): THREE.Group {
  const v = d.v ?? 1, g = grp();
  const stone = (x: number, y: number, z: number, r: number, i: number) => g.add(place(lump(r, i % 3 ? C.stone : C.stoneDeep, i + 20, 1.3, 0.7, 1, 0, 'stone'), x, y, z, hash(i, 5) * 3));
  if (v === 0) {
    for (let i = 0; i < 16; i++) stone(-3.4 + (i % 8) * 0.95, 0.35, (i < 8 ? -0.9 : 0.9) + (hash(i, 1) - 0.5) * 0.5, 0.65 + hash(i, 2) * 0.3, i);
    for (let i = 0; i < 6; i++) stone(-2.4 + i * 0.95, 1.05, (hash(i, 3) - 0.5) * 0.6, 0.6 + hash(i, 4) * 0.3, i + 30);
    return mergeByMat(g);
  }
  g.add(blob(7.2, 3.2, 9, 0.14, C.voidDark), blob(8.6, 4.6, 9, 0.12, C.earthWet));
  g.add(place(lump(1.5, C.spoil, 11, 1.8, 0.6, 1.1, 1), 0.5, 0.45, 3.4), place(lump(1.1, C.spoil, 12, 1.5, 0.55, 1.1, 1), -2.8, 0.35, 2.9), place(lump(0.9, C.spoil, 13, 1.4, 0.5, 1, 1), 3.2, 0.3, -2.6));
  for (let i = 0; i < 12; i++) { const a = hash(i, 6) * Math.PI * 2, rr = 3 + hash(i, 7) * 3.5; stone(Math.cos(a) * rr * 1.3, 0.3, Math.sin(a) * rr * 0.8, 0.55 + hash(i, 8) * 0.35, i); }
  // the spade in the spoil, the bones and the mail hauled half out
  const spade = grp(cyl(0.09, 0.09, 4.4, C.twig, 0, 2.2, 0, 5), box(0.5, 0.25, 0.14, C.twig, 0, 4.45, 0), box(0.85, 1.1, 0.1, C.rust, 0, 0.0, 0)); place(spade, 1.1, 0.9, 3.5, 0.4, 0.25, -0.2); g.add(spade);
  g.add(box(1.7, 0.3, 1.15, C.mail, -1.6, 0.4, -0.3, 0.3), box(0.9, 0.22, 0.6, C.mail, -0.3, 0.3, -1.7, -0.4));
  g.add(place(lump(0.42, C.boneOld, 15, 1, 0.9, 1.1, 0), 2.0, 0.42, -0.4), box(0.3, 0.2, 0.42, C.boneOld, 2.35, 0.3, -0.1));
  for (let i = 0; i < 6; i++) g.add(box(0.14, 0.14, 1.1 + hash(i, 9) * 0.8, C.boneOld, -2.5 + hash(i, 10) * 5, 0.25, -1.4 + hash(i, 11) * 2.4, hash(i, 12) * 3));
  g.add(box(0.14, 2.2, 0.14, C.rust, 3.6, 0.3, 1.2, 0).rotateX(Math.PI / 2 - 0.2), box(0.55, 0.1, 0.12, C.rust, 3.6, 0.32, 0.25));
  return mergeByMat(g);
}
/** A rusted steel wolf trap, jaws open, its chain running to a stake, half drawn under a skin of pine needles. */
export function wolfTrap(): THREE.Group {
  const g = grp(box(1.5, 0.1, 1.0, C.rust, 0, 0.1, 0), box(0.9, 0.08, 0.7, C.iron, 0, 0.17, 0));
  for (const s of [-1, 1]) {
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 5, 10, Math.PI), mat(C.rust)); place(jaw, 0, 0.2, s * 0.08, 0, Math.PI / 2 - s * 0.95, s > 0 ? Math.PI : 0); g.add(jaw);
    for (let i = 0; i < 4; i++) { const a = (i + 0.5) / 4 * Math.PI, t = cone(0.05, 0.22, C.iron, Math.cos(a) * 0.72, 0.22 + Math.sin(a) * 0.72 * 0.8, s * (0.08 + Math.sin(a) * 0.72 * 0.55), 4); t.rotation.x = s * 0.95; g.add(t); }
  }
  for (let i = 0; i < 7; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 8), mat(C.rust)).translateX(0.9 + i * 0.26).translateY(0.1).translateZ(0.5 + i * 0.12).rotateX(i % 2 ? Math.PI / 2 : 0));
  g.add(box(0.25, 1.1, 0.25, C.twig, 2.8, 0.3, 1.4).rotateX(0.3));
  const cover = new THREE.Mesh(blobGeo(3.6, 2.6, 3, 0.09, 9), mat(C.needles)); cover.position.set(-0.7, 0.2, -0.3); g.add(cover);
  for (let i = 0; i < 5; i++) g.add(box(0.9 + hash(i, 1), 0.06, 0.08, C.twig, -1.2 + hash(i, 2) * 2.4, 0.33, -1 + hash(i, 3) * 1.6, hash(i, 4) * 3));
  return mergeByMat(g);
}
/** A small bundle of clothes tied in leather with twine, stuffed into a hollow. */
export function leatherBundle(): THREE.Group {
  const g = grp(place(lump(0.75, C.leather, 4, 1.6, 0.75, 1, 1), 0, 0.55, 0));
  for (const x of [-0.45, 0.4]) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 4, 10), mat(C.twine)), x, 0.55, 0, Math.PI / 2, 0, 0.1));
  g.add(box(0.5, 0.2, 0.35, C.hunterCloth, 1.05, 0.35, 0.2, 0.3));
  return mergeByMat(g);
}
/** A 10-ft pit: `v` 0 (default) the twig-and-needle tarp that hides it, looking like forest floor; 1 the pit open, stakes
 *  showing in the dark. */
export function pitTarp(d: Dims): THREE.Group {
  const v = d.v ?? 0, g = grp();
  if (v === 0) {
    g.add(new THREE.Mesh(blobGeo(11.5, 11, 5, 0.13, 12), mat(C.needles)), box(9.6, 0.3, 9.6, C.needles, 0, 0.2, 0, 0.05));
    for (let i = 0; i < 9; i++) g.add(box(2.5 + hash(i, 1) * 3.5, 0.12, 0.14, C.twig, (hash(i, 2) - 0.5) * 8, 0.4, (hash(i, 3) - 0.5) * 8, hash(i, 4) * 3));
    for (let i = 0; i < 4; i++) g.add(place(lump(0.4 + hash(i, 5) * 0.3, C.moss, i, 1.4, 0.5, 1.1, 0), (hash(i, 6) - 0.5) * 7, 0.42, (hash(i, 7) - 0.5) * 7));
    return mergeByMat(g);
  }
  g.add(box(10, 0.1, 10, C.voidDark, 0, 0.05, 0));
  for (let i = 0; i < 9; i++) g.add(cone(0.22, 1.8, C.twig, -3 + (i % 3) * 3 + (hash(i, 1) - 0.5), 0.6, -3 + Math.floor(i / 3) * 3 + (hash(i, 2) - 0.5), 5));
  for (const s of [-1, 1]) { const t = box(10.5, 0.15, 2.2, C.needles, 0, 0.3, s * 6.2); t.rotation.x = s * 0.4; g.add(t); }
  return mergeByMat(g);
}
/** Dire-wolf prints: a line of big paw marks along local x in the mud. */
export function pawPrints(d: Dims): THREE.Group {
  const L = d.len ?? 20, n = Math.round(L / 2.4), gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n), z = (i % 2 ? 0.7 : -0.7) + (hash(i, 1) - 0.5) * 0.4;
    gs.push(blobGeo(0.95, 1.05, i, 0.16, 7).translate(x, 0, z));
    for (let k = 0; k < 4; k++) gs.push(blobGeo(0.28, 0.36, k, 0.165, 5).translate(x + 0.55, 0, z - 0.45 + k * 0.3));
  }
  return grp(new THREE.Mesh(mergeGeometries(gs)!, mat(C.earthWet)));
}
/** Boot prints: two walkers' tracks `len` ft along local x, one of them dragging a foot. */
export function bootTracks(d: Dims): THREE.Group {
  const L = d.len ?? 30, n = Math.round(L / 1.3), gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n), lane = i % 4 < 2 ? -1.1 : 1.1, z = lane + (i % 2 ? 0.3 : -0.3) + (hash(i, 1) - 0.5) * 0.3;
    gs.push(blobGeo(1.0, 0.45, i, 0.16, 6).translate(x, 0, z));
    if (lane > 0 && i % 2) gs.push(blobGeo(1.6, 0.3, i + 9, 0.158, 5).translate(x - 0.9, 0, z + 0.05));
  }
  return grp(new THREE.Mesh(mergeGeometries(gs)!, mat(C.earthWet)));
}
/** A Vistani vardo (the kit's), merged so a hidden one costs a few draw calls. */
export function vardoMerged(d: Dims): THREE.Group { return mergeByMat(vardo(d)); }

/** A trinket half sunk in the mud at a pool's rim: a small dull thing of metal and a ring, whatever the table says it is. */
export function trinket(): THREE.Group {
  return mergeByMat(grp(blob(1.6, 1.2, 2, 0.15, C.earthWet), box(0.5, 0.18, 0.35, C.rust, 0.1, 0.2, 0, 0.4), place(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 4, 10), mat(C.iron)), -0.35, 0.22, 0.1, 0, Math.PI / 2 - 0.4)));
}

// ---------------------------------------------------------------- figures
/** The skeletal rider: a skeleton in ruined mail on a warhorse skeleton, a rusted lantern raised that gives no light.
 *  Faces local +x. */
export function skeletalRider(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = horse({ scale: s, bone: 1 }), hs = s * 1.75;
  g.add(box(1.6 * hs, 0.35 * hs, 1.3 * hs, C.shroud, -0.2 * hs, 3.95 * hs, 0), box(0.6 * hs, 0.25 * hs, 0.5 * hs, C.rust, 0.5 * hs, 4.15 * hs, 0));   // saddle and its rotted blanket
  const rider = humanoid({ skin: C.bone, cloth: C.mail, trim: C.rust, hair: undefined, cloak: true, weapon: 'none', scale: s * 0.98 });
  rider.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshLambertMaterial).color.getHexString() === '2b2420') m.material = mat(C.bone); });
  place(rider, -0.25 * hs, 3.3 * hs, 0, Math.PI / 2); g.add(rider);
  g.add(box(1.0 * s, 0.8 * s, 0.45 * s, C.rust, -0.25 * hs, 3.3 * hs + 4.6 * s, 0, Math.PI / 2));                 // the rusted breastplate over the mail
  // the lantern arm, raised and forward on the right (plan south, -z... the rider's right is -z when facing +x)
  const arm = grp(cyl(0.17 * s, 0.2 * s, 2.3 * s, C.mail, 0, -1.15 * s, 0, 5), cyl(0.08 * s, 0.14 * s, 0.9 * s, C.bone, 0, -2.6 * s, 0, 4));
  place(arm, 0.3 * hs, 3.3 * hs + 5.0 * s, -0.85 * s, 0, 0, 2.2); g.add(arm);
  const lx = 0.3 * hs + 2.0 * s, ly = 3.3 * hs + 5.0 * s + 1.6 * s;
  g.add(box(0.18 * s, 0.9 * s, 0.18 * s, C.rust, lx, ly - 0.2 * s, -0.85 * s), box(0.75 * s, 0.95 * s, 0.75 * s, C.lantern, lx, ly - 1.1 * s, -0.85 * s), box(0.5 * s, 0.6 * s, 0.5 * s, C.lanternGlass, lx, ly - 1.1 * s, -0.85 * s), cone(0.5 * s, 0.4 * s, C.lantern, lx, ly - 0.45 * s, -0.85 * s, 4));
  return g;
}
/** A single big black raven in flight, wings spread 6 ft, about 9 ft up. */
export function wereraven(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.4, y = 9, g = grp(place(lump(0.5 * s, C.raven, 3, 1.9, 0.8, 0.9, 1), 0, y, 0));
  g.add(cone(0.12 * s, 0.7 * s, C.ravenSheen, 1.2 * s, y + 0.05 * s, 0, 4).rotateZ(-Math.PI / 2), box(1.0 * s, 0.1 * s, 0.6 * s, C.raven, -1.2 * s, y - 0.05 * s, 0));
  for (const z of [-1, 1]) { const w = box(0.9 * s, 0.1 * s, 2.3 * s, C.raven, 0, y + 0.15 * s, z * 1.35 * s); w.rotation.x = -z * 0.35; g.add(w, box(0.6 * s, 0.08 * s, 0.9 * s, C.ravenSheen, 0.1 * s, y + 0.1 * s, z * 2.3 * s).rotateX(-z * 0.6)); }
  g.add(box(0.1 * s, 0.1 * s, 0.1 * s, PALETTE.amber, 0.75 * s, y + 0.2 * s, -0.22 * s), box(0.1 * s, 0.1 * s, 0.1 * s, PALETTE.amber, 0.75 * s, y + 0.2 * s, 0.22 * s));
  return g;
}
/** A swarm of ravens: a dozen black birds, some on the ground, most in the air, within about 5 ft. */
export function ravenFlock(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, r = (0.6 + (i % 5) * 0.5) * s, y = i % 3 === 0 ? 0.3 : (1.2 + hash(i, 1) * 4.5) * s, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const bird = grp(box(0.55 * s, 0.3 * s, 0.9 * s, C.raven), cone(0.07 * s, 0.35 * s, C.ravenSheen, 0, 0.02, 0.6 * s, 4).rotateX(Math.PI / 2));
    if (i % 3 !== 0) for (const w of [-1, 1]) { const wing = box(1.4 * s, 0.06 * s, 0.5 * s, C.raven, w * 0.85 * s, 0.1 * s, 0); wing.rotation.z = w * (0.2 + hash(i, 2) * 0.5); bird.add(wing); }
    place(bird, x, y, z, hash(i, 3) * Math.PI * 2); g.add(bird);
  }
  return g;
}
/** A Barovian hunter (the scout of the tables): drab wool, a hooded cloak, a light crossbow held ready, crouched. */
export function hunter(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: C.hunterSkin, cloth: C.hunterCloth, trim: C.hunterTrim, hair: C.hunterHair, cloak: true, weapon: 'none', hunch: 0.3, scale: s });
  g.add(box(0.9 * s, 0.55 * s, 0.9 * s, C.hunterTrim, 0, 5.75 * s, -0.1 * s));                                            // the hood
  const cb = grp(box(0.22 * s, 0.22 * s, 2.0 * s, C.twig, 0, 0, 0), box(1.9 * s, 0.1 * s, 0.16 * s, C.twig, 0, 0.05 * s, 0.95 * s), box(1.8 * s, 0.03 * s, 0.03 * s, C.boneOld, 0, 0.12 * s, 0.4 * s), box(0.08 * s, 0.08 * s, 1.5 * s, C.iron, 0, 0.16 * s, 0.1 * s));
  place(cb, 0.55 * s, 2.75 * s, 0.75 * s, 0, 0.2); g.add(cb);
  g.add(box(0.5 * s, 1.1 * s, 0.3 * s, C.leather, -0.95 * s, 3.3 * s, -0.3 * s));                                       // the quiver at the hip
  return g;
}
/** A Vistani grave-robber: weathered reds, blues and greens, a headscarf and sash, a spade over the shoulder (or, `v` 2,
 *  a pipe and a pouch). */
export function vistaniDigger(d: Dims): THREE.Group {
  const v = d.v ?? 0, s = d.scale ?? 1, CL = [C.vistRed, C.vistGreen, C.vistBlue][v % 3], SC = [C.vistGold, C.vistRed, C.vistGold][v % 3];
  const g = humanoid({ skin: C.vistSkin, cloth: CL, trim: C.trapperTrim, hair: C.vistHair, weapon: 'none', scale: s, skirt: v === 1 });
  const scarf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46 * s, 1), mat(SC)); scarf.position.set(0, 5.82 * s, -0.05 * s); scarf.scale.set(1, 0.7, 1); g.add(scarf);
  g.add(box(1.5 * s, 0.3 * s, 0.8 * s, SC, 0, 3.6 * s, 0.05 * s, 0).rotateZ(0.35));                                      // the sash
  if (v === 2) { g.add(box(0.5 * s, 0.08 * s, 0.08 * s, C.twig, 0.45 * s, 5.4 * s, 0.55 * s), box(0.16 * s, 0.2 * s, 0.16 * s, C.twig, 0.7 * s, 5.4 * s, 0.6 * s), place(lump(0.35 * s, C.leather, 2, 1, 1.2, 0.8, 0), -0.8 * s, 3.1 * s, 0.5 * s)); return g; }
  const spade = grp(cyl(0.08 * s, 0.08 * s, 4.4 * s, C.twig, 0, 0, 0, 5), box(0.8 * s, 1.0 * s, 0.1 * s, C.rust, 0, 2.5 * s, 0), box(0.45 * s, 0.2 * s, 0.14 * s, C.twig, 0, -2.3 * s, 0));
  place(spade, 1.0 * s, 5.2 * s, -0.3 * s, 0, 0, 0.75); g.add(spade);
  return g;
}
/** A trapper (a werewolf in human form): a big man in a tattered grey cloak with pelts over one shoulder, leaning on
 *  a boar spear. */
export function trapper(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.1, g = humanoid({ skin: C.hunterSkin, cloth: C.cloakGrey, trim: C.trapperTrim, hair: C.peltDeep, cloak: true, weapon: 'spear', scale: s });
  g.add(place(lump(0.5 * s, C.pelt, 3, 1.1, 0.7, 1.6, 1), -0.85 * s, 5.0 * s, 0), place(lump(0.4 * s, C.peltDeep, 4, 1, 0.6, 1.3, 1), -0.95 * s, 4.3 * s, 0.4 * s), box(0.4 * s, 1.4 * s, 0.25 * s, C.pelt, -1.0 * s, 3.6 * s, -0.4 * s));
  for (let i = 0; i < 5; i++) g.add(box(0.25 * s, 0.5 * s, 0.1 * s, C.cloakGrey, (hash(i, 1) - 0.5) * 1.6 * s, 0.3 * s, -0.7 * s - hash(i, 2) * 0.3 * s));
  g.add(box(0.5 * s, 0.1 * s, 0.1 * s, C.iron, 0.9 * s, 4.95 * s, 0.35 * s));                                              // the spear's cross-lugs
  return g;
}

Object.assign(PROPS_V1, {
  'a-giant-pine': giantPine, 'a-raven-snag': ravenSnag, 'a-fallen-giant': fallenGiant, 'a-black-pool': blackPool, 'a-turning-circle': turningCircle,
  'a-wagon-ruts': wagonRuts, 'a-seep-rill': seepRill, 'a-root-bank': rootBank, 'a-ground-fog': groundFog, 'a-pipe-smoke': () => pipeSmoke(),
  'a-skull-blaze': skullBlaze, 'a-wolf-carcass': () => wolfCarcass(), 'a-grave': grave, 'a-wolf-trap': () => wolfTrap(), 'a-leather-bundle': () => leatherBundle(),
  'a-pit-tarp': pitTarp, 'a-paw-prints': pawPrints, 'a-boot-tracks': bootTracks, 'a-trinket': () => trinket(), 'a-mist-wall': kitMistWall, 'a-vardo': vardoMerged,
  'a-tunnel-roof': tunnelRoof, 'a-buttress-root': buttressRoot,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, {
  'a-skeletal-rider': (d) => skeletalRider(d), 'a-wereraven': (d) => wereraven(d), 'a-raven-flock': (d) => ravenFlock(d),
  'a-hunter': (d) => hunter(d), 'a-vistani-digger': (d) => vistaniDigger(d), 'a-trapper': (d) => trapper(d),
} as Record<string, (d: Dims) => THREE.Group>);

// The Old Svalich Road runs straight past this map on the world map, its nearest bend well to the east: the world road
// is split where it passes the pin, so it leaves the map both ways (into the Mists and on toward the gates).
SITE_SHAPERS.push({ pin: [17.86, 7.21], splitAtFoot: true });
