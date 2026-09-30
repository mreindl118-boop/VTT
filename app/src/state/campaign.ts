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
}

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
  updatedAt: number;
}

export function newCampaign(id = 'default'): CampaignState {
  return { id, name: 'Curse of Strahd', reveals: [], tokens: [], seen: {}, doorsOpen: {}, opened: {}, updatedAt: Date.now() };
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
