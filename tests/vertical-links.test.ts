// Stairs take the party one floor, once (app/src/core/verticalLinks.ts; app.ts takeLink and afterPartyMove apply it):
// the chosen link whatever the scene's order, a link taken only when a move enters its end, a passage on one level to
// its far end, and a marker for every way out of a landing.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chosenRoute, enteredRoute, linkMarkers, LINK_TRIGGER_FT, routeOf, routesOn, type LinkRoute } from '../app/src/core/verticalLinks';
import type { GridFile, SceneFile, VerticalLink } from '../app/src/core/schema';
import { pointInPolygon, type Vec2 } from '../app/src/core/geometry';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';

const scene = (path: string): SceneFile => JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8'));
/** Every scene of both campaigns (the dev room aside). */
const SCENES = readdirSync('locations', { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('scene.json') && !f.startsWith('dev'))
  .map((f) => join(f, '..').replaceAll('\\', '/'))
  .sort();
const house = scene('appB/death-house').links;
const ways = (r: LinkRoute[] | undefined) => (r ?? []).map((x) => `${x.link.id}:${x.end}`).sort();
const step = (s: ReturnType<typeof enteredRoute>) => (!s ? null : 'route' in s ? `${s.route.link.id}:${s.route.end}` : ways(s.choices));

describe('a chosen link goes where it says, once', () => {
  it('every link of every scene, chosen by its id from either end, goes to its other end, whatever the scene\'s order', () => {
    let directions = 0, scenes = 0;
    for (const path of SCENES) {
      const { links } = scene(path);
      if (links.length) scenes++;
      for (const k of links) for (const end of ['from', 'to'] as const) {
        const here = k[end], there = k[end === 'from' ? 'to' : 'from'], at = { level: here.level, pos: [...here.pos] as Vec2 };
        for (const order of [links, [...links].reverse()]) {
          const r = chosenRoute(order, k.id, at);
          expect(r?.link.id, `${path}/${k.id} from ${end}`).toBe(k.id);
          expect(r?.to, `${path}/${k.id} from ${end}`).toEqual(there);
          expect(routeOf(k, end).to).toEqual(there);
        }
        expect(at).toEqual({ level: here.level, pos: here.pos });
        directions++;
      }
    }
    expect(scenes).toBeGreaterThanOrEqual(30);
    expect(directions).toBe(SCENES.reduce((n, p) => n + 2 * scene(p).links.length, 0));
  });

  it('on a shared landing the chosen link wins over the other one there, up or down', () => {
    const at = { level: 'f2', pos: [27.5, 27.5] as Vec2 };
    for (const order of [house, [...house].reverse()]) {
      expect(chosenRoute(order, 'lk-spiral-2-3', at)?.to.level).toBe('f3');
      expect(chosenRoute(order, 'lk-spiral-1-2', at)?.to.level).toBe('f1');
    }
  });

  it('a passage on one level goes to its far end, from either end (the castle\'s dungeon stair K85)', () => {
    const links = scene('ch04/K').links, k = links.find((x) => x.id === 'lk-k85')!;
    expect(k.from.level).toBe(k.to.level);
    expect(chosenRoute(links, k.id, { level: k.from.level, pos: k.from.pos })?.to).toEqual(k.to);
    expect(chosenRoute(links, k.id, { level: k.to.level, pos: k.to.pos })?.to).toEqual(k.from);
    expect(routeOf(k, 'to').to).toEqual(k.from);
  });

  it('an unknown id, or a link with no end on the party\'s floor, takes the party nowhere', () => {
    expect(chosenRoute(house, 'lk-spiral-1-2', { level: 'dungeon-lower', pos: [27.5, 27.5] })).toBeUndefined();
    expect(chosenRoute(house, 'missing', { level: 'f1', pos: [27.5, 27.5] })).toBeUndefined();
  });
});

describe('a move takes a stair only when it enters its end', () => {
  it('walking onto Death House\'s spiral stair on Floor 1 takes it to Floor 2, and only that', () => {
    for (const order of [house, [...house].reverse()]) expect(step(enteredRoute(order, { level: 'f1', pos: [27.5, 27.5] }, [17.5, 27.5]))).toBe('lk-spiral-1-2:from');
  });

  it('standing still, or stepping off the landing it arrived on, takes nothing', () => {
    expect(enteredRoute(house, { level: 'f2', pos: [27.5, 27.5] }, [27.5, 27.5])).toBeNull();
    expect(enteredRoute(house, { level: 'f2', pos: [22.5, 27.5] }, [27.5, 27.5])).toBeNull();
    expect(enteredRoute(house, { level: 'f2', pos: [32.5, 27.5] }, [27.5, 27.5])).toBeNull();
    // (a step north from the landing is onto the dumbwaiter's end, which it enters)
    expect(step(enteredRoute(house, { level: 'f2', pos: [27.5, 22.5] }, [27.5, 27.5]))).toEqual(['lk-dumbwaiter-1-2:to', 'lk-dumbwaiter-2-3:from']);
  });

  it('walking back onto a landing shared by an up and a down stair is the DM\'s choice, never the array\'s order', () => {
    for (const order of [house, [...house].reverse()]) {
      expect(step(enteredRoute(order, { level: 'f2', pos: [22.5, 27.5] }, [12.5, 27.5]))).toEqual(['lk-spiral-1-2:to', 'lk-spiral-2-3:from']);
    }
  });

  it('of two ends entered, the nearer is taken, whatever the order (Argynvostholt\'s grand stair)', () => {
    const links = scene('ch07/Q').links;
    for (const order of [links, [...links].reverse()]) {
      const s = enteredRoute(order, { level: 'ground', pos: [183, 118] }, [183, 125]);
      expect(s && 'route' in s ? s.route.to.pos : null).toEqual([195, 134]);
    }
  });

  it('an end the party already stood on does not count against the one it enters', () => {
    const links: VerticalLink[] = [
      { id: 'old', kind: 'stairs', from: { level: 'a', pos: [0, 0] }, to: { level: 'b', pos: [0, 0] } },
      { id: 'new', kind: 'stairs', from: { level: 'a', pos: [8, 0] }, to: { level: 'c', pos: [0, 0] } },
    ];
    for (const order of [links, [...links].reverse()]) expect(step(enteredRoute(order, { level: 'a', pos: [3, 0] }, [0, 0]))).toBe('new:from');
  });

  it('a move from another floor onto an end takes it (the DM placing the party on a stair)', () => {
    expect(step(enteredRoute(house, { level: 'f1', pos: [27.5, 27.5] }, null))).toBe('lk-spiral-1-2:from');
  });

  it.each(['dumbwaiter', 'trapdoor', 'elevator', 'ladder', 'slide', 'shaft'] as const)('a %s does not bring the party straight back: stepping off its arrival takes nothing', (kind) => {
    const links: VerticalLink[] = [{ id: 'k', kind, from: { level: 'a', pos: [0, 0] }, to: { level: 'b', pos: [0, 0] } }];
    expect(enteredRoute(links, { level: 'b', pos: [2.5, 2.5] }, [2.5, 2.5])).toBeNull();
    expect(enteredRoute(links, { level: 'b', pos: [-2.5, 2.5] }, [2.5, 2.5])).toBeNull();
    expect(chosenRoute(links, 'k', { level: 'b', pos: [2.5, 2.5] })?.to.level).toBe('a');
  });
});

describe('one floor per stair on the stacked maps', () => {
  // Death House's spiral (f1, f2, f3), Argynvostholt, the windmill and the Sheep Chase compound's tower
  for (const path of ['appB/death-house', 'ch07/Q', 'ch06/O', 'wsc/03-compound']) it(`${path}: every stair, by its marker or by walking onto it, goes to the floor it names and no further`, () => {
    const s = scene(path), grid: GridFile = JSON.parse(readFileSync(`locations/${path}/grid.json`, 'utf8'));
    for (const k of s.links) for (const end of ['from', 'to'] as const) {
      const r = routeOf(k, end), level = s.levels.find((l) => l.id === r.from.level)!;
      const floor = [...grid.levels[level.id].floorPolygons, ...level.rooms.map((x) => x.polygon)];
      const c0: Vec2 = [Math.floor(r.from.pos[0] / 5) * 5 + 2.5, Math.floor(r.from.pos[1] / 5) * 5 + 2.5];
      expect(chosenRoute(s.links, k.id, { level: r.from.level, pos: c0 })?.to, `${k.id} from ${end}`).toEqual(r.to);
      // the floor cells within its trigger: walking onto one of them from outside takes this stair (where two ends are
      // a foot or two apart, each has its own side of the landing), or asks the DM between it and another one sharing
      // the spot
      const cells: Vec2[] = [];
      for (let dz = -10; dz <= 10; dz += 5) for (let dx = -10; dx <= 10; dx += 5) {
        const c: Vec2 = [c0[0] + dx, c0[1] + dz];
        if (Math.hypot(c[0] - r.from.pos[0], c[1] - r.from.pos[1]) <= LINK_TRIGGER_FT && floor.some((poly) => pointInPolygon(c, poly))) cells.push(c);
      }
      const taken = cells.map((c) => enteredRoute(s.links, { level: level.id, pos: c }, [c[0] + 40, c[1] + 40]));
      expect(taken.some((t) => t && ('route' in t ? t.route.link === k && t.route.end === end : ways(t.choices).includes(`${k.id}:${end}`))), `${k.id} from ${end}: walking on`).toBe(true);
    }
  });
});

describe('Castle Ravenloft: every stair, ladder, trapdoor, lift and slide takes the party once, to where it leads', () => {
  const s = scene('ch04/K'), grid: GridFile = JSON.parse(readFileSync('locations/ch04/K/grid.json', 'utf8'));
  const cell = (p: Vec2): Vec2 => [Math.floor(p[0] / 5) * 5 + 2.5, Math.floor(p[1] / 5) * 5 + 2.5];
  it('chosen on its marker, from either end, each lands on its other end\'s level and cell', () => {
    expect(s.links.length).toBeGreaterThanOrEqual(40);
    for (const k of s.links) for (const end of ['from', 'to'] as const) {
      const r = routeOf(k, end);
      for (const order of [s.links, [...s.links].reverse()]) expect(chosenRoute(order, k.id, { level: r.from.level, pos: cell(r.from.pos) })?.to, `${k.id} from ${end}`).toEqual(r.to);
    }
  });
  it('walked onto from the floor beside it, each is taken alone: no other stair shares its spot, none is skipped', () => {
    const bad: string[] = [];
    for (const k of s.links) for (const end of ['from', 'to'] as const) {
      const r = routeOf(k, end), l = s.levels.find((x) => x.id === r.from.level)!, c0 = cell(r.from.pos);
      const floor = [...grid.levels[l.id].floorPolygons, ...l.rooms.map((x) => x.polygon)];
      const walls = moveBlockers(l.walls.map((w) => (w.flags.includes('door') || w.flags.includes('secret-door') ? { ...w, flags: ['door'], open: true } : w)));
      // a floor cell two cells off (outside the trigger) from which the party walks straight onto the stair's cell
      const from = [[-10, 0], [10, 0], [0, -10], [0, 10], [-10, -10], [10, -10], [-10, 10], [10, 10]].map(([dx, dz]) => [c0[0] + dx, c0[1] + dz] as Vec2)
        .find((p) => Math.hypot(p[0] - r.from.pos[0], p[1] - r.from.pos[1]) > LINK_TRIGGER_FT && canWalk(p, c0, walls, floor));
      if (!from) { bad.push(`${k.id} from ${end}: no floor beside it to walk on from`); continue; }
      const t = enteredRoute(s.links, { level: l.id, pos: c0 }, from);
      if (!t || !('route' in t) || t.route.link !== k || t.route.end !== end) bad.push(`${k.id} from ${end}: walking on takes ${JSON.stringify(step(t))}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('stair markers', () => {
  it('every way out of every landing of every scene has a marker (none dropped for being near another)', () => {
    for (const path of SCENES) {
      const s = scene(path);
      for (const l of s.levels) {
        const markers = linkMarkers(s.links, l.id);
        expect(ways(markers.flat()), `${path}/${l.id}`).toEqual(ways(routesOn(s.links, l.id)));
        for (const m of markers) for (const r of m) expect(Math.hypot(r.from.pos[0] - m[0].from.pos[0], r.from.pos[1] - m[0].from.pos[1])).toBeLessThan(12);
      }
    }
  });

  it('Death House\'s Floor 2 landing offers the stairs up to Floor 3 and down to Floor 1, and the dumbwaiter both ways', () => {
    const m = linkMarkers(house, 'f2');
    expect(m.map(ways)).toEqual([['lk-dumbwaiter-1-2:to', 'lk-dumbwaiter-2-3:from', 'lk-spiral-1-2:to', 'lk-spiral-2-3:from']]);
    expect(linkMarkers(house, 'f3').map(ways)).toEqual([['lk-attic-stair:from', 'lk-dumbwaiter-2-3:to', 'lk-spiral-2-3:to']]);
  });

  it('ends share a marker under twelve feet from its first end, and not at twelve', () => {
    const links: VerticalLink[] = [0, 11, 12, 22].map((x, i) => ({ id: `k${i}`, kind: 'stairs', from: { level: 'a', pos: [x, 100] }, to: { level: 'b', pos: [x, 100] } }));
    expect(linkMarkers(links, 'a').map(ways)).toEqual([['k0:from', 'k1:from'], ['k2:from', 'k3:from']]);
    expect(LINK_TRIGGER_FT).toBe(5.5);
  });
});
