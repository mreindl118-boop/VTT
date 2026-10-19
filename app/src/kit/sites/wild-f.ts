// Props and figures for one wilderness site of chapter 2: F, the River Ivlis Crossroads (its own file so each site is
// built on its own). Every kind registered here starts with 'f-' so it never collides with another site's. Built from
// THREE meshes with mat() so the world-space surface grain applies; new colours are declared with surfaceFor.
// Feet; origin at the floor centre; +z is plan south. The site's wind blows from the west, so everything that leans
// leans toward +x and every drift lies on the +x side of its obstacle.
import * as THREE from 'three';
import { PROPS_V1, pineTier } from '../props';
import { CREATURES, humanoid } from '../creatures';
import { mat } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { box, cylWith, grp, hash, lump, place, plate, tris } from '../shapes';
const cyl = cylWith(7);

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  rock: '#5c5a55', rockDeep: '#4c4a46', rockPale: '#6a675f', lichen: '#8a8f74', turf: '#44553f', turfPale: '#56634a',
  earth: '#5a4c3b', earthRaw: '#66563f', earthDark: '#2e2822', pit: '#1a1612', mud: '#4f4336', mudRidge: '#5d5042', puddle: '#1b2024',
  needle: '#4a3a26', needlePale: '#574531', gravel: '#6f6c64', gravelPale: '#8a877d',
  bark: '#3a2f27', barkPale: '#4d3f33', bough: '#2e4537', boughDeep: '#1f3128', yew: '#243528', yewDeep: '#1a271e', yewBark: '#27201c',
  timber: '#4f3f30', timberDeep: '#3e3226', timberGrey: '#6a6257', rope: '#8c7b5c', ropeGreen: '#6a7556', iron: '#2e2f33', rust: '#4a3329',
  bone: '#d9d0b8', ash: '#3a3a3c', soot: '#1c1b1d', stone: '#5f5b55',
  vSkin: '#c9a384', vCloth0: '#6a3a3a', vCloth1: '#3a4a5a', vCloth2: '#5a4a30', vCloth3: '#4a3a52', vTrim: '#2b2420', vHair: '#1f1a18', vScarf: '#8a5a2a',
  bat: '#231f24', batWing: '#2f2a30',
  // the ground: turf, the stony scrub of the windward slope, the needle floor under the woods, the damp hollow, scree
  gTurf: '#3d5241', gTurf2: '#42563f', gScrub: '#545a4b', gScrub2: '#4d5346', gForest: '#373a2d', gForest2: '#3c3d2f',
  gHollow: '#34463b', gEarth: '#4f4538', gKept: '#43573f', gScree: '#646159', gRock: '#5a5852', gRock2: '#4b4a49', gRock3: '#55534f',
  road: '#5a4c3b', roadMud: '#4b3f32', verge: '#4a4236',
} as const;
surfaceFor([C.rock, C.rockDeep, C.rockPale, C.gRock, C.gRock2, C.gRock3], 'rock');
surfaceFor([C.gTurf, C.gTurf2, C.gScrub, C.gScrub2, C.gHollow, C.gKept], 'grass');
surfaceFor([C.gForest, C.gForest2, C.gEarth, C.road, C.roadMud, C.verge], 'dirt');
surfaceFor([C.gScree], 'rock');
surfaceFor([C.stone], 'stone');
surfaceFor([C.turf, C.turfPale, C.lichen], 'grass');
surfaceFor([C.earth, C.earthRaw, C.earthDark, C.mud, C.mudRidge], 'dirt');
surfaceFor([C.pit, C.puddle, C.soot, C.ash, C.bone, C.bat, C.batWing, C.vSkin, C.vHair], 'none');
surfaceFor([C.needle, C.needlePale], 'thatch');
surfaceFor([C.gravel, C.gravelPale], 'cobble');
surfaceFor([C.bark, C.barkPale, C.yewBark], 'bark');
surfaceFor([C.bough, C.boughDeep, C.yew, C.yewDeep], 'foliage');
surfaceFor([C.timber, C.timberDeep, C.timberGrey], 'wood');
surfaceFor([C.rope, C.ropeGreen, C.vCloth0, C.vCloth1, C.vCloth2, C.vCloth3, C.vTrim, C.vScarf], 'cloth');
surfaceFor([C.iron, C.rust], 'metal');

// ---------------------------------------------------------------- helpers
/** A profile in the (x, y) plane extruded `len` along z, centred on z. */
function profile(pts: [number, number][], len: number, color: string): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2);
  return new THREE.Mesh(geo, mat(color));
}
/** A strip laid along local x on a slope: tilted `pitch` degrees (its +x end up) inside a group the scene turns. */
function pitched(inner: THREE.Group, pitch?: number): THREE.Group {
  if (pitch) inner.rotation.z = (pitch * Math.PI) / 180;
  return grp(inner);
}

// ---------------------------------------------------------------- the land
/** The ground of the crossroads: a lattice `nx` × `nz` of `cell` ft from the origin, heights packed four to a number
 *  (12 bits each, `q` ft per step) in d0.., and a ground class per vertex packed thirteen to a number (4 bits each) in
 *  c0..: 0 turf, 1 stony scrub, 2 needle floor under the woods, 3 damp hollow, 4 trodden earth, 5 the graveyard's kept
 *  turf. A face too steep for turf shows bedded rock, a middling one scree. The lattice's edge drops to the origin as a
 *  rock face (the land beyond the map is lower on the west). */
export function land(d: Dims): THREE.Group {
  const nx = Math.max(1, d.nx | 0), nz = Math.max(1, d.nz | 0), cell = d.cell ?? 5, q = d.q ?? 0.1, W = nx + 1, n = W * (nz + 1);
  const H = new Float32Array(n), K = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    H[k] = (Math.floor((d['d' + Math.floor(k / 4)] ?? 0) / Math.pow(4096, k % 4)) % 4096) * q;
    K[k] = Math.floor((d['c' + Math.floor(k / 13)] ?? 0) / Math.pow(16, k % 13)) % 16;
  }
  const PAL: string[][] = [[C.gTurf, C.gTurf2], [C.gScrub, C.gScrub2], [C.gForest, C.gForest2], [C.gHollow, C.gHollow], [C.gEarth, C.gEarth], [C.gKept, C.gKept]];
  const bins = new Map<string, number[]>();
  const push = (color: string, ...v: number[]) => { let a = bins.get(color); if (!a) { a = []; bins.set(color, a); } a.push(...v); };
  const P = (k: number): [number, number, number] => [(k % W) * cell, H[k], Math.floor(k / W) * cell];
  const tri = (a: number, b: number, c: number) => {
    let A = P(a), B = P(b), Cc = P(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
    let ny = uz * vx - ux * vz; const nxv = uy * vz - uz * vy, nzv = ux * vy - uy * vx;
    if (ny < 0) { const t = B; B = Cc; Cc = t; ny = -ny; }
    const k = ny / (Math.hypot(nxv, ny, nzv) || 1), x = (A[0] + B[0] + Cc[0]) / 3, y = (A[1] + B[1] + Cc[1]) / 3, z = (A[2] + B[2] + Cc[2]) / 3;
    const cls = K[b] === K[c] ? K[b] : K[a], tone = Math.sin(x * 0.043 + z * 0.017) + Math.cos(z * 0.051 - x * 0.012) > 0.3 ? 1 : 0;
    const band = ((Math.floor((y + 1.5 * Math.sin(x * 0.07) + Math.cos(z * 0.09)) / 2.2) % 3) + 3) % 3;
    const color = k < 0.66 ? [C.gRock, C.gRock2, C.gRock3][band] : k < 0.86 ? C.gScree : (PAL[cls] ?? PAL[0])[tone];
    push(color, ...A, ...B, ...Cc);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, e = a + W;
    if (Math.abs(H[a] - H[c]) < Math.abs(H[b] - H[e])) { tri(a, b, c); tri(a, c, e); } else { tri(a, b, e); tri(b, c, e); }
  }
  const edge = (a: number, b: number) => { const A = P(a), B = P(b); push(C.gRock2, A[0], A[1], A[2], B[0], B[1], B[2], B[0], 0, B[2], A[0], A[1], A[2], B[0], 0, B[2], A[0], 0, A[2]); };
  for (let i = 0; i < nx; i++) { edge(i, i + 1); edge(nz * W + i + 1, nz * W + i); }
  for (let j = 0; j < nz; j++) { edge((j + 1) * W, j * W); edge(j * W + nx, (j + 1) * W + nx); }
  const g = grp();
  for (const [color, v] of bins) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat(color)));
  }
  return g;
}

/** A road bed laid on the land through (x{i}, y{i}, z{i}), `w` ft wide: trodden earth (`c` 1: churned mud) a hand above
 *  the ground, a darker verge either side that frays into the turf, and sides dropping 2 ft so a bed across a slope
 *  never shows daylight under it. */
export function road(d: Dims): THREE.Group {
  const n = Math.max(2, d.n | 0), hw = (d.w ?? 10) / 2, lift = 0.15, pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([d['x' + i] ?? 0, (d['y' + i] ?? 0) + lift, d['z' + i] ?? 0]);
  const top: number[] = [], verge: number[] = [], side: number[] = [];
  const quad = (arr: number[], a: number[], b: number[], c: number[], e: number[]) => {
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    if (uz * vx - ux * vz >= 0) arr.push(...a, ...b, ...c, ...a, ...c, ...e); else arr.push(...a, ...c, ...b, ...a, ...e, ...c);
  };
  const off = (i: number, w: number, dy = 0): number[] => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz) || 1;
    return [pts[i][0] - (tz / tl) * w, pts[i][1] + dy, pts[i][2] + (tx / tl) * w];
  };
  for (let i = 0; i + 1 < n; i++) {
    const j0 = 0.85 + 0.3 * hash(i, 3), j1 = 0.85 + 0.3 * hash(i + 1, 3), v0 = 1 + 1.4 * hash(i, 5), v1 = 1 + 1.4 * hash(i + 1, 5);
    quad(top, off(i, hw * j0), off(i, -hw * j0), off(i + 1, -hw * j1), off(i + 1, hw * j1));
    for (const s of [1, -1]) {
      quad(verge, off(i, s * hw * j0, -0.04), off(i, s * (hw * j0 + v0), -0.08), off(i + 1, s * (hw * j1 + v1), -0.08), off(i + 1, s * hw * j1, -0.04));
      const p = off(i, s * (hw * j0 + v0), -0.08), q2 = off(i + 1, s * (hw * j1 + v1), -0.08);
      const pd = [p[0], p[1] - 2, p[2]], qd = [q2[0], q2[1] - 2, q2[2]];
      side.push(...p, ...q2, ...qd, ...p, ...qd, ...pd, ...p, ...qd, ...q2, ...p, ...pd, ...qd);   // both faces
    }
  }
  const g = grp();
  for (const [v, color] of [[top, d.c ? C.roadMud : C.road], [verge, C.verge], [side, C.verge]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat(color)));
  }
  return g;
}

// ---------------------------------------------------------------- the gallows knoll
/** A flat-topped bedrock knoll `w` × `d` (local x × z), `h` high at its blunt east face (+x). The crown is level; the
 *  faces run down to `base` (ft below the origin) so the rising ground to the west can swallow them: set on a slope, the
 *  west face shows only its top course and the knoll grades into the hill. Lichen-grey rock, a skin of thin turf on the
 *  crown that stops short of the edges so the rock shows. The gallows stands on it. */
export function rockShelf(d: Dims): THREE.Group {
  const W = d.w ?? 60, D = d.d ?? 44, H = d.h ?? 8, sd = d.seed ?? 0, B = -(d.base ?? 0.5), g = grp();
  const n = 12, ring: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.86 + 0.16 * hash(i, sd); ring.push([Math.cos(a) * (W / 2) * k, Math.sin(a) * (D / 2) * k]); }
  const rock: number[] = [], turf: number[] = [];
  const push = (arr: number[], ...p: number[]) => arr.push(...p);
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % n];
    push(rock, 0, H, 0, x1, H, z1, x0, H, z0);                       // crown fan (wound so it faces up)
    push(rock, x0, B, z0, x1, H, z1, x1, B, z1, x0, B, z0, x0, H, z0, x1, H, z1);   // the face down into the ground
    const kk = (x: number) => (x < -W * 0.15 ? 0.98 : 0.78), t0 = [x0 * kk(x0), z0 * kk(x0)], t1 = [x1 * kk(x1), z1 * kk(x1)];   // the turf runs off the west edge into the hillside's
    push(turf, 0, H + 0.14, 0, t1[0], H + 0.14, t1[1], t0[0], H + 0.14, t0[1]);
  }
  g.add(tris(rock, C.rock), tris(turf, C.turf));
  // ledges and blocks on the east face, a lichen crust where the wind polishes the stone, a few loose stones at the foot
  for (let k = 0; k < 4; k++) { const z = (hash(k, sd + 3) - 0.5) * D * 0.7; g.add(box(2.6 + hash(k, sd) * 2, 0.7 + hash(k, sd + 1), 2.2, k % 2 ? C.rockDeep : C.rockPale, W / 2 * 0.86 - 0.6, H * (0.25 + 0.5 * hash(k, sd + 2)), z, hash(k, sd + 4) * 0.5)); }
  for (let k = 0; k < 5; k++) g.add(place(lump(0.9 + hash(k, sd + 7) * 0.8, C.lichen, k, 1.3, 0.25, 1.1, 0), W * 0.28 + hash(k, sd + 8) * W * 0.12, H + 0.1, (hash(k, sd + 9) - 0.5) * D * 0.6));
  for (let k = 0; k < 4; k++) g.add(place(lump(0.7 + hash(k, sd + 11) * 0.9, k % 2 ? C.rockDeep : C.rock, k + 20, 1.2, 0.7, 1, 0), W / 2 * 0.9 + 1 + hash(k, sd + 12) * 2, 0.3, (hash(k, sd + 13) - 0.5) * D * 0.8));
  return g;
}

/** A rough timber stair down a rock face: `h` of rise over `run` of going (descending toward local +x from the top at
 *  the origin), `w` wide, two stringers, plank treads, a rail of fir poles on the +z side. */
export function knollStair(d: Dims): THREE.Group {
  const H = d.h ?? 8, R = d.run ?? 14, W = d.w ?? 4, g = grp(), n = Math.max(4, Math.round(H / 0.8)), L = Math.hypot(H, R), ang = Math.atan2(H, R);
  for (const z of [-W / 2, W / 2]) g.add(box(L + 0.6, 0.8, 0.5, C.timberDeep, R / 2, H / 2 - 0.1, z, 0, 0, -ang));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; g.add(box(1.35, 0.28, W + 0.5, i % 3 === 2 ? C.timberGrey : C.timber, t * R, H - t * H + 0.15, 0)); }
  for (const x of [0.6, R - 0.6]) { const y = H - (x / R) * H; g.add(cyl(0.18, 0.22, 3.6, C.timberDeep, x, y + 1.6, W / 2 + 0.3, 5)); }
  g.add(box(L, 0.22, 0.22, C.timberGrey, R / 2, H / 2 + 3.2, W / 2 + 0.3, 0, 0, -ang));
  g.add(box(1.4, 0.3, W + 1, C.timberGrey, -0.5, H + 0.1, 0));   // the landing board at the top
  return g;
}

/** What lies under a gallows deck, a flat scatter `w` across: drifted needles, two fallen planks, a broken short
 *  ladder, a coil of old rope gone green. */
export function gallowsJunk(d: Dims): THREE.Group {
  const w = d.w ?? 8, g = grp(plate(w * 0.45, 3, C.needle, 0.05, 1.2), plate(w * 0.25, 8, C.needlePale, 0.08, 1.4).translateX(w * 0.15));
  g.add(box(6.5, 0.25, 0.8, C.timberGrey, -0.6, 0.18, -1.6, 0.18), box(5.2, 0.25, 0.8, C.timberGrey, 1.2, 0.3, 0.6, -0.35));
  const lad = grp(); for (const z of [-0.7, 0.7]) lad.add(box(5, 0.22, 0.22, C.timberDeep, 0, 0.11, z)); for (let i = 0; i < 3; i++) lad.add(box(0.2, 0.2, 1.4, C.timberDeep, -1.8 + i * 1.3, 0.14, 0));
  lad.add(box(0.2, 0.2, 0.6, C.timberDeep, 2.1, 0.14, 0.4)); place(lad, -0.3, 0.12, 2.4, 0.9); g.add(lad);
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 5, 10), mat(C.ropeGreen)), 2.4, 0.26, -2.6, 0, Math.PI / 2));
  return g;
}

// ---------------------------------------------------------------- wind-made things
/** A pine flagged by a constant west wind: trunk leaning `lean` degrees toward +x, boughs only on the lee side, the
 *  windward face bare and bleached; `h` 25-45. */
export function windPine(d: Dims): THREE.Group {
  const h = d.h ?? 34, lean = ((d.lean ?? 12) * Math.PI) / 180, r = d.r ?? h * 0.2, sd = Math.round(h * 7) % 13, tree = grp();
  tree.add(cyl(0.4, 0.85, h * 0.62, C.bark, 0, h * 0.31, 0, 6), cyl(0.16, 0.4, h * 0.42, C.barkPale, 0, h * 0.79, 0, 5));
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const tr = r * (1.05 - i * 0.22), th = h * (0.3 - i * 0.03), y = h * 0.3 + i * h * 0.17 + th / 2;
    const c = new THREE.Mesh(pineTier(tr, th, 7, i + sd), mat(i % 2 ? C.boughDeep : C.bough));
    c.scale.set(0.72, 1, 0.9); c.position.set(tr * 0.55, y, 0); c.rotation.y = 0.45 + i * 0.5; tree.add(c);
    const half = new THREE.Mesh(new THREE.ConeGeometry(tr * 0.5, th * 0.8, 5), mat(i % 2 ? C.bough : C.boughDeep));
    half.position.set(tr * 0.9, y - th * 0.1, (hash(i, sd) - 0.5) * tr * 0.6); tree.add(half);
  }
  for (let i = 0; i < 3; i++) { const b = box(0.22, 2.6 + hash(i, sd) * 1.6, 0.22, C.barkPale, -0.2, h * (0.45 + i * 0.15), (hash(i, sd + 2) - 0.5) * 1.2); b.rotation.z = 0.9 + hash(i, sd + 3) * 0.4; tree.add(b); }   // stubs of dead windward boughs
  tree.rotation.z = -lean;
  return grp(tree);
}

/** A windrow of pine needles, dead leaves and grit banked against the east side of an obstacle: `h` high at the obstacle
 *  (local -x), tapering to nothing downwind over about three times its height, `len` along z. */
export function needleDrift(d: Dims): THREE.Group {
  const L = d.len ?? 10, h = d.h ?? 1.2, sd = Math.round(L * 3 + h * 7), g = grp();
  const n = Math.max(2, Math.round(L / 4));
  for (let i = 0; i < n; i++) {
    const seg = L / n, hh = h * (0.6 + 0.5 * hash(i, sd)), m = profile([[0, 0], [0.1, hh], [hh * 1.6, hh * 0.4], [hh * 4.5, 0]], seg * 1.06, i % 2 ? C.needle : C.needlePale);
    m.position.z = -L / 2 + (i + 0.5) * seg; g.add(m);
  }
  for (let i = 0; i < Math.max(2, Math.round(L / 3)); i++) g.add(box(0.5, 0.12, 0.3 + hash(i, sd) * 0.6, C.gravel, h * 2.5 + hash(i, sd + 1) * h * 1.5, 0.06, (hash(i, sd + 2) - 0.5) * L, hash(i, sd + 3) * 2));
  return g;
}

/** An ancient yew: a twisted black trunk about 5 ft thick with a hollow opening on its lee side (+x), a dense dark crown
 *  `h` high and `spread` wide, roots heaving out of the ground. */
export function yew(d: Dims): THREE.Group {
  const h = d.h ?? 30, S = d.spread ?? 30, g = grp();
  for (let i = 0; i < 4; i++) { const a = i * 1.6, t = cyl(0.9, 1.4, h * 0.42, i % 2 ? C.yewBark : C.bark, Math.cos(a) * 1.1, h * 0.21, Math.sin(a) * 1.1, 6); t.rotation.z = (hash(i, 1) - 0.5) * 0.16; t.rotation.x = (hash(i, 2) - 0.5) * 0.16; g.add(t); }
  g.add(cyl(1.6, 2.4, 6, C.yewBark, 0, 3, 0, 7));
  g.add(box(1.5, 3.2, 1.3, C.pit, 2.3, 2.1, 0.2));                                       // the hollow, on the lee side
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, L = 3 + hash(i, 5) * 3; const root = box(L, 0.7, 0.8, C.bark, Math.cos(a) * (1.2 + L / 2), 0.25, Math.sin(a) * (1.2 + L / 2), -a, 0, (hash(i, 6) - 0.5) * 0.3); g.add(root); }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, rr = i < 3 ? S * 0.12 : S * (0.22 + 0.2 * hash(i, 7)), r = S * (0.2 + 0.1 * hash(i, 8));
    g.add(place(lump(r, i % 3 ? C.yew : C.yewDeep, i + 30, 1.25, 0.8, 1.1, 1), Math.cos(a) * rr, h * (0.5 + 0.28 * hash(i, 9)) - r * 0.2, Math.sin(a) * rr));
  }
  g.add(place(lump(S * 0.22, C.yewDeep, 41, 1.1, 0.9, 1.1, 1), 0, h * 0.78, 0));
  for (let i = 0; i < 5; i++) g.add(box(0.3, 2.2 + hash(i, 11) * 2, 0.3, C.bark, (hash(i, 12) - 0.5) * S * 0.5, h * 0.42 + hash(i, 13) * h * 0.2, (hash(i, 14) - 0.5) * S * 0.5, 0, (hash(i, 15) - 0.5) * 1.2, (hash(i, 16) - 0.5) * 1.2));
  return g;
}

// ---------------------------------------------------------------- the graveyard
/** A sunken grave `w` × `d` (local x × z): the plain blank headstone at the north end (local -z), its hollow stretching
 *  south, turf sagging in the middle. `tilt` leans the stone toward +x (east), `sink` buries it by that much; `tended`
 *  adds a ring of cleared turf and a dried posy at the stone's foot. */
export function sunkenGrave(d: Dims): THREE.Group {
  const w = d.w ?? 3, L = d.d ?? 7, tilt = ((d.tilt ?? 0) * Math.PI) / 180, sink = d.sink ?? 0, g = grp(), sd = Math.round((d.tilt ?? 0) * 3 + sink * 17);
  const st = grp(box(1.6, 2.3, 0.42, PALETTE.mist3, 0, 1.15, 0));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.42, 10, 1, false, -Math.PI / 2, Math.PI), mat(PALETTE.mist3)); head.rotation.x = Math.PI / 2; head.rotation.z = Math.PI / 2; head.position.y = 2.3; st.add(head);
  place(st, 0, -sink, -L / 2 - 0.6, 0, -0.05 - hash(sd, 1) * 0.08, -tilt); g.add(st);
  // the hollow: a dark sunken floor and a low turf lip round it, broken on the lee side where the drift has filled it
  g.add(box(w - 0.5, 0.05, L - 0.5, C.earthDark, 0, 0.04, 0));
  g.add(box(0.35, 0.3, L, C.turfPale, -w / 2, 0.15, 0), box(0.35, 0.22, L, C.turfPale, w / 2, 0.11, 0), box(w, 0.3, 0.35, C.turfPale, 0, 0.15, -L / 2), box(w, 0.26, 0.35, C.turfPale, 0, 0.13, L / 2));
  g.add(place(lump(0.7, C.turf, sd, 1.6, 0.35, 1.2, 0), (hash(sd, 2) - 0.5) * 0.6, 0.12, hash(sd, 3) * 1.5));   // a sag of turf
  if (d.tended) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(box(0.9, 0.08, 0.5, C.turfPale, Math.cos(a) * (w / 2 + 1.1), 0.05, -L / 2 - 0.6 + Math.sin(a) * 1.8, -a)); }
    g.add(place(lump(0.35, C.yewDeep, 7, 1.4, 0.6, 1, 0), 0.3, 0.2, -L / 2 + 0.4), box(0.08, 0.6, 0.08, C.rope, 0.3, 0.3, -L / 2 + 0.5, 0, 0, 0.3));
  }
  return g;
}

/** A freshly dug grave: a `w` × `d` pit with raw earth walls and a floor lost in shadow, the spoil heaped along its north
 *  side (local -z) with a rusted shovel standing in it. `violated` swaps it for a shallow mud-filled hole with bones. */
export function openGrave(d: Dims): THREE.Group {
  const w = d.w ?? 3, L = d.d ?? 7, g = grp();
  if (d.violated) {
    g.add(box(w + 0.6, 0.06, L + 0.6, C.mud, 0, 0.03, 0), box(w - 0.4, 0.05, L - 0.4, C.puddle, 0, 0.08, 0.3));
    for (let i = 0; i < 6; i++) g.add(box(0.14, 0.14, 0.9 + hash(i, 2) * 0.8, C.bone, (hash(i, 3) - 0.5) * (w + 1.2), 0.1, (hash(i, 4) - 0.5) * (L + 1.5), hash(i, 5) * 3));
    g.add(place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(C.bone)), w / 2 + 0.6, 0.35, L / 2 - 0.5));
    for (let i = 0; i < 4; i++) g.add(place(lump(0.6, C.earthRaw, i + 5, 1.5, 0.5, 1.1, 0), (hash(i, 6) - 0.5) * (w + 2.5), 0.15, (hash(i, 7) - 0.5) * (L + 2.5)));
    return g;
  }
  g.add(box(w, 0.04, L, C.pit, 0, 0.03, 0));
  for (const sx of [-1, 1]) g.add(box(0.5, 0.55, L + 1, C.earthRaw, sx * (w / 2 + 0.25), 0.27, 0));
  g.add(box(w + 1, 0.5, 0.5, C.earthRaw, 0, 0.25, L / 2 + 0.25));
  for (let i = 0; i < 4; i++) g.add(place(lump(1.1 + hash(i, 1) * 0.5, i % 2 ? C.earthRaw : C.earth, i + 9, 1.4, 0.55, 1.1, 0), -w / 2 + 0.6 + i * (w + 0.6) / 3.2, 0.55, -L / 2 - 1.3 - hash(i, 2) * 0.5));
  for (let i = 0; i < 3; i++) g.add(place(lump(0.5, C.earth, i + 15, 1.3, 0.6, 1, 0), (hash(i, 3) - 0.5) * (w + 3), 0.15, -L / 2 - 2.6 - hash(i, 4)));
  const sh = grp(box(0.14, 4.2, 0.14, C.timberDeep, 0, 2.1, 0), box(0.7, 1.0, 0.1, C.rust, 0, -0.1, 0), box(0.5, 0.14, 0.14, C.timberDeep, 0, 4.2, 0)); place(sh, w / 2 - 0.4, 1.1, -L / 2 - 1.4, 0.4, 0.25, -0.2); g.add(sh);
  return g;
}

/** A collapsed lean-to of poles and turf, `w` along the wall (local z), `d` deep, the wall on its +x side: the roof
 *  fallen in at one end; a mattock, a split-hafted shovel, a coil of rope and a two-pole bier under and beside it. */
export function leanTo(d: Dims): THREE.Group {
  const W = d.w ?? 10, D = d.d ?? 6, g = grp(), hi = 4.2;
  g.add(box(0.3, 0.3, W, C.timberDeep, 0.6, hi, 0));                                                   // the ridge pole, against the wall
  const n = Math.round(W / 1.3);
  for (let i = 0; i < n; i++) {
    const z = -W / 2 + (i + 0.5) * (W / n), fallen = i >= n - 3, L = Math.hypot(hi, D);
    if (fallen) g.add(box(L * 0.9, 0.26, 0.26, C.timberGrey, -D * 0.4, 0.2 + (i % 2) * 0.25, z + 0.3, 0.1 * (i % 2), 0, 0.06 * (i % 2 ? 1 : -1)));
    else g.add(box(L, 0.26, 0.26, i % 3 ? C.timber : C.timberGrey, 0.6 - D / 2, hi / 2, z, 0, 0, Math.atan2(hi, D)));
  }
  const slope = Math.atan2(hi, D);
  g.add(box(Math.hypot(hi, D) * 0.9, 0.3, W * 0.55, C.turf, 0.5 - D / 2, hi / 2 + 0.2, -W * 0.2, 0, 0, slope));           // turf still on the standing end
  g.add(box(3.2, 0.3, 2.6, C.turf, -D * 0.5, 0.5, W * 0.3, 0.3, 0, 0.15), box(2.4, 0.3, 2, C.turfPale, -D * 0.2, 0.42, W * 0.4, -0.4));   // and slumped where it fell
  g.add(box(0.14, 3.6, 0.14, C.timberDeep, -1.4, 0.25, -W * 0.25, 0, Math.PI / 2 - 0.3), box(1.1, 0.25, 0.2, C.rust, -1.4, 0.3, -W * 0.25 - 1.7));              // mattock
  g.add(box(0.14, 2.2, 0.14, C.timberDeep, -0.4, 0.2, -W * 0.05, 0, Math.PI / 2 + 0.2), box(0.14, 1.4, 0.14, C.timberDeep, 0.2, 0.18, -W * 0.05 + 1.6, 0, Math.PI / 2 + 0.9), box(0.7, 0.9, 0.1, C.rust, -0.4, 0.2, -W * 0.05 + 1.2, 0, Math.PI / 2));   // split-hafted shovel
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 5, 10), mat(C.rope)), -1.8, 0.22, W * 0.1, 0, Math.PI / 2));   // grave rope
  const bier = grp(); for (const x of [-0.9, 0.9]) bier.add(box(0.2, 0.2, 7, C.timberDeep, x, 0.1, 0)); for (let i = 0; i < 4; i++) bier.add(box(2, 0.12, 0.3, C.timberGrey, 0, 0.22, -2.2 + i * 1.5, (hash(i, 1) - 0.5) * 0.3));
  place(bier, -D * 0.75 - 1.2, 0, -W * 0.1, 0.15); g.add(bier);
  return g;
}

// ---------------------------------------------------------------- roads
/** A strip of road `len` long (local x) cut by two wagon ruts `w` apart: dark grooves, a ridge of churned mud between,
 *  `puddles` of black standing water lying in the ruts; `pitch` tilts it to lie along a climbing road. */
export function wagonRuts(d: Dims): THREE.Group {
  return pitched(wagonRutsFlat(d), d.pitch);
}
function wagonRutsFlat(d: Dims): THREE.Group {
  const L = d.len ?? 40, w = d.w ?? 5, np = d.puddles ?? 2, sd = Math.round(L * 1.7 + w), g = grp();
  const n = Math.max(2, Math.round(L / 10));
  for (let i = 0; i < n; i++) {
    const seg = L / n, x = -L / 2 + (i + 0.5) * seg, wob = (hash(i, sd) - 0.5) * 0.5;
    for (const s of [-1, 1]) g.add(box(seg * 1.02, 0.05, 0.75, C.earthDark, x, 0.035, s * w / 2 + wob, (hash(i, sd + s) - 0.5) * 0.06));
    g.add(box(seg * 0.95, 0.12 + hash(i, sd + 3) * 0.06, w * 0.45, C.mudRidge, x, 0.05, wob * 0.5, 0, 0, 0));
    g.add(box(seg * 0.8, 0.09, 0.5, C.mud, x, 0.045, w / 2 + 0.9 + wob, 0.04), box(seg * 0.8, 0.09, 0.5, C.mud, x, 0.045, -w / 2 - 0.9 + wob, -0.04));
  }
  for (let i = 0; i < np; i++) { const x = -L / 2 + (hash(i, sd + 5) * 0.8 + 0.1) * L, s = i % 2 ? 1 : -1; g.add(box(2.4 + hash(i, sd + 6) * 2.5, 0.04, 0.8, C.puddle, x, 0.07, s * w / 2)); }
  return g;
}

/** A half-buried log set across a climbing road (along local x), `len` long, at a slight angle, with a fan of washed
 *  gravel spreading out below it on the downhill side (+z). */
export function waterBar(d: Dims): THREE.Group {
  const L = d.len ?? 12, g = grp(), sd = Math.round(L * 5);
  const log = cyl(0.55, 0.6, L, C.bark, 0, 0.3, 0, 7); log.rotation.z = Math.PI / 2; log.rotation.y = 0.1; g.add(log);
  g.add(box(L * 0.3, 0.5, 0.5, C.barkPale, -L * 0.2, 0.42, 0.1, 0.1));
  for (const x of [-L / 2 + 1, L / 2 - 1]) g.add(box(0.5, 1.0, 0.5, C.timberDeep, x, 0.5, 0.75));    // the stakes that pin it
  const fan = new THREE.Shape([new THREE.Vector2(-L * 0.45, 0.6), new THREE.Vector2(L * 0.45, 0.6), new THREE.Vector2(L * 0.6, 4.5), new THREE.Vector2(L * 0.15, 7.5), new THREE.Vector2(-L * 0.2, 7), new THREE.Vector2(-L * 0.6, 4)]);
  const geo = new THREE.ShapeGeometry(fan); geo.rotateX(Math.PI / 2); geo.translate(0, 0.05, 0); g.add(new THREE.Mesh(geo, mat(C.gravelPale)));
  for (let i = 0; i < 8; i++) g.add(box(0.5 + hash(i, sd) * 0.5, 0.22, 0.4 + hash(i, sd + 1) * 0.4, i % 2 ? C.gravelPale : C.stone, (hash(i, sd + 2) - 0.5) * L * 0.9, 0.12, 1 + hash(i, sd + 3) * 6, hash(i, sd + 4) * 3));
  g.add(box(L * 0.8, 0.3, 1.6, C.mud, 0, 0.1, -1.4));   // silt banked on the uphill side
  return g;
}

/** A low earth-and-stone bank along the uphill side of a road cut into a slope, `len` long (local x), `h` high: steep
 *  face toward the road (-z), roots and stones showing, turf on top; `pitch` tilts it to follow the road's climb. */
export function roadBank(d: Dims): THREE.Group {
  return pitched(roadBankFlat(d), d.pitch);
}
function roadBankFlat(d: Dims): THREE.Group {
  const L = d.len ?? 50, h = d.h ?? 2.5, sd = Math.round(L + h * 13), g = grp();
  const n = Math.max(2, Math.round(L / 12));
  for (let i = 0; i < n; i++) {
    const seg = L / n, hh = h * (0.85 + 0.3 * hash(i, sd));
    const bank = profile([[0, 0], [0.6, hh * 0.65], [1.8, hh], [6, hh + 0.3], [6, 0]], seg * 1.04, i % 2 ? C.earth : C.earthRaw);
    bank.rotation.y = -Math.PI / 2; bank.position.set(-L / 2 + (i + 0.5) * seg, 0, 0); g.add(bank);
    g.add(box(seg * 1.02, 0.3, 4.4, C.turf, -L / 2 + (i + 0.5) * seg, hh + 0.25, 3.9));
  }
  for (let i = 0; i < Math.round(L / 6); i++) g.add(place(lump(0.45 + hash(i, sd + 1) * 0.5, i % 2 ? C.stone : C.rockPale, i + 3, 1.3, 0.8, 0.9, 0), (hash(i, sd + 2) - 0.5) * L, h * (0.2 + hash(i, sd + 3) * 0.5), 0.5 + hash(i, sd + 4) * 0.6));
  for (let i = 0; i < Math.round(L / 9); i++) g.add(box(0.14, 0.14, 1.2 + hash(i, sd + 6), C.bark, (hash(i, sd + 7) - 0.5) * L, h * (0.3 + hash(i, sd + 8) * 0.4), 0.4, 0, 0.5 + hash(i, sd + 9), 0));
  return g;
}

// ---------------------------------------------------------------- small set dressing
/** A cold hearth in the lee of the hearth stone: a ring of blackened stones round a plate of ash, a few fish bones. */
export function coldHearth(d: Dims): THREE.Group {
  const r = d.r ?? 2.2, g = grp(plate(r * 0.7, 2, C.ash, 0.05, 1.1), plate(r * 0.35, 6, C.soot, 0.08, 1.2));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(place(lump(0.45 + hash(i, 1) * 0.25, i % 3 ? C.soot : C.rockDeep, i, 1.2, 0.7, 1, 0), Math.cos(a) * r, 0.25, Math.sin(a) * r * 0.85)); }
  for (let i = 0; i < 5; i++) g.add(box(0.08, 0.08, 0.7 + hash(i, 3) * 0.5, C.bone, r * 0.6 + hash(i, 4) * 1.6, 0.06, (hash(i, 5) - 0.5) * 2.5, hash(i, 6) * 3));
  g.add(box(1.2, 0.5, 0.9, C.bark, -r * 0.9, 0.25, r * 0.9, 0.5), box(1.4, 0.4, 0.7, C.soot, -r * 0.3, 0.22, -r * 1.1, -0.6));   // half-burnt sticks
  return g;
}

// ---------------------------------------------------------------- figures
/** A Vistana of the Tser Pool band: weathered bright cloth, a headscarf, a sash; `v` picks the colours. */
export function vistani(d: Dims): THREE.Group {
  const v = Math.round(d.v ?? 0), CL = [C.vCloth0, C.vCloth1, C.vCloth2, C.vCloth3], s = d.scale ?? 1;
  const g = humanoid({ skin: C.vSkin, cloth: CL[v % 4], trim: C.vTrim, hair: C.vHair, scale: s, skirt: v % 3 === 1, weapon: v % 2 ? 'none' : 'sword' });
  g.add(box(0.95 * s, 0.32 * s, 0.95 * s, C.vScarf, 0, 5.75 * s, 0.02 * s), box(1.1 * s, 0.22 * s, 0.6 * s, v % 2 ? C.vScarf : C.vCloth0, 0, 3.2 * s, 0.05 * s, 0, 0, 0.35));
  return g;
}
/** A swarm of bats: a knot of small dark wedges wheeling at `y`, or hanging close if `roost`. */
export function bats(d: Dims): THREE.Group {
  const s = d.scale ?? 1, y0 = d.y ?? 4, g = grp();
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39, r = d.roost ? (0.3 + hash(i) * 0.9) * s : (0.6 + hash(i) * 2.2) * s, y = y0 + (d.roost ? hash(i, 2) * 1.5 : hash(i, 2) * 3) * s;
    const bat = grp(box(0.35 * s, 0.22 * s, 0.2 * s, C.bat));
    for (const z of [-1, 1]) { const w = box(0.5 * s, 0.04 * s, 0.35 * s, C.batWing, 0, 0.05 * s, z * 0.3 * s); w.rotation.x = z * (0.4 + hash(i, z) * 0.7); bat.add(w); }
    bat.position.set(Math.cos(a) * r, y, Math.sin(a) * r); bat.rotation.y = -a + Math.PI / 2; g.add(bat);
  }
  return g;
}

Object.assign(PROPS_V1, {
  'f-rock-shelf': rockShelf, 'f-knoll-stair': knollStair, 'f-gallows-junk': gallowsJunk, 'f-wind-pine': windPine, 'f-needle-drift': needleDrift, 'f-yew': yew,
  'f-sunken-grave': sunkenGrave, 'f-open-grave': openGrave, 'f-lean-to': leanTo, 'f-wagon-ruts': wagonRuts, 'f-water-bar': waterBar, 'f-road-bank': roadBank, 'f-cold-hearth': coldHearth, 'f-land': land, 'f-road': road,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'f-vistani': (d) => vistani(d), 'f-bats': (d) => bats(d) } as Record<string, (d: Dims) => THREE.Group>);
