// The world atlas (manifests/world-atlas.json): every built map has a place in its valley, every blowout hangs from a room
// that opens it, and the committed file is what scripts/world-atlas.ts generates today.
import { describe, expect, it } from 'vitest';
import committed from '../manifests/world-atlas.json';
import barovia from '../locations/ch02/barovia-region/world.json';
import { buildAtlas, scenePaths, serialize, REPO, type Atlas } from '../scripts/world-atlas.ts';
import { pinY, worldOfMiles } from '../app/src/core/frames';
import { pointInPolygon } from '../app/src/core/geometry';
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
  it('no two root flatten bands overlap, except the seam the data pass owns (Luna River Crossroads beside Vallaki) and the lakeshore beside Vallaki', () => {
    expect(atlas.bandOverlaps.map((o) => o.scenes)).toEqual([['ch02/L', 'ch05/N'], ['ch02/P', 'ch05/N']]);
    for (const o of atlas.bandOverlaps) expect(o.gapFt).toBeGreaterThan(0); // the maps themselves do not overlap, only their bands
  });
  it("Lake Zarovich's map stands on the lake's south shore at the lake's level, beside Vallaki (not on the survey's hump in the lake)", () => {
    const w = barovia as unknown as WorldData, L = atlas.scenes['ch02/L'], N = atlas.scenes['ch05/N'], pin = w.pins.find((q) => q.key === 'L')!;
    expect(L.placement.position[1]).toBeCloseTo(pin.groundFt!, 6);
    // both maps' bases agree, so the land between them is one level
    expect(Math.abs(L.placement.position[1] + L.elevationFt - (N.placement.position[1] + N.elevationFt))).toBeLessThan(0.5);
    // the map's shore line (its water room's south edge, ~185 ft south of its centre) lies on the lake's drawn shore:
    // the measured outline's southmost crossing of the pin's meridian (barovia-world.py bows the outline onto it)
    const lake = w.lakes.find((l) => /Zarovich/.test(l.name))!, [mx, my] = pin.pos, ring = (lake as { pts?: [number, number][] }).pts!;
    expect(ring, 'Lake Zarovich has a measured outline').toBeDefined();
    let shoreY = -Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i]; if ((a[0] - mx) * (b[0] - mx) <= 0 && a[0] !== b[0]) shoreY = Math.max(shoreY, a[1] + ((mx - a[0]) / (b[0] - a[0])) * (b[1] - a[1])); }
    expect(Math.abs(my + 185 / 5280 - shoreY) * 5280).toBeLessThan(60);
    // and the landing stands on that shore: its north half in the water, its south half on land
    expect(pointInPolygon([mx, my - 0.05], ring)).toBe(true); expect(pointInPolygon([mx, my + 0.06], ring)).toBe(false);
  });
  it('blowouts more than 1.5× their plot are listed as warnings (the Vallaki buildings, the church, Death House)', () => {
    const big = scenes.filter((s) => (s.blowout ?? 0) > 1.5).map((s) => s.path).sort();
    // (ch10/U3 since item 7: Baba Lysaga's hut sits in a ragged mire of 122 × 117 ft on the 64-ft plot Berez gives it)
    expect(big).toEqual(['appB/death-house', 'ch03/E5', 'ch05/N1', 'ch05/N2', 'ch05/N3', 'ch05/N4', 'ch05/N5', 'ch05/N6', 'ch05/N7', 'ch05/N8', 'ch10/U3']);
    for (const path of big) expect(atlas.warnings.some((w) => w.startsWith(`${path}:`)), `${path} warned`).toBe(true);
    expect(atlas.scenes['ch05/N9'].blowout).toBeLessThanOrEqual(1.5); // the Vistani camp fits its field
  });
  it('reports no errors; the dev room is the only orphan; Vallaki, Krezk and Yester Hill weigh two units', () => {
    expect(atlas.errors).toEqual([]);
    expect(scenes.filter((s) => s.orphan).map((s) => s.path)).toEqual(['dev/m0-test-room']);
    // Yester Hill weighs two since item 7: the whole hill, its trail, cairns and trees are over 2,000 objects
    expect(scenes.filter((s) => s.units > 1).map((s) => s.path).sort()).toEqual(['ch05/N', 'ch08/S', 'ch14/Y']);
    expect(atlas.scenes['ch03/E'].roadExits.length).toBeGreaterThan(0); // the Old Svalich Road leaves the village
    // the Old Svalich Road runs through Vallaki (item 2f-1a): its 1.7-mile map has the road leaving west and east
    expect(atlas.scenes['ch05/N'].roadExits.map((e) => e.road)).toEqual(['Old Svalich Road', 'Old Svalich Road']);
    expect(atlas.scenes['ch05/N'].roadExits.map((e) => Math.sign(Math.cos(e.bearing)))).toEqual([-1, 1]);
    expect(atlas.constants).toEqual({ MI_FT: 5280, RELIEF: 1.25, NEST_LIFT: 0.2 });
  });
});
