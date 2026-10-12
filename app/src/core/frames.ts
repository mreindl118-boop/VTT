// Frames for the nested world: where every map stands in one continuous valley. Pure maths, no renderer.
//
// Every frame is plan feet, x east, z south, y up, north = -z, exactly as scenes are authored.
//  - The absolute world frame W: the region's map (miles) scaled to feet about the centre of its bounds, the land's
//    height read from the heightfield and steepened by RELIEF (the one global relief constant).
//  - A root map (a scene listed on a pin, no `parent`) is placed so the centre of its open-air level lands on its pin
//    and its floor on the ground, turned so its own north points to world north (yawOf).
//  - A child map (`scene.parent`) hangs under its parent: the centre of its open-air level lands on the centroid of the
//    parent room that opens it (`enter`), turned by the difference of the two norths, NEST_LIFT above the parent's ground.
// Rotations are three.js `rotation.y` angles: a point (x, z) turns to (x cos θ + z sin θ, −x sin θ + z cos θ).
//
// Imports carry their `.ts` extension so `scripts/world-atlas.ts` can run this file under plain node
// (`--experimental-transform-types`: terrain.ts uses a constructor parameter property, which strip-only mode rejects) as well as under Vite and Vitest.
import * as THREE from 'three';
import { bounds as boundsOf, type Polygon, type Vec2 } from './geometry.ts';
import { terrainOf } from './terrain.ts';
import type { WorldData } from '../campaigns';

/** Feet in a mile: the world map's miles become plan feet. */
export const MI_FT = 5280;
/** Relief: the heightfield is drawn a quarter steeper than surveyed, as a mapmaker would (backdrop.ts's 1.25). */
export const RELIEF = 1.25;
/** A child map's floor sits this far above its parent's ground (above the parent's cobble at +0.12 ft). */
export const NEST_LIFT = 0.2;
/** The land is flattened to a map's base out to this many feet past its edge (backdrop.ts's smooth(120, 900)). */
export const FLATTEN_IN = 120, FLATTEN_OUT = 900;
/** A site on its crag falls away later and farther (backdrop.ts's smooth(320, 1400)). */
export const CRAG_IN = 320, CRAG_OUT = 1400;

export type North = '-z' | '+z' | '-x' | '+x';
export interface Bounds { minX: number; minZ: number; maxX: number; maxZ: number }
/** A rigid frame: where its origin stands in the parent frame and how far it is turned about y. */
export interface Placement { position: [number, number, number]; rotationY: number }
/** What a map's placement needs to know about the map: its open-air level's north, floor height and plan extent. */
export interface Footprint { north?: North; elevationFt: number; bbox: Bounds }
export interface PinLike { pos: [number, number]; heightFt?: number; groundFt?: number }

export const IDENTITY: Placement = { position: [0, 0, 0], rotationY: 0 };

// ------------------------------------------------------------------ the world frame

/** The centre of the region's bounds: the origin of W, in miles. */
export function worldCentre(world: Pick<WorldData, 'bounds'>): Vec2 {
  return [(world.bounds.minX + world.bounds.maxX) / 2, (world.bounds.minY + world.bounds.maxY) / 2];
}
/** A world-map point (miles) in W (plan feet, x east, z south). */
export function worldOfMiles(world: Pick<WorldData, 'bounds'>, [mx, my]: Vec2): Vec2 {
  const [cx, cy] = worldCentre(world);
  return [(mx - cx) * MI_FT, (my - cy) * MI_FT];
}
/** The inverse: a W point back to world-map miles. */
export function milesOfWorld(world: Pick<WorldData, 'bounds'>, [wx, wz]: Vec2): Vec2 {
  const [cx, cy] = worldCentre(world);
  return [cx + wx / MI_FT, cy + wz / MI_FT];
}
/** The ground's height in W at a world-map point: the heightfield with the relief applied. 0 without a heightfield. */
export function groundY(world: WorldData, [mx, my]: Vec2): number {
  return terrainOf(world).heightAt(mx, my) * RELIEF;
}
/** A pin's ground: the land there (or the pin's own `groundFt` where the survey is wrong for it: a lake's shore stands
 *  at the lake's level) plus the crag it stands on (Ravenloft's thousand feet). */
export function pinY(world: WorldData, pin: PinLike): number {
  return (pin.groundFt ?? groundY(world, pin.pos)) + (pin.heightFt ?? 0);
}

// ------------------------------------------------------------------ rotation

/** Which plan direction a level's north points to. */
export function northVec(north?: North): Vec2 {
  return north === '+z' ? [0, 1] : north === '-x' ? [-1, 0] : north === '+x' ? [1, 0] : [0, -1];
}
/** The yaw (three.js rotation.y) that turns a level's north onto world north (-z). */
export function yawOf(north?: North): number {
  return north === '+z' ? Math.PI : north === '-x' ? -Math.PI / 2 : north === '+x' ? Math.PI / 2 : 0;
}
/** A plan point turned by a yaw about the origin, as three.js's rotation.y turns it. */
export function rotate(theta: number, [x, z]: Vec2): Vec2 {
  if (theta === 0) return [x, z];
  const c = Math.cos(theta), s = Math.sin(theta);
  return [x * c + z * s, -x * s + z * c];
}
/** The parent frame's east and south directions seen from a level (backdrop.ts's E/S basis), from the yaw. */
export function basisOf(north?: North): { E: Vec2; S: Vec2 } {
  const N = northVec(north);
  return { E: [-N[1], N[0]], S: [-N[0], -N[1]] };
}

// ------------------------------------------------------------------ frames

/** A point of the placed frame in its parent frame. */
export function toWorld(p: Placement, local: Vec2): Vec2 {
  const [x, z] = rotate(p.rotationY, local);
  return [x + p.position[0], z + p.position[2]];
}
/** A parent-frame point in the placed frame. */
export function toLocal(p: Placement, world: Vec2): Vec2 {
  return rotate(-p.rotationY, [world[0] - p.position[0], world[1] - p.position[2]]);
}
/** The same for a 3-D point (y is only shifted). */
export function toWorld3(p: Placement, [x, y, z]: [number, number, number]): [number, number, number] {
  const [wx, wz] = toWorld(p, [x, z]); return [wx, y + p.position[1], wz];
}
export function toLocal3(p: Placement, [x, y, z]: [number, number, number]): [number, number, number] {
  const [lx, lz] = toLocal(p, [x, z]); return [lx, y - p.position[1], lz];
}
/** A child frame placed inside a placed parent, expressed in the parent's parent frame (three.js's composition). */
export function compose(parent: Placement, child: Placement): Placement {
  const [x, z] = toWorld(parent, [child.position[0], child.position[2]]);
  return { position: [x, parent.position[1] + child.position[1], z], rotationY: parent.rotationY + child.rotationY };
}
/** The frame that undoes a placement. */
export function invert(p: Placement): Placement {
  const [x, z] = rotate(-p.rotationY, [-p.position[0], -p.position[2]]);
  return { position: [x, -p.position[1], z], rotationY: -p.rotationY };
}
/** The placement as a three.js matrix (what `root.matrix` is after `rotation.y` and `position` are set). */
export function matrixOf(p: Placement): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(p.rotationY).setPosition(p.position[0], p.position[1], p.position[2]);
}
/** A placement read back from a rotation-about-y-plus-translation matrix. */
export function placementOf(m: THREE.Matrix4): Placement {
  const e = m.elements; // column-major: x axis is (e0, e1, e2); rotation.y = θ puts cos θ at e0 and sin θ at e2
  return { position: [e[12], e[13], e[14]], rotationY: Math.atan2(e[8], e[0]) };
}

// ------------------------------------------------------------------ the coverage basis (shared by the fog and grid shaders)

/** World xz → a scene's plan xz as a 2-D affine Matrix3 acting on (x, z, 1), from the scene root's matrix (a turn about
 *  y and a translation, anchored). The fog and grid shaders apply it before uCovOrigin/uCovSize and the grid origin,
 *  so the coverage map and the grid stay in scene feet wherever the scene stands. Identity in, identity out. */
export function covBasisOf(sceneToWorld: THREE.Matrix4, out = new THREE.Matrix3()): THREE.Matrix3 {
  const e = sceneToWorld.clone().invert().elements; // column-major: local.x = e0·x + e8·z + e12, local.z = e2·x + e10·z + e14
  return out.set(e[0], e[8], e[12], e[2], e[10], e[14], 0, 0, 1);
}
/** The shaders' coverage uv, mirrored in TS: (basis · (x, z, 1) − origin) / size. */
export function covUv(basis: THREE.Matrix3, origin: Vec2, size: Vec2, [x, z]: Vec2): Vec2 {
  const v = new THREE.Vector3(x, z, 1).applyMatrix3(basis);
  return [(v.x - origin[0]) / size[0], (v.y - origin[1]) / size[1]];
}

// ------------------------------------------------------------------ footprints

/** The level that meets the open air: the first with terrain (a street, a courtyard), else the first level. */
export function l0Of<L extends { terrain?: unknown[] }>(scene: { levels: L[] }): L {
  return scene.levels.find((l) => l.terrain?.length) ?? scene.levels[0];
}
/** The plan extent of a level: its rooms and its terrain together (App.open's `bounds`). */
export function footprintOf(level: { north?: North; elevationFt: number; rooms: { polygon: Polygon }[]; terrain?: { polygon: Polygon }[] }): Footprint {
  const polys = [...level.rooms.map((r) => r.polygon), ...(level.terrain ?? []).map((t) => t.polygon)];
  return { north: level.north, elevationFt: level.elevationFt, bbox: polys.length ? boundsOf(polys) : { minX: 0, minZ: 0, maxX: 0, maxZ: 0 } };
}
export const centreOf = (b: Bounds): Vec2 => [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
export const diagOf = (b: Bounds): number => Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ);
export function centroid(poly: Polygon): Vec2 {
  return [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
}
/** A local extent seen in the parent frame: the axis-aligned box round its turned corners. */
export function boundsInParent(p: Placement, b: Bounds): Bounds {
  const pts = ([[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]] as Vec2[]).map((q) => toWorld(p, q));
  return boundsOf([pts]);
}
/** Grow a box by a margin on every side. */
export const grow = (b: Bounds, m: number): Bounds => ({ minX: b.minX - m, minZ: b.minZ - m, maxX: b.maxX + m, maxZ: b.maxZ + m });
export const overlaps = (a: Bounds, b: Bounds): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

// ------------------------------------------------------------------ placements

/** A root map on its pin: the centre of its open-air level on the pin, its floor on the ground, turned to world north. */
export function rootPlacement(fp: Footprint, pin: PinLike, world: WorldData): Placement {
  const [px, pz] = worldOfMiles(world, pin.pos), y = pinY(world, pin), th = yawOf(fp.north);
  const [cx, cz] = rotate(th, centreOf(fp.bbox));
  return { position: [px - cx, y - fp.elevationFt, pz - cz], rotationY: th };
}
/** A child map under its parent: the centre of its open-air level on the centroid of the room that opens it, its floor
 *  NEST_LIFT above the parent level's ground, turned by the difference of the two norths (buildContext's `th`). */
export function childPlacement(child: Footprint, parentLevel: { north?: North; elevationFt: number }, enterRoom: Polygon): Placement {
  const [ax, az] = centroid(enterRoom), dth = yawOf(child.north) - yawOf(parentLevel.north);
  const [cx, cz] = rotate(dth, centreOf(child.bbox));
  return { position: [ax - cx, parentLevel.elevationFt - child.elevationFt + NEST_LIFT, az - cz], rotationY: dth };
}
/** The parent room that opens a child map: the one keyed like the child's location, else the first that enters it. */
export function enterRoomOf<L extends { rooms: { key: string; enter?: string }[] }>(parent: { levels: L[] }, childPath: string, childLocation: string): { room: L['rooms'][number]; level: L } | undefined {
  for (const level of parent.levels) { const room = level.rooms.find((r) => r.enter === childPath && r.key === childLocation); if (room) return { room, level }; }
  for (const level of parent.levels) { const room = level.rooms.find((r) => r.enter === childPath); if (room) return { room, level }; }
  return undefined;
}

// ------------------------------------------------------------------ the land round a map

/** Hermite step from a to b (backdrop.ts's `smooth`). */
export function smooth(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k);
}
/** How far a plan point lies outside a box (0 inside). */
export function mapDist(b: Bounds, x: number, z: number): number {
  return Math.max(0, b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ);
}
/** How much the land at (x, z) is flattened to the map's base: 1 within FLATTEN_IN ft of its edge, 0 beyond FLATTEN_OUT
 *  (a crag site: CRAG_IN/CRAG_OUT). The land's height there is base·w + ground·(1 − w). */
export function flattenWeight(b: Bounds, x: number, z: number, crag = false): number {
  return 1 - (crag ? smooth(CRAG_IN, CRAG_OUT, mapDist(b, x, z)) : smooth(FLATTEN_IN, FLATTEN_OUT, mapDist(b, x, z)));
}
/** The reach of a map's flatten band past its edge. */
export const flattenReach = (crag = false): number => (crag ? CRAG_OUT : FLATTEN_OUT);

/** The map's own roads (cobbles, dirt, lanes): a world road leaving the site starts where one of these ends (App.open). */
export function siteRoads(level: { rooms: { polygon: Polygon; floor?: string; name?: string }[]; terrain?: { polygon: Polygon; floor?: string }[] }): Polygon[] {
  const roadLike = (f: string | undefined, name = '') => f === 'cobble' || f === 'dirt' || /road|street|lane|square|path|trail|track/i.test(name);
  return [...level.rooms.filter((r) => roadLike(r.floor, r.name)).map((r) => r.polygon), ...(level.terrain ?? []).filter((t) => roadLike(t.floor)).map((t) => t.polygon)];
}
/** Where a road leaving a map on a bearing (radians, atan2(dz, dx) in the map's frame) starts: the far end of the map's
 *  own road that reaches farthest that way, else the map's edge (backdrop.ts's `exitFor`). */
export function roadExit(b: Bounds, roads: Polygon[], bearing: number): Vec2 {
  const [cx, cz] = centreOf(b), R = Math.max(60, diagOf(b) / 2), ux = Math.cos(bearing), uz = Math.sin(bearing);
  let best: { proj: number; pts: Vec2[] } | undefined;
  for (const poly of roads) {
    let mx = -Infinity; for (const [x, z] of poly) mx = Math.max(mx, (x - cx) * ux + (z - cz) * uz);
    if (!best || mx > best.proj) best = { proj: mx, pts: poly.filter(([x, z]) => (x - cx) * ux + (z - cz) * uz > mx - 6) };
  }
  if (best && best.proj > R * 0.25) { const n = best.pts.length; return [best.pts.reduce((a, p) => a + p[0], 0) / n, best.pts.reduce((a, p) => a + p[1], 0) / n]; }
  const ts = [ux > 0 ? (b.maxX - cx) / ux : ux < 0 ? (b.minX - cx) / ux : Infinity, uz > 0 ? (b.maxZ - cz) / uz : uz < 0 ? (b.minZ - cz) / uz : Infinity];
  const t = Math.min(...ts); return [cx + ux * t, cz + uz * t];
}
