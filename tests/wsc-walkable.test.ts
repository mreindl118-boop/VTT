import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { pointInPolygon, type Vec2 } from '../app/src/core/geometry';
import type { GridFile, SceneFile } from '../app/src/core/schema';

const scene: SceneFile = JSON.parse(readFileSync('locations/wsc/02-street/scene.json', 'utf8'));
const grid: GridFile = JSON.parse(readFileSync('locations/wsc/02-street/grid.json', 'utf8'));
const level = scene.levels[0], floor = grid.levels.L0.floorPolygons;
const spawnObject = level.objects.find(o => o.kind === 'spawn')!;
const spawn: Vec2 = [spawnObject.pos[0], spawnObject.pos[2]];
const supported = (point: Vec2) => floor.some(p => pointInPolygon(point, p));
const blockers = (stableOpen = false) => moveBlockers(level.walls.map(w =>
  w.id === 'sq-stable-door' ? { ...w, open: stableOpen } : w));

describe('Sheep Chase square outdoor movement', () => {
  it('supports the existing tavern-side spawn and permits a five-foot departure', () => {
    expect(spawn).toEqual([50, 67.5]);
    expect(supported(spawn)).toBe(true);
    expect(canWalk(spawn, [50, 72.5], blockers(), floor)).toBe(true);
  });

  it.each([
    ['west street', [2.5, 105]], ['east lane', [167.5, 105]],
    ['temple yard', [52.5, 155]], ['tavern yard', [102.5, 62.5]],
    ['northwest grass', [2.5, 27.5]], ['southeast grass', [177.5, 192.5]],
  ] as [string, Vec2][])('connects the square to %s with doors closed', (_, point) => {
    expect(supported(point)).toBe(true);
    expect(canWalk([75, 105], point, blockers(), floor)).toBe(true);
  });

  it('makes the full unobstructed ring circuit walkable, including the yard gaps', () => {
    const ring: Vec2[] = Array.from({ length: 16 }, (_, i) =>
      [75 + 37.5 * Math.cos(i * Math.PI / 8), 105 + 37.5 * Math.sin(i * Math.PI / 8)]);
    for (let i = 0; i < ring.length; i++) {
      expect(supported(ring[i]), `ring point ${i}`).toBe(true);
      expect(canWalk(ring[i], ring[(i + 1) % ring.length], blockers(), floor), `ring edge ${i}`).toBe(true);
    }
  });

  it('keeps the stable interior behind its real door and permits entry only when opened', () => {
    const outside: Vec2 = [77.5, 42.5], inside: Vec2 = [82.5, 42.5];
    expect(supported(outside)).toBe(true);
    expect(supported(inside)).toBe(true);
    expect(canWalk(outside, inside, blockers(), floor)).toBe(false);
    expect(canWalk(outside, inside, blockers(true), floor)).toBe(true);
    expect(canWalk(inside, outside, blockers(true), floor)).toBe(true);
  });

  it.each([
    ['tavern shell', [42.5, 32.5]], ['temple', [75, 167.5]], ['town hall', [155, 55]],
    ['southeast house', [150, 160]], ['southwest house', [20, 160]],
    ['west house', [10, 75]], ['northeast house', [160, -5]], ['southern house', [125, 190]],
    ['outside the rendered ground', [200, 105]],
  ] as [string, Vec2][])('does not add outdoor floor inside %s', (_, point) => {
    expect(supported(point)).toBe(false);
    expect(canWalk([75, 105], point, blockers(true), floor)).toBe(false);
  });

  // Ground-level boxes in props.ts/temple extend beyond its nominal 30x45-ft body.
  it.each([
    ['closed door near edge', [75, 190.25]], ['closed door centre', [75, 190.3]],
    ['west first buttress', [59.4, 161.875]], ['east first buttress', [90.6, 161.875]],
    ['west second buttress', [59.4, 173.125]], ['east second buttress', [90.6, 173.125]],
    ['west plinth edge', [59.75, 155]], ['north plinth edge', [75, 144.75]],
  ] as [string, Vec2][])('excludes the solid temple %s', (_, point) => {
    expect(supported(point)).toBe(false);
    expect(canWalk([75, 105], point, blockers(), floor)).toBe(false);
  });

  it.each([
    ['west buttress edge', [58.3, 161.875]], ['east buttress edge', [91.7, 161.875]],
    ['west wall', [57.5, 170]], ['east wall', [92.5, 170]],
    ['north approach', [75, 142.5]], ['closed door approach', [75, 192.5]],
  ] as [string, Vec2][])('preserves the outdoor route beside the temple %s', (_, point) => {
    expect(supported(point)).toBe(true);
    expect(canWalk([75, 105], point, blockers(), floor)).toBe(true);
  });
});
