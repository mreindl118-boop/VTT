// Organization: manifests mirror the book; every built scene key resolves to the manifest and vice versa.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import locations from '../manifests/locations.json';
import characters from '../manifests/characters.json';
import encounters from '../manifests/encounters.json';
import campaigns from '../manifests/campaigns.json';
import wsc from '../manifests/wsc-locations.json';
import { sceneAreaKeys, validateScene, type GridFile, type SceneFile } from '../app/src/core/schema';

type Loc = (typeof locations.locations)[number];

describe('manifests', () => {
  it('location ids are unique and area keys are unique within a location', () => {
    const ids = locations.locations.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of locations.locations) {
      const keys = l.areas.map((a) => a.key);
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dup, `${l.id} duplicate keys`).toEqual([]);
    }
  });
  it('every location belongs to a chapter and its path mirrors chapter/location', () => {
    const ch = new Set(locations.chapters.map((c) => c.id));
    for (const l of locations.locations) {
      expect(ch.has(l.chapter), l.id).toBe(true);
      expect(l.path).toBe(`locations/${l.chapter}/${l.id}`);
    }
  });
  it('the seed from §7 is complete', () => {
    const count = (id: string) => locations.locations.find((l) => l.id === id)!.areas.length;
    expect(count('death-house')).toBe(63); // 38 numbered keys + 25 lettered sub-areas
    expect(count('Q')).toBe(53);
    expect(count('N2')).toBe(17);
    expect(count('N3')).toBe(20);
    expect(count('N4')).toBe(20);
    expect(count('T')).toBe(9);
    expect(count('barovia-region')).toBe(26);
    const k = locations.locations.find((l) => l.id === 'K')!.areas.map((a) => a.key);
    for (let i = 1; i <= 88; i++) expect(k, `K${i}`).toContain(`K${i}`);
    for (const x of ['K18a', 'K20a', 'K31a', 'K31b', 'K60a', 'K83a', 'K74h', 'K75a', 'K84-1', 'K84-40']) expect(k).toContain(x);
    const x = locations.locations.find((l) => l.id === 'X')!.areas.map((a) => a.key);
    for (let i = 1; i <= 42; i++) expect(x, `X${i}`).toContain(`X${i}`);
    for (const s of ['X33a', 'X33f', 'X31b', 'X5d', 'X14a', 'X1a']) expect(x).toContain(s);
  });
  it('characters: unique ids, valid tiers/sizes, base ring matches size', () => {
    const ids = characters.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const ring = { tiny: 0.5, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 } as Record<string, number>;
    for (const c of characters.characters) {
      expect([1, 2, 3, 4]).toContain(c.tier);
      expect(c.baseIn).toBe(ring[c.size]);
    }
    expect(ids).toContain('strahd-von-zarovich');
    expect(characters.characters.filter((c) => c.tier === 1).length).toBe(78);
  });
  it('encounters reference known locations', () => {
    const ids = new Set(locations.locations.map((l) => l.id));
    for (const e of encounters.specialEvents) expect(ids.has(e.location), e.id).toBe(true);
  });
});

describe('built scenes', () => {
  const root = 'locations';
  const scenes: { path: string; scene: SceneFile; grid: GridFile }[] = [];
  for (const ch of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()))
    for (const loc of readdirSync(join(root, ch.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const p = join(root, ch.name, loc.name);
      if (!existsSync(join(p, 'scene.json'))) continue;
      scenes.push({ path: p, scene: JSON.parse(readFileSync(join(p, 'scene.json'), 'utf8')), grid: JSON.parse(readFileSync(join(p, 'grid.json'), 'utf8')) });
    }

  it('found at least the M0 test room', () => expect(scenes.length).toBeGreaterThan(0));

  for (const { path, scene, grid } of scenes) {
    it(`${path} validates`, () => expect(validateScene(scene, grid)).toEqual([]));
    if (scene.chapter === 'dev') continue;
    it(`${path}: no orphan keys (manifest <-> scene)`, () => {
      const camp = campaigns.campaigns.find((c) => c.prefixes.includes(scene.chapter))!;
      expect(camp, `campaign for chapter ${scene.chapter}`).toBeTruthy();
      const list = (camp.manifest === 'locations.json' ? locations.locations : (wsc as unknown as { locations: Loc[] }).locations) as Loc[];
      const m = list.find((l: Loc) => l.id === scene.location)!;
      expect(m, `manifest location ${scene.location}`).toBeTruthy();
      expect(`locations/${scene.chapter}/${scene.location}`).toBe(path.replace(/\\/g, '/'));
      const want = new Set(m.areas.map((a) => a.key)), have = new Set(sceneAreaKeys(scene));
      if (scene.partial) for (const k of have) expect(want, `manifest key for ${k}`).toContain(k);
      else expect(have).toEqual(want);
    });
  }
});
