// The initiative clock's rules engine (core/initClock.ts): order and ties, turns and rounds, reminders pinned into
// the order, conditions ticking on the right turn, hit point maths, death saves, stat-block parsing, difficulty in
// both rule sets, and the dial's geometry.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  addCondition, angleOf, applyHp, combatant, concentrationDc, deathSave, delay, difficulty, initAt, multiplier2014, newClock, next, numbered,
  ordered, parseBlock, prev, prompts, reminder, resume, rollExpr, roundsLeft, setInit, nudgeTie, TOP, avgExpr, type Clock, fightCount, fightGroups, fightsFromPack,
} from '../app/src/core/initClock';

const fight = (): Clock => {
  const c = newClock();
  c.entries.push(
    combatant({ id: 'a', name: 'Ana', side: 'pc', init: 18, mod: 2, hp: { cur: 20, max: 20, temp: 0 } }),
    combatant({ id: 'g1', name: 'Ghoul 1', init: 12, mod: 2, hp: { cur: 22, max: 22, temp: 0 } }),
    combatant({ id: 'g2', name: 'Ghoul 2', init: 12, mod: 2, hp: { cur: 22, max: 22, temp: 0 } }),
    combatant({ id: 'b', name: 'Bo', side: 'pc', init: 5, mod: 0, hp: { cur: 12, max: 12, temp: 0 } }),
  );
  return c;
};
const ids = (c: Clock) => ordered(c).map((e) => e.id);
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('order', () => {
  it('sorts high to low, unrolled last, and the DM breaks ties', () => {
    const c = fight(); c.entries.push(combatant({ id: 'x', name: 'Unrolled' }));
    expect(ids(c)).toEqual(['a', 'g1', 'g2', 'b', 'x']);
    nudgeTie(c, 'g2', 1);
    expect(ids(c).slice(1, 3)).toEqual(['g2', 'g1']);
  });
  it('lair actions on 20 lose ties; top-of-round reminders come first', () => {
    const c = fight(); setInit(c, 'a', 20);
    c.entries.push(reminder('Lair action', { mode: 'every', preset: 'lair' }, 20, { id: 'lair' }), reminder('Reinforcements', { mode: 'countdown', atRound: 3 }, TOP, { id: 'r' }));
    expect(ids(c).slice(0, 3)).toEqual(['r', 'a', 'lair']);
  });
});

describe('turns', () => {
  it('walks the order and wraps into the next round', () => {
    const c = fight(); next(c);
    expect(c.active).toBe('a'); expect(c.round).toBe(1);
    next(c); next(c); next(c); expect(c.active).toBe('b');
    next(c); expect(c.active).toBe('a'); expect(c.round).toBe(2);
    prev(c); expect(c.active).toBe('b'); expect(c.round).toBe(1);
  });
  it('a countdown reminder stops the clock only when it is due, then is done', () => {
    const c = fight(); c.entries.push(reminder('Reinforcements', { mode: 'countdown', atRound: 2 }, TOP, { id: 'r' }));
    next(c); expect(c.active).toBe('a');
    expect(roundsLeft(c.entries.find((e) => e.id === 'r')!, c.round)).toBe(1);
    for (let i = 0; i < 4; i++) next(c);
    expect(c.round).toBe(2); expect(c.active).toBe('r');
    next(c); expect(c.active).toBe('a');
    for (let i = 0; i < 4; i++) next(c);
    expect(c.round).toBe(3); expect(c.active).toBe('a');
  });
  it('an interval reminder reschedules itself', () => {
    const c = fight(); c.entries.push(reminder('Bell', { mode: 'interval', atRound: 1, every: 2 }, TOP, { id: 'r' }));
    next(c); expect(c.active).toBe('r'); next(c);
    expect(c.entries.find((e) => e.id === 'r')!.rem!.atRound).toBe(3);
  });
  it('skips downed creatures but a PC at 0 keeps the turn for death saves', () => {
    const c = fight(); next(c);
    applyHp(c.entries.find((e) => e.id === 'g1')!, '30', '2024');
    applyHp(c.entries.find((e) => e.id === 'b')!, '12', '2024');
    next(c); expect(c.active).toBe('g2'); next(c); expect(c.active).toBe('b');
    expect(prompts(c, c.entries.find((e) => e.id === 'b')).start.some((p) => p.kind === 'death')).toBe(true);
  });
  it('conditions tick on the edge of the turn they name', () => {
    const c = fight(); const g = c.entries.find((e) => e.id === 'g1')!;
    addCondition(g, { name: 'Frightened', rounds: 1, ends: 'end', of: 'a' });
    next(c); expect(g.conditions).toHaveLength(1);
    next(c); expect(g.conditions).toHaveLength(0);
  });
  it('legendary uses and reactions come back at the start of the creature\'s turn; regeneration heals', () => {
    const c = fight(); const g = c.entries.find((e) => e.id === 'g1')!;
    g.legendary = { name: 'Legendary actions', max: 3, used: 2 }; g.reaction = true; g.regen = { hp: 5 }; g.hp!.cur = 10;
    next(c); expect(prompts(c, c.entries.find((e) => e.id === 'a')).after.some((p) => p.kind === 'legendary')).toBe(true);
    next(c); expect(g.legendary.used).toBe(0); expect(g.reaction).toBe(false); expect(g.hp!.cur).toBe(15);
  });
  it('delay and resume re-slot a combatant after the current turn', () => {
    const c = fight(); next(c); delay(c, 'a');
    expect(c.active).toBe('g1');
    resume(c, 'a'); expect(c.active).toBe('a');
    expect(ids(c).indexOf('a')).toBe(ids(c).indexOf('g1') + 1);
  });
});

describe('hit points', () => {
  it('temporary hp soak first, healing caps at the maximum, concentration DC in both editions', () => {
    const e = combatant({ name: 'X', hp: { cur: 20, max: 30, temp: 5 }, conc: 'Bless' });
    const r = applyHp(e, '9', '2024')!;
    expect(e.hp).toEqual({ cur: 16, max: 30, temp: 0 }); expect(r.concentrationDc).toBe(10);
    applyHp(e, '+100', '2024'); expect(e.hp!.cur).toBe(30);
    expect(concentrationDc(70, '2024')).toBe(35 > 30 ? 30 : 35); expect(concentrationDc(70, '2014')).toBe(35);
  });
  it('a PC at 0 makes death saves; damage at 0 is a failure; massive damage kills', () => {
    const e = combatant({ name: 'P', side: 'pc', hp: { cur: 5, max: 10, temp: 0 } });
    applyHp(e, '5', '2014'); expect(e.death).toEqual({ s: 0, f: 0 }); expect(e.conditions[0].name).toBe('Unconscious');
    applyHp(e, '3', '2014'); expect(e.death!.f).toBe(1);
    deathSave(e, 12); deathSave(e, 15); expect(e.death!.s).toBe(2);
    deathSave(e, 20); expect(e.hp!.cur).toBe(1); expect(e.death).toBeUndefined();
    const f = combatant({ name: 'Q', side: 'pc', hp: { cur: 5, max: 10, temp: 0 } });
    expect(applyHp(f, '15', '2024')!.dead).toBe(true);
  });
});

describe('dice and names', () => {
  it('rolls and averages expressions', () => {
    expect(rollExpr('2d6+3', seq(0, 0.99))).toBe(1 + 6 + 3);
    expect(avgExpr('5d8')).toBe(22); expect(avgExpr('23d8+92')).toBe(195);
  });
  it('numbers copies and renames a lone first one', () => {
    const c = newClock(); c.entries.push(combatant({ name: 'Ghoul' }));
    expect(numbered(c, 'Ghoul', 2)).toEqual(['Ghoul 2', 'Ghoul 3']); expect(c.entries[0].name).toBe('Ghoul 1');
  });
});

describe('stat blocks', () => {
  const books = (b: string) => JSON.parse(readFileSync(`app/public/books/${b}/e/monsters.json`, 'utf8')).entries as Record<string, { html: string }>;
  it('reads legendary actions, legendary resistance, recharges and regeneration from the SRD', () => {
    const v14 = parseBlock(books('srd-5.1')['monster:vampire'].html);
    expect(v14.legendary).toBe(3); expect(v14.legres).toBe(3); expect(v14.regen?.hp).toBe(20);
    const v24 = parseBlock(books('srd-5.2.1')['monster:vampire'].html);
    expect(v24.legendary).toBe(3); expect(v24.recharges.map((r) => r.name)).toContain('Charm');
    const dragon = parseBlock(books('srd-5.2.1')['monster:adult-red-dragon'].html);
    expect(dragon.recharges[0]).toMatchObject({ name: 'Fire Breath', min: 5 });
    expect(parseBlock(books('srd-5.1')['monster:troll'].html).regen).toMatchObject({ hp: 10 });
  });
  it('reads pasted plain text', () => {
    const p = parseBlock('Night Thing\nMedium Undead\nArmor Class 15 (natural armor)\nHit Points 45 (6d8 + 18)\nSpeed 30 ft.\nSTR 16 (+3) DEX 14 (+2) CON 16 (+3)\nSenses darkvision 60 ft., passive Perception 13\nChallenge 3 (700 XP)\nHowl (Recharge 6). It howls.\nDarkness (1/Day). It casts.');
    expect(p).toMatchObject({ name: 'Night Thing', ac: 15, hp: 45, hpDice: '6d8+18', dex: 14, pp: 13, cr: '3', xp: 700 });
    expect(p.recharges[0]).toMatchObject({ name: 'Howl', min: 6 }); expect(p.perDay[0]).toMatchObject({ name: 'Darkness', max: 1 });
  });
});

describe('difficulty', () => {
  it('2014 adjusted XP with the multiplier, 2024 budgets', () => {
    expect(multiplier2014(4, 4)).toBe(2); expect(multiplier2014(1, 2)).toBe(1.5); expect(multiplier2014(4, 6)).toBe(1.5);
    const dd = difficulty(['1', '1', '1', '1'], [3, 3, 3, 3]);
    expect(dd.xp).toBe(800); expect(dd.y2014.adjusted).toBe(1600); expect(dd.y2014.label).toBe('deadly');
    expect(dd.y2024.label).toBe('moderate');
    expect(difficulty(['3', '3', '1'], [3, 3, 3, 3]).y2024.label).toBe('high');
  });
});

describe('the dial', () => {
  it('puts 30 just past the top, 1 just before it, and reads back what it draws', () => {
    expect(angleOf(30)).toBe(6); expect(angleOf(1)).toBe(354); expect(angleOf(15)).toBe(186); expect(angleOf(TOP)).toBe(0);
    for (let v = 1; v <= 30; v++) expect(initAt(angleOf(v))).toBe(v);
    expect(initAt(0)).toBe(TOP);
  });
});

describe('prepared fights from an encounter pack', () => {
  const pack = { schema: 1, encounters: [
    { id: 'early', title: 'A stranger on the road', scene: 'x/town', creatures: [{ id: 'wolf', count: '3d6' }] },
    { id: 'a', title: 'Old House: ghouls in the cellar', scene: 'x/house', area: '29', trigger: 'Reaching the middle', creatures: [{ id: 'ghoul', count: 4, note: 'former cultists' }] },
    { id: 'b', title: 'Old House: the owners', scene: 'x/house', creatures: [{ id: 'mister-owner', count: 1, cr: '2', note: 'ghast' }, { id: 'ghoul', count: 2 }] },
    { id: 'c', title: 'Town: rats', scene: 'x/town', creatures: [{ id: 'swarm-of-rats', count: '2d4' }] },
    { id: 'bad', title: 'No creatures', scene: 'x/house', creatures: [] },
  ] };
  const fights = fightsFromPack(pack, (id) => (id === 'ghoul' ? 'Ghoul' : undefined));
  it('groups by the dungeon in the title, and by scene when the title has none', () => {
    expect(fights.map((f) => [f.id, f.group, f.title])).toEqual([['a', 'Old House', 'Ghouls in the cellar'], ['b', 'Old House', 'The owners'], ['c', 'Town', 'Rats'], ['early', 'Town', 'A stranger on the road']]);
    expect(fights[1].creatures[0]).toMatchObject({ name: 'Mister Owner', cr: '2', note: 'ghast' });
  });
  it('counts the creatures out per dungeon, dice left for the DM to roll', () => {
    const g = fightGroups(fights);
    expect(g.map((x) => x.group)).toEqual(['Old House', 'Town']);
    expect(g[0]).toMatchObject({ creatures: 7, totals: [{ name: 'Ghoul', count: 6, dice: [] }, { name: 'Mister Owner', count: 1, dice: [] }] });
    expect(g[1].totals).toEqual([{ name: 'Swarm of Rats', count: 0, dice: ['2d4'] }, { name: 'Wolf', count: 0, dice: ['3d6'] }]);
  });
  it('takes a fixed count as it is and a dice count only with a roll in range', () => {
    expect(fightCount(4)).toBe(4);
    expect(fightCount('2d4')).toBeNull();
    expect(fightCount('2d4', 5)).toBe(5);
    expect(fightCount('2d4', 9)).toBeNull();
    expect(fightCount('1d4+1', 5)).toBe(5);
    expect(fightsFromPack({ nope: 1 })).toEqual([]);
  });
});
