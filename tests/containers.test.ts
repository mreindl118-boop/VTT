import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OPENABLE_KINDS, validateScene, type SceneFile } from '../app/src/core/schema';

describe('containers', () => {
  const scene = JSON.parse(readFileSync('locations/appB/death-house/scene.json', 'utf8')) as SceneFile;
  it('every openable Death House object is mapped with its contents', () => {
    const unmapped: string[] = [];
    for (const l of scene.levels) for (const o of l.objects) if (OPENABLE_KINDS[o.kind] && !o.container?.contents) unmapped.push(o.id);
    expect(unmapped).toEqual([]);
  });
  it('locked containers match the book: the den cabinet and the five cultist chests', () => {
    const locked = scene.levels.flatMap((l) => l.objects).filter((o) => o.container?.locked).map((o) => o.id).sort();
    expect(locked).toEqual(['dungeon-chest25A', 'dungeon-chest25B', 'dungeon-chest25C', 'dungeon-chest25D', 'dungeon-chest25E', 'f1-cab-e']);
  });
  it('reveals point at real objects', () => { expect(validateScene(scene)).toEqual([]); });
});
