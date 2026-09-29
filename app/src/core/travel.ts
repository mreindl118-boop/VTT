// PHB overland travel pace + regional path lengths.
import { dist, type Vec2 } from './geometry';
import { FT_PER_MILE } from './units';

export type Pace = 'fast' | 'normal' | 'slow';
export const PACES: Record<Pace, { mph: number; milesPerDay: number; note: string }> = {
  fast: { mph: 4, milesPerDay: 30, note: '−5 passive Perception' },
  normal: { mph: 3, milesPerDay: 24, note: '' },
  slow: { mph: 2, milesPerDay: 18, note: 'able to use stealth' },
};

export const polylineLengthFt = (pts: Vec2[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

export function travel(pathFt: Vec2[], pace: Pace): { miles: number; hours: number; days: number } {
  const miles = polylineLengthFt(pathFt) / FT_PER_MILE;
  const p = PACES[pace];
  return { miles, hours: miles / p.mph, days: miles / p.milesPerDay };
}
