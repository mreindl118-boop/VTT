// The world atlas: where every built map stands in its campaign's valley, computed from locations/**/scene.json and the
// two world.json files with the frame maths of app/src/core/frames.ts. Written to manifests/world-atlas.json; the app's
// world stage and streamer read it, tests/atlas.test.ts checks it (and that the committed file is fresh).
// Usage: node --experimental-transform-types scripts/world-atlas.ts (npm run atlas; also the first step of npm run build)
//
// Rules: a pin's root is its listed scene without `parent` that has terrain (ch03/E for pin E). A scene listed at two
// pins (ch02/B at B and B2) is placed at the first; the second pin keeps a proxy and a label only (`proxyOnly`).
// A child (`scene.parent`) hangs at the centroid of the parent room that opens it (`enter`). A scene with a pin but no
// root placement and no anchor is flagged in `errors`; blowouts far bigger than their plot are listed in `warnings`.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MI_FT, NEST_LIFT, RELIEF, boundsInParent, centreOf, centroid, childPlacement, diagOf, enterRoomOf, flattenReach, footprintOf, grow, groundY, l0Of, overlaps,
  roadExit, rootPlacement, siteRoads, toLocal, worldCentre, worldOfMiles, type Bounds, type Footprint, type North, type Placement,
} from '../app/src/core/frames.ts';
import type { Level, SceneFile } from '../app/src/core/schema';
import type { Campaign, WorldData } from '../app/src/campaigns';

export interface AtlasLevel { id: string; name: string; elevationFt: number; ceilingFt?: number }
export interface AtlasScene {
  path: string; campaign: string; name: string; location: string;
  /** The pin this map is placed at (roots), and any other pins that list it (proxy and label only there). */
  pin?: string; alsoAt?: string[];
  parent?: string; enterRoom?: { key: string; level: string };
  /** 0 for a pin root, 1 for a map inside it, 2 for a map inside that. The chain's root path. */
  depth: number; root: string;
  /** A scene with no pin and no parent (dev/*): opened the legacy way, never placed. */
  orphan?: boolean;
  l0: string; north: North; elevationFt: number; bbox: Bounds; centre: [number, number];
  levels: AtlasLevel[]; stacked: boolean | 'open'; outdoor: boolean; interior: boolean; clearingFt?: number;
  /** Roots: where each world road leaving the site starts, in the map's own frame (backdrop.ts's exitFor rule). */
  roadExits: { road: string; bearing: number; x: number; z: number }[];
  /** Roots: in W (feet, x east, z south). Children: in the parent's frame. */
  placement: Placement;
  /** Roots: the footprint and its flatten band in W. */
  worldBounds?: Bounds; bandFt?: number; crag?: boolean;
  /** Children: the centroid of the enter room (parent frame) and the yaw difference. */
  anchor?: { x: number; z: number; dTheta: number };
  /** Children: the plot the parent gives this map, and how much bigger the map's own extent is. */
  footprintInParent?: Bounds; blowout?: number;
  objects: number; units: number;
}
export interface AtlasPin { campaign: string; key: string; name: string; type: string; pos: [number, number]; world: [number, number]; groundY: number; heightFt?: number; scenes: string[]; root?: string; proxyOnly: boolean }
export interface Atlas {
  schema: 1; generator: string;
  constants: { MI_FT: number; RELIEF: number; NEST_LIFT: number };
  campaigns: Record<string, { world: string; name: string; centre: [number, number]; bounds: WorldData['bounds'] }>;
  pins: AtlasPin[];
  scenes: Record<string, AtlasScene>;
  /** Pairs of root maps whose flatten bands overlap (the land blends their bases); the data pass decides. */
  bandOverlaps: { campaign: string; scenes: [string, string]; gapFt: number }[];
  warnings: string[]; errors: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '..');
const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

/** Every built scene under a locations/ root, as `chapter/location` paths. */
export function scenePaths(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f), r = rel ? `${rel}/${f}` : f;
      if (statSync(p).isDirectory()) walk(p, r); else if (f === 'scene.json') out.push(rel);
    }
  };
  walk(root, '');
  return out;
}

/** Build the atlas for a repository root. */
export function buildAtlas(repo = REPO): Atlas {
  const { campaigns } = readJson<{ campaigns: Campaign[] }>(join(repo, 'manifests/campaigns.json'));
  const worlds = new Map<string, WorldData>(campaigns.map((c) => [c.id, readJson<WorldData>(join(repo, 'locations', c.world, 'world.json'))]));
  const campaignOf = (path: string) => campaigns.find((c) => c.prefixes.some((p) => path.startsWith(p + '/')));
  const scenes = new Map<string, SceneFile>();
  for (const p of scenePaths(join(repo, 'locations'))) scenes.set(p, readJson<SceneFile>(join(repo, 'locations', p, 'scene.json')));
  const warnings: string[] = [], errors: string[] = [];
  const atlas: Atlas = {
    schema: 1, generator: 'scripts/world-atlas.ts', constants: { MI_FT, RELIEF, NEST_LIFT },
    campaigns: Object.fromEntries(campaigns.map((c) => { const w = worlds.get(c.id)!; return [c.id, { world: c.world, name: w.name, centre: worldCentre(w) as [number, number], bounds: w.bounds }]; })),
    pins: [], scenes: {}, bandOverlaps: [], warnings, errors,
  };

  // 1. Pins and their roots. A scene's pin is the first pin that lists it; later pins get a proxy and a label only.
  const pinOf = new Map<string, { campaign: Campaign; key: string }>(), alsoAt = new Map<string, string[]>();
  const rootOf = new Map<string, string>(); // pin key (per campaign) → root scene path
  for (const c of campaigns) {
    const w = worlds.get(c.id)!;
    for (const pin of w.pins) {
      const listed = pin.scenes ?? [];
      for (const path of listed) {
        if (!scenes.has(path)) { errors.push(`${c.id}: pin ${pin.key} lists ${path}, which is not built`); continue; }
        if (pinOf.has(path)) alsoAt.set(path, [...(alsoAt.get(path) ?? []), pin.key]); else pinOf.set(path, { campaign: c, key: pin.key });
      }
      const roots = listed.filter((p) => scenes.has(p) && !scenes.get(p)!.parent && !!l0Of(scenes.get(p)!).terrain?.length && pinOf.get(p)?.key === pin.key);
      if (roots.length > 1) warnings.push(`${c.id}: pin ${pin.key} has ${roots.length} root candidates (${roots.join(', ')}); ${roots[0]} is placed`);
      const root = roots[0];
      if (root) rootOf.set(`${c.id}/${pin.key}`, root);
      const proxyOnly = !root;
      if (listed.length && !root && !listed.some((p) => scenes.has(p) && pinOf.get(p)?.key !== pin.key)) errors.push(`${c.id}: pin ${pin.key} lists ${listed.join(', ')} but none is a root (no parent, has terrain)`);
      atlas.pins.push({ campaign: c.id, key: pin.key, name: pin.name, type: pin.type, pos: pin.pos, world: worldOfMiles(w, pin.pos) as [number, number], groundY: pin.groundFt ?? groundY(w, pin.pos), ...(pin.heightFt ? { heightFt: pin.heightFt } : {}), scenes: listed, ...(root ? { root } : {}), proxyOnly });
    }
  }

  // 2. Every scene: its footprint, chain and placement.
  const entryOf = new Map<string, AtlasScene>();
  const depthOf = (path: string, seen = new Set<string>()): number => { const s = scenes.get(path)!; if (!s.parent || !scenes.has(s.parent) || seen.has(path)) return 0; seen.add(path); return 1 + depthOf(s.parent, seen); };
  const chainRoot = (path: string): string => { let p = path; const seen = new Set<string>(); while (scenes.get(p)?.parent && scenes.has(scenes.get(p)!.parent!) && !seen.has(p)) { seen.add(p); p = scenes.get(p)!.parent!; } return p; };
  for (const [path, s] of scenes) {
    const c = campaignOf(path);
    if (!c) { errors.push(`${path}: no campaign claims its prefix`); continue; }
    const w = worlds.get(c.id)!, l0 = l0Of(s) as Level, fp: Footprint = footprintOf(l0), amb = l0.ambient ?? s.ambient;
    const objects = s.levels.reduce((n, l) => n + l.objects.length, 0);
    const e: AtlasScene = {
      path, campaign: c.id, name: s.name, location: s.location, depth: depthOf(path), root: chainRoot(path),
      l0: l0.id, north: l0.north ?? '-z', elevationFt: l0.elevationFt, bbox: fp.bbox, centre: centreOf(fp.bbox) as [number, number],
      levels: s.levels.map((l) => ({ id: l.id, name: l.name, elevationFt: l.elevationFt, ...(l.ceilingFt !== undefined ? { ceilingFt: l.ceilingFt } : {}) })),
      stacked: s.stacked ?? false, outdoor: !!l0.terrain?.length && amb !== 'darkness', interior: !l0.terrain?.length || amb === 'darkness' || amb === 'interior-dim',
      ...(s.clearingFt !== undefined ? { clearingFt: s.clearingFt } : {}),
      roadExits: [], placement: { position: [0, 0, 0], rotationY: 0 }, objects, units: objects >= 2000 ? 2 : 1,
    };
    const pin = pinOf.get(path);
    if (pin) { e.pin = pin.key; const more = alsoAt.get(path); if (more) e.alsoAt = more; }
    if (s.parent) {
      if (!scenes.has(s.parent)) { errors.push(`${path}: parent ${s.parent} is not built`); }
      else {
        e.parent = s.parent;
        const par = scenes.get(s.parent)!, hit = enterRoomOf(par, path, s.location);
        if (!hit) errors.push(`${path}: parent ${s.parent} has no room that enters it (enter: '${path}')`);
        else {
          e.enterRoom = { key: hit.room.key, level: hit.level.id };
          const pl = hit.level as Level, place = childPlacement(fp, pl, hit.room.polygon);
          e.placement = place;
          const [ax, az] = centroid(hit.room.polygon);
          e.anchor = { x: ax, z: az, dTheta: place.rotationY };
          const plot = footprintOf({ north: pl.north, elevationFt: pl.elevationFt, rooms: [hit.room], terrain: [] }).bbox;
          e.footprintInParent = plot;
          const ratio = diagOf(fp.bbox) / Math.max(1, diagOf(plot));
          e.blowout = Math.round(ratio * 100) / 100;
          if (ratio > 1.5) warnings.push(`${path}: its map (${Math.round(fp.bbox.maxX - fp.bbox.minX)} × ${Math.round(fp.bbox.maxZ - fp.bbox.minZ)} ft) is ${e.blowout}× the plot room ${hit.room.key} gives it in ${s.parent} (${Math.round(plot.maxX - plot.minX)} × ${Math.round(plot.maxZ - plot.minZ)} ft): neighbours inside that extent are hidden under it`);
        }
      }
    } else if (pin && rootOf.get(`${c.id}/${pin.key}`) === path) {
      const wp = w.pins.find((q) => q.key === pin.key)!, crag = (wp.heightFt ?? 0) > 0;
      e.placement = rootPlacement(fp, wp, w);
      e.worldBounds = boundsInParent(e.placement, fp.bbox); e.bandFt = flattenReach(crag); if (crag) e.crag = true;
      // where the world's roads leave this site (backdrop.ts: a road passing within half a mile of the pin runs through it)
      const local = (p: [number, number]) => { const [x, z] = toLocal(e.placement, worldOfMiles(w, p)); return { x, z }; };
      const [cx, cz] = e.centre, R = Math.max(60, diagOf(fp.bbox) / 2), roads = siteRoads(l0);
      for (const road of w.roads) {
        const pts = road.pts.map((p) => { const q = local(p); return { ...q, d: Math.hypot(q.x - cx, q.z - cz) }; });
        const ds = pts.map((t) => t.d), near = ds.indexOf(Math.min(...ds));
        if (ds[near] > 0.5 * MI_FT) continue;
        for (const half of [pts.slice(0, near + 1).reverse(), pts.slice(near)]) {
          const out = half.filter((t) => t.d > R + 150 && t.d < 70000); if (!out.length) continue;
          const bearing = Math.atan2(out[0].z - cz, out[0].x - cx), [x, z] = roadExit(fp.bbox, roads, bearing);
          if (e.roadExits.some((q) => q.road === road.name && Math.abs(q.bearing - bearing) < 1e-3)) continue; // a road whose nearest point is an end gives the same exit twice
          e.roadExits.push({ road: road.name, bearing: Math.round(bearing * 1e4) / 1e4, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
        }
      }
    } else if (pin) {
      errors.push(`${path}: listed at pin ${pin.key} but neither its root (no parent, has terrain) nor anchored in a parent`);
    } else {
      e.orphan = true;
      if (!path.startsWith('dev/')) warnings.push(`${path}: no pin lists it and it has no parent; it opens the legacy way`);
    }
    entryOf.set(path, e);
  }
  // deepest-first depth sanity: a child's root must itself be placed
  for (const e of entryOf.values()) if (e.parent && !e.orphan) { const r = entryOf.get(e.root); if (r && !r.pin && !r.orphan) errors.push(`${e.path}: its root ${e.root} is not placed at a pin`); }

  // 3. Root flatten bands that overlap: the land has two bases to blend between there (the world land normalises the
  //    weights), so each pair is listed for the data pass to look at rather than treated as an error.
  const roots = [...entryOf.values()].filter((e) => e.worldBounds);
  for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) {
    const a = roots[i], b = roots[j]; if (a.campaign !== b.campaign) continue;
    if (!overlaps(grow(a.worldBounds!, a.bandFt!), grow(b.worldBounds!, b.bandFt!))) continue;
    const gap = Math.max(b.worldBounds!.minX - a.worldBounds!.maxX, a.worldBounds!.minX - b.worldBounds!.maxX, b.worldBounds!.minZ - a.worldBounds!.maxZ, a.worldBounds!.minZ - b.worldBounds!.maxZ);
    atlas.bandOverlaps.push({ campaign: a.campaign, scenes: [a.path, b.path], gapFt: Math.round(gap) });
    warnings.push(`${a.campaign}: the flatten bands of ${a.path} and ${b.path} overlap (their maps are ${Math.round(gap)} ft apart): the land between them blends two bases`);
  }
  for (const p of [...entryOf.keys()].sort()) atlas.scenes[p] = entryOf.get(p)!;
  atlas.pins.sort((a, b) => a.campaign.localeCompare(b.campaign) || a.key.localeCompare(b.key));
  return atlas;
}

/** Numbers rounded so the file is stable and readable (feet to 1/1000, angles to 1e-6). */
const tidy = (v: unknown): unknown => typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v * 1e6) / 1e6) : Array.isArray(v) ? v.map(tidy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, tidy(x)])) : v;
export const serialize = (a: Atlas): string => JSON.stringify(tidy(a), null, 1) + '\n';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const a = buildAtlas();
  const out = join(REPO, 'manifests/world-atlas.json'), text = serialize(a);
  const changed = !existsSync(out) || readFileSync(out, 'utf8') !== text;
  writeFileSync(out, text);
  const n = Object.keys(a.scenes).length, roots = Object.values(a.scenes).filter((s) => s.worldBounds).length, kids = Object.values(a.scenes).filter((s) => s.anchor).length;
  console.log(`world atlas: ${n} scenes (${roots} roots, ${kids} nested), ${a.pins.length} pins → manifests/world-atlas.json${changed ? '' : ' (unchanged)'}`);
  for (const w of a.warnings) console.log(`  warn  ${w}`);
  for (const e of a.errors) console.log(`  ERROR ${e}`);
  if (a.errors.length) process.exitCode = 1;
}
