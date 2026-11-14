// The clip check (kit/clipcheck.ts) over every jointed NPC miniature, shared by tests/npc-clips-*.test.ts (one file
// per state, so the three run side by side): each named NPC's own recipe, and each kind of common folk as a token
// without an id shows it and as three tokens' ids vary it (the looks a creature has, and the faces, heights and falls
// an id picks). Nothing is let off: no limb, held weapon or put-away weapon may pass into the body or another limb.
import { BESTIARY, figureFor } from '../app/src/bestiary';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import type { HeroFigure } from '../app/src/kit/heroes';

/** The recipe the rig was last handed: each test file mocks kit/heroes to record it, as a common creature's recipe is
 *  made from its look and its token's id on the way to the rig. */
export interface Seen { last: unknown }
/** The token ids a common creature is checked with ('' is a token without one). */
export const TOKENS = ['', 'a', 'b', 'c'];

/** Every clip in every jointed NPC miniature in one state: how many figures were checked, and a line per clipped one. */
export function clipsIn(state: 'rest' | 'battle' | 'dead', seen: Seen): { checked: number; clips: string[] } {
  const clips: string[] = []; let checked = 0;
  for (const e of BESTIARY) for (const seed of e.hero ? [''] : TOKENS) {
    seen.last = undefined;
    const g = figureFor(e, state === 'battle' ? true : state === 'dead' ? 'dead' : false, seed);
    const f = seen.last as HeroFigure | undefined; if (!f || !g.getObjectByName('neck')) continue; // (a beast, or a body not on the jointed rig)
    checked++;
    const hits = findClips(g, f); if (hits.length) clips.push(`${e.id}${seed ? ' #' + seed : ''}: ${describeClips(hits)}`);
  }
  return { checked, clips };
}
