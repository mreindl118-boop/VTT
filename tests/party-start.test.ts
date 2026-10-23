import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { App } from '../app/src/app';
import { bounds, pointInPolygon, type Vec2 } from '../app/src/core/geometry';
import { squareCellAt, squareCellCenter } from '../app/src/core/grid';
import type { GridFile, SceneFile } from '../app/src/core/schema';
import { newCampaign } from '../app/src/state/campaign';

function makeTable(dir: string) {
  const scene = JSON.parse(readFileSync(`${dir}/scene.json`, 'utf8')) as SceneFile;
  const grid = JSON.parse(readFileSync(`${dir}/grid.json`, 'utf8')) as GridFile;
  const app = Object.create(App.prototype) as App;
  app.state = newCampaign();
  app.cur = { path: dir, scene, grid } as any;
  app.levelId = scene.entry ?? scene.levels[0].id;
  app.mode = 'dm' as any;
  app.view = 'players';
  app.t = 0;
  app.autoReveal = true;
  app.gridSnap = true;
  app.gridMode = 'square';
  app.status = '';
  app.onStatus = null;
  return { app, scene, grid };
}

describe('party start on floor (ch08/S10 and wsc/02-street)', () => {
  for (const dir of ['locations/ch08/S10', 'locations/wsc/02-street']) {
    it(`${dir}: start cell is on the floor, allows a 5-ft step, and reaches a second room or link with doors as authored`, () => {
      const { app, scene, grid } = makeTable(dir);
      (app as any).ensureDefaultToken();
      const party = app.party!;
      expect(party).toBeDefined();
      app.levelId = party.level;
      const level = scene.levels.find((l) => l.id === party.level)!;
      const floor = grid.levels[level.id].floorPolygons.concat(level.rooms.map((r) => r.polygon));

      // 1. Start cell is on the floor.
      expect(floor.some((poly) => pointInPolygon(party.pos, poly))).toBe(true);

      // 2. At least one 5-ft step is allowed in Players rules.
      const dirs: Vec2[] = [[5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [5, -5], [-5, 5], [-5, -5]];
      const allowedSteps = dirs.filter(([dx, dz]) => app.canWalkTo(party.pos, [party.pos[0] + dx, party.pos[1] + dz]));
      expect(allowedSteps.length).toBeGreaterThan(0);

      // 3. The room the party landed in is revealed.
      const startRoom = level.rooms.find((r) => pointInPolygon(party.pos, r.polygon));
      expect(startRoom).toBeDefined();
      expect(app.isRevealed(startRoom!.key)).toBe(true);

      // 4. From that cell, with doors as authored, the walk reaches a second room or a link.
      const reachesSecondRoom = level.rooms.some((r) => {
        if (r.key === startRoom!.key) return false;
        const b = bounds([r.polygon]);
        for (let x = Math.floor(b.minX / 5) * 5 + 2.5; x <= b.maxX; x += 5) {
          for (let z = Math.floor(b.minZ / 5) * 5 + 2.5; z <= b.maxZ; z += 5) {
            const p: Vec2 = [x, z];
            if (pointInPolygon(p, r.polygon) && app.canWalkTo(party.pos, p)) return true;
          }
        }
        return false;
      });
      const reachesLink = scene.links
        .flatMap((k) => [k.from, k.to])
        .some((end) => end.level === level.id && app.canWalkTo(party.pos, squareCellCenter(squareCellAt(end.pos))));
      expect(reachesSecondRoom || reachesLink).toBe(true);
    });
  }

  it('repairs a saved party token whose cell is off the floor on load', () => {
    const { app, scene, grid } = makeTable('locations/ch08/S10');
    app.state.tokens.push({
      id: 'pc-S10', name: 'Party', location: scene.location, level: 'ground',
      pos: [137.5, -7.5], size: 'medium', darkvisionFt: 0, color: '#c0392b', role: 'party',
    });
    (app as any).ensureDefaultToken();
    const party = app.party!;
    const level = scene.levels.find((l) => l.id === party.level)!;
    const floor = grid.levels[level.id].floorPolygons.concat(level.rooms.map((r) => r.polygon));
    expect(floor.some((poly) => pointInPolygon(party.pos, poly))).toBe(true);
    expect(app.status.length).toBeGreaterThan(0); // > 100 ft fallback reported in status
  });
});
