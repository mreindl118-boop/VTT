// The clip check (kit/clipcheck.ts) over every jointed NPC miniature, shared by tests/npc-clips-*.test.ts (one file
// per state, so the three run side by side): each named NPC's own recipe, and each kind of common folk as a token
// without an id shows it and as three tokens' ids vary it (the looks a creature has, and the faces, heights and falls
// an id picks), and each look only an encounter's alias calls up, in every stance its band takes. Nothing is let off:
// no limb, held weapon or put-away weapon may pass into the body or another limb.
import { BESTIARY, figureFor } from '../app/src/bestiary';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
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

/** Every clip in every jointed NPC miniature in one state: how many figures were checked, and a line per clipped one. */
export function clipsIn(state: 'rest' | 'battle' | 'dead', seen: Seen): { checked: number; clips: string[] } {
  const clips: string[] = []; let checked = 0;
  // (stances are checked only on a look an alias calls up, where a band is staged: anywhere else is not covered here)
  for (const [id, f] of Object.entries(FOLK)) if (f.stances) throw new Error(`${id}: stances on a creature's own recipe are not clip-checked`);
  for (const [id, looks] of Object.entries(LOOKS)) looks.forEach((l, i) => { if (l.stances && !l.byName) throw new Error(`${id} look ${i}: stances on a look a token's id picks are not clip-checked`); });
  for (const e of BESTIARY) for (const { hint, seeds } of e.hero ? [{ hint: '', seeds: [''] }] : [{ hint: '', seeds: TOKENS }, ...namedTokens(e.id)]) for (const seed of seeds) {
    seen.last = undefined;
    const g = figureFor(e, state === 'battle' ? true : state === 'dead' ? 'dead' : false, seed, hint);
    const f = seen.last as HeroFigure | undefined; if (!f || !g.getObjectByName('neck')) continue; // (a beast, or a body not on the jointed rig)
    checked++;
    const hits = findClips(g, f); if (hits.length) clips.push(`${e.id}${hint ? ` "${hint}"` : ''}${seed ? ' #' + seed : ''}: ${describeClips(hits)}`);
  }
  return { checked, clips };
}
