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

// ------------------------------------------------------------------ step 3: streaming the valley's maps

const VILLAGE = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };

/** Glide the camera (no open(), no button) to look at a point between places, or at a place's middle, from `dist` feet. */
const look = (page: Page, at: string | [string, string], dist: number, top = false) => page.evaluate(async ({ at, dist, top }) => {
  const m = (window as any).__mistlab, w = m.app.world, V = w.camera.position.constructor;
  w.tilt = top ? 1 : 0; // from straight above, two places either side of the target are the same size on screen
  const mid = (p: string) => { const e = m.atlas.scenes[p], b = e.worldBounds; return [(b.minX + b.maxX) / 2, e.placement.position[1] + e.elevationFt, (b.minZ + b.maxZ) / 2]; };
  const ps = (Array.isArray(at) ? at : [at]).map(mid), c = [0, 1, 2].map((k) => ps.reduce((a, p) => a + p[k], 0) / ps.length);
  w.flyTo(new V(c[0] - w.anchor.x, c[1] - w.anchor.y, c[2] - w.anchor.z), dist); await w.settled();
}, { at, dist, top });
/** The valley's maps now: which are resident, drawn, ghosts, and the active one. */
const valley = (page: Page) => page.evaluate(() => {
  const a = (window as any).__mistlab.app, st = a.stage;
  const res: { path: string; drawn: boolean; shown: boolean; ghost: boolean; ghostMats: number; liveMats: number; lights: number; proxy: boolean; labels: number }[] = [...a.resident.values()].map((r: any) => {
    let ghostMats = 0, liveMats = 0, lights = 0; r.root.traverse((o: any) => { if (o.isMesh && o.visible) { if (o.material.userData?.ghost) ghostMats++; else liveMats++; } if (o.isPointLight && o.visible) lights++; });
    return { path: r.path, drawn: r.drawn, shown: r.root.visible, ghost: !!r.ghost?.on, ghostMats, liveMats, lights, proxy: st.proxies.get(r.path)?.visible, labels: r.labels.filter((l: any) => l.obj.visible).length };
  });
  return { cur: a.cur.path, staged: a.staged, res, units: a.streamer.units(), cap: a.streamer.cap, maxUnits: a.streamer.maxUnits, party: a.state.world?.key as string | undefined, log: a.streamLog as { path: string; ms: number; slices: number; longest: number }[], flights: a.world.flights as number };
});
const resident = (page: Page, path: string, drawn = true) => page.waitForFunction(({ path, drawn }) => {
  const a = (window as any).__mistlab.app, r = a.resident.get(path);
  return !!r && r.drawn === drawn && !a.fades?.has?.(r) && (drawn ? !a.stage.proxies.get(path).visible : a.stage.proxies.get(path).visible);
}, { path, drawn }, { timeout: 90_000 });

test('zooming in on a place streams its map in place and the camera makes it active; zooming out folds it, then frees it', async ({ page }) => {
  test.setTimeout(420_000);
  await boot(page, '', VILLAGE);
  await page.evaluate(() => (window as any).__mistlab.app.frameLevel());
  await page.waitForTimeout(800);
  const before = await mem(page);
  await page.evaluate(() => { const a = (window as any).__mistlab.app, o = a.open.bind(a); (window as any).__opens = 0; a.open = (...x: unknown[]) => { (window as any).__opens++; return o(...x); }; });
  // over Tser Pool, 1,200 ft up: no button, no open(): its map streams in and becomes the active one
  await look(page, 'ch02/G', 1200);
  await page.waitForFunction(() => (window as any).__mistlab.app.cur.path === 'ch02/G', undefined, { timeout: 90_000 });
  await resident(page, 'ch02/G');
  const g = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, e = m.atlas.scenes['ch02/G'];
    return { opens: (window as any).__opens, abs: a.cur.root.position.toArray(), want: e.placement.position, anchor: m.anchor, tokens: a.tokensHere().length, partyMark: a.stage.party.visible };
  });
  expect(g.opens).toBe(0);
  for (let k = 0; k < 3; k++) expect(Math.abs(g.abs[k] - g.want[k])).toBeLessThan(0.01);
  expect(g.anchor).toEqual(g.abs); // the floating origin moved onto it
  const v1 = await valley(page);
  expect(v1.party).toBe('E'); // looking at a place is not travelling there
  expect(g.tokens).toBe(0); // the party's token is in the village, not here
  expect(g.partyMark).toBe(true); // the '&' marks the party on the land
  const G = v1.res.find((r) => r.path === 'ch02/G')!;
  expect(G).toMatchObject({ drawn: true, shown: true, ghost: false, ghostMats: 0, proxy: false });
  expect(v1.log.find((l) => l.path === 'ch02/G')).toBeTruthy();
  // pull back to the whole valley: the active map folds into its proxy (it stays active), the draw budget holds
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld('fly'); await m.app.world.settled(); });
  await resident(page, 'ch02/G', false);
  const v2 = await valley(page);
  expect(v2.cur).toBe('ch02/G');
  expect(v2.res.every((r) => !r.drawn && !r.shown && r.proxy)).toBe(true);
  const info = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.renderNow(); return { calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles }; });
  expect(info.calls).toBeLessThanOrEqual(70);
  expect(info.tris).toBeLessThanOrEqual(300_000);
  // back down onto the village: it unfolds and becomes active again; Tser Pool, left behind, is freed after a while
  await look(page, 'ch03/E', 1500);
  await page.waitForFunction(() => (window as any).__mistlab.app.cur.path === 'ch03/E', undefined, { timeout: 90_000 });
  await page.waitForFunction(() => !(window as any).__mistlab.app.resident.has('ch02/G'), undefined, { timeout: 60_000 });
  await resident(page, 'ch03/E');
  await page.evaluate(() => (window as any).__mistlab.app.frameLevel());
  await page.waitForTimeout(800);
  const after = await mem(page);
  expect(Math.abs(after.geometries - before.geometries), `geometries ${before.geometries} → ${after.geometries}`).toBeLessThanOrEqual(5);
  expect(Math.abs(after.textures - before.textures), `textures ${before.textures} → ${after.textures}`).toBeLessThanOrEqual(5);
  const v3 = await valley(page);
  expect(v3.res.map((r) => r.path)).toEqual(['ch03/E']);
  expect(await page.evaluate(() => { const a = (window as any).__mistlab.app; return { party: !!a.party, mark: a.stage.party.visible, tokens: a.cur.tokens.size }; })).toEqual({ party: true, mark: false, tokens: 1 });
});

test('places between the camera\'s stops are ghosts; a tour keeps to the unit cap; builds are sliced', async ({ page }) => {
  test.setTimeout(420_000);
  await boot(page, '', VILLAGE);
  // between the Old Svalich Road and the Gates of Barovia, 3,500 ft up: both stream in, neither holds the target
  await look(page, ['ch02/A', 'ch02/B'], 3500, true);
  await resident(page, 'ch02/A'); await resident(page, 'ch02/B');
  const v1 = await valley(page);
  expect(v1.cur).toBe('ch03/E');
  for (const p of ['ch02/A', 'ch02/B']) {
    const r = v1.res.find((x) => x.path === p)!;
    expect(r, p).toMatchObject({ drawn: true, shown: true, ghost: true, liveMats: 0, lights: 0, labels: 0, proxy: false });
    expect(r.ghostMats, p).toBeGreaterThan(3);
  }
  // a ghost looks as the map would if it were active: the same cut, roofs and level (only a faint tint of the mist)
  const look1 = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, r = a.resident.get('ch02/A'), out: number[] = [];
    r.root.traverse((o: any) => { if (o.isMesh && o.material.clippingPlanes?.length) out.push(o.material.clippingPlanes[0].constant); });
    return { clipped: out.length, at: out[0], base: r.root.matrixWorld.elements[13], tint: r.ghost.tint };
  });
  expect(look1.tint).toBeGreaterThan(0);
  if (look1.clipped) expect(look1.at - look1.base).toBeCloseTo(5, 3); // walls cut 5 ft over the floor, as on an active map
  // into the Old Svalich Road: it becomes active (its own materials, its lamps), the gates stay a ghost
  await look(page, 'ch02/A', 1500);
  await page.waitForFunction(() => (window as any).__mistlab.app.cur.path === 'ch02/A', undefined, { timeout: 90_000 });
  await resident(page, 'ch02/A');
  const v2 = await valley(page);
  const A = v2.res.find((x) => x.path === 'ch02/A')!;
  expect(A).toMatchObject({ ghost: false, ghostMats: 0 });
  expect(A.liveMats).toBeGreaterThan(3);
  // a tour of four more places: never more than the cap resident (the least recently wanted map makes room)
  await page.evaluate(() => { (window as any).__mistlab.app.streamer.cap = 3; });
  const seen: number[] = [];
  for (const p of ['ch02/C', 'ch02/B', 'ch02/D', 'ch03/E']) {
    await look(page, p, 1200);
    await page.waitForFunction((p) => (window as any).__mistlab.app.cur.path === p, p, { timeout: 120_000 });
    const v = await valley(page); seen.push(v.units);
    expect(v.party, p).toBe('E'); // looking round is not travelling
  }
  const end = await valley(page);
  expect(Math.max(...seen)).toBeLessThanOrEqual(3);
  expect(end.maxUnits).toBeLessThanOrEqual(4); // (the cap was 4 until the tour)
  // every build ran in slices, none of them long, and none while a glide was in flight
  expect(end.log.length).toBeGreaterThanOrEqual(5);
  for (const l of end.log) {
    expect(l.slices, l.path).toBeGreaterThan(1);
    expect(l.longest, l.path).toBeLessThan(250); // swiftshader, two test runs sharing four cores: a desktop is many times quicker
  }
});

test('the Player Display draws what the DM\'s camera streams in and follows the map it makes active; the party stays put', async ({ page }) => {
  test.setTimeout(420_000);
  await boot(page, '', VILLAGE);
  const display = await page.context().newPage();
  await display.goto(`/?nosw&display=player&scene=${encodeURIComponent('ch03/E')}`);
  await display.waitForFunction(() => { const m = (window as any).__mistlab; return m?.app?.cur?.path === 'ch03/E' && m.staged; }, undefined, { timeout: 120_000 });
  await look(page, 'ch02/G', 1200);
  await page.waitForFunction(() => (window as any).__mistlab.app.cur.path === 'ch02/G', undefined, { timeout: 90_000 });
  await page.evaluate(() => (window as any).__mistlab.app.layoutChanged()); // (a fresh camera message)
  await display.waitForFunction(() => { const a = (window as any).__mistlab.app, r = a.resident.get('ch02/G'); return a.cur.path === 'ch02/G' && !!r && r.drawn && r.root.visible && !a.stage.proxies.get('ch02/G').visible; }, undefined, { timeout: 120_000 });
  const d = await display.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, w = a.world;
    return { party: a.state.world?.key, mark: a.stage.party.visible, tokens: a.cur.tokens.size, anchor: m.anchor, tgt: w.toAbsolute(w.controls.target).toArray(), live: (() => { let g = 0; a.cur.root.traverse((o: any) => { if (o.isMesh && o.material.userData?.ghost) g++; }); return g; })() };
  });
  const dm = await page.evaluate(() => { const m = (window as any).__mistlab, w = m.app.world; return { anchor: m.anchor, tgt: w.toAbsolute(w.controls.target).toArray() }; });
  expect(d).toMatchObject({ party: 'E', mark: true, tokens: 0, live: 0 });
  for (let k = 0; k < 3; k++) { expect(Math.abs(d.anchor[k] - dm.anchor[k])).toBeLessThan(0.01); expect(Math.abs(d.tgt[k] - dm.tgt[k])).toBeLessThan(0.5); }
  await display.close();
});
