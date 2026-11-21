// A gown's finer dress on the hero figures (kit/heroes.ts): a wreath, a leather corset with its belt, full sleeves, vine
// embroidery, a dagged hem over lace, laced boots, laced bracers and cloak brooches. Each is its own recipe field; a
// generic figure wearing them all is read in every state against the clip check (kit/clipcheck.ts) and the cloth check
// (kit/clothcheck.ts), and each part is found on the figure where it belongs.
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
  it('pins a brooch at each front corner of the gown\'s cloak', () => {
    const g = heroFigure(DRESSED), pins = coloured(g, '#c7a14e'), xs = pins.map((m) => boxOf([m]).getCenter(new THREE.Vector3()).x);
    expect(Math.min(...xs)).toBeLessThan(-0.2); expect(Math.max(...xs)).toBeGreaterThan(0.2);
    expect(boxOf(pins).min.y).toBeGreaterThan(joint(g, 'chest').y);
  });
  it('leaves a figure without the fields as it was', () => {
    const base = heroFigure(GOWN), again = heroFigure({ ...GOWN, wreath: undefined, corset: undefined, fullSleeves: false, vines: undefined, dagged: false, bootLaces: undefined, bracerLaces: undefined, brooch: undefined });
    expect(verts(again)).toBe(verts(base)); expect(meshes(again).length).toBe(meshes(base).length);
  });
});
