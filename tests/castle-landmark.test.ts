import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import worldData from '../locations/ch02/barovia-region/world.json';
import atlas from '../manifests/world-atlas.json';
import { siteOf } from '../app/src/render/worldstage';
import { LandField } from '../app/src/render/worldland';
import { buildSky, siteMassing, type ProxySite } from '../app/src/render/worldproxies';
import * as worldMod from '../app/src/render/world';
import type { WorldData } from '../app/src/campaigns';

function stubCanvas(): void {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return;
  const ctx: unknown = new Proxy({}, {
    get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
    set: () => true,
  });
  g.document = { createElement: () => ({ width: 256, height: 256, style: {}, getContext: () => ctx }) };
}

const data = worldData as unknown as WorldData;
const landSites = Object.values(atlas.scenes as Record<string, any>)
  .filter((e) => e.campaign === 'cos' && e.depth === 0 && !e.orphan && e.pin && e.worldBounds)
  .map(siteOf);
const field = new LandField(data, landSites);

function proxySiteFor(key: string): ProxySite {
  const pin = (atlas.pins as any[]).find((p) => p.campaign === 'cos' && p.key === key)!;
  const e = (atlas.scenes as Record<string, any>)[pin.root];
  const [x, z] = pin.world;
  return {
    id: e.path,
    key: pin.key,
    name: pin.name,
    type: pin.type,
    x,
    z,
    y: e.placement.position[1] + e.elevationFt,
    bounds: e.worldBounds,
    rotationY: e.placement.rotationY,
    centre: e.centre,
  };
}

describe('Castle Ravenloft valley landmark proxy (2f-3)', () => {
  it('builds an always-resident detail proxy inside castle-ravenloft at the pin rather than generic stripped massing', () => {
    const siteK = proxySiteFor('K');
    const g = siteMassing(siteK, field);
    expect(g.name).toBe('proxy:ch04/K');
    expect(g.position.toArray()).toEqual([siteK.x, siteK.y, siteK.z]);

    // Must not leave K in the generic `massing` / `glow` direct children that WorldStage strips into fogged shared buffers
    const stripped = g.children.filter((c) => (c as THREE.Mesh).isMesh && (c.name === 'massing' || c.name === 'glow'));
    expect(stripped).toHaveLength(0);

    const inner = g.getObjectByName('castle-ravenloft') as THREE.Group | undefined;
    expect(inner).toBeDefined();
    expect(inner!.parent).toBe(g);
    // castle-ravenloft local origin stays at (0,0,0) so getWorldPosition equals the pin's crag top [x, ground+1000, z]
    expect(inner!.position.toArray()).toEqual([0, 0, 0]);

    const meshes: THREE.Mesh[] = [];
    inner!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes.length).toBeGreaterThanOrEqual(2);
    expect(meshes.length).toBeLessThanOrEqual(2); // 1 lit silhouette + Pillarstone mesh, 1 window glow mesh
  });

  it('includes both the thousand-foot Pillarstone rock mass beneath the courtyard and the towering keep/spires above it within triangle budget', () => {
    const siteK = proxySiteFor('K');
    const g = siteMassing(siteK, field);
    g.updateMatrixWorld(true);
    const inner = g.getObjectByName('castle-ravenloft')!;

    const box = new THREE.Box3();
    let tris = 0;
    inner.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
      const idx = m.geometry.index;
      tris += (idx ? idx.count : m.geometry.attributes.position.count) / 3;
    });

    // Relative to g.position.y (courtyard at y = 2133):
    // Pillarstone descends ~1000 ft to the valley floor; spires rise > 350 ft above the courtyard
    expect(box.min.y - siteK.y).toBeLessThanOrEqual(-950);
    expect(box.max.y - siteK.y).toBeGreaterThanOrEqual(350);
    // Horizontal span covers the Pillarstone rock mass, western chasm bridge spur, and eastern overlook
    expect(box.max.x - box.min.x).toBeGreaterThan(650);
    expect(box.max.z - box.min.z).toBeGreaterThan(500);
    // Stay strictly within triangle budget
    expect(tris).toBeGreaterThan(400);
    expect(tris).toBeLessThan(6000);
  });

  it('routes all proxy materials through mat() / matClone() in materials.ts with fog-of-war exemption', () => {
    for (const key of ['K', 'E', 'G', 'J', 'N']) {
      const g = siteMassing(proxySiteFor(key), field);
      let count = 0;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        count++;
        const mat = m.material as THREE.MeshLambertMaterial;
        expect(mat.type, `${key}/${m.name}`).toBe('MeshLambertMaterial');
        expect(mat.userData.mist, `${key}/${m.name} patched by materials.ts`).toBe(true);
        expect(mat.userData.fogExempt?.value, `${key}/${m.name} fogExempt`).toBe(1);
      });
      expect(count, key).toBeGreaterThan(0);
    }
  });

  it('lights key windows with a warm amber glow that intensifies at dusk and night', () => {
    stubCanvas();
    const sky = buildSky();
    const g = siteMassing(proxySiteFor('K'), field);
    const inner = g.getObjectByName('castle-ravenloft')!;
    const winMesh = inner.getObjectByName('castle-windows') as THREE.Mesh | undefined;
    expect(winMesh).toBeDefined();
    const mat = winMesh!.material as THREE.MeshLambertMaterial;
    expect(mat.userData.mist).toBe(true);

    // At midday (hour 14, night=false)
    sky.setMoon(0.5, false, 14);
    const dayGlow = mat.emissiveIntensity;
    // At dusk (hour 19.5, night=false)
    sky.setMoon(0.5, false, 19.5);
    const duskGlow = mat.emissiveIntensity;
    // At night (hour 23, night=true)
    sky.setMoon(0.5, true, 23);
    const nightGlow = mat.emissiveIntensity;

    // Warm amber hue (R > G > B)
    expect(mat.emissive.r).toBeGreaterThan(0.75);
    expect(mat.emissive.g).toBeGreaterThan(0.45);
    expect(mat.emissive.r).toBeGreaterThan(mat.emissive.g);
    expect(mat.emissive.g).toBeGreaterThan(mat.emissive.b);

    expect(duskGlow).toBeGreaterThan(dayGlow);
    expect(nightGlow).toBeGreaterThanOrEqual(duskGlow);
    sky.dispose();
  });

  it('exempts the castle landmark from ordinary distance fog so it stays an unmistakable silhouette from B, E, G, N, and J', () => {
    const landmarkFogFactor = (worldMod as any).landmarkFogFactor as ((depth: number, density: number) => number) | undefined;
    const exemptLandmarkFog = (worldMod as any).exemptLandmarkFog as ((m: THREE.Material) => THREE.Material) | undefined;
    expect(typeof landmarkFogFactor).toBe('function');
    expect(typeof exemptLandmarkFog).toBe('function');

    const siteK = proxySiteFor('K');
    const g = siteMassing(siteK, field);
    const inner = g.getObjectByName('castle-ravenloft')!;
    const meshes: THREE.Mesh[] = [];
    inner.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    for (const m of meshes) {
      expect((m.material as THREE.Material).userData.landmarkFogExempt).toBe(true);
    }

    // Check fog attenuation from all five required vantage locations in the valley at outdoor battle-map fog density (0.0011)
    const fogOut = 0.0011;
    for (const key of ['B', 'E', 'G', 'N', 'J']) {
      const from = proxySiteFor(key);
      const dist = Math.hypot(siteK.x - from.x, siteK.z - from.z);
      const ordinaryFog = 1 - Math.exp(-((fogOut * dist) ** 2));
      const castleFog = landmarkFogFactor!(dist, fogOut);
      // Ordinary fog erases distant meshes (> 99.99% fogged), whereas the castle landmark keeps > 65% direct visibility
      expect(ordinaryFog, `ordinary fog from ${key} (${Math.round(dist)} ft)`).toBeGreaterThan(0.9999);
      expect(castleFog, `castle landmark fog from ${key} (${Math.round(dist)} ft)`).toBeLessThan(0.35);
    }
  });

  it('maintains a dark gothic silhouette and clear line-of-sight to the upper castle from B, E, G, N, and J', () => {
    const siteK = proxySiteFor('K');
    const g = siteMassing(siteK, field);
    g.updateMatrixWorld(true);
    const sil = g.getObjectByName('castle-silhouette') as THREE.Mesh | undefined;
    expect(sil).toBeDefined();

    // Silhouette vertex colours must stay dark so the castle reads as a dark silhouette against Barovia's overcast sky/mist
    const col = sil!.geometry.getAttribute('color');
    let maxLuma = 0;
    for (let i = 0; i < col.count; i++) {
      const luma = 0.299 * col.getX(i) + 0.587 * col.getY(i) + 0.114 * col.getZ(i);
      if (luma > maxLuma) maxLuma = luma;
    }
    expect(maxLuma).toBeLessThan(0.18);

    // Line-of-sight from a framing camera at B, E, G, N, and J to the castle spire top clears the valley terrain
    sil!.geometry.computeBoundingBox();
    const spireY = sil!.geometry.boundingBox!.max.y + siteK.y;
    for (const key of ['B', 'E', 'G', 'N', 'J']) {
      const from = proxySiteFor(key);
      const r = Math.hypot(from.bounds.maxX - from.bounds.minX, from.bounds.maxZ - from.bounds.minZ) / 2;
      const eyeY = from.y + Math.max(180, r * 0.32);
      for (let step = 1; step < 64; step++) {
        const t = step / 64;
        const x = from.x + (siteK.x - from.x) * t;
        const z = from.z + (siteK.z - from.z) * t;
        const rayY = eyeY + (spireY - eyeY) * t;
        expect(rayY, `LOS from ${key} at step ${step}`).toBeGreaterThan(field.surface(x, z));
      }
    }
  });
});
