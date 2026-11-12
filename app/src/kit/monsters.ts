// Monsters that are not people or four-legged beasts: wings and the things that fly on them, spiders, dragons, blights,
// oozes, and the haunted furniture of the module. Original low-poly geometry, palette materials.
// Every builder returns a group facing +z with its origin on the floor under its middle, and names its joints
// (userData.joints) where it has them. Parts that other figures wear (wings, horns, tails) are exported on their own.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { beast, BEASTS, type BeastSpec, type BeastPose, type BeastPoseName } from './beasts';
import { weapon } from './weapons';

type M = THREE.Mesh;
const soft = (c: string, double = false): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: double ? '#020302' : '#030303' }); m.userData.smooth = true; if (double) m.side = THREE.DoubleSide; return m; };
const hard = (c: string): THREE.MeshLambertMaterial => mat(c);
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const at = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => { m.position.set(x, y, z); return m; };
const grp = (name?: string): THREE.Group => { const g = new THREE.Group(); if (name) g.name = name; return g; };
const ball = (r: number, c: string, w = 12, h = 9): M => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), soft(c));
const cone = (r: number, h: number, c: string, seg = 6): M => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), soft(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 8): M => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), soft(c));
const hash = (i: number, s = 0): number => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const UP = V(0, 1, 0);
/** A tapered limb from a to b. */
function bone(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, c: string, seg = 7): M {
  const m = cyl(r1, r0, a.distanceTo(b), c, seg); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); return m;
}
/** A flat skin through points (a wing's membrane, a rug): a triangle fan from the first point. */
function fan(pts: THREE.Vector3[], c: string): M {
  const v: number[] = []; for (let i = 1; i < pts.length - 1; i++) for (const q of [pts[0], pts[i], pts[i + 1]]) v.push(q.x, q.y, q.z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, soft(c, true));
}
/** A see-through or self-lit part. */
function lit(m: M, c: string, opacity = 0.8, glow = 0.9): M {
  const n = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: glow, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
  n.userData = { keepLook: true, smooth: true }; m.material = n; m.userData.keepLook = true; return m;
}
/** Make a whole figure ghostly: every part see-through and faintly lit. */
export function spectral<T extends THREE.Object3D>(g: T, c?: string, opacity = 0.5): T {
  g.traverse((o) => { const m = o as M; if (!m.isMesh) return; const src = m.material as THREE.MeshLambertMaterial; lit(m, c ?? '#' + src.color.getHexString(), opacity, 0.35); });
  return g;
}
function ground<T extends THREE.Object3D>(g: T, lift = 0): THREE.Group { g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g), out = grp(); out.add(g); g.position.y += -b.min.y + lift; out.userData.joints = g.userData.joints; return out; }

// ------------------------------------------------------------------------------------------------- wings, horns, tails
export type WingKind = 'bat' | 'feather';
/** One wing, rooted at its shoulder and reaching out along +x (mirror it for the other side). `spread` runs from folded
 *  (0) to full stretch (1); `lift` raises the wing (radians at the shoulder). Joints: the shoulder group and its elbow. */
export function wing(kind: WingKind, span: number, c: string, o: { spread?: number; lift?: number; membrane?: string; tips?: string } = {}): THREE.Group {
  const sp = o.spread ?? 1, g = grp('wing'); g.rotation.z = o.lift ?? 0.25;
  const upper = span * 0.34, fore = span * 0.36, hand = span * 0.42, r = span * 0.022;
  const elbowA = (1 - sp) * 1.9, e = V(upper * Math.cos(0.35), upper * Math.sin(0.35), 0);
  g.add(bone(V(0, 0, 0), e, r * 1.5, r * 1.1, c));
  const elbow = grp('wingElbow'); elbow.position.copy(e); elbow.rotation.z = -elbowA - 0.35; g.add(elbow);
  const w = V(fore, 0, 0); elbow.add(bone(V(0, 0, 0), w, r * 1.1, r * 0.8, c), at(ball(r * 1.3, c, 8, 6), 0, 0, 0));
  if (kind === 'bat') {
    const mem = o.membrane ?? tone(c, '#5a2a30', 0.35), tips: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) { const a = -0.15 - i * (0.42 * sp + 0.12), len = hand * (1 - i * 0.1), t = V(fore + Math.cos(a) * len, Math.sin(a) * len, 0); tips.push(t); elbow.add(bone(w, t, r * 0.55, r * 0.2, c, 5)); }
    const claw = cone(r * 0.7, r * 4, o.tips ?? '#e8e0cc', 5); claw.rotation.z = -0.4; elbow.add(at(claw, fore, r * 2.5, 0));
    const inner = V(-upper * 0.75, -upper * 0.95, 0);                                                    // where the membrane meets the body, in the elbow's frame
    const scallop = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 0.5).add(V(-0.02 * span, 0.05 * span, 0).applyAxisAngle(V(0, 0, 1), Math.atan2(b.y - a.y, b.x - a.x)));
    const rim: THREE.Vector3[] = [w]; for (let i = 0; i < tips.length; i++) { rim.push(tips[i]); rim.push(scallop(tips[i], i < tips.length - 1 ? tips[i + 1] : inner)); } rim.push(inner);
    elbow.add(fan([V(0, 0, 0), ...rim], mem));
    g.add(fan([V(0, 0, 0), e, e.clone().add(inner.clone().applyAxisAngle(V(0, 0, 1), elbow.rotation.z)), V(0, -upper * 0.9, 0)], mem));
  } else {
    const dark = tone(c, '#000000', 0.25), feather = (len: number, wd: number, col: string) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(wd, -len * 0.5, 0, -len); s.quadraticCurveTo(-wd * 0.6, -len * 0.5, 0, 0); return new THREE.Mesh(new THREE.ShapeGeometry(s, 4), soft(col, true)); };
    for (let i = 0; i < 9; i++) { const u = i / 8, f = feather(hand * (0.85 + 0.5 * u), span * 0.045, i % 2 ? c : dark); f.rotation.z = Math.PI / 2 - 0.2 - u * (1.25 * sp + 0.15); elbow.add(at(f, fore * (0.55 + 0.45 * u), 0, 0.004 * i)); }
    for (let i = 0; i < 7; i++) { const u = i / 6, f = feather(hand * 0.75, span * 0.05, i % 2 ? dark : c); f.rotation.z = -0.15 * sp + 0.1; elbow.add(at(f, fore * u * 0.6, 0, -0.004 * i)); const f2 = feather(hand * 0.62, span * 0.05, c); f2.rotation.z = -elbow.rotation.z * 0.5; g.add(at(f2, e.x * (0.15 + 0.8 * u), e.y * (0.15 + 0.8 * u), -0.01)); }
    for (let i = 0; i < 6; i++) { const u = i / 5, cv = feather(hand * 0.3, span * 0.04, tone(c, '#ffffff', 0.12)); cv.rotation.z = 0.1; elbow.add(at(cv, fore * u, r, 0.02)); }
  }
  g.userData.joints = { wing: g, wingElbow: elbow };
  return g;
}
/** A pair of wings on a mount (a back, a bird's shoulders): the left reaches +x. */
export function wings(kind: WingKind, span: number, c: string, o: Parameters<typeof wing>[3] = {}): THREE.Group {
  const g = grp('wings'), l = wing(kind, span, c, o), r = wing(kind, span, c, o); r.scale.x = -1; g.add(l, r); g.userData.joints = { wingL: l, wingR: r }; return g;
}
/** A curved horn rising from its root. */
export function horn(len: number, r: number, c: string, curl = 0.6): M {
  const pts: THREE.Vector3[] = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(V(0, Math.sin(u * curl * 2) * len / (curl * 2), -(1 - Math.cos(u * curl * 2)) * len / (curl * 2))); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, r, 6);
  const m = new THREE.Mesh(geo, soft(c)); const tip = cone(r, r * 3, c, 6); tip.position.copy(pts[6]); tip.rotation.x = -curl * 2; m.add(tip); return m;
}
/** A tapering tail through points. */
export function tailOf(pts: THREE.Vector3[], r0: number, c: string, tip?: 'spade' | 'spike'): THREE.Group {
  const g = grp('tail'), curve = new THREE.CatmullRomCurve3(pts), n = 14;
  for (let i = 0; i < n; i++) g.add(bone(curve.getPoint(i / n), curve.getPoint((i + 1) / n), r0 * (1 - 0.85 * i / n), r0 * (1 - 0.85 * (i + 1) / n), c));
  const end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 2]).normalize();
  if (tip) { const t = cone(r0 * (tip === 'spade' ? 0.9 : 0.35), r0 * 2.6, c, tip === 'spade' ? 4 : 5); t.scale.x = tip === 'spade' ? 0.35 : 1; t.position.copy(end).addScaledVector(dir, r0 * 1.2); t.quaternion.setFromUnitVectors(UP, dir); g.add(t); }
  return g;
}

// ----------------------------------------------------------------------------------------------------------- flyers
export interface FlyerSpec { kind: 'bat' | 'bird'; body: number; span: number; coat: string; under?: string; beak?: string; eyes?: string; ears?: boolean }
export type FlyerPose = 'glide' | 'flap' | 'dive' | 'perch';
/** A bat or a bird, wings posed. `hover` is how high it flies above the floor (feet). */
export function flyer(s: FlyerSpec, pose: FlyerPose = 'flap', hover = 0): THREE.Group {
  const g = grp(), b = s.body, under = s.under ?? tone(s.coat, '#ffffff', 0.1), perch = pose === 'perch';
  const tilt = perch ? -1.1 : pose === 'dive' ? 0.6 : -0.1; const body = grp('body'); body.rotation.x = tilt; g.add(body);
  const torso = ball(b * 0.5, s.coat, 12, 9); torso.scale.set(0.8, 0.8, 1.5); body.add(torso);
  const chest = ball(b * 0.36, under, 10, 8); chest.scale.set(0.85, 0.7, 1.1); body.add(at(chest, 0, -b * 0.12, b * 0.28));
  const head = grp('head'); head.position.set(0, b * 0.18, b * 0.72); head.rotation.x = -tilt * 0.7; body.add(head);
  head.add(ball(b * 0.3, s.coat, 10, 8));
  for (const sx of [-1, 1]) head.add(at(lit(ball(b * 0.05, s.eyes ?? '#17141a', 6, 4), s.eyes ?? '#17141a', 1, s.eyes ? 0.9 : 0), sx * b * 0.17, b * 0.08, b * 0.22));
  if (s.kind === 'bird') {
    const bk = cone(b * 0.11, b * 0.5, s.beak ?? '#2a2420', 5); bk.rotation.x = Math.PI / 2 + 0.15; bk.scale.x = 0.7; head.add(at(bk, 0, -b * 0.03, b * 0.46));
    for (let i = -2; i <= 2; i++) { const f = cone(b * 0.12, b * 1.0, i % 2 ? s.coat : tone(s.coat, '#000000', 0.25), 4); f.scale.z = 0.2; f.rotation.set(Math.PI / 2 + 0.1, 0, i * 0.16); body.add(at(f, i * b * 0.09, -b * 0.02, -b * 1.1)); }
    for (const sx of [-1, 1]) { const leg = grp(); leg.position.set(sx * b * 0.18, -b * 0.3, -b * 0.1); leg.rotation.x = perch ? 1.0 : 0.9 - tilt; body.add(leg); leg.add(bone(V(0, 0, 0), V(0, -b * 0.45, 0), b * 0.045, b * 0.03, s.beak ?? '#2a2420', 5)); for (let i = -1; i <= 1; i++) { const t = cone(b * 0.03, b * 0.26, s.beak ?? '#2a2420', 4); t.rotation.set(1.9, 0, i * 0.5); leg.add(at(t, i * b * 0.06, -b * 0.47, b * 0.1)); } }
  } else {
    for (const sx of [-1, 1]) { const e = cone(b * 0.13, b * 0.42, s.coat, 4); e.scale.z = 0.4; e.rotation.z = -sx * 0.25; head.add(at(e, sx * b * 0.17, b * 0.38, 0)); }
    head.add(at(ball(b * 0.1, under, 6, 5), 0, -b * 0.06, b * 0.27)); for (const sx of [-1, 1]) { const f = cone(b * 0.02, b * 0.1, '#f2ece0', 4); f.rotation.x = Math.PI; head.add(at(f, sx * b * 0.05, -b * 0.17, b * 0.28)); }
  }
  const up = pose === 'flap' ? 0.7 : pose === 'dive' ? 1.0 : pose === 'perch' ? -0.9 : 0.12, spread = perch ? 0.12 : pose === 'dive' ? 0.55 : 1;
  const w = wings(s.kind === 'bat' ? 'bat' : 'feather', s.span / 2, s.coat, { spread, lift: up }); w.rotation.x = Math.PI / 2; w.position.set(0, b * 0.18, b * 0.3);
  for (const k of w.children) k.position.x = (k.scale.x < 0 ? -1 : 1) * b * 0.28; body.add(w);
  g.userData.joints = { body, head, ...(w.userData.joints as object) };
  return ground(g, hover);
}
export const FLYERS: Record<string, FlyerSpec> = {
  bat: { kind: 'bat', body: 0.55, span: 2.4, coat: '#2a2226', under: '#4a3a3a', ears: true },
  raven: { kind: 'bird', body: 0.7, span: 3.2, coat: '#17161c', under: '#22202a', beak: '#2a2a30', eyes: '#c8c0b0' },
  roc: { kind: 'bird', body: 9, span: 44, coat: '#4a3a2a', under: '#c8b890', beak: '#c8a040', eyes: '#e0b030' },
};
/** A swarm: many small flyers or crawlers in a loose cloud over its space. */
export function swarmOf(kind: 'bats' | 'ravens' | 'rats' | 'insects', count = 9, radius = 2.2): THREE.Group {
  const g = grp();
  for (let i = 0; i < count; i++) {
    const a = i * 2.399, r = radius * Math.sqrt((i + 0.5) / count), x = Math.cos(a) * r, z = Math.sin(a) * r; let one: THREE.Object3D;
    if (kind === 'bats' || kind === 'ravens') { one = flyer(FLYERS[kind === 'bats' ? 'bat' : 'raven'], (['flap', 'glide', 'dive'] as const)[i % 3], 1.2 + 3.4 * hash(i, 3)); }
    else if (kind === 'rats') { one = beast({ ...BEASTS['black-cat'], len: 0.55, height: 0.34, chest: 0.13, loin: 0.13, width: 0.12, neck: 0.12, skull: 0.18, skullW: 0.09, muzzle: 0.14, muzzleD: 0.045, leg: 0.03, ears: 'round', tailLen: 0.7, coat: i % 3 ? '#4a4038' : '#2a2420', eyes: '#c8202a', glow: false }, i % 2 ? 'stand' : 'walk'); }
    else { const b = grp(); const body = ball(0.09, i % 2 ? '#2a2a1a' : '#4a3a1a', 6, 5); body.scale.set(0.8, 0.7, 1.6); b.add(body); for (const sx of [-1, 1]) { const w = ball(0.1, '#c8d0d8', 6, 4); lit(w, '#c8d0d8', 0.45, 0.1); w.scale.set(1.3, 0.1, 0.6); b.add(at(w, sx * 0.1, 0.05, 0)); } b.position.y = 0.6 + 3.6 * hash(i, 5); one = b; }
    one.position.x = x; one.position.z = z; one.rotation.y = a * 1.7; g.add(one);
  }
  return g;
}

// ----------------------------------------------------------------------------------------------------------- spiders
/** A giant spider: eight three-jointed legs, a fat abdomen, fangs. `rear` lifts the front and the first two pairs. */
export function spider(scale = 1, c = '#2a2420', mark = '#8a1a1a', rear = 0): THREE.Group {
  const g = grp(), s = scale, joints: Record<string, THREE.Object3D> = {}, body = grp('body'); body.position.y = 1.5 * s; body.rotation.x = -rear * 0.5; g.add(body); joints.body = body;
  const ceph = ball(0.75 * s, c, 12, 9); ceph.scale.set(1, 0.7, 1.15); body.add(at(ceph, 0, 0, 0.5 * s));
  const abd = ball(1.25 * s, c, 14, 10); abd.scale.set(1, 0.85, 1.3); body.add(at(abd, 0, 0.25 * s, -1.6 * s));
  const hour = ball(0.5 * s, mark, 8, 6); hour.scale.set(0.8, 0.3, 1.2); body.add(at(hour, 0, 1.2 * s, -1.6 * s));
  for (let i = 0; i < 8; i++) { const e = lit(ball(0.07 * s * (i < 2 ? 1.6 : 1), '#c8202a', 6, 4), '#c8202a', 1, 0.8); body.add(at(e, (i % 2 ? 1 : -1) * (0.14 + 0.13 * Math.floor(i / 2)) * s, (0.3 - 0.04 * Math.floor(i / 2)) * s, (1.22 - 0.08 * Math.floor(i / 2)) * s)); }
  for (const sx of [-1, 1]) { const ch = cone(0.13 * s, 0.75 * s, '#17141a', 5); ch.rotation.x = Math.PI - 0.3; body.add(at(ch, sx * 0.22 * s, -0.4 * s, 1.25 * s)); const pal = bone(V(sx * 0.4 * s, -0.1 * s, 1.1 * s), V(sx * 0.5 * s, -0.5 * s, 1.75 * s), 0.1 * s, 0.06 * s, c); body.add(pal); }
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const yaw = (0.95 - i * 0.62) * sx, lift = i < 2 ? rear : 0, hip = grp(`leg${i}${sx > 0 ? 'L' : 'R'}`); hip.position.set(sx * 0.55 * s, 0, (0.75 - i * 0.32) * s); hip.rotation.y = Math.PI / 2 * sx - yaw; body.add(hip); joints[hip.name] = hip;
    const a = V(0, 0, 0), k = V(0, (1.5 + lift * 1.4) * s, 1.7 * s), m2 = V(0, (0.9 + lift * 2.4) * s, 3.1 * s), f = V(0, (-1.5 + lift * 3.4) * s, (4.0 + lift * 0.6) * s);
    hip.add(bone(a, k, 0.16 * s, 0.12 * s, c), bone(k, m2, 0.12 * s, 0.09 * s, c), bone(m2, f, 0.09 * s, 0.03 * s, c), at(ball(0.14 * s, c, 6, 5), k.x, k.y, k.z), at(ball(0.11 * s, c, 6, 5), m2.x, m2.y, m2.z));
  }
  g.userData.joints = joints; return ground(g);
}

// ----------------------------------------------------------------------------------------------------------- dragons
/** A dragon on four legs: a beast's body with a long neck and tail, horns, a crest and bat wings. */
export function dragon(o: { scale?: number; coat: string; under?: string; wing?: string; eyes?: string; pose?: BeastPose | BeastPoseName; spread?: number; ghost?: boolean }): THREE.Group {
  const k = o.scale ?? 1, spec: BeastSpec = { len: 3.2 * k, height: 2.6 * k, chest: 0.85 * k, loin: 0.6 * k, width: 0.7 * k, neck: 2.3 * k, neckThick: 0.42 * k, skull: 0.8 * k, skullW: 0.38 * k, muzzle: 0.85 * k, muzzleD: 0.2 * k, leg: 0.2 * k, ears: 'none', tail: 'none', tailLen: 0, foot: 'paw', mane: 'ridge', coat: o.coat, under: o.under ?? tone(o.coat, '#f0e0c0', 0.35), maneColor: tone(o.coat, '#000000', 0.3), eyes: o.eyes ?? '#ffd040', glow: true };
  const g = beast(spec, o.pose ?? { neck: [-0.35, 0.15], head: [0.5, 0], jaw: 0.45, legFR: [0.0, -0.3, 0.2], tail: [0, 0] }), j = g.userData.joints as Record<string, THREE.Object3D>;
  for (const sx of [-1, 1]) { const h = horn(0.9 * k, 0.07 * k, '#e8e0cc', 0.5); h.rotation.set(-0.9, 0, -sx * 0.3); j.head.add(at(h, sx * 0.22 * k, 0.3 * k, 0.1 * k)); const ch = cone(0.06 * k, 0.3 * k, '#e8e0cc', 4); ch.rotation.z = -sx * 1.9; j.head.add(at(ch, sx * 0.4 * k, -0.1 * k, 0.35 * k)); }
  j.tail.add(tailOf([V(0, 0, 0), V(0, -0.5 * k, -1.4 * k), V(0.4 * k, -1.3 * k, -2.8 * k), V(1.2 * k, -1.5 * k, -3.9 * k)], 0.42 * k, o.coat, 'spike'));
  const w = wings('bat', 5.2 * k, o.coat, { spread: o.spread ?? 0.9, lift: 0.75, membrane: o.wing ?? tone(o.coat, '#3a1014', 0.4) }); w.rotation.y = 0; w.rotation.x = -0.25;
  for (const c of w.children) c.position.x = (c.scale.x < 0 ? -1 : 1) * 0.4 * k; j.body.add(at(w, 0, 0.35 * k, 2.3 * k));
  if (o.ghost) spectral(g, undefined, 0.45);
  return g;
}

// ----------------------------------------------------------------------------------------------------------- blights
/** A blight: a walking plant. Twig (small, spindly), needle (a conifer's shape, bristling), vine (a creeping tangle) and
 *  tree (huge, a trunk on root legs with branch arms). All are jointed at the arms. */
export function blight(kind: 'twig' | 'needle' | 'vine' | 'tree', o: { scale?: number; bark?: string; leaf?: string; eyes?: string; battle?: boolean } = {}): THREE.Group {
  const k = (o.scale ?? 1) * ({ twig: 0.55, needle: 1, vine: 1, tree: 3.2 } as const)[kind], bark = o.bark ?? ({ twig: '#4a3a2a', needle: '#3a3a26', vine: '#2e3a22', tree: '#3a2e24' } as const)[kind], leaf = o.leaf ?? ({ twig: '#5a4a2a', needle: '#2a4a2a', vine: '#3a5a2a', tree: '#3a2a1e' } as const)[kind];
  const g = grp(), joints: Record<string, THREE.Object3D> = {}, eyes = o.eyes ?? '#c8e040', bt = o.battle ? 1 : 0;
  const twigs = (parent: THREE.Object3D, from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number, seed: number) => {
    const end = from.clone().addScaledVector(dir, len); parent.add(bone(from, end, r, r * 0.6, bark, 5));
    if (depth <= 0) { if (kind !== 'twig' || seed % 3 === 0) { const l = ball(r * 2.2, leaf, 6, 4); l.scale.set(1, 0.4, 1.6); l.position.copy(end); parent.add(l); } return; }
    for (let i = 0; i < 2; i++) { const d = dir.clone().applyAxisAngle(V(0, 0, 1), (i ? 1 : -1) * (0.45 + 0.3 * hash(seed, i))).applyAxisAngle(V(0, 1, 0), 2.1 * hash(seed, i + 7) - 1).normalize(); twigs(parent, end, d, len * 0.68, r * 0.62, depth - 1, seed * 2 + i + 1); }
  };
  if (kind === 'vine') {
    // a low mound of coiling vines with reaching tendrils
    for (let i = 0; i < 7; i++) { const a = i * 0.9, pts: THREE.Vector3[] = []; for (let u = 0; u <= 6; u++) { const t = u / 6; pts.push(V(Math.cos(a + t * 2.4) * (0.5 + 1.5 * t) * k, (0.5 + 1.6 * Math.sin(t * Math.PI) * (0.6 + hash(i)) + (bt && i % 2 ? 1.6 * t : 0)) * k, Math.sin(a + t * 2.4) * (0.5 + 1.5 * t) * k)); } g.add(tailOf(pts, 0.17 * k, i % 2 ? bark : tone(bark, leaf, 0.5))); for (let u = 1; u < 6; u += 2) { const l = ball(0.2 * k, leaf, 6, 4); l.scale.set(1.3, 0.3, 0.8); l.position.copy(pts[u]); l.position.y += 0.15 * k; g.add(l); } }
    const core = ball(0.75 * k, bark, 10, 8); core.scale.y = 0.7; g.add(at(core, 0, 0.7 * k, 0)); for (const sx of [-1, 1]) g.add(at(lit(ball(0.08 * k, eyes, 6, 4), eyes, 1), sx * 0.22 * k, 0.9 * k, 0.62 * k));
    return ground(g);
  }
  const H = kind === 'needle' ? 4.2 * k : 4.6 * k, R = (kind === 'tree' ? 0.42 : kind === 'needle' ? 0.34 : 0.2) * k;
  // root legs
  const nLeg = kind === 'tree' ? 5 : 2;
  for (let i = 0; i < nLeg; i++) { const a = kind === 'tree' ? i * 1.257 + 0.3 : (i ? 1 : -1) * Math.PI / 2, hipP = V(Math.sin(a) * R * 0.9, H * 0.36, Math.cos(a) * R * 0.5), knee = V(Math.sin(a) * R * 2.4, H * 0.2, Math.cos(a) * R * 2.2 + (bt && i === 0 ? R * 1.5 : 0)), foot = V(Math.sin(a) * R * 3.0, 0.05, Math.cos(a) * R * 2.6 + (bt && i === 0 ? R * 3 : 0)); g.add(bone(hipP, knee, R * 0.75, R * 0.5, bark, 6), bone(knee, foot, R * 0.5, R * 0.3, bark, 6)); for (let t = -1; t <= 1; t++) g.add(bone(foot, foot.clone().add(V(Math.sin(a + t * 0.6) * R * 1.3, 0, Math.cos(a + t * 0.6) * R * 1.3)), R * 0.22, R * 0.06, bark, 4)); }
  const trunk = grp('trunk'); trunk.position.y = H * 0.34; trunk.rotation.x = bt * 0.18; g.add(trunk); joints.trunk = trunk;
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 1.15, H * 0.5, 9, 4), soft(bark)); const pp = tr.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getX(i), pp.getZ(i)), y = pp.getY(i), w = 1 + 0.12 * Math.sin(a * 5 + y * 3 / k); pp.setX(i, pp.getX(i) * w + 0.1 * R * Math.sin(y * 2 / k)); pp.setZ(i, pp.getZ(i) * w); } tr.geometry.computeVertexNormals(); trunk.add(at(tr, 0, H * 0.25, 0));
  // a face in the bark: a split mouth and burning knot eyes
  const fy = H * 0.36; for (const sx of [-1, 1]) { trunk.add(at(lit(ball(R * 0.16, eyes, 6, 4), eyes, 1), sx * R * 0.34, fy, R * 0.82)); const br = bone(V(sx * R * 0.12, fy + R * 0.2, R * 0.9), V(sx * R * 0.6, fy + R * 0.42, R * 0.75), R * 0.09, R * 0.05, tone(bark, '#000000', 0.4), 4); trunk.add(br); }
  const mouth = ball(R * 0.4, '#17110c', 8, 6); mouth.scale.set(1, 0.45 + bt * 0.5, 0.4); trunk.add(at(mouth, 0, fy - R * 0.5, R * 0.86)); if (kind === 'tree') for (let i = -2; i <= 2; i++) { const t = cone(R * 0.06, R * 0.3, bark, 4); t.rotation.x = Math.PI; trunk.add(at(t, i * R * 0.13, fy - R * 0.36, R * 0.98)); }
  // branch arms, jointed at the shoulder and elbow
  for (const sx of [-1, 1]) {
    const sh = grp(sx > 0 ? 'armL' : 'armR'); sh.position.set(sx * R * 0.85, H * 0.4, 0); sh.rotation.set(bt ? (sx > 0 ? -1.9 : -0.7) : -0.2, 0, sx * (bt ? 0.5 : 0.25)); trunk.add(sh); joints[sh.name] = sh;
    const L = H * (kind === 'tree' ? 0.36 : 0.3); sh.add(bone(V(0, 0, 0), V(sx * L * 0.2, -L, 0), R * 0.42, R * 0.3, bark, 6));
    const el = grp(); el.position.set(sx * L * 0.2, -L, 0); el.rotation.x = bt ? -1.0 : -0.45; sh.add(el); el.add(bone(V(0, 0, 0), V(0, -L * 0.9, 0), R * 0.3, R * 0.2, bark, 6));
    for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.45; el.add(bone(V(0, -L * 0.9, 0), V(Math.sin(a) * L * 0.4, -L * 0.9 - L * 0.42, Math.cos(a) * L * 0.18 * (i % 2 ? 1 : -1) + L * 0.12), R * 0.12, R * 0.03, bark, 4)); }
  }
  // the crown
  if (kind === 'needle') { for (let t = 0; t < 4; t++) { const c = cone(R * (2.6 - t * 0.5), H * 0.24, leaf, 9); trunk.add(at(c, 0, H * (0.5 + t * 0.12), 0)); } for (let i = 0; i < 26; i++) { const a = i * 2.4, y = H * (0.42 + 0.5 * hash(i)), n = cone(R * 0.05, R * 1.3, '#c8c8a0', 4); n.rotation.set(Math.PI / 2 * Math.cos(a), 0, -Math.PI / 2 * Math.sin(a)); trunk.add(at(n, Math.sin(a) * R * 1.9 * (1.3 - y / H), y, Math.cos(a) * R * 1.9 * (1.3 - y / H))); } }
  else { const n = kind === 'tree' ? 6 : 4; for (let i = 0; i < n; i++) { const a = i * 2.399, d = V(Math.sin(a) * 0.55, 0.85, Math.cos(a) * 0.55).normalize(); twigs(trunk, V(Math.sin(a) * R * 0.3, H * 0.48, Math.cos(a) * R * 0.3), d, H * (kind === 'tree' ? 0.22 : 0.2), R * 0.32, kind === 'tree' ? 3 : 2, i + 1); } }
  g.userData.joints = joints; return ground(g);
}

// ---------------------------------------------------------------------------------------------- the odd and the haunted
/** A lumpy, glistening ooze or a mound. */
export function ooze(c: string, scale = 1, o: { eyes?: number; shine?: string; opacity?: number; reach?: boolean } = {}): THREE.Group {
  const g = grp(), geo = new THREE.SphereGeometry(1.6 * scale, 18, 12), p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), w = 1 + 0.22 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7); p.setXYZ(i, x * w, Math.max(-0.02, y * 0.55 + 0.25 * scale * Math.sin(x * 2 / scale) * Math.cos(z * 2 / scale)), z * w); }
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, soft(c)); if (o.opacity) lit(m, c, o.opacity, 0.15); g.add(at(m, 0, 0.02, 0));
  for (let i = 0; i < 5; i++) { const b = ball(0.16 * scale, o.shine ?? tone(c, '#ffffff', 0.4), 6, 5); g.add(at(b, Math.sin(i * 2.4) * 0.8 * scale, (0.7 + 0.12 * (i % 2)) * scale, Math.cos(i * 2.4) * 0.8 * scale)); }
  if (o.reach) for (const sx of [-1, 1]) g.add(tailOf([V(sx * 0.9 * scale, 0.6 * scale, 0.6 * scale), V(sx * 1.3 * scale, 1.5 * scale, 1.3 * scale), V(sx * 0.9 * scale, 1.8 * scale, 2.3 * scale)], 0.32 * scale, c));
  for (let i = 0; i < (o.eyes ?? 0); i++) g.add(at(lit(ball(0.1 * scale, '#e8e040', 6, 4), '#e8e040', 1), (i - ((o.eyes ?? 1) - 1) / 2) * 0.4 * scale, 0.75 * scale, 1.25 * scale));
  return g;
}
/** A will-o'-wisp or another ball of light, hovering. */
export function wisp(c = '#bfe8ff', r = 0.45, hover = 3.2): THREE.Group {
  const g = grp(); g.add(at(lit(ball(r * 0.45, '#ffffff', 10, 8), '#ffffff', 1), 0, hover, 0), at(lit(ball(r, c, 12, 9), c, 0.5), 0, hover, 0), at(lit(ball(r * 1.7, c, 12, 9), c, 0.16), 0, hover, 0));
  for (let i = 0; i < 3; i++) { const t = cone(r * 0.25, r * 1.6, c, 5); lit(t, c, 0.4); t.rotation.x = Math.PI; g.add(at(t, Math.sin(i * 2.1) * r * 0.4, hover - r * 1.2, Math.cos(i * 2.1) * r * 0.4)); }
  return g;
}
/** A skull wreathed in flame, hovering. */
export function flameskull(hover = 3.6): THREE.Group {
  const g = grp(), s = grp('head'); s.position.y = hover; g.add(s);
  const sk = ball(0.42, '#e0d8c4', 14, 10); sk.scale.set(0.92, 1, 1.05); s.add(sk); const jw = ball(0.28, '#d8d0bc', 10, 8); jw.scale.set(0.9, 0.7, 1); s.add(at(jw, 0, -0.3, 0.12));
  for (const sx of [-1, 1]) { s.add(at(ball(0.11, '#17110c', 8, 6), sx * 0.16, 0.03, 0.36), at(lit(ball(0.05, '#6ae06a', 6, 4), '#6ae06a', 1), sx * 0.16, 0.03, 0.42)); }
  s.add(at(cone(0.05, 0.12, '#17110c', 4), 0, -0.1, 0.42)); for (let i = -2; i <= 2; i++) s.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.03), hard('#f2ece0')), i * 0.055, -0.27, 0.36));
  for (let i = 0; i < 9; i++) { const a = i * 0.7, f = cone(0.16 - 0.006 * i, 0.7 + 0.5 * hash(i), i % 2 ? '#8af08a' : '#3ac85a', 5); lit(f, i % 2 ? '#8af08a' : '#3ac85a', 0.6); s.add(at(f, Math.sin(a) * 0.3, 0.45 + 0.1 * hash(i, 2), Math.cos(a) * 0.3 - 0.1)); }
  return g;
}
/** A severed hand that crawls on its fingers. */
export function crawlingClaw(c = '#b09a80'): THREE.Group {
  const g = grp(); const palm = ball(0.22, c, 10, 8); palm.scale.set(1, 0.5, 1.2); g.add(at(palm, 0, 0.28, 0));
  for (let i = 0; i < 5; i++) { const thumb = i === 4, a = thumb ? 1.5 : (i - 1.5) * 0.3, base = V(Math.sin(a) * 0.17, 0.3, Math.cos(a) * 0.2), k = base.clone().add(V(Math.sin(a) * 0.14, 0.14, Math.cos(a) * 0.2)), tip = k.clone().add(V(Math.sin(a) * 0.05, -0.42, Math.cos(a) * 0.1)); g.add(bone(base, k, 0.05, 0.04, c, 5), bone(k, tip, 0.04, 0.025, c, 5), at(cone(0.022, 0.08, '#3a2a22', 4), tip.x, tip.y - 0.02, tip.z).rotateX(Math.PI)); }
  g.add(at(cyl(0.11, 0.13, 0.16, c, 8), 0, 0.27, -0.3).rotateX(Math.PI / 2), at(ball(0.1, '#6a1e1e', 8, 6), 0, 0.27, -0.4)); return g;
}
/** A rug that rises to smother: a rippling sheet rearing at one end. */
export function rug(c = '#6a2a2a', trim = '#c8a040', rear = 0.7): THREE.Group {
  const g = grp(), W = 5, L = 8, geo = new THREE.PlaneGeometry(W, L, 10, 20), p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), u = (y + L / 2) / L, h = 0.12 + 0.12 * Math.sin(u * 14 + x) + (u > 0.55 ? rear * ((u - 0.55) / 0.45) ** 1.6 * 5.5 : 0), fwd = u > 0.55 ? -rear * ((u - 0.55) / 0.45) ** 2 * 1.6 : 0; p.setXYZ(i, x * (1 + (u > 0.7 ? 0.15 * Math.sin((u - 0.7) * 10) : 0)), h, y + fwd); }
  geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, soft(c, true)));
  const inner = geo.clone(); const q = inner.attributes.position as THREE.BufferAttribute; for (let i = 0; i < q.count; i++) q.setXYZ(i, q.getX(i) * 0.72, q.getY(i) + 0.02, q.getZ(i) * 0.86); g.add(new THREE.Mesh(inner, soft(tone(c, trim, 0.35), true)));
  for (let i = 0; i <= 10; i++) for (const e of [-1, 1]) { const t = cone(0.05, 0.45, trim, 4); t.rotation.x = e * Math.PI / 2; g.add(at(t, (i / 10 - 0.5) * W, e < 0 ? 0.15 : 0.15 + rear * 5.5, e * L / 2 + (e > 0 ? -rear * 1.6 : 0))); }
  return g;
}
/** A sword that flies and fights by itself. */
export function flyingSword(hover = 3): THREE.Group { const g = grp(), w = weapon({ kind: 'longsword', metal: '#b8c0cc', fittings: '#6a6a72', grip: '#2a1e18', wear: 0.3 }); w.rotation.set(2.2, 0, 0.3); g.add(at(w, 0, hover + 1.2, -0.6)); for (let i = 0; i < 3; i++) { const t = ball(0.5 - i * 0.12, '#bfe8ff', 8, 6); lit(t, '#bfe8ff', 0.14); g.add(at(t, 0, hover + 0.6 - i * 0.5, -0.9 - i * 0.5)); } return g; }
/** A broom that sweeps at intruders. */
export function broom(battle = false): THREE.Group { const g = grp(), b = grp('body'); b.rotation.x = battle ? -0.7 : -0.12; b.position.y = battle ? 1.2 : 0.3; g.add(b); b.add(at(cyl(0.06, 0.07, 4.6, '#5a4028', 7), 0, 2.9, 0)); for (let i = 0; i < 14; i++) { const a = i * 2.4, s = cone(0.09, 1.3, i % 2 ? '#b89a4a' : '#9a7e3a', 4); s.rotation.set(Math.PI + 0.22 * Math.cos(a), 0, 0.22 * Math.sin(a)); b.add(at(s, Math.sin(a) * 0.16, 0.25, Math.cos(a) * 0.16)); } b.add(at(cyl(0.22, 0.2, 0.22, '#3a2a1e', 8), 0, 0.82, 0)); return g; }
/** A chest that is not a chest: lid agape, teeth, a tongue, a reaching pseudopod. */
export function mimic(battle = true): THREE.Group {
  const g = grp(), wood = '#5a3e26', band = '#8a7a4a';
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2), hard(wood)), 0, 0.75, 0)); for (const x of [-1.1, 1.1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.56, 2.06), hard(band)), x, 0.75, 0));
  const lid = grp('jaw'); lid.position.set(0, 1.5, -1); lid.rotation.x = battle ? -0.85 : -0.05; g.add(lid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 10, 1, false, 0, Math.PI), hard(wood)); top.rotation.set(0, Math.PI / 2, Math.PI / 2); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); lid.add(at(top, 0, 0, 1)); top.scale.set(1, 1, 0.6);
  if (battle) { for (let i = 0; i < 9; i++) { const x = (i - 4) * 0.33; const t = cone(0.1, 0.42, '#f2ece0', 4); g.add(at(t, x, 1.68, 0.92)); const u = cone(0.1, 0.42, '#f2ece0', 4); u.rotation.x = Math.PI; lid.add(at(u, x, -0.18, 1.92)); } g.add(at(ball(0.9, '#5a1a2a', 10, 8), 0, 1.35, 0.1)).scale.set(1.5, 0.4, 1); g.add(tailOf([V(0, 1.5, 0.4), V(0.3, 1.9, 1.6), V(-0.2, 1.2, 2.6), V(0.1, 1.5, 3.3)], 0.3, '#a04058')); for (const sx of [-1, 1]) g.add(at(lit(ball(0.12, '#e8e040', 6, 4), '#e8e040', 1), sx * 0.6, 0.3, 1.02)); g.add(tailOf([V(1.5, 0.6, 0.2), V(2.4, 1.2, 0.8), V(2.9, 0.9, 1.9)], 0.3, tone(wood, '#a04058', 0.4))); }
  return g;
}
/** A grick: a pale worm with a beak in a nest of four barbed tentacles. */
export function grick(c = '#8a8a78'): THREE.Group {
  const g = grp(); g.add(tailOf([V(0, 0.45, -3.2), V(0.6, 0.45, -2.0), V(-0.4, 0.5, -0.8), V(0, 1.0, 0.2), V(0, 2.1, 0.9)].reverse(), 0.55, c));
  const head = grp('head'); head.position.set(0, 2.1, 0.9); head.rotation.x = 0.5; g.add(head); head.add(ball(0.5, c, 10, 8));
  const bk = cone(0.2, 0.6, '#2a2420', 5); bk.rotation.x = Math.PI / 2; head.add(at(bk, 0, 0, 0.6));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; head.add(tailOf([V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.2), V(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 1.0), V(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 2.1)], 0.15, tone(c, '#5a3a3a', 0.3), 'spike')); }
  return g;
}
/** A shambling mound: a heap of rotting vegetation with two heavy vine arms. */
export function shamblingMound(scale = 1, c = '#3a4a2a'): THREE.Group {
  const g = ooze(c, 1.25 * scale, { shine: '#5a6a3a' }); g.children[0].scale.y = 3.2; const k = scale;
  for (const sx of [-1, 1]) { g.add(tailOf([V(sx * 1.4 * k, 4.2 * k, 0.2 * k), V(sx * 2.6 * k, 4.6 * k, 1.2 * k), V(sx * 2.4 * k, 2.6 * k, 2.6 * k), V(sx * 1.8 * k, 1.6 * k, 3.2 * k)], 0.6 * k, tone(c, '#2a2a1a', 0.3))); g.add(at(lit(ball(0.14 * k, '#e8c040', 6, 4), '#e8c040', 1), sx * 0.4 * k, 4.6 * k, 1.5 * k)); }
  for (let i = 0; i < 14; i++) { const a = i * 2.4, l = ball(0.5 * k, i % 2 ? '#4a5a2a' : '#5a4a2a', 6, 4); l.scale.set(1.3, 0.25, 0.8); l.rotation.set(0.5 * Math.sin(i), a, 0.4); g.add(at(l, Math.sin(a) * 1.7 * k, (0.8 + 4.2 * hash(i)) * k, Math.cos(a) * 1.7 * k)); }
  return g;
}
/** The hut that walks: a ruined cabin on a tangle of giant roots. */
export function creepingHut(battle = false): THREE.Group {
  const g = grp(), hut = grp('body'); hut.position.y = 9; hut.rotation.set(battle ? 0.12 : 0, 0, battle ? -0.08 : 0.03); g.add(hut);
  hut.add(at(new THREE.Mesh(new THREE.BoxGeometry(15, 8, 15), hard('#4a3a2a')), 0, 4, 0)); for (let i = 0; i < 8; i++) hut.add(at(new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.25, 15.2), hard('#2e241a')), 0, 0.6 + i, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12.5, 7, 4), hard('#3a3a2a')); roof.rotation.y = Math.PI / 4; hut.add(at(roof, 0, 11.3, 0));
  hut.add(at(new THREE.Mesh(new THREE.BoxGeometry(3, 5.5, 0.4), hard('#1e1610')), 0, 2.8, 7.6)); for (const sx of [-1, 1]) hut.add(at(lit(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.3), hard('#8ae06a')), '#8ae06a', 0.9, 0.7), sx * 4.6, 5, 7.6));
  hut.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 1.6), hard('#3a3430')), 4.5, 11.5, -3));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2, r = 6.5, reach = battle && i < 2 ? 1 : 0; g.add(tailOf([V(Math.sin(a) * r, 9.5, Math.cos(a) * r), V(Math.sin(a) * (r + 5), 6.5 + reach * 5, Math.cos(a) * (r + 5)), V(Math.sin(a) * (r + 6), 2.5 + reach * 6, Math.cos(a) * (r + 6 + reach * 3)), V(Math.sin(a) * (r + 9), 0.3 + reach * 4, Math.cos(a) * (r + 9 + reach * 5))], 1.5, i % 2 ? '#3a2e24' : '#463628')); }
  for (let i = 0; i < 5; i++) { const a = i * 1.3; g.add(tailOf([V(Math.sin(a) * 3, 9, Math.cos(a) * 3), V(Math.sin(a) * 4, 4, Math.cos(a) * 4), V(Math.sin(a) * 5.5, 0.2, Math.cos(a) * 5.5)], 1.1, '#2e241a')); }
  return g;
}
/** The great crystal heart of the castle: a faceted red heart that hangs and pulses. */
export function heartOfSorrow(hover = 6): THREE.Group {
  const g = grp(), h = grp('body'); h.position.y = hover + 3; g.add(h);
  for (const [x, r] of [[-1.1, 1.9], [1.1, 1.9]] as const) h.add(at(lit(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), hard('#c8202a')), '#c8202a', 0.85, 0.5), x, 1, 0));
  const pt = lit(new THREE.Mesh(new THREE.ConeGeometry(2.9, 4.4, 6), hard('#a0141e')), '#a0141e', 0.85, 0.5); pt.rotation.x = Math.PI; h.add(at(pt, 0, -1.6, 0));
  h.add(at(lit(ball(4.4, '#ff3a3a', 12, 9), '#ff3a3a', 0.1), 0, 0, 0), at(lit(ball(0.9, '#ffb0a0', 8, 6), '#ffb0a0', 0.9), 0, 0.2, 0));
  return g;
}
/** A tree that drinks blood: a stump of black wood with bare, clawing limbs and weeping sap. */
export function gulthiasTree(): THREE.Group { const g = blight('tree', { scale: 1.9, bark: '#1c1814', leaf: '#1c1814', eyes: '#c8202a' }); for (let i = 0; i < 6; i++) { const d = ball(0.35, '#7a1420', 6, 5); d.scale.y = 2.2; g.add(at(d, Math.sin(i * 1.1) * 2.6, 7 + 5 * hash(i), Math.cos(i * 1.1) * 2.6)); } return g; }
