import type { Page } from '@playwright/test';

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
        if (d <= 2) continue;
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
