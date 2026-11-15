// Cloth check for the jointed figures (kit/heroes.ts): does any part of the body pass out through a garment hung on it?
// Each garment (a mesh the rig marks `userData.garment`: a gown, a skirt, a tunic's skirt, coat tails, a mail shirt, a
// cloak, a capelet, a plate hung like cloth) is read as its triangles, and each part of the body as its mesh vertices
// and the line of its bones: the spine for the torso, the hips and the neck, shoulder to elbow to wrist for an arm, hip
// to knee to ankle for a leg, along its length for a weapon put away. Cloth never runs through flesh, so where the line from a part's bone out to a point on its
// surface crosses a garment, the cloth there lies inside the part and the part shows through it (a knee through a
// gown, an elbow through a cape); how far the surface lies past the cloth is the depth. Cloth just touching the skin
// (within the tolerance) is not a poke. What a garment's trims add on top of it (a hem band, clasps, a hood, marked
// `userData.cloth`) is cloth, not body. Pure geometry: no rendering, so tests can run it on every figure in every pose.
import * as THREE from 'three';

/** A part of the body passing out through a garment: `depth` is how far past the cloth its deepest point lies (feet),
 *  `points` how many of its points lie past it, `at` the deepest one (world). */
export interface Poke { garment: string; part: string; depth: number; points: number; at: [number, number, number] }
export interface PokeOptions {
  /** How far (feet, at the figure's own scale) skin may lie past the cloth before it counts: cloth resting on the skin
   *  is not a poke. Default 0.03. */
  tolerance?: number;
}

// (a see-through part's depth-only twin, userData.veil, is no surface: kit/monsters.ts)
const solid = (m: THREE.Object3D): m is THREE.Mesh => (m as THREE.Mesh).isMesh && !((m as THREE.Mesh).material as THREE.Material).transparent && !m.userData.veil;
const flesh = (m: THREE.Object3D): m is THREE.Mesh => solid(m) && !m.userData.garment && !m.userData.cloth;

/** Every poke in a posed figure built by heroFigure (rest, battle or dead), deepest first. */
export function findPokes(figure: THREE.Object3D, o: PokeOptions = {}): Poke[] {
  figure.updateMatrixWorld(true);
  const J: Record<string, THREE.Object3D> = {}; figure.traverse((c) => { if (c.name && !J[c.name]) J[c.name] = c; });
  if (!J.neck || !J.chest || !J.hips) return [];
  const s = J.neck.position.y / 2.24, tol = (o.tolerance ?? 0.03) * s;
  const at = (n: string) => J[n]?.getWorldPosition(new THREE.Vector3());
  // the garments' triangles (world), binned in a grid of cells
  const tri: number[] = [], owner: string[] = [];
  figure.traverse((c) => {
    if (!solid(c) || !c.userData.garment) return;
    const g = c.geometry, p = g.getAttribute('position') as THREE.BufferAttribute, idx = g.index, n = (idx ? idx.count : p.count) / 3, v = new THREE.Vector3();
    for (let t = 0; t < n; t++) { for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(c.matrixWorld); tri.push(v.x, v.y, v.z); } owner.push(String(c.userData.garment)); }
  });
  if (!owner.length) return [];
  const h = 0.25 * s;
  const grid = new Map<number, number[]>();
  for (let t = 0; t < owner.length; t++) {
    const b = t * 9, lo = [0, 1, 2].map((k) => Math.min(tri[b + k], tri[b + 3 + k], tri[b + 6 + k])), hi = [0, 1, 2].map((k) => Math.max(tri[b + k], tri[b + 3 + k], tri[b + 6 + k]));
    for (let x = Math.floor(lo[0] / h); x <= Math.floor(hi[0] / h); x++) for (let y = Math.floor(lo[1] / h); y <= Math.floor(hi[1] / h); y++) for (let z = Math.floor(lo[2] / h); z <= Math.floor(hi[2] / h); z++) {
      const k = ((x + 512) * 1024 + y + 512) * 1024 + z + 512; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t);
    }
  }
  // the parts: their meshes and the line of their bones
  type Part = { name: string; meshes: THREE.Mesh[]; bones: THREE.Vector3[] };
  const parts: Part[] = [], direct = (n: string) => (J[n] ? J[n].children.filter(flesh) : []), deep = (n: string) => { const out: THREE.Mesh[] = []; J[n]?.traverse((c) => { if (flesh(c)) out.push(c); }); return out; };
  const spine = [at('hips')!, at('chest')!, at('neck')!];
  // (of the trunk, only its skin and what is worn close on it: the rig marks them `userData.skin`; gear hung on it, a
  // pouch or a vial at the belt, may lie over the cloth)
  const skin = (n: string) => direct(n).filter((m) => m.userData.skin);
  parts.push({ name: 'torso', meshes: skin('chest'), bones: spine }, { name: 'pelvis', meshes: skin('hips'), bones: spine }, { name: 'neck', meshes: direct('neck'), bones: [at('chest')!, at('neck')!, at('head') ?? at('neck')!] });
  for (const sd of ['R', 'L']) {
    const arm = [at('shoulder' + sd), at('elbow' + sd), at('wrist' + sd)], leg = [at('hip' + sd), at('knee' + sd), at('ankle' + sd)];
    if (arm.every(Boolean)) {
      parts.push({ name: 'upperArm' + sd, meshes: direct('shoulder' + sd), bones: arm as THREE.Vector3[] }, { name: 'forearm' + sd, meshes: direct('elbow' + sd), bones: arm as THREE.Vector3[] });
      parts.push({ name: 'hand' + sd, meshes: direct('wrist' + sd), bones: [arm[1]!, arm[2]!, at('hand' + sd) ?? arm[2]!] });
    }
    if (leg.every(Boolean)) {
      parts.push({ name: 'thigh' + sd, meshes: direct('hip' + sd), bones: leg as THREE.Vector3[] }, { name: 'shin' + sd, meshes: direct('knee' + sd), bones: leg as THREE.Vector3[] });
      const feet = deep('ankle' + sd), mid = new THREE.Vector3(); let n = 0;
      for (const m of feet) { m.geometry.computeBoundingBox(); mid.add(m.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld)); n++; }
      if (n) parts.push({ name: 'foot' + sd, meshes: feet, bones: [leg[1]!, leg[2]!, mid.divideScalar(n)] });
    }
  }
  // gear put away (a weapon at the belt, or slung on the back), each piece read along its own length: its haft or its
  // blade. Every group named 'stowed' or flagged userData.stowed is a piece, as the rig hangs cloth over each of them.
  const stowedOne = (o: THREE.Object3D) => o.name === 'stowed' || !!o.userData.stowed, stows: THREE.Object3D[] = [];
  figure.traverse((c) => { if (!stowedOne(c)) return; for (let p = c.parent; p; p = p.parent) if (stowedOne(p)) return; stows.push(c); });
  for (const g of stows) {
    const ms: THREE.Mesh[] = [], inv = g.matrixWorld.clone().invert(), bb = new THREE.Box3(); let lo = Infinity, hi = -Infinity;
    g.traverse((c) => { if (flesh(c)) ms.push(c); });
    for (const m of ms) { m.geometry.computeBoundingBox(); bb.copy(m.geometry.boundingBox!).applyMatrix4(inv.clone().multiply(m.matrixWorld)); lo = Math.min(lo, bb.min.y); hi = Math.max(hi, bb.max.y); }
    if (ms.length) parts.push({ name: 'stowed', meshes: ms, bones: [g.localToWorld(new THREE.Vector3(0, lo, 0)), g.localToWorld(new THREE.Vector3(0, hi, 0))] });
  }
  // each surface point against the cloth crossing the line in to its bone
  const stamp = new Int32Array(owner.length).fill(-1), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3(), d = new THREE.Vector3();
  const near = (p: THREE.Vector3, bones: THREE.Vector3[], out: THREE.Vector3) => {
    let best = Infinity;
    for (let i = 0; i + 1 < bones.length; i++) {
      const a = bones[i], b = bones[i + 1], ab = d.copy(b).sub(a), l2 = ab.lengthSq(), t = l2 > 1e-12 ? Math.max(0, Math.min(1, qv.copy(p).sub(a).dot(ab) / l2)) : 0;
      const c = qv.copy(a).addScaledVector(ab, t), dd = c.distanceToSquared(p); if (dd < best) { best = dd; out.copy(c); }
    }
  };
  const hits = new Map<string, Poke>(), a = new THREE.Vector3(), v = new THREE.Vector3(), dir = new THREE.Vector3();
  let seq = 0;
  for (const part of parts) for (const m of part.meshes) {
    const p = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); near(v, part.bones, a);
      dir.copy(v).sub(a); const len = dir.length(); if (len <= tol) continue;
      seq++;
      let deepest = 0, by = '';
      const x0 = Math.floor(Math.min(a.x, v.x) / h), x1 = Math.floor(Math.max(a.x, v.x) / h), y0 = Math.floor(Math.min(a.y, v.y) / h), y1 = Math.floor(Math.max(a.y, v.y) / h), z0 = Math.floor(Math.min(a.z, v.z) / h), z1 = Math.floor(Math.max(a.z, v.z) / h);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const l = grid.get(((x + 512) * 1024 + y + 512) * 1024 + z + 512); if (!l) continue;
        for (const t of l) {
          if (stamp[t] === seq) continue; stamp[t] = seq;
          // the line from the bone to the point against the triangle (Moller-Trumbore)
          const b = t * 9; e1.set(tri[b + 3] - tri[b], tri[b + 4] - tri[b + 1], tri[b + 5] - tri[b + 2]); e2.set(tri[b + 6] - tri[b], tri[b + 7] - tri[b + 1], tri[b + 8] - tri[b + 2]);
          pv.crossVectors(dir, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det; tv.set(a.x - tri[b], a.y - tri[b + 1], a.z - tri[b + 2]); const uu = tv.dot(pv) * inv; if (uu < 0 || uu > 1) continue;
          qv.crossVectors(tv, e1); const vv = dir.dot(qv) * inv; if (vv < 0 || uu + vv > 1) continue;
          const tt = e2.dot(qv) * inv; if (tt <= 0 || tt >= 1) continue;
          const past = (1 - tt) * len; if (past > deepest) { deepest = past; by = owner[t]; }
        }
      }
      if (deepest <= tol) continue;
      const k = by + '>' + part.name, hit = hits.get(k);
      if (!hit) hits.set(k, { garment: by, part: part.name, depth: deepest, points: 1, at: [v.x, v.y, v.z] });
      else { hit.points++; if (deepest > hit.depth) { hit.depth = deepest; hit.at = [v.x, v.y, v.z]; } }
    }
  }
  return [...hits.values()].sort((x, y) => y.depth - x.depth);
}

/** A one-line account of a figure's pokes, for a test's failure message or a console. */
export const describePokes = (p: Poke[]): string => p.map((h) => `${h.part} through ${h.garment} ${h.depth.toFixed(2)}ft×${h.points}`).join(', ');
