// The valley's lakes as every view draws them (item 2f-1c). world.json carries a measured lake as its traced outline
// (`pts`, miles, 20-40 points: scripts/authoring/barovia-world.py) beside its bounding ellipse (`center`, `r`). Drawn
// raw, an outline is a cut polygon: shore edges up to a mile long meeting at hard corners. So every view draws one
// shore made from it, `lakeRing`: the outline's corners rounded by two passes of Chaikin's corner cutting (each edge
// keeps its middle half; the shore stays inside the traced one and never crosses itself), and no edge longer than
// MAX_EDGE_MI. The land, its water and the shore the inked map bakes (render/worldland.ts, render/worldcarto.ts through
// LandField), the flat sheet (ui/worldmap.ts) and the legacy per-map backdrop (render/backdrop.ts) all read it, so the
// shore is the same in every style. A lake the data draws as an ellipse only keeps the ellipse.
// barovia-world.py puts a river's mouth on this same rounded shore (its `rounded`, the same two passes).
// Pure geometry in map miles (or any plane units for the ring helpers); no three.js.
import type { WorldData } from '../campaigns';
import { pointInPolygon, polygonArea, type Vec2 } from '../core/geometry';

/** A lake as the data draws it: its bounding ellipse (`center`, `r`, miles) and, where it was measured, its outline. */
export type Lake = WorldData['lakes'][number] & { pts?: Vec2[] };
/** Passes of corner cutting from the traced outline to the drawn shore. */
export const SMOOTH_PASSES = 2;
/** Miles: the longest edge of a drawn shore. */
export const MAX_EDGE_MI = 0.15;

/** The lake's traced outline as the data holds it, or undefined for a lake drawn as an ellipse. */
export const lakeOutline = (l: WorldData['lakes'][number]): Vec2[] | undefined => { const p = (l as Lake).pts; return p && p.length >= 3 ? p : undefined; };

/** Chaikin's corner cutting on a closed ring: each edge gives its points at a quarter and three quarters along. */
export function chaikin(ring: readonly Vec2[], passes = SMOOTH_PASSES): Vec2[] {
  let r: Vec2[] = ring.map((p) => [p[0], p[1]]);
  for (let k = 0; k < passes; k++) {
    const out: Vec2[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    r = out;
  }
  return r;
}
/** A closed ring with every edge longer than `max` split evenly (the shape unchanged). */
export function densify(ring: readonly Vec2[], max: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

const rings = new WeakMap<object, Vec2[]>();
/** The lake's shore as every view draws it (miles, a closed ring in the outline's winding), or undefined for a lake
 *  drawn as an ellipse. Worked out once per lake. */
export function lakeRing(l: WorldData['lakes'][number]): Vec2[] | undefined {
  const pts = lakeOutline(l); if (!pts) return undefined;
  let r = rings.get(pts);
  if (!r) { r = densify(chaikin(pts), MAX_EDGE_MI); rings.set(pts, r); }
  return r;
}

/** Signed distance from a point to a closed ring's edge: negative inside, positive outside. */
export function ringSd(ring: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), ex = x - ax - dx * t, ez = z - az - dz * t;
    const d = ex * ex + ez * ez; if (d < best) best = d;
  }
  return pointInPolygon([x, z], ring as Vec2[]) ? -Math.sqrt(best) : Math.sqrt(best);
}
/** A ring's area centroid (its vertex mean when degenerate). */
export function ringCentroid(ring: readonly Vec2[]): Vec2 {
  const A = polygonArea(ring as Vec2[]);
  if (Math.abs(A) < 1e-9) return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  let cx = 0, cz = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i], c = ax * bz - bx * az; cx += (ax + bx) * c; cz += (az + bz) * c; }
  return [cx / (6 * A), cz / (6 * A)];
}
/** n points round a closed ring, evenly by arc length from its first point, scaled by f about `about`. */
export function ringPoints(ring: readonly Vec2[], n: number, f = 1, about: Vec2 = ringCentroid(ring)): Vec2[] {
  const lens = [0]; for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; lens.push(lens[k] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = lens[ring.length], out: Vec2[] = []; let k = 0;
  for (let m = 0; m < n; m++) {
    const t = (m / n) * L; while (k + 1 < ring.length && lens[k + 1] < t) k++;
    const a = ring[k], b = ring[(k + 1) % ring.length], u = (t - lens[k]) / Math.max(1e-12, lens[k + 1] - lens[k]);
    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
    out.push([about[0] + (x - about[0]) * f, about[1] + (z - about[1]) * f]);
  }
  return out;
}

/** Whether a point (miles) lies in the lake as it is drawn: inside its shore, else inside its ellipse. */
export function inLakeShape(l: WorldData['lakes'][number], p: Vec2): boolean {
  const ring = lakeRing(l);
  return ring ? pointInPolygon(p, ring) : ((p[0] - l.center[0]) / l.r[0]) ** 2 + ((p[1] - l.center[1]) / l.r[1]) ** 2 < 1;
}
/** n points round the lake's drawn shore (miles): its ring by arc length, or its ellipse by angle; scaled by f about
 *  the ring's centroid (the ellipse's centre). */
export function lakeShorePoints(l: WorldData['lakes'][number], n: number, f = 1): Vec2[] {
  const ring = lakeRing(l);
  if (ring) return ringPoints(ring, n, f);
  return Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [l.center[0] + Math.cos(a) * l.r[0] * f, l.center[1] + Math.sin(a) * l.r[1] * f] as Vec2; });
}
