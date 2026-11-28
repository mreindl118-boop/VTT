// The jointed hero figures (kit/heroes.ts) bend at the elbow and the knee as one limb, never as a doll's joint: at every
// bend from straight to 120 degrees the outside of the joint runs on round the bend without a step, a ball standing
// proud of the limb, or a pinch where the two halves meet. An elbow bends no further than the arm's bulk lets it
// (elbowLimit): asked past that, it stops there, so each frame is bent to its own limit and a slim arm, whose limit is past
// 120 degrees, all the way.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { elbowLimit, frameFor, heroFigure, type HeroFigure } from '../app/src/kit/heroes';

type Joint = 'elbowR' | 'elbowL' | 'kneeR' | 'kneeL';
/** The outer contour of a bent joint in its bend plane, as distances from the hinge of rays cast in from outside, from
 *  a little up the upper limb round the outside of the bend to a little down the lower limb. */
function contour(frame: 'masculine' | 'feminine', jn: Joint, deg: number, body?: HeroFigure['body']) {
  const th = deg * Math.PI / 180, elbow = jn.startsWith('elbow'), sd = jn.slice(-1), out = sd === 'R' ? 1 : -1;
  // (the thigh lifted, so that the foot is clear of the ground and the knee bends as far as asked)
  const pose = elbow ? { [jn]: -th, ['shoulder' + sd]: [0, 0, 0.35 * out] } : { [jn]: th, ['hip' + sd]: [-1.2, 0, 0.15 * out] };
  const g = heroFigure({ frame, body, battlePose: pose } as never, 'medium', 'battle'); g.updateMatrixWorld(true);
  const J: Record<string, THREE.Object3D> = {}; g.traverse((o) => { if (o.name && !J[o.name]) J[o.name] = o; });
  const mid = J[jn], root = mid.parent!;
  const meshes = [...root.children, ...mid.children].filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
  const hinge = mid.getWorldPosition(new THREE.Vector3()), rq = root.getWorldQuaternion(new THREE.Quaternion()), mq = mid.getWorldQuaternion(new THREE.Quaternion());
  const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(rq), loDir = new THREE.Vector3(0, -1, 0).applyQuaternion(mq), axis = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
  // the outside of the bend: behind the elbow, in front of the knee
  const outside = new THREE.Vector3(0, 0, elbow ? -1 : 1).applyQuaternion(rq), turn = Math.acos(Math.max(-1, Math.min(1, -upDir.dot(loDir)))), rc = new THREE.Raycaster();
  const r: number[] = [];
  // (the outside turns as far as the limb bends, from the upper limb round to the lower one; the rays half a step off
  // the hinge's own line, which runs exactly along the seam where the two halves' lofts meet)
  for (let a = -0.3325; a <= turn + 0.35 + 1e-9; a += 0.035) {
    const d = outside.clone().applyAxisAngle(axis, (elbow ? -1 : 1) * a).normalize();
    rc.set(hinge.clone().addScaledVector(d, 1.2), d.clone().negate()); rc.far = 1.2;
    const h = rc.intersectObjects(meshes, false)[0];
    r.push(h ? 1.2 - h.distance : 0);
  }
  const n = Math.round(0.35 / 0.035), ends = [...r.slice(0, n + 1), ...r.slice(r.length - n - 1)], inner = r.slice(n, r.length - n);
  return {
    bend: turn * 180 / Math.PI, r,
    step: Math.max(...r.slice(1).map((v, i) => Math.abs(v - r[i]))),
    bulge: Math.max(...inner) / Math.max(r[0], r[r.length - 1]),
    pinch: Math.min(...inner) / Math.min(...ends),
  };
}

describe('hero joints', () => {
  // (a slim arm, whose elbow bends past 120 degrees)
  const SLIM = { masculine: { arms: 0.66 }, feminine: { arms: 0.8 } } as const;
  for (const frame of ['masculine', 'feminine'] as const) for (const jn of ['elbowR', 'elbowL', 'kneeR', 'kneeL'] as const) for (const slim of jn.startsWith('elbow') ? [false, true] : [false]) {
    it(`${frame}${slim ? ' slim-armed' : ''} ${jn} bends smooth from straight to 120 degrees${jn.startsWith('elbow') ? ' or its limit' : ''}`, () => {
      const body = slim ? SLIM[frame] : undefined, cap = jn.startsWith('elbow') ? elbowLimit(frameFor({ frame, body })) * 180 / Math.PI : Infinity;
      if (slim) expect(cap, 'a slim arm bends past 120 degrees').toBeGreaterThan(120);
      for (const deg of [0, 20, 40, 60, 80, 100, 120, ...(cap < 120 ? [cap] : [])].sort((a, b) => a - b)) {
        const c = contour(frame, jn, deg, body), at = `${jn} at ${deg.toFixed(1)} degrees`, want = Math.min(deg, cap);
        expect(Math.abs(c.bend - want), `${at}: bent ${c.bend.toFixed(1)}`).toBeLessThan(1);
        // the outside is all limb: every ray in from outside meets it
        expect(c.r.every((v) => v > 0.05), `${at}: a gap in the outside of the joint`).toBe(true);
        // no step where the halves meet (a ball's rim, a cut end): neighbouring rays (2 degrees apart) within 0.009 ft
        expect(c.step, `${at}: a step in the outside of the joint`).toBeLessThan(0.009);
        // no ball standing proud of the limb round the bend, and no pinch in it
        expect(c.bulge, `${at}: the joint bulges past the limb`).toBeLessThan(0.95);
        expect(c.pinch, `${at}: the joint pinches in`).toBeGreaterThan(0.8);
      }
    }, 60000);
  }
});
