// The party together and apart (app/src/core/party.ts): the free-square search held to a copy of today's Start loop,
// Split up and Gather round trips, and no creature ever moving.
import { describe, expect, it } from 'vitest';
import { freeSquares, FREE_RINGS, gatherParty, splitParty, type CharacterRow } from '../app/src/core/party';
import { partyMarker } from '../app/src/core/encounter';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { pointInPolygon, rect, type Polygon, type Vec2 } from '../app/src/core/geometry';
import type { Wall } from '../app/src/core/schema';
import type { Token } from '../app/src/state/campaign';

// Two 20×20 rooms side by side, split by a wall at x = 20 with a door at z 5–10, and a 10-ft corridor off the south
// of the west room.
const floor: Polygon[] = [rect(0, 0, 20, 20), rect(20, 0, 20, 20), rect(5, 20, 10, 15)];
const walls = (open: boolean): Wall[] => [
  { id: 'w1', a: [20, 0], b: [20, 5], flags: ['normal'] }, { id: 'd', a: [20, 5], b: [20, 10], flags: ['door'], open }, { id: 'w2', a: [20, 10], b: [20, 20], flags: ['normal'] },
  { id: 'w3', a: [0, 20], b: [5, 20], flags: ['normal'] }, { id: 'w4', a: [15, 20], b: [20, 20], flags: ['normal'] },
];
const onFloor = (p: Vec2) => floor.some((poly) => pointInPolygon(p, poly));
const key = (p: Vec2) => `${p[0]},${p[1]}`;

// ---- a copy of today's search (app.ts startEncounter at 6ff4121), the reference freeSquares is held to
function todayFree(at: Vec2, entries: number, walls0: Wall[]): Vec2[] {
  const free: Vec2[] = [];
  for (let ring = 0; ring < 6 && free.length < entries + 2; ring++) for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
    const p: Vec2 = [at[0] + di * 5, at[1] + dj * 5];
    if (floor.some((poly) => pointInPolygon(p, poly)) && canWalk(at, p, moveBlockers(walls0), floor)) free.push(p);
  }
  return free;
}
const step = (at: Vec2, walls0: Wall[], taken = new Set<string>()) => (p: Vec2) => onFloor(p) && canWalk(at, p, moveBlockers(walls0), floor) && !taken.has(key(p));

describe('freeSquares', () => {
  it('returns today\'s squares in today\'s order, from the middle of a room, beside the wall, the doorway, the corridor and off the floor', () => {
    const starts: Vec2[] = [[7.5, 7.5], [17.5, 7.5], [22.5, 7.5], [10, 25], [12.5, 32.5], [2.5, 2.5], [-7.5, 2.5], [37.5, 17.5]];
    for (const at of starts) for (const entries of [0, 1, 4, 9, 30]) for (const open of [false, true]) {
      expect(freeSquares(at, entries + 2, step(at, walls(open))), `from ${at}, ${entries} entries, door ${open ? 'open' : 'shut'}`).toEqual(todayFree(at, entries, walls(open)));
    }
    expect(FREE_RINGS).toBe(6);
  });
  it('every square is on the floor, walkable from the start and unoccupied; nothing behind the shut door or on a taken square', () => {
    const at: Vec2 = [12.5, 7.5], taken = new Set([key([7.5, 7.5]), key([12.5, 12.5])]);
    const free = freeSquares(at, 40, step(at, walls(false), taken));
    expect(free.length).toBeGreaterThan(10);
    for (const p of free) {
      expect(onFloor(p), `${p} on the floor`).toBe(true);
      expect(canWalk(at, p, moveBlockers(walls(false)), floor), `${p} walkable from the start`).toBe(true);
      expect(taken.has(key(p)), `${p} free`).toBe(false);
      expect(p[0] < 20 || p[1] >= 20, `${p} not behind the door`).toBe(true);
    }
    expect(new Set(free.map(key)).size).toBe(free.length);
    expect(free[0]).toEqual(at); // the start itself first, then outward ring by ring
    const ring = (p: Vec2) => Math.max(Math.abs(p[0] - at[0]), Math.abs(p[1] - at[1])) / 5;
    expect(free.map(ring)).toEqual(free.map(ring).slice().sort((a, b) => a - b));
  });
  it('stops after the ring in which it found enough, and never looks past six rings', () => {
    const all = () => true;
    expect(freeSquares([0, 0], 1, all)).toEqual([[0, 0]]);
    expect(freeSquares([0, 0], 2, all)).toHaveLength(9); // the whole first ring
    expect(freeSquares([0, 0], 10_000, all)).toHaveLength(11 * 11);
    expect(freeSquares([0, 0], 5, () => false)).toEqual([]);
  });
});

const LOC = 'appB/death-house';
const row = (id: string, name: string, x: Partial<CharacterRow> = {}): CharacterRow => ({ id, name, color: '#5b8ac9', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind: 'pc', ...x });
const rows: CharacterRow[] = [row('pc-1', 'Character 1'), row('pc-2', 'Character 2', { darkvisionFt: 60, color: '#7b5ea7' }), row('pc-3', 'Character 3', { size: 'small' }), row('pc-4', 'Character 4')];
const ghoul: Token = { id: 'cr-ghoul-1', name: 'Ghoul', location: LOC, level: 'f1', pos: [12.5, 7.5], size: 'medium', darkvisionFt: 60, color: '#8a2b2b', role: 'creature', creatureId: 'ghoul', hidden: true, hp: { cur: 22, max: 22 } };
const away: Token = { ...partyMarker('ch05/N', 'street', [100, 40]) };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('splitParty', () => {
  const marker = partyMarker(LOC, 'f1', [7.5, 7.5]);
  const free = freeSquares(marker.pos, rows.length, step(marker.pos, walls(false), new Set([key(ghoul.pos)])));
  it('one figure per character, in roster order, with today\'s ids and its row\'s size, darkvision and colour', () => {
    const figs = splitParty(marker, rows, free);
    expect(figs.map((t) => t.id)).toEqual(rows.map((s) => `tok-${LOC}-${s.id}`));
    expect(figs.map((t) => [t.role, t.sheetId, t.name, t.size, t.darkvisionFt, t.color, t.level, t.location])).toEqual(rows.map((s) => ['member', s.id, s.name, s.size, s.darkvisionFt, s.color, 'f1', LOC]));
  });
  it('the first on the marker\'s square, the rest on distinct free squares the first can walk to, none on the creature', () => {
    const figs = splitParty(marker, rows, free);
    expect(figs[0].pos).toEqual(marker.pos);
    expect(new Set(figs.map((t) => key(t.pos))).size).toBe(figs.length);
    for (const t of figs) {
      expect(onFloor(t.pos)).toBe(true);
      expect(canWalk(figs[0].pos, t.pos, moveBlockers(walls(false)), floor)).toBe(true);
      expect(key(t.pos)).not.toBe(key(ghoul.pos));
    }
    expect(figs[0].pos).not.toBe(marker.pos); // its own copy
  });
  it('light when apart: the party\'s torch on the first character, unless a row at the table sets its own', () => {
    expect(splitParty(marker, rows, free).map((t) => t.light)).toEqual([{ bright: 20, dim: 40 }, undefined, undefined, undefined]);
    const lit = [rows[0], { ...rows[1], light: { bright: 15, dim: 45 } }, rows[2], rows[3]];
    expect(splitParty(marker, lit, free).map((t) => t.light)).toEqual([undefined, { bright: 15, dim: 45 }, undefined, undefined]);
  });
  it('only the characters at the table: an absent row and a foe row make no figure; none at the table, none at all', () => {
    const figs = splitParty(marker, [rows[0], { ...rows[1], present: false }, row('npc-1', 'Foe 5', { kind: 'npc' }), rows[2]], free);
    expect(figs.map((t) => t.sheetId)).toEqual(['pc-1', 'pc-3']);
    expect(splitParty(marker, [{ ...rows[0], present: false }], free)).toEqual([]);
    expect(splitParty(marker, [], free)).toEqual([]);
  });
  it('more characters than free squares: the rest stand on the marker\'s square, as today\'s Start puts them', () => {
    const figs = splitParty(marker, rows, [marker.pos, [2.5, 7.5]]);
    expect(figs.map((t) => t.pos)).toEqual([marker.pos, [2.5, 7.5], marker.pos, marker.pos]);
  });
});

describe('split then gather', () => {
  it('gives back an equivalent marker, and no creature or other map\'s token moves', () => {
    const marker = partyMarker(LOC, 'f1', [7.5, 7.5]), tokens = [away, ghoul, marker], before = clone(tokens);
    const free = freeSquares(marker.pos, rows.length, step(marker.pos, walls(false), new Set([key(ghoul.pos)])));
    const apart = [...tokens.filter((t) => t !== marker), ...splitParty(marker, rows, free)];
    const first = apart.find((t) => t.sheetId === 'pc-1')!;
    const back = gatherParty(apart, LOC, first);
    expect(back.marker).toEqual(marker);
    expect(back.tokens).toEqual([away, ghoul, marker]);
    expect(back.tokens[0]).toBe(away);
    expect(back.tokens[1]).toBe(ghoul);
    expect(tokens).toEqual(before);
  });
  it('gathers at the picked-up character\'s square and floor, and a marker already there is replaced: one per map', () => {
    const figs = splitParty(partyMarker(LOC, 'f1', [7.5, 7.5]), rows, [[7.5, 7.5], [2.5, 7.5], [7.5, 12.5], [2.5, 12.5]]);
    const moved = figs.map((t) => (t.sheetId === 'pc-3' ? { ...t, level: 'f2', pos: [32.5, 2.5] as Vec2 } : t));
    const out = gatherParty([ghoul, partyMarker(LOC, 'f1', [0, 0]), ...moved], LOC, moved[2]);
    expect(out.marker).toEqual(partyMarker(LOC, 'f2', [32.5, 2.5]));
    expect(out.tokens).toEqual([ghoul, out.marker]);
    expect(out.tokens.filter((t) => t.role === 'party')).toHaveLength(1);
  });
});
