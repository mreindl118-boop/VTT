// Acceptance: grid pixels exist only over floor polygons (walls, stair risers, props, characters are grid-free).
import { expect, test } from '@playwright/test';
import { boot, diff, snap } from './helpers';

for (const t of [0, 1])
for (const view of ['tabletop', 'top'] as const)
  for (const low of [true, false])
    for (const grid of ['square', 'hex'] as const)
      test(`grid only on floors — t=${t}, ${view}, ${low ? 'low' : 'full'} walls, ${grid}`, async ({ page }) => {
        await boot(page);
        await page.evaluate(({ view, low, t }) => { const m = (window as any).__mistlab; m.setT(t); m.setLowWalls(low); m.frame(view); }, { view, low, t });
        await page.evaluate((g) => (window as any).__mistlab.setGrid(g), grid);
        await snap(page, 'on');
        await page.evaluate(() => (window as any).__mistlab.setGrid('off'));
        await snap(page, 'off');
        await page.evaluate(() => (window as any).__mistlab.setRenderMode('floorMask'));
        await snap(page, 'mask');
        const r = await diff(page, 'on', 'off', 'mask');
        expect(r.changed, 'grid must actually draw').toBeGreaterThan(t ? 2000 : 800);
        expect(r.outside, 'grid pixels outside visible floor').toBe(0);
      });
