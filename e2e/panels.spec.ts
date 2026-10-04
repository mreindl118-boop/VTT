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

/** Every visible grip and chevron is what a tap at its centre lands on (nothing, such as the top bar's box, covers it). */
async function expectHandlesReachable(page: Page): Promise<void> {
  const covered = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.panel')].flatMap((p) => ['.pn-grip', '.pn-fold'].map((sel) => {
    const el = p.querySelector(sel)!, r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return at && el.contains(at) ? null : `${p.dataset.panel} ${sel} is under ${at?.className}`;
  })).filter(Boolean));
  expect(covered).toEqual([]);
}

/** Open each of the tools panel's menus and check it lies wholly inside the viewport. */
async function expectMenusOnScreen(page: Page, where: string): Promise<void> {
  const vw = page.viewportSize()!;
  for (const m of ['tools', 'view']) {
    const summary = page.locator(`details[data-menu="${m}"] > summary`);
    await summary.click();
    // the fit runs on the toggle event, a task after the click: poll until it has
    let b = { x: 0, y: 0, width: 0, height: 0 };
    await expect(async () => {
      b = (await page.locator(`details[data-menu="${m}"] > .menu-panel`).boundingBox())!;
      expect(b.x, `${m} menu left (${where})`).toBeGreaterThanOrEqual(0); expect(b.y, `${m} menu top (${where})`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${m} menu right (${where})`).toBeLessThanOrEqual(vw.width + 0.5); expect(b.y + b.height, `${m} menu bottom (${where})`).toBeLessThanOrEqual(vw.height + 0.5);
    }).toPass({ timeout: 15_000 });
    // every row spans the menu (a narrow-screen toolbar rule must not shrink them to icon width)
    const rows = await page.locator(`details[data-menu="${m}"] > .menu-panel > button.icon`).evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().width));
    for (const w of rows) expect(w, `${m} menu row width (${where})`).toBeGreaterThan(b.width - 24);
    // its last item is reachable: on screen, or the menu scrolls to it
    const last = page.locator(`details[data-menu="${m}"] > .menu-panel > :last-child`);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await summary.click();
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

test('a wrapping panel parked at the right edge keeps its shape through hide and show, fold and unfold, and a Players round trip', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  await dragByGrip(page, 'tools', 3000, 150);
  await dragByGrip(page, 'title', 3000, 300);
  const tools = await box(page, 'tools'), title = await box(page, 'title');
  expect(tools.x + tools.width).toBeCloseTo(1024, 0); expect(title.x + title.width).toBeCloseTo(1024, 0);
  expect(tools.height, 'the tools stay in a row').toBeLessThan(60); expect(title.height, 'the title stays in a row').toBeLessThan(60);
  const same = async (what: string) => {
    for (const [id, b] of [['tools', tools], ['title', title]] as const) {
      const now = await box(page, id);
      expect(now, `${id} ${what}`).toEqual(b);
    }
  };
  await page.keyboard.press('h'); await page.keyboard.press('h');
  await same('after hide and show');
  await page.locator('.seg.mode [data-view="players"]').click();
  await expect(page.locator('[data-panel="tools"]')).toBeHidden();
  await page.locator('.seg.mode [data-view="dm"]').click();
  await expect(page.locator('[data-panel="tools"]')).toBeVisible();
  await same('after DM, Players, DM');
  for (const id of ['tools', 'title']) {
    await page.locator(`[data-panel="${id}"] .pn-fold`).click();
    const pill = await box(page, id);
    expect(pill.x + pill.width, `${id} pill keeps its right edge`).toBeCloseTo(1024, 0); expect(pill.height).toBeLessThan(60);
    await page.locator(`[data-panel="${id}"] .pn-icon`).click();
  }
  await same('after fold and unfold');
  // hidden while the window changes: it comes back whole and still on its right edge
  await page.keyboard.press('h');
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(100);
  await page.keyboard.press('h');
  const narrow = await box(page, 'tools');
  expect(narrow.x + narrow.width).toBeCloseTo(900, 0); expect(narrow.width).toBeCloseTo(tools.width, 0); expect(narrow.height).toBeCloseTo(tools.height, 0);
  await reload(page);
  const again = await box(page, 'tools');
  expect(again.x + again.width).toBeCloseTo(900, 0); expect(again.width).toBeCloseTo(tools.width, 0);
});

test('the compass panel\'s controls are exposed to assistive tech: only the compass and scale bar are decorative', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const hiddenAncestor = await page.evaluate(() => [...document.querySelectorAll('[data-panel="compass"] button')].map((b) => !!b.closest('[aria-hidden="true"]')));
  expect(hiddenAncestor).toEqual([false, false, false]);
  await expect(page.locator('.mapframe .compass')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.mapframe .scalebar')).toHaveAttribute('aria-hidden', 'true');
});

test('every grip and chevron takes its own taps on a short desktop window (the top bar box lets them through)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await boot(page, '', SCENES[1]);
  await expectHandlesReachable(page);
  // the view rail's grip drags and its chevron folds
  const v0 = await box(page, 'view');
  await dragByGrip(page, 'view', -200, 100);
  const v1 = await box(page, 'view');
  expect(v1.x).toBeLessThan(v0.x - 150);
  await page.locator('[data-panel="view"] .pn-fold').click();
  await expect(page.locator('[data-panel="view"]')).toHaveAttribute('data-collapsed', '1');
});

test('every folded pill shows its own icon', async ({ page }) => {
  await boot(page, '', SCENES[1]);
  const icons = await page.evaluate(() => [...document.querySelectorAll('.panel > .pn-icon')].map((i) => i.innerHTML));
  expect(icons.length).toBe(7);
  expect(new Set(icons).size, 'no two pills look alike').toBe(icons.length);
});

test('the tools menus open onto the screen wherever the tools panel is parked', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, '', SCENES[1]);
  await expectMenusOnScreen(page, 'default');
  await dragByGrip(page, 'tools', 3000, 3000);
  await expect(page.locator('[data-panel="tools"]')).toHaveAttribute('data-ay', 'b');
  await expectMenusOnScreen(page, 'bottom right');
  await dragByGrip(page, 'tools', -3000, 0);
  await expect(page.locator('[data-panel="tools"]')).toHaveAttribute('data-ax', 'l');
  await expectMenusOnScreen(page, 'bottom left');
  await dragByGrip(page, 'tools', 0, -3000);
  await expectMenusOnScreen(page, 'top left');
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
    // the title, parked at the right edge, keeps its full row across hide and show and a reload
    await touchDragByGrip(page, 'title', 300, 200);
    const title = await box(page, 'title');
    expect(title.x + title.width).toBeCloseTo(390, 0); expect(title.height).toBeLessThan(60);
    await page.keyboard.press('h'); await page.keyboard.press('h');
    expect(await box(page, 'title')).toEqual(title);
    await reload(page);
    expect(await box(page, 'title')).toEqual(title);
    expect((await box(page, 'camera')).y).toBeCloseTo(after.y, 0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mistlab.layout.')))).toEqual(['mistlab.layout.phone']);
    // turning the phone (now wider than the phone class) switches to the desktop layout, which is untouched:
    // the toolbar goes back to its CSS place (the resize event comes with the next frame, which a busy software-GL
    // renderer can hold back for several seconds, hence the long wait)
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('[data-panel="camera"]')).not.toHaveAttribute('data-placed', '1', { timeout: 30_000 });
    await expect(page.locator('[data-panel="minimap"]')).not.toHaveAttribute('data-collapsed', '1');
    await expectAllOnScreen(page);
  });
  test('every grip and chevron takes its own taps; the view rail drags by finger and folds; menus stay on screen', async ({ page }) => {
    await boot(page, '', SCENES[1]);
    await expectHandlesReachable(page);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(100);
    await expectHandlesReachable(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const v0 = await box(page, 'view');
    await touchDragByGrip(page, 'view', -150, 120);
    const v1 = await box(page, 'view');
    expect(v1.x).toBeCloseTo(v0.x - 150, 0); expect(v1.y).toBeCloseTo(v0.y + 120, 0);
    await page.locator('[data-panel="view"] .pn-fold').tap();
    await expect(page.locator('[data-panel="view"]')).toHaveAttribute('data-collapsed', '1');
    await expectMenusOnScreen(page, 'default');
    await touchDragByGrip(page, 'tools', 400, 900);
    await expectMenusOnScreen(page, 'bottom right');
    await touchDragByGrip(page, 'tools', -400, 0);
    await expectMenusOnScreen(page, 'bottom left');
  });
});
