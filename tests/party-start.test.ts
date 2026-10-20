// Where a map starts the party, and a party the table never moved from a start this release moves. Read off the scenes
// the generators write: a map with an authored spawn starts the party there; one without starts it in the first room of
// the floor the map opens on (its entry), so the DM, who opens a map at the party's floor, opens it there again. A 0.3.x
// save holds the party where that release put it on Castle Ravenloft (no spawn then: the middle of the dungeon's first
// room) and on the Wachterhaus (its secret cellar): left there, the castle would reopen on its dungeon and the house on
// its cellar. A party standing on a floor its map no longer has (the Gates of Ravenloft's old wall walk) is lost to the
// table. Each is put at the map's start; a party the table moved stays where it is.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pointInPolygon, type Polygon } from '../app/src/core/geometry';
import type { GridFile, SceneFile } from '../app/src/core/schema';
import type { Token } from '../app/src/state/campaign';
import { partyStart, settleParty } from '../app/src/state/partyStart';

const load = (path: string) => ({ scene: JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8')) as SceneFile, grid: JSON.parse(readFileSync(`locations/${path}/grid.json`, 'utf8')) as GridFile });
const party = (location: string, level: string, pos: [number, number]): Token => ({ id: `pc-${location}`, name: 'Party', location, level, pos, size: 'medium', darkvisionFt: 0, color: '#c0392b', role: 'party' });
const onFloor = (m: ReturnType<typeof load>, level: string, pos: [number, number]) => {
  const l = m.scene.levels.find((x) => x.id === level)!;
  return [...m.grid.levels[level].floorPolygons, ...l.rooms.map((r) => r.polygon)].some((p) => pointInPolygon(pos, p as Polygon));
};

describe('where a map starts the party', () => {
  it('at its authored spawn: Castle Ravenloft inside its gate, the Gates of Ravenloft on the road', () => {
    expect(partyStart(load('ch04/K').scene)).toEqual({ level: 'ground', pos: [37.5, 172.5] });
    expect(partyStart(load('ch02/J').scene).level).toBe('ground');
  });
  it('without one, on the floor the map opens on, in the middle of its first room, on floor: the Wachterhaus on its ground floor, not its secret cellar', () => {
    const N4 = load('ch05/N4'), s = partyStart(N4.scene);
    expect(s.level).toBe(N4.scene.entry);
    expect(s.level).toBe('ground');
    expect(onFloor(N4, s.level, s.pos)).toBe(true);
  });
  it('every map without a spawn starts the party on the floor it opens on', () => {
    const scenes = JSON.parse(readFileSync('manifests/world-atlas.json', 'utf8')).scenes as Record<string, unknown>;
    for (const path of Object.keys(scenes)) {
      let m: ReturnType<typeof load>;
      try { m = load(path); } catch { continue; }
      if (m.scene.levels.some((l) => l.objects.some((o) => o.kind === 'spawn'))) continue;
      expect(partyStart(m.scene).level, path).toBe(m.scene.entry ?? m.scene.levels[0].id);
    }
  });
});

const save = (...tokens: Token[]) => ({ tokens, settledStarts: undefined as string[] | undefined });

describe('a 0.3.x party the table never moved from a start this release moves', () => {
  it('Castle Ravenloft: the party 0.3.x left in the dungeon is put inside the gate; one the table moved stays', () => {
    const K = load('ch04/K').scene, st = save(party('K', 'dungeon', [217.5, 202.5])), t = st.tokens[0];
    expect(settleParty(st, K)).toBe(true);
    expect([t.level, t.pos]).toEqual(['ground', [37.5, 172.5]]);
    const moved = save(party('K', 'dungeon', [222.5, 202.5]));
    expect(settleParty(moved, K)).toBe(false);
    expect([moved.tokens[0].level, moved.tokens[0].pos]).toEqual(['dungeon', [222.5, 202.5]]);
    // checked once: a party the table moves onto that spot afterwards stays there
    t.level = 'dungeon'; t.pos = [217.5, 202.5];
    expect(settleParty(st, K)).toBe(false);
    expect(settleParty(moved, K)).toBe(false);
    expect([t.level, t.pos]).toEqual(['dungeon', [217.5, 202.5]]);
    expect(st.settledStarts).toEqual(['K']);
  });
  it('the Wachterhaus: the party 0.3.x left in the secret cellar is put on the ground floor', () => {
    const N4 = load('ch05/N4').scene, st = save(party('N4', 'cellar', [37.5, 72.5]));
    expect(settleParty(st, N4)).toBe(true);
    expect(st.tokens[0].level).toBe('ground');
    expect(st.tokens[0].pos).toEqual(partyStart(N4).pos);
  });
  it('the Gates of Ravenloft: a party on the wall walk, a floor J no longer has, is put at J\'s start', () => {
    const J = load('ch02/J').scene, st = save(party('J', 'wall-walk', [462.5, 182.5]));
    expect(settleParty(st, J)).toBe(true);
    expect(st.tokens[0]).toMatchObject(partyStart(J));
    expect(st.settledStarts, 'J\'s start has not moved: nothing to remember').toBeUndefined();
  });
  it('nothing else is touched: other maps\' parties, the party\'s members, placed creatures, a party on its map\'s floors', () => {
    const K = load('ch04/K').scene;
    const member: Token = { ...party('K', 'dungeon', [217.5, 202.5]), id: 'm1', role: 'member' };
    const elsewhere = party('N4', 'dungeon', [217.5, 202.5]);
    const st = save(member, elsewhere, party('K', 'court', [150, 150]));
    expect(settleParty(st, K)).toBe(false);
    expect(st.tokens.map((t) => [t.level, t.pos])).toEqual([['dungeon', [217.5, 202.5]], ['dungeon', [217.5, 202.5]], ['court', [150, 150]]]);
    const D = load('appB/death-house').scene, d = D.levels[0], here = save(party(D.location, d.id, [12.5, 12.5]));
    expect(settleParty(here, D)).toBe(false);
    expect(here.tokens[0].level).toBe(d.id);
  });
});
