// The turn helpers (app/src/core/encounter.ts) on today's fight. Each 0.3.4 behaviour they keep is checked against a copy
// of today's code from app.ts; each one they fix (plan N1, the lost party, G02, the exact-centre tap) is shown failing on
// that copy first.
import { describe, expect, it } from 'vitest';
import {
  advanceTurn, currentCombatant, foldAtEnd, isMarker, moveCellAt, needsPartyMarker, PARTY_COLOR, partyMarker, partyOf, removeFromOrder, tokenKind,
} from '../app/src/core/encounter';
import { tacticalRange } from '../app/src/core/range';
import { moveBlockers, sightBlockers } from '../app/src/core/light';
import { canMove, WORDS } from '../app/src/core/permissions';
import { rect, type Vec2 } from '../app/src/core/geometry';
import { hexSizeFromWidth, hexToWorld, squareCellAt, squareCellCenter, worldToHex } from '../app/src/core/grid';
import type { Wall } from '../app/src/core/schema';
import type { Encounter, Sheet, Token } from '../app/src/state/campaign';

const LOC = 'appB/death-house';
const tok = (x: Partial<Token>): Token => ({ id: 'x', name: 'x', location: LOC, level: 'f1', pos: [2.5, 2.5], size: 'medium', darkvisionFt: 0, color: '#888', ...x });
const sheet = (id: string, kind: Sheet['kind'], name = id): Sheet => ({ id, name, color: '#5b8ac9', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind });
const roster: Sheet[] = [sheet('pc-1', 'pc', 'Vex'), sheet('pc-2', 'pc', 'Brom'), sheet('npc-1', 'npc', 'Foe 5'), sheet('cr:ghoul', 'npc', 'Ghoul'), sheet('cr:wolf', 'npc', 'Wolf')];
const marker = tok({ id: `pc-${LOC}`, name: 'Party', role: 'party', color: PARTY_COLOR, light: { bright: 20, dim: 40 }, pos: [12.5, 7.5] });
const vex = tok({ id: `tok-${LOC}-pc-1`, name: 'Vex', role: 'member', sheetId: 'pc-1', pos: [7.5, 2.5], light: { bright: 20, dim: 40 } });
const brom = tok({ id: `tok-${LOC}-pc-2`, name: 'Brom', role: 'member', sheetId: 'pc-2', pos: [12.5, 2.5], level: 'f2' });
const foe = tok({ id: `tok-${LOC}-npc-1`, name: 'Foe 5', role: 'member', sheetId: 'npc-1', pos: [17.5, 2.5], darkvisionFt: 60 });
const ghoul = tok({ id: 'cr-ghoul-1', name: 'Ghoul', role: 'creature', creatureId: 'ghoul', sheetId: 'cr:ghoul', hidden: true, playerName: 'Hunched thing', hp: { cur: 22, max: 22 }, darkvisionFt: 60 });
const wolf = tok({ id: 'cr-wolf-1', name: 'Wolf', role: 'creature', creatureId: 'wolf', hp: { cur: 11, max: 11 }, pos: [22.5, 7.5], darkvisionFt: 60 });
const enc = (x: Partial<Encounter> = {}): Encounter => ({
  location: LOC, level: 'f1', round: 2, turn: 0, movedFt: 0, partyPos: [12.5, 7.5],
  order: [{ sheetId: 'pc-1', tokenId: vex.id, init: 18 }, { sheetId: 'cr:ghoul', tokenId: ghoul.id, init: 14 }, { sheetId: 'pc-2', tokenId: brom.id, init: 9 }], ...x,
});
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---- copies of today's code (app.ts at 6ff4121), the references the helpers are held to
const todayParty = (tokens: Token[], loc: string) => { const here = tokens.filter((t) => t.location === loc); return here.find((t) => t.role !== 'member') ?? here[0]; };
const todayCurrent = (e: Encounter, tokens: Token[], rosterIn: Sheet[]) => {
  if (!e || !e.order.length) return undefined;
  const c = e.order[e.turn % e.order.length], s = rosterIn.find((x) => x.id === c.sheetId), t = tokens.find((x) => x.id === c.tokenId);
  return s && t ? { c, sheet: s, token: t } : undefined;
};
const todayEnd = (tokensIn: Token[], e: Encounter): Token[] => {
  const loc = e.location, members = tokensIn.filter((t) => t.role === 'member' && t.location === loc), lead = members[0];
  const tokens = tokensIn.filter((t) => !(t.role === 'member' && t.location === loc));
  if (!tokens.some((t) => t.location === loc)) tokens.push({ id: `pc-${loc}`, name: 'Party', location: loc, level: lead?.level ?? e.level, pos: lead?.pos ?? e.partyPos, size: 'medium', darkvisionFt: 0, color: '#c0392b', light: { bright: 20, dim: 40 }, role: 'party' });
  return tokens;
};
const todayNext = (e0: Encounter, dir: number) => {
  const e = clone(e0);
  let t = e.turn + dir;
  if (t >= e.order.length) { t = 0; e.round++; } else if (t < 0) { t = e.order.length - 1; e.round = Math.max(1, e.round - 1); }
  e.turn = t; e.movedFt = 0;
  return e;
};
const todayRemove = (e0: Encounter, id: string) => { const e = clone(e0); e.order = e.order.filter((c) => c.tokenId !== id); if (e.turn >= e.order.length) e.turn = 0; return e; };

describe('tokenKind and isMarker', () => {
  it('reads the role and the roster row', () => {
    expect(tokenKind(marker, roster)).toBe('marker');
    expect(tokenKind(tok({ id: `pc-${LOC}` }), roster)).toBe('marker'); // a marker saved before roles existed
    expect(tokenKind(vex, roster)).toBe('character');
    expect(tokenKind(foe, roster)).toBe('foe');
    expect(tokenKind(tok({ role: 'member', sheetId: 'pc-gone' }), roster)).toBe('foe'); // its row deleted: never the players'
    expect(tokenKind(ghoul, roster)).toBe('creature');
    expect(tokenKind(tok({ role: 'creature', sheetId: 'pc-1' }), roster)).toBe('creature');
    expect([marker, tok({}), vex, ghoul].map(isMarker)).toEqual([true, true, false, false]);
  });
});

describe('partyOf (plan N1: the party is never a creature)', () => {
  it('the marker, even when a creature stands before it; today a creature standing first is the party', () => {
    const tokens = [wolf, marker, vex];
    expect(partyOf(tokens, roster, LOC)).toBe(marker);
    expect(todayParty(tokens, LOC)).toBe(wolf);
  });
  it('mid-fight, with no marker: the first character, never a hidden creature or a foe row standing before it', () => {
    const tokens = [ghoul, foe, brom, vex];
    expect(partyOf(tokens, roster, LOC)).toBe(brom);
    expect(todayParty(tokens, LOC)).toBe(ghoul);
  });
  it('nothing when only creatures and foes stand there, and never another map\'s token', () => {
    expect(partyOf([ghoul, wolf, foe], roster, LOC)).toBeUndefined();
    expect(partyOf([{ ...marker, location: 'ch05/N' }, wolf], roster, LOC)).toBeUndefined();
    expect(partyOf([], roster, LOC)).toBeUndefined();
  });
});

describe('needsPartyMarker', () => {
  it('true when the map holds only creatures (today ensureDefaultToken gives up on any token) or nothing', () => {
    expect(needsPartyMarker([ghoul, wolf], roster, LOC, undefined)).toBe(true);
    expect(needsPartyMarker([], roster, LOC, undefined)).toBe(true);
    expect(needsPartyMarker([{ ...marker, location: 'ch05/N' }], roster, LOC, undefined)).toBe(true);
  });
  it('false with a marker (a legacy one too) or a character\'s own token standing', () => {
    expect(needsPartyMarker([wolf, marker], roster, LOC, undefined)).toBe(false);
    expect(needsPartyMarker([tok({ id: `pc-${LOC}` })], roster, LOC, undefined)).toBe(false);
    expect(needsPartyMarker([ghoul, vex], roster, LOC, undefined)).toBe(false);
  });
  it('a foe row\'s token is not the party: with creatures, or alone, the map still needs its marker, as partyOf agrees', () => {
    for (const tokens of [[foe], [ghoul, foe], [foe, wolf], [tok({ role: 'member', sheetId: 'pc-gone' })]]) {
      expect(needsPartyMarker(tokens, roster, LOC, undefined), tokens.map((t) => t.id).join()).toBe(true);
      expect(partyOf(tokens, roster, LOC)).toBeUndefined();
    }
  });
  it('never while a fight on this map holds the party\'s place: End puts the marker back where the party stood', () => {
    // Start took the marker; the order holds only creatures (the characters were removed, or never ticked).
    const e = enc({ order: [{ sheetId: 'cr:ghoul', tokenId: ghoul.id, init: 14 }], partyPos: [32.5, 12.5], level: 'f2' }), tokens = [ghoul, wolf];
    expect(needsPartyMarker(tokens, roster, LOC, e)).toBe(false);
    expect(needsPartyMarker(tokens, roster, LOC, undefined)).toBe(true);
    expect(foldAtEnd(tokens, e, roster).marker).toEqual(partyMarker(LOC, 'f2', [32.5, 12.5])); // at End, where it stood
    // A marker made at the map's start in the meantime would have kept End from gathering at partyPos.
    const start = partyMarker(LOC, 'f1', [2.5, 2.5]);
    expect(foldAtEnd([...tokens, start], e, roster).marker).toBeUndefined();
    // A fight on another map changes nothing here.
    expect(needsPartyMarker(tokens, roster, LOC, { ...e, location: 'ch05/N' })).toBe(true);
  });
});

describe('currentCombatant', () => {
  const tokens = [vex, ghoul, brom, wolf];
  it('is today\'s current getter, turn by turn, a turn past the end included', () => {
    for (const turn of [0, 1, 2, 3, 7]) expect(currentCombatant(enc({ turn }), tokens, roster), `turn ${turn}`).toEqual(todayCurrent(enc({ turn }), tokens, roster));
    expect(currentCombatant(enc({ turn: 1 }), tokens, roster)?.token).toBe(ghoul);
  });
  it('nothing for no fight, an empty order, a missing row or token; and no throw on a turn out of step', () => {
    expect(currentCombatant(undefined, tokens, roster)).toBeUndefined();
    expect(currentCombatant(enc({ order: [] }), tokens, roster)).toBeUndefined();
    expect(currentCombatant(enc(), tokens, roster.filter((s) => s.id !== 'pc-1'))).toBeUndefined();
    expect(currentCombatant(enc(), [ghoul, brom], roster)).toBeUndefined();
    expect(() => todayCurrent(enc({ turn: -1 }), tokens, roster)).toThrow();
    expect(currentCombatant(enc({ turn: -1 }), tokens, roster)).toBeUndefined();
    expect(currentCombatant(enc({ turn: Number.NaN }), tokens, roster)).toBeUndefined();
  });
});

describe('foldAtEnd (the party is never lost)', () => {
  it('a creature left standing: one marker at the first character\'s square, on its floor, and the creature untouched; today none', () => {
    const tokens = [vex, ghoul, brom, wolf], before = clone(tokens), e = enc();
    const out = foldAtEnd(tokens, e, roster);
    expect(out.tokens.filter(isMarker)).toEqual([partyMarker(LOC, 'f1', [7.5, 2.5])]);
    expect(out.marker).toEqual({ id: `pc-${LOC}`, name: 'Party', location: LOC, level: 'f1', pos: [7.5, 2.5], size: 'medium', darkvisionFt: 0, color: '#c0392b', light: { bright: 20, dim: 40 }, role: 'party' });
    expect(out.tokens.filter((t) => t.role === 'creature')).toEqual(before.filter((t) => t.role === 'creature'));
    expect(out.tokens.find((t) => t.id === ghoul.id)).toBe(ghoul);
    expect(out.tokens.some((t) => t.role === 'member')).toBe(false);
    expect(tokens).toEqual(before); // the input is not changed
    expect(todayEnd(clone(tokens), e).some(isMarker)).toBe(false); // today the party is lost
  });
  it('with nothing else on the map, today\'s End exactly', () => {
    for (const tokens of [[vex, brom], [brom, vex], [vex, brom, { ...wolf, location: 'ch05/N' }]]) expect(foldAtEnd(tokens, enc(), roster).tokens).toEqual(todayEnd(clone(tokens), enc()));
  });
  it('every member gone: the marker where the party stood, on the fight\'s floor', () => {
    const out = foldAtEnd([wolf], enc({ partyPos: [32.5, 12.5], level: 'f3' }), roster);
    expect(out.marker).toEqual(partyMarker(LOC, 'f3', [32.5, 12.5]));
    expect(out.tokens).toEqual([wolf, out.marker]);
  });
  it('a foe row\'s token standing first: the marker still gathers at the first character', () => {
    expect(foldAtEnd([foe, brom, vex], enc(), roster).marker).toEqual(partyMarker(LOC, 'f2', [12.5, 2.5]));
    expect(foldAtEnd([foe, ghoul], enc(), roster).marker).toEqual(partyMarker(LOC, 'f1', [17.5, 2.5]));
  });
  it('a marker already standing there: no second one; other maps\' members stay', () => {
    const away = { ...vex, location: 'ch05/N' };
    const out = foldAtEnd([marker, vex, away, ghoul], enc(), roster);
    expect(out.marker).toBeUndefined();
    expect(out.tokens).toEqual([marker, away, ghoul]);
    expect(foldAtEnd([tok({ id: `pc-${LOC}` }), vex], enc(), roster).tokens).toHaveLength(1);
  });
  it('the marker\'s square is its own copy, not the member\'s or the fight\'s', () => {
    const e = enc(), a = foldAtEnd([vex], e, roster).marker!, b = foldAtEnd([], e, roster).marker!;
    expect(a.pos).not.toBe(vex.pos);
    expect(b.pos).not.toBe(e.partyPos);
  });
});

describe('removeFromOrder (G02)', () => {
  // Fighter, Rogue, Cleric with the Rogue's turn and 10 ft spent (docs/REVIEW-G.md G02's reproduction).
  const order = [{ sheetId: 'pc-1', tokenId: 'fighter', init: 18 }, { sheetId: 'pc-2', tokenId: 'rogue', init: 14 }, { sheetId: 'pc-3', tokenId: 'cleric', init: 9 }];
  const e = enc({ order, turn: 1, movedFt: 10, round: 3 });
  const now = (x: Encounter) => x.order[x.turn].tokenId;
  it('one earlier in the order: the same one keeps the turn and its spent movement (today it passes to the next)', () => {
    const r = removeFromOrder(e, 'fighter');
    expect([now(r.encounter), r.encounter.movedFt, r.encounter.round, r.removed, r.ended]).toEqual(['rogue', 10, 3, true, false]);
    expect(now(todayRemove(e, 'fighter'))).toBe('cleric');
  });
  it('one later in the order: nothing about the turn changes', () => {
    const r = removeFromOrder(e, 'cleric');
    expect([now(r.encounter), r.encounter.turn, r.encounter.movedFt, r.encounter.round]).toEqual(['rogue', 1, 10, 3]);
  });
  it('the one whose turn it is: the next takes a fresh turn (today it inherits the spent movement)', () => {
    const r = removeFromOrder(e, 'rogue');
    expect([now(r.encounter), r.encounter.movedFt, r.encounter.round]).toEqual(['cleric', 0, 3]);
    expect(todayRemove(e, 'rogue').movedFt).toBe(10);
  });
  it('the last one in the order, on its turn: the first takes a fresh turn in a new round (today the round stays)', () => {
    const r = removeFromOrder({ ...e, turn: 2 }, 'cleric');
    expect([now(r.encounter), r.encounter.movedFt, r.encounter.round]).toEqual(['fighter', 0, 4]);
    expect(todayRemove({ ...e, turn: 2 }, 'cleric').round).toBe(3);
  });
  it('the order empties: the flag that ends the fight as End does; a token not in the order changes nothing', () => {
    const one = removeFromOrder(enc({ order: [order[0]] }), 'fighter');
    expect([one.ended, one.removed, one.encounter.order]).toEqual([true, true, []]);
    const none = removeFromOrder(e, 'wolf');
    expect([none.removed, none.ended]).toEqual([false, false]);
    expect(none.encounter).toEqual(e);
  });
  it('keeps the turn by combatant through currentCombatant, and never changes its input', () => {
    const tokens = [vex, ghoul, brom], before = clone(enc({ turn: 2, movedFt: 15 }));
    const r = removeFromOrder(enc({ turn: 2, movedFt: 15 }), ghoul.id);
    expect(currentCombatant(r.encounter, tokens, roster)?.token).toBe(brom);
    expect(r.encounter.movedFt).toBe(15);
    const input = enc({ turn: 2, movedFt: 15 }); removeFromOrder(input, ghoul.id);
    expect(input).toEqual(before);
  });
});

describe('advanceTurn', () => {
  it('is today\'s Next and Previous bookkeeping for every turn, both ways, at every order length', () => {
    for (let n = 0; n <= 4; n++) for (let turn = 0; turn < Math.max(1, n); turn++) for (const round of [1, 2, 5]) for (const dir of [1, -1] as const) {
      const e = enc({ order: enc().order.concat(enc().order).slice(0, n), turn, round, movedFt: 15 });
      expect(advanceTurn(e, dir), `n ${n} turn ${turn} round ${round} dir ${dir}`).toEqual(todayNext(e, dir));
    }
  });
  it('a new round past the end, the round before (never below 1) back past the start, no movement spent, input kept', () => {
    const e = enc({ turn: 2, round: 1, movedFt: 20 }), before = clone(e);
    expect([advanceTurn(e).turn, advanceTurn(e).round, advanceTurn(e).movedFt]).toEqual([0, 2, 0]);
    expect([advanceTurn({ ...e, turn: 0 }, -1).turn, advanceTurn({ ...e, turn: 0 }, -1).round]).toEqual([2, 1]);
    expect(advanceTurn({ ...e, turn: 0, round: 4 }, -1).round).toBe(3);
    expect(e).toEqual(before);
  });
});

describe('moveCellAt (a tap anywhere inside a green square counts)', () => {
  // A 40×20 room split by a wall at x = 20 with a closed door: 15 ft of movement from the corner square.
  const floor = [rect(0, 0, 20, 20), rect(20, 0, 20, 20)];
  const walls: Wall[] = [{ id: 'w1', a: [20, 0], b: [20, 5], flags: ['normal'] }, { id: 'd', a: [20, 5], b: [20, 10], flags: ['door'], open: false }, { id: 'w2', a: [20, 10], b: [20, 20], flags: ['normal'] }];
  const input = (origin: Vec2 = [0, 0], w: Wall[] = walls) => ({ start: [2.5 + origin[0], 2.5 + origin[1]] as Vec2, speedFt: 15, reachFt: 5, floor, moveBlockers: moveBlockers(w), sightBlockers: sightBlockers(w), occupied: [], origin });
  const ground = input();
  const range = (origin: Vec2 = [0, 0]) => tacticalRange(input(origin));
  const at = (moves: ReturnType<typeof range>['move'], x: number, z: number) => moveCellAt(moves, [x, z], ground)?.cell;
  const todayCell = (moves: ReturnType<typeof range>['move'], to: Vec2) => moves.find((m) => m.cell[0] === to[0] && m.cell[1] === to[1]);
  it('every green centre is its own square', () => {
    const r = range();
    for (const m of r.move) expect(moveCellAt(r.move, m.cell, ground)).toBe(m);
  });
  it('Snap off: a point inside a square, off its centre, takes that square and its cost (today: refused)', () => {
    const r = range();
    expect(at(r.move, 9.2, 0.3)).toEqual([7.5, 2.5]);
    expect(moveCellAt(r.move, [9.2, 0.3], ground)?.costFt).toBe(5);
    expect(at(r.move, 16.4, 13.9)).toEqual([17.5, 12.5]);
    expect(todayCell(r.move, [9.2, 0.3])).toBeUndefined();
  });
  it('on the edge two green squares share: the square the grid gives it (squareCellAt), as Snap would', () => {
    const r = range();
    for (const p of [[5, 2.5], [10, 7.5], [5, 5], [12.5, 10]] as Vec2[]) expect(at(r.move, ...p)).toEqual(squareCellCenter(squareCellAt(p)));
  });
  it('on a wall line or a closed door: none (the token would stand in the wall, and its next squares start behind it)', () => {
    const r = range();
    expect(at(r.move, 20, 2.5)).toBeUndefined(); // on the wall, the far edge of the 15-ft reach
    expect(at(r.move, 20, 7.5)).toBeUndefined(); // on the closed door
    expect(at(r.move, 20, 5)).toBeUndefined(); // the door's jamb, where the wall and the door meet
    expect(at(r.move, 19.99, 7.5)).toEqual([17.5, 7.5]); // just before it
    // The door open: its line is floor like any other, and the green square beside it holds it.
    const open = walls.map((w) => (w.id === 'd' ? { ...w, open: true } : w)), g = input([0, 0], open), ro = tacticalRange(g);
    expect(moveCellAt(ro.move, [20, 7.5], g)?.cell).toEqual([17.5, 7.5]);
  });
  it('off the floor, just past the last green square, or behind the closed door: none', () => {
    const r = range();
    expect(at(r.move, 7.5, 20)).toBeUndefined(); // on the room's outer edge: off the floor
    expect(at(r.move, 7.5, 19.99)).toEqual([7.5, 17.5]);
    expect(at(r.move, 20.01, 2.5)).toBeUndefined();
    expect(at(r.move, 2.5, 20.01)).toBeUndefined();
    expect(at(r.move, 22.5, 7.5)).toBeUndefined(); // behind the closed door
  });
  it('a wall off the 5-ft lines cuts a green square: the near side counts, the far side and the wall itself do not; and a turn there is refused', () => {
    // Floor 13 ft deep beside a 5-ft corridor beyond a wall at x = 13 (off the grid's lines, as 25 of 45 scenes have).
    const f = [rect(0, 0, 13, 10), rect(13, 0, 17, 5)], w: Wall[] = [{ id: 'cut', a: [13, 0], b: [13, 10], flags: ['normal'] }];
    const g = { start: [2.5, 2.5] as Vec2, speedFt: 15, reachFt: 5, floor: f, moveBlockers: moveBlockers(w), sightBlockers: sightBlockers(w), occupied: [] };
    const r = tacticalRange(g), cell = (x: number, z: number) => moveCellAt(r.move, [x, z], g);
    expect(r.move.map((m) => m.cell)).toContainEqual([12.5, 2.5]);
    expect(cell(12.8, 2.5)?.cell).toEqual([12.5, 2.5]);
    expect(cell(14.5, 2.5)).toBeUndefined(); // across the wall, inside the same 5-ft square
    expect(cell(13, 2.5)).toBeUndefined(); // on the wall
    expect(cell(14.5, 7.5)).toBeUndefined(); // off the floor, across the wall
    const turn = { actor: 'players', phase: 'running', kind: 'character', name: 'Vex', inOrder: true, current: true } as const;
    expect(canMove({ ...turn, moveCell: cell(14.5, 2.5) })).toEqual({ ok: false, reason: WORDS.outOfRange });
    expect(canMove({ ...turn, moveCell: cell(12.8, 2.5) })).toEqual({ ok: true, spendFt: 10 });
    // Off the floor with no wall at all: none either.
    const open = { ...g, floor: [rect(0, 0, 13, 10)], moveBlockers: [] }, ro = tacticalRange(open);
    expect(moveCellAt(ro.move, [14, 2.5], open)).toBeUndefined();
    expect(moveCellAt(ro.move, [12.9, 2.5], open)?.cell).toEqual([12.5, 2.5]);
  });
  it('on a grid with its own origin, a wall off its lines included', () => {
    const origin: Vec2 = [1.5, -0.5], r = range(origin);
    expect(at(r.move, 1.5 + 9.2, -0.5 + 1.3)).toEqual([1.5 + 7.5, -0.5 + 2.5]);
    expect(at(r.move, 1.5 + 9.2, -0.5 + 0.3)).toBeUndefined(); // z = -0.2: off the room's floor, which starts at 0
    expect(at(r.move, 1.5 + 5, -0.5 + 2.5)).toEqual(squareCellCenter(squareCellAt([1.5 + 5, -0.5 + 2.5], origin), origin));
    // A wall at x = 15.5 cuts the square centred on x = 14 (it spans 11.5 to 16.5).
    const f = [rect(0, -1, 40, 12)], w: Wall[] = [{ id: 'cut', a: [15.5, -1], b: [15.5, 11], flags: ['normal'] }];
    const g = { start: [4, 2] as Vec2, speedFt: 15, reachFt: 5, floor: f, moveBlockers: moveBlockers(w), sightBlockers: sightBlockers(w), occupied: [], origin }, rg = tacticalRange(g);
    expect(moveCellAt(rg.move, [15, 2], g)?.cell).toEqual([14, 2]);
    expect(moveCellAt(rg.move, [16, 2], g)).toBeUndefined();
    expect(moveCellAt(rg.move, [15.5, 2], g)).toBeUndefined();
  });
  it('under the hex grid\'s snapped centres, pointy and flat, with and without an origin: the square underneath counts, never across a wall', () => {
    const flat = range(), s = hexSizeFromWidth(5);
    for (const tap of [[8, 3], [13, 8], [3, 12]] as Vec2[]) {
      const hex = hexToWorld(worldToHex(tap, s, 'pointy'), s, 'pointy'), m = moveCellAt(flat.move, hex, ground);
      expect(m, `hex centre ${hex}`).toBeDefined();
      expect(Math.max(Math.abs(hex[0] - m!.cell[0]), Math.abs(hex[1] - m!.cell[1]))).toBeLessThanOrEqual(2.5 + 1e-6);
      expect(todayCell(flat.move, hex)).toBeUndefined(); // no square's centre: today's exact match refuses it
    }
    // Every hex centre over a room cut by a wall 0.25 ft past a row of green squares' centres (across the hexes' columns
    // for flat ones, across their rows for pointy ones, where their centres fall between the wall and the squares' far
    // edge): on the start's side of the wall it takes the green square under it; across the wall, inside the same
    // green squares, none.
    for (const [orient, origin] of [['flat', [0, 0]], ['flat', [1.5, -0.5]], ['pointy', [0, 0]], ['pointy', [1.5, -0.5]]] as const) {
      const o: Vec2 = [origin[0], origin[1]], cut: Wall = orient === 'flat'
        ? { id: 'cut', a: [o[0] + 12.75, o[1]], b: [o[0] + 12.75, o[1] + 20], flags: ['normal'] }
        : { id: 'cut', a: [o[0], o[1] + 12.75], b: [o[0] + 30, o[1] + 12.75], flags: ['normal'] };
      const g = { start: [o[0] + 2.5, o[1] + 2.5] as Vec2, speedFt: 20, reachFt: 5, floor: [rect(o[0], o[1], 30, 20)], moveBlockers: moveBlockers([cut]), sightBlockers: sightBlockers([cut]), occupied: [], origin: o };
      const r = tacticalRange(g), side = (p: Vec2) => Math.sign((cut.b[0] - cut.a[0]) * (p[1] - cut.a[1]) - (cut.b[1] - cut.a[1]) * (p[0] - cut.a[0]));
      let near = 0, far = 0;
      for (let q = -16; q <= 16; q++) for (let rr = -16; rr <= 16; rr++) {
        const c = hexToWorld({ q, r: rr }, s, orient, o);
        if (c[0] <= o[0] || c[0] >= o[0] + 30 || c[1] <= o[1] || c[1] >= o[1] + 20 || side(c) === 0) continue;
        const under = squareCellCenter(squareCellAt(c, o), o), green = todayCell(r.move, under), m = moveCellAt(r.move, c, g);
        if (!green) continue;
        if (side(c) === side(g.start)) { expect(m?.cell, `${orient} ${o} ${c}`).toEqual(under); near++; }
        else { expect(m, `${orient} ${o} ${c} across the wall`).toBeUndefined(); far++; }
      }
      expect(near, `${orient} ${o}`).toBeGreaterThan(0);
      expect(far, `${orient} ${o}: hex centres across the wall inside a green square`).toBeGreaterThan(0);
    }
  });
  it('no green squares: none', () => {
    expect(moveCellAt([], [2.5, 2.5], ground)).toBeUndefined();
  });
});
