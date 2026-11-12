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
});
