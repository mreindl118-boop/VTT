// The nested world, step 0: the frame data is in place. Death House and the church are blowouts of the Village of
// Barovia now (scene.parent + the village rooms that enter them), so they open with the village drawn round them and
// Back leads to the village, exactly as the Vallaki buildings do.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boot, SCENES } from './helpers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

test('Death House stands in the village: the village is drawn round it and Back leads there', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  expect(await page.evaluate(() => (window as any).__mistlab.app.cur.scene.parent)).toBe('ch03/E');
  // the surroundings are built after the house itself; they come from the village's own kit, muted, never picked
  await page.waitForFunction(() => !!(window as any).__mistlab.app.context, undefined, { timeout: 20_000 });
  const ctx = await page.evaluate(() => {
    const a = (window as any).__mistlab.app; let meshes = 0, picked = 0;
    // every visible mesh is scenery (the context's own grid stays hidden)
    a.context.traverse((o: any) => { if (o.isMesh && o.visible) { meshes++; if (o.userData.role !== 'context') picked++; } });
    return { name: a.context.name, meshes, picked, inScene: a.context.parent === a.world.scene };
  });
  expect(ctx).toMatchObject({ name: 'context', picked: 0, inScene: true });
  expect(ctx.meshes).toBeGreaterThan(0);
  // the party still moves in the house's own coordinates
  await page.evaluate(() => (window as any).__mistlab.moveParty('f2', 17.5, 27.5));
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([17.5, 27.5]);
  const back = page.locator('[data-act="back"]');
  await expect(back).toBeVisible();
  await back.click();
  await page.waitForFunction(() => (window as any).__mistlab.app.cur?.path === 'ch03/E', undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__mistlab.app.context)).toBeUndefined(); // a root map has no surroundings of its own
});

test('the village rooms open the church and Death House, which hang from the village', async ({ page }) => {
  await boot(page, '', { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] });
  const enters = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, rooms = a.cur.scene.levels[0].rooms as { key: string; enter?: string }[];
    return Object.fromEntries(rooms.filter((r) => r.enter).map((r) => [r.key, r.enter]));
  });
  expect(enters).toEqual({ E5: 'ch03/E5', E7: 'appB/death-house' });
  await page.evaluate(() => (window as any).__mistlab.app.open('ch03/E5'));
  await page.waitForFunction(() => (window as any).__mistlab.app.cur?.path === 'ch03/E5', undefined, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as any).__mistlab.app.context, undefined, { timeout: 20_000 });
  const r = await page.evaluate(() => { const a = (window as any).__mistlab.app; return { parent: a.cur.scene.parent, world: a.state.world?.key, backdrop: !!a.backdrop }; });
  // the church's map is in darkness (ambient), so it has no backdrop of its own (the atlas: outdoor false); the village stands round it
  expect(r).toEqual({ parent: 'ch03/E', world: 'E', backdrop: false });
});

test('the atlas places Death House where the app draws the village round it', async ({ page }) => {
  // The atlas (scripts/world-atlas.ts, from app/src/core/frames.ts) says where the house stands in the village; the app's
  // buildContext moves the village into the house's frame on its own. Every village house drawn round Death House must
  // stand where the atlas's placement puts it: the frame maths and the running app agree.
  const atlas = JSON.parse(readFileSync(new URL('../manifests/world-atlas.json', import.meta.url), 'utf8'));
  const village = JSON.parse(readFileSync(new URL('../locations/ch03/E/scene.json', import.meta.url), 'utf8'));
  const dh = atlas.scenes['appB/death-house'];
  expect(dh).toMatchObject({ parent: 'ch03/E', depth: 1, root: 'ch03/E', enterRoom: { key: 'E7' } });
  expect(dh.placement.rotationY).toBeCloseTo(-Math.PI / 2, 6);
  await boot(page, '', SCENES[1]);
  await page.waitForFunction(() => !!(window as any).__mistlab.app.context, undefined, { timeout: 20_000 });
  // The plan centre of each object drawn in a group, from the merged meshes' face ranges (in world = scene coordinates).
  // A house's model is not symmetric about its pos, so the village's own rendering is the reference, not the pos.
  const centres = (which: 'context' | 'village'): Promise<Record<string, [number, number]>> => page.evaluate((which) => {
    const a = (window as any).__mistlab.app, out: Record<string, number[]> = {};
    const root = which === 'context' ? a.context : a.cur.levels.get('village').root;
    root.updateMatrixWorld(true);
    const v = a.world.camera.position.clone();
    root.traverse((m: any) => {
      const rs = m.userData.ranges as { start: number; end: number; id: string }[] | undefined;
      if (!m.isMesh || !rs) return;
      const pos = m.geometry.attributes.position, idx = m.geometry.index;
      for (const r of rs) {
        const o = (out[r.id] ??= [Infinity, -Infinity, Infinity, -Infinity]);
        for (let f = r.start; f < r.end; f++) for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, idx ? idx.getX(f * 3 + k) : f * 3 + k).applyMatrix4(m.matrixWorld);
          o[0] = Math.min(o[0], v.x); o[1] = Math.max(o[1], v.x); o[2] = Math.min(o[2], v.z); o[3] = Math.max(o[3], v.z);
        }
      }
    });
    return Object.fromEntries(Object.entries(out).map(([id, o]) => [id, [(o[0] + o[1]) / 2, (o[2] + o[3]) / 2]]));
  }, which);
  const drawn = await centres('context');
  // the same houses as the village draws them in its own frame
  await page.evaluate(() => (window as any).__mistlab.app.open('ch03/E'));
  await page.waitForFunction(() => (window as any).__mistlab.app.cur?.path === 'ch03/E', undefined, { timeout: 30_000 });
  const own = await centres('village');
  const { position: [px, , pz], rotationY: th } = dh.placement;
  const toLocal = (x: number, z: number) => { const dx = x - px, dz = z - pz, c = Math.cos(-th), s = Math.sin(-th); return [dx * c + dz * s, -dx * s + dz * c]; };
  const houses = (village.levels[0].objects as { id: string; kind: string }[]).filter((o) => o.kind === 'house' && drawn[`ctx-${o.id}`] && own[o.id]);
  expect(houses.length).toBeGreaterThanOrEqual(10);
  for (const o of houses) {
    const [ex, ez] = toLocal(...own[o.id]), [gx, gz] = drawn[`ctx-${o.id}`];
    expect(Math.hypot(gx - ex, gz - ez), `${o.id}: drawn at ${gx},${gz}, atlas says ${ex},${ez}`).toBeLessThan(0.01);
  }
});

test('the village round Death House hides while a floor under the ground is shown (it would bury the dungeon)', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  await page.waitForFunction(() => !!(window as any).__mistlab.app.context, undefined, { timeout: 20_000 });
  const vis = (level: string) => page.evaluate((level) => { const m = (window as any).__mistlab; m.moveParty(level, ...(level.startsWith('dungeon') ? [27.5, 12.5] : [12.5, 27.5])); return m.app.context.visible; }, level);
  expect(await vis('f2')).toBe(true);
  expect(await vis('dungeon-lower')).toBe(false);
  expect(await vis('f1')).toBe(true);
  // the floor-mask render (the pixel suites' mask) leaves the surroundings out, like the backdrop, and brings them back
  expect(await page.evaluate(() => { const m = (window as any).__mistlab; m.setRenderMode('floorMask'); const a = m.app.context.visible; m.setRenderMode('normal'); return [a, m.app.context.visible]; })).toEqual([false, true]);
});
