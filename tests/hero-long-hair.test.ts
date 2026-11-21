// Long hair (kit/heroes.ts buildHair, drapeLong) falls from the head once the figure is posed: over the shoulders and
// down the back, over whatever the back wears instead of through it, with an under-layer so that no skin shows between
// its locks from behind; the locks framing the face fall in front to the collarbone and lie on what the chest wears. On
// a body laid out no hair (long, braided or curly) lies under the floor, and a fairy's curls keep off her wings.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';

type M = THREE.Mesh;
const SKIN = '#d8a888';
// a woman in a gown under a cloak whose hood has fallen on her back, her head turned (the case that put long hair through
// a shoulder), and a man in mail under a cloak, with elf's ears and a pale lock at his temple
const gowned: HeroFigure = { frame: 'feminine', build: 'curvy', skin: SKIN, hair: '#8e3a1e', hairStyle: 'long', skirt: '#4b1a33', underskirt: '#efe3c8', cloak: '#4b1a33', hood: true, pose: { neck: [0.2, 0.3, -0.12] } };
const mailed: HeroFigure = { frame: 'masculine', skin: SKIN, hair: '#3a2618', hairStreak: '#e8e8e8', hairStyle: 'long', armor: { kind: 'mail', color: '#6a6e75' }, cloak: '#1c2c5e', ears: 'pointed', face: { earOut: 0.8 } };
const braided: HeroFigure = { frame: 'feminine', skin: SKIN, hair: '#e3c479', hairStyle: 'braids', armor: { kind: 'plate', color: '#26272d' } };
const fairy: HeroFigure = { frame: 'feminine', skin: '#8a5a9e', hair: '#dccbeb', hairStyle: 'curly', ears: 'pointed', face: { earOut: 1 }, wings: { color: '#cbb4f2', count: 4, opacity: 0.4 } };

const build = (f: HeroFigure, st: 'rest' | 'battle' | 'dead', size: 'medium' | 'small' = 'medium') => { const g = heroFigure(f, size, st); g.updateMatrixWorld(true); return g; };
const scaleOf = (g: THREE.Object3D) => g.getObjectByName('neck')!.position.y / 2.24;
const meshes = (o: THREE.Object3D) => { const out: M[] = []; o.traverse((c) => { if ((c as M).isMesh) out.push(c as M); }); return out; };
const isHair = (m: THREE.Object3D) => !!(m.userData.hair || m.userData.braid);
/** What the chest and the neck wear (their own meshes), seen from both sides: stand-ins, since the kit shares its materials. */
function worn(g: THREE.Object3D) {
  const both = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), chest = g.getObjectByName('chest')!, neck = g.getObjectByName('neck')!;
  return [...chest.children, ...neck.children].filter((c) => (c as M).isMesh && !isHair(c) && !((c as M).material as THREE.Material).transparent)
    .map((c) => { const w = new THREE.Mesh((c as M).geometry, both); w.matrixAutoUpdate = false; w.matrixWorld.copy(c.matrixWorld); return w; });
}

describe('long hair', () => {
  it('falls over what the back and the shoulders wear, never under it, and the locks framing the face lie over what the chest wears', () => {
    for (const f of [gowned, mailed]) for (const st of ['rest', 'battle'] as const) {
      const g = build(f, st), s = scaleOf(g), chest = g.getObjectByName('chest')!, neck = g.getObjectByName('neck')!, cover = worn(g);
      const back = new THREE.Vector3(0, 0, -1).transformDirection(chest.matrixWorld), fwd = back.clone().negate(), ray = new THREE.Raycaster();
      // (what lies on the head itself, from the parting to behind the ear, is not read: a ray from it crosses the head;
      // close beside the neck, out from the neck's middle is outward; elsewhere behind for the locks behind and in front
      // for the locks framing the face)
      const foot = neck.position.y, top = foot + 0.15 * s, inv = chest.matrixWorld.clone().invert(), axis = new THREE.Vector3(0, 1, 0).applyQuaternion(neck.quaternion);
      let behind = 0, front = 0, under = 0;
      for (const c of chest.children) {
        if (!c.userData.hair) continue; const m = c as M, p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i += 3) {
          // a point of the hair below the head, given a hair's room (0.03 ft at the figure's scale) further out from the body
          const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld), q = v.clone().applyMatrix4(inv); if (q.y > top) continue;
          let dir = c.userData.hair === 'frame' ? fwd : back;
          const o = neck.position.clone().addScaledVector(axis, (q.y - foot) / axis.y), r = Math.hypot(q.x - o.x, q.z - o.z);
          if (q.y > foot && r < 0.3 * s) dir = new THREE.Vector3(q.x - o.x, 0, q.z - o.z).normalize().transformDirection(chest.matrixWorld);
          v.addScaledVector(dir, 0.03 * s); ray.set(v, dir); if (c.userData.hair === 'frame') front++; else behind++;
          if (ray.intersectObjects(cover, false).length) under++;
        }
      }
      expect(behind, `${f.frame} ${st}`).toBeGreaterThan(2000); expect(front, `${f.frame} ${st}`).toBeGreaterThan(100);
      expect(under, `${f.frame} ${st}`).toBe(0);
    }
  }, 60000);

  it('shows no skin between its locks from behind', () => {
    for (const st of ['rest', 'battle'] as const) {
      const g = build(gowned, st), s = scaleOf(g), chest = g.getObjectByName('chest')!, neck = g.getObjectByName('neck')!, solid = meshes(g).filter((m) => !(m.material as THREE.Material).transparent);
      const skin = new THREE.Color(SKIN), ray = new THREE.Raycaster();
      // level rays from well behind, straight at the back, over a band down the middle of it from the nape to the shoulder blades
      const nape = chest.worldToLocal(neck.localToWorld(new THREE.Vector3(0, 0.3 * s, 0)));
      let rays = 0, bare = 0;
      for (let x = -0.2; x <= 0.2 + 1e-9; x += 0.025) for (let y = nape.y - 0.05 * s; y > nape.y - 0.5 * s; y -= 0.03 * s) {
        const from = chest.localToWorld(new THREE.Vector3(x * s, y, -2 * s)), to = chest.localToWorld(new THREE.Vector3(x * s, y, 0));
        ray.set(from, to.sub(from).normalize()); const hit = ray.intersectObjects(solid, false)[0]; if (!hit) continue; rays++;
        const c = ((hit.object as M).material as THREE.MeshStandardMaterial).color;
        if (!isHair(hit.object) && c && c.equals(skin)) bare++;
      }
      expect(rays, st).toBeGreaterThan(150);
      expect(bare, st).toBe(0);
    }
  }, 30000);

  it('ends the locks framing the face on what the chest wears, not in the air', () => {
    for (const f of [gowned, mailed]) {
      const g = build(f, 'rest'), s = scaleOf(g), chest = g.getObjectByName('chest')!, cover = worn(g), back = new THREE.Vector3(0, 0, -1).transformDirection(chest.matrixWorld), ray = new THREE.Raycaster();
      const frames = chest.children.filter((c) => c.userData.hair === 'frame') as M[];
      expect(frames.length, f.frame).toBe(4);
      for (const m of frames) {
        // the lock's tip: its lowest point in the chest's frame (it is built in it)
        const p = m.geometry.getAttribute('position'); let tip: THREE.Vector3 | undefined;
        for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (!tip || v.y < tip.y) tip = v; }
        ray.set(tip!.applyMatrix4(m.matrixWorld), back); const hit = ray.intersectObjects(cover, false)[0];
        expect(hit, `${f.frame}: something behind the tip`).toBeDefined();
        expect(hit!.distance / s, f.frame).toBeLessThan(0.1);
      }
    }
  }, 30000);
});

describe('hair on a body laid out', () => {
  it('lies on the floor, never under it, in every fall', () => {
    const cases: [HeroFigure, 'medium' | 'small'][] = [[gowned, 'medium'], [mailed, 'medium'], [braided, 'medium'], [fairy, 'small']];
    for (const [f, size] of cases) for (const deadPose of ['dead', 'dead-swoon', 'dead-prone', 'dead-comic'] as const) {
      const g = build({ ...f, deadPose }, 'dead', size), v = new THREE.Vector3(); let low = Infinity, n = 0;
      for (const m of meshes(g)) { if (!isHair(m)) continue; n++; const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) low = Math.min(low, v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y); }
      expect(n, `${f.hairStyle} ${deadPose}`).toBeGreaterThan(10);
      expect(low, `${f.hairStyle} ${deadPose}`).toBeGreaterThan(-0.001);
    }
  }, 120000);
});

describe('curls and wings', () => {
  it('keeps every curl off the wings, standing and fallen', () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = build(fairy, st, 'small'), s = scaleOf(g), tris: THREE.Triangle[] = [];
      g.traverse((o) => { if (!o.userData.wing) return; for (const m of meshes(o)) { const p = m.geometry.getAttribute('position'), ix = m.geometry.index, at = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(j) : j).applyMatrix4(m.matrixWorld); for (let i = 0; i < (ix ? ix.count : p.count); i += 3) tris.push(new THREE.Triangle(at(i), at(i + 1), at(i + 2))); } });
      expect(tris.length, st).toBeGreaterThan(1000);
      const coils = meshes(g).filter((m) => m.userData.coil), v = new THREE.Vector3(), q = new THREE.Vector3(); let near = Infinity;
      for (const m of coils) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); for (const t of tris) near = Math.min(near, t.closestPointToPoint(v, q).distanceTo(v)); } }
      expect(coils.length, st).toBeGreaterThan(30);
      expect(near / s, st).toBeGreaterThan(0.01);
    }
  }, 120000);
});
