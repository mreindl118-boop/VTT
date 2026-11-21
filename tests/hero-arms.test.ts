import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AT_EASE, POSES, WRIST, elbowLimit, frameFor, heroFigure, wristTurnOf, type HeroFigure, type HeroPose, type HeroStance, type PoseName } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';

// Arms, hands and what they hold, on plain figures of the shared rig (no character's recipe): every stance and rest clear
// of the body (the bust and a breastplate too, which the ring-stack clip check cannot see), hands set on the body without
// sinking into it, every wrist and elbow inside its range, a shield strapped on and an open book seated on the palm.
type Joints = Record<string, THREE.Object3D>;
const FRAMES: Record<string, HeroFigure> = { fem: { frame: 'feminine' }, masc: { frame: 'masculine' }, curvy: { build: 'curvy' }, broad: { build: 'broad', frame: 'masculine' } };
const PLATE = { armor: { kind: 'plate' as const, color: '#333333' } };
const KIT: Record<HeroStance, HeroFigure> = { 'two-handed': { weapon: 'axe' }, shield: { weapon: 'mace', offhand: { kind: 'shield' } }, cast: { offhand: { kind: 'book' } }, conjure: { offhand: { kind: 'book' } } };
const STANCES = Object.keys(KIT) as HeroStance[];
const SIDE = { R: -1, L: 1 } as const;
const built = (f: HeroFigure, state: 'rest' | 'battle' = 'battle') => { const g = heroFigure(f, 'medium', state); g.updateMatrixWorld(true); return { g, J: g.userData.joints as Joints }; };
const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const meshes = (o: THREE.Object3D) => o.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
const verts = (m: THREE.Mesh, every = 1) => { const a = m.geometry.attributes.position, out: THREE.Vector3[] = []; for (let i = 0; i < a.count; i += every) out.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); return out; };

/** The body's outer surface (the torso with the bust, the hips, and whatever is worn on them: plate, mail, a tunic, a
 *  belt; not the arms, the legs or the head) as a signed distance in feet, negative inside. Each piece is a shell of its
 *  own (the torso, the hips, a breastplate overlap), so a point is inside the body when it is inside any of them. */
function bodySurface(g: THREE.Object3D): (p: THREE.Vector3) => number {
  const J = g.userData.joints as Joints, away = new Set<THREE.Object3D>();
  for (const n of ['collarR', 'collarL', 'shoulderR', 'shoulderL', 'neck', 'hipR', 'hipL', 'beltR', 'beltL', 'back']) J[n]?.traverse((o) => away.add(o));
  type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3; m: THREE.Vector3; r: number };
  const shells: { box: THREE.Box3; tris: Tri[] }[] = [];
  J.hips.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh || away.has(m) || (m.material as THREE.Material).transparent) return;
    const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, idx = m.geometry.index, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const at = (i: number) => new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld), nAt = (i: number) => new THREE.Vector3().fromBufferAttribute(N, i).applyMatrix3(nm);
    const count = idx ? idx.count : P.count, tris: Tri[] = [];
    for (let k = 0; k + 2 < count; k += 3) {
      const [i, j, l] = idx ? [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)] : [k, k + 1, k + 2];
      const a = at(i), b = at(j), c = at(l), n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
      if (n.lengthSq() < 1e-14) continue; n.normalize();
      if (N && n.dot(nAt(i).add(nAt(j)).add(nAt(l))) < 0) n.negate();
      const mid = a.clone().add(b).add(c).divideScalar(3);
      tris.push({ a, b, c, n, m: mid, r: Math.max(mid.distanceTo(a), mid.distanceTo(b), mid.distanceTo(c)) });
    }
    if (tris.length) shells.push({ box: new THREE.Box3().setFromObject(m), tris });
  });
  const tri = new THREE.Triangle(), cp = new THREE.Vector3(), v = new THREE.Vector3();
  const toShell = (p: THREE.Vector3, tris: Tri[]) => {
    let best = Infinity, face = 0, sign = 1;
    for (const t of tris) {
      if (p.distanceTo(t.m) - t.r > best + 1e-9) continue;
      tri.set(t.a, t.b, t.c); tri.closestPointToPoint(p, cp); const d = cp.distanceTo(p), along = v.copy(p).sub(cp).dot(t.n);
      // (where the nearest point is an edge or a corner shared by several faces, the face most squarely toward it decides)
      if (d < best - 1e-9 || (d < best + 1e-9 && Math.abs(along) > face)) { best = d; face = Math.abs(along); sign = along < 0 ? -1 : 1; }
    }
    // inside only behind a face, squarely: past the open rim of a band or a hem a point is outside it
    return sign < 0 && face < 0.9 * best ? best : sign * best;
  };
  return (p) => {
    let sd = Infinity;
    for (const sh of shells) { if (!sh.box.containsPoint(p) && sh.box.distanceToPoint(p) >= sd) continue; sd = Math.min(sd, toShell(p, sh.tris)); }
    return sd;
  };
}
/** How far the forearms and hands (not what they hold) sink into the body: the deepest of their skins' points. */
function deepest(g: THREE.Object3D): { depth: number; where: string } {
  const J = g.userData.joints as Joints, sd = bodySurface(g), box = new THREE.Box3();
  J.hips.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !['collarR', 'collarL', 'hipR', 'hipL'].some((n) => { let q: THREE.Object3D | null = m; while (q && q !== J[n]) q = q.parent; return !!q; })) box.expandByObject(m); });
  let depth = 0, where = '';
  for (const sdn of ['R', 'L']) for (const [part, ms] of [['forearm', meshes(J[`elbow${sdn}`]).filter((m) => m.geometry.type !== 'SphereGeometry')], ['hand', meshes(J[`wrist${sdn}`])]] as const)
    for (const m of ms) for (const p of verts(m, 2)) { if (!box.containsPoint(p)) continue; const d = -sd(p); if (d > depth) { depth = d; where = `${part}${sdn}`; } }
  return { depth, where };
}

/** The fingertips (the far end of each finger's second joint) and the thumb's tip of a hand, in the world. */
function tips(wrist: THREE.Object3D): { fingers: THREE.Vector3[]; thumb: THREE.Vector3 } {
  const ms = meshes(wrist), len = (m: THREE.Mesh) => (m.geometry as THREE.CapsuleGeometry).parameters.height;
  return { fingers: [2, 4, 6, 8].map((i) => ms[i].localToWorld(new THREE.Vector3(0, -len(ms[i]) / 2, 0))), thumb: ms[9].localToWorld(new THREE.Vector3(0, len(ms[9]) / 2, 0)) };
}
const handSize = (wrist: THREE.Object3D) => ((meshes(wrist)[0].geometry as THREE.SphereGeometry).parameters.radius) / 0.105;
/** The point a closed hand holds a haft at, in the world (the same spot the rig's grips use). */
const gripOf = (wrist: THREE.Object3D) => { const u = handSize(wrist); return wrist.localToWorld(new THREE.Vector3(0, -0.15 * u, 0.085 * u)); };
const toLine = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return { d: p.distanceTo(a.clone().addScaledVector(ab, t)), t }; };

describe('hero arms', () => {
  it('measures a forearm sunk into the body, a full bust and a breastplate included (the measure the tests below rely on)', () => {
    const { g, J } = built({ frame: 'feminine', pose: { shoulderR: [-0.2, -0.9, -0.3], elbowR: -1.6 } }, 'rest'), sd = bodySurface(g);
    expect(sd(pos(J.chest).add(new THREE.Vector3(0, 0.3, 0)))).toBeLessThan(-0.3);              // the middle of the body is inside
    expect(sd(pos(J.chest).add(new THREE.Vector3(0, 0.3, 1.5)))).toBeGreaterThan(0.5);          // a foot and a half before it is not
    expect(deepest(g)).toMatchObject({ where: 'forearmR' }); expect(deepest(g).depth).toBeGreaterThan(0.1);  // a forearm swung into the belly
    // a forearm laid across the chest: through a full bust, and through a breastplate, where the bare chest is clear
    const across = { shoulderL: [-0.6, -1.1, -0.3] as [number, number, number], elbowL: -1.9 }, plain = deepest(built({ frame: 'feminine', pose: across }, 'rest').g);
    const full = deepest(built({ frame: 'feminine', body: { bust: 1.8 }, pose: across }, 'rest').g);
    expect(plain.depth).toBeLessThan(0.01); expect(full.depth).toBeGreaterThan(0.08); expect(full.where).toBe('forearmL');
    const pressed = { shoulderL: [-0.4, -0.9, -0.3] as [number, number, number], elbowL: -1.6 };
    expect(deepest(built({ frame: 'masculine', ...PLATE, pose: pressed }, 'rest').g).depth).toBeGreaterThan(deepest(built({ frame: 'masculine', pose: pressed }, 'rest').g).depth + 0.02);
  }, 30000);

  it('keeps every stance clear of the body on every frame, its gear and all', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const stance of STANCES) {
      const f = { ...fr, ...KIT[stance], stance }, { g } = built(f), hits = findClips(g, f);
      expect(hits.length ? describeClips(hits) : 'clean', `${fn} ${stance}`).toBe('clean');
    }
  }, 30000);

  it('keeps the forearms and hands off the bust, a breastplate and the belly in every stance', () => {
    const bodies: Record<string, HeroFigure> = { fem: FRAMES.fem, curvy: FRAMES.curvy, 'full bust': { build: 'curvy', body: { bust: 1.6 } }, 'fem plate': { ...FRAMES.fem, ...PLATE }, 'broad plate': { ...FRAMES.broad, ...PLATE } };
    for (const [fn, fr] of Object.entries(bodies)) for (const stance of STANCES) {
      const d = deepest(built({ ...fr, ...KIT[stance], stance }).g);
      expect(d.depth, `${fn} ${stance} ${d.where}`).toBeLessThan(0.02);
    }
  }, 60000);

  it('sets a hand on the hip or the belt touching the body, never sunk into it', () => {
    for (const [fn, fr] of Object.entries({ ...FRAMES, 'masc plate': { ...FRAMES.masc, ...PLATE }, 'full bust': { build: 'curvy' as const, body: { bust: 1.6 } } })) {
      // on the hip, the fist's knuckles; on the belt, the palm
      const hip = built({ ...fr, pose: { ...AT_EASE[1] } }, 'rest'), u = handSize(hip.J.wristR), sh = bodySurface(hip.g);
      const knuckles = hip.J.wristR.localToWorld(new THREE.Vector3(0, -0.03 - 0.235 * u, 0.05 * u));
      expect(sh(knuckles), `${fn} hip`).toBeGreaterThan(-0.01); expect(sh(knuckles), `${fn} hip`).toBeLessThan(0.07);
      expect(deepest(hip.g).depth, `${fn} hip`).toBeLessThan(0.02);
      const belt = built({ ...fr, pose: { ...AT_EASE[2] } }, 'rest'), v = handSize(belt.J.wristL), sb = bodySurface(belt.g);
      const palm = belt.J.wristL.localToWorld(new THREE.Vector3(0, -0.03 - 0.1 * v, 0.005 + 0.044 * v));
      expect(sb(palm), `${fn} belt`).toBeGreaterThan(-0.01); expect(sb(palm), `${fn} belt`).toBeLessThan(0.06);
      expect(deepest(belt.g).depth, `${fn} belt`).toBeLessThan(0.02);
      expect(findClips(hip.g, fr).concat(findClips(belt.g, fr)), fn).toEqual([]);
    }
  }, 60000);

  it('reaches the hip or the belt with either hand from a pose that leaves that arm hanging', () => {
    for (const [fn, fr] of Object.entries({ fem: FRAMES.fem, broad: FRAMES.broad, 'broad plate': { ...FRAMES.broad, ...PLATE } })) for (const sd of ['R', 'L'] as const) {
      const hip = built({ ...fr, pose: { hipHand: [sd], fist: [sd] } }, 'rest'), W = hip.J[`wrist${sd}`], u = handSize(W), sh = bodySurface(hip.g);
      const knuckles = W.localToWorld(new THREE.Vector3(0, -0.03 - 0.235 * u, 0.05 * u)), a = pos(hip.J[`shoulder${sd}`]), b = pos(hip.J[`elbow${sd}`]), w = pos(W);
      expect(sh(knuckles), `${fn} ${sd} hip`).toBeGreaterThan(-0.01); expect(sh(knuckles), `${fn} ${sd} hip`).toBeLessThan(0.07);   // the knuckles on the hip
      expect(b.clone().sub(a).angleTo(w.clone().sub(b)), `${fn} ${sd} hip: the elbow bent`).toBeGreaterThan(1.2);
      expect((b.x - w.x) * SIDE[sd], `${fn} ${sd} hip: the elbow out to the side`).toBeGreaterThan(0.3);
      expect(deepest(hip.g).depth, `${fn} ${sd} hip`).toBeLessThan(0.02);
      const belt = built({ ...fr, pose: { beltHand: [sd] } }, 'rest'), V = belt.J[`wrist${sd}`], v = handSize(V), sb = bodySurface(belt.g);
      const palm = V.localToWorld(new THREE.Vector3(0, -0.03 - 0.1 * v, 0.005 + 0.044 * v));
      expect(sb(palm), `${fn} ${sd} belt`).toBeGreaterThan(-0.01); expect(sb(palm), `${fn} ${sd} belt`).toBeLessThan(0.06);       // the palm on the belt
      expect(deepest(belt.g).depth, `${fn} ${sd} belt`).toBeLessThan(0.02);
      expect(findClips(hip.g, fr).concat(findClips(belt.g, fr)), `${fn} ${sd}`).toEqual([]);
    }
  }, 60000);

  it('keeps every wrist and every elbow inside its range, in a fight, at ease and in the named poses', () => {
    const cases: [string, HeroFigure, 'rest' | 'battle'][] = [];
    for (const [fn, fr] of Object.entries(FRAMES)) {
      for (const stance of STANCES) cases.push([`${fn} ${stance}`, { ...fr, ...KIT[stance], stance }, 'battle']);
      AT_EASE.forEach((p, i) => cases.push([`${fn} at ease ${i}`, { ...fr, weapon: 'mace', pose: { ...p } }, 'rest']));
      for (const name of Object.keys(POSES) as PoseName[]) if (!name.startsWith('dead')) cases.push([`${fn} ${name}`, { ...fr, weapon: 'sword', battlePose: name }, 'battle']);
    }
    for (const [name, f, state] of cases) {
      const { J } = built(f, state), cap = elbowLimit(frameFor(f));
      for (const sd of ['R', 'L'] as const) {
        const w = wristTurnOf(J[`wrist${sd}`].quaternion, SIDE[sd]), e = J[`elbow${sd}`].rotation.x;
        expect(w.twist, `${name} ${sd} twist`).toBeGreaterThanOrEqual(-WRIST.pron - 1e-6); expect(w.twist, `${name} ${sd} twist`).toBeLessThanOrEqual(WRIST.sup + 1e-6);
        expect(w.dev, `${name} ${sd} deviation`).toBeGreaterThanOrEqual(-WRIST.ulnar - 1e-6); expect(w.dev, `${name} ${sd} deviation`).toBeLessThanOrEqual(WRIST.radial + 1e-6);
        expect(w.bend, `${name} ${sd} bend`).toBeGreaterThanOrEqual(-WRIST.flex - 1e-6); expect(w.bend, `${name} ${sd} bend`).toBeLessThanOrEqual(WRIST.ext + 1e-6);
        expect(e, `${name} ${sd} elbow`).toBeGreaterThanOrEqual(-cap - 1e-6);
      }
    }
    // a heavily muscled arm bends less far than a slight one
    expect(elbowLimit(frameFor({ build: 'broad', frame: 'masculine' }))).toBeLessThan(elbowLimit(frameFor({ frame: 'feminine' })));
  }, 60000);

  it('cocks a weapon fist back about 35 degrees, never far from a slight turn toward the little finger', () => {
    const D = Math.PI / 180;
    for (const [fn, fr] of Object.entries(FRAMES)) for (const weapon of ['sword', 'axe', 'mace', 'spear', 'staff', 'torch'] as const) for (const stance of [undefined, 'two-handed', 'shield'] as const) {
      const f: HeroFigure = { ...fr, weapon, stance, ...(stance === 'shield' ? { offhand: { kind: 'shield' } } : {}) }, { J } = built(f), w = wristTurnOf(J.wristR.quaternion, SIDE.R), name = `${fn} ${weapon} ${stance ?? 'no stance'}`;
      expect(Math.abs(w.bend - 35 * D), name).toBeLessThan(1e-6);                                // cocked back, as a strong grip is
      expect(w.dev, name).toBeGreaterThanOrEqual(-27 * D - 1e-6); expect(w.dev, name).toBeLessThanOrEqual(13 * D + 1e-6); // 7 toward the little finger, give or take 20
    }
  }, 30000);

  it('holds a two-handed weapon high across the body: the right fist by the hip, the left before the shoulder, the head past it, clear of the face', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) {
      const { J } = built({ ...fr, ...KIT['two-handed'], stance: 'two-handed' }), s = J.neck.position.y / 2.24;
      const o = pos(J.handR), d = new THREE.Vector3(0, 1, 0).transformDirection(J.handR.matrixWorld), grip = gripOf(J.wristL), t = grip.clone().sub(o).dot(d);
      expect(grip.distanceTo(o.clone().addScaledVector(d, t)), fn).toBeLessThan(0.05);           // the left hand closed on the haft
      expect(t, fn).toBeGreaterThan(1.25); expect(t, fn).toBeLessThan(2.05);                      // a shoulder's width above the right
      expect(new THREE.Vector3(1, 0, 0).transformDirection(J.wristL.matrixWorld).dot(d), fn).toBeGreaterThan(0.9); // its thumb and index toward the head
      const hip = pos(J.beltR), wR = pos(J.wristR), wL = pos(J.wristL), shL = pos(J.shoulderL), head = pos(J.head);
      expect(wR.x, fn).toBeLessThan(-0.3); expect(Math.abs(wR.y - hip.y), fn).toBeLessThan(0.45);    // the right fist low, by the right hip
      expect(wL.x, fn).toBeGreaterThan(0.2); expect(wL.y, fn).toBeGreaterThan(shL.y - 0.8); expect(wL.z, fn).toBeGreaterThan(shL.z + 0.8); // the left high, before the left shoulder
      const axeHead = o.clone().addScaledVector(d, 3.75 * s);
      expect(axeHead.y, fn).toBeGreaterThan(shL.y + 0.5); expect(axeHead.x, fn).toBeGreaterThan(shL.x); // the head up past the left shoulder
      // seen from the front, the haft passes the face by more than half a foot, and nowhere comes near the head
      const face = J.head.localToWorld(new THREE.Vector3(0, 0.37 * s, 0.05 * s));
      for (let k = -1; k <= 4.2; k += 0.05) {
        const p = o.clone().addScaledVector(d, k * s);
        if (Math.abs(p.y - face.y) < 0.35) expect(Math.abs(p.x - face.x), `${fn} at ${k.toFixed(2)}`).toBeGreaterThan(0.5);
        expect(p.distanceTo(face), fn).toBeGreaterThan(0.6);
      }
      expect(head.y, fn).toBeGreaterThan(wL.y);
    }
  }, 30000);

  it('straps a shield on the forearm, the handle in the fist and the face clear of the arm', () => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const [how, state, pose] of [['in a fight', 'battle', undefined], ['at ease', 'rest', { ...AT_EASE[0] }]] as const) {
      const f: HeroFigure = { ...fr, ...KIT.shield, stance: 'shield', pose }, { J } = built(f, state), s = J.neck.position.y / 2.24, name = `${fn} ${how}`;
      const sg = J.handL.children.find((c) => (c as THREE.Group).isGroup)!, parts: THREE.Mesh[] = []; sg.traverse((c) => { if ((c as THREE.Mesh).isMesh) parts.push(c as THREE.Mesh); });
      const el = pos(J.elbowL), wr = pos(J.wristL), fore = wr.clone().sub(el).normalize();
      // the handle across the fist
      const bar = parts.find((m) => m.geometry.type === 'CylinderGeometry' && Math.abs((m.geometry as THREE.CylinderGeometry).parameters.radiusTop - 0.032 * s) < 1e-6)!;
      expect(pos(bar).distanceTo(gripOf(J.wristL)), name).toBeLessThan(0.05);
      expect(Math.abs(new THREE.Vector3(0, 1, 0).transformDirection(bar.matrixWorld).dot(fore)), name).toBeLessThan(0.35);
      // the strap round the forearm, the arm through it
      const strap = parts.find((m) => m.geometry.type === 'TorusGeometry' && Math.abs((m.geometry as THREE.TorusGeometry).parameters.tube - 0.028 * s) < 1e-6)!;
      const ring = toLine(pos(strap), el, wr);
      expect(ring.d, name).toBeLessThan(0.06); expect(ring.t, name).toBeGreaterThan(0.1); expect(ring.t, name).toBeLessThan(0.9);
      expect(Math.abs(new THREE.Vector3(0, 0, 1).transformDirection(strap.matrixWorld).dot(fore)), name).toBeGreaterThan(0.9);
      // the face before the arm: every point of the forearm and the hand behind its back
      const face = parts.find((m) => m.geometry.type === 'CylinderGeometry' && (m.geometry as THREE.CylinderGeometry).parameters.radiusTop === s)!, at = pos(face), n = new THREE.Vector3(0, 1, 0).transformDirection(face.matrixWorld);
      const out = n.dot(pos(J.wristL).sub(at)) < 0 ? n : n.negate();                                // (the face's outer side, away from the arm)
      for (const m of [...meshes(J.elbowL), ...meshes(J.wristL)]) for (const p of verts(m, 3)) expect(out.dot(p.clone().sub(at)), name).toBeLessThan(-0.07 * s);
      expect(out.dot(new THREE.Vector3(0, 0, 1)) > 0.2 || out.x > 0.2, `${name} faces out`).toBe(true);
    }
  }, 30000);

  it('seats an open book on the palm, the fingers under its cover and the thumb over the page', () => {
    const cases: [string, HeroFigure, 'rest' | 'battle'][] = [];
    for (const [fn, fr] of Object.entries(FRAMES)) for (const stance of ['cast', 'conjure'] as const) cases.push([`${fn} ${stance}`, { ...fr, ...KIT[stance], stance }, 'battle']);
    cases.push(['read at ease', { offhand: { kind: 'book' }, pose: { ...AT_EASE[0], book: 'open', shoulderL: [-0.75, -0.3, 0.15], elbowL: -1.2 } as HeroPose }, 'rest']);
    for (const [name, f, state] of cases) {
      const { J } = built(f, state), bk = J.handL.children.find((c) => (c as THREE.Group).isGroup)!, boxes = meshes(bk).filter((m) => m.geometry.type === 'BoxGeometry');
      // nothing of the hand inside the book
      for (const m of meshes(J.wristL)) for (const p of verts(m, 2)) for (const b of boxes) {
        const q = b.worldToLocal(p.clone()), { width, height, depth } = (b.geometry as THREE.BoxGeometry).parameters;
        expect(Math.abs(q.x) < width / 2 - 0.004 && Math.abs(q.y) < height / 2 - 0.004 && Math.abs(q.z) < depth / 2 - 0.004, `${name}: the hand through the book`).toBe(false);
      }
      const n = new THREE.Vector3(0, 0, 1).transformDirection(J.wristL.matrixWorld), rc = new THREE.Raycaster(), hit = (from: THREE.Vector3, dir: THREE.Vector3) => { rc.set(from, dir); return rc.intersectObjects(boxes, false)[0]?.distance ?? Infinity; };
      const { fingers, thumb } = tips(J.wristL), thumbR = (meshes(J.wristL)[9].geometry as THREE.CapsuleGeometry).parameters.radius;
      for (const p of fingers) expect(hit(p, n), `${name}: a fingertip under the cover`).toBeLessThan(0.08);   // (a finger's thickness and a hair from its middle)
      expect(hit(thumb, n.clone().negate()) - thumbR, `${name}: the thumb on the page`).toBeLessThan(0.012);   // (its underside, measured from its middle)
      expect(hit(thumb, n), `${name}: the thumb over the page, not under it`).toBe(Infinity);
    }
  }, 30000);

  it('lets an empty hand rest half open, each finger curled a little more than the one before', () => {
    const { J } = built({}, 'rest');
    for (const sd of ['R', 'L']) {
      const ms = meshes(J[`wrist${sd}`]), k1 = [1, 3, 5, 7].map((i) => ms[i].rotation.x), k2 = [2, 4, 6, 8].map((i) => ms[i].rotation.x);
      for (let i = 0; i < 4; i++) { expect(k1[i], sd).toBeGreaterThan(-0.8); expect(k1[i], sd).toBeLessThan(-0.15); expect(k2[i], sd).toBeLessThan(k1[i]); }
      for (let i = 1; i < 4; i++) { expect(k1[i], sd).toBeLessThan(k1[i - 1]); expect(k2[i], sd).toBeLessThan(k2[i - 1]); }
      // each finger a chain: its second joint starts where its first ends
      for (const i of [1, 3, 5, 7]) {
        const len = (m: THREE.Mesh) => (m.geometry as THREE.CapsuleGeometry).parameters.height;
        expect(ms[i].localToWorld(new THREE.Vector3(0, -len(ms[i]) / 2, 0)).distanceTo(ms[i + 1].localToWorld(new THREE.Vector3(0, len(ms[i + 1]) / 2, 0))), sd).toBeLessThan(0.005);
      }
      // the index next to the thumb, the little finger on the far side
      expect(pos(ms[9]).distanceTo(pos(ms[1])), sd).toBeLessThan(pos(ms[9]).distanceTo(pos(ms[7])));
    }
  });

  it('turns the forearm on its own channel, before the wrist bends', () => {
    const palm = (twistR: number) => { const { J } = built({ pose: { shoulderR: [-1.2, 0, 0.2], elbowR: -0.3, twistR } }, 'rest'); return { n: new THREE.Vector3(0, 0, 1).transformDirection(J.wristR.matrixWorld), arm: pos(J.wristR).sub(pos(J.elbowR)).normalize() }; };
    const a = palm(0), b = palm(-1.2);
    expect(a.n.angleTo(b.n)).toBeCloseTo(1.2, 2);                                                       // the palm turns by the channel's angle,
    expect(Math.abs(new THREE.Vector3().crossVectors(a.n, b.n).normalize().dot(a.arm))).toBeGreaterThan(0.99); // about the forearm,
    expect(a.arm.angleTo(b.arm)).toBeLessThan(1e-6);                                                    // which stays where it was;
    expect(b.n.x).toBeGreaterThan(a.n.x + 0.5);                                                         // negative turns the right palm in toward the body
  });

  it('carries what a hand holds at the side rather than resting that hand on the hip or the belt', () => {
    for (const [name, f, state, sd] of [['a staff, the hip', { weapon: 'staff', pose: { ...AT_EASE[1] } }, 'rest', 'R'], ['a drawn sword, the hip', { weapon: 'sword', pose: { ...AT_EASE[1] } }, 'battle', 'R'], ['a shield, the belt', { weapon: 'mace', offhand: { kind: 'shield' }, pose: { ...AT_EASE[2] } }, 'rest', 'L']] as const) {
      const { g, J } = built(f as HeroFigure, state);
      expect(J[`hand${sd}`].children.length, name).toBeGreaterThan(0);                              // still held
      expect(J[`elbow${sd}`].rotation.x, name).toBeGreaterThan(-0.5);                                // the arm hanging, not bent to the waist
      expect(findClips(g, f as HeroFigure), name).toEqual([]);
    }
  });
});
