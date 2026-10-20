// The castle's gate is the castle's own (item 2g-1; owner 2026-10-19, of the Gates of Ravenloft map: "this looks cool but
// it's supposed to be attached to and part of Ravenloft and the new improved 3D model"). Read off the scenes the
// generators write (scripts/authoring/castle-ravenloft.py and wild_j.py), under the rules the app draws and walks by:
// Castle Ravenloft (ch04/K) carries its front as one model with the keep, the courtyard and the bridge (the gatehouse
// with its two gate towers and the tunnel, the drawbridge on its chains, the portcullis, the gargoyles on the wall top);
// the Gates of Ravenloft (ch02/J) are the road gate on the approach, with no wall, gate or bridge of their own, the
// castle across the chasm only a stand-in the continuous world hides; and both still play.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { WORLD_STANDINS } from '../app/src/core/siteInterfaces';
import type { GridFile, Level, SceneFile, SceneObject, Wall } from '../app/src/core/schema';

const load = (path: string) => ({ scene: JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8')) as SceneFile, grid: JSON.parse(readFileSync(`locations/${path}/grid.json`, 'utf8')) as GridFile });
const K = load('ch04/K'), J = load('ch02/J');
type Map_ = ReturnType<typeof load>;
const levelOf = (m: Map_, id: string) => m.scene.levels.find((l) => l.id === id)!;
const floorOf = (m: Map_, l: Level) => [...m.grid.levels[l.id].floorPolygons, ...l.rooms.map((r) => r.polygon)] as Polygon[];
const roomOf = (l: Level, key: string) => l.rooms.find((r) => r.key === key);
const boxOf = (p: Polygon) => ({ x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) });
const kindsIn = (l: Level, kind: string) => l.objects.filter((o) => o.kind === kind);
const at = (o: SceneObject): Vec2 => [o.pos[0], o.pos[2]];
const drawn = (w: Wall) => !w.flags.includes('invisible') && !w.flags.includes('ethereal');
const mid = (w: Wall): Vec2 => [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
/** A point on the floor inside the polygon: its centroid, or the first 2.5-ft lattice point inside it that is on floor. */
function inside(poly: Polygon, floor: Polygon[]): Vec2 | undefined {
  const c: Vec2 = [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  if (pointInPolygon(c, poly) && floor.some((f) => pointInPolygon(c, f))) return c;
  const b = boxOf(poly);
  for (let z = b.z0 + 1.25; z < b.z1; z += 2.5) for (let x = b.x0 + 1.25; x < b.x1; x += 2.5) if (pointInPolygon([x, z], poly) && floor.some((f) => pointInPolygon([x, z], f))) return [x, z];
  return undefined;
}

describe('Castle Ravenloft: the gate is the castle\'s own front', () => {
  const g = levelOf(K, 'ground');

  it('a gatehouse stands on the west wall: two gate towers either side of a tunnel twenty feet wide, from the chasm\'s lip to the courtyard', () => {
    const tunnel = roomOf(g, 'K1-g'), north = roomOf(g, 'K1-tn'), south = roomOf(g, 'K1-ts'), yard = roomOf(g, 'K1')!;
    expect(tunnel && north && south, 'the tunnel and the two gate towers').toBeTruthy();
    const t = boxOf(tunnel!.polygon), n = boxOf(north!.polygon), s = boxOf(south!.polygon), c = boxOf(yard.polygon);
    expect(t.z1 - t.z0, 'the tunnel as wide as the gate (map 2: two 10-ft squares)').toBeGreaterThanOrEqual(20);
    expect(t.x0, 'the tunnel runs out to the gatehouse\'s face, forward of the curtain\'s outer face').toBeLessThan(0);
    expect(t.x1, 'and through the wall to the courtyard').toBeGreaterThanOrEqual(c.x0);
    expect(n.z1, 'the north tower north of the tunnel').toBeLessThanOrEqual(t.z0);
    expect(s.z0, 'the south tower south of it').toBeGreaterThanOrEqual(t.z1);
    // each tower: an ironbound door with a lock, from its floor onto the courtyard
    const floor = floorOf(K, g);
    for (const tower of [north!, south!]) {
      const doors = g.walls.filter((w) => w.flags.includes('door') && w.flags.includes('locked')).filter((w) => {
        const m = mid(w), dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz), nrm: Vec2 = [-dz / L, dx / L];
        const sides = [-3, 3].map((k): Vec2 => [m[0] + nrm[0] * k, m[1] + nrm[1] * k]);
        return sides.some((p) => pointInPolygon(p, tower.polygon)) && sides.some((p) => pointInPolygon(p, yard.polygon));
      });
      expect(doors.length, `${tower.key}: a locked door onto the courtyard`).toBe(1);
      expect(floor.some((f) => pointInPolygon(inside(tower.polygon, floor)!, f)), `${tower.key} has floor`).toBe(true);
    }
    // the gatehouse rises over the curtain's walk (90 ft): its towers are hollow to their heads
    const towerWalls = g.walls.filter((w) => drawn(w) && [north!, south!].some((r) => { const b = boxOf(r.polygon); const m = mid(w); return m[0] >= b.x0 - 6 && m[0] <= b.x1 + 6 && m[1] >= b.z0 - 6 && m[1] <= b.z1 + 6; }));
    expect(towerWalls.length).toBeGreaterThan(5);
    expect(towerWalls.every((w) => (w.heightFt ?? 0) > 90 && (w.thicknessFt ?? 0) >= 4), 'every gate-tower wall a storey over the walk, 4 ft or more thick').toBe(true);
    // the masonry over the tunnel and the towers' battlements are the castle's shell pieces
    expect(kindsIn(g, 'k-gate-arch').length).toBe(1);
    expect(kindsIn(g, 'k-tower-head').length).toBe(2);
  });

  it('the drawbridge spans the chasm from the gatehouse to the far lip, open to the sky, on two chains that run up into slots in the gatehouse\'s face', () => {
    const tunnel = boxOf(roomOf(g, 'K1-g')!.polygon), bridge = roomOf(g, 'K1-bridge')!, b = boxOf(bridge.polygon);
    const decks = kindsIn(g, 'j-drawbridge');
    expect(decks.length, 'one drawbridge').toBe(1);
    const deck = decks[0], hinge = deck.pos[0], end = hinge - deck.dims!.len;
    expect(Math.abs(hinge - tunnel.x0), 'hinged at the tunnel\'s mouth').toBeLessThan(1.5);
    expect(end, 'its free end out over the far lip').toBeLessThanOrEqual(b.x0);
    expect(deck.dims!.w, 'as wide as the walkway').toBeGreaterThanOrEqual(b.z1 - b.z0);
    // nothing walls the bridge in: no drawn wall stands on it or along its sides or its far end (the gatehouse's face it
    // meets is the gate's)
    const walled = g.walls.filter((w) => { const m = mid(w); return drawn(w) && m[0] >= b.x0 - 0.01 && m[0] < b.x1 - 0.1 && m[1] >= b.z0 - 0.01 && m[1] <= b.z1 + 0.01; });
    expect(walled.map((w) => w.id), 'no wall along the drawbridge').toEqual([]);
    // the chains: from the eyes at the deck's free end up into their slots, both in the gatehouse's face
    const chains = kindsIn(g, 'k-chain'), slots = kindsIn(g, 'k-chain-slot');
    expect(chains.length).toBe(2);
    expect(slots.length).toBe(2);
    for (const c of chains) {
      expect(Math.abs(c.pos[0] - (end + 1.3)), `${c.id}: from the eye at the free end`).toBeLessThan(0.5);
      const top: [number, number, number] = [c.pos[0] + c.dims!.dx + 0.4, c.pos[1] + c.dims!.rise, c.pos[2] + c.dims!.dz];
      const slot = slots.find((s) => Math.hypot(s.pos[0] - top[0], s.pos[1] - top[1], s.pos[2] - top[2]) < 0.5);
      expect(slot, `${c.id}: into a slot`).toBeTruthy();
      expect(Math.abs(slot!.pos[0] - tunnel.x0), `${slot!.id}: in the gatehouse's face`).toBeLessThan(0.5);
    }
  });

  it('in the continuous world the chasm is open under the drawbridge: the valley\'s land drops away there, not paved level with the deck', () => {
    // the atlas (scripts/world-atlas.ts, from core/siteInterfaces.ts) hands the land a ground cut over the chasm the scene
    // draws (its 'chasm' prop: 50 ft across the road, the castle's length along the wall, faces drawn 400 ft down)
    const atlas = JSON.parse(readFileSync('manifests/world-atlas.json', 'utf8')) as { scenes: Record<string, { groundCuts?: { bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; floor: number }[] }> };
    const chasm = kindsIn(g, 'chasm');
    expect(chasm.length).toBe(1);
    const c = chasm[0], x0 = c.pos[0] - c.dims!.w / 2, x1 = c.pos[0] + c.dims!.w / 2, z0 = c.pos[2] - c.dims!.len / 2, z1 = c.pos[2] + c.dims!.len / 2;
    const under = (atlas.scenes['ch04/K'].groundCuts ?? []).filter((k) => k.bounds.minX <= c.pos[0] && k.bounds.maxX >= c.pos[0] && k.bounds.minZ <= c.pos[2] && k.bounds.maxZ >= c.pos[2]);
    expect(under.length, 'a ground cut where the road crosses the chasm').toBe(1);
    const cut = under[0];
    expect([cut.bounds.minX, cut.bounds.maxX, cut.bounds.minZ, cut.bounds.maxZ], 'the chasm\'s own span').toEqual([x0, x1, z0, z1]);
    const deck = kindsIn(g, 'j-drawbridge')[0];
    expect(deck.pos[0] - deck.dims!.len <= x0 && deck.pos[0] >= x1 - 1, 'the drawbridge spans it, from the far lip to the gatehouse').toBe(true);
    expect(cut.floor, 'far below the deck, as deep as the chasm\'s faces are drawn').toBeLessThanOrEqual(g.elevationFt - 400);
  });

  it('the rotting portcullis hangs over the tunnel with its slime, the latches stand in the towers, the gargoyles lean from the wall top', () => {
    const tunnel = roomOf(g, 'K1-g')!, t = boxOf(tunnel.polygon);
    const port = kindsIn(g, 'rotten-portcullis');
    expect(port.length).toBe(1);
    expect(pointInPolygon(at(port[0]), tunnel.polygon), 'the portcullis in the tunnel').toBe(true);
    expect(port[0].dims!.w, 'as wide as the tunnel').toBe(t.z1 - t.z0);
    const slime = kindsIn(g, 'green-slime');
    expect(slime.length === 1 && slime[0].vis === 'hidden-object' && pointInPolygon(at(slime[0]), tunnel.polygon)).toBe(true);
    for (const key of ['K1-tn', 'K1-ts']) expect(kindsIn(g, 'j-latch').filter((o) => o.vis === 'hidden-object' && pointInPolygon(at(o), roomOf(g, key)!.polygon)).length, key).toBe(1);
    const gargoyles = kindsIn(g, 'k-wall-gargoyle');
    expect(gargoyles.length).toBeGreaterThanOrEqual(4);
    expect(gargoyles.every((o) => o.pos[1] >= 85 && o.pos[0] >= 0 && o.pos[0] <= 5), 'on the west wall\'s top, at its outer edge').toBe(true);
    // the castle's own round gate towers standing out in the chasm, and its old plain bridge, are gone
    expect(kindsIn(g, 'gate-tower').length + kindsIn(g, 'drawbridge').length).toBe(0);
  });

  it('the party walks off the drawbridge, through the tunnel and into the courtyard; the gate towers open from the courtyard', () => {
    const floor = floorOf(K, g), walls = moveBlockers(g.walls);
    const bridge = boxOf(roomOf(g, 'K1-bridge')!.polygon), z = (bridge.z0 + bridge.z1) / 2;
    const onBridge: Vec2 = [bridge.x0 + 7.5, z], inTunnel: Vec2 = [5, z], inYard: Vec2 = [37.5, z];
    expect(canWalk(onBridge, inTunnel, walls, floor), 'bridge to tunnel').toBe(true);
    expect(canWalk(inTunnel, inYard, walls, floor), 'tunnel to courtyard').toBe(true);
    expect(canWalk(inYard, onBridge, walls, floor), 'and back out').toBe(true);
    const open = moveBlockers(g.walls.map((w) => (w.flags.includes('door') ? { ...w, open: true } : w)));
    for (const key of ['K1-tn', 'K1-ts']) expect(canWalk(inYard, inside(roomOf(g, key)!.polygon, floor)!, open, floor), `courtyard to ${key}, its door open`).toBe(true);
    expect(canWalk(inYard, inside(roomOf(g, 'K1-tn')!.polygon, floor)!, walls, floor), 'not through its locked door').toBe(false);
  });
});

describe('the Gates of Ravenloft: the road gate on the approach', () => {
  const l = levelOf(J, 'ground');
  const CASTLE = ['curtain-wall', 'rotten-portcullis', 'j-gate-tower', 'j-lit-doorway', 'j-drawbridge', 'j-chain', 'j-chain-slot', 'j-hinge-sill', 'j-wall-gargoyle', 'j-latch', 'j-slot-iron', 'j-weak-board', 'green-slime', 'j-watcher'];

  it('no wall, gate, bridge or fitting of the castle is J\'s own: across the chasm the castle is a stand-in the continuous world hides', () => {
    const own = J.scene.levels.flatMap((lv) => lv.objects.filter((o) => CASTLE.includes(o.kind)).map((o) => `${lv.id}/${o.id} ${o.kind}`));
    expect(own).toEqual([]);
    expect(J.scene.levels.map((lv) => lv.id)).not.toContain('wall-walk');
    const keys = J.scene.levels.flatMap((lv) => lv.rooms.map((r) => r.key));
    for (const gone of ['J-bridge', 'J-gate', 'J-ntower', 'J-stower', 'J-court', 'J-walk']) expect(keys, gone).not.toContain(gone);
    expect(J.scene.levels.flatMap((lv) => lv.walls).length, 'no wall of the castle\'s in J').toBe(0);
    // what stands at J: the road's end between the two broken turrets, the sill the castle's drawbridge comes down on
    expect(kindsIn(l, 'j-turret').length).toBe(2);
    expect(kindsIn(l, 'j-bridge-sill').length).toBe(1);
    const stand = kindsIn(l, 'j-castle-mass');
    expect(stand.length).toBe(1);
    expect(WORLD_STANDINS.has('j-castle-mass'), 'a stand-in: hidden where the continuous world draws the castle itself').toBe(true);
    expect(stand[0].dims!.front, 'the stand-in carries the castle\'s front where the world is off').toBe(1);
    // its drawbridge comes down on J's sill
    const sill = kindsIn(l, 'j-bridge-sill')[0];
    expect(Math.abs(stand[0].pos[0] + (stand[0].dims!.ox ?? 0) + stand[0].dims!.sill - sill.pos[0]), 'the stand-in\'s bridge rests on the sill').toBeLessThan(0.5);
  });

  it('J still plays: the party starts on floor free to step every way, every area is reachable, the rope lands on the ledge', () => {
    const floor = floorOf(J, l), walls = moveBlockers(l.walls);
    const sp = l.objects.find((o) => o.kind === 'spawn')!;
    const start: Vec2 = [Math.floor(sp.pos[0] / 5) * 5 + 2.5, Math.floor(sp.pos[2] / 5) * 5 + 2.5];
    expect(floor.some((f) => pointInPolygon(start, f)), 'spawn on floor').toBe(true);
    for (const d of [[5, 0], [-5, 0], [0, 5], [0, -5]] as Vec2[]) expect(canWalk(start, [start[0] + d[0], start[1] + d[1]], walls, floor), `step ${d}`).toBe(true);
    for (const r of l.rooms) expect(canWalk(start, inside(r.polygon, floor)!, walls, floor), r.key).toBe(true);
    for (const k of J.scene.links) for (const e of [k.from, k.to]) {
      const lv = levelOf(J, e.level), f = floorOf(J, lv);
      expect(f.some((p) => pointInPolygon(e.pos as Vec2, p)), `${k.id} at ${e.level}`).toBe(true);
      if (e.level === 'ground') expect(canWalk(start, e.pos as Vec2, walls, floor), `${k.id}: reached from the start`).toBe(true);
    }
  });
});
