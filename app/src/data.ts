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
  const [scene, grid] = await Promise.all([s(), g()]);
  return { scene, grid };
}
