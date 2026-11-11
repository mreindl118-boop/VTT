// Encounter packs (core/encounterPack.ts): reading a pack against the app, counts the DM rolls, difficulty in both
// rule sets, and where staged creatures stand.
import { describe, expect, it } from 'vitest';
import { diceRange, difficulty, formationCells, multiplier2014, resolveCount, validatePack, xpForCr } from '../app/src/core/encounterPack';
import { pointInPolygon, type Polygon } from '../app/src/core/geometry';
import { repoContext } from '../scripts/encounters/context';

const ctx = repoContext();

describe('validatePack', () => {
  it('loads a good record against the real manifests and scenes', () => {
    const { pack, problems } = validatePack({ schema: 1, encounters: [{ id: 'a', title: 'A', scene: 'appB/death-house', area: '29', source: 'book', page: 219, creatures: [{ id: 'ghoul', count: 4 }] }] }, ctx);
    expect(problems).toEqual([]);
    expect(pack.encounters[0]).toMatchObject({ id: 'a', placement: 'area', source: 'book' });
  });
  it('drops unknown creatures and bad counts, warns on unknown areas and sources', () => {
    const { pack, problems } = validatePack({ encounters: [
      { id: 'b', scene: 'ch03/E', area: 'E99', source: 'homebrew', creatures: [{ id: 'nope', count: 1 }, { id: 'zombie', count: '2d4' }] },
      { id: 'c', scene: 'ch03/E', creatures: [{ id: 'zombie', count: 'lots' }] },
      { id: 'b', scene: 'ch03/E', creatures: [{ id: 'zombie', count: 1 }] },
    ] }, ctx);
    expect(pack.encounters.map((e) => e.id)).toEqual(['b']);
    expect(pack.encounters[0]).toMatchObject({ source: 'generative', placement: 'party', title: 'b' });
    expect(pack.encounters[0].creatures.map((c) => c.id)).toEqual(['zombie']);
    const text = problems.map((p) => `${p.level} ${p.encounter} ${p.text}`).join('\n');
    expect(text).toMatch(/error b Creature nope/);
    expect(text).toMatch(/warning b Area E99/);
    expect(text).toMatch(/warning b Source "homebrew"/);
    expect(text).toMatch(/error c .*neither a number nor dice/);
    expect(text).toMatch(/error b Duplicate id/);
  });
  it('places off-map scenes beside the party', () => {
    const { pack, problems } = validatePack({ schema: 1, encounters: [{ id: 'w', scene: 'ch02/barovia-region', terrain: 'forest-road-night', source: 'book', creatures: [{ id: 'wolf', count: '1d6+2' }] }] }, ctx);
    expect(pack.encounters[0].placement).toBe('party');
    expect(problems.some((p) => /not a built map/.test(p.text))).toBe(true);
  });
  it('refuses something that is not a pack', () => {
    expect(validatePack({ hello: 1 }, ctx).problems[0].level).toBe('error');
  });
});

describe('counts the DM rolls', () => {
  it('reads dice ranges', () => {
    expect(diceRange('3d6')).toMatchObject({ min: 3, max: 18 });
    expect(diceRange('1d4+2')).toMatchObject({ min: 3, max: 6 });
    expect(diceRange('d8')).toMatchObject({ min: 1, max: 8 });
    expect(diceRange(4)).toBeNull();
  });
  it('never rolls: a dice count needs the typed total, inside its range', () => {
    expect(resolveCount(4)).toBe(4);
    expect(resolveCount('5')).toBe(5);
    expect(resolveCount('3d6')).toBeNull();
    expect(resolveCount('3d6', 11)).toBe(11);
    expect(resolveCount('3d6', 2)).toBeNull();
    expect(resolveCount('3d6', 19)).toBeNull();
  });
});

describe('difficulty in both rule sets', () => {
  it('maps CR to XP', () => { expect(xpForCr('1/4')).toBe(50); expect(xpForCr('5')).toBe(1800); expect(xpForCr(undefined)).toBeUndefined(); });
  it('applies the 2014 group multiplier with the party-size shift', () => {
    expect(multiplier2014(1, 4)).toBe(1); expect(multiplier2014(4, 4)).toBe(2); expect(multiplier2014(4, 2)).toBe(2.5); expect(multiplier2014(4, 6)).toBe(1.5); expect(multiplier2014(1, 6)).toBe(0.5);
  });
  it('four ghouls against four level-1 characters', () => {
    const d = difficulty([200, 200, 200, 200], [1, 1, 1, 1]);
    expect(d.xp).toBe(800);
    expect(d.e2014).toMatchObject({ adjusted: 1600, label: 'Deadly', thresholds: [100, 200, 300, 400] });
    expect(d.e2024).toMatchObject({ label: 'Over High', budgets: [200, 300, 400] });
  });
  it('two wolves against four level-3 characters, and unknown CRs left out', () => {
    const d = difficulty([50, 50, undefined], [3, 3, 3, 3]);
    expect(d.unknown).toBe(1);
    // the unknown one still counts as a foe for the multiplier: 100 XP × 2 = 200, under the party's easy 300
    expect(d.e2014).toMatchObject({ adjusted: 200, label: 'Trivial' });
    expect(d.e2024.label).toBe('Low');
  });
});

describe('formationCells', () => {
  const room: Polygon = [[0, 0], [20, 0], [20, 10], [0, 10]]; // 4 × 2 cells
  const hall: Polygon = [[20, 0], [40, 0], [40, 10], [20, 10]];
  it('fills the area first, then the floor, skipping taken cells', () => {
    const cells = formationCells(10, { area: room, floor: [room, hall], taken: [[7.5, 7.5]] });
    expect(new Set(cells.map(String)).size).toBe(10);
    expect(cells.slice(0, 7).every((c) => pointInPolygon(c, room))).toBe(true);
    expect(cells.map(String)).not.toContain('7.5,7.5');
    expect(cells.slice(7).every((c) => pointInPolygon(c, hall))).toBe(true);
  });
  it('spirals from the party when there is no area', () => {
    const cells = formationCells(2, { floor: [room], from: [12.5, 2.5] });
    expect(cells[0]).toEqual([12.5, 2.5]);
  });
});
