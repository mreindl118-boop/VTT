// Moving the party: tap the token, then tap the destination. On the players' side walls and closed doors stop it.
import { expect, test } from '@playwright/test';
import { boot, SCENES } from './helpers';

const tapAt = async (page: import('@playwright/test').Page, x: number, z: number, y = 0) => {
  const [sx, sy] = await page.evaluate(({ x, z, y }) => (window as any).__mistlab.screenOf(x, z, y), { x, z, y });
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(400); // clear the double-tap window
};

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

test('players: tap to select, walls block, open door lets the party through', async ({ page }) => {
  await boot(page, '', SCENES[0]); // test room: party at 22.5,17.5 in T1; T2 is east behind a closed door
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.setView('players'); m.frame('top'); });
  await tapAt(page, 22.5, 17.5, 1);
  expect(await page.evaluate(() => (window as any).__mistlab.app.selected)).toBeTruthy();
  await tapAt(page, 52.5, 17.5);
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([22.5, 17.5]);
  await expect(page.locator('.status')).toContainText('No way through');

  // A blocked move keeps the token picked up, so the next tap can try again.
  expect(await page.evaluate(() => (window as any).__mistlab.app.selected)).toBeTruthy();
  await page.evaluate(() => (window as any).__mistlab.app.toggleDoor('d-t1-t2'));
  await tapAt(page, 52.5, 17.5);
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([52.5, 17.5]);
  expect(await page.evaluate(() => (window as any).__mistlab.app.selected)).toBeNull();
});

test('DM view moves freely; a swipe from the token never moves it', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  const [sx, sy] = await page.evaluate(() => (window as any).__mistlab.screenOf(22.5, 17.5, 1));
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 120, sy, { steps: 6 }); await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([22.5, 17.5]);
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  await tapAt(page, 22.5, 17.5, 1);
  await tapAt(page, 52.5, 17.5); // closed door, but the DM may place the party anywhere
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual([52.5, 17.5]);
});
