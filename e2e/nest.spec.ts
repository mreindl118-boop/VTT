// The continuous world, step 4: nesting. A town's buildings and area maps open in place inside it as the camera
// keeps zooming (each hangs in its town's root at its atlas placement, and the town's own model of it goes while it is
// drawn); the depth decides the active map, so zooming in goes town → building and zooming out climbs building →
// town → valley. Enter from a building's card flies into it inside its town; Back pulls out over it and the town takes
// over; the breadcrumb in the title frames each scope. A dungeon under its town stands in the mist.
import { expect, test, type Page } from '@playwright/test';

const LONG = 600_000;
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

async function open(page: Page, scene: string): Promise<void> {
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene)}`, { timeout: LONG });
  await opened(page, scene);
}
async function opened(page: Page, scene: string): Promise<void> {
  await page.waitForFunction((s) => (window as any).__mistlab?.app?.cur?.path === s, scene, { timeout: LONG, polling: 250 });
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.tween, null, { timeout: LONG, polling: 100 });
}
const until = (page: Page, f: string, arg?: unknown) => page.waitForFunction(new Function('arg', `const m = window.__mistlab, a = m.app; return (${f});`) as (arg: unknown) => boolean, arg, { timeout: 180_000, polling: 200 });

/** Stand the camera over a map's middle (drawn feet, from the atlas through its parents) so that its footprint is
 *  `px` CSS pixels on screen as the streamer measures it; one camera change, as a hand would make. */
const aim = (page: Page, path: string, px: number) => page.evaluate(({ path, px }) => {
  const m = (window as any).__mistlab, a = m.app, w = a.world, F = m.frames, V = w.camera.position.constructor;
  const e = m.atlas.scenes[path];
  let pl = e.placement; for (let q = e.parent; q; q = m.atlas.scenes[q].parent) pl = F.compose(m.atlas.scenes[q].placement, pl);
  const [cx, cz] = F.centreOf(e.bbox), [x, y, z] = F.toWorld3(pl, [cx, e.elevationFt, cz]);
  const t = new V(x - w.anchor.x, y - w.anchor.y, z - w.anchor.z);
  const pxAt = (d: number) => { w.controls.target.copy(t); w.camera.position.copy(t).add(w.rigOffset(d)); w.camera.lookAt(t); w.camera.updateMatrixWorld(); return a.streamer.views().find((s: any) => s.path === path)?.px ?? 0; };
  let lo = 15, hi = 60000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (pxAt(mid) > px) lo = mid; else hi = mid; }
  w.moveTo(t, hi, false);
  return { dist: hi, px: pxAt(hi) };
}, { path, px });
/** The streamer's lines for a child here: where it takes the active role and where it gives it back. */
const lines = (page: Page) => page.evaluate(() => {
  const r = (window as any).__mistlab.app.world.renderer.domElement.getBoundingClientRect(), s = Math.min(r.width, r.height);
  return { enter: Math.max(220 * 1.6, 0.45 * s), leave: 0.6 * Math.max(220 * 1.6, 0.45 * s), hide: 110 };
});
/** A checksum of a map level's merged meshes (every vertex of every house). */
const sumOf = (page: Page, path: string, level: string) => page.evaluate(({ path, level }) => {
  const r = (window as any).__mistlab.app.resident.get(path); let h = 0;
  r.levels.get(level).root.traverse((o: any) => { if (o.isMesh && o.userData.ranges) { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 7) h = (h * 31 + Math.round(a[i] * 64)) | 0; } });
  return h;
}, { path, level });
/** The parent's own model of a site: are all its merged faces collapsed (true), all whole (false), or mixed? */
const plotOf = (page: Page, parent: string, level: string, key: string) => page.evaluate(({ parent, level, key }) => {
  const r = (window as any).__mistlab.app.resident.get(parent), lv = r.scene.levels.find((l: any) => l.id === level);
  const ids = new Set(lv.objects.filter((o: any) => o.key === key && ['house', 'church-building'].includes(o.kind)).map((o: any) => o.id));
  let flat = 0, whole = 0;
  r.levels.get(level).root.traverse((o: any) => {
    const rs = o.userData.ranges; if (!o.isMesh || !rs) return;
    const a = o.geometry.attributes.position.array;
    for (const g of rs) if (ids.has(g.id)) for (let f = g.start; f < g.end; f++) { const k = f * 9; if (a[k] === a[k + 3] && a[k + 3] === a[k + 6] && a[k + 1] === a[k + 4] && a[k + 2] === a[k + 8]) flat++; else whole++; }
  });
  return { ids: ids.size, flat, whole };
}, { parent, level, key });

/** The meshes of a map's own levels (not the maps hanging in it) that the section plane slices though they are not
 *  walls or doors: on a map that is not stacked, none. */
const cutOpen = (page: Page, path: string) => page.evaluate((path) => {
  const r = (window as any).__mistlab.app.resident.get(path), out: string[] = [];
  for (const b of r.levels.values()) b.root.traverse((o: any) => {
    if (!o.isMesh || ['wall', 'door'].includes(o.userData.role)) return;
    for (const m of [o.material].flat()) if (m.clippingPlanes?.length && !m.userData?.ghost) out.push(`${o.name}:${o.userData.role}`);
  });
  return [...new Set(out)];
}, path);

test('zooming into the Blue Water Inn opens it inside Vallaki; zooming out climbs back to the town and the valley', async ({ page }) => {
  test.setTimeout(LONG);
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, 'ch05/N');
  await page.evaluate(() => { const a = (window as any).__mistlab.app, o = a.open.bind(a); (window as any).__opens = 0; a.open = (...x: unknown[]) => { (window as any).__opens++; return o(...x); }; });
  const L = await lines(page);
  const whole = await sumOf(page, 'ch05/N', 'town');
  // over the inn's plot, the inn small on screen: the town's own house stands there
  await aim(page, 'ch05/N2', 150);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__mistlab.app.resident.has('ch05/N2'))).toBe(false);
  expect(await plotOf(page, 'ch05/N', 'town', 'N2')).toMatchObject({ flat: 0 });
  // nearer (still under the line where it takes the role): the inn streams in where the atlas hangs it, in the town's
  // root; the town's own house there goes; the town stays the active map
  await aim(page, 'ch05/N2', (L.enter + L.leave) / 2);
  await until(page, `(() => { const r = a.resident.get('ch05/N2'); return !!r && r.drawn && !!r.nest && !a.fades.has(r); })()`);
  const s1 = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, r = a.resident.get('ch05/N2');
    return { cur: a.cur.path, up: r.root.parent?.name, pos: r.root.position.toArray(), rot: r.root.rotation.y, ghost: !!r.ghost?.on, want: m.atlas.scenes['ch05/N2'].placement };
  });
  expect(s1).toMatchObject({ cur: 'ch05/N', up: 'scene:ch05/N', ghost: true });
  for (let k = 0; k < 3; k++) expect(Math.abs(s1.pos[k] - s1.want.position[k])).toBeLessThan(1e-6);
  expect(s1.rot).toBeCloseTo(s1.want.rotationY, 9);
  const plot = await plotOf(page, 'ch05/N', 'town', 'N2');
  expect(plot.ids).toBeGreaterThan(0);
  expect(plot).toMatchObject({ whole: 0 });
  expect(plot.flat).toBeGreaterThan(0);
  // closer still: the inn takes the role (no open, no travel), the origin on it; the title names where it hangs
  await aim(page, 'ch05/N2', L.enter + 60);
  await until(page, `a.cur.path === 'ch05/N2'`);
  const s2 = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, r = a.cur.root, abs = a.world.toAbsolute(r.getWorldPosition(r.position.clone())).toArray();
    return { opens: (window as any).__opens, party: a.state.world?.key, abs, anchor: m.anchor, crumbs: a.crumbs().map((c: any) => c.label), shown: [...document.querySelectorAll('.title .loc .crumb')].map((e) => e.textContent), back: !document.querySelector<HTMLElement>('[data-act="back"]')!.hidden, live: (() => { let g = 0; r.traverse((o: any) => { if (o.isMesh && o.material.userData?.ghost) g++; }); return g; })() };
  });
  expect(s2).toMatchObject({ opens: 0, party: 'N', back: true, live: 0 });
  for (let k = 0; k < 3; k++) expect(Math.abs(s2.abs[k] - s2.anchor[k])).toBeLessThan(1e-6);
  expect(s2.crumbs).toEqual(['Barovia', 'Town of Vallaki', 'Blue Water Inn', 'Ground floor']);
  expect(s2.shown).toEqual(s2.crumbs);
  // pulling back: under the lower line the town takes the role back while the inn is still drawn in its street
  await aim(page, 'ch05/N2', L.leave - 40);
  await until(page, `a.cur.path === 'ch05/N'`);
  expect(await page.evaluate(() => { const r = (window as any).__mistlab.app.resident.get('ch05/N2'); return [r.drawn, !!r.ghost?.on]; })).toEqual([true, true]);
  // the town's houses are whole again: the inn's section plane (on materials the two maps share) cuts only walls now
  expect(await cutOpen(page, 'ch05/N')).toEqual([]);
  // further: the inn folds and the town's house comes back exactly
  await aim(page, 'ch05/N2', L.hide - 30);
  await until(page, `(() => { const r = a.resident.get('ch05/N2'); return !r || (!r.drawn && !r.nest); })()`);
  expect(await sumOf(page, 'ch05/N', 'town')).toBe(whole);
  expect(await plotOf(page, 'ch05/N', 'town', 'N2')).toMatchObject({ flat: 0 });
  // out to the whole valley: the inn is freed after a while, the town stays the active map; nothing was opened
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld('fly'); await m.app.world.settled(); });
  await until(page, `!a.resident.has('ch05/N2')`);
  expect(await page.evaluate(() => [(window as any).__mistlab.app.cur.path, (window as any).__opens])).toEqual(['ch05/N', 0]);
});

test('Enter on a building while its town is taking the role back: the Enter wins, and the building stays the active map', async ({ page }) => {
  test.setTimeout(LONG);
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, 'ch05/N');
  const L = await lines(page);
  await aim(page, 'ch05/N2', L.enter + 60);
  await until(page, `a.cur.path === 'ch05/N2'`);
  await page.waitForTimeout(800);
  // under the lower line: the town begins to take the role back (its tint glides off); Enter is pressed meanwhile
  await aim(page, 'ch05/N2', L.leave - 40);
  await until(page, `a.switching?.path === 'ch05/N'`);
  const ok = await page.evaluate(() => (window as any).__mistlab.app.open('ch05/N2'));
  await page.waitForTimeout(2500); // (the town's fade would have ended long since)
  const s = await page.evaluate(() => { const a = (window as any).__mistlab.app; return { cur: a.cur.path, home: a.home, switching: a.switching?.path ?? null, crumbs: a.crumbs().map((c: any) => c.label), back: !document.querySelector<HTMLElement>('[data-act="back"]')!.hidden }; });
  expect({ ...s, ok }).toEqual({ ok: true, cur: 'ch05/N2', home: 'ch05/N2', switching: null, crumbs: ['Barovia', 'Town of Vallaki', 'Blue Water Inn', 'Ground floor'], back: true });
  // the town is a ghost again, tinted as the others are (not left at the tint of an active map)
  expect(await page.evaluate(() => { const g = (window as any).__mistlab.app.resident.get('ch05/N').ghost; return [g.on, g.tint > 0]; })).toEqual([true, true]);
  // the town crumb frames the town round the inn (not its whole level with its fields), and the town is active
  await page.locator('.title .loc [data-crumb="1"]').click();
  await until(page, `a.cur.path === 'ch05/N' && !a.world.tween`);
  const d = await page.evaluate(() => { const a = (window as any).__mistlab.app, w = a.world, t = a.toLocal3(w.controls.target); return { dist: w.camera.position.distanceTo(w.controls.target), t: [t.x, t.z] }; });
  expect(d.dist).toBeLessThan(4000);
  expect(Math.hypot(d.t[0] - 4385, d.t[1] - 2155)).toBeLessThan(300); // over the inn's plot
});

/** Frame a room of the active map at once, then tap the building on it (a house or the church) and press Enter. */
async function enterBuilding(page: Page, key: string): Promise<void> {
  const at = await page.evaluate((key) => {
    const m = (window as any).__mistlab, a = m.app, room = a.level.rooms.find((r: any) => r.key === key);
    const xs = room.polygon.map((p: number[]) => p[0]), zs = room.polygon.map((p: number[]) => p[1]), pad = 130; // (not so near that the building streams in)
    a.frameBox({ minX: Math.min(...xs) - pad, minZ: Math.min(...zs) - pad, maxX: Math.max(...xs) + pad, maxZ: Math.max(...zs) + pad }, a.level.elevationFt, a.camPreset, false);
    a.world.camera.updateMatrixWorld();
    const o = a.level.objects.find((x: any) => x.key === key && ['house', 'church-building'].includes(x.kind));
    return m.screenOf(o.pos[0], o.pos[2], (o.dims?.h ?? 11) / 2);
  }, key);
  await page.waitForTimeout(400);
  await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(450);
  const enter = page.locator('.infocard [data-a="enter"]');
  await expect(enter).toBeVisible();
  await enter.click();
}

test('Enter from Death House\'s card flies into it inside the village; its dungeon stands in the mist; Back and the breadcrumb climb out', async ({ page }) => {
  test.setTimeout(LONG);
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, 'ch03/E');
  const f0 = await page.evaluate(() => (window as any).__mistlab.app.world.flights);
  await enterBuilding(page, 'E7');
  await opened(page, 'appB/death-house');
  const s1 = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, v = a.resident.get('ch03/E');
    return { staged: a.staged, up: a.cur.root.parent?.name, village: !!v && v.drawn && !!v.ghost?.on, flew: a.world.flights, from: a.enteredFrom, nest: !!a.cur.nest, crumbs: a.crumbs().map((c: any) => c.label), level: a.level.name };
  });
  expect(s1).toMatchObject({ staged: true, up: 'scene:ch03/E', village: true, nest: true, from: { parent: 'ch03/E', key: 'E7', child: 'appB/death-house' } });
  expect(s1.flew).toBeGreaterThan(f0); // it flew there, in the valley
  expect(s1.crumbs).toEqual(['Barovia', 'Village of Barovia', 'Death House', s1.level]);
  expect(await plotOf(page, 'ch03/E', 'village', 'E7')).toMatchObject({ whole: 0 });
  // the lower dungeon lies under the village's grass: the valley and the village are left out of the frame, the mist
  // floor under it; back on the ground floor they return
  const under = () => page.evaluate(() => {
    const a = (window as any).__mistlab.app, on = (o: any) => o.layers.isEnabled(0);
    return { under: a.underground, stage: on(a.stage.root), village: on(a.resident.get('ch03/E').levels.get('village').root), house: on(a.cur.root), mist: a.world.mistFloor.visible };
  });
  await page.evaluate(() => (window as any).__mistlab.moveParty('dungeon-lower', 27.5, 12.5));
  expect(await under()).toEqual({ under: true, stage: false, village: false, house: true, mist: true });
  await page.evaluate(() => (window as any).__mistlab.moveParty('f1', 12.5, 27.5));
  expect(await under()).toEqual({ under: false, stage: true, village: true, house: true, mist: false });
  // Back: the camera pulls back over the house (same heading) and the village takes the role; the house stays drawn
  await page.evaluate(() => { const a = (window as any).__mistlab.app, w = a.world; a.frameLevel(); w.moveTo(w.controls.target.clone(), undefined, false, 0.7); });
  const az0 = await page.evaluate(() => (window as any).__mistlab.app.world.controls.getAzimuthalAngle());
  await page.locator('[data-act="back"]').click();
  await until(page, `a.cur.path === 'ch03/E' && !a.world.tween`);
  await page.waitForTimeout(1500); // the streamer has a few ticks to change its mind (it must not)
  const s2 = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, dh = a.resident.get('appB/death-house'), t = a.toLocal3(a.world.controls.target);
    const fp = m.atlas.scenes['appB/death-house'].footprintInParent, room = a.level.rooms.find((r: any) => r.key === 'E7');
    const xs = room.polygon.map((p: number[]) => p[0]), zs = room.polygon.map((p: number[]) => p[1]);
    return { cur: a.cur.path, drawn: !!dh?.drawn, ghost: !!dh?.ghost?.on, nest: !!dh?.nest, az: a.world.controls.getAzimuthalAngle(), t: [t.x, t.z], fp, room: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], back: !document.querySelector<HTMLElement>('[data-act="back"]')!.hidden, crumbs: a.crumbs().map((c: any) => c.label) };
  });
  expect(s2).toMatchObject({ cur: 'ch03/E', drawn: true, ghost: true, nest: true, back: false, crumbs: ['Barovia', 'Village of Barovia'] });
  expect(s2.t[0]).toBeGreaterThan(s2.room[0] - 20); expect(s2.t[0]).toBeLessThan(s2.room[1] + 20); // over the house's yard
  expect(s2.t[1]).toBeGreaterThan(s2.room[2] - 20); expect(s2.t[1]).toBeLessThan(s2.room[3] + 20);
  expect(Math.abs(Math.atan2(Math.sin(s2.az - az0), Math.cos(s2.az - az0)))).toBeLessThan(0.02);
  // on the players' side an interior that is not the active map is not drawn, and the village's house stands there
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  expect(await page.evaluate(() => { const r = (window as any).__mistlab.app.resident.get('appB/death-house'); return [r.root.visible, !!r.nest]; })).toEqual([false, false]);
  expect(await plotOf(page, 'ch03/E', 'village', 'E7')).toMatchObject({ flat: 0 });
  await page.evaluate(() => (window as any).__mistlab.app.setView('dm'));
  expect(await page.evaluate(() => { const r = (window as any).__mistlab.app.resident.get('appB/death-house'); return [r.root.visible, !!r.nest]; })).toEqual([true, true]);
  // zooming in again with the camera alone: the house takes the role back (no open)
  await aim(page, 'appB/death-house', 900);
  await until(page, `a.cur.path === 'appB/death-house'`);
  // leaving the dungeon (by the village's crumb, then by Back) brings the village and the valley back whole
  const veiled = () => page.evaluate(() => {
    const a = (window as any).__mistlab.app, v = a.resident.get('ch03/E'); let off = 0;
    v.root.traverse((o: any) => { if (!o.layers.isEnabled(0) || o.userData.veiled?.has('under')) off++; });
    return { cur: a.cur.path, under: a.underground, village: v.levels.get('village').root.layers.isEnabled(0), stage: a.stage.root.layers.isEnabled(0), off, mist: a.world.mistFloor.visible };
  });
  const down = async () => {
    await page.evaluate(() => (window as any).__mistlab.app.setLevel('dungeon-lower'));
    expect(await veiled()).toMatchObject({ cur: 'appB/death-house', under: true, village: false, stage: false });
  };
  const upOk = { cur: 'ch03/E', under: false, village: true, stage: true, off: 0, mist: false };
  await down();
  // the breadcrumb: the village's crumb frames the whole village and the village takes the role
  await page.locator('.title .loc [data-crumb="1"]').click();
  await until(page, `a.cur.path === 'ch03/E' && !a.world.tween`);
  expect(await veiled()).toEqual(upOk);
  await aim(page, 'appB/death-house', 900);
  await until(page, `a.cur.path === 'appB/death-house'`);
  await down();
  await page.locator('[data-act="back"]').click();
  await until(page, `a.cur.path === 'ch03/E' && !a.world.tween`);
  expect(await veiled()).toEqual(upOk);
  expect(await plotOf(page, 'ch03/E', 'village', 'E1')).toMatchObject({ flat: 0 });
  // the valley's crumb frames the whole valley, and the house, far behind, is freed
  await page.locator('.title .loc [data-crumb="0"]').click();
  await until(page, `!a.world.tween && a.stage.framed`);
  await until(page, `!a.resident.has('appB/death-house')`);
  expect(await page.evaluate(() => (window as any).__mistlab.app.cur.path)).toBe('ch03/E');
});

test('the abbey of Saint Markovia stands on its ledge in Krezk, 400 ft over the foot of its cliff: measured by its whole stack, it keeps the role; Back climbs to the village', async ({ page }) => {
  test.setTimeout(LONG);
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, 'ch08/S10');
  await page.waitForTimeout(3000); // the streamer has a few ticks to change its mind (it must not)
  const s1 = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, t = a.toLocal3(a.world.controls.target), v = a.streamer.views().find((x: any) => x.path === 'ch08/S10');
    const ledge = a.resident.get('ch08/S').levels.get('ledge').root; let flat = 0;
    ledge.traverse((o: any) => { if (o.isMesh && o.userData.ranges) { const p = o.geometry.attributes.position.array; for (let f = 0; f * 9 < p.length; f++) { const k = f * 9; if (p[k] === p[k + 3] && p[k] === p[k + 6] && p[k + 1] === p[k + 4] && p[k + 2] === p[k + 8]) flat++; } } });
    return { cur: a.cur.path, up: a.cur.root.parent?.name, level: a.levelId, y: t.y, inside: v.inside, px: v.px, flat, crumbs: a.crumbs().map((c: any) => c.label) };
  });
  expect(s1).toMatchObject({ cur: 'ch08/S10', up: 'scene:ch08/S', level: 'ground', inside: true, crumbs: ['Barovia', 'Village of Krezk', 'Abbey of Saint Markovia', 'Ground floor'] });
  expect(s1.y).toBeGreaterThan(395); // the camera's target rides the abbey's floor on the ledge, not the village below
  expect(s1.flat).toBeGreaterThan(0); // the village's own model of the abbey on its ledge level went
  await page.locator('[data-act="back"]').click();
  await until(page, `a.cur.path === 'ch08/S' && !a.world.tween`);
  // a level named as its map is not a second crumb
  expect(await page.evaluate(() => (window as any).__mistlab.app.crumbs().map((c: any) => c.label))).toEqual(['Barovia', 'Village of Krezk']);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the breadcrumb keeps its last two crumbs on screen, and Back climbs to the village', async ({ page }) => {
    test.setTimeout(LONG);
    await open(page, 'appB/death-house');
    const c = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.title .loc .ck')].map((e) => { const r = e.getBoundingClientRect(); const b = e.querySelector<HTMLElement>('.crumb')!; return { text: b.textContent, shown: getComputedStyle(e).display !== 'none' && r.width > 0, right: r.right, cut: b.scrollWidth > b.clientWidth + 1 }; }));
    // the village and the house (the floor picker names the floor), each in full and a finger's height to tap
    expect(c.map((x) => x.shown)).toEqual([false, true, true, false]);
    expect(c.filter((x) => x.shown).map((x) => x.text)).toEqual(['Village of Barovia', 'Death House']);
    for (const x of c.filter((x) => x.shown)) { expect(x.right).toBeLessThanOrEqual(390); expect(x.cut).toBe(false); }
    const hit = await page.evaluate(() => { const b = document.querySelector<HTMLElement>('.title .loc [data-crumb="2"]')!, r = b.getBoundingClientRect(), x = r.left + r.width / 2; return [-14, -10, 10, 14].map((dy) => document.elementFromPoint(x, r.top + r.height / 2 + dy)?.closest('[data-crumb]')?.getAttribute('data-crumb') ?? null); });
    expect(hit.slice(1, 3)).toEqual(['2', '2']); // 10 px above and below its text still press it
    const b = (await page.locator('[data-act="back"]').boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await until(page, `a.cur.path === 'ch03/E' && !a.world.tween`);
    expect(await page.evaluate(() => (window as any).__mistlab.app.resident.get('appB/death-house')?.drawn)).toBe(true);
  });
});
