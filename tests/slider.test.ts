import { describe, expect, it } from 'vitest';
import { applyDetents, classOpacity, fogCurve, hiddenCurve, labelCurve } from '../app/src/core/slider';
import { VIS_CLASSES } from '../app/src/core/schema';

describe('slider curves (docs/SLIDER.md)', () => {
  it('endpoints', () => {
    expect(hiddenCurve(0)).toBe(0); expect(hiddenCurve(1)).toBe(1);
    expect(fogCurve(0)).toBe(1); expect(fogCurve(1)).toBe(0);
    expect(labelCurve(0.6)).toBe(0); expect(labelCurve(1)).toBe(1);
  });
  it('mid-values are partial', () => {
    expect(hiddenCurve(0.5)).toBeCloseTo(0.5, 9);
    expect(fogCurve(0.5)).toBeCloseTo(0.5, 9);
    expect(labelCurve(0.5)).toBe(0);
  });
  it('every class is fully hidden at 0 (except base classes) and fully shown at 1', () => {
    for (const v of VIS_CLASSES) {
      expect(classOpacity(v, 1)).toBe(1);
      const base = v === 'player' || v === 'explored' || v === 'unexplored';
      expect(classOpacity(v, 0)).toBe(base ? 1 : 0);
      expect(classOpacity(v, 0, true)).toBe(1); // revealed
    }
  });
  it('curves are monotonic', () => {
    let h = -1, f = 2, l = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      expect(hiddenCurve(t)).toBeGreaterThanOrEqual(h); h = hiddenCurve(t);
      expect(fogCurve(t)).toBeLessThanOrEqual(f); f = fogCurve(t);
      expect(labelCurve(t)).toBeGreaterThanOrEqual(l); l = labelCurve(t);
    }
  });
  it('detents snap near the ends', () => {
    expect(applyDetents(0.02)).toBe(0);
    expect(applyDetents(0.98)).toBe(1);
    expect(applyDetents(0.5)).toBe(0.5);
  });
});
