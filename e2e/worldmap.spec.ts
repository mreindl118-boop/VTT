// The World map button's nested world map (ui/worldnest.ts, render/worldcarto.ts): the valley drawn from straight
// above as an inked D&D map, with everything the flat sheet had round it. And review finding 13 (approval A4): the
// players' side never sees the symbol, proxy, label or painted mark of a place it does not know, on the nested map and
// on the flat sheet (the land, rivers, roads and mountains stay). The two A4 tests failed on the build before the fix.
import { expect, test, type Page } from '@playwright/test';
import { boot, SCENES, quiet } from './helpers';

test.beforeEach(async ({ page }) => { await quiet(page); });

const VILLAGE = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };
const settle = (page: Page) => page.waitForFunction(() => !(window as any).__mistlab.app.world.flying, undefined, { timeout: 60_000 });
/** Boot a map in the valley and wait for the inked map's bake. */
async function valley(page: Page, scene = VILLAGE): Promise<void> {
  await boot(page, '', scene);
  await page.evaluate(() => (window as any).__mistlab.stage?.cartoReady?.());
}
/** The middle of an element on the page, if it shows. */
const mid = async (page: Page, sel: string): Promise<[number, number] | null> => {
  const b = await page.locator(sel).first().boundingBox(); return b && b.width ? [b.x + b.width / 2, b.y + b.height / 2] : null;
};
const openWorldMap = async (page: Page) => {
  await page.click('[data-act="world"]');
  await settle(page);
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.world.renderNow(); });
  await page.waitForTimeout(300);
};

test('A4: the players\' flat sheet paints no symbol for a place they do not know', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, '&nested=0', SCENES[1]);
  // the painted base round a place (the sheet's own canvas, in its own pixels), hashed
  const paintAt = (key: string) => page.evaluate((k) => {
    const svg = document.querySelector('.world-svg')!, [x, y, w] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const cv = document.querySelector<HTMLCanvasElement>('.world-paint')!, S = cv.width / w;
    const p = (window as any).__mistlab.pins().find((q: any) => q.key === k).pos;
    const d = cv.getContext('2d')!.getImageData(Math.round((p[0] - x) * S) - 30, Math.round((p[1] - y) * S) - 30, 60, 60).data;
    let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h;
  }, key);
  const sheet = async (view: 'dm' | 'players') => {
    await page.evaluate((v) => (window as any).__mistlab.app.setView(v), view);
    await page.click('[data-act="world"]');
    const r = { K: await paintAt('K'), E: await paintAt('E') };
    await page.keyboard.press('Escape');
    return r;
  };
  expect(await page.evaluate(() => [...(window as any).__mistlab.app.pinsRevealed])).toEqual(['E']);
  const dm = await sheet('dm'), players = await sheet('players');
  expect(players.E).toBe(dm.E); // the village they know keeps its houses
  expect(players.K).not.toBe(dm.K); // Castle Ravenloft's keep is not painted for them
  await page.evaluate(() => (window as any).__mistlab.app.revealPin('K', true));
  expect((await sheet('players')).K).toBe(dm.K); // revealed: it is
});

test('A4: in the valley the players\' side has no label, symbol or proxy for a place it does not know', async ({ page }) => {
  test.setTimeout(240_000);
  await valley(page);
  const seen = () => page.evaluate(() => {
    const m = (window as any).__mistlab, st = m.stage; m.app.world.renderNow();
    const text = [...document.querySelectorAll('#stage .labels .lbl')].map((e) => e.textContent ?? '').join(' | ');
    return { K: document.querySelectorAll('.lbl.place[data-key="K"]').length, E: document.querySelectorAll('.lbl.place[data-key="E"]').length, proxyK: st.proxies.get('ch04/K').visible, named: text.includes('Castle Ravenloft') };
  });
  expect(await seen()).toEqual({ K: 1, E: 1, proxyK: true, named: true }); // the DM sees it all
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  expect(await seen()).toEqual({ K: 0, E: 1, proxyK: false, named: false }); // no page element, no proxy
  await page.evaluate(() => (window as any).__mistlab.app.revealPin('K', true));
  expect(await seen()).toEqual({ K: 1, E: 1, proxyK: true, named: true }); // revealed: all of it
});

test('the World map button: the whole region from straight above as the inked map, tips, Places and the reveal eye', async ({ page }) => {
  test.setTimeout(300_000);
  await valley(page);
  await openWorldMap(page);
  const v = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app, w = a.world, st = m.stage;
    return {
      k: st.carto.k, polar: (w.controls.getPolarAngle() * 180) / Math.PI, north: (a.cameraFrame().north * 180) / Math.PI, band: document.body.dataset.band,
      bar: !document.querySelector<HTMLElement>('.nestbar')!.hidden, hex: document.querySelector('.nestbar [data-hex]')!.getAttribute('aria-pressed'),
      title: document.querySelector('.carto-title .ct-name')?.textContent, note: document.querySelector('.carto-title .ct-note')?.textContent,
      frame: Number(getComputedStyle(document.querySelector('.carto-frame')!).opacity),
      pins: document.querySelectorAll('.lbl.place').length, disc: document.querySelector('.lbl.place[data-key="K"] .pk')?.textContent,
      // the land's own names (a name a shown place carries close by is not lettered twice: Lake Zarovich is L's)
      land: [...document.querySelectorAll<HTMLElement>('.lbl.carto')].filter((e) => e.style.display !== 'none').map((e) => e.textContent),
      fonts: document.fonts.check('600 40px "Grenze Gotisch"') && document.fonts.check('italic 600 15px "Alegreya"') && document.fonts.check('700 16px "Alegreya SC"'),
      scale: document.querySelector('.mapframe .scalebar span')?.textContent,
    };
  });
  expect(v.k).toBe(1);
  expect(v.polar).toBeLessThan(5); // straight down
  expect(Math.abs(v.north)).toBeLessThan(5); // north up
  expect(v.band).toBe('valley');
  expect(v.bar).toBe(true);
  expect(v.hex).toBe('true');
  expect(v.title).toBe('The Lands of Barovia');
  expect(v.note).toContain('1 hex = ¼ mile');
  expect(v.frame).toBeGreaterThan(0.9);
  expect(v.pins).toBe(28); // every place with a map (Mount Baratok's four other marks are its one peak name)
  expect(v.disc).toBe('K');
  expect(v.land).not.toContain('Lake Zarovich');
  for (const n of ['Svalich Woods', 'Balinok Mountains', 'Luna Lake', 'Mount Ghakis', 'Luna River', 'Raven River']) expect(v.land).toContain(n);
  expect(v.fonts).toBe(true);
  expect(v.scale).toMatch(/^(1|2|3|5|10) miles?$/);
  // the hex toggle (one setting with the flat sheet's)
  await page.click('.nestbar [data-hex]');
  expect(await page.evaluate(() => [(window as any).__mistlab.stage.carto.u.uHexOn.value, localStorage.getItem('mistlab.worldHex')])).toEqual([0, '0']);
  await page.click('.nestbar [data-hex]');
  // the DM's tip on a place: its blurb, its note and whether the players know it
  const g = (await mid(page, '.lbl.place[data-key="G"] .pk'))!;
  await page.mouse.move(g[0], g[1]); await page.waitForTimeout(300); await page.mouse.move(g[0] + 1, g[1]);
  await expect(page.locator('.nesttip')).toBeVisible();
  await expect(page.locator('.nesttip')).toContainText('Tser Pool Encampment');
  await expect(page.locator('.nesttip')).toContainText('Hidden from players');
  // Places: one row a name, the eye reveals
  await page.click('.nestbar [data-places]');
  expect(await page.locator('.nestkey li').count()).toBe(28);
  expect(await page.locator('.nestkey li', { hasText: 'Mount Baratok' }).count()).toBe(1);
  await page.locator('.nestkey li[data-key="G"] [data-reveal]').click();
  expect(await page.evaluate(() => [...(window as any).__mistlab.app.pinsRevealed].sort())).toEqual(['E', 'G']);
  await expect(page.locator('.nestkey li[data-key="G"] [data-reveal]')).toHaveAttribute('aria-pressed', 'true');
  // the players' side: only what they know, tips with the blurb alone, no eyes
  await page.locator('[data-view="players"]').click();
  await page.evaluate(() => (window as any).__mistlab.app.world.renderNow());
  expect(await page.locator('.lbl.place[data-key="C"]').count()).toBe(0);
  expect(await page.locator('.lbl.place[data-key="G"]').count()).toBe(1);
  expect(await page.locator('.nestkey [data-reveal]').count()).toBe(0);
  const g2 = (await mid(page, '.lbl.place[data-key="G"] .pk'))!;
  await page.mouse.move(g2[0] + 1, g2[1]); await page.waitForTimeout(300); await page.mouse.move(g2[0], g2[1] + 1);
  await expect(page.locator('.nesttip')).toBeVisible();
  await expect(page.locator('.nesttip')).toContainText('Tser Pool Encampment');
  await expect(page.locator('.nesttip')).not.toContainText('Hidden from players');
  // Escape leaves the world map for the open map
  await page.locator('[data-view="dm"]').click();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.evaluate(() => document.body.dataset.band)).not.toBe('valley');
});

test('the party drags over the land to a place and into the wilderness; the pace sets the hours; a tap flies into a map', async ({ page }) => {
  test.setTimeout(300_000);
  await valley(page);
  await openWorldMap(page);
  const st = () => page.evaluate(() => { const w = (window as any).__mistlab.app.state.world; return { key: w?.key, pos: w?.pos, trail: w?.trail?.length ?? 0 }; });
  const before = await st();
  expect(before.key).toBe('E');
  const drag = async (to: [number, number]) => {
    const from = (await mid(page, '.lbl.world-party'))!;
    await page.mouse.move(from[0], from[1]); await page.mouse.down();
    await page.mouse.move(to[0], to[1], { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(400);
  };
  expect(await page.locator('.lbl.world-party').getAttribute('aria-label')).toContain('drag to travel');
  const g = (await mid(page, '.lbl.place[data-key="G"] .pk'))!;
  await drag([g[0] + 2, g[1]]);
  const at = await st();
  expect(at.key).toBe('G');
  expect(at.trail).toBe(before.trail + 1);
  expect(await page.evaluate(() => (window as any).__mistlab.app.pinsRevealed.has('G'))).toBe(true);
  await expect(page.locator('.nestcard')).toContainText('Tser Pool Encampment');
  await expect(page.locator('.nestcard')).toContainText('2.7 mi as the crow flies · about 55 min at a normal pace (3 mph)');
  await page.click('.nestbar [data-pace="fast"]');
  await expect(page.locator('.nestcard')).toContainText('about 41 min at a fast pace (4 mph)');
  await page.click('.nestbar [data-pace="normal"]');
  // the trail: dashed on the land, one more point
  expect(await page.evaluate(() => (window as any).__mistlab.nest.trailPoints().length)).toBe(Math.min(12, at.trail));
  expect(await page.locator('.nesttrail path').getAttribute('d')).toMatch(/^M/);
  // into the wilderness, well away from any place
  const wild = await page.evaluate(() => {
    const m = (window as any).__mistlab, s = m.stage, [x, z] = m.frames.worldOfMiles(s.data, [9.6, 9.9]);
    const p = s.screenOfAbs(new (m.app.world.camera.position.constructor)(x, s.groundAt(x, z), z)); return [p.x, p.y] as [number, number];
  });
  await drag(wild);
  const w = await st();
  expect(w.key).toBeUndefined();
  await expect(page.locator('.nestcard')).toContainText(/^Wilderness · \d+\.\d mi from .+/);
  // the players' side cannot drag the party
  await page.locator('[data-view="players"]').click();
  const p0 = await st();
  await drag(g);
  expect(await st()).toEqual(p0);
  await page.locator('[data-view="dm"]').click();
  await page.keyboard.press('Escape');
  // a tap on a place with one map flies into it and opens it
  const g3 = (await mid(page, '.lbl.place[data-key="G"] .pk'))!;
  await page.mouse.click(g3[0], g3[1]);
  await page.waitForFunction(() => (window as any).__mistlab.app.cur?.path === 'ch02/G', undefined, { timeout: 120_000 });
  expect(await page.evaluate(() => localStorage.getItem('mistlab.scene'))).toBe('ch02/G');
});

test('A Wild Sheep Chase: its own inked map, pins 1 to 5 with their numbers, the pastoral look', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?nosw&scene=wsc%2F01-tavern');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => (window as any).__mistlab.stage?.cartoReady?.());
  await openWorldMap(page);
  const v = await page.evaluate(() => ({
    style: document.body.dataset.cartoStyle, title: document.querySelector('.carto-title .ct-name')?.textContent, note: document.querySelector('.carto-title .ct-note')?.textContent,
    keys: [...document.querySelectorAll<HTMLElement>('.lbl.place')].map((e) => e.dataset.key).sort(),
    five: [document.querySelector('.lbl.place[data-key="5"] .pk')?.textContent, document.querySelector('.lbl.place[data-key="5"] .pn')?.textContent],
    tip: document.querySelector('[data-act="world"]')!.getAttribute('data-tip'),
  }));
  expect(v).toEqual({ style: 'pastoral', title: 'The Country Round the Town', note: '1 hex = 1 mile, north up', keys: ['1', '2', '3', '4', '5'], five: ['5', 'Noke\'s Tower'], tip: expect.not.stringContaining('Barovia') });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the world bar and Places stay on screen and nothing scrolls sideways', async ({ page }) => {
    test.setTimeout(240_000);
    await valley(page);
    await openWorldMap(page);
    await page.click('.nestbar [data-places]');
    const r = await page.evaluate(() => {
      const inside = (e: Element) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; };
      return { bar: [...document.querySelectorAll('.nestbar button')].every(inside), key: inside(document.querySelector('.nestkey')!), sw: document.documentElement.scrollWidth };
    });
    expect(r).toEqual({ bar: true, key: true, sw: 390 });
  });
});
