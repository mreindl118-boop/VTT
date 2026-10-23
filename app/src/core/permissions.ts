// Who may do what on the board: move a token, open or close a door or a container, take a stair, use "Move party here".
// These are the decision tables of docs/PLAYABILITY.md 2.2 (exploring) and 2.4 (on a turn), by actor, phase, token kind,
// the "DM runs" hold, the order and whose turn it is. Pure: the walk and range checks are inputs the caller computes
// (core/movement.ts or walkField, core/range.ts with encounter.ts moveCellAt), so a walk check's own refusal words pass
// through unchanged. The DM is never refused (from release 1a, not even a combatant out of its turn), except for that
// one move in the slider preview, as today (MoveQuery `preview`).
import type { FightPhase, TokenKind } from './encounter';

export { tokenKind, type TokenKind } from './encounter';

/** Who acts: the DM, or the players' side (Players view on the DM's screen, the Player map, later a seat). */
export type Actor = 'dm' | 'players';
/** Exploring: no fight on this map. Called and Paused arrive with release 3; the tables cover them now. */
export type Phase = 'exploring' | FightPhase;

export type Verdict = { ok: true; note?: string } | { ok: false; reason: string };
/** A move's verdict also says how much movement it spends on the current combatant's turn. */
export type MoveVerdict = { ok: true; note?: string; spendFt?: number } | { ok: false; reason: string };
/** A walk check the caller ran: its own refusal words, as framework release 1 writes them. */
export type Check = { ok: true } | { ok: false; reason: string };

/** The words the players' side and the DM read. The first four are today's (app.ts moveTokenTo, toggleDoor). */
export const WORDS = {
  notYourTurn: 'Not your turn', // pinned by e2e/surfaces.spec.ts:190 (the slider preview and Players view)
  outOfRange: 'Out of movement range',
  placedByDm: 'Placed by the DM: no movement spent',
  locked: 'Locked',
  noWay: 'No way through', // today's hover word (app.ts previewMove), for a walk the caller did not check
  paused: 'The DM has paused play',
  called: 'Rolling for initiative',
  dmMoves: 'Only the DM moves this',
  dmOnly: 'Only the DM can do that',
  tooFar: 'Too far: stand within 5 ft',
} as const;
/** A character the DM runs for an absent player. */
export const dmRunning = (name: string): string => `The DM is running ${name}`;
/** A token on a floor other than the one the move is on. */
export const otherFloor = (name: string): string => `${name} is on another floor`;

/** How near a character must stand to open or close something on its turn (and outside one, by the table's setting). */
export const REACH_FT = 5;

const no = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

/** Who stands where in a fight: the token's place in the order and whose turn it is. */
export interface TurnFacts {
  /** The token is in this map's fight order. */
  inOrder?: boolean;
  /** It is that token's turn. */
  current?: boolean;
}

/** A token acting: its kind, its name as this side reads it (for the hold's words), and its row's hold. */
export interface ActingToken extends TurnFacts {
  kind: TokenKind;
  name: string;
  /** The character's row is marked "DM runs" (an absent player's character). */
  dmRuns?: boolean;
}

export interface MoveQuery extends ActingToken {
  actor: Actor;
  phase: Phase;
  /** Outside a fight, the players' walk check (walls and closed doors stop it). The DM is never walk-checked. */
  walk?: Check;
  /** On a turn, the current combatant's green square that holds the destination and reaches it, walls and floor
   *  checked (encounter.ts moveCellAt with the range's own ground), if any. */
  moveCell?: { costFt: number };
  /** The token's own floor and the destination's: the players' side moves a token on its own floor only. */
  tokenLevel?: string;
  targetLevel?: string;
  /**
   * The DM's slider preview: DM view with the slider at its players' end (app.ts `playersSide` without `restricted`).
   * The DM still acts, with one exception kept from today: a combatant moved out of its turn is refused in the players'
   * words, "Not your turn" (app.ts:2040, pinned by e2e/surfaces.spec.ts:189-190). Everything else stays the DM's: the
   * current combatant off its green squares is placed, a token outside the order and the marker move freely. Whether
   * the preview should show the players' rules in full instead is Matt's call; this keeps today's preview.
   */
  preview?: boolean;
}

/** The players' side frozen by the phase. */
function frozen(phase: Phase): { ok: false; reason: string } | undefined {
  if (phase === 'paused') return no(WORDS.paused);
  if (phase === 'called') return no(WORDS.called);
  return undefined;
}

/** May the players' side act with this token now (move it, or take a stair with it)? */
function playersMay(phase: Phase, t: ActingToken): { ok: false; reason: string } | undefined {
  const f = frozen(phase); if (f) return f;
  if (t.kind === 'creature' || t.kind === 'foe') return no(WORDS.dmMoves);
  if (t.kind === 'character' && t.dmRuns) return no(dmRunning(t.name));
  if (phase === 'running' && !(t.inOrder && t.current)) return no(WORDS.notYourTurn);
  return undefined;
}

/**
 * Moving a token. The DM moves anything anywhere, through walls; on a turn, a combatant's move onto the current one's
 * green squares spends its movement, and any other combatant's move is a placement ("Placed by the DM: no movement
 * spent"), except in the slider preview, where a combatant out of its turn is refused as today (`preview`). The
 * players' side walks the party marker or a character (not one the DM runs) outside a fight, and on a turn moves only
 * the current character, only onto its green squares; it never moves a creature or a foe row's token.
 */
export function canMove(q: MoveQuery): MoveVerdict {
  if (q.actor === 'dm') {
    if (q.phase === 'exploring' || q.phase === 'called' || !q.inOrder) return { ok: true };
    if (q.current && q.moveCell) return { ok: true, spendFt: q.moveCell.costFt };
    if (q.preview && !q.current) return no(WORDS.notYourTurn);
    return { ok: true, note: WORDS.placedByDm };
  }
  const held = playersMay(q.phase, q); if (held) return held;
  if (q.tokenLevel !== undefined && q.targetLevel !== undefined && q.tokenLevel !== q.targetLevel) return no(otherFloor(q.name));
  if (q.phase === 'running') return q.moveCell ? { ok: true, spendFt: q.moveCell.costFt } : no(WORDS.outOfRange);
  if (!q.walk) return no(WORDS.noWay);
  return q.walk.ok ? { ok: true } : no(q.walk.reason);
}

export type StairQuery = ActingToken & { actor: Actor; phase: Phase };

/** Taking a stair, a ladder or a trapdoor with a token (walking onto its end, or the DM's stair marker). The same rule as
 *  a move: the climb itself is free, so no range or walk check (reaching the stair end is the move's). */
export function canTakeStair(q: StairQuery): Verdict {
  if (q.actor === 'dm') return { ok: true };
  return playersMay(q.phase, q) ?? { ok: true };
}

export interface OpenQuery {
  actor: Actor;
  phase: Phase;
  /** A locked door or container; the players' side may still close one that stands open, as today. */
  locked?: boolean;
  open?: boolean;
  /** On a turn: the current combatant (none: a turn the board cannot name). */
  current?: Pick<ActingToken, 'kind' | 'name' | 'dmRuns'>;
  /** How far the acting character stands from it (the current combatant on a turn; outside a fight, the nearest
   *  character). Without it the 5-ft rule is not applied: release 1a measures nothing, release 3 passes it. */
  distanceFt?: number;
  /** The table's setting (decision 6): outside a fight too, only within 5 ft of a character. */
  within5Ft?: boolean;
}

/**
 * Opening or closing a door or a container. The DM opens anything, a locked one included. Outside a fight the players'
 * side opens any unlocked one (the UI offers only what shows), within 5 ft of a character if the table says so; locked
 * ones say "Locked". On a turn only the current character may, within 5 ft; anyone else hears "Not your turn".
 */
export function canOpen(q: OpenQuery): Verdict {
  if (q.actor === 'dm') return { ok: true };
  const f = frozen(q.phase); if (f) return f;
  if (q.phase === 'running') {
    const c = q.current;
    if (!c || c.kind !== 'character') return no(WORDS.notYourTurn);
    if (c.dmRuns) return no(dmRunning(c.name));
  }
  if (q.locked && !q.open) return no(WORDS.locked);
  if ((q.phase === 'running' || q.within5Ft) && q.distanceFt !== undefined && q.distanceFt > REACH_FT + 1e-6) return no(WORDS.tooFar);
  return { ok: true };
}

export interface PartyHereQuery extends TurnFacts {
  actor: Actor;
  phase: Phase;
}

/** "Move party here" (the DM's map menu; from release 1b "Move Vex here" and "Gather the party here"): the DM's alone.
 *  On a turn, moving a combatant this way is a placement: no movement spent. `inOrder`: the party's token is in the fight. */
export function canMovePartyHere(q: PartyHereQuery): Verdict {
  if (q.actor === 'players') return no(WORDS.dmOnly);
  return q.inOrder && (q.phase === 'running' || q.phase === 'paused') ? { ok: true, note: WORDS.placedByDm } : { ok: true };
}
