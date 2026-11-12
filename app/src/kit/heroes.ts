// Hero figures: a player character's own miniature, built from a recipe the DM's party pack carries (core/partyPack.ts).
// Original low-poly geometry on the kit's humanoid (kit/creatures.ts), one palette material per colour, flat shading.
// The recipe is data, so no character of any one table lives in the repo: the parts are generic (pointed ears, wings,
// a halo, a thorn crown, a shield, an axe, a book ...) and the pack says which a character wears, in what colours.
import * as THREE from 'three';
import { mat, matClone } from '../render/materials';
import type { CreatureSize } from '../core/units';

export type HeroWeapon = 'none' | 'sword' | 'axe' | 'mace' | 'staff' | 'spear' | 'torch';
export type HeroOffhand = 'none' | 'shield' | 'book' | 'orb';
export type HeroHair = 'short' | 'long' | 'braids' | 'curly';
/** two-handed: a great weapon raised across the body; shield: shield up, weapon raised high; cast: the book forward, the
 *  free hand thrust out with a spell; conjure: both hands forward round a gathering spell. */
export type HeroStance = 'two-handed' | 'shield' | 'cast' | 'conjure';
/** Named poses: the four battle stances, and rest, ride (seated astride, hands on the reins), lunge, menace (arms spread,
 *  hands clawed), cower, kneel, and staff-raised (a caster with the staff high). */
export type PoseName = 'rest' | HeroStance | 'ride' | 'lunge' | 'menace' | 'cower' | 'kneel' | 'staff-raised';
export type Euler3 = [number, number, number];
/** Joint angles, radians. On x a negative angle swings forward; a negative elbow bends the forearm up, a positive knee
 *  bends the shin back. On the limbs y and z are mirrored: positive turns outward on either side. Ankles add to the
 *  automatic flat-foot correction (positive x points the toes). `hold` turns what a hand holds: upright keeps it
 *  vertical whatever the forearm does; tilt is added (mirrored). The figure is dropped until its lowest sole is on the
 *  floor, then raised by `lift` (feet); a seated pose puts the hip pivot at the origin instead. `spell` puts a glow in
 *  the right hand or between both. Fields left out stay at rest. */
export interface HeroPose {
  spine?: Euler3; neck?: Euler3;
  shoulderR?: Euler3; elbowR?: number; wristR?: Euler3; shoulderL?: Euler3; elbowL?: number; wristL?: Euler3;
  hipR?: Euler3; kneeR?: number; ankleR?: Euler3; hipL?: Euler3; kneeL?: number; ankleL?: Euler3;
  holdR?: { upright?: boolean; tilt?: Euler3 }; holdL?: { upright?: boolean; tilt?: Euler3 };
  lift?: number; seated?: boolean; spell?: 'right' | 'between';
}
export const POSES: Record<PoseName, HeroPose> = {
  rest: {},
  'two-handed': { spine: [0.06, 0.35, 0], hipL: [-0.6, 0, 0.18], kneeL: 0.8, hipR: [0.45, 0, 0.14], kneeR: 0.3,
    shoulderR: [-0.55, 0, -0.15], elbowR: -1.15, wristR: [0.1, 0, 0], shoulderL: [-0.75, 0, -0.55], elbowL: -0.95, wristL: [0.2, 0, 0], holdR: { upright: true, tilt: [0, 0, 0.75] } },
  shield: { spine: [0.1, -0.2, 0], hipL: [-0.55, 0, 0.16], kneeL: 0.75, hipR: [0.4, 0, 0.12], kneeR: 0.3,
    shoulderL: [-0.6, 0, -0.2], elbowL: -1.2, holdL: { upright: true, tilt: [0, 0.3, 0] }, shoulderR: [-2.45, 0, 0.2], elbowR: -0.75, wristR: [0.3, 0, 0], holdR: { upright: true, tilt: [0.55, 0, -0.2] } },
  cast: { spine: [0.08, 0.15, 0], hipR: [0.35, 0, 0.06], kneeR: 1.0, ankleR: [0.7, 0, 0], hipL: [-0.25, 0, 0.06], kneeL: 0.6, ankleL: [0.6, 0, 0],
    shoulderR: [-1.4, 0, 0.45], elbowR: -0.12, wristR: [1.05, 0, 0], shoulderL: [-0.35, 0, 0.15], elbowL: -1.15, holdL: { upright: true, tilt: [-0.3, 0, 0] }, lift: 0.8, spell: 'right' },
  conjure: { spine: [0.04, 0.12, 0.05], hipL: [-0.2, 0, 0], kneeL: 0.4, hipR: [0.05, 0, 0.03], kneeR: 0.05,
    shoulderR: [-1.3, 0, -0.05], elbowR: -0.55, wristR: [0.85, 0, 0], shoulderL: [-0.3, 0, 0.1], elbowL: -0.9, holdL: { upright: true, tilt: [-0.35, 0, 0] }, spell: 'right' },
  ride: { seated: true, spine: [0.05, 0, 0], hipR: [-1.45, 0, 0.4], kneeR: 1.5, hipL: [-1.45, 0, 0.4], kneeL: 1.5,
    shoulderR: [-0.7, 0, 0.05], elbowR: -0.9, shoulderL: [-0.6, 0, 0.1], elbowL: -0.9 },
  lunge: { spine: [0.25, 0.2, 0], neck: [-0.18, 0, 0], hipL: [-0.9, 0, 0.12], kneeL: 1.1, hipR: [0.7, 0, 0.1], kneeR: 0.15,
    shoulderR: [-1.5, 0, 0.1], elbowR: -0.1, shoulderL: [0.4, 0, 0.5], elbowL: -0.5 },
  menace: { spine: [0.15, 0, 0], neck: [-0.12, 0, 0], hipL: [-0.15, 0, 0.2], kneeL: 0.35, hipR: [0.15, 0, 0.2], kneeR: 0.25,
    shoulderR: [-0.6, 0, 0.9], elbowR: -0.9, wristR: [0.6, 0, 0], shoulderL: [-0.6, 0, 0.9], elbowL: -0.9, wristL: [0.6, 0, 0] },
  cower: { spine: [0.45, 0, 0], neck: [0.3, 0, 0], hipL: [-0.5, 0, 0.05], kneeL: 0.9, hipR: [-0.5, 0, 0.05], kneeR: 0.9,
    shoulderR: [-1.3, 0, -0.2], elbowR: -1.9, shoulderL: [-1.3, 0, -0.2], elbowL: -1.9 },
  kneel: { spine: [0.05, 0, 0], hipR: [-1.5, 0, 0.05], kneeR: 1.5, hipL: [0.05, 0, 0.05], kneeL: 1.5, ankleL: [0.3, 0, 0],
    shoulderR: [-0.3, 0, 0.05], elbowR: -0.5, shoulderL: [-0.2, 0, 0.1], elbowL: -0.4 },
  'staff-raised': { spine: [-0.05, 0, 0], neck: [-0.15, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: 0.4, hipR: [0.2, 0, 0.1], kneeR: 0.15,
    shoulderR: [-2.7, 0, 0.2], elbowR: -0.3, shoulderL: [-1.0, 0, 0.3], elbowL: -0.6, wristL: [0.8, 0, 0] },
};

/** A character's miniature, as the party pack writes it. Colours are CSS hex strings. */
export interface HeroFigure {
  skin?: string; hair?: string; hairStyle?: HeroHair; hairStreak?: string;
  /** Tunic / coat / armour colour, and its trim (belt, hips, legs). */
  cloth?: string; trim?: string; boots?: string;
  /** Height relative to the size's default (1 = a typical member of its size). */
  height?: number;
  ears?: 'round' | 'pointed';
  /** Plate adds heavy pauldrons and a gorget; mail a darker sleeve. */
  armor?: { kind: 'plate' | 'mail'; color: string; trim?: string };
  cloak?: string; hood?: boolean;
  /** A skirt; with an underskirt as well, a fitted gown (see gownTrim). */
  skirt?: string; underskirt?: string;
  weapon?: HeroWeapon;
  offhand?: { kind: HeroOffhand; color?: string; rim?: string; mark?: string };
  wings?: { color: string; opacity?: number; count?: 2 | 4 };
  halo?: string;
  crown?: { color: string; flower?: string };
  /** A glowing spell wisp above the off hand. */
  wisp?: string;
  /** Feet above the floor (a flier hovering). */
  hoverFt?: number;
  /** Detail: eye colour (a glow when bright), the shirt at the collar, sleeves, forearm bracers, a pendant, the belt
   *  buckle, the cloak's hem band, a satchel on a strap, a coat's tails and lapels, vials at the belt, and sparkles
   *  drifting around the figure. */
  eyes?: string; shirt?: string; sleeves?: string; bracers?: string; pendant?: string; buckle?: string;
  cloakTrim?: string; satchel?: string; coat?: { tails: string; lapel?: string }; vials?: string[]; sparkles?: string;
  /** Drop earrings, marks on the face (veins, scars, freckles of colour), and a ragged hem on the cloak. */
  earrings?: string; markings?: string; tattered?: boolean;
  /** Lip colour (default: the skin warmed toward rose); gauntlets (the hands in metal); cloak clasps; a laced bodice; puffed
   *  sleeves; the wings' rim tint; a spell glow the hands hold in a battle stance. */
  lips?: string; gauntlets?: string; clasps?: string; bodice?: { color: string; lacing?: string }; puffSleeves?: boolean;
  wingRim?: string; glow?: string;
  /** Embroidery on the gown (skirt + underskirt): its hem, the edges of its slit and its waist. A gown is fitted: hugging the
   *  hips and thighs, tight at the knee and flaring to a mermaid hem with a short train, slit up the left leg, off the
   *  shoulders above a sweetheart line; the underskirt froths at the hem. */
  gownTrim?: string;
  /** The body's line: lean (the default), broad, or curvy (a defined waist, hips and bust). */
  build?: 'lean' | 'broad' | 'curvy';
  /** The battle stance the figure takes in initiative. */
  stance?: HeroStance;
  /** The pose out of initiative (default rest) and in it (default the stance); a name or joint angles. */
  pose?: PoseName | HeroPose; battlePose?: PoseName | HeroPose;
  /** A beard (its colour), fangs, and a tall standing collar behind the head (its colour). */
  beard?: string; fangs?: boolean; collar?: string;
}

const SIZE_SCALE: Record<CreatureSize, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };

type M = THREE.Mesh;
const at = (m: M, x: number, y: number, z: number): M => { m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, c: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
const ball = (r: number, c: string, detail = 0) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(c));
const cone = (r: number, h: number, c: string, seg = 6) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c));
/** A see-through part (wings, a wisp): its own material, flagged so the token pass keeps the look. */
function glassy(m: M, c: string, opacity: number): M {
  const nm = matClone(c); nm.transparent = true; nm.opacity = opacity; nm.depthWrite = false; nm.side = THREE.DoubleSide;
  nm.flatShading = false;
  nm.userData = { ...nm.userData, keepLook: true }; // on the material too: merging by material keeps it
  m.material = nm; m.userData.keepLook = true;
  return m;
}
/** A smooth-shaded palette colour (faces, hair, draped cloth). Its faint emissive keeps it in its own bucket when a token
 *  merges its meshes by material, and the token pass reads `smooth` to keep the shading soft. */
function soft(c: string, double = false): THREE.MeshLambertMaterial {
  const m = mat(c, { emissive: double ? '#020302' : '#030303' });
  m.userData.smooth = true; if (double) m.side = THREE.DoubleSide;
  return m;
}
const sm = (g: THREE.BufferGeometry, c: string, double = false) => new THREE.Mesh(g, soft(c, double));
const sph = (r: number, c: string, w = 16, h = 12) => sm(new THREE.SphereGeometry(r, w, h), c);
const cap = (r: number, len: number, c: string) => sm(new THREE.CapsuleGeometry(r, len, 4, 10), c);
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();

/** A tube along points (embroidery, braided twigs). */
function tube(pts: THREE.Vector3[], r: number, c: string, closed = false): M {
  return sm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(12, pts.length * 4), r, 6, closed), c);
}

/** Cloth that hangs: an open cone with folds that deepen toward the hem, a pointed (handkerchief) hem, and a sway.
 *  `gap` leaves the front open (radians). Angles run from +z (the front) round through +x. */
function drape(rTop: number, rBot: number, h: number, c: string, o: { folds: number; amp: number; jag: number; sway?: number; seed?: number; gap?: number }): M {
  const gap = o.gap ?? 0;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 56, 12, true, gap / 2, Math.PI * 2 - gap);
  const p = g.attributes.position as THREE.BufferAttribute, seed = o.seed ?? 0;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (h / 2 - y) / h, th = Math.atan2(x, z);
    const k = 1 + o.amp * t * (0.7 * Math.sin(o.folds * th + seed) + 0.3 * Math.sin(o.folds * 2.3 * th + seed * 2));
    x *= k; z *= k;
    y -= o.jag * t ** 4 * Math.abs(Math.sin(o.folds * 0.5 * th + seed));
    z += (o.sway ?? 0) * t * t * rBot;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return sm(g, c, true);
}

/** The face: a smooth head (cranium, jaw, chin, cheekbones), a nose with a tip, eyes with whites, irises and pupils under a
 *  lid, brows, and lips. Replaces the kit's faceted head, its block nose and its hair cap. */
function buildFace(head: THREE.Group, s: number, hy: number, f: HeroFigure): (x: number, y: number) => number {
  // one smooth head, shaped rather than stacked: a taller-than-wide oval, the jaw tapering to the chin, a brow, soft
  // cheekbones and shallow eye sockets. Proportions: the eyes on the midline, one eye's width apart; the brow, the base
  // of the nose and the chin split the face in thirds; the mouth a third of the way from the nose to the chin.
  const skin = f.skin ?? '#d9b899', shade = tone(skin, '#2a1a1a', 0.12), lip = f.lips ?? tone(skin, '#a8404a', 0.38), hair = f.hair ?? '#3a2a1a';
  const R = 0.4, g = new THREE.SphereGeometry(1, 40, 30), p = g.attributes.position as THREE.BufferAttribute;
  const bump = (x: number, y: number, cx: number, cy: number, w: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / w);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const front = Math.max(0, z), low = Math.max(0, -y);
    x *= 0.86 * (1 - 0.3 * low * low); z *= 0.92 * (1 - 0.08 * low * low);
    z += front * (0.07 * bump(x, y, 0, -0.82, 0.03) + 0.05 * bump(Math.abs(x), y, 0.45, -0.12, 0.03) + 0.05 * Math.exp(-((y - 0.22) ** 2) / 0.006) * Math.max(0, z - 0.5)
      - 0.06 * bump(Math.abs(x), y, 0.31, 0.04, 0.012));
    if (z < 0 && y > -0.2) z *= 1.06; // a fuller back of the skull
    p.setXYZ(i, x * R * s, y * 1.12 * R * s, z * R * s);
  }
  g.computeVertexNormals();
  head.add(at(sm(g, skin), 0, hy, 0));
  // the face's surface depth at (x, y), to seat the features on it
  const front: [number, number, number][] = []; for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0.1 * s) front.push([p.getX(i) / s, p.getY(i) / s, p.getZ(i) / s]);
  const surf = (x: number, y: number) => { let best = 0, bw = 0; for (const [vx, vy, vz] of front) { const w = 1 / (1e-4 + (vx - x) ** 2 + (vy - y) ** 2) ** 2; best += vz * w; bw += w; } return best / bw; };
  const add = (m: M, x: number, y: number, z: number) => head.add(at(m, x * s, hy + y * s, z * s));
  // nose: the bridge, the tip and the wings of the nostrils
  const bridge = cap(0.03 * s, 0.12 * s, skin); bridge.rotation.x = -0.28; add(bridge, 0, -0.075, surf(0, -0.075) + 0.018);
  const tip = sph(0.038 * s, skin); tip.scale.set(1, 0.9, 0.9); add(tip, 0, -0.15, surf(0, -0.15) + 0.04);
  for (const sx of [-1, 1]) { const al = sph(0.024 * s, skin); al.scale.set(1.1, 0.8, 0.9); add(al, sx * 0.034, -0.162, surf(0.034, -0.162) + 0.016); add(sph(0.012 * s, shade, 8, 6), sx * 0.025, -0.172, surf(0.025, -0.172) + 0.02); }
  for (const sx of [-1, 1]) {
    // the eyes in their sockets, the upper lid over each, lashes, and an arched brow
    const ex = sx * 0.125, ez = surf(ex, 0) - 0.012;
    const white = sph(0.048 * s, '#f0ebe2', 16, 12); white.scale.set(1.25, 0.72, 0.6); add(white, ex, 0, ez);
    add(sph(0.026 * s, f.eyes ?? '#4a3a2a', 14, 10), ex, -0.004, ez + 0.022);
    add(sph(0.012 * s, '#141014', 8, 6), ex, -0.004, ez + 0.042);
    const lid = sm(new THREE.SphereGeometry(0.052 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), shade); lid.scale.set(1.25, 0.75, 0.66); lid.rotation.x = 0.25; add(lid, ex, 0.002, ez);
    head.add(tube([-0.06, -0.02, 0.02, 0.06].map((dx, k) => new THREE.Vector3((ex + dx) * s, hy + (0.018 + (k === 1 || k === 2 ? 0.012 : 0)) * s, (ez + 0.026 + (k === 1 || k === 2 ? 0.006 : 0)) * s)), 0.006 * s, tone(hair, '#000000', 0.5)));
    head.add(tube([0.05, 0.1, 0.15, 0.2].map((ax, k) => new THREE.Vector3(sx * ax * s, hy + [0.085, 0.105, 0.108, 0.09][k] * s, (surf(sx * ax, 0.1) + 0.008) * s)), 0.014 * s, hair));
    if (f.ears !== 'pointed') { const e = sph(0.075 * s, skin); e.scale.set(0.42, 1, 0.65); add(e, sx * 0.335, -0.04, -0.01); }
  }
  // lips: a bowed upper lip and a fuller lower one, the corners tucked in
  const mz = surf(0, -0.26);
  const up1 = sph(0.06 * s, lip, 16, 10); up1.scale.set(1, 0.3, 0.4); add(up1, 0, -0.243, mz + 0.004);
  const lo1 = sph(0.05 * s, lip, 16, 10); lo1.scale.set(1, 0.42, 0.45); add(lo1, 0, -0.272, mz + 0.0);
  // hair: a smooth cap whose front edge rises above the brow and whose back falls to the nape
  if (f.hair) { const hc = sm(new THREE.SphereGeometry(0.43 * s, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, true); hc.scale.set(0.9, 1.06, 0.97); hc.rotation.x = -0.5; add(hc, 0, 0.06, -0.03); }
  return surf;
}

/** A limb: the shoulder or hip (root), the elbow or knee (mid), the wrist or ankle (end). Angles about x: negative swings
 *  forward; a positive mid bends a knee, a negative one an elbow. */
export interface Limb { root: THREE.Group; mid: THREE.Group; end: THREE.Group; upper: M; lower: M; hand: M }

/** The torso's line, waist to shoulders: [height, radius] in the upper body's frame (feet at scale 1, before the
 *  front-to-back squash). */
export function torsoProfile(build: HeroFigure['build']): [number, number][] {
  if (build === 'curvy') return [[-0.2, 0.58], [0.15, 0.68], [0.5, 0.58], [0.9, 0.46], [1.25, 0.54], [1.6, 0.62], [1.95, 0.64], [2.15, 0.52], [2.3, 0.3], [2.36, 0.16]];
  if (build === 'broad') return [[-0.2, 0.62], [0.15, 0.66], [0.6, 0.63], [1.0, 0.65], [1.4, 0.73], [1.8, 0.78], [2.05, 0.72], [2.22, 0.5], [2.32, 0.3], [2.38, 0.16]];
  return [[-0.2, 0.6], [0.15, 0.63], [0.6, 0.57], [1.0, 0.58], [1.4, 0.64], [1.8, 0.7], [2.05, 0.66], [2.22, 0.48], [2.32, 0.28], [2.38, 0.16]];
}
export const radiusAt = (p: [number, number][], y: number): number => {
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (y <= p[i][0]) { const [y0, r0] = p[i - 1], [y1, r1] = p[i], t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
  return p[p.length - 1][1];
};
const smoothLine = (p: [number, number][], n: number, s: number, k = 1): THREE.Vector2[] => {
  const out: THREE.Vector2[] = [], y0 = p[0][0], y1 = p[p.length - 1][0];
  for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; out.push(new THREE.Vector2(radiusAt(p, y) * s * k, y * s)); }
  return out;
};

/** The fitted gown's line, body frame, top (the waist) to the hem. */
const GOWN: [number, number][] = [[3.8, 0.48], [3.4, 0.62], [3.0, 0.78], [2.5, 0.68], [2.0, 0.58], [1.55, 0.52], [1.15, 0.54], [0.75, 0.72], [0.35, 1.0], [0.04, 1.26]];

/** A fitted skirt: a surface turned through `prof` ([y, r], top to hem, body frame), oval by `zs`; a slit centred at
 *  `slitAt` (radians from the front, round through +x) opens from `slitTop` to `slitW` wide at the hem; folds and a train
 *  grow below `flareFrom`. `point(y, u, k)` is a spot on it (u 0..1 round from one edge of the slit to the other). */
function sheath(prof: [number, number][], c: string, o: { zs: number; slitAt: number; slitTop: number; slitW: number; flareFrom: number; folds: number; amp: number; train: number }) {
  const rows = 44, cols = 64, top = prof[0][0], hem = prof[prof.length - 1][0];
  const radius = (y: number) => { const pp = prof.slice().reverse(); return radiusAt(pp, y); };
  const point = (y: number, u: number, k = 1) => {
    const open = y < o.slitTop ? o.slitW * Math.pow((o.slitTop - y) / (o.slitTop - hem), 0.8) : 0;
    const th = o.slitAt + open / 2 + u * (Math.PI * 2 - open), fl = Math.max(0, (o.flareFrom - y) / (o.flareFrom - hem));
    const r = radius(y) * k * (1 + o.amp * fl * fl * Math.sin(o.folds * th)) * (1 + o.train * fl * fl * Math.max(0, -Math.cos(th)));
    return new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r * o.zs);
  };
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) { const y = top + (hem - top) * i / rows; for (let j = 0; j <= cols; j++) { const p = point(y, j / cols); pos.push(p.x, p.y, p.z); } }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { mesh: sm(g, c, true), point };
}

/** The body: smooth, with a turned torso (lean, broad or curvy), hips, a neck, and jointed arms and legs (shoulder,
 *  elbow, wrist; hip, knee, ankle) in boots. The upper body (`up`) hangs from the hips as the kit's humanoid does, so the
 *  head sits at 2.82 and the shoulders at ±0.86, 2.0 in its frame. On a gown the shoulders, chest and legs are bare. */
function rig(f: HeroFigure, s: number, gown: boolean) {
  const body = new THREE.Group(), up = new THREE.Group(); up.position.y = 2.85 * s; body.add(up);
  const skin = f.skin ?? '#d9b899', cloth = f.armor?.color ?? f.cloth ?? '#2c3a2e', trim = f.trim ?? '#3a2a1c', boot = f.boots ?? '#2b2420';
  const tp = torsoProfile(f.build), curvy = f.build === 'curvy';
  const torsoC = gown ? f.skirt! : cloth;
  const pelvis = sph(0.6 * s, gown ? f.skirt! : trim, 20, 14); pelvis.scale.set(curvy ? 1.14 : 1, 0.6, 0.64); up.add(at(pelvis, 0, 0.08 * s, 0));
  if (gown) {
    // the dress to just under the bust, bare skin above (shoulders and the chest), the bust in the dress: a sweetheart line
    const dress = sm(new THREE.LatheGeometry(smoothLine(tp.filter(([y]) => y <= 1.62).concat([[1.62, radiusAt(tp, 1.62)]]), 14, s), 28), torsoC); dress.scale.z = 0.64; up.add(dress);
    const chest = sm(new THREE.LatheGeometry(smoothLine([[1.5, radiusAt(tp, 1.5)] as [number, number]].concat(tp.filter(([y]) => y > 1.5)), 12, s, 0.985), 28), skin); chest.scale.z = 0.64; up.add(chest);
    for (const sx of [-1, 1]) { const b = sph(0.235 * s, torsoC, 18, 12); b.scale.set(1, 0.86, 0.82); up.add(at(b, sx * 0.21 * s, 1.56 * s, 0.24 * s)); }
  } else {
    const torso = sm(new THREE.LatheGeometry(smoothLine(tp, 18, s), 28), torsoC); torso.scale.z = 0.64; up.add(torso);
    if (curvy) for (const sx of [-1, 1]) { const b = sph(0.2 * s, torsoC, 14, 10); b.scale.set(1, 0.85, 0.75); up.add(at(b, sx * 0.2 * s, 1.55 * s, 0.25 * s)); }
    const belt = cyl(radiusAt(tp, 0.42) * 1.04 * s, radiusAt(tp, 0.42) * 1.04 * s, 0.2 * s, trim, 24); belt.scale.z = 0.66; up.add(at(belt, 0, 0.42 * s, 0));
    if (!f.skirt) { const hem = drape(0.62 * s, 0.8 * s, 0.75 * s, cloth, { folds: 6, amp: 0.05, jag: 0.03 * s, seed: 0.2 }); hem.scale.z = 0.7; up.add(at(hem, 0, 0.0, 0)); }
  }
  const neck = new THREE.Group(); neck.position.y = 2.24 * s; neck.name = 'neck'; up.add(neck);
  neck.add(at(sm(new THREE.CylinderGeometry(0.15 * s, 0.19 * s, 0.44 * s, 12), skin), 0, 0.16 * s, 0));
  const head = new THREE.Group(); head.position.y = 0.21 * s; head.name = 'head'; neck.add(head);
  const hips = new THREE.Group(); hips.position.y = 2.85 * s; hips.name = 'hips'; body.add(hips); up.name = 'chest';
  // empty mounts for gear: the belt at each hip (sheaths hang down -y), and between the shoulder blades (+y up the back)
  for (const sx of [1, -1]) { const b = new THREE.Group(); b.name = sx > 0 ? 'beltR' : 'beltL'; b.position.set(sx * 0.6 * s, 0.42 * s, 0.05 * s); up.add(b); }
  const back = new THREE.Group(); back.name = 'back'; back.position.set(0, 1.5 * s, -0.5 * s); up.add(back);
  const arm: Limb[] = [], leg: Limb[] = [], soles: M[] = [];
  const upperC = gown ? skin : f.sleeves ?? cloth, lowerC = f.bracers ?? f.sleeves ?? (gown ? skin : cloth);
  for (const sx of [1, -1]) {
    const sw = curvy ? 0.92 : 1, aw = curvy ? 0.8 : 1; // a curvy build: narrower shoulders, slimmer arms
    const sh = sph(0.3 * s * aw, gown ? skin : cloth, 16, 12); sh.scale.set(1.25, 0.8, 0.95); sh.rotation.z = -sx * 0.25; up.add(at(sh, sx * 0.7 * s * sw, 2.02 * s, 0)); // the deltoid, sloping from the neck
    const root = new THREE.Group(); root.position.set(sx * 0.86 * s * sw, 2.0 * s, 0); root.rotation.set(-0.08, 0, sx * 0.1); up.add(root);
    const upper = sm(new THREE.CylinderGeometry(0.19 * s * aw, 0.155 * s * aw, 1.1 * s, 12), upperC); root.add(at(upper, 0, -0.55 * s, 0));
    if (f.puffSleeves && f.sleeves) {
      if (gown) { // off the shoulder: a gathered band round the upper arm with a ruffle below it
        const band = sm(new THREE.TorusGeometry(0.17 * s * aw, 0.05 * s, 8, 20), f.sleeves); band.rotation.x = Math.PI / 2; root.add(at(band, 0, -0.32 * s, 0));
        const ruf = drape(0.17 * s * aw, 0.26 * s, 0.3 * s, f.sleeves, { folds: 9, amp: 0.25, jag: 0.04 * s, seed: 1.3 }); root.add(at(ruf, 0, -0.48 * s, 0));
      } else { const puff = sph(0.3 * s, f.sleeves); puff.scale.set(1, 1.25, 1); root.add(at(puff, 0, -0.45 * s, 0)); }
    }
    const mid = new THREE.Group(); mid.position.set(0, -1.12 * s, 0); mid.rotation.x = -0.22; root.add(mid);
    mid.add(sph(0.16 * s * aw, upperC, 12, 8));
    const lower = sm(new THREE.CylinderGeometry(0.155 * s * aw, 0.115 * s * aw, 1.0 * s, 12), lowerC); mid.add(at(lower, 0, -0.52 * s, 0));
    if (f.bracers) { mid.add(at(cyl(0.165 * s * aw, 0.155 * s * aw, 0.12 * s, f.bracers, 12), 0, -0.96 * s, 0)); mid.add(at(cyl(0.175 * s * aw, 0.175 * s * aw, 0.05 * s, tone(f.bracers, '#000000', 0.3), 12), 0, -0.3 * s, 0)); }
    const end = new THREE.Group(); end.position.set(0, -1.04 * s, 0); end.rotation.x = 0.06; mid.add(end);
    end.add(sph(0.11 * s, f.gauntlets ?? skin, 10, 8));
    const hand = sph(0.15 * s, f.gauntlets ?? skin, 12, 10); hand.scale.set(0.72, 1.2, 0.5); end.add(at(hand, 0, -0.17 * s, 0.01 * s));
    const th = cap(0.042 * s, 0.11 * s, f.gauntlets ?? skin); th.rotation.z = -sx * 0.5; th.rotation.x = -0.3; end.add(at(th, -sx * 0.09 * s, -0.1 * s, 0.07 * s));
    const side = sx > 0 ? 'R' : 'L'; root.name = 'shoulder' + side; mid.name = 'elbow' + side; end.name = 'wrist' + side;
    arm.push({ root, mid, end, upper, lower, hand });

    const hx = gown ? 0.2 : 0.3, legC = gown ? skin : trim;
    const hip = new THREE.Group(); hip.position.set(sx * hx * s, 2.85 * s, 0); hip.rotation.z = sx * 0.04; body.add(hip);
    hip.add(sph(0.25 * s, legC, 12, 10));
    const thigh = sm(new THREE.CylinderGeometry(0.26 * s, 0.19 * s, 1.2 * s, 12), legC); hip.add(at(thigh, 0, -0.62 * s, 0));
    const knee = new THREE.Group(); knee.position.set(0, -1.24 * s, 0); hip.add(knee);
    knee.add(sph(0.195 * s, legC, 12, 10));
    const calf = sph(0.2 * s, legC, 12, 10); calf.scale.set(0.95, 1.7, 1); knee.add(at(calf, 0, -0.38 * s, -0.03 * s));
    const shin = sm(new THREE.CylinderGeometry(0.18 * s, 0.13 * s, 1.1 * s, 12), legC); knee.add(at(shin, 0, -0.56 * s, 0));
    // boots: the shaft to below the knee with a turned cuff, the foot and a sole
    knee.add(at(cyl(0.215 * s, 0.19 * s, 0.66 * s, boot, 12), 0, -0.82 * s, 0));
    knee.add(at(cyl(0.25 * s, 0.23 * s, 0.2 * s, tone(boot, '#ffffff', 0.08), 12), 0, -0.52 * s, 0));
    const ankle = new THREE.Group(); ankle.position.set(0, -1.14 * s, 0); knee.add(ankle);
    ankle.add(sph(0.18 * s, boot, 12, 8));
    const foot = sph(0.24 * s, boot, 14, 10); foot.scale.set(0.8, 0.6, 1.55); ankle.add(at(foot, 0, -0.27 * s, 0.17 * s));
    const sole = box(0.36 * s, 0.06 * s, 0.78 * s, tone(boot, '#000000', 0.45)); ankle.add(at(sole, 0, -0.42 * s, 0.15 * s)); soles.push(sole);
    hip.name = 'hip' + side; knee.name = 'knee' + side; ankle.name = 'ankle' + side; foot.name = 'foot' + side;
    leg.push({ root: hip, mid: knee, end: ankle, upper: thigh, lower: shin, hand: foot });
  }
  return { body, up, neck, head, arm, leg, soles };
}

/** A hero's miniature: origin at the floor centre, feet in world units, facing +z. `battle` puts it in its stance. */
export function heroFigure(f: HeroFigure, size: CreatureSize = 'medium', battle = false): THREE.Group {
  const s = (SIZE_SCALE[size] ?? 1) * (f.height ?? 1);
  const gown = !!(f.skirt && f.underskirt);
  const { body, up, neck, head, arm, leg, soles } = rig(f, s, gown);
  const hy = 2.82 * s; // the head's centre, in the upper body's frame
  const skin = f.skin ?? '#d9b899';
  const headAt = neck.position.y + head.position.y; // the head joint, in the upper body's frame
  const surf = buildFace(head, s, hy - headAt, f);
  const [R, Lf] = arm;
  // a group in each hand for what it holds: upright while the forearm hangs at rest
  const holder = (l: Limb) => { const g = new THREE.Group(); g.position.set(0, -0.14 * s, 0.05 * s); g.rotation.set(-(l.root.rotation.x + l.mid.rotation.x), 0, -Math.sign(l.root.position.x) * 0.08); l.end.add(g); return g; };
  const gR = holder(R), gL = holder(Lf); gR.name = 'handR'; gL.name = 'handL';
  if (f.weapon === 'sword') gR.add(at(box(0.12 * s, 2.6 * s, 0.32 * s, '#c8ccd2'), 0, 1.45 * s, 0), at(box(0.7 * s, 0.12 * s, 0.14 * s, '#a07a3a'), 0, 0.15 * s, 0), at(box(0.12 * s, 0.5 * s, 0.12 * s, '#3b2a20'), 0, -0.15 * s, 0));
  if (f.weapon === 'spear') gR.add(at(box(0.12 * s, 7 * s, 0.12 * s, '#3b2a20'), 0, 0.85 * s, 0), at(cone(0.2 * s, 0.8 * s, '#c8ccd2'), 0, 4.75 * s, 0));
  if (f.weapon === 'staff') gR.add(at(box(0.14 * s, 6 * s, 0.14 * s, '#3b2a20'), 0, 0.45 * s, 0));
  if (f.weapon === 'torch') gR.add(at(box(0.14 * s, 1.6 * s, 0.14 * s, '#3b2a20'), 0, 0.55 * s, 0), at(sph(0.32 * s, '#f0a040'), 0, 1.55 * s, 0));

  // face extras
  if (f.earrings) for (const sx of [-1, 1]) { const e = sph(0.05 * s, f.earrings, 8, 6); e.scale.y = 1.8; up.add(at(e, sx * 0.36 * s, hy - 0.2 * s, 0.02 * s)); up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), sx * 0.36 * s, hy - 0.1 * s, 0.02 * s)); }
  if (f.markings) for (const [x, y, rz] of [[0.17, -0.1, 0.6], [0.2, 0.03, -0.3], [-0.18, -0.11, -0.5], [0.1, -0.2, 0.9]]) { const m = cap(0.011 * s, 0.11 * s, f.markings); m.rotation.z = rz; m.rotation.y = Math.sign(x) * 0.5; head.add(at(m, x * s, (hy - headAt + y) * s, (surf(x, y) + 0.004) * s)); }

  // collar, pendant, buckle
  if (f.shirt) { const c = cyl(0.24 * s, 0.32 * s, 0.32 * s, f.shirt, 7); up.add(at(c, 0, 2.2 * s, 0.08 * s)); up.add(at(box(0.3 * s, 0.5 * s, 0.06 * s, f.shirt), 0, 1.85 * s, 0.4 * s)); for (let i = 0; i < 3; i++) up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), 0, (1.95 - i * 0.15) * s, 0.44 * s)); }
  if (f.pendant) { const chain = tube([new THREE.Vector3(-0.22 * s, 2.25 * s, 0.25 * s), new THREE.Vector3(-0.1 * s, 1.85 * s, 0.42 * s), new THREE.Vector3(0, 1.75 * s, 0.45 * s), new THREE.Vector3(0.1 * s, 1.85 * s, 0.42 * s), new THREE.Vector3(0.22 * s, 2.25 * s, 0.25 * s)], 0.012 * s, '#b8bec8'); up.add(chain); const g = sm(new THREE.OctahedronGeometry(0.08 * s), f.pendant); g.scale.y = 1.7; up.add(at(g, 0, 1.62 * s, 0.46 * s)); }
  if (f.buckle) { up.add(at(box(0.24 * s, 0.2 * s, 0.06 * s, f.buckle), 0, 0.42 * s, 0.63 * s)); up.add(at(box(0.12 * s, 0.1 * s, 0.07 * s, f.trim ?? '#2b2420'), 0, 0.42 * s, 0.64 * s)); }

  // a laced bodice: a corset that follows the torso's line, the lacing crossing down its front
  if (f.bodice) {
    const tp = torsoProfile(f.build), lo = 0.45, hi = gown ? 1.42 : 1.3;
    const pts: THREE.Vector2[] = []; for (let i = 0; i <= 10; i++) { const y = lo + (hi - lo) * i / 10; pts.push(new THREE.Vector2(radiusAt(tp, y) * 1.06 * s, y * s)); }
    const b = sm(new THREE.LatheGeometry(pts, 24), f.bodice.color); b.scale.z = 0.66; up.add(b);
    const lc = f.bodice.lacing ?? '#b08a4a';
    for (let i = 0; i < 5; i++) { const y = lo + 0.08 + i * (hi - lo - 0.16) / 4, z = radiusAt(tp, y) * 1.06 * 0.66 + 0.012; for (const sx of [-1, 1]) { const x = box(0.2 * s, 0.025 * s, 0.025 * s, lc); x.rotation.z = sx * 0.5; up.add(at(x, 0, y * s, z * s)); } }
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const y = lo + 0.06 + i * (hi - lo - 0.12) / 5; up.add(at(sph(0.018 * s, lc, 6, 4), sx * 0.08 * s, y * s, (radiusAt(tp, y) * 1.06 * 0.66 + 0.01) * s)); }
  }

  // a coat: tails behind, lapels in front
  if (f.coat) {
    const tails = drape(0.62 * s, 0.75 * s, 1.6 * s, f.coat.tails, { folds: 5, amp: 0.08, jag: 0.25 * s, gap: Math.PI * 1.2 }); up.add(at(tails, 0, -0.55 * s, 0));
    for (const sx of [-1, 1]) { const lp = box(0.16 * s, 0.9 * s, 0.05 * s, f.coat.lapel ?? f.coat.tails); lp.rotation.z = sx * 0.25; up.add(at(lp, sx * 0.24 * s, 1.75 * s, 0.42 * s)); up.add(at(box(0.07 * s, 0.32 * s, 0.05 * s, '#c9c2b0'), sx * 0.45 * s, 1.0 * s, 0.4 * s)); }
  }

  // a satchel on a strap across the chest, and vials at the belt
  if (f.satchel) {
    const strap = box(0.1 * s, 2.5 * s, 0.05 * s, f.satchel); strap.rotation.z = -0.62; up.add(at(strap, 0.05 * s, 1.15 * s, 0.45 * s));
    const bag = sm(new THREE.CapsuleGeometry(0.22 * s, 0.25 * s, 3, 8), f.satchel); bag.rotation.z = Math.PI / 2; bag.scale.z = 0.55; up.add(at(bag, 0.72 * s, -0.12 * s, 0.38 * s));
    up.add(at(box(0.5 * s, 0.22 * s, 0.05 * s, tone(f.satchel, '#000000', 0.25)), 0.72 * s, 0.0 * s, 0.52 * s));
    up.add(at(box(0.08 * s, 0.1 * s, 0.03 * s, f.buckle ?? '#9a9ea6'), 0.72 * s, -0.08 * s, 0.56 * s));
  }
  (f.vials ?? []).slice(0, 4).forEach((c, i) => { const x = -0.5 * s + i * 0.15 * s; const v = sph(0.075 * s, c, 10, 8); v.scale.y = 1.3; up.add(at(v, x, 0.2 * s, 0.6 * s)); up.add(at(cyl(0.03 * s, 0.03 * s, 0.12 * s, c, 6), x, 0.34 * s, 0.6 * s)); up.add(at(cyl(0.035 * s, 0.035 * s, 0.06 * s, '#8a6a4a', 6), x, 0.42 * s, 0.6 * s)); });

  // a short skirt over the legs; or the fitted gown: hugging the hips and thighs, tight at the knee, flaring to a
  // mermaid hem with a short train, slit up the front of the left leg, the underskirt frothing at the hem
  if (f.skirt && !gown) { const k = drape(0.66 * s, 1.05 * s, 2.6 * s, f.skirt, { folds: 7, amp: 0.1, jag: 0.05 * s, seed: 0.4 }); k.scale.z = 0.8; body.add(at(k, 0, 1.75 * s, 0)); }
  if (gown) {
    const g = sheath(GOWN.map(([y, r]) => [y * s, r * s] as [number, number]), f.skirt!, { zs: 0.68, slitAt: -0.42, slitTop: 2.45 * s, slitW: 0.95, flareFrom: 1.3 * s, folds: 9, amp: 0.1, train: 0.35 });
    body.add(g.mesh);
    const fr = drape(1.12 * s, 1.3 * s, 0.24 * s, f.underskirt!, { folds: 22, amp: 0.2, jag: 0.06 * s, seed: 2 }); fr.scale.z = 0.72; body.add(at(fr, 0, 0.12 * s, -0.04 * s));
    if (f.gownTrim) {
      const hem: THREE.Vector3[] = []; for (let i = 0; i <= 48; i++) hem.push(g.point(0.06 * s, i / 48, 1.015));
      body.add(tube(hem, 0.025 * s, f.gownTrim));
      for (const u of [0, 1]) {
        const edge: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) edge.push(g.point((2.45 - i * 0.239) * s, u, 1.01));
        body.add(tube(edge, 0.02 * s, f.gownTrim));
        for (let i = 1; i < 10; i += 2) { const q = edge[i], leaf = sph(0.045 * s, f.gownTrim, 6, 4); leaf.scale.set(0.5, 1, 0.25); leaf.rotation.z = (u ? 1 : -1) * (i % 4 === 1 ? 0.7 : -0.7); body.add(at(leaf, q.x, q.y, q.z + 0.02 * s)); }
      }
      const belt: THREE.Vector3[] = []; for (let i = 0; i <= 32; i++) belt.push(g.point(3.72 * s, i / 32, 1.02));
      body.add(tube(belt, 0.022 * s, f.gownTrim, false));
    }
  }


  // pointed ears
  if (f.ears === 'pointed') for (const sx of [-1, 1]) { const e = sm(new THREE.ConeGeometry(0.09 * s, 0.5 * s, 8), skin); e.scale.z = 0.45; e.position.set(sx * 0.36 * s, hy + 0.06 * s, -0.02 * s); e.rotation.z = -sx * 1.05; e.rotation.x = -0.35; up.add(e); }

  // hair
  if (f.hair) {
    const H = f.hair;
    if (f.hairStyle === 'long') {
      const back = cap(0.3 * s, 1.0 * s, H); back.scale.set(1.25, 1, 0.45); up.add(at(back, 0, hy - 0.75 * s, -0.3 * s));
      for (const sx of [-1, 1]) { const lock = cap(0.09 * s, 0.85 * s, H); lock.rotation.z = sx * 0.12; up.add(at(lock, sx * 0.34 * s, hy - 0.5 * s, 0.1 * s)); }
      for (let i = 0; i < 5; i++) { const w = cap(0.07 * s, 1.1 * s, tone(H, '#000000', (i % 2) * 0.12)); w.rotation.z = (i - 2) * 0.08; up.add(at(w, (i - 2) * 0.15 * s, hy - 0.95 * s, -0.4 * s)); }
    }
    if (f.hairStyle === 'braids') {
      const back = cap(0.26 * s, 0.4 * s, H); back.scale.set(1.3, 1, 0.5); up.add(at(back, 0, hy - 0.35 * s, -0.3 * s));
      for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) {
        const y = hy - 0.3 * s - i * 0.19 * s, k = sph((0.095 - i * 0.004) * s, i % 2 ? H : tone(H, '#000000', 0.12), 8, 6); k.scale.y = 1.2; up.add(at(k, sx * (0.36 + i * 0.01) * s, y, (0.12 + i * 0.02) * s));
        if (i === 3 || i === 7) up.add(at(cyl(0.1 * s, 0.1 * s, 0.08 * s, '#b8bec8', 8), sx * (0.36 + i * 0.01) * s, y, (0.12 + i * 0.02) * s));
      }
    }
    if (f.hairStyle === 'curly') for (let i = 0; i < 16; i++) { const a = i * 2.39996, ring2 = i < 9 ? 0 : 1; up.add(at(sph((0.14 + (i % 3) * 0.025) * s, i % 3 ? H : tone(H, '#ffffff', 0.2), 10, 8), Math.cos(a) * (0.32 - ring2 * 0.1) * s, hy + (0.22 + ring2 * 0.16 + (i % 2) * 0.05) * s, Math.sin(a) * (0.3 - ring2 * 0.1) * s - 0.05 * s)); }
    if (f.hairStreak) { const st = cap(0.05 * s, 1.0 * s, f.hairStreak); st.rotation.z = 0.08; up.add(at(st, 0.3 * s, hy - 0.4 * s, 0.17 * s)); }
  }

  // armour
  if (f.armor?.kind === 'plate') {
    const t = f.armor.trim ?? '#a9adb6';
    for (const sx of [-1, 1]) { const p = ball(0.5 * s, f.armor.color, 1); p.scale.set(1.05, 0.62, 1); up.add(at(p, sx * 0.78 * s, 2.12 * s, 0)); up.add(at(box(0.62 * s, 0.08 * s, 0.7 * s, t), sx * 0.8 * s, 1.95 * s, 0)); }
    up.add(at(cyl(0.34 * s, 0.42 * s, 0.3 * s, t), 0, 2.28 * s, 0));                          // gorget
    up.add(at(box(0.9 * s, 0.08 * s, 0.08 * s, t), 0, 1.5 * s, 0.42 * s));                       // breastplate edge
    for (const sx of [-1, 1]) { const p2 = ball(0.42 * s, f.armor.color, 1); p2.scale.set(1, 0.5, 0.95); up.add(at(p2, sx * 0.86 * s, 1.78 * s, 0)); up.add(at(box(0.5 * s, 0.06 * s, 0.62 * s, t), sx * 0.88 * s, 1.62 * s, 0)); }
    up.add(at(box(0.5 * s, 0.06 * s, 0.06 * s, t), 0, 0.95 * s, 0.4 * s));                         // a second band
    const knot = sm(new THREE.TorusKnotGeometry(0.1 * s, 0.022 * s, 48, 6, 2, 3), t); up.add(at(knot, 0, 1.25 * s, 0.44 * s)); // a knotwork boss
    for (const l of leg) {                                                                              // knees and greaves
      l.mid.add(at(ball(0.22 * s, f.armor.color, 0), 0, 0.0, 0.14 * s));
      l.mid.add(at(cyl(0.22 * s, 0.2 * s, 0.9 * s, f.armor.color, 7), 0, -0.6 * s, 0.02 * s));
      l.mid.add(at(box(0.3 * s, 0.05 * s, 0.05 * s, t), 0, -0.2 * s, 0.2 * s));
    }
    for (const [x, z] of [[-0.42, 0.3], [0.42, 0.3], [-0.5, -0.1], [0.5, -0.1]]) { const ts = box(0.42 * s, 0.75 * s, 0.08 * s, f.armor.color); ts.rotation.x = z > 0 ? -0.15 : 0.15; ts.rotation.y = x * 0.6; up.add(at(ts, x * s, -0.45 * s, z * s)); up.add(at(box(0.42 * s, 0.06 * s, 0.09 * s, t), x * s, -0.78 * s, z * s + 0.02 * s)); } // tassets
  }
  if (f.armor?.kind === 'mail') {
    const m = cyl(0.7 * s, 0.75 * s, 1.0 * s, f.armor.trim ?? f.armor.color, 7); m.scale.z = 0.66; up.add(at(m, 0, 0.55 * s, 0));
    for (let i = 0; i < 5; i++) { const r = sm(new THREE.TorusGeometry(0.66 * s - i * 0.004 * s, 0.018 * s, 4, 28), tone(f.armor.color, '#ffffff', 0.15)); r.rotation.x = Math.PI / 2; r.scale.y = 0.66; up.add(at(r, 0, (0.2 + i * 0.4) * s, 0)); }
  }

  // cloak (with a hood folded on the shoulders): it hangs in folds
  if (f.cloak) {
    if (gown) { const c = drape(1.0 * s, 1.35 * s, 3.9 * s, f.cloak, { folds: 7, amp: 0.12, jag: f.tattered ? 0.45 * s : 0.05 * s, seed: 0.3, gap: Math.PI * 1.25 }); c.scale.z = 0.5; up.add(at(c, 0, -0.55 * s, -0.2 * s)); }
    else {
      const c = drape(0.78 * s, 1.25 * s, 4.7 * s, f.cloak, { folds: 6, amp: 0.12, jag: f.tattered ? 0.45 * s : 0.05 * s, seed: 0.3, gap: Math.PI * 1.15 }); c.scale.z = 0.55; up.add(at(c, 0, -0.1 * s, -0.12 * s));
      const mantle = drape(0.36 * s, 0.95 * s, 0.75 * s, f.cloak, { folds: 9, amp: 0.08, jag: 0.06 * s, seed: 0.9 }); mantle.scale.z = 0.72; up.add(at(mantle, 0, 2.02 * s, -0.04 * s));
    }
    if (f.cloakTrim && !gown) {
      const hem: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) { const th = Math.PI * 1.15 / 2 + (Math.PI * 2 - Math.PI * 1.15) * (i / 24), r = 1.25 * s * (1 + 0.12 * (0.7 * Math.sin(6 * th + 0.3) + 0.3 * Math.sin(13.8 * th + 0.6))); hem.push(new THREE.Vector3(Math.sin(th) * r, -2.3 * s - (f.tattered ? 0.45 * s * Math.abs(Math.sin(3 * th + 0.3)) : 0), Math.cos(th) * r * 0.55 - 0.12 * s)); }
      up.add(tube(hem, 0.03 * s, f.cloakTrim));
      for (const sx of [-1, 1]) up.add(at(box(0.08 * s, 3.8 * s, 0.06 * s, f.cloakTrim), sx * 0.78 * s, 0.0 * s, -0.05 * s));
    }
    if (f.clasps && !gown) for (const sx of [-1, 1]) { const d = cyl(0.12 * s, 0.12 * s, 0.05 * s, f.clasps, 12); d.rotation.x = Math.PI / 2; up.add(at(d, sx * 0.55 * s, 2.1 * s, 0.4 * s)); up.add(at(cap(0.015 * s, 0.12 * s, tone(f.clasps, '#000000', 0.4)), sx * 0.55 * s, 2.1 * s, 0.43 * s)); }
    if (f.hood && !gown) { const h = sph(0.5 * s, f.cloak, 16, 10); h.scale.set(1, 0.55, 0.8); up.add(at(h, 0, 2.38 * s, -0.42 * s)); }
  }

  // what the right hand holds
  if (f.weapon === 'axe') {
    gR.add(at(box(0.13 * s, 5.2 * s, 0.13 * s, '#4a3626'), 0, 1.6 * s, 0));
    for (let i = 0; i < 6; i++) gR.add(at(cyl(0.085 * s, 0.085 * s, 0.05 * s, '#2a1c14', 6), 0, (0.3 + i * 0.12) * s, 0)); // the grip's wrap
    for (const dx of [1, -1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, -0.18); sh.quadraticCurveTo(0.35, -0.2, 0.62, -0.62); sh.quadraticCurveTo(0.52, 0, 0.62, 0.62); sh.quadraticCurveTo(0.35, 0.2, 0, 0.18); sh.lineTo(0, -0.18);
      const bit = sm(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), '#9aa0aa');
      bit.scale.set(dx * s, s, s); gR.add(at(bit, dx * 0.08 * s, 3.75 * s, -0.04 * s));
    }
    gR.add(at(box(0.2 * s, 0.5 * s, 0.24 * s, '#5c626c'), 0, 3.75 * s, 0));
    gR.add(at(cone(0.08 * s, 0.3 * s, '#5c626c', 6), 0, 4.35 * s, 0));
  }
  if (f.weapon === 'mace') {
    gR.add(at(box(0.13 * s, 2.0 * s, 0.13 * s, '#3b2a20'), 0, 0.6 * s, 0));
    gR.add(at(sph(0.08 * s, '#8e939b', 8, 6), 0, -0.42 * s, 0));
    gR.add(at(sph(0.26 * s, '#8e939b', 12, 8), 0, 1.75 * s, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, fl = box(0.06 * s, 0.5 * s, 0.22 * s, '#a3a8b0'); fl.rotation.y = -a; gR.add(at(fl, Math.cos(a) * 0.24 * s, 1.75 * s, Math.sin(a) * 0.24 * s)); }
  }

  // what the left hand holds
  const o = f.offhand;
  if (o?.kind === 'shield') {
    // one group, so the face, the rim, the boss and the emblem turn together and the emblem sits on the face
    const sg = new THREE.Group(); sg.position.set(-0.15 * s, 0.95 * s, 0.25 * s); sg.rotation.y = -0.35; gL.add(sg);
    const face = sm(new THREE.CylinderGeometry(1.0 * s, 1.0 * s, 0.14 * s, 32), o.color ?? '#2a3f7a'); face.rotation.x = Math.PI / 2; sg.add(face);
    const rim = sm(new THREE.TorusGeometry(1.0 * s, 0.07 * s, 8, 40), o.rim ?? '#a9adb6'); sg.add(rim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sg.add(at(sph(0.04 * s, o.rim ?? '#a9adb6', 6, 4), Math.cos(a) * 0.9 * s, Math.sin(a) * 0.9 * s, 0.08 * s)); }
    if (o.mark) {
      for (const dx of [-0.15, 0.15]) sg.add(at(sm(new THREE.TorusGeometry(0.22 * s, 0.03 * s, 6, 24), o.mark), dx * s, 0.1 * s, 0.085 * s));
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + side * (0.35 + i * 0.2), r = 0.6 * s, leaf = sph(0.055 * s, o.mark, 6, 4);
        leaf.scale.set(0.45, 1, 0.25); leaf.rotation.z = a + Math.PI / 2 + side * 0.5; sg.add(at(leaf, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.7 - 0.05 * s, 0.08 * s));
      }
    } else sg.add(at(sph(0.14 * s, o.rim ?? '#a9adb6', 12, 8), 0, 0, 0.08 * s));
  }
  if (o?.kind === 'book') {
    const bk = new THREE.Group(); bk.position.set(0.225 * s, 1.0 * s, 0.37 * s); bk.rotation.x = -0.5; gL.add(bk);
    for (const sx of [-1, 1]) { const cover = box(0.42 * s, 0.05 * s, 0.6 * s, o.color ?? '#4a3020'); cover.rotation.z = sx * 0.18; bk.add(at(cover, sx * 0.21 * s, 0, 0)); const pg = box(0.38 * s, 0.07 * s, 0.55 * s, o.rim ?? '#e8dfc8'); pg.rotation.z = sx * 0.18; bk.add(at(pg, sx * 0.2 * s, 0.05 * s, 0)); }
    bk.add(at(box(0.02 * s, 0.02 * s, 0.4 * s, '#6a5a4a'), 0.2 * s, 0.1 * s, 0));
  }
  if (o?.kind === 'orb') gL.add(at(sph(0.3 * s, o.color ?? '#9b7bd0'), 0, 0.47 * s, -0.28 * s));
  if (f.wisp) {
    // a ghostly skull rising from the book
    const wg = new THREE.Group(); wg.position.set(0.27 * s, 1.75 * s, 0.35 * s); gL.add(wg);
    wg.add(glassy(sph(0.2 * s, f.wisp, 14, 10), f.wisp, 0.75));
    const jaw = glassy(box(0.22 * s, 0.1 * s, 0.16 * s, f.wisp), f.wisp, 0.65); wg.add(at(jaw, 0, -0.17 * s, 0.05 * s));
    for (const sx of [-1, 1]) wg.add(at(sph(0.045 * s, '#1a3a2a', 8, 6), sx * 0.07 * s, 0.02 * s, 0.17 * s));
    const trail = glassy(sm(new THREE.ConeGeometry(0.16 * s, 0.75 * s, 10), f.wisp), f.wisp, 0.4); trail.rotation.x = Math.PI; wg.add(at(trail, 0, -0.55 * s, 0));
  }

  // wings, halo, crown
  if (f.wings) {
    const n = f.wings.count ?? 4, op = f.wings.opacity ?? 0.42, rimC = f.wingRim ?? f.wings.color;
    const pairs = n === 4 ? [{ w: 2.3, h: 2.6, y: 2.1, tilt: 0.5 }, { w: 1.7, h: 1.8, y: 0.8, tilt: -0.35 }] : [{ w: 2.6, h: 3.0, y: 1.8, tilt: 0.35 }];
    for (const p of pairs) for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.18 * s, p.y * s, -0.42 * s); g.rotation.y = sx * 0.45; g.rotation.z = -sx * p.tilt;
      const wing = glassy(new THREE.Mesh(new THREE.CircleGeometry(1, 24), mat(f.wings.color)), f.wings.color, op);
      wing.scale.set(p.w * s / 2, p.h * s / 2, 1); wing.position.x = sx * p.w * s / 2; g.add(wing);
      for (const ang of [-0.5, -0.2, 0.1, 0.4]) { const vein = box(p.w * s * 0.95, 0.03 * s, 0.02 * s, rimC); vein.geometry.translate(sx * p.w * s * 0.475, 0, 0); vein.rotation.z = ang * (p.h / p.w); g.add(vein); }
      const edge = glassy(new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 32), mat(rimC)), rimC, Math.min(1, op + 0.4)); edge.scale.copy(wing.scale); edge.position.copy(wing.position); g.add(edge);
      up.add(g);
    }
  }
  if (f.halo) {
    const h = sm(new THREE.TorusGeometry(0.62 * s, 0.04 * s, 8, 40), f.halo); h.position.set(0, hy + 0.3 * s, -0.42 * s); up.add(h);
    const glow = glassy(new THREE.Mesh(new THREE.TorusGeometry(0.62 * s, 0.11 * s, 8, 40), mat(f.halo)), f.halo, 0.25); glow.position.copy(h.position); up.add(glow);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, ray = glassy(cone(0.03 * s, 0.25 * s, f.halo, 4), f.halo, 0.5); ray.rotation.z = a - Math.PI / 2; up.add(at(ray, Math.cos(a) * 0.82 * s, hy + 0.3 * s + Math.sin(a) * 0.82 * s, -0.44 * s)); }
  }
  if (f.crown) {
    const cg = new THREE.Group(); cg.position.set(0, hy + 0.2 * s, -0.03 * s); cg.rotation.x = -0.12; up.add(cg);
    const C = f.crown.color, R = 0.41 * s;
    for (let k = 0; k < 3; k++) {             // three twisted strands of thorny branch
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = R * (1 + 0.05 * Math.sin(5 * a + k * 2.1)); pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.035 * s * Math.sin(3 * a + k * 2.1), Math.sin(a) * rr)); }
      cg.add(tube(pts, 0.022 * s, k === 1 ? tone(C, '#000000', 0.2) : C, true));
    }
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 30; i++) {            // thorns
      const a = rnd() * Math.PI * 2, t = cone(0.016 * s, 0.11 * s, tone(C, '#000000', 0.3), 4);
      t.position.set(Math.cos(a) * R * 1.04, (rnd() - 0.5) * 0.06 * s, Math.sin(a) * R * 1.04);
      t.rotation.z = -Math.cos(a) * (0.9 + rnd() * 0.6); t.rotation.x = Math.sin(a) * (0.9 + rnd() * 0.6); cg.add(t);
    }
    for (let i = 0; i < 8; i++) {             // twigs reaching up and out, some forked
      const a = (i / 8) * Math.PI * 2 + 0.3, b0 = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const b1 = b0.clone().add(new THREE.Vector3(Math.cos(a) * 0.12 * s, (0.22 + (i % 3) * 0.08) * s, Math.sin(a) * 0.12 * s));
      const b2 = b1.clone().add(new THREE.Vector3(Math.cos(a + 0.4) * 0.1 * s, 0.12 * s, Math.sin(a + 0.4) * 0.1 * s));
      cg.add(tube([b0, b1, b2], 0.014 * s, C));
      if (i % 2 === 0) { const f2 = b1.clone().add(new THREE.Vector3(Math.cos(a - 0.6) * 0.12 * s, 0.06 * s, Math.sin(a - 0.6) * 0.12 * s)); cg.add(tube([b1.clone().lerp(b0, 0.3), b1, f2], 0.01 * s, C)); }
    }
    if (f.crown.flower) {                     // five-petal flowers, gathered on the right, with leaves
      const spots = [-0.2, 0.25, 0.7, 1.15, 2.9, -0.65];
      spots.forEach((a, n) => {
        const fl = new THREE.Group(); fl.position.set(Math.cos(a) * R * 1.08, 0.03 * s + (n % 2) * 0.04 * s, Math.sin(a) * R * 1.08); fl.rotation.y = Math.atan2(fl.position.x, fl.position.z); fl.rotation.x = -0.4;
        const big = n < 4 ? 1 : 0.7;
        for (let p = 0; p < 5; p++) { const pa = (p / 5) * Math.PI * 2, petal = sph(0.06 * s * big, f.crown!.flower!, 8, 6); petal.scale.set(0.6, 1, 0.28); petal.rotation.z = pa; fl.add(at(petal, Math.sin(pa) * -0.06 * s * big, Math.cos(pa) * 0.06 * s * big, 0)); }
        fl.add(at(sph(0.028 * s * big, '#e0b84a', 8, 6), 0, 0, 0.02 * s));
        for (const sx of [-1, 1]) { const lf = sph(0.06 * s, '#5a7a3a', 8, 4); lf.scale.set(0.4, 1, 0.18); lf.rotation.z = sx * 1.1; fl.add(at(lf, sx * 0.1 * s * big, -0.05 * s, -0.02 * s)); }
        cg.add(fl);
      });
    }
  }

  // beard, fangs, a standing collar
  const fy = hy - headAt;
  if (f.beard) {
    const b = sph(0.33 * s, f.beard, 18, 12); b.scale.set(0.95, 0.72, 0.85); head.add(at(b, 0, fy - 0.27 * s, 0.07 * s));
    const mo = cap(0.03 * s, 0.14 * s, f.beard); mo.rotation.z = Math.PI / 2; head.add(at(mo, 0, fy - 0.2 * s, 0.335 * s));
    for (const sx of [-1, 1]) { const t = cap(0.025 * s, 0.08 * s, f.beard); t.rotation.z = sx * 0.5; head.add(at(t, sx * 0.09 * s, fy - 0.23 * s, 0.325 * s)); }
  }
  if (f.fangs) for (const sx of [-1, 1]) { const t = cone(0.014 * s, 0.06 * s, '#f2eee4', 5); t.rotation.x = Math.PI; head.add(at(t, sx * 0.03 * s, fy - 0.27 * s, 0.325 * s)); }
  if (f.collar) { const c = sm(new THREE.CylinderGeometry(0.62 * s, 0.34 * s, 0.95 * s, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), f.collar, true); up.add(at(c, 0, 2.62 * s, -0.04 * s)); }

  // what sits on the head (hair, ears, crown, halo, earrings, markings) turns with it
  for (const c of [...up.children]) if (c !== neck && c.position.y > headAt + 0.05 * s) head.attach(c);

  // the pose: out of initiative its rest pose (on a gown, weight on the right leg, the left knee forward in the slit); in
  // initiative its battle pose; every joint from the recipe's angles or a named preset
  const named = (p: PoseName | HeroPose | undefined) => typeof p === 'string' ? POSES[p] ?? POSES.rest : p;
  let P: HeroPose = (battle ? named(f.battlePose ?? f.stance) : undefined) ?? named(f.pose) ?? POSES.rest;
  if (P === POSES.rest && gown) P = { spine: [0, 0, 0.04], hipL: [-0.12, 0, 0], kneeL: 0.3, hipR: [0.02, 0, 0.03], kneeR: 0.02 };
  const mir = (e: Euler3 | undefined, sx: number, d: Euler3): Euler3 => e ? [e[0], e[1] * sx, e[2] * sx] : [d[0], d[1] * sx, d[2] * sx];
  if (P.spine) up.rotation.set(...P.spine);
  if (P.neck) neck.rotation.set(...P.neck);
  arm.forEach((l, k) => {
    const sx = k === 0 ? 1 : -1, sd = k === 0 ? 'R' : 'L';
    l.root.rotation.set(...mir(P[`shoulder${sd}`], sx, [-0.08, 0, 0.1]));
    l.mid.rotation.x = P[`elbow${sd}`] ?? -0.22;
    l.end.rotation.set(...mir(P[`wrist${sd}`], sx, [0.06, 0, 0]));
    const hold = P[`hold${sd}`], g = k === 0 ? gR : gL;
    if (hold?.upright) g.rotation.x = -(l.root.rotation.x + l.mid.rotation.x + l.end.rotation.x);
    if (hold?.tilt) { g.rotation.x += hold.tilt[0]; g.rotation.y += hold.tilt[1] * sx; g.rotation.z += hold.tilt[2] * sx; }
  });
  leg.forEach((l, k) => {
    const sx = k === 0 ? 1 : -1, sd = k === 0 ? 'R' : 'L', hip = mir(P[`hip${sd}`], sx, [0, 0, gown ? 0 : 0.04]), knee = P[`knee${sd}`] ?? 0, an = P[`ankle${sd}`] ?? [0, 0, 0];
    l.root.rotation.set(...hip); l.mid.rotation.x = knee;
    l.end.rotation.set(-(hip[0] + knee) + an[0], an[1] * sx, -hip[2] + an[2] * sx);
  });
  // on the floor (or, seated, the hips at the origin), then lifted
  body.updateMatrixWorld(true);
  if (P.seated) body.position.y -= 2.85 * s;
  else { let floor = Infinity; for (const m of soles) floor = Math.min(floor, new THREE.Box3().setFromObject(m).min.y); if (Number.isFinite(floor)) body.position.y -= floor; }
  body.position.y += P.lift ?? 0;
  const glowAt = (g: THREE.Object3D, p: THREE.Vector3, r: number) => { const c = f.glow ?? f.wisp ?? '#c9b3ff'; g.add(at(glassy(sph(r * s, c, 16, 12), c, 0.7), p.x, p.y, p.z)); g.add(at(glassy(sph(r * 1.8 * s, c, 16, 12), c, 0.18), p.x, p.y, p.z)); };
  if (P.spell === 'right') glowAt(gR, new THREE.Vector3(0, 0, 0.35 * s), 0.16);
  if (P.spell === 'between') {
    body.updateMatrixWorld(true);
    const p = new THREE.Vector3(); for (const l of arm) p.add(l.hand.getWorldPosition(new THREE.Vector3())); p.multiplyScalar(0.5);
    const q = up.worldToLocal(p); q.z += 0.35 * s; q.y += 0.15 * s; glowAt(up, q, 0.24);
  }
  const joints: Record<string, THREE.Object3D> = {};
  body.traverse((o) => { if (o.name) joints[o.name] = o; });
  body.userData.joints = joints;

  const out = new THREE.Group(); out.add(body); out.userData.joints = joints;
  if (f.sparkles) for (let i = 0; i < 16; i++) { const a = i * 2.39996, r = (1.1 + (i % 3) * 0.35) * s, y = (0.8 + ((i * 7) % 11) * 0.42) * s + (f.hoverFt ?? 0); out.add(at(glassy(sph((0.05 + (i % 3) * 0.02) * s, f.sparkles, 6, 4), f.sparkles, 0.85), Math.cos(a) * r, y, Math.sin(a) * r)); }
  if (f.hoverFt) body.position.y += f.hoverFt;
  return out;
}

/** A flat portrait token: the picture on a disc with a coloured rim, lying on the floor (radius in feet). The picture
 *  loads in the background; `onLoad` asks for a redraw. The texture is the token's own (freed with it). */
export function portraitDisc(url: string, color: string, radiusFt: number, onLoad?: () => void, thickFt = 0.12): THREE.Group {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(url, () => onLoad?.());
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(radiusFt * 0.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex }));
  (face.material as THREE.Material).userData.keepLook = true;
  face.position.y = thickFt + 0.02; face.userData.keepLook = true; face.renderOrder = 4;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radiusFt, radiusFt, thickFt, 40), mat(color));
  rim.position.y = thickFt / 2;
  g.add(rim, face);
  return g;
}
