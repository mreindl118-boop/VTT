import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { rect, segmentsIntersect, type Polygon, type Segment, type Vec2 } from '../app/src/core/geometry';
import type { SceneFile, Wall } from '../app/src/core/schema';

const floor = [rect(0, 0, 20, 20)];
const diagonal: Segment = { a: [0, 0], b: [20, 20] };
const west: Vec2 = [2.5, 15], east: Vec2 = [15, 2.5];
const gate = (open: boolean): Wall[] => [
  { id: 'south', a: [0, 0], b: [7.5, 7.5], flags: ['normal'] },
  { id: 'gate', a: [7.5, 7.5], b: [12.5, 12.5], flags: ['door', 'locked'], open },
  { id: 'north', a: [12.5, 12.5], b: [20, 20], flags: ['normal'] },
];

describe('movement contact with blocking segments', () => {
  it('cannot cross a diagonal wall through lattice nodes on the wall', () => {
    expect(canWalk(west, east, [diagonal], floor)).toBe(false);
    expect(canWalk(east, west, [diagonal], floor)).toBe(false);
  });

  it('cannot cross a closed locked diagonal gate at its shared wall endpoints', () => {
    expect(canWalk(west, east, moveBlockers(gate(false)), floor)).toBe(false);
    expect(canWalk(east, west, moveBlockers(gate(false)), floor)).toBe(false);
  });

  it('can cross the same gate in both directions once it is open', () => {
    expect(canWalk(west, east, moveBlockers(gate(true)), floor)).toBe(true);
    expect(canWalk(east, west, moveBlockers(gate(true)), floor)).toBe(true);
  });

  it('does not attach a requested destination on a closed blocker to either side', () => {
    expect(canWalk(west, [11.25, 11.25], [diagonal], floor)).toBe(false);
    expect(canWalk(east, [11.25, 11.25], [diagonal], floor)).toBe(false);
  });

  it('does not walk along a collinear blocker between two lattice points', () => {
    expect(canWalk([6.25, 6.25], [13.75, 13.75], [diagonal], floor)).toBe(false);
  });

  it('retains movement beside a wall and routes around a free wall end', () => {
    expect(canWalk(west, [2.5, 10], [diagonal], floor)).toBe(true);
    expect(canWalk(west, east, [{ a: [0, 0], b: [10, 10] }], floor)).toBe(true);
  });

  it('retains sight rays whose origin touches a wall', () => {
    expect(segmentsIntersect([5, 5], [10, 5], [5, 0], [5, 10])).toBe(false);
  });

  it('keeps the authored Abbey gate closed and permits its open passage', () => {
    const scene = JSON.parse(readFileSync('locations/ch08/S10/scene.json', 'utf8')) as SceneFile;
    const grid = JSON.parse(readFileSync('locations/ch08/S10/grid.json', 'utf8'));
    const level = scene.levels.find(l => l.id === 'ground')!;
    const door = level.walls.find(w => w.id === 'ground-S10-doors')!;
    expect(door.a).toEqual([150, 130]);
    expect(door.b).toEqual([157.5, 137.5]);
    const dx = door.b[0] - door.a[0], dz = door.b[1] - door.a[1], length = Math.hypot(dx, dz);
    const mid: Vec2 = [(door.a[0] + door.b[0]) / 2, (door.a[1] + door.b[1]) / 2];
    const a: Vec2 = [mid[0] - dz / length * 2.5, mid[1] + dx / length * 2.5];
    const b: Vec2 = [mid[0] + dz / length * 2.5, mid[1] - dx / length * 2.5];
    const polygons: Polygon[] = grid.levels.ground.floorPolygons;
    const blockers = (open: boolean) => moveBlockers(level.walls.map(w => w.id === door.id ? { ...w, open } : w));
    expect(canWalk(a, b, blockers(false), polygons)).toBe(false);
    expect(canWalk(b, a, blockers(false), polygons)).toBe(false);
    expect(canWalk(a, b, blockers(true), polygons)).toBe(true);
    expect(canWalk(b, a, blockers(true), polygons)).toBe(true);
  });
});
