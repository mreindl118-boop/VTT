// Long hair (kit/heroes.ts buildHair, drapeLong) falls from the head once the figure is posed: over the shoulders and
// down the back, over whatever the back wears instead of through it, with an under-layer so that no skin shows between
// its locks from behind; the locks framing the face fall in front to the collarbone and lie on what the chest wears. It
// lies under a wreath, leaving it below its lower edge no more steeply than it rises off the head, and, with drop
// earrings, is tucked behind the ears so that they hang clear (underBands, buildHair), covering the side of the head down
// to the ear and never running through it; before the ears its under-layer's edge lies on the skin, so that the hairline
// there is clean once it shows, and paint on the face never moves it. On a body laid out no hair (long, braided or curly)
// lies under the floor, on its back it lies under the cloak it lies on, and a fairy's curls keep off her wings. An NPC
// fallen in a shoulder mantle on a side or face down lays its locks over what is left of the mantle below the head
// (clearOfCloth) and ends the sheet under them where it meets the mantle (sheetsOffCloth), and on its back drops a lock
// beside the head to the floor before the mantle's collar (clearOfCloth). Curls keep out of the cloth, standing and
// fallen: a coil that would pass through a hood folded on the back or a mantle lying beside a fallen head ends short of
// it (coilsOffCloth). Standing, an NPC's locks go round what stands up steeply beside the neck below the head, a capelet
// lifted by an arm raised to strike or a hood folded at the nape (clearOfCloth), and bend round a bow slung on the back
// where its upper limb rises among them behind the shoulder (locksPastGear).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';
import { BESTIARY, figureFor } from '../app/src/bestiary';

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

/** World triangles of some meshes. */
function trisOf(ms: M[]): THREE.Vector3[][] {
  const out: THREE.Vector3[][] = [];
  for (const m of ms) { const p = m.geometry.getAttribute('position'), ix = m.geometry.index, at = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(j) : j).applyMatrix4(m.matrixWorld); for (let i = 0; i + 2 < (ix ? ix.count : p.count); i += 3) out.push([at(i), at(i + 1), at(i + 2)]); }
  return out;
}
/** Whether segment ab passes through triangle t (strictly between its ends). */
function segThrough(a: THREE.Vector3, b: THREE.Vector3, t: THREE.Vector3[]): boolean {
  const d = b.clone().sub(a), len = d.length(); if (len < 1e-9) return false; d.divideScalar(len);
  const e1 = t[1].clone().sub(t[0]), e2 = t[2].clone().sub(t[0]), h = new THREE.Vector3().crossVectors(d, e2), det = e1.dot(h); if (Math.abs(det) < 1e-12) return false;
  const sv = a.clone().sub(t[0]), u = sv.dot(h) / det; if (u < 0 || u > 1) return false;
  const q = new THREE.Vector3().crossVectors(sv, e1), w = d.dot(q) / det; if (w < 0 || u + w > 1) return false;
  const k = e2.dot(q) / det; return k > 0 && k < len;
}
const trisCross = (A: THREE.Vector3[], B: THREE.Vector3[]) => [0, 1, 2].some((i) => segThrough(A[i], A[(i + 1) % 3], B) || segThrough(B[i], B[(i + 1) % 3], A));
/** How many of the triangles of `a` pass through a triangle of `b`, the two binned together in cells `cell` wide. */
function crossings(a: THREE.Vector3[][], b: THREE.Vector3[][], cell: number): number {
  const grid = new Map<string, THREE.Vector3[][]>(), lo = new THREE.Vector3(), hi = new THREE.Vector3();
  const cells = (t: THREE.Vector3[], f: (k: string) => void) => {
    lo.copy(t[0]).min(t[1]).min(t[2]); hi.copy(t[0]).max(t[1]).max(t[2]);
    for (let x = Math.floor(lo.x / cell); x <= Math.floor(hi.x / cell); x++) for (let y = Math.floor(lo.y / cell); y <= Math.floor(hi.y / cell); y++) for (let z = Math.floor(lo.z / cell); z <= Math.floor(hi.z / cell); z++) f(`${x},${y},${z}`);
  };
  for (const t of b) cells(t, (k) => { const l = grid.get(k); if (l) l.push(t); else grid.set(k, [t]); });
  let n = 0;
  for (const t of a) { let hit = false; const seen = new Set<THREE.Vector3[]>(); cells(t, (k) => { if (hit) return; for (const u of grid.get(k) ?? []) { if (seen.has(u)) continue; seen.add(u); if (trisCross(t, u)) { hit = true; return; } } }); if (hit) n++; }
  return n;
}
const hexOf = (m: M) => ((m.material as THREE.MeshStandardMaterial).color?.getHexString() ?? '');

describe('long hair and what the head wears', () => {
  // the woman in the gown under a wreath, with drop earrings (as in Rowena's art: the hair tucked behind the ears, the
  // earrings hanging clear in front of it)
  const WREATH = ['2a1a0c', 'f7f1dd', '4a7a2a'], DROPS = ['c9a227', 'c9c2b0'];
  const crowned: HeroFigure = { ...gowned, wreath: { color: '#2a1a0c', flower: '#f7f1dd', leaf: '#4a7a2a' }, earrings: '#c9a227' };
  it('lies under the wreath and is tucked behind the ears for drop earrings: no hair through either, standing, fighting or fallen', () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = build(crowned, st), s = scaleOf(g), all = meshes(g), hair = trisOf(all.filter(isHair));
      const wreath = all.filter((m) => WREATH.includes(hexOf(m))), drops = all.filter((m) => DROPS.includes(hexOf(m)));
      expect(wreath.length, st).toBeGreaterThan(10); expect(drops.length, st).toBe(4);
      expect(crossings(hair, trisOf(wreath), 0.06 * s), `${st}: hair through the wreath`).toBe(0);
      expect(crossings(hair, trisOf(drops), 0.06 * s), `${st}: hair through an earring`).toBe(0);
    }
  }, 120000);

  it('lays the hairline before the ears on the skin: the under-layer there never dips through it', () => {
    for (const f of [gowned, mailed, braided, crowned]) {
      const g = build(f, 'rest'), s = scaleOf(g), head = g.getObjectByName('head')!; let skull: M | undefined;
      head.traverse((o) => { if (!skull && (o as M).isMesh && o.userData.skull) skull = o as M; });
      skull!.geometry.computeBoundingBox(); const c = skull!.localToWorld(skull!.geometry.boundingBox!.getCenter(new THREE.Vector3())), inv = head.matrixWorld.clone().invert(), hc = c.clone().applyMatrix4(inv);
      // (the under-layer's triangles before the ears: out from the skull's middle, within 1.3 of the front either way)
      const before = (t: THREE.Vector3[]) => { const m = t[0].clone().add(t[1]).add(t[2]).divideScalar(3).applyMatrix4(inv).sub(hc); return Math.abs(Math.atan2(m.x, m.z)) < 1.3; };
      const cap = trisOf(meshes(head).filter((m) => m.userData.hair === 'do')).filter(before);
      expect(cap.length, `${f.hairStyle}`).toBeGreaterThan(200);
      expect(crossings(cap, trisOf([skull!]), 0.06 * s), `${f.hairStyle}${f.earrings ? ' with earrings' : ''}`).toBe(0);
    }
  }, 60000);

  // the same with a broad head, on which the ear comes out of the head lower
  const broad: HeroFigure = { ...crowned, face: { headW: 0.6 } };
  /** The head's frame, the skull's middle in it, and this head's ears (buildFace marks them). */
  const headOf = (g: THREE.Object3D) => {
    const head = g.getObjectByName('head')!; let skull: M | undefined; head.traverse((o) => { if (!skull && (o as M).isMesh && o.userData.skull) skull = o as M; });
    skull!.geometry.computeBoundingBox(); const inv = head.matrixWorld.clone().invert(), c = skull!.localToWorld(skull!.geometry.boundingBox!.getCenter(new THREE.Vector3())).applyMatrix4(inv);
    const ears = head.children.filter((e) => e.userData.ear);
    return { head, skull: skull!, inv, c, ears, earMeshes: ears.flatMap((e) => meshes(e)) };
  };

  it('tucked behind the ears, covers the side of the head over the ear and in front of it: no scalp shows there', () => {
    for (const f of [crowned, broad]) for (const st of ['rest', 'battle'] as const) {
      const g = build(f, st), s = scaleOf(g), { head, skull, inv, ears } = headOf(g), solid = meshes(g).filter((m) => !(m.material as THREE.Material).transparent), ray = new THREE.Raycaster();
      expect(ears.length, `${st}: the ears`).toBe(2);
      for (const e of ears) {
        // (the ear in the head's frame: its front, back and top, then level rays in from beside the head over a patch
        // from just above the ear's top up a twentieth of a foot, across the ear, and over a patch before the ear about
        // its top, between the sideburn's edge and the ear: each meets the hair, or the ear, before the skull)
        const box = new THREE.Box3(); for (const m of meshes(e)) { const p = m.geometry.getAttribute('position'), v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); }
        const sx = Math.sign(box.min.x + box.max.x), patches: [number, number, number, number][] = [[box.min.z, box.max.z, box.max.y, box.max.y + 0.05 * s], [box.max.z + 0.02 * s, box.max.z + 0.07 * s, box.max.y - 0.03 * s, box.max.y + 0.03 * s]];
        let rays = 0, bare = 0;
        for (const [z0, z1, y0, y1] of patches) for (let z = z0; z <= z1 + 1e-9; z += 0.01 * s) for (let y = y0; y <= y1 + 1e-9; y += 0.01 * s) {
          const o = head.localToWorld(new THREE.Vector3(sx * 1.5 * s, y, z)), d = new THREE.Vector3(-sx, 0, 0).transformDirection(head.matrixWorld);
          ray.set(o, d); const hit = ray.intersectObjects(solid, false)[0]; if (!hit) continue; rays++; if (hit.object === skull) bare++;
        }
        expect(rays, `${st} ear ${sx}`).toBeGreaterThan(40);
        expect(bare, `${f.face ? 'broad head' : 'head'} ${st} ear ${sx}: rays meeting the scalp`).toBe(0);
      }
    }
  }, 60000);

  it('tucked behind the ears, never runs through them, standing, fighting or fallen', () => {
    for (const f of [crowned, broad]) for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = build(f, st), s = scaleOf(g), { earMeshes } = headOf(g), hair = meshes(g).filter(isHair);
      expect(earMeshes.length, st).toBe(6);
      expect(crossings(trisOf(hair), trisOf(earMeshes), 0.03 * s), `${f.face ? 'broad head' : 'head'} ${st}: hair through an ear`).toBe(0);
    }
  }, 120000);

  it('leaves the wreath below its lower edge no more steeply than it rises off the head: never pinched in under it', () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = build(crowned, st), s = scaleOf(g), { inv, c } = headOf(g), all = meshes(g), v = new THREE.Vector3();
      // (the band round the head's upright about the skull's middle, each of 90 ways round its innermost face and its
      // lower edge, taken over the next way round on either side too)
      const N = 90, bin = (x: number, z: number) => (Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * N) % N + N) % N;
      const i0 = new Array(N).fill(Infinity), l0 = new Array(N).fill(Infinity);
      for (const m of all.filter((m) => WREATH.includes(hexOf(m)))) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv).sub(c); const k = bin(v.x, v.z); i0[k] = Math.min(i0[k], Math.hypot(v.x, v.z)); l0[k] = Math.min(l0[k], v.y); } }
      const rIn = i0.map((_, k) => Math.min(i0[(k + N - 1) % N], i0[k], i0[(k + 1) % N])), yLo = l0.map((_, k) => Math.min(l0[(k + N - 1) % N], l0[k], l0[(k + 1) % N]));
      expect(rIn.every((r) => r < Infinity), st).toBe(true);
      // (every point of the hair within an eighth of a foot below the band's lower edge lies no further out than the
      // band's inner face and as far again as it is below the edge)
      let n = 0, out = 0, worst = 0;
      for (const m of all.filter(isHair)) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv).sub(c); const k = bin(v.x, v.z), below = yLo[k] - v.y; if (below <= 0 || below > 0.12 * s) continue; n++;
        const over = Math.hypot(v.x, v.z) - (rIn[k] + below); if (over > 0.01 * s) { out++; worst = Math.max(worst, over / s); }
      } }
      expect(n, st).toBeGreaterThan(500);
      expect(out, `${st}: points standing out below the band (worst ${worst.toFixed(3)} ft past the slope)`).toBe(0);
    }
  }, 120000);

  it('is never moved by paint on the face: it is the face, not something worn over the hair', () => {
    for (const f of [gowned, mailed]) {
      const hairOf = (g: THREE.Object3D) => meshes(g).filter(isHair).map((m) => Array.from(m.geometry.getAttribute('position').array as Float32Array));
      const plain = hairOf(build(f, 'rest')), painted = hairOf(build({ ...f, markings: '#6a1a1a' }, 'rest'));
      expect(painted.length, f.frame).toBe(plain.length);
      let worst = 0; plain.forEach((a, i) => { expect(painted[i].length, f.frame).toBe(a.length); for (let j = 0; j < a.length; j++) worst = Math.max(worst, Math.abs(a[j] - painted[i][j])); });
      expect(worst, `${f.frame}: how far paint on the face moved the hair`).toBe(0);
    }
  }, 60000);
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

  it('on its back lies under the cloak the body lies on, never up through it', () => {
    // (the man in mail under a cloak, whose hair came up through the cloak under his neck and shoulders, and whose locks,
    // falling from the side of his head to the floor beside his mantle's collar, dropped through its edge; and the woman
    // in the gown and cloak)
    for (const [f, hex] of [[mailed, '1c2c5e'], [gowned, '4b1a33']] as const) for (const deadPose of ['dead', 'dead-swoon', 'dead-comic'] as const) {
      const g = build({ ...f, deadPose }, 'dead'), s = scaleOf(g), all = meshes(g), ray = new THREE.Raycaster(), v = new THREE.Vector3();
      const worn = all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
      const cloth = worn.map((m) => { const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); w.matrixAutoUpdate = false; w.matrixWorld.copy(m.matrixWorld); return w; });
      expect(all.some((m) => hexOf(m) === hex && m.userData.garment), `${deadPose}: the cloak`).toBe(true);
      // (each point of the hair, read straight up from under the floor: where the lowest cloth over it lies on the floor,
      // within a third of a foot of it, the point is under that cloth, and not above it by more than a hair and less than
      // the height a lock stands up off the floor, an eighth of a foot)
      let read = 0, under = 0, through = 0;
      for (const m of all.filter(isHair)) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i += 2) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); ray.set(new THREE.Vector3(v.x, -1, v.z), new THREE.Vector3(0, 1, 0)); ray.far = 1 + 0.3 * s;
        const hit = ray.intersectObjects(cloth, false)[0]; if (!hit) continue; read++;
        if (v.y < hit.point.y) under++;
        if (v.y > hit.point.y + 0.002 * s && v.y < hit.point.y + 0.12 * s) through++;
      } }
      expect(read, `${f.frame} ${deadPose}`).toBeGreaterThan(500);
      expect(under, `${f.frame} ${deadPose}: points of the hair under the cloak lying on the floor`).toBeGreaterThan(0.9 * read);
      expect(through, `${f.frame} ${deadPose}: points of the hair up in the cloak lying on the floor`).toBe(0);
      // (and no face of the hair passes through a face of what lies on the floor, the lock's drop beside the cloak's edge
      // or its collar's, from the head to under it, included)
      const floor = trisOf(worn).filter((t) => Math.min(t[0].y, t[1].y, t[2].y) < 0.3 * s);
      expect(crossings(trisOf(all.filter(isHair)), floor, 0.06 * s), `${f.frame} ${deadPose}: hair through the cloth lying on the floor`).toBe(0);
    }
  }, 180000);
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

describe('curls and cloth', () => {
  it('keeps every curl out of what the figure wears: a hood folded on the back, a mantle lying beside a fallen head', () => {
    // (scouts with curly hair under a hood folded on the back, at rest and in a fight, and a scout and a knight fallen on
    // a side in a mantle: the curls hanging low behind the head passed into the hood, and the mantle laid beside a fallen
    // head through the curls on that side)
    const cases: [string, string, 'rest' | 'battle' | 'dead'][] = [['scout', 'a', 'rest'], ['scout', 'f', 'rest'], ['scout', 'g', 'battle'], ['scout', 'c', 'dead'], ['knight', 'g', 'dead']];
    for (const [id, seed, st] of cases) {
      const g = figureFor(BESTIARY.find((e) => e.id === id)!, st === 'dead' ? 'dead' : st === 'battle', seed); g.updateMatrixWorld(true);
      const s = scaleOf(g), all = meshes(g), coils = all.filter((m) => m.userData.coil), cloth = all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
      expect(coils.length, `${id}@${seed} ${st}`).toBeGreaterThan(50);
      expect(cloth.length, `${id}@${seed} ${st}`).toBeGreaterThan(0);
      expect(crossings(trisOf(coils), trisOf(cloth), 0.06 * s), `${id}@${seed} ${st}: curls through the cloth`).toBe(0);
    }
  }, 120000);
});

describe('long hair on an NPC fallen in a shoulder mantle', () => {
  // (the token's seed picks the fall; each of these, long-haired in a mantle, fell as its case says)
  const fallen = (id: string, seed: string) => { const g = figureFor(BESTIARY.find((e) => e.id === id)!, 'dead', seed); g.updateMatrixWorld(true); return g; };
  const lieOf = (g: THREE.Object3D) => { const y = new THREE.Vector3(0, 0, 1).transformDirection(g.getObjectByName('chest')!.matrixWorld).y; return y > 0.5 ? 'back' : y < -0.5 ? 'front' : 'side'; };
  const clothOf = (all: M[]) => all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
  /** The faces of a lock (a tube of rings of 6, lockGeometry) from where it leaves the head (`userData.free`) to its tip. */
  function fallOf(m: M): THREE.Vector3[][] {
    const p = m.geometry.getAttribute('position'), ix = m.geometry.index!, n = (p.count - 2) / 6 - 1, kF = Math.ceil((m.userData.free as number) * n), out: THREE.Vector3[][] = [];
    const at = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix.getX(j)).applyMatrix4(m.matrixWorld);
    for (let i = 0; i + 2 < ix.count; i += 3) { const a = ix.getX(i), k = Math.floor(a / 6); if ((k >= kF && k <= n) || a === (n + 1) * 6 + 1) out.push([at(i), at(i + 1), at(i + 2)]); }
    return out;
  }

  it('on a side or face down lays its locks over what is left of the mantle below the head: none passes through the cloth there', () => {
    // (the mantle, kept off the head, bunches at the nape or hangs from the shoulder to the floor beside the head: hung as
    // it would hang standing, a lock fell through it)
    for (const [id, seed, lie] of [['wight', 'a', 'side'], ['dusk-elf', 'g', 'side'], ['barovian-witch', 'e', 'side'], ['dusk-elf', 'd', 'front'], ['barovian-witch', '', 'front'], ['wight', 'b', 'front']] as const) {
      const g = fallen(id, seed), s = scaleOf(g), all = meshes(g), locks = all.filter((m) => (m.userData.hair === 'lock' || m.userData.hair === 'frame') && m.userData.free !== undefined);
      expect(lieOf(g), `${id}@${seed}`).toBe(lie);
      expect(locks.length, `${id}@${seed}`).toBeGreaterThan(40);
      expect(crossings(locks.flatMap(fallOf), trisOf(clothOf(all)), 0.06 * s), `${id}@${seed}: locks through the cloth below the head`).toBe(0);
    }
  }, 180000);

  it('on a side or face down ends the sheet under the locks where it meets the mantle: none of it passes through the cloth below the head', () => {
    // (the sheet behind the locks falls as they do but nearer the body, and is not walked out of the cloth as they are: it
    // fell through the mantle lying beside the head and on the floor)
    for (const [id, seed, lie] of [['mage', 'e', 'front'], ['druid', '', 'front'], ['cultist', 'g', 'side'], ['barovian-witch', 'e', 'side']] as const) {
      const g = fallen(id, seed), s = scaleOf(g), all = meshes(g), sheets = all.filter((m) => m.userData.hair === 'sheet');
      expect(lieOf(g), `${id}@${seed}`).toBe(lie);
      expect(sheets.length, `${id}@${seed}`).toBe(1);
      // (its faces below its first two rows: a sheet is 17 rows of its columns, its top row under the locks' feet)
      const below = sheets.flatMap((m) => { const n = m.geometry.getAttribute('position').count / 17, per = 2 * (n - 1); return trisOf([m]).filter((_, f) => Math.floor(f / per) >= 2); });
      expect(below.length, `${id}@${seed}`).toBeGreaterThan(100);
      expect(crossings(below, trisOf(clothOf(all)), 0.06 * s), `${id}@${seed}: the sheet through the cloth below the head`).toBe(0);
    }
  }, 120000);

  it('on its back drops a lock beside the head to the floor before the mantle\'s collar: no hair passes through the cloth', () => {
    // (the collar, laid round the neck, stands up beside it: a lock falling from the side of the head to the floor, to lie
    // under the body, fell through it)
    for (const [id, seed] of [['mage', 'g'], ['druid', 'd']] as const) {
      const g = fallen(id, seed), s = scaleOf(g), all = meshes(g), hair = all.filter(isHair);
      expect(lieOf(g), `${id}@${seed}`).toBe('back');
      expect(hair.filter((m) => m.userData.hair === 'lock').length, `${id}@${seed}`).toBeGreaterThan(40);
      expect(crossings(trisOf(hair), trisOf(clothOf(all)), 0.06 * s), `${id}@${seed}: hair through the cloth`).toBe(0);
    }
  }, 120000);
});

describe('long hair on an NPC standing in a capelet or a hood', () => {
  const standing = (id: string, seed: string, st: 'rest' | 'battle') => { const g = figureFor(BESTIARY.find((e) => e.id === id)!, st === 'battle', seed); g.updateMatrixWorld(true); return g; };
  /** The faces of a lock (a tube of rings of 6, lockGeometry) from where it leaves the head (`userData.free`) to its tip. */
  function fallOf(m: M): THREE.Vector3[][] {
    const p = m.geometry.getAttribute('position'), ix = m.geometry.index!, n = (p.count - 2) / 6 - 1, kF = Math.ceil((m.userData.free as number) * n), out: THREE.Vector3[][] = [];
    const at = (j: number) => new THREE.Vector3().fromBufferAttribute(p, ix.getX(j)).applyMatrix4(m.matrixWorld);
    for (let i = 0; i + 2 < ix.count; i += 3) { const a = ix.getX(i), k = Math.floor(a / 6); if ((k >= kF && k <= n) || a === (n + 1) * 6 + 1) out.push([at(i), at(i + 1), at(i + 2)]); }
    return out;
  }

  it('goes round what stands up beside the neck below the head: none of its locks passes through the cloth there', () => {
    // (cast level from in front as it hangs, a lock missed what stands up steeply beside the neck: the capelet an arm
    // raised to strike lifts up beside the head (the druid, Mad Mary, a dusk elf, the mage's locks framing the face), and
    // the hood folded at the nape (a cultist, Davian at rest))
    const cases: [string, string, 'rest' | 'battle'][] = [['druid', '', 'battle'], ['druid', 'g', 'battle'], ['mad-mary', '', 'battle'], ['dusk-elf', 'a', 'battle'], ['mage', '', 'battle'], ['cultist', 'c', 'rest'], ['davian-martikov', '', 'rest']];
    for (const [id, seed, st] of cases) {
      const g = standing(id, seed, st), s = scaleOf(g), all = meshes(g), locks = all.filter((m) => (m.userData.hair === 'lock' || m.userData.hair === 'frame') && m.userData.free !== undefined);
      const cloth = all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
      expect(locks.length, `${id}@${seed} ${st}`).toBeGreaterThan(10);
      expect(crossings(locks.flatMap(fallOf), trisOf(cloth), 0.06 * s), `${id}@${seed} ${st}: locks through the cloth below the head`).toBe(0);
    }
  }, 180000);
});

describe('long hair and a bow slung on the back', () => {
  it('bends round the bow, standing or fighting: none of the hair passes through its stave, its grip or its string', () => {
    // (the bow lies on the cloak where overCloth lays it, and its upper limb rises behind the shoulder among the side
    // locks, standing off the cloak: on the code before, Davian's locks met it in 299 faces at rest and 365 fighting, a
    // dusk elf's in 387, a scout's in 374, Szoldar's in 130, a wight's in 72)
    for (const [id, seed] of [['davian-martikov', ''], ['szoldar-szoldarovich', ''], ['dusk-elf', ''], ['scout', 'd'], ['wight', '']]) for (const st of ['rest', 'battle'] as const) {
      const g = figureFor(BESTIARY.find((x) => x.id === id)!, st === 'battle', seed); g.updateMatrixWorld(true);
      const s = scaleOf(g), back = g.getObjectByName('back')!, gear = meshes(back).filter((m) => !(m.material as THREE.Material).transparent), hair = meshes(g).filter(isHair);
      expect(gear.length, `${id}@${seed} ${st}: a bow on the back`).toBeGreaterThan(1);
      expect(hair.filter((m) => m.userData.hair === 'lock').length, `${id}@${seed} ${st}`).toBeGreaterThan(10);
      expect(crossings(trisOf(hair), trisOf(gear), 0.06 * s), `${id}@${seed} ${st}: hair through the bow`).toBe(0);
    }
  }, 240000);
});

describe('a hairdo\'s own hair over what is put on once the figure is built', () => {
  it('hangs over Strahd\'s doublet in every form that wears it, standing or fighting: none of his hair passes through its collar, its fur or its cloak', () => {
    // (the doublet, kit/costume.ts, is put on once his figure is built and its hair hung: his swept hair ran through the
    // tall collar standing up behind his neck, the fur heaped on his shoulder and the cloak, 792 faces at rest. It hangs
    // again over them, hairOver, and the collar stands no higher behind than under where the hair leaves his head)
    for (const id of ['strahd-von-zarovich', 'strahd-blade-drawn', 'strahd-mounted', 'strahd-mounted-charging', 'wintersplinter']) for (const st of ['rest', 'battle'] as const) {
      const g = figureFor(BESTIARY.find((x) => x.id === id)!, st === 'battle', ''); g.updateMatrixWorld(true);
      const s = scaleOf(g), all = meshes(g), dress = all.filter((m) => m.userData.dress === 'doublet' && !(m.material as THREE.Material).transparent);
      expect(dress.length, `${id} ${st}`).toBeGreaterThan(10);
      expect(all.filter((m) => m.userData.hair === 'do' && m.userData.free !== undefined).length, `${id} ${st}`).toBeGreaterThan(10);
      expect(crossings(trisOf(all.filter(isHair)), trisOf(dress), 0.06 * s), `${id} ${st}: hair through the doublet`).toBe(0);
    }
  }, 300000);
});

describe('a hairdo\'s own hair hanging from the head, on an NPC in a cloak', () => {
  // (Baba Lysaga's braids hung with bones, Morgantha's wild ropes and Rahadin's swept length are combed straight down from
  // where they leave the scalp: they went through the mantle, the hood folded at the nape and the cloak, and walked out
  // of them from the head instead, a braid deep in the mantle bunched up at the neck. They hang again over what the body
  // wears, as long locks do: drapeLong, hairdoThrough)
  const ids = ['baba-lysaga', 'morgantha', 'rahadin'], states = ['rest', 'battle'] as const;
  const entry = (id: string) => BESTIARY.find((e) => e.id === id)!;
  const posed = (e: (typeof BESTIARY)[number], st: 'rest' | 'battle') => { const g = figureFor(e, st === 'battle', ''); g.updateMatrixWorld(true); return g; };
  // (the same figure with nothing on its shoulders, so its hair hangs as it was combed)
  const bare = (e: (typeof BESTIARY)[number]) => ({ ...e, hero: { ...e.hero!, cloak: undefined } });
  const hanging = (g: THREE.Object3D) => meshes(g).filter((m) => m.userData.hair === 'do' && m.userData.free !== undefined);
  /** A hanging piece's line, the middles of its rings of 6 (a flat lock has no caps), and the first ring below where it
   *  leaves the head. */
  const lineOf = (m: M) => {
    const p = m.geometry.getAttribute('position'), N = (m.userData.flatLock ? p.count / 6 : (p.count - 2) / 6) - 1, kF = Math.min(N, Math.max(1, Math.ceil((m.userData.free as number) * N))), C: THREE.Vector3[] = [];
    for (let k = 0; k <= N; k++) { const c = new THREE.Vector3(); for (let j = 0; j < 6; j++) c.add(new THREE.Vector3().fromBufferAttribute(p, k * 6 + j)); C.push(c.multiplyScalar(1 / 6).applyMatrix4(m.matrixWorld)); }
    return { C, kF };
  };
  // (how long a piece is, along its line: on the head it lies as it was combed, so what it hangs below the head is the rest)
  const lengthOf = (m: M) => { const { C } = lineOf(m); let a = 0; for (let k = 1; k < C.length; k++) a += C[k].distanceTo(C[k - 1]); return a; };

  it('hangs over what the body wears, standing or fighting: none of their hair passes through the cloth', () => {
    for (const id of ids) for (const st of states) {
      const g = posed(entry(id), st), s = scaleOf(g), all = meshes(g), cloth = all.filter((m) => (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent);
      expect(hanging(g).length, `${id} ${st}`).toBeGreaterThan(5);
      expect(cloth.length, `${id} ${st}`).toBeGreaterThan(0);
      expect(crossings(trisOf(all.filter(isHair)), trisOf(cloth), 0.06 * s), `${id} ${st}: hair through the cloth`).toBe(0);
    }
  }, 180000);

  it('keeps its length: each piece hangs below the head as long as it was combed, not bunched up at the neck', () => {
    for (const id of ids) for (const st of states) {
      const now = hanging(posed(entry(id), st)), was = hanging(posed(bare(entry(id)), st));
      expect(now.length, `${id} ${st}`).toBe(was.length);
      now.forEach((m, i) => { const a = lengthOf(m), b = lengthOf(was[i]); expect(a, `${id} ${st}: piece ${i} is ${a.toFixed(3)} long, combed ${b.toFixed(3)}`).toBeGreaterThan(0.9 * b); expect(a, `${id} ${st}: piece ${i}`).toBeLessThan(1.1 * b); });
    }
  }, 180000);

  it('keeps its length on a body fallen on its face or on a side, where a walk out of the cloth would cut it short', () => {
    // (fallen on her face, Baba Lysaga's braids run into the mantle and the cloak over her back: walked out of them from
    // the head, two were cut short where they met them, one to nothing. A walk that ends a hairdo's own hair short of its
    // end, or draws it out, is not taken: clearOfCloth)
    const fallen = (e: (typeof BESTIARY)[number]) => { const g = figureFor(e, 'dead', ''); g.updateMatrixWorld(true); return g; };
    for (const id of ['baba-lysaga', 'rahadin']) {
      const now = hanging(fallen(entry(id))), was = hanging(fallen(bare(entry(id))));
      expect(now.length, id).toBe(was.length);
      now.forEach((m, i) => { const a = lengthOf(m), b = lengthOf(was[i]); expect(a, `${id} fallen: piece ${i} is ${a.toFixed(3)} long, combed ${b.toFixed(3)}`).toBeGreaterThan(0.9 * b); expect(a, `${id} fallen: piece ${i}`).toBeLessThan(1.1 * b); });
    }
  }, 180000);

  it('lies clear of what she wears and of her own body once Baba Lysaga has fallen: face-planted, her arms trailing behind', () => {
    // (the fall her token's seed gave her, face down with her right arm reaching on past her head, laid that arm through
    // the spire of her hair and a braid, and her braids with their bones and charms through her chest, her mantle and her
    // cloak: 322 faces in all. She falls face-planted instead, her arms behind her and her knees splayed wide round her
    // broad belly and hips (kit/poses.ts 'comic-broad'). Her body here is all of it below the neck, which rises into her
    // head under the hair as every neck does)
    const g = figureFor(entry('baba-lysaga'), 'dead', ''); g.updateMatrixWorld(true);
    const s = scaleOf(g), all = meshes(g), hair = all.filter(isHair), op = (m: M) => !(m.material as THREE.Material).transparent, neck = g.getObjectByName('neck')!;
    const within = (o: THREE.Object3D | null) => { while (o) { if (o === neck) return true; o = o.parent; } return false; };
    const cloth = all.filter((m) => (m.userData.garment || m.userData.cloth) && op(m)), body = all.filter((m) => !isHair(m) && !m.userData.garment && !m.userData.cloth && op(m) && !within(m));
    const arms = body.filter((m) => { let o: THREE.Object3D | null = m; while (o && !/^collar/.test(o.name)) o = o.parent; return !!o; });
    expect(hanging(g).length).toBeGreaterThan(5);
    expect(arms.length).toBeGreaterThan(4);
    expect(crossings(trisOf(hair), trisOf(cloth), 0.06 * s), 'hair through the cloth').toBe(0);
    expect(crossings(trisOf(hair), trisOf(body), 0.06 * s), 'hair through the body').toBe(0);
  }, 180000);

  it('takes what is bound on a braid with it: each band, bone and charm sits on its braid as it was bound', () => {
    // (each band round the braid's line, the bone and the charm hung from its end, as far from them as on the braid combed)
    const sits = (g: THREE.Object3D) => {
      const braids = hanging(g).filter((m) => m.userData.strand !== undefined), out: number[] = [];
      for (const m of braids) {
        const { C } = lineOf(m), seg = new THREE.Line3(), q = new THREE.Vector3();
        for (const o of m.parent!.children) {
          if (o.userData.onStrand !== m.userData.strand) continue;
          const p = o.getWorldPosition(new THREE.Vector3());
          if (o.userData.end) { out.push(p.distanceTo(C[C.length - 1])); continue; }
          let d = Infinity; for (let k = 0; k + 1 < C.length; k++) { seg.set(C[k], C[k + 1]); d = Math.min(d, seg.closestPointToPoint(p, true, q).distanceTo(p)); } out.push(d);
        }
      }
      return out;
    };
    for (const st of states) {
      const g = posed(entry('baba-lysaga'), st), s = scaleOf(g), now = sits(g), was = sits(posed(bare(entry('baba-lysaga')), st));
      expect(now.length, st).toBe(40); // (eight braids, each with three bands, a bone and a charm)
      now.forEach((d, i) => expect(Math.abs(d - was[i]), `${st}: piece ${i} bound ${(d / s).toFixed(3)} off its braid, combed ${(was[i] / s).toFixed(3)}`).toBeLessThan(0.02 * s));
    }
  }, 180000);
});
