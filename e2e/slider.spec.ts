// Acceptance: DM/Player slider (docs/SLIDER.md).
import { expect, test } from '@playwright/test';
import { boot, diff, snap } from './helpers';

test('t = 0: a secret door renders pixel-identical to plain wall', async ({ page }) => {
  await boot(page);
  for (const low of [true, false]) {
    await page.evaluate((low) => { const m = (window as any).__mistlab; m.setLowWalls(low); m.setT(0); }, low);
    await snap(page, 'secret');
    await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
    await snap(page, 'wall');
    await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(false));
    expect((await diff(page, 'secret', 'wall')).changed).toBe(0);
  }
  // …and it is not identical once the slider rises (the test can fail).
  await page.evaluate(() => (window as any).__mistlab.setT(1));
  await snap(page, 'secret1');
  await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
  await snap(page, 'wall1');
  expect((await diff(page, 'secret1', 'wall1')).changed).toBeGreaterThan(50);
});

test('t = 1: every area key label and hidden object is visible', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__mistlab.setT(1));
  const labels = await page.evaluate(() => (window as any).__mistlab.labels());
  const keys = labels.filter((l: any) => l.id.startsWith('key:'));
  expect(keys.map((l: any) => l.id).sort()).toEqual(['key:T1', 'key:T2', 'key:T3']);
  for (const l of labels.filter((l: any) => l.vis === 'dm-note')) expect(l, l.id).toMatchObject({ visible: true, opacity: 1 });
  const targets = await page.evaluate(() => (window as any).__mistlab.targets());
  expect(targets.length).toBeGreaterThanOrEqual(3);
  for (const t of targets) expect(t, t.id).toMatchObject({ visible: true, opacity: 1 });
});

test('t = 0.5: hidden classes render at partial opacity; t = 0 hides them', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__mistlab.setT(0.5));
  for (const t of await page.evaluate(() => (window as any).__mistlab.targets())) {
    expect(t.visible).toBe(true);
    expect(t.opacity).toBeGreaterThan(0.05);
    expect(t.opacity).toBeLessThan(0.95);
  }
  await page.evaluate(() => (window as any).__mistlab.setT(0));
  for (const t of await page.evaluate(() => (window as any).__mistlab.targets())) expect(t.visible, t.id).toBe(false);
  for (const l of (await page.evaluate(() => (window as any).__mistlab.labels())).filter((l: any) => l.vis === 'dm-note')) expect(l.visible, l.id).toBe(false);
});

test('Player Display never changes with the DM slider and has no DM UI', async ({ context }) => {
  const dm = await context.newPage();
  await boot(dm);
  await dm.evaluate(() => (window as any).__mistlab.setT(0));
  const player = await context.newPage();
  await boot(player, '&display=player');
  await player.waitForTimeout(300);
  await snap(player, 'p0');
  for (const t of [0.5, 1]) {
    await dm.evaluate((t) => (window as any).__mistlab.setT(t), t);
    await player.waitForTimeout(300);
    await snap(player, `p${t}`);
    expect((await diff(player, 'p0', `p${t}`)).changed, `player changed at DM t=${t}`).toBe(0);
  }
  await expect(player.locator('.vslider')).toHaveCount(0);
  await expect(player.locator('.topbar')).toHaveCount(0);
  expect(await player.evaluate(() => (window as any).__mistlab.labels().filter((l: any) => l.vis === 'dm-note').length)).toBe(0);
});

test('reveals reach the Player Display and persist across reload', async ({ context }) => {
  const dm = await context.newPage();
  await boot(dm);
  const player = await context.newPage();
  await boot(player, '&display=player');
  await player.waitForTimeout(200);
  const chestVisible = (p: typeof dm) => p.evaluate(() => (window as any).__mistlab.targets().find((t: any) => t.id === 'ob-t2-chest').visible);
  expect(await chestVisible(player)).toBe(false);
  await dm.evaluate(async () => { const a = (window as any).__mistlab.app; a.toggleObject('ob-t2-chest'); a.toggleRoom('T2'); a.revealSecretDoor('sd-t1-t3'); await a.flush(); });
  await player.waitForTimeout(300);
  expect(await chestVisible(player)).toBe(true);
  await dm.reload();
  await dm.waitForFunction(() => (window as any).__mistlab?.ready);
  await dm.evaluate(() => (window as any).__mistlab.ready);
  const rev = await dm.evaluate(() => (window as any).__mistlab.app.state.reveals.map((r: any) => r.type).sort());
  expect(rev).toEqual(['object', 'room', 'secret-door']);
  await dm.evaluate(() => (window as any).__mistlab.setT(0));
  expect(await chestVisible(dm)).toBe(true);
  // Undo pops the log.
  await dm.evaluate(() => (window as any).__mistlab.app.undo());
  expect(await dm.evaluate(() => (window as any).__mistlab.app.state.reveals.length)).toBe(2);
});
