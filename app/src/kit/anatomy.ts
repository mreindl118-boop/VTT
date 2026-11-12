// Anatomy for the hero figures (kit/heroes.ts): the body as lofted surfaces. A loft is a stack of rings, each an oval
// with its own width, its depth to the front and to the back, and a squareness, so a chest can be deep in front, a calf
// full behind, a shoulder line flat. Sizes are feet at scale 1; original geometry, no outside art.
import * as THREE from 'three';

/** One cross-section: height, half-width, depth to the front (+z) and to the back, an offset, and squareness (2 is an
 *  ellipse; higher is boxier). */
export interface Ring { y: number; w: number; f: number; b: number; z?: number; x?: number; n?: number }
export type Build = 'lean' | 'broad' | 'curvy';

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** The ring at a height, eased between its neighbours. Rings run bottom to top. */
export function ringAt(rings: Ring[], y: number): Ring {
  if (y <= rings[0].y) return { ...rings[0], y };
  for (let i = 1; i < rings.length; i++) if (y <= rings[i].y) {
    const a = rings[i - 1], b = rings[i], t = ease((y - a.y) / (b.y - a.y)), mix = (p: number, q: number) => p + (q - p) * t;
    return { y, w: mix(a.w, b.w), f: mix(a.f, b.f), b: mix(a.b, b.b), z: mix(a.z ?? 0, b.z ?? 0), x: mix(a.x ?? 0, b.x ?? 0), n: mix(a.n ?? 2, b.n ?? 2) };
  }
  return { ...rings[rings.length - 1], y };
}
/** A point on a ring at an angle (0 is the front, round through +x), `k` scaling it outward. */
export function ringPoint(r: Ring, th: number, k = 1): [number, number] {
  const sn = Math.sin(th), cs = Math.cos(th), e = 2 / (r.n ?? 2);
  return [(r.x ?? 0) + Math.sign(sn) * Math.abs(sn) ** e * r.w * k, (r.z ?? 0) + Math.sign(cs) * Math.abs(cs) ** e * (cs >= 0 ? r.f : r.b) * k];
}
/** The part of a stack between two heights. */
export function clipRings(rings: Ring[], lo: number, hi: number): Ring[] {
  return [ringAt(rings, lo), ...rings.filter((r) => r.y > lo + 1e-6 && r.y < hi - 1e-6), ringAt(rings, hi)];
}
export const scaleRings = (rings: Ring[], kw: number, kd = kw, ky = 1): Ring[] => rings.map((r) => ({ ...r, y: r.y * ky, w: r.w * kw, f: r.f * kd, b: r.b * kd, z: (r.z ?? 0) * kd, x: (r.x ?? 0) * kw }));

/** The surface through a stack of rings, closed at both ends. `bump(th, y)` swells it (a fraction of its size);
 *  `warp` moves each point of it (before scaling), for a form the rings cannot carry. */
export function loftGeometry(rings: Ring[], s: number, o: { seg?: number; rows?: number; k?: number; bump?: (th: number, y: number) => number; warp?: (p: [number, number, number]) => [number, number, number]; jig?: (p: [number, number, number]) => number } = {}): THREE.BufferGeometry {
  const seg = o.seg ?? 24, rows = o.rows ?? Math.max(8, (rings.length - 1) * 5), y0 = rings[0].y, y1 = rings[rings.length - 1].y, k = o.k ?? 1;
  const pos: number[] = [], idx: number[] = [], jig: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * i / rows, r = ringAt(rings, y);
    for (let j = 0; j < seg; j++) { const th = (j / seg) * Math.PI * 2, [x, z] = ringPoint(r, th, k * (1 + (o.bump?.(th, y) ?? 0))), q = o.warp ? o.warp([x, y, z]) : [x, y, z]; pos.push(q[0] * s, q[1] * s, q[2] * s); if (o.jig) jig.push(o.jig([x, y, z]) * s); }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
  const lo = ringAt(rings, y0), hi = ringAt(rings, y1), base = pos.length / 3;
  pos.push((lo.x ?? 0) * s, y0 * s, (lo.z ?? 0) * s, (hi.x ?? 0) * s, y1 * s, (hi.z ?? 0) * s);
  for (let j = 0; j < seg; j++) { idx.push(base, (j + 1) % seg, j); idx.push(base + 1, rows * seg + j, rows * seg + (j + 1) % seg); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (o.jig) { jig.push(0, 0); g.setAttribute('jig', new THREE.Float32BufferAttribute(jig, 1)); } // how far each point swings when the figure jiggles
  return g;
}

/** Heroic legs: the thigh and shin lengths, and the height of the hips above the floor (the ankle stands 0.47 up). */
export const THIGH = 1.38, SHIN = 1.26, HIP = THIGH + SHIN + 0.47;

/** A body's measures: a feminine or masculine frame, in a lean, broad or curvy build. */
export interface Frame { fem: boolean; build: Build; shoulderX: number; hipX: number; arm: number; leg: number; hand: number; bust: number; m: Required<Measures> }
/** A character's own measures over its frame, each a multiplier (1 = the frame's): the width of the shoulders, the
 *  chest, the waist and the hips, the bust, the girth of the arms and the legs, and the neck. Taken from the
 *  character's art: a brawny fighter is wide in the shoulders, waist and arms; a slight one narrow everywhere. */
export interface Measures { shoulders?: number; chest?: number; waist?: number; hips?: number; bust?: number; arms?: number; legs?: number; neck?: number }
export function frameOf(fem: boolean, build: Build = 'lean', measures: Measures = {}): Frame {
  const m = { shoulders: 1, chest: 1, waist: 1, hips: 1, bust: 1, arms: 1, legs: 1, neck: 1, ...measures };
  const fr = baseFrame(fem, build);
  return { ...fr, m, shoulderX: fr.shoulderX * (0.35 + 0.65 * m.shoulders), hipX: fr.hipX * (0.5 + 0.5 * m.hips), arm: fr.arm * m.arms, leg: fr.leg * m.legs, hand: fr.hand * (0.7 + 0.3 * m.arms), bust: fr.bust * m.bust };
}
function baseFrame(fem: boolean, build: Build): Omit<Frame, 'm'> {
  if (fem) return { fem, build, shoulderX: build === 'broad' ? 0.78 : 0.7, hipX: build === 'curvy' ? 0.35 : 0.33, arm: build === 'broad' ? 0.97 : 0.87, leg: build === 'broad' ? 1.1 : 1.04, hand: 1.5, bust: build === 'curvy' ? 0.26 : build === 'broad' ? 0.215 : 0.2 };
  return { fem, build, shoulderX: build === 'broad' ? 0.98 : 0.9, hipX: 0.3, arm: build === 'broad' ? 1.2 : 1.05, leg: build === 'broad' ? 1.2 : 1.1, hand: build === 'broad' ? 1.9 : 1.72, bust: 0 };
}

/** The torso, waist to the base of the neck, in the upper body's frame (the hips at 0). */
export function torsoRings(fr: Frame): Ring[] {
  // the character's measures by height: hips below, the waist, the chest, the shoulders at the top
  const m = fr.m, waistY = fr.fem ? 0.9 : 0.6, stops: [number, number][] = [[0.1, m.hips], [waistY, m.waist], [1.5, m.chest], [1.9, m.shoulders], [2.1, m.shoulders], [2.3, m.neck]];
  const k = (y: number) => { for (let i = 1; i < stops.length; i++) if (y <= stops[i][0]) { const [y0, a] = stops[i - 1], [y1, b] = stops[i]; return a + (b - a) * Math.max(0, (y - y0) / (y1 - y0)); } return m.neck; };
  return baseTorso(fr).map((r) => { const q = k(r.y), d = 0.5 + 0.5 * q; return { ...r, w: r.w * q, f: r.f * d, b: r.b * d }; });
}
function baseTorso(fr: Frame): Ring[] {
  if (fr.fem) {
    const h = fr.build === 'curvy' ? 1.08 : 1, wst = fr.build === 'curvy' ? 0.95 : fr.build === 'broad' ? 1.1 : 1, sh = fr.build === 'broad' ? 1.1 : 1;
    return [{ y: 0.1, w: 0.67 * h, f: 0.3, b: 0.36 * h }, { y: 0.5, w: 0.54 * h, f: 0.27, b: 0.27 }, { y: 0.9, w: 0.375 * wst, f: 0.235 * wst, b: 0.215 * wst }, { y: 1.3, w: 0.46 * sh, f: 0.28, b: 0.25 },
      { y: 1.6, w: 0.54 * sh, f: 0.31, b: 0.28, n: 2.2 }, { y: 1.9, w: 0.61 * sh, f: 0.26, b: 0.28, n: 2.5 }, { y: 2.03, w: 0.54 * sh, f: 0.22, b: 0.25, n: 2.3 }, { y: 2.15, w: 0.3 * sh, f: 0.18, b: 0.22 }, { y: 2.3, w: 0.15, f: 0.14, b: 0.16 }];
  }
  const c = fr.build === 'broad' ? 1.12 : 1, d = fr.build === 'broad' ? 1.08 : 1;
  return [{ y: 0.1, w: 0.55, f: 0.3, b: 0.3 }, { y: 0.6, w: 0.49 * d, f: 0.28 * d, b: 0.26 * d }, { y: 1.1, w: 0.58 * c, f: 0.33 * d, b: 0.3 * d }, { y: 1.6, w: 0.72 * c, f: 0.39 * d, b: 0.34 * d, n: 2.3 },
    { y: 1.9, w: 0.79 * c, f: 0.32 * d, b: 0.34 * d, n: 2.6 }, { y: 2.04, w: 0.7 * c, f: 0.27 * d, b: 0.31 * d, n: 2.4 }, { y: 2.16, w: 0.42 * c, f: 0.22, b: 0.27 * d }, { y: 2.3, w: 0.2, f: 0.18, b: 0.2 }];
}
/** The pelvis: hips and seat, the hips at 0. */
export function pelvisRings(fr: Frame): Ring[] {
  const h = fr.m.hips, d = 0.5 + 0.5 * h;
  return basePelvis(fr).map((r, i) => i === 0 ? r : { ...r, w: r.w * h, f: r.f * d, b: r.b * d });
}
function basePelvis(fr: Frame): Ring[] {
  if (fr.fem) { const h = fr.build === 'curvy' ? 1.08 : 1; return [{ y: -0.42, w: 0.24, f: 0.18, b: 0.24 }, { y: -0.15, w: 0.68 * h, f: 0.3, b: 0.47 * h }, { y: 0.15, w: 0.7 * h, f: 0.3, b: 0.4 * h }, { y: 0.5, w: 0.54 * h, f: 0.27, b: 0.27 }]; }
  return [{ y: -0.42, w: 0.22, f: 0.18, b: 0.2 }, { y: -0.15, w: 0.54, f: 0.3, b: 0.37 }, { y: 0.15, w: 0.56, f: 0.3, b: 0.33 }, { y: 0.5, w: 0.5, f: 0.28, b: 0.27 }];
}
/** Limbs hang from their joint at 0: the upper arm (to −1.12), forearm (−1.04), thigh (−THIGH), shin (−SHIN). */
export const upperArmRings = (fr: Frame): Ring[] => scaleRings([{ y: -1.12, w: 0.135, f: 0.14, b: 0.15 }, { y: -0.85, w: 0.15, f: 0.16, b: 0.16 }, { y: -0.5, w: fr.fem && fr.m.arms < 1.2 ? 0.17 : 0.19, f: fr.fem && fr.m.arms < 1.2 ? 0.175 : 0.235, b: fr.fem && fr.m.arms < 1.2 ? 0.175 : 0.21 }, { y: -0.2, w: 0.19, f: 0.19, b: 0.19 }, { y: -0.04, w: 0.17, f: 0.17, b: 0.17 }, { y: 0.1, w: 0.06, f: 0.06, b: 0.06 }], fr.arm);
export const forearmRings = (fr: Frame): Ring[] => scaleRings([{ y: -1.04, w: 0.098, f: 0.075, b: 0.08 }, { y: -0.7, w: 0.115, f: 0.1, b: 0.11 }, { y: -0.28, w: 0.16, f: 0.15, b: 0.16 }, { y: 0.0, w: 0.14, f: 0.14, b: 0.15 }, { y: 0.05, w: 0.13, f: 0.13, b: 0.14 }], fr.arm);
export function thighRings(fr: Frame): Ring[] {
  const top = (fr.fem ? (fr.build === 'curvy' ? 1.18 : 1.1) : 1) * (0.5 + 0.5 * fr.m.hips);
  return scaleRings([{ y: -1.24, w: 0.19, f: 0.2, b: 0.18 }, { y: -0.9, w: 0.225, f: 0.24, b: 0.21 }, { y: -0.45, w: 0.295 * top, f: 0.31, b: 0.28 * top }, { y: -0.1, w: 0.325 * top, f: 0.29, b: 0.33 * top }, { y: 0.1, w: 0.27 * top, f: 0.23, b: 0.28 }], fr.leg, fr.leg, THIGH / 1.24);
}
export const shinRings = (fr: Frame): Ring[] => scaleRings([{ y: -1.14, w: 0.115, f: 0.12, b: 0.13 }, { y: -0.8, w: 0.14, f: 0.14, b: 0.17 }, { y: -0.35, w: 0.2, f: 0.165, b: 0.275 }, { y: -0.05, w: 0.185, f: 0.2, b: 0.19 }, { y: 0.06, w: 0.18, f: 0.2, b: 0.17 }], fr.leg, fr.leg, SHIN / 1.14);
export const neckRings = (fr: Frame): Ring[] => scaleRings(baseNeck(fr), fr.m.neck);
const baseNeck = (fr: Frame): Ring[] => fr.fem ? [{ y: -0.08, w: 0.16, f: 0.14, b: 0.16 }, { y: 0.2, w: 0.125, f: 0.125, b: 0.135 }, { y: 0.55, w: 0.125, f: 0.13, b: 0.135 }]
  : [{ y: -0.08, w: fr.build === 'broad' ? 0.25 : 0.21, f: 0.18, b: 0.21 }, { y: 0.2, w: fr.build === 'broad' ? 0.19 : 0.165, f: 0.165, b: 0.18 }, { y: 0.55, w: 0.16, f: 0.16, b: 0.17 }];

/** A lock of hair, a ribbon of cloth, a tail: a tapering tube along a path, flattened across `flat` (1 is round). */
export function lockGeometry(pts: THREE.Vector3[], r0: number, r1: number, flat = 0.55, sides = 6, belly = 0.25): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts), n = Math.max(6, pts.length * 4), fr = curve.computeFrenetFrames(n, false);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), r = (r0 + (r1 - r0) * t) * (1 + belly * Math.sin(Math.PI * t)), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j < sides; j++) { const a = (j / sides) * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r * flat; pos.push(p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy, p.z + N.z * cx + B.z * cy); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides; idx.push(a, c, b, b, c, d); }
  const base = pos.length / 3, a = curve.getPointAt(0), z = curve.getPointAt(1); pos.push(a.x, a.y, a.z, z.x, z.y, z.z);
  for (let j = 0; j < sides; j++) { idx.push(base, j, (j + 1) % sides); idx.push(base + 1, n * sides + (j + 1) % sides, n * sides + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
