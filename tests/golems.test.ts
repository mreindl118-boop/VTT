// Golems with bodies of their own (kit/golems.ts): the Amber Temple's golem is an amber statue of a hawk-headed man (as
// the module describes it and its art shows) and its other one a cracked statue with a jackal's head, the tower's clay
// golems are moulded by hand, and the Abbot's flesh golem and Vasilka are sewn together from other people. Whether any
// of it clips is the NPC clip tests' business (tests/npc-clips-*.test.ts); this is what each is made of, and how a
// fallen one lies.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BESTIARY, figureFor } from '../app/src/bestiary';
import { clayBody } from '../app/src/kit/golems';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';
import { FOLK } from '../app/src/kit/menagerie';
import { posed } from '../app/src/kit/poses';
import { tokenLook } from '../app/src/render/tokenpiece';

type Joints = Record<string, THREE.Object3D>;
const build = (id: string, state: false | true | 'dead' = false, seed = 'a', hint = '') => { const g = figureFor(BESTIARY.find((e) => e.id === id)!, state, seed, hint); g.updateMatrixWorld(true); return g; };
const jointsOf = (g: THREE.Object3D) => g.userData.joints as Joints;
const scaleOf = (g: THREE.Object3D) => jointsOf(g).neck.position.y / 2.24;
const meshes = (o: THREE.Object3D, keep: (m: THREE.Mesh) => boolean = () => true) => { const out: THREE.Mesh[] = []; o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && keep(m)) out.push(m); }); return out; };
const colourOf = (m: THREE.Mesh) => '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString();
const own = (frame: THREE.Object3D, name: string) => frame.children.filter((c) => c.name === name) as THREE.Mesh[];
/** A mesh's box in its parent's frame (the joint it hangs on), in the figure's scale. */
const boxIn = (m: THREE.Mesh, s: number) => new THREE.Box3().setFromBufferAttribute(m.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(m.matrix).applyMatrix4(new THREE.Matrix4().makeScale(1 / s, 1 / s, 1 / s));
/** The lowest point of everything solid in a figure, point by point. */
function lowest(g: THREE.Object3D): number {
  let y = Infinity; const v = new THREE.Vector3();
  for (const m of meshes(g, (m) => !(m.material as THREE.Material).transparent)) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) y = Math.min(y, v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y); }
  return y;
}

describe('golems', () => {
  it('carves the amber golem as a hawk-headed statue: a hawk\'s head in a striped headcloth, no face of a man', () => {
    const g = build('amber-golem'), J = jointsOf(g), s = scaleOf(g), hawk = J.head.getObjectByName('hawk') as THREE.Mesh;
    expect(hawk).toBeTruthy();
    expect(meshes(J.head, (m) => !!(m.material as THREE.MeshLambertMaterial).map)).toEqual([]);   // (a man's painted face is gone)
    expect(boxIn(hawk, s).max.z).toBeGreaterThan(0.42);                                             // the beak juts out past where a man's face would be
    // carved in two tones: the headcloth's stripes and the face's markings darker than the amber
    const c = hawk.geometry.getAttribute('color'), lum = Array.from({ length: c.count }, (_, i) => c.getX(i) + c.getY(i) + c.getZ(i));
    expect(Math.min(...lum)).toBeLessThan(0.8 * Math.max(...lum));
  });

  it('hangs the amber golem\'s broad collar and the headcloth\'s lappets on its chest and guards its knees, shins and forearms', () => {
    const J = jointsOf(build('amber-golem'));
    expect(own(J.chest, 'broad-collar')).toHaveLength(1);
    expect(own(J.chest, 'lappet')).toHaveLength(2);
    for (const sd of ['R', 'L']) {
      expect(own(J['knee' + sd], 'greave'), sd).toHaveLength(1);
      expect(own(J['knee' + sd], 'knee-cop'), sd).toHaveLength(1);
      expect(own(J['elbow' + sd], 'vambrace'), sd).toHaveLength(1);
    }
  });

  it('carves the temple\'s other amber golem, which its encounter\'s name calls up, with a jackal\'s head and its amber cracked', () => {
    const g = build('amber-golem', false, 'a', 'jackal'), J = jointsOf(g), s = scaleOf(g), head = J.head.getObjectByName('jackal') as THREE.Mesh;
    expect(head).toBeTruthy();
    expect(J.head.getObjectByName('hawk')).toBeUndefined();
    const b = boxIn(head, s);
    expect(b.max.y).toBeGreaterThan(0.85);                                                           // the ears stand tall over the headcloth
    expect(b.max.z).toBeGreaterThan(0.45);                                                           // and the muzzle runs out long
    expect(own(J.chest, 'crack').length).toBeGreaterThan(0);                                         // cracked down the chest
    expect(own(J.shoulderR, 'crack').length).toBeGreaterThan(0);                                     // and down the arm
    // (the treasury's golem, under any other name, keeps its hawk's head and its amber whole)
    for (const hint of ['', 'Amber golem']) {
      const hawk = build('amber-golem', false, 'b', hint);
      expect(jointsOf(hawk).head.getObjectByName('hawk'), hint).toBeTruthy();
      expect(meshes(hawk, (m) => m.name === 'crack' || m.name === 'jackal'), hint).toEqual([]);
    }
  });

  it('keeps the carving\'s two tones on a token (the token\'s look leaves painted pieces as they are)', () => {
    for (const id of ['amber-golem', 'clay-golem-van-richtens-tower']) {
      const g = build(id), painted = meshes(g, (m) => !!m.geometry.getAttribute('color'));
      expect(painted.length, id).toBeGreaterThan(0);
      tokenLook(g, id, false);
      for (const m of painted) expect((m.material as THREE.MeshLambertMaterial).vertexColors, `${id} ${m.name}`).toBe(true);
    }
  });

  it('topples a destroyed amber golem stiff, as a statue falls: flat on its back, each leg straight at the knee', () => {
    for (const seed of 'abcd') {
      const g = build('amber-golem', 'dead', seed), J = jointsOf(g), w = (n: string) => J[n].getWorldPosition(new THREE.Vector3());
      const size = new THREE.Box3().setFromObject(g, true).getSize(new THREE.Vector3());
      expect(size.y, seed).toBeLessThan(0.3 * Math.max(size.x, size.z));                              // laid out flat, not heaped
      for (const sd of ['R', 'L']) {
        const thigh = w('knee' + sd).sub(w('hip' + sd)), shin = w('ankle' + sd).sub(w('knee' + sd));
        expect(thigh.angleTo(shin), `${seed} ${sd}`).toBeLessThan(0.15);
      }
    }
  });

  it('moulds the clay golem by hand: lumps all over that keep its surface closed, a crude clay head, no belt or neckband', () => {
    const g = build('clay-golem-van-richtens-tower'), J = jointsOf(g), s = scaleOf(g);
    expect(J.head.getObjectByName('clay')).toBeTruthy();
    expect(meshes(J.head, (m) => !!(m.material as THREE.MeshLambertMaterial).map)).toEqual([]);
    // (no thin band right round the waist or the root of the neck: the clay wears nothing)
    const bands = J.chest.children.filter((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return false; const b = boxIn(m, s); return b.max.y - b.min.y < 0.25 && b.max.x - b.min.x > 0.5 && (b.max.y < 0.6 || b.min.y > 2.0); });
    expect(bands).toEqual([]);
    // the lumps, laid over a plain body: everything moves, but a point the surface meets more than once moves as one
    const { extra: _e, size: _s, ...plain } = FOLK['clay-golem-van-richtens-tower'];
    const r = posed(plain) as unknown as HeroFigure, body = heroFigure(r, 'large', false), before = new Map<THREE.Mesh, Float32Array>();
    for (const m of meshes(body)) before.set(m, (m.geometry.getAttribute('position').array as Float32Array).slice());
    clayBody(body, r, { seed: 5 });
    let moved = 0, n = 0, gap = 0;
    for (const [m, a] of before) {
      const b = m.geometry.getAttribute('position').array as Float32Array; if (!m.parent || b.length !== a.length) continue;
      const first = new Map<string, number>();
      for (let i = 0; i < a.length; i += 3) {
        moved += Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1], b[i + 2] - a[i + 2]); n++;
        const k = `${a[i].toFixed(5)},${a[i + 1].toFixed(5)},${a[i + 2].toFixed(5)}`, j = first.get(k);
        if (j === undefined) first.set(k, i); else gap = Math.max(gap, Math.hypot(b[i] - b[j], b[i + 1] - b[j + 1], b[i + 2] - b[j + 2]));
      }
    }
    expect(moved / n).toBeGreaterThan(0.004 * scaleOf(body));
    expect(gap).toBeLessThan(1e-4 * scaleOf(body));
  });

  it('sews the flesh golem together from other people: seams at the neck and wrists, a forearm and a shin in other skins, iron staples', () => {
    const g = build('flesh-golem-the-abbots'), J = jointsOf(g), s = scaleOf(g);
    expect(own(J.neck, 'seam').length).toBeGreaterThan(0);
    const span = (frame: THREE.Object3D) => Math.max(...own(frame, 'seam').map((m) => { const b = boxIn(m, s); return b.max.y - b.min.y; }));
    expect(span(J.elbowR)).toBeGreaterThan(0.4);                                                     // the wrist's seam and the graft's, far apart
    expect(span(J.elbowL)).toBeLessThan(0.15);                                                       // the wrist's alone
    expect(own(J.kneeL, 'seam').length).toBeGreaterThan(0);                                          // the grafted shin's
    expect(own(J.kneeR, 'seam')).toEqual([]);
    expect(meshes(J.elbowR).some((m) => colourOf(m) === '#8a7660')).toBe(true);                      // the right forearm came from someone else
    expect(meshes(J.elbowL).some((m) => colourOf(m) === '#8a7660')).toBe(false);
    expect(meshes(J.kneeL).some((m) => colourOf(m) === '#b4a88c')).toBe(true);                       // and the left shin
    expect(meshes(g, (m) => m.name === 'seam' && colourOf(m) === '#5c5c62').length).toBeGreaterThan(0);   // bolted with iron
  });

  it('dresses Vasilka in a red gown and sews her finely: seams at the neck, shoulders and wrists, finer than the brute\'s, no iron', () => {
    const g = build('vasilka'), J = jointsOf(g), s = scaleOf(g);
    expect(meshes(g, (m) => m.userData.garment === 'gown').map(colourOf)).toContain('#7e1622');
    for (const n of ['neck', 'shoulderR', 'shoulderL', 'elbowR', 'elbowL']) expect(own(J[n], 'seam').length, n).toBeGreaterThan(0);
    const brute = build('flesh-golem-the-abbots'), height = (m: THREE.Mesh, k: number) => { const b = boxIn(m, k); return b.max.y - b.min.y; };
    expect(height(own(J.neck, 'seam')[0], s)).toBeLessThan(0.6 * height(own(jointsOf(brute).neck, 'seam')[0], scaleOf(brute)));
    expect(meshes(g, (m) => m.name === 'seam').length).toBe(5);                                      // one thread at each, nothing else
  });

  it('sets a fallen body down on what was put on it after it fell (amber, clay, a cultist\'s tatters): resting on the floor, not floating', { timeout: 60000 }, () => {
    for (const [id, hint] of [['amber-golem', ''], ['amber-golem', 'jackal'], ['clay-golem-van-richtens-tower', ''], ['ghoul', 'cult']]) for (const seed of 'abcd') {
      expect(Math.abs(lowest(build(id, 'dead', seed, hint))), `${id} ${seed}`).toBeLessThan(0.005);
    }
  });
});
