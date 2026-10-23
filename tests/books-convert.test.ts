// The rules books converter (scripts/books) and the data it wrote to app/public/books (SRD 5.1 and 5.2.1, CC-BY-4.0).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inline, parseBlocks, renderBlocks, repairSplitWords } from '../scripts/books/md';
import { compareSpellLists, parseSpellLists, type SpellLists } from '../scripts/books/spelllists';
import type { BookId, BookIndex, Catalog, EntryFile, MonsterSummary, PageFile, SpellSummary, ItemSummary, ConditionSummary } from '../app/src/books/types';

const DIR = 'app/public/books';
const read = <T>(p: string): T => JSON.parse(readFileSync(`${DIR}/${p}`, 'utf8')) as T;
const index = (b: BookId) => read<BookIndex>(`${b}/index.json`);
const entries = (b: BookId, f: string) => read<EntryFile>(`${b}/e/${f}.json`).entries;

describe('markdown reader', () => {
  it('turns pipe tables into real tables, numbers centred', () => {
    const html = renderBlocks(parseBlocks('| Armor | Cost | AC |\n|---|---|---|\n| Leather | 10 gp | 11 |\n| Chain mail | 75 gp | 16 |\n'));
    expect(html).toBe('<div class="tbl"><table><thead><tr><th>Armor</th><th class="n">Cost</th><th class="n">AC</th></tr></thead><tbody><tr><td>Leather</td><td class="n">10 gp</td><td class="n">11</td></tr><tr><td>Chain mail</td><td class="n">75 gp</td><td class="n">16</td></tr></tbody></table></div>');
  });
  it('keeps headings, nested lists, emphasis, links and escapes', () => {
    const b = parseBlocks('### Prone \\[Condition\\]\n\n- one\n    - two\n- three\n\n_**Attacks Affected.**_ You have **Disadvantage** on [rolls](https://example.org).');
    expect(b.map((x) => x.k)).toEqual(['h', 'ul', 'p']);
    expect(renderBlocks(b)).toContain('<h3>Prone [Condition]</h3>');
    expect(renderBlocks(b)).toContain('<ul><li>one<ul><li>two</li></ul></li><li>three</li></ul>');
    expect(inline('_**Attacks Affected.**_ <b> & "x"')).toBe('<em><strong>Attacks Affected.</strong></em> &lt;b&gt; &amp; &quot;x&quot;');
  });
});

describe('books: chapters in order', () => {
  it('SRD 5.2.1 has its thirteen chapters plus Animals, in the order of the PDF', () => {
    expect(index('srd-5.2.1').chapters.map((c) => c.title)).toEqual([
      'Legal Information', 'Playing the Game', 'Character Creation', 'Classes', 'Character Origins', 'Feats', 'Equipment', 'Spells',
      'Rules Glossary', 'Gameplay Toolbox', 'Magic Items', 'Monsters', 'Monsters A-Z', 'Animals',
    ]);
  });
  it('SRD 5.1 has every part of the PDF, in order', () => {
    expect(index('srd-5.1').chapters.map((c) => c.title)).toEqual([
      'Legal Information', 'Races', 'Classes', 'Character Options', 'Equipment', 'Feats', 'Using Ability Scores', 'Adventuring', 'Combat',
      'Spellcasting', 'Spell Descriptions', 'Traps, Diseases, Madness, Objects and Poisons', 'Magic Items', 'Monsters',
      'Appendix PH-A: Conditions', 'Appendix PH-B: Fantasy-Historical Pantheons', 'Appendix PH-C: The Planes of Existence',
      'Appendix MM-A: Miscellaneous Creatures', 'Appendix MM-B: Nonplayer Characters',
    ]);
  });
  for (const b of ['srd-5.1', 'srd-5.2.1'] as BookId[]) {
    it(`${b}: every section's anchor is on the page the index names, and pages follow their chapters`, () => {
      const ix = index(b);
      const pages = ix.pages.map((p) => read<PageFile>(`${b}/p/${p.id}.json`));
      let lastChapter = 0;
      ix.pages.forEach((p) => { expect(p.chapter).toBeGreaterThanOrEqual(lastChapter); lastChapter = p.chapter; });
      const missing = ix.sections.filter(([anchor, , , page]) => !pages[page].html.includes(`id="${anchor}"`)).map((s) => s[0]);
      expect(missing).toEqual([]);
      expect(new Set(ix.sections.map((s) => s[0])).size).toBe(ix.sections.length); // anchors are unique
      for (const c of ix.chapters) expect(ix.sections.some((s) => s[0] === c.id && s[2] === 1)).toBe(true);
    });
  }
  it('the catalog lists both books with their edition labels, sizes and files', () => {
    const cat = read<Catalog>('catalog.json');
    expect(cat.books.map((b) => [b.id, b.editionLabel])).toEqual([['srd-5.2.1', '2024 rules · SRD 5.2.1'], ['srd-5.1', '2014 rules · SRD 5.1']]);
    for (const b of cat.books) { expect(b.files).toContain('index.json'); expect(b.bytes).toBeGreaterThan(1_000_000); for (const f of b.files) expect(existsSync(`${DIR}/${b.id}/${f}`)).toBe(true); }
  });
});

describe('books: entries', () => {
  const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
  for (const b of ['srd-5.1', 'srd-5.2.1'] as BookId[]) {
    it(`${b}: the conditions list is complete, each with its effects`, () => {
      const cs = Object.values(entries(b, 'rules')).filter((e) => e.type === 'condition');
      expect(cs.map((c) => c.name).sort()).toEqual(CONDITIONS);
      for (const c of cs) expect((c.s as ConditionSummary).effects.length, c.name).toBeGreaterThan(0);
    });
    it(`${b}: counts of spells, monsters, items and rules`, () => {
      const n = (f: string, t: string) => Object.values(entries(b, f)).filter((e) => e.type === t).length;
      expect(n('spells', 'spell')).toBe(b === 'srd-5.1' ? 319 : 339);
      expect(n('monsters', 'monster')).toBeGreaterThanOrEqual(b === 'srd-5.1' ? 315 : 330);
      expect(n('items', 'item')).toBeGreaterThan(400);
      expect(n('rules', 'damage')).toBe(13); expect(n('rules', 'skill')).toBe(18); expect(n('rules', 'ability')).toBe(6); expect(n('rules', 'creature-type')).toBe(14);
    });
  }
  it('Fireball in both editions, with every spell field', () => {
    const f24 = entries('srd-5.2.1', 'spells')['spell:fireball'], f14 = entries('srd-5.1', 'spells')['spell:fireball'];
    expect(f24.s).toEqual({ level: 3, school: 'Evocation', castingTime: 'Action', range: '150 feet', components: 'V, S, M', material: 'a ball of bat guano and sulfur', duration: 'Instantaneous', concentration: false, ritual: false, classes: ['Sorcerer', 'Wizard'] } satisfies SpellSummary);
    expect(f14.s).toMatchObject({ level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet', components: 'V, S, M', concentration: false, ritual: false, classes: ['Sorcerer', 'Wizard'] });
    expect(f24.anchor).toBe('spell-fireball');
    expect(f24.html).toContain('8d6 Fire damage');
  });
  it('concentration and ritual spells', () => {
    const s = entries('srd-5.2.1', 'spells');
    expect((s['spell:bless'].s as SpellSummary).concentration).toBe(true);
    expect((s['spell:detect-magic'].s as SpellSummary)).toMatchObject({ ritual: true, concentration: true, level: 1 });
    expect((s['spell:light'].s as SpellSummary).level).toBe(0);
    expect((entries('srd-5.1', 'spells')['spell:alarm'].s as SpellSummary).ritual).toBe(true);
  });
  it('the Wolf and the Vampire with full stat blocks in both editions', () => {
    const w24 = entries('srd-5.2.1', 'monsters')['monster:wolf'].s as MonsterSummary;
    expect(w24).toMatchObject({ size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, hp: 11, hpDice: '2d8 + 2', speed: '40 ft.', cr: '1/4', xp: 50, pb: '+2', initiative: '+2 (12)', abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 }, skills: 'Perception +5, Stealth +4' });
    const w14 = entries('srd-5.1', 'monsters')['monster:wolf'].s as MonsterSummary;
    expect(w14).toMatchObject({ size: 'Medium', creatureType: 'beast', ac: 13, acNote: 'natural armor', hp: 11, cr: '1/4', xp: 50, abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } });
    for (const b of ['srd-5.1', 'srd-5.2.1'] as BookId[]) {
      const v = entries(b, 'monsters')['monster:vampire'];
      expect(v, b).toBeTruthy();
      expect((v.s as MonsterSummary).cr).toBe('13');
      expect(v.html).toContain('<table class="abil">');
    }
  });
  it('items: weapons and armour from the tables, magic items with rarity and attunement', () => {
    const i24 = entries('srd-5.2.1', 'items'), i14 = entries('srd-5.1', 'items');
    expect(i24['item:longsword'].s).toMatchObject({ category: 'Weapon', magic: false, cost: '15 GP', weight: '3 lb.', damage: '1d8 Slashing', properties: 'Versatile (1d10)', mastery: 'Sap' } satisfies Partial<ItemSummary>);
    expect(i14['item:chain-mail'].s).toMatchObject({ category: 'Armor', cost: '75 gp', ac: '16', strength: 'Str 13', stealth: 'Disadvantage' });
    expect(i24['item:bag-of-holding'].s).toMatchObject({ category: 'Wondrous Item', magic: true, rarity: 'Uncommon' });
    expect(i24['item:cloak-of-invisibility'], 'restored in 5.2.1').toBeTruthy();
    expect((i14['item:holy-avenger'].s as ItemSummary).attunement).toBe('by a paladin');
  });
  it('glossary tags type the 2024 rules (actions, areas of effect, hazards)', () => {
    const r = entries('srd-5.2.1', 'rules');
    expect(r['rule:dash'].s).toEqual({ tag: 'Action' });
    expect(r['rule:sphere'].s).toEqual({ tag: 'Area of Effect' });
    expect(r['rule:falling'].s).toEqual({ tag: 'Hazard' });
    expect(r['rule:opportunity-attacks']).toBeTruthy();
    expect(entries('srd-5.1', 'rules')['rule:dash'].s).toEqual({ tag: 'Action' });
  });
  it('feats, classes and their features, species and backgrounds', () => {
    const c24 = entries('srd-5.2.1', 'character'), c14 = entries('srd-5.1', 'character');
    expect(c24['feat:grappler'].s).toMatchObject({ category: 'General' });
    expect(c14['feat:grappler'].s).toMatchObject({ prerequisite: 'Strength 13 or higher' });
    expect(c24['class:wizard'].s).toMatchObject({ hitDie: 'D6 per Wizard level' });
    expect(Object.values(c24).find((e) => e.type === 'feature' && e.name === 'Rage')?.s).toMatchObject({ className: 'Barbarian', level: 1 });
    expect(Object.values(c14).some((e) => e.type === 'feature' && e.name === 'Sneak Attack')).toBe(true);
    expect(c24['species:dwarf'] && c14['species:dwarf'] && c24['background:acolyte'] && c14['background:acolyte']).toBeTruthy();
  });
});

const BOOKS: BookId[] = ['srd-5.1', 'srd-5.2.1'];
const pagesHtml = (b: BookId) => index(b).pages.map((p) => read<PageFile>(`${b}/p/${p.id}.json`).html).join('\n');
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

describe('books: fidelity to the printed PDF', () => {
  for (const b of BOOKS) {
    it(`${b}: every table rolled on NdX runs up to N×X (00 counts as 100)`, () => {
      const bad: string[] = [];
      for (const t of pagesHtml(b).match(/<table>[\s\S]*?<\/table>/g) ?? []) {
        const th = /<thead><tr><th[^>]*>(\d+)d(\d+)<\/th>/.exec(t);
        if (!th) continue;
        const want = +th[1] * +th[2];
        const firsts = [...t.matchAll(/<tr><t[dh][^>]*>([^<]*)<\/t[dh]>/g)].slice(1).map((m) => m[1].trim());
        const nums = firsts.flatMap((c) => c.split(/[-–]/)).map((x) => (x === '00' ? 100 : Number(x))).filter((x) => Number.isFinite(x));
        if (nums.length && Math.max(...nums) !== want) bad.push(`${th[1]}d${th[2]}: largest roll ${Math.max(...nums)} (${firsts.slice(0, 3).join(', ')} …)`);
      }
      expect(bad).toEqual([]);
    });
    it(`${b}: no stat block lists an action under Traits`, () => {
      const bad = Object.values(entries(b, 'monsters')).filter((e) => {
        const traits = /<h\d>Traits<\/h\d>([\s\S]*?)(?=<h\d>|$)/.exec(e.html)?.[1] ?? '';
        return /<strong>Multiattack|Attack Roll:|Weapon Attack:/.test(traits);
      }).map((e) => e.name);
      expect(bad).toEqual([]);
    });
    it(`${b}: every magic item in the A–Z is an item entry`, () => {
      const ix = index(b);
      const at = ix.sections.findIndex((s) => s[1] === 'Magic Items A-Z');
      const lv = ix.sections[at][2];
      const kids: string[] = [];
      for (let i = at + 1; i < ix.sections.length && ix.sections[i][2] > lv; i++) if (ix.sections[i][2] === lv + 1 && ix.sections[i][4] !== 'item') kids.push(ix.sections[i][1]);
      expect(kids).toEqual([]);
    });
    it(`${b}: no item is a price-list row, and lifestyle rows keep their group`, () => {
      const items = Object.values(entries(b, 'items'));
      expect(items.filter((e) => /^(\d[\d,]*([-–]\d+)?|cantrip|poor|modest|wealthy|squalid|comfortable|aristocratic)$/i.test(e.name)).map((e) => e.name)).toEqual([]);
      const t = read<{ forms: Record<string, number[]> }>(`${b}/terms.json`);
      for (const w of ['poor', 'modest', 'wealthy', '1', 'cantrip-item']) expect(Object.keys(t.forms).includes(w) && t.forms[w].some((i) => read<{ entries: [string, string, string][] }>(`${b}/terms.json`).entries[i][2] === 'item'), w).toBe(false);
    });
  }
  it('Efreeti Bottle is rolled on 1d10, as printed', () => {
    const e = entries('srd-5.2.1', 'items')['item:efreeti-bottle'];
    expect(e.html).toContain('<th>1d10</th>');
    expect(e.html).not.toContain('1d100');
  });
  it('Young Green Dragon has its Actions', () => {
    const h = entries('srd-5.2.1', 'monsters')['monster:young-green-dragon'].html;
    expect(h.indexOf('<h4>Actions</h4>')).toBeGreaterThan(h.indexOf('<h4>Traits</h4>'));
    expect(h.indexOf('<h4>Actions</h4>')).toBeLessThan(h.indexOf('Multiattack'));
  });
  it('Figurine of Wondrous Power is an item in both books', () => {
    expect(entries('srd-5.1', 'items')['item:figurine-of-wondrous-power'].s).toMatchObject({ category: 'Wondrous Item', magic: true, rarity: 'rarity by figurine' });
    expect(entries('srd-5.2.1', 'items')['item:figurine-of-wondrous-power']).toBeTruthy();
  });
  it('2024 lifestyle prices: inn stays and meals both kept, named by group', () => {
    const i = entries('srd-5.2.1', 'items');
    expect(i['item:inn-stay-poor'].s).toMatchObject({ cost: '1 SP' });
    expect(i['item:meal-poor'].s).toMatchObject({ cost: '2 CP' });
  });
  it('the 2024 table titles the Markdown dropped are back, as captions the search finds', () => {
    const ix = index('srd-5.2.1');
    const titles = ix.sections.filter((s) => s[2] === 6).map((s) => s[1]);
    for (const t of ['Travel Pace', 'Weapons', 'Trinkets', 'Creature Size and Space', 'Spell Scroll Costs', 'Magic Item Rarities and Values',
      'Experience Points by Challenge Rating', 'Proficiency Bonus by Challenge Rating', 'Wand of Wonder Effects', 'XP Budget per Character', 'Ability Descriptions']) expect(titles, t).toContain(t);
    const h = pagesHtml('srd-5.2.1');
    expect(h).toMatch(/<div class="tbl" id="table-travel-pace"><table><caption>Travel Pace<\/caption><thead><tr><th>Pace<\/th><th[^>]*>Distance Traveled per Minute<\/th><th>per Hour<\/th><th>per Day<\/th>/);
    expect(titles.length).toBeGreaterThanOrEqual(95);
  });
  it('words split by the PDF extraction are joined again in the 2024 book', () => {
    const t = text(pagesHtml('srd-5.2.1'));
    for (const w of ['Na ture', 'Persua sion', 'Athlet ics', 'Ath letics', 'Investi gation', 'Heavy ar mor', 'Leather Ar mor', 'Druidic Fo cus', '20 Ar rows', '8 Jav elins',
      'En tertainer', 'nu merous', 'mu sical', 'un known', 'crea tures', 'mix ture', 'nei ther', 'depend ing', 'de pending', 'Ar cane']) expect(t, w).not.toContain(w);
    expect(t).toContain('Choose 2: Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival');
  });
  it('the word repair joins fragments only when the whole word is in the book and one part is rare', () => {
    const book = 'armor armor armor nature nature. Leather Ar mor and Na ture. Take a bout of rest; a cat and a dog; an arm or a leg; the armor or the arm or the leg or.';
    const r = repairSplitWords(book, ['a bout', 'arm or']);
    expect(r.md).toContain('Leather Armor and Nature.');
    expect(r.md).toContain('a bout of rest');
    expect(r.md).toContain('an arm or a leg');
    expect(r.md).toContain('a cat and a dog');
    expect([...r.joined.keys()].sort()).toEqual(['Ar mor', 'Na ture']);
  });
  it('the 2024 legal page quotes the statement exactly, licence URL whole', () => {
    const h = read<PageFile>('srd-5.2.1/p/legal-information.json').html;
    expect(h).toContain(read<BookIndex>('srd-5.2.1/index.json').attribution);
    expect(h).not.toContain('4.0/ legalcode');
  });
  it('2014 grouped chapters do not repeat their own name, and Circle of the Land lists are named', () => {
    const ix = index('srd-5.1');
    for (const ch of ['Equipment', 'Feats', 'Using Ability Scores', 'Spellcasting', 'Magic Items', 'Monsters']) {
      const i = ix.sections.findIndex((s) => s[1] === ch && s[2] === 1);
      expect(ix.sections[i + 1][1], ch).not.toBe(ch);
    }
    const c14 = Object.values(entries('srd-5.1', 'character'));
    expect(c14.find((e) => e.name === 'Circle Spells (Arctic)')?.s).toMatchObject({ className: 'Druid', subclass: 'Circle of the Land' });
    expect(c14.some((e) => e.name === 'Arctic')).toBe(false);
  });
});

describe('books: what the Markdown dropped or garbled, restored from the PDF', () => {
  const lists = JSON.parse(readFileSync('scripts/books/pdf/srd-5.1-spell-lists.json', 'utf8')) as { attribution: string; lists: SpellLists };
  it('the PDF spell lists are committed with the attribution, and every 2014 spell carries exactly the classes that list it', () => {
    expect(lists.attribution).toBe(index('srd-5.1').attribution);
    expect(Object.keys(lists.lists).sort()).toEqual(['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard']);
    expect(Object.values(lists.lists).reduce((n, l) => n + Object.values(l).flat().length, 0)).toBe(778);
    const spells = Object.values(entries('srd-5.1', 'spells')).map((e) => ({ name: e.name, classes: (e.s as SpellSummary).classes }));
    expect(compareSpellLists(lists.lists, spells)).toEqual([]);
    expect(spells.filter((x) => !x.classes.length).map((x) => x.name)).toEqual([]);
  });
  it('the seven 2014 spell-list entries the Markdown dropped are back, and the comparison would catch a missing one', () => {
    const s = entries('srd-5.1', 'spells');
    expect((s['spell:hunters-mark'].s as SpellSummary).classes).toEqual(['Ranger']);
    expect((s['spell:enlarge-reduce'].s as SpellSummary).classes).toEqual(['Sorcerer', 'Wizard']);
    expect((s['spell:arcanists-magic-aura'].s as SpellSummary).classes).toEqual(['Wizard']);
    expect((s['spell:heroes-feast'].s as SpellSummary).classes).toEqual(['Cleric', 'Druid']);
    expect((s['spell:control-weather'].s as SpellSummary).classes).toEqual(['Cleric', 'Druid', 'Wizard']);
    const page = read<PageFile>('srd-5.1/p/spellcasting.json').html;
    expect(page).toMatch(/<li><em>Goodberry<\/em><\/li><li><em>Hunter&#39;s Mark<\/em><\/li><li><em>Jump<\/em><\/li>|<li><em>Goodberry<\/em><\/li><li><em>Hunter's Mark<\/em><\/li><li><em>Jump<\/em><\/li>/);
    expect(compareSpellLists(lists.lists, [{ name: "Hunter's Mark", classes: [] }])[0]).toMatch(/listed but not a spell|Hunter's Mark: lists say \[Ranger\]/);
    expect(compareSpellLists(lists.lists, [{ name: "Hunter's Mark", classes: [] }])).toContain("Hunter's Mark: lists say [Ranger], converter says []");
  });
  it('the PDF column reader keeps two-word names whole', () => {
    const l = parseSpellLists('Spell Lists\nRanger Spells\n\n1st Level\nGoodberry\t\r\u00a0\nHunter’s\t\r\u00a0Mark\t\r\u00a0\nJump\nSystem Reference Document 5.1 105\n2nd Level\nAid');
    expect(l).toEqual({ Ranger: { 1: ['Goodberry', "Hunter's Mark", 'Jump'], 2: ['Aid'] } });
  });
  it('the Grimlock has its Blind Senses trait, first as printed', () => {
    const h = entries('srd-5.1', 'monsters')['monster:grimlock'].html;
    expect(h).toContain("<em><strong>Blind Senses.</strong></em> The grimlock can't use its blindsight while deafened and unable to smell.");
    expect(h.indexOf('Blind Senses')).toBeLessThan(h.indexOf('Keen Hearing and Smell'));
  });
  it('the Deck of Illusions table ends with the Jokers', () => {
    const h = entries('srd-5.1', 'items')['item:deck-of-illusions'].html;
    expect(h).toMatch(/<tr><td>Jokers \(2\)<\/td><td>You \(the deck(&#39;|')s owner\)<\/td><\/tr><\/tbody>/);
  });
  it('2014 stat blocks print the Saving Throws line (the proficient saves), not a row of every save', () => {
    const m = entries('srd-5.1', 'monsters');
    expect((m['monster:vampire'].s as MonsterSummary).saves).toBe('Dex +9, Wis +7, Cha +9');
    expect(m['monster:vampire'].html).toContain('<li><strong>Saving Throws</strong> Dex +9, Wis +7, Cha +9</li>');
    expect((m['monster:grimlock'].s as MonsterSummary).saves).toBeUndefined();
    expect(pagesHtml('srd-5.1')).not.toMatch(/<th><strong>Saving Throws?<\/strong><\/th>/);
    // 2024 prints a save beside every modifier, and keeps it.
    expect(entries('srd-5.2.1', 'monsters')['monster:vampire'].html).toMatch(/Saving Throw|<th[^>]*>Save/);
  });
  it('2014 equipment names are the printed ones: no bare adjectives or group labels, no unpriced rows', () => {
    const items = entries('srd-5.1', 'items');
    const names = Object.values(items).map((e) => e.name);
    for (const bad of ['Military', 'Exotic', 'Pack', 'Riding', 'Vehicles (land or water)', 'Meals (per day), Meat, chunk', 'Tent, two -person']) expect(names, bad).not.toContain(bad);
    expect(names.filter((n) => /\(per [^)]*\), /.test(n))).toEqual([]);
    expect(items['item:saddle-military'].s).toMatchObject({ cost: '20 gp', weight: '30 lb.' });
    expect(items['item:meat-chunk'].s).toMatchObject({ cost: '3 sp' });
    expect(items['item:tent-two-person']).toBeTruthy();
    expect(items['item:meals-poor'].s).toMatchObject({ cost: '6 cp' });
    expect(Object.values(items).filter((e) => (e.s as ItemSummary).cost === '*')).toEqual([]);
    expect(read<PageFile>('srd-5.1/p/equipment.json').html).not.toContain('two -person');
  });
  it('2014 Destroy Undead keeps its Cleric Level column, and the Warlock table its Proficiency Bonus heading', () => {
    const h = read<PageFile>('srd-5.1/p/classes--1.json').html;
    const du = /<section class="entry t-feature" data-id="feature:destroy-undead-cleric">[\s\S]*?<\/section>/.exec(h)?.[0] ?? '';
    expect(text(du)).toMatch(/Cleric Level Destroys Undead of CR 5th 1\/2 or lower 8th 1 or lower 11th 2 or lower 14th 3 or lower 17th 4 or lower/);
    expect(pagesHtml('srd-5.1')).not.toContain('Bonus Proficiency</th>');
    expect(entries('srd-5.1', 'character')['feature:destroy-undead-cleric'].text).toBe('Cleric Level: Destroys Undead of CR. 5th: 1/2 or lower; 8th: 1 or lower; 11th: 2 or lower; 14th: 3 or lower; 17th: 4 or lower.');
  });
  for (const b of BOOKS) it(`${b}: every table has at least two columns (a lost column shows as a table of one)`, () => {
    const tables = pagesHtml(b).match(/<table[^>]*><thead><tr>[\s\S]*?<\/tr>/g) ?? [];
    expect(tables.length).toBeGreaterThan(300);
    expect(tables.filter((t) => (t.match(/<th\b/g) ?? []).length < 2)).toEqual([]);
  });
  it('kinds of one thing are named after it, and the thing is an item with its paragraph and its kinds', () => {
    const i14 = entries('srd-5.1', 'items'), i24 = entries('srd-5.2.1', 'items');
    for (const items of [i14, i24]) {
      // No bare kind ('Orb', 'Amulet', 'Totem', 'Exotic') or bare group label stands as a name.
      const names = Object.values(items).map((e) => e.name);
      for (const bad of ['Amulet', 'Emblem', 'Reliquary', 'Crystal', 'Orb', 'Rod', 'Staff', 'Wand', 'Totem', 'Exotic', 'Military', 'Pack', 'Riding', 'Poor', 'Wealthy', 'Squalid']) expect(names, bad).not.toContain(bad);
      for (const g of ['Holy Symbol', 'Arcane Focus', 'Druidic Focus', 'Gaming Set', 'Musical Instrument', 'Inn Stay']) {
        const e = Object.values(items).find((x) => x.name === g);
        expect(e, g).toBeTruthy();
        expect((e!.s as ItemSummary).variants, g).toBeTruthy();
        expect(e!.text, g).not.toBe('');
      }
    }
    expect(i14['item:holy-symbol'].text).toMatch(/^A holy symbol is a representation of a god or pantheon/);
    expect((i14['item:holy-symbol'].s as ItemSummary).variants).toBe('Amulet (5 gp, 1 lb.), Emblem (5 gp), Reliquary (5 gp, 2 lb.)');
    expect(i14['item:holy-symbol-amulet'].s).toMatchObject({ cost: '5 gp', subcategory: 'Holy symbol' });
    expect(i14['item:holy-symbol-amulet'].html).toContain('A holy symbol is a representation');
    expect(i14['item:saddle'].text).toMatch(/^A military saddle braces the rider/);
    // A kept row (a Lute is a Lute) shows its group's paragraph.
    expect(i14['item:lute'].html).toContain('Several of the most common types of musical instruments');
    expect(i24['item:holy-symbol-amulet-worn-or-held'].s).toMatchObject({ cost: '5 GP' });
  });
  it('2024 tools are items, each with its ability, Utilize and cost', () => {
    const i = entries('srd-5.2.1', 'items');
    const tools = Object.values(i).filter((e) => (e.s as ItemSummary).category === 'Tool');
    const ix = index('srd-5.2.1');
    // Every heading under Artisan's Tools and Other Tools is one.
    const under = (title: string) => { const at = ix.sections.findIndex((x) => x[1] === title); const lv = ix.sections[at][2]; const out: string[] = []; for (let k = at + 1; k < ix.sections.length && ix.sections[k][2] > lv; k++) if (ix.sections[k][2] === lv + 1) out.push(ix.sections[k][1]); return out; };
    const want = [...under("Artisan's Tools"), ...under('Other Tools')];
    expect(want.length).toBe(25);
    expect(tools.map((e) => e.name).sort()).toEqual(want.sort());
    expect(i['item:thieves-tools'].s).toEqual({ category: 'Tool', magic: false, subcategory: 'Other Tools', cost: '25 GP', weight: '1 lb.', ability: 'Dexterity', utilize: 'Pick a lock (DC 15), or disarm a trap (DC 15)' } satisfies ItemSummary);
    expect(i['item:thieves-tools'].text).toBe('Dexterity. Utilize: Pick a lock (DC 15), or disarm a trap (DC 15).');
    expect(i['item:smiths-tools'].s).toMatchObject({ subcategory: "Artisan's Tools", ability: 'Strength' });
    expect((i['item:musical-instrument'].s as ItemSummary).variants).toMatch(/^Bagpipes \(30 GP, 6 lb\.\), drum/);
  });
  for (const b of BOOKS) {
    it(`${b}: no stray Markdown underscores in the reader text`, () => {
      const t = text(pagesHtml(b).replace(/<a [^>]*>[\s\S]*?<\/a>|<code>[\s\S]*?<\/code>/g, ''));
      expect(t.match(/.{0,30}_.{0,10}/g) ?? []).toEqual([]);
    });
    it(`${b}: every entry has a short tooltip text`, () => {
      const all = ['rules', 'character', 'monsters', 'items', 'spells'].flatMap((f) => Object.values(entries(b, f)));
      expect(all.length).toBeGreaterThan(1300);
      expect(all.filter((e) => !e.text.trim()).map((e) => e.id)).toEqual([]);
    });
    it(`${b}: every ability table of a stat block is marked for the phone layout`, () => {
      const h = pagesHtml(b);
      const all = h.match(/<table[^>]*><thead><tr><th><\/th><th[^>]*>Str\.<\/th>/g) ?? [];
      expect(all.length).toBeGreaterThan(300);
      expect(all.filter((t) => !t.startsWith('<table class="abil">'))).toEqual([]);
    });
  }
  it('a monster\'s tooltip text is its stat line', () => {
    expect(entries('srd-5.2.1', 'monsters')['monster:vampire'].text).toBe('Medium or Small Undead, Lawful Evil. AC 16, HP 195 (23d8 + 92), Speed 40 ft., Climb 40 ft. CR 13 (XP 10,000).');
    expect(entries('srd-5.1', 'rules')['condition:prone'].text).toMatch(/^A prone creature's only movement option is to crawl/);
  });
});

// The converter is deterministic: a fresh run over the pinned sources matches the committed files byte for byte.
// Runs where `npm run books` has filled scripts/books/.cache; elsewhere `npm run books:check` does the same check.
describe.skipIf(!existsSync('scripts/books/.cache/your5e-srd-5.2.1-md.md'))('books: regeneration', () => {
  it('convertBook reproduces the committed data', async () => {
    const { BOOKS } = await import('../scripts/books/config');
    const { convertBook, otherProseOf } = await import('../scripts/books/convert');
    const sources = JSON.parse(readFileSync('scripts/books/sources.json', 'utf8')).sources;
    for (const cfg of BOOKS) {
      const md = readFileSync(`scripts/books/.cache/${cfg.markdown}.md`, 'utf8');
      const titles = cfg.tableTitles ? JSON.parse(readFileSync(`scripts/books/titles/${cfg.id}.json`, 'utf8')).titles : [];
      const built = convertBook(cfg, md, sources, titles, { otherProse: otherProseOf(cfg, (o) => readFileSync(`scripts/books/.cache/${o.markdown}.md`, 'utf8')) });
      for (const [p, s] of built.files) expect(s === readFileSync(`${DIR}/${cfg.id}/${p}`, 'utf8'), `${cfg.id}/${p}`).toBe(true);
    }
  }, 120_000);
});

// Every word the books print is a word of the official PDF: a garble the Markdown carries ('wwizareapon', '5-footwide')
// cannot slip through. Runs where `npm run books` has fetched the PDFs into scripts/books/.cache and pdftotext exists.
const PDFS = { 'srd-5.2.1': 'wotc-srd-5.2.1-pdf', 'srd-5.1': 'wotc-srd-5.1-pdf' } as const;
describe.skipIf(!existsSync('scripts/books/.cache/wotc-srd-5.1-pdf.pdf'))('books: every word is the PDF’s', () => {
  // Ordinal suffixes SRD 5.2.1 sets as superscripts ('3rd' extracts as '3' and 'rd' apart), and the heading row
  // ('Abbreviation', 'Stands For') the Markdown gave the glossary's list of abbreviations.
  const ALLOW: Record<string, string[]> = { 'srd-5.2.1': ['st', 'nd', 'rd', 'th', 'abbreviation', 'stands'], 'srd-5.1': [] };
  it('no page or tooltip line has a word the PDF never prints', async () => {
    const { pdfText, vocabularyOf } = await import('../scripts/books/vocab');
    for (const [book, pdf] of Object.entries(PDFS) as [BookId, string][]) {
      const t = pdfText(`scripts/books/.cache/${pdf}.pdf`);
      expect(t?.trim(), `${book}: PDF extraction must succeed; put pdftotext on PATH before running the cached-source check`).toBeTruthy();
      const v = vocabularyOf(t!);
      const missing = new Map<string, string>();
      const scan = (where: string, s: string) => {
        const words = s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').toLowerCase().replace(/’/g, "'").match(/[a-z]+/g) ?? [];
        for (const w of words) if (!v.words.has(w) && !ALLOW[book].includes(w) && !missing.has(w)) missing.set(w, where);
      };
      for (const p of index(book).pages) scan(`p/${p.id}`, read<PageFile>(`${book}/p/${p.id}.json`).html);
      for (const f of ['spells', 'monsters', 'items', 'rules', 'character']) for (const e of Object.values(entries(book, f))) scan(e.id, e.text);
      expect([...missing].map(([w, at]) => `${w} (${at})`), book).toEqual([]);
    }
  }, 60_000);
});
