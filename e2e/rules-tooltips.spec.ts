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
