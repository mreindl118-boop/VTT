import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildAtlas } from '../scripts/world-atlas';
import { toWorld3 } from '../app/src/core/frames';
import { buildLand, LandField } from '../app/src/render/worldland';
import { siteOf } from '../app/src/render/worldstage';
import type { Theme, WorldData } from '../app/src/campaigns';
import campaigns from '../manifests/campaigns.json';
import world from '../locations/ch02/barovia-region/world.json';

// CPU raycasts do not need the crag mist's browser canvas texture. Preserve all
// production site flags and geometry; substitute only its unexamined texture.
vi.mock('../app/src/render/backdrop', async importOriginal => ({
  ...await importOriginal<typeof import('../app/src/render/backdrop')>(),
  mistTexture: () => new THREE.Texture(),
}));

describe('regional ground under authored footprints', () => {
  it('keeps the rendered Vallaki apron below the N9 child floor across its plot', () => {
    const atlas = buildAtlas(), n = atlas.scenes['ch05/N'], child = atlas.scenes['ch05/N9'];
    const sites = Object.values(atlas.scenes).filter(e => e.campaign === 'cos' && e.worldBounds).map(siteOf);
    const land = buildLand(world as unknown as WorldData, sites, campaigns.campaigns[0].theme as Theme);
    const meshes = land.group.children.filter(o => ['land', 'aprons'].includes(o.name));
    land.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    try {
      for (const dx of [-10, 0, 10]) for (const dz of [-10, 0, 10]) {
        const local = toWorld3(child.placement, [child.centre[0] + dx, child.elevationFt, child.centre[1] + dz]);
        const [x, floor, z] = toWorld3(n.placement, local);
        ray.ray.origin.set(x, 20000, z);
        const hit = ray.intersectObjects(meshes, false)[0];
        expect(hit, `regional ground at ${x},${z}`).toBeDefined();
        expect.soft(hit.point.y, `rendered ground at N9 ${dx},${dz}`).toBeLessThan(floor);
        expect.soft(Math.abs(hit.point.y - land.field.surface(x, z)), 'mesh agrees with the analytic ground').toBeLessThan(0.5);
      }
    } finally {
      land.group.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    }
  });

  it('keeps a fully anchored footprint at its own datum when another flatten band overlaps', () => {
    const blank = { bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, lakes: [] } as unknown as WorldData;
    const site = (minX: number, maxX: number, base: number) => ({ path: `${base}`, key: `${base}`, bounds: { minX, maxX, minZ: -100, maxZ: 100 }, base, crag: false, clearingFt: 0, ground: 'grass', exits: [] });
    const field = new LandField(blank, [site(-500, 500, 10), site(1000, 1100, 200)]);
    expect(field.height(500, 0)).toBe(10);
    expect(field.height(620, 0)).toBe(10);
    expect(Math.abs(field.height(620.001, 0) - field.height(620, 0))).toBeLessThan(0.01);
    expect(field.height(1000, 0)).toBe(200);
  });

  it('blends continuously across close footprints whose default flat collars overlap', () => {
    const blank = { bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, lakes: [] } as unknown as WorldData;
    const site = (minX: number, maxX: number, base: number) => ({ path: `${base}`, key: `${base}`, bounds: { minX, maxX, minZ: -100, maxZ: 100 }, base, crag: false, clearingFt: 0, ground: 'grass', exits: [] });
    const sites = [site(-100, 0, 10), site(200, 300, 200)];
    const field = new LandField(blank, sites), reversed = new LandField(blank, [...sites].reverse());
    for (let x = 0; x <= 200; x++) {
      expect.soft(Math.abs(field.height(x + .001, 0) - field.height(x - .001, 0)), `no cliff at ${x}`).toBeLessThan(.1);
      expect.soft(field.height(x, 0)).toBeCloseTo(reversed.height(x, 0), 8);
    }
    expect(field.height(0, 0)).toBe(10);
    expect(field.height(200, 0)).toBe(200);
  });

  it('never covers either floor when incompatible authored footprints overlap', () => {
    const blank = { bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, lakes: [] } as unknown as WorldData;
    const sites = [10, 200].map(base => ({ path: `${base}`, key: `${base}`, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, base, crag: false, clearingFt: 0, ground: 'grass', exits: [] }));
    expect(new LandField(blank, sites).height(0, 0)).toBe(10);
    expect(new LandField(blank, [...sites].reverse()).height(0, 0)).toBe(10);
  });
});
