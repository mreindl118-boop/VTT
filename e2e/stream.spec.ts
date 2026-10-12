// What leaves the world is freed, and opening a map is one step: the review's findings 9 (dispose obsolete map and
// range resources) and 11 (atomic location navigation), then the nested world's step 3, streaming: zooming in on a
// place loads its map in place, the camera's target picks the active map, zooming out folds and unloads.
import { expect, test, type Page, type Route } from '@playwright/test';
import { boot, diff, snap, SCENES } from './helpers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

/** GPU objects the renderer holds, after a frame. */
const mem = (page: Page) => page.evaluate(() => {
  const w = (window as any).__mistlab.app.world; w.renderNow();
  const i = w.renderer.info; return { geometries: i.memory.geometries as number, textures: i.memory.textures as number, programs: (i.programs?.length ?? 0) as number };
});

/** Scene chunks: vite emits each scene.json as its own `scene-*.js` module (with or without a query: a retry). */
const SCENE_JS = (u: URL) => /\/assets\/scene-[^/]*\.js$/.test(u.pathname);
/** Hold back (or cut) the scene chunk of one map. */
const sceneChunk = (re: RegExp, act: (r: Route) => Promise<void>) => async (route: Route) => {
  const res = await route.fetch(), body = await res.text();
  if (re.test(body)) return act(route);
  await route.fulfill({ response: res, body });
};

// ------------------------------------------------------------------ finding 9: everything that leaves is disposed

test('maps that leave are disposed: five round trips stay within 5% of the first visit, shared materials stay live', async ({ page }) => {
  test.setTimeout(420_000);
  await boot(page, '', SCENES[1]); // Death House
  const ROUND = ['ch03/E', 'ch02/G', 'dev/m0-test-room', 'appB/death-house'];
  const trip = () => page.evaluate(async (paths) => { const a = (window as any).__mistlab.app; for (const p of paths) { await a.open(p); a.world.renderNow(); } }, ROUND);
  await trip();
  // the test room as first seen (after one trip: the palette and the valley are warm)
  await page.evaluate(async () => { const m = (window as any).__mistlab; await m.app.open('dev/m0-test-room'); m.app.frameLevel('top'); m.render(); });
  await snap(page, 'first');
  await page.evaluate(async () => { await (window as any).__mistlab.app.open('appB/death-house'); });
  const first = await mem(page);
  for (let i = 0; i < 5; i++) await trip();
  const last = await mem(page);
  expect(last.geometries, `geometries ${first.geometries} → ${last.geometries}`).toBeLessThanOrEqual(Math.ceil(first.geometries * 1.05));
  expect(last.textures, `textures ${first.textures} → ${last.textures}`).toBeLessThanOrEqual(Math.ceil(first.textures * 1.05));
  // the shared palette materials were never disposed under a live map: the test room draws the same pixels
  await page.evaluate(async () => { const m = (window as any).__mistlab; await m.app.open('dev/m0-test-room'); m.app.frameLevel('top'); m.render(); });
  await snap(page, 'again');
  expect((await diff(page, 'first', 'again')).changed).toBe(0);
});

test('range overlays and token figures are disposed when they are rebuilt', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', SCENES[0]);
  await page.evaluate(() => { const a = (window as any).__mistlab.app; a.setRangeHelper(true); a.select(a.party.id); a.world.renderNow(); });
  const r0 = await mem(page);
  await page.evaluate(() => { const a = (window as any).__mistlab.app; for (let i = 0; i < 100; i++) { a.refreshRange(); a.world.renderNow(); } });
  const r1 = await mem(page);
  expect(r1.geometries - r0.geometries, '100 range refreshes').toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => !!(window as any).__mistlab.app.rangeFor)).toBe(true); // the overlay is still there
  // every view toggle rebuilds the token figures (the players' names): the old ones go
  await page.evaluate(() => { const a = (window as any).__mistlab.app; a.select(null); a.setRangeHelper(false); const g = a.addCreatureNearParty('ghoul'); a.setTokenHidden(g.id, false); a.world.renderNow(); });
  const t0 = await mem(page);
  await page.evaluate(() => { const a = (window as any).__mistlab.app; for (let i = 0; i < 20; i++) { a.setView('players'); a.world.renderNow(); a.setView('dm'); a.world.renderNow(); } });
  const t1 = await mem(page);
  expect(t1.geometries - t0.geometries, '20 view toggles').toBeLessThanOrEqual(2);
});

// ------------------------------------------------------------------ finding 11: opening a map is atomic

test('two opens at once: the latest request wins and only its map is mounted', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', SCENES[0]);
  // the village's scene arrives three seconds late; Death House, asked for after it, arrives first
  await page.route(SCENE_JS, sceneChunk(/location:.E.,chapter:.ch03./, async (r) => { await new Promise((d) => setTimeout(d, 3000)); await r.continue(); }));
  const r = await page.evaluate(async () => {
    const a = (window as any).__mistlab.app, w = a.world;
    const p1 = a.open('ch03/E'), p2 = a.open('appB/death-house');
    const settled = await Promise.allSettled([p1, p2]);
    await new Promise((d) => setTimeout(d, 500));
    w.renderNow();
    const roots = w.root.children.filter((o: any) => o.name.startsWith('scene:')).map((o: any) => o.name);
    // every label on the page belongs to the open map, its tokens or the valley (hidden while a legacy map is open)
    const known = new Set<Element>(a.cur.labels.map((l: any) => l.obj.element));
    for (const g of a.cur.tokens.values()) g.traverse((c: any) => { if (c.element) known.add(c.element); });
    const stray = [...document.querySelectorAll('.labels .lbl')].filter((e) => !known.has(e) && !e.matches('.place, .world-party') && (e as HTMLElement).style.display !== 'none');
    return { path: a.cur.path, roots, stray: stray.length, rejected: settled.filter((s) => s.status === 'rejected').length, staged: a.staged };
  });
  expect(r).toEqual({ path: 'appB/death-house', roots: ['scene:appB/death-house'], stray: 0, rejected: 0, staged: false });
});

test('a map that fails to load leaves the open map as it was and says so', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', SCENES[0]);
  const before = await page.evaluate(() => { const a = (window as any).__mistlab.app; a.world.renderNow(); return { path: a.cur.path, labels: a.cur.labels.filter((l: any) => l.obj.element.isConnected).length, campaign: a.campaign.id }; });
  // offline: Tser Pool's scene (same campaign) and the Sheep campaign's tavern cannot be fetched
  await page.route(SCENE_JS, sceneChunk(/location:.G.,chapter:.ch02.|location:.01-tavern./, (r) => r.abort('internetdisconnected')));
  for (const path of ['ch02/G', 'wsc/01-tavern']) {
    const r = await page.evaluate(async (p) => {
      const a = (window as any).__mistlab.app, w = a.world;
      let threw = false; try { await a.open(p); } catch { threw = true; }
      w.renderNow();
      return { threw, path: a.cur.path, mounted: a.cur.root.parent === w.root, roots: w.root.children.filter((o: any) => o.name.startsWith('scene:')).length,
        labels: a.cur.labels.filter((l: any) => l.obj.element.isConnected).length, campaign: a.campaign.id, body: document.body.dataset.campaign, status: a.status };
    }, path);
    expect(r, path).toMatchObject({ threw: false, path: before.path, mounted: true, roots: 1, campaign: before.campaign, body: before.campaign });
    expect(r.labels, path).toBe(before.labels);
    expect(r.status, path).toMatch(/Couldn.t open/);
  }
  // back online: it opens
  await page.unroute(SCENE_JS);
  await page.evaluate(() => (window as any).__mistlab.app.open('ch02/G'));
  expect(await page.evaluate(() => (window as any).__mistlab.app.cur.path)).toBe('ch02/G');
});
