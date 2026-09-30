// Campaign state: reveal log (undoable), tokens, per-level explored memory. The DM window is authoritative.
import type { Vec2 } from '../core/geometry';
import type { CreatureSize } from '../core/units';

export type Reveal =
  | { type: 'room'; location: string; key: string; mode: 'reveal' | 'fog' | 'explored' }
  | { type: 'object'; location: string; id: string }
  | { type: 'secret-door'; location: string; id: string; wallId: string }
  | { type: 'brush'; location: string; level: string; mode: 'reveal' | 'fog' | 'clear'; r: number; pts: Vec2[] };

export interface Token {
  id: string;
  name: string;
  location: string;
  level: string;
  pos: Vec2;
  size: CreatureSize;
  darkvisionFt: number;
  color: string;
  /** Light carried by the token, if any. */
  light?: { bright: number; dim: number };
  /** The party marker, or one combatant's own token during an encounter. */
  role?: 'party' | 'member';
  sheetId?: string;
}

/** A character sheet's tactical essentials: what the range overlay needs. */
export interface Sheet {
  id: string;
  name: string;
  color: string;
  speedFt: number;
  /** Melee reach in feet (5 normally, 10 with a reach weapon). */
  reachFt: number;
  /** Normal range of a ranged weapon or spell, 0 for none. */
  rangeFt: number;
  initMod: number;
  size: CreatureSize;
  darkvisionFt: number;
  kind: 'pc' | 'npc';
}

export interface Combatant { sheetId: string; tokenId: string; init: number }
export interface Encounter {
  location: string;
  level: string;
  round: number;
  /** Turn order, highest initiative first. */
  order: Combatant[];
  turn: number;
  /** Movement already spent by the current combatant this turn. */
  movedFt: number;
  /** Where the party token stood; it returns there when the encounter ends. */
  partyPos: Vec2;
}

export interface WorldPos { pos: [number, number]; key?: string; trail: { pos: [number, number]; key?: string; miles: number; at: number }[] }

export interface CampaignState {
  id: string;
  name: string;
  reveals: Reveal[];
  tokens: Token[];
  /** Explored memory by `${location}/${level}` (RLE). */
  seen: Record<string, string>;
  doorsOpen: Record<string, boolean>;
  /** Opened containers by `${location}/${objectId}`. */
  opened: Record<string, boolean>;
  /** Where the party is on the world map (miles), the pin it is at, and the trail of moves. */
  world?: WorldPos;
  /** Player characters and recurring foes, for initiative and ranges. */
  roster: Sheet[];
  /** The running encounter, if any. */
  encounter?: Encounter;
  updatedAt: number;
}

export function newCampaign(id = 'default'): CampaignState {
  return { id, name: 'Curse of Strahd', reveals: [], tokens: [], seen: {}, doorsOpen: {}, opened: {}, roster: defaultRoster(), updatedAt: Date.now() };
}

/** Derived lookup of what players have been shown (for one location). */
export function revealSets(s: CampaignState, location: string) {
  const objects = new Set<string>();
  const secretDoors = new Set<string>();
  const secretWalls = new Set<string>();
  for (const r of s.reveals) {
    if (r.location !== location) continue;
    if (r.type === 'object') objects.add(r.id);
    if (r.type === 'secret-door') { secretDoors.add(r.id); secretWalls.add(r.wallId); }
  }
  return { objects, secretDoors, secretWalls };
}

/** Four starting sheets the DM edits to match the table. */
export function defaultRoster(): Sheet[] {
  const mk = (id: string, name: string, color: string, reachFt: number, rangeFt: number, initMod: number, darkvisionFt = 0): Sheet => ({ id, name, color, speedFt: 30, reachFt, rangeFt, initMod, size: 'medium', darkvisionFt, kind: 'pc' });
  return [mk('pc-1', 'Fighter', '#d9822b', 5, 0, 1), mk('pc-2', 'Rogue', '#7b5ea7', 5, 80, 3, 60), mk('pc-3', 'Cleric', '#c9b458', 5, 0, 0), mk('pc-4', 'Wizard', '#3b8ea5', 5, 120, 2)];
}
