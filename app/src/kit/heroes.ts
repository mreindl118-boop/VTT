// Hero figures: a player character's own miniature, built from a recipe the DM's party pack carries (core/partyPack.ts).
// Original low-poly geometry on the kit's humanoid (kit/creatures.ts), one palette material per colour, flat shading.
// The recipe is data, so no character of any one table lives in the repo: the parts are generic (pointed ears, wings,
// a halo, a thorn crown, a shield, an axe, a book ...) and the pack says which a character wears, in what colours.
import * as THREE from 'three';
import { mat, matClone } from '../render/materials';
import { HIP, SHIN, THIGH, clipRings, forearmRings, frameOf, loftGeometry, lockGeometry, neckLift, neckRings, pelvisRings, ringAt, ringPoint, shinRings, thighRings, torsoRings, upperArmRings, type Frame, type Measures, type Ring } from './anatomy';
import type { CreatureSize } from '../core/units';
import { faceFeatures, hairSkull, browLift, weld, type FaceSpec, type FaceDetail } from './faces';
import { hairdo as buildHairdo, sheen, type Hairdo } from './hair';
import { weapon as gearWeapon, scabbard, closeGrip, secondHandAt, secondHandSlide, type WeaponSpec } from './weapons';
import { clothPoint, hangGarments, pointsOf, type DrapeWorld, type Garment } from './cloth';

export type HeroWeapon = 'none' | 'sword' | 'axe' | 'mace' | 'staff' | 'spear' | 'torch';
export type HeroOffhand = 'none' | 'shield' | 'book' | 'orb';
export type HeroHair = 'short' | 'long' | 'braids' | 'curly';
/** two-handed: a great weapon raised across the body; shield: shield up, weapon raised high; cast: the book forward, the
 *  free hand thrust out with a spell; conjure: the casting hand forward round a gathering spell, the book in the other. */
export type HeroStance = 'two-handed' | 'shield' | 'cast' | 'conjure';
/** Named poses: the four battle stances, and rest, ride (seated astride, hands on the reins), lunge, menace (arms spread,
 *  hands clawed), cower, kneel, and staff-raised (a caster with the staff high). */
export type PoseName = 'rest' | HeroStance | 'ride' | 'lunge' | 'menace' | 'cower' | 'kneel' | 'staff-raised' | 'dead' | 'dead-prone' | 'dead-comic' | 'dead-swoon' | 'dead-curled';
export type Euler3 = [number, number, number];
/** Joint angles, radians. On x a negative angle swings forward; a negative elbow bends the forearm up, a positive knee
 *  bends the shin back. On the limbs y and z are mirrored: positive turns outward on either side. On the spine and
 *  neck x > 0 leans forward (a dipped chin); on the spine, pelvis and neck y > 0 turns toward the figure's right and
 *  z > 0 raises its right side. R and L are the figure's own
 *  right and left (see SIDE_X). Ankles add to the
 *  automatic flat-foot correction (positive x points the toes). `hold` turns what a hand holds: upright keeps it
 *  vertical whatever the forearm does; tilt is added (mirrored). The figure is dropped until its lowest sole is on the
 *  floor, then raised by `lift` (feet); a seated pose puts the hip pivot at the origin instead. `spell` puts a glow in
 *  the right hand or between both. Fields left out stay at rest. */
export interface HeroPose {
  spine?: Euler3; neck?: Euler3; pelvis?: Euler3; collarR?: number; collarL?: number;
  shoulderR?: Euler3; elbowR?: number; wristR?: Euler3; shoulderL?: Euler3; elbowL?: number; wristL?: Euler3;
  /** The forearm's turn before the wrist bends (radians, mirrored like the wrist's y): 0 is the rig's zero, the palm
   *  forward with the arm hanging (full supination); negative turns the palm in, about -1.4 to the thigh and -2.8 to the
   *  back (full pronation). A palm pushed out at a foe is a full turn and a bend back: twist -2.7, wrist [0.8, 0, 0].
   *  Setting it stops the at-ease turn of an empty hand. */
  twistR?: number; twistL?: number;
  hipR?: Euler3; kneeR?: number; ankleR?: Euler3; hipL?: Euler3; kneeL?: number; ankleL?: Euler3;
  /** `aim` points what the hand holds along a direction in the chest's frame (x mirrored: positive out to the hand's own
   *  side, y up, z forward), its face turned forward; the hand then closes on it as far as the wrist allows. */
  holdR?: { upright?: boolean; tilt?: Euler3; aim?: Euler3 }; holdL?: { upright?: boolean; tilt?: Euler3; aim?: Euler3 };
  /** The left hand comes onto the weapon the right hand holds, for gear, where its kind says (kit/weapons.ts
   *  secondHandAt); the arm is solved to reach it and the left arm's own angles are ignored. A long weapon of the
   *  figure's own takes `bothHands`. */
  twoHand?: boolean;
  /** Hands made into fists (an empty hand on the hip, say). */
  fist?: ('R' | 'L')[];
  /** Empty hands hooked into talons: the fingers fanned and curled hard at the middle joints (a grasping reach). */
  talon?: ('R' | 'L')[];
  /** Hands laid on the hilt of a belted blade, the arm solved to reach it (the angles stand when no blade is belted). */
  hilt?: ('R' | 'L')[];
  /** Hands set on the hip (a fist there when `fist` names it too): the arm is solved so the hand lands on the side of the
   *  waist above the belt, outside whatever is worn there, the elbow out to the side and the palm turned back. */
  hipHand?: ('R' | 'L')[];
  /** Hands resting on the belt: the arm is solved so the open hand lies flat on the front of the belt toward its own
   *  side, the fingers hanging down and a little in, the elbow back at the side. */
  beltHand?: ('R' | 'L')[];
  /** Both hands on a long weapon (an axe, a spear, a staff): the free hand takes the haft above the weapon hand. The
   *  two-handed stance always does. */
  bothHands?: boolean;
  /** An off-hand book held open (read from, or cast from) or carried shut: out of a fight it is shut unless the pose says
   *  open, and a fight opens it unless the pose says shut (a scholar who fights with a blade keeps his book closed). */
  book?: 'open' | 'shut';
  lift?: number; seated?: boolean; spell?: 'right' | 'between';
  /** Where the eyes look, [across, up] from -1 to 1, across > 0 to the figure's right (default: worked out from the pose, see gazeOf). */
  gaze?: [number, number];
  /** Laid out on the floor (a body): on its back, its front or its side. */
  lie?: 'back' | 'front' | 'side';
}
/** Standing at ease, never square (contrapposto): the weight on one straight leg with its hip up, the other knee eased
 *  forward and in, both feet flat and turned out; the shoulders tipped against the hips and the chest turned off them,
 *  the head turned and tilted further still with the eyes leading it; the elbows soft, each arm with its own job and a
 *  gap at the waist. A character without a pose of its own takes one by its recipe. */
export const AT_EASE: HeroPose[] = [
  // weight on the right leg, the hips turned a little right and the chest back to the left, the head further left and
  // tilted toward the low shoulder; the right arm hanging soft by the thigh, the left forearm forward, the hand before the hip
  { pelvis: [0.02, 0.12, 0.13], spine: [0, -0.3, -0.22], neck: [0.06, -0.3, -0.02], gaze: [-0.55, -0.05], hipR: [0.02, 0.1, -0.04], kneeR: 0.04, hipL: [-0.2, 0.05, 0.36], kneeL: 0.4,
    shoulderR: [0.05, -0.1, 0.13], elbowR: -0.45, shoulderL: [0.1, -0.35, 0.16], elbowL: -0.8 },
  // weight on the right leg, a fist on that high hip (the elbow out to the side, the forearm running in to the waist),
  // the chest turned left and the head back over the right shoulder, cocked toward the left; the left arm loose
  { pelvis: [0, 0.1, 0.14], spine: [0.02, -0.26, -0.24], neck: [0, 0.42, 0.2], gaze: [0.35, 0], hipR: [0.02, 0.08, -0.04], kneeR: 0.04, hipL: [-0.2, 0.07, 0.36], kneeL: 0.4,
    shoulderR: [1.3, -0.61, 1.16], elbowR: -1.82, wristR: [0, -1.54, 0], fist: ['R'], hipHand: ['R'], shoulderL: [-0.05, -0.45, 0.12], elbowL: -0.55 },
  // weight on the left leg, the left hand resting on the belt over that hip and its shoulder drawn back with the elbow
  // (the chest turned left off the hips), glancing aside to the right with the chin down and the head cocked to the
  // left; the right arm loose, its hand beside the eased right thigh
  { pelvis: [0.02, 0.1, -0.13], spine: [0.02, -0.18, 0.18], neck: [0.1, 0.3, 0.08], gaze: [0.4, -0.1], hipL: [0.02, 0.08, -0.04], kneeL: 0.04, hipR: [-0.2, 0.05, 0.36], kneeR: 0.4,
    shoulderL: [-0.1, -0.3, 0.15], elbowL: -1.5, beltHand: ['L'], shoulderR: [0, -0.3, 0.22], elbowR: -0.55 },
];
/** A gown's ease: weight on the right leg, the hip thrown out, the left knee eased forward behind the slit (the leg
 *  shows through it, the foot on its ball beside the planted one, never under it); the chest turned back over the high
 *  hip, the head turned on and tilted, the arms soft and a little out from the gown's hips, the left hand before its hip. */
const GOWN_EASE: HeroPose = { pelvis: [0, 0.1, 0.12], spine: [0.02, -0.26, -0.21], neck: [0.08, -0.25, 0], gaze: [-0.4, -0.05], hipR: [0.02, 0.1, -0.03], kneeR: 0.02, hipL: [-0.1, -0.05, 0.06], kneeL: 0.4,
  shoulderR: [0.04, -0.12, 0.12], elbowR: -0.45, shoulderL: [-0.1, -0.45, 0.12], elbowL: -0.85 };
export const POSES: Record<PoseName, HeroPose> = {
  rest: {},
  // a high guard across the body (port arms with a great weapon): the left foot forward in a deep stance, the hips turned
  // to the right over it and the chest square to the foe, the head turned a touch away from the rising haft; the right
  // fist low by the right hip, the left high before the left shoulder, the haft diagonal with the head up past the left
  // shoulder and leaning toward the foe, both elbows bent within their limits and the forearms clear of the body
  'two-handed': { pelvis: [0.08, 0.2, 0.02], spine: [0.16, -0.2, 0.04], neck: [0.04, 0.1, 0.06], hipL: [-0.7, -0.1, 0.25], kneeL: 0.95, hipR: [0.3, 0.3, 0.28], kneeR: 0.4,
    shoulderR: [0, -0.553, 0.432], elbowR: -1.389, shoulderL: [-1.05, -0.871, 0.305], elbowL: -1.333, holdR: { aim: [-0.62, 0.75, 0.24] }, bothHands: true },
  // behind the shield: the shield side leading in a lunge, the shield on the forearm across the chest with the eyes over
  // its rim, the weapon cocked high behind the head (the elbow up and out) to strike down
  shield: { pelvis: [0.06, 0.45, 0], spine: [0.15, 0.15, 0.06], neck: [0.12, -0.55, 0], hipL: [-0.6, -0.12, 0.3], kneeL: 0.85, hipR: [0.3, 0.25, 0.32], kneeR: 0.4,
    shoulderL: [-0.35, -1.193, 0.492], elbowL: -1.833, twistL: -1.2, shoulderR: [-0.862, -0.688, 1.781], elbowR: -1.885, holdR: { aim: [0.25, 0.75, -0.6] } },
  // a flying cast: pitched toward the foe, the right arm thrust out with the palm to it, the book held open out to the
  // left, the legs trailing with the knees bent, the chin up to keep the eyes on the target
  cast: { pelvis: [0.3, 0.1, 0], spine: [0.1, 0.25, -0.05], neck: [-0.35, -0.3, 0.05], hipL: [0.15, 0, 0.08], kneeL: 1.1, ankleL: [0.6, 0, 0], hipR: [0.3, 0.05, 0.05], kneeR: 0.7, ankleR: [0.6, 0, 0],
    shoulderR: [-1.185, -0.725, 0.284], elbowR: -0.8, twistR: -2.5, wristR: [0.75, 0, 0], shoulderL: [-0.217, 0.198, 0.814], elbowL: -1.309, wristL: [-0.3, 0, 0], book: 'open', lift: 0.8, spell: 'right' },
  // the casting hand driven forward at shoulder height, the palm to the foe round a gathering spell, the shoulders turned
  // against the hips; the book open on the other palm, out in front and clear of the chest
  conjure: { pelvis: [0.08, 0.15, 0.08], spine: [0.12, -0.4, -0.06], neck: [-0.06, 0.22, -0.08], hipL: [-0.45, -0.12, 0.08], kneeL: 0.5, hipR: [0.2, 0.05, 0.06], kneeR: 0.12,
    shoulderR: [-1.296, 0.052, 0.176], elbowR: -0.524, twistR: -2.7, wristR: [0.8, 0, 0], shoulderL: [-0.021, -0.319, 0.629], elbowL: -1.833, wristL: [-0.4, 0, 0], book: 'open', spell: 'right' },
  ride: { seated: true, spine: [0.05, 0, 0], hipR: [-1.45, 0, 0.4], kneeR: 1.5, hipL: [-1.45, 0, 0.4], kneeL: 1.5,
    // (in the saddle: the hips turned a touch and the head turned on, looking out; the rein hand low before the body,
    // the other higher and drawn in)
    pelvis: [0, 0.1, 0.03], neck: [-0.05, 0.25, -0.06], gaze: [0.3, 0.05], shoulderR: [-0.75, -0.1, 0.12], elbowR: -1.0, shoulderL: [-0.45, -0.2, 0.1], elbowL: -1.3 },
  // a lunge: the left knee bent over its foot and the right leg driven straight back, the hips turned right and the
  // chest square to the foe, the right arm thrust out with the elbow unlocked, the left swung back for balance
  lunge: { pelvis: [0, 0.3, 0.03], spine: [0.25, -0.45, 0.02], neck: [-0.15, 0.2, -0.04], gaze: [0, 0.1], hipL: [-0.9, -0.15, 0.1], kneeL: 1.1, hipR: [0.7, 0.15, 0.1], kneeR: 0.15,
    shoulderR: [-1.4, 0.1, 0.15], elbowR: -0.3, wristR: [0.15, 0, 0], shoulderL: [0.45, 0.25, 0.45], elbowL: -0.65 },
  // looming: crouched over the bent left leg, the chest turned and the head thrust forward under the brows, the right
  // arm flung high and wide, the left lower and nearer, both hands clawed
  menace: { pelvis: [0.08, -0.12, -0.06], spine: [0.25, 0.15, 0.08], neck: [-0.22, -0.18, 0.08], gaze: [0.15, 0.35], hipL: [-0.4, 0.15, 0.18], kneeL: 0.65, hipR: [0.25, 0.35, 0.22], kneeR: 0.35,
    shoulderR: [-0.9, -0.2, 1.0], elbowR: -0.75, wristR: [0.5, 0, 0], shoulderL: [-0.9, 0.1, 0.35], elbowL: -1.2, wristL: [0.5, 0, 0] },
  // cowering: crouched and turned away, the head ducked with the eyes still on the threat, the left forearm thrown
  // across above the face, the right arm back and out
  cower: { pelvis: [0.1, 0.25, 0.08], spine: [0.35, 0.15, -0.12], neck: [0.18, 0.15, -0.1], gaze: [-0.5, 0.25], hipL: [-0.55, 0.1, 0.12], kneeL: 1.0, hipR: [-0.25, 0.25, 0.1], kneeR: 0.65,
    shoulderL: [-2.1, -1.3, 0.3], elbowL: -1.3, shoulderR: [0.35, 0.2, 0.35], elbowR: -0.5 },
  // on one knee: the right foot planted, the left knee down, the chest turned and the head turned back over it, the
  // right forearm forward over the raised knee and the left arm loose
  kneel: { pelvis: [0.05, 0.15, 0.05], spine: [0.12, -0.2, -0.06], neck: [0.2, 0.3, 0.08], gaze: [0.25, -0.1], hipR: [-1.4, 0, 0.05], kneeR: 1.4, hipL: [0.05, 0, 0.05], kneeL: 1.5, ankleL: [0.3, 0, 0],
    shoulderR: [-0.55, -0.2, 0.15], elbowR: -1.2, shoulderL: [0.15, 0.1, 0.2], elbowL: -0.45 },
  // The dead, comic sprawls laid out as a body falls (see settleLay: each limb then drops till it rests on the floor or
  // the body). A limb lying flat with its elbow or knee bent along the floor has the shoulder or hip turned a quarter,
  // so its angles read oddly in the rig's order; an ankle here undoes the standing foot's correction, leaving the foot
  // pointed off the shin. On the back, a starfish: one arm flung up past the head, the other out, palms up, one leg
  // straight and the other's knee fallen out, the head lolled to the side.
  dead: { lie: 'back', neck: [0.15, -0.75, 0.15], spine: [0, 0.1, 0.06], pelvis: [0, -0.1, -0.05],
    shoulderR: [-1.572, -0.96, 1.719], elbowR: -0.8, wristR: [-0.25, -1.47, 0], collarR: 0.25, shoulderL: [-1.571, 0.262, 1.768], elbowL: -0.35, wristL: [-0.3, -1.5, 0], collarL: 0.05,
    hipR: [0.06, 0.45, 0.33], kneeR: 0.03, ankleR: [0.69, 0, 0.33], hipL: [-1.571, 1.134, 1.651], kneeL: 0.8, ankleL: [-0.17, 0, 1.651] },
  // face down, flopped: the right arm flung out on the floor past the head, the left by the side with the palm up, the
  // right leg straight and rolled out, the left hitched up and out along the floor, the head turned on its cheek
  'dead-prone': { lie: 'front', neck: [-0.1, -1.4, 0.05], spine: [-0.05, -0.12, 0.08], pelvis: [0, 0.1, -0.06],
    shoulderR: [-1.571, -1.224, 1.471], elbowR: -0.45, wristR: [0.2, -1.61, 0], collarR: 0.25, shoulderL: [1.571, -0.927, 1.67], elbowL: -0.3, wristL: [-0.2, -1.55, 0], collarL: 0,
    hipR: [0, 0.6, 0.12], kneeR: 0.1, ankleR: [1.1, 0, 0.12], hipL: [-1.571, 0.927, 1.471], kneeL: 1.0, ankleL: [0.43, 0, 1.471] },
  // the dead bug, on the back: the right arm bent up by the head along the floor like a goal post, the left flung out
  // lower and straighter, the hands limp; the right leg frogged with the knee fallen out, the left kicked out straight,
  // the head lolled aside (never a mirror image: one side does what the other does not)
  'dead-comic': { lie: 'back', neck: [-0.1, 0.55, 0.1], spine: [0, 0.08, 0.05], pelvis: [0, -0.08, 0.04],
    shoulderR: [-1.571, 0, 1.794], elbowR: -1.4, wristR: [-0.5, -1.35, 0], shoulderL: [-1.571, -0.3, 1.794], elbowL: -0.9, wristL: [-0.3, -1.45, 0],
    hipR: [-1.571, 0.927, 1.551], kneeR: 1.15, ankleR: [0.18, 0, 1.551], hipL: [0.06, 0.35, 0.3], kneeL: 0.12, ankleL: [0.75, 0, 0.3] },
  // a swoon on the back: the legs straight and a little apart, the hips rolled, one arm flung up and curled over the
  // crown, the other out with the palm up, the head turned away
  'dead-swoon': { lie: 'back', neck: [0.1, 0.5, -0.1], spine: [-0.06, -0.08, -0.12], pelvis: [0, 0.12, 0.14],
    shoulderL: [-1.571, -1.049, 1.719], elbowL: -1.35, wristL: [-0.6, -1.42, 0], collarL: 0.3, shoulderR: [-1.571, 0.522, 1.768], elbowR: -0.4, wristR: [-0.3, -1.49, 0], collarR: 0.05,
    hipR: [0.04, 0.25, 0.14], kneeR: 0.2, ankleR: [0.94, 0, 0.14], hipL: [0.04, 0.1, 0.1], kneeL: 0.06, ankleL: [0.8, 0, 0.1] },
  // on its side, half curled: the leg beneath bent back, the knee above drawn up and fallen to the floor in front of
  // it, the arm beneath thrown forward with the hand by the face, the other fallen forward off the shoulder to the floor
  // in front of the chest, the head tucked and turned up, rolled off that arm (pillowed on it, not into it)
  'dead-curled': { lie: 'side', spine: [0.28, 0.05, 0], pelvis: [0.12, 0, 0], neck: [0.3, 0.6, -0.4],
    shoulderL: [-2.005, 0.389, 0.508], elbowL: -0.5, wristL: [0, -1.71, 0], shoulderR: [-1.8, -0.939, -0.75], elbowR: -1.3, wristR: [0, -0.79, 0],
    hipL: [-0.5, 0, 0.05], kneeL: 1.0, ankleL: [1.0, 0, 0.05], hipR: [-1.25, 0.2, -0.15], kneeR: 1.35, ankleR: [0.5, 0, -0.15] },
  // a staff held high: the left foot forward and the body leaning back over the right, the chest open and the chin up
  // to the staff, the left hand forward with the palm up
  'staff-raised': { pelvis: [-0.02, -0.1, -0.08], spine: [-0.06, 0.12, 0.08], neck: [-0.2, -0.1, 0.08], gaze: [0.1, 0.4], hipL: [-0.35, 0.05, 0.12], kneeL: 0.35, hipR: [0.15, 0.3, 0.1], kneeR: 0.12,
    shoulderR: [-2.6, -0.2, 0.3], elbowR: -0.4, shoulderL: [-0.5, -0.2, 0.3], elbowL: -1.0, wristL: [0.4, 0.01, 0.1] },
};

/** The side of the x axis each named limb is built on. The figure faces +z, so its own right hand is at -x; poses,
 *  recipes and joint names say R and L for the figure's own right and left. */
export const SIDE_X = { R: -1, L: 1 } as const;
const RX = SIDE_X.R, LX = SIDE_X.L;
/** How far a standing figure's feet turn out, [least, most] in radians for each foot, outward. Side by side (at ease)
 *  each foot turns out from the way the hips face; in a stance with one foot well ahead, from the figure's front: the
 *  front foot points at the foe and the back one turns out across the line, as a fighter's does. */
/** How far each lame of a plate fauld turns with the chest as the body bends and twists (the first, under the
 *  breastplate's edge, all the way; the last, which the tassets and the culet hang from, a little): the bend is shared
 *  out between them. */
const FAULD_GIVE = [1, 0.75, 0.5, 0.25];
export const FEET_OUT = { ease: [0.2, 0.49], front: [-0.1, 0.26], back: [0.61, 0.96] } as const;
/** A pose's spine, pelvis or neck turn in the rig's frame: y > 0 turns toward the figure's right, z > 0 raises its right side. */
const trunk = (e: Euler3): Euler3 => [e[0], RX * e[1], RX * e[2]];

/** The pose a figure takes: dead its dead pose, in initiative its battle pose, otherwise its own or one at ease. */
function poseOf(f: HeroFigure, battle: boolean, dead: boolean, gown: boolean): HeroPose {
  const named = (p: PoseName | HeroPose | undefined) => typeof p === 'string' ? POSES[p] ?? POSES.rest : p;
  let P: HeroPose = dead ? named(f.deadPose) ?? POSES.dead : (battle ? named(f.battlePose ?? f.stance) : undefined) ?? named(f.pose) ?? POSES.rest;
  if (P === POSES.rest) {
    let h = 0; for (const ch of (f.skin ?? '') + (f.hair ?? '') + (f.cloth ?? '') + (f.weapon ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let i = h % AT_EASE.length; if (i === 2 && (f.offhand?.kind === 'shield' || f.offhand?.kind === 'book')) i = 0; // a hand carrying a shield or a book does not rest on the belt
    P = gown ? GOWN_EASE : AT_EASE[i];
    // a staff out of a fight is planted: its foot on the floor beside the right foot (it slides through the hand till
    // it is down, see heroFigure), the hand on it at the chest
    if (f.weapon === 'staff' && !battle) P = { ...P, ...STAFF_AT_EASE, fist: P.fist?.filter((x) => x !== 'R'), hipHand: P.hipHand?.filter((x) => x !== 'R'), beltHand: P.beltHand?.filter((x) => x !== 'R'), wristR: undefined, twistR: undefined };
  }
  return P;
}
/** The right arm on a staff planted at ease (its hold is checked for by identity). */
const STAFF_AT_EASE: HeroPose = { shoulderR: [-0.5, 0.05, 0.32], elbowR: -1.75, holdR: { aim: [0.05, 1, 0.1] } };
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
  /** Plate adds layered pauldrons (riding the shoulder joint) and a gorget; mail a shirt with short sleeves. */
  armor?: { kind: 'plate' | 'mail'; color: string; trim?: string };
  /** Shirt sleeves rolled up to the elbow: bare forearms below a rolled cuff. */
  rolled?: boolean;
  cloak?: string; hood?: boolean;
  /** A skirt; with an underskirt as well, a fitted gown (see gownTrim). */
  skirt?: string; underskirt?: string;
  /** false: no tunic hem below the belt and no belt tail hanging from it, for a garment made over the figure that takes
   *  their place (a doublet's skirts under a sash, kit/costume.ts). */
  hem?: boolean;
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
  /** Keeps their weapons out of sight until a fight: none are shown at rest (the bestiary puts them away). */
  concealed?: boolean;
  /** The character's own face (kit/faces.ts) in place of the standard one, and how finely it is modelled (1 to 4). */
  face?: FaceSpec; detail?: FaceDetail;
  /** A hairdo of the character's own (kit/hair.ts) in place of the standard `hairStyle`. */
  hairdo?: Hairdo;
  /** The head's size against the body (1 = heroic proportion): larger on a squat, short figure. */
  headSize?: number;
  /** Gear on the body's mounts (kit/weapons.ts): in either hand, sheathed or hung at the belt, slung on the back. A hand
   *  with gear replaces `weapon` (right) or `offhand` (left); an empty mount carries no geometry. */
  gear?: { handR?: WeaponSpec; handL?: WeaponSpec; beltR?: WeaponSpec; beltL?: WeaponSpec; back?: WeaponSpec };
}

const SIZE_SCALE: Record<CreatureSize, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };

type M = THREE.Mesh;
const at = (m: M, x: number, y: number, z: number): M => { m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, c: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
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
/** An open curved plate following a lofted part: the stack of rings between two heights, round an arc of them (from
 *  `th0`, `wrap` radians; 0 is the front, round through +x), scaled out from `k0` at the top to `k1` at the bottom. */
function shellGeometry(rings: Ring[], y0: number, y1: number, th0: number, wrap: number, k0: number, k1: number, s: number, seg = 24, rows = 6): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) { const t = i / rows, y = y0 + (y1 - y0) * t, r = ringAt(rings, y); for (let j = 0; j <= seg; j++) { const [x, z] = ringPoint(r, th0 + wrap * j / seg, k0 + (k1 - k0) * t); pos.push(x * s, y * s, z * s); } }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function tube(pts: THREE.Vector3[], r: number, c: string, closed = false): M {
  return sm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(12, pts.length * 4), r, 6, closed), c);
}

/** Cloth that hangs: an open cone with folds that deepen toward the hem, a pointed (handkerchief) hem, and a sway.
 *  `gap` leaves the front open (radians). Angles run from +z (the front) round through +x. Its vertices are a grid of
 *  `rows` + 1 rows (top to hem) of 57 (see kit/cloth.ts). */
const DRAPE_COLS = 57;
function drape(rTop: number, rBot: number, h: number, c: string, o: { folds: number; amp: number; jag: number; sway?: number; seed?: number; gap?: number; rows?: number; zs?: [number, number] }): M {
  const gap = o.gap ?? 0;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, DRAPE_COLS - 1, o.rows ?? 12, true, gap / 2, Math.PI * 2 - gap);
  const p = g.attributes.position as THREE.BufferAttribute, seed = o.seed ?? 0;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (h / 2 - y) / h, th = Math.atan2(x, z);
    const k = 1 + o.amp * t * (0.7 * Math.sin(o.folds * th + seed) + 0.3 * Math.sin(o.folds * 2.3 * th + seed * 2));
    x *= k; z *= k * (o.zs ? o.zs[0] + (o.zs[1] - o.zs[0]) * t : 1); // (squashed front to back, flatter at the top than at the hem)
    y -= o.jag * t ** 4 * Math.abs(Math.sin(o.folds * 0.5 * th + seed));
    z += (o.sway ?? 0) * t * t * rBot;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return sm(g, c, true);
}

/** Faces are painted onto a clean head (the stylised look); false brings back the sculpted standard face below. */
/** An elf's ear: a long leaf of a shell from a small lobe up to a point that sweeps up and back, its outer face dished
 *  into a hollow inside a rolled rim. Built in the ear's own frame (x out from the head, y up, z forward), `s` units. */
function pointedEar(s: number, skin: string, detail: number, wide = 1): THREE.Group {
  const g = new THREE.Group(), T = detail < 2 ? 9 : 18, K = detail < 2 ? 8 : 16, pos: number[] = [], idx: number[] = [];
  const C = (t: number) => new THREE.Vector3(0, -0.07 + 0.36 * t, -0.13 * t ** 1.6);
  for (let i = 0; i <= T; i++) {
    const t = i / T, c = C(t), along = C(Math.min(1, t + 0.01)).sub(C(Math.max(0, t - 0.01))).normalize();
    const across = new THREE.Vector3(1, 0, 0).cross(along).normalize();              // in the ear's plane, toward its front edge
    const w = 0.06 * wide * Math.sqrt(Math.sin(Math.PI / 2 * Math.min(1, t / 0.12))) * (1 - t ** 1.5) + 0.002, th = 0.024 * Math.sqrt(wide) * (1 - 0.6 * t) + 0.002;
    for (let k = 0; k < K; k++) {
      const ph = (k / K) * Math.PI * 2, v = Math.cos(ph), out = Math.sin(ph);
      // the outer face sinks between the edges: the hollow, with the rim standing round it (fuller along the back edge)
      const x = th * out - 1.25 * th * Math.max(0, out) ** 0.6 * (1 - Math.abs(v)) ** 1.4 * (t < 0.85 ? 1 : (1 - t) / 0.15) + 0.004 * Math.max(0, -v);
      pos.push(c.x + x, c.y + across.y * v * w, c.z + across.z * v * w);
    }
  }
  for (let i = 0; i < T; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c2 = a + K, d = b + K; idx.push(a, c2, b, b, c2, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  g.add(sm(weld(geo), skin));
  if (detail >= 2) { // the hollow's shadow, so it reads at the table
    const bowl = sph(0.05, tone(skin, '#4a1e22', 0.2), 12, 8); bowl.scale.set(0.16, 1.6, 0.42 * wide); bowl.position.set(-0.004, 0.035, -0.014); bowl.rotation.x = 0.28; g.add(bowl);
  }
  g.scale.setScalar(s); return g;
}
/** How an elf's ear turns on the head (`sx` the side, -1 the figure's right): at 0 its point sweeps up and back along the
 *  head, as the ear has always stood; at 1 it sticks straight out sideways, a little up and back, its hollow turned
 *  forward to show from the front, as in TB's and PG's art. In between the turn is eased from one to the other. */
function elfEarTurn(sx: number, out: number): THREE.Quaternion {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, -sx * 0.42, -sx * 0.3));
  if (out <= 0) return q;
  // the left ear's axes out sideways: its length (y) out and up, its hollow (x) forward and a little out, its front edge
  // (z) the upper edge; the right ear is the mirror (the ear's own x is mirrored by its scale)
  const L = new THREE.Vector3(0.78, 0.6, -0.14).normalize(), N = new THREE.Vector3(0.35, 0.12, 1);
  N.addScaledVector(L, -N.dot(L)).normalize();
  const F = new THREE.Vector3().crossVectors(N, L), m = new THREE.Matrix4();
  if (sx > 0) m.makeBasis(N, L, F); else m.makeBasis(new THREE.Vector3(N.x, -N.y, -N.z), new THREE.Vector3(-L.x, L.y, L.z), new THREE.Vector3(-F.x, F.y, F.z));
  return q.slerp(new THREE.Quaternion().setFromRotationMatrix(m), out);
}
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
    // ears, standing a little off the head behind: an elf's from the same root as a person's, its point sweeping up and
    // back; a person's a rim (the helix) curling over the top and down the back to the lobe, round a hollow
    const earLen = Math.max(-1, Math.min(1, f.face?.earLen ?? 0)), earOut = Math.max(0, Math.min(1, f.face?.earOut ?? 0));
    if (f.ears === 'pointed') for (const sx of [-1, 1]) {
      const ear = pointedEar(s, skin, f.detail ?? 2, 1 + 0.5 * earOut); ear.position.set(sx * (0.318 + 0.012 * earOut) * s, hy - (0.035 + 0.01 * earOut) * s, (-0.035 + 0.012 * earOut) * s);
      ear.quaternion.copy(elfEarTurn(sx, earOut)); ear.scale.x *= sx; ear.scale.y *= 1 + 0.6 * earLen; ear.scale.z *= 1 + 0.2 * earLen; head.add(ear);
    }
    if (f.ears !== 'pointed') for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * 0.322 * s, hy - 0.04 * s, -0.03 * s); ear.rotation.set(-0.2, -sx * (0.3 + 0.55 * earOut), 0); ear.scale.setScalar(1 + 0.3 * earLen); head.add(ear);
      if ((f.detail ?? 2) < 2) { const e = sph(0.075 * s, skin); e.scale.set(0.42, 1.1, 0.65); ear.add(e); continue; }
      const ep = new THREE.Group(); ep.scale.set(1, 1.32, 1); ear.add(ep);
      const rim = sm(new THREE.TorusGeometry(0.056 * s, 0.017 * s, 8, 22, Math.PI * 1.6), skin); rim.rotation.set(0, Math.PI / 2, Math.PI * 1.2); ep.add(rim);
      const bowl = sph(0.05 * s, tone(skin, '#4a1e22', 0.22), 12, 10); bowl.scale.set(0.32, 1.02, 0.86); ep.add(at(bowl, -sx * 0.004 * s, 0.002 * s, -0.004 * s));
      const lobe = sph(0.024 * s, skin, 10, 8); lobe.scale.set(0.7, 1.1, 1); ep.add(at(lobe, 0, -0.05 * s, 0.012 * s));
    }
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
  if (f.face?.bald) return;
  if (!f.hair) return;
  if (f.hairdo) { head.add(buildHairdo(f.hairdo, f.hair, s, hy, f.detail ?? 2, f.face)); return; }
  const H = f.hair, R = 0.4, style = f.hairStyle ?? 'short';
  // short hair is the sculpted crop (kit/hair.ts), its parting and fullness varied by the character's colours
  if (style === 'short') { let h = 7; for (const ch of H + (f.skin ?? '') + (f.cloth ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; head.add(buildHairdo({ style: 'crop', part: [0.4, -0.4, 0.15, -0.2][h % 4], length: 0.35 + (h >> 3) % 5 * 0.08 }, H, s, hy, f.detail ?? 2, f.face)); return; }
  const cr = hairSkull(f.face), lift0 = browLift(f.face);
  let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  // ears that stand out (buildFace) part the hair: the side locks are tucked behind them and no coil grows over their
  // roots, so the ear comes out of the hair whole, as in the art, instead of its point poking through
  const earOut = f.ears === 'pointed' ? Math.max(0, Math.min(1, f.face?.earOut ?? 0)) : 0, earAz = Math.atan2(0.318 + 0.012 * earOut, -0.035 + 0.012 * earOut);
  const tuckK = Math.max(0, Math.min(1, (earOut - 0.2) / 0.4));
  const tuck = (az: number) => {
    const an = Math.atan2(Math.sin(az), Math.cos(az)), a = Math.abs(an), lo = earAz - 0.55, hi = earAz + 0.3;
    return tuckK === 0 || a < lo || a > hi ? az : Math.sign(an) * (a + (hi + (a - lo) * 0.2 - a) * tuckK);
  };
  const overEar = (az: number, el: number) => earOut >= 0.3 && el < 0.5 && Math.abs(Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) - earAz) < 0.42;
  // a point on the scalp: azimuth from the front round through +x, elevation, and a lift off the skull
  const scalp = (az: number, el: number, lift = 1.06) => { const c = Math.cos(el), dz = Math.cos(az) * c, [x, y, z] = cr(Math.sin(az) * c * 0.84 * lift, Math.sin(el) * 1.14 * lift, dz * (dz < 0 ? 0.99 : 0.94) * lift); return new THREE.Vector3(x * R * s, hy + y * R * s, z * R * s); };
  // the hairline: how low the hair comes at each azimuth (an elevation)
  const line = (az: number) => { const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))); return (a < 1.25 ? lift0 * (a < 0.4 ? 1 : 1 - (a - 0.4) / 0.85) : 0) + (a < 0.25 ? 0.8 - 0.06 * (1 - a / 0.25) : a < 0.8 ? 0.8 + 0.07 * Math.sin((a - 0.25) * Math.PI / 0.55) : a < 1.3 ? 0.8 - 0.72 * (a - 0.8) / 0.5 : a < 1.8 ? 0.08 + 0.1 * Math.sin((a - 1.3) * Math.PI / 0.5) : 0.08 - 0.58 * Math.min(1, (a - 1.8) / 0.6)); };
  // the under-layer: the skull's own shape, a little proud, combed in strands, cut at the hairline
  const cg = new THREE.SphereGeometry(1, 48, 28), cp = cg.attributes.position as THREE.BufferAttribute, keep: boolean[] = [];
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), az = Math.atan2(x, z), el = Math.asin(Math.max(-1, Math.min(1, y)));
    keep.push(el > line(az) - 0.04);
    const k = 1.045 + 0.012 * Math.sin(az * 26 + el * 5) + 0.006 * Math.sin(az * 61), [qx, qy, qz] = cr(x * 0.84 * k, y * 1.14 * k, z * (z < 0 ? 0.99 : 0.94) * k);
    cp.setXYZ(i, qx * R * s, qy * R * s, qz * R * s);
  }
  const src = cg.index!, idx: number[] = []; for (let i = 0; i < src.count; i += 3) { const a = src.getX(i), b = src.getX(i + 1), c = src.getX(i + 2); if (keep[a] && keep[b] && keep[c]) idx.push(a, b, c); }
  cg.setIndex(idx); cg.computeVertexNormals(); head.add(at(sm(cg, tone(H, '#000000', 0.18), true), 0, hy, 0));
  const shadeOf = (i: number) => i % 3 === 0 ? sheen(H, 0.1) : i % 3 === 1 ? H : tone(H, '#000000', 0.14);
  const lock = (pts: THREE.Vector3[], r0: number, r1: number, i: number, c?: string, flat = 0.5) => head.add(sm(lockGeometry(pts, r0 * s, r1 * s, flat, 6), c ?? shadeOf(i), true));
  const part = fem ? 0.05 : 0.0; // the parting sits a little to one side
  const crownY = cr(0, 1.14 * 1.07, 0)[1] * R * s, crown = (az: number) => new THREE.Vector3(Math.sin(az) * 0.03 * s + part * s, hy + crownY, -0.02 * s + Math.cos(az) * 0.03 * s);
  let streaks = 0; const streakAt = (az: number) => { const a = RX * Math.atan2(Math.sin(az), Math.cos(az)); return f.hairStreak && a > 0.6 && a < 1.2 && streaks++ < 3 ? f.hairStreak : undefined; }; // a streak: a few locks at the right temple (RX)

  if (style === 'long' || style === 'braids') {
    // from the parting over the skull: each lock runs down its own meridian
    const n = 26;
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < n; i++) {
      const az = 0.62 + (i + layer * 0.5) / n * (Math.PI * 2 - 1.24) + (rnd() - 0.5) * 0.05, back = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) / Math.PI;
      const low = style === 'long' ? tuck(az) : az, pts = [crown(az), scalp(az, 1.05, 1.09 + layer * 0.03), scalp(az, 0.55, 1.12 + layer * 0.03), scalp(low, 0.1, 1.13 + layer * 0.03)];
      if (style === 'long') {
        const len = (0.95 + back * 0.55 - layer * 0.18 + rnd() * 0.15) * (fem ? 1 : 0.62), base = scalp(low, -0.25, 1.14 + layer * 0.03), wave = (rnd() - 0.5) * 0.08;
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
      lock([crown(az), scalp(az, 0.85, 1.1), top, new THREE.Vector3(top.x * 1.05, top.y - 0.3 * s, top.z + 0.05 * s), new THREE.Vector3(top.x * 1.0, top.y - len * 0.7 * s, top.z + 0.12 * s), new THREE.Vector3(top.x * 0.92, top.y - len * s, top.z + 0.16 * s)], 0.05, 0.014, k, sx === RX && k === 0 ? f.hairStreak : undefined);
    }
    // the braids themselves hang from behind the ears once the figure is posed (drapeBraids), over whatever it wears
    if (style === 'braids') head.userData.braids = { color: H, from: [-1, 1].map((sx) => ({ sx, at: scalp(sx * 1.9, -0.32, 1.12) })) };
  }
  if (style === 'curly') {
    // a mass of coils: each a little spiral springing off the scalp, bigger on top, hanging lower behind
    for (let i = 0; i < 60; i++) {
      const az = i * 2.39996 + rnd() * 0.3, el = Math.max(line(az) + 0.02, 1.45 - (i / 60) * 1.75), root = scalp(az, el, 1.05), out = root.clone().sub(new THREE.Vector3(0, hy, 0)).normalize();
      const side = new THREE.Vector3(-out.z, 0, out.x).normalize(), upv = new THREE.Vector3().crossVectors(out, side), len = (0.16 + rnd() * 0.12) * (el < 0.3 ? 1.5 : 1), rr = 0.045 + rnd() * 0.02, turns = 2.2 + rnd();
      if (overEar(az, el)) continue;
      const pts: THREE.Vector3[] = []; for (let k = 0; k <= 14; k++) { const t = k / 14, ph = t * turns * Math.PI * 2 + i; pts.push(root.clone().addScaledVector(out, len * t * s).addScaledVector(side, Math.cos(ph) * rr * s).addScaledVector(upv, Math.sin(ph) * rr * s).add(new THREE.Vector3(0, -len * 0.35 * t * t * s, 0))); }
      lock(pts, 0.04, 0.02, i, streakAt(az), 0.8);
    }
  }
}

/** Braids hung from behind the ears once the figure is posed: two strands roped round each other down over the
 *  shoulder, bound twice, ending in a tuft, laid over whatever the chest and neck wear (a gorget, a breastplate, a bust,
 *  a cloak's mantle) instead of through it. Each point of the hang is cast out from behind the neck and lifted onto the
 *  outermost surface it would sink under, then the line is smoothed and lifted again. Built in the chest's frame, so
 *  the braids lie on the body and their tops meet the head however it is turned. */
function drapeBraids(up: THREE.Object3D, neck: THREE.Object3D, head: THREE.Object3D, s: number): void {
  const b = head.userData.braids as { color: string; from: { sx: number; at: THREE.Vector3 }[] } | undefined; if (!b) return;
  up.updateMatrixWorld(true);
  const H = b.color, rr = (t: number) => 0.045 * (1 - 0.35 * t) * s, room = (t: number) => rr(t) + 0.055 * s, back = -0.6 * s;
  // the surfaces the braids may lie on, as one list of triangles in the chest's frame: the chest's and the neck's own
  // parts, only where the braids hang (the front, between the shoulders, from the ears down)
  const tops = b.from.map(({ at: a0 }) => up.worldToLocal(head.localToWorld(a0.clone())).y), y1 = Math.max(...tops) + 0.1 * s, y0 = Math.min(...tops) - 1.5 * s;
  const tri: number[] = [], toUp = new THREE.Matrix4().copy(up.matrixWorld).invert(), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const m of [...up.children, ...neck.children]) {
    if (!(m as M).isMesh || ((m as M).material as THREE.Material).transparent) continue;
    const g = (m as M).geometry, pos = g.getAttribute('position') as THREE.BufferAttribute, idx = g.index, P = new Float32Array(pos.count * 3);
    m4.multiplyMatrices(toUp, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m4); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const A = (idx ? idx.getX(i) : i) * 3, B = (idx ? idx.getX(i + 1) : i + 1) * 3, C = (idx ? idx.getX(i + 2) : i + 2) * 3;
      if (Math.max(P[A + 1], P[B + 1], P[C + 1]) < y0 || Math.min(P[A + 1], P[B + 1], P[C + 1]) > y1 || Math.max(P[A + 2], P[B + 2], P[C + 2]) < -0.2 * s || Math.min(Math.abs(P[A]), Math.abs(P[B]), Math.abs(P[C])) > 1.1 * s) continue;
      tri.push(P[A], P[A + 1], P[A + 2], P[B], P[B + 1], P[B + 2], P[C], P[C + 1], P[C + 2]);
    }
  }
  // how far out from the line behind the neck the outermost surface lies, along a level ray at height y toward (dx, dz)
  const outermost = (y: number, dx: number, dz: number) => {
    let far = 0;
    for (let i = 0; i < tri.length; i += 9) {
      const e1x = tri[i + 3] - tri[i], e1y = tri[i + 4] - tri[i + 1], e1z = tri[i + 5] - tri[i + 2], e2x = tri[i + 6] - tri[i], e2y = tri[i + 7] - tri[i + 1], e2z = tri[i + 8] - tri[i + 2];
      const px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
      const tx = -tri[i], ty = y - tri[i + 1], tz = back - tri[i + 2], u = (tx * px + ty * py + tz * pz) / det; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (dx * qx + dz * qz) / det; if (w < 0 || u + w > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) / det; if (d > far) far = d;
    }
    return far;
  };
  // (cast from behind the neck, so a point sunk in the shoulders comes out over the front of them, not off their side)
  const lift = (path: THREE.Vector3[]) => path.forEach((p, i) => {
    if (i === 0) return;
    const dx = p.x, dz = p.z - back, d = Math.hypot(dx, dz); if (d < 1e-6) return;
    const want = outermost(p.y, dx / d, dz / d) + room(i / (path.length - 1));
    if (d < want) p.set(dx / d * want, p.y, back + dz / d * want);
  });
  for (const { sx, at: a0 } of b.from) {
    const a = up.worldToLocal(head.localToWorld(a0.clone())), path: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) { const t = i / 28; path.push(new THREE.Vector3(a.x + sx * 0.05 * t * s, a.y - 1.25 * t * s, a.z + 0.3 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * s)); }
    lift(path);
    for (let it = 0; it < 3; it++) { const q = path.map((p) => p.clone()); for (let i = 1; i < path.length - 1; i++) path[i].copy(q[i - 1]).add(q[i + 1]).addScaledVector(q[i], 2).multiplyScalar(0.25); lift(path); }
    const at2 = (t: number) => { const f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)); return path[i].clone().lerp(path[i + 1], f - i); };
    for (let k = 0; k < 2; k++) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 28; i++) { const t = i / 28, c = path[i], ph = t * 20 + k * Math.PI; pts.push(new THREE.Vector3(c.x + Math.cos(ph) * rr(t), c.y, c.z + Math.sin(ph) * rr(t))); } up.add(sm(lockGeometry(pts, 0.05 * s, 0.03 * s, 0.9, 7, 0), k ? H : tone(H, '#000000', 0.14), true)); }
    for (const t of [0.42, 0.9]) { const c = at2(t), band = sm(new THREE.TorusGeometry(0.075 * (1 - 0.3 * t) * s, 0.018 * s, 6, 16), '#b8bec8'); band.rotation.x = Math.PI / 2; up.add(at(band, c.x, c.y, c.z)); }
    const e = path[path.length - 1], shade = (i: number) => i % 3 === 0 ? sheen(H, 0.1) : i % 3 === 1 ? H : tone(H, '#000000', 0.14);
    for (let k = 0; k < 5; k++) up.add(sm(lockGeometry([e, new THREE.Vector3(e.x + (k - 2) * 0.02 * s, e.y - 0.1 * s, e.z + 0.01 * s), new THREE.Vector3(e.x + (k - 2) * 0.035 * s, e.y - 0.2 * s, e.z)], 0.03 * s, 0.006 * s, 0.5, 6), shade(k), true));
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

/** A grid of points to a mesh: `rows` + 1 rows of `cols` (row-major, the first row at the top), as kit/cloth.ts hangs. */
function gridGeometry(pos: number[], cols: number, rows: number): THREE.BufferGeometry {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A capelet over the shoulders: its neckline low on the shoulders round the base of the neck (so the neck shows) and
 *  dipping to a V where it opens down the front, the cloth running out over the shoulders and down over the tops of the
 *  arms. CAPE_ROWS + 1 rows of DRAPE_COLS, the neckline first; angles from the front round through +x. */
const CAPE_ROWS = 14, CAPE_GAP = 0.34;
function capelet(tr: Ring[], fr: Frame, s: number, c: string): M {
  const pos: number[] = [], yN = 2.15, yH = 1.45;
  const half = fr.shoulderX + 0.3 * fr.arm + 0.08;
  const front = Math.max(ringAt(tr, 1.6).f, ringAt(tr, 1.75).f) + fr.bust * 0.95 + 0.1, back = Math.max(ringAt(tr, 1.6).b, ringAt(tr, 1.85).b) + 0.12;
  for (let i = 0; i <= CAPE_ROWS; i++) {
    const t = i / CAPE_ROWS, out = Math.sin(t * Math.PI / 2), drop = 1 - Math.cos(t * Math.PI / 2);
    for (let j = 0; j < DRAPE_COLS; j++) {
      const th = CAPE_GAP / 2 + (Math.PI * 2 - CAPE_GAP) * j / (DRAPE_COLS - 1), cs = Math.cos(th), y0 = yN + 0.02 - 0.2 * Math.max(0, cs) ** 6;
      const [nx, nz] = ringPoint(ringAt(tr, y0), th, 1.1);
      const fold = 1 + 0.05 * t * t * Math.sin(9 * th + 0.9), hx = Math.sin(th) * half * fold, hz = cs * (cs > 0 ? front : back) * fold;
      pos.push((nx + (hx - nx) * out) * s, (y0 - (y0 - yH) * drop) * s, (nz + (hz - nz) * out) * s);
    }
  }
  return sm(gridGeometry(pos, DRAPE_COLS, CAPE_ROWS), c, true);
}
/** Cloth cut close on the body from `top` down to the widest of the hips and hanging straight from there to its hem
 *  (`hem`), flaring by `flare` below `flareFrom`: a mail shirt, a tunic's skirt below its belt. `ease` is how far out it
 *  sits on the torso and on the hips; folds deepen and the hem grows ragged toward the bottom. `rows` + 1 rows of
 *  DRAPE_COLS (the first at the top), closed at the back; in the upper body's frame. */
function bodyCut(tr: Ring[], pr: Ring[], s: number, c: string, o: { top: number; hem: number; rows: number; ease: [number, number]; flare: number; flareFrom: number; folds?: number; amp?: number; jag?: number; seed?: number;
  warp?: (p: [number, number, number]) => [number, number, number]; seat?: (th: number, y: number) => number }): M {
  const pos: number[] = [], widest = new Float64Array(DRAPE_COLS * 2), n = o.folds ?? 0, sd = o.seed ?? 0;
  for (let i = 0; i <= o.rows; i++) {
    const y = o.top + (o.hem - o.top) * i / o.rows, t = Math.max(0, (o.flareFrom - y) / (o.flareFrom - o.hem));
    for (let j = 0; j < DRAPE_COLS; j++) {
      const th = (j / (DRAPE_COLS - 1)) * Math.PI * 2;
      let bx = 0, bz = 0, best = 0;
      const take = (x: number, z: number) => { const d = Math.hypot(x, z); if (d > best) { best = d; bx = x; bz = z; } };
      if (y >= tr[0].y) { const [x, z] = ringPoint(ringAt(tr, y), th, o.ease[0]), q = o.warp ? o.warp([x, y, z]) : [x, y, z]; take(q[0], q[2]); }
      if (y >= pr[0].y && y <= pr[pr.length - 1].y) { const [x, z] = ringPoint(ringAt(pr, y), th, o.ease[1] * (1 + (o.seat?.(th, y) ?? 0))); take(x, z); }
      // below the widest of the hips it hangs straight down
      const wx = widest[j * 2], wz = widest[j * 2 + 1];
      if (best < Math.hypot(wx, wz)) { bx = wx; bz = wz; } else { widest[j * 2] = bx; widest[j * 2 + 1] = bz; }
      const fl = 1 + o.flare * t ** 1.5 + (o.amp ?? 0) * t * (0.7 * Math.sin(n * th + sd) + 0.3 * Math.sin(n * 2.3 * th + 2 * sd));
      pos.push(bx * fl * s, (y - (o.jag ?? 0) * t ** 4 * Math.abs(Math.sin(n * 0.5 * th + sd))) * s, bz * fl * s);
    }
  }
  return sm(gridGeometry(pos, DRAPE_COLS, o.rows), c, true);
}
const MAIL_ROWS = 18, MAIL_TOP = 1.3, MAIL_HEM = -0.55, HEM_ROWS = 12;
/** A plate in lames, for kit/cloth.ts to hang stiff: round an arc of a ring stack (from `th0`, `wrap` radians), each
 *  lame [top, bottom, k at the top, k at the bottom] tucked under the rim of the one above it. Returns the grid and the
 *  row each lame's rim is on. */
function lamesGeometry(rings: Ring[], th0: number, wrap: number, lames: [number, number, number, number][], s: number, cols = 13, per = 4, bump?: (th: number, y: number) => number) {
  const pos: number[] = [], rims: number[] = [];
  let row = 0;
  for (const [y0, y1, k0, k1] of lames) {
    for (let i = 0; i <= per; i++, row++) {
      const t = i / per, y = y0 + (y1 - y0) * t, r = ringAt(rings, y), k = k0 + (k1 - k0) * t;
      for (let j = 0; j < cols; j++) { const th = th0 + wrap * j / (cols - 1), [x, z] = ringPoint(r, th, k * (1 + (bump?.(th, y) ?? 0))); pos.push(x * s, y * s, z * s); }
    }
    rims.push(row - 1);
  }
  return { geo: gridGeometry(pos, cols, row - 1), cols, rows: row, rims };
}
/** The hips and belly as one stack (the wider of the torso and the pelvis at each height), for plate round them. */
function hipStack(tr: Ring[], pr: Ring[]): Ring[] {
  const out: Ring[] = [];
  for (let y = pr[0].y; y <= 1.0 + 1e-6; y += 0.06) {
    const a = y >= tr[0].y ? ringAt(tr, y) : undefined, b = y <= pr[pr.length - 1].y ? ringAt(pr, y) : undefined;
    out.push({ y, w: Math.max(a?.w ?? 0, b?.w ?? 0), f: Math.max(a?.f ?? 0, b?.f ?? 0), b: Math.max(a?.b ?? 0, b?.b ?? 0), n: a?.n ?? 2 });
  }
  return out;
}
/** The underskirt's froth: a ruffle peeping out below a hung skirt's hem, all along it, carried on along the cloth. */
function frill(G: Garment, c: string, s: number, folds = 22): M {
  const N = 120, pos: number[] = [], v = new THREE.Vector3();
  for (const [t, off, ext, wave] of [[0.96, -0.012, 0, 0.2], [1, -0.004, 0.03, 0.6], [1, 0.0, 0.085, 1]] as const) {
    for (let i = 0; i <= N; i++) {
      const u = i / N, h = clothPoint(G, u, t, off * s), along = v.copy(clothPoint(G, u, 1)).sub(clothPoint(G, u, 0.93)).normalize();
      const radial = new THREE.Vector3(h.x - G.axis.x, 0, h.z - G.axis.z).normalize(), ph = folds * u * Math.PI * 2;
      h.addScaledVector(along, ext * s).addScaledVector(radial, wave * 0.05 * s * Math.sin(ph)).addScaledVector(along, wave * 0.025 * s * Math.cos(ph));
      pos.push(h.x, h.y, h.z);
    }
  }
  return sm(gridGeometry(pos, N + 1, 2), c, true);
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
  // (the body's own surfaces, and what is worn close on the trunk, are marked as its skin: kit/clothcheck.ts)
  const skinOf = (m: M) => { m.userData.skin = true; return m; };
  pel.add(skinOf(loft(pelvisRings(fr), gown ? f.skirt! : trim, { seg: 48, rows: 28, bump: seatBump })));
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
  let hem: M | undefined; // the tunic's skirt below the belt
  if (gown) {
    // the dress to just under the bust, bare skin above (shoulders and the chest), the bust in the dress: a sweetheart line
    up.add(skinOf(loft(clipRings(tr, tr[0].y, 1.57), torsoC, { seg: 80, rows: 64, warp: bustWarp, jig: bustJig })));
    up.add(skinOf(loft(clipRings(tr, 1.3, 2.3), skin, { seg: 80, rows: 48, k: 0.985, bump: chestBump, warp: bustWarp, jig: bustJig })));
    if (R > 0.3) { const z = (y: number) => bustWarp([0, y, ringAt(tr, y).f])[2] * 0.985 + 0.004; up.add(tube([1.58, 1.68, 1.78, 1.86].map((y) => new THREE.Vector3(0, y * s, z(y) * s)), 0.012 * s, tone(skin, '#3a1418', 0.35))); } // the cleft
    for (const sx of [-1, 1]) up.add(tube([0.05, 0.18, 0.31, 0.42].map((x, i) => { const y = 1.98 + [0, 0.02, 0.03, 0.035][i], r = ringAt(tr, y); return new THREE.Vector3(sx * x * s, y * s, (r.f * Math.sqrt(Math.max(0.05, 1 - (x / r.w) ** 2)) + 0.006) * s); }), 0.02 * s, tone(skin, '#ffffff', 0.07))); // collarbones, lying on the chest's front
  } else {
    up.add(skinOf(loft(tr, torsoC, fr.bust ? { seg: 80, rows: 90, bump: chestBump, warp: bustWarp, jig: bustJig } : { seg: 32, bump: chestBump })));
    const br = ringAt(tr, 0.42); up.add(skinOf(sm(loftGeometry([{ ...br, y: 0.32 }, { ...br, y: 0.52 }], s, { seg: 32, k: 1.05, rows: 2 }), trim)));
    if (!f.skirt && f.hem !== false && f.armor?.kind !== 'plate') { hem = bodyCut(tr, pelvisRings(fr), s, cloth, { top: 0.4, hem: -0.42, rows: HEM_ROWS, ease: [1.03, 1.06], flare: 0.16, flareFrom: 0.4, folds: 6, amp: 0.05, jag: 0.03, seed: 0.2, seat: seatBump }); up.add(hem); } // (from under the belt; hung with the rest of the cloth once posed)
    up.add(band(tr, 2.13, 0.07, 1.07, trim, 24));                                                      // the neckband
    if (f.hem !== false && f.armor?.kind !== 'plate') { // (under a plate's fauld the belt's tail would hang down into the tassets)
      const tail = box(0.1 * s, 0.5 * s, 0.03 * s, trim); tail.rotation.z = -LX * 0.12; up.add(skinOf(at(tail, LX * 0.2 * s, 0.17 * s, (br.f * 1.05 + 0.03) * s))); // the belt's tail, hanging on the left
      up.add(skinOf(at(box(0.11 * s, 0.05 * s, 0.035 * s, tone(trim, '#ffffff', 0.25)), LX * 0.235 * s, -0.06 * s, (br.f * 1.05 + 0.032) * s)));
    }
  }
  const neck = new THREE.Group(); neck.position.y = 2.24 * s; neck.name = 'neck'; up.add(neck);
  // the neck, and on a masculine one the larynx: a soft rise in the front of the throat, not a bead on it
  const ly = 0.13 + 0.28 * neckLift(fr), larynx = fr.fem ? undefined : (th: number, y: number) => { const t = th > Math.PI ? th - 2 * Math.PI : th; return 0.06 * Math.exp(-((t / 0.26) ** 2) - ((y - ly) / 0.07) ** 2); };
  neck.add(loft(neckRings(fr), skin, { seg: 32, rows: 24, bump: larynx }));
  const head = new THREE.Group(); head.position.y = (0.21 + neckLift(fr)) * s; head.name = 'head'; neck.add(head);
  // empty mounts for gear: the belt at each hip (sheaths hang down -y), and between the shoulder blades (+y up the back)
  for (const sx of [RX, LX]) { const b = new THREE.Group(); b.name = sx === RX ? 'beltR' : 'beltL'; b.position.set(sx * ringAt(tr, 0.42).w * s, 0.42 * s, 0.05 * s); up.add(b); }
  const back = new THREE.Group(); back.name = 'back'; back.position.set(0, 1.5 * s, -(ringAt(tr, 1.5).b + 0.12) * s); up.add(back);
  const arm: Limb[] = [], leg: Limb[] = [], soles: M[] = [];
  const upperC = gown ? skin : f.sleeves ?? cloth, lowerC = f.bracers ?? (f.rolled ? skin : f.sleeves ?? (gown ? skin : cloth)), handC = f.gauntlets ?? skin, a = fr.arm, hs = fr.hand;
  for (const sx of [RX, LX]) {
    const side = sx === RX ? 'R' : 'L';
    // the collar carries the shoulder: it lifts when the arm goes up
    const collar = new THREE.Group(); collar.position.set(sx * 0.12 * s, 1.98 * s, 0); collar.name = 'collar' + side; up.add(collar);
    const root = new THREE.Group(); root.position.set(sx * (fr.shoulderX - 0.12) * s, 0.02 * s, 0); root.rotation.set(-0.08, 0, sx * 0.1); root.name = 'shoulder' + side; collar.add(root);
    const upper = loft(upperArmRings(fr, sx), upperC, { seg: 20 }); root.add(upper);
    if (f.puffSleeves && f.sleeves) {
      if (gown) { // off the shoulder: a gathered band round the upper arm with a ruffle below it
        const band = sm(new THREE.TorusGeometry(0.2 * s * a, 0.045 * s, 8, 20), f.sleeves); band.rotation.x = Math.PI / 2; root.add(at(band, 0, -0.36 * s, 0));
        const ruf = drape(0.2 * s * a, 0.3 * s * a, 0.3 * s, f.sleeves, { folds: 9, amp: 0.25, jag: 0.04 * s, seed: 1.3 }); root.add(at(ruf, 0, -0.52 * s, 0));
      } else { const puff = sph(0.25 * s * a, f.sleeves); puff.scale.set(1.05, 1.3, 1.05); root.add(at(puff, -sx * 0.04 * s, -0.36 * s, 0)); }
    }
    // the elbow: no ball; the forearm starts where the upper arm ends, and the two bend as one (see bendLimb)
    const mid = new THREE.Group(); mid.position.set(0, -1.12 * s, 0); mid.rotation.x = -0.22; mid.name = 'elbow' + side; root.add(mid);
    const lower = loft(clipRings(forearmRings(fr), -1.04, 0), lowerC, { seg: 14, rows: 24 }); mid.add(lower);
    if (f.rolled) { const sc = f.sleeves ?? cloth; mid.add(band(forearmRings(fr), -0.2, 0.13, 1.28, sc, 14)); mid.add(band(forearmRings(fr), -0.3, 0.07, 1.22, tone(sc, '#000000', 0.25), 14)); mid.add(band(forearmRings(fr), -0.1, 0.06, 1.2, tone(sc, '#ffffff', 0.1), 14)); } // the rolled cuff, in turns
    if (f.bracers) { mid.add(at(cyl(0.125 * s * a, 0.105 * s * a, 0.12 * s, f.bracers, 12), 0, -0.96 * s, 0)); mid.add(at(cyl(0.17 * s * a, 0.17 * s * a, 0.05 * s, tone(f.bracers, '#000000', 0.3), 12), 0, -0.3 * s, 0)); }
    const end = new THREE.Group(); end.position.set(0, -1.04 * s, 0); end.rotation.x = 0.06; end.name = 'wrist' + side; mid.add(end);
    // the hand: a palm, four fingers a little curled, and the thumb
    const hand = sph(0.105 * hs * s, handC, 12, 10); hand.scale.set(0.9, 1.15, 0.42); end.add(at(hand, 0, (-0.03 - 0.1 * hs) * s, 0.005 * s));
    // (palm to the front in the rest of the rig's frame, so the index finger and the thumb are on the outer side; a
    // relaxed hand curls each finger a little more than the one before it, index to little finger)
    for (let i = 0; i < 4; i++) {
      const len = [0.08, 0.095, 0.09, 0.07][i] * hs, x = (i - 1.5) * 0.047 * hs * -sx;
      const k1 = cap(0.024 * hs * s, len * s, handC); k1.rotation.x = -0.3 - 0.08 * i; end.add(at(k1, x * s, (-0.03 - 0.205 * hs - len * 0.3) * s, (0.015 + 0.006 * i) * s));
      const k2 = cap(0.021 * hs * s, len * 0.7 * s, handC); k2.rotation.x = -0.95 - 0.14 * i; end.add(at(k2, x * s, (-0.03 - 0.27 * hs - len * 0.5) * s, (0.06 + 0.01 * i) * hs * s));
    }
    const th = cap(0.029 * hs * s, 0.09 * hs * s, handC); th.rotation.z = sx * 0.55; th.rotation.x = -0.5; end.add(at(th, sx * 0.1 * hs * s, (-0.03 - 0.1 * hs) * s, 0.05 * s));
    shapeHand(handMeshes(end), -sx, hs * s, s, RELAXED); // each finger a chain from its knuckle, in the resting cascade
    arm.push({ root, mid, end, upper, lower, hand, collar, hs });

    const hx = gown ? 0.21 : fr.hipX, legC = gown ? skin : trim;
    const hip = new THREE.Group(); hip.position.set(sx * hx * s, 0, 0); hip.rotation.z = sx * 0.04; hip.name = 'hip' + side; pel.add(hip);
    const thigh = loft(thighRings(fr), legC, { seg: 16, rows: 32 }); hip.add(thigh);
    // the knee, as the elbow: the shin starts where the thigh ends and the two bend as one
    const knee = new THREE.Group(); knee.position.set(0, -THIGH * s, 0); knee.name = 'knee' + side; hip.add(knee);
    const shin = loft(clipRings(shinRings(fr), -SHIN, 0), legC, { seg: 14, rows: 28 }); knee.add(shin);
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
    ankle.add(at(box(0.2 * fl * s, 0.1 * s, 0.16 * fl * s, tone(boot, '#000000', 0.45)), 0, -0.42 * s, -0.1 * fl * s)); // the heel (flush with the sole's tread)
    leg.push({ root: hip, mid: knee, end: ankle, upper: thigh, lower: shin, hand: foot });
  }
  return { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig, hem, seatBump };
}

/** A hero's miniature: origin at the floor centre, feet in world units, facing +z. `battle` puts it in its stance. */
export function heroFigure(f: HeroFigure, size: CreatureSize = 'medium', state: boolean | 'rest' | 'battle' | 'dead' = false): THREE.Group {
  const battle = state === true || state === 'battle', dead = state === 'dead';
  const s = (SIZE_SCALE[size] ?? 1) * (f.height ?? 1);
  const gown = !!(f.skirt && f.underskirt);
  const { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig, hem, seatBump } = rig(f, s, gown);
  const hy = (2.82 + neckLift(fr)) * s; // the head's centre, in the upper body's frame
  const headAt = neck.position.y + head.position.y; // the head joint, in the upper body's frame
  if (f.headSize) head.scale.setScalar(f.headSize);
  const gz = gazeOf(poseOf(f, battle, dead, gown), battle), surf = buildFace(head, s, hy - headAt, f, fr.fem, dead, [RX * gz[0], gz[1]]); // (the face's +x is the figure's left)
  // the body's own surfaces (the rig's skin and boots, and the face): what a body laid out on the floor rests on
  const own = new Set<THREE.Object3D>(); body.traverse((c) => { if ((c as M).isMesh) own.add(c); });
  const [R, Lf] = arm;
  // a group in each hand for what it holds: upright while the forearm hangs at rest
  const holder = (l: Limb) => { const g = new THREE.Group(); g.position.set(0, (-0.03 - 0.12 * (l.hs ?? 1)) * s, 0.05 * s); g.rotation.set(-(l.root.rotation.x + l.mid.rotation.x), 0, -Math.sign(l.root.position.x) * 0.08); l.end.add(g); return g; };
  const gR = holder(R), gL = holder(Lf); gR.name = 'handR'; gL.name = 'handL';
  const joints0: Record<string, THREE.Object3D> = {}; body.traverse((o) => { if (o.name) joints0[o.name] = o; });
  // cloth: each garment is cut here, in its parent's frame, and hung on the body once it is posed (kit/cloth.ts)
  const garments: Garment[] = [], cops: THREE.Group[] = [], lames: THREE.Group[] = [];
  const wear = (name: string, m: M, parent: THREE.Object3D, cols: number, rows: number, o: Omit<Garment, 'name' | 'mesh' | 'cols' | 'rows' | 'axis'> & { axis?: [number, number] }): Garment => {
    if (m.parent !== parent) parent.add(m);
    m.updateMatrix(); m.geometry.applyMatrix4(m.matrix); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    m.userData.garment = name;
    const { axis, ...rest } = o, g: Garment = { name, mesh: m, cols, rows, axis: new THREE.Vector3(axis?.[0] ?? 0, 0, axis?.[1] ?? 0), ...rest };
    garments.push(g); return g;
  };
  const LEGS = ['thighR', 'thighL', 'shinR', 'shinL'], FEET = ['footR', 'footL'], ARMS = ['upperArmR', 'upperArmL', 'forearmR', 'forearmL'], HANDS = ['handR', 'handL'], LOWER_ARMS = ['forearmR', 'forearmL', ...HANDS];
  // the tunic's skirt: over the thighs (a lifted knee tents it), inside a hand resting on the hip
  if (hem) wear('hem', hem, up, DRAPE_COLS, HEM_ROWS + 1, { closed: true, covers: ['torso', 'pelvis', ...LEGS], outside: LOWER_ARMS, layer: 0, clear: 0.035 * s, spread: 5, hang: 0.8 });
  const wpn = f.gear?.handR ? 'none' : f.weapon; // (gear in the hand takes the place of the figure's own weapon)
  // (held by the grip below the guard: the index finger and the thumb close under it, not into it)
  if (wpn === 'sword') gR.add(at(box(0.12 * s, 2.6 * s, 0.32 * s, '#c8ccd2'), 0, 1.57 * s, 0), at(box(0.7 * s, 0.12 * s, 0.14 * s, '#a07a3a'), 0, 0.27 * s, 0), at(box(0.12 * s, 0.5 * s, 0.12 * s, '#3b2a20'), 0, -0.03 * s, 0));
  if (wpn === 'spear') gR.add(at(box(0.12 * s, 7 * s, 0.12 * s, '#3b2a20'), 0, 0.85 * s, 0), at(cone(0.2 * s, 0.8 * s, '#c8ccd2'), 0, 4.75 * s, 0));
  if (wpn === 'staff') gR.add(at(box(0.14 * s, 6 * s, 0.14 * s, '#3b2a20'), 0, 0.45 * s, 0));
  if (wpn === 'torch') gR.add(at(box(0.14 * s, 1.6 * s, 0.14 * s, '#3b2a20'), 0, 0.55 * s, 0), at(sph(0.32 * s, '#f0a040'), 0, 1.55 * s, 0));

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
  if (f.buckle && f.armor?.kind !== 'plate') { up.add(at(box(0.24 * s, 0.2 * s, 0.06 * s, f.buckle), 0, 0.42 * s, 0.63 * s)); up.add(at(box(0.12 * s, 0.1 * s, 0.07 * s, f.trim ?? '#2b2420'), 0, 0.42 * s, 0.64 * s)); } // (on plate, on the fauld: below)

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
    const tails = drape(0.62 * s, 0.75 * s, 1.6 * s, f.coat.tails, { folds: 5, amp: 0.08, jag: 0.25 * s, gap: Math.PI * 1.2, rows: 16 }); tails.position.y = -0.55 * s;
    wear('tails', tails, up, DRAPE_COLS, 17, { closed: false, covers: ['pelvis', ...LEGS, ...FEET, 'hem', 'stowed'], outside: LOWER_ARMS, layer: 1, clear: 0.04 * s, spread: 5, hang: 0.9 });
    for (const sx of [-1, 1]) { const lp = box(0.16 * s, 0.9 * s, 0.05 * s, f.coat.lapel ?? f.coat.tails); lp.rotation.z = sx * 0.25; up.add(at(lp, sx * 0.24 * s, 1.75 * s, 0.42 * s)); up.add(at(box(0.07 * s, 0.32 * s, 0.05 * s, '#c9c2b0'), sx * 0.45 * s, 1.0 * s, 0.4 * s)); }
  }

  // a satchel on a strap across the chest, and vials at the belt
  if (f.satchel) {
    const strap = box(0.1 * s, 2.5 * s, 0.05 * s, f.satchel); strap.rotation.z = RX * 0.62; up.add(at(strap, LX * 0.05 * s, 1.15 * s, 0.45 * s)); // over the left shoulder, down to the bag
    const bag = sm(new THREE.CapsuleGeometry(0.22 * s, 0.25 * s, 3, 8), f.satchel); bag.rotation.z = Math.PI / 2; bag.scale.z = 0.55; up.add(at(bag, RX * 0.72 * s, -0.12 * s, 0.38 * s));
    up.add(at(box(0.5 * s, 0.22 * s, 0.05 * s, tone(f.satchel, '#000000', 0.25)), RX * 0.72 * s, 0.0 * s, 0.52 * s));
    up.add(at(box(0.08 * s, 0.1 * s, 0.03 * s, f.buckle ?? '#9a9ea6'), RX * 0.72 * s, -0.08 * s, 0.56 * s));
  }
  (f.vials ?? []).slice(0, 4).forEach((c, i) => { const x = LX * (0.5 - i * 0.15) * s; const v = sph(0.075 * s, c, 10, 8); v.scale.y = 1.3; up.add(at(v, x, 0.2 * s, 0.6 * s)); up.add(at(cyl(0.03 * s, 0.03 * s, 0.12 * s, c, 6), x, 0.34 * s, 0.6 * s)); up.add(at(cyl(0.035 * s, 0.035 * s, 0.06 * s, '#8a6a4a', 6), x, 0.42 * s, 0.6 * s)); });

  // a long skirt from under the belt, cut to the waist and the hips (no band standing off the body) and falling from
  // the widest of them in a flare to the hem; or the fitted gown: hugging the hips and thighs, tight at the knee, flaring
  // to a mermaid hem with a short train, slit up the front of the left leg, the underskirt frothing at the hem
  if (f.skirt && !gown) {
    const k = bodyCut(tr, pelvisRings(fr), s, f.skirt, { top: 0.3, hem: -2.4, rows: 20, ease: [1.03, 1.06], flare: 0.42, flareFrom: -0.15, folds: 7, amp: 0.08, jag: 0.05, seed: 0.4, seat: seatBump });
    wear('skirt', k, pel, DRAPE_COLS, 21, { closed: true, covers: ['torso', 'pelvis', ...LEGS, ...FEET], outside: LOWER_ARMS, layer: 0, clear: 0.04 * s, spread: 6, hang: 0.85 });
  }
  if (gown) {
    // cut on the hips (it turns with them), hung on the posed legs: a step forward flares the hem over the knee, and the
    // leg in the slit shows through it; the trims and the underskirt's froth are laid on the hung cloth
    const top = GOWN[0][0] * s, bot = GOWN[GOWN.length - 1][0] * s, tAt = (y: number) => (top - y * s) / (top - bot);
    const g = sheath(GOWN.map(([y, r]) => [y * s, r * s] as [number, number]), f.skirt!, { zs: 0.68, slitAt: LX * 0.42, slitTop: 2.85 * GK * s, slitW: 1.0, flareFrom: 1.3 * GK * s, folds: 9, amp: 0.1, train: 0.35 });
    g.mesh.position.y = -HIP * s;
    wear('gown', g.mesh, pel, 65, 45, { closed: false, covers: ['torso', 'pelvis', ...LEGS, ...FEET], outside: LOWER_ARMS, layer: 0, clear: 0.03 * s, spread: 5, hang: 0.55, after: (G) => {
      pel.add(frill(G, f.underskirt!, s));
      if (!f.gownTrim) return;
      const hemLine: THREE.Vector3[] = []; for (let i = 0; i <= 48; i++) hemLine.push(clothPoint(G, i / 48, tAt(0.06), 0.012 * s));
      pel.add(tube(hemLine, 0.025 * s, f.gownTrim));
      for (const u of [0, 1]) {
        const edge: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) edge.push(clothPoint(G, u, tAt((2.85 - i * 0.279) * GK), 0.01 * s));
        pel.add(tube(edge, 0.02 * s, f.gownTrim));
        for (let i = 1; i < 10; i += 2) { const q = clothPoint(G, u, tAt((2.85 - i * 0.279) * GK), 0.025 * s), leaf = sph(0.045 * s, f.gownTrim, 6, 4); leaf.scale.set(0.5, 1, 0.25); leaf.rotation.z = (u ? 1 : -1) * (i % 4 === 1 ? 0.7 : -0.7); pel.add(at(leaf, q.x, q.y, q.z)); }
      }
      const belt: THREE.Vector3[] = []; for (let i = 0; i <= 32; i++) belt.push(clothPoint(G, i / 32, tAt(3.72 * GK), 0.015 * s));
      pel.add(tube(belt, 0.022 * s, f.gownTrim, false));
    } });
    if (f.gownTrim) { const r = ringAt(tr, 1.57); up.add(sm(loftGeometry([{ ...r, y: 1.55 }, { ...r, y: 1.585 }], s, { seg: 80, k: 1.015, rows: 1, warp: bustWarp, jig: bustJig }), f.gownTrim)); } // the neckline's edge
  }


  buildHair(head, s, hy - headAt, f, fr.fem);

  // armour
  if (f.armor?.kind === 'plate') {
    const t = f.armor.trim ?? '#a9adb6';
    // pauldrons: a broad domed cap over the shoulder and two lames below it hugging the upper arm, each a curved plate
    // edged in trim with rivets, overlapping down the arm and tipped out at the lower edge; they ride the shoulder joint,
    // so they lift and swing with the arm
    arm.forEach((l, k) => {
      const sx = k === 0 ? RX : LX, ar = 0.19 * fr.arm * s;
      const trimArc = (r: number, arc: number, mid: number) => { const g = new THREE.Group(); g.rotation.y = arc / 2 - mid; const tr2 = sm(new THREE.TorusGeometry(r, 0.016 * s, 5, 32, arc), t); tr2.rotation.x = Math.PI / 2; g.add(tr2); return g; };
      // the cap: a shell over the top and outside of the shoulder, wider than deep
      const cr = ar * 1.75, cap0 = new THREE.Group(); cap0.position.set(sx * 0.02 * s, -0.04 * s, 0); cap0.rotation.z = sx * 0.28; l.root.add(cap0);
      const dome = sm(new THREE.SphereGeometry(cr, 32, 14, 0, Math.PI * 2, 0, 1.5), f.armor!.color, true); dome.scale.set(1, 0.72, 0.92); cap0.add(dome);
      const rimY = cr * 0.72 * Math.cos(1.5), rimR = cr * Math.sin(1.5), rim = trimArc(rimR, Math.PI * 2, 0); rim.position.y = rimY; rim.scale.z = 0.92; cap0.add(rim);
      for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2; cap0.add(at(sph(0.02 * s, t, 6, 4), Math.cos(a) * rimR * 0.97, rimY + 0.012 * s, Math.sin(a) * rimR * 0.92 * 0.97)); }
      // the lames: curved plates round the outer two thirds of the arm, shaped to it (the deltoid swelling under the upper
      // one), each tucked under the one above and tipped out at its lower edge
      const rings = upperArmRings(fr, sx), wrap = 3.9, th0 = sx * Math.PI / 2 - wrap / 2;
      for (let i = 0; i < 2; i++) {
        const y0 = -0.06 - i * 0.19, y1 = y0 - 0.27, k0 = 1.17 - 0.02 * i, k1 = k0 + 0.09, c = i % 2 ? f.armor!.color : tone(f.armor!.color, '#ffffff', 0.06);
        l.root.add(sm(shellGeometry(rings, y0, y1, th0, wrap, k0, k1, s), c, true));
        const edge: THREE.Vector3[] = []; for (let j = 0; j <= 24; j++) { const [x, z] = ringPoint(ringAt(rings, y1), th0 + wrap * j / 24, k1 + 0.01); edge.push(new THREE.Vector3(x * s, y1 * s, z * s)); }
        l.root.add(tube(edge, 0.016 * s, t));
        for (const q of [-0.8, 0, 0.8]) { const [x, z] = ringPoint(ringAt(rings, y0 - 0.05), sx * Math.PI / 2 + q, k0 + 0.03); l.root.add(at(sph(0.018 * s, t, 6, 4), x * s, (y0 - 0.05) * s, z * s)); }
      }
    });
    { const gg = sm(new THREE.CylinderGeometry(0.3 * fr.m.neck * s, 0.44 * fr.m.neck * s, 0.26 * s, 24, 1, true), f.armor.color, true); up.add(at(gg, 0, 2.22 * s, -0.01 * s)); // gorget: a flared collar of plate, edged at the top
      const gt = sm(new THREE.TorusGeometry(0.3 * fr.m.neck * s, 0.018 * s, 5, 24), t); gt.rotation.x = Math.PI / 2; up.add(at(gt, 0, 2.35 * s, -0.01 * s)); }
    const plateK = 1.09, plateBump = (th: number, y: number) => 0.05 * Math.exp(-((y - 1.5) ** 2) / 0.08) * Math.max(0, Math.cos(th)) ** 2 + 0.03 * Math.max(0, Math.cos(th)) ** 12;
    // the breastplate's bands: rims lying on its curve across the front
    const onPlate = (y: number, a: number) => { const r = ringAt(tr, y), [x, z] = ringPoint(r, a, plateK * (1 + plateBump(a, y)) + 0.012), q = bustWarp([x, y, z]); return new THREE.Vector3(q[0] * s, y * s, q[2] * s); };
    for (const [y, a, rr] of [[1.5, 1.05, 0.035], [0.95, 0.75, 0.028]] as const) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 12; i++) pts.push(onPlate(y, -a + 2 * a * i / 12)); up.add(tube(pts, rr * s, t)); }
    { const bp = sm(loftGeometry(clipRings(tr, 0.62, 1.95), s, { seg: fr.bust ? 72 : 32, rows: fr.bust ? 60 : undefined, k: plateK, warp: bustWarp, jig: bustJig, bump: plateBump }), f.armor.color); bp.userData.skin = true; up.add(bp); } // the breastplate, ridged down its centre
    // the fauld: four lames round the belly and hips, each flaring a little and lapping over the one below, a rolled rim
    // on each (the last one bright); it rests on the hips, as the tassets and the culet hung from it, but its lames give
    // with the body as it bends and turns, each turned a share of the way with the chest (FAULD_GIVE), the breastplate's
    // lower edge under the first
    const hips = hipStack(tr, pelvisRings(fr)), lighter = tone(f.armor.color, '#ffffff', 0.06), rolled = tone(f.armor.color, '#ffffff', 0.18);
    for (let i = 0; i < 4; i++) {
      const y0 = 0.68 - i * 0.17, y1 = y0 - 0.2, k0 = 1.12 + i * 0.05, k1 = k0 + 0.065, lg = new THREE.Group(); lg.name = 'fauld' + i; pel.add(lg); lames.push(lg);
      lg.add(sm(shellGeometry(hips, y0, y1, 0, Math.PI * 2, k0, k1, s, 40, 3), i % 2 ? lighter : f.armor.color, true));
      const rim: THREE.Vector3[] = []; for (let j = 0; j <= 40; j++) { const [x, z] = ringPoint(ringAt(hips, y1), (j / 40) * Math.PI * 2, k1 + 0.012); rim.push(new THREE.Vector3(x * s, y1 * s, z * s)); }
      lg.add(tube(rim, (i === 3 ? 0.02 : 0.016) * s, i === 3 ? t : rolled, true));
    }
    // the belt's buckle, on the front of the fauld's first lame, lying on its slope (it turns as the lame does)
    if (f.buckle) {
      const y = 0.58, r = ringAt(hips, y), k = 1.12 + 0.065 * (0.68 - y) / 0.2, tilt = Math.atan(0.065 * r.f / 0.2), z = ((r.z ?? 0) + r.f * k) * s;
      for (const [w, h, d, c] of [[0.24, 0.2, 0.06, f.buckle], [0.12, 0.1, 0.07, f.trim ?? '#2b2420']] as const) { const b = box(w * s, h * s, d * s, c); b.rotation.x = -tilt; lames[0].add(at(b, 0, y * s, z + (d / 2 - 0.01) * s)); }
    }
    const knot = sm(new THREE.TorusKnotGeometry(0.1 * s, 0.022 * s, 48, 6, 2, 3), t); up.add(at(knot, 0, 1.25 * s, 0.44 * s)); // a knotwork boss
    // tassets: a plate of two lames down the front of each thigh, and a culet of two over the seat, each hanging from the
    // fauld's last rim and swinging out as one piece over a thigh that lifts under it (kit/cloth.ts)
    const plateTrims = (G: Garment, rims: number[], parent: THREE.Object3D) => {
      rims.forEach((r, i) => { const pts: THREE.Vector3[] = []; for (let j = 0; j <= 12; j++) pts.push(clothPoint(G, j / 12, r / (G.rows - 1), 0.012 * s)); parent.add(tube(pts, 0.018 * s, i === rims.length - 1 ? t : rolled)); });
      for (const u of [0.12, 0.88]) parent.add(at(sph(0.022 * s, t, 6, 4), ...clothPoint(G, u, 0.06, 0.012 * s).toArray()));
    };
    for (const sd of ['R', 'L'] as const) {
      const sx = sd === 'R' ? RX : LX, hx = fr.hipX * s, rings = thighRings(fr);
      const L = lamesGeometry(rings, sx * 0.42 - 1.05, 2.1, [[0.02, -0.4, 1.3, 1.38], [-0.35, -0.74, 1.32, 1.42]], s);
      L.geo.translate(sx * hx, 0, 0);
      const m = sm(L.geo, f.armor.color, true);
      wear('tasset' + sd, m, lames[3], L.cols, L.rows, { closed: false, axis: [sx * hx, 0], covers: [`thigh${sd}`], layer: 1, clear: 0.03 * s, spread: 0, hang: 0, stiff: true, after: (G) => plateTrims(G, L.rims, lames[3]) });
    }
    // (the culet hangs straight down from the rim, as wide as the hips are at the tops of the thighs: below that the
    // seat narrows into the fork, which a plate cannot follow, and the thighs there would stand out past it; it rides out
    // over a full seat as over a thigh)
    { const seatRings = hips.map((r) => (r.y < -0.05 ? { ...ringAt(hips, -0.05), y: r.y } : r)), L = lamesGeometry(seatRings, Math.PI - 1.1, 2.2, [[-0.02, -0.3, 1.24, 1.32], [-0.26, -0.5, 1.3, 1.42]], s, 15, 4, (th, y) => 0.5 * seatBump(th, y));
      wear('culet', sm(L.geo, lighter, true), lames[3], L.cols, L.rows, { closed: false, covers: ['thighR', 'thighL', 'pelvis'], layer: 1, clear: 0.03 * s, spread: 0, hang: 0, stiff: true, after: (G) => plateTrims(G, L.rims, lames[3]) }); }
    for (const l of leg) {                                                                              // knees and greaves
      // the knee cop: a shaped plate over the front of the knee with a fan at its outside, on the knee's middle line, so
      // it sits on the bend whatever the knee does (see bendLimb)
      const sx = l === leg[0] ? RX : LX, cop = new THREE.Group(); l.mid.add(cop); cops.push(cop);
      const shell: Ring[] = []; for (let i = 0; i <= 8; i++) { const y = -0.3 + 0.6 * i / 8, k = Math.sqrt(Math.max(0.02, 1 - (y / 0.32) ** 2)); shell.push({ y, w: 0.25 * fr.leg * k, f: 0.29 * fr.leg * k, b: 0.15 * fr.leg * k }); }
      cop.add(sm(shellGeometry(shell, 0.26, -0.27, -1.75, 3.5, 1, 1, s, 20, 8), f.armor.color, true));
      const fan: Ring[] = shell.map((r) => ({ ...r, w: r.w * 1.06 }));
      cop.add(sm(shellGeometry(fan, 0.17, -0.17, sx * Math.PI / 2 - 0.65, 1.3, 1, 1, s, 10, 6), lighter, true));
      for (const y of [0.26, -0.27]) { const pts: THREE.Vector3[] = []; for (let j = 0; j <= 16; j++) { const [x, z] = ringPoint(ringAt(shell, y), -1.75 + 3.5 * j / 16, 1.02); pts.push(new THREE.Vector3(x * s, y * s, z * s)); } cop.add(tube(pts, 0.016 * s, t)); }
      l.mid.add(sm(loftGeometry(clipRings(shinRings(fr), -1.05, -0.12), s, { seg: 14, k: 1.22, rows: 18 }), f.armor.color));
      for (const y of [-0.18, -1.0]) { const r = ringAt(shinRings(fr), y); l.mid.add(sm(loftGeometry([{ ...r, y: y - 0.03 }, { ...r, y: y + 0.03 }], s, { seg: 14, k: 1.3, rows: 1 }), t)); }
    }
  }
  if (f.armor?.kind === 'mail') {
    // the shirt: close on the body to the hips, hanging from there over the tops of the thighs (kit/cloth.ts lifts it over
    // a thigh), with bright rows of rings laid round it
    const ringC = tone(f.armor.color, '#ffffff', 0.15);
    wear('mail', bodyCut(tr, pelvisRings(fr), s, f.armor.trim ?? f.armor.color, { top: MAIL_TOP, hem: MAIL_HEM, rows: MAIL_ROWS, ease: [1.08, 1.1], flare: 0.12, flareFrom: 0, warp: bustWarp, seat: seatBump }), up, DRAPE_COLS, MAIL_ROWS + 1, { closed: true, covers: ['torso', 'pelvis', ...LEGS, 'hem'], outside: [...ARMS, ...HANDS], layer: 1, clear: 0.03 * s, spread: 4, hang: 0.6, after: (G) => {
      for (const y of [1.15, 0.8, 0.45, 0.1, MAIL_HEM + 0.03]) { const pts: THREE.Vector3[] = []; for (let j = 0; j < 40; j++) pts.push(clothPoint(G, j / 40, (MAIL_TOP - y) / (MAIL_TOP - MAIL_HEM), 0.012 * s)); up.add(tube(pts, 0.018 * s, ringC, true)); }
    } });
    const band = (rings: Parameters<typeof loftGeometry>[0], y: number, h: number, k: number, c: string, seg = 16) => { const r = ringAt(rings, y); return sm(loftGeometry([{ ...r, y: y - h / 2 }, { ...r, y: y + h / 2 }], s, { seg, k, rows: 1 }), c); };
    arm.forEach((l, k) => { // short mail sleeves to halfway down the upper arm, over the deltoid, with a loose hem
      const mc = f.armor!.trim ?? f.armor!.color, sx = k === 0 ? RX : LX;
      l.root.add(sm(loftGeometry(clipRings(upperArmRings(fr, sx), -0.55, 0.0), s, { seg: 20, k: 1.14 }), mc));
      l.root.add(band(upperArmRings(fr, sx), -0.53, 0.05, 1.2, tone(f.armor!.color, '#ffffff', 0.15), 20));
    });
  }

  // cloak (with a hood folded on the shoulders): it hangs in folds
  if (f.cloak) {
    // the cloak hangs behind from the shoulders, under a capelet; on a gown, from the back below the bare shoulders. Hung
    // on the posed body (kit/cloth.ts): it drapes over an arm swung back or raised, a knee lifted under it, the seat, and
    // on a body laid out it falls to the floor and lies there
    const jag = f.tattered ? 0.45 * s : 0.05 * s, under = ['torso', 'pelvis', ...LEGS, ...FEET, ...ARMS, ...HANDS, 'stowed'];
    const edges = (G: Garment) => {
      if (!f.cloakTrim || gown) return;
      const hemLine: THREE.Vector3[] = []; for (let i = 0; i <= 40; i++) hemLine.push(clothPoint(G, i / 40, 1, 0.012 * s));
      up.add(tube(hemLine, 0.03 * s, f.cloakTrim));
      for (const u of [0, 1]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 16; i++) pts.push(clothPoint(G, u, 0.03 + 0.95 * i / 16, 0.012 * s)); up.add(tube(pts, 0.035 * s, f.cloakTrim)); }
    };
    if (gown) { const c = drape(1.0 * s, 1.35 * s, 3.9 * s, f.cloak, { folds: 7, amp: 0.12, jag, seed: 0.3, gap: Math.PI * 1.25, rows: 24 }); c.scale.z = 0.5; c.position.set(0, -0.55 * s, -0.2 * s);
      wear('cloak', c, up, DRAPE_COLS, 25, { closed: false, axis: [0, -0.2 * s], covers: [...under, 'gown'], outside: ['shield'], layer: 2, anchored: 0.15 * s, clear: 0.05 * s, spread: 6, hang: 0.9, after: edges }); }
    else {
      const rt = ringAt(tr, 2.0), rTop = rt.w * 1.05 + 0.06, dz = -0.05, top = 2.02, hem = -2.45;
      const c = drape(rTop * s, rTop * 1.6 * s, (top - hem) * s, f.cloak, { folds: 6, amp: 0.12, jag, seed: 0.3, gap: Math.PI * 1.15, rows: 26, zs: [(rt.b + 0.06 + dz) / rTop, 0.55] });
      c.position.set(0, (top + hem) / 2 * s, dz * s);
      wear('cloak', c, up, DRAPE_COLS, 27, { closed: false, axis: [0, dz * s], covers: [...under, 'hem', 'mail', 'tails', 'skirt'], outside: ['shield'], layer: 2, anchored: 0.15 * s, clear: 0.05 * s, spread: 6, hang: 0.9, after: edges });
      // the capelet over it: clasped at the top of its opening, a folded hood resting on it behind
      wear('mantle', capelet(tr, fr, s, f.cloak), up, DRAPE_COLS, CAPE_ROWS + 1, { closed: false, covers: ['torso', 'upperArmR', 'upperArmL', 'cloak', 'mail', 'stowed'], outside: [...LOWER_ARMS, 'shield'], holds: ['upperArmR', 'upperArmL'], layer: 3, anchored: 0, clear: 0.04 * s, spread: 6, hang: 0.5, after: (G) => {
        if (f.clasps) for (const u of [0, 1]) {
          const p = clothPoint(G, u, 0.14, 0.03 * s), n = clothPoint(G, u, 0.14, 0.06 * s).sub(p).normalize();
          const d = cyl(0.11 * s, 0.11 * s, 0.05 * s, f.clasps, 12); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); up.add(at(d, p.x, p.y, p.z));
          const k = cap(0.015 * s, 0.12 * s, tone(f.clasps, '#000000', 0.4)); k.quaternion.copy(d.quaternion); const q = p.clone().addScaledVector(n, 0.03 * s); up.add(at(k, q.x, q.y, q.z));
        }
        if (f.hood) { const p = clothPoint(G, 0.5, 0.2, 0.12 * s), h = sph(0.5 * s, f.cloak!, 16, 10); h.scale.set(1, 0.5, 0.75); up.add(at(h, p.x, p.y + 0.05 * s, p.z)); }
      } });
    }
  }

  // what the right hand holds
  if (wpn === 'axe') {
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
  if (wpn === 'mace') {
    gR.add(at(box(0.13 * s, 2.0 * s, 0.13 * s, '#3b2a20'), 0, 0.6 * s, 0));
    gR.add(at(sph(0.08 * s, '#8e939b', 8, 6), 0, -0.42 * s, 0));
    gR.add(at(sph(0.26 * s, '#8e939b', 12, 8), 0, 1.75 * s, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, fl = box(0.06 * s, 0.5 * s, 0.22 * s, '#a3a8b0'); fl.rotation.y = -a; gR.add(at(fl, Math.cos(a) * 0.24 * s, 1.75 * s, Math.sin(a) * 0.24 * s)); }
  }

  // out of a fight a weapon is put away, never carried drawn: a long one slung across the back, a short one at the belt
  // (a short one hangs from the belt once the body is posed: see below)
  let atBelt: THREE.Group | undefined;
  if (!battle && !dead && f.stow !== false && wpn && wpn !== 'none' && wpn !== 'staff' && wpn !== 'torch') {
    const long = wpn === 'axe' || wpn === 'spear' || wpn === 'sword', st = new THREE.Group(); st.name = 'stowed';
    for (const c of [...gR.children]) st.add(c);
    if (long) { st.rotation.set(-0.13, Math.PI, RX * 0.42); st.position.set(RX * -0.55 * s, -(wpn === 'sword' ? 1.0 : 1.5) * s, -0.3 * s); joints0.back.add(st); } // (the butt end out past the seat and what hangs over it)
    else { st.rotation.set(Math.PI, 0, 0); joints0.beltR.add(st); atBelt = st; }
  }

  // what the left hand holds
  const o = f.gear?.handL ? undefined : f.offhand;
  if (o?.kind === 'shield') {
    // strapped to the forearm: the arm through a strap by the elbow and the fist round a handle, the backs of the forearm
    // and the hand toward the shield. The mount is set in the wrist's frame (its centre out along the forearm, the back
    // standing off the forearm and the fist); the face (rim, boss, emblem) is a group of its own, so it can turn in its
    // own plane to stand the emblem upright.
    const u = (Lf.hs ?? 1) * s, yc = 0.45 * s, zc = (0.175 * fr.arm + 0.16) * s, leather = '#4e3524';
    const sg = new THREE.Group(); gL.add(sg); gL.updateMatrix();
    new THREE.Matrix4().copy(gL.matrix).invert().multiply(new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, yc, -zc)).decompose(sg.position, sg.quaternion, new THREE.Vector3());
    const fg = new THREE.Group(); fg.name = 'shieldFace'; sg.add(fg);
    const face = sm(new THREE.CylinderGeometry(1.0 * s, 1.0 * s, 0.14 * s, 32), o.color ?? '#2a3f7a'); face.rotation.x = Math.PI / 2; fg.add(face);
    const rim = sm(new THREE.TorusGeometry(1.0 * s, 0.07 * s, 8, 40), o.rim ?? '#a9adb6'); fg.add(rim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fg.add(at(sph(0.04 * s, o.rim ?? '#a9adb6', 6, 4), Math.cos(a) * 0.9 * s, Math.sin(a) * 0.9 * s, 0.08 * s)); }
    if (o.mark) {
      for (const dx of [-0.15, 0.15]) fg.add(at(sm(new THREE.TorusGeometry(0.22 * s, 0.03 * s, 6, 24), o.mark), dx * s, 0.1 * s, 0.085 * s));
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + side * (0.35 + i * 0.2), r = 0.6 * s, leaf = sph(0.055 * s, o.mark, 6, 4);
        leaf.scale.set(0.45, 1, 0.25); leaf.rotation.z = a + Math.PI / 2 + side * 0.5; fg.add(at(leaf, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.7 - 0.05 * s, 0.08 * s));
      }
    } else fg.add(at(sph(0.14 * s, o.rim ?? '#a9adb6', 12, 8), 0, 0, 0.08 * s));
    // behind it (the wrist's frame turned round: x and z reversed): the handle on two posts, where the fist closes (see
    // holdFast), wrapped thick in leather where the fingers go round it so they close on it, not on air; and the strap
    // round the forearm by the elbow
    const hy = -0.15 * u - yc, hz = -(0.085 * u + zc), back = -0.07 * s;
    const bar = cyl(0.032 * s, 0.032 * s, 0.44 * u, leather, 8); bar.rotation.z = Math.PI / 2; sg.add(at(bar, 0, hy, hz));
    const wrap = cyl(0.06 * u, 0.06 * u, 0.26 * u, tone(leather, '#000000', 0.15), 10); wrap.rotation.z = Math.PI / 2; sg.add(at(wrap, 0, hy, hz));
    for (const x of [-0.2, 0.2]) sg.add(at(box(0.05 * s, 0.05 * s, back - hz, leather), x * u, hy, (hz + back) / 2));
    // (the strap stands just off the forearm, sleeve and armour and all, on a post from the shield's back)
    const sy = 0.72 * s - yc, tr = 0.028 * s, toSg = (body.updateMatrixWorld(true), sg.matrixWorld.clone().invert()), v = new THREE.Vector3();
    let rf = 0.15 * fr.arm * s;
    const walk = (o: THREE.Object3D) => { for (const c of o.children) { if (c === Lf.end) continue; const m = c as M; if (m.isMesh) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(toSg); if (Math.abs(v.y - sy) < 0.05 * s) rf = Math.max(rf, Math.hypot(v.x, v.z + zc)); } } walk(c); } };
    walk(Lf.mid);
    const ra = rf + tr + 0.008 * s, strap = sm(new THREE.TorusGeometry(ra, tr, 6, 24), leather); strap.rotation.x = Math.PI / 2; sg.add(at(strap, 0, sy, -zc));
    sg.add(at(box(0.12 * s, 0.1 * s, back + zc - ra, leather), 0, sy, (back - zc + ra) / 2));
  }
  const bookIs = poseOf(f, battle, dead, gown).book, shutBook = o?.kind === 'book' && (battle ? bookIs === 'shut' : bookIs !== 'open');
  if (shutBook) {
    // out of a fight the book is carried shut, held by its foot with the cover to the front
    const bk = new THREE.Group(); bk.position.set(0, 0.3 * s, 0.13 * s); bk.rotation.x = -0.08; gL.add(bk);
    bk.add(box(0.46 * s, 0.62 * s, 0.05 * s, o.color ?? '#4a3020')); bk.add(at(box(0.46 * s, 0.62 * s, 0.05 * s, o.color ?? '#4a3020'), 0, 0, -0.15 * s));
    bk.add(at(box(0.42 * s, 0.57 * s, 0.11 * s, o.rim ?? '#e8dfc8'), -LX * 0.015 * s, 0, -0.075 * s)); bk.add(at(cyl(0.085 * s, 0.085 * s, 0.62 * s, o.color ?? '#4a3020', 10), LX * 0.22 * s, 0, -0.075 * s)); // the spine to the outside
    for (const y of [-0.2, 0.2]) bk.add(at(box(0.04 * s, 0.03 * s, 0.2 * s, o.rim ?? '#e8dfc8'), LX * 0.27 * s, y * s, -0.075 * s));
  } else if (o?.kind === 'book') {
    // held open on the palm: the spine along the hand and the book out over the little finger's side, the fingers flat
    // under its cover and the thumb over the edge on the page (set in the wrist's frame, then handed to the holder)
    const bk = new THREE.Group(), W = Lf.end, u = (Lf.hs ?? 1) * s, sides: M[][] = [[], []];
    for (const sx of [-1, 1]) { const cover = box(0.42 * s, 0.05 * s, 0.6 * s, o.color ?? '#4a3020'); cover.rotation.z = sx * 0.18; bk.add(at(cover, sx * 0.21 * s, 0, 0)); const pg = box(0.38 * s, 0.07 * s, 0.55 * s, o.rim ?? '#e8dfc8'); pg.rotation.z = sx * 0.18; bk.add(at(pg, sx * 0.2 * s, 0.05 * s, 0)); sides[sx === LX ? 0 : 1].push(cover, pg); }
    bk.add(at(box(0.02 * s, 0.02 * s, 0.4 * s, '#6a5a4a'), -LX * 0.2 * s, 0.1 * s, 0));
    // the pages face the palm's way, the head out past the fingertips, the thumb's half laid flat on the hand
    W.add(bk); bk.rotation.set(Math.PI / 2, 0, -LX * 0.18); bk.position.set(0, (-0.03 * s - 0.1 * u) - 0.12 * u, 0);
    const inW = (m: M) => { bk.updateMatrix(); m.updateMatrix(); m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.clone().applyMatrix4(bk.matrix.clone().multiply(m.matrix)); };
    const ms = handMeshes(W); shapeHand(ms, -LX, u, s, STRAIGHT);
    let rest = 0.005 * s + 0.044 * u; // the palm's face, or the fingers' if they stand higher
    for (const m of ms.slice(1, 9)) { m.updateMatrix(); m.geometry.computeBoundingBox(); rest = Math.max(rest, m.geometry.boundingBox!.clone().applyMatrix4(m.matrix).max.z); }
    const cv = inW(sides[0][0]), edgeX = LX * 0.1 * u;
    bk.position.z += rest + 0.004 * s - cv.min.z; bk.position.x += edgeX - (LX > 0 ? cv.max.x : cv.min.x);
    const tr2 = 0.029 * u, top = inW(sides[0][1]).max.z;
    const y0 = -0.03 * s - 0.1 * u;
    thumbTo(ms[9], new THREE.Vector3(edgeX + LX * 0.012 * s, y0 - 0.02 * u, top + 0.004 * s + tr2), new THREE.Vector3(edgeX - LX * 0.16 * u, y0 - 0.13 * u, top + 0.004 * s + tr2));
    body.updateMatrixWorld(true); gL.attach(bk);
  }
  if (o?.kind === 'orb') gL.add(at(sph(0.3 * s, o.color ?? '#9b7bd0'), 0, 0.05 * s, 0.34 * s)); // held out on the palm, as a spell's glow is
  if (f.wisp && !dead) {
    // a ghostly skull rising from the book (from the top of it when it is carried shut)
    const wg = new THREE.Group(), ob = !shutBook && o?.kind === 'book' ? gL.children.find((c) => (c as THREE.Group).isGroup) : undefined; gL.add(wg);
    if (ob) { wg.quaternion.copy(ob.quaternion); wg.position.copy(ob.position).addScaledVector(Y_AXIS.clone().applyQuaternion(ob.quaternion), 0.8 * s); } // over the open pages
    else if (shutBook) wg.position.set(0, 1.0 * s, 0.1 * s); else wg.position.set(-LX * 0.27 * s, 1.75 * s, 0.35 * s);
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
      const g = new THREE.Group(); g.position.set(sx * 0.18 * s, p.y * s, -0.42 * s); g.rotation.y = sx * 0.45; g.rotation.z = -sx * p.tilt; g.userData.wing = sx;
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
    if (f.crown.flower) {                     // five-petal flowers, gathered on the figure's left, with leaves
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

  // gear on the mounts: held weapons by the grip, blades sheathed at the belt, bows and great weapons slung on the back
  const belted: Partial<Record<'beltR' | 'beltL', THREE.Object3D>> = {}, hangs: THREE.Object3D[] = [];
  let slung: THREE.Group | undefined;
  if (f.gear) {
    const G = f.gear, mount = (name: string) => body.getObjectByName(name);
    for (const [slot, g] of [['handR', gR], ['handL', gL]] as const) { const w = G[slot]; if (!w) continue; const m = gearWeapon(w); m.scale.setScalar(s); g.add(m); }
    // (a belted blade's grip is where a hand laid on the hilt goes)
    const BLADE: Record<string, [number, number]> = { longsword: [2.9, 0.43], shortsword: [1.9, 0.34], rapier: [3.2, 0.36], dagger: [0.95, 0.27], scimitar: [2.5, 0.42], greatsword: [4.1, 0.76], 'sword-cane': [2.7, 0.36], sunsword: [3.0, 0.43], 'dragon-greatsword': [4.2, 0.76] };
    for (const slot of ['beltR', 'beltL'] as const) {
      const w = G[slot], mt = mount(slot); if (!w || !mt) continue;
      // (put away, for the cloth that hangs over it: the hang is flagged `stowed`, unscaled, so the drape reads its pieces
      // at their true size; what hangs on it sits in a group scaled to the figure)
      const sx = slot === 'beltR' ? RX : LX, hang = new THREE.Group(), on = new THREE.Group(); hang.userData.stowed = true; on.scale.setScalar(s); hang.add(on);
      hang.position.set(sx * 0.18 * s, 0.05 * s, 0); hang.rotation.set(0.5, 0, sx * 0.12); mt.add(hang); hangs.push(hang);
      const m = gearWeapon(w), bl = BLADE[w.kind];
      if (bl) { const L = bl[0] * (w.length ?? 1); if (w.kind !== 'sword-cane') on.add(scabbard(L + 0.08, tone(w.grip ?? '#2a2420', '#000000', 0.2), w.fittings)); m.rotation.x = Math.PI; m.position.y = bl[1]; on.add(m); belted[slot] = m; }
      else { m.rotation.x = Math.PI; m.position.y = 0.2; hang.rotation.x = 0.15; on.add(m); const loop = sm(new THREE.TorusGeometry(0.09, 0.02, 5, 10), '#2a2420'); loop.rotation.x = Math.PI / 2; on.add(loop); }
    }
    const bk = G.back, bm = mount('back');
    if (bk && bm) {
      // (slung, not stowed: cloth hung over a bow's arc or a crossbow's prod balloons out, so it lies over the cloth instead,
      // once that is hung: see overCloth below)
      const m = gearWeapon(bk), sl = new THREE.Group(); slung = new THREE.Group(); slung.position.set(0, 0, -0.12 * s); bm.add(slung); sl.scale.setScalar(s); slung.add(sl);
      if (bk.kind === 'crossbow') { m.rotation.set(-Math.PI / 2, 0, 0.35); m.position.set(0, -0.6, -0.12); } // the prod up behind the shoulders, the stock down the back, clear of the legs
      else if (bk.kind === 'longbow' || bk.kind === 'shortbow') { m.rotation.set(0, Math.PI, 0.45); m.position.set(0.1, 0.1, -0.05); }
      else { m.rotation.set(Math.PI, 0, 0.55); m.position.set(-0.5, 1.4, -0.05); }
      sl.add(m);
    }
  }

  // the pose: out of initiative its rest pose (on a gown, weight on the right leg, the left knee forward in the slit); in
  // initiative its battle pose; every joint from the recipe's angles or a named preset
  const P = poseOf(f, battle, dead, gown);
  if (P.seated) for (const h of hangs) h.rotation.x = 1.3; // in the saddle a sheath swings back along the horse, clear of the thigh
  const mir = (e: Euler3 | undefined, sx: number, d: Euler3): Euler3 => e ? [e[0], e[1] * sx, e[2] * sx] : [d[0], d[1] * sx, d[2] * sx];
  if (P.spine) up.rotation.set(...trunk(P.spine));
  if (P.pelvis) pel.rotation.set(...trunk(P.pelvis));
  if (P.neck) neck.rotation.set(...trunk(P.neck));
  for (const [i, g] of lames.entries()) g.quaternion.identity().slerp(up.quaternion, FAULD_GIVE[i]);
  // the elbow never bends past what the arm's bulk allows; a forearm's turn is made before the wrist's bend
  const elbowCap = elbowLimit(fr), mounted = o?.kind === 'shield' || (o?.kind === 'book' && !shutBook);
  // (a hand the pose would rest on the hip or the belt but that holds something hangs at the side instead, carrying it)
  const carries = (sd: 'R' | 'L') => (sd === 'R' ? gR : gL).children.length > 0 && [...(P.hipHand ?? []), ...(P.beltHand ?? [])].includes(sd);
  arm.forEach((l, k) => {
    const sx = k === 0 ? RX : LX, sd = k === 0 ? 'R' : 'L', carry = carries(sd);
    l.root.rotation.set(...mir(carry ? undefined : P[`shoulder${sd}`], sx, [-0.08, 0, 0.1]));
    l.mid.rotation.x = clampTo((carry ? undefined : P[`elbow${sd}`]) ?? -0.22, -elbowCap, 0.05);
    if (l.collar) l.collar.rotation.z = sx * (P[`collar${sd}`] ?? Math.min(0.4, Math.max(0, (-l.root.rotation.x - 0.9) * 0.28)));
    l.end.rotation.set(...mir(carry ? undefined : P[`wrist${sd}`], sx, [0.06, 0, 0]));
    const tw = carry ? undefined : P[`twist${sd}`]; if (tw !== undefined) l.end.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, tw * sx));
    // (a shield strapped to the forearm and a book open on the palm sit on the hand, so the hand's own turn sets theirs)
    const hold = sd === 'L' && mounted ? undefined : P[`hold${sd}`], g = k === 0 ? gR : gL;
    const q = g.quaternion.clone();
    if (hold?.upright) g.rotation.x = -(l.root.rotation.x + l.mid.rotation.x + l.end.rotation.x);
    if (hold?.tilt) { g.rotation.x += hold.tilt[0]; g.rotation.y += hold.tilt[1] * sx; g.rotation.z += hold.tilt[2] * sx; }
    // a book carried shut is gripped by its foot, so the wrist makes the turn and the book stays in the fist
    if (hold && sd === 'L' && shutBook) { l.end.quaternion.multiply(g.quaternion.clone().multiply(q.clone().invert())); g.quaternion.copy(q); }
  });
  // an empty hand at ease hangs with its palm to the thigh and the thumb forward, the fingers curling in toward the leg;
  // a shield on the forearm hangs at the side the same way round, its face out
  if (!P.lie && !battle) arm.forEach((l, k) => {
    const sd = k === 0 ? 'R' : 'L', g = k === 0 ? gR : gL, shield = sd === 'L' && o?.kind === 'shield';
    if (!P[`wrist${sd}`]?.[1] && P[`twist${sd}`] === undefined && (!g.children.length || shield)) l.end.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -(k === 0 ? RX : LX) * (shield ? 1.5 : 1.3)));
  });
  // the shield's hand holds the handle with the wrist straight: only the forearm's turn moves it
  if (o?.kind === 'shield') { const w = wristTurnOf(Lf.end.quaternion, LX); Lf.end.quaternion.copy(wristQ({ twist: twistIn(w.twist), dev: 0, bend: 0 }, LX)); }
  // a hold's aim: what the hand holds pointed along a direction in the chest's frame, its face to the front
  body.updateMatrixWorld(true);
  arm.forEach((l, k) => {
    const sx = k === 0 ? RX : LX, sd = k === 0 ? 'R' : 'L', g = k === 0 ? gR : gL, aim = sd === 'L' && mounted ? undefined : P[`hold${sd}`]?.aim;
    if (!aim || !g.children.length) return;
    // (a staff planted at ease stands up in the world, leaning a little forward and in, its foot out beside the foot,
    // whatever the chest is doing)
    const yW = (P[`hold${sd}`] === STAFF_AT_EASE.holdR ? new THREE.Vector3(-sx * 0.08, 1, 0.08).transformDirection(body.matrixWorld) : new THREE.Vector3(aim[0] * sx, aim[1], aim[2]).transformDirection(up.matrixWorld)).normalize(), zW = new THREE.Vector3(0, 0, 1).transformDirection(up.matrixWorld);
    zW.addScaledVector(yW, -zW.dot(yW)); if (zW.lengthSq() < 1e-4) zW.set(0, 1, 0).addScaledVector(yW, -yW.y); zW.normalize();
    const qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(yW, zW), yW, zW));
    g.quaternion.copy(l.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qW));
  });
  // (arms brought onto gear below, the second hand on a haft or a hand on a belted hilt: no other solver moves them)
  const gearTwo = !!(!dead && P.twoHand && f.gear?.handR && gR.children.length && !f.gear.handL && !f.offhand && secondHandAt(f.gear.handR.kind) !== undefined);
  const onHilt = new Set((dead ? [] : P.hilt ?? []).filter((sd) => (sd === 'R' ? belted.beltR ?? belted.beltL : belted.beltL ?? belted.beltR) && !(sd === 'R' ? gR : gL).children.length));
  // a hand the pose clenches makes a closed fist; one with something in it (a shield's grip, a shut book's foot) closes round it
  for (const sd of new Set([...(P.fist ?? []).filter((x) => x === 'R' || x === 'L'), ...(!dead && (o?.kind === 'shield' || shutBook) ? ['L' as const] : [])])) { // (a dead hand lets go)
    const l = sd === 'R' ? R : Lf, held = (sd === 'R' ? gR : gL).children.length > 0, ms = l.end.children.filter((c) => (c as M).isMesh) as M[];
    if (ms.length >= 10) (held ? fistOf : clenchOf)(ms, -(sd === 'R' ? RX : LX), ((ms[0].geometry as THREE.SphereGeometry).parameters?.radius ?? 0.105) / 0.105);
  }
  // an empty hand the pose hooks into a talon
  for (const sd of P.talon ?? []) {
    const l = sd === 'R' ? R : Lf, ms = l.end.children.filter((c) => (c as M).isMesh) as M[];
    if (ms.length >= 10 && !(sd === 'R' ? gR : gL).children.length) talonOf(ms, -(sd === 'R' ? RX : LX), ((ms[0].geometry as THREE.SphereGeometry).parameters?.radius ?? 0.105) / 0.105);
  }
  // a hand with a weapon in it makes a fist round the haft (the same grip the NPC figures' gear takes)
  if (!dead && wpn && wpn !== 'none' && gR.children.length) holdFast(R.end, gR, -RX);
  // a hand casting in a fight is spread open, the spell pushed out from the palm
  if (battle && !dead && P.spell) for (const sd of P.spell === 'between' ? ['R', 'L'] as const : ['R'] as const) { const l = sd === 'R' ? R : Lf; if (!(sd === 'R' ? gR : gL).children.length) shapeHand(handMeshes(l.end), -(sd === 'R' ? RX : LX), (l.hs ?? 1) * s, s, SPREAD); }
  const standing = !P.lie && !P.seated && !P.lift;
  // at ease the leg that bears no weight (the more bent knee) rests on the ball of its foot, the heel a little raised
  const kneeGap = (P.kneeL ?? 0) - (P.kneeR ?? 0), freeLeg = standing && !battle && !gown && Math.abs(kneeGap) >= 0.15 ? (kneeGap > 0 ? 1 : 0) : -1;
  // a gown is a fitted sheath, so in a fight the legs stay inside it: the right leg straight under the cloth, the left
  // stepping forward through the slit but not out past its edge
  const gownStep = (sd: 'R' | 'L', e: Euler3 | undefined, kn: number): [Euler3 | undefined, number] => {
    if (!gown || !battle || dead || P.seated || P.lie) return [e, kn];
    const h = e ?? [0, 0, 0], c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return sd === 'L' ? [[c(h[0], -0.3, 0.04), c(h[1], -0.1, 0.1), c(h[2], -0.06, 0)], Math.min(kn, 0.4)] : [[c(h[0], -0.06, 0.06), c(h[1], -0.1, 0.1), c(h[2], -0.04, 0.04)], Math.min(kn, 0.08)];
  };
  const legSet = leg.map((l, k) => {
    const sx = k === 0 ? RX : LX, sd = k === 0 ? 'R' : 'L', [he, kn] = gownStep(sd, P[`hip${sd}`], P[`knee${sd}`] ?? 0), hip = mir(he, sx, [0, 0, gown ? 0 : 0.04]), an = P[`ankle${sd}`];
    l.root.rotation.set(...hip); l.mid.rotation.x = kn;
    return { l, sx, an, heel: 0 };
  });
  // feet: a standing figure's soles lie flat on the floor whatever the hips and spine are doing, each foot turned the way
  // its shin points but kept inside a natural turn-out (FEET_OUT); a lying, seated or lifted one takes its ankles from the pose
  const pq = new THREE.Quaternion(), fwd = new THREE.Vector3(), a0 = new THREE.Vector3(), a1 = new THREE.Vector3();
  const heading = (o: THREE.Object3D) => { o.getWorldQuaternion(pq); fwd.set(0, 0, 1).applyQuaternion(pq); return Math.atan2(fwd.x, fwd.z); };
  // how far the stance has one foot ahead of the other (0: side by side, 1: a fighting stance), and which leads; read once,
  // from the legs as the pose sets them (the body is the root while it is posed, so its frame is the world's)
  let lead: { t: number; front: number } | undefined;
  const setFeet = () => {
    body.updateMatrixWorld(true);
    if (!lead) { const dz = leg[1].end.getWorldPosition(a1).z - leg[0].end.getWorldPosition(a0).z, t = Math.min(1, Math.max(0, (Math.abs(dz) - 0.35 * s) / (0.55 * s))); lead = { t: t * t * (3 - 2 * t), front: dz > 0 ? 1 : 0 }; }
    const hips = heading(pel);
    legSet.forEach(({ l, sx, an, heel }, k) => {
      const a = an ?? [0, 0, 0];
      if (!standing || an) { l.end.rotation.set(-(l.root.rotation.x + l.mid.rotation.x) + a[0], a[1] * sx, -l.root.rotation.z + a[2] * sx); return; }
      // side by side the feet turn out from the way the hips face; in a stance from the figure's front, toward the foe
      const t = lead!.t, ref = hips * (1 - t), w = k === lead!.front ? FEET_OUT.front : FEET_OUT.back;
      const lo = FEET_OUT.ease[0] + (w[0] - FEET_OUT.ease[0]) * t, hi = FEET_OUT.ease[1] + (w[1] - FEET_OUT.ease[1]) * t;
      const out = Math.atan2(Math.sin(heading(l.mid) - ref), Math.cos(heading(l.mid) - ref)) * sx; // (outward for this foot)
      const yaw = ref + sx * Math.min(hi, Math.max(lo, out));
      l.mid.getWorldQuaternion(pq); l.end.quaternion.copy(pq.invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      if (heel) l.end.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), heel));
    });
    body.updateMatrixWorld(true);
  };
  const soleY = (k: number) => new THREE.Box3().setFromObject(soles[k]).min.y;
  // balance: standing at ease, the pit of the neck sits over the foot that takes the weight (the straighter leg), or
  // between the feet when both share it; the legs swing under the body as a pair until it does
  const balance = (lateral: boolean, fore: boolean) => {
    if (!standing || battle || gown || leg.length !== 2) return;
    const kR = P.kneeR ?? 0, kL = P.kneeL ?? 0, wR = Math.abs(kR - kL) < 0.15 ? 0.5 : kR < kL ? 0.85 : 0.15;
    const c = new THREE.Vector3(), a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), h = new THREE.Vector3();
    for (let it = 0; it < 4; it++) {
      body.updateMatrixWorld(true);
      body.worldToLocal(neck.getWorldPosition(c)); body.worldToLocal(leg[0].end.getWorldPosition(a0)); body.worldToLocal(leg[1].end.getWorldPosition(a1)); body.worldToLocal(leg[0].root.getWorldPosition(h));
      const L = Math.max(0.5 * s, h.y - Math.min(a0.y, a1.y)), tx = a0.x * wR + a1.x * (1 - wR), tz = a0.z * wR + a1.z * (1 - wR);
      const dz = lateral ? (c.x - tx) / L : 0, dx = fore ? -(c.z - tz) / L : 0;
      if (Math.abs(dz) < 0.004 && Math.abs(dx) < 0.004) break;
      for (const l of leg) { l.root.rotation.z += dz; l.root.rotation.x += dx; }
    }
  };
  // (balancing never takes a foot off the floor: a pose whose feet it would part, a lunge say, keeps its legs)
  const balanced = (lateral: boolean, fore: boolean, give: number) => {
    if (soles.length !== 2) { balance(lateral, fore); setFeet(); return; }
    const keep = leg.map((l) => l.root.rotation.clone()); setFeet(); const g0 = Math.abs(soleY(0) - soleY(1));
    balance(lateral, fore); setFeet();
    if (Math.abs(soleY(0) - soleY(1)) > g0 + give * s) { leg.forEach((l, k) => l.root.rotation.copy(keep[k])); setFeet(); }
  };
  balanced(true, true, 0.1); // (planting below takes up a small step between the feet)
  // (only on level feet: a foot the pose lifts, or a stance with one foot well ahead, keeps its sole flat)
  if (freeLeg >= 0 && soles.length === 2 && Math.abs(soleY(0) - soleY(1)) < 0.12 * s) { legSet[freeLeg].heel = 0.24; setFeet(); }
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
    if (g.gap > 0.012 * s && g.gap < 0.4 * s) for (let it = 0; it < 4 && g.gap > 0.012 * s; it++) {
      shift(g.hi, -g.gap); g = gapOf();
      if (g.gap > 0.012 * s) { shift(1 - g.hi, g.gap); g = gapOf(); }
    }
    balanced(true, false, 0.03);
  }
  // The arms' solvers below move an arm to reach something, keeping it out of the body (the guard), its elbow under its
  // limit and its wrist inside its range. An arm is read as balls: along the upper arm below the shoulder's own bulk,
  // along the forearm, and on the hand (a fist, or the fingers of a hand laid flat).
  let guarded: ((p: THREE.Vector3, r: number) => number) | undefined;
  const guard = () => guarded ??= bodyGuard({ body, up, pel, neck, head, hips: leg.map((l) => l.root), fr, tr, s, f, gown, bust: bustWarp });
  const foreRings = forearmRings(fr), ringSize = (r: Ring) => Math.max(r.w, r.f, r.b);
  const armBalls = (A: Limb, sx: number) => {
    const out: [THREE.Vector3, number][] = [], ur = upperArmRings(fr, sx), u = (A.hs ?? 1) * s, hm = handMeshes(A.end);
    for (const y of [-0.55, -0.75, -0.95]) out.push([A.root.localToWorld(new THREE.Vector3(0, y * s, 0)), 0.9 * ringSize(ringAt(ur, y)) * s]);
    for (const y of [-0.2, -0.4, -0.6, -0.8, -0.98]) out.push([A.mid.localToWorld(new THREE.Vector3(0, y * s, 0)), ringSize(ringAt(foreRings, y)) * s]);
    // the hand as it is shaped (open, flat or closed): the palm, then each joint of the fingers and the thumb
    if (hm.length >= 10) {
      for (const dy of [-0.06, 0, 0.06]) out.push([A.end.localToWorld(hm[0].position.clone().add(new THREE.Vector3(0, dy * u, 0))), 0.05 * u]);
      for (const m of hm.slice(1, 10)) { const c = (m.geometry as THREE.CapsuleGeometry).parameters; for (const e of [-0.5, 0, 0.5]) out.push([m.localToWorld(new THREE.Vector3(0, e * c.height, 0)), 1.15 * c.radius]); }
    }
    return out;
  };
  // the top of the upper arm, below the shoulder's ball, a little inside its skin (where it meets the chest at rest)
  const armTop = (A: Limb, sx: number): [THREE.Vector3, number][] => { const ur = upperArmRings(fr, sx); return [-0.3, -0.42].map((y) => [A.root.localToWorld(new THREE.Vector3(0, y * s, 0)), 0.75 * ringSize(ringAt(ur, y)) * s]); };
  const sink = (balls: [THREE.Vector3, number][]) => { let c = 0; for (const [p, r] of balls) { const d = guard()(p, r) / s; c += d * d; } return c; };
  // coordinate descent over the shoulder's three turns and the elbow (and whatever else the cost reads, each in its range)
  type Knob = [Record<string, number>, string, number, number];
  const solveArm = (A: Limb, cost: () => number, from = 0.4, more: Knob[] = []) => {
    let best = cost();
    const knobs: Knob[] = [[A.root.rotation as unknown as Record<string, number>, 'x', -3, 2], [A.root.rotation as unknown as Record<string, number>, 'y', -1.8, 1.8], [A.root.rotation as unknown as Record<string, number>, 'z', -2.2, 2.2], [A.mid.rotation as unknown as Record<string, number>, 'x', -elbowCap, 0], ...more];
    for (let st = from; st > 0.004; st *= 0.65) for (let pass = 0; pass < 3; pass++) for (const [o, key, lo, hi] of knobs) {
      let moved = false;
      for (const d of [st, -st]) { if (moved) break; const was = o[key]; o[key] = clampTo(was + d, lo, hi); const c = cost(); if (c < best - 1e-12) { best = c; moved = true; } else o[key] = was; }
    }
    cost(); return best;
  };
  const twoHanded = battle && !dead && !gL.children.length && gR.children.length > 0 && (wpn === 'axe' || wpn === 'spear' || wpn === 'staff') && (P.bothHands || (f.battlePose ?? f.stance) === 'two-handed');
  // gear in a hand (kit/weapons.ts): the fist closes round the haft inside the wrist's range, as holdFast does for the
  // figure's own weapon, and where the pose's aim would take the wrist past it the arm moves instead, as little as it takes,
  // keeping the weapon pointed and the fist where the pose put them and the arm off the body. (closeGrip first gives the
  // aim: the weapon as the pose points it, in a fist that does not mind the wrist; it takes the hand's handedness, the
  // opposite of SIDE_X.)
  const gearGrip = (A: Limb, g: THREE.Group, sx: number) => {
    closeGrip(A.end, g, -sx); body.updateMatrixWorld(true);
    const q0 = A.end.quaternion.clone(); if (q0.angleTo(wristQ(wristIn(wristTurnOf(q0, sx)), sx)) < 0.03) return;
    const Wq = g.getWorldQuaternion(new THREE.Quaternion()), Wp = g.getWorldPosition(new THREE.Vector3()), D = Y_AXIS.clone().applyQuaternion(Wq);
    const r0 = A.root.rotation.clone(), m0 = A.mid.rotation.x, mq = new THREE.Quaternion(), pw = new THREE.Vector3(), dw = new THREE.Vector3();
    const grip = () => { // (the weapon handed back to the hand as the pose aimed it, then gripped as far as the wrist allows)
      A.collar!.updateMatrixWorld(true);
      g.quaternion.copy(A.end.quaternion.clone().invert().multiply(A.mid.getWorldQuaternion(mq).invert().multiply(Wq)));
      holdFast(A.end, g, -sx); A.end.updateMatrixWorld(true);
    };
    solveArm(A, () => {
      grip();
      return 40 * (1 - dw.set(0, 1, 0).transformDirection(g.matrixWorld).dot(D)) + 10 * g.getWorldPosition(pw).distanceToSquared(Wp) / (s * s)
        + 0.3 * ((A.root.rotation.x - r0.x) ** 2 + (A.root.rotation.y - r0.y) ** 2 + (A.root.rotation.z - r0.z) ** 2 + (A.mid.rotation.x - m0) ** 2) + 100 * sink(armBalls(A, sx));
    }, 0.3);
    grip(); body.updateMatrixWorld(true);
  };
  if (!dead) [gR, gL].forEach((g, k) => { if (f.gear?.[k === 0 ? 'handR' : 'handL'] && g.children.length) gearGrip(arm[k], g, k === 0 ? RX : LX); });
  // an arm the pose sets in a fight that holds nothing pointed (a shield on the forearm, an open book on the palm, an empty
  // or casting hand) is moved out of the body if it sinks in (a full bust, a breastplate), as little as it takes
  if (battle && !dead && !P.lie && !P.seated) arm.forEach((A, k) => {
    const sd = k === 0 ? 'R' : 'L', sx = k === 0 ? RX : LX, g = k === 0 ? gR : gL, held = g.children.length > 0;
    if ((held && !(sd === 'L' && mounted)) || (sd === 'L' && (twoHanded || gearTwo)) || onHilt.has(sd)) return; // (the second hand on a haft, or a hand on a hilt, is solved below)
    const r0 = A.root.rotation.clone(), m0 = A.mid.rotation.x;
    A.collar!.updateMatrixWorld(true); if (sink(armBalls(A, sx)) < 1e-6) return;
    solveArm(A, () => { A.collar!.updateMatrixWorld(true); return 400 * sink(armBalls(A, sx)) + (A.root.rotation.x - r0.x) ** 2 + (A.root.rotation.y - r0.y) ** 2 + (A.root.rotation.z - r0.z) ** 2 + (A.mid.rotation.x - m0) ** 2; }, 0.15);
    body.updateMatrixWorld(true);
  });
  // a hand set on the body, the arm solved to reach it (outside anything worn there). On the hip, a fist: its knuckles
  // resting on the side of the waist above the belt, the forearm running in to it from an elbow out to the side and a
  // little back; an open hand there lies flat, the fingers forward and down. On the belt: the open hand flat on the front
  // of the belt toward its own side, the fingers hanging down and a little in, the thumb tucked behind the belt, the
  // elbow back at the side. Nothing sinks in: the knuckles or the palm stand just off the surface, the forearm clear.
  const onBody = new Map<'R' | 'L', 'hip' | 'belt'>();
  for (const sd of P.beltHand ?? []) if (sd === 'R' || sd === 'L') onBody.set(sd, 'belt');
  for (const sd of P.hipHand ?? []) if (sd === 'R' || sd === 'L') onBody.set(sd, 'hip');
  if (onBody.size && !P.lie && !P.seated) {
    // (the hand rests on what is worn there as it will hang: the cloth is hung here first for the hand to find, the arms
    // that reach for the body left out of it so it does not give way to where they start from, and hung again from its
    // cut once every arm is set, the hand then lying on it; its trims wait for that last hang)
    const cut = garments.map((g) => (g.mesh.geometry.getAttribute('position').array as Float32Array).slice());
    if (garments.length) {
      const w = drapeWorld(body, { pel, up, neck, arm, leg, gR, gL }, fr, s, P, dead);
      for (const sd of onBody.keys()) for (const n of ['upperArm', 'forearm', 'hand']) for (const m of [w.parts, w.surface, w.bones, w.volumes]) m?.delete(n + sd);
      hangGarments(garments.map((g) => ({ ...g, after: undefined })), w);
    }
    body.updateMatrixWorld(true);
    // (a weapon at the belt is not leant on: it is hung after, clear of the arm, below)
    const solid: M[] = [], rc = new THREE.Raycaster(), inArm = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === atBelt || arm.some((l) => p === l.collar || p === l.root)) return true; return false; };
    body.traverse((o) => { const m = o as M; if (m.isMesh && !inArm(m) && !(m.material as THREE.Material).transparent) solid.push(m); });
    for (const [sd, where] of onBody) {
      const k = sd === 'R' ? 0 : 1, A = arm[k], sx = k === 0 ? RX : LX, g = k === 0 ? gR : gL, u = (A.hs ?? 1) * s, belt = where === 'belt', ms = handMeshes(A.end);
      if (g.children.length || ms.length < 10) continue; // a hand that holds something keeps it
      const fist = !belt && ms[1].rotation.x < -1.2;
      const cast = (h: number, az: number, shift?: THREE.Vector3) => {
        const out = new THREE.Vector3(sx * Math.sin(az), 0, Math.cos(az));
        const from = up.localToWorld(out.clone().multiplyScalar(3 * s).setY(h * s)), inward = out.clone().negate().transformDirection(up.matrixWorld);
        if (shift) from.add(shift);
        rc.set(from, inward); const hit = rc.intersectObjects(solid, false)[0]; if (!hit) return undefined;
        const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : inward.clone().negate(); if (n.dot(inward) > 0) n.negate();
        return { p: hit.point, n: n.addScaledVector(inward, -0.5).normalize() }; // (leaning the normal outward, off a fold's slope)
      };
      if (!fist) shapeHand(ms, -sx, u, s, belt ? STRAIGHT : FLAT);
      // the contact: a fist's knuckles, or the palm's centre, in the hand's frame
      const C = fist ? new THREE.Vector3(0, -0.03 * s - 0.235 * u, 0.05 * u) : new THREE.Vector3(0, -0.03 * s - 0.1 * u, 0.005 * s), stand = fist ? 0.007 * s : 0.044 * u + 0.012 * s;
      // (a fist's wrist turns too, to lay the flat of its knuckles on the body rather than one corner of them; an open hand
      // may roll a little on the body, its fingers more or less in, to keep the wrist in its range)
      const fw = { bend: 0.12, dev: -0.12, roll: 0 }, RQ = new THREE.Quaternion(), ZA = new THREE.Vector3(0, 0, 1), face = [[-0.06, 0], [0.06, 0], [-0.06, 0.11], [0.06, 0.11]].map(([x, z]) => new THREE.Vector3(x * u, C.y, z * u));
      const mq = new THREE.Quaternion(), cw = new THREE.Vector3(), ew = new THREE.Vector3(), ctr = new THREE.Vector3();
      // (solved from the arm as the pose sets it, and from an arm already reaching there, for a pose that leaves it hanging)
      const starts: [THREE.Euler, number][] = [[A.root.rotation.clone(), A.mid.rotation.x], [new THREE.Euler(...mir(belt ? [-0.1, -0.3, 0.15] : [1.3, -0.61, 1.16], sx, [0, 0, 0])), belt ? -1.5 : -1.82]];
      let best = Infinity, pick: { rot: THREE.Euler; el: number; q: THREE.Quaternion } | undefined;
      // (on the belt, toward the front of the hip or, round a broad waist, nearer its side, and round a plate fauld, whose lames
      // flare out at the front, lower on its side; on the hip, at the waist or lower)
      for (const [h, az, pref] of belt ? [[0.4, 0.8, 0], [0.4, 1.05, 0.002], ...(f.armor?.kind === 'plate' ? [[0.3, 1.3, 0.02]] : [])] : [[0.5, Math.PI / 2, 0], [0.43, Math.PI / 2, 0.002]]) {
        const hit = cast(h, az); if (!hit) continue;
        // an open hand's turn, in the world: the palm against the body, the fingers down (and in, on the belt; forward, on
        // the hip); where the body swells out below the hand (a hem's flare, a fauld's lower lames, the hips) the hand
        // tips out to lie along it, from the palm on the contact to the fingertips on the swell
        let turnW: THREE.Quaternion | undefined;
        if (!fist) {
          const lean = belt ? new THREE.Vector3(-sx, 0, 0).multiplyScalar(0.45) : new THREE.Vector3(0, 0, 1).multiplyScalar(0.9);
          const fing = new THREE.Vector3(0, -1, 0).add(lean).transformDirection(up.matrixWorld); fing.addScaledVector(hit.n, -fing.dot(hit.n)).normalize();
          const low = cast(h, az, fing.clone().multiplyScalar(0.3 * u)), chord = low ? low.p.clone().sub(hit.p).normalize() : fing;
          if (chord.dot(hit.n) > 0) { hit.n.addScaledVector(chord, -chord.dot(hit.n)).normalize(); fing.copy(chord); }
          const Z = hit.n.clone().negate(), Y = fing.clone().negate(); turnW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(Y, Z), Y, Z));
        }
        const T = hit.p.clone().addScaledVector(hit.n, stand), E = up.localToWorld(up.worldToLocal(T.clone()).add(belt ? new THREE.Vector3(sx * 0.45 * s, 0.95 * s, -0.6 * s) : new THREE.Vector3(sx * 0.95 * s, 0.88 * s, -0.38 * s)));
        let over = 0;
        const cost = () => {
          A.collar!.updateMatrixWorld(true);
          if (turnW) { A.mid.getWorldQuaternion(mq); A.end.quaternion.copy(mq.invert().multiply(turnW).multiply(RQ.setFromAxisAngle(ZA, fw.roll))); over = limitWrist(A.end, sx); } else A.end.quaternion.copy(wristQ({ twist: -1.54, dev: fw.dev, bend: fw.bend }, sx));
          A.end.updateMatrixWorld(true);
          // (the arm kept out of the body firmly, the hand, whose balls round it out a little, less so)
          const balls = armBalls(A, sx);
          let c = A.mid.getWorldPosition(ew).distanceToSquared(E) / (s * s) + 120 * sink(balls.slice(0, 8)) + 60 * sink(balls.slice(8)) + 0.5 * over * over;
          if (fist) { ctr.set(0, 0, 0); for (const q of face) { const w = A.end.localToWorld(cw.copy(q)); ctr.add(w); c += 10 * (w.sub(hit.p).dot(hit.n) - stand) ** 2 / (s * s); } c += 10 * ctr.multiplyScalar(0.25).distanceToSquared(T) / (s * s); }
          else c += 20 * A.end.localToWorld(cw.copy(C)).distanceToSquared(T) / (s * s) + 0.2 * fw.roll * fw.roll;
          return c;
        };
        for (const [r0, e0] of starts) {
          A.root.rotation.copy(r0); A.mid.rotation.x = clampTo(e0, -elbowCap, 0); fw.bend = 0.12; fw.dev = -0.12; fw.roll = 0;
          const c = solveArm(A, cost, 0.4, fist ? [[fw, 'bend', -0.6, 0.6], [fw, 'dev', -0.5, 0.3]] : [[fw, 'roll', -0.7, 0.7]]) + pref;
          if (c < best) { best = c; pick = { rot: A.root.rotation.clone(), el: A.mid.rotation.x, q: A.end.quaternion.clone() }; }
          if (best < 0.004) break;
        }
        if (best < 0.004) break;
      }
      if (pick) { A.root.rotation.copy(pick.rot); A.mid.rotation.x = pick.el; A.end.quaternion.copy(pick.q); }
      // on the belt the thumb hooks over it, down along the fingers, its tip against the belt (not into the body)
      if (belt) {
        body.updateMatrixWorld(true);
        const base = new THREE.Vector3(sx * 0.09 * u, -0.03 * s - 0.08 * u, 0.04 * u), tip = new THREE.Vector3(sx * 0.06 * u, -0.03 * s - 0.3 * u, 0.04 * u + 0.015 * s);
        const from = A.end.localToWorld(tip.clone().setZ(-0.3 * s)), inW = new THREE.Vector3(0, 0, 1).transformDirection(A.end.matrixWorld);
        rc.set(from, inW); const hit = rc.intersectObjects(solid, false)[0];
        if (hit) { const z = A.end.worldToLocal(hit.point.clone()).z - 0.03 * u; if (z < tip.z) tip.z = z; }
        thumbTo(ms[9], base, tip);
      }
      body.updateMatrixWorld(true);
    }
    garments.forEach((g, i) => {
      const p = g.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      (p.array as Float32Array).set(cut[i]); p.needsUpdate = true; g.mesh.geometry.computeVertexNormals(); g.mesh.geometry.computeBoundingBox(); g.mesh.geometry.computeBoundingSphere();
    });
  }
  // a second hand on a long weapon: the free hand takes the haft above the weapon hand, toward the head, about a shoulder's
  // width up it, and closes round it with its thumb and index toward the head as on the weapon hand. The reach is solved
  // for the turned hand (so the haft lies in the curl of the fingers), inside the wrist's range, with the arm kept off the
  // body, the bust, the breastplate and the other arm. The same reach takes a hand onto gear (kit/weapons.ts): the second
  // hand on a weapon held in both, where its kind says (secondHandAt: the end of a sword's grip or an axe's haft, forward
  // along a spear), or a hand laid on the hilt of a blade at the belt. `want` is where along the haft (in the figure's
  // feet from the weapon hand, or the hilt), `lo` and `hi` how far either way it may go.
  const onHaft = (A: Limb, sx: number, held: THREE.Object3D, want: number, lo: number, hi: number) => {
    body.updateMatrixWorld(true);
    const u = (A.hs ?? 1) * s, o0 = held.getWorldPosition(new THREE.Vector3()), dir = Y_AXIS.clone().transformDirection(held.matrixWorld), grip = new THREE.Vector3();
    const B = A === R ? Lf : R, wB = [B.root, B.mid, B.end].map((j) => j.getWorldPosition(new THREE.Vector3())), rU = 0.2 * fr.arm * s, rF = 0.15 * fr.arm * s;
    const near = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => { const ab = b.clone().sub(a), t = clampTo(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
    const cost = () => {
      A.collar!.updateMatrixWorld(true);
      const off = closeOn(A.end, A.mid, held, -sx, false); A.end.updateMatrixWorld(true);
      const v = A.end.localToWorld(grip.set(0, -0.15 * u, 0.085 * u)).sub(o0), t = v.dot(dir) / s, perp = v.addScaledVector(dir, -t * s).length() / s;
      let c = 400 * perp * perp + 40 * (Math.max(0, lo - t) + Math.max(0, t - hi)) ** 2 + 0.6 * (t - want) ** 2 + 40 * off * off;
      // (and the top of the upper arm, by the armpit, which armBalls leaves to the shoulder's bulk: an arm brought across
      // to a haft can swing it into the side of the chest)
      const balls = armBalls(A, sx); c += 200 * sink(balls) + 200 * sink(armTop(A, sx));
      for (const [p, r] of balls) { const d = Math.max(0, r + rU - near(p, wB[0], wB[1]), r + rF - near(p, wB[1], wB[2])) / s; c += 200 * d * d; }
      const w = wristTurnOf(A.end.quaternion, sx); return c + 0.4 * (w.dev - GRIP.dev) ** 2;
    };
    closeOn(A.end, A.mid, held, -sx, true); // (closed first, so the reach is solved for the fist it ends as)
    solveArm(A, cost, 0.3);
    closeOn(A.end, A.mid, held, -sx, true);
    body.updateMatrixWorld(true);
  };
  if (twoHanded) onHaft(Lf, LX, gR, 1.8, 1.25, 2.05);
  // (on gear the second fist keeps clear of the first, which closes round the haft's first fifth of a foot either way; on
  // a long haft it slides to wherever along it keeps the arm off the body)
  if (gearTwo) {
    const k = f.gear!.handR!.kind, t = secondHandAt(k)!, [lo, hi] = secondHandSlide(k) ?? [t < 0 ? t - 0.25 : Math.max(0.22, t - 0.15), t < 0 ? Math.min(-0.22, t + 0.15) : t + 0.25];
    onHaft(Lf, LX, gR, t, lo, hi);
  }
  // (a hand on a belted hilt takes it as a hand hanging at the side closes on an upright handle, the thumb up toward the
  // pommel: the reach is solved on the blade turned end for end, and the hand may close anywhere from the scabbard's
  // mouth, the thumb on the guard, to just above the middle of the grip)
  for (const sd of onHilt) {
    const h = (sd === 'R' ? belted.beltR ?? belted.beltL : belted.beltL ?? belted.beltR)!, toPommel = new THREE.Object3D(); toPommel.rotation.z = Math.PI; h.add(toPommel);
    onHaft(sd === 'R' ? R : Lf, sd === 'R' ? RX : LX, toPommel, 0, -0.45, 0.1); h.remove(toPommel);
  }
  // every wrist ends inside its range; a shield's face turns in its own plane to stand its emblem upright
  arm.forEach((l, k) => limitWrist(l.end, k === 0 ? RX : LX));
  if (o?.kind === 'shield') {
    body.updateMatrixWorld(true);
    const fg = gL.getObjectByName('shieldFace');
    if (fg) {
      const n = new THREE.Vector3(0, 0, 1).transformDirection(fg.matrixWorld), yW = Y_AXIS.clone().transformDirection(fg.matrixWorld), upW = Y_AXIS.clone().addScaledVector(n, -n.y);
      if (upW.lengthSq() > 0.04) { upW.normalize(); fg.rotateZ(Math.atan2(new THREE.Vector3().crossVectors(yW, upW).dot(n), yW.dot(upW))); }
    }
  }
  // the elbows and knees bend as one limb
  for (const l of arm) bendLimb(l, 0.3 * fr.arm * s);
  for (const l of leg) bendLimb(l, 0.4 * fr.leg * s);
  for (const c of cops) c.rotation.x = -(c.parent as THREE.Object3D).rotation.x / 2;
  // a weapon put away at the belt hangs from it as it would of itself: from a loop on the belt at the side of the hip or
  // behind it, near plumb, the head down, swung out or back only as far as it takes to keep clear of the waist, the legs,
  // the arms and what is worn there, resting on it (what it hangs over, a tunic's skirt, a mail shirt, a gown, plate on
  // the hips, is hung here first for it to find, and hung again from its cut with the rest below; a cloak or a coat's
  // tails hang over it in turn)
  if (atBelt && !P.lie && !P.seated) {
    const st = atBelt, mount = st.parent!, mg = 0.02 * s, balls = ballsOf(st), loopY = Math.min(...balls.map(([c, r]) => c.y - r)) + 0.17 * s;
    body.updateMatrixWorld(true);
    const cell = 0.25 * s, grid = new Map<string, THREE.Vector3[]>(), keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    const inner = garments.filter((g) => g.name !== 'cloak' && g.name !== 'mantle' && g.name !== 'tails'), at0 = mount.getWorldPosition(new THREE.Vector3());
    // (and every point of the body and of what is on it near the hip, besides the guard's measure of it: the seat, a
    // pouch or a bag at the belt, plate on the hips, a gauntlet, a hand on the belt)
    const flesh = new Map<string, THREE.Vector3[]>(), skip = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === st || n === head) return true; return false; };
    body.traverse((o) => {
      const m = o as M; if (!m.isMesh || (m.material as THREE.Material).transparent || m.userData.garment || skip(m)) return;
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, v = [0, 1, 2].map(() => new THREE.Vector3());
      const put = (p: THREE.Vector3) => { if (p.distanceTo(at0) > 3.5 * s) return; const k = keyOf(p.x, p.y, p.z); let l = flesh.get(k); if (!l) flesh.set(k, (l = [])); l.push(p); };
      for (let i = 0; i < pos.count; i++) put(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      // (and across a large face, a buckle's or a strap's, points no further apart than the body's own)
      for (let t = 0; t + 2 < (idx ? idx.count : pos.count); t += 3) {
        for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos, idx ? idx.getX(t + j) : t + j).applyMatrix4(m.matrixWorld);
        const n = Math.ceil(Math.max(v[0].distanceTo(v[1]), v[1].distanceTo(v[2]), v[2].distanceTo(v[0])) / (0.05 * s)); if (n < 2 || v[0].distanceTo(at0) > 6 * s) continue;
        for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) if (i + j > 0 && i < n && j < n) put(v[0].clone().multiplyScalar(1 - (i + j) / n).addScaledVector(v[1], i / n).addScaledVector(v[2], j / n));
      }
    });
    if (inner.length) {
      // (all of it hung as it hangs below, a mail shirt over a tunic's skirt, with nothing at the belt yet)
      const cut = inner.map((g) => (g.mesh.geometry.getAttribute('position').array as Float32Array).slice());
      mount.remove(st); hangGarments(inner.map((g) => ({ ...g, after: undefined })), drapeWorld(body, { pel, up, neck, arm, leg, gR, gL }, fr, s, P, dead)); mount.add(st);
      body.updateMatrixWorld(true);
      inner.forEach((g, i) => {
        // (each triangle's corners, the middles of its sides and its middle: the cloth read finely enough that the haft
        // cannot pass between its points)
        const geo = g.mesh.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute, idx = geo.index, v = [0, 1, 2].map(() => new THREE.Vector3());
        const put = (p: THREE.Vector3) => { if (p.distanceTo(at0) > 3.5 * s) return; const k = keyOf(p.x, p.y, p.z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(p); };
        for (let t = 0; idx && t + 2 < idx.count; t += 3) {
          for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos, idx.getX(t + j)).applyMatrix4(g.mesh.matrixWorld);
          for (let j = 0; j < 3; j++) { put(v[j].clone()); put(v[j].clone().lerp(v[(j + 1) % 3], 0.5)); }
          put(v[0].clone().add(v[1]).add(v[2]).divideScalar(3));
        }
        (pos.array as Float32Array).set(cut[i]); pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
      });
    }
    const toHip = leg.map((l) => l.root.matrixWorld.clone().invert()), toKnee = leg.map((l) => l.mid.matrixWorld.clone().invert());
    const thR = thighRings(fr), shR = shinRings(fr), kTh = f.armor?.kind === 'plate' ? 1.1 : 1.04, kSh = 1.3; // (the thigh, in plate a little out; the shin in its boot, the cuff out most)
    const inStack = (rings: Ring[], q: THREE.Vector3, k: number) => {
      const lo = rings[0].y, hi = rings[rings.length - 1].y; if (q.y < lo || q.y > hi) return -Infinity;
      const r = ringAt(rings, q.y); return Math.min(sectionDepth(q.x - (r.x ?? 0), q.z - (r.z ?? 0), r.w * k, r.f * k, r.b * k, r.n ?? 2), q.y - lo, hi - q.y);
    };
    const bare = bodyGuard({ body, up, pel, neck, head, hips: leg.map((l) => l.root), fr, tr, s, f, gown, bust: bustWarp, bare: true }); // (the cloth as it hangs is read off it, above)
    // (the cloth's own trims, a hem band or a mail shirt's rows of rings, lie on it; and the surface of the body runs
    // between its points, as much as half the way across one of its cells further out)
    const arms = [...armBalls(arm[0], RX), ...armBalls(arm[1], LX)], q = new THREE.Vector3(), trimR = 0.03 * s, gap = 0.03 * s;
    const pen = (p: THREE.Vector3, r: number) => {
      const rr = r + mg; let d = bare(p, rr);
      for (let k = 0; k < leg.length; k++) {
        q.copy(p).applyMatrix4(toHip[k]).divideScalar(s); d = Math.max(d, (inStack(thR, q, kTh) + rr / s) * s);
        q.copy(p).applyMatrix4(toKnee[k]).divideScalar(s); d = Math.max(d, (inStack(shR, q, kSh) + rr / s) * s);
      }
      for (const [c, ra] of arms) d = Math.max(d, rr + ra - p.distanceTo(c));
      const n = Math.ceil((rr + Math.max(trimR, gap)) / cell);
      for (let x = -n; x <= n; x++) for (let y = -n; y <= n; y++) for (let z = -n; z <= n; z++) {
        const k = keyOf(p.x + x * cell, p.y + y * cell, p.z + z * cell);
        for (const c of grid.get(k) ?? []) d = Math.max(d, rr + trimR - p.distanceTo(c));
        for (const c of flesh.get(k) ?? []) d = Math.max(d, rr + gap - p.distanceTo(c));
      }
      return Math.max(0, d);
    };
    // the loop: on the belt `e` round from the side toward the back, the haft `c` off it; the hang: down, swung out by `a`
    // and back by `b`
    const br = ringAt(tr, 0.42), bn = br.n ?? 2, pw = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / bn), fwd = new THREE.Vector3(0, 0, 1).transformDirection(up.matrixWorld).setY(0).normalize();
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), O = new THREE.Vector3(), out = new THREE.Vector3(), w = new THREE.Vector3();
    const place = ([e, a, b, c]: number[]) => {
      const dz = e >= 0 ? br.b : br.f, x = RX * br.w * pw(Math.cos(e)), z = -dz * pw(Math.sin(e));
      out.set(x / (br.w * br.w), 0, z / (dz * dz)).normalize();
      O.set((br.x ?? 0) + x * 1.05, 0.42, (br.z ?? 0) + z * 1.05).multiplyScalar(s).addScaledVector(out, (0.09 + c) * s); up.localToWorld(O);
      out.transformDirection(up.matrixWorld).setY(0).normalize();
      Y.set(0, -1, 0).addScaledVector(out, Math.tan(a)).addScaledVector(fwd, -Math.tan(b)).normalize();
      Z.copy(out).addScaledVector(Y, -out.dot(Y)).normalize(); X.crossVectors(Y, Z);
      O.addScaledVector(Y, -loopY);
    };
    // (on plate the loop is on the fauld, on mail on the shirt, on a gown on its skirt, each standing out from the belt)
    const off0 = f.armor?.kind === 'plate' ? 0.15 : gown ? 0.3 : f.armor?.kind === 'mail' ? 0.12 : 0.06, range = [[-0.2, 1.0], [0, 0.9], [-0.6, 0.8], [0, off0 + (gown ? 0.4 : 0.2)]];
    const cost = (k: number[]) => {
      place(k); let c = 0;
      for (const [b, r] of balls) { w.copy(O).addScaledVector(X, b.x).addScaledVector(Y, b.y).addScaledVector(Z, b.z); const d = pen(w, r) / s; c += d * d; }
      return 4000 * c + (k[0] - 0.25) ** 2 + (k[1] - 0.05) ** 2 + 0.7 * k[2] ** 2 + 2 * k[3] ** 2 + 60 * Math.max(0, k[3] - off0) ** 2; // (it rests on what is under it, never stands off it)
    };
    // (from the best few of a spread of starts, each settled by coordinate descent)
    const starts: [number, number[]][] = [];
    for (const e of [-0.2, 0.1, 0.4, 0.7, 1.0]) for (const a of [0, 0.25, 0.5, 0.75]) for (const b of [-0.4, -0.1, 0.2, 0.5]) for (const c of [0, off0, off0 + 0.15]) { const k = [e, a, b, c]; starts.push([cost(k), k]); }
    let best = [0.25, 0.05, 0, 0], bc = Infinity;
    for (const [c0, k0] of starts.sort((x, y) => x[0] - y[0]).slice(0, 8)) {
      let k = k0, kc = c0;
      for (let stp = 0.2; stp > 0.004; stp *= 0.6) for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 4; i++) for (const dd of [stp, -stp]) {
        const t = k.slice(); t[i] = clampTo(t[i] + dd, range[i][0], range[i][1]); const c = cost(t); if (c < kc - 1e-12) { kc = c; k = t; break; }
      }
      if (kc < bc) { bc = kc; best = k; }
    }
    place(best);
    new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(O).premultiply(mount.matrixWorld.clone().invert()).decompose(st.position, st.quaternion, st.scale);
    body.updateMatrixWorld(true);
  }
  // a staff planted at ease slides through the hand till its foot is on the floor
  if (P.holdR === STAFF_AT_EASE.holdR && standing && soles.length && gR.children.length) {
    body.updateMatrixWorld(true);
    let floor = Infinity; for (const m of soles) floor = Math.min(floor, new THREE.Box3().setFromObject(m).min.y);
    const st = gR.children[0], a = new THREE.Vector3(0, 1, 0).transformDirection(st.matrixWorld), low = new THREE.Box3().setFromObject(st).min.y;
    if (a.y > 0.5 && Number.isFinite(floor)) { st.position.y += (floor + 0.01 * s - low) / a.y / gR.getWorldScale(new THREE.Vector3()).y; st.updateMatrixWorld(true); }
  }
  // a body that lies settles as it would fall (see settleLay); it is turned and put on the floor below
  const laid = P.lie ? settleLay(P.lie, s, { body, up, neck, arm, leg }, own, [gR, gL]) : undefined;
  if (laid && garments.length) laid.lift = 0.02 * s; // (it lies on its clothes: what of them is under it lies under it)
  // the cloth hangs on the posed body (on one laid out, the way it lies)
  if (garments.length) hangGarments(garments, drapeWorld(body, { pel, up, neck, arm, leg, gR, gL }, fr, s, P, dead, laid));
  // a bow or a crossbow slung on the back lies over what hangs there (a cloak, a coat's tails, a mantle), never through it
  if (slung && garments.length && !P.lie) {
    const cloth: M[] = []; body.traverse((o) => { const m = o as M; if (m.isMesh && (m.userData.garment || m.userData.cloth) && !(m.material as THREE.Material).transparent) cloth.push(m); });
    overCloth(slung, cloth, s);
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
  drapeBraids(up, neck, head, s);
  const joints: Record<string, THREE.Object3D> = {};
  body.traverse((o) => { if (o.name) joints[o.name] = o; });
  body.userData.joints = joints;

  const out = new THREE.Group(); out.add(body); out.userData.joints = joints;
  if (f.sparkles && !dead) for (let i = 0; i < 16; i++) { const a = i * 2.39996, r = (1.1 + (i % 3) * 0.35) * s, y = (0.8 + ((i * 7) % 11) * 0.42) * s + (f.hoverFt ?? 0); out.add(at(glassy(sph((0.05 + (i % 3) * 0.02) * s, f.sparkles, 6, 4), f.sparkles, 0.85), Math.cos(a) * r, y, Math.sin(a) * r)); }
  if (laid) placeLay(out, body, laid, s, own, { up, head, gR, gL, drop: dead });
  else if (f.hoverFt && !dead) body.position.y += f.hoverFt;
  return out;
}

/** An elbow or a knee bends as one limb: near the joint (within `reach` of it, along the limb) the surface of each side
 *  turns part of the way with the other, the upper limb's end a little and the lower limb's start most of the way, half
 *  way at the joint itself. So the bend is one rounded form, the point of the elbow or the knee standing out from it,
 *  with no ball and no step, at any angle; the inside of the bend gathers. Run once on the posed figure. */
function bendLimb(l: Limb, reach: number): void {
  const th = l.mid.rotation.x, hy = l.mid.position.y;
  if (Math.abs(th) < 1e-4 || reach <= 0) return;
  // the share of the bend a point takes: 0 above the joint's reach, 1 below it, a half at the joint
  const share = (d: number) => 0.5 - 0.5 * Math.sin(Math.PI / 2 * Math.max(-1, Math.min(1, d / reach)));
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  const turn = (m: M, upper: boolean) => {
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined; if (!pos) return;
    m.updateMatrix(); inv.copy(m.matrix).invert();
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);
      const d = upper ? v.y - hy : v.y; // along the limb from the joint, + toward the upper limb
      if (upper ? d >= reach : d <= -reach) continue;
      const a = upper ? share(d) * th : (share(d) - 1) * th, c = Math.cos(a), sn = Math.sin(a), y = d, z = v.z;
      v.y = y * c - z * sn + (upper ? hy : 0); v.z = y * sn + z * c;
      v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z); moved = true;
    }
    if (moved) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); }
  };
  for (const c of l.root.children) if ((c as M).isMesh) turn(c as M, true);
  for (const c of l.mid.children) if ((c as M).isMesh) turn(c as M, false);
}

/** What the cloth hangs on (kit/cloth.ts): points over each part of the posed body, the ring volumes it is lofted from,
 *  the way down (on a body to be laid out, the way it will lie), and the floor. Garments are left out (each is in the
 *  way of those hung over it once it hangs), as is a weapon a dead hand will drop. */
function drapeWorld(body: THREE.Group, j: { pel: THREE.Group; up: THREE.Group; neck: THREE.Group; arm: Limb[]; leg: Limb[]; gR: THREE.Group; gL: THREE.Group }, fr: Frame, s: number, P: HeroPose, dead: boolean, laid?: Laid): DrapeWorld {
  body.updateMatrixWorld(true);
  const solid = (o: THREE.Object3D): o is M => (o as M).isMesh && !((o as M).material as THREE.Material).transparent && !o.userData.garment;
  // the meshes under a node, not those under any of `stop`
  const meshes = (o: THREE.Object3D, stop: THREE.Object3D[] = []) => { const out: M[] = []; const walk = (n: THREE.Object3D) => { for (const c of n.children) { if (stop.includes(c)) continue; if (solid(c)) out.push(c); walk(c); } }; walk(o); return out; };
  const sample = (ms: M[], cap: number) => {
    const n = ms.reduce((a, m) => a + m.geometry.getAttribute('position').count, 0), out: THREE.Vector3[] = [];
    for (const m of ms) out.push(...pointsOf(m, Math.max(6, Math.round(cap * m.geometry.getAttribute('position').count / Math.max(1, n)))));
    return out;
  };
  const parts = new Map<string, THREE.Vector3[]>(), volumes = new Map<string, (p: THREE.Vector3, out: THREE.Vector3) => number>();
  // how deep a point lies in a ring stack lofted in a joint's frame, and the way out (radially, in the world)
  const vol = (o: THREE.Object3D, rings: Ring[]) => {
    const inv = o.matrixWorld.clone().invert(), q = new THREE.Vector3(), lo = rings[0].y, hi = rings[rings.length - 1].y;
    return (p: THREE.Vector3, out: THREE.Vector3) => {
      q.copy(p).applyMatrix4(inv).divideScalar(s); if (q.y < lo + 0.05 || q.y > hi - 0.05) return -1;
      const r = ringAt(rings, q.y), n = r.n ?? 2, dx = q.x - (r.x ?? 0), dz = q.z - (r.z ?? 0), dd = dz >= 0 ? r.f : r.b, v = (Math.abs(dx) / r.w) ** n + (Math.abs(dz) / dd) ** n;
      if (v >= 1) return -1;
      out.set(dx, 0, dz); if (out.lengthSq() < 1e-12) out.set(0, 0, 1);
      out.normalize().transformDirection(o.matrixWorld);
      return (1 - v ** (1 / n)) * Math.min(r.w, dd) * s;
    };
  };
  const tr = torsoRings(fr);
  const collars = j.arm.map((l) => l.collar ?? l.root), mounts = j.up.children.filter((c) => c.name === 'beltR' || c.name === 'beltL' || c.name === 'back');
  // each part: a sample of its points for the cloth to hang over, and every point of it for the cloth to be lifted out of
  const surface = new Map<string, THREE.Vector3[]>(), every = (ms: M[]) => ms.flatMap((m) => pointsOf(m, m.geometry.getAttribute('position').count));
  const part = (n: string, ms: M[], cap: number) => { const p = sample(ms, cap); parts.set(n, p); surface.set(n, every(ms)); return p; };
  part('torso', meshes(j.up, [j.neck, ...collars, ...mounts]), 2400); volumes.set('torso', vol(j.up, tr));
  part('pelvis', meshes(j.pel, [j.up, ...j.leg.map((l) => l.root)]), 1400); volumes.set('pelvis', vol(j.pel, pelvisRings(fr)));
  j.leg.forEach((l, k) => {
    const sd = k === 0 ? 'R' : 'L';
    part('thigh' + sd, l.root.children.filter(solid), 500); volumes.set('thigh' + sd, vol(l.root, thighRings(fr)));
    part('shin' + sd, meshes(l.mid, [l.end]), 450); volumes.set('shin' + sd, vol(l.mid, shinRings(fr)));
    part('foot' + sd, meshes(l.end), 600);
  });
  j.arm.forEach((l, k) => {
    const sd = k === 0 ? 'R' : 'L', held = k === 0 ? j.gR : j.gL;
    // (the point of the elbow is the upper arm's: cloth lying on the arm runs on over it, and hangs on from there)
    const fore = part('forearm' + sd, meshes(l.mid, [l.end]), 300), el = l.mid.getWorldPosition(new THREE.Vector3());
    part('upperArm' + sd, meshes(l.root, [l.mid]), 400); parts.get('upperArm' + sd)!.push(...fore.filter((p) => p.distanceTo(el) < 0.35 * s));
    volumes.set('upperArm' + sd, vol(l.root, upperArmRings(fr, k === 0 ? SIDE_X.R : SIDE_X.L))); volumes.set('forearm' + sd, vol(l.mid, forearmRings(fr)));
    part('hand' + sd, meshes(l.end, [held]), 120);
  });
  // gear put away (a weapon at the belt, or slung on the back), for what hangs over it: read as balls along its pieces.
  // Every mount child named 'stowed' or flagged userData.stowed counts (a figure may carry gear at both hips and the back),
  // each a piece with its own line along its length, so cloth is lifted out of a piece from that piece's own line, never
  // along a line from one piece across the body to another.
  const stows = mounts.flatMap((m) => m.children.filter((c) => c.name === 'stowed' || c.userData.stowed)), pieces = new Map<string, { bone: THREE.Vector3[]; surface: THREE.Vector3[] }[]>();
  let stowLine: THREE.Vector3[] | undefined;
  if (stows.length) {
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])))].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
    const each = stows.map((g) => {
      const balls = ballsOf(g), lo = Math.min(...balls.map(([c, r]) => c.y - r)), hi = Math.max(...balls.map(([c, r]) => c.y + r));
      const ws = balls.map(([c, r]) => [g.localToWorld(c.clone()), r] as const), on: THREE.Vector3[] = [];
      // (the points on its balls, close along a haft whose mesh has points only at its ends)
      for (const [c, r] of ws) for (const d of dirs) on.push(c.clone().addScaledVector(d, r));
      return { ws, on, bone: [g.localToWorld(new THREE.Vector3(0, lo, 0)), g.localToWorld(new THREE.Vector3(0, hi, 0))], surface: [...every(meshes(g)), ...on] };
    }).filter((e) => e.ws.length); // (a piece with nothing solid in it has no line)
    if (each.length) {
      const ws = each.flatMap((e) => e.ws);
      parts.set('stowed', each.flatMap((e) => e.on)); surface.set('stowed', each.flatMap((e) => e.surface));
      pieces.set('stowed', each.map((e) => ({ bone: e.bone, surface: e.surface })));
      volumes.set('stowed', (p, out) => { let best = -Infinity; for (const [c, r] of ws) { const d = r - p.distanceTo(c); if (d > best) { best = d; out.copy(p).sub(c); } } if (out.lengthSq() < 1e-12) out.set(0, 0, -1); out.normalize(); return best; });
      stowLine = each[0].bone;
    }
  }
  // a shield on the arm, for the cloth behind it (a mantle's flap, a cloak's front edge), which it lies outside
  const shield = dead ? undefined : j.gL.getObjectByName('shieldFace')?.parent;
  if (shield) part('shield', meshes(shield), 500);
  // the way down: on a body laid out, the way it lies as it settled (settleLay), toward the floor it rests on there
  const down = laid ? laid.n.clone().negate() : new THREE.Vector3(...(P.lie === 'back' ? [0, 0, -1] : P.lie === 'front' ? [0, 0, 1] : P.lie === 'side' ? [-SIDE_X.R, 0, 0] : [0, -1, 0]) as [number, number, number]);
  // the floor: the body's lowest point that way (what it rests on: on a body laid out, the very point it is put on the
  // floor by), the head and what the hands keep included; a dead hand lets go of what it held, which lies apart
  let floor: number | undefined;
  if (laid) floor = laid.lift - laid.low;
  else if (!P.seated) {
    floor = -Infinity;
    const extra = [...meshes(j.neck), ...(dead ? [] : [...meshes(j.gR), ...meshes(j.gL)])];
    for (const ps of [...parts.values(), sample(extra, 400)]) for (const p of ps) floor = Math.max(floor, p.dot(down));
    if (!Number.isFinite(floor)) floor = undefined;
  }
  // each part's bone, a line through its joints (as kit/clothcheck.ts reads them)
  const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()), bones = new Map<string, THREE.Vector3[]>(), spine = [wp(j.pel), wp(j.up), wp(j.neck)];
  bones.set('torso', spine); bones.set('pelvis', spine);
  j.leg.forEach((l, k) => {
    const sd = k === 0 ? 'R' : 'L', line = [wp(l.root), wp(l.mid), wp(l.end)], feet = parts.get('foot' + sd)!, mid = new THREE.Vector3();
    for (const p of feet) mid.add(p);
    bones.set('thigh' + sd, line); bones.set('shin' + sd, line); if (feet.length) bones.set('foot' + sd, [line[1], line[2], mid.divideScalar(feet.length)]);
  });
  j.arm.forEach((l, k) => {
    const sd = k === 0 ? 'R' : 'L', line = [wp(l.root), wp(l.mid), wp(l.end)], hand = l.end.getObjectByName('hand' + sd);
    bones.set('upperArm' + sd, line); bones.set('forearm' + sd, line); bones.set('hand' + sd, [line[1], line[2], hand ? wp(hand) : line[2]]);
  });
  if (stowLine) bones.set('stowed', stowLine); // (along its length: a haft, a blade; with several pieces, the first one's, as `pieces` holds each)
  // (gear put away moves with the trunk: what of it stands above a cloak's top, the head of a weapon slung on the back, is
  // not under the cloak)
  return { parts, down, floor, volumes, bones, surface, pieces, trunk: ['torso', 'pelvis', 'stowed'], lying: !!P.lie };
}

// The hand functions below take `sx` as the hand's handedness: +1 for a right hand, -1 for a left, which is -SIDE_X of
// its arm. The thumb and index finger are on the -sx side of the hand's own frame, so a haft's head comes out of the
// fist on that side, above the thumb. (kit/weapons.ts closeGrip takes the same.)

// The arm's limits. A wrist's turn is read in the forearm's frame as three angles, applied in the arm's own order: the
// forearm's turn about its length (0 is the rig's zero, the palm forward with the arm hanging, which is full
// supination; negative turns the palm in), then the bend toward the thumb or the little finger, then the bend back or
// forward. In a pose's signs (mirrored like the wrist's y and z): bend > 0 is extension, the back of the hand toward the
// forearm; dev > 0 is radial deviation, toward the thumb.
const DEG = Math.PI / 180, Y_AXIS = new THREE.Vector3(0, 1, 0);
/** The wrist's range (radians): extension, flexion, radial and ulnar deviation, and the forearm's turn from the rig's
 *  zero (a little supination, nearly a half turn of pronation). Every hand ends inside it. */
export const WRIST = { ext: 60 * DEG, flex: 70 * DEG, radial: 20 * DEG, ulnar: 30 * DEG, sup: 5 * DEG, pron: 165 * DEG };
/** A fist on a weapon: the wrist cocked back and a little toward the little finger, where a grip is strongest, and
 *  turned from there toward the thumb or the little finger no more than `give` to point the weapon. */
const GRIP = { bend: 35 * DEG, dev: -7 * DEG, give: 20 * DEG };
/** How far an elbow may bend (radians) before the forearm presses through the biceps: less on a heavily muscled arm,
 *  about 92 degrees at an arm girth of 1.45, 108 at 1.05, 118 at 0.77. Poses and the solvers keep every elbow under it. */
export function elbowLimit(fr: Frame): number { return Math.min(130, Math.max(85, 145.8 - 37 * fr.arm)) * DEG; }
type WristTurn = { twist: number; dev: number; bend: number };
const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** A wrist joint's turn as its three angles, in a pose's signs (`side` is the arm's SIDE_X). */
export function wristTurnOf(q: THREE.Quaternion, side: number): WristTurn { const e = new THREE.Euler().setFromQuaternion(q, 'YZX'); return { twist: e.y * side, dev: e.z * side, bend: e.x }; }
function wristQ(w: WristTurn, side: number): THREE.Quaternion { return new THREE.Quaternion().setFromEuler(new THREE.Euler(w.bend, w.twist * side, w.dev * side, 'YZX')); }
/** The turn nearest `t` (radians) inside the forearm's range, taken round the shorter way. */
function twistIn(t: number): number {
  if (t >= -WRIST.pron && t <= WRIST.sup) return t;
  const toSup = t > WRIST.sup ? t - WRIST.sup : t + 2 * Math.PI - WRIST.sup, toPron = t < -WRIST.pron ? -WRIST.pron - t : 2 * Math.PI - WRIST.pron - t;
  return toSup <= toPron ? WRIST.sup : -WRIST.pron;
}
function wristIn(w: WristTurn): WristTurn { return { twist: twistIn(w.twist), dev: clampTo(w.dev, -WRIST.ulnar, WRIST.radial), bend: clampTo(w.bend, -WRIST.flex, WRIST.ext) }; }
/** Brings a wrist inside its range, keeping as much of its turn as it can; returns how far outside it was (radians). */
function limitWrist(end: THREE.Object3D, side: number): number {
  const w = wristTurnOf(end.quaternion, side), c = wristIn(w), over = Math.abs(w.twist - c.twist) + Math.abs(w.dev - c.dev) + Math.abs(w.bend - c.bend);
  if (over > 1e-6) end.quaternion.copy(wristQ(c, side));
  return over;
}
/** The wrist turn that lays a haft across the fist, its head out on the thumb's side, pointing along `d` (a unit vector
 *  in the forearm's frame): the turn and deviation that asks for as far as the wrist allows, bent back by `bend` (a turn
 *  about the haft itself, so it leaves the haft where it is). `v` is where the haft then points, `off` its angle from `d`. */
function gripTurn(d: THREE.Vector3, side: number, bend: number, devIn: [number, number] = [-WRIST.ulnar, WRIST.radial]): { w: WristTurn; v: THREE.Vector3; off: number } {
  // the thumb's side of the hand is (side, 0, 0): turned by the deviation then the twist it points along
  // (side cos dev cos tw', sin dev, -side cos dev sin tw') with tw' = twist * side
  const w = wristIn({ twist: side * Math.atan2(-side * d.z, side * d.x), dev: clampTo(Math.asin(clampTo(d.y, -1, 1)), devIn[0], devIn[1]), bend });
  const v = new THREE.Vector3(side, 0, 0).applyQuaternion(wristQ(w, side));
  return { w, v, off: v.angleTo(d) };
}

/** A fist round a haft lying across the palm: the wrist turns, inside its range, to lay the haft along the fist as the
 *  pose points it, cocked back as a strong grip is and never far from its slight turn toward the little finger; a weapon
 *  pointed where the wrist will not follow lies as near it as the grip allows. The weapon keeps its turn about its own haft. (kit/weapons.ts closeGrip makes the same fist.) */
function holdFast(hand: THREE.Object3D, held: THREE.Object3D, sx: number): void {
  const meshes = hand.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
  if (meshes.length < 10) return;
  const u = ((meshes[0].geometry as THREE.SphereGeometry).parameters?.radius ?? 0.105) / 0.105, side = -sx;
  const aim = hand.quaternion.clone().multiply(held.quaternion), d = Y_AXIS.clone().applyQuaternion(aim);
  const { w, v } = gripTurn(d, side, GRIP.bend, [GRIP.dev - GRIP.give, GRIP.dev + GRIP.give]);
  hand.quaternion.copy(wristQ(w, side));
  held.quaternion.copy(hand.quaternion.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(d, v).multiply(aim)));
  held.position.set(0, -0.15 * u, 0.085 * u);
  fistOf(meshes, sx, u);
}
/** The second hand on a haft the other hand holds: the wrist turns, inside its range, to lie the haft across the palm with
 *  the thumb and index toward the head (as on the weapon hand), and the hand closes (`fist` false only turns it).
 *  Returns how far the haft lies off the fist's line where the wrist cannot follow it (radians). */
function closeOn(end: THREE.Object3D, mid: THREE.Object3D, held: THREE.Object3D, sx: number, fist = true): number {
  const meshes = end.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[]; if (meshes.length < 10) return 0;
  const u = ((meshes[0].geometry as THREE.SphereGeometry).parameters?.radius ?? 0.105) / 0.105, side = -sx;
  const d = Y_AXIS.clone().transformDirection(held.matrixWorld).transformDirection(mid.matrixWorld.clone().invert());
  const { w, off } = gripTurn(d, side, GRIP.bend - 10 * DEG);
  end.quaternion.copy(wristQ(w, side));
  if (fist) fistOf(meshes, sx, u);
  return off;
}
/** A closed fist with nothing in it: the fingers folded down into the palm, the thumb across their middle joints. */
function clenchOf(meshes: THREE.Mesh[], sx: number, u: number): void {
  const palm = meshes[0], cy = palm.position.y, yk = cy - 0.1 * u, zf = palm.position.z + 0.044 * u;
  for (let i = 0; i < 4; i++) {
    const k1 = meshes[1 + i * 2], k2 = meshes[2 + i * 2], x = k1.position.x, L1 = (k1.geometry as THREE.CapsuleGeometry).parameters.height;
    k1.rotation.set(-1.45, 0, 0); k1.position.set(x, yk - 0.01 * u, zf + L1 / 2 - 0.005 * u);
    k2.rotation.set(-0.7, 0, 0); k2.position.set(x, yk + 0.022 * u, zf + 0.045 * u);
  }
  // the thumb from the side of the palm across the front of the first two fingers
  const th = meshes[9], base = new THREE.Vector3(-sx * 0.09 * u, cy - 0.04 * u, zf + 0.02 * u), tip = new THREE.Vector3(sx * 0.01 * u, yk + 0.03 * u, zf + 0.1 * u);
  th.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize()); th.position.copy(base.add(tip).multiplyScalar(0.5));
}
/** A hand hooked into a talon: the fingers fanned apart, bent a little at the knuckle and hard at the middle joint, the
 *  thumb spread out to the side and down. `sx` is the hand's handedness (1 right, -1 left), as for fistOf. */
function talonOf(meshes: THREE.Mesh[], sx: number, u: number): void {
  const palm = meshes[0], cy = palm.position.y, yk = cy - 0.09 * u, z0 = palm.position.z + 0.012 * u, down = new THREE.Vector3(0, -1, 0);
  const qx = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a), qz = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
  // lay a capsule from a joint along a direction; returns the next joint
  const seg = (m: THREE.Mesh, from: THREE.Vector3, q: THREE.Quaternion) => {
    const g = (m.geometry as THREE.CapsuleGeometry).parameters, L = g.height + g.radius, d = down.clone().applyQuaternion(q);
    m.quaternion.copy(q); m.position.copy(from).addScaledVector(d, L / 2); return from.clone().addScaledVector(d, L);
  };
  for (let i = 0; i < 4; i++) {
    const k1 = meshes[1 + i * 2], k2 = meshes[2 + i * 2], fan = qz(0.16 * (i - 1.5) * sx), a1 = 0.4 + 0.06 * i, a2 = a1 + 1.3 + 0.08 * i;
    const knuckle = new THREE.Vector3(k1.position.x * 1.12, yk, z0);
    seg(k2, seg(k1, knuckle, fan.clone().multiply(qx(-a1))), fan.clone().multiply(qx(-a2)));
  }
  const th = meshes[9], base = new THREE.Vector3(-sx * 0.08 * u, cy - 0.02 * u, palm.position.z + 0.03 * u), d = new THREE.Vector3(-sx * 0.62, -0.5, 0.6).normalize();
  const g = (th.geometry as THREE.CapsuleGeometry).parameters, L = g.height + g.radius;
  th.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); th.position.copy(base).addScaledVector(d, L / 2);
}
/** A fist round a haft (or a shield's grip, a book's foot): the fingers curled round it, the thumb over them from the index side. */
function fistOf(meshes: THREE.Mesh[], sx: number, u: number): void {
  for (let i = 0; i < 4; i++) {
    const k1 = meshes[1 + i * 2], k2 = meshes[2 + i * 2], x = k1.position.x;
    k1.rotation.x = -1.5; k1.position.set(x, -0.255 * u, 0.06 * u);
    k2.rotation.x = -3.3; k2.position.set(x, -0.2 * u, 0.16 * u);
  }
  const th = meshes[9]; th.rotation.set(-0.2, 0, -sx * 1.35); th.position.set(-sx * 0.045 * u, -0.085 * u, 0.15 * u);
}
/** An open hand's fingers: each a chain from its knuckle, bent `mcp` there and `pip` more at the middle joint (radians,
 *  index to little finger), fanned by `spread`. */
type HandShape = { mcp: number[]; pip: number[]; spread: number };
/** At rest: a soft curl that deepens from the index to the little finger. */
const RELAXED: HandShape = { mcp: [0.3, 0.38, 0.47, 0.58], pip: [0.5, 0.62, 0.75, 0.88], spread: 0.05 };
/** Spread open, as a hand pushes a spell out from the palm. */
const SPREAD: HandShape = { mcp: [0.04, 0.03, 0.06, 0.1], pip: [0.1, 0.1, 0.13, 0.17], spread: 0.16 };
/** Laid on something rounded (a hip), the fingers barely bent. */
const FLAT: HandShape = { mcp: [0.08, 0.1, 0.12, 0.15], pip: [0.1, 0.12, 0.15, 0.2], spread: 0.03 };
/** Laid flat (on a belt, or under a book held open on the palm): the fingers straight, so whatever the hand rests on or
 *  holds up lies on the palm and the fingers alike. */
const STRAIGHT: HandShape = { mcp: [0.02, 0.03, 0.04, 0.05], pip: [0.03, 0.04, 0.05, 0.06], spread: 0.04 };
function shapeHand(meshes: THREE.Mesh[], sx: number, u: number, s: number, sh: HandShape): void {
  const thumbX = -sx; // the index finger next to the thumb, the little finger on the far side, the fan opening from the middle
  for (let i = 0; i < 4; i++) {
    const k1 = meshes[1 + i * 2], k2 = meshes[2 + i * 2], L1 = (k1.geometry as THREE.CapsuleGeometry).parameters.height, L2 = (k2.geometry as THREE.CapsuleGeometry).parameters.height;
    const sp = sh.spread * (1.5 - i) / 1.5 * thumbX, a1 = sh.mcp[i], a2 = a1 + sh.pip[i];
    const dir = (a: number) => new THREE.Vector3(Math.sin(sp), -Math.cos(sp) * Math.cos(a), Math.cos(sp) * Math.sin(a));
    const base = new THREE.Vector3((1.5 - i) * 0.047 * u * thumbX, -0.03 * s - 0.19 * u, (0.015 + 0.004 * i) * s), pip = base.clone().addScaledVector(dir(a1), L1);
    k1.rotation.set(-a1, 0, sp); k1.position.copy(base).addScaledVector(dir(a1), L1 / 2);
    k2.rotation.set(-a2, 0, sp); k2.position.copy(pip).addScaledVector(dir(a2), L2 / 2);
  }
}
/** Lays the thumb (a capsule) from its base toward a point. */
function thumbTo(th: THREE.Mesh, base: THREE.Vector3, toward: THREE.Vector3): void {
  const d = toward.clone().sub(base).normalize(), L = (th.geometry as THREE.CapsuleGeometry).parameters.height;
  th.rotation.set(0, 0, 0); th.quaternion.setFromUnitVectors(Y_AXIS, d); th.position.copy(base).addScaledVector(d, L / 2);
}
const handMeshes = (end: THREE.Object3D) => end.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];

/** The signed depth (> 0 inside) of an unscaled local point in a superellipse section w x (front f, back b): the
 *  section's level over the length of its gradient, the distance to the edge to first order, so that a point beside a
 *  wide section (an arm hanging at the side of the chest or the hips) reads as near as it is, not half as near. */
function sectionDepth(dx: number, dz: number, w: number, fd: number, bd: number, n = 2): number {
  const d = dz >= 0 ? fd : bd, ax = Math.abs(dx) / w, az = Math.abs(dz) / d, v = ax ** n + az ** n;
  if (v < 1e-12) return Math.min(w, d);
  const lv = v ** (1 / n), k = lv / v, gl = Math.hypot(k * ax ** (n - 1) / w, k * az ** (n - 1) / d);
  return Math.min((1 - lv) / gl, w, d);
}
/** Lay gear slung on the back (`g`, a group on the back mount: +y up the back, -z out behind) over the cloth hung there:
 *  every point of it lies behind the cloth at its place across the back, by a hair. The strap holds it at its top: it
 *  leans back about its highest point and then stands straight back only as far as it must, the pair that clears the
 *  cloth with the least gap under it, so it rests on the cloth (a cloak flaring below the shoulder blades) rather than
 *  standing off it. */
function overCloth(g: THREE.Group, cloth: THREE.Mesh[], s: number): void {
  const F = g.parent; if (!F || !cloth.length) return;
  let root: THREE.Object3D = F; while (root.parent) root = root.parent; root.updateMatrixWorld(true);
  const toF = F.matrixWorld.clone().invert(), v = new THREE.Vector3(), pts: THREE.Vector3[] = [];
  g.traverse((o) => { const m = o as M; if (!m.isMesh || (m.material as THREE.Material).transparent) return; const to = toF.clone().multiply(m.matrixWorld), pos = m.geometry.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(to)); });
  if (!pts.length) return;
  const box = new THREE.Box3().setFromPoints(pts), lo = box.min.clone().addScalar(-0.6 * s), hi = box.max.clone().addScalar(0.6 * s);
  // the cloth as points across the back (each triangle filled in finely, so a coarse drape reads as a surface), binned by
  // where they lie across it (x, y)
  const cell = 0.1 * s, bins = new Map<number, number[]>(), key = (x: number, y: number) => (Math.floor(x / cell) + 512) * 1024 + Math.floor(y / cell) + 512;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const m of cloth) {
    const to = toF.clone().multiply(m.matrixWorld), pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(to); b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(to); c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(to);
      if (Math.max(a.x, b.x, c.x) < lo.x || Math.min(a.x, b.x, c.x) > hi.x || Math.max(a.y, b.y, c.y) < lo.y || Math.min(a.y, b.y, c.y) > hi.y) continue;
      const k = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / (0.04 * s)));
      for (let i = 0; i <= k; i++) for (let j = 0; i + j <= k; j++) {
        v.copy(a).multiplyScalar(1 - (i + j) / k).addScaledVector(b, i / k).addScaledVector(c, j / k);
        const kk = key(v.x, v.y); let l = bins.get(kk); if (!l) bins.set(kk, (l = [])); l.push(v.x, v.y, v.z);
      }
    }
  }
  if (!bins.size) return;
  // how far out behind the cloth lies at a place (the furthest back of it within a hair across), or undefined where none
  const R = 0.05 * s, clear = 0.025 * s;
  const backOf = (x: number, y: number): number | undefined => {
    let z: number | undefined; const i0 = Math.floor(x / cell), j0 = Math.floor(y / cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const l = bins.get((i + 512) * 1024 + j + 512); if (!l) continue;
      for (let q = 0; q < l.length; q += 3) if (Math.abs(l[q] - x) <= R && Math.abs(l[q + 1] - y) <= R && (z === undefined || l[q + 2] < z)) z = l[q + 2];
    }
    return z;
  };
  const top = pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]).clone(), turn = new THREE.Matrix4(), p = new THREE.Vector3();
  const lean = (th: number) => turn.makeTranslation(top.x, top.y, top.z).multiply(new THREE.Matrix4().makeRotationX(th)).multiply(new THREE.Matrix4().makeTranslation(-top.x, -top.y, -top.z));
  let best = { th: 0, t: 0, gap: Infinity };
  for (let th = 0; th <= 0.7001; th += 0.025) {
    lean(th);
    const under: number[] = []; let t = 0;
    for (const q of pts) { p.copy(q).applyMatrix4(turn); const z = backOf(p.x, p.y); if (z === undefined) continue; const need = p.z - (z - clear); under.push(need); if (need > t) t = need; }
    if (!under.length) { if (th === 0) return; continue; } // nothing hangs behind it
    if (th === 0 && t <= 0) return; // already clear
    const gap = under.reduce((sum, need) => sum + (t - need), 0) / under.length;
    if (gap < best.gap - 1e-6) best = { th, t, gap };
  }
  lean(best.th).premultiply(new THREE.Matrix4().makeTranslation(0, 0, -best.t));
  g.updateMatrix(); g.matrix.premultiply(turn); g.matrix.decompose(g.position, g.quaternion, g.scale); g.updateMatrixWorld(true);
}

/** The balls a held or stowed piece is read as to keep it clear of the body (in `g`'s own frame, feet): along each of its
 *  meshes, down its length (the frame's y), as wide as the mesh is across. */
function ballsOf(g: THREE.Object3D): [THREE.Vector3, number][] {
  const out: [THREE.Vector3, number][] = [];
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  g.traverse((o) => {
    const m = o as M; if (!m.isMesh || (m.material as THREE.Material).transparent) return;
    const to = inv.clone().multiply(m.matrixWorld), pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3(), b = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to));
    const c = b.getCenter(new THREE.Vector3()), h = b.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    // (each ball as wide as the piece's widest point round its line: a box's corners, not just its sides)
    let r = 0; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(to); r = Math.max(r, Math.hypot(v.x - c.x, v.z - c.z)); }
    r *= 1.02; const n = Math.max(1, Math.ceil((2 * h.y - 2 * r) / Math.max(r, 0.06)) + 1);
    for (let i = 0; i < n; i++) out.push([new THREE.Vector3(c.x, n === 1 ? c.y : b.min.y + r + (2 * h.y - 2 * r) * i / (n - 1), c.z), r]);
  });
  return out;
}

/** How deep a ball (its centre in world space, its radius in feet) sinks into the body: the torso with the bust and what
 *  is worn over it (plate, mail, a tunic's hem, a skirt, a gown), the hips, the thighs, the neck and the head. Read off
 *  the ring stacks the skin is lofted from, inflated where armour or cloth stands off it; the solvers that move an arm
 *  keep their samples out of it. Built once the trunk and legs are posed. */
function bodyGuard(o: { body: THREE.Object3D; up: THREE.Object3D; pel: THREE.Object3D; neck: THREE.Object3D; head: THREE.Object3D; hips: THREE.Object3D[]; fr: Frame; tr: Ring[]; s: number; f: HeroFigure; gown: boolean; bust: (p: [number, number, number]) => [number, number, number]; bare?: boolean }): (p: THREE.Vector3, r: number) => number {
  // (`bare`: the body and its plate only, without the cloth hung on it, a mail shirt, a tunic's skirt, a skirt or a gown)
  const { fr, tr, s, f } = o, plate = f.armor?.kind === 'plate', mail = f.armor?.kind === 'mail' && !o.bare;
  o.body.updateMatrixWorld(true);
  const inv = (x: THREE.Object3D) => x.matrixWorld.clone().invert();
  const toUp = inv(o.up), toPel = inv(o.pel), toNeck = inv(o.neck), toHead = inv(o.head), toBody = inv(o.body), toHips = o.hips.map(inv);
  const pr = pelvisRings(fr), th = thighRings(fr), nr = neckRings(fr), q = new THREE.Vector3();
  const sect = sectionDepth;
  const stack = (rings: Ring[], p: THREE.Vector3, k = 1, front = (_x: number, _y: number) => 0) => {
    const lo = rings[0].y, hi = rings[rings.length - 1].y, y = clampTo(p.y, lo, hi), r = ringAt(rings, y);
    const d = sect(p.x - (r.x ?? 0), p.z - (r.z ?? 0), r.w * k, r.f * k + front(p.x, y), r.b * k, r.n ?? 2);
    return Math.min(d, p.y - lo, hi - p.y);
  };
  // the torso: plate stands 9% off it (more at the ridge), the fauld wider below; the bust swells the front
  const kT = (y: number) => plate ? (y >= 0.62 ? (y <= 1.95 ? 1.09 : 1.0) : clampTo(1.12 + 0.35 * (0.5 - y), 1.12, 1.26)) : (y < 0.55 && y > 0.28 ? 1.05 : 1.0);
  const bustAt = (x: number, y: number) => {
    if (!fr.bust) return 0;
    const r = ringAt(tr, y), e = Math.min(1, Math.abs(x) / r.w), z = r.f * (1 - e ** (r.n ?? 2)) ** (1 / (r.n ?? 2));
    return Math.max(0, o.bust([x, y, z])[2] - z);
  };
  const ridge = (y: number) => plate ? 0.05 * Math.exp(-((y - 1.5) ** 2) / 0.08) : 0;
  // and, read straight off the swollen surface, how far a point on the front lies behind the bust (the section above
  // only widens the front by the bulge, which falls short on a full bust away from the middle)
  const behindBust = (x: number, y: number, z: number) => {
    if (!fr.bust || z <= 0) return -Infinity;
    const r = ringAt(tr, clampTo(y, tr[0].y, tr[tr.length - 1].y)), e = Math.abs(x) / r.w; if (e >= 1) return -Infinity;
    const zf = r.f * (1 - e ** (r.n ?? 2)) ** (1 / (r.n ?? 2)), lift = o.bust([x, y, zf])[2] - zf;
    return lift > 0.004 ? (zf + lift) * kT(y) - z : -Infinity;
  };
  // the fauld: its four lames round the belly and hips, as built on the hips (so they turn with them), each the section of
  // the hips scaled out from its top to its rolled rim
  const hips = plate ? hipStack(tr, pr) : [], fauld = plate ? [0, 1, 2, 3].map((i) => ({ y0: 0.68 - i * 0.17, y1: 0.48 - i * 0.17, k0: 1.12 + i * 0.05, k1: 1.185 + i * 0.05 })) : [];
  const toLame = fauld.map((_, i) => { const g = o.pel.getObjectByName('fauld' + i); return g ? inv(g) : toPel; }); // (each lame turned its share with the chest)
  const hem = !f.skirt && !o.gown && !o.bare, gownUp = GOWN.slice().reverse();
  return (p: THREE.Vector3, rad: number) => {
    const r = rad / s; let d = -Infinity;
    q.copy(p).applyMatrix4(toUp).divideScalar(s);
    d = Math.max(d, stack(tr, q, kT(q.y), (x, y) => bustAt(x, y) + ridge(y)), behindBust(q.x, q.y, q.z));
    if (mail && q.y > 0.05 && q.y < 1.05) { const R = 0.75 - 0.05 * (q.y - 0.05); d = Math.max(d, sect(q.x, q.z, R, 0.66 * R, 0.66 * R)); }
    if (hem && q.y > -0.375 && q.y < 0.375) { const R = 0.6 + 0.18 * (0.375 - q.y) / 0.75; d = Math.max(d, sect(q.x, q.z, R, 0.66 * R, 0.66 * R)); }
    q.copy(p).applyMatrix4(toPel).divideScalar(s); d = Math.max(d, stack(pr, q, plate ? 1.25 : mail ? 1.1 : 1));
    for (const [i, b] of fauld.entries()) if (q.copy(p).applyMatrix4(toLame[i]).divideScalar(s).y > b.y1 - 0.03 - r && q.y < b.y0 + 0.03 + r) {
      // the lame (its top edge, under the rim of the one above, held off a little on the first), and its rim: a tube on
      // the lame's lower edge
      const y = clampTo(q.y, b.y1, b.y0), R = ringAt(hips, y), k = b.k0 + (b.k1 - b.k0) * (b.y0 - y) / (b.y0 - b.y1), Rb = ringAt(hips, b.y1), kr = b.k1 + 0.012, tr2 = i === 3 ? 0.02 : 0.016;
      d = Math.max(d, Math.min(sect(q.x - (R.x ?? 0), q.z - (R.z ?? 0), R.w * k + 0.006, R.f * k + 0.006, R.b * k + 0.006, R.n ?? 2), q.y - b.y1, b.y0 + (i ? 0 : 0.04) - q.y));
      d = Math.max(d, tr2 - Math.hypot(q.y - b.y1, sect(q.x - (Rb.x ?? 0), q.z - (Rb.z ?? 0), Rb.w * kr, Rb.f * kr, Rb.b * kr, Rb.n ?? 2)));
    }
    for (const m of toHips) { q.copy(p).applyMatrix4(m).divideScalar(s); if (q.y < 0.1 && q.y > -0.9) d = Math.max(d, stack(th, q, plate ? 1.08 : 1)); }
    q.copy(p).applyMatrix4(toNeck).divideScalar(s); d = Math.max(d, stack(nr, q));
    q.copy(p).applyMatrix4(toHead).divideScalar(s);
    { const rz = q.z > 0 ? 0.4 : 0.46, v = (q.x / 0.36) ** 2 + ((q.y - 0.37) / 0.5) ** 2 + (q.z / rz) ** 2; d = Math.max(d, (1 - Math.sqrt(v)) * 0.36); }
    if ((f.skirt || o.gown) && !o.bare) {
      q.copy(p).applyMatrix4(toBody).divideScalar(s);
      const R = o.gown ? radiusAt(gownUp, q.y) : (q.y > HIP - 2.4 && q.y < HIP + 0.2 ? 0.66 + 0.39 * (HIP + 0.2 - q.y) / 2.6 : 0);
      if (R > 0 && q.y < (o.gown ? GOWN[0][0] : HIP + 0.2)) d = Math.max(d, sect(q.x, q.z, R, (o.gown ? 0.68 : 0.8) * R, (o.gown ? 0.68 : 0.8) * R));
    }
    return Math.max(0, (d + r) * s);
  };
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

// A body laid out on the floor (a dead figure, or any pose that lies): it settles as a body would fall (settleLay), on the
// posed figure, and is then turned over and put on the floor, what its dead hands held let go beside it (placeLay).

/** How a body lies once it has settled, in the frame it was posed in: `n` is the floor's up, `low` how far along `n` its
 *  lowest point lies (of what it rests on, see restsOn), and `q` the turn that lays the body out so (q turns n to the
 *  world's up). `lift`: how far it lies above the floor, on the cloth beneath it (a body in clothes lies on them). */
interface Laid { n: THREE.Vector3; low: number; q: THREE.Quaternion; lift: number }
/** What a body laid on the floor rests on, and what rests on it: its own surfaces (the rig's skin and boots and the face,
 *  `own`) and plate lofted over them. Cloth, hair, open shells and small gear give way. */
function restsOn(o: THREE.Object3D, own: Set<THREE.Object3D>): o is M {
  const m = o as M; if (!m.isMesh || o.userData.garment || o.userData.cloth) return false;
  const mt = m.material as THREE.Material;
  return !mt.transparent && mt.side !== THREE.DoubleSide && (own.has(o) || m.geometry.type === 'BufferGeometry');
}
/** The meshes under `top` that a body rests on, leaving out whatever is under any of `stop`. */
function restingMeshes(top: THREE.Object3D, own: Set<THREE.Object3D>, stop: THREE.Object3D[] = []): M[] {
  const out: M[] = [], walk = (o: THREE.Object3D) => { for (const c of o.children) { if (stop.includes(c)) continue; if (restsOn(c, own)) out.push(c); walk(c); } };
  walk(top); return out;
}
/** Every solid (not see-through) mesh under `top`, leaving out whatever is under any of `stop`. */
function solidMeshes(top: THREE.Object3D, stop: THREE.Object3D[] = []): M[] {
  const out: M[] = [], walk = (o: THREE.Object3D) => { for (const c of o.children) { if (stop.includes(c)) continue; const m = c as M; if (m.isMesh && !(m.material as THREE.Material).transparent) out.push(m); walk(c); } };
  walk(top); return out;
}
/** Calls `fn` on each vertex of the meshes, in the world (the same vector each time). */
function eachVertex(ms: M[], fn: (v: THREE.Vector3) => void): void {
  const v = new THREE.Vector3();
  for (const m of ms) { const p = m.geometry.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) fn(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); }
}

/** Calls `fn` on each vertex of a mesh in the world, and on points spread over every face too big for a sampling of
 *  `step` to see whole. */
function eachSurfacePoint(m: M, step: number, fn: (x: number, y: number, z: number) => void): void {
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, w = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); w[3 * i] = v.x; w[3 * i + 1] = v.y; w[3 * i + 2] = v.z; fn(v.x, v.y, v.z); }
  const tris = (idx ? idx.count : p.count) / 3, d = (a: number, b: number) => Math.hypot(w[3 * a] - w[3 * b], w[3 * a + 1] - w[3 * b + 1], w[3 * a + 2] - w[3 * b + 2]);
  for (let t = 0; t < tris; t++) {
    const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, c = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
    const k = Math.ceil(Math.max(d(a, b), d(b, c), d(c, a)) / step); if (k < 2) continue;
    for (let i = 0; i <= k; i++) for (let j = 0; i + j <= k; j++) { const u = i / k, q = j / k, r = 1 - u - q; fn(w[3 * a] * u + w[3 * b] * q + w[3 * c] * r, w[3 * a + 1] * u + w[3 * b + 1] * q + w[3 * c + 1] * r, w[3 * a + 2] * u + w[3 * b + 2] * q + w[3 * c + 2] * r); }
  }
}

/** Points in the world, as x, y, z runs. */
type Cloud = Float32Array;
/** The vertices of meshes, those `keep` takes, thinned to one in each cube of side `cell` (0 keeps every one). */
function cloudOf(ms: M[], cell = 0, keep?: (v: THREE.Vector3) => boolean): Cloud {
  const out: number[] = [], seen = new Set<number>();
  eachVertex(ms, (v) => {
    if (keep && !keep(v)) return;
    if (cell > 0) { const k = (Math.floor(v.x / cell) * 73856093) ^ (Math.floor(v.y / cell) * 19349663) ^ (Math.floor(v.z / cell) * 83492791); if (seen.has(k)) return; seen.add(k); }
    out.push(v.x, v.y, v.z);
  });
  return new Float32Array(out);
}
const joinClouds = (...cs: Cloud[]): Cloud => { const out = new Float32Array(cs.reduce((a, c) => a + c.length, 0)); let i = 0; for (const c of cs) { out.set(c, i); i += c.length; } return out; };
function centroidOf(P: Cloud): THREE.Vector3 { const c = new THREE.Vector3(); for (let i = 0; i < P.length; i += 3) { c.x += P[i]; c.y += P[i + 1]; c.z += P[i + 2]; } return c.divideScalar(Math.max(1, P.length / 3)); }
/** The turn by `a` about the line through `o` along the unit vector `u`. */
const turnAbout = (o: THREE.Vector3, u: THREE.Vector3, a: number): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(o.x, o.y, o.z).multiply(new THREE.Matrix4().makeRotationAxis(u, a)).multiply(new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z));
function turnCloud(P: Cloud, m: THREE.Matrix4): void {
  const e = m.elements;
  for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; P[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
}
/** Turns a joint by `a` about the line through its own origin along the unit vector `u` (in the world). */
function turnJoint(j: THREE.Object3D, u: THREE.Vector3, a: number): void {
  const pq = j.parent ? j.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  j.quaternion.premultiply(pq.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(u, a)).multiply(pq));
  j.updateMatrixWorld(true);
}

/** The floor and what lies on it, seen from above (down `n`, the floor's up): a grid of columns, each holding the span
 *  of heights each part over it fills. A point's gap is its height over the highest part under it, or over the floor;
 *  inside a part it is negative. Parts are numbered from 0 to 30. */
class Columns {
  private cells = new Map<number, number[]>();
  private e1: THREE.Vector3; private e2: THREE.Vector3;
  /** How far a point may press into each part before it counts as inside (flesh on flesh gives a little). */
  readonly give: number[] = [];
  constructor(private n: THREE.Vector3, private floor: number, private cell: number) {
    this.e1 = new THREE.Vector3(1, 0, 0).cross(n); if (this.e1.lengthSq() < 0.1) this.e1.set(0, 1, 0).cross(n); this.e1.normalize();
    this.e2 = new THREE.Vector3().crossVectors(n, this.e1);
  }
  private key(x: number, y: number, z: number): number {
    const { e1, e2, cell } = this;
    return (Math.floor((x * e1.x + y * e1.y + z * e1.z) / cell) + 32768) * 65536 + Math.floor((x * e2.x + y * e2.y + z * e2.z) / cell) + 32768;
  }
  height(x: number, y: number, z: number): number { const n = this.n; return x * n.x + y * n.y + z * n.z - this.floor; }
  add(x: number, y: number, z: number, part: number): void {
    const k = this.key(x, y, z), h = this.height(x, y, z); let a = this.cells.get(k); if (!a) this.cells.set(k, (a = []));
    for (let i = 0; i < a.length; i += 3) if (a[i] === part) { if (h < a[i + 1]) a[i + 1] = h; if (h > a[i + 2]) a[i + 2] = h; return; }
    a.push(part, h, h);
  }
  /** A mesh's surface as `part`: its vertices, and points over every face too big for one column to see whole. */
  addMesh(m: M, part: number): void { eachSurfacePoint(m, this.cell * 0.7, (x, y, z) => this.add(x, y, z, part)); }
  /** The least gap of the points (turned by `m` first, when given), leaving out the parts set in the bit mask `skip`
   *  (-1 leaves only the floor); it stops early once a gap is at or below `stop`. */
  least(P: Cloud, skip: number, m?: THREE.Matrix4, stop = -Infinity): number {
    const e = m?.elements; let g = Infinity;
    for (let i = 0; i < P.length; i += 3) {
      let x = P[i], y = P[i + 1], z = P[i + 2];
      if (e) { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13]; z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; }
      const h = this.height(x, y, z); let top = 0;
      if (skip !== -1) { const a = this.cells.get(this.key(x, y, z)); if (a) for (let j = 0; j < a.length; j += 3) { const p = a[j]; if (!((skip >> p) & 1) && a[j + 1] < h && a[j + 2] - (this.give[p] ?? 0) > top) top = a[j + 2] - (this.give[p] ?? 0); } }
      if (h - top < g) { g = h - top; if (g <= stop) return g; }
    }
    return g;
  }
}
/** Points that rest on the floor and what lies on it, each run with the parts (a bit mask) it passes through unseen. */
type Rested = [Cloud, number][];
/** The turn about the line through `o` along `u` (a positive turn lowers) that rests the points on what lies under them:
 *  from clear they are lowered until they touch, from inside something raised until clear, within [lo, hi]. No step
 *  moves a point farther than the least gap there was, so nothing passes through a part on the way. */
function dropTurn(col: Columns, P: Rested, o: THREE.Vector3, u: THREE.Vector3, lo: number, hi: number, tol: number): number {
  let R = 0;
  for (const [Q] of P) for (let i = 0; i < Q.length; i += 3) { const dx = Q[i] - o.x, dy = Q[i + 1] - o.y, dz = Q[i + 2] - o.z, t = dx * u.x + dy * u.y + dz * u.z; R = Math.max(R, Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - t * t))); }
  if (R < 1e-6) return 0;
  const g = (a: number, stop?: number) => { const m = turnAbout(o, u, a); let v = Infinity; for (const [Q, skip] of P) { v = Math.min(v, col.least(Q, skip, m, stop)); if (stop !== undefined && v <= stop) break; } return v; };
  const stepOf = (v: number) => Math.min(0.08, Math.max(0.006, Math.abs(v) / R)), g0 = g(0);
  if (g0 > tol) {
    let a0 = 0, a1 = NaN, v = g0;
    while (a0 < hi) { const a = Math.min(hi, a0 + stepOf(v)); v = g(a, 0); if (v <= 0) { a1 = a; break; } a0 = a; }
    if (Number.isNaN(a1)) return a0;
    for (let i = 0; i < 8; i++) { const m = (a0 + a1) / 2; if (g(m, 0) > 0) a0 = m; else a1 = m; }
    return a0;
  }
  if (g0 >= -tol) return 0;
  let a1 = 0, a0 = NaN, v = g0, bestA = 0, bestV = g0;
  while (a1 > lo) { const a = Math.max(lo, a1 - stepOf(v)); v = g(a); if (v >= 0) { a0 = a; break; } if (v > bestV) { bestV = v; bestA = a; } a1 = a; }
  if (Number.isNaN(a0)) return bestA;
  for (let i = 0; i < 8; i++) { const m = (a0 + a1) / 2; if (g(m, 0) >= 0) a0 = m; else a1 = m; }
  return a0;
}

/** A body that lies settles as it would fall, worked on the posed figure before it is turned to lie (see placeLay), in
 *  its own frame, the floor's up `n` the way the pose lays it: (1) the trunk (the pelvis and the chest, with the tops of
 *  the limbs) rolls and tips a little either way until it rests as low as it will go: on its back on the seat and the
 *  shoulder blades, face down on the chest and the hips; (2) the head drops (or lifts) on the neck until it rests on the
 *  floor or the chest, and a head the neck cannot lift clear of the floor is part of what the trunk rests on; (3) each
 *  limb in turn (the legs first, the straighter one first, then the arms, the lower first) drops at its root until it
 *  rests on the floor, the body or a limb already down; with its elbow or knee bent it then rolls about its upper bone
 *  until the forearm or shin is down too, and drops again; resting at one point it rocks about the line from its root
 *  through that point until it rests at a second; an arm caught on a slope slides off it; (4) the hand rolls on the
 *  forearm to lie flat and drops at the wrist, the foot drops at the ankle and rolls onto its edge, inside the joints'
 *  ranges. The elbows and knees stay as posed. Cloth, hair and gear give way (see restsOn). Where a limb leaves the trunk
 *  (the top of the thigh in the pelvis, the upper arm by the armpit), or lies along a limb already down (thick thighs side
 *  by side), the two overlap by build, so there the limb does not rest on it. */
function settleLay(lie: 'back' | 'front' | 'side', s: number, j: { body: THREE.Group; up: THREE.Group; neck: THREE.Group; arm: Limb[]; leg: Limb[] }, own: Set<THREE.Object3D>, held: THREE.Object3D[]): Laid {
  const { body, up, neck, arm, leg } = j;
  body.updateMatrixWorld(true);
  const n0 = new THREE.Vector3(...(lie === 'back' ? [0, 0, 1] : lie === 'front' ? [0, 0, -1] : [RX, 0, 0]) as Euler3);
  const q0 = new THREE.Quaternion().setFromEuler(lie === 'side' ? new THREE.Euler(0, 0, RX * Math.PI / 2) : new THREE.Euler(lie === 'back' ? -Math.PI / 2 : Math.PI / 2, 0, 0));
  const fine = 0.03 * s, tol = 0.004 * s, CHEST = 0, HEAD = 1, PELVIS = 6;
  // the trunk: the chest (with the arms' collars left out) and the pelvis (with the legs left out)
  const collars = arm.map((l) => l.collar ?? l.root), chest = restingMeshes(up, own, [neck, ...collars, ...held]), pelvis = restingMeshes(body, own, [up, ...leg.map((l) => l.root)]);
  // the limbs, each as its upper bone (less its top, which goes with the trunk: the shoulder, the hip), the forearm or
  // shin, and the hand or foot; thinned for the search, and whole to keep every bit of it off the floor
  const limbs = [...arm.map((l, k) => ({ l, isArm: true, sx: k === 0 ? RX : LX })), ...leg.map((l, k) => ({ l, isArm: false, sx: k === 0 ? RX : LX }))].map(({ l, isArm, sx }, i) => {
    const part = 2 + i, inv = l.root.matrixWorld.clone().invert(), q = new THREE.Vector3(), yOf = (v: THREE.Vector3) => q.copy(v).applyMatrix4(inv).y / s;
    const cut = isArm ? -0.45 : -0.4, near = isArm ? -0.75 : -Infinity; // (a thigh is never in the pelvis's way, nor the upper arm's top in the chest's)
    const upper = restingMeshes(l.root, own, [l.mid]), fore = restingMeshes(l.mid, own, [l.end]), end = restingMeshes(l.end, own, held);
    const N = cloudOf(upper, fine, (v) => { const y = yOf(v); return y <= cut && y > near; }), U = cloudOf(upper, fine, (v) => yOf(v) <= near);
    const F = cloudOf(fore, fine), E = cloudOf(end, fine), C = joinClouds(N, U, F, E), fullE = cloudOf(end), full = joinClouds(cloudOf(upper, 0, (v) => yOf(v) <= cut), cloudOf(fore), fullE);
    const self = 1 << part;
    return {
      l, isArm, sx, part, meshes: [...upper, ...fore, ...end], girdle: cloudOf(upper, fine, (v) => yOf(v) > cut), girdleAll: cloudOf(upper, 0, (v) => yOf(v) > cut),
      N, U, F, C, D: C.subarray(N.length + U.length), E: C.subarray(N.length + U.length + F.length), full, fullE: full.subarray(full.length - fullE.length),
      rest: [[C.subarray(0, N.length), self | (1 << (isArm ? CHEST : PELVIS))], [C.subarray(N.length), self]] as Rested,
      restD: [[C.subarray(N.length + U.length), self]] as Rested, restE: [[C.subarray(N.length + U.length + F.length), self]] as Rested,
      at: [l.root, l.mid, l.end].map((x) => x.getWorldPosition(new THREE.Vector3())),
    };
  });
  // (1) the trunk, as low as it will rest: its middle's height over its lowest point, least over a little roll and tip
  const T = joinClouds(cloudOf([...chest, ...pelvis], fine), ...limbs.map((c) => c.girdle)), trunk = joinClouds(cloudOf([...chest, ...pelvis]), ...limbs.map((c) => c.girdleAll));
  const tipAx = new THREE.Vector3(...(lie === 'side' ? [0, 0, 1] : [1, 0, 0]) as Euler3), rollAx = new THREE.Vector3(0, 1, 0);
  const upOf = (p: number, r: number) => n0.clone().applyAxisAngle(tipAx, p).applyAxisAngle(rollAx, r);
  const lowest = (P: Cloud, n: THREE.Vector3) => { let m = Infinity; for (let i = 0; i < P.length; i += 3) m = Math.min(m, P[i] * n.x + P[i + 1] * n.y + P[i + 2] * n.z); return m; };
  const TIP = 0.35, ROLL = lie === 'side' ? 0.45 : 0.3;
  const settleTrunk = (P: Cloud) => {
    const mid = centroidOf(P), rise = (p: number, r: number) => { const n = upOf(p, r); return mid.dot(n) - lowest(P, n); };
    let tip = 0, roll = 0, best = rise(0, 0);
    for (let st = 0.1; st > 0.004; st /= 2) for (let moved = true; moved;) {
      moved = false;
      for (const [dp, dr] of [[st, 0], [-st, 0], [0, st], [0, -st]]) {
        const p = Math.max(-TIP, Math.min(TIP, tip + dp)), r = Math.max(-ROLL, Math.min(ROLL, roll + dr)), h = rise(p, r);
        if (h < best - 1e-7) { best = h; tip = p; roll = r; moved = true; }
      }
    }
    return upOf(tip, roll);
  };
  // the floor under it, with the trunk (and the tops of the arms) on it
  let n = settleTrunk(T), col!: Columns;
  const lay = (low: Cloud) => {
    col = new Columns(n, lowest(low, n), 0.06 * s);
    for (const m of chest) col.addMesh(m, CHEST);
    for (const m of pelvis) col.addMesh(m, PELVIS);
    for (const c of limbs) { col.give[c.part] = 0.03 * s; if (c.isArm) for (let i = 0; i < c.girdleAll.length; i += 3) col.add(c.girdleAll[i], c.girdleAll[i + 1], c.girdleAll[i + 2], c.part); } // (a limb may press a little into one it lies on)
  };
  lay(trunk);
  // (2) the head drops on the neck (tipping back, or forward onto the chest) until it rests
  // (the neck rises out of the chest, and the head sits on it: where they meet, nothing rests on the chest)
  const headMs = restingMeshes(neck, own), skull = headMs.filter((m) => m.parent !== neck), hj = neck.children.find((c) => c.name === 'head') ?? neck, hinv = hj.matrixWorld.clone().invert(), hq = new THREE.Vector3();
  const core = (v: THREE.Vector3) => { hq.copy(v).applyMatrix4(hinv); return hq.y < 0.2 * s && Math.hypot(hq.x, hq.z) < 0.25 * s; };
  const Hc = cloudOf(skull, fine, (v) => !core(v)), Nc = joinClouds(cloudOf(skull, fine, core), cloudOf(headMs.filter((m) => m.parent === neck), fine)), pivot = neck.getWorldPosition(new THREE.Vector3());
  const NECK = lie === 'side' ? 0.8 : 0.6; let nodded = 0; // (how far the neck may give: further to the side than back or forward)
  const headDrop = () => {
    const dH = centroidOf(Hc).sub(pivot); dH.addScaledVector(n, -dH.dot(n)); if (dH.lengthSq() < 1e-4 * s * s) return;
    const u = new THREE.Vector3().crossVectors(n, dH).normalize(), a = dropTurn(col, [[Hc, 1 << HEAD], [Nc, (1 << HEAD) | (1 << CHEST)]], pivot, u, -NECK - nodded, NECK - nodded, tol);
    if (!a) return; const m = turnAbout(pivot, u, a); turnJoint(neck, u, a); turnCloud(Hc, m); turnCloud(Nc, m); nodded += a;
  };
  headDrop();
  // a head the neck will not lift clear of the floor (thrown back, under a trunk that tips the other way) is part of what
  // the trunk rests on
  if (Math.min(col.least(Hc, -1), col.least(Nc, -1)) < -tol) { n = settleTrunk(joinClouds(T, Hc, Nc)); lay(joinClouds(trunk, cloudOf(headMs))); headDrop(); }
  for (const m of headMs) col.addMesh(m, HEAD);
  // (3, 4) the limbs, one by one, each resting on what is down before it
  type Chain = (typeof limbs)[number];
  const flat = (v: THREE.Vector3) => v.addScaledVector(n, -v.dot(n));
  const turn = (c: Chain, o: THREE.Object3D, at: THREE.Vector3, u: THREE.Vector3, a: number, endOnly = false) => {
    if (!a) return; const m = turnAbout(at, u, a); turnJoint(o, u, a);
    if (endOnly) { turnCloud(c.E, m); turnCloud(c.fullE, m); } else { turnCloud(c.C, m); turnCloud(c.full, m); c.at[1].applyMatrix4(m); c.at[2].applyMatrix4(m); }
  };
  const swing = (c: Chain) => {
    const o = c.at[0], d = flat(centroidOf(c.C).sub(o)), len = centroidOf(c.C).distanceTo(o);
    if (d.length() < 0.25 * len) { flat(d.set(c.isArm ? c.sx : 0, c.isArm ? 0 : -1, 0)); if (d.lengthSq() < 0.04) flat(d.set(0, 0, 1)); } // (a limb straight up falls outward, or a leg toward the feet)
    const u = new THREE.Vector3().crossVectors(n, d).normalize(), a = dropTurn(col, c.rest, o, u, -0.3, 1.6, tol);
    turn(c, c.l.root, o, u, a);
  };
  const roll1 = (c: Chain) => {
    const o = c.at[0], u = c.at[1].clone().sub(o).normalize(), t = new THREE.Vector3().crossVectors(u, centroidOf(c.D).sub(o)).dot(n);
    if (Math.abs(t) < 0.02 * s) return false;
    if (t > 0) u.negate();
    const a = dropTurn(col, c.restD, o, u, -0.4, c.isArm ? 1.3 : 0.9, tol); turn(c, c.l.root, o, u, a); // (the upper bone turns on itself, staying where it lies)
    return Math.abs(a) > 1e-3;
  };
  const rock = (c: Chain) => {
    // a limb resting at one point rocks about the line from its root through that point (both hold), as far as it will
    // go down, until it rests at a second
    let best = Infinity, at = -1, Q0: Cloud | undefined;
    for (const [Q, k] of c.rest) for (let i = 0; i < Q.length; i += 3) { const g = col.least(Q.subarray(i, i + 3), k); if (g < best) { best = g; at = i; Q0 = Q; } }
    if (!Q0 || best > 2 * tol) return;
    const o = c.at[0], u = new THREE.Vector3(Q0[at], Q0[at + 1], Q0[at + 2]).sub(o); if (u.length() < 0.12 * s) return; u.normalize();
    const away = (Q: Cloud) => { const out: number[] = []; for (let i = 0; i < Q.length; i += 3) { const dx = Q[i] - o.x, dy = Q[i + 1] - o.y, dz = Q[i + 2] - o.z, t = dx * u.x + dy * u.y + dz * u.z; if (dx * dx + dy * dy + dz * dz - t * t > 0.0225 * s * s) out.push(Q[i], Q[i + 1], Q[i + 2]); } return new Float32Array(out); };
    if (new THREE.Vector3().crossVectors(u, centroidOf(c.C).sub(o)).dot(n) > 0) u.negate();
    turn(c, c.l.root, o, u, dropTurn(col, c.rest.map(([Q, k]) => [away(Q), k]), o, u, 0, 0.6, tol));
  };
  const meanHeight = (P: Cloud) => { let h = 0; for (let i = 0; i < P.length; i += 3) h += col.height(P[i], P[i + 1], P[i + 2]); return h / Math.max(1, P.length / 3); };
  const slide = (c: Chain) => {
    // an arm caught on a slope (the upper arm on the flank of a body on its side) slides off it: swept a little about the
    // floor's up, one way or the other, and dropped again, whichever ends the lowest
    if (lowOf(c) < 0.1 * s) return; // (down on the floor already)
    const o = c.at[0]; let best: [number, THREE.Vector3, number] | undefined, bestH = meanHeight(c.C) - 0.05 * s;
    for (const w of [0.25, -0.25, 0.5, -0.5]) {
      turn(c, c.l.root, o, n, w);
      if (c.rest.every(([Q, k]) => col.least(Q, k) >= -tol)) {
        const u = new THREE.Vector3().crossVectors(n, flat(centroidOf(c.C).sub(o))).normalize(), a = dropTurn(col, c.rest, o, u, 0, 1.6, tol);
        turn(c, c.l.root, o, u, a); const h = meanHeight(c.C);
        if (h < bestH) { bestH = h; best = [w, u.clone(), a]; }
        turn(c, c.l.root, o, u, -a);
      }
      turn(c, c.l.root, o, n, -w);
    }
    if (best) { turn(c, c.l.root, o, n, best[0]); turn(c, c.l.root, o, best[1], best[2]); }
  };
  const endTwist = (c: Chain) => {
    // a dead hand rolls on the forearm until it lies flat, palm up or palm down, whichever is the nearer (up to about a
    // quarter turn either way; the palm faces the wrist's z)
    const e = c.l.end, o = c.at[2], ax = o.clone().sub(c.at[1]).normalize(), z = new THREE.Vector3(0, 0, 1).transformDirection(e.matrixWorld), zr = new THREE.Vector3();
    let best = 0, bestV = -Infinity;
    for (let k = -22; k <= 22; k++) {
      const a = k * 0.05, v = Math.abs(zr.copy(z).applyAxisAngle(ax, a).dot(n)) - 0.02 * Math.abs(a);
      if (v > bestV && c.restE.every(([Q, k]) => col.least(Q, k, turnAbout(o, ax, a)) >= -tol)) { bestV = v; best = a; }
    }
    turn(c, e, o, ax, best, true);
  };
  const endDrop = (c: Chain) => {
    const e = c.l.end, o = c.at[2], x = new THREE.Vector3(1, 0, 0).transformDirection(e.matrixWorld), t = new THREE.Vector3().crossVectors(x, centroidOf(c.E).sub(o)).dot(n);
    if (Math.abs(t) < 0.005 * s) return;
    const sg = t > 0 ? -1 : 1; x.multiplyScalar(sg);
    let lo = -0.4, hi = 0.4;
    if (c.isArm) {
      // the wrist bends back no more than 60 degrees and forward no more than 70 (its bend: the last of its turns, about x)
      const b = new THREE.Euler().setFromQuaternion(e.quaternion, 'YZX').x, back = 1.047 - b, fwd = 1.222 + b;
      [lo, hi] = sg > 0 ? [-Math.min(0.3, Math.max(0, fwd)), Math.min(0.8, Math.max(0, back))] : [-Math.min(0.3, Math.max(0, back)), Math.min(0.8, Math.max(0, fwd))];
    }
    const a = dropTurn(col, c.restE, o, x, lo, hi, tol); turn(c, e, o, x, a, true);
    if (c.isArm) return;
    // a foot that bending will not lower (the leg along the floor on its side) rolls onto its edge
    const z = new THREE.Vector3(0, 0, 1).transformDirection(e.matrixWorld), tz = new THREE.Vector3().crossVectors(z, centroidOf(c.E).sub(o)).dot(n);
    if (Math.abs(tz) < 0.002 * s) return;
    z.multiplyScalar(tz > 0 ? -1 : 1); turn(c, e, o, z, dropTurn(col, c.restE, o, z, -0.35, 0.35, tol), true);
  };
  const offFloor = (c: Chain) => {
    // (the search sees a thinned sample of the limb: no vertex of it is left under the floor)
    const o = c.at[0], d = flat(centroidOf(c.C).sub(o)); if (d.lengthSq() < 1e-8) return;
    const u = new THREE.Vector3().crossVectors(n, d).normalize();
    if (col.least(c.full, -1) < -tol / 2) turn(c, c.l.root, o, u, dropTurn(col, [[c.full, -1]], o, u, -0.3, 0, tol / 2));
  };
  const lowOf = (c: Chain) => { let m = Infinity; for (let i = 0; i < c.C.length; i += 3) m = Math.min(m, col.height(c.C[i], c.C[i + 1], c.C[i + 2])); return m; };
  const order = limbs.map((c) => ({ c, low: lowOf(c), bend: Math.abs(c.l.mid.rotation.x) })).sort((a, b) => a.c.isArm !== b.c.isArm ? (a.c.isArm ? 1 : -1) : a.c.isArm ? a.low - b.low : a.bend - b.bend);
  const prime = (c: Chain) => {
    // what of a limb starts inside the trunk where it leaves it (the top of the upper arm by the armpit; the top of the
    // thigh, which turns inside the pelvis whichever way the hip turns), or inside a limb already down (thick thighs side
    // by side), does not rest on that: the points are sorted into runs by what they pass through unseen
    const self = 1 << c.part, others = limbs.reduce((k, x) => (x === c ? k : k | (1 << x.part)), 0), chestBit = 1 << CHEST, one = new Float32Array(3);
    const out: number[] = [], runs: [number, number, number][] = [], starts: number[] = [];
    for (const [P, top] of [[c.N, true], [c.U, false], [c.F, false], [c.E, false]] as [Cloud, boolean][]) {
      starts.push(out.length);
      const by = new Map<number, number[]>();
      for (let i = 0; i < P.length; i += 3) {
        one[0] = P[i]; one[1] = P[i + 1]; one[2] = P[i + 2];
        let k = self | (col.least(one, ~others) < 0 ? others : 0);
        if (top) k |= c.isArm ? (col.least(one, ~chestBit) < 0 ? chestBit : 0) : 1 << PELVIS;
        let q = by.get(k); if (!q) by.set(k, (q = [])); q.push(P[i], P[i + 1], P[i + 2]);
      }
      for (const [k, q] of by) { runs.push([out.length, out.length + q.length, k]); for (const x of q) out.push(x); }
    }
    c.C = new Float32Array(out); c.D = c.C.subarray(starts[2]); c.E = c.C.subarray(starts[3]);
    const view = (from: number): Rested => runs.filter(([i]) => i >= from).map(([i, j, k]) => [c.C.subarray(i, j), k]);
    c.rest = view(0); c.restD = view(starts[2]); c.restE = view(starts[3]);
  };
  for (const { c } of order) {
    prime(c);
    swing(c);
    if (Math.abs(c.l.mid.rotation.x) > 0.25 && roll1(c)) swing(c);
    rock(c);
    if (c.isArm) { slide(c); endTwist(c); }
    endDrop(c);
    offFloor(c);
    for (const m of c.meshes) col.addMesh(m, c.part);
  }
  // a head still clear of everything (on the side, say) drops on onto the arm beneath it, or the floor
  if (col.least(Hc, 1 << HEAD) > tol) headDrop();
  body.updateMatrixWorld(true);
  let low = Infinity; eachVertex(restingMeshes(body, own, held), (v) => { low = Math.min(low, v.dot(n)); });
  return { n, low, q: q0.clone().multiply(new THREE.Quaternion().setFromUnitVectors(n, n0)), lift: 0 };
}

/** A wing of a body laid out: flat on the floor from its root when the root is down there (the body on its back lies on
 *  its wings), otherwise sloping from its root on the back down to the floor; spread out along the floor the way it was
 *  spread (`sx` the side it spreads to, in its own frame), each pair (`i`) a hair above the one before. */
function layWing(g: THREE.Object3D, sx: number, s: number, i: number): void {
  g.updateMatrixWorld(true);
  const root = g.getWorldPosition(new THREE.Vector3()), web = g.children.find((c) => (c as M).geometry?.type === 'CircleGeometry');
  const span = web ? 2 * Math.abs(web.scale.x) : 2 * s, d = new THREE.Vector3(sx, 0, 0).transformDirection(g.matrixWorld).setY(0);
  if (d.lengthSq() < 0.09) d.set(root.x, 0, root.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35 * sx); // (spread straight up or down: out from the body's middle)
  if (d.lengthSq() < 1e-8) d.set(sx, 0, 0);
  d.normalize();
  const lift = (0.012 + 0.012 * i) * s, h = root.y - lift, tilt = h > 0.05 * s ? Math.asin(Math.min(0.9, h / span)) : 0;
  const along = d.clone().multiplyScalar(Math.cos(tilt)).setY(-Math.sin(tilt)), X = along.clone().multiplyScalar(sx);
  const Z = new THREE.Vector3(0, 1, 0).addScaledVector(along, -along.y).normalize(), Y = new THREE.Vector3().crossVectors(Z, X);
  const pq = g.parent ? g.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  g.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z))));
  if (!tilt && g.parent) g.position.copy(g.parent.worldToLocal(root.setY(lift)));
  g.updateMatrixWorld(true);
}

/** Lays out a body settled by settleLay: turned as it settled, its lowest point (of the body itself, see restsOn) on the
 *  floor, over the middle of where it lies; the wings laid down (layWing); and when `drop` (the body is dead) what the
 *  hands held let go, each on the floor clear of the body and of what fell before it, at the nearest place to its hand:
 *  the weapon pointing on away along the arm, the off hand's shield face down on its rim, a book on its cover, an orb. */
function placeLay(out: THREE.Group, body: THREE.Group, laid: Laid, s: number, own: Set<THREE.Object3D>, o: { up: THREE.Group; head: THREE.Group; gR: THREE.Group; gL: THREE.Group; drop: boolean }): void {
  const lay = new THREE.Group(); lay.add(body); out.add(lay); lay.quaternion.copy(laid.q); out.updateMatrixWorld(true);
  const bb = new THREE.Box3(); eachVertex(restingMeshes(body, own, [o.gR, o.gL]), (v) => bb.expandByPoint(v));
  lay.position.set(-(bb.min.x + bb.max.x) / 2, laid.lift - bb.min.y, -(bb.min.z + bb.max.z) / 2); out.updateMatrixWorld(true);
  o.up.children.filter((c) => c.userData.wing).forEach((w, i) => layWing(w, w.userData.wing as number, s, Math.floor(i / 2)));
  if (!o.drop || !(o.gR.children.length || o.gL.children.length)) return;
  // the floor the body covers, in cells, with a margin round it
  const cell = 0.08 * s, key = (x: number, z: number) => (x + 32768) * 65536 + z + 32768, taken = new Set<number>(), Y = new THREE.Vector3(0, 1, 0);
  const cover = (ms: M[], grow: number) => {
    const at = new Set<number>(); for (const m of ms) eachSurfacePoint(m, cell, (x, _y, z) => { at.add(key(Math.floor(x / cell), Math.floor(z / cell))); });
    for (const k of at) { const x = Math.floor(k / 65536) - 32768, z = (k % 65536) - 32768; for (let dx = -grow; dx <= grow; dx++) for (let dz = -grow; dz <= grow; dz++) if (dx * dx + dz * dz <= grow * grow + 1) taken.add(key(x + dx, z + dz)); }
  };
  cover(solidMeshes(body, [o.gR, o.gL]), Math.ceil(0.15 * s / cell));
  const heads = [o.head.getWorldPosition(new THREE.Vector3()), centroidOf(cloudOf(restingMeshes(o.head, own)))];
  for (const [hand, name, own0] of [[o.gR, 'dropped', false], [o.gL, 'droppedL', true]] as const) {
    if (!hand.children.length) continue;
    const H = hand.getWorldPosition(new THREE.Vector3()).setY(0), ax = new THREE.Vector3(0, 1, 0).transformDirection(hand.matrixWorld).setY(0);
    const g = new THREE.Group(); g.name = name;
    for (const c of [...hand.children]) { g.add(c); if (own0) { c.position.set(0, 0, 0); c.quaternion.identity(); } } // (a piece the hand carried in its own place: just the piece)
    g.updateMatrixWorld(true);
    const ms = solidMeshes(g), lb = new THREE.Box3(); eachVertex(ms, (v) => lb.expandByPoint(v));
    // which way it lies: a weapon with its haft along the floor and its head flat (its z up); a carried piece on its broad face
    const size = lb.getSize(new THREE.Vector3()), iu = own0 ? [0, 1, 2].reduce((a, b) => (size.getComponent(b) < size.getComponent(a) ? b : a)) : 2;
    const il = own0 ? [0, 1, 2].filter((k) => k !== iu).reduce((a, b) => (size.getComponent(b) > size.getComponent(a) ? b : a)) : 1, ik = 3 - iu - il;
    const anchor = own0 ? lb.getCenter(new THREE.Vector3()) : new THREE.Vector3(); // (a weapon by its grip, a carried piece by its middle)
    const foot: THREE.Vector3[] = [], seen = new Set<number>();
    for (const m of ms) eachSurfacePoint(m, cell / 2, (x, y, z) => { const q = new THREE.Vector3(x, y, z).sub(anchor), k = key(Math.floor(q.getComponent(il) / (cell / 2)), Math.floor(q.getComponent(ik) / (cell / 2))); if (!seen.has(k)) { seen.add(k); foot.push(q); } });
    // (a carried piece lies on the side its bulk is on, what stands out of its back up: a shield face down on its rim, its
    // handle and strap in the air, not propped up on them)
    let mean = 0, nv = 0; if (own0) eachVertex(ms, (v) => { mean += v.getComponent(iu); nv++; });
    const up = own0 && nv && mean / nv > lb.getCenter(new THREE.Vector3()).getComponent(iu) ? Y.clone().negate() : Y.clone();
    const basis = (w: THREE.Vector3) => { const c: THREE.Vector3[] = []; c[iu] = up.clone(); c[il] = w.clone(); c[ik] = new THREE.Vector3().crossVectors(c[(ik + 1) % 3], c[(ik + 2) % 3]); return new THREE.Matrix4().makeBasis(c[0], c[1], c[2]); };
    const dOut = H.lengthSq() > 0.09 * s * s ? H.clone() : ax.clone(); if (dOut.lengthSq() < 1e-8) dOut.set(1, 0, 0); dOut.normalize();
    const w0 = own0 || ax.lengthSq() < 1e-4 ? dOut.clone() : dOut.clone().addScaledVector(ax.clone().normalize(), 0.5).normalize();
    const p = new THREE.Vector3(), fits = (P: THREE.Vector3, m: THREE.Matrix4) => {
      for (const q of foot) {
        p.copy(q).applyMatrix4(m).add(P);
        if (taken.has(key(Math.floor(p.x / cell), Math.floor(p.z / cell)))) return false;
        for (const h of heads) if (Math.hypot(p.x - h.x, p.z - h.z) < 0.65 * s) return false;
      }
      return true;
    };
    let place: [THREE.Vector3, THREE.Matrix4] = [H.clone().addScaledVector(dOut, 4 * s), basis(w0)];
    find: for (let push = 0; push <= 4 * s; push += 0.12 * s) for (const t of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, Math.PI]) {
      const m = basis(w0.clone().applyAxisAngle(Y, t)), P = H.clone().addScaledVector(dOut, push);
      if (fits(P, m)) { place = [P, m]; break find; }
    }
    g.quaternion.setFromRotationMatrix(place[1]); g.position.copy(place[0]).sub(anchor.clone().applyMatrix4(place[1])); out.add(g); g.updateMatrixWorld(true);
    let low = Infinity; eachVertex(ms, (v) => { low = Math.min(low, v.y); }); g.position.y -= low; g.updateMatrixWorld(true);
    cover(ms, 1);
  }
}
