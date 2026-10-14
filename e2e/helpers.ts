import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The version under test (package.json), for marking the "What's new" card as already seen. */
export const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** Start each page as a returning user on this version: no first-run Help and no "What's new" card. */
export async function quiet(page: Page): Promise<void> {
  await page.addInitScript((v) => { localStorage.setItem('mistlab.helpSeen', '1'); localStorage.setItem('mistlab.seenVersion', v); }, VERSION);
}

/** Scenes the acceptance suites run against: the M0 test room and Death House (M1), by level. */
export const SCENES = [
  { scene: 'dev/m0-test-room', level: 'ground', spawn: [22.5, 17.5], keys: ['key:T1', 'key:T2', 'key:T3'], secret: 'sd-t1-t3', hidden: 'ob-t2-chest', room: 'T2' },
  { scene: 'appB/death-house', level: 'f2', spawn: [12.5, 27.5], keys: ['key:10', 'key:6', 'key:7A', 'key:7B', 'key:8', 'key:9'], secret: 'f2-sdo-lib', hidden: 'f2-chest9', room: '9' },
  { scene: 'appB/death-house', level: 'dungeon-lower', spawn: [27.5, 12.5], keys: ['key:35', 'key:36', 'key:37', 'key:38'], secret: 'dungeon-lower-sdo-prison', hidden: 'dungeon-lower-ring', room: '36' },
];

export async function boot(page: Page, query = '', scene = SCENES[0]): Promise<void> {
  await page.goto(`/?nosw&scene=${encodeURIComponent(scene.scene)}${query}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
  await page.evaluate(({ level, spawn }) => { const m = (window as any).__mistlab; m.moveParty(level, spawn[0], spawn[1]); m.app.frameLevel(); }, scene);
}

/** Read the WebGL canvas into window.__snaps[name] (kept in-page; large arrays never cross CDP). */
export async function snap(page: Page, name: string): Promise<void> {
  await page.evaluate((name) => {
    const m = (window as any).__mistlab;
    m.render();
    const c = document.querySelector('canvas.gl') as HTMLCanvasElement;
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const x = o.getContext('2d')!;
    x.drawImage(c, 0, 0);
    ((window as any).__snaps ??= {})[name] = x.getImageData(0, 0, c.width, c.height);
  }, name);
}

/** Count differing pixels between two snaps; optionally count those outside a (dilated) white mask. */
export async function diff(page: Page, a: string, b: string, mask?: string): Promise<{ changed: number; outside: number; total: number }> {
  return page.evaluate(({ a, b, mask }) => {
    const s = (window as any).__snaps;
    const A: ImageData = s[a], B: ImageData = s[b], M: ImageData | undefined = mask ? s[mask] : undefined;
    const w = A.width, h = A.height;
    let changed = 0, outside = 0;
    // Mask is MSAA-resolved: any non-black value means at least one floor sample lies under that pixel.
    const white = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && M!.data[(y * w + x) * 4] > 32;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const d = Math.max(Math.abs(A.data[k] - B.data[k]), Math.abs(A.data[k + 1] - B.data[k + 1]), Math.abs(A.data[k + 2] - B.data[k + 2]));
        if (d <= 6) continue; // transparent-sort blending noise is ≤4 levels; grid lines differ by 20+
        changed++;
        if (M) {
          // A grid pixel must sit on, or within 2 px (MSAA fringe) of, a visible floor pixel.
          let ok = false;
          for (let dy = -2; dy <= 2 && !ok; dy++) for (let dx = -2; dx <= 2 && !ok; dx++) ok = white(x + dx, y + dy);
          if (!ok) outside++;
        }
      }
    return { changed, outside, total: w * h };
  }, { a, b, mask });
}

/** Words a reader can see inside an element: text nodes that are rendered, not hidden, not clipped away. */
export async function countVisibleWords(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return 0;
    let n = 0;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const el = t.parentElement;
      if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = document.createRange(); r.selectNodeContents(t);
      if (!Array.from(r.getClientRects()).some((q) => q.width > 0 && q.height > 0)) continue;
      n += (t.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
    }
    return n;
  }, selector);
}

/** A single touch tap on an element (touchscreen, not a mouse click); returns the text of the tip it opened, if any. */
export async function tapTip(page: Page, selector: string): Promise<string | null> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`nothing to tap: ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('#tips .tip.pinned, #tips .rt');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    return at && t.contains(at) ? (t.querySelector('b, h4')?.textContent ?? t.textContent) : null;
  });
}

/** A touch press held for `ms` (raw CDP touch events, so the browser sees a real long press). */
export async function touchHold(page: Page, selector: string, ms: number, during?: () => Promise<void>): Promise<void> {
  const box = (await page.locator(selector).first().boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  if (during) await during();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  await cdp.detach();
}

/** Activate a visible authored endpoint with real pointer/touch input, including its route chooser. */
export async function takeRoute(page: Page, linkId: string, end: 'from' | 'to', touch = false): Promise<void> {
  const marker = page.locator(`.lbl.link[data-routes~="${linkId}:${end}"]:visible`);
  await marker.waitFor({state:'visible',timeout:5000});
  const grouped = await marker.getAttribute('aria-haspopup') === 'menu';
  if (touch) await marker.tap(); else await marker.click();
  if (grouped) {
    const choice = page.getByRole('menu', { name: 'Choose route' }).locator(`[data-link-id="${linkId}"][data-link-end="${end}"]`);
    if (touch) await choice.tap(); else await choice.click();
  }
}
