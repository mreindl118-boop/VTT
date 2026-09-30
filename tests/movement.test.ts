import { describe, expect, it } from 'vitest';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { rect } from '../app/src/core/geometry';
import type { Wall } from '../app/src/core/schema';

// Two 20×20 rooms side by side, split by a wall at x = 20 with a 5-ft door at z 5–10.
const floor = [rect(0, 0, 20, 20), rect(20, 0, 20, 20)];
const walls = (doorOpen: boolean, extra: Partial<Wall> = {}): Wall[] => [
  { id: 'w1', a: [20, 0], b: [20, 5], flags: ['normal'] },
  { id: 'door', a: [20, 5], b: [20, 10], flags: ['door'], open: doorOpen, ...extra },
  { id: 'w2', a: [20, 10], b: [20, 20], flags: ['normal'] },
];

describe('player movement', () => {
  it('walks freely inside a room', () => {
    expect(canWalk([2.5, 2.5], [17.5, 17.5], moveBlockers(walls(false)), floor)).toBe(true);
  });
  it('cannot pass through a wall or a closed door', () => {
    expect(canWalk([17.5, 17.5], [22.5, 17.5], moveBlockers(walls(false)), floor)).toBe(false);
  });
  it('goes around a corner through an open door', () => {
    expect(canWalk([17.5, 17.5], [22.5, 17.5], moveBlockers(walls(true)), floor)).toBe(true);
  });
  it('a locked door still blocks while closed; windows always block', () => {
    expect(canWalk([17.5, 7.5], [22.5, 7.5], moveBlockers(walls(false, { flags: ['door', 'locked'] })), floor)).toBe(false);
    expect(canWalk([17.5, 7.5], [22.5, 7.5], moveBlockers(walls(true, { flags: ['window'] })), floor)).toBe(false);
  });
  it('an unrevealed secret door is a wall', () => {
    expect(canWalk([17.5, 7.5], [22.5, 7.5], moveBlockers(walls(true, { flags: ['secret-door'] })), floor)).toBe(false);
  });
  it('cannot leave the floor', () => {
    expect(canWalk([2.5, 2.5], [-10, 2.5], [], floor)).toBe(false);
  });
});
