// Every jointed NPC miniature at rest is free of clips (tests/npc-clips.ts says what is checked).
import { expect, it, vi } from 'vitest';
const seen = vi.hoisted(() => ({ last: undefined as unknown }));
vi.mock('../app/src/kit/heroes', async (orig) => {
  const m = await orig<typeof import('../app/src/kit/heroes')>();
  return { ...m, heroFigure: (...a: Parameters<typeof m.heroFigure>) => { seen.last = a[0]; return m.heroFigure(...a); } };
});
import { clipsIn } from './npc-clips';

it('every NPC miniature at rest: no limb, held weapon or put-away weapon passes into the body or another limb', { timeout: 600000 }, () => {
  const { checked, clips } = clipsIn('rest', seen);
  expect(checked).toBeGreaterThan(350);
  expect(clips).toEqual([]);
});
