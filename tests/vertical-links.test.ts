import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { VerticalTransitions, verticalArrival } from '../app/src/core/verticalLinks';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { rect } from '../app/src/core/geometry';
import type { SceneFile, GridFile, VerticalLink } from '../app/src/core/schema';

const scene = (path: string): SceneFile => JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8'));
const stairs = scene('appB/death-house').links;

describe('vertical transitions', () => {
  it('resolves every authored direction to exactly its requested endpoint, independent of array order', () => {
    const inventory = JSON.parse(readFileSync('docs/handoff/allmap-audit-inventory.json', 'utf8'));
    let directions = 0;
    for (const map of inventory.maps.filter((m: { scope: string; levelCount: number }) => m.scope === 'production' && m.levelCount)) {
      const { links } = scene(map.path);
      for (const k of links) for (const [from, to] of [[k.from, k.to], [k.to, k.from]]) {
        const actor = { level: from.level, pos: from.pos };
        for (const order of [links, [...links].reverse()]) {
          const result = new VerticalTransitions().resolve(order, actor, k.id);
          expect(result?.link.id, `${map.path}/${k.id}/${from.level}`).toBe(k.id);
          expect(result?.to).toEqual(to);
          expect(actor).toEqual({ level: from.level, pos: from.pos });
        }
        directions++;
      }
    }
    expect(directions).toBe(346);
  });

  it('takes one automatic hop, permits walking off the arrival, and rearms after leaving', () => {
    const traversal = new VerticalTransitions(), actor = { level: 'f1', pos: [27.5, 27.5] as [number, number] };
    const first = traversal.resolve(stairs, actor)!;
    expect(first.to.level).toBe('f2');
    actor.level = first.to.level; actor.pos = [27.5, 27.5]; traversal.arrived(stairs, actor);
    expect(traversal.resolve(stairs, actor)).toBeUndefined();
    actor.pos = [22.5, 27.5];
    expect(traversal.resolve(stairs, actor)).toBeUndefined();
    actor.pos = [12.5, 27.5];
    expect(traversal.resolve(stairs, actor)).toBeUndefined();
    actor.pos = [27.5, 27.5];
    expect(traversal.resolve(stairs, actor)?.to.level).toBe('f1');
  });

  it('allows an explicit next or return hop on a shared landing', () => {
    const traversal = new VerticalTransitions(), actor = { level: 'f2', pos: [27.5, 27.5] as [number, number] };
    traversal.arrived(stairs, actor);
    expect(traversal.resolve(stairs, actor, 'lk-spiral-2-3')?.to.level).toBe('f3');
    expect(traversal.resolve(stairs, actor, 'lk-spiral-1-2')?.to.level).toBe('f1');
  });

  it('walking away after reload does not enter the landing it already occupied', () => {
    const actor = { level:'f2', pos:[22.5,27.5] as [number,number] };
    expect(new VerticalTransitions().resolve(stairs, actor, undefined, [27.5,27.5])).toBeUndefined();
  });

  it('does not teleport to a link on an unrelated floor or for an unknown ID', () => {
    const traversal = new VerticalTransitions(), actor = { level: 'dungeon-lower', pos: [27.5, 27.5] as [number, number] };
    expect(traversal.resolve(stairs, actor, 'lk-spiral-1-2')).toBeUndefined();
    expect(traversal.resolve(stairs, actor, 'missing')).toBeUndefined();
  });

  it('does not carry an arrival suppression into another scene or another party', () => {
    const traversal = new VerticalTransitions(), actor = { level: 'f2', pos: [27.5, 27.5] as [number, number] };
    traversal.arrived(stairs, actor);
    expect(traversal.resolve([...stairs], actor)).toBeDefined();
    traversal.arrived(stairs, actor);
    expect(traversal.resolve(stairs, { ...actor })).toBeDefined();
  });

  it.each(['dumbwaiter', 'trapdoor', 'elevator', 'ladder'] as const)('keeps %s return trips explicit at the landing', kind => {
    const links: VerticalLink[] = [{ id: 'link', kind, from: {level:'a',pos:[0,0]}, to:{level:'b',pos:[0,0]} }];
    const traversal = new VerticalTransitions(), actor = { level: 'b', pos: [0, 0] as [number, number] };
    traversal.arrived(links, actor);
    expect(traversal.resolve(links, actor)).toBeUndefined();
    expect(traversal.resolve(links, actor, 'link')?.to.level).toBe('a');
  });
});

describe('vertical arrival positions', () => {
  it('preserves the walkable Amber fissure landing when snapping would strand the party', () => {
    const s = scene('ch13/X'), l = s.levels.find(l => l.id === 'upper')!;
    const grid: GridFile = JSON.parse(readFileSync('locations/ch13/X/grid.json','utf8'));
    const floor = [...grid.levels.upper.floorPolygons, ...l.rooms.map(r => r.polygon)];
    const pos = verticalArrival(s.links.find(k => k.id === 'X-fissure')!.to.pos, grid.levels.upper.origin, floor, moveBlockers(l.walls));
    expect(pos).toEqual([24.5, 258]);
    expect(canWalk(pos, [27, 255.5], moveBlockers(l.walls), floor)).toBe(true);
  });
  it('uses the destination grid origin on a safe floor', () => {
    expect(verticalArrival([5, 5], [1, 1], [rect(0,0,20,20)], [])).toEqual([3.5,3.5]);
  });
  it('does not snap across a closed wall even if both sides have floor', () => {
    expect(verticalArrival([4.9, 7], [1,1], [rect(0,0,20,20)], [{a:[4,0],b:[4,20]}])).toEqual([4.9,7]);
  });
  it('does not invent a distant landing to repair invalid authored geometry', () => {
    expect(verticalArrival([35,38],[0,0],[rect(0,0,20,20)],[])).toEqual([37.5,37.5]);
  });
});
