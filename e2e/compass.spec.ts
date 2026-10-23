import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

const LONG = 300_000;
test('wheel input takes over north alignment without a positional glide', async ({page}) => {
  await open(page); await turnAway(page); await page.emulateMedia({reducedMotion:'no-preference'});
  const hit=await page.evaluate(()=>{
    const w=(window as any).__mistlab.app.world, canvas=w.renderer.domElement, r=canvas.getBoundingClientRect();
    w.alignNorth();
    const heading=w.controls.getAzimuthalAngle(), pitch=w.controls.getPolarAngle(), distance=w.camera.position.distanceTo(w.controls.target);
    canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));
    return {flying:w.flying,heading,pitch,distance,afterHeading:w.controls.getAzimuthalAngle(),afterPitch:w.controls.getPolarAngle(),afterDistance:w.camera.position.distanceTo(w.controls.target)};
  });
  expect(hit.flying).toBe(false);
  expect(hit.afterHeading).toBeCloseTo(hit.heading,7);
  expect(hit.afterPitch).toBeCloseTo(hit.pitch,7);
  expect(hit.afterDistance).toBeGreaterThan(hit.distance);
});
const settle = (page: Page) => page.waitForFunction(() => !(window as any).__mistlab.app.world.flying, undefined, { timeout: LONG });
async function open(page: Page, nested = true): Promise<void> {
  await quiet(page);
  await page.goto(`/?nosw&scene=appB/death-house${nested ? '' : '&nested=0'}`);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await settle(page);
}
const camera = (page: Page) => page.evaluate(() => {
  const a = (window as any).__mistlab.app, w = a.world;
  return { target: w.toAbsolute(w.controls.target).toArray() as number[], distance: w.camera.position.distanceTo(w.controls.target), pitch: w.controls.getPolarAngle(), north: a.cameraFrame().north, zoom: w.camera.zoom, fov: w.camera.fov };
});
/** Start at a nonzero heading without changing the current target, radius or pitch. */
async function turnAway(page: Page): Promise<void> {
  await page.evaluate(() => {
    const a = (window as any).__mistlab.app, w = a.world, offset = w.camera.position.clone().sub(w.controls.target);
    const angle = w.controls.getAzimuthalAngle() - a.cameraFrame().north + 1.4;
    const radius = Math.hypot(offset.x, offset.z);
    w.camera.position.copy(w.controls.target).add(offset.set(Math.sin(angle) * radius, offset.y, Math.cos(angle) * radius));
    w.controls.update(); w.invalidate();
  });
  expect(Math.abs((await camera(page)).north)).toBeGreaterThan(1);
}
async function checkAlignment(page: Page, activate: () => Promise<unknown>): Promise<void> {
  await turnAway(page);
  const before = await camera(page);
  await activate(); await settle(page);
  const after = await camera(page);
  expect(Math.abs(after.north), 'north is screen-up').toBeLessThan(0.00001);
  expect(Math.hypot(...after.target.map((v, i) => v - before.target[i])), 'target stayed at the same absolute world point').toBeLessThan(0.00001);
  expect(after.distance).toBeCloseTo(before.distance, 5);
  expect(after.pitch).toBeCloseTo(before.pitch, 7);
  expect(after.zoom).toBe(before.zoom); expect(after.fov).toBe(before.fov);
}
async function pressAt(page: Page, selector: string, touch: boolean): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toHaveRole('button'); await expect(button).toHaveAccessibleName('Align north');
  const rect = (await button.boundingBox())!;
  expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
  // Switching DM/Players changes the rose's safe area on the next rendered frame.
  // Let the real input action wait for a stable, unobstructed button instead of
  // clicking coordinates captured before that layout update.
  if (touch) await button.tap();
  else await button.click();
}

for (const device of [
  { name: 'desktop', touch: false, viewport: { width: 1366, height: 768 } },
  { name: 'phone', touch: true, viewport: { width: 390, height: 844 } },
]) test.describe(device.name, () => {
  test.use({ viewport: device.viewport, hasTouch: device.touch, isMobile: device.touch });
  test('local and world compasses align north in DM and Players views without moving or zooming', async ({ page }, testInfo) => {
    test.setTimeout(LONG); await open(page);
    const local = '.mapframe .compass';
    for (const view of ['dm', 'players']) {
      await page.evaluate((view) => (window as any).__mistlab.app.setView(view), view);
      await checkAlignment(page, async () => {
        if (view === 'dm') await page.screenshot({ path: testInfo.outputPath('local-before.png') });
        await pressAt(page, local, device.touch);
      });
      if (view === 'dm') await page.screenshot({ path: testInfo.outputPath('local-north.png') });
    }
    if (!device.touch) for (const key of ['Enter', 'Space']) {
      await page.locator(local).focus();
      await checkAlignment(page, () => page.keyboard.press(key));
    }
    await page.evaluate(() => (window as any).__mistlab.stage.cartoReady());
    await page.locator('[data-act="world"]').click(); await settle(page);
    await expect(page.locator('.carto-rose')).toBeEnabled();
    await expect(page.locator(local)).toBeHidden();
    for (const view of ['dm', 'players']) {
      await page.evaluate((view) => (window as any).__mistlab.app.setView(view), view);
      await checkAlignment(page, async () => {
        if (view === 'dm') await page.screenshot({ path: testInfo.outputPath('region-before.png') });
        await pressAt(page, '.carto-rose', device.touch);
      });
      if (view === 'dm') await page.screenshot({ path: testInfo.outputPath('region-north.png') });
    }
    if (!device.touch) for (const key of ['Enter', 'Space']) {
      await page.locator('.carto-rose').focus();
      await checkAlignment(page, () => page.keyboard.press(key));
    }
  });
});

test('the legacy rotated map compass uses local north; reduced motion completes immediately', async ({ page }) => {
  test.setTimeout(LONG); await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page, false);
  const north = await page.evaluate(() => (window as any).__mistlab.app.level.north);
  expect(north).toBe('-x');
  for (const key of ['Enter', 'Space']) {
    await page.locator('.mapframe .compass').focus();
    await checkAlignment(page, () => page.keyboard.press(key));
  }
  await turnAway(page);
  const immediate = await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    document.querySelector<HTMLButtonElement>('.mapframe .compass')!.click();
    return { flying: a.world.flying, north: a.cameraFrame().north };
  });
  expect(immediate.flying).toBe(false); expect(Math.abs(immediate.north)).toBeLessThan(0.00001);
});
