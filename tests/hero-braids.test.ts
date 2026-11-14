// Braids (kit/heroes.ts drapeBraids) hang from behind the ears over whatever the chest wears, once the figure is posed
// and set on the floor.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';

const HAIR = '#e3c479';
// a woman in plate with a full bust, the case the braids have to lie over
const plated: HeroFigure = { frame: 'feminine', build: 'broad', body: { bust: 1.2 }, skin: '#d8a888', hair: HAIR, hairStyle: 'braids', armor: { kind: 'plate', color: '#26272d' } };
const braidOf = (m: THREE.Object3D) => (m as THREE.Mesh).isMesh && !!m.userData.braid;

describe('braids', () => {
  it('lie over the breastplate, never under it', () => {
    for (const state of ['rest', 'battle'] as const) {
      const g = heroFigure(plated, 'medium', state); g.updateMatrixWorld(true);
      const up = g.getObjectByName('chest')!, s = g.getObjectByName('neck')!.position.y / 2.24, fwd = new THREE.Vector3(0, 0, 1).transformDirection(up.matrixWorld);
      // what the chest wears, seen from both sides (stand-ins: the kit shares its materials between figures)
      const both = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const worn = (up.children.filter((c) => (c as THREE.Mesh).isMesh && !braidOf(c) && !((c as THREE.Mesh).material as THREE.Material).transparent) as THREE.Mesh[])
        .map((m) => { const w = new THREE.Mesh(m.geometry, both); w.matrixAutoUpdate = false; w.matrixWorld.copy(m.matrixWorld); return w; });
      const ray = new THREE.Raycaster(); let pts = 0, under = 0;
      for (const c of up.children) {
        if (!braidOf(c)) continue; const m = c as THREE.Mesh, p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i += 3) {
          // a point of the braid, given a hair's room (0.04 ft at the figure's scale) in front of where it is
          const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).addScaledVector(fwd, 0.04 * s);
          ray.set(v, fwd); pts++; if (ray.intersectObjects(worn, false).length % 2) under++;
        }
      }
      expect(pts, state).toBeGreaterThan(300);
      expect(under, state).toBe(0);
    }
  });
  it('on a body laid on its back, lie along the chest: no tuft stands off it in the air', () => {
    const g = heroFigure({ ...plated, deadPose: 'dead' }, 'medium', 'dead'); g.updateMatrixWorld(true);
    const s = g.getObjectByName('neck')!.position.y / 2.24, body: THREE.Mesh[] = [], tips: THREE.Vector3[] = [];
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !braidOf(m) && !(m.material as THREE.Material).transparent) body.push(m); });
    // a tuft hangs from the braid's end down the chest's frame (its pieces are built in it): its tip is its lowest point there
    g.traverse((o) => {
      if (o.userData.braid !== 'tuft') return; const m = o as THREE.Mesh, p = m.geometry.getAttribute('position');
      let tip: THREE.Vector3 | undefined; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (!tip || v.y < tip.y) tip = v; }
      tips.push(tip!.applyMatrix4(m.matrixWorld));
    });
    expect(tips.length).toBe(10);
    const ray = new THREE.Raycaster();
    for (const t of tips) {
      ray.set(t, new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObjects(body, false)[0];
      expect(hit, 'something under each tuft').toBeDefined();
      expect(hit!.distance / s).toBeLessThan(0.12);
    }
  });
});
