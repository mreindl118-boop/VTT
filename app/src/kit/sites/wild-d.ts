// Props and figures for D, the River Ivlis crossing (chapter 2): the village bridge on the elbow of the river, the
// sills and the mirror pool above it, the shingle bar and its wrecks below. Every kind registered here starts with
// 'd-'. Built from THREE meshes with mat() so the world-space surface grain applies; colours declared with surfaceFor.
// Feet; origin at the floor centre; +z is plan south.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat, matClone, patchFog } from '../../render/materials';
import { FLOOR_COLOR, PALETTE } from '../palette';
import { surfaceFor, type Surface } from '../surfaces';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  bridge: '#6e6a62', bridgeDeep: '#5a5750', deck: '#625e57', voidDark: '#15191d', moss: '#38432f', mold: '#3a4a32', slime: '#5c7a2c',
  wetRock: '#4f545b', wetRockDeep: '#3f444b', wave: '#5b7f96', foam: '#d6dee4', blackWater: '#161a1f',
  shingle: '#b5ae9f', shingleDeep: '#9c958a', spine: '#cbc4b2', erratic: '#7a7d78', erraticDeep: '#62655f', lichen: '#9aa08a', rock: '#5d6168',
  drift: '#a89b84', driftDark: '#6a5a46', rag: '#6b6f77', ragDark: '#4b4a52', boot: '#3b3028', boneOld: '#d8cdb0',
  wainWood: '#5d4a36', wainDark: '#453626', rust: '#4a3329', iron: '#2e2f33', stake: '#5b4a36', wicker: '#8a7a55', post: '#4d3b2b', twine: '#6e5f45',
  slab: '#747770', slabDark: '#5e615b', pelt: '#5c4a3a', peltDark: '#433629', floodStone: '#777a74', score: '#3d3f3c', scoreFaint: '#5a5d58',
  willowBark: '#4a4238', willowDark: '#3a332b', hollowDark: '#1c1f24', rootBrown: '#5a4a3a', turfEdge: '#3d5241', needles: '#4e4030', brush: '#2f4a3a', brushDark: '#1e3128',
  ash: '#2a2a2c', bankEarth: '#4f4538', mapWater: '#3f5467', worldRiver: '#5d7c93', fletch: '#8a8577', fieldStone: '#5f5b55', trapIron: '#2a2a2e', reflection: '#2e3640', bell: '#8a7340', leather: '#5a4330', blueCloth: '#45577f', silver: '#b9bec6',
  scoutCloth: '#4a5248', scoutTrim: '#3b352c', bow: '#4a3224', vistaniCloth: '#7a3a40', vistaniTrim: '#b08a44', raven: '#141218', ravenDark: '#0d0c10', beak: '#2e2c30',
  wispCore: '#dcecf6', wispGlow: '#9fc8e8', bat: '#2a2a30', barding: '#3a3230', bardingDark: '#2b2522', ribDark: '#1d1b1a', lanternIron: '#2a2a2e', lanternGlass: '#1a1d22',
  corpseSkin: '#9a9c94', corpseCloth: '#4e4f52', corpseTrim: '#3a3b3d', corpseHair: '#2a2826',
} as const;
surfaceFor([C.bridge, C.bridgeDeep, C.floodStone], 'ashlar');
surfaceFor([C.deck], 'flag');
surfaceFor([C.wetRock, C.wetRockDeep, C.erratic, C.erraticDeep, C.rock, C.slab, C.slabDark, C.fieldStone], 'rock');
surfaceFor([C.shingle, C.shingleDeep, C.spine], 'stone');
surfaceFor([C.moss, C.mold, C.lichen, C.turfEdge, C.brush, C.brushDark], 'foliage');
surfaceFor([C.bankEarth, '#4b3f32'], 'dirt');
surfaceFor(['#b0a998'], 'shingle');
surfaceFor([C.drift, C.driftDark, C.wainWood, C.wainDark, C.stake, C.post, C.bow, C.rootBrown], 'wood');
surfaceFor([C.willowBark, C.willowDark], 'bark');
surfaceFor([C.wicker, C.needles], 'thatch');
surfaceFor([C.rag, C.ragDark, C.pelt, C.peltDark, C.twine, C.leather, C.blueCloth, C.scoutCloth, C.scoutTrim, C.vistaniCloth, C.vistaniTrim, C.corpseCloth, C.corpseTrim, C.barding, C.bardingDark], 'cloth');
surfaceFor([C.rust, C.iron, C.trapIron, C.bell, C.silver, C.lanternIron], 'metal');
surfaceFor([C.wave], 'water');
surfaceFor([C.mapWater, C.worldRiver, C.foam, C.voidDark, C.blackWater, C.hollowDark, C.reflection, C.wispCore, C.wispGlow, C.lanternGlass, C.ash, C.score, C.scoreFaint, C.slime, C.ribDark], 'none');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, ry = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 8) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z);
const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, seg = 6) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c)), x, y, z);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
/** A faceted lump: an icosahedron with its vertices pushed in and out, then squashed. */
function lump(r: number, color: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1, surface?: Surface): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, surface ? { surface } : {}));
}
/** A spoked wheel standing upright in the xy plane, radius r. */
function wheel(r: number, rim: string, spoke: string): THREE.Group {
  const g = grp(new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 5, 12), mat(rim)));
  for (let i = 0; i < 6; i++) { const s = box(0.16, r * 2 - 0.3, 0.16, spoke); s.rotation.z = (i * Math.PI) / 6; g.add(s); }
  const hub = cyl(0.45, 0.45, 0.7, C.rust, 0, 0, 0, 8); hub.rotation.x = Math.PI / 2; g.add(hub);
  return g;
}
/** A lean, muddy, bone-dry wolf skull with its snout, hung from a cord. */
function wolfSkull(x: number, y: number, z: number, ry: number): THREE.Group {
  const s = grp(lump(0.42, C.boneOld, 3, 1, 0.85, 1.1, 1), box(0.5, 0.3, 0.45, C.boneOld, 0.45, -0.12, 0), box(0.5, 0.08, 0.5, C.boneOld, 0.5, -0.3, 0));
  return place(s, x, y, z, ry);
}
/** Wicker hurdle `len` long: a woven panel with three stake rails. */
function hurdle(len: number, h: number, x: number, y: number, z: number, ry: number): THREE.Mesh {
  const p = box(len, h, 0.16, C.wicker, x, y, z, ry);
  for (let k = 0; k < 3; k++) p.add(box(len, 0.07, 0.22, C.stake, 0, -h * 0.35 + k * h * 0.35, 0));
  return p;
}

// ---------------------------------------------------------------- the bridge
/** The village bridge over a 50-ft channel: one body of grey stone with a segmental arch cut clean through it (seen
 *  through from either bank), the piers' plinths at the waterline, a pointed cutwater on each pier's upstream face
 *  (local -z), the drain spout on the downstream face, and parapets with a coping. Local +x runs along the road; the
 *  origin is the span centre at DECK height (the level's own flagstone slab is the deck over the span). `span` is the
 *  stone body's length, `ramp` the sloping approach at each end, dropping `drop` ft to the bank; the water lies `wy`
 *  ft below the deck. Moss furs every north-facing (local -z) surface. */
export function archBridge(d: Dims): THREE.Group {
  const W = d.w ?? 16, S = d.span ?? 60, R = d.ramp ?? 50, DROP = d.drop ?? 8, WY = d.wy ?? 15, P = d.par ?? 3, g = grp();
  const hs = S / 2, HALF = W / 2, a = hs - 5, rise = WY - 4;
  // the body: one extruded profile, a single contour with the arch as an open notch (up the left pier from under the
  // water, round the soffit, down the right pier, then under the deck), so the river shows through it
  const pts: THREE.Vector2[] = [new THREE.Vector2(-hs, -WY - 2), new THREE.Vector2(-a, -WY - 2), new THREE.Vector2(-a, -WY)];
  for (let i = 1; i < 24; i++) { const t = Math.PI - (i / 24) * Math.PI; pts.push(new THREE.Vector2(Math.cos(t) * a, -WY + Math.sin(t) * rise)); }
  pts.push(new THREE.Vector2(a, -WY), new THREE.Vector2(a, -WY - 2), new THREE.Vector2(hs, -WY - 2), new THREE.Vector2(hs, -0.3), new THREE.Vector2(-hs, -0.3));
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: W - 0.4, bevelEnabled: false }), mat(C.bridge)); body.position.z = -(W - 0.4) / 2; g.add(body);
  // the arch ring on both faces, the string course under the deck, the plinth courses at the waterline
  for (const s of [-1, 1]) for (let k = 0; k < 17; k++) {
    const t = ((k + 0.5) / 17) * Math.PI, v = box(S / 17, 0.65, 0.4, k % 2 ? C.bridge : C.bridgeDeep, Math.cos(t) * (a + 0.3), -WY + Math.sin(t) * (rise + 0.3), s * (HALF + 0.05));
    v.rotation.z = Math.atan2(Math.cos(t) * rise, -Math.sin(t) * a); g.add(v);
  }
  g.add(box(S + 0.3, 0.55, W + 0.5, C.bridgeDeep, 0, -0.85, 0));
  for (const sx of [-1, 1]) {
    g.add(box(6.4, 2.2, W + 0.7, C.bridgeDeep, sx * (hs - 3.1), -WY + 1.6, 0), box(7.2, 1.2, W + 1.1, C.bridgeDeep, sx * (hs - 3.4), -WY + 0.1, 0));
    // the cutwater on the upstream (local -z) face: a pointed prow with a pyramid cap, the northern pier's the bigger
    const k = sx > 0 ? 1.2 : 1;
    const cw = box(3.4 * k, 9, 3.4 * k, C.bridgeDeep, sx * (hs - 3.1), -WY + 3, -(HALF + 1.2 * k), Math.PI / 4); g.add(cw);
    const cap = cone(2.5 * k, 2.4, C.bridgeDeep, sx * (hs - 3.1), -WY + 8.7, -(HALF + 1.2 * k), 4); cap.rotation.y = Math.PI / 4; g.add(cap);
  }
  // parapets over the span, their coping, the newel posts at the span ends
  for (const s of [-1, 1]) {
    g.add(box(S, P, 0.9, C.bridge, 0, P / 2, s * (HALF - 0.45)), box(S + 0.1, 0.35, 1.2, C.bridgeDeep, 0, P + 0.17, s * (HALF - 0.45)));
    for (const sx of [-1, 1]) g.add(box(1.7, P + 1.1, 1.7, C.bridgeDeep, sx * (hs - 0.85), (P + 1.1) / 2 - 0.1, s * (HALF - 0.45)), box(2.1, 0.4, 2.1, C.bridgeDeep, sx * (hs - 0.85), P + 1.2, s * (HALF - 0.45)));
  }
  // the drain spout on the downstream face at mid-span, dribbling green down the spandrel
  g.add(box(0.7, 0.55, 1.4, C.bridgeDeep, 2, -1.5, HALF + 0.5), box(0.45, 1.9, 0.08, C.slime, 2, -2.75, HALF + 0.06), box(0.3, 1.3, 0.08, C.mold, 2.6, -3.0, HALF + 0.06));
  // the ramps: a sloping paved deck on a stone-faced embankment, parapets sinking toward the feet, wing walls at the ends
  const n = 10;
  for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
    const x0 = hs + (i * R) / n, x1 = x0 + R / n, y0 = -DROP * (i / n), y1 = -DROP * ((i + 1) / n), xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const sl = Math.atan2(y1 - y0, R / n), len = R / n / Math.cos(sl) + 0.08;
    const deck = box(len, 0.6, W - 1.7, i % 2 ? C.deck : C.bridgeDeep, sx * xm, ym - 0.3, 0); deck.rotation.z = sx * sl; g.add(deck);
    const fill = ym - 0.6 + DROP;
    if (fill > 0.3) g.add(box(R / n + 0.1, fill, W - 0.4, C.bridgeDeep, sx * xm, -DROP + fill / 2, 0));
    const ph = Math.max(1.1, P * (1 - (i + 0.5) / n) + 0.6);
    for (const s of [-1, 1]) {
      const par = box(len, ph, 0.85, C.bridge, sx * xm, ym + ph / 2 - 0.25, s * (HALF - 0.45)); par.rotation.z = sx * sl; g.add(par);
      if (hash(i, s + sx) > 0.55) g.add(box(R / n * 0.7, 0.6 + hash(i, s) * 1.2, 0.12, C.mold, sx * xm, ym + 0.5 + hash(i, s + 2), s * (HALF + 0.03)));
    }
  }
  for (const sx of [-1, 1]) for (const s of [-1, 1]) {
    g.add(box(1.5, 2.4, 1.5, C.bridgeDeep, sx * (hs + R - 0.6), -DROP + 1.1, s * (HALF - 0.45)));
    const wing = box(7, 1.8, 0.8, C.bridge, sx * (hs + R + 2.8), -DROP + 0.8, s * (HALF + 1.4)); wing.rotation.y = sx * s * -0.42; g.add(wing);
  }
  // moss furs the north faces (local -z): the spandrel, the pier and the parapet's outer face
  // (on the stone only: over the arch the patch sits between the soffit and the string course, on the piers anywhere)
  for (let k = 0; k < 7; k++) {
    const mw = 2 + hash(k, 1) * 3, mx = (hash(k, 3) - 0.5) * S * 0.9, ex = Math.max(0, Math.abs(mx) - mw / 2);
    const floor = ex < a ? -WY + rise * Math.sqrt(1 - (ex / a) ** 2) + 0.4 : -WY + 1, mh = Math.min(1.5 + hash(k, 2) * 3.5, -1.3 - floor);
    if (mh > 0.5) g.add(box(mw, mh, 0.14, C.moss, mx, floor + mh / 2 + hash(k, 4) * Math.max(0, -1.3 - floor - mh), -(HALF + 0.03)));
  }
  for (let k = 0; k < 4; k++) g.add(box(2 + hash(k, 5) * 4, 0.6 + hash(k, 6) * 1.2, 0.1, C.moss, (hash(k, 7) - 0.5) * S * 0.8, 0.6 + hash(k, 8) * 1.4, -(HALF - 0.45 + 0.5)));
  return g;
}

// ---------------------------------------------------------------- the water
/** A rib of bedrock across the channel (local x), awash, with a standing wave and a strip of foam on its downstream
 *  (+z) side. */
export function riverSill(d: Dims): THREE.Group {
  const L = d.len ?? 55, g = grp(), n = Math.round(L / 4);
  for (let i = 0; i < n; i++) g.add(place(lump(1.7 + hash(i, 1) * 0.9, i % 2 ? C.wetRock : C.wetRockDeep, i, 1.3, 0.4, 0.8, 0, 'rock'), -L / 2 + (i + 0.5) * (L / n), -0.25 + hash(i, 2) * 0.5, (hash(i, 3) - 0.5) * 1.2, hash(i, 6) * 3));
  g.add(box(L * 0.92, 0.8, 1.7, C.wave, 0, 0.3, 2.0));
  for (let i = 0; i < n * 2; i++) g.add(place(lump(0.9 + hash(i, 4) * 0.8, C.foam, i + 20, 1.7, 0.3, 1, 0), -L / 2 + (i + 0.5) * (L / (n * 2)), 0.5, 2.6 + hash(i, 5) * 2.8));
  return g;
}
/** A lens of pale shingle `len` × `w` lying at water level, bulging toward -z (the deep channel), with a raised spine of
 *  bleached stones, three rounded boulders and loose pebbles. */
export function gravelBar(d: Dims): THREE.Group {
  const L = d.len ?? 140, Wd = d.w ?? 50, sd = d.seed ?? 0, g = grp();
  const lens = (l: number, w: number, k: number) => {
    const pts: THREE.Vector2[] = [], n = 16;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(-l / 2 + t * l, -(w * 0.62) * Math.sin(t * Math.PI) * (0.9 + 0.2 * hash(i, sd + k)))); }
    for (let i = n - 1; i >= 1; i--) { const t = i / n; pts.push(new THREE.Vector2(-l / 2 + t * l, (w * 0.38) * Math.sin(t * Math.PI) * (0.85 + 0.3 * hash(i, sd + k + 7)))); }
    return new THREE.Shape(pts);
  };
  const slab = (l: number, w: number, h: number, y: number, color: string, k: number) => {
    const geo = new THREE.ExtrudeGeometry(lens(l, w, k), { depth: h, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, y + h, 0);
    return new THREE.Mesh(geo, mat(color));
  };
  g.add(slab(L, Wd, 0.9, -0.2, C.shingle, 1), slab(L * 0.62, Wd * 0.4, 0.8, 0.7, C.spine, 2));
  for (let i = 0; i < 3; i++) g.add(place(lump(2.0 + hash(i, sd + 3) * 1.1, i % 2 ? C.erratic : C.erraticDeep, sd + i * 5, 1.2, 0.85, 1, 1, 'rock'), -L * 0.25 + i * L * 0.25 + (hash(i, sd) - 0.5) * 12, 1.6, (hash(i, sd + 4) - 0.5) * Wd * 0.3 - 2));
  for (let i = 0; i < 16; i++) g.add(box(0.7 + hash(i, sd + 5), 0.35, 0.6 + hash(i, sd + 6) * 0.6, i % 3 ? C.shingleDeep : C.spine, (hash(i, sd + 7) - 0.5) * L * 0.85, 0.85, (hash(i, sd + 8) - 0.5) * Wd * 0.6, hash(i, sd + 9) * 3));
  return g;
}
/** The strand line: a combed heap of bleached driftwood, splintered planks, a wagon wheel, long bones, rags and a boot,
 *  `r` ft across, lodged on the head of the bar. */
export function strandLine(d: Dims): THREE.Group {
  const R = d.r ?? 15, g = grp();
  for (let i = 0; i < 10; i++) {
    const L = 4 + hash(i, 1) * 11, r = 0.22 + hash(i, 2) * 0.35, c = cyl(r * 0.75, r, L, i % 3 ? C.drift : C.driftDark, 0, 0, 0, 6);
    g.add(place(c, (hash(i, 3) - 0.5) * R * 1.7, r + 0.15 + hash(i, 9) * 0.7, (hash(i, 4) - 0.5) * R * 1.1, hash(i, 5) * 0.6, 0, Math.PI / 2 + (hash(i, 6) - 0.5) * 0.9));
  }
  for (let i = 0; i < 6; i++) g.add(place(box(3 + hash(i, 7) * 4, 0.25, 0.8, C.driftDark), (hash(i, 8) - 0.5) * R * 1.5, 0.35 + hash(i, 10) * 0.9, (hash(i, 11) - 0.5) * R, hash(i, 12) * 3, 0, (hash(i, 13) - 0.5) * 0.6));
  g.add(place(wheel(2.2, C.driftDark, C.drift), R * 0.3, 2.3, -R * 0.2, 0.3, 0.35, 0));
  for (let i = 0; i < 7; i++) g.add(place(box(0.2, 0.2, 1.6 + hash(i, 14) * 1.3, PALETTE.bone), (hash(i, 15) - 0.5) * R * 1.4, 0.4, (hash(i, 16) - 0.5) * R, hash(i, 17) * 3));
  g.add(place(lump(0.5, PALETTE.bone, 7, 1, 0.85, 1.1, 1), -R * 0.35, 0.65, R * 0.25));
  for (let i = 0; i < 4; i++) g.add(place(box(1.6 + hash(i, 18), 0.12, 1.1, i % 2 ? C.rag : C.ragDark), (hash(i, 19) - 0.5) * R * 1.5, 0.55 + hash(i, 20) * 0.7, (hash(i, 21) - 0.5) * R, hash(i, 22) * 3, 0, (hash(i, 23) - 0.5) * 0.4));
  g.add(place(box(0.9, 1.1, 0.5, C.boot), R * 0.45, 0.65, R * 0.3, 0.8, 0.3, 1.2));
  return g;
}
/** A farm wain wrecked in the ford: the bed tilted nose-up and half buried in gravel, one shaft pointing at the sky,
 *  one wheel upright in the current, one lying flat. */
export function drownedWain(): THREE.Group {
  const g = grp(), Wo = C.wainWood, WD = C.wainDark;
  const bed = grp(box(9, 0.4, 5, Wo, 0, 0, 0), box(9, 1.6, 0.3, WD, 0, 0.9, -2.4), box(9, 1.6, 0.3, WD, 0, 0.9, 2.4), box(0.3, 1.6, 5, WD, -4.4, 0.9, 0));
  for (let i = 0; i < 4; i++) bed.add(box(0.22, 0.3, 5.2, WD, -3.4 + i * 2.2, 0.3, 0));
  g.add(place(bed, 0, 1.6, 0, 0, 0.12, 0.3));
  g.add(place(box(8.5, 0.35, 0.35, WD), 6.5, 4.2, 0.9, 0, 0, 0.95), place(box(1.2, 0.3, 2.2, WD), 4.0, 1.9, 0.9, 0, 0, 0.3));
  g.add(place(wheel(2.3, WD, Wo), 2.2, 1.0, 3.4, 0.15, 0, 0.2), place(wheel(2.3, WD, Wo), -2.8, 0.3, -3.2, 0, Math.PI / 2 - 0.2, 0));
  for (let i = 0; i < 6; i++) g.add(place(lump(1.4 + hash(i, 1) * 1.3, i % 2 ? C.shingle : C.shingleDeep, i + 30, 1.5, 0.45, 1.2, 1, 'stone'), -3.5 + (hash(i, 2) - 0.5) * 5, 0.3, (hash(i, 3) - 0.5) * 5));
  return g;
}
/** A fish weir: two arms of driven stakes and wicker panels angled downstream (+z) across a shallow channel `len`
 *  wide, meeting `depth`·len downstream at a wicker basket trap. */
export function fishWeir(d: Dims): THREE.Group {
  const L = d.len ?? 20, K = d.depth ?? 0.45, g = grp(), n = Math.max(3, Math.round(L / 2.4));
  for (const sx of [-1, 1]) for (let i = 0; i <= n; i++) {
    const t = i / n, x = sx * (L / 2) * (1 - t), z = t * L * K;
    g.add(cyl(0.17, 0.24, 4.6 + hash(i, sx) * 0.8, C.stake, x, 1.6, z, 5));
    if (i < n) { const x2 = sx * (L / 2) * (1 - (i + 1) / n), z2 = ((i + 1) / n) * L * K; g.add(hurdle(Math.hypot(x2 - x, z2 - z), 2.4, (x + x2) / 2, 1.1, (z + z2) / 2, Math.atan2(-(z2 - z), x2 - x))); }
  }
  const trap = cyl(0.95, 0.55, 4.2, C.wicker, 0, 0.8, L * K + 2.6, 7); trap.rotation.x = Math.PI / 2 - 0.25; g.add(trap);
  g.add(cyl(0.2, 0.26, 5, C.stake, 0.6, 1.9, L * K + 0.8, 5), box(0.06, 0.06, 3, C.twine, 0.4, 3.4, L * K - 0.8));
  return g;
}
/** A shelf of flat slabs at the waterline (`len` along local x, the river toward +z): worn hollows on their tops, a
 *  drying pole on forked sticks with a rag left on it, a basket. */
export function washingSlabs(d: Dims): THREE.Group {
  const L = d.len ?? 60, g = grp(), n = 7;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n) + (hash(i, 1) - 0.5) * 2, z = (hash(i, 2) - 0.5) * 4 + (i % 2 ? 1.6 : -1), top = 0.3 + hash(i, 3) * 0.9;
    g.add(box(6 + hash(i, 4) * 2.5, top + 0.8, 4.5 + hash(i, 5) * 2, i % 3 ? C.slab : C.slabDark, x, top / 2 - 0.4, z, (hash(i, 6) - 0.5) * 0.5));
    for (let k = 0; k < 2; k++) g.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.5 + hash(k, i) * 0.4, 8).rotateX(-Math.PI / 2), mat(C.slabDark)), x + (hash(k, i + 3) - 0.5) * 3, top + 0.03, z + (hash(k, i + 5) - 0.5) * 2));
  }
  for (const x of [-9, 1]) g.add(cyl(0.14, 0.18, 5.2, C.stake, x, 2.6, -5.5, 5), box(0.9, 0.5, 0.14, C.stake, x, 5.1, -5.5));
  g.add(box(11.5, 0.16, 0.16, C.stake, -4, 5.2, -5.5), box(1.6, 2.2, 0.1, C.ragDark, -6, 4.1, -5.5), box(0.3, 2.6, 0.1, C.rag, -2.8, 3.9, -5.5));
  g.add(cyl(1.0, 0.8, 1.3, C.wicker, 6, 0.95, -4.5, 8), cyl(0.9, 0.9, 0.12, C.stake, 6, 1.6, -4.5, 8));
  return g;
}
/** A bluff foot hollowed by the current: a black recess `len` long under an overhanging lip of rock and turf, roots
 *  hanging into dark water. Stands at the water's edge with the hollow's mouth toward +z (the river); `h` is the bank
 *  height above the water. */
export function undercutBank(d: Dims): THREE.Group {
  const L = d.len ?? 30, Hb = d.h ?? 7, g = grp();
  // rock jambs either side of the hollow, the hollow set back between them, the lip of rock and turf over all
  for (const sx of [-1, 1]) g.add(box(4.5, Hb - 1.0, 3.6, sx > 0 ? C.rock : C.wetRock, sx * (L / 2 - 2.2), (Hb - 1.0) / 2, 1.6), place(lump(1.3, C.wetRockDeep, 3 + sx, 1.4, 0.5, 1, 0, 'rock'), sx * (L / 2 - 1), 0.3, 3.6));
  g.add(box(L - 8.5, Hb - 2.8, 2.4, C.hollowDark, 0, (Hb - 2.8) / 2 + 0.25, 0.9), box(L - 8.5, 0.9, 2.6, C.wetRockDeep, 0, Hb - 1.9, 1.1));
  g.add(box(L + 2, 1.5, 4.6, C.rock, 0, Hb - 0.85, 1.7), box(L + 2.4, 0.5, 4.8, C.turfEdge, 0, Hb - 0.05, 1.6));
  for (let i = 0; i < 11; i++) { const h = 1.5 + hash(i, 1) * 3, r = box(0.16, h, 0.16, C.rootBrown, -L / 2 + 4 + (i + 0.5) * ((L - 8) / 11) + (hash(i, 2) - 0.5) * 1.2, Hb - 1.6 - h / 2, 2.4 + hash(i, 3) * 1.2); r.rotation.z = (hash(i, 4) - 0.5) * 0.4; g.add(r); }
  for (let i = 0; i < 5; i++) g.add(place(lump(0.6 + hash(i, 5) * 0.5, C.moss, i, 1.4, 0.45, 1.2, 0), (hash(i, 6) - 0.5) * L, Hb + 0.15, 2.4 + (hash(i, 7) - 0.5) * 1.5));
  g.add(box(L - 9, 0.2, 2.6, C.blackWater, 0, 0.14, 1.4));
  return g;
}
/** The castle's reflection: a flat silhouette of a keep and three towers lying on the still water, its towers pointing
 *  +x (away from the castle, toward whoever stands on the bridge), broken by a few ripples. */
export function castleReflection(d: Dims): THREE.Group {
  const L = d.len ?? 56, Wd = d.w ?? 36;
  const o = [[0, -0.5], [0.35, -0.5], [0.35, -0.4], [0.78, -0.4], [0.84, -0.33], [0.78, -0.26], [0.35, -0.26], [0.35, -0.07], [0.94, -0.07], [1.0, 0], [0.94, 0.07], [0.35, 0.07], [0.35, 0.26], [0.68, 0.26], [0.74, 0.33], [0.68, 0.4], [0.35, 0.4], [0.35, 0.5], [0, 0.5]];
  const geo = new THREE.ShapeGeometry(new THREE.Shape(o.map(([x, y]) => new THREE.Vector2(x * L - L / 2, y * Wd)))); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.06, 0);
  const g = grp(new THREE.Mesh(geo, mat(C.reflection)));
  for (let i = 0; i < 5; i++) g.add(box(L * (0.4 + hash(i, 1) * 0.5), 0.03, 0.7 + hash(i, 2), FLOOR_COLOR['shallow-water'], (hash(i, 3) - 0.5) * L * 0.3, 0.085, -Wd / 2 + (i + 0.5) * (Wd / 5)));
  return g;
}

/** A sloping wedge of bank (mud, shingle) from the bank top down into the water: `len` along local x, the slope falling
 *  toward +z from height `h` at z 0 to just under the water `run` ft out; `back` ft of it hide under the turf behind.
 *  `color` is a packed RGB number. The drinking slope, the beach under the arch, the wolves' ford exit. */
export function bankRamp(d: Dims): THREE.Group {
  const L = d.len ?? 30, run = d.run ?? 15, h = d.h ?? 7, back = d.back ?? 5, hex = '#' + (d.color ?? 0x4b3f32).toString(16).padStart(6, '0');
  const sh = new THREE.Shape([new THREE.Vector2(-back, -1.2), new THREE.Vector2(run, -1.2), new THREE.Vector2(run, -0.35), new THREE.Vector2(run * 0.55, h * 0.3), new THREE.Vector2(0, h), new THREE.Vector2(-back, h)]);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(L / 2, 0, 0);
  const g = grp(new THREE.Mesh(geo, mat(hex)));
  // a few stones bedded in the slope, darker at the waterline
  for (let i = 0; i < 9; i++) {
    const u = 0.15 + hash(i, 1) * 0.8, z = u * run, y = u < 0.55 ? h - (h - h * 0.3) * (u / 0.55) : h * 0.3 - (h * 0.3 + 0.35) * ((u - 0.55) / 0.45);
    g.add(place(lump(0.5 + hash(i, 2) * 0.6, i % 3 ? C.wetRockDeep : C.shingleDeep, i + 60, 1.4, 0.45, 1.1, 0, 'stone'), (hash(i, 3) - 0.5) * L * 0.85, y, z));
  }
  return g;
}

let reachMats: { water: THREE.Material; earth: THREE.Material; turf: THREE.Material } | undefined;
/** The river running on past the map's edge into the land beyond: a water ribbon `w` wide and `len` long from the
 *  origin along local +x, turning `bend` degrees (toward +z) as it goes (`s` 1: an S that swings `bend` and comes back
 *  to its first heading), between banks that stand `hb` ft at the map's edge and sink into the land by its far end.
 *  `blend` 1 shades the water from the map's river to the world map's river ribbon it runs into. Scenery, outside the
 *  fog of the map like the land it lies on; unlit, as that ribbon is. */
export function riverReach(d: Dims): THREE.Group {
  const L = d.len ?? 90, Wd = d.w ?? 50, hb = d.hb ?? 7, bend = ((d.bend ?? 0) * Math.PI) / 180, S = d.s ?? 0, n = 24, slope = 9, top = d.top ?? 26, fall = 40;
  if (!reachMats) {
    const water = patchFog(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), true);
    reachMats = { water, earth: matClone(C.bankEarth, true), turf: matClone(C.turfEdge, true) };
  }
  // stations along the centreline, each with its unit normal (toward +z on the right bank)
  const head = (t: number) => bend * (S ? Math.sin(Math.PI * t) : t);
  const st: { x: number; z: number; nx: number; nz: number; h: number; t: number; wy: number }[] = [];
  let x = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = head(t), nx = -Math.sin(a), nz = Math.cos(a);
    // the water climbs a few inches clear of the map's own (and over the world ribbon, which rides 0.6 ft up) once off the map
    st.push({ x, z, nx, nz, h: Math.max(0.9, hb * (1 - t) ** 1.4), t, wy: 0.12 + 0.66 * Math.min(1, t / 0.2) });
    const am = head((i + 0.5) / n); x += Math.cos(am) * (L / n); z += Math.sin(am) * (L / n);
  }
  // a cross-section: offsets (ft from the centreline) and heights; [water | earth slope | turf top and fall]
  const c0 = new THREE.Color(C.mapWater), c1 = new THREE.Color(d.blend ? C.worldRiver : C.mapWater);
  const strip = (prof: (s: (typeof st)[0]) => [number, number][], m: THREE.Material, tint = false) => {
    const pos: number[] = [], col: number[] = [];
    for (let i = 0; i < n; i++) {
      const A = prof(st[i]), B = prof(st[i + 1]);
      for (let k = 0; k + 1 < A.length; k++) {
        const p = (s: (typeof st)[0], q: [number, number]) => [s.x + s.nx * q[0], q[1], s.z + s.nz * q[0]];
        const a0 = p(st[i], A[k]), a1 = p(st[i], A[k + 1]), b0 = p(st[i + 1], B[k]), b1 = p(st[i + 1], B[k + 1]);
        pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
        if (tint) for (const s of [st[i], st[i + 1], st[i], st[i], st[i + 1], st[i + 1]]) { const c = c0.clone().lerp(c1, Math.min(1, Math.max(0, (s.t - 0.35) / 0.6))); col.push(c.r, c.g, c.b); }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    if (tint) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, m); (mesh.material as THREE.Material).side = THREE.DoubleSide; return mesh;
  };
  const hw = Wd / 2, g = grp();
  g.add(strip((s) => [[-hw - 1, s.wy], [hw + 1, s.wy]], reachMats.water, true));
  for (const sg of [-1, 1]) {
    g.add(strip((s) => [[sg * (hw - 0.5), s.wy - 0.2], [sg * (hw + slope), s.h]], reachMats.earth));
    g.add(strip((s) => [[sg * (hw + slope), s.h], [sg * (hw + slope + top), s.h], [sg * (hw + slope + top + fall), 0.05]], reachMats.turf));
  }
  return g;
}

// ---------------------------------------------------------------- the banks
/** A 14-ft pole with a crossbar at the bridgehead: the trappers' tally of wolf skulls on cords, dried pelts and rusted
 *  trap chains, stones heaped at its foot. */
export function wolfGibbet(d: Dims): THREE.Group {
  const H = d.h ?? 14, g = grp(cyl(0.32, 0.42, H, C.post, 0, H / 2, 0, 6), box(9.5, 0.5, 0.5, C.post, 0, H - 1.6, 0), box(0.45, 1.7, 0.45, C.post, 0, H - 0.8, 0));
  for (const x of [-1.3, 1.3]) { const br = box(0.3, 2.6, 0.3, C.post, x, H - 2.7, 0); br.rotation.z = -x * 0.55; g.add(br); }
  for (let i = 0; i < 6; i++) { const an = hash(i, 1) * Math.PI * 2; g.add(place(lump(0.45 + hash(i, 2) * 0.4, C.fieldStone, i, 1.2, 0.6, 1, 0, 'stone'), Math.cos(an) * 1.1, 0.25, Math.sin(an) * 1.1)); }
  for (let i = 0; i < 9; i++) { const x = -4.3 + i * 1.08, drop = 0.8 + hash(i, 3) * 2.2; g.add(box(0.06, drop, 0.06, C.twine, x, H - 1.85 - drop / 2, 0), wolfSkull(x, H - 1.85 - drop, 0, hash(i, 4) * 6)); }
  for (let i = 0; i < 3; i++) g.add(wolfSkull(0.5 * (i % 2 ? 1 : -1), H - 3.8 - i * 2.4, 0.5 * (i % 2 ? -1 : 1), hash(i, 9) * 6));
  for (let i = 0; i < 3; i++) g.add(box(1.3, 2.6 + hash(i, 5) * 1.2, 0.18, i % 2 ? C.pelt : C.peltDark, -3.2 + i * 3.2, H - 3.5 - hash(i, 6), 0.6, (hash(i, 7) - 0.5) * 0.5));
  for (let i = 0; i < 2; i++) { const x = 2.4 + i * 1.6; for (let k = 0; k < 6; k++) g.add(box(0.14, 0.42, 0.08, C.rust, x, H - 2.0 - k * 0.42, -0.4, k * 0.9)); g.add(box(0.55, 0.75, 0.22, C.rust, x, H - 4.9, -0.4)); }
  return g;
}
/** A man-high squared standing stone, its river face (+z) scored with eight flood lines and their numerals (the top
 *  line above head height), an old name in worn capitals and a half-effaced device above; moss on its north face. */
export function floodStone(): THREE.Group {
  const S = C.floodStone, g = grp(box(2.6, 7.2, 1.3, S, 0, 3.6, 0), box(3.3, 0.5, 1.9, C.bridgeDeep, 0, 0.25, 0));
  const lines = [1.3, 1.9, 2.35, 2.9, 3.35, 3.95, 4.55, 6.0];
  lines.forEach((y, i) => { g.add(box(1.9 - (i % 3) * 0.3, 0.07, 0.08, C.score, -0.2 + (i % 2) * 0.3, y, 0.68)); for (let k = 0; k < 2 + (i % 2); k++) g.add(box(0.07, 0.22, 0.06, C.score, 0.75 + k * 0.14, y + 0.18, 0.68)); });
  for (let k = 0; k < 5; k++) g.add(box(0.14, 0.42, 0.06, C.score, -0.8 + k * 0.4, 5.25, 0.68), box(0.3, 0.07, 0.06, C.score, -0.8 + k * 0.4, 5.05, 0.68));
  g.add(box(0.95, 0.95, 0.07, C.scoreFaint, 0, 6.6, 0.68), box(0.12, 1.1, 0.08, C.score, 0, 6.6, 0.7, 0));
  for (let k = 0; k < 3; k++) g.add(box(0.8 + hash(k, 1), 1.0 + hash(k, 2) * 1.6, 0.12, C.moss, (hash(k, 3) - 0.5) * 1.6, 1.2 + hash(k, 4) * 4, -0.68));
  g.rotation.z = 0.035;
  return g;
}
/** An ancient pollarded crack-willow, `h` ft tall: roots fanning into the water, a split trunk with a dark hollow
 *  between the halves, and a knuckled crown bristling with thick stubs and bare twigs (winter). */
export function hollowWillow(d: Dims): THREE.Group {
  const H = d.h ?? 35, s = H / 35, B = C.willowBark, BD = C.willowDark, T = 15 * s, g = grp();
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * Math.PI * 2 + 0.3, r = cyl(0.3 * s, 0.75 * s, 4.6 * s, BD, 0, 0, 0, 5);
    place(r, Math.cos(an) * 2.4 * s, 0.4, Math.sin(an) * 2.4 * s, 0, Math.sin(an) * 0.85, -Math.cos(an) * 0.85); g.add(r);
  }
  for (const sg of [-1, 1]) { const half = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * s, 2.3 * s, T, 8, 1, false, sg > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), mat(B)); half.position.set(sg * 0.5 * s, T / 2, 0); half.rotation.z = -sg * 0.05; g.add(half); }
  g.add(cyl(1.0 * s, 1.5 * s, T - 1, C.hollowDark, 0, T / 2 - 0.3, 0, 6));
  g.add(place(lump(2.7 * s, B, 5, 1.25, 0.8, 1.1, 1, 'bark'), 0, T + 0.5 * s, 0));
  const stubs = 9;
  for (let i = 0; i < stubs; i++) {
    const an = (i / stubs) * Math.PI * 2 + 0.4, tilt = 0.3 + hash(i, 1) * 0.35, L = (7 + hash(i, 2) * 4) * s;
    const st = cyl(0.45 * s, 0.75 * s, L, i % 2 ? B : BD, 0, 0, 0, 6);
    place(st, Math.cos(an) * 2.0 * s, T + 0.5 * s + L * 0.42, Math.sin(an) * 2.0 * s, 0, Math.sin(an) * tilt, -Math.cos(an) * tilt); g.add(st);
    const tx = Math.cos(an) * (2.0 * s + Math.sin(tilt) * L * 0.9), tz = Math.sin(an) * (2.0 * s + Math.sin(tilt) * L * 0.9), ty = T + 0.5 * s + L * 0.9;
    for (let k = 0; k < 3; k++) { const tw = box(0.14 * s, (2.5 + hash(k, i) * 2.5) * s, 0.14 * s, BD, tx + (hash(k, i + 1) - 0.5) * 1.2, ty + 1.2 * s, tz + (hash(k, i + 2) - 0.5) * 1.2); tw.rotation.set((hash(k, i + 3) - 0.5) * 0.8, 0, (hash(k, i + 4) - 0.5) * 0.8); g.add(tw); }
  }
  for (let k = 0; k < 4; k++) g.add(box(1.0 + hash(k, 7), 1.5 + hash(k, 8) * 2.5, 0.14, C.moss, (hash(k, 9) - 0.5) * 2.5, 3 + hash(k, 10) * (T - 5), -2.1 * s));
  return g;
}
/** A low brush-and-hurdle blind, 10 × 6 ft, open toward +z: a floor of trodden pine needles, a cold fire ring, two
 *  crossbow bolts stuck in the sod. */
export function trappersHide(): THREE.Group {
  const Wd = 10, D = 6, g = grp(box(Wd + 1.2, 0.12, D + 1.2, C.needles, 0, 0.06, 0));
  for (const [x, z] of [[-Wd / 2, -D / 2], [Wd / 2, -D / 2], [-Wd / 2, D / 2], [Wd / 2, D / 2 * 0.3], [0, -D / 2]]) g.add(cyl(0.18, 0.22, 3.4, C.stake, x, 1.7, z, 5));
  g.add(hurdle(Wd, 2.6, 0, 1.4, -D / 2, 0), hurdle(D, 2.6, -Wd / 2, 1.4, 0, Math.PI / 2), hurdle(D * 0.65, 2.4, Wd / 2, 1.3, -D * 0.17, Math.PI / 2));
  for (let i = 0; i < 7; i++) g.add(place(lump(1.1 + hash(i, 1) * 0.9, i % 2 ? C.brush : C.brushDark, i + 40, 1.6, 0.55, 1.1, 0), -Wd / 2 + (i + 0.5) * (Wd / 7), 3.1 + hash(i, 2) * 0.4, -D / 2 + (hash(i, 3) - 0.3) * 2.4));
  for (let i = 0; i < 7; i++) { const an = (i / 7) * Math.PI * 2; g.add(place(lump(0.35, C.fieldStone, i, 1.1, 0.7, 1, 0, 'stone'), 1.4 + Math.cos(an) * 1.1, 0.25, 0.6 + Math.sin(an) * 1.1)); }
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.9, 9).rotateX(-Math.PI / 2), mat(C.ash)), 1.4, 0.17, 0.6));
  for (const [x, z] of [[-3, 1.2], [-2.2, 1.9]]) { const b = box(0.08, 1.5, 0.08, C.stake, x, 0.7, z); b.rotation.set(0.35, 0, 0.25); g.add(b, box(0.28, 0.25, 0.05, C.fletch, x + 0.18, 1.35, z - 0.2)); }
  return g;
}
/** The Sheep Rocks: five rounded lichen-grey erratics, 3 to 8 ft high, scattered over about 50 ft. */
export function sheepRocks(d: Dims): THREE.Group {
  const k = d.scale ?? 1, g = grp(), R = [[-16, -4, 3.9], [-4, 5, 3.0], [5, -7, 2.4], [14, 3, 3.4], [1, 13, 1.9]];
  R.forEach(([x, z, r], i) => {
    g.add(place(lump(r * k, i % 2 ? C.erratic : C.erraticDeep, i * 3 + 1, 1.15, 1.0, 0.95, 1, 'rock'), x * k, r * k * 0.72, z * k, hash(i, 1) * 6));
    for (let j = 0; j < 3; j++) g.add(place(lump(r * k * 0.3, C.lichen, i + j * 5, 1.5, 0.3, 1.2, 0), x * k + (hash(j, i) - 0.5) * r * k, r * k * 1.3 + (hash(j, i + 1) - 0.5) * r * k * 0.5, z * k + (hash(j, i + 2) - 0.5) * r * k));
  });
  return g;
}
/** A rusted steel-jaw hunting trap on its chain and stake, half under a skin of pine needles; `sprung` 1 shows the jaws
 *  snapped shut. */
export function wolfTrap(d: Dims): THREE.Group {
  const sprung = d.sprung ?? 0, g = grp(box(1.4, 0.1, 0.8, C.trapIron, 0, 0.06, 0), cyl(0.3, 0.3, 0.08, C.trapIron, 0, 0.15, 0, 8));
  for (const sz of [-1, 1]) {
    const jaw = grp();
    for (let k = 0; k < 7; k++) { const an = (k / 6) * Math.PI; jaw.add(box(0.36, 0.12, 0.09, C.rust, Math.cos(an) * 0.95, 0, Math.sin(an) * 0.42, -an)); }
    for (let k = 0; k < 6; k++) jaw.add(place(cone(0.05, 0.24, C.rust, 0, 0, 0, 4), Math.cos(((k + 0.5) / 6) * Math.PI) * 0.95, 0.14, Math.sin(((k + 0.5) / 6) * Math.PI) * 0.42));
    place(jaw, 0, 0.16, 0, sz > 0 ? 0 : Math.PI, sprung ? -sz * 1.45 : 0, 0); g.add(jaw);
  }
  for (let k = 0; k < 5; k++) g.add(box(0.32, 0.08, 0.14, C.rust, -1.1 - k * 0.3, 0.06, 0.1 * (k % 2), k * 0.6));
  g.add(cyl(0.1, 0.14, 1.2, C.trapIron, -2.7, 0.3, 0, 5));
  if (!sprung) g.add(place(lump(0.9, C.needles, 4, 1.4, 0.08, 1, 1), 0.45, 0.14, 0.15));
  return g;
}
/** A stake on the terrace with a small bronze bell under its cross piece, its cord running `cord` ft toward +x and
 *  dropping `drop` ft to the weir below. */
export function bellStake(d: Dims): THREE.Group {
  const L = d.cord ?? 26, drop = d.drop ?? 10, g = grp(cyl(0.16, 0.22, 4.2, C.stake, 0, 2.1, 0, 5), box(0.6, 0.1, 0.5, C.stake, 0, 3.7, 0));
  g.add(cone(0.3, 0.5, C.bell, 0, 3.15, 0, 8), box(0.07, 0.3, 0.07, C.bell, 0, 2.85, 0));
  g.add(place(box(Math.hypot(L, drop), 0.05, 0.05, C.twine), L / 2, 3.1 - drop / 2, 0, 0, 0, -Math.atan2(drop, L)));
  return g;
}

// ---------------------------------------------------------------- small finds (hidden objects)
/** A leather-wrapped bundle of clothes tied with cord, stuffed into a hollow. */
export function bundle(): THREE.Group {
  const g = grp(place(cyl(0.45, 0.5, 1.9, C.leather, 0, 0, 0, 7), 0, 0.5, 0, 0, 0, Math.PI / 2));
  for (const x of [-0.5, 0.5]) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 4, 10), mat(C.twine)), x, 0.5, 0, Math.PI / 2));
  return g;
}
/** A strip of scorched blue cloth snagged in the timbers, a tarnished silver clasp still on it. */
export function claspRag(): THREE.Group {
  const g = grp(place(box(1.8, 0.06, 0.9, C.blueCloth), 0, 0.45, 0, 0.4, 0.1, 0.35), box(0.3, 0.12, 0.3, C.silver, 0.5, 0.55, 0.1, 0.6), box(0.6, 0.05, 0.3, C.ash, -0.6, 0.47, -0.2, 0.4));
  return g;
}
/** Tally marks scratched low on a parapet: eleven short strokes and a word, facing -z. */
export function tallyMarks(): THREE.Group {
  const g = grp(box(1.9, 0.6, 0.05, C.score, 0, 1.4, 0));
  for (let k = 0; k < 11; k++) g.add(box(0.05, 0.3, 0.06, C.boneOld, -0.8 + k * 0.13 + (k >= 5 ? 0.12 : 0), 1.5, -0.01));
  for (let k = 0; k < 3; k++) g.add(box(0.14, 0.05, 0.06, C.boneOld, -0.3 + k * 0.3, 1.2, -0.01));
  return g;
}
/** A drowned villager lying face up in the shallows, half under the water. */
export function drownedVillager(): THREE.Group {
  const b = humanoid({ skin: C.corpseSkin, cloth: C.corpseCloth, trim: C.corpseTrim, hair: C.corpseHair, weapon: 'none' });
  place(b, 0, -0.35, 0, 0.3, -Math.PI / 2 + 0.2, 0.25);
  return grp(b);
}

// ---------------------------------------------------------------- figures
/** A Barovian scout: hooded hunter in grey-green homespun with a crossbow slung across the chest. */
export function scout(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#d6b496', cloth: C.scoutCloth, trim: C.scoutTrim, hair: '#3a2a1a', cloak: true, helm: 'cap', weapon: 'none', scale: s });
  const cb = grp(box(2.2 * s, 0.14 * s, 0.12 * s, C.bow, 0, 0, 0), box(0.14 * s, 0.1 * s, 1.9 * s, C.bow, 0.8 * s, 0, 0), box(0.3 * s, 0.25 * s, 0.25 * s, C.trapIron, 0.75 * s, 0.05 * s, 0));
  g.add(place(cb, 0.3 * s, 3.5 * s, 0.7 * s, 0.5, 0, 0.3));
  return g;
}
/** A Vistani bandit: faded wine-red coat with tarnished gold trim, black hair, a drawn blade. */
export function vistaniBandit(d: Dims): THREE.Group { return humanoid({ skin: '#c9a07a', cloth: C.vistaniCloth, trim: C.vistaniTrim, hair: '#1a1416', weapon: 'sword', scale: d.scale ?? 1 }); }
/** A river-sodden zombie: grey-green skin, rotted homespun, hunched. */
export function zombie(d: Dims): THREE.Group { return humanoid({ skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', hunch: 0.4, scale: d.scale ?? 1 }); }
/** A raven, perched (faces +x). About 2 ft long once the tiny size scales it. */
export function raven(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.6, g = grp();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), mat(C.raven)); body.scale.set(1.7, 0.9, 0.85); body.position.set(0, 0.72 * s, 0); g.add(body);
  g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.27 * s, 1), mat(C.raven)), 0.74 * s, 1.02 * s, 0), place(cone(0.09 * s, 0.55 * s, C.beak, 0, 0, 0, 4), 1.15 * s, 0.98 * s, 0, 0, 0, -Math.PI / 2));
  g.add(box(0.95 * s, 0.08 * s, 0.36 * s, C.raven, -0.98 * s, 0.62 * s, 0), cyl(0.04 * s, 0.05 * s, 0.5 * s, C.beak, 0.12 * s, 0.25 * s, -0.16 * s, 4), cyl(0.04 * s, 0.05 * s, 0.5 * s, C.beak, 0.12 * s, 0.25 * s, 0.16 * s, 4));
  for (const sz of [-1, 1]) g.add(box(1.05 * s, 0.1 * s, 0.4 * s, C.ravenDark, -0.15 * s, 0.98 * s, sz * 0.42 * s), box(0.07 * s, 0.07 * s, 0.05 * s, '#8a8a8a', 0.86 * s, 1.12 * s, sz * 0.21 * s));
  return g;
}
/** A will-o'-wisp: a cold pale light with a flicker of motes round it, hanging in the air like a lantern. */
export function willOWisp(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 2, core = mat(C.wispCore, { emissive: '#9fc8e8' }), g = grp();
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), core); b.position.y = 2.6 * s; g.add(b);
  for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * s, 0), core); f.position.set(Math.cos(i * 1.05) * 0.9 * s, 2.6 * s + Math.sin(i * 2.1) * 0.7 * s, Math.sin(i * 1.05) * 0.9 * s); g.add(f); }
  const vm = matClone(C.wispGlow); vm.transparent = true; vm.opacity = 0.28; vm.depthWrite = false;
  const veil = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), vm); veil.position.y = 2.6 * s; g.add(veil);
  return g;
}
/** A swarm of bats: a cloud of small dark bodies with angled wings, flying low. */
export function batSwarm(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = grp(), n = 14;
  for (let i = 0; i < n; i++) {
    const an = i * 2.4, r = (0.5 + (i % 7) * 0.3) * s, y = (1.2 + (i % 5) * 0.5) * s, b = grp(box(0.3 * s, 0.14 * s, 0.5 * s, C.bat));
    for (const sx of [-1, 1]) { const w = box(0.75 * s, 0.04 * s, 0.4 * s, C.bat, sx * 0.5 * s, 0.1 * s, 0); w.rotation.z = sx * (0.3 + (i % 3) * 0.3); b.add(w); }
    place(b, Math.cos(an) * r, y, Math.sin(an) * r, an); g.add(b);
  }
  return g;
}
/** A skeletal warhorse in ruined chain barding, a skeleton rider on its back holding up a rusted lantern that gives no
 *  light. Faces +x. */
export function skeletalWarhorse(d: Dims): THREE.Group {
  const g = horse({ bone: 1, scale: d.scale ?? 1 }), s = (d.scale ?? 1) * 1.75;
  g.add(box(3.6 * s, 1.0 * s, 1.95 * s, C.barding, 0.1 * s, 3.5 * s, 0), box(1.1 * s, 1.5 * s, 1.75 * s, C.bardingDark, 2.1 * s, 4.4 * s, 0));
  for (let i = 0; i < 5; i++) g.add(box(0.12 * s, 0.55 * s, 1.98 * s, C.ribDark, (-1.5 + i * 0.6) * s, 3.0 * s, 0));
  const rider = humanoid({ skin: PALETTE.bone, cloth: '#1a171d', trim: '#2b2420', robe: true, weapon: 'none', hair: undefined, scale: 0.95 });
  place(rider, -0.2 * s, 4.2 * s - 2.6, 0, Math.PI / 2); g.add(rider);
  const arm = grp(box(0.18, 1.7, 0.18, PALETTE.bone, 0, 0.85, 0), box(0.55, 0.8, 0.55, C.lanternIron, 0, 2.0, 0), box(0.4, 0.5, 0.4, C.lanternGlass, 0, 2.0, 0), box(0.6, 0.12, 0.6, C.rust, 0, 2.46, 0));
  g.add(place(arm, 0.75 * s, 4.2 * s + 0.9, 0.5, 0, 0, -0.7));
  return g;
}

Object.assign(PROPS_V1, {
  'd-arch-bridge': archBridge, 'd-river-sill': riverSill, 'd-gravel-bar': gravelBar, 'd-strand-line': strandLine, 'd-drowned-wain': () => drownedWain(), 'd-fish-weir': fishWeir,
  'd-washing-slabs': washingSlabs, 'd-wolf-gibbet': wolfGibbet, 'd-flood-stone': () => floodStone(), 'd-hollow-willow': hollowWillow, 'd-undercut-bank': undercutBank, 'd-trappers-hide': () => trappersHide(),
  'd-sheep-rocks': sheepRocks, 'd-bank-ramp': bankRamp, 'd-river-reach': riverReach, 'd-wolf-trap': wolfTrap, 'd-castle-reflection': castleReflection, 'd-bell-stake': bellStake,
  'd-bundle': () => bundle(), 'd-clasp-rag': () => claspRag(), 'd-tally-marks': () => tallyMarks(), 'd-drowned-villager': () => drownedVillager(),
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, {
  'd-scout': (d) => scout(d), 'd-vistani-bandit': (d) => vistaniBandit(d), 'd-zombie': (d) => zombie(d), 'd-raven': (d) => raven(d), 'd-will-o-wisp': (d) => willOWisp(d),
  'd-bat-swarm': (d) => batSwarm(d), 'd-skeletal-warhorse': (d) => skeletalWarhorse(d),
} as Record<string, (d: Dims) => THREE.Group>);
