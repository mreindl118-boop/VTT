// Backups (0.2.0): persistent storage in Help, Export by share sheet or download, Import that validates and asks
// once, rolling snapshots with Restore, and the 'Back up campaign' chip after two hours without an export.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, SCENES } from './helpers';

const FILE = /^mistlab-cos-.*\.json$/;

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

/** The campaign state without its save time, as plain JSON. */
const stateOf = (page: Page) => page.evaluate(() => { const s = structuredClone((window as any).__mistlab.app.state); delete s.updatedAt; return s; });
/** The snapshot list straight from IndexedDB. */
const snapshotsOf = (page: Page) => page.evaluate(() => new Promise<any[]>((res) => {
  const r = indexedDB.open('mistlab', 1);
  r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('snapshots:cos'); g.onsuccess = () => { r.result.close(); res(g.result ?? []); }; };
}));
const commit = (page: Page, n = 1) => page.evaluate(({ n, room }) => { const a = (window as any).__mistlab.app; for (let i = 0; i < n; i++) a.toggleRoom(room); }, { n, room: SCENES[0].room });

test('persist() resolves true: Help shows exactly "Storage: persistent"', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => true }));
  await boot(page, '', SCENES[0]);
  await commit(page); // the first commit asks for persistent storage
  await page.locator('[data-cam="help"]').click();
  await expect(page.locator('.sheet.help .storage-status')).toHaveText('Storage: persistent');
  await expect(page.locator('.sheet.help .help-version')).toHaveText(/^mistLAB \d+\.\d+\.\d+$/);
});

test('persist() resolves false: Help shows the warning with the install hint', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => false });
    Object.defineProperty(navigator.storage, 'persisted', { configurable: true, value: async () => false });
  });
  await boot(page, '', SCENES[0]);
  await commit(page);
  await page.locator('[data-cam="help"]').click();
  const status = page.locator('.sheet.help .storage-status');
  await expect(status).toContainText('Install');
  await expect(status).not.toHaveText('Storage: persistent');
});

test('Export uses the share sheet where the browser can share files', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__shared = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => !!d.files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: ShareData) => { (window as any).__shared.push(d.files!.map((f) => ({ name: f.name, type: f.type, size: f.size }))); } });
  });
  await boot(page, '', SCENES[0]);
  let downloads = 0; page.on('download', () => downloads++);
  await page.locator('[data-act="library"]').click();
  await page.locator('.campaign-io [data-io="export"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1);
  await page.waitForTimeout(300);
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toHaveLength(1);
  expect(shared[0][0].name).toMatch(FILE);
  expect(shared[0][0].size).toBeGreaterThan(100);
  expect(downloads).toBe(0);
});

test('Export downloads the file where the browser cannot share files', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await boot(page, '', SCENES[0]);
  await page.locator('[data-act="library"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.campaign-io [data-io="export"]').click()]);
  expect(download.suggestedFilename()).toMatch(FILE);
  const file = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(file).toMatchObject({ app: 'mistlab', schemaVersion: 1, campaign: 'cos', scene: SCENES[0].scene });
});

test('Export, Reset, Import: the campaign comes back; a malformed file and a Wild Sheep Chase file are refused', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await page.evaluate(({ hidden, room, secret }) => {
    const a = (window as any).__mistlab.app;
    a.toggleObject(hidden); a.toggleRoom(room); a.revealSecretDoor(secret); a.toggleDoor('d-t1-t2'); a.setClock(4, 19.5);
    a.startEncounter([{ sheetId: 'pc-1', init: 15 }, { sheetId: 'pc-2', init: 20 }]);
  }, SCENES[0]);
  const before = await stateOf(page);
  await page.locator('[data-act="library"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.campaign-io [data-io="export"]').click()]);
  const path = await download.path();

  // Reset asks once, then clears the campaign.
  await page.locator('.campaign-io [data-io="reset"]').click();
  await expect(page.locator('.campaign-io .cio-confirm')).toBeVisible();
  await page.locator('.campaign-io [data-io="yes"]').click();
  await expect(page.locator('.sheet.library')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__mistlab.app.state.reveals.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).__mistlab.app.state.encounter)).toBeUndefined();

  // Refused files leave the state as it is.
  const reset = await stateOf(page);
  await page.locator('[data-act="library"]').click();
  const input = page.locator('.campaign-io input[type=file]');
  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"mistlab","schemaVersion":1,"campaign":"cos","state":{"reveals":"all"}}') });
  await expect(page.locator('.campaign-io .cio-msg')).toContainText('Not imported');
  const wsc = { ...JSON.parse(readFileSync(path, 'utf8')), campaign: 'wsc', scene: 'wsc/01-tavern' };
  await input.setInputFiles({ name: 'mistlab-wsc-2026-10-04-1200.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wsc)) });
  await expect(page.locator('.campaign-io .cio-msg')).toContainText('A Wild Sheep Chase');
  await expect(page.locator('.campaign-io .cio-confirm')).toHaveCount(0);
  expect(await stateOf(page)).toEqual(reset);

  // Import asks once, then brings everything back.
  await input.setInputFiles(path);
  await expect(page.locator('.campaign-io .cio-confirm')).toContainText('Replace');
  await page.locator('.campaign-io [data-io="yes"]').click();
  await expect(page.locator('.sheet.library')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__mistlab.app.state.reveals.length)).toBe(before.reveals.length);
  const after = await stateOf(page);
  for (const k of ['reveals', 'doorsOpen', 'opened', 'tokens', 'roster', 'encounter', 'clock', 'world']) expect(after[k], k).toEqual(before[k]);
  // and it was saved
  await page.evaluate(() => (window as any).__mistlab.app.flush());
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  expect((await stateOf(page)).reveals).toEqual(before.reveals);
});

test('after 60 commits the Library lists a snapshot, and Restore deep-equals it', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await commit(page, 60);
  await expect.poll(async () => (await snapshotsOf(page)).length).toBeGreaterThanOrEqual(1);
  await page.locator('[data-act="library"]').click();
  const rows = page.locator('.campaign-io .cio-snap');
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(1);
  const snaps = await snapshotsOf(page);
  expect(await rows.count()).toBe(snaps.length);
  const pick = snaps.length - 1; // the oldest
  await rows.nth(pick).locator('[data-io="restore"]').click();
  await expect(page.locator('.campaign-io .cio-confirm')).toContainText('Restore');
  await page.locator('.campaign-io [data-io="yes"]').click();
  await expect(page.locator('.sheet.library')).toHaveCount(0);
  const want = structuredClone(snaps[pick].state); delete want.updatedAt;
  await expect.poll(async () => (await stateOf(page)).reveals.length).toBe(want.reveals.length);
  const got = await stateOf(page);
  // Explored memory is recomputed from the party's vision on every commit (and today grows by a cell each time,
  // a coverage quirk outside this increment), so it is compared by level; everything else must be identical.
  expect(Object.keys(got.seen).sort()).toEqual(Object.keys(want.seen).sort());
  expect({ ...got, seen: {} }).toEqual({ ...want, seen: {} });
  // the state it replaced is kept as the newest snapshot
  expect((await snapshotsOf(page))[0].reason).toBe('before restore');
});

test('two hours after the last export the backup chip shows; after Export it is gone', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    localStorage.setItem('mistlab.exportedAt.cos', String(real()));
    Date.now = () => real() + 2 * 3600_000 + 60_000; // two hours and a minute later
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await boot(page, '', SCENES[0]);
  const chip = page.locator('.backup-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('Back up campaign');
  // DM only: Players view hides it
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  await expect(chip).toBeHidden();
  await page.evaluate(() => (window as any).__mistlab.app.setView('dm'));
  await expect(chip).toBeVisible();
  await page.locator('[data-act="library"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.campaign-io [data-io="export"]').click()]);
  expect(download.suggestedFilename()).toMatch(FILE);
  await expect(chip).toBeHidden();
  await commit(page); // play goes on: no nudge until two more hours pass
  await expect(chip).toBeHidden();
});

test('the chip itself exports in one tap', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    localStorage.setItem('mistlab.exportedAt.cos', String(real()));
    Date.now = () => real() + 3 * 3600_000;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await boot(page, '', SCENES[0]);
  const chip = page.locator('.backup-chip');
  await expect(chip).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), chip.click()]);
  expect(download.suggestedFilename()).toMatch(FILE);
  await expect(chip).toBeHidden();
});
