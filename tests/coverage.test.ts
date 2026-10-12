import { describe, expect, it } from 'vitest';
import { Cov, CoverageMap } from '../app/src/core/coverage';
import { rect } from '../app/src/core/geometry';
import type { Viewer } from '../app/src/core/light';
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

// Keep the geometry at the same texel scale for every adaptive coverage resolution.
describe.each([1, 2, 3, 4, 5, 8, 10])('bounded explored memory at %i ft per texel', (cell) => {
  const floor = [rect(0, 0, 20 * cell, 20 * cell), rect(20 * cell, 0, 20 * cell, 20 * cell)];
  const closed: Wall[] = [{ id: 'mid', a: [20 * cell, 0], b: [20 * cell, 20 * cell], flags: ['door'] }];
  const open: Wall[] = [{ ...closed[0], open: true }];
  const left: Viewer[] = [{ pos: [10 * cell, 10 * cell], darkvisionFt: 0 }];
  const right: Viewer[] = [{ pos: [30 * cell, 10 * cell], darkvisionFt: 0 }];
  const create = () => new CoverageMap(-2 * cell, -2 * cell, 44, 24, cell);
  const update = (m: CoverageMap, viewers = left, walls = closed) =>
    m.updateVision(viewers, floor, walls, [], 'barovian-overcast');

  it('does not grow explored history or reveal the closed room after fifty identical updates', () => {
    const m = create();
    update(m);
    const first = m.serialize();
    const visible = m.visible.slice();
    expect(m.state(10 * cell, 10 * cell)).toBe(Cov.Visible);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Unexplored);
    for (let i = 0; i < 50; i++) update(m);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Unexplored);
    expect(m.serialize()).toEqual(first);
    expect(m.visible).toEqual(visible);
  });

  it('remembers exactly one texel of wall rim, including diagonals', () => {
    const m = create();
    update(m);
    expect(m.state(-0.5 * cell, -0.5 * cell)).toBe(Cov.Visible);
    expect(m.state(20.5 * cell, 10 * cell)).toBe(Cov.Visible);
    expect(m.state(-1.5 * cell, -0.5 * cell)).toBe(Cov.Unexplored);
    expect(m.state(21.5 * cell, 10 * cell)).toBe(Cov.Unexplored);
    const first = m.serialize();
    update(m, []);
    expect(m.visible.every((v) => v === 0)).toBe(true);
    expect(m.state(-0.5 * cell, -0.5 * cell)).toBe(Cov.Explored);
    expect(m.serialize()).toEqual(first);
  });

  it('retains history without expanding it when a present viewer cannot see in darkness', () => {
    const m = create();
    update(m);
    const first = m.serialize();
    for (let i = 0; i < 50; i++) m.updateVision(left, floor, closed, [], 'darkness');
    expect(m.visible.every((v) => v === 0)).toBe(true);
    expect(m.state(10 * cell, 10 * cell)).toBe(Cov.Explored);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Unexplored);
    expect(m.serialize()).toEqual(first);
  });

  it('adds real exploration through an open door and preserves it through closing, reopening and reload', () => {
    const m = create();
    update(m);
    const before = m.serialize().seen;
    update(m, right, open);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Visible);
    expect(m.serialize().seen).not.toBe(before);
    const explored = m.serialize();
    update(m, left);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Explored);
    expect(m.serialize()).toEqual(explored);
    update(m, left, open);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Visible);
    expect(m.serialize()).toEqual(explored);
    const restored = create();
    restored.load(explored);
    for (let i = 0; i < 50; i++) update(restored);
    expect(restored.state(30 * cell, 10 * cell)).toBe(Cov.Explored);
    expect(restored.serialize()).toEqual(explored);
  });

  it('does not dilate manually explored history and keeps reveal and forced-fog overrides', () => {
    const m = create();
    const remembered = rect(28 * cell, 8 * cell, 4 * cell, 4 * cell);
    m.stamp(remembered, 'explored');
    m.stamp(rect(34 * cell, 8 * cell, 4 * cell, 4 * cell), 'reveal');
    m.stamp(rect(8 * cell, 8 * cell, 4 * cell, 4 * cell), 'fog');
    const paint = m.paint.slice();
    for (let i = 0; i < 50; i++) update(m);
    expect(m.state(30 * cell, 10 * cell)).toBe(Cov.Explored);
    expect(m.state(27.5 * cell, 10 * cell)).toBe(Cov.Unexplored);
    expect(m.state(36 * cell, 10 * cell)).toBe(Cov.Visible);
    expect(m.seen[m.idx(36 * cell, 10 * cell)]).toBe(0);
    expect(m.state(10 * cell, 10 * cell)).toBe(Cov.Unexplored);
    expect(m.paint).toEqual(paint);
    m.stamp(floor[0], 'clear');
    expect(m.state(10 * cell, 10 * cell)).toBe(Cov.Visible);
  });
});
