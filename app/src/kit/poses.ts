// Poses with character: how a particular kind of person stands at rest and in a fight, as joint angles for the shared
// figure rig (kit/heroes.ts HeroPose). The manifest names them per character; bestiary.ts resolves the names.
import type { HeroPose } from './heroes';

const LUNGE: HeroPose = { hipR: [-0.75, 0, 0.1], kneeR: 0.95, hipL: [0.5, 0, 0.2], kneeL: 0.1 };
const BRACED: HeroPose = { hipL: [-0.5, 0, 0.18], kneeL: 0.7, hipR: [0.4, 0, 0.14], kneeR: 0.3 };

export const NPC_POSES = {
  // ---- at rest
  /** A lord at ease: chin up, one hand at the chest, the other resting on the hilt at his hip. */
  regal: { spine: [-0.04, 0.1, 0], neck: [-0.1, -0.15, 0], shoulderR: [-0.35, 0, 0.12], elbowR: -1.5, wristR: [0.3, 0, 0], shoulderL: [0.12, 0, 0.3], elbowL: -0.75, hipL: [-0.12, 0, 0.06], kneeL: 0.2 },
  /** Bent with age or malice: the back curved, the head thrust forward, the knees soft. */
  hunched: { spine: [0.42, 0, 0], neck: [-0.38, 0, 0], shoulderR: [-0.5, 0, 0.1], elbowR: -0.9, holdR: { upright: true }, shoulderL: [-0.3, 0, 0.1], elbowL: -1.1, wristL: [0.5, 0, 0], hipL: [-0.35, 0, 0.1], kneeL: 0.7, hipR: [-0.3, 0, 0.1], kneeR: 0.6 },
  /** Fists on the hips, chest out. */
  'hands-on-hips': { spine: [-0.06, 0, 0], shoulderR: [0.25, 0, 0.75], elbowR: -1.75, shoulderL: [0.25, 0, 0.75], elbowL: -1.75, hipL: [0, 0, 0.12], hipR: [0, 0, 0.12] },
  /** Hands clasped behind the back, watchful. */
  'behind-back': { spine: [-0.03, 0, 0], neck: [0.05, 0.25, 0], shoulderR: [0.5, 0, -0.05], elbowR: -0.55, shoulderL: [0.5, 0, -0.05], elbowL: -0.55 },
  /** Arms folded, weight on one leg. */
  'arms-folded': { spine: [0.03, 0, 0.04], shoulderR: [-0.55, 0, -0.35], elbowR: -1.75, shoulderL: [-0.5, 0, -0.35], elbowL: -1.65, hipL: [-0.1, 0, 0.1], kneeL: 0.2 },
  /** Hands wrung together at the chest, shoulders in: grief or worry. */
  wringing: { spine: [0.18, 0, 0], neck: [0.25, 0, 0.1], shoulderR: [-0.6, 0, -0.3], elbowR: -1.7, shoulderL: [-0.6, 0, -0.3], elbowL: -1.7 },
  /** Leaning on a staff or a cane held upright. */
  leaning: { spine: [0.16, 0, -0.05], neck: [-0.12, 0, 0], shoulderR: [-0.75, 0, 0.15], elbowR: -0.95, holdR: { upright: true }, hipL: [-0.1, 0, 0.05], kneeL: 0.2 },

  // ---- in a fight
  /** The vampire lord: unhurried, one clawed hand out to command or charm, the other sweeping his cloak back. */
  'vampire-lord': { spine: [-0.06, -0.3, 0], neck: [-0.1, 0.25, 0], shoulderR: [-1.3, 0, 0.3], elbowR: -0.4, wristR: [-0.45, 0, 0], shoulderL: [0.4, 0, 0.85], elbowL: -0.45, hipL: [-0.3, 0, 0.1], kneeL: 0.35, hipR: [0.2, 0, 0.12], kneeR: 0.05, spell: 'right' },
  /** En garde: side on, the point forward, the off hand high behind. */
  duelist: { spine: [0.1, -0.5, 0], neck: [0, 0.45, 0], shoulderR: [-1.35, 0, 0.1], elbowR: -0.25, holdR: { upright: true, tilt: [1.3, 0, 0] }, shoulderL: [0.5, 0, 0.9], elbowL: -1.4, ...LUNGE },
  /** A great blade heaved overhead in both hands. */
  'overhead': { spine: [0.1, 0.15, 0], neck: [-0.1, 0, 0], shoulderR: [-2.55, 0, -0.3], elbowR: -0.7, shoulderL: [-2.45, 0, -0.5], elbowL: -0.8, holdR: { upright: true, tilt: [-0.55, 0, 0.15] }, ...BRACED },
  /** An axe wound back over the shoulder, the other arm thrust out. */
  windup: { spine: [0.1, 0.4, 0], neck: [0, -0.3, 0], shoulderR: [-2.2, 0, 0.5], elbowR: -1.3, holdR: { upright: true, tilt: [-0.9, 0, 0] }, shoulderL: [-1.4, 0, 0.1], elbowL: -0.15, wristL: [0.9, 0, 0], ...BRACED },
  /** A curved blade drawn back across the body for a slash. */
  slash: { spine: [0.12, 0.5, 0], neck: [0, -0.4, 0], shoulderR: [-1.7, 0, -0.7], elbowR: -1.2, holdR: { upright: true, tilt: [0.3, 0, 1.0] }, shoulderL: [0.3, 0, 0.6], elbowL: -0.4, ...BRACED },
  /** A spear or pitchfork levelled in both hands. */
  thrust: { spine: [0.2, 0.55, 0], neck: [-0.1, -0.5, 0], shoulderR: [-0.3, 0, 0.2], elbowR: -1.3, holdR: { upright: true, tilt: [1.45, 0, 0] }, shoulderL: [-1.2, 0, -0.3], elbowL: -0.4, ...LUNGE },
  /** A hag's curse: bent double over her staff, a clawed hand raised. */
  curse: { spine: [0.42, 0.1, 0], neck: [-0.38, 0, 0], shoulderR: [-0.9, 0, 0.2], elbowR: -0.9, holdR: { upright: true }, shoulderL: [-1.9, 0, 0.5], elbowL: -0.9, wristL: [0.7, 0, 0], hipL: [-0.4, 0, 0.15], kneeL: 0.8, hipR: [-0.3, 0, 0.15], kneeR: 0.7 },
  /** A spell thrown from the right hand, feet planted. */
  spellcast: { spine: [0.05, 0.2, 0], shoulderR: [-1.5, 0, 0.3], elbowR: -0.2, wristR: [0.9, 0, 0], shoulderL: [-0.6, 0, 0.5], elbowL: -1.2, hipL: [-0.3, 0, 0.1], kneeL: 0.4, spell: 'right' },
  /** Holy symbol or open hand thrust up, the other warding. */
  rebuke: { spine: [-0.05, 0, 0], neck: [-0.15, 0, 0], shoulderR: [-2.6, 0, 0.25], elbowR: -0.3, shoulderL: [-1.1, 0, 0.3], elbowL: -0.7, wristL: [0.8, 0, 0], hipL: [-0.2, 0, 0.1], kneeL: 0.3, spell: 'right' },
  /** A predator's crouch: low, the head up, both clawed hands spread to seize. */
  feral: { spine: [0.6, 0, 0], neck: [-0.55, 0, 0], shoulderR: [-1.0, 0, 0.75], elbowR: -1.0, wristR: [0.7, 0, 0], shoulderL: [-1.25, 0, 0.6], elbowL: -0.8, wristL: [0.7, 0, 0], hipL: [-0.9, 0, 0.25], kneeL: 1.3, hipR: [-0.45, 0, 0.25], kneeR: 1.1 },
  /** The dead walking: arms out and slack, the head lolling, one foot dragging. */
  shamble: { spine: [0.28, 0, 0.1], neck: [0.15, 0, 0.3], shoulderR: [-1.35, 0, 0], elbowR: -0.2, wristR: [0.5, 0, 0], shoulderL: [-1.0, 0, 0.15], elbowL: -0.45, wristL: [0.6, 0, 0], hipL: [-0.35, 0, 0.05], kneeL: 0.5, hipR: [0.25, 0, 0.1], kneeR: 0.35 },
  /** A club or tool swung up one-handed, the other arm out for balance. */
  brawl: { spine: [0.12, 0.3, 0], shoulderR: [-2.3, 0, 0.3], elbowR: -0.9, holdR: { upright: true, tilt: [-0.4, 0, 0] }, shoulderL: [-0.7, 0, 0.5], elbowL: -0.8, ...BRACED },
  /** Drifting above the floor, arms reaching. */
  haunt: { spine: [0.2, 0, 0], neck: [-0.2, 0, 0], shoulderR: [-1.5, 0, 0.35], elbowR: -0.35, shoulderL: [-1.2, 0, 0.5], elbowL: -0.6, hipL: [0.15, 0, 0], kneeL: 0.5, hipR: [0.3, 0, 0], kneeR: 0.7, lift: 0.9 },
  /** Mounted at a charge: forward in the saddle, the blade swept out to the right. */
  'ride-charge': { seated: true, spine: [0.28, -0.15, 0], neck: [-0.25, 0, 0], hipR: [-1.3, 0, 0.42], kneeR: 1.45, hipL: [-1.3, 0, 0.42], kneeL: 1.45, shoulderR: [-1.2, 0, 1.0], elbowR: -0.3, holdR: { upright: true, tilt: [0.9, 0, 0.5] }, shoulderL: [-0.75, 0, 0.05], elbowL: -0.9 },
  /** Mounted and rearing: leaning back on the reins, one arm flung high. */
  'ride-rear': { seated: true, spine: [-0.2, 0, 0], neck: [0.05, 0, 0], hipR: [-1.15, 0, 0.42], kneeR: 1.3, hipL: [-1.15, 0, 0.42], kneeL: 1.3, shoulderR: [-2.5, 0, 0.5], elbowR: -0.35, holdR: { upright: true, tilt: [-0.2, 0, 0] }, shoulderL: [-0.85, 0, 0.05], elbowL: -1.0 },
} satisfies Record<string, HeroPose>;
export type NpcPoseName = keyof typeof NPC_POSES;

/** A figure recipe whose `pose` and `battlePose` may name one of these poses: the same recipe with those names replaced
 *  by their joint angles, so the shared rig (which knows only its own names) can build it. */
export function posed<T extends { pose?: unknown; battlePose?: unknown }>(f: T): T {
  const fix = (p: unknown) => (typeof p === 'string' && p in NPC_POSES ? NPC_POSES[p as NpcPoseName] : p);
  return f.pose === fix(f.pose) && f.battlePose === fix(f.battlePose) ? f : { ...f, pose: fix(f.pose), battlePose: fix(f.battlePose) };
}
