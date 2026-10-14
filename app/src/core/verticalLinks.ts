import { pointInPolygon, segmentsIntersect, type Polygon, type Segment, type Vec2 } from './geometry';
import { squareCellAt, squareCellCenter } from './grid';
import type { VerticalLink } from './schema';

type Actor = { level: string; pos: Vec2 };
export interface VerticalTransition { link: VerticalLink; to: VerticalLink['to'] }
const near = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 5.5;

/** One action resolves against the original level, never against its own arrival. */
export class VerticalTransitions {
  private arrival?: { actor: Actor; links: VerticalLink[]; level: string; ends: Vec2[] };

  resolve(links: VerticalLink[], actor: Actor, requested?: string, previous?: Vec2): VerticalTransition | undefined {
    const arrival = this.arrival;
    if (requested === undefined && arrival) {
      if (arrival.actor === actor && arrival.links === links && arrival.level === actor.level && arrival.ends.some(p => near(p, actor.pos))) return;
      this.arrival = undefined;
    }
    for (const link of links) {
      if (requested !== undefined && link.id !== requested) continue;
      // Some authored stairs join two positions on the same level. Pick the near end.
      const ends = [[link.from, link.to], [link.to, link.from]];
      ends.sort(([a], [b]) => Math.hypot(a.pos[0] - actor.pos[0], a.pos[1] - actor.pos[1]) - Math.hypot(b.pos[0] - actor.pos[0], b.pos[1] - actor.pos[1]));
      for (const [from, to] of ends) {
        if (from.level === actor.level && (requested !== undefined || (near(from.pos, actor.pos) && (!previous || !near(from.pos, previous))))) return { link, to };
      }
    }
  }

  /** Let the party walk off a shared landing before proximity can take another link.
   * Explicit clicks still work immediately, including a deliberate return trip. */
  arrived(links: VerticalLink[], actor: Actor): void {
    this.arrival = { actor, links, level: actor.level, ends: links.flatMap(k => [k.from, k.to])
      .filter(end => end.level === actor.level && near(end.pos, actor.pos)).map(end => end.pos) };
  }
}

/** Grid snapping must not push a valid authored landing off its floor or through a wall.
 * Invalid authored landings remain authoring findings; never search across walls for a replacement. */
export function verticalArrival(pos: Vec2, origin: Vec2, floor: Polygon[], blockers: Segment[]): Vec2 {
  const snapped = squareCellCenter(squareCellAt(pos, origin), origin);
  const onFloor = (p: Vec2) => floor.some(poly => pointInPolygon(p, poly));
  if (onFloor(pos) && (!onFloor(snapped) || blockers.some(w => segmentsIntersect(pos, snapped, w.a, w.b)))) return [...pos];
  return snapped;
}
