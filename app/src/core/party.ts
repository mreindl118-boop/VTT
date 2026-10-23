// The party together and apart (release 1b's model, docs/PLAYABILITY.md 2.2): the free squares round a square, Split up
// (one figure per character at the table) and Gather (the figures folded back into one marker). Pure: nothing here
// mutates its input; app.ts applies what these return.
import type { Sheet, Token } from '../state/campaign';
import type { Vec2 } from './geometry';
import { isMarker, partyMarker } from './encounter';
import { CELL_FT } from './units';

/** How many rings of squares round the start the search looks at (today's Start, app.ts startEncounter). */
export const FREE_RINGS = 6;

/**
 * The free squares round `start`, ring by ring outward (the start itself first), each ring row by row (z, then x, from
 * the smallest): today's search in Start (app.ts startEncounter), moved here unchanged. `step` is the caller's test for
 * a square (today: on the floor, and walkable from the start; release 1b adds unoccupied). The search stops after the
 * ring in which it has found `count` squares (today's Start asks for its combatants plus two), so it may return more.
 */
export function freeSquares(start: Vec2, count: number, step: (p: Vec2) => boolean): Vec2[] {
  const free: Vec2[] = [];
  for (let ring = 0; ring < FREE_RINGS && free.length < count; ring++) for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
    const p: Vec2 = [start[0] + di * CELL_FT, start[1] + dj * CELL_FT];
    if (step(p)) free.push(p);
  }
  return free;
}

/** A character's roster row as Split up reads it: release 1b adds the row's own light, and whether the character is at
 *  the table tonight (missing: at the table). */
export type CharacterRow = Sheet & { light?: Token['light']; present?: boolean };

const same = (a: Vec2, b: Vec2) => a[0] === b[0] && a[1] === b[1];

/**
 * Split up: one figure per character at the table (a PC row not marked absent), in roster order, with today's ids
 * (`tok-<map>-<row>`, app.ts startEncounter) and its row's size, darkvision and colour. The first stands on the marker's
 * square; the rest on the free squares (freeSquares from the marker), the marker's own square skipped, and on the
 * marker's square when they run out (as today's Start does). Light when apart: when no row at the table sets its own
 * light, the first character carries the party's (the marker's) light, so a dark map looks the same the moment the party
 * splits; when any row does, each character carries its row's. No character at the table: no figures (keep the marker).
 */
export function splitParty(marker: Token, characters: readonly CharacterRow[], free: readonly Vec2[]): Token[] {
  const rows = characters.filter((s) => s.kind === 'pc' && s.present !== false), at = marker.pos;
  const rest = free.filter((p) => !same(p, at)), ownLights = rows.some((s) => s.light !== undefined);
  return rows.map((s, i): Token => {
    const pos = i === 0 ? at : rest[i - 1] ?? at;
    const light = ownLights ? s.light : i === 0 ? marker.light : undefined;
    return { id: `tok-${marker.location}-${s.id}`, name: s.name, location: marker.location, level: marker.level, pos: [pos[0], pos[1]], size: s.size, darkvisionFt: s.darkvisionFt, color: s.color, role: 'member', sheetId: s.id, light: light && { ...light } };
  });
}

/**
 * Gather: the characters' figures on a map (its member tokens) folded back into one party marker at `at` (the picked-up
 * character's square and floor), with today's marker fields; a marker already there is replaced, so the map keeps one.
 * Creatures and other maps' tokens are kept as they are.
 */
export function gatherParty(tokens: readonly Token[], location: string, at: { level: string; pos: Vec2 }): { tokens: Token[]; marker: Token } {
  const marker = partyMarker(location, at.level, at.pos);
  return { tokens: [...tokens.filter((t) => t.location !== location || (t.role !== 'member' && !isMarker(t))), marker], marker };
}
