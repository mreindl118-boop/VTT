// The world atlas (manifests/world-atlas.json): every built map has a place in its valley, every blowout hangs from a room
// that opens it, and the committed file is what scripts/world-atlas.ts generates today.
import { describe, expect, it } from 'vitest';
import committed from '../manifests/world-atlas.json';
import barovia from '../locations/ch02/barovia-region/world.json';
import { buildAtlas, scenePaths, serialize, REPO, type Atlas } from '../scripts/world-atlas.ts';
import { pinY, worldOfMiles } from '../app/src/core/frames';
import type { WorldData } from '../app/src/campaigns';
import { join } from 'node:path';

const atlas = buildAtlas();
const scenes = Object.values(atlas.scenes);
const roots = scenes.filter((s) => s.worldBounds);

describe('world atlas', () => {
  it('the committed manifests/world-atlas.json is fresh (npm run atlas regenerates it)', () => {
    expect(JSON.parse(serialize(atlas)), 'manifests/world-atlas.json is stale: run npm run atlas').toEqual(committed as unknown as Atlas);
  });
  it('every built scene is present, once, with its campaign and chain', () => {
    const built = scenePaths(join(REPO, 'locations'));
    expect(Object.keys(atlas.scenes).sort()).toEqual(built.sort());
    for (const s of scenes) {
      expect(['cos', 'wsc']).toContain(s.campaign);
      expect(atlas.scenes[s.root], `${s.path}: root ${s.root}`).toBeDefined();
      expect(s.levels.length).toBeGreaterThan(0);
      expect(s.bbox.maxX).toBeGreaterThan(s.bbox.minX);
    }
  });
  it('every parent resolves to a room that enters the child; the church and Death House now hang from the village', () => {
    for (const s of scenes.filter((x) => x.parent)) {
      expect(atlas.scenes[s.parent!], `${s.path}: parent ${s.parent}`).toBeDefined();
      expect(s.enterRoom, `${s.path}: no enter room in ${s.parent}`).toBeDefined();
      expect(s.anchor).toBeDefined();
      expect(s.depth).toBe(atlas.scenes[s.parent!].depth + 1);
      expect(s.root).toBe(atlas.scenes[s.parent!].root);
    }
    expect(atlas.scenes['ch03/E5']).toMatchObject({ parent: 'ch03/E', enterRoom: { key: 'E5', level: 'village' }, depth: 1, root: 'ch03/E' });
    expect(atlas.scenes['appB/death-house']).toMatchObject({ parent: 'ch03/E', enterRoom: { key: 'E7', level: 'village' }, depth: 1, root: 'ch03/E', north: '-x' });
    expect(atlas.scenes['appB/death-house'].anchor!.dTheta).toBeCloseTo(-Math.PI / 2, 6);
    expect(atlas.scenes['ch05/N2'].anchor).toMatchObject({ x: 4385, z: 2155, dTheta: 0 });
    expect(atlas.scenes['ch05/N2'].placement.position[1]).toBe(atlas.constants.NEST_LIFT);
  });
  it('every pin\'s scenes exist; every pin with scenes has a root or stands proxy-only for a scene placed elsewhere', () => {
    for (const p of atlas.pins) {
      for (const path of p.scenes) expect(atlas.scenes[path], `pin ${p.key} lists ${path}`).toBeDefined();
      if (p.root) { expect(atlas.scenes[p.root].pin).toBe(p.key); expect(atlas.scenes[p.root].worldBounds).toBeDefined(); expect(p.proxyOnly).toBe(false); }
      else expect(p.proxyOnly).toBe(true);
      const w = barovia as unknown as WorldData;
      if (p.campaign === 'cos') { expect(p.world).toEqual(worldOfMiles(w, p.pos)); expect(p.groundY + (p.heightFt ?? 0)).toBeCloseTo(pinY(w, w.pins.find((q) => q.key === p.key)!), 9); }
    }
    const withScenes = atlas.pins.filter((p) => p.scenes.length);
    expect(withScenes.filter((p) => p.root).length + withScenes.filter((p) => p.proxyOnly).length).toBe(withScenes.length);
  });
  it('a scene listed at two pins is placed at the first; the second keeps a proxy and a label only', () => {
    expect(atlas.scenes['ch02/B']).toMatchObject({ pin: 'B', alsoAt: ['B2'] });
    expect(atlas.scenes['ch02/D']).toMatchObject({ pin: 'D', alsoAt: ['D2'] });
    for (const k of ['B2', 'D2']) expect(atlas.pins.find((p) => p.campaign === 'cos' && p.key === k)).toMatchObject({ proxyOnly: true });
    expect(atlas.pins.find((p) => p.campaign === 'cos' && p.key === 'B2')!.root).toBeUndefined();
  });
  it('roots stand on their pins: centre on the pin, floor on the ground (Ravenloft a thousand feet up)', () => {
    const w = barovia as unknown as WorldData;
    for (const s of roots) {
      const p = atlas.pins.find((q) => q.campaign === s.campaign && q.key === s.pin)!;
      expect(p, `${s.path}: pin ${s.pin}`).toBeDefined();
      const c = Math.cos(s.placement.rotationY), sn = Math.sin(s.placement.rotationY), [cx, cz] = s.centre;
      expect(s.placement.position[0] + cx * c + cz * sn).toBeCloseTo(p.world[0], 6);
      expect(s.placement.position[2] - cx * sn + cz * c).toBeCloseTo(p.world[1], 6);
      expect(s.placement.position[1]).toBeCloseTo(p.groundY + (p.heightFt ?? 0) - s.elevationFt, 6);
      expect(s.bandFt).toBe(s.crag ? 1400 : 900);
    }
    const K = atlas.scenes['ch04/K'];
    expect(K.crag).toBe(true);
    expect(K.placement.position[1]).toBeCloseTo(pinY(w, w.pins.find((q) => q.key === 'K')!), 6);
    expect(atlas.scenes['ch09/T'].placement.rotationY).toBeCloseTo(-Math.PI / 2, 6); // Tsolenka's map has north to the left
  });
  it('no two root flatten bands overlap, except the one seam the data pass owns (Luna River Crossroads beside Vallaki)', () => {
    expect(atlas.bandOverlaps.map((o) => o.scenes)).toEqual([['ch02/P', 'ch05/N']]);
    expect(atlas.bandOverlaps[0].gapFt).toBeGreaterThan(0); // the maps themselves do not overlap, only their bands
  });
  it('blowouts more than 1.5× their plot are listed as warnings (the Vallaki buildings, the church, Death House)', () => {
    const big = scenes.filter((s) => (s.blowout ?? 0) > 1.5).map((s) => s.path).sort();
    expect(big).toEqual(['appB/death-house', 'ch03/E5', 'ch05/N1', 'ch05/N2', 'ch05/N3', 'ch05/N4', 'ch05/N5', 'ch05/N6', 'ch05/N7', 'ch05/N8']);
    for (const path of big) expect(atlas.warnings.some((w) => w.startsWith(`${path}:`)), `${path} warned`).toBe(true);
    expect(atlas.scenes['ch05/N9'].blowout).toBeLessThanOrEqual(1.5); // the Vistani camp fits its field
  });
  it('reports no errors; the dev room is the only orphan; Vallaki and Krezk weigh two units', () => {
    expect(atlas.errors).toEqual([]);
    expect(scenes.filter((s) => s.orphan).map((s) => s.path)).toEqual(['dev/m0-test-room']);
    expect(scenes.filter((s) => s.units > 1).map((s) => s.path).sort()).toEqual(['ch05/N', 'ch08/S']);
    expect(atlas.scenes['ch03/E'].roadExits.length).toBeGreaterThan(0); // the Old Svalich Road leaves the village
    expect(atlas.scenes['ch05/N'].roadExits).toEqual([]); // the world's roads stop at Vallaki's 1.7-mile map, as the backdrop finds today
    expect(atlas.constants).toEqual({ MI_FT: 5280, RELIEF: 1.25, NEST_LIFT: 0.2 });
  });
});
