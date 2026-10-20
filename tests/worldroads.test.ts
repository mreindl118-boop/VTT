// The party's trail follows the roads (item 2f-1b): app/src/render/worldroads.ts builds the valley's road graph from
// the measured polylines in locations/ch02/barovia-region/world.json and routes between two points along it. Held
// here: the Barovia net is one connected graph whose nodes are the polylines' ends and junctions; a route between two
// places on the Old Svalich Road follows the road (its length within 5% of the road distance, every point on a road);
// a route onto a side trail passes its junction; a route from a point off the roads joins the road first; an end more
// than OFF_ROAD from any road has no route (the trail draws a straight line there); a route is the same way back; the
// Sheep Chase country graphs too.
import { describe, expect, it } from 'vitest';
import barovia from '../locations/ch02/barovia-region/world.json';
import wsc from '../locations/wsc/00-region/world.json';
import type { WorldData } from '../app/src/campaigns';
import { JOIN, OFF_ROAD, components, graphOf, roadGraph, route, routeLength, snap } from '../app/src/render/worldroads';

type Vec2 = [number, number];
const W = barovia as unknown as WorldData, S = wsc as unknown as WorldData;
const g = roadGraph(W);
const pin = (key: string): Vec2 => [...W.pins.find((p) => p.key === key)!.pos] as Vec2;
const roadNamed = (name: string) => W.roads.find((r) => r.name === name)!;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
/** Distance from p to the nearest segment of these polylines. */
const netDist = (p: Vec2, roads = W.roads) => Math.min(...roads.flatMap((r) => r.pts.slice(1).map((b, i) => segDist(p, r.pts[i] as Vec2, b as Vec2))));
/** How far along a polyline its nearest point to p lies (miles from its first point). */
function along(p: Vec2, pts: Vec2[]): number {
  let best = Infinity, at = 0, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L))) : 0;
    const d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
    if (d < best) { best = d; at = acc + L * t; }
    acc += L;
  }
  return at;
}
const ON = 1e-6; // miles: what "on a road" means for a routed point
const onRoads = (pts: Vec2[], roads = W.roads) => pts.every((p) => netDist(p, roads) < ON);

describe('the road graph of Barovia', () => {
  it('is one connected net whose nodes are the polylines\' ends and junctions', () => {
    expect(components(g).map((c) => c.length)).toEqual([g.nodes.length]);
    expect(g.edges.length).toBeGreaterThan(W.roads.length); // the Old Svalich Road alone is cut at a dozen junctions
    // every polyline's end is a node, every road is in the graph, and every edge runs along its road
    for (const r of W.roads) {
      for (const e of [r.pts[0], r.pts[r.pts.length - 1]] as Vec2[]) expect(g.nodes.some((n) => dist(n, e) <= JOIN)).toBe(true);
      const edges = g.edges.filter((e) => e.road === r.name);
      expect(edges.length).toBeGreaterThan(0);
      expect(Math.abs(edges.reduce((s, e) => s + e.len, 0) - routeLength(r.pts as Vec2[]))).toBeLessThan(1e-9);
      for (const e of edges) expect(onRoads(e.pts, [r])).toBe(true);
    }
    // the junctions: where the Tser camp path leaves the Old Svalich Road at Tser Falls (H), one node with three edges
    const h = g.nodes.findIndex((n) => dist(n, pin('H')) <= JOIN);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(g.adj[h].length).toBe(3);
    expect(new Set(g.adj[h].map((ei) => g.edges[ei].road))).toEqual(new Set(['Old Svalich Road', 'Tser camp path']));
    // the same data gives the same graph once
    expect(graphOf(W)).toBe(graphOf(W));
    expect(graphOf(W).edges.length).toBe(g.edges.length);
  });

  it('routes between two places on the Old Svalich Road along the road', () => {
    const E = pin('E'), N = pin('N'), road = roadNamed('Old Svalich Road').pts as Vec2[];
    const r = route(g, E, N)!;
    expect(r).not.toBeNull();
    expect(r[0]).toEqual(E); expect(r[r.length - 1]).toEqual(N);
    expect(onRoads(r)).toBe(true);
    const byRoad = Math.abs(along(E, road) - along(N, road)), len = routeLength(r);
    expect(len).toBeGreaterThan(dist(E, N)); // the road winds
    expect(Math.abs(len - byRoad) / byRoad).toBeLessThan(0.05);
    expect(r.length).toBeGreaterThan(10); // the road's own vertices, not a few straight legs
    // the same way back
    const back = route(g, N, E)!;
    expect(back.length).toBe(r.length);
    back.reverse().forEach((p, i) => { expect(dist(p, r[i])).toBeLessThan(1e-9); });
  });

  it('routes within one edge directly, and from a point to itself as that point', () => {
    const e = g.edges.reduce((a, b) => (b.pts.length > a.pts.length ? b : a));
    const whole = route(g, e.pts[0], e.pts[e.pts.length - 1])!; // (the whole edge, to find points on it)
    expect(Math.abs(routeLength(whole) - e.len)).toBeLessThan(1e-9);
    const p = whole[Math.floor(whole.length / 3)], q = whole[Math.floor((2 * whole.length) / 3)];
    const r = route(g, p, q)!;
    expect(onRoads(r)).toBe(true);
    expect(r[0]).toEqual(p); expect(r[r.length - 1]).toEqual(q);
    expect(Math.abs(routeLength(r) - (routeLength(whole.slice(0, whole.indexOf(q) + 1)) - routeLength(whole.slice(0, whole.indexOf(p) + 1))))).toBeLessThan(1e-9);
    expect(route(g, p, p)).toEqual([p]);
  });

  it('takes the junction onto a side trail: the village to the Tser Pool camp turns off at Tser Falls', () => {
    const E = pin('E'), G = pin('G'), H = pin('H');
    const road = roadNamed('Old Svalich Road').pts as Vec2[], camp = roadNamed('Tser camp path').pts as Vec2[];
    const r = route(g, E, G)!;
    expect(r).not.toBeNull();
    expect(onRoads(r)).toBe(true);
    expect(r.some((p) => dist(p, H) < ON)).toBe(true); // through the junction
    // on the road up to the junction, on the camp path after it
    const k = r.findIndex((p) => dist(p, H) < ON);
    expect(onRoads(r.slice(0, k + 1), [roadNamed('Old Svalich Road')])).toBe(true);
    expect(onRoads(r.slice(k), [roadNamed('Tser camp path')])).toBe(true);
    const byRoad = Math.abs(along(E, road) - along(H, road)) + Math.abs(along(H, camp) - along(G, camp));
    expect(Math.abs(routeLength(r) - byRoad) / byRoad).toBeLessThan(0.05);
  });

  it('joins the road from a point off it, and has no route for an end far from every road', () => {
    // Lake Zarovich's marker stands half a mile off the road: the route to Vallaki starts there and meets the road
    const L = pin('L'), N = pin('N');
    expect(netDist(L)).toBeGreaterThan(0.3); expect(netDist(L)).toBeLessThan(OFF_ROAD);
    const r = route(g, L, N)!;
    expect(r).not.toBeNull();
    expect(r[0]).toEqual(L);
    expect(onRoads(r.slice(1))).toBe(true);
    expect(dist(r[0], r[1])).toBeCloseTo(netDist(L), 9);
    // the wilderness east of Tser Pool (the drag test's point) is 1.4 mi from any road: no route, no snap
    const wild: Vec2 = [9.6, 9.9];
    expect(netDist(wild)).toBeGreaterThan(OFF_ROAD);
    expect(snap(g, wild)).toBeNull();
    expect(route(g, pin('E'), wild)).toBeNull();
    expect(route(g, wild, pin('E'))).toBeNull();
    // asked wider, the snap finds the Old Svalich Road
    const s = snap(g, wild, 2)!;
    expect(s).not.toBeNull();
    expect(g.edges[s.edge].road).toBe('Old Svalich Road');
    expect(Math.abs(s.dist - netDist(wild))).toBeLessThan(1e-9);
    expect(netDist(s.point)).toBeLessThan(ON);
  });
});

describe('the road graph on drawn nets', () => {
  const net = (roads: { name: string; pts: Vec2[] }[]) => roadGraph({ roads: roads.map((r) => ({ ...r, kind: 'road' })) } as unknown as WorldData);
  it('goes round a ring road the short way, across the node where the ring closes on itself', () => {
    // a square ring of 4 miles, its ends one point (one edge whose two ends are one node), and a spur off that node
    const ring: Vec2[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], spur: Vec2[] = [[0, 0], [-1, -1]];
    const g = net([{ name: 'ring', pts: ring }, { name: 'spur', pts: spur }]);
    expect(components(g).length).toBe(1);
    expect(g.edges.filter((e) => e.a === e.b).length).toBe(1);
    const onNet = (r: Vec2[]) => onRoads(r, [{ pts: ring }, { pts: spur }] as unknown as WorldData['roads']);
    // just before the closing node to just after it: 0.2 miles through [0, 0], not 3.8 back round the ring
    const a: Vec2 = [0, 0.1], b: Vec2 = [0.1, 0];
    for (const [p, q] of [[a, b], [b, a]] as [Vec2, Vec2][]) {
      const r = route(g, p, q)!;
      expect(r).not.toBeNull();
      expect(routeLength(r)).toBeCloseTo(0.2, 9);
      expect(r.some((x) => dist(x, [0, 0]) < ON)).toBe(true);
      expect(onNet(r)).toBe(true);
    }
    // from the spur's end onto the ring, by the nearer way round from the node: [0, 0], [0, 1], then half a mile east
    const r = route(g, [-1, -1], [0.5, 1])!;
    expect(routeLength(r)).toBeCloseTo(Math.SQRT2 + 1.5, 9);
    expect(onNet(r)).toBe(true);
    expect(r.some((x) => dist(x, [0, 1]) < ON)).toBe(true);
  });
  it('joins two polylines at a shared vertex and leaves two apart as two parts', () => {
    const joined = net([{ name: 'a', pts: [[0, 0], [1, 0], [2, 0]] }, { name: 'b', pts: [[1, 0.005], [1, 1]] }]);
    expect(components(joined).length).toBe(1); // (within JOIN of a's middle vertex: a junction)
    expect(joined.nodes.length).toBe(4);
    const apart = net([{ name: 'a', pts: [[0, 0], [1, 0]] }, { name: 'b', pts: [[0, 2], [1, 2]] }]);
    expect(components(apart).length).toBe(2);
    expect(route(apart, [0, 0], [1, 2])).toBeNull(); // no way along the roads from one to the other
  });
});

describe('the road graph of the Sheep Chase country', () => {
  it('builds from its four short roads as one net', () => {
    const s = roadGraph(S);
    expect(s.edges.length).toBeGreaterThanOrEqual(S.roads.length);
    expect(components(s).length).toBe(1);
    const r = route(s, S.pins[0].pos as Vec2, S.pins[S.pins.length - 1].pos as Vec2)!;
    expect(r).not.toBeNull();
    expect(onRoads(r, S.roads)).toBe(true);
  });
});

describe('the place card offers the DM a travel, as the drag does', () => {
  it('Travel here shows for the DM when the party is elsewhere, beside Open; never for players or where the party stands', async () => {
    const { useWorld, worldCardHtml } = await import('../app/src/ui/worldmap');
    useWorld(W, 'gothic', 'ch02/barovia-region');
    const N = W.pins.find((p) => p.key === 'N')!, o = { dm: true, revealed: true, pace: 'normal' as const, canOpen: true, labels: ['Town of Vallaki'] };
    const card = (miles: number, canTravel: boolean, dm = true) => worldCardHtml(N, N.pos as Vec2, miles, { ...o, dm, canTravel });
    expect(card(8.6, true)).toMatch(/<div class="wc-actions"><button data-travel>Travel here<\/button><button class="primary" data-scene="ch05\/N">Open Town of Vallaki<\/button><\/div>/);
    expect(card(0, true)).not.toContain('data-travel'); // the party is there
    expect(card(8.6, false, false)).not.toContain('data-travel'); // the players' card
    expect(card(8.6, false)).toContain('data-scene="ch05/N"');
    // a place with no map: Travel here and the no-map note
    const C = W.pins.find((p) => !p.scenes?.length)!, none = worldCardHtml(C, C.pos as Vec2, 3, { ...o, labels: [], canTravel: true });
    expect(none).toContain('<button data-travel>Travel here</button>'); expect(none).toContain('No battle map here yet');
  });
});
