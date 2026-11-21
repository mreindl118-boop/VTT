// An elf's ear that stands out of curly hair (kit/heroes.ts buildHair): the coils grow round it but never touch it, and
// the hair comes down round its root, so no bare scalp shows beside it.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';

const fairy: HeroFigure = { frame: 'feminine', skin: '#8a5a9e', hair: '#dccbeb', hairStyle: 'curly', ears: 'pointed', face: { earOut: 1 } };

describe('curls round an elf ear', () => {
  const g = heroFigure(fairy, 'small', 'rest'); g.updateMatrixWorld(true);
  const head = g.getObjectByName('head')!, s = g.getObjectByName('neck')!.position.y / 2.24;
  const ears = head.children.filter((c) => c.userData.elfEar);
  it('no coil touches the ear', () => {
    expect(ears.length).toBe(2);
    const tris: THREE.Triangle[] = [];
    for (const e of ears) e.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return; const p = m.geometry.getAttribute('position'), ix = m.geometry.index;
      const v = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(j) : j).applyMatrix4(m.matrixWorld);
      for (let i = 0; i < (ix ? ix.count : p.count); i += 3) tris.push(new THREE.Triangle(v(i), v(i + 1), v(i + 2)));
    });
    const q = new THREE.Vector3(); let coils = 0, near = Infinity;
    head.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !m.userData.coil) return; coils++;
      const p = m.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i += 2) { const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); for (const t of tris) near = Math.min(near, t.closestPointToPoint(v, q).distanceTo(v)); }
    });
    expect(coils).toBeGreaterThan(30);
    expect(near / s).toBeGreaterThan(0.005);
  });
  it('the hair comes down round the root: behind and above it, a ray from the side meets hair or the ear, never scalp', () => {
    const skull: THREE.Object3D[] = []; head.traverse((o) => { if (o.userData.skull) skull.push(o); });
    const solid: THREE.Mesh[] = []; head.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) solid.push(m); });
    expect(skull.length).toBe(1);
    const ray = new THREE.Raycaster(); let rays = 0, bare = 0;
    for (const e of ears) {
      const sx = Math.sign(e.position.x), root = e.position;
      for (let dy = -0.05; dy <= 0.2 + 1e-9; dy += 0.025) for (let back = 0.05; back <= 0.3 + 1e-9; back += 0.025) {
        // in the head's frame, from well out to the side, straight in toward the middle of the head
        const from = head.localToWorld(new THREE.Vector3(sx * 0.9 * s, root.y + dy * s, root.z - back * s)), to = head.localToWorld(new THREE.Vector3(0, root.y + dy * s, root.z - back * s));
        ray.set(from, to.sub(from).normalize()); const hit = ray.intersectObjects(solid, false)[0];
        if (!hit) continue; rays++; if (hit.object === skull[0]) bare++;
      }
    }
    expect(rays).toBeGreaterThan(150);
    expect(bare).toBe(0);
  });
});
