// Hairdos beyond the figure rig's four standard styles, for characters whose hair is part of who they are. The rig's own
// hair (kit/heroes.ts buildHair) stays the default; a recipe's `hairdo` replaces it. Built in the head's own units (skull
// radius 0.4 at scale 1, the same skull the faces use) from an under-layer cut at the hairline and tapering locks.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { lockGeometry } from './anatomy';
import { hairSkull, browLift, weld, type FaceSpec } from './faces';

export interface Hairdo {
  /** swept: combed straight back from the brow to the collar. bun: drawn back to a knot at the crown. tonsure: a ring
   *  round a bald pate. wild: long, uncombed, hanging in ropes. voodoo: matted hair bound up into a tall leaning spire
   *  with cord, tufts bristling from its foot, and heavy braids hung with bone charms. crop: cut short, close at the sides
   *  and back and fuller on top, combed back from a parting in broad sculpted locks (the standard short hair). */
  style: 'swept' | 'bun' | 'tonsure' | 'wild' | 'voodoo' | 'crop';
  /** crop: where the parting sits, -1 (the figure's right) to 1 (its left), 0 for none. */
  part?: number;
  /** A peak at the centre of the hairline, and how far the temples have receded (0 to 1). */
  peak?: boolean; recede?: number;
  /** Streaks at the temples (a colour); how far the hair falls past the nape, in head heights (swept, wild). */
  temples?: string; length?: number;
}

const soft = (c: string, double = false): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: double ? '#020302' : '#030303' }); m.userData.smooth = true; if (double) m.side = THREE.DoubleSide; return m; };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
/** A lighter strand, mixed toward white in display space: a mix in linear space lifts dark colours far more than light ones,
 *  which turned every third lock of black hair grey; this keeps a faint sheen at every shade. */
export const sheen = (c: string, k: number): string => {
  const o = { r: 0, g: 0, b: 0 }; new THREE.Color(c).getRGB(o, THREE.SRGBColorSpace);
  return '#' + new THREE.Color().setRGB(o.r + (1 - o.r) * k, o.g + (1 - o.g) * k, o.b + (1 - o.b) * k, THREE.SRGBColorSpace).getHexString();
};
const R = 0.4;

/** The hairdo as a group to add to the head joint: `s` is the figure's scale, `hy` the head centre's height in the joint,
 *  `detail` (1 to 4) how many locks it is combed into. */
export function hairdo(h: Hairdo, color: string, s: number, hy: number, detail = 2, face: FaceSpec = {}): THREE.Group {
  const g = new THREE.Group(), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), cr = hairSkull(face), lift0 = browLift(face);
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const dir = (az: number, el: number) => { const c = Math.cos(el); return V(Math.sin(az) * c, Math.sin(el), Math.cos(az) * c); };
  const onScalp = (d: THREE.Vector3, lift = 1.06) => { const [x, y, z] = cr(d.x * 0.84 * lift, d.y * 1.14 * lift, d.z * (d.z < 0 ? 0.99 : 0.94) * lift); return V(x * R * s, hy + y * R * s, z * R * s); };
  const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const recede = h.recede ?? 0, top = h.style === 'tonsure' ? 0.95 : Math.PI / 2;
  // the hairline's elevation at each azimuth: the brow, the temples, over the ears, down to the nape
  const line = (az: number) => {
    const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az)));
    const base = a < 0.8 ? 0.8 + 0.07 * Math.sin(Math.max(0, a - 0.25) * Math.PI / 0.55) : a < 1.3 ? 0.8 - 0.72 * (a - 0.8) / 0.5 : a < 1.8 ? 0.08 + 0.1 * Math.sin((a - 1.3) * Math.PI / 0.5) : 0.08 - 0.58 * Math.min(1, (a - 1.8) / 0.6);
    return base + lift0 * smooth(1.25, 0.4, a) - (h.peak ? 0.16 * Math.exp(-((a / 0.13) ** 2)) : 0) + recede * 0.22 * Math.exp(-(((a - 0.5) / 0.22) ** 2));
  };
  // the under-layer: the skull's shape, a little proud, cut at the hairline (and at the pate for a tonsure)
if (h.style !== 'crop' && h.style !== 'swept') {
  const cg = new THREE.SphereGeometry(1, 48, 30), cp = cg.attributes.position as THREE.BufferAttribute, keep: boolean[] = [];
  for (let i = 0; i < cp.count; i++) {
    const d = V(cp.getX(i), cp.getY(i), cp.getZ(i)), az = Math.atan2(d.x, d.z), el = Math.asin(Math.max(-1, Math.min(1, d.y)));
    keep.push(el > line(az) - 0.04 && el < top);
    const q = onScalp(d, 1.04 + 0.01 * Math.sin(az * 24 + el * 6)); cp.setXYZ(i, q.x, q.y, q.z);
  }
  const src = cg.index!, idx: number[] = []; for (let i = 0; i < src.count; i += 3) { const a = src.getX(i), b = src.getX(i + 1), c = src.getX(i + 2); if (keep[a] && keep[b] && keep[c]) idx.push(a, b, c); }
  cg.setIndex(idx); cg.computeVertexNormals(); g.add(new THREE.Mesh(cg, soft(tone(color, '#000000', 0.2), true)));
  }
  const shade = (i: number) => i % 3 === 0 ? sheen(color, 0.09) : i % 3 === 1 ? color : tone(color, '#000000', 0.16);
  const lock = (pts: THREE.Vector3[], r0: number, r1: number, i: number, c?: string, flat = 0.45) => g.add(new THREE.Mesh(lockGeometry(pts, r0 * s, r1 * s, flat, 6, 0.3), soft(c ?? shade(i), true)));
  /** A lock laid over the skull from one direction to another along the shortest way round, with a little body. */
  const laid = (from: THREE.Vector3, to: THREE.Vector3, n: number, body: number): THREE.Vector3[] => {
    const q = new THREE.Quaternion().setFromUnitVectors(from, to), out: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) { const t = k / n; out.push(onScalp(from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)), 1.07 + body * Math.sin(Math.PI * Math.min(1, t * 1.15)))); }
    return out;
  };
  /** One sculpted mass over the skull, as a miniature's hair is: its edge sinks into the scalp, so the hairline is the line
   *  where hair meets skin (scalloped at the front by `scallop`), and its locks are grooves combed into it, running back
   *  from the brow (and from a parting at `part`, -0.45 to 0.45). `base`, `top` and `brow` are its thickness all over, on
   *  the crown and lifting off the forehead; `freq` and `groove` the locks' count and depth; grooves start at elevation
   *  `grooveFrom`. */
  const sculpt = (o: { part?: number; scallop: number; base: number; top: number; brow: number; freq: number; groove: number; grooveFrom: number }) => {
    const pa = o.part ?? 0, seg = [64, 96, 112, 128][detail - 1], rows = [44, 60, 70, 80][detail - 1];
    const mg = new THREE.SphereGeometry(1, seg, rows), mp = mg.attributes.position as THREE.BufferAttribute, keepM: boolean[] = [];
    for (let i = 0; i < mp.count; i++) {
      const d = V(mp.getX(i), mp.getY(i), mp.getZ(i)), az = Math.atan2(d.x, d.z), a = Math.abs(az), el = Math.asin(Math.max(-1, Math.min(1, d.y)));
      const tips = 0.5 + 0.5 * Math.sin(az * 12 + 1.3 * Math.sin(az * 5)), edge = line(az) + o.scallop * smooth(0.9, 0.3, a) * (tips - 0.5) - 0.01, inner = smooth(edge, edge + 0.25, el);
      keepM.push(el > edge - 0.16);
      const top = smooth(0.3, 1.3, el), brow = smooth(1.1, 0.15, a) * smooth(0.5, 0.95, el) * smooth(1.5, 1.05, el);
      const comb = Math.atan2(d.x, d.y + 0.45), partDip = o.part === undefined ? 0 : Math.exp(-(((comb - pa) / 0.045) ** 2)) * smooth(0.55, 1.05, el) * smooth(-0.55, 0.25, d.z);
      // the locks: rounded ridges with sharp grooves between, combed back from the parting
      const ridge = Math.abs(Math.sin((comb - pa) * o.freq + 0.45 * Math.sin(el * 4 + comb * 3))) ** 0.55, groove = o.groove * (ridge - 0.7) * inner * smooth(o.grooveFrom, o.grooveFrom + 0.5, el);
      const t = (0.012 + (o.base + o.top * top + o.brow * brow) * inner + groove - 0.04 * partDip * inner) / R;
      const under = smooth(edge - 0.1, edge + 0.08, el);
      const q = onScalp(d, 0.97 + (0.03 + t) * under); mp.setXYZ(i, q.x, q.y, q.z);
    }
    const mi = mg.index!, mIdx: number[] = []; for (let i = 0; i < mi.count; i += 3) { const a = mi.getX(i), b = mi.getX(i + 1), c = mi.getX(i + 2); if (keepM[a] && keepM[b] && keepM[c]) mIdx.push(a, b, c); }
    mg.setIndex(mIdx); g.add(new THREE.Mesh(weld(mg), soft(color)));
  };
  const N = [14, 22, 30, 40][detail - 1];
  if (h.style === 'swept') {
    // combed straight back, sleek and close, a little lift off the brow and fine grooves running back to the nape; what
    // length there is falls from under it at the back and turns out at the collar
    sculpt({ scallop: 0, base: 0.02, top: 0.028, brow: 0.04, freq: 12, groove: 0.013, grooveFrom: -0.55 });
    const len = (h.length ?? 0.25) * R * 2.3 * s, M = Math.max(6, Math.round(N * 0.6));
    if (len > 0.06 * s) for (let i = 0; i < M; i++) {
      const u = i / (M - 1) * 2 - 1, az = Math.PI + u * 1.35, root = dir(az, line(az) + 0.12), e = onScalp(dir(az, line(az) - 0.02), 1.0 + 0.04 * Math.cos(u * 1.6));
      const L = len * (0.8 + 0.3 * rnd()) * (1 - 0.35 * Math.abs(u)), out = 1.06 + 0.06 * rnd();
      lock([onScalp(root, 0.99), e, V(e.x * out, e.y - L * 0.55, e.z * out - 0.02 * s), V(e.x * (out + 0.06), e.y - L, e.z * out - (0.05 + 0.04 * rnd()) * s)], 0.06 + 0.012 * rnd(), 0.016, i);
    }
    if (h.temples) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const az = sx * (0.75 + 0.14 * k), from = dir(az, line(az) + 0.02); lock(laid(from, dir(Math.PI - sx * 0.9, -0.2 - 0.05 * k), 6, 0.02), 0.035, 0.012, k, h.temples); }
  } else if (h.style === 'bun') {
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1) * 2 - 1, az = u * 1.95, a = Math.abs(az), from = dir(az, line(az) + 0.03);
      const knot = dir(Math.PI + u * 0.25, 0.45); rnd(); // (the draw the swept ends once took, so each lock keeps its look)
      const pts = laid(from, knot, 6, 0.045 + 0.02 * rnd());
      lock(pts, 0.05 + 0.012 * rnd(), 0.014, i, h.temples && a > 0.55 && a < 1.25 ? h.temples : undefined);
    }
    { const c = onScalp(dir(Math.PI, 0.45), 1.3); for (let i = 0; i < Math.max(8, N / 2); i++) { const a0 = i * 0.8, pts: THREE.Vector3[] = []; for (let k = 0; k <= 6; k++) { const a = a0 + k * 0.55, rr = (0.12 - 0.008 * k) * s; pts.push(V(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, c.z - (0.02 + 0.012 * k) * s + 0.03 * s * Math.sin(a * 2))); } lock(pts, 0.045, 0.03, i, undefined, 0.6); } }
  } else if (h.style === 'tonsure') {
    for (let i = 0; i < N; i++) { const az = 0.9 + (i / (N - 1)) * (2 * Math.PI - 1.8), from = dir(az, 0.9), to = dir(az + 0.15, Math.max(line(az) - 0.02, -0.3)); lock(laid(from, to, 4, 0.03), 0.05, 0.02, i); }
  } else if (h.style === 'crop') {
    // the standard short hair: thin over the sides and back, fuller on top, lifting off the brow, combed back from the
    // parting in broad locks, the hairline scalloped a little at the front
    const vol = h.length ?? 0.5;
    sculpt({ part: (h.part ?? 0.35) * 0.45, scallop: 0.05, base: 0.03, top: 0.085 * vol, brow: 0.06 * vol, freq: 8.5, groove: 0.022 + 0.012 * vol, grooveFrom: 0 });
  } else if (h.style === 'voodoo') {
    const tall = (h.length ?? 1.3) * R * 2.3 * s, tip = V(0, onScalp(V(0, 1, 0), 1).y + tall, -0.2 * s), bone = '#d8d0b4', cord = '#6a2420';
    // the spire: matted ropes drawn up from all round the hairline to a point, bulging where the cord bites
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 + 0.15 * rnd(), from = dir(az, Math.max(line(az), -0.25) + 0.04), root = onScalp(from, 1.08), crown = onScalp(dir(az, 1.0), 1.22);
      const sw = 0.5 + 0.2 * rnd(), mid = V(crown.x * (1.02 + 0.14 * rnd()), crown.y + tall * 0.28, crown.z * 1.05 - 0.06 * s), hi = V(crown.x * sw, crown.y + tall * 0.62, crown.z * sw - 0.14 * s);
      lock([root, onScalp(dir(az, 0.55), 1.14), crown, mid, hi, V(tip.x + (rnd() - 0.5) * 0.05 * s, tip.y - 0.1 * tall * rnd(), tip.z)], 0.075 + 0.02 * rnd(), 0.02, i, undefined, 0.7);
    }
    for (const [t, r] of [[0.14, 0.33], [0.5, 0.23], [0.8, 0.11]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * s, 0.022 * s, 6, 18), soft(cord)); ring.rotation.x = Math.PI / 2 - 0.12; ring.position.set(0, onScalp(V(0, 1, 0), 1).y + tall * t, -(0.02 + 0.18 * t) * s); g.add(ring); }
    // tufts that got away from the cord, bristling out and up at the foot of the spire
    for (let i = 0; i < Math.round(N * 0.7); i++) {
      const az = (i / Math.round(N * 0.7)) * Math.PI * 2 + 0.3 * rnd(), a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))); if (a < 0.5) continue;
      const b = onScalp(dir(az, 0.5 + 0.4 * rnd()), 1.12), o = 1.5 + 0.5 * rnd(), up = (0.1 + 0.25 * rnd()) * s;
      lock([b, V(b.x * 1.25, b.y + up * 0.5, b.z * 1.25), V(b.x * o, b.y + up, b.z * o)], 0.035, 0.004, i, undefined, 0.8);
    }
    // the braids: thick ropes down past the collar bones, front and back, each ending in a bone
    const braids: [number, number][] = [[0.95, 1.5], [-0.95, 1.5], [1.3, 1.2], [-1.3, 1.2], [1.9, 1.1], [-1.9, 1.1], [2.6, 1.3], [-2.6, 1.3]];
    braids.forEach(([az, L], i) => {
      const b = onScalp(dir(az, Math.max(line(az), -0.1) + 0.12), 1.1), len = L * R * 2.3 * s, fwd = Math.cos(az) > 0 ? 0.1 * s : -0.06 * s, pts = [onScalp(dir(az * 0.8, 0.9), 1.12), b];
      for (let k = 1; k <= 5; k++) { const t = k / 5; pts.push(V(b.x * (1.12 + 0.22 * t) + 0.012 * s * Math.sin(k * 2.4 + i), b.y - len * t, b.z + fwd * Math.sin(t * Math.PI * 0.6))); }
      lock(pts, 0.052, 0.03, i, undefined, 0.85);
      const e = pts[pts.length - 1];
      for (let k = 1; k <= 3; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.04 * s, 0.012 * s, 5, 10), soft(k === 2 ? bone : cord)); band.rotation.x = Math.PI / 2; const q = pts[1 + k]; band.position.copy(q); g.add(band); }
      const charm = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.16 * s, 5), soft(bone)); charm.rotation.x = Math.PI; charm.position.set(e.x, e.y - 0.09 * s, e.z); g.add(charm);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.042 * s, 8, 6), soft(tone(bone, '#000000', 0.12))); knob.position.set(e.x, e.y - 0.005 * s, e.z); g.add(knob);
    });
  } else {
    const len = (h.length ?? 1.6) * R * 2.3 * s;
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 + 0.2 * rnd(), a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))); if (a < 0.45) continue;                   // the face stays clear
      const pts = laid(dir(0.3 * Math.sin(az), 1.45), dir(az, Math.max(line(az), -0.1) + 0.05), 4, 0.05 + 0.03 * rnd()), e = pts[pts.length - 1], L = len * (0.6 + 0.5 * rnd());
      const out = 1 + 0.25 * rnd(), wob = (rnd() - 0.5) * 0.16 * s;
      pts.push(V(e.x * out, e.y - L * 0.35, e.z * out + wob), V(e.x * out * 1.08 - wob, e.y - L * 0.7, e.z * out * 1.05), V(e.x * out * 1.02 + wob, e.y - L, e.z * out * 1.1 - 0.05 * s));
      lock(pts, 0.04 + 0.02 * rnd(), 0.008, i, h.temples && a < 1.2 ? h.temples : undefined, 0.6);
    }
  }
  return g;
}
