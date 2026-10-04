// The rules books converter (scripts/books) and the data it wrote to app/public/books (SRD 5.1 and 5.2.1, CC-BY-4.0).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inline, parseBlocks, renderBlocks } from '../scripts/books/md';
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
      'Spellcasting', 'Spell Descriptions', 'Traps, Diseases and Hazards', 'Magic Items', 'Monsters',
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

// The converter is deterministic: a fresh run over the pinned sources matches the committed files byte for byte.
// Runs where `npm run books` has filled scripts/books/.cache; elsewhere `npm run books:check` does the same check.
describe.skipIf(!existsSync('scripts/books/.cache/your5e-srd-5.2.1-md.md'))('books: regeneration', () => {
  it('convertBook reproduces the committed data', async () => {
    const { BOOKS } = await import('../scripts/books/config');
    const { convertBook } = await import('../scripts/books/convert');
    const sources = JSON.parse(readFileSync('scripts/books/sources.json', 'utf8')).sources;
    for (const cfg of BOOKS) {
      const md = readFileSync(`scripts/books/.cache/${cfg.markdown}.md`, 'utf8');
      const built = convertBook(cfg, md, sources);
      for (const [p, s] of built.files) expect(s === readFileSync(`${DIR}/${cfg.id}/${p}`, 'utf8'), `${cfg.id}/${p}`).toBe(true);
    }
  }, 120_000);
});
