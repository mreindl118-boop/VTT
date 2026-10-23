import { expect, test } from '@playwright/test';
import { boot, quiet, SCENES } from './helpers';

test.beforeEach(async ({ page }) => {
  await quiet(page);
  await boot(page, '', { ...SCENES[1], scene: 'ch03/E', level: 'village', spawn: [185, 309] });
});

for (const audience of ['players', 'preview'] as const) {
  test(`wilderness does not name an unrevealed landmark in ${audience}`, async ({ page }) => {
    await page.evaluate(async () => {
      const m = (window as any).__mistlab, k = m.pins().find((p: any) => p.key === 'K');
      await m.nest.showCard(undefined, [k.pos[0] + 0.5, k.pos[1]], 2);
    });
    await expect(page.locator('.nestcard .wc-where')).toContainText('Castle Ravenloft');
    await page.evaluate((audience) => {
      const m = (window as any).__mistlab;
      if (audience === 'players') m.app.setView('players'); else m.setT(0);
      m.app.world.renderNow();
    }, audience);
    await expect(page.locator('.nestcard .wc-where')).not.toContainText('Castle Ravenloft');
    await expect(page.locator('.nestcard')).toBeVisible();
  });
  test(`an open world card immediately loses DM content in ${audience}`, async ({ page }) => {
    await page.evaluate(async () => {
      const m = (window as any).__mistlab;
      m.app.revealPin('G', true);
      const p = m.pins().find((p: any) => p.key === 'G');
      await m.nest.showCard(p, p.pos, 2.7);
    });
    await expect(page.locator('.nestcard .wc-dm')).toBeVisible();
    await page.evaluate((audience) => {
      const m = (window as any).__mistlab;
      (window as any).__staleReveal = document.querySelector('.nestcard [data-reveal]');
      if (audience === 'players') m.app.setView('players'); else m.setT(0);
      m.app.world.renderNow();
    }, audience);
    await expect(page.locator('.nestcard .wc-dm')).toHaveCount(0);
    await expect(page.locator('.nestcard [data-reveal]')).toHaveCount(0);
    if (audience === 'players') await expect(page.locator('.nestcard [data-scene]')).toHaveCount(0);
    // A saved stale action reinserted before dispatch must not authorize a mutation.
    await page.evaluate(() => {
      const b = (window as any).__staleReveal as HTMLElement;
      document.querySelector('.nestcard')!.append(b); b.click(); b.remove();
    });
    expect(await page.evaluate(() => (window as any).__mistlab.app.pinsRevealed.has('G'))).toBe(true);
  });
}

test('a dismissed wilderness card cannot reopen after its asynchronous render', async ({ page }) => {
  const hidden = await page.evaluate(async () => {
    const m = (window as any).__mistlab;
    const pending = m.nest.showCard(undefined, [11.1, 9.14], 3.35);
    m.nest.leave();
    await pending;
    return m.nest.card.hidden;
  });
  expect(hidden).toBe(true);
});

test('Escape cancels a pending card before it becomes visible', async ({ page }) => {
  await page.evaluate(() => {
    const m = (window as any).__mistlab, n = m.nest;
    n.h.sceneName = () => new Promise<string>((resolve) => { (window as any).__releaseName = resolve; });
    const p = m.pins().find((p: any) => p.key === 'G');
    (window as any).__pendingCard = n.showCard(p, p.pos, 2);
  });
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { (window as any).__releaseName('Tser Pool'); await (window as any).__pendingCard; });
  await expect(page.locator('.nestcard')).toBeHidden();
});

test('every Barovian atlas key has a marker, including the four mountain marks', async ({ page }) => {
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  const keys = await page.locator('.lbl.place').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key).sort());
  const pins = await page.evaluate(() => (window as any).__mistlab.pins().map((p: any) => p.key).sort());
  expect(keys).toEqual(pins);
  expect(keys).toEqual(expect.arrayContaining(['M2', 'M3', 'M4', 'M5']));
});

test('the full Sheep Chase title fits on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?nosw&scene=wsc/02-street');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  await page.evaluate(async () => { await (window as any).__mistlab.stage.cartoReady(); await document.fonts.ready; });
  await page.waitForTimeout(300);
  const r = await page.locator('.carto-title .ct-name').boundingBox();
  expect(r).not.toBeNull();
  expect(r!.x).toBeGreaterThanOrEqual(0);
  expect(r!.x + r!.width).toBeLessThanOrEqual(390);
});

test('a newer request for the same pin wins when names resolve out of order', async ({ page }) => {
  await page.evaluate(async () => {
    const m = (window as any).__mistlab, n = m.nest;
    const original = n.h.sceneName;
    const p = m.pins().find((p: any) => p.key === 'G');
    let release!: (s: string) => void;
    n.h.sceneName = () => new Promise<string>((resolve) => { release = resolve; });
    const first = n.showCard(p, p.pos, 9);
    n.h.sceneName = original;
    await n.showCard(p, p.pos, 2);
    release('Tser Pool Encampment'); await first;
  });
  await expect(page.locator('.nestcard .wc-travel')).toContainText('2.0 mi');
});

test('the player preview removes unknown places and reveal controls immediately', async ({ page }) => {
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  await page.click('.nestbar [data-places]');
  await expect(page.locator('.nestkey [data-reveal]')).not.toHaveCount(0);
  await page.evaluate(() => (window as any).__mistlab.setT(0));
  await expect(page.locator('.nestkey [data-reveal]')).toHaveCount(0);
  await expect(page.locator('.nestkey li[data-key="K"]')).toHaveCount(0);
  await expect(page.locator('.lbl.place[data-key="K"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mistlab.stage.proxies.get('ch04/K').visible)).toBe(false);
});

test('party travel uses the release position even without a final pointermove', async ({ page }) => {
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  await page.evaluate(() => (window as any).__mistlab.stage.cartoReady());
  const center = async (selector: string) => {
    const b = await page.locator(selector).boundingBox();
    expect(b).not.toBeNull();
    return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
  };
  const party = await center('.lbl.world-party');
  const g = await center('.lbl.place[data-key="G"] .pk');
  const k = await center('.lbl.place[data-key="K"] .pk');
  await page.mouse.move(party.x, party.y); await page.mouse.down();
  await page.mouse.move(g.x, g.y, { steps: 8 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: k.x, y: k.y, button: 'left', clickCount: 1 });
  expect(await page.evaluate(() => (window as any).__mistlab.app.state.world.key)).toBe('K');
});

test('Places can open a place card using the keyboard', async ({ page }) => {
  await page.click('[data-act="world"]');
  await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
  await page.click('.nestbar [data-places]');
  const place = page.locator('.nestkey li[data-key="G"]').getByRole('button', { name: 'Tser Pool Encampment', exact: true });
  await place.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.nestcard')).toContainText('Tser Pool Encampment');
});
