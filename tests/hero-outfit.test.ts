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
    // (no little rings: a pendant's are built only for pendantShape 'rings'; rings on the head are the face's own ears)
    const head = new Set<THREE.Object3D>(); (g.userData.joints as Record<string, THREE.Object3D>).head.traverse((o) => head.add(o));
    expect(meshes(g).filter((m) => !head.has(m) && m.geometry.type === 'TorusGeometry' && (m.geometry as THREE.TorusGeometry).parameters.radius < 0.1).length).toBe(0);
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
    const rings = (o: HeroFigure) => meshes(build({ frame: 'feminine', pendant: '#c0c4cc', ...o })).filter((m) => m.geometry.type === 'TorusGeometry' && m.userData.part === 'pendant').length;
    expect(rings({ pendantShape: 'rings' })).toBe(2); expect(rings({})).toBe(0);
  }, 120000);

  // every edge of the meshes under `a` that passes through a face of a mesh in `bs`
  function crossings(a: THREE.Object3D, bs: M[]) {
    const rc = new THREE.Raycaster(), p = new THREE.Vector3(), q = new THREE.Vector3(), sides = bs.map((b) => (b.material as THREE.Material).side); let n = 0;
    for (const b of bs) (b.material as THREE.Material).side = THREE.DoubleSide;                                           // (materials are shared: put back below)
    for (const m of meshes(a)) {
      const pos = m.geometry.attributes.position as THREE.BufferAttribute, idx = m.geometry.index, cnt = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < cnt; t += 3) for (let e = 0; e < 3; e++) {
        p.fromBufferAttribute(pos, idx ? idx.getX(t + e) : t + e).applyMatrix4(m.matrixWorld); q.fromBufferAttribute(pos, idx ? idx.getX(t + (e + 1) % 3) : t + (e + 1) % 3).applyMatrix4(m.matrixWorld);
        const len = p.distanceTo(q); if (len < 1e-6) continue;
        rc.set(p, q.sub(p).normalize()); rc.near = 0; rc.far = len; n += rc.intersectObjects(bs, false).length;
      }
    }
    bs.forEach((b, i) => { (b.material as THREE.Material).side = sides[i]; });
    return n;
  }
  const SHIRT: HeroFigure = { ...MAIL, chainShirt: { under: '#202028' } };

  it('hangs a pendant of two rings clear of a chain shirt, in every state', () => {
    const f: HeroFigure = { ...SHIRT, pendant: '#c0c4cc', pendantShape: 'rings' };
    for (const st of STATES) {
      const g = build(f, st), J = g.userData.joints as Record<string, THREE.Object3D>, hung = meshes(g).filter((m) => m.userData.part === 'pendant');
      expect(hung.length, st).toBe(3);                                                                                    // a chain and two rings
      const worn = (J.chest.children as M[]).filter((m) => m.isMesh && !hung.includes(m) && !m.userData.garment);         // the chest and what lies on it
      for (const m of hung) expect(crossings(m, worn), st).toBe(0);
      const [a, b] = hung.filter((m) => m.geometry.type === 'TorusGeometry').map((m) => m.getWorldPosition(new THREE.Vector3()));
      expect(a.distanceTo(b)).toBeGreaterThan(0.05); expect(a.distanceTo(b)).toBeLessThan(0.15);                          // linked: each through the other
    }
  }, 120000);

  it('carries a flanged mace: seven thin flanges round a narrow head under a finial, on a round haft', () => {
    const g = build({ frame: 'masculine', weapon: 'mace' }, 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>;
    const head = meshes(J.handR).find((m) => m.name === 'maceHead')!, mace = head.parent!, inv = mace.matrixWorld.clone().invert(), v = new THREE.Vector3();
    const span = (m: M) => { const b = new THREE.Box3(), pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); return b; };
    const pieces = (mace.children as M[]).filter((m) => m.isMesh), hb = span(head);
    const flanges = pieces.find((m) => m.geometry.type === 'BufferGeometry' && span(m).min.y >= hb.min.y - 0.01 && span(m).max.y <= hb.max.y + 0.01)!;
    expect(flanges.geometry.attributes.position.count).toBe(7 * 18);                                                      // seven wedges of six faces
    const fb = span(flanges); expect(fb.max.x).toBeLessThan(0.25); expect(fb.max.x).toBeGreaterThan(0.15);                // the head a good deal narrower than a fist's ball and blocks
    expect(Math.max(...pieces.map((m) => span(m).max.y))).toBeGreaterThan(hb.max.y + 0.1);                                // a finial over it
    expect(pieces.every((m) => m.geometry.type !== 'BoxGeometry')).toBe(true);                                            // nothing of it a box
  });

  it('pins a tree brooch on the front of each shoulder, lying on the cloth, standing and fallen', () => {
    const f: HeroFigure = { ...SHIRT, cloak: '#2a3a6a', clasps: '#c0c4cc', claspMark: 'tree' };
    for (const st of STATES) {
      const g = build(f, st), J = g.userData.joints as Record<string, THREE.Object3D>, toChest = J.chest.matrixWorld.clone().invert();
      const pins: THREE.Object3D[] = []; g.traverse((o) => { if (o.userData.part === 'brooch') pins.push(o); });
      expect(pins.length).toBe(2);
      const at = pins.map((b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toChest)), mantle = garment(g, 'mantle'), rc = new THREE.Raycaster();
      expect(Math.abs(at[0].x - at[1].x), st).toBeGreaterThan(0.7);                                                       // one on each shoulder, not side by side at the throat
      expect(at[0].x * at[1].x).toBeLessThan(0);
      for (const b of pins) {                                                                                             // its back on the cloth: the cloth just behind its face
        const out = new THREE.Vector3(0, 0, 1).transformDirection(b.matrixWorld); rc.set(b.getWorldPosition(new THREE.Vector3()), out.negate()); rc.near = 0; rc.far = 0.2;
        const hit = rc.intersectObject(mantle, false)[0]; expect(hit, st).toBeDefined(); expect(hit.distance, st).toBeLessThan(0.08);
      }
    }
  }, 120000);

  it('runs a chain shirt\'s yoke into its hung mail with no shelf, and wears a baldric under a capelet clear of its collar', () => {
    const f: HeroFigure = { ...SHIRT, cloak: '#2a3a6a', satchel: '#5a3a20', satchelKit: { ...KIT, hip: 'L' } };
    for (const st of STATES) {
      const g = build(f, st), P = parts(g), mail = garment(g, 'mail');
      // the yoke's lower edge lies on the hung mail all the way round
      const lap = P.yoke as M, pos = lap.geometry.attributes.position, cols = 73, last = pos.count - cols, mp = mail.geometry.attributes.position, v = new THREE.Vector3(), w = new THREE.Vector3();
      if (st !== 'dead') for (let j = 0; j < cols; j += 6) {
        v.fromBufferAttribute(pos, last + j); let near = Infinity; for (let i = 0; i < 57 * 4; i++) near = Math.min(near, w.fromBufferAttribute(mp, i).distanceTo(v));
        expect(near, `${st} ${j}`).toBeLessThan(0.06);
      }
      expect(crossings(P.baldric, [garment(g, 'mantle')]), st).toBe(0);
    }
  }, 240000);

  it('rolls a sleeve below the elbow when asked: the sleeve over the bend, no bare skin between it and the roll', () => {
    const plain = build({ frame: 'masculine', sleeves: '#202028', rolled: true }), low = build({ frame: 'masculine', sleeves: '#202028', rolled: true, rolledLow: true });
    const cloth = (g: THREE.Object3D) => meshes((g.userData.joints as Record<string, THREE.Object3D>).elbowR).filter((m) => m.parent!.name === 'elbowR' && '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString() === '#202028');
    const top = (ms: M[]) => Math.max(...ms.map((m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.max.y; }));
    expect(top(cloth(plain))).toBeLessThan(-0.1);                                                                         // (as before: the cuff's turns start below the elbow, skin above them)
    expect(top(cloth(low))).toBeGreaterThan(-0.01);                                                                       // the sleeve from the elbow itself
    expect(verts(build({ frame: 'masculine', sleeves: '#202028', rolledLow: true }))).toBe(verts(build({ frame: 'masculine', sleeves: '#202028' }))); // (nothing without `rolled`)
  });

  it('hangs a satchel from the belt by two straps when asked, with no baldric, its metal a corset\'s buckles\'', () => {
    const gown: HeroFigure = { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8', corset: { color: '#5b3a24', buckle: '#b08a4a' }, satchel: '#5a3a20' };
    const metal = (g: THREE.Object3D) => { const cs = new Set<string>(); g.traverse((o) => { if (o.userData.part === 'ring' || o.userData.part === 'strapBuckle') meshes(o).forEach((m) => cs.add('#' + (m.material as THREE.MeshLambertMaterial).color.getHexString())); }); return [...cs]; };
    expect(metal(build({ ...gown, satchelKit: { hip: 'R', mark: 'moon' } }))).toEqual(['#b08a4a']);                       // a baldric's ring and buckle too
    for (const [name, rec] of Object.entries({ gown, 'chain shirt': { ...SHIRT, belt: { color: '#3a2a20', buckle: '#c0c4cc' }, satchel: '#5a3a20' } as HeroFigure })) for (const st of STATES) {
      const f: HeroFigure = { ...rec, satchelKit: { hip: 'R', strap: 'belt', mark: 'moon' } }, g = build(f, st), P = parts(g);
      expect(P.bag, `${name} ${st}`).toBeDefined(); expect(P.baldric).toBeUndefined(); expect(P.strapBuckle).toBeUndefined();
      const loops: THREE.Object3D[] = []; g.traverse((o) => { if (o.userData.part === 'ring') loops.push(o); });
      expect(loops.length).toBe(2);
      expect(metal(g)).toEqual([name === 'gown' ? '#b08a4a' : '#c0c4cc']);
      if (st !== 'dead') for (const l of loops) expect(box(l).min.y, `${name} ${st}`).toBeGreaterThan(box(P.bag).max.y - 0.15); // the straps up from the bag to the waist
      expect(faults(g, f), `${name} ${st}`).toBe('');
      expect(box(P.bag).min.y, `${name} ${st}`).toBeGreaterThan(lowest(g) - 0.01);
    }
  }, 240000);

  it('lays the satchel face up on a fallen body, nothing of it under the floor', () => {
    for (const [name, rec] of Object.entries(UNDER)) for (const deadPose of ['dead-swoon', 'dead-prone'] as const) {
      const f: HeroFigure = { ...rec, deadPose, satchel: '#5a3a20', satchelKit: { ...KIT, hip: 'L' } }, g = build(f, 'dead'), P = parts(g);
      const face = new THREE.Vector3(0, 0, 1).transformDirection(P.bag.matrixWorld);
      expect(face.y, `${name} ${deadPose}`).toBeGreaterThan(0.3);
      expect(box(P.bag).min.y, `${name} ${deadPose}`).toBeGreaterThan(lowest(g) - 0.01);
    }
  }, 240000);

  it('makes a belt\'s buckle no wider than the belt is deep', () => {
    const P = parts(build({ ...SHIRT, belt: { color: '#3a2a20', buckle: '#c0c4cc' } })), bk = P.buckle, inv = bk.matrixWorld.clone().invert(), b = new THREE.Box3(), v = new THREE.Vector3();
    for (const m of meshes(bk)) { const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); }
    expect(b.max.x - b.min.x).toBeLessThan(0.21); expect(b.max.x - b.min.x).toBeGreaterThan(0.15);
  });
});
