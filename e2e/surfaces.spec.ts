// The rules links on the app's own surfaces (the tooltip pass, step 3): the room tap menu and the object card, the
// token panel and the creature sheet from one source, the initiative headers, the clock by edition, the Rooms sheet,
// Help's colour key, and the escaping. Desktop; the touch devices run e2e/rules-tooltips.spec.ts.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS ?? 'test-results';
const DM_KINDS = ['monster', 'creature-type', 'person', 'area', 'pageref', 'check', 'dice'];

test.beforeEach(async ({ page: _p }, info) => { test.skip(info.project.name !== 'chromium', 'desktop'); });

async function boot(page: Page, scene = 'appB/death-house', edition: '2024' | '2014' = '2024'): Promise<void> {
  await page.addInitScript((ed) => { localStorage.setItem('mistlab.helpSeen', '1'); localStorage.setItem('mistlab.rulesEdition', ed); }, edition);
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(async () => { const m = (window as any).__mistlab; await m.ready; await m.rich(); });
}
const tapCard = (page: Page, level: string, t: { object?: string; room?: string }) => page.evaluate(({ level, t }) => {
  const m = (window as any).__mistlab;
  if (m.app.levelId !== level) m.app.setLevel(level);
  m.tapCard(t);
}, { level, t });
const links = (page: Page, sel: string) => page.locator(`${sel} .rl`).evaluateAll((els) => els.map((e) => ({ text: e.textContent, kind: (e as HTMLElement).dataset.kind, label: (e as HTMLElement).dataset.label, term: (e as HTMLElement).dataset.term })));

test('Death House: 2A, the chest in 9 and the cabinet lock link their checks and spells; the players\' 2A card links none of them', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page);
  await tapCard(page, 'f1', { room: '2A' });
  await expect(page.locator('.tapmenu.page .roomhead')).toBeVisible();
  const head = await links(page, '.tapmenu');
  expect(head.find((l) => l.kind === 'check')?.label).toBe('DC 12 · Perception');
  // the page reference is an ink link with a solid underline
  expect(head.some((l) => l.kind === 'pageref')).toBe(true);
  expect(await page.locator('.tapmenu .rl.pageref').evaluate((e) => getComputedStyle(e).textDecorationStyle)).toBe('solid');
  // opaque page surface
  expect(await page.locator('.tapmenu').evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/^rgb\(/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-2A-dm.png` });
  await page.locator('.tapmenu .rl.check').click();
  await expect(page.locator('#tips .rt.check h4')).toHaveText('DC 12 · Perception');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-2A-dm-check-card.png` });
  await page.keyboard.press('Escape');

  await tapCard(page, 'f2', { object: 'f2-chest9' });
  const chest = await links(page, '.infocard');
  expect(chest.filter((l) => l.kind === 'spell').map((l) => l.text)).toEqual(['bless', 'protection from poison', 'spiritual weapon']);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-chest9-dm.png` });
  await tapCard(page, 'f1', { object: 'f1-cab-lock' });
  expect((await links(page, '.infocard')).find((l) => l.kind === 'check')?.label).toBe("DC 15 · DEX (Thieves' Tools)");

  // Players: the same room, revealed. No DM note, no DM-only link.
  await page.evaluate(() => { const m = (window as any).__mistlab; m.app.setLevel('f1'); if (!m.app.isRevealed('2A')) m.app.toggleRoom('2A'); m.app.setView('players'); });
  await tapCard(page, 'f1', { room: '2A' });
  await expect(page.locator('.infocard.page')).toBeVisible();
  const pl = await links(page, '.infocard');
  expect(pl.filter((l) => DM_KINDS.includes(l.kind!))).toEqual([]);
  expect(await page.locator('.infocard').innerText()).not.toMatch(/DC 12|DM only/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-2A-players.png` });
});

test('Amber Temple X24: the WIS save check, sympathy as Antipathy/Sympathy and the X26 area', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page, 'ch13/X');
  await tapCard(page, 'upper', { room: 'X24' });
  const l = await links(page, '.tapmenu');
  expect(l.find((x) => x.kind === 'check')?.label).toBe('DC 16 · WIS save');
  expect(l.find((x) => x.text === 'sympathy')).toMatchObject({ kind: 'spell', term: 'spell:antipathy-sympathy' });
  expect(l.find((x) => x.text === 'X26')).toMatchObject({ kind: 'area' });
  await page.locator('.tapmenu .rl', { hasText: 'sympathy' }).click();
  await expect(page.locator('#tips .rt.spell h4')).toHaveText(/Antipathy\/Sympathy/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-X24-sympathy.png` });
  await page.keyboard.press('Escape');
  await page.locator('.tapmenu .rl', { hasText: 'X26' }).click();
  await expect(page.locator('#tips .rt[data-kind="area"] h4')).toHaveText(/Secret Alcove/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-X24-area.png` });
});

test('an object label with markup renders literally on its card', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const m = (window as any).__mistlab;
    m.app.onTap({ pos: [0, 0], object: { id: 'fixture', label: 'A <b>bold</b> chest', playerLabel: 'Chest', vis: 'hidden-object', revealed: false, kind: 'chest', desc: 'Its lid <i>creaks</i>.', dm: 'DC 15 <u>trap</u>', visibleToPlayers: false } }, 300, 200);
  });
  await expect(page.locator('.infocard h2')).toHaveText('A <b>bold</b> chest');
  expect(await page.locator('.infocard b:text("bold"), .infocard i, .infocard u').count()).toBe(0);
  await expect(page.locator('.infocard .dm')).toContainText('<u>trap</u>');
});

// ---- the alias and visibility projection on the three surfaces (the slider preview, Players view, the Player Display)
/** Every text and attribute value in the page (tips, cards, map tags, the turn bar, the status line). */
const pageStrings = (page: Page) => page.evaluate(() => {
  const out: string[] = [document.body.textContent ?? ''];
  for (const el of document.body.querySelectorAll('*')) for (const a of el.attributes) out.push(a.value);
  return out.join('\n');
});
const SECRET = /Ghoul|Hunched thing/;

test('a hidden ghoul aliased "Hunched thing" in initiative with a PC: never named on the players\' side, on any surface', async ({ context }) => {
  test.setTimeout(120_000);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page, 'dev/m0-test-room');
  const ids = await page.evaluate(() => {
    const m = (window as any).__mistlab, a = m.app;
    const g = a.addCreatureNearParty('ghoul');
    a.setPlayerName(g.id, 'Hunched thing');
    const sheet = a.creatureSheet(g);
    const pc = a.state.roster.find((s: any) => s.kind === 'pc');
    a.startEncounter([{ sheetId: pc.id, init: 12 }, { sheetId: sheet.id, init: 17, tokenId: g.id }]);
    a.onChange?.();
    return { ghoul: g.id, pc: a.state.encounter.order.find((c: any) => c.sheetId === pc.id).tokenId, pcName: pc.name };
  });
  // The DM keeps full names: the ghoul is current, its chip and line say so.
  await expect(page.locator('.turnbar div.now')).toContainText('Ghoul');
  await expect(page.locator('.turnbar .cb[data-tip="Ghoul"]')).toHaveCount(1);
  const check = async (where: string) => {
    const s = await pageStrings(page);
    expect(SECRET.exec(s)?.[0], `${where}: a secret name in the page`).toBeUndefined();
    await expect(page.locator('.turnbar .cb')).toHaveCount(1);
    await expect(page.locator('.turnbar div.now')).toHaveText('Round 1');
    // No chip carries a tip or a title (in Players view nothing in the bar does; the preview keeps the DM's own buttons).
    await expect(page.locator(where === 'Players view' ? '.turnbar [data-tip], .turnbar [title]' : '.turnbar .order [data-tip], .turnbar [title]')).toHaveCount(0);
    await expect(page.locator('.lbl.token.creature')).toHaveCount(0);
    // A blocked move says only 'Not your turn'.
    await page.evaluate((pc) => (window as any).__mistlab.app.moveTokenTo(pc, [7.5, 7.5]), ids.pc);
    await expect(page.locator('.status')).toHaveText('Not your turn');
    expect(SECRET.exec(await pageStrings(page))?.[0]).toBeUndefined();
  };
  // 1. The slider preview (DM view, t = 0).
  await page.evaluate(() => (window as any).__mistlab.setT(0));
  await check('slider preview');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/step3-turnbar-hidden-preview.png` });
  // 2. Players view.
  await page.evaluate(() => { const m = (window as any).__mistlab; m.setT(1); m.app.setView('players'); });
  await check('Players view');
  await page.screenshot({ path: `${SHOTS}/step3-turnbar-hidden-players.png` });
  // 3. The Player Display: no tag for the hidden ghoul, no tips layer, no rules links.
  const display = await context.newPage();
  await display.goto(`/?nosw&display=player&scene=${encodeURIComponent('dev/m0-test-room')}`);
  await display.waitForFunction(() => (window as any).__mistlab?.ready);
  await display.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(() => (window as any).__mistlab.app.commit());
  await display.waitForTimeout(500);
  expect(SECRET.exec(await pageStrings(display))?.[0]).toBeUndefined();
  await expect(display.locator('#tips, .rl, .rt')).toHaveCount(0);

  // Revealed: the alias, per token (a second ghoul keeps its own); the DM still reads 'Ghoul'.
  await page.evaluate((g) => {
    const a = (window as any).__mistlab.app;
    a.setView('dm');
    a.setTokenHidden(g, false);
    const g2 = a.addCreatureNearParty('ghoul'); a.setPlayerName(g2.id, 'Pale crawler'); a.setTokenHidden(g2.id, false);
    a.state.encounter.order.push({ sheetId: a.creatureSheet(g2).id, tokenId: g2.id, init: 5 });
    a.commit(); a.setView('players');
  }, ids.ghoul);
  await expect(page.locator('.turnbar .cb')).toHaveText([/Hunched thing/, new RegExp(ids.pcName), /Pale crawler/]);
  await expect(page.locator('.turnbar div.now')).toContainText('Hunched thing');
  await expect(page.locator('.lbl.token.creature')).toHaveText(['Hunched thing', 'Pale crawler'], { useInnerText: true });
  expect(/Ghoul/.exec(await pageStrings(page))?.[0]).toBeUndefined();
  await display.waitForTimeout(500);
  await expect(display.locator('.lbl.token.creature')).toHaveText(['Hunched thing', 'Pale crawler'], { useInnerText: true });
  // The PC's turn: the same line and movement on both sides.
  await page.evaluate(() => { const a = (window as any).__mistlab.app; a.setView('dm'); a.nextTurn(1); a.onChange?.(); });
  const dmLine = await page.locator('.turnbar div.now').innerText();
  await page.evaluate(() => (window as any).__mistlab.app.setView('players'));
  expect(await page.locator('.turnbar div.now').innerText()).toBe(dmLine);
  expect(dmLine).toContain(ids.pcName);
  // Back to the DM: full names, no stale players' text; and back again: no stale DM text.
  await page.evaluate(() => (window as any).__mistlab.app.setView('dm'));
  await expect(page.locator('.turnbar .cb')).toHaveText([/Ghoul/, new RegExp(ids.pcName), /Ghoul/]);
  await page.evaluate(() => { const a = (window as any).__mistlab.app; a.setTokenHidden(a.state.encounter.order[0].tokenId, true); a.nextTurn(-1); a.setView('players'); });
  expect(SECRET.exec((await pageStrings(page)).replace(/Pale crawler/g, ''))?.[0]).toBeUndefined();
  await expect(page.locator('.turnbar div.now')).toHaveText('Round 1');
  await display.close();
});

test('a DM card open when the view flips to the players\' side is gone (slider and peek)', async ({ page }) => {
  await boot(page, 'dev/m0-test-room');
  for (const flip of ['slider', 'peek'] as const) {
    await page.evaluate(() => (window as any).__mistlab.setT(1));
    await page.evaluate(() => (window as any).__mistlab.tips.openCard({ kind: 'creature', creatureId: 'ghoul' }, { anchor: { left: 100, right: 120, top: 200, bottom: 220, width: 20, height: 20 } }));
    await expect(page.locator('#tips .rt.monster')).toBeVisible();
    if (flip === 'slider') await page.evaluate(() => (window as any).__mistlab.setT(0));
    else { await page.evaluate(() => (window as any).__mistlab.setT(0)); await page.locator('.vs-peek').dispatchEvent('pointerdown'); await page.waitForTimeout(400); await page.locator('.vs-peek').dispatchEvent('pointerup'); await page.waitForTimeout(400); }
    await expect(page.locator('#tips > *')).toHaveCount(0);
  }
});

// ---- one source: the stat-block card and the token panel read the same numbers, in each edition
for (const ed of ['2024', '2014'] as const) {
  test(`${ed}: the ghoul's card and its token panel show lookup('ghoul', '${ed}'); the name opens the stat block`, async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await boot(page, 'dev/m0-test-room', ed);
    const s = await page.evaluate((ed) => (window as any).__mistlab.lookup('ghoul', ed).then((e: any) => e.summary), ed);
    await page.evaluate(() => { const a = (window as any).__mistlab.app; const g = a.addCreatureNearParty('ghoul'); a.select(g.id); });
    await expect(page.locator('.tokpanel .tp-stats .rl.pill')).toHaveCount(5);
    const pills = await page.locator('.tokpanel .tp-stats .rl.pill').allInnerTexts();
    expect(pills.map((p) => p.trim())).toEqual(expect.arrayContaining([`AC ${s.ac}`, `${s.hp} hp`, `CR ${s.cr}`]));
    await expect(page.locator('.tokpanel .tp-src')).toHaveText(ed === '2024' ? '2024 · SRD 5.2.1' : '2014 · SRD 5.1');
    await expect(page.locator('.tokpanel button.danger[data-a="remove"]')).toHaveCount(1);
    await page.locator('.tokpanel .tp-name .rl.monster').click();
    const card = page.locator('#tips .rt.monster');
    await expect(card.locator('h4')).toHaveText('Ghoul');
    const tiles = await card.locator('.tile b').allInnerTexts();
    expect(tiles[0]).toBe(String(s.ac)); expect(tiles[1]).toBe(String(s.hp)); expect(tiles[3]).toBe(String(s.cr));
    await expect(card.locator('.src .who')).toContainText(ed === '2024' ? '2024 · SRD 5.2.1' : '2014 · SRD 5.1');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/step3-tokpanel-ghoul-${ed}.png` });
    // A stat pill opens its rule.
    await page.keyboard.press('Escape');
    await page.locator('.tokpanel .rl.pill', { hasText: 'AC' }).click();
    await expect(page.locator('#tips .rt.rule h4')).toHaveText(/Armor Class/);
  });
}

test('Creatures sheet: names open stat blocks, the meta is pills, places are area links, Stat block unfolds the full block; mongrelfolk has none', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page);
  await page.locator('[data-act="creatures"]').click();
  await page.locator('.csearch').fill('ghoul');
  const row = page.locator('.crow[data-id="ghoul"]');
  await expect(row.locator('.cpills .rl.pill')).toHaveCount(5);
  await row.locator('[data-a="block"]').click();
  await expect(row.locator('.cblock .statblock .full')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/step3-bestiary-ghoul.png` });
  await page.locator('.csearch').fill('strahd');
  const strahd = page.locator('.crow[data-id="strahd-von-zarovich"]');
  await expect(strahd.locator('.ctags .rl.pageref')).toHaveAttribute('data-name', 'Castle Ravenloft');
  await expect(strahd.locator('.cname > b')).toHaveText('Strahd von Zarovich');
  await page.locator('.csearch').fill('mongrelfolk');
  const mf = page.locator('.crow[data-id="mongrelfolk"]');
  await expect(mf.locator('.csrc')).toHaveText('Curse of Strahd creature: no open stat block · Module stats');
  await mf.locator('.rl.monster').click();
  await expect(page.locator('#tips .rt.monster .note')).toHaveText('Curse of Strahd creature: no open stat block');
  await expect(page.locator('#tips .rt.monster .src .who')).toHaveText('Module stats');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-bestiary-mongrelfolk.png` });
});

test('Initiative headers, the Rooms sheet\'s page references, Help\'s colour key and the world map pins are rules links', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page);
  await page.locator('[data-act="encounter"]').click();
  await expect(page.locator('.sheet.encounter.page .roster th .rl.pill')).toHaveText(['Speed', 'Reach', 'Range', 'Darkvision', 'Initiative']);
  await page.locator('.roster th .rl', { hasText: 'Darkvision' }).click();
  await expect(page.locator('#tips .rt.sense h4')).toHaveText(/Darkvision/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-initiative-headers.png` });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((s) => s.remove()));
  await page.locator('[data-act="rooms"]').click();
  await expect(page.locator('.rooms.page .room .rl.pageref').first()).toHaveText(/^p\.\d+$/);
  await page.locator('.rooms .room .rl.pageref').first().click();
  await expect(page.locator('#tips .rt[data-kind="pageref"]')).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-rooms-pageref.png` });
  await page.keyboard.press('Escape');
  await page.locator('[data-act="rooms"]').click();
  await page.locator('[data-cam="help"]').click();
  const key = page.locator('.sheet.help.page dd.colours .rl');
  await expect(key).toHaveCount(5);
  expect(await key.evaluateAll((els) => els.map((e) => getComputedStyle(e).textDecorationStyle))).toEqual(['dashed', 'double', 'wavy', 'dotted', 'solid']);
  await expect(page.locator('.sheet.help dd.attrib').first()).toContainText('Creative Commons Attribution 4.0');
  await page.locator('.sheet.help dd.colours .rl.monster').click();
  await expect(page.locator('#tips .rt.monster h4')).toHaveText('Wolf');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-help-colours.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((s) => s.remove()));
  // The world map: a pin's card with its blurb and the DM note's links.
  await page.locator('[data-act="world"]').click();
  await page.locator('.world-key li[data-key="K"]').click();
  await expect(page.locator('.world-card.page .wc-dm')).toBeVisible();
  expect(await page.locator('.world-card .wc-blurb .rl').evaluateAll((els) => els.filter((e) => !['condition', 'rule', 'action', 'sense', 'damage', 'ability', 'skill'].includes((e as HTMLElement).dataset.kind!)).length)).toBe(0);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-world-K.png` });
});

test('the clock: Difficult terrain, Mounted and the pace are rules links; the pace note follows the edition, the times do not', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-act="clock"]')!.click());
  const pop = page.locator('.clockpop.page');
  await expect(pop.locator('.rl')).toHaveText(['Normal pace', 'Difficult terrain', 'Mounted']);
  await pop.locator('select[data-t="pace"]').selectOption('fast');
  const out = async () => (await pop.locator('.ck-out').innerText()).trim();
  await expect(pop.locator('.ck-note')).not.toHaveText('');
  const in2024 = await out(), btn2024 = await pop.locator('[data-a="travel"]').innerText();
  await page.evaluate(() => (window as any).__mistlab.setEdition('2014'));
  await expect(pop.locator('.ck-note')).toHaveText('−5 passive Perception');
  const in2014 = await out();
  expect(in2014.split(' · ')[0]).toBe(in2024.split(' · ')[0]);
  expect(in2014).not.toBe(in2024);
  expect(await pop.locator('[data-a="travel"]').innerText()).toBe(btn2024);
  expect(in2014.split(' · ')[0]).toBe('1 h 30 min');
  await pop.locator('.rl', { hasText: 'Difficult terrain' }).click();
  await expect(page.locator('#tips .rt.rule h4')).toHaveText(/Difficult Terrain/);
  // the checkbox was not toggled by opening the card
  expect(await pop.locator('input[data-t="difficult"]').isChecked()).toBe(false);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/step3-clock.png` });
  await page.evaluate(() => (window as any).__mistlab.setEdition('2024'));
});

// ---- the Books reader: sibling cross-links and the T4 typography
const siblingAudit = (page: Page) => page.evaluate(() => {
  const art = document.querySelector('article.br-page[data-page]')!;
  const book = (art as HTMLElement).dataset.book, edition = book === 'srd-5.1' ? '2014' : '2024';
  const seen = new Map<string, Set<string>>(), bad: string[] = [];
  let head = '', n = 0;
  const walker = document.createTreeWalker(art, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.nextNode() as HTMLElement | null; el; el = walker.nextNode() as HTMLElement | null) {
    if (/^H[1-6]$/.test(el.tagName)) { head = el.id || el.textContent || ''; continue; }
    if (!el.matches('.rl')) continue;
    n++;
    const entry = el.closest<HTMLElement>('.entry'), sec = entry?.dataset.id ? `e:${entry.dataset.id}` : `h:${head}`;
    const s = seen.get(sec) ?? seen.set(sec, new Set()).get(sec)!;
    if (s.has(el.dataset.term!)) bad.push(`twice in ${sec}: ${el.dataset.term}`);
    s.add(el.dataset.term!);
    if (entry && entry.dataset.id === el.dataset.term) bad.push(`to itself: ${el.dataset.term}`);
    if (el.dataset.edition !== edition) bad.push(`other edition: ${el.dataset.term}`);
    if (el.closest('h1, h2, h3, h4, h5, h6, th, caption')) bad.push(`in a heading: ${el.dataset.term}`);
  }
  return { n, bad };
});

for (const [book, anchor] of [['srd-5.2.1', 'rule-grappling'], ['srd-5.1', 'condition-grappled'], ['srd-5.2.1', 'monster-ghoul'], ['srd-5.1', 'monster-wolf']] as const) {
  test(`Books ${book} ${anchor}: sibling terms link once per section, never to themselves, in the same edition`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
    await page.goto(`/?nosw&scene=appB%2Fdeath-house#book/${book}/${anchor}`);
    await expect(page.locator('article.br-page[data-page]')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await siblingAudit(page)).n, { timeout: 20_000 }).toBeGreaterThan(5);
    await page.waitForTimeout(500);
    const a = await siblingAudit(page);
    expect(a.bad).toEqual([]);
    // A cross-link opens its card in place, in the book's own edition.
    const link = page.locator('article.br-page .rl').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page.locator('#tips .rt .src .who')).toContainText(book === 'srd-5.1' ? '2014' : '2024');
  });
}

test('Books typography: the initial only on a chapter\'s opening paragraph, 44 px contents links, the running head; both campaigns, light and dark', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1180, height: 820 });
  for (const [scene, scheme, name] of [['appB/death-house', 'light', 'cos-light'], ['appB/death-house', 'dark', 'cos-dark'], ['wsc/02-street', 'light', 'wsc-light'], ['wsc/02-street', 'dark', 'wsc-dark']] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
    await page.goto(`/?nosw&scene=${encodeURIComponent(scene)}#book/srd-5.2.1/playing-the-game`);
    await expect(page.locator('article.br-page[data-page="playing-the-game"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('article.br-page p.open')).toHaveCount(1);
    const initials = await page.evaluate(() => [...document.querySelectorAll('article.br-page p')].filter((p) => !['', 'normal', '0'].includes(getComputedStyle(p, '::first-letter').getPropertyValue('initial-letter').trim())).map((p) => p.className));
    expect(initials).toEqual(['open']);
    expect(await page.locator('.br-toc button').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 44).length)).toBe(0);
    await expect(page.locator('.br-run-t')).toContainText('Playing the Game');
    expect(await page.locator('.book-reader').evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/^rgb\(/);
    await expect.poll(() => page.locator('article.br-page .rl').count(), { timeout: 20_000 }).toBeGreaterThan(5);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/step3-books-${name}.png` });
  }
});
