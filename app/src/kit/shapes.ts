// The small shape helpers every site module used to declare for itself (kit/sites/*.ts, props.ts), in one place: the
// copies deleted from the sites were textually identical to these, modulo parameter names. Feet; a mesh sits at its
// own centre; +z is plan south. Every material comes from mat() so fog, grain and the cutaway apply.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { merge } from './pieces';
import type { Surface } from './surfaces';

export type P2 = [number, number];
export type Dims = Record<string, number>;

/** A group of the given children. */
export const grp = (...m: THREE.Object3D[]): THREE.Group => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
/** Position and turn an object (ry about the vertical axis), returning it. */
export const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
export const rot = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.rotation.set(x, y, z); return o; };
export const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): THREE.Mesh =>
  place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)), x, y, z, ry, rx, rz);
/** A cylinder helper whose default segment count is `seg` (the sites differ only in that default). */
export const cylWith = (seg: number) => (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, s = seg): THREE.Mesh =>
  place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat(color)), x, y, z);
export const cyl = cylWith(8);
/** A cone helper whose default segment count is `seg`. */
export const coneWith = (seg: number) => (r: number, h: number, color: string, x = 0, y = 0, z = 0, s = seg): THREE.Mesh =>
  place(new THREE.Mesh(new THREE.ConeGeometry(r, h, s), mat(color)), x, y, z);
export const cone = coneWith(6);
export const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0): THREE.Mesh =>
  place(new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)), x, y, z);

/** Deterministic noise in [0, 1) from an index and a seed (the wilderness sites' hash). */
export const hash = (i: number, s = 0): number => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/** A faceted lump (rock, billow): an icosahedron with its vertices pushed in and out, then squashed. */
export function lumpGeo(r: number, seed: number, sx = 1, sy = 1, sz = 1, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.82 + 0.3 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return geo;
}
export function lump(r: number, color: string, seed: number, sx = 1, sy = 1, sz = 1, detail = 1, surface?: Surface): THREE.Mesh {
  return new THREE.Mesh(lumpGeo(r, seed, sx, sy, sz, detail), mat(color, surface ? { surface } : {}));
}
/** A flat irregular plate (a puddle, a scorch, a mat of leaves) of 9 points about the origin, lying at y. */
export function plate(r: number, seed: number, color: string, y = 0.04, sx = 1.3, m?: THREE.Material): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, k = r * (0.7 + 0.4 * hash(i, seed)); pts.push(new THREE.Vector2(Math.cos(a) * k * sx, Math.sin(a) * k)); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, m ?? mat(color));
}
/** A flat polygon in the plan (x, z), lying at y, facing up. */
export function flat(pts: P2[], y: number, color: string | THREE.Material): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
}
/** Raw triangles (x, y, z triples) as one mesh. */
export function tris(verts: number[], color: string): THREE.Mesh {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color));
}
/** Triangles from vertex triples, each wound to face up. */
export function upTris(v: THREE.Vector3[]): THREE.BufferGeometry {
  const P: number[] = [];
  for (let i = 0; i + 2 < v.length; i += 3) {
    let [a, b, c] = [v[i], v[i + 1], v[i + 2]];
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (ny < 0) [b, c] = [c, b];
    P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}

/** A polyline from dims: `${p}n` points at `${p}x{i}`, `${p}z{i}`, each with a width `${p}w{i}`. */
export function dimsLine(d: Dims, p = ''): { pts: P2[]; w: number[] } {
  const n = d[p + 'n'] ?? 0, pts: P2[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) { pts.push([d[`${p}x${i}`] ?? 0, d[`${p}z${i}`] ?? 0]); w.push(d[`${p}w${i}`] ?? 0); }
  return { pts, w };
}
/** Stations every `step` ft along a polyline, with the unit tangent (smoothed at the joints) and the interpolated width. */
export function densify(pts: P2[], w: number[], step: number, closed = false): { p: P2; t: P2; w: number }[] {
  const out: { p: P2; t: P2; w: number }[] = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(1, Math.round(L / step)), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (let s = 0; s < k; s++) { const f = s / k; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], t, w: lerp(w[i] ?? 0, w[(i + 1) % n] ?? 0, f) }); }
  }
  if (!closed) { const a = pts[n - 2], b = pts[n - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ p: [...b] as P2, t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], w: w[n - 1] ?? 0 }); }
  // smooth the tangents at the joints
  for (let i = 1; i + 1 < out.length; i++) { const a = out[i - 1].t, b = out[i + 1].t, tx = a[0] + b[0], tz = a[1] + b[1], L = Math.hypot(tx, tz) || 1; out[i].t = [tx / L, tz / L]; }
  return out;
}

/** Bake a built group into one mesh per material (geometry in the root's own frame); `order` sets renderOrder when non-zero. */
export function compact(root: THREE.Object3D, order = 0): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
  });
  const out = new THREE.Group();
  for (const [mt, gs] of by) { const m = new THREE.Mesh(merge(gs), mt); if (order) m.renderOrder = order; out.add(m); }
  return out;
}
