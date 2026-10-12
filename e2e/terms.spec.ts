// Rules links in module text (app/src/ui/terms.ts) in the running app: the DM window loads the term files on its own,
// Death House's notes render with spell, check, area, person and monster links in their families' colours and
// underlines, a link opens its card, and the same strings on the players' side carry no link at all.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS ?? 'test-results';

async function boot(page: Page, scene = 'appB/death-house'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('mistlab.helpSeen', '1'));
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene)}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}

/** Render a few strings of the open scene into a page surface, for one audience. */
const panel = (page: Page, audience: 'dm' | 'player', picks: [string, string][]) => page.evaluate(async ({ audience, picks }) => {
  const m = (window as any).__mistlab, t = await m.terms();
  t.setSceneSource((p: string) => (m.app.cur?.path === p ? m.app.cur.scene : undefined));
  await t.ready('2024'); await t.readyKinds('2024');
  const sc = m.app.cur.scene, path = m.app.cur.path;
  const find = (id: string) => { for (const l of sc.levels) { const r = l.rooms.find((x: any) => `room:${l.id}/${x.key}` === id); if (r) return r; const o = l.objects.find((x: any) => x.id === id); if (o) return o; } };
  const el = document.createElement('div');
  el.className = `page terms-demo ${audience}`;
  el.style.cssText = `position:fixed;top:64px;${audience === 'dm' ? 'left:12px' : 'right:12px'};width:470px;max-height:640px;overflow:auto;z-index:3;padding:14px 16px;border-radius:10px;font:15px/1.5 var(--f-body, Alegreya, serif);background:var(--p-bg);color:var(--p-ink);border:1px solid var(--p-edge);box-shadow:var(--p-shadow)`;
  const seen = new Set<string>();
  el.innerHTML = `<h4 style="margin:0 0 8px;font:700 13px/1 'Alegreya SC',serif;letter-spacing:.06em;color:var(--p-ink-2)">${audience === 'dm' ? 'DM' : 'Players'} · 2024 rules</h4>` + picks.map(([id, field]) => {
    const o = find(id), text = String(o?.[field] ?? '');
    const spans = t.spansFor(text, { audience, edition: '2024', field, scenePath: path, entityId: id });
    return `<p style="margin:0 0 10px"><b style="font:600 12px/1 system-ui;color:var(--p-ink-2)">${id} · ${field}</b><br>${t.renderSpans(text, spans, seen)}</p>`;
  }).join('');
  document.body.appendChild(el);
  return [...el.querySelectorAll('.rl')].map((b) => [b.textContent, b.getAttribute('data-kind'), b.getAttribute('data-term'), b.getAttribute('data-label')]);
}, { audience, picks });

const PICKS: [string, string][] = [
  ['f2-chest9', 'dm'], ['f1-cab-lock', 'dm'], ['room:f1/2A', 'dm'], ['room:dungeon/34', 'dm'], ['room:attic/20', 'dm'], ['dungeon-pit', 'dm'],
];
const PLAYER_PICKS: [string, string][] = [['room:f1/1A', 'desc'], ['room:f1/1B', 'desc'], ['f2-chest9', 'desc'], ['room:dungeon/25', 'desc'], ['room:f2/6', 'desc']];

test.beforeEach(async ({ page: _p }, info) => { test.skip(info.project.name !== 'chromium', 'desktop'); });

test('DM: Death House notes link spells, checks, areas, people, monsters and dice; a link opens its card', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page);
  const dm = await panel(page, 'dm', PICKS);
  const kinds = (k: string) => dm.filter((x) => x[1] === k).map((x) => x[0]);
  expect(kinds('spell')).toEqual(['bless', 'protection from poison', 'spiritual weapon']);
  expect(dm.find((x) => x[0] === "DC 15 Dexterity (thieves' tools)")?.[3]).toBe("DC 15 · DEX (Thieves' Tools)");
  expect(dm.find((x) => x[0] === 'DC 12 Perception')?.[3]).toBe('DC 12 · Perception');
  expect(kinds('person')).toEqual(expect.arrayContaining(['Strahd', 'Gustav', 'Elisabeth', 'Rose', 'Thorn']));
  expect(kinds('monster')).toEqual(['ghasts']);
  expect(kinds('magic-item')).toEqual(['cloak of protection']);
  expect(kinds('dice')).toEqual(['1d6', '2d10']);
  expect(kinds('condition')).toEqual(['prone']);
  // The families' underlines: double for magic, dotted for rules, solid for people and places, wavy for monsters.
  const deco = await page.evaluate(() => Object.fromEntries(['spell', 'check', 'pageref', 'monster', 'condition'].map((c) => [c, getComputedStyle(document.querySelector(`.terms-demo.dm .rl.${c}`)!).textDecorationStyle])));
  expect(deco).toEqual({ spell: 'double', check: 'dotted', pageref: 'solid', monster: 'wavy', condition: 'dashed' });
  // The players' side: the same house, no link at all (no ordinary word, no monster, no check).
  const pl = await panel(page, 'player', PLAYER_PICKS);
  expect(pl).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/terms-dm-and-players.png` });
  // A link opens its rules card through the tooltip manager.
  await page.locator('.terms-demo.dm .rl.spell', { hasText: 'bless' }).click();
  await expect(page.locator('#tips .rt.spell')).toBeVisible();
  await expect(page.locator('#tips .rt.spell h4')).toHaveText(/bless/i);
  // The card sits above the page surface it came from, clear of its link.
  expect(await page.evaluate(() => { const r = document.querySelector('#tips .rt')!.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 20; return !!document.elementFromPoint(x, y)?.closest('#tips'); })).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-bless-card.png` });
  await page.keyboard.press('Escape');
  await page.locator('.terms-demo.dm .rl.check').first().click();
  await expect(page.locator('#tips .rt.check')).toBeVisible();
  await expect(page.locator('#tips .rt.check h4')).toHaveText(/DC 15/);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-check-card.png` });
  // The cabinet lock: the card title is the link's normalised label, and thieves' tools are a tool, not a skill.
  await page.keyboard.press('Escape');
  await page.locator('.terms-demo.dm .rl.check', { hasText: /thieves/i }).click();
  await expect(page.locator('#tips .rt.check h4')).toHaveText("DC 15 · DEX (Thieves' Tools)");
  await expect(page.locator('#tips .rt.check dt')).toContainText(['tool']);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-check-tool.png` });
  // A person card: the hood emblem and a home named from the manifests, never a raw tag ('K').
  await page.keyboard.press('Escape');
  await page.locator('.terms-demo.dm .rl[data-kind="person"]', { hasText: 'Strahd' }).first().click();
  await expect(page.locator('#tips .rt[data-kind="person"] dd')).toContainText(['Castle Ravenloft']);
  await expect(page.locator('#tips .rt[data-kind="person"] .kick use')).toHaveAttribute('href', '#gi-hood');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-person-card.png` });
});

test('the DM window loads the term files by itself once the scene is ready', async ({ page }) => {
  const seen: string[] = [];
  page.on('response', (r) => { if (/books\/srd-[\d.]+\/terms\.json$/.test(r.url())) seen.push(r.url()); });
  await boot(page);
  await expect.poll(() => seen.length, { timeout: 15_000 }).toBe(2);
});

test('the Player Display never loads the term files', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { if (/terms\.json$|\/terms-[\w-]+\.js$/.test(r.url())) seen.push(r.url()); });
  await page.goto('/?nosw&display=player&scene=appB%2Fdeath-house');
  await page.waitForTimeout(5000);
  expect(seen).toEqual([]);
});

test('Amber Temple X24: the WIS save, sympathy as Antipathy/Sympathy and the X26 area', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page, 'ch13/X');
  const dm = await panel(page, 'dm', [['room:upper/X24', 'dm'], ['upper-X24-idol', 'dm'], ['room:upper/X27', 'dm'], ['room:upper/X9', 'dm'], ['room:lower/X33c', 'dm']]);
  expect(dm.find((x) => x[1] === 'check')?.[3]).toBe('DC 16 · WIS save');
  expect(dm.find((x) => x[0] === 'sympathy')?.slice(1, 3)).toEqual(['spell', 'spell:antipathy-sympathy']);
  expect(dm.find((x) => x[0] === 'X26')?.slice(1, 3)).toEqual(['area', 'area:ch13/X#X26']);
  const pl = await panel(page, 'player', [['room:upper/X24', 'desc'], ['room:upper/X5a', 'desc'], ['room:upper/X22', 'desc']]);
  expect(pl).toEqual([]);
  await page.locator('.terms-demo.dm .rl.spell', { hasText: 'sympathy' }).click();
  await expect(page.locator('#tips .rt.spell h4')).toHaveText(/Antipathy/i);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-x24-sympathy.png` });
  await page.keyboard.press('Escape');
  // X27: 'Exethanter the lich (99 hp … CR 10)' is the person; the books' CR 21 Lich never opens beside his own numbers.
  expect(dm.filter((x) => x[0] === 'lich')).toEqual([]);
  expect(dm.find((x) => x[0] === 'Exethanter')?.[1]).toBe('person');
  // An area link carries the map-pin emblem on its card.
  await page.locator('.terms-demo.dm .rl[data-kind="area"]', { hasText: 'X26' }).click();
  await expect(page.locator('#tips .rt[data-kind="area"] .kick use')).toHaveAttribute('href', '#gi-position-marker');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-x26-area.png` });
  await page.keyboard.press('Escape');
  // A stat block prints its XP with a thousands separator.
  await page.evaluate(() => document.querySelectorAll('.terms-demo').forEach((e) => e.remove()));
  await panel(page, 'dm', [['upper-X15-helwa', 'label'], ['room:upper/X27', 'dm']]);
  await page.locator('.terms-demo.dm .rl.monster', { hasText: 'gladiator' }).click();
  await expect(page.locator('#tips .rt.monster')).toContainText('1,800 XP');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/terms-gladiator-xp.png` });
});
