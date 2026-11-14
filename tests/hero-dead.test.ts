import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { heroFigure, POSES, type HeroFigure, type PoseName } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';

// The dead laid out on the floor, on plain figures of the shared rig and a few dressed ones (no character's recipe):
// every dead pose rests by gravity, clear of itself, with what its hands held let go on the floor beside it.
type M = THREE.Mesh;
const DEAD = (Object.keys(POSES) as PoseName[]).filter((p) => p.startsWith('dead'));
const FRAMES: Record<string, HeroFigure> = { fem: { frame: 'feminine' }, masc: { frame: 'masculine' }, curvy: { build: 'curvy' }, broad: { build: 'broad', frame: 'masculine' } };
const DRESSED: Record<string, HeroFigure> = {
  plate: { frame: 'feminine', build: 'broad', armor: { kind: 'plate', color: '#9aa3ad', trim: '#c8a24a' }, weapon: 'axe', halo: '#f0c860' },
  mail: { frame: 'feminine', armor: { kind: 'mail', color: '#8a8f96' }, cloak: '#2a3f7a', weapon: 'mace', offhand: { kind: 'shield', color: '#2a3f7a', rim: '#a9adb6' } },
  gown: { build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8', offhand: { kind: 'book', color: '#5a3a22' } },
  winged: { frame: 'feminine', wings: { color: '#cbb4f2', count: 4 }, hoverFt: 1, offhand: { kind: 'book', color: '#5a3a22' } },
};
const LIE: Record<string, 'back' | 'front' | 'side'> = Object.fromEntries(DEAD.map((p) => [p, POSES[p].lie!]));

const solid = (m: THREE.Object3D): m is M => (m as M).isMesh && !((m as M).material as THREE.Material).transparent;
/** What of the figure is its body (not what it dropped), skin and boots, plate and what is worn: every solid mesh but
 *  open shells and cloth that drape (two-sided), and the dropped gear. */
function bodyMeshes(g: THREE.Object3D): M[] {
  const out: M[] = [];
  g.traverse((c) => { if (solid(c) && (c.material as THREE.Material).side !== THREE.DoubleSide && !inDropped(c)) out.push(c); });
  return out;
}
const inDropped = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (/^dropped/.test(p.name)) return true; return false; };
const under = (o: THREE.Object3D, stop: THREE.Object3D[] = []) => { const out: M[] = []; const walk = (x: THREE.Object3D) => { for (const c of x.children) { if (stop.includes(c)) continue; if (solid(c) && (c.material as THREE.Material).side !== THREE.DoubleSide) out.push(c); walk(c); } }; walk(o); return out; };
function span(ms: M[]): [number, number] {
  let lo = Infinity, hi = -Infinity; const v = new THREE.Vector3();
  for (const m of ms) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p as THREE.BufferAttribute, i).applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } }
  return [lo, hi];
}
function points(ms: M[], step = 0.05): THREE.Vector3[] {
  // the vertices, and points over faces too big for `step`
  const out: THREE.Vector3[] = [];
  for (const m of ms) {
    const p = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, w: THREE.Vector3[] = [];
    for (let i = 0; i < p.count; i++) w.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
    out.push(...w);
    const n = (idx ? idx.count : p.count) / 3;
    for (let t = 0; t < n; t++) {
      const [a, b, c] = [0, 1, 2].map((k) => w[idx ? idx.getX(3 * t + k) : 3 * t + k]), k = Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step);
      if (k < 2) continue;
      for (let i = 0; i <= k; i++) for (let j = 0; i + j <= k; j++) out.push(a.clone().multiplyScalar(i / k).addScaledVector(b, j / k).addScaledVector(c, 1 - (i + j) / k));
    }
  }
  return out;
}
/** The floor the meshes cover inside `box` (x0, x1, z0, z1), seen from above, in cells of `cell` feet: each face
 *  filled in. */
function footprint(ms: M[], box: [number, number, number, number], cell = 0.03): (x: number, z: number) => boolean {
  const on = new Set<number>(), key = (i: number, k: number) => (i + 32768) * 65536 + k + 32768, [x0, x1, z0, z1] = box;
  for (const m of ms) {
    const p = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, e = m.matrixWorld.elements, X = new Float32Array(p.count), Z = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); X[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; Z[i] = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (X[i] >= x0 && X[i] <= x1 && Z[i] >= z0 && Z[i] <= z1) on.add(key(Math.floor(X[i] / cell), Math.floor(Z[i] / cell)));
    }
    const n = (idx ? idx.count : p.count) / 3;
    for (let t = 0; t < n; t++) {
      const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, c = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      const ax = X[a], az = Z[a], bx = X[b], bz = Z[b], cx = X[c], cz = Z[c];
      if (Math.max(ax, bx, cx) < x0 || Math.min(ax, bx, cx) > x1 || Math.max(az, bz, cz) < z0 || Math.min(az, bz, cz) > z1) continue;
      const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az); if (Math.abs(d) < 1e-12) continue;
      for (let i = Math.floor(Math.min(ax, bx, cx) / cell); i <= Math.floor(Math.max(ax, bx, cx) / cell); i++) for (let k = Math.floor(Math.min(az, bz, cz) / cell); k <= Math.floor(Math.max(az, bz, cz) / cell); k++) {
        const x = (i + 0.5) * cell, z = (k + 0.5) * cell, u = ((bx - x) * (cz - z) - (cx - x) * (bz - z)) / d, v = ((cx - x) * (az - z) - (ax - x) * (cz - z)) / d;
        if (u >= 0 && v >= 0 && u + v <= 1) on.add(key(i, k));
      }
    }
  }
  return (x, z) => on.has(key(Math.floor(x / cell), Math.floor(z / cell)));
}
const build = (r: HeroFigure) => { const g = heroFigure(r, 'medium', 'dead'); g.updateMatrixWorld(true); return g; };
const joints = (g: THREE.Object3D) => g.userData.joints as Record<string, THREE.Object3D>;
const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('the dead', () => {
  it('lie clear of themselves on every frame, dressed or not', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const r: HeroFigure = { ...fr, weapon: 'sword', deadPose: p }, hits = findClips(build(r), r);
      expect(hits, `${fn} ${p}: ${describeClips(hits)}`).toEqual([]);
    }
    for (const [dn, r] of Object.entries(DRESSED)) for (const p of DEAD) {
      const rr = { ...r, deadPose: p }, hits = findClips(build(rr), rr);
      expect(hits, `${dn} ${p}: ${describeClips(hits)}`).toEqual([]);
    }
  }, 60000);

  it('rest on the floor: the lowest of the body on it, the trunk down on it, nothing sunk through it', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const g = build({ ...fr, weapon: 'sword', deadPose: p }), j = joints(g), label = `${fn} ${p}`;
      const [lo] = span(bodyMeshes(g));
      expect(Math.abs(lo), `${label}: lowest ${lo.toFixed(3)}`).toBeLessThan(0.03);
      // the trunk (the pelvis and the chest, without the limbs and the head) lies on the floor: on its back or face down
      // it touches it; on its side it rests on the floor or on the arm and thigh beneath it
      const trunk = [...under(j.hips, [j.chest, j.hipR, j.hipL]), ...under(j.chest, [j.neck, j.collarR, j.collarL])];
      const [tlo] = span(trunk);
      expect(tlo, `${label}: trunk ${tlo.toFixed(3)}`).toBeLessThan(LIE[p] === 'side' ? 0.25 : 0.03);
    }
  }, 30000);

  it('let every limb fall: each end down on the floor or on the body, none raised over the trunk', () => {
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const g = build({ ...fr, weapon: 'sword', deadPose: p }), j = joints(g), label = `${fn} ${p}`, body = bodyMeshes(g);
      const trunkTop = span([...under(j.hips, [j.chest, j.hipR, j.hipL]), ...under(j.chest, [j.neck, j.collarR, j.collarL])])[1];
      for (const [mid, end] of [['elbowR', 'wristR'], ['elbowL', 'wristL'], ['kneeR', 'ankleR'], ['kneeL', 'ankleL']]) {
        // the forearm or shin and what it carries: its lowest point is on the floor, or something solid is just under it
        const part = under(j[mid]), own = new Set(part), [plo] = span(part);
        let low = new THREE.Vector3(), best = Infinity; for (const v of points(part, 0.1)) if (v.y < best) { best = v.y; low = v; }
        let supported = plo < 0.04;
        if (!supported) { ray.set(low.clone().add(new THREE.Vector3(0, 0.01, 0)), down); ray.far = 0.12; supported = ray.intersectObjects(body.filter((m) => !own.has(m)), false).length > 0; }
        expect(supported, `${label}: ${mid} down to ${plo.toFixed(2)}, nothing under it`).toBe(true);
        expect(at(j[end]).y, `${label}: ${end} raised`).toBeLessThan(trunkTop);
      }
    }
  }, 30000);

  it('keep their joints in range: the presets\' elbows and knees, and the wrists as the hands drop', () => {
    for (const p of DEAD) {
      const P = POSES[p];
      for (const k of ['elbowR', 'elbowL'] as const) { const e = P[k] ?? 0; expect(e, `${p} ${k}`).toBeLessThanOrEqual(0); expect(e, `${p} ${k}`).toBeGreaterThanOrEqual(-1.45); }
      for (const k of ['kneeR', 'kneeL'] as const) { const e = P[k] ?? 0; expect(e, `${p} ${k}`).toBeGreaterThanOrEqual(0); expect(e, `${p} ${k}`).toBeLessThanOrEqual(1.45); }
    }
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const j = joints(build({ ...fr, weapon: 'sword', deadPose: p }));
      for (const w of ['wristR', 'wristL']) {
        // the bend: the last of the wrist's turns (about x) once the turn about the forearm is taken first
        const b = new THREE.Euler().setFromQuaternion(j[w].quaternion, 'YZX').x;
        expect(b, `${fn} ${p} ${w}`).toBeGreaterThan(-1.23); expect(b, `${fn} ${p} ${w}`).toBeLessThan(1.06);
      }
      // the settle turns limbs at their roots and ends only: the elbows and knees stay as posed
      for (const k of ['elbowR', 'elbowL', 'kneeR', 'kneeL'] as const) expect(j[k].rotation.x, `${fn} ${p} ${k}`).toBeCloseTo(POSES[p][k] ?? 0, 5);
    }
  }, 30000);

  it('turn the face to be seen from above: up on the back and the side, on the cheek face down', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const j = joints(build({ ...fr, deadPose: p })), face = new THREE.Vector3(0, 0, 1).transformDirection(j.head.matrixWorld);
      expect(face.y, `${fn} ${p}: face ${face.toArray().map((x) => x.toFixed(2))}`).toBeGreaterThan(LIE[p] === 'front' ? -0.25 : 0.3);
    }
  }, 30000);

  it('drop what the hands held flat on the floor, clear of the body and the head', () => {
    const cases: [string, HeroFigure][] = [];
    for (const [fn, fr] of Object.entries(FRAMES)) for (const p of DEAD) for (const weapon of fn === 'masc' ? ['sword', 'axe', 'spear'] as const : ['sword'] as const) cases.push([`${fn} ${p} ${weapon}`, { ...fr, weapon, deadPose: p }]);
    for (const [dn, r] of Object.entries(DRESSED)) for (const p of DEAD) cases.push([`${dn} ${p}`, { ...r, deadPose: p }]);
    for (const [label, r] of cases) {
      // the floor the body covers, seen from above: every solid piece of it, cloth too, each face filled in
      const g = build(r), j = joints(g), body: M[] = []; g.traverse((c) => { if (solid(c) && !inDropped(c)) body.push(c); });
      const drops = ['dropped', 'droppedL'].map((n) => g.getObjectByName(n)).filter((d): d is THREE.Object3D => !!d && d.children.length > 0);
      const held = (r.weapon && r.weapon !== 'none' ? 1 : 0) + (r.offhand ? 1 : 0);
      expect(drops.length, `${label}: dropped pieces`).toBe(held);
      expect((j.handR as THREE.Object3D).children.length, `${label}: the hand still holds`).toBe(0);
      const head = at(j.head);
      for (const d of drops) {
        const ms = under(d), [lo, hi] = span(ms), pts = points(ms, 0.06);
        expect(Math.abs(lo), `${label} ${d.name}: lowest ${lo.toFixed(3)}`).toBeLessThan(0.02);
        expect(hi, `${label} ${d.name}: lies flat`).toBeLessThan(0.8);
        const covered = footprint(body, [Math.min(...pts.map((v) => v.x)) - 0.1, Math.max(...pts.map((v) => v.x)) + 0.1, Math.min(...pts.map((v) => v.z)) - 0.1, Math.max(...pts.map((v) => v.z)) + 0.1]);
        const near = pts.filter((v) => Math.hypot(v.x - head.x, v.z - head.z) <= 0.5), over = pts.filter((v) => covered(v.x, v.z));
        expect(near.length, `${label} ${d.name}: by the head`).toBe(0);
        expect(over.length, `${label} ${d.name}: under or over the body at ${over.slice(0, 3).map((v) => `${v.x.toFixed(2)},${v.z.toFixed(2)}`).join(' ')}`).toBe(0);
      }
    }
  }, 60000);

  it('keep the forearms and hands out of the chest, the bust and the plate the clip check does not see', () => {
    const dirs = [new THREE.Vector3(1, 0.13, 0.07).normalize(), new THREE.Vector3(-0.1, 1, 0.2).normalize(), new THREE.Vector3(0.05, -0.2, 1).normalize()];
    const ray = new THREE.Raycaster();
    const recipes: [string, HeroFigure][] = [['curvy', { build: 'curvy', weapon: 'sword' }], ['plate', DRESSED.plate], ['mail', DRESSED.mail], ['gown', DRESSED.gown]];
    for (const [rn, r] of recipes) for (const p of DEAD) {
      const g = build({ ...r, deadPose: p }), j = joints(g);
      // the chest's own lofts and the plate over them (closed surfaces), seen from both sides
      const chest = under(j.chest, [j.neck, j.collarR, j.collarL]).filter((m) => m.geometry.type === 'BufferGeometry' && !m.userData.garment && !m.userData.cloth);
      const mats = chest.map((m) => { const was = (m.material as THREE.Material).side; (m.material as THREE.Material).side = THREE.DoubleSide; return was; });
      try {
        for (const side of ['R', 'L']) for (const v of points(under(j[`elbow${side}`]), 0.2)) {
          const inside = dirs.every((d) => { ray.set(v, d); ray.far = 20; return ray.intersectObjects(chest, false).length % 2 === 1; });
          expect(inside, `${rn} ${p}: arm ${side} inside the chest at ${v.toArray().map((x) => x.toFixed(2))}`).toBe(false);
        }
      } finally { chest.forEach((m, i) => { (m.material as THREE.Material).side = mats[i]; }); }
    }
  }, 30000);
});
