import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function boot(page: Page) {
  await quiet(page);
  await page.goto('/?nosw&scene=appB/death-house');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

test('the Floor 2 stair marker takes one hop, persists it, and does not bounce on a no-op move', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const m = (window as any).__mistlab;
    m.moveParty('f1', 25.5, 27.5);
    m.app.frameLevel('top');
  });
  const marker = page.locator('.lbl.link').filter({ hasText: 'Floor 2' });
  // Click the actual marker listener, independent of the camera's label occlusion.
  await marker.evaluate((el: HTMLElement) => el.click());
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  expect(await page.evaluate(() => (window as any).__mistlab.app.levelId)).toBe('f2');
  await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.moveTokenTo(a.party.id, [...a.party.pos]);
  });
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  await expect(page.locator('.status')).toContainText('Floor 2');
  await page.evaluate(() => (window as any).__mistlab.flush());
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.moveTokenTo(a.party.id, [...a.party.pos]);
  });
  expect(await page.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  const walkOff = await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.setView('players');
    const moved = a.moveTokenTo(a.party.id, [22.5, 27.5]);
    return { moved, pos:a.party.pos, level:a.party.level };
  });
  expect(walkOff).toEqual({ moved:true, pos:[22.5,27.5], level:'f2' });
});

test('an explicit shared-endpoint link goes to its selected floor in either direction', async ({ page }) => {
  await boot(page);
  const actual = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f2', 25.5, 27.5);
    a.takeLink('lk-spiral-2-3');
    const up = { party: a.party.level, visible: a.levelId };
    a.takeLink('lk-spiral-2-3');
    return { up, down: { party: a.party.level, visible: a.levelId } };
  });
  expect(actual).toEqual({ up: { party: 'f3', visible: 'f3' }, down: { party: 'f2', visible: 'f2' } });
});

test('walking onto stairs stops on the next floor and walking off the landing does not reverse it', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f1', 17.5, 27.5);
    a.setView('players');
    const moved = a.moveTokenTo(a.party.id, [27.5, 27.5]);
    const arrival = a.party.level;
    const left = a.moveTokenTo(a.party.id, [22.5, 27.5]);
    return { moved, arrival, left, final: a.party.level };
  });
  expect(result).toEqual({ moved: true, arrival: 'f2', left: true, final: 'f2' });
});

test('the Amber fissure arrives on its walkable authored landing', async ({ page }) => {
  await quiet(page);
  await page.goto('/?nosw&scene=ch13/X');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  const result = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    const link = a.cur.scene.links.find((k: any) => k.id === 'X-fissure');
    m.moveParty(link.from.level, ...link.from.pos);
    a.setView('players');
    a.takeLink(link.id);
    const arrival = { level: a.party.level, pos: [...a.party.pos] };
    const moved = a.moveTokenTo(a.party.id, [27, 255.5]);
    return { arrival, moved, final: a.party.level };
  });
  expect(result).toEqual({ arrival: { level: 'upper', pos: [24.5, 258] }, moved: true, final: 'upper' });
});

test('all 346 production link directions reach the requested destination in the running app', async ({ page }) => {
  test.setTimeout(240_000);
  await quiet(page);
  await page.goto('/?nosw&scene=appB/death-house&nested=0');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  const paths: string[] = await page.evaluate(() => (window as any).__mistlab.scenes().filter((p: string) => !p.startsWith('dev/')));
  const failures: unknown[] = []; let checked = 0, wrongLevels = 0, multiple = 0;
  for (const path of paths) {
    const result = await page.evaluate(async path => {
      const a = (window as any).__mistlab.app;
      await a.open(path);
      a.autoReveal = false; a.follow = false;
      const failures: unknown[] = []; let checked = 0, wrongLevels = 0, multiple = 0;
      for (const k of a.cur.scene.links) for (const [from, to] of [[k.from, k.to], [k.to, k.from]]) {
        a.party.level = from.level; a.party.pos = [...from.pos]; a.setLevel(from.level);
        const setLevel = a.setLevel, transitions: string[] = [];
        a.setLevel = function (id: string, ...args: any[]) { transitions.push(id); return setLevel.call(this, id, ...args); };
        try { a.takeLink(k.id); } finally { a.setLevel = setLevel; }
        const distance = Math.hypot(a.party.pos[0] - to.pos[0], a.party.pos[1] - to.pos[1]);
        if (a.party.level !== to.level) wrongLevels++;
        if (transitions.length > 1) multiple++;
        if (a.party.level !== to.level || a.levelId !== to.level || distance > Math.SQRT2 * 2.5 + 1e-6 || transitions.length !== 1) {
          failures.push({ path, id: k.id, from: from.level, expected: to, actual: { level:a.party.level, pos:a.party.pos }, visible:a.levelId, transitions });
        }
        checked++;
      }
      return { checked, failures, wrongLevels, multiple };
    }, path);
    checked += result.checked; failures.push(...result.failures); wrongLevels += result.wrongLevels; multiple += result.multiple;
  }
  expect(checked).toBe(346);
  console.log(JSON.stringify({ checked, wrongLevels, multiple, failures }));
  expect(failures).toEqual([]);
});

test('the Player Display follows a stair arrival and cannot dispatch its own link', async ({ page, context }) => {
  await boot(page);
  const player = await context.newPage();
  await quiet(player);
  await player.goto('/?nosw&display=player&scene=appB/death-house');
  await player.waitForFunction(() => (window as any).__mistlab?.ready);
  await player.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => {
    const m = (window as any).__mistlab;
    m.moveParty('f1', 25.5, 27.5);
    m.app.takeLink('lk-spiral-1-2');
  });
  await expect.poll(() => player.evaluate(() => ({ party:(window as any).__mistlab.app.party?.level, visible:(window as any).__mistlab.app.levelId }))).toEqual({ party:'f2', visible:'f2' });
  await player.evaluate(() => (window as any).__mistlab.app.takeLink('lk-spiral-2-3'));
  expect(await player.evaluate(() => (window as any).__mistlab.app.party.level)).toBe('f2');
  await player.close();
});
