import { describe, expect, it } from 'vitest';
import { Cov, CoverageMap, KEPT, restoreSeen } from '../app/src/core/coverage';
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

describe('a saved record is read only into the grid it was saved for', () => {
  // Castle Ravenloft's main floor as 0.3.3 saved it (origin -57, 18; 489 x 304 cells of 1 ft) and as its regenerated
  // scene lays it out (origin -62, 18; 494 x 304): the same cell, another extent. A run-length record read into the
  // wider grid lands sheared, row by row: rooms never seen show as explored, rooms explored go dark.
  const old = () => new CoverageMap(-57, 18, 489, 304, 1), now = () => new CoverageMap(-62, 18, 494, 304, 1);
  const k8 = rect(195, 70, 40, 30);
  const saved = () => { const m = old(); m.stamp(k8, 'explored'); return m.serialize().seen; };
  const ones = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

  it('a record of another extent at the same cell size is not read', () => {
    const m = now(), read = m.load({ seen: saved(), paint: '' });
    expect(ones(m.seen), 'nothing explored, rather than the old mask sheared across the floor').toBe(0);
    expect(read).toBe(false);
  });
  it('a record of the same grid still reads back whole', () => {
    const m = old();
    expect(m.load({ seen: saved(), paint: '' })).toBe(true);
    expect(m.state(215, 85)).toBe(Cov.Explored);
    expect(ones(m.seen)).toBe(1200);
  });
  it('a record that is not read is kept as it was, beside the level\'s new one, and never overwritten', () => {
    const store: Record<string, string> = { 'K/ground': saved() }, rec = store['K/ground'];
    const m = now();
    restoreSeen(m, store, 'K/ground');
    expect(ones(m.seen)).toBe(0);
    const kept = Object.keys(store).filter((k) => k.startsWith('K/ground' + KEPT));
    expect(kept.length).toBe(1);
    expect(store[kept[0]]).toBe(rec);
    // the level's new memory is saved under its own key; the next open reads it and keeps the old record untouched
    store['K/ground'] = now().serialize().seen;
    const again = now();
    restoreSeen(again, store, 'K/ground');
    expect(store[kept[0]]).toBe(rec);
    expect(Object.keys(store).filter((k) => k.startsWith('K/ground' + KEPT)).length).toBe(1);
    // a record of the grid itself is read, and nothing is kept for it
    const same: Record<string, string> = { 'K/ground': saved() }, o = old();
    restoreSeen(o, same, 'K/ground');
    expect(o.state(215, 85)).toBe(Cov.Explored);
    expect(Object.keys(same)).toEqual(['K/ground']);
  });
  it('a record saved at another cell size is kept the same way (left alone, no longer lost on the next save)', () => {
    const coarse = new CoverageMap(-2, -2, 100, 100, 4); coarse.stamp(rect(0, 0, 40, 40), 'explored');
    const store: Record<string, string> = { 'Y/hill': coarse.serialize().seen };
    const m = new CoverageMap(-2, -2, 80, 80, 5);
    restoreSeen(m, store, 'Y/hill');
    expect(ones(m.seen)).toBe(0);
    store['Y/hill'] = m.serialize().seen;   // the next save of the level's new memory
    expect(Object.values(store).filter((v) => v === coarse.serialize().seen).length, 'the original record survives a save of the new one').toBe(1);
    expect(Object.keys(store).some((k) => k.startsWith('Y/hill' + KEPT))).toBe(true);
  });
});
