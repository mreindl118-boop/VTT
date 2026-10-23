// Terrain must not acquire buildings or disclose a secret place through its cartographic paint.
import { expect, test } from '@playwright/test';
import { boot, quiet, SCENES } from './helpers';

const village = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };
test.beforeEach(async ({ page }) => { await quiet(page); await page.setViewportSize({ width: 1366, height: 768 }); await boot(page, '', village); });

test('geographic pins have markers and map links, without building proxies', async ({ page }) => {
  const pins = await page.evaluate(() => {
    const m = (window as any).__mistlab, s = m.stage;
    return s.data.pins.filter((p: any) => ['lake', 'river', 'road', 'peak'].includes(p.type)).map((p: any) => {
      const pin = m.atlas.pins.find((a: any) => a.campaign === s.campaign.id && a.key === p.key);
      const id = pin?.scenes.length ? pin.root ?? `${pin.scenes[0]}@${pin.key}` : undefined;
      const label = s.labels.find((l: any) => l.key === p.key), g = s.proxies.get(id);
      const want = g?.userData.want;
      if (id) s.showProxy(id, false);
      const hidden = g?.visible === false;
      if (id) { s.showProxy(id, true); s.viewDetail(id, 100); }
      const shown = g?.visible === true;
      if (id) s.showProxy(id, want !== false);
      return { key: p.key, marker: !!label, proxy: [...s.proxyKey.values()].includes(p.key),
        mapped: !!id, linked: !id || label?.obj.element.dataset.path === (pin.root ?? pin.scenes[0]),
        handle: !!g, hidden, shown, children: g?.children.length,
        ranges: s.proxyMeshes.some((b: any) => b.ranges.has(id)), detail: !!s.detailState()[id], k: s.carto.k,
      };
    });
  });
  expect(pins.length).toBeGreaterThan(0);
  for (const p of pins) { expect(p.marker, p.key).toBe(true); expect(p.proxy, p.key).toBe(false); }
  expect(pins.filter((p: any) => p.mapped).length).toBeGreaterThan(0);
  for (const p of pins.filter((p: any) => p.mapped)) {
    expect(p.linked, p.key).toBe(true);
    expect(p.handle, p.key).toBe(true);
    expect(p.hidden, p.key).toBe(true); expect(p.shown, p.key).toBe(true);
    expect(p.children, p.key).toBe(0); expect(p.ranges, p.key).toBe(false);
    expect(p.k, 'detail request exercised below the region cutoff').toBeLessThan(0.95);
    expect(p.detail, p.key).toBe(false);
  }
});

test('inked relief follows natural terrain instead of outlining map platforms', async ({ page }) => {
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.app.setView('players'); await m.stage.cartoReady(); });
  const samples = await page.evaluate(() => {
    const s = (window as any).__mistlab.stage, u = s.carto.u, tx = u.tLand.value.image, o = u.uOrigin.value, sz = u.uSize.value;
    const half = (h: number) => { const e = (h >> 10) & 31, m = h & 1023; return (h & 32768 ? -1 : 1) * (e ? (1 + m / 1024) * 2 ** (e - 15) : m * 2 ** -24); };
    return ['K', 'N'].map((key) => {
      const site = s.sites.find((p: any) => p.key === key), b = site.bounds;
      const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
      const ix = Math.floor((x - o.x) / sz.x * tx.width), iz = Math.floor((z - o.y) / sz.y * tx.height);
      const txX = o.x + (ix + .5) * sz.x / tx.width, txZ = o.y + (iz + .5) * sz.y / tx.height;
      return { key, paintedHeight: half(tx.data[(iz * tx.width + ix) * 4]), naturalHeight: s.land.field.ground(txX, txZ), platformHeight: s.land.field.height(txX, txZ) };
    });
  });
  for (const p of samples) expect(Math.abs(p.paintedHeight - p.naturalHeight), JSON.stringify(p)).toBeLessThanOrEqual(2);
});

test('town arrival is realistic and its open ground shares the land paint through the transition', async ({ page }) => {
  test.setTimeout(180_000);
  await page.evaluate(async () => { const m = (window as any).__mistlab; await m.app.open('ch05/N'); await m.stage.cartoReady(); m.app.frameLevel(); m.render(); });
  const arrival = await page.evaluate(() => { const m = (window as any).__mistlab, w = m.app.world; return { k: m.stage.carto.k, ftPerPx: m.stage.carto.ftPerPx, distance: w.camera.position.distanceTo(w.controls.target) }; });
  expect.soft(arrival.k, JSON.stringify(arrival)).toBe(0);
  for (const [width, height] of [[390, 844], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => { const w = (window as any).__mistlab.app.world, c = w.renderer.domElement; return Math.abs(w.camera.aspect - c.clientWidth / c.clientHeight) < 1e-6; });
    const framed = await page.evaluate(() => { const m = (window as any).__mistlab; m.app.frameLevel(); m.render(); return m.stage.carto.k; });
    expect.soft(framed, `${width}x${height} town arrival`).toBe(0);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  const grounds = await page.evaluate(() => {
    const m = (window as any).__mistlab, w = m.app.world;
    const dir = w.camera.position.clone().sub(w.controls.target).normalize(); w.camera.position.copy(w.controls.target).addScaledVector(dir, 11000); w.controls.update(); m.render();
    const out: { name: string; visible: boolean; paint: boolean }[] = [];
    m.app.cur.root.traverse((o: any) => { if (/^floor:(grass|snow|marsh)$/.test(o.name)) out.push({ name: o.name, visible: o.visible, paint: o.material.userData.carto === 'land' }); });
    return out;
  });
  expect(grounds.length).toBeGreaterThan(0);
  for (const g of grounds) { expect(g.visible, g.name).toBe(true); expect(g.paint, g.name).toBe(true); }
});
