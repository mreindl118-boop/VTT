// Hairdos beyond the figure rig's four standard styles, for characters whose hair is part of who they are. The rig's own
// hair (kit/heroes.ts buildHair) stays the default; a recipe's `hairdo` replaces it. Built in the head's own units (skull
// radius 0.4 at scale 1, the same skull the faces use) from an under-layer cut at the hairline and tapering locks.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { lockGeometry } from './anatomy';

export interface Hairdo {
  /** swept: combed straight back from the brow to the collar. bun: drawn back to a knot at the crown. tonsure: a ring
   *  round a bald pate. wild: long, uncombed, hanging in ropes. voodoo: matted hair bound up into a tall leaning spire
   *  with cord, tufts bristling from its foot, and heavy braids hung with bone charms. */
  style: 'swept' | 'bun' | 'tonsure' | 'wild' | 'voodoo';
  /** A peak at the centre of the hairline, and how far the temples have receded (0 to 1). */
  peak?: boolean; recede?: number;
  /** Streaks at the temples (a colour); how far the hair falls past the nape, in head heights (swept, wild). */
  temples?: string; length?: number;
}

const soft = (c: string, double = false): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: double ? '#020302' : '#030303' }); m.userData.smooth = true; if (double) m.side = THREE.DoubleSide; return m; };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const R = 0.4;

/** The hairdo as a group to add to the head joint: `s` is the figure's scale, `hy` the head centre's height in the joint,
 *  `detail` (1 to 4) how many locks it is combed into. */
export function hairdo(h: Hairdo, color: string, s: number, hy: number, detail = 2): THREE.Group {
  const g = new THREE.Group(), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const dir = (az: number, el: number) => { const c = Math.cos(el); return V(Math.sin(az) * c, Math.sin(el), Math.cos(az) * c); };
  const onScalp = (d: THREE.Vector3, lift = 1.06) => V(d.x * 0.84 * R * lift * s, hy + d.y * 1.14 * R * lift * s, d.z * (d.z < 0 ? 0.99 : 0.94) * R * lift * s);
  const recede = h.recede ?? 0, top = h.style === 'tonsure' ? 0.95 : Math.PI / 2;
  // the hairline's elevation at each azimuth: the brow, the temples, over the ears, down to the nape
  const line = (az: number) => {
    const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az)));
    const base = a < 0.8 ? 0.8 + 0.07 * Math.sin(Math.max(0, a - 0.25) * Math.PI / 0.55) : a < 1.3 ? 0.8 - 0.72 * (a - 0.8) / 0.5 : a < 1.8 ? 0.08 + 0.1 * Math.sin((a - 1.3) * Math.PI / 0.5) : 0.08 - 0.58 * Math.min(1, (a - 1.8) / 0.6);
    return base - (h.peak ? 0.16 * Math.exp(-((a / 0.13) ** 2)) : 0) + recede * 0.22 * Math.exp(-(((a - 0.5) / 0.22) ** 2)) + (h.style === 'tonsure' && a < 1.2 ? 0.0 : 0);
  };
  // the under-layer: the skull's shape, a little proud, cut at the hairline (and at the pate for a tonsure)
  const cg = new THREE.SphereGeometry(1, 48, 30), cp = cg.attributes.position as THREE.BufferAttribute, keep: boolean[] = [];
  for (let i = 0; i < cp.count; i++) {
    const d = V(cp.getX(i), cp.getY(i), cp.getZ(i)), az = Math.atan2(d.x, d.z), el = Math.asin(Math.max(-1, Math.min(1, d.y)));
    keep.push(el > line(az) - 0.04 && el < top);
    const q = onScalp(d, 1.04 + 0.01 * Math.sin(az * 24 + el * 6)); cp.setXYZ(i, q.x, q.y, q.z);
  }
  const src = cg.index!, idx: number[] = []; for (let i = 0; i < src.count; i += 3) { const a = src.getX(i), b = src.getX(i + 1), c = src.getX(i + 2); if (keep[a] && keep[b] && keep[c]) idx.push(a, b, c); }
  cg.setIndex(idx); cg.computeVertexNormals(); g.add(new THREE.Mesh(cg, soft(tone(color, '#000000', 0.2), true)));
  const shade = (i: number) => i % 3 === 0 ? tone(color, '#ffffff', 0.09) : i % 3 === 1 ? color : tone(color, '#000000', 0.16);
  const lock = (pts: THREE.Vector3[], r0: number, r1: number, i: number, c?: string, flat = 0.45) => g.add(new THREE.Mesh(lockGeometry(pts, r0 * s, r1 * s, flat, 6, 0.3), soft(c ?? shade(i), true)));
  /** A lock laid over the skull from one direction to another along the shortest way round, with a little body. */
  const laid = (from: THREE.Vector3, to: THREE.Vector3, n: number, body: number): THREE.Vector3[] => {
    const q = new THREE.Quaternion().setFromUnitVectors(from, to), out: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) { const t = k / n; out.push(onScalp(from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)), 1.07 + body * Math.sin(Math.PI * Math.min(1, t * 1.15)))); }
    return out;
  };
  const N = [14, 22, 30, 40][detail - 1];
  if (h.style === 'swept' || h.style === 'bun') {
    const len = (h.length ?? 0.25) * R * 2.3 * s;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1) * 2 - 1, az = u * 1.95, a = Math.abs(az), from = dir(az, line(az) + 0.03);
      const knot = dir(Math.PI + u * 0.25, 0.45), nape = dir(Math.PI - u * 0.75, -0.42 - 0.08 * rnd());
      const pts = laid(from, h.style === 'bun' ? knot : nape, 6, 0.045 + 0.02 * rnd());
      if (h.style === 'swept') { const e = pts[pts.length - 1]; pts.push(V(e.x * 1.04, e.y - len * 0.6, e.z - 0.03 * s), V(e.x * 1.1, e.y - len, e.z - (0.07 + 0.04 * rnd()) * s)); }   // the ends curl out at the collar
      lock(pts, 0.05 + 0.012 * rnd(), 0.014, i, h.temples && a > 0.55 && a < 1.25 ? h.temples : undefined);
    }
    if (h.style === 'bun') { const c = onScalp(dir(Math.PI, 0.45), 1.3); for (let i = 0; i < Math.max(8, N / 2); i++) { const a0 = i * 0.8, pts: THREE.Vector3[] = []; for (let k = 0; k <= 6; k++) { const a = a0 + k * 0.55, rr = (0.12 - 0.008 * k) * s; pts.push(V(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, c.z - (0.02 + 0.012 * k) * s + 0.03 * s * Math.sin(a * 2))); } lock(pts, 0.045, 0.03, i, undefined, 0.6); } }
  } else if (h.style === 'tonsure') {
    for (let i = 0; i < N; i++) { const az = 0.9 + (i / (N - 1)) * (2 * Math.PI - 1.8), from = dir(az, 0.9), to = dir(az + 0.15, Math.max(line(az) - 0.02, -0.3)); lock(laid(from, to, 4, 0.03), 0.05, 0.02, i); }
  } else if (h.style === 'voodoo') {
    const tall = (h.length ?? 1.3) * R * 2.3 * s, tip = V(0, hy + 1.14 * R * s + tall, -0.2 * s), bone = '#d8d0b4', cord = '#6a2420';
    // the spire: matted ropes drawn up from all round the hairline to a point, bulging where the cord bites
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 + 0.15 * rnd(), from = dir(az, Math.max(line(az), -0.25) + 0.04), root = onScalp(from, 1.08), crown = onScalp(dir(az, 1.0), 1.22);
      const sw = 0.5 + 0.2 * rnd(), mid = V(crown.x * (1.02 + 0.14 * rnd()), crown.y + tall * 0.28, crown.z * 1.05 - 0.06 * s), hi = V(crown.x * sw, crown.y + tall * 0.62, crown.z * sw - 0.14 * s);
      lock([root, onScalp(dir(az, 0.55), 1.14), crown, mid, hi, V(tip.x + (rnd() - 0.5) * 0.05 * s, tip.y - 0.1 * tall * rnd(), tip.z)], 0.075 + 0.02 * rnd(), 0.02, i, undefined, 0.7);
    }
    for (const [t, r] of [[0.14, 0.33], [0.5, 0.23], [0.8, 0.11]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * s, 0.022 * s, 6, 18), soft(cord)); ring.rotation.x = Math.PI / 2 - 0.12; ring.position.set(0, hy + 1.14 * R * s + tall * t, -(0.02 + 0.18 * t) * s); g.add(ring); }
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
