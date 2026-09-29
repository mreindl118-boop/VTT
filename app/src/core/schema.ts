// Data model for scene.json / grid.json. See docs/PIPELINE.md.
import type { Polygon, Vec2 } from './geometry';
import type { GridType, HexOrientation } from './grid';
import type { BookScaleFt, CreatureSize } from './units';

export const VIS_CLASSES = ['player', 'explored', 'unexplored', 'secret-door', 'trap', 'hidden-creature', 'hidden-object', 'dm-note'] as const;
export type VisClass = (typeof VIS_CLASSES)[number];

/** Foundry-compatible wall flags. A wall may carry several (e.g. door + locked). */
export const WALL_FLAGS = ['normal', 'terrain', 'invisible', 'ethereal', 'window', 'door', 'secret-door', 'locked'] as const;
export type WallFlag = (typeof WALL_FLAGS)[number];

export const FLOOR_MATERIALS = ['flagstone', 'plank', 'dirt', 'cobble', 'grass', 'snow', 'ice', 'shallow-water', 'marsh'] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];
/** Materials whose cells cost double to enter. Rooms may also set `difficult`. */
export const DIFFICULT_FLOORS: readonly FloorMaterial[] = ['snow', 'ice', 'shallow-water', 'marsh'];

export const WALL_MATERIALS = ['ashlar', 'rubble', 'half-timber', 'log', 'cave-rock', 'amber', 'plaster'] as const;
export type WallMaterial = (typeof WALL_MATERIALS)[number];

export type Ambient = 'darkness' | 'interior-dim' | 'barovian-overcast' | 'night' | 'fog' | 'storm';

export interface Room {
  /** Book area key, exactly as printed: "E5f", "K84", "12". */
  key: string;
  name: string;
  /** Printed page of the keyed description. */
  page?: number;
  polygon: Polygon;
  floor: FloorMaterial;
  difficult?: boolean;
  ceilingFt?: number;
}

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  flags: WallFlag[];
  material?: WallMaterial;
  heightFt?: number;
  /** Doors only. */
  open?: boolean;
}

export interface LightSource {
  id: string;
  pos: [number, number, number];
  preset?: string;
  bright: number;
  dim: number;
  /** Cone lights (bullseye lantern): facing in degrees, 0 = +X, 90 = +Z. */
  coneDeg?: number;
  vis?: VisClass;
}

export interface SceneObject {
  id: string;
  /** Kit piece or character id. */
  kind: string;
  pos: [number, number, number];
  rotY?: number;
  vis: VisClass;
  /** Area key this object belongs to. */
  key?: string;
  label?: string;
  size?: CreatureSize;
  /** Wall id for secret doors. */
  wall?: string;
  /** Free-form extra dims (e.g. stairs run/rise). */
  dims?: Record<string, number>;
}

export type LinkKind = 'stairs' | 'spiral' | 'shaft' | 'elevator' | 'slide' | 'ladder' | 'trapdoor';
export interface VerticalLink {
  id: string;
  kind: LinkKind;
  from: { level: string; pos: Vec2 };
  to: { level: string; pos: Vec2 };
}

export interface Level {
  id: string;
  name: string;
  elevationFt: number;
  ceilingFt?: number;
  rooms: Room[];
  walls: Wall[];
  lights: LightSource[];
  objects: SceneObject[];
}

export interface SceneFile {
  schema: 1;
  /** Location id in manifests/locations.json. */
  location: string;
  chapter: string;
  name: string;
  mapPage?: number;
  bookScaleFt: BookScaleFt;
  ambient: Ambient;
  levels: Level[];
  links: VerticalLink[];
  /** Area keys that exist in the manifest but are intentionally not rooms (e.g. whole-map events). */
  nonSpatialKeys?: string[];
}

export interface GridLevel {
  /** Walkable floor polygons: the grid is clipped to these and nothing else. */
  floorPolygons: Polygon[];
  type: GridType;
  hexOrientation: HexOrientation;
  origin: Vec2;
  color: string;
  opacity: number;
}
export interface GridFile {
  schema: 1;
  levels: Record<string, GridLevel>;
}

// ---------------------------------------------------------------- validation

export function validateScene(s: SceneFile, g?: GridFile): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  const need = (c: boolean, m: string) => { if (!c) errs.push(m); };
  need(s.schema === 1, 'schema must be 1');
  need(s.bookScaleFt === 5 || s.bookScaleFt === 10, 'bookScaleFt must be 5 or 10');
  const levelIds = new Set(s.levels.map((l) => l.id));
  for (const l of s.levels) {
    for (const r of l.rooms) {
      need(!keys.has(r.key), `duplicate area key ${r.key}`);
      keys.add(r.key);
      need(r.polygon.length >= 3, `room ${r.key} polygon has < 3 points`);
      need((FLOOR_MATERIALS as readonly string[]).includes(r.floor), `room ${r.key} bad floor ${r.floor}`);
    }
    const wallIds = new Set(l.walls.map((w) => w.id));
    for (const w of l.walls) {
      need(!ids.has(w.id), `duplicate id ${w.id}`); ids.add(w.id);
      need(w.flags.length > 0 && w.flags.every((f) => (WALL_FLAGS as readonly string[]).includes(f)), `wall ${w.id} bad flags`);
    }
    for (const o of l.objects) {
      need(!ids.has(o.id), `duplicate id ${o.id}`); ids.add(o.id);
      need((VIS_CLASSES as readonly string[]).includes(o.vis), `object ${o.id} bad vis ${o.vis}`);
      if (o.vis === 'secret-door') need(!!o.wall && wallIds.has(o.wall), `secret door ${o.id} must reference a wall on its level`);
    }
    for (const li of l.lights) { need(!ids.has(li.id), `duplicate id ${li.id}`); ids.add(li.id); need(li.dim >= li.bright, `light ${li.id} dim < bright`); }
    if (g) need(!!g.levels[l.id], `grid.json missing level ${l.id}`);
  }
  for (const k of s.links) {
    need(levelIds.has(k.from.level) && levelIds.has(k.to.level), `link ${k.id} references unknown level`);
  }
  return errs;
}

export function sceneAreaKeys(s: SceneFile): string[] {
  return [...s.levels.flatMap((l) => l.rooms.map((r) => r.key)), ...(s.nonSpatialKeys ?? [])];
}
