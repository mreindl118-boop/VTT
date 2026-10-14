import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function boot(page: Page) {
  await quiet(page);
  await page.goto('/?nosw&scene=appB/death-house');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

async function place(page: Page, level: string, x: number) {
  await page.evaluate(({ level, x }) => {
    const m = (window as any).__mistlab;
    m.moveParty(level, x, 27.5);
    m.app.setView('dm');
    m.app.setLevel('f1');
  }, { level, x });
}

async function menuMove(page: Page, x: number, touch = false) {
  // Supply the room hit to the production menu callback; the action itself must be
  // reached by a real actionable button, without calling the dispatcher directly.
  await page.evaluate(x => {
    const a = (window as any).__mistlab.app;
    const room = a.level.rooms.find((r: any) => r.key === '2A');
    a.onTap({ pos: [x, 27.5], room: a.tapRoom(room, false) }, 100, 240);
  }, x);
  const action = page.locator('.tapmenu').getByRole('button', { name: 'Move party here', exact: true });
  if (touch) await action.tap(); else await action.click();
  await expect(page.locator('.tapmenu')).toHaveCount(0);
}

async function pose(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    return { level: a.party.level, visible: a.levelId, pos: a.party.pos };
  });
}

test('DM room-menu no-op on a stair landing does not change floors', async ({ page }) => {
  await boot(page);
  await place(page, 'f1', 27.5);
  await menuMove(page, 27.5);
  expect(await pose(page)).toEqual({ level: 'f1', visible: 'f1', pos: [27.5, 27.5] });
});

test('DM room-menu departure inside the trigger radius does not climb the stair', async ({ page }) => {
  await boot(page);
  await place(page, 'f1', 27.5);
  await menuMove(page, 22.5);
  expect(await pose(page)).toEqual({ level: 'f1', visible: 'f1', pos: [22.5, 27.5] });
});

test('DM room-menu entry from outside the trigger takes exactly one hop', async ({ page }) => {
  await boot(page);
  await place(page, 'f1', 17.5);
  await menuMove(page, 22.5);
  expect(await pose(page)).toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
});

test('DM room-menu cross-floor placement is not mistaken for a same-position no-op', async ({ page }) => {
  await boot(page);
  await place(page, 'f3', 27.5);
  await menuMove(page, 27.5);
  expect(await pose(page)).toEqual({ level: 'f2', visible: 'f2', pos: [27.5, 27.5] });
});

test('phone DM room-menu touch preserves a landing then allows departure', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await boot(page);
    await place(page, 'f1', 27.5);
    await menuMove(page, 27.5, true);
    expect(await pose(page)).toEqual({ level: 'f1', visible: 'f1', pos: [27.5, 27.5] });
    await menuMove(page, 22.5, true);
    expect(await pose(page)).toEqual({ level: 'f1', visible: 'f1', pos: [22.5, 27.5] });
  } finally { await context.close(); }
});
