// Braids (kit/heroes.ts drapeBraids) hang from behind the ears over whatever the chest wears, once the figure is posed
// and set on the floor; once the cloth has hung, a braid that passes through it is walked out of it (braidsOffCloth).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';
import { BESTIARY, figureFor } from '../app/src/bestiary';

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
  }, 30000);
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

describe('braids on an NPC in a capelet or a mantle', () => {
  type Tri = THREE.Vector3[];
  const trisOf = (ms: THREE.Mesh[]) => { const out: Tri[] = []; for (const m of ms) { const p = m.geometry.getAttribute('position'), ix = m.geometry.index, at = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(j) : j).applyMatrix4(m.matrixWorld); for (let i = 0; i + 2 < (ix ? ix.count : p.count); i += 3) out.push([at(i), at(i + 1), at(i + 2)]); } return out; };
  // (whether the segment a to b passes through the triangle t, its ends left out)
  const through = (a: THREE.Vector3, b: THREE.Vector3, t: Tri) => { const d = b.clone().sub(a), len = d.length(); if (len < 1e-9) return false; d.divideScalar(len); const e1 = t[1].clone().sub(t[0]), e2 = t[2].clone().sub(t[0]), h = new THREE.Vector3().crossVectors(d, e2), det = e1.dot(h); if (Math.abs(det) < 1e-12) return false; const sv = a.clone().sub(t[0]), u = sv.dot(h) / det; if (u < 0 || u > 1) return false; const q = new THREE.Vector3().crossVectors(sv, e1), w = d.dot(q) / det; if (w < 0 || u + w > 1) return false; const k = e2.dot(q) / det; return k > 0 && k < len; };
  const cross = (A: Tri, B: Tri) => [0, 1, 2].some((i) => through(A[i], A[(i + 1) % 3], B) || through(B[i], B[(i + 1) % 3], A));
  /** How many of the triangles A pass through one of B (binned by cells `cell` across). */
  function crossings(A: Tri[], B: Tri[], cell: number): number {
    const grid = new Map<string, number[]>(), lo = new THREE.Vector3(), hi = new THREE.Vector3();
    const cells = (t: Tri, f: (k: string) => void) => { lo.copy(t[0]).min(t[1]).min(t[2]); hi.copy(t[0]).max(t[1]).max(t[2]); for (let x = Math.floor(lo.x / cell); x <= Math.floor(hi.x / cell); x++) for (let y = Math.floor(lo.y / cell); y <= Math.floor(hi.y / cell); y++) for (let z = Math.floor(lo.z / cell); z <= Math.floor(hi.z / cell); z++) f(`${x},${y},${z}`); };
    B.forEach((t, i) => cells(t, (k) => { const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]); }));
    let n = 0; for (const t of A) { const seen = new Set<number>(); let hit = false; cells(t, (k) => { if (hit) return; for (const i of grid.get(k) ?? []) { if (seen.has(i)) continue; seen.add(i); if (cross(t, B[i])) { hit = true; return; } } }); if (hit) n++; }
    return n;
  }

  it('keep out of the capelet an arm raised to strike lifts beside them, and out of a fallen body\'s mantle: no face of a braid passes through the cloth', () => {
    // (hung over what the chest wears as it is posed, a braid went through the capelet the overhead swing lifts up beside
    // the head, and through the mantle of a body fallen on its side)
    for (const [seed, state] of [['', 'battle'], ['d', 'battle'], ['e', 'battle'], ['b', 'dead']] as const) {
      const g = figureFor(BESTIARY.find((e) => e.id === 'berserker')!, state === 'battle' ? true : 'dead', seed); g.updateMatrixWorld(true);
      const s = g.getObjectByName('neck')!.position.y / 2.24, all: THREE.Mesh[] = []; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) all.push(o as THREE.Mesh); });
      const braids = all.filter(braidOf), cloth = all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
      expect(braids.length, `berserker@${seed} ${state}`).toBeGreaterThan(10);
      expect(braids.some((m) => m.userData.braidLine), `berserker@${seed} ${state}: a braid's line left on it`).toBe(false);
      expect(crossings(trisOf(braids), trisOf(cloth), 0.06 * s), `berserker@${seed} ${state}: braids through the cloth`).toBe(0);
    }
  }, 120000);
});
