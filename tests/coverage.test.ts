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

describe('explored memory does not grow without movement (bug 16)', () => {
  const a = rect(0, 0, 20, 20), b = rect(20, 0, 20, 20);
  const walls: Wall[] = [{ id: 'mid', a: [20, 0], b: [20, 20], flags: ['door'] }];
  const ones = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

  it('fifty identical updates leave explored memory as the first one left it', () => {
    const m = CoverageMap.forPolygons([a, b]);
    const viewer = [{ pos: [10, 10] as [number, number], darkvisionFt: 0 }];
    m.updateVision(viewer, [a, b], walls, [], 'barovian-overcast');
    const first = ones(m.seen);
    for (let n = 0; n < 49; n++) m.updateVision(viewer, [a, b], walls, [], 'barovian-overcast');
    expect(ones(m.seen)).toBe(first);
  });

  it('the room behind a closed door stays unexplored however often vision is recomputed', () => {
    const m = CoverageMap.forPolygons([a, b]);
    for (let n = 0; n < 50; n++) m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], walls, [], 'barovian-overcast');
    expect(m.state(30, 10)).toBe(Cov.Unexplored);
    expect(m.state(21.5, 10)).toBe(Cov.Unexplored);
  });

  it('the wall rim next to what was seen is still remembered', () => {
    const m = CoverageMap.forPolygons([a, b]);
    m.updateVision([{ pos: [10, 10], darkvisionFt: 0 }], [a, b], walls, [], 'barovian-overcast');
    m.updateVision([], [a, b], walls, [], 'barovian-overcast'); // the viewer leaves: only memory remains
    expect(m.state(10, 10)).toBe(Cov.Explored);
    expect(m.state(19.5, 10)).toBe(Cov.Explored);
  });
});

describe('coarse fog uses the coverage origin consistently (G03)', () => {
  it('stamps and brushes on a misaligned 2-ft grid at origin (1, 1)', () => {
    const m = new CoverageMap(1, 1, 2, 2, 2);
    m.stamp(rect(1, 1, 2, 2), 'reveal');
    expect(m.state(2, 2)).toBe(Cov.Visible);
    expect(m.state(4, 2)).toBe(Cov.Unexplored);
    expect(m.state(2, 4)).toBe(Cov.Unexplored);
    expect(m.state(4, 4)).toBe(Cov.Unexplored);

    m.brush(2, 2, 0.5, 'fog');
    expect(m.state(2, 2)).toBe(Cov.Unexplored);
    m.brush(2, 2, 0.5, 'reveal');
    expect(m.state(2, 2)).toBe(Cov.Visible);
  });

  it('stamps, brushes and updates vision on the same 10-ft lattice at Vallaki origin (56, 746)', () => {
    const m = new CoverageMap(56, 746, 300, 300, 10);
    const cell0 = rect(56, 746, 10, 10); // cell (0,0), centre (61, 751)
    m.stamp(cell0, 'explored');
    expect(m.state(61, 751)).toBe(Cov.Explored);
    expect(m.state(71, 751)).toBe(Cov.Unexplored);

    m.brush(57, 747, 1, 'reveal');
    expect(m.state(61, 751)).toBe(Cov.Visible);
    m.brush(57, 747, 1, 'fog');
    expect(m.state(61, 751)).toBe(Cov.Unexplored);

    m.brush(57, 747, 1, 'clear');
    m.updateVision([{ pos: [61, 751], darkvisionFt: 0 }], [cell0], [], [], 'daylight');
    expect(m.state(61, 751)).toBe(Cov.Visible);
  });
});

describe('coverage save-migration resampling gate', () => {
  it('encodes cell, origin and dimensions in the header and round-trips', () => {
    const m = new CoverageMap(-12, 8, 20, 15, 2);
    m.stamp(rect(-8, 12, 12, 10), 'explored');
    m.brush(-2, 16, 3, 'reveal');
    const s = m.serialize();
    expect(s.seen).toMatch(/^c2@-12,8\/20x15:/);
    expect(s.paint).toMatch(/^c2@-12,8\/20x15:/);
    const n = new CoverageMap(-12, 8, 20, 15, 2);
    expect(n.load(s)).toBe(true);
    expect(Array.from(n.seen)).toEqual(Array.from(m.seen));
    expect(Array.from(n.paint)).toEqual(Array.from(m.paint));
  });

  it('conservatively resamples when origin, size or cell change without revealing unknown slivers', () => {
    // Room A [0, 20]x[0, 20] is explored; Room B [20, 40]x[0, 20] is unexplored behind a wall at x = 20.
    const oldMap = new CoverageMap(-2, -2, 20, 12, 2);
    oldMap.stamp(rect(0, 0, 20, 20), 'explored');
    expect(oldMap.state(18, 10)).toBe(Cov.Explored);
    expect(oldMap.state(21, 10)).toBe(Cov.Unexplored);

    // Regenerated map has a larger extent (-20, -20) and 5-ft cells.
    const newMap = new CoverageMap(-20, -20, 20, 16, 5);
    expect(newMap.load(oldMap.serialize())).toBe(true);
    // Interior of Room A (e.g. [0, 15]x[0, 15]) is completely inside old explored cells -> stays Explored.
    expect(newMap.state(2.5, 2.5)).toBe(Cov.Explored);
    expect(newMap.state(12.5, 12.5)).toBe(Cov.Explored);
    // The 5-ft cell [15, 20]x[5, 10] straddles old cell i=8 ([14, 18], explored) and i=9 ([18, 20], explored) -> Explored.
    expect(newMap.state(17.5, 7.5)).toBe(Cov.Explored);
    // Room B and the new apron outside the old map stay strictly Unexplored (no unknown slivers revealed).
    expect(newMap.state(20.5, 10)).toBe(Cov.Unexplored);
    expect(newMap.state(-10, -10)).toBe(Cov.Unexplored);
  });

  it('resamples legacy c4: records of ch14/Y/hill from 0.3.1 4-ft geometry at (-2, -2) to the 5-ft grid', () => {
    for (const [w0, h0] of [[201, 201], [437, 564]] as const) {
      const oldHill = new CoverageMap(-2, -2, w0, h0, 4);
      // Explore a 60x60 ft clearing at [100, 160]x[100, 160], leaving [160, ...] unexplored.
      oldHill.stamp(rect(100, 100, 60, 60), 'explored');
      // Strip the new @origin/size header to simulate a 0.3.1 save ("c4:<rle>").
      const legacySeen = oldHill.serialize().seen.replace(/^c4@[^:]+:/, 'c4:');
      expect(legacySeen.startsWith('c4:')).toBe(true);

      for (const [ox, oz, w1, h1] of [[-252, -252, 281, 281], [-363, -173, 490, 554]] as const) {
        const newHill = new CoverageMap(ox, oz, w1, h1, 5);
        expect(newHill.load({ seen: legacySeen, paint: '' })).toBe(true);
        // Explored clearing interior carries over:
        expect(newHill.state(130, 130)).toBe(Cov.Explored);
        expect(newHill.state(110, 150)).toBe(Cov.Explored);
        // Unexplored ground just outside the clearing and in the new apron stays Unexplored:
        expect(newHill.state(164, 130)).toBe(Cov.Unexplored);
        expect(newHill.state(-200, -150)).toBe(Cov.Unexplored);
      }
    }
  });

  it('preserves an unplaceable legacy record under a @legacy side key instead of dropping or corrupting', () => {
    const m = new CoverageMap(0, 0, 10, 10, 1);
    const store: Record<string, string> = { 'custom/level': 'c3:0x10,1x15,0x25' };
    const ok = m.load({ seen: store['custom/level'], paint: '' }, store, 'custom/level');
    expect(ok).toBe(false);
    expect(m.seen.every((v) => v === 0)).toBe(true);
    expect(store['custom/level@legacy']).toBe('c3:0x10,1x15,0x25');
  });
});
