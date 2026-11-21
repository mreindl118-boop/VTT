// Every jointed NPC miniature at rest is free of clips, its cloth lies over it, and its gear at the belt hangs
// outside the cloth worn under it (tests/npc-clips.ts says what is checked).
import { expect, it, vi } from 'vitest';
const seen = vi.hoisted(() => ({ last: undefined as unknown }));
vi.mock('../app/src/kit/heroes', async (orig) => {
  const m = await orig<typeof import('../app/src/kit/heroes')>();
  return { ...m, heroFigure: (...a: Parameters<typeof m.heroFigure>) => { seen.last = a[0]; return m.heroFigure(...a); } };
});
import { clipsIn } from './npc-clips';

// (the checks read the same build of every figure, made once)
let made: ReturnType<typeof clipsIn> | undefined;
const all = () => (made ??= clipsIn('rest', seen));

it('every NPC miniature at rest: no limb, held weapon or put-away weapon passes into the body or another limb', { timeout: 600000 }, () => {
  const { checked, clips } = all();
  expect(checked).toBeGreaterThan(350);
  expect(clips).toEqual([]);
});

it('every NPC miniature at rest: no cloth it wears lets its own arms, legs, neck, trunk or plate through', { timeout: 600000 }, () => {
  const { checked, cloth } = all();
  expect(checked).toBeGreaterThan(350);
  expect(cloth).toEqual([]);
});

it('every NPC miniature at rest with gear at the belt: nothing worn under the belt reaches into it', { timeout: 600000 }, () => {
  const { belted, underBelt } = all();
  expect(belted).toBeGreaterThan(100);
  expect(underBelt).toEqual([]);
});
