import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bladeOf, scabbard, weapon, type WeaponKind, type WeaponSpec } from '../app/src/kit/weapons';

// A sword put away hangs in its scabbard as the belt hangs it (kit/heroes.ts): turned point down, the blade's foot at the
// scabbard's mouth. Whether a point lies inside the scabbard's leather is read by casting rays out of it at odd angles
// and counting how often each crosses the leather: an odd count every time is inside.
function sheathed(spec: WeaponSpec) {
  const on = new THREE.Group(), sc = scabbard(spec)!, w = weapon(spec);
  w.getObjectByName('bladeGlow')?.removeFromParent();
  w.rotation.x = Math.PI; w.position.y = bladeOf(spec)!.top; on.add(sc, w); on.updateMatrixWorld(true);
  return { sc, w };
}
const RAYS = [[1, 0.137, 0.213], [-1, -0.071, 0.311], [0.173, 0.093, 1], [-0.219, 0.051, -1]].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
const ray = new THREE.Raycaster();
const inside = (leather: THREE.Mesh, p: THREE.Vector3): boolean => RAYS.every((d) => { ray.set(p, d); return ray.intersectObject(leather, false).length % 2 === 1; });
/** The points of what is put away that lie below the scabbard's locket (where only blade belongs) and outside its leather:
 *  each face's corners, its middle, and points every tenth of a foot along its edges. */
function showing(spec: WeaponSpec): number {
  const { sc, w } = sheathed(spec), leather = sc.children[0] as THREE.Mesh, P = [0, 1, 2].map(() => new THREE.Vector3()), v = new THREE.Vector3();
  leather.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });   // (so a ray from inside meets it)
  let out = 0;
  const test = (p: THREE.Vector3) => { if (p.y < -0.1 && !inside(leather, p)) out++; };
  w.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      P.forEach((p, k) => p.fromBufferAttribute(pos, i + k).applyMatrix4(m.matrixWorld));
      test(v.copy(P[0]).add(P[1]).add(P[2]).divideScalar(3));
      for (let k = 0; k < 3; k++) { const a = P[k], b = P[(k + 1) % 3], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.1)); for (let j = 0; j < n; j++) test(v.lerpVectors(a, b, j / n)); }
    }
  });
  return out;
}

describe('weapons put away', () => {
  // (the dragon greatsword's head sits on its blade above the guard, so it goes on the back, never at the belt)
  const BELTED: WeaponKind[] = ['longsword', 'shortsword', 'rapier', 'dagger', 'scimitar', 'greatsword', 'sunsword'];

  it('hides every sword wholly inside a scabbard cut to its blade, at any length and however worn', () => {
    const bad: string[] = [];
    for (const kind of BELTED) for (const length of [0.8, 1.25]) for (const wear of [0, 0.6]) {
      const n = showing({ kind, length, wear });
      if (n) bad.push(`${kind} ×${length} wear ${wear}: ${n} points out`);
    }
    expect(bad).toEqual([]);
  });

  it('curves a scimitar\'s scabbard with its blade, on past its point', () => {
    const { sc, w } = sheathed({ kind: 'scimitar' }), leather = sc.children[0] as THREE.Mesh, pos = leather.geometry.getAttribute('position'), v = new THREE.Vector3();
    // (the middle of the leather across the blade's edges, between two depths below the mouth)
    const mid = (from: number, to: number) => { const b = new THREE.Box3(); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(leather.matrixWorld); if (v.y <= from && v.y >= to) b.expandByPoint(v); } return (b.min.z + b.max.z) / 2; };
    expect(new THREE.Box3().setFromObject(leather).min.y).toBeLessThan(new THREE.Box3().setFromObject(w.children[0]).min.y);
    expect(Math.abs(mid(-1.9, -2.3) - mid(-0.1, -0.5))).toBeGreaterThan(0.15);   // swept with the blade, not a straight case round it
  });

  it('runs a curved guard\'s quillons from its block out to the balls at their ends', () => {
    for (const spec of [{ kind: 'scimitar' }, { kind: 'longsword', guard: 'curved' }] as WeaponSpec[]) {
      const w = weapon(spec); w.updateMatrixWorld(true);
      const parts = w.children as THREE.Mesh[], quillons = parts.filter((m) => m.geometry.type === 'TorusGeometry'), ends = parts.filter((m) => m.geometry.type === 'SphereGeometry' && Math.abs(m.position.z) > 0.1);
      expect(quillons.length).toBe(2); expect(ends.length).toBe(2);
      const near = (m: THREE.Mesh, c: THREE.Vector3) => { const pos = m.geometry.getAttribute('position'), v = new THREE.Vector3(); let d = Infinity; for (let i = 0; i < pos.count; i++) d = Math.min(d, v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).distanceTo(c)); return d; };
      for (const e of ends) {
        const c = e.getWorldPosition(new THREE.Vector3()), r = (e.geometry as THREE.SphereGeometry).parameters.radius;
        expect(Math.min(...quillons.map((q) => near(q, c)))).toBeLessThan(r + 0.035);                      // the ball sits on a quillon's end
        for (const q of quillons) expect(new THREE.Box3().setFromObject(q, true).max.y).toBeLessThan(c.y + 0.05);   // none runs on up the blade past it
      }
    }
  });

  it('gives a weapon with no blade no scabbard', () => {
    for (const kind of ['mace', 'handaxe', 'club', 'quarterstaff'] as WeaponKind[]) { expect(bladeOf({ kind })).toBeUndefined(); expect(scabbard({ kind })).toBeUndefined(); }
  });
});
