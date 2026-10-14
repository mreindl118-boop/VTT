import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { pointInPolygon, type Vec2 } from '../app/src/core/geometry';
import { squareCellAt, squareCellCenter } from '../app/src/core/grid';
import { verticalArrival } from '../app/src/core/verticalLinks';
import { validateScene, type GridFile, type SceneFile, type Wall } from '../app/src/core/schema';
import { stairsStraight } from '../app/src/kit/pieces';

const scene = JSON.parse(readFileSync('locations/ch03/E5/scene.json', 'utf8')) as SceneFile;
const grid = JSON.parse(readFileSync('locations/ch03/E5/grid.json', 'utf8')) as GridFile;
const ground = scene.levels.find(l => l.id === 'ground')!;
const lower = scene.levels.find(l => l.id === 'undercroft')!;
const floor = (id: string) => grid.levels[id].floorPolygons;
const doorIds = [52, 53, 54, 55, 56].map(i => `ground-w-${i}`);
const roomCentres: Vec2[] = [[22.5, 12.5], [22.5, 33.75], [10, 29], [10, 38], [35, 29], [35, 38]];

function overlap(a: Wall, b: Wall): number {
  const dx = a.b[0] - a.a[0], dz = a.b[1] - a.a[1], length = Math.hypot(dx, dz);
  const cross = (p: Vec2) => dx * (p[1] - a.a[1]) - dz * (p[0] - a.a[0]);
  if (Math.abs(cross(b.a)) > 1e-7 || Math.abs(cross(b.b)) > 1e-7) return 0;
  const project = (p: Vec2) => ((p[0] - a.a[0]) * dx + (p[1] - a.a[1]) * dz) / length;
  const ends = [project(b.a), project(b.b)].sort((x, y) => x - y);
  return Math.max(0, Math.min(length, ends[1]) - Math.max(0, ends[0]));
}

describe('E5 church authored apertures and undercroft access', () => {
  it('remains a valid two-level church with the same keyed rooms', () => {
    expect(validateScene(scene, grid)).toEqual([]);
    expect(scene.parent).toBe('ch03/E');
    expect(scene.levels.flatMap(l => l.rooms.map(r => r.key)).sort()).toEqual(['E5a', 'E5b', 'E5c', 'E5d', 'E5e', 'E5f', 'E5g']);
  });

  it.each(doorIds)('%s opens its actual aperture but still blocks while closed', id => {
    const door = ground.walls.find(w => w.id === id)!;
    expect(door.flags).toContain('door');
    expect(door.open).toBe(false);
    const dx = door.b[0] - door.a[0], dz = door.b[1] - door.a[1], length = Math.hypot(dx, dz);
    const mid: Vec2 = [(door.a[0] + door.b[0]) / 2, (door.a[1] + door.b[1]) / 2];
    const a: Vec2 = [mid[0] - dz / length * 2, mid[1] + dx / length * 2];
    const b: Vec2 = [mid[0] + dz / length * 2, mid[1] - dx / length * 2];
    const blockers = (open: boolean) => moveBlockers(ground.walls.map(w => ({ ...w, open: w.id === id && open })));
    for (const [from, to] of [[a, b], [b, a]]) {
      expect(canWalk(from, to, blockers(false), floor('ground'))).toBe(false);
      expect(canWalk(from, to, blockers(true), floor('ground'))).toBe(true);
    }
  });

  it('has no ordinary blocking wall over any door or window interval', () => {
    const apertures = ground.walls.filter(w => w.flags.some(f => f === 'door' || f === 'window'));
    expect(apertures).toHaveLength(11);
    for (const aperture of apertures) for (const wall of ground.walls.filter(w => w.flags.includes('normal'))) {
      expect(overlap(aperture, wall), `${aperture.id} overlapped by ${wall.id}`).toBeLessThan(1e-7);
    }
  });

  it('keeps the hall open into the chapel and all six rooms reachable from the front entrance', () => {
    const closed = moveBlockers(ground.walls);
    expect(canWalk([22.5, 27.5], [22.5, 22.5], closed, floor('ground'))).toBe(true);
    const open = moveBlockers(ground.walls.map(w => ({ ...w, open: w.flags.includes('door') })));
    for (const centre of roomCentres) {
      expect(canWalk([20, 47.5], centre, open, floor('ground')), `entry to ${centre}`).toBe(true);
      expect(canWalk(centre, [20, 47.5], open, floor('ground')), `${centre} to entry`).toBe(true);
    }
  });

  it('retains windows and all surrounding exterior walls as movement barriers', () => {
    for (const id of [57, 58, 59, 60, 61, 62].map(i => `ground-w-${i}`)) {
      const window = ground.walls.find(w => w.id === id)!;
      expect(window.flags).toEqual(['window']);
      const mid: Vec2 = [(window.a[0] + window.b[0]) / 2, (window.a[1] + window.b[1]) / 2];
      const vertical = window.a[0] === window.b[0];
      const a: Vec2 = [mid[0] + (vertical ? -2 : 0), mid[1] + (vertical ? 0 : -2)];
      const b: Vec2 = [mid[0] + (vertical ? 2 : 0), mid[1] + (vertical ? 0 : 2)];
      expect(canWalk(a, b, moveBlockers(ground.walls), floor('ground'))).toBe(false);
    }
  });

  it('uses a 15-ft descent and an earth floor under the church', () => {
    expect(ground.elevationFt - lower.elevationFt).toBe(15);
    expect(lower.rooms.find(r => r.key === 'E5g')!.floor).toBe('dirt');
    expect(lower.ceilingFt).toBe(15);
    expect(lower.elevationFt + lower.ceilingFt!).toBe(ground.elevationFt);
  });

  it('supports the southern stair projection without making its exterior walkable', () => {
    const contains = (p: Vec2) => floor('undercroft').some(poly => pointInPolygon(p, poly));
    // The old raw and snapped landing must lie inside the physical lower room,
    // preserving recoverability for saved characters at that former endpoint.
    expect(contains([35, 38])).toBe(true);
    expect(contains([37.5, 37.5])).toBe(true);
    for (const outside of [[2.5, 37.5], [42.5, 37.5], [35, 45]] as Vec2[]) expect(contains(outside)).toBe(false);
    expect(canWalk([37.5, 37.5], [22.5, 15], moveBlockers(lower.walls), floor('undercroft'))).toBe(true);
  });

  it('gives both raw and snapped transition arrivals usable local exits', () => {
    const link = scene.links.find(k => k.id === 'lk-ground-undercroft')!;
    for (const endpoint of [link.from, link.to]) {
      const level = scene.levels.find(l => l.id === endpoint.level)!;
      const blockers = moveBlockers(level.walls);
      const snapped = squareCellCenter(squareCellAt(endpoint.pos));
      const arrival = verticalArrival(endpoint.pos, [0, 0], floor(level.id), blockers);
      const roomExit: Vec2 = level.id === 'ground' ? [32.5, 37.5] : [30, 27.5];
      for (const pos of [endpoint.pos, snapped, arrival]) {
        expect(floor(level.id).some(poly => pointInPolygon(pos, poly)), `${level.id}/${pos}`).toBe(true);
        expect(canWalk(pos, roomExit, blockers, floor(level.id)), `${level.id}/${pos} exits`).toBe(true);
      }
    }
  });

  it('aligns the actual stair mesh with its lower arrival and upper trapdoor', () => {
    const flight = lower.objects.find(o => o.id === 'undercroft-p7')!;
    const trapdoor = ground.objects.find(o => o.id === 'ground-p20')!;
    const link = scene.links.find(k => k.id === 'lk-ground-undercroft')!;
    expect(flight.rotY ?? 0).toBe(0);
    expect([flight.pos[0], flight.dims!.fromZ]).toEqual(link.to.pos);
    expect([flight.pos[0], flight.dims!.toZ]).toEqual(link.from.pos);
    expect(link.from.pos).toEqual([trapdoor.pos[0], trapdoor.pos[2]]);
    const { mesh } = stairsStraight(flight.dims as Record<string, number>, [flight.pos[0], flight.pos[2]]);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    expect(box.max.y + lower.elevationFt + flight.pos[1]).toBe(ground.elevationFt);
    expect(box.min.z).toBe(Math.min(link.to.pos[1], link.from.pos[1]));
    expect(box.max.z).toBe(Math.max(link.to.pos[1], link.from.pos[1]));
    mesh.geometry.dispose();
  });
});
