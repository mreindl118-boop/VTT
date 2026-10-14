import type { Vec2 } from './geometry';
import type { LinkKind, SceneFile } from './schema';

/** One authored direction, retained even when its marker shares another landing. */
export interface LinkMarkerEndpoint {
  linkId: string;
  linkEnd: 'from' | 'to';
  level: string;
  pos: Vec2;
  otherLevel: string;
  kind: LinkKind;
  hiddenObjectId?: string;
}

/** Preserve the existing first-anchor marker spacing without discarding destinations.
 * An explicit operating-object reference survives corrected landing positions.
 * Otherwise only an exactly co-located concealed hatch (or a trapdoor's concealed
 * operating niche) supplies an object reveal gate.
 * Nearby hidden furnishings and elevator pressure plates are not hatch gates.
 */
export function linkMarkerGroups(scene: SceneFile, levelId: string): LinkMarkerEndpoint[][] {
  const level = scene.levels.find(l => l.id === levelId);
  if (!level) return [];
  const groups: LinkMarkerEndpoint[][] = [];
  for (const link of scene.links) for (const linkEnd of ['from', 'to'] as const) {
    const end = link[linkEnd];
    if (end.level !== levelId) continue;
    if (end.hiddenObjectId !== undefined && (typeof end.hiddenObjectId !== 'string' || !end.hiddenObjectId.length
      || !level.objects.some(o => o.id === end.hiddenObjectId && o.vis === 'hidden-object'))) {
      throw new Error(`link ${link.id}/${linkEnd} reveal gate must reference a hidden object on its level`);
    }
    const hidden = level.objects.find(o => o.vis === 'hidden-object'
      && o.pos[0] === end.pos[0] && o.pos[2] === end.pos[1]
      && (o.kind === 'trapdoor' || (link.kind === 'trapdoor' && o.kind === 'niche')));
    // Invalid explicit references are rejected above, never treated as public.
    const hiddenObjectId = end.hiddenObjectId ?? hidden?.id;
    const endpoint: LinkMarkerEndpoint = {
      linkId: link.id, linkEnd, level: end.level, pos: [...end.pos],
      otherLevel: link[linkEnd === 'from' ? 'to' : 'from'].level, kind: link.kind,
      ...(hiddenObjectId !== undefined ? { hiddenObjectId } : {}),
    };
    const group = groups.find(g => Math.hypot(g[0].pos[0] - end.pos[0], g[0].pos[1] - end.pos[1]) < 12);
    if (group) group.push(endpoint);
    else groups.push([endpoint]);
  }
  return groups;
}
