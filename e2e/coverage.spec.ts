import { expect, test } from '@playwright/test';
import { boot, diff, snap } from './helpers';

// Exercise the actual recompute -> saved history -> fog texture path without moving the party.
test('changing views does not explore closed rooms, alter player fog or grow saved history', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  const readCoverage = () => page.evaluate(() => {
    const app = (window as any).__mistlab.app;
    const cov = app.cur.coverage.get('ground');
    return {
      seen: cov.serialize().seen,
      saved: app.state.seen['m0-test-room/ground'],
      texture: Array.from(app.cur.covTex.get('ground').image.data),
      closedRoom: cov.state(52.5, 17.5),
      secretRoom: cov.state(20, -7.5),
      party: [...app.party.pos],
    };
  });
  const before = await readCoverage();
  expect(before.closedRoom).toBe(0);
  expect(before.secretRoom).toBe(0);
  expect(before.saved).toBe(before.seen);
  await snap(page, 'fog-before');
  await page.evaluate(() => {
    const app = (window as any).__mistlab.app;
    for (let i = 0; i < 25; i++) {
      app.setView('dm');
      app.setView('players');
    }
  });
  expect(await readCoverage()).toEqual(before);
  await snap(page, 'fog-after');
  expect((await diff(page, 'fog-before', 'fog-after')).changed).toBe(0);
  await page.evaluate(() => (window as any).__mistlab.app.flush());
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  expect(await readCoverage()).toEqual(before);
});
