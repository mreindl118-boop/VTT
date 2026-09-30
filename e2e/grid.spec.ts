// Acceptance: grid pixels exist only over floor polygons (walls, stair risers, props, characters are grid-free).
import { expect, test } from '@playwright/test';
import { boot, diff, snap, SCENES } from './helpers';

for (const sc of SCENES)
  for (const t of [0, 1])
    for (const view of ['tabletop', 'top'] as const)
      for (const low of [true, false])
        for (const grid of ['square', 'hex'] as const)
          test(`grid only on floors — ${sc.scene}/${sc.level} t=${t}, ${view}, ${low ? 'low' : 'full'} walls, ${grid}`, async ({ page }) => {
            await boot(page, '', sc);
            await page.evaluate(({ view, low, t }) => { const m = (window as any).__mistlab; m.setT(t); m.setLowWalls(low); m.frame(view); }, { view, low, t });
            await page.evaluate((g) => (window as any).__mistlab.setGrid(g), grid);
            await snap(page, 'on');
            await page.evaluate(() => (window as any).__mistlab.setGrid('off'));
            await snap(page, 'off');
            await page.evaluate(() => (window as any).__mistlab.setRenderMode('floorMask'));
            await snap(page, 'mask');
            const r = await diff(page, 'on', 'off', 'mask');
            // Players' end with full-height walls at the tabletop angle: walls hide most of the one revealed room,
            // so fewer grid pixels show. The leak check below stays strict for every case.
            expect(r.changed, 'grid must actually draw').toBeGreaterThan(t ? 1500 : low || view === 'top' ? 120 : 30);
            // A real leak paints hundreds of pixels; ≤2 is MSAA fringe on sub-pixel geometry (chains, braces) at grazing angles.
            expect(r.outside, 'grid pixels outside visible floor').toBeLessThanOrEqual(2);
          });
