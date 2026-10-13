// The "What's new" card: once after each update, on the DM's window only, and again from Help.
import { expect, test } from '@playwright/test';
import { VERSION } from './helpers';

const SCENE = 'dev/m0-test-room';
const open = async (page: import('@playwright/test').Page, query = '') => {
  await page.goto(`/?nosw&scene=${encodeURIComponent(SCENE)}${query}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
};

test('a returning user sees the card once after an update, then not again until the next version', async ({ page }) => {
  // The init script runs on every load: it only plants the old version the first time, so the reload below sees what the card stored.
  await page.addInitScript(() => { localStorage.setItem('mistlab.helpSeen', '1'); if (!localStorage.getItem('mistlab.seenVersion')) localStorage.setItem('mistlab.seenVersion', '0.0.1'); });
  await open(page);
  const card = page.locator('.sheet.whatsnew');
  await expect(card).toBeVisible();
  await expect(card.locator('h2')).toContainText(`mistLAB ${VERSION}`);
  await expect(card.locator('.eyebrow')).toHaveText("What's new");
  expect(await card.locator('.sheet-body li, .sheet-body p').count()).toBeGreaterThan(0);
  await card.getByRole('button', { name: "Let's play" }).click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mistlab.seenVersion'))).toBe(VERSION);
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await expect(page.locator('.sheet.whatsnew')).toHaveCount(0);
});

test('the first run ever shows Help, not the card, and counts the version as seen', async ({ page }) => {
  await open(page);
  await expect(page.locator('.sheet.help')).toBeVisible();
  await expect(page.locator('.sheet.whatsnew')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mistlab.seenVersion'))).toBe(VERSION);
});

test('Help reopens the card; closing it with Escape dismisses it', async ({ page }) => {
  await page.addInitScript((v) => { localStorage.setItem('mistlab.helpSeen', '1'); localStorage.setItem('mistlab.seenVersion', v); }, VERSION);
  await open(page);
  await expect(page.locator('.sheet.whatsnew')).toHaveCount(0);
  await page.locator('[data-cam="help"]').click();
  await page.locator('.sheet.help .whatsnew-link').click();
  await expect(page.locator('.sheet.whatsnew')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet.whatsnew')).toHaveCount(0);
});

test('the Player Display never shows the card', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('mistlab.helpSeen', '1'); localStorage.setItem('mistlab.seenVersion', '0.0.1'); });
  await open(page, '&display=player');
  await page.waitForTimeout(500);
  await expect(page.locator('.sheet.whatsnew')).toHaveCount(0);
});
