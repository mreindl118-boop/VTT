// The rules kinds (ui/kinds.ts): every entry type is mapped, every kind reads without colour (its own kicker word,
// and an underline style of its own family), every emblem is in the shipped sprite, and the senses exist in the books.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TYPE_META, type EntryType, type TermFile } from '../app/src/books/types';
import { ALL_KINDS, EMBLEM_IDS, ENTRY_TYPES, familyColor, familyOf, kickerOf, kindInfo, kindOf, PLAYER_KINDS, rarityOf, SENSE_IDS, underlineOf } from '../app/src/ui/kinds';

// A compile-time list of every EntryType: adding a type to the union without listing it here fails the type check.
const EVERY: Record<EntryType, true> = { spell: true, condition: true, monster: true, item: true, rule: true, damage: true, ability: true, skill: true, 'creature-type': true, feat: true, class: true, feature: true, species: true, background: true };
const pairs = <T,>(xs: readonly T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe('rules kinds', () => {
  it('every EntryType is mapped, and the books palette uses the same family', () => {
    expect([...ENTRY_TYPES].sort()).toEqual(Object.keys(EVERY).sort());
    for (const t of ENTRY_TYPES) {
      expect(() => kindInfo(t)).not.toThrow();
      expect(TYPE_META[t].color, t).toBe(familyColor(familyOf(t)));
    }
    expect(() => kindInfo('nonsense' as never)).toThrow();
  });
  it('every pair of kinds differs in kicker word, and kinds of different families differ in underline style', () => {
    for (const [a, b] of pairs(ALL_KINDS)) {
      expect(kindInfo(a).word, `${a} / ${b}`).not.toBe(kindInfo(b).word);
      if (familyOf(a) !== familyOf(b)) expect(underlineOf(a), `${a} / ${b}`).not.toBe(underlineOf(b));
    }
    expect(new Set(ALL_KINDS.map(underlineOf))).toEqual(new Set(['dotted', 'dashed', 'double', 'wavy', 'solid']));
  });
  it('every emblem is one of the 18 in the sprite', () => {
    const sprite = readFileSync('app/src/ui/emblems.svg', 'utf8');
    for (const k of ALL_KINDS) {
      expect(EMBLEM_IDS, k).toContain(kindInfo(k).emblem);
      expect(sprite, k).toContain(`id="gi-${kindInfo(k).emblem}"`);
    }
  });
  it('every SENSE_IDS id exists in at least one edition', () => {
    const ids = new Set(['srd-5.1', 'srd-5.2.1'].flatMap((b) => (JSON.parse(readFileSync(`app/public/books/${b}/terms.json`, 'utf8')) as TermFile).entries.map((e) => e[0])));
    for (const id of SENSE_IDS) expect(ids.has(id), id).toBe(true);
  });
  it('items split into magic items and gear; actions and senses come out of the rules', () => {
    expect(kindOf({ id: 'item:bag-of-holding', type: 'item', summary: { magic: true, rarity: 'Uncommon' } })).toBe('magic-item');
    expect(kindOf({ id: 'item:longsword', type: 'item', summary: { magic: false } })).toBe('gear');
    expect(kindOf({ id: 'rule:dash', type: 'rule', summary: { tag: 'Action' } })).toBe('action');
    expect(kindOf({ id: 'rule:darkvision', type: 'rule', summary: {} })).toBe('sense');
    expect(kindOf({ id: 'rule:grappling', type: 'rule', summary: {} })).toBe('rule');
    expect(rarityOf({ id: 'x', type: 'item', summary: { rarity: 'Very Rare' } })).toBe('veryrare');
    expect(rarityOf({ id: 'x', type: 'item', summary: { rarity: 'rare (+1), very rare (+2), or legendary (+3)' } })).toBe('rare');
    expect(rarityOf({ id: 'x', type: 'item', summary: { rarity: 'Rarity Varies' } })).toBe('');
  });
  it('the kicker carries the exact type', () => {
    expect(kickerOf({ id: 'spell:charm-person', type: 'spell', summary: { level: 1, school: 'Enchantment' } }, '2024')).toBe('spell · 1st level · enchantment');
    expect(kickerOf({ id: 'spell:fire-bolt', type: 'spell', summary: { level: 0, school: 'Evocation' } }, '2024')).toBe('cantrip · evocation');
    expect(kickerOf({ id: 'monster:wolf', type: 'monster', summary: { cr: '1/4' } }, '2024')).toBe('monster · CR 1/4');
    expect(kickerOf({ id: 'item:x', type: 'item', summary: { magic: true, rarity: 'Rare' } }, '2024')).toBe('magic item · rare');
    expect(kickerOf({ id: 'rule:finesse', type: 'rule', summary: { tag: 'Weapon Property' } }, '2024')).toBe('rule · weapon property');
    expect(kickerOf({ id: 'skill:perception', type: 'skill', summary: { ability: 'Wisdom' } }, '2024')).toBe('skill · wisdom');
    expect(kickerOf({ id: 'species:elf', type: 'species', summary: {} }, '2014')).toBe('race');
    expect(kickerOf({ id: 'condition:prone', type: 'condition', summary: {} }, '2024')).toBe('condition');
  });
  it('only rules kinds link on the players\' side', () => {
    expect([...PLAYER_KINDS].sort()).toEqual(['ability', 'action', 'condition', 'damage', 'rule', 'sense', 'skill']);
    for (const k of ['monster', 'creature-type', 'person', 'area', 'pageref', 'check', 'dice'] as const) expect(PLAYER_KINDS.has(k)).toBe(false);
  });
});
