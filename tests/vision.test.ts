import { describe, expect, it } from 'vitest';
import { canSee, hasLineOfSight, Illum, illuminationAt, LIGHT_PRESETS, sightBlockers, moveBlockers } from '../app/src/core/light';
import type { LightSource, Wall } from '../app/src/core/schema';

// A long dark corridor along +x, 10 ft wide.
const corridor: Wall[] = [
  { id: 'n', a: [0, 0], b: [200, 0], flags: ['normal'] },
  { id: 's', a: [0, 10], b: [200, 10], flags: ['normal'] },
];
const torch = (x: number): LightSource => ({ id: 't', pos: [x, 4, 5], ...LIGHT_PRESETS.torch });

describe('5e light model', () => {
  it('presets match the PHB', () => {
    expect(LIGHT_PRESETS.candle).toEqual({ bright: 5, dim: 10 });
    expect(LIGHT_PRESETS.torch).toEqual({ bright: 20, dim: 40 });
    expect(LIGHT_PRESETS.lamp).toEqual({ bright: 15, dim: 45 });
    expect(LIGHT_PRESETS['hooded-lantern']).toEqual({ bright: 30, dim: 60 });
    expect(LIGHT_PRESETS['bullseye-lantern']).toMatchObject({ bright: 60, dim: 120 });
    expect(LIGHT_PRESETS.daylight).toEqual({ bright: 60, dim: 120 });
  });

  it('a torch-bearer in a dark corridor sees 20 ft bright and 40 ft dim', () => {
    const b = sightBlockers(corridor);
    const L = [torch(0)];
    expect(illuminationAt([20, 5], L, b, 'darkness')).toBe(Illum.Bright);
    expect(illuminationAt([20.5, 5], L, b, 'darkness')).toBe(Illum.Dim);
    expect(illuminationAt([40, 5], L, b, 'darkness')).toBe(Illum.Dim);
    expect(illuminationAt([40.5, 5], L, b, 'darkness')).toBe(Illum.Dark);
    const viewer = { pos: [0, 5] as [number, number], darkvisionFt: 0 };
    expect(canSee(viewer, [39, 5], L, b, 'darkness')?.illum).toBe(Illum.Dim);
    expect(canSee(viewer, [41, 5], L, b, 'darkness')).toBeNull();
  });

  it('darkvision 60 sees 60 ft of dim gray in darkness', () => {
    const b = sightBlockers(corridor);
    const v = { pos: [0, 5] as [number, number], darkvisionFt: 60 };
    const p = canSee(v, [60, 5], [], b, 'darkness');
    expect(p).toEqual({ illum: Illum.Dim, grayscale: true });
    expect(canSee(v, [60.5, 5], [], b, 'darkness')).toBeNull();
    // Dim light inside darkvision range reads as bright.
    expect(canSee(v, [30, 5], [torch(0)], b, 'darkness')).toEqual({ illum: Illum.Bright, grayscale: false });
  });

  it('a closed door blocks sight; an open door and a window do not', () => {
    const door: Wall = { id: 'd', a: [10, -5], b: [10, 15], flags: ['door'] };
    const win: Wall = { id: 'w', a: [10, -5], b: [10, 15], flags: ['window'] };
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([door]))).toBe(false);
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([{ ...door, open: true }]))).toBe(true);
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([win]))).toBe(true);
    expect(moveBlockers([win])).toHaveLength(1); // windows still block movement
  });

  it('secret doors block sight until revealed and opened', () => {
    const sd: Wall = { id: 'sd', a: [10, -5], b: [10, 15], flags: ['secret-door'], open: true };
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([sd]))).toBe(false);
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([sd], new Set(['sd'])))).toBe(true);
  });

  it('terrain walls: see past one, not two; invisible walls never block sight; ethereal never blocks movement', () => {
    const t1: Wall = { id: 'a', a: [5, -5], b: [5, 15], flags: ['terrain'] };
    const t2: Wall = { id: 'b', a: [8, -5], b: [8, 15], flags: ['terrain'] };
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([t1]))).toBe(true);
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([t1, t2]))).toBe(false);
    expect(hasLineOfSight([0, 5], [20, 5], sightBlockers([{ ...t1, flags: ['invisible'] }]))).toBe(true);
    expect(moveBlockers([{ ...t1, flags: ['ethereal'] }])).toHaveLength(0);
  });

  it('bullseye lantern lights a 60-ft cone, dim to 120', () => {
    const l: LightSource = { id: 'b', pos: [0, 4, 0], bright: 60, dim: 120, coneDeg: 0 };
    expect(illuminationAt([59, 0], [l], [], 'darkness')).toBe(Illum.Bright);
    expect(illuminationAt([100, 0], [l], [], 'darkness')).toBe(Illum.Dim);
    expect(illuminationAt([50, 24], [l], [], 'darkness')).toBe(Illum.Bright); // within half-width d/2
    expect(illuminationAt([50, 26], [l], [], 'darkness')).toBe(Illum.Dark);
    expect(illuminationAt([-10, 0], [l], [], 'darkness')).toBe(Illum.Dark);
  });

  it('Barovian overcast is bright light for vision', () => {
    expect(illuminationAt([0, 0], [], [], 'barovian-overcast')).toBe(Illum.Bright);
  });
});
