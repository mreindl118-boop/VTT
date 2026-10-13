// Zoom and nesting: a tap on a town's building offers Enter, Back keeps your place, zoom presses during a glide add up,
// a zoom out at the far limit offers the map one level up, the abbey's surroundings follow the room entered from, the
// zoom buttons take taps on a phone, and none of it reaches Players mode. Desktop 1366x768 and a 390x844 touch phone.
// These are the legacy way's (?nested=0: one map at a time, a building opened alone with its town's surroundings); in
// the continuous world a building opens inside its town and zooming out climbs to it (nest.spec.ts). Card Enter with
// Back, and Players mode, run both ways.
import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

// Vallaki is a town a mile and a half across; a busy software renderer can take minutes to build and draw it.
const LONG = 20 * 60_000;
const VALLAKI_SITES = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N8a', 'N8b', 'N8c', 'N8d', 'N9'];
const DEVICES = [
  { name: 'desktop', touch: false, use: { viewport: { width: 1366, height: 768 } } },
  { name: 'phone', touch: true, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
];
type Pt = [number, number];
type Cam = { path: string; level: string; target: [number, number, number]; dist: number; az: number; max: number };

test.beforeEach(async ({ page }) => { await quiet(page); });

/** Wait until a scene is open and the camera has stopped gliding. */
async function opened(page: Page, scene: string): Promise<void> {
  await page.waitForFunction((s) => (window as any).__mistlab?.app?.cur?.path === s, scene, { timeout: LONG, polling: 250 });
  await settle(page);
}
async function open(page: Page, scene: string, nested = false): Promise<void> {
  await page.goto(`/?nosw${nested ? '' : '&nested=0'}&scene=${encodeURIComponent(scene)}`, { timeout: LONG });
  await opened(page, scene);
}
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.tween, null, { timeout: LONG, polling: 100 });
}
const cam = (page: Page): Promise<Cam> => page.evaluate(() => {
  const a = (window as any).__mistlab.app, w = a.world, t = w.controls.target;
  return { path: a.cur.path, level: a.levelId, target: [t.x, t.y, t.z], dist: w.camera.position.distanceTo(t), az: w.controls.getAzimuthalAngle(), max: w.controls.maxDistance };
});
/** Is the camera's target inside a room of the open map? */
const targetIn = (page: Page, key: string): Promise<boolean> => page.evaluate((key) => {
  const a = (window as any).__mistlab.app, r = a.level.rooms.find((x: any) => x.key === key), t = a.world.controls.target, p = [t.x, t.z];
  let c = false;
  for (let i = 0, j = r.polygon.length - 1; i < r.polygon.length; j = i++) { const [xi, zi] = r.polygon[i], [xj, zj] = r.polygon[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c; }
  return c;
}, key);
/** Frame a room at once (no glide to wait for), on its level. */
const frameRoom = (page: Page, key: string): Promise<void> => page.evaluate(async (key) => {
  const a = (window as any).__mistlab.app, hit = a.findRooms(key).find((h: any) => h.room.key === key);
  if (a.levelId !== hit.level.id) a.setLevel(hit.level.id);
  const xs = hit.room.polygon.map((p: number[]) => p[0]), zs = hit.room.polygon.map((p: number[]) => p[1]), pad = 40;
  a.world.frame({ minX: Math.min(...xs) - pad, minZ: Math.min(...zs) - pad, maxX: Math.max(...xs) + pad, maxZ: Math.max(...zs) + pad }, hit.level.elevationFt, a.camPreset, false);
  // This fixture taps the town's building, before continuous zoom enters its child map.
  // Keep the injected camera outside the child's fold line so its ghost does not replace
  // the building being tapped; wheel/touch entry is exercised in nest.spec.
  if (a.world.nested) {
    const w = a.world;
    let farther = 1;
    for (const s of a.streamer.views()) if (s.inside && (s.chain ?? []).includes(a.cur.path)) {
      const line = (s.depth > 1 ? 130 : 110) * s.units;
      farther = Math.max(farther, s.px / (line * 0.8));
    }
    if (farther > 1) w.moveTo(w.controls.target.clone(), w.camera.position.distanceTo(w.controls.target) * farther, false);
    a.streamer.tick();
    await new Promise((resolve) => setTimeout(resolve, 300)); // the proxy/map crossfade
  }
  a.world.camera.updateMatrixWorld();
}, key);
/** Where on screen a point of the current level is (y above its floor). */
const screenOf = (page: Page, x: number, z: number, y: number): Promise<Pt> => page.evaluate(({ x, z, y }) => (window as any).__mistlab.screenOf(x, z, y), { x, z, y });
/** The building that stands for a site: a house, else the church, the tent, the hut or the stage; aimed at mid-height. */
const buildingOf = (page: Page, key: string): Promise<{ id: string; at: [number, number, number] }> => page.evaluate((key) => {
  const a = (window as any).__mistlab.app, PRI = ['house', 'church-building', 'big-tent', 'creeping-hut', 'dais', 'well'];
  const o = a.level.objects.filter((x: any) => x.key === key && x.vis === 'player' && PRI.includes(x.kind)).sort((x: any, y: any) => PRI.indexOf(x.kind) - PRI.indexOf(y.kind))[0];
  const y = o.kind === 'house' ? (o.dims?.h ?? 11) / 2 : o.pos[1] + Math.min(o.kind === 'big-tent' ? 15 : 4, (o.dims?.h ?? 8) / 2);
  return { id: o.id, at: [o.pos[0], y, o.pos[2]] };
}, key);
async function tapAt(page: Page, touch: boolean, [x, y]: Pt): Promise<void> {
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await page.waitForTimeout(450); // clear of the double-tap window
}
/** Press a control where it is drawn, as a finger or the mouse would (whatever lies on top takes the press). */
async function press(page: Page, touch: boolean, selector: string): Promise<void> {
  const b = (await page.locator(selector).boundingBox())!;
  await tapAt(page, touch, [b.x + b.width / 2, b.y + b.height / 2]);
}
const closeCards = (page: Page) => page.evaluate(() => { document.querySelector<HTMLElement>('.infocard .close')?.click(); document.querySelector('.tapmenu')?.remove(); });
/** Tap the building of a site and return the card it opens. */
async function tapBuilding(page: Page, touch: boolean, key: string) {
  await closeCards(page);
  await frameRoom(page, key);
  const b = await buildingOf(page, key);
  await tapAt(page, touch, await screenOf(page, b.at[0], b.at[2], b.at[1]));
  return page.locator('.infocard');
}

for (const dev of DEVICES) test.describe(dev.name, () => {
  test.use(dev.use);

  for (const nested of [false, true]) test(`Vallaki: a tap on the building of every enterable site offers Enter; Enter opens it; Back frames the town on it${nested ? ' (continuous world)' : ''}`, async ({ page }) => {
    test.setTimeout(LONG);
    await open(page, 'ch05/N', nested);
    const sites = await page.evaluate(() => (window as any).__mistlab.app.level.rooms.filter((r: any) => r.enter).map((r: any) => ({ key: r.key, name: r.name })));
    expect(sites.map((s: { key: string }) => s.key).sort()).toEqual([...VALLAKI_SITES].sort());
    for (const s of sites) {
      const card = await tapBuilding(page, dev.touch, s.key);
      await expect(card, `${s.key}: the building's card`).toBeVisible();
      await expect(card.locator('[data-a="enter"]'), `${s.key}: Enter on the card`).toHaveText(`Enter ${s.name}`);
    }
    // Enter the Blue Water Inn from its card: the inn's map opens, and the room it was entered from is remembered.
    await tapBuilding(page, dev.touch, 'N2');
    await press(page, dev.touch, '.infocard [data-a="enter"]');
    await opened(page, 'ch05/N2');
    expect(await page.evaluate(() => (window as any).__mistlab.app.enteredFrom)).toMatchObject({ parent: 'ch05/N', key: 'N2', child: 'ch05/N2' });
    if (nested) {
      // it stays the active map: the town does not take the role back once the camera has landed
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => [(window as any).__mistlab.app.cur.path, (window as any).__mistlab.app.cur.root.parent?.name])).toEqual(['ch05/N2', 'scene:ch05/N']);
    }
    // Back keeps your place: the town opens framed on the inn's site, at about the inn map's span, same heading.
    await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.moveTo(w.controls.target.clone(), undefined, false, Math.PI / 2); });
    const before = await cam(page);
    await expect(page.locator('[data-act="back"]')).toBeVisible();
    await press(page, dev.touch, '[data-act="back"]');
    await opened(page, 'ch05/N');
    const after = await cam(page);
    expect(after.level).toBe('town');
    expect(await targetIn(page, 'N2'), 'camera target inside N2 on the town map').toBe(true);
    expect(after.dist, 'framed on the site, not the whole town').toBeLessThan(1500);
    expect(Math.abs(Math.atan2(Math.sin(after.az - before.az), Math.cos(after.az - before.az))), 'same heading').toBeLessThan(0.02);
    // The town is a top-level map: no Back there.
    await expect(page.locator('[data-act="back"]')).toBeHidden();
  });

  test('N2: zoom presses during a glide add up; at the far limit a zoom out offers the town, and the chip goes back framed on N2', async ({ page }) => {
    test.setTimeout(LONG);
    await open(page, 'ch05/N2');
    // Two quick presses on Zoom in, the second while the first is still gliding, delivered to whatever is drawn at the
    // button's centre (the compass frame must not take them): 0.78 x 0.78 of the start distance.
    const r = await page.evaluate(async () => {
      const w = (window as any).__mistlab.app.world, d = () => w.camera.position.distanceTo(w.controls.target);
      const b = document.querySelector<HTMLElement>('[data-cam="zoomIn"]')!.getBoundingClientRect();
      const press = () => (document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) as HTMLElement).click();
      const d0 = d(); press();
      await new Promise((res) => setTimeout(res, 60));
      const mid = !!w.tween; press();
      return { d0, mid };
    });
    expect(r.mid, 'the second press fell inside the first glide').toBe(true);
    await settle(page);
    expect(Math.abs((await cam(page)).dist / r.d0 / (0.78 * 0.78) - 1), 'two presses: 0.78^2 of the start distance').toBeLessThan(0.05);
    if (!dev.touch) {
      // A wheel turn during a glide is added to where the glide is going, not undone by it.
      const w0 = await page.evaluate(() => {
        const w = (window as any).__mistlab.app.world, c = w.renderer.domElement, rc = c.getBoundingClientRect(), d0 = w.camera.position.distanceTo(w.controls.target);
        w.zoomBy(1.28);
        c.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2, bubbles: true, cancelable: true }));
        return d0;
      });
      await settle(page);
      expect(Math.abs((await cam(page)).dist / w0 / (1.28 / Math.pow(0.95, 3)) - 1)).toBeLessThan(0.05);
      // Away from a glide the wheel zooms toward the cursor: the target moves toward the ground under it.
      const box = (await page.locator('canvas.gl').boundingBox())!, at: Pt = [box.x + box.width * 0.75, box.y + box.height * 0.6];
      const ground = (): Promise<{ t: number[]; p: number[] }> => page.evaluate(([x, y]) => {
        const a = (window as any).__mistlab.app, w = a.world, t = w.controls.target, rc = w.renderer.domElement.getBoundingClientRect();
        const ndc = { x: ((x - rc.left) / rc.width) * 2 - 1, y: -((y - rc.top) / rc.height) * 2 + 1 };
        const ray = new (a.raycaster.constructor)(); ray.setFromCamera(ndc, w.camera);
        const o = ray.ray.origin, dir = ray.ray.direction, k = (t.y - o.y) / dir.y;
        return { t: [t.x, t.z], p: [o.x + dir.x * k, o.z + dir.z * k] };
      }, at);
      const g0 = await ground();
      await page.mouse.move(at[0], at[1]); await page.mouse.wheel(0, -300);
      await page.waitForTimeout(300);
      const t1 = (await cam(page)).target;
      expect(Math.hypot(t1[0] - g0.p[0], t1[2] - g0.p[1])).toBeLessThan(Math.hypot(g0.t[0] - g0.p[0], g0.t[1] - g0.p[1]) - 1);
    }
    // At the far limit, one more zoom out shows a chip naming the town. It fades by itself and never goes anywhere.
    await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.moveTo(w.controls.target.clone(), w.controls.maxDistance, false); });
    const chip = page.locator('.zoomchip');
    await press(page, dev.touch, '[data-cam="zoomOut"]');
    await expect(chip).toBeVisible({ timeout: 30_000 });
    await expect(chip).toHaveText('Zoom out to the Town of Vallaki');
    await expect(chip).toBeHidden({ timeout: 30_000 });
    expect((await cam(page)).path, 'the chip never goes by itself').toBe('ch05/N2');
    // The wheel (desktop) or a pinch (phone) at the far limit offers it too. Watched as it happens: a slow machine can
    // take longer than the chip's few seconds to finish the gesture.
    await page.evaluate(() => { const c = document.querySelector<HTMLElement>('.zoomchip')!; (window as any).__chipShown = false; new MutationObserver(() => { if (!c.hidden) (window as any).__chipShown = true; }).observe(c, { attributes: true }); });
    const box = (await page.locator('canvas.gl').boundingBox())!, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (dev.touch) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 90, y: cy, id: 1 }, { x: cx + 90, y: cy, id: 2 }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 90 + i * 9, y: cy, id: 1 }, { x: cx + 90 - i * 9, y: cy, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(cx, cy); await page.mouse.wheel(0, 300);
    }
    await page.waitForFunction(() => (window as any).__chipShown, null, { timeout: 30_000 });
    expect((await cam(page)).path).toBe('ch05/N2');
    // One tap on the chip: the town opens framed on the inn's site.
    // tapped in the page the moment it shows: a loaded machine can take longer than the chip's five seconds to deliver a tap
    const tapped = page.evaluate(() => new Promise<void>((res) => { const c = document.querySelector<HTMLElement>('.zoomchip')!; const go = () => { if (!c.hidden && c.classList.contains('on')) { c.click(); res(); } else requestAnimationFrame(go); }; go(); }));
    await press(page, dev.touch, '[data-cam="zoomOut"]');
    await tapped;
    await opened(page, 'ch05/N');
    expect((await cam(page)).level).toBe('town');
    expect(await targetIn(page, 'N2'), 'camera target inside N2 on the town map').toBe(true);
  });

  for (const nested of [false, true]) test(`Players mode never shows Enter or the zoom-out chip (the village: Death House and the church)${nested ? ' (continuous world)' : ''}`, async ({ page }) => {
    test.setTimeout(LONG);
    await open(page, 'ch03/E', nested);
    // The DM enters the village's Death House and church by a tap on them.
    for (const [key, name] of [['E7', 'Death House'], ['E5', 'Church']]) {
      const card = await tapBuilding(page, dev.touch, key);
      await expect(card.locator('[data-a="enter"]'), key).toHaveText(`Enter ${name}`);
    }
    await closeCards(page);
    await page.evaluate(() => (window as any).__mistlab.app.toggleRoom('E7')); // the players have found Death House
    await press(page, dev.touch, '[data-view="players"]');
    expect(await page.evaluate(() => (window as any).__mistlab.app.restricted)).toBe(true);
    // the building's card and the room's card on the players' side: no Enter
    const card = await tapBuilding(page, dev.touch, 'E7');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('Enter');
    await closeCards(page);
    await frameRoom(page, 'E7');
    const room = await page.evaluate(() => { const r = (window as any).__mistlab.app.level.rooms.find((x: any) => x.key === 'E7'); const b = r.polygon.reduce((a: number[], p: number[]) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]); return [b[0] + 2, b[1] + (b[3] - b[1]) / 2]; });
    await tapAt(page, dev.touch, await screenOf(page, room[0], room[1], 0));
    await expect(page.locator('.infocard')).toBeVisible(); // the players' card for the house or its yard
    await expect(page.locator('.infocard')).not.toContainText('Enter');
    if (!dev.touch) {
      const b = await buildingOf(page, 'E7'), [x, y] = await screenOf(page, b.at[0], b.at[2], b.at[1]);
      await closeCards(page);
      await page.mouse.move(x - 30, y); await page.mouse.move(x, y, { steps: 3 }); await page.waitForTimeout(300);
      expect(await page.locator('.tip em').count(), 'no Enter in the players\' hover tip').toBe(0);
    }
    // a zoom out at the far limit offers nothing on the players' side
    await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.moveTo(w.controls.target.clone(), w.controls.maxDistance, false); });
    await press(page, dev.touch, '[data-cam="zoomOut"]');
    await page.waitForTimeout(800);
    await expect(page.locator('.zoomchip')).toBeHidden();
    await expect(page.locator('[data-a="enter"]')).toHaveCount(0);
  });
});

test.describe('phone', () => {
  test.use(DEVICES[1].use);
  test('the compass and scale frame never takes a press meant for the camera buttons', async ({ page }) => {
    test.setTimeout(LONG);
    await open(page, 'appB/death-house');
    // At the default framing and pulled back (where the scale bar is widest), each button is what lies at its centre.
    for (const k of [1, 3, 6]) {
      await page.evaluate((k) => { const w = (window as any).__mistlab.app.world; w.moveTo(w.controls.target.clone(), w.controls.maxDistance / k, false); }, k);
      const hits = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.camcluster button')].map((b) => {
        const r = b.getBoundingClientRect();
        return { cam: b.dataset.cam, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b };
      }));
      for (const h of hits) expect(h, `${h.cam} at 1/${k} of the far limit`).toEqual({ cam: h.cam, top: true });
    }
    // a real tap on Zoom out reaches the button
    await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.moveTo(w.controls.target.clone(), 60, false); });
    await press(page, true, '[data-cam="zoomOut"]');
    await settle(page);
    expect((await cam(page)).dist).toBeCloseTo(60 * 1.28, 0);
  });
});

test('Krezk abbey: the surroundings stand round the room the DM entered from', async ({ page }) => {
  test.setTimeout(LONG);
  await page.setViewportSize({ width: 1366, height: 768 });
  const anchor = async () => { await page.waitForFunction(() => !!(window as any).__mistlab.app.context, null, { timeout: LONG }); return page.evaluate(() => (window as any).__mistlab.app.context.userData.anchor); };
  // Opened by itself, the abbey stands on the ledge: the parent level at the height of its ground floor (400 ft).
  await open(page, 'ch08/S10');
  expect(await anchor()).toEqual({ level: 'ledge', key: 'S6' });
  // Back: Krezk on the ledge, framed on that room.
  await press(page, false, '[data-act="back"]');
  await opened(page, 'ch08/S');
  expect((await cam(page)).level).toBe('ledge');
  expect(await targetIn(page, 'S6')).toBe(true);
  // Enter from the graveyard: the surroundings stand round the graveyard.
  for (const [level, key] of [['ledge', 'S7'], ['village', 'S5']]) {
    await frameRoom(page, key);
    const at = await page.evaluate((key) => { const r = (window as any).__mistlab.app.level.rooms.find((x: any) => x.key === key); return [r.polygon.reduce((s: number, p: number[]) => s + p[0], 0) / r.polygon.length, r.polygon.reduce((s: number, p: number[]) => s + p[1], 0) / r.polygon.length]; }, key);
    await closeCards(page);
    await tapAt(page, false, await screenOf(page, at[0], at[1], 0));
    const enter = page.locator('.infocard [data-a="enter"], .tapmenu button', { hasText: 'Enter' });
    await expect(enter).toHaveCount(1);
    const eb = (await enter.boundingBox())!;
    await tapAt(page, false, [eb.x + eb.width / 2, eb.y + eb.height / 2]);
    await opened(page, 'ch08/S10');
    expect(await page.evaluate(() => (window as any).__mistlab.app.enteredFrom)).toEqual({ parent: 'ch08/S', level, key, child: 'ch08/S10' });
    expect(await anchor(), `entered from ${key}`).toEqual({ level, key });
    if (key === 'S7') { await press(page, false, '[data-act="back"]'); await opened(page, 'ch08/S'); expect((await cam(page)).level).toBe('ledge'); expect(await targetIn(page, 'S7')).toBe(true); }
  }
});
