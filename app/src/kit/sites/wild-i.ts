// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'i-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// I. Black Carriage: the fork where the peasants' dirt track meets the Count's dead cobbled road. The street furniture of
// that road (the dead lamp standard, the coach stand, the toll bar, the guard-post shell, the passage quarried through a
// fallen block), the shelf it is cut into (crag above, drystone revetment below), the rill that crosses it, and the few
// living things on it: the coach's lamps and the team's breath. Feet; origin at the floor centre; +z is plan south.
// Path-shaped pieces (the cobbled crown, the ruts, the revetment, the gutters, the crag face) take their plan polyline in
// dims as n, x0, z0, x1, z1 … (feet, relative to the object's position, rotY 0).
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { FLOOR_COLOR, PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { box, cyl, grp, hash, lump, place } from '../shapes';

type Dims = Record<string, number>;
type P2 = [number, number];

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  rock: '#5c5a56', rockDeep: '#4b4945', rockPale: '#6c6964', rockDark: '#43423f', talus: '#625f59', gravel: '#58554f',
  cut: '#6a675f', cutDeep: '#5a5751', toolMark: '#46443f', lichen: '#737a62', lichenPale: '#8b8f78', seep: '#383733', moss: '#3d4733',
  cleft: '#121114', shadow: '#26282b', shadowSoft: '#33363a',
  sett: '#5b5d62', settDeep: '#4f5156', settPale: '#6a6b6e', kerb: '#6b6862', kerbDeep: '#5a5853',
  dry: '#67645d', dryDeep: '#57544e', dryPale: '#75716a', mud: '#4a3f34', mudDark: '#3b322a', rut: '#2f2924',
  rime: '#a9adb1', ice: '#8d9ca7', iceDeep: '#788995', water: '#2f404c', slick: '#4a5745', slickDeep: '#3e4a3b',
  iron: '#2d2e32', ironRust: '#4f3427', rust: '#573a2d', ashlar: '#6e6a63', ashlarDeep: '#5d5a54', device: '#625f58',
  rubble: '#6d6860', rubbleDeep: '#5c5852', hearth: '#3a3633', soot: '#1f1d1c', needles: '#6b5236', needlesDeep: '#57422c',
  bark: '#45362a', barkDead: '#7b766d', barkGrey: '#625d55', leather: '#4a3526', leatherDark: '#382819', twine: '#8a7a58',
  bone: '#d8cfb6', boneDark: '#b3a98f', chain: '#55585e', chainDark: '#3f4247', glove: '#141216', card: '#d6ceb8', seal: '#6a1c24',
  electrum: '#b8ad7a', trinket: '#8a7a64', fog0: '#d8dade', fog1: '#c4c7cd', fog2: '#aeb2b9',
} as const;
surfaceFor([C.rock, C.rockDeep, C.rockPale, C.rockDark, C.talus, C.gravel, C.seep], 'rock');
surfaceFor([C.cut, C.cutDeep, C.toolMark, C.ashlar, C.ashlarDeep, C.device, C.kerb, C.kerbDeep], 'ashlar');
surfaceFor([C.dry, C.dryDeep, C.dryPale, C.rubble, C.rubbleDeep, C.hearth], 'rubble');
surfaceFor([C.sett, C.settDeep, C.settPale, C.slick, C.slickDeep], 'cobble');
surfaceFor([C.lichen, C.lichenPale, C.moss], 'foliage');
surfaceFor([C.mud, C.mudDark, C.rut, C.needles, C.needlesDeep], 'dirt');
surfaceFor([C.ice, C.iceDeep, C.water], 'water');
surfaceFor([C.iron, C.ironRust, C.rust, C.chain, C.chainDark, C.electrum], 'metal');
surfaceFor([C.bark, C.barkDead, C.barkGrey], 'bark');
surfaceFor([C.leather, C.leatherDark, C.twine, C.glove, C.card], 'cloth');
surfaceFor([C.cleft, C.shadow, C.shadowSoft, C.rime, C.soot, C.seal, C.fog0, C.fog1, C.fog2], 'none');
surfaceFor([C.bone, C.boneDark, C.trinket], 'generic');

// ---------------------------------------------------------------- helpers
const jit = (i: number, s: number, a: number) => (hash(i, s) - 0.5) * 2 * a;
/** A flat irregular plate lying in the xz plane at height y (a puddle, a patch of rime, a drift of needles). */
function plate(r: number, color: string, seed: number, y: number, sx = 1.4, n = 8): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (0.6 + 0.5 * hash(i, seed)); pts.push(new THREE.Vector2(Math.cos(a) * k * sx, Math.sin(a) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, mat(color));
}
/** A quad-strip surface through rows of points (each row the same length): a crag face, a ribbon, a ramp. Each
 *  triangle is wound to face along `hint(column)` (default up), so the shared single-sided material shows it. */
function sheet(rows: THREE.Vector3[][], color: string, hint?: (i: number) => THREE.Vector3): THREE.Mesh {
  const pos: number[] = [], up = new THREE.Vector3(0, 1, 0), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, h: THREE.Vector3) => {
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    if (n.dot(h) >= 0) pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); else pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  };
  for (let r = 0; r + 1 < rows.length; r++) for (let i = 0; i + 1 < rows[r].length; i++) {
    const a = rows[r][i], b = rows[r][i + 1], c = rows[r + 1][i], d = rows[r + 1][i + 1], h = hint ? hint(i) : up;
    tri(a, c, b, h); tri(b, c, d, h);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color));
}
/** The polyline a path-shaped piece carries in its dims. */
function polyline(d: Dims, px = 'x', pz = 'z'): P2[] {
  const n = d.n ?? 0, out: P2[] = [];
  for (let i = 0; i < n; i++) out.push([d[px + i] ?? 0, d[pz + i] ?? 0]);
  if (out.length < 2) { const L = d.len ?? 20; return [[-L / 2, 0], [L / 2, 0]]; }
  return out;
}
interface Sample { x: number; z: number; tx: number; tz: number; nx: number; nz: number; s: number; f: number; seg: number; t: number }
/** Points every `step` ft along a polyline with the unit tangent and the left normal (-tz, tx) (for a road heading
 *  east that is south, as the authoring scripts offset). */
function walk(line: P2[], step: number): Sample[] {
  const segs: number[] = []; let total = 0;
  for (let i = 0; i + 1 < line.length; i++) { const L = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]); segs.push(L); total += L; }
  const n = Math.max(1, Math.round(total / step)), out: Sample[] = [];
  for (let k = 0; k <= n; k++) {
    let goal = (k / n) * total, i = 0;
    while (i < segs.length - 1 && goal > segs[i]) { goal -= segs[i]; i++; }
    const L = segs[i] || 1, t = Math.min(1, goal / L), a = line[i], b = line[i + 1];
    // smooth the tangent across a vertex so offsets do not tear at the joints
    let tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    if (t > 0.85 && i + 2 < line.length) { const c = line[i + 2], L2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1, w = (t - 0.85) / 0.3; tx = tx * (1 - w) + ((c[0] - b[0]) / L2) * w; tz = tz * (1 - w) + ((c[1] - b[1]) / L2) * w; }
    if (t < 0.15 && i > 0) { const c = line[i - 1], L0 = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1, w = (0.15 - t) / 0.3; tx = tx * (1 - w) + ((a[0] - c[0]) / L0) * w; tz = tz * (1 - w) + ((a[1] - c[1]) / L0) * w; }
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    out.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx, tz, nx: -tz, nz: tx, s: (k / n) * total, f: k / n, seg: i, t });
  }
  return out;
}
const yawOf = (tx: number, tz: number) => Math.atan2(-tz, tx);   // rotation.y that turns local +x along (tx, tz)
/** A box laid along the path at a sample, offset `o` ft along the normal. */
function along(s: Sample, o: number, w: number, h: number, d: number, c: string, y: number, roll = 0): THREE.Mesh {
  const m = box(w, h, d, c, s.x + s.nx * o, y, s.z + s.nz * o, yawOf(s.tx, s.tz)); m.rotation.x = roll; return m;
}
/** Per-point widths along a polyline (w0, w1 …), interpolated at a sample. */
function widthAt(d: Dims, s: Sample, base: number): number {
  const a = d['w' + s.seg], b = d['w' + (s.seg + 1)];
  if (a === undefined || b === undefined) return base;
  return a + (b - a) * s.t;
}

// ---------------------------------------------------------------- soft sprites (vapour, glow): never merged or tinted
let softTex: THREE.Texture | null = null;
function soft(): THREE.Texture | null {
  if (softTex || typeof document === 'undefined') return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); softTex = new THREE.CanvasTexture(c); return softTex;
}
const spriteMats = new Map<string, THREE.SpriteMaterial>();
function sprite(color: string, opacity: number, size: number, additive: boolean): THREE.Sprite {
  const k = color + opacity + additive;
  let m = spriteMats.get(k);
  if (!m) { m = new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }); spriteMats.set(k, m); }
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.raycast = () => {}; return s;
}

// ---------------------------------------------------------------- the Count's road
/** The cobbled east arm: a cambered crown of worn setts with mud breaking through in long patches, broken kerb stones on
 *  both edges and a stone gutter outside the uphill kerb. Polyline in dims (n, x_i, z_i), full width `w` (or per point
 *  w_i, so it can narrow through a gap), gutter on side `gs` (-1: the side opposite the left normal, i.e. north for a
 *  road heading east), `mud` 0..1 how much of it the mud has taken (more toward its start). */
export function cobbleCrown(d: Dims): THREE.Group {
  const line = polyline(d), W = d.w ?? 19, gs = d.gs ?? -1, mud = d.mud ?? 0.5, g = grp(), S = walk(line, 2.2);
  // the cambered crown: three rows (edge, crown, edge), a hair above the cobble floor under it
  const rows: THREE.Vector3[][] = [[], [], [], [], []];
  for (const s of S) {
    const hw = widthAt(d, s, W) / 2;
    [-1, -0.5, 0, 0.5, 1].forEach((k, r) => rows[r].push(new THREE.Vector3(s.x + s.nx * hw * k, 0.16 + 0.34 * (1 - k * k), s.z + s.nz * hw * k)));
  }
  g.add(sheet(rows, C.sett));
  // worn darker setts along the wheel tracks and the crown line
  for (let i = 0; i < S.length; i += 1) {
    const s = S[i], hw = widthAt(d, s, W) / 2;
    if (hash(i, 3) > 0.55) g.add(along(s, (hash(i, 4) - 0.5) * hw * 1.4, 1.6 + hash(i, 5) * 2.4, 0.12, 1.1 + hash(i, 6) * 1.4, i % 3 ? C.settDeep : C.settPale, 0.5 - Math.abs(hash(i, 4) - 0.5) * 0.5));
  }
  // mud breaking through in long patches (denser toward the start, where the dirt apron meets the cobbles)
  for (let i = 0; i < S.length; i++) {
    const s = S[i], hw = widthAt(d, s, W) / 2, p = mud * (1.1 - s.f * 0.8);
    if (hash(i, 11) > p) continue;
    const o = (hash(i, 12) - 0.5) * hw * 1.5, m = plate(1.6 + hash(i, 13) * 2.6, hash(i, 14) > 0.5 ? C.mud : C.mudDark, i, 0.5 - Math.abs(o / hw) * 0.3 + 0.03, 1.8);
    place(m, s.x + s.nx * o, 0, s.z + s.nz * o, yawOf(s.tx, s.tz)); g.add(m);
  }
  // the kerbs: dressed stones end to end with gaps where they have gone, some tipped
  for (let i = 0; i < S.length; i++) for (const side of [-1, 1]) {
    const s = S[i], hw = widthAt(d, s, W) / 2, k = hash(i, side + 20);
    if (k < 0.16) continue;                                                   // gone
    const tip = k > 0.9 ? (side * 0.35) : 0, c = (i + side) % 4 === 0 ? C.kerbDeep : C.kerb;
    const st = along(s, side * (hw + 0.5), 2.1, 0.7 + hash(i, side + 21) * 0.2, 1.0, c, 0.3 + (k > 0.8 ? -0.12 : 0), tip); st.rotation.y += jit(i, side + 22, 0.06); g.add(st);
    if (k > 0.94) g.add(place(lump(0.5, C.kerbDeep, i + side, 1.4, 0.6, 1), s.x + s.nx * side * (hw + 1.8), 0.2, s.z + s.nz * side * (hw + 1.8)));   // a stone fallen out of line
  }
  // the gutter outside the uphill kerb: two lines of small stones over a dark wet bed, rimed in places
  for (let i = 0; i < S.length; i++) {
    const s = S[i], hw = widthAt(d, s, W) / 2, o = gs * (hw + 1.75);
    g.add(along(s, o, 2.25, 0.08, 0.8, C.seep, 0.1));
    for (const e of [-0.65, 0.65]) if (hash(i, 30 + e) > 0.1) g.add(along(s, o + e, 2.0, 0.35, 0.42, i % 3 ? C.kerbDeep : C.gravel, 0.18));
  }
  return g;
}

/** Paired wheel ruts in frozen mud (dark, with rimed ridges) and the hoofprints of a two-horse team between them, along
 *  a polyline (dims n, x_i, z_i), `gauge` ft apart, at height `y` (on a crown or a stand). Runs one way only. */
export function wheelRuts(d: Dims): THREE.Group {
  const line = polyline(d), G = d.gauge ?? 6.1, y = d.y ?? 0.52, g = grp(), S = walk(line, 1.5);
  // the ruts themselves: two continuous dark ribbons, wider where the wheels have sunk deeper
  for (const side of [-1, 1]) {
    const rows: THREE.Vector3[][] = [[], []];
    S.forEach((s, i) => { const w = 0.3 + hash(i, side + 34) * 0.22, o = side * G / 2 + jit(i, side + 38, 0.08); rows[0].push(new THREE.Vector3(s.x + s.nx * (o - w), y, s.z + s.nz * (o - w))); rows[1].push(new THREE.Vector3(s.x + s.nx * (o + w), y, s.z + s.nz * (o + w))); });
    g.add(sheet(rows, C.rut));
  }
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    for (const side of [-1, 1]) {
      if (hash(i, side + 39) > 0.6) g.add(along(s, side * G / 2 + jit(i, side + 38, 0.12), 0.8 + hash(i, side + 37) * 0.5, 0.05, 0.7, C.mudDark, y - 0.01));
      if (hash(i, side + 40) > 0.35) g.add(along(s, side * (G / 2 + 0.5), 1.4, 0.1, 0.22, hash(i, side + 41) > 0.93 ? C.rime : C.mud, y + 0.02));
      if (hash(i, side + 42) > 0.55) g.add(along(s, side * (G / 2 - 0.5), 1.2, 0.08, 0.2, C.mud, y + 0.02));
      // hoofprints: two lines between the ruts, staggered, each a small dark crescent
      if (d.hoof !== 0 && (i + (side > 0 ? 1 : 0)) % 2 === 0) {
        const o = side * (1.45 + jit(i, side + 43, 0.25)), cx = s.x + s.nx * o, cz = s.z + s.nz * o;
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 3, 8, Math.PI * 1.3), mat(C.rut));
        h.rotation.set(-Math.PI / 2, 0, yawOf(s.tx, s.tz) + Math.PI * 0.35); h.position.set(cx, y + 0.03, cz); g.add(h);
      }
    }
  }
  return g;
}

/** The coach stand: a cobbled turning circle `r` ft across the radius, an outer ring of larger setts still crisp, a few
 *  gone, two inner rings and a boss, mud drifted on its west edge, and on its north rim (local -z) a squat stone post
 *  with a rusted tethering ring. */
export function coachStand(d: Dims): THREE.Group {
  const r = d.r ?? 20, g = grp();
  g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.4, 0.42, 48), mat(C.sett)), 0, 0.21, 0));
  const n = Math.round((Math.PI * 2 * (r - 0.9)) / 1.75);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = hash(i, 50);
    if (k < 0.07) continue;
    const st = box(1.65, 0.5, 1.35, i % 3 ? C.kerb : C.kerbDeep, Math.cos(a) * (r - 0.85), 0.42 + (k > 0.9 ? -0.15 : 0), Math.sin(a) * (r - 0.85), -a);
    if (k > 0.93) st.rotation.z = 0.2; g.add(st);
  }
  for (const [rr, c] of [[r * 0.62, C.settDeep], [r * 0.3, C.settPale]] as const) {
    const m = Math.round((Math.PI * 2 * rr) / 1.2);
    for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2 + rr; g.add(box(1.05, 0.1, 0.8, c, Math.cos(a) * rr, 0.46, Math.sin(a) * rr, -a)); }
  }
  g.add(cyl(1.6, 1.8, 0.2, C.kerbDeep, 0, 0.5, 0, 10));
  // where the apron's mud has crept onto the stones (west), with a rim of frost
  for (let i = 0; i < 7; i++) { const a = Math.PI + (hash(i, 60) - 0.5) * 1.6, rr = r * (0.55 + hash(i, 61) * 0.4); g.add(place(plate(1.4 + hash(i, 62) * 2.4, i % 3 ? C.mud : C.mudDark, i + 60, 0.47, 1.6), Math.cos(a) * rr, 0, Math.sin(a) * rr, a)); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (hash(i, 63) - 0.5) * 1.2, rr = r * (0.7 + hash(i, 64) * 0.25); g.add(place(plate(0.8 + hash(i, 65), C.rime, i + 70, 0.49, 2.2), Math.cos(a) * rr, 0, Math.sin(a) * rr, a)); }
  // the tethering post on the north rim
  const pz = -(r + 1.6);
  g.add(box(2.2, 0.5, 2.2, C.ashlarDeep, 0, 0.25, pz), box(1.7, 2.6, 1.7, C.ashlar, 0, 1.8, pz), place(new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), mat(C.ashlarDeep)), 0, 3.45, pz, Math.PI / 4));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 5, 12), mat(C.ironRust)); place(ring, 0, 1.75, pz + 0.95, 0, 0.35); g.add(ring, box(0.3, 0.3, 0.2, C.iron, 0, 2.15, pz + 0.88), box(0.18, 1.3, 0.04, C.rust, 0.05, 1.2, pz + 0.87));
  g.add(place(lump(0.4, C.lichen, 3, 1.3, 0.6, 0.6, 0), 0.3, 2.5, pz - 0.8));
  return g;
}

/** The dead lamp standard: a squared stone base with a device worn to a lump on its faces and rust bleeding down it, a
 *  12-ft wrought-iron post with collars and scroll brackets, a glassless lantern cage and finial; lichen on its north side. */
export function lampStandard(): THREE.Group {
  const g = grp(box(3.3, 0.6, 3.3, C.ashlarDeep, 0, 0.3, 0), box(2.5, 2.8, 2.5, C.ashlar, 0, 2.0, 0), box(2.9, 0.45, 2.9, C.ashlarDeep, 0, 3.6, 0), box(1.6, 0.4, 1.6, C.ashlar, 0, 4.0, 0));
  for (const [x, z, ry] of [[0, 1.27, 0], [1.27, 0, Math.PI / 2], [-1.27, 0, Math.PI / 2], [0, -1.27, 0]] as const) {
    g.add(box(1.2, 1.4, 0.14, C.device, x, 2.1, z, ry), place(lump(0.38, C.device, x * 3 + z, 1, 1.1, 0.4, 0), x * 1.06, 2.15, z * 1.06, ry));   // the worn device
  }
  for (let i = 0; i < 5; i++) { const s = i % 2 ? 1 : -1, ox = (hash(i, 1) - 0.5) * 1.6; g.add(box(0.16 + hash(i, 2) * 0.2, 1.2 + hash(i, 3) * 1.6, 0.05, C.rust, i < 3 ? ox : s * 1.28, 3.1 - (0.6 + hash(i, 3) * 0.8), i < 3 ? 1.29 : ox)); }
  for (let i = 0; i < 6; i++) g.add(place(lump(0.35 + hash(i, 9) * 0.3, i % 2 ? C.lichen : C.lichenPale, i + 9, 1.4, 0.8, 0.45, 0), (hash(i, 10) - 0.5) * 2, 0.9 + hash(i, 11) * 2.5, -1.3));
  // the post: octagonal iron, tapering, collars, a twist of rust near the foot
  g.add(cyl(0.34, 0.42, 1.0, C.iron, 0, 4.7, 0, 8), cyl(0.2, 0.28, 6.6, C.iron, 0, 8.4, 0, 8), cyl(0.36, 0.36, 0.3, C.iron, 0, 5.3, 0, 8), cyl(0.3, 0.3, 0.25, C.iron, 0, 10.6, 0, 8), cyl(0.22, 0.3, 0.6, C.ironRust, 0, 5.0, 0, 8));
  for (const s of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 10, Math.PI * 1.4), mat(C.iron)); place(sc, s * 0.55, 10.5, 0, 0, 0, s > 0 ? -0.6 : Math.PI - 0.8); g.add(sc);
  }
  // the lantern cage, glassless: corner bars, top and bottom frames, a hood and finial, the dead burner inside
  const y0 = 11.0, H = 1.5, w = 1.25;
  g.add(box(w + 0.2, 0.12, w + 0.2, C.iron, 0, y0, 0), box(w + 0.1, 0.1, w + 0.1, C.iron, 0, y0 + H, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.09, H, 0.09, C.iron, (x * w) / 2, y0 + H / 2, (z * w) / 2));
  for (const x of [-1, 1]) g.add(box(0.05, H, 0.05, C.ironRust, (x * w) / 6, y0 + H / 2, w / 2), box(0.05, H, 0.05, C.ironRust, w / 2, y0 + H / 2, (x * w) / 6));
  g.add(place(new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.8, 4), mat(C.iron)), 0, y0 + H + 0.4, 0, Math.PI / 4), cyl(0.05, 0.08, 0.6, C.iron, 0, y0 + H + 1.0, 0, 5), place(new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(C.iron)), 0, y0 + H + 1.35, 0));
  g.add(cyl(0.16, 0.2, 0.45, C.ironRust, 0, y0 + 0.3, 0, 6));
  return g;
}

/** The roofless guard-post shell, `w` × `d` ft (long axis local x): rubble walls broken down to 4–8 ft with jagged
 *  tops, dressed quoins, a doorway in the south wall (+z, toward the apron), a window slot in the east wall, a collapsed
 *  hearth and chimney stump against the north wall with a cracked iron chest on the hearthstone, rubble, and pine
 *  needles drifted into the corners. */
export function guardShell(d: Dims): THREE.Group {
  const W = d.w ?? 20, D = d.d ?? 15, t = 1.5, g = grp(), door = d.door ?? -2, dw = 4;
  g.add(box(W - 2 * t + 0.2, 0.16, D - 2 * t + 0.2, C.rubbleDeep, 0, 0.08, 0));   // the old floor under the debris
  // one wall run from a to b (local), pieces ~1.6 ft with a random-walk top; `gap` [from, to] along it left open
  const run = (ax: number, az: number, bx: number, bz: number, seed: number, lo: number, hi: number, gaps: [number, number][] = []) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 1.6)), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(-uz, ux);
    let h = (lo + hi) / 2;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * (L / n);
      if (gaps.some(([a, b]) => s > a && s < b)) continue;
      h = Math.max(lo, Math.min(hi, h + (hash(i, seed) - 0.5) * 2.4));
      const c = i % 4 === 0 ? C.rubbleDeep : C.rubble;
      g.add(box(L / n + 0.04, h, t, c, ax + ux * s, h / 2, az + uz * s, ry));
      if (hash(i, seed + 1) > 0.55) { const st = box(0.9 + hash(i, seed + 2) * 0.5, 0.45, 0.8, C.rubbleDeep, ax + ux * s + jit(i, seed + 3, 0.3), h + 0.2, az + uz * s + jit(i, seed + 4, 0.25), ry + jit(i, seed + 5, 0.5)); st.rotation.z = jit(i, seed + 6, 0.25); g.add(st); }
    }
  };
  const x0 = -W / 2 + t / 2, x1 = W / 2 - t / 2, z0 = -D / 2 + t / 2, z1 = D / 2 - t / 2;
  run(x0, z0, x1, z0, 1, 6, 8);                                                           // north, backing onto the crag
  run(x0, z1, x1, z1, 2, 4, 6.5, [[door + W / 2 - dw / 2, door + W / 2 + dw / 2]]);          // south, the doorway
  run(x0, z0, x0, z1, 3, 4.5, 7.5);                                                       // west
  run(x1, z0, x1, z1, 4, 6.5, 8, [[D / 2 - t / 2 - 1.0, D / 2 - t / 2 + 0.2]]);              // east, the window slot
  // the slot: sill and head stones either side of it; quoins at the corners; the door jambs
  g.add(box(t + 0.2, 0.35, 1.6, C.ashlarDeep, x1, 3.0, -0.4), box(t + 0.2, 0.4, 1.6, C.ashlarDeep, x1, 5.6, -0.4), box(t, 2.4, 0.3, C.cleft, x1, 4.3, -0.4));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 0; k < 3; k++) g.add(box(1.8 - (k % 2) * 0.5, 1.1, 1.8 - ((k + 1) % 2) * 0.5, C.ashlar, (x * (W - 1.6)) / 2, 0.55 + k * 1.15, (z * (D - 1.6)) / 2));
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) g.add(box(0.9, 1.15, t + 0.15, k % 2 ? C.ashlarDeep : C.ashlar, door + s * (dw / 2 + 0.45), 0.6 + k * 1.2, z1));
  g.add(box(dw, 0.25, t + 0.4, C.ashlarDeep, door, 0.12, z1));
  // the hearth against the north wall, the chimney stump above it, broken and sooted, half buried in its own fall
  const hx = d.hx ?? -6, hz = -D / 2 + t + 1.3;
  g.add(box(5.4, 0.45, 3.0, C.ashlarDeep, hx, 0.22, hz), box(4.4, 0.06, 2.0, C.soot, hx, 0.47, hz - 0.2));
  g.add(box(5.2, 9.5, 2.4, C.rubble, hx, 4.75, -D / 2 + t / 2 - 0.4), box(2.8, 3.0, 0.3, C.soot, hx, 1.9, -D / 2 + t + 0.02), box(5.6, 0.45, 2.8, C.ashlarDeep, hx, 3.4, -D / 2 + t / 2));
  for (let i = 0; i < 6; i++) g.add(place(lump(0.6 + hash(i, 80) * 0.6, i % 2 ? C.rubble : C.rubbleDeep, i + 80, 1.2, 0.6, 1, 0), hx + (hash(i, 81) - 0.5) * 4.4, 0.6, hz + 0.8 + hash(i, 82) * 1.2));
  // the cracked iron coin chest bolted to the hearthstone, lid forced and thrown back
  g.add(box(1.5, 0.95, 1.0, C.iron, hx + 1.4, 0.95, hz - 0.1), box(1.3, 0.1, 0.8, C.cleft, hx + 1.4, 1.43, hz - 0.1), box(0.06, 0.9, 1.02, C.rust, hx + 1.6, 0.95, hz - 0.1));
  const lid = box(1.55, 0.18, 1.05, C.ironRust, hx + 1.4, 1.8, hz - 0.75); lid.rotation.x = -1.2; g.add(lid);
  // rubble fallen inward and out, pine needles drifted into the corners
  for (let i = 0; i < 14; i++) {
    const inside = i < 9, a = hash(i, 90), b = hash(i, 91);
    const x = inside ? (a - 0.5) * (W - 4) : (a - 0.5) * (W + 4), z = inside ? (b - 0.5) * (D - 4) : (b > 0.5 ? -1 : 1) * (D / 2 + 1 + b * 2);
    if (inside && Math.abs(x - door) < 2.5 && z > D / 2 - 4) continue;
    g.add(place(lump(0.5 + hash(i, 92) * 0.8, i % 3 ? C.rubble : C.rubbleDeep, i + 90, 1.3, 0.55, 1, 0), x, 0.3, z));
  }
  for (const [x, z, r] of [[W / 2 - 3.2, D / 2 - 3.0, 2.4], [-W / 2 + 3.4, D / 2 - 3.2, 2.0], [W / 2 - 3.6, -D / 2 + 3.2, 2.2], [1.5, -0.5, 1.6]]) g.add(place(plate(r, C.needles, x + z, 0.2, 1.5), x, 0, z), place(plate(r * 0.6, C.needlesDeep, x - z, 0.24, 1.3), x + 0.4, 0, z + 0.2));
  return g;
}

/** The toll bar: a stone pivot socket with its rusted pin on the north kerb (local -z) and a knee-high stop-stone with a
 *  worn notch on the south kerb (local +z), `w` ft apart across the road; the pole long gone. */
export function tollBar(d: Dims): THREE.Group {
  const w = d.w ?? 26, g = grp(), n = -w / 2, s = w / 2;
  g.add(box(3.0, 0.5, 3.0, C.ashlarDeep, 0, 0.25, n), box(2.5, 1.5, 2.5, C.ashlar, 0, 1.25, n), box(2.7, 0.3, 2.7, C.ashlarDeep, 0, 2.1, n));
  g.add(cyl(0.45, 0.45, 0.05, C.cleft, 0, 2.27, n, 10), cyl(0.5, 0.5, 0.1, C.iron, 0, 2.27, n, 10), cyl(0.14, 0.17, 1.4, C.ironRust, 0.1, 2.85, n, 6), box(0.06, 1.0, 0.04, C.rust, 0.6, 1.4, n + 1.27));
  g.children[g.children.length - 2].rotation.z = 0.18;
  g.add(place(lump(0.35, C.lichen, 4, 1.2, 0.5, 0.8, 0), -0.6, 2.25, n - 0.9));
  // the stop-stone: two horns either side of a notch the pole once dropped into, rust stain in it
  g.add(box(2.2, 1.1, 1.8, C.ashlar, 0, 0.55, s), box(0.75, 0.75, 1.8, C.ashlar, -0.72, 1.45, s), box(0.75, 0.6, 1.8, C.ashlarDeep, 0.72, 1.4, s), box(0.7, 0.06, 1.0, C.rust, 0, 1.13, s));
  g.add(place(lump(0.5, C.kerbDeep, 6, 1.4, 0.5, 1, 0), 1.6, 0.2, s + 1.2));
  return g;
}

/** A quarried block of living rock: a plan polygon extruded `h` high, its top and outer faces weathered, its straight
 *  cut faces (edges flagged in `cutEdge`) left sheer. */
function rockPrism(poly: P2[], h: number, color: string, seed: number, cutZ?: number, taper = 0.12, rough = 0.12): THREE.Mesh {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 2 }); geo.rotateX(Math.PI / 2); geo.translate(0, h, 0);
  const pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), onCut = cutZ !== undefined && Math.abs(z - cutZ) < 0.05;
    const k = Math.sin(x * 0.9 + z * 1.3 + seed) * 0.5 + Math.sin(x * 2.3 - z * 0.7 + seed * 2) * 0.5;
    if (y > h - 0.01) pv.setY(i, h + k * h * rough);
    if (!onCut && y > 0.5) { const f = (y / h) * taper; pv.setX(i, x * (1 - f) + k * 0.8); pv.setZ(i, cutZ !== undefined ? z + (cutZ - z) * f * 0.5 : z * (1 - f)); }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color));
}
/** The Cut Block: a house-sized fallen block of grey crag `len` ft along the road (local x) and `w` across, a `gap`-ft
 *  passage quarried through it along local x with sheer tool-marked walls `h` ft high, lichen on its north face (local
 *  -z), moss on its top, and a few tumbled blocks at its uphill (north) foot. */
export function cutBlock(d: Dims): THREE.Group {
  const L = d.len ?? 40, W = d.w ?? 64, gap = d.gap ?? 12, h = d.h ?? 16, g = grp();
  for (const side of [-1, 1]) {
    const zi = side * gap / 2, zo = side * W / 2, depth = Math.abs(zo - zi), m = 8;
    void zo;
    // the cut face is straight along zi; the outer outline is ragged, bulging out to about zo
    const P: P2[] = [[-L / 2, zi]];
    for (let i = 1; i < m; i++) { const a = Math.PI - (i / m) * Math.PI; P.push([Math.cos(a) * (L / 2) * (0.88 + hash(i, side + 100) * 0.2), zi + side * Math.max(1.5, Math.sin(a) * depth * (0.8 + hash(i, side + 101) * 0.3))]); }
    P.push([L / 2, zi]);
    const block = rockPrism(P, h * (side > 0 ? 0.92 : 1), side > 0 ? C.rock : C.rockDeep, side * 7 + 3, zi, 0.32, 0.18);
    g.add(block);
    // the cut face: courses of tool marks and the drill lines of the quarrymen, darker where the wet runs down
    for (let k = 1; k < 9; k++) g.add(box(L - 2, 0.12, 0.08, C.toolMark, 0, k * (h / 9), zi + side * 0.02));
    for (let k = 0; k < 9; k++) g.add(box(0.14, h * (0.35 + hash(k, side + 110) * 0.4), 0.08, C.toolMark, -L / 2 + 2.5 + k * (L - 5) / 8, h * 0.62, zi + side * 0.03));
    for (let k = 0; k < 3; k++) g.add(box(1.2 + hash(k, side + 111), h * 0.5, 0.07, C.seep, -L / 3 + k * L / 3 + jit(k, side + 112, 3), h * 0.45, zi + side * 0.04));
    // the weathered outer bulk: big faceted masses shouldering out of the block, kept clear of the cut face
    for (let k = 0; k < 7; k++) {
      const r = 4.5 + hash(k, side + 115) * 4, zz = zi + side * Math.max(r * 1.3 + 1, depth * (0.35 + hash(k, side + 116) * 0.5)), xx = (hash(k, side + 117) - 0.5) * L * 0.85;
      g.add(place(lump(r, k % 3 === 0 ? C.rockPale : k % 3 === 1 ? C.rockDeep : C.rock, k * 3 + side, 1.3, 0.85 + hash(k, side + 118) * 0.5, 1.0, 1), xx, h * (0.25 + hash(k, side + 119) * 0.55), zz, hash(k, side + 120) * 6));
    }
    // broken rock heaped on its top, so it never reads as masonry
    for (let k = 0; k < 4; k++) {
      const r = 3 + hash(k, side + 125) * 2.5, xx = (hash(k, side + 126) - 0.5) * L * 0.55, zz = zi + side * (r + 2 + hash(k, side + 127) * (depth * 0.45 - r));
      g.add(place(lump(r, k % 2 ? C.rockDeep : C.rockPale, k * 5 + side, 1.4, 0.55, 1.1, 0), xx, h * (side > 0 ? 0.92 : 1) * 0.92, zz, hash(k, side + 128) * 6));
    }
    // moss along the top
    for (let k = 0; k < 6; k++) g.add(place(lump(1.2 + hash(k, side + 120) * 1.2, C.moss, k + side * 10, 1.6, 0.35, 1.2, 0), (hash(k, side + 121) - 0.5) * L * 0.7, h * (side > 0 ? 0.92 : 1) + 0.2, zi + side * (4 + hash(k, side + 122) * (Math.abs(zo - zi) - 9))));
  }
  // lichen on the north face (local -z)
  for (let k = 0; k < 14; k++) g.add(place(lump(0.7 + hash(k, 130) * 0.9, k % 2 ? C.lichen : C.lichenPale, k + 130, 1.5, 1.2, 0.35, 0), (hash(k, 131) - 0.5) * L * 0.8, 2 + hash(k, 132) * (h - 4), -W / 2 * (0.8 + hash(k, 133) * 0.12)));
  // tumbled blocks at the uphill foot
  for (let k = 0; k < 5; k++) {
    const s = 2.2 + hash(k, 140) * 3.2, b = box(s * 1.3, s, s, k % 2 ? C.rockDeep : C.cut, (hash(k, 141) - 0.5) * L * 0.9, s * 0.42, -W / 2 - 2 - hash(k, 142) * 6, hash(k, 143) * 3);
    b.rotation.z = jit(k, 144, 0.3); b.rotation.x = jit(k, 145, 0.25); g.add(b);
  }
  return g;
}

/** A scree fan: a talus ramp `len` ft long (rising toward local +x to `h` ft), `w` ft wide at its foot, narrowing
 *  upward, strewn with broken stone. A scramble up a crag. */
export function scree(d: Dims): THREE.Group {
  const L = d.len ?? 30, H = d.h ?? 20, W = d.w ?? 18, sd = d.seed ?? 0, g = grp(), nx = 6, nz = 5, rows: THREE.Vector3[][] = [];
  for (let i = 0; i <= nx; i++) {
    const f = i / nx, x = f * L, hw = (W / 2) * (1 - f * 0.55), y = H * Math.pow(f, 1.25), row: THREE.Vector3[] = [];
    for (let k = 0; k <= nz; k++) { const v = k / nz - 0.5, edge = 1 - Math.abs(v) * 2; row.push(new THREE.Vector3(x + jit(i * 7 + k, sd, 1.2), Math.max(-0.2, y * (0.55 + 0.45 * edge) + (edge > 0 ? jit(i * 7 + k, sd + 1, 0.8) : -0.3)), v * 2 * hw)); }
    rows.push(row);
  }
  g.add(sheet(rows, C.talus));
  const n = Math.round((L * W) / 22);
  for (let k = 0; k < n; k++) {
    const f = hash(k, sd + 3), v = hash(k, sd + 4) - 0.5, x = f * L, hw = (W / 2) * (1 - f * 0.55), y = H * Math.pow(f, 1.25) * (0.55 + 0.45 * (1 - Math.abs(v) * 2)), r = 0.35 + hash(k, sd + 5) * (f < 0.3 ? 1.6 : 0.9);
    g.add(place(lump(r, k % 3 === 0 ? C.rockPale : k % 3 === 1 ? C.rockDeep : C.gravel, k + sd, 1.2, 0.65, 1, 0), x, y + r * 0.25, v * 2 * hw * 0.9, hash(k, sd + 6) * 3));
  }
  return g;
}

/** The crag face along the shelf: a stepped face of living rock from its lip (`h` ft up, on the polyline in dims) down to
 *  its foot, `r_i` ft out along the left normal at each point, with a ledge band, talus at the foot, wet seepage streaks,
 *  lichen, and (if `cf` is given: a fraction along the lip) a narrow black cleft opening in the upper face. */
export function cragWall(d: Dims): THREE.Group {
  const lip = polyline(d), H = d.h ?? 55, g = grp(), S = walk(lip, 6), sd = d.seed ?? 0;
  const runAt = (s: Sample) => { const a = d['r' + s.seg] ?? 40, b = d['r' + (s.seg + 1)] ?? a; return a + (b - a) * s.t; };
  const PROF: [number, number][] = [[0, 1], [0.1, 0.84], [0.24, 0.62], [0.36, 0.44], [0.5, 0.26], [0.72, 0.1], [1, -0.02]];
  const rowsOf = (S2: Sample[]) => PROF.map(([fr, fy], r) => S2.map((s, i) => {
    const mid = r > 0 && r < PROF.length - 1, rib = Math.sin(i * 0.95 + sd) * 0.6 + Math.sin(i * 2.3 + sd * 3) * 0.4;   // ribs and gullies
    const R = runAt(s), o = fr * R + (mid ? jit(i * 13 + r, sd + 1, 2.6) + rib * 4.5 * Math.sin(fr * Math.PI) : 0), y = fy * H + (mid ? jit(i * 13 + r, sd + 2, 3) : 0);
    return new THREE.Vector3(s.x + s.nx * o, y, s.z + s.nz * o);
  }));
  // the face in bands of three greys, so the facets read
  const all = rowsOf(S), bands = [C.rock, C.rockDeep, C.talus, C.rock], step = 3;
  for (let b = 0, k = 0; b < S.length - 1; b += step, k++) {
    const e = Math.min(S.length, b + step + 1);
    g.add(sheet(all.map((row) => row.slice(b, e)), bands[Math.floor(hash(k, sd + 30) * 4)], (j) => new THREE.Vector3(S[b + j].nx, 0.7, S[b + j].nz)));
  }
  // the lip broken by blocks and a few pinnacles standing proud of the crest, so its line is never ruled
  for (let i = 0; i < S.length; i++) {
    const s = S[i], k = hash(i, sd + 40);
    if (k < 0.5) continue;
    const r = 1.8 + hash(i, sd + 41) * 3.6, tall = k > 0.9, o = 1 + hash(i, sd + 42) * 2.5 - (tall ? 4 : 0) - hash(i, sd + 44) * 5;
    g.add(place(lump(r, (i % 3) ? C.rockDeep : C.rockPale, i + sd * 5, 1.2 + hash(i, sd + 45) * 0.6, tall ? 2.4 : 0.7 + hash(i, sd + 46) * 0.5, 1.0, 0), s.x + s.nx * o + s.tx * jit(i, sd + 47, 2.5), H - r * 0.25 + (tall ? r * 1.1 : 0), s.z + s.nz * o + s.tz * jit(i, sd + 47, 2.5), hash(i, sd + 43) * 6));
  }
  // a ledge band at the foot of the upper cliff, broken; talus and boulders along the foot
  for (let i = 0; i < S.length; i++) {
    const s = S[i], R = runAt(s);
    if (hash(i, sd + 10) > 0.45) { const o = 0.3 * R, l = box(5.5 + hash(i, sd + 11) * 3, 1.0, 2.2 + hash(i, sd + 12) * 1.6, C.rockDark, s.x + s.nx * o, H * 0.5 + jit(i, sd + 13, 1.5), s.z + s.nz * o, yawOf(s.tx, s.tz)); g.add(l); }
    for (let k = 0; k < 2; k++) if (hash(i * 2 + k, sd + 14) > 0.35) { const o = R * (0.92 + hash(i * 2 + k, sd + 15) * 0.25), r = 0.8 + hash(i * 2 + k, sd + 16) * 2.2; g.add(place(lump(r, (i + k) % 2 ? C.rockDeep : C.talus, i * 2 + k + sd, 1.3, 0.7, 1.1, 1), s.x + s.nx * o + s.tx * jit(i, k, 2), r * 0.35, s.z + s.nz * o + s.tz * jit(i, k, 2), hash(i, k) * 3)); }
    // wet seepage streaks running down the upper face; lichen on the drier faces
    if (hash(i, sd + 17) > 0.88) {
      const rows = PROF.slice(0, 5).map((_, r) => { const p = all[r][i]; const q = new THREE.Vector3(s.x + s.nx * 0.4, 0.25, s.z + s.nz * 0.4).sub(new THREE.Vector3(s.x, 0, s.z)); const w = 0.35 + r * 0.12; return [p.clone().add(q).add(new THREE.Vector3(s.tx * -w, 0, s.tz * -w)), p.clone().add(q).add(new THREE.Vector3(s.tx * w, 0, s.tz * w))]; });
      g.add(sheet(rows, C.seep, () => new THREE.Vector3(s.nx, 0.7, s.nz)));
    }
    for (let k = 0; k < 2; k++) if (hash(i * 3 + k, sd + 18) > 0.55) { const r = 1 + Math.floor(hash(i * 3 + k, sd + 19) * 3), p = all[r][i]; g.add(place(lump(0.9 + hash(i, k + 5) * 0.9, k ? C.lichen : C.lichenPale, i + k, 1.6, 1.0, 0.4, 0), p.x + s.nx * 0.5, p.y, p.z + s.nz * 0.5, yawOf(s.tx, s.tz))); }
  }
  // the cleft: a narrow black split in the upper face, with broken rock at its lips and droppings below
  if (d.cf !== undefined) {
    const i = Math.max(1, Math.min(S.length - 2, Math.round(d.cf * (S.length - 1)))), s = S[i];
    const rows = [0, 1, 2, 3].map((r) => { const p = all[r][i].clone().add(new THREE.Vector3(s.nx * 0.6, r === 0 ? -3 : 0, s.nz * 0.6)), w = r === 0 ? 0.5 : r === 3 ? 0.6 : 1.6; return [p.clone().add(new THREE.Vector3(-s.tx * w, 0, -s.tz * w)), p.clone().add(new THREE.Vector3(s.tx * w, 0, s.tz * w))]; });
    g.add(sheet(rows, C.cleft, () => new THREE.Vector3(s.nx, 0.7, s.nz)));
    for (let r = 1; r < 4; r++) for (const sx of [-1, 1]) { const p = all[r][i]; g.add(place(lump(1.1, C.rockDark, r * 3 + sx, 1, 1.4, 0.8, 0), p.x + s.nx * 0.8 + s.tx * sx * 2.2, p.y, p.z + s.nz * 0.8 + s.tz * sx * 2.2)); }
    const p = all[4][i]; g.add(place(plate(2.2, C.rime, 7, 0, 1.2), p.x + s.nx * 1.2, p.y + 0.3, p.z + s.nz * 1.2));
  }
  return g;
}

/** A drystone revetment holding a road shelf up on its downhill side, along a polyline (dims n, x_i, z_i) on the road's
 *  edge, the face falling toward the left normal times `s` (±1): a coping course at road level, a battered face of
 *  coursed stones going down the slope, the dark of the drop below it; a bulge at fraction `bf`, and a collapse at
 *  fraction `cf` (`cw` ft wide) where the stones have spilled down into the trees. */
export function revetment(d: Dims): THREE.Group {
  const line = polyline(d), sgn = d.s ?? 1, H = d.h ?? 7, g = grp(), S = walk(line, 1.9), total = S[S.length - 1].s;
  const run = H * 0.55, bf = d.bf ?? -1, cf = d.cf ?? -1, cw = d.cw ?? 14, gf = d.gf ?? -1, gw = d.gw ?? 5;
  for (let i = 0; i < S.length; i++) {
    const s = S[i], dc = Math.abs(s.s - cf * total), db = Math.abs(s.s - bf * total);
    if (cf >= 0 && dc < cw / 2) {
      // the collapse: the coping gone, the face gone, its stones fanned down the slope
      for (let k = 0; k < 4; k++) { const o = sgn * (1.5 + hash(i * 4 + k, 150) * 14 * (1 - dc / cw)), r = 0.6 + hash(i * 4 + k, 151) * 1.1; g.add(place(lump(r, k % 2 ? C.dry : C.dryDeep, i * 4 + k, 1.4, 0.7, 1.1, 0), s.x + s.nx * o + s.tx * jit(i, k, 1.2), r * 0.3, s.z + s.nz * o + s.tz * jit(i, k, 1.2), hash(i, k + 3) * 3)); }
      g.add(along(s, sgn * 3, 2.0, 0.05, 6, C.shadowSoft, 0.05));
      continue;
    }
    if (gf >= 0 && Math.abs(s.s - gf * total) < gw / 2) {
      // a gap left for a scramble down: rough steps of slab going down the slope
      for (let k = 0; k < 4; k++) g.add(along(s, sgn * (1 + k * 1.6), 1.7, 0.4, 1.4, k % 2 ? C.dry : C.dryPale, 0.3 - k * 0.06, sgn * 0.08));
      continue;
    }
    const bulge = bf >= 0 && db < 9 ? Math.cos((db / 9) * Math.PI / 2) * 1.6 : 0;
    // coping at road level
    g.add(along(s, sgn * 0.45, 1.95, 0.55 + hash(i, 152) * 0.2, 1.2, i % 3 ? C.dryPale : C.dry, 0.35));
    // the battered face, three courses stepping down and out (with the bulge pushing the middle out)
    for (let k = 0; k < 3; k++) {
      const o = sgn * (1.3 + k * (run / 3) + (k === 1 ? bulge : k === 2 ? bulge * 0.6 : 0)), y = 0.32 - k * 0.1 + (k === 1 ? bulge * 0.15 : 0);
      const st = along(s, o, 1.85 + jit(i, k + 160, 0.15), 0.42, run / 3 + 0.25, (i + k) % 2 ? C.dry : C.dryDeep, y, sgn * 0.12 * (k + 1)); st.rotation.y += jit(i, k + 161, 0.04); g.add(st);
    }
    // the drop below: shadow, then the dark of the slope
    g.add(along(s, sgn * (run + 2.2 + bulge * 0.6), 1.95, 0.04, 3.2, C.shadow, 0.06), along(s, sgn * (run + 5.4 + bulge * 0.6), 1.95, 0.03, 3.6, C.shadowSoft, 0.05));
    if (hash(i, 162) > 0.82) g.add(place(lump(0.45, C.moss, i, 1.5, 0.5, 1, 0), s.x + s.nx * sgn * 1.6, 0.4, s.z + s.nz * sgn * 1.6));
  }
  return g;
}

/** A stone gutter (lined 1) or an open rill (lined 0) along a polyline (dims n, x_i, z_i): dark water in a bed, small
 *  stones either side, a fringe of ice in places (`ice` 0..1). */
export function gutter(d: Dims): THREE.Group {
  const line = polyline(d), lined = d.lined ?? 1, ice = d.ice ?? 0.3, g = grp(), S = walk(line, 1.6), w = d.w ?? (lined ? 1.0 : 1.3);
  const rows: THREE.Vector3[][] = [[], []];
  for (const s of S) for (const [r, k] of [[0, -1], [1, 1]] as const) rows[r].push(new THREE.Vector3(s.x + s.nx * k * w / 2, 0.14, s.z + s.nz * k * w / 2));
  g.add(sheet(rows, C.water));
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    for (const side of [-1, 1]) {
      if (lined) { if (hash(i, side + 170) > 0.08) g.add(along(s, side * (w / 2 + 0.3), 1.6, 0.4, 0.5, (i + side) % 3 ? C.kerbDeep : C.kerb, 0.2)); }
      else if (hash(i, side + 171) > 0.45) g.add(place(lump(0.25 + hash(i, side + 172) * 0.35, C.gravel, i + side, 1.3, 0.6, 1, 0), s.x + s.nx * side * (w / 2 + 0.2), 0.12, s.z + s.nz * side * (w / 2 + 0.2)));
      if (hash(i, side + 173) < ice * 0.6) g.add(along(s, side * (w / 2 - 0.05), 0.9, 0.05, 0.3, C.ice, 0.17));
    }
  }
  return g;
}

/** The water-splash: a shallow paved crossing for the rill across a road, `len` ft along the stream (local x, flowing
 *  toward +x) and `w` ft wide: green, slick setts dished toward the middle under a skin of water, an ice fringe, kerbs
 *  on both banks, the gutter feeding it from uphill, a single flagstone slab on two stones for walkers, and gnawed
 *  bones caught at its downhill lip. */
export function waterSplash(d: Dims): THREE.Group {
  const L = d.len ?? 22, W = d.w ?? 9, g = grp();
  g.add(box(L, 0.16, W, C.slickDeep, 0, 0.08, 0));
  for (let i = 0; i < Math.round(L / 1.4); i++) for (let k = 0; k < Math.round(W / 1.2); k++) {
    if (hash(i * 11 + k, 180) < 0.35) continue;
    const x = -L / 2 + 0.7 + i * 1.4, z = -W / 2 + 0.6 + k * 1.2, dish = 0.1 * (1 - Math.abs(z / (W / 2)));
    g.add(box(1.25, 0.12, 1.05, (i + k) % 3 ? C.slick : C.slickDeep, x, 0.2 - dish, z));
  }
  g.add(box(L - 0.6, 0.04, W * 0.42, C.water, 0, 0.24, 0));
  for (const side of [-1, 1]) for (let i = 0; i < Math.round(L / 1.9); i++) {
    g.add(box(1.8, 0.5, 0.7, i % 2 ? C.kerb : C.kerbDeep, -L / 2 + 0.95 + i * 1.9, 0.3, side * (W / 2 + 0.35)));
    if (hash(i, side + 185) > 0.4) g.add(place(plate(0.5 + hash(i, side + 186) * 0.5, C.rime, i + side * 9, 0.27, 2), -L / 2 + 0.95 + i * 1.9, 0, side * (W / 2 - 0.5)));
  }
  // the gutter coming in from uphill, the lip spilling out downhill
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) g.add(box(1.5, 0.4, 0.45, C.kerbDeep, -L / 2 - 0.8 - i * 1.5, 0.2, side * 0.8));
  g.add(box(4.5, 0.06, 1.1, C.water, -L / 2 - 2.2, 0.15, 0), box(2.4, 0.1, 3.4, C.slickDeep, L / 2 + 1.0, 0.06, 0), box(2.6, 0.05, 1.8, C.water, L / 2 + 1.1, 0.13, 0));
  for (let i = 0; i < 6; i++) g.add(place(plate(0.4 + hash(i, 190) * 0.5, C.ice, i + 190, 0.27, 1.6), (hash(i, 191) - 0.5) * L * 0.9, 0, (hash(i, 192) > 0.5 ? 1 : -1) * W * 0.3));
  // the walkers' slab on two stones
  const sz = d.slab ?? W / 2 - 1.8;
  g.add(box(2.0, 0.55, 1.6, C.kerbDeep, -L * 0.22, 0.28, sz), box(2.0, 0.55, 1.6, C.kerbDeep, L * 0.22, 0.28, sz), box(L * 0.62, 0.45, 2.3, C.cut, 0, 0.78, sz));
  // gnawed bones at the downhill lip
  for (let i = 0; i < 5; i++) { const b = box(0.16, 0.16, 0.9 + hash(i, 195) * 0.7, i % 2 ? C.bone : C.boneDark, L / 2 + 0.6 + hash(i, 196) * 1.6, 0.2, (hash(i, 197) - 0.5) * 2.6, hash(i, 198) * 3); g.add(b); }
  g.add(place(lump(0.3, C.bone, 3, 1.3, 0.8, 1, 0), L / 2 + 1.2, 0.25, 0.6));
  return g;
}

/** Frozen ground: a scatter of iced-over puddles and white rime streaks, about `r` ft across. */
export function rime(d: Dims): THREE.Group {
  const r = d.r ?? 8, sd = d.seed ?? 0, n = d.n ?? Math.max(3, Math.round(r / 2)), g = grp();
  for (let i = 0; i < n; i++) {
    const x = (hash(i, sd) - 0.5) * r * 1.6, z = (hash(i, sd + 1) - 0.5) * r;
    g.add(place(plate(0.7 + hash(i, sd + 2) * 1.5, i % 2 ? C.ice : C.iceDeep, i + sd, 0.16, 1.8), x, 0, z, hash(i, sd + 3) * 0.6));
      }
  return g;
}

/** The falls window: a flat shelf of grey rock jutting from the slope where the canopy breaks, its lip broken, fissured,
 *  lichened, a scramble of broken rock behind it; `y` lifts it (its top stands at y + 1.4). */
export function rockShelf(d: Dims): THREE.Group {
  const R = d.r ?? 16, g = grp(), poly: P2[] = [];
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, k = R * (0.72 + 0.35 * hash(i, 200)); poly.push([Math.cos(a) * k * 1.25, Math.sin(a) * k * (Math.sin(a) > 0 ? 0.85 : 0.6)]); }
  g.add(rockPrism(poly, 1.4, C.rockPale, 4));
  for (let i = 0; i < 4; i++) g.add(box(R * (0.4 + hash(i, 201) * 0.5), 0.05, 0.18, C.seep, jit(i, 202, R * 0.4), 1.48, jit(i, 203, R * 0.3), hash(i, 204) * 3));
  for (let i = 0; i < 7; i++) g.add(place(lump(0.6 + hash(i, 205) * 0.8, i % 2 ? C.lichen : C.lichenPale, i + 205, 1.6, 0.35, 1.2, 0), jit(i, 206, R * 0.8), 1.45, jit(i, 207, R * 0.4)));
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + 0.7 * hash(i, 208)), rr = R * 1.0; g.add(place(lump(1 + hash(i, 209) * 1.4, i % 2 ? C.rock : C.rockDeep, i + 208, 1.3, 0.8, 1, 0), Math.cos(a) * rr * 1.2, 0.6, Math.sin(a) * rr * 0.8)); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.2 + 0.6 * hash(i, 210)); g.add(place(lump(1.4 + hash(i, 211) * 1.8, C.rockDeep, i + 210, 1.2, 1.1, 1, 0), Math.cos(a) * R * 0.95, 1.0, Math.sin(a) * R * 0.7)); }
  return g;
}

// ---------------------------------------------------------------- the crest
/** A wind-bent, stunted crest pine: a short trunk leaning downwind (local +x), its branches flagged out on the downwind
 *  side only; `dead` 1 gives the silver snag of one with its stubs; `scale` sizes it (about 10 ft at 1). */
export function krummholz(d: Dims): THREE.Group {
  const s = d.scale ?? 1, sd = d.seed ?? Math.floor((s * 977) % 97), g = grp();
  const trunk = grp(); trunk.rotation.z = -0.32 - hash(sd, 1) * 0.2; g.add(trunk);
  if (d.dead) {
    trunk.add(cyl(0.22 * s, 0.5 * s, 9.5 * s, C.barkDead, 0, 4.75 * s, 0, 6));
    for (let i = 0; i < 5; i++) { const st = box(0.16 * s, (1.2 + hash(i, sd) * 2.4) * s, 0.16 * s, C.barkGrey, 0.5 * s, (3 + i * 1.3) * s, jit(i, sd + 1, 0.3) * s); st.rotation.z = -1.1 - jit(i, sd + 2, 0.3); trunk.add(st); }
    const tip = box(0.16 * s, 2 * s, 0.16 * s, C.barkDead, 0.3 * s, 10 * s, 0); tip.rotation.z = -0.5; trunk.add(tip);
    g.add(place(lump(0.9 * s, C.barkGrey, sd, 1.4, 0.5, 1.1, 0), -0.4 * s, 0.2 * s, 0));
    return g;
  }
  trunk.add(cyl(0.2 * s, 0.48 * s, 8 * s, C.bark, 0, 4 * s, 0, 6));
  for (let i = 0; i < 5; i++) {
    const y = (2.6 + i * 1.35) * s, L = (3.8 - i * 0.45) * s * (0.8 + hash(i, sd + 3) * 0.4), c = i % 2 ? PALETTE.pine : PALETTE.pineDeep;
    const flag = lump(1, c, i + sd, L * 0.6, 0.55 * s, (1.1 - i * 0.12) * s, 0); flag.position.set(L * 0.45, y, jit(i, sd + 4, 0.4) * s); trunk.add(flag);
  }
  trunk.add(place(lump(0.7 * s, PALETTE.pineDeep, sd + 9, 1, 1.2, 1, 0), 0.25 * s, 8.4 * s, 0));
  g.add(place(lump(0.8 * s, C.rockDeep, sd, 1.4, 0.5, 1.1, 0), -0.6 * s, 0.15 * s, 0.2 * s));
  return g;
}

// ---------------------------------------------------------------- the coach's light and the team's breath
/** A soft glow for one of the coach's brass lamps burning in fog: an additive halo of `r` ft and a bright core. */
export function lampHalo(d: Dims): THREE.Group {
  const r = d.r ?? 3.2;
  return grp(sprite('#f2b35b', 0.5, r * 2, true), sprite('#ffd79a', 0.75, r * 0.55, true), sprite('#c9822e', 0.22, r * 4.2, true));
}
/** Breath steaming from a horse's muzzle in the cold: puffs swelling and thinning as they drift `len` ft downwind
 *  (local +x) and rise a little. */
export function breathPuff(d: Dims): THREE.Group {
  const L = d.len ?? 7, g = grp(), n = 6;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), p = sprite('#9aa0a7', 0.42 - f * 0.34, 0.9 + f * 3.2, false);
    p.position.set(f * L, f * 1.6 + jit(i, 220, 0.2), jit(i, 221, 0.35) * f); g.add(p);
  }
  return g;
}


// ---------------------------------------------------------------- fog
/** Fog material: mist grey, lit like the map (it darkens at night), see-through, no depth writes; cached. */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number): THREE.MeshLambertMaterial {
  const k = color + opacity;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** Ragged-edged sheet outline L x D (local x, z), as plan points. */
function raggedOutline(L: number, D: number, seed: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 0.78 + 0.3 * hash(i, seed) + 0.12 * Math.sin(a * 3 + seed);
    pts.push(new THREE.Vector2(Math.cos(a) * (L / 2) * k, Math.sin(a) * (D / 2) * k));
  }
  return pts;
}
/** A fog bank lying on the ground: `len` x `d` ft, `layers` ragged sheets stacked up to `h` ft, each `op` opaque (the
 *  lowest densest), shrinking upward, with a few soft billows on top; every layer one mesh, so a bank costs a handful
 *  of draws. Drawn after the grid so it veils the squares. */
export function fogBank(d: Dims): THREE.Group {
  const L = d.len ?? 120, D = d.d ?? 80, H = d.h ?? 3, n = d.layers ?? 3, op = d.op ?? 0.2, sd = d.seed ?? 1, g = grp();
  for (let k = 0; k < n; k++) {
    const t = n > 1 ? k / (n - 1) : 0, sc = 1 - 0.38 * t;
    const geo = new THREE.ShapeGeometry(new THREE.Shape(raggedOutline(L * sc, D * sc, sd * 7 + k))); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, fogMat(k % 2 ? C.fog1 : C.fog0, rnd2(op * (1 - 0.35 * t))));
    m.position.set(jit(k, sd, L * 0.06), 0.4 + t * H, jit(k, sd + 1, D * 0.06)); m.rotation.y = jit(k, sd + 2, 0.15); g.add(m);
  }
  // soft billows, merged into one mesh
  const nb = d.billows ?? 0, parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < nb; i++) {
    const r = 3 + hash(i, sd + 3) * 5, geo = new THREE.IcosahedronGeometry(r, 1);
    geo.scale(1.6, 0.32, 1.2); geo.translate(jit(i, sd + 4, L * 0.42), H * (0.35 + hash(i, sd + 5) * 0.6), jit(i, sd + 6, D * 0.4));
    parts.push(geo.toNonIndexed());
  }
  if (parts.length) {
    let cnt = 0; for (const p of parts) cnt += p.attributes.position.count;
    const pos = new Float32Array(cnt * 3); let o = 0; for (const p of parts) { pos.set(p.attributes.position.array as Float32Array, o); o += p.attributes.position.count * 3; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, fogMat(C.fog0, rnd2(Math.min(0.4, op * 1.2)))));
  }
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.renderOrder = 2; });
  return g;
}
const rnd2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- small things
/** Little things lying where they were left. v 0: a lady's black evening glove and a stiff card with a red seal (under a
 *  cushion); v 1: a single tarnished coin; v 2: a lost trinket half under the ice; v 3: a leather-wrapped bundle tied
 *  with twine, pushed in among fallen stones. */
export function keepsake(d: Dims): THREE.Group {
  const v = d.v ?? 0, g = grp();
  if (v === 0) {
    g.add(box(0.5, 0.05, 0.7, C.card, 0.2, 0.03, 0, 0.3), cyl(0.09, 0.09, 0.03, C.seal, 0.25, 0.07, 0.15, 8));
    const palm = box(0.36, 0.06, 0.5, C.glove, -0.25, 0.08, 0.05, -0.4); g.add(palm);
    for (let i = 0; i < 4; i++) g.add(box(0.07, 0.05, 0.32, C.glove, -0.38 + i * 0.09, 0.08, -0.32, -0.4 + i * 0.05));
    g.add(box(0.3, 0.05, 0.6, C.glove, -0.1, 0.08, 0.5, -0.4));
  } else if (v === 1) {
    g.add(cyl(0.12, 0.12, 0.03, C.electrum, 0, 0.03, 0, 10));
  } else if (v === 2) {
    g.add(box(0.35, 0.15, 0.25, C.trinket, 0, 0.1, 0, 0.5), place(plate(0.6, C.ice, 3, 0.18, 1.4), 0.15, 0, 0.05));
  } else {
    const b = lump(1, C.leather, 5, 1.2, 0.55, 0.75, 1); b.position.y = 0.55; g.add(b);
    for (const x of [-0.45, 0.45]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 4, 10), mat(C.twine)); place(t, x, 0.55, 0, Math.PI / 2, 0, 0); t.scale.set(1, 1.1, 0.75); g.add(t); }
    g.add(box(0.7, 0.06, 0.5, C.leatherDark, 0.7, 0.75, 0.25, 0.6));
    for (let i = 0; i < 3; i++) g.add(place(lump(0.5 + hash(i, 230) * 0.4, C.dryDeep, i + 230, 1.3, 0.7, 1, 0), jit(i, 231, 1.4), 0.25, 0.9 + hash(i, 232) * 0.5));
  }
  return g;
}

// ---------------------------------------------------------------- figures
/** Merge a figure's meshes by material (a figure in a hidden token is drawn on its own). */
function compact(root: THREE.Group): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    list.push(geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
  });
  const out = new THREE.Group();
  for (const [mt, gs] of by) {
    let n = 0; for (const g2 of gs) n += g2.attributes.position.count;
    const pos = new Float32Array(n * 3); let o = 0;
    for (const g2 of gs) { pos.set(g2.attributes.position.array as Float32Array, o); o += g2.attributes.position.count * 3; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
    out.add(new THREE.Mesh(geo, mt));
  }
  return out;
}
/** The skeletal rider: a skeleton in ruined chain mail on a skeletal warhorse barded in the same, at a walk, holding up
 *  a rusted lantern that gives no light. Faces +x, as the kit's horses do. */
export function skeletalRider(): THREE.Group {
  const s = 1.75, g = horse({ bone: 1 });
  // ruined chain barding: a skirt over the barrel, ragged at the hem, a crinet down the neck
  for (const z of [-1, 1]) g.add(box(6.0, 2.5, 0.12, C.chain, -0.3, 5.7, z * 1.47));
  g.add(box(4.6, 0.12, 2.95, C.chain, -0.5, 7.3, 0));
  for (let i = 0; i < 14; i++) { const x = -3.1 + (i % 7) * 0.92, z = (i < 7 ? -1 : 1) * 1.49; if (hash(i, 240) > 0.3) g.add(box(0.8, 0.5 + hash(i, 241) * 0.9, 0.06, i % 2 ? C.chain : C.chainDark, x, 4.3 - hash(i, 242) * 0.3, z)); }
  const cr = box(0.5 * s, 2.0 * s, 0.9 * s, C.chainDark, 2.15 * s, 4.55 * s, 0); cr.rotation.z = -0.65; g.add(cr);
  g.add(box(1.2 * s, 0.25 * s, 1.5 * s, C.leatherDark, -0.1 * s, 4.0 * s, 0));   // the rotten saddle
  // the rider, seated: a skeleton in a chain shirt; thighs gripping the barrel, one arm raised with the lantern
  const rider = humanoid({ skin: C.bone, cloth: C.chain, trim: C.boneDark, scale: 0.95 });
  rider.rotation.y = Math.PI / 2; rider.position.set(-0.2 * s, 4.05 * s - 2.85 * 0.95, 0); g.add(rider);
  for (const z of [-1, 1]) { const th = box(1.7, 0.42, 0.42, C.bone, 0.4, 4.05 * s - 0.35, z * 1.15 * s); th.rotation.z = -0.15; g.add(th); const sh = box(0.36, 2.0, 0.36, C.bone, 1.1, 4.05 * s - 1.4, z * 1.32 * s); sh.rotation.x = z * 0.12; g.add(sh); }
  for (let i = 0; i < 6; i++) g.add(box(0.5, 0.5 + hash(i, 245) * 0.5, 0.05, C.chainDark, -0.6 + (i % 3) * 0.6, 4.05 * s + 0.1, (i < 3 ? -1 : 1) * 0.7));
  const arm = box(0.3, 2.5, 0.3, C.bone, 0.6, 4.05 * s + 3.6, -0.75); arm.rotation.z = -0.5; arm.rotation.x = 0.2; g.add(arm);
  const lx = 1.25, ly = 4.05 * s + 4.9, lz = -0.95;
  g.add(box(0.06, 0.6, 0.06, C.iron, lx, ly + 0.2, lz), box(0.6, 0.12, 0.6, C.ironRust, lx, ly - 0.15, lz), box(0.5, 0.7, 0.5, C.cleft, lx, ly - 0.55, lz), box(0.62, 0.1, 0.62, C.ironRust, lx, ly - 0.95, lz));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, 0.8, 0.06, C.ironRust, lx + x * 0.28, ly - 0.55, lz + z * 0.28));
  // dark sockets in the skull
  for (const z of [-0.14, 0.14]) g.add(box(0.08, 0.12, 0.12, C.cleft, -0.2 * s + 0.44, 4.05 * s + 2.82 * 0.95 + 0.05, z));
  return compact(g);
}

Object.assign(PROPS_V1, {
  'i-cobble-crown': cobbleCrown, 'i-wheel-ruts': wheelRuts, 'i-coach-stand': coachStand, 'i-lamp-standard': lampStandard, 'i-guard-shell': guardShell,
  'i-toll-bar': tollBar, 'i-cut-block': cutBlock, 'i-scree': scree, 'i-crag-wall': cragWall, 'i-revetment': revetment, 'i-gutter': gutter,
  'i-water-splash': waterSplash, 'i-rime': rime, 'i-rock-shelf': rockShelf, 'i-krummholz': krummholz, 'i-lamp-halo': lampHalo, 'i-breath-puff': breathPuff,
  'i-keepsake': keepsake, 'i-fog': fogBank,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'i-skeletal-rider': () => skeletalRider() } as Record<string, (d: Dims) => THREE.Group>);
void FLOOR_COLOR;
