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
    ['Spell Slot', 'rule:spell-slots', 'rule:spell-slots'],
    ['Figurine of Wondrous Power', 'item:figurine-of-wondrous-power', 'item:figurine-of-wondrous-power'],
    // Rules that share a name with another section: the combat rule answers (2014 has no glossary to settle it).
    ['Hit Points', 'rule:hit-points', 'rule:hit-points'],
    ['HP', 'rule:hit-points', 'rule:hit-points'],
    ['Difficult Terrain', 'rule:difficult-terrain', 'rule:difficult-terrain'],
    ['Initiative', 'rule:initiative', 'rule:initiative'],
    ['AC', 'rule:armor-class', 'rule:armor-class'],
    ['Tremorsense', 'rule:tremorsense', 'rule:tremorsense'],
    ['Heavily Obscured', 'rule:heavily-obscured', 'rule:heavily-obscured'],
    // Class features, the 2014 ones with parts of their own included.
    ['Wild Shape', 'feature:wild-shape', 'feature:wild-shape'],
    ['Metamagic', 'feature:metamagic', 'feature:metamagic'],
    ['Fighting Style', 'feature:fighting-style', 'feature:fighting-style'],
    ['Font of Magic', 'feature:font-of-magic', 'feature:font-of-magic'],
    ['Channel Divinity', 'feature:channel-divinity', 'feature:channel-divinity'],
    ['Ki', 'feature:ki', 'feature:monks-focus'],
    ['Pact Boon', 'feature:pact-boon', ''],
    // Tools are items in both books.
    ["Thieves' Tools", 'item:thieves-tools', 'item:thieves-tools'],
    ['Herbalism Kit', 'item:herbalism-kit', 'item:herbalism-kit'],
    ['Disguise Kit', 'item:disguise-kit', 'item:disguise-kit'],
    ["Poisoner's Kit", 'item:poisoners-kit', 'item:poisoners-kit'],
    ["Smith's Tools", 'item:smiths-tools', 'item:smiths-tools'],
    ['Lute', 'item:lute', 'item:musical-instrument'],
    ['Playing Cards', 'item:playing-card-set', 'item:gaming-set'],
    // A thing whose kinds are table rows is an item of its own; a bare kind ('Wand', 'Orb') is not a name.
    ['Holy Symbol', 'item:holy-symbol', 'item:holy-symbol'],
    ['Arcane Focus', 'item:arcane-focus', 'item:arcane-focus'],
    ['Druidic Focus', 'item:druidic-focus', 'item:druidic-focus'],
    ['Gaming Set', 'item:gaming-set', 'item:gaming-set'],
    ['Musical Instrument', 'item:musical-instrument', 'item:musical-instrument'],
    ['Sprig of Mistletoe', 'item:druidic-focus-sprig-of-mistletoe', 'item:druidic-focus-sprig-of-mistletoe'],
    ['Wand', '', ''],
    ['Orb', '', ''],
    ['Amulet', '', ''],
    ['Inn Stay', 'item:inn-stay', 'item:inn-stay'],
    ['Meal', 'item:meals', 'item:meal'],
    ['Saddle', 'item:saddle', ''],
    // Kinds named in an item's own table, and magic weapons and armour by their kind.
    ['Potion of Greater Healing', 'item:potion-of-healing', 'item:potions-of-healing'],
    ['potion of supreme healing', 'item:potion-of-healing', 'item:potions-of-healing'],
    ['+1 Mace', 'item:weapon-1-2-or-3', 'item:weapon-1-2-or-3'],
    ['Longsword +2', 'item:weapon-1-2-or-3', 'item:weapon-1-2-or-3'],
    ['+3 Plate Armor', 'item:armor-1-2-or-3', 'item:armor-1-2-or-3'],
    ['+1 Shield', 'item:shield-1-2-or-3', 'item:shield-1-2-or-3'],
    // Checks as modules write them.
    ['Wisdom (Perception)', 'skill:perception', 'skill:perception'],
    ['Dexterity (Stealth) check', 'skill:stealth', 'skill:stealth'],
    ['Strength (Athletics)', 'skill:athletics', 'skill:athletics'],
    // Channel Divinity's options by their own names.
    ['Turn Undead', 'feature:channel-divinity-turn-undead', 'feature:turn-undead'],
    ['Preserve Life', 'feature:channel-divinity-preserve-life', 'feature:preserve-life'],
    ['Sacred Weapon', 'feature:sacred-weapon', 'feature:sacred-weapon'],
    // The parts of a stat block, from the monsters' introduction (neither SRD has Lair Actions in 2024 or a general
    // Legendary Resistance rule: each stat block states its own).
    ['Multiattack', 'rule:multiattack', 'rule:multiattack'],
    ['Legendary Actions', 'rule:legendary-actions', 'rule:legendary-actions'],
    ['Lair Actions', 'rule:lair-actions', ''],
    ['Legendary Resistance', '', ''],
    // A '+1, +2, or +3' item by its own name.
    ['Wand of the War Mage', 'item:wand-of-the-war-mage-1-2-or-3', 'item:wand-of-the-war-mage-1-2-or-3'],
    ['+2 Wand of the War Mage', 'item:wand-of-the-war-mage-1-2-or-3', 'item:wand-of-the-war-mage-1-2-or-3'],
    // Creatures the 2024 rules renamed, by their 2014 names (the names Curse of Strahd uses).
    ['Thug', 'monster:thug', 'monster:tough'],
    ['Thugs', 'monster:thug', 'monster:tough'],
    ['Veteran', 'monster:veteran', 'monster:warrior-veteran'],
    ['Cult Fanatic', 'monster:cult-fanatic', 'monster:cultist-fanatic'],
    ['Acolyte', 'monster:acolyte', 'monster:priest-acolyte'],
    ['Kobold', 'monster:kobold', 'monster:kobold-warrior'],
    ['Flying Sword', 'monster:flying-sword', 'monster:animated-flying-sword'],
    ['Poisonous Snake', 'monster:poisonous-snake', 'monster:venomous-snake'],
    ['Grimlock', 'monster:grimlock', 'monster:grimlock'],
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

describe('lookup answers with the right section', () => {
  it('2014 rules that share a name answer with the combat rule, not the ability paragraph', async () => {
    expect((await lookup('Hit Points', '2014'))!.text).toMatch(/^Hit points represent a combination of physical and mental durability/);
    expect((await lookup('Difficult Terrain', '2014'))!.html).toContain('Every foot of movement in difficult terrain costs 1 extra foot');
    expect((await lookup('Initiative', '2014'))!.text).toMatch(/^Initiative determines the order of turns during combat/);
    expect((await lookup('AC', '2014'))!.text).toBe('Armor protects its wearer from attacks. The armor (and shield) you wear determines your base Armor Class.');
    expect((await lookup('Channel Divinity', '2014'))!.summary).toEqual({ className: 'Cleric' });
  });
  it('2014 class features with parts: the feature and each part, the part naming its feature (not a subclass)', async () => {
    for (const f of ['Wild Shape', 'Ki', 'Metamagic', 'Fighting Style', 'Font of Magic', 'Pact Boon']) expect((await lookup(f, '2014'))?.type, f).toBe('feature');
    expect((await lookup('Wild Shape', '2014'))!.html).toContain('Beast Shapes');
    expect((await lookup('Beast Shapes', '2014'))!.summary).toEqual({ className: 'Druid', feature: 'Wild Shape' });
    expect((await lookup('Twinned Spell', '2014'))!.summary).toEqual({ className: 'Sorcerer', feature: 'Metamagic' });
    expect((await lookup('Flurry of Blows', '2014'))!.summary).toEqual({ className: 'Monk', feature: 'Ki' });
    expect((await lookup('Archery', '2014'))!.summary).toEqual({ className: 'Fighter', feature: 'Fighting Style' });
    // Real subclasses keep their name; nothing names a class feature as its subclass.
    expect((await lookup('Frenzy', '2014'))!.summary).toEqual({ className: 'Barbarian', subclass: 'Path of the Berserker' });
    const char = JSON.parse(readFileSync('app/public/books/srd-5.1/e/character.json', 'utf8')) as { entries: Record<string, { type: string; s: { subclass?: string } }> };
    const subs = new Set(Object.values(char.entries).flatMap((e) => (e.type === 'feature' && e.s.subclass ? [e.s.subclass] : [])));
    expect([...subs].sort()).toEqual(['Champion', 'Circle of the Land', 'College of Lore', 'Draconic Bloodline', 'Hunter', 'Life Domain', 'Oath of Devotion', 'Path of the Berserker', 'School of Evocation', 'The Fiend', 'Thief', 'Way of the Open Hand']);
  });
  it('a 2024 tool card has its ability, Utilize and Craft', async () => {
    const e = (await lookup("thieves' tools", '2024'))!;
    expect(e).toMatchObject({ type: 'item', edition: '2024', section: { href: '#book/srd-5.2.1/item-thieves-tools' } });
    expect(e.summary).toMatchObject({ category: 'Tool', ability: 'Dexterity', cost: '25 GP' });
    expect((await lookup('Herbalism Kit', '2024'))!.summary).toMatchObject({ craft: "Antitoxin, Candle, Healer's Kit, Potion of Healing" });
  });
  it('running-text spellings: quotes, possessives, articles and cue words', async () => {
    expect((await lookup('the prone condition'))!.id).toBe('condition:prone');
    expect((await lookup('“Prone.”'))!.id).toBe('condition:prone');
    expect((await lookup("the wolf's"))!.id).toBe('monster:wolf');
    expect((await lookup('Strength saving throw'))!.id).toBe('ability:strength');
    expect((await lookup('undead creature'))!.id).toBe('creature-type:undead');
    expect((await lookup('Shield', '2024', { type: 'item' }))!.id).toBe('item:shield');
  });
  it('every short text is filled: conditions, races, monsters and gear', async () => {
    expect((await lookup('Prone', '2014'))!.text).not.toBe('');
    expect((await lookup('Elf', '2014'))!.text).toMatch(/elf/i);
    expect((await lookup('Wolf', '2014'))!.text).toBe('Medium beast, unaligned. AC 13 (natural armor), HP 11 (2d8 + 2), Speed 40 ft. CR 1/4 (XP 50).');
    expect((await lookup('Saddle, Military', '2014'))!.text).toBe('Mount or vehicle (Saddles): Cost 20 gp, 30 lb.');
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
    // (A lower-case 'ghoul' is a creature the books' prose names in passing, so it needs a capital, a tag or a cue.)
    const s = findTerms('A Ghoul is Prone and takes 2d6 fire damage; a Wolf casts Fireball. Opportunity Attacks and Hold Person.', t);
    expect(findTerms('the ghoul', t)).toEqual([]);
    expect(s.map((x) => [x.text, x.id])).toEqual([
      ['Ghoul', 'monster:ghoul'], ['Prone', 'condition:prone'], ['fire', 'damage:fire'], ['Wolf', 'monster:wolf'], ['Fireball', 'spell:fireball'],
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
  it('each span says whether its form is an ordinary word and why it counts (common, via)', async () => {
    const t = await termIndex('2024');
    const s = findTerms('A Ghoul casts Fireball; the light cantrip; knocked prone; a short rest and [[spell:shield]].', t);
    expect(s.map((x) => [x.text, x.common, x.via])).toEqual([
      ['Ghoul', true, 'capital'], ['Fireball', false, 'lead'], ['light', true, 'cue'], ['prone', true, 'lead'], ['short rest', false, 'name'], ['shield', false, 'tag'],
    ]);
    expect(findTerms('Opportunity Attacks and Hold Person.', t).map((x) => [x.common, x.via])).toEqual([[false, 'name'], [false, 'name']]);
    expect(findTerms('Until this grapple ends, the target is restrained.', t, { statBlock: true }).map((x) => [x.text, x.via])).toEqual([['restrained', 'statblock']]);
    expect(findTerms('Wisdom (Perception)', t)[0]).toMatchObject({ common: false, via: 'name' });
    // keepCommon hands back the ordinary words a stricter caller guards itself, flagged and with via 'name'.
    expect(findTerms('the ghoul', t)).toEqual([]);
    expect(findTerms('the ghoul', t, { keepCommon: true }).map((x) => [x.text, x.common, x.via])).toEqual([['ghoul', true, 'name']]);
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
  it('2014 gear: no junk names to link, one-word gear only as a name, a capitalised word inside a longer name stays plain', async () => {
    const t14 = await termIndex('2014'), t24 = await termIndex('2024');
    const prose = 'The military escort rode out with a pack of wolves in the riding season; exotic feed was cheap, and a hammer and leather were sold.';
    expect(findTerms(prose, t14).map((x) => x.id)).toEqual([]); // 'wolf' is an ordinary word too
    expect(findTerms(prose, t24).map((x) => x.id)).toEqual([]);
    const caps = 'The Military escort rode out with a Pack of wolves in the Riding season, and an Exotic Feed seller sold an Exotic Saddle.';
    expect(findTerms(caps, t14).map((x) => [x.text, x.id])).toEqual([['Exotic Saddle', 'item:saddle-exotic']]);
    for (const w of ['hammer', 'leather', 'feed', 'saddle', 'rope', 'torch']) expect(t14.common, w).toContain(w);
    // The 2024 rules' capitalised names still link mid-sentence.
    expect(findTerms('She lights a Torch and casts Light.', t24).map((x) => x.id)).toEqual(['item:torch', 'spell:light']);
  });
  // The same sentence links the same way in both editions.
  const SAME: [string, [string, string][]][] = [
    ['The blight spreads across the vines.', []],
    ['The Druid of the grove watches. The druid speaks.', [['Druid', 'monster:druid']]],
    ['A veteran soldier and a scout guard the gate.', []],
    ['The thugs and the thug wait.', []],
    ['He keeps a Wand on his belt and an Orb on the shelf.', []],
    ['The Military escort rode out with a Pack of wolves in the Riding season; Exotic Feed was cheap.', []],
    ['The cleric casts blight on the tree.', [['blight', 'spell:blight']]],
    ['Make a DC 15 Wisdom (Perception) check or a DC 12 Strength (Athletics) check.', [['Wisdom (Perception)', 'skill:perception'], ['Strength (Athletics)', 'skill:athletics']]],
    ['Each creature must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute.', [['Constitution', 'ability:constitution'], ['poisoned', 'condition:poisoned']]],
    ['On a failed save, the target is knocked prone.', [['prone', 'condition:prone']]],
    ['The target is poisoned until it finishes a rest.', []],
    ['The hag offers a +1 mace and an Inn stay.', [['+1 mace', 'item:weapon-1-2-or-3'], ['Inn stay', 'item:inn-stay']]],
    ['She lifts the Holy Symbol high.', [['Holy Symbol', 'item:holy-symbol']]],
    ['You have darkvision and can take a short rest in dim light behind half cover with holy water.', [['darkvision', 'rule:darkvision'], ['short rest', 'rule:short-rest'], ['half cover', 'rule:cover'], ['holy water', 'item:holy-water']]],
  ];
  for (const [text, want] of SAME) {
    it(`both editions: ${text}`, async () => {
      for (const ed of ['2014', '2024'] as const) {
        // Leave out the 'DC' links (the 2024 rule, the 2014 table of typical DCs), 'saving throw' and 'dim light'.
        const got = findTerms(text, await termIndex(ed)).filter((x) => !['rule:difficulty-class', 'rule:typical-difficulty-classes', 'rule:saving-throw', 'rule:saving-throws', 'rule:dim-light', 'rule:vision-and-light'].includes(x.id));
        expect(got.map((x) => [x.text, x.id]), ed).toEqual(want);
      }
    });
  }
  it('the ordinary words of the plan are common in both books, with their plurals', async () => {
    for (const ed of ['2014', '2024'] as const) {
      const c = new Set((await termIndex(ed)).common);
      for (const w of ['blight', 'druid', 'gate', 'shadow', 'veteran', 'veterans', 'scout', 'soldier', 'guard', 'thug', 'thugs', 'acolyte', 'wolf', 'wolves']) {
        if ((await termIndex(ed)).forms[w]) expect(c.has(w), `${ed} ${w}`).toBe(true);
      }
      for (const w of ['darkvision', 'short rest', 'long rest', 'dim light', 'half cover', 'holy water', "thieves' tools"]) expect(c.has(w), `${ed} ${w}`).toBe(false);
    }
  });
  it('2014 terms come from the 2014 book', async () => {
    const t = await termIndex('2014');
    expect(t.edition).toBe('2014');
    expect(findTerms('An Ogre has AC 11.', t).map((x) => x.id)).toEqual(['monster:ogre', 'rule:armor-class']);
  });
});

describe('lookup and the matcher: one rule per name, its own text', () => {
  const ids = async (text: string, ed: '2014' | '2024', o: { statBlock?: boolean } = {}) => findTerms(text, await termIndex(ed), o).map((x) => [x.text, x.id]);
  it("'bonus action' is the combat rule in both editions; the 2014 casting-time note keeps its id", async () => {
    expect((await lookup('bonus action', '2014'))!.id).toBe('rule:bonus-actions');
    expect((await lookup('Bonus Actions', '2014'))!.id).toBe('rule:bonus-actions');
    expect((await lookup('bonus action', '2014'))!.text).toMatch(/^Various class features, spells, and other abilities let you take an additional action/);
    expect((await lookup('rule:bonus-action', '2014'))!.text).toMatch(/^A spell cast with a bonus action/);
    expect((await lookup('bonus action', '2024'))!.id).toBe('rule:bonus-action');
    for (const ed of ['2014', '2024'] as const) {
      const want = ed === '2014' ? 'rule:bonus-actions' : 'rule:bonus-action';
      expect(await ids('As a bonus action, it can take the Dash action.', ed), ed).toContainEqual(['bonus action', want]);
      expect(await ids('You can use a bonus action to make one attack with the offhand weapon.', ed), ed).toContainEqual(['bonus action', want]);
    }
  });
  it('2014 light and obscurement terms answer with their own paragraph', async () => {
    for (const [q, id] of [['dim light', 'rule:dim-light'], ['bright light', 'rule:bright-light'], ['lightly obscured', 'rule:lightly-obscured'], ['heavily obscured', 'rule:heavily-obscured']]) {
      const e = await lookup(q, '2014');
      expect(e!.id, q).toBe(id);
      expect(e!.text.toLowerCase(), q).toContain(q);
      expect((await lookup(q, '2024'))!.id, q).toBe(id); // the same ids as the 2024 glossary
    }
    expect((await lookup('Darkness', '2014', { type: 'rule' }))!.text).toMatch(/^Darkness creates a heavily obscured area/);
    expect((await lookup('Vision and Light', '2014'))!.text).toMatch(/^The most fundamental tasks of adventuring — noticing danger/);
    expect(await ids('The hall is in dim light.', '2014')).toEqual([['dim light', 'rule:dim-light']]);
  });
  it('a 2014 table title answers with its table, not the paragraph after it', async () => {
    expect((await lookup('Object Armor Class', '2014'))!.text).toMatch(/^Substance: AC\. Cloth, paper, rope: 11; /);
    expect((await lookup('Object Hit Points', '2014'))!.text).toMatch(/^Tiny \(bottle, lock\): Fragile 2 \(1d4\), Resilient 5 \(2d4\);/);
    expect((await lookup('Typical Difficulty Classes', '2014'))!.text).toMatch(/^Task Difficulty: DC\. Very easy: 5; Easy: 10;/);
    const css = await lookup('Creating Spell Slots', '2014');
    expect(css!.text).toBe('Spell Slot Level: Sorcery Point Cost. 1st: 2; 2nd: 3; 3rd: 5; 4th: 6; 5th: 7.');
    expect(css!.html).not.toContain('Converting');
    expect((await lookup('Beast Shapes', '2014'))!.text).toMatch(/^2nd: Max\. CR 1\/4, Limitations No flying or swimming speed, Example Wolf;/);
  });
  it("'DC' and 'Difficulty Class' answer in both editions", async () => {
    expect((await lookup('DC', '2014'))!.id).toBe('rule:typical-difficulty-classes');
    expect((await lookup('Difficulty Class', '2014'))!.id).toBe('rule:typical-difficulty-classes');
    expect((await lookup('DC', '2024'))!.id).toBe('rule:difficulty-class');
    expect(await ids('The DC for this check is 15.', '2014')).toEqual([['DC', 'rule:typical-difficulty-classes']]);
  });
  it('2024 answers the rules sections it has outside the glossary', async () => {
    for (const q of ['Mounted Combat', 'Underwater Combat', 'Spell Slots', 'Spell Slot', 'Components', 'Vision and Light', 'Resting']) {
      const e = await lookup(q, '2024', { fallback: false });
      expect(e?.edition, q).toBe('2024');
      expect(e!.type, q).toBe('rule');
      expect(await lookup(q, '2014'), q).toBeDefined();
    }
    // A section the glossary already names stays the glossary's.
    expect((await lookup('Critical Hits', '2024'))!.id).toBe('rule:critical-hit');
  });
  it('names with a slash link in running text', async () => {
    for (const ed of ['2014', '2024'] as const) {
      expect((await ids('Cast Enlarge/Reduce on the ogre.', ed)).filter(([, id]) => id.startsWith('spell:')), ed).toEqual([['Enlarge/Reduce', 'spell:enlarge-reduce']]);
      expect((await ids("Hunter's Mark and Enlarge/Reduce are on the list.", ed)).map(([, id]) => id), ed).toEqual(['spell:hunters-mark', 'spell:enlarge-reduce']);
      expect((await ids('The wizard casts antipathy/sympathy, then misty step.', ed)).map(([, id]) => id), ed).toEqual(['spell:antipathy-sympathy', 'spell:misty-step']);
      expect(await ids('Roll 1d6/2 and/or reroll.', ed), ed).toEqual([]);
    }
  });
  it('conditions in stat-block hit text', async () => {
    const hit = 'On a hit, the target is grappled (escape DC 13). Until this grapple ends, the target is restrained.';
    for (const ed of ['2014', '2024'] as const) {
      const c = async (text: string, o: { statBlock?: boolean } = {}) => (await ids(text, ed, o)).filter(([, id]) => id.startsWith('condition:'));
      expect(await c(hit, { statBlock: true }), ed).toEqual([['grappled', 'condition:grappled'], ['restrained', 'condition:restrained']]);
      expect(await c(hit), ed).toEqual([['grappled', 'condition:grappled']]); // outside a stat block only the DC cue counts
      expect(await c("The wolf knocks the target prone; a frightened creature can't move closer."), ed).toEqual([['prone', 'condition:prone']]);
      expect(await c('The target is charmed by the hag.'), ed).toEqual([]);
    }
  });
  it('a group answers its plural; armour answers without "Armor"', async () => {
    expect((await lookup('inn stays', '2014'))!.id).toBe('item:inn-stay');
    expect((await lookup('inn stays', '2024'))!.id).toBe('item:inn-stay');
    expect((await lookup('meals', '2024'))!.id).toBe('item:meal');
    expect((await lookup('Studded Leather', '2024'))!.id).toBe('item:studded-leather-armor');
    expect((await lookup('Studded Leather', '2014'))!.id).toBe('item:studded-leather');
  });
  it("a capitalised word after 'of' in a name is the name", async () => {
    for (const ed of ['2014', '2024'] as const) {
      expect(await ids('She opened the Book of Shadows and read from the Order of the Gauntlet.', ed), ed).toEqual([]);
    }
  });
});
