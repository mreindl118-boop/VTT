// The clip check (kit/clipcheck.ts) over every jointed NPC miniature, shared by tests/npc-clips-*.test.ts (one file
// per state, so the three run side by side): each named NPC's own recipe, and each kind of common folk as a token
// without an id shows it and as three tokens' ids vary it (the looks a creature has, and the faces, heights and falls
// an id picks), and each look only an encounter's alias calls up, in every stance its band takes. Nothing is let off:
// no limb, held weapon or put-away weapon may pass into the body or another limb. And where gear hangs at the belt
// (at rest and in a battle stance), the cloth check (kit/clothcheck.ts) finds nothing worn under the belt reaching
// into it: it hangs outside the cloth, the belt riding over it.
import { BESTIARY, figureFor } from '../app/src/bestiary';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { findPokes } from '../app/src/kit/clothcheck';
import type { HeroFigure } from '../app/src/kit/heroes';
import { FOLK, LOOKS, NAMED } from '../app/src/kit/menagerie';

/** The recipe the rig was last handed: each test file mocks kit/heroes to record it, as a common creature's recipe is
 *  made from its look and its token's id on the way to the rig. */
export interface Seen { last: unknown }
/** The token ids a common creature is checked with ('' is a token without one). */
export const TOKENS = ['', 'a', 'b', 'c'];

/** The looks an encounter's alias calls up for a creature (kit/menagerie.ts NAMED): an alias for each (the first word
 *  its pattern takes) and the token ids to check it with: a staged band's, one for each stance the look gives, or the
 *  usual ones. */
export function namedTokens(id: string): { hint: string; seeds: string[] }[] {
  return (NAMED[id] ?? []).map(([re, i]) => {
    const hint = re.source.split('|')[0], n = LOOKS[id]?.[i]?.stances?.length ?? 0;
    if (NAMED[id].find(([r]) => r.test(hint))?.[1] !== i) throw new Error(`${id}: "${hint}" does not call up look ${i}`);
    return { hint, seeds: n ? Array.from({ length: n }, (_, k) => `cr-x-${id}-t-${k + 1}`) : TOKENS };
  });
}

/** What hangs over gear at the belt, not under the belt: a cloak, a mantle, a coat's tails. */
const OVER_BELT = ['cloak', 'mantle', 'tails'];

/** Every clip in every jointed NPC miniature in one state: how many figures were checked, and a line per clipped one;
 *  and, standing (at rest or in a battle stance), how many carry gear at the belt and a line for each where cloth worn
 *  under the belt reaches into that gear. */
export function clipsIn(state: 'rest' | 'battle' | 'dead', seen: Seen): { checked: number; clips: string[]; belted: number; underBelt: string[] } {
  const clips: string[] = [], underBelt: string[] = []; let checked = 0, belted = 0;
  // (stances are checked only on a look an alias calls up, where a band is staged: anywhere else is not covered here)
  for (const [id, f] of Object.entries(FOLK)) if (f.stances) throw new Error(`${id}: stances on a creature's own recipe are not clip-checked`);
  for (const [id, looks] of Object.entries(LOOKS)) looks.forEach((l, i) => { if (l.stances && !l.byName) throw new Error(`${id} look ${i}: stances on a look a token's id picks are not clip-checked`); });
  for (const e of BESTIARY) for (const { hint, seeds } of e.hero ? [{ hint: '', seeds: [''] }] : [{ hint: '', seeds: TOKENS }, ...namedTokens(e.id)]) for (const seed of seeds) {
    seen.last = undefined;
    const g = figureFor(e, state === 'battle' ? true : state === 'dead' ? 'dead' : false, seed, hint);
    const f = seen.last as HeroFigure | undefined; if (!f || !g.getObjectByName('neck')) continue; // (a beast, or a body not on the jointed rig)
    checked++;
    const who = `${e.id}${hint ? ` "${hint}"` : ''}${seed ? ' #' + seed : ''}`;
    const hits = findClips(g, f); if (hits.length) clips.push(`${who}: ${describeClips(hits)}`);
    if (state === 'dead' || !(f.gear?.beltR || f.gear?.beltL)) continue;
    belted++;
    const under = findPokes(g).filter((p) => p.part === 'stowed' && !OVER_BELT.includes(p.garment));
    if (under.length) underBelt.push(`${who}: ${under.map((p) => `${p.garment} ${p.depth.toFixed(3)} (${p.points} points)`).join(', ')}`);
  }
  return { checked, clips, belted, underBelt };
}
