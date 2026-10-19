// Props and figures for B, the Gates of Barovia (chapter 2, p.33): the two-faced gate piers and their iron leaves,
// the worn threshold sill, the boundary walls the forest has eaten, the keeper's lodge footings, the corduroy
// causeway, the black pools and wheel ruts of the Old Svalich Road, the rock cutting east, the dead pines and the
// Mist bank that stands against the gate. Every kind registered here starts with 'b-'. Feet; origin at the floor
// centre; +z is plan south; THREE meshes with mat() so the world-space surface grain applies.
import * as THREE from 'three';
import { PROPS_V1, vardo } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { box, compact, cone, cyl, flat, grp, hash, lump, place } from '../shapes';
import { fogMat } from '../mist';
import { weedTuft } from './wild';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  ashlar: '#7a766e', ashlarDeep: '#67635c', chalk: '#cfccc3', chalkDeep: '#b8b5ac', tide: '#dedbd2', paleGrey: '#a3a098',
  moss: '#3d4a33', blackMoss: '#262c22', lichen: '#6f7a55', mossLit: '#5f7a44', mossMid: '#4c6338', mossDeep: '#36472a', mossStone: '#5f6a50', mossStoneDeep: '#535d46', damp: '#4f4d47', weed: '#55613a', weedDry: '#7d7a4a',
  iron: '#2f3034', ironPale: '#45474d', rust: '#5a3a2a', rustPale: '#7a4a30', brass: '#9a7a3a', dew: '#aeb4ba',
  flag: '#6f757b', flagDeep: '#5c6167', groove: '#3f4347', polish: '#8a9096',
  mud: '#4e4336', mudWet: '#3a3128', bog: '#2a2622', pool: '#15171a', glint: '#5f666c', seep: '#22262a',
  rock: '#5a5853', rockDeep: '#4b4945', scree: '#6a6862', fieldStone: '#5f5b55', fieldPale: '#747069',
  deadBark: '#6e6a62', deadPale: '#8a867d', deadHeart: '#55514b', logRot: '#4a3b2c', logPale: '#5e4e3c', sapling: '#3f3328',
  raven: '#1b1b1f', ravenSheen: '#2e2f3a', beak: '#3a3b40', parchment: '#a89f86', tally: '#9c978c', tallyNew: '#c9c4b8',
  clothRed: '#8a3a32', clothGold: '#b08a44', clothBlue: '#34405f', clothPale: '#c9c2b2', clothGreen: '#2f4d3c', tassel: '#5a3352',
  skin: '#c9a27a', hair: '#2a2420', sashTrim: '#3b2d22', horseBay: '#5a4030', horseDark: '#2a2020',
  mist0: '#dcdee2', mist1: '#c7cad0', mist2: '#b3b7be', statue: '#858078',
} as const;
surfaceFor([C.ashlar, C.ashlarDeep, C.chalk, C.chalkDeep, C.tide, C.paleGrey, C.tally, C.tallyNew], 'ashlar');
surfaceFor([C.statue, C.fieldStone, C.fieldPale, C.groove, C.polish, C.damp], 'stone');
surfaceFor([C.flag, C.flagDeep], 'flag');
surfaceFor([C.moss, C.blackMoss, C.lichen, C.weed, C.mossLit, C.mossMid, C.mossDeep], 'foliage');
surfaceFor([C.mossStone, C.mossStoneDeep], 'ashlar');
surfaceFor([C.weedDry], 'thatch');
surfaceFor([C.iron, C.ironPale, C.rust, C.rustPale, C.brass], 'metal');
surfaceFor([C.mud, C.mudWet, C.bog], 'dirt');
surfaceFor([C.rock, C.rockDeep, C.scree], 'rock');
surfaceFor([C.deadBark, C.deadPale, C.deadHeart, C.sapling], 'bark');
surfaceFor([C.logRot, C.logPale], 'log');
surfaceFor([C.parchment, C.clothRed, C.clothGold, C.clothBlue, C.clothPale, C.clothGreen, C.tassel], 'cloth');
surfaceFor([C.pool, C.glint, C.seep, C.dew, C.mist0, C.mist1, C.mist2], 'none');
surfaceFor([C.raven, C.ravenSheen, C.beak, C.skin, C.hair, C.sashTrim, C.horseBay, C.horseDark], 'generic');

// ---------------------------------------------------------------- helpers
/** A flat polygon lying in the xz plane at height y (points as [x, z]). */
/** An irregular blob outline about r across, stretched sx along x. */
function blobPts(r: number, seed: number, sx = 1.4, n = 10): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (0.72 + 0.4 * hash(i, seed)); out.push([Math.cos(a) * k * sx, Math.sin(a) * k]); }
  return out;
}
/** A sapling: a thin trunk and two small tiers, grown out of a ruin. */
function sapling(x: number, z: number, h: number, seed: number): THREE.Group {
  const g = grp(cyl(0.12, 0.2, h, C.sapling, x, h / 2, z, 5));
  for (let i = 0; i < 2; i++) g.add(cone(0.9 - i * 0.3, 1.6, i ? '#2f4a3a' : '#1e3128', x, h * 0.55 + i * 1.3, z, 5));
  g.children[0].rotation.z = (hash(1, seed) - 0.5) * 0.2; return g;
}
/** A ragged-edged sheet L × D lying in the xz plane. */
function fogSheet(L: number, D: number, seed: number, m: THREE.Material): THREE.Mesh {
  const pts: [number, number][] = [], n = Math.max(4, Math.round(L / 7)), k = Math.max(2, Math.round(D / 7)), j = (i: number, s: number) => hash(i, seed + s) - 0.5;
  for (let i = 0; i <= n; i++) pts.push([-L / 2 + (i / n) * L + j(i, 1) * 3, -D / 2 - Math.abs(j(i, 2)) * D * 0.3]);
  for (let i = 1; i <= k; i++) pts.push([L / 2 + Math.abs(j(i, 3)) * 6, -D / 2 + (i / k) * D]);
  for (let i = n - 1; i >= 0; i--) pts.push([-L / 2 + (i / n) * L + j(i, 4) * 3, D / 2 + Math.abs(j(i, 5)) * D * 0.3]);
  for (let i = k - 1; i >= 1; i--) pts.push([-L / 2 - Math.abs(j(i, 6)) * 6, -D / 2 + (i / k) * D]);
  return flat(pts, 0, m);
}
function wisp(r: number, seed: number, m: THREE.Material): THREE.Mesh {
  const pts: [number, number][] = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, k = r * (0.65 + 0.45 * hash(i, seed)); pts.push([Math.cos(a) * k * 1.5, Math.sin(a) * k]); }
  return flat(pts, 0, m);
}

// ---------------------------------------------------------------- the gate
/** One gate pier: a stepped ashlar buttress `w` ft square and `h` ft high (the pier-top level's slab caps it at h, the
 *  pyramid finial rises above). Local +x is outside (east): that face is chalk-white where the Mists stand against it,
 *  with the tide-line 10 to 12 ft up; the west face is green with moss. `s` (+1/-1) says which side (local z) the road
 *  is on: the pintle plates and the hinge pin sit on that inner corner's west edge, rust streaking down beneath them.
 *  Stepped buttresses lean on the east and west faces. `litter` 1 strews raven pellets and a feather on the cap;
 *  `marks` 1 leaves the moss off the outer west corner where the notice spike and tally are. */
export function gatePier(d: Dims): THREE.Group {
  const w = d.w ?? 12, h = d.h ?? 34, s = d.s ?? 1, hw = w / 2, g = grp();
  g.add(box(w + 1.6, 3, w + 1.6, C.ashlarDeep, 0, 1.5, 0), box(w, h - 7, w, C.ashlar, 0, 3 + (h - 7) / 2, 0), box(w + 1, 1, w + 1, C.ashlarDeep, 0, h - 3.5, 0));
  g.add(box(w, 2.4, w, C.ashlar, 0, h - 1.8, 0), box(w + 1.4, 0.6, w + 1.4, C.ashlarDeep, 0, h - 0.6, 0));
  const cap = cone(w * 0.36, 3, C.ashlarDeep, 0, h + 1.5, 0, 4); cap.rotation.y = Math.PI / 4; g.add(cap, box(w * 0.5, 0.5, w * 0.5, C.ashlarDeep, 0, h + 0.25, 0));
  // the east face: chalk below the tide-line, a sharp pale line at it, grey fading above
  g.add(box(0.2, 8.6, w + 0.1, C.chalk, hw + 0.05, 7.3, 0), box(0.24, 2, w + 0.14, C.tide, hw + 0.07, 11.9, 0), box(0.2, 1.4, w + 0.1, C.chalkDeep, hw + 0.05, 13.6, 0), box(0.16, 5, w + 0.08, C.paleGrey, hw + 0.03, 16.8, 0));
  // the west face: furred green over most of it, streaks running down from the cap, heaviest and darkest at the foot;
  // all flush layers a hair proud of the stone. `marks` leaves a scraped bare window where the spike and tally are.
  const WX = -hw, bare = (z: number) => !!d.marks && -s * z > 2.3;
  const n = 8, sw = w / n;
  g.add(box(0.08, 3, w + 1.62, C.mossDeep, -hw - 0.84, 1.5, 0), box(0.9, 0.08, w + 1.62, C.mossMid, -hw - 0.4, 3.04, 0)); // the plinth's west face and ledge
  for (let i = 0; i < n; i++) {
    const z = -hw + (i + 0.5) * sw, low = bare(z) ? 8.2 : 3;
    const midTop = h * (0.5 + hash(i, s + 3) * 0.22), footTop = 9 + hash(i, s + 4) * 5;
    g.add(box(0.06, midTop - low, sw + 0.02, i % 3 === 1 ? C.mossMid : C.moss, WX - 0.03, (low + midTop) / 2, z));
    if (footTop > low) g.add(box(0.06, footTop - low, sw * (0.86 + hash(i, s + 5) * 0.14), C.mossDeep, WX - 0.07, (low + footTop) / 2, z));
    // a streak from under the cornice down toward the green below it
    const sl = 5 + hash(i, s + 6) * 9, sy = h - 4.1 - sl / 2;
    g.add(box(0.06, sl, sw * (0.62 + hash(i, s + 7) * 0.4), i % 2 ? C.mossLit : C.lichen, WX - 0.05, sy, z + (hash(i, s + 8) - 0.5) * sw * 0.3));
  }
  g.add(box(0.08, 1, w + 1.02, C.mossMid, -hw - 0.54, h - 3.5, 0), box(0.08, 0.6, w + 1.42, C.mossLit, -hw - 0.74, h - 0.6, 0)); // green on the cornice and cap lips
  for (let k = 0; k < 5; k++) g.add(box(0.06, 0.8 + hash(k, 3) * 1.6, 0.8 + hash(k, 4) * 1.2, C.lichen, WX - 0.09, 9 + hash(k, 5) * 14, (hash(k, 6) - 0.5) * (w - 3)));
  // moss creeping round the outer (non-road) face near the west corner, flush
  g.add(box(3.2, 9, 0.06, C.moss, -hw + 1.6, 7.5, -s * (hw + 0.03)), box(1.8, 5, 0.06, C.mossDeep, -hw + 0.9, 5.5, -s * (hw + 0.07)), box(1.4, 6, 0.06, C.mossMid, -hw + 0.7, 15, -s * (hw + 0.05)));
  // stepped buttresses on the road faces (east and west), their tops sloping back to the pier
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const bh = h * (0.62 - k * 0.18), bd = 2.4, bw = w * 0.36 - k * 0.5, x = sx * (hw + bd / 2 + k * bd), col = sx > 0 ? (k % 2 ? C.chalk : C.chalkDeep) : (k % 2 ? C.mossStone : C.mossStoneDeep);
    g.add(box(bd, bh, bw, col, x, bh / 2, 0));
    const slope = box(bd + 0.3, 1.2, bw + 0.2, sx > 0 ? C.ashlarDeep : C.mossLit, x + sx * 0.1, bh + 0.3, 0); slope.rotation.z = sx * 0.55; g.add(slope);
    if (sx < 0) {
      // the step's own west face: green to two-thirds up, darkest at the foot; its sides mossed low down
      const ft = Math.min(bh * 0.35, 6);
      g.add(box(0.06, bh * 0.68, bw + 0.02, C.moss, x - bd / 2 - 0.03, bh * 0.34, 0), box(0.06, ft, bw + 0.06, C.mossDeep, x - bd / 2 - 0.07, ft / 2, 0));
      for (const zz of [-1, 1]) g.add(box(bd + 0.02, bh * 0.4, 0.06, C.mossMid, x, bh * 0.2, zz * (bw / 2 + 0.03)));
    }
  }
  // the pintle plates on the inner west corner: shield-sized iron on both faces, the pin, rust streaking down
  for (const y of [5, 15]) {
    g.add(box(3, 3.4, 0.3, C.iron, -hw + 1.9, y, s * (hw + 0.1)), box(0.3, 3.4, 3, C.iron, -hw - 0.1, y, s * (hw - 1.9)));
    g.add(cyl(0.4, 0.4, 1.6, C.ironPale, -hw - 0.35, y + 0.6, s * (hw + 0.35), 8), cyl(0.5, 0.5, 0.4, C.rust, -hw - 0.35, y - 0.3, s * (hw + 0.35), 8));
    for (let k = 0; k < 5; k++) g.add(box(0.5, 0.5, 0.36, C.rustPale, -hw + 0.8 + k * 0.55, y + (k % 2 ? 1.2 : -1.2), s * (hw + 0.14)));
    g.add(box(1.6, y - 1.9, 0.12, C.rust, -hw + 1.9, (y - 1.9) / 2 + 0.2, s * (hw + 0.2)), box(0.12, y - 1.9, 1.6, C.rust, -hw - 0.2, (y - 1.9) / 2 + 0.2, s * (hw - 1.9)));
  }
  // weeds at the foot, away from the road
  g.add(weedTuft(hw + 2.4, -s * (hw + 1.6), 1.1, 3), weedTuft(-hw - 2.6, -s * (hw + 2), 1.2, 5), weedTuft(0.6, -s * (hw + 2.4), 0.9, 7));
  if (d.litter) {
    for (let k = 0; k < 7; k++) g.add(box(0.3, 0.12, 0.2, k % 2 ? C.parchment : C.tally, (hash(k, 40) - 0.5) * (w - 2), h + 0.06, (hash(k, 41) - 0.5) * (w - 2), hash(k, 42) * 3));
    const f = box(0.9, 0.04, 0.22, C.raven, 2.2, h + 0.05, -s * 2.6); f.rotation.y = 0.7; g.add(f);
  }
  return g;
}
/** One iron gate leaf `w` ft wide and `h` ft high, hung from its hinge at the origin and built along local +x: rusted
 *  bars with spiked heads, four crossbars (the second at a rider's height), stiles, a diagonal brace, a ring of
 *  scrollwork, dew dripping from the bottom rail and hinge knuckles at the pin. No lock, bar or chain anywhere. */
export function gateLeaf(d: Dims): THREE.Group {
  const w = d.w ?? 13, h = d.h ?? 20, g = grp(), n = Math.max(6, Math.round(w / 0.9));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (w / n), bh = h - 0.5;
    g.add(box(0.26, bh, 0.26, i % 3 === 1 ? C.rust : C.iron, x, bh / 2, 0), cone(0.24, 0.9, i % 4 === 2 ? C.rustPale : C.iron, x, bh + 0.45, 0, 4));
  }
  for (const y of [0.9, 8, 14, h - 0.9]) g.add(box(w, 0.36, 0.42, C.iron, w / 2, y, 0));
  g.add(box(0.7, h, 0.55, C.iron, 0.35, h / 2, 0), box(0.45, h - 0.4, 0.45, C.iron, w - 0.25, (h - 0.4) / 2, 0));
  const brace = box(0.2, Math.hypot(w - 1.5, 6) , 0.2, C.rust, w / 2, 11, 0.12); brace.rotation.z = Math.atan2(w - 1.5, 6); g.add(brace);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(1.7, w * 0.15), 0.12, 5, 14), mat(C.iron)); ring.position.set(w / 2, h * 0.76, 0); g.add(ring);
  for (const y of [5, 15]) g.add(cyl(0.5, 0.5, 1.4, C.rust, 0, y + 0.5, 0, 8));
  for (let k = 0; k < 6; k++) { const dr = cone(0.08, 0.32, C.dew, 1.2 + k * (w - 2) / 5, 0.55, 0.1, 4); dr.rotation.x = Math.PI; g.add(dr); }
  for (let k = 0; k < 4; k++) g.add(box(0.1, 0.3, 0.1, C.dew, 0.8 + k * (w - 1.6) / 3, 7.7, 0.22));
  return compact(g);
}
/** The threshold: a bed of worn flagstones `w` (across the road, local z) by `d` (along it, local x), the only paving
 *  on the map; two quarter-circle grooves of radius `r` polished into it by the leaves' bottom bars, swung west (-x)
 *  from the hinge corners at local (`hx`, ±w/2); a crescent of mud scraped clean beyond each groove's end. */
export function thresholdSill(d: Dims): THREE.Group {
  const w = d.w ?? 26, dd = d.d ?? 18, r = d.r ?? 12.5, hx = d.hx ?? dd / 2 - 2, g = grp();
  const edge: [number, number][] = [];
  for (let i = 0; i <= 8; i++) edge.push([-dd / 2 + (i / 8) * dd, -w / 2 - hash(i, 1) * 0.8]);
  for (let i = 1; i <= 6; i++) edge.push([dd / 2 + hash(i, 2) * 0.6, -w / 2 + (i / 6) * w]);
  for (let i = 7; i >= 0; i--) edge.push([-dd / 2 + (i / 8) * dd, w / 2 + hash(i, 3) * 0.8]);
  for (let i = 5; i >= 1; i--) edge.push([-dd / 2 - hash(i, 4) * 0.6, -w / 2 + (i / 6) * w]);
  g.add(flat(edge, 0.16, C.flag));
  for (let k = 0; k < 9; k++) g.add(box(2 + hash(k, 5) * 1.6, 0.14, 1.6 + hash(k, 6), k % 2 ? C.flagDeep : C.flag, (hash(k, 7) - 0.5) * (dd - 4), 0.2, (hash(k, 8) - 0.5) * (w - 4), hash(k, 9) * 0.4));
  for (const s of [-1, 1]) {
    const cx = hx, cz = s * w / 2, m = 16;
    for (let i = 0; i < m; i++) {
      const t0 = (i / m) * Math.PI / 2, t1 = ((i + 1) / m) * Math.PI / 2, p = (t: number) => [cx - Math.sin(t) * r, cz - s * Math.cos(t) * r] as const;
      const [x0, z0] = p(t0), [x1, z1] = p(t1), L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
      g.add(box(L + 0.1, 0.1, 0.5, C.groove, (x0 + x1) / 2, 0.23, (z0 + z1) / 2, ry), box(L + 0.1, 0.1, 0.16, C.polish, (x0 + x1) / 2, 0.26, (z0 + z1) / 2 - s * 0.32, ry));
    }
    // the mud crescent beyond the flags where the leaf's end sweeps round
    const cres: [number, number][] = [];
    for (let i = 0; i <= 10; i++) { const t = (0.45 + 0.55 * i / 10) * Math.PI / 2; cres.push([cx - Math.sin(t) * (r + 2.2), cz - s * Math.cos(t) * (r + 2.2)]); }
    for (let i = 10; i >= 0; i--) { const t = (0.45 + 0.55 * i / 10) * Math.PI / 2; cres.push([cx - Math.sin(t) * (r - 1.2), cz - s * Math.cos(t) * (r - 1.2)]); }
    g.add(flat(cres, 0.13, C.mudWet));
  }
  return g;
}
/** A dry-stone boundary wall `h` ft high running `len` ft along local +x from the pier end (x = 0), whole at that end
 *  and sinking into a black-mossed rubble line toward the far end, trunks of the forest grown through its fall. */
export function boundaryWall(d: Dims): THREE.Group {
  const L = d.len ?? 40, H = d.h ?? 6, T = 2.2, sd = d.seed ?? 0, g = grp(), n = Math.max(4, Math.round(L / 1.7)), sw = L / n, COL = [C.fieldStone, C.fieldPale, '#6a665f'];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * sw, f = x / L, top = H * Math.max(0.12, (1 - Math.pow(f, 1.7)) * (0.92 + hash(i, sd) * 0.16)) * (f > 0.55 && hash(i, sd + 1) < 0.5 ? 0.35 : 1);
    let y = 0, c = 0;
    while (y < top - 0.15) {
      const sh = Math.min(top - y, 0.6 + hash(i * 7 + c, sd + 3) * 0.4);
      g.add(box(sw * (0.94 + hash(c, i) * 0.08), sh * 0.96, T * (0.95 - 0.06 * c), COL[(i + c) % 3], x + (hash(c, i + sd) - 0.5) * 0.2, y + sh / 2, (hash(i, c + sd) - 0.5) * 0.25, (hash(i + c, sd) - 0.5) * 0.14));
      y += sh; c++;
    }
    if (f < 0.4) g.add(box(sw * 1.02, 0.32, T * 0.8, COL[(i + 1) % 3], x, y + 0.16, 0));
    if (f > 0.3) for (const s of [-1, 1]) if (hash(i, s + sd) > 0.35) g.add(place(lump(0.45 + hash(i, s + 5) * 0.5, COL[i % 3], i * 3 + s, 1.3, 0.6, 1, 0, 'stone'), x + (hash(i, s) - 0.5) * 1.2, 0.25, s * (T / 2 + 0.5 + hash(i, s + 2) * 1.6)));
    if (f > 0.35 && i % 2 === 0) g.add(place(lump(0.5 + hash(i, 12) * 0.5, C.blackMoss, i + 50, 1.5, 0.45, 1.2, 0), x, y + 0.2, (hash(i, 13) - 0.5) * 1.4));
  }
  g.add(sapling(L * 0.74, 0.3, 7, sd), sapling(L * 0.9, -1.1, 5, sd + 1));
  for (let k = 0; k < 4; k++) g.add(weedTuft(L * (0.45 + k * 0.14), (k % 2 ? 1 : -1) * (T / 2 + 0.9), 1, k + sd));
  return g;
}
/** A horizontal bleach band `w` wide at `h` ft up a surface (local z faces out of the surface): a pale chalky stain
 *  with a sharp top edge and a softer foot, for statue backs where the Mists usually stand. */
export function fogTideline(d: Dims): THREE.Group {
  const w = d.w ?? 4, h = d.h ?? 11, g = grp(box(w, 1.6, 0.1, C.tide, 0, h, 0.05), box(w * 0.92, 1.2, 0.08, C.chalk, 0, h - 1.3, 0.04), box(w * 0.8, 1.0, 0.06, C.chalkDeep, 0, h - 2.3, 0.03));
  return g;
}
/** A wall-face decal (local +z faces out of the wall, origin at its foot): a rusted notice spike at shoulder height
 *  with a rust tear below and pulped parchment at its foot; columns of scratched tally strokes beside it, the newest
 *  column still pale; a bangle and a knot of faded ribbon wedged in the joints. */
export function pierMarks(): THREE.Group {
  const g = grp(box(0.14, 0.14, 1.1, C.rust, 0.85, 4.6, 0.5), cyl(0.22, 0.22, 0.1, C.rustPale, 0.85, 4.6, 1.05, 6), box(0.5, 3.6, 0.06, C.rust, 0.85, 2.6, 0.03));
  g.children[1].rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) g.add(box(0.6 + hash(k, 1) * 0.4, 0.06, 0.4 + hash(k, 2) * 0.4, C.parchment, 0.5 + (hash(k, 3) - 0.5) * 1.2, 0.04 + k * 0.03, 0.5 + hash(k, 4) * 0.6, hash(k, 5) * 1.5));
  for (let col = 0; col < 4; col++) for (let row = 0; row < 11; row++) {
    const newest = col === 3 && row > 6;
    g.add(box(0.06, 0.42, 0.04, newest ? C.tallyNew : C.tally, -1.9 + col * 0.5 + (row % 5) * 0.08, 1.6 + row * 0.42, 0.02));
    if (row % 5 === 4) { const bar = box(0.45, 0.05, 0.04, newest ? C.tallyNew : C.tally, -1.74 + col * 0.5, 1.6 + row * 0.42, 0.025); bar.rotation.z = 0.5; g.add(bar); }
  }
  const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 5, 10), mat(C.brass)); place(bangle, 0.2, 3.3, 0.12, 0, 0.3); g.add(bangle);
  const rib = box(0.16, 1.3, 0.05, C.clothRed, -1.4, 6.6, 0.06); rib.rotation.z = 0.12; g.add(rib, box(0.4, 0.2, 0.08, C.clothRed, -1.4, 7.25, 0.07));
  return g;
}
/** Vistani favours on a bar: `n` strips of faded cloth, a small brass bell and a horse-tassel tied along local x,
 *  hanging limp and wet from the origin's height. */
export function vistaniFavours(d: Dims): THREE.Group {
  const n = d.n ?? 6, L = d.len ?? 6, g = grp(), COL = [C.clothRed, C.clothGold, C.clothBlue, C.clothPale, C.clothGreen];
  for (let i = 0; i < n; i++) { const st = box(0.42, 1.2 + hash(i, 1) * 0.8, 0.07, COL[i % COL.length], -L / 2 + (i + 0.5) * (L / n), -0.75 - hash(i, 1) * 0.4, 0.3); st.rotation.z = (hash(i, 2) - 0.5) * 0.3; g.add(st, box(0.5, 0.25, 0.5, COL[i % COL.length], st.position.x, 0, 0)); }
  g.add(cyl(0.22, 0.3, 0.4, C.brass, L / 2 - 0.4, -0.5, 0.3, 7), place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(C.brass)), L / 2 - 0.4, -0.78, 0.3));
  g.add(cone(0.22, 1.1, C.tassel, -L / 2 + 0.3, -0.9, 0.3, 6).rotateX(Math.PI), box(0.3, 0.2, 0.3, C.brass, -L / 2 + 0.3, -0.25, 0.3));
  return g;
}
/** A row of `n` ravens perched along `len` ft of rail (local x, at y 0), all turned the same way (`face` degrees
 *  from +x about y), silent. */
export function ravenRow(d: Dims): THREE.Group {
  const n = d.n ?? 12, L = d.len ?? 26, face = ((d.face ?? 0) * Math.PI) / 180, g = grp();
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n) + (hash(i, 1) - 0.5) * 0.6, b = grp();
    b.add(place(lump(0.42, C.raven, i, 1.7, 0.95, 0.85, 0), 0, 0.5, 0), place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(C.ravenSheen)), 0.62, 0.86, 0), cone(0.08, 0.4, C.beak, 0.95, 0.86, 0, 4).rotateZ(-Math.PI / 2));
    b.add(box(0.7, 0.08, 0.3, C.raven, -0.75, 0.42, 0), box(0.1, 0.3, 0.1, C.beak, 0.15, 0.15, 0.1), box(0.1, 0.3, 0.1, C.beak, 0.15, 0.15, -0.1));
    b.rotation.y = face + (hash(i, 2) - 0.5) * 0.4; b.position.x = x; g.add(b);
  }
  return g;
}
/** A guardian's fallen helmeted head in a knee-high weed bed `w` ft across, in the shallow mud hollow its weight made,
 *  earth rolled up on the side it struck. `v` 0 lies face-up (rain pooled in the eye sockets), 1 face-down. */
export function fallenHeadPit(d: Dims): THREE.Group {
  const w = d.w ?? 8, v = d.v ?? 0, g = grp(flat(blobPts(2.3, 3, 1.2), 0.1, C.mudWet));
  for (let k = 0; k < 5; k++) g.add(place(lump(0.5 + hash(k, 1) * 0.4, C.mud, k + 7, 1.4, 0.5, 1, 0), -2.2 + k * 0.9, 0.22, 2.1 + (hash(k, 2) - 0.5) * 0.8));
  const S = C.statue, SD = C.ashlarDeep;
  if (v === 0) {
    const head = place(lump(1.05, S, 21, 1, 0.95, 1.05, 1), 0, 0.75, 0, 0.3, -1.25); g.add(head);
    g.add(cyl(1.15, 1.1, 0.55, SD, 0, 0.55, -0.7, 9).rotateX(-0.3), box(0.3, 0.3, 1.7, SD, 0, 1.0, -0.9));
    for (const x of [-0.42, 0.42]) g.add(box(0.36, 0.14, 0.3, C.groove, x, 1.62, 0.35), box(0.3, 0.05, 0.24, C.glint, x, 1.7, 0.35));
    g.add(box(0.26, 0.4, 0.3, S, 0, 1.6, 0.0));
  } else {
    const head = place(lump(1.05, S, 23, 1, 1, 1.05, 1), 0, 0.7, 0, 0.5, 1.4, 0.3); g.add(head);
    g.add(cyl(1.15, 1.08, 0.6, SD, 0, 1.15, -0.1, 9), box(0.3, 1.7, 0.3, SD, 0, 1.75, -0.2));
  }
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = w / 2 * (0.62 + hash(k, 4) * 0.35); g.add(weedTuft(Math.cos(a) * rr, Math.sin(a) * rr, 1.2 + hash(k, 5) * 0.6, k + 11)); }
  return g;
}
/** A lost trinket among the weeds: a tarnished brass ring on a scrap of faded cord. */
export function trinket(): THREE.Group {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 5, 10), mat(C.brass)); place(ring, 0, 0.12, 0, 0, Math.PI / 2);
  return grp(ring, box(0.08, 0.04, 0.9, C.clothRed, 0.3, 0.08, 0.2, 0.6));
}

// ---------------------------------------------------------------- the road
/** Paired wagon ruts `len` ft long (local x) and `gauge` ft apart cut into the mud, water glinting in the deepest
 *  hollows, a low crown of churned mud between them. Laid end to end in short segments along a bending road. */
export function wheelRuts(d: Dims): THREE.Group {
  const L = d.len ?? 25, gauge = d.gauge ?? 5, sd = d.seed ?? 0, g = grp();
  for (const s of [-1, 1]) {
    g.add(box(L, 0.12, 0.95, C.mudWet, 0, 0.1, s * gauge / 2));
    for (let k = 0; k < 2; k++) if (hash(k, sd + s) > 0.35) g.add(box(1.4 + hash(k, sd) * 2.2, 0.03, 0.5, C.glint, (hash(k, sd + s + 3) - 0.5) * (L - 4), 0.17, s * gauge / 2 + (hash(k, 9) - 0.5) * 0.2));
    for (let k = 0; k < 3; k++) g.add(place(lump(0.28, C.mud, k + sd, 1.6, 0.5, 1, 0), (hash(k, sd + s + 7) - 0.5) * L, 0.12, s * (gauge / 2 + 0.75)));
  }
  g.add(box(L * 0.9, 0.06, 1.2, C.mud, 0, 0.1, 0));
  return g;
}
/** A mirror-dark standing pool in a wheel hollow, `len` by `w` ft, dead flat, a churned mud rim round it, the
 *  surface near-black with one faint grey reflection and nothing else. */
export function blackPool(d: Dims): THREE.Group {
  const L = d.len ?? 10, W = d.w ?? 4.5, sd = d.seed ?? 0, g = grp(flat(blobPts(W / 2 + 0.9, sd, L / W, 11), 0.11, C.mudWet), flat(blobPts(W / 2, sd + 1, L / W, 11), 0.15, C.pool));
  g.add(box(L * 0.35, 0.02, 0.35, C.glint, -L * 0.1, 0.17, -W * 0.14, 0.08));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + hash(k, sd); g.add(place(lump(0.3 + hash(k, sd + 2) * 0.3, C.mud, k + sd, 1.5, 0.5, 1, 0), Math.cos(a) * (L / 2 + 0.6), 0.14, Math.sin(a) * (W / 2 + 0.6))); }
  return g;
}
/** A corduroy causeway: `len` ft of road (local x) laid on half-rotten logs set side by side across a black bog
 *  `w` ft wide, the wagon ruts chewed into their tops; the culvert under it silted shut, so a black pool `poolLen` ft
 *  long has backed up on the uphill side (local +z) and a thin seep crosses the logs and runs off to -z. */
export function corduroy(d: Dims): THREE.Group {
  const L = d.len ?? 30, W = d.w ?? 22, PL = d.poolLen ?? 30, g = grp(), n = Math.round(L / 1.15), COL = [C.logRot, C.logPale, '#43362a'];
  g.add(flat(blobPts(W / 2 + 4, 2, (L + 10) / W, 12), 0.09, C.bog));
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n), r = 0.5 + hash(i, 1) * 0.12, lg = cyl(r, r, W * (0.96 + hash(i, 2) * 0.06), COL[i % 3], x, r * 0.9, (hash(i, 3) - 0.5) * 0.8, 7); lg.rotation.x = Math.PI / 2; lg.rotation.z = (hash(i, 4) - 0.5) * 0.05; g.add(lg);
    if (hash(i, 5) > 0.72) g.add(place(lump(0.4, C.blackMoss, i, 1.3, 0.4, 1.6, 0), x, r * 1.75, (hash(i, 6) - 0.5) * W * 0.7));
  }
  for (const s of [-1, 1]) g.add(box(L, 0.1, 0.9, C.mudWet, 0, 1.12, s * 2.5), box(L * 0.4, 0.03, 0.4, C.glint, (hash(1, s) - 0.5) * L * 0.5, 1.18, s * 2.5));
  // the backed-up pool uphill of the logs, a silted culvert mouth at its edge
  g.add(flat(blobPts(PL / 2, 7, 0.55, 12).map(([x, z]) => [z * 0.95 - 2, x + W / 2 + PL * 0.42] as [number, number]), 0.14, C.pool));
  g.add(flat(blobPts(PL / 2 + 1.5, 8, 0.55, 12).map(([x, z]) => [z * 0.95 - 2, x + W / 2 + PL * 0.42] as [number, number]), 0.11, C.mudWet));
  g.add(box(2.6, 1.4, 0.8, C.fieldStone, -2, 0.6, W / 2 + 0.2), box(0.8, 1.2, 0.6, C.fieldStone, -3.4, 0.6, W / 2 + 0.4), box(0.8, 1.2, 0.6, C.fieldStone, -0.6, 0.6, W / 2 + 0.4), box(1.2, 0.6, 0.5, C.mudWet, -2, 0.35, W / 2 + 0.65));
  // the seep across the logs and away into the trees
  g.add(box(1.0, 0.04, W + 1, C.seep, 1.7, 1.2, 0));
  const seep: [number, number][] = [];
  for (let i = 0; i <= 8; i++) seep.push([1.7 + Math.sin(i * 1.3) * 1.2 - 0.6, -W / 2 - (i / 8) * 20]);
  for (let i = 8; i >= 0; i--) seep.push([1.7 + Math.sin(i * 1.3) * 1.2 + 0.6, -W / 2 - (i / 8) * 20]);
  g.add(flat(seep, 0.12, C.seep));
  for (let k = 0; k < 8; k++) g.add(weedTuft((hash(k, 20) - 0.5) * (L + 6), (k % 2 ? 1 : -1) * (W / 2 + 1 + hash(k, 21) * 3), 1.1, k + 30));
  return g;
}
/** A trail of dire-wolf paw prints pressed into mud `len` ft long (local +x), two or three animals abreast, bending
 *  by `bend` ft to the side over its length. */
export function pawPrints(d: Dims): THREE.Group {
  const L = d.len ?? 60, bend = d.bend ?? 0, sd = d.seed ?? 0, g = grp(), rows = Math.max(3, Math.round(L / 2.8));
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1), x = -L / 2 + t * L, zc = bend * Math.sin(t * Math.PI) ;
    for (const lane of [-1.7, 0, 1.7]) {
      if (lane !== 0 && hash(i, sd + lane) < 0.25) continue;
      const z = zc + lane + (hash(i, sd + 4) - 0.5) * 0.5, px = x + (lane === 0 ? 1.1 : 0), pad = cyl(0.44, 0.48, 0.1, C.mudWet, px, 0.1, z, 6); pad.scale.z = 0.8; g.add(pad);
      for (let k = 0; k < 4; k++) g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(C.mudWet)), px + 0.62, 0.08, z - 0.55 + k * 0.37));
    }
  }
  return g;
}
/** Knee-high mossed footing walls of a small gate-keeper's lodge `w` by `d` ft: a door gap on the +z side with its
 *  rotten sill, a collapsed hearth stack at the -z end with a sapling growing out of it, a fallen lintel inside. */
export function lodgeFootings(d: Dims): THREE.Group {
  const W = d.w ?? 20, D = d.d ?? 16, T = 1.6, g = grp(), COL = [C.fieldStone, C.fieldPale, '#6a665f'];
  const run = (x0: number, z0: number, x1: number, z1: number, seed: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 1.8)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, hh = 1.6 + hash(i, seed) * 0.9;
      g.add(box(L / n * 0.98, hh, T, COL[(i + seed) % 3], x, hh / 2, z, ry));
      if (hash(i, seed + 2) > 0.5) g.add(place(lump(0.5, C.moss, i + seed, 1.6, 0.4, 1.2, 0), x, hh + 0.05, z, ry));
    }
  };
  const hw = W / 2, hd = D / 2;
  run(-hw, -hd, hw, -hd, 1); run(hw, -hd, hw, hd, 2); run(-hw, hd, -hw, -hd, 3);
  run(hw, hd, 2.6, hd, 4); run(-2.6, hd, -hw, hd, 5);
  g.add(box(5, 0.3, 1.2, C.logRot, 0, 0.15, hd), box(1.2, 0.3, 1.0, C.logPale, 1.4, 0.15, hd + 0.1));
  // the hearth stack: a stub of chimney against the north wall, its top fallen, a sapling in the hearth
  g.add(box(6, 4.2, 2.6, C.fieldStone, 0, 2.1, -hd - 0.4), box(4.4, 1.2, 2.2, C.fieldPale, 0.6, 4.8, -hd - 0.5), box(3, 2, 1.4, '#2a2622', 0, 1, -hd + 0.9));
  for (let k = 0; k < 4; k++) g.add(place(lump(0.5 + hash(k, 6) * 0.5, COL[k % 3], k + 40, 1.3, 0.6, 1, 0, 'stone'), -3.5 + k * 2.2, 0.3, -hd + 2.4 + hash(k, 7)));
  g.add(sapling(0.4, -hd + 1.2, 9, 3));
  const lintel = box(5.5, 0.9, 0.9, C.fieldPale, 1.5, 0.5, 2.2); lintel.rotation.y = 0.55; lintel.rotation.z = 0.08; g.add(lintel);
  g.add(place(lump(0.6, C.moss, 44, 1.6, 0.4, 1.2, 0), 1.5, 1.0, 2.2));
  for (let k = 0; k < 6; k++) g.add(weedTuft((hash(k, 30) - 0.5) * (W - 3), (hash(k, 31) - 0.5) * (D - 3), 1 + hash(k, 32) * 0.5, k + 60));
  for (let k = 0; k < 5; k++) g.add(weedTuft(-hw - 1.5 + hash(k, 33) * (W + 3), (k % 2 ? 1 : -1) * (hd + 1.4), 1.1, k + 70));
  return g;
}

// ---------------------------------------------------------------- the cutting, the dead pines, the Mists
/** A cragged rock bank `len` ft long (local x) and `h` ft high whose face looks toward local +z: faceted rock masses
 *  along the face, loose scree at its foot, broken rock on its lip. The level's prism carries the bank's bulk. */
export function cragBank(d: Dims): THREE.Group {
  const L = d.len ?? 60, H = d.h ?? 14, sd = d.seed ?? 0, g = grp(), n = Math.max(3, Math.round(L / 7)), COL = [C.rock, C.rockDeep, C.scree];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n), hh = H * (0.7 + hash(i, sd) * 0.45), r = 3 + hash(i, sd + 1) * 1.5;
    g.add(place(lump(r * 1.15, COL[i % 3], sd * 11 + i, 1.15, hh / r / 2.3, 0.8, 1, 'rock'), x, hh * 0.46, 0.9 + hash(i, sd + 2) * 1.4, hash(i, sd + 3) * 2));
    if (i % 2 === 0) g.add(place(lump(1.6 + hash(i, sd + 4), COL[(i + 1) % 3], sd * 7 + i, 1.3, 0.6, 1, 0, 'rock'), x + 2, H - 0.3, -3 - hash(i, sd + 5) * 3));
    for (let k = 0; k < 3; k++) g.add(place(lump(0.4 + hash(i * 3 + k, sd + 6) * 0.8, C.scree, i * 5 + k, 1.3, 0.6, 1, 0, 'rock'), x + (hash(k, i) - 0.5) * (L / n), 0.2, 2.6 + hash(k, i + 1) * 3));
  }
  return g;
}
/** A standing dead pine `h` ft tall: bark peeled in strips, limbs bare and broken, grey as the stone; `tide` 1
 *  bleaches a band 10 to 12 ft up where the Mists usually stand. */
export function deadPine(d: Dims): THREE.Group {
  const h = d.h ?? 30, sd = d.seed ?? 0, g = grp(cyl(0.32, 0.85, h, C.deadBark, 0, h / 2, 0, 7));
  for (let k = 0; k < 4; k++) { const st = box(0.12, 3 + hash(k, sd) * 6, 0.55, k % 2 ? C.deadPale : C.deadHeart, 0, 3 + hash(k, sd + 1) * (h - 10), 0, hash(k, sd + 2) * 6); st.position.x = Math.cos(hash(k, sd + 2) * 6) * 0.72; st.position.z = -Math.sin(hash(k, sd + 2) * 6) * 0.72; st.rotation.y = hash(k, sd + 2) * 6; g.add(st); }
  for (let k = 0; k < 7; k++) {
    const a = k * 1.9 + sd, y = h * (0.3 + k * 0.095), L = (h * 0.16) * (0.4 + hash(k, sd + 3) * 0.8), limb = grp(); limb.position.set(0, y, 0); limb.rotation.set(0, a, -(0.9 + (k % 3) * 0.25));
    limb.add(box(0.22, L, 0.22, k % 2 ? C.deadBark : C.deadPale, 0, L / 2, 0));
    if (hash(k, sd + 4) > 0.5) { const sn = box(0.14, L * 0.4, 0.14, C.deadPale, 0, L, 0); sn.rotation.z = 1.1; limb.add(sn); }
    g.add(limb);
  }
  const top = box(0.25, h * 0.12, 0.25, C.deadPale, 0.2, h + h * 0.05, 0); top.rotation.z = 0.4; g.add(top, cone(0.5, 1.2, C.deadHeart, 0, h + 0.3, 0, 4));
  if (d.tide) g.add(cyl(0.62, 0.68, 2.2, C.tide, 0, 11, 0, 7), cyl(0.68, 0.76, 1.2, C.chalkDeep, 0, 9.4, 0, 7));
  g.rotation.z = (hash(1, sd) - 0.5) * 0.08; g.rotation.x = (hash(2, sd) - 0.5) * 0.08;
  return g;
}
/** The Mist bank: a wall of fog `len` ft long (local x), `h` high and `d` deep, built as stacked ragged layers that
 *  shrink toward the top, curtains across its depth, billows at its foot and wisps creeping out along the ground; one
 *  mesh per fog material, drawn after the grid so it veils the squares under it. */
export function mistBank(d: Dims): THREE.Group {
  const L = d.len ?? 150, H = d.h ?? 50, D = d.d ?? 100, g = grp(), nl = Math.max(3, Math.round(H / 5));
  for (let k = 0; k < nl; k++) {
    const t = (k + 0.5) / nl, sh = fogSheet(L * (1 - 0.15 * t), D * (1.02 - 0.5 * t), k * 7 + 3, fogMat(k % 2 ? C.mist1 : C.mist0, 0.24));
    sh.position.set((hash(k, 2) - 0.5) * 4, t * H * 0.95, (hash(k, 3) - 0.5) * D * 0.12); g.add(sh);
  }
  const nc = Math.max(2, Math.round(D / 18));
  for (let c = 0; c < nc; c++) {
    const pts = [new THREE.Vector2(-L / 2, 0), new THREE.Vector2(L / 2, 0)], m = Math.max(6, Math.round(L / 8));
    for (let i = m; i >= 0; i--) pts.push(new THREE.Vector2(-L / 2 + (i / m) * L, H * (0.55 + 0.5 * hash(i, c + 11))));
    const card = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), fogMat(C.mist1, 0.2)); card.position.z = -D / 2 + ((c + 0.5) / nc) * D; g.add(card);
  }
  const nb = Math.max(2, Math.round(L / 12));
  for (let i = 0; i < nb; i++) for (const s of [-1, 1]) {
    const r = Math.min(H * 0.45, 5 + hash(i, s + 5) * 5), b = lump(r, C.mist0, i * 2 + s, 1.5, 0.7, 1.1, 1); b.material = fogMat(C.mist0, 0.38);
    g.add(place(b, -L / 2 + (i + 0.5) * (L / nb), r * 0.4, s * D * 0.44, hash(i, 1) * 6));
  }
  const nw = Math.max(3, Math.round(L / 14));
  for (let i = 0; i < nw; i++) for (const s of [-1, 1]) g.add(place(wisp(6 + hash(i, s + 9) * 6, i * 3 + s, fogMat(C.mist0, 0.3)), -L / 2 + (i + 0.5) * (L / nw), 0.5 + hash(i, s) * 0.8, s * (D / 2 + 4 + hash(i, s + 4) * 8), hash(i, 2) * 3));
  return compact(g, 2);
}
/** A low tongue of fog `len` ft long lying on the ground along local +x, thick at the origin end and feathering to
 *  nothing: the Mists spilling out between the trunks onto the road. */
export function mistTongue(d: Dims): THREE.Group {
  const L = d.len ?? 40, W = d.w ?? 16, sd = d.seed ?? 0, g = grp();
  for (let i = 0; i < 5; i++) {
    const t = i / 4, r = W * 0.5 * (1 - 0.55 * t), w = wisp(r, sd * 5 + i, fogMat(i % 2 ? C.mist0 : C.mist1, i < 3 ? 0.34 : 0.16));
    g.add(place(w, t * L * 0.85, 0.4 + hash(i, sd) * 1.6, (hash(i, sd + 1) - 0.5) * W * 0.35, hash(i, sd + 2) * 2));
  }
  const b = lump(W * 0.3, C.mist0, sd + 40, 1.4, 0.5, 1, 1); b.material = fogMat(C.mist0, 0.4); g.add(place(b, 1, W * 0.1, 0));
  return compact(g, 2);
}

// ---------------------------------------------------------------- figures
/** A raven in its own feathers: a tiny black bird, head cocked, facing +x. The wereraven's raven form. */
export function raven(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.3, g = grp(place(lump(0.45 * s, C.raven, 3, 1.7, 0.95, 0.85, 0), 0, 0.5 * s, 0));
  g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 * s, 0), mat(C.ravenSheen)), 0.66 * s, 0.9 * s, 0), cone(0.09 * s, 0.45 * s, C.beak, 1.02 * s, 0.9 * s, 0, 4).rotateZ(-Math.PI / 2));
  g.add(box(0.75 * s, 0.08 * s, 0.32 * s, C.raven, -0.8 * s, 0.42 * s, 0), box(0.1 * s, 0.32 * s, 0.1 * s, C.beak, 0.15 * s, 0.16 * s, 0.12 * s), box(0.1 * s, 0.32 * s, 0.1 * s, C.beak, 0.15 * s, 0.16 * s, -0.12 * s));
  for (const z of [-1, 1]) { const w = box(0.9 * s, 0.1 * s, 0.4 * s, C.ravenSheen, -0.1 * s, 0.75 * s, z * 0.34 * s); w.rotation.x = z * 0.5; g.add(w); }
  return g;
}
/** A Vistani traveller: homespun in one faded colour, a sash of another, a headscarf; no blade drawn. `v` cycles the cloth. */
export function vistani(d: Dims): THREE.Group {
  const COL = [C.clothRed, C.clothGold, C.clothBlue, C.clothGreen, C.clothPale], v = d.v ?? 0, s = d.scale ?? 1;
  const g = humanoid({ skin: C.skin, cloth: COL[v % 5], trim: '#2b2420', hair: C.hair, weapon: 'none', skirt: v % 3 === 1, scale: s });
  const sash = box(0.3 * s, 2.2 * s, 0.2 * s, COL[(v + 2) % 5], 0.1 * s, 3.9 * s, 0.5 * s); sash.rotation.z = 0.5; g.add(sash);
  const scarf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46 * s, 1), mat(COL[(v + 2) % 5])); scarf.position.set(0, 5.9 * s, -0.05 * s); scarf.scale.set(1, 0.6, 1); g.add(scarf);
  return g;
}
/** A Vistani draft horse: the kit horse in a bay coat under a bright, faded blanket, bangles on the harness and a
 *  tassel at the brow. Faces +x. */
export function vistaniHorse(d: Dims): THREE.Group {
  const g = horse({ scale: (d.scale ?? 1) * 1.08 }), s = (d.scale ?? 1) * 1.08 * 1.75, COL = [C.clothRed, C.clothGold, C.clothBlue, C.clothGreen], v = d.v ?? 0;
  g.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; const hex = '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString(); if (hex === '#4a3a2e') m.material = mat(C.horseBay); else if (hex === '#2a2020') m.material = mat(C.horseDark); });
  g.add(box(2.4 * s, 0.25 * s, 1.95 * s, COL[v % 4], -0.2 * s, 4.05 * s, 0), box(2.5 * s, 0.12 * s, 0.3 * s, COL[v % 4], -0.2 * s, 4.2 * s, 0));
  g.add(box(0.5 * s, 0.9 * s, 1.1 * s, C.horseDark, 1.9 * s, 4.0 * s, 0).rotateZ(-0.6));
  for (let k = 0; k < 3; k++) g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 * s, 0), mat(C.tassel)), (1.5 + k * 0.3) * s, (4.25 - k * 0.1) * s, (k % 2 ? 1 : -1) * 0.9 * s));
  g.add(cone(0.16 * s, 0.7 * s, C.tassel, 3.1 * s, 5.2 * s, 0, 5).rotateX(Math.PI));
  return g;
}

/** The kit's Vistani vardo, one mesh per material: the hidden caravan draws in a few calls a wagon. */
export function vistaniVardo(d: Dims): THREE.Group { return compact(vardo(d) as THREE.Group); }

Object.assign(PROPS_V1, {
  'b-vardo': vistaniVardo, 'b-gate-pier': gatePier, 'b-gate-leaf': gateLeaf, 'b-threshold-sill': thresholdSill, 'b-boundary-wall': boundaryWall, 'b-fog-tideline': fogTideline,
  'b-pier-marks': () => pierMarks(), 'b-vistani-favours': vistaniFavours, 'b-raven-row': ravenRow, 'b-fallen-head-pit': fallenHeadPit, 'b-trinket': () => trinket(),
  'b-wheel-ruts': wheelRuts, 'b-black-pool': blackPool, 'b-corduroy': corduroy, 'b-paw-prints': pawPrints, 'b-lodge-footings': lodgeFootings,
  'b-crag-bank': cragBank, 'b-dead-pine': deadPine, 'b-mist-bank': mistBank, 'b-mist-tongue': mistTongue,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'b-raven': (d) => raven(d), 'b-vistani': (d) => vistani(d), 'b-vistani-horse': (d) => vistaniHorse(d) } as Record<string, (d: Dims) => THREE.Group>);
