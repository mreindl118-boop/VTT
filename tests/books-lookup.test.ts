// Search over the rules books and the lookup API the rules tooltips use (app/src/books).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setBookFetcher, loadPage } from '../app/src/books/store';
import { exactHit, groupHits, searchIndex, searchPage } from '../app/src/books/search';
import { findTerms, lookup, lookupAll, rulesEdition, setRulesEdition, termIndex } from '../app/src/books/lookup';
import type { BookIndex, ConditionSummary, MonsterSummary, SpellSummary, ItemSummary } from '../app/src/books/types';

const ix = (b: string) => JSON.parse(readFileSync(`app/public/books/${b}/index.json`, 'utf8')) as BookIndex;

beforeAll(() => setBookFetcher(async (p) => JSON.parse(readFileSync(`app/public/books/${p}`, 'utf8'))));
afterAll(() => setBookFetcher(null));

describe('search', () => {
  it('a condition, a spell and a monster come first by name, typed', () => {
    const b = ix('srd-5.2.1');
    expect(searchIndex(b, 'prone')[0]).toMatchObject({ title: 'Prone [Condition]', type: 'condition', anchor: 'condition-prone', chapter: 'Rules Glossary' });
    expect(searchIndex(b, 'Fireball')[0]).toMatchObject({ title: 'Fireball', type: 'spell', anchor: 'spell-fireball', chapter: 'Spells' });
    expect(searchIndex(b, 'wolf')[0]).toMatchObject({ title: 'Wolf', type: 'monster', chapter: 'Animals' });
    expect(searchIndex(b, 'opportunity attack')[0]).toMatchObject({ anchor: 'rule-opportunity-attacks' });
    expect(searchIndex(b, 'zzzz')).toEqual([]);
  });
  it('Enter jumps to the exact entry', () => {
    const hits = searchIndex(ix('srd-5.1'), 'grappled');
    expect(exactHit(hits, 'Grappled')).toMatchObject({ anchor: 'condition-grappled', type: 'condition' });
  });
  it('results from both books group by book, then by chapter', () => {
    const hits = [...searchIndex(ix('srd-5.2.1'), 'fireball'), ...searchIndex(ix('srd-5.1'), 'fireball')];
    const g = groupHits(hits, ['srd-5.2.1', 'srd-5.1']);
    expect(g.map((x) => x.book)).toEqual(['srd-5.2.1', 'srd-5.1']);
    expect(g[1].chapters[0]).toMatchObject({ title: 'Spell Descriptions' });
    expect(g[0].chapters[0].hits[0].anchor).toBe('spell-fireball');
  });
  it('full text finds words inside entries, with the section and a snippet', async () => {
    const b = ix('srd-5.2.1');
    const i = b.sections.find((s) => s[0] === 'spell-fireball')![3];
    const hits = searchPage(b, i, await loadPage('srd-5.2.1', b.pages[i].id), 'bat guano');
    const fb = hits.find((h) => h.anchor === 'spell-fireball');
    expect(fb).toMatchObject({ title: 'Fireball', type: 'spell', chapter: 'Spells' });
    expect(fb!.snippet).toContain('«bat guano»');
    expect(hits.map((h) => h.anchor)).toContain('spell-delayed-blast-fireball');
  });
});

describe('lookup', () => {
  it('finds a condition by name in the 2024 rules by default, with its effects and section link', async () => {
    const e = await lookup('Prone');
    expect(e).toMatchObject({ id: 'condition:prone', type: 'condition', edition: '2024', book: 'srd-5.2.1', section: { href: '#book/srd-5.2.1/condition-prone' } });
    expect((e!.summary as ConditionSummary).effects[0]).toMatch(/^Restricted Movement\. /);
    expect(e!.attribution).toMatch(/^This work includes material from the System Reference Document 5\.2\.1/);
  });
  it('answers from the edition asked for, by id or by name', async () => {
    const f14 = await lookup('spell:fireball', '2014');
    expect(f14).toMatchObject({ edition: '2014', book: 'srd-5.1', name: 'Fireball' });
    expect((f14!.summary as SpellSummary).castingTime).toBe('1 action');
    expect((await lookup('fireball', '2024'))!.summary).toMatchObject({ castingTime: 'Action', level: 3, school: 'Evocation' });
  });
  it('understands plurals, cue words, abbreviations and inverted names', async () => {
    expect((await lookup('wolves'))!.id).toBe('monster:wolf');
    expect((await lookup('prone condition'))!.id).toBe('condition:prone');
    expect((await lookup('AC'))!.id).toBe('rule:armor-class');
    expect((await lookup('Str'))!.id).toBe('ability:strength');
    expect((await lookup('fire damage'))!.type).toBe('damage');
    expect((await lookup('leather armor', '2014'))!.summary).toMatchObject({ category: 'Armor', ac: '11 + Dex modifier' } satisfies Partial<ItemSummary>);
    expect((await lookup('Opportunity Attack'))!.id).toBe('rule:opportunity-attacks');
  });
  it('typed summaries for every kind', async () => {
    expect((await lookup('Vampire'))!.summary as MonsterSummary).toMatchObject({ size: 'Medium or Small', creatureType: 'Undead', ac: 16, hp: 195, cr: '13' });
    expect((await lookup('Bag of Holding'))!.summary).toMatchObject({ category: 'Wondrous Item', rarity: 'Uncommon', magic: true });
    expect((await lookup('Dash'))!.summary).toEqual({ tag: 'Action' });
    expect((await lookup('Athletics'))!.summary).toEqual({ ability: 'Strength' });
    expect((await lookup('Undead'))!.type).toBe('creature-type');
    expect((await lookup('Grappler'))!.type).toBe('feat');
  });
  it('a name with several meanings: Shield is a spell and a piece of armour', async () => {
    const all = await lookupAll('Shield');
    expect(all.map((e) => e.type).sort()).toEqual(expect.arrayContaining(['item', 'spell']));
    expect((await lookup('Shield', '2024', { type: 'spell' }))!.id).toBe('spell:shield');
  });
  it('answers only from the chosen edition; the other edition answers only when asked to', async () => {
    expect(await lookup('Cloak of Invisibility', '2014')).toBeUndefined(); // restored in 5.2.1; not in 5.1
    expect((await lookup('Cloak of Invisibility', '2014', { fallback: true }))?.edition).toBe('2024');
    expect(await lookup('no such rule at all')).toBeUndefined();
  });
  it('the type label follows the edition: 2014 races, 2024 species', async () => {
    expect((await lookup('Dwarf', '2014'))).toMatchObject({ type: 'species', label: 'Race' });
    expect((await lookup('Dwarf', '2024'))).toMatchObject({ type: 'species', label: 'Species' });
  });
  // Each term is answered by its own edition, never silently by the other.
  const BOTH: [string, string, string][] = [
    // [term, 2014 id, 2024 id]
    ['Grapple', 'rule:grappling', 'rule:grappling'],
    ['Grappling', 'rule:grappling', 'rule:grappling'],
    ['Shove', 'rule:shoving-a-creature', 'rule:unarmed-strike'],
    ['Advantage', 'rule:advantage-and-disadvantage', 'rule:advantage'],
    ['Disadvantage', 'rule:advantage-and-disadvantage', 'rule:disadvantage'],
    ['Reaction', 'rule:reactions', 'rule:reaction'],
    ['Reactions', 'rule:reactions', 'rule:reaction'],
    ['Cantrip', 'rule:cantrips', 'rule:cantrip'],
    ['Cantrips', 'rule:cantrips', 'rule:cantrip'],
    ['Ritual', 'rule:rituals', 'rule:ritual'],
    ['Attunement', 'rule:attunement', 'rule:attunement'],
    ['Passive Perception', 'rule:passive-checks', 'rule:passive-perception'],
    ['Vulnerability', 'rule:damage-resistance-and-vulnerability', 'rule:vulnerability'],
    ['Suffocation', 'rule:suffocating', 'rule:suffocation'],
    ['Suffocating', 'rule:suffocating', 'rule:suffocation'],
    ['Unarmed Strike', 'rule:melee-attacks', 'rule:unarmed-strike'],
    ['Hit Dice', 'rule:short-rest', 'rule:hit-point-dice'],
    ['Half Cover', 'rule:cover', 'rule:cover'],
    ['Three-Quarters Cover', 'rule:cover', 'rule:cover'],
    ['Inspiration', 'rule:inspiration', 'rule:heroic-inspiration'],
    ['Proficiency Bonus', 'rule:proficiency-bonus', 'rule:proficiency'],
    ['Plate', 'item:plate', 'item:plate-armor'],
    ['Plate Armor', 'item:plate', 'item:plate-armor'],
    ['Goblin', 'monster:goblin', 'monster:goblin-warrior'],
    ['Goblins', 'monster:goblin', 'monster:goblin-warrior'],
    ['Healing Potion', 'item:potion-of-healing', 'item:potion-of-healing'],
    ['+1 Weapon', 'item:weapon-1-2-or-3', 'item:weapon-1-2-or-3'],
    ['Spell Slot', 'rule:spell-slots', ''],
    ['Figurine of Wondrous Power', 'item:figurine-of-wondrous-power', 'item:figurine-of-wondrous-power'],
  ];
  for (const [term, id14, id24] of BOTH) {
    it(`'${term}' in each edition, no fallback`, async () => {
      expect((await lookup(term, '2014'))?.id ?? '', '2014').toBe(id14);
      expect((await lookup(term, '2014'))?.edition ?? '2014').toBe('2014');
      expect((await lookup(term, '2024'))?.id ?? '', '2024').toBe(id24);
      expect((await lookup(term, '2024'))?.edition ?? '2024').toBe('2024');
    });
  }
  it('terms with no counterpart in the 2014 rules find nothing there rather than the 2024 entry', async () => {
    for (const t of ['Bloodied', 'Influence', 'Study', 'Heroic Inspiration']) {
      const e = await lookup(t, '2014');
      expect(e === undefined || e.edition === '2014', t).toBe(true);
    }
  });
});

describe('the Rules edition preference', () => {
  it('defaults to 2024 and keeps 2014 when chosen', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      expect(rulesEdition()).toBe('2024');
      setRulesEdition('2014');
      expect(rulesEdition()).toBe('2014');
      expect(store.get('mistlab.rulesEdition')).toBe('2014');
    } finally { delete (globalThis as { localStorage?: unknown }).localStorage; }
  });
});

describe('terms in running text', () => {
  it('links rules terms, longest first, with their types', async () => {
    const t = await termIndex('2024');
    const s = findTerms('The ghoul is Prone and takes 2d6 fire damage; a Wolf casts Fireball. Opportunity Attacks and Hold Person.', t);
    expect(s.map((x) => [x.text, x.id])).toEqual([
      ['ghoul', 'monster:ghoul'], ['Prone', 'condition:prone'], ['fire', 'damage:fire'], ['Wolf', 'monster:wolf'], ['Fireball', 'spell:fireball'],
      ['Opportunity Attacks', 'rule:opportunity-attacks'], ['Hold Person', 'spell:hold-person'],
    ]);
  });
  it('ordinary English words link only when tagged, capitalised mid-sentence, or followed by their cue word', async () => {
    const t = await termIndex('2024');
    for (const w of ['light', 'shield', 'command', 'guidance', 'fly', 'prone']) expect(t.common, w).toContain(w);
    expect(findTerms('the light of the moon, a shield, a command to fly, some guidance; prone to anger', t)).toEqual([]);
    expect(findTerms('Light the way.', t)).toEqual([]); // sentence start
    expect(findTerms('She casts Light on it.', t).map((x) => x.id)).toEqual(['spell:light']);
    expect(findTerms('knocked prone condition', t).map((x) => x.id)).toEqual(['condition:prone']);
    expect(findTerms('the light cantrip', t).map((x) => x.id)).toEqual(['spell:light']);
    const tagged = findTerms('Cast [[spell:shield]] or [[Command|the command spell]].', t);
    expect(tagged.map((x) => [x.id, x.text, x.explicit])).toEqual([['spell:shield', 'shield', true], ['spell:command', 'the command spell', true]]);
  });
  it('possessives link the name only', async () => {
    const s = findTerms("The Vampire's bite.", await termIndex('2024'));
    expect(s.map((x) => [x.text, x.id, x.start, x.end])).toEqual([['Vampire', 'monster:vampire', 4, 11]]);
  });
  it('price-list words and inflected common words are not linked in prose', async () => {
    const t24 = await termIndex('2024'), t14 = await termIndex('2014');
    const prose = 'The village is Poor, and in the Modest inn the Wealthy merchant hides two nets and a mule.';
    expect(findTerms(prose, t24)).toEqual([]);
    expect(findTerms(prose, t14)).toEqual([]);
    for (const w of ['hides', 'nets', 'net', 'mule', 'cat', 'deer']) expect([...t14.common, ...t24.common], w).toContain(w);
  });
  it('2014 terms come from the 2014 book', async () => {
    const t = await termIndex('2014');
    expect(t.edition).toBe('2014');
    expect(findTerms('An Ogre has AC 11.', t).map((x) => x.id)).toEqual(['monster:ogre', 'rule:armor-class']);
  });
});
