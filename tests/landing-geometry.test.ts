import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { bounds, pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import type { SceneFile } from '../app/src/core/schema';
import * as THREE from 'three';
import { rockShelf } from '../app/src/kit/sites/wild-r';
import { buildSceneObject } from '../app/src/render/build';

function map(path: string) {
  const scene = JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8')) as SceneFile;
  const grid = JSON.parse(readFileSync(`locations/${path}/grid.json`, 'utf8'));
  return { scene, floor: (level: string): Polygon[] => grid.levels[level].floorPolygons };
}

describe('authored vertical landing geometry', () => {
  for (const [path, linkId] of [
    ['ch04/K', 'lk-k51'], ['ch09/T', 'T-stair'],
    ['ch02/R', 'R-ledge-steps'], ['ch02/R', 'R-shelf-climb'], ['ch08/S10', 'lk-road'],
  ]) it(`${path} ${linkId} permits arrival, departure and return on both floors`, () => {
    const { scene, floor } = map(path);
    const link = scene.links!.find(l => l.id === linkId)!;
    for (const endpoint of [link.from, link.to]) {
      const level = scene.levels.find(l => l.id === endpoint.level)!;
      const polys = floor(endpoint.level);
      expect.soft(polys.some(p => pointInPolygon(endpoint.pos, p)), `${endpoint.level}: endpoint on floor`).toBe(true);
      const blockers = moveBlockers(level.walls);
      // An actual five-foot departure must exist and must be reversible without
      // opening any unrelated closed door or ignoring a stairwell rail.
      const exits = Array.from({ length: 16 }, (_, i): Vec2 => [
        endpoint.pos[0] + 5 * Math.cos(i * Math.PI / 8),
        endpoint.pos[1] + 5 * Math.sin(i * Math.PI / 8),
      ]).filter(p => polys.some(poly => pointInPolygon(p, poly)));
      expect.soft(exits.some(p => canWalk(endpoint.pos, p, blockers, polys) && canWalk(p, endpoint.pos, blockers, polys)),
        `${endpoint.level}: reversible five-foot departure`).toBe(true);
    }
  });

  it('keeps the Castle secret hatch vertically registered inside both rooms', () => {
    const { scene } = map('ch04/K');
    const link = scene.links!.find(l => l.id === 'lk-k51')!;
    expect(link.from.pos).toEqual(link.to.pos);
    const upper = scene.levels.find(l => l.id === 'south-tower')!;
    const hatch = upper.objects.find(o => o.id === 'south-tower-trap-k51-top')!;
    expect([hatch.pos[0], hatch.pos[2]]).toEqual(link.to.pos);
    expect(hatch.vis).toBe('hidden-object');
    const room = upper.rooms.find(r => r.key === 'K55')!;
    const b = bounds([room.polygon]);
    expect(link.to.pos[0]).toBeGreaterThan((b.minX + b.maxX) / 2);
    expect(link.to.pos[1]).toBeLessThan((b.minZ + b.maxZ) / 2);
    expect(pointInPolygon(link.to.pos, room.polygon)).toBe(true);
    const lower = scene.levels.find(l => l.id === 'spires')!;
    expect(pointInPolygon(link.from.pos, lower.rooms.find(r => r.key === 'K51')!.polygon)).toBe(true);
    expect(upper.elevationFt - lower.elevationFt).toBe(20);
  });

  for (const [path, levelId, doorId] of [
    ['ch04/K', 'ground', 'K22-door'], ['ch04/K', 'court', 'K28-doors'],
    ['ch04/K', 'spires', 'K51-door'], ['ch04/K', 'spires', 'K49-K50'],
    ['ch04/K', 'spires', 'K49-K48'], ['ch04/K', 'south-tower', 'K54-door'],
    ['ch04/K', 'south-tower', 'K56-door'],
    ['ch08/S10', 'ground', 'ground-S10-doors'],
  ]) it(`${doorId} blocks while closed and permits a reversible passage when open`, () => {
    const { scene, floor } = map(path);
    const lv = scene.levels.find(l => l.id === levelId)!;
    const door = lv.walls.find(w => w.id === doorId)!;
    expect(door, 'authored aperture survives generation').toBeDefined();
    const dx = door.b[0] - door.a[0], dz = door.b[1] - door.a[1], length = Math.hypot(dx, dz);
    const mid: Vec2 = [(door.a[0] + door.b[0]) / 2, (door.a[1] + door.b[1]) / 2];
    const a: Vec2 = [mid[0] - dz / length * 2.5, mid[1] + dx / length * 2.5];
    const b: Vec2 = [mid[0] + dz / length * 2.5, mid[1] - dx / length * 2.5];
    const walls = (open: boolean) => moveBlockers(lv.walls.map(w => w.id === doorId ? { ...w, open } : w));
    expect(canWalk(a, b, walls(false), floor(levelId))).toBe(false);
    expect(canWalk(a, b, walls(true), floor(levelId))).toBe(true);
    expect(canWalk(b, a, walls(true), floor(levelId))).toBe(true);
  });

  it('registers both guest-room doors on its west and east walls', () => {
    const lv = map('ch04/K').scene.levels.find(l => l.id === 'spires')!;
    const b = bounds([lv.rooms.find(r => r.key === 'K50')!.polygon]);
    for (const [id, x] of [['K49-K50', b.minX], ['K51-door', b.maxX]] as const) {
      const wall = lv.walls.find(w => w.id === id)!;
      expect(wall.a[0]).toBe(x); expect(wall.b[0]).toBe(x);
    }
  });

  it('preserves the Map 7 west-to-east familiar and cauldron room relationship', () => {
    const { scene, floor } = map('ch04/K');
    const upper = scene.levels.find(l => l.id === 'south-tower')!;
    const familiar = bounds([upper.rooms.find(r => r.key === 'K54')!.polygon]);
    const cauldron = bounds([upper.rooms.find(r => r.key === 'K56')!.polygon]);
    expect(familiar.maxX).toBeLessThanOrEqual(cauldron.minX);
    expect(familiar.maxX - familiar.minX).toBe(20);
    expect(familiar.maxZ - familiar.minZ).toBe(20);
    const stair = scene.links!.find(l => l.id === 'lk-k48-st')!;
    expect(stair.from.pos).toEqual([202.5, 225]);
    expect(stair.to.pos).toEqual(stair.from.pos);
    expect(scene.links!.find(l => l.id === 'lk-k48-roof')!.to.pos).toEqual(stair.to.pos);
    expect(stair.to.pos[1]).toBeLessThan(cauldron.minZ);
    expect(pointInPolygon(stair.to.pos, upper.rooms.find(r => r.key === 'K48-t')!.polygon)).toBe(true);
    const interior: Vec2 = [175, 240];
    expect(canWalk(stair.to.pos, interior, moveBlockers(upper.walls), floor(upper.id))).toBe(true);
    expect(canWalk(interior, stair.to.pos, moveBlockers(upper.walls), floor(upper.id))).toBe(true);
  });

  it('connects Tsolenka actual flight top to the upper floor through the rail aperture', () => {
    const { scene, floor } = map('ch09/T');
    const upper = scene.levels.find(l => l.id === 'tower-upper')!;
    const flight = scene.levels.find(l => l.id === 'pass')!.objects.find(o => o.id === 'pass-T4-stair-b')!;
    const angle = (flight.rotY ?? 0) * Math.PI / 180, length = flight.dims!.len as number;
    const top: Vec2 = [flight.pos[0] + Math.cos(angle) * length, flight.pos[2] - Math.sin(angle) * length];
    const landing = scene.links!.find(l => l.id === 'T-stair')!.to.pos;
    expect(pointInPolygon(top, upper.rooms.find(r => r.key === 'T5-landing')!.polygon)).toBe(true);
    expect(canWalk(top, landing, moveBlockers(upper.walls), floor(upper.id))).toBe(true);
    expect(canWalk(landing, top, moveBlockers(upper.walls), floor(upper.id))).toBe(true);
    expect(flight.pos[1] + (flight.dims!.rise as number)).toBe(upper.elevationFt);
    expect(upper.walls.filter(w => w.heightFt === 3.5).length).toBeGreaterThanOrEqual(2);
  });

  it('puts Raven shelf arrivals on physical crown or landing-cap geometry', () => {
    const { scene } = map('ch02/R');
    const bench = scene.levels.find(l => l.id === 'bench')!;
    for (const [linkId, ledge] of [['R-ledge-steps', 1], ['R-shelf-climb', 0]] as const) {
      const link = scene.links!.find(l => l.id === linkId)!;
      const prop = bench.objects.find(o => o.kind === 'r-rock-shelf' && o.dims?.ledge === ledge)!;
      const model = rockShelf(prop.dims as Record<string, number>);
      model.position.set(...prop.pos); model.rotation.y = (prop.rotY ?? 0) * Math.PI / 180;
      const physical = new THREE.Group(); physical.add(model);
      if (ledge) physical.add(buildSceneObject(bench.objects.find(o => o.id === 'bench-ledge-head')!));
      physical.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(link.to.pos[0], 30, link.to.pos[1]), new THREE.Vector3(0, -1, 0));
      const headHits = ray.intersectObject(physical, true);
      expect(headHits.length).toBeGreaterThan(0);
      // The east ledge has the kit's 0.14-ft gravel skin above its stone crown.
      expect(headHits[0].point.y).toBeCloseTo(ledge ? 12.14 : 12, 3);
      // A valid declared bench floor is insufficient if the actual sloped rock
      // buries the lower endpoint. Test both arrivals against production meshes.
      ray.set(new THREE.Vector3(link.from.pos[0], 30, link.from.pos[1]), new THREE.Vector3(0, -1, 0));
      const aboveFoot = ray.intersectObject(physical, true).filter(hit => hit.point.y > 0.2);
      expect(aboveFoot.map(hit => hit.point.y), `${linkId}: lower arrival must be outside the rock body`).toEqual([]);
      physical.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      // Seven feet crossed only the narrow crown edge, burying the lower end.
      // The corrected 18.4133-ft run spans the whole sloped body and clear foot.
      if (!ledge) expect(Math.hypot(link.to.pos[0] - link.from.pos[0], link.to.pos[1] - link.from.pos[1])).toBeCloseTo(Math.hypot(11.6, 14.3), 6);
    }
  });

  it('keeps the Abbey road on rendered ledge polygons without making the cliff walkable', () => {
    const { scene, floor } = map('ch08/S10');
    const level = scene.levels.find(l => l.id === 'ground')!;
    const landing = scene.links!.find(l => l.id === 'lk-road')!.to.pos;
    const supports = level.objects.filter(o => o.kind === 'prism' && (o.id === 'ground-ledge' || o.id.startsWith('ground-road')));
    expect(supports.some(o => o.polygon && pointInPolygon(landing, o.polygon))).toBe(true);
    for (const outside of [[35, 80], [140, -25], [400, 175]] as Vec2[]) {
      expect(floor('ground').some(p => pointInPolygon(outside, p))).toBe(false);
    }
  });
});
