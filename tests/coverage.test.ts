import { describe, expect, it } from 'vitest';
import { Cov, CoverageMap } from '../app/src/core/coverage';
import { rect } from '../app/src/core/geometry';
import type { Wall } from '../app/src/core/schema';

const a = rect(0, 0, 20, 20), b = rect(20, 0, 20, 20);
const walls: Wall[] = [{ id: 'mid', a: [20, 0], b: [20, 20], flags: ['door'] }];

describe('coverage / explored memory', () => {
  it('sees own room, not behind a closed door; memory persists after leaving', () => {
    const m = CoverageMap.forPolygons([a, b]);
    m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], walls, [], 'barovian-overcast');
    expect(m.state(10, 10)).toBe(Cov.Visible);
    expect(m.state(30, 10)).toBe(Cov.Unexplored);
    m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], [{ ...walls[0], open: true }], [], 'barovian-overcast');
    expect(m.state(30, 10)).toBe(Cov.Visible);
    m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], walls, [], 'barovian-overcast');
    expect(m.state(30, 10)).toBe(Cov.Explored);
  });
  it('DM reveal and forced fog override vision; serialization round-trips', () => {
    const m = CoverageMap.forPolygons([a, b]);
    m.stamp(b, 'reveal');
    expect(m.state(30, 10)).toBe(Cov.Visible);
    m.stamp(a, 'fog');
    m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], walls, [], 'barovian-overcast');
    expect(m.state(10, 10)).toBe(Cov.Unexplored);
    const n = CoverageMap.forPolygons([a, b]);
    n.load(m.serialize());
    expect(Array.from(n.seen)).toEqual(Array.from(m.seen));
    expect(Array.from(n.paint)).toEqual(Array.from(m.paint));
  });
  it('is 1 ft per texel', () => {
    const m = CoverageMap.forPolygons([rect(0, 0, 10, 10)], 0);
    expect([m.width, m.height]).toEqual([10, 10]);
  });
});
