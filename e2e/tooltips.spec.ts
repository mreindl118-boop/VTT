// Tier A tips and the tooltip manager (docs/CLARITY.md 'The shared tooltip component'), on the desktop, iPad and
// phone projects: names on every icon button, hover timing, the held tip on touch, the one outside handler, the Esc
// stack, hygiene, view flips and the Player Display.
import { expect, test, type Page } from '@playwright/test';
import { SCENES, touchHold, quiet } from './helpers';

const DH = { scene: 'appB/death-house', level: 'f1', spawn: [12.5, 27.5], keys: [], secret: '', hidden: '', room: '2A' };

async function open(page: Page, scene = DH, query = ''): Promise<void> {
  await quiet(page);
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene.scene)}${query}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(({ level, spawn }) => { const m = (window as any).__mistlab; m.moveParty(level, spawn[0], spawn[1]); m.app.frameLevel(); }, scene);
}
const touchProject = (name: string) => name === 'ipad' || name === 'phone';
/** A tap the way this project's people tap: a finger on the touch projects, the mouse on the desktop. */
async function tapAt(page: Page, x: number, y: number, touch: boolean): Promise<void> {
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function tapEl(page: Page, sel: string, touch: boolean): Promise<void> {
  const b = (await page.locator(sel).first().boundingBox())!;
  await tapAt(page, b.x + b.width / 2, b.y + Math.min(b.height / 2, 14), touch);
}
/** Milliseconds from the mouse entering an element to its hover tip appearing (measured in the page). */
async function hoverDelay(page: Page, sel: string): Promise<number> {
  await page.mouse.move(2, 400);
  await page.evaluate((sel) => {
    const w = window as any; w.__tipAt = 0; w.__overAt = 0;
    document.querySelector(sel)!.addEventListener('pointerover', () => { w.__overAt ||= performance.now(); });
    new MutationObserver(() => { if (!w.__tipAt && document.querySelector('#tips .tip.hover')) w.__tipAt = performance.now(); }).observe(document.getElementById('tips')!, { childList: true });
  }, sel);
  const b = (await page.locator(sel).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => (window as any).__tipAt > 0, null, { timeout: 3000 });
  return page.evaluate(() => (window as any).__tipAt - (window as any).__overAt);
}
const tipsEmpty = (page: Page) => page.evaluate(() => document.getElementById('tips')!.children.length === 0);

test('every icon button has a name and a tip, and no native title is left in #ui or #tips', async ({ page }) => {
  await open(page);
  // open the surfaces that carry icon buttons too: the rooms sheet and the clock
  await page.evaluate(() => { (document.querySelector('[data-act="rooms"]') as HTMLElement).click(); (document.querySelector('[data-act="clock"]') as HTMLElement).click(); });
  const sweep = () => page.evaluate(() => {
    const bad = [...document.querySelectorAll<HTMLElement>('#ui button.icon, #ui summary.icon')].filter((b) => !b.getAttribute('aria-label')?.trim() || !b.dataset.tip?.trim()).map((b) => b.outerHTML.slice(0, 80));
    const titles = document.querySelectorAll('#ui [title], #tips [title]').length;
    return { count: document.querySelectorAll('#ui button.icon, #ui summary.icon').length, bad, titles };
  });
  const dm = await sweep();
  expect(dm.count).toBeGreaterThan(30);
  expect(dm.bad).toEqual([]);
  expect(dm.titles).toBe(0);
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  expect((await sweep()).titles).toBe(0);
});

test('mouse hover shows a tip after 500 ms (never before 350), focus shows it at once, Esc hides it', async ({ page }, info) => {
  test.skip(touchProject(info.project.name), 'mouse and keyboard');
  await open(page);
  const lib = (await page.locator('[data-act="library"]').boundingBox())!;
  const dt = await hoverDelay(page, '[data-act="library"]');
  await expect(page.locator('#tips .tip.hover')).toHaveText('Library');
  expect(dt).toBeGreaterThanOrEqual(400);
  expect(dt).toBeLessThanOrEqual(600);
  await page.mouse.move(5, 400);
  await expect(page.locator('#tips .tip.hover')).toHaveCount(0);
  // keyboard: focus shows the tip at once (and its shortcut chip, once a key has been pressed)
  await page.keyboard.press('Shift');
  await page.evaluate(() => (document.querySelector('[data-act="search"]') as HTMLElement).focus());
  await expect(page.locator('#tips .tip.hover')).toHaveText('Go to area/', { timeout: 150 });
  await expect(page.locator('#tips .tip.hover kbd')).toHaveText('/');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tips .tip.hover')).toHaveCount(0);
  // the hover tip never reaches the description before 350 ms
  await page.mouse.move(lib.x + lib.width / 2, lib.y + lib.height / 2);
  await page.waitForTimeout(340);
  await expect(page.locator('#tips .tip.hover')).toHaveCount(0);
});

test('touch: a held press on Zoom in shows its name and release zooms exactly like a tap; holding peek shows no tip', async ({ page }, info) => {
  test.skip(!touchProject(info.project.name), 'touch projects');
  await open(page);
  // The camera glides (420 ms): read the distance once the glide has landed.
  const dist = async () => { await page.waitForFunction(() => !(window as any).__mistlab.app.world.tween, null, { timeout: 10_000 }); return page.evaluate(() => { const w = (window as any).__mistlab.app.world; return w.camera.position.distanceTo(w.controls.target); }); };
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.follow = false; m.app.world.zoomBy(1.4); });
  // (On the phone the map frame's compass sits over the camera buttons, so the phone holds a top-bar button instead.)
  if (info.project.name === 'phone') {
    let held = '';
    await touchHold(page, '[data-act="rooms"]', 600, async () => { held = (await page.locator('#tips .tip.hover').count()) ? (await page.locator('#tips .tip.hover').textContent()) ?? '' : ''; });
    expect(held).toBe('Rooms');
    await expect(page.locator('aside.rooms')).toHaveCount(1);
    await expect(page.locator('#tips .tip')).toHaveCount(0);
  } else {
  const d0 = await dist();
  await page.locator('[data-cam="zoomIn"]').tap();
  const d1 = await dist();
  expect(d1 / d0).toBeCloseTo(0.78, 2);
  let tipText = '';
  await touchHold(page, '[data-cam="zoomIn"]', 600, async () => { tipText = (await page.locator('#tips .tip.hover').count()) ? (await page.locator('#tips .tip.hover').textContent()) ?? '' : ''; });
  const d2 = await dist();
  expect(tipText).toBe('Zoom in');
  expect(d2 / d1).toBeCloseTo(0.78, 2);
  await expect(page.locator('#tips .tip')).toHaveCount(0);
  // a short tap shows no tip
  await page.locator('[data-cam="zoomOut"]').tap();
  await expect(page.locator('#tips .tip')).toHaveCount(0);
  }
  // hold to peek: it peeks, and shows no tip
  await page.evaluate(() => (window as any).__mistlab.setT(0));
  let peeked = '', tips = -1;
  if (await page.locator('.vs-peek').isVisible()) {
    await touchHold(page, '.vs-peek', 700, async () => { await expect.poll(() => page.locator('.vslider').getAttribute('data-t')).toBe('1.00'); peeked = (await page.locator('.vslider').getAttribute('data-t')) ?? ''; tips = await page.locator('#tips .tip').count(); });
    expect(peeked).toBe('1.00');
    expect(tips).toBe(0);
  }
});

test('hybrid touch and mouse: a touch tap pins a toggletip that stays open, a mouse hover opens it after 400-500 ms', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'desktop with a touchscreen');
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await open(page);
  await page.evaluate(() => document.querySelector('.topbar .group.left')!.insertAdjacentHTML('beforeend', '<button type="button" class="tt" id="t-tt" data-tip="A test toggletip">p.216</button>'));
  await page.locator('#t-tt').tap();
  await expect(page.locator('#tips .tip.pinned')).toContainText('A test toggletip');
  await page.waitForTimeout(1000);
  await expect(page.locator('#tips .tip.pinned')).toBeVisible();
  await expect(page.locator('#t-tt')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#t-tt').tap();
  await expect(page.locator('#tips .tip')).toHaveCount(0);
  const dt = await hoverDelay(page, '#t-tt');
  await expect(page.locator('#tips .tip.hover')).toContainText('A test toggletip');
  expect(dt).toBeGreaterThanOrEqual(400);
  expect(dt).toBeLessThanOrEqual(500 + 100);
  await ctx.close();
});

test('one outside handler: menu, chip, inside the tip, chip, map — three times, with the same map tap as before', async ({ page }, info) => {
  const touch = touchProject(info.project.name);
  await open(page);
  await page.evaluate(() => (window as any).__mistlab.app.setLevel('f1'));
  await page.evaluate(() => (window as any).__mistlab.frame('top'));
  const [x, y] = await page.evaluate(() => (window as any).__mistlab.screenOf(15, 25));
  const [x2, y2] = await page.evaluate(() => (window as any).__mistlab.screenOf(12.5, 17.5));
  const menuTitle = () => page.evaluate(() => document.querySelector('.tapmenu .rh-title')?.textContent ?? null);
  // Before any tip: what a map tap does while the 2A menu is open (the menu closes, and the tap opens 2B's).
  await tapAt(page, x, y, touch);
  await expect(page.locator('.tapmenu')).toHaveCount(1);
  const first = await menuTitle();
  expect(first).toContain('2A');
  await page.waitForTimeout(400);
  await tapAt(page, x2, y2, touch);
  await page.waitForTimeout(400);
  const baseline = await menuTitle();
  expect(baseline).toContain('2B');
  for (let i = 0; i < 3; i++) {
    // outside the menu and off the map: the DM tab, already on (the title is no longer plain text: in the valley its
    // crumbs are buttons that frame their scopes, and a finger near them presses one)
    await tapEl(page, '.topbar [data-view="dm"]', touch);
    await expect(page.locator('.tapmenu')).toHaveCount(0);
    await page.waitForTimeout(400);
    await tapAt(page, x, y, touch);
    await expect(page.locator('.tapmenu')).toHaveCount(1);
    const menu = await page.evaluateHandle(() => document.querySelector('.tapmenu'));
    await page.evaluate(() => document.querySelector('.tapmenu .roomhead')!.insertAdjacentHTML('beforeend', '<button type="button" class="tt" id="t-chip" data-tip="Test: page 216 of the module">p.216</button>'));
    await tapEl(page, '#t-chip', touch);
    await expect(page.locator('#tips .tip.pinned')).toBeVisible();
    await tapEl(page, '#tips .tip.pinned b', touch);
    await expect(page.locator('#tips .tip.pinned')).toBeVisible();
    expect(await menu.evaluate((m) => (m as Element).isConnected)).toBe(true);
    await tapEl(page, '#t-chip', touch);
    await expect(page.locator('#tips .tip')).toHaveCount(0);
    expect(await menu.evaluate((m) => (m as Element).isConnected)).toBe(true);
    await page.waitForTimeout(400);
    await tapAt(page, x2, y2, touch);
    await page.waitForTimeout(400);
    expect(await menu.evaluate((m) => (m as Element).isConnected)).toBe(false);
    expect(await menuTitle()).toBe(baseline);
  }
});

test('Esc stack: a pinned tip closes first, then Esc stops the tool; with nothing open Esc is as before', async ({ page }) => {
  await open(page);
  const placing = () => page.evaluate(() => !!(window as any).__mistlab.app.placing);
  await page.evaluate(() => (window as any).__mistlab.app.startPlacing('wolf'));
  expect(await placing()).toBe(true);
  await page.evaluate(() => document.querySelector('.topbar .group.left')!.insertAdjacentHTML('beforeend', '<button type="button" class="tt" id="t-tt" data-tip="A test toggletip">p.216</button>'));
  await page.locator('#t-tt').click();
  await expect(page.locator('#tips .tip.pinned')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tips .tip')).toHaveCount(0);
  expect(await placing()).toBe(true);
  await page.keyboard.press('Escape');
  expect(await placing()).toBe(false);
  // nothing open: one Esc stops placing at once, as before
  await page.evaluate(() => (window as any).__mistlab.app.startPlacing('wolf'));
  await page.keyboard.press('Escape');
  expect(await placing()).toBe(false);
  // a rules card is on the stack too
  await page.evaluate(() => (window as any).__mistlab.app.startPlacing('wolf'));
  await page.evaluate(() => (window as any).__mistlab.tips.openCard({ term: 'condition:prone' }).then(() => true));
  await expect(page.locator('#tips .rt')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tips .rt')).toHaveCount(0);
  expect(await placing()).toBe(true);
});

test('hygiene: no hover tip once the tap menu is open, none from the previous floor after a floor change', async ({ page }, info) => {
  test.skip(touchProject(info.project.name), 'hover is a mouse thing');
  await open(page);
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.setLevel('f1'); m.frame('top'); });
  const [x, y] = await page.evaluate(() => (window as any).__mistlab.screenOf(15, 25));
  await page.mouse.move(x, y); await page.mouse.move(x + 2, y + 1);
  await expect(page.locator('#tips .tip.canvas')).toBeVisible();
  await page.mouse.click(x + 2, y + 1);
  await expect(page.locator('.tapmenu')).toHaveCount(1);
  await page.mouse.move(x + 6, y + 3);
  await page.waitForTimeout(200);
  await expect(page.locator('#tips .tip')).toHaveCount(0);
  await page.mouse.click(...(await page.locator('.topbar .title').boundingBox().then((b) => [b!.x + 4, b!.y + 4] as [number, number])));
  await expect(page.locator('.tapmenu')).toHaveCount(0);
  await page.mouse.move(x, y); await page.mouse.move(x + 2, y + 2);
  await expect(page.locator('#tips .tip.canvas')).toBeVisible();
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.setLevel('f2'); });
  await expect(page.locator('#tips .tip')).toHaveCount(0);
});

test('view flips empty #tips: the slider to Players, peek released, and the mode switch', async ({ page }, info) => {
  const touch = touchProject(info.project.name);
  await open(page);
  const openDmCard = () => page.evaluate(() => (window as any).__mistlab.tips.openCard({ term: 'monster:ghoul' }).then((e: unknown) => !!e));
  await openDmCard();
  await expect(page.locator('#tips .rt.monster')).toBeVisible();
  // the slider dragged to Players (keyboard here, so the drag itself does not close the card first)
  await page.evaluate(() => (document.querySelector('.vs-track') as HTMLElement).focus());
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
  expect(await page.locator('.vslider').getAttribute('data-t')).toBe('0.00');
  expect(await tipsEmpty(page)).toBe(true);
  // peek held: open a DM card, release: back to Players and #tips is empty
  // (the slider glides by animation frames: Death House in its village can take seconds a frame on a software renderer)
  const t = () => page.locator('.vslider').getAttribute('data-t');
  await page.keyboard.down('\\');
  await expect.poll(t, { timeout: 30_000 }).toBe('1.00');
  await openDmCard();
  await expect(page.locator('#tips .rt')).toBeVisible();
  await page.keyboard.up('\\');
  await expect.poll(t, { timeout: 30_000 }).toBe('0.00');
  expect(await tipsEmpty(page)).toBe(true);
  // the mode switch
  await page.evaluate(() => (window as any).__mistlab.setT(1));
  await openDmCard();
  await expect(page.locator('#tips .rt')).toBeVisible();
  await tapEl(page, '[data-view="players"]', touch);
  await page.waitForTimeout(200);
  expect(await tipsEmpty(page)).toBe(true);
  // and on the players' side, a monster card is never built
  expect(await page.evaluate(() => (window as any).__mistlab.tips.openCard({ term: 'monster:ghoul' }).then((e: unknown) => !!e))).toBe(false);
  expect(await tipsEmpty(page)).toBe(true);
});

test('a DM card still loading when the view flips to Players never mounts (slider and mode switch)', async ({ context }, info) => {
  const touch = touchProject(info.project.name);
  for (const how of ['slider', 'mode'] as const) {
    const page = await context.newPage();
    // Hold the books data back so the card is still being built when the view flips.
    await page.route('**/books/**', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
    await open(page);
    await page.evaluate(() => { (window as any).__pending = (window as any).__mistlab.tips.openCard({ term: 'monster:ghoul' }).then((e: unknown) => !!e); });
    await page.waitForTimeout(300);
    if (how === 'slider') {
      await page.evaluate(() => (document.querySelector('.vs-track') as HTMLElement).focus());
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
      expect(await page.locator('.vslider').getAttribute('data-t')).toBe('0.00');
    } else await tapEl(page, '[data-view="players"]', touch);
    expect(await page.evaluate(() => (window as any).__pending)).toBe(false);
    await page.waitForTimeout(200);
    expect(await tipsEmpty(page)).toBe(true);
    expect(await page.locator('.rt, .seal, .statblock').count()).toBe(0);
    await page.close();
  }
});

test('the Player Display has no #tips, never requests the card or emblem code, and has no rules links or cards', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'desktop');
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(`/?nosw&display=player&scene=${encodeURIComponent(SCENES[1].scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.waitForTimeout(1500);
  expect(await page.locator('#tips').count()).toBe(0);
  expect(await page.locator('.rl, .rt').count()).toBe(0);
  expect(urls.filter((u) => /rulecard|emblems|tooltip|\/fonts\//.test(u))).toEqual([]);
});
