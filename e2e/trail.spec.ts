// The party's trail (item 2f-1b): a move on the world map is recorded only on an explicit travel (the drag of the
// party's '&', which ends in App.moveWorld), never when the DM opens a map to look at it (a place's name, the world
// map's disc, a crumb, the library, a reload); and the trail is drawn along the roads between its places
// (render/worldroads.ts, render/worldstage.ts drawTrail), not as a straight ray across the valley. Both tests failed
// on the build before: every open moved the party, and the trail was straight lines between the places. The flat sheet
// (the continuous world off, ui/worldmap.ts) draws its trail the same way.
import { expect, test } from '@playwright/test';
import { boot, SCENES, quiet } from './helpers';

test.beforeEach(async ({ page }) => { await quiet(page); });

const VILLAGE = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };

test('opening Krezk from its name is looking, not travelling: the party\'s place and its trail do not change', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '', VILLAGE);
  const state = () => page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    return { world: JSON.stringify(a.state.world), trail: a.state.world?.trail?.length ?? 0, d: document.querySelector('.nesttrail path')?.getAttribute('d') ?? '', revealed: [...a.pinsRevealed].sort() };
  });
  const before = await state();
  // a new campaign starts where its first map is, with no move behind it
  expect(JSON.parse(before.world)).toMatchObject({ key: 'E' });
  expect(before).toMatchObject({ trail: 1, d: '', revealed: ['E'] });
  // out over the whole valley, the village folded into its proxy and the names settled (the flights test's pattern)
  await page.evaluate(async () => { const m = (window as any).__mistlab; m.stage.frameWorld('fly'); await m.app.world.settled(); });
  await page.waitForFunction(() => { const a = (window as any).__mistlab.app; return !a.world.flying && !a.fades.size && !a.resident.get('ch03/E')?.drawn; }, undefined, { timeout: 60_000 });
  await page.waitForTimeout(300);
  // a tap on Krezk's name flies there and opens its map
  const sBox = (await page.locator('.lbl.place[data-key="S"]').boundingBox())!;
  await page.mouse.click(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.waitForFunction(() => { const a = (window as any).__mistlab.app; return a.cur?.path === 'ch08/S' && !a.world.flying; }, undefined, { timeout: 180_000 });
  const after = await state();
  // the party is still at the village: no move, no trail segment, Krezk not revealed to the players by the DM's look
  expect(after.world).toBe(before.world);
  expect(after).toMatchObject({ trail: 1, d: '', revealed: ['E'] });
  // the opened map still has the party's token on it, as every opened map does
  expect(await page.evaluate(() => { const a = (window as any).__mistlab.app; return a.state.tokens.some((t: any) => t.role === 'party' && t.location === a.cur.scene.location); })).toBe(true);
});

test('the trail of a travel is drawn along the roads: the village to Vallaki by the Old Svalich Road', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '', VILLAGE);
  await page.evaluate(() => (window as any).__mistlab.stage?.cartoReady?.());
  // the travel: the drag of the party's '&' ends in moveWorld (ui/worldnest.ts drop); the same call, from the village to Vallaki
  const moved = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, N = m.pins().find((p: any) => p.key === 'N'), from = a.state.world.pos;
    a.moveWorld([...N.pos], 'N', Math.hypot(N.pos[0] - from[0], N.pos[1] - from[1]));
    return { key: a.state.world.key, trail: a.state.world.trail.length, revealed: a.pinsRevealed.has('N') };
  });
  expect(moved).toEqual({ key: 'N', trail: 2, revealed: true });
  // the world map: the valley from straight above, where the trail draws
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying, undefined, { timeout: 60_000 });
  await page.evaluate(() => (window as any).__mistlab.app.world.renderNow());
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, st = m.stage, W = st.data, FT = 5280;
    const el = document.querySelector('.nesttrail')!, host = el.getBoundingClientRect(), d = el.querySelector('path')!.getAttribute('d') ?? '';
    const px = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => [Number(x[1]) + host.left, Number(x[2]) + host.top] as [number, number]);
    // each drawn point back onto the land (the ray from the eye, straight down here), in miles
    const miles = px.map(([x, y]) => { const g = st.groundOf(x, y); return g ? (m.frames.milesOfWorld(W, [g.x, g.z]) as [number, number]) : null; });
    const segDist = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
    const toRoad = (p: number[]) => Math.min(...W.roads.flatMap((r: any) => r.pts.slice(1).map((b: number[], i: number) => segDist(p, r.pts[i], b)))) * FT;
    const E = m.pins().find((p: any) => p.key === 'E').pos, N = m.pins().find((p: any) => p.key === 'N').pos, dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let drawn = 0; for (let i = 1; i < miles.length; i++) if (miles[i] && miles[i - 1]) drawn += dist(miles[i]!, miles[i - 1]!);
    return {
      band: document.body.dataset.band, n: px.length, onLand: miles.filter(Boolean).length, dash: getComputedStyle(el.querySelector('path')!).strokeDasharray,
      offRoadFt: miles.map((p) => (p ? toRoad(p) : Infinity)), endsFt: [miles[0] ? dist(miles[0], E) * FT : Infinity, miles[miles.length - 1] ? dist(miles[miles.length - 1]!, N) * FT : Infinity],
      drawnMi: drawn, straightMi: dist(E, N), statePts: m.nest.trailPoints().length,
    };
  });
  expect(r.band).toBe('valley');
  expect(r.statePts).toBe(2); // the trail's own points are still the two places
  expect(r.n).toBeGreaterThan(20); // the road's vertices between them, not one straight stroke
  expect(r.onLand).toBe(r.n);
  for (const ft of r.offRoadFt) expect(ft).toBeLessThan(60); // every drawn point on the road
  expect(r.endsFt[0]).toBeLessThan(60); expect(r.endsFt[1]).toBeLessThan(60); // from the village's place to Vallaki's
  expect(r.drawnMi).toBeGreaterThan(r.straightMi * 1.3); // along the winding road, not as the crow flies
  expect(r.dash).not.toBe('none'); // still the dashed trail
});

test('the flat sheet (the continuous world off) draws the trail along the roads too', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '&nested=0', VILLAGE);
  // the same travel, from the village to Vallaki
  await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, N = m.pins().find((p: any) => p.key === 'N'), from = a.state.world.pos;
    a.moveWorld([...N.pos], 'N', Math.hypot(N.pos[0] - from[0], N.pos[1] - from[1]));
  });
  await page.click('[data-act="world"]');
  await page.waitForSelector('.worldmap .wm-trail');
  const r = await page.evaluate(() => {
    const m = (window as any).__mistlab, W = (window as any).__mistlabNest.worldData, FT = 5280;
    const d = document.querySelector('.worldmap .wm-trail')!.getAttribute('d') ?? '';
    // the sheet is drawn in miles: the path's points are the trail's own
    const pts = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((x) => [Number(x[1]), Number(x[2])]);
    const segDist = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
    const toRoad = (p: number[]) => Math.min(...W.roads.flatMap((rd: any) => rd.pts.slice(1).map((b: number[], i: number) => segDist(p, rd.pts[i], b)))) * FT;
    const E = m.pins().find((p: any) => p.key === 'E').pos, N = m.pins().find((p: any) => p.key === 'N').pos, dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let drawn = 0; for (let i = 1; i < pts.length; i++) drawn += dist(pts[i], pts[i - 1]);
    return { n: pts.length, offRoadFt: pts.slice(1, -1).map(toRoad), ends: [dist(pts[0], E) * FT, dist(pts[pts.length - 1], N) * FT], drawnMi: drawn, straightMi: dist(E, N) };
  });
  expect(r.n).toBeGreaterThan(20); // the road's vertices between the two places, not one straight stroke
  for (const ft of r.offRoadFt) expect(ft).toBeLessThan(60);
  expect(r.ends[0]).toBeLessThan(1); expect(r.ends[1]).toBeLessThan(1); // from the village's place to Vallaki's
  expect(r.drawnMi).toBeGreaterThan(r.straightMi * 1.3);
});
