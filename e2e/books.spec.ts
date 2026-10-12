// Rules books (SRD 5.1 and 5.2.1, CC-BY-4.0): the Books tab, the reader, search, deep links, the Rules edition
// preference, offline after saving, the phone layout, and that the players never see them.
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  // Help names the release, read from package.json at build time.
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  await expect(page.locator('.sheet.help .version')).toHaveText(`mistLAB ${version}`);
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
  const spans = await page.evaluate(async () => { const b = (window as any).__mistlabBooks; return b.findTerms('The Ghoul is Prone.', await b.termIndex()).map((s: any) => s.id); });
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
  // Help's attribution chunk is saved with the book, so Help has it with no network.
  const kept = await page.evaluate(async () => (await (await caches.open('mistlab-books-v1')).keys()).map((r) => r.url).filter((u) => /\/assets\/attribution-[\w-]+\.js$/.test(u)));
  expect(kept).toHaveLength(1);
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
  // The book's title page still carries its attribution and the full changes note.
  await reader.locator('[data-go="about"]').first().click();
  await expect(reader.locator('.br-statement')).toContainText('This work includes material from the System Reference Document 5.2.1');
  await expect(reader.locator('.br-attrib')).toContainText('which lists its own changes: it removed the table of contents; renumbered the steps of D20 Tests');
  // The unsaved 2014 book says so by name, and offers the way back to the book that is open.
  await reader.locator('.br-switch [data-switch="srd-5.1"]').click();
  await expect(reader.locator('.bk-error')).toContainText('SRD 5.1 (2014 rules) is not saved on this device');
  await expect(reader.locator('.br-book')).toHaveText('SRD 5.2.1');
  await reader.locator('.br-back').click();
  await expect(reader.locator('.br-statement')).toBeVisible();
  await reader.locator('[data-act="map"]').click();

  // A cold start with no network: Help still names both books' licence, disclaimer and changes.
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.click('[data-cam="help"]');
  const attrib = page.locator('.sheet.help dd.attrib');
  await expect(attrib).toHaveCount(5);
  await expect(attrib.nth(0)).toHaveText(/^This work includes material from the System Reference Document 5\.2\.1/);
  await expect(attrib.nth(1)).toHaveText(/^This work includes material taken from the System Reference Document 5\.1/);
  await expect(attrib.nth(2)).toHaveText(/^Section 5 of CC-BY-4\.0 includes a Disclaimer of Warranties/);
  await expect(attrib.nth(3).locator('summary')).toHaveText('What this copy of SRD 5.2.1 changed');
  await attrib.nth(3).locator('summary').click();
  await expect(attrib.nth(3)).toContainText('renumbered the steps of D20 Tests');
  await expect(attrib.nth(3).getByText(/renumbered the steps of D20 Tests/)).toBeVisible();
  await expect(attrib.nth(4)).toContainText('the Grimlock’s Blind Senses trait');
  await attrib.nth(0).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/books-offline-help.png` });
  await context.unroute('**/*');
  await context.setOffline(false);
});

test('offline before the books code was ever fetched: the Books tab says why, never blank', async ({ page, context }) => {
  // The books chunk never arrives (as on a device that went offline before the DM opened Books or the app fetched it).
  await context.route(/\/assets\/books-[\w-]+\.(js|css)$/, (r) => r.abort('internetdisconnected'));
  await page.goto(`/?scene=${encodeURIComponent(SCENES[0].scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await context.route('**/*', (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.click('[data-act="library"]');
  await page.click('.sheet.library [data-books]');
  await expect(page.locator('.sheet.library .books-body .bk-error')).toHaveText('The book list could not be loaded. Connect to the network once, then use Save for offline.');
  await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/books-offline-tab-unsaved.png` });
  await context.unroute('**/*');
  await context.setOffline(false);
});

test('the books code is fetched early for the DM, so the Books tab works offline without being opened first', async ({ page, context }) => {
  await page.goto(`/?scene=${encodeURIComponent(SCENES[0].scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('mistlab-v1')).keys()).some((r) => /\/assets\/books-[\w-]+\.js$/.test(r.url))), { timeout: 30_000 }).toBe(true);
  await context.route('**/*', (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.click('[data-act="library"]');
  await page.click('.sheet.library [data-books]');
  // The tab's own code ran (its stylesheet's type colours are defined), though with no book saved it has no list.
  await expect(page.locator('.sheet.library .books-body .bk-error, .sheet.library .bk-row').first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--t-spell').trim())).not.toBe('');
  await context.unroute('**/*');
  await context.setOffline(false);
});

// On iPad portrait and the phone the contents are a sheet over the page, and the book switch lives in it: switching
// books, typing a search or pressing Enter must close it so the results and the entry are not hidden underneath.
for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['iPad portrait', { width: 820, height: 1180 }]] as const) {
  test.describe(name, () => {
    test.use({ viewport, hasTouch: true, isMobile: name === 'phone' });
    test(`${name}: the contents sheet closes on a book switch and a search, and Enter lands on the entry in view`, async ({ page }) => {
      await boot(page, '', SCENES[0]);
      await page.goto(`/?nosw&scene=${encodeURIComponent(SCENES[0].scene)}#book/srd-5.2.1`);
      const reader = page.locator('.book-reader');
      await expect(reader.locator('.br-statement')).toBeVisible();
      await reader.locator('.br-toc-btn').tap();
      await expect(reader).toHaveClass(/toc-open/);
      await reader.locator('.br-switch [data-switch="srd-5.1"]').tap();
      await expect(reader.locator('.br-book')).toHaveText('SRD 5.1');
      await expect(reader).not.toHaveClass(/toc-open/);
      // Open again, then type: the sheet gives way to the results.
      await reader.locator('.br-toc-btn').tap();
      await expect(reader).toHaveClass(/toc-open/);
      const search = reader.locator('.br-search input');
      await search.fill('grappled');
      await expect(reader).not.toHaveClass(/toc-open/);
      await expect(reader.locator('.br-results li').first()).toBeInViewport();
      await search.press('Enter');
      await expect(reader.locator('#condition-grappled')).toBeInViewport();
      await expect(reader).not.toHaveClass(/toc-open/);
      await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/books-${name.replace(' ', '-')}-grappled.png` });
      // The next page can be tapped: nothing lies over it.
      await reader.locator('.br-pager .br-next').tap();
      await expect(reader.locator('.br-page[data-page]')).toBeVisible();
    });
  });
}

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
    // Stat blocks inside spells and magic items fit too (summon spells are looked up in play).
    for (const [book, anchor] of [['srd-5.2.1', 'spell-giant-insect'], ['srd-5.2.1', 'spell-animate-objects'], ['srd-5.1', 'item-figurine-of-wondrous-power']]) {
      await page.evaluate((h) => { location.hash = h; }, `#book/${book}/${anchor}`);
      await expect(reader.locator(`#${anchor}`)).toBeInViewport();
      const wide = await reader.locator(`.entry:has(> #${anchor}) table.abil`).evaluateAll((els) => els.map((e) => e.closest('.tbl')!.scrollWidth - e.closest('.tbl')!.clientWidth));
      expect(wide.length, anchor).toBeGreaterThan(0);
      expect(wide.every((d) => d <= 0), anchor).toBe(true);
    }
    expect(await overflow()).toEqual([0, 0]);
    // A 2014 feature's parts sit inside it (Wild Shape's Beast Shapes): their tables still fit the phone.
    await page.evaluate(() => { location.hash = '#book/srd-5.1/feature-wild-shape'; });
    await expect(reader.locator('#feature-wild-shape')).toBeInViewport();
    const nested = await reader.locator('.entry[data-id="feature:wild-shape"] .tbl').evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every((d) => d <= 0), String(nested)).toBe(true);
    await reader.locator('.entry[data-id="feature:wild-shape"] table').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/books-phone-wild-shape.png` });
    await reader.locator('[data-act="map"]').tap();
    await expect(page.locator('.book-reader')).toHaveCount(0);
  });
  test('Help fits the phone: the licence URLs wrap, nothing scrolls sideways', async ({ page }) => {
    await boot(page, '', SCENES[0]);
    // (On the phone the map's scale bar lies over the Help button, a layout issue outside the books: open it directly.)
    await page.locator('[data-cam="help"]').dispatchEvent('click');
    const attrib = page.locator('.sheet.help dd.attrib');
    await expect(attrib).toHaveCount(5);
    await attrib.nth(1).scrollIntoViewIfNeeded();
    const wide = await page.evaluate(() => [...document.querySelectorAll('.sheet.help dd.attrib, .sheet.help .sheet-body')].map((e) => e.scrollWidth - e.clientWidth));
    expect(wide.length).toBeGreaterThan(5);
    expect(wide.every((d) => d <= 0), String(wide)).toBe(true);
    await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/books-phone-help.png` });
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
