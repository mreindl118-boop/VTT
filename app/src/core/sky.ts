// The sky over a map: the hour of the day and the day of the campaign decide the sun, the moon and the light.
// Each campaign has its own sky: Barovia's sun never breaks the overcast (the book: the sun is a pale disc,
// the days dreary, the nights black); the Sheep Chase country gets honest daylight and a starry night.
// Calendar: the Calendar of Harptos (twelve months of thirty days with the five festival days between them),
// which the characters would reckon by, and Selûne's cycle of 30 days and 10½ hours for the moon's phase.
import type { Ambient } from './schema';

export interface Clock { day: number; hour: number }
export interface Sky {
  /** Sun (or moon, at night) direction as azimuth (radians, 0 = east, clockwise seen from above) and elevation. */
  azimuth: number; elevation: number;
  key: number; keyColor: string; hemi: number; skyLight: string; groundLight: string;
  mist: string; page0: string; page1: string;
  /** The light the rules see outdoors at this hour. */
  ambient: Ambient;
  phase: number; moonName: string; moonLit: number; night: boolean; label: string;
}
export type SkyStyle = 'gothic' | 'pastoral';

const MONTHS = [['Hammer', 'Deepwinter'], ['Alturiak', 'The Claw of Winter'], ['Ches', 'The Claw of the Sunsets'], ['Tarsakh', 'The Claw of the Storms'], ['Mirtul', 'The Melting'], ['Kythorn', 'The Time of Flowers'],
  ['Flamerule', 'Summertide'], ['Eleasis', 'Highsun'], ['Eleint', 'The Fading'], ['Marpenoth', 'Leaffall'], ['Uktar', 'The Rotting'], ['Nightal', 'The Drawing Down']];
export const SYNODIC = 30.4375;

const FEST_AFTER: Record<number, string> = { 0: 'Midwinter', 3: 'Greengrass', 6: 'Midsummer', 8: 'Highharvestide', 10: 'The Feast of the Moon' };
/** Day N of the campaign → the Harptos date, counting from a chosen start (day 1 = 1 Mirtul by default: the campaign opens in spring). */
export function harptos(day: number, start = 122): string {
  let d = ((start + day - 1) % 365 + 365) % 365; // 0-based day of the year
  for (let m = 0; m < 12; m++) {
    if (d < 30) return `${d + 1} ${MONTHS[m][0]}`;
    d -= 30;
    if (FEST_AFTER[m] !== undefined) { if (d === 0) return FEST_AFTER[m]; d -= 1; }
  }
  return 'Shieldmeet';
}
/** Month names for pickers (the five festival days sit after their months). */
export const MONTH_NAMES = MONTHS.map((m) => m[0]);
export const FESTIVALS: { name: string; after: number }[] = Object.entries(FEST_AFTER).map(([m, name]) => ({ name, after: Number(m) }));
/** The campaign day that falls on a Harptos date: month 0..11 with a day 1..30, or a festival (`month` = 12 + its index). */
export function dayFromHarptos(month: number, dom: number, start = 122): number {
  let d = 0;
  if (month < 12) { for (let m = 0; m < month; m++) { d += 30; if (FEST_AFTER[m] !== undefined) d += 1; } d += Math.min(30, Math.max(1, dom)) - 1; }
  else { const f = FESTIVALS[month - 12]; for (let m = 0; m <= f.after; m++) { d += 30; if (FEST_AFTER[m] !== undefined && m < f.after) d += 1; } }
  return ((d - start) % 365 + 365) % 365 + 1;
}
/** The Harptos date of a campaign day as (month, day) for the pickers. */
export function harptosParts(day: number, start = 122): { month: number; dom: number } {
  let d = ((start + day - 1) % 365 + 365) % 365;
  for (let m = 0; m < 12; m++) {
    if (d < 30) return { month: m, dom: d + 1 };
    d -= 30;
    if (FEST_AFTER[m] !== undefined) { if (d === 0) return { month: 12 + FESTIVALS.findIndex((f) => f.after === m), dom: 1 }; d -= 1; }
  }
  return { month: 0, dom: 1 };
}
export function monthMood(day: number, start = 122): string { const d = ((start + day - 1) % 365 + 365) % 365; return MONTHS[Math.min(11, Math.floor(d / 30.42))][1]; }

/** Moon phase 0..1 (0 = new, 0.5 = full), full on `fullDay` of the campaign. */
export function moonPhase(day: number, hour: number, fullDay = 1): number {
  const t = day + hour / 24 - fullDay;
  return (((t / SYNODIC) + 0.5) % 1 + 1) % 1;
}
export function moonName(phase: number): string {
  const p = phase;
  if (p < 0.03 || p > 0.97) return 'new moon';
  if (p < 0.22) return 'waxing crescent'; if (p < 0.28) return 'first quarter'; if (p < 0.47) return 'waxing gibbous';
  if (p < 0.53) return 'full moon'; if (p < 0.72) return 'waning gibbous'; if (p < 0.78) return 'last quarter'; return 'waning crescent';
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], Math.min(1, Math.max(0, t)))).toString(16).padStart(2, '0')).join(''); };
export const fmtHour = (h: number) => { const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60) % 60; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

/** The sky at an hour: a smooth day curve keyed by sunrise/sunset, with the campaign's own palette. */
export function skyAt(clock: Clock, style: SkyStyle, authored: Ambient = 'barovian-overcast'): Sky {
  const h = ((clock.hour % 24) + 24) % 24;
  const sunrise = 6.5, sunset = 19.5;
  // daylight factor: 0 at night, 1 in full day, soft shoulders an hour wide either side of the sun's crossing
  const day = h < sunrise - 1 || h > sunset + 1 ? 0 : h < sunrise + 1 ? (h - (sunrise - 1)) / 2 : h > sunset - 1 ? ((sunset + 1) - h) / 2 : 1;
  const span = (sunset - sunrise) / 2;
  const elevation = day > 0 ? Math.max(0.05, Math.sin(Math.PI * Math.max(0, Math.min(1, (h - sunrise) / (2 * span)))) * 1.1) : 0.5;
  const azimuth = day > 0 ? Math.PI * ((h - sunrise) / (2 * span)) : Math.PI * (((h + 24 - sunset) % 24) / (24 - 2 * span));
  const golden = day > 0 && day < 1 ? 1 - day : 0; // the shoulders are amber
  const phase = moonPhase(clock.day, h), moonLit = 1 - Math.abs(phase - 0.5) * 2; // 1 at full
  const night = day === 0;
  const P = style === 'gothic'
    ? { // Barovia: a sun that never gets through, grey-amber days, black nights with a wan moon
      keyDay: 0.85, keyNight: 0.12 + 0.18 * moonLit, keyColorDay: '#d9d0bd', keyColorDusk: '#b99470', keyColorNight: '#8e9ab8',
      hemiDay: 2.0, hemiNight: 0.35 + 0.25 * moonLit, skyDay: '#c3c6d2', skyNight: '#2a2d3d', groundDay: '#3a3138', groundNight: '#15121a',
      mistDay: '#5e5c68', mistDusk: '#5a4a4e', mistNight: '#15131b', page0Day: '#4a4454', page0Night: '#1b1822', page1Day: '#262130', page1Night: '#0b0a0f' }
    : { // the Sheep Chase country: bright days, golden evenings, blue nights
      keyDay: 1.4, keyNight: 0.1 + 0.25 * moonLit, keyColorDay: '#fff4dc', keyColorDusk: '#ffb36b', keyColorNight: '#9fb0d8',
      hemiDay: 1.9, hemiNight: 0.3 + 0.3 * moonLit, skyDay: '#d8ecff', skyNight: '#1c2440', groundDay: '#6b7a55', groundNight: '#161a22',
      mistDay: '#d7dfe6', mistDusk: '#d8b9a2', mistNight: '#121826', page0Day: '#bfd3e8', page0Night: '#141a2c', page1Day: '#8fb0d0', page1Night: '#070a14' };
  const key = lerp(P.keyNight, P.keyDay, day) * (golden ? 0.8 : 1);
  const keyColor = night ? P.keyColorNight : mix(mix(P.keyColorDay, P.keyColorDusk, golden), P.keyColorNight, 1 - day);
  const hemi = lerp(P.hemiNight, P.hemiDay, day);
  const skyLight = mix(P.skyNight, P.skyDay, day), groundLight = mix(P.groundNight, P.groundDay, day);
  const mist = mix(P.mistNight, mix(P.mistDay, P.mistDusk, golden), day);
  const page0 = mix(P.page0Night, P.page0Day, day), page1 = mix(P.page1Night, P.page1Day, day);
  // what the rules see: by day the authored ambient (overcast still counts as bright light); after dusk, night
  const ambient: Ambient = day >= 0.5 ? authored : day > 0 ? 'fog' : 'night';
  const mn = moonName(phase);
  return { azimuth, elevation, key, keyColor, hemi, skyLight, groundLight, mist, page0, page1, ambient, phase, moonName: mn, moonLit, night,
    label: `Day ${clock.day} · ${fmtHour(h)} · ${harptos(clock.day)} · ${mn}` };
}
