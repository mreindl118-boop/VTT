// Props and figures for one wilderness site of chapter 2: R, the Raven River Crossroads (its own file so each site is
// built on its own). Every kind registered here starts with 'r-' so it never collides with another site's. Built from
// THREE meshes with mat() so the world-space surface grain applies; new colours are declared with surfaceFor.
// Feet; origin at the floor centre; +z is plan south. The site is granite and running water: everything wet is a step
// darker on its river side, and the ravens' white streaks are the only bright marks on the stone.
import * as THREE from 'three';
import { PROPS_V1, pineTier } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { box, compact, coneWith, cylWith, grp, hash, lump, place, plate, tris } from '../shapes';
import { fogMat as veil } from '../mist';
const cyl = cylWith(7), cone = coneWith(5);

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  granite: '#6b6a65', graniteDeep: '#575651', granitePale: '#7f7d77', graniteWet: '#45474a', graniteTop: '#737980', lichen: '#7e866b', moss: '#3c4b34', mossDeep: '#2f3b2a',
  water: '#4b6474', waterDeep: '#3a5060', waterPale: '#6e8998', foam: '#e0e5e9', foamGrey: '#c3cbd1', spray: '#d5dbe0', ford: '#5b7180',
  dead: '#a8a49b', deadDeep: '#8d8980', deadDark: '#6f6b63', nest: '#3e3127', nestPale: '#57473a',
  raven: '#151419', ravenSheen: '#26262f', beak: '#2c2723', dropping: '#dedbd1', droppingGrey: '#bdbab2', bone: '#d7cfb8',
  pile: '#2d2723', pileRot: '#3b322b', plank: '#5c4d3e', plankGrey: '#6d6458',
  earth: '#4f4335', earthPale: '#5e5040', mud: '#3b3229', mudWet: '#2c2621', gravel: '#7b7870', gravelPale: '#918d84', crushed: '#86837b',
  snow: '#b6b9bd', snowGrit: '#8e9195', rime: '#ccd3d9',
  iron: '#2f3035', rust: '#5b3b2b', mail: '#6a5446',
  oak: '#7b756b', oakDeep: '#686259', letter: '#b9af99', feather: '#121116',
  cloth: '#5f5545', clothDark: '#4b4a3f', corpse: '#a49b8b', blood: '#3e1b1b', hair: '#2d2520',
  wagon: '#5f4c38', wagonDeep: '#4b3c2c', barrel: '#6b5139', hoop: '#303136', rope: '#8d7c5d',
  trough: '#706d67', slime: '#5e7b36', slimeWater: '#3d4b3b', leather: '#5a3e2a', strap: '#3a2a1e',
  bark: '#3f322a', barkGrey: '#5a5249', needle: '#2f4537', needleDeep: '#203327', charcoal: '#1b1a1c',
  scoutCloth: '#3f4a3a', scoutCloak: '#33392f', scoutSkin: '#c4a283', vCloth0: '#6b3b3b', vCloth1: '#3b4b5b', vCloth2: '#5b4b31', vCloth3: '#4b3b53', vScarf: '#8b5b2b', vSkin: '#caa485',
  bat: '#242025', batWing: '#302b31', lantern: '#2b2b2f', glassDark: '#1a1c1e',
} as const;
surfaceFor([C.granite, C.graniteDeep, C.granitePale, C.graniteWet], 'rock');
surfaceFor([C.graniteTop], 'flag');
surfaceFor([C.lichen, C.moss, C.mossDeep, C.needle, C.needleDeep, C.slime], 'foliage');
surfaceFor([C.water, C.waterDeep, C.waterPale, C.ford, C.slimeWater], 'water');
surfaceFor([C.foam, C.foamGrey, C.spray, C.dropping, C.droppingGrey, C.bone, C.raven, C.ravenSheen, C.beak, C.feather, C.blood, C.corpse, C.hair, C.charcoal, C.glassDark, C.bat, C.batWing, C.scoutSkin, C.vSkin, C.letter], 'none');
surfaceFor([C.dead, C.deadDeep, C.deadDark, C.bark, C.barkGrey], 'bark');
surfaceFor([C.nest, C.nestPale], 'thatch');
surfaceFor([C.pile, C.pileRot, C.plank, C.plankGrey, C.oak, C.oakDeep, C.wagon, C.wagonDeep, C.barrel], 'wood');
surfaceFor([C.earth, C.earthPale, C.mud, C.mudWet], 'dirt');
surfaceFor([C.gravel, C.gravelPale, C.crushed], 'dirt');
surfaceFor([C.snow, C.snowGrit, C.rime], 'snow');
surfaceFor([C.iron, C.rust, C.mail, C.hoop, C.lantern], 'metal');
surfaceFor([C.trough], 'stone');
surfaceFor([C.cloth, C.clothDark, C.rope, C.leather, C.strap, C.scoutCloth, C.scoutCloak, C.vCloth0, C.vCloth1, C.vCloth2, C.vCloth3, C.vScarf], 'cloth');

// ---------------------------------------------------------------- helpers
/** Flip every triangle of a non-indexed list whose face points against `dir(centroid)` (so the winding of hand-built
 *  rock comes out right whichever way the piece is mirrored). */
function outward(v: number[], dir: (x: number, y: number, z: number) => [number, number, number]): number[] {
  for (let i = 0; i < v.length; i += 9) {
    const ax = v[i], ay = v[i + 1], az = v[i + 2], bx = v[i + 3] - ax, by = v[i + 4] - ay, bz = v[i + 5] - az, cx = v[i + 6] - ax, cy = v[i + 7] - ay, cz = v[i + 8] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx, [dx, dy, dz] = dir(ax + (bx + cx) / 3, ay + (by + cy) / 3, az + (bz + cz) / 3);
    if (nx * dx + ny * dy + nz * dz < 0) for (let k = 0; k < 3; k++) { const tmp = v[i + 3 + k]; v[i + 3 + k] = v[i + 6 + k]; v[i + 6 + k] = tmp; }
  }
  return v;
}
/** One mesh per material: a piece built from dozens of parts draws in a handful of calls (for the pieces that are
 *  not merged into the level's static scatter: hidden things, fog, figures). */
/** White water that keeps a faint light of its own at night. */
const foamMat = (c: string) => mat(c, { emissive: '#1c2125' });

// ---------------------------------------------------------------- ravens
/** One raven, about 2 ft long, facing local +x; `spread` opens its wings. */
function ravenBird(spread = 0, seed = 0): THREE.Group {
  const g = grp(), body = lump(0.42, C.raven, seed, 1.55, 0.85, 0.8, 0); body.position.y = 0.55; g.add(body);
  g.add(place(lump(0.24, C.raven, seed + 1, 1, 1, 0.9, 0), 0.55, 0.88, 0), cone(0.08, 0.36, C.beak, 0.86, 0.86, 0, 4).rotateZ(-Math.PI / 2));
  g.add(box(0.62, 0.07, 0.34, C.ravenSheen, -0.7, 0.52, 0, 0, 0, 0.25));                                     // tail
  for (const z of [-0.1, 0.1]) g.add(box(0.05, 0.3, 0.05, C.beak, 0.05, 0.16, z));
  if (spread) for (const s of [-1, 1]) { const w = box(0.7, 0.06, 1.25, C.ravenSheen, -0.05, 0.75, s * 0.85); w.rotation.x = s * 0.35; g.add(w); }
  else for (const s of [-1, 1]) g.add(box(0.8, 0.2, 0.08, C.ravenSheen, -0.15, 0.6, s * 0.3, 0, 0, 0.12));
  return g;
}
/** Two to five perched ravens on whatever stands under them, at height `y`, within `spread` ft; `wing` 1 has one
 *  spreading its wings. */
export function ravenPerch(d: Dims): THREE.Group {
  const n = Math.max(1, Math.round(d.n ?? 3)), sp = d.spread ?? 1.5, y = d.y ?? 0, sd = d.seed ?? 0, g = grp();
  for (let i = 0; i < n; i++) {
    const a = hash(i, sd) * Math.PI * 2, r = i === 0 ? 0 : sp * (0.4 + 0.6 * hash(i, sd + 1)), b = ravenBird(d.wing && i === n - 1 ? 1 : 0, i + sd);
    place(b, Math.cos(a) * r, y, Math.sin(a) * r, hash(i, sd + 2) * Math.PI * 2); g.add(b);
  }
  return g;
}

// ---------------------------------------------------------------- the bridge and its granite
/** The single granite arch: `len` ft long (local x) and `w` wide, the deck humped from `end` ft at both ends to a level
 *  crown `crown` ft high over its middle `flat` ft, 3-ft parapets with a coping, the arch ring of voussoirs springing
 *  from `spring` ft (below the bench) across a clear `span`, a keystone carved with a worn raven on both faces, a string
 *  course, spray stains, and moss on the `moss` face (+1 = local +z). The body runs down to `base` (under the water). */
export function archBridge(d: Dims): THREE.Group {
  const L = d.len ?? 70, W = d.w ?? 15, top = d.crown ?? 10, end = d.end ?? 1.5, flat = d.flat ?? 22, span = d.span ?? 34, spring = d.spring ?? -2.5, base = d.base ?? -8, mossSide = d.moss ?? 1;
  const g = grp(), half = L / 2, fh = flat / 2;
  const yd = (x: number) => { const a = Math.abs(x); if (a <= fh) return top; const t = Math.min(1, (a - fh) / (half - fh)); return end + (top - end) * (1 - t * t * (3 - 2 * t)); };
  // the body: the spandrels and the barrel of the arch in one extruded piece
  const a = span / 2, crownIn = top - 2.6, outer: THREE.Vector2[] = [new THREE.Vector2(-half, base)];
  const n = 28; for (let i = 0; i <= n; i++) { const x = -half + (i / n) * L; outer.push(new THREE.Vector2(x, yd(x) - 0.45)); }
  outer.push(new THREE.Vector2(half, base));
  const shape = new THREE.Shape(outer), hole = new THREE.Path();
  hole.moveTo(-a, base + 0.5); hole.lineTo(-a, spring);
  for (let k = 1; k < 18; k++) { const t = Math.PI - (k / 18) * Math.PI; hole.lineTo(Math.cos(t) * a, spring + Math.sin(t) * (crownIn - spring)); }
  hole.lineTo(a, spring); hole.lineTo(a, base + 0.5); hole.lineTo(-a, base + 0.5);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2);
  g.add(new THREE.Mesh(geo, mat(C.granite)));
  // the paving, the parapets and their coping, following the hump
  const m = 24;
  for (let i = 0; i < m; i++) {
    const x0 = -half + (i * L) / m, x1 = x0 + L / m, xm = (x0 + x1) / 2, y0 = yd(x0), y1 = yd(x1), sl = Math.atan2(y1 - y0, L / m), len = L / m / Math.cos(sl) + 0.08, ym = (y0 + y1) / 2;
    g.add(box(len, 0.5, W - 1.9, C.graniteTop, xm, ym - 0.2, 0, 0, 0, sl));
    for (const s of [-1, 1]) {
      g.add(box(len, 3.2, 0.95, i % 3 ? C.granite : C.graniteDeep, xm, ym + 1.4, s * (W / 2 - 0.48), 0, 0, sl));
      g.add(box(len + 0.05, 0.35, 1.25, C.granitePale, xm, ym + 3.15, s * (W / 2 - 0.48), 0, 0, sl));
      g.add(box(len, 0.4, 0.35, C.graniteDeep, xm, ym - 1.1, s * (W / 2 + 0.1), 0, 0, sl));                              // string course
      if (hash(i, s + 4) > 0.55) g.add(box(L / m * 0.7, 0.9 + hash(i, s) * 2.2, 0.1, C.graniteWet, xm, ym - 2.4 - hash(i, s + 1) * 2, s * (W / 2 + 0.03)));   // spray stains
    }
  }
  // the arch ring on both faces, the keystone with its worn raven
  for (const s of [-1, 1]) {
    const nv = 17;
    for (let k = 0; k < nv; k++) {
      const t = Math.PI - ((k + 0.5) / nv) * Math.PI, x = Math.cos(t) * (a + 0.9), y = spring + Math.sin(t) * (crownIn - spring + 0.9);
      const key = k === Math.floor(nv / 2), v = box(key ? 2.4 : 1.9, key ? 2.6 : 1.9, 0.5, key ? C.granitePale : k % 2 ? C.granite : C.graniteDeep, x, y, s * (W / 2 + 0.22));
      v.rotation.z = Math.atan2(Math.sin(t) * (crownIn - spring), Math.cos(t) * a) - Math.PI / 2; g.add(v);
    }
    const ky = spring + (crownIn - spring) + 0.9, z = s * (W / 2 + 0.52);
    const rv = grp(box(1.1, 0.5, 0.12, C.graniteWet, 0, 0, 0), box(0.45, 0.4, 0.12, C.graniteWet, 0.62, 0.2, 0), box(0.6, 0.28, 0.12, C.graniteWet, -0.75, -0.08, 0, 0, 0, 0.3), box(0.2, 0.12, 0.12, C.graniteWet, 0.98, 0.18, 0));
    rv.position.set(0, ky, z); g.add(rv);
  }
  // moss and weed along the waterline and under the parapet on the shaded face
  for (let i = 0; i < 9; i++) {
    const x = -half * 0.8 + (i / 8) * L * 0.8, y = i % 2 ? yd(x) - 1.6 : Math.max(base + 2.5, -4.6 + hash(i, 3) * 1.5);
    if (Math.abs(x) < a - 1 && i % 2 === 0) continue;
    g.add(place(lump(0.9 + hash(i, 2) * 0.8, i % 3 ? C.moss : C.mossDeep, i, 1.8, 0.7, 0.35, 0), x, y, mossSide * (W / 2 + 0.15)));
  }
  // the end blocks where the deck meets the knobs
  for (const sx of [-1, 1]) g.add(box(3, end + 1.4, W + 0.6, C.graniteDeep, sx * (half - 1.5), (end + 1.4) / 2 - 1, 0));
  return g;
}

/** A squat granite bollard 3 ft high with an iron ring on its road face (+z), polished pale where ropes and hooves rub;
 *  `droppings` 1 whitens its top. */
export function bridgeBollard(d: Dims): THREE.Group {
  const g = grp(cyl(0.75, 0.95, 2.6, C.granite, 0, 1.3, 0, 8), cone(0.78, 0.6, C.granitePale, 0, 2.9, 0, 8), cyl(0.97, 0.97, 0.35, C.granitePale, 0, 0.9, 0, 8));
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 4, 10), mat(C.iron)), 0, 1.6, 0.98), box(0.3, 0.3, 0.2, C.rust, 0, 2.05, 0.86));
  if (d.droppings ?? 1) g.add(plate(0.55, 3, C.dropping, 3.12, 1.1), box(0.08, 0.7, 0.05, C.dropping, 0.3, 2.4, 0.78));
  return g;
}

/** A rounded granite outcrop `r` ft across its base and `h` high, its foot carried down `drop` ft into the riverbank.
 *  `cut` > 0 slices a pick-cut road slot that wide straight through it along local x (walls with tool marks, the floor
 *  at the base); `cairn` 1 stacks a small cairn on the crown. */
export function rockKnob(d: Dims): THREE.Group {
  const R = d.r ?? 14, Lk = d.len ?? R, H = d.h ?? 8, drop = d.drop ?? 7, cut = d.cut ?? 0, sd = d.seed ?? 1, g = grp();
  const COL = [C.granite, C.graniteDeep, C.granitePale];
  if (!cut) {
    g.add(place(lump(1, C.granite, sd, R * 0.55, (H + drop) * 0.62, R * 0.5, 1), 0, (H - drop) / 2, 0));
    for (let k = 0; k < 4; k++) { const a = hash(k, sd) * Math.PI * 2; g.add(place(lump(1, COL[k % 3], sd + k + 3, R * 0.3, H * 0.45, R * 0.28, 1), Math.cos(a) * R * 0.38, H * 0.25, Math.sin(a) * R * 0.38)); }
  } else {
    // two flanks either side of the slot, each a long rounded hump falling to nothing at its ends, cut sheer on the slot side
    const wing = R / 2 - cut / 2, nx = 16, nu = 6;
    for (const s of [-1, 1]) {
      const yAt = (x: number, u: number) => { const fx = Math.pow(Math.max(0, 1 - Math.pow(Math.abs((2 * x) / Lk), 2.4)), 0.55), gu = Math.pow(Math.cos(Math.min(1, u / wing) * Math.PI / 2), 0.6); return H * fx * gu - 0.6 * (1 - fx * gu); };
      const V = (i: number, j: number): [number, number, number] => { const x = -Lk / 2 + (i / nx) * Lk, u = (j / nu) * wing * (1 + 0.15 * hash(i + j * 3, sd + s)); return [x, yAt(x, u) + (j > 0 && j < nu ? (hash(i * 7 + j, sd) - 0.5) * 0.7 : 0), s * (cut / 2 + u)]; };
      const top: number[] = [], wall: number[] = [];
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nu; j++) { const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), e = V(i, j + 1); top.push(...a, ...b, ...c, ...a, ...c, ...e); }
        const a = V(i, 0), b = V(i + 1, 0); wall.push(a[0], -drop, a[2], b[0], -drop, b[2], ...b, a[0], -drop, a[2], ...b, ...a);
      }
      g.add(tris(outward(top, () => [0, 1, 0]), s > 0 ? C.granite : C.graniteDeep), tris(outward(wall, () => [0, 0, -s]), C.graniteDeep));
      // tool marks: pick grooves raking across the cut wall, and a drill line or two
      for (let k = 0; k < 11; k++) { const x = -Lk * 0.32 + (k / 10) * Lk * 0.64, y = 1 + hash(k, sd + s) * (yAt(x, 0) - 2); if (y < 1) continue; g.add(box(1.6 + hash(k, 2) * 1.2, 0.14, 0.12, C.graniteWet, x, y, s * (cut / 2 - 0.03), 0, 0, (hash(k, 5) - 0.5) * 0.9)); }
      for (let k = 0; k < 2; k++) { const x = (k - 0.5) * Lk * 0.3; g.add(box(0.12, yAt(x, 0) * 0.7, 0.12, C.graniteWet, x, yAt(x, 0) * 0.4, s * (cut / 2 - 0.04))); }
      for (let k = 0; k < 3; k++) g.add(place(lump(0.5 + hash(k, sd + 9) * 0.4, C.granitePale, k + s, 1.2, 0.6, 1, 0), (hash(k, s + 7) - 0.5) * Lk * 0.6, 0.2, s * (cut / 2 - 0.7)));   // spalls at the wall foot
      for (let k = 0; k < 4; k++) { const x = (hash(k, sd + s + 20) - 0.5) * Lk * 0.6, u = wing * (0.3 + hash(k, sd + 21) * 0.4); g.add(place(lump(0.8 + hash(k, sd + 22) * 0.7, k % 2 ? C.lichen : C.moss, k + 9, 1.4, 0.3, 1.2, 0), x, yAt(x, u) + 0.05, s * (cut / 2 + u))); }
    }
  }
  if (!cut) for (let k = 0; k < 5; k++) g.add(place(lump(0.7 + hash(k, sd + 7) * 0.8, k % 2 ? C.lichen : C.moss, k, 1.4, 0.3, 1.2, 0), (hash(k, sd + 8) - 0.5) * R * 0.5, H * (0.8 + hash(k, 3) * 0.2) - 0.1, (hash(k, sd + 9) - 0.5) * R * 0.5));
  if (d.cairn) { const cz = cut ? cut / 2 + R * 0.2 : 0; for (let k = 0; k < 5; k++) g.add(box(1.6 - k * 0.25, 0.42, 1.3 - k * 0.2, k % 2 ? C.granitePale : C.graniteDeep, 0.1 * (k % 2), H + 0.2 + k * 0.4, cz, k * 0.7)); }
  return g;
}

/** A granite shelf at the Notch: `w` across (local x) and `d` along the river (local z), its flat top `h` ft above its
 *  origin and its foot carried `drop` ft down into the river cut. The river face (local +x × `face`) is straight,
 *  vertical and wet; the landward sides lean back like the low lip it is. `ledge` 1 wears a pale path along the top of
 *  the river face and cuts rough steps down its south (+z) end. */
export function rockShelf(d: Dims): THREE.Group {
  const W = d.w ?? 60, D = d.d ?? 120, H = d.h ?? 12, drop = d.drop ?? 7, f = d.face ?? 1, sd = d.seed ?? 2, g = grp();
  // the outline, walked round from the river face: straight there, ragged and rounded on the landward sides
  const ring: [number, number][] = [], n = 14;
  for (let i = 0; i <= n; i++) ring.push([f * W / 2 + f * (hash(i, sd) - 0.5) * 0.6, -D / 2 + (i / n) * D]);   // the river face, north to south
  const back: [number, number][] = [];
  for (let i = 1; i < 10; i++) { const t = (i / 10) * Math.PI, k = 0.85 + 0.2 * hash(i, sd + 3); back.push([f * W / 2 - f * Math.sin(t) * W * k, D / 2 * Math.cos(t) * (0.92 + 0.08 * hash(i, sd + 5))]); }
  const outline = ring.concat(back);
  const cx = outline.reduce((a, p) => a + p[0], 0) / outline.length, cz = outline.reduce((a, p) => a + p[1], 0) / outline.length;
  const N = outline.length;
  // four rings: the foot, a half-height ledge (its lip and its back) and the crown; the river face stays sheer
  const at = (i: number, k: number): [number, number, number] => {
    const p = outline[i], river = i <= n, jit = (hash(i, sd + 13) - 0.5) * 1.4;
    if (river) return [p[0] - (k === 3 ? f * 0.4 : 0), [-drop, H * 0.45, H * 0.45, H][k], p[1]];
    const sc = [1, 0.92, 0.85, 0.76][k];
    return [cx + (p[0] - cx) * sc, [-1, H * 0.4 + jit, H * 0.46 + jit, H][k], cz + (p[1] - cz) * (1 - (1 - sc) * 0.75)];
  };
  const rock: number[] = [], top: number[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let k = 0; k < 3; k++) {
      const a = at(i, k), b = at(j, k), c = at(j, k + 1), e = at(i, k + 1), dest = k === 1 ? top : rock;
      dest.push(...a, ...b, ...c, ...a, ...c, ...e);
    }
    top.push(cx, H, cz, ...at(i, 3), ...at(j, 3));
  }
  const dir = (x: number, _y: number, z: number): [number, number, number] => [x - cx, 4, z - cz];
  const side = tris(outward(rock, dir), C.granite), crown = tris(outward(top, dir), C.graniteTop);
  g.add(side, crown);
  // boulders fallen onto the half-height ledge
  for (let k = 0; k < 7; k++) { const i = n + 1 + Math.floor(hash(k, sd + 14) * (N - n - 2)), a = at(i, 1), b = at(i, 2); g.add(place(lump(1.1 + hash(k, sd + 15) * 1.5, k % 2 ? C.graniteDeep : C.granite, k + 60, 1.2, 0.7, 1.1, 1), (a[0] + b[0]) / 2, a[1] + 0.5, (a[2] + b[2]) / 2)); }
  for (let k = 0; k < 6; k++) g.add(box(4 + hash(k, sd + 16) * 6, 0.08, 0.25, C.graniteWet, cx + (hash(k, sd + 27) - 0.5) * W * 0.4, H + 0.06, cz + (hash(k, sd + 28) - 0.5) * D * 0.6, hash(k, sd + 19) * 3));   // cracks across the crown
  // strata ledges and wet streaks on the river face, lichen and moss on the crown, loose blocks at the landward foot
  for (let k = 0; k < 7; k++) { const z = -D / 2 + (k + 0.5) * (D / 7) + (hash(k, sd) - 0.5) * 6; g.add(box(1.2, 0.6, 8 + hash(k, sd + 1) * 8, k % 2 ? C.graniteDeep : C.granite, f * (W / 2 + 0.3), H * (0.25 + 0.5 * hash(k, sd + 2)), z)); }
  for (let k = 0; k < 7; k++) { const z = -D / 2 + (hash(k, sd + 20) * 0.9 + 0.05) * D, h = (H + drop) * (0.3 + 0.5 * hash(k, sd + 4)); g.add(box(0.12, h, 0.8 + hash(k, sd + 6) * 3, C.graniteWet, f * (W / 2 + 0.1), H - h / 2 - hash(k, 3) * 1.5, z)); }
  for (let k = 0; k < 9; k++) g.add(place(plate(1.2 + hash(k, sd + 7) * 1.8, k + sd, k % 3 ? C.lichen : C.moss, 0.08, 1.4), cx + (hash(k, sd + 8) - 0.5) * W * 0.5, H, cz + (hash(k, sd + 9) - 0.5) * D * 0.6, hash(k, sd + 10) * 6));
  for (let k = 0; k < 8; k++) { const i = n + 1 + Math.floor(hash(k, sd + 10) * (N - n - 2)), p = outline[i]; g.add(place(lump(1.2 + hash(k, sd + 11) * 1.8, k % 2 ? C.graniteDeep : C.granite, k + 30, 1.2, 0.7, 1.1, 1), p[0] + (p[0] - cx) * 0.05, 0.6, p[1] + (p[1] - cz) * 0.05)); }
  if (d.ledge) {
    for (let k = 0; k < 8; k++) { const z = -D / 2 + (k + 0.5) * (D / 8); g.add(box(3.2, 0.12, D / 8 + 0.3, k % 2 ? C.gravelPale : C.crushed, f * (W / 2 - 3.2), H + 0.08, z, (hash(k, 4) - 0.5) * 0.08)); }
    for (let k = 0; k < 5; k++) g.add(box(4, H - k * (H / 5), 2.4, k % 2 ? C.granite : C.graniteDeep, f * (W / 2 - 4.5), (H - k * (H / 5)) / 2, D / 2 - 2 + k * 2.3));   // rough steps down the south end
  }
  return g;
}

/** The Raven's Throat: a boulder-choked white rapid `len` ft long (local z, flowing toward +z) and `w` wide, falling
 *  `drop` ft from its head to its foot (y = 0) over five broken ledges, car-sized blocks with foam tails, standing
 *  waves running on past its foot, and spray hanging over the ledges. No pool anywhere. */
export function throatRapids(d: Dims): THREE.Group {
  const L = d.len ?? 150, W = d.w ?? 40, drop = d.drop ?? 10, sd = d.seed ?? 3, g = grp();
  const steps = 5, yAt = (u: number) => { // u: 0 at the head, 1 at the foot; a staircase eased between ledges
    const s = u * steps, i = Math.min(steps - 1, Math.floor(s)), t = s - i, k = Math.min(1, t / 0.28);
    return drop * (1 - (i + k * k * (3 - 2 * k) * 0.75 + Math.max(0, (t - 0.28) / 0.72) * 0.25) / steps);
  };
  // the water: a stepped profile extruded across the channel
  const prof: THREE.Vector2[] = [new THREE.Vector2(-L / 2, -1.2)];
  const np = 60; for (let i = 0; i <= np; i++) { const u = i / np; prof.push(new THREE.Vector2(-L / 2 + u * L, yAt(u))); }
  prof.push(new THREE.Vector2(L / 2, -1.2));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(prof), { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2); geo.rotateY(-Math.PI / 2);
  g.add(new THREE.Mesh(geo, mat(C.waterPale)));
  // white water: a broken lip at every ledge, foam sheets on each run, standing waves past the foot
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.06) / steps, z = -L / 2 + u * L, y = yAt(u);
    for (let k = 0; k < 6; k++) { const x = -W / 2 + (k + 0.5) * (W / 6) + (hash(k, i + sd) - 0.5) * 3; const lip = box(W / 6 * (0.75 + hash(k, i) * 0.4), 0.9, 3.4 + hash(k, i + 2) * 2.5, k % 2 ? C.foam : C.foamGrey, x, y + 0.25, z + 1.2, (hash(k, i + 3) - 0.5) * 0.3, 0.3); lip.material = foamMat(k % 2 ? C.foam : C.foamGrey); g.add(lip); }
    for (let k = 0; k < 4; k++) { const uu = u + (0.25 + k * 0.17) / steps, zz = -L / 2 + uu * L; const sh = plate(3 + hash(k, i) * 3, i * 7 + k, C.foam, 0, 1.7, foamMat(k % 2 ? C.foam : C.foamGrey)); sh.position.set((hash(k, i + 5) - 0.5) * W * 0.7, yAt(uu) + 0.12, zz); sh.rotation.y = Math.PI / 2 + (hash(k, i + 6) - 0.5) * 0.5; g.add(sh); }
  }
  for (let k = 0; k < 5; k++) { const z = L / 2 - 2 - k * 5.5; const wv = box(W * (0.5 + hash(k, sd) * 0.4), 0.5, 1.1, C.foamGrey, (hash(k, sd + 1) - 0.5) * 6, yAt((z + L / 2) / L) + 0.25, z, (hash(k, sd + 2) - 0.5) * 0.2); wv.material = foamMat(C.foamGrey); g.add(wv); }
  // the blocks: car-sized granite, wet black where the water runs over them, each trailing a tongue of foam
  const nb = Math.round(L / 9);
  for (let i = 0; i < nb; i++) {
    const u = (i + 0.3 + hash(i, sd) * 0.5) / nb, z = -L / 2 + u * L, x = (hash(i, sd + 1) - 0.5) * (W - 6), r = 2.6 + hash(i, sd + 2) * 3.4, y = yAt(u);
    g.add(place(lump(r, i % 3 ? C.graniteWet : C.granite, i + sd, 1.3, 0.7, 1.05, 1), x, y + r * 0.2, z, hash(i, sd + 3) * 3));
    const tail = plate(r * 0.55, i + 40, C.foam, 0, 2.2, foamMat(C.foam)); tail.position.set(x + (hash(i, 4) - 0.5), yAt(Math.min(1, u + r / L)) + 0.14, z + r * 1.4); tail.rotation.y = Math.PI / 2; g.add(tail);
  }
  // spray over the two biggest ledges and at the foot
  for (const [u, k] of [[0.42, 1], [0.62, 2], [0.81, 3]] as const) for (let j = 0; j < 3; j++) {
    const s = lump(3 + hash(j, k) * 3, C.spray, j + k * 5, 1.5, 0.55, 1.1, 1); s.material = veil(C.spray, 0.32);
    s.position.set((hash(j, k + 1) - 0.5) * W * 0.6, yAt(u) + 2 + hash(j, k + 2) * 2, -L / 2 + u * L); g.add(s);
  }
  return g;
}

// ---------------------------------------------------------------- the river below the arch
/** The stubs of the old timber bridge: two rows of blackened piles across the river (local x), `gap` apart along the
 *  flow (local z), standing 1-3 ft out of the water at the origin; rotted tops, a fallen cap beam, weed caught on them.
 *  Between the rows the old cart ford: a pale gravel bar under the shallows. */
export function oldPiles(d: Dims): THREE.Group {
  const L = d.len ?? 48, gap = d.gap ?? 14, n = Math.round(d.n ?? 7), g = grp();
  g.add(box(L + 6, 0.04, gap - 3, C.ford, 0, 0.13, 0));                                                              // the ford's shallow, paler water
  for (let i = 0; i < 7; i++) g.add(place(plate(2 + hash(i, 3) * 2.4, i, C.gravelPale, 0.17, 1.6), -L / 2 + (i + 0.5) * (L / 7), 0, (hash(i, 4) - 0.5) * (gap - 6)));   // gravel breaking the surface
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    if (hash(i, s + 9) < 0.12) continue;                                                                             // a pile rotted away
    const x = -L / 2 + (i + 0.5) * (L / n) + (hash(i, s) - 0.5) * 1.4, z = s * gap / 2 + (hash(i, s + 1) - 0.5) * 0.8, h = 1 + hash(i, s + 2) * 2.2, r = 0.85 + hash(i, s + 3) * 0.3;
    g.add(cyl(r * 0.85, r, h + 3, i % 2 ? C.pile : C.pileRot, x, (h - 3) / 2, z, 6));
    g.add(cone(r * 0.8, 0.8, C.pileRot, x + 0.1, h + 0.3, z, 5).rotateZ((hash(i, s + 4) - 0.5) * 0.8));
    g.add(place(new THREE.Mesh(new THREE.TorusGeometry(r + 0.12, 0.12, 4, 8), mat(C.moss)), x, 0.18, z, 0, Math.PI / 2));   // weed at the waterline
    const foam = plate(0.7, i + s, C.foam, 0.14, 2, foamMat(C.foamGrey)); foam.position.set(x, 0, z + 1.4); foam.rotation.y = Math.PI / 2; g.add(foam);
  }
  g.add(box(9, 0.6, 0.7, C.pileRot, -L * 0.18, 0.15, gap / 2 + 1.6, 0.4, 0, 0.12), box(6, 0.5, 0.6, C.pile, L * 0.26, 0.12, -gap / 2 - 1.8, -0.3));   // fallen cap beams
  return g;
}

/** A gravel ramp worn down a 6-ft riverbank where carts once went to the ford: `len` ft long (local x), `w` wide,
 *  falling from the bank top (origin) to `h` ft below at +x, with ruts and a scatter of washed stones. */
export function fordRamp(d: Dims): THREE.Group {
  const L = d.len ?? 26, W = d.w ?? 12, H = d.h ?? 6, g = grp();
  const shp = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(L, -H), new THREE.Vector2(L, -H - 1), new THREE.Vector2(-1, -H - 1)]);
  const geo = new THREE.ExtrudeGeometry(shp, { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2);
  g.add(new THREE.Mesh(geo, mat(C.gravel)));
  const sl = Math.atan2(-H, L), cl = Math.hypot(L, H);
  for (const s of [-1, 1]) g.add(box(cl, 0.12, 0.9, C.mud, L / 2 - 0.5, -H / 2 + 0.05, s * 2.4, 0, 0, sl));
  for (let i = 0; i < 9; i++) { const x = hash(i, 2) * L; g.add(place(lump(0.35 + hash(i, 3) * 0.35, i % 2 ? C.gravelPale : C.granite, i, 1.3, 0.6, 1, 0), x, -H * (x / L) + 0.15, (hash(i, 4) - 0.5) * (W - 2))); }
  return g;
}

// ---------------------------------------------------------------- the rookery
/** The rookery: a dead beech `h` ft tall, bark gone to silver-grey wood, its top snapped off in splinters; three tiers
 *  of forks crowded with two dozen stick nests and sitting ravens; flared roots in a white disc of droppings and small
 *  bones. */
export function rookeryTree(d: Dims): THREE.Group {
  const H = d.h ?? 60, sd = d.seed ?? 5, g = grp();
  g.add(plate(5, 2, C.dropping, 0.08, 1.1));
  for (let i = 0; i < 16; i++) { const a = hash(i, sd + 30) * Math.PI * 2, r = 3 + hash(i, sd + 31) * 9; g.add(place(plate(1.2 + hash(i, sd + 32) * 2.2, i + 3, C.dropping, 0.09 + (i % 3) * 0.01, 1.3), Math.cos(a) * r, 0, Math.sin(a) * r, hash(i, 4) * 6)); }
  for (let i = 0; i < 8; i++) { const a = hash(i, sd + 33) * Math.PI * 2, r = 4 + hash(i, sd + 34) * 8; g.add(place(plate(1.5 + hash(i, 5) * 2, i + 30, C.droppingGrey, 0.085, 1.4), Math.cos(a) * r, 0, Math.sin(a) * r)); }
  for (let i = 0; i < 14; i++) { const a = hash(i, 1) * Math.PI * 2, r = 2.5 + hash(i, 2) * 9; g.add(box(0.12, 0.08, 0.5 + hash(i, 3) * 0.5, C.bone, Math.cos(a) * r, 0.14, Math.sin(a) * r, hash(i, 4) * 3)); }
  // the bole and its flared roots
  g.add(cyl(1.35, 2.5, H * 0.42, C.dead, 0, H * 0.21, 0, 8), cyl(0.95, 1.25, H * 0.3, C.deadDeep, 0, H * 0.57, 0, 7), cyl(0.6, 0.95, H * 0.22, C.dead, 0.3, H * 0.83, 0, 6));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; const rt = box(4.5, 1.1, 1.1, C.deadDeep, Math.cos(a) * 2.6, 0.45, Math.sin(a) * 2.6, -a, 0, -0.25); g.add(rt); }
  // the snapped top: a ring of splinters
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const sp = cone(0.28, 2.5 + hash(k, sd) * 3, C.deadDark, 0.3 + Math.cos(a) * 0.4, H - 0.6 + hash(k, sd) * 1.2, Math.sin(a) * 0.4, 4); sp.rotation.z = Math.cos(a) * 0.3; sp.rotation.x = Math.sin(a) * 0.3; g.add(sp); }
  // the limbs: three tiers of forks, each limb carrying nests
  const limbs: { y: number; a: number; len: number; tilt: number }[] = [];
  for (let k = 0; k < 10; k++) limbs.push({ y: H * (0.3 + (k % 3) * 0.15 + hash(k, sd) * 0.05), a: k * 2.4 + hash(k, sd + 1), len: H * (0.32 - (k % 3) * 0.06), tilt: 0.85 + hash(k, sd + 2) * 0.4 - (k % 3) * 0.12 });
  let nests = 0;
  for (const [k, l] of limbs.entries()) {
    const limb = grp(); limb.position.set(0, l.y, 0); limb.rotation.set(0, l.a, -l.tilt);
    limb.add(cyl(0.25, 0.7, l.len, k % 2 ? C.dead : C.deadDeep, 0, l.len / 2, 0, 5));
    for (const s of [-1, 1]) { const tw = cyl(0.08, 0.2, l.len * 0.45, C.deadDark, 0, 0, 0, 4); tw.position.set(s * 0.8, l.len * 0.82, 0); tw.rotation.z = s * 0.55; limb.add(tw); }
    // nests sit in the fork and halfway along
    for (const f of [0.18, 0.55, 0.88]) {
      if (nests >= 24 || (f > 0.8 && k % 2)) continue;
      const ne = lump(1.15 + hash(nests, 7) * 0.5, nests % 2 ? C.nest : C.nestPale, nests, 1.25, 0.6, 1.15, 0); ne.position.set(0.3, l.len * f + 0.6, 0); limb.add(ne);
      for (let t = 0; t < 3; t++) limb.add(box(0.08, 0.08, 1.9, C.nestPale, 0.3 + (hash(t, nests) - 0.5) * 1.4, l.len * f + 0.4 + t * 0.25, (hash(t, nests + 3) - 0.5) * 0.6, hash(t, nests + 1) * 3));
      nests++;
    }
    g.add(limb);
  }
  // nests jammed in the main forks against the bole
  for (let k = 0; k < 24 - nests; k++) { const a = k * 1.9, y = H * (0.45 + (k % 5) * 0.09); g.add(place(lump(1.2, k % 2 ? C.nestPale : C.nest, k + 50, 1.2, 0.6, 1.1, 0), Math.cos(a) * 1.4, y, Math.sin(a) * 1.4)); }
  // a dozen ravens along the limbs and on the snapped crown
  for (let k = 0; k < 12; k++) {
    const l = limbs[k % limbs.length], f = 0.35 + hash(k, 11) * 0.5, tx = Math.sin(l.tilt) * l.len * f, ty = Math.cos(l.tilt) * l.len * f;
    const b = ravenBird(k === 3 ? 1 : 0, k); b.scale.setScalar(1.15);
    b.position.set(Math.cos(l.a) * tx, l.y + ty + 0.15, -Math.sin(l.a) * tx); b.rotation.y = hash(k, 12) * 6.3; g.add(b);
  }
  for (let k = 0; k < 2; k++) { const b = ravenBird(0, k + 20); b.scale.setScalar(1.15); b.position.set((k - 0.5) * 0.8, H + 0.6, 0.1); b.rotation.y = k * 2.6; g.add(b); }
  // white streaks down the bole under the nests
  for (let k = 0; k < 7; k++) { const a = k * 0.9; g.add(box(0.06, 3 + hash(k, 2) * 6, 0.4, C.dropping, Math.cos(a) * 1.3, H * (0.3 + hash(k, 3) * 0.3), Math.sin(a) * 1.3, -a)); }
  return g;
}

/** A bank boulder `r` ft in radius capped white with droppings and streaked down its sides; a favourite perch. */
export function ravenStone(d: Dims): THREE.Group {
  const r = d.r ?? 3, sd = d.seed ?? 1, g = grp(place(lump(r, sd % 2 ? C.granite : C.graniteDeep, sd, 1.25, 0.72, 1.05, 1), 0, r * 0.45, 0, hash(sd, 1) * 3));
  g.add(place(lump(r * 0.55, C.dropping, sd + 3, 1.3, 0.22, 1.1, 0), 0.1, r * 1.12, 0));
  for (let k = 0; k < 5; k++) { const a = hash(k, sd) * 6.3; g.add(box(0.1, r * 0.55, 0.35, C.dropping, Math.cos(a) * r * 0.95, r * 0.75, Math.sin(a) * r * 0.85, -a, 0, 0.3)); }
  g.add(place(lump(r * 0.3, C.lichen, sd + 7, 1.4, 0.3, 1.2, 0), -r * 0.5, r * 0.85, r * 0.3));
  return g;
}

/** A fallen, hollow beech trunk `len` ft long (local x) with its open, rotten end at +x. */
export function hollowLog(d: Dims): THREE.Group {
  const L = d.len ?? 14, r = d.r ?? 1.3, g = grp();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, L, 9, 1, true), mat(C.deadDeep)); place(shell, 0, r * 0.9, 0, 0, 0, Math.PI / 2); g.add(shell);
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 9), mat(C.deadDark)), -L / 2, r * 0.9, 0, -Math.PI / 2));   // the closed root end
  const mouth = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r * 1.02, 9), mat(C.dead)); place(mouth, L / 2 + 0.01, r * 0.9, 0, Math.PI / 2); g.add(mouth);
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 9), mat(C.charcoal)), L / 2 - 0.3, r * 0.9, 0, Math.PI / 2));   // the dark inside
  for (let k = 0; k < 3; k++) g.add(box(0.3, 1.6 + k * 0.4, 0.3, C.dead, -L * 0.3 + k * L * 0.25, r * 1.8 + 0.5, (k - 1) * 0.4, 0, 0.3 * (k - 1), 0.4));
  for (let k = 0; k < 4; k++) g.add(place(lump(0.6 + hash(k, 2) * 0.5, C.moss, k, 1.8, 0.4, 1, 0), -L / 2 + (k + 0.5) * (L / 4), r * 1.7, (hash(k, 3) - 0.5) * r));
  g.add(box(L * 0.5, 0.12, 0.3, C.charcoal, L * 0.1, r * 1.78, 0.3));                                              // a rotten split along the top
  return g;
}
/** The leather-wrapped bundle of drab clothes pushed into the log's mouth (a wereraven's). */
export function bundle(): THREE.Group {
  const b = lump(0.8, C.leather, 4, 1.5, 0.7, 1, 0); b.position.y = 0.6;
  return grp(b, box(0.15, 1.2, 1.5, C.strap, -0.35, 0.6, 0), box(0.15, 1.2, 1.5, C.strap, 0.4, 0.6, 0), box(0.5, 0.2, 0.6, C.cloth, 1.1, 0.75, 0.2));
}

/** A row of tall pines with straight, thin trunks bare of branches to two thirds of their height (the screen the arch is
 *  seen through): `n` trees along `len` ft of local x, `h` tall. */
export function pineScreen(d: Dims): THREE.Group {
  const n = Math.max(1, Math.round(d.n ?? 4)), L = d.len ?? 40, H = d.h ?? 55, sd = d.seed ?? 1, g = grp();
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -L / 2 + (i / (n - 1)) * L + (hash(i, sd) - 0.5) * 3, z = (hash(i, sd + 1) - 0.5) * 6, h = H * (0.85 + hash(i, sd + 2) * 0.3), t = grp();
    t.add(cyl(0.38, 0.75, h * 0.86, i % 2 ? C.bark : C.barkGrey, 0, h * 0.43, 0, 6));
    for (let k = 0; k < 4; k++) { const st = box(0.14, 1.2 + hash(k, i) * 1.4, 0.14, C.barkGrey, 0, h * (0.22 + k * 0.11), 0, k * 1.7); st.rotation.z = 1.1; st.position.x = Math.cos(k * 1.7) * 0.5; st.position.z = -Math.sin(k * 1.7) * 0.5; t.add(st); }   // dead stubs
    for (let k = 0; k < 3; k++) { const tr = 4.2 - k * 1.1, th = h * (0.14 - k * 0.015), c = new THREE.Mesh(pineTier(tr, th, 7, i + k), mat(k % 2 ? C.needleDeep : C.needle)); c.position.y = h * (0.66 + k * 0.1) + th / 2; c.rotation.y = i + k; t.add(c); }
    t.add(cone(0.9, h * 0.1, C.needleDeep, 0, h * 0.98, 0, 5));
    t.position.set(x, 0, z); t.rotation.z = (hash(i, sd + 3) - 0.5) * 0.04; g.add(t);
  }
  return g;
}

// ---------------------------------------------------------------- the roads and what stands by them
/** The crossroads fingerpost in weathered grey oak, leaning `lean` degrees toward local +x: arms along the plan bearings
 *  `a0`..`a2` (degrees clockwise from map north, rotY left at 0), its cap white with droppings, black feathers jammed
 *  into the cracks of the post. */
export function signpost(d: Dims): THREE.Group {
  const arms: number[] = []; for (let i = 0; i < 3; i++) if (d['a' + i] !== undefined) arms.push(d['a' + i]);
  const post = grp(box(0.5, 9.2, 0.5, C.oak, 0, 4.6, 0), place(new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.75, 4), mat(C.oakDeep)), 0, 9.55, 0, Math.PI / 4));
  post.add(place(lump(0.42, C.dropping, 3, 1.1, 0.45, 1.1, 0), 0, 9.6, 0), box(0.06, 1.6, 0.52, C.dropping, 0.27, 8.6, 0));
  arms.forEach((b, i) => {
    const r = (b * Math.PI) / 180, ux = Math.sin(r), uz = -Math.cos(r);
    const arm = grp(box(3.4, 0.72, 0.22, C.oakDeep, 1.95, 0, 0), box(2.3, 0.16, 0.24, C.letter, 1.8, 0.06, 0), place(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.22), mat(C.oakDeep)), 3.62, 0, 0, 0, 0, Math.PI / 4));
    if (i === 0) arm.add(box(0.5, 0.05, 0.1, C.dropping, 2.6, 0.38, 0));
    place(arm, 0, 8.4 - i * 0.9, 0, Math.atan2(-uz, ux)); post.add(arm);
  });
  for (let k = 0; k < 5; k++) { const f = box(0.08, 1.1, 0.25, C.feather, (k % 2 ? 0.26 : -0.26), 3.2 + k * 1.05, (hash(k, 3) - 0.5) * 0.4, 0, 0, (k % 2 ? -1 : 1) * 0.5); post.add(f); }
  post.rotation.z = -((d.lean ?? 4) * Math.PI) / 180;
  const g = grp(post, box(1.2, 0.5, 1.2, C.oakDeep, 0, 0.25, 0));
  for (let k = 0; k < 5; k++) { const a = k * 1.3; g.add(place(lump(0.45 + hash(k, 2) * 0.3, C.granite, k, 1.2, 0.7, 1, 0), Math.cos(a) * 1, 0.25, Math.sin(a) * 1)); }   // stones packed round the foot
  return g;
}

/** A squat, waist-high milestone of the old Barovian roads: worn numerals and a sun sigil on its road face (+z), lichen
 *  over half of it. */
export function leagueStone(): THREE.Group {
  const g = grp(cyl(1.0, 1.25, 3.0, C.granite, 0, 1.5, 0, 7), place(lump(1.05, C.granite, 3, 1, 0.45, 1, 1), 0, 3.0, 0));
  const face = 1.13;
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 4, 10), mat(C.graniteWet)), 0, 2.45, face));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.add(box(0.07, 0.3, 0.06, C.graniteWet, Math.cos(a) * 0.52, 2.45 + Math.sin(a) * 0.52, face, 0, 0, a + Math.PI / 2)); }
  for (let k = 0; k < 3; k++) g.add(box(0.09, 0.5, 0.06, C.graniteWet, -0.35 + k * 0.32, 1.45, face - 0.04, 0, 0, k === 1 ? 0.5 : 0));
  g.add(box(0.7, 0.08, 0.06, C.graniteWet, 0, 1.12, face - 0.05));
  for (let k = 0; k < 4; k++) g.add(place(lump(0.45 + hash(k, 1) * 0.3, C.lichen, k, 1.3, 1.4, 0.35, 0), -0.6 + (k % 2) * 0.3, 0.8 + k * 0.6, -0.95 + (k % 2) * 0.2, k * 0.4));
  g.add(plate(1.8, 4, C.mud, 0.1, 1.2));
  return g;
}

/** A crushed-granite hard-standing `w` × `d` where the wine wagon turns and waits: arcing wheel ruts and hoof-churned
 *  mud toward its -x end (where the trough stands). */
export function wagonTurnout(d: Dims): THREE.Group {
  const W = d.w ?? 60, D = d.d ?? 40, g = grp();
  const pts: THREE.Vector2[] = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, k = 0.86 + 0.16 * hash(i, 2); pts.push(new THREE.Vector2(Math.cos(a) * W / 2 * k, Math.sin(a) * D / 2 * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.1, 0); g.add(new THREE.Mesh(geo, mat(C.crushed)));
  // two pairs of ruts arcing through it
  for (const [R, cz] of [[D * 0.62, D * 0.55], [D * 0.42, D * 0.5]] as const) for (const off of [-2.6, 2.6]) {
    const n = 12; for (let i = 0; i < n; i++) { const a = Math.PI * (0.12 + 0.76 * (i + 0.5) / n), r = R + off, x = Math.cos(a) * r * 1.35, z = cz - Math.sin(a) * r; g.add(box(r * 1.35 * Math.PI * 0.76 / n + 0.3, 0.06, 0.85, C.mudWet, x, 0.15, z, a + Math.PI / 2)); }
  }
  for (let i = 0; i < 6; i++) g.add(place(plate(2.5 + hash(i, 5) * 2.5, i + 7, C.mud, 0.14, 1.4), -W * 0.3 + (hash(i, 6) - 0.5) * W * 0.25, 0, (hash(i, 8) - 0.5) * D * 0.6));
  for (let i = 0; i < 4; i++) g.add(place(plate(1.2 + hash(i, 9), i + 30, C.slimeWater, 0.17, 1.6), -W * 0.32 + (hash(i, 10) - 0.5) * 10, 0, (hash(i, 11) - 0.5) * D * 0.4));   // puddles
  return g;
}

/** A long stone watering trough (along local x), green slime in its water, fed at its -x end by a stone spout from the
 *  leat, hoof mud round it, and a hitching rail of two posts and a bar on its +z side. */
export function stoneTrough(d: Dims): THREE.Group {
  const L = d.len ?? 10, g = grp(plate(L * 0.7, 3, C.mud, 0.12, 1.6), plate(L * 0.4, 6, C.mudWet, 0.15, 1.8));
  g.add(box(L, 0.4, 2.8, C.trough, 0, 0.2, 0), box(L, 2.1, 0.45, C.trough, 0, 1.25, -1.17), box(L, 2.1, 0.45, C.trough, 0, 1.25, 1.17), box(0.45, 2.1, 2.8, C.trough, -L / 2 + 0.22, 1.25, 0), box(0.45, 2.1, 2.8, C.trough, L / 2 - 0.22, 1.25, 0));
  g.add(box(L - 0.9, 0.05, 1.9, C.slimeWater, 0, 1.95, 0), box(L * 0.4, 0.06, 1.2, C.slime, L * 0.15, 1.98, -0.2), box(1.4, 0.06, 1.1, C.slime, -L * 0.3, 1.98, 0.3));
  for (let k = 0; k < 4; k++) g.add(box(0.6, 0.9 + hash(k, 2), 0.06, C.slime, -L / 2 + 1.5 + k * 2.2, 1.2, 1.42));
  // the spout: a stone channel on two stones, falling into the trough's end
  g.add(box(4.2, 0.45, 1.0, C.trough, -L / 2 - 2.1, 2.35, 0, 0, 0, -0.08), box(4.2, 0.06, 0.5, C.water, -L / 2 - 2.1, 2.6, 0, 0, 0, -0.08), box(0.8, 2.2, 0.8, C.granite, -L / 2 - 3.4, 1.1, 0));
  // the hitching rail
  for (const x of [-L * 0.35, L * 0.35]) g.add(cyl(0.22, 0.26, 4.2, C.oakDeep, x, 2.1, 3.4, 6));
  g.add(box(L * 0.8, 0.3, 0.3, C.oak, 0, 3.7, 3.4), place(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 4, 8), mat(C.iron)), L * 0.15, 3.35, 3.4));
  return g;
}

/** A crust of dirty old snow `len` ft long against a boulder's lee (the drift lies along local x, the boulder at -z),
 *  rime frost spreading from it over the gravel toward +z. */
export function snowCrust(d: Dims): THREE.Group {
  const L = d.len ?? 10, g = grp(plate(L * 0.55, 4, C.rime, 0.1, 1.4), plate(L * 0.3, 8, C.rime, 0.11, 1.6).translateZ(L * 0.3));
  for (let k = 0; k < 4; k++) g.add(place(lump(1.6 + hash(k, 2) * 0.8, k % 2 ? C.snow : C.snowGrit, k, L / 7, 0.45, 1.1, 1), -L / 2 + (k + 0.5) * (L / 4), 0.3, -1.2 + hash(k, 3) * 0.8));
  for (let k = 0; k < 7; k++) g.add(box(0.3, 0.1, 0.3, C.charcoal, (hash(k, 5) - 0.5) * L, 0.75, -1 + hash(k, 6) * 1.2));   // grit and needles in the crust
  return g;
}

/** Gravel spread on a road, `len` ft along local x and `w` wide: a ragged grey bed with washed stones in it; `rime` 1
 *  frosts it white. */
export function gravel(d: Dims): THREE.Group {
  const L = d.len ?? 20, W = d.w ?? 10, sd = d.seed ?? 1, pts: THREE.Vector2[] = [], n = Math.max(4, Math.round(L / 4));
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L, -W / 2 + hash(i, sd) * 1.2));
  for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / n) * L, W / 2 - hash(i, sd + 1) * 1.2));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.1, 0);
  const g = grp(new THREE.Mesh(geo, mat(C.gravel)));
  if (d.rime) for (let i = 0; i < 5; i++) g.add(place(plate(1.2 + hash(i, sd + 7) * 1.8, i + sd, C.rime, 0.13, 1.6), (hash(i, sd + 8) - 0.5) * L * 0.8, 0, (hash(i, sd + 9) - 0.5) * (W - 3), hash(i, sd + 10) * 3));
  for (let i = 0; i < Math.round((L * W) / 14); i++) g.add(box(0.35 + hash(i, sd + 2) * 0.4, 0.12, 0.3 + hash(i, sd + 3) * 0.35, i % 3 ? C.gravelPale : C.granite, (hash(i, sd + 4) - 0.5) * L, 0.14, (hash(i, sd + 5) - 0.5) * (W - 1), hash(i, sd + 6) * 3));
  return g;
}

/** A knee-high cairn of stacked flat stones, the first of the pass road's trail markers. */
export function trailCairn(d: Dims): THREE.Group {
  const g = grp(), n = Math.round(d.n ?? 6);
  for (let k = 0; k < n; k++) g.add(box(1.9 - k * 0.22, 0.38, 1.6 - k * 0.18, k % 2 ? C.granitePale : C.granite, (hash(k, 1) - 0.5) * 0.2, 0.19 + k * 0.38, (hash(k, 2) - 0.5) * 0.2, k * 0.9));
  g.add(place(lump(0.3, C.granitePale, 2, 1, 1.4, 1, 0), 0, n * 0.38 + 0.3, 0));
  return g;
}

/** Two rotten planks laid side by side over a roadside ditch, along local x, one cracked and sagging. */
export function plankCrossing(d: Dims): THREE.Group {
  const L = d.len ?? 7, g = grp();
  g.add(box(L, 0.22, 1.1, C.plank, 0, 0.32, -0.62), box(L * 0.52, 0.22, 1.0, C.plankGrey, -L * 0.24, 0.3, 0.6, 0, 0, 0.1), box(L * 0.5, 0.22, 1.0, C.plankGrey, L * 0.25, 0.2, 0.6, 0, 0, -0.14));
  for (const x of [-L / 2 + 0.4, L / 2 - 0.4]) g.add(box(0.6, 0.4, 2.8, C.earth, x, 0.15, 0));
  return g;
}

/** A roadside ditch `len` ft long (local x) and `w` wide: a dark muddy cut with standing water and grassy lips. */
export function ditch(d: Dims): THREE.Group {
  const L = d.len ?? 30, W = d.w ?? 4, g = grp(box(L, 0.06, W, C.mud, 0, 0.11, 0), box(L * 0.97, 0.05, W * 0.42, C.mudWet, 0, 0.14, 0));
  const n = Math.max(2, Math.round(L / 12));
  for (let i = 0; i < n; i++) if (hash(i, 4) > 0.4) g.add(box(L / n * (0.3 + hash(i, 6) * 0.4), 0.04, W * 0.35, C.slimeWater, -L / 2 + (i + 0.5) * (L / n), 0.17, (hash(i, 5) - 0.5) * 0.4));
  for (const s of [-1, 1]) g.add(box(L, 0.2, 0.55, C.moss, 0, 0.14, s * (W / 2 + 0.15)));
  for (let i = 0; i < Math.round(L / 6); i++) g.add(place(lump(0.35 + hash(i, 7) * 0.3, C.mossDeep, i, 1.3, 0.8, 1, 0), (hash(i, 8) - 0.5) * L, 0.25, (i % 2 ? 1 : -1) * (W / 2 + 0.3)));
  return g;
}

/** A stone-lined runnel 2 ft wide carrying water from the river to the trough, `len` ft along local x; `culvert` 1 lays
 *  a flat slab over it where it passes under a road. */
export function leat(d: Dims): THREE.Group {
  const L = d.len ?? 20, g = grp(box(L, 0.05, 1.7, C.water, 0, 0.13, 0)), n = Math.max(2, Math.round(L / 2.2));
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) g.add(box(L / n * 0.92, 0.42, 0.62, (i + (s > 0 ? 1 : 0)) % 3 ? C.granite : C.graniteDeep, -L / 2 + (i + 0.5) * (L / n), 0.2, s * 1.15, (hash(i, s) - 0.5) * 0.1));
  if (d.culvert) g.add(box(Math.min(L, 16), 0.5, 4, C.granitePale, 0, 0.3, 0));
  return g;
}

/** A shallow grave dug open by robbers: a mud-filled hole about 6 ft long (along local x) with its spoil thrown about,
 *  stones heaved off, bones and a scrap of rusted mail in the dirt, a split marker stake. `intact` 1: a rocky cairn. */
export function robbedGrave(d: Dims): THREE.Group {
  const g = grp();
  if (d.intact) { for (let k = 0; k < 14; k++) g.add(place(lump(0.6 + hash(k, 1) * 0.5, k % 2 ? C.granite : C.graniteDeep, k, 1.3, 0.7, 1, 0), -2.4 + (k % 5) * 1.2, 0.4 + Math.floor(k / 5) * 0.55, -0.9 + (Math.floor(k / 5) % 2) * 0.9)); return g; }
  g.add(plate(3.6, 2, C.earthPale, 0.12, 1.6), box(6, 0.08, 2.6, C.mudWet, 0, 0.16, 0), box(5, 0.05, 1.8, C.slimeWater, 0, 0.2, 0));
  for (let k = 0; k < 5; k++) { const a = k * 1.4 + 0.3; g.add(place(lump(1 + hash(k, 3) * 0.6, k % 2 ? C.earth : C.earthPale, k, 1.5, 0.45, 1.1, 0), Math.cos(a) * 4.2, 0.25, Math.sin(a) * 2.8)); }
  for (let k = 0; k < 7; k++) g.add(place(lump(0.45 + hash(k, 5) * 0.4, k % 3 ? C.granite : C.graniteDeep, k + 10, 1.2, 0.7, 1, 0), (hash(k, 6) - 0.5) * 11, 0.25, (hash(k, 7) - 0.5) * 8));
  for (let k = 0; k < 5; k++) g.add(box(0.16, 0.12, 0.9 + hash(k, 8) * 0.6, C.bone, (hash(k, 9) - 0.5) * 7, 0.22, (hash(k, 10) - 0.5) * 5, hash(k, 11) * 3));
  g.add(place(lump(0.35, C.bone, 3, 1, 0.9, 1.1, 0), 3.4, 0.35, -1.6));                                                          // a skull in the spoil
  g.add(box(1.4, 0.06, 1.0, C.mail, -3.6, 0.2, 1.8, 0.4), box(1.4, 0.07, 0.08, C.rust, -3.6, 0.23, 1.8, 0.4));                   // the scrap of mail
  g.add(box(0.3, 2.4, 0.2, C.plankGrey, 3.2, 1.0, 0.9, 0, 0, 0.35), box(0.3, 1.2, 0.2, C.plankGrey, 2.2, 0.15, 1.6, 0.6, Math.PI / 2, 0));
  return g;
}

/** A Barovian in muddy homespun, torn by big wolves, lying on his back along local x in a ditch; blood dark in the mud
 *  and wolf prints all round. */
export function tornCorpse(): THREE.Group {
  const body = humanoid({ skin: C.corpse, cloth: C.cloth, trim: C.clothDark, hair: C.hair, weapon: 'none' });
  body.rotation.set(0, 0, Math.PI / 2); body.position.set(2.9, 0.55, 0);
  const g = grp(plate(3.2, 2, C.blood, 0.13, 1.6), plate(1.4, 5, C.blood, 0.16, 1.3).translateX(-2), body);
  g.add(box(0.5, 0.35, 1.3, C.cloth, -1.5, 0.3, 2.3, 0.6), box(0.45, 0.35, 0.45, C.corpse, -2.4, 0.25, 2.8));                    // a torn-off sleeve and hand
  for (let i = 0; i < 18; i++) { const a = hash(i, 4) * Math.PI * 2, r = 3 + hash(i, 5) * 4; g.add(box(0.55, 0.05, 0.45, C.mudWet, Math.cos(a) * r * 1.3, 0.15, Math.sin(a) * r, a)); }
  return g;
}

/** An open farm wagon, front toward local +x: plank bed on four spoked wheels, the driver's bench, three wine barrels
 *  roped down on their sides, the pole out front. */
export function wineWagon(): THREE.Group {
  const g = grp(box(11, 0.4, 5.4, C.wagon, 0, 2.6, 0));
  for (const s of [-1, 1]) g.add(box(11, 1.3, 0.25, C.wagonDeep, 0, 3.4, s * 2.7));
  g.add(box(0.25, 1.3, 5.4, C.wagonDeep, -5.5, 3.4, 0), box(1.6, 0.25, 4.6, C.wagonDeep, 4.6, 4.3, 0), box(0.2, 1.4, 4.6, C.wagonDeep, 5.4, 4.9, 0));
  for (const x of [-3.6, 3.6]) for (const s of [-1, 1]) {
    const w = grp(place(new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.18, 4, 12), mat(C.wagonDeep)), 0, 0, 0));
    for (let k = 0; k < 6; k++) w.add(box(0.14, 3.2, 0.14, C.wagon, 0, 0, 0, 0, 0, (k / 6) * Math.PI));
    w.add(cyl(0.35, 0.35, 0.5, C.hoop, 0, 0, 0, 6).rotateX(Math.PI / 2)); w.position.set(x, 1.85, s * 3.05); g.add(w);
  }
  for (let k = 0; k < 3; k++) { const b = cyl(1.15, 1.15, 3.2, C.barrel, -3.6 + k * 2.6, 3.95, 0, 9); b.rotation.x = Math.PI / 2; g.add(b); for (const z of [-1.1, 1.1]) g.add(place(new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.07, 4, 10), mat(C.hoop)), -3.6 + k * 2.6, 3.95, z)); }
  g.add(box(8.5, 0.12, 0.12, C.rope, -1, 5.1, 0.6, 0, 0, 0), box(8.5, 0.12, 0.12, C.rope, -1, 5.1, -0.6));
  g.add(box(6, 0.3, 0.3, C.wagonDeep, 8.5, 2.2, 0));
  return g;
}

// ---------------------------------------------------------------- small hidden things
/** Wolf prints and bare human feet together in the mud, a trail `len` ft long along local x (mode 0); mode 1: claw
 *  scrapes and scuffs in the green slime of a ledge path. */
export function prints(d: Dims): THREE.Group {
  const L = d.len ?? 18, g = grp();
  if (d.mode === 1) { for (let i = 0; i < 10; i++) g.add(box(1.4, 0.05, 0.12, C.granitePale, -L / 2 + (i + 0.5) * (L / 10), 0.08, (hash(i, 2) - 0.5) * 1.2, (hash(i, 3) - 0.5) * 0.8)); return g; }
  for (let i = 0; i < 12; i++) {
    const x = -L / 2 + (i + 0.5) * (L / 12);
    g.add(box(0.5, 0.05, 0.42, C.mudWet, x, 0.1, -0.7 + (i % 2) * 0.5));                                           // a paw, toes ahead of it
    for (let t = 0; t < 3; t++) g.add(box(0.13, 0.05, 0.13, C.mudWet, x + 0.38, 0.1, -0.85 + (i % 2) * 0.5 + t * 0.15));
    if (i % 2 === 0) g.add(box(0.85, 0.05, 0.36, C.mudWet, x + 0.6, 0.1, 1.0 + (i % 4 ? 0.35 : 0)));                // a bare foot
  }
  return g;
}
/** A small lost thing: v 0 a trinket glinting in the mud; 1 a corroded dagger; 2 a wine-chit and a carved wooden holy
 *  symbol; 3 the Keepers' feather mark scratched into wood. */
export function trinket(d: Dims): THREE.Group {
  const v = Math.round(d.v ?? 0);
  if (v === 1) return grp(box(1.2, 0.08, 0.22, C.rust, 0, 0.12, 0), box(0.12, 0.1, 0.6, C.iron, -0.62, 0.12, 0), box(0.45, 0.14, 0.16, C.leather, -0.95, 0.13, 0));
  if (v === 2) return grp(box(0.7, 0.04, 0.45, C.letter, 0, 0.1, 0), box(0.12, 0.1, 0.6, C.oak, 0.7, 0.12, 0.3), box(0.4, 0.1, 0.12, C.oak, 0.7, 0.12, 0.42));
  if (v === 3) return grp(box(0.9, 0.04, 0.12, C.letter, 0, 0, 0), ...[0, 1, 2, 3].map((k) => box(0.3, 0.04, 0.06, C.letter, -0.3 + k * 0.2, 0, 0.1, 0.5)), ...[0, 1, 2, 3].map((k) => box(0.3, 0.04, 0.06, C.letter, -0.3 + k * 0.2, 0, -0.1, -0.5)));
  return grp(plate(0.6, 1, C.mudWet, 0.1, 1.2), place(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 4, 8), mat(C.letter)), 0.1, 0.16, 0, 0, Math.PI / 2));
}
/** A Keeper's cache under a cairn's loose top stone: a dozen black feathers bound together and a stub of charcoal. */
export function featherCache(): THREE.Group {
  const g = grp(box(1.3, 0.35, 1.0, C.granitePale, 0.9, 0.5, 0.3, 0.5, 0, 0.35));
  for (let k = 0; k < 12; k++) g.add(box(0.06, 0.06, 1.2, C.feather, (hash(k, 1) - 0.5) * 0.3, 0.12 + k * 0.02, 0, (hash(k, 2) - 0.5) * 0.4));
  g.add(box(0.5, 0.15, 0.15, C.charcoal, -0.5, 0.15, 0.4, 0.8));
  return g;
}

// ---------------------------------------------------------------- fog
/** A low bank of fog `len` × `d` ft lying `h` ft deep: a ragged sheet, drifting wisps at differing heights and soft
 *  billows along its edges, merged into two meshes and drawn over the grid (give it the 'explored' class). */
export function fogBank(d: Dims): THREE.Group {
  const L = d.len ?? 80, D = d.d ?? 30, H = d.h ?? 4, sd = d.seed ?? 1, g = grp();
  const sheet = (w: number, dd: number, y: number, seed: number, m: THREE.Material) => {
    const pts: THREE.Vector2[] = [], n = Math.max(6, Math.round(w / 9));
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(-w / 2 + (i / n) * w, -dd / 2 - hash(i, seed) * dd * 0.3));
    for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(-w / 2 + (i / n) * w, dd / 2 + hash(i, seed + 1) * dd * 0.3));
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    return new THREE.Mesh(geo, m);
  };
  g.add(sheet(L * 0.9, D * 0.7, H * 0.35, sd, veil(C.spray, 0.16)), sheet(L * 0.6, D * 0.4, H * 0.75, sd + 3, veil(C.foamGrey, 0.14)));
  const n = Math.max(5, Math.round((L * D) / 520));
  for (let i = 0; i < n; i++) { const w = plate(4 + hash(i, sd + 1) * 7, i + 90, C.spray, 0, 1.5, veil(i % 2 ? C.spray : C.foamGrey, 0.2)); w.position.set((hash(i, sd + 2) - 0.5) * L, 0.4 + hash(i, sd + 3) * H, (hash(i, sd + 4) - 0.5) * D); w.rotation.y = hash(i, sd + 5) * 6; g.add(w); }
  const nb = Math.max(2, Math.round(L / 24));
  for (let i = 0; i < nb; i++) { const r = 2.5 + hash(i, sd + 6) * 2.5, b = lump(r, C.spray, i + sd, 1.5, 0.6, 1.1, 1); b.material = veil(C.spray, 0.3); g.add(place(b, -L / 2 + (i + 0.5) * (L / nb), r * 0.35, (i % 2 ? 1 : -1) * D * 0.42, hash(i, 1) * 6)); }
  return compact(g, 2);
}

// ---------------------------------------------------------------- figures
/** A Barovian scout crouched in the pines: hood and drab cloak, a crossbow levelled forward (+z). */
export function scout(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: C.scoutSkin, cloth: C.scoutCloth, trim: C.clothDark, hair: C.hair, cloak: true, hunch: 0.35, scale: s, weapon: 'none' });
  g.add(box(0.95 * s, 0.6 * s, 0.9 * s, C.scoutCloak, 0, 5.85 * s, -0.12 * s));                                       // the hood
  g.add(box(0.25 * s, 0.25 * s, 2.4 * s, C.oakDeep, 0.25 * s, 3.9 * s, 1.1 * s), box(2.0 * s, 0.14 * s, 0.18 * s, C.wagonDeep, 0.25 * s, 3.95 * s, 2.2 * s));
  return g;
}
/** A Vistana grave-robber in faded bright cloth with a headscarf and sash; `v` picks the colours, odd ones carry a
 *  muddy spade. */
export function vistaniBandit(d: Dims): THREE.Group {
  const v = Math.round(d.v ?? 0), CL = [C.vCloth0, C.vCloth1, C.vCloth2, C.vCloth3], s = d.scale ?? 1;
  const g = humanoid({ skin: C.vSkin, cloth: CL[v % 4], trim: C.clothDark, hair: C.hair, scale: s, skirt: v === 2, weapon: v % 2 ? 'none' : 'sword' });
  g.add(box(0.95 * s, 0.32 * s, 0.95 * s, C.vScarf, 0, 5.75 * s, 0.02 * s), box(1.1 * s, 0.22 * s, 0.6 * s, v % 2 ? C.vScarf : C.vCloth0, 0, 3.2 * s, 0.05 * s, 0, 0, 0.35));
  if (v % 2) g.add(box(0.14 * s, 4.2 * s, 0.14 * s, C.oakDeep, 0.95 * s, 2.3 * s, 0.4 * s), box(0.9 * s, 1.0 * s, 0.1 * s, C.mud, 0.95 * s, 0.4 * s, 0.4 * s));
  return g;
}
/** The skeletal rider: a skeleton on a skeletal warhorse (facing +x), a rusted lantern held high on a pole, dark. */
export function skeletalRider(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = horse({ bone: 1, scale: s });
  const rider = CREATURES.skeleton({}); rider.scale.setScalar(0.92 * s); rider.position.set(-0.3 * s, 4.1 * s, 0); rider.rotation.y = Math.PI / 2; g.add(rider);
  g.add(box(0.14 * s, 5 * s, 0.14 * s, C.oakDeep, 0.9 * s, 8.4 * s, 0.9 * s), box(0.6 * s, 0.8 * s, 0.6 * s, C.lantern, 1.3 * s, 10.6 * s, 0.9 * s), box(0.4 * s, 0.5 * s, 0.62 * s, C.glassDark, 1.3 * s, 10.6 * s, 0.9 * s));
  return g;
}
/** A swarm of bats pouring out at dusk: a knot of small dark wedges wheeling `y` ft up. */
export function batSwarm(d: Dims): THREE.Group {
  const s = d.scale ?? 1, y0 = d.y ?? 4, g = grp();
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39, r = (0.6 + hash(i) * 2.6) * s, y = y0 + hash(i, 2) * 3.5 * s, bat = grp(box(0.35 * s, 0.22 * s, 0.2 * s, C.bat));
    for (const z of [-1, 1]) { const w = box(0.5 * s, 0.04 * s, 0.38 * s, C.batWing, 0, 0.05 * s, z * 0.3 * s); w.rotation.x = z * (0.4 + hash(i, z) * 0.7); bat.add(w); }
    bat.position.set(Math.cos(a) * r, y, Math.sin(a) * r); bat.rotation.y = -a + Math.PI / 2; g.add(bat);
  }
  return g;
}

Object.assign(PROPS_V1, {
  'r-arch-bridge': archBridge, 'r-bridge-bollard': bridgeBollard, 'r-rock-knob': rockKnob, 'r-rock-shelf': rockShelf, 'r-throat-rapids': throatRapids,
  'r-old-piles': oldPiles, 'r-ford-ramp': fordRamp, 'r-rookery-tree': rookeryTree, 'r-raven-perch': ravenPerch, 'r-raven-stone': ravenStone,
  'r-hollow-log': hollowLog, 'r-pine-screen': pineScreen, 'r-signpost': signpost, 'r-league-stone': leagueStone,
  'r-wagon-turnout': wagonTurnout, 'r-stone-trough': stoneTrough, 'r-snow-crust': snowCrust, 'r-trail-cairn': trailCairn, 'r-gravel': gravel, 'r-plank-crossing': plankCrossing,
  'r-ditch': ditch, 'r-leat': leat, 'r-robbed-grave': robbedGrave, 'r-torn-corpse': tornCorpse,
  'r-prints': (d: Dims) => compact(prints(d)), 'r-trinket': (d: Dims) => compact(trinket(d)), 'r-feather-cache': () => compact(featherCache()),
  'r-bundle': () => compact(bundle()), 'r-wine-wagon': () => compact(wineWagon()), 'r-fog': fogBank,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, {
  'r-scout': (d) => scout(d), 'r-vistani-bandit': (d) => vistaniBandit(d), 'r-skeletal-rider': (d) => skeletalRider(d), 'r-bat-swarm': (d) => batSwarm(d),
} as Record<string, (d: Dims) => THREE.Group>);
