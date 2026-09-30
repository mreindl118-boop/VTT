import { describe, expect, it } from 'vitest';
import { tacticalRange } from '../app/src/core/range';
import { moveBlockers, sightBlockers } from '../app/src/core/light';
import { rect } from '../app/src/core/geometry';
import type { Wall } from '../app/src/core/schema';

// A 40×20 room split by a wall at x = 20 with a door at z 5–10.
const floor = [rect(0, 0, 20, 20), rect(20, 0, 20, 20)];
const walls = (open: boolean): Wall[] => [
  { id: 'w1', a: [20, 0], b: [20, 5], flags: ['normal'] }, { id: 'd', a: [20, 5], b: [20, 10], flags: ['door'], open }, { id: 'w2', a: [20, 10], b: [20, 20], flags: ['normal'] },
];
const has = (list: [number, number][], x: number, z: number) => list.some((c) => c[0] === x && c[1] === z);
const run = (open: boolean, speedFt = 30, extra = {}) => tacticalRange({ start: [2.5, 2.5], speedFt, reachFt: 5, floor, moveBlockers: moveBlockers(walls(open)), sightBlockers: sightBlockers(walls(open)), occupied: [], ...extra });

describe('tactical range', () => {
  it('30 ft of movement reaches 6 squares in a line and costs add up', () => {
    const r = run(false);
    expect(r.move.find((m) => m.cell[0] === 32.5 && m.cell[1] === 2.5)).toBeUndefined();
    expect(r.move.find((m) => m.cell[0] === 17.5 && m.cell[1] === 17.5)?.costFt).toBe(15); // 3 diagonals at 5 ft each
  });
  it('a closed door stops movement; an open one lets it through', () => {
    expect(has(run(false).move.map((m) => m.cell), 22.5, 7.5)).toBe(false);
    expect(has(run(true).move.map((m) => m.cell), 22.5, 7.5)).toBe(true);
  });
  it('strike cells ring the movement area but never cross a wall', () => {
    const r = run(false, 10);
    expect(has(r.strike, 17.5, 2.5)).toBe(true);
    expect(has(r.strike, 22.5, 2.5)).toBe(false);
  });
  it('the 5-10-5 rule makes every second diagonal cost 10 ft', () => {
    const r = run(false, 30, { rule: 'five-ten-five' });
    expect(r.move.find((m) => m.cell[0] === 17.5 && m.cell[1] === 17.5)?.costFt).toBe(20);
  });
  it('ranged cells need line of sight', () => {
    const r = run(false, 0, { rangeFt: 60 });
    expect(has(r.ranged, 12.5, 12.5)).toBe(true);
    expect(has(r.ranged, 32.5, 17.5)).toBe(false); // behind the wall
  });
  it('occupied squares cannot be entered', () => {
    const r = run(false, 10, { occupied: [[7.5, 2.5]] });
    expect(has(r.move.map((m) => m.cell), 7.5, 2.5)).toBe(false);
  });
});
