// The nested world, step 0: the frame data is in place. Death House and the church are blowouts of the Village of
// Barovia now (scene.parent + the village rooms that enter them), so they open with the village drawn round them and
// Back leads to the village, exactly as the Vallaki buildings do. The first four tests are the legacy way's
// surroundings (?nested=0: buildContext); in the continuous world the village itself stands round them (nest.spec.ts).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boot, diff, snap, SCENES } from './helpers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

test('Death House stands in the village: the village is drawn round it and Back leads there', async ({ page }) => {
  await boot(page, '&nested=0', SCENES[1]);
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
  await boot(page, '&nested=0', { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] });
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
  await boot(page, '&nested=0', SCENES[1]);
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
  await boot(page, '&nested=0', SCENES[1]);
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

test('the floating origin moves nothing on screen; the continuous-world camera is off by default, zoom-to-cursor always on', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, '', SCENES[0]);
  const st = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { nested: w.nested, far: w.camera.far, max: w.controls.maxDistance, ztc: w.controls.zoomToCursor, root: w.root.parent === w.scene }; });
  // zoom-to-cursor is every map's (the zoom fix), not the continuous world's: it stays on through setNested on and off
  expect(st).toEqual({ nested: false, far: 120000, max: 400, ztc: true, root: true });
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
  // the pitch floor rises to 0.3π by 20,000 ft and on toward straight down (0.015π) from 25,000 to 80,000 ft, where the
  // land becomes the inked map (render/world.ts applyPolar)
  const top = ((t) => t * t * (3 - 2 * t))(Math.min(1, Math.max(0, (far.d - 25000) / 55000)));
  expect(far.polar).toBeCloseTo(Math.PI * (0.3 + (0.015 - 0.3) * top), 3);
  expect(far.fog).toBeLessThan(0.01);
  const off = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.setNested(false); return { far: w.camera.far, max: w.controls.maxDistance, ztc: w.controls.zoomToCursor }; });
  expect(off).toEqual({ far: 120000, max: 400, ztc: true });
});

// ------------------------------------------------------------------ step 2: the valley, maps opening in place
// A pin's map now opens inside the whole valley (render/worldstage.ts): the land with every footprint baked in, the
// other places as proxies at true scale, the forest, the sky. Area maps, buildings and dev/* still open the legacy
// way (alone in the mist with their backdrop); `?nested=0` keeps every map that way.

/** In-page: wait until no glide is in flight. */
const settle = (page: import('@playwright/test').Page) => page.waitForFunction(() => !(window as any).__mistlab.app.world.flying, undefined, { timeout: 30_000 });
const VILLAGE = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };

test('valley: the whole of Barovia from above, every other place as its proxy, within the draw budget', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', VILLAGE);
  expect(await page.evaluate(() => { const m = (window as any).__mistlab; return { staged: m.staged, nested: m.app.world.nested, campaign: m.stage?.campaign.id }; })).toEqual({ staged: true, nested: true, campaign: 'cos' });
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, w = a.world, st = m.stage;
    st.frameWorld(); w.renderNow();
    const info = { calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles };
    const hidden = [...st.proxies].filter(([, g]: any) => !g.visible).map(([id]: any) => id);
    const shown = [...st.proxies].filter(([, g]: any) => g.visible).length;
    // the castle's proxy stands on its pin, a thousand feet up on its crag
    const castle = st.root.getObjectByName('castle-ravenloft').getWorldPosition(w.camera.position.clone());
    const pin = m.atlas.pins.find((p: any) => p.campaign === 'cos' && p.key === 'K'), at = m.frames.worldOfMiles(st.data, pin.pos);
    const ground = m.frames.groundY(st.data, pin.pos);
    // pixels: the middle shows the land
    const c = document.querySelector('canvas.gl') as HTMLCanvasElement, o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    const x = o.getContext('2d')!; x.drawImage(c, 0, 0);
    const mid = x.getImageData(Math.floor(c.width / 2) - 20, Math.floor(c.height / 2) - 20, 40, 40).data;
    let midOpaque = 0; for (let i = 3; i < mid.length; i += 4) if (mid[i] > 250) midOpaque++;
    return { info, hidden, shown, total: st.proxies.size, castle: [castle.x + w.anchor.x, castle.y + w.anchor.y, castle.z + w.anchor.z], expect: [at[0], ground + 1000, at[1]], midOpaque: midOpaque / (mid.length / 4), dist: w.camera.position.distanceTo(w.controls.target), polar: w.controls.getPolarAngle() };
  });
  expect(r.hidden).toEqual(['ch03/E']);
  expect(r.shown).toBe(r.total - 1);
  expect(r.total).toBeGreaterThanOrEqual(25);
  expect(r.info.calls).toBeLessThanOrEqual(70);
  expect(r.info.tris).toBeLessThanOrEqual(300_000);
  expect(r.midOpaque).toBeGreaterThan(0.99);
  // the whole valley is the world map now: seen from straight above with north up (world.ts applyPolar; the region's
  // land runs on past the top of the view as its skirt, where the tilted view used to show the page above the horizon)
  expect(r.polar).toBeLessThan(0.05);
  expect(Math.abs(r.castle[0] - r.expect[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(r.castle[2] - r.expect[2])).toBeLessThanOrEqual(1);
  expect(Math.abs(r.castle[1] - r.expect[1])).toBeLessThanOrEqual(1);
  expect(r.dist).toBeGreaterThan(60_000);
});

test('ground meets every map: the land is flush with each placed map and 3 ft under the survey beyond', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', VILLAGE);
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, st = m.stage, f = st.land.field, w = m.app.world, out: any[] = [];
    const V = w.camera.position.constructor, R = new (m.app.raycaster.constructor)();
    const land = st.land.group.children.filter((o: any) => o.name === 'land' || o.name === 'aprons');
    st.root.updateMatrixWorld(true);
    for (const e of Object.values(m.atlas.scenes) as any[]) {
      if (e.campaign !== 'cos' || e.depth !== 0 || e.orphan || !e.pin) continue;
      const b = e.worldBounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, base = e.placement.position[1] + e.elevationFt;
      // what is drawn there: a ray straight down onto the land and the aprons
      R.set(new V(cx - w.anchor.x, 30000, cz - w.anchor.z), new V(0, -1, 0));
      const hit = R.intersectObjects(land, false)[0];
      // 2,000 ft out on a side where this map is the nearest, no other map's band reaches and no lake's shore
      const i = st.sites.findIndex((s: any) => s.path === e.path);
      let outside: any = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = dx > 0 ? b.maxX + 2000 : dx < 0 ? b.minX - 2000 : cx, z = dz > 0 ? b.maxZ + 2000 : dz < 0 ? b.minZ - 2000 : cz;
        const n = f.nearest(x, z);
        if (n.i !== i || n.other < 2600 || f.lakeNear(x, z).i >= 0) continue;
        outside = { x, z, got: st.groundAt(x, z), want: f.ground(x, z) - 3, survey: m.frames.groundY(st.data, m.frames.milesOfWorld(st.data, [x, z])) };
        break;
      }
      // a map on a lake's shore (Lake Zarovich's) has water or shore on every side: the shore rule applies there instead
      const lakeside = f.lakeNear(cx, cz, 1.6).i >= 0;
      out.push({ path: e.path, base, centre: st.groundAt(cx, cz), drawn: hit ? hit.point.y + w.anchor.y : null, outside, lakeside });
    }
    // the mist thins with height: at 60,000 ft the far mountains haze instead of vanishing; at 60 ft it is today's
    const t = w.controls.target.clone();
    w.flyTo(t, 60000, 1);
    return out;
  });
  expect(r.length).toBeGreaterThanOrEqual(25);
  expect(r.filter((s) => !s.outside).length, 'only lakeside maps lack a clear side').toBeLessThanOrEqual(2);
  for (const s of r) {
    expect(Math.abs(s.centre - (s.base - 0.4)), `${s.path} centre`).toBeLessThanOrEqual(0.5);
    expect(s.drawn, `${s.path} drawn`).not.toBeNull();
    expect(Math.abs(s.drawn - (s.base - 0.4)), `${s.path} drawn`).toBeLessThanOrEqual(0.5);
    if (!s.outside) { expect(s.lakeside, `${s.path}: a side with nothing else near`).toBe(true); continue; }
    expect(Math.abs(s.outside.got - s.outside.want), `${s.path} 2,000 ft out`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.outside.want + 3 - s.outside.survey), `${s.path} survey`).toBeLessThan(1e-6);
  }
  await settle(page);
  const far = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { d: w.camera.position.distanceTo(w.controls.target), fog: w.fogDensity }; });
  expect(far.d).toBeGreaterThan(59_000);
  expect(far.fog).toBeLessThanOrEqual(2e-5);
  await page.evaluate(() => { const w = (window as any).__mistlab.app.world; w.flyTo(w.controls.target.clone(), 60, 1); });
  await settle(page);
  const near = await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return { d: w.camera.position.distanceTo(w.controls.target), fog: w.fogDensity, today: (w.outdoor ? w.theme.fogOut : w.theme.fogIn) * w.fogScale * Math.min(1, Math.max(0.12, 260 / w.camera.position.distanceTo(w.controls.target))) }; });
  expect(near.d).toBeCloseTo(60, 0);
  expect(Math.abs(near.fog / near.today - 1)).toBeLessThan(0.01);
});

test('placed at the pin: the village on its pin with the origin on it, Tsolenka turned to world north, zoom from 12 ft to the whole valley', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '', VILLAGE);
  const v = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, st = m.stage, F = m.frames, e = m.atlas.scenes['ch03/E'];
    const pin = st.data.pins.find((p: any) => p.key === 'E'), [px, pz] = F.worldOfMiles(st.data, pin.pos), th = e.placement.rotationY;
    const [cx, cz] = F.rotate(th, e.centre), drawn = a.cur.root.getWorldPosition(a.world.camera.position.clone());
    return { abs: a.cur.root.position.toArray(), want: [px - cx, F.pinY(st.data, pin) - e.elevationFt, pz - cz], drawn: drawn.toArray(), rotY: a.cur.root.rotation.y, anchor: m.anchor, parent: a.cur.root.parent === a.world.root, mist: a.world.mistFloor.visible, backdrop: !!a.backdrop };
  });
  for (let k = 0; k < 3; k++) { expect(Math.abs(v.abs[k] - v.want[k])).toBeLessThan(1e-6); expect(Math.abs(v.drawn[k])).toBeLessThan(1e-6); }
  expect(v.anchor).toEqual(v.abs);
  expect(v).toMatchObject({ rotY: 0, parent: true, mist: false, backdrop: false });

  // the whole range: pull back to the valley with the zoom button's steps, and down again to a few feet
  const zoom = (k: number, until: string) => page.evaluate(async ({ k, until }) => {
    const w = (window as any).__mistlab.app.world, d = () => w.camera.position.distanceTo(w.controls.target);
    for (let i = 0; i < 80 && !(new Function('d', `return ${until}`))(d()); i++) { w.zoomBy(k); await new Promise<void>((r) => { const f = () => (w.flying ? requestAnimationFrame(f) : r()); f(); }); }
    return d();
  }, { k, until });
  const out = await zoom(1.28, 'd >= 100000');
  expect(out).toBeGreaterThanOrEqual(100_000);
  const seen = await page.evaluate(() => {
    const m = (window as any).__mistlab, w = m.app.world; w.renderNow();
    let inView = 0; for (const g of m.stage.proxies.values()) { const p = g.getWorldPosition(w.camera.position.clone()).project(w.camera); if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1) inView++; }
    return { inView, band: document.body.dataset.band, labels: [...document.querySelectorAll('.lbl.place')].filter((e) => (e as HTMLElement).style.display !== 'none' && getComputedStyle(e).display !== 'none').length };
  });
  expect(seen.inView).toBeGreaterThanOrEqual(15);
  expect(seen.band).toBe('valley');
  expect(seen.labels).toBeGreaterThan(5);
  const back = await zoom(0.78, 'd <= 12.5');
  expect(back).toBeLessThanOrEqual(12.5);

  // Tsolenka Pass's map points north along −x: it stands turned a quarter so its north is the world's
  const nested = await (async () => { await boot(page, '', { ...VILLAGE, scene: 'ch09/T', level: 'pass', spawn: [235, 380] as [number, number] }); return page.evaluate(() => { const a = (window as any).__mistlab.app; return { staged: (window as any).__mistlab.staged, rotY: a.cur.root.rotation.y, north: a.cameraFrame().north, az: a.world.controls.getAzimuthalAngle() }; }); })();
  const legacy = await (async () => { await boot(page, '&nested=0', { ...VILLAGE, scene: 'ch09/T', level: 'pass', spawn: [235, 380] as [number, number] }); return page.evaluate(() => { const a = (window as any).__mistlab.app; return { staged: (window as any).__mistlab.staged, rotY: a.cur.root.rotation.y, north: a.cameraFrame().north, az: a.world.controls.getAzimuthalAngle() }; }); })();
  expect(nested.staged).toBe(true); expect(legacy.staged).toBe(false);
  expect(nested.rotY).toBeCloseTo(-Math.PI / 2, 9); expect(legacy.rotY).toBe(0);
  expect(nested.az).toBeCloseTo(legacy.az, 9);
  // the compass (cameraFrame().north) is an angle on screen, clockwise positive. Alone in the mist the pass's north
  // (−x) points to the left of the screen (−π/2); turned to world north it points up (0). So the compass turns by
  // +π/2, the opposite sign of the three.js yaw (anticlockwise positive) that carried it there.
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  expect(wrap(legacy.north - legacy.az)).toBeCloseTo(-Math.PI / 2, 6);
  expect(wrap(nested.north - nested.az)).toBeCloseTo(0, 6);
  const dn = Math.atan2(Math.sin(nested.north - legacy.north), Math.cos(nested.north - legacy.north));
  expect(dn).toBeCloseTo(Math.PI / 2, 6);
});

test('pin maps of either campaign open in their own valley, buildings in their towns; dev maps keep the legacy way', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '', SCENES[0]); // the test room: an orphan, never placed
  const st = () => page.evaluate(() => { const m = (window as any).__mistlab, a = m.app; return { path: a.cur.path, staged: m.staged, nested: a.world.nested, stage: a.stage ? { campaign: a.stage.campaign.id, shown: a.stage.root.visible } : null, anchor: m.anchor, root: a.cur.root.position.toArray(), backdrop: !!a.backdrop }; });
  expect(await st()).toEqual({ path: 'dev/m0-test-room', staged: false, nested: false, stage: null, anchor: [0, 0, 0], root: [0, 0, 0], backdrop: false });
  // the Sheep campaign's tavern stands on its own region's heightfield
  await page.evaluate(() => (window as any).__mistlab.app.open('wsc/01-tavern'));
  const tavern = await st();
  const atlas = JSON.parse(readFileSync(new URL('../manifests/world-atlas.json', import.meta.url), 'utf8'));
  expect(tavern).toMatchObject({ path: 'wsc/01-tavern', staged: true, nested: true, stage: { campaign: 'wsc', shown: true }, backdrop: false });
  for (let k = 0; k < 3; k++) expect(Math.abs(tavern.root[k] - atlas.scenes['wsc/01-tavern'].placement.position[k])).toBeLessThan(1e-6);
  expect(tavern.anchor).toEqual(tavern.root);
  // Death House is the village's building (step 4): it hangs in the village's root at its atlas placement, the village
  // round it, in Barovia's valley (the Sheep valley gone with its campaign); the origin on the house
  await page.evaluate(() => (window as any).__mistlab.app.open('appB/death-house'));
  const dh = await page.evaluate(() => { const a = (window as any).__mistlab.app, r = a.cur.root; return { up: r.parent?.name, pos: r.position.toArray(), rot: r.rotation.y, abs: a.world.toAbsolute(r.getWorldPosition(r.position.clone())).toArray(), anchor: a.world.anchor.toArray() }; });
  expect(await st()).toMatchObject({ path: 'appB/death-house', staged: true, nested: true, stage: { campaign: 'cos', shown: true }, backdrop: false });
  expect(dh.up).toBe('scene:ch03/E');
  for (let k = 0; k < 3; k++) { expect(Math.abs(dh.pos[k] - atlas.scenes['appB/death-house'].placement.position[k])).toBeLessThan(1e-6); expect(Math.abs(dh.abs[k] - dh.anchor[k])).toBeLessThan(1e-6); }
  expect(dh.rot).toBeCloseTo(atlas.scenes['appB/death-house'].placement.rotationY, 6);
  expect(await page.evaluate(() => (window as any).__mistlab.app.world.mistFloor.visible)).toBe(false); // the land is the floor
  // zoom-to-cursor is every map's: leaving the valley for a legacy map (setNested(false)) keeps it
  await page.evaluate(() => (window as any).__mistlab.app.open('dev/m0-test-room'));
  expect(await page.evaluate(() => { const w = (window as any).__mistlab.app.world; return [w.nested, w.controls.zoomToCursor]; })).toEqual([false, true]);
  // from a pin map to the next the camera glides (and the old map's proxy comes back); open() resolves on arrival
  await page.evaluate(() => (window as any).__mistlab.app.open('ch03/E'));
  const g = await page.evaluate(async () => {
    const m = (window as any).__mistlab, w = m.app.world, f0 = w.flights;
    await m.app.open('ch02/G');
    return { flew: w.flights - f0, flying: w.flying, e: m.stage.proxies.get('ch03/E').visible, gp: m.stage.proxies.get('ch02/G').visible, ztc: w.controls.zoomToCursor };
  });
  expect(g).toEqual({ flew: 1, flying: false, e: true, gp: false, ztc: true });
  // framed on the camp's rooms, in the camp's own feet
  const d = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, t = a.toLocal3(a.world.controls.target), ps = a.level.rooms.flatMap((r: any) => r.polygon);
    const xs = ps.map((p: number[]) => p[0]), zs = ps.map((p: number[]) => p[1]);
    return [t.x, t.z, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  });
  expect(Math.hypot(d[0] - d[2], d[1] - d[3])).toBeLessThan(1);
});

test('?nested=0 keeps every map the legacy way, and a legacy map draws the same pixels with the valley on or off', async ({ page }) => {
  test.setTimeout(240_000);
  const hash = () => page.evaluate(() => {
    const m = (window as any).__mistlab; m.frame('top'); m.render();
    const c = document.querySelector('canvas.gl') as HTMLCanvasElement, o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    const x = o.getContext('2d')!; x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0;
  });
  await boot(page, '', SCENES[0]);
  const on = await hash();
  await boot(page, '&nested=0', SCENES[0]);
  expect(await hash()).toBe(on);
  // a pin map with the valley switched off: its own backdrop, the mist floor, no stage, the origin at 0
  await boot(page, '&nested=0', VILLAGE);
  const r = await page.evaluate(() => { const m = (window as any).__mistlab, a = m.app; return { nested: m.nested, staged: m.staged, stage: !!a.stage, backdrop: !!a.backdrop, anchor: m.anchor, root: a.cur.root.position.toArray(), far: a.world.camera.far }; });
  expect(r).toEqual({ nested: false, staged: false, stage: false, backdrop: true, anchor: [0, 0, 0], root: [0, 0, 0], far: 120000 });
  // the grid proof on it: the grid draws on the village's ground
  await page.evaluate(() => { const m = (window as any).__mistlab; m.setT(1); m.frame('top'); m.setGrid('square'); });
  await snap(page, 'on');
  await page.evaluate(() => (window as any).__mistlab.setGrid('off'));
  await snap(page, 'off');
  await page.evaluate(() => (window as any).__mistlab.setRenderMode('floorMask'));
  await snap(page, 'mask');
  expect((await diff(page, 'on', 'off', 'mask')).changed).toBeGreaterThan(1500);
});

// ------------------------------------------------------------------ step 2: flying the valley, the switch, both screens

test('flights: the whole valley fits on screen, a place name flies into its map, the zoom-out chip flies back out', async ({ page }) => {
  test.setTimeout(420_000);
  await boot(page, '', VILLAGE);
  // the widest view frames every place of the campaign, inside the far limit
  const fit = await page.evaluate(async () => {
    const m = (window as any).__mistlab, w = m.app.world, st = m.stage;
    st.frameWorld('fly'); await w.settled(); w.renderNow();
    const V = w.camera.position.constructor, off: string[] = [];
    for (const p of m.atlas.pins.filter((q: any) => q.campaign === 'cos')) {
      const v = new V(p.world[0] - w.anchor.x, st.groundAt(p.world[0], p.world[1]) - w.anchor.y, p.world[1] - w.anchor.z).project(w.camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) off.push(p.key);
    }
    return { off, framed: st.framed, d: w.camera.position.distanceTo(w.controls.target), max: w.controls.maxDistance, band: document.body.dataset.band };
  });
  expect(fit.off).toEqual([]);
  expect(fit).toMatchObject({ framed: true, band: 'valley' });
  expect(fit.d).toBeLessThanOrEqual(fit.max + 1);
  // a tap on Krezk's name flies there and opens its map in place, the origin on it (once the village has folded into
  // its proxy after the flight, and the names have settled)
  await page.waitForFunction(() => { const a = (window as any).__mistlab.app; return !a.fades.size && !a.resident.get('ch03/E')?.drawn; }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const f0 = await page.evaluate(() => (window as any).__mistlab.app.world.flights);
  // the names take no pointer (a wheel or a pinch over one still zooms): the canvas's tap finds the name under it
  const sBox = (await page.locator('.lbl.place[data-key="S"]').boundingBox())!;
  expect(await page.locator('.lbl.place[data-key="S"]').evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  await page.mouse.click(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.waitForFunction(() => { const a = (window as any).__mistlab.app; return a.cur?.path === 'ch08/S' && !a.world.flying; }, undefined, { timeout: 180_000 });
  const s = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, w = a.world, e = m.atlas.scenes['ch08/S'];
    const t = a.toLocal3(w.controls.target), b = e.bbox;
    return {
      flights: w.flights, staged: m.staged, band: document.body.dataset.band, abs: a.cur.root.position.toArray(), want: e.placement.position, anchor: m.anchor,
      inside: t.x > b.minX && t.x < b.maxX && t.z > b.minZ && t.z < b.maxZ, d: w.camera.position.distanceTo(w.controls.target),
      s: m.stage.proxies.get('ch08/S').visible, e: m.stage.proxies.get('ch03/E').visible,
    };
  });
  expect(s.flights).toBeGreaterThan(f0);
  expect(s).toMatchObject({ staged: true, inside: true, s: false, e: true });
  for (let k = 0; k < 3; k++) expect(Math.abs(s.abs[k] - s.want[k])).toBeLessThan(0.01);
  for (let k = 0; k < 3; k++) expect(Math.abs(s.anchor[k] - s.abs[k])).toBeLessThan(1e-6); // the origin on it (to float rounding)
  expect(s.d).toBeLessThan(5000);
  // zoom out to the far limit with the button: one more press offers the whole valley, and the chip flies there
  await page.evaluate(async () => { const w = (window as any).__mistlab.app.world; for (let i = 0; i < 60 && !w.atMaxDistance; i++) { w.zoomBy(1.6); await w.settled(); } });
  // (the chip is tapped in the page the moment it shows: a loaded machine can take longer than the chip's five seconds
  // to deliver a click from outside)
  const tapped = page.evaluate(() => new Promise<string>((res) => { const c = document.querySelector<HTMLElement>('.zoomchip')!; const go = () => { if (!c.hidden && c.classList.contains('on')) { const t = c.textContent ?? ''; c.click(); res(t); } else requestAnimationFrame(go); }; go(); }));
  await page.locator('[data-cam="zoomOut"]').click();
  const chip = page.locator('.zoomchip');
  expect(await tapped).toMatch(/whole valley/);
  await page.waitForFunction(() => { const m = (window as any).__mistlab; return !m.app.world.flying && m.stage.framed; }, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).__mistlab.app.cur.path)).toBe('ch08/S'); // the map stays open under the valley
  // at the whole valley, the next zoom out offers the world map sheet (the 2D map stays one press away)
  await page.locator('[data-cam="zoomOut"]').click();
  await expect(chip).toBeVisible({ timeout: 20_000 });
  await expect(chip).not.toHaveText(/whole valley/);
});

test('the View menu switches the continuous world, the device remembers it, and the Player Display follows the DM', async ({ page }) => {
  test.setTimeout(420_000);
  await page.addInitScript(() => { if (!sessionStorage.getItem('booted')) { localStorage.removeItem('mistlab.nested'); sessionStorage.setItem('booted', '1'); } });
  await boot(page, '', VILLAGE);
  const display = await page.context().newPage();
  await display.goto(`/?nosw&display=player&scene=${encodeURIComponent('ch03/E')}`);
  await display.waitForFunction(() => (window as any).__mistlab?.app?.cur?.path === 'ch03/E', undefined, { timeout: 120_000 });
  const st = (p: import('@playwright/test').Page) => p.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, w = a.world;
    return { nested: m.nested, staged: m.staged, stage: !!a.stage, backdrop: !!a.backdrop, path: a.cur?.path, level: a.levelId, anchor: m.anchor, tgt: w.toAbsolute(w.controls.target).toArray(), ztc: w.controls.zoomToCursor };
  });
  // the camera the display shows is the DM's, in absolute feet, each drawn round its own anchor
  const sameCamera = async () => {
    await page.evaluate(() => { const a = (window as any).__mistlab.app; a.layoutChanged(); });
    await display.waitForFunction((t) => { const w = (window as any).__mistlab.app.world, v = w.toAbsolute(w.controls.target); return Math.hypot(v.x - t[0], v.y - t[1], v.z - t[2]) < 0.5; }, (await st(page)).tgt, { timeout: 30_000 });
    // and the zoom band (which names and labels show) follows it there
    expect(await display.evaluate(() => document.body.dataset.band)).toBe(await page.evaluate(() => document.body.dataset.band));
  };
  expect(await st(page)).toMatchObject({ nested: true, staged: true, stage: true, backdrop: false });
  await display.waitForFunction(() => (window as any).__mistlab.staged, undefined, { timeout: 60_000 });
  await sameCamera();
  // off: the village opens alone in the mist with its own backdrop, on the same level; the valley is gone
  await page.locator('details[data-menu="view"] > summary').click();
  const btn = page.locator('[data-act="nested"]');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await page.waitForFunction(() => { const m = (window as any).__mistlab; return !m.nested && !m.staged && !!m.app.backdrop; }, undefined, { timeout: 120_000 });
  expect(await st(page)).toMatchObject({ nested: false, staged: false, stage: false, backdrop: true, path: 'ch03/E', level: 'village', anchor: [0, 0, 0], ztc: true });
  expect(await page.evaluate(() => localStorage.getItem('mistlab.nested'))).toBe('0');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await display.waitForFunction(() => { const m = (window as any).__mistlab; return !m.nested && !m.staged && !!m.app.backdrop && !m.app.stage; }, undefined, { timeout: 120_000 });
  expect((await st(display)).anchor).toEqual([0, 0, 0]);
  await sameCamera();
  // the device remembers: a reload stays the old way (and ?nested=1 would override it)
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.app?.cur?.path === 'ch03/E', undefined, { timeout: 120_000 });
  expect(await st(page)).toMatchObject({ nested: false, staged: false, backdrop: true });
  // on again: back in the valley, on both screens
  await page.locator('details[data-menu="view"] > summary').click();
  await page.locator('[data-act="nested"]').click();
  await page.waitForFunction(() => { const m = (window as any).__mistlab; return m.nested && m.staged && !m.app.backdrop; }, undefined, { timeout: 120_000 });
  const on = await st(page), e = JSON.parse(readFileSync(new URL('../manifests/world-atlas.json', import.meta.url), 'utf8')).scenes['ch03/E'];
  for (let k = 0; k < 3; k++) expect(Math.abs(on.anchor[k] - e.placement.position[k])).toBeLessThan(0.01);
  await display.waitForFunction(() => { const m = (window as any).__mistlab; return m.nested && m.staged; }, undefined, { timeout: 120_000 });
  await sameCamera();
  await display.close();
});

test('in the valley: the camera rides the ground off the map, players see only revealed names, low memory halves the forest', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 2, configurable: true }));
  await boot(page, '', VILLAGE);
  // pan onto Mount Baratok: the target climbs onto the mountain, the camera keeps its distance; back on the village
  // the level's floor holds it again
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, w = m.app.world, st = m.stage, V = w.camera.position.constructor;
    const M = m.atlas.pins.find((p: any) => p.campaign === 'cos' && p.key === 'M'), y0 = w.controls.target.y;
    w.moveTo(new V(M.world[0] - w.anchor.x, y0, M.world[1] - w.anchor.z), 3000, false);
    const on = { ty: w.controls.target.y + w.anchor.y, ground: st.groundAt(M.world[0], M.world[1]), d: w.camera.position.distanceTo(w.controls.target) };
    m.app.frameLevel();
    return { on, back: w.controls.target.y, y0 };
  });
  expect(r.on.ground).toBeGreaterThan(3000);
  expect(Math.abs(r.on.ty - r.on.ground)).toBeLessThan(1);
  expect(r.on.d).toBeCloseTo(3000, 0);
  expect(Math.abs(r.back - r.y0)).toBeLessThan(1);
  // the forest: half the pool on a device with under 4 GB; none from high up
  const forest = await page.evaluate(async () => {
    const m = (window as any).__mistlab, w = m.app.world, st = m.stage;
    const near = st.stats().forest;
    w.flyTo(w.controls.target.clone(), 40000, 1); await w.settled();
    return { pool: st.forest.instanceMatrix.count, near, far: st.stats().forest };
  });
  expect(forest.pool).toBe(6000);
  expect(forest.near).toBeGreaterThan(0);
  expect(forest.near).toBeLessThanOrEqual(6000);
  expect(forest.far).toBe(0);
  // the DM sees every place's name; in Players view only the revealed ones, and a name does not fly anywhere
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld(); m.app.world.renderNow(); });
  const names = () => page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.lbl.place')];
    const shown = els.filter((e) => e.style.display !== 'none');
    // a name can be tapped when the app's tap at its middle finds it (the names themselves take no pointer)
    const a = (window as any).__mistlab.app, at = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return a.placeAt({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'mouse' })?.path; };
    return { shown: shown.map((e) => e.dataset.key), clickable: shown.filter((e) => getComputedStyle(e).visibility !== 'hidden' && at(e) === e.dataset.path).length, crowded: shown.filter((e) => getComputedStyle(e).visibility === 'hidden').length, tips: shown.filter((e) => e.dataset.tip).length, revealed: [...a.pinsRevealed] };
  });
  const dm = await names();
  expect(dm.shown.length).toBeGreaterThanOrEqual(25);
  expect(dm.clickable).toBe(dm.shown.length - dm.crowded); // every name not crowded out (as a name or its key) flies
  expect(dm.tips).toBe(dm.shown.length);
  await page.locator('[data-view="players"]').click();
  await page.evaluate(() => (window as any).__mistlab.app.world.renderNow());
  const pl = await names();
  expect(pl.shown.length).toBeLessThan(dm.shown.length);
  for (const k of pl.shown) expect(pl.revealed).toContain(k);
  expect(pl.clickable).toBe(0);
  expect(pl.tips).toBe(0);
});

// The DM's natural way out and in: the wheel and the pinch, with the place names under the pointer or a finger. The
// names take no pointer, so they never swallow a zoom (zoom-to-cursor slides the open map's own name under the cursor).
const chipWatch = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLElement>('.zoomchip')!; (window as any).__chips = [];
  new MutationObserver(() => { if (!c.hidden) (window as any).__chips.push(c.textContent); }).observe(c, { attributes: true, childList: true, subtree: true });
});
const cam = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const m = (window as any).__mistlab, w = m.app.world;
  return { d: w.camera.position.distanceTo(w.controls.target), max: w.controls.maxDistance, atMax: w.atMaxDistance, chips: [...(window as any).__chips] as string[], band: document.body.dataset.band, path: m.app.cur?.path };
});
const nameBox = (page: import('@playwright/test').Page, key: string) => page.evaluate((k) => {
  const e = document.querySelector<HTMLElement>(`.lbl.place[data-key="${k}"]`); if (!e || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return null;
  const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
}, key);

test('the wheel zooms through the place names: out from the village to the far limit and its chip, and in over a name', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '', VILLAGE);
  await chipWatch(page);
  await page.mouse.move(512, 400);
  // wheel out; once the village's own name shows, the cursor goes onto it and stays there
  let onName = 0;
  for (let i = 0; i < 90 && !(await cam(page)).chips.length; i++) {
    const e = await nameBox(page, 'E');
    if (e && !onName) await page.mouse.move(e.x, e.y);
    if (e) onName++;
    await page.mouse.wheel(0, 400); await page.waitForTimeout(60);
  }
  const out = await cam(page);
  expect(onName).toBeGreaterThan(0); // the wheel turned over the name
  expect(out.atMax).toBe(true);
  expect(out.chips.join()).toMatch(/whole valley/);
  // to the whole valley, then in again with the wheel over Castle Ravenloft's name: the name does not stop it
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld(); await m.app.world.settled(); m.app.world.renderNow(); });
  await page.waitForTimeout(300);
  const k = (await nameBox(page, 'K'))!;
  expect(k).not.toBeNull();
  await page.mouse.move(k.x, k.y);
  const d0 = (await cam(page)).d;
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(60); }
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  await page.waitForTimeout(500);
  expect((await cam(page)).d).toBeLessThan(d0 / 3);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the whole valley fits beside the slider, names stay on screen, a pinch over a name zooms, a finger near a name flies', async ({ page }) => {
    test.setTimeout(420_000);
    await boot(page, '', VILLAGE);
    await chipWatch(page);
    // the whole valley: every edge of the region, every place and every name inside the screen and clear of the panels
    await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld(); await m.app.world.settled(); m.app.world.renderNow(); });
    await page.waitForTimeout(400);
    const fit = await page.evaluate(() => {
      const m = (window as any).__mistlab, w = m.app.world, st = m.stage, V = w.camera.position.constructor, b = st.bounds;
      const px = (x: number, z: number) => { const v = new V(x - w.anchor.x, st.land.field.height(x, z) - w.anchor.y, z - w.anchor.z).project(w.camera); return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight]; };
      const pts = [px(b.minX, b.minZ), px(b.maxX, b.minZ), px(b.minX, b.maxZ), px(b.maxX, b.maxZ), ...m.atlas.pins.filter((p: any) => p.campaign === 'cos').map((p: any) => px(p.world[0], p.world[1]))];
      const slider = document.querySelector('.vslider')!.getBoundingClientRect(), panels = w.chrome().panels as DOMRect[];
      const names = [...document.querySelectorAll<HTMLElement>('.lbl.place')].filter((e) => e.style.display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect());
      return {
        minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), slider: slider.left, framed: st.framed, names: names.length,
        off: names.filter((r) => r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight).length,
        under: names.filter((r) => panels.some((p) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top)).length,
      };
    });
    expect(fit.framed).toBe(true);
    expect(fit.minX).toBeGreaterThanOrEqual(0);
    expect(fit.maxX).toBeLessThanOrEqual(fit.slider);
    expect(fit.names).toBeGreaterThan(3);
    expect(fit).toMatchObject({ off: 0, under: 0 });
    // back on the village, pinch out with a finger on the village's name: it zooms all the way to the far limit
    await page.evaluate(async () => { const a = (window as any).__mistlab.app; a.frameLevel(); await a.world.settled(); });
    const cdp = await page.context().newCDPSession(page);
    const pinch = async (fx: number, fy: number, from: number, to: number) => { // finger 1 stays at (fx, fy), finger 2 closes on it from the open side (never on the slider)
      const at = (d: number) => [{ x: fx, y: fy, id: 1 }, { x: fx - from > 10 ? fx - d : fx + d, y: fy, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from) });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from + ((to - from) * i) / 6) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(200);
    };
    let onName = 0;
    for (let i = 0; i < 16 && !(await cam(page)).atMax; i++) {
      const e = await nameBox(page, 'E');
      if (e) { onName++; await pinch(e.x, e.y, 150, 40); } else await pinch(140, 450, 150, 40);
    }
    expect(onName).toBeGreaterThan(0);
    expect((await cam(page)).atMax).toBe(true);
    // one more pinch at the limit asks for more: the chip
    await pinch(140, 450, 220, 30);
    await expect.poll(async () => (await cam(page)).chips.join(), { timeout: 60_000 }).toMatch(/whole valley/);
    // a finger a little below a name (inside its 44-px target) flies there
    await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld(); await m.app.world.settled(); m.app.world.renderNow(); });
    await page.waitForTimeout(400);
    const n = (await nameBox(page, 'N'))!;
    expect(n).not.toBeNull();
    // on the inked map the place stands taller (its symbol over its disc and name): the finger lands low on it, on the
    // disc's row, or for a short label 16 px below its middle (inside its 44 px target)
    await page.touchscreen.tap(n.x, n.h < 30 ? n.y + 16 : n.y + n.h / 2 - 6);
    await page.waitForFunction(() => { const a = (window as any).__mistlab.app; return a.cur?.path === 'ch05/N' && !a.world.flying; }, undefined, { timeout: 180_000 });
    await cdp.detach();
  });
});
