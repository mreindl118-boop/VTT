// The players' side, swept (the tooltip pass, step 3): every room and object card of all 45 scenes and every pin of
// both world maps, as Players view and the slider's players' end show them, with every rules link in them opened.
// No DM-only link kind (monster, creature type, person, area, page reference, check, dice), no DM note, no hidden
// thing's DM label, and no trigger under a DM-only ancestor. Desktop only.
import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

test.beforeEach(async ({ page: _p }, info) => { test.skip(info.project.name !== 'chromium', 'desktop'); });

async function boot(page: Page, scene: string, nested = true): Promise<void> {
  await quiet(page);
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene)}&nested=${nested ? 1 : 0}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(async () => { const m = (window as any).__mistlab; await m.ready; await m.rich(); });
}

/** In the page: check the open menu or card and every card its links open. Returns the problems found. */
const AUDIT = `
window.__audit = async (where, secrets) => {
  const DM = new Set(['monster', 'creature-type', 'person', 'area', 'pageref', 'check', 'dice', 'spell', 'magic-item', 'gear', 'item', 'feat', 'class', 'feature', 'species', 'background']);
  const bad = [];
  const surf = document.querySelector('#ui .tapmenu, #ui .infocard');
  if (!surf) return { bad, n: 0, links: 0 };
  const strings = (el) => { const out = [el.textContent || '']; for (const e of [el, ...el.querySelectorAll('*')]) for (const a of e.attributes) out.push(a.value); return out.join('\\n'); };
  const scan = (el, what) => {
    const s = strings(el);
    for (const x of secrets) if (s.includes(x)) bad.push(where + ' ' + what + ': DM text "' + x.slice(0, 50) + '"');
    for (const l of el.querySelectorAll('.rl')) if (DM.has(l.dataset.kind)) bad.push(where + ' ' + what + ': a ' + l.dataset.kind + ' link');
    for (const l of el.querySelectorAll('.rl, [data-tip], button.tt')) if (l.closest('.dm-only, .dm-note, .lbl.key, .dm')) bad.push(where + ' ' + what + ': a trigger under a DM-only ancestor');
  };
  scan(surf, 'card');
  const links = [...surf.querySelectorAll('.rl')];
  for (const l of links) {
    l.click();
    let card = null;
    for (let i = 0; i < 40 && !card; i++) { await new Promise((r) => setTimeout(r, 25)); card = document.querySelector('#tips .rt'); }
    if (card) { scan(card, 'link card'); if (DM.has(card.dataset.kind)) bad.push(where + ': a ' + card.dataset.kind + ' card'); }
    window.__mistlab.tips.closeAll();
  }
  return { bad, n: 1, links: links.length };
};`;

test('every room and object card of all 45 scenes, in Players view and at the slider\'s players\' end', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1180, height: 820 });
  await boot(page, 'appB/death-house');
  await page.addScriptTag({ content: AUDIT });
  const scenes: string[] = await page.evaluate(() => (window as any).__mistlab.scenes());
  expect(scenes.length).toBe(45);
  let cards = 0, links = 0;
  const problems: string[] = [];
  for (const path of scenes) {
    const r = await page.evaluate(async (path) => {
      const m = (window as any).__mistlab, a = m.app;
      await a.open(path);
      const secrets: string[] = [];
      for (const l of a.cur.scene.levels) {
        for (const r of l.rooms) if (r.dm && r.dm.length >= 12) secrets.push(r.dm);
        for (const o of l.objects) {
          if (o.dm && o.dm.length >= 12) secrets.push(o.dm);
          // what players call it once they can see it (core/objectText.ts playerLabel: a hidden thing by its kind)
          const kindName = String(o.kind).replace(/-/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
          const pl = o.playerLabel ?? (o.vis === 'player' || !o.vis ? o.label ?? kindName : kindName);
          // a hidden thing's DM label, unless the players read the same words anyway (a room named 'Fearful Mongrelfolk')
          if (o.label && o.vis && o.vis !== 'player' && o.label !== pl && o.label.length >= 8 && !a.cur.scene.levels.some((x: any) => x.rooms.some((r: any) => r.name.includes(o.label)))) secrets.push(o.label);
        }
      }
      const bad: string[] = []; let n = 0, k = 0;
      for (const side of ['players', 'preview']) {
        if (side === 'players') { a.setView('players'); m.setT(1); } else { a.setView('dm'); m.setT(0); }
        for (const l of a.cur.scene.levels) {
          if (a.levelId !== l.id) a.setLevel(l.id);
          const tap = async (hit: unknown, what: string) => {
            a.onTap(hit, 420, 240);
            const res = await (window as any).__audit(`${path} ${side} ${what}`, secrets);
            bad.push(...res.bad); n += res.n; k += res.links;
          };
          for (const r of l.rooms) await tap(side === 'players' ? { pos: [0, 0], room: a.tapRoom(r, true) } : { pos: [0, 0], room: a.tapRoom(r, false) }, r.key);
          for (const o of l.objects) {
            const room = l.rooms.find((x: any) => x.key === o.key);
            await tap(side === 'players' ? { pos: [0, 0], object: a.tapObject(o, true) } : { pos: [0, 0], object: a.tapObject(o, false), room: room ? a.tapRoom(room, false) : undefined }, o.id);
          }
        }
      }
      a.setView('dm'); m.setT(1);
      document.querySelectorAll('#ui .tapmenu, #ui .infocard').forEach((e) => e.remove());
      return { bad, n, k };
    }, path);
    problems.push(...r.bad); cards += r.n; links += r.k;
  }
  expect(problems.slice(0, 40)).toEqual([]);
  expect(cards).toBeGreaterThan(3000);
  console.log(`players' sweep: ${cards} cards, ${links} links opened`);
});

for (const [scene, camp] of [['appB/death-house', 'Barovia'], ['wsc/02-street', 'the Sheep Chase']] as const) {
  for (const nested of [false, true]) test(`every pin of ${camp}'s ${nested ? 'nested' : 'flat'} world map, every place revealed, in Players view: no DM note, only players' links`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1180, height: 820 });
    await boot(page, scene, nested);
    // Every place revealed, so the players' map shows them all; the DM notes are the secrets.
    const secrets: string[] = await page.evaluate(() => {
      const m = (window as any).__mistlab;
      const pins = m.pins();
      for (const p of pins) m.app.revealPin(p.key, true);
      m.app.setView('players');
      return pins.map((p: any) => p.dm).filter((d: string | undefined) => d && d.length >= 12);
    });
    expect(secrets.length).toBeGreaterThan(3);
    await page.locator('[data-act="world"]').click();
    if (nested) {
      await page.waitForFunction(() => !(window as any).__mistlab.app.world.flying);
      await page.locator('.nestbar [data-places]').click();
    }
    const lis = page.locator(`${nested ? '.nestkey' : '.world-key'} li:not([hidden])`);
    const n = await lis.count();
    expect(n).toBeGreaterThanOrEqual(5);
    const DM = ['monster', 'creature-type', 'person', 'area', 'pageref', 'check', 'dice', 'spell', 'magic-item', 'gear', 'item'];
    const bad: string[] = [];
    for (let i = 0; i < n; i++) {
      if (nested) await lis.nth(i).locator('.place-action').evaluate((e: HTMLElement) => e.click());
      else await lis.nth(i).click();
      await expect(page.locator(`${nested ? '.nestcard' : '.world-card'} .wc-where`)).toBeVisible();
      // the hover tip too: a pointer over the pin
      const key = await lis.nth(i).getAttribute('data-key');
      await page.evaluate(({ key, nested }) => {
        if (nested) (window as any).__mistlab.nest.hover(key, 300, 300);
        else document.querySelector(`.wm-pin[data-key="${key}"]`)?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 300 }));
      }, { key, nested });
      const r = await page.evaluate(({ DM, secrets }) => {
        const out: string[] = [];
        for (const el of document.querySelectorAll('.world-card, .world-tip, .nestcard, .nesttip')) {
          if (!el) continue;
          const s = [el.textContent ?? '', ...[el, ...el.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value))].join('\n');
          for (const x of secrets) if (s.includes(x)) out.push(`DM note: ${x.slice(0, 40)}`);
          for (const l of el.querySelectorAll<HTMLElement>('.rl')) if (DM.includes(l.dataset.kind!)) out.push(`${l.dataset.kind} link`);
          if (el.querySelector('.wc-dm, .dm, [data-reveal]')) out.push('DM part');
        }
        return out;
      }, { DM, secrets });
      bad.push(...r.map((x) => `${key}: ${x}`));
    }
    expect(bad).toEqual([]);
  });
}
