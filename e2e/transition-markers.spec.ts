import { expect, test, type Page } from '@playwright/test';
import { quiet, takeRoute } from './helpers';

async function boot(page: Page, path='appB/death-house') {
  await quiet(page); await page.goto(`/?nosw&scene=${path}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

test('shared Players landing exposes and activates both up and down choices by pointer', async ({page}) => {
  await boot(page);
  await page.evaluate(() => {const m=(window as any).__mistlab; m.moveParty('f2',27.5,27.5);m.app.setView('players');m.frame('top');});
  await takeRoute(page,'lk-spiral-2-3','from');
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f3');
  await takeRoute(page,'lk-spiral-2-3','to');
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  await takeRoute(page,'lk-spiral-1-2','to');
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f1');
});

test('same-level marker choices honor the clicked end rather than the party nearest end', async ({page}) => {
  await boot(page,'ch04/K');
  const expected = await page.evaluate(() => {
    const m=(window as any).__mistlab,a=m.app,k=a.cur.scene.links.find((k:any)=>k.id==='lk-k85');
    m.moveParty(k.from.level,...k.from.pos);a.jumpTo('K85');
    return {from:a.snap(k.from.pos),to:a.snap(k.to.pos)};
  });
  await takeRoute(page,'lk-k85','to');
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual(expected.from);
  await takeRoute(page,'lk-k85','from');
  expect(await page.evaluate(() => (window as any).__mistlab.partyPos())).toEqual(expected.to);
});

test('a concealed hatch stays unavailable in Players view until explicitly revealed', async ({page}) => {
  await boot(page);
  await page.evaluate(() => {
    const m=(window as any).__mistlab,a=m.app,k=a.cur.scene.links.find((k:any)=>k.id==='lk-trapdoor');
    const end=k.from.level==='f1'?k.from:k.to;
    m.moveParty('f1',...end.pos); a.setView('players'); m.frame('top');
  });
  const hatch=page.locator('.lbl.link[data-routes*="lk-trapdoor"]:visible');
  await expect(hatch).toHaveCount(0);
  // Reaching/revealing the room must not reveal the concealed hatch or allow automatic passage.
  expect(await page.evaluate(() => {const a=(window as any).__mistlab.app;a.afterPartyMoveFromUi();return a.party.level;})).toBe('f1');
  await page.evaluate(() => {const a=(window as any).__mistlab.app;a.toggleObject('f1-trapdoor');a.recompute();});
  await expect(hatch).toBeVisible();
});

test('unexplored ordinary routes stay hidden and an open chooser closes on view change', async ({page}) => {
  await boot(page);
  await page.evaluate(() => {const m=(window as any).__mistlab;m.moveParty('f2',27.5,27.5);m.frame('top');});
  const marker=page.locator('.lbl.link[data-routes~="lk-spiral-2-3:from"]:visible');
  await marker.click(); await expect(page.getByRole('menu',{name:'Choose route'})).toBeVisible();
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  await expect(page.getByRole('menu',{name:'Choose route'})).toHaveCount(0);
  await page.evaluate(() => {
    const a=(window as any).__mistlab.app,cov=a.cur.coverage.get(a.levelId);
    cov.seen.fill(0);cov.paint.fill(0);cov.visible.fill(0);a.applySlider();
  });
  await expect(page.locator('.lbl.link:visible')).toHaveCount(0);
});
