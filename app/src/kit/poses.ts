// Poses with character: how a particular kind of person stands at rest and in a fight, as joint angles for the shared
// figure rig (kit/heroes.ts HeroPose). The manifest names them per character; bestiary.ts resolves the names.
import type { HeroPose } from './heroes';

const LUNGE: HeroPose = { hipR: [-0.55, 0, 0.1], kneeR: 0.65, hipL: [0.35, 0.45, 0.2], kneeL: 0.2 };          // weapon foot leading (a fencer)
const BRACED: HeroPose = { hipL: [-0.5, 0, 0.14], kneeL: 0.65, hipR: [0.3, 0.35, 0.16], kneeR: 0.35 };       // off foot leading (a swing coming)

export const NPC_POSES = {
  // ---- at rest
  /** A lord at ease: chin up, one hand at the chest, the other resting on the hilt at his hip. */
  regal: { spine: [-0.04, 0.1, 0], neck: [-0.1, -0.15, 0], shoulderR: [-0.35, 0, 0.12], elbowR: -1.5, wristR: [0.3, 0, 0], shoulderL: [0.12, 0, 0.3], elbowL: -0.75, hipL: [-0.12, 0, 0.06], kneeL: 0.2 },
  /** Bent with age or malice: the back curved, the head thrust forward, the knees soft. */
  hunched: { spine: [0.42, 0, 0], neck: [-0.38, 0, 0], shoulderR: [-0.5, 0, 0.1], elbowR: -0.9, holdR: { upright: true }, shoulderL: [-0.3, 0, 0.1], elbowL: -1.1, wristL: [0.5, 0, 0], hipL: [-0.35, 0, 0.1], kneeL: 0.7, hipR: [-0.3, 0, 0.1], kneeR: 0.6 },
  /** Fists on the hips, chest out (the rig sets each fist on the waist, outside it). */
  'hands-on-hips': { spine: [-0.06, 0, 0], neck: [-0.05, 0, 0], shoulderR: [0.55, -1.15, 0.8], elbowR: -1.25, wristR: [0.4, 0, 0], shoulderL: [0.55, -1.15, 0.8], elbowL: -1.25, wristL: [0.4, 0, 0], hipL: [0, 0, 0.14], hipR: [0, 0, 0.14], hipHand: ['R', 'L'], fist: ['R', 'L'] },
  /** Hands clasped behind the back, watchful (one wrist over the other, so the hands do not pass through each other). */
  'behind-back': { spine: [-0.04, 0, 0], neck: [0.04, 0.25, 0], shoulderR: [0.76, -1.5, 0.12], elbowR: -1.25, wristR: [0, 0.01, 0], shoulderL: [0.51, -1.5, 0.12], elbowL: -1.25, wristL: [0, 0.01, 0], hipL: [0, 0, 0.06], hipR: [0, 0, 0.06] },
  /** Arms folded, weight on one leg. */
  'arms-folded': { spine: [0.03, 0, 0.04], neck: [0, 0.15, 0], shoulderR: [-0.39, -1.04, 0.1], elbowR: -1.75, shoulderL: [-0.38, -1.05, 0.1], elbowL: -1.85, hipL: [-0.1, 0, 0.1], kneeL: 0.2 },
  /** Hands wrung together at the chest, shoulders in: grief or worry. */
  wringing: { spine: [0.16, 0, 0], neck: [0.22, 0, 0.1], shoulderR: [-0.6, -0.75, 0.05], elbowR: -1.8, shoulderL: [-0.6, -0.75, 0.05], elbowL: -1.8, hipL: [-0.06, 0, 0.03], kneeL: 0.15 },
  /** Leaning on a staff or a cane held upright. */
  leaning: { spine: [0.16, 0, -0.05], neck: [-0.12, 0, 0], shoulderR: [-0.75, 0, 0.15], elbowR: -0.95, holdR: { upright: true }, hipL: [-0.1, 0, 0.05], kneeL: 0.2 },

  // ---- in a fight
  /** The vampire lord: unhurried, one clawed hand out to command or charm, the other sweeping his cloak back. */
  'vampire-lord': { spine: [-0.05, -0.15, 0], neck: [-0.08, 0.12, 0.05], shoulderR: [-0.85, 0, 0.22], elbowR: -1.0, wristR: [-0.5, 0, 0], shoulderL: [0.2, -0.6, 0.4], elbowL: -0.9, hipL: [-0.25, 0, 0.08], kneeL: 0.3, hipR: [0.1, 0.2, 0.1], kneeR: 0.05, spell: 'right' },
  /** En garde: side on, the point forward, the off hand high behind. */
  duelist: { pelvis: [0, 0.15, 0], spine: [0.08, 0.3, 0], neck: [0, -0.4, 0], shoulderR: [-0.95, 0, 0.12], elbowR: -0.95, holdR: { upright: true, tilt: [1.15, 0, 0] }, shoulderL: [0.3, 0, 0.55], elbowL: -1.1, ...LUNGE },
  /** A great blade heaved overhead in both hands. */
  'overhead': { twoHand: true, spine: [-0.04, -0.25, 0], neck: [0.02, 0.22, 0], shoulderR: [-1.85, 0, 0.55], elbowR: -1.55, shoulderL: [-1.8, -0.55, -0.05], elbowL: -1.35, holdR: { upright: true, tilt: [-0.8, 0, -0.2] }, ...BRACED },
  /** An axe wound back over the shoulder, the other arm thrust out. */
  windup: { twoHand: true, spine: [0.06, -0.4, 0], neck: [0, 0.35, 0], shoulderR: [-0.65, 0, 0.9], elbowR: -1.9, holdR: { upright: true, tilt: [-0.7, 0, 0.3] }, shoulderL: [-1.05, -0.25, 0.2], elbowL: -0.75, ...BRACED },
  /** A curved blade drawn back across the body for a slash. */
  slash: { spine: [0.08, -0.3, 0], neck: [0, 0.25, 0], shoulderR: [-0.9, 0, 0.5], elbowR: -2.0, holdR: { upright: true, tilt: [-0.4, 0, 0.3] }, shoulderL: [-1.0, -0.3, 0.2], elbowL: -1.1, ...BRACED },
  /** A spear or pitchfork levelled in both hands. */
  thrust: { twoHand: true, spine: [0.18, -0.45, 0], neck: [-0.08, 0.4, 0], shoulderR: [0, 0, 0.25], elbowR: -1.45, holdR: { upright: true, tilt: [1.45, 0, 0] }, shoulderL: [-1.03, -0.5, 0], elbowL: -0.6, hipL: [-0.65, 0, 0.12], kneeL: 0.75, hipR: [0.4, 0.35, 0.2], kneeR: 0.3 },
  /** A hag's curse: bent double over her staff, a clawed hand raised. */
  curse: { spine: [0.4, 0.1, 0], neck: [-0.36, 0, 0], shoulderR: [-0.8, 0, 0.2], elbowR: -1.0, holdR: { upright: true }, shoulderL: [-1.5, 0, 0.3], elbowL: -1.2, wristL: [0.7, 0, 0], hipL: [-0.4, 0, 0.15], kneeL: 0.8, hipR: [-0.3, 0, 0.15], kneeR: 0.7 },
  /** A spell thrown from the right hand, feet planted. */
  spellcast: { spine: [0.06, 0.3, 0], neck: [0, -0.25, 0], shoulderR: [-1.35, 0, 0.15], elbowR: -0.45, wristR: [0.6, 0, 0], shoulderL: [-0.3, -0.4, 0.35], elbowL: -1.45, hipR: [-0.45, 0, 0.1], kneeR: 0.5, hipL: [0.3, 0.3, 0.15], kneeL: 0.2, spell: 'right' },
  /** A caster with a staff: the staff planted in the right hand, the left hand thrown forward with the spell. */
  'staff-cast': { spine: [0.08, -0.25, 0], neck: [0, 0.2, 0], shoulderR: [-0.7, 0, 0.3], elbowR: -0.9, holdR: { upright: true }, shoulderL: [-1.45, 0, 0.15], elbowL: -0.25, wristL: [0.9, 0, 0], hipR: [-0.35, 0, 0.1], kneeR: 0.45, hipL: [0.25, 0, 0.1], kneeL: 0.1 },
  /** Holy symbol or open hand thrust up, the other warding. */
  rebuke: { spine: [-0.08, 0.1, 0], neck: [-0.1, -0.1, 0], shoulderR: [-1.9, 0, 0.2], elbowR: -0.6, shoulderL: [-0.5, -0.8, 0.05], elbowL: -1.8, hipL: [-0.2, 0, 0.1], kneeL: 0.3, hipR: [0.12, 0.2, 0.1], kneeR: 0.1, spell: 'right' },
  /** A predator's crouch: low, the head up, both clawed hands spread to seize. */
  feral: { spine: [0.5, 0, 0], neck: [-0.5, 0, 0], shoulderR: [-0.9, 0, 0.55], elbowR: -1.5, wristR: [0.7, 0, 0], shoulderL: [-1.1, 0, 0.45], elbowL: -1.3, wristL: [0.7, 0, 0], hipL: [-0.8, 0, 0.3], kneeL: 1.2, hipR: [-0.3, 0, 0.3], kneeR: 1.0 },
  /** The dead walking: arms out and slack, the head lolling, one foot dragging. */
  shamble: { spine: [0.28, 0, 0.1], neck: [0.15, 0, 0.3], shoulderR: [-1.35, 0, 0], elbowR: -0.2, wristR: [0.5, 0, 0], shoulderL: [-1.0, 0, 0.15], elbowL: -0.45, wristL: [0.6, 0, 0], hipL: [-0.35, 0, 0.05], kneeL: 0.5, hipR: [0.25, 0, 0.1], kneeR: 0.35 },
  /** A club or tool swung up one-handed, the other arm out for balance. */
  brawl: { spine: [0.14, 0.35, -0.06], neck: [-0.05, -0.3, 0], shoulderR: [-2.0, 0, 0.55], elbowR: -1.35, holdR: { upright: true, tilt: [-0.75, 0, 0.2] }, shoulderL: [-0.9, -0.5, 0.35], elbowL: -1.2, ...BRACED },
  /** Drifting above the floor, arms reaching. */
  haunt: { spine: [0.2, 0, 0], neck: [-0.2, 0, 0], shoulderR: [-1.5, 0, 0.35], elbowR: -0.35, shoulderL: [-1.2, 0, 0.5], elbowL: -0.6, hipL: [0.15, 0, 0], kneeL: 0.5, hipR: [0.3, 0, 0], kneeR: 0.7, lift: 0.9 },
  /** Mounted at a charge: forward in the saddle, the blade swept out to the right. */
  'ride-charge': { seated: true, spine: [0.28, -0.15, 0], neck: [-0.25, 0, 0], hipR: [-1.3, 0, 0.42], kneeR: 1.45, hipL: [-1.3, 0, 0.42], kneeL: 1.45, shoulderR: [-1.2, 0, 1.0], elbowR: -0.3, holdR: { upright: true, tilt: [0.9, 0, 0.5] }, shoulderL: [-0.75, 0, 0.05], elbowL: -0.9 },
  /** Mounted and rearing: leaning back on the reins, one arm flung high. */
  'ride-rear': { seated: true, spine: [-0.2, 0, 0], neck: [0.05, 0, 0], hipR: [-1.15, 0, 0.42], kneeR: 1.3, hipL: [-1.15, 0, 0.42], kneeL: 1.3, shoulderR: [-2.5, 0, 0.5], elbowR: -0.35, holdR: { upright: true, tilt: [-0.2, 0, 0] }, shoulderL: [-0.85, 0, 0.05], elbowL: -1.0 },
} satisfies Record<string, HeroPose>;
export type NpcPoseName = keyof typeof NPC_POSES;

/** How a body lies once it is down. `lie` lays the whole posed figure on its back, its front or its side. */
export type DeadPose = HeroPose & { lie: 'back' | 'front' | 'side' };
export const DEAD_POSES = {
  /** Flat on the back, limbs flung wide, the head rolled aside. */
  sprawl: { lie: 'back', neck: [0.1, 0.7, 0.2], shoulderR: [-0.3, 0, 1.25], elbowR: -0.5, shoulderL: [0.1, 0, 0.7], elbowL: -1.2, hipR: [0.05, 0.3, 0.35], kneeR: 0.5, hipL: [0, 0.2, 0.15], kneeL: 0.1 },
  /** Face down, one arm reaching for something it never got to, one leg crooked. */
  prone: { lie: 'front', neck: [0.1, -0.8, 0], shoulderR: [-2.7, 0, 0.35], elbowR: -0.3, shoulderL: [0.1, 0, 0.5], elbowL: -0.9, hipR: [0, 0, 0.15], kneeR: 0.15, hipL: [-0.5, 0.5, 0.5], kneeL: 1.2 },
  /** Curled on its side around the wound. */
  curled: { lie: 'side', spine: [0.55, 0, 0], neck: [0.35, 0, 0], shoulderR: [-0.97, 0, -0.3], elbowR: -1.6, shoulderL: [-0.98, 0, -0.3], elbowL: -1.5, hipR: [-1.2, 0, 0], kneeR: 1.57, hipL: [-0.9, 0, 0], kneeL: 1.4 },
  /** Face-planted with the rump in the air and the arms trailing behind. */
  comic: { lie: 'front', spine: [0.4, 0, 0], neck: [-0.5, 0.6, 0], shoulderR: [0.9, 0, 0.5], elbowR: -0.2, shoulderL: [0.8, 0, 0.6], elbowL: -0.3, hipR: [-1.9, 0, 0.37], kneeR: 1.57, hipL: [-1.77, 0, 0.3], kneeL: 1.57 },
  /** The classic: crumpled on its side in a heap, knees drawn up, one arm folded under, the other flopped out, the face in the dirt. */
  crumpled: { lie: 'side', spine: [0.35, 0.3, 0.15], neck: [0.3, 0.7, 0.2], shoulderR: [-0.5, 0, 0.2], elbowR: -1.9, wristR: [0.6, 0, 0], shoulderL: [-1.5, 0, 0.6], elbowL: -0.5, wristL: [0.8, 0, 0], hipR: [-0.9, 0, 0.1], kneeR: 1.5, hipL: [-0.45, 0, 0.25], kneeL: 1.0, ankleL: [0.5, 0, 0] },
  /** On the back with the back of one hand to the brow: a swoon held a little too long. */
  swoon: { lie: 'back', neck: [-0.15, -0.3, 0], shoulderR: [-2.6, 0, 0.5], elbowR: -2.0, shoulderL: [0, 0, 0.4], elbowL: -0.3, hipR: [0, 0, 0.06], hipL: [-0.4, 0, 0.1], kneeL: 0.8 },
  /** Laid out straight, the hands folded on the chest: a body prepared, or a vampire finally at rest. */
  'laid-out': { lie: 'back', shoulderR: [-0.15, -0.99, 0.12], elbowR: -1.75, wristR: [0, 0.01, 0], shoulderL: [-0.33, -1.1, 0.12], elbowL: -1.85, wristL: [0, 0.01, 0], hipR: [0, 0, 0.03], hipL: [0, 0, 0.03] },
  /** Thrown on the back mid-snarl, clawed hands still raised, the knees drawn up. */
  slain: { lie: 'back', neck: [-0.4, 0.3, 0], shoulderR: [-1.3, 0, 0.6], elbowR: -1.3, wristR: [0.7, 0, 0], shoulderL: [-1.0, 0, 0.8], elbowL: -1.5, wristL: [0.7, 0, 0], hipR: [-0.9, 0, 0.3], kneeR: 1.5, hipL: [-0.4, 0, 0.35], kneeL: 0.9 },
} satisfies Record<string, DeadPose>;
export type DeadPoseName = keyof typeof DEAD_POSES;
/** The dead pose for a recipe: one of these by name, one of the rig's own presets by name (passed through), joint
 *  angles as given, or, with nothing set, one picked from the everyday ones by a seed so a field of bodies does not match. */
export function deadPose(name: unknown, seed = ''): HeroPose | string {
  if (typeof name === 'string') return name in DEAD_POSES ? DEAD_POSES[name as DeadPoseName] : name;
  if (name && typeof name === 'object') return name as HeroPose;
  let h = 7; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DEAD_POSES[(['crumpled', 'comic', 'sprawl', 'crumpled', 'prone', 'comic', 'swoon'] as const)[h % 7]];
}

/** A figure recipe whose `pose` and `battlePose` may name one of these poses: the same recipe with those names replaced
 *  by their joint angles, so the shared rig (which knows only its own names) can build it. */
// ---- poses put together per character -------------------------------------------------------------------------------
// A character's pose is written in the manifest as a few words: how they stand, how they carry their back and head, and
// what each arm is doing, e.g. "weightR haughty R:beckon L:hilt". Each word is one checked piece, so every character can
// have a pose of their own without a hand-tuned set of angles apiece.
export type Arm = { sh: [number, number, number]; el: number; wr?: [number, number, number]; hold?: HeroPose['holdR']; talon?: boolean; hilt?: boolean; onHip?: boolean; fist?: boolean };
const STANCES: Record<string, HeroPose> = {
  stand: { hipR: [0, 0, 0.05], hipL: [0, 0, 0.05] },
  weightR: { pelvis: [0, 0, -0.05], hipR: [0.03, 0, 0.02], hipL: [-0.18, 0, 0.12], kneeL: 0.32 },
  weightL: { pelvis: [0, 0, 0.05], hipL: [0.03, 0, 0.02], hipR: [-0.18, 0, 0.12], kneeR: 0.32 },
  wide: { hipR: [0, 0, 0.2], hipL: [0, 0, 0.2] },
  stride: { hipR: [-0.3, 0, 0.06], kneeR: 0.28, hipL: [0.24, 0, 0.06], kneeL: 0.12 },
  demure: { hipR: [0, 0, 0.01], hipL: [-0.1, 0, -0.02], kneeL: 0.2 },
  old: { hipL: [-0.3, 0, 0.1], kneeL: 0.6, hipR: [-0.25, 0, 0.1], kneeR: 0.55 },
  lunge: LUNGE, braced: BRACED,
  crouch: { hipL: [-0.8, 0, 0.3], kneeL: 1.2, hipR: [-0.3, 0, 0.3], kneeR: 1.0 },
  ready: { hipR: [-0.3, 0, 0.14], kneeR: 0.45, hipL: [0.1, 0, 0.16], kneeL: 0.3 },
  retreat: { hipR: [0.3, 0, 0.1], kneeR: 0.35, hipL: [-0.15, 0, 0.12], kneeL: 0.4 },
};
const TORSOS: Record<string, HeroPose> = {
  proud: { spine: [-0.06, 0, 0], neck: [-0.08, 0, 0] },
  easy: { spine: [0.02, 0, 0.03], neck: [0, 0.12, 0] },
  haughty: { spine: [-0.08, 0.12, 0], neck: [-0.14, -0.2, 0.05] },
  sway: { spine: [0, 0, 0.07], neck: [0, 0.12, -0.08] },
  stoop: { spine: [0.42, 0, 0], neck: [-0.38, 0, 0] },
  bowed: { spine: [0.16, 0, 0], neck: [0.2, 0, 0.08] },
  intent: { spine: [0.18, 0, 0], neck: [-0.15, 0, 0] },
  turnL: { spine: [0.05, 0.3, 0], neck: [0, -0.3, 0] },
  turnR: { spine: [0.05, -0.3, 0], neck: [0, 0.3, 0] },
  recoil: { spine: [-0.14, 0.15, 0], neck: [0.1, -0.1, 0] },
  low: { spine: [0.5, 0, 0], neck: [-0.5, 0, 0] },
  loom: { spine: [0.2, -0.22, 0], neck: [-0.04, 0.22, 0] },
};
export const ARMS: Record<string, Arm> = {
  hang: { sh: [0.05, 0, 0.1], el: -0.15 },
  fist: { sh: [0.04, 0, 0.16], el: -0.3, fist: true },
  // a heavy arm carried a little forward and out from the body, the hand hooked into a claw (a brute's, a fiend's)
  heavy: { sh: [-0.2, 0, 0.32], el: -0.6, wr: [0.2, 0.01, 0], talon: true },
  hilt: { sh: [0.12, 0, 0.3], el: -0.75, hilt: true },
  chest: { sh: [-0.55, -0.7, 0.08], el: -2.0 },
  behind: { sh: [0.45, -1.5, 0.12], el: -1.25 },
  // folded arms: the right forearm laid over the left, a little higher, so neither hand sinks into the other arm (a
  // wrist given, so the hand keeps its turn instead of hanging palm to thigh)
  folded: { sh: [-0.5, -1.5, 0.3], el: -1.65, wr: [0, 0.01, 0] },
  foldedLow: { sh: [-0.21, -1.5, 0.33], el: -1.73, wr: [0, 0.01, 0] },
  wring: { sh: [-0.6, -0.75, 0.05], el: -1.8 },
  hip: { sh: [0.9, -0.6, 0.6], el: -1.6, onHip: true, fist: true },  // (the rig solves the arm so the fist sits on the waist, outside it)
  staff: { sh: [-0.75, 0, 0.15], el: -0.95, hold: { upright: true } },
  offer: { sh: [-0.5, 0, 0.25], el: -0.9, wr: [-0.4, 0, 0] },
  beckon: { sh: [-0.7, 0, 0.3], el: -1.1, wr: [-0.7, 0, 0] },
  command: { sh: [-1.25, 0, 0.1], el: -0.25, wr: [0.3, 0, 0] },
  claw: { sh: [-1.0, 0, 0.5], el: -1.4, wr: [0.7, 0, 0] },
  grasp: { sh: [-1.45, 0, 0.25], el: -0.45, wr: [-1.25, 2.8, 0], talon: true },
  high: { sh: [-2.3, 0, 0.3], el: -0.5 },
  ward: { sh: [-0.9, -0.3, 0.15], el: -1.5, wr: [-0.6, 0, 0] },
  cloak: { sh: [0.2, -0.6, 0.4], el: -0.9 },
  chin: { sh: [-0.55, -0.5, 0.05], el: -2.2 },
  skirt: { sh: [0.1, 0, 0.2], el: -0.35 },
  book: { sh: [-0.45, -0.2, 0.1], el: -1.5 },
  balance: { sh: [0.3, 0, 0.55], el: -1.1 },
  cast: { sh: [-1.35, 0, 0.15], el: -0.45, wr: [0.6, 0, 0] },
  guard: { sh: [-0.95, 0, 0.12], el: -0.95, hold: { upright: true, tilt: [1.15, 0, 0] } },
  point: { sh: [-1.2, 0, 0.1], el: -0.3, hold: { upright: true, tilt: [1.45, 0, 0] } },
  lowguard: { sh: [-0.35, 0, 0.2], el: -0.55, hold: { upright: true, tilt: [1.9, 0, 0] } },
  cocked: { sh: [-0.65, 0, 0.9], el: -1.9, hold: { upright: true, tilt: [-0.7, 0, 0.3] } },
  drawn: { sh: [-0.9, 0, 0.5], el: -2.0, hold: { upright: true, tilt: [-0.4, 0, 0.3] } },
  overhead: { sh: [-1.85, 0, 0.55], el: -1.55, hold: { upright: true, tilt: [-0.8, 0, -0.2] } },
  raised: { sh: [-2.0, 0, 0.55], el: -1.35, hold: { upright: true, tilt: [-0.75, 0, 0.2] } },
  level: { sh: [0, 0, 0.25], el: -1.45, hold: { upright: true, tilt: [1.45, 0, 0] } },
  grip2: { sh: [-1.8, -0.55, -0.05], el: -1.35 },
  shaft: { sh: [-0.9, -0.5, 0], el: -0.6 },
  brace: { sh: [-1.0, -0.3, 0.2], el: -1.1 },
};
const LOOKS: Record<string, [number, number, number]> = { L: [0, 0.35, 0], R: [0, -0.35, 0], up: [-0.22, 0, 0], down: [0.22, 0, 0], tilt: [0, 0, 0.16], tiltL: [0, 0, 0.16], tiltR: [0, 0, -0.16], ahead: [0, 0, 0] };
/** Where the eyes go when the pose says so (`eyes:`): otherwise they follow the head (heroes.ts eyeLine). */
const EYELINES: Record<string, [number, number]> = { L: [0.8, 0], R: [-0.8, 0], up: [0, 0.8], down: [0, -0.8], ahead: [0, 0], glare: [0, 0.7], sideL: [0.9, 0.15], sideR: [-0.9, 0.15], awayL: [0.7, -0.5], awayR: [-0.7, -0.5] };
/** Arms that draw the eye: the head turns a little toward the hand that is doing something. */
const POINTED = ['beckon', 'offer', 'command', 'cast', 'claw', 'grasp', 'guard', 'point', 'lowguard', 'ward', 'high', 'staff'];
/** Put a pose together from its words: a stance, a carriage, `R:` and `L:` arms, `look:` for the head, `spell` for a
 *  lit hand, `float` to hang above the floor. An arm may also be given raw as `R:@x,y,z,elbow` while a new one is tried. */
export function compose(words: string): HeroPose {
  const out: Record<string, unknown> = {};
  for (const w of words.trim().split(/\s+/)) {
    if (STANCES[w]) Object.assign(out, STANCES[w]);
    else if (TORSOS[w]) Object.assign(out, TORSOS[w]);
    else if (w === 'spell') out.spell = 'right';
    else if (w === 'spellL') out.spell = 'left';
    else if (w === 'float') out.lift = 0.9;
    else if (w === 'two') out.twoHand = true;
    else if (/^eyes:/.test(w)) { const k = EYELINES[w.slice(5)]; if (k) out.gaze = k; }
    else if (/^look:/.test(w)) { const k = LOOKS[w.slice(5)], n = (out.neck as number[] | undefined) ?? [0, 0, 0]; if (k) out.neck = [n[0] + k[0], n[1] + k[1], n[2] + k[2]]; }
    else if (/^[RL]:/.test(w)) {
      const side = w[0], name = w.slice(2);
      const a: Arm | undefined = name[0] === '@' ? (() => { const v = name.slice(1).split(',').map(Number); return { sh: [v[0], v[1], v[2]] as [number, number, number], el: v[3] }; })() : ARMS[name];
      if (!a) continue;
      out['shoulder' + side] = a.sh; out['elbow' + side] = a.el; if (a.wr) out['wrist' + side] = a.wr; if (a.hold) out['hold' + side] = a.hold;
      if (a.talon) out.talon = [...((out.talon as string[] | undefined) ?? []), side];
      if (a.hilt) out.hilt = [...((out.hilt as string[] | undefined) ?? []), side];
      if (a.onHip) out.hipHand = [...((out.hipHand as string[] | undefined) ?? []), side];
      if (a.fist) out.fist = [...((out.fist as string[] | undefined) ?? []), side];
    }
  }
  // no head is ever held dead level: unless the pose says where to look, the head tips toward the standing leg and turns
  // a little toward the working hand
  if (!/look:/.test(words)) {
    const nk = ((out.neck as number[] | undefined) ?? [0, 0, 0]).slice() as [number, number, number];
    if (/\bweightR\b|\blunge\b|\bready\b/.test(words)) nk[2] -= 0.1; else if (/\bweightL\b|\bbraced\b|\bretreat\b/.test(words)) nk[2] += 0.1; else nk[2] += 0.06;
    const r = /R:(\w+)/.exec(words)?.[1], l = /L:(\w+)/.exec(words)?.[1];
    if (r && POINTED.includes(r) && !(l && POINTED.includes(l))) nk[1] -= 0.18; else if (l && POINTED.includes(l) && !(r && POINTED.includes(r))) nk[1] += 0.18;
    out.neck = nk;
  }
  return out as HeroPose;
}

/** Whether every word of a composed pose is one this file knows (the test's check on the manifest). */
export function composedOk(words: string): boolean {
  return words.trim().split(/\s+/).every((w) => !!STANCES[w] || !!TORSOS[w] || ['spell', 'spellL', 'float', 'two'].includes(w) || (/^look:/.test(w) && w.slice(5) in LOOKS) || (/^eyes:/.test(w) && w.slice(5) in EYELINES) || (/^[RL]:/.test(w) && (w[2] === '@' || w.slice(2) in ARMS)));
}
export function posed<T extends { pose?: unknown; battlePose?: unknown }>(f: T): T {
  const fix = (p: unknown) => (typeof p !== 'string' ? p : p in NPC_POSES ? NPC_POSES[p as NpcPoseName] : /[ :]/.test(p) ? compose(p) : p);
  return f.pose === fix(f.pose) && f.battlePose === fix(f.battlePose) ? f : { ...f, pose: fix(f.pose), battlePose: fix(f.battlePose) };
}
