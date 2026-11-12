// Clipping check for the jointed figures (kit/heroes.ts): does any part of a posed figure pass through another?
// The body is read as volumes from the same ring stacks the rig lofts its skin from (torso, pelvis, neck, upper arms,
// forearms, thighs, shins, each in its own joint's frame) plus the skull as an ellipsoid, and the moving parts (hands,
// forearms, upper arms below the shoulder, thighs below the hip, shins, feet, and whatever the hands hold) are sampled
// at their mesh vertices. A sample inside a volume it should never enter is a clip; its depth is how far inside it lies.
// Flesh pressed on flesh (thigh on thigh, calf on thigh, forearm on biceps, thigh on belly) gives a little before it
// counts: a quarter of the limb's thickness there; an upper arm resting on the ribs gives a tenth. Legs inside a gown's
// sheath are hidden, so they are not checked against each other. A limb made thicker after the build carries the factor
// in its joint's userData.girth. Pure geometry: no rendering, so tests can run it on every figure in every pose.
import * as THREE from 'three';
import { forearmRings, neckRings, pelvisRings, ringAt, scaleRings, shinRings, thighRings, torsoRings, upperArmRings, type Ring } from './anatomy';
import { frameFor, SIDE_X, type HeroFigure } from './heroes';

/** One part passing into another: `depth` is the deepest sample's distance inside (feet), `points` how many samples are
 *  inside, `at` the deepest sample (world). */
export interface ClipHit { part: string; into: string; depth: number; points: number; at: [number, number, number] }
export interface ClipOptions {
  /** Depth (feet, at the figure's own scale) a sample may sink before it counts: contact is not a clip. Default 0.04. */
  tolerance?: number;
  /** How far flesh may press into flesh, as a share of the limb's thickness where it presses. Default 0.25. */
  give?: number;
  /** Part or volume names to leave out (say `stowedR` while a scabbard's hang is being worked on). */
  ignore?: string[];
}

/** A body volume: how deep inside it a point lies (0 outside) and how thick the body is there (both in feet). */
type Volume = { name: string; inside: (p: THREE.Vector3) => [number, number] };
/** A moving part's samples, the volumes they may not enter, and those of them that are flesh it may press into (with
 *  how much of the full give each allows). */
type Part = { name: string; pts: THREE.Vector3[]; into: string[]; soft?: Record<string, number> };
const press = (names: string[], k = 1) => Object.fromEntries(names.map((n) => [n, k]));

/** How far inside a ring stack a point lies, and the stack's half-thickness there (ring units; [0, 0] outside). Rings
 *  run bottom to top in y. */
function ringDepth(rings: Ring[], p: THREE.Vector3): [number, number] {
  const lo = rings[0].y, hi = rings[rings.length - 1].y;
  if (p.y < lo || p.y > hi) return [0, 0];
  const r = ringAt(rings, p.y), n = r.n ?? 2, dx = p.x - (r.x ?? 0), dz = p.z - (r.z ?? 0), d = dz >= 0 ? r.f : r.b;
  const v = (Math.abs(dx) / r.w) ** n + (Math.abs(dz) / d) ** n;
  if (v >= 1) return [0, 0];
  // the distance in to the surface along the line from the axis, and to the stack's ends
  const t = Math.min(r.w, d);
  return [Math.min((1 - v ** (1 / n)) * t, p.y - lo, hi - p.y), t];
}

/** Points on a mesh in world space: its vertices (at most `cap`, evenly strided), and on a mesh of few faces (a box
 *  blade, a haft of one segment) points along every edge longer than `step` too, which its corners alone would miss. */
function samples(m: THREE.Mesh, step: number, cap = 260): THREE.Vector3[] {
  const geo = m.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined; if (!pos) return [];
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
  const out: THREE.Vector3[] = [], every = Math.max(1, Math.floor(pos.count / cap));
  for (let i = 0; i < pos.count; i += every) out.push(at(i));
  const idx = geo.index, tris = (idx ? idx.count : pos.count) / 3;
  if (tris <= 96) for (let t = 0; t < tris; t++) {
    const v = [0, 1, 2].map((k) => at(idx ? idx.getX(t * 3 + k) : t * 3 + k));
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3], n = Math.floor(a.distanceTo(b) / step); for (let j = 1; j < n; j++) out.push(a.clone().lerp(b, j / n)); }
  }
  return out;
}
const solid = (m: THREE.Object3D): m is THREE.Mesh => (m as THREE.Mesh).isMesh && !((m as THREE.Mesh).material as THREE.Material).transparent;
const direct = (o: THREE.Object3D | undefined) => (o ? o.children.filter(solid) : []);
const deep = (o: THREE.Object3D | undefined) => { const out: THREE.Mesh[] = []; o?.traverse((c) => { if (solid(c)) out.push(c); }); return out; };

/** Every clip in a posed figure built by heroFigure from `recipe` (rest, battle or dead), deepest first. */
export function findClips(figure: THREE.Object3D, recipe: HeroFigure, o: ClipOptions = {}): ClipHit[] {
  figure.updateMatrixWorld(true);
  const J: Record<string, THREE.Object3D> = {}; figure.traverse((c) => { if (c.name && !J[c.name]) J[c.name] = c; });
  const neck = J.neck, head = J.head; if (!J.chest || !neck || !head) return [];
  const s = neck.position.y / 2.24, fr = frameFor(recipe), tol = (o.tolerance ?? 0.04) * s, give = o.give ?? 0.25, skip = new Set(o.ignore ?? []);
  const local = (obj: THREE.Object3D, p: THREE.Vector3) => obj.worldToLocal(p.clone()).divideScalar(s);
  const pts = (m: THREE.Mesh, cap?: number) => samples(m, 0.1 * s, cap);
  // a limb thickened after the build (a fiend's arm) says by how much in its joint's userData.girth
  const girth = (rings: Ring[], obj: THREE.Object3D | undefined) => { const k = obj?.userData.girth as number | undefined; return k ? scaleRings(rings, k) : rings; };
  const stack = (name: string, obj: THREE.Object3D | undefined, rings: Ring[]): Volume[] => obj ? [{ name, inside: (p) => { const [d, t] = ringDepth(rings, local(obj, p)); return [d * s, t * s]; } }] : [];
  // the skull: an ellipsoid round the head's centre (0.37 above the head joint), a little inside the painted surface
  const skull = (p: THREE.Vector3): [number, number] => {
    const q = local(head, p), c = new THREE.Vector3(0, 0.35, 0.0), rx = 0.31, ry = 0.44, rz = q.z > 0 ? 0.36 : 0.39;
    const v = ((q.x - c.x) / rx) ** 2 + ((q.y - c.y) / ry) ** 2 + ((q.z - c.z) / rz) ** 2;
    return v < 1 ? [(1 - Math.sqrt(v)) * rx * s, rx * s] : [0, 0];
  };
  const vols: Volume[] = [
    ...stack('torso', J.chest, torsoRings(fr)), ...stack('pelvis', J.hips, pelvisRings(fr)), ...stack('neck', neck, neckRings(fr)),
    { name: 'head', inside: skull },
    ...stack('upperArmR', J.shoulderR, girth(upperArmRings(fr, SIDE_X.R), J.shoulderR)), ...stack('upperArmL', J.shoulderL, girth(upperArmRings(fr, SIDE_X.L), J.shoulderL)),
    ...stack('forearmR', J.elbowR, girth(forearmRings(fr), J.elbowR)), ...stack('forearmL', J.elbowL, girth(forearmRings(fr), J.elbowL)),
    ...stack('thighR', J.hipR, thighRings(fr)), ...stack('thighL', J.hipL, thighRings(fr)),
    ...stack('shinR', J.kneeR, shinRings(fr)), ...stack('shinL', J.kneeL, shinRings(fr)),
  ];
  // samples near a joint sit in both limbs by construction: keep only those farther than `r` (ring units) from it
  const away = (pts: THREE.Vector3[], joint: THREE.Object3D | undefined, r: number) => { if (!joint) return pts; const c = joint.getWorldPosition(new THREE.Vector3()); return pts.filter((p) => p.distanceTo(c) > r * s); };
  const below = (pts: THREE.Vector3[], joint: THREE.Object3D | undefined, y: number) => joint ? pts.filter((p) => local(joint, p).y < y) : pts;
  const parts: Part[] = [];
  const body = ['torso', 'pelvis', 'neck', 'head'];
  // legs in a gown's sheath are out of sight, so they may press on each other
  const sheathed = !!(recipe.skirt && recipe.underskirt);
  for (const sd of ['R', 'L'] as const) {
    const ot = sd === 'R' ? 'L' : 'R', otherArm = [`upperArm${ot}`, `forearm${ot}`], legs = ['thighR', 'thighL', 'shinR', 'shinL'], otherLeg = sheathed ? [] : [`thigh${ot}`, `shin${ot}`];
    const hand = direct(J['wrist' + sd]).flatMap((m) => pts(m)), fore = direct(J['elbow' + sd]).flatMap((m) => pts(m));
    // how far from the elbow, knee and wrist the overlap of the two limbs reaches grows with their thickness
    const armK = Math.max(1, fr.arm * ((J['elbow' + sd]?.userData.girth as number | undefined) ?? 1) / 1.2), legK = Math.max(1, fr.leg / 1.2), handK = J['wrist' + sd]?.scale.x ?? 1;
    const upper = below(direct(J['shoulder' + sd]).flatMap((m) => pts(m)), J['shoulder' + sd], -0.45);
    parts.push({ name: 'hand' + sd, pts: hand, into: [...body, ...legs, ...otherArm, `upperArm${sd}`] });
    parts.push({ name: 'hand' + sd, pts: away(hand, J['wrist' + sd], 0.16 * handK), into: [`forearm${sd}`] });
    parts.push({ name: 'forearm' + sd, pts: fore, into: [...body, ...legs, ...otherArm] });
    parts.push({ name: 'forearm' + sd, pts: away(fore, J['elbow' + sd], 0.3 * armK), into: [`upperArm${sd}`], soft: press([`upperArm${sd}`]) });
    parts.push({ name: 'upperArm' + sd, pts: upper, into: [...body, ...legs, ...otherArm], soft: press(['torso'], 0.4) });
    const thigh = below(direct(J['hip' + sd]).flatMap((m) => pts(m)), J['hip' + sd], -0.4), shin = direct(J['knee' + sd]).flatMap((m) => pts(m));
    const foot = [...direct(J['ankle' + sd]), ...deep(J['foot' + sd])].flatMap((m) => pts(m));
    parts.push({ name: 'thigh' + sd, pts: thigh, into: ['torso', 'head', 'neck', ...otherLeg], soft: press(['torso', ...otherLeg]) });
    parts.push({ name: 'shin' + sd, pts: shin, into: ['torso', 'pelvis', 'head', 'neck', ...otherLeg], soft: press(otherLeg) });
    parts.push({ name: 'shin' + sd, pts: away(shin, J['knee' + sd], 0.32 * legK), into: [`thigh${sd}`], soft: press([`thigh${sd}`]) });
    parts.push({ name: 'foot' + sd, pts: foot, into: ['torso', 'pelvis', 'head', 'neck', ...otherLeg] });
    // what the hand holds: never into the body or a limb, except where the hands close on it
    const held = J['hand' + sd]; let gear = deep(held).flatMap((m) => pts(m, 400));
    if (held) { gear = away(gear, held, 0.2); for (const w of ['wristR', 'wristL']) gear = away(gear, J[w], 0.22); }
    parts.push({ name: 'gear' + sd, pts: gear, into: [...body, ...legs, 'upperArmR', 'upperArmL', 'forearmR', 'forearmL'] });
  }
  // weapons put away: a scabbard at the belt, a weapon slung on the back, never through a limb or the head
  for (const [name, n] of [['stowedR', 'beltR'], ['stowedL', 'beltL'], ['stowedBack', 'back'], ['stowedBack', 'stowed']] as const) {
    const put = deep(J[n]).flatMap((m) => pts(m, 300)); if (put.length) parts.push({ name, pts: put, into: ['head', 'neck', 'upperArmR', 'upperArmL', 'forearmR', 'forearmL', 'thighR', 'thighL', 'shinR', 'shinL'] });
  }
  const hits = new Map<string, ClipHit>();
  for (const part of parts) {
    if (skip.has(part.name) || !part.pts.length) continue;
    for (const v of vols) {
      if (!part.into.includes(v.name) || skip.has(v.name)) continue;
      const soft = (part.soft?.[v.name] ?? 0) * give;
      for (const p of part.pts) {
        const [d, t] = v.inside(p); if (d <= tol + soft * t) continue;
        const key = part.name + '>' + v.name, h = hits.get(key);
        if (!h) hits.set(key, { part: part.name, into: v.name, depth: d, points: 1, at: [p.x, p.y, p.z] });
        else { h.points++; if (d > h.depth) { h.depth = d; h.at = [p.x, p.y, p.z]; } }
      }
    }
  }
  return [...hits.values()].sort((a, b) => b.depth - a.depth);
}

/** A one-line account of a figure's clips, for a test's failure message or a console. */
export const describeClips = (hits: ClipHit[]): string => hits.map((h) => `${h.part}→${h.into} ${h.depth.toFixed(2)}ft×${h.points}`).join(', ');
