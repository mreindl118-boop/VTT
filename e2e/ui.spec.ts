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
