import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { baseRingFt, bookSquaresToCells, CELL_FT, feetToCells, feetToMeters, FOOTPRINTS, FT_PER_M, M_PER_FT, metersToFeet, REGIONAL_HEX_FT } from '../app/src/core/units';

describe('units (docs/UNITS.md)', () => {
  it('world unit is the foot; GLB meters convert exactly', () => {
    expect(M_PER_FT).toBe(0.3048);
    expect(metersToFeet(0.3048)).toBeCloseTo(1, 12);
    expect(feetToMeters(5)).toBeCloseTo(1.524, 12);
    expect(metersToFeet(feetToMeters(123.25))).toBeCloseTo(123.25, 10);
    expect(FT_PER_M).toBeCloseTo(3.28084, 5);
  });
  it('one cell is 5 ft, one inch of table', () => {
    expect(CELL_FT).toBe(5);
    expect(feetToCells(30)).toBe(6);
    expect(baseRingFt('medium')).toBe(5);
    expect(baseRingFt('tiny')).toBe(2.5);
    expect(baseRingFt('gargantuan')).toBe(20);
  });
  it('creature footprints match the PHB/DMG table', () => {
    expect(Object.fromEntries(Object.entries(FOOTPRINTS).map(([k, v]) => [k, [v.spaceFt, v.squares, v.hexes, v.baseIn]]))).toEqual({
      tiny: [2.5, 0.25, 0.25, 0.5], small: [5, 1, 1, 1], medium: [5, 1, 1, 1], large: [10, 4, 3, 2], huge: [15, 9, 7, 3], gargantuan: [20, 16, 12, 4],
    });
  });
  it('book scales: 10-ft squares subdivide 2x2, 5-ft are 1:1; regional hex is 1/4 mile', () => {
    expect(bookSquaresToCells(1, 10)).toBe(2);
    expect(bookSquaresToCells(3, 10)).toBe(6);
    expect(bookSquaresToCells(7, 5)).toBe(7);
    expect(REGIONAL_HEX_FT).toBe(1320);
  });
  it('no source file outside units.ts hard-codes the meter conversion', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const offenders = walk('app/src').filter((f) => f.endsWith('.ts') && !f.endsWith('units.ts') && /0\.3048|3\.2808/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
