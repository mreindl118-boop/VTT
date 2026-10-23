// Item 2f-5: one shared mist piece in kit/mist.ts, automatic outdoor perimeter mist on outdoor levels (none on
// interiors), role-based fog exemption in build.ts, and soft 4-tap hour-coloured unexplored fog in materials.ts.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PROPS_V1 } from '../app/src/kit/props';
import '../app/src/kit/sites';
import { mist, mistBank, mistWall, fogWall, mistWisp, updatePerimeterMist } from '../app/src/kit/mist';
import { fogUniforms, mat } from '../app/src/render/materials';
import { buildLevel } from '../app/src/render/build';
import type { GridLevel, Level } from '../app/src/core/schema';

function countTriangles(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return tris;
}

describe('shared mist piece (kit/mist.ts)', () => {
  it('registers mist, mist-bank, mist-wall, fog-wall and a-mist-wall onto the shared kit piece', () => {
    for (const k of ['mist', 'mist-bank', 'mist-wall', 'fog-wall', 'a-mist-wall']) {
      expect(typeof PROPS_V1[k], k).toBe('function');
    }
    expect(typeof mist).toBe('function');
    expect(typeof mistBank).toBe('function');
    expect(typeof mistWall).toBe('function');
    expect(typeof fogWall).toBe('function');
    expect(typeof mistWisp).toBe('function');
  });

  it('builds every registered mist kind and chasm fog through mat/matClone (no raw MeshBasicMaterial), transparent, depthWrite off and fog-exempt', () => {
    const cases: [string, Record<string, number>][] = [
      ['mist', { len: 60, h: 5, d: 20 }],
      ['mist', { len: 80, h: 30, d: 20 }],
      ['mist-bank', { r: 40, h: 6, o: 0.15 }],
      ['mist-wall', { len: 180, h: 45, d: 30 }],
      ['fog-wall', { len: 180, h: 60, d: 40 }],
      ['a-mist-wall', { len: 180, h: 45, d: 30 }],
    ];
    for (const [kind, dims] of cases) {
      const g = PROPS_V1[kind](dims);
      let meshes = 0;
      g.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        const mt = m.material as THREE.MeshLambertMaterial;
        expect(mt.type, `${kind} material type`).toBe('MeshLambertMaterial');
        expect(mt.userData.mist, `${kind} patched by materials.ts`).toBe(true);
        expect(mt.transparent, `${kind} transparent`).toBe(true);
        expect(mt.opacity, `${kind} opacity < 0.999 for floorMask`).toBeLessThan(0.999);
        expect(mt.depthWrite, `${kind} depthWrite`).toBe(false);
        expect(mt.userData.fogExempt?.value, `${kind} fogExempt`).toBe(1);
        expect(m.renderOrder, `${kind} renderOrder`).toBeGreaterThanOrEqual(2);
        const col = m.geometry.attributes.color;
        expect(col?.itemSize, `${kind} per-vertex RGBA`).toBe(4);
      });
      expect(meshes, `${kind} mesh count`).toBeGreaterThan(0);
    }

    // Chasm fog in props.ts also routes through the kit instead of raw MeshBasicMaterial.
    const ch = PROPS_V1['chasm']({ w: 50, len: 120, depth: 400 });
    ch.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const mt = m.material as THREE.Material;
      expect(mt.type, 'chasm mesh material').toBe('MeshLambertMaterial');
      expect(mt.userData.mist, 'chasm mesh patched').toBe(true);
    });
  });

  it('keeps a 180-ft fog-wall and mist-wall within the 600-triangle budget', () => {
    const fw = PROPS_V1['fog-wall']({ len: 180 });
    const mw = PROPS_V1['mist-wall']({ len: 180 });
    const fwTris = countTriangles(fw);
    const mwTris = countTriangles(mw);
    expect(fwTris).toBeGreaterThan(40);
    expect(fwTris).toBeLessThanOrEqual(600);
    expect(mwTris).toBeGreaterThan(40);
    expect(mwTris).toBeLessThanOrEqual(600);
  });
});

describe('outdoor perimeter mist and role-based fog exemption (render/build.ts)', () => {
  const rect: [number, number][] = [[0, 0], [100, 0], [100, 80], [0, 80]];
  const grid: GridLevel = { floorPolygons: [rect], type: 'square', hexOrientation: 'pointy', origin: [0, 0], color: '#1d1b22', opacity: 0.5 };

  it('automatically bounds outdoor levels with a perimeter mist ring that fades with zoom and hides when folded to proxy', () => {
    const outdoorLevel: Level = {
      id: 'outdoor',
      name: 'Outdoor Ground',
      elevationFt: 0,
      ceilingFt: 20,
      ambient: 'barovian-overcast',
      rooms: [{ key: 'R1', name: 'Clearing', polygon: rect, floor: 'grass' }],
      terrain: [{ polygon: [[-20, -20], [120, -20], [120, 100], [-20, 100]], floor: 'grass' }],
      walls: [],
      objects: [{ id: 'crate1', kind: 'trunk', pos: [20, 0, 20], vis: 'player' }, { id: 'm1', kind: 'mist-bank', pos: [40, 0, 40], vis: 'player', dims: { r: 20, h: 4 } }],
      lights: [],
    };
    const built = buildLevel(outdoorLevel, grid);
    const ring = built.root.getObjectByName('perimeter-mist');
    expect(ring).toBeDefined();
    let ringMeshes = 0;
    ring!.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      ringMeshes++;
      const mt = m.material as THREE.Material;
      expect(mt.transparent).toBe(true);
      expect(mt.depthWrite).toBe(false);
      expect(mt.userData.fogExempt?.value).toBe(1);
    });
    expect(ringMeshes).toBeGreaterThan(0);

    // Zooming out into the valley fades the perimeter mist; folding into the proxy hides it.
    const nearK = updatePerimeterMist(built.root, 200, false);
    const midK = updatePerimeterMist(built.root, 1800, false);
    const farK = updatePerimeterMist(built.root, 6000, false);
    expect(nearK).toBeCloseTo(1, 2);
    expect(midK).toBeLessThan(nearK);
    expect(farK).toBe(0);

    const foldedK = updatePerimeterMist(built.root, 200, true);
    expect(foldedK).toBe(0);
    expect(ring!.visible).toBe(false);
  });

  it('adds no perimeter mist to interior or darkness levels', () => {
    const interiorLevel: Level = {
      id: 'f2',
      name: 'Upper Floor',
      elevationFt: 10,
      ceilingFt: 10,
      ambient: 'interior-dim',
      rooms: [{ key: 'R2', name: 'Hall', polygon: rect, floor: 'plank' }],
      walls: [],
      objects: [],
      lights: [],
    };
    const built = buildLevel(interiorLevel, grid);
    expect(built.root.getObjectByName('perimeter-mist')).toBeUndefined();
  });
});

describe('soft 4-tap coverage fog and mist uniforms (render/materials.ts)', () => {
  it('exposes uMistColor and uTime on fogUniforms and compiles 4-tap smoothstep mistApply', () => {
    expect((fogUniforms as Record<string, unknown>).uMistColor).toBeDefined();
    expect((fogUniforms as Record<string, unknown>).uTime).toBeDefined();
    const m = mat('#737980');
    const sh = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: 'void main() {\n#include <project_vertex>\n}',
      fragmentShader: 'void main() {\n#include <color_fragment>\n#include <opaque_fragment>\n}',
    };
    m.onBeforeCompile(sh as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    expect(sh.uniforms.uMistColor).toBeDefined();
    expect(sh.uniforms.uTime).toBeDefined();
    expect(sh.fragmentShader).toContain('smoothstep');
    expect(sh.fragmentShader).not.toContain('step(0.75, cov)');
  });
});
