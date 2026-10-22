// The valley's roads as one graph (item 2f-1b): the party's trail (render/worldstage.ts, drawTrail) follows the roads
// between the places it went by, instead of a straight ray across the valley. Pure geometry in map miles on
// WorldData.roads (world.json, measured by scripts/authoring/barovia-world.py), no three.js:
//  - the nodes are the polylines' ends and every vertex two polylines share (within JOIN: the junctions);
//  - the edges are the runs of one polyline between two nodes, with their points and their length;
//  - `snap` finds the nearest point on any road; `route` the shortest way along the roads between two points, from
//    and to where each meets the road (null when either is more than OFF_ROAD from any road: the caller draws a
//    straight line); `components` says whether the net is one.
// A polyline's end that lies on another road's segment, away from its vertices, is not a junction here: the measured
// net shares a vertex wherever two roads meet, and tests/worldroads.test.ts holds the graph built from it to one
// connected part (tests/world-roads.test.ts holds every end to a place, another road or the map's frame).
import type { WorldData } from '../campaigns';
import type { Vec2 } from '../core/geometry';

/** Miles: two polyline vertices this close are one junction. */
export const JOIN = 0.02;
/** Miles: a point farther than this from any road has no road route. */
export const OFF_ROAD = 0.6;

export interface RoadEdge { a: number; b: number; pts: Vec2[]; len: number; road: string }
export interface RoadGraph { nodes: Vec2[]; edges: RoadEdge[]; adj: number[][] }
/** The nearest point on a road: on `edge`, `along` miles from its node `a`, `dist` miles from the point asked. */
export interface RoadSnap { point: Vec2; edge: number; along: number; dist: number }

type Roads = Pick<WorldData, 'roads'>;
const EPS = 1e-9;

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The nearest point of segment ab to p, how far along ab it lies (0..1) and how far off. */
function nearestOnSeg(p: Vec2, a: Vec2, b: Vec2): { q: Vec2; t: number; d: number } {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0;
  const q: Vec2 = [a[0] + dx * t, a[1] + dz * t];
  return { q, t, d: dist(p, q) };
}
const polyLen = (pts: Vec2[]): number => { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; };

/** The graph of a world's roads. */
export function roadGraph(world: Roads): RoadGraph {
  const nodes: Vec2[] = [], edges: RoadEdge[] = [];
  const nodeAt = (p: Vec2): number => {
    let best = -1, bd = JOIN;
    for (let i = 0; i < nodes.length; i++) { const d = dist(nodes[i], p); if (d <= bd) { bd = d; best = i; } }
    if (best >= 0) return best;
    nodes.push([p[0], p[1]]);
    return nodes.length - 1;
  };
  const roads = world.roads.filter((r) => r.pts.length > 1);
  // a vertex is a junction when another polyline has a vertex within JOIN of it
  const junction = (ri: number, p: Vec2): boolean => roads.some((s, si) => si !== ri && s.pts.some((q) => dist(p, q) <= JOIN));
  roads.forEach((r, ri) => {
    let from = -1, inner: Vec2[] = [];
    r.pts.forEach((p, i) => {
      if (i && i < r.pts.length - 1 && !junction(ri, p)) { inner.push([p[0], p[1]]); return; }
      const n = nodeAt(p);
      if (from >= 0 && (n !== from || inner.length)) {
        const pts: Vec2[] = [nodes[from], ...inner, nodes[n]];
        edges.push({ a: from, b: n, pts, len: polyLen(pts), road: r.name });
      }
      from = n; inner = [];
    });
  });
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push(i); if (e.b !== e.a) adj[e.b].push(i); });
  return { nodes, edges, adj };
}

const graphs = new WeakMap<Roads, RoadGraph>();
/** The graph of this world's roads, built once per world data. */
export function graphOf(world: Roads): RoadGraph {
  let g = graphs.get(world);
  if (!g) { g = roadGraph(world); graphs.set(world, g); }
  return g;
}

/** The nearest point on any road within `radius` miles of p, or null. */
export function snap(g: RoadGraph, p: Vec2, radius = OFF_ROAD): RoadSnap | null {
  let best: RoadSnap | null = null;
  g.edges.forEach((e, ei) => {
    let along = 0;
    for (let i = 1; i < e.pts.length; i++) {
      const a = e.pts[i - 1], b = e.pts[i], s = nearestOnSeg(p, a, b), L = dist(a, b);
      if (s.d <= radius && (!best || s.d < best.dist)) best = { point: s.q, edge: ei, along: along + L * s.t, dist: s.d };
      along += L;
    }
  });
  return best;
}

/** The points of edge e from s0 to s1 miles along it (either order): the two ends interpolated, the vertices between. */
function slice(e: RoadEdge, s0: number, s1: number): Vec2[] {
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1), out: Vec2[] = [];
  const at = (s: number): Vec2 => {
    let acc = 0;
    for (let i = 1; i < e.pts.length; i++) {
      const L = dist(e.pts[i - 1], e.pts[i]);
      if (s <= acc + L || i === e.pts.length - 1) { const t = L ? Math.max(0, Math.min(1, (s - acc) / L)) : 0; return [e.pts[i - 1][0] + (e.pts[i][0] - e.pts[i - 1][0]) * t, e.pts[i - 1][1] + (e.pts[i][1] - e.pts[i - 1][1]) * t]; }
      acc += L;
    }
    return e.pts[e.pts.length - 1];
  };
  out.push(at(lo));
  let acc = 0;
  for (let i = 1; i < e.pts.length - 1; i++) { acc += dist(e.pts[i - 1], e.pts[i]); if (acc > lo + EPS && acc < hi - EPS) out.push(e.pts[i]); }
  out.push(at(hi));
  return s1 < s0 ? out.reverse() : out;
}

/** Shortest distances over the nodes from several sources (node, distance), with each node's way back. */
function dijkstra(g: RoadGraph, sources: [number, number][]): { d: number[]; prev: (number | undefined)[]; via: (number | undefined)[] } {
  const n = g.nodes.length, d = new Array<number>(n).fill(Infinity), prev = new Array<number | undefined>(n), via = new Array<number | undefined>(n), done = new Array<boolean>(n).fill(false);
  for (const [s, ds] of sources) if (ds < d[s]) d[s] = ds;
  for (;;) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const ei of g.adj[u]) { const e = g.edges[ei], v = e.a === u ? e.b : e.a, nd = d[u] + e.len; if (nd < d[v] - EPS) { d[v] = nd; prev[v] = u; via[v] = ei; } }
  }
  return { d, prev, via };
}

/** The shortest road route from a to b (miles): a, where it meets the road, along the roads, where it leaves them, b.
 *  Null when either end is more than `radius` from any road. a and b are always its first and last points. */
export function route(g: RoadGraph, a: Vec2, b: Vec2, radius = OFF_ROAD): Vec2[] | null {
  const sa = snap(g, a, radius), sb = snap(g, b, radius);
  if (!sa || !sb) return null;
  const ea = g.edges[sa.edge], eb = g.edges[sb.edge];
  let best: { len: number; pts: Vec2[] } | null = null;
  // along one edge, directly
  if (sa.edge === sb.edge) best = { len: Math.abs(sb.along - sa.along), pts: slice(ea, sa.along, sb.along) };
  // through the net: from either end of a's edge to either end of b's edge (each end by how far along its edge it
  // lies, so an edge that closes on itself, both ends one node, leaves and arrives by the nearer way)
  const { d, prev, via } = dijkstra(g, [[ea.a, sa.along], [ea.b, ea.len - sa.along]]);
  for (const [node, tail, at] of [[eb.a, sb.along, 0], [eb.b, eb.len - sb.along, eb.len]] as [number, number, number][]) {
    if (d[node] === Infinity) continue;
    const len = d[node] + tail;
    if (best && len >= best.len - EPS) continue;
    // the chain of nodes back to the source it was reached from
    const chain: number[] = [node]; for (let u = node; prev[u] !== undefined; u = prev[u]!) chain.push(prev[u]!);
    chain.reverse();
    const start = chain[0], leave = start === ea.a && (ea.a !== ea.b || sa.along <= ea.len - sa.along) ? 0 : ea.len;
    const pts: Vec2[] = slice(ea, sa.along, leave);
    for (let i = 1; i < chain.length; i++) { const e = g.edges[via[chain[i]]!], seg = e.a === chain[i - 1] ? e.pts : [...e.pts].reverse(); pts.push(...seg.slice(1)); }
    pts.push(...slice(eb, at, sb.along).slice(1));
    best = { len, pts };
  }
  if (!best) return null;
  const out: Vec2[] = [[a[0], a[1]]];
  for (const p of best.pts) if (dist(out[out.length - 1], p) > EPS) out.push([p[0], p[1]]);
  if (out.length > 1 && dist(out[out.length - 1], b) <= EPS) out.pop(); // (the snapped point is b itself, to a hair)
  if (dist(out[out.length - 1], b) > EPS) out.push([b[0], b[1]]);
  return out;
}

/** The connected parts of the net, each as its node indices (one part: every road reaches every other). */
export function components(g: RoadGraph): number[][] {
  const seen = new Array<boolean>(g.nodes.length).fill(false), out: number[][] = [];
  for (let s = 0; s < g.nodes.length; s++) {
    if (seen[s]) continue;
    const part: number[] = [], stack = [s]; seen[s] = true;
    while (stack.length) { const u = stack.pop()!; part.push(u); for (const ei of g.adj[u]) { const e = g.edges[ei], v = e.a === u ? e.b : e.a; if (!seen[v]) { seen[v] = true; stack.push(v); } } }
    out.push(part.sort((x, y) => x - y));
  }
  return out;
}

/** The length of a polyline in miles. */
export const routeLength = polyLen;
