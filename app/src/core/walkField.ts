// Cached 2.5-ft walkability field per level, party-start floor fallback, and refusal cause diagnosis.
import { bounds, dist, pointInPolygon, segmentsIntersect, type Polygon, type Segment, type Vec2 } from './geometry';
import { squareCellAt, squareCellCenter } from './grid';
import { moveBlockers } from './light';
import type { GridLevel, Level, Room, Wall } from './schema';

const STEP = 2.5;
const WINDOW_MARGIN_FT = 150;
const ROAD_TERRAIN = new Set(['dirt', 'cobble', 'flagstone', 'plank']);

interface BBox { minX: number; minZ: number; maxX: number; maxZ: number }

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  if (l2 <= 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function segSegDist(p: Vec2, q: Vec2, a: Vec2, b: Vec2): number {
  if (segmentsIntersect(p, q, a, b)) return 0;
  return Math.min(segDist(p, a, b), segDist(q, a, b), segDist(a, p, q), segDist(b, p, q));
}

/** Walkable polygons for a level: grid floor polygons, room polygons, and outdoor road/street terrain. */
export function walkableFloor(level: Level, gridLevel: GridLevel): Polygon[] {
  const roadPolys = (level.terrain ?? []).filter((t) => ROAD_TERRAIN.has(t.floor)).map((t) => t.polygon);
  return gridLevel.floorPolygons.concat(level.rooms.map((r) => r.polygon), roadPolys);
}

/** Hash of effective wall state (open doors and revealed secret doors) for cache invalidation. */
export function wallStateHash(walls: Wall[]): string {
  let h = `${walls.length}:`;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.flags.includes('door') || w.flags.includes('secret-door')) {
      h += `${w.id}=${w.flags.includes('door') ? 1 : 0}${w.open ? 'o' : 'c'};`;
    }
  }
  return h;
}

export class WalkField {
  private static cache = new Map<string, { floorRef: Polygon[]; floorLen: number; hash: string; field: WalkField }>();

  static forLevel(levelKey: string, level: Level, gridLevel: GridLevel, walls: Wall[]): WalkField {
    const hash = wallStateHash(walls);
    const cur = WalkField.cache.get(levelKey);
    if (cur && cur.floorRef === gridLevel.floorPolygons && cur.floorLen === level.rooms.length && cur.hash === hash) {
      return cur.field;
    }
    const floor = walkableFloor(level, gridLevel);
    const field = new WalkField(floor, moveBlockers(walls), walls);
    WalkField.cache.set(levelKey, { floorRef: gridLevel.floorPolygons, floorLen: level.rooms.length, hash, field });
    return field;
  }

  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  private readonly polyBoxes: BBox[];
  private readonly segBoxes: BBox[];
  private known: Uint8Array;
  private seen: Int32Array;
  private stamp = 0;

  constructor(readonly floor: Polygon[], readonly blockers: Segment[], readonly walls: Wall[] = []) {
    const b = bounds(floor);
    if (!Number.isFinite(b.minX)) {
      this.x0 = 0; this.z0 = 0; this.nx = 0; this.nz = 0;
      this.polyBoxes = []; this.segBoxes = [];
      this.known = new Uint8Array(0); this.seen = new Int32Array(0);
      return;
    }
    this.x0 = Math.floor(b.minX / STEP) * STEP;
    this.z0 = Math.floor(b.minZ / STEP) * STEP;
    this.nx = Math.ceil((b.maxX - this.x0) / STEP) + 1;
    this.nz = Math.ceil((b.maxZ - this.z0) / STEP) + 1;
    this.polyBoxes = floor.map((p) => bounds([p]));
    this.segBoxes = blockers.map((s) => ({
      minX: Math.min(s.a[0], s.b[0]), minZ: Math.min(s.a[1], s.b[1]),
      maxX: Math.max(s.a[0], s.b[0]), maxZ: Math.max(s.a[1], s.b[1]),
    }));
    this.known = new Uint8Array(this.nx * this.nz);
    this.seen = new Int32Array(this.nx * this.nz);
  }

  /** Clear cached lattice evaluations. */
  invalidate(): void {
    this.known.fill(0);
  }

  at(i: number, j: number): Vec2 {
    return [this.x0 + (i + 0.5) * STEP, this.z0 + (j + 0.5) * STEP];
  }

  onFloor(p: Vec2): boolean {
    const x = p[0], z = p[1];
    for (let i = 0; i < this.floor.length; i++) {
      const b = this.polyBoxes[i];
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pointInPolygon(p, this.floor[i])) return true;
    }
    return false;
  }

  crosses(p: Vec2, q: Vec2): boolean {
    const minX = Math.min(p[0], q[0]) - 1e-7, maxX = Math.max(p[0], q[0]) + 1e-7;
    const minZ = Math.min(p[1], q[1]) - 1e-7, maxZ = Math.max(p[1], q[1]) + 1e-7;
    for (let i = 0; i < this.blockers.length; i++) {
      const b = this.segBoxes[i];
      if (maxX < b.minX || minX > b.maxX || maxZ < b.minZ || minZ > b.maxZ) continue;
      if (segmentsIntersect(p, q, this.blockers[i].a, this.blockers[i].b)) return true;
    }
    return false;
  }

  private ok(n: number): boolean {
    let v = this.known[n];
    if (!v) {
      v = this.onFloor(this.at(n % this.nx, (n / this.nx) | 0)) ? 1 : 2;
      this.known[n] = v;
    }
    return v === 1;
  }

  /** Join a point to nearby lattice nodes only when the straight step between them stays on the floor (G04). */
  attach(p: Vec2): number[] {
    if (!this.nx || !this.onFloor(p)) return [];
    const ci = Math.floor((p[0] - this.x0) / STEP), cj = Math.floor((p[1] - this.z0) / STEP);
    const out: number[] = [];
    for (let dj = -1; dj <= 2; dj++) for (let di = -1; di <= 2; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || i >= this.nx || j < 0 || j >= this.nz) continue;
      const n = j * this.nx + i;
      if (!this.ok(n)) continue;
      const q = this.at(i, j);
      const mid: Vec2 = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5];
      if (!this.onFloor(mid) || this.crosses(p, q)) continue;
      out.push(n);
    }
    return out;
  }

  canWalk(from: Vec2, to: Vec2): boolean {
    if (!this.nx) return false;
    const starts = this.attach(from), goals = new Set(this.attach(to));
    if (!starts.length || !goals.size) return false;
    for (const s of starts) if (goals.has(s)) return true;

    // 1. Bounded window BFS around from and to + margin.
    const pad = Math.ceil(WINDOW_MARGIN_FT / STEP);
    const fi = Math.floor((from[0] - this.x0) / STEP), fj = Math.floor((from[1] - this.z0) / STEP);
    const ti = Math.floor((to[0] - this.x0) / STEP), tj = Math.floor((to[1] - this.z0) / STEP);
    const iMin = Math.max(0, Math.min(fi, ti) - pad), iMax = Math.min(this.nx - 1, Math.max(fi, ti) + pad);
    const jMin = Math.max(0, Math.min(fj, tj) - pad), jMax = Math.min(this.nz - 1, Math.max(fj, tj) + pad);

    const bounded = this.bfs(starts, goals, iMin, iMax, jMin, jMax);
    if (bounded.reached) return true;
    if (!bounded.clipped || (iMin === 0 && iMax === this.nx - 1 && jMin === 0 && jMax === this.nz - 1)) return false;

    // 2. Fallback to the full lattice when the bounded window clipped the search frontier.
    return this.bfs(starts, goals, 0, this.nx - 1, 0, this.nz - 1).reached;
  }

  private bfs(starts: number[], goals: Set<number>, iMin: number, iMax: number, jMin: number, jMax: number): { reached: boolean; clipped: boolean } {
    const tag = ++this.stamp;
    const q: number[] = [];
    for (const s of starts) { this.seen[s] = tag; q.push(s); }
    let clipped = false;
    const nx = this.nx;
    for (let h = 0; h < q.length; h++) {
      const u = q[h], i = u % nx, j = (u / nx) | 0, p = this.at(i, j);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, c = j + dj;
        if (a < 0 || a >= nx || c < 0 || c >= this.nz) continue;
        if (a < iMin || a > iMax || c < jMin || c > jMax) { clipped = true; continue; }
        const m = c * nx + a;
        if (this.seen[m] === tag || !this.ok(m)) continue;
        if (di && dj && (!this.ok(j * nx + a) || !this.ok(c * nx + i))) continue;
        if (this.crosses(p, this.at(a, c))) continue;
        if (goals.has(m)) return { reached: true, clipped };
        this.seen[m] = tag;
        q.push(m);
      }
    }
    return { reached: false, clipped };
  }

  /** Explain why a step from -> to was refused in Players rules. */
  refusalCause(from: Vec2, to: Vec2, walls: Wall[] = this.walls): string {
    if (!this.attach(from).length) return 'No way through: the party is off the floor.';
    const blocking = walls.filter((w) => !w.flags.includes('ethereal') && !(w.flags.includes('door') && w.open));
    const kindOf = (w: Wall): 'door' | 'window' | 'railing' | 'invisible' | 'wall' => {
      if (w.flags.includes('door') && !w.open) return 'door';
      if (w.flags.includes('window')) return 'window';
      if ((w.flags as string[]).includes('railing') || (w.heightFt !== undefined && w.heightFt <= 4.5)) return 'railing';
      if (w.flags.includes('invisible')) return 'invisible';
      return 'wall';
    };
    const format = (w: Wall): string => {
      const k = kindOf(w);
      if (k === 'door') return `No way through: a closed door (${w.id}) blocks the party. Open a door first.`;
      if (k === 'window') return 'No way through: a window blocks the party.';
      if (k === 'railing') return 'No way through: a railing blocks the party.';
      if (k === 'invisible') return 'No way through: an invisible wall blocks the party.';
      return 'No way through: walls block the party. Open a door first.';
    };

    // 1. Check walls directly crossed or touched by the straight segment from -> to.
    const direct = blocking
      .map((w) => ({ w, d: segSegDist(from, to, w.a, w.b), k: kindOf(w) }))
      .filter((x) => x.d <= 0.6)
      .sort((a, b) => a.d - b.d);

    for (const want of ['door', 'window', 'railing', 'invisible'] as const) {
      const hit = direct.find((x) => x.k === want);
      if (hit) return format(hit.w);
    }

    // 2. Otherwise name the nearest closed door or special wall kind along the blocked way.
    const doors = blocking
      .filter((w) => kindOf(w) === 'door')
      .map((w) => ({ w, d: segSegDist(from, to, w.a, w.b) }))
      .sort((a, b) => a.d - b.d);
    if (doors.length) return format(doors[0].w);

    const specials = blocking
      .filter((w) => ['window', 'railing', 'invisible'].includes(kindOf(w)))
      .map((w) => ({ w, d: segSegDist(from, to, w.a, w.b) }))
      .sort((a, b) => a.d - b.d);
    if (specials.length && specials[0].d <= 15) return format(specials[0].w);

    if (direct.length) return format(direct[0].w);
    return 'No way through: walls block the party. Open a door first.';
  }
}

/** True when every boundary edge of `room` is covered by a blocking wall or closed door. */
export function isRoomSealed(room: Room, blockers: Segment[], floor: Polygon[]): boolean {
  const poly = room.polygon;
  if (poly.length < 3) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 1e-3) continue;
    const nx = -dz / len, nz = dx / len;
    const steps = Math.max(1, Math.floor(len / STEP));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const mx = a[0] + dx * t, mz = a[1] + dz * t;
      const p1: Vec2 = [mx + nx * 1.25, mz + nz * 1.25];
      const p2: Vec2 = [mx - nx * 1.25, mz - nz * 1.25];
      const in1 = pointInPolygon(p1, poly), in2 = pointInPolygon(p2, poly);
      if (in1 === in2) continue;
      const insidePt = in1 ? p1 : p2, outsidePt = in1 ? p2 : p1;
      if (!floor.some((fp) => pointInPolygon(outsidePt, fp))) continue;
      const blocked = blockers.some((bl) => segSegDist(insidePt, outsidePt, bl.a, bl.b) <= 0.35);
      if (!blocked) return false;
    }
  }
  return true;
}

function distToPolygon(p: Vec2, poly: Polygon): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return best;
}

/** Resolve the party's start cell on `level`: if off every floor polygon, search the 2.5-ft lattice outward
 *  from `authored` without crossing a blocking wall, preferring the nearest non-sealed room, then outdoor
 *  terrain floor, then any floor. */
export function resolvePartyStart(
  level: Level,
  gridLevel: GridLevel,
  walls: Wall[],
  authored: Vec2,
): { pos: Vec2; roomKey?: string; movedFt: number } {
  const origin = gridLevel.origin ?? [0, 0];
  const chosen = squareCellCenter(squareCellAt(authored, origin), origin);
  const baseFloor = gridLevel.floorPolygons.concat(level.rooms.map((r) => r.polygon));
  const fullFloor = walkableFloor(level, gridLevel);
  const blockers = moveBlockers(walls);

  if (baseFloor.some((poly) => pointInPolygon(chosen, poly))) {
    const rm = level.rooms.find((r) => pointInPolygon(chosen, r.polygon));
    return { pos: chosen, roomKey: rm?.key, movedFt: 0 };
  }

  const field = new WalkField(fullFloor, blockers, walls);
  const sealedKeys = new Set(
    level.rooms.filter((r) => isRoomSealed(r, blockers, fullFloor)).map((r) => r.key),
  );
  const openRooms = level.rooms.filter((r) => !sealedKeys.has(r.key));

  // Search the 2.5-ft lattice outward from authored without crossing a blocking wall.
  const allPolys = fullFloor.concat((level.terrain ?? []).map((t) => t.polygon), [[authored]]);
  const bb = bounds(allPolys);
  const x0 = Math.floor((bb.minX - 10) / STEP) * STEP;
  const z0 = Math.floor((bb.minZ - 10) / STEP) * STEP;
  const nx = Math.ceil((bb.maxX + 10 - x0) / STEP) + 1;
  const nz = Math.ceil((bb.maxZ + 10 - z0) / STEP) + 1;
  const at = (i: number, j: number): Vec2 => [x0 + (i + 0.5) * STEP, z0 + (j + 0.5) * STEP];

  const si = Math.max(0, Math.min(nx - 1, Math.floor((authored[0] - x0) / STEP)));
  const sj = Math.max(0, Math.min(nz - 1, Math.floor((authored[1] - z0) / STEP)));
  const seen = new Uint8Array(nx * nz);
  const q: number[] = [sj * nx + si];
  seen[sj * nx + si] = 1;

  const reachedCells = new Map<string, Vec2>();
  for (let h = 0; h < q.length; h++) {
    const u = q[h], i = u % nx, j = (u / nx) | 0, p = at(i, j);
    if (baseFloor.some((poly) => pointInPolygon(p, poly))) {
      const c = squareCellCenter(squareCellAt(p, origin), origin);
      const k = `${c[0]},${c[1]}`;
      if (!reachedCells.has(k) && baseFloor.some((poly) => pointInPolygon(c, poly))) {
        reachedCells.set(k, c);
      }
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || a >= nx || b < 0 || b >= nz) continue;
      const m = b * nx + a;
      if (seen[m]) continue;
      const np = at(a, b);
      if (field.crosses(p, np)) continue;
      if (di && dj && (field.crosses(p, at(a, j)) || field.crosses(p, at(i, b)))) continue;
      seen[m] = 1;
      q.push(m);
    }
  }

  // Fallback if authored was completely boxed in by walls: scan all floor cell centres.
  if (!reachedCells.size) {
    const fb = bounds(baseFloor);
    for (let x = Math.floor(fb.minX / 5) * 5 + 2.5; x <= fb.maxX; x += 5) {
      for (let z = Math.floor(fb.minZ / 5) * 5 + 2.5; z <= fb.maxZ; z += 5) {
        const c = squareCellCenter(squareCellAt([x, z], origin), origin);
        if (baseFloor.some((poly) => pointInPolygon(c, poly))) reachedCells.set(`${c[0]},${c[1]}`, c);
      }
    }
  }

  const dirs: Vec2[] = [[5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [5, -5], [-5, 5], [-5, -5]];
  const hasStep = (c: Vec2) => dirs.some(([dx, dz]) => field.canWalk(c, [c[0] + dx, c[1] + dz]));

  const valid = [...reachedCells.values()].filter((c) => {
    const rm = level.rooms.find((r) => pointInPolygon(c, r.polygon));
    if (rm && sealedKeys.has(rm.key)) return false;
    return hasStep(c);
  });

  const candidates = valid.length ? valid : [...reachedCells.values()];
  if (!candidates.length) return { pos: chosen, movedFt: 0 };

  // Find the nearest non-sealed room that contains at least one candidate.
  const roomsWithCandidates = openRooms
    .filter((r) => candidates.some((c) => pointInPolygon(c, r.polygon)))
    .sort((a, b) => distToPolygon(authored, a.polygon) - distToPolygon(authored, b.polygon));
  const preferredRoom = roomsWithCandidates[0];

  const tierOf = (c: Vec2): number => {
    if (preferredRoom && pointInPolygon(c, preferredRoom.polygon)) return 0;
    const rm = openRooms.find((r) => pointInPolygon(c, r.polygon));
    if (rm) return 1;
    if ((level.terrain ?? []).some((t) => pointInPolygon(c, t.polygon))) return 2;
    return 3;
  };

  candidates.sort((a, b) => {
    const ta = tierOf(a), tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    return dist(authored, a) - dist(authored, b);
  });

  const picked = candidates[0];
  const rm = level.rooms.find((r) => pointInPolygon(picked, r.polygon));
  return { pos: picked, roomKey: rm?.key, movedFt: dist(authored, picked) };
}
