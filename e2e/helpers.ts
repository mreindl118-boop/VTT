import type { Page } from '@playwright/test';

export async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/?nosw${query}`);
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
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
          let ok = false;
          for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) ok = white(x + dx, y + dy);
          if (!ok) outside++;
        }
      }
    return { changed, outside, total: w * h };
  }, { a, b, mask });
}
