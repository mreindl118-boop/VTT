// Golems' own bodies: a golem is made of something, and its miniature shows what. Each is built over the posed figure
// (kit/heroes.ts), on its joints, so it keeps every pose, the fall and the clip checks.
// - amberStatue: the Amber Temple's golem, a ten-foot amber statue of a hawk-headed man (as the module describes it and
//   its art shows): a falcon's head under a striped headcloth whose lappets fall over a broad collar, guards
//   over the knees and down the shins, the whole of it one carved piece of amber. The temple's other golem is the same
//   statue with a jackal's head (the module), its amber cracked through.
// - clayBody: Van Richten's clay golems, statues sculpted from clay, human in shape but with the proportions off (the
//   Monster Manual): every surface pressed into lumps by hand, a crude head with thumbed-in eyes, a pinched nose, a slit
//   for a mouth and a sigil pressed into the brow.
// - stitched: a body put together from the parts of others (the flesh golems): seams stitched round the neck, the wrists
//   and wherever a part was grafted on, parts in other people's skins, and on a brute iron staples across the seams.
// Original geometry.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { forearmRings, neckRings, ringAt, shinRings, torsoRings, upperArmRings, type Ring } from './anatomy';
import { frameFor, SIDE_X, type HeroFigure } from './heroes';
import { ell, nets, smax, smin } from './sdf';

type Geo = THREE.BufferGeometry;
type Joints = Record<string, THREE.Object3D | undefined>;
const ramp = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
/** A smooth-shaded palette colour, as the figure's own parts are. */
function soft(c: string): THREE.MeshLambertMaterial { const m = mat(c, { emissive: '#030303' }); m.userData.smooth = true; return m; }
/** A mesh coloured per vertex between two colours by its `shade` attribute (0 to 1), kept as it is by the token's look. */
function painted(g: Geo, c0: string, c1: string): THREE.Mesh {
  const sh = g.getAttribute('shade') as THREE.BufferAttribute, a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color(), col = new Float32Array(sh.count * 3);
  for (let i = 0; i < sh.count; i++) { c.copy(a).lerp(b, sh.getX(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  const geo = g.clone(); geo.deleteAttribute('shade'); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = soft('#ffffff').clone(); m.vertexColors = true; m.userData = { ...m.userData, smooth: true, keepLook: true };
  const mesh = new THREE.Mesh(geo, m); mesh.userData.keepLook = true; return mesh;
}
/** Distance to a run of rods through points P, each as thick as R says there (a tapering horn, a beak). */
function taper(x: number, y: number, z: number, P: number[][], R: number[]): number {
  let d = Infinity;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
    const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
    d = Math.min(d, Math.hypot(px - bx * h, py - by * h, pz - bz * h) - (R[i - 1] + (R[i] - R[i - 1]) * h));
  }
  return d;
}
/** Distance to the line from a to b. */
function toLine(x: number, y: number, z: number, a: number[], b: number[]): number { return taper(x, y, z, [a, b], [0, 0]); }

// ------------------------------------------------------------------------------------------------------ the hawk's head
// In the head's frame (the figure's units: y up from the top of the neck, z forward), as big as a man's head: the skull a
// rounded crown over a short face, the eyes far forward under hooded brows, the beak hooked down from a cere, and over it
// all a headcloth: across the brow above the eyes, standing out flat beside the face and falling to the shoulders.
const UPPER = [[0, 0.4, 0.16], [0, 0.405, 0.27], [0, 0.385, 0.35], [0, 0.345, 0.405], [0, 0.29, 0.42], [0, 0.238, 0.396]];
const UPPER_R = [0.094, 0.074, 0.054, 0.037, 0.022, 0.008];
const LOWER = [[0, 0.335, 0.17], [0, 0.312, 0.29], [0, 0.302, 0.352]], LOWER_R = [0.056, 0.032, 0.011];
function hawkFace(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(x, y - 0.44, z + 0.02, 0.19, 0.175, 0.215);                                   // the crown
  d = smin(d, ell(x, y - 0.355, z - 0.05, 0.185, 0.15, 0.175), 0.06);                       // the cheeks and the face
  d = smin(d, ell(x, y - 0.17, z + 0.02, 0.13, 0.2, 0.15), 0.07);                           // the throat, into the neck
  d = smin(d, ell(ax - 0.088, y - 0.47, z - 0.168, 0.074, 0.032, 0.062), 0.035);           // the brows, hooded over the eyes
  d = smin(d, ell(ax - 0.112, y - 0.42, z - 0.148, 0.046, 0.046, 0.046), 0.02);            // the eyes
  d = smin(d, ell(x, y - 0.4, z - 0.19, 0.07, 0.056, 0.045), 0.02);                         // the cere at the root of the beak
  // the beak, narrower than it is deep: the upper hooked down over the lower
  d = smin(d, taper(x / 0.62, y, z, UPPER, UPPER_R) * 0.62, 0.025);
  return smin(d, taper(x / 0.7, y, z, LOWER, LOWER_R) * 0.7, 0.015);
}
/** The headcloth: a dome over the crown, coming forward over the brow to a band above the eyes, and below it flat sides
 *  standing out beside the cheeks, falling behind the jaw to the shoulders; it lies back from the face. */
function headcloth(x: number, y: number, z: number): number {
  const dome = ell(x, y - 0.43, z + 0.03, 0.222, 0.205, 0.26);
  // (the sides a box in plan with its corners well rounded, widening as they fall, and the back rounded over)
  const hw = 0.245 + 0.065 * ramp(0.42, 0.1, y), r = 0.09, qx = Math.abs(x) - hw + r, qz = Math.abs(z + 0.07) - 0.2 + r;
  const plan = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r, side = Math.max(plan, y - 0.46, -0.24 - y);
  // open in front below the brow band, whose edge dips a little toward the temples (the opening a true distance, so the
  // band's edge rounds as a cast edge does rather than breaking into teeth)
  const below = y - (0.522 - 0.6 * x * x), front = 0.005 - z;
  const open = below > 0 && front > 0 ? Math.hypot(below, front) : Math.max(below, front);
  return smax(smin(dome, side, 0.06), -open, 0.04);
}
function hawkField(x: number, y: number, z: number): number { return smin(hawkFace(x, y, z), headcloth(x, y, z), 0.03); }
/** How dark the amber is at a point of the head: the headcloth's stripes in its grooves, the eyes, the falcon's dark mark
 *  under each eye, the beak's gape and nostrils. */
function hawkShade(x: number, y: number, z: number): number {
  const ax = Math.abs(x), cloth = ramp(0.008, -0.008, headcloth(x, y, z) - hawkFace(x, y, z));   // (how much of the point is headcloth: soft at its edge)
  const band = y > 0.44 && z > 0.12 ? 0 : ramp(0.3, 0.7, Math.abs(((y + 0.3) / 0.07) % 1 - 0.5) * 2);    // the brow band plain, the rest striped
  const face = Math.max(
    ramp(0.034, 0.022, Math.hypot(ax - 0.128, y - 0.425, z - 0.183)),                                  // the eye
    0.62 * ramp(0.018, 0.01, toLine(ax, y, z, [0.13, 0.392, 0.17], [0.112, 0.3, 0.13])),             // the mark under the eye
    0.75 * ramp(0.011, 0.005, toLine(ax, y, z, [0.055, 0.345, 0.2], [0.012, 0.318, 0.345])),         // the gape
    0.8 * ramp(0.015, 0.008, Math.hypot(ax - 0.03, y - 0.41, z - 0.232)));                             // a nostril in the cere
  return cloth * 0.42 * band + (1 - cloth) * face;
}
let HAWK: Geo | undefined;
const hawkGeo = () => (HAWK ??= nets(hawkField, [-0.36, -0.26, -0.33], [0.36, 0.7, 0.46], 0.0125, hawkShade));

// ---------------------------------------------------------------------------------------------------- the jackal's head
// The temple's other amber golem (the module: a jackal-headed warrior, its amber cracked): the skull long and narrow over
// a long muzzle, the ears tall and pointed, standing up out of the same headcloth; cracks run across it.
const MUZZLE = [[0, 0.385, 0.11], [0, 0.36, 0.25], [0, 0.338, 0.36], [0, 0.326, 0.43]], MUZZLE_R = [0.095, 0.075, 0.056, 0.042];
const JAW = [[0, 0.3, 0.1], [0, 0.286, 0.25], [0, 0.284, 0.35]], JAW_R = [0.07, 0.048, 0.03];
/** An ear (x taken on the figure's left, +x): a tall cone, thin front to back (its depth squeezed by EAR_K), and the
 *  hollow in its front. */
const EAR_K = 0.45, EAR = [[0.1, 0.52, 0.024], [0.135, 0.86, -0.05]], EAR_R = [0.095, 0.014], HOLLOW = [[0.103, 0.58, 0.11], [0.132, 0.82, 0.01]], HOLLOW_R = [0.062, 0.006];
const earHollow = (ax: number, y: number, z: number) => taper(ax, y, (z + 0.03) / EAR_K, HOLLOW, HOLLOW_R) * EAR_K;
function jackalEar(ax: number, y: number, z: number): number {
  return smax(taper(ax, y, (z + 0.03) / EAR_K, EAR, EAR_R) * EAR_K, -earHollow(ax, y, z), 0.006);
}
function jackalFace(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(x, y - 0.45, z + 0.01, 0.165, 0.16, 0.2);                                    // the skull, long and narrow
  d = smin(d, ell(x, y - 0.375, z - 0.05, 0.125, 0.105, 0.15), 0.06);                      // the cheeks, narrowing to the muzzle
  d = smin(d, ell(x, y - 0.17, z + 0.02, 0.12, 0.2, 0.14), 0.07);                          // the throat, into the neck
  d = smin(d, ell(ax - 0.074, y - 0.442, z - 0.15, 0.06, 0.032, 0.056), 0.035);             // the brows over the eyes
  d = smin(d, ell(ax - 0.082, y - 0.41, z - 0.17, 0.03, 0.019, 0.034), 0.016);              // the eyes, long and slanting back
  d = smin(d, taper(x / 0.86, y, z, MUZZLE, MUZZLE_R) * 0.86, 0.05);                        // the muzzle, narrower than deep
  d = smin(d, taper(x / 0.88, y, z, JAW, JAW_R) * 0.88, 0.03);                              // the lower jaw under it
  d = smin(d, ell(x, y - 0.345, z - 0.452, 0.036, 0.026, 0.026), 0.014);                    // the nose
  d = smax(d, -(toLine(ax, y, z, [0.012, 0.306, 0.43], [0.078, 0.302, 0.18]) - 0.01), 0.02);     // the line of the mouth
  return smin(d, jackalEar(ax, y, z), 0.03);
}
function jackalField(x: number, y: number, z: number): number { return smin(jackalFace(x, y, z), headcloth(x, y, z), 0.03); }
/** How far a point is from a broken line in a plane (the plane's two coordinates given). */
function toPath(u: number, v: number, P: number[][]): number {
  let d = Infinity;
  for (let i = 1; i < P.length; i++) d = Math.min(d, toLine(u, v, 0, [P[i - 1][0], P[i - 1][1], 0], [P[i][0], P[i][1], 0]));
  return d;
}
// cracks over the jackal's head: down the brow, across the muzzle and down the headcloth's left side
const CRACK_FRONT = [[0.03, 0.66], [0.062, 0.6], [0.04, 0.55], [0.085, 0.5], [0.07, 0.462]];
const CRACK_MUZZLE = [[-0.05, 0.22], [-0.01, 0.27], [0.022, 0.255], [0.05, 0.31]];
const CRACK_SIDE = [[-0.12, 0.62], [-0.06, 0.52], [-0.1, 0.42], [-0.04, 0.3], [-0.08, 0.14]];
/** How dark the amber is at a point of the jackal's head: the headcloth's stripes, the eyes, the nose, the line of the
 *  mouth, the hollows of the ears, and the cracks. */
function jackalShade(x: number, y: number, z: number): number {
  const ax = Math.abs(x), cloth = ramp(0.008, -0.008, headcloth(x, y, z) - jackalFace(x, y, z));
  const band = y > 0.44 && z > 0.12 ? 0 : ramp(0.3, 0.7, Math.abs(((y + 0.3) / 0.07) % 1 - 0.5) * 2);
  const ear = ax > 0.05 && y > 0.56 ? 0.5 * ramp(0.01, 0.002, earHollow(ax, y, z)) : 0;                    // (down in the hollow)
  const face = Math.max(
    ramp(1.25, 0.8, Math.hypot((ax - 0.082) / 0.03, (y - 0.41) / 0.019, (z - 0.17) / 0.034)),          // the eye
    0.85 * ramp(0.03, 0.018, Math.hypot(x, y - 0.35, z - 0.465)),                                     // the nose
    0.7 * ramp(0.02, 0.008, toLine(ax, y, z, [0.012, 0.306, 0.43], [0.078, 0.302, 0.18])),           // the mouth
    ear);
  const crack = Math.min(z > 0.05 ? toPath(x, y, CRACK_FRONT) : 1, y > 0.3 && z > 0.18 ? toPath(x, z, CRACK_MUZZLE) : 1, x < -0.12 ? toPath(z, y, CRACK_SIDE) : 1);
  return Math.max(cloth * 0.42 * band + (1 - cloth) * face, 0.9 * ramp(0.008, 0.003, crack));
}
let JACKAL: Geo | undefined;
const jackalGeo = () => (JACKAL ??= nets(jackalField, [-0.36, -0.26, -0.33], [0.36, 0.92, 0.5], 0.0125, jackalShade));

// ------------------------------------------------------------------------------------------------- laid on the body
/** The chest's front at a height and across it (the torso's ring there), and its outward normal. */
function chestFront(tr: Ring[], x: number, y: number): [THREE.Vector3, THREE.Vector3] {
  const r = ringAt(tr, y), n = r.n ?? 2, ax = Math.min(Math.abs(x), r.w * 0.995), sx = Math.sign(x) || 1;
  const z = r.f * (1 - (ax / r.w) ** n) ** (1 / n);
  const nx = sx * n * ax ** (n - 1) / r.w ** n, nz = n * z ** (n - 1) / r.f ** n;
  return [new THREE.Vector3(sx * ax, y, z + (r.z ?? 0)), new THREE.Vector3(nx, 0, nz).normalize()];
}
/** A slab lying on the chest: `at` maps (u, v) over [0, 1]² to a point (x, y) of its front, and the slab stands `lift` off
 *  the skin there, `thick` deep. */
function chestSlab(tr: Ring[], at: (u: number, v: number) => [number, number], lift: number, thick: number, nu = 24, nv = 6, shade?: (u: number, v: number) => number): Geo {
  const pos: number[] = [], idx: number[] = [], sh: number[] = [], grid = (k: number) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const [x, y] = at(i / nu, j / nv), [p, nm] = chestFront(tr, x, y), q = p.addScaledVector(nm, lift + k * thick); pos.push(q.x, q.y, q.z);
      sh.push(shade ? shade(i / nu, j / nv) : 0);
    }
    return base;
  };
  const lo = grid(0), hi = grid(1), I = (b: number, i: number, j: number) => b + j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    idx.push(I(hi, i, j), I(hi, i + 1, j), I(hi, i + 1, j + 1), I(hi, i, j), I(hi, i + 1, j + 1), I(hi, i, j + 1));
    idx.push(I(lo, i, j), I(lo, i + 1, j + 1), I(lo, i + 1, j), I(lo, i, j), I(lo, i, j + 1), I(lo, i + 1, j + 1));
  }
  const rim = (a: [number, number], b: [number, number]) => idx.push(I(lo, ...a), I(lo, ...b), I(hi, ...b), I(lo, ...a), I(hi, ...b), I(hi, ...a));
  for (let i = 0; i < nu; i++) { rim([i + 1, 0], [i, 0]); rim([i, nv], [i + 1, nv]); }
  for (let j = 0; j < nv; j++) { rim([0, j], [0, j + 1]); rim([nu, j + 1], [nu, j]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  // (the faces wind outward on the top; which way is out is checked against the slab's normal, so a mirrored map holds)
  const t = new THREE.Vector3().fromArray(pos, I(hi, nu >> 1, nv >> 1) * 3).sub(new THREE.Vector3().fromArray(pos, I(lo, nu >> 1, nv >> 1) * 3));
  const a = new THREE.Vector3().fromArray(pos, idx[0] * 3), b = new THREE.Vector3().fromArray(pos, idx[1] * 3), c = new THREE.Vector3().fromArray(pos, idx[2] * 3);
  if (b.sub(a).cross(c.sub(a)).dot(t) < 0) for (let i = 0; i < idx.length; i += 3) { const k = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = k; }
  g.setIndex(idx); g.computeVertexNormals(); if (shade) g.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 1)); return g;
}
/** A guard round the front of a limb, `out` times its rings and `off` more (in the limb joint's frame), from y0 down to
 *  y1, flaring a little at its ends. */
function limbGuard(rings: Ring[], y0: number, y1: number, out: number, off: number, arc = 0.72, nu = 20, nv = 10): Geo {
  const pos: number[] = [], idx: number[] = [], th = 0.035, lay = (k: number) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) {
      const y = y0 + (y1 - y0) * j / nv, r = ringAt(rings, y), flare = 1 + 0.08 * (ramp(0.2, 0, j / nv) + ramp(0.8, 1, j / nv));
      for (let i = 0; i <= nu; i++) {
        const a = Math.PI * arc * (2 * i / nu - 1), c = Math.cos(a), w = (r.w * out + off + k * th) * flare, f = ((c >= 0 ? r.f : r.b) * out + off + k * th) * flare;
        pos.push((r.x ?? 0) + w * Math.sin(a), y, (r.z ?? 0) + f * c);
      }
    }
    return base;
  };
  const lo = lay(0), hi = lay(1), I = (b: number, i: number, j: number) => b + j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    idx.push(I(hi, i, j), I(hi, i, j + 1), I(hi, i + 1, j + 1), I(hi, i, j), I(hi, i + 1, j + 1), I(hi, i + 1, j));
    idx.push(I(lo, i, j), I(lo, i + 1, j + 1), I(lo, i, j + 1), I(lo, i, j), I(lo, i + 1, j), I(lo, i + 1, j + 1));
  }
  const rim = (a: [number, number], b: [number, number]) => idx.push(I(lo, ...a), I(hi, ...b), I(lo, ...b), I(lo, ...a), I(hi, ...a), I(hi, ...b));
  for (let i = 0; i < nu; i++) { rim([i, 0], [i + 1, 0]); rim([i + 1, nv], [i, nv]); }
  for (let j = 0; j < nv; j++) { rim([0, j + 1], [0, j]); rim([nu, j], [nu, j + 1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Take off the bands the figure's tunic puts round its chest (the neckband, and with `belt` the belt): a statue or a
 *  body of clay wears neither. */
function stripBands(up: THREE.Object3D | undefined, s: number, belt: boolean): void {
  if (up) for (const c of [...up.children]) {
    const m = c as THREE.Mesh; if (!m.isMesh) continue;
    const b = new THREE.Box3().setFromBufferAttribute(m.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(m.matrix);
    if (b.max.y - b.min.y < 0.25 * s && b.max.x - b.min.x > 0.5 * s && ((belt && b.max.y < 0.6 * s) || b.min.y > 2.0 * s)) up.remove(m);
  }
}
/** Options for the amber statue: its amber, darker amber for its carved grooves, its head (the treasury's hawk, or the
 *  jackal of the temple's other golem) and whether its amber is cracked. */
export interface AmberStatue { amber?: string; groove?: string; head?: 'hawk' | 'jackal'; cracked?: boolean }
/** Carve a posed figure built by heroFigure from `f` into the Amber Temple's golem (see the head of this file). */
export function amberStatue(g: THREE.Group, f: HeroFigure, o: AmberStatue = {}): THREE.Group {
  const J = (g.userData.joints ?? {}) as Joints, up = J.chest, neck = J.neck, head = J.head;
  if (!up || !neck || !head) return g;
  const s = neck.position.y / 2.24, fr = frameFor(f), tr = torsoRings(fr), A = o.amber ?? f.skin ?? '#c0561e', G = o.groove ?? tone(A, '#2a0c02', 0.6);
  const put = (frame: THREE.Object3D | undefined, geo: Geo, c: string, name: string) => { if (!frame) return; geo.scale(s, s, s); const m = new THREE.Mesh(geo, soft(c)); m.name = name; frame.add(m); };
  stripBands(up, s, false);                                                                       // (the collar takes the neckband's place)
  // the beast's head (the hawk's, or the jackal's) in place of the man's, a little larger as a statue's is: the face, its
  // features and the ears come off (what the head carries stays)
  for (const c of [...head.children]) if (!c.userData.joint && !c.name) head.remove(c);
  const jackal = o.head === 'jackal', hm = painted(jackal ? jackalGeo() : hawkGeo(), A, G);
  hm.geometry.scale(1.15 * s, 1.15 * s, 1.15 * s); hm.position.y = -0.1 * s; hm.name = jackal ? 'jackal' : 'hawk'; head.add(hm);   // (set down a little, the headcloth onto the shoulders)
  // the broad collar, from the root of the neck out over the chest to the shoulders, in rows; and the headcloth's lappets
  // falling over it, striped as the headcloth is
  const collar = chestSlab(tr, (u, v) => { const k = 2 * u - 1, x = (0.27 + 0.35 * v) * k, y = (2.2 - 0.42 * v) + (0.05 + 0.2 * v) * k * k; return [x, y]; }, 0.012, 0.05, 32, 15,
    (_u, v) => 0.55 * ramp(0.35, 0.65, Math.abs(((v * 5) % 1) - 0.5) * 2));
  collar.scale(s, s, s); const cm = painted(collar, A, G); cm.name = 'broad-collar'; up.add(cm);
  for (const sx of [-1, 1]) {
    const lap = chestSlab(tr, (u, v) => [sx * (0.34 + (0.1 + 0.02 * v) * (2 * u - 1)), 2.215 - 0.64 * v], 0.065, 0.04, 6, 32, (_u, v) => 0.42 * ramp(0.38, 0.62, Math.abs(((v * 0.64 / 0.07) % 1) - 0.5) * 2));
    lap.scale(s, s, s); const lm = painted(lap, A, G); lm.name = 'lappet'; up.add(lm);
  }
  // guards over the knees and down the shins, standing over the boots' cuffs and straps
  const sr = shinRings(fr);
  for (const sd of ['R', 'L']) {
    const knee = J['knee' + sd]; if (!knee) continue;
    put(knee, limbGuard(sr, -0.12, -1.0, 1.32, 0.012, 1), A, 'greave');
    const cap = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62); cap.rotateX(Math.PI / 2); cap.scale(0.25, 0.2, 0.07); cap.translate(0, -0.02, ringAt(sr, -0.02).f * 0.98); put(knee, cap, A, 'knee-cop');
    // and over the forearms (over the bracers' bands)
    const elbow = J['elbow' + sd]; if (elbow) put(elbow, limbGuard(forearmRings(fr), -0.26, -0.9, 1.22, 0.01, 1), A, 'vambrace');
  }
  // cracks run through damaged amber: dark lines half sunk in its surface, down the chest below the collar, across the
  // belly, and down the right arm
  if (o.cracked) {
    const K = tone(A, '#140400', 0.78), crack = (frame: THREE.Object3D | undefined, pts: THREE.Vector3[]) => {
      if (!frame) return;
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, 0.008, 5, false); tube.scale(s, s, s);
      const m = new THREE.Mesh(tube, soft(K)); m.name = 'crack'; frame.add(m);
    };
    crack(up, [[0.08, 1.72], [0.16, 1.6], [0.12, 1.48], [0.21, 1.33], [0.17, 1.2]].map(([x, y]) => chestFront(tr, x, y)[0]));
    crack(up, [[-0.3, 1.25], [-0.2, 1.18], [-0.24, 1.05], [-0.12, 0.95]].map(([x, y]) => chestFront(tr, x, y)[0]));
    const ua = upperArmRings(fr, SIDE_X.R), onArm = (a: number, y: number) => { const r = ringAt(ua, y), c = Math.cos(a); return new THREE.Vector3((r.x ?? 0) + r.w * Math.sin(a), y, (r.z ?? 0) + (c >= 0 ? r.f : r.b) * c); };
    crack(J.shoulderR, [[-0.2, -0.3], [-0.5, -0.42], [-0.35, -0.56], [-0.7, -0.72], [-0.55, -0.84]].map(([a, y]) => onArm(a, y)));
  }
  return g;
}

// --------------------------------------------------------------------------------------------------------- clay
/** Lumps over a surface: a smooth bumpiness about -1 to 1 (a few waves at odd angles), the same wherever a point is met
 *  again (a loft's seam), so a lumped surface keeps closed. */
const WAVES = [[7.1, 2.3, -4.2, 0.3], [-3.3, 6.4, 5.1, 1.7], [4.6, -5.7, 6.2, 2.9], [-8.3, -1.9, 2.6, 4.1], [2.2, 8.8, -3.9, 5.3], [11.7, 4.4, 7.9, 0.9], [-6.1, 10.3, -9.2, 3.6]];
function lumps(x: number, y: number, z: number, seed = 0): number {
  let v = 0;
  for (let i = 0; i < WAVES.length; i++) { const [a, b, c, p] = WAVES[i], w = i < 5 ? 0.24 : 0.14; v += w * Math.sin(a * x + b * y + c * z + p + seed * (i + 1)); }
  return v;
}
// the head, crude: a tall egg on a thick neck, one heavy ridge for the brows, eyes pressed in with the thumbs under it, a
// nose pinched out of the clay, a slit for a mouth
function clayHead(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(x, y - 0.41, z - 0.015, 0.2, 0.245, 0.195);                                  // the skull
  d = smin(d, ell(x, y - 0.25, z - 0.03, 0.185, 0.14, 0.18), 0.09);                        // the jaw
  d = smin(d, ell(x, y + 0.03, z + 0.01, 0.17, 0.34, 0.17), 0.2);                          // the neck, the back of the skull run into it, its foot down in the shoulders
  d = smin(d, ell(x, y + 0.25, z + 0.03, 0.28, 0.11, 0.25), 0.12);                         // (spread there, over the top of the trunk)
  d = smin(d, ell(x, y - 0.445, z - 0.17, 0.17, 0.042, 0.06), 0.04);                       // the brow ridge
  d = smin(d, taper(x / 0.6, y, z, [[0, 0.43, 0.2], [0, 0.335, 0.25]], [0.03, 0.034]) * 0.6, 0.03);   // the nose
  d = smax(d, -ell(ax - 0.078, y - 0.392, z - 0.215, 0.046, 0.04, 0.05), 0.015);         // the eyes, thumbed in
  d = smax(d, -(toLine(x, y, z, [-0.075, 0.268, 0.205], [0.075, 0.272, 0.21]) - 0.011), 0.01);   // the mouth
  return d + 0.007 * lumps(x * 3, y * 3, z * 3, 0.5);
}
/** How dark the clay is at a point of the head: down in the eyes and the mouth, and the sigil pressed into the brow. */
function clayShade(x: number, y: number, z: number): number {
  const ax = Math.abs(x), sigil = Math.min(toLine(x, y, 0, [-0.045, 0.6, 0], [0, 0.56, 0]), toLine(x, y, 0, [0.045, 0.6, 0], [0, 0.56, 0]), toLine(x, y, 0, [0, 0.56, 0], [0, 0.505, 0]));
  return Math.max(
    0.9 * ramp(-0.002, -0.012, ell(ax - 0.078, y - 0.392, z - 0.215, 0.046, 0.04, 0.05)),            // down in the eyes
    0.7 * ramp(0.018, 0.01, toLine(x, y, z, [-0.075, 0.268, 0.205], [0.075, 0.272, 0.21])),          // the mouth
    z > 0.1 ? 0.75 * ramp(0.016, 0.008, sigil) : 0,                                                    // the sigil
    0.12 * Math.max(0, lumps(x * 5, y * 5, z * 5, 2.1)));
}
let CLAY_HEAD: Geo | undefined;
const clayHeadGeo = () => (CLAY_HEAD ??= nets(clayHead, [-0.3, -0.38, -0.3], [0.3, 0.7, 0.34], 0.012, clayShade));

/** Options for a clay golem: its clay, and the dark of what is pressed into it. */
export interface ClayBody { clay?: string; dark?: string; seed?: number }
/** Make a posed figure built by heroFigure from `f` a clay golem (see the head of this file). */
export function clayBody(g: THREE.Group, f: HeroFigure, o: ClayBody = {}): THREE.Group {
  const J = (g.userData.joints ?? {}) as Joints, head = J.head, neck = J.neck;
  if (!head || !neck) return g;
  const s = neck.position.y / 2.24, C = o.clay ?? f.skin ?? '#94664a', D = o.dark ?? tone(C, '#1a0e08', 0.65), seed = o.seed ?? 0;
  stripBands(J.chest, s, true);                                                                  // (a clay body wears nothing)
  // the crude head in place of the man's, moulded in one with its thick neck (the man's face, features and ears come off,
  // and his neck, whose top would stand out behind the clay; what the head carries stays)
  for (const c of [...head.children]) if (!c.userData.joint && !c.name) head.remove(c);
  for (const c of [...neck.children]) if ((c as THREE.Mesh).isMesh && !c.name) neck.remove(c);
  const hm = painted(clayHeadGeo(), C, D); hm.geometry.scale(1.1 * s, 1.1 * s, 1.1 * s); hm.name = 'clay'; head.add(hm);
  // then the whole of it worked over by hand: every point pushed by one smooth sway laid over the figure as it stands,
  // each as the points beside it are whatever part it is on, so the parts stay joined, the seams closed and one layer of
  // the body over the next as they were (a finger is carried along, not crushed)
  g.updateMatrixWorld(true);
  const amp = 0.03 * s, k = 1.6 / s, p = new THREE.Vector3(), d = new THREE.Vector3(), nm = new THREE.Vector3(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), into = new THREE.Matrix4(), back = new THREE.Matrix4();
  g.traverse((c) => {
    const m = c as THREE.Mesh; if (!m.isMesh || (m.material as THREE.Material).transparent) return;
    const geo = m.geometry.clone(), pos = geo.getAttribute('position') as THREE.BufferAttribute;
    into.multiplyMatrices(inv, m.matrixWorld); back.copy(into).invert();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(into); const x = p.x * k, y = p.y * k, z = p.z * k;
      d.set(lumps(x, y, z, seed), lumps(y, z, x, seed + 1.3), lumps(z, x, y, seed + 2.9)).multiplyScalar(amp);
      p.add(d).applyMatrix4(back); pos.setXYZ(i, p.x, p.y, p.z);
    }
    // (shaded smooth across a loft's seam: one normal for each point however often the surface meets it)
    geo.computeVertexNormals(); const nr = geo.getAttribute('normal') as THREE.BufferAttribute, at = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`, sum = new Map<string, THREE.Vector3>();
    for (let i = 0; i < pos.count; i++) { const key = at(i); let v = sum.get(key); if (!v) sum.set(key, (v = new THREE.Vector3())); v.add(nm.fromBufferAttribute(nr, i)); }
    for (let i = 0; i < pos.count; i++) { nm.copy(sum.get(at(i))!).normalize(); nr.setXYZ(i, nm.x, nm.y, nm.z); }
    m.geometry = geo;
  });
  return g;
}

// ------------------------------------------------------------------------------------------------------- stitched
/** Options for a body stitched together from others' parts: the thread, the parts grafted on in other skins, iron staples
 *  across the seams, and whether the work is fine (a bride's, the seams seen only up close) or coarse (a brute's). */
export interface Stitched {
  thread?: string; staples?: string; fine?: boolean;
  /** A forearm and hand, or a shin and foot, from someone else: its skin. */
  grafts?: { forearmR?: string; forearmL?: string; shinR?: string; shinL?: string };
  /** Seams round the tops of the arms too (bare shoulders). */
  shoulders?: boolean;
}
/** A seam round a limb at a height of its rings (in its joint's frame, the figure's units): the thread along it and the
 *  stitches across it, every so often an iron staple instead. */
function seam(r: Ring, fine: boolean, thread: Geo[], iron: Geo[] | undefined, seed: number): void {
  const at = (a: number, lift: number) => { const c = Math.cos(a), d = c >= 0 ? r.f : r.b; return new THREE.Vector3((r.x ?? 0) + (r.w + lift) * Math.sin(a), r.y, (r.z ?? 0) + (d + lift) * c); };
  const lift = fine ? 0.003 : 0.006, N = 48, pts: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) pts.push(at((i / N) * Math.PI * 2, lift));
  thread.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), N, fine ? 0.0035 : 0.007, 4, true));
  const per = Math.PI * (r.w + (r.f + r.b) / 2), n = Math.max(8, Math.round(per / (fine ? 0.045 : 0.07))), len = fine ? 0.035 : 0.075, th = fine ? 0.005 : 0.011;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2, p = at(a, lift + th * 0.3), nm = new THREE.Vector3(Math.sin(a) / r.w, 0, Math.cos(a) / (Math.cos(a) >= 0 ? r.f : r.b)).normalize();
    const staple = !!iron && !fine && (i + seed) % 5 === 0, tilt = (i % 2 ? 0.35 : -0.35) * (staple ? 0 : 1), y = new THREE.Vector3(0, 1, 0).applyAxisAngle(nm, tilt), x = new THREE.Vector3().crossVectors(y, nm).normalize();
    const b = staple ? new THREE.BoxGeometry(0.03, len * 1.5, 0.02) : new THREE.BoxGeometry(th, len, th);
    b.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, nm).setPosition(p.addScaledVector(nm, staple ? 0.006 : 0)));
    (staple ? iron! : thread).push(b);
  }
}
const flatten = (gs: Geo[]) => mergeGeometries(gs.map((x) => { const y = x.index ? x.toNonIndexed() : x.clone(); for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k); return y; }))!;
/** Stitch a posed figure built by heroFigure from `f` together out of others' parts (see the head of this file). */
export function stitched(g: THREE.Group, f: HeroFigure, o: Stitched = {}): THREE.Group {
  const J = (g.userData.joints ?? {}) as Joints, neck = J.neck; if (!neck) return g;
  const s = neck.position.y / 2.24, fr = frameFor(f), fine = !!o.fine, skin = new THREE.Color(f.skin ?? '#d9b899').getHexString();
  const T = o.thread ?? (fine ? tone(f.skin ?? '#d9b899', '#6a3a3a', 0.35) : '#2a1a14'), I = o.staples;
  const sew = (frame: THREE.Object3D | undefined, rings: Ring[], ys: number[], seed: number) => {
    if (!frame) return; const thread: Geo[] = [], iron: Geo[] = [];
    for (const y of ys) seam(ringAt(rings, y), fine, thread, I ? iron : undefined, seed);
    for (const [gs, c] of [[thread, T], [iron, I]] as const) if (gs.length && c) { const geo = flatten(gs); geo.scale(s, s, s); const m = new THREE.Mesh(geo, soft(c)); m.name = 'seam'; frame.add(m); }
  };
  /** Put a limb's flesh (the joint's own meshes in the skin's colour, down through the joints below it) in another's skin. */
  const graft = (frame: THREE.Object3D | undefined, c: string | undefined) => {
    if (!frame || !c) return; const m2 = soft(c);
    frame.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && m.name !== 'seam' && (m.material as THREE.MeshLambertMaterial).color?.getHexString() === skin) m.material = m2; });
  };
  // the neck, round its middle; the wrists; a forearm or a shin from someone else, seamed where it was put on
  sew(neck, neckRings(fr), [0.16], 1);
  for (const sd of ['R', 'L'] as const) {
    const elbow = J['elbow' + sd], knee = J['knee' + sd], fa = forearmRings(fr), wrist = fa[0].y * 0.9, other = o.grafts?.[`forearm${sd}`], leg = o.grafts?.[`shin${sd}`];
    graft(elbow, other); graft(knee, leg);
    // (a grafted forearm's seam just below the sleeve's rolled cuff, where its skin starts)
    sew(elbow, fa, other ? [wrist, fa[0].y * 0.32] : [wrist], sd === 'R' ? 2 : 3);
    if (leg) sew(knee, shinRings(fr), [-0.72], sd === 'R' ? 4 : 0);
    if (o.shoulders) sew(J['shoulder' + sd], upperArmRings(fr, SIDE_X[sd]), [-0.2], 1);
  }
  return g;
}
