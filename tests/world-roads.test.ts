// The valley's roads as one graph (item 2f-1a). The road and river polylines in locations/ch02/barovia-region/world.json
// are measured from the regional map by scripts/authoring/barovia-world.py; this keeps them a connected net through
// the places they serve: every end on a place, on another road or on the map's frame; every road-served place on a
// road; no crossing but at a shared vertex; no road doubling back on itself; a point at least every half mile; each
// river one polyline. The Sheep Chase country is held to the rules its own data meets (its gaps are named below).
import { describe, expect, it } from 'vitest';
import barovia from '../locations/ch02/barovia-region/world.json';
import wsc from '../locations/wsc/00-region/world.json';
import type { WorldData } from '../app/src/campaigns';

type Vec2 = [number, number];
type Road = WorldData['roads'][number];
const NEAR = 0.1; // miles: what "on" means for a pin, a road or the frame
const MAX_GAP = 0.5; // miles between consecutive points
/** A pin of one of these types is a place the roads serve. */
const ROAD_PLACES = new Set(['gate', 'settlement', 'crossroads', 'camp', 'falls', 'landmark', 'castle', 'pass', 'temple', 'ruin', 'tower', 'road']);
/** The types the module leaves off the roads: their pins need no road within NEAR (most have a trail anyway). */
const OFF_ROAD: Record<string, string> = {
  hill: 'Yester Hill: a dotted way reaches the hill, but the hill itself is no road place',
  den: 'the Werewolf Den: likewise, a dotted way to a cave',
  peak: 'the mountain peaks (Mount Baratok and its summits): no road climbs them',
  lake: "Lake Zarovich's own marker stands on the water; its map is the landing on the shore",
  river: 'the river markers (River Ivlis and its east bridge) stand on the river, not on a road',
  woods: 'the Svalich Woods marker is a stretch of forest beside the road',
};

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Distance from p to the segment ab. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
const segments = (r: Road) => r.pts.slice(1).map((b, i) => [r.pts[i], b] as [Vec2, Vec2]);
/** Distance from p to the nearest point of any of these roads. */
const netDist = (p: Vec2, roads: Road[]) => Math.min(Infinity, ...roads.flatMap((r) => segments(r).map(([a, b]) => segDist(p, a, b))));
const same = (a: Vec2, b: Vec2) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
/** Where two segments meet (a point, or an overlap), or null when they do not. */
function meet(a: Vec2, b: Vec2, c: Vec2, d: Vec2): 'none' | 'point' | 'overlap' | Vec2 {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]], s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0], qp: Vec2 = [c[0] - a[0], c[1] - a[1]];
  const eps = 1e-9;
  if (Math.abs(den) < eps) {
    if (Math.abs(qp[0] * r[1] - qp[1] * r[0]) > eps) return 'none'; // parallel, apart
    const rr = r[0] * r[0] + r[1] * r[1] || 1e-12, t0 = (qp[0] * r[0] + qp[1] * r[1]) / rr, t1 = t0 + (s[0] * r[0] + s[1] * r[1]) / rr;
    const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    if (hi < -eps || lo > 1 + eps) return 'none';
    return hi - lo < eps || Math.abs(hi) < eps || Math.abs(lo - 1) < eps ? 'point' : 'overlap';
  }
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return 'none';
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

/** The rules every region's data meets. */
function roadRules(name: string, data: WorldData) {
  const roads = data.roads, pins = data.pins;
  it(`${name}: every road-served place lies on a road, and the places left off the roads are the module's`, () => {
    const off: string[] = [], unknown: string[] = [];
    for (const p of pins) {
      if (ROAD_PLACES.has(p.type)) { if (netDist(p.pos as Vec2, roads) > NEAR) off.push(`${p.key} ${p.name} (${netDist(p.pos as Vec2, roads).toFixed(2)} mi)`); }
      else if (!(p.type in OFF_ROAD)) unknown.push(`${p.key} ${p.name}: ${p.type}`);
    }
    expect(off, 'road-served places more than a tenth of a mile from any road').toEqual([]);
    expect(unknown, 'pin types neither road-served nor listed as left off the roads').toEqual([]);
  });
  it(`${name}: no two road segments cross except at a vertex both share`, () => {
    const bad: string[] = [];
    const all = roads.flatMap((r, ri) => segments(r).map(([a, b], si) => ({ r: ri, s: si, a, b, name: r.name })));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const p = all[i], q = all[j];
      if (p.r === q.r && Math.abs(p.s - q.s) <= 1) continue; // consecutive segments of one road share their vertex
      const m = meet(p.a, p.b, q.a, q.b);
      if (m === 'none') continue;
      const at = m === 'point' ? [p.a, p.b].find((v) => same(v, q.a) || same(v, q.b)) : m === 'overlap' ? undefined : m;
      const shared = !!at && (same(at, p.a) || same(at, p.b)) && (same(at, q.a) || same(at, q.b));
      if (!shared) bad.push(`${p.name} [${p.a}]-[${p.b}] with ${q.name} [${q.a}]-[${q.b}]${m === 'overlap' ? ' (overlap)' : ''}`);
    }
    expect(bad, 'road segments crossing or touching away from a shared vertex').toEqual([]);
  });
  it(`${name}: no road doubles back on itself (a hook: two of its segments running opposite ways within a tenth of a mile)`, () => {
    const hooks: string[] = [];
    for (const r of roads) {
      const segs = segments(r);
      for (let i = 0; i < segs.length; i++) for (let j = i + 2; j < segs.length; j++) {
        const [a, b] = segs[i], [c, d] = segs[j], u = dist(a, b) || 1, v = dist(c, d) || 1;
        const dot = ((b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1])) / (u * v);
        if (dot > -0.5) continue; // a switchback turns and parts; a hook comes back along itself
        const gap = Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
        if (gap < NEAR) hooks.push(`${r.name} segment ${i} [${a}]-[${b}] and segment ${j} [${c}]-[${d}] (${gap.toFixed(2)} mi apart)`);
      }
    }
    expect(hooks).toEqual([]);
  });
  it(`${name}: each river is one polyline, none duplicated`, () => {
    const names = data.rivers.map((r) => r.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i), 'a river in more than one polyline').toEqual([]);
    const keys = data.rivers.map((r) => JSON.stringify(r.pts));
    expect(keys.filter((k, i) => keys.indexOf(k) !== i).length, 'duplicate river polylines').toBe(0);
    for (const r of data.rivers) expect(r.pts.length, r.name).toBeGreaterThan(1);
  });
}

/** The rules only Barovia's measured net meets: the Sheep Chase country's Main road stops a mile short of its frame at
 *  both ends (2.6 mi from any place), and its Side path has a 1.7-mile leg. */
function measuredRules(name: string, data: WorldData) {
  const roads = data.roads, pins = data.pins, b = data.bounds;
  const onFrame = (p: Vec2) => Math.min(p[0] - b.minX, b.maxX - p[0], p[1] - b.minY, b.maxY - p[1]) <= NEAR;
  it(`${name}: every road end lies on a place, on another road or on the map's frame`, () => {
    const loose: string[] = [];
    roads.forEach((r, i) => {
      for (const e of [r.pts[0], r.pts[r.pts.length - 1]] as Vec2[]) {
        const pin = pins.some((p) => dist(p.pos as Vec2, e) <= NEAR), road = netDist(e, roads.filter((_, j) => j !== i)) <= NEAR;
        if (!pin && !road && !onFrame(e)) loose.push(`${r.name} at [${e}]`);
      }
    });
    expect(loose, 'road ends on nothing').toEqual([]);
  });
  it(`${name}: no two consecutive points of a road are more than half a mile apart`, () => {
    const gaps = roads.flatMap((r) => segments(r).filter(([a, c]) => dist(a, c) > MAX_GAP).map(([a, c]) => `${r.name} [${a}]-[${c}] (${dist(a, c).toFixed(2)} mi)`));
    expect(gaps).toEqual([]);
  });
  it(`${name}: every road has a kind, road or trail`, () => {
    for (const r of roads) expect(['road', 'trail'], r.name).toContain(r.kind);
  });
}

describe('the world roads as one graph', () => {
  roadRules('Barovia', barovia as unknown as WorldData);
  measuredRules('Barovia', barovia as unknown as WorldData);
  roadRules('the Sheep Chase country', wsc as unknown as WorldData);
});
