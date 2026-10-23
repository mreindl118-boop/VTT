// The massing digest (manifests/world-massing.json): what each place of the continuous world looks like from afar, read
// from its own map (scripts/world-massing.ts), for its detailed proxy (app/src/render/proxydetail.ts).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMassing, serializeMassing, REPO } from '../scripts/world-massing.ts';
import atlas from '../manifests/world-atlas.json';

const massing = buildMassing();

describe('world massing', () => {
  it('the committed manifests/world-massing.json is fresh (npm run massing regenerates it)', () => {
    expect(readFileSync(join(REPO, 'manifests/world-massing.json'), 'utf8') === serializeMassing(massing), 'manifests/world-massing.json is stale: run npm run massing').toBe(true);
  });
  it('every pin root but Castle Ravenloft has a digest, with ground', () => {
    const roots = Object.values(atlas.scenes as Record<string, { path: string; depth: number; orphan?: boolean; pin?: string; worldBounds?: unknown }>).filter((e) => e.depth === 0 && !e.orphan && e.pin && e.worldBounds).map((e) => e.path);
    expect(Object.keys(massing.sites).sort()).toEqual(roots.filter((p) => p !== 'ch04/K').sort());
    for (const [p, s] of Object.entries(massing.sites)) expect(s.floors.length, p).toBeGreaterThan(0);
  });
  it('Krezk keeps its rock and its road, Vallaki its houses and palisade, Tser Pool its pool', () => {
    const kinds = (p: string) => massing.sites[p].kits.map((k) => k[0]);
    expect(kinds('ch08/S')).toEqual(expect.arrayContaining(['heightfield', 'road-ribbon', 'krezk-wall', 'cottage']));
    const n = (s: string, rec: number) => (s ? Buffer.from(s, 'base64').length / 2 / rec : 0);
    expect(n(massing.sites['ch05/N'].houses, 8)).toBeGreaterThan(1000);
    expect(n(massing.sites['ch05/N'].lines, 7)).toBeGreaterThan(500);
    expect(n(massing.sites['ch08/S'].trees, 6)).toBeGreaterThan(2000);
    expect(kinds('ch02/G')).toContain('water');
  });
});
