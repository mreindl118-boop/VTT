// The campaign calendar the session notes keep (calendar.json): which in-world day the story has reached, the day
// the moon is new, and a short line per day. The VTT's clock panel loads it; the moon is then drawn from it.
// Matt's rule (2026-11-12): day 0 is the night before the new moon; the new moon is the party's first night in
// Barovia (day 1); every in-world day the notes move on turns the moon with it.

export interface CalendarDay { day: number; session?: number; title?: string; note?: string }
export interface Calendar { title?: string; newMoonDay: number; now?: { day: number; hour: number }; days: CalendarDay[] }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max = 400): string | undefined => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

/** Read a calendar file; a clear error for anything that is not one. */
export function parseCalendar(text: string): { ok: true; cal: Calendar } | { ok: false; error: string } {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, error: 'That file is not JSON.' }; }
  if (!j || typeof j !== 'object' || j.kind !== 'calendar') return { ok: false, error: 'That is not a calendar file (kind should be "calendar").' };
  if (j.schema !== 1) return { ok: false, error: 'This calendar is a newer version than the VTT reads.' };
  if (!num(j.newMoonDay)) return { ok: false, error: 'The calendar has no newMoonDay.' };
  const n = j.now as Record<string, unknown> | undefined;
  const now = n && num(n.day) ? { day: Math.max(0, Math.round(n.day)), hour: num(n.hour) ? ((n.hour % 24) + 24) % 24 : 12 } : undefined;
  const days: CalendarDay[] = [];
  for (const d of Array.isArray(j.days) ? j.days as Record<string, unknown>[] : []) {
    if (!d || !num(d.day)) continue;
    days.push({ day: Math.round(d.day), ...(num(d.session) ? { session: d.session } : {}), ...(str(d.title, 120) ? { title: str(d.title, 120) } : {}), ...(str(d.note) ? { note: str(d.note) } : {}) });
  }
  days.sort((a, b) => a.day - b.day);
  return { ok: true, cal: { ...(str(j.title, 120) ? { title: str(j.title, 120) } : {}), newMoonDay: j.newMoonDay, ...(now ? { now } : {}), days } };
}

/** The calendar's line for a day, if it has one. */
export const dayEntry = (cal: Calendar | undefined, day: number): CalendarDay | undefined => cal?.days.find((d) => d.day === day);
