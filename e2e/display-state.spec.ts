import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function display(page: Page) {
  await quiet(page);
  await page.addInitScript(() => {
    (window as any).__puts = [];
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      (window as any).__puts.push({ key, id: value?.id, name: value?.name });
      return put.call(this, value, key);
    };
  });
  await page.goto('/?nosw&display=player&scene=ch03/E');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.channel.bc?.close(); // deterministic messages below, without another open DM tab
    a.state.name = 'committed CoS';
    (window as any).__puts.length = 0;
  });
}
const snapshot = (page: Page) => page.evaluate(() => {
  const a = (window as any).__mistlab.app;
  return { path: a.cur.path, campaign: a.campaign.id, state: structuredClone(a.state), nested: a.nested, from: a.enteredFrom ?? null };
});
test.beforeEach(async ({ page }) => { await display(page); });
test.setTimeout(120_000);

test('a failed display campaign load preserves its committed map, state and navigation settings', async ({ page }) => {
  const before = await snapshot(page);
  await page.evaluate(async () => {
    const a = (window as any).__mistlab.app, load = a.load;
    a.load = async () => { throw new Error('controlled unavailable scene'); };
    try {
      await a.onMsg({ kind: 'state', location: 'wsc/01-tavern', nested: false,
        from: { parent: 'wsc/01-tavern', child: 'wsc/02-road', level: 'ground', key: '1' },
        state: { ...structuredClone(a.state), id: 'wsc', name: 'rejected WSC', tokens: [], reveals: [] } });
    } finally { a.load = load; }
  });
  expect(await snapshot(page)).toEqual(before);
});

for (const location of ['ch02/G', 'ch03/E']) {
  test(`newer display state for ${location} wins over an older delayed campaign load`, async ({ page }) => {
    await page.evaluate(() => {
      const w = window as any, a = w.__mistlab.app, load = a.load.bind(a);
      w.__load = load;
      a.load = async (path: string, ...args: any[]) => {
        if (path === 'wsc/01-tavern') { w.__held = true; await new Promise<void>((r) => { w.__release = r; }); }
        return load(path, ...args);
      };
      w.__older = a.onMsg({ kind: 'state', location: 'wsc/01-tavern', nested: true,
        state: { ...structuredClone(a.state), id: 'wsc', name: 'older WSC', tokens: [], reveals: [] } });
    });
    await page.waitForFunction(() => (window as any).__held);
    await page.evaluate(async (location) => {
      const a = (window as any).__mistlab.app;
      await a.onMsg({ kind: 'state', location, nested: true,
        state: { ...structuredClone(a.state), name: 'newest CoS', tokens: [], reveals: [] } });
    }, location);
    const newest = await snapshot(page);
    expect(newest.path).toBe(location);
    expect(newest.campaign).toBe('cos');
    expect(newest.state.name).toBe('newest CoS');
    await page.evaluate(async () => { const w = window as any; w.__release(); await w.__older; w.__mistlab.app.load = w.__load; });
    expect(await snapshot(page)).toEqual(newest);
  });
}

test('the Player Display never saves received campaign state on a campaign switch', async ({ page }) => {
  await page.evaluate(async () => {
    const a = (window as any).__mistlab.app;
    a.state.name = 'display-only received state';
    await a.open('wsc/01-tavern');
    await a.open('ch03/E');
  });
  expect(await page.evaluate(() => (window as any).__puts)).toEqual([]);
});

test('the Player Display keeps each token\'s miniature from one state message to the next, and builds anew only one that changed', async ({ page }) => {
  // The DM sends the state on every change (each move): rebuilding every miniature each time stalled the display.
  const r = await page.evaluate(async () => {
    const a = (window as any).__mistlab.app;
    a.setJiggle(true);
    const loc = a.cur.scene.location, level = a.levelId, at: number[] = a.party?.pos ?? [20, 20], base = structuredClone(a.state);
    // a character with a miniature of their own (a stand-in, not a table's), and a creature the players have been shown
    const sheet = { id: 'e2e-pc', name: 'Stand-in', color: '#6b3fa0', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind: 'pc', figure: { frame: 'feminine', weapon: 'mace' } };
    const tok = { location: loc, level, size: 'medium', darkvisionFt: 0, color: '#6b3fa0' };
    const ghoul = { ...tok, id: 'e2e-ghoul', name: 'Ghoul', pos: [at[0], at[1] + 10], role: 'creature', creatureId: 'ghoul', hidden: false };
    const send = (hero: object) => a.onMsg({ kind: 'state', location: a.cur.path, nested: a.nested, state: { ...structuredClone(base),
      roster: [...base.roster, sheet], tokens: [...base.tokens, ghoul, { ...tok, id: 'e2e-hero', name: 'Stand-in', role: 'pc', sheetId: 'e2e-pc', pos: [at[0] + 5, at[1]], ...hero }] } });
    const figOf = (id: string) => a.cur.tokens.get(id)?.userData.fig?.fig;
    await send({});
    const ids = [...a.cur.tokens.keys()] as string[], first = new Map(ids.map((id) => [id, figOf(id)]));
    let freed = 0;
    for (const f of first.values()) f?.traverse((o: any) => { if (!o.isMesh) return; o.geometry.addEventListener('dispose', () => freed++); for (const m of [o.material].flat()) m.addEventListener('dispose', () => freed++); });
    const sprungAtFirst = a.jiggle.bodies.get('e2e-hero')?.root === first.get('e2e-hero');
    a.jiggle.kick('e2e-hero', 8, 3);
    // two moves: the same miniatures stand where the tokens now stand, none is freed, and the bounce carries on
    await send({ pos: [at[0] + 10, at[1]] });
    await send({ pos: [at[0] + 15, at[1]] });
    const moved = { kept: ids.filter((id) => !!first.get(id) && figOf(id) === first.get(id)), freed, at: a.cur.tokens.get('e2e-hero').position.x - at[0],
      follows: a.jiggle.bodies.get('e2e-hero')?.root === first.get('e2e-hero'), bouncing: a.jiggle.bouncing('e2e-hero') };
    // the character goes down: their miniature alone is built anew, the old one is freed, and the spring follows the new one
    await send({ pos: [at[0] + 15, at[1]], down: true });
    const down = { kept: ids.filter((id) => figOf(id) === first.get(id)), freed, follows: a.jiggle.bodies.get('e2e-hero')?.root === figOf('e2e-hero') };
    return { ids, withFigure: ids.filter((id) => !!first.get(id)), sprungAtFirst, moved, down };
  });
  expect(r.ids).toEqual(expect.arrayContaining(['e2e-hero', 'e2e-ghoul']));
  expect(r.withFigure).toEqual(r.ids);
  expect(r.sprungAtFirst).toBe(true);
  expect(r.moved.kept).toEqual(r.ids);
  expect(r.moved.freed).toBe(0);
  expect(r.moved.at).toBeCloseTo(15);
  expect(r.moved.follows).toBe(true);
  expect(r.moved.bouncing).toBe(true);
  expect(r.down.kept).toEqual(r.ids.filter((id) => id !== 'e2e-hero'));
  expect(r.down.freed).toBeGreaterThan(0);
  expect(r.down.follows).toBe(true);
});

test('the Player Display builds a token\'s miniature in its transformed look while its switch is on, and its own look again when it is off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const a = (window as any).__mistlab.app;
    const loc = a.cur.scene.location, level = a.levelId, at: number[] = a.party?.pos ?? [20, 20], base = structuredClone(a.state);
    // two stand-in characters with miniatures of their own: one whose figure has a transformed look (wings), one without
    const sheet = { name: 'Stand-in', color: '#6b3fa0', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind: 'pc' };
    const roster = [...base.roster, { ...sheet, id: 'e2e-pc', figure: { frame: 'feminine', transform: { wings: { color: '#ffffff', count: 2 } } } }, { ...sheet, id: 'e2e-plain', figure: { frame: 'feminine' } }];
    const tok = { location: loc, level, size: 'medium', darkvisionFt: 0, color: '#6b3fa0', name: 'Stand-in', role: 'pc' };
    const send = (flags: object) => a.onMsg({ kind: 'state', location: a.cur.path, nested: a.nested, state: { ...structuredClone(base), roster,
      tokens: [...base.tokens, { ...tok, id: 'e2e-hero', sheetId: 'e2e-pc', pos: [at[0] + 5, at[1]], ...flags }, { ...tok, id: 'e2e-other', sheetId: 'e2e-plain', pos: [at[0] + 10, at[1]], ...flags }] } });
    const figOf = (id: string) => a.cur.tokens.get(id)?.userData.fig?.fig;
    const meshes = (id: string) => { let n = 0; figOf(id).traverse((o: any) => { if (o.isMesh) n++; }); return n; };
    const seen = () => ({ hero: figOf('e2e-hero'), other: figOf('e2e-other'), heroMeshes: meshes('e2e-hero'), otherMeshes: meshes('e2e-other') });
    await send({});
    const off = seen();
    await send({ transformed: true });
    const on = seen();
    await send({ transformed: true });
    const still = seen();
    await send({});
    const back = seen();
    return { offMeshes: off.heroMeshes, onMeshes: on.heroMeshes, backMeshes: back.heroMeshes, rebuiltOn: on.hero !== off.hero, keptWhileOn: still.hero === on.hero, rebuiltOff: back.hero !== on.hero,
      otherKept: on.other === off.other && back.other === off.other, otherMeshes: [off.otherMeshes, on.otherMeshes, back.otherMeshes] };
  });
  expect(r.rebuiltOn).toBe(true);
  expect(r.onMeshes).toBeGreaterThan(r.offMeshes);
  expect(r.keptWhileOn).toBe(true);
  expect(r.rebuiltOff).toBe(true);
  expect(r.backMeshes).toBe(r.offMeshes);
  // a character whose figure has no transformed look keeps its miniature whatever its switch says
  expect(r.otherKept).toBe(true);
  expect(new Set(r.otherMeshes).size).toBe(1);
});
