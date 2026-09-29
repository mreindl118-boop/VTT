import { describe, expect, it } from 'vitest';
import { PACES, travel } from '../app/src/core/travel';

describe('overland travel (PHB)', () => {
  it('pace table', () => {
    expect(PACES.fast).toMatchObject({ mph: 4, milesPerDay: 30 });
    expect(PACES.normal).toMatchObject({ mph: 3, milesPerDay: 24 });
    expect(PACES.slow).toMatchObject({ mph: 2, milesPerDay: 18 });
  });
  it('16.5 miles of road takes 5.5 h at normal pace', () => {
    const r = travel([[0, 0], [5280 * 10, 0], [5280 * 10, 5280 * 6.5]], 'normal');
    expect(r.miles).toBeCloseTo(16.5, 9);
    expect(r.hours).toBeCloseTo(5.5, 9);
  });
  it.todo('Village of Barovia -> Vallaki along digitized roads is 15-18 mi, 5-6 h (M2 regional map)');
});
