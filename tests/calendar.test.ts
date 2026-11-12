import { describe, expect, it } from 'vitest';
import { dayEntry, parseCalendar } from '../app/src/core/calendar';
import { moonName, moonPhaseFromNew, skyAt } from '../app/src/core/sky';

const night = (day: number, newMoon = 1) => moonName(moonPhaseFromNew(day, 21, newMoon));

describe('the campaign calendar and the moon', () => {
  it('day 0 is the night before the new moon; the first night in Barovia is new', () => {
    expect(night(0)).toBe('waning crescent');
    expect(night(1)).toBe('new moon');
    expect(night(2)).toBe('waxing crescent');
  });
  it('names each principal phase on one night only, matching the notes timeline', () => {
    const named = (n: string) => Array.from({ length: 32 }, (_, d) => d).filter((d) => night(d) === n);
    expect(named('new moon')).toEqual([1, 31]);
    expect(named('first quarter')).toEqual([9]);
    expect(named('full moon')).toEqual([16]);
    expect(named('last quarter')).toEqual([24]);
  });
  it('the Barovian sky follows the calendar: new on day 1 by default, or where the calendar puts it', () => {
    expect(skyAt({ day: 1, hour: 21 }, 'gothic').moonName).toBe('new moon');
    expect(skyAt({ day: 1, hour: 21, newMoon: 5 }, 'gothic').moonName).not.toBe('new moon');
    expect(skyAt({ day: 5, hour: 21, newMoon: 5 }, 'gothic').moonName).toBe('new moon');
    expect(skyAt({ day: 0, hour: 21 }, 'gothic').label).toMatch(/^Day 0 · 21:00/);
  });
  it('reads the notes calendar file and refuses anything else', () => {
    const r = parseCalendar(JSON.stringify({ schema: 1, kind: 'calendar', title: 'CoS', newMoonDay: 1, now: { day: 1, hour: 8 }, cycleDays: 30.4375,
      days: [{ day: 1, session: 1, title: 'Into the mists', note: 'x'.repeat(900), moon: 'new' }, { day: 0, session: 0, title: 'The night before' }, { title: 'no day' }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cal.now).toEqual({ day: 1, hour: 8 });
    expect(r.cal.days.map((d) => d.day)).toEqual([0, 1]);
    expect(dayEntry(r.cal, 1)?.note).toHaveLength(400);
    expect(dayEntry(r.cal, 7)).toBeUndefined();
    expect(parseCalendar('not json').ok).toBe(false);
    expect(parseCalendar(JSON.stringify({ schema: 1, kind: 'party' })).ok).toBe(false);
    expect(parseCalendar(JSON.stringify({ schema: 2, kind: 'calendar', newMoonDay: 1 })).ok).toBe(false);
    expect(parseCalendar(JSON.stringify({ schema: 1, kind: 'calendar' })).ok).toBe(false);
  });
});

it('names the moon by its night: the morning and the small hours of the new moon night say new moon', () => {
  expect(skyAt({ day: 1, hour: 8 }, 'gothic').moonName).toBe('new moon');
  expect(skyAt({ day: 2, hour: 3 }, 'gothic').moonName).toBe('new moon');
  expect(skyAt({ day: 2, hour: 8 }, 'gothic').moonName).toBe('waxing crescent');
  expect(skyAt({ day: 1, hour: 3 }, 'gothic').moonName).toBe('waning crescent');
});
