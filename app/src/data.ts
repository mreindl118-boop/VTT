// Location data discovery. Paths are relative to locations/, e.g. "dev/m0-test-room", "appB/death-house".
import type { GridFile, SceneFile } from './core/schema';

const scenes = import.meta.glob<SceneFile>('../../locations/**/scene.json', { import: 'default' });
const grids = import.meta.glob<GridFile>('../../locations/**/grid.json', { import: 'default' });

const toPath = (k: string) => k.replace('../../locations/', '').replace(/\/scene\.json$/, '');

export const builtPaths = new Set(Object.keys(scenes).map(toPath));

export async function loadLocation(path: string): Promise<{ scene: SceneFile; grid: GridFile }> {
  const s = scenes[`../../locations/${path}/scene.json`];
  const g = grids[`../../locations/${path}/grid.json`];
  if (!s || !g) throw new Error(`location not built: ${path}`);
  const [scene, grid] = await Promise.all([again(s), again(g)]);
  return { scene, grid };
}

/** A module that failed to load (offline) stays failed in the browser's module map for the life of the page: once
 *  the network is back, ask for the same file under a fresh query, so the map opens without a reload. (The browser's
 *  message names the file in Chromium and Firefox; where it does not, the first error stands.) */
async function again<T>(f: () => Promise<T>): Promise<T> {
  try { return await f(); } catch (e) {
    const url = /https?:\/\/\S+?\.js\b/.exec(String((e as Error)?.message ?? e))?.[0];
    if (!url) throw e;
    return ((await import(/* @vite-ignore */ `${url}?again=${Date.now()}`)) as { default: T }).default;
  }
}
