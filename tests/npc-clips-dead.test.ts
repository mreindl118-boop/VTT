// Every jointed NPC miniature fallen dead is free of clips, and its cloth lies over it (tests/npc-clips.ts says what
// is checked).
import { expect, it, vi } from 'vitest';
const seen = vi.hoisted(() => ({ last: undefined as unknown }));
vi.mock('../app/src/kit/heroes', async (orig) => {
  const m = await orig<typeof import('../app/src/kit/heroes')>();
  return { ...m, heroFigure: (...a: Parameters<typeof m.heroFigure>) => { seen.last = a[0]; return m.heroFigure(...a); } };
});
import { clipsIn } from './npc-clips';

// (both checks read the same build of every figure, made once)
let made: ReturnType<typeof clipsIn> | undefined;
const all = () => (made ??= clipsIn('dead', seen));

it('every NPC miniature fallen dead: no limb, held weapon or put-away weapon passes into the body or another limb', { timeout: 600000 }, () => {
  const { checked, clips } = all();
  expect(checked).toBeGreaterThan(350);
  expect(clips).toEqual([]);
});

it('every NPC miniature fallen dead: no cloth it wears lets its own arms, legs, neck or trunk through', { timeout: 600000 }, () => {
  const { checked, cloth } = all();
  expect(checked).toBeGreaterThan(350);
  expect(cloth).toEqual([]);
});
