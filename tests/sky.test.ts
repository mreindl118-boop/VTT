import { describe, expect, it } from 'vitest';
import { harptos, moonName, moonPhase, skyAt } from '../app/src/core/sky';

describe('the sky', () => {
  it('counts the Calendar of Harptos with its festival days', () => {
    expect(harptos(1)).toBe('1 Mirtul');
    expect(harptos(31)).toBe('1 Kythorn');
    expect(harptos(91)).toBe('Midsummer');
    expect(harptos(92)).toBe('1 Eleasis');
  });
  it('turns the moon on a thirty-day cycle, full on day one', () => {
    expect(moonName(moonPhase(1, 0))).toBe('full moon');
    expect(moonName(moonPhase(16, 5))).toBe('new moon');
    expect(moonName(moonPhase(31, 10))).toBe('full moon');
  });
  it('keeps Barovia dreary at noon and the Sheep Chase country bright', () => {
    const b = skyAt({ day: 1, hour: 12 }, 'gothic'), s = skyAt({ day: 1, hour: 12 }, 'pastoral');
    expect(b.key).toBeLessThan(1); expect(s.key).toBeGreaterThan(1.2);
    expect(b.ambient).toBe('barovian-overcast'); expect(b.night).toBe(false);
  });
  it('falls to night light after dusk, dim at the shoulders', () => {
    expect(skyAt({ day: 1, hour: 23 }, 'gothic').ambient).toBe('night');
    expect(skyAt({ day: 1, hour: 19.9 }, 'gothic').ambient).toBe('fog');
    expect(skyAt({ day: 1, hour: 23 }, 'pastoral').key).toBeLessThan(0.4);
  });
});
