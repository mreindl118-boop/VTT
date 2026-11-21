// The finer outfit pieces of the hero figures (kit/heroes.ts), on generic stand-in recipes: a chain shirt (mail cut to
// the hips), a belt worn over the cloth, a satchel on its baldric (either hip, either mark, with what it holds) that
// hangs outside whatever is worn under it in every state, a cloak's laurel embroidery and tree brooches, a shield's
// banded and riveted face, and a pendant of two rings. A recipe that sets none of them builds none of them.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, type HeroFigure } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { describePokes, findPokes } from '../app/src/kit/clothcheck';

type M = THREE.Mesh;
const STATES = ['rest', 'battle', 'dead'] as const;
const build = (f: HeroFigure, st: (typeof STATES)[number] = 'rest') => { const g = heroFigure(f, 'medium', st); g.updateMatrixWorld(true); return g; };
/** The pieces of a figure the rig names (`userData.part`): a belt, its buckle, a bag, its baldric, ring and buckle. */
function parts(g: THREE.Object3D) { const out: Record<string, THREE.Object3D> = {}; g.traverse((o) => { if (o.userData.part) out[o.userData.part as string] = o; }); return out; }
const meshes = (g: THREE.Object3D) => { const out: M[] = []; g.traverse((o) => { if ((o as M).isMesh) out.push(o as M); }); return out; };
const verts = (g: THREE.Object3D) => meshes(g).reduce((n, m) => n + m.geometry.attributes.position.count, 0);
const garment = (g: THREE.Object3D, name: string) => meshes(g).find((m) => m.userData.garment === name)!;
const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
/** The lowest point of the figure without the named pieces (the body and the cloth on it). */
function lowest(g: THREE.Object3D) {
  const named = new Set<THREE.Object3D>(); g.traverse((o) => { if (o.userData.part) o.traverse((c) => named.add(c)); });
  return Math.min(...meshes(g).filter((m) => !named.has(m)).map((m) => box(m).min.y));
}
/** Clips and pokes of a figure, the bag read as gear against the cloth under it in every state. */
function faults(g: THREE.Object3D, f: HeroFigure) {
  const bag = parts(g).bag; if (bag) bag.userData.stowed = true;
  const c = findClips(g, f), p = findPokes(g, { plates: true });
  return [c.length ? describeClips(c) : '', p.length ? describePokes(p) : ''].filter(Boolean).join(' | ');
}

const MAIL: HeroFigure = { frame: 'masculine', armor: { kind: 'mail', color: '#6a6e75', trim: '#9aa0a8' } };
const KIT: NonNullable<HeroFigure['satchelKit']> = { mark: 'leaf', markColor: '#b0b4a8', rolls: 2, vials: ['#3050c0', '#b07028'], sprig: '#8a78c8' };
/** What a satchel is worn over: a chain shirt under a cloak, a tunic, a gown, a skirt, coat tails. */
const UNDER: Record<string, HeroFigure> = {
  'chain shirt and cloak': { ...MAIL, chainShirt: { under: '#202028' }, cloak: '#2a3a6a', belt: { color: '#3a2a20', buckle: '#c0c4cc' } },
  tunic: { frame: 'feminine', belt: { color: '#3a2a20' } },
  gown: { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8' },
  skirt: { frame: 'feminine', skirt: '#6a4a2a', belt: { color: '#2a2a2a', buckle: '#c9a64a' } },
  'coat with tails': { frame: 'masculine', coat: { tails: '#3a2a4a', lapel: '#c9a64a' } },
};

describe('hero outfit pieces', () => {
  it('builds none of them on a recipe that sets none', () => {
    const g = build({ ...MAIL, cloak: '#2a3a6a', clasps: '#d8c070', satchel: '#5a3a20', pendant: '#c0c0c0', buckle: '#c0c0c0', offhand: { kind: 'shield', mark: '#dddddd' } });
    expect(Object.keys(parts(g))).toEqual([]);
    expect(meshes(g).filter((m) => m.geometry.type === 'TorusGeometry' && (m.geometry as THREE.TorusGeometry).parameters.radius === 0.06).length).toBe(0);
  }, 60000);

  it('cuts a chain shirt to the hips, where plain mail hangs to the knee, and shows the shirt under it at the neck', () => {
    const long = build(MAIL), short = build({ ...MAIL, chainShirt: { under: '#202028' } });
    const knee = (g: THREE.Object3D) => (g.userData.joints as Record<string, THREE.Object3D>).kneeR.getWorldPosition(new THREE.Vector3()).y;
    const hip = (g: THREE.Object3D) => (g.userData.joints as Record<string, THREE.Object3D>).hipR.getWorldPosition(new THREE.Vector3()).y;
    const lb = box(garment(long, 'mail')), sb = box(garment(short, 'mail')), hi = sb.min.y;
    expect(hi).toBeGreaterThan(lb.min.y + 0.03);
    expect(hi).toBeLessThan(hip(short)); expect(hi).toBeGreaterThan(knee(short) + 0.5);                                    // below the hips, well above the knee
    expect(meshes(short).some((m) => '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString() === '#202028')).toBe(true);
    for (const st of STATES) { const f = { ...MAIL, chainShirt: {} }; expect(faults(build(f, st), f), st).toBe(''); }
  }, 120000);

  it('wears a belt over the cloth at the waist, its buckle in front', () => {
    const f: HeroFigure = { ...MAIL, chainShirt: {}, belt: { color: '#3a2a20', buckle: '#c0c4cc' }, buckle: '#c0c4cc' };
    for (const st of ['rest', 'battle'] as const) {
      const g = build(f, st), P = parts(g), J = g.userData.joints as Record<string, THREE.Object3D>;
      const b = box(P.belt), mail = box(garment(g, 'mail')), chest = J.chest.getWorldPosition(new THREE.Vector3());
      expect(b.min.y).toBeGreaterThan(mail.min.y); expect(b.max.y).toBeLessThan(mail.max.y);                              // round the mail, between its hem and its top
      expect(b.max.x - b.min.x).toBeGreaterThan((mail.max.x - mail.min.x) * 0.5);
      const front = new THREE.Vector3(0, 0, 1).transformDirection(J.chest.matrixWorld);
      expect(box(P.buckle).getCenter(new THREE.Vector3()).sub(chest).dot(front)).toBeGreaterThan(0.2);                    // the buckle in front
      expect(faults(g, f), st).toBe('');
    }
    expect(parts(build({ ...MAIL, buckle: '#c0c4cc' })).belt).toBeUndefined();
  }, 120000);

  it('hangs a satchel on either hip from a baldric over the far shoulder, with its mark and what it holds', () => {
    for (const hip of ['L', 'R'] as const) for (const mark of ['leaf', 'moon'] as const) {
      const f: HeroFigure = { ...MAIL, chainShirt: {}, satchel: '#5a3a20', satchelKit: { ...KIT, hip, mark } };
      const g = build(f), P = parts(g), J = g.userData.joints as Record<string, THREE.Object3D>, side = hip === 'L' ? 1 : -1;
      for (const k of ['bag', 'baldric', 'ring', 'strapBuckle']) expect(P[k], `${hip} ${mark} ${k}`).toBeDefined();
      const bag = box(P.bag), c = bag.getCenter(new THREE.Vector3()), st = box(P.baldric);
      expect(c.x * side).toBeGreaterThan(0.15);                                                                            // on its hip
      expect(c.y).toBeLessThan(J.shoulderR.getWorldPosition(new THREE.Vector3()).y - 1); expect(bag.min.y).toBeGreaterThan(J.kneeR.getWorldPosition(new THREE.Vector3()).y);
      expect(st.max.y).toBeGreaterThan(J[side > 0 ? 'shoulderR' : 'shoulderL'].getWorldPosition(new THREE.Vector3()).y - 0.1); // over the far shoulder
      expect(st.min.y).toBeLessThan(bag.max.y + 0.4);                                                                      // down to the bag
      expect(faults(g, f), `${hip} ${mark}`).toBe('');
    }
    // what it holds is built: more rolls and vials, more in the bag
    const base: HeroFigure = { ...MAIL, satchel: '#5a3a20', satchelKit: {} };
    const n = (k: NonNullable<HeroFigure['satchelKit']>) => meshes(parts(build({ ...base, satchelKit: k })).bag).length;
    expect(n({ rolls: 3 })).toBeGreaterThan(n({})); expect(n({ vials: ['#3050c0', '#b07028'] })).toBeGreaterThan(n({ vials: ['#3050c0'] }));
    expect(n({ herbs: '#5a7a3a' })).toBeGreaterThan(n({})); expect(n({ sprig: '#8a78c8' })).toBeGreaterThan(n({})); expect(n({ mark: 'moon' })).toBeGreaterThan(n({}));
  }, 240000);

  it('keeps the satchel and the belt outside whatever is worn under them, standing, fighting and fallen', () => {
    for (const [name, rec] of Object.entries(UNDER)) for (const hip of ['L', 'R'] as const) for (const st of STATES) {
      const f: HeroFigure = { ...rec, satchel: '#5a3a20', satchelKit: { ...KIT, hip } }, g = build(f, st), P = parts(g);
      expect(P.bag, `${name} ${hip} ${st}`).toBeDefined();
      expect(faults(g, f), `${name} ${hip} ${st}`).toBe('');
      const floor = lowest(g) - 0.01;                                                                                      // nothing under what the figure lies on
      expect(box(P.bag).min.y, `${name} ${hip} ${st}`).toBeGreaterThan(floor); expect(box(P.baldric).min.y, `${name} ${hip} ${st}`).toBeGreaterThan(floor);
    }
  }, 600000);

  it('embroiders a cloak with laurel and clasps it with tree brooches, the figure still clean', () => {
    const plain: HeroFigure = { ...MAIL, cloak: '#2a3a6a', clasps: '#c0c4cc' }, f: HeroFigure = { ...plain, cloakLaurel: '#c0c4cc', claspMark: 'tree' };
    expect(verts(build(f))).toBeGreaterThan(verts(build(plain)) + 500);
    expect(verts(build({ ...plain, claspMark: 'tree' }))).toBeGreaterThan(verts(build(plain)));
    for (const st of STATES) expect(faults(build(f, st), f), st).toBe('');
  }, 120000);

  it('gives a shield its band, its rivets and its wreath, and a pendant its two rings', () => {
    const sh = (o: HeroFigure) => build({ frame: 'masculine', offhand: { kind: 'shield', color: '#1a2850', rim: '#50545a', mark: '#d0d4da' }, ...o });
    const count = (o: HeroFigure) => meshes(sh(o)).length;
    expect(count({ shieldFace: { rivets: 20 } }) - count({ shieldFace: { rivets: 8 } })).toBe(12);
    expect(count({ shieldFace: { rivets: 8, band: '#2a4490' } }) - count({ shieldFace: { rivets: 8 } })).toBe(1);
    expect(verts(sh({ shieldFace: { wreath: true } }))).not.toBe(verts(sh({ shieldFace: {} })));
    const f: HeroFigure = { frame: 'masculine', weapon: 'mace', offhand: { kind: 'shield', mark: '#d0d4da' }, shieldFace: { band: '#2a4490', wreath: true } };
    for (const st of ['rest', 'dead'] as const) expect(faults(build(f, st), f), st).toBe('');
    const rings = (o: HeroFigure) => meshes(build({ frame: 'feminine', pendant: '#c0c4cc', ...o })).filter((m) => m.geometry.type === 'TorusGeometry' && Math.abs((m.geometry as THREE.TorusGeometry).parameters.radius - 0.06) < 1e-9).length;
    expect(rings({ pendantShape: 'rings' })).toBe(2); expect(rings({})).toBe(0);
  }, 120000);
});
