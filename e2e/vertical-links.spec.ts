// Stairs take the party one floor, once, in the running app (app.ts takeLink / afterPartyMove, core/verticalLinks.ts):
// a marker for every way out of a landing, the chosen way whatever the scene's order, a stair taken only when a move
// enters it (walking, or the DM's "Move party here"), a passage on one level to its far end, the party's floor kept
// over a reload, and the Player Display following without taking stairs of its own.
import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function open(page: Page, scene = 'appB/death-house', query = '') {
  await quiet(page);
  await page.goto(`/?nosw&scene=${scene}${query}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}
const pose = (page: Page) => page.evaluate(() => { const a = (window as any).__mistlab.app; return { level: a.party.level, visible: a.levelId, pos: a.party.pos }; });
/** Click a stair marker's way (link id and the end it goes in at) with the mouse, as the DM does. */
async function clickWay(page: Page, link: string, end: 'from' | 'to') {
  const way = page.locator(`.lbl.link[data-link="${link}"][data-end="${end}"]:visible, .lbl.link .way[data-link="${link}"][data-end="${end}"]:visible`);
  await expect(way).toHaveCount(1);
  await way.click();
}

test('Death House: the Floor 1 stair marker takes the party to Floor 2, whose landing offers up to Floor 3 and down to Floor 1, one floor each', async ({ page }) => {
  await open(page);
  // Floor 2's landing, seen from the top: its stair marker names both floors (and the dumbwaiter's both ways)
  await page.evaluate(() => { const m = (window as any).__mistlab; m.moveParty('f2', 12.5, 27.5); m.frame('top'); });
  const titles = () => page.locator('.lbl.link:visible, .lbl.link .way:visible').evaluateAll((els) => els.map((e) => e.getAttribute('title')).filter(Boolean));
  await expect.poll(titles).toEqual(expect.arrayContaining([expect.stringMatching(/^Stairs up to Floor 3/), expect.stringMatching(/^Stairs down to Floor 1/)]));
  await page.evaluate(() => { const m = (window as any).__mistlab; m.moveParty('f1', 17.5, 27.5); m.frame('top'); });
  await clickWay(page, 'lk-spiral-1-2', 'from');
  expect(await pose(page)).toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
  await expect(page.locator('.status')).toContainText('Floor 2');
  // the landing's marker: both ways, each its own button
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  const marker = page.locator('.lbl.link.ways:visible').filter({ has: page.locator('.way[data-link="lk-spiral-2-3"]') });
  await expect(marker.locator('.way')).toHaveCount(4);
  await expect(marker.locator('.way[data-link="lk-spiral-2-3"][data-end="from"]')).toHaveAttribute('title', /Stairs up to Floor 3/);
  await expect(marker.locator('.way[data-link="lk-spiral-1-2"][data-end="to"]')).toHaveAttribute('title', /Stairs down to Floor 1/);
  await clickWay(page, 'lk-spiral-2-3', 'from');
  expect(await pose(page)).toEqual({ level: 'f3', visible: 'f3', pos: [27.5, 27.5] });
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  await clickWay(page, 'lk-spiral-2-3', 'to');
  expect(await pose(page)).toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  await clickWay(page, 'lk-spiral-1-2', 'to');
  expect(await pose(page)).toEqual({ level: 'f1', visible: 'f1', pos: [27.5, 27.5] });
});

test('Death House: walking onto the stair climbs one floor; stepping off the landing does not bring the party back; the shared landing asks the DM', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, walk = (p: [number, number]) => ({ moved: a.moveTokenTo(a.party.id, p), level: a.party.level, pos: [...a.party.pos], status: a.status });
    m.moveParty('f1', 17.5, 27.5); a.setView('players');
    const on = walk([27.5, 27.5]), still = walk([27.5, 27.5]), off = walk([22.5, 27.5]), away = walk([12.5, 27.5]), back = walk([22.5, 27.5]);
    return { on, still, off, away, back };
  });
  expect(r.on).toMatchObject({ moved: true, level: 'f2', pos: [27.5, 27.5] });
  expect(r.still).toMatchObject({ moved: true, level: 'f2', pos: [27.5, 27.5] });
  expect(r.off).toMatchObject({ moved: true, level: 'f2', pos: [22.5, 27.5] });
  expect(r.away).toMatchObject({ moved: true, level: 'f2', pos: [12.5, 27.5] });
  expect(r.back).toMatchObject({ moved: true, level: 'f2', pos: [22.5, 27.5] });
  expect(r.back.status).toMatch(/down to Floor 1 or up to Floor 3|up to Floor 3 or down to Floor 1/);
});

test('a link chosen by its id on a shared landing goes to its own floor, both ways', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f2', 27.5, 27.5);
    a.takeLink('lk-spiral-2-3'); const up = { party: a.party.level, visible: a.levelId };
    a.takeLink('lk-spiral-2-3'); const down = { party: a.party.level, visible: a.levelId };
    a.takeLink('lk-spiral-1-2'); const lower = { party: a.party.level, visible: a.levelId };
    return { up, down, lower };
  });
  expect(r).toEqual({ up: { party: 'f3', visible: 'f3' }, down: { party: 'f2', visible: 'f2' }, lower: { party: 'f1', visible: 'f1' } });
});

test('a passage on one level (the castle\'s dungeon stair K85) goes to its far end from the end whose marker is clicked', async ({ page }) => {
  await open(page, 'ch04/K');
  const ends = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, k = a.cur.scene.links.find((x: any) => x.id === 'lk-k85');
    m.moveParty(k.from.level, ...a.snap(k.from.pos)); m.frame('top'); a.jumpTo('K85');
    return { from: a.snap(k.from.pos), to: a.snap(k.to.pos) };
  });
  // the marker drawn at each end, found where it stands on screen, clicked with the mouse
  const markerAt = async (end: 'from' | 'to') => {
    await page.evaluate(() => (window as any).__mistlab.app.jumpTo('K85'));
    const nearest = () => page.evaluate((end) => {
      const m = (window as any).__mistlab, k = m.app.cur.scene.links.find((x: any) => x.id === 'lk-k85'), [x, y] = m.screenOf(k[end].pos[0], k[end].pos[1], 3);
      const els = [...document.querySelectorAll<HTMLElement>('.lbl.link')].filter((e) => e.checkVisibility({ visibilityProperty: true }));
      let best = -1, d = Infinity;
      els.forEach((e, i) => { const r = e.getBoundingClientRect(), dd = Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y); if (dd < d) { d = dd; best = i; } });
      return { i: best, d, n: els.length };
    }, end);
    await expect.poll(async () => (await nearest()).d).toBeLessThan(20);
    await page.locator('.lbl.link:visible').nth((await nearest()).i).click();
  };
  await markerAt('from');
  expect((await pose(page)).pos).toEqual(ends.to);
  await markerAt('to');
  expect((await pose(page)).pos).toEqual(ends.from);
});

test('Castle Ravenloft: every link, taken from its origin by its marker, by its id or by walking onto it, lands once on its destination level', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, 'ch04/K');
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, links = a.cur.scene.links;
    a.autoReveal = false; a.follow = false;
    // every door open: the walk onto a stair is about the stair, not the doors on the way
    for (const l of a.cur.scene.levels) for (const w of l.walls) if (w.flags.includes('door')) a.state.doorsOpen[`${a.cur.scene.location}/${w.id}`] = true;
    const cell = (p: number[]) => [Math.floor(p[0] / 5) * 5 + 2.5, Math.floor(p[1] / 5) * 5 + 2.5];
    const bad: unknown[] = []; let checked = 0;
    for (const k of links) for (const end of ['from', 'to']) {
      const here = k[end], there = k[end === 'from' ? 'to' : 'from'], c0 = cell(here.pos), want = cell(there.pos);
      for (const how of ['marker', 'id', 'walk']) {
        let start = c0;
        if (how === 'walk') {
          const near = [[-10, 0], [10, 0], [0, -10], [0, 10], [-10, -10], [10, -10], [-10, 10], [10, 10]].map(([dx, dz]) => [c0[0] + dx, c0[1] + dz])
            .find((p) => Math.hypot(p[0] - here.pos[0], p[1] - here.pos[1]) > 5.5 && a.canWalkTo(p, c0));
          if (!near) { bad.push({ id: k.id, end, how, problem: 'nothing to walk on from' }); continue; }
          start = near;
        }
        a.party.level = here.level; a.party.pos = [...start]; a.setLevel(here.level);
        const setLevel = a.setLevel, moves: string[] = [];
        a.setLevel = function (id: string, ...rest: unknown[]) { moves.push(id); return setLevel.call(this, id, ...rest); };
        try {
          if (how === 'marker') a.takeLink(k.id, end);
          else if (how === 'id') a.takeLink(k.id);
          else a.moveTokenTo(a.party.id, c0);
        } finally { a.setLevel = setLevel; }
        const got = { level: a.party.level, visible: a.levelId, pos: [...a.party.pos] };
        if (got.level !== there.level || got.visible !== there.level || got.pos[0] !== want[0] || got.pos[1] !== want[1] || moves.length !== 1) bad.push({ id: k.id, end, how, got, moves, want: { level: there.level, pos: want } });
        checked++;
      }
    }
    return { checked, links: links.length, bad };
  });
  console.log(JSON.stringify({ castle: { checked: r.checked, links: r.links, failures: r.bad.length } }));
  expect(r.bad).toEqual([]);
  expect(r.checked).toBe(r.links * 2 * 3);
});

test('Death House, Argynvostholt, the windmill and the compound tower: walking onto each stair goes one floor, to the floor it names', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const bad: unknown[] = []; let checked = 0;
  for (const path of ['appB/death-house', 'ch07/Q', 'ch06/O', 'wsc/03-compound']) {
    const r = await page.evaluate(async (path) => {
      const a = (window as any).__mistlab.app;
      await a.open(path);
      a.autoReveal = false; a.follow = false;
      for (const l of a.cur.scene.levels) for (const w of l.walls) if (w.flags.includes('door')) a.state.doorsOpen[`${a.cur.scene.location}/${w.id}`] = true;
      const cell = (p: number[]) => [Math.floor(p[0] / 5) * 5 + 2.5, Math.floor(p[1] / 5) * 5 + 2.5];
      const bad: unknown[] = []; let checked = 0;
      for (const k of a.cur.scene.links) for (const end of ['from', 'to']) {
        const here = k[end], there = k[end === 'from' ? 'to' : 'from'], c0 = cell(here.pos);
        // every cell of its trigger the party can walk onto from outside it: one stair at most, one floor at most;
        // on one of them this stair (or the DM's choice between it and one sharing its spot)
        let mine = false, tried = 0;
        for (let dz = -10; dz <= 10; dz += 5) for (let dx = -10; dx <= 10; dx += 5) {
          const c = [c0[0] + dx, c0[1] + dz];
          if (Math.hypot(c[0] - here.pos[0], c[1] - here.pos[1]) > 5.5) continue;
          const near = [[-15, 0], [15, 0], [0, -15], [0, 15], [-10, -10], [10, -10], [-10, 10], [10, 10]].map(([ex, ez]) => [c[0] + ex, c[1] + ez])
            .find((p) => a.cur.scene.links.every((x: any) => [x.from, x.to].every((e: any) => e.level !== here.level || Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1]) > 5.5)) && a.canWalkTo(p, c));
          if (!near) continue;
          a.party.level = here.level; a.party.pos = [...near]; a.setLevel(here.level);
          const setLevel = a.setLevel, moves: string[] = [];
          a.setLevel = function (id: string, ...rest: unknown[]) { moves.push(id); return setLevel.call(this, id, ...rest); };
          try { a.moveTokenTo(a.party.id, c); } finally { a.setLevel = setLevel; }
          tried++;
          if (moves.length > 1) bad.push({ path, id: k.id, end, c, moves, problem: 'more than one stair' });
          // a stair it stepped onto, and that stair's own far end: never a floor further on
          const via = a.cur.scene.links.flatMap((x: any) => [[x.from, x.to], [x.to, x.from]]).filter(([e]: any) => e.level === here.level && Math.hypot(e.pos[0] - c[0], e.pos[1] - c[1]) <= 5.5);
          if (moves.length === 1 && !via.some(([, o]: any) => o.level === a.party.level && Math.hypot(cell(o.pos)[0] - a.party.pos[0], cell(o.pos)[1] - a.party.pos[1]) < 1e-6)) bad.push({ path, id: k.id, end, c, to: a.party.level, problem: 'went further than the stair it stepped on' });
          if (moves.length === 1 && a.party.level === there.level && Math.hypot(a.party.pos[0] - cell(there.pos)[0], a.party.pos[1] - cell(there.pos)[1]) < 1e-6) mine = true;
          if (!moves.length && /the DM picks/.test(a.status) && a.status.includes(a.cur.scene.levels.find((l: any) => l.id === there.level).name)) mine = true;
        }
        if (!tried) bad.push({ path, id: k.id, end, problem: 'nothing to walk on from' });
        else if (!mine) bad.push({ path, id: k.id, end, problem: 'never taken by walking onto it' });
        checked++;
      }
      return { checked, bad };
    }, path);
    checked += r.checked; bad.push(...r.bad);
  }
  console.log(JSON.stringify({ stacked: { checked, failures: bad.length } }));
  expect(bad).toEqual([]);
  expect(checked).toBeGreaterThan(40);
});

test('every link of every scene, taken from either end in the running app, reaches its destination once', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 'appB/death-house', '&nested=0');
  const paths: string[] = await page.evaluate(() => (window as any).__mistlab.scenes().filter((p: string) => !p.startsWith('dev/')));
  const failures: unknown[] = []; let checked = 0, total = 0, wrongLevels = 0, multiple = 0;
  for (const path of paths) {
    const r = await page.evaluate(async (path) => {
      const a = (window as any).__mistlab.app;
      await a.open(path);
      a.autoReveal = false; a.follow = false;
      const failures: unknown[] = []; let checked = 0, wrongLevels = 0, multiple = 0;
      const cell = (p: number[]) => [Math.floor(p[0] / 5) * 5 + 2.5, Math.floor(p[1] / 5) * 5 + 2.5];
      for (const k of a.cur.scene.links) for (const [from, to] of [[k.from, k.to], [k.to, k.from]]) {
        a.party.level = from.level; a.party.pos = [...from.pos]; a.setLevel(from.level);
        const setLevel = a.setLevel, moves: string[] = [];
        a.setLevel = function (id: string, ...rest: unknown[]) { moves.push(id); return setLevel.call(this, id, ...rest); };
        try { a.takeLink(k.id); } finally { a.setLevel = setLevel; }
        const want = cell(to.pos), d = Math.hypot(a.party.pos[0] - want[0], a.party.pos[1] - want[1]);
        if (a.party.level !== to.level) wrongLevels++;
        if (moves.length > 1) multiple++;
        if (a.party.level !== to.level || a.levelId !== to.level || d > 1e-6 || moves.length !== 1) failures.push({ path, id: k.id, from: from.level, want: { level: to.level, pos: want }, got: { level: a.party.level, pos: a.party.pos }, visible: a.levelId, moves });
        checked++;
      }
      return { checked, failures, wrongLevels, multiple, total: 2 * a.cur.scene.links.length };
    }, path);
    checked += r.checked; total += r.total; failures.push(...r.failures); wrongLevels += r.wrongLevels; multiple += r.multiple;
  }
  console.log(JSON.stringify({ sweep: { checked, wrongLevels, multiple, failures: failures.length } }));
  expect(failures).toEqual([]);
  expect(checked).toBe(total);
  expect(checked).toBeGreaterThan(340);
});

test('the DM\'s "Move party here" takes a stair only when it puts the party onto one', async ({ page }) => {
  await open(page);
  const menuMove = async (level: string, from: number, to: number) => {
    await page.evaluate(({ level, from }) => { const m = (window as any).__mistlab; m.moveParty(level, from, 27.5); m.app.setView('dm'); m.app.setLevel('f1'); }, { level, from });
    await page.evaluate((x) => { const a = (window as any).__mistlab.app, room = a.level.rooms.find((r: any) => r.key === '2A'); a.onTap({ pos: [x, 27.5], room: a.tapRoom(room, false) }, 100, 240); }, to);
    await page.locator('.tapmenu').getByRole('button', { name: 'Move party here', exact: true }).click();
    await expect(page.locator('.tapmenu')).toHaveCount(0);
    return pose(page);
  };
  expect(await menuMove('f1', 27.5, 27.5), 'onto the landing it stands on').toEqual({ level: 'f1', visible: 'f1', pos: [27.5, 27.5] });
  expect(await menuMove('f1', 27.5, 22.5), 'off the landing, still beside the stair').toEqual({ level: 'f1', visible: 'f1', pos: [22.5, 27.5] });
  expect(await menuMove('f1', 17.5, 22.5), 'onto the stair from the room').toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
  expect(await menuMove('f3', 27.5, 27.5), 'onto the stair from another floor').toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
});

test('a reload opens the map on the party\'s floor; a floor asked for wins; a first visit opens on the entry', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.moveParty('f2', 17.5, 27.5); await m.flush(); });
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await expect(page.getByRole('combobox', { name: 'Floor', exact: true })).toHaveValue('f2');
  expect(await pose(page)).toEqual({ level: 'f2', visible: 'f2', pos: [17.5, 27.5] });
  const asked = await page.evaluate(async () => { const a = (window as any).__mistlab.app; const ok = await a.open(a.cur.path, 'f1'); return { ok, visible: a.levelId, party: a.party.level }; });
  expect(asked).toEqual({ ok: true, visible: 'f1', party: 'f2' });
  // the castle, never visited: it opens on its entry (the main floor at the gate), where its party is made
  const first = await page.evaluate(async () => { const a = (window as any).__mistlab.app; await a.open('ch04/K'); return { visible: a.levelId, entry: a.cur.scene.entry, party: a.party.level }; });
  expect(first).toEqual({ visible: 'ground', entry: 'ground', party: 'ground' });
});

test('the Player Display follows the party up a stair and takes none of its own', async ({ page, context }) => {
  await open(page);
  const player = await context.newPage();
  await quiet(player);
  await player.goto('/?nosw&display=player&scene=appB/death-house');
  await player.waitForFunction(() => (window as any).__mistlab?.ready);
  await player.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => { const m = (window as any).__mistlab; m.moveParty('f1', 27.5, 27.5); m.app.takeLink('lk-spiral-1-2'); });
  await expect.poll(() => player.evaluate(() => ({ party: (window as any).__mistlab.app.party?.level, visible: (window as any).__mistlab.app.levelId }))).toEqual({ party: 'f2', visible: 'f2' });
  await player.evaluate(() => (window as any).__mistlab.app.takeLink('lk-spiral-2-3'));
  expect(await player.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  await player.close();
});
