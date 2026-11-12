// The module's monsters, one builder per creature id: which model each is, how it stands, and how it looks in a fight.
// People-shaped monsters are recipes for the shared jointed figure (kit/heroes.ts) with their own faces (kit/faces.ts),
// gear (kit/weapons.ts) and poses (kit/poses.ts), plus the parts a person lacks (wings, horns, a tail, a beast's head).
// Everything else comes from kit/beasts.ts and kit/monsters.ts. Original geometry; no book text or numbers here.
import * as THREE from 'three';
import { frameFor, heroFigure, SIDE_X, type HeroFigure, type HeroPose } from './heroes';
import { clipRings, loftGeometry, neckLift, neckRings, ringAt, ringPoint, torsoRings } from './anatomy';
import { mat } from '../render/materials';
import { posed, deadPose } from './poses';
import type { FaceSpec } from './faces';
import type { WeaponSpec } from './weapons';
import { beast, BEASTS, BEUCEPHALUS, type BeastSpec, type BeastPoseName } from './beasts';
import * as mon from './monsters';
import type { CreatureSize } from '../core/units';

const SCALE: Record<string, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };   // the figure rig's size scale
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A people-shaped monster: a figure recipe (its poses may be named from kit/poses.ts) and what is added to the body. */
export interface Folk extends Omit<HeroFigure, 'pose' | 'battlePose' | 'deadPose'> {
  pose?: string | HeroPose; battlePose?: string | HeroPose; deadPose?: string | HeroPose; size?: CreatureSize;
  /** One of many: each token of this creature gets its own hair, skin and clothing tones as well as its own face. */
  vary?: boolean;
  extra?: {
    wings?: { kind: mon.WingKind; span: number; color: string; membrane?: string; spread?: number };
    horns?: { len: number; color: string; curl?: number };
    tail?: { len: number; color: string; tip?: 'spade' | 'spike' };
    /** A beast's head in place of the person's (a werewolf, a jackal-headed fiend). */
    head?: BeastSpec;
    /** A bird's beak on the face. */
    beak?: string;
    /** See-through and faintly lit (a colour), and how solid it is. */
    ghost?: string; opacity?: number;
  };
}

export type FigState = boolean | 'rest' | 'battle' | 'dead';
const hashOf = (t: string): number => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const HAIR = ['#1a1a1a', '#2a2018', '#3a2a1a', '#5a4632', '#7a5a34', '#8a5a2a', '#6a3a22', '#9a8a70', '#7a7a7a', '#c8c0b0'];
const shift = (c: string | undefined, k: number): string | undefined => c && '#' + new THREE.Color(c).offsetHSL(0.03 * k, 0.05 * k, 0.05 * k).getHexString();

/** A stake through the chest of a figure that is already lying on its back: what finally keeps a vampire down. */
export function staked(g: THREE.Group): THREE.Group {
  const chest = (g.userData.joints as Record<string, THREE.Object3D> | undefined)?.chest; if (!chest) return g;
  g.updateMatrixWorld(true); const p = g.worldToLocal(chest.getWorldPosition(V(0, 0, 0)));
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.02, 1.5, 6), (mon.horn(0.1, 0.01, '#6a4a2a').material as THREE.Material)); st.rotation.z = 0.12; st.position.set(p.x, p.y + 0.6, p.z); g.add(st);
  return g;
}
/** A smooth-shaded palette colour (flesh, fur), as the figure's own soft parts are. */
const smooth = (c: string): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: '#030303' }); m.userData.smooth = true; return m; };
/** A hooked thorn: a cone standing on its base at the origin along +y, bent toward +z as it rises (`hook` of its length). */
function thorn(len: number, r: number, c: string, hook = 0.3, seg = 5): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, len, seg, 4); geo.translate(0, len / 2, 0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setZ(i, p.getZ(i) + hook * len * t * t); }
  geo.computeVertexNormals(); return new THREE.Mesh(geo, mat(c));
}
/** Set a part on a limb's surface: base at `at`, standing out along `out` and curling toward `toward`. */
function setOn(m: THREE.Object3D, at: THREE.Vector3, out: THREE.Vector3, toward: THREE.Vector3): void {
  const Y = out.clone().normalize(), Z = toward.clone().addScaledVector(Y, -toward.dot(Y)).normalize(), X = Y.clone().cross(Z);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); m.position.copy(at);
}
/** A self-lit part (an ember), its own material, flagged so the token pass keeps the look. */
function ember(m: THREE.Mesh, c: string): THREE.Mesh {
  const n = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 }); n.userData = { keepLook: true, smooth: true }; m.material = n; m.userData.keepLook = true; return m;
}

/** An arm unlike the other, grown in place of a lost one: bare from the shoulder, its flesh dark, knotted and lumpy, far
 *  thicker than the arm it replaced, barbed along its back and spurred at the elbow, the hand huge, long in the fingers,
 *  with hooked nails. Applied to a built figure by its joints, so it follows whatever pose the arm is in; `lit` (a
 *  colour) sets embers at the fingertips (fire at the snap of the fingers). The joints say how much thicker the arm is
 *  (userData.girth), so the clip check (kit/clipcheck.ts) measures the arm it really is. */
export interface FiendArm { side: 'R' | 'L'; color: string; claws?: string; /** Its girth against the other arm (default 1.5). */ size?: number }
export function fiendishArm(g: THREE.Group, arm: FiendArm, lit?: string): THREE.Group {
  const j = (g.userData.joints ?? {}) as Record<string, THREE.Object3D>, sh = j['shoulder' + arm.side], el = j['elbow' + arm.side], wr = j['wrist' + arm.side];
  if (!sh || !el || !wr) return g;
  const s = Math.abs(wr.position.y) / 1.04, ox = SIDE_X[arm.side], claw = arm.claws ?? '#1c0c0a', kF = arm.size ?? 1.5, kU = 1 + (kF - 1) * 0.85, kH = 1 + (kF - 1) * 0.8;
  const meshes = (o: THREE.Object3D) => o.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
  const tint = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
  const recolor = (m: THREE.Mesh, c: string) => { const src = m.material as THREE.MeshLambertMaterial, k = src.clone(); k.color.set(c); k.userData = { ...src.userData }; m.material = k; };
  const loft = (m: THREE.Mesh) => m.geometry.type === 'BufferGeometry';
  // knotted flesh: the limb's skin pushed in and out round its length (ridges of muscle, knots and lumps), never smooth
  // (`girth` swells it by height: the upper arm narrows into the shoulder, under the coat and the fur)
  const knots = (m: THREE.Mesh, seed: number, bumps: [number, number, number][], girth: (y: number) => number = () => 1) => {
    const geo = m.geometry = m.geometry.clone(), p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i) / s, th = Math.atan2(x, z);
      let n = 0.07 * Math.sin(5 * th + 9 * y + seed) + 0.05 * Math.sin(9 * th - 6 * y + 2 * seed) + 0.035 * Math.sin(15 * th + 19 * y + seed);
      for (const [bt, by, k] of bumps) { let d = th - bt; d = Math.atan2(Math.sin(d), Math.cos(d)); n += k * Math.exp(-((d / 0.55) ** 2) - ((y - by) / 0.13) ** 2); }
      const k = (1 + n) * girth(y); p.setX(i, x * k); p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
  };
  // a point on a lofted part's skin (in its joint's frame), at angle `th` (0 the front, round through +x) and height y
  const skin = (m: THREE.Mesh, th: number, y: number) => {
    const p = m.geometry.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3(); let best = Infinity;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); if (Math.abs(vy - y * s) > 0.07 * s || Math.hypot(vx, vz) < 1e-6) continue;
      let d = Math.atan2(vx, vz) - th; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) + Math.abs(vy - y * s) / s;
      if (d < best) { best = d; v.set(vx, vy, vz); }
    }
    return v.multiply(m.scale).add(m.position);
  };
  const back = Math.PI - ox * 0.55, outer = ox * Math.PI / 2;   // the arm's back-outer line, and its outer side
  const upper = meshes(sh).find(loft), fore = meshes(el).find(loft), elbow = meshes(el).find((m) => m.geometry.type === 'SphereGeometry');
  for (const m of [...meshes(sh), ...meshes(el), ...meshes(wr)]) recolor(m, arm.color);
  if (upper) knots(upper, 0.7, [[back, -0.6, 0.12], [outer, -0.3, 0.1], [0.4 * ox, -0.75, 0.08]], (y) => 1.12 + (kU - 1.12) * Math.min(1, Math.max(0, (-y - 0.15) / 0.45)));
  if (fore) { knots(fore, 2.1, [[back, -0.32, 0.16], [ox * 1.1, -0.55, 0.1], [-ox * 0.5, -0.25, 0.09], [Math.PI, -0.8, 0.07]]); fore.scale.set(kF, 1, kF); }
  if (elbow) elbow.scale.set(kF, elbow.scale.y * 1.1, kF);
  sh.userData.girth = kU; el.userData.girth = kF;
  // lumps grown out of it: knobs of darker flesh half sunk into the arm
  const lump = tint(arm.color, '#2a0a10', 0.35);
  for (const [m, th, y, r] of [[upper, outer + ox * 0.3, -0.48, 0.09], [upper, back - ox * 0.5, -0.86, 0.07], [fore, ox * 1.45, -0.42, 0.075], [fore, -0.35 * ox, -0.62, 0.06], [fore, back + ox * 0.35, -0.15, 0.08]] as [THREE.Mesh | undefined, number, number, number][]) {
    if (!m) continue; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s * kF, 1), smooth(lump)); b.position.copy(skin(m, th, y)); b.scale.set(1, 1.4, 0.8); b.rotation.set(0, th, 0); m.parent!.add(b);
  }
  // barbs down the back of the forearm and the upper arm, hooked back toward the shoulder; spurs at the point of the elbow
  const barb = tint(arm.color, '#000000', 0.6), up = new THREE.Vector3(0, 1, 0);
  const spines = (m: THREE.Mesh | undefined, ys: number[], len: number, r: number) => { if (!m) return; ys.forEach((y, i) => {
    const th = back + ox * (i % 2 ? 0.28 : -0.22), at = skin(m, th, y), out = new THREE.Vector3(Math.sin(th), 0, Math.cos(th)), t = thorn((len - 0.025 * i) * s, r * s, barb, 0.45);
    setOn(t, at.addScaledVector(out, -0.02 * s), out.clone().addScaledVector(up, 0.9), up); m.parent!.add(t);
  }); };
  spines(fore, [-0.2, -0.36, -0.52, -0.67, -0.81, -0.93], 0.3, 0.05);
  spines(upper, [-0.45, -0.62, -0.79, -0.95], 0.26, 0.045);
  if (elbow) for (const [dx, k] of [[0, 1], [ox * 0.07, 0.7]] as const) { const t = thorn(0.38 * k * s, 0.065 * k * s, barb, 0.35); setOn(t, new THREE.Vector3(dx * s, 0.02 * s, -0.12 * s * kF), new THREE.Vector3(ox * 0.2, -0.35, -1), new THREE.Vector3(0, -1, 0)); el.add(t); }
  // the hand: half again as big, the fingers drawn out longer still, a hooked nail at every tip, knuckle spurs
  const held = wr.children.filter((c) => !(c as THREE.Mesh).isMesh);
  wr.scale.multiplyScalar(kH); for (const c of held) c.scale.divideScalar(kH);
  const hm = meshes(wr), dirOf = (m: THREE.Mesh) => new THREE.Vector3(0, -1, 0).applyQuaternion(m.quaternion), lenOf = (m: THREE.Mesh) => { const q = (m.geometry as THREE.CapsuleGeometry).parameters; return q.height + 2 * q.radius; };
  const longer = 1.3;
  for (let i = 0; i < 4; i++) {
    const k1 = hm[1 + 2 * i], k2 = hm[2 + 2 * i]; if (!k1 || !k2 || k1.geometry.type !== 'CapsuleGeometry' || k2.geometry.type !== 'CapsuleGeometry') continue;
    const d1 = dirOf(k1).multiplyScalar((longer - 1) * lenOf(k1)); k1.position.addScaledVector(d1, 0.5); k1.scale.y *= longer;
    k2.position.add(d1).addScaledVector(dirOf(k2), (longer - 1) * lenOf(k2) * 0.5); k2.scale.y *= longer;
  }
  const thumb = hm[9]; if (thumb?.geometry.type === 'CapsuleGeometry') { thumb.position.addScaledVector(dirOf(thumb), (longer - 1) * lenOf(thumb) * 0.5); thumb.scale.y *= longer; }
  for (const i of [2, 4, 6, 8, 9]) {
    const f = hm[i], prm = (f?.geometry as THREE.CapsuleGeometry | undefined)?.parameters; if (!f || !prm || f.geometry.type !== 'CapsuleGeometry') continue;
    const len = prm.radius * 6, c = thorn(len, prm.radius * 0.85, claw, 0.35, 6); c.rotation.x = Math.PI; c.position.y = -(prm.height / 2 + prm.radius * 0.6); c.scale.y = 1 / f.scale.y; f.add(c);
    if (lit) { const e = ember(new THREE.Mesh(new THREE.ConeGeometry(prm.radius * 0.9, prm.radius * 3.2, 5), mat(lit)), lit); e.position.set(0, -len * 0.9, prm.radius * 0.5); c.add(e); }
  }
  const palm = hm[0], pr = (palm?.geometry as THREE.SphereGeometry | undefined)?.parameters.radius;
  if (palm && pr) for (let i = 0; i < 4; i++) { const t = thorn(pr * 0.5, pr * 0.13, barb, 0.2, 4); setOn(t, new THREE.Vector3(palm.position.x + (i - 1.5) * 0.45 * pr * -ox, palm.position.y - pr * 0.75, palm.position.z - pr * 0.36), new THREE.Vector3(0, -0.4, -1), new THREE.Vector3(0, 1, 0)); wr.add(t); }
  return g;
}
/** A great fur mantle over the shoulders, deep and shaggy: heaped on the shoulders and up round the neck, hanging down
 *  the upper back and over the tops of the arms, parted down the front over the coat; optionally a high band collar
 *  round the neck and straps across the coat below it. Fitted to the figure's own torso (its rings), so it sits on any
 *  frame. */
export interface Mantle { fur: string; collar?: string; straps?: string }
export function furMantle(g: THREE.Group, recipe: HeroFigure, o: Mantle): THREE.Group {
  const j = (g.userData.joints ?? {}) as Record<string, THREE.Object3D>, up = j.chest, neck = j.neck; if (!up || !neck) return g;
  const s = neck.position.y / 2.24, fr = frameFor(recipe), tr = torsoRings(fr), nr = neckRings(fr), lift = neckLift(fr);
  const ramp = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); }, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  // the torso from below the shoulder blades to the root of the neck, then up the neck (in the chest's frame)
  const top = 2.48 + lift * 0.5, rings = [...clipRings(tr, 1.18, 2.3), ...[2.38, top].map((y) => ({ ...ringAt(nr, y - 2.24), y }))];
  // the fur lies in three rows of locks, each row over the one below like shingles: every lock a rounded ridge running
  // down to a point, no two the same length, the rows staggered, the whole lower behind than in front
  const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const ROWS = [{ y: 1.34, n: 23, d: 0.36, L: 0.2 }, { y: 1.64, n: 20, d: 0.44, L: 0.18 }, { y: 1.94, n: 17, d: 0.5, L: 0.16 }];
  const opening = (y: number) => 0.42 + 0.45 * (1 - ramp((y - 1.4) / 0.8));
  const depth = (th: number, y: number) => {
    let d = 0;
    ROWS.forEach((r, k) => {
      const v = (th / (Math.PI * 2)) * r.n + k * 0.37 + 0.15 * Math.sin(3 * th + k), i = Math.floor(v), u = v - i, tip = (1 - Math.abs(2 * u - 1)) ** 0.8;
      const lo = r.y + (0.12 - 0.03 * k) * Math.cos(th) - r.L * (0.6 + 0.8 * hash(i * 7 + k)) * tip;
      d = Math.max(d, r.d * ramp((y - lo) / 0.1) * (0.82 + 0.18 * Math.sin(Math.PI * u)) * (1 + 0.05 * Math.sin(6 * Math.PI * u) + 0.08 * Math.sin(9 * y + 5 * th)));
    });
    return d * (1 - 0.45 * ramp((y - 2.12) / 0.3)) * ramp((Math.abs(wrap(th)) - opening(y)) / 0.3);
  };
  // where there is no fur its skin sinks just under the coat, out of sight
  const shell = loftGeometry(rings, s, { seg: 208, rows: 60, bump: (th, y) => { const r = ringAt(rings, y), [px, pz] = ringPoint(r, th, 1); return (depth(th, y) - 0.03) / Math.hypot(px - (r.x ?? 0), pz - (r.z ?? 0)); } });
  up.add(new THREE.Mesh(shell, smooth(o.fur)));
  if (o.collar) { // a high band collar standing close round the neck, inside the fur
    const c = ringAt(nr, 0.05), band = { ...c, w: c.w * 1.18, f: c.f * 1.18, b: c.b * 1.18 };
    up.add(new THREE.Mesh(loftGeometry([{ ...band, y: 2.14 }, { ...band, y: 2.5 + lift * 0.5 }], s, { seg: 28, rows: 2 }), smooth(o.collar)));
  }
  if (o.straps) for (const y of [0.78, 1.0, 1.22]) { const r = ringAt(tr, y); up.add(new THREE.Mesh(loftGeometry([{ ...r, y: y - 0.035 }, { ...r, y: y + 0.035 }], s, { seg: 32, k: 1.035, rows: 1 }), mat(o.straps))); }
  return g;
}
/** A recipe with its dead pose resolved (kit/poses.ts names, the rig's own presets, or one picked by the seed). */
export function withDeadPose<T extends { deadPose?: unknown }>(r: T, seed: string): Omit<T, 'deadPose'> & { deadPose: HeroFigure['deadPose'] } {
  return { ...r, deadPose: deadPose(r.deadPose, seed) as HeroFigure['deadPose'] };
}

/** Build a people-shaped monster and fit its extras to the body's mounts. `seed` (a token's id) picks one of the
 *  creature's looks and gives that token its own face, so no two of a kind match. */
export function folk(base: Folk, size: CreatureSize = 'medium', state: FigState = false, seed = '', key = ''): THREE.Group {
  const dead = state === 'dead', battle = state === true || state === 'battle', hsh = hashOf(key + seed), looks = LOOKS[key];
  let r: Folk = looks && seed ? { ...base, ...looks[hsh % looks.length], extra: base.extra } : base;
  if (r.face) r = { ...r, face: seedFace(key + seed + (looks && seed ? hsh % looks.length : ''), r.face) };
  if (r.vary && seed) { const k = ((hsh >>> 8) % 7) - 3; r = { ...r, hair: r.face?.bald ? r.hair : (r.face?.age ?? 0) > 0.7 ? r.hair : HAIR[(hsh >>> 4) % HAIR.length], beard: r.beard && HAIR[(hsh >>> 4) % HAIR.length], cloth: shift(r.cloth, k), skirt: shift(r.skirt, k), cloak: shift(r.cloak, -k), hairStyle: r.hairStyle ?? (['short', 'short', 'long', 'curly'] as const)[(hsh >>> 12) % 4], height: (r.height ?? 1) * (0.94 + ((hsh >>> 16) % 13) / 100) }; }
  const { extra, size: own, vary: _v, ...recipe } = r, sz = own ?? size, s = (SCALE[sz] ?? 1) * (r.height ?? 1), spirit = !!extra?.ghost; void _v;
  if (dead && key === 'skeleton') return mon.bonePile(s);
  // a winged body falls on its face, the wings spread over it (on its back it would lie on them, its arms across them)
  const fell = extra?.wings && !recipe.deadPose ? { ...recipe, deadPose: 'prone' as const } : recipe;
  const g = heroFigure(posed(dead && !spirit ? withDeadPose(fell, key + seed) : recipe) as HeroFigure, sz, dead ? (spirit ? 'rest' : 'dead') : battle), j = (g.userData.joints ?? {}) as Record<string, THREE.Object3D>;
  if (extra?.head && j.head) {
    const b = beast(extra.head, dead ? 'dead' : battle ? 'snarl' : 'stand'), h = (b.userData.joints as Record<string, THREE.Object3D>).head;
    if (h) { j.head.clear(); const k = (0.62 * s) / extra.head.skull; h.removeFromParent(); h.position.set(0, 0.3 * s, 0.02 * s); h.rotation.set(0.25, 0, 0); h.scale.setScalar(k); j.head.add(h); }
  }
  if (extra?.beak && j.head) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.5 * s, 6), (mon.horn(0.1, 0.01, extra.beak).material as THREE.Material)); c.rotation.x = Math.PI / 2 + 0.25; c.position.set(0, 0.3 * s, 0.5 * s); j.head.add(c); }
  if (extra?.horns && j.head) for (const sx of [-1, 1]) { const h = mon.horn(extra.horns.len * s, 0.045 * s, extra.horns.color, extra.horns.curl ?? 0.6); h.position.set(sx * 0.24 * s, 0.66 * s, 0.02 * s); h.rotation.z = -sx * 0.35; j.head.add(h); }
  if (extra?.wings && j.back) { const w = mon.wings(extra.wings.kind, extra.wings.span * s, extra.wings.color, { spread: dead ? 0.9 : extra.wings.spread ?? (battle ? 1 : 0.45), lift: dead ? 0 : battle ? 0.5 : 0.2, membrane: extra.wings.membrane }); w.position.set(0, 0.25 * s, -0.12 * s); j.back.add(w); }
  if (extra?.tail && j.hips) { const L = extra.tail.len * s; j.hips.add(mon.tailOf([V(0, 0, -0.15 * s), V(0, -0.25 * L, -0.4 * L), V(0.1 * L, -0.5 * L, -0.75 * L), V(0.2 * L, -0.3 * L, -L)], 0.07 * s, extra.tail.color, extra.tail.tip)); }
  if (extra?.ghost) mon.spectral(g, extra.ghost, (extra.opacity ?? 0.5) * (dead ? 0.5 : 1));
  if (!dead) return g;
  if (spirit) return mon.felled(g, 'flat');                                                        // a spirit does not fall; it pools and thins
  return (r.fangs || r.face?.fangs) && !extra?.head && (posed(withDeadPose(fell, key + seed)).deadPose as HeroPose | undefined)?.lie === 'back' ? staked(g) : g;
}

/** A face of its own for someone the module never drew: sliders spread from the id, so no two commoners match. */
export function seedFace(id: string, base: FaceSpec = {}): FaceSpec {
  let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (((h ^= h >>> 16) >>> 0) / 4294967295) * 1.2 - 0.6; };
  return { headW: r() * 0.6, headL: r() * 0.6, jaw: r(), chin: r(), cheekbones: r(), gaunt: r() * 0.6, noseLen: r(), noseW: r(), noseHook: r(), browRidge: r(), browThick: r(), browAngle: r() * 0.7, eyeSize: r() * 0.5, eyeSpace: r() * 0.5, mouthW: r(), lipFull: r(), smile: r() * 0.5, ...base };
}

// ---------------------------------------------------------------------------------------------------- shared looks
const DEAD: FaceSpec = { gaunt: 0.9, sunken: 0.9, cheekbones: 0.7, bags: 0.7, lipFull: -0.8, smile: -0.4, teeth: true, browAngle: -0.3 };
const SKULL: FaceSpec = { gaunt: 1, sunken: 1, cheekbones: 1, jaw: 0.3, noseLen: -1, noseW: -0.6, lipFull: -1, teeth: true, bald: true, browRidge: 0.6, shadow: '#141014' };
const FERAL: FaceSpec = { gaunt: 0.7, sunken: 0.6, cheekbones: 0.8, browAngle: 0.9, browRidge: 0.5, eyeSize: 0.2, mouthW: 0.5, fangs: true, teeth: true, smile: -0.6, veins: '#6a6a8a' };
const HAG: FaceSpec = { jaw: -0.2, chin: 0.7, chinPoint: 0.9, cheekbones: 0.6, gaunt: 0.8, noseLen: 1, noseHook: 1, noseTip: 0.6, browRidge: 0.7, browAngle: 0.6, sunken: 0.8, bags: 0.8, mouthW: 0.6, lipFull: -0.8, teeth: true, age: 1, warts: true };
const STERN: FaceSpec = { jaw: 0.6, chin: 0.4, browRidge: 0.5, browAngle: 0.6, lipFull: -0.3, smile: -0.4 };
const w = (kind: WeaponSpec['kind'], o: Partial<WeaponSpec> = {}): WeaponSpec => ({ kind, ...o });
const RUSTY = { metal: '#6a5a4a', fittings: '#4a3a2a', wear: 0.9 };
const GHOSTLY = '#b8d0e8';

/** People-shaped monsters and the stock townsfolk, by creature id. */
export const FOLK: Record<string, Folk> = {
  // ---- the walking dead
  zombie: { skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', boots: '#2a2620', hair: '#5a5a50', tattered: true, markings: '#4a5a44', eyes: '#d8d8c0', face: { ...DEAD, bags: 1 }, pose: 'shamble', battlePose: 'shamble' },
  'strahd-zombie': { skin: '#7f8f84', cloth: '#3a2e2a', trim: '#5a1a22', boots: '#1e1a18', armor: { kind: 'mail', color: '#4a4a50' }, tattered: true, markings: '#3a4a44', eyes: '#c8e0d0', face: { ...DEAD, bald: true, scars: ['across'] }, pose: 'shamble', battlePose: 'menace' },
  ghoul: { skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', boots: '#8a9a7c', eyes: '#e8e070', build: 'lean', face: { ...FERAL, bald: true, veins: '#4a5a44' }, pose: 'hunched', battlePose: 'feral' },
  ghast: { skin: '#6f7f68', cloth: '#2a2420', trim: '#1a171d', boots: '#6f7f68', eyes: '#f0a040', tattered: true, cloak: '#1e1a1e', face: { ...FERAL, bald: true, noseLen: -0.6, veins: '#3a4a34' }, pose: 'hunched', battlePose: 'feral' },
  skeleton: { skin: '#d9d2c0', cloth: '#d9d2c0', trim: '#c8c0ac', boots: '#d9d2c0', eyes: '#17120e', build: 'lean', height: 0.97, face: SKULL, gear: { handR: w('shortsword', RUSTY), back: w('shortbow', { grip: '#4a3a2a' }) }, pose: 'rest', battlePose: 'slash' },
  wight: { skin: '#c8ccd2', cloth: '#3a3a4a', trim: '#2a2a34', boots: '#1e1e24', hair: '#9a9aa0', hairStyle: 'long', armor: { kind: 'mail', color: '#5a5a66', trim: '#8a8a94' }, cloak: '#2a2630', tattered: true, eyes: '#9ae0ff', face: { ...DEAD, browAngle: 0.8, age: 0.6 }, gear: { handR: w('longsword', { metal: '#8a9098', fittings: '#4a4a52', wear: 0.6 }), back: w('longbow') }, pose: 'behind-back', battlePose: 'overhead' },
  'vampire-spawn': { skin: '#d8d3d0', cloth: '#2a1a22', trim: '#1a171d', boots: '#141216', hair: '#1a1a1a', hairStyle: 'long', shirt: '#b8b0a8', tattered: true, eyes: '#e02a2a', fangs: true, face: { ...FERAL, age: 0.1 }, pose: 'hunched', battlePose: 'feral' },
  revenant: { skin: '#8a9a8c', cloth: '#3a3b40', trim: '#4d1119', boots: '#1e1e22', hair: '#6a6a6a', armor: { kind: 'plate', color: '#55585e', trim: '#8a2a2a' }, cloak: '#3a1218', tattered: true, eyes: '#ff5a2a', face: { ...DEAD, ...STERN, scars: ['cheekL', 'browR'] }, gear: { handR: w('longsword', { metal: '#9aa0a8', fittings: '#6a2a2a', wear: 0.5 }) }, pose: 'behind-back', battlePose: 'overhead' },
  // ---- spirits
  ghost: { skin: '#cfd6e0', cloth: '#cfd6e8', trim: '#b8c4d8', hair: '#e0e4ec', hairStyle: 'long', skirt: '#cfd6e8', eyes: '#ffffff', face: { ...DEAD, browAngle: -0.8, teeth: false }, pose: 'wringing', battlePose: 'haunt', extra: { ghost: GHOSTLY, opacity: 0.45 } },
  specter: { skin: '#aab4c4', cloth: '#8a94a8', trim: '#6a7488', cloak: '#7a8498', hood: true, tattered: true, skirt: '#8a94a8', eyes: '#ffffff', face: { ...SKULL }, pose: 'haunt', battlePose: 'haunt', extra: { ghost: '#a8b8d0', opacity: 0.4 } },
  poltergeist: { skin: '#c8d0dc', cloth: '#b8c4d8', trim: '#9aa8c0', eyes: '#ffffff', face: { ...DEAD, smile: 0.8, browAngle: 0.8 }, pose: 'haunt', battlePose: 'menace', extra: { ghost: '#c8d8f0', opacity: 0.16 } },
  wraith: { skin: '#141018', cloth: '#141018', trim: '#1e1826', cloak: '#17121c', hood: true, tattered: true, skirt: '#141018', eyes: '#b070ff', face: SKULL, pose: 'haunt', battlePose: 'menace', hoverFt: 0.8, extra: { ghost: '#2a1e3a', opacity: 0.78 } },
  shadow: { skin: '#0c0a10', cloth: '#0c0a10', trim: '#0c0a10', boots: '#0c0a10', eyes: '#e8e8ff', build: 'lean', face: { gaunt: 0.6, bald: true, lipFull: -1 }, pose: 'hunched', battlePose: 'feral', extra: { ghost: '#0c0a10', opacity: 0.82 } },
  banshee: { skin: '#c8d8d8', cloth: '#b8d0cc', trim: '#9ab8b4', hair: '#e8f0f0', hairStyle: 'long', ears: 'pointed', skirt: '#b8d0cc', tattered: true, eyes: '#ffffff', build: 'curvy', face: { ...DEAD, mouthW: 0.9, browAngle: -0.9, cheekbones: 0.9 }, pose: 'wringing', battlePose: 'haunt', extra: { ghost: '#b8e8dc', opacity: 0.5 } },
  'phantom-warrior': { skin: '#cfd6e0', cloth: '#b8c4d8', trim: '#9aa8c0', armor: { kind: 'plate', color: '#c0cce0', trim: '#e0e8f4' }, eyes: '#ffffff', face: { ...STERN, gaunt: 0.5 }, gear: { handR: w('longsword', { metal: '#d8e4f4' }) }, offhand: { kind: 'shield', color: '#b8c4d8', rim: '#e0e8f4' }, pose: 'rest', battlePose: 'shield', extra: { ghost: GHOSTLY, opacity: 0.5 } },
  'invisible-stalker': { skin: '#d8e8f4', cloth: '#d8e8f4', trim: '#d8e8f4', boots: '#d8e8f4', build: 'broad', height: 1.15, face: { bald: true, browAngle: 0.8 }, pose: 'haunt', battlePose: 'menace', extra: { ghost: '#e0f0ff', opacity: 0.12 } },
  // ---- hags, witches, the cursed
  'night-hag': { skin: '#4a3a5a', cloth: '#2a2420', trim: '#1e1a18', boots: '#4a3a5a', hair: '#1a1620', hairStyle: 'long', tattered: true, skirt: '#2a2420', eyes: '#ffb030', markings: '#2a1e3a', face: { ...HAG, fangs: true }, pose: 'hunched', battlePose: 'curse', glow: '#8a40c0', extra: { horns: { len: 0.55, color: '#2a2030', curl: 0.8 } } },
  'barovian-witch': { vary: true, skin: '#d0b89c', cloth: '#221e24', trim: '#5b4a6b', boots: '#17141a', hair: '#1a1a1a', hairStyle: 'long', skirt: '#221e24', cloak: '#1e1a20', hood: true, tattered: true, eyes: '#7ad060', face: { noseHook: 0.7, noseLen: 0.6, browAngle: 0.6, chinPoint: 0.6, age: 0.5, warts: true }, gear: { handR: w('quarterstaff', { grip: '#3a2e22' }), beltL: w('dagger') }, pose: 'leaning', battlePose: 'curse', glow: '#7ad060' },
  mongrelfolk: { skin: '#a67c5b', cloth: '#5a4a3a', trim: '#55603a', boots: '#a67c5b', hair: '#3a2a1a', hairStyle: 'curly', tattered: true, eyes: '#d8c040', markings: '#6a8a4a', face: { headW: 0.5, jaw: 0.8, noseW: 0.9, noseLen: -0.5, eyeSpace: 0.9, eyeSize: 0.5, browRidge: 0.9, mouthW: 0.9, teeth: true, fangs: true, warts: true }, gear: { handR: w('club') }, pose: 'hunched', battlePose: 'brawl', extra: { tail: { len: 2.2, color: '#8a6a4a' } } },
  werewolf: { skin: '#6a5a48', cloth: '#4a3e30', trim: '#3a3026', boots: '#6a5a48', build: 'broad', height: 1.12, tattered: true, eyes: '#f0c030', pose: 'hunched', battlePose: 'feral', extra: { head: { ...BEASTS['dire-wolf'], coat: '#6a5a48', under: '#8a7a64' }, tail: { len: 2.4, color: '#6a5a48' } } },
  wereraven: { skin: '#1e1c24', cloth: '#1a1a22', trim: '#3a3b40', boots: '#2a2a30', hair: '#141218', cloak: '#17161c', eyes: '#e8e0c0', face: { noseLen: 1, noseHook: 0.6, eyeSize: 0.3, browAngle: 0.2 }, gear: { beltL: w('shortsword'), back: w('shortbow') }, pose: 'arms-folded', battlePose: 'menace', extra: { beak: '#2a2a30', wings: { kind: 'feather', span: 3.4, color: '#17161c' } } },
  druid: { vary: true, skin: '#c8a888', cloth: '#4a5a3a', trim: '#2f4a3a', boots: '#3a2e22', hair: '#8a5a2a', hairStyle: 'long', beard: '#8a5a2a', cloak: '#3a4a2e', tattered: true, markings: '#2a4a8a', eyes: '#6ac060', face: { beard: 'long', browThick: 0.8, browAngle: 0.5, gaunt: 0.4 }, gear: { handR: w('quarterstaff', { grip: '#4a3a26' }) }, pose: 'leaning', battlePose: 'staff-raised', glow: '#6ac060' },
  berserker: { vary: true, skin: '#c99a72', cloth: '#7a6a55', trim: '#5a4632', boots: '#4a3a2a', hair: '#3a2a1a', hairStyle: 'braids', beard: '#3a2a1a', build: 'broad', height: 1.08, bracers: '#4a3a2a', markings: '#2a4a8a', cloak: '#6a5a48', face: { jaw: 0.9, browRidge: 0.8, browAngle: 0.9, beard: 'full', teeth: true, scars: ['cheekR'] }, gear: { handR: w('greataxe', { wear: 0.4 }) }, pose: 'hands-on-hips', battlePose: 'overhead' },
  // ---- made things
  scarecrow: { skin: '#a08a5a', cloth: '#6a5a3a', trim: '#5a4a3a', boots: '#8a7a4a', hair: '#c8a850', hairStyle: 'short', tattered: true, eyes: '#ff9a20', build: 'lean', height: 1.05, face: { noseLen: -0.8, eyeSize: 0.6, mouthW: 1, smile: 0.9, teeth: true, scars: ['across'], bald: true }, pose: 'shamble', battlePose: 'menace' },
  gargoyle: { skin: '#5a6068', cloth: '#5a6068', trim: '#4b5560', boots: '#5a6068', eyes: '#d8c040', build: 'broad', face: { jaw: 0.9, chin: 0.8, browRidge: 1, browAngle: 1, noseW: 0.8, noseHook: 0.6, mouthW: 0.9, fangs: true, teeth: true, bald: true }, pose: 'hunched', battlePose: 'feral', extra: { wings: { kind: 'bat', span: 3.6, color: '#4b5560', membrane: '#5a6068' }, horns: { len: 0.6, color: '#3a424a' }, tail: { len: 2.4, color: '#4b5560', tip: 'spike' } } },
  'animated-armor': { skin: '#2b2c31', cloth: '#3a3b42', trim: '#2b2c31', boots: '#55585e', armor: { kind: 'plate', color: '#6a6e76', trim: '#9aa0a8' }, gauntlets: '#6a6e76', eyes: '#17141a', face: { bald: true, lipFull: -1, noseLen: -1, shadow: '#0a0a0c' }, gear: { handR: w('longsword', { metal: '#9aa0a8' }) }, pose: 'rest', battlePose: 'overhead' },
  'shield-guardian': { size: 'large', skin: '#6a5a48', cloth: '#5a4a3a', trim: '#8a6a3a', boots: '#6a6e76', armor: { kind: 'plate', color: '#7a7260', trim: '#b89a4a' }, gauntlets: '#7a7260', pendant: '#c8a040', eyes: '#ffb030', build: 'broad', face: { bald: true, jaw: 1, browRidge: 1, lipFull: -1, noseLen: -0.6 }, pose: 'rest', battlePose: 'brawl' },
  'amber-golem': { size: 'large', skin: '#c9822e', cloth: '#c9822e', trim: '#a8681e', boots: '#c9822e', eyes: '#fff0a0', build: 'broad', face: { bald: true, jaw: 1, browRidge: 1, noseW: 0.8, noseLen: -0.4, mouthW: 0.8, fangs: true }, pose: 'hands-on-hips', battlePose: 'brawl', glow: '#ffb030' },
  'flesh-golem-the-abbots': { skin: '#a8a890', cloth: '#5a4a3a', trim: '#3a3026', boots: '#a8a890', hair: '#2a2420', build: 'broad', height: 1.2, tattered: true, markings: '#6a3a3a', eyes: '#d8d8a0', face: { jaw: 1, browRidge: 1, sunken: 0.7, scars: ['across', 'cheekL', 'browR'], lipFull: -0.6, headL: 0.4 }, pose: 'shamble', battlePose: 'brawl' },
  'clay-golem-van-richtens-tower': { size: 'large', skin: '#9a6a4a', cloth: '#9a6a4a', trim: '#7a5238', boots: '#9a6a4a', build: 'broad', eyes: '#e8d090', face: { bald: true, jaw: 0.8, headW: 0.6, noseLen: -0.8, eyeSize: 0.4, lipFull: -1, browRidge: 0.8 }, pose: 'shamble', battlePose: 'brawl' },
  // ---- the mighty
  lich: { skin: '#c8c0a8', cloth: '#2a2440', trim: '#c9822e', boots: '#1a1626', cloak: '#1e1a30', cloakTrim: '#c9a227', hood: true, tattered: true, skirt: '#2a2440', eyes: '#40e0c0', pendant: '#c9a227', crown: { color: '#c9a227' }, face: { ...SKULL }, gear: { handR: w('quarterstaff', { grip: '#1a1626', fittings: '#c9a227', gem: '#40e0c0', glow: '#40e0c0' }) }, pose: 'leaning', battlePose: 'staff-raised', glow: '#40e0c0' },
  arcanaloth: { skin: '#a8885a', cloth: '#5a1e2a', trim: '#c9a227', boots: '#2a1a1a', skirt: '#5a1e2a', cloak: '#3a1420', cloakTrim: '#c9a227', eyes: '#ffb030', pendant: '#c9a227', offhand: { kind: 'book', color: '#2a1a3a' }, pose: 'regal', battlePose: 'spellcast', glow: '#c040e0', extra: { head: { ...BEASTS.wolf, coat: '#a8885a', under: '#d8c090', mane: 'none', skull: 0.6, muzzle: 0.7, muzzleD: 0.13 } } },
  deva: { skin: '#e8d8c0', cloth: '#f0ece0', trim: '#c9a227', boots: '#c9a227', hair: '#f0e8c8', hairStyle: 'long', skirt: '#f0ece0', halo: '#ffe8a0', eyes: '#ffe8a0', build: 'broad', height: 1.1, bracers: '#c9a227', face: { jaw: 0.4, chin: 0.4, cheekbones: 0.6, noseLen: 0.2, lipFull: 0.3, browAngle: 0.1, lashes: true }, gear: { handR: w('mace', { metal: '#e8d890', fittings: '#c9a227', glow: '#ffe8a0' }) }, pose: 'regal', battlePose: 'rebuke', glow: '#ffe8a0', extra: { wings: { kind: 'feather', span: 5.2, color: '#f4f0e4' } } },
  vrock: { size: 'large', skin: '#5a5a52', cloth: '#4a4a44', trim: '#3a3a36', boots: '#8a7a4a', build: 'broad', eyes: '#e02a2a', face: { bald: true, noseLen: 1, browRidge: 0.9, browAngle: 1, gaunt: 0.6 }, pose: 'hunched', battlePose: 'feral', extra: { beak: '#c8a040', wings: { kind: 'feather', span: 4.6, color: '#3a3a36' } } },
  quasit: { size: 'tiny', skin: '#4a7a4a', cloth: '#4a7a4a', trim: '#3a6a3a', boots: '#4a7a4a', eyes: '#ffe040', ears: 'pointed', face: { headW: 0.5, noseHook: 0.8, noseLen: 0.6, mouthW: 1, smile: 0.8, fangs: true, teeth: true, bald: true, browAngle: 1 }, pose: 'hunched', battlePose: 'feral', extra: { horns: { len: 0.5, color: '#2a4a2a', curl: 0.9 }, tail: { len: 2.6, color: '#4a7a4a', tip: 'spike' } } },
  imp: { size: 'tiny', skin: '#a02a22', cloth: '#a02a22', trim: '#7a1e1a', boots: '#a02a22', eyes: '#ffe040', ears: 'pointed', face: { chinPoint: 1, noseHook: 0.6, mouthW: 0.9, smile: 0.9, fangs: true, bald: true, browAngle: 1 }, pose: 'hands-on-hips', battlePose: 'menace', hoverFt: 1.5, extra: { horns: { len: 0.45, color: '#3a1010' }, wings: { kind: 'bat', span: 3.4, color: '#7a1e1a', spread: 1 }, tail: { len: 2.8, color: '#a02a22', tip: 'spade' } } },
  // ---- stock townsfolk and soldiers
  commoner: { vary: true, skin: '#d9b899', cloth: '#5a5246', trim: '#4a4034', boots: '#3a2e24', hair: '#3a2a1a', shirt: '#b8ac94', face: { bags: 0.5, browAngle: -0.4 }, pose: 'wringing', battlePose: 'cower' },
  'noncombatant-child': { vary: true, size: 'small', skin: '#e0c0a4', cloth: '#6a5a4a', trim: '#4a4034', boots: '#3a2e24', hair: '#5a4632', hairStyle: 'curly', face: { eyeSize: 0.8, noseLen: -0.8, jaw: -0.7, chin: -0.5, lipFull: 0.3, headW: 0.3 }, pose: 'wringing', battlePose: 'cower' },
  scout: { vary: true, skin: '#d0ac8a', cloth: '#5a4632', trim: '#2f4a3a', boots: '#3a2e22', hair: '#3a2a1a', cloak: '#2f4a3a', hood: true, bracers: '#3a2e22', face: {}, gear: { handR: w('shortsword'), back: w('longbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  guard: { vary: true, skin: '#d9b899', cloth: '#3a3b40', trim: '#7a1f2b', boots: '#2a2420', hair: '#3a2a1a', armor: { kind: 'mail', color: '#6a6e76', trim: '#7a1f2b' }, face: STERN, gear: { handR: w('spear') }, offhand: { kind: 'shield', color: '#7a1f2b', rim: '#8a8a8a' }, pose: 'rest', battlePose: 'shield' },
  priest: { vary: true, skin: '#d9b899', cloth: '#e2dccc', trim: '#c9a227', boots: '#4a3a2a', hair: '#7a7a7a', skirt: '#e2dccc', pendant: '#c9a227', face: { age: 0.6, browAngle: -0.3 }, gear: { beltR: w('mace') }, pose: 'wringing', battlePose: 'rebuke', glow: '#ffe8a0' },
  acolyte: { vary: true, skin: '#d9b899', cloth: '#cfc8b8', trim: '#b08d3a', boots: '#4a3a2a', hair: '#3a2a1a', skirt: '#cfc8b8', pendant: '#b08d3a', face: { age: 0.1 }, gear: { beltR: w('club') }, pose: 'wringing', battlePose: 'rebuke' },
  mage: { vary: true, skin: '#d9b899', cloth: '#3a3a5a', trim: '#5b4a6b', boots: '#2a2a3a', hair: '#7a7a7a', hairStyle: 'long', beard: '#7a7a7a', skirt: '#3a3a5a', cloak: '#2e2e4a', face: { beard: 'goatee', age: 0.6, browAngle: 0.4 }, gear: { handR: w('quarterstaff', { gem: '#7a9aff' }), beltL: w('dagger') }, pose: 'leaning', battlePose: 'staff-cast', glow: '#7a9aff' },
  noble: { vary: true, skin: '#d9b899', cloth: '#5a2a3a', trim: '#c9a227', boots: '#2a1e1a', hair: '#3a2a1a', shirt: '#e8e0d0', coat: { tails: '#5a2a3a', lapel: '#c9a227' }, buckle: '#c9a227', face: { browAngle: 0.3, smile: -0.2 }, gear: { beltL: w('rapier', { guard: 'basket', fittings: '#c9a227' }) }, pose: 'hands-on-hips', battlePose: 'duelist' },
  knight: { vary: true, skin: '#d9b899', cloth: '#3a3b40', trim: '#b8c4d6', boots: '#55585e', hair: '#5a4632', armor: { kind: 'plate', color: '#8a909a', trim: '#b8c4d6' }, gauntlets: '#8a909a', cloak: '#2a3a5a', face: STERN, gear: { handR: w('greatsword'), back: w('crossbow') }, pose: 'rest', battlePose: 'overhead' },
  bandit: { vary: true, skin: '#c99a72', cloth: '#5a4632', trim: '#3a3b40', boots: '#2a2420', hair: '#1a1a1a', bracers: '#3a2e22', face: { scars: ['cheekL'], beard: 'stubble', browAngle: 0.6 }, gear: { handR: w('scimitar', { wear: 0.4 }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'slash' },
  'bandit-captain': { vary: true, skin: '#c99a72', cloth: '#6a2a2a', trim: '#2a2420', boots: '#1e1a18', hair: '#1a1a1a', hairStyle: 'long', beard: '#1a1a1a', coat: { tails: '#6a2a2a', lapel: '#2a2420' }, bracers: '#2a2420', earrings: '#c9a227', face: { scars: ['browR'], moustache: 'handlebar', beard: 'goatee', smile: 0.4, eyepatch: 'L' }, gear: { handR: w('scimitar', { guard: 'basket', fittings: '#c9a227' }), beltR: w('dagger') }, pose: 'hands-on-hips', battlePose: 'duelist' },
  cultist: { vary: true, skin: '#d9b899', cloth: '#1a171d', trim: '#4d1119', boots: '#141216', skirt: '#1a171d', cloak: '#1a171d', hood: true, face: { shadow: '#2a1a22', bags: 0.6 }, gear: { handR: w('scimitar', { wear: 0.3 }) }, pose: 'wringing', battlePose: 'slash' },
  'cult-fanatic': { vary: true, skin: '#d9b899', cloth: '#2a1a1a', trim: '#4d1119', boots: '#141216', skirt: '#2a1a1a', cloak: '#2a1418', cloakTrim: '#8a1a22', hood: true, pendant: '#8a1a22', markings: '#8a1a22', face: { browAngle: 0.9, eyeSize: 0.5, gaunt: 0.6, smile: 0.5, teeth: true }, gear: { handR: w('dagger', { glow: '#8a1a22' }) }, pose: 'wringing', battlePose: 'curse', glow: '#c02030' },
  assassin: { vary: true, skin: '#c99a72', cloth: '#1a1a22', trim: '#3a3b40', boots: '#141216', hair: '#1a1a1a', cloak: '#17161c', hood: true, bracers: '#2a2a30', vials: ['#6ac060', '#8a40c0'], face: { browAngle: 0.5, lipFull: -0.5, scars: ['lip'] }, gear: { handR: w('shortsword', { metal: '#7a9a7a' }), beltR: w('dagger'), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  spy: { vary: true, skin: '#d9b899', cloth: '#3a3a3a', trim: '#3a3b40', boots: '#1e1a18', hair: '#3a2a1a', cloak: '#2a2a2e', hood: true, face: { smile: 0.2 }, gear: { beltL: w('shortsword'), beltR: w('dagger') }, pose: 'behind-back', battlePose: 'duelist' },
  thug: { vary: true, skin: '#c99a72', cloth: '#5a4632', trim: '#3a3b40', boots: '#2a2420', hair: '#1a1a1a', build: 'broad', bracers: '#3a2e22', face: { jaw: 0.9, noseW: 0.8, noseHook: -0.4, browRidge: 0.8, beard: 'stubble', scars: ['browL'] }, gear: { handR: w('mace', { wear: 0.5 }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'brawl' },
  veteran: { vary: true, skin: '#d9b899', cloth: '#3a3b40', trim: '#5a4632', boots: '#2a2420', hair: '#7a7a7a', beard: '#7a7a7a', armor: { kind: 'mail', color: '#6a6e76', trim: '#5a4632' }, cloak: '#4a3a2a', face: { ...STERN, age: 0.6, scars: ['cheekR', 'browL'], beard: 'full' }, gear: { handR: w('longsword', { wear: 0.3 }), beltL: w('shortsword'), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'overhead' },
  // ---- the module's own stock figures
  'vistani-bandit': { vary: true, skin: '#c99a72', cloth: '#6a2a3a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'long', shirt: '#e0d4b8', earrings: '#c9a227', bracers: '#3a2420', face: { moustache: 'thick', browAngle: 0.5 }, gear: { handR: w('shortsword', { guard: 'curved' }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'slash' },
  'vistani-thug': { vary: true, skin: '#c99a72', cloth: '#3a4a5a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'curly', build: 'broad', shirt: '#e0d4b8', earrings: '#c9a227', face: { jaw: 0.8, beard: 'chops', browRidge: 0.6 }, gear: { handR: w('mace'), back: w('crossbow') }, pose: 'hands-on-hips', battlePose: 'brawl' },
  'dusk-elf': { vary: true, skin: '#a67c5b', cloth: '#2a2a3a', trim: '#5b4a6b', boots: '#1e1a22', hair: '#1a1a1a', hairStyle: 'long', ears: 'pointed', cloak: '#3a3a4a', hood: true, build: 'lean', face: { cheekbones: 0.8, jaw: -0.4, chinPoint: 0.5, eyeSlant: 0.7, noseW: -0.5, browAngle: -0.4, lipFull: -0.2, gaunt: 0.3 }, gear: { beltL: w('longsword'), back: w('longbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  'barovian-generic': { vary: true, skin: '#d9b899', cloth: '#4a4a44', trim: '#5a4632', boots: '#2a2420', hair: '#3a2a1a', shirt: '#a89c84', face: { bags: 0.6, browAngle: -0.5, smile: -0.5 }, pose: 'wringing', battlePose: 'cower' },
  'vistana-generic': { vary: true, skin: '#c99a72', cloth: '#6a3a5a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'long', shirt: '#e0d4b8', earrings: '#c9a227', skirt: '#7a2a3a', face: { smile: 0.4 }, pose: 'hands-on-hips', battlePose: 'cower' },
};

/** Several looks for one kind of creature; a token's id picks which. Each replaces part of the creature's recipe. */
export const LOOKS: Record<string, Partial<Folk>[]> = {
  // who they were before they were turned
  'vampire-spawn': [
    { },                                                                                                                  // a villager in what they were buried in
    { cloth: '#4a1626', trim: '#2a0e16', skirt: '#4a1626', hair: '#8a2a1a', hairStyle: 'long', build: 'curvy', pendant: '#c9a227', earrings: '#c9a227', shirt: undefined, face: { ...FERAL, cheekbones: 1, lipFull: 0.6, lashes: true, shadow: '#3a1a2a' }, pose: 'regal' },   // a noblewoman
    { cloth: '#3a3b40', trim: '#5a1a22', hair: '#3a2a1a', hairStyle: 'short', armor: { kind: 'mail', color: '#55585e', trim: '#5a1a22' }, build: 'broad', face: { ...FERAL, jaw: 0.8, scars: ['cheekL', 'browR'] }, gear: { beltL: { kind: 'longsword', wear: 0.6 } }, pose: 'arms-folded', battlePose: 'menace' },   // a guardsman
    { cloth: '#3a3226', trim: '#2a241c', hair: '#5a4632', hairStyle: 'long', beard: '#5a4632', cloak: '#2a2a22', hood: true, bracers: '#2a241c', satchel: '#4a3a2a', face: { ...FERAL, beard: 'full', age: 0.4 }, pose: 'hunched' },   // an adventurer who did not leave
    { cloth: '#2a2630', trim: '#141216', hair: '#c8c0b0', hairStyle: 'short', shirt: '#d8d0c0', coat: { tails: '#2a2630', lapel: '#4a1a22' }, buckle: '#b8952e', face: { ...FERAL, age: 0.7, moustache: 'thin', gaunt: 0.9 }, pose: 'behind-back', battlePose: 'vampire-lord' },   // an old burgher
    { cloth: '#b8b0a0', trim: '#8a8474', skirt: '#b8b0a0', hair: '#1a1a1a', pendant: '#8a8474', markings: '#6a1a1a', face: { ...FERAL, bald: true, sunken: 1 }, pose: 'wringing' },   // a priest, the robe stained
    { size: 'small', cloth: '#5a4a4a', trim: '#3a3030', hair: '#c8a850', hairStyle: 'curly', face: { ...FERAL, eyeSize: 0.9, jaw: -0.6, noseLen: -0.7, smile: 0.7 }, pose: 'rest' },   // a child
  ],
  zombie: [
    { }, { cloth: '#5a3a3a', skirt: '#5a3a3a', hair: '#8a8478', hairStyle: 'long', face: { ...DEAD, age: 0.8 } }, { cloth: '#3a4a4a', armor: { kind: 'mail', color: '#4a4a44' }, face: { ...DEAD, bald: true, scars: ['across'] }, battlePose: 'menace' },
    { cloth: '#6a5a3a', build: 'broad', hair: '#2a2018', beard: '#2a2018', face: { ...DEAD, beard: 'full', jaw: 0.8 } },
  ],
  ghoul: [{ }, { skin: '#9a9a8a', hair: '#3a3a30', hairStyle: 'long', face: { ...FERAL } }, { skin: '#7a8a80', build: 'broad', face: { ...FERAL, bald: true, jaw: 0.9, scars: ['lip'] } }],
  'strahd-zombie': [{ }, { armor: { kind: 'plate', color: '#4a4a50', trim: '#5a1a22' }, face: { ...DEAD, bald: true } }, { cloak: '#3a1218', face: { ...DEAD, scars: ['cheekR'], bald: true } }],
  skeleton: [{ }, { gear: { handR: { kind: 'spear', ...RUSTY } }, battlePose: 'thrust' }, { gear: { handR: { kind: 'battleaxe', ...RUSTY } }, battlePose: 'windup' }],
  mongrelfolk: [
    { }, { skin: '#8a8a6a', extra: undefined, ears: 'pointed', face: { headW: -0.4, noseLen: 1, noseHook: 0.8, eyeSize: -0.5, eyeSpace: -0.8, mouthW: 0.4, fangs: true }, pose: 'wringing', battlePose: 'cower' },
    { skin: '#b89a7a', build: 'broad', hair: '#c8a850', face: { jaw: 1, browRidge: 1, noseW: 1, eyeSize: 0.9, eyeSpace: 1, teeth: true, bald: true, warts: true }, battlePose: 'menace' },
    { skin: '#7a6a5a', hairStyle: 'long', markings: '#3a5a3a', face: { headL: 0.8, jaw: -0.6, chinPoint: 0.8, noseLen: -0.9, eyeSize: 0.7, mouthW: 1, smile: 0.8, teeth: true } },
  ],
  'barovian-witch': [{ }, { hair: '#8a2a1a', hood: false, face: { noseHook: 0.3, browAngle: 0.7, age: 0.1, lipFull: 0.5, shadow: '#3a1a3a' } }, { hair: '#c8c0b0', face: { noseHook: 1, noseLen: 0.9, chinPoint: 0.9, age: 1, warts: true, teeth: true }, pose: 'hunched' }],
};

// ------------------------------------------------------------------------------------- beasts and stranger things
const b = (id: string, rest: BeastPoseName, fight: BeastPoseName) => (battle: boolean, dead = false) => beast(BEASTS[id], dead ? 'dead' : battle ? fight : rest);
/** A rider seated on a mount's saddle. */
export function mounted(mount: BeastSpec, pose: BeastPoseName, rider: HeroFigure): THREE.Group {
  const g = beast(mount, pose), saddle = (g.userData.joints as Record<string, THREE.Object3D>).saddle;
  const r = heroFigure(rider, 'medium', false); (saddle ?? g).add(r); if (!saddle) r.position.y = mount.height;
  return g;
}
const BONE_HORSE: BeastSpec = { ...BEASTS['riding-horse'], coat: '#d8d0bc', under: '#c0b8a4', maneColor: '#8a8478', eyes: '#70e0ff', glow: true, gaunt: 1, mane: 'none', tail: 'whip', saddle: { seat: '#3a2e26', trim: '#6a6a6a' } };

/** Every creature that is not people-shaped, by id: how it stands, and how it looks in initiative. */
export const MENAGERIE: Record<string, (battle: boolean, dead?: boolean) => THREE.Group> = {
  wolf: b('wolf', 'stand', 'snarl'), 'dire-wolf': b('dire-wolf', 'stand', 'snarl'), mastiff: b('mastiff', 'stand', 'snarl'), 'hell-hound': b('hell-hound', 'snarl', 'pounce'),
  'black-cat': b('black-cat', 'stand', 'snarl'), 'saber-toothed-tiger': b('saber-toothed-tiger', 'stand', 'pounce'),
  'riding-horse': b('riding-horse', 'stand', 'rear'), 'draft-horse': b('draft-horse', 'stand', 'rear'), nightmare: b('nightmare', 'walk', 'rear'),
  beucephalus: (battle, dead) => beast(BEUCEPHALUS, dead ? 'dead' : battle ? 'rear' : 'walk'),
  'skeletal-rider': (battle, dead) => dead ? mon.bonePile(1.6) : mounted(BONE_HORSE, battle ? 'gallop' : 'walk', posed({ ...FOLK.skeleton, extra: undefined, gear: { handR: w('longsword', RUSTY) }, pose: battle ? 'ride-charge' : 'ride' }) as HeroFigure),
  bat: (battle) => mon.flyer(mon.FLYERS.bat, battle ? 'dive' : 'flap', 2.5), raven: (battle) => mon.flyer(mon.FLYERS.raven, battle ? 'dive' : 'perch', battle ? 2.5 : 0),
  roc: (battle) => mon.flyer(mon.FLYERS.roc, battle ? 'dive' : 'glide', 6),
  'swarm-of-bats': () => mon.swarmOf('bats'), 'swarm-of-ravens': () => mon.swarmOf('ravens'), 'swarm-of-rats': () => mon.swarmOf('rats', 12), 'swarm-of-insects': () => mon.swarmOf('insects', 16),
  'giant-spider': (battle) => mon.spider(1.6, '#2a2420', '#8a1a1a', battle ? 0.6 : 0),
  'red-dragon-wyrmling': (battle) => mon.dragon({ coat: '#a02a22', under: '#d8a050', pose: battle ? 'snarl' : 'stand', spread: battle ? 1 : 0.4 }),
  argynvost: (battle) => mon.dragon({ scale: 3, coat: '#c8d0dc', under: '#e8ecf4', ghost: true, pose: battle ? 'rear' : 'stand', spread: 1 }),
  'twig-blight': (battle) => mon.blight('twig', { battle }), 'needle-blight': (battle) => mon.blight('needle', { battle }), 'vine-blight': (battle) => mon.blight('vine', { battle }),
  'tree-blight': (battle) => mon.blight('tree', { battle }),
  'gulthias-tree': (_b, dead) => mon.gulthiasTree(dead),
  'gray-ooze': (battle) => mon.ooze('#7a7a78', 1, { reach: battle }), mimic: (battle) => mon.mimic(battle), grick: () => mon.grick(),
  'shambling-mound': () => mon.shamblingMound(), 'lorghoth-the-decayer': () => mon.shamblingMound(1.25, '#4a4a26'),
  'will-o-wisp': () => mon.wisp(), flameskull: (_b, dead) => dead ? mon.bonePile(0.45) : mon.flameskull(), 'crawling-claw': () => mon.crawlingClaw(),
  'rug-of-smothering': (battle) => mon.rug('#6a2a2a', '#c8a040', battle ? 0.7 : 0), 'flying-sword': () => mon.flyingSword(), 'broom-of-animated-attack': (battle) => mon.broom(battle),
  'baba-lysagas-creeping-hut': (battle) => mon.creepingHut(battle), 'heart-of-sorrow': () => mon.heartOfSorrow(),
};

/** How each of those lies once it is destroyed (the builders above already handle the ones that change shape). */
const FALLS: Record<string, Parameters<typeof mon.felled>[1] | 'own'> = {
  bat: 'back', raven: 'back', roc: 'side', 'swarm-of-bats': 'scatter', 'swarm-of-ravens': 'scatter', 'swarm-of-rats': 'scatter', 'swarm-of-insects': 'scatter',
  'giant-spider': 'back', 'gray-ooze': 'flat', mimic: 'flat', 'shambling-mound': 'flat', 'lorghoth-the-decayer': 'flat', 'rug-of-smothering': 'flat', 'will-o-wisp': 'scatter',
  'crawling-claw': 'back', 'heart-of-sorrow': 'flat', 'gulthias-tree': 'own', flameskull: 'own', 'skeletal-rider': 'own',
};
/** A creature from the table above, standing, fighting or dead. */
export function creature(id: string, state: FigState): THREE.Group | undefined {
  const make = MENAGERIE[id]; if (!make) return undefined;
  if (state !== 'dead') return make(state === true || state === 'battle');
  const how = FALLS[id] ?? 'side', g = make(false, true);
  return how === 'own' ? g : mon.felled(g, how);
}
