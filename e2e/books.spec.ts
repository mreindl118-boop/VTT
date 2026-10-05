// Rules books (SRD 5.1 and 5.2.1, CC-BY-4.0): the Books tab, the reader, search, deep links, the Rules edition
// preference, offline after saving, the phone layout, and that the players never see them.
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { boot, SCENES } from './helpers';

// Book pages are large and the test room boots fastest; a loaded machine still needs more than the default minute
// for a test and more than five seconds for a chapter to arrive.
const expect = baseExpect.configure({ timeout: 20_000 });
test.beforeEach(async ({ page }) => { test.setTimeout(180_000); await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1')); });

async function openBooksTab(page: Page): Promise<void> {
  await page.click('[data-act="library"]');
  await page.click('.sheet.library [data-books]');
  await expect(page.locator('.bk-row')).toHaveCount(2);
}

test('Books tab: both books with edition and size; the campaign tabs still work', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await openBooksTab(page);
  const rows = page.locator('.bk-row');
  await expect(rows.nth(0)).toContainText('System Reference Document 5.2.1');
  await expect(rows.nth(0)).toContainText('2024 rules · SRD 5.2.1');
  await expect(rows.nth(1)).toContainText('2014 rules · SRD 5.1');
  await expect(rows.nth(0).locator('.meta')).toContainText(/\d(\.\d)? MB/);
  await expect(rows.nth(0)).toContainText('Save for offline');
  // The existing Library is unchanged: campaign tabs and their rows.
  await page.click('.sheet.library [data-camp="cos"]');
  await expect(page.locator('.sheet.library [data-path]').first()).toBeVisible();
  await expect(page.locator('.bk-row')).toHaveCount(0);
  await page.click('.sheet.library [data-camp="wsc"]');
  await expect(page.locator('.sheet.library [data-path]').first()).toBeVisible();
  await page.click('.sheet.library .close');
  // Help lists both books' exact attribution statements.
  await page.click('[data-cam="help"]');
  await expect(page.locator('.sheet.help dd.attrib').nth(0)).toHaveText(/^This work includes material from the System Reference Document 5\.2\.1 \(“SRD 5\.2\.1”\)/);
  await expect(page.locator('.sheet.help dd.attrib').nth(1)).toHaveText(/^This work includes material taken from the System Reference Document 5\.1 \(“SRD 5\.1”\)/);
  await expect(page.locator('.sheet.help dd.attrib').nth(2)).toHaveText(/^Section 5 of CC-BY-4\.0 includes a Disclaimer of Warranties/);
  await expect(page.locator('.sheet.help dt', { hasText: 'Rules books' }).locator('+ dd')).toContainText('Library, then Books');
});

test('reader: title page with attribution, search jumps to a condition, a spell and a monster, deep links survive reload, Map goes back', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await openBooksTab(page);
  await page.click('[data-open="srd-5.2.1"]');
  await expect(page.locator('.sheet.library')).toHaveCount(0);
  const reader = page.locator('.book-reader');
  await expect(reader.locator('.br-title h1')).toHaveText('System Reference Document 5.2.1');
  await expect(reader.locator('.br-statement')).toContainText('This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC');
  expect(new URL(page.url()).hash).toBe('#book/srd-5.2.1');

  const search = reader.locator('.br-search input');
  await search.fill('prone');
  await expect(reader.locator('.br-results li').first()).toContainText('Prone');
  await expect(reader.locator('.br-results .tchip').first()).toHaveText('Condition');
  await search.press('Enter');
  await expect(reader.locator('#condition-prone')).toBeInViewport();
  await expect(reader.locator('.entry.t-condition[data-id="condition:prone"]')).toContainText('Restricted Movement');
  await expect.poll(() => new URL(page.url()).hash).toBe('#book/srd-5.2.1/condition-prone');

  await search.fill('Fireball'); await search.press('Enter');
  await expect(reader.locator('#spell-fireball')).toBeInViewport();
  await search.fill('wolf'); await search.press('Enter');
  await expect(reader.locator('#monster-wolf')).toBeInViewport();
  await expect(reader.locator('.entry[data-id="monster:wolf"] table')).toContainText('Str.');
  // A table title restored from the PDF is found by name and lands on the table.
  await search.fill('XP Budget per Character'); await search.press('Enter');
  await expect(reader.locator('#table-xp-budget-per-character')).toBeInViewport();
  await expect(reader.locator('#table-xp-budget-per-character caption')).toHaveText('XP Budget per Character');
  // A titled table is marked as one beside the heading of the same name.
  await search.fill('travel pace');
  await expect(reader.locator('.br-results li', { hasText: 'Travel Pace' }).locator('.tchip.t-table')).toHaveText('Table');
  // Another name for a rule (from the term index) finds it: 'grapple' is the Grappling rule.
  await search.fill('grapple');
  await expect(reader.locator('.br-results li').first()).toContainText('Grappling');
  await search.press('Enter');
  await expect(reader.locator('#rule-grappling')).toBeInViewport();
  // Previous / next page.
  const title = await reader.locator('.br-page[data-page]').getAttribute('data-page');
  await reader.locator('.br-pager .br-prev').click();
  await expect(reader.locator('.br-page[data-page]')).not.toHaveAttribute('data-page', title!);

  // Deep link survives a reload.
  await page.goto(`/?nosw&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.1/condition-grappled`);
  await expect(page.locator('.book-reader #condition-grappled')).toBeInViewport();
  await expect(page.locator('.book-reader .br-book')).toHaveText('SRD 5.1');
  await page.reload();
  await expect(page.locator('.book-reader #condition-grappled')).toBeInViewport();
  // One tap back to the map.
  await page.locator('.book-reader [data-act="map"]').click();
  await expect(page.locator('.book-reader')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('canvas.gl')).toBeVisible();
});

test('search across both books groups results by book and section', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await page.goto(`/?nosw&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.2.1`);
  const reader = page.locator('.book-reader');
  await reader.locator('[data-scope="both"]').click();
  await reader.locator('.br-search input').fill('fireball');
  await expect(reader.locator('.br-group')).toHaveCount(2);
  await expect(reader.locator('.br-group').nth(0).locator('h2')).toContainText('SRD 5.2.1');
  await expect(reader.locator('.br-group').nth(1).locator('h2')).toContainText('SRD 5.1');
  await expect(reader.locator('.br-group').nth(1).locator('h3').first()).toHaveText('Spell Descriptions');
  // Full text finds the words inside entries.
  await reader.locator('.br-search input').fill('bat guano');
  await expect(reader.locator('.br-results .br-kicker')).toContainText('bat guano');
  await reader.locator('[data-fulltext]').click();
  await expect(reader.locator('.br-group .snip mark').first()).toHaveText(/bat guano/i, { timeout: 90_000 }); // reads every page of both books
  await reader.locator('.br-group button', { hasText: /^Fireball/ }).first().click();
  await expect(reader.locator('#spell-fireball')).toBeInViewport();
});

test('Rules edition preference: 2024 by default, 2014 answers once chosen', async ({ page }) => {
  await boot(page, '', SCENES[0]);
  await openBooksTab(page);
  await expect(page.locator('[data-ed="2024"]')).toHaveAttribute('aria-checked', 'true');
  const look = () => page.evaluate(async () => { const b = (window as any).__mistlabBooks; const e = await b.lookup('Fireball'); return [e.edition, e.book, e.summary.castingTime]; });
  expect(await look()).toEqual(['2024', 'srd-5.2.1', 'Action']);
  await page.click('[data-ed="2014"]');
  await expect(page.locator('[data-ed="2014"]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('mistlab.rulesEdition'))).toBe('2014');
  expect(await look()).toEqual(['2014', 'srd-5.1', '1 action']);
  const spans = await page.evaluate(async () => { const b = (window as any).__mistlabBooks; return b.findTerms('The ghoul is Prone.', await b.termIndex()).map((s: any) => s.id); });
  expect(spans).toEqual(['monster:ghoul', 'condition:prone']);
});

test('offline after saving: every file is stored, and with the network really cut a chapter never opened still opens', async ({ page, context }) => {
  await page.goto(`/?scene=${encodeURIComponent(SCENES[0].scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Load once under the worker's control so the app shell and its chunks are cached.
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await openBooksTab(page);
  const row = page.locator('.bk-row[data-book="srd-5.2.1"]');
  await row.locator('[data-save]').click();
  await expect(row.locator('.bk-saved')).toHaveText('Saved for offline', { timeout: 60_000 });
  // Every file the catalog lists for the book is in the books cache.
  const missing = await page.evaluate(async () => {
    const cat = await (await fetch('books/catalog.json')).json();
    const b = cat.books.find((x: any) => x.id === 'srd-5.2.1');
    const c = await caches.open('mistlab-books-v1');
    const out: string[] = [];
    for (const f of b.files) if (!(await c.match(new URL(`books/srd-5.2.1/${f}`, document.baseURI).href))) out.push(f);
    return out;
  });
  expect(missing).toEqual([]);
  await page.keyboard.press('Escape');

  // Cut the network for the page and for the service worker (PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS).
  await context.route('**/*', (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  // Proof the cut is real: a file nobody saved cannot be fetched.
  const unsaved = await page.evaluate(() => fetch(`books/srd-5.1/p/feats.json?x=${Date.now()}`).then((r) => (r.ok ? 'fetched' : 'failed'), () => 'failed'));
  expect(unsaved).toBe('failed');
  await openBooksTab(page);
  await expect(page.locator('.bk-row[data-book="srd-5.2.1"] .bk-saved')).toBeVisible();
  await page.click('[data-open="srd-5.2.1"]');
  const reader = page.locator('.book-reader');
  for (const ch of ['Animals', 'Rules Glossary']) { // chapters this browser has never opened
    await reader.locator('.br-chapters > li > button', { hasText: new RegExp(`^${ch}$`) }).click();
    await expect(reader.locator('.br-page h1').first()).toHaveText(ch);
  }
  await reader.locator('.br-search input').fill('stunned');
  await reader.locator('.br-search input').press('Enter');
  await expect(reader.locator('#condition-stunned')).toBeInViewport();
  // The unsaved 2014 book says so instead of failing silently.
  await reader.locator('.br-switch [data-switch="srd-5.1"]').click();
  await expect(reader.locator('.bk-error')).toContainText('not available offline');
  await context.unroute('**/*');
  await context.setOffline(false);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the reader fits the phone: contents as a sheet, no sideways scroll, Map in one tap', async ({ page }) => {
    await boot(page, '', SCENES[0]);
    const overflow = () => page.evaluate(() => { const m = document.querySelector('.br-main')!; return [m.scrollWidth - m.clientWidth, document.documentElement.scrollWidth - innerWidth]; });
    // The title page (long licence URLs) fits too.
    await page.goto(`/?nosw&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.2.1`);
    await expect(page.locator('.book-reader .br-statement')).toBeVisible();
    expect(await overflow()).toEqual([0, 0]);
    await page.goto(`/?nosw&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.2.1/monster-wolf`);
    const reader = page.locator('.book-reader');
    await expect(reader.locator('#monster-wolf')).toBeInViewport();
    // The stat block's six ability columns fit: Cha. is on screen, no sideways scroll inside the table.
    const fit = await reader.locator('.entry[data-id="monster:wolf"] .tbl').evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
    expect(fit.length).toBeGreaterThan(0);
    expect(fit.every((d) => d <= 0)).toBe(true);
    await expect(reader.locator('.entry[data-id="monster:wolf"] th', { hasText: 'Cha.' })).toBeInViewport();
    const toc = reader.locator('.br-toc');
    // Closed, the contents sheet casts no shadow onto the page's left edge.
    expect(await toc.evaluate((e) => getComputedStyle(e).boxShadow)).toBe('none');
    const box = async () => (await toc.boundingBox())!;
    expect((await box()).x + (await box()).width).toBeLessThanOrEqual(1); // off-screen until asked for
    await reader.locator('.br-toc-btn').tap();
    await expect.poll(async () => (await box()).x).toBeGreaterThanOrEqual(0);
    await expect(reader.locator('.br-toc li.cur')).toContainText('Wolf');
    await reader.locator('.br-toc button', { hasText: /^Tiger$/ }).tap();
    await expect(reader.locator('#monster-tiger')).toBeInViewport();
    await expect.poll(async () => (await box()).x + (await box()).width).toBeLessThanOrEqual(1);
    expect(await overflow()).toEqual([0, 0]);
    await expect(reader.locator('.br-search input')).toBeVisible();
    await reader.locator('[data-act="map"]').tap();
    await expect(page.locator('.book-reader')).toHaveCount(0);
  });
});

test('players never see the books: not in Players mode, not on the Player Display', async ({ page, browser }) => {
  await boot(page, '', SCENES[0]);
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  await page.click('[data-act="library"]');
  await expect(page.locator('.sheet.library [data-camp]').first()).toBeVisible();
  await expect(page.locator('.sheet.library [data-books]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#book/srd-5.2.1/condition-prone'; });
  await page.waitForTimeout(500);
  await expect(page.locator('.book-reader')).toHaveCount(0);
  // A reader left open when the DM turns the screen to the table is hidden.
  await page.evaluate(() => { (window as any).__mistlab.app.setView('dm'); location.hash = ''; });
  await page.evaluate(() => { location.hash = '#book/srd-5.2.1/condition-prone'; });
  await expect(page.locator('.book-reader #condition-prone')).toBeVisible();
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  await expect(page.locator('.book-reader')).toBeHidden();

  const display = await browser.newPage();
  await display.goto(`/?nosw&display=player&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.2.1/condition-prone`);
  await display.waitForFunction(() => (window as any).__mistlab?.ready);
  await display.waitForTimeout(500);
  await expect(display.locator('.book-reader')).toHaveCount(0);
  await expect(display.locator('[data-act="library"]')).toHaveCount(0);
  await display.close();
});
