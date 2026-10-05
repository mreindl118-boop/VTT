// The rules books converter (scripts/books) and the data it wrote to app/public/books (SRD 5.1 and 5.2.1, CC-BY-4.0).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inline, parseBlocks, renderBlocks, repairSplitWords } from '../scripts/books/md';
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
      expect(v.html).toContain('<table>');
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

// The converter is deterministic: a fresh run over the pinned sources matches the committed files byte for byte.
// Runs where `npm run books` has filled scripts/books/.cache; elsewhere `npm run books:check` does the same check.
describe.skipIf(!existsSync('scripts/books/.cache/your5e-srd-5.2.1-md.md'))('books: regeneration', () => {
  it('convertBook reproduces the committed data', async () => {
    const { BOOKS } = await import('../scripts/books/config');
    const { convertBook } = await import('../scripts/books/convert');
    const sources = JSON.parse(readFileSync('scripts/books/sources.json', 'utf8')).sources;
    for (const cfg of BOOKS) {
      const md = readFileSync(`scripts/books/.cache/${cfg.markdown}.md`, 'utf8');
      const titles = cfg.tableTitles ? JSON.parse(readFileSync(`scripts/books/titles/${cfg.id}.json`, 'utf8')) : [];
      const built = convertBook(cfg, md, sources, titles);
      for (const [p, s] of built.files) expect(s === readFileSync(`${DIR}/${cfg.id}/${p}`, 'utf8'), `${cfg.id}/${p}`).toBe(true);
    }
  }, 120_000);
});
