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
 *  the network is back, ask for the same file under a query, so the map opens without a reload. (The browser's
 *  message names the file in Chromium and Firefox; where it does not, the first error stands.) Each file is asked for
 *  again once at a time and, once it has come, never again: later reads share that module (one download, one copy).
 *  A retry that fails too is forgotten, and the next read tries the next query (the failed one is spoiled as well). */
const retried = new Map<string, Promise<unknown>>();
const tries = new Map<string, number>();
async function again<T>(f: () => Promise<T>): Promise<T> {
  try { return await f(); } catch (e) {
    const url = /https?:\/\/\S+?\.js\b/.exec(String((e as Error)?.message ?? e))?.[0];
    if (!url) throw e;
    let p = retried.get(url) as Promise<T> | undefined;
    if (!p) {
      const n = (tries.get(url) ?? 0) + 1;
      tries.set(url, n);
      p = import(/* @vite-ignore */ `${url}?again=${n}`).then((m: { default: T }) => m.default);
      retried.set(url, p);
      p.catch(() => { if (retried.get(url) === p) retried.delete(url); });
    }
    return p;
  }
}
