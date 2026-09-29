// 5e light & vision model (PHB ch. 8). See docs §5.
import { dist, segmentsIntersect, type Segment, type Vec2 } from './geometry';
import type { Ambient, LightSource, Wall } from './schema';

export const enum Illum { Dark = 0, Dim = 1, Bright = 2 }

/** Bright radius / dim reaches out to (feet). */
export const LIGHT_PRESETS: Record<string, { bright: number; dim: number; cone?: true }> = {
  candle: { bright: 5, dim: 10 },
  torch: { bright: 20, dim: 40 },
  lamp: { bright: 15, dim: 45 },
  'hooded-lantern': { bright: 30, dim: 60 },
  'bullseye-lantern': { bright: 60, dim: 120, cone: true },
  'light-cantrip': { bright: 20, dim: 40 },
  daylight: { bright: 60, dim: 120 },
};

/** Ambient illumination before any light sources. Barovian overcast is bright but not sunlight. */
export const AMBIENT_ILLUM: Record<Ambient, Illum> = {
  darkness: Illum.Dark,
  'interior-dim': Illum.Dim,
  'barovian-overcast': Illum.Bright,
  night: Illum.Dark,
  fog: Illum.Dim,
  storm: Illum.Dim,
};
/** Barovia rule (Ch. 2): its daylight never counts as sunlight for vampires. */
export const isSunlight = (_a: Ambient) => false;

export interface Blocker extends Segment { terrain: boolean }

/** Walls that block sight. Doors block when closed; windows and invisible walls never do. */
export function sightBlockers(walls: Wall[], revealedSecretDoors: ReadonlySet<string> = new Set()): Blocker[] {
  const out: Blocker[] = [];
  for (const w of walls) {
    const f = new Set(w.flags);
    if (f.has('window') || f.has('invisible')) continue;
    const isDoor = f.has('door') || (f.has('secret-door') && revealedSecretDoors.has(w.id));
    if (isDoor && w.open) continue;
    out.push({ a: w.a, b: w.b, terrain: f.has('terrain') });
  }
  return out;
}

/** Walls that block movement. Ethereal walls never do; windows and closed doors do. */
export function moveBlockers(walls: Wall[]): Segment[] {
  return walls.filter((w) => !w.flags.includes('ethereal') && !((w.flags.includes('door')) && w.open)).map((w) => ({ a: w.a, b: w.b }));
}

export function hasLineOfSight(from: Vec2, to: Vec2, blockers: Blocker[]): boolean {
  let terrain = 0;
  for (const b of blockers) {
    if (!segmentsIntersect(from, to, b.a, b.b)) continue;
    if (!b.terrain) return false;
    if (++terrain >= 2) return false;
  }
  return true;
}

const CONE_HALF = Math.atan(0.5); // 5e cone: width at distance d equals d.

export function lightAt(p: Vec2, l: LightSource, blockers: Blocker[]): Illum {
  const lp: Vec2 = [l.pos[0], l.pos[2]];
  const d = dist(p, lp);
  if (d > l.dim) return Illum.Dark;
  if (l.coneDeg !== undefined && d > 1e-6) {
    const a = Math.atan2(p[1] - lp[1], p[0] - lp[0]);
    let diff = Math.abs(a - (l.coneDeg * Math.PI) / 180) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > CONE_HALF + 1e-9) return Illum.Dark;
  }
  if (!hasLineOfSight(lp, p, blockers)) return Illum.Dark;
  return d <= l.bright ? Illum.Bright : Illum.Dim;
}

export function illuminationAt(p: Vec2, lights: LightSource[], blockers: Blocker[], ambient: Ambient): Illum {
  let best = AMBIENT_ILLUM[ambient];
  for (const l of lights) {
    if (best === Illum.Bright) break;
    const v = lightAt(p, l, blockers);
    if (v > best) best = v;
  }
  return best;
}

export interface Viewer { pos: Vec2; darkvisionFt: number }

export interface Perception { illum: Illum; grayscale: boolean }

/** What a viewer perceives at distance d given actual illumination (darkvision upgrades one step, in gray). */
export function perceive(illum: Illum, d: number, darkvisionFt: number): Perception {
  if (darkvisionFt > 0 && d <= darkvisionFt) {
    if (illum === Illum.Dark) return { illum: Illum.Dim, grayscale: true };
    if (illum === Illum.Dim) return { illum: Illum.Bright, grayscale: false };
  }
  return { illum, grayscale: false };
}

/** Can the viewer see point p? Dim counts (lightly obscured); darkness does not. */
export function canSee(v: Viewer, p: Vec2, lights: LightSource[], blockers: Blocker[], ambient: Ambient): Perception | null {
  if (!hasLineOfSight(v.pos, p, blockers)) return null;
  const per = perceive(illuminationAt(p, lights, blockers, ambient), dist(v.pos, p), v.darkvisionFt);
  return per.illum === Illum.Dark ? null : per;
}
