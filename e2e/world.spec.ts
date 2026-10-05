// The nested world, step 0: the frame data is in place. Death House and the church are blowouts of the Village of
// Barovia now (scene.parent + the village rooms that enter them), so they open with the village drawn round them and
// Back leads to the village, exactly as the Vallaki buildings do.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boot, diff, snap, SCENES } from './helpers';

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
    return { name: a.context.name, meshes, picked, inScene: a.context.parent === a.cur.root && a.cur.root.parent === a.world.root };
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

// ------------------------------------------------------------------ step 1: the placement seam (pixel-neutral)
// The test room is stood 50,000 ft east of the origin and turned a quarter (as Death House is turned in the village),
// with the floating origin on it or not. Everything the table does reads scene feet through the placement, and the
// fog and grid shaders read them through the coverage basis, so the room must look and behave as it does unplaced.

/** In-page: which pixels differ between two snaps (a 0/1 mask kept in window.__snaps). */
const changedMask = (page: import('@playwright/test').Page, a: string, b: string, out: string) => page.evaluate(({ a, b, out }) => {
  const s = (window as any).__snaps, A: ImageData = s[a], B: ImageData = s[b], m = new Uint8Array(A.width * A.height);
  let n = 0;
  for (let i = 0; i < m.length; i++) { const k = i * 4; if (Math.max(Math.abs(A.data[k] - B.data[k]), Math.abs(A.data[k + 1] - B.data[k + 1]), Math.abs(A.data[k + 2] - B.data[k + 2])) > 6) { m[i] = 1; n++; } }
  s[out] = { m, w: A.width }; return n;
}, { a, b, out });
/** In-page: pixels set in one mask and not within 1 px of a set pixel in the other (both ways). */
const maskXor = (page: import('@playwright/test').Page, a: string, b: string) => page.evaluate(({ a, b }) => {
  const s = (window as any).__snaps, A = s[a], B = s[b], w = A.w, h = A.m.length / w;
  const near = (M: Uint8Array, x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && M[yy * w + xx]) return true; } return false; };
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (A.m[i] && !near(B.m, x, y)) n++; if (B.m[i] && !near(A.m, x, y)) n++; }
  return n;
}, { a, b });

for (const reanchor of [true, false])
  test(`a placed scene renders like an unplaced one (50,000 ft out, turned −π/2, ${reanchor ? 'origin on the scene' : 'origin at the valley centre'})`, async ({ page }) => {
    test.setTimeout(300_000); // two dozen full-canvas snaps and diffs on swiftshader
    await boot(page, '', SCENES[0]);
    const room = SCENES[0];
    // the seam is the identity until something places the scene
    expect(await page.evaluate(() => { const m = (window as any).__mistlab; return { p: m.placement, a: m.anchor, w: m.toWorld(22.5, 17.5) }; }))
      .toEqual({ p: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], a: [0, 0, 0], w: [22.5, 17.5] });
    const looks = async (tag: string) => {
      await page.evaluate(() => { const m = (window as any).__mistlab; m.setLowWalls(true); m.setT(1); m.setGrid('square'); m.frame('top'); });
      await snap(page, `${tag}-on`);
      await page.evaluate(() => (window as any).__mistlab.setGrid('off'));
      await snap(page, `${tag}-off`);
      await page.evaluate(() => (window as any).__mistlab.setT(0));
      await snap(page, `${tag}-t0`);
      await page.evaluate(() => { const m = (window as any).__mistlab; m.setT(1); m.setGrid('square'); });
      return page.evaluate(() => { const a = (window as any).__mistlab.app; return { north: a.cameraFrame().north, px: a.cameraFrame().pxPerFt, ground: a.cameraGround() }; });
    };
    const before = await looks('flat');

    await page.evaluate((re) => (window as any).__mistlab.setPlacement([50000, 0, 0], -Math.PI / 2, re), reanchor);
    const seam = await page.evaluate(() => {
      const m = (window as any).__mistlab, a = m.app, r = a.cur.root, v = r.getWorldPosition(new (a.world.camera.position.constructor)());
      return { anchor: m.anchor, drawn: v.toArray(), abs: r.position.toArray(), rotY: r.rotation.y, world: m.toWorld(22.5, 17.5), back: m.toLocal(...m.toWorld(22.5, 17.5)) };
    });
    expect(seam.anchor).toEqual(reanchor ? [50000, 0, 0] : [0, 0, 0]);
    expect(seam.abs).toEqual([50000, 0, 0]);
    expect(seam.rotY).toBeCloseTo(-Math.PI / 2, 9);
    // drawn at the origin when anchored on it, at 50,000 ft when not
    expect(seam.drawn[0]).toBeCloseTo(reanchor ? 0 : 50000, 6);
    // a step east in the room is a step north in the world (x → −z)
    expect(seam.world[0]).toBeCloseTo((reanchor ? 0 : 50000) - 17.5, 6);
    expect(seam.world[1]).toBeCloseTo(22.5, 6);
    expect(seam.back[0]).toBeCloseTo(22.5, 6); expect(seam.back[1]).toBeCloseTo(17.5, 6);

    const after = await looks('placed');
    // the camera keeps its view of the room: north on screen, the scale, and the ground it sees (in room feet) agree
    expect(Math.abs(Math.atan2(Math.sin(after.north - before.north), Math.cos(after.north - before.north)))).toBeLessThan(1e-6);
    expect(after.px).toBeCloseTo(before.px, 4);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) expect(after.ground[i][k]).toBeCloseTo(before.ground[i][k], 1);

    // the grid lies on the same lines of the room (the basis turns the pattern with the room)
    const gFlat = await changedMask(page, 'flat-on', 'flat-off', 'gflat'), gPlaced = await changedMask(page, 'placed-on', 'placed-off', 'gplaced');
    expect(gFlat).toBeGreaterThan(1500);
    expect(Math.abs(gPlaced - gFlat) / gFlat).toBeLessThan(0.05);
    expect(await maskXor(page, 'gflat', 'gplaced'), 'grid pixels off the unplaced lines').toBeLessThan(gFlat * 0.03);
    // the players' fog covers the same part of the room (the coverage map is read in room feet)
    const fFlat = await changedMask(page, 'flat-on', 'flat-t0', 'fflat'), fPlaced = await changedMask(page, 'placed-on', 'placed-t0', 'fplaced');
    expect(fFlat).toBeGreaterThan(1500);
    expect(Math.abs(fPlaced - fFlat) / fFlat).toBeLessThan(0.05);
    expect(await maskXor(page, 'fflat', 'fplaced'), 'fog pixels off the unplaced fog').toBeLessThan(fFlat * 0.03);

    // the party token is where screenOf says, from the scene graph itself
    const tok = await page.evaluate(() => {
      const m = (window as any).__mistlab, a = m.app, g = a.cur.tokens.get(a.party.id), c = a.world.camera, r = a.world.renderer.domElement.getBoundingClientRect();
      const v = g.localToWorld(new (c.position.constructor)(0, 1, 0)).project(c);
      return { graph: [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height], screenOf: m.screenOf(22.5, 17.5, 1) };
    });
    expect(Math.hypot(tok.graph[0] - tok.screenOf[0], tok.graph[1] - tok.screenOf[1])).toBeLessThan(0.5);

    // t = 0: the secret door is pixel-identical to plain wall in every view, and not once the slider rises
    for (const view of ['tabletop', 'top'] as const)
      for (const low of [true, false]) {
        await page.evaluate(({ low, view }) => { const m = (window as any).__mistlab; m.setLowWalls(low); m.frame(view); m.setT(0); }, { low, view });
        await snap(page, 'secret');
        await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
        await snap(page, 'wall');
        await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(false));
        expect((await diff(page, 'secret', 'wall')).changed, `${view} ${low}`).toBe(0);
      }
    await page.evaluate(() => (window as any).__mistlab.setT(1));
    await snap(page, 'secret1');
    await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
    await snap(page, 'wall1');
    expect((await diff(page, 'secret1', 'wall1')).changed).toBeGreaterThan(50);
    expect(room.scene).toBe('dev/m0-test-room');
  });

test('a placed scene plays like an unplaced one: tap to select, walls block, the door lets the party through, the ruler reads feet', async ({ page }) => {
  const tapAt = async (x: number, z: number, y = 0) => {
    const [sx, sy] = await page.evaluate(({ x, z, y }) => (window as any).__mistlab.screenOf(x, z, y), { x, z, y });
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400); // clear the double-tap window
  };
  test.setTimeout(180_000);
  await boot(page, '', SCENES[0]);
  await page.evaluate(() => (window as any).__mistlab.setPlacement([50000, 0, 0], -Math.PI / 2, true));
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.setView('players'); m.frame('top'); });
  await tapAt(22.5, 17.5, 1);
  expect(await page.evaluate(() => (window as any).__mistlab.app.selected)).toBeTruthy();
  await tapAt(52.5, 17.5);
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([22.5, 17.5]);
  await expect(page.locator('.status')).toContainText('No way through');
  await page.evaluate(() => (window as any).__mistlab.app.toggleDoor('d-t1-t2'));
  await tapAt(52.5, 17.5);
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([52.5, 17.5]);
  // the measure tool: two taps, read in room feet; its line hangs in the room's frame
  await page.evaluate(() => { const a = (window as any).__mistlab.app; a.setView('dm'); a.tool = 'measure'; });
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  await tapAt(22.5, 17.5);
  await tapAt(42.5, 17.5);
  await expect(page.locator('.status')).toContainText('20 ft');
  expect(await page.evaluate(() => { const a = (window as any).__mistlab.app; let inRoot = false; a.cur.root.traverse((o: any) => { if (o.isLine && o.userData.role === 'marker') inRoot = true; }); return inRoot; })).toBe(true);
  // the camera reaches the Player Display in absolute world feet
  const cam = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { abs: w.toAbsolute(w.controls.target).toArray(), drawn: w.controls.target.toArray() }; });
  expect(cam.abs[0] - cam.drawn[0]).toBe(50000);
});

test('the floating origin moves nothing on screen; the continuous-world camera is off by default', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, '', SCENES[0]);
  const st = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { nested: w.nested, far: w.camera.far, max: w.controls.maxDistance, ztc: w.controls.zoomToCursor, root: w.root.parent === w.scene }; });
  expect(st).toEqual({ nested: false, far: 120000, max: 400, ztc: false, root: true });
  await page.evaluate(() => (window as any).__mistlab.frame('tabletop'));
  await snap(page, 'a');
  // shift the origin far away and back: camera, target and the world root move together
  const moved = await page.evaluate(() => {
    const w = (window as any).__mistlab.app.world, V = w.camera.position.constructor;
    const s0 = (window as any).__mistlab.screenOf(22.5, 17.5, 1);
    w.reanchor(new V(-31000, 140, 22000));
    const s1 = (window as any).__mistlab.screenOf(22.5, 17.5, 1), tgt = w.toAbsolute(w.controls.target).toArray();
    w.reanchor(new V(0, 0, 0));
    return { s0, s1, tgt, anchor: w.anchor.toArray() };
  });
  expect(Math.hypot(moved.s1[0] - moved.s0[0], moved.s1[1] - moved.s0[1])).toBeLessThan(0.01);
  expect(moved.anchor).toEqual([0, 0, 0]);
  await snap(page, 'b');
  expect((await diff(page, 'a', 'b')).changed).toBe(0);
  // the continuous-world camera: the whole valley in range, and back
  const nested = await page.evaluate(() => {
    const w = (window as any).__mistlab.app.world; w.setNested(true);
    const on = { far: w.camera.far, max: w.controls.maxDistance, ztc: w.controls.zoomToCursor };
    w.flyTo(w.controls.target.clone(), 60000, 1);
    return on;
  });
  expect(nested).toEqual({ far: 300000, max: 120000, ztc: true });
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  const far = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { d: w.camera.position.distanceTo(w.controls.target), polar: w.controls.maxPolarAngle, fog: w.fogDensity / (w.outdoor ? w.theme.fogOut : w.theme.fogIn) }; });
  expect(far.d).toBeGreaterThan(59000);
  expect(far.polar).toBeCloseTo(Math.PI * 0.3, 3);
  expect(far.fog).toBeLessThan(0.01);
  const off = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.setNested(false); return { far: w.camera.far, max: w.controls.maxDistance, ztc: w.controls.zoomToCursor }; });
  expect(off).toEqual({ far: 120000, max: 400, ztc: false });
});
