// Bony bodies for the undead: a skeleton set on the figure rig's own joints (kit/heroes.ts), so it keeps every pose,
// grip, gear mount and clip check the fleshed figure has. boneify() takes a posed figure, lifts the flesh off it and sets
// bones in its place, each in its joint's frame and at the flesh's proportions: the skull (the cranium, deep sockets
// under the brow, the nose's hollow, the cheekbones and their arches, the upper teeth, and the jaw on its hinge with
// its own teeth, hanging open in a fight), the spine in its curves from the skull to the sacrum, the ribcage on its
// breastbone, the collarbones and shoulder blades, the pelvis, the long bones with their knobbed ends, and bony hands
// and feet, each finger bone where the figure's own finger was posed, so a fist still closes on its haft.
// Where a run of bones spans two joints (the neck from the chest to the skull, the small of the back from the pelvis to
// the ribs, a collarbone from the breastbone to the shoulder) it is laid after the pose, from one frame into the other,
// so it never breaks at the joint. Worn on the bones: a rotted belt where a belt can rest (on the hip bones), rags
// hanging from it, and on a soldier a ruined mail shirt holed through to the ribs.
// boneHorse() does the same for a horse built by kit/beasts.ts (the skeletal rider's mount), under a ruined mail trapper.
// Original geometry, palette materials; each joint's bones merge into one mesh per colour.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frameFor, SIDE_X, type HeroFigure } from './heroes';
import { ringAt, torsoRings } from './anatomy';
import { mat } from '../render/materials';
import type { BeastSpec } from './beasts';
import { ell, mirrorX, nets, run, seg, smax, smin, tri, type Sdf } from './sdf';

type V3 = THREE.Vector3;
type Geo = THREE.BufferGeometry;
type Joints = Record<string, THREE.Object3D>;

/** What a skeleton wears and how it holds its jaw. */
export interface Bony {
  /** Rags hanging from its belt, in this colour (none when left out). */
  rags?: string;
  /** A ruined mail shirt with short sleeves, holed through to the ribs, in this colour. */
  mail?: string;
  /** The rotted belt on its hip bones (a colour), or false for none. */
  belt?: string | false;
  /** In a fight the jaw hangs open. */
  battle?: boolean;
  /** In the saddle: the mail shirt stops at the waist, clear of the thighs. */
  seated?: boolean;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const ramp = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** A smooth-shaded palette colour, as the figure's own parts are (`double`: both faces drawn, for cloth). */
function soft(c: string, double = false): THREE.MeshLambertMaterial {
  const m = mat(c, { emissive: double ? '#020302' : '#030303' }); m.userData.smooth = true; if (double) m.side = THREE.DoubleSide; return m;
}
/** Positions only, the seams welded, then smooth normals. */
function weld(g: Geo): Geo {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const w = mergeVertices(g, 1e-5); w.computeVertexNormals(); return w;
}
const merged = (geos: Geo[]) => mergeGeometries(geos.map((x) => { const y = x.index ? x : x.clone(); for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k); return y; }))!;

/** A deformed sphere: `warp` reshapes the unit sphere (in place), then it is scaled by `r`, turned by `q` and set at `c`. */
function blob(c: V3, r: [number, number, number], warp?: (p: V3) => void, q?: THREE.Quaternion, w = 14, h = 10): Geo {
  const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position as THREE.BufferAttribute, v = V();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); warp?.(v); v.set(v.x * r[0], v.y * r[1], v.z * r[2]); if (q) v.applyQuaternion(q); v.add(c); p.setXYZ(i, v.x, v.y, v.z); }
  return weld(g);
}
const ball = (c: V3, r: number, w = 10, h = 8) => blob(c, [r, r, r], undefined, undefined, w, h);
/** A turn that takes +x, +y, +z to the given axes (the rest squared off from them). */
function basis(y: V3, z: V3): THREE.Quaternion {
  const Y = y.clone().normalize(), Z = z.clone().addScaledVector(Y, -z.dot(Y)).normalize(), X = V().crossVectors(Y, Z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}
type Num = number | ((t: number) => number);
const fn = (v: Num) => (typeof v === 'number' ? () => v : v);
/** A bone or a band along a path: an oval section `rw` across (along `side`, squared off the path) by `rh` (square to
 *  both), each a number or a function of the way along (0 to 1). Capped at both ends unless it is a closed loop. */
function sweep(pts: V3[], rw: Num, rh: Num, side: V3 | ((p: V3, t: number) => V3), o: { n?: number; seg?: number; closed?: boolean } = {}): Geo {
  const closed = !!o.closed, curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), n = o.n ?? Math.max(8, pts.length * 4), seg = o.seg ?? 8;
  const W = fn(rw), H = fn(rh), S = side instanceof THREE.Vector3 ? () => side : side, rows = closed ? n : n + 1, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < rows; i++) {
    const t = i / n, p = curve.getPointAt(t), T = curve.getTangentAt(t), sd = S(p, t).clone();
    sd.addScaledVector(T, -sd.dot(T)); if (sd.lengthSq() < 1e-8) sd.set(T.y, -T.x, 0).addScaledVector(T, 0); sd.normalize();
    const hd = V().crossVectors(T, sd).normalize(), a = W(t), b = H(t);
    for (let j = 0; j < seg; j++) { const th = (j / seg) * Math.PI * 2, c = Math.cos(th) * a, s = Math.sin(th) * b; pos.push(p.x + sd.x * c + hd.x * s, p.y + sd.y * c + hd.y * s, p.z + sd.z * c + hd.z * s); }
  }
  for (let i = 0; i < (closed ? rows : rows - 1); i++) for (let j = 0; j < seg; j++) { const i2 = (i + 1) % rows, a = i * seg + j, b = i * seg + (j + 1) % seg, c = i2 * seg + j, d = i2 * seg + (j + 1) % seg; idx.push(a, b, c, b, d, c); }
  if (!closed) {
    const base = pos.length / 3, p0 = curve.getPointAt(0), p1 = curve.getPointAt(1); pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    for (let j = 0; j < seg; j++) { idx.push(base, (j + 1) % seg, j); idx.push(base + 1, n * seg + j, n * seg + (j + 1) % seg); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A long bone's shaft from `a` to `b`, round, its radius `r(t)` along it (0 at a); the ends are left to knobs. */
function shaft(a: V3, b: V3, r: Num, n = 12, seg = 10): Geo {
  const R = fn(r), L = a.distanceTo(b), pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(R(t), t * L)); }
  const g = new THREE.LatheGeometry(pts, seg); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())); g.translate(a.x, a.y, a.z);
  return weld(g);
}
/** A sheet of cloth through rows of points (rows down it, each running the same way across). */
function sheet(P: V3[][], skip?: (i: number, j: number) => boolean): Geo {
  const nu = P[0].length, pos: number[] = [], idx: number[] = [];
  for (const row of P) for (const p of row) pos.push(p.x, p.y, p.z);
  for (let j = 0; j < P.length - 1; j++) for (let i = 0; i < nu - 1; i++) { if (skip?.(i, j)) continue; const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ sculpted bones
// The skull, the pelvis and the shoulder blades are sculpted as distance fields (smooth unions of ovals and rods, the
// sockets and hollows carved out) and meshed by surface nets (kit/sdf.ts), so they read as one cast piece rather than
// parts stuck together. Each is built once and shared.

// the skull's parts, for the +x half (the field takes |x|)
const OC = Math.cos(0.25), OS = Math.sin(0.25);
/** The eye socket's hollow (negative inside), and the nose's. */
const orbit = (ax: number, y: number, z: number) => { const dx = ax - 0.125, dz = z - 0.33; return ell(dx * OC - dz * OS, y - 0.425, dx * OS + dz * OC, 0.082, 0.077, 0.12); };
const nasal = (x: number, y: number, z: number) => ell(x / (1 - 0.45 * ramp(0.28, 0.36, y)), y - 0.3, z - 0.33, 0.036, 0.056, 0.07);
const temple = (ax: number, y: number, z: number) => ell(ax - 0.34, y - 0.43, z - 0.08, 0.07, 0.11, 0.14);
/** The skull before its hollows are carved: the cranium, the face under it, the brow, the cheekbones. */
function skullBase(x: number, y: number, z: number): number {
  const ax = Math.abs(x), cz = -0.035;
  // the cranium: an egg, narrower at the brow than across the crown, its underside flattened
  let d = ell(x / (1 - 0.12 * ramp(-0.1, 0.9, (z - cz) / 0.355)), y - 0.5, z - cz, 0.295, 0.32, 0.355);
  d = smax(d, 0.27 - y, 0.06);
  // the face under the front of it, narrowing to the teeth; the arch the teeth stand in
  d = smin(d, ell(x / (1 - 0.3 * ramp(0.36, 0.16, y)), y - 0.31, z - 0.16, 0.2, 0.15, 0.165), 0.07);
  d = smin(d, ell(x / (1 - 0.3 * Math.max(0, (z - 0.19) / 0.13)), y - 0.205, z - 0.19, 0.125, 0.045, 0.13), 0.04);
  d = smin(d, ell(x, y - 0.49 + 0.06 * (x / 0.19) ** 2, z - 0.285 + 0.05 * (x / 0.19) ** 2, 0.19, 0.034, 0.062), 0.06);   // the brow, one ridge over both sockets, curving back at its ends
  d = smin(d, ell(ax - 0.19, y - 0.35, z - 0.215, 0.07, 0.05, 0.065), 0.045);       // the cheekbones
  d = smin(d, ell(ax - 0.225, y - 0.265, z + 0.1, 0.03, 0.048, 0.032), 0.02);       // behind the ears
  return d;
}
function skullField(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = smax(skullBase(x, y, z), -orbit(ax, y, z), 0.025);
  d = smax(d, -nasal(x, y, z), 0.015);
  return smax(d, -temple(ax, y, z), 0.04);
}
/** How dark the bone is at a point of the skull: black down in the sockets and the nose's hollow (by how deep the point
 *  lies under the uncarved bone), a shadow at the temples. */
const skullShade = (x: number, y: number, z: number) => { const ax = Math.abs(x), k = Math.min(orbit(ax, y, z), nasal(x, y, z)) < 0.02 ? 1 : 0.3; return k * ramp(0.004, 0.035, -skullBase(x, y, z)); };
let SKULL: Geo | undefined;
const skullGeo = () => (SKULL ??= nets(skullField, [-0.33, 0.14, -0.43], [0.33, 0.85, 0.39], 0.02, skullShade));

// the pelvis, for the +x half (the field takes |x|), the thigh bones' heads at x 0.3. The hip bones' wings are two
// sides of one bowl (the shell of an oval), cut to their outlines: seen from above each crest arcs from its fore
// point out at the side round and back in to the sacrum, and from the front the hollows of both show
const CREST: number[][] = [];
for (let i = 0; i <= 9; i++) { const f = -1.18 + 2.0 * i / 9; CREST.push([0.46 * Math.cos(f) * 0.995, 0.465 - 0.012 * Math.cos(f * 2), 0.02 + 0.3 * Math.sin(f)]); }
const SC = Math.cos(0.35), SS = Math.sin(0.35);
function pelvisField(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  // the bowl's two sides, to the crest at the top, open in the middle (the sacrum behind, nothing before), and down to
  // the sockets; the crest's thickened rim
  let d = Math.abs(ell(ax, y - 0.5, z - 0.02, 0.46, 0.5, 0.3)) - 0.024;
  d = smax(d, y - 0.47, 0.02);
  d = smax(d, 0.12 - ax, 0.05);
  d = smax(d, 0.06 - y, 0.04);
  // each wing's outline, a fan: the fore edge down from its point to the socket, the hind edge in round the notch
  const t = Math.max(0, Math.min(1, (y - 0.08) / 0.39)), zf = 0.1 + 0.16 * (1 - (1 - t) ** 1.25) - 0.03 * Math.sin(Math.PI * t), zb = -0.08 - 0.19 * (1 - (1 - t) ** 1.8);
  d = smax(d, z - zf, 0.05);
  d = smax(d, zb - z, 0.06);
  if (Math.abs(y - 0.46) < 0.09) d = smin(d, run(ax, y, z, CREST) - 0.022, 0.03);
  // the body round the socket; the pubic bone forward to the join, the sitting bone below, the ring between them open
  d = smin(d, ell(ax - 0.25, y - 0.03, z, 0.095, 0.13, 0.11), 0.06);
  d = smin(d, seg(ax, y, z, [0.24, -0.04, 0.09], [0.04, -0.12, 0.185]) - 0.036, 0.035);
  d = smin(d, seg(ax, y, z, [0.04, -0.19, 0.165], [0.16, -0.27, -0.03]) - 0.03, 0.035);
  d = smin(d, seg(ax, y, z, [0.26, -0.06, -0.06], [0.18, -0.27, -0.055]) - 0.042, 0.035);
  d = smin(d, ell(ax - 0.17, y + 0.285, z + 0.045, 0.048, 0.04, 0.05), 0.025);
  d = smin(d, ell(ax - 0.026, y + 0.155, z - 0.182, 0.03, 0.06, 0.034), 0.025);
  // the sacrum between the wings, its top tipped forward, narrowing to the tail, hollowed in front
  const sy = (y - 0.22) * SC - (z + 0.2) * SS, sz = (y - 0.22) * SS + (z + 0.2) * SC, top = Math.max(0, Math.min(1, (sy / 0.17 + 1) / 2));
  d = smin(d, ell(x / (0.25 + 0.75 * top), sy, sz - 0.03 * (1 - (x / 0.18) ** 2) + 0.02 * (sy / 0.17) ** 2, 0.18, 0.17, 0.042), 0.05);
  d = smin(d, ell(ax - 0.15, y - 0.33, z + 0.215, 0.075, 0.07, 0.045), 0.05);   // its wings, joined to the hip bones
  d = smin(d, run(x, y, z, [[0, 0.11, -0.225], [0, 0.04, -0.215], [0, -0.01, -0.2], [0, -0.06, -0.175]]) - 0.021, 0.03);
  // the socket the thigh bone's head turns in
  return smax(d, -(Math.hypot(ax - 0.3, y, z) - 0.088), 0.03);
}
const PELVIS = new Map<string, Geo>();
const pelvisGeo = (hx: number) => { const k = hx.toFixed(3); let g = PELVIS.get(k); if (!g) { const sc = hx / 0.3; g = nets((x, y, z) => pelvisField(x / sc, y, z), [-0.54 * sc, -0.36, -0.32], [0.54 * sc, 0.5, 0.27], 0.016); PELVIS.set(k, g); } return g; };

// the shoulder blade (the figure's left; mirrored for the right), in the chest's frame: a thin plate lying on the ribs'
// back and curving round them (its outline a triangle from the top corner by the spine down to its foot and out to the
// socket), its outer edge thickened into a pillar and its inner edge lipped; the spine of it a shelf standing out
// across the top, taller as it goes, rising free into the flat point of the shoulder over the arm; the socket's neck
// reaching out to the arm, and a hook forward under the collarbone
function scapulaField(shoulderX: number): Sdf {
  const C = V(0.44, 1.7, -0.235), nn = V(0.42, 0.04, -0.9).normalize(), vv = UP.clone().addScaledVector(nn, -nn.y).normalize(), uu = V().crossVectors(vv, nn), lat = shoulderX - 0.9;
  // in the plate's own terms: u across it (toward the spine), v up it, w out of it (behind), the plate curving forward at its sides
  const A = [0.165, 0.37], Bt = [0.075, -0.2], G = [-0.25, 0.26], S2 = [-0.15, 0.33], M = [0.15, 0.19], L = [-0.21, 0.29], H0 = 0.014, H1 = 0.06;
  const surf = (u: number, v: number, h = 0) => { const w = h - 0.9 * u * u; return [C.x + u * uu.x + v * vv.x + w * nn.x, C.y + u * uu.y + v * vv.y + w * nn.y, C.z + u * uu.z + v * vv.z + w * nn.z]; };
  // the point of the shoulder: a flat oval from the spine's end forward and out to the collarbone's end, broad side up
  const r0 = V(0.65, 2.02, -0.15), r1 = V(0.875 + lat, 2.115, -0.035), ac = r0.clone().lerp(r1, 0.5), aa = r1.clone().sub(r0).normalize(), at = UP.clone().addScaledVector(aa, -aa.y).normalize(), ab = V().crossVectors(aa, at);
  const glen = surf(G[0], G[1]), ex = L[0] - M[0], ey = L[1] - M[1], el = ex * ex + ey * ey, crest = surf(L[0], L[1], H1);
  return (x, y, z) => {
    const dx = x - C.x, dy = y - C.y, dz = z - C.z, u = dx * uu.x + dy * uu.y + dz * uu.z, v = dx * vv.x + dy * vv.y + dz * vv.z, w = dx * nn.x + dy * nn.y + dz * nn.z + 0.9 * u * u;
    // the plate
    const d2 = Math.min(tri(u, v, A, Bt, G), tri(u, v, A, G, S2)), dw = Math.abs(w) - 0.01;
    let d = Math.hypot(Math.max(d2, 0), Math.max(dw, 0)) + Math.min(Math.max(d2, dw), 0) - 0.004;
    // its edges: the outer a pillar from the foot to the socket, the inner and the top lipped
    d = smin(d, seg(u, v, w, [Bt[0] - 0.012, Bt[1] + 0.02, 0], [G[0] + 0.02, G[1] - 0.03, 0]) - (0.014 + 0.011 * ramp(-0.2, 0.2, v)), 0.02);
    d = smin(d, seg(u, v, w, [A[0] - 0.008, A[1] - 0.01, 0], [Bt[0], Bt[1] + 0.012, 0]) - 0.0105, 0.012);
    d = smin(d, seg(u, v, w, [A[0] - 0.01, A[1] - 0.008, 0], [S2[0], S2[1] - 0.006, 0]) - 0.008, 0.01);
    // the spine: a shelf along its line, standing taller toward the shoulder, its crest a rounded lip
    const t = Math.max(0, Math.min(1, ((u - M[0]) * ex + (v - M[1]) * ey) / el)), ds = Math.hypot(u - M[0] - ex * t, v - M[1] - ey * t), H = H0 + (H1 - H0) * t;
    const qx = ds - (0.006 + 0.005 * t), qy = Math.abs(w - H / 2) - H / 2;
    d = smin(d, Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0), 0.014);
    d = smin(d, Math.hypot(ds, w - H) - (0.011 + 0.009 * t), 0.012);
    // the spine's end lifting off the plate into the point of the shoulder
    d = smin(d, seg(x, y, z, crest, [r0.x, r0.y, r0.z]) - 0.022, 0.02);
    const px = x - ac.x, py = y - ac.y, pz = z - ac.z;
    d = smin(d, ell(px * aa.x + py * aa.y + pz * aa.z, px * at.x + py * at.y + pz * at.z, px * ab.x + py * ab.y + pz * ab.z, 0.15, 0.022, 0.052), 0.025);
    // the socket's neck and its oval face toward the arm; the hook under the collarbone
    d = smin(d, seg(x, y, z, glen, [0.78 + lat, 1.956, -0.025]) - 0.038, 0.04);
    d = smin(d, ell(x - 0.79 - lat, y - 1.956, z + 0.022, 0.032, 0.062, 0.046), 0.035);
    d = smin(d, run(x, y, z, [[0.62, 1.985, -0.075], [0.655, 2.005, 0.035], [0.71, 1.99, 0.1]]) - 0.017, 0.02);
    return d;
  };
}
const SCAPULA = new Map<string, Geo>();
const scapulaGeo = (shoulderX: number) => { const k = shoulderX.toFixed(3); let g = SCAPULA.get(k); if (!g) { const lat = shoulderX - 0.9; g = nets(scapulaField(shoulderX), [0.22, 1.42, -0.34], [0.93 + lat, 2.18, 0.14], 0.014); SCAPULA.set(k, g); } return g; };

/** A vertebra: its body a waisted spool along the spine, the arch behind it round the cord's hole, the spine of it
 *  sloping back and down (`spine` long, `blade` tall), and its two wings out to the sides. */
const vertebra = (c: V3, axis: V3, back: V3, rb: number, hb: number, spine: number, wing: number, droop: number, out: Geo[], blade = 0.022) => {
  const ax = axis.clone().normalize(), bk = back.clone().addScaledVector(ax, -back.dot(ax)).normalize(), lat = V().crossVectors(ax, bk).normalize();
  const prof = [[0, -0.5], [0.84, -0.5], [1, -0.36], [0.88, 0], [1, 0.36], [0.84, 0.5], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r * rb, y * hb));
  const body = new THREE.LatheGeometry(prof, 12); body.scale(1, 1, 0.84); body.applyQuaternion(basis(ax, bk.clone().negate())); body.translate(c.x, c.y, c.z); out.push(weld(body));
  const at = (l: number, b: number, a = 0) => c.clone().addScaledVector(lat, l).addScaledVector(bk, b).addScaledVector(ax, a);
  out.push(sweep([at(-rb * 0.62, rb * 0.62), at(-rb * 0.55, rb + 0.035), at(0, rb + 0.058), at(rb * 0.55, rb + 0.035), at(rb * 0.62, rb * 0.62)], 0.012, 0.016, (p) => p.clone().sub(c), { n: 14, seg: 6 }));
  const root = at(0, rb + 0.05);
  out.push(sweep([root, root.clone().addScaledVector(bk, spine * 0.55).addScaledVector(ax, -droop * 0.4), root.clone().addScaledVector(bk, spine).addScaledVector(ax, -droop)], (t) => 0.012 * (1 - 0.35 * t), (t) => blade * (1 - 0.25 * t), lat, { seg: 6, n: 8 }));
  for (const k of [-1, 1]) { const w0 = at(k * rb * 0.5, rb + 0.03); out.push(sweep([w0, w0.clone().addScaledVector(lat, k * wing * 0.6).addScaledVector(bk, wing * 0.1), w0.clone().addScaledVector(lat, k * wing).addScaledVector(bk, wing * 0.3).addScaledVector(ax, 0.006)], (t) => 0.013 * (1 - 0.3 * t), (t) => 0.012 * (1 - 0.2 * t), ax, { seg: 6, n: 6 })); }
};

/** Geometry gathered by joint frame and colour, merged into one mesh each and scaled to the figure at the end. */
class Bag {
  private bins = new Map<THREE.Object3D, Map<string, Geo[]>>();
  put(frame: THREE.Object3D | undefined, c: string, ...gs: Geo[]): void {
    if (!frame) return; let m = this.bins.get(frame); if (!m) this.bins.set(frame, (m = new Map()));
    const l = m.get(c); if (l) l.push(...gs); else m.set(c, [...gs]);
  }
  cloth(frame: THREE.Object3D | undefined, c: string, ...gs: Geo[]): void { this.put(frame, c + '|2', ...gs); }
  flush(s: number): void {
    for (const [frame, m] of this.bins) for (const [key, gs] of m) {
      const [c, two] = key.split('|'), geo = merged(gs); geo.scale(s, s, s);
      frame.add(new THREE.Mesh(geo, soft(c, two === '2')));
    }
  }
}

// the rig's joints, and the mounts that stay on them when the flesh comes off
const RIG = ['hips', 'chest', 'neck', 'head', 'collarR', 'collarL', 'shoulderR', 'shoulderL', 'elbowR', 'elbowL', 'wristR', 'wristL', 'hipR', 'hipL', 'kneeR', 'kneeL', 'ankleR', 'ankleL'];
const KEEP = new Set([...RIG, 'handR', 'handL', 'beltR', 'beltL', 'back', 'stowed', 'dropped']);

/** Take the flesh off a posed figure built by heroFigure from `f` and set a skeleton on its joints. */
export function boneify(g: THREE.Group, f: HeroFigure, o: Bony = {}): THREE.Group {
  const J = (g.userData.joints ?? {}) as Joints, up = J.chest, pel = J.hips, neck = J.neck, head = J.head;
  if (!up || !pel || !neck || !head) return g;
  g.updateMatrixWorld(true);
  const s = neck.position.y / 2.24, fr = frameFor(f), tr = torsoRings(fr), B = f.skin ?? '#d9d2c0', dark = f.eyes ?? '#17120e';
  const B2 = tone(B, '#6a5a44', 0.16), teeth = tone(B, '#d8c48a', 0.3), gristle = tone(B, '#8a8274', 0.3);
  const bag = new Bag();
  /** A point in one frame's units (feet over the figure's scale) carried into another's. */
  const into = (from: THREE.Object3D, p: V3, to: THREE.Object3D) => to.worldToLocal(from.localToWorld(p.clone().multiplyScalar(s))).divideScalar(s);

  // the fingers as the pose left them (a fist round a haft, a talon, a hand at rest), before the flesh comes off
  type Seg = { m: THREE.Matrix4; r: number; h: number };
  const fingers: Record<string, Seg[]> = {};
  for (const sd of ['R', 'L']) {
    const w = J['wrist' + sd]; if (!w) continue;
    const ms = w.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[]; if (ms.length < 10) continue;
    fingers[sd] = ms.slice(1, 10).map((m) => { m.updateMatrix(); const p = (m.geometry as THREE.CapsuleGeometry).parameters; return { m: m.matrix.clone().scale(V(1, 1, 1)), r: p.radius / s, h: p.height / s }; });
    // (the matrix's translation is in feet: brought to the figure's units below)
    for (const fg of fingers[sd]) { const e = fg.m.elements; e[12] /= s; e[13] /= s; e[14] /= s; }
  }
  for (const n of RIG) { const j = J[n]; if (!j) continue; for (const c of [...j.children]) if (!KEEP.has(c.name)) j.remove(c); }

  // ------------------------------------------------------------------ the spine's line through the chest
  /** How deep the spine sits at a height of the chest (its bodies' middle line, toward the back). */
  const zc = (y: number) => -ringAt(tr, y).b * (0.34 + 0.28 * ramp(0.2, 1.4, y));
  const W15 = ringAt(tr, 1.5).w;
  /** The ribcage's half-width at a height; the line of the breastbone just inside the chest's front. */
  const cageW = (y: number) => { const u = (y - 1.42) / 0.78; return W15 * (0.9 - 0.5 * u * u); };
  const zFront = (y: number) => ringAt(tr, y).f * 0.86;

  // thoracic vertebrae: twelve, growing down the back, each with its spine sloping down behind it and its wings
  const verts: Geo[] = [];
  for (let k = 0; k < 12; k++) {
    const y = 2.15 - k * (1.15 / 11), t = k / 11, axis = V(0, 0.1, zc(y + 0.05) - zc(y - 0.05)).normalize();
    vertebra(V(0, y, zc(y)), axis, V(0, -0.05, -1), 0.04 + 0.018 * t, 0.064 + 0.022 * t, 0.075 + 0.02 * Math.sin(Math.PI * t), 0.06 + 0.012 * (1 - t), 0.06 + 0.02 * (1 - t), verts);
  }
  bag.put(up, B, ...verts);

  // the ribs: ten pairs from the spine round to the breastbone, sloping down as they come round; the lower pairs fall
  // short of it, the costal arch closing under the breastbone, the last two floating
  const ribs: Geo[] = [], cart: Geo[] = [], N = 10;
  for (let k = 0; k < N; k++) {
    const y0 = 2.08 - 0.093 * k, drop = 0.16 + 0.042 * k, zb = zc(y0) - 0.075, Wk = cageW(y0 - drop * 0.4);
    const aEnd = k < 6 ? Math.PI - 0.17 : Math.PI - (0.5 + 0.28 * (k - 6)), floating = k >= 8, zmid = (zb + zFront(y0)) / 2;
    for (const sx of [-1, 1]) {
      const pts: V3[] = [V(sx * 0.045, y0 + 0.012, zc(y0) - 0.01)];
      for (let i = 0; i <= 10; i++) {
        const a = 0.32 + (aEnd - 0.32) * i / 10, y = y0 - drop * (1 - Math.cos(a)) / 2, zf = zFront(y), zm = (zb + zf) / 2, D = (zf - zb) / 2;
        pts.push(V(sx * Wk * Math.sin(a), y, zm - D * Math.cos(a)));
      }
      const end = pts[pts.length - 1];
      ribs.push(sweep(pts, (t) => 0.013 + 0.003 * (1 - ramp(0, 0.15, t)), (t) => (0.017 + 0.012 * ramp(0, 0.2, t) + 0.006 * ramp(0.6, 1, t)) * (floating ? 1 - 0.55 * ramp(0.75, 1, t) : 1), (p) => V(p.x, 0, p.z - zmid), { n: 20, seg: 6 }));
      if (k === 6 || k === 7) { // the costal cartilage, up to the foot of the breastbone
        const top = V(sx * (0.035 + 0.012 * (k - 6)), 1.44 - 0.035 * (k - 6), zFront(1.44) - 0.012), mid = end.clone().lerp(top, 0.5).add(V(0, -0.03, 0.02));
        cart.push(sweep([end, mid, top], 0.011, 0.02, (p) => V(p.x, 0, p.z - zmid), { n: 10, seg: 6 }));
      }
    }
  }
  bag.put(up, B, ...ribs);
  bag.put(up, gristle, ...cart);
  // the breastbone: the broad handle at the top, the blade, the little point at its foot
  const st = [2.04, 1.86, 1.64, 1.44, 1.34].map((y, i) => V(0, y, zFront(y) - [0.015, 0.01, 0.006, 0.01, 0.028][i]));
  bag.put(up, B, sweep(st, 0.019, (t) => (t < 0.2 ? 0.075 - 0.12 * t : 0.05 + 0.008 * Math.sin(Math.PI * (t - 0.2) / 0.6)) * (1 - 0.55 * ramp(0.8, 1, t)), V(0, 0, 1), { n: 16, seg: 8 }));

  // the collarbones, from the breastbone's handle to the point of each shoulder (laid after the pose: the shoulder
  // rises on its collar when the arm goes up), and the shoulder blades on the back of the ribs, with the collar
  for (const [sd, sx] of [['R', SIDE_X.R], ['L', SIDE_X.L]] as const) {
    const collar = J['collar' + sd]; if (!collar) continue;
    const A = into(collar, V(sx * (fr.shoulderX - 0.15), 0.14, -0.02), up), S0 = V(sx * 0.07, 2.05, zFront(2.04) - 0.02);
    const m1 = S0.clone().lerp(A, 0.38).add(V(0, 0.025, 0.05)), m2 = S0.clone().lerp(A, 0.74).add(V(0, 0.03, -0.012));
    bag.put(up, B, sweep([S0, m1, m2, A], 0.024, (t) => 0.024 + 0.008 * ramp(0.55, 1, t), UP, { n: 14, seg: 8 }), ball(S0, 0.028));
    // the blade, sculpted for the left and mirrored for the right, moved into the collar's frame (it rides up with it)
    const blade = (sx > 0 ? scapulaGeo(fr.shoulderX).clone() : mirrorX(scapulaGeo(fr.shoulderX))).translate(-sx * 0.12, -1.98, 0);
    bag.put(collar, B, blade);
  }

  // ------------------------------------------------------------------ the pelvis and the small of the back
  // the pelvis, sculpted: the hip bones' wings, the sockets, the pubic arch and sitting bones, the sacrum and its tail
  bag.put(pel, B, pelvisGeo(fr.hipX).clone());
  // the lumbar vertebrae, five and massive, from the top of the sacrum to the last of the ribs' (laid after the pose)
  {
    const P0 = V(0, 0.37, -0.12), P1 = V(0, 0.55, -0.085), P2 = into(up, V(0, 0.74, zc(0.74) + 0.03), pel), P3 = into(up, V(0, 0.95, zc(0.95)), pel);
    const curve = new THREE.CatmullRomCurve3([P0, P1, P2, P3], false, 'centripetal'), lumb: Geo[] = [];
    for (let k = 0; k < 5; k++) {
      const t = 0.1 + 0.2 * k, c = curve.getPointAt(t), ax = curve.getTangentAt(t), back = V(0, 0, -1).addScaledVector(ax, ax.z);
      vertebra(c, ax, back, 0.066, 0.098, 0.07, 0.12, 0.02, lumb, 0.04);
    }
    bag.put(pel, B2, ...lumb);
  }

  // ------------------------------------------------------------------ the neck and the skull
  {
    const P0 = into(up, V(0, 2.2, zc(2.16) + 0.02), neck), P3 = into(head, V(0, 0.27, -0.075), neck);
    const curve = new THREE.CatmullRomCurve3([P0, V(0, 0.12, -0.085), V(0, 0.32, -0.062), P3], false, 'centripetal'), cerv: Geo[] = [];
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7, c = curve.getPointAt(t), ax = curve.getTangentAt(t), back = V(0, 0, -1).addScaledVector(ax, ax.z);
      vertebra(c, ax, back, 0.036 - 0.004 * (k / 6), 0.042, k === 0 ? 0.07 : 0.03, 0.04, k === 0 ? 0.03 : 0.012, cerv, 0.016);
    }
    bag.put(neck, B, ...cerv);
  }
  {
    const tooth: Geo[] = [], jaw: Geo[] = [], arch: Geo[] = [];
    // the skull, sculpted in one piece and painted dark down in its sockets and the nose's hollow
    {
      const sg = skullGeo().clone(), sh = sg.getAttribute('shade') as THREE.BufferAttribute, c0 = new THREE.Color(B), c1 = new THREE.Color(dark), cc = new THREE.Color(), col = new Float32Array(sh.count * 3);
      for (let i = 0; i < sh.count; i++) { cc.copy(c0).lerp(c1, sh.getX(i)); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
      sg.deleteAttribute('shade'); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.scale(s, s, s);
      const m = soft('#ffffff').clone(); m.vertexColors = true; m.flatShading = false; m.userData = { ...m.userData, smooth: true, keepLook: true };
      const mesh = new THREE.Mesh(sg, m); mesh.userData.keepLook = true; head.add(mesh);
    }
    // the arches of the cheekbones, standing off the temples back to the ears
    for (const sx of [-1, 1]) arch.push(sweep([V(sx * 0.235, 0.345, 0.2), V(sx * 0.268, 0.335, 0.11), V(sx * 0.274, 0.33, 0.02)], 0.012, (t) => 0.022 - 0.006 * t, V(sx, 0, 0), { n: 10, seg: 6 }));
    // the upper teeth along their arch
    for (let i = 0; i < 10; i++) { const u = (i - 4.5) / 4.5, a = u * 1.15, big = Math.abs(u) > 0.6; tooth.push(blob(V(Math.sin(a) * 0.118, 0.172, 0.17 + 0.155 * Math.cos(a)), [big ? 0.02 : 0.014, 0.026, big ? 0.02 : 0.011], undefined, new THREE.Quaternion().setFromAxisAngle(UP, a), 8, 6)); }
    // the jaw, hinged under the ears: a U from one hinge round the chin to the other, its corners square, its own teeth on it
    const J0 = V(0, 0.27, -0.06), jawPts = (sx: number) => [V(sx * 0.235, 0.27, -0.06), V(sx * 0.228, 0.16, -0.05), V(sx * 0.21, 0.065, -0.02), V(sx * 0.175, 0.045, 0.08), V(sx * 0.12, 0.045, 0.185), V(sx * 0.06, 0.04, 0.262)];
    const path = [...jawPts(-1), V(0, 0.038, 0.292), ...jawPts(1).reverse()];
    jaw.push(sweep(path, 0.021, (t) => { const e = Math.min(t, 1 - t); return 0.034 + 0.016 * ramp(0.06, 0.2, e) + 0.008 * ramp(0.4, 0.5, e); }, (p) => V(p.x, 0, p.z - 0.04), { n: 60, seg: 8 }));
    for (const sx of [-1, 1]) jaw.push(sweep([V(sx * 0.215, 0.12, -0.0), V(sx * 0.225, 0.2, 0.03), V(sx * 0.232, 0.255, 0.05)], 0.012, (t) => 0.026 * (1 - 0.6 * t), V(sx, 0, 0), { n: 8, seg: 6 }), ball(V(sx * 0.235, 0.275, -0.06), 0.026, 8, 6));
    const low: Geo[] = []; for (let i = 0; i < 10; i++) { const u = (i - 4.5) / 4.5, a = u * 1.15, big = Math.abs(u) > 0.6; low.push(blob(V(Math.sin(a) * 0.106, 0.112, 0.17 + 0.128 * Math.cos(a)), [big ? 0.019 : 0.013, 0.024, big ? 0.019 : 0.01], undefined, new THREE.Quaternion().setFromAxisAngle(UP, a), 8, 6)); }
    // it hangs a little open at rest and gapes in a fight
    const open = new THREE.Matrix4().makeTranslation(J0.x, J0.y, J0.z).multiply(new THREE.Matrix4().makeRotationX(o.battle ? 0.34 : 0.07)).multiply(new THREE.Matrix4().makeTranslation(-J0.x, -J0.y, -J0.z));
    for (const x of [...jaw, ...low]) x.applyMatrix4(open);
    bag.put(head, B, ...arch, ...jaw); bag.put(head, teeth, ...tooth, ...low);
  }

  // ------------------------------------------------------------------ the arms and hands
  const rk = 0.6 + 0.4 * fr.arm, hs = fr.hand;
  for (const [sd, sx] of [['R', SIDE_X.R], ['L', SIDE_X.L]] as const) {
    const sh = J['shoulder' + sd], el = J['elbow' + sd], wr = J['wrist' + sd];
    bag.put(sh, B, ball(V(-sx * 0.01, -0.035, 0), 0.082 * rk, 12, 10), ball(V(sx * 0.055, -0.075, 0.015), 0.045 * rk),
      shaft(V(0, -0.09, 0), V(0, -1.03, -0.005), (t) => (0.04 + 0.014 * (1 - t) ** 3 + 0.013 * t ** 4) * rk),
      blob(V(-sx * 0.072, -1.06, -0.01), [0.036 * rk, 0.03, 0.03]), blob(V(sx * 0.064, -1.065, 0), [0.028 * rk, 0.028, 0.028]), blob(V(0, -1.095, 0.01), [0.074 * rk, 0.036, 0.042 * rk]));
    bag.put(el, B, blob(V(-sx * 0.015, 0.03, -0.055), [0.034 * rk, 0.055, 0.034 * rk]),
      shaft(V(-sx * 0.02, -0.02, -0.035), V(-sx * 0.05, -0.96, -0.01), (t) => (0.033 - 0.013 * t) * rk), ball(V(-sx * 0.05, -0.975, -0.01), 0.024 * rk, 8, 6),
      blob(V(sx * 0.045, -0.035, 0.012), [0.032 * rk, 0.022, 0.032 * rk]), shaft(V(sx * 0.045, -0.06, 0.012), V(sx * 0.055, -0.95, 0), (t) => (0.022 + 0.02 * t * t) * rk),
      blob(V(sx * 0.045, -0.975, 0), [0.05 * rk, 0.028, 0.034 * rk]));
    const fs = fingers[sd]; if (!wr || !fs) continue;
    const hand: Geo[] = [blob(V(0, -0.04 * hs, 0.008), [0.062 * hs, 0.032 * hs, 0.03 * hs], undefined, undefined, 10, 8)];
    const end = (fg: Seg, k: number) => V(0, k * (fg.h / 2 + fg.r * 0.4), 0).applyMatrix4(fg.m);
    fs.forEach((fg, i) => {
      // each finger bone where the posed finger was, thinner, with its knuckle
      const cap = new THREE.CapsuleGeometry(fg.r * 0.56, fg.h * 0.95, 3, 6); cap.applyMatrix4(fg.m); hand.push(weld(cap), ball(end(fg, 1), fg.r * 0.72, 7, 5));
      const isK1 = i < 8 && i % 2 === 0, isK2 = i < 8 && i % 2 === 1, thumb = i === 8;
      if (isK1 || thumb) { const k = end(fg, 1), b0 = thumb ? V(sx * 0.045 * hs, -0.06 * hs, 0.025) : V(k.x * 0.55, -0.07 * hs, 0.012); hand.push(sweep([b0, b0.clone().lerp(k, 0.5).add(V(0, 0, 0.006)), k], (t) => (0.015 - 0.003 * t) * hs, (t) => (0.013 - 0.002 * t) * hs, V(0, 0, 1), { n: 6, seg: 6 })); }
      if (isK2 || thumb) { // the fingertip, curling on past the last joint
        const e = end(fg, -1), q = new THREE.Quaternion().setFromRotationMatrix(fg.m), d = V(0, -1, 0).applyQuaternion(q), hinge = V(1, 0, 0).applyQuaternion(q);
        d.applyAxisAngle(hinge, -0.5); const tip = new THREE.CapsuleGeometry(fg.r * 0.42, 0.03 * hs, 3, 6);
        tip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), d)); const c = e.clone().addScaledVector(d, 0.022 * hs); tip.translate(c.x, c.y, c.z); hand.push(weld(tip));
      }
    });
    bag.put(wr, B, ...hand);
  }

  // ------------------------------------------------------------------ the legs and feet
  const lk = 0.6 + 0.4 * fr.leg, fl = fr.fem ? 1.02 : 1.18;
  for (const [sd, sx] of [['R', SIDE_X.R], ['L', SIDE_X.L]] as const) {
    const hp = J['hip' + sd], kn = J['knee' + sd], an = J['ankle' + sd];
    bag.put(hp, B, ball(V(0, 0, 0), 0.082 * lk, 12, 10), sweep([V(0, 0, 0), V(sx * 0.06, -0.05, -0.005), V(sx * 0.11, -0.095, -0.01)], 0.046 * lk, 0.05 * lk, V(0, 0, 1), { n: 8, seg: 8 }),
      blob(V(sx * 0.14, -0.075, -0.025), [0.05 * lk, 0.07 * lk, 0.055 * lk]), ball(V(sx * 0.055, -0.2, -0.04), 0.028 * lk, 8, 6),
      shaft(V(sx * 0.11, -0.12, 0), V(0, -1.27, 0), (t) => (0.05 - 0.008 * Math.sin(Math.PI * t) + 0.014 * t ** 4) * lk),
      blob(V(-sx * 0.05, -1.32, -0.02), [0.05 * lk, 0.065, 0.07 * lk]), blob(V(sx * 0.05, -1.32, -0.02), [0.048 * lk, 0.06, 0.068 * lk]), blob(V(0, -1.29, 0.04), [0.06 * lk, 0.05, 0.04 * lk]),
      blob(V(0, -1.28, 0.1 * lk), [0.048 * lk, 0.06 * lk, 0.025]));
    bag.put(kn, B, blob(V(0, -0.055, -0.005), [0.1 * lk, 0.045, 0.08 * lk]), ball(V(0, -0.15, 0.07 * lk), 0.03 * lk, 8, 6),
      shaft(V(0, -0.08, 0.01), V(-sx * 0.01, -1.17, 0), (t) => (0.055 - 0.022 * t + 0.014 * t ** 4) * lk),
      blob(V(-sx * 0.04, -1.21, 0.005), [0.03 * lk, 0.05, 0.035 * lk]), blob(V(-sx * 0.005, -1.2, 0), [0.055 * lk, 0.035, 0.045 * lk]),
      ball(V(sx * 0.075, -0.1, -0.03), 0.03 * lk, 8, 6), shaft(V(sx * 0.075, -0.12, -0.03), V(sx * 0.07, -1.16, -0.02), 0.019 * lk, 8, 7), blob(V(sx * 0.07, -1.21, -0.02), [0.027 * lk, 0.055, 0.03 * lk]));
    if (!an) continue;
    // the foot: the ankle bone, the heel down and back to the floor, the arch, five long bones out to the ball of the
    // foot (the big toe's inside, toward the other foot) and the toes on the floor
    const foot = new THREE.Group(); foot.name = 'foot' + sd; an.add(foot); J['foot' + sd] = foot;
    const fb: Geo[] = [blob(V(0, -0.07, 0.03), [0.06, 0.05, 0.08]), sweep([V(0, -0.16, 0.06), V(0, -0.27, -0.06), V(0, -0.39, -0.15 * fl)], 0.06, 0.06, V(1, 0, 0), { n: 8, seg: 8 }),
      ball(V(0, -0.41, -0.165 * fl), 0.06, 10, 8), blob(V(0, -0.2, 0.15 * fl), [0.085, 0.05, 0.08])];
    for (let k = 0; k < 5; k++) {
      const x = -sx * 0.072 + sx * 0.037 * k, big = k === 0, r = big ? 0.026 : 0.019 - 0.001 * k, z1 = 0.4 * fl - 0.015 * k;
      fb.push(sweep([V(x * 0.6, -0.24, 0.2 * fl), V(x * 0.85, -0.35, 0.31 * fl), V(x, -0.43, z1)], r, r * 0.9, V(1, 0, 0), { n: 6, seg: 6 }), ball(V(x, -0.435, z1), big ? 0.036 : 0.031, 8, 6));
      const z2 = (0.47 - 0.012 * k) * fl, z3 = (0.515 - 0.02 * k) * fl;
      fb.push(sweep([V(x, -0.44, z1), V(x * 1.05, -0.448, z2), V(x * 1.06, -0.452, z3)], r * 0.75, r * 0.7, V(1, 0, 0), { n: 6, seg: 6 }), ball(V(x * 1.05, -0.448, z2), r * 0.85, 6, 5), ball(V(x * 1.06, -0.452, z3), r * 0.7, 6, 5));
    }
    bag.put(foot, B, ...fb);
  }

  // ------------------------------------------------------------------ what it wears
  // the belt: on the hip bones (in the pelvis's frame, so a twist of the chest never cuts it through them), slung low in
  // front where there is nothing to hold it up; the belt mounts move onto it
  if (o.belt !== false) {
    const bc = o.belt ?? '#3b2f26', loop = [V(0, 0.47, -0.25), V(0.3, 0.47, -0.21), V(0.5, 0.44, -0.02), V(0.44, 0.38, 0.18), V(0.22, 0.31, 0.27), V(0, 0.28, 0.295)];
    const ring = [...loop, ...loop.slice(1, -1).reverse().map((p) => V(-p.x, p.y, p.z))];
    bag.put(pel, bc, sweep(ring, 0.013, 0.04, (p) => V(p.x, 0, p.z - 0.02), { closed: true, n: 60, seg: 6 }));
    const buckle = new THREE.TorusGeometry(0.04, 0.011, 5, 4); buckle.rotateZ(Math.PI / 4); buckle.scale(1.2, 1, 1); buckle.translate(0, 0.28, 0.31);
    bag.put(pel, '#5a4a3a', weld(buckle));
    for (const [sd, sx] of [['R', SIDE_X.R], ['L', SIDE_X.L]] as const) { const m = J['belt' + sd]; if (!m) continue; pel.attach(m); m.position.set(sx * 0.49 * s, 0.43 * s, 0.0); }
    // rags hanging from it: a flap before and a longer one behind, torn at the hem, and short strips over the hips
    if (o.rags) {
      const rag = (top: (u: number) => V3, len: (u: number) => number, nu: number, nv: number, bulge: (u: number, v: number) => V3, seed: number) => {
        const P: V3[][] = []; for (let j = 0; j <= nv; j++) { const v = j / nv, row: V3[] = []; for (let i = 0; i <= nu; i++) { const u = i / nu, L = len(u) * (1 - 0.22 * hash(seed + i * 7) * v * v); row.push(top(u).add(V(0, -L * v, 0)).add(bulge(u, v))); } P.push(row); }
        return sheet(P);
      };
      bag.cloth(pel, o.rags, rag((u) => V(-0.15 + 0.3 * u, 0.3 - 0.02 * Math.sin(Math.PI * u), 0.305), () => 0.72, 6, 6, (u, v) => V(0.03 * v * (u - 0.5), 0, 0.02 * Math.sin(Math.PI * v) + 0.012 * Math.sin(u * 9 + v * 4)), 3),
        rag((u) => V(-0.24 + 0.48 * u, 0.46, -0.255 - 0.03 * Math.sin(Math.PI * u)), () => 0.9, 7, 7, (u, v) => V(0.06 * v * (u - 0.5), 0, -0.03 * v - 0.012 * Math.sin(u * 11 + v * 3)), 11));
      for (const sx of [-1, 1]) for (const [z, L] of [[0.06, 0.34], [-0.12, 0.42]] as const) bag.cloth(pel, tone(o.rags, '#000000', 0.12), rag((u) => V(sx * (0.5 - 0.02 * u), 0.43, z - 0.06 + 0.12 * u), () => L, 2, 4, (_u, v) => V(sx * 0.02 * v, 0, 0), 20 + z * 50));
    }
  }
  if (o.mail) {
    // a ruined shirt of mail hanging from the shoulders over the ribs, to the hips, holed through and torn at the hem
    const mc = o.mail, rows = [[2.17, 0.26, 0.2, 0.22], [2.08, 0.56, 0.26, 0.3], [1.97, 0.84, 0.3, 0.33], [1.8, cageW(1.8) + 0.08, zFront(1.8) + 0.05, 0.36], [1.5, cageW(1.5) + 0.06, zFront(1.5) + 0.05, 0.35],
      [1.1, cageW(1.1) + 0.06, zFront(1.25) + 0.04, 0.34], [0.7, cageW(1.0) + 0.05, zFront(1.2) + 0.01, 0.33], [0.42, 0.54, 0.32, 0.31], [0.1, 0.57, 0.34, 0.34], [-0.4, 0.62, 0.37, 0.37]];
    const P: V3[][] = [], NU = 40, span = 2.17 - (o.seated ? 0.24 : -0.4);
    for (let j = 0; j <= 30; j++) {
      const y = 2.17 - (span * j) / 30, k = rows.findIndex((r) => r[0] <= y), a = rows[Math.max(0, k - 1)], b = rows[k < 0 ? rows.length - 1 : k], t = a[0] === b[0] ? 0 : (a[0] - y) / (a[0] - b[0]);
      const w = a[1] + (b[1] - a[1]) * t, ff = a[2] + (b[2] - a[2]) * t, bb = a[3] + (b[3] - a[3]) * t, ripple = j % 2 ? 1.006 : 0.994, row: V3[] = [];
      for (let i = 0; i <= NU; i++) { const th = (i / NU) * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th), hem = j === 30 ? 0.12 * hash(i * 3.1) : 0; row.push(V(sn * w * ripple, y + hem, cs * (cs > 0 ? ff : bb) * ripple)); }
      P.push(row);
    }
    bag.cloth(up, mc, sheet(P, (i, j) => j > 4 && j < 29 && hash(Math.floor(i / 3) * 13 + Math.floor(j / 3) * 7) > 0.84));
    for (const sd of ['R', 'L']) {
      const sh = J['shoulder' + sd]; if (!sh) continue;
      const Q: V3[][] = []; for (let j = 0; j <= 8; j++) { const y = 0.08 - 0.62 * j / 8, r = 0.15 + 0.02 * j / 8, row: V3[] = []; for (let i = 0; i <= 18; i++) { const th = (i / 18) * Math.PI * 2, hem = j === 8 ? 0.1 * hash(i * 5.7 + (sd === 'R' ? 1 : 2)) : 0; row.push(V(Math.sin(th) * r, y + hem, Math.cos(th) * r)); } Q.push(row); }
      bag.cloth(sh, mc, sheet(Q, (i, j) => j > 2 && j < 7 && hash(i * 3 + j * 17 + (sd === 'R' ? 0 : 5)) > 0.82));
    }
  }
  // what is slung on the back rests on the shoulder blades
  if (J.back) J.back.position.z = -(ringAt(tr, 1.5).b * 0.85 + 0.02) * s;

  bag.flush(s);
  g.updateMatrixWorld(true);
  return g;
}

// ------------------------------------------------------------------ the horse
// A horse's skull in its head's frame (kit/beasts.ts: +z down the face to the teeth, the joint inside the braincase),
// sculpted for the riding horse's head and scaled to others: the small braincase, the brow broad across the sockets with
// their rims standing out at the sides, the long face narrowing to the teeth, the notch between the nose's bones and the
// jaw, the cheek's crest; the lower jaw's broad hind plate under the braincase and its bar forward to the chin.
const hOrbit = (ax: number, y: number, z: number) => ell(ax - 0.25, y - 0.075, z - 0.27, 0.085, 0.085, 0.09);
const hNotch = (ax: number, y: number, z: number) => ell(ax - 0.15, y + 0.09, z - 1.2, 0.075, 0.07, 0.22);
const hTemple = (ax: number, y: number, z: number) => ell(ax - 0.23, y - 0.06, z + 0.07, 0.07, 0.12, 0.14);
const RIM = V(0.85, 0.1, 0.5).normalize();
function horseSkullBase(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(x, y - 0.03, z + 0.08, 0.19, 0.19, 0.26);
  d = smin(d, ell(x, y - 0.03, z - 0.24, 0.27, 0.2, 0.2), 0.1);
  const tz = ramp(0.35, 1.5, z);
  d = smin(d, ell(x / (1 - 0.42 * tz), (y + 0.05) / (1 - 0.3 * tz), z - 0.86, 0.21, 0.19, 0.74), 0.12);
  d = smin(d, ell(x, y + 0.13, z - 1.5, 0.12, 0.08, 0.1), 0.06);
  // the socket's rim, a ring facing out and forward, and the bar over it back to the temple
  const px = ax - 0.25, py = y - 0.075, pz = z - 0.27, h = px * RIM.x + py * RIM.y + pz * RIM.z, rho = Math.hypot(px - RIM.x * h, py - RIM.y * h, pz - RIM.z * h);
  d = smin(d, Math.hypot(rho - 0.1, h) - 0.026, 0.03);
  d = smin(d, seg(ax, y, z, [0.15, 0.17, 0.2], [0.29, 0.14, 0.31]) - 0.034, 0.04);
  d = smin(d, seg(ax, y, z, [0.24, -0.03, 0.34], [0.2, -0.11, 0.66]) - 0.03, 0.04);
  // the lower jaw
  d = smin(d, ell(ax - 0.19, y + 0.27, z + 0.02, 0.035, 0.2, 0.17), 0.05);
  d = smin(d, run(ax, y, z, [[0.19, -0.42, 0.05], [0.17, -0.35, 0.5], [0.12, -0.28, 1.0], [0.05, -0.23, 1.42]]) - 0.045, 0.05);
  d = smin(d, ell(x, y + 0.22, z - 1.47, 0.09, 0.05, 0.08), 0.04);
  return d;
}
function horseSkullField(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = smax(horseSkullBase(x, y, z), -hOrbit(ax, y, z), 0.025);
  d = smax(d, -hNotch(ax, y, z), 0.03);
  return smax(d, -hTemple(ax, y, z), 0.05);
}
const horseShade = (x: number, y: number, z: number) => { const ax = Math.abs(x), k = Math.min(hOrbit(ax, y, z), hNotch(ax, y, z)) < 0.02 ? 1 : 0.35; return k * ramp(0.004, 0.045, -horseSkullBase(x, y, z)); };
let HORSE_SKULL: Geo | undefined;
const horseSkullGeo = () => (HORSE_SKULL ??= nets(horseSkullField, [-0.4, -0.56, -0.4], [0.4, 0.3, 1.66], 0.024, horseShade));

/** Take the hide off a horse built by kit/beasts.ts beast() and set a horse's skeleton on its joints: the long skull
 *  with its jaw, the neck's long vertebrae, the spine along the back with the tall spines of the withers, the ribs round
 *  the barrel to the breastbone, the shoulder blades, the pelvis, the leg bones with their knobbed joints (the point of
 *  the elbow, the knee, the point of the hock, the fetlock), bony hooves, and the tail's little bones. Its saddle and
 *  stirrups stay on, and a rider in the saddle; `mail` drapes a ruined mail trapper over its back, holed and torn. */
export function boneHorse(g: THREE.Group, sp: BeastSpec, o: { mail?: string } = {}): THREE.Group {
  const J = (g.userData.joints ?? {}) as Joints, body = J.body, hips = J.hips, neck = J.neck, head = J.head, tail = J.tail;
  if (!body || !hips || !neck || !head) return g;
  // the hide off: everything on the joints but the tack (and the saddle's rider)
  const tack = new Set<string>();
  if (sp.saddle) for (const c of [sp.saddle.seat, sp.saddle.trim ?? '#b08a3a', tone(sp.saddle.seat, '#000000', 0.3), sp.saddle.cloth]) if (c) tack.add(new THREE.Color(c).getHexString());
  const joints = new Set<THREE.Object3D>(Object.values(J));
  for (const [name, j] of Object.entries(J)) {
    if (name === 'saddle' || !(j as THREE.Group).isGroup) continue;
    for (const c of [...j.children]) {
      if (joints.has(c)) continue;
      let keep = false; c.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh && tack.has((mm.material as THREE.MeshLambertMaterial).color?.getHexString())) keep = true; });
      if (!keep) j.remove(c);
    }
  }
  const B = sp.coat, B2 = sp.under ?? tone(B, '#6a5a44', 0.16), horn = tone(B, '#5a4a3a', 0.3), bag = new Bag();
  const into = (from: THREE.Object3D, p: V3, to: THREE.Object3D) => { g.updateMatrixWorld(true); return to.worldToLocal(from.localToWorld(p.clone())); };

  // the barrel's rings, as the hide was lofted (so the ribs and the trapper fit the body the beast was built with)
  const gaunt = sp.gaunt ?? 0, rings: { z: number; y: number; rx: number; ry: number }[] = [];
  for (let i = 0; i <= 9; i++) {
    const u = i / 9, z = -sp.loin * 0.6 + u * (sp.len + sp.loin * 0.6 + sp.chest * 0.55), k = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.45;
    const deep = (sp.loin + (sp.chest - sp.loin) * Math.min(1, u * 1.5) ** 1.2) * (0.55 + 0.45 * k) * (u > 0.2 && u < 0.6 ? 1 - gaunt * 0.25 : 1);
    const tuck = (u > 0.15 && u < 0.55 ? Math.sin((u - 0.15) / 0.4 * Math.PI) : 0) * (sp.chest - sp.loin) * 0.35;
    rings.push({ z, y: -deep * 0.72 + tuck * 0.5 + (u > 0.8 ? (u - 0.8) * sp.chest * 0.9 : 0), rx: sp.width * (0.6 + 0.4 * k), ry: deep - tuck * 0.5 });
  }
  const ring = (z: number) => {
    let i = 0; while (i < rings.length - 2 && rings[i + 1].z < z) i++;
    const a = rings[i], b = rings[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
    return { y: a.y + (b.y - a.y) * t, rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t };
  };
  const yS = (z: number) => { const r = ring(z); return r.y + r.ry * 0.78; };

  // the spine from the withers to the loins, the spines of the withers standing tall and sloping back
  const back: Geo[] = [], zW = sp.len + sp.chest * 0.12, zL = 0.25, NV = 20, wither = (z: number) => Math.exp(-((((zW - z) / (zW - zL) - 0.18) / 0.16) ** 2));
  /** How high the spine's tips stand at a point along the back (what a trapper laid over it rests on). */
  const tips = (z: number) => yS(z) + 0.135 + 0.1 + 0.36 * wither(z);
  for (let k = 0; k < NV; k++) {
    const z = zW - (zW - zL) * k / (NV - 1), ax = V(0, yS(z + 0.1) - yS(z - 0.1), 0.2).normalize(), t = k / (NV - 1), wt = wither(z), loin = ramp(0.6, 0.9, t);
    vertebra(V(0, yS(z), z), ax, V(0, 1, 0), 0.085, 0.17, 0.1 + 0.36 * wt, 0.08 + 0.16 * loin, -(0.06 + 0.14 * wt), back, 0.035 + 0.02 * wt);
  }
  bag.put(body, B2, ...back);
  // the ribs: eighteen in life, twelve here, slanting back as they come down round the barrel; the front eight reach the
  // breastbone, the rest fall short under the belly
  const ribs: Geo[] = [];
  for (let k = 0; k < 12; k++) {
    const z0 = sp.len - k * (sp.len * 0.52 / 11), aEnd = k < 8 ? Math.PI - 0.16 : 2.45 - 0.14 * (k - 8), slant = 0.18 + 0.03 * k;
    for (const sx of [-1, 1]) {
      const pts: V3[] = [V(sx * 0.07, yS(z0) - 0.02, z0)];
      for (let i = 0; i <= 9; i++) { const a = 0.3 + (aEnd - 0.3) * i / 9, z = z0 - slant * (a / Math.PI), r = ring(z); pts.push(V(sx * Math.sin(a) * r.rx * 0.93, r.y + Math.cos(a) * r.ry * 0.93, z)); }
      ribs.push(sweep(pts, (t) => 0.045 - 0.012 * t, 0.02, V(0, 0, 1), { n: 18, seg: 6 }));
    }
  }
  bag.put(body, B, ...ribs);
  {
    const st: V3[] = []; for (let i = 0; i <= 5; i++) { const z = sp.len * 0.62 + (sp.len * 0.38 + sp.chest * 0.42) * i / 5, r = ring(z); st.push(V(0, r.y - r.ry * 0.9 + 0.03 * Math.sin(Math.PI * i / 5), z)); }
    bag.put(body, B, sweep(st, (t) => 0.07 - 0.03 * t, 0.045, V(0, 1, 0), { n: 14, seg: 7 }));
  }
  // the shoulder blades, slanting from the withers down and forward to the points of the shoulders, the spine of each
  // standing out along it
  for (const sx of [-1, 1]) {
    const zT = sp.len - sp.chest * 0.7, rT = ring(zT), top = V(sx * rT.rx * 0.78, yS(zT) + 0.02, zT), bot = V(sx * sp.width * 0.64, -sp.chest * 0.42, sp.len - sp.chest * 0.02), mid = top.clone().lerp(bot, 0.5).add(V(sx * 0.08, 0, 0));
    bag.put(body, B, sweep([top, mid, bot], (t) => 0.21 - 0.15 * t, 0.024, V(0, 0, 1), { n: 12, seg: 8 }));
    bag.put(body, B, sweep([top.clone().add(V(sx * 0.03, -0.05, 0)), mid.clone().add(V(sx * 0.035, 0, 0)), bot.clone().add(V(sx * 0.02, 0.08, 0))], 0.014, (t) => 0.04 * Math.sin(Math.PI * (0.15 + 0.7 * t)), V(0, 0, 1), { n: 10, seg: 6 }));
  }
  // the pelvis on the hindquarters: the sacrum under the croup, each hip bone's wing out to the point of the hip, its
  // neck down to the socket, the seat bone back to its point, the pubic bone in to the join
  {
    const pv: Geo[] = [], hL = J.legHL0, hy = hL ? hL.position.y : -sp.loin * 0.35, hz = hL ? hL.position.z : sp.loin * 0.1, hx = hL ? Math.abs(hL.position.x) : sp.width * 0.68;
    pv.push(sweep([V(0, yS(0.3), 0.3), V(0, yS(0) - 0.01, 0), V(0, yS(-0.3) - 0.06, -0.32), V(0, yS(-0.5) - 0.12, -sp.loin * 0.55)], (t) => 0.15 - 0.09 * t, 0.05, V(1, 0, 0), { n: 12, seg: 7 }));
    for (const sx of [-1, 1]) {
      const sac = V(sx * 0.12, yS(0.15) + 0.02, 0.15), coxa = V(sx * sp.width * 0.9, yS(0.6) - 0.12, sp.loin * 0.62), cup = V(sx * hx, hy, hz), seat = V(sx * hx * 0.6, hy + 0.12, -sp.loin * 0.52);
      pv.push(sweep([sac, sac.clone().lerp(coxa, 0.5).add(V(0, 0.03, 0)), coxa], (t) => 0.13 - 0.03 * t, 0.035, V(0, 0, 1).add(V(0, 0.6, 0)), { n: 10, seg: 7 }), blob(coxa, [0.08, 0.07, 0.09]));
      pv.push(sweep([sac.clone().lerp(coxa, 0.55).add(V(0, -0.04, 0)), cup.clone().add(V(0, 0.08, 0.03))], (t) => 0.075 - 0.01 * t, 0.06, V(0, 0, 1), { n: 8, seg: 7 }), ball(cup, 0.115, 10, 8));
      pv.push(sweep([cup.clone().add(V(0, -0.02, -0.05)), cup.clone().lerp(seat, 0.5).add(V(0, -0.04, 0)), seat], (t) => 0.06 + 0.02 * t, 0.035, V(0, 1, 0), { n: 8, seg: 7 }), blob(seat, [0.06, 0.07, 0.06]));
      pv.push(sweep([cup.clone().add(V(-sx * 0.05, -0.06, 0.02)), V(sx * 0.12, hy - 0.2, hz - 0.05), V(0, hy - 0.26, hz - 0.12)], 0.035, 0.03, V(0, 0, 1), { n: 8, seg: 6 }));
    }
    bag.put(hips, B, ...pv);
  }
  // the neck's seven long vertebrae from the withers to the skull
  {
    const n0 = into(body, V(0, yS(zW) - 0.02, zW + 0.12), neck), n3 = into(head, V(0, -0.12, -0.3), neck), up = V(0, n3.z - n0.z, -(n3.y - n0.y)).normalize();
    const curve = new THREE.CatmullRomCurve3([n0, n0.clone().lerp(n3, 0.35).addScaledVector(up, -0.06), n0.clone().lerp(n3, 0.7).addScaledVector(up, -0.02), n3], false, 'centripetal'), cerv: Geo[] = [];
    for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, c = curve.getPointAt(t), ax = curve.getTangentAt(t); vertebra(c, ax, up, 0.11 - 0.015 * t, curve.getLength() / 7 * 0.8, k === 6 ? 0.12 : 0.07, 0.14, -0.05, cerv, 0.04); }
    bag.put(neck, B2, ...cerv);
  }
  // the skull, painted dark down in its sockets and the notches, and scaled to this horse's head
  {
    const sg = horseSkullGeo().clone(), sh = sg.getAttribute('shade') as THREE.BufferAttribute, c0 = new THREE.Color(B), c1 = new THREE.Color('#17120e'), cc = new THREE.Color(), col = new Float32Array(sh.count * 3);
    for (let i = 0; i < sh.count; i++) { cc.copy(c0).lerp(c1, sh.getX(i)); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
    sg.deleteAttribute('shade'); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); const kw = sp.skullW / 0.38; sg.scale(kw, kw, (sp.skull * 0.62 + sp.muzzle) / (0.95 * 0.62 + 1.05));
    const m = soft('#ffffff').clone(); m.vertexColors = true; m.userData = { ...m.userData, smooth: true, keepLook: true };
    const mesh = new THREE.Mesh(sg, m); mesh.userData.keepLook = true; head.add(mesh);
  }
  // the legs: for each segment its long bone and the knobs at its joints, measured from the joints as the beast stood
  for (const sd of ['FL', 'FR', 'HL', 'HR']) {
    const j0 = J['leg' + sd + '0'], j1 = J['leg' + sd + '1'], j2 = J['leg' + sd + '2'], ft = J['leg' + sd + 'Foot']; if (!j0 || !j1 || !j2 || !ft) continue;
    const front = sd[0] === 'F', sx = sd[1] === 'L' ? 1 : -1, r = sp.leg * (front ? 1 : 1.25), L0 = -j1.position.y, L1 = -j2.position.y, L2 = -ft.position.y;
    if (front) {
      // the upper arm, its knob forward at the point of the shoulder; the forearm with the point of the elbow behind it
      bag.put(j0, B, blob(V(0, 0.02, 0.09), [r * 0.62, r * 0.7, r * 0.75]), shaft(V(0, -0.05, 0.02), V(0, -L0 + 0.05, -0.02), (t) => r * (0.62 - 0.14 * Math.sin(Math.PI * t))), blob(V(0, -L0 + 0.02, 0), [r * 0.55, r * 0.45, r * 0.55]));
      bag.put(j1, B, blob(V(0, 0.1, -r * 0.95), [r * 0.32, r * 0.55, r * 0.42]), shaft(V(0, -0.02, 0), V(0, -L1 + 0.06, 0), (t) => r * (0.5 - 0.1 * t)), blob(V(0, -L1 + 0.02, 0.01), [r * 0.56, r * 0.46, r * 0.48]));
    } else {
      // the thigh bone, its knob up behind; the shin, the kneecap before it; the hock's point behind the cannon's top
      bag.put(j0, B, blob(V(sx * r * 0.2, 0.06, -r * 0.35), [r * 0.45, r * 0.6, r * 0.5]), shaft(V(0, -0.04, 0), V(0, -L0 + 0.06, 0.02), (t) => r * (0.56 - 0.12 * Math.sin(Math.PI * t))), blob(V(0, -L0 + 0.03, 0.03), [r * 0.5, r * 0.45, r * 0.5]), blob(V(0, -L0 + 0.06, r * 0.5), [r * 0.22, r * 0.3, r * 0.2]));
      bag.put(j1, B, shaft(V(0, -0.03, 0), V(0, -L1 + 0.06, 0), (t) => r * (0.5 - 0.14 * t)), blob(V(0, -L1 + 0.02, 0), [r * 0.4, r * 0.38, r * 0.4]));
      bag.put(j2, B, blob(V(0, 0.08, -r * 0.6), [r * 0.22, r * 0.42, r * 0.3]));
    }
    // the cannon bone, the fetlock's knob at its foot
    bag.put(j2, B, shaft(V(0, -0.03, 0), V(0, -L2 + 0.04, 0), (t) => r * (0.34 + 0.04 * t)), blob(V(0, -L2 + 0.01, -0.01), [r * 0.42, r * 0.34, r * 0.46]));
    // the pastern down and forward to the hoof's bone, broad at the floor
    const fh = 0.26;
    bag.put(ft, B, shaft(V(0, -0.02, -0.01), V(0, -fh * 0.55, r * 0.18), r * 0.22, 8, 7));
    bag.put(ft, horn, blob(V(0, -fh * 0.78, r * 0.25), [r * 0.55, fh * 0.24, r * 0.7], (p) => { if (p.y < -0.3) p.y = -0.3 - (p.y + 0.3) * 0.2; }));
  }
  // the tail's little bones, curving down from the croup
  if (tail) {
    const TL = sp.tailLen * 0.42, tc = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -TL * 0.3, -TL * 0.45), V(0, -TL * 0.75, -TL * 0.75), V(0, -TL * 1.1, -TL * 0.85)]), tb: Geo[] = [];
    for (let k = 0; k < 11; k++) { const t = (k + 0.5) / 11, c = tc.getPointAt(t), ax = tc.getTangentAt(t), rr = 0.055 * (1 - 0.6 * t); tb.push(blob(c, [rr, rr, TL * 0.06], undefined, basis(V(1, 0, 0), ax).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0)), 8, 6)); }
    bag.put(tail, B2, ...tb);
  }
  // the ruined mail trapper over the back, from the withers to the croup and down its sides, holed and torn at the hem
  if (o.mail) {
    // laid over the spine's tips and down the barrel's sides, shorter toward the withers and the croup so its outline
    // rounds off at both ends, the hem hanging ragged
    const P: V3[][] = [], NZ = 24, NA = 26, zA = sp.len + sp.chest * 0.3, zB = -sp.loin * 0.55;
    for (let j = 0; j <= NZ; j++) {
      const u = j / NZ, z = zA - (zA - zB) * u, r = ring(z), aMax = 1.15 + 0.55 * Math.sin(Math.PI * u) ** 0.6, top = Math.max(r.ry * 1.06, tips(z) + 0.04 - r.y), row: V3[] = [];
      for (let i = 0; i <= NA; i++) {
        const a = -aMax + 2 * aMax * i / NA, c = Math.cos(a), ry = c > 0 ? r.ry * 1.06 + (top - r.ry * 1.06) * c ** 3 : r.ry * 1.06, edge = i === 0 || i === NA, drop = edge ? 0.06 + 0.28 * hash(j * 3.7 + i) : 0;
        row.push(V(Math.sin(a) * r.rx * 1.08, r.y + c * ry - drop, z));
      }
      P.push(row);
    }
    // laid along the body, the rows run along it: turned so the sheet's rows go down its sides
    const T: V3[][] = []; for (let i = 0; i <= NA; i++) T.push(P.map((row) => row[i]));
    bag.cloth(body, o.mail, sheet(T, (i, j) => j > 2 && j < NA - 3 && i > 1 && i < NZ - 1 && hash(Math.floor(i / 2) * 13 + Math.floor(j / 2) * 7) > 0.8));
  }
  bag.flush(1);
  g.updateMatrixWorld(true);
  return g;
}

