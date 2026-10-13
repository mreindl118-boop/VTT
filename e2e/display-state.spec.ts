import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function display(page: Page) {
  await quiet(page);
  await page.addInitScript(() => {
    (window as any).__puts = [];
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      (window as any).__puts.push({ key, id: value?.id, name: value?.name });
      return put.call(this, value, key);
    };
  });
  await page.goto('/?nosw&display=player&scene=ch03/E');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.channel.bc?.close(); // deterministic messages below, without another open DM tab
    a.state.name = 'committed CoS';
    (window as any).__puts.length = 0;
  });
}
const snapshot = (page: Page) => page.evaluate(() => {
  const a = (window as any).__mistlab.app;
  return { path: a.cur.path, campaign: a.campaign.id, state: structuredClone(a.state), nested: a.nested, from: a.enteredFrom ?? null };
});
test.beforeEach(async ({ page }) => { await display(page); });
test.setTimeout(120_000);

test('a failed display campaign load preserves its committed map, state and navigation settings', async ({ page }) => {
  const before = await snapshot(page);
  await page.evaluate(async () => {
    const a = (window as any).__mistlab.app, load = a.load;
    a.load = async () => { throw new Error('controlled unavailable scene'); };
    try {
      await a.onMsg({ kind: 'state', location: 'wsc/01-tavern', nested: false,
        from: { parent: 'wsc/01-tavern', child: 'wsc/02-road', level: 'ground', key: '1' },
        state: { ...structuredClone(a.state), id: 'wsc', name: 'rejected WSC', tokens: [], reveals: [] } });
    } finally { a.load = load; }
  });
  expect(await snapshot(page)).toEqual(before);
});

for (const location of ['ch02/G', 'ch03/E']) {
  test(`newer display state for ${location} wins over an older delayed campaign load`, async ({ page }) => {
    await page.evaluate(() => {
      const w = window as any, a = w.__mistlab.app, load = a.load.bind(a);
      w.__load = load;
      a.load = async (path: string, ...args: any[]) => {
        if (path === 'wsc/01-tavern') { w.__held = true; await new Promise<void>((r) => { w.__release = r; }); }
        return load(path, ...args);
      };
      w.__older = a.onMsg({ kind: 'state', location: 'wsc/01-tavern', nested: true,
        state: { ...structuredClone(a.state), id: 'wsc', name: 'older WSC', tokens: [], reveals: [] } });
    });
    await page.waitForFunction(() => (window as any).__held);
    await page.evaluate(async (location) => {
      const a = (window as any).__mistlab.app;
      await a.onMsg({ kind: 'state', location, nested: true,
        state: { ...structuredClone(a.state), name: 'newest CoS', tokens: [], reveals: [] } });
    }, location);
    const newest = await snapshot(page);
    expect(newest.path).toBe(location);
    expect(newest.campaign).toBe('cos');
    expect(newest.state.name).toBe('newest CoS');
    await page.evaluate(async () => { const w = window as any; w.__release(); await w.__older; w.__mistlab.app.load = w.__load; });
    expect(await snapshot(page)).toEqual(newest);
  });
}

test('the Player Display never saves received campaign state on a campaign switch', async ({ page }) => {
  await page.evaluate(async () => {
    const a = (window as any).__mistlab.app;
    a.state.name = 'display-only received state';
    await a.open('wsc/01-tavern');
    await a.open('ch03/E');
  });
  expect(await page.evaluate(() => (window as any).__puts)).toEqual([]);
});
