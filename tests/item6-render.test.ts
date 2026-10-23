import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GridFile, SceneFile } from '../app/src/core/schema';
import { buildLevel } from '../app/src/render/build';

function loadScene(rel: string) {
  const scene = JSON.parse(readFileSync(`locations/${rel}/scene.json`, 'utf8')) as SceneFile;
  const grid = JSON.parse(readFileSync(`locations/${rel}/grid.json`, 'utf8')) as GridFile;
  return { scene, grid };
}

describe('item 6 render review fixes', () => {
  it('keeps fence posts, rails and dead-tree limbs in the always-drawn scatter tier on large maps', () => {
    const { scene, grid } = loadScene('ch10/U');
    const level = scene.levels[0];
    const built = buildLevel(level, grid.levels[level.id]);

    // Collect object IDs present in always-drawn scatter meshes vs near-only LOD meshes.
    const alwaysIds = new Set<string>();
    for (const c of built.root.children) {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.name === 'scatter' && Array.isArray(m.userData.ranges)) {
        for (const r of m.userData.ranges) alwaysIds.add(r.id);
      }
    }

    // Berez fences and dead trees have long rails (10 ft) and tall posts/trunks (3.5-6.5 ft) that must not vanish past the LOD switch.
    const fencesAndTrees = level.objects.filter(
      (o) => o.vis === 'player' && (o.kind === 'fence' || o.kind === 'berez-iron-fence' || o.kind === 'skull-fence' || o.kind === 'dead-tree'),
    );
    expect(fencesAndTrees.length).toBeGreaterThan(0);
    for (const o of fencesAndTrees) {
      expect(alwaysIds.has(o.id), `${o.id} (${o.kind}) should have geometry in the always-drawn scatter tier`).toBe(true);
    }
  });

  it('emits one room key label per stripped area key on levels with split room parts', () => {
    const { scene, grid } = loadScene('ch14/Y');
    const level = scene.levels[0];
    const built = buildLevel(level, grid.levels[level.id]);
    const keyTexts = built.labels.filter((l) => l.kind === 'key').map((l) => l.text);
    const y2Count = keyTexts.filter((t) => t === 'Y2').length;
    expect(y2Count).toBe(1);
  });

  it('strips far-tier stand-in meshes when a tiered prop takes the non-static path', () => {
    const { scene, grid } = loadScene('appB/death-house');
    const baseLevel = structuredClone(scene.levels[0]);
    baseLevel.objects.push({
      id: 'test-hidden-palisade',
      kind: 'palisade',
      pos: [10, 0, 10],
      vis: 'hidden-object',
      dims: { len: 20, h: 12 },
    });
    const built = buildLevel(baseLevel, grid.levels[baseLevel.id]);
    const palisadeObj = built.root.children.find((c) => c.userData.objectId === 'test-hidden-palisade');
    expect(palisadeObj).toBeDefined();
    let farCount = 0;
    palisadeObj!.traverse((c) => {
      if (c.userData.tier === 'far') farCount++;
    });
    expect(farCount).toBe(0);
  });
});
