// The hero figures' poses out of a fight and the named poses (kit/heroes.ts), on generic figures in every frame they are
// shown in: standing at ease is never square (the weight on one leg, the hips and shoulders tilted against each other,
// the chest turned off the hips and the head turned and tilted further, soft elbows, no arm hanging as a post), the feet
// turn out and stay planted, and no part of a figure passes through another: neither where clipcheck looks nor into the
// closed body meshes it does not model (the torso's skin with the bust, a breastplate, a mail shirt).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, FEET_OUT, heroFigure, POSES, type HeroFigure, type HeroPose, type PoseName } from '../app/src/kit/heroes';
import { describeClips, findClips, type ClipHit } from '../app/src/kit/clipcheck';

const FRAMES: Record<string, HeroFigure> = {
  fem: { frame: 'feminine' }, masc: { frame: 'masculine' }, curvy: { frame: 'feminine', build: 'curvy' }, broad: { frame: 'masculine', build: 'broad' },
  'full bust': { frame: 'feminine', build: 'curvy', body: { bust: 1.6 } },
  plate: { frame: 'feminine', build: 'broad', armor: { kind: 'plate', color: '#3a3f46' } },
  'mail and cloak': { frame: 'masculine', armor: { kind: 'mail', color: '#8a8f96' }, cloak: '#4a3a2a' },
};
/** What the hands carry at ease (a mace is left out: where it hangs at the belt is the stowing code's to test). */
const GEAR: Record<string, HeroFigure> = { 'empty-handed': {}, sword: { weapon: 'sword' }, staff: { weapon: 'staff' }, book: { offhand: { kind: 'book' } }, shield: { weapon: 'sword', offhand: { kind: 'shield' } } };
const GOWN: HeroFigure = { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8' };
/** The named poses that are not a fighting stance or a body laid out. */
const NAMED: PoseName[] = ['ride', 'lunge', 'menace', 'cower', 'kneel', 'staff-raised'];

type Joints = Record<string, THREE.Object3D>;
const P = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const deg = (r: number) => (r * 180) / Math.PI;
function built(f: HeroFigure, state: 'rest' | 'battle' = 'rest') { const g = heroFigure(f, 'medium', state); g.updateMatrixWorld(true); return { g, J: g.userData.joints as Joints }; }
const yawOf = (o: THREE.Object3D) => { const v = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); return Math.atan2(v.x, v.z); };
const turn = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/** The tilt of the line from the right joint to the left one: positive when the left is the higher. */
const roll = (r: THREE.Vector3, l: THREE.Vector3) => Math.atan2(l.y - r.y, Math.hypot(l.x - r.x, l.z - r.z));
/** The head's sideways tilt about the way it faces. */
const tiltOf = (head: THREE.Object3D) => { const up = new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld), y = yawOf(head); return Math.asin(Math.max(-1, Math.min(1, up.x * Math.cos(y) - up.z * Math.sin(y)))); };
/** An arm: how far the upper arm hangs off the vertical, and how far the elbow bends. */
const armOf = (J: Joints, sd: string) => { const ua = P(J[`elbow${sd}`]).sub(P(J[`shoulder${sd}`])).normalize(), fa = P(J[`wrist${sd}`]).sub(P(J[`elbow${sd}`])).normalize(); return { hang: ua.angleTo(new THREE.Vector3(0, -1, 0)), bend: ua.angleTo(fa) }; };
const kneeOf = (J: Joints, sd: string) => P(J[`knee${sd}`]).sub(P(J[`hip${sd}`])).normalize().angleTo(P(J[`ankle${sd}`]).sub(P(J[`knee${sd}`])).normalize());
const soleOf = (J: Joints, sd: string) => new THREE.Box3().setFromObject(J[`ankle${sd}`]).min.y;
/** The arm a pose sets on the hip or the belt (the reach and the hand's seat there are the hand solver's, tested with it). */
const onBody = (p: HeroPose) => new Set([...(p.hipHand ?? []), ...(p.beltHand ?? [])]);
const ARM_PARTS = (sd: string) => [`hand${sd}`, `forearm${sd}`, `upperArm${sd}`, `gear${sd}`];

// ---- the closed body meshes clipcheck does not model ----
const meshesOf = (o: THREE.Object3D) => o.children.filter((c) => (c as THREE.Mesh).isMesh && !((c as THREE.Mesh).material as THREE.Material).transparent && !c.userData.garment && !c.userData.cloth) as THREE.Mesh[];
const sample = (ms: THREE.Mesh[], cap: number, keep: (p: THREE.Vector3) => boolean = () => true) => {
  const out: THREE.Vector3[] = [];
  for (const m of ms) { const a = m.geometry.getAttribute('position') as THREE.BufferAttribute, st = Math.max(1, Math.floor(a.count / cap)); for (let i = 0; i < a.count; i += st) { const p = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (keep(p)) out.push(p); } }
  return out;
};
/** A test for "inside this mesh": a point counts only when rays in three directions all cross it an odd number of times
 *  (an open shell, a flared hem say, lets one of them out). */
function insideOf(m: THREE.Mesh) {
  const g = m.geometry, pos = g.getAttribute('position') as THREE.BufferAttribute, idx = g.index, n = idx ? idx.count : pos.count, tri: number[] = [], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld); tri.push(v.x, v.y, v.z); }
  const box = new THREE.Box3().setFromBufferAttribute(new THREE.Float32BufferAttribute(tri, 3)), dirs = [new THREE.Vector3(0.577, 0.612, 0.54).normalize(), new THREE.Vector3(-0.62, 0.21, -0.75).normalize(), new THREE.Vector3(0.33, -0.86, 0.39).normalize()];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3(), a = new THREE.Vector3();
  const odd = (p: THREE.Vector3, d: THREE.Vector3) => {
    let hits = 0;
    for (let t = 0; t < tri.length; t += 9) {
      a.set(tri[t], tri[t + 1], tri[t + 2]); e1.set(tri[t + 3] - a.x, tri[t + 4] - a.y, tri[t + 5] - a.z); e2.set(tri[t + 6] - a.x, tri[t + 7] - a.y, tri[t + 8] - a.z);
      pv.crossVectors(d, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det; tv.subVectors(p, a); const u = tv.dot(pv) * inv; if (u < 0 || u > 1) continue;
      qv.crossVectors(tv, e1); const w = d.dot(qv) * inv; if (w < 0 || u + w > 1) continue;
      if (e2.dot(qv) * inv > 0) hits++;
    }
    return (hits & 1) === 1;
  };
  const verts: THREE.Vector3[] = []; for (let t = 0; t < tri.length; t += 3) verts.push(new THREE.Vector3(tri[t], tri[t + 1], tri[t + 2]));
  /** how deep a point lies inside (0 when outside), as its distance to the nearest vertex */
  return (p: THREE.Vector3) => { if (!box.containsPoint(p) || !dirs.every((d) => odd(p, d))) return 0; let best = Infinity; for (const q of verts) best = Math.min(best, q.distanceToSquared(p)); return Math.sqrt(best); };
}
/** The deepest point of an arm (hand, forearm, the lower upper arm) or of what the hand holds inside the torso's own
 *  meshes (the skin with the bust, a breastplate, a mail shirt) or the pelvis. */
function buried(J: Joints, sides: string[]) {
  const body = [...meshesOf(J.chest), ...meshesOf(J.hips)].map((m) => ({ m, inside: insideOf(m) })); let worst = { depth: 0, what: '' };
  for (const sd of sides) {
    const sh = J[`shoulder${sd}`], wr = P(J[`wrist${sd}`]);
    const parts: [string, THREE.Vector3[]][] = [[`hand${sd}`, sample(meshesOf(J[`wrist${sd}`]), 80)], [`forearm${sd}`, sample(meshesOf(J[`elbow${sd}`]), 200)],
      [`upperArm${sd}`, sample(meshesOf(sh), 200, (p) => sh.worldToLocal(p.clone()).y < -0.5)], [`gear${sd}`, sample(((): THREE.Mesh[] => { const r: THREE.Mesh[] = []; J[`hand${sd}`].traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) r.push(m); }); return r; })(), 200, (p) => p.distanceTo(wr) > 0.25)]];
    for (const [what, pts] of parts) for (const b of body) for (const p of pts) { const d = b.inside(p); if (d > worst.depth) worst = { depth: d, what: `${what} in ${b.m.geometry.type} ${b.m.uuid.slice(0, 4)}` }; }
  }
  return worst;
}

type Ease = { name: string; pose: HeroPose; f: HeroFigure; J: Joints; clips: ClipHit[] };
let ease: Ease[] | undefined;
/** Every at-ease variant on every frame with every kind of gear, and the gown's ease, built once. */
function allEase(): Ease[] {
  if (ease) return ease;
  ease = [];
  AT_EASE.forEach((pose, i) => {
    for (const [fn, fr] of Object.entries(FRAMES)) for (const [gn, gear] of Object.entries(GEAR)) {
      if (i === 2 && gear.offhand) continue; // (a hand carrying a shield or a book never takes the belt)
      const f: HeroFigure = { ...fr, ...gear, pose: { ...pose } }, { g, J } = built(f);
      ease!.push({ name: `at ease ${i}, ${fn}, ${gn}`, pose, f, J, clips: findClips(g, f) });
    }
  });
  for (const [gn, gear] of Object.entries({ 'empty-handed': {}, book: { offhand: { kind: 'book' } }, staff: { weapon: 'staff' }, cloak: { cloak: '#331122' } } as Record<string, HeroFigure>)) {
    const f: HeroFigure = { ...GOWN, ...gear }, { g, J } = built(f), pose = POSES.rest; // (a gown without a pose of its own takes the gown's ease)
    ease.push({ name: `gown, ${gn}`, pose, f, J, clips: findClips(g, f) });
  }
  return ease;
}

describe('hero poses at ease', () => {
  it('stand on one leg with the hips and shoulders tilted against each other, the blocks turned and the head tilted', () => {
    for (const e of allEase()) {
      const { J, name } = e, hips = roll(P(J.hipR), P(J.hipL)), shoulders = roll(P(J.shoulderR), P(J.shoulderL));
      expect(Math.abs(deg(hips)), `${name}: the hip line tilted`).toBeGreaterThan(4);
      expect(Math.abs(deg(shoulders)), `${name}: the shoulder line tilted`).toBeGreaterThan(2);
      expect(Math.sign(hips), `${name}: the shoulders tilted against the hips`).toBe(-Math.sign(shoulders));
      // the hip over the leg that takes the weight is the higher one, and that leg is the straighter
      const kR = kneeOf(J, 'R'), kL = kneeOf(J, 'L'), weight = kR < kL ? 'R' : 'L', free = weight === 'R' ? 'L' : 'R';
      expect(weight === 'R' ? hips < 0 : hips > 0, `${name}: the weight leg's hip up`).toBe(true);
      expect(deg(kneeOf(J, weight)), `${name}: the standing knee nearly straight`).toBeLessThan(8);
      if (e.f.skirt && e.f.underskirt) expect(deg(kneeOf(J, free)), `${name}: the free knee eased`).toBeGreaterThan(10); // (inside a gown's slit)
      else expect(deg(kneeOf(J, free)), `${name}: the free knee eased`).toBeGreaterThan(17);
      // the neck over the foot that takes the weight
      const n = P(J.neck);
      expect(Math.abs(n.x - P(J[`ankle${weight}`]).x), `${name}: over the standing foot`).toBeLessThan(Math.abs(n.x - P(J[`ankle${free}`]).x));
      // the chest turned off the hips, the head turned further off the chest, and tilted
      expect(Math.abs(deg(turn(yawOf(J.chest), yawOf(J.hips)))), `${name}: the chest turned off the hips`).toBeGreaterThan(8);
      expect(Math.abs(deg(turn(yawOf(J.head), yawOf(J.chest)))), `${name}: the head turned off the chest`).toBeGreaterThan(10);
      expect(Math.abs(deg(tiltOf(J.head))), `${name}: the head tilted`).toBeGreaterThan(4);
    }
    // the eyes are set in every variant (never left to stare straight ahead)
    for (const p of AT_EASE) expect(p.gaze).toBeDefined();
  }, 120000);

  it('soften every elbow, give the arms different jobs, and never hang an arm as a post', () => {
    for (const e of allEase()) {
      const hand = onBody(e.pose), free = ['R', 'L'].filter((sd) => !hand.has(sd as 'R' | 'L')), A = Object.fromEntries(['R', 'L'].map((sd) => [sd, armOf(e.J, sd)]));
      for (const sd of free) {
        expect(deg(A[sd].bend), `${e.name}: the ${sd} elbow soft`).toBeGreaterThan(15);
        expect(deg(A[sd].hang) >= 15 || deg(A[sd].bend) >= 25, `${e.name}: the ${sd} arm not a post`).toBe(true);
      }
      expect(Math.abs(deg(A.R.bend - A.L.bend)), `${e.name}: the elbows bent differently`).toBeGreaterThan(15);
    }
  }, 120000);

  it('turn the feet out and keep both on the floor', () => {
    for (const e of allEase()) {
      const { J, name } = e, yR = yawOf(J.ankleR), yL = yawOf(J.ankleL), hips = yawOf(J.hips);
      expect(deg(turn(yL, yR)), `${name}: the angle between the feet`).toBeGreaterThan(20);
      expect(deg(turn(yL, yR)), `${name}: the angle between the feet`).toBeLessThan(70);
      expect(-turn(yR, hips), `${name}: the right foot turned out`).toBeGreaterThan(FEET_OUT.ease[0] - 0.02);
      expect(turn(yL, hips), `${name}: the left foot turned out`).toBeGreaterThan(FEET_OUT.ease[0] - 0.02);
      expect(Math.max(soleOf(J, 'R'), soleOf(J, 'L')), `${name}: both feet down`).toBeLessThan(0.025);
    }
  }, 120000);

  it('keep every part clear of every other', () => {
    const bad: string[] = [];
    for (const e of allEase()) {
      const skip = new Set([...onBody(e.pose)].flatMap(ARM_PARTS)), hits = e.clips.filter((c) => !skip.has(c.part) && !skip.has(c.into));
      if (hits.length) bad.push(`${e.name}: ${describeClips(hits)}`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('keep the arms and what they carry out of the bust, a breastplate, a mail shirt and the hips', () => {
    const bad: string[] = [];
    for (const e of allEase()) {
      const hand = onBody(e.pose), w = buried(e.J, ['R', 'L'].filter((sd) => !hand.has(sd as 'R' | 'L')));
      if (w.depth > 0.04) bad.push(`${e.name}: ${w.what} ${w.depth.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  }, 180000);
});

describe('hero named poses', () => {
  const cases = () => {
    const out: { name: string; pose: PoseName; f: HeroFigure; state: 'rest' | 'battle' }[] = [];
    for (const pose of NAMED) for (const [fn, fr] of Object.entries(FRAMES)) {
      const gear: HeroFigure = pose === 'staff-raised' ? { weapon: 'staff', stow: false } : { weapon: 'sword' };
      out.push({ name: `${pose}, ${fn}, in a fight`, pose, f: { ...fr, ...gear, battlePose: pose }, state: 'battle' });
      if (pose !== 'ride') out.push({ name: `${pose}, ${fn}, out of a fight`, pose, f: { ...fr, ...gear, pose }, state: 'rest' });
    }
    return out;
  };

  it('keep every part clear of every other and out of the closed body meshes', () => {
    const bad: string[] = [];
    for (const c of cases()) {
      const { g, J } = built(c.f, c.state), hits = findClips(g, c.f), w = buried(J, ['R', 'L']);
      if (hits.length) bad.push(`${c.name}: ${describeClips(hits)}`);
      if (w.depth > 0.04) bad.push(`${c.name}: ${w.what} ${w.depth.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  }, 180000);

  it('are neither square nor mirrored', () => {
    for (const pose of NAMED) {
      const { J } = built({ frame: 'feminine', weapon: pose === 'staff-raised' ? 'staff' : 'sword', battlePose: pose }, 'battle');
      const twist = Math.max(Math.abs(turn(yawOf(J.chest), yawOf(J.hips))), Math.abs(turn(yawOf(J.head), yawOf(J.chest))), Math.abs(yawOf(J.hips)));
      expect(deg(twist), `${pose}: turned`).toBeGreaterThan(5);
      expect(Math.abs(deg(tiltOf(J.head))) + Math.abs(deg(roll(P(J.shoulderR), P(J.shoulderL)))), `${pose}: tilted`).toBeGreaterThan(3);
      const R = armOf(J, 'R'), L = armOf(J, 'L'), wy = Math.abs(P(J.wristR).y - P(J.wristL).y);
      expect(Math.abs(deg(R.bend - L.bend)) > 15 || Math.abs(deg(R.hang - L.hang)) > 15 || wy > 0.4, `${pose}: the arms doing different things`).toBe(true);
      expect(POSES[pose].gaze, `${pose}: the eyes set`).toBeDefined();
    }
    // a thrust arm is not locked straight
    const { J } = built({ frame: 'feminine', weapon: 'sword', battlePose: 'lunge' }, 'battle');
    expect(deg(armOf(J, 'R').bend)).toBeGreaterThan(12); expect(deg(armOf(J, 'R').bend)).toBeLessThan(30);
  }, 60000);

  it('plant both feet of a standing pose, the front foot toward the foe and the back one turned out', () => {
    for (const [pose, f] of [['lunge', { weapon: 'sword' }], ['menace', { weapon: 'sword' }], ['staff-raised', { weapon: 'staff' }], ['two-handed', { weapon: 'axe' }], ['shield', { weapon: 'mace', offhand: { kind: 'shield' } }]] as [PoseName, HeroFigure][]) {
      const { J } = built({ frame: 'feminine', ...f, battlePose: pose }, 'battle');
      expect(Math.max(soleOf(J, 'R'), soleOf(J, 'L')), `${pose}: both feet down`).toBeLessThan(0.025);
      const zR = P(J.ankleR).z, zL = P(J.ankleL).z, front = zL > zR ? 'L' : 'R', back = front === 'L' ? 'R' : 'L', out = (sd: string) => (sd === 'R' ? -1 : 1) * yawOf(J[`ankle${sd}`]);
      if (Math.abs(zL - zR) < 0.9) continue; // (feet nearly side by side turn out from the hips, as at ease)
      expect(deg(Math.abs(out(front))), `${pose}: the front foot toward the foe`).toBeLessThan(20);
      expect(deg(out(back)), `${pose}: the back foot turned out`).toBeGreaterThan(30);
      expect(deg(out(back)), `${pose}: the back foot turned out`).toBeLessThan(60);
    }
    // kneeling, the planted foot is on the floor with the knee
    const { J } = built({ frame: 'feminine', weapon: 'sword', battlePose: 'kneel' }, 'battle');
    expect(Math.min(soleOf(J, 'R'), soleOf(J, 'L'))).toBeLessThan(0.025); expect(Math.max(soleOf(J, 'R'), soleOf(J, 'L'))).toBeLessThan(0.06);
  }, 60000);
});
