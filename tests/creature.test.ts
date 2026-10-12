// A creature's one source (ui/creature.ts): the books' stat block for the chosen edition when the open rules have it,
// else the module's numbers under 'Module stats', else a note. The card, the token panel and the bestiary read it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setBookFetcher } from '../app/src/books/store';
import { lookup } from '../app/src/books/lookup';
import type { MonsterSummary } from '../app/src/books/types';
import { loadBooks } from '../scripts/terms-corpus';
import { creatureSource, MODULE_STATS, NO_OPEN_BLOCK, numbersOf, statLine, statPills } from '../app/src/ui/creature';
import { monsterIdFor } from '../app/src/ui/terms';

beforeAll(async () => { await loadBooks(); }, 60_000);
afterAll(() => setBookFetcher(null));

describe('one source per creature', () => {
  for (const ed of ['2024', '2014'] as const) {
    it(`${ed}: the ghoul's numbers are lookup('ghoul', '${ed}')`, async () => {
      const src = await creatureSource('ghoul', ed), e = await lookup('ghoul', ed);
      const s = e!.summary as MonsterSummary;
      expect(src.kind).toBe('srd');
      const n = numbersOf(src, 'medium');
      expect([n.ac, n.hp, n.cr]).toEqual([String(s.ac), String(s.hp), String(s.cr)]);
      expect(n.from).toBe(ed === '2024' ? '2024 · SRD 5.2.1' : '2014 · SRD 5.1');
      expect(statLine(src)).toBe(`AC ${s.ac} · HP ${s.hp} · CR ${s.cr}`);
    });
  }
  it('a module creature id finds its books monster in either edition', () => {
    expect(monsterIdFor('dire-wolf', '2024')).toBe('monster:dire-wolf');
    expect(monsterIdFor('wolf', '2014')).toBe('monster:wolf');
    expect(monsterIdFor('ireena-kolyana', '2024')).toBeUndefined();
    expect(monsterIdFor('mongrelfolk', '2024')).toBeUndefined();
  });
  it('mongrelfolk: no open stat block, under Module stats, and no numbers', async () => {
    const src = await creatureSource('mongrelfolk', '2024');
    expect(src.kind).toBe('module');
    const n = numbersOf(src, 'medium');
    expect(n).toEqual({ size: 'medium', from: MODULE_STATS, note: NO_OPEN_BLOCK });
    expect(NO_OPEN_BLOCK).toBe('Curse of Strahd creature: no open stat block');
  });
  it('a creature the open rules lack but the module has numbers for: the module\'s numbers, never mixed', async () => {
    const src = await creatureSource('revenant', '2024');
    expect(src.kind).toBe('module');
    expect(numbersOf(src)).toMatchObject({ ac: '13', hp: '136', cr: '5', from: MODULE_STATS });
    expect(statLine(src)).toBe('AC 13 · HP 136 · CR 5 · Module stats');
  });
  it('people are the module\'s own: no books entry', async () => {
    expect((await creatureSource('strahd-von-zarovich', '2024')).kind).toBe('module');
  });
  it('the pills are rules links to size, AC, HP, speed and CR, each with a 20 px emblem', async () => {
    const html = statPills(numbersOf(await creatureSource('ghoul', '2024'), 'medium'));
    expect([...html.matchAll(/data-term="([^"]+)"/g)].map((m) => m[1])).toEqual(['rule:creature-size', 'rule:armor-class', 'rule:hit-points', 'rule:speed', 'rule:challenge-rating']);
    expect((html.match(/class="rl rule pill"/g) ?? []).length).toBe(5);
    expect((html.match(/<svg class="e"/g) ?? []).length).toBe(5);
  });
});
