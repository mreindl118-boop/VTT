// What an encounter pack is checked against, read from the repo: creature ids, built scenes' levels and keys, terrains.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PackContext } from '../../app/src/core/encounterPack.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function repoContext(root = ROOT): PackContext {
  const chars = JSON.parse(readFileSync(join(root, 'manifests/characters.json'), 'utf8')) as { characters: { id: string; kind: string }[] };
  const creatures = new Set(chars.characters.filter((c) => c.kind !== 'token' && c.kind !== 'pc').map((c) => c.id));
  const scenes: PackContext['scenes'] = new Map();
  const locs = join(root, 'locations');
  for (const ch of readdirSync(locs)) for (const loc of readdirSync(join(locs, ch))) {
    const f = join(locs, ch, loc, 'scene.json'); if (!existsSync(f)) continue;
    const s = JSON.parse(readFileSync(f, 'utf8')) as { levels: { id: string; rooms: { key: string }[] }[]; nonSpatialKeys?: string[] };
    scenes.set(`${ch}/${loc}`, { levels: s.levels.map((l) => ({ id: l.id, keys: l.rooms.map((r) => r.key) })), nonSpatialKeys: s.nonSpatialKeys });
  }
  const enc = JSON.parse(readFileSync(join(root, 'manifests/encounters.json'), 'utf8')) as { terrain: { id: string }[] };
  return { creatures, scenes, terrains: new Set(enc.terrain.map((t) => t.id)) };
}
