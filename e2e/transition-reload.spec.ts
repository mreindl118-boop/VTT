import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function boot(page: Page, display = false) {
  await quiet(page);
  await page.goto(`/?nosw&scene=appB/death-house${display ? '&display=player' : ''}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

test('reload restores the saved party floor in the enabled Floor control', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const m = (window as any).__mistlab;
    // Fixture only: the pointer/touch journeys separately prove stair approach and return.
    m.moveParty('f2', 17.5, 27.5);
    await m.flush();
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  const floor = page.getByRole('combobox', { name: 'Floor', exact: true });
  await expect(floor).toBeEnabled();
  await expect(floor).toHaveValue('f2');
  expect(await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    return { level: a.levelId, party: a.party.level, pos: a.party.pos };
  })).toEqual({ level: 'f2', party: 'f2', pos: [17.5, 27.5] });
});

test('an explicit floor request overrides the saved party floor without moving the party', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f2', 17.5, 27.5);
    const opened = await a.open(a.cur.path, 'f1');
    return { opened, level: a.levelId, party: a.party.level, pos: a.party.pos };
  });
  expect(result).toEqual({ opened: true, level: 'f1', party: 'f2', pos: [17.5, 27.5] });
});

test('an invalid explicit floor retains the entry-floor fallback', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f2', 17.5, 27.5);
    a.activate(a.cur, { levelId: 'missing-floor', frame: false });
    return { level: a.levelId, entry: a.cur.scene.entry, party: a.party.level };
  });
  expect(result).toEqual({ level: 'f1', entry: undefined, party: 'f2' });
});

test('an invalid saved party floor falls back safely without rewriting the saved token', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = (window as any).__mistlab.app;
    a.party.level = 'removed-floor';
    a.activate(a.cur, { frame: false });
    return { level: a.levelId, party: a.party.level };
  });
  expect(result).toEqual({ level: 'f1', party: 'removed-floor' });
});

test('camera-only activation preserves entry navigation and does not move the party', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    m.moveParty('f2', 17.5, 27.5);
    const before = JSON.stringify(a.state.tokens);
    a.activate(a.cur, { travel: false, frame: false });
    return { level: a.levelId, party: a.party.level, unchanged: JSON.stringify(a.state.tokens) === before };
  });
  expect(result).toEqual({ level: 'f1', party: 'f2', unchanged: true });
});

test('a first visit uses the authored entry even when its newly created token spawns elsewhere', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = (window as any).__mistlab.app, scene = a.cur.scene;
    a.state.tokens = a.state.tokens.filter((t: any) => t.location !== scene.location);
    // Deliberately separate entry from Death House's f1 spawn to detect reading the new token as saved state.
    const entry = scene.entry;
    scene.entry = 'f2';
    try {
      a.activate(a.cur, { frame: false });
      return { level: a.levelId, party: a.party.level };
    } finally { scene.entry = entry; }
  });
  expect(result).toEqual({ level: 'f2', party: 'f1' });
});

test('the Player Display follows the explicit DM floor when the party is on another floor', async ({ page }) => {
  await boot(page, true);
  const result = await page.evaluate(async () => {
    const a = (window as any).__mistlab.app;
    a.channel.bc?.close();
    const state = structuredClone(a.state);
    const party = state.tokens.find((t: any) => t.id === a.party.id);
    party.level = 'f2';
    party.pos = [17.5, 27.5];
    await a.onMsg({ kind: 'state', state, location: a.cur.path, level: 'f1', nested: a.nested });
    return { level: a.levelId, party: a.party.level, pos: a.party.pos };
  });
  expect(result).toEqual({ level: 'f1', party: 'f2', pos: [17.5, 27.5] });
});
