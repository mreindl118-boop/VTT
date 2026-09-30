// UI hygiene: opening another location clears the previous one's labels; hover names things on the DM side.
import { expect, test } from '@playwright/test';
import { boot, SCENES } from './helpers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

test('a new location wipes the old labels and door icons', async ({ page }) => {
  await boot(page, '', SCENES[1]); // Death House
  await page.evaluate(() => (window as any).__mistlab.setT(1));
  expect(await page.locator('.lbl', { hasText: 'Library' }).count()).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__mistlab.app.open('dev/m0-test-room'));
  await page.waitForTimeout(300);
  expect(await page.locator('.lbl', { hasText: 'Library' }).count()).toBe(0);
  const n = await page.evaluate(() => (window as any).__mistlab.app.cur.labels.length);
  expect(await page.locator('.labels .lbl').count()).toBeLessThanOrEqual(n); // hidden labels are never in the page
});

test('DM hover names what is under the cursor', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  const [x, y] = await page.evaluate(() => (window as any).__mistlab.screenOf(52.5, 17.5)); // floor of T2
  await page.mouse.move(x - 20, y); await page.mouse.move(x, y, { steps: 3 });
  await expect(page.locator('.tip')).toBeVisible();
  await expect(page.locator('.tip b')).toContainText('T2');
});

test('containers: players cannot open locked ones; the DM can, and opening reveals what is inside', async ({ page }) => {
  await boot(page, '', { ...SCENES[1], level: 'f1', spawn: [12.5, 47.5] });
  const r = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, key = (id: string) => a.state.opened[`death-house/${id}`];
    a.setView('players');
    const lockedByPlayers = a.toggleOpen('f1-cab-e');
    const unlockedByPlayers = a.toggleOpen('f1-cab-n');
    a.setView('dm');
    const byDm = a.toggleOpen('f1-cab-e');
    const crossbowsRevealed = a.state.reveals.some((x: any) => x.type === 'object' && x.id === 'f1-cab-lock');
    return { lockedByPlayers, unlockedByPlayers, byDm, crossbowsRevealed, east: key('f1-cab-e'), north: key('f1-cab-n') };
  });
  expect(r).toEqual({ lockedByPlayers: false, unlockedByPlayers: true, byDm: true, crossbowsRevealed: true, east: true, north: true });
});

test('world map: the party marker follows the scene, drags to a pin, and opens that pin\'s map', async ({ page }) => {
  await boot(page, '', SCENES[1]); // Death House lies in the village (pin E)
  expect(await page.evaluate(() => (window as any).__mistlab.app.state.world?.key)).toBe('E');
  await page.click('[data-act="world"]');
  const from = (await page.locator('.wm-party').boundingBox())!, to = (await page.locator('.wm-pin.t-camp').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2 + 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('.world-card')).toContainText('Tser Pool Encampment');
  expect(await page.evaluate(() => (window as any).__mistlab.app.state.world.key)).toBe('G');
  await page.locator('.world-card [data-scene="ch02/G"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__mistlab.app.cur?.path)).toBe('ch02/G');
});
