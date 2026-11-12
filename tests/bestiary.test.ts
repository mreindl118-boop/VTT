import { describe, expect, it } from 'vitest';
import { BESTIARY, searchCreatures, figureFor, aliasFor, seenAs, statsOf, speedFtOf } from '../app/src/bestiary';

describe('creature repository', () => {
  it('lists the module\'s people and monsters without the token and PC kits', () => {
    expect(BESTIARY.length).toBeGreaterThan(150);
    expect(BESTIARY.some((e) => e.id === 'pc-kit' || e.id === 'standee')).toBe(false);
  });
  it('searches by name, kind and tag, people first', () => {
    expect(searchCreatures('wolf').map((e) => e.id)).toEqual(expect.arrayContaining(['wolf', 'dire-wolf', 'werewolf']));
    expect(searchCreatures('strahd')[0].id).toBe('strahd-von-zarovich');
    expect(searchCreatures('K').some((e) => e.tags.includes('K'))).toBe(true);
    expect(searchCreatures('K84').map((e) => e.id)).toEqual(['patrina-velikovna']);
  });
  it('gives every entry a figure, a players\' name and, for open-content monsters, numbers', () => {
    for (const e of BESTIARY) expect(figureFor(e).children.length).toBeGreaterThan(0);
    expect(aliasFor(BESTIARY.find((e) => e.id === 'strahd-von-zarovich')!)).not.toContain('Strahd');
    expect(aliasFor(BESTIARY.find((e) => e.id === 'wolf')!)).toBe('Wolf');
    expect(seenAs(BESTIARY.find((e) => e.id === 'ghoul')!)).toBeTruthy();
    expect(statsOf(BESTIARY.find((e) => e.id === 'dire-wolf')!)).toEqual({ ac: 14, hp: 37, speed: '50 ft', cr: '1' });
    expect(speedFtOf(BESTIARY.find((e) => e.id === 'dire-wolf')!)).toBe(50);
    expect(speedFtOf(BESTIARY.find((e) => e.id === 'rahadin')!)).toBe(30);
  });
  it('gives named NPCs with a recipe their own miniature, standing and in a battle stance', () => {
    const heroes = BESTIARY.filter((e) => e.hero);
    expect(heroes.length).toBeGreaterThan(30);
    expect(heroes.every((e) => e.kind === 'npc' && e.tier === 1)).toBe(true);
    for (const e of heroes) {
      expect(figureFor(e).children.length).toBeGreaterThan(0);
      expect(figureFor(e, true).children.length).toBeGreaterThan(0);
    }
  });
  it('every creature builds a miniature at rest, in battle and dead, and the monster registries name real creatures', { timeout: 120000 }, async () => {
    const { FOLK, MENAGERIE } = await import('../app/src/kit/menagerie');
    const { NPC_POSES, composedOk } = await import('../app/src/kit/poses');
    const { POSES } = await import('../app/src/kit/heroes');
    const ids = new Set(BESTIARY.map((e) => e.id));
    for (const id of [...Object.keys(FOLK), ...Object.keys(MENAGERIE)]) expect(ids.has(id), id).toBe(true);
    const known = (p: unknown) => typeof p !== 'string' || p in NPC_POSES || p in POSES || (/[ :]/.test(p) && composedOk(p));
    for (const e of BESTIARY) {
      if (e.hero) { expect(known(e.hero.pose), `${e.id} pose`).toBe(true); expect(known(e.hero.battlePose), `${e.id} battle pose`).toBe(true); }
      for (const battle of [false, true, 'dead'] as const) { let n = 0; figureFor(e, battle, 'token-1').traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) n++; }); expect(n, `${e.id} ${battle}`).toBeGreaterThan(0); }
    }
    for (const r of Object.values(FOLK)) { expect(known(r.pose)).toBe(true); expect(known(r.battlePose)).toBe(true); }
    for (const id of ['strahd-mounted', 'strahd-mounted-charging', 'strahd-bat-form', 'strahd-wolf-form', 'strahd-mist-form', 'strahd-blade-drawn']) expect(ids.has(id), id).toBe(true);
  });
});
