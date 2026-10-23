// The turn helpers on today's fight (the Encounter, Token and Sheet of state/campaign.ts): what a token is on the board,
// who the party is, when a map needs its marker, whose turn it is, End's fold, taking a combatant out of the order, the
// turn's bookkeeping and the green square a tap falls in. Pure: nothing here mutates its input; app.ts applies what these
// return (docs/PLAYABILITY.md 4.2, release 1a).
import type { Combatant, Encounter, Sheet, Token } from '../state/campaign';
import { pointInPolygon, segmentsIntersect, type Polygon, type Segment, type Vec2 } from './geometry';
import type { RangeResult } from './range';
import { CELL_FT } from './units';

/** The party marker's colour (app.ts PARTY_RED). */
export const PARTY_COLOR = '#c0392b';
/** The party's torch (PHB 20/40), so unlit maps are playable out of the box. */
export const PARTY_TORCH: Readonly<{ bright: number; dim: number }> = Object.freeze({ bright: 20, dim: 40 });

/** A fight's phase. Called and Paused arrive with release 3, so a 0.3.x fight, which has none, is running. */
export type FightPhase = 'called' | 'running' | 'paused';

/** What a token is on the board: the party marker; a character's own token; a foe row's token (the roster's NPC rows,
 *  "Add foe"); a creature the DM placed. */
export type TokenKind = 'marker' | 'character' | 'foe' | 'creature';

/** The party marker: role 'party', or no role at all (a party marker saved before roles existed: `pc-<map>`). */
export const isMarker = (t: Pick<Token, 'role'>): boolean => t.role === 'party' || t.role === undefined;

/** A token's kind from its role and its roster row. A member token is a character when its row is a PC; a foe row's
 *  token, or a member whose row is gone, is a foe (the players never move it). */
export function tokenKind(t: Pick<Token, 'role' | 'sheetId'>, roster: readonly Sheet[]): TokenKind {
  if (t.role === 'creature') return 'creature';
  if (t.role === 'member') return roster.find((s) => s.id === t.sheetId)?.kind === 'pc' ? 'character' : 'foe';
  return 'marker';
}

/** Today's party marker on a map, with today's fields (app.ts ensureDefaultToken and endEncounter). */
export function partyMarker(location: string, level: string, pos: Vec2): Token {
  return { id: `pc-${location}`, name: 'Party', location, level, pos: [pos[0], pos[1]], size: 'medium', darkvisionFt: 0, color: PARTY_COLOR, light: { ...PARTY_TORCH }, role: 'party' };
}

/** The party on a map: its marker, else the first character's own token. Never a creature (hidden or not) and never a
 *  foe row's token (today's getter returns a creature when one stands first, app.ts `party`; plan N1). */
export function partyOf(tokens: readonly Token[], roster: readonly Sheet[], location: string): Token | undefined {
  let character: Token | undefined;
  for (const t of tokens) {
    if (t.location !== location) continue;
    const k = tokenKind(t, roster);
    if (k === 'marker') return t;
    if (k === 'character' && !character) character = t;
  }
  return character;
}

/**
 * True when a map has lost its party and its start should get a marker: neither a marker nor a character's own token
 * stands there (only creatures or foe rows' tokens, or nothing), the same tokens partyOf reads (plan 5.2: the new
 * ensureDefaultToken counts only party and character tokens; today's gives up on any token at all, a creature included,
 * app.ts:1188). Never while a fight on this map holds the party's place (`fight`, the campaign's one encounter): End
 * puts the marker back where the party stood (foldAtEnd, at `partyPos`), so a marker made at the map's start now would
 * stand in its way. A fight whose order has emptied is ended by the caller as End does (removeFromOrder's `ended`).
 */
export function needsPartyMarker(tokens: readonly Token[], roster: readonly Sheet[], location: string, fight: Pick<Encounter, 'location'> | undefined): boolean {
  if (fight?.location === location) return false;
  return !tokens.some((t) => { if (t.location !== location) return false; const k = tokenKind(t, roster); return k === 'marker' || k === 'character'; });
}

/** The combatant whose turn it is, its row and its token: what today's `current` getter returns (app.ts:1211-1215),
 *  nothing when the fight's order is empty or either the row or the token is missing, and never a throw (a turn out of
 *  step with the order reads as no one). */
export function currentCombatant(e: Encounter | undefined, tokens: readonly Token[], roster: readonly Sheet[]): { c: Combatant; sheet: Sheet; token: Token } | undefined {
  if (!e || !e.order.length) return undefined;
  const c = e.order[e.turn % e.order.length];
  if (!c) return undefined;
  const sheet = roster.find((x) => x.id === c.sheetId), token = tokens.find((x) => x.id === c.tokenId);
  return sheet && token ? { c, sheet, token } : undefined;
}

/**
 * End for a party that was together (today's End, app.ts endEncounter): the member tokens on the fight's map are taken
 * off and the party marker stands at the first character's square (else the first member's, else where the party stood,
 * `partyPos`), on that token's floor, with today's marker fields. The fix: the marker is made whenever no party marker
 * stands there, even with creatures left on the map (today one creature left loses the party, app.ts:1252). Creatures and
 * every other map's tokens are kept as they are. Returns new arrays; the marker made, if one was.
 */
export function foldAtEnd(tokens: readonly Token[], e: Encounter, roster: readonly Sheet[]): { tokens: Token[]; marker?: Token } {
  const loc = e.location, members = tokens.filter((t) => t.role === 'member' && t.location === loc);
  const lead = members.find((t) => tokenKind(t, roster) === 'character') ?? members[0];
  const kept = tokens.filter((t) => !(t.role === 'member' && t.location === loc));
  if (kept.some((t) => t.location === loc && isMarker(t))) return { tokens: kept };
  const marker = partyMarker(loc, lead?.level ?? e.level, lead?.pos ?? e.partyPos);
  return { tokens: [...kept, marker], marker };
}

/**
 * Take one combatant out of the order. The turn stays with the combatant who had it, with the movement it has spent
 * (G02). When the one removed had the turn, the next in the order takes a fresh turn (no movement spent), and if that
 * wraps past the end of the order a new round starts. `ended` says the order is now empty: the caller ends the fight
 * exactly as End does (foldAtEnd). Tokens are never touched. `removed` is false for a token not in the order.
 */
export function removeFromOrder(e: Encounter, tokenId: string): { encounter: Encounter; removed: boolean; ended: boolean } {
  const n = e.order.length;
  if (!e.order.some((c) => c.tokenId === tokenId)) return { encounter: { ...e, order: [...e.order] }, removed: false, ended: !n };
  const order = e.order.filter((c) => c.tokenId !== tokenId);
  if (!order.length) return { encounter: { ...e, order, turn: 0, movedFt: 0 }, removed: true, ended: true };
  const now = ((e.turn % n) + n) % n, had = e.order[now];
  if (had.tokenId !== tokenId) return { encounter: { ...e, order, turn: order.indexOf(had) }, removed: true, ended: false };
  // The one removed had the turn: the next one left in the order takes it, fresh.
  let turn = now - e.order.slice(0, now).filter((c) => c.tokenId === tokenId).length, round = e.round;
  if (turn >= order.length) { turn = 0; round++; }
  return { encounter: { ...e, order, turn, round, movedFt: 0 }, removed: true, ended: false };
}

/** The turn's bookkeeping of today's Next and Previous (app.ts nextTurn): one step along the order, a new round past its
 *  end, the round before (never below 1) back past its start, and no movement spent. A new encounter. */
export function advanceTurn(e: Encounter, dir: 1 | -1 = 1): Encounter {
  let turn = e.turn + dir, round = e.round;
  if (turn >= e.order.length) { turn = 0; round++; } else if (turn < 0) { turn = e.order.length - 1; round = Math.max(1, round - 1); }
  return { ...e, order: [...e.order], turn, round, movedFt: 0 };
}

/** The ground a range was worked out on (core/range.ts RangeInput's `floor` and `moveBlockers`: a RangeInput itself
 *  fits), so a tap inside a green square is held to the same walls and floor as the square. */
export interface MoveGround {
  floor: readonly Polygon[];
  moveBlockers: readonly Segment[];
}

/** How close to a wall a point counts as on it (ft). */
const ON_WALL_FT = 1e-6;

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 <= 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/**
 * The move cell of a range result (core/range.ts tacticalRange) whose square holds a point, so a tap anywhere inside a
 * green square counts, with Snap on or off and under a hex grid's snapped centre (today the point must be a cell centre
 * exactly, app.ts:2041). Range cells are 5-ft squares given by their centres; a square holds its edges. The token lands
 * on the point itself, so the point must be somewhere the square's own move could reach: on the floor, on no wall or
 * closed door (a token standing on a wall line would start its next turn's squares on the far side, where `squareCellAt`
 * floors it), and a straight step from the square's centre that crosses no wall or closed door and stays on the floor,
 * as `ground` (the range's own floor and blockers) has them. A point on an edge two green squares share goes to the
 * square that owns it on the grid (`squareCellAt` floors: the square to its right or below), else to the cheaper of the
 * others it can be reached from. None: the point is off every green square, or across a wall from the one it is in.
 */
export function moveCellAt(moves: RangeResult['move'], point: Vec2, ground: MoveGround, cellFt = CELL_FT): RangeResult['move'][number] | undefined {
  const onFloor = (p: Vec2) => ground.floor.some((poly) => pointInPolygon(p, poly));
  if (!onFloor(point) || ground.moveBlockers.some((w) => distToSegment(point, w.a, w.b) <= ON_WALL_FT)) return undefined;
  const half = cellFt / 2, eps = 1e-6;
  const owners: RangeResult['move'] = [], edges: RangeResult['move'] = [];
  for (const m of moves) {
    const dx = point[0] - m.cell[0], dz = point[1] - m.cell[1];
    if (Math.abs(dx) > half + eps || Math.abs(dz) > half + eps) continue;
    (dx < half - eps && dz < half - eps ? owners : edges).push(m);
  }
  // From the square's centre to the point: no wall or closed door crossed (a wall's end point counts), and the floor
  // under the step (its middle, as the walk lattice's straight steps are checked, core/walkField.ts attach).
  const reaches = (m: RangeResult['move'][number]) => onFloor([(m.cell[0] + point[0]) / 2, (m.cell[1] + point[1]) / 2])
    && !ground.moveBlockers.some((w) => segmentsIntersect(m.cell, point, w.a, w.b));
  const byCost = (a: RangeResult['move'][number], b: RangeResult['move'][number]) => a.costFt - b.costFt;
  return owners.sort(byCost).find(reaches) ?? edges.sort(byCost).find(reaches);
}
