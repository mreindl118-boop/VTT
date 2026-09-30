import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SceneFile } from '../app/src/core/schema';

// Hidden or disguised things carry a player-facing name, so a revealed card never shows the DM label.
describe('player-facing names', () => {
  const scene = JSON.parse(readFileSync('locations/appB/death-house/scene.json', 'utf8')) as SceneFile;
  it('every hidden Death House object has a playerLabel distinct from DM detail', () => {
    const missing: string[] = [];
    for (const l of scene.levels) for (const o of l.objects)
      if (o.vis && o.vis !== 'player' && o.vis !== 'dm-note' && !o.playerLabel) missing.push(o.id);
    expect(missing).toEqual([]);
  });
  it('player names never repeat DM-only notes', () => {
    for (const l of scene.levels) for (const o of l.objects) {
      if (!o.playerLabel) continue;
      expect(o.playerLabel).not.toMatch(/\(|DC \d|Strahd|Durst|mimic|disguised/i);
    }
  });
});
