// Clothes cut for one character from their portrait, beyond what the shared figure makes (kit/heroes.ts): a doublet with
// a frogged placket and a tall collar, a sash knotted at the waist, skirts to the knee in panels, a pauldron on one
// shoulder, chains down the chest, and a cloak with its lining. Every piece is made for the figure after it is built and
// posed: fitted to its own body (the ring stacks the rig lofts it from, kit/anatomy.ts) and to its pose, so what hangs
// from the waist follows the legs (each point of the skirts carried by the thigh it lies over, the waist by the chest),
// and the cloak falls plumb from the shoulders and is pushed out by whatever it would otherwise cut through: a leg swung
// back, an arm, a scabbard. Nothing here moves after it is made, so the pose is baked into the cloth. Cut for a
// masculine frame (a feminine frame's bust is not carried). Original geometry; no book art.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frameFor, SIDE_X, type HeroFigure } from './heroes';
import { hangGarments, pointsOf, type DrapeWorld } from './cloth';
import { THIGH, clipRings, forearmRings, loftGeometry, neckRings, pelvisRings, ringAt, ringPoint, shinRings, thighRings, torsoRings, upperArmRings, type Frame, type Ring } from './anatomy';
import { ell, mirrorX, nets, seg, smax, smin, type Sdf } from './sdf';
import { mat } from '../render/materials';
import { flatLock } from './hair';

/** What a character wears over the figure's own clothes (each piece optional; colours are palette hexes). */
export interface Doublet {
  /** The doublet's placket: a dark band down the middle of the front, from the collar to the hem of the skirts. */
  placket?: string;
  /** Frogged closures across the placket: a button with knotted loops either side of it. */
  frogs?: string;
  /** A tall band collar standing round the neck, open in a narrow V at the throat, and its lining and edge. */
  collar?: { color: string; edge?: string };
  /** A wide sash wound round the waist, knotted toward one side with its ends hanging; cords with metal tips. */
  sash?: { color: string; side?: 'R' | 'L'; cords?: string };
  /** One pauldron on one shoulder: a domed cap with a raised boss, and lames down the arm, edged. */
  pauldron?: { side: 'R' | 'L'; color: string; trim?: string };
  /** Chains looped down the chest from under the pauldron's shoulder to the sash. */
  chains?: string;
  /** Skirts to the knee: the front panel (`front`, the doublet's own colour unless given) and the sides and back
   *  (`color`), their edges trimmed (`edge`). */
  skirts?: { color: string; front?: string; edge?: string };
  /** A cloak hung from the back of the shoulders to the calf, and its lining. */
  cloak?: { color: string; lining?: string };
  /** A fur slung over one shoulder: heaped on it and up against the collar, over the top of the arm, a little way down
   *  the chest and further down the back, over the cloak (`size` deepens it; 1 the standard). */
  fur?: { color: string; side: 'R' | 'L'; size?: number };
}

type V3 = THREE.Vector3;
type Joints = Record<string, THREE.Object3D>;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ramp = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** A smooth-shaded palette colour, as the figure's own cloth is (`double`: both faces drawn, for a thin edge seen from
 *  either side). The same materials the rig uses, so a token's merge by material keeps them together. */
function soft(c: string, double = false): THREE.MeshLambertMaterial {
  const m = mat(c, { emissive: double ? '#020302' : '#030303' }); m.userData.smooth = true; if (double) m.side = THREE.DoubleSide; return m;
}

/** A surface through rows of points, the rows in order down it and each row running the same way across. It faces the
 *  side that down x across points to: outward for rows that run round a body in the direction of increasing angle
 *  (`flip` faces it the other way, for a lining). */
function grid(P: V3[][], flip = false): THREE.BufferGeometry {
  const nu = P[0].length, pos: number[] = [], idx: number[] = [];
  for (const row of P) for (const p of row) pos.push(p.x, p.y, p.z);
  for (let j = 0; j < P.length - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A round cord along points (a trim, a chain's run, a hanging cord). */
const cord = (pts: V3[], r: number, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(8, pts.length * 3), r, 6, closed);
/** Geometries as one (positions and normals only, so any of them merge; indexed if they all are, so it shades smooth). */
const merged = (geos: THREE.BufferGeometry[]) => { const ix = geos.every((x) => x.index); return mergeGeometries(geos.map((x) => { const y = ix ? x.clone() : x.index ? x.toNonIndexed() : x.clone(); for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k); return y; }))!; };
const meshOf = (geos: THREE.BufferGeometry[], m: THREE.Material) => new THREE.Mesh(merged(geos), m);
/** A part set on a surface: its own +z along the surface's normal `n`, its +x toward `across`, at `p`. */
function placed(geo: THREE.BufferGeometry, p: V3, n: V3, across: V3): THREE.BufferGeometry {
  const Z = n.clone().normalize(), X = across.clone().addScaledVector(Z, -across.dot(Z)).normalize(), Y = Z.clone().cross(X);
  return geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p));
}

// ---------------------------------------------------------------------------------------------------- the body's shape
/** The chest's own shape (as the rig sculpts it): a masculine frame's pectorals in front, the shoulder blades behind. */
const pecs = (fr: Frame, th: number, y: number) => (fr.fem ? 0 : 0.07 * Math.exp(-((y - 1.62) ** 2) / 0.035) * Math.max(0, Math.cos(th)) ** 1.5 * (0.55 + 0.45 * Math.abs(Math.sin(th * 1.6))))
  + 0.04 * Math.exp(-((y - 1.7) ** 2) / 0.05) * Math.max(0, -Math.cos(th)) ** 2 * Math.abs(Math.sin(th * 2));
/** The seat (as the rig sculpts it): two cheeks at the back of the hips. */
const seatBump = (fr: Frame, th: number, y: number) => {
  const seat = (fr.fem ? (fr.build === 'curvy' ? 0.62 : 0.48) : 0.26) * (0.4 + 0.6 * fr.m.hips), back = Math.PI - Math.abs(wrapA(th)), dy = y + 0.1;
  return seat * Math.exp(-(dy * dy) / (dy > 0 ? 0.09 : 0.03)) * Math.exp(-((back - 0.42) ** 2) / 0.1);
};
/** A point on the torso's skin (the chest's frame, unit scale) at an angle and height, `k` out from it. */
const torsoAt = (fr: Frame, tr: Ring[], th: number, y: number, k = 1): [number, number] => ringPoint(ringAt(tr, y), th, k * (1 + pecs(fr, th, y)));
/** The angle at which the torso's front reaches across to x at a height. */
function thFront(fr: Frame, tr: Ring[], y: number, x: number): number {
  let lo = -Math.PI / 2, hi = Math.PI / 2;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (torsoAt(fr, tr, m, y)[0] < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** A point on the chest's front at (x, y), `out` off the skin along its normal, and that normal (unit scale). */
function onChest(fr: Frame, tr: Ring[], x: number, y: number, out: number): [V3, V3] {
  const at = (px: number, py: number) => { const [qx, qz] = torsoAt(fr, tr, thFront(fr, tr, py, px), py); return V(qx, py, qz); };
  const p = at(x, y), n = at(x + 0.01, y).sub(at(x - 0.01, y)).cross(at(x, y + 0.01).sub(at(x, y - 0.01))).normalize();
  if (n.z < 0) n.negate();
  return [p.addScaledVector(n, out), n];
}

/** The convex hull of the body's cross-section at a height in the hips' frame (unit scale), standing at rest with the
 *  thighs hanging: the torso (with the belt), the pelvis and seat, the thighs and the knees. Hanging cloth spans the
 *  gap between the legs, so the hull is what it drapes over. */
function hullAt(fr: Frame, y: number): [number, number][] {
  const pts: [number, number][] = [], N = 40;
  const add = (r: Ring, k: (th: number) => number, ox = 0) => { for (let i = 0; i < N; i++) { const th = (i / N) * Math.PI * 2 - Math.PI, [x, z] = ringPoint(r, th, k(th)); pts.push([x + ox, z]); } };
  const tr = torsoRings(fr), pr = pelvisRings(fr), th = thighRings(fr);
  if (y >= tr[0].y && y <= tr[tr.length - 1].y) add(ringAt(tr, y), (a) => (1 + pecs(fr, a, y)) * (y > 0.31 && y < 0.53 ? 1.05 : 1));
  if (y >= pr[0].y && y <= pr[pr.length - 1].y) add(ringAt(pr, y), (a) => 1 + seatBump(fr, a, y));
  for (const sx of [-1, 1]) {
    const a = sx * 0.04, ly = y / Math.cos(a);
    if (ly >= th[0].y && ly <= th[th.length - 1].y) add(ringAt(th, ly), () => 1, sx * fr.hipX - ly * Math.sin(a));
    const kr = 0.17 * fr.leg, dk = (ly + THIGH) / 1.3; if (Math.abs(dk) < kr) { const r = Math.sqrt(kr * kr - dk * dk); add({ y, w: r, f: r, b: r, z: 0.01 }, () => 1, sx * fr.hipX + THIGH * Math.sin(a)); }
  }
  if (pts.length < 3) return [];
  const s = pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo: [number, number][] = [], hi: [number, number][] = [];
  for (const q of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = s.length - 1; i >= 0; i--) { const q = s[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
/** How far out from the middle a hull reaches at an angle (0 the front, round through +x). */
function reach(poly: [number, number][], th: number): number {
  const dx = Math.sin(th), dz = Math.cos(th); let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den; if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}
/** The hull's reach at a set of angles over a run of heights (top to bottom), and what cloth falling from the top of the
 *  run hangs at: at each height, the farthest the body reaches anywhere above it (cloth lies on the body down to its
 *  widest, then falls straight). `extra(y)` is added to the body first (a garment already worn under it). */
function hanging(fr: Frame, ths: number[], ys: number[], extra: (y: number) => number = () => 0): { body: number[][]; hang: number[][] } {
  const body = ys.map((y) => { const h = hullAt(fr, y); return ths.map((th) => (h.length ? reach(h, th) : 0) + extra(y)); });
  const hang = body.map((r) => r.slice());
  for (let j = 1; j < ys.length; j++) for (let i = 0; i < ths.length; i++) hang[j][i] = Math.max(hang[j][i], hang[j - 1][i]);
  return { body, hang };
}

// ---------------------------------------------------------------------------------------------------- following a pose
/** The bones cloth is carried by, as transforms in the hips' frame from where a point sits on the figure standing at
 *  rest to where the pose has put it: the chest, either thigh, and `back`, which keeps what hangs behind plumb while it
 *  swings back with a leg that steps back (and, in the saddle, lifts it out over the horse). */
interface Bones { chest: THREE.Matrix4; thighR: THREE.Matrix4; thighL: THREE.Matrix4; back: THREE.Matrix4; hips: THREE.Matrix4 }
type Weights = { chest?: number; thighR?: number; thighL?: number; back?: number; hips?: number };
function bonesOf(j: Joints): Bones | undefined {
  const up = j.chest, hR = j.hipR, hL = j.hipL; if (!up || !hR || !hL) return undefined;
  const rest = (o: THREE.Object3D, sx: number) => new THREE.Matrix4().compose(o.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sx * 0.04)), V(1, 1, 1)).invert();
  const swing = (o: THREE.Object3D) => { const d = V(0, -1, 0).applyQuaternion(o.quaternion); return Math.atan2(-d.z, -d.y); }; // + when the knee goes back
  const sR = swing(hR), sL = swing(hL), seated = sR < -1 && sL < -1;
  return { chest: up.matrix.clone(), thighR: hR.matrix.clone().multiply(rest(hR, SIDE_X.R)), thighL: hL.matrix.clone().multiply(rest(hL, SIDE_X.L)), back: new THREE.Matrix4().makeRotationX(seated ? 1.05 : Math.max(0, sR, sL) + 0.03), hips: new THREE.Matrix4() };
}
/** Where the pose puts a point given at rest (the hips' frame), carried by its bones in the given shares. */
function carry(b: Bones, p: V3, w: Weights, out = V()): V3 {
  out.set(0, 0, 0); const t = V();
  for (const k of ['chest', 'thighR', 'thighL', 'back', 'hips'] as const) { const s = w[k]; if (s) out.addScaledVector(t.copy(p).applyMatrix4(b[k]), s); }
  return out;
}
/** Carry every point of a geometry built at rest (unit-scaled by `s` already) by the bones, then shade it again. */
function carried(geo: THREE.BufferGeometry, b: Bones, weigh: (p: V3) => Weights, s: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute, p = V(), q = V();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); carry(b, p, weigh(p.clone().divideScalar(s)), q); pos.setXYZ(i, q.x, q.y, q.z); }
  pos.needsUpdate = true; geo.computeVertexNormals(); return geo;
}
/** Carry a rigid part (an ornament) whole, by the shares where it sits, so it moves with the cloth without shearing. */
function carriedWhole(geo: THREE.BufferGeometry, b: Bones, w: Weights): THREE.BufferGeometry {
  const M = new THREE.Matrix4(); M.elements.fill(0);
  for (const k of ['chest', 'thighR', 'thighL', 'back', 'hips'] as const) { const sh = w[k]; if (sh) for (let i = 0; i < 16; i++) M.elements[i] += sh * b[k].elements[i]; }
  return geo.applyMatrix4(M);
}
/** The skirts' shares: the waist goes with the chest; below it each half of the front and each side follows the thigh it
 *  lies over, and the back hangs (bone `back`). */
const skirtShares = (p: V3): Weights => {
  const wc = ramp(0.1, 0.32, p.y), wb = ramp(1.8, 2.5, Math.abs(Math.atan2(p.x, p.z))), wl = ramp(-0.16, 0.16, p.x), o = 1 - wc;
  return { chest: wc, back: o * wb, thighL: o * (1 - wb) * wl, thighR: o * (1 - wb) * (1 - wl) };
};
/** A cloak's shares: the shoulders carry it, the hips the middle, and below the seat it hangs from the legs' swing. */
/** Where a cloak's front edges stand, as an angle from the front, down its length (0 the top, 1 the hem): behind the
 *  shoulders at the top, behind the arms below. */
const cloakEdge = (v: number) => 2.2 - 0.48 * (1 - ramp(0.05, 0.3, v));
/** The height a cloak hangs from at an angle: the back of the neck behind, lower toward its edges. */
const cloakTop = (th: number) => 2.18 - 0.2 * Math.min(1, (Math.abs(wrapA(th - Math.PI)) / (Math.PI - 1.72)) ** 2);
const cloakShares = (p: V3): Weights => { const wc = ramp(-0.2, 0.9, p.y), wh = (1 - wc) * ramp(0, -0.7, p.y); return { chest: wc, back: wh, hips: 1 - wc - wh }; };

/** Solid parts cloth may not pass through, posed, in the hips' frame: the limbs as tapered capsules, and anything long
 *  hung at the belt (a scabbard). */
type Capsule = { a: V3; b: V3; ra: number; rb: number };
function solidsOf(j: Joints, fr: Frame, s: number, legsOnly = false): Capsule[] {
  const pel = j.hips, out: Capsule[] = [], P = (o: THREE.Object3D | undefined, at = V()) => o ? pel.worldToLocal(o.localToWorld(at.clone())) : undefined;
  pel.updateMatrixWorld(true);
  for (const sd of ['R', 'L']) {
    const sh = P(j['shoulder' + sd]), el = P(j['elbow' + sd]), wr = P(j['wrist' + sd]), tip = P(j['wrist' + sd], V(0, -0.32 * s, 0));
    if (sh && el && wr && tip && !legsOnly) { out.push({ a: sh, b: el, ra: 0.24 * fr.arm * s, rb: 0.17 * fr.arm * s }, { a: el, b: wr, ra: 0.17 * fr.arm * s, rb: 0.12 * fr.arm * s }, { a: wr, b: tip, ra: 0.13 * s, rb: 0.11 * s }); }
    const hip = P(j['hip' + sd]), kn = P(j['knee' + sd]), an = P(j['ankle' + sd]);
    if (hip && kn && an) out.push({ a: hip, b: kn, ra: 0.38 * fr.leg * s, rb: 0.24 * fr.leg * s }, { a: kn, b: an, ra: 0.24 * fr.leg * s, rb: 0.16 * fr.leg * s });
  }
  if (legsOnly) return out;
  for (const n of ['beltR', 'beltL']) for (const hang of j[n]?.children ?? []) {
    // the hang's long axis runs down its own -y: from the mouth to the farthest point of what hangs in it
    let lo = 0; hang.updateMatrixWorld(true); const inv = hang.matrixWorld.clone().invert(), box = new THREE.Box3();
    hang.traverse((m) => { const g = (m as THREE.Mesh).geometry; if (!g) return; g.computeBoundingBox(); box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld.clone().premultiply(inv)); lo = Math.min(lo, box.min.y); });
    const a = P(hang), b = P(hang, V(0, lo, 0)); if (a && b && lo < -0.3) out.push({ a, b, ra: 0.11 * s, rb: 0.11 * s });
  }
  return out;
}
/** Push the points of a surface (rows of points in the hips' frame) out of the solids, `gap` clear of them, then smooth
 *  the push across the cloth so it tents over what it rests on instead of denting round it point by point. */
function pushOut(P: V3[][], solids: Capsule[], gap: number): void {
  const nv = P.length, nu = P[0].length, push = P.map((r) => r.map(() => V())), ab = V(), c = V();
  const shove = () => { let any = false; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = P[j][i]; for (const k of solids) {
    ab.subVectors(k.b, k.a); const t = Math.max(0, Math.min(1, c.subVectors(p, k.a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); c.copy(k.a).addScaledVector(ab, t);
    const r = k.ra + (k.rb - k.ra) * t + gap, d = p.distanceTo(c); if (d >= r) continue;
    const dir = d > 1e-6 ? p.clone().sub(c).divideScalar(d) : V(p.x, 0, p.z).normalize(); const m = dir.multiplyScalar(r - d); p.add(m); push[j][i].add(m); any = true;
  } } return any; };
  if (!shove()) return;
  for (let it = 0; it < 6; it++) { // spread the push to its neighbours (never less than a point's own push)
    const next = push.map((r) => r.map((v) => v.clone()));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const n = [push[j][Math.max(0, i - 1)], push[j][Math.min(nu - 1, i + 1)], push[Math.max(0, j - 1)][i], push[Math.min(nv - 1, j + 1)][i]], avg = V(); for (const v of n) avg.add(v); avg.multiplyScalar(0.25); if (avg.lengthSq() > next[j][i].lengthSq()) { P[j][i].add(avg.clone().sub(next[j][i])); next[j][i].copy(avg); } }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) push[j][i].copy(next[j][i]);
  }
  shove();
}

// ---------------------------------------------------------------------------------------------------- the doublet
/** Dress a built, posed figure in a doublet and what goes with it. `recipe` is the one it was built from. */
export function doublet(g: THREE.Group, recipe: HeroFigure, o: Doublet): THREE.Group {
  const j = (g.userData.joints ?? {}) as Joints, up = j.chest, pel = j.hips, neck = j.neck; if (!up || !pel || !neck) return g;
  g.updateMatrixWorld(true);
  const s = neck.position.y / 2.24, fr = frameFor(recipe), tr = torsoRings(fr), b = bonesOf(j); if (!b) return g;
  const lying = Math.abs(V(0, 1, 0).transformDirection(up.matrixWorld).y) < 0.5;
  const placketC = o.placket, frogC = o.frogs ?? '#c8ccd4', front = o.skirts?.front ?? recipe.cloth ?? '#6a1a22';
  const S = (p: V3) => p.multiplyScalar(s);

  // the placket down the chest, edged, under the sash and into the collar
  if (placketC) {
    const hw = (y: number) => 0.09 + 0.012 * ramp(0.8, 1.6, y), rows: V3[][] = [];
    for (let k = 0; k <= 30; k++) { const y = 2.17 - (2.17 - 0.62) * k / 30, row: V3[] = []; for (let i = 0; i <= 4; i++) row.push(S(onChest(fr, tr, (i / 2 - 1) * hw(y), y, 0.012)[0])); rows.push(row); }
    up.add(new THREE.Mesh(grid(rows), soft(placketC)));
    const edge = tone(frogC, '#000000', 0.45);
    up.add(meshOf([-1, 1].map((sx) => cord(Array.from({ length: 16 }, (_, k) => { const y = 2.15 - (2.15 - 0.66) * k / 15; return S(onChest(fr, tr, sx * hw(y), y, 0.016)[0]); }), 0.011 * s)), soft(edge)));
  }
  // frogs: a button, a knotted loop each side and a small curl beyond it, with little ears above and below the loop
  const frog = (at: (x: number, y: number, out: number) => [V3, V3], y: number): THREE.BufferGeometry[] => {
    const parts: THREE.BufferGeometry[] = [], put = (geo: THREE.BufferGeometry, x: number, dy: number, out: number) => { const [p, n] = at(x, y + dy, out); parts.push(placed(geo, S(p), n, V(1, 0, 0))); };
    put(new THREE.SphereGeometry(0.045 * s, 10, 8).scale(1, 0.85, 0.6), 0, 0, 0.03);
    for (const sx of [-1, 1]) {
      put(new THREE.TorusGeometry(0.048 * s, 0.013 * s, 6, 16), sx * 0.11, 0, 0.025);
      put(new THREE.TorusGeometry(0.03 * s, 0.011 * s, 6, 12), sx * 0.19, 0, 0.025);
      for (const dy of [-1, 1]) put(new THREE.TorusGeometry(0.02 * s, 0.009 * s, 5, 10), sx * 0.1, dy * 0.068, 0.022);
      put(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.035 * s, 6).rotateZ(Math.PI / 2), sx * 0.052, 0, 0.026);
    }
    return parts;
  };
  if (o.frogs) up.add(meshOf([1.9, 1.56, 1.22].flatMap((y) => frog((x, yy, out) => onChest(fr, tr, x, yy, out), y)), soft(frogC)));

  // the collar: a tall band round the neck, open at the throat in a V that widens to the top, lower in front than behind,
  // flaring a little; outside in its colour, its lining and edge darker. On the neck, so it turns with the head.
  if (o.collar) {
    const nr = neckRings(fr), n0 = ringAt(nr, 0.08), t0 = ringAt(tr, 2.1), edgeC = o.collar.edge ?? tone(o.collar.color, '#000000', 0.5);
    const CR: Ring[] = [{ ...t0, y: -0.14, w: t0.w * 0.95, f: t0.f * 0.95, b: t0.b * 0.95, z: 0 }, { y: -0.03, w: n0.w * 1.85, f: n0.f * 1.3 + 0.02, b: n0.b * 1.32, z: -0.01 },
      { y: 0.1, w: n0.w * 1.5, f: n0.f * 1.35, b: n0.b * 1.34, z: -0.02 }, { y: 0.26, w: n0.w * 1.45, f: n0.f * 1.4, b: n0.b * 1.4, z: -0.025 }, { y: 0.42, w: n0.w * 1.5, f: n0.f * 1.45, b: n0.b * 1.46, z: -0.03 }];
    const top = (th: number) => 0.22 + 0.1 * (1 - Math.cos(th)) / 2, gap = (v: number) => 0.1 + 0.28 * v * v, NU = 64, NV = 12;
    const pt = (u: number, v: number, k: number) => { const th = gap(v) + u * (Math.PI * 2 - 2 * gap(v)), y = -0.14 + v * (top(th) + 0.14), [x, z] = ringPoint(ringAt(CR, y), th, k); return V(x * s, y * s, z * s); };
    const sheet = (k: number) => Array.from({ length: NV + 1 }, (_, jj) => Array.from({ length: NU + 1 }, (_, i) => pt(i / NU, 1 - jj / NV, k)));
    neck.add(new THREE.Mesh(grid(sheet(1)), soft(o.collar.color)), new THREE.Mesh(grid(sheet(0.93), true), soft(edgeC)));
    const rim = [...Array.from({ length: 7 }, (_, k) => pt(0, 0.3 + 0.7 * k / 6, 0.965)), ...Array.from({ length: NU + 1 }, (_, i) => pt(i / NU, 1, 0.965)), ...Array.from({ length: 7 }, (_, k) => pt(1, 1 - 0.7 * k / 6, 0.965))];
    neck.add(new THREE.Mesh(cord(rim, 0.02 * s), soft(edgeC)));
  }

  // the sash round the waist, with soft rolls along its edges and folds across it; knotted toward one side
  const sashK = 1.15;
  if (o.sash) {
    const fold = (th: number, y: number) => 0.012 * (1 + Math.sin(30 * y + 2 * th)) + 0.01 * (1 + Math.sin(47 * y - 3 * th + 1)) + 0.02 * Math.exp(-(((y - 0.28) / 0.025) ** 2)) + 0.02 * Math.exp(-(((y - 0.78) / 0.025) ** 2));
    const rings = clipRings(tr, 0.26, 0.8), radius = (th: number, y: number) => { const r = ringAt(rings, y), [px, pz] = ringPoint(r, th, 1); return Math.hypot(px - (r.x ?? 0), pz - (r.z ?? 0)); };
    up.add(new THREE.Mesh(loftGeometry(rings, s, { seg: 64, rows: 24, k: sashK, bump: (th, y) => fold(th, y) / radius(th, y) }), soft(o.sash.color)));
    // the knot: a tight middle with a loop of the sash pulled through either side of it
    const sx = SIDE_X[o.sash.side ?? 'L'], tk = sx * 0.62, [kx, kz] = ringPoint(ringAt(tr, 0.53), tk, sashK + 0.04), at = V(kx * s, 0.53 * s, kz * s), nk = V(Math.sin(tk), 0, Math.cos(tk)), ak = V(Math.cos(tk), 0, -Math.sin(tk));
    const knot = [new THREE.SphereGeometry(0.075 * s, 12, 8).scale(1, 1.1, 0.75)];
    for (const d of [-1, 1]) knot.push(new THREE.SphereGeometry(0.085 * s, 12, 8).scale(1.45, 0.7, 0.5).rotateZ(d * 0.45).translate(d * 0.1 * s, d * 0.02 * s, -0.01 * s));
    up.add(new THREE.Mesh(placed(merged(knot), at, nk, ak), soft(tone(o.sash.color, '#000000', 0.12))));
  }

  // the skirts, built round the body standing at rest and then carried by the pose: from under the sash they lie over the
  // hips to their widest, then fall straight to above the knee, the front panel over the sides and back
  const NU = 96, ys = Array.from({ length: 36 }, (_, k) => 0.46 - (0.46 + 1.12) * k / 35), cols = (a: number, z: number) => Array.from({ length: NU + 1 }, (_, i) => a + (z - a) * i / NU);
  const skirtGap = (y: number) => 0.035 + 0.06 * ramp(0, -1.12, y), skirtFold = (y: number) => 0.04 * ramp(-0.1, -1.12, y);
  if (o.skirts) {
    const fT = 0.62, sT = 0.56, side = cols(sT, Math.PI * 2 - sT), fore = cols(-fT, fT);
    const surface = (ths: number[], over: number, folds: number, n: number) => { const { hang } = hanging(fr, ths, ys); return ys.map((y, k) => ths.map((th, i) => { const r = hang[k][i] + skirtGap(y) + over + folds * skirtFold(y) * (0.5 + 0.5 * Math.sin(n * th + 0.6)); return V(Math.sin(th) * r * s, y * s, Math.cos(th) * r * s); })); };
    const sides = surface(side, 0, 1, 7), fronts = surface(fore, 0.014, 0.5, 5), edgeC = o.skirts.edge ?? tone(o.skirts.color, '#ffffff', 0.25);
    pel.add(new THREE.Mesh(carried(grid(sides), b, skirtShares, s), soft(o.skirts.color)), new THREE.Mesh(carried(grid(fronts), b, skirtShares, s), soft(front)));
    // edges: the front panel's sides and both hems
    const hemOf = (P: V3[][], lift: number) => P[P.length - 1].map((p) => p.clone().add(V(0, lift * s, 0)).multiplyScalar(1.008));
    const edges = [cord(hemOf(sides, 0.01), 0.016 * s), cord(hemOf(fronts, 0.01), 0.018 * s), ...[0, NU].map((i) => cord(fronts.slice(4).map((r) => r[i].clone().multiplyScalar(1.01)), 0.016 * s))];
    pel.add(new THREE.Mesh(carried(merged(edges), b, skirtShares, s), soft(edgeC)));
    // the placket and frogs run on down the front panel
    const { hang } = hanging(fr, [0], ys), r0 = (y: number) => { const k = Math.max(0, Math.min(ys.length - 1, Math.round((0.46 - y) / (1.58 / 35)))); return hang[k][0] + skirtGap(y) + 0.014; };
    if (placketC) {
      const rows = ys.slice(3).map((y) => [-1, -0.5, 0, 0.5, 1].map((u) => { const r = r0(y) + 0.01, th = u * 0.1 / r; return V(Math.sin(th) * r * s, y * s, Math.cos(th) * r * s); }));
      pel.add(new THREE.Mesh(carried(grid(rows), b, skirtShares, s), soft(placketC)));
    }
    if (o.frogs) {
      const onSkirt = (x: number, y: number, out: number): [V3, V3] => { const r = r0(y) + 0.01, th = x / r; return [V(Math.sin(th) * (r + out), y, Math.cos(th) * (r + out)), V(Math.sin(th), 0, Math.cos(th))]; };
      pel.add(new THREE.Mesh(merged([-0.22, -0.66].map((y) => carriedWhole(merged(frog(onSkirt, y)), b, skirtShares(V(0, y, r0(y)))))), soft(frogC)));
    }
  }
  // the sash's ends hanging from the knot over the skirts, and cords with metal tips beside them (carried as the skirts are)
  if (o.sash) {
    const sx = SIDE_X[o.sash.side ?? 'L'], { hang } = hanging(fr, [sx * 0.55, sx * 0.62, sx * 0.7], ys);
    const onFront = (th: number, y: number, out: number) => { const k = Math.max(0, Math.min(ys.length - 1, Math.round((0.46 - y) / (1.58 / 35)))), i = th * sx < 0.585 ? 0 : th * sx < 0.66 ? 1 : 2, r = (y > 0.3 ? ringPoint(ringAt(tr, y), th, sashK)[1] / Math.cos(th) : hang[k][i] + skirtGap(y) + 0.03) + out; return V(Math.sin(th) * r, y, Math.cos(th) * r); };
    const tails: THREE.BufferGeometry[] = [];
    for (const [t0, t1, len, wd] of [[0.58, 0.52, 0.95, 0.12], [0.66, 0.74, 0.8, 0.11]] as const) {
      const rows: V3[][] = [];
      for (let k = 0; k <= 10; k++) { const v = k / 10, y = 0.48 - len * v, th = sx * (t0 + (t1 - t0) * v), cut = k === 10 ? 0.05 : 0; rows.push([-1, 0, 1].map((u) => S(onFront(th + sx * u * wd / 2 / 0.6, y + cut * u * sx, 0.02 + 0.005 * Math.sin(Math.PI * v))))); }
      tails.push(grid(rows));
    }
    pel.add(new THREE.Mesh(carried(merged(tails), b, skirtShares, s), soft(o.sash.color, true)));
    if (o.sash.cords) {
      const cords: THREE.BufferGeometry[] = [], tips: THREE.BufferGeometry[] = [];
      for (const [th, len] of [[0.5, 0.62], [0.76, 0.5]] as const) {
        const pts = Array.from({ length: 8 }, (_, k) => S(onFront(sx * th, 0.5 - len * k / 7, 0.045))); cords.push(cord(pts, 0.013 * s));
        const e = pts[pts.length - 1], tip = new THREE.ConeGeometry(0.03 * s, 0.11 * s, 6).rotateX(Math.PI); tip.translate(e.x, e.y - 0.05 * s, e.z); tips.push(tip);
      }
      pel.add(new THREE.Mesh(carried(merged(cords), b, skirtShares, s), soft(tone(o.sash.color, '#000000', 0.25))));
      pel.add(new THREE.Mesh(carried(merged(tips), b, skirtShares, s), soft(o.sash.cords)));
    }
  }

  // the pauldron, on its shoulder joint so it rides the arm: a domed cap shaped over the ball of the shoulder and down round
  // it, a raised boss on its outer face and a rolled rim, then three lames down the arm, each tucked under the one above
  // and tipped out at its lower edge
  if (o.pauldron) {
    const sd = o.pauldron.side, sh = j['shoulder' + sd];
    if (sh) {
      const sx = SIDE_X[sd], t = o.pauldron.trim ?? tone(o.pauldron.color, '#000000', 0.4), steel = soft(o.pauldron.color, true), trim = soft(t), hi = soft(tone(o.pauldron.color, '#ffffff', 0.25));
      const grp = new THREE.Group(); grp.name = 'pauldron' + sd; sh.add(grp);
      // the cap sits on the shoulder more than on the arm: it hangs where the arm hangs from but turns only part of the
      // way the arm turns, so an arm swung out lifts its rim instead of carrying it off the shoulder; its crown is tipped
      // out over the arm, so the rim rides up over the top of the shoulder inside and comes down over the arm outside
      const seat = new THREE.Group(); seat.name = 'pauldronCap' + sd; seat.position.copy(sh.position);
      seat.quaternion.setFromEuler(new THREE.Euler(-0.08, 0, sx * 0.1)).slerp(sh.quaternion, 0.75); (sh.parent ?? sh).add(seat);
      const a = fr.arm / 1.2, cr = 0.4 * a * s, sy = 0.62, ph = 1.45, cap = new THREE.Group(); cap.position.set(-sx * 0.07 * a * s, -0.11 * a * s, 0); cap.rotation.z = -sx * 0.35; seat.add(cap);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(cr, 36, 18, 0, Math.PI * 2, 0, ph), steel); dome.scale.set(1, sy, 0.95); cap.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(cr * Math.sin(ph), 0.022 * s, 6, 40), trim); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 0.95, 1); rim.position.y = cr * sy * Math.cos(ph); cap.add(rim);
      // the boss: a disc on the dome's outer face with a dome of its own and a ring round it
      const dir = V(sx * 0.72, 0.38, 0.58).normalize(), bp = V(dir.x * cr, dir.y * cr * sy, dir.z * cr * 0.95), bn = V(dir.x, dir.y / sy, dir.z / 0.95).normalize();
      const boss = new THREE.Group(); boss.position.copy(bp); boss.quaternion.setFromUnitVectors(V(0, 0, 1), bn); cap.add(boss);
      boss.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.14 * s, 0.035 * s, 24).rotateX(Math.PI / 2), steel));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 16, 10), hi); knob.scale.set(1, 1, 0.5); knob.position.z = 0.02 * s; boss.add(knob);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135 * s, 0.015 * s, 6, 24), trim); ring.position.z = 0.02 * s; boss.add(ring);
      // the lames, shaped to the arm round its outer half
      const rings = upperArmRings(fr, sx), wrap = 3.2, th0 = sx * Math.PI / 2 - wrap / 2, rows = 6, seg = 24;
      for (let i = 0; i < 3; i++) {
        const y0 = -0.2 - i * 0.15, y1 = y0 - 0.2, k0 = 1.08 + 0.03 * i, k1 = k0 + 0.1, pts: V3[][] = [];
        for (let r = 0; r <= rows; r++) { const tt = r / rows, y = y0 + (y1 - y0) * tt, rr = ringAt(rings, y), row: V3[] = []; for (let q = 0; q <= seg; q++) { const [x, z] = ringPoint(rr, th0 + wrap * q / seg, k0 + (k1 - k0) * tt); row.push(V(x * s, y * s, z * s)); } pts.push(row); }
        grp.add(new THREE.Mesh(grid(pts), i % 2 ? steel : soft(tone(o.pauldron.color, '#ffffff', 0.08), true)));
        const edge: V3[] = []; for (let q = 0; q <= seg; q++) { const [x, z] = ringPoint(ringAt(rings, y1), th0 + wrap * q / seg, k1 + 0.012); edge.push(V(x * s, y1 * s, z * s)); }
        grp.add(new THREE.Mesh(cord(edge, 0.015 * s), trim));
        for (const qq of [-0.7, 0, 0.7]) { const [x, z] = ringPoint(ringAt(rings, y0 - 0.06), sx * Math.PI / 2 + qq, k0 + 0.035); grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.018 * s, 6, 4).translate(x * s, (y0 - 0.06) * s, z * s), trim)); }
      }
    }
  }

  // chains looped down the chest from under the pauldron's shoulder to the sash: oval links, every other one turned
  if (o.chains) {
    const sx = SIDE_X[o.pauldron?.side ?? 'L'], links: THREE.BufferGeometry[] = [];
    for (const [ax, ay, bx, by, sag] of [[0.66, 1.92, 0.14, 0.8, 0.26], [0.8, 1.84, 0.3, 0.79, 0.2]] as const) {
      const A = new THREE.Vector2(sx * ax, ay), B = new THREE.Vector2(sx * bx, by), C = A.clone().add(B).multiplyScalar(0.5).add(new THREE.Vector2(-sx * sag, -0.2));
      const at = (t: number) => { const q = A.clone().multiplyScalar((1 - t) ** 2).add(C.clone().multiplyScalar(2 * t * (1 - t))).add(B.clone().multiplyScalar(t * t)); return onChest(fr, tr, q.x, q.y, 0.03); };
      let len = 0, prev = at(0)[0]; const steps = 80, arc: [number, V3, V3][] = [[0, prev, at(0)[1]]];
      for (let k = 1; k <= steps; k++) { const [p, n] = at(k / steps); len += p.distanceTo(prev); arc.push([len, p, n]); prev = p; }
      const n = Math.floor(len / 0.048);
      for (let i = 0; i < n; i++) {
        const d = (i + 0.5) * len / n, k = arc.findIndex((x) => x[0] >= d), [, p, nn] = arc[Math.max(1, k)], tang = arc[Math.max(1, k)][1].clone().sub(arc[Math.max(0, k - 1)][1]).normalize();
        const link = new THREE.TorusGeometry(0.02 * s, 0.0075 * s, 4, 10).scale(1.5, 1, 1), face = i % 2 ? nn.clone().cross(tang).normalize() : nn;
        links.push(placed(link, S(p.clone()), face, tang));
      }
    }
    up.add(meshOf(links, soft(o.chains)));
  }

  // the cloak: hung from the back of the shoulders (over them at the top, under the pauldron and the fur), falling plumb
  // from the widest of the back and flaring to the calf in folds, its edges behind the arms; lined, the lining showing at
  // the turned edges. Laid on the ground, it lies close under the body instead.
  if (o.cloak) {
    const NUc = 72, NVc = 46, yHem = lying ? -0.6 : -2.15, lin = o.cloak.lining ?? tone(o.cloak.color, '#000000', 0.3);
    const vs = Array.from({ length: NVc + 1 }, (_, k) => k / NVc), grid0 = vs.map((v) => Array.from({ length: NUc + 1 }, (_, i) => { const e = cloakEdge(v), th = e + (i / NUc) * (Math.PI * 2 - 2 * e), y0 = cloakTop(th); return { th, y: y0 - (y0 - yHem) * v ** 1.5 }; }));
    // the body (and the skirts on it) at fine heights from the shoulders down, at every column's angle (the angles shift a
    // little from row to row, so each row reads the nearest column of a fine table)
    const TH = Array.from({ length: 145 }, (_, i) => Math.PI / 2 + Math.PI * i / 144), YS = Array.from({ length: 120 }, (_, k) => 2.3 - (2.3 - yHem - 0.05) * k / 119);
    const under = (y: number) => (o.skirts && y < 0.46 && y > -1.15 ? skirtGap(y) + 0.02 + skirtFold(y) : 0) + (o.sash && y > 0.22 && y < 0.84 ? 0.13 : 0), { body, hang } = hanging(fr, TH, YS, under);
    const look = (tab: number[][], th: number, y: number) => { const t = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), i = Math.max(0, Math.min(144, Math.round((Math.min(Math.max(t, Math.PI / 2), Math.PI * 1.5) - Math.PI / 2) / Math.PI * 144))), k = Math.max(0, Math.min(119, Math.round((2.3 - y) / ((2.3 - yHem - 0.05) / 119)))); return tab[k][i]; };
    const P = grid0.map((row) => row.map(({ th, y }) => {
      const sd = (lying ? look(body, th, y) + 0.045 : look(hang, th, y) + 0.05 + 0.2 * ramp(1.2, -2.2, y)) + (lying ? 0 : 0.17 * ramp(1.3, -2.2, y) * (0.5 + 0.5 * Math.sin(7 * th + 0.7 + 0.5 * Math.sin(3 * th))) ** 1.5);
      const yy = y - (lying ? 0 : 0.04 * ramp(-1.6, -2.15, y) * Math.abs(Math.sin(4.5 * th)));
      return V(Math.sin(th) * sd * s, yy * s, Math.cos(th) * sd * s);
    }));
    const weigh = lying ? skirtShares : cloakShares, q = V();
    for (const row of P) for (const p of row) { carry(b, p, weigh(p.clone().divideScalar(s)), q); p.copy(q); }
    if (!lying) pushOut(P, solidsOf(j, fr, s), 0.035 * s);
    pel.add(new THREE.Mesh(grid(P), soft(o.cloak.color)));
    // the lining: the same cloth a little inside, facing in
    const inner = P.map((row, k) => row.map((p, i) => { const nb = P[Math.min(P.length - 1, k + 1)][i].clone().sub(P[Math.max(0, k - 1)][i]), ac = row[Math.min(row.length - 1, i + 1)].clone().sub(row[Math.max(0, i - 1)]), n = nb.cross(ac).normalize(); return p.clone().addScaledVector(n, -0.018 * s); }));
    pel.add(new THREE.Mesh(grid(inner, true), soft(lin)));
    const rimPath = [...P.map((r) => r[0]).slice(2), ...P[P.length - 1].slice(1), ...P.map((r) => r[r.length - 1]).reverse().slice(1, -2)];
    pel.add(new THREE.Mesh(cord(rimPath, 0.022 * s), soft(lin)));
  }

  // the fur slung over one shoulder: a pelt heaped on it and up against the collar, over the top of the arm, a little way
  // down the chest and further down the back, over the cloak. A dark hide gives it its mass; on it lie shaggy locks in
  // rows, each row over the one below like shingles, falling as the pose leaves them, in three tones, the hem ragged;
  // a crest of locks stands up beside the collar. What lies on the arm rides the arm.
  if (o.fur) {
    const sx = SIDE_X[o.fur.side], zf = o.fur.size ?? 1, C = o.fur.color, sh = j['shoulder' + o.fur.side];
    const tones = [C, tone(C, '#d8d0c4', 0.2), tone(C, '#000000', 0.3)], hide = tone(C, '#000000', 0.55);
    const gq = g.getWorldQuaternion(new THREE.Quaternion()).invert();
    const downIn = (part: THREE.Object3D) => V(0, -1, 0).applyQuaternion(gq.clone().multiply(part.getWorldQuaternion(new THREE.Quaternion())).invert());
    const toneOf = (id: number) => { const h = hash(id * 3.7 + 1); return h < 0.5 ? 0 : h < 0.75 ? 1 : 2; };
    /** Locks lying on a hide given as a surface over (u, w) (a point on what it lies on, the outward normal there, and
     *  the hide's height above it): each from a root down the surface toward higher w, raised along its middle, its point
     *  lying on what is below it (the next row, or the cloth past the hide's edge) or lifting a little off it. */
    const lay = (into: THREE.BufferGeometry[][], at: (u: number, w: number) => [V3, V3, number], u0: number, w0: number, dw: number, du: number, lift: number, out: number, wd: number, t: number, id: number) => {
      const pts: V3[] = []; let n0 = V();
      for (let k = 0; k <= 5; k++) { const tt = k / 5, [p, n, h] = at(u0 + du * tt, w0 + dw * tt); if (k === 0) n0 = n.clone(); pts.push(p.addScaledVector(n, Math.max(0, h) + 0.012 + lift * Math.sin(Math.PI * Math.min(1, tt * 1.15)) + out * tt ** 3 - (k === 0 ? 0.02 : 0)).multiplyScalar(s)); }
      into[toneOf(id)].push(flatLock(pts, n0, wd * s, t * s));
    };
    const locks: THREE.BufferGeometry[][] = [[], [], []], armLocks: THREE.BufferGeometry[][] = [[], [], []];

    // on the torso, in the chest's frame: the skin, or behind, the cloak where it hangs over the back of the shoulders
    const skin = (th: number, y: number) => { const [x, zz] = torsoAt(fr, tr, th, y); return V(x, y, zz); };
    let overCloak: ((a: number, y: number) => number) | undefined;
    if (o.cloak) {
      const TA = Array.from({ length: 73 }, (_, i) => Math.PI / 2 + Math.PI * i / 72), YA = Array.from({ length: 56 }, (_, k) => 2.3 - 1.1 * k / 55), { body, hang } = hanging(fr, TA, YA);
      overCloak = (a, y) => {
        const t = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (t < Math.PI / 2 || t > 1.5 * Math.PI || y > cloakTop(a) + 0.02) return 0;
        const i = Math.round((t - Math.PI / 2) / Math.PI * 72), k = Math.max(0, Math.min(55, Math.round((2.3 - y) / 1.1 * 55))), edge = 1.72 + 0.45 * ramp(2.0, 1.4, y);
        return ramp(edge - 0.12, edge + 0.06, Math.abs(wrapA(a))) * ((lying ? body[k][i] + 0.045 : hang[k][i] + 0.05) + 0.03);
      };
    }
    const base = (th: number, y: number) => { const p = skin(th, y); if (overCloak) { const r = Math.hypot(p.x, p.z), rc = overCloak(Math.atan2(p.x, p.z), y); if (rc > r) { p.x *= rc / r; p.z *= rc / r; } } return p; };
    const normalOf = (f: (th: number, y: number) => V3, th: number, y: number) => f(th + 0.01, y).sub(f(th - 0.01, y)).cross(f(th, y + 0.01).sub(f(th, y - 0.01))).normalize();
    // its extent: round from beside the collar in front to near the spine behind (u), from the root of the neck down (w)
    // to above the arm at the side, lower in front and lowest behind; heaped deepest on the top of the shoulder
    const phiOf = (u: number) => 0.4 + u * (Math.PI - 0.82), yHi = 2.15;
    const yLo = (phi: number) => 2.0 - 0.28 * ramp(1.25, 0.6, phi) - 0.55 * ramp(1.85, 2.55, phi);
    const heap = (phi: number, v: number) => zf * (0.05 + 0.12 * (1 - v) * (0.55 + 0.45 * Math.max(0, Math.cos(phi - Math.PI / 2))));
    const side = (phi: number) => ramp(0.55, 0.15, Math.abs(phi - Math.PI / 2));
    /** The hide at (u, w): w from 0 at the root of the neck, where it tucks under the collar, to 1 at its lower edge (on
     *  past it, the cloth it lies on). */
    const hideAt = (u: number, w: number): [V3, V3, number] => {
      const phi = phiOf(Math.max(0, Math.min(1, u))), th = sx * phi, v = Math.max(0, (w - 0.15) / 0.85), y = w < 0.15 ? 2.24 - (2.24 - yHi) * w / 0.15 : yHi - v * (yHi - yLo(phi));
      const lump = 1 + 0.12 * Math.sin(11 * u + 3 * w) * Math.sin(7 * w + 2 * u), fade = ramp(0, 0.15, w) * ramp(0, 0.08, u) * ramp(1, 0.92, u) * Math.max(side(phi), ramp(1, 0.82, v));
      return [base(th, y), normalOf(base, th, y), -0.012 + (heap(phi, Math.min(1, v)) * lump + 0.012) * fade];
    };
    const HU = 26, HW = 20, hideP = Array.from({ length: HW + 1 }, (_, k) => Array.from({ length: HU + 1 }, (_, i) => { const [p, n, h] = hideAt(i / HU, k / HW); return p.addScaledVector(n, h).multiplyScalar(s); }));
    const furC = new THREE.Group(); furC.name = 'fur'; up.add(furC);
    furC.add(new THREE.Mesh(grid(hideP, sx < 0), soft(hide, true)));
    // the locks, row by row from the top (each row's roots staggered from the last), longest at the hem, which they
    // overhang; then the crest standing up beside the collar
    for (let r = 0; r < 9; r++) for (let i = 0; i < 26; i++) {
      const id = r * 41 + i, u = Math.min(0.985, Math.max(0.015, (i + 0.5 * (r % 2) + 0.5 * (hash(id) - 0.5)) / 25.5)), w = 0.15 + 0.85 * r / 8.5, phi = phiOf(u);
      const span = Math.max(0.1, yHi - yLo(phi)) / 0.85, L = zf * (0.18 + 0.1 * r / 8) * (0.8 + 0.45 * hash(id + 7));
      lay(locks, hideAt, u, w, Math.min(L / span, 1.32 - w), 0.07 * (hash(id + 11) - 0.5), zf * (0.012 + 0.035 * hash(id + 3)), zf * (r > 6 ? 0.03 : 0.015) * hash(id + 13), zf * 0.042 * (0.8 + 0.4 * hash(id + 5)), zf * 0.03, id);
    }
    const dC = downIn(up);
    for (let i = 0; i < 14; i++) {
      const id = 500 + i, u = 0.05 + 0.9 * (i + 0.5 * hash(id)) / 14, phi = phiOf(u), [p, n, h] = hideAt(u, 0.13), out = V(p.x, 0, p.z).normalize(), root = p.clone().addScaledVector(n, h - 0.01);
      const up1 = n.clone().add(V(0, 0.6, 0)).normalize(), L = zf * (0.12 + 0.1 * Math.max(0, Math.cos(phi - Math.PI / 2))) * (0.8 + 0.4 * hash(id + 2));
      const pts = [root, root.clone().addScaledVector(up1, 0.7 * L).addScaledVector(out, 0.2 * L), root.clone().addScaledVector(up1, L).addScaledVector(out, 0.7 * L), root.clone().addScaledVector(up1, 0.7 * L).addScaledVector(out, 1.3 * L).addScaledVector(dC, 0.25 * L)];
      locks[hash(id + 9) < 0.3 ? 1 : hash(id + 9) < 0.75 ? 0 : 2].push(flatLock(pts.map((q) => q.multiplyScalar(s)), out.clone().multiplyScalar(-1).add(V(0, 1, 0)).normalize(), zf * 0.07 * s, zf * 0.04 * s));
    }
    locks.forEach((geos, k) => { if (geos.length) furC.add(meshOf(geos, soft(tones[k], true))); });

    // over the top of the arm, on its shoulder joint: a hide over the deltoid and locks falling down the arm
    if (sh) {
      const ar = upperArmRings(fr, sx), askin = (th: number, y: number) => { const [x, zz] = ringPoint(ringAt(ar, y), th, 1); return V(x, y, zz); };
      const armAt = (u: number, w: number): [V3, V3, number] => {
        const phi = Math.PI / 2 - 1.2 + 2.55 * Math.max(0, Math.min(1, u)), th = sx * phi, y = -0.02 - 0.34 * w;
        const fade = ramp(0, 0.12, u) * ramp(1, 0.88, u) * ramp(1, 0.75, w);
        return [askin(th, y), normalOf(askin, th, y), -0.012 + (zf * 0.085 * (1 - 0.45 * Math.min(1, w)) + 0.012) * fade];
      };
      const furA = new THREE.Group(); furA.name = 'fur' + o.fur.side; sh.add(furA);
      const AU = 16, AW = 10, armP = Array.from({ length: AW + 1 }, (_, k) => Array.from({ length: AU + 1 }, (_, i) => { const [p, n, h] = armAt(i / AU, k / AW); return p.addScaledVector(n, h).multiplyScalar(s); }));
      furA.add(new THREE.Mesh(grid(armP, sx < 0), soft(hide, true)));
      for (let r = 0; r < 5; r++) for (let i = 0; i < 14; i++) {
        const id = 900 + r * 23 + i, u = Math.min(0.97, Math.max(0.03, (i + 0.5 * (r % 2) + 0.5 * (hash(id) - 0.5)) / 13.5)), w = 0.02 + 0.17 * r;
        lay(armLocks, armAt, u, w, zf * (0.22 + 0.05 * r) * (0.85 + 0.35 * hash(id + 7)) / 0.34, 0.07 * (hash(id + 11) - 0.5), zf * (0.012 + 0.03 * hash(id + 3)), zf * 0.02 * hash(id + 13), zf * 0.042 * (0.8 + 0.4 * hash(id + 5)), zf * 0.028, id);
      }
      armLocks.forEach((geos, k) => { if (geos.length) furA.add(meshOf(geos, soft(tones[k], true))); });
    }
  }
  return g;
}

/** Set upright whatever a hand holds that should be carried plumb (a glass of wine): the rig aims a held thing by the
 *  forearm, which a turned shoulder tips a little off true. */
export function plumbHeld(g: THREE.Group, kinds: string[] = ['wineglass']): THREE.Group {
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!kinds.includes(o.userData.kind as string) || !o.parent) return;
    const qw = o.getWorldQuaternion(new THREE.Quaternion()), axis = V(0, 1, 0).applyQuaternion(qw), fix = new THREE.Quaternion().setFromUnitVectors(axis, V(0, 1, 0));
    o.quaternion.copy(o.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(fix.multiply(qw)));
  });
  return g;
}

/** Set a figure laid on the floor back down on what it now wears under it (a cloak or skirts made after the rig laid it
 *  out): the part holding the body is lifted until nothing solid lies below the floor. */
export function restOnFloor(g: THREE.Group): THREE.Group {
  const chest = (g.userData.joints as Joints | undefined)?.chest; if (!chest) return g;
  let part: THREE.Object3D = chest; while (part.parent && part.parent !== g) part = part.parent;
  if (part.parent !== g) return g;
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3();
  part.traverse((m) => { const mm = m as THREE.Mesh; if (!mm.isMesh || (mm.material as THREE.Material).transparent) return; mm.geometry.computeBoundingBox(); box.union(b.copy(mm.geometry.boundingBox!).applyMatrix4(mm.matrixWorld.clone().premultiply(inv))); });
  if (box.min.y < 0) part.position.y -= box.min.y;
  return g;
}

// ---------------------------------------------------------------------------------------------------- hanging cloth
/** What cloth hangs over on a built, posed figure (kit/cloth.ts), read from its joints as the rig reads the body it
 *  builds when it hangs its own garments (kit/heroes.ts drapeWorld) and as the cloth check reads it (kit/clothcheck.ts):
 *  each part's points (a sample to hang over, and all of them to be lifted out of), the volume of its ring stack, the
 *  line of its bones; garments it already wears, as trunk; the figure's own way down and its floor. (Gear put away at
 *  the belt is not read: nothing that wears cloth from here carries any.) */
function drapeOf(g: THREE.Group, j: Joints, fr: Frame, s: number, lying: boolean): DrapeWorld | undefined {
  const pel = j.hips, up = j.chest, neck = j.neck; if (!pel || !up || !neck) return undefined;
  g.updateMatrixWorld(true);
  type M = THREE.Mesh;
  const solid = (o: THREE.Object3D): o is M => (o as M).isMesh && !((o as M).material as THREE.Material).transparent && !o.userData.garment && !o.userData.veil;
  const meshes = (o: THREE.Object3D | undefined, stop: (THREE.Object3D | undefined)[] = []) => { const out: M[] = []; const walk = (n: THREE.Object3D) => { for (const c of n.children) { if (stop.includes(c)) continue; if (solid(c)) out.push(c); walk(c); } }; if (o) walk(o); return out; };
  const sample = (ms: M[], cap: number) => { const n = ms.reduce((a, m) => a + m.geometry.getAttribute('position').count, 0); return ms.flatMap((m) => pointsOf(m, Math.max(6, Math.round((cap * m.geometry.getAttribute('position').count) / Math.max(1, n))))); };
  const every = (ms: M[]) => ms.flatMap((m) => pointsOf(m, m.geometry.getAttribute('position').count));
  const parts = new Map<string, V3[]>(), surface = new Map<string, V3[]>(), volumes = new Map<string, (p: V3, out: V3) => number>();
  const part = (n: string, ms: M[], cap: number) => { const p = sample(ms, cap); parts.set(n, p); surface.set(n, every(ms)); return p; };
  // how deep a point lies in a ring stack lofted in a joint's frame, and the way out of it (radially, in the world)
  const vol = (o: THREE.Object3D, rings: Ring[]) => {
    const inv = o.matrixWorld.clone().invert(), q = V(), lo = rings[0].y, hi = rings[rings.length - 1].y;
    return (p: V3, out: V3) => {
      q.copy(p).applyMatrix4(inv).divideScalar(s); if (q.y < lo + 0.05 || q.y > hi - 0.05) return -1;
      const r = ringAt(rings, q.y), n = r.n ?? 2, dx = q.x - (r.x ?? 0), dz = q.z - (r.z ?? 0), dd = dz >= 0 ? r.f : r.b, v = (Math.abs(dx) / r.w) ** n + (Math.abs(dz) / dd) ** n;
      if (v >= 1) return -1;
      out.set(dx, 0, dz); if (out.lengthSq() < 1e-12) out.set(0, 0, 1);
      out.normalize().transformDirection(o.matrixWorld);
      return (1 - v ** (1 / n)) * Math.min(r.w, dd) * s;
    };
  };
  part('torso', meshes(up, [neck, j.collarR, j.collarL, j.beltR, j.beltL, j.back]), 2400); volumes.set('torso', vol(up, torsoRings(fr)));
  part('pelvis', meshes(pel, [up, j.hipR, j.hipL]), 1400); volumes.set('pelvis', vol(pel, pelvisRings(fr)));
  { const nr = neckRings(fr); part('neck', neck.children.filter(solid), 300); volumes.set('neck', vol(neck, [{ ...nr[0], y: nr[0].y - 0.08 }, ...nr])); }
  const wp = (o: THREE.Object3D) => o.getWorldPosition(V()), bones = new Map<string, V3[]>(), spine = [wp(pel), wp(up), wp(neck)];
  bones.set('torso', spine); bones.set('pelvis', spine);
  for (const sd of ['R', 'L'] as const) {
    const hip = j['hip' + sd], knee = j['knee' + sd], ankle = j['ankle' + sd];
    if (hip && knee && ankle) {
      part('thigh' + sd, hip.children.filter(solid), 500); volumes.set('thigh' + sd, vol(hip, thighRings(fr)));
      part('shin' + sd, meshes(knee, [ankle]), 450); volumes.set('shin' + sd, vol(knee, shinRings(fr)));
      const feet = part('foot' + sd, meshes(ankle), 600), line = [wp(hip), wp(knee), wp(ankle)], mid = V();
      bones.set('thigh' + sd, line); bones.set('shin' + sd, line); if (feet.length) { for (const p of feet) mid.add(p); bones.set('foot' + sd, [line[1], line[2], mid.divideScalar(feet.length)]); }
    }
    const sh = j['shoulder' + sd], el = j['elbow' + sd], wr = j['wrist' + sd], held = j['hand' + sd];
    if (sh && el && wr) {
      // (the point of the elbow is the upper arm's: cloth lying on the arm runs on over it)
      const fore = part('forearm' + sd, meshes(el, [wr]), 300), e = wp(el);
      part('upperArm' + sd, meshes(sh, [el]), 400); parts.get('upperArm' + sd)!.push(...fore.filter((p) => p.distanceTo(e) < 0.35 * s));
      volumes.set('upperArm' + sd, vol(sh, upperArmRings(fr, SIDE_X[sd]))); volumes.set('forearm' + sd, vol(el, forearmRings(fr)));
      part('hand' + sd, meshes(wr, [held]), 120);
      const line = [wp(sh), e, wp(wr)]; bones.set('upperArm' + sd, line); bones.set('forearm' + sd, line); bones.set('hand' + sd, [e, line[2], held ? wp(held) : line[2]]);
    }
  }
  // garments it already wears (its own skirts, a cloak): what is hung over them lies outside them
  const worn: string[] = []; g.traverse((o) => { const m = o as M; if (!m.isMesh || !m.userData.garment || (m.material as THREE.Material).transparent) return; const n = String(m.userData.garment); parts.set(n, [...(parts.get(n) ?? []), ...pointsOf(m, 900)]); if (!worn.includes(n)) worn.push(n); });
  const skinOf = (o: THREE.Object3D) => every(o.children.filter((c): c is M => solid(c) && !!c.userData.skin));
  // the way down is the figure's own, its floor the ground it stands or lies on
  const down = V(0, -1, 0).transformDirection(g.matrixWorld), floor = g.localToWorld(V()).dot(down);
  return { parts, down, floor, volumes, bones, surface, size: s, skin: lying ? new Map([['torso', skinOf(up)], ['pelvis', skinOf(pel)]]) : undefined, trunk: ['torso', 'pelvis', 'stowed', ...worn], lying };
}

// ---------------------------------------------------------------------------------------------------- a robe in tatters
/** A robe worn to rags, over the figure's own clothes: its skirt from the waist all the way round, torn up into strips of
 *  uneven length (longest behind), each torn up its sides and ragged at its end; wide sleeves, opening to a bell over
 *  each hand; a rope belt knotted at the front with its ends hanging; and a cowl round the neck with the hood fallen on
 *  the back. */
export interface Tatters {
  color: string;
  /** The rope belt's colour (none when left out). */
  belt?: string;
  /** A cowl round the neck and the hood fallen down the back. */
  cowl?: boolean;
  /** The hood drawn up over the head instead (the cowl's roll round the neck below it): see `hoodUp`. */
  hood?: boolean;
  /** How far the strips hang (1 the standard, to the shin; longer reaches the ankles). */
  length?: number;
  /** Varies the strips (a token's own seed). */
  seed?: number;
}
const TAT_TOP = 0.56, TAT_LOW = -2.05, TAT_ROWS = 110;
/** The robe's hem round the body (0 the front), as a height in the hips' frame: strips of uneven width and length, the
 *  longest behind, the shortest in front where the knees wear them away; between two strips a tear runs up to its top. */
function tatterHem(seed: number, long = 1): (th: number) => number {
  const cuts: number[] = []; for (let a = -Math.PI + 0.3 * hash(seed + 1), i = 0; a < Math.PI; i++) { cuts.push(a); a += 0.34 + 0.32 * hash(seed * 7 + i * 3 + 2); }
  const n = cuts.length, len = cuts.map((a, i) => { const back = ramp(0.6, 2.6, Math.abs(wrapA(a + 0.2))); return (-1.12 - 0.42 * back - 0.32 * hash(seed * 13 + i * 5 + 3)) * long; });
  const tear = cuts.map((_, i) => -0.5 - 0.42 * hash(seed * 17 + i * 11 + 4));
  return (th: number) => {
    const t = wrapA(th); let k = n - 1; for (let i = 0; i < n; i++) if (t >= cuts[i]) k = i;
    const a = cuts[k], b = k + 1 < n ? cuts[k + 1] : cuts[0] + Math.PI * 2, tt = t < a ? t + Math.PI * 2 : t, u = (tt - a) / (b - a), w = (b - a) * 0.9;
    const edge = Math.min(u, 1 - u) * w, top = u < 0.5 ? tear[(k + n - 1) % n] : tear[k];
    const fray = 0.05 * Math.abs(Math.sin(31 * tt + seed)) + 0.035 * Math.abs(Math.sin(57 * tt + 2 * seed)) + 0.07 * ramp(0.35, 0.5, 1 - Math.abs(u - 0.5)) * hash(seed + k);
    return top + (len[k] + fray - top) * ramp(0.0, 0.07, edge);
  };
}
/** Dress a built, posed figure in a robe in tatters. `recipe` is the one it was built from. */
export function tatters(g: THREE.Group, recipe: HeroFigure, o: Tatters): THREE.Group {
  const j = (g.userData.joints ?? {}) as Joints, up = j.chest, pel = j.hips, neck = j.neck; if (!up || !pel || !neck) return g;
  g.updateMatrixWorld(true);
  const s = neck.position.y / 2.24, fr = frameFor(recipe), tr = torsoRings(fr), b = bonesOf(j); if (!b) return g;
  const lying = Math.abs(V(0, 1, 0).transformDirection(up.matrixWorld).y) < 0.5, seed = o.seed ?? 0, hem = tatterHem(seed, o.length);
  // the skirt, built round the body standing at rest: columns all the way round, each from the waist to its own hem
  const NU = 100, NV = 34, ths = Array.from({ length: NU + 1 }, (_, i) => -Math.PI + (Math.PI * 2 * i) / NU);
  const YS = Array.from({ length: TAT_ROWS }, (_, k) => TAT_TOP - ((TAT_TOP - TAT_LOW) * k) / (TAT_ROWS - 1)), { hang } = hanging(fr, ths, YS);
  const gap = (y: number) => 0.04 + 0.07 * ramp(0.1, -1.3, y), fold = (th: number, y: number) => 0.06 * ramp(0, -1.5, y) * (0.5 + 0.5 * Math.sin(9 * th + 1.3 * Math.sin(3 * th) + seed));
  const rows = Array.from({ length: NV + 1 }, (_, k) => ths.map((th, i) => {
    const y = TAT_TOP + (hem(th) - TAT_TOP) * (k / NV) ** 0.9, kk = Math.max(0, Math.min(TAT_ROWS - 1, Math.round((TAT_TOP - y) / ((TAT_TOP - TAT_LOW) / (TAT_ROWS - 1))))), r = hang[kk][i] + gap(y) + fold(th, y);
    return V(Math.sin(th) * r * s, y * s, Math.cos(th) * r * s);
  }));
  const robe = o.color;
  // the robe covers the body from the neck to the knees: what the figure wore there in its trim (the breeches' seat, the
  // belt, the band at the neck) is the robe now, so none of it shows where the robe gapes as the body bends
  const trimHex = recipe.trim ? new THREE.Color(recipe.trim).getHexString() : undefined;
  if (trimHex) for (const part of [pel, up]) for (const m of part.children) { const mesh = m as THREE.Mesh; if (mesh.isMesh && (mesh.material as THREE.MeshLambertMaterial).color?.getHexString() === trimHex) mesh.material = soft(robe); }
  // hung on the posed body as the figure's own skirts are (kit/cloth.ts): each strip from the waist, plumb where nothing
  // is in its way, swung out over a thigh or a knee come up under it and drawing its neighbours along, lying on the floor
  // where it reaches it; on a body laid out it falls, keeping its cut, onto the body and the floor. (The waist rides on
  // the hips, so when the back bends the robe stays over the seat, riding out over a belly bent down onto it.)
  const skirt = new THREE.Mesh(grid(rows), soft(robe, true)); skirt.name = 'robe'; skirt.userData.garment = 'robe'; skirt.userData.layer = 1; pel.add(skirt);
  const world = drapeOf(g, j, fr, s, lying), cut = rows.map((row) => row.map((p) => p.clone()));
  if (world) {
    const worn = [...world.parts.keys()].filter((n) => world.trunk?.includes(n) && !['torso', 'pelvis', 'stowed'].includes(n));
    hangGarments([{ name: 'robe', mesh: skirt, cols: NU + 1, rows: NV + 1, closed: true, axis: V(), covers: ['torso', 'pelvis', 'thighR', 'thighL', 'shinR', 'shinL', 'footR', 'footL', ...worn], outside: ['forearmR', 'forearmL', 'handR', 'handL'], layer: 1, clear: 0.04 * s, spread: 6, hang: 0.9 }], world);
    const pos = skirt.geometry.getAttribute('position') as THREE.BufferAttribute; rows.forEach((row, k) => row.forEach((p, i) => p.fromBufferAttribute(pos, k * (NU + 1) + i)));
  }
  pel.add(new THREE.Mesh(cord(rows[NV].map((p) => p.clone()), 0.011 * s, false), soft(tone(o.color, '#000000', 0.4))));
  robeSleeves(g, j, fr, tr, b, s, { color: robe, seed, lying, skirt: rows });

  // the rope belt round the waist over the robe's top edge, knotted at the front on the left with its ends hanging down
  // over the skirt: each point of it lies on the cloth as the robe has hung, wherever that is. (On a body laid out the
  // robe falls away to the floor, but the belt is tied: it stays round the waist where the robe was cut, its ends short.)
  if (o.belt) {
    const on = lying ? cut : rows;
    /** A point stood `off` out from the skirt, at an angle round the body (0 the front) and a row down it (at the top
     *  edge, where it hangs from the waist, straight out from the waist). */
    const onRobe = (th: number, k: number, off: number) => {
      const u = ((wrapA(th) + Math.PI) / (Math.PI * 2)) * NU, i = Math.min(NU - 1, Math.floor(u)), t = u - i, kk = Math.max(0, Math.min(NV - 1, Math.floor(k))), tk = Math.min(1, k - kk);
      const p = on[kk][i].clone().lerp(on[kk][i + 1], t).lerp(on[kk + 1][i].clone().lerp(on[kk + 1][i + 1], t), tk);
      const n = k <= 0 ? V(p.x, 0, p.z).normalize() : on[kk + 1][i].clone().sub(on[kk][i]).cross(on[kk][i + 1].clone().sub(on[kk][i])).normalize();
      return p.addScaledVector(n, off);
    };
    /** The row a distance (in the figure's units) down a column from the waist. */
    const rowAt = (th: number, d: number) => NV * Math.min(1, d / (TAT_TOP - hem(th))) ** (1 / 0.9);
    const loop: V3[] = []; for (let i = 0; i < 48; i++) loop.push(onRobe((i / 48) * Math.PI * 2, 0, 0.02 * s));
    pel.add(new THREE.Mesh(cord(loop, 0.03 * s, true), soft(o.belt)));
    const tk = SIDE_X.L * 0.42, knot = onRobe(tk, 0, 0.06 * s);
    pel.add(new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 10, 8).scale(1.1, 1, 0.8).translate(knot.x, knot.y, knot.z), soft(tone(o.belt, '#000000', 0.15))));
    const ends: THREE.BufferGeometry[] = [];
    for (const [dx, L] of [[-0.05, 0.75], [0.06, 0.95]] as const) {
      const pts: V3[] = []; for (let k = 0; k <= 8; k++) { const t = k / 8, th = tk + dx + 0.04 * Math.sin(5 * t); pts.push(onRobe(th, rowAt(th, 0.1 + L * (lying ? 0.3 : 1) * t), 0.035 * s)); }
      ends.push(cord(pts, 0.022 * s));
    }
    pel.add(new THREE.Mesh(merged(ends), soft(o.belt)));
  }

  // the cowl: a loose roll of cloth round the base of the neck, and the hood fallen on the back below it (or drawn up
  // over the head, its rim tucked into the roll)
  if (o.cowl || o.hood) {
    const ring: V3[] = [], yc = 2.11, rollAt = (th: number) => 1.03 + 0.06 * Math.sin(5 * th + seed) + 0.1 * Math.max(0, Math.cos(th)) ** 2;
    const dip = (th: number) => 0.025 * Math.sin(3 * th + seed) - 0.12 * Math.max(0, Math.cos(th)) ** 2;
    for (let i = 0; i < 40; i++) { const th = (i / 40) * Math.PI * 2, [x, z] = ringPoint(ringAt(tr, yc), th, rollAt(th)); ring.push(V(x * s, (yc + dip(th)) * s, z * s)); }
    // (drawn up, the hood takes up the cloth: a slimmer roll, the hood's rim inside it)
    up.add(new THREE.Mesh(cord(ring, (o.hood ? 0.072 : 0.1) * s, true), soft(robe)));
    if (o.hood) hoodUp(j, s, robe, (th) => { const [x, z] = ringPoint(ringAt(tr, yc), th, rollAt(th) - 0.1); return V(x * s, (yc + dip(th) + 0.03) * s, z * s); });
    else {
      // (fallen, it lies on the upper back, its crown hanging down and the face's opening turned up under the roll)
      const back = ringAt(tr, 1.9), hood = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
      hood.scale(0.36 * s, 0.32 * s, 0.17 * s).rotateX(Math.PI).translate(0, 1.86 * s, -(back.b + 0.08) * s);
      up.add(new THREE.Mesh(hood, soft(robe, true)));
    }
  }
  return g;
}

/** The robe's sleeves, one down each arm from the shoulder: roomy, widening below the elbow to a bell open over the
 *  hand, the cuff torn into strips of uneven length. Each is cut round its arm as the pose has put it, from the arm's
 *  own surface (a thick arm gets a wide sleeve), its loose cloth hanging below the arm (none where the arm hangs
 *  straight down, most where it is held out level) and slid back down a forearm raised overhead, baring the wrist. It
 *  is pushed off what it would cut through: the trunk, the legs, the other arm and its sleeve, the robe's skirt (cloth
 *  lying against cloth) and the floor, and last off its own arm, so nothing of the arm shows through it. Built in the
 *  hips' frame, like the skirt. */
function robeSleeves(g: THREE.Group, j: Joints, fr: Frame, tr: Ring[], b: Bones, s: number, o: { color: string; seed: number; lying: boolean; skirt: V3[][] }): void {
  const pel = j.hips; if (!pel) return;
  g.updateMatrixWorld(true);
  const toPel = pel.matrixWorld.clone().invert(), P = (obj: THREE.Object3D, at = V()) => obj.localToWorld(at.clone()).applyMatrix4(toPel);
  // the figure's own down, in the hips' frame (as the skirt hangs), and its floor
  const rel = g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pel.getWorldQuaternion(new THREE.Quaternion())), down = V(0, -1, 0).applyQuaternion(rel.invert());
  const toG = g.matrixWorld.clone().invert().multiply(pel.matrixWorld), fromG = toG.clone().invert();
  const GAP = 0.025 * s, CAP = 0.1 * s, N = 52, NU = 32, NV = 29, CAPROWS = 5;
  // the trunk, as the rig lofts it (in the chest's frame): a point inside it is moved straight out from its middle
  const toChest = b.chest.clone().invert(), q = V();
  const offTrunk = (p: V3) => {
    q.copy(p).applyMatrix4(toChest).divideScalar(s); if (q.y < tr[0].y || q.y > tr[tr.length - 1].y) return;
    const r = ringAt(tr, q.y), n = r.n ?? 2, dx = q.x - (r.x ?? 0), dz = q.z - (r.z ?? 0), d = dz >= 0 ? r.f : r.b;
    const rho = ((Math.abs(dx) / r.w) ** n + (Math.abs(dz) / d) ** n) ** (1 / n), want = 1 + (GAP / s) / Math.min(r.w, d);
    if (rho >= want) return;
    const k = want / Math.max(rho, 1e-3); q.set((r.x ?? 0) + dx * k, q.y, (r.z ?? 0) + dz * k); p.copy(q.multiplyScalar(s).applyMatrix4(b.chest));
  };
  // the skirt's reach round the body at each height (standing): how far out it lies, by angle and height
  const TH = 72, YB = 0.05 * s, reachOf = new Map<number, number>(), key = (i: number, k: number) => i * 4096 + k + 2048;
  const binTh = (x: number, z: number) => ((Math.round((Math.atan2(x, z) / (Math.PI * 2)) * TH) % TH) + TH) % TH;
  if (!o.lying) for (const row of o.skirt) for (const p of row) { const k = key(binTh(p.x, p.z), Math.round(p.y / YB)), r = Math.hypot(p.x, p.z); if (r > (reachOf.get(k) ?? 0)) reachOf.set(k, r); }
  const offSkirt = (p: V3) => {
    const i = binTh(p.x, p.z), k = Math.round(p.y / YB); let r = 0;
    for (const di of [-1, 0, 1]) for (const dk of [-1, 0, 1]) r = Math.max(r, reachOf.get(key((i + di + TH) % TH, k + dk)) ?? 0);
    const h = Math.hypot(p.x, p.z); if (!r || h >= r + GAP) return;
    const f = (r + GAP) / Math.max(h, 1e-6); p.x *= f; p.z *= f;
  };
  /** Each arm's line, ring frames and girth, for the sleeves and for keeping each sleeve off the other arm. */
  const arms = (['R', 'L'] as const).map((sd) => {
    const sh = j['shoulder' + sd], el = j['elbow' + sd], wr = j['wrist' + sd]; if (!sh || !el || !wr) return undefined;
    const S = P(sh, V(0, -0.03 * s, 0)), E = P(el), W = P(wr), u1 = E.clone().sub(S), L1 = u1.length(), u2 = W.clone().sub(E), L2 = u2.length();
    u1.divideScalar(L1); u2.divideScalar(L2);
    // the line down the sleeve, rounded through the elbow so its rings never cross
    const bend = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2)))), c = Math.min(0.28 * s, 0.4 * L1, 0.4 * L2) * ramp(0.05, 0.8, bend);
    // (and from above the shoulder, where the sleeve's top closes over it as a cap)
    const A = E.clone().addScaledVector(u1, -c), B = E.clone().addScaledVector(u2, c), end = W.clone().addScaledVector(u2, 0.04 * s), top = S.clone().addScaledVector(u1, -CAP), pts: V3[] = [];
    for (let i = 0; i < 4; i++) pts.push(top.clone().lerp(S, i / 4));
    for (let i = 0; i <= 20; i++) pts.push(S.clone().lerp(A, i / 20));
    for (let i = 1; i <= 10; i++) { const t = i / 10; pts.push(V().addScaledVector(A, (1 - t) ** 2).addScaledVector(E, 2 * t * (1 - t)).addScaledVector(B, t * t)); }
    for (let i = 1; i <= 20; i++) pts.push(B.clone().lerp(end, i / 20));
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], C: V3[] = [], T: V3[] = [], E1: V3[] = [], E2: V3[] = [];
    for (let k = 0; k < N; k++) { const a = (total * k) / (N - 1); let i = 1; while (i < cum.length - 1 && cum[i] < a) i++; const l = cum[i] - cum[i - 1]; C.push(pts[i - 1].clone().lerp(pts[i], l > 1e-9 ? (a - cum[i - 1]) / l : 0)); }
    for (let k = 0; k < N; k++) T.push(C[Math.min(N - 1, k + 1)].clone().sub(C[Math.max(0, k - 1)]).normalize());
    // ring frames carried down the line without twisting
    for (let k = 0; k < N; k++) {
      const from = k ? E1[k - 1] : Math.abs(T[0].dot(down)) < 0.95 ? down : V(1, 0, 0), e1 = from.clone().addScaledVector(T[k], -from.dot(T[k])).normalize();
      E1.push(e1); E2.push(T[k].clone().cross(e1));
    }
    // the arm's girth along the line: the farthest its surface lies from the line (the hand only at its heel)
    const R = new Array<number>(N).fill(0.06 * s), step = total / (N - 1), v = V(), d = V(), kS = Math.round((CAP / total) * (N - 1));
    for (const jt of [sh, el, wr]) for (const m of jt.children as THREE.Mesh[]) {
      if (!m.isMesh || (m.material as THREE.Material).transparent) continue;
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, M = m.matrixWorld.clone().premultiply(toPel), wp = jt === wr ? W : undefined;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M); if (wp && v.distanceTo(wp) > 0.13 * s) continue;
        let best = Infinity, kb = 0; for (let k = 0; k < N; k++) { const dd = v.distanceToSquared(C[k]); if (dd < best) { best = dd; kb = k; } }
        const ax = d.copy(v).sub(C[kb]).dot(T[kb]); if ((kb === 0 && ax < -0.5 * step) || (kb === N - 1 && ax > 0.5 * step)) continue;
        R[kb] = Math.max(R[kb], Math.sqrt(Math.max(0, d.lengthSq() - ax * ax)));
      }
    }
    // (smoothed along the line, so the sleeve does not take the shape of every muscle under it)
    // (the cap is cut to the arm at the top of the sleeve: the shoulder under it lies inside it)
    for (let k = 0; k < kS; k++) R[k] = R[kS];
    const Rm = R.map((_, k) => Math.max(...R.slice(Math.max(0, k - 1), k + 2))), girth = Rm.map((_, k) => (Rm[Math.max(0, k - 1)] + Rm[k] + Rm[Math.min(N - 1, k + 1)]) / 3);
    let kE = 0; for (let k = 1; k < N; k++) if (C[k].distanceToSquared(E) < C[kE].distanceToSquared(E)) kE = k;
    return { sd, C, T, E1, E2, girth, kS, aS: kS / (N - 1), aE: kE / (N - 1), rise: Math.max(0, -u2.dot(down)) };
  });
  for (const arm of arms) {
    if (!arm) continue;
    const { sd, C, T, E1, E2, girth, kS, aS, aE, rise } = arm, other = arms.find((x) => x && x !== arm);
    const sx = sd === 'R' ? 1 : 2, seed = o.seed * 7 + sx;
    // how loose it hangs along the arm (a: 0 at the shoulder, 1 past the wrist): easy on the upper arm, opening out
    // below the elbow; where the forearm is raised the cloth slides down it and gathers at the elbow
    const fore = (a: number) => Math.max(0, (a - aE) / (1 - aE));
    const loose = (a: number) => (a < aE ? 0.01 + 0.035 * ramp(aS, aE, a) : 0.045 + 0.16 * fore(a) ** 1.6 + 0.07 * ramp(0.2, 0.9, rise) * (1 - fore(a))) * s;
    const sag = (a: number) => (a < aE ? 0.06 * ramp(0.2 * aE, aE, a) : 0.06 + 0.2 * fore(a) ** 1.3) * s;
    const reachA = 1 - (1 - aE) * 0.5 * ramp(0.2, 0.9, rise);
    // the cuff, torn into strips of uneven length round the wrist
    const n = 5 + Math.floor(3 * hash(seed + 3)), cuts = Array.from({ length: n }, (_, k) => ((k + 0.3 * (hash(seed * 5 + k * 7) - 0.5)) / n) * Math.PI * 2);
    const short = Array.from({ length: n }, (_, k) => (0.01 + 0.08 * hash(seed * 11 + k * 13)) * s), total = C[0].distanceTo(C[1]) * (N - 1);
    const cuff = (th: number) => {
      const t = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); let k = n - 1; for (let i = 0; i < n; i++) if (t >= cuts[i]) k = i;
      const a = cuts[k], b2 = k + 1 < n ? cuts[k + 1] : cuts[0] + Math.PI * 2, tt = t < a ? t + Math.PI * 2 : t, u = (tt - a) / (b2 - a), edge = Math.min(u, 1 - u) * (b2 - a);
      return short[k] + 0.03 * s * (1 - ramp(0, 0.18, edge));
    };
    const ring = (a: number, th: number): V3 => {
      const x = a * (N - 1), k = Math.max(0, Math.min(N - 2, Math.floor(x))), t = x - k;
      const c = C[k].clone().lerp(C[k + 1], t), e1 = E1[k].clone().lerp(E1[k + 1], t).normalize(), e2 = E2[k].clone().lerp(E2[k + 1], t).normalize(), tg = T[k].clone().lerp(T[k + 1], t).normalize();
      const dn = down.clone().addScaledVector(tg, -down.dot(tg)), thd = Math.atan2(dn.dot(e2), dn.dot(e1));
      // (soft folds down it, deepening toward the cuff; the push off the arm below keeps them clear of it)
      const dome = a < aS ? Math.sqrt(Math.max(0, 1 - ((aS - a) / aS) ** 2)) : 1, fold = (0.01 + 0.03 * fore(a)) * s * Math.sin(6 * th + 2.5 * a + seed) * ramp(aS, aS + 0.08, a);
      const r = dome * (girth[k] + (girth[k + 1] - girth[k]) * t + GAP + loose(a)) + fold + sag(a) * dn.length() * Math.max(0, Math.cos(th - thd)) ** 1.5;
      return c.addScaledVector(e1, Math.cos(th) * r).addScaledVector(e2, -Math.sin(th) * r);
    };
    const rows: V3[][] = [];
    for (let jv = 0; jv <= NV; jv++) { const row: V3[] = []; for (let i = 0; i <= NU; i++) { const th = (i / NU) * Math.PI * 2, a = jv <= CAPROWS ? (aS * jv) / CAPROWS : aS + ((jv - CAPROWS) / (NV - CAPROWS)) * (reachA - cuff(th) / total - aS); row.push(ring(a, th)); } rows.push(row); }
    // off the trunk and the skirt (where the arm itself lies against them the sleeve stays between, never pushed across
    // the arm), the legs and the other arm with its sleeve; then off its own arm, which wins
    const room = (p: V3) => { let m = Infinity; for (let k = kS; k + 1 < N; k++) { const ab = q.subVectors(C[k + 1], C[k]), t = Math.max(0, Math.min(1, V().subVectors(p, C[k]).dot(ab) / Math.max(1e-9, ab.lengthSq()))); m = Math.min(m, p.distanceTo(V().copy(C[k]).addScaledVector(ab, t)) - (girth[k] + (girth[k + 1] - girth[k]) * t + GAP)); } return m; };
    // (the cap over the shoulder is left where it is: its side toward the body lies inside the body, as a sleeve set in)
    const was = V(); for (const row of rows.slice(CAPROWS)) for (const p of row) for (const off of o.lying ? [offTrunk] : [offTrunk, offSkirt]) { was.copy(p); off(p); if (room(p) < 0) p.copy(was); }
    const solids = solidsOf(j, fr, s, true);
    if (other) for (let k = 0; k + 1 < N; k += 3) { const k2 = Math.min(N - 1, k + 3); solids.push({ a: other.C[k], b: other.C[k2], ra: other.girth[k] + 0.06 * s, rb: other.girth[k2] + 0.06 * s }); }
    pushOut(rows, solids, GAP);
    // never through the floor (where an arm lies on it the arm still wins: the body laid out is lifted onto what it wears
    // under it, restOnFloor)
    const own: Capsule[] = []; for (let k = kS; k + 1 < N; k++) own.push({ a: C[k], b: C[k + 1], ra: girth[k], rb: girth[k + 1] });
    const w = V(), floor = () => { for (const row of rows) for (const p of row) { w.copy(p).applyMatrix4(toG); if (w.y < 0.04 * s) { w.y = 0.04 * s; p.copy(w.applyMatrix4(fromG)); } } };
    const body = rows.slice(CAPROWS - 1);
    if (o.lying) { floor(); pushOut(body, own, GAP); } else { pushOut(body, own, GAP); floor(); }
    for (const row of rows) row[NU].copy(row[0]);
    const sleeve = new THREE.Mesh(grid(rows), soft(o.color, true)); sleeve.name = 'sleeve'; pel.add(sleeve);
    pel.add(new THREE.Mesh(cord(rows[NV].slice(0, NU).map((p) => p.clone()), 0.011 * s, true), soft(tone(o.color, '#000000', 0.4))));
  }
}

/** A hood drawn up over the head, in the upper body's frame: roomy over the skull and drawn back to a soft point behind
 *  the crown, its front open in an arch round the face whose sides and brow stand forward past it, so the face sits back
 *  in the hood's dark; below the jaw it falls to `rim` (a point of its lower edge round the neck at an angle from the
 *  front, where the cowl's roll covers it). Built round the head at rest, then carried: the crown and the opening wholly
 *  by the head, the lower part less and less toward the rim, which stays where the shoulders hold it. */
function hoodUp(j: Joints, s: number, color: string, rim: (th: number) => V3): void {
  const up = j.chest, neck = j.neck, head = j.head; if (!up || !neck || !head) return;
  up.updateMatrixWorld(true);
  // the head at rest in the upper body's frame (the neck and head unturned), and where the pose has taken it
  const rest = new THREE.Matrix4().makeTranslation(neck.position.x, neck.position.y, neck.position.z)
    .multiply(new THREE.Matrix4().compose(head.position, new THREE.Quaternion(), head.scale));
  const posed = up.matrixWorld.clone().invert().multiply(head.matrixWorld), D = posed.clone().multiply(rest.clone().invert());
  const box = new THREE.Box3(), b = new THREE.Box3(), toRest = head.matrixWorld.clone().invert().premultiply(rest);
  head.traverse((m) => { const mm = m as THREE.Mesh; if (!mm.isMesh) return; mm.geometry.computeBoundingBox(); box.union(b.copy(mm.geometry.boundingBox!).applyMatrix4(mm.matrixWorld.clone().premultiply(toRest))); });
  if (box.isEmpty()) return;
  const C = box.getCenter(V()), H = box.getSize(V()).multiplyScalar(0.5);
  const W0 = H.x + 0.1 * s, F0 = H.z + 0.06 * s, B0 = H.z + 0.17 * s, yTop = C.y + H.y + 0.12 * s, yJaw = C.y - 0.8 * H.y, E = 0.08 * s;
  // the opening's half-width round the face at a height (t: up from the head's middle, in its half-heights): a pointed
  // arch over the brow, widest across the eyes and cheeks, rounding in under the chin
  const T0 = -0.12, open = (t: number) => 0.8 * (t > T0 ? Math.max(0, 1 - (t - T0) / (0.68 - T0)) ** 0.62 : Math.sqrt(Math.max(0, 1 - ((t - T0) / (-1.0 - T0)) ** 2)));
  /** A point of the hood at rest: `az` round from the front (+x the figure's left), at height y. */
  const P = (az: number, y: number): V3 => {
    const a = wrapA(az), c = Math.cos(a), t = (y - C.y) / H.y, A = open(t);
    const at = (yy: number) => {
      const q = yy > C.y ? (yy - C.y) / (yTop - C.y) : 0, k = Math.sqrt(Math.max(0, 1 - q ** 2.4)), z0 = -0.32 * H.z * q * q;
      // sides standing forward toward the opening; the opening's edge and the brow over it drawn further forward still
      const fwd = E * (A > 0.02 ? Math.exp(-Math.max(0, Math.abs(a) - A) / 0.55) * ramp(0, 0.3, A) : 0) + 1.5 * E * Math.max(0, c) ** 4 * Math.exp(-(((yy - C.y) / H.y - 0.62) ** 2) / 0.05);
      return V(Math.sin(a) * W0 * k, yy, z0 + (c >= 0 ? F0 * c ** 0.75 : B0 * c) * k + fwd * k);
    };
    if (y >= yJaw) return at(y);
    const u = ramp(yJaw, rim(a).y, y), top = at(yJaw), low = rim(a);
    return top.lerp(low, u).setY(y);
  };
  // rows down the hood, each from the opening's left edge round the back to its right (a whole ring where it is closed)
  const NV = 44, NU = 80, rows: V3[][] = [], yRim = (a: number) => rim(a).y, q = V();
  const edgeL: V3[] = [], edgeR: V3[] = [];
  for (let k = 0; k <= NV; k++) {
    const v = k / NV, row: V3[] = [];
    // the height runs from the crown to the jaw and on to the rim (which dips toward the front with the roll)
    const height = (az: number) => (v < 0.72 ? yTop + (yJaw - yTop) * (v / 0.72) : yJaw + (yRim(az) - yJaw) * ((v - 0.72) / 0.28));
    const A = open((height(0) - C.y) / H.y);
    for (let i = 0; i <= NU; i++) {
      const az = A + (Math.PI * 2 - 2 * A) * (i / NU), p = P(az, height(az));
      // carried: the head takes the crown and the face's opening, the rim stays on the shoulders
      p.lerp(q.copy(p).applyMatrix4(D), ramp(yRim(az), yJaw, p.y));
      row.push(p);
    }
    rows.push(row);
    if (row[0].distanceTo(row[NU]) > 0.02 * s) { edgeL.push(row[0].clone()); edgeR.push(row[NU].clone()); }
  }
  const hood = new THREE.Mesh(grid(rows), soft(color, true)); hood.name = 'hood'; up.add(hood);
  // the opening's edge, rolled: down the left side and back up the right, meeting over the brow and under the chin
  if (edgeL.length > 3) up.add(new THREE.Mesh(cord([...edgeL, ...edgeR.reverse()], 0.022 * s, true), soft(tone(color, '#000000', 0.25))));
}

// ---------------------------------------------------------------------------------------------------- bare feet
/** A bare foot (the left; the right is its mirror) in the ankle's frame at unit scale, the sole flat on the floor at
 *  0.47 below the ankle: the foot of the leg coming out of the shin's own section (so there is no step where they meet),
 *  the ankle bones either side, the heel tendon down to the heel, the arch and the instep, the ball of the foot and its
 *  outer edge, sculpted as one piece; then five toes, the big toe on the inside, and claws on them if it has claws.
 *  Built once for each frame's foot length and leg girth. */
const FEET = new Map<string, { body: THREE.BufferGeometry; toes: THREE.BufferGeometry; claws: THREE.BufferGeometry }>(), MIRRORED = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function footField(fl: number, leg: number): Sdf {
  const cw = 0.112 * leg, cd = 0.122 * leg, cz = -0.005 * leg;
  return (x, y, z) => {
    // (just inside the shin above its end, so its open end overhangs the foot by a hair, and narrowing to the ankle)
    const t = Math.min(1, Math.max(0, -y / 0.3)), k = y > 0 ? 0.96 - 1.2 * Math.min(y, 0.05) : 0.96 - 0.2 * t, a = cw * k, b = cd * k;
    let d = (Math.hypot(x / a, (z - cz) / b) - 1) * Math.min(a, b);                                             // the foot of the leg
    d = smax(smax(d, y - 0.05, 0.02), -(y + 0.34), 0.04);
    d = smin(d, ell(x - 0.08 * leg, y + 0.16, z - 0.005, 0.034, 0.045, 0.04), 0.03);                         // the ankle bones
    d = smin(d, ell(x + 0.075 * leg, y + 0.125, z - 0.01, 0.034, 0.045, 0.04), 0.03);
    d = smin(d, seg(x, y, z, [0, -0.02, -0.09 * leg], [0, -0.31, -0.115 * fl]) - 0.034, 0.05);                 // the heel's tendon
    d = smin(d, ell(x, y + 0.385, z + 0.08 * fl, 0.066, 0.085, 0.078), 0.09);                                 // the heel
    d = smin(d, ell(x + 0.006, y + 0.37, z - 0.1 * fl, 0.088, 0.085, 0.19 * fl), 0.07);                       // the arch
    d = smin(d, ell(x, y + 0.27, z - 0.03 * fl, 0.08, 0.11, 0.12), 0.06);                                     // the instep
    d = smin(d, ell(x + 0.004, y + 0.425, z - 0.29 * fl, 0.1, 0.045, 0.07), 0.05);                           // the ball of the foot
    d = smin(d, ell(x - 0.065, y + 0.435, z - 0.15 * fl, 0.035, 0.032, 0.17 * fl), 0.03);                   // its outer edge
    return smax(d, -(y + 0.47), 0.01);                                                                          // the sole, flat
  };
}
/** The toes of the left foot as [base, tip, radius], the big toe first. */
const toesOf = (fl: number): [V3, V3, number][] => [
  [V(-0.052, -0.43, 0.3 * fl), V(-0.06, -0.44, 0.43 * fl), 0.029],
  ...[0, 1, 2, 3].map((k): [V3, V3, number] => { const x = -0.016 + 0.029 * k, r = [0.02, 0.018, 0.016, 0.014][k]; return [V(x, -0.428, (0.31 - 0.012 * k) * fl), V(x * 1.15 + 0.004, -0.47 + r + 0.002, (0.405 - 0.023 * k) * fl), r]; }),
];
function feetOf(fl: number, leg: number) {
  const key = fl.toFixed(3) + ':' + leg.toFixed(3); let f = FEET.get(key); if (f) return f;
  const toes: THREE.BufferGeometry[] = [], claws: THREE.BufferGeometry[] = [], Y = V(0, 1, 0);
  for (const [a, b, r] of toesOf(fl)) {
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    toes.push(new THREE.CapsuleGeometry(r, len, 3, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir)).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2));
    const down = dir.clone().setY(dir.y - 0.55).normalize(), at = b.clone().addScaledVector(dir, r * 0.75);
    claws.push(new THREE.ConeGeometry(r * 0.75, r * 2.4, 6).translate(0, r * 1.1, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, down)).translate(at.x, at.y + r * 0.15, at.z));
  }
  f = { body: nets(footField(fl, leg), [-0.17, -0.49, -0.22 * fl], [0.17, 0.07, 0.42 * fl], 0.014), toes: merged(toes), claws: merged(claws) };
  FEET.set(key, f); return f;
}

/** A loft (anatomy's loftGeometry) with its end caps taken off (the bottom, the top or both), shaded again without them. */
function uncapped(geo: THREE.BufferGeometry, bottom: boolean, top: boolean): THREE.BufferGeometry {
  const ix = geo.index; if (!ix) return geo;
  const n = geo.attributes.position.count, lo = n - 2, hi = n - 1, keep: number[] = [];
  for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i), b = ix.getX(i + 1), c = ix.getX(i + 2); if ((bottom && (a === lo || b === lo || c === lo)) || (top && (a === hi || b === hi || c === hi))) continue; keep.push(a, b, c); }
  const g = geo.clone(); g.setIndex(keep); g.computeVertexNormals(); return g;
}
/** Take the boots off a built, posed figure: bare feet in their place (claws on the toes in that colour, if given), and
 *  the shins bare under trousers torn off at the calf, unless the legs were bare to begin with: trousers the colour of
 *  the skin, or a body that wears nothing (its clothes the colour of its skin: a golem, a gargoyle, an imp), whose feet
 *  are the colour of its legs. `recipe` is the one it was built from. */
export function bareFeet(g: THREE.Group, recipe: HeroFigure, o: { claws?: string; seed?: number } = {}): THREE.Group {
  const j = (g.userData.joints ?? {}) as Joints, neck = j.neck; if (!neck) return g;
  const s = neck.position.y / 2.24, fr = frameFor(recipe), fl = fr.fem ? 1.02 : 1.18, skin = recipe.skin ?? '#d9b899', seed = o.seed ?? 0;
  const naked = !!recipe.cloth && recipe.cloth.toLowerCase() === skin.toLowerCase(), foot0 = naked ? recipe.trim ?? skin : skin;
  const pants = !naked && recipe.trim && recipe.trim.toLowerCase() !== skin.toLowerCase() ? recipe.trim : undefined, box = new THREE.Box3();
  for (const sd of ['R', 'L'] as const) {
    const sx = SIDE_X[sd], kn = j['knee' + sd], an = j['ankle' + sd]; if (!kn || !an) continue;
    for (const m of [...kn.children]) {
      const mesh = m as THREE.Mesh; if (!mesh.isMesh) continue;
      mesh.geometry.computeBoundingBox(); box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrix);
      if (box.max.y < -0.4 * s) kn.remove(mesh);                                                              // the boot: its shaft, cuff, strap and buckle
      else if (box.min.y < -0.9 * s && box.max.y > -0.2 * s) { // the shin (bare, unless it is the legs' own colour), open at the ankle where the foot comes out of it
        mesh.geometry = uncapped(mesh.geometry, true, false); if (!naked) mesh.material = soft(skin);
      }
    }
    for (const m of [...an.children]) if ((m as THREE.Mesh).isMesh) an.remove(m);                         // the boot's foot, sole and heel
    if (pants) { // the trouser leg torn off below the knee, its hem ragged
      const jag = (th: number) => 0.55 * Math.abs(Math.sin(2.5 * th + seed + sx)) + 0.45 * Math.abs(Math.sin(5.7 * th + 2 * seed)) ** 2, y0 = -0.8, y1 = 0.066;
      kn.add(new THREE.Mesh(uncapped(loftGeometry(clipRings(shinRings(fr), y0, y1), s, { seg: 18, rows: 12, k: 1.07, warp: ([x, y, z]) => { const h = -0.58 - 0.16 * jag(Math.atan2(x, z)); return [x, h + (y1 - h) * ((y - y0) / (y1 - y0)), z]; } }), true, true), soft(pants)));
    }
    const F = feetOf(fl, fr.leg), side = (g0: THREE.BufferGeometry) => (sx > 0 ? g0 : (MIRRORED.get(g0) ?? MIRRORED.set(g0, mirrorX(g0)).get(g0)!));
    const foot = new THREE.Mesh(side(F.body), soft(foot0)); foot.scale.setScalar(s); foot.name = 'foot' + sd; an.add(foot); j['foot' + sd] = foot;
    const toes = new THREE.Mesh(side(F.toes), soft(foot0)); toes.scale.setScalar(s); an.add(toes);
    if (o.claws) { const c = new THREE.Mesh(side(F.claws), soft(o.claws)); c.scale.setScalar(s); an.add(c); }
  }
  return g;
}
