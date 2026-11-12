// Hero figures: a player character's own miniature, built from a recipe the DM's party pack carries (core/partyPack.ts).
// Original low-poly geometry on the kit's humanoid (kit/creatures.ts), one palette material per colour, flat shading.
// The recipe is data, so no character of any one table lives in the repo: the parts are generic (pointed ears, wings,
// a halo, a thorn crown, a shield, an axe, a book ...) and the pack says which a character wears, in what colours.
import * as THREE from 'three';
import { mat, matClone } from '../render/materials';
import { HIP, SHIN, THIGH, clipRings, forearmRings, frameOf, loftGeometry, lockGeometry, neckRings, pelvisRings, ringAt, shinRings, thighRings, torsoRings, upperArmRings, type Frame, type Measures } from './anatomy';
import type { CreatureSize } from '../core/units';
import { faceFeatures, type FaceSpec, type FaceDetail } from './faces';

export type HeroWeapon = 'none' | 'sword' | 'axe' | 'mace' | 'staff' | 'spear' | 'torch';
export type HeroOffhand = 'none' | 'shield' | 'book' | 'orb';
export type HeroHair = 'short' | 'long' | 'braids' | 'curly';
/** two-handed: a great weapon raised across the body; shield: shield up, weapon raised high; cast: the book forward, the
 *  free hand thrust out with a spell; conjure: both hands forward round a gathering spell. */
export type HeroStance = 'two-handed' | 'shield' | 'cast' | 'conjure';
/** Named poses: the four battle stances, and rest, ride (seated astride, hands on the reins), lunge, menace (arms spread,
 *  hands clawed), cower, kneel, and staff-raised (a caster with the staff high). */
export type PoseName = 'rest' | HeroStance | 'ride' | 'lunge' | 'menace' | 'cower' | 'kneel' | 'staff-raised' | 'dead' | 'dead-prone' | 'dead-comic' | 'dead-swoon' | 'dead-curled';
export type Euler3 = [number, number, number];
/** Joint angles, radians. On x a negative angle swings forward; a negative elbow bends the forearm up, a positive knee
 *  bends the shin back. On the limbs y and z are mirrored: positive turns outward on either side. Ankles add to the
 *  automatic flat-foot correction (positive x points the toes). `hold` turns what a hand holds: upright keeps it
 *  vertical whatever the forearm does; tilt is added (mirrored). The figure is dropped until its lowest sole is on the
 *  floor, then raised by `lift` (feet); a seated pose puts the hip pivot at the origin instead. `spell` puts a glow in
 *  the right hand or between both. Fields left out stay at rest. */
export interface HeroPose {
  spine?: Euler3; neck?: Euler3; pelvis?: Euler3; collarR?: number; collarL?: number;
  shoulderR?: Euler3; elbowR?: number; wristR?: Euler3; shoulderL?: Euler3; elbowL?: number; wristL?: Euler3;
  hipR?: Euler3; kneeR?: number; ankleR?: Euler3; hipL?: Euler3; kneeL?: number; ankleL?: Euler3;
  holdR?: { upright?: boolean; tilt?: Euler3 }; holdL?: { upright?: boolean; tilt?: Euler3 };
  lift?: number; seated?: boolean; spell?: 'right' | 'between';
  /** Where the eyes look, [across, up] from -1 to 1 (default: worked out from the pose, see gazeOf). */
  gaze?: [number, number];
  /** Laid out on the floor (a body): on its back, its front or its side. */
  lie?: 'back' | 'front' | 'side';
}
/** Standing at ease, never square: weight on one leg, the hips and shoulders tilted against each other, the head
 *  turned, each arm hanging its own way. A character without a pose of its own takes one by its recipe. */
export const AT_EASE: HeroPose[] = [
  { pelvis: [0, 0.08, -0.11], spine: [0.03, -0.12, 0.17], neck: [0.04, 0.26, -0.13], hipR: [0.04, 0, 0.1], kneeR: 0.03, hipL: [-0.3, 0.3, 0.1], kneeL: 0.55, shoulderR: [-0.14, 0, 0.14], elbowR: -0.5, wristR: [0.15, 0, 0], shoulderL: [0.1, 0, 0.2], elbowL: -0.3 },
  { pelvis: [0, -0.1, 0.11], spine: [0.03, 0.14, -0.16], neck: [0.03, -0.28, 0.12], hipL: [0.05, 0, 0.1], kneeL: 0.03, hipR: [-0.3, 0.26, 0.1], kneeR: 0.58, shoulderR: [-0.25, 0, 0.16], elbowR: -0.65, shoulderL: [0.08, 0, 0.18], elbowL: -0.38, wristL: [0.15, 0, 0] },
  { pelvis: [0.02, 0.14, -0.09], spine: [-0.03, -0.2, 0.14], neck: [-0.04, 0.32, -0.1], hipR: [0.06, 0.1, 0.12], kneeR: 0.04, hipL: [-0.38, 0.35, 0.02], kneeL: 0.5, shoulderR: [-0.2, 0, 0.18], elbowR: -0.7, wristR: [0.1, 0, 0], shoulderL: [0.12, 0, 0.24], elbowL: -0.5 },
];
/** A gown's ease: weight on the right leg, the left knee forward in the slit, the hip thrown out. */
const GOWN_EASE: HeroPose = { pelvis: [0, 0.04, -0.1], spine: [0.0, 0.08, 0.16], neck: [0.05, -0.24, -0.13], hipL: [-0.2, 0.1, -0.06], kneeL: 0.42, hipR: [0.03, 0, 0.12], kneeR: 0.02, shoulderR: [-0.08, 0, 0.2], elbowR: -0.4, wristR: [0.2, 0, 0], shoulderL: [-0.1, 0, 0.12], elbowL: -0.3 };
export const POSES: Record<PoseName, HeroPose> = {
  rest: {},
  // a deep fighting lunge: the lead knee bent over its foot, the rear leg driven back, the body coiled over the weapon
  'two-handed': { pelvis: [0.08, -0.35, 0], spine: [0.2, 0.5, -0.05], neck: [-0.12, -0.2, 0.04], hipL: [-0.75, 0, 0.25], kneeL: 0.9, hipR: [0.45, 0, 0.3], kneeR: 0.25,
    shoulderR: [-0.9, 0, -0.1], elbowR: -1.5, wristR: [0.1, 0, 0], shoulderL: [-0.75, 0, -0.6], elbowL: -1.0, wristL: [0.2, 0, 0], holdR: { upright: true, tilt: [-0.35, 0, 0.6] } },
  // behind the shield: the shield side leading in a lunge, the shield across the body, the weapon arm cocked back at
  // the shoulder (elbow out, forearm up) with the weapon raised to strike
  shield: { pelvis: [0.06, 0.3, 0], spine: [0.16, -0.25, 0], neck: [-0.1, -0.05, 0], hipL: [-0.7, 0, 0.22], kneeL: 0.85, hipR: [0.45, 0, 0.3], kneeR: 0.25,
    shoulderL: [-0.5, 0, -0.15], elbowL: -1.1, holdL: { upright: true, tilt: [0, 0.35, 0] }, shoulderR: [-1.5, 0, 1.2], elbowR: -1.5, holdR: { tilt: [2.6, 0, 0.35] } },
  cast: { pelvis: [0.1, -0.1, 0.05], spine: [0.05, 0.3, -0.08], neck: [-0.05, -0.2, 0.05], hipR: [0.35, 0, 0.06], kneeR: 1.0, ankleR: [0.7, 0, 0], hipL: [-0.25, 0, 0.06], kneeL: 0.6, ankleL: [0.6, 0, 0],
    shoulderR: [-1.4, 0, 0.45], elbowR: -0.12, wristR: [1.05, 0, 0], shoulderL: [-0.35, 0, 0.15], elbowL: -1.15, holdL: { upright: true, tilt: [-0.3, 0, 0] }, lift: 0.8, spell: 'right' },
  conjure: { pelvis: [0.03, 0.12, -0.12], spine: [0.06, 0.3, 0.18], neck: [-0.1, -0.25, -0.06], hipL: [-0.35, 0, 0.05], kneeL: 0.5, hipR: [0.12, 0, 0.1], kneeR: 0.05,
    shoulderR: [-1.45, 0, 0.15], elbowR: -0.3, wristR: [0.9, 0, 0], shoulderL: [-0.3, 0, 0.1], elbowL: -1.0, holdL: { upright: true, tilt: [-0.35, 0, 0] }, spell: 'right' },
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
  // the dead: sprawled on the back; face down with an arm flung out; face-planted with the rump in the air; a swoon
  dead: { lie: 'back', neck: [-0.15, 0.7, 0.3], spine: [-0.08, 0.12, 0.14], pelvis: [0, -0.15, -0.08], shoulderR: [0.1, 0, 1.35], elbowR: -0.75, wristR: [0.5, 0, 0.3], shoulderL: [0.1, 0, 0.55], elbowL: -1.3, wristL: [0.4, 0, 0],
    hipR: [-0.1, 0.4, 0.4], kneeR: 0.15, ankleR: [0.6, 0, 0], hipL: [-0.55, 0.6, 0.2], kneeL: 1.2, ankleL: [0.7, 0, 0] },
  // face down, one arm folded behind the back, the other bent up by the head, one leg hitched out to the side
  'dead-prone': { lie: 'front', neck: [-0.2, 1.25, 0.1], spine: [-0.1, 0.22, -0.1], pelvis: [0, -0.2, 0.06], shoulderR: [0.75, 1.1, 0.3], elbowR: -1.7, wristR: [0.4, 0, 0], shoulderL: [-2.45, 0, 0.75], elbowL: -1.35,
    hipR: [0.12, 0, 0.1], kneeR: 0.12, ankleR: [0.95, 0, 0], hipL: [-0.95, 0, 0.8], kneeL: 1.55, ankleL: [0.9, 0, 0] },
  'dead-comic': { lie: 'front', pelvis: [0.95, 0, 0], spine: [-0.75, 0, 0.08], neck: [-0.2, 1.2, 0], shoulderR: [-0.2, 0, 0.95], elbowR: -0.3, wristR: [0.5, 0, 0], shoulderL: [-0.3, 0, 0.8], elbowL: -0.15,
    hipR: [-2.05, 0, 0.32], kneeR: 2.1, ankleR: [0.9, 0, 0], hipL: [-2.05, 0, 0.26], kneeL: 2.1, ankleL: [0.9, 0, 0] },
  'dead-swoon': { lie: 'back', pelvis: [0, 0.1, 0.12], spine: [-0.14, 0, -0.18], neck: [-0.3, -0.6, 0], shoulderR: [-2.3, 0, 0.5], elbowR: -2.2, wristR: [0.5, 0, 0], shoulderL: [0.05, 0, 1.0], elbowL: -0.35, wristL: [0.4, 0, 0],
    hipR: [-0.05, 0, 0.1], kneeR: 0.05, ankleR: [0.7, 0, 0], hipL: [-0.5, 0, -0.15], kneeL: 0.9, ankleL: [0.7, 0, 0] },
  // on its side, half curled: knees drawn up, one arm thrown forward, the head tucked
  'dead-curled': { lie: 'side', spine: [0.4, 0.1, 0], pelvis: [0.1, 0, 0], neck: [0.35, 0.2, 0.1], shoulderR: [-0.7, 0, -0.1], elbowR: -1.3, shoulderL: [-1.5, 0, 0.1], elbowL: -0.4, wristL: [0.5, 0, 0],
    hipR: [-0.95, 0, 0.05], kneeR: 1.2, ankleR: [0.6, 0, 0], hipL: [-0.6, 0, 0.05], kneeL: 0.95, ankleL: [0.6, 0, 0] },
  'staff-raised': { spine: [-0.05, 0, 0], neck: [-0.15, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: 0.4, hipR: [0.2, 0, 0.1], kneeR: 0.15,
    shoulderR: [-2.7, 0, 0.2], elbowR: -0.3, shoulderL: [-1.0, 0, 0.3], elbowL: -0.6, wristL: [0.8, 0, 0] },
};

/** The pose a figure takes: dead its dead pose, in initiative its battle pose, otherwise its own or one at ease. */
function poseOf(f: HeroFigure, battle: boolean, dead: boolean, gown: boolean): HeroPose {
  const named = (p: PoseName | HeroPose | undefined) => typeof p === 'string' ? POSES[p] ?? POSES.rest : p;
  let P: HeroPose = dead ? named(f.deadPose) ?? POSES.dead : (battle ? named(f.battlePose ?? f.stance) : undefined) ?? named(f.pose) ?? POSES.rest;
  if (P === POSES.rest) { let h = 0; for (const ch of (f.skin ?? '') + (f.hair ?? '') + (f.cloth ?? '') + (f.weapon ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; P = gown ? GOWN_EASE : AT_EASE[h % AT_EASE.length]; }
  return P;
}
/** Where the eyes look in a pose (its own `gaze`, or worked out): in a fight they stay on the foe ahead however the
 *  head and body are turned; at ease they lead the way the head is turning, and a dipped chin or a stoop looks up from under the brows. */
export function gazeOf(P: HeroPose, battle: boolean): [number, number] {
  if (P.gaze) return P.gaze;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v)), yaw = (P.neck?.[1] ?? 0) + (P.spine?.[1] ?? 0) + (P.pelvis?.[1] ?? 0), pitch = (P.neck?.[0] ?? 0) + (P.spine?.[0] ?? 0);
  return battle ? [clamp(-yaw / 0.45), clamp(pitch / 0.5)] : [clamp((P.neck?.[1] ?? 0) * 3), clamp(-0.05 + pitch * 1.5)];
}
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
  /** The character's own measures over the frame, from its art (multipliers; see `Measures`). */
  body?: Measures;
  /** The frame the body is sculpted on (default: feminine for a curvy build or a gown, otherwise masculine). */
  frame?: 'feminine' | 'masculine';
  /** Out of a fight the weapon is put away (slung on the back or hung at the belt); false keeps it in hand. */
  stow?: boolean;
  /** The battle stance the figure takes in initiative. */
  stance?: HeroStance;
  /** The pose out of initiative (default rest), in it (default the stance), and dead (default `dead`); a name or joint
   *  angles. */
  pose?: PoseName | HeroPose; battlePose?: PoseName | HeroPose; deadPose?: PoseName | HeroPose;
  /** A beard (its colour), fangs, and a tall standing collar behind the head (its colour). */
  beard?: string; fangs?: boolean; collar?: string;
  /** The character's own face (kit/faces.ts) in place of the standard one, and how finely it is modelled (1 to 4). */
  face?: FaceSpec; detail?: FaceDetail;
}

const SIZE_SCALE: Record<CreatureSize, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };

type M = THREE.Mesh;
const at = (m: M, x: number, y: number, z: number): M => { m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, c: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
const ball = (r: number, c: string, detail = 0) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(c));
const cone = (r: number, h: number, c: string, seg = 6) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c));
/** Switches the app sets for every figure it builds. `jiggle`: soft parts carry jiggle weights (render/jiggle.ts). */
export const heroOptions = { jiggle: false };
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

/** Faces are painted onto a clean head (the stylised look); false brings back the sculpted standard face below. */
const PAINTED_FACES = true as boolean;
/** The head, sculpted like a miniature's: one shaped skull (temples, cheekbones over hollow cheeks, a brow over deep-set
 *  eyes, a jaw that is square on a masculine frame and tapered on a feminine one, a chin), a wedge of a nose, small
 *  shadowed eyes under lids, brows, lips with a philtrum, and ears. The eyes sit on the midline; brow, nose and chin
 *  split the face in thirds. Returns the face's depth at (x, y), to seat other features. */
function buildFace(head: THREE.Group, s: number, hy: number, f: HeroFigure, fem = false, dead = false, gaze?: [number, number]): (x: number, y: number) => number {
  const skin = f.skin ?? '#d9b899', shade = tone(skin, '#1e1216', 0.3), deep = tone(skin, '#1e1216', 0.5), hair = f.hair ?? '#3a2a1a';
  const lip = f.lips ?? tone(skin, '#8a3038', fem ? 0.4 : 0.2);
  if (f.face || PAINTED_FACES) {
    // the painted face (kit/faces.ts + kit/facepaint.ts), every figure's default; `face` gives a character its own
    // the character's own face (kit/faces.ts): the whole head from its recipe, with this figure's ears on it; the hair is
    // buildHair's, as for every other head
    const fg = faceFeatures({ ...f.face, gaze: f.face?.gaze ?? gaze }, { skin, hair: f.hair, eyes: f.eyes, lips: f.lips, detail: f.detail ?? 2, fem, dead }); fg.scale.setScalar(0.4 * s); fg.position.set(0, hy, 0); head.add(fg);
    if (f.ears !== 'pointed') for (const sx of [-1, 1]) { const e = sph(0.075 * s, skin); e.scale.set(0.42, 1, 0.65); head.add(at(e, sx * 0.345 * s, hy - 0.02 * s, -0.01 * s)); }
    return (x: number, y: number) => 0.345 - 1.4 * x * x - (y > 0 ? 1.0 : 0.45) * y * y;
  }
  const R = 0.4, g = new THREE.SphereGeometry(1, 56, 42), p = g.attributes.position as THREE.BufferAttribute;
  const bump = (x: number, y: number, cx: number, cy: number, wx: number, wy = wx) => Math.exp(-((x - cx) ** 2 / wx + (y - cy) ** 2 / wy));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fz = Math.max(0, z), low = Math.max(0, -y), ax = Math.abs(x);
    // the skull narrows to the jaw: square-cornered on a masculine frame, a soft taper on a feminine one
    x *= 0.84 * (fem ? 1 - 0.36 * low ** 1.7 : 1 - 0.24 * low ** 2.2);
    z *= 0.94 * (1 - 0.1 * low * low);
    if (z < 0 && y > -0.3) z *= 1.05;
    const sx = Math.abs(x);
    z += fz * (
      (fem ? 0.07 : 0.1) * bump(sx, y, 0, -0.84, 0.03, 0.02)                 // chin
      + 0.05 * bump(sx, y, 0, -0.52, 0.06, 0.03)                              // the mouth's mound
      + (fem ? 0.05 : 0.045) * bump(sx, y, 0.42, -0.1, 0.02, 0.012)           // cheekbones
      - (fem ? 0.035 : 0.06) * bump(sx, y, 0.36, -0.45, 0.02, 0.03)           // hollow cheeks
      + (fem ? 0.035 : 0.075) * Math.exp(-((y - 0.2) ** 2) / 0.004) * Math.max(0, z - 0.45) * (1 - 0.5 * bump(sx, y, 0, 0.2, 0.01)) // brow
      - 0.11 * bump(sx, y, 0.3, 0.03, 0.014, 0.008)                           // eye sockets
      - 0.03 * bump(sx, y, 0.62, 0.3, 0.02, 0.05));                           // temples
    if (!fem) x += Math.sign(x) * 0.05 * bump(ax, y, 0.62, -0.5, 0.02, 0.02) * (z > -0.2 ? 1 : 0); // the jaw's corner
    p.setXYZ(i, x * R * s, y * 1.14 * R * s, z * R * s);
  }
  g.computeVertexNormals();
  head.add(at(sm(g, skin), 0, hy, 0));
  const front: [number, number, number][] = []; for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0.1 * s) front.push([p.getX(i) / s, p.getY(i) / s, p.getZ(i) / s]);
  const surf = (x: number, y: number) => { let best = 0, bw = 0; for (const [vx, vy, vz] of front) { const w = 1 / (1e-4 + (vx - x) ** 2 + (vy - y) ** 2) ** 2; best += vz * w; bw += w; } return best / bw; };
  const add = (m: M, x: number, y: number, z: number) => head.add(at(m, x * s, hy + y * s, z * s));
  // nose: a wedge from the bridge to the tip, turned under to its base, with the nostrils' wings
  const nw = fem ? 0.85 : 1, nz = surf(0, -0.08);
  const nose = sm(loftGeometry([{ y: -0.18, w: 0.03 * nw, f: 0.012, b: 0.02 }, { y: -0.162, w: 0.046 * nw, f: 0.055 * nw, b: 0.02 }, { y: -0.135, w: 0.042 * nw, f: 0.07 * nw, b: 0.02 }, { y: -0.06, w: 0.032 * nw, f: 0.042 * nw, b: 0.02 }, { y: 0.03, w: 0.03 * nw, f: 0.018, b: 0.02 }, { y: 0.07, w: 0.03, f: 0.004, b: 0.02 }], s, { seg: 12, rows: 14 }), skin);
  head.add(at(nose, 0, hy, (nz - 0.012) * s));
  for (const sx of [-1, 1]) { const al = sph(0.022 * nw * s, skin, 10, 8); al.scale.set(1.1, 0.8, 1); add(al, sx * 0.042 * nw, -0.158, nz + 0.016); add(sph(0.008 * s, deep, 8, 6), sx * 0.022 * nw, -0.177, nz + 0.03); }
  for (const sx of [-1, 1]) {
    // the eyes, small and set deep: a sliver of white, the iris and pupil, a heavy upper lid, a lower lid, the lash line
    const ew = fem ? 1.08 : 1, ex = sx * 0.122, ez = surf(ex, 0) - 0.006;
    if (dead) for (const r of [-0.8, 0.8]) { const x = cap(0.007 * s, 0.075 * s, deep); x.rotation.z = r; add(x, ex, 0, ez + 0.03); } // crossed out
    else {
      const white = sph(0.04 * ew * s, '#e9e3d8', 16, 12); white.scale.set(1.3, 0.62, 0.6); add(white, ex, 0, ez);
      add(sph(0.021 * ew * s, f.eyes ?? '#4a3a2a', 14, 10), ex, -0.002, ez + 0.019);
      add(sph(0.0095 * ew * s, '#0e0b10', 8, 6), ex, -0.002, ez + 0.035);
      add(sph(0.0045 * s, '#ffffff', 6, 4), ex + 0.008, 0.006, ez + 0.041); // a glint
    }
    const lid = sm(new THREE.SphereGeometry(0.044 * ew * s, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), tone(skin, '#1e1216', 0.14)); lid.scale.set(1.32, 0.72, 0.68); lid.rotation.x = 0.3; add(lid, ex, 0.003, ez);
    const under = sm(new THREE.SphereGeometry(0.044 * ew * s, 16, 6, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32), tone(skin, '#1e1216', 0.08)); under.scale.set(1.3, 0.7, 0.66); under.rotation.x = -0.15; add(under, ex, 0.0, ez);
    head.add(tube([-0.055, -0.02, 0.02, 0.055].map((dx, k) => new THREE.Vector3((ex + dx * ew) * s, hy + (0.012 + (k === 1 || k === 2 ? 0.012 : 0) + (k === 3 && sx > 0 || k === 0 && sx < 0 ? 0.006 : 0)) * s, (ez + 0.022 + (k === 1 || k === 2 ? 0.006 : 0)) * s)), (fem ? 0.007 : 0.005) * s, deep));
    // the brow: thick at the nose, tapering out along the ridge
    const bp = [0.045, 0.09, 0.14, 0.195].map((ax, k) => new THREE.Vector3(sx * ax * s, hy + ([0.07, 0.088, 0.094, 0.078][k] + (fem ? 0.012 : 0)) * s, (surf(sx * ax, 0.085) + 0.006) * s));
    head.add(sm(lockGeometry(bp, (fem ? 0.013 : 0.02) * s, 0.005 * s, 0.6, 6, 0.1), hair, true));
    if (f.ears !== 'pointed') { // the ear: its rim and the hollow inside it
      const e = sph(0.078 * s, skin, 12, 10); e.scale.set(0.34, 1, 0.62); e.rotation.z = -sx * 0.12; add(e, sx * 0.335, -0.03, -0.02);
      const hol = sph(0.045 * s, shade, 10, 8); hol.scale.set(0.3, 1, 0.6); add(hol, sx * 0.348, -0.025, -0.01);
    }
  }
  // lips: a bowed upper lip under the philtrum, a fuller lower one, the line between them
  const mz = surf(0, -0.265), lw = fem ? 1 : 0.92;
  for (const sx of [-1, 1]) { const u = sph(0.034 * s, lip, 12, 8); u.scale.set(1.25 * lw, 0.36, 0.5); u.rotation.z = sx * 0.16; add(u, sx * 0.026 * lw, -0.246, mz + 0.004); }
  const lo1 = sph(0.048 * lw * s, tone(lip, '#ffffff', 0.08), 16, 10); lo1.scale.set(1.05, fem ? 0.44 : 0.36, 0.5); add(lo1, 0, -0.276, mz + 0.001);
  head.add(tube([-0.058, -0.02, 0.02, 0.058].map((x) => new THREE.Vector3(x * lw * s, hy + (-0.259 - Math.abs(x) * 0.08) * s, (mz + 0.014 - Math.abs(x) * 0.25) * s)), 0.004 * s, deep));
  return surf;
}

/** Hair, sculpted in locks: a close under-layer following the hairline (a peak at the brow, back over the ears to the
 *  nape), then tapering locks laid from the parting, strand by strand. Styles: short (tousled, swept), long (falling
 *  past the shoulders, locks framing the face), braids (swept back to two roped braids over the shoulders), curly (a
 *  mass of coils). A streak colours the locks at the right temple. */
function buildHair(head: THREE.Group, s: number, hy: number, f: HeroFigure, fem: boolean): void {
  if (!f.hair) return;
  const H = f.hair, R = 0.4, style = f.hairStyle ?? 'short';
  let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  // a point on the scalp: azimuth from the front round through +x, elevation, and a lift off the skull
  const scalp = (az: number, el: number, lift = 1.06) => { const c = Math.cos(el), dz = Math.cos(az) * c; return new THREE.Vector3(Math.sin(az) * c * 0.84 * R * lift * s, hy + Math.sin(el) * 1.14 * R * lift * s, dz * (dz < 0 ? 0.99 : 0.94) * R * lift * s); };
  // the hairline: how low the hair comes at each azimuth (an elevation)
  const line = (az: number) => { const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))); return a < 0.25 ? 0.8 - 0.06 * (1 - a / 0.25) : a < 0.8 ? 0.8 + 0.07 * Math.sin((a - 0.25) * Math.PI / 0.55) : a < 1.3 ? 0.8 - 0.72 * (a - 0.8) / 0.5 : a < 1.8 ? 0.08 + 0.1 * Math.sin((a - 1.3) * Math.PI / 0.5) : 0.08 - 0.58 * Math.min(1, (a - 1.8) / 0.6); };
  // the under-layer: the skull's own shape, a little proud, combed in strands, cut at the hairline
  const cg = new THREE.SphereGeometry(1, 48, 28), cp = cg.attributes.position as THREE.BufferAttribute, keep: boolean[] = [];
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), az = Math.atan2(x, z), el = Math.asin(Math.max(-1, Math.min(1, y)));
    keep.push(el > line(az) - 0.04);
    const k = 1.045 + 0.012 * Math.sin(az * 26 + el * 5) + 0.006 * Math.sin(az * 61);
    cp.setXYZ(i, x * 0.84 * R * k * s, y * 1.14 * R * k * s, z * (z < 0 ? 0.99 : 0.94) * R * k * s);
  }
  const src = cg.index!, idx: number[] = []; for (let i = 0; i < src.count; i += 3) { const a = src.getX(i), b = src.getX(i + 1), c = src.getX(i + 2); if (keep[a] && keep[b] && keep[c]) idx.push(a, b, c); }
  cg.setIndex(idx); cg.computeVertexNormals(); head.add(at(sm(cg, tone(H, '#000000', 0.18), true), 0, hy, 0));
  const shadeOf = (i: number) => i % 3 === 0 ? tone(H, '#ffffff', 0.1) : i % 3 === 1 ? H : tone(H, '#000000', 0.14);
  const lock = (pts: THREE.Vector3[], r0: number, r1: number, i: number, c?: string, flat = 0.5) => head.add(sm(lockGeometry(pts, r0 * s, r1 * s, flat, 6), c ?? shadeOf(i), true));
  const part = fem ? 0.05 : 0.0; // the parting sits a little to one side
  const crown = (az: number) => new THREE.Vector3(Math.sin(az) * 0.03 * s + part * s, hy + 1.14 * R * 1.07 * s, -0.02 * s + Math.cos(az) * 0.03 * s);
  let streaks = 0; const streakAt = (az: number) => f.hairStreak && az > 0.6 && az < 1.2 && streaks++ < 3 ? f.hairStreak : undefined; // a streak: a few locks at the right temple

  if (style === 'short') {
    // tousled: three rows of short locks swept back and to the side, the front lifting off the brow
    for (let row = 0; row < 3; row++) for (let i = 0; i < 16; i++) {
      const az = (i / 16) * Math.PI * 2 + row * 0.2 + (rnd() - 0.5) * 0.15, e0 = 1.25 - row * 0.38, e1 = Math.max(line(az) + 0.03, e0 - 0.5 - rnd() * 0.15), sw = 0.25 + rnd() * 0.2;
      lock([scalp(az, e0, 1.08), scalp(az + sw * 0.5, (e0 + e1) / 2, 1.13 + rnd() * 0.03), scalp(az + sw, e1, 1.1 + rnd() * 0.04)], 0.06, 0.014, i + row, streakAt(az));
    }
  }
  if (style === 'long' || style === 'braids') {
    // from the parting over the skull: each lock runs down its own meridian
    const n = 26;
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < n; i++) {
      const az = 0.62 + (i + layer * 0.5) / n * (Math.PI * 2 - 1.24) + (rnd() - 0.5) * 0.05, back = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) / Math.PI;
      const pts = [crown(az), scalp(az, 1.05, 1.09 + layer * 0.03), scalp(az, 0.55, 1.12 + layer * 0.03), scalp(az, 0.1, 1.13 + layer * 0.03)];
      if (style === 'long') {
        const len = (0.95 + back * 0.55 - layer * 0.18 + rnd() * 0.15) * (fem ? 1 : 0.62), base = scalp(az, -0.25, 1.14 + layer * 0.03), wave = (rnd() - 0.5) * 0.08;
        pts.push(base);
        for (let k = 1; k <= 3; k++) { const t = k / 3; pts.push(new THREE.Vector3(base.x * (1 + 0.12 * t) + Math.sin(t * 5 + i) * wave * s, base.y - len * t * s, base.z * (1 + 0.1 * t) - (0.14 * (1 - back) + back * 0.12) * Math.sin(t * Math.PI / 2) * s - (1 - back) * 0.3 * t * s)); }
        lock(pts, 0.062, 0.018, i + layer, streakAt(az));
      } else {
        // braids: swept back and gathered low behind each ear
        const sx = Math.sin(az) >= 0 ? 1 : -1; pts.push(scalp(az * 0.5 + (sx > 0 ? 1.9 : Math.PI * 2 - 1.9) * 0.5, -0.32, 1.12)); lock(pts, 0.058, 0.03, i + layer, streakAt(az));
      }
    }
    // the fringe: locks from the parting swept across the brow to the temples
    for (let i = 0; i < 7; i++) { const az = -0.55 + i * 0.18 + part, to = az + (az > part ? 0.55 : -0.55); lock([crown(az), scalp(az, 1.0, 1.1), scalp((az + to) / 2, 0.72, 1.14), scalp(to, 0.66 + (i % 2) * 0.06, 1.1)], 0.055, 0.014, i); }
    if (style === 'long') for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { // locks framing the face, over the collarbone
      const az = sx * (0.95 + k * 0.16), top = scalp(az, 0.35, 1.1), len = (fem ? 0.72 : 0.5) - k * 0.15;
      lock([crown(az), scalp(az, 0.85, 1.1), top, new THREE.Vector3(top.x * 1.05, top.y - 0.3 * s, top.z + 0.05 * s), new THREE.Vector3(top.x * 1.0, top.y - len * 0.7 * s, top.z + 0.12 * s), new THREE.Vector3(top.x * 0.92, top.y - len * s, top.z + 0.16 * s)], 0.05, 0.014, k, sx > 0 && k === 0 ? f.hairStreak : undefined);
    }
    if (style === 'braids') for (const sx of [-1, 1]) {
      // two strands roped round each other down over the shoulder, bound twice, ending in a tuft
      const a = scalp(sx * 1.9, -0.32, 1.12), path = (t: number) => new THREE.Vector3(a.x + sx * 0.05 * t * s, a.y - 1.25 * t * s, a.z + (0.3 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)) * s);
      for (let k = 0; k < 2; k++) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 28; i++) { const t = i / 28, c = path(t), ph = t * 20 + k * Math.PI, rr = 0.045 * (1 - 0.35 * t) * s; pts.push(new THREE.Vector3(c.x + Math.cos(ph) * rr, c.y, c.z + Math.sin(ph) * rr)); } head.add(sm(lockGeometry(pts, 0.05 * s, 0.03 * s, 0.9, 7, 0), k ? H : tone(H, '#000000', 0.14), true)); }
      for (const t of [0.42, 0.9]) { const c = path(t), band = sm(new THREE.TorusGeometry(0.075 * (1 - 0.3 * t) * s, 0.018 * s, 6, 16), '#b8bec8'); band.rotation.x = Math.PI / 2; head.add(at(band, c.x, c.y, c.z)); }
      const e = path(1); for (let k = 0; k < 5; k++) lock([e, new THREE.Vector3(e.x + (k - 2) * 0.02 * s, e.y - 0.1 * s, e.z + 0.01 * s), new THREE.Vector3(e.x + (k - 2) * 0.035 * s, e.y - 0.2 * s, e.z)], 0.03, 0.006, k);
    }
  }
  if (style === 'curly') {
    // a mass of coils: each a little spiral springing off the scalp, bigger on top, hanging lower behind
    for (let i = 0; i < 60; i++) {
      const az = i * 2.39996 + rnd() * 0.3, el = Math.max(line(az) + 0.02, 1.45 - (i / 60) * 1.75), root = scalp(az, el, 1.05), out = root.clone().sub(new THREE.Vector3(0, hy, 0)).normalize();
      const side = new THREE.Vector3(-out.z, 0, out.x).normalize(), upv = new THREE.Vector3().crossVectors(out, side), len = (0.16 + rnd() * 0.12) * (el < 0.3 ? 1.5 : 1), rr = 0.045 + rnd() * 0.02, turns = 2.2 + rnd();
      const pts: THREE.Vector3[] = []; for (let k = 0; k <= 14; k++) { const t = k / 14, ph = t * turns * Math.PI * 2 + i; pts.push(root.clone().addScaledVector(out, len * t * s).addScaledVector(side, Math.cos(ph) * rr * s).addScaledVector(upv, Math.sin(ph) * rr * s).add(new THREE.Vector3(0, -len * 0.35 * t * t * s, 0))); }
      lock(pts, 0.04, 0.02, i, streakAt(az), 0.8);
    }
  }
}

/** A limb: the shoulder or hip (root), the elbow or knee (mid), the wrist or ankle (end). Angles about x: negative swings
 *  forward; a positive mid bends a knee, a negative one an elbow. */
export interface Limb { root: THREE.Group; mid: THREE.Group; end: THREE.Group; upper: M; lower: M; hand: M; collar?: THREE.Group; hs?: number }

/** The torso's line, waist to shoulders: [height, radius] in the upper body's frame (feet at scale 1, before the
 *  front-to-back squash). */
export function torsoProfile(build: HeroFigure['build'], frame?: HeroFigure['frame']): [number, number][] {
  return torsoRings(frameOf(frame ? frame === 'feminine' : build === 'curvy', build)).map((r) => [r.y, r.w]);
}
export const radiusAt = (p: [number, number][], y: number): number => {
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (y <= p[i][0]) { const [y0, r0] = p[i - 1], [y1, r1] = p[i], t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
  return p[p.length - 1][1];
};

/** The fitted gown's line, body frame, top (the waist) to the hem. */
const GK = HIP / 2.85; // the gown's heights were drawn for hips at 2.85
const GOWN: [number, number][] = ([[3.8, 0.45], [3.4, 0.64], [3.0, 0.83], [2.5, 0.72], [2.0, 0.6], [1.55, 0.52], [1.15, 0.54], [0.75, 0.72], [0.35, 1.0], [0.04, 1.26]] as [number, number][]).map(([y, r]) => [y * GK, r]);

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

export const frameFor = (f: HeroFigure): Frame => frameOf(f.frame ? f.frame === 'feminine' : f.build === 'curvy' || !!(f.skirt && f.underskirt), f.build, f.body);

/** The body, sculpted: a lofted torso and pelvis on a feminine or masculine frame, a neck, and limbs with their
 *  muscle (deltoid, biceps, forearm, thigh, calf), jointed at the collar, shoulder, elbow and wrist, and the hip, knee
 *  and ankle; hands with fingers; boots. The pelvis carries the legs and the upper body (`up`), which turns on it at
 *  the waist; the head sits at 2.82 in `up`'s frame. On a gown the shoulders, chest and legs are bare. */
function rig(f: HeroFigure, s: number, gown: boolean) {
  const fr = frameFor(f);
  const body = new THREE.Group(), pel = new THREE.Group(), up = new THREE.Group(); pel.position.y = HIP * s; pel.name = 'hips'; body.add(pel); pel.add(up); up.name = 'chest';
  const skin = f.skin ?? '#d9b899', cloth = f.armor?.color ?? f.cloth ?? '#2c3a2e', trim = f.trim ?? '#3a2a1c', boot = f.boots ?? '#2b2420';
  const tr = torsoRings(fr), torsoC = gown ? f.skirt! : cloth;
  const loft = (rings: Parameters<typeof loftGeometry>[0], c: string, o: Parameters<typeof loftGeometry>[2] = {}) => sm(loftGeometry(rings, s, o), c);
  // the seat: two full cheeks at the back of the hips, fuller on a feminine or curvy frame and with wider hips
  const seat = (fr.fem ? (fr.build === 'curvy' ? 0.62 : 0.48) : 0.26) * (0.4 + 0.6 * fr.m.hips);
  const seatBump = (th: number, y: number) => { const t = th > Math.PI ? th - 2 * Math.PI : th, back = Math.PI - Math.abs(t), dy = y + 0.1; return seat * Math.exp(-(dy * dy) / (dy > 0 ? 0.09 : 0.03)) * Math.exp(-((back - 0.42) ** 2) / 0.1); };
  pel.add(loft(pelvisRings(fr), gown ? f.skirt! : trim, { seg: 48, rows: 28, bump: seatBump }));
  // a band round a lofted part at a height (a strap, a fold, a hem), a little proud of it
  const band = (rings: Parameters<typeof loftGeometry>[0], y: number, h: number, k: number, c: string, seg = 16) => { const r = ringAt(rings, y); return sm(loftGeometry([{ ...r, y: y - h / 2 }, { ...r, y: y + h / 2 }], s, { seg, k, rows: 1 }), c); };
  // the chest's own shape: on a masculine frame the pectorals; the shoulder blades behind
  const chestBump = (th: number, y: number) => (fr.fem ? 0 : 0.07 * Math.exp(-((y - 1.62) ** 2) / 0.035) * Math.max(0, Math.cos(th)) ** 1.5 * (0.55 + 0.45 * Math.abs(Math.sin(th * 1.6))))
    + 0.04 * Math.exp(-((y - 1.7) ** 2) / 0.05) * Math.max(0, -Math.cos(th)) ** 2 * Math.abs(Math.sin(th * 2));
  // the bust is the body's own: two full mounds sculpted into the chest (rounder below than above, a valley between),
  // so skin shows their upper slope above a neckline and cloth lies over them below it
  const R = fr.bust, bcx = Math.max(ringAt(tr, 1.5).w * 0.47, R * 0.62), bcy = 1.53 - 0.32 * R, brx = R * 0.82, bdn = R * 0.9, bupr = R * 2.0, bH = R * 0.9;
  const bustWarp = (p: [number, number, number]): [number, number, number] => {
    if (!R || p[2] <= 0) return p;
    let h = 0, side = 0;
    for (const sx of [-1, 1]) {
      const u = (p[0] - sx * bcx) / brx, v = (p[1] - bcy) / (p[1] > bcy ? bupr : bdn); if (Math.abs(u) >= 1 || Math.abs(v) >= 1) continue;
      const hh = v > 0 ? Math.sqrt(1 - u * u) * Math.cos(v * Math.PI / 2) ** 1.6 : Math.sqrt(Math.max(0, 1 - u * u - v * v));
      if (hh > h) { h = hh; side = sx; }
    }
    if (!h) return p;
    const d = bH * h * Math.min(1, p[2] / 0.12); // fading out round the side of the ribs
    return [p[0] + side * 0.22 * d, p[1] - 0.12 * d, p[2] + d];
  };
  const bustJig = R && heroOptions.jiggle ? (p: [number, number, number]) => bustWarp(p)[2] - p[2] : undefined;
  if (gown) {
    // the dress to just under the bust, bare skin above (shoulders and the chest), the bust in the dress: a sweetheart line
    up.add(loft(clipRings(tr, tr[0].y, 1.57), torsoC, { seg: 80, rows: 64, warp: bustWarp, jig: bustJig }));
    up.add(loft(clipRings(tr, 1.3, 2.3), skin, { seg: 80, rows: 48, k: 0.985, bump: chestBump, warp: bustWarp, jig: bustJig }));
    if (R > 0.3) { const z = (y: number) => bustWarp([0, y, ringAt(tr, y).f])[2] * 0.985 + 0.004; up.add(tube([1.58, 1.68, 1.78, 1.86].map((y) => new THREE.Vector3(0, y * s, z(y) * s)), 0.012 * s, tone(skin, '#3a1418', 0.35))); } // the cleft
    for (const sx of [-1, 1]) up.add(tube([0.05, 0.2, 0.36, 0.5].map((x, i) => new THREE.Vector3(sx * x * s, (2.0 + [0, 0.025, 0.035, 0.06][i]) * s, (ringAt(tr, 2.0).f * [1.0, 0.98, 0.9, 0.72][i] + 0.004) * s)), 0.02 * s, tone(skin, '#ffffff', 0.07))); // collarbones
  } else {
    up.add(loft(tr, torsoC, fr.bust ? { seg: 80, rows: 90, bump: chestBump, warp: bustWarp, jig: bustJig } : { seg: 32, bump: chestBump }));
    const br = ringAt(tr, 0.42); up.add(sm(loftGeometry([{ ...br, y: 0.32 }, { ...br, y: 0.52 }], s, { seg: 32, k: 1.05, rows: 2 }), trim));
    if (!f.skirt) { const hem = drape(0.6 * s, 0.78 * s, 0.75 * s, cloth, { folds: 6, amp: 0.05, jag: 0.03 * s, seed: 0.2 }); hem.scale.z = 0.66; up.add(at(hem, 0, 0.0, 0)); }
    up.add(band(tr, 2.13, 0.07, 1.07, trim, 24));                                                      // the neckband
    const tail = box(0.1 * s, 0.5 * s, 0.03 * s, trim); tail.rotation.z = 0.12; up.add(at(tail, -0.2 * s, 0.17 * s, (br.f * 1.05 + 0.03) * s)); // the belt's tail
    up.add(at(box(0.11 * s, 0.05 * s, 0.035 * s, tone(trim, '#ffffff', 0.25)), -0.235 * s, -0.06 * s, (br.f * 1.05 + 0.032) * s));
  }
  const neck = new THREE.Group(); neck.position.y = 2.24 * s; neck.name = 'neck'; up.add(neck);
  neck.add(loft(neckRings(fr), skin, { seg: 16 }));
  if (!fr.fem) neck.add(at(sph(0.035 * s, skin, 8, 6), 0, 0.2 * s, 0.155 * s)); // the larynx
  const head = new THREE.Group(); head.position.y = 0.21 * s; head.name = 'head'; neck.add(head);
  // empty mounts for gear: the belt at each hip (sheaths hang down -y), and between the shoulder blades (+y up the back)
  for (const sx of [1, -1]) { const b = new THREE.Group(); b.name = sx > 0 ? 'beltR' : 'beltL'; b.position.set(sx * ringAt(tr, 0.42).w * s, 0.42 * s, 0.05 * s); up.add(b); }
  const back = new THREE.Group(); back.name = 'back'; back.position.set(0, 1.5 * s, -(ringAt(tr, 1.5).b + 0.12) * s); up.add(back);
  const arm: Limb[] = [], leg: Limb[] = [], soles: M[] = [];
  const upperC = gown ? skin : f.sleeves ?? cloth, lowerC = f.bracers ?? f.sleeves ?? (gown ? skin : cloth), handC = f.gauntlets ?? skin, a = fr.arm, hs = fr.hand;
  for (const sx of [1, -1]) {
    const side = sx > 0 ? 'R' : 'L';
    // the collar carries the shoulder: it lifts when the arm goes up
    const collar = new THREE.Group(); collar.position.set(sx * 0.12 * s, 1.98 * s, 0); collar.name = 'collar' + side; up.add(collar);
    const root = new THREE.Group(); root.position.set(sx * (fr.shoulderX - 0.12) * s, 0.02 * s, 0); root.rotation.set(-0.08, 0, sx * 0.1); root.name = 'shoulder' + side; collar.add(root);
    const delt = sph(0.185 * a * s, upperC, 16, 12); delt.scale.set(1.3, 1.2, 1.02); root.add(at(delt, -sx * 0.07 * s, -0.1 * s, 0)); // the deltoid, run in toward the collar so the arm grows out of the shoulder
    const upper = loft(upperArmRings(fr), upperC, { seg: 14 }); root.add(upper);
    if (f.puffSleeves && f.sleeves) {
      if (gown) { // off the shoulder: a gathered band round the upper arm with a ruffle below it
        const band = sm(new THREE.TorusGeometry(0.2 * s * a, 0.045 * s, 8, 20), f.sleeves); band.rotation.x = Math.PI / 2; root.add(at(band, 0, -0.36 * s, 0));
        const ruf = drape(0.2 * s * a, 0.3 * s * a, 0.3 * s, f.sleeves, { folds: 9, amp: 0.25, jag: 0.04 * s, seed: 1.3 }); root.add(at(ruf, 0, -0.52 * s, 0));
      } else { const puff = sph(0.25 * s * a, f.sleeves); puff.scale.set(1.05, 1.3, 1.05); root.add(at(puff, -sx * 0.04 * s, -0.36 * s, 0)); }
    }
    const mid = new THREE.Group(); mid.position.set(0, -1.12 * s, 0); mid.rotation.x = -0.22; mid.name = 'elbow' + side; root.add(mid);
    { const el = sph(0.128 * a * s, upperC, 12, 8); el.scale.y = 1.25; mid.add(el); }
    const lower = loft(forearmRings(fr), lowerC, { seg: 14 }); mid.add(lower);
    if (f.bracers) { mid.add(at(cyl(0.125 * s * a, 0.105 * s * a, 0.12 * s, f.bracers, 12), 0, -0.96 * s, 0)); mid.add(at(cyl(0.17 * s * a, 0.17 * s * a, 0.05 * s, tone(f.bracers, '#000000', 0.3), 12), 0, -0.3 * s, 0)); }
    const end = new THREE.Group(); end.position.set(0, -1.04 * s, 0); end.rotation.x = 0.06; end.name = 'wrist' + side; mid.add(end);
    // the hand: a palm, four fingers a little curled, and the thumb
    const hand = sph(0.105 * hs * s, handC, 12, 10); hand.scale.set(0.9, 1.15, 0.42); end.add(at(hand, 0, (-0.03 - 0.1 * hs) * s, 0.005 * s));
    for (let i = 0; i < 4; i++) {
      const len = [0.08, 0.095, 0.09, 0.07][i] * hs, x = (i - 1.5) * 0.047 * hs * -sx;
      const k1 = cap(0.024 * hs * s, len * s, handC); k1.rotation.x = -0.4; end.add(at(k1, x * s, (-0.03 - 0.205 * hs - len * 0.3) * s, 0.02 * s));
      const k2 = cap(0.021 * hs * s, len * 0.7 * s, handC); k2.rotation.x = -1.15; end.add(at(k2, x * s, (-0.03 - 0.27 * hs - len * 0.5) * s, 0.075 * hs * s));
    }
    const th = cap(0.029 * hs * s, 0.09 * hs * s, handC); th.rotation.z = -sx * 0.55; th.rotation.x = -0.5; end.add(at(th, -sx * 0.1 * hs * s, (-0.03 - 0.1 * hs) * s, 0.05 * s));
    arm.push({ root, mid, end, upper, lower, hand, collar, hs });

    const hx = gown ? 0.21 : fr.hipX, legC = gown ? skin : trim;
    const hip = new THREE.Group(); hip.position.set(sx * hx * s, 0, 0); hip.rotation.z = sx * 0.04; hip.name = 'hip' + side; pel.add(hip);
    const thigh = loft(thighRings(fr), legC, { seg: 16 }); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.set(0, -THIGH * s, 0); knee.name = 'knee' + side; hip.add(knee);
    { const kn = sph(0.17 * fr.leg * s, legC, 12, 10); kn.scale.y = 1.3; knee.add(at(kn, 0, 0, 0.01 * s)); }
    const shin = loft(shinRings(fr), legC, { seg: 14 }); knee.add(shin);
    // boots: the shaft to below the knee with a turned cuff, the foot, a heel and a sole
    knee.add(loft(clipRings(shinRings(fr), -SHIN, -0.55), boot, { seg: 14, k: 1.13 }));
    const cuffR = ringAt(shinRings(fr), -0.55); knee.add(sm(loftGeometry([{ ...cuffR, y: -0.65 }, { ...cuffR, y: -0.47 }], s, { seg: 14, k: 1.28, rows: 2 }), tone(boot, '#ffffff', 0.08)));
    for (const y of [-SHIN + 0.4]) { // a boot strap, buckled on the outside
      knee.add(band(shinRings(fr), y, 0.05, 1.2, tone(boot, '#000000', 0.4), 14));
      knee.add(at(box(0.03 * s, 0.07 * s, 0.07 * s, '#a9adb6'), sx * ringAt(shinRings(fr), y).w * 1.22 * s, y * s, 0.02 * s));
    }
    const ankle = new THREE.Group(); ankle.position.set(0, -SHIN * s, 0); ankle.name = 'ankle' + side; knee.add(ankle);
    ankle.add(sph(0.115 * fr.leg * s, boot, 12, 8));
    const fl = fr.fem ? 1.02 : 1.18; // the foot: instep, toe and heel
    const foot = sm(loftGeometry([{ y: -0.42, w: 0.15 * fl, f: 0.52 * fl, b: 0.2 * fl, z: 0.02 }, { y: -0.3, w: 0.165 * fl, f: 0.5 * fl, b: 0.21 * fl, z: 0.02 }, { y: -0.16, w: 0.14 * fl, f: 0.3 * fl, b: 0.17 * fl }, { y: -0.02, w: 0.125 * fl, f: 0.15 * fl, b: 0.14 * fl }], s, { seg: 16 }), boot);
    foot.name = 'foot' + side; ankle.add(foot);
    const sole = sm(loftGeometry([{ y: -0.47, w: 0.16 * fl, f: 0.53 * fl, b: 0.21 * fl, z: 0.02 }, { y: -0.41, w: 0.16 * fl, f: 0.53 * fl, b: 0.21 * fl, z: 0.02 }], s, { seg: 16, rows: 1 }), tone(boot, '#000000', 0.45)); ankle.add(sole); soles.push(sole);
    ankle.add(at(box(0.2 * fl * s, 0.1 * s, 0.16 * fl * s, tone(boot, '#000000', 0.45)), 0, -0.44 * s, -0.1 * fl * s)); // the heel
    leg.push({ root: hip, mid: knee, end: ankle, upper: thigh, lower: shin, hand: foot });
  }
  return { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig };
}

/** A hero's miniature: origin at the floor centre, feet in world units, facing +z. `battle` puts it in its stance. */
export function heroFigure(f: HeroFigure, size: CreatureSize = 'medium', state: boolean | 'rest' | 'battle' | 'dead' = false): THREE.Group {
  const battle = state === true || state === 'battle', dead = state === 'dead';
  const s = (SIZE_SCALE[size] ?? 1) * (f.height ?? 1);
  const gown = !!(f.skirt && f.underskirt);
  const { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig } = rig(f, s, gown);
  const hy = 2.82 * s; // the head's centre, in the upper body's frame
  const skin = f.skin ?? '#d9b899';
  const headAt = neck.position.y + head.position.y; // the head joint, in the upper body's frame
  const surf = buildFace(head, s, hy - headAt, f, fr.fem, dead, gazeOf(poseOf(f, battle, dead, gown), battle));
  const [R, Lf] = arm;
  // a group in each hand for what it holds: upright while the forearm hangs at rest
  const holder = (l: Limb) => { const g = new THREE.Group(); g.position.set(0, (-0.03 - 0.12 * (l.hs ?? 1)) * s, 0.05 * s); g.rotation.set(-(l.root.rotation.x + l.mid.rotation.x), 0, -Math.sign(l.root.position.x) * 0.08); l.end.add(g); return g; };
  const gR = holder(R), gL = holder(Lf); gR.name = 'handR'; gL.name = 'handL';
  const joints0: Record<string, THREE.Object3D> = {}; body.traverse((o) => { if (o.name) joints0[o.name] = o; });
  if (f.weapon === 'sword') gR.add(at(box(0.12 * s, 2.6 * s, 0.32 * s, '#c8ccd2'), 0, 1.45 * s, 0), at(box(0.7 * s, 0.12 * s, 0.14 * s, '#a07a3a'), 0, 0.15 * s, 0), at(box(0.12 * s, 0.5 * s, 0.12 * s, '#3b2a20'), 0, -0.15 * s, 0));
  if (f.weapon === 'spear') gR.add(at(box(0.12 * s, 7 * s, 0.12 * s, '#3b2a20'), 0, 0.85 * s, 0), at(cone(0.2 * s, 0.8 * s, '#c8ccd2'), 0, 4.75 * s, 0));
  if (f.weapon === 'staff') gR.add(at(box(0.14 * s, 6 * s, 0.14 * s, '#3b2a20'), 0, 0.45 * s, 0));
  if (f.weapon === 'torch') gR.add(at(box(0.14 * s, 1.6 * s, 0.14 * s, '#3b2a20'), 0, 0.55 * s, 0), at(sph(0.32 * s, '#f0a040'), 0, 1.55 * s, 0));

  // face extras
  if (f.earrings) for (const sx of [-1, 1]) { const e = sph(0.05 * s, f.earrings, 8, 6); e.scale.y = 1.8; up.add(at(e, sx * 0.36 * s, hy - 0.2 * s, 0.02 * s)); up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), sx * 0.36 * s, hy - 0.1 * s, 0.02 * s)); }
  if (f.markings) for (const [x, y, rz] of [[0.17, -0.1, 0.6], [0.2, 0.03, -0.3], [-0.18, -0.11, -0.5], [0.1, -0.2, 0.9]]) { const m = cap(0.011 * s, 0.11 * s, f.markings); m.rotation.z = rz; m.rotation.y = Math.sign(x) * 0.5; head.add(at(m, x * s, (hy - headAt + y) * s, (surf(x, y) + 0.004) * s)); }

  // collar, pendant, buckle
  if (f.shirt) { const c = cyl(0.24 * s, 0.32 * s, 0.32 * s, f.shirt, 7); up.add(at(c, 0, 2.2 * s, 0.08 * s)); up.add(at(box(0.3 * s, 0.5 * s, 0.06 * s, f.shirt), 0, 1.85 * s, 0.4 * s)); for (let i = 0; i < 3; i++) up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), 0, (1.95 - i * 0.15) * s, 0.44 * s)); }
  if (f.pendant) {
    const fz = (x: number, y: number) => bustWarp([x, y, ringAt(tr, y).f * Math.sqrt(Math.max(0, 1 - (x / ringAt(tr, y).w) ** 2))])[2] + 0.025; // the chest's front at a point
    const v = (x: number, y: number) => new THREE.Vector3(x * s, y * s, fz(x, y) * s);
    up.add(tube([new THREE.Vector3(-0.22 * s, 2.25 * s, 0.25 * s), v(-0.1, 1.9), v(0, 1.78), v(0.1, 1.9), new THREE.Vector3(0.22 * s, 2.25 * s, 0.25 * s)], 0.012 * s, '#b8bec8'));
    const g = sm(new THREE.OctahedronGeometry(0.08 * s), f.pendant); g.scale.y = 1.7; up.add(at(g, 0, 1.66 * s, (fz(0, 1.66) + 0.03) * s));
  }
  if (f.buckle) { up.add(at(box(0.24 * s, 0.2 * s, 0.06 * s, f.buckle), 0, 0.42 * s, 0.63 * s)); up.add(at(box(0.12 * s, 0.1 * s, 0.07 * s, f.trim ?? '#2b2420'), 0, 0.42 * s, 0.64 * s)); }

  // a laced bodice: a corset that follows the torso's line, the lacing crossing down its front
  if (f.bodice) {
    const lo = 0.45, hi = fr.bust ? Math.min(1.3, 1.53 - 0.85 * fr.bust) : gown ? 1.4 : 1.3, lc = f.bodice.lacing ?? '#b08a4a';
    up.add(sm(loftGeometry(clipRings(tr, lo, hi), s, { seg: fr.bust ? 72 : 32, rows: fr.bust ? 36 : undefined, k: 1.07, warp: bustWarp, jig: bustJig }), f.bodice.color));
    for (const y of [lo, hi]) { const r = ringAt(tr, y); up.add(sm(loftGeometry([{ ...r, y: y - 0.025 }, { ...r, y: y + 0.025 }], s, { seg: 32, k: 1.1, rows: 1 }), tone(f.bodice.color, '#000000', 0.3))); }
    for (let i = 0; i < 5; i++) { const y = lo + 0.08 + i * (hi - lo - 0.16) / 4, z = ringAt(tr, y).f * 1.07 + 0.012; for (const sx of [-1, 1]) { const x = box(0.2 * s, 0.025 * s, 0.025 * s, lc); x.rotation.z = sx * 0.5; up.add(at(x, 0, y * s, z * s)); } }
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const y = lo + 0.06 + i * (hi - lo - 0.12) / 5; up.add(at(sph(0.018 * s, lc, 6, 4), sx * 0.08 * s, y * s, (ringAt(tr, y).f * 1.07 + 0.01) * s)); }
    for (const a of [-0.9, 0.9, -2.2, 2.2]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 6; i++) { const y = lo + (hi - lo) * i / 6, r = ringAt(tr, y), e = 2 / (r.n ?? 2), sn = Math.sin(a), cs = Math.cos(a); pts.push(new THREE.Vector3(Math.sign(sn) * Math.abs(sn) ** e * r.w * 1.08 * s, y * s, Math.sign(cs) * Math.abs(cs) ** e * (cs >= 0 ? r.f : r.b) * 1.08 * s)); } up.add(tube(pts, 0.012 * s, tone(f.bodice.color, '#000000', 0.35))); } // boning
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
  if (f.skirt && !gown) { const k = drape(0.66 * s, 1.05 * s, 2.6 * s, f.skirt, { folds: 7, amp: 0.1, jag: 0.05 * s, seed: 0.4 }); k.scale.z = 0.8; body.add(at(k, 0, (HIP - 1.1) * s, 0)); }
  if (gown) {
    const g = sheath(GOWN.map(([y, r]) => [y * s, r * s] as [number, number]), f.skirt!, { zs: 0.68, slitAt: -0.42, slitTop: 2.85 * GK * s, slitW: 1.0, flareFrom: 1.3 * GK * s, folds: 9, amp: 0.1, train: 0.35 });
    body.add(g.mesh);
    const fr = drape(1.12 * s, 1.3 * s, 0.24 * s, f.underskirt!, { folds: 22, amp: 0.2, jag: 0.06 * s, seed: 2 }); fr.scale.z = 0.72; body.add(at(fr, 0, 0.12 * s, -0.04 * s));
    if (f.gownTrim) {
      const hem: THREE.Vector3[] = []; for (let i = 0; i <= 48; i++) hem.push(g.point(0.06 * s, i / 48, 1.015));
      body.add(tube(hem, 0.025 * s, f.gownTrim));
      for (const u of [0, 1]) {
        const edge: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) edge.push(g.point((2.85 - i * 0.279) * GK * s, u, 1.01));
        body.add(tube(edge, 0.02 * s, f.gownTrim));
        for (let i = 1; i < 10; i += 2) { const q = edge[i], leaf = sph(0.045 * s, f.gownTrim, 6, 4); leaf.scale.set(0.5, 1, 0.25); leaf.rotation.z = (u ? 1 : -1) * (i % 4 === 1 ? 0.7 : -0.7); body.add(at(leaf, q.x, q.y, q.z + 0.02 * s)); }
      }
      { const r = ringAt(tr, 1.57); up.add(sm(loftGeometry([{ ...r, y: 1.55 }, { ...r, y: 1.585 }], s, { seg: 80, k: 1.015, rows: 1, warp: bustWarp, jig: bustJig }), f.gownTrim)); } // the neckline's edge
      const belt: THREE.Vector3[] = []; for (let i = 0; i <= 32; i++) belt.push(g.point(3.72 * GK * s, i / 32, 1.02));
      body.add(tube(belt, 0.022 * s, f.gownTrim, false));
    }
  }


  // pointed ears
  if (f.ears === 'pointed') for (const sx of [-1, 1]) { const e = sm(new THREE.ConeGeometry(0.09 * s, 0.5 * s, 8), skin); e.scale.z = 0.45; e.position.set(sx * 0.36 * s, hy + 0.06 * s, -0.02 * s); e.rotation.z = -sx * 1.05; e.rotation.x = -0.35; up.add(e); }

  buildHair(head, s, hy - headAt, f, fr.fem);

  // armour
  if (f.armor?.kind === 'plate') {
    const t = f.armor.trim ?? '#a9adb6';
    for (const sx of [-1, 1]) { const p = ball(0.5 * s, f.armor.color, 1); p.scale.set(1.05, 0.62, 1); up.add(at(p, sx * 0.78 * s, 2.12 * s, 0)); up.add(at(box(0.62 * s, 0.08 * s, 0.7 * s, t), sx * 0.8 * s, 1.95 * s, 0)); }
    up.add(at(cyl(0.34 * s, 0.42 * s, 0.3 * s, t), 0, 2.28 * s, 0));                          // gorget
    up.add(at(box(0.9 * s, 0.08 * s, 0.08 * s, t), 0, 1.5 * s, 0.42 * s));                       // breastplate edge
    for (const sx of [-1, 1]) { const p2 = ball(0.42 * s, f.armor.color, 1); p2.scale.set(1, 0.5, 0.95); up.add(at(p2, sx * 0.86 * s, 1.78 * s, 0)); up.add(at(box(0.5 * s, 0.06 * s, 0.62 * s, t), sx * 0.88 * s, 1.62 * s, 0)); }
    up.add(at(box(0.5 * s, 0.06 * s, 0.06 * s, t), 0, 0.95 * s, 0.4 * s));                         // a second band
    up.add(sm(loftGeometry(clipRings(tr, 0.62, 1.95), s, { seg: fr.bust ? 72 : 32, rows: fr.bust ? 60 : undefined, k: 1.09, warp: bustWarp, jig: bustJig, bump: (th, y) => 0.05 * Math.exp(-((y - 1.5) ** 2) / 0.08) * Math.max(0, Math.cos(th)) ** 2 + 0.03 * Math.max(0, Math.cos(th)) ** 12 }), f.armor.color)); // the breastplate, ridged down its centre
    for (let i = 0; i < 3; i++) { const y = 0.5 - i * 0.2, r = ringAt(tr, Math.max(0.1, y)); up.add(sm(loftGeometry([{ ...r, y: y - 0.11 }, { ...r, y: y + 0.1 }], s, { seg: 28, k: 1.12 + i * 0.07, rows: 1 }), i % 2 ? tone(f.armor.color, '#ffffff', 0.06) : f.armor.color)); } // the fauld
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; up.add(at(sph(0.028 * s, t, 6, 4), sx * (0.8 + Math.cos(a) * 0.28) * s, 1.96 * s, Math.sin(a) * 0.36 * s)); } // rivets on the pauldrons' rims
    const knot = sm(new THREE.TorusKnotGeometry(0.1 * s, 0.022 * s, 48, 6, 2, 3), t); up.add(at(knot, 0, 1.25 * s, 0.44 * s)); // a knotwork boss
    for (const l of leg) {                                                                              // knees and greaves
      const cop = sph(0.2 * fr.leg * s, f.armor.color, 12, 8); cop.scale.set(1, 1.1, 0.9); l.mid.add(at(cop, 0, 0.0, 0.1 * s));
      l.mid.add(sm(loftGeometry(clipRings(shinRings(fr), -1.05, -0.12), s, { seg: 14, k: 1.22 }), f.armor.color));
      for (const y of [-0.18, -1.0]) { const r = ringAt(shinRings(fr), y); l.mid.add(sm(loftGeometry([{ ...r, y: y - 0.03 }, { ...r, y: y + 0.03 }], s, { seg: 14, k: 1.3, rows: 1 }), t)); }
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

  // out of a fight a weapon is put away, never carried drawn: a long one slung across the back, a short one at the belt
  if (!battle && !dead && f.stow !== false && f.weapon && f.weapon !== 'none' && f.weapon !== 'staff' && f.weapon !== 'torch') {
    const long = f.weapon === 'axe' || f.weapon === 'spear' || f.weapon === 'sword', st = new THREE.Group(); st.name = 'stowed';
    for (const c of [...gR.children]) st.add(c);
    if (long) { st.rotation.set(0, Math.PI, 0.5); st.position.set(-0.55 * s, -(f.weapon === 'sword' ? 1.0 : 1.5) * s, -0.08 * s); joints0.back.add(st); }
    else { st.rotation.set(Math.PI + 0.12, 0, 0.1); st.position.set(0.24 * s, 0.55 * s, 0.12 * s); joints0.beltR.add(st); }
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
  if (f.wisp && !dead) {
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
  if (f.halo && !dead) {
    // a halo of light, not of metal: thin see-through rings of gold glowing into each other, a faint disc within, faint rays
    const lit = (m: M, o: number) => { const g = glassy(m, f.halo!, o); const mt = g.material as THREE.MeshLambertMaterial; mt.blending = THREE.AdditiveBlending; mt.emissive = new THREE.Color(f.halo!); mt.emissiveIntensity = 0.6; return g; };
    const hp = new THREE.Vector3(0, hy + 0.3 * s, -0.42 * s);
    for (const [r, o] of [[0.022, 0.36], [0.06, 0.2], [0.12, 0.1], [0.2, 0.05]] as [number, number][]) { const g = lit(new THREE.Mesh(new THREE.TorusGeometry(0.62 * s, r * s, 10, 48)), o); g.position.copy(hp); up.add(g); }
    const disc = lit(new THREE.Mesh(new THREE.CircleGeometry(0.6 * s, 40)), 0.06); disc.position.copy(hp); up.add(disc);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, ray = lit(cone(0.022 * s, 0.3 * s, f.halo, 4), 0.16); ray.rotation.z = a - Math.PI / 2; up.add(at(ray, Math.cos(a) * 0.84 * s, hp.y + Math.sin(a) * 0.84 * s, -0.44 * s)); }
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
  const P = poseOf(f, battle, dead, gown);
  const mir = (e: Euler3 | undefined, sx: number, d: Euler3): Euler3 => e ? [e[0], e[1] * sx, e[2] * sx] : [d[0], d[1] * sx, d[2] * sx];
  if (P.spine) up.rotation.set(...P.spine);
  if (P.pelvis) pel.rotation.set(...P.pelvis);
  if (P.neck) neck.rotation.set(...P.neck);
  arm.forEach((l, k) => {
    const sx = k === 0 ? 1 : -1, sd = k === 0 ? 'R' : 'L';
    l.root.rotation.set(...mir(P[`shoulder${sd}`], sx, [-0.08, 0, 0.1]));
    l.mid.rotation.x = P[`elbow${sd}`] ?? -0.22;
    if (l.collar) l.collar.rotation.z = sx * (P[`collar${sd}`] ?? Math.min(0.4, Math.max(0, (-l.root.rotation.x - 0.9) * 0.28)));
    l.end.rotation.set(...mir(P[`wrist${sd}`], sx, [0.06, 0, 0]));
    const hold = P[`hold${sd}`], g = k === 0 ? gR : gL;
    if (hold?.upright) g.rotation.x = -(l.root.rotation.x + l.mid.rotation.x + l.end.rotation.x);
    if (hold?.tilt) { g.rotation.x += hold.tilt[0]; g.rotation.y += hold.tilt[1] * sx; g.rotation.z += hold.tilt[2] * sx; }
  });
  // an empty hand at ease hangs with its palm to the thigh, not turned out to the front
  if (!P.lie && !battle) arm.forEach((l, k) => { const sd = k === 0 ? 'R' : 'L', g = k === 0 ? gR : gL; if (!P[`wrist${sd}`]?.[1] && !g.children.length) l.end.rotation.y = (k === 0 ? 1 : -1) * 1.25; });
  const standing = !P.lie && !P.seated && !P.lift;
  const legSet = leg.map((l, k) => {
    const sx = k === 0 ? 1 : -1, sd = k === 0 ? 'R' : 'L', hip = mir(P[`hip${sd}`], sx, [0, 0, gown ? 0 : 0.04]), an = P[`ankle${sd}`];
    l.root.rotation.set(...hip); l.mid.rotation.x = P[`knee${sd}`] ?? 0;
    return { l, sx, an };
  });
  // feet: a standing figure's soles lie flat on the floor whatever the hips and spine are doing, the toes following
  // the leg's own turn; a lying, seated or lifted one takes its ankles from the pose
  const pq = new THREE.Quaternion(), fwd = new THREE.Vector3();
  const setFeet = () => {
    body.updateMatrixWorld(true);
    for (const { l, sx, an } of legSet) {
      const a = an ?? [0, 0, 0];
      if (!standing || an) { l.end.rotation.set(-(l.root.rotation.x + l.mid.rotation.x) + a[0], a[1] * sx, -l.root.rotation.z + a[2] * sx); continue; }
      l.root.getWorldQuaternion(pq); fwd.set(0, 0, 1).applyQuaternion(pq); const yaw = Math.atan2(fwd.x, fwd.z);
      l.mid.getWorldQuaternion(pq); l.end.quaternion.copy(pq.invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    }
    body.updateMatrixWorld(true);
  };
  const soleY = (k: number) => new THREE.Box3().setFromObject(soles[k]).min.y;
  setFeet();
  // both feet on the ground: the higher foot comes down by straightening its knee; when that is not enough the
  // standing leg bends and the hips sink onto it (a foot the pose lifts well clear is left in the air)
  if (standing && !gown && soles.length === 2 && !legSet.some((x) => x.an)) {
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
    // move one ankle up or down by dy, holding its place over the floor, by the hip's swing and the knee's bend
    const shift = (k: number, dy: number) => {
      const L = leg[k]; L.end.getWorldPosition(p0); const ty = p0.y + dy;
      const cost = () => { setFeet(); L.end.getWorldPosition(p1); return (p1.y - ty) ** 2 + 0.3 * ((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2); };
      let best = cost();
      for (let st = 0.2; st > 0.004; st *= 0.6) for (let pass = 0; pass < 3; pass++) for (const [o, lo, hi] of [[L.root.rotation, -2.2, 1.2], [L.mid.rotation, 0, 2.4]] as [THREE.Euler, number, number][]) for (const d of [st, -st]) {
        const was = o.x; o.x = Math.max(lo, Math.min(hi, was + d)); const c = cost(); if (c < best - 1e-9) best = c; else o.x = was;
      }
      setFeet();
    };
    const gapOf = () => { const y0 = soleY(0), y1 = soleY(1); return { hi: y0 > y1 ? 0 : 1, gap: Math.abs(y0 - y1) }; };
    let g = gapOf();
    if (g.gap > 0.012 * s && g.gap < 0.4 * s) {
      shift(g.hi, -g.gap); g = gapOf();
      if (g.gap > 0.012 * s) { shift(1 - g.hi, g.gap); }
    }
  }
  // a second hand on a long weapon: the free hand reaches for the haft and takes hold of it
  if (battle && !dead && !gL.children.length && gR.children.length && (f.weapon === 'axe' || f.weapon === 'spear' || f.weapon === 'staff') && (f.battlePose ?? f.stance) === 'two-handed') {
    const A = arm[1], want = new THREE.Vector3(), at0 = new THREE.Vector3();
    const reach = (ty: number, apply: boolean) => {
      const keep: [number, number, number, number] = [A.root.rotation.x, A.root.rotation.y, A.root.rotation.z, A.mid.rotation.x];
      body.updateMatrixWorld(true); want.set(0, ty * s, 0); gR.localToWorld(want);
      const err = () => { A.collar!.updateMatrixWorld(true); return gL.getWorldPosition(at0).distanceTo(want); };
      let best = err();
      for (let st = 0.4; st > 0.01; st *= 0.6) for (let pass = 0; pass < 4; pass++) for (const [o, key, lo, hi] of [[A.root.rotation, 'x', -3, 0.6], [A.root.rotation, 'z', -1.7, 1.2], [A.root.rotation, 'y', -1.2, 1.2], [A.mid.rotation, 'x', -2.4, 0]] as [THREE.Euler, 'x' | 'y' | 'z', number, number][]) for (const d of [st, -st]) {
        const was = o[key]; o[key] = Math.max(lo, Math.min(hi, was + d)); const e = err(); if (e < best) best = e; else o[key] = was;
      }
      if (!apply) { A.root.rotation.set(keep[0], keep[1], keep[2]); A.mid.rotation.x = keep[3]; A.collar!.updateMatrixWorld(true); }
      return best;
    };
    reach(reach(1.0, false) <= reach(-0.75, false) ? 1.0 : -0.75, true);
    body.updateMatrixWorld(true);
  }
  // on the floor (or, seated, the hips at the origin), over the middle of its base, then lifted
  if (P.seated) body.position.y -= HIP * s;
  else { let floor = Infinity; for (const m of soles) floor = Math.min(floor, new THREE.Box3().setFromObject(m).min.y); if (Number.isFinite(floor)) body.position.y -= floor; }
  if (standing && soles.length) { const bb = new THREE.Box3(); for (const m of soles) bb.expandByObject(m); body.position.x -= (bb.min.x + bb.max.x) / 2; body.position.z -= (bb.min.z + bb.max.z) / 2; }
  body.position.y += P.lift ?? 0;
  const glowAt = (g: THREE.Object3D, p: THREE.Vector3, r: number) => { const c = f.glow ?? f.wisp ?? '#c9b3ff'; g.add(at(glassy(sph(r * s, c, 16, 12), c, 0.7), p.x, p.y, p.z)); g.add(at(glassy(sph(r * 1.8 * s, c, 16, 12), c, 0.18), p.x, p.y, p.z)); };
  if (P.spell === 'right' && !dead) glowAt(gR, new THREE.Vector3(0, 0, 0.35 * s), 0.16);
  if (P.spell === 'between' && !dead) {
    body.updateMatrixWorld(true);
    const p = new THREE.Vector3(); for (const l of arm) p.add(l.hand.getWorldPosition(new THREE.Vector3())); p.multiplyScalar(0.5);
    const q = up.worldToLocal(p); q.z += 0.35 * s; q.y += 0.15 * s; glowAt(up, q, 0.24);
  }
  const joints: Record<string, THREE.Object3D> = {};
  body.traverse((o) => { if (o.name) joints[o.name] = o; });
  body.userData.joints = joints;

  const out = new THREE.Group(); out.add(body); out.userData.joints = joints;
  if (f.sparkles && !dead) for (let i = 0; i < 16; i++) { const a = i * 2.39996, r = (1.1 + (i % 3) * 0.35) * s, y = (0.8 + ((i * 7) % 11) * 0.42) * s + (f.hoverFt ?? 0); out.add(at(glassy(sph((0.05 + (i % 3) * 0.02) * s, f.sparkles, 6, 4), f.sparkles, 0.85), Math.cos(a) * r, y, Math.sin(a) * r)); }
  if (P.lie) {
    // laid out: the whole posed figure turned onto its back, front or side, and rested on the floor
    const lay = new THREE.Group(); lay.add(body); out.add(lay);
    if (P.lie === 'side') lay.rotation.z = Math.PI / 2; else lay.rotation.x = P.lie === 'back' ? -Math.PI / 2 : Math.PI / 2;
    out.updateMatrixWorld(true);
    const bb = new THREE.Box3(); body.traverse((c) => { const m = c as M; if (m.isMesh && !(m.material as THREE.Material).transparent) bb.expandByObject(m); });
    lay.position.y -= bb.min.y; lay.position.z -= (bb.min.z + bb.max.z) / 2; lay.position.x -= (bb.min.x + bb.max.x) / 2;
  } else if (f.hoverFt && !dead) body.position.y += f.hoverFt;
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
