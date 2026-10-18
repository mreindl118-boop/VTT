import { expect, test, type Page } from '@playwright/test';
import { boot, quiet, SCENES } from './helpers';

const village = { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] as [number, number] };
async function map(page: Page): Promise<void> {
  await quiet(page);
  await boot(page, '', village);
  await page.evaluate(async () => {
    const m = (window as any).__mistlab;
    await m.stage.cartoReady(); m.stage.frameWorld(false, true); m.render();
    await document.fonts.ready;
  });
  // The CSS labels are measured after the renderer and the bundled fonts have laid them out.
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as any).__mistlab.render());
  await page.waitForTimeout(100);
}

for (const size of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`all 32 place discs remain visible and selectable at ${size.width}px region fit`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size); await map(page);
    const pins = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.lbl.place')].map((el) => {
      const disc = el.querySelector<HTMLElement>('.pk')!, r = disc.getBoundingClientRect();
      const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      return { key: el.dataset.key, visible: disc.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        hit: (window as any).__mistlab.stage.pinAt(x, y)?.key, onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    expect(pins).toHaveLength(32);
    expect(pins.filter((p) => !p.visible || !p.onScreen || p.hit !== p.key)).toEqual([]);
    const crowded = page.locator('.lbl.place.dot').first(), disc = await crowded.locator('.pk').boundingBox();
    expect(disc).not.toBeNull();
    await page.mouse.move(disc!.x + disc!.width / 2, disc!.y + disc!.height / 2);
    await expect(page.locator('.nesttip')).toBeVisible();
    await expect(page.locator('.nesttip')).toContainText((await crowded.getAttribute('data-name'))!);
  });
}

test('land lettering uses its intended face, size and weight', async ({ page }) => {
  test.setTimeout(180_000); await page.setViewportSize({ width: 1920, height: 1080 }); await map(page);
  const styles = () => page.evaluate(() => ['peak', 'wood', 'lake', 'river'].map((kind) => {
    const c = getComputedStyle(document.querySelector(`.lbl.carto.${kind} span`)!);
    return { kind, size: parseFloat(c.fontSize), weight: c.fontWeight, opacity: c.opacity, family: c.fontFamily };
  }));
  expect(await styles()).toEqual([
    { kind: 'peak', size: 13, weight: '600', opacity: '1', family: 'Alegreya, Georgia, serif' },
    { kind: 'wood', size: 14, weight: '700', opacity: '1', family: '"Alegreya SC", Georgia, serif' },
    { kind: 'lake', size: 15, weight: '600', opacity: '1', family: 'Alegreya, Georgia, serif' },
    { kind: 'river', size: 13, weight: '600', opacity: '1', family: 'Alegreya, Georgia, serif' },
  ]);
});

for (const [width, height, minimum] of [[1920, 1080, 24], [1280, 720, 18]]) {
  test(`Player Display land names meet the ${minimum}px minimum at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000); await page.setViewportSize({ width, height }); await map(page);
    await page.evaluate(() => { document.body.dataset.mode = 'player'; });
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.lbl.carto span')].map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((size) => size < minimum)).toEqual([]);
  });
}

test('clicking a hovered place clears its tooltip through the flight and after arrival', async ({ page }) => {
  test.setTimeout(180_000); await page.setViewportSize({ width: 1366, height: 768 }); await map(page);
  const disc = (await page.locator('.lbl.place[data-key="G"] .pk').boundingBox())!;
  await page.mouse.move(disc.x + disc.width / 2, disc.y + disc.height / 2);
  await expect(page.locator('.nesttip')).toBeVisible();
  await page.mouse.click(disc.x + disc.width / 2, disc.y + disc.height / 2);
  await expect(page.locator('.nesttip')).toBeHidden();
  await page.waitForFunction(() => {
    const a = (window as any).__mistlab.app; return a.cur.path === 'ch02/G' && !a.world.flying;
  }, undefined, { timeout: 60_000 });
  await expect(page.locator('.nesttip')).toBeHidden();
});
