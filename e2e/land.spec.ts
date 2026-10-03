// The land beyond an outdoor map: one smooth place with the map (no seam colour at the map's edge from high up), the
// lakes carved into the height model (the bed under the water, the shore at the water line), the mesh within budget
// and refined where the camera looks.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

const open = async (page: import('@playwright/test').Page, path: string) => {
  await page.goto('/?nosw');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(async (p) => { await (window as any).__mistlab.app.open(p); }, path);
  await page.waitForTimeout(300);
};
/** Put the camera straight over the map's centre at a height and let the land settle. */
const topView = (page: import('@playwright/test').Page, h: number) => page.evaluate(async (h) => {
  const app = (window as any).__mistlab.app, w = app.world, l = app.level;
  const pts = [...l.rooms.map((r: any) => r.polygon), ...(l.terrain ?? []).map((t: any) => t.polygon)].flat();
  const bb = { minX: Math.min(...pts.map((p: number[]) => p[0])), maxX: Math.max(...pts.map((p: number[]) => p[0])), minZ: Math.min(...pts.map((p: number[]) => p[1])), maxZ: Math.max(...pts.map((p: number[]) => p[1])) };
  const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2, y = l.elevationFt;
  w.controls.maxDistance = 40000; w.controls.target.set(cx, y, cz); w.camera.position.set(cx + 1, y + h, cz + 1); w.camera.lookAt(w.controls.target); w.controls.update();
  w.camera.far = 200000; w.camera.updateProjectionMatrix(); app.labelDensity(); if (w.scene.fog) w.scene.fog.density = w.fogDensity;
  await new Promise((r) => setTimeout(r, 500)); app.labelDensity(); w.renderNow();
  return { bb, cz, y };
}, h);
const pixelsAt = (page: import('@playwright/test').Page, pts: [number, number][]) => page.evaluate((pts) => {
  const m = (window as any).__mistlab; m.render();
  const c = document.querySelector('canvas.gl') as HTMLCanvasElement, o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const x = o.getContext('2d')!; x.drawImage(c, 0, 0);
  return pts.map(([X, Z]) => { const [sx, sy] = m.screenOf(X, Z, 0); const d = x.getImageData(Math.round(sx), Math.round(sy), 1, 1).data; return [d[0], d[1], d[2]]; });
}, pts);

test('the village from high up: the map and the land beside it are the same colour (no seam), the land is in budget', async ({ page }) => {
  await open(page, 'ch03/E');
  const { bb, cz } = await topView(page, 6000);
  await page.evaluate(() => (window as any).__mistlab.setGrid('off'));
  const [inside, outside] = await pixelsAt(page, [[bb.maxX - 30, cz], [bb.maxX + 30, cz]]);
  for (let c = 0; c < 3; c++) expect(Math.abs(inside[c] - outside[c])).toBeLessThanOrEqual(6);
  const stats = await page.evaluate(() => (window as any).__mistlab.app.backdrop.userData.land.stats());
  expect(stats.tiles).toBeGreaterThan(50);
  expect(stats.tris).toBeLessThan(320000);
});

test('Vallaki: Lake Zarovich lies in a basin under its surface, with the shore at the water line', async ({ page }) => {
  await open(page, 'ch05/N');
  const r = await page.evaluate(() => {
    const app = (window as any).__mistlab.app, land = app.backdrop.userData.land;
    const lakes = app.backdrop.getObjectByName('lakes');
    const lake = [...land.lakeLevel.entries()].find(([l]: any) => /Zarovich/.test(l.name));
    const L = lake[1], l = lake[0];
    // the lake in plan feet (north is -z on this map: world east → +x, world south → +z)
    const pin = app.state.world.pos, FT = 5280, l0 = app.level, pts = [...l0.rooms.map((r: any) => r.polygon), ...(l0.terrain ?? []).map((t: any) => t.polygon)].flat();
    const cx = (Math.min(...pts.map((p: number[]) => p[0])) + Math.max(...pts.map((p: number[]) => p[0]))) / 2, cz = (Math.min(...pts.map((p: number[]) => p[1])) + Math.max(...pts.map((p: number[]) => p[1]))) / 2;
    const x = cx + (l.center[0] - pin[0]) * FT, z = cz + (l.center[1] - pin[1]) * FT;
    const centre = land.yAt(x, z), inner = land.yAt(x, z + l.r[1] * FT * 0.6), shore = land.yAt(x, z + l.r[1] * FT), beyond = land.yAt(x, z + l.r[1] * FT + 300);
    return { L, centre, inner, shore, beyond, hasLakes: !!lakes, tris: land.stats().tris };
  });
  expect(r.hasLakes).toBe(true);
  expect(r.centre).toBeLessThan(r.L - 3);     // the bed is well under the water
  expect(r.inner).toBeLessThan(r.L - 3);
  expect(Math.abs(r.shore - r.L)).toBeLessThan(1.5); // the land crosses the water level at the ellipse
  expect(r.beyond).toBeGreaterThan(r.L + 1);  // and climbs away from it
  expect(r.tris).toBeLessThan(320000);
});

test('the land refines round the camera target and settles within a few frames', async ({ page }) => {
  await open(page, 'ch03/E');
  const { bb, cz, y } = await topView(page, 6000);
  const before = await page.evaluate(() => (window as any).__mistlab.app.backdrop.userData.land.stats());
  const after = await page.evaluate(async ({ x, y, z }) => {
    const app = (window as any).__mistlab.app, w = app.world;
    w.controls.target.set(x, y, z); w.camera.position.set(x - 60, y + 170, z + 140); w.camera.lookAt(w.controls.target); w.controls.update(); app.labelDensity();
    await new Promise((r) => setTimeout(r, 900)); app.labelDensity();
    return app.backdrop.userData.land.stats();
  }, { x: bb.maxX + 1500, y, z: cz });
  expect(after.tiles).not.toBe(before.tiles);
  expect(after.buildMs).toBeLessThan(40); // one step's worth of tiles, never a stall
  expect(after.tris).toBeLessThan(320000);
});
