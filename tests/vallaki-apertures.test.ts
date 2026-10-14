import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers, sightBlockers } from '../app/src/core/light';
import { pointInPolygon, segmentsIntersect, type Polygon, type Vec2 } from '../app/src/core/geometry';
import type { GridFile, SceneFile, Wall } from '../app/src/core/schema';

const load = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../locations/${path}`, import.meta.url), 'utf8')) as T;
const scenes = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 9].map(n => [`N${n}`, load<SceneFile>(`ch05/N${n}/scene.json`)]));
const grids = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 9].map(n => [`N${n}`, load<GridFile>(`ch05/N${n}/grid.json`)]));
const level = (map: string, id: string) => scenes[map].levels.find(l => l.id === id)!;
const floor = (map: string, id: string): Polygon[] => grids[map].levels[id].floorPolygons;

describe('Vallaki generated aperture geometry', () => {
  it('connects the large guest room to the east guest balcony without flooring the taproom void', () => {
    // Printed p99: N2m opens north onto N2k, at its north-east corner.
    const upper = level('N2', 'upper'), polygons = floor('N2', 'upper');
    const door = upper.walls.find(w => w.id === 'N2m-door')!;
    expect(door.a).toEqual([150, 97.5]);
    expect(door.b).toEqual([155, 97.5]);
    for (const p of [[152.5, 95.5], [152.5, 99.5]] as Vec2[]) {
      expect(polygons.some(poly => pointInPolygon(p, poly))).toBe(true);
    }
    for (const p of [[122.5, 60], [122.5, 95.5]] as Vec2[]) {
      expect(polygons.some(poly => pointInPolygon(p, poly)), 'The taproom remains open to below').toBe(false);
    }
    const from: Vec2 = [152.5, 90], to: Vec2 = [122.5, 110];
    expect(canWalk(from, to, moveBlockers(upper.walls), polygons)).toBe(false);
    const opened = upper.walls.map(w => w.id === 'N2m-door' ? { ...w, open: true } : w);
    expect(canWalk(from, to, moveBlockers(opened), polygons)).toBe(true);
  });

  it('gives the guest-room doorway a full wall height rather than railing metadata', () => {
    const upper = level('N2', 'upper');
    const door = upper.walls.find(w => w.id === 'N2m-door')!;
    expect(door.heightFt).toBeUndefined();
    expect(door.flags).toEqual(['door']);
    const voidEdge = upper.walls.filter(w => w.a[1] === 97.5 && w.b[1] === 97.5 && w.a[0] >= 105 && w.b[0] <= 147.5);
    expect(voidEdge.length).toBeGreaterThan(0);
    expect(voidEdge.every(w => w.flags.includes('normal') && w.heightFt === undefined)).toBe(true);
  });

  it('closes the front doorway and its flanks, then opens only the authored entrance', () => {
    const walls = level('N2', 'ground').walls, polygons = floor('N2', 'ground');
    const closed = walls.map(w => ({ ...w, open: false }));
    for (const x of [115, 118.75, 126.25, 132.5, 137.5]) {
      expect(canWalk([x, 102.5], [x, 97.5], moveBlockers(closed), polygons), `Closed frontage at x=${x}`).toBe(false);
    }
    const opened = closed.map(w => w.id === 'N2c-front' ? { ...w, open: true } : w);
    expect(canWalk([126.25, 102.5], [126.25, 97.5], moveBlockers(opened), polygons)).toBe(true);
    for (const x of [115, 118.75, 132.5, 137.5]) {
      expect(moveBlockers(opened).some(w => segmentsIntersect([x, 102.5], [x, 97.5], w.a, w.b))).toBe(true);
    }
  });

  // Printed plan p111: the two short horizontal sides of the den's bay.
  // Keep the authored outline; place its existing window requests on that outline.
  for (const z of [35, 70]) it(`places the den's bay window on its z=${z} boundary`, () => {
    const walls = level('N4', 'ground').walls;
    const window = walls.find(w => w.flags.includes('window') && w.a[0] === 15 && w.b[0] === 20 && w.a[1] === z && w.b[1] === z);
    expect(window, 'The requested bay window must be generated on the room boundary').toBeDefined();
    const from: Vec2 = [17.5, z - 2], to: Vec2 = [17.5, z + 2];
    expect(moveBlockers(walls).filter(w => segmentsIntersect(from, to, w.a, w.b))).toHaveLength(1);
    expect(sightBlockers(walls).some(w => segmentsIntersect(from, to, w.a, w.b))).toBe(false);
    expect(canWalk(from, to, moveBlockers(walls), floor('N4', 'ground'))).toBe(false);
  });

  it('places the locked wagon door on its rear boundary', () => {
    const wagon = level('N5', 'yard').rooms.find(r => r.key === 'N5d')!;
    // The accepted authored wagon has its front seat to the north; p115 calls for a rear door.
    const door = level('N5', 'yard').walls.find(w => w.id === 'N5d-door');
    expect(door).toBeDefined();
    expect(door!.a).toEqual([52.5, 110]);
    expect(door!.b).toEqual([57.5, 110]);
    expect(Math.max(...wagon.polygon.map(p => p[1]))).toBe(110);
    expect(door!.flags).toEqual(['door', 'locked']);
    expect(door!.open).toBe(false);
  });

  it('blocks the locked wagon and admits movement only after its door opens', () => {
    const walls = level('N5', 'yard').walls;
    const from: Vec2 = [55, 112.5], to: Vec2 = [55, 107.5];
    expect(walls.some(w => w.id === 'N5d-door')).toBe(true);
    expect(canWalk(from, to, moveBlockers(walls), floor('N5', 'yard'))).toBe(false);
    const opened = walls.map(w => w.id === 'N5d-door' ? { ...w, open: true } : w);
    expect(canWalk(from, to, moveBlockers(opened), floor('N5', 'yard'))).toBe(true);
  });

  // Replays the 19 previously blocked Vallaki cross-sections from the all-map
  // movement audit against complete current production floors and walls.
  const probes: [string, string, string, Vec2, Vec2][] = [
    ['N2', 'ground', 'N2d-kitchen', [87.5, 44.5], [87.5, 40.5]],
    ['N2', 'ground', 'N2e-taproom', [103, 17.5], [107, 17.5]],
    ['N2', 'ground', 'ground-sd-kitchen-stair', [62.5, 44.5], [62.5, 40.5]],
    ['N2', 'upper', 'N2p-door', [90.5, 27.5], [94.5, 27.5]],
    ['N2', 'upper', 'N2o-door', [90.5, 67.5], [94.5, 67.5]],
    ['N2', 'upper', 'N2l-door', [155.5, 67.5], [159.5, 67.5]],
    ['N2', 'upper', 'upper-sd-loft-bedroom', [58, 47.5], [62, 47.5]],
    ['N3', 'ground', 'N3h-f', [40.5, 27.5], [44.5, 27.5]],
    ['N3', 'ground', 'N3g-hall', [40.5, 57.5], [44.5, 57.5]],
    ['N3', 'upper', 'N3n-door', [58, 22.5], [62, 22.5]],
    ['N3', 'upper', 'N3p-door', [37.5, 47], [37.5, 43]],
    ['N3', 'upper', 'N3l-south', [77.5, 87], [77.5, 83]],
    ['N3', 'upper', 'N3k-gallery', [135.5, 27.5], [139.5, 27.5]],
    ['N4', 'ground', 'N4c-pantry-door', [112.5, 77], [112.5, 73]],
    ['N4', 'ground', 'ground-sd-closet-stair', [83, 30], [87, 30]],
    ['N4', 'upper', 'N4m-n-door', [103, 27.5], [107, 27.5]],
    ['N4', 'upper', 'N4o-door', [103, 62.5], [107, 62.5]],
    ['N6', 'ground', 'N6b-a', [62.5, 102], [62.5, 98]],
    ['N6', 'ground', 'N6c-a', [43, 87.5], [47, 87.5]],
  ];
  for (const [map, id, doorId, from, to] of probes) it(`${map}/${id} admits the opened ${doorId} aperture`, () => {
    const walls = level(map, id).walls;
    const door = walls.find(w => w.id === doorId);
    expect(door).toBeDefined();
    expect(moveBlockers(walls).some(w => segmentsIntersect(from, to, w.a, w.b))).toBe(true);
    // Matches App's resolved secret-wall projection after reveal and opening.
    const opened: Wall[] = walls.map(w => w.id !== doorId ? w : {
      ...w, flags: w.flags.includes('secret-door') ? ['door'] : w.flags, open: true,
    });
    expect(canWalk(from, to, moveBlockers(opened), floor(map, id))).toBe(true);
  });
});
