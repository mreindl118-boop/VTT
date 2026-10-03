// Props and figures for Krezk (chapter 8, area S) and the Abbey of Saint Markovia (S10): the land the two maps share
// (a heightfield and the switchback road), the village's log cottages, its buttressed wall, towers and gatehouse, the
// shrine of the White Sun, and the abbey's fittings (belfry, battlements, scarecrow guards, the madhouse wreckage, the
// golem workshop, the wine cellar). Original geometry in the kit's grammar: plinths, frames, ridge beams, one palette.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid, type HumanoidOpts } from '../creatures';
import { mat } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { FLOOR_COLOR, PALETTE } from '../palette';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours (each declared as the surface it is made of)
const RUBBLE = '#6d6860', RUBBLE_DK = '#5a5550', ASHLAR = '#7c858e', ASHLAR_DK = '#5f6770', SLATE = '#3d3a44';
const LOG = '#5d4636', LOG_DK = '#4f3b2d', LOG_END = '#8a6b4a', THATCH = '#8a7a4a', THATCH_DK = '#6e6140', THATCH_LT = '#9a8a58';
const STONE = '#6d6a66', BEAM = '#3a2c22', DOOR = '#3b2a1e', SHUTTER = '#4b3a2c', GLASS = '#1d1916';
const ROCK = '#5b5752', ROCK_DK = '#4a4a52', ROCK_MID = '#55535a', SCREE = '#6b6760', FROST = '#7f8a80', GRAVEL = '#6d6150';
const GOLD = '#b8952e', BRONZE = '#8a6a3a', COPPER = '#4f7a6a', RUST = '#7a4a2e', CHAIN = '#5a5d63';
const STRAW = '#b89b52', SACK = '#a8956f', SOIL = '#4a3b2e', LEAF = '#4f6b3a', LEAF_DK = '#3d5530', SQUASH = '#9a5a2a';
const FUR = '#5a4a3a', FUR_LT = '#7a6a58', SHROUD = '#141218', BLOODSTAIN = '#4d1119', HEMP = '#8a7a5a', BOTTLE = '#2f3d2a';
surfaceFor([RUBBLE, RUBBLE_DK], 'rubble');
surfaceFor([ASHLAR, ASHLAR_DK], 'ashlar');
surfaceFor([SLATE], 'shingle');
surfaceFor([LOG, LOG_DK], 'log');
surfaceFor([LOG_END, BEAM, DOOR, SHUTTER], 'wood');
surfaceFor([THATCH, THATCH_DK, THATCH_LT, STRAW], 'thatch');
surfaceFor([STONE], 'stone');
surfaceFor([ROCK, ROCK_DK, ROCK_MID, SCREE], 'rock');
surfaceFor([FROST], 'grass');
surfaceFor([GRAVEL, SOIL], 'dirt');
surfaceFor([GOLD, BRONZE, COPPER, RUST, CHAIN], 'metal');
surfaceFor([SACK, HEMP, FUR, FUR_LT, SHROUD], 'cloth');
surfaceFor([LEAF, LEAF_DK], 'foliage');

// ---------------------------------------------------------------- helpers
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.rotation.y = ry; return m; };
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
/** Mark a piece as part of a building's shell raised on authored walls (a roof cap): the section cut slices it like a
 *  roof, and a cutaway hides it, as the kit's own roofs. */
const asCap = (g: THREE.Group) => { g.traverse((c) => { c.userData.role = 'roof'; c.userData.cap = true; }); return g; };
/** A deterministic 0..1 noise from a seed (so a village never looks cloned and never changes between loads). */
const rnd = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** A gable-end triangle (a prism `t` thick) of span S and rise R, its base at y0, facing ±x. */
function gable(S: number, R: number, t: number, color: string, x: number, y0: number): THREE.Mesh {
  const shape = new THREE.Shape([new THREE.Vector2(-S / 2, 0), new THREE.Vector2(S / 2, 0), new THREE.Vector2(0, R)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }); geo.translate(0, 0, -t / 2); geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y0, 0); return m;
}
/** A pitched roof over a span S (z) and length L (x): two slabs, eaves at y0, ridge at y0 + R, a ridge piece on top. */
function pitched(L: number, S: number, R: number, y0: number, color: string, ridge: string, thick = 0.8, over = 1.2): THREE.Group {
  const g = grp(), half = S / 2 + over, slope = Math.hypot(half, R * (half / (S / 2))), ang = Math.atan2(R, S / 2);
  for (const sz of [-1, 1]) {
    const slab = box(L + over * 2, thick, slope, color, 0, 0, 0); slab.rotation.x = sz * ang;
    slab.position.set(0, y0 + R - Math.sin(ang) * slope / 2 + thick * 0.3, sz * Math.cos(ang) * slope / 2); g.add(slab);
  }
  g.add(box(L + over * 2 + 0.4, 0.7, 0.9, ridge, 0, y0 + R + 0.25, 0));
  return g;
}

// ================================================================== the land: a heightfield and the road on it
/** Ground sampled on a lattice: `nx` × `nz` cells of `cell` ft from the origin, heights packed four to a number
 *  (12 bits each, `q` ft per step; 4095 is a hole: no cell touching it is drawn). Faces are coloured by how steep they
 *  are (rock faces, scree, turf) and frosted above `frost` ft; a rock skirt closes the lattice's outer edge (`skirt` 0:
 *  none; `drop`: a short skirt that far down). */
export function heightfield(d: Dims): THREE.Group {
  const nx = Math.max(1, d.nx | 0), nz = Math.max(1, d.nz | 0), cell = d.cell ?? 10, q = d.q ?? 0.5, HOLE = 4095, W = nx + 1, n = W * (nz + 1);
  const H = new Float32Array(n), ok = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const v = d['d' + Math.floor(k / 4)];
    const c = v === undefined ? HOLE : Math.floor(v / Math.pow(4096, k % 4)) % 4096;
    ok[k] = c === HOLE ? 0 : 1; H[k] = c === HOLE ? 0 : c * q;
  }
  const frost = d.frost ?? 1e9;
  const turf = FLOOR_COLOR.grass;
  const bins = new Map<string, number[]>();
  const push = (color: string, ...v: number[]) => { let a = bins.get(color); if (!a) { a = []; bins.set(color, a); } a.push(...v); };
  const P = (k: number): [number, number, number] => [(k % W) * cell, H[k], Math.floor(k / W) * cell];
  const tri = (a: number, b: number, c: number) => {
    let A = P(a), B = P(b), C = P(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let ny = uz * vx - ux * vz; const nxv = uy * vz - uz * vy, nzv = ux * vy - uy * vx;
    if (ny < 0) { const t = B; B = C; C = t; ny = -ny; }
    const len = Math.hypot(nxv, ny, nzv) || 1, k = ny / len, y = (A[1] + B[1] + C[1]) / 3, x = (A[0] + B[0] + C[0]) / 3, z = (A[2] + B[2] + C[2]) / 3;
    // steep faces are banded like bedded rock (the beds wander a little), mid slopes are scree, the rest turf or frost
    const band = Math.floor((y + 6 * Math.sin(x * 0.045) + 5 * Math.cos(z * 0.06)) / 18) % 3;
    const color = k < 0.62 ? (band === 0 ? ROCK_DK : band === 1 ? ROCK : ROCK_MID) : k < 0.8 ? SCREE : y >= frost ? FROST : turf;
    push(color, ...A, ...B, ...C);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, e = a + W;
    if (!ok[a] || !ok[b] || !ok[c] || !ok[e]) continue;
    if (Math.abs(H[a] - H[c]) < Math.abs(H[b] - H[e])) { tri(a, b, c); tri(a, c, e); } else { tri(a, b, e); tri(b, c, e); }
  }
  // the skirt: the lattice's outer edge drops to the origin's level as a rock face (or `drop` ft, for a patch of finer
  // lattice laid into a coarser one, so the seam between them never shows a crack)
  const drop = d.drop ?? 0;
  const edge = (a: number, b: number) => {
    if (!ok[a] || !ok[b] || (H[a] < 0.5 && H[b] < 0.5)) return;
    const A = P(a), B = P(b), ya = drop ? Math.max(0, A[1] - drop) : 0, yb = drop ? Math.max(0, B[1] - drop) : 0;
    push(ROCK_DK, A[0], A[1], A[2], B[0], B[1], B[2], B[0], yb, B[2], A[0], A[1], A[2], B[0], yb, B[2], A[0], ya, A[2]);
  };
  if (d.skirt !== 0) {
    for (let i = 0; i < nx; i++) { edge(i, i + 1); edge(nz * W + i + 1, nz * W + i); }
    for (let j = 0; j < nz; j++) { edge((j + 1) * W, j * W); edge(j * W + nx, (j + 1) * W + nx); }
  }
  const g = grp();
  for (const [color, v] of bins) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat(color)));
  }
  return g;
}

/** A road ribbon through the points (x{i}, y{i}, z{i}), `w` ft wide: a gravel bed with a lip of stones on both edges. */
export function roadRibbon(d: Dims): THREE.Group {
  const n = Math.max(2, d.n | 0), w = (d.w ?? 10) / 2, pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([d['x' + i] ?? 0, (d['y' + i] ?? 0) + 0.3, d['z' + i] ?? 0]);
  const L: [number, number, number][] = [], R: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz) || 1, lx = -tz / tl * w, lz = tx / tl * w;
    L.push([pts[i][0] + lx, pts[i][1], pts[i][2] + lz]); R.push([pts[i][0] - lx, pts[i][1], pts[i][2] - lz]);
  }
  const top: number[] = [], side: number[] = [];
  const quad = (arr: number[], a: number[], b: number[], c: number[], e: number[]) => arr.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let i = 0; i + 1 < n; i++) {
    // wind each quad so it faces up
    const a = L[i], b = R[i], c = R[i + 1], e = L[i + 1];
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    if (uz * vx - ux * vz >= 0) quad(top, a, b, c, e); else quad(top, a, e, c, b);
    for (const S of [L, R]) { const p = S[i], q2 = S[i + 1]; quad(side, p, q2, [q2[0], q2[1] - 2.2, q2[2]], [p[0], p[1] - 2.2, p[2]]); quad(side, p, [p[0], p[1] - 2.2, p[2]], [q2[0], q2[1] - 2.2, q2[2]], q2); }
  }
  const g = grp();
  for (const [v, color] of [[top, GRAVEL], [side, RUBBLE_DK]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, mat(color)));
  }
  // a lip of loose stones along both edges every few yards
  for (let i = 0; i < n; i += 2) for (const [S, k] of [[L, 1], [R, 2]] as const) { const p = S[i]; if (rnd(i * 7 + k) < 0.55) g.add(ico(0.5 + rnd(i + k * 3) * 0.5, STONE, p[0], p[1] + 0.2, p[2])); }
  return g;
}

/** Low translucent fog lying in a hollow or a courtyard: a few flattened banks of mist within radius `r`. */
export function mistBank(d: Dims): THREE.Group {
  const r = d.r ?? 20, h = d.h ?? 4, n = d.n ?? 6, g = grp(), m = new THREE.MeshBasicMaterial({ color: '#c6ccd4', transparent: true, opacity: d.o ?? 0.22, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const a = rnd(i + r) * Math.PI * 2, rr = r * (0.2 + 0.6 * rnd(i * 3 + r)), s = r * (0.35 + 0.25 * rnd(i * 5));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m); b.scale.set(s, h, s * (0.7 + 0.4 * rnd(i * 9))); b.position.set(Math.cos(a) * rr, h * 0.4, Math.sin(a) * rr); g.add(b);
  }
  return g;
}

// ================================================================== Krezk: cottages, the wall, its towers and gate
/** A Krezk cottage: one storey of pine logs on a stone plinth, a steep thatch roof, a stone chimney at one gable, a
 *  plank door and shuttered windows. Big (`big`) for the burgomaster's: a porch and a second chimney. */
export function cottage(d: Dims): THREE.Group {
  const w = d.w ?? 20, dd = d.d ?? 12, h = d.h ?? 8, s = d.seed ?? w * 7 + dd * 13, long = w >= dd, L = long ? w : dd, S = long ? dd : w;
  const thatch = [THATCH, THATCH_LT, THATCH_DK][Math.floor(rnd(s) * 3)], logc = rnd(s + 1) < 0.5 ? LOG : LOG_DK, R = S * 0.7, y0 = 1;
  const g = grp(box(L + 1, y0, S + 1, STONE, 0, y0 / 2, 0), box(L, h, S, logc, 0, y0 + h / 2, 0));
  // log courses on every face, and the notched log ends standing proud at the corners
  for (let y = y0 + 0.9; y < y0 + h - 0.2; y += 0.9) {
    for (const sz of [-1, 1]) g.add(box(L + 0.1, 0.14, 0.12, LOG_DK, 0, y, sz * (S / 2 + 0.04)));
    for (const sx of [-1, 1]) g.add(box(0.12, 0.14, S + 0.1, LOG_DK, sx * (L / 2 + 0.04), y, 0));
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = y0 + 0.45; y < y0 + h; y += 0.9) g.add(box(0.9, 0.7, 0.9, LOG_END, sx * (L / 2 + 0.25), y, sz * (S / 2 + 0.25)));
  // the gables and the thatch
  for (const sx of [-1, 1]) g.add(gable(S, R, 0.6, logc, sx * (L / 2 - 0.3), y0 + h));
  g.add(pitched(L, S, R, y0 + h, thatch, THATCH_DK, 1.4, 1.3));
  // the chimney at one gable end (both on the big house)
  const ends = d.big ? [-1, 1] : [rnd(s + 2) < 0.5 ? -1 : 1];
  for (const cx of ends) g.add(box(2.8, h + R + 3, 2.8, STONE, cx * (L / 2 + 1.0), (h + R + 3) / 2, S * 0.12), box(3.3, 0.6, 3.3, '#4d4845', cx * (L / 2 + 1.0), h + R + 3.2, S * 0.12));
  // the door: frame, lintel, the boarded leaf with iron straps, a step
  const dside = rnd(s + 3) < 0.5 ? 1 : -1, dx = (rnd(s + 4) - 0.5) * L * 0.4;
  g.add(box(3.8, 6.9, 0.4, BEAM, dx, y0 + 3.45, dside * (S / 2 + 0.15)), box(3.0, 6.3, 0.5, DOOR, dx, y0 + 3.15, dside * (S / 2 + 0.2)), box(4.4, 0.6, 0.5, BEAM, dx, y0 + 7.0, dside * (S / 2 + 0.2)));
  for (const y of [1.6, 5.2]) g.add(box(2.6, 0.25, 0.55, PALETTE.iron, dx, y0 + y, dside * (S / 2 + 0.25)));
  g.add(box(4.2, 0.5, 1.6, STONE, dx, 0.25, dside * (S / 2 + 1.0)));
  // windows: a frame, the dark pane or shut shutters
  const wins: [number, number][] = [[dx + (dx > 0 ? -1 : 1) * L * 0.3, dside], [(rnd(s + 5) - 0.5) * L * 0.5, -dside]];
  for (const [wx, sd] of wins) {
    const open = rnd(s + wx) < 0.5, z = sd * (S / 2 + 0.2);
    g.add(box(3.0, 2.8, 0.3, BEAM, wx, y0 + 4.4, z));
    if (open) g.add(box(2.2, 2.0, 0.34, GLASS, wx, y0 + 4.4, z), box(1.1, 2.4, 0.2, SHUTTER, wx - 1.9, y0 + 4.4, z + sd * 0.05), box(1.1, 2.4, 0.2, SHUTTER, wx + 1.9, y0 + 4.4, z + sd * 0.05));
    else g.add(box(2.4, 2.4, 0.4, SHUTTER, wx, y0 + 4.4, z));
  }
  if (d.big) { // a porch on posts before the door, roofed in thatch
    const pz = dside * (S / 2 + 3);
    for (const px of [-3.5, 3.5]) g.add(box(0.6, 7.2, 0.6, BEAM, dx + px, 3.6 + 0.5, pz + dside * 2));
    const pr = box(9, 0.8, 6, thatch, dx, 8.2, pz); pr.rotation.x = dside * 0.25; g.add(pr);
  }
  const out = grp(g); if (!long) g.rotation.y = Math.PI / 2;
  return out;
}

/** A Krezk thatch roof with log gable ends over a `w` × `d` cottage built as rooms, its eaves at `y` (a cap). */
export function thatchRoof(d: Dims): THREE.Group {
  const w = d.w ?? 34, dd = d.d ?? 20, y = d.y ?? 9, long = w >= dd, L = long ? w : dd, S = long ? dd : w, R = S * 0.7, g = grp();
  for (const sx of [-1, 1]) g.add(gable(S, R, 0.6, LOG, sx * (L / 2 - 0.3), y));
  g.add(pitched(L, S, R, y, THATCH, THATCH_DK, 1.4, 1.3));
  const out = grp(g); if (!long) g.rotation.y = Math.PI / 2;
  return asCap(out);
}

/** A stack of split firewood against a cottage wall. */
export function woodpile(d: Dims): THREE.Group {
  const L = d.len ?? 6, g = grp(box(L, 0.3, 2.2, BEAM, 0, 0.15, 0));
  for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(L / 0.7); i++) { const m = cyl(0.32, 0.32, 2, i % 3 ? LOG_END : LOG, -L / 2 + 0.4 + i * 0.7 + (r % 2) * 0.3, 0.6 + r * 0.6, 0, 6); m.rotation.x = Math.PI / 2; g.add(m); }
  g.add(box(L + 0.6, 0.4, 2.6, THATCH_DK, 0, 3.2, 0));
  return g;
}

/** A run of Krezk's outer wall along local x (`len` ft): mortared stone `h` ft high and `t` ft thick on a plinth, a
 *  battlemented parapet on the outer face (local -z, or +z with `flip`), buttresses outside every 50 ft, and a wooden
 *  ladder from the walk down inside (`ladder`). With `walk`, the wall-walk's own floor caps it (no coping). */
export function krezkWall(d: Dims): THREE.Group {
  const L = d.len ?? 50, H = d.h ?? 20, T = d.t ?? 4, out = d.flip ? 1 : -1, g = grp();
  g.add(box(L + T, 1.4, T + 1.6, RUBBLE_DK, 0, 0.7, 0), box(L + T, H - (d.walk ? 0.05 : 0), T, RUBBLE, 0, (H - (d.walk ? 0.05 : 0)) / 2, 0));
  if (!d.walk) g.add(box(L + T, 0.45, T + 0.4, RUBBLE_DK, 0, H + 0.2, 0));
  g.add(box(L + T, 3.2, 1.0, RUBBLE, 0, H + 1.8, out * (T / 2 - 0.5)));
  for (let x = -L / 2 + 1.2; x < L / 2 - 0.6; x += 3.2) g.add(box(1.7, 1.7, 1.1, RUBBLE, x, H + 4.2, out * (T / 2 - 0.5)));
  const nb = Math.max(1, Math.round(L / 50));
  for (let i = 0; i < nb; i++) {
    const x = -L / 2 + (i + 0.5) * (L / nb), b = box(3.4, H * 0.82, 3.2, RUBBLE, x, H * 0.41, out * (T / 2 + 1.6));
    const cap = box(3.6, 0.6, 4.2, RUBBLE_DK, x, H * 0.82 + 0.6, out * (T / 2 + 1.1)); cap.rotation.x = out * 0.45; g.add(b, cap);
  }
  if (d.ladder) {
    const lz = -out * (T / 2 + 2.5);
    for (const lx of [-0.8, 0.8]) g.add(box(0.25, H + 2, 0.25, BEAM, lx, H / 2 + 1, lz));
    for (let y = 1; y < H + 1; y += 1.2) g.add(box(1.8, 0.18, 0.2, LOG_END, 0, y, lz));
  }
  return g;
}

/** A square stone tower (`w` ft, `h` to the eaves) with a steep slate pyramid, arrow slits, a string course and a
 *  doorway out to the wall-walk at `walk` ft. */
export function squareTower(d: Dims): THREE.Group {
  const w = d.w ?? 14, H = d.h ?? 30, walk = d.walk ?? 20, c = d.ashlar ? ASHLAR : RUBBLE, cdk = d.ashlar ? ASHLAR_DK : RUBBLE_DK;
  const g = grp(box(w + 1.2, 1.4, w + 1.2, cdk, 0, 0.7, 0), box(w, H, w, c, 0, H / 2, 0), box(w + 0.8, 0.6, w + 0.8, cdk, 0, H * 0.6, 0), box(w + 1.4, 1.0, w + 1.4, cdk, 0, H + 0.4, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, w * 1.35, 4), mat(SLATE)); roof.rotation.y = Math.PI / 4; roof.position.y = H + 0.9 + w * 0.675; g.add(roof);
  g.add(box(0.35, 3.5, 0.35, PALETTE.iron, 0, H + w * 1.35 + 2.2, 0), ico(0.45, PALETTE.iron, 0, H + w * 1.35 + 4, 0));
  for (const [x, z, ry] of [[0, -w / 2 - 0.05, 0], [0, w / 2 + 0.05, 0], [w / 2 + 0.05, 0, Math.PI / 2], [-w / 2 - 0.05, 0, Math.PI / 2]] as const) {
    g.add(box(0.6, 4, 0.25, '#141218', x, H * 0.75, z, ry), box(0.6, 3, 0.25, '#141218', x, H * 0.35, z, ry));
  }
  if (walk > 0) for (const sx of [-1, 1]) g.add(box(0.3, 6.5, 3.2, '#141218', sx * (w / 2 + 0.05), walk + 3.4, 0), box(0.5, 0.6, 4, cdk, sx * (w / 2 + 0.1), walk + 6.9, 0));
  return g;
}

/** Krezk's gatehouse (S2): two square towers with peaked roofs flanking a stone arch, twelve-foot ironbound doors under
 *  a carved name stone, a heavy bar behind them. The outer face is local -z. With `base`, the towers stop at the
 *  wall-walk (their archer posts above are built as rooms on the walk's level). */
export function krezkGatehouse(d: Dims): THREE.Group {
  const gap = d.gap ?? 16, tw = d.tw ?? 14, H = d.h ?? 34, WH = d.wh ?? 20, depth = tw * 0.8, g = grp();
  for (const sx of [-1, 1]) {
    const t = d.base ? grp(box(tw + 1.2, 1.4, tw + 1.2, RUBBLE_DK, 0, 0.7, 0), box(tw, WH - 0.05, tw, RUBBLE, 0, (WH - 0.05) / 2, 0), box(0.6, 3, 0.25, '#141218', 0, WH * 0.45, -tw / 2 - 0.05))
      : squareTower({ w: tw, h: H, walk: WH });
    t.position.x = sx * (gap / 2 + tw / 2); g.add(t);
  }
  g.add(box(gap + 0.4, WH - 13.5 - (d.base ? 0.05 : 0), depth, RUBBLE, 0, 13.5 + (WH - 13.5) / 2, 0));
  if (!d.base) g.add(box(gap + 1, 0.5, depth + 0.6, RUBBLE_DK, 0, WH + 0.2, 0));
  g.add(box(gap + 0.4, 3.2, 1.0, RUBBLE, 0, WH + 1.6, -depth / 2 + 0.5));
  for (let x = -gap / 2 + 1.2; x < gap / 2; x += 3.2) g.add(box(1.7, 1.7, 1.1, RUBBLE, x, WH + 4.0, -depth / 2 + 0.5));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(gap / 2, 0.75, 4, 12, Math.PI), mat(RUBBLE_DK)); ring.position.set(0, 12.6 - gap / 2 + 1, -depth / 2 - 0.1); ring.scale.y = 0.35; g.add(ring);
  // the doors and their bands, the bar in its brackets behind them
  for (const sx of [-1, 1]) {
    g.add(box(gap / 2 - 0.2, 12.4, 0.7, DOOR, sx * gap / 4, 6.2, -1.2));
    for (const y of [1.6, 6.2, 10.8]) g.add(box(gap / 2 - 0.4, 0.45, 0.8, PALETTE.iron, sx * gap / 4, y, -1.25));
  }
  g.add(box(gap + 1.6, 0.8, 0.8, BEAM, 0, 6.4, -0.3), box(0.6, 1.4, 1.2, PALETTE.iron, -gap / 2 - 0.2, 6.4, -0.4), box(0.6, 1.4, 1.2, PALETTE.iron, gap / 2 + 0.2, 6.4, -0.4));
  // the name stone over the arch
  g.add(box(6.5, 1.6, 0.4, '#8f8980', 0, 15.2, -depth / 2 - 0.2));
  for (let i = 0; i < 5; i++) g.add(box(0.7, 0.9, 0.12, '#3b3632', -2.4 + i * 1.2, 15.2, -depth / 2 - 0.42));
  return g;
}

/** A square tower's slate pyramid with a finial, `w` ft square at its eaves, sitting at `y` on walls built as rooms. */
export function towerCap(d: Dims): THREE.Group {
  const w = d.w ?? 14, y = d.y ?? 10, g = grp(box(w + 1.4, 1.0, w + 1.4, RUBBLE_DK, 0, y + 0.5, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, w * 1.35, 4), mat(SLATE)); roof.rotation.y = Math.PI / 4; roof.position.y = y + 1 + w * 0.675; g.add(roof);
  g.add(box(0.35, 3.5, 0.35, PALETTE.iron, 0, y + 1 + w * 1.35 + 1.4, 0), ico(0.45, PALETTE.iron, 0, y + 1 + w * 1.35 + 3.2, 0));
  return asCap(g);
}

/** The Shrine of the White Sun's gazebo (S4): an old octagonal gazebo on the verge of collapse, leaning, rails broken. */
export function gazebo(d: Dims): THREE.Group {
  const r = d.r ?? 6.5, g = grp(), inner = grp();
  inner.add(cyl(r + 0.6, r + 0.8, 0.8, STONE, 0, 0.4, 0, 8), cyl(r, r, 0.4, '#5a4632', 0, 1.0, 0, 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * r * 0.92, z = Math.sin(a) * r * 0.92;
    const p = box(0.4, 7.6, 0.4, '#5a4632', x, 1.2 + 3.8, z); p.rotation.z = (rnd(i) - 0.5) * 0.12; inner.add(p);
    if (i === 2 || i === 5) continue;   // the rails are broken through here
    const b = (((i + 1) / 8) * Math.PI * 2) + Math.PI / 8, x2 = Math.cos(b) * r * 0.92, z2 = Math.sin(b) * r * 0.92, L = Math.hypot(x2 - x, z2 - z);
    const rail = box(L, 0.25, 0.2, '#6b5a44', (x + x2) / 2, 3.4, (z + z2) / 2); rail.rotation.y = -Math.atan2(z2 - z, x2 - x); inner.add(rail);
    for (let k = 1; k < 4; k++) inner.add(box(0.14, 2.2, 0.14, '#6b5a44', x + (x2 - x) * k / 4, 2.3, z + (z2 - z) * k / 4));
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 1.4, 5, 8), mat('#4a3a33')); roof.position.y = 1.2 + 7.6 + 2.5; roof.rotation.y = Math.PI / 8; inner.add(roof);
  inner.add(cyl(r + 1.0, r + 1.0, 0.5, BEAM, 0, 1.2 + 7.6, 0, 8), ico(0.5, '#6b5a44', 0, 1.2 + 7.6 + 5.2, 0));
  inner.rotation.z = 0.05; inner.rotation.x = -0.03;
  g.add(inner);
  return g;
}

/** The wooden statue of the Morninglord: a mournful bare-chested man, paint chipped and faded, arms outstretched
 *  toward local +x (the dawn, when the piece is set facing east). */
export function morninglordStatue(): THREE.Group {
  const SK = '#b89a7a', CL = '#8a7f6a', HAIR = '#6b5a44', g = grp(box(2.6, 1.3, 2.6, '#5a4632', 0, 0.65, 0), box(2.9, 0.3, 2.9, '#4a3828', 0, 1.4, 0));
  g.add(cyl(0.95, 1.25, 2.8, CL, 0, 2.95, 0, 7));                                   // the wrapped cloth to the knees
  for (const z of [-0.35, 0.35]) g.add(cyl(0.28, 0.24, 1.6, SK, 0, 2.0, z, 6));
  const torso = cyl(0.85, 0.65, 2.4, SK, 0, 5.4, 0, 7); torso.scale.x = 0.7; g.add(torso);
  g.add(cyl(0.22, 0.25, 0.45, SK, 0, 6.8, 0, 6), ico(0.48, SK, 0.05, 7.4, 0, 1), ico(0.5, HAIR, -0.1, 7.55, 0, 1));
  for (const z of [-1, 1]) {   // arms reaching out to embrace
    const arm = box(2.6, 0.38, 0.38, SK, 1.2, 6.2, z * 0.75); arm.rotation.y = -z * 0.35; arm.rotation.z = 0.12; g.add(arm);
    g.add(ico(0.22, SK, 2.45, 6.5, z * 1.2));
  }
  for (let i = 0; i < 6; i++) g.add(box(0.3, 0.25, 0.06, '#d9cfb5', 0.36, 4.8 + rnd(i) * 1.6, -0.4 + rnd(i + 9) * 0.8));   // where the paint has flaked
  return g;
}

// ================================================================== the abbey
/** The abbey's belfry on the roof ridge: four stone piers under arches, a slate cap with a gilded sun, the bronze bell. */
export function belfry(d: Dims): THREE.Group {
  const w = d.w ?? 9, h = d.h ?? 12, g = grp(box(w + 1.2, 1.2, w + 1.2, ASHLAR_DK, 0, 0.6, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(1.4, h, 1.4, ASHLAR, x * (w / 2 - 0.7), h / 2 + 1.2, z * (w / 2 - 0.7)));
  for (const [x, z, ry] of [[0, -w / 2 + 0.6, 0], [0, w / 2 - 0.6, 0], [w / 2 - 0.6, 0, Math.PI / 2], [-w / 2 + 0.6, 0, Math.PI / 2]] as const) g.add(box(w, 1.6, 1.0, ASHLAR, x, h + 0.4, z, ry));
  g.add(box(w + 1.4, 0.8, w + 1.4, ASHLAR_DK, 0, h + 1.6, 0));
  const capr = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, w * 1.1, 4), mat(SLATE)); capr.rotation.y = Math.PI / 4; capr.position.y = h + 2 + w * 0.55; g.add(capr);
  const top = h + 2 + w * 1.1;
  g.add(box(0.3, 2.6, 0.3, PALETTE.iron, 0, top + 1.2, 0));
  const disk = cyl(1.0, 1.0, 0.2, GOLD, 0, top + 3.0, 0, 12); disk.rotation.x = Math.PI / 2; g.add(disk);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, ray = box(0.16, 0.8, 0.12, GOLD, Math.cos(a) * 1.5, top + 3.0 + Math.sin(a) * 1.5, 0); ray.rotation.z = a - Math.PI / 2; g.add(ray); }
  // the bell under the cap, in its yoke
  const bell = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.2, 2.4), new THREE.Vector2(1.0, 2.2), new THREE.Vector2(1.2, 1.2), new THREE.Vector2(1.8, 0.2), new THREE.Vector2(1.9, 0)], 12), mat(BRONZE));
  bell.position.y = h - 3.4; g.add(bell, box(w - 1.2, 0.5, 0.5, BEAM, 0, h - 0.6, 0));
  return asCap(g);
}

/** Battlements along local x: merlons on a coping, sitting at height `y` (the parapet's top). */
export function merlons(d: Dims): THREE.Group {
  const L = d.len ?? 20, y = d.y ?? 4, t = d.t ?? 1.4, step = 3.2, g = grp(box(L, 0.4, t + 0.3, ASHLAR_DK, 0, y + 0.2, 0));
  for (let x = -L / 2 + step / 2; x < L / 2 - 0.4; x += step) g.add(box(step * 0.55, 2.2, t, ASHLAR, x, y + 1.5, 0));
  return g;
}

/** A stone buttress `h` ft high against a corner or a wall, stepping in twice, its weatherings sloped. */
export function buttress(d: Dims): THREE.Group {
  const h = d.h ?? 15, w = d.w ?? 3.5, dp = d.d ?? 5, g = grp(box(w + 0.6, 1.2, dp + 0.6, ASHLAR_DK, 0, 0.6, 0), box(w, h * 0.6, dp, ASHLAR, 0, h * 0.3, 0), box(w * 0.85, h * 0.4, dp * 0.65, ASHLAR, 0, h * 0.8, -dp * 0.15));
  const cap = box(w, 0.7, dp * 0.8, ASHLAR_DK, 0, h * 0.6 + 0.2, dp * 0.15); cap.rotation.x = 0.5; g.add(cap);
  const cap2 = box(w * 0.85, 0.7, dp * 0.6, ASHLAR_DK, 0, h + 0.1, -dp * 0.1); cap2.rotation.x = 0.55; g.add(cap2);
  return g;
}

/** A scarecrow lashed to a wooden stand: a sackcloth head under a battered cap, straw for limbs, a corroded chain
 *  shirt and a rusted spear (the "guards" on the abbey's walls). With `cross`, a garden scarecrow hung on a cross. */
export function scarecrowStand(d: Dims): THREE.Group {
  const cross = !!d.cross, g = grp(), lift = cross ? 1.6 : 0.4;
  if (cross) g.add(box(0.5, 9.5, 0.5, BEAM, 0, 4.75, -0.45), box(5.4, 0.45, 0.45, BEAM, 0, 7.0, -0.45));
  else g.add(box(3.2, 0.35, 0.6, BEAM, 0, 0.18, 0), box(0.6, 0.35, 3.2, BEAM, 0, 0.18, 0), box(0.45, 7.8, 0.45, BEAM, 0, 4.0, -0.45), box(4.8, 0.4, 0.4, BEAM, 0, 6.6, -0.45));
  for (const x of [-0.35, 0.35]) g.add(cyl(0.26, 0.2, 2.6, STRAW, x, lift + 1.3, 0, 5), box(0.4, 0.4, 0.6, '#2b2420', x, lift + 0.1, 0.1));
  const body = cyl(0.8, 0.65, 2.6, cross ? SACK : CHAIN, 0, lift + 3.6, 0, 7); body.scale.z = 0.7; g.add(body);
  if (cross) g.add(ico(0.75, SACK, 0, lift + 3.4, 0.25, 1));   // the stuffed gullet
  else for (let i = 0; i < 5; i++) g.add(box(0.5, 0.4, 0.08, RUST, -0.5 + rnd(i) * 1.0, lift + 2.8 + rnd(i + 4) * 1.6, 0.55));
  g.add(box(4.2, 0.4, 0.4, cross ? STRAW : CHAIN, 0, lift + 4.7, 0.05));
  g.add(ico(0.62, SACK, 0, lift + 5.6, 0.05, 1), box(0.9, 0.12, 0.1, '#2b2420', 0, lift + 5.55, 0.58));
  const hat = cyl(0.55, 0.75, 0.6, cross ? '#4a3a2c' : PALETTE.iron, 0, lift + 6.2, 0.05, 7); g.add(hat);
  if (!cross) { const sp = box(0.16, 8.5, 0.16, BEAM, 2.0, lift + 3.6, 0.3); sp.rotation.z = -0.08; g.add(sp, cone(0.22, 0.9, RUST, 2.35, lift + 8.25, 0.3, 4)); }
  return g;
}

/** A garden plot: a raised bed of dark earth `w` × `d` with `rows` rows of turnip greens and squash along local x. */
export function gardenPlot(d: Dims): THREE.Group {
  const w = d.w ?? 20, dp = d.d ?? 15, rows = d.rows ?? 4, g = grp(box(w + 0.8, 0.5, dp + 0.8, BEAM, 0, 0.25, 0), box(w, 0.6, dp, SOIL, 0, 0.35, 0));
  for (let r = 0; r < rows; r++) {
    const z = -dp / 2 + (r + 0.5) * (dp / rows);
    g.add(box(w - 1, 0.35, dp / rows * 0.45, '#3e3226', 0, 0.75, z));
    for (let x = -w / 2 + 1; x < w / 2 - 0.5; x += 1.4) {
      const k = r * 31 + Math.round(x * 3);
      if (rnd(k) < 0.15) continue;
      if (rnd(k + 7) < 0.12) g.add(ico(0.45, SQUASH, x, 1.1, z));
      else g.add(ico(0.4 + rnd(k) * 0.25, rnd(k + 1) < 0.5 ? LEAF : LEAF_DK, x, 1.1, z));
    }
  }
  return g;
}

/** A tethering post with iron rings bolted to it. */
export function tetherPost(): THREE.Group {
  const g = grp(box(0.9, 5.5, 0.9, BEAM, 0, 2.75, 0), box(1.1, 0.3, 1.1, BEAM, 0, 5.6, 0));
  for (const [y, ry] of [[3.6, 0], [2.4, Math.PI / 2]] as const) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 4, 10), mat(PALETTE.iron)); r.position.set(Math.sin(ry) * 0.55, y, Math.cos(ry) * 0.55); r.rotation.y = ry; g.add(r); }
  return g;
}

/** An old horse trough, badly rotted: a plank box on stone blocks, one side slumped. */
export function oldTrough(): THREE.Group {
  const g = grp(box(1, 0.8, 2, STONE, -2, 0.4, 0), box(1, 0.8, 2, STONE, 2, 0.4, 0), box(6, 0.3, 2.2, '#4a3828', 0, 1.0, 0), box(6, 1.6, 0.25, '#5a4632', 0, 1.9, -1));
  const slump = box(6, 1.4, 0.25, '#4a3828', 0.3, 1.5, 1.1); slump.rotation.x = 0.45; g.add(slump);
  return g;
}

/** A cauldron on an iron rack over the fire (sits in a hearth). */
export function hearthCauldron(): THREE.Group {
  const g = grp(box(4.6, 0.3, 0.3, PALETTE.iron, 0, 3.6, 0), box(0.3, 3.6, 0.3, PALETTE.iron, -2.2, 1.8, 0), box(0.3, 3.6, 0.3, PALETTE.iron, 2.2, 1.8, 0), box(0.08, 0.9, 0.08, PALETTE.iron, 0, 3.1, 0));
  const pot = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), mat(PALETTE.iron)); pot.position.y = 2.2; g.add(pot);
  g.add(cyl(1.15, 1.15, 0.1, '#8a6b3a', 0, 2.7, 0, 10));
  return g;
}

/** A golden disk engraved with the sun, on a wall (local +z faces the room), centred at height `y`. */
export function sunDisk(d: Dims): THREE.Group {
  const y = d.y ?? 8, r = d.r ?? 1.5, g = grp();
  const disk = cyl(r, r, 0.25, GOLD, 0, y, 0.15, 16); disk.rotation.x = Math.PI / 2; g.add(disk);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, ray = box(0.2, r * 0.6, 0.15, GOLD, Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, 0.12); ray.rotation.z = a - Math.PI / 2; g.add(ray); }
  g.add(ico(r * 0.35, '#d9b850', 0, y, 0.3));
  return g;
}

/** A gold candelabra of five candles, standing on a table top at height `y`. */
export function candelabra(d: Dims): THREE.Group {
  const y = d.y ?? 2.5, g = grp(cyl(0.45, 0.55, 0.2, GOLD, 0, y + 0.1, 0, 8), cyl(0.09, 0.12, 1.6, GOLD, 0, y + 0.95, 0, 6), box(2.4, 0.12, 0.12, GOLD, 0, y + 1.6, 0));
  for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) g.add(cyl(0.12, 0.08, 0.2, GOLD, x, y + 1.75, 0, 6), box(0.16, 0.55, 0.16, PALETTE.bone, x, y + 2.1, 0));
  return g;
}

/** A wrought-iron hospital bed, cobwebbed, a few rags of rotten mattress clinging to it. */
export function ironBed(d: Dims): THREE.Group {
  const s = d.seed ?? 1, g = grp();
  for (const [x, z] of [[-1.5, -3], [1.5, -3], [-1.5, 3], [1.5, 3]]) g.add(box(0.15, z < 0 ? 3.2 : 2.2, 0.15, PALETTE.iron, x, z < 0 ? 1.6 : 1.1, z));
  for (const z of [-3, 3]) { g.add(box(3.2, 0.14, 0.14, PALETTE.iron, 0, z < 0 ? 3.1 : 2.1, z)); for (let k = -1; k <= 1; k++) g.add(box(0.08, z < 0 ? 1.4 : 0.8, 0.08, PALETTE.iron, k * 0.75, z < 0 ? 2.4 : 1.7, z)); }
  for (const x of [-1.5, 1.5]) g.add(box(0.14, 0.14, 6, PALETTE.iron, x, 1.3, 0));
  for (let i = 0; i < 3; i++) if (rnd(s + i) < 0.7) g.add(box(1 + rnd(s + i * 3) * 1.6, 0.25, 0.9 + rnd(s + i * 5), '#6b604c', (rnd(s + i * 7) - 0.5) * 1.6, 1.45, -2 + i * 1.8));
  return g;
}

/** The wreckage of wooden cribs: a tilted frame, loose slats, a cracked headboard. */
export function cribWreck(d: Dims): THREE.Group {
  const s = d.seed ?? 1, g = grp();
  const frame = box(2.4, 0.25, 3.6, '#5a4632', 0, 0.5, 0); frame.rotation.z = 0.35; frame.rotation.y = s; g.add(frame);
  for (let i = 0; i < 7; i++) { const sl = box(0.12, 2.2, 0.15, '#6b5a44', (rnd(s + i) - 0.5) * 3, 0.15, (rnd(s + i + 9) - 0.5) * 3); sl.rotation.z = Math.PI / 2; sl.rotation.y = rnd(s + i * 3) * 3; g.add(sl); }
  const hb = box(2.4, 1.6, 0.2, '#5a4632', 0.8, 0.8, 1.6); hb.rotation.x = -0.7; g.add(hb);
  return g;
}

/** Bunk beds disintegrated with age, slumped into a heap of posts, boards and mouldering straw. */
export function bunkRuin(d: Dims): THREE.Group {
  const s = d.seed ?? 1, g = grp(ico(1.4, '#5e5a3c', 0, 0.4, 0, 1));
  g.children[0].scale.set(1.6, 0.35, 2.2);
  for (let i = 0; i < 8; i++) { const b = box(0.4, 0.25, 5 + rnd(s + i) * 2, i % 2 ? '#4a3828' : '#5a4632', (rnd(s + i * 2) - 0.5) * 2.4, 0.4 + rnd(s + i * 5) * 1.6, (rnd(s + i * 3) - 0.5) * 1.5); b.rotation.x = (rnd(s + i * 7) - 0.5) * 0.8; b.rotation.y = (rnd(s + i * 11) - 0.5) * 0.6; g.add(b); }
  for (let i = 0; i < 3; i++) { const p = box(0.4, 5.5, 0.4, '#4a3828', -1.4 + i * 1.4, 1.5, 2.2); p.rotation.z = 0.4 + i * 0.3; g.add(p); }
  return g;
}

/** A bloodstained operating table with leather straps. */
export function operatingTable(): THREE.Group {
  const g = grp(box(3.2, 0.4, 7, '#5a4632', 0, 2.8, 0));
  for (const [x, z] of [[-1.3, -3.1], [1.3, -3.1], [-1.3, 3.1], [1.3, 3.1]]) g.add(box(0.35, 2.6, 0.35, BEAM, x, 1.3, z));
  for (const [x, z, s] of [[0.2, -1, 1.6], [-0.6, 1.2, 1.1], [0.7, 2.2, 0.8], [-0.2, -2.6, 0.9]]) g.add(box(s, 0.05, s * 0.8, BLOODSTAIN, x, 3.02, z));
  for (const z of [-2, 0, 2]) g.add(box(3.4, 0.1, 0.4, '#3b2a1e', 0, 3.04, z));
  g.add(box(1.4, 0.08, 1.2, BLOODSTAIN, 0.6, 0.05, 0.8));
  return g;
}

/** A long table under a black shroud that covers a humanoid shape. */
export function shroudTable(): THREE.Group {
  const g = grp(box(3.4, 0.3, 7.5, '#5a4632', 0, 2.75, 0));
  for (const [x, z] of [[-1.4, -3.4], [1.4, -3.4], [-1.4, 3.4], [1.4, 3.4]]) g.add(box(0.35, 2.6, 0.35, BEAM, x, 1.3, z));
  const lump = ico(1.2, SHROUD, 0, 3.4, 0, 1); lump.scale.set(1.1, 0.55, 3.0); g.add(lump, ico(0.6, SHROUD, 0, 3.55, -2.6, 1));
  for (const sx of [-1, 1]) { const drape = box(0.1, 1.5, 6.8, SHROUD, sx * 1.75, 2.3, 0); drape.rotation.z = sx * 0.08; g.add(drape); }
  return g;
}

/** A small worktable laid with the golem-maker's tools: a saw, needles and thread, a mallet. */
export function toolTable(): THREE.Group {
  const g = grp(box(3.6, 0.25, 2.2, '#5a4632', 0, 2.6, 0));
  for (const [x, z] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) g.add(box(0.25, 2.5, 0.25, BEAM, x, 1.25, z));
  g.add(box(1.8, 0.05, 0.6, PALETTE.mist1, -0.6, 2.76, -0.3), box(0.5, 0.2, 0.25, BEAM, 0.4, 2.8, -0.3), cyl(0.2, 0.2, 0.3, PALETTE.bone, 1.1, 2.9, 0.4, 8), cyl(0.15, 0.15, 0.3, BLOODSTAIN, 0.6, 2.9, 0.5, 8));
  for (let i = 0; i < 4; i++) g.add(box(0.6, 0.04, 0.04, PALETTE.mist0, -0.9 + i * 0.25, 2.75, 0.6));
  g.add(box(0.3, 0.3, 1.0, BEAM, 1.2, 2.85, -0.4));
  return g;
}

/** A cot heaped with furs, empty wine bottles strewn round it. */
export function furCot(d: Dims): THREE.Group {
  const s = d.seed ?? 3, g = grp(box(3.2, 1.2, 6.5, BEAM, 0, 0.6, 0));
  for (let i = 0; i < 4; i++) { const f = ico(1.3, i % 2 ? FUR : FUR_LT, (rnd(s + i) - 0.5) * 1.2, 1.5 + i * 0.12, -2 + i * 1.3, 1); f.scale.set(1.2, 0.4, 1.0); g.add(f); }
  for (let i = 0; i < 6; i++) { const b = cyl(0.17, 0.2, 0.9, BOTTLE, 2.2 + rnd(s + i) * 1.6, 0.2, -2.5 + rnd(s + i * 3) * 5, 6); b.rotation.z = Math.PI / 2; b.rotation.y = rnd(i) * 3; g.add(b); }
  return g;
}

/** A bell rope hanging from the belfry through the loft, its tail coiled at height `y` (default 3 ft). */
export function bellRope(d: Dims): THREE.Group {
  const top = d.top ?? 30, y = d.y ?? 3;
  return grp(box(0.18, top - y, 0.18, HEMP, 0, (top + y) / 2, 0), ico(0.35, HEMP, 0, y, 0));
}

/** An upright wine barrel, its hoops, and the winery's painted mark. */
export function wineBarrel(d: Dims): THREE.Group {
  const r = d.r ?? 1.4, h = d.h ?? 3.6, pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * (0.86 + 0.14 * Math.sin(t * Math.PI)), t * h)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat(PALETTE.wood)), g = grp(body, cyl(r * 0.86, r * 0.86, 0.1, PALETTE.woodDark, 0, h, 0, 12));
  for (const y of [0.35, h * 0.3, h * 0.7, h - 0.35]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (0.88 + 0.12 * Math.sin((y / h) * Math.PI)) + 0.03, 0.06, 4, 16), mat(PALETTE.iron)); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  g.add(box(0.9, 0.7, 0.08, d.fine ? PALETTE.wine : '#5b4a6b', 0, h * 0.5, r + 0.02));
  return g;
}

/** A wooden wine rack `len` ft long packed with bottles, their necks toward local +z. */
export function wineRack(d: Dims): THREE.Group {
  const L = d.len ?? 20, H = d.h ?? 6, g = grp(box(L, H, 0.3, BEAM, 0, H / 2, -0.9), box(L, 0.25, 2, '#5a4632', 0, 0.12, 0), box(L, 0.25, 2, '#5a4632', 0, H, 0));
  for (let x = -L / 2; x <= L / 2 + 0.01; x += L / Math.max(1, Math.round(L / 4))) g.add(box(0.3, H, 2, BEAM, x, H / 2, 0));
  for (let y = 0.7; y < H - 0.4; y += 0.85) for (let x = -L / 2 + 0.5; x < L / 2 - 0.3; x += 0.7) if (rnd(x * 13 + y * 7) > 0.18) { const b = cyl(0.16, 0.16, 0.5, BOTTLE, x, y, 0.75, 6); b.rotation.x = Math.PI / 2; g.add(b); }
  return g;
}

/** Shattered furniture heaped in a corner: splintered boards, a broken chair, rags. */
export function debris(d: Dims): THREE.Group {
  const s = d.seed ?? 1, n = d.n ?? 9, r = d.r ?? 2.5, g = grp();
  for (let i = 0; i < n; i++) { const b = box(0.3 + rnd(s + i) * 0.5, 0.2, 1.5 + rnd(s + i * 2) * 3, i % 3 ? '#5a4632' : '#4a3828', (rnd(s + i * 3) - 0.5) * r * 2, 0.2 + rnd(s + i * 5) * 0.8, (rnd(s + i * 7) - 0.5) * r * 2); b.rotation.set((rnd(s + i * 11) - 0.5) * 0.9, rnd(s + i * 13) * 3, (rnd(s + i * 17) - 0.5) * 0.9); g.add(b); }
  if (n > 6) { const rag = ico(0.9, '#5a4a52', (rnd(s) - 0.5) * r, 0.3, (rnd(s + 1) - 0.5) * r, 1); rag.scale.y = 0.3; g.add(rag); }
  return g;
}

/** The mongrelfolk fort: furniture piled into a hut and hung with torn draperies. */
export function furnitureFort(): THREE.Group {
  const g = debris({ seed: 5, n: 16, r: 3.5 });
  for (const [x, z, ry, c] of [[-1.5, 0, 0.3, PALETTE.wine], [1.2, -1, -0.5, '#5b4a6b'], [0, 1.5, 1.2, '#5a2a30']] as const) { const dr = box(4.5, 3.5, 0.15, c, x, 2, z, ry); dr.rotation.z = 0.5; g.add(dr); }
  g.add(box(0.3, 4.5, 0.3, '#4a3828', 0, 2.25, 0));
  return g;
}

/** A life-sized painted wooden statue of a saintly woman in robes, bitten all over. */
export function saintStatue(): THREE.Group {
  const g = grp(box(2.2, 0.6, 2.2, '#5a4632', 0, 0.3, 0), cyl(0.85, 1.15, 3.6, '#8fa3b8', 0, 2.4, 0, 8), cyl(0.7, 0.8, 1.2, '#c9c2b2', 0, 4.6, 0, 8));
  g.add(ico(0.42, '#c9a98a', 0, 5.6, 0, 1), cone(0.6, 1.0, '#8fa3b8', 0, 5.75, -0.1, 7), box(0.6, 0.7, 0.3, '#c9a98a', 0, 4.4, 0.75));
  for (let i = 0; i < 7; i++) g.add(box(0.25, 0.2, 0.05, '#4a3828', (rnd(i) - 0.5) * 1.2, 1.2 + rnd(i + 3) * 3.4, 0.95));
  return g;
}

/** A heap of musty animal furs (a gate guard's bed). */
export function furPile(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 4; i++) { const f = ico(1.4, [FUR, FUR_LT, '#4a3a2e', '#6b6058'][i], (rnd(i) - 0.5) * 1.5, 0.35 + i * 0.12, (rnd(i + 5) - 0.5) * 2, 1); f.scale.set(1.4, 0.3, 1.1); f.rotation.y = i; g.add(f); }
  return g;
}

/** A net of twigs and pine needles hung on a wall peg, a shovel leaning beside it. */
export function netAndShovel(): THREE.Group {
  const g = grp(box(0.3, 0.3, 0.6, BEAM, 0, 6.2, -0.2));
  const net = box(3.0, 3.6, 0.2, '#4a4a32', 0, 4.4, 0); net.rotation.z = 0.06; g.add(net);
  for (let i = 0; i < 6; i++) g.add(box(2.8, 0.08, 0.25, '#5a4632', 0, 3 + i * 0.55, 0.08));
  const shaft = box(0.18, 4.8, 0.18, BEAM, 2.4, 2.4, 0.2); shaft.rotation.z = -0.18; g.add(shaft, box(0.9, 1.1, 0.12, PALETTE.iron, 2.85, 0.5, 0.2));
  return g;
}

/** Iron gates on rusty hinges: two leaves of bars across `w` ft. */
export function ironGates(d: Dims): THREE.Group {
  const w = d.w ?? 10, h = d.h ?? 7, g = grp();
  for (const sx of [-1, 1]) {
    const leaf = grp(); leaf.position.x = sx * w / 2;
    for (let i = 0; i < 5; i++) { const x = -sx * (0.4 + i * (w / 2 - 0.6) / 4); leaf.add(box(0.16, h, 0.16, PALETTE.iron, x, h / 2, 0), cone(0.16, 0.6, PALETTE.iron, x, h + 0.3, 0, 4)); }
    for (const y of [0.6, h * 0.5, h - 0.5]) leaf.add(box(w / 2 - 0.3, 0.16, 0.18, PALETTE.iron, -sx * (w / 4), y, 0));
    leaf.rotation.y = sx * 0.12;
    g.add(leaf);
  }
  return g;
}

/** A tarnished copper plaque on a wall face (local +z), at height `y`. */
export function plaque(d: Dims): THREE.Group { const y = d.y ?? 6; return grp(box(2.6, 1.6, 0.15, COPPER, 0, y, 0.1), box(2.2, 0.14, 0.05, '#2f4a40', 0, y + 0.3, 0.2), box(1.8, 0.1, 0.05, '#2f4a40', 0, y - 0.2, 0.2)); }

/** Empty wine bottles strewn on a floor. */
export function bottles(d: Dims): THREE.Group {
  const s = d.seed ?? 2, n = d.n ?? 5, g = grp();
  for (let i = 0; i < n; i++) { const b = cyl(0.17, 0.2, 0.9, BOTTLE, (rnd(s + i) - 0.5) * 3, 0.2, (rnd(s + i * 3) - 0.5) * 3, 6); if (rnd(s + i * 5) < 0.7) b.rotation.z = Math.PI / 2; else b.position.y = 0.45; b.rotation.y = rnd(s + i * 7) * 3; g.add(b); }
  return g;
}

/** An unlit lantern hanging from a rafter at height `y`. */
export function hangingLantern(d: Dims): THREE.Group { const y = d.y ?? 9; return grp(box(0.08, 2, 0.08, PALETTE.iron, 0, y + 1, 0), box(0.7, 0.9, 0.7, '#2b2a2e', 0, y - 0.4, 0), box(0.5, 0.6, 0.5, '#6b6a5a', 0, y - 0.4, 0)); }

Object.assign(PROPS_V1, {
  heightfield, 'road-ribbon': roadRibbon, 'mist-bank': mistBank,
  cottage, 'thatch-roof': thatchRoof, woodpile, 'krezk-wall': krezkWall, 'square-tower': squareTower, 'tower-cap': towerCap, 'krezk-gatehouse': krezkGatehouse, gazebo, 'morninglord-statue': morninglordStatue,
  belfry, merlons, buttress, 'scarecrow-stand': scarecrowStand, 'garden-plot': gardenPlot, 'tether-post': tetherPost, 'old-trough': oldTrough,
  'hearth-cauldron': hearthCauldron, 'sun-disk': sunDisk, candelabra, 'iron-bed': ironBed, 'crib-wreck': cribWreck, 'bunk-ruin': bunkRuin,
  'operating-table': operatingTable, 'shroud-table': shroudTable, 'tool-table': toolTable, 'fur-cot': furCot, 'bell-rope': bellRope,
  'wine-barrel': wineBarrel, 'wine-rack': wineRack, debris, 'furniture-fort': furnitureFort, 'saint-statue': saintStatue, 'fur-pile': furPile,
  'net-and-shovel': netAndShovel, 'iron-gates': ironGates, plaque, bottles, 'hanging-lantern': hangingLantern,
} as Record<string, (d: Dims) => THREE.Object3D>);

// ================================================================== figures
/** The humanoid's upper body (it carries the head, arms and anything worn above the hips). */
function upperOf(g: THREE.Group): THREE.Group { return (g.children.find((c) => (c as THREE.Group).isGroup) as THREE.Group) ?? g; }

/** A mongrelfolk: a hunched Belview, part human, part a dozen beasts. `v` picks the mix (0 Otto, 1 Zygfrek, 2 Mishka,
 *  3 Marzena, 4 Clovin with his viol, 5–9 the madhouse's nameless). */
export function mongrelfolk(d: Dims = {}): THREE.Group {
  const v = (d.v ?? 5) | 0, s = (d.scale ?? 1) * (v === 2 ? 0.95 : 0.85);
  const SK = ['#a67c5b', '#9a8a70', '#c9a98a', '#8a7a6a', '#a8957a', '#b08a6a', '#8f7a5f', '#a07a5a', '#9a8070', '#b0906a'][v % 10];
  const opts: HumanoidOpts = { skin: SK, cloth: v === 4 ? '#5a4632' : v === 1 ? '#5a5d63' : ['#4a3a2c', '#5a4a3a', '#3b352c'][v % 3], trim: '#3b2d22', scale: s, hunch: v === 3 ? 0.5 : 0.3, robe: v === 4, cloak: v === 1, hair: v === 3 ? '#141218' : v === 0 ? undefined : '#3a2a1a', claws: v >= 5 && v % 2 === 1 };
  const g = humanoid(opts), up = upperOf(g), hy = 2.82 * s;
  const head = (o: THREE.Object3D) => { up.add(o); return o; };
  if (v === 0) { // donkey ears, a wolf's snout, a donkey's tail
    for (const sx of [-1, 1]) { const e = cone(0.15 * s, 0.9 * s, '#6b5a4a', sx * 0.3 * s, hy + 0.6 * s, -0.05 * s, 5); e.rotation.z = -sx * 0.4; head(e); }
    head(box(0.35 * s, 0.3 * s, 0.5 * s, '#5b5a5e', 0, hy - 0.12 * s, 0.5 * s));
    const t = cone(0.12 * s, 1.4 * s, '#6b5a4a', 0, 2.2 * s, -0.5 * s, 5); t.rotation.x = -2.4; g.add(t);
  } else if (v === 1) { // lizard scales down one side, grey wolf fur on the other
    head(box(0.45 * s, 0.7 * s, 0.6 * s, '#5f6b50', -0.2 * s, hy, 0.05 * s)); head(ico(0.32 * s, '#7a7a7a', 0.25 * s, hy + 0.05 * s, 0, 0));
  } else if (v === 2) { // three red spider eyes on the right of the face; a crow's foot
    for (let i = 0; i < 3; i++) head(ico(0.07 * s, '#a83a30', 0.18 * s + (i % 2) * 0.1 * s, hy + 0.12 * s - i * 0.09 * s, 0.4 * s));
    g.add(box(0.15 * s, 0.1 * s, 0.9 * s, '#2b2420', 0.3 * s, 0.05, 0.3 * s));
  } else if (v === 3) { // bat wings and spider mandibles
    for (const sx of [-1, 1]) { const w = box(2.6 * s, 2.0 * s, 0.1 * s, '#2b2228', sx * 1.5 * s, 1.9 * s, -0.4 * s); w.rotation.z = sx * 0.45; w.rotation.y = sx * 0.3; up.add(w); }
    for (const sx of [-1, 1]) { const m = cone(0.07 * s, 0.45 * s, '#3b2d22', sx * 0.12 * s, hy - 0.35 * s, 0.38 * s, 4); m.rotation.x = 2.6; head(m); }
  } else if (v === 4) { // Clovin: a second, half-formed head, goat horns, a crab's pincer, and his viol
    head(ico(0.24 * s, '#6b7a5a', -0.55 * s, hy - 0.1 * s, 0.05 * s, 1));
    for (const sx of [-1, 1]) { const h = cone(0.09 * s, 0.4 * s, PALETTE.bone, sx * 0.2 * s, hy + 0.5 * s, 0, 4); h.rotation.z = -sx * 0.5; head(h); }
    up.add(box(0.35 * s, 0.25 * s, 0.5 * s, '#a83a30', -0.9 * s, -0.25 * s, 0.4 * s));
    const viol = grp(ico(0.4 * s, '#7a4a2a', 0, 0, 0, 1), box(0.12 * s, 1.0 * s, 0.1 * s, '#2b2420', 0, 0.7 * s, 0)); viol.children[0].scale.set(0.8, 1.2, 0.35); viol.position.set(0.2 * s, 1.4 * s, 0.6 * s); viol.rotation.z = 0.3; g.add(viol);
    g.add(cyl(0.68 * s, 0.68 * s, 0.12 * s, HEMP, 0, 3.25 * s, 0, 7));
  } else { // the madhouse: horns, tusks, a snout, a beak, feathers
    const k = v % 5;
    if (k === 0) for (const sx of [-1, 1]) { const h = cone(0.1 * s, 0.5 * s, PALETTE.bone, sx * 0.22 * s, hy + 0.48 * s, 0, 4); h.rotation.z = -sx * 0.5; head(h); }
    if (k === 1) { head(box(0.3 * s, 0.25 * s, 0.35 * s, '#c9a0a0', 0, hy - 0.12 * s, 0.45 * s)); for (const sx of [-1, 1]) head(cone(0.04 * s, 0.25 * s, PALETTE.bone, sx * 0.12 * s, hy - 0.05 * s, 0.6 * s, 4)); }
    if (k === 2) head(cone(0.12 * s, 0.4 * s, '#8a6a3a', 0, hy - 0.05 * s, 0.55 * s, 4)).rotation.x = Math.PI / 2;
    if (k === 3) for (let i = 0; i < 4; i++) head(box(0.06 * s, 0.4 * s, 0.25 * s, '#5a3a2a', 0, hy + 0.45 * s, -0.2 * s + i * 0.12 * s));
    if (k === 4) for (const sx of [-1, 1]) { const e = cone(0.12 * s, 0.4 * s, SK, sx * 0.33 * s, hy + 0.35 * s, 0, 4); e.rotation.z = -sx * 0.7; head(e); }
  }
  return g;
}

/** The Abbot's rudimentary flesh golem: seven feet of stitched-together human parts in mismatched tones. */
export function fleshGolem(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.28, g = humanoid({ skin: '#b39a86', cloth: '#a08a78', trim: '#4a3a2c', scale: s, hunch: 0.15, hair: undefined });
  const up = upperOf(g);
  for (const [x, y, z, w, h, c] of [[0.35, 1.5, 0.42, 0.6, 0.7, '#8f9a86'], [-0.3, 0.9, 0.44, 0.5, 0.6, '#c9a98a'], [0.1, 0.6, 0.45, 0.9, 0.1, '#2b2420'], [-0.2, 1.9, 0.43, 0.08, 0.8, '#2b2420'], [0.4, 1.1, 0.46, 0.7, 0.08, '#2b2420']] as const) up.add(box(w * s, h * s, 0.05 * s, c, x * s, y * s, z * s));
  for (const sx of [-1, 1]) up.add(box(0.1 * s, 0.05 * s, 0.45 * s, '#2b2420', sx * 0.86 * s, 1.6 * s, 0.05 * s));
  up.add(box(0.5 * s, 0.05 * s, 0.05 * s, '#2b2420', 0, 2.7 * s, 0.4 * s));
  return g;
}

/** The Abbot: a handsome young man in a brown monk's robe with a painted wooden sun on a chain. */
export function abbot(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1.05, g = humanoid({ skin: '#e2c4a8', cloth: '#5a4030', trim: '#3b2a1e', hair: '#7a5a3a', robe: true, scale: s }), up = upperOf(g);
  const sun = cyl(0.2 * s, 0.2 * s, 0.06 * s, '#c9a227', 0, 1.6 * s, 0.48 * s, 10); sun.rotation.x = Math.PI / 2; up.add(sun, box(0.05 * s, 0.6 * s, 0.05 * s, '#2b2420', 0, 1.95 * s, 0.45 * s));
  g.add(cyl(0.66 * s, 0.66 * s, 0.14 * s, HEMP, 0, 3.25 * s, 0, 7));
  return g;
}

/** Vasilka: a bride of stitched parts, alabaster-skinned, auburn hair bundled, in a torn and soiled red gown. */
export function vasilka(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#e8e2da', cloth: '#7a1f2b', trim: '#5a1620', hair: '#8a3a20', skirt: true, robe: true, scale: s }), up = upperOf(g);
  up.add(ico(0.26 * s, '#8a3a20', 0, 2.95 * s, -0.38 * s, 1));
  for (const sx of [-1, 1]) up.add(box(0.04 * s, 0.04 * s, 0.38 * s, '#6b5a5a', sx * 0.86 * s, 1.2 * s, 0.05 * s));
  up.add(box(0.36 * s, 0.03 * s, 0.03 * s, '#6b5a5a', 0, 2.35 * s, 0.2 * s));
  g.add(box(0.8 * s, 0.5 * s, 0.1 * s, '#3b1218', 0.4 * s, 1.2 * s, 0.95 * s));
  return g;
}

/** A Krezk guard or archer in a fur hat (`bow` for the archers in the gate towers). */
export function krezkGuard(d: Dims = {}): THREE.Group {
  const bow = !!d.bow, g = humanoid({ skin: '#d9b899', cloth: bow ? '#4a5248' : '#5b4a3a', trim: '#3b2d22', hair: '#3a2a1a', weapon: bow ? 'none' : 'spear', scale: d.scale ?? 1 }), up = upperOf(g);
  up.add(cyl(0.48, 0.5, 0.55, FUR, 0, 3.2, 0, 8), cyl(0.52, 0.52, 0.15, FUR_LT, 0, 2.95, 0, 8));
  if (bow) { const b = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 4, 10, Math.PI * 0.8), mat(BEAM)); b.position.set(-0.95, 0.1, 0.35); b.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.4); up.add(b); }
  return g;
}

/** A Krezkov: the burgomaster (`f` 0) in a fur-trimmed coat, or his wife Anna (`f` 1). */
export function krezkNoble(d: Dims = {}): THREE.Group {
  const anna = (d.f ?? 0) === 1, g = humanoid({ skin: '#d9b899', cloth: anna ? '#4a3a52' : '#3a4a5a', trim: '#2b2420', hair: anna ? '#5a4632' : '#7a7a7a', skirt: anna, scale: anna ? 0.95 : 1.05 }), up = upperOf(g);
  up.add(cyl(0.78, 0.78, 0.35, FUR_LT, 0, 2.15, 0, 8));
  if (!anna) up.add(box(0.12, 0.12, 0.12, '#c9a227', 0, 1.6, 0.48));
  return g;
}

/** A raven on its perch (at height `y`). */
export function raven(d: Dims = {}): THREE.Group {
  const y = d.y ?? 0, C = '#141218', g = grp(), body = ico(0.35, C, 0, y + 0.45, 0, 1); body.scale.set(1.5, 0.9, 0.85);
  g.add(body, ico(0.2, C, 0.45, y + 0.75, 0, 1), cone(0.07, 0.3, '#2b2420', 0.72, y + 0.73, 0, 4).rotateZ(-Math.PI / 2), box(0.6, 0.08, 0.3, C, -0.6, y + 0.4, 0));
  for (const z of [-0.1, 0.1]) g.add(box(0.04, 0.4, 0.04, '#2b2420', 0, y + 0.15, z));
  return g;
}
/** A white rabbit nibbling. */
export function rabbit(): THREE.Group {
  const W = '#e8e4dc', g = grp(), b = ico(0.45, W, 0, 0.45, 0, 1); b.scale.set(1.3, 0.85, 0.9);
  g.add(b, ico(0.25, W, 0.5, 0.65, 0, 1), ico(0.12, W, -0.55, 0.5, 0, 0));
  for (const z of [-0.08, 0.08]) { const e = box(0.08, 0.45, 0.12, W, 0.45, 1.05, z); e.rotation.z = 0.25; g.add(e); }
  return g;
}

Object.assign(CREATURES, {
  mongrelfolk: (d) => mongrelfolk(d), 'flesh-golem': (d) => fleshGolem(d), abbot: (d) => abbot(d), vasilka: (d) => vasilka(d),
  'krezk-guard': (d) => krezkGuard(d), 'krezk-noble': (d) => krezkNoble(d), raven: (d) => raven(d), rabbit: () => rabbit(),
} as Record<string, (d: Dims) => THREE.Group>);
