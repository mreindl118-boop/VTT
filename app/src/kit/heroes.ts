// Hero figures: a player character's own miniature, built from a recipe the DM's party pack carries (core/partyPack.ts).
// Original low-poly geometry on the kit's humanoid (kit/creatures.ts), one palette material per colour, flat shading.
// The recipe is data, so no character of any one table lives in the repo: the parts are generic (pointed ears, wings,
// a halo, a thorn crown, a shield, an axe, a book ...) and the pack says which a character wears, in what colours.
import * as THREE from 'three';
import { mat, matClone } from '../render/materials';
import { HIP, SHIN, THIGH, clipRings, forearmRings, frameOf, loftGeometry, lockGeometry, neckRings, pelvisRings, ringAt, ringPoint, shinRings, thighRings, torsoRings, upperArmRings, type Frame, type Measures, type Ring } from './anatomy';
import type { CreatureSize } from '../core/units';
import { faceFeatures, type FaceSpec, type FaceDetail } from './faces';
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
  /** Hands made into fists (an empty hand on the hip, say). */
  fist?: ('R' | 'L')[];
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
/** How much of the trunk's turn a pair of spectral wings undoes out of a fight, to stand square to the figure. */
const WINGS_SQUARE = 0.3;
/** A corset's leather girdle, in the fauld's place: three lames between `edges` (heights on the hips, its top to its
 *  foot: the first deep enough for a belt and a fist rested on the hip, two shorter below), each running `lap` up under
 *  the rim above, a constant `step` further out than the one above and flaring evenly to its rim; `line` is how far the
 *  hips are scaled out under it at a height, `out` how far a lame stands off that at a height. */
const GIRDLE = {
  edges: [0.68, 0.34, 0.155, -0.03], lap: 0.05, step: 0.02, rim: 0.011,
  line: (y: number) => 1.1 + 0.14 * Math.min(1, Math.max(0, (0.68 - y) / 0.71)) ** 1.5,
  out: (i: number, y: number) => i * GIRDLE.step + 0.2 * (GIRDLE.edges[i] + GIRDLE.lap - y),
};
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
  armor?: { kind: 'plate' | 'mail'; color: string; trim?: string; knotwork?: string; corset?: { color: string; belts?: string; lacing?: string }; emblem?: 'helm' };
  // On plate, `knotwork` (its colour: a worn silver, say) makes it an engraved harness: the breastplate one sculpted
  // plate with a keel and no rims across its front, pauldrons of three lames over an arming sleeve, vambraces from the
  // wrist to the elbow with a flared cuff over plated gauntlets, tassets of three lames, plain greaves and sabatons of two
  // lames on the boots, every edge finely lined in the trim, a band of knotwork on each major plate. `corset` cuts the
  // breastplate's lower edge to a point under the bust over a laced leather corset: in the fauld's place a girdle of
  // three lapped lames in that leather with buckled belts round it (`belts`, their leather; the buckles in `buckle`) and
  // a coat skirt of it in the culet's place, round the seat and the sides of the thighs, open at the front from hip to
  // hip, where the tassets hang, and vented up the back. `emblem` is a holy symbol borne on the breastplate in the
  // knotwork's colour: 'helm', an open eye on an upright gauntlet, in thin flat relief.
  /** Shirt sleeves rolled up to the elbow: bare forearms below a rolled cuff. */
  rolled?: boolean;
  /** With `rolled`: the sleeve comes down over the elbow and its roll sits on the forearm just below the bend, as one
   *  soft roll that bends with the arm (default: the cuff's turns at the elbow itself). */
  rolledLow?: boolean;
  cloak?: string; hood?: boolean;
  /** A mail shirt cut as a chain shirt: fitted to the hips and hanging straight to an uneven hem at the top of the
   *  thighs, fine staggered rows of rings (in the armour's `trim`) in place of the bright bands, the sleeves' hems
   *  fine too, and a V neck open over the shirt worn under it (`under`, its colour; default the sleeves' or the trim). */
  chainShirt?: { under?: string };
  /** A wide belt worn over whatever cloth is at the waist (a mail shirt, a tunic), with a big square buckle (default the
   *  `buckle` colour) on its front; it takes the place of the plain buckle. */
  belt?: { color: string; buckle?: string };
  /** How the satchel is worn and what is in it; with it the bag hangs outside whatever cloth lies under it, in every
   *  state. `hip`: the hip it hangs at (default the right), on a baldric that comes down across the chest from the
   *  other shoulder, buckled at the chest, a ring at its foot; with `strap: 'belt'` there is no baldric: the bag hangs
   *  from the waist belt by two short straps (its metal is the belt's, else a corset's buckles', else `buckle`). `mark`: a leaf sprig or a crescent moon worked on the
   *  flap, in `markColor`. Standing out of its top: `rolls` rolled bandages (how many, up to three), `vials` corked
   *  vial necks (their colours, up to three) and `herbs` a few sprigs (the colour of their flowers). `sprig`: a bundle
   *  of flowering herbs tied to the baldric's ring, or to a belt strap (the colour of its flowers). */
  satchelKit?: { hip?: 'R' | 'L'; strap?: 'belt'; mark?: 'leaf' | 'moon'; markColor?: string; rolls?: number; vials?: string[]; herbs?: string; sprig?: string };
  /** Laurel embroidery on the cloak (its colour) in place of the piped `cloakTrim`: a fine stem with leaves in pairs
   *  along the front edges, the hem and the capelet's edge. */
  cloakLaurel?: string;
  /** What the cloak's clasps show: `tree`, round brooches with a raised rim and a tree in relief, one on the front of
   *  each shoulder, lying on the cloth. */
  claspMark?: 'tree';
  /** The shield's face: a wide flat rim (in the offhand's `rim` colour) studded with `rivets` rivets (default 16), a
   *  vertical `band` of another colour down the face, and with `wreath` the emblem's laurel grown to a full wreath
   *  round the two rings. */
  shieldFace?: { band?: string; rivets?: number; wreath?: boolean };
  /** The pendant's shape: `rings`, two interlocked rings on a fine chain (default a cut gem). */
  pendantShape?: 'rings';
  /** A skirt; with an underskirt as well, a fitted gown (see gownTrim). */
  skirt?: string; underskirt?: string;
  /** false: no tunic hem below the belt and no belt tail hanging from it, for a garment made over the figure that takes
   *  their place (a doublet's skirts under a sash, kit/costume.ts). */
  hem?: boolean;
  weapon?: HeroWeapon;
  offhand?: { kind: HeroOffhand; color?: string; rim?: string; mark?: string };
  wings?: { color: string; opacity?: number; count?: 2 | 4 };
  /** The wings' sheen: colours the clear membrane shifts through across each wing (an iridescence), over its own. */
  wingSheen?: string[];
  /** Wide-leg trousers (their colour): cut full from the hip and hanging straight, with a pressed crease down the front
   *  and the back of each leg, flaring a little to a hem that falls over the boots; the seat in the same cloth. */
  trousers?: string;
  /** The coat's cut. 'frock': a tailored coat in place of the plain tails and lapels: its fronts fastened by one button at
   *  the waist and cut away below it, skirts fitted on the hips and hanging close to mid-thigh, open at the front, with
   *  flap pockets and a back vent; peaked lapels (in the coat's `lapel` colour) and a collar; turned-back cuffs. */
  coatCut?: 'frock';
  /** Embroidery on a frock coat (its thread's colour): a border and a vine on each lapel, a line round each cuff. */
  coatEmbroidery?: string;
  /** A crescent-moon pin on a frock coat's left lapel (its colour). */
  lapelPin?: string;
  /** A waistcoat under the coat, buttoned down the front to two points below the waist; `chain` a watch chain in two
   *  swags across it, from its middle to the pocket on the left, and `fob` a crystal hanging from the chain's ring. */
  waistcoat?: { color: string; buttons?: string; chain?: string; fob?: string };
  /** 'stand': the shirt (see `shirt`) fitted on the chest with its buttons down the front, and a high stand collar open
   *  at the throat, its points standing up, in place of the plain collar and placket. */
  shirtCollar?: 'stand';
  /** A halo of light in this colour (a darker colour is a fainter, more golden light): one ring of thin broken arcs wide
   *  of the head, set on the head and turning with it. A fallen body has none. */
  halo?: string;
  /** Two great spectral wings of soft light behind the shoulder blades, feathered (an aasimar's transformation): their
   *  colour, the tint of the feathers' tips (default the colour), and how strongly they glow (default 0.5). Alike on both
   *  sides; wider and swept further back in a battle stance; a fallen body has none. */
  spiritWings?: { color: string; rim?: string; opacity?: number };
  crown?: { color: string; flower?: string };
  /** A wreath in place of a crown's tall twigs: thorny twigs woven low round the head, small leaves (`leaf`) along them and
   *  big five-petal flowers (`flower`) at the front and the sides, most of them on the figure's left. */
  wreath?: { color: string; flower?: string; leaf?: string };
  /** A leather corset worn over a gown's waist, from the top of its skirt to under the bust: boned, laced up the front
   *  (`lacing`), two straps round it with buckles (`buckle`), and the skirt hung from a buckled belt at its foot, with
   *  `vials` (their colours, four at most) on thongs from that belt at the left hip. */
  corset?: { color: string; lacing?: string; buckle?: string; vials?: string[] };
  /** With puffSleeves on a gown: the blouse's sleeves full from below the bare shoulders to just above the elbow,
   *  gathered there, with a frill. */
  fullSleeves?: boolean;
  /** Vine embroidery (a winding stem with leaves and tendrils) along a gown's hem and up the edges of its slit, in place
   *  of gownTrim's plain lines there, and down the front edges and along the hem of the cloak worn with it. */
  vines?: string;
  /** A gown's hem and the edges of its slit cut in ragged dags, the underskirt's lace showing between them and along
   *  the slit. */
  dagged?: boolean;
  /** Tall boots laced up the front (the laces' colour): the shaft to just below the knee, in place of the turned cuff
   *  and the strap. */
  bootLaces?: string;
  /** Laces criss-crossing up the inside of the bracers (their colour). */
  bracerLaces?: string;
  /** On the cloak worn with a gown: a round brooch (its colour) on each top corner, behind the arms where the cloth
   *  shows beside them; with `shoulderCloak`, on each front corner of the mantle, a fine cord between them. */
  brooch?: string;
  /** The cloak worn with a gown lies on both shoulders: it hangs from them under a short mantle that stands wide open
   *  at the front, its corners brought forward over the shoulder caps to the collarbones. Long hair falls where it
   *  lies: it suits hair worn short, up or in a braid. */
  shoulderCloak?: boolean;
  /** A glowing spell wisp above the off hand. */
  wisp?: string;
  /** The wisp's shape: `'skull'` makes it a small spectral skull (a round cranium, two slanted eye sockets, a nose notch
   *  and a narrower jaw with tooth nicks), see-through and glowing in the wisp's colour, on a curl of smoke rising from
   *  the book. Without it the wisp is a plain round ghost. */
  wispShape?: 'skull';
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
  /** The look while the character's transformation is on (an aasimar's spectral wings, say): its fields are laid over
   *  the recipe while the token's transformed switch is on. */
  transform?: Partial<HeroFigure>;
}

/** The look a token's miniature is built from: the recipe with its transformation laid over it (and without the
 *  transformation itself) while the token's transformed switch is on; the recipe itself otherwise, or when it has no
 *  transformation. */
export function heroLook(f: HeroFigure, transformed?: boolean): HeroFigure {
  if (!transformed || !f.transform) return f;
  const { transform, ...rest } = f;
  return { ...rest, ...transform };
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
/** A spectral skull on a curl of smoke: the skull about the origin, its face to +z, the smoke winding down `drop` below
 *  it to a thin foot (where it rises from). All of it see-through and lit from within in the colour `c`: the cranium
 *  round, the face narrowing under the cheekbones to the jaw, which sits under the front of the skull; on the face two
 *  slanted eye sockets, a nose notch and a row of tooth nicks, dark, following its surface. */
function spectralSkull(c: string, s: number, drop: number): THREE.Group {
  const g = new THREE.Group(), R = 0.21 * s, dark = tone(c, '#03140c', 0.86);
  const lit = (m: M, col: string, opacity: number, glow: number) => { const lm = glassy(m, col, opacity).material as THREE.MeshLambertMaterial; lm.emissive = new THREE.Color(col); lm.emissiveIntensity = glow; return m; };
  // a point of the skull: `lon` round it from the front, `lat` up from its middle, `k` how far off its surface
  const skullAt = (lon: number, lat: number, k = 1): THREE.Vector3 => {
    const y = Math.sin(lat), x = Math.cos(lat) * Math.sin(lon), z = Math.cos(lat) * Math.cos(lon), t = clampTo((-0.12 - y) / 0.88, 0, 1);
    const wide = (1 - 0.36 * t ** 0.8) * (1 + 0.09 * Math.exp(-((y + 0.22) ** 2) / 0.02)); // (the cheekbones, then in to the jaw)
    return new THREE.Vector3(0.92 * x * wide, y < 0 ? -1.18 * (1 - (1 + y) ** 1.5) : 0.98 * y, (z > 0 ? z * (1 - 0.3 * t) : 1.12 * z * (1 - 0.8 * t)) + 0.08 * t).multiplyScalar(R * k);
  };
  const NLON = 24, NLAT = 14, pos: number[] = [];
  for (let i = 0; i <= NLAT; i++) for (let j = 0; j <= NLON; j++) { const q = skullAt(2 * Math.PI * j / NLON, -Math.PI / 2 + Math.PI * i / NLAT); pos.push(q.x, q.y, q.z); }
  g.add(lit(new THREE.Mesh(gridGeometry(pos, NLON + 1, NLAT), mat(c)), c, 0.72, 0.55));
  // the face's marks, flat on the skull: each a fan of points round a middle, given as (lon, lat)
  const mp: number[] = [], mi: number[] = [];
  const mark = (mid: [number, number], rim: [number, number][]) => {
    const o = mp.length / 3; for (const [lon, lat] of [mid, ...rim]) { const q = skullAt(lon, lat, 1.035); mp.push(q.x, q.y, q.z); }
    for (let i = 0; i < rim.length; i++) mi.push(o, o + 1 + i, o + 1 + (i + 1) % rim.length);
  };
  for (const sx of [-1, 1]) mark([sx * 0.44, -0.02], Array.from({ length: 14 }, (_, i) => { const a = 2 * Math.PI * i / 14, u = 0.23 * Math.cos(a), v = 0.18 * Math.sin(a); return [sx * (0.44 + u * Math.cos(0.35) + v * Math.sin(0.35)), -0.02 + u * Math.sin(0.35) - v * Math.cos(0.35)] as [number, number]; })); // (the sockets, their inner ends lower)
  mark([0, -0.36], [[0, -0.24], [-0.11, -0.46], [-0.03, -0.43], [0, -0.47], [0.03, -0.43], [0.11, -0.46]]); // (the nose: a notch pointing up)
  for (let i = -2; i <= 2; i++) { const lon = 0.15 * i, w = 0.022; mark([lon, -0.66], [[lon - w, -0.57], [lon - w, -0.75], [lon + w, -0.75], [lon + w, -0.57]]); } // (the nicks between the teeth)
  mark([0, -0.66], [[-0.42, -0.62], [-0.42, -0.66], [0, -0.68], [0.42, -0.66], [0.42, -0.62], [0, -0.64]]); // (the line of the mouth)
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mg.setIndex(mi); mg.computeVertexNormals();
  const marks = lit(new THREE.Mesh(mg, mat(dark)), dark, 0.88, 0.1); marks.renderOrder = 1; g.add(marks);
  // the smoke: from a thin foot it winds up, swelling, into the skull from below and behind; and a wisp curling off the crown
  const smoke = (mid: (t: number) => THREE.Vector3, rad: (t: number) => number, rows: number) => {
    const q: number[] = [], SEG = 8, up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, m = mid(t), d = mid(Math.min(1, t + 0.02)).sub(mid(Math.max(0, t - 0.02))).normalize(), ax = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize(), ay = new THREE.Vector3().crossVectors(d, ax);
      for (let j = 0; j <= SEG; j++) { const a = 2 * Math.PI * j / SEG; q.push(m.x + (ax.x * Math.cos(a) + ay.x * Math.sin(a)) * rad(t), m.y + (ax.y * Math.cos(a) + ay.y * Math.sin(a)) * rad(t), m.z + (ax.z * Math.cos(a) + ay.z * Math.sin(a)) * rad(t)); }
    }
    return lit(new THREE.Mesh(gridGeometry(q, SEG + 1, rows), mat(c)), c, 0.36, 0.5);
  };
  g.add(smoke((t) => new THREE.Vector3(0.09 * s * Math.sin(5.2 * t) * (1 - 0.7 * t), -drop + (drop - 0.2 * s) * t, 0.07 * s * Math.sin(3.9 * t + 0.6) * (1 - t) - 0.06 * s * t), (t) => (0.022 + 0.1 * t ** 1.6) * s, 16));
  g.add(smoke((t) => new THREE.Vector3(-0.05 * s - 0.1 * s * Math.sin(2.6 * t), 0.17 * s + 0.26 * s * t, -0.12 * s - 0.1 * s * t + 0.07 * s * Math.sin(4 * t)), (t) => (0.05 * (1 - t) ** 0.8 + 0.006) * s, 10));
  return g;
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
function sheath(prof: [number, number][], c: string, o: { zs: number; slitAt: number; slitTop: number; slitW: number; flareFrom: number; folds: number; amp: number; train: number;
  /** Its top edge drawn in to a waist (the point of it at an angle), the cloth easing out to its own line over `over` below. */
  fit?: { at: (th: number) => THREE.Vector3; over: number };
  /** Ragged dags this deep cut into the hem, and nicks in the slit's edges. */
  dag?: number }) {
  const rows = 44, cols = 64, top = prof[0][0], hem = prof[prof.length - 1][0];
  const radius = (y: number) => { const pp = prof.slice().reverse(); return radiusAt(pp, y); };
  const point = (y: number, u: number, k = 1) => {
    const open = y < o.slitTop ? o.slitW * Math.pow((o.slitTop - y) / (o.slitTop - hem), 0.8) : 0;
    const th = o.slitAt + open / 2 + u * (Math.PI * 2 - open), fl = Math.max(0, (o.flareFrom - y) / (o.flareFrom - hem));
    const r = radius(y) * k * (1 + o.amp * fl * fl * Math.sin(o.folds * th)) * (1 + o.train * fl * fl * Math.max(0, -Math.cos(th)));
    const p = new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r * o.zs);
    if (o.fit && y > top - o.fit.over) { p.lerp(o.fit.at(th), (1 - (top - y) / o.fit.over) ** 2); }
    return p;
  };
  // the dags: how far up each column's hem is cut. Uneven tatters: each a tongue of cloth two to six columns wide with a
  // rounded tip, its width, how far its tip stops short of the hem and how deep the cut beside it goes all drawn from
  // a hash of the column it starts at (whole by both edges of the slit); and how far in each row of the slit's edges is nicked
  const hash = (j: number, k: number) => { const x = Math.sin(j * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const cuts = new Array<number>(cols + 1).fill(0);
  for (let j = 2; o.dag && j < cols - 2;) {
    const w = Math.min(cols - 2 - j, 2 + Math.floor(hash(j, 1) ** 1.5 * 5)), short = 0.3 * hash(j, 2) ** 2, deep = 0.3 + 0.7 * hash(j, 3);
    for (let k = 0; k <= w; k++) cuts[j + k] = Math.max(cuts[j + k], o.dag * (short + Math.max(0, deep - short) * Math.abs(2 * k / w - 1) ** 3));
    j += Math.max(1, w);
  }
  const cut = (j: number) => cuts[j], nick = (i: number) => o.dag && i % 3 === 1 ? 0.004 + 0.006 * Math.abs(Math.sin(i * 7.31)) : 0;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = top + (hem - top) * i / rows, slit = y < o.slitTop ? nick(i) : 0;
    for (let j = 0; j <= cols; j++) { const p = point(y + cut(j) * Math.max(0, i - rows + 3) / 3, j === 0 ? slit : j === cols ? 1 - slit : j / cols); pos.push(p.x, p.y, p.z); }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { mesh: sm(g, c, true), point, cut: (u: number) => { const fc = Math.max(0, Math.min(1, u)) * cols, j = Math.min(cols - 1, Math.floor(fc)); return cut(j) + (cut(j + 1) - cut(j)) * (fc - j); } };
}

/** A grid of points to a mesh: `rows` + 1 rows of `cols` (row-major, the first row at the top), as kit/cloth.ts hangs. */
function gridGeometry(pos: number[], cols: number, rows: number): THREE.BufferGeometry {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A capelet over the shoulders: its neckline low on the shoulders round the base of the neck (so the neck shows) and
 *  dipping to a V where it opens down the front, the cloth running out over the shoulders and down over the tops of the
 *  arms. CAPE_ROWS + 1 rows of DRAPE_COLS, the neckline first; angles from the front round through +x. `gap` is how
 *  wide it stands open at the front (radians). */
const CAPE_ROWS = 14, CAPE_GAP = 0.34;
function capelet(tr: Ring[], fr: Frame, s: number, c: string, gap = CAPE_GAP): M {
  const pos: number[] = [], yN = 2.15, yH = 1.45;
  const half = fr.shoulderX + 0.3 * fr.arm + 0.08;
  const front = Math.max(ringAt(tr, 1.6).f, ringAt(tr, 1.75).f) + fr.bust * 0.95 + 0.1, back = Math.max(ringAt(tr, 1.6).b, ringAt(tr, 1.85).b) + 0.12;
  for (let i = 0; i <= CAPE_ROWS; i++) {
    const t = i / CAPE_ROWS, out = Math.sin(t * Math.PI / 2), drop = 1 - Math.cos(t * Math.PI / 2);
    for (let j = 0; j < DRAPE_COLS; j++) {
      const th = gap / 2 + (Math.PI * 2 - gap) * j / (DRAPE_COLS - 1), cs = Math.cos(th), y0 = yN + 0.02 - 0.2 * Math.max(0, cs) ** 6;
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

/** A thin cord through points (a lace, a thong, a seam of boning): square in section, four points round each. */
function cord(pts: THREE.Vector3[], r: number, c: string): M {
  const pos: number[] = [], idx: number[] = [], t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  pts.forEach((p, i) => {
    t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
    a.set(0, 1, 0); if (Math.abs(t.y) > 0.9) a.set(1, 0, 0);
    a.cross(t).normalize(); b.crossVectors(t, a);
    for (let k = 0; k < 4; k++) { const an = (k + 0.5) * Math.PI / 2, ca = Math.cos(an) * r, sa = Math.sin(an) * r; pos.push(p.x + a.x * ca + b.x * sa, p.y + a.y * ca + b.y * sa, p.z + a.z * ca + b.z * sa); }
  });
  for (let i = 0; i + 1 < pts.length; i++) for (let k = 0; k < 4; k++) { const p0 = i * 4 + k, p1 = i * 4 + (k + 1) % 4; idx.push(p0, p1, p0 + 4, p1, p1 + 4, p0 + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return sm(g, c);
}
/** Laces crossing between two rows of eyelets, `n` crossings: `eye(side, i)` is an eyelet (side -1 or 1, i from 0 to
 *  `n`) and `mid(i)` the surface between the rows where the two strands cross above eyelet i. */
function lacing(eye: (side: number, i: number) => THREE.Vector3, mid: (i: number) => THREE.Vector3, n: number, r: number, c: string): M[] {
  return [0, 1].map((k) => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= n; i++) { pts.push(eye((i + k) % 2 ? 1 : -1, i)); if (i < n) pts.push(mid(i)); } return cord(pts, r, c); });
}
/** A full blouse sleeve on a bare-shouldered arm, in the upper arm's frame (`sx` the arm's side): gathered in a band
 *  below the shoulder, ballooning from there (most to the outside, little against the body) and sagging toward the
 *  elbow, gathered again just above it and ending in a frill, shorter in the crook of the elbow than behind it. Two
 *  meshes, the sleeve and the frill's inner face, each one-sided: a body laid out rests on its sleeves as on its arms
 *  (see restsOn). */
function fullSleeve(fr: Frame, sx: number, s: number, c: string): M[] {
  const rings = upperArmRings(fr, sx), cols = 33, pos: number[] = [];
  // each row: its height on the arm, how far it stands off the arm, and how much of the puff's fullness it has
  const rows: [number, number, number][] = [[-0.25, 0.012, 0], [-0.275, 0.05, 0], [-0.31, 0.055, 0], [-0.34, 0.03, 0.12], [-0.4, 0.03, 0.55], [-0.48, 0.03, 0.85], [-0.58, 0.03, 1], [-0.67, 0.03, 1], [-0.75, 0.03, 0.8], [-0.81, 0.03, 0.4], [-0.845, 0.028, 0.08], [-0.87, 0.03, 0]];
  const row = (y: number, out: (th: number) => number) => {
    const r = ringAt(rings, y);
    for (let j = 0; j < cols; j++) { const th = (j / (cols - 1)) * Math.PI * 2, [x, z] = ringPoint(r, th), o = out(th); pos.push((x + Math.sin(th) * o) * s, y * s, (z + Math.cos(th) * o) * s); }
  };
  for (const [y, off, full] of rows) row(y, (th) => off + full * 0.15 * (0.6 + 0.4 * sx * Math.sin(th)) * (1 + 0.1 * Math.sin(12 * th + 1)));
  for (let i = 1; i <= 3; i++) { // the frill: flaring and waving more toward its edge, shorter and closer in the crook of the elbow
    const t = i / 3, r = ringAt(rings, -0.87);
    for (let j = 0; j < cols; j++) {
      const th = (j / (cols - 1)) * Math.PI * 2, [x, z] = ringPoint(r, th), front = Math.cos(th), o = 0.03 + (0.09 - 0.035 * front) * t ** 0.8 + (0.028 - 0.012 * front) * t * Math.sin(9 * th), len = 0.13 - 0.05 * front;
      pos.push((x + Math.sin(th) * o) * s, (-0.87 - len * t) * s, (z + Math.cos(th) * o) * s);
    }
  }
  const from = pos.length - 4 * cols * 3; row(-0.87, () => 0.004); // (the inner face starts on the arm, closing the gather)
  const inner = gridGeometry([...pos.splice(from + 4 * cols * 3), ...pos.slice(from)], cols, 4); inner.setIndex([...inner.index!.array].reverse()); inner.computeVertexNormals();
  return [sm(gridGeometry(pos, cols, rows.length + 2), c), sm(inner, c)];
}

/** Points on the outer face of a hung garment: as clothPoint, `off` proud of the cloth, but on a body laid out (`up`:
 *  the way off the floor, in the garment's frame) the outer face of cloth lying flat is the one turned up. */
type ClothFace = (u: number, t: number, off?: number) => THREE.Vector3;
function clothFace(G: Garment, up?: THREE.Vector3): ClothFace {
  return (u, t, off = 0) => {
    const p = clothPoint(G, u, t); if (!off) return p;
    const n = clothPoint(G, u, t, 1).sub(p);
    if (up && Math.abs(n.dot(up)) > 0.3 && n.dot(up) < 0) n.negate();
    return p.addScaledVector(n, off);
  };
}
/** The underskirt's lace under a dagged gown: it hangs inside the cloth to the full hem and a scalloped edge beyond, so
 *  it shows between the dags (`cut(u)`: how far up the hem is cut at u), and peeps out along each edge of the slit
 *  from `slitT` down, turned out from the leg. Where the cloth meets the floor the lace lies on it (`offFloor` lifts a
 *  point that would pass under it) and folds in under the cloth: it neither spreads past a hem that lies on the floor
 *  (`height`: how far over it a point is) nor turns out from an edge that does. */
function lace(on: ClothFace, c: string, s: number, slitT: number, cut: (u: number) => number, offFloor: (p: THREE.Vector3) => THREE.Vector3, height: (p: THREE.Vector3) => number): M {
  const N = 128, pos: number[] = [], inside = -0.014 * s;
  // (lace the floor stops does not spread flat over it: as far as a point is lifted it is drawn back toward the cloth's
  // edge it hangs from, so it folds in under the hem)
  const fold = (p: THREE.Vector3, edge: THREE.Vector3) => { const p0 = p.clone(), up = offFloor(p).distanceTo(p0); if (up > 1e-6) { const back = offFloor(edge).sub(p), l = back.length(); if (l > 1e-6) p.addScaledVector(back, Math.min(1, up / l)); } return p; };
  for (const t of [0.9, 0.94]) for (let i = 0; i <= N; i++) { const p = offFloor(on(i / N, t, inside)); pos.push(p.x, p.y, p.z); }
  for (const [ext, wave] of [[0, 0], [0.035, 0.5], [0.08, 1]]) for (let i = 0; i <= N; i++) {
    const u = i / N, h = on(u, 1, inside), along = on(u, 1).sub(on(u, 0.94)).normalize(), out = on(u, 1, 1).sub(on(u, 1)), ph = 24 * u * Math.PI * 2, hung = clampTo(height(h) / (0.12 * s), 0, 1);
    fold(h.addScaledVector(along, cut(u) + hung * (ext - wave * 0.03 * Math.abs(Math.sin(ph * 1.5))) * s).addScaledVector(out, hung * wave * 0.035 * s * Math.sin(ph)), on(u, 0.97, inside));
    pos.push(h.x, h.y, h.z);
  }
  const hem = sm(gridGeometry(pos, N + 1, 4), c, true);
  for (const u of [0, 1]) { // along the slit: from under the cloth, past its edge and out
    const rows = 40, sp: number[] = [], inU = u ? 0.975 : 0.025;
    for (const [k, lift] of [[0, 0], [1, 0], [1.9, 0.5], [2.6, 1]]) for (let i = 0; i <= rows; i++) {
      const t = slitT + (1 - slitT) * i / rows, a = on(inU, t, inside), e = on(u, t, inside), across = e.clone().sub(a).normalize(), out = on(u, t, 1).sub(on(u, t)), fade = Math.min(1, i / 4) * clampTo(height(e) / (0.12 * s), 0, 1);
      const p = fold(a.lerp(e, Math.min(1, k)).addScaledVector(across, Math.max(0, k - 1) * 0.045 * s * fade).addScaledVector(out, lift * (0.035 + 0.012 * Math.sin(i * 2.1)) * s * fade), e.clone());
      sp.push(p.x, p.y, p.z);
    }
    hem.add(sm(gridGeometry(sp, rows + 1, 3), c, true));
  }
  return hem;
}
/** Embroidery on a hung garment: flat stitches lying `off` proud of the cloth, gathered into one mesh. `stem` runs a
 *  ribbon `w` wide through points given as [u, t] on the cloth; `leaf` lays a pointed leaf from [u, t] toward [u2, t2],
 *  `len` long and `w` wide. */
function embroider(on: ClothFace, off: number) {
  const pos: number[] = [], idx: number[] = [], d = new THREE.Vector3(), side = new THREE.Vector3();
  const normalAt = (u: number, t: number) => on(u, t, 1).sub(on(u, t));
  const stem = (uv: [number, number][], w: number) => {
    const P = uv.map(([u, t]) => on(u, t, off)), base = pos.length / 3;
    P.forEach((p, i) => { d.copy(P[Math.min(i + 1, P.length - 1)]).sub(P[Math.max(i - 1, 0)]).normalize(); side.crossVectors(d, normalAt(uv[i][0], uv[i][1])).normalize().multiplyScalar(w / 2); pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z); });
    for (let i = 0; i + 1 < P.length; i++) { const a = base + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const leaf = (u: number, t: number, u2: number, t2: number, len: number, w: number) => {
    const p = on(u, t, off), base = pos.length / 3;
    d.copy(on(u2, t2, off)).sub(p).normalize(); side.crossVectors(d, normalAt(u, t)).normalize().multiplyScalar(w / 2);
    const mid = p.clone().addScaledVector(d, len * 0.45), tip = p.clone().addScaledVector(d, len);
    pos.push(p.x, p.y, p.z, mid.x - side.x, mid.y - side.y, mid.z - side.z, mid.x + side.x, mid.y + side.y, mid.z + side.z, tip.x, tip.y, tip.z);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };
  const mesh = (c: string): M => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return sm(g, c, true); };
  return { on, stem, leaf, mesh };
}
/** A vine embroidered on a hung garment from [u, t] `a` to `b`: a stem winding from side to side of that line, a leaf
 *  on the outside of each bend and a smaller one inside it, and a curled tendril at every other bend. */
function vine(E: ReturnType<typeof embroider>, a: [number, number], b: [number, number], s: number): void {
  // feet to a unit of u and of t about the middle of the line, so the stitches keep their size wherever the cloth is wide or narrow
  const mu = (a[0] + b[0]) / 2, mt = (a[1] + b[1]) / 2, su = E.on(mu + 0.01, mt).distanceTo(E.on(mu - 0.01, mt)) / 0.02, st = E.on(mu, mt + 0.01).distanceTo(E.on(mu, mt - 0.01)) / 0.02;
  const ax = (b[0] - a[0]) * su, ay = (b[1] - a[1]) * st, len = Math.hypot(ax, ay), bends = Math.max(2, Math.round(len / (0.26 * s))), amp = 0.04 * s;
  // a point `x` along the line (0 to 1) and `y` feet to its side
  const at2 = (x: number, y: number): [number, number] => [a[0] + (b[0] - a[0]) * x - ay / len * y / su, a[1] + (b[1] - a[1]) * x + ax / len * y / st];
  const stem: [number, number][] = []; for (let i = 0; i <= bends * 5; i++) { const x = i / (bends * 5); stem.push(at2(x, amp * Math.sin(x * bends * Math.PI))); }
  E.stem(stem, 0.02 * s);
  for (let k = 0; k < bends; k++) {
    const x = (k + 0.5) / bends, sd = k % 2 ? -1 : 1, dx = 0.05 * s / len, [u, t] = at2(x, sd * amp);
    E.leaf(u, t, ...at2(x + dx, sd * (amp + 0.07 * s)), 0.11 * s, 0.055 * s);
    E.leaf(...at2(x - 0.6 * dx, sd * amp * 0.8), ...at2(x - 2 * dx, sd * (amp + 0.05 * s)), 0.07 * s, 0.04 * s);
    if (k % 2 === 0) continue;
    const curl: [number, number][] = []; for (let i = 0; i <= 8; i++) { const th = i * 0.62, r = (0.05 - 0.0045 * i) * s; curl.push(at2(x + (0.9 * dx * len + r * Math.sin(th)) / len, -sd * (r * Math.cos(th) - 0.01 * s))); }
    E.stem(curl, 0.013 * s);
  }
}
/** A skirt hung from a corset's foot leaves it downward all the way round: where a hip thrown out to the side has
 *  turned its first rows up past the foot (a flange standing beside the corset), they are brought down to fall away
 *  from it, each row at least a little below the one above along the skirt's own way down. */
function settleTop(G: Garment): void {
  const p = G.mesh.geometry.attributes.position as THREE.BufferAttribute, a = new THREE.Vector3(), b = new THREE.Vector3(), down = new THREE.Vector3(), ROWS = 6;
  for (let j = 0; j < G.cols; j++) { down.add(a.fromBufferAttribute(p, ROWS * G.cols + j)).sub(b.fromBufferAttribute(p, j)); }
  down.normalize();
  for (let j = 0; j < G.cols; j++) for (let i = 1; i < ROWS; i++) {
    const k = i * G.cols + j, d = a.fromBufferAttribute(p, k).sub(b.fromBufferAttribute(p, k - G.cols)).dot(down);
    if (d < 0.012) { a.fromBufferAttribute(p, k).addScaledVector(down, 0.012 - d); p.setXYZ(k, a.x, a.y, a.z); }
  }
  p.needsUpdate = true; G.mesh.geometry.computeVertexNormals();
}
/** The belt a corseted gown's skirt hangs from: leather along the top of the hung cloth, its buckle at the front (`uFront`
 *  on the cloth) with the strap's end hanging from it, and the corset's vials on thongs at the left hip: each hangs
 *  from its own place on the belt the way things fall (`fall`, in the parent's frame), free where that takes it clear
 *  of the cloth and lying on the cloth where the hip stands out under it; on a body `laid` out thong and vial lie on
 *  the cloth along the fall, on top of every fold of what is worn there and beside one another (placed once all the
 *  cloth has settled: `settled` runs a step then, with the points of all of it in the parent's frame). `clear` lifts a
 *  point to stand a given height off the floor; `worn` is the cloth's own outer face, whichever way it is turned. */
function corsetBelt(on: ClothFace, worn: ClothFace, parent: THREE.Object3D, s: number, o: NonNullable<HeroFigure['corset']>, uFront: number, fall: THREE.Vector3, laid: boolean, clear: (p: THREE.Vector3, r: number) => THREE.Vector3, settled: (fn: (cloth: THREE.Vector3[]) => void) => void): void {
  const dark = tone(o.color, '#000000', 0.32), bc = o.buckle ?? '#9a9ea6', N = 64, pos: number[] = [], Z = new THREE.Vector3(0, 0, 1);
  // (it is one loop: it runs on from the cloth's last column to its first, across where the skirt's two edges part below it)
  for (const [t, off] of [[0, 0.004], [0.004, 0.03], [0.03, 0.034], [0.034, 0.008]]) for (let i = 0; i <= N + 1; i++) { const p = on((i % (N + 1)) / N, t, off * s); pos.push(p.x, p.y, p.z); }
  parent.add(sm(gridGeometry(pos, N + 2, 3), dark, true));
  // (a piece set on the cloth at [u, t]: its face along the cloth's normal there)
  const set = (u: number, t: number, off: number) => { const g = new THREE.Group(); g.position.copy(on(u, t, off * s)); g.quaternion.setFromUnitVectors(Z, on(u, t, 1).sub(on(u, t))); parent.add(g); return g; };
  set(uFront, 0.017, 0.045).add(box(0.15 * s, 0.14 * s, 0.022 * s, bc), box(0.095 * s, 0.09 * s, 0.026 * s, dark), at(box(0.1 * s, 0.018 * s, 0.03 * s, bc), -0.015 * s, 0, 0.004 * s));
  set(uFront + 0.022, 0.06, 0.02).add(box(0.07 * s, 0.24 * s, 0.014 * s, dark)); // the strap's end, tucked down behind the belt
  const E = 0.008, ds = 0.03 * s, gt = new THREE.Vector3(), dir = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), fallen: { line: THREE.Vector3[]; top: THREE.Vector3; mid: THREE.Vector3; out: THREE.Vector3; ways: THREE.Vector3[]; put: () => void }[] = [];
  (o.vials ?? []).slice(0, 4).forEach((c, i) => {
    // (down the cloth from the belt, a step at a time: the way of the fall along the cloth there, kept where the cloth lies level)
    let u = 0.02 + i * 0.042, tt = 0.035; const nCord = Math.round((0.24 + (i % 2) * 0.09) * s / ds), line: THREE.Vector3[] = [worn(u, 0.03, 0.03 * s)], foot: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
    dir.copy(worn(u, tt + E)).sub(worn(u, tt)).normalize();
    for (let k = 0; k <= nCord + 4; k++) {
      const p = worn(u, tt), n = worn(u, tt, 1).sub(p), su = worn(Math.min(1, u + E), tt).sub(worn(Math.max(0, u - E), tt)).multiplyScalar(0.5 / E), st = worn(u, Math.min(1, tt + E)).sub(worn(u, tt - E)).multiplyScalar(0.5 / E);
      foot.push(p); nrm.push(n);
      gt.copy(fall).addScaledVector(n, -fall.dot(n)); if (gt.length() > 0.25) dir.copy(gt).normalize(); else dir.addScaledVector(n, -dir.dot(n)).normalize();
      const a = su.dot(su), b = su.dot(st), d = st.dot(st), e = su.dot(dir) * ds, g = st.dot(dir) * ds, det = a * d - b * b; if (det < 1e-12) break;
      u = clampTo(u + (e * d - g * b) / det, 0.002, 0.998); tt = clampTo(tt + (g * a - e * b) / det, 0.03, 0.98);
    }
    // (a point of the hanging line, `off` clear of the cloth: on one standing, straight down from the point before it
    // where that is clear of the cloth, lying on the cloth where it is not)
    const hang = (k: number, off: number, from: THREE.Vector3, len: number) => {
      const q = foot[Math.min(k, foot.length - 1)].clone().addScaledVector(nrm[Math.min(k, foot.length - 1)], off);
      if (!laid) { const free = from.clone().addScaledVector(fall, len); if (free.clone().sub(q).dot(nrm[Math.min(k, foot.length - 1)]) > 0) q.copy(free); }
      return clear(q, off);
    };
    for (let k = 1; k < nCord; k++) line.push(hang(k, 0.02 * s, line[line.length - 1], ds));
    const top = hang(nCord, 0.05 * s, line[line.length - 1], ds), mid = hang(nCord + 4, 0.085 * s, top, 0.11 * s);
    const put = () => {
      const v = new THREE.Group(), glass = sph(0.07 * s, c, 10, 8), thong = cord([...line, top], 0.01 * s, dark);
      v.position.copy(top); v.quaternion.setFromUnitVectors(Y, top.clone().sub(mid).normalize()); v.userData.part = 'vial'; thong.userData.part = 'thong';
      glass.scale.y = 1.3; v.add(at(glass, 0, -0.11 * s, 0), at(cyl(0.028 * s, 0.028 * s, 0.1 * s, c, 6), 0, -0.02 * s, 0), at(cyl(0.034 * s, 0.034 * s, 0.05 * s, '#8a6a4a', 6), 0, 0.045 * s, 0));
      parent.add(v, thong);
    };
    if (laid) fallen.push({ line, top, mid, out: nrm[Math.min(nCord + 2, nrm.length - 1)].clone(), ways: line.map((_, k) => nrm[Math.min(k, nrm.length - 1)]), put }); else put();
  });
  // on a body laid out, once all its cloth has settled: the vials lie side by side the one way, their corks toward the
  // belt, each glass and cork stood off the cloth there (the way the cloth faces, `out`) clear of every fold of it
  // under them, and each thong on the cloth
  if (fallen.length) settled((cloth) => {
    const out = new THREE.Vector3(), d = new THREE.Vector3(), axis = new THREE.Vector3(), side = new THREE.Vector3();
    for (const v of fallen) out.add(v.out); out.normalize();
    const onTop = (p: THREE.Vector3, r: number, off: number, way = out) => {
      let h = -Infinity;
      for (const q of cloth) { const hq = d.subVectors(q, p).dot(way); if (hq > -0.25 * s && hq < 0.3 * s && d.lengthSq() - hq * hq < r * r) h = Math.max(h, hq); }
      return h + off > 0 ? p.addScaledVector(way, h + off) : p;
    };
    for (const v of fallen) axis.add(v.line[0]).sub(v.mid);
    axis.addScaledVector(out, -axis.dot(out)); if (axis.lengthSq() < 1e-9) axis.set(0, 1, 0).addScaledVector(out, -out.y);
    axis.normalize(); side.crossVectors(out, axis).normalize();
    // (side by side: a vial's width and more from each to the next, across the way they lie)
    const row = fallen.slice().sort((v, w) => v.mid.dot(side) - w.mid.dot(side));
    for (let i = 1; i < row.length; i++) { const gap = row[i].mid.dot(side) - row[i - 1].mid.dot(side); if (gap < 0.19 * s) row[i].mid.addScaledVector(side, 0.19 * s - gap); }
    for (const v of fallen) {
      clear(onTop(v.mid, 0.13 * s, 0.1 * s), 0.1 * s);
      v.top.copy(v.mid).addScaledVector(axis, 0.11 * s); clear(onTop(v.top, 0.07 * s, 0.05 * s), 0.05 * s);
      v.top.sub(v.mid).setLength(0.11 * s).add(v.mid);
      // (the thong: its length from the belt, short of the vial itself, then to the cork)
      while (v.line.length > 1 && (v.line[v.line.length - 1].distanceTo(v.mid) < 0.14 * s || d.subVectors(v.line[v.line.length - 1], v.top).dot(axis) < 0.03 * s)) v.line.pop();
      for (let k = 1; k < v.line.length; k++) clear(onTop(v.line[k], 0.06 * s, 0.025 * s, v.ways[k]), 0.025 * s);
      // (and on to the cork over the cloth between: points of that stretch, stood off the cloth as the vial is)
      const last = v.line[v.line.length - 1].clone(), n = Math.floor(last.distanceTo(v.top) / (0.04 * s));
      for (let k = 1; k < n; k++) v.line.push(clear(onTop(last.clone().lerp(v.top, k / n), 0.06 * s, 0.025 * s), 0.025 * s));
      v.put();
    }
  });
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
  neck.add(loft(neckRings(fr), skin, { seg: 16 }));
  if (!fr.fem) neck.add(at(sph(0.035 * s, skin, 8, 6), 0, 0.2 * s, 0.155 * s)); // the larynx
  const head = new THREE.Group(); head.position.y = 0.21 * s; head.name = 'head'; neck.add(head);
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
      if (gown && f.fullSleeves) root.add(...fullSleeve(fr, sx, s, f.sleeves));
      else if (gown) { // off the shoulder: a gathered band round the upper arm with a ruffle below it
        const band = sm(new THREE.TorusGeometry(0.2 * s * a, 0.045 * s, 8, 20), f.sleeves); band.rotation.x = Math.PI / 2; root.add(at(band, 0, -0.36 * s, 0));
        const ruf = drape(0.2 * s * a, 0.3 * s * a, 0.3 * s, f.sleeves, { folds: 9, amp: 0.25, jag: 0.04 * s, seed: 1.3 }); root.add(at(ruf, 0, -0.52 * s, 0));
      } else { const puff = sph(0.25 * s * a, f.sleeves); puff.scale.set(1.05, 1.3, 1.05); root.add(at(puff, -sx * 0.04 * s, -0.36 * s, 0)); }
    }
    // the elbow: no ball; the forearm starts where the upper arm ends, and the two bend as one (see bendLimb)
    const mid = new THREE.Group(); mid.position.set(0, -1.12 * s, 0); mid.rotation.x = -0.22; mid.name = 'elbow' + side; root.add(mid);
    const lower = loft(clipRings(forearmRings(fr), -1.04, 0), lowerC, { seg: 14, rows: 24 }); mid.add(lower);
    if (f.rolled && f.rolledLow) {
      // the sleeve comes down over the elbow and bends with it; its roll sits round the forearm just below the bend, two
      // soft turns with a fold's shadow under them
      const sc = f.sleeves ?? cloth, fa = forearmRings(fr);
      mid.add(sm(loftGeometry(clipRings(fa, -0.35, 0), s, { seg: 14, rows: 10, k: 1.05 }), sc));
      for (const [y, h, k, c] of [[-0.25, 0.085, 1.3, sc], [-0.325, 0.075, 1.25, sc], [-0.372, 0.03, 1.13, tone(sc, '#000000', 0.3)]] as const) { const r = ringAt(fa, y); mid.add(sm(loftGeometry([{ ...r, y: y - h / 2 }, { ...r, y: y - h / 4, w: r.w * 1.04, f: r.f * 1.04, b: r.b * 1.04 }, { ...r, y: y + h / 4, w: r.w * 1.04, f: r.f * 1.04, b: r.b * 1.04 }, { ...r, y: y + h / 2 }], s, { seg: 14, k, rows: 3 }), c)); }
    } else if (f.rolled) { const sc = f.sleeves ?? cloth; mid.add(band(forearmRings(fr), -0.2, 0.13, 1.28, sc, 14)); mid.add(band(forearmRings(fr), -0.3, 0.07, 1.22, tone(sc, '#000000', 0.25), 14)); mid.add(band(forearmRings(fr), -0.1, 0.06, 1.2, tone(sc, '#ffffff', 0.1), 14)); } // the rolled cuff, in turns
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
    if (f.bracers && f.bracerLaces) { // the bracer's laces, crossing up the inside of the forearm from the wrist
      const fa = forearmRings(fr), on = (th: number, y: number, k: number) => { const [x, z] = ringPoint(ringAt(fa, y), th, k); return new THREE.Vector3(x * s, y * s, z * s); };
      mid.add(...lacing((side, i) => on(side * 0.5, -0.9 + i * 0.085, 1.09), (i) => on(0, -0.9 + (i + 0.5) * 0.085, 1.12), 6, 0.011 * s, f.bracerLaces));
    }
    arm.push({ root, mid, end, upper, lower, hand, collar, hs });

    const hx = gown ? 0.21 : fr.hipX, legC = gown ? skin : trim;
    const hip = new THREE.Group(); hip.position.set(sx * hx * s, 0, 0); hip.rotation.z = sx * 0.04; hip.name = 'hip' + side; pel.add(hip);
    const thigh = loft(thighRings(fr), legC, { seg: 16, rows: 32 }); hip.add(thigh);
    // the knee, as the elbow: the shin starts where the thigh ends and the two bend as one
    const knee = new THREE.Group(); knee.position.set(0, -THIGH * s, 0); knee.name = 'knee' + side; hip.add(knee);
    const shin = loft(clipRings(shinRings(fr), -SHIN, 0), legC, { seg: 14, rows: 28 }); knee.add(shin);
    // boots: the shaft to below the knee with a turned cuff, the foot, a heel and a sole
    knee.add(loft(clipRings(shinRings(fr), -SHIN, -0.55), boot, { seg: 14, k: 1.13 }));
    const cuffR = ringAt(shinRings(fr), -0.55); if (!f.bootLaces) knee.add(sm(loftGeometry([{ ...cuffR, y: -0.65 }, { ...cuffR, y: -0.47 }], s, { seg: 14, k: 1.28, rows: 2 }), tone(boot, '#ffffff', 0.08)));
    for (const y of f.bootLaces ? [] : [-SHIN + 0.4]) { // a boot strap, buckled on the outside
      knee.add(band(shinRings(fr), y, 0.05, 1.2, tone(boot, '#000000', 0.4), 14));
      knee.add(at(box(0.03 * s, 0.07 * s, 0.07 * s, '#a9adb6'), sx * ringAt(shinRings(fr), y).w * 1.22 * s, y * s, 0.02 * s));
    }
    if (f.bootLaces) { // tall boots: the shaft on up to just below the knee under a rolled top, laced up the shin from the instep
      const sr = shinRings(fr), top = -0.24, y0 = -SHIN + 0.16, n = 8, dy = (top - 0.07 - y0) / n, on = (th: number, y: number, k: number) => { const [x, z] = ringPoint(ringAt(sr, y), th, k); return new THREE.Vector3(x * s, y * s, z * s); };
      knee.add(loft(clipRings(sr, -0.56, top), boot, { seg: 14, k: 1.13 }));
      knee.add(band(sr, top, 0.06, 1.18, tone(boot, '#000000', 0.25), 14));
      knee.add(...lacing((sd, i) => on(sd * 0.42, y0 + i * dy, 1.17), (i) => on(0, y0 + (i + 0.5) * dy, 1.2), n, 0.012 * s, f.bootLaces));
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
  return { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig, hem, seatBump, chestBump };
}

/** A hero's miniature: origin at the floor centre, feet in world units, facing +z. `battle` puts it in its stance. */
export function heroFigure(f: HeroFigure, size: CreatureSize = 'medium', state: boolean | 'rest' | 'battle' | 'dead' = false): THREE.Group {
  const battle = state === true || state === 'battle', dead = state === 'dead';
  const s = (SIZE_SCALE[size] ?? 1) * (f.height ?? 1);
  const gown = !!(f.skirt && f.underskirt);
  const { body, pel, up, neck, head, arm, leg, soles, fr, tr, bustWarp, bustJig, hem, seatBump, chestBump } = rig(f, s, gown);
  const hy = 2.82 * s; // the head's centre, in the upper body's frame
  const skin = f.skin ?? '#d9b899';
  const headAt = neck.position.y + head.position.y; // the head joint, in the upper body's frame
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
  const harness: M[] = []; // an engraved harness's own pieces: on a body laid out none of them goes down through the floor
  const afterHung: (() => void)[] = []; // steps that wait for all the cloth to have hung (a trinket laid on top of it)
  const wear = (name: string, m: M, parent: THREE.Object3D, cols: number, rows: number, o: Omit<Garment, 'name' | 'mesh' | 'cols' | 'rows' | 'axis'> & { axis?: [number, number] }): Garment => {
    if (m.parent !== parent) parent.add(m);
    m.updateMatrix(); m.geometry.applyMatrix4(m.matrix); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    m.userData.garment = name; m.userData.layer = o.layer; if (o.stiff) m.userData.plate = true; // (kit/clothcheck.ts reads a plate under what is worn over it)
    const { axis, ...rest } = o, g: Garment = { name, mesh: m, cols, rows, axis: new THREE.Vector3(axis?.[0] ?? 0, 0, axis?.[1] ?? 0), ...rest };
    garments.push(g); return g;
  };
  const LEGS = ['thighR', 'thighL', 'shinR', 'shinL'], FEET = ['footR', 'footL'], ARMS = ['upperArmR', 'upperArmL', 'forearmR', 'forearmL'], HANDS = ['handR', 'handL'], LOWER_ARMS = ['forearmR', 'forearmL', ...HANDS];
  // the tunic's skirt: over the thighs (a lifted knee tents it) and over a foot drawn up under it (a body fallen on its
  // knees), inside a hand resting on the hip
  if (hem) wear('hem', hem, up, DRAPE_COLS, HEM_ROWS + 1, { closed: true, covers: ['torso', 'pelvis', ...LEGS, ...FEET], outside: LOWER_ARMS, layer: 0, clear: 0.035 * s, spread: 5, hang: 0.8 });
  // (held by the grip below the guard: the index finger and the thumb close under it, not into it)
  if (f.weapon === 'sword') gR.add(at(box(0.12 * s, 2.6 * s, 0.32 * s, '#c8ccd2'), 0, 1.57 * s, 0), at(box(0.7 * s, 0.12 * s, 0.14 * s, '#a07a3a'), 0, 0.27 * s, 0), at(box(0.12 * s, 0.5 * s, 0.12 * s, '#3b2a20'), 0, -0.03 * s, 0));
  if (f.weapon === 'spear') gR.add(at(box(0.12 * s, 7 * s, 0.12 * s, '#3b2a20'), 0, 0.85 * s, 0), at(cone(0.2 * s, 0.8 * s, '#c8ccd2'), 0, 4.75 * s, 0));
  if (f.weapon === 'staff') gR.add(at(box(0.14 * s, 6 * s, 0.14 * s, '#3b2a20'), 0, 0.45 * s, 0));
  if (f.weapon === 'torch') gR.add(at(box(0.14 * s, 1.6 * s, 0.14 * s, '#3b2a20'), 0, 0.55 * s, 0), at(sph(0.32 * s, '#f0a040'), 0, 1.55 * s, 0));

  // face extras
  if (f.earrings) for (const sx of [-1, 1]) { const e = sph(0.05 * s, f.earrings, 8, 6); e.scale.y = 1.8; up.add(at(e, sx * 0.36 * s, hy - 0.2 * s, 0.02 * s)); up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), sx * 0.36 * s, hy - 0.1 * s, 0.02 * s)); }
  if (f.markings) for (const [x, y, rz] of [[0.17, -0.1, 0.6], [0.2, 0.03, -0.3], [-0.18, -0.11, -0.5], [0.1, -0.2, 0.9]]) { const m = cap(0.011 * s, 0.11 * s, f.markings); m.rotation.z = rz; m.rotation.y = Math.sign(x) * 0.5; head.add(at(m, x * s, (hy - headAt + y) * s, (surf(x, y) + 0.004) * s)); }

  // tailoring made on the chest (a shirt front, a waistcoat, a coat's fronts and lapels): `chestAt` is a point of the
  // chest's own surface, its muscle and bust and all, at an angle round it and a height, stood off it by `lift`; `thAt` the angle of the
  // point `x` across the chest at a height; `panel` a piece of cloth cut on it, row by row (each from angle `a` to `b`,
  // stood off by `la` to `lb`, falling off faster near `a` with `fall` under 1, its far end at the height `yb`), which is
  // the trunk's own to what is worn over it
  const chestRaw = (th: number, y: number): [number, number, number] => { const [x, z] = ringPoint(ringAt(tr, y), th, 1 + chestBump((th + 2 * Math.PI) % (2 * Math.PI), y)); return [x, y, z]; };
  const chestAt = (th: number, y: number, lift = 0): THREE.Vector3 => {
    const on = (t: number, h: number) => new THREE.Vector3(...bustWarp(chestRaw(t, h))), q = on(th, y);
    if (lift) {
      // (stood off half way between the surface's own normal, which on the slope of a bust is far from the way out from
      // the middle, and that way out, which keeps it from crossing the cleft from one slope into the other)
      const n = on(th + 0.02, y).sub(on(th - 0.02, y)).cross(on(th, y + 0.02).sub(on(th, y - 0.02))).normalize(), out = new THREE.Vector3(q.x, 0, q.z).normalize();
      q.addScaledVector(n.add(out).normalize(), lift);
    }
    return q.multiplyScalar(s);
  };
  const thAt = (y: number, x: number) => { const r = ringAt(tr, y); return Math.sign(x) * Math.asin(Math.min(1, Math.abs(x) / r.w) ** ((r.n ?? 2) / 2)); };
  type PanelRow = { y: number; a: number; b: number; la: number; lb: number; yb?: number; fall?: number };
  const panelPoint = (r: PanelRow, t: number) => chestAt(r.a + (r.b - r.a) * t, r.y + ((r.yb ?? r.y) - r.y) * t, r.la + (r.lb - r.la) * t ** (r.fall ?? 1));
  /** Draws a row of points across the chest's front taut: each is brought forward to the line between the two that
   *  stand proudest either side of it, as cloth spans the valley between a bust's mounds and does not lie down in it. */
  const tauten = (row: THREE.Vector3[]) => {
    const hull: THREE.Vector3[] = [];
    for (const q of [...row].sort((a, b) => a.x - b.x)) {
      while (hull.length > 1) { const a = hull[hull.length - 2], b = hull[hull.length - 1]; if ((b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x) < 0) break; hull.pop(); }
      hull.push(q);
    }
    const front = hull.map((q) => [q.x, q.z]);
    for (const q of row) { const i = front.findIndex((h, k) => k > 0 && h[0] >= q.x); if (i > 0) { const [ax, az] = front[i - 1], [bx, bz] = front[i]; if (bx > ax) q.z = Math.max(q.z, az + (bz - az) * (q.x - ax) / (bx - ax)); } }
  };
  const panel = (rows: PanelRow[], cols: number, c: string, taut = false): M => {
    const pos: number[] = [], jig: number[] = [], idx: number[] = [];
    for (const r of rows) {
      const row = Array.from({ length: cols }, (_, j) => panelPoint(r, j / (cols - 1)));
      if (taut) tauten(row);
      for (const q of row) pos.push(q.x, q.y, q.z);
      if (bustJig) for (let j = 0; j < cols; j++) { const t = j / (cols - 1); jig.push(bustJig(chestRaw(r.a + (r.b - r.a) * t, r.y + ((r.yb ?? r.y) - r.y) * t)) * s); }
    }
    // (faced outward whichever way its rows and columns run)
    const mid = rows[rows.length >> 1], out = (rows[1].y - rows[0].y) * (mid.b - mid.a) > 0;
    for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j + 1 < cols; j++) { const a = i * cols + j, b = a + cols; if (out) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (bustJig) g.setAttribute('jig', new THREE.Float32BufferAttribute(jig, 1));
    const m = sm(g, c); m.userData.skin = true; up.add(m); return m;
  };
  // (every piece is cut on the same heights, so that one lies evenly over another where the chest's line turns sharply,
  // under the bust; widths are shares of the chest's half width at each height, so the cut fits any build)
  const tailorRows = (lo: number, hi: number) => Array.from({ length: 43 }, (_, i) => 0.46 + 0.04 * i).filter((y) => y > lo - 1e-6 && y < hi + 1e-6);
  const across = (y: number, share: number) => thAt(y, share * ringAt(tr, y).w);
  // (a frock coat's front edge: how far from the middle it runs at each height, meeting at the waist's button, cut away
  // below it and opening above it to the collar)
  const FROCK_EDGE: [number, number][] = [[0.44, 0.6], [0.75, 0.56], [1.05, 0.1], [1.4, 0.33], [1.8, 0.36], [2.1, 0.5], [2.2, 0.6]];
  // (a stand-collared shirt's front: its half width, as a share of the chest's, and how far it stands off the chest, at each height)
  const shirtCut = (y: number) => { const t = Math.min(1, Math.max(0, (y - 1.98) / 0.12)); return { k: Math.min(0.62, 0.25 + Math.max(0, y - 1.3) * 0.6) + 0.1 * t, l: 0.02 + 0.014 * t }; };

  // collar, pendant, buckle
  if (f.shirt && f.shirtCollar === 'stand') {
    // the shirt's front, lying on the chest under whatever is worn open over it, its buttons down the middle; and a high
    // stand collar round the neck, open at the throat, its two points standing up either side of the chin
    const front = panel(tailorRows(1.26, 2.3).map((y) => { const { k, l } = shirtCut(y); return { y, a: across(y, -k), b: across(y, k), la: l, lb: l }; }), 17, f.shirt, true).geometry.attributes.position; // (over the neckband, up to the collar)
    for (const i of [4, 8, 13, 17]) up.add(at(sph(0.02 * s, '#c9c2b0', 6, 4), 0, front.getY(i * 17 + 8), front.getZ(i * 17 + 8) + 0.007 * s)); // (on the middle of every few rows)
    const pos: number[] = [], ROWS = 4, COLS = 25;
    for (let i = 0; i <= ROWS; i++) for (let j = 0; j < COLS; j++) {
      const t = i / ROWS, gap = 0.3 + 0.22 * t, th = gap + (2 * Math.PI - 2 * gap) * j / (COLS - 1), tip = t * Math.max(0, 1 - Math.min(j, COLS - 1 - j) / 3) ** 2;
      const w = 0.31 - 0.085 * t + 0.03 * tip, d = Math.cos(th) > 0 ? 0.235 - 0.03 * t + 0.04 * tip : 0.25 - 0.04 * t;
      pos.push(Math.sin(th) * w * s, (2.1 + 0.24 * t + 0.015 * tip) * s, (-0.01 + Math.cos(th) * d) * s);
    }
    up.add(sm(gridGeometry(pos, COLS, ROWS), f.shirt, true));
  } else if (f.shirt) { const c = cyl(0.24 * s, 0.32 * s, 0.32 * s, f.shirt, 7); up.add(at(c, 0, 2.2 * s, 0.08 * s)); up.add(at(box(0.3 * s, 0.5 * s, 0.06 * s, f.shirt), 0, 1.85 * s, 0.4 * s)); for (let i = 0; i < 3; i++) up.add(at(sph(0.025 * s, '#c9c2b0', 6, 4), 0, (1.95 - i * 0.15) * s, 0.44 * s)); }
  // fine work laid on a surface (embroidery, rows of mail rings): flat ribbons, each between two lines of points; and
  // leaves, each a flat diamond `w` wide from its foot to its tip, lying across `n`
  const ribbons = (strips: [THREE.Vector3[], THREE.Vector3[]][], c: string): M => {
    const pos: number[] = [], idx: number[] = [];
    for (const [a, b] of strips) {
      const o = pos.length / 3, n = a.length;
      for (const q of [...a, ...b]) pos.push(q.x, q.y, q.z);
      for (let i = 0; i + 1 < n; i++) idx.push(o + i, o + n + i, o + i + 1, o + i + 1, o + n + i, o + n + i + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return sm(g, c, true);
  };
  const leaves = (ls: [THREE.Vector3, THREE.Vector3, THREE.Vector3][], w: number, c: string): M => {
    const pos: number[] = [], idx: number[] = [], side = new THREE.Vector3();
    for (const [foot, tip, n] of ls) {
      const o = pos.length / 3, mid = foot.clone().lerp(tip, 0.45); side.subVectors(tip, foot).cross(n).normalize().multiplyScalar(w / 2);
      for (const q of [foot, mid.clone().add(side), tip, mid.clone().sub(side)]) pos.push(q.x, q.y, q.z);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return sm(g, c, true);
  };
  // a point on the chest as the torso is lofted (pectorals and all), at an angle round it and a height: scaled out from
  // the middle by `ease` (how far out a fitted garment is cut), then stood `off` it along the way out there
  // (the torso's grid is read when first asked for: a figure that hangs nothing on its chest never reads it)
  let chestGrid: { tp: THREE.BufferAttribute; tn: THREE.BufferAttribute; seg: number; trows: number } | undefined;
  const onChest = (th: number, y: number, ease: number, off: number, way?: THREE.Vector3) => {
    if (!chestGrid) {
      const tm = up.children[0] as M, tp = tm.geometry.getAttribute('position') as THREE.BufferAttribute, tn = tm.geometry.getAttribute('normal') as THREE.BufferAttribute;
      let seg = 1; while (seg < tp.count && Math.abs(tp.getY(seg) - tp.getY(0)) < 1e-6) seg++;
      chestGrid = { tp, tn, seg, trows: Math.floor(tp.count / seg) - 1 };
    }
    const { tp, tn, seg, trows } = chestGrid, yLo = tr[0].y, yHi = tr[tr.length - 1].y, v = new THREE.Vector3(), TAU = Math.PI * 2;
    const fi = clampTo((y - yLo) / (yHi - yLo), 0, 1) * trows, fj = (((th / TAU) % 1) + 1) % 1 * seg, i0 = Math.min(trows - 1, Math.floor(fi)), j0 = Math.floor(fj) % seg, ca = fj - Math.floor(fj), cb = fi - i0;
    const out = new THREE.Vector3(), n = way ?? new THREE.Vector3(); n.set(0, 0, 0);
    for (const [di, dj, k] of [[0, 0, (1 - ca) * (1 - cb)], [0, 1, ca * (1 - cb)], [1, 0, (1 - ca) * cb], [1, 1, ca * cb]] as const) { const i = (i0 + di) * seg + (j0 + dj) % seg; out.addScaledVector(v.fromBufferAttribute(tp, i), k); n.addScaledVector(v.fromBufferAttribute(tn, i), k); }
    out.x *= ease; out.z *= ease;
    return out.addScaledVector(n.normalize(), off);
  };
  // (a chain shirt's yoke is fitted to its hung mail whenever that is hung: see the mail)
  let yokeMeet: ((G?: Garment) => void) | undefined;
  // (small things hung on the chest, which a strap worn across it lies under, not over)
  const trinkets = new Set<THREE.Object3D>(), trinket = (m: M) => { trinkets.add(m); return m; };
  if (f.pendant && f.pendantShape === 'rings') {
    // two linked rings on a fine chain: the chain comes round the neck and down the chest to a point, lying just off
    // whatever is worn there (a chain shirt is cut further out than the skin); the rings hang from the point along the
    // chest's slope, standing clear of it, each turned a little so that it passes through the other
    const ease = f.chainShirt && f.armor?.kind === 'mail' && !gown ? 1.1 : 1, way = new THREE.Vector3(), yR = 1.69;
    const on = (x: number, y: number, off: number) => onChest(Math.asin(clampTo(x / (ringAt(tr, y).w * ease), -1, 1)), y, ease, off * s, way);
    // (round the neck it lies on the slope of the shoulders, far enough out from the neck's foot that the neck clears it
    // when the head is turned or tipped: the highest point there at each angle round from the front)
    let round = 0.2 * s; const nv = new THREE.Vector3();
    for (const m of neck.children as M[]) if (m.isMesh) { const pos = m.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) if (nv.fromBufferAttribute(pos, i).y < 0.12 * s) round = Math.max(round, Math.hypot(nv.x, nv.z)); }
    round += 0.06 * s;
    const nape = (th: number) => { let p = onChest(th, 2.3, ease, 0.02 * s); for (let y = 2.29; y > 2.1 && Math.hypot(p.x, p.z) < round; y -= 0.01) p = onChest(th, y, ease, 0.02 * s); return p; };
    // (on a body fallen it has fallen with it: the chain lies slack on the chest from the shoulders down, none of it
    // standing round the front of the neck where the head has dropped, and the rings lie on the chest)
    const lie = dead ? 0.45 : 1, off = 0.05 * (dead ? 0.6 : 1);
    const half = (sx: number) => [...(dead ? [2.7, 2.0, 1.3] : [2.7, 2.0, 1.3, 0.7]).map((th) => nape(sx * th)), on(sx * (dead ? 0.19 : 0.15), 2.12, 0.045), on(sx * (dead ? 0.13 : 0.11), 1.96, 0.035 * lie), on(sx * 0.035, 1.82, 0.04 * lie)];
    const pts = [...half(-1), on(0, yR + 0.085, off), ...half(1).reverse()];
    const hung = (m: M) => { m.userData.part = 'pendant'; return trinket(m); };
    up.add(hung(tube(pts, 0.006 * s, f.pendant)));
    const c = on(0, yR, off), n = way.clone(), hang = c.clone().sub(on(0, yR - 0.05, off)).normalize(), x = new THREE.Vector3().crossVectors(hang, n).normalize();
    for (const sx of [-1, 1]) {
      const r = sm(new THREE.TorusGeometry(0.075 * s, 0.012 * s, 6, 20), f.pendant);
      r.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, hang, new THREE.Vector3().crossVectors(x, hang))).multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, sx * (dead ? 0.15 : 0.22)));
      r.position.copy(c).addScaledVector(x, sx * 0.048 * s); up.add(hung(r));
    }
  } else if (f.pendant) {
    const fz = (x: number, y: number) => bustWarp([x, y, ringAt(tr, y).f * Math.sqrt(Math.max(0, 1 - (x / ringAt(tr, y).w) ** 2))])[2] + 0.025; // the chest's front at a point
    const v = (x: number, y: number) => new THREE.Vector3(x * s, y * s, fz(x, y) * s);
    up.add(trinket(tube([new THREE.Vector3(-0.22 * s, 2.25 * s, 0.25 * s), v(-0.1, 1.9), v(0, 1.78), v(0.1, 1.9), new THREE.Vector3(0.22 * s, 2.25 * s, 0.25 * s)], 0.012 * s, '#b8bec8')));
    const g = sm(new THREE.OctahedronGeometry(0.08 * s), f.pendant); g.scale.y = 1.7; up.add(trinket(at(g, 0, 1.66 * s, (fz(0, 1.66) + 0.03) * s)));
  }
  if (f.buckle && f.armor?.kind !== 'plate' && !f.belt) { up.add(at(box(0.24 * s, 0.2 * s, 0.06 * s, f.buckle), 0, 0.42 * s, 0.63 * s)); up.add(at(box(0.12 * s, 0.1 * s, 0.07 * s, f.trim ?? '#2b2420'), 0, 0.42 * s, 0.64 * s)); } // (on plate, on the fauld: below)

  // a laced bodice: a corset that follows the torso's line, the lacing crossing down its front
  if (f.bodice) {
    const lo = 0.45, hi = fr.bust ? Math.min(1.3, 1.53 - 0.85 * fr.bust) : gown ? 1.4 : 1.3, lc = f.bodice.lacing ?? '#b08a4a';
    up.add(sm(loftGeometry(clipRings(tr, lo, hi), s, { seg: fr.bust ? 72 : 32, rows: fr.bust ? 36 : undefined, k: 1.07, warp: bustWarp, jig: bustJig }), f.bodice.color));
    for (const y of [lo, hi]) { const r = ringAt(tr, y); up.add(sm(loftGeometry([{ ...r, y: y - 0.025 }, { ...r, y: y + 0.025 }], s, { seg: 32, k: 1.1, rows: 1 }), tone(f.bodice.color, '#000000', 0.3))); }
    for (let i = 0; i < 5; i++) { const y = lo + 0.08 + i * (hi - lo - 0.16) / 4, z = ringAt(tr, y).f * 1.07 + 0.012; for (const sx of [-1, 1]) { const x = box(0.2 * s, 0.025 * s, 0.025 * s, lc); x.rotation.z = sx * 0.5; up.add(at(x, 0, y * s, z * s)); } }
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const y = lo + 0.06 + i * (hi - lo - 0.12) / 5; up.add(at(sph(0.018 * s, lc, 6, 4), sx * 0.08 * s, y * s, (ringAt(tr, y).f * 1.07 + 0.01) * s)); }
    for (const a of [-0.9, 0.9, -2.2, 2.2]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 6; i++) { const y = lo + (hi - lo) * i / 6, r = ringAt(tr, y), e = 2 / (r.n ?? 2), sn = Math.sin(a), cs = Math.cos(a); pts.push(new THREE.Vector3(Math.sign(sn) * Math.abs(sn) ** e * r.w * 1.08 * s, y * s, Math.sign(cs) * Math.abs(cs) ** e * (cs >= 0 ? r.f : r.b) * 1.08 * s)); } up.add(tube(pts, 0.012 * s, tone(f.bodice.color, '#000000', 0.35))); } // boning
  }

  // a corset over a gown's waist: leather shaped to the body from the top of the skirt up to the bust's lower curve,
  // its top edge rolled, boned at the sides and behind, laced up the front, two straps round it buckled to the left of
  // the lacing (the skirt hangs from its foot, under a belt: see the gown)
  const CORSET_FOOT = 0.62;
  // (a point `out` proud of the gown's bodice, round the torso at `th`: off the bust's own curve, along its normal there)
  const offBodice = (th: number, y: number, out: number) => {
    const P = (a: number, h: number) => { const [x, z] = ringPoint(ringAt(tr, h), a), q = bustWarp([x, h, z]); return new THREE.Vector3(q[0], q[1], q[2]); };
    const n = P(th + 0.02, y).sub(P(th - 0.02, y)).cross(P(th, y + 0.01).sub(P(th, y - 0.01))).normalize();
    return P(th, y).addScaledVector(n, out).multiplyScalar(s);
  };
  if (f.corset && gown) {
    const C = f.corset.color, dark = tone(C, '#000000', 0.32), bc = f.corset.buckle ?? '#9a9ea6', thick = 0.022, lo = 0.5, hi = fr.bust ? Math.min(1.3, 1.53 - 0.85 * fr.bust) : 1.3, under = fr.bust ? 1.53 - 1.22 * fr.bust : hi;
    // its top edge: level at `hi` round the ribs and the back, and under each breast cut down to just below where the
    // bust leaves the ribs, so the leather lies on the plain of the ribs all the way up and its edge runs clean under
    // the bust (the edge's height at each of SEG angles round the torso, eased up to the level over EASE of them)
    const SEG = 80, onBust = (th: number, y: number) => { const [x, z] = ringPoint(ringAt(tr, y), th); return bustWarp([x, y, z])[2] > z + 1e-6; };
    let tops: number[] = []; const EASE = 8; for (let j = 0; j < SEG; j++) { let y = hi; while (y > under - 0.02 && [-0.1, -0.05, 0, 0.05, 0.1].some((d) => onBust((j / SEG) * Math.PI * 2 + d, y))) y -= 0.01; tops.push(y < hi ? y - 0.025 : y); }
    tops = tops.map((y, j) => { for (let d = -EASE; d <= EASE; d++) { const low = tops[(j + d + SEG) % SEG], k = Math.abs(d) / EASE; if (low < hi) y = Math.min(y, low + (hi - low) * k * k * (3 - 2 * k)); } return y; });
    const topAt = (th: number) => { const a = ((th / (Math.PI * 2)) % 1 + 1) % 1 * SEG, j = Math.floor(a); return tops[j % SEG] + (tops[(j + 1) % SEG] - tops[j % SEG]) * (a - j); };
    // a band of leather round the torso from a height up to its top edge, `out` proud of the bodice
    const leather = (y0: number, y1: (th: number) => number, rows: number, out: number, c: string) => {
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i <= rows; i++) for (let j = 0; j < SEG; j++) { const th = (j / SEG) * Math.PI * 2, q = offBodice(th, y0 + (y1(th) - y0) * i / rows, out); pos.push(q.x, q.y, q.z); }
      for (let i = 0; i < rows; i++) for (let j = 0; j < SEG; j++) { const a = i * SEG + j, b = i * SEG + (j + 1) % SEG; idx.push(a, b, a + SEG, b, b + SEG, a + SEG); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return sm(g, c);
    };
    const shell = leather(lo, topAt, 32, thick, C); shell.userData.skin = true; up.add(shell);
    { const roll: THREE.Vector3[] = []; for (let j = 0; j < SEG; j++) { const th = (j / SEG) * Math.PI * 2; roll.push(offBodice(th, topAt(th), thick * 0.6)); } up.add(sm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(roll, true), 96, 0.02 * s, 5, true), dark)); } // its top edge, rolled
    for (const th of [-2.6, -1.9, -1.2, 1.2, 1.9, 2.6]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 6; i++) pts.push(offBodice(th, lo + 0.02 + (topAt(th) - lo - 0.07) * i / 6, thick + 0.004)); up.add(cord(pts, 0.012 * s, dark)); } // boning
    const n = 7, y0 = CORSET_FOOT + 0.03, step = (under - 0.03 - y0) / n;
    up.add(...lacing((sd, i) => offBodice(sd * 0.22, y0 + i * step, thick + 0.006), (i) => offBodice(0, y0 + (i + 0.5) * step, thick + 0.008), n, 0.012 * s, f.corset.lacing ?? '#b08a4a'));
    for (const y of [CORSET_FOOT + 0.1, CORSET_FOOT + 0.25]) { // the straps, round the back from one side of the lacing to the other, each with its buckle
      const pos: number[] = []; for (const h of [y + 0.032, y - 0.032]) for (let j = 0; j <= 40; j++) { const q = offBodice(0.4 + (Math.PI * 2 - 0.8) * j / 40, h, thick + 0.016); pos.push(q.x, q.y, q.z); }
      up.add(sm(gridGeometry(pos, 41, 1), dark, true));
      const p = offBodice(0.75, y, thick + 0.027), b = new THREE.Group(); b.position.copy(p); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), offBodice(0.75, y, 1).sub(p).normalize());
      b.add(box(0.105 * s, 0.11 * s, 0.022 * s, bc), at(box(0.06 * s, 0.07 * s, 0.026 * s, dark), 0, 0, 0), at(box(0.07 * s, 0.016 * s, 0.03 * s, bc), -0.012 * s, 0, 0.004 * s)); up.add(b);
    }
  }

  // wide-leg trousers: the legs and the seat take their colour, and over each leg goes a full tube of cloth from the hip,
  // as wide all the way down as the thigh is at its middle and never closer on the leg than `ease` (wider over the boot's
  // cuff and strap, which it hides), flaring to the hem at the ankle; a pressed crease stands down its front and its
  // back. Made on the thigh and on the shin, so they bend at the knee as the leg does (bendLimb), and are the body's own
  // where it lies on the floor
  if (f.trousers) {
    const sr = shinRings(fr), tr2 = thighRings(fr), mid = ringAt(tr2, -0.5 * THIGH), crease = (th: number) => 0.06 * Math.exp(-(Math.sin(th) ** 2) / 0.012), cloth = soft(f.trousers);
    const cut = (rings: Ring[], lo: number, hi: number, ease: (y: number) => number, flare: (y: number) => number): Ring[] => Array.from({ length: 13 }, (_, i) => {
      const y = lo + (hi - lo) * i / 12, r = ringAt(rings, y), e = ease(y), fl = 0.98 * flare(y);
      return { ...r, w: Math.max(r.w * e, mid.w * fl), f: Math.max(r.f * e, mid.f * fl), b: Math.max(r.b * e, mid.b * fl) };
    });
    // (the two halves of a leg are one tube: open where they meet at the knee, the end of the loft there, about its
    // middle point `c`, left out, so no rim shades the join; at the hip it runs into the thigh's own top)
    const open = (g: THREE.BufferGeometry, c: number) => { const ix = Array.from(g.index!.array), keep: number[] = []; for (let i = 0; i < ix.length; i += 3) if (ix[i] !== c && ix[i + 1] !== c && ix[i + 2] !== c) keep.push(ix[i], ix[i + 1], ix[i + 2]); g.setIndex(keep); g.computeVertexNormals(); return g; };
    const top = tr2[tr2.length - 1].y, thighCut = cut(tr2, -THIGH, top, (y) => 1.01 + 0.07 * Math.min(1, (top - y) / 0.5), (y) => Math.min(1, (top - y) / 0.5));
    const shinCut = cut(sr, -SHIN - 0.04, 0, (y) => y < -0.35 ? 1.5 : 1.1, (y) => 1 + 0.32 * Math.max(0, -y / SHIN) ** 1.6);
    for (const l of leg) {
      const th = sm(open(loftGeometry(thighCut, s, { seg: 28, rows: 20, bump: crease }), 21 * 28), f.trousers), sh = sm(open(loftGeometry(shinCut, s, { seg: 28, rows: 22, bump: crease }), 23 * 28 + 1), f.trousers);
      l.root.add(th); l.mid.add(sh); own.add(th); own.add(sh); l.upper.material = cloth; l.lower.material = cloth;
    }
    for (const c of pel.children) if ((c as M).isMesh && c.userData.skin) (c as M).material = cloth; // the seat
    const band = (y: number, k: number) => { const r = ringAt(tr, y); return { ...r, w: r.w * k, f: r.f * k, b: r.b * k }; };
    const rise = sm(loftGeometry([band(0.12, 0.94), band(0.24, 1.02), band(0.36, 1.025)], s, { seg: 32, rows: 4 }), f.trousers); rise.userData.skin = true; up.add(rise); own.add(rise); // (up to the belt)
  }

  // a waistcoat under the coat: two fronts on the chest, buttoned down the middle to a point each below the waist and
  // open in a V over the shirt above; a watch chain across it in two swags from its ring at the middle to the pocket on
  // the left, a crystal fob hanging from the ring
  if (f.waistcoat) {
    const wc = f.waistcoat, edge = (y: number) => Math.min(0.95, radiusAt(FROCK_EDGE, y) + 0.2), open = (y: number) => Math.max(0, y - 1.3) * 0.6;
    for (const sx of [-1, 1]) panel([{ y: 0.37, a: sx * across(0.37, 0.12), b: sx * across(0.37, 0.34), la: 0.036, lb: 0.036 }, ...tailorRows(0.46, 1.9).map((y) => ({ y, a: sx * across(y, open(y)), b: sx * across(y, Math.max(edge(y), open(y) + 0.2)), la: 0.036, lb: 0.036 }))], 13, wc.color);
    for (const y of [0.56, 0.74, 0.92, 1.1, 1.26]) { const q = chestAt(0, y, 0.044); up.add(at(sph(0.028 * s, wc.buttons ?? '#c9c2b0', 8, 6), q.x, q.y, q.z)); }
    const on = (x: number, y: number, lift = 0.051) => chestAt(thAt(y, x), y, lift);
    if (wc.chain) {
      const ax = -0.02, ay = 0.83, bx = LX * 0.2, by = 0.8;
      for (const sag of [0.07, 0.15]) up.add(tube(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return on(ax + (bx - ax) * t, ay + (by - ay) * t - sag * Math.sin(Math.PI * t)); }), 0.011 * s, wc.chain));
      const ring = on(ax, ay, 0.058); up.add(at(sph(0.026 * s, wc.chain, 8, 6), ring.x, ring.y, ring.z));
      const bar = on(bx, by, 0.054); up.add(at(sph(0.02 * s, wc.chain, 6, 4), bar.x, bar.y, bar.z));
      if (wc.fob) {
        up.add(tube([on(ax, ay), on(ax, ay - 0.06), on(ax, ay - 0.12)], 0.009 * s, wc.chain));
        const q = on(ax, ay - 0.19, 0.066), g = sm(new THREE.OctahedronGeometry(0.045 * s), wc.fob); g.scale.y = 1.7; up.add(at(g, q.x, q.y, q.z));
      }
    }
  }

  // a coat: tails behind, lapels in front; or, cut as a frock coat, tailored: its fronts on the chest, standing proud of
  // the waistcoat at their edges and running into the coat's body at the sides, fastened by one button at the waist; the
  // skirts cut on the hips from the waist seam and hung to mid-thigh, open at the front; peaked lapels and a collar
  if (f.coat && f.coatCut === 'frock') {
    const cc = f.coat.tails, lc = f.coat.lapel ?? tone(cc, '#000000', 0.25), dark = tone(cc, '#000000', 0.3), em = f.coatEmbroidery, edge = (y: number) => radiusAt(FROCK_EDGE, y);
    // the skirts: close on the waist and the hips, hanging from the widest of them in soft folds that deepen toward the
    // hem and flaring a little, the hem itself curling out and waving with the folds; each front edge falls from where the
    // fronts are cut away to at the waist seam, its corner at the hem rounded off (DRAPE_COLS columns, the edges first and last)
    const TOP = 0.5, HEM = -0.95, ROWS = 14, gap = 2 * across(TOP, edge(TOP)), pr = pelvisRings(fr), pos: number[] = [], widest = new Float64Array(DRAPE_COLS * 2), seated = new Float64Array(DRAPE_COLS);
    for (let i = 0; i <= ROWS; i++) {
      const t = i / ROWS;
      for (let j = 0; j < DRAPE_COLS; j++) {
        const u = j / (DRAPE_COLS - 1), th = gap / 2 + (2 * Math.PI - gap) * u, fold = 0.5 + 0.5 * Math.sin(5 * th + 0.6) + 0.18 * Math.sin(11 * th + 2); // (the folds, each swelling out from the cut)
        const y = TOP + (HEM + 0.2 * (1 - Math.sqrt(1 - (1 - Math.min(1, Math.min(u, 1 - u) / 0.06)) ** 2)) - 0.05 * (fold - 0.5) - TOP) * t;
        let [bx, bz] = y >= tr[0].y ? ringPoint(ringAt(tr, y), th, 1.09) : [0, 0];
        let over = 0;
        if (y >= pr[0].y) { const sb = seatBump(th, y), [x, z] = ringPoint(ringAt(pr, y), th, 1.14 * (1 + sb)); if (Math.hypot(x, z) > Math.hypot(bx, bz)) { bx = x; bz = z; over = sb; } }
        if (Math.hypot(bx, bz) < Math.hypot(widest[j * 2], widest[j * 2 + 1])) { bx = widest[j * 2]; bz = widest[j * 2 + 1]; } else { widest[j * 2] = bx; widest[j * 2 + 1] = bz; seated[j] = over; }
        // (below the seat it falls in again, half way back to the line of the hips by the hem)
        const fl = (1 + 0.13 * t ** 1.6 + 0.13 * t ** 1.3 * fold + 0.05 * Math.max(0, (t - 0.78) / 0.22) ** 2) * (1 - 0.5 * seated[j] / (1 + seated[j]) * Math.max(0, (-0.1 - y) / (-0.1 - HEM)));
        pos.push(bx * fl * s, y * s, bz * fl * s);
      }
    }
    wear('tails', sm(gridGeometry(pos, DRAPE_COLS, ROWS), cc, true), up, DRAPE_COLS, ROWS + 1, { closed: false, covers: ['pelvis', ...LEGS, ...FEET, 'hem', 'stowed', 'culet', 'tassetR', 'tassetL'], outside: LOWER_ARMS, layer: 1, clear: 0.04 * s, spread: 5, hang: 0.9, after: (G) => {
      // made on the hung skirts: each front edge piped, a flap pocket on each hip under its welt, and the vent up the
      // back from the hem with the two buttons at its head on the waist seam
      const patch = (u0: number, u1: number, t0: number, t1: number, c: string, off: number) => { const q: number[] = [], NU = 6, NT = 3; for (let i = 0; i <= NT; i++) for (let j = 0; j <= NU; j++) { const v = clothPoint(G, u0 + (u1 - u0) * j / NU, t0 + (t1 - t0) * i / NT, off); q.push(v.x, v.y, v.z); } up.add(sm(gridGeometry(q, NU + 1, NT), c, true)); };
      for (const u of [0, 1]) up.add(tube(Array.from({ length: 15 }, (_, i) => clothPoint(G, u, i / 14, 0.002 * s)), 0.012 * s, dark));
      for (const u of [0.15, 0.85]) { patch(u - 0.05, u + 0.05, 0.31, 0.45, tone(cc, '#000000', 0.12), 0.012 * s); up.add(tube(Array.from({ length: 7 }, (_, i) => clothPoint(G, u - 0.052 + 0.104 * i / 6, 0.3, 0.012 * s)), 0.011 * s, dark)); }
      up.add(tube(Array.from({ length: 8 }, (_, i) => clothPoint(G, 0.5, 0.3 + 0.7 * i / 7, 0.004 * s)), 0.009 * s, dark));
      for (const u of [0.47, 0.53]) { const q = clothPoint(G, u, 0.04, 0.004 * s); up.add(at(sph(0.024 * s, em ?? dark, 8, 6), q.x, q.y, q.z)); }
    } });
    for (const sx of [-1, 1]) {
      // the front: proud of the waistcoat at its edge, soon closer and running into the coat's body at the side (an arm
      // resting at the waist lies on it there)
      // (over a shirt front that reaches out under it, it stays proud of the shirt as far as the shirt goes)
      panel(tailorRows(0.46, 2.18).map((y) => {
        const a = across(y, edge(y)), sh = f.shirt && f.shirtCollar === 'stand' && y > 1.26 ? shirtCut(y) : undefined, ts = sh ? (across(y, sh.k) - a) / (1.45 - a) : 0;
        return { y, a: sx * a, b: sx * 1.45, la: 0.062, lb: 0.008, fall: sh && ts > 0.02 ? Math.max(0.4, Math.log((0.062 - sh.l - 0.012) / 0.054) / Math.log(Math.min(0.95, ts))) : 0.4 };
      }), 16, cc);
      // the lapel, rolled back from the button at the waist: widening to its peak, which points up and out toward the
      // shoulder, then cut in at the gorge to the collar's end, which runs on up to the neck
      const lapel: PanelRow[] = tailorRows(1.02, 1.98).map((y) => {
        const low = y < 1.75, xo = low ? edge(y) + (0.8 - edge(y)) * Math.min(1, (y - 1.02) / 0.5) ** 0.8 : 0.6 + 0.4 * (y - 1.76), yb = low ? y + 0.13 * Math.max(0, (y - 1.4) / 0.34) ** 2 : y;
        return { y, a: sx * across(y, edge(y)), b: sx * across(yb, xo), la: 0.096, lb: 0.056, yb };
      });
      panel(lapel, 11, lc);
      if (em) {
        // embroidery: a line of thread just inside the lapel's outer edge, and a vine winding up it with leaves
        const lift = (r: PanelRow, t: number) => panelPoint({ ...r, la: r.la + 0.014, lb: r.lb + 0.014 }, t), low = lapel.filter((r) => r.y < 1.75);
        up.add(tube(low.map((r) => lift(r, 0.9)), 0.011 * s, em));
        const vine = low.filter((r) => r.y > 1.2 && (sx !== LX || !f.lapelPin || r.y < 1.52));
        up.add(tube(vine.map((r, i) => lift(r, 0.42 + 0.16 * Math.sin(i * 1.7))), 0.01 * s, em));
        vine.forEach((r, i) => { if (i % 2) { const q = lift(r, 0.42 + 0.3 * Math.sin(i * 1.7)); up.add(at(sph(0.022 * s, em, 6, 4), q.x, q.y, q.z)); } });
      }
      if (f.lapelPin && sx === LX) {
        // the pin: a crescent moon lying on the lapel below its peak, its horns turned up and out
        const r = lapel.find((x) => x.y > 1.6)!, q = panelPoint({ ...r, la: r.la + 0.022, lb: r.lb + 0.022 }, 0.5), nrm = panelPoint({ ...r, la: r.la + 0.1, lb: r.lb + 0.1 }, 0.5).sub(q).normalize();
        const arc = (cx: number, rad: number, a0: number, a1: number) => Array.from({ length: 13 }, (_, i) => { const a = a0 + (a1 - a0) * i / 12; return new THREE.Vector2(cx + rad * Math.cos(a), rad * Math.sin(a)); });
        const moon = sm(new THREE.ShapeGeometry(new THREE.Shape([...arc(0, 1, 0.81, 2 * Math.PI - 0.81), ...arc(0.4, 0.78, 2 * Math.PI - 1.19, 1.19)])), f.lapelPin, true);
        moon.scale.setScalar(0.075 * s); moon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); moon.rotateZ(-0.6); up.add(at(moon, q.x, q.y, q.z));
      }
      // the button at the waist, on the left front
      if (sx === LX) { const q = chestAt(across(1.05, 0.16), 1.05, 0.068); up.add(at(sph(0.035 * s, em ?? dark, 8, 6), q.x, q.y, q.z)); }
    }
    // the collar, turned down: a stand round the back and the sides of the neck outside the shirt's, leaning in with it, rolled over at the top
    // and falling outside it onto the shoulders, over the neckband; toward each lapel it sinks, its end rounded off, to
    // nothing on the shoulder
    {
      const q: number[] = [], N = 24, foot = ringAt(tr, 2.03), oval = (th: number, rx: number, rb: number, y: number) => new THREE.Vector3(Math.sin(th) * rx, y, -0.02 + Math.cos(th) * (Math.cos(th) > 0 ? rb - 0.022 : rb));
      for (let k = 0; k <= 4; k++) for (let c = 0; c <= N; c++) {
        const th = 2 * Math.PI - 0.95 - (2 * Math.PI - 1.9) * c / N, e = Math.sqrt(1 - (1 - Math.min(1, Math.min(c, N - c) / 5)) ** 2), h = 0.15 * e, [fx, fz] = ringPoint(foot, th, 1.1);
        const pt = [oval(th, 0.335, 0.245, 2.11), oval(th, 0.335 - 0.2 * h, 0.245 - 0.13 * h, 2.11 + h), oval(th, 0.353 - 0.2 * h, 0.255 - 0.13 * h, 2.11 + h + 0.012 * e), oval(th, 0.375, 0.26, 2.11 + 0.55 * h), new THREE.Vector3(fx, 2.03, fz)][k];
        pt.lerp(new THREE.Vector3(fx, 2.03, fz), 1 - e).multiplyScalar(s); q.push(pt.x, pt.y, pt.z);
      }
      up.add(sm(gridGeometry(q, N + 1, 4), lc, true));
    }
    // the cuffs: turned back wide over the end of each sleeve, the shirt's cuff showing at the wrist, a line of
    // embroidery round the top and two buttons on the outside
    const fa = forearmRings(fr), ring = (y: number, k: number) => { const r = ringAt(fa, y); return { ...r, w: r.w * k, f: r.f * k, b: r.b * k }; };
    arm.forEach((l, k) => {
      const sx = k === 0 ? RX : LX;
      l.mid.add(sm(loftGeometry([ring(-0.95, 1.24), ring(-0.85, 1.3), ring(-0.7, 1.36)], s, { seg: 14, rows: 3 }), lc));
      if (f.shirt) l.mid.add(sm(loftGeometry([ring(-0.995, 1.12), ring(-0.94, 1.12)], s, { seg: 14, rows: 1 }), f.shirt));
      if (em) { const r = ring(-0.72, 1.375); l.mid.add(tube(Array.from({ length: 12 }, (_, i) => { const [x, z] = ringPoint(r, i / 12 * 2 * Math.PI); return new THREE.Vector3(x * s, -0.72 * s, z * s); }), 0.011 * s, em, true)); }
      for (const y of [-0.78, -0.88]) { const [x, z] = ringPoint(ring(y, y < -0.85 ? 1.3 : 1.34), sx * 1.9); l.mid.add(at(sph(0.022 * s, em ?? dark, 6, 4), x * s, y * s, z * s)); }
    });
  } else if (f.coat) {
    const tails = drape(0.62 * s, 0.75 * s, 1.6 * s, f.coat.tails, { folds: 5, amp: 0.08, jag: 0.25 * s, gap: Math.PI * 1.2, rows: 16 }); tails.position.y = -0.55 * s;
    // (over plates hung from the waist as well, the culet and the tassets, which hang first on their layer)
    wear('tails', tails, up, DRAPE_COLS, 17, { closed: false, covers: ['pelvis', ...LEGS, ...FEET, 'hem', 'stowed', 'culet', 'tassetR', 'tassetL'], outside: LOWER_ARMS, layer: 1, clear: 0.04 * s, spread: 5, hang: 0.9 });
    for (const sx of [-1, 1]) { const lp = box(0.16 * s, 0.9 * s, 0.05 * s, f.coat.lapel ?? f.coat.tails); lp.rotation.z = sx * 0.25; up.add(at(lp, sx * 0.24 * s, 1.75 * s, 0.42 * s)); up.add(at(box(0.07 * s, 0.32 * s, 0.05 * s, '#c9c2b0'), sx * 0.45 * s, 1.0 * s, 0.4 * s)); }
  }

  // a satchel on a strap across the chest, and vials at the belt
  if (f.satchel && !f.satchelKit) {
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
  // the floor under the figure as it is when its cloth has hung (under the soles of one standing, and where one laid
  // out will lie), for trims made on the hung cloth: the way up off it in `parent`'s frame, and how high over it a
  // point of that frame stands
  const floorUnder = (parent: THREE.Object3D) => {
    const n = laid?.n ?? Y_AXIS, w3 = new THREE.Vector3();
    let level = laid ? laid.low - laid.lift : Infinity; if (!laid) for (const m of soles) level = Math.min(level, new THREE.Box3().setFromObject(m).min.y);
    return { n, rise: n.clone().transformDirection(parent.matrixWorld.clone().invert()), height: (q: THREE.Vector3) => w3.copy(q).applyMatrix4(parent.matrixWorld).dot(n) - level };
  };
  if (gown) {
    // cut on the hips (it turns with them), hung on the posed legs: a step forward flares the hem over the knee, and the
    // leg in the slit shows through it; the trims and the underskirt's froth are laid on the hung cloth
    // (under a corset the skirt starts at the corset's foot, drawn in to it there: to where the pose's spine will carry
    // it, as the corset leans and turns with the chest and the skirt stays on the hips)
    const line: [number, number][] = f.corset ? [[CORSET_FOOT + HIP, 0.6], ...GOWN.slice(2)] : GOWN, lean = new THREE.Euler(...trunk(poseOf(f, battle, dead, gown).spine ?? [0, 0, 0]));
    const fitAt = (th: number) => offBodice(th - lean.y, CORSET_FOOT, 0.022 + 0.035).applyEuler(lean).add(new THREE.Vector3(0, HIP * s, 0));
    const top = line[0][0] * s, bot = line[line.length - 1][0] * s, tAt = (y: number) => (top - y * s) / (top - bot);
    const g = sheath(line.map(([y, r]) => [y * s, r * s] as [number, number]), f.skirt!, { zs: 0.68, slitAt: LX * 0.42, slitTop: 2.85 * GK * s, slitW: 1.0, flareFrom: 1.3 * GK * s, folds: 9, amp: 0.1, train: 0.35, fit: f.corset ? { at: fitAt, over: 0.4 * s } : undefined, dag: f.dagged ? 0.2 * s : undefined });
    g.mesh.position.y = -HIP * s;
    // (cut to the corset's foot, the top stays on it: it does not ride out over the waist as a loose waistband does)
    wear('gown', g.mesh, pel, 65, 45, { closed: false, covers: ['torso', 'pelvis', ...LEGS, ...FEET], outside: LOWER_ARMS, layer: 0, clear: 0.03 * s, spread: 5, hang: 0.55, anchored: f.corset ? 0.01 * s : undefined, cutTop: !!f.corset, after: (G) => {
      if (f.corset) settleTop(G);
      const on = clothFace(G, laid?.n.clone().transformDirection(pel.matrixWorld.clone().invert()));
      const F = floorUnder(pel), offFloor = (q: THREE.Vector3) => { const h = F.height(q) - 0.012 * s; return h < 0 ? q.addScaledVector(F.rise, -h) : q; };
      pel.add(f.dagged ? lace(on, f.underskirt!, s, tAt(2.75 * GK), g.cut, offFloor, (q) => F.height(q) - 0.012 * s) : frill(G, f.underskirt!, s));
      if (f.corset) corsetBelt(on, clothFace(G), pel, s, f.corset, (2 * Math.PI - LX * 0.42) / (2 * Math.PI), F.rise.clone().negate(), !!laid, (q, r) => { const h = F.height(q) - r; return h < 0 ? q.addScaledVector(F.rise, -h) : q; }, (fn) => afterHung.push(() => { const inv = pel.matrixWorld.clone().invert(); fn(garments.flatMap((w) => { const p = w.mesh.geometry.getAttribute('position'), m = inv.clone().multiply(w.mesh.matrixWorld), out: THREE.Vector3[] = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m)); return out; })); }));
      if (f.vines) {
        const E = embroider(on, 0.008 * s), hemT = f.dagged ? 0.9 : 0.955;
        vine(E, [0.035, hemT], [0.965, hemT], s);
        for (const u of [0.028, 0.972]) vine(E, [u, tAt(2.7 * GK)], [u, hemT - 0.045], s);
        pel.add(E.mesh(f.vines));
      }
      if (!f.gownTrim) return;
      if (!f.vines) {
        const hemLine: THREE.Vector3[] = []; for (let i = 0; i <= 48; i++) hemLine.push(clothPoint(G, i / 48, tAt(0.06), 0.012 * s));
        pel.add(tube(hemLine, 0.025 * s, f.gownTrim));
        for (const u of [0, 1]) {
          const edge: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) edge.push(clothPoint(G, u, tAt((2.85 - i * 0.279) * GK), 0.01 * s));
          pel.add(tube(edge, 0.02 * s, f.gownTrim));
          for (let i = 1; i < 10; i += 2) { const q = clothPoint(G, u, tAt((2.85 - i * 0.279) * GK), 0.025 * s), leaf = sph(0.045 * s, f.gownTrim, 6, 4); leaf.scale.set(0.5, 1, 0.25); leaf.rotation.z = (u ? 1 : -1) * (i % 4 === 1 ? 0.7 : -0.7); pel.add(at(leaf, q.x, q.y, q.z)); }
        }
      }
      if (f.corset) return;
      const belt: THREE.Vector3[] = []; for (let i = 0; i <= 32; i++) belt.push(clothPoint(G, i / 32, tAt(3.72 * GK), 0.015 * s));
      pel.add(tube(belt, 0.022 * s, f.gownTrim, false));
    } });
    if (f.gownTrim) { const r = ringAt(tr, 1.57); up.add(sm(loftGeometry([{ ...r, y: 1.55 }, { ...r, y: 1.585 }], s, { seg: 80, k: 1.015, rows: 1, warp: bustWarp, jig: bustJig, bump: f.vines ? chestBump : undefined }), f.gownTrim)); } // the neckline's edge (on the finer dress it stands off the shoulder blades as it does off the rest of the skin)
  }


  // pointed ears
  if (f.ears === 'pointed') for (const sx of [-1, 1]) { const e = sm(new THREE.ConeGeometry(0.09 * s, 0.5 * s, 8), skin); e.scale.z = 0.45; e.position.set(sx * 0.36 * s, hy + 0.06 * s, -0.02 * s); e.rotation.z = -sx * 1.05; e.rotation.x = -0.35; up.add(e); }

  buildHair(head, s, hy - headAt, f, fr.fem);

  // armour
  if (f.armor?.kind === 'plate') {
    const t = f.armor.trim ?? '#a9adb6', eng = f.armor.knotwork, cor = f.armor.corset, steel = f.armor.color;
    const bare = new Set<THREE.Object3D>(); if (eng || cor) body.traverse((o) => bare.add(o)); // (what the body has on before its harness)
    // an engraved harness's fine lines: the lining of an edge, a strand of knotwork
    const wire = (pts: THREE.Vector3[], c: string, r = 0.009 * s, closed = false) => sm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), pts.length * 2, r, 4, closed), c);
    const span = <T>(n: number, at: (u: number) => T): T[] => Array.from({ length: n + 1 }, (_, i) => at(i / n));
    // a band of knotwork laid on a plate (`on(u, v)`: a point on it, u along the band, v across it from -1 to 1): two
    // strands plaited across each other `n` times between two fine lines
    const knotBand = (on: (u: number, v: number) => THREE.Vector3, n: number, parent: THREE.Object3D) => {
      for (const ph of [0, Math.PI]) parent.add(wire(span(n * 4, (u) => on(u, 0.6 * Math.sin(u * n * Math.PI + ph))), eng!, 0.0075 * s));
      for (const v of [-1, 1]) parent.add(wire(span(Math.max(4, n), (u) => on(u, v)), eng!, 0.005 * s));
      // (a band that does not run all the way round is closed across each end, so no strand ends loose)
      if (on(0, 0).distanceTo(on(1, 0)) > 0.02 * s) for (const u of [0, 1]) parent.add(wire(span(2, (v) => on(u, 2 * v - 1)), eng!, 0.005 * s));
    };
    // a point on a plate shaped to a stack of rings (as shellGeometry cuts it), a little proud of it
    const onShell = (rings: Ring[], y0: number, y1: number, k0: number, k1: number) => (th: number, y: number, off = 0.012) => { const [x, z] = ringPoint(ringAt(rings, y), th, k0 + (k1 - k0) * (y0 - y) / (y0 - y1) + off); return new THREE.Vector3(x * s, y * s, z * s); };
    // a plate cut freely on a stack of rings: `cut(u, v)` gives each point's angle round them, height and scale
    const patch = (rings: Ring[], cut: (u: number, v: number) => [number, number, number], seg: number, rows: number) => {
      const pos: number[] = [];
      for (let i = 0; i <= rows; i++) for (let j = 0; j <= seg; j++) { const [th, y, k] = cut(j / seg, i / rows), [x, z] = ringPoint(ringAt(rings, y), th, k); pos.push(x * s, y * s, z * s); }
      return gridGeometry(pos, seg + 1, rows);
    };
    // pauldrons: a broad domed cap over the shoulder and two lames below it hugging the upper arm, each a curved plate
    // edged in trim with rivets, overlapping down the arm and tipped out at the lower edge; they ride the shoulder joint,
    // so they lift and swing with the arm
    arm.forEach((l, k) => {
      const sx = k === 0 ? RX : LX, ar = 0.19 * fr.arm * s;
      const trimArc = (r: number, arc: number, mid: number) => { const g = new THREE.Group(); g.rotation.y = arc / 2 - mid; const tr2 = sm(new THREE.TorusGeometry(r, 0.016 * s, 5, 32, arc), t); tr2.rotation.x = Math.PI / 2; g.add(tr2); return g; };
      // the cap: a shell over the top and outside of the shoulder, wider than deep
      const cr = ar * 1.75, cap0 = new THREE.Group(); cap0.position.set(sx * 0.02 * s, -0.04 * s, 0); cap0.rotation.z = sx * 0.28; l.root.add(cap0);
      if (eng) {
        // (engraved: the first of three lames, a shallow plate lying over the top of the shoulder, finely lined at its edge)
        const lip = 1.22, flat = 0.58, onCap = (a: number, ph: number, off = 0.008) => new THREE.Vector3(Math.cos(a) * Math.sin(ph) * cr, Math.cos(ph) * cr * flat + off * s, Math.sin(a) * Math.sin(ph) * cr * 0.92);
        const dome = sm(new THREE.SphereGeometry(cr, 28, 8, 0, Math.PI * 2, 0, lip), steel, true); dome.scale.set(1, flat, 0.92); cap0.add(dome);
        cap0.add(wire(span(28, (u) => onCap(u * Math.PI * 2, lip, 0)), t, 0.009 * s, true));
        knotBand((u, v) => onCap((sx > 0 ? 0 : Math.PI) + (u - 0.5) * 1.5, 0.86 + 0.11 * v), 4, cap0);
      } else {
      const dome = sm(new THREE.SphereGeometry(cr, 32, 14, 0, Math.PI * 2, 0, 1.5), f.armor!.color, true); dome.scale.set(1, 0.72, 0.92); cap0.add(dome);
      const rimY = cr * 0.72 * Math.cos(1.5), rimR = cr * Math.sin(1.5), rim = trimArc(rimR, Math.PI * 2, 0); rim.position.y = rimY; rim.scale.z = 0.92; cap0.add(rim);
      for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2; cap0.add(at(sph(0.02 * s, t, 6, 4), Math.cos(a) * rimR * 0.97, rimY + 0.012 * s, Math.sin(a) * rimR * 0.92 * 0.97)); }
      }
      // the lames: curved plates round the outer two thirds of the arm, shaped to it (the deltoid swelling under the upper
      // one), each tucked under the one above and tipped out at its lower edge
      const rings = upperArmRings(fr, sx), wrap = 3.9, th0 = sx * Math.PI / 2 - wrap / 2;
      // (engraved: the lames hang from inside the cap, on the arm's full round carried straight up into it where the
      // shoulder itself rounds in, so the first runs up under the cap with no gap for skin to show in; each is cut
      // narrower toward its top, clear of the body beside it, and finely lined along its lower edge and down its two ends)
      const hung = rings.map((r) => (r.y > -0.22 ? { ...ringAt(rings, -0.22), y: r.y } : r)), wrapAt = (y: number) => wrap - 0.9 * Math.min(1, Math.max(0, (y + 0.25) / 0.35));
      if (eng) { // (and an arming sleeve under them, over the round of the shoulder and down to above the strap)
        const dark = tone(steel, '#000000', 0.3), round = sph(0.2 * fr.arm * s, dark, 14, 8); round.scale.set(1.04, 0.8, 1.04);
        l.root.add(sm(shellGeometry(rings, 0, -0.44, 0, Math.PI * 2, 1.035, 1.035, s, 20, 8), dark, true), at(round, 0, -0.08 * s, 0));
      }
      for (let i = 0; i < 2; i++) {
        const y0 = -0.06 - i * 0.19, y1 = y0 - 0.27, k0 = 1.17 - 0.02 * i, k1 = k0 + 0.09, c = i % 2 || eng ? f.armor!.color : tone(f.armor!.color, '#ffffff', 0.06);
        if (eng) {
          const top = i ? y0 : 0.1, kAt = (y: number) => k0 + (k1 - k0) * (y0 - y) / (y0 - y1), on = (u: number, y: number, off = 0): [number, number, number] => [sx * Math.PI / 2 + (u - 0.5) * wrapAt(y), y, kAt(y) + off];
          const pt = (u: number, y: number, off: number) => { const [th, yy, k] = on(u, y, off), [x, z] = ringPoint(ringAt(hung, yy), th, k); return new THREE.Vector3(x * s, yy * s, z * s); };
          l.root.add(sm(patch(hung, (u, v) => on(u, top + (y1 - top) * v), 24, 6), c, true));
          l.root.add(wire([...span(4, (u) => pt(0, y0 - 0.02 + (y1 - y0 + 0.02) * u, 0.004)), ...span(20, (u) => pt(u, y1, 0.006)).slice(1), ...span(4, (u) => pt(1, y1 + (y0 - 0.02 - y1) * u, 0.004)).slice(1)], t));
          if (i === 1) knotBand((u, v) => pt(0.5 + (u - 0.5) * 2.2 / wrapAt(y0 - 0.17), y0 - 0.17 + 0.045 * v, 0.012), 5, l.root);
          continue;
        }
        l.root.add(sm(shellGeometry(rings, y0, y1, th0, wrap, k0, k1, s), c, true));
        const edge: THREE.Vector3[] = []; for (let j = 0; j <= 24; j++) { const [x, z] = ringPoint(ringAt(rings, y1), th0 + wrap * j / 24, k1 + 0.01); edge.push(new THREE.Vector3(x * s, y1 * s, z * s)); }
        l.root.add(tube(edge, 0.016 * s, t));
        for (const q of [-0.8, 0, 0.8]) { const [x, z] = ringPoint(ringAt(rings, y0 - 0.05), sx * Math.PI / 2 + q, k0 + 0.03); l.root.add(at(sph(0.018 * s, t, 6, 4), x * s, (y0 - 0.05) * s, z * s)); }
      }
      if (!eng) return;
      // the pauldron's strap, buckled round the upper arm beneath it
      const leather = cor?.belts ?? '#4a3424', sy = -0.66, [bx, bz] = ringPoint(ringAt(rings, sy), sx * Math.PI / 2 + 0.5, 1.05);
      l.root.add(sm(shellGeometry(rings, sy + 0.035, sy - 0.035, 0, Math.PI * 2, 1.035, 1.035, s, 20, 1), leather, true));
      l.root.add(at(box(0.05 * s, 0.085 * s, 0.05 * s, f.buckle ?? t), bx * s, sy * s, bz * s));
      // the vambrace: one plate round the forearm from the wrist to the elbow, cut low in the crook of the arm and rising
      // to cover the point of the elbow behind, a cuff flaring out over the gauntlet and on past the wrist, its edges
      // finely lined, knotwork round it
      const fa = forearmRings(fr), v1 = -0.88, c1 = -1.068, vk = 1.15, ck = 1.75, vTop = (th: number) => 0.005 - 0.05 * Math.cos(th), onV = onShell(fa, 0, v1, vk, vk), onC = onShell(fa, v1, c1, vk, ck);
      l.mid.add(sm(patch(fa, (u, v) => [u * Math.PI * 2, vTop(u * Math.PI * 2) + (v1 - vTop(u * Math.PI * 2)) * v, vk], 16, 8), steel, true), sm(shellGeometry(fa, v1, c1, 0, Math.PI * 2, vk, ck, s, 16, 2), steel, true));
      l.mid.add(wire(span(16, (u) => onV(u * Math.PI * 2, vTop(u * Math.PI * 2), 0.004)).slice(1), t, 0.009 * s, true));
      for (const [on, y] of [[onV, v1 + 0.01], [onC, c1]] as const) l.mid.add(wire(span(16, (u) => on(u * Math.PI * 2, y, 0.004)).slice(1), t, 0.009 * s, true));
      knotBand((u, v) => onV(u * Math.PI * 2, -0.62 + 0.05 * v), 8, l.mid);
      // the gauntlet's wrist: a sleeve from inside the cuff down over the top of the hand, which bends within it, closed
      // across the wrist so no skin shows up inside it
      l.mid.add(sm(shellGeometry(fa, v1 + 0.04, -1.055, 0, Math.PI * 2, 1.07, 1.1, s, 14, 3), f.gauntlets ?? steel, true), sm(patch(fa, (u, v) => [u * Math.PI * 2, -1.046, 1.08 - 1.07 * v], 14, 1), f.gauntlets ?? steel, true));
      // the gauntlet's plate: a thin shell over the back of the hand only, from short of the wrist to the knuckles,
      // standing just off the glove and turned in to it at its edge (in the palm's own flattened measure)
      const hu = 0.105 * (l.hs ?? 1) * s, back: number[] = [];
      for (const [v, c] of [[0, 0.014], [0.3, 0.014], [0.6, 0.014], [0.85, 0.014], [0.95, 0.013], [1, 0.007]]) for (let j = 0; j <= 16; j++) {
        const a = j / 16 * Math.PI * 2, ph = v * (0.8 - 0.27 * Math.sin(a));
        back.push(Math.sin(ph) * Math.cos(a) * (hu + c * s / 0.9), Math.sin(ph) * Math.sin(a) * (hu + c * s / 1.15), -Math.cos(ph) * (hu + c * s / 0.42));
      }
      l.hand.add(sm(gridGeometry(back, 17, 5), tone(f.gauntlets ?? steel, '#ffffff', 0.1), true));
    });
    { const gg = sm(new THREE.CylinderGeometry(0.3 * fr.m.neck * s, 0.44 * fr.m.neck * s, 0.26 * s, 24, 1, true), f.armor.color, true); up.add(at(gg, 0, 2.22 * s, -0.01 * s)); // gorget: a flared collar of plate, edged at the top
      const gt = sm(new THREE.TorusGeometry(0.3 * fr.m.neck * s, (eng ? 0.01 : 0.018) * s, 5, 24), t); gt.rotation.x = Math.PI / 2; up.add(at(gt, 0, 2.35 * s, -0.01 * s)); }
    // (engraved: the gorget's foot is carried on down as a yoke of plate over the top of the chest and in under the
    // breastplate's top edge, so no seam stands open between the two)
    if (eng) up.add(sm(shellGeometry(tr, 2.13, 1.9, -1.1, 2.2, 1.105, 1.075, s, 16, 6), f.armor.color, true));
    const plateK = 1.09, plateBump = (th: number, y: number) => 0.05 * Math.exp(-((y - 1.5) ** 2) / 0.08) * Math.max(0, Math.cos(th)) ** 2 + 0.03 * Math.max(0, Math.cos(th)) ** 12;
    // the breastplate's bands: rims lying on its curve across the front
    const onPlate = (y: number, a: number) => { const r = ringAt(tr, y), [x, z] = ringPoint(r, a, plateK * (1 + plateBump(a, y)) + 0.012), q = bustWarp([x, y, z]); return new THREE.Vector3(q[0] * s, y * s, q[2] * s); };
    if (!eng) for (const [y, a, rr] of [[1.5, 1.05, 0.035], [0.95, 0.75, 0.028]] as const) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 12; i++) pts.push(onPlate(y, -a + 2 * a * i / 12)); up.add(tube(pts, rr * s, t)); }
    // (over a corset its lower edge is cut to a point under the bust: level round the ribs and the back, dipping to the
    // point at the front; what of the plate would lie below the edge is turned in under it, as its thickness)
    const edgeAt = (x: number, z: number) => 1.02 - 0.24 * Math.max(0, 1 - Math.abs(Math.atan2(x, z)) / 0.6) ** 1.3;
    const cutWarp = (p: [number, number, number]): [number, number, number] => { const e = edgeAt(p[0], p[2]); return p[1] >= e ? bustWarp(p) : [p[0] * 0.95, e - 0.02, p[2] * 0.95]; };
    { const bp = sm(loftGeometry(clipRings(tr, 0.62, 1.95), s, { seg: fr.bust ? 72 : 32, rows: fr.bust ? 60 : undefined, k: plateK, warp: cor ? cutWarp : bustWarp, jig: bustJig, bump: plateBump }), f.armor.color); bp.userData.skin = true; up.add(bp); } // the breastplate, ridged down its centre
    if (eng) up.add(wire(span(8, (u) => onPlate(1.88 - 0.8 * u, Math.PI)), t, 0.008 * s)); // (engraved: a fine line down the backplate's spine)
    if (cor) {
      // the corset: dark leather close on the waist from under the breastplate down into the girdle of the hips, laced
      // down its front; the plate's cut edge finely lined, knotwork along it above the point
      const lace = cor.lacing ?? tone(cor.color, '#000000', 0.45), waist = sm(loftGeometry(clipRings(tr, 0.5, 1.14), s, { seg: 40, rows: 8, k: 1.055 }), cor.color); waist.userData.skin = true; up.add(waist);
      const onEdge = (a: number, lift = 0) => { let y = 1.02; for (let i = 0; i < 3; i++) { const [x, z] = ringPoint(ringAt(tr, y), a, plateK); y = edgeAt(x, z); } return onPlate(y + lift, a); };
      up.add(wire(span(48, (u) => onEdge(u * Math.PI * 2, 0.012)).slice(1), t, 0.01 * s, true));
      if (eng) knotBand((u, v) => onEdge((u - 0.5) * 1.5, 0.1 + 0.04 * v), 6, up);
      for (const y of [0.74]) for (const sx of [-1, 1]) { const x = box(0.15 * s, 0.022 * s, 0.022 * s, lace); x.rotation.z = sx * 0.5; up.add(at(x, 0, y * s, (ringAt(tr, y).f * 1.055 + 0.008) * s)); }
    }
    // the fauld: four lames round the belly and hips, each flaring a little and lapping over the one below, a rolled rim
    // on each (the last one bright); it rests on the hips, as the tassets and the culet hung from it, but its lames give
    // with the body as it bends and turns, each turned a share of the way with the chest (FAULD_GIVE), the breastplate's
    // lower edge under the first
    const hips = hipStack(tr, pelvisRings(fr)), lighter = tone(f.armor.color, '#ffffff', 0.06), rolled = tone(f.armor.color, '#ffffff', 0.18);
    for (let i = 0; i < 4; i++) {
      const y0 = 0.68 - i * 0.17, y1 = y0 - 0.2, k0 = 1.12 + i * 0.05, k1 = k0 + 0.065, lg = new THREE.Group(); lg.name = 'fauld' + i; pel.add(lg); lames.push(lg);
      if (cor) continue; // (over a corset the girdle is of leather, cut below)
      lg.add(sm(shellGeometry(hips, y0, y1, 0, Math.PI * 2, k0, k1, s, 40, 3), i % 2 ? lighter : f.armor.color, true));
      const rim: THREE.Vector3[] = []; for (let j = 0; j <= 40; j++) { const [x, z] = ringPoint(ringAt(hips, y1), (j / 40) * Math.PI * 2, k1 + 0.012); rim.push(new THREE.Vector3(x * s, y1 * s, z * s)); }
      lg.add(tube(rim, (i === 3 ? 0.02 : 0.016) * s, i === 3 ? t : rolled, true));
    }
    // (over a corset the fauld is its leather girdle: three lames round the hips, each a closed ring a constant step
    // outside the one above and flaring to a fine rolled rim, its top run up under the rim above with room between, so no
    // two share a surface. Leather gives with the body where plate turns lame by lame: every height of it turns its own
    // share with the chest, all the way at the waist and as the last lame does at its foot, so the lames keep their
    // places on one another however she bends. It follows the seat, a little off it)
    const GE = GIRDLE.edges, GT = GE[0], GB = GE[3], lameAt = GIRDLE.out;
    const lean = new THREE.Quaternion(); if (cor) lean.setFromEuler(new THREE.Euler(...trunk(poseOf(f, battle, dead, gown).spine ?? [0, 0, 0])));
    const foot = new THREE.Quaternion().slerp(lean, FAULD_GIVE[3]).invert(), give = new THREE.Quaternion();
    // (round the tops of the tassets, which hang inside its foot: how far out they stand each way from the hips' axis)
    const TASSET = [0.02, 1.3] as const, past = new Float32Array(96), own = new Float32Array(96), plain = new Float32Array(96), fill = new Float32Array(96);
    if (cor) {
      for (const sx of [RX, LX]) for (let j = 0; j <= 24; j++) { const [x, z] = ringPoint(ringAt(thighRings(fr), TASSET[0]), sx * 0.42 - 1.05 + 2.1 * j / 24, TASSET[1]), a = Math.round((Math.atan2(x + sx * fr.hipX, z) / (Math.PI * 2) + 1) * 96); for (let k = -3; k <= 3; k++) past[(a + k + 96) % 96] = Math.max(past[(a + k + 96) % 96], Math.hypot(x + sx * fr.hipX, z)); }
      for (let n = 0; n < 3; n++) { const was = past.slice(); for (let a = 0; a < 96; a++) past[a] = Math.max(was[a], (was[(a + 95) % 96] + was[a] + was[(a + 1) % 96]) / 3); }
      // (and its foot is one easy round: how far the tassets and the seat stand out past the hips' plain section there
      // is carried on round the hips either side of them and eased away, and the foot filled out to that, so its last
      // edge never waves between them)
      for (let j = 0; j < 384; j++) {
        const th = j / 384 * Math.PI * 2, [px, pz] = ringPoint(ringAt(hips, GB), th, GIRDLE.line(GB)), [x, z] = ringPoint(ringAt(hips, GB), th, Math.max(GIRDLE.line(GB), 1.03 * (1 + seatBump(th, GB)) + 0.02));
        const a = Math.round((Math.atan2(x, z) / (Math.PI * 2) + 1) * 96) % 96; own[a] = Math.max(own[a], Math.hypot(x, z)); plain[a] = Math.max(plain[a], Math.hypot(px, pz));
      }
      for (let a = 0; a < 96; a++) fill[a] = Math.max(past[a] - 0.02, own[a]) / plain[a] - 1;
      for (let n = 0; n < 60; n++) { const was = fill.slice(); for (let a = 0; a < 96; a++) fill[a] = Math.max(was[a], (was[(a + 95) % 96] + was[a] + was[(a + 1) % 96]) / 3); }
      for (let a = 0; a < 96; a++) fill[a] = Math.max(0, plain[a] * (1 + fill[a]) / own[a] - 1);
      // (what keeps a hand off the body reads the girdle's swell from here: how far out its foundation stands each way
      // at its foot, and how much of that it has taken at a height)
      lames[3].userData.swell = (x: number, z: number, y: number) => { const a = (Math.atan2(x, z) / (Math.PI * 2) + 1) * 96, a0 = Math.floor(a), at = (t: Float32Array) => t[a0 % 96] + (t[(a0 + 1) % 96] - t[a0 % 96]) * (a - a0); return [at(past) - 0.02, Math.min(1, Math.max(0, (0.32 - y) / 0.24)), at(fill) * Math.min(1, Math.max(0, (GE[2] - y) / 0.12))]; };
    }
    const hipAt = (th: number, y: number): [number, number] => {
      const [x, z] = ringPoint(ringAt(hips, y), th, Math.max(GIRDLE.line(y), 1.03 * (1 + seatBump(th, y)) + 0.02));
      const r = Math.hypot(x, z), a = (Math.atan2(x, z) / (Math.PI * 2) + 1) * 96, a0 = Math.floor(a), at = <T extends Float32Array>(t: T) => t[a0 % 96] + (t[(a0 + 1) % 96] - t[a0 % 96]) * (a - a0), need = at(past) - 0.02;
      const k = 1 + Math.max(Math.min(1, Math.max(0, (0.32 - y) / 0.24)) * Math.max(0, need / r - 1), Math.min(1, Math.max(0, (GE[2] - y) / 0.12)) * at(fill)); // (the fill on the last lame alone, below the rim above it)
      return [x * k, z * k];
    };
    /** A point of the girdle in the last lame's frame: round the hips at a height, `d` out from its foundation. */
    const onGirdle = (th: number, y: number, d: number) => {
      const [x, z] = hipAt(th, y), a = hipAt(th - 0.03, y), b = hipAt(th + 0.03, y), tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
      give.identity().slerp(lean, FAULD_GIVE[3] + (1 - FAULD_GIVE[3]) * Math.min(1, Math.max(0, (y - GB) / (GT - GB)))).premultiply(foot);
      return new THREE.Vector3((x - tz / l * d) * s, y * s, (z + tx / l * d) * s).applyQuaternion(give);
    };
    let lip: M | undefined;
    const hoop = (prof: [number, number][], c: string) => sm(gridGeometry(prof.flatMap(([y, d]) => span(48, (u) => onGirdle(u * Math.PI * 2, y, d)).flatMap((p) => p.toArray())), 49, prof.length - 1), c, true);
    if (cor) {
      const welt = tone(cor.color, '#000000', 0.3), strap = cor.belts ?? '#5a3d28', lace = cor.lacing ?? tone(cor.color, '#000000', 0.45);
      for (let i = 0; i < 3; i++) {
        const y1 = GE[i + 1], y0 = GE[i] + (i ? GIRDLE.lap : 0);
        // (the first is turned in at its top onto the corset)
        lames[3].add(hoop([...(i ? [] : [[GT + 0.03, -0.012]]), ...span(4, (u) => [y0 + (y1 - y0) * u, lameAt(i, y0 + (y1 - y0) * u)])] as [number, number][], cor.color));
        lames[3].add(wire(span(48, (u) => onGirdle(u * Math.PI * 2, y1, lameAt(i, y1))).slice(1), welt, GIRDLE.rim * s, true));
      }
      // (the last lame's foot is turned in a little below its rim, down over the top of the coat skirt hung inside it,
      // so nothing shows between the two from any side)
      lip = hoop([[GB + 0.004, lameAt(2, GB) - 0.003], [GB - 0.05, lameAt(2, GB) - 0.012]], cor.color); lames[3].add(lip);
      // the belts: two straps round the girdle, one at the waist and one low on the hips, each a band of its own lying on
      // the face of one lame, clear of it, buckled at the front to either side of the lacing, its tongue run on through
      // a keeper
      for (const [i, y, h, az] of [[0, 0.625, 0.07, 0.42], [2, 0.075, 0.07, -0.5]] as const) {
        const d = (yy: number) => lameAt(i, yy) + 0.012;
        lames[3].add(hoop([[y + h / 2, d(y + h / 2) - 0.01], [y + h / 2 - 0.008, d(y + h / 2)], [y - h / 2 + 0.008, d(y - h / 2)], [y - h / 2, d(y - h / 2) - 0.01]], strap));
        const p0 = onGirdle(az, y, d(y)), bk = new THREE.Group(); bk.position.copy(p0); bk.lookAt(onGirdle(az, y, d(y) + 0.1)); lames[3].add(bk);
        bk.add(at(box(0.13 * s, (h + 0.045) * s, 0.03 * s, f.buckle ?? t), 0, 0, 0.012 * s), at(box(0.07 * s, (h - 0.01) * s, 0.034 * s, strap), 0, 0, 0.012 * s), at(box(0.035 * s, (h + 0.02) * s, 0.026 * s, tone(strap, '#000000', 0.3)), Math.sign(az) * 0.13 * s, 0, 0.008 * s));
      }
      // the lacing, on down the front of the girdle between the belts, each cross lying on its lame
      for (const [i, y] of [[0, 0.53], [0, 0.44], [1, 0.27], [1, 0.2]] as const) for (const sx of [-1, 1]) {
        const x = box(0.15 * s, 0.022 * s, 0.022 * s, lace), g = new THREE.Group(); g.position.copy(onGirdle(0, y, lameAt(i, y) + 0.008)); g.lookAt(onGirdle(0, y, lameAt(i, y) + 0.108));
        x.rotation.z = sx * 0.5; g.add(x); lames[3].add(g);
      }
    }
    // the belt's buckle, on the front of the fauld's first lame, lying on its slope (it turns as the lame does)
    if (f.buckle && !cor) {
      const y = 0.58, r = ringAt(hips, y), k = 1.12 + 0.065 * (0.68 - y) / 0.2, tilt = Math.atan(0.065 * r.f / 0.2), z = ((r.z ?? 0) + r.f * k) * s;
      for (const [w, h, d, c] of [[0.24, 0.2, 0.06, f.buckle], [0.12, 0.1, 0.07, f.trim ?? '#2b2420']] as const) { const b = box(w * s, h * s, d * s, c); b.rotation.x = -tilt; lames[0].add(at(b, 0, y * s, z + (d / 2 - 0.01) * s)); }
    }
    if (f.armor.emblem === 'helm') {
      // Helm's holy symbol, borne on the breastplate below the bust: an upright gauntlet, palm out (a flared cuff, the
      // palm, four fingers of their own lengths with room between them, the thumb standing off at an angle), an open eye
      // on the palm; a thin flat relief cut from sheet and laid to the plate's own curve
      const e = 0.27 * s, c = eng ?? t, deep = 0.006 * s, lay = (shapes: THREE.Shape[], col: string, lift: number, d: number) => {
        const g = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 5 }), pos = g.getAttribute('position'), du = new THREE.Vector3(), dv = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) * e, y = 1.23 + pos.getY(i) * e / s; let a = 0;
          for (let n = 0; n < 4; n++) { const p = onPlate(y, a); a += (x - p.x) / Math.max(0.05 * s, (onPlate(y, a + 0.02).x - p.x) / 0.02); }
          const p = onPlate(y, a); du.subVectors(onPlate(y, a + 0.02), p); dv.subVectors(onPlate(y + 0.02, a), p);
          p.addScaledVector(du.cross(dv).normalize(), lift + pos.getZ(i) * d); pos.setXYZ(i, p.x, p.y, p.z);
        }
        g.computeVertexNormals(); up.add(sm(g, col));
      };
      const hand = new THREE.Shape(), w = 0.085, r = w / 2, root = 0.1; hand.moveTo(-0.2, -0.24); hand.quadraticCurveTo(-0.2, -0.28, -0.16, -0.28); hand.lineTo(0.16, -0.28); hand.quadraticCurveTo(0.2, -0.28, 0.2, -0.24);
      [0.22, 0.31, 0.36, 0.3].forEach((len, i) => { const x = 0.1575 - i * 0.105; hand.lineTo(x + r, root); hand.lineTo(x + r, root + len - r); hand.absarc(x, root + len - r, r, 0, Math.PI, false); hand.lineTo(x - r, root); }); // little finger to index
      hand.closePath();
      const cuff = new THREE.Shape([[-0.27, -0.54], [0.27, -0.54], [0.19, -0.31], [-0.19, -0.31]].map(([x, y]) => new THREE.Vector2(x, y)));
      const thumb = new THREE.Shape(); thumb.absarc(0, 0.26, 0.05, 0, Math.PI, false); thumb.lineTo(-0.05, 0); thumb.lineTo(0.05, 0); thumb.closePath();
      const turned = new THREE.Shape(thumb.getPoints(5).map((q) => q.rotateAround(new THREE.Vector2(), 0.75).add(new THREE.Vector2(-0.215, -0.2))));
      const eye = new THREE.Shape(); eye.moveTo(-0.15, -0.1); eye.quadraticCurveTo(0, 0.02, 0.15, -0.1); eye.quadraticCurveTo(0, -0.22, -0.15, -0.1);
      const pupil = new THREE.Shape(); pupil.absarc(0, -0.1, 0.036, 0, Math.PI * 2, false);
      lay([hand, cuff, turned], c, 0.002 * s, deep); lay([eye], steel, 0.002 * s + deep, 0.001 * s); lay([pupil], c, 0.002 * s + deep, 0.002 * s);
    } else if (!eng) { const knot = sm(new THREE.TorusKnotGeometry(0.1 * s, 0.022 * s, 48, 6, 2, 3), t); up.add(at(knot, 0, 1.25 * s, 0.44 * s)); } // a knotwork boss
    // tassets: a plate of two lames down the front of each thigh, and a culet of two over the seat, each hanging from the
    // fauld's last rim and swinging out as one piece over a thigh that lifts under it (kit/cloth.ts)
    const plateTrims = (G: Garment, rims: number[], parent: THREE.Object3D) => {
      if (eng) { // (engraved: each lame's rim and the plate's two sides finely lined, knotwork across the last lame)
        const v = (r: number) => r / (G.rows - 1), mid = (rims[rims.length - 2] + rims[rims.length - 1] + 1) / 2;
        for (const r of rims) parent.add(wire(span(12, (u) => clothPoint(G, u, v(r), 0.006 * s)), t));
        for (const u of [0, 1]) parent.add(wire(span(G.rows - 1, (w) => clothPoint(G, u, cor ? 0.12 + 0.88 * w : w, cor && !w ? -0.006 * s : 0.004 * s)), t, 0.007 * s)); // (under a girdle with a coat skirt they start below the coat's top, turned in, so no end of one shows between the two)
        knotBand((u, w) => clothPoint(G, 0.12 + 0.76 * u, v(mid) + 0.045 * w, 0.01 * s), 5, parent);
        return;
      }
      rims.forEach((r, i) => { const pts: THREE.Vector3[] = []; for (let j = 0; j <= 12; j++) pts.push(clothPoint(G, j / 12, r / (G.rows - 1), 0.012 * s)); parent.add(tube(pts, 0.018 * s, i === rims.length - 1 ? t : rolled)); });
      for (const u of [0.12, 0.88]) parent.add(at(sph(0.022 * s, t, 6, 4), ...clothPoint(G, u, 0.06, 0.012 * s).toArray()));
    };
    // (over a corset a coat skirt of its leather hangs from under the girdle's last lame to above the knee, open at the
    // front from hip to hip: it covers the seat in the culet's place and the backs and sides of the thighs, its two front
    // edges under the tassets' outer sides, so the tassets hang as they would over the thighs alone; a weapon slung on
    // the back lies on it. Its top is out of sight inside the last lame; from there it falls as soft leather does,
    // flaring a little into shallow folds, its front corners rounded off, a vent slit up the middle of the back)
    if (cor) {
      const rows = 14, gap = 2.6, pos: number[] = [], top = GB - 0.012, len = 1.08, mid = (DRAPE_COLS - 1) / 2, thAt = (u: number) => gap / 2 + (Math.PI * 2 - gap) * u;
      for (let i = 0; i <= rows; i++) for (let j = 0; j < DRAPE_COLS; j++) {
        const v = i / rows, th = thAt(j / (DRAPE_COLS - 1)), edge = Math.max(0, 1 - Math.min(j, DRAPE_COLS - 1 - j) / 5);
        const y = top - len * v + 0.2 * edge * edge * v * v, p = onGirdle(th, GB, lameAt(2, GB) - 0.02), k = 1 + (0.05 + 0.025 * Math.sin(7 * th + 0.7) - 0.1 * edge * edge) * (top - y);
        pos.push(p.x * k, y * s, p.z * k);
      }
      wear('coat', sm(gridGeometry(pos, DRAPE_COLS, rows), cor.color, true), lames[3], DRAPE_COLS, rows + 1, { closed: false, cutTop: true, covers: ['pelvis', ...LEGS, ...FEET], outside: [...LOWER_ARMS, 'stowed'], layer: 0, clear: 0.02 * s, spread: 5, hang: 0.8, after: (G) => {
        // (a weapon slung on the back lies on the coat: where it would still graze the leather, the coat gives way
        // under it in one shallow dent)
        const slung = body.getObjectByName('stowed'), geo = G.mesh.geometry, cp = geo.getAttribute('position') as THREE.BufferAttribute;
        if (slung) { giveWay(G.mesh, DRAPE_COLS, slung, 0.02 * s, 0.3 * s); if (lip) giveWay(lip, 49, slung, 0.008 * s, 0.3 * s); } // (and the girdle's turned-in foot over it, less)
        // the vent: a slit from the hem half way up the middle of the back, its two edges straight and parting a
        // little toward the hem (the cloth between them cut out, the edges drawn in from the next fold either side)
        const r0 = Math.round(rows / 2), a = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = r0; i <= rows; i++) { c.fromBufferAttribute(cp, i * DRAPE_COLS + mid); for (const j of [mid - 1, mid + 1]) { a.fromBufferAttribute(cp, i * DRAPE_COLS + j).lerp(c, 1 - 0.8 * (i - r0) / (rows - r0)); cp.setXYZ(i * DRAPE_COLS + j, a.x, a.y, a.z); } }
        const was = geo.getIndex()!, idx: number[] = [];
        for (let n = 0; n < was.count; n += 6) { const q = was.getX(n), i = Math.floor(q / DRAPE_COLS), j = q % DRAPE_COLS; if (i < r0 || (j !== mid - 1 && j !== mid)) for (let k = 0; k < 6; k++) idx.push(was.getX(n + k)); }
        geo.setIndex(idx); cp.needsUpdate = true; geo.computeVertexNormals();
        // its hem and the edges of the split and the vent, finely welted
        const welt = tone(cor.color, '#000000', 0.35), u0 = (mid - 1) / (DRAPE_COLS - 1), u1 = (mid + 1) / (DRAPE_COLS - 1);
        for (const [ua, ub] of [[0, u0], [u1, 1]]) lames[3].add(wire(span(28, (u) => clothPoint(G, ua + (ub - ua) * u, 1, 0.004 * s)), welt, 0.008 * s));
        for (const u of [0, 1]) lames[3].add(wire(span(10, (w) => clothPoint(G, u, w, 0.004 * s)), welt, 0.008 * s));
        for (const u of [u0, u1]) lames[3].add(wire(span(rows - r0, (w) => clothPoint(G, u, (r0 + (rows - r0) * w) / rows, 0.004 * s)), welt, 0.006 * s));
      } });
    }
    for (const sd of ['R', 'L'] as const) {
      const sx = sd === 'R' ? RX : LX, hx = fr.hipX * s, rings = thighRings(fr);
      const L = lamesGeometry(rings, sx * 0.42 - 1.05, 2.1, eng ? [[0.02, -0.3, 1.3, 1.372], [-0.25, -0.54, 1.35, 1.402], [-0.49, -0.74, 1.382, 1.43]] : [[0.02, -0.4, 1.3, 1.38], [-0.35, -0.74, 1.32, 1.42]], s, 13, eng ? 3 : 4);
      L.geo.translate(sx * hx, 0, 0);
      const m = sm(L.geo, f.armor.color, true);
      wear('tasset' + sd, m, lames[3], L.cols, L.rows, { closed: false, axis: [sx * hx, 0], covers: [`thigh${sd}`], layer: 1, clear: 0.03 * s, spread: 0, hang: 0, stiff: true, lames: L.rims, after: (G) => plateTrims(G, L.rims, lames[3]) });
    }
    // (the culet hangs straight down from the rim, as wide as the hips are at the tops of the thighs: below that the
    // seat narrows into the fork, which a plate cannot follow, and the thighs there would stand out past it; it rides out
    // over a full seat as over a thigh)
    if (!cor) { const seatRings = hips.map((r) => (r.y < -0.05 ? { ...ringAt(hips, -0.05), y: r.y } : r)), L = lamesGeometry(seatRings, Math.PI - 1.1, 2.2, [[-0.02, -0.3, 1.24, 1.32], [-0.26, -0.5, 1.3, 1.42]], s, 15, 4, (th, y) => 0.5 * seatBump(th, y));
      wear('culet', sm(L.geo, lighter, true), lames[3], L.cols, L.rows, { closed: false, covers: ['thighR', 'thighL', 'pelvis'], layer: 1, clear: 0.03 * s, spread: 0, hang: 0, stiff: true, lames: L.rims, after: (G) => plateTrims(G, L.rims, lames[3]) }); }
    for (const l of leg) {                                                                              // knees and greaves
      // the knee cop: a shaped plate over the front of the knee with a fan at its outside, on the knee's middle line, so
      // it sits on the bend whatever the knee does (see bendLimb)
      const sx = l === leg[0] ? RX : LX, cop = new THREE.Group(); l.mid.add(cop); cops.push(cop);
      // (engraved: above the knee the cop stands off the thigh all the way up, so its top edge is one clean line clear of the leg)
      // and below it the cop runs down inside the greave's top, never out through it)
      const thAt = (y: number) => ringAt(thighRings(fr), y - THIGH), off = (y: number) => 1.05 + 0.1 * y, inGreave = (y: number, d: number, of: number) => d + Math.min(0, of * 1.31 - 0.02 - d) * Math.min(1, -y / 0.12);
      const shell: Ring[] = []; for (let i = 0; i <= 8; i++) {
        const y = -0.3 + 0.6 * i / 8, k = Math.sqrt(Math.max(eng && y > 0 ? 0.66 : 0.02, 1 - (y / 0.32) ** 2)), r = { y, w: 0.25 * fr.leg * k, f: 0.29 * fr.leg * k, b: 0.15 * fr.leg * k }, sr = ringAt(shinRings(fr), y);
        shell.push(!eng ? r : y > 0 ? { y, w: Math.max(r.w, thAt(y).w * off(y)), f: Math.max(r.f, thAt(y).f * off(y)), b: r.b } : { y, w: inGreave(y, r.w, sr.w), f: inGreave(y, r.f, sr.f), b: r.b });
      }
      cop.add(sm(shellGeometry(shell, 0.26, -0.27, -1.75, 3.5, 1, 1, s, 20, 8), f.armor.color, true));
      const fan: Ring[] = shell.map((r) => ({ ...r, w: r.w * 1.06 }));
      cop.add(sm(shellGeometry(fan, 0.17, -0.17, sx * Math.PI / 2 - 0.65, 1.3, 1, 1, s, 10, 6), eng ? steel : lighter, true));
      // (engraved: the cop is fuller at its top, so its edge stands clear of the thigh, and finely lined all round)
      if (eng) { const on = (th: number, y: number) => { const [x, z] = ringPoint(ringAt(shell, y), th, 1.02); return new THREE.Vector3(x * s, y * s, z * s); }; cop.add(wire([...span(16, (u) => on(-1.75 + 3.5 * u, 0.26)), ...span(4, (u) => on(1.75, 0.26 - 0.53 * u)).slice(1), ...span(16, (u) => on(1.75 - 3.5 * u, -0.27)).slice(1), ...span(4, (u) => on(-1.75, -0.27 + 0.53 * u)).slice(1, -1)], t, 0.009 * s, true)); }
      else for (const y of [0.26, -0.27]) { const pts: THREE.Vector3[] = []; for (let j = 0; j <= 16; j++) { const [x, z] = ringPoint(ringAt(shell, y), -1.75 + 3.5 * j / 16, 1.02); pts.push(new THREE.Vector3(x * s, y * s, z * s)); } cop.add(eng ? wire(pts, t) : tube(pts, 0.016 * s, t)); }
      // (engraved: one fine line down the front of the thigh, from under the tasset to under the cop's top: the cuisse's ridge)
      if (eng) l.root.add(wire(span(8, (u) => { const y = -0.66 - (THIGH - 0.2 - 0.66) * u, [x, z] = ringPoint(ringAt(thighRings(fr), y), 0, 1.012); return new THREE.Vector3(x * s, y * s, z * s + 0.003 * s); }), t, 0.007 * s));
      // (engraved: the greave stands out over the boot's cuff, one plate from the knee to the ankle, finely lined at its two ends)
      const sh = shinRings(fr), cuff = ringAt(sh, -0.55), wide = (r: Ring): Ring => (r.y > -0.7 && r.y < -0.42 ? { ...r, w: Math.max(r.w, cuff.w), f: Math.max(r.f, cuff.f), b: Math.max(r.b, cuff.b) } : r);
      const greave = eng ? Array.from({ length: 20 }, (_, i) => wide(ringAt(sh, -1.05 + 0.93 * i / 19))) : clipRings(sh, -1.05, -0.12);
      l.mid.add(sm(loftGeometry(greave, s, { seg: 14, k: eng ? 1.31 : 1.22, rows: eng ? 38 : 18 }), f.armor.color));
      if (eng) {
        const on = onShell(greave, -0.12, -1.05, 1.31, 1.31); for (const y of [-0.16, -1.02]) l.mid.add(wire(span(14, (u) => on(u * Math.PI * 2, y, 0.004)).slice(1), t, 0.009 * s, true));
        // the sabaton: two lames over the instep and the toes of the boot, the upper lapping the lower, each finely lined
        // at its lower edge
        const fl = fr.fem ? 1.02 : 1.18, ft: Ring[] = [{ y: -0.42, w: 0.15 * fl, f: 0.52 * fl, b: 0.2 * fl, z: 0.02 }, { y: -0.3, w: 0.165 * fl, f: 0.5 * fl, b: 0.21 * fl, z: 0.02 }, { y: -0.16, w: 0.14 * fl, f: 0.3 * fl, b: 0.17 * fl }, { y: -0.02, w: 0.125 * fl, f: 0.15 * fl, b: 0.14 * fl }];
        for (const [y0, y1, k0, k1] of [[-0.2, -0.36, 1.04, 1.07], [-0.05, -0.24, 1.1, 1.12]]) {
          const onF = onShell(ft, y0, y1, k0, k1);
          l.end.add(sm(shellGeometry(ft, y0, y1, -1.9, 3.8, k0, k1, s, 14, 3), steel, true), wire(span(14, (u) => onF(-1.9 + 3.8 * u, y1, 0.004)), t, 0.008 * s));
        }
        continue;
      }
      for (const y of [-0.18, -1.0]) { const r = ringAt(shinRings(fr), y); l.mid.add(sm(loftGeometry([{ ...r, y: y - 0.03 }, { ...r, y: y + 0.03 }], s, { seg: 14, k: 1.3, rows: 1 }), t)); }
    }
    if (eng || cor) body.traverse((o) => { if ((o as M).isMesh && !bare.has(o) && !o.userData.garment) harness.push(o as M); });
  }
  if (f.armor?.kind === 'mail') {
    // the shirt: close on the body to the hips, hanging from there over the tops of the thighs (kit/cloth.ts lifts it over
    // a thigh, and a foot drawn up under it), with bright rows of rings laid round it; or cut as a chain shirt: fitted,
    // hanging straight to an uneven hem, its rings in fine rows
    const cs = gown ? undefined : f.chainShirt, ringC = cs && f.armor.trim ? f.armor.trim : tone(f.armor.color, '#ffffff', 0.15), mc = cs ? f.armor.color : f.armor.trim ?? f.armor.color;
    const hemY = cs ? -0.45 : MAIL_HEM, tAt = (y: number) => (MAIL_TOP - y) / (MAIL_TOP - hemY), TAU = Math.PI * 2;
    // rows of rings on a surface (`pt`: a point of it, `u` round it and a height; nothing where the surface is cut away):
    // each row a fine ribbon running round in a zigzag, every other row a step round, so they read as links, not bands
    const ringRows = (pt: (u: number, y: number) => THREE.Vector3 | undefined, y0: number, y1: number, teeth: number) => {
      const strips: [THREE.Vector3[], THREE.Vector3[]][] = [];
      for (let y = y0, k = 0; y >= y1 - 1e-6; y -= 0.066, k++) {
        let a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
        for (let j = 0; j <= 2 * teeth; j++) {
          const u = j / (2 * teeth), yy = y + ((j + k) % 2 ? 0.013 : -0.013), p = pt(u, yy + 0.01), q = p && pt(u, yy - 0.01);
          if (p && q) { a.push(p); b.push(q); } else { if (a.length > 1) strips.push([a, b]); a = []; b = []; }
        }
        if (a.length > 1) strips.push([a, b]);
      }
      return strips;
    };
    // (a chain shirt's yoke lies on the chest; below the breast it is drawn out and down onto the hung mail, a little over
    // a row below where that is cut, wherever that has come to hang: the one runs into the other with no shelf between.
    // With no hung mail given it goes back to its cut, as the mail is hung over it)
    const YOKE_FOOT = 1.56, yokeParts: [M, Float32Array, number][] = []; let yokeSeam: [M, M] | undefined;
    const meetHung = yokeMeet = (G?: Garment) => {
      const from = YOKE_FOOT, lip = MAIL_TOP + 0.035, d = new THREE.Vector3(), q = new THREE.Vector3();
      for (const [m, cutAt, off] of yokeParts) {
        const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = cutAt[3 * i], y = cutAt[3 * i + 1], z = cutAt[3 * i + 2], th = Math.atan2(x, z), c = clampTo((from - y / s) / (from - lip), 0, 1), k = c * c * (3 - 2 * c);
          if (!G || k === 0) { pos.setXYZ(i, x, y, z); continue; }
          const u = ((th / TAU) % 1 + 1) % 1; d.copy(clothPoint(G, u, 1.25 / MAIL_ROWS, off)).sub(onChest(th, lip, 1.1, 0)).clampLength(0, 0.2 * s).multiplyScalar(k).add(q.set(x, y, z));
          // (and nowhere inside the hung mail's first rows, which swell out under it)
          let r = 0; for (let j = 0; j <= 8; j++) { q.copy(clothPoint(G, u, j / 4 / MAIL_ROWS, off)); r = Math.max(r, Math.hypot(q.x, q.z) - Math.abs(q.y - d.y)); }
          const r0 = Math.hypot(d.x, d.z), out = clampTo(r / r0, 1, 1 + 0.04 * s / r0); pos.setXYZ(i, d.x * out, d.y, d.z * out);
        }
        pos.needsUpdate = true; m.geometry.computeVertexNormals();
      }
      // (shaded as one surface across the line where the two pieces meet)
      if (yokeSeam) {
        const [a, b] = yokeSeam.map((m) => m.geometry.getAttribute('normal') as THREE.BufferAttribute), n = new THREE.Vector3(), at0 = a.count - 73;
        yokeSeam[0].geometry.computeVertexNormals();
        for (let j = 0; j < 73; j++) { n.fromBufferAttribute(a, at0 + j).add(d.fromBufferAttribute(b, j)).normalize(); a.setXYZ(at0 + j, n.x, n.y, n.z); b.setXYZ(j, n.x, n.y, n.z); }
        a.needsUpdate = b.needsUpdate = true;
      }
    };
    const cut = cs ? { top: MAIL_TOP, hem: hemY, rows: MAIL_ROWS, ease: [1.1, 1.08] as [number, number], flare: -0.07, flareFrom: 0, folds: 9, amp: 0.012, jag: 0.05, seed: 0.7, warp: bustWarp, seat: seatBump }
      : { top: MAIL_TOP, hem: MAIL_HEM, rows: MAIL_ROWS, ease: [1.08, 1.1] as [number, number], flare: 0.12, flareFrom: 0, warp: bustWarp, seat: seatBump };
    wear('mail', bodyCut(tr, pelvisRings(fr), s, mc, cut), up, DRAPE_COLS, MAIL_ROWS + 1, { closed: true, covers: ['torso', 'pelvis', ...LEGS, ...FEET, 'hem'], outside: [...ARMS, ...HANDS], layer: 1, clear: 0.03 * s, spread: 4, hang: 0.6, ...(cs ? { anchored: 0 } : {}), after: (G) => {
      if (cs) { up.add(ribbons(ringRows((u, y) => clothPoint(G, u, tAt(y), 0.007 * s), MAIL_TOP - 0.17, hemY + 0.03, 52), ringC)); meetHung(G); return; }
      for (const y of [1.15, 0.8, 0.45, 0.1, MAIL_HEM + 0.03]) { const pts: THREE.Vector3[] = []; for (let j = 0; j < 40; j++) pts.push(clothPoint(G, j / 40, (MAIL_TOP - y) / (MAIL_TOP - MAIL_HEM), 0.012 * s)); up.add(tube(pts, 0.018 * s, ringC, true)); }
    } });
    if (cs) {
      // above the hung cloth the shirt lies on the chest, as the torso is lofted (pectorals and all) and as far out from
      // it as the cloth is cut
      const chest = (th: number, y: number, off: number) => onChest(th, y, cut.ease[0], off);
      // (down to the foot of the breast it is worn close, as the body's own; from there to just above where the hung cloth
      // is cut, a piece of its own that is drawn onto the hung cloth: see above)
      const span = (y0: number, y1: number, rows: number, cols: number) => { const pos: number[] = []; for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { const q = chest(TAU * j / cols, y0 + (y1 - y0) * i / rows, 0); pos.push(q.x, q.y, q.z); } return sm(gridGeometry(pos, cols + 1, rows), mc, true); };
      const yk = span(2.12, YOKE_FOOT, 8, 72), lap = span(YOKE_FOOT, MAIL_TOP + 0.035, 8, 72); yk.userData.skin = true; lap.userData.part = 'yoke'; up.add(yk, lap);
      // the V of the neck: its half width at a height, and the angle round the chest that far out from the middle
      const vTop = 2.1, vFoot = YOKE_FOOT, half = (y: number) => 0.2 * clampTo((y - vFoot) / (vTop - vFoot), 0, 1), thAt = (x: number, y: number) => Math.asin(clampTo(x / ringAt(tr, y).w, -1, 1));
      const yokeRings = ribbons(ringRows((u, y) => { const th = u * TAU; return Math.cos(th) > 0 && Math.abs(Math.sin(th)) * ringAt(tr, y).w < half(y) + 0.015 ? undefined : chest(th, y, (y < YOKE_FOOT ? 0.013 : 0.007) * s); }, 2.007, MAIL_TOP + 0.045, 52), ringC); up.add(yokeRings); for (const [m, off] of [[lap, 0.002 * s], [yokeRings, 0.009 * s]] as const) yokeParts.push([m, (m.geometry.getAttribute('position').array as Float32Array).slice(), off]);
      yokeSeam = [yk, lap];
      // the shirt worn under it showing in the V, and the mail's edge down either side of it
      const pos: number[] = [], edge: [THREE.Vector3[], THREE.Vector3[]][] = [[[], []], [[], []]];
      for (let i = 0; i <= 8; i++) {
        const y = vTop - (vTop - vFoot) * i / 8, h = half(y);
        for (let j = 0; j < 5; j++) { const q = chest(thAt(h * (j / 2 - 1), y), y, 0.004 * s); pos.push(q.x, q.y, q.z); }
        [-1, 1].forEach((sx, k) => { edge[k][0].push(chest(thAt(sx * h, y), y, 0.009 * s)); edge[k][1].push(chest(thAt(sx * (h + 0.03), y), y, 0.009 * s)); });
      }
      up.add(sm(gridGeometry(pos, 5, 8), cs.under ?? f.sleeves ?? f.trim ?? '#3a2a1c', true), ribbons(edge, ringC));
    }
    const band = (rings: Parameters<typeof loftGeometry>[0], y: number, h: number, k: number, c: string, seg = 16) => { const r = ringAt(rings, y); return sm(loftGeometry([{ ...r, y: y - h / 2 }, { ...r, y: y + h / 2 }], s, { seg, k, rows: 1 }), c); };
    arm.forEach((l, k) => { // short mail sleeves to halfway down the upper arm, over the deltoid, with a loose hem
      const sx = k === 0 ? RX : LX, ur = upperArmRings(fr, sx), sk = cs ? 1.1 : 1.14;
      l.root.add(sm(loftGeometry(clipRings(ur, -0.55, 0.0), s, { seg: 20, k: sk }), mc));
      if (!cs) { l.root.add(band(ur, -0.53, 0.05, 1.2, ringC, 20)); return; }
      l.root.add(band(ur, -0.535, 0.03, 1.125, ringC, 20));
      l.root.add(ribbons(ringRows((u, y) => { const [x, z] = ringPoint(ringAt(ur, y), u * TAU, sk + 0.02); return new THREE.Vector3(x * s, y * s, z * s); }, -0.12, -0.5, 16), ringC));
    });
  }

  // cloak (with a hood folded on the shoulders): it hangs in folds
  if (f.cloak) {
    // the cloak hangs behind from the shoulders, under a capelet; on a gown, from the back below the bare shoulders. Hung
    // on the posed body (kit/cloth.ts): it drapes over an arm swung back or raised, a knee lifted under it, the seat, and
    // on a body laid out it falls to the floor and lies there
    const jag = f.tattered ? 0.45 * s : 0.05 * s, under = ['torso', 'pelvis', ...LEGS, ...FEET, ...ARMS, ...HANDS, 'stowed'];
    // laurel embroidery on hung cloth: a fine stem along a line of it (`line`: u and t at each step along, 0 to 1), with
    // `n` pairs of small leaves growing forward off it, close to it on either side; `across` is a step in u and t to the stem's side
    const laurel = (G: Garment, line: (k: number) => [number, number], across: [number, number], n: number, c: string) => {
      const P = (k: number) => clothPoint(G, ...line(k), 0.014 * s), a: THREE.Vector3[] = [], b: THREE.Vector3[] = [], ls: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
      for (let i = 0; i <= 2 * n; i++) {
        const k = i / (2 * n), p = P(k), [u, t] = line(k), side = clothPoint(G, u + across[0], t + across[1], 0.014 * s).sub(p).normalize(), along = P(Math.min(1, k + 0.01)).sub(P(Math.max(0, k - 0.01))).normalize();
        a.push(p.clone().addScaledVector(side, 0.006 * s)); b.push(p.clone().addScaledVector(side, -0.006 * s));
        if (i % 2) for (const sd of [-1, 1]) ls.push([p, p.clone().addScaledVector(along, 0.06 * s).addScaledVector(side, sd * 0.042 * s), new THREE.Vector3().crossVectors(along, side)]);
      }
      const stem = ribbons([[a, b]], c), sprays = leaves(ls, 0.03 * s, c); stem.userData.laurel = sprays.userData.laurel = true;
      up.add(stem, sprays);
    };
    const edges = (G: Garment) => {
      if (gown) return;
      if (f.cloakLaurel) {
        for (const u of [0.035, 0.965]) laurel(G, (k) => [u, 0.05 + 0.9 * k], [u < 0.5 ? 0.02 : -0.02, 0], 44, f.cloakLaurel);
        laurel(G, (k) => [0.07 + 0.86 * k, 0.965], [0, -0.02], 36, f.cloakLaurel);
        return;
      }
      if (!f.cloakTrim) return;
      const hemLine: THREE.Vector3[] = []; for (let i = 0; i <= 40; i++) hemLine.push(clothPoint(G, i / 40, 1, 0.012 * s));
      up.add(tube(hemLine, 0.03 * s, f.cloakTrim));
      for (const u of [0, 1]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 16; i++) pts.push(clothPoint(G, u, 0.03 + 0.95 * i / 16, 0.012 * s)); up.add(tube(pts, 0.035 * s, f.cloakTrim)); }
    };
    // the embroidery of a gown's cloak: a vine down each front edge and along above the hem
    const cloakVines = (G: Garment) => {
      if (!f.vines) return;
      const E = embroider(clothFace(G, laid?.n.clone().transformDirection(up.matrixWorld.clone().invert())), 0.008 * s);
      for (const u of [0.035, 0.965]) vine(E, [u, 0.05], [u, 0.86], s);
      vine(E, [0.07, 0.9], [0.93, 0.9], s);
      up.add(E.mesh(f.vines));
    };
    // a round brooch pinned on hung cloth at [u, t], its face along the cloth's: it stands clear of all the cloth under
    // it (the cloth's own curve there, and any fold of it lying over the place on a body laid out), and clear of the floor
    const pin = (G: Garment, on: ClothFace, u: number, t: number) => {
      const b = new THREE.Group(), c0 = on(u, t), n = on(u, t, 1).sub(c0), P = G.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, d = new THREE.Vector3(); let proud = 0;
      for (let i = 0; i < P.count; i++) { const h = d.fromBufferAttribute(P, i).sub(c0).dot(n); if (h > proud && h < 0.12 * s && d.lengthSq() - h * h < (0.16 * s) ** 2) proud = h; }
      b.position.copy(c0).addScaledVector(n, proud + 0.03 * s); b.quaternion.setFromUnitVectors(Y_AXIS, n);
      if (laid) { const F = floorUnder(up), k = n.clone().transformDirection(up.matrixWorld).dot(F.n), h = F.height(b.position) - (0.085 * Math.sqrt(1 - k * k) + 0.03 * Math.abs(k) + 0.01) * s; if (h < 0) b.position.addScaledVector(F.rise, -h); }
      b.add(cyl(0.07 * s, 0.07 * s, 0.03 * s, f.brooch!, 12), at(sph(0.038 * s, tone(f.brooch!, '#ffffff', 0.3), 8, 6), 0, 0.015 * s, 0), sm(new THREE.TorusGeometry(0.07 * s, 0.013 * s, 5, 14).rotateX(Math.PI / 2), tone(f.brooch!, '#000000', 0.25))); up.add(b);
      return b.position;
    };
    // (on a gown it hangs from the back below the bare shoulders, a brooch on each top corner where the cloth shows
    // beside the arm; between full sleeves it is cut narrower at the top, to hang behind them and not through their
    // frills)
    if (gown && !f.shoulderCloak) { const c = drape(1.0 * s, 1.35 * s, 3.9 * s, f.cloak, { folds: 7, amp: 0.12, jag, seed: 0.3, gap: Math.PI * (f.fullSleeves ? 1.4 : 1.25), rows: 24 }); c.scale.z = 0.5; c.position.set(0, -0.55 * s, -0.2 * s);
      wear('cloak', c, up, DRAPE_COLS, 25, { closed: false, axis: [0, -0.2 * s], covers: [...under, 'gown', 'culet', 'tassetR', 'tassetL'], outside: ['shield'], layer: 2, anchored: 0.15 * s, clear: 0.05 * s, spread: 6, hang: 0.9, after: (G) => {
        if (f.brooch) { const on = clothFace(G, laid?.n.clone().transformDirection(up.matrixWorld.clone().invert())); for (const u of [0.07, 0.93]) pin(G, on, u, 0.09); }
        cloakVines(G);
      } }); }
    // a gown's cloak worn on the shoulders: the brooches on the front corners of its mantle, and the cord between them
    const GOWN_CAPE_GAP = 1.5;
    const pinned = (G: Garment) => {
      const on = clothFace(G, laid?.n.clone().transformDirection(up.matrixWorld.clone().invert()));
      if (f.vines) { const E = embroider(on, 0.008 * s); vine(E, [0.05, 0.86], [0.95, 0.86], s); up.add(E.mesh(f.vines)); }
      if (!f.brooch) return;
      // (on the front of each shoulder, facing forward; on a body laid out up by the neckline, where the cloth stays on
      // the body)
      const pinT = laid ? 0.25 : 0.45, [bR, bL] = [0.97, 0.03].map((u) => pin(G, on, u, pinT));
      // (the cord: from each brooch over the cloth's edge beside it, and from one edge to the other sagging a little,
      // lying on the chest where the chest stands forward of it; on a body laid out the cloth has fallen open off the
      // shoulders, and no cord is drawn across it)
      if (laid) return;
      const eR = on(1, pinT, 0.03 * s), eL = on(0, pinT, 0.03 * s), line: THREE.Vector3[] = [bR];
      for (let i = 0; i <= 16; i++) {
        const k = i / 16, q = eR.clone().lerp(eL, k); q.y -= 0.07 * s * Math.sin(Math.PI * k);
        const x = q.x / s, y = q.y / s, r = ringAt(tr, y), z = (bustWarp([x, y, r.f * Math.sqrt(Math.max(0, 1 - (x / r.w) ** 2))])[2] + 0.055) * s;
        if (Math.abs(x) < r.w) q.z = Math.max(q.z, z); line.push(q);
      }
      line.push(bL);
      up.add(tube(line, 0.008 * s, tone(f.brooch, '#000000', 0.15)));
    };
    if (!gown || f.shoulderCloak) {
      const rt = ringAt(tr, 2.0), rTop = rt.w * 1.05 + 0.06, dz = -0.05, top = 2.02, hem = -2.45;
      const c = drape(rTop * s, rTop * 1.6 * s, (top - hem) * s, f.cloak, { folds: 6, amp: 0.12, jag, seed: 0.3, gap: Math.PI * 1.15, rows: 26, zs: [(rt.b + 0.06 + dz) / rTop, 0.55] });
      c.position.set(0, (top + hem) / 2 * s, dz * s);
      // (over the plates hung from the waist too, the culet and the tassets: on a body fallen face down they lie on the seat
      // and on the floor beside the hips, where the cloak falls over them)
      wear('cloak', c, up, DRAPE_COLS, 27, { closed: false, axis: [0, dz * s], covers: [...under, 'hem', 'mail', 'tails', 'skirt', ...(gown ? ['gown'] : []), 'culet', 'tassetR', 'tassetL'], outside: ['shield'], layer: 2, anchored: 0.15 * s, clear: 0.05 * s, spread: 6, hang: 0.9, after: gown ? cloakVines : edges });
      // the capelet over it: clasped at the top of its opening, a folded hood resting on it behind
      // (a gown's is pinned on the shoulders and stands wide open at the front, over the bare collarbones and the
      // bust: its top corners come forward over the shoulder caps, a round brooch on each facing forward, a fine cord
      // from one to the other across the chest)
      wear('mantle', capelet(tr, fr, s, f.cloak, gown ? GOWN_CAPE_GAP : undefined), up, DRAPE_COLS, CAPE_ROWS + 1, { closed: false, covers: ['torso', 'upperArmR', 'upperArmL', 'cloak', 'mail', 'stowed'], outside: [...LOWER_ARMS, 'shield'], holds: ['upperArmR', 'upperArmL'], layer: 3, anchored: 0, clear: 0.04 * s, spread: 6, hang: 0.5, after: (G) => {
        if (gown) { pinned(G); return; }
        if (f.cloakLaurel) laurel(G, (k) => [0.05 + 0.9 * k, 0.9], [0, -0.03], 38, f.cloakLaurel);
        if (f.clasps && f.claspMark === 'tree') for (const u of [0.05, 0.95]) {
          // a round brooch on the front of each shoulder, where the cloak is pinned: a disc lying on the cloth with a raised
          // rim, a tree in relief on it (a trunk, two boughs and a crown of leaves), its foot toward the cloth's hem
          const p = clothPoint(G, u, 0.6, 0.032 * s), n = clothPoint(G, u, 0.6, 0.06 * s).sub(p).normalize(), dark = tone(f.clasps, '#000000', 0.5), e = 0.78 * s;
          if (laid) {
            // (on a body laid out the cloth has crumpled where it fell: the brooch lies on the top of the cloth nearest
            // its place, its face along the cloth's there, a little proud of every fold under it and off the floor)
            const F = floorUnder(up), on = clothFace(G, F.rise), P = G.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, c0 = clothPoint(G, u, 0.6), d = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
            // (of the cloth's points near its place, the one where it lies lowest on the cloth round it: the top of a
            // fold or a flat of it, not the side of a crease)
            // (and clear of the head and hair fallen over that shoulder: their points near the place)
            const lain: THREE.Vector3[] = [], toUp = up.matrixWorld.clone().invert(), lim = new THREE.Box3().setFromCenterAndSize(c0, new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 * s));
            head.traverse((o) => { const hm = o as M; if (hm.isMesh) eachSurfacePoint(hm, 0.06 * s, (x, y, z) => { d.set(x, y, z).applyMatrix4(toUp); if (lim.containsPoint(d)) lain.push(d.clone()); }); });
            let best = Infinity, proud = 0;
            for (let i = 0; i < P.count; i++) {
              if (c.fromBufferAttribute(P, i).distanceTo(c0) > (lain.length ? 0.3 : 0.15) * s) continue;
              const uc = (i % G.cols) / (G.cols - 1), tc = Math.floor(i / G.cols) / (G.rows - 1); m.copy(on(uc, tc, 1)).sub(c);
              let pr = 0; for (let k = 0; k < P.count; k++) { const h = d.fromBufferAttribute(P, k).sub(c).dot(m); if (h > pr && h < 0.2 * s && d.lengthSq() - h * h < (0.13 * s) ** 2) pr = h; }
              let hairs = 0; for (const q of lain) { const h = d.subVectors(q, c).dot(m) - pr; if (h > -0.02 * s && h < 0.1 * s && d.lengthSq() - (h + pr) ** 2 < (0.12 * s) ** 2) hairs++; }
              const cost = pr + 0.15 * c.distanceTo(c0) - 0.05 * m.dot(F.rise) * s + (hairs ? (1 + 0.01 * hairs) * s : 0);
              if (cost < best) { best = cost; proud = pr; p.copy(c); n.copy(m); }
            }
            if (best < Infinity) {
              p.addScaledVector(n, proud + 0.018 * e + 0.008 * s);
              const k = n.dot(F.rise), h = F.height(p) - (0.12 * e * Math.sqrt(Math.max(0, 1 - k * k)) + 0.04 * e * Math.abs(k) + 0.01 * s); if (h < 0) p.addScaledVector(F.rise, -h);
            }
          }
          const br = new THREE.Group(), by = clothPoint(G, u, 0.54, 0).sub(clothPoint(G, u, 0.66, 0)); by.addScaledVector(n, -by.dot(n)).normalize(); br.userData.part = 'brooch';
          br.position.copy(p); br.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(by, n), by, n)); up.add(br);
          const disc = cyl(0.115 * e, 0.115 * e, 0.036 * e, tone(f.clasps, '#000000', 0.18), 18); disc.rotation.x = Math.PI / 2; br.add(disc, at(sm(new THREE.TorusGeometry(0.105 * e, 0.016 * e, 6, 18), f.clasps), 0, 0, 0.018 * e));
          br.add(at(box(0.022 * e, 0.085 * e, 0.014 * e, dark), 0, -0.035 * e, 0.022 * e));
          for (const sx of [-1, 1]) { const bough = box(0.016 * e, 0.06 * e, 0.014 * e, dark); bough.rotation.z = -sx * 0.8; br.add(at(bough, sx * 0.022 * e, 0.008 * e, 0.022 * e)); }
          for (const [x, y] of [[-0.05, 0.02], [-0.028, 0.05], [0, 0.06], [0.028, 0.05], [0.05, 0.02]]) br.add(at(sph(0.02 * e, f.clasps, 6, 4), x * e, y * e, 0.026 * e));
        }
        else if (f.clasps) for (const u of [0, 1]) {
          const p = clothPoint(G, u, 0.14, 0.03 * s), n = clothPoint(G, u, 0.14, 0.06 * s).sub(p).normalize();
          const d = cyl(0.11 * s, 0.11 * s, 0.05 * s, f.clasps, 12); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); up.add(at(d, p.x, p.y, p.z));
          const k = cap(0.015 * s, 0.12 * s, tone(f.clasps, '#000000', 0.4)); k.quaternion.copy(d.quaternion); const q = p.clone().addScaledVector(n, 0.03 * s); up.add(at(k, q.x, q.y, q.z));
        }
        if (f.hood) { const p = clothPoint(G, 0.5, 0.2, 0.12 * s), h = sph(0.5 * s, f.cloak!, 16, 10); h.scale.set(1, 0.5, 0.75); up.add(at(h, p.x, p.y + 0.05 * s, p.z)); }
      } });
    }
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
    // a flanged mace: a round steel haft, its grip wrapped in leather above a pommel; a collar under the head; the head
    // seven thin flanges round a narrow core, each a pointed kite (widest a little above its middle, thinning to its
    // edge); a finial on top
    const steel = '#7d8189', iron = '#5c6068', wrap = '#3b2a20', TAU = Math.PI * 2;
    gR.add(at(cyl(0.05 * s, 0.05 * s, 1.12 * s, iron, 10), 0, 0.94 * s, 0), at(cyl(0.058 * s, 0.058 * s, 0.78 * s, wrap, 10), 0, -0.01 * s, 0));
    gR.add(sm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => new THREE.Vector3(Math.cos(i * TAU / 4) * 0.06 * s, (-0.36 + 0.03 * i) * s, Math.sin(i * TAU / 4) * 0.06 * s))), 48, 0.014 * s, 4), tone(wrap, '#000000', 0.35)));
    gR.add(at(sph(0.078 * s, steel, 8, 6), 0, -0.44 * s, 0), at(cyl(0.07 * s, 0.07 * s, 0.035 * s, steel, 10), 0, 0.39 * s, 0));
    const collar = sm(new THREE.TorusGeometry(0.075 * s, 0.024 * s, 6, 14), steel); collar.rotation.x = Math.PI / 2; gR.add(at(collar, 0, 1.5 * s, 0));
    const core = cyl(0.075 * s, 0.075 * s, 0.4 * s, iron, 10); core.name = 'maceHead'; gR.add(at(core, 0, 1.72 * s, 0), at(cone(0.07 * s, 0.17 * s, steel, 8), 0, 2.0 * s, 0));
    const pos: number[] = [];
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7, c = Math.cos(a), n = Math.sin(a), q = (r: number, y: number, w: number) => [(c * r - n * w) * s, y * s, (n * r + c * w) * s];
      const [b0, b1, t0, t1, e0, e1] = [q(0.05, 1.53, 0.017), q(0.05, 1.53, -0.017), q(0.05, 1.93, 0.017), q(0.05, 1.93, -0.017), q(0.21, 1.76, 0.006), q(0.21, 1.76, -0.006)];
      for (const tri of [[b0, e0, t0], [b1, t1, e1], [b0, b1, e1], [b0, e1, e0], [t0, e0, e1], [t0, e1, t1]]) for (const v of tri) pos.push(...v);
    }
    const fl = new THREE.BufferGeometry(); fl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fl.computeVertexNormals(); gR.add(new THREE.Mesh(fl, mat(steel)));
  }

  // out of a fight a weapon is put away, never carried drawn: a long one slung across the back, a short one at the belt
  // (a short one hangs from the belt once the body is posed: see below)
  let atBelt: THREE.Group | undefined;
  if (!battle && !dead && f.stow !== false && f.weapon && f.weapon !== 'none' && f.weapon !== 'staff' && f.weapon !== 'torch') {
    const long = f.weapon === 'axe' || f.weapon === 'spear' || f.weapon === 'sword', st = new THREE.Group(); st.name = 'stowed';
    for (const c of [...gR.children]) st.add(c);
    if (long) { st.rotation.set(-0.13, Math.PI, RX * 0.42); st.position.set(RX * -0.55 * s, -(f.weapon === 'sword' ? 1.0 : 1.5) * s, -0.3 * s); joints0.back.add(st); } // (the butt end out past the seat and what hangs over it)
    else { st.rotation.set(Math.PI, 0, 0); joints0.beltR.add(st); atBelt = st; }
  }

  // what the left hand holds
  const o = f.offhand;
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
    const rimC = o.rim ?? '#a9adb6', sf = f.shieldFace, rim = sm(new THREE.TorusGeometry(1.0 * s, 0.07 * s, 8, 40), rimC); fg.add(rim);
    if (sf) {
      // a wide flat rim, raised off the face and studded with rivets; a band of another colour down the face
      const iron = sm(new THREE.LatheGeometry([[1.03, 0.06], [0.99, 0.1], [0.845, 0.1], [0.83, 0.07]].map(([r, y]) => new THREE.Vector2(r * s, y * s)), 40), rimC); iron.rotation.x = Math.PI / 2; fg.add(iron);
      const n = sf.rivets ?? 16; for (let i = 0; i < n; i++) { const a = ((i + 0.5) / n) * Math.PI * 2; fg.add(at(sph(0.05 * s, tone(rimC, '#ffffff', 0.4), 6, 4), Math.cos(a) * 0.92 * s, Math.sin(a) * 0.92 * s, 0.1 * s)); }
      if (sf.band) {
        const w = 0.27, R = 0.835, be = Math.asin(w / R), sh = new THREE.Shape();
        sh.absarc(0, 0, R * s, -Math.PI / 2 - be, -Math.PI / 2 + be, false); sh.absarc(0, 0, R * s, Math.PI / 2 - be, Math.PI / 2 + be, false);
        fg.add(at(sm(new THREE.ShapeGeometry(sh, 6), sf.band), 0, 0, 0.074 * s));
      }
    } else for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fg.add(at(sph(0.04 * s, rimC, 6, 4), Math.cos(a) * 0.9 * s, Math.sin(a) * 0.9 * s, 0.08 * s)); }
    if (o.mark && sf?.wreath) {
      // the emblem: two rings, each through the other, in a laurel wreath: a branch up either side from a tie at the foot
      [-1, 1].forEach((sx) => { const r = sm(new THREE.TorusGeometry(0.19 * s, 0.028 * s, 6, 28), o.mark!); r.rotation.y = sx * 0.12; fg.add(at(r, sx * 0.13 * s, 0.1 * s, 0.11 * s)); });
      const ls: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [], stems: [THREE.Vector3[], THREE.Vector3[]][] = [], out = new THREE.Vector3(0, 0, 1), z = 0.082 * s;
      for (const sx of [-1, 1]) {
        const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
        for (let i = 0; i <= 18; i++) {
          const an = -Math.PI / 2 + sx * (0.1 + 2.15 * i / 18), cs = Math.cos(an), sn = Math.sin(an), r = (0.6 - 0.04 * i / 18) * s, p = new THREE.Vector3(cs * r, sn * r + 0.02 * s, z), along = new THREE.Vector3(-sn * sx, cs * sx, 0), side = new THREE.Vector3(cs, sn, 0);
          a.push(p.clone().addScaledVector(side, 0.012 * s)); b.push(p.clone().addScaledVector(side, -0.012 * s));
          if (i % 2) for (const sd of [-1, 1]) ls.push([p, p.clone().addScaledVector(along, 0.13 * s).addScaledVector(side, sd * 0.1 * s), out]);
        }
        stems.push([a, b]);
      }
      fg.add(ribbons(stems, o.mark), leaves(ls, 0.075 * s, o.mark), at(sph(0.035 * s, o.mark, 6, 4), 0, -0.58 * s, z));
    } else if (o.mark) {
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
    if (f.wispShape === 'skull') wg.add(spectralSkull(f.wisp, s, ob ? 0.7 * s : 0.5 * s));
    else {
      wg.add(glassy(sph(0.2 * s, f.wisp, 14, 10), f.wisp, 0.75));
      const jaw = glassy(box(0.22 * s, 0.1 * s, 0.16 * s, f.wisp), f.wisp, 0.65); wg.add(at(jaw, 0, -0.17 * s, 0.05 * s));
      for (const sx of [-1, 1]) wg.add(at(sph(0.045 * s, '#1a3a2a', 8, 6), sx * 0.07 * s, 0.02 * s, 0.17 * s));
      const trail = glassy(sm(new THREE.ConeGeometry(0.16 * s, 0.75 * s, 10), f.wisp), f.wisp, 0.4); trail.rotation.x = Math.PI; wg.add(at(trail, 0, -0.55 * s, 0));
    }
  }

  // wings, halo, crown
  if (f.wings) {
    // an insect's wings, a dragonfly's: each a long clear membrane, narrow at its root between the shoulder blades, widest
    // past the middle and drawn to a point, the upper pair tall and the lower pair shorter and swept down; a net of fine
    // veins fanning from the root, forking past the middle, with cross veins closing cells between them; a glowing rim
    const n = f.wings.count ?? 4, op = f.wings.opacity ?? 0.42, rimC = f.wingRim ?? f.wings.color, base = new THREE.Color(f.wings.color), sheen = (f.wingSheen ?? []).map((c) => new THREE.Color(c));
    const pairs = n === 4 ? [{ len: 3.3, w: 0.74, y: 1.82, tilt: 0.62, curl: 0.08 }, { len: 2.4, w: 0.6, y: 1.5, tilt: -0.5, curl: -0.1 }] : [{ len: 3.2, w: 0.9, y: 1.7, tilt: 0.45, curl: 0.07 }];
    pairs.forEach((p, k) => { for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.13 * s, p.y * s, -(ringAt(tr, p.y).b + 0.03) * s); g.rotation.y = sx * 0.45; g.rotation.z = sx * p.tilt; g.userData.wing = sx; g.userData.span = p.len * s;
      // a point of the wing: `u` from the root to the tip, `v` across it from the trailing edge (-1) to the leading edge (1)
      const half = (u: number) => p.w * u ** 1.2 * (1 - u) ** 0.9 / 0.2386;
      const P = (u: number, v: number) => new THREE.Vector3(sx * u * p.len * s, (p.curl * p.len * u * u + (v > 0 ? 0.7 : 1.3) * v * half(u)) * s, 0);
      // the membrane, its colour shifting across it where the recipe gives it a sheen
      const NU = 18, NV = 6, pos: number[] = [], col: number[] = [], c = new THREE.Color();
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
        const u = i / NU, v = -1 + 2 * j / NV, q = P(u, v); pos.push(q.x, q.y, q.z);
        c.copy(base); sheen.forEach((sc, m) => c.lerp(sc, 0.85 * (0.5 + 0.5 * Math.sin((5 + 1.7 * m) * u + (2.2 - 2.6 * m) * v + 1.3 * m + 2 * k)) ** 1.5));
        col.push(c.r, c.g, c.b);
      }
      const web = glassy(new THREE.Mesh(gridGeometry(pos, NV + 1, NU), mat(f.wings!.color)), f.wings!.color, op);
      if (sheen.length) { web.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); const wm = web.material as THREE.MeshLambertMaterial; wm.vertexColors = true; wm.color.set('#ffffff'); }
      g.add(web);
      // the veins and the rim, flat ribbons in the wing's plane: one mesh, lit from within
      const vp: number[] = [], vi: number[] = [];
      const line = (pts: [number, number][], wd: number) => {
        const q = pts.map(([u, v]) => P(u, v));
        for (let i = 0; i + 1 < q.length; i++) {
          const d = q[i + 1].clone().sub(q[i]), nrm = new THREE.Vector3(-d.y, d.x, 0).setLength(wd * s / 2), o = vp.length / 3;
          for (const [e, sg] of [[q[i], 1], [q[i], -1], [q[i + 1], 1], [q[i + 1], -1]] as const) vp.push(e.x + sg * nrm.x, e.y + sg * nrm.y, 0);
          vi.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
        }
      };
      const run = (v: (u: number) => number, u0: number, u1: number, wd: number, seg = 14) => line(Array.from({ length: seg + 1 }, (_, i) => { const u = u0 + (u1 - u0) * i / seg; return [u, v(u)] as [number, number]; }), wd);
      // (the long veins from the root, each wandering a little; the lanes between them, the rim's two edges the outermost)
      const VEINS = [-1, -0.62, -0.22, 0.2, 0.62, 1].map((v0, i) => (u: number) => i % 5 ? v0 + 0.07 * Math.sin(5 * u + 1.9 * i) * Math.sin(Math.PI * u) : v0);
      run(VEINS[5], 0, 1, 0.04, 18); run(VEINS[0], 0, 1, 0.04, 18);                        // the rim: the leading and the trailing edge
      for (const v of VEINS.slice(1, -1)) run(v, 0.02, 0.985, 0.018);
      for (let i = 0; i + 1 < VEINS.length; i++) {
        // each lane: a vein forking off the lower one past the middle to run between the two, and cross veins closing the
        // cells, unevenly spaced and slanted this way and that (two short ones to each side of the fork, out of step)
        const lo = VEINS[i], hi = VEINS[i + 1], u0 = 0.34 + 0.07 * (i % 3), fork = (u: number) => lo(u) + (hi(u) - lo(u)) * (0.5 + 0.08 * Math.sin(7 * u + i)) * Math.min(1, (u - u0) / 0.16) ** 0.7;
        run(fork, u0, 0.96, 0.014, 10);
        for (let u = 0.1 + 0.05 * (i % 2), j = 0; u < 0.9; j++, u += 0.085 + 0.06 * Math.abs(Math.sin(3.7 * j + 2.3 * i))) {
          const lean = 0.035 * Math.sin(2.9 * j + 1.3 * i);
          if (u < u0 + 0.08) line([[u, lo(u)], [u + lean, hi(u + lean)]], 0.012);
          else { line([[u, lo(u)], [u + lean, fork(u + lean)]], 0.012); line([[u + 0.05, fork(u + 0.05)], [u + 0.05 - lean, hi(u + 0.05 - lean)]], 0.012); }
        }
      }
      const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); vg.setIndex(vi); vg.computeVertexNormals();
      const net = glassy(new THREE.Mesh(vg, mat(rimC)), rimC, Math.min(1, op + 0.4)), nm = net.material as THREE.MeshLambertMaterial; nm.emissive = new THREE.Color(rimC); nm.emissiveIntensity = 0.45;
      g.add(net);
      up.add(g);
    } });
  }
  // light, not matter (a halo, spectral wings): strips that brighten what lies behind them, each brightest along its
  // middle and fading to nothing at its edges, so no part of it has a hard edge. Light over light grows brighter but
  // never burns out to white (each strip lights only what is still dark behind it)
  const lightStrips = () => {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    // a strip of `n` steps along `mid(t)`, reaching `half(t)` to either side of it, `glow(t)` its colour along the middle
    const strip = (n: number, mid: (t: number) => THREE.Vector3, half: (t: number) => THREE.Vector3, glow: (t: number) => THREE.Color) => {
      const b = pos.length / 3;
      for (let i = 0; i <= n; i++) { const t = i / n, p = mid(t), h = half(t), c = glow(t); pos.push(p.x - h.x, p.y - h.y, p.z - h.z, p.x, p.y, p.z, p.x + h.x, p.y + h.y, p.z + h.z); col.push(0, 0, 0, c.r, c.g, c.b, 0, 0, 0); }
      for (let i = 0; i < n; i++) for (const o of [0, 1]) { const a = b + i * 3 + o; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
    };
    // a thread of light along `mid(t)`, `r` thick: three strips crossed about its line, so it is as wide from every side
    // and never shows a flat face or vanishes edge-on
    const thread = (n: number, mid: (t: number) => THREE.Vector3, r: number, glow: (t: number) => THREE.Color) => {
      for (let k = 0; k < 3; k++) strip(n, mid, (t) => {
        const along = mid(Math.min(1, t + 0.01)).sub(mid(Math.max(0, t - 0.01))).normalize();
        const side = new THREE.Vector3(0, 0, 1).cross(along);
        return (side.lengthSq() > 0.04 ? side : side.crossVectors(Y_AXIS, along)).normalize().applyAxisAngle(along, k * Math.PI / 3).multiplyScalar(r);
      }, glow);
    };
    const mesh = () => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.material.userData.keepLook = true; m.userData.keepLook = true; return m;
    };
    return { strip, thread, mesh };
  };
  const fadeEnds = (t: number) => Math.sin(Math.PI * t) ** 0.7;
  if (f.halo && !dead) {
    // a halo of light, not of metal: one ring of thin, broken arcs of faint gold standing wide of the head behind it, each
    // a thread of light fading out at its ends with a fainter glow about it, no two arcs quite in one plane, and three
    // small soft sparks where arcs end; open below, where the hair falls. It is tipped back a little and set on the head
    // (see below), so it turns as the head turns
    const L = lightStrips(), c = new THREE.Color(f.halo), tint = (k: number) => c.clone().multiplyScalar(k);
    const round = (a: number, r: number, z = 0) => new THREE.Vector3(Math.sin(a) * r * s, Math.cos(a) * r * s, z * s);
    for (const [a0, a1, r, z] of [[-2.0, -1.22, 0.79, 0.03], [-1.04, -0.2, 0.77, -0.04], [-0.02, 0.6, 0.8, 0.02], [0.8, 1.5, 0.78, -0.05], [1.68, 2.04, 0.79, 0.04]]) {
      const ang = (t: number) => a0 + (a1 - a0) * t, mid = (t: number) => round(ang(t), r, z + 0.03 * Math.sin(Math.PI * t)), n = Math.ceil((a1 - a0) * 12);
      L.thread(n, mid, 0.02 * s, (t) => tint(0.34 * fadeEnds(t)));
      L.strip(n, mid, (t) => round(ang(t), 0.09), (t) => tint(0.14 * fadeEnds(t)));
    }
    for (const [a, r, z] of [[-1.22, 0.79, 0.03], [0.6, 0.8, 0.02], [1.68, 0.79, 0.04]]) L.thread(4, (t) => round(a + (t - 0.5) * 0.1, r, z), 0.04 * s, (t) => tint(0.45 * Math.sin(Math.PI * t) ** 2)); // the sparks: soft motes
    const halo = L.mesh(); halo.name = 'halo'; halo.position.set(0, hy + 0.14 * s, -0.34 * s); halo.rotation.x = -0.2; up.add(halo);
  }
  // spectral wings: two great feathered wings of soft light rising behind the shoulder blades, up and out (wider in a
  // fight): along each wing's arm a row of long primaries fanning from the tip round to the wrist and secondaries hanging
  // from the forearm, two rows of coverts over their roots, and a broad faint glow under them all, so the wing is a body
  // of light and not blades. Each feather is a broad strip of light with a round tip, faint at its root, brightest before
  // its middle and fading from there; the wing fades to nothing toward the back. The two wings are alike: each a cupped
  // sheet, standing a little off the back and curving further back toward its tip, so that it rises between the back
  // and a weapon slung across it and is never one flat plane to the eye
  if (f.spiritWings && !dead) {
    const W = f.spiritWings, c = new THREE.Color(W.color), rim = new THREE.Color(W.rim ?? W.color), op = W.opacity ?? 0.5, e = 1.05;
    // (the sheet is swept back from its root, except where a weapon slung across the back leaves it only the cupped curve)
    const zb = -(ringAt(tr, 1.8).b + 0.38), slung = !battle && f.stow !== false && (f.weapon === 'axe' || f.weapon === 'spear' || f.weapon === 'sword'), sweep = slung ? 0 : 0.3;
    const wrist = battle ? [1.65, 1.0] : [1.3, 1.45], tip = battle ? [2.55, 1.2] : [1.95, 1.85], fan = battle ? [0.3, -1.3] : [0.62, -1.38];
    // a point along the wing's arm (`t` from the shoulder blade past the wrist at 0.6 to the tip), and the flight feather
    // that grows there: its angle in the wing's sheet and its length
    const arm = (t: number): [number, number] => t < 0.6 ? [wrist[0] * t / 0.6, wrist[1] * t / 0.6] : [wrist[0] + (tip[0] - wrist[0]) * (t - 0.6) / 0.4, wrist[1] + (tip[1] - wrist[1]) * (t - 0.6) / 0.4];
    const quill = (t: number): [number, number] => { const q = t < 0.6 ? Math.max(0, 0.56 - t) / 0.44 : (1 - t) / 0.4; return t < 0.6 ? [-1.4 - 0.3 * q, 1.55 - 0.5 * q] : [fan[0] + (fan[1] - fan[0]) * q, 1.95 - 0.35 * q]; };
    // (the pair is borne at its root between the shoulder blades; out of a fight it is squared up there: see below)
    const pair = new THREE.Group(); pair.name = 'spiritWings'; pair.position.set(0, 1.8 * s, zb * s); up.add(pair);
    for (const sx of [RX, LX]) {
      const L = lightStrips();
      // the sheet: `u` out from the wing's root beside the spine and `v` up, `lift` off it toward the body; it falls away
      // behind as it goes out, the more the further, and leans forward as it rises
      const P3 = (u: number, v: number, lift = 0) => { const d = u * e; return new THREE.Vector3(sx * (0.26 + d) * s, (1.8 + v * e) * s, (zb - sweep * d - 0.05 * d ** 2 - 0.012 * d ** 3 + 0.08 * v * e + lift) * s); };
      const feather = (t: number, ang: number, len: number, w: number, k: number, lift: number) => {
        const [u0, v0] = arm(t), du = Math.cos(ang), dv = Math.sin(ang), x = (i: number) => 1 - (1 - i) ** 1.6, near = (x: number) => Math.min(1, Math.max(0, (u0 + du * len * x - 0.4) / 1.2));
        // (its half width: narrow at the root, full from a third of its length, rounded off at the tip; never reaching in past the wing's root)
        const wide = (x: number) => Math.min(0.9 * (u0 + du * len * x), w * (x < 0.78 ? 0.5 + 0.5 * Math.min(1, x / 0.3) : Math.sqrt(Math.max(0, 1 - ((x - 0.78) / 0.22) ** 2))));
        L.strip(8, (i) => P3(u0 + du * len * x(i), v0 + dv * len * x(i), lift), (i) => P3(u0 + du * len * x(i) - dv * wide(x(i)), v0 + dv * len * x(i) + du * wide(x(i)), lift).sub(P3(u0 + du * len * x(i), v0 + dv * len * x(i), lift)),
          (i) => c.clone().lerp(rim, 0.7 * x(i) ** 2).multiplyScalar(op * k * Math.min(1, 0.1 + x(i) / 0.4) * (1 - Math.max(0, (x(i) - 0.45) / 0.55) ** 2) * near(x(i))));
      };
      for (let i = 0; i < 9; i++) { const t = 1 - 0.4 * i / 8; feather(t, ...quill(t), 0.3, 0.5, 0); }                                                      // primaries
      for (let i = 0; i < 7; i++) { const t = 0.56 - 0.44 * i / 6; feather(t, ...quill(t), 0.3, 0.45, 0); }                                                 // secondaries
      for (let i = 0; i < 9; i++) { const q = i / 8; feather(0.97 - 0.85 * q, fan[0] - 0.5 + (fan[1] - 0.25 - fan[0] + 0.5) * Math.min(1, q * 1.6), 0.9 - 0.2 * q, 0.2, 0.22, 0.03); } // the greater coverts
      for (let i = 0; i < 7; i++) { const q = i / 6; feather(0.92 - 0.78 * q, fan[0] - 0.7 + (fan[1] - 0.2 - fan[0] + 0.7) * Math.min(1, q * 1.5), 0.5, 0.17, 0.22, 0.06); }           // the lesser coverts
      // the glow under the feathers, from the arm to their tips, brightest halfway
      const reach = (t: number, x: number) => { const [u0, v0] = arm(t), [ang, len] = quill(t); return P3(u0 + Math.cos(ang) * len * x, v0 + Math.sin(ang) * len * x, -0.04); };
      L.strip(16, (t) => reach(0.1 + 0.9 * t, 0.5), (t) => reach(0.1 + 0.9 * t, 0.98).sub(reach(0.1 + 0.9 * t, 0.5)), (t) => c.clone().multiplyScalar(op * 0.45 * Math.min(1, t * 2.5)));
      L.strip(12, (t) => P3(...arm(0.12 + 0.88 * t), 0.06), (t) => new THREE.Vector3(0, 0.08 * e * s * fadeEnds(Math.min(1, t + 0.2)), 0), (t) => c.clone().multiplyScalar(op * 0.35 * Math.min(1, t * 3) * (1 - t ** 4))); // the wing's arm
      const wing = L.mesh(); wing.name = 'spiritWing'; wing.position.copy(pair.position).negate(); pair.add(wing);
    }
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

  // a wreath: twigs woven low round the head, their thorns and broken ends standing out no further than a leaf
  if (f.wreath) {
    const wg = new THREE.Group(); wg.position.set(0, hy + 0.2 * s, -0.03 * s); wg.rotation.x = -0.12; up.add(wg);
    const C = f.wreath.color, dark = tone(C, '#000000', 0.3), leafC = f.wreath.leaf ?? '#5a7a3a', R = 0.41 * s;
    const ring = (a: number, k = 1, y = 0) => new THREE.Vector3(Math.cos(a) * R * k, y * s, Math.sin(a) * R * k);
    for (let k = 0; k < 4; k++) {             // four strands wound round each other, each wandering a little
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, w = 4 * a + k * 1.57; pts.push(ring(a, 1 + 0.035 * Math.cos(w) + 0.02 * Math.sin(7 * a + k), 0.032 * Math.sin(w) + 0.012 * Math.sin(9 * a + 2 * k))); }
      wg.add(tube(pts, (k % 2 ? 0.02 : 0.026) * s, k % 2 ? dark : C, true));
    }
    let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 26; i++) {            // thorns, short, out and a little up or down
      const a = rnd() * Math.PI * 2, t = cone(0.014 * s, 0.07 * s, dark, 4), dir = ring(a).normalize().setY(rnd() * 0.9 - 0.3).normalize();
      t.quaternion.setFromUnitVectors(Y_AXIS, dir); t.position.copy(ring(a, 1.05, (rnd() - 0.5) * 0.05).addScaledVector(dir, 0.03 * s)); wg.add(t);
    }
    for (let i = 0; i < 9; i++) {             // broken twig ends, leaving the weave along it and barely rising
      const a = (i / 9) * Math.PI * 2 + 0.5 + rnd() * 0.3, d = i % 2 ? 1 : -1, len = 0.3 + rnd() * 0.25;
      wg.add(tube([ring(a, 1.02), ring(a + d * len * 0.5, 1.1, 0.03), ring(a + d * len, 1.2 + rnd() * 0.08, 0.05 + rnd() * 0.05)], 0.012 * s, C));
    }
    for (let i = 0; i < 14; i++) {            // small leaves, in pairs along the twigs
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, lf = sph(0.055 * s, i % 3 ? leafC : tone(leafC, '#000000', 0.25), 6, 4), out = ring(a).normalize();
      lf.scale.set(0.42, 1, 0.16); lf.quaternion.setFromUnitVectors(Y_AXIS, out.clone().setY(0.25 + rnd() * 0.6).applyAxisAngle(Y_AXIS, (i % 2 ? 1 : -1) * 0.7).normalize());
      lf.position.copy(ring(a, 1.1, 0.02 + rnd() * 0.03)); wg.add(lf);
    }
    if (f.wreath.flower) {                    // five-petal flowers, cupped a little: three big ones from the left temple to the brow, smaller ones behind the left ear and on the right
      const petalC = f.wreath.flower;
      ([[0.1, 1], [0.72, 1.15], [1.28, 0.9], [-0.62, 0.7], [2.25, 0.8], [3.0, 0.55]] as const).forEach(([a, big], n) => {
        const fl = new THREE.Group(); fl.position.copy(ring(a, 1.1, 0.03 + (n % 2) * 0.03)); fl.rotation.y = Math.atan2(fl.position.x, fl.position.z); fl.rotation.x = -0.45;
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2 + n, petal = sph(0.078 * s * big, p % 2 ? petalC : tone(petalC, '#ffffff', 0.35), 8, 5), hold = new THREE.Group();
          petal.scale.set(0.58, 1, 0.2); petal.position.y = 0.075 * s * big; petal.rotation.x = 0.32; hold.rotation.z = pa; hold.add(petal); fl.add(hold);
        }
        fl.add(at(sph(0.03 * s * big, '#d9a83a', 6, 4), 0, 0, 0.025 * s * big));
        wg.add(fl);
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
  if (P.spine) up.rotation.set(...trunk(P.spine));
  if (P.pelvis) pel.rotation.set(...trunk(P.pelvis));
  // (spectral wings out of a fight stand as a matched pair: about their root they take only a little of the trunk's own
  // turn and lean, so one is not swept back out of sight behind the other as the chest turns in an easy stance)
  { const pair = up.getObjectByName('spiritWings'); if (pair && !battle) pair.quaternion.copy(pel.quaternion).multiply(up.quaternion).invert().slerp(new THREE.Quaternion(), 1 - WINGS_SQUARE); }
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
  // a hand the pose clenches makes a closed fist; one with something in it (a shield's grip, a shut book's foot) closes round it
  for (const sd of new Set([...(P.fist ?? []).filter((x) => x === 'R' || x === 'L'), ...(!dead && (o?.kind === 'shield' || shutBook) ? ['L' as const] : [])])) { // (a dead hand lets go)
    const l = sd === 'R' ? R : Lf, held = (sd === 'R' ? gR : gL).children.length > 0, ms = l.end.children.filter((c) => (c as M).isMesh) as M[];
    if (ms.length >= 10) (held ? fistOf : clenchOf)(ms, -(sd === 'R' ? RX : LX), ((ms[0].geometry as THREE.SphereGeometry).parameters?.radius ?? 0.105) / 0.105);
  }
  // a hand with a weapon in it makes a fist round the haft (the same grip the NPC figures' gear takes)
  if (!dead && f.weapon && f.weapon !== 'none' && gR.children.length) holdFast(R.end, gR, -RX);
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
  const twoHanded = battle && !dead && !gL.children.length && gR.children.length > 0 && (f.weapon === 'axe' || f.weapon === 'spear' || f.weapon === 'staff') && (P.bothHands || (f.battlePose ?? f.stance) === 'two-handed');
  // an arm the pose sets in a fight that holds nothing pointed (a shield on the forearm, an open book on the palm, an empty
  // or casting hand) is moved out of the body if it sinks in (a full bust, a breastplate), as little as it takes
  if (battle && !dead && !P.lie && !P.seated) arm.forEach((A, k) => {
    const sd = k === 0 ? 'R' : 'L', sx = k === 0 ? RX : LX, g = k === 0 ? gR : gL, held = g.children.length > 0;
    if ((held && !(sd === 'L' && mounted)) || (sd === 'L' && twoHanded)) return; // (the second hand on a haft is solved below)
    const r0 = A.root.rotation.clone(), m0 = A.mid.rotation.x;
    A.collar!.updateMatrixWorld(true); if (sink(armBalls(A, sx)) < 1e-6) return;
    solveArm(A, () => { A.collar!.updateMatrixWorld(true); return 400 * sink(armBalls(A, sx)) + (A.root.rotation.x - r0.x) ** 2 + (A.root.rotation.y - r0.y) ** 2 + (A.root.rotation.z - r0.z) ** 2 + (A.mid.rotation.x - m0) ** 2; }, 0.15);
    body.updateMatrixWorld(true);
  });
  // out of a fight the free hand goes under a book held open, never into it: where the pose brings that hand into the
  // covers or the pages it is laid flat under the cover of the half the other hand does not hold, the palm up against it,
  // the arm moved as little as that takes
  if (!battle && !dead && mounted && o?.kind === 'book' && !gR.children.length && !P.lie) {
    const A = R, u = (A.hs ?? 1) * s, hm = handMeshes(A.end), q = new THREE.Vector3(), pad = 0.012 * s;
    const boxes = (gL.children.find((c) => (c as THREE.Group).isGroup)?.children ?? []).filter((c) => (c as M).geometry?.type === 'BoxGeometry') as M[];
    const size = (b: M) => (b.geometry as THREE.BoxGeometry).parameters;
    const inBook = (balls: [THREE.Vector3, number][]) => {
      let c = 0;
      for (const b of boxes) {
        const { width, height, depth } = size(b);
        for (const [p, r] of balls) {
          b.worldToLocal(q.copy(p));
          const dx = Math.abs(q.x) - width / 2, dy = Math.abs(q.y) - height / 2, dz = Math.abs(q.z) - depth / 2;
          const gap = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(0, Math.max(dx, dy, dz)), d = Math.max(0, r + pad - gap) / s;
          c += d * d;
        }
      }
      return c;
    };
    body.updateMatrixWorld(true);
    if (hm.length >= 10 && boxes.length >= 4 && inBook(armBalls(A, RX)) > 1e-6) {
      // (the free half's cover is the one further from the hand that holds the book; the palm's middle goes under it,
      // inside its edges, the palm's face turned up to it: brought in from below, then up to the cover)
      const held = Lf.end.getWorldPosition(new THREE.Vector3()), far = (b: M) => b.getWorldPosition(new THREE.Vector3()).distanceTo(held);
      const cover = boxes.filter((b) => size(b).height < 0.06 * s && size(b).width > 0.3 * s).sort((a, b) => far(b) - far(a))[0], cs = size(cover);
      const palm = new THREE.Vector3(0, -0.03 * s - 0.1 * u, 0.005 * s), stand = 0.06 * u + pad, upW = new THREE.Vector3(), nW = new THREE.Vector3();
      const r0 = A.root.rotation.clone(), m0 = A.mid.rotation.x, q0 = A.end.quaternion.clone(), shape = hm.map((m) => [m.position.clone(), m.quaternion.clone()] as const), sunk = sink(armBalls(A, RX));
      const w = wristTurnOf(q0, RX) as unknown as Record<string, number>, wrist: Knob[] = [[w, 'twist', -3.2, 3.2], [w, 'dev', -1, 1], [w, 'bend', -1.5, 1.5]];
      const kept = () => (A.root.rotation.x - r0.x) ** 2 + (A.root.rotation.y - r0.y) ** 2 + (A.root.rotation.z - r0.z) ** 2 + (A.mid.rotation.x - m0) ** 2;
      const pose = () => { A.end.quaternion.copy(wristQ(wristIn(w as unknown as WristTurn), RX)); A.collar!.updateMatrixWorld(true); return armBalls(A, RX); };
      const miss = (below: number) => { cover.worldToLocal(q.copy(palm).applyMatrix4(A.end.matrixWorld)); return Math.hypot(q.x - clampTo(q.x, -cs.width / 2 + 0.1 * s, cs.width / 2 - 0.1 * s), q.y + cs.height / 2 + stand + below, q.z - clampTo(q.z, -cs.depth / 2 + 0.12 * s, cs.depth / 2 - 0.12 * s)) / s; };
      const faced = () => nW.set(0, 0, 1).transformDirection(A.end.matrixWorld).dot(upW.set(0, 1, 0).transformDirection(cover.matrixWorld));
      const under = (below: number) => () => { const balls = pose(); return 400 * (inBook(balls) + Math.max(0, sink(balls) - sunk)) + 40 * miss(below) ** 2 + 0.8 * (1 - faced()) + 0.05 * kept(); };
      const asPosed = () => { A.root.rotation.copy(r0); A.mid.rotation.x = m0; Object.assign(w, wristTurnOf(q0, RX)); }, there = () => inBook(pose()) < 1e-4 && miss(0) < 0.1 && faced() > 0.8; // (the wrist's own thickness keeps the palm a little under the cover)
      shapeHand(hm, -RX, u, s, FLAT);
      solveArm(A, under(0), 0.3, wrist);
      if (!there()) { asPosed(); solveArm(A, under(0.3 * s), 0.5, wrist); solveArm(A, under(0.1 * s), 0.2, wrist); solveArm(A, under(0), 0.1, wrist); }
      if (!there()) {
        // (out of reach under the book: the arm keeps its pose and its hand, and is moved clear of the book only)
        asPosed(); hm.forEach((m, k) => { m.position.copy(shape[k][0]); m.quaternion.copy(shape[k][1]); });
        solveArm(A, () => { const balls = pose(); return 400 * (inBook(balls) + Math.max(0, sink(balls) - sunk)) + kept(); }, 0.15);
      }
      body.updateMatrixWorld(true);
    }
  }
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
      for (const sd of onBody.keys()) for (const n of ['upperArm', 'forearm', 'hand']) for (const m of [w.parts, w.surface, w.bones, w.volumes, w.pieces]) m?.delete(n + sd);
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
  // body, the bust, the breastplate and the weapon arm.
  if (twoHanded) {
    body.updateMatrixWorld(true);
    const A = arm[1], u = (A.hs ?? 1) * s, o0 = gR.getWorldPosition(new THREE.Vector3()), dir = Y_AXIS.clone().transformDirection(gR.matrixWorld), grip = new THREE.Vector3();
    const wR = [R.root, R.mid, R.end].map((j) => j.getWorldPosition(new THREE.Vector3())), rU = 0.2 * fr.arm * s, rF = 0.15 * fr.arm * s;
    const near = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => { const ab = b.clone().sub(a), t = clampTo(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
    const cost = () => {
      A.collar!.updateMatrixWorld(true);
      const off = closeOn(A.end, A.mid, gR, -LX, false); A.end.updateMatrixWorld(true);
      const v = A.end.localToWorld(grip.set(0, -0.15 * u, 0.085 * u)).sub(o0), t = v.dot(dir) / s, perp = v.addScaledVector(dir, -t * s).length() / s;
      let c = 400 * perp * perp + 40 * (Math.max(0, 1.25 - t) + Math.max(0, t - 2.05)) ** 2 + 0.6 * (t - 1.8) ** 2 + 40 * off * off;
      const balls = armBalls(A, LX); c += 200 * sink(balls);
      for (const [p, r] of balls) { const d = Math.max(0, r + rU - near(p, wR[0], wR[1]), r + rF - near(p, wR[1], wR[2])) / s; c += 200 * d * d; }
      const w = wristTurnOf(A.end.quaternion, LX); return c + 0.4 * (w.dev - GRIP.dev) ** 2;
    };
    closeOn(A.end, A.mid, gR, -LX, true); // (closed first, so the reach is solved for the fist it ends as)
    solveArm(A, cost, 0.3);
    closeOn(A.end, A.mid, gR, -LX, true);
    body.updateMatrixWorld(true);
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
  // What is worn over the cloth (a belt, a satchel on its baldric) is put on once the body is posed, outside whatever
  // hangs under it in that pose: the cloth worn under it (all but a cloak, a capelet and a coat's tails, which hang over
  // it) is hung first to be read, as for a weapon put away at the belt, and hung again from its cut with the rest. It
  // is kept on a belt mount, so no cloth takes it for the body; on a body standing the bag counts as gear put away, which
  // a cloak hangs over (on one laid out the cloth falls as it does without it, and the bag lies on it).
  const overDress = (laid?: Laid) => {
    const kit = f.satchel ? f.satchelKit : undefined; if (!f.belt && !kit) return;
    body.updateMatrixWorld(true);
    const inner = garments.filter((g) => g.name !== 'cloak' && g.name !== 'mantle' && g.name !== 'tails'), w = drapeWorld(body, { pel, up, neck, arm, leg, gR, gL }, fr, s, P, dead, laid);
    const cuts = inner.map((g) => (g.mesh.geometry.getAttribute('position').array as Float32Array).slice());
    if (inner.length) hangGarments(inner.map((g) => ({ ...g, after: undefined })), w);
    for (const g of inner) if (g.name === 'mail') yokeMeet?.(g);
    body.updateMatrixWorld(true);
    // the trunk and the cloth on it as triangles in the chest's frame (nine numbers each), and how far along a ray the
    // first of them lies
    const toUp = up.matrixWorld.clone().invert(), v3 = new THREE.Vector3(), TAU = Math.PI * 2, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const soup = (ms: THREE.Object3D[]) => {
      const out: number[] = [];
      for (const o of ms) {
        const m = o as M; if (!m.isMesh || (m.material as THREE.Material).transparent || trinkets.has(m)) continue;
        const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, idx = m.geometry.index, to = toUp.clone().multiply(m.matrixWorld);
        for (let i = 0; i < (idx ? idx.count : pos.count); i++) { v3.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(to); out.push(v3.x, v3.y, v3.z); }
      }
      return out;
    };
    const meet = (T: number[], o: THREE.Vector3, d: THREE.Vector3) => {
      let best = Infinity;
      for (let i = 0; i < T.length; i += 9) {
        const ax = T[i], ay = T[i + 1], az = T[i + 2], e1x = T[i + 3] - ax, e1y = T[i + 4] - ay, e1z = T[i + 5] - az, e2x = T[i + 6] - ax, e2y = T[i + 7] - ay, e2z = T[i + 8] - az;
        const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const tx = o.x - ax, ty = o.y - ay, tz = o.z - az, u = (tx * px + ty * py + tz * pz) / det; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, vv = (d.x * qx + d.y * qy + d.z * qz) / det; if (vv < 0 || u + vv > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) / det; if (tt > 0 && tt < best) best = tt;
      }
      return best;
    };
    // (on a body laid out nothing goes down through the floor: what is under the body is pressed flat on it)
    const downUp = w.down.clone().transformDirection(toUp), offFloor = (q: THREE.Vector3) => { if (!laid || w.floor === undefined) return q; const deep = v3.copy(q).applyMatrix4(up.matrixWorld).dot(w.down) - w.floor + 0.006 * s; return deep > 0 ? q.addScaledVector(downUp, -deep) : q; };
    // a strap round the body, lying on the outermost of `T` along a closed line of rays (each from outside in toward the
    // body: where it starts and the way it goes), `wd` wide and `th` thick; flat across its width on the highest of what
    // is under it there, and drawn taut over any hollow (a waist, the small of the back). Its mesh, and its middle line:
    // at each ray a point on its outer face and the way out there
    const worn: THREE.Vector3[] = []; // (points of the straps' outer faces: the arms are kept off them, below)
    const strapOn = (T: number[], rays: [THREE.Vector3, THREE.Vector3][], wd: number, th: number, col: string, slack = false) => {
      const n = rays.length, at = (i: number) => rays[((i % n) + n) % n], o = new THREE.Vector3(), reach: number[] = [], side: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        const [o0, d] = at(i), sd = new THREE.Vector3().subVectors(at(i + 1)[0], at(i - 1)[0]).cross(d).normalize(); side.push(sd);
        let near = NaN; for (const k of [-0.5, 0, 0.5]) { const tt = meet(T, o.copy(o0).addScaledVector(sd, k * wd), d); if (tt < Infinity && !(tt >= near)) near = tt; }
        reach.push(near);
      }
      for (let i = 0; i < n; i++) if (Number.isNaN(reach[i])) { let j = 1; while (j < n && Number.isNaN(reach[(i + j) % n])) j++; reach[i] = j < n ? reach[(i + j) % n] : 0; }
      const lies = reach.slice();
      // (taut: no point of it lies in from the straight line between its neighbours)
      const pt = (i: number) => { const [o0, d] = at(i); return o0.clone().addScaledVector(d, reach[((i % n) + n) % n]); }, ab = new THREE.Vector3(), ao = new THREE.Vector3();
      for (let pass = 0; pass < 6; pass++) for (let i = 0; i < n; i++) {
        const [o0, d] = at(i), a = pt(i - 1); ab.subVectors(pt(i + 1), a); ao.subVectors(o0, a);
        const l2 = ab.lengthSq(), dd = d.dot(ab), den = l2 - dd * dd; if (den < 1e-9) continue;
        reach[i] = Math.min(reach[i], (dd * ao.dot(ab) - l2 * ao.dot(d)) / den);
      }
      // (a `slack` one, on a body laid out, is not drawn taut: it lies in a hollow it crosses, down to a hand's depth)
      if (slack) for (let i = 0; i < n; i++) reach[i] = Math.min(lies[i], reach[i] + 0.3 * s);
      const pos: number[] = [];
      for (const [k, off] of [[-0.5, 0], [-0.5, th], [0.5, th], [0.5, 0]]) for (let i = 0; i <= n; i++) { const [o0, d] = at(i); o.copy(o0).addScaledVector(side[i % n], k * wd).addScaledVector(d, reach[i % n] - off - 0.011 * s); offFloor(o); pos.push(o.x, o.y, o.z); }
      const mid = (i: number) => { const [o0, d] = at(i); return { p: o0.clone().addScaledVector(d, reach[((i % n) + n) % n] - th - 0.011 * s), out: d.clone().negate() }; };
      for (let i = 0; i < n; i++) for (const k of [-0.5, 0, 0.5]) worn.push(mid(i).p.addScaledVector(side[i], k * wd));
      return { mesh: sm(gridGeometry(pos, n + 1, 3), col, true), mid };
    };
    const far = 5 * s, rayTo = (aim: THREE.Vector3, out: THREE.Vector3): [THREE.Vector3, THREE.Vector3] => [aim.clone().addScaledVector(out, far), out.clone().negate()]; // (a ray in toward a point, from the way `out` of it)
    // (a piece set on the figure with its own x, y and z along three ways of the chest's frame)
    const setOn = (g: THREE.Object3D, p: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3) => { g.position.copy(p); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); return g; };
    const link = (a: THREE.Vector3, b: THREE.Vector3, wd: number, c: string) => { for (const t of [0, 0.5, 1]) worn.push(a.clone().lerp(b, t)); const m = box(wd, a.distanceTo(b), 0.018 * s, c); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize()); return m; };
    const over = new THREE.Group(), silver = f.belt?.buckle ?? f.corset?.buckle ?? f.buckle ?? '#9a9ea6'; over.position.copy(joints0.beltL.position).negate(); joints0.beltL.add(over);
    const T = soup([...up.children, ...pel.children].filter((c) => !c.userData.garment || inner.some((g) => g.mesh === c)));
    if (f.belt) {
      // the belt, round the waist over the cloth; its buckle on the front: a square frame, the prong across it
      const waist = new THREE.Vector3(0, 0.42 * s, 0), b = strapOn(T, Array.from({ length: 48 }, (_, i) => rayTo(waist, new THREE.Vector3(Math.sin(TAU * i / 48), 0, Math.cos(TAU * i / 48)))), 0.2 * s, 0.03 * s, f.belt.color), bk = new THREE.Group(), m0 = b.mid(0);
      b.mesh.userData.part = 'belt'; bk.userData.part = 'buckle'; over.add(b.mesh, setOn(bk, m0.p, X, Y, m0.out)); over.updateMatrixWorld(true);
      for (const sg of [-1, 1]) bk.add(at(box(0.2 * s, 0.036 * s, 0.04 * s, silver), 0, sg * 0.107 * s, 0.01 * s), at(box(0.036 * s, 0.25 * s, 0.04 * s, silver), sg * 0.082 * s, 0, 0.01 * s));
      bk.add(at(box(0.17 * s, 0.022 * s, 0.03 * s, silver), 0, 0, 0.02 * s));
      over.updateMatrixWorld(true); for (const q of soup([b.mesh, ...bk.children])) T.push(q);
    }
    if (kit) {
      // the bag: at the hip, its back resting on whatever is there (the cloth, the belt, a thigh come forward), hanging
      // plumb on a body standing and along the trunk on one laid out; round from the front toward the side as far as it
      // takes to keep clear of the arms and off the floor
      const side = kit.hip === 'L' ? LX : RX, mount = side === LX ? joints0.beltL : joints0.beltR, inx = -side, W = 0.58 * s, H = 0.5 * s, D = 0.22 * s;
      const hipT = [...T, ...soup(leg.flatMap((l) => l.root.children))], plumb = laid ? Y.clone() : new THREE.Vector3(0, 1, 0).transformDirection(toUp);
      const balls = [...armBalls(arm[0], RX), ...armBalls(arm[1], LX)].map(([c, r]) => [c.applyMatrix4(toUp), r] as const), q = new THREE.Vector3();
      const seat = (a: number) => {
        const zb = new THREE.Vector3(side * Math.sin(a), 0, Math.cos(a)); zb.addScaledVector(plumb, -zb.dot(plumb)).normalize();
        const xb = new THREE.Vector3().crossVectors(plumb, zb), A = new THREE.Vector3(0, 0.2 * s, 0), hits: [number, number][] = [], x0 = Math.min(-0.5, inx * (kit.sprig ? 0.78 : 0.5)) * W - 0.08 * s, x1 = Math.max(0.5, inx * (kit.sprig ? 0.78 : 0.5)) * W + 0.08 * s;
        // every point of what is under it (the cloth, the belt, a thigh) that lies behind it, and a little round it
        for (let i = 0; i < hipT.length; i += 3) {
          q.set(hipT[i] - A.x, hipT[i + 1] - A.y, hipT[i + 2] - A.z); const x = q.dot(xb), y = q.dot(plumb), z = q.dot(zb);
          if (z > 0 && x > x0 && x < x1 && y < 0.3 * H && y > -1.1 * H) hits.push([y, z]);
        }
        if (!hits.length) hits.push([0, 0.3 * s]);
        // (its back a plane on the highest of them, tilted as they lie from its top to its foot)
        const most = (ok: (y: number) => boolean) => Math.max(0, ...hits.filter(([y]) => ok(y)).map(([, z]) => z));
        const lean = clampTo((most((y) => y <= -0.6 * H) - most((y) => y >= -0.2 * H)) / (0.7 * H), -0.5, 0.5), z0 = Math.max(...hits.map(([y, z]) => z + lean * y)) + 0.015 * s;
        const yb = plumb.clone().addScaledVector(zb, -lean).normalize(), M = new THREE.Matrix4().makeBasis(xb, yb, new THREE.Vector3().crossVectors(xb, yb)).setPosition(A.clone().addScaledVector(zb, z0)), inv = M.clone().invert();
        let pen = 0;
        for (const [c, r] of balls) { q.copy(c).applyMatrix4(inv); const d = Math.hypot(q.x - clampTo(q.x, -W / 2, W / 2), q.y - clampTo(q.y, -H, 0.14 * s), q.z - clampTo(q.z, 0, D + 0.03 * s)); pen += Math.max(0, r + 0.02 * s - d) ** 2; }
        if (laid && w.floor !== undefined) for (const cx of [-1, 1]) for (const cy of [-H, 0]) for (const cz of [0, D]) pen += Math.max(0, q.set(cx * W / 2, cy, cz).applyMatrix4(M).applyMatrix4(up.matrixWorld).dot(w.down) - w.floor) ** 2;
        // (on a body laid out it has fallen with it: it lies where its face is most nearly up, on the hip or the thigh)
        return { M, cost: 400 * pen / (s * s) + (laid ? 0.5 * (1 + zb.dot(downUp)) : 0.3 * (a - 0.8) ** 2) };
      };
      const { M } = (laid ? [0.45, 0.7, 0.95, 1.2, 1.45, 1.7, 1.95, 2.3] : [0.8, 0.6, 1.0, 0.4, 1.2, 1.45, 1.7]).map(seat).reduce((x, y) => (y.cost < x.cost ? y : x));
      if (laid) {
        // on a body laid out the bag has fallen with it and lies on it: let go along the fall, its back comes to rest
        // on what is under it there (the cloth, the belt, a thigh, an arm, the floor beside the body), tilted as that
        // lies, with no air under it but what the highest of it holds up
        const e3 = downUp.clone().negate(), xM = new THREE.Vector3().setFromMatrixColumn(M, 0), yM = new THREE.Vector3().setFromMatrixColumn(M, 1), zM = new THREE.Vector3().setFromMatrixColumn(M, 2);
        const C = new THREE.Vector3(0, -H / 2, 0).applyMatrix4(M), near: number[] = [], clr = 0.012 * s, e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), d = new THREE.Vector3(), from = new THREE.Vector3();
        for (let i = 0; i < hipT.length; i += 9) if ((hipT[i] - C.x) ** 2 + (hipT[i + 1] - C.y) ** 2 + (hipT[i + 2] - C.z) ** 2 < (1.3 * s) ** 2) for (let k = 0; k < 9; k++) near.push(hipT[i + k]);
        if (zM.dot(e3) > 0.3) for (let pass = 0; pass < 5; pass++) {
          // (what stands out of its top lies on the body too: two more rows above the rim, with the room those have
          // over the plane of its back)
          const hits: THREE.Vector3[] = [], room = new Map<THREE.Vector3, number>(), rows = kit && ((kit.rolls ?? 0) > 0 || kit.vials?.length) ? 7 : 5;
          for (let i = 0; i <= 5; i++) for (let j = 0; j <= rows; j++) {
            from.copy(C).addScaledVector(xM, (i / 5 - 0.5) * W).addScaledVector(yM, j > 5 ? H / 2 + (j - 5) * 0.06 * s : (j / 5 - 0.5) * H).addScaledVector(e3, 1.5 * s);
            const tt = Math.min(meet(near, from, downUp), w.floor === undefined ? Infinity : w.floor - 0.006 * s - v3.copy(from).applyMatrix4(up.matrixWorld).dot(w.down));
            if (tt < Infinity) { const q = from.clone().addScaledVector(downUp, tt); hits.push(q); if (j > 5) room.set(q, 0.022 * s); }
          }
          for (const [c, r] of balls) { d.subVectors(c, C); if (Math.abs(d.dot(xM)) < W / 2 + r && Math.abs(d.dot(yM)) < H / 2 + r && Math.abs(d.dot(zM)) < 0.6 * s) hits.push(c.clone().addScaledVector(e3, r)); }
          if (hits.length < 3) break;
          // (a plane through them, those nearest under its back counting most: so it settles on the highest of them)
          e1.copy(xM).addScaledVector(e3, -xM.dot(e3)).normalize(); e2.crossVectors(e3, e1);
          let sw = 0, sx = 0, sy = 0, sz = 0, sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
          for (const q of hits) {
            d.subVectors(q, C); const wt = pass ? Math.exp(-Math.max(0, -d.dot(zM) - clr + (room.get(q) ?? 0)) / (0.04 * s)) : 1, x = d.dot(e1), y = d.dot(e2), z = d.dot(e3);
            sw += wt; sx += wt * x; sy += wt * y; sz += wt * z; sxx += wt * x * x; sxy += wt * x * y; syy += wt * y * y; sxz += wt * x * z; syz += wt * y * z;
          }
          const mx = sx / sw, my = sy / sw, mz = sz / sw, cxx = sxx / sw - mx * mx, cxy = sxy / sw - mx * my, cyy = syy / sw - my * my, cxz = sxz / sw - mx * mz, cyz = syz / sw - my * mz, det = cxx * cyy - cxy * cxy;
          if (det > 1e-9 * s ** 4) { zM.copy(e3).addScaledVector(e1, -clampTo((cxz * cyy - cyz * cxy) / det, -1.5, 1.5)).addScaledVector(e2, -clampTo((cyz * cxx - cxz * cxy) / det, -1.5, 1.5)).normalize(); yM.addScaledVector(zM, -yM.dot(zM)).normalize(); xM.crossVectors(yM, zM); }
          let lift = -Infinity; for (const q of hits) lift = Math.max(lift, (d.subVectors(q, C).dot(zM) + clr - (room.get(q) ?? 0)) / zM.dot(e3));
          C.addScaledVector(e3, lift);
        }
        M.makeBasis(xM, yM, zM).setPosition(C.addScaledVector(yM, H / 2));
      }
      // (a short strap from `a` to `b`: straight on a body standing; on one laid out it lies slack on what is under it)
      const strap = (a: THREE.Vector3, b: THREE.Vector3, wd: number, c: string, under: number[]): THREE.Object3D => {
        if (!laid) return link(a, b, wd, c);
        const g = new THREE.Group(), n = Math.max(2, Math.ceil(a.distanceTo(b) / (0.035 * s))), hs: number[] = [], from = new THREE.Vector3(), e3 = downUp.clone().negate(), z = new THREE.Vector3(), x = new THREE.Vector3();
        // (its height over the line from end to end, at close steps; each step as high as the highest beside it, so
        // that it passes over the corner of a buckle or a belt and not through it)
        for (let i = 0; i <= n; i++) { const tt = i % n ? meet(under, from.copy(a).lerp(b, i / n).addScaledVector(e3, 1.2 * s), downUp) : Infinity; hs.push(tt < Infinity ? 1.2 * s - tt + 0.022 * s : 0); }
        const pts = hs.map((_, i) => a.clone().lerp(b, i / n).addScaledVector(e3, i % n ? Math.max(hs[i - 1], hs[i], hs[i + 1]) : 0));
        for (let i = 0; i < n; i++) {
          const m = box(wd, pts[i].distanceTo(pts[i + 1]) + 0.01 * s, 0.018 * s, c), y = pts[i + 1].clone().sub(pts[i]).normalize(); z.copy(e3).addScaledVector(y, -e3.dot(y)).normalize(); x.crossVectors(y, z);
          m.position.copy(pts[i]).lerp(pts[i + 1], 0.5); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); g.add(m);
        }
        return g;
      };
      const bag = new THREE.Group(); bag.userData.stowed = !laid; bag.userData.part = 'bag';
      bag.applyMatrix4(new THREE.Matrix4().makeTranslation(-mount.position.x, -mount.position.y, -mount.position.z).multiply(M)); mount.add(bag);
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) for (const z of [0.5 * D, D]) worn.push(new THREE.Vector3((i / 6 - 0.5) * W, -H + (H + 0.14 * s) * j / 6, z).applyMatrix4(M));
      // worn leather, boxy and soft: flat to the hip, open at the top, a flap down its front under a buckled strap
      const rings: Ring[] = [{ y: -0.5, w: 0.23, f: 0.11, b: 0.004, n: 4 }, { y: -0.44, w: 0.285, f: 0.19, b: 0.004, n: 4 }, { y: -0.1, w: 0.29, f: 0.21, b: 0.004, n: 4 }, { y: 0, w: 0.27, f: 0.17, b: 0.004, n: 4 }];
      const leather = f.satchel!, dark = tone(leather, '#000000', 0.25), face = (x: number, y: number) => { const r = ringAt(rings, y), k = 1.08; return k * r.f * Math.max(0, 1 - (Math.abs(x) / (k * r.w)) ** 4) ** 0.25; }; // (the flap's front at a point)
      bag.add(sm(loftGeometry(rings, s, { seg: 24, rows: 8 }), leather, true), sm(shellGeometry(rings, -0.015, -0.3, -Math.PI / 2, Math.PI, 1.07, 1.09, s, 16, 4), dark, true));
      bag.add(at(box(0.52 * s, 0.02 * s, 0.14 * s, tone(leather, '#000000', 0.6)), 0, -0.012 * s, 0.085 * s)); // (the dark inside, below what stands out of it)
      bag.add(at(box(0.065 * s, 0.38 * s, 0.02 * s, leather), 0, -0.2 * s, (face(0, -0.2) + 0.008) * s), at(box(0.13 * s, 0.1 * s, 0.03 * s, silver), 0, -0.3 * s, (face(0, -0.3) + 0.012) * s), at(box(0.07 * s, 0.05 * s, 0.034 * s, leather), 0, -0.3 * s, (face(0, -0.3) + 0.012) * s));
      if (kit.mark === 'leaf') {
        // a leaf sprig worked on the flap, out to either side of the strap
        const mc = kit.markColor ?? '#8f958c', ls: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [], stems: [THREE.Vector3[], THREE.Vector3[]][] = [], pt = (x: number, y: number) => new THREE.Vector3(x * s, y * s, (face(x, y) + 0.006) * s);
        for (const sg of [-1, 1]) {
          const xs = [0.06, 0.11, 0.16, 0.21]; stems.push([xs.map((x) => pt(sg * x, -0.118 - 0.2 * (x - 0.055))), xs.map((x) => pt(sg * x, -0.13 - 0.2 * (x - 0.055)))]);
          for (const x of [0.09, 0.14, 0.19]) for (const dy of [-1, 1]) ls.push([pt(sg * x, -0.124 - 0.2 * (x - 0.055)), pt(sg * (x + 0.04), -0.124 - 0.2 * (x - 0.055) + dy * 0.055), Z]);
        }
        bag.add(ribbons(stems, mc), leaves(ls, 0.035 * s, mc));
      }
      if (kit.mark === 'moon') {
        // a crescent moon on the flap, beside the strap
        const sh = new THREE.Shape(); sh.absarc(0, 0, 0.07 * s, 1.019, TAU - 1.019, false); sh.absarc(0.03 * s, 0, 0.06 * s, TAU - 1.459, 1.459, true);
        const moon = sm(new THREE.ShapeGeometry(sh, 8), kit.markColor ?? '#c9c2b0', true); moon.rotation.z = -0.5; bag.add(at(moon, inx * 0.14 * s, -0.13 * s, (face(0.14, -0.13) + 0.008) * s));
      }
      // what stands out of its top, side by side: rolled bandages, corked vials, sprigs of herbs
      const stuff: ((x: number) => void)[] = [];
      for (let i = 0; i < Math.min(3, kit.rolls ?? 0); i++) stuff.push((x) => { const r = cyl(0.062 * s, 0.062 * s, 0.2 * s, '#d9d0bb', 10), e = cyl(0.022 * s, 0.022 * s, 0.204 * s, '#a89f8a', 6); r.rotation.z = e.rotation.z = (i % 2 ? 1 : -1) * 0.14; bag.add(at(r, x, 0.015 * s, 0.09 * s), at(e, x, 0.015 * s, 0.09 * s)); });
      for (const c of (kit.vials ?? []).slice(0, 3)) stuff.push((x) => bag.add(at(sph(0.05 * s, c, 8, 6), x, -0.02 * s, 0.09 * s), at(cyl(0.03 * s, 0.04 * s, 0.1 * s, c, 8), x, 0.05 * s, 0.09 * s), at(cyl(0.028 * s, 0.028 * s, 0.045 * s, '#8a6a4a', 6), x, 0.12 * s, 0.09 * s)));
      if (kit.herbs) stuff.push((x) => { for (const [dx, h, rz] of [[-0.03, 0.2, 0.2], [0, 0.26, 0], [0.03, 0.18, -0.25]]) { const st = cyl(0.008 * s, 0.008 * s, h * s, '#5a6b3a', 5), fl = cap(0.02 * s, 0.05 * s, kit.herbs!); st.rotation.z = fl.rotation.z = rz; bag.add(at(st, x + dx * s, h / 2 * s, 0.09 * s), at(fl, x + (dx - Math.sin(rz) * h / 2) * s, h * s, 0.09 * s)); } });
      stuff.forEach((put, i) => put(inx * (0.19 - 0.38 * (stuff.length > 1 ? i / (stuff.length - 1) : 0.5)) * s));
      let tieTo: THREE.Vector3; // (where a bundle of herbs is tied on: the baldric's ring, or the top of the nearer strap)
      if (kit.strap === 'belt') {
        // hung from the waist belt: two short straps from the bag's top corners up to the belt (with no belt worn, to the
        // strap at a corset's foot, or to the waist where a belt would be), each on a small ring there, round at the hip
        // (never at the middle of the front, where a buckle or a lacing is)
        // (all that is worn round the waist there, whatever it is built of: a corset's straps and buckles too)
        const worn0: THREE.Object3D[] = [], stop = new Set<THREE.Object3D>([up, neck, joints0.beltL, joints0.beltR, joints0.back, ...arm.map((l) => l.collar ?? l.root), ...leg.map((l) => l.root)]);
        const walk = (n: THREE.Object3D) => { for (const c of n.children) { if (stop.has(c) || c.userData.garment) continue; worn0.push(c); walk(c); } }; walk(up); walk(pel);
        const waistT = [...T, ...soup(worn0)];
        const tops = [0.1, 0.27].map((dx, k) => {
          const low = new THREE.Vector3(inx * dx * s, -0.01 * s, 0.03 * s).applyMatrix4(M), aim = new THREE.Vector3(0, (f.belt ? 0.42 : f.corset ? 0.57 : 0.5) * s, 0), az = side * Math.max(side * Math.atan2(low.x, low.z), 0.55 - 0.2 * k), out = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), [o0, d] = rayTo(aim, out), across = new THREE.Vector3().crossVectors(Y, out).normalize();
          // (on the highest of what the ring lies over: a buckle or a lacing may stand proud beside it)
          const reach = Math.min(far, ...[[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([i, j]) => meet(waistT, o0.clone().addScaledVector(across, i * 0.04 * s).addScaledVector(Y, j * 0.04 * s), d)));
          const top = o0.addScaledVector(d, reach - (f.corset && !f.belt ? 0.065 : 0.03) * s), // (a corset's straps and buckles are put on later, over what is read here)
            loop = sm(new THREE.TorusGeometry(0.028 * s, 0.009 * s, 5, 12), silver); loop.userData.part = 'ring';
          over.add(strap(top, low, 0.045 * s, leather, waistT), setOn(loop, top.clone().addScaledVector(Y, 0.02 * s), across, Y, out));
          return top;
        });
        tieTo = tops[1];
      } else {
        // the baldric: from the other shoulder down across the chest to a ring over the bag, on round the hip above the belt,
        // up across the back and over the shoulder; two short straps from the ring down to the bag; a buckle at the chest
        const hook = new THREE.Vector3(inx * 0.2 * s, 0.38 * s, 0).applyMatrix4(M), xS = -side * (garments.some((g) => g.name === 'mantle') ? ringAt(tr, 2.17).w * 1.1 + 0.14 : 0.2 + 0.25 * fr.shoulderX) * s, yH = Math.max(hook.y, 0.58 * s), thH = Math.atan2(hook.x, hook.z), thB = side * (Math.PI - 0.6);
        const rays: [THREE.Vector3, THREE.Vector3][] = [], iH = 19, xB = side * 0.3 * s;
        for (let i = 0; i < 20; i++) { const t = i / 19, th = thH * t * t; rays.push(rayTo(new THREE.Vector3((xS + (hook.x - xS) * t) * (1 - t * t), 2.0 * s + (yH - 2.0 * s) * t, 0), new THREE.Vector3(Math.sin(th), 0, Math.cos(th)))); } // (turning from the front to where the bag hangs)
        for (let i = 1; i <= 12; i++) { const th = thH + (thB - thH) * i / 13; rays.push(rayTo(new THREE.Vector3(0, yH, 0), new THREE.Vector3(Math.sin(th), 0, Math.cos(th)))); }
        for (let i = 0; i < 20; i++) rays.push(rayTo(new THREE.Vector3(xB + (xS - xB) * i / 19, yH + 0.1 * s + (1.9 * s - yH) * i / 19, 0), Z.clone().negate()));
        for (let i = 1; i <= 7; i++) { const ps = 0.35 + (Math.PI - 0.7) * i / 8; rays.push(rayTo(new THREE.Vector3(xS, 1.95 * s, 0), new THREE.Vector3(0, Math.sin(ps), -Math.cos(ps)))); }
        const st = strapOn(T, rays, 0.11 * s, 0.02 * s, leather, !!laid); st.mesh.userData.part = 'baldric'; over.add(st.mesh);
        const foot = st.mid(iH), ring = sm(new THREE.TorusGeometry(0.055 * s, 0.014 * s, 6, 16), silver);
        ring.userData.part = 'ring'; over.add(setOn(ring, foot.p.clone().addScaledVector(foot.out, 0.012 * s), X, new THREE.Vector3().crossVectors(foot.out, X).normalize(), foot.out));
        for (const dx of [0.12, 0.27]) over.add(strap(foot.p.clone().addScaledVector(foot.out, 0.012 * s), new THREE.Vector3(inx * dx * s, -0.01 * s, 0.03 * s).applyMatrix4(M), 0.045 * s, leather, T));
        let iB = 0, by = Infinity; for (let i = 0; i < 20; i++) { const m = st.mid(i); if (Math.abs(m.p.y - 1.02 * s) < by) { by = Math.abs(m.p.y - 1.02 * s); iB = i; } }
        const mb = st.mid(iB), along = st.mid(iB + 1).p.sub(st.mid(iB - 1).p).normalize(), bz = mb.out.clone().addScaledVector(along, -mb.out.dot(along)).normalize(), bk = new THREE.Group(); bk.userData.part = 'strapBuckle';
        over.add(setOn(bk, mb.p, new THREE.Vector3().crossVectors(along, bz), along, bz));
        for (const sg of [-1, 1]) bk.add(at(box(0.16 * s, 0.03 * s, 0.03 * s, silver), 0, sg * 0.055 * s, 0.008 * s), at(box(0.03 * s, 0.14 * s, 0.03 * s, silver), sg * 0.065 * s, 0, 0.008 * s));
        bk.add(at(box(0.025 * s, 0.07 * s, 0.024 * s, silver), 0, 0.022 * s, 0.014 * s));
        tieTo = foot.p.clone().addScaledVector(foot.out, 0.012 * s);
      }
      if (kit.sprig) {
        // a bundle of flowering herbs tied on there, hanging head down beside the bag
        const x0 = inx * 0.39, tie = new THREE.Vector3(x0 * s, 0.06 * s, 0.05 * s);
        over.add(link(tieTo, tie.clone().applyMatrix4(M), 0.012 * s, '#a08a5a'));
        bag.add(at(cyl(0.028 * s, 0.028 * s, 0.04 * s, '#a08a5a', 6), tie.x, tie.y - 0.03 * s, tie.z));
        for (const [dx, h, rz] of [[-0.035, 0.42, -0.1], [-0.012, 0.5, -0.03], [0.012, 0.46, 0.04], [0.035, 0.4, 0.11]]) {
          const stem = cyl(0.007 * s, 0.007 * s, h * s, '#66744a', 5), fl = cap(0.02 * s, 0.09 * s, kit.sprig); stem.rotation.z = fl.rotation.z = rz;
          bag.add(at(stem, tie.x + (dx + Math.sin(rz) * h / 2) * s, tie.y - h / 2 * s, tie.z), at(fl, tie.x + (dx + Math.sin(rz) * (h - 0.05)) * s, tie.y - (h - 0.05) * s, tie.z));
        }
      }
    }
    // an empty-handed arm that rests where a strap now runs (a forearm at the waist, a hand at the hip) is moved off it,
    // as little as it takes, so that it lies on the strap, not in it
    if (!laid) arm.forEach((A, k) => {
      if ((k === 0 ? gR : gL).children.length) return;
      const sx = k === 0 ? RX : LX, r0 = A.root.rotation.clone(), m0 = A.mid.rotation.x, q = new THREE.Vector3();
      const into = () => { A.collar!.updateMatrixWorld(true); let c = 0; for (const [b, r] of armBalls(A, sx)) { q.copy(b).applyMatrix4(toUp); for (const p of worn) { const d = (r - q.distanceTo(p)) / s; if (d > 0) c += d * d; } } return c; };
      if (into() < 1e-6) return;
      solveArm(A, () => 400 * into() + (A.root.rotation.x - r0.x) ** 2 + (A.root.rotation.y - r0.y) ** 2 + (A.root.rotation.z - r0.z) ** 2 + (A.mid.rotation.x - m0) ** 2, 0.15);
    });
    yokeMeet?.();
    inner.forEach((g, i) => { const geo = g.mesh.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute; (pos.array as Float32Array).set(cuts[i]); pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere(); });
    body.updateMatrixWorld(true);
  };
  if (!P.lie) overDress();
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
  // (it lies on its clothes: what of them is under it lies under it, each garment worn over another a layer nearer the
  // floor (kit/cloth.ts), so the more it wears one over another, the higher it lies on them)
  if (laid && garments.length) { const ls = garments.map((g) => g.layer); laid.lift = Math.max(0.02 * s, 0.005 + 0.012 * (Math.max(0, ...ls) - Math.min(...ls)) + 0.01 * s); }
  if (laid) overDress(laid);
  // the cloth hangs on the posed body (on one laid out, the way it lies)
  if (garments.length) hangGarments(garments, drapeWorld(body, { pel, up, neck, arm, leg, gR, gL }, fr, s, P, dead, laid));
  // on the floor (or, seated, the hips at the origin), over the middle of its base, then lifted
  if (P.seated) body.position.y -= HIP * s;
  else { let floor = Infinity; for (const m of soles) floor = Math.min(floor, new THREE.Box3().setFromObject(m).min.y); if (Number.isFinite(floor)) body.position.y -= floor; }
  if (standing && soles.length) { const bb = new THREE.Box3(); for (const m of soles) bb.expandByObject(m); body.position.x -= (bb.min.x + bb.max.x) / 2; body.position.z -= (bb.min.z + bb.max.z) / 2; }
  body.position.y += P.lift ?? 0;
  if (afterHung.length) { body.updateMatrixWorld(true); for (const fn of afterHung) fn(); } // (what waited for all the cloth to have hung)
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
  if (laid) {
    placeLay(out, body, laid, s, own, { up, head, gR, gL, drop: dead });
    // (a harness's pieces, and the trims of its tassets and coat skirt, laid on them once they hung)
    if (harness.length) { body.traverse((o) => { if ((o as M).isMesh && /^(coat|tasset)/.test(o.userData.cloth ?? '')) harness.push(o as M); }); pressOnFloor(harness, 0.004 * s); }
    // (a cloak's laurel lies on the outer face of its cloth, which under the body is the face turned to the floor: it
    // is pressed flat there with the cloth, a hair under it)
    if (f.cloakLaurel) { const sprays: M[] = []; body.traverse((o) => { if ((o as M).isMesh && o.userData.laurel) sprays.push(o as M); }); pressOnFloor(sprays, -0.016); for (const m of sprays) { m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); } }
  }
  else if (f.hoverFt && !dead) body.position.y += f.hoverFt;
  if (f.sparkles && !dead) {
    // sparkles in the air round the figure, each in its own place; one that would sit in a limb as the body is posed, or
    // against it, drifts further out until it hangs clear
    out.updateMatrixWorld(true);
    const solid: M[] = []; body.traverse((c) => { const m = c as M; if (m.isMesh && !(m.material as THREE.Material).transparent) solid.push(m); });
    // (and clear of its wings, membrane and rim: open sheets, so only how near their faces are counts)
    const sheets: M[] = []; body.traverse((c) => { if (c.userData.wing) c.traverse((d) => { if ((d as M).isMesh) sheets.push(d as M); }); });
    const meets = (q: THREE.Vector3, r: number, away: THREE.Vector3) => solid.some((m) => ballMeets(m, q, r, away)) || sheets.some((m) => ballMeets(m, q, r, away, true));
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996, rad = (0.05 + (i % 3) * 0.02) * s, y = (0.8 + ((i * 7) % 11) * 0.42) * s + (f.hoverFt ?? 0), away = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), q = new THREE.Vector3();
      let r = (1.1 + (i % 3) * 0.35) * s;
      for (let k = 0; k < 10 && meets(q.copy(away).multiplyScalar(r).setY(y), rad + 0.03 * s, away); k++) r += 0.12 * s;
      out.add(at(glassy(sph(rad, f.sparkles, 6, 4), f.sparkles, 0.85), away.x * r, y, away.z * r));
    }
  }
  return out;
}

/** Cloth gives way under gear that lies on it (a coat skirt under a weapon slung across the back): a grid of `cols`
 *  columns hung in its parent's frame is drawn in toward its axis, clear of the gear's own triangles by `clear`, in
 *  one smooth dent that fades out over `reach` about it, never vertex by vertex; then no triangle of the cloth crosses
 *  one of the gear. */
export function giveWay(m: THREE.Mesh, cols: number, gear: THREE.Object3D, clear: number, reach: number): void {
  gear.updateWorldMatrix(true, true); m.updateWorldMatrix(true, false);
  const geo = m.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute, n = pos.count, rows = n / cols, inv = m.matrixWorld.clone().invert(), to = new THREE.Matrix4();
  geo.computeBoundingBox(); const near = geo.boundingBox!.clone().expandByScalar(reach), tb = new THREE.Box3();
  // the gear's triangles that come near the cloth, in the cloth's frame
  const tris: THREE.Triangle[] = [];
  gear.traverse((o) => {
    const g = o as THREE.Mesh; if (!g.isMesh) return;
    const p = g.geometry.getAttribute('position') as THREE.BufferAttribute, ix = g.geometry.getIndex(), nt = (ix ? ix.count : p.count) / 3; to.multiplyMatrices(inv, g.matrixWorld);
    for (let t = 0; t < nt; t++) { const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(t * 3 + k) : t * 3 + k).applyMatrix4(to)); if (tb.setFromPoints([a, b, c]).intersectsBox(near)) tris.push(new THREE.Triangle(a, b, c)); }
  });
  if (!tris.length) return;
  const P: THREE.Vector3[] = [], dir: THREE.Vector3[] = [], q = new THREE.Vector3(), w = new THREE.Vector3(), ray = new THREE.Ray();
  for (let i = 0; i < n; i++) { const p = new THREE.Vector3().fromBufferAttribute(pos, i); P.push(p); dir.push(new THREE.Vector3(-p.x, 0, -p.z).normalize()); }
  const gap = (p: THREE.Vector3) => { let d = Infinity; for (const t of tris) d = Math.min(d, t.closestPointToPoint(p, q).distanceToSquared(p)); return Math.sqrt(d); };
  // how far in each vertex must go by itself: past the gear where the gear lies inward of it, then on until it is clear
  const need = new Float32Array(n), far = 0.6 * reach, step = clear / 4;
  for (let i = 0; i < n; i++) {
    const room = Math.max(0, Math.hypot(P[i].x, P[i].z) - 2 * clear);
    let t0 = 0; ray.set(P[i], dir[i]);
    for (const t of tris) if (ray.intersectTriangle(t.a, t.b, t.c, false, q)) { const d = q.distanceTo(P[i]); if (d < far && d > t0) t0 = d; }
    if (!t0 && gap(P[i]) >= clear) continue;
    let t = t0; while (t < room && gap(w.copy(P[i]).addScaledVector(dir[i], t)) < clear) t += step;
    need[i] = Math.min(t, room);
  }
  const cross = (): number[] => {
    // (the cloth's triangles that cross one of the gear's: an edge of either through the other)
    const ix = geo.getIndex()!, hit: number[] = [], seg = (a: THREE.Vector3, b: THREE.Vector3, t: THREE.Triangle) => { const l = w.subVectors(b, a).length(); if (l < 1e-9) return false; ray.origin.copy(a); ray.direction.copy(w).divideScalar(l); const h = ray.intersectTriangle(t.a, t.b, t.c, false, q); return !!h && h.distanceTo(a) <= l; };
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), mine = new THREE.Triangle(A, B, C), box = new THREE.Box3();
    for (let k = 0; k < ix.count; k += 3) {
      A.fromBufferAttribute(pos, ix.getX(k)); B.fromBufferAttribute(pos, ix.getX(k + 1)); C.fromBufferAttribute(pos, ix.getX(k + 2)); box.setFromPoints([A, B, C]);
      for (const t of tris) { if (!box.intersectsTriangle(t)) continue; if (seg(A, B, t) || seg(B, C, t) || seg(C, A, t) || seg(t.a, t.b, mine) || seg(t.b, t.c, mine) || seg(t.c, t.a, mine)) { hit.push(ix.getX(k), ix.getX(k + 1), ix.getX(k + 2)); break; } }
    }
    return hit;
  };
  const D = new Float32Array(n), S = new Float32Array(n);
  for (let round = 0; round < 8; round++) {
    const deep: number[] = []; for (let i = 0; i < n; i++) if (need[i] > 0) deep.push(i);
    if (!deep.length && round === 0 && !cross().length) return;
    // one dent: each vertex goes in as far as the deepest need near it asks, eased off with the distance from it, and
    // the whole is smoothed over the grid without ever coming back out past a need
    for (let i = 0; i < n; i++) { let d = 0; for (const j of deep) { const k = 1 - P[i].distanceTo(P[j]) / reach; if (k > 0) d = Math.max(d, need[j] * k * k * (3 - 2 * k)); } D[i] = Math.max(d, need[i]); }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols; let sum = D[i], k = 1; if (c > 0) { sum += D[i - 1]; k++; } if (c < cols - 1) { sum += D[i + 1]; k++; } if (r > 0) { sum += D[i - cols]; k++; } if (r < rows - 1) { sum += D[i + cols]; k++; } S[i] = Math.max(D[i], sum / k); }
      D.set(S);
    }
    for (let i = 0; i < n; i++) { w.copy(P[i]).addScaledVector(dir[i], Math.min(D[i], Math.max(0, Math.hypot(P[i].x, P[i].z) - 2 * clear))); pos.setXYZ(i, w.x, w.y, w.z); }
    const hit = cross(); if (!hit.length) break;
    for (const i of hit) need[i] = Math.max(need[i], D[i]) + clear; // (still crossed: those go further in, and the dent with them)
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
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
  // (the neck, which nothing is hung over, is still in the way of cloth falling past it: a capelet's collar on a body
  // laid on its side falls onto the back of the neck, not into it; its rings reach on down past the neck's foot, where
  // the collar lies)
  { const nr = neckRings(fr); part('neck', j.neck.children.filter(solid), 300); volumes.set('neck', vol(j.neck, [{ ...nr[0], y: nr[0].y - 0.08 }, ...nr])); }
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
  // (on a body laid out, the trunk's own skin, for a plate in lames to rest on: read only when one does)
  const skinOf = (o: THREE.Object3D) => every(o.children.filter((c): c is M => solid(c) && !!c.userData.skin));
  let skin: Map<string, THREE.Vector3[]> | undefined;
  // (gear put away moves with the trunk: what of it stands above a cloak's top, the head of a weapon slung on the back, is
  // not under the cloak)
  return { parts, down, floor, volumes, bones, surface, pieces, size: s, get skin() { return P.lie ? (skin ??= new Map([['torso', skinOf(j.up)], ['pelvis', skinOf(j.pel)]])) : undefined; }, trunk: ['torso', 'pelvis', 'stowed'], lying: !!P.lie };
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
  const hips = plate ? hipStack(tr, pr) : [], girdle = plate && !!f.armor!.corset;
  // (a corset's girdle: its three lames, each read in the frame of the plate lame that turns most nearly as it does)
  const fauld: { y0: number; y1: number; k0: number; k1: number; d0: number; d1: number; rim: number; frame: number }[] = !plate ? [] : girdle
    ? [0, 1, 2].map((i) => { const y0 = GIRDLE.edges[i], y1 = GIRDLE.edges[i + 1]; return { y0, y1, k0: GIRDLE.line(y0), k1: GIRDLE.line(y1), d0: GIRDLE.out(i, y0), d1: GIRDLE.out(i, y1), rim: GIRDLE.rim, frame: [0, 1, 3][i] }; })
    : [0, 1, 2, 3].map((i) => ({ y0: 0.68 - i * 0.17, y1: 0.48 - i * 0.17, k0: 1.12 + i * 0.05, k1: 1.185 + i * 0.05, d0: 0, d1: 0, rim: i === 3 ? 0.02 : 0.016, frame: i }));
  const toLame = fauld.map((b) => { const g = o.pel.getObjectByName('fauld' + b.frame); return g ? inv(g) : toPel; }); // (each lame turned its share with the chest)
  // (a girdle swells out toward its foot over the seat and the tassets hung inside it: how much further out a point of
  // it stands than the hips' own section there, `depth` being how deep the point lies in that section grown by `e`)
  const swell = girdle ? o.pel.getObjectByName('fauld3')?.userData.swell as ((x: number, z: number, y: number) => [number, number, number]) | undefined : undefined;
  const swollen = (x: number, z: number, y: number, depth: number, R: Ring, k: number, e: number) => {
    if (!swell) return depth;
    const [need, share, fill] = swell(x, z, y), h = Math.hypot(x, z); if ((!share && !fill) || h < 1e-6) return depth;
    // (how far out the hips' own section stands that way, found along the line from the axis)
    let t0 = 0, t1 = 3 / h;
    for (let n = 0; n < 16; n++) { const t = (t0 + t1) / 2; if (sect(x * t - (R.x ?? 0), z * t - (R.z ?? 0), R.w * k, R.f * k, R.b * k, R.n ?? 2) > 0) t0 = t; else t1 = t; }
    const own = (t0 + t1) / 2 * h;
    return Math.max(depth, own * (1 + Math.max(share * Math.max(0, need / own - 1), fill)) + e - h);
  };
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
      const y = clampTo(q.y, b.y1, b.y0), R = ringAt(hips, y), t = (b.y0 - y) / (b.y0 - b.y1), k = b.k0 + (b.k1 - b.k0) * t, e = b.d0 + (b.d1 - b.d0) * t + 0.006, Rb = ringAt(hips, b.y1), kr = b.k1 + (girdle ? 0 : 0.012);
      d = Math.max(d, Math.min(swollen(q.x, q.z, y, sect(q.x - (R.x ?? 0), q.z - (R.z ?? 0), R.w * k + e, R.f * k + e, R.b * k + e, R.n ?? 2), R, k, e), q.y - b.y1, b.y0 + (i ? 0 : 0.04) - q.y));
      d = Math.max(d, b.rim - Math.hypot(q.y - b.y1, swollen(q.x, q.z, b.y1, sect(q.x - (Rb.x ?? 0), q.z - (Rb.z ?? 0), Rb.w * kr + b.d1, Rb.f * kr + b.d1, Rb.b * kr + b.d1, Rb.n ?? 2), Rb, kr, b.d1)));
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

/** Whether a ball in the world (centre `p`, radius `r`) meets a mesh: any of its faces nearer than the radius, or the
 *  centre inside it (the faces a ray from the centre along `ray` passes through counted: an odd number is inside; an
 *  `open` sheet has no inside). */
function ballMeets(m: M, p: THREE.Vector3, r: number, ray: THREE.Vector3, open = false): boolean {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const box = BALL_BOX.copy(g.boundingBox!).applyMatrix4(m.matrixWorld).expandByScalar(r); if (!box.containsPoint(p)) return false;
  const pos = g.getAttribute('position') as THREE.BufferAttribute, idx = g.index, tris = (idx ? idx.count : pos.count) / 3, tri = new THREE.Triangle(), near = new THREE.Vector3(), line = new THREE.Ray(p, ray);
  let through = 0;
  for (let t = 0; t < tris; t++) {
    tri.a.fromBufferAttribute(pos, idx ? idx.getX(3 * t) : 3 * t).applyMatrix4(m.matrixWorld); tri.b.fromBufferAttribute(pos, idx ? idx.getX(3 * t + 1) : 3 * t + 1).applyMatrix4(m.matrixWorld); tri.c.fromBufferAttribute(pos, idx ? idx.getX(3 * t + 2) : 3 * t + 2).applyMatrix4(m.matrixWorld);
    if (tri.closestPointToPoint(p, near).distanceToSquared(p) < r * r) return true;
    if (line.intersectTriangle(tri.a, tri.b, tri.c, false, near)) through++;
  }
  return !open && through % 2 === 1;
}
const BALL_BOX = new THREE.Box3();

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

/** What is worn under a body laid out is pressed flat on the floor: every point of these meshes that would lie below
 *  `y` (world) is brought up to it. */
function pressOnFloor(ms: M[], y: number): void {
  const v = new THREE.Vector3();
  for (const m of ms) {
    const pos = m.geometry.getAttribute('position'); let moved = false; m.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).y < y) { v.y = y; m.worldToLocal(v); pos.setXYZ(i, v.x, v.y, v.z); moved = true; }
    if (moved) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
  }
}
/** A wing of a body laid out: flat on the floor from its root when the root is down there (the body on its back lies on
 *  its wings), otherwise sloping from its root on the back down to the floor; spread out along the floor the way it was
 *  spread (`sx` the side it spreads to, in its own frame), each pair (`i`) a hair above the one before: on the floor
 *  itself, under an arm lying there, and drawn over the floor (a depth offset) so that it does not flicker against it. */
function layWing(g: THREE.Object3D, sx: number, s: number, i: number): void {
  g.updateMatrixWorld(true);
  const root = g.getWorldPosition(new THREE.Vector3());
  const span = (g.userData.span as number | undefined) ?? 2 * s, d = new THREE.Vector3(sx, 0, 0).transformDirection(g.matrixWorld).setY(0);
  if (d.lengthSq() < 0.09) d.set(root.x, 0, root.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35 * sx); // (spread straight up or down: out from the body's middle)
  if (d.lengthSq() < 1e-8) d.set(sx, 0, 0);
  d.normalize();
  const lift = 0.0006 * i * s, h = root.y - lift, tilt = h > 0.12 * s ? Math.asin(Math.min(0.9, h / span)) : 0;
  const along = d.clone().multiplyScalar(Math.cos(tilt)).setY(-Math.sin(tilt)), X = along.clone().multiplyScalar(sx);
  const Z = new THREE.Vector3(0, 1, 0).addScaledVector(along, -along.y).normalize(), Y = new THREE.Vector3().crossVectors(Z, X);
  const pq = g.parent ? g.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  g.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z))));
  if (!tilt && g.parent) g.position.copy(g.parent.worldToLocal(root.setY(lift)));
  g.traverse((c) => { const m = (c as M).material as THREE.Material | undefined; if (m) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4 * (1 + i); } });
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
