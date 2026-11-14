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
import { THIGH, clipRings, loftGeometry, neckRings, pelvisRings, ringAt, ringPoint, thighRings, torsoRings, upperArmRings, type Frame, type Ring } from './anatomy';
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
function solidsOf(j: Joints, fr: Frame, s: number): Capsule[] {
  const pel = j.hips, out: Capsule[] = [], P = (o: THREE.Object3D | undefined, at = V()) => o ? pel.worldToLocal(o.localToWorld(at.clone())) : undefined;
  pel.updateMatrixWorld(true);
  for (const sd of ['R', 'L']) {
    const sh = P(j['shoulder' + sd]), el = P(j['elbow' + sd]), wr = P(j['wrist' + sd]), tip = P(j['wrist' + sd], V(0, -0.32 * s, 0));
    if (sh && el && wr && tip) { out.push({ a: sh, b: el, ra: 0.24 * fr.arm * s, rb: 0.17 * fr.arm * s }, { a: el, b: wr, ra: 0.17 * fr.arm * s, rb: 0.12 * fr.arm * s }, { a: wr, b: tip, ra: 0.13 * s, rb: 0.11 * s }); }
    const hip = P(j['hip' + sd]), kn = P(j['knee' + sd]), an = P(j['ankle' + sd]);
    if (hip && kn && an) out.push({ a: hip, b: kn, ra: 0.38 * fr.leg * s, rb: 0.24 * fr.leg * s }, { a: kn, b: an, ra: 0.24 * fr.leg * s, rb: 0.16 * fr.leg * s });
  }
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
