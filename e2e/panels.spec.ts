// Movable panels: every floating piece of the DM UI drags by its grip, folds to a pill, hides with the tab or H,
// and the arrangement is kept per viewport class (phone / desktop) across reloads. Reset layout restores the defaults.
import { expect, test, type Page } from '@playwright/test';
import { boot, SCENES } from './helpers';

const PANELS = ['title', 'floors', 'tools', 'view', 'camera', 'minimap', 'compass'];
const box = async (page: Page, id: string) => (await page.locator(`[data-panel="${id}"]`).boundingBox())!;

/** Drag a panel by its grip with the mouse (a 4 px threshold separates a drag from a tap). */
async function dragByGrip(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const g = (await page.locator(`[data-panel="${id}"] .pn-grip`).boundingBox())!;
  const x = g.x + g.width / 2, y = g.y + g.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 6, y + 6); await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

/** The same with a finger: real touch events through CDP, so pointer capture and touch-action are exercised.
 *  The moves are paced like a finger and the finger rests before lifting: an instantaneous release reads as a
 *  fling to Chromium, which then swallows the next tap to stop it. */
async function touchDragByGrip(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const g = (await page.locator(`[data-panel="${id}"] .pn-grip`).boundingBox())!;
  const x = g.x + g.width / 2, y = g.y + g.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) { await page.waitForTimeout(30); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] }); }
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

/** Every panel lies inside the viewport. */
async function expectAllOnScreen(page: Page): Promise<void> {
  const vw = page.viewportSize()!;
  for (const id of PANELS) {
    const b = await box(page, id);
    expect(b.x, `${id} left`).toBeGreaterThanOrEqual(0); expect(b.y, `${id} top`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${id} right`).toBeLessThanOrEqual(vw.width + 0.5); expect(b.y + b.height, `${id} bottom`).toBeLessThanOrEqual(vw.height + 0.5);
  }
}

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

test('every panel has a focusable, labelled grip and chevron, and the old selectors still resolve', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  for (const id of PANELS) {
    const p = page.locator(`[data-panel="${id}"]`);
    await expect(p).toBeVisible();
    await expect(p.locator('.pn-grip')).toHaveAttribute('aria-label', /Move the .* panel/);
    await expect(p.locator('.pn-fold')).toHaveAttribute('aria-label', /Fold the .* panel/);
    const g = (await p.locator('.pn-grip').boundingBox())!;
    expect(Math.min(g.width, g.height), `${id} grip is finger-sized`).toBeGreaterThanOrEqual(24);
  }
  for (const sel of ['.topbar .group.left', '.topbar .group.center select.levels', '.topbar .group.right', '.vslider .vs-track', '.camcluster [data-cam="rotL"]', '.minimap .clock', '.mapframe .compass'])
    await expect(page.locator(sel), sel).toBeVisible();
});

test('drag a panel by its grip: it moves, stays inside the viewport, and the place survives a reload', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const before = await box(page, 'tools');
  await dragByGrip(page, 'tools', -400, 250);
  const after = await box(page, 'tools');
  expect(after.x).toBeCloseTo(before.x - 400, 0); expect(after.y).toBeCloseTo(before.y + 250, 0);
  // the tools still work where the panel now stands
  await page.locator('[data-panel="tools"] [data-act="rooms"]').click();
  await expect(page.locator('aside.rooms')).toBeVisible();
  await page.locator('aside.rooms .close').click();
  // a drag past the edge is clamped
  await dragByGrip(page, 'camera', 3000, 3000);
  await expectAllOnScreen(page);
  const cam = await box(page, 'camera');
  expect(cam.x + cam.width).toBeCloseTo(1024, 0); expect(cam.y + cam.height).toBeCloseTo(768, 0);
  await reload(page);
  const again = await box(page, 'tools');
  expect(again.x).toBeCloseTo(after.x, 0); expect(again.y).toBeCloseTo(after.y, 0);
  const camAgain = await box(page, 'camera');
  expect(camAgain.x + camAgain.width).toBeCloseTo(1024, 0);
  // the layout is kept for this viewport class only
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mistlab.layout.')))).toEqual(['mistlab.layout.desktop']);
});

test('the grip takes the keyboard: arrow keys nudge the panel', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const before = await box(page, 'camera');
  await page.locator('[data-panel="camera"] .pn-grip').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
  const after = await box(page, 'camera');
  expect(after.x).toBeCloseTo(before.x + 20, 0); expect(after.y).toBeCloseTo(before.y - 10, 0);
  await page.keyboard.press('Shift+ArrowUp');
  expect((await box(page, 'camera')).y).toBeCloseTo(before.y - 50, 0);
});

test('fold a panel to its pill and unfold it; the fold is remembered', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const floors = page.locator('[data-panel="floors"]');
  const open = (await floors.boundingBox())!;
  await floors.locator('.pn-fold').click();
  await expect(floors).toHaveAttribute('data-collapsed', '1');
  await expect(floors.locator('select.levels')).toBeHidden();
  await expect(floors.locator('.pn-icon')).toBeVisible();
  await expect(floors.locator('.pn-fold')).toHaveAttribute('aria-expanded', 'false');
  const pill = (await floors.boundingBox())!;
  expect(pill.width).toBeLessThan(open.width / 3);
  await reload(page);
  await expect(page.locator('[data-panel="floors"]')).toHaveAttribute('data-collapsed', '1');
  await page.locator('[data-panel="floors"] .pn-icon').click();
  await expect(page.locator('[data-panel="floors"]')).not.toHaveAttribute('data-collapsed', '1');
  await expect(page.locator('[data-panel="floors"] select.levels')).toBeVisible();
  // the minimap folds too, and its tap-to-look canvas goes with it
  await page.locator('[data-panel="minimap"] .pn-fold').click();
  await expect(page.locator('.minimap canvas')).toBeHidden();
  await page.locator('[data-panel="minimap"] .pn-icon').click();
  await expect(page.locator('.minimap canvas')).toBeVisible();
});

test('hide every panel with H or the tab, show them again; the state is kept', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  await page.keyboard.press('h');
  await expect(page.locator('body')).toHaveAttribute('data-ui-hidden', '');
  for (const id of PANELS) await expect(page.locator(`[data-panel="${id}"]`)).toBeHidden();
  const tab = page.locator('[data-act="ui-toggle"]');
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await reload(page);
  await expect(page.locator('[data-panel="tools"]')).toBeHidden();
  await page.locator('[data-act="ui-toggle"]').click();
  await expect(page.locator('body')).not.toHaveAttribute('data-ui-hidden', '');
  for (const id of PANELS) await expect(page.locator(`[data-panel="${id}"]`)).toBeVisible();
  // the View menu has the same switch
  await page.locator('details[data-menu="view"] summary').click();
  await page.locator('[data-act="ui-hide"]').click();
  await expect(page.locator('[data-panel="tools"]')).toBeHidden();
  await page.keyboard.press('H');
  await expect(page.locator('[data-panel="tools"]')).toBeVisible();
});

test('Reset layout in the View menu puts every panel back and unfolds it', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const home = await box(page, 'tools');
  await dragByGrip(page, 'tools', -300, 200);
  await page.locator('[data-panel="minimap"] .pn-fold').click();
  await page.locator('details[data-menu="view"] summary').click();
  await page.locator('[data-act="layout-reset"]').click();
  const back = await box(page, 'tools');
  expect(back.x).toBeCloseTo(home.x, 0); expect(back.y).toBeCloseTo(home.y, 0);
  await expect(page.locator('[data-panel="minimap"]')).not.toHaveAttribute('data-collapsed', '1');
  expect(await page.evaluate(() => localStorage.getItem('mistlab.layout.desktop'))).toBeNull();
});

test('a panel parked at the edge stays on screen when the window shrinks', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  await dragByGrip(page, 'tools', 3000, 400);
  const parked = await box(page, 'tools');
  expect(parked.x + parked.width).toBeCloseTo(1024, 0);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(100);
  await expectAllOnScreen(page);
  const shrunk = await box(page, 'tools');
  expect(shrunk.x + shrunk.width).toBeCloseTo(800, 0); // it keeps its right-edge anchor
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('defaults keep the picture clear: floors, minimap and frame folded, the toolbar open, nothing off screen', async ({ page }) => {
    await boot(page, '', SCENES[1]);
    for (const id of ['floors', 'minimap', 'compass']) await expect(page.locator(`[data-panel="${id}"]`)).toHaveAttribute('data-collapsed', '1');
    for (const id of ['camera', 'tools', 'title', 'view']) await expect(page.locator(`[data-panel="${id}"]`)).not.toHaveAttribute('data-collapsed', '1');
    await expect(page.locator('.camcluster [data-cam="help"]')).toBeVisible();
    await expectAllOnScreen(page);
    // the toolbar fits in one row
    const cam = await box(page, 'camera');
    expect(cam.height).toBeLessThan(60);
  });

  test('a finger drags a panel and the phone keeps its own layout', async ({ page }) => {
    await boot(page, '', SCENES[1]);
    const before = await box(page, 'camera');
    await touchDragByGrip(page, 'camera', 0, -300);
    const after = await box(page, 'camera');
    expect(after.y).toBeCloseTo(before.y - 300, 0);
    expect(after.x).toBeCloseTo(before.x, 0);
    await expectAllOnScreen(page);
    // a tap on the pill (touch) unfolds the minimap
    await page.locator('[data-panel="minimap"] .pn-icon').tap();
    await expect(page.locator('[data-panel="minimap"]')).not.toHaveAttribute('data-collapsed', '1');
    await reload(page);
    expect((await box(page, 'camera')).y).toBeCloseTo(after.y, 0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mistlab.layout.')))).toEqual(['mistlab.layout.phone']);
    // turning the phone (now wider than the phone class) switches to the desktop layout, which is untouched:
    // the toolbar goes back to its CSS place (the resize event lands a moment after the viewport changes)
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('[data-panel="camera"]')).not.toHaveAttribute('data-placed', '1');
    await expect(page.locator('[data-panel="minimap"]')).not.toHaveAttribute('data-collapsed', '1');
    await expectAllOnScreen(page);
  });
});
