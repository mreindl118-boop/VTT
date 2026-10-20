// 5e light & vision model (PHB ch. 8). See docs §5.
import { dist, segmentsIntersect, type Segment, type Vec2 } from './geometry';
import type { Ambient, LightSource, Wall } from './schema';
import { anyThick, bodyLine, bodyOutlines, doorBlockers, hasBody } from './wallBody';

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

/** Walls that block sight. Doors block when closed; windows and invisible walls never do. A wall with a body
 *  (thicknessFt) also blocks along its faces, as drawn; a door's body is its opening, which a shut leaf blocks where it
 *  hangs, in the body's middle (core/wallBody.ts bodyLine: a->b itself unless the wall stands off its line), and across
 *  the body's depth at its two jambs, so nothing is seen round the leaf's end whatever the walls beside it are. */
export function sightBlockers(walls: Wall[], revealedSecretDoors: ReadonlySet<string> = new Set()): Blocker[] {
  const out: Blocker[] = [];
  const isDoor = (w: Wall) => w.flags.includes('door') || (w.flags.includes('secret-door') && revealedSecretDoors.has(w.id));
  // the walls whose body blocks along its outline: their own line, inside the body or on its face, adds nothing
  const solid = (w: Wall) => hasBody(w) && !isDoor(w) && !w.flags.includes('window') && !w.flags.includes('terrain');
  for (const w of walls) {
    const f = new Set(w.flags);
    if (f.has('window') || f.has('invisible')) continue;
    if (isDoor(w) && w.open) continue;
    if (solid(w) || (isDoor(w) && hasBody(w))) continue;   // a shut door with a body: its leaf and jambs, below
    const [a, b] = isDoor(w) ? bodyLine(w) : [w.a, w.b];
    out.push({ a, b, terrain: f.has('terrain') });
  }
  if (anyThick(walls)) {
    for (const s of bodyOutlines(walls, solid)) out.push({ ...s, terrain: false });
    const shut = (w: Wall) => hasBody(w) && isDoor(w) && !w.open && !w.flags.includes('window');
    for (const s of doorBlockers(walls, shut)) out.push({ ...s, terrain: false });
  }
  return out;
}

/** Walls that block movement. Ethereal walls never do; windows and closed doors do. A wall with a body
 *  (thicknessFt) also blocks along its faces, so the party stops at the face it sees; a shut door stops it at its leaf,
 *  in the body's middle, from either side, and across the body's depth at its jambs, so the party cannot go round the
 *  leaf's end where the wall beside it is thinner or stands off the line the other way. */
export function moveBlockers(walls: Wall[]): Segment[] {
  // the walls whose body blocks along its outline: their own line, inside the body or on its face, adds nothing
  const solid = (w: Wall) => hasBody(w) && !w.flags.includes('door');
  // a shut door with a body: its leaf and jambs, below
  const leafed = (w: Wall) => hasBody(w) && w.flags.includes('door');
  const out = walls.filter((w) => !w.flags.includes('ethereal') && !((w.flags.includes('door')) && w.open) && !solid(w) && !leafed(w)).map((w) => {
    const [a, b] = w.flags.includes('door') ? bodyLine(w) : [w.a, w.b];
    return { a, b };
  });
  if (anyThick(walls)) {
    out.push(...bodyOutlines(walls, solid));
    out.push(...doorBlockers(walls, (w) => leafed(w) && !w.open));
  }
  return out;
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
