// Stairs, ladders, trapdoors, lifts and slides: the scene's vertical links, which one a move or a click takes, and the
// markers that offer them. One move takes at most one link, and which one never depends on the order the scene lists
// its links in (app.ts takeLink and afterPartyMove apply what these choose).
import type { Vec2 } from './geometry';
import type { VerticalLink } from './schema';

/** Within this distance of a link's end the party takes it: a cell, and half a foot. */
export const LINK_TRIGGER_FT = 5.5;
/** Link ends closer than this to a marker's first end share that marker (the old one-marker-per-stair spacing). */
export const LINK_MARKER_FT = 12;

export type LinkEnd = 'from' | 'to';
/** One way through a link: in at one of its ends (`from`), out at the other (`to`). */
export interface LinkRoute { link: VerticalLink; end: LinkEnd; from: VerticalLink['from']; to: VerticalLink['to'] }
/** What a move onto link ends takes: one route, or a choice the DM makes (two ends equally near: an up and a down
 *  stair on one landing), or nothing. */
export type LinkStep = { route: LinkRoute } | { choices: LinkRoute[] } | null;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The way through `link` that goes in at its `end`. */
export function routeOf(link: VerticalLink, end: LinkEnd): LinkRoute {
  return { link, end, from: link[end], to: link[end === 'from' ? 'to' : 'from'] };
}

/** Every way out of a level: one per link end on it (a passage with both ends on it gives two), in the scene's order. */
export function routesOn(links: readonly VerticalLink[], level: string): LinkRoute[] {
  return links.flatMap((k) => (['from', 'to'] as const).filter((e) => k[e].level === level).map((e) => routeOf(k, e)));
}

/** The link the DM chose by its id, from where the party stands: in at its end on the party's level (of a passage with
 *  both ends there, the nearer one, so the party comes out at the far end). None for an unknown id, or a link with no
 *  end on the party's level. */
export function chosenRoute(links: readonly VerticalLink[], linkId: string, at: { level: string; pos: Vec2 }): LinkRoute | undefined {
  const k = links.find((x) => x.id === linkId);
  if (!k) return undefined;
  const here = (['from', 'to'] as const).filter((e) => k[e].level === at.level);
  if (!here.length) return undefined;
  return routeOf(k, here.length === 2 && dist(k.to.pos, at.pos) < dist(k.from.pos, at.pos) ? 'to' : here[0]);
}

/** What a move takes: a link whose trigger the party entered, that is, within LINK_TRIGGER_FT of one of its ends now
 *  and not before the move (walking off a landing, or standing still, takes none). `before` is where the party stood
 *  on this level before the move; null when it came from another level (every end it now stands on is entered). Of
 *  several, the nearest; two equally near are a choice for the DM, never the array's order. */
export function enteredRoute(links: readonly VerticalLink[], at: { level: string; pos: Vec2 }, before: Vec2 | null): LinkStep {
  const entered = routesOn(links, at.level)
    .filter((r) => dist(r.from.pos, at.pos) <= LINK_TRIGGER_FT && !(before && dist(r.from.pos, before) <= LINK_TRIGGER_FT))
    .map((r) => ({ r, d: dist(r.from.pos, at.pos) }))
    .sort((a, b) => a.d - b.d);
  if (!entered.length) return null;
  const nearest = entered.filter((e) => e.d - entered[0].d < 1e-6);
  return nearest.length > 1 ? { choices: nearest.map((e) => e.r) } : { route: entered[0].r };
}

/** A level's stair markers: the link ends within LINK_MARKER_FT of a marker's first end share it, and each of them keeps
 *  its own way out there (never only the first link's). */
export function linkMarkers(links: readonly VerticalLink[], level: string): LinkRoute[][] {
  const markers: LinkRoute[][] = [];
  for (const r of routesOn(links, level)) {
    const m = markers.find((g) => dist(g[0].from.pos, r.from.pos) < LINK_MARKER_FT);
    if (m) m.push(r);
    else markers.push([r]);
  }
  return markers;
}
