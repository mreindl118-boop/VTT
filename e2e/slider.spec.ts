// Acceptance: DM/Player slider (docs/SLIDER.md), on the test room and on Death House.
import { expect, test } from '@playwright/test';
import { boot, diff, snap, SCENES } from './helpers';

for (const sc of SCENES) {
  test(`${sc.scene}/${sc.level}: t = 0 renders a secret door pixel-identical to plain wall`, async ({ page }) => {
    await boot(page, '', sc);
    for (const view of ['tabletop', 'top'] as const)
      for (const low of [true, false]) {
        await page.evaluate(({ low, view }) => { const m = (window as any).__mistlab; m.setLowWalls(low); m.frame(view); m.setT(0); }, { low, view });
        await snap(page, 'secret');
        await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
        await snap(page, 'wall');
        await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(false));
        expect((await diff(page, 'secret', 'wall')).changed, `${view} ${low}`).toBe(0);
      }
    // …and it is not identical once the slider rises (so the test can fail).
    await page.evaluate(() => (window as any).__mistlab.setT(1));
    await snap(page, 'secret1');
    await page.evaluate(() => (window as any).__mistlab.setSecretAsWall(true));
    await snap(page, 'wall1');
    expect((await diff(page, 'secret1', 'wall1')).changed).toBeGreaterThan(50);
  });

  test(`${sc.scene}/${sc.level}: t = 1 shows every area key label and hidden object`, async ({ page }) => {
    await boot(page, '', sc);
    await page.evaluate(() => { const m = (window as any).__mistlab; m.setLabels('all'); m.setT(1); });
    const labels = await page.evaluate(() => (window as any).__mistlab.labels());
    const keys = labels.filter((l: any) => l.id.startsWith('key:')).map((l: any) => l.id);
    for (const k of sc.keys) expect(keys).toContain(k);
    for (const l of labels.filter((l: any) => l.vis === 'dm-note')) expect(l, l.id).toMatchObject({ visible: true, opacity: 1 });
    const targets = await page.evaluate(() => (window as any).__mistlab.targets());
    expect(targets.length).toBeGreaterThanOrEqual(3);
    for (const t of targets) expect(t, t.id).toMatchObject({ visible: true, opacity: 1 });
  });

  test(`${sc.scene}/${sc.level}: t = 0.5 renders hidden classes at partial opacity; t = 0 hides them`, async ({ page }) => {
    await boot(page, '', sc);
    await page.evaluate(() => (window as any).__mistlab.setT(0.5));
    for (const t of await page.evaluate(() => (window as any).__mistlab.targets())) {
      expect(t.visible, t.id).toBe(true);
      expect(t.opacity, t.id).toBeGreaterThan(0.05);
      expect(t.opacity, t.id).toBeLessThan(0.95);
    }
    await page.evaluate(() => (window as any).__mistlab.setT(0));
    for (const t of await page.evaluate(() => (window as any).__mistlab.targets())) expect(t.visible, t.id).toBe(false);
    for (const l of (await page.evaluate(() => (window as any).__mistlab.labels())).filter((l: any) => l.vis === 'dm-note')) expect(l.visible, l.id).toBe(false);
  });

  test(`${sc.scene}/${sc.level}: the Player Display never changes with the DM slider and has no DM UI`, async ({ context }) => {
    const dm = await context.newPage();
    await boot(dm, '', sc);
    await dm.evaluate(() => (window as any).__mistlab.setT(0));
    const player = await context.newPage();
    await boot(player, '&display=player', sc);
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

  test(`${sc.scene}/${sc.level}: reveals reach the Player Display and persist across reload`, async ({ context }) => {
    const dm = await context.newPage();
    await boot(dm, '', sc);
    const player = await context.newPage();
    await boot(player, '&display=player', sc);
    await player.waitForTimeout(200);
    const visible = (p: typeof dm, id: string) => p.evaluate((id) => (window as any).__mistlab.targets().find((t: any) => t.id === id).visible, id);
    expect(await visible(player, sc.hidden)).toBe(false);
    await dm.evaluate(async ({ hidden, room, secret }) => { const a = (window as any).__mistlab.app; a.toggleObject(hidden); a.toggleRoom(room); a.revealSecretDoor(secret); await a.flush(); }, sc);
    await player.waitForTimeout(300);
    expect(await visible(player, sc.hidden)).toBe(true);
    await dm.reload();
    await dm.waitForFunction(() => (window as any).__mistlab?.ready);
    await dm.evaluate(() => (window as any).__mistlab.ready);
    await dm.evaluate((level) => { const a = (window as any).__mistlab.app; if (a.levelId !== level) a.setLevel(level, true); }, sc.level);
    const rev = await dm.evaluate(() => (window as any).__mistlab.app.state.reveals.map((r: any) => r.type).sort());
    expect(rev).toEqual(['object', 'room', 'secret-door']);
    await dm.evaluate(() => (window as any).__mistlab.setT(0));
    expect(await visible(dm, sc.hidden)).toBe(true);
    await dm.evaluate(() => (window as any).__mistlab.app.undo());
    expect(await dm.evaluate(() => (window as any).__mistlab.app.state.reveals.length)).toBe(2);
  });
}
