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

export const WALL_MATERIALS = ['ashlar', 'rubble', 'half-timber', 'log', 'cave-rock', 'amber', 'plaster', 'paneling', 'paneling-dusty', 'earth', 'brick'] as const;
export type WallMaterial = (typeof WALL_MATERIALS)[number];

export type Ambient = 'darkness' | 'interior-dim' | 'barovian-overcast' | 'night' | 'fog' | 'storm';

export interface Room {
  /** A keyed building with its own map: the scene path the town map opens (its blowout). */
  enter?: string;
  /** Book area key, exactly as printed: "E5f", "K84", "12". */
  key: string;
  name: string;
  /** Printed page of the keyed description. */
  page?: number;
  polygon: Polygon;
  floor: FloorMaterial;
  difficult?: boolean;
  ceilingFt?: number;
  desc?: string;
  dm?: string;
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
  /** What players call it once they can see it (hidden or disguised things); defaults to a generic name. */
  playerLabel?: string;
  size?: CreatureSize;
  /** Wall id for secret doors. */
  wall?: string;
  /** Free-form extra dims (e.g. stairs run/rise). */
  dims?: Record<string, number>;
  /** Plan polygon for shape-driven pieces (prisms, decks); pos is then ignored. */
  polygon?: Polygon;
  /** What players see when they look at it (original wording, never the book's text). */
  desc?: string;
  /** DM-only notes: mechanics, checks, what it hides. */
  dm?: string;
  /** Things that open (chests, wardrobes, coffins, drawers). Openable kinds get a default record. */
  container?: Container;
}

export interface Container {
  /** Players cannot open it; the DM can (after a check, a key, or force). */
  locked?: boolean;
  /** What players find inside once it is open (original wording). */
  contents?: string;
  /** Hidden objects that become revealed to players when it is opened. */
  reveals?: string[];
  /** Starts open (e.g. a lid left ajar). */
  open?: boolean;
}

/** Kit kinds that open, and how: a lid that lifts, doors that swing, or a drawer that slides. */
export const OPENABLE_KINDS: Record<string, 'lid' | 'doors' | 'drawer'> = {
  trunk: 'lid', 'crate-chest': 'lid', 'toy-chest': 'lid', 'toy-chest-windmills': 'lid', 'claw-chest-skeleton': 'lid', 'bier-coffin': 'lid',
  'jewelry-box': 'lid', chest: 'lid', coffin: 'lid',
  cabinet: 'doors', wardrobe: 'doors', nightstand: 'drawer', desk: 'drawer',
};

export type LinkKind = 'stairs' | 'spiral' | 'shaft' | 'elevator' | 'slide' | 'ladder' | 'trapdoor' | 'dumbwaiter';
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
  /** Overrides the scene ambient (e.g. an unlit dungeon under a daylit house). */
  ambient?: Ambient;
  /** Which plan axis points to map north; default "-z". Death House's map is printed with north to the left. */
  north?: '-z' | '+z' | '-x' | '+x';
  /** Unkeyed ground (lawns, roads, open country): drawn as floor, gridded, never a room. */
  terrain?: { polygon: Polygon; floor: FloorMaterial }[];
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
  /** Town/site maps: feet per printed square; the map is a placement layer, not a battle map. */
  placementFt?: number;
  kind?: 'battle' | 'placement' | 'regional';
  /** Levels stack in one place: every level renders at once and a section cut slices the stack.
   *  true = a roofed building: the cut follows the current floor. 'open' = open platforms (a tower, a treehouse):
   *  the cut rests above the top platform until the DM moves it, so the whole stack stays in view. */
  stacked?: boolean | 'open';
  /** Outdoors in a wooded mountain valley: taller ridges and deeper forest in the backdrop. */
  valley?: boolean;
  ambient: Ambient;
  levels: Level[];
  links: VerticalLink[];
  /** Area keys that exist in the manifest but are intentionally not rooms (e.g. whole-map events). */
  nonSpatialKeys?: string[];
  /** Still being built: the scene covers only some of the manifest's keyed areas. */
  partial?: boolean;
  /** The level a visit starts on when the state has none (default: the first). */
  entry?: string;
  /** The map this one is a blowout of (a town for a house): where "back" goes. */
  parent?: string;
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
      for (const r of o.container?.reveals ?? []) need(l.objects.some((x) => x.id === r), `container ${o.id} reveals unknown object ${r}`);
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
  // A keyed area split into several rooms uses `KEY-part` (K12-n, K13-w): the part belongs to KEY.
  return [...s.levels.flatMap((l) => l.rooms.map((r) => r.key.replace(/-[a-z]+$/, ''))), ...(s.nonSpatialKeys ?? [])];
}
