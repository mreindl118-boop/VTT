// Rules cards and links (docs/THEME.md '.rt and .rl', docs/CLARITY.md tier B): one card per kind with its stripe,
// emblem and kicker word; link underlines per family; contrast on the opaque page card in all four themes, also as
// rendered pixels over three scenes; the fonts' byte budget; and the card offline with fonts and emblems from cache.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS ?? 'test-results';
type Spec = Record<string, unknown>;
/** One fixture per kind: [kind, spec, family, kicker word, card class]. */
const KINDS: [string, Spec, string, string, string][] = [
  ['spell', { term: 'spell:fireball' }, 'magic', 'spell', 'spell'],
  ['magic-item', { term: 'item:bag-of-holding' }, 'magic', 'magic item', 'item'],
  ['gear', { term: 'item:longsword' }, 'rules', 'gear', 'item'],
  ['condition', { term: 'condition:grappled' }, 'condition', 'condition', 'condition'],
  ['monster', { term: 'monster:wolf' }, 'monster', 'monster', 'monster'],
  ['creature-type', { term: 'creature-type:undead' }, 'monster', 'creature type', 'monster'],
  ['rule', { term: 'rule:grappling' }, 'rules', 'rule', 'rule'],
  ['action', { term: 'rule:dash' }, 'rules', 'action', 'action'],
  ['sense', { term: 'rule:darkvision' }, 'rules', 'sense', 'sense'],
  ['damage', { term: 'damage:fire' }, 'rules', 'damage type', 'damage'],
  ['ability', { term: 'ability:strength' }, 'rules', 'ability', 'ability'],
  ['skill', { term: 'skill:perception' }, 'rules', 'skill', 'skill'],
  ['feat', { term: 'feat:alert' }, 'rules', 'feat', 'rule'],
  ['class', { term: 'class:wizard' }, 'rules', 'class', 'rule'],
  ['check', { kind: 'check', dc: 15, ability: 'Dexterity', skill: "Thieves' Tools" }, 'rules', 'check', 'check'],
  ['dice', { kind: 'dice', expr: '2d8 + 2' }, 'rules', 'dice', 'dice'],
  ['area', { kind: 'area', key: '2A', name: 'Main Hall', floor: 'Ground floor', revealed: false }, 'pageref', 'area', 'pageref'],
  ['person', { kind: 'person', name: 'Rose', role: 'Ghost' }, 'pageref', 'person', 'pageref'],
  ['pageref', { kind: 'pageref', page: 216 }, 'pageref', 'module page', 'pageref'],
];
const UNDERLINE: Record<string, string> = { condition: 'dashed', magic: 'double', monster: 'wavy', rules: 'dotted', pageref: 'solid' };
const THEMES = [
  { name: 'cos-light', scene: 'appB/death-house', scheme: 'light' as const, attr: null },
  { name: 'cos-dark', scene: 'appB/death-house', scheme: 'dark' as const, attr: null },
  { name: 'wsc-light', scene: 'wsc/02-street', scheme: 'dark' as const, attr: 'light' },
  { name: 'wsc-dark', scene: 'wsc/02-street', scheme: 'light' as const, attr: 'dark' },
];

async function boot(page: Page, scene: string, scheme: 'light' | 'dark' = 'light', attr: string | null = null, sw = false): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
  await page.goto(`/?${sw ? '' : 'nosw&'}scene=${encodeURIComponent(scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  // the explicit theme override (the app's data-theme gate), over whatever the OS asks for
  if (attr) await page.evaluate((attr) => { document.documentElement.dataset.theme = attr; }, attr);
}
const openCard = (page: Page, spec: Spec, anchor = { left: 60, right: 80, top: 140, bottom: 160, width: 20, height: 20 }) =>
  page.evaluate(({ spec, anchor }) => (window as any).__mistlab.tips.openCard(spec, { anchor }).then((e: unknown) => !!e), { spec, anchor });

// in-page colour helpers (WCAG contrast of computed rgb() strings)
const COLOR_FNS = `
  window.__rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  window.__lum = (s) => { const [r, g, b] = window.__rgb(s).slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  window.__cr = (a, b) => { const [x, y] = [window.__lum(a), window.__lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };`;

test.describe('one card per kind', () => {
  test.beforeEach(async ({ page: _p }, info) => { test.skip(info.project.name !== 'chromium', 'desktop'); });
  for (const th of THEMES) {
    test(`${th.name}: every kind's card has its stripe, a 20 px emblem and its kicker word; links carry their family's underline`, async ({ page }) => {
      await boot(page, th.scene, th.scheme, th.attr);
      await page.addScriptTag({ content: COLOR_FNS });
      const dark = th.name.endsWith('dark');
      const fam = await page.evaluate((dark) => Object.fromEntries(['condition', 'magic', 'monster', 'rules'].map((f) => {
        const p = document.createElement('i'); p.style.color = getComputedStyle(document.documentElement).getPropertyValue(`--k-${f}-${dark ? 'd' : 'l'}`).trim(); document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return [f, c];
      })), dark);
      await page.evaluate(() => { const g = document.createElement('div'); g.id = 'gallery'; document.body.appendChild(g); });
      for (const [kind, spec, family, word, cls] of KINDS) {
        expect(await openCard(page, spec), kind).toBe(true);
        const card = page.locator('#tips .rt');
        await expect(card).toHaveClass(new RegExp(`\\b${cls}\\b`));
        const got = await card.evaluate((el) => {
          const cs = getComputedStyle(el), e = el.querySelector('.kick svg.e')!.getBoundingClientRect();
          return { bw: cs.borderLeftWidth, bc: cs.borderLeftColor, bg: cs.backgroundColor, ink: getComputedStyle(el.querySelector('h4')!).color, ew: e.width, eh: e.height, kick: el.querySelector('.kick .w')!.textContent!, use: (el.querySelector('.kick svg.e use') as SVGUseElement).getBBox().width };
        });
        expect(got.bw, kind).toBe('5px');
        expect(got.bc, kind).toBe(family === 'pageref' ? got.ink : fam[family]);
        expect([got.ew, got.eh], kind).toEqual([20, 20]);
        expect(got.use, `${kind} emblem drawn`).toBeGreaterThan(0);
        expect(got.kick.startsWith(word), `${kind}: ${got.kick}`).toBe(true);
        expect(got.bg, kind).toMatch(/^rgb\(/); // opaque: alpha 1
        // no emblem anywhere under 20 px
        expect(await page.evaluate(() => [...document.querySelectorAll('#tips svg.e')].filter((s) => { const r = s.getBoundingClientRect(); return r.width < 20 || r.height < 20; }).length)).toBe(0);
        // keep a copy for the gallery screenshot
        await page.evaluate((kind) => { const c = document.querySelector('#tips .rt')!.cloneNode(true) as HTMLElement; c.removeAttribute('id'); c.querySelector('h4')?.removeAttribute('id'); c.dataset.fixture = kind; document.getElementById('gallery')!.appendChild(c); }, kind);
      }
      // inline links: the family colour and the family's own underline style
      const links = await page.evaluate(() => {
        const box = document.createElement('div'); box.className = 'page'; box.style.cssText = 'position:fixed;left:0;top:0;background:var(--p-bg);padding:8px';
        box.innerHTML = ['spell', 'item magic rare', 'condition', 'monster', 'rule', 'action', 'sense', 'damage', 'item', 'pageref'].map((c) => `<button type="button" class="rl ${c}" data-c="${c}">x</button>`).join(' ');
        document.body.appendChild(box);
        const out = Object.fromEntries([...box.querySelectorAll<HTMLElement>('.rl')].map((b) => [b.dataset.c!, { style: getComputedStyle(b).textDecorationStyle, color: getComputedStyle(b).color, line: getComputedStyle(b).textDecorationLine }]));
        box.remove(); return out;
      });
      const want: Record<string, string> = { spell: 'magic', 'item magic rare': 'magic', condition: 'condition', monster: 'monster', rule: 'rules', action: 'rules', sense: 'rules', damage: 'rules', item: 'rules', pageref: 'pageref' };
      for (const [c, f] of Object.entries(want)) {
        expect(links[c].style, c).toBe(UNDERLINE[f]);
        expect(links[c].line, c).toContain('underline');
        if (f !== 'pageref') expect(links[c].color, c).toBe(fam[f]);
      }
      // the gallery: every kind's card in this theme, side by side
      await page.evaluate(() => { (window as any).__mistlab.tips.closeAll(); document.getElementById('stage')!.style.visibility = 'hidden'; document.getElementById('ui')!.style.visibility = 'hidden'; });
      await page.addStyleTag({ content: '#gallery { position: fixed; inset: 0; z-index: 60; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 14px; padding: 14px; overflow: hidden; background: #3a3442; } #gallery .rt { position: relative !important; left: auto !important; top: auto !important; max-height: none !important; }' });
      await page.setViewportSize({ width: 1840, height: 2000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/cards-${th.name}.png` });
    });
  }
});

test.describe('contrast on the opaque card', () => {
  test.beforeEach(async ({ page: _p }, info) => { test.skip(info.project.name !== 'chromium', 'desktop'); });
  for (const th of THEMES) {
    test(`${th.name}: background alpha 1; kicker, title, body, footer and link text 4.5:1; underline and stripe 3:1`, async ({ page }) => {
      await boot(page, th.scene, th.scheme, th.attr);
      await page.addScriptTag({ content: COLOR_FNS });
      for (const spec of [{ term: 'spell:fireball' }, { term: 'condition:grappled' }, { term: 'item:vorpal-sword' }, { term: 'monster:wolf' }, { kind: 'pageref', page: 216 }]) {
        expect(await openCard(page, spec)).toBe(true);
        const r = await page.evaluate(() => {
          const w = window as any, el = document.querySelector('#tips .rt') as HTMLElement, cs = getComputedStyle(el);
          // put one link of each family into the body, as running text will have them
          el.querySelector('.body')!.insertAdjacentHTML('beforeend', '<p>a <button type="button" class="rl spell">l</button> <button type="button" class="rl condition">l</button> <button type="button" class="rl monster">l</button> <button type="button" class="rl rule">l</button> <button type="button" class="rl pageref">l</button></p>');
          const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) ?? []);
          const bgs = [cs.backgroundColor, ...stops];
          const texts = [...el.querySelectorAll<HTMLElement>('.kick .w, h4, .meta, .stats dt, .stats dd, .body p, .body li, .body .rl, .statblock b, .statblock small, .src')].map((e) => ({ what: e.className || e.tagName, c: getComputedStyle(e).color }));
          const min = (c: string) => Math.min(...bgs.map((b) => w.__cr(c, b)));
          return {
            alpha: (w.__rgb(cs.backgroundColor)[3] ?? 1), stops: stops.length,
            text: texts.map((t) => ({ ...t, cr: min(t.c) })).filter((t) => t.cr < 4.5),
            stripe: min(cs.borderLeftColor),
            underline: Math.min(...[...el.querySelectorAll<HTMLElement>('.body .rl')].map((l) => min(getComputedStyle(l).textDecorationColor))),
          };
        });
        expect(r.alpha, JSON.stringify(spec)).toBe(1);
        expect(r.stops).toBe(2);
        expect(r.text, JSON.stringify(spec)).toEqual([]);
        expect(r.stripe).toBeGreaterThanOrEqual(3);
        expect(r.underline).toBeGreaterThanOrEqual(3);
      }
    });
  }

  // the DM-only block on the tap menu and the object card is tinted: every family's link keeps 4.5:1 on that tint too
  for (const th of THEMES) {
    test(`${th.name}: links inside the DM-only block 4.5:1 on its tint`, async ({ page }) => {
      await boot(page, th.scene, th.scheme, th.attr);
      await page.addScriptTag({ content: COLOR_FNS });
      const r = await page.evaluate(() => {
        const w = window as any, cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const x = cv.getContext('2d', { willReadFrequently: true })!;
        // composite the page and the block's own background into one sRGB pixel (color-mix computes to color(srgb ...))
        const flat = (layers: string[]) => { x.clearRect(0, 0, 1, 1); for (const l of layers) { x.fillStyle = '#000'; x.fillStyle = l; x.fillRect(0, 0, 1, 1); } const d = x.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
        const links = '<button type="button" class="rl spell">l</button> <button type="button" class="rl item magic rare">l</button> <button type="button" class="rl condition">l</button> <button type="button" class="rl monster">l</button> <button type="button" class="rl rule">l</button> <button type="button" class="rl check">l</button> <button type="button" class="rl pageref">l</button>';
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;z-index:99';
        host.innerHTML = `<div class="tapmenu page" style="position:relative"><div class="roomhead"><div class="dm"><span class="dm-tag">DM only</span>a ${links}</div></div></div><div class="infocard page" style="position:relative"><div class="dm"><span class="dm-tag">DM only</span>a ${links}</div></div>`;
        document.body.appendChild(host);
        const out: { where: string; c: string; cr: number }[] = [];
        for (const dm of host.querySelectorAll<HTMLElement>('.dm')) {
          const surface = dm.closest<HTMLElement>('.page')!;
          const bg = flat([getComputedStyle(surface).backgroundColor, getComputedStyle(dm).backgroundColor]);
          for (const el of dm.querySelectorAll<HTMLElement>('.rl, .dm-tag')) out.push({ where: `${surface.className} ${el.className}`, c: getComputedStyle(el).color, cr: w.__cr(flat([getComputedStyle(el).color]), bg) });
        }
        host.remove();
        return out;
      });
      expect(r.length).toBe(16);
      expect(r.filter((t) => t.cr < 4.5), JSON.stringify(r)).toEqual([]);
    });
  }

  for (const s of [
    { name: 'Death House at night', scene: 'appB/death-house', night: true, scheme: 'light' as const, attr: null },
    { name: 'Death House at night (dark)', scene: 'appB/death-house', night: true, scheme: 'dark' as const, attr: null },
    { name: 'the Amber Temple snow', scene: 'ch13/X', night: false, scheme: 'light' as const, attr: null },
    { name: 'the Sheep Chase street', scene: 'wsc/02-street', night: false, scheme: 'light' as const, attr: null },
    { name: 'the Sheep Chase street (dark)', scene: 'wsc/02-street', night: false, scheme: 'light' as const, attr: 'dark' },
  ]) {
    test(`rendered pixels behind card text over ${s.name}: text 4.5:1 or more (nothing shows through)`, async ({ page }) => {
      await boot(page, s.scene, s.scheme, s.attr);
      await page.addScriptTag({ content: COLOR_FNS });
      if (s.night) await page.evaluate(() => { const a = (window as any).__mistlab.app; a.setClock(a.clock.day, 0); });
      await page.evaluate(() => { const m = (window as any).__mistlab; m.frame('tabletop'); m.render(); });
      // the card sits over the middle of the map
      expect(await openCard(page, { term: 'condition:grappled' }, { left: 300, right: 320, top: 180, bottom: 200, width: 20, height: 20 })).toBe(true);
      const card = page.locator('#tips .rt');
      await page.waitForTimeout(300); // past the 120 ms fade-in
      const box = (await card.boundingBox())!;
      const colours = await card.evaluate((el) => [...el.querySelectorAll<HTMLElement>('.kick .w, h4, .body p, .body li, .src .who')].map((e) => getComputedStyle(e).color));
      const style = await page.addStyleTag({ content: '#tips .rt, #tips .rt * { color: transparent !important; text-decoration-color: transparent !important; } #tips svg.e, #tips .seal { visibility: hidden !important; }' });
      const png = await page.screenshot({ animations: 'disabled', clip: box, path: `${SHOTS}/hidden-text-${s.name.replace(/[^a-z]+/gi, '-').toLowerCase()}.png` });
      await style.evaluate((e) => (e as HTMLElement).remove());
      await page.screenshot({ path: `${SHOTS}/pixels-${s.name.replace(/[^a-z]+/gi, '-').toLowerCase()}.png` });
      const worst = await page.evaluate(async ({ b64, box, colours }) => {
        const w = window as any;
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const x = cv.getContext('2d')!; x.drawImage(img, 0, 0);
        const el = document.querySelector('#tips .rt')!;
        const nodes = [...el.querySelectorAll<HTMLElement>('.kick .w, h4, .body p, .body li, .src .who')];
        let worst = 99, samples = 0;
        nodes.forEach((n, i) => {
          for (const r of n.getClientRects()) for (let yy = r.top + 2; yy < r.bottom - 2; yy += 4) for (let xx = r.left + 2; xx < Math.min(r.right, box.x + box.width) - 2; xx += 9) {
            const px = x.getImageData(Math.round(xx - box.x), Math.round(yy - box.y), 1, 1).data;
            worst = Math.min(worst, w.__cr(colours[i], `rgb(${px[0]}, ${px[1]}, ${px[2]})`)); samples++;
          }
        });
        return { worst, samples };
      }, { b64: png.toString('base64'), box, colours });
      expect(worst.samples).toBeGreaterThan(100);
      expect(worst.worst).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test('fonts: the first load fetches 40,000 B of woff2 or less (nothing is preloaded)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'desktop');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let bytes = 0;
  const pending: Promise<void>[] = [];
  ctx.on('response', (r) => { if (/\.woff2(\?|$)/.test(r.url())) pending.push(r.body().then((b) => { bytes += b.length; }, () => {})); });
  await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
  await page.goto('/?scene=appB%2Fdeath-house', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await Promise.all(pending);
  expect(bytes).toBeLessThanOrEqual(40_000);
  await ctx.close();
});

test('offline: after cache-pack, the Wolf card opens with Alegreya SC, Alegreya and the emblems from the cache', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'desktop');
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
  await page.goto('/?scene=appB%2Fdeath-house');
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  // The books data a card reads, in both editions (step 2 preloads the term files on the DM side; here the test fetches them).
  await page.evaluate(() => Promise.all(['srd-5.2.1', 'srd-5.1'].flatMap((b) => [`books/${b}/terms.json`, `books/${b}/e/monsters.json`]).map((u) => fetch(u))));
  // cache-pack: the six fonts; the warm-ups: the emblem and card code. Nothing here opened a card or used a font.
  expect(await page.evaluate(() => document.fonts.check('700 21px "Alegreya SC"') && [...document.fonts].some((f) => f.family.includes('Alegreya') && f.status === 'loaded'))).toBe(false);
  await expect.poll(() => page.evaluate(async () => {
    const keys = (await (await caches.open('mistlab-v1')).keys()).map((r) => r.url);
    return keys.filter((u) => /\/fonts\/.*\.woff2$/.test(u)).length + (keys.some((u) => /\/assets\/emblems-[\w-]+\.js$/.test(u)) ? 10 : 0) + (keys.some((u) => /\/assets\/rulecard-[\w-]+\.js$/.test(u)) ? 100 : 0);
  }), { timeout: 40_000 }).toBe(116);
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await ctx.route('**/*', (r) => r.abort('internetdisconnected'));
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  expect(await openCard(page, { term: 'monster:wolf' })).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const fonts = await page.evaluate(() => {
    const st = (fam: string, style = 'normal') => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === fam && f.style === style).map((f) => f.status);
    return { sc: st('Alegreya SC'), book: st('Alegreya'), emblem: (document.querySelector('#tips .rt .kick svg.e use') as SVGUseElement).getBBox().width };
  });
  expect(fonts.sc).toContain('loaded');
  expect(fonts.book).toContain('loaded');
  expect(fonts.emblem).toBeGreaterThan(0);
  expect(failed).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/offline-wolf.png` });
  await ctx.unroute('**/*');
  await ctx.setOffline(false);
  await ctx.close();
});

test('phone: a card docks as a bottom sheet with a grab bar, inside the viewport', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone');
  await boot(page, 'appB/death-house');
  expect(await openCard(page, { term: 'monster:wolf' })).toBe(true);
  const r = await page.locator('#tips .rt').evaluate((el) => { const b = el.getBoundingClientRect(); return { sheet: el.classList.contains('docked'), top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, grab: getComputedStyle(el.querySelector('.grab')!).display }; });
  expect(r.sheet).toBe(true);
  expect(r.grab).toBe('block');
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(390);
  expect(r.bottom).toBeLessThanOrEqual(844 + 1);
  expect(r.h).toBeLessThanOrEqual(844 / 2 + 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/phone-sheet-wolf.png` });
  // a condition card too, and an outside tap closes it
  expect(await openCard(page, { term: 'condition:grappled' })).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/phone-sheet-condition.png` });
  await page.touchscreen.tap(195, 200);
  await expect(page.locator('#tips .rt')).toHaveCount(0);
});

test('iPad: a tap on a rules link opens its card clear of the link; Esc and an outside tap close it', async ({ page }, info) => {
  test.skip(info.project.name !== 'ipad', 'iPad');
  await boot(page, 'appB/death-house');
  await page.evaluate(() => document.querySelector('.topbar .group.left')!.insertAdjacentHTML('beforeend', '<span class="page" style="padding:6px;background:var(--p-bg)"><button type="button" class="rl condition" data-kind="condition" data-term="condition:prone">prone</button></span>'));
  await page.locator('.rl.condition').tap();
  await expect(page.locator('#tips .rt.condition')).toBeVisible();
  const [a, c] = await page.evaluate(() => [document.querySelector('.rl.condition')!.getBoundingClientRect().toJSON(), document.querySelector('#tips .rt')!.getBoundingClientRect().toJSON()]);
  expect(c.top >= a.bottom || c.bottom <= a.top || c.left >= a.right || c.right <= a.left).toBe(true);
  expect(c.right).toBeLessThanOrEqual(1180); expect(c.bottom).toBeLessThanOrEqual(820);
  await expect(page.locator('.rl.condition')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tips .rt')).toHaveCount(0);
  await page.locator('.rl.condition').tap();
  await expect(page.locator('#tips .rt')).toBeVisible();
  await page.touchscreen.tap(600, 600);
  await expect(page.locator('#tips .rt')).toHaveCount(0);
});

test('phone: the Books reader\'s running head has a 44 px Contents button that opens the contents', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone');
  await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
  await page.goto('/?nosw&scene=appB%2Fdeath-house#book/srd-5.2.1/playing-the-game');
  await expect(page.locator('article.br-page[data-page]')).toBeVisible({ timeout: 20_000 });
  const b = page.locator('.br-run-toc');
  await expect(b).toBeVisible();
  const r = await b.boundingBox();
  expect(r!.height).toBeGreaterThanOrEqual(44); expect(r!.width).toBeGreaterThanOrEqual(44);
  await b.tap();
  await expect(page.locator('.book-reader.toc-open')).toHaveCount(1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/phone-books-contents.png` });
  expect(await page.locator('.br-toc button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).length)).toBe(0);
});

// ---- step 3: every kind opened from a real link on each device, the stat block at a glance, the edition switch
/** One link per kind, as the surfaces and the Books reader render them (terms.ts, booklinks.ts, cards.ts, creature.ts). */
const LINKS: [string, string][] = [
  ['spell', '<button type="button" class="rl spell" data-kind="spell" data-term="spell:bless">bless</button>'],
  ['magic-item', '<button type="button" class="rl item magic" data-kind="magic-item" data-term="item:cloak-of-protection">cloak of protection</button>'],
  ['gear', '<button type="button" class="rl item" data-kind="gear" data-term="item:longsword" data-edition="2024">longsword</button>'],
  ['condition', '<button type="button" class="rl condition" data-kind="condition" data-term="condition:prone">prone</button>'],
  ['monster', '<button type="button" class="rl monster" data-kind="monster" data-term="monster:ghast">ghasts</button>'],
  ['creature-type', '<button type="button" class="rl monster" data-kind="creature-type" data-term="creature-type:undead" data-edition="2024">Undead</button>'],
  ['rule', '<button type="button" class="rl rule" data-kind="rule" data-term="rule:difficult-terrain">difficult terrain</button>'],
  ['action', '<button type="button" class="rl action" data-kind="action" data-term="rule:dash" data-edition="2024">Dash</button>'],
  ['sense', '<button type="button" class="rl sense" data-kind="sense" data-term="rule:darkvision">darkvision</button>'],
  ['damage', '<button type="button" class="rl damage" data-kind="damage" data-term="damage:necrotic">necrotic</button>'],
  ['ability', '<button type="button" class="rl ability" data-kind="ability" data-term="ability:wisdom">Wisdom</button>'],
  ['skill', '<button type="button" class="rl skill" data-kind="skill" data-term="skill:perception">Perception</button>'],
  ['feat', '<button type="button" class="rl rule" data-kind="feat" data-term="feat:alert" data-edition="2024">Alert</button>'],
  ['class', '<button type="button" class="rl rule" data-kind="class" data-term="class:wizard" data-edition="2024">Wizard</button>'],
  ['check', '<button type="button" class="rl check" data-kind="check" data-dc="15" data-ability="DEX" data-skill="Thieves\' Tools">DC 15 Dexterity (thieves\' tools)</button>'],
  ['dice', '<button type="button" class="rl dice" data-kind="dice" data-expr="2d10">2d10</button>'],
  ['area', '<button type="button" class="rl pageref" data-kind="area" data-key="21" data-name="Stairs" data-floor="Floor 1">21</button>'],
  ['person', '<button type="button" class="rl pageref" data-kind="person" data-name="Rose" data-role="Ghost">Rose</button>'],
  ['pageref', '<button type="button" class="rl pageref" data-kind="pageref" data-page="212">p.212</button>'],
  ['creature', '<button type="button" class="rl monster" data-kind="monster" data-creature="mongrelfolk" data-name="Mongrelfolk">Mongrelfolk</button>'],
];
const STRUCTURAL = new Set(['check', 'dice', 'area', 'person', 'pageref', 'creature']);

test('every kind: a 400 ms hover (desktop) or one tap (iPad, phone) opens a card inside the viewport, clear of its link, with its emblem, kicker and source; Esc and an outside tap close it', async ({ page }, info) => {
  test.setTimeout(120_000);
  const touch = info.project.name !== 'chromium';
  await boot(page, 'appB/death-house');
  await page.evaluate((links) => {
    const box = document.createElement('div'); box.className = 'page kinds-demo';
    box.style.cssText = 'position:fixed;left:12px;top:70px;right:12px;z-index:3;padding:6px 10px;background:var(--p-bg);border:1px solid var(--p-edge);border-radius:8px;font:15px/2.1 var(--font-book);display:flex;flex-wrap:wrap;gap:0 14px';
    box.innerHTML = links.map(([k, h]) => `<span data-k="${k}">${h}</span>`).join('');
    document.body.appendChild(box);
  }, LINKS);
  const vp = page.viewportSize()!;
  for (const [i, [kind]] of LINKS.entries()) {
    const link = page.locator(`.kinds-demo [data-k="${kind}"] .rl`);
    if (touch) await link.tap();
    else { await page.mouse.move(2, vp.height - 2); await link.hover(); await page.waitForTimeout(450); }
    const card = page.locator('#tips .rt');
    await expect(card, kind).toBeVisible();
    await page.waitForTimeout(150);
    const g = await page.evaluate(() => {
      const c = document.querySelector('#tips .rt')!, r = c.getBoundingClientRect(), a = document.querySelector('.kinds-demo .rl[aria-expanded="true"]')?.getBoundingClientRect();
      const e = c.querySelector('.kick svg.e')!.getBoundingClientRect();
      return { r: r.toJSON(), a: a?.toJSON(), docked: c.classList.contains('docked'), ew: e.width, kick: c.querySelector('.kick .w')!.textContent, who: c.querySelector('.src .who')?.textContent ?? '' };
    });
    expect(g.r.left, kind).toBeGreaterThanOrEqual(0); expect(g.r.top, kind).toBeGreaterThanOrEqual(0);
    expect(g.r.right, kind).toBeLessThanOrEqual(vp.width + 0.5); expect(g.r.bottom, kind).toBeLessThanOrEqual(vp.height + 0.5);
    if (vp.width < 480) expect(g.docked, kind).toBe(true);
    else if (g.a) expect(g.r.top >= g.a.bottom || g.r.bottom <= g.a.top || g.r.left >= g.a.right || g.r.right <= g.a.left, `${kind} clear of its link`).toBe(true);
    expect(g.ew, kind).toBe(20);
    expect(g.kick, kind).toBeTruthy();
    expect(g.who, kind).toMatch(STRUCTURAL.has(kind) ? /Table|Module/ : /^(2024|2014) · SRD/);
    if (kind === 'condition' && info.project.name === 'chromium') await page.screenshot({ path: `${SHOTS}/step3-condition-card.png` });
    // close: Esc on even turns, an outside tap or click on odd ones
    if (i % 2 === 0) await page.keyboard.press('Escape');
    else {
      // outside: above a bottom sheet (phone), else below the card
      const y = g.docked ? Math.round(g.r.top - 40) : vp.height - 40;
      if (touch) await page.touchscreen.tap(vp.width / 2, y); else await page.mouse.click(vp.width / 2, y);
    }
    await expect(page.locator('#tips .rt'), `${kind} closed`).toHaveCount(0);
  }
});

for (const name of ['ghoul', 'wolf'] as const) for (const ed of ['2024', '2014'] as const) {
  test(`stat block ${name} ${ed}: ink name and labels, the accent only on the section hairlines, lining tabular numerals, no overflow, all at a glance`, async ({ page }, info) => {
    await boot(page, 'appB/death-house');
    const vp = page.viewportSize()!;
    await page.evaluate(({ name, ed }) => (window as any).__mistlab.tips.openCard({ term: `monster:${name}`, edition: ed }, { anchor: { left: 40, right: 60, top: 80, bottom: 100, width: 20, height: 20 } }), { name, ed });
    const card = page.locator('#tips .rt.monster');
    await expect(card.locator('.statblock .abil')).toBeVisible();
    const glance = await card.evaluate((c) => {
      const r = c.getBoundingClientRect(), inside = (sel: string) => [...c.querySelectorAll(sel)].every((e) => { const b = e.getBoundingClientRect(); return b.top >= r.top && b.bottom <= r.bottom + 0.5; });
      return { tiles: c.querySelectorAll('.tile').length, all: inside('.tile') && inside('.abil div'), scroll: c.scrollTop, overflow: c.scrollWidth - c.clientWidth };
    });
    expect(glance.tiles).toBe(4);
    if (info.project.name === 'ipad' || vp.width >= 1000) expect(glance.all, 'AC, HP, Speed, CR and the abilities without scrolling').toBe(true);
    expect(glance.overflow).toBeLessThanOrEqual(0);
    if (info.project.name !== 'chromium' && name === 'ghoul' && ed === '2024') {
      // the evidence shot: only once the card is on screen and fully faded in
      await expect(card).toBeVisible();
      await expect.poll(() => card.evaluate((c) => getComputedStyle(c).opacity)).toBe('1');
      await page.screenshot({ path: `${SHOTS}/step3-ghoul-${info.project.name}.png` });
      await expect(card, 'still open after the shot').toBeVisible();
    }
    await card.locator('button.more').click();
    await expect(card.locator('.statblock .full')).toBeVisible();
    const s = await card.evaluate((c) => {
      const ink = getComputedStyle(c).color, acc = (() => { const p = document.createElement('i'); p.style.color = 'var(--p-accent)'; c.appendChild(p); const v = getComputedStyle(p).color; p.remove(); return v; })();
      const accentBorders = [...c.querySelectorAll('.statblock *')].filter((e) => { const cs = getComputedStyle(e); return (['Top', 'Right', 'Bottom', 'Left'] as const).some((side) => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Color`] === acc); }).map((e) => e.tagName);
      return { ink, name: getComputedStyle(c.querySelector('h4')!).color, labels: [...c.querySelectorAll('.statblock .prop b')].map((b) => getComputedStyle(b).color), accentBorders, nums: [...c.querySelectorAll('.statblock .abil b')].map((b) => getComputedStyle(b).fontVariantNumeric), overflow: c.scrollWidth - c.clientWidth };
    });
    expect(s.name).toBe(s.ink);
    expect(s.labels.length).toBeGreaterThan(0);
    expect(new Set(s.labels)).toEqual(new Set([s.ink]));
    expect(s.accentBorders.length).toBeGreaterThan(0);
    expect(s.accentBorders.every((t) => /^H[3-6]$/.test(t)), s.accentBorders.join()).toBe(true);
    expect(s.nums).toHaveLength(6);
    for (const n of s.nums) { expect(n).toContain('lining-nums'); expect(n).toContain('tabular-nums'); }
    expect(s.overflow).toBeLessThanOrEqual(0);
  });
}

test('edition: the Rules edition changes the badge and the words of exhaustion and grappled; a one-edition rule says so', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'desktop');
  await boot(page, 'appB/death-house');
  for (const term of ['condition:exhaustion', 'condition:grappled']) {
    await page.evaluate(() => (window as any).__mistlab.setEdition('2024'));
    await openCard(page, { term });
    const card = page.locator('#tips .rt.condition');
    await expect(card.locator('.src .who')).toContainText('2024 · SRD 5.2.1');
    const body24 = await card.locator('.body').innerText();
    await page.evaluate(() => (window as any).__mistlab.setEdition('2014'));
    await expect(card.locator('.src .who')).toContainText('2014 · SRD 5.1');
    expect(await page.locator('#tips .rt.condition .body').innerText()).not.toBe(body24);
    // the card swapped in place: fully opaque at once
    expect(await page.locator('#tips .rt.condition').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
    if (term === 'condition:exhaustion') { await page.waitForTimeout(250); await page.screenshot({ path: `${SHOTS}/step3-exhaustion-2014.png` }); }
    await page.keyboard.press('Escape');
  }
  await openCard(page, { term: 'rule:challenge-rating' });
  await expect(page.locator('#tips .rt .src .only')).toHaveText('⚠ 2024 only');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__mistlab.setEdition('2024'));
  // magic items take their rarity colour on the kicker and the name
  for (const [term, rar] of [['item:bag-of-holding', 'uncommon'], ['item:vorpal-sword', 'legendary']]) {
    await openCard(page, { term });
    await expect(page.locator(`#tips .rt.item.magic.${rar} .kick .w`)).toContainText(`magic item · ${rar}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/step3-item-${rar}.png` });
    await page.keyboard.press('Escape');
  }
});
