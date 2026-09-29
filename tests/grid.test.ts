import { describe, expect, it } from 'vitest';
import { hexDistanceFt, hexSizeFromWidth, hexToWorld, squareCellAt, squareDistanceFt, worldToHex } from '../app/src/core/grid';

describe('square grid', () => {
  it('diagonals cost 5 ft by default', () => {
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 3, j: 3 })).toBe(15);
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 4, j: 1 })).toBe(20);
  });
  it('5-10-5 variant', () => {
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 1, j: 1 }, 'five-ten-five')).toBe(5);
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 2, j: 2 }, 'five-ten-five')).toBe(15);
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 3, j: 3 }, 'five-ten-five')).toBe(20);
    expect(squareDistanceFt({ i: 0, j: 0 }, { i: 4, j: 4 }, 'five-ten-five')).toBe(30);
  });
  it('cell lookup respects origin', () => {
    expect(squareCellAt([7, 12], [2, 2])).toEqual({ i: 1, j: 2 });
  });
});

describe('hex grid', () => {
  const s = hexSizeFromWidth(5);
  it('every hex is 5 ft and neighbours are 5 ft apart centre to centre', () => {
    for (const o of ['pointy', 'flat'] as const) {
      const a = hexToWorld({ q: 0, r: 0 }, s, o), b = hexToWorld({ q: 1, r: 0 }, s, o), c = hexToWorld({ q: 0, r: 1 }, s, o);
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(5, 9);
      expect(Math.hypot(c[0] - a[0], c[1] - a[1])).toBeCloseTo(5, 9);
    }
    expect(hexDistanceFt({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(15);
  });
  it('world <-> hex round-trips', () => {
    for (const o of ['pointy', 'flat'] as const)
      for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) expect(worldToHex(hexToWorld({ q, r }, s, o), s, o)).toEqual({ q, r });
  });
  it('regional hexes measure 1/4 mile', () => {
    const big = hexSizeFromWidth(1320);
    const a = hexToWorld({ q: 0, r: 0 }, big), b = hexToWorld({ q: 1, r: 0 }, big);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5280).toBeCloseTo(0.25, 9);
  });
});
