// The decision tables of docs/PLAYABILITY.md 2.2 (exploring) and 2.4 (on a turn), one case per row, by actor, phase,
// token kind and the "DM runs" hold (app/src/core/permissions.ts); then stairs, doors and containers in and out of a
// fight, and "Move party here".
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canMove, canMovePartyHere, canOpen, canTakeStair, dmRunning, otherFloor, tokenKind, WORDS,
  type ActingToken, type Actor, type MoveQuery, type MoveVerdict, type Phase,
} from '../app/src/core/permissions';
import type { Sheet, Token } from '../app/src/state/campaign';

const WALK_OK = { ok: true } as const;
// The walk check's own words pass through: here framework release 1's diagnostic for a closed door.
const WALK_NO = { ok: false, reason: 'No way through: a closed door (d1) blocks the party. Open a door first.' } as const;
const GREEN = { costFt: 10 };
const refused = (reason: string): MoveVerdict => ({ ok: false, reason });
const move = (actor: Actor, phase: Phase, t: ActingToken, extra: Partial<MoveQuery> = {}) => canMove({ actor, phase, ...t, ...extra });

const vex: ActingToken = { kind: 'character', name: 'Vex' };
const vexHeld: ActingToken = { kind: 'character', name: 'Vex', dmRuns: true };
const party: ActingToken = { kind: 'marker', name: 'Party' };
const ghoul: ActingToken = { kind: 'creature', name: 'Hunched thing' };
const foe: ActingToken = { kind: 'foe', name: 'Foe 5' };

describe('the token kinds the tables read', () => {
  it('come from the role and the roster row', () => {
    const roster: Sheet[] = [{ id: 'pc-1', name: 'Vex', color: '#5b8ac9', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind: 'pc' },
      { id: 'npc-1', name: 'Foe 5', color: '#8a2b2b', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 60, kind: 'npc' }];
    const t = (x: Partial<Token>) => tokenKind(x as Token, roster);
    expect([t({ role: 'party' }), t({}), t({ role: 'member', sheetId: 'pc-1' }), t({ role: 'member', sheetId: 'npc-1' }), t({ role: 'creature', hidden: true })])
      .toEqual(['marker', 'marker', 'character', 'foe', 'creature']);
  });
  it("keep today's words, the players' 'Not your turn' as e2e/surfaces.spec.ts pins it", () => {
    expect(WORDS.notYourTurn).toBe('Not your turn');
    expect(readFileSync('e2e/surfaces.spec.ts', 'utf8')).toContain(".toHaveText('Not your turn')");
    expect([WORDS.outOfRange, WORDS.placedByDm, WORDS.locked]).toEqual(['Out of movement range', 'Placed by the DM: no movement spent', 'Locked']);
    expect([WORDS.paused, dmRunning('Vex')]).toEqual(['The DM has paused play', 'The DM is running Vex']);
  });
});

describe('table 2.2: exploring (no fight on this map)', () => {
  it('a character, party split: the players walk it (walls and closed doors stop it); the DM moves it anywhere, through walls', () => {
    expect(move('players', 'exploring', vex, { walk: WALK_OK })).toEqual({ ok: true });
    expect(move('players', 'exploring', vex, { walk: WALK_NO })).toEqual(refused(WALK_NO.reason));
    expect(move('dm', 'exploring', vex, { walk: WALK_NO })).toEqual({ ok: true });
  });
  it('the party marker, party together: the players walk it, as today; the DM anywhere, as today', () => {
    expect(move('players', 'exploring', party, { walk: WALK_OK })).toEqual({ ok: true });
    expect(move('players', 'exploring', party, { walk: WALK_NO })).toEqual(refused(WALK_NO.reason));
    expect(move('dm', 'exploring', party, { walk: WALK_NO })).toEqual({ ok: true });
  });
  it('a creature: never the players\' (a tap shows its card); the DM anywhere', () => {
    expect(move('players', 'exploring', ghoul, { walk: WALK_OK })).toEqual(refused(WORDS.dmMoves));
    expect(move('dm', 'exploring', ghoul)).toEqual({ ok: true });
  });
  it('a character marked "DM runs": never the players\' ("The DM is running Vex"); the DM anywhere', () => {
    expect(move('players', 'exploring', vexHeld, { walk: WALK_OK })).toEqual(refused('The DM is running Vex'));
    expect(move('dm', 'exploring', vexHeld)).toEqual({ ok: true });
  });
  it('a foe row\'s token: never the players\'; the DM anywhere', () => {
    expect(move('players', 'exploring', foe, { walk: WALK_OK })).toEqual(refused(WORDS.dmMoves));
    expect(move('dm', 'exploring', foe)).toEqual({ ok: true });
  });
  it('the players move a token on its own floor only; a walk nobody checked is refused, never allowed', () => {
    expect(move('players', 'exploring', vex, { walk: WALK_OK, tokenLevel: 'f1', targetLevel: 'f2' })).toEqual(refused(otherFloor('Vex')));
    expect(move('players', 'exploring', vex, { walk: WALK_OK, tokenLevel: 'f1', targetLevel: 'f1' })).toEqual({ ok: true });
    expect(move('dm', 'exploring', party, { tokenLevel: 'f1', targetLevel: 'f2' })).toEqual({ ok: true });
    expect(move('players', 'exploring', party)).toEqual(refused(WORDS.noWay));
  });
});

describe('table 2.4: on a turn (a running fight on this map)', () => {
  const now = { inOrder: true, current: true }, waiting = { inOrder: true, current: false }, outside = { inOrder: false, current: false };
  it('the current character: the players move it onto its green squares, spending movement; off them, "Out of movement range"', () => {
    expect(move('players', 'running', { ...vex, ...now }, { moveCell: GREEN })).toEqual({ ok: true, spendFt: 10 });
    expect(move('players', 'running', { ...vex, ...now })).toEqual(refused('Out of movement range'));
  });
  it('the current character by the DM: onto its green squares spends its movement, as today; off them, placed with no movement spent', () => {
    expect(move('dm', 'running', { ...vex, ...now }, { moveCell: GREEN })).toEqual({ ok: true, spendFt: 10 });
    expect(move('dm', 'running', { ...vex, ...now })).toEqual({ ok: true, note: 'Placed by the DM: no movement spent' });
  });
  it('a character whose turn it is not: the players hear "Not your turn"; the DM is never refused (a placement)', () => {
    expect(move('players', 'running', { ...vex, ...waiting }, { moveCell: GREEN })).toEqual(refused('Not your turn'));
    expect(move('dm', 'running', { ...vex, ...waiting }, { moveCell: GREEN })).toEqual({ ok: true, note: WORDS.placedByDm });
  });
  it('a character on this map but not in the fight is frozen for the players; the DM moves it freely', () => {
    expect(move('players', 'running', { ...vex, ...outside }, { walk: WALK_OK })).toEqual(refused('Not your turn'));
    expect(move('dm', 'running', { ...vex, ...outside })).toEqual({ ok: true });
  });
  it('the party marker during a fight: never in the order, so "Not your turn"; the DM moves it', () => {
    expect(move('players', 'running', { ...party, ...outside }, { walk: WALK_OK })).toEqual(refused('Not your turn'));
    expect(move('dm', 'running', { ...party, ...outside })).toEqual({ ok: true });
  });
  it('a creature on its turn (hidden or not) moves by the DM\'s hand only', () => {
    expect(move('players', 'running', { ...ghoul, ...now }, { moveCell: GREEN })).toEqual(refused(WORDS.dmMoves));
    expect(move('dm', 'running', { ...ghoul, ...now }, { moveCell: GREEN })).toEqual({ ok: true, spendFt: 10 });
    expect(move('dm', 'running', { ...ghoul, ...now })).toEqual({ ok: true, note: WORDS.placedByDm });
  });
  it('a creature out of its turn, or outside the order: the players never; the DM places it', () => {
    expect(move('players', 'running', { ...ghoul, ...waiting })).toEqual(refused(WORDS.dmMoves));
    expect(move('dm', 'running', { ...ghoul, ...waiting })).toEqual({ ok: true, note: WORDS.placedByDm });
    expect(move('dm', 'running', { ...ghoul, ...outside })).toEqual({ ok: true });
  });
  it('a foe row\'s token on its turn: the DM\'s, never the players\' (today the players could move it, F2)', () => {
    expect(move('players', 'running', { ...foe, ...now }, { moveCell: GREEN })).toEqual(refused(WORDS.dmMoves));
    expect(move('dm', 'running', { ...foe, ...now }, { moveCell: GREEN })).toEqual({ ok: true, spendFt: 10 });
  });
  it('a character the DM runs, on its turn: the players are told so; the DM moves it onto its green squares, spending its movement', () => {
    expect(move('players', 'running', { ...vexHeld, ...now }, { moveCell: GREEN })).toEqual(refused('The DM is running Vex'));
    expect(move('dm', 'running', { ...vexHeld, ...now }, { moveCell: GREEN })).toEqual({ ok: true, spendFt: 10 });
  });
});

describe('Called and Paused (release 3), every kind', () => {
  const kinds = [party, vex, vexHeld, ghoul, foe];
  it('Called: the players\' side freezes at once; the DM still moves anyone, to set up an ambush, spending nothing', () => {
    for (const t of kinds) {
      expect(move('players', 'called', { ...t, inOrder: true }, { walk: WALK_OK, moveCell: GREEN }), t.name).toEqual(refused('Rolling for initiative'));
      expect(move('dm', 'called', { ...t, inOrder: true }, { moveCell: GREEN }), t.name).toEqual({ ok: true });
    }
  });
  it('Paused: "The DM has paused play" for the players, in a fight or not; the DM is not paused', () => {
    for (const t of kinds) for (const turn of [{}, { inOrder: true, current: true }]) {
      expect(move('players', 'paused', { ...t, ...turn }, { walk: WALK_OK, moveCell: GREEN }), t.name).toEqual(refused('The DM has paused play'));
      expect(move('dm', 'paused', { ...t, ...turn }).ok, t.name).toBe(true);
    }
  });
});

describe('stairs, ladders and trapdoors', () => {
  it('exploring: the players take one with the marker or a character, never a creature, a foe or a character the DM runs', () => {
    expect(canTakeStair({ actor: 'players', phase: 'exploring', ...party })).toEqual({ ok: true });
    expect(canTakeStair({ actor: 'players', phase: 'exploring', ...vex })).toEqual({ ok: true });
    expect(canTakeStair({ actor: 'players', phase: 'exploring', ...ghoul })).toEqual(refused(WORDS.dmMoves));
    expect(canTakeStair({ actor: 'players', phase: 'exploring', ...foe })).toEqual(refused(WORDS.dmMoves));
    expect(canTakeStair({ actor: 'players', phase: 'exploring', ...vexHeld })).toEqual(refused(dmRunning('Vex')));
  });
  it('in a fight: the current character only, "Not your turn" otherwise; Called and Paused freeze it; the DM always may', () => {
    expect(canTakeStair({ actor: 'players', phase: 'running', ...vex, inOrder: true, current: true })).toEqual({ ok: true });
    expect(canTakeStair({ actor: 'players', phase: 'running', ...vex, inOrder: true, current: false })).toEqual(refused('Not your turn'));
    expect(canTakeStair({ actor: 'players', phase: 'running', ...party })).toEqual(refused('Not your turn'));
    expect(canTakeStair({ actor: 'players', phase: 'called', ...vex, inOrder: true })).toEqual(refused(WORDS.called));
    expect(canTakeStair({ actor: 'players', phase: 'paused', ...vex })).toEqual(refused(WORDS.paused));
    for (const phase of ['exploring', 'called', 'running', 'paused'] as const) for (const t of [party, vex, vexHeld, ghoul, foe])
      expect(canTakeStair({ actor: 'dm', phase, ...t, inOrder: true, current: false })).toEqual({ ok: true });
  });
});

describe('doors and containers (one rule for both)', () => {
  it(`exploring: the players open any unlocked one; a locked one says "Locked" (closing an open one is fine); the DM opens anything`, () => {
    expect(canOpen({ actor: 'players', phase: 'exploring' })).toEqual({ ok: true });
    expect(canOpen({ actor: 'players', phase: 'exploring', open: true })).toEqual({ ok: true });
    expect(canOpen({ actor: 'players', phase: 'exploring', locked: true })).toEqual(refused('Locked'));
    expect(canOpen({ actor: 'players', phase: 'exploring', locked: true, open: true })).toEqual({ ok: true });
    expect(canOpen({ actor: 'dm', phase: 'exploring', locked: true })).toEqual({ ok: true });
  });
  it(`exploring with the table's 5-ft setting: only within 5 ft of a character; without it, from anywhere`, () => {
    expect(canOpen({ actor: 'players', phase: 'exploring', within5Ft: true, distanceFt: 10 })).toEqual(refused(WORDS.tooFar));
    expect(canOpen({ actor: 'players', phase: 'exploring', within5Ft: true, distanceFt: 5 })).toEqual({ ok: true });
    expect(canOpen({ actor: 'players', phase: 'exploring', within5Ft: false, distanceFt: 30 })).toEqual({ ok: true });
    expect(canOpen({ actor: 'dm', phase: 'exploring', within5Ft: true, distanceFt: 30 })).toEqual({ ok: true });
  });
  it(`in a fight: only the current character, within 5 ft; anyone else "Not your turn"; the DM anything`, () => {
    const turn = { kind: 'character', name: 'Vex' } as const;
    expect(canOpen({ actor: 'players', phase: 'running', current: turn })).toEqual({ ok: true }); // release 1a passes no distance
    expect(canOpen({ actor: 'players', phase: 'running', current: turn, distanceFt: 5 })).toEqual({ ok: true });
    expect(canOpen({ actor: 'players', phase: 'running', current: turn, distanceFt: 7.5 })).toEqual(refused(WORDS.tooFar));
    expect(canOpen({ actor: 'players', phase: 'running', current: turn, locked: true })).toEqual(refused('Locked'));
    expect(canOpen({ actor: 'players', phase: 'running', current: { kind: 'creature', name: 'Hunched thing' } })).toEqual(refused('Not your turn'));
    expect(canOpen({ actor: 'players', phase: 'running', current: { kind: 'foe', name: 'Foe 5' } })).toEqual(refused('Not your turn'));
    expect(canOpen({ actor: 'players', phase: 'running' })).toEqual(refused('Not your turn')); // a turn the board cannot name
    expect(canOpen({ actor: 'players', phase: 'running', current: { ...turn, dmRuns: true } })).toEqual(refused(dmRunning('Vex')));
    expect(canOpen({ actor: 'dm', phase: 'running', current: { kind: 'creature', name: 'Ghoul' }, locked: true, distanceFt: 60 })).toEqual({ ok: true });
  });
  it(`Called and Paused: frozen for the players, not for the DM`, () => {
    expect(canOpen({ actor: 'players', phase: 'called' })).toEqual(refused(WORDS.called));
    expect(canOpen({ actor: 'players', phase: 'paused' })).toEqual(refused(WORDS.paused));
    expect(canOpen({ actor: 'dm', phase: 'called', locked: true })).toEqual({ ok: true });
    expect(canOpen({ actor: 'dm', phase: 'paused' })).toEqual({ ok: true });
  });
});

describe('"Move party here"', () => {
  it('is the DM\'s, in every phase; on a turn, moving a combatant this way spends no movement', () => {
    for (const phase of ['exploring', 'called', 'running', 'paused'] as const) expect(canMovePartyHere({ actor: 'players', phase })).toEqual(refused(WORDS.dmOnly));
    expect(canMovePartyHere({ actor: 'dm', phase: 'exploring' })).toEqual({ ok: true });
    expect(canMovePartyHere({ actor: 'dm', phase: 'running', inOrder: true })).toEqual({ ok: true, note: WORDS.placedByDm });
    expect(canMovePartyHere({ actor: 'dm', phase: 'running', inOrder: false })).toEqual({ ok: true });
    expect(canMovePartyHere({ actor: 'dm', phase: 'called', inOrder: true })).toEqual({ ok: true });
  });
});
