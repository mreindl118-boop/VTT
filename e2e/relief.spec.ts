// Relief (core/relief.ts) in the running app, on Vallaki: tokens stand on the ground, a tap finds the ground under it,
// the grid is drawn by the ground itself, walls follow the ground and are cut by their height above it; a flat map is
// left as it was.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

const open = async (page: import('@playwright/test').Page, path: string) => {
  await page.goto(`/?nosw&scene=${encodeURIComponent(path)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
};

test('Vallaki: the ground has relief; the party stands on it and a tap finds the ground under the pointer', async ({ page }) => {
  await open(page, 'ch05/N');
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, app = m.app, b = app.built;
    const party = app.party, tok = app.cur.tokens.get(party.id);
    // the camera looks down a slope at a point on the ground; the ray through that pixel must come back to it
    const [px, pz] = [4800, 1800], gy = m.groundAt(px, pz), w = app.world;
    w.controls.target.set(px, gy, pz); w.camera.position.set(px + 60, gy + 90, pz + 120); w.camera.lookAt(w.controls.target); w.controls.update(); w.renderNow();
    const ray = { origin: w.camera.position.clone(), direction: w.controls.target.clone().sub(w.camera.position).normalize() };
    const hit = app.groundHit(ray);
    const hs: number[] = []; for (let x = 2500; x <= 6500; x += 250) for (let z = 1200; z <= 3200; z += 250) hs.push(m.groundAt(x, z));
    return { hasRelief: !!b.relief, tokenY: tok.position.y, groundAtToken: m.groundAt(party.pos[0], party.pos[1]), hit, range: Math.max(...hs) - Math.min(...hs) };
  });
  expect(r.hasRelief).toBe(true);
  expect(r.range).toBeGreaterThan(15);
  expect(Math.abs(r.tokenY - r.groundAtToken)).toBeLessThan(1e-6);
  expect(r.hit).not.toBeNull();
  expect(Math.hypot(r.hit[0] - 4800, r.hit[1] - 1800)).toBeLessThan(0.5);
});

test('Vallaki: the grid is draped in the ground; walls follow it and the low-wall cut is a height above it', async ({ page }) => {
  await open(page, 'ch05/N');
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, app = m.app, b = app.built;
    m.setGrid('square'); m.setLowWalls(true);
    const floors = b.floors.map((f: any) => ({ grid: !!f.material.userData.grid, smooth: !f.material.flatShading }));
    const on = () => b.grid.userData.draped.uGridOn.value;
    const gridOn = on(); m.setGrid('off'); const gridOff = on(); m.setGrid('hex'); const hex = b.grid.material.uniforms.uHex.value; m.setGrid('square');
    let walls = 0, agl = 0; b.wallsGroup.traverse((o: any) => { if (o.isMesh && o.userData.role === 'wall') { walls++; if (o.geometry.attributes.aAGL) agl++; } });
    // the land beyond the map carries the same grid on out (as far as the flat overlay would run)
    const land: boolean[] = []; app.backdrop?.traverse((o: any) => { if (o.isMesh && /^land/.test(o.name)) land.push(o.material.userData.grid?.uGridOn === b.grid.userData.draped.uGridOn); });
    return { floors, gridOn, gridOff, hex, walls, agl, land, drawn: b.grid.geometry.attributes.position === undefined };
  });
  expect(r.floors.length).toBeGreaterThan(1);
  for (const f of r.floors) { expect(f.grid).toBe(true); expect(f.smooth).toBe(true); }
  expect(r.gridOn).toBe(1); expect(r.gridOff).toBe(0); expect(r.hex).toBe(1);
  expect(r.drawn).toBe(true); // the overlay draws nothing on a level with relief
  expect(r.walls).toBeGreaterThan(0); expect(r.agl).toBe(r.walls);
  expect(r.land).toEqual([true, true]); // the land and the apron round the map
});

test('a Vallaki blowout stands in its town on the town\'s relief, its own floors flat', async ({ page }) => {
  await open(page, 'ch05/N2');
  await page.waitForFunction(() => !!(window as any).__mistlab.app.context, null, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const app = (window as any).__mistlab.app, ctx = app.context;
    let ground = 0; const ys: number[] = [];
    ctx.traverse((o: any) => { if (o.isMesh && o.name === 'floor:grass') ground++; });
    // the surroundings' ground height round the inn, sampled through its own builder's ground: not one flat plane
    const relief = !!ctx.userData.relief || ctx.children.some((c: any) => c.isMesh && c.name.startsWith('floor:') && !c.material.flatShading);
    ctx.traverse((o: any) => { if (o.isMesh && o.name.startsWith('floor:')) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 97) ys.push(p.getY(i)); } });
    return { ground, relief, span: Math.max(...ys) - Math.min(...ys), flat: !app.built.relief };
  });
  expect(r.ground).toBe(1);
  expect(r.relief).toBe(true);
  expect(r.span).toBeGreaterThan(2);
  expect(r.flat).toBe(true);
});

test('a flat map stays flat: Death House keeps its slabs and its overlay grid', async ({ page }) => {
  await open(page, 'appB/death-house');
  const r = await page.evaluate(() => {
    const app = (window as any).__mistlab.app, b = app.built;
    return { relief: !!b.relief, overlay: b.grid.name, flat: b.floors.every((f: any) => f.material.flatShading), y: b.groundY(10, 10) - app.level.elevationFt };
  });
  expect(r.relief).toBe(false);
  expect(r.overlay).toBe('grid-overlay');
  expect(r.flat).toBe(true);
  expect(r.y).toBe(0);
});
