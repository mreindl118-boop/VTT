// A figure baked to one mesh per colour keeps the transform its builder wrote on the root. kit/sites/t.ts bakes its
// creatures in the world frame (the root's own scale and rotation go into the geometry), so a sleeping werewolf-wolf,
// whose builder squashes the root to 0.6 of its height, bakes 0.6 as tall as an awake one. The shared kit/shapes.ts
// compact is a different helper: it bakes in the root's own frame and drops the root's transform, which is right for
// the sites that never write one but would have stood every sleeping wolf up (0.3.2 review of the homogenization).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CREATURES } from '../app/src/kit/creatures';
import { compact } from '../app/src/kit/shapes';
import { mat } from '../app/src/render/materials';
import '../app/src/kit/sites';

const height = (o: THREE.Object3D): number => { const b = new THREE.Box3().setFromObject(o); return b.max.y - b.min.y; };

describe('compact keeps the frame each site chose', () => {
  it('a sleeping werewolf-wolf is 0.6 of the awake height (t.ts bakes the root transform)', () => {
    const awake = height(CREATURES['werewolf-wolf']({})), asleep = height(CREATURES['werewolf-wolf']({ sleeping: 1 }));
    expect(awake).toBeGreaterThan(3);
    expect(asleep).toBeCloseTo(awake * 0.6, 3);
    for (const d of [{}, { sleeping: 1 }] as Record<string, number>[]) {
      const g = CREATURES['werewolf-wolf'](d);
      expect(g.scale.toArray()).toEqual([1, 1, 1]);
      expect(g.children.every((c) => (c as THREE.Mesh).isMesh)).toBe(true);
    }
  });
  it('the shared compact bakes in the root frame: a root scale is dropped, children are in the root frame', () => {
    const root = new THREE.Group(); root.scale.y = 0.6; root.position.set(3, 0, -4);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat('#808080')); box.position.y = 1; root.add(box);
    const out = compact(root);
    expect(out.children.length).toBe(1);
    expect(height(out)).toBeCloseTo(2, 5);
    expect(out.position.toArray()).toEqual([0, 0, 0]);
  });
});
