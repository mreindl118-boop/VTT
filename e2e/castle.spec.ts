// Castle Ravenloft (ch04/K) under the Players' rules, in the running app: the generator's contract
// (tests/castle-contract.test.ts) read off the scene, checked again where the party actually moves (app.ts canWalkTo over
// the floor and the walls as they stand, doors opened and secret doors found the DM's way, stairs taken by takeLink).
// The party starts at the gate on the entry level, free to step every way; every level is reached by a stair onto
// floor with a free step; every door and secret door on the twelve levels lets the party through both ways when open.
// And from the Gates of Ravenloft the castle is in plain sight: reaching them makes it known to the players.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { quiet } from './helpers';

async function open(page: Page, scene: string) {
  await quiet(page);
  await page.goto(`/?nosw&scene=${scene}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
}

test('Castle Ravenloft: the party starts at the gate, reaches every level on floor, and passes every door both ways when open', async ({ page }) => {
  test.setTimeout(600_000);
  await open(page, 'ch04/K');

  // the start: on the entry level, shown on it, free to step every way in Players view
  const start = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, sc = a.cur.scene, p = a.party;
    a.setView('players');
    const steps = [[5, 0], [-5, 0], [0, 5], [0, -5]].map(([dx, dz]) => a.canWalkTo(p.pos, [p.pos[0] + dx, p.pos[1] + dz]));
    return { level: p.level, shown: a.levelId, entry: sc.entry, steps, levels: sc.levels.map((l: any) => l.id) };
  });
  expect(start.level, 'the party starts on the entry level').toBe(start.entry);
  expect(start.shown, 'and the map opens on it').toBe(start.entry);
  expect(start.steps, 'free to step every way from the gate').toEqual([true, true, true, true]);
  expect(start.levels).toHaveLength(12);

  // every other level, reached as the party reaches it: through a stair onto it, standing on floor with a free step
  const reached = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, sc = a.cur.scene, out: Record<string, string> = {};
    a.setView('dm');
    for (const l of sc.levels) {
      if (l.id === sc.entry) continue;
      const k = sc.links.find((x: any) => x.to.level === l.id && x.from.level !== l.id) ?? sc.links.find((x: any) => x.from.level === l.id && x.to.level !== l.id);
      if (!k) { out[l.id] = 'no stair onto it'; continue; }
      const p0 = a.party;
      p0.level = k.to.level === l.id ? k.from.level : k.to.level; a.setLevel(p0.level);
      a.takeLink(k.id, k.to.level === l.id ? 'from' : 'to');
      const p = a.party;
      if (p.level !== l.id || a.levelId !== l.id) { out[l.id] = `${k.id} took the party to ${p.level}`; continue; }
      a.setView('players');
      const free = [[5, 0], [-5, 0], [0, 5], [0, -5]].filter(([dx, dz]) => a.canWalkTo(p.pos, [p.pos[0] + dx, p.pos[1] + dz])).length;
      a.setView('dm');
      out[l.id] = free ? 'ok' : `${k.id}: no free step from ${p.pos}`;
    }
    return out;
  });
  for (const [level, r] of Object.entries(reached)) expect(r, level).toBe('ok');
  expect(Object.keys(reached)).toHaveLength(11);

  // every door and secret door, level by level: the DM finds the secret ones and opens them all (locked ones too),
  // then in Players view the party steps across each, 2 ft either side of its middle, both ways
  const doors = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, sc = a.cur.scene, bad: string[] = [];
    let n = 0;
    for (const l of sc.levels) {
      a.setView('dm'); a.setLevel(l.id);
      const ds = l.walls.filter((w: any) => w.flags.includes('door') || w.flags.includes('secret-door'));
      for (const w of ds) {
        if (w.flags.includes('secret-door')) {
          const sd = a.built.secretDoors.find((s: any) => s.wallId === w.id);
          if (!sd) { bad.push(`${l.id}/${w.id}: no secret panel to find`); continue; }
          a.revealSecretDoor(sd.objectId);
        }
        if (!a.effectiveWalls().find((x: any) => x.id === w.id).open) a.toggleDoor(w.id);
      }
      a.setView('players');
      for (const w of ds) {
        n++;
        const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
        const m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], p1 = [m[0] - 2 * nx, m[1] - 2 * nz], p2 = [m[0] + 2 * nx, m[1] + 2 * nz];
        const open = a.effectiveWalls().find((x: any) => x.id === w.id);
        if (!open.open || !open.flags.includes('door')) { bad.push(`${l.id}/${w.id}: not open`); continue; }
        if (!a.canWalkTo(p1, p2) || !a.canWalkTo(p2, p1)) bad.push(`${l.id}/${w.id}: blocked when open`);
      }
    }
    return { n, bad };
  });
  expect(doors.bad).toEqual([]);
  expect(doors.n, 'the 68 doors and 13 secret doors').toBe(81);
});

test('reaching the Gates of Ravenloft makes the castle known to the players, and Players view draws it', async ({ page }) => {
  test.setTimeout(240_000);
  // a fresh campaign opened in the village: the party is placed there (the first open places it), the castle unknown;
  // then it travels to the Gates
  await open(page, 'ch03/E');
  const world = JSON.parse(readFileSync('locations/ch02/barovia-region/world.json', 'utf8')) as { pins: { key: string; pos: [number, number] }[] };
  const gates = world.pins.find((p) => p.key === 'J')!.pos;
  const r = await page.evaluate((gates) => {
    const a = (window as any).__mistlab.app;
    a.setView('players');
    const before = { K: a.pinsRevealed.has('K'), shown: a.stage.pinShown('K') };
    a.moveWorld(gates, 'J', 0);
    return { before, after: { J: a.pinsRevealed.has('J'), K: a.pinsRevealed.has('K'), shown: a.stage.pinShown('K') } };
  }, gates);
  expect(r.before, 'a fresh campaign: the castle unknown').toEqual({ K: false, shown: false });
  expect(r.after).toEqual({ J: true, K: true, shown: true });
});
