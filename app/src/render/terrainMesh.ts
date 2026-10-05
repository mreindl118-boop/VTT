// The ground of a level with relief: its floor polygons (lawns, streets, yards, squares, keyed areas) draped on the
// relief (core/relief.ts). The relief's samples are joined by flat triangles (each cell split on the same diagonal);
// every floor polygon is triangulated and cut along those triangles, so each piece lies in one of them and all the
// floors lie exactly on one surface (a street over the grass, a yard over the street), kept in order by small lifts as
// on a flat map, at any distance. Normals come from the smooth surface through the same samples, so the ground is lit
// as one rolling surface across every polygon's edges. A short skirt hangs from each polygon's rim (the old slab's
// thickness), deeper under the map's own ground, so its edge never shows daylight against the land beyond.
import * as THREE from 'three';
import { pointInPolygon, type Polygon, type Vec2 } from '../core/geometry';
import type { Relief } from '../core/relief';

/** Lifts above the relief, by layer, as on a flat map: the base ground, keyed areas, earth over them, paving over that. */
export const DRAPE_LIFT = { ground: -0.05, room: 0, earth: 0.07, paved: 0.1 } as const;

type P2 = [number, number];

/** Clip a convex polygon by half-planes a·x + b·z + c >= 0 (Sutherland–Hodgman). */
function clip(poly: P2[], planes: [number, number, number][]): P2[] {
  let out = poly;
  for (const [a, b, c] of planes) {
    const inp = out; out = [];
    if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const p = inp[i], q = inp[(i + 1) % inp.length], dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out;
}

export class DrapeBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private idx: number[] = [];
  private shared = new Map<string, number>();
  constructor(private relief: Relief, private y0: number) {}

  private top(x: number, z: number, lift: number): number {
    const key = `${Math.round(x * 64)}:${Math.round(z * 64)}:${lift}`;
    let i = this.shared.get(key);
    if (i !== undefined) return i;
    i = this.pos.length / 3; this.shared.set(key, i);
    const n = this.relief.normal(x, z);
    this.pos.push(x, this.y0 + this.relief.natural(x, z) + lift, z); this.nor.push(n[0], n[1], n[2]);
    return i;
  }
  private tri(a: number, b: number, c: number): void {
    const P = this.pos;
    // faces up: (b - a) x (c - a) has a positive y
    const cy = (P[b * 3 + 2] - P[a * 3 + 2]) * (P[c * 3] - P[a * 3]) - (P[b * 3] - P[a * 3]) * (P[c * 3 + 2] - P[a * 3 + 2]);
    if (Math.abs(cy) < 1e-7) return;
    if (cy > 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }

  /** Drape one floor polygon `lift` ft above the ground, with a skirt `skirt` ft deep round its rim. */
  polygon(poly: Polygon, lift: number, skirt: number): void {
    if (poly.length < 3) return;
    const { cell, x0: ox, z0: oz } = this.relief, ext = this.relief.extent;
    const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [ia, ib, ic] of tris) {
      const t: P2[] = [poly[ia] as P2, poly[ib] as P2, poly[ic] as P2];
      const xs = t.map((p) => p[0]), zs = t.map((p) => p[1]);
      // the relief's cells under the triangle (beyond the grid the ground is the edge's, flat along the edge: one cell)
      const i0 = Math.floor((Math.max(ext.minX, Math.min(...xs)) - ox) / cell), i1 = Math.floor((Math.min(ext.maxX, Math.max(...xs)) - ox) / cell);
      const j0 = Math.floor((Math.max(ext.minZ, Math.min(...zs)) - oz) / cell), j1 = Math.floor((Math.min(ext.maxZ, Math.max(...zs)) - oz) / cell);
      for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) {
        // cell (i, j) and its two flat triangles; the first and last rows and columns reach out to whatever lies beyond
        const x0 = i <= i0 - 1 ? -1e7 : ox + i * cell, x1 = i >= i1 + 1 ? 1e7 : ox + (i + 1) * cell;
        const z0 = j <= j0 - 1 ? -1e7 : oz + j * cell, z1 = j >= j1 + 1 ? 1e7 : oz + (j + 1) * cell;
        if (i < i0 - 1 || j < j0 - 1) continue;
        const cx = ox + i * cell, cz = oz + j * cell;
        const box: [number, number, number][] = [[1, 0, -x0], [-1, 0, x1], [0, 1, -z0], [0, -1, z1]];
        const inner = i >= i0 && i <= i1 && j >= j0 && j <= j1;
        // the diagonal (u = v) splits an inner cell; an outer band is flat across (the edge's height carries on)
        const halves: [number, number, number][][] = inner ? [[[1, -1, -(cx - cz)]], [[-1, 1, cx - cz]]] : [[]];
        for (const half of halves) {
          const piece = clip(t, [...box, ...half]);
          if (piece.length < 3) continue;
          const v = piece.map(([x, z]) => this.top(x, z, lift));
          for (let k = 1; k + 1 < v.length; k++) this.tri(v[0], v[k], v[k + 1]);
        }
      }
    }
    if (skirt > 0) this.skirt(poly, lift, skirt);
  }

  /** The rim: each edge cut where it crosses the relief's lattice (so it follows the ground), hung `depth` ft down. */
  private skirt(poly: Polygon, lift: number, depth: number): void {
    const { cell, x0: ox, z0: oz } = this.relief;
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k] as P2, q = poly[(k + 1) % poly.length] as P2, dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      if (L < 1e-6) continue;
      // outward: the side the polygon is not on
      let nx = dz / L, nz = -dx / L;
      const m: Vec2 = [(p[0] + q[0]) / 2 + nx * 0.05, (p[1] + q[1]) / 2 + nz * 0.05];
      if (pointInPolygon(m, poly)) { nx = -nx; nz = -nz; }
      const ts = [0, 1];
      if (Math.abs(dx) > 1e-9) for (let i = Math.ceil((Math.min(p[0], q[0]) - ox) / cell); ox + i * cell < Math.max(p[0], q[0]); i++) ts.push((ox + i * cell - p[0]) / dx);
      if (Math.abs(dz) > 1e-9) for (let j = Math.ceil((Math.min(p[1], q[1]) - oz) / cell); oz + j * cell < Math.max(p[1], q[1]); j++) ts.push((oz + j * cell - p[1]) / dz);
      // and where it crosses a cell's diagonal (x - z constant)
      const e0 = p[0] - ox - (p[1] - oz), e1 = q[0] - ox - (q[1] - oz);
      if (Math.abs(e1 - e0) > 1e-9) for (let d = Math.ceil(Math.min(e0, e1) / cell); d * cell < Math.max(e0, e1); d++) ts.push((d * cell - e0) / (e1 - e0));
      const sorted = [...new Set(ts.filter((t) => t >= 0 && t <= 1).map((t) => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
      for (let s = 0; s + 1 < sorted.length; s++) {
        const a: P2 = [p[0] + dx * sorted[s], p[1] + dz * sorted[s]], b: P2 = [p[0] + dx * sorted[s + 1], p[1] + dz * sorted[s + 1]];
        const ya = this.y0 + this.relief.natural(a[0], a[1]) + lift, yb = this.y0 + this.relief.natural(b[0], b[1]) + lift;
        const base = this.pos.length / 3;
        this.pos.push(a[0], ya, a[1], b[0], yb, b[1], b[0], yb - depth, b[1], a[0], ya - depth, a[1]);
        for (let n = 0; n < 4; n++) this.nor.push(nx, 0, nz);
        // (b_top - a_top) x (b_bot - a_top) is (dz·depth, ·, -dx·depth) along the edge: facing out keeps the winding
        const ex = b[0] - a[0], ez = b[1] - a[1];
        if (ez * nx - ex * nz > 0) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
  }

  get triangles(): number { return this.idx.length / 3; }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setIndex(this.idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/** Lay a geometry (already in the level's frame) on the ground: every vertex rises by the ground under it, so a wall,
 *  a fence or a palisade follows the slope along its length while staying plumb. Vertices at or below the object's own
 *  foot (`footY`) sink `under` ft more, so nothing shows daylight under it on a slope. */
export function drapeGeometry(g: THREE.BufferGeometry, ground: (x: number, z: number) => number, footY: number, under = 0.5): void {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setY(i, y + ground(x, z) - (y <= footY + 0.01 ? under : 0));
  }
  p.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
}

/** Each vertex's height above the ground under it (the low-wall cut on relief clips by this). */
export function aglAttribute(g: THREE.BufferGeometry, ground: (x: number, z: number) => number, y0: number): void {
  const p = g.attributes.position as THREE.BufferAttribute, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = p.getY(i) - y0 - ground(p.getX(i), p.getZ(i));
  g.setAttribute('aAGL', new THREE.BufferAttribute(a, 1));
}
