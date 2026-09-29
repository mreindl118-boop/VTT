// 2D plan geometry in feet. Points are [x, z].
export type Vec2 = [number, number];
export type Polygon = Vec2[];
export interface Segment { a: Vec2; b: Vec2 }

export function polygonArea(p: Polygon): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

export function pointInPolygon(pt: Vec2, poly: Polygon): boolean {
  const [x, z] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function bounds(polys: Polygon[]): { minX: number; minZ: number; maxX: number; maxZ: number } {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of polys) for (const [x, z] of p) {
    minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
  }
  return { minX, minZ, maxX, maxZ };
}

/** Width of a polygon's axis-aligned extent along x. */
export const extentX = (p: Polygon) => { const b = bounds([p]); return b.maxX - b.minX; };
export const extentZ = (p: Polygon) => { const b = bounds([p]); return b.maxZ - b.minZ; };

/** Regular polygon (e.g. an octagon turret) with the given flat-to-flat width. */
export function regularPolygon(center: Vec2, sides: number, flatWidth: number, rotation = Math.PI / sides): Polygon {
  const r = flatWidth / 2 / Math.cos(Math.PI / sides);
  const out: Polygon = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    out.push([center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)]);
  }
  return out;
}

export const rect = (x: number, z: number, w: number, d: number): Polygon => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];

/** Proper segment intersection (touching endpoints of the sight ray excluded). */
export function segmentsIntersect(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]);
  if (d === 0) return false;
  const u = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d;
  const v = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d;
  const e = 1e-9;
  return u > e && u < 1 - e && v >= -e && v <= 1 + e;
}

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
