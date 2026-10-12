// PHB overland travel pace + regional path lengths.
import { dist, type Vec2 } from './geometry';
import { FT_PER_MILE } from './units';

export type Pace = 'fast' | 'normal' | 'slow';
export const PACES: Record<Pace, { mph: number; milesPerDay: number; note: string }> = {
  fast: { mph: 4, milesPerDay: 30, note: '−5 passive Perception' },
  normal: { mph: 3, milesPerDay: 24, note: '' },
  slow: { mph: 2, milesPerDay: 18, note: 'able to use stealth' },
};

/** The pace's effect in each edition. 2014: our short form of the 2014 table's effect column (it is PACES.note).
 *  2024: read at run time from the 2024 book's Travel Pace section (paceNotesFrom), so no rules text lives here. */
export function paceNote(p: Pace, edition: '2014' | '2024', notes2024?: Partial<Record<Pace, string>>): string {
  return edition === '2014' ? PACES[p].note : notes2024?.[p] ?? '';
}

/** The 2024 effects from the Travel Pace section's HTML: each pace's paragraph, shortened to what it imposes or grants
 *  ('Disadvantage on Dexterity (Stealth) checks'). */
export function paceNotesFrom(html: string): Partial<Record<Pace, string>> {
  const out: Partial<Record<Pace, string>> = {};
  for (const m of html.matchAll(/<strong>(Fast|Normal|Slow)\.<\/strong>(?:<\/em>)?\s*([^<]+)/g)) {
    const t = m[2].replace(/^.*?\b(?:imposes|grants)\s+/i, '').replace(/\ba traveler's\s+/i, '').replace(/\.\s*$/, '').trim();
    out[m[1].toLowerCase() as Pace] = t.replace(/^./, (c) => c.toUpperCase());
  }
  return out;
}

export const polylineLengthFt = (pts: Vec2[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

export function travel(pathFt: Vec2[], pace: Pace): { miles: number; hours: number; days: number } {
  const miles = polylineLengthFt(pathFt) / FT_PER_MILE;
  const p = PACES[pace];
  return { miles, hours: miles / p.mph, days: miles / p.milesPerDay };
}
