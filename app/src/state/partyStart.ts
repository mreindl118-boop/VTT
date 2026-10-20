// Where a map starts the party, and the parties a release moves there. The DM opens a map at the party's floor (a
// reload, a return to it: app.ts open), so the party must start on the floor the map opens on.
import { bounds, type Vec2 } from '../core/geometry';
import { squareCellAt, squareCellCenter } from '../core/grid';
import type { SceneFile } from '../core/schema';
import type { CampaignState, Token } from './campaign';

/** Where a map starts the party: at its authored spawn; without one, in the middle of the first room of the floor the
 *  map opens on (its entry), on the 5-ft cell there. */
export function partyStart(scene: SceneFile): { level: string; pos: Vec2 } {
  for (const l of scene.levels) {
    const sp = l.objects.find((o) => o.kind === 'spawn');
    if (sp) return { level: l.id, pos: squareCellCenter(squareCellAt([sp.pos[0], sp.pos[2]])) };
  }
  const level = [scene.levels.find((l) => l.id === scene.entry), scene.levels[0]].find((l) => l?.rooms.length) ?? scene.levels[0];
  const b = bounds([level.rooms[0].polygon]);
  return { level: level.id, pos: squareCellCenter(squareCellAt([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2])) };
}

/** Where 0.3.x left a party it placed itself, on the maps whose start has moved since (by location): Castle Ravenloft
 *  had no spawn, so the party started in the middle of the dungeon's first room; the Wachterhaus started it in its
 *  secret cellar, the first floor of its list. */
export const LEGACY_STARTS: Readonly<Record<string, { level: string; pos: Vec2 }>> = {
  K: { level: 'dungeon', pos: [217.5, 202.5] },
  N4: { level: 'cellar', pos: [37.5, 72.5] },
};

/** The party's own token on a map (the one its start makes), if the save has one. */
const partyOn = (tokens: Token[], location: string) => tokens.find((t) => t.location === location && (t.role === 'party' || t.id === `pc-${location}`));

/** Before a map opens: a party still where 0.3.x placed it on a map whose start has moved (checked once per map and
 *  campaign, so a party the table later moves there stays), or one standing on a floor the map no longer has, is put at
 *  the map's start. The party's members and placed creatures are never moved. True when it moved the party. */
export function settleParty(state: Pick<CampaignState, 'tokens' | 'settledStarts'>, scene: SceneFile): boolean {
  const loc = scene.location, t = partyOn(state.tokens, loc), old = LEGACY_STARTS[loc];
  const untouched = !!t && !!old && !state.settledStarts?.includes(loc) && t.level === old.level && t.pos[0] === old.pos[0] && t.pos[1] === old.pos[1];
  if (old && !state.settledStarts?.includes(loc)) (state.settledStarts ??= []).push(loc);
  if (!t || (!untouched && scene.levels.some((l) => l.id === t.level))) return false;
  const s = partyStart(scene);
  t.level = s.level; t.pos = [s.pos[0], s.pos[1]];
  return true;
}
