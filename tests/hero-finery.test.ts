// A gown's finer dress on the hero figures (kit/heroes.ts): a wreath, a leather corset with its belt, full sleeves, vine
// embroidery, a dagged hem over lace, laced boots, laced bracers, cloak brooches and a cloak worn on the shoulders. Each
// is its own recipe field; a generic figure wearing them all is read in every state against the clip check
// (kit/clipcheck.ts) and the cloth check (kit/clothcheck.ts), and each part is found on the figure where it belongs. On
// a body laid out the wreath lies on the floor where the head lies on it, never under it (its back went into the floor),
// crushed flat there and lit as each face of it faces.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { describePokes, findPokes } from '../app/src/kit/clothcheck';

const GOWN: HeroFigure = { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8', sleeves: '#e8e0d0', puffSleeves: true, cloak: '#3a2a4a', bracers: '#6a4a2a', boots: '#4a3020', stance: 'conjure', offhand: { kind: 'book' } };
/** Each finer part, in a colour no other part of the figure wears (so that its meshes are found by their colour). */
const FINERY: HeroFigure = {
  wreath: { color: '#2a1a0c', flower: '#f7f1dd', leaf: '#4a7a2a' }, corset: { color: '#5b3a24', lacing: '#c9a051', buckle: '#b08a4b', vials: ['#9a3a6a', '#d0a040'] },
  fullSleeves: true, vines: '#c8a04f', dagged: true, bootLaces: '#3a2413', bracerLaces: '#3b2515', brooch: '#c7a14e',
};
const DRESSED: HeroFigure = { ...GOWN, ...FINERY };
const STATES = ['rest', 'battle', 'dead'] as const;

type M = THREE.Mesh;
const meshes = (g: THREE.Object3D, pick: (m: M) => boolean = () => true): M[] => { const out: M[] = []; g.updateMatrixWorld(true); g.traverse((c) => { const m = c as M; if (m.isMesh && pick(m)) out.push(m); }); return out; };
const coloured = (g: THREE.Object3D, hex: string): M[] => meshes(g, (m) => '#' + (m.material as THREE.MeshStandardMaterial).color?.getHexString() === hex);
const boxOf = (ms: M[]): THREE.Box3 => ms.reduce((b, m) => b.union(new THREE.Box3().setFromObject(m)), new THREE.Box3());
/** The lowest point of some meshes, read from their vertices. */
const lowest = (ms: M[]): number => { const v = new THREE.Vector3(); let y = Infinity; for (const m of ms) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) y = Math.min(y, v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y); } return y; };
const verts = (g: THREE.Object3D): number => meshes(g).reduce((n, m) => n + m.geometry.attributes.position.count, 0);
const joint = (g: THREE.Object3D, name: string): THREE.Vector3 => (g.userData.joints as Record<string, THREE.Object3D>)[name].getWorldPosition(new THREE.Vector3());
const under = (g: THREE.Object3D, name: string): M[] => meshes((g.userData.joints as Record<string, THREE.Object3D>)[name]);

describe('a gown\'s finer dress', () => {
  it('stands clean in every state: nothing through anything, no body through the cloth', () => {
    for (const recipe of [DRESSED, { ...DRESSED, build: undefined }, { ...DRESSED, cloak: undefined, brooch: undefined }]) for (const st of STATES) {
      const g = heroFigure(recipe, 'medium', st);
      expect(describeClips(findClips(g, recipe)), st).toBe('');
      expect(describePokes(findPokes(g)), st).toBe('');
    }
  }, 60000);
  it('builds each part only when its field is set', () => {
    const colours: [keyof HeroFigure, string][] = [['wreath', '#2a1a0c'], ['wreath', '#f7f1dd'], ['wreath', '#4a7a2a'], ['corset', '#5b3a24'], ['corset', '#c9a051'], ['corset', '#b08a4b'], ['corset', '#9a3a6a'],
      ['vines', '#c8a04f'], ['bootLaces', '#3a2413'], ['bracerLaces', '#3b2515'], ['brooch', '#c7a14e']];
    const all = heroFigure(DRESSED);
    for (const [field, hex] of colours) {
      expect(coloured(all, hex).length, `${field} ${hex}`).toBeGreaterThan(0);
      expect(coloured(heroFigure({ ...DRESSED, [field]: undefined }), hex).length, `without ${field}`).toBe(0);
    }
    expect(verts(heroFigure({ ...GOWN, corset: FINERY.corset })), 'a corset dresses a gown').toBeGreaterThan(verts(heroFigure(GOWN)));
    const { skirt: _s, underskirt: _u, ...plain } = GOWN;
    expect(coloured(heroFigure({ ...plain, corset: FINERY.corset, vines: FINERY.vines, dagged: true }), '#5b3a24').length, 'and nothing else').toBe(0);
  }, 60000);
  it('winds the wreath low round the brow, most of its flowers on the left', () => {
    const g = heroFigure(DRESSED), head = joint(g, 'head'), twigs = boxOf(coloured(g, '#2a1a0c')), flowers = coloured(g, '#f7f1dd');
    expect(twigs.max.y - twigs.min.y).toBeLessThan(0.3);
    expect(twigs.min.y).toBeGreaterThan(head.y);
    const left = flowers.filter((m) => boxOf([m]).getCenter(new THREE.Vector3()).x > head.x).length;
    expect(left).toBeGreaterThan(flowers.length - left);
  });
  it('lets the wreath out a little over the back of the head, longer than it is wide, so that it sits on the hair there', () => {
    // (its twigs round its own middle, in its own frame: over the back of the head they stand further out than over the
    // brow, by most of 0.03 to the figure's size; at the sides, over the ears, as far as at the brow)
    const g = heroFigure(DRESSED), wg = (g.userData.joints as Record<string, THREE.Object3D>).head.children.find((c) => coloured(c, '#2a1a0c').length)!;
    const s = g.getObjectByName('neck')!.position.y / 2.24, inv = wg.matrixWorld.clone().invert(), v = new THREE.Vector3(), by: Record<string, number[]> = { back: [], brow: [], side: [] };
    for (const m of coloured(wg, '#2a1a0c')) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
        if (Math.abs(a + Math.PI / 2) < 0.3) by.back.push(r); else if (Math.abs(a - Math.PI / 2) < 0.3) by.brow.push(r); else if (Math.abs(Math.cos(a)) > 0.98) by.side.push(r);
      }
    }
    const mid = (l: number[]) => { expect(l.length).toBeGreaterThan(20); return [...l].sort((x, y) => x - y)[l.length >> 1]; };
    expect(mid(by.back) - mid(by.brow)).toBeGreaterThan(0.02 * s);
    expect(Math.abs(mid(by.side) - mid(by.brow))).toBeLessThan(0.01 * s);
  });
  it('lays the wreath on the floor where the head lies on it, never under it, crushed flat there and lit as it faces', () => {
    // (the wreath: what on the head holds its twigs)
    const wreathOf = (g: THREE.Object3D) => meshes((g.userData.joints as Record<string, THREE.Object3D>).head.children.find((c) => coloured(c, '#2a1a0c').length)!);
    // (faces of the wreath's smooth pieces lit by a normal at one of their corners turned away from them, which shows
    // near black: a twig pressed flat over onto itself shares its corners between the faces over and under)
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), f = new THREE.Vector3(), v = new THREE.Vector3();
    const darkFaces = (ms: M[]) => {
      let away = 0;
      for (const m of ms) {
        if (!(m.material as THREE.Material).userData.smooth) continue;
        const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, ix = m.geometry.index, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
        for (let t = 0; t + 2 < (ix ? ix.count : p.count); t += 3) {
          const c3 = [0, 1, 2].map((k) => (ix ? ix.getX(t + k) : t + k));
          A.fromBufferAttribute(p, c3[0]).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(p, c3[1]).applyMatrix4(m.matrixWorld); C.fromBufferAttribute(p, c3[2]).applyMatrix4(m.matrixWorld);
          f.crossVectors(C.sub(B), A.sub(B)); if (f.lengthSq() < 1e-14) continue; f.normalize();
          if (c3.some((i) => v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize().dot(f) <= 0)) away++;
        }
      }
      return away;
    };
    const standing = wreathOf(heroFigure(DRESSED));
    expect(darkFaces(standing)).toBe(0);
    let flat = 0;
    for (const deadPose of ['dead', 'dead-swoon', 'dead-comic', 'dead-prone', 'dead-curled'] as const) {
      const w = wreathOf(heroFigure({ ...DRESSED, deadPose }, 'medium', 'dead'));
      expect(w.length, `${deadPose}: all of it`).toBe(standing.length);
      expect(lowest(w), `${deadPose}: never under the floor`).toBeGreaterThan(-1e-6);
      expect(darkFaces(w), `${deadPose}: lit as it faces`).toBe(0);
      if (lowest(w) < 0.01) flat++;
    }
    expect(flat, 'laid on the floor in the falls that bring the head down onto it').toBeGreaterThanOrEqual(3);
  }, 60000);
  it('hangs each of the corset\'s vials from its own place on the belt: plumb on a figure standing, lying on the cloth of one fallen', () => {
    const glassOf = (g: THREE.Object3D) => ['#9a3a6a', '#d0a040'].map((c) => coloured(g, c).find((m) => m.geometry.type === 'SphereGeometry')!);
    for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure(DRESSED, 'medium', st), vials = glassOf(g);
      for (const glass of vials) {
        const cork = glass.parent!.getWorldPosition(new THREE.Vector3()), c = glass.getWorldPosition(new THREE.Vector3());
        expect(cork.y - c.y, st).toBeGreaterThan(0.07);                                                                    // the cork up, the glass under it
        expect(Math.hypot(cork.x - c.x, cork.z - c.z), st).toBeLessThan(0.085);                                           // near plumb: it leans no more than the hip under it pushes it
      }
      const [a, b] = vials.map((m) => m.getWorldPosition(new THREE.Vector3())); expect(a.distanceTo(b), st).toBeGreaterThan(0.14); // side by side, not in one another
      // each thong falls straight from the belt: the hip under it may stand it out, but it does not run sideways along the hip
      const thongs = meshes(g, (m) => m.userData.part === 'thong'); expect(thongs.length, st).toBe(2);
      for (const m of thongs) {
        const tp = m.geometry.attributes.position, pts: THREE.Vector3[] = []; for (let i = 0; i < tp.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(tp, i).applyMatrix4(m.matrixWorld));
        const top = pts.reduce((x, y) => (y.y > x.y ? y : x)), foot = pts.reduce((x, y) => (y.y < x.y ? y : x));
        const hips = joint(g, 'hips'), out = new THREE.Vector3(top.x - hips.x, 0, top.z - hips.z).normalize(), along = new THREE.Vector3(-out.z, 0, out.x);
        expect(top.y - foot.y, st).toBeGreaterThan(0.15); expect(Math.abs(foot.clone().sub(top).dot(along)), st).toBeLessThan(0.1);
      }
    }
    const g = heroFigure(DRESSED, 'medium', 'dead'), cloth = meshes(g, (m) => m.userData.garment === 'gown')[0], pts: THREE.Vector3[] = [], p = cloth.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(cloth.matrixWorld));
    for (const glass of glassOf(g)) {
      const c = glass.getWorldPosition(new THREE.Vector3());
      expect(Math.min(...pts.map((q) => q.distanceTo(c))), 'fallen: on the cloth').toBeLessThan(0.2);
      expect(lowest([glass]), 'fallen: off the floor').toBeGreaterThan(lowest(meshes(g, (m) => m !== glass && !!m.userData.garment)) - 0.005);
    }
  }, 120000);

  it('laces the corset over the gown\'s waist, the skirt hung from its foot and the belt on it', () => {
    for (const st of STATES) {
      const g = heroFigure(DRESSED, 'medium', st), leather = coloured(g, '#5b3a24'), shell = leather.find((m) => m.userData.skin)!;
      expect(shell, st).toBeDefined();
      expect(coloured(g, '#c9a051').length, 'lacing').toBeGreaterThan(0);
      expect(coloured(g, '#b08a4b').length, 'two strap buckles and the belt\'s').toBeGreaterThanOrEqual(3);
      // the skirt's top row (its first 65 points) lies on the corset, never off it: each within a finger of the leather
      const gown = meshes(g, (m) => m.userData.garment === 'gown')[0], p = gown.geometry.attributes.position, sp = shell.geometry.attributes.position;
      const hide = Array.from({ length: sp.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(sp, i).applyMatrix4(shell.matrixWorld));
      for (let i = 0; i < 65; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(gown.matrixWorld);
        expect(Math.min(...hide.map((q) => q.distanceTo(v))), `${st}, point ${i}`).toBeLessThan(0.09);
      }
    }
  });
  it('fills the sleeves from the shoulder line to above the elbow, a frill at the gather', () => {
    for (const sd of ['R', 'L']) {
      const full = heroFigure(DRESSED), puff = heroFigure(GOWN);
      const sleeve = (g: THREE.Object3D) => boxOf(under(g, 'shoulder' + sd).filter((m) => '#' + (m.material as THREE.MeshStandardMaterial).color.getHexString() === '#e8e0d0'));
      expect(sleeve(full).min.y, sd).toBeLessThan(sleeve(puff).min.y - 0.2);
      expect(sleeve(full).min.y, sd).toBeGreaterThan(joint(full, 'elbow' + sd).y - 0.1); // (the frill's edge hangs about level with the elbow)
      expect(sleeve(full).max.y, 'the shoulders stay bare').toBeLessThan(joint(full, 'shoulder' + sd).y + 0.12);
    }
  });
  it('cuts the hem in dags over lace, and works vines along the hem, the slit and the cloak\'s edges', () => {
    const plain = heroFigure({ ...GOWN }), cut = heroFigure({ ...GOWN, dagged: true }), hem = (g: THREE.Object3D) => {
      const m = meshes(g, (c) => c.userData.garment === 'gown')[0], p = m.geometry.attributes.position, ys: number[] = [];
      for (let i = 0; i < p.count; i++) ys.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y);
      return ys.sort((a, b) => a - b).slice(0, 60);
    };
    const spread = (ys: number[]) => ys[ys.length - 1] - ys[0];
    expect(spread(hem(cut))).toBeGreaterThan(spread(hem(plain)) + 0.03);
    const lace = (g: THREE.Object3D) => boxOf(coloured(g, '#efe3c8'));
    expect(lace(cut).min.y).toBeLessThan(0.12); // the lace shows below the dags, to the floor
    const g = heroFigure(DRESSED), vines = boxOf(coloured(g, '#c8a04f'));
    expect(vines.min.y).toBeLessThan(0.6); expect(vines.max.y).toBeGreaterThan(joint(g, 'chest').y); // from the hem up to the cloak's shoulders
    expect(boxOf(coloured(heroFigure({ ...DRESSED, cloak: undefined, brooch: undefined }), '#c8a04f')).max.y).toBeLessThan(joint(g, 'chest').y + 0.3); // the gown's own: no higher than the slit's top
  });
  it('laces tall boots to just below the knee, and the bracers down the forearm', () => {
    for (const sd of ['R', 'L']) {
      const g = heroFigure(DRESSED), low = heroFigure(GOWN), boot = (f: THREE.Object3D) => boxOf(under(f, 'knee' + sd).filter((m) => '#' + (m.material as THREE.MeshStandardMaterial).color.getHexString() === '#4a3020'));
      const knee = joint(g, 'knee' + sd).y;
      expect(boot(g).max.y, sd).toBeGreaterThan(boot(low).max.y + 0.15);
      expect(boot(g).max.y, sd).toBeLessThan(knee - 0.1);
      const laces = coloured(g, '#3a2413').filter((m) => under(g, 'knee' + sd).includes(m));
      expect(laces.length, sd).toBeGreaterThan(0); expect(boxOf(laces).max.y).toBeLessThan(knee);
      const thongs = coloured(g, '#3b2515').filter((m) => under(g, 'elbow' + sd).includes(m)), b = boxOf(thongs);
      expect(thongs.length, sd).toBeGreaterThan(0);
      expect(b.max.y).toBeLessThan(joint(g, 'elbow' + sd).y); expect(b.min.y).toBeGreaterThan(joint(g, 'wrist' + sd).y - 0.05);
    }
  });
  it('pins a brooch at each top corner of the gown\'s cloak', () => {
    const g = heroFigure(DRESSED), pins = coloured(g, '#c7a14e'), xs = pins.map((m) => boxOf([m]).getCenter(new THREE.Vector3()).x);
    expect(Math.min(...xs)).toBeLessThan(-0.2); expect(Math.max(...xs)).toBeGreaterThan(0.2);
    expect(boxOf(pins).min.y).toBeGreaterThan(joint(g, 'chest').y);
  });
  it('rolls the corset\'s top edge clean: level round the back, cut down under the bust, no step from one point of it to the next', () => {
    const g = heroFigure(DRESSED), chest = (g.userData.joints as Record<string, THREE.Object3D>).chest, shell = coloured(g, '#5b3a24').find((m) => m.userData.skin)!;
    const p = shell.geometry.attributes.position, top = Array.from({ length: 80 }, (_, j) => new THREE.Vector3().fromBufferAttribute(p, p.count - 80 + j)), ys = top.map((v) => v.y);
    expect(shell.parent).toBe(chest);
    for (let j = 0; j < 80; j++) expect(Math.abs(ys[j] - ys[(j + 1) % 80]), `point ${j}`).toBeLessThan(0.04);
    expect(Math.max(...ys) - ys[40], 'level behind').toBeLessThan(0.005);
    expect(Math.max(...ys) - Math.min(...ys), 'lower under the bust').toBeGreaterThan(0.05);
    const front = top.filter((v) => v.z > 0 && Math.abs(v.x) > 0.15 && Math.abs(v.x) < 0.35);
    expect(Math.max(...front.map((v) => v.y)), 'under each breast').toBeLessThan(Math.max(...ys) - 0.05);
  });
  it('lets the corseted skirt fall away from the corset\'s foot all the way round, the belt unbroken across the slit', () => {
    for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure(DRESSED, 'medium', st), gown = meshes(g, (m) => m.userData.garment === 'gown')[0], p = gown.geometry.attributes.position;
      // (the skirt's own way down: from its top row to its seventh, taken over every column)
      const at = (i: number, j: number) => new THREE.Vector3().fromBufferAttribute(p, i * 65 + j), down = new THREE.Vector3();
      for (let j = 0; j < 65; j++) down.add(at(6, j)).sub(at(0, j));
      down.normalize();
      for (let j = 0; j < 65; j++) for (let i = 1; i < 6; i++) expect(at(i, j).sub(at(i - 1, j)).dot(down), `${st}, row ${i}, column ${j}`).toBeGreaterThan(0.01);
      const belt = meshes(g, (m) => m.userData.cloth === 'gown' && m.geometry.attributes.position.count === 4 * 66)[0];
      expect(belt, 'the belt: one loop of 66 points a row').toBeDefined();
      const b = belt.geometry.attributes.position;
      for (let r = 0; r < 4; r++) expect(new THREE.Vector3().fromBufferAttribute(b, r * 66).distanceTo(new THREE.Vector3().fromBufferAttribute(b, r * 66 + 65)), `row ${r} closes`).toBeLessThan(1e-6);
    }
  }, 60000);
  it('cuts the dags unevenly: tongues of many lengths and widths, never one pattern repeated every few columns', () => {
    const g = heroFigure({ ...GOWN, dagged: true }), gown = meshes(g, (m) => m.userData.garment === 'gown')[0], p = gown.geometry.attributes.position;
    // how far each column's hem is cut: the cloth's length down its last three rows, short of the longest
    const at = (i: number, j: number) => new THREE.Vector3().fromBufferAttribute(p, i * 65 + j);
    const len = Array.from({ length: 65 }, (_, j) => at(41, j).distanceTo(at(42, j)) + at(42, j).distanceTo(at(43, j)) + at(43, j).distanceTo(at(44, j)));
    const cut = len.map((l) => Math.max(...len) - l);
    for (const period of [2, 3, 4, 5, 6, 8]) {
      let same = 0, n = 0; for (let j = 2; j + period < 63; j++, n++) if (Math.abs(cut[j] - cut[j + period]) < 0.01) same++;
      expect(same / n, `repeats every ${period} columns`).toBeLessThan(0.6);
    }
    expect(new Set(cut.map((c) => Math.round(c * 50))).size, 'depths').toBeGreaterThanOrEqual(6);
    // the notches between the tongues stand at uneven distances
    const notches: number[] = []; for (let j = 2; j < 63; j++) if (cut[j] > cut[j - 1] + 0.005 && cut[j] >= cut[j + 1]) notches.push(j);
    expect(new Set(notches.slice(1).map((j, k) => j - notches[k])).size, 'widths').toBeGreaterThanOrEqual(3);
  });
  it('keeps the lace on the floor, never under it, standing or laid out', () => {
    for (const st of STATES) expect(lowest(coloured(heroFigure(DRESSED, 'medium', st), '#efe3c8')), st).toBeGreaterThan(-0.001);
  }, 60000);
  it('seats each brooch on the cloak clear of the cloth and of the floor', () => {
    for (const recipe of [DRESSED, { ...DRESSED, shoulderCloak: true }]) for (const st of STATES) {
      const g = heroFigure(recipe, 'medium', st), discs = coloured(g, '#c7a14e').filter((m) => m.geometry.type === 'CylinderGeometry'), cloth = meshes(g, (m) => m.userData.garment === (recipe.shoulderCloak ? 'mantle' : 'cloak'))[0];
      expect(discs.length, st).toBe(2);
      const p = cloth.geometry.attributes.position, v = new THREE.Vector3();
      for (const d of discs) {
        expect(lowest([d]), `${st}: off the floor`).toBeGreaterThan(0);
        // no point of the cloth inside the disc: within its rim and between its two faces
        const inv = d.matrixWorld.clone().invert();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(cloth.matrixWorld).applyMatrix4(inv); expect(Math.hypot(v.x, v.z) < 0.07 && Math.abs(v.y) < 0.015, `${st}: cloth point ${i} in a brooch`).toBe(false); }
      }
    }
  }, 60000);
  it('wears the cloak on both shoulders when asked: a mantle open wide at the front, a brooch on each front corner facing forward, a cord between them', () => {
    const recipe = { ...DRESSED, shoulderCloak: true }, g = heroFigure(recipe), chest = (g.userData.joints as Record<string, THREE.Object3D>).chest, inv = chest.matrixWorld.clone().invert();
    const mantle = meshes(g, (m) => m.userData.garment === 'mantle')[0];
    expect(mantle).toBeDefined(); expect(meshes(heroFigure(DRESSED), (m) => m.userData.garment === 'mantle').length, 'not otherwise').toBe(0);
    const discs = coloured(g, '#c7a14e').filter((m) => m.geometry.type === 'CylinderGeometry');
    for (const d of discs) {
      const at = d.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), face = new THREE.Vector3(0, 1, 0).transformDirection(d.matrixWorld).transformDirection(inv);
      expect(at.z, 'in front of the shoulder').toBeGreaterThan(0); expect(Math.abs(at.x), 'out on the shoulder').toBeGreaterThan(0.25);
      expect(at.y, 'by the collarbone').toBeGreaterThan(1.6); expect(face.z, 'facing forward').toBeGreaterThan(0.3);
    }
    expect(Math.sign(discs[0].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).x)).not.toBe(Math.sign(discs[1].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).x));
    // the opening: no cloth of the mantle before the middle of the chest
    const p = mantle.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mantle.matrixWorld).applyMatrix4(inv); if (v.z > 0) expect(Math.abs(v.x), `point ${i}`).toBeGreaterThan(0.05); }
    const cords = (f: THREE.Object3D) => meshes(f, (m) => m.userData.cloth === 'mantle' && m.geometry.type === 'TubeGeometry');
    expect(cords(g).length, 'the cord').toBe(1); expect(cords(heroFigure(recipe, 'medium', 'dead')).length, 'none on a body laid out').toBe(0);
    const span = boxOf(cords(g)); expect(span.max.x - span.min.x, 'from one brooch to the other').toBeGreaterThan(0.5);
    for (const st of STATES) { const f = heroFigure(recipe, 'medium', st); expect(describeClips(findClips(f, recipe)), st).toBe(''); expect(describePokes(findPokes(f)), st).toBe(''); }
  }, 60000);
  it('hangs a gem on a fine chain of its own colour when the recipe names one: it lies on the chest, clean in every state', () => {
    const worn: HeroFigure = { ...DRESSED, pendant: '#9a6ad0', pendantChain: '#8a6a3c' };
    for (const st of STATES) {
      const g = heroFigure(worn, 'medium', st), chain = coloured(g, '#8a6a3c');
      expect(chain.length, st).toBe(1);
      expect(describeClips(findClips(g, worn)), st).toBe('');
    }
    // (the gem on its plain chain, and a figure with no pendant, are as they were: nothing in the chain's colour)
    expect(coloured(heroFigure({ ...DRESSED, pendant: '#9a6ad0' }), '#8a6a3c').length).toBe(0);
    expect(coloured(heroFigure({ ...DRESSED, pendantChain: '#8a6a3c' }), '#8a6a3c').length).toBe(0);
  });

  it('sets the rings of a bag hung from the corset\'s belt on the belt\'s lower edge, standing and in the fight', () => {
    const worn: HeroFigure = { ...DRESSED, satchel: '#5a3a20', satchelKit: { strap: 'belt' } }, dark = '#' + new THREE.Color('#5b3a24').lerp(new THREE.Color('#000000'), 0.32).getHexString();
    for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure(worn, 'medium', st), rings = meshes(g, (m) => m.userData.part === 'ring'), belt = coloured(g, dark).filter((m) => m.geometry.attributes.position.count === 66 * 4)[0];
      expect(rings.length, st).toBe(2); expect(belt, 'the belt').toBeDefined();
      const p = belt.geometry.attributes.position, v = new THREE.Vector3();
      for (const r of rings) {
        // (the ring lies on the leather: its middle within seven hundredths of a foot of the leather's nearest point; hung below the belt it stood a tenth off)
        const c = r.getWorldPosition(new THREE.Vector3()); let near = Infinity;
        for (let i = 0; i < p.count; i++) near = Math.min(near, v.fromBufferAttribute(p, i).applyMatrix4(belt.matrixWorld).distanceTo(c));
        expect(near, st).toBeLessThan(st === 'rest' ? 0.07 : 0.12); // (in the fight the cloth swings on under it)
      }
    }
  });

  it('keeps the head of the slit shut on a figure standing or fighting: the two edges of a dagged gown are one line down to where it opens', () => {
    for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure(DRESSED, 'medium', st), gown = meshes(g, (m) => m.userData.garment === 'gown')[0], p = gown.geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3();
      // (65 points to a row, the first and the last the slit's two edges: no gap between them in the top rows, where
      // a leg stepping through once held one edge before the other)
      const gap = (i: number) => a.fromBufferAttribute(p, i * 65).distanceTo(b.fromBufferAttribute(p, i * 65 + 64));
      for (let i = 0; i < 6; i++) expect(gap(i), `${st} row ${i}`).toBeLessThan(1e-4);
    }
  });

  it('leaves a figure without the fields as it was', () => {
    const base = heroFigure(GOWN), again = heroFigure({ ...GOWN, wreath: undefined, corset: undefined, fullSleeves: false, vines: undefined, dagged: false, bootLaces: undefined, bracerLaces: undefined, brooch: undefined });
    expect(verts(again)).toBe(verts(base)); expect(meshes(again).length).toBe(meshes(base).length);
  });
});
