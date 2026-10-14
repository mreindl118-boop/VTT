import { CoverageMap } from '../core/coverage';
import { bounds, pointInPolygon, polygonArea, type Polygon, type Segment, type Vec2 } from '../core/geometry';
import { moveBlockers } from '../core/light';
import type { SceneFile, GridFile } from '../core/schema';
import { revealSets, type CampaignState, type Reveal } from './campaign';

export const CASTLE_MAP_REVISION = 1;
export interface MapMigrationResult { state: CampaignState; applied: boolean; issues: string[] }

interface RoomChange { level: string; key: string; before: Polygon; after: Polygon }

// Numeric authored geometry from 37ae2ff and the reviewed Castle repair. Keep the
// source frame: legacy RLE stores no origin/width and cannot be loaded in the new one.
const CHANGES: RoomChange[] = [
  { level: 'spires', key: 'K48', before: [[199.394,217.5],[205.606,217.5],[210,221.894],[210,228.106],[205.606,232.5],[199.394,232.5],[195,228.106],[195,221.894]], after: [[185,215],[215,215],[215,232.5],[185,232.5]] },
  { level: 'spires', key: 'K49', before: [[165,215],[190,215],[190,255],[175,255],[165,245]], after: [[165,215],[185,215],[185,272.5],[175,272.5],[165,262.5]] },
  { level: 'spires', key: 'K50', before: [[190,235],[215,235],[215,255],[190,255]], after: [[185,232.5],[205,232.5],[205,272.5],[185,272.5]] },
  { level: 'spires', key: 'K51', before: [[180,255],[200,255],[200,265],[180,265]], after: [[205,252.5],[215,252.5],[215,262.5],[205,262.5]] },
  { level: 'south-tower', key: 'K55', before: [[165,215],[195,215],[195,255],[175,255],[165,245]], after: [[165,252.5],[215,252.5],[215,262.5],[205,272.5],[175,272.5],[165,262.5]] },
  { level: 'south-tower', key: 'K54', before: [[195,215],[215,215],[215,235],[195,235]], after: [[165,232.5],[185,232.5],[185,252.5],[165,252.5]] },
  { level: 'south-tower', key: 'K56', before: [[195,235],[215,235],[215,255],[195,255]], after: [[185,232.5],[215,232.5],[215,252.5],[185,252.5]] },
  { level: 'south-tower', key: 'K48-t', before: [[200.947,221.25],[204.053,221.25],[206.25,223.447],[206.25,226.553],[204.053,228.75],[200.947,228.75],[198.75,226.553],[198.75,223.447]], after: [[185,215],[215,215],[215,232.5],[165,232.5],[165,227.5],[185,227.5]] },
];
const OLD_FRAMES: Record<string, [number, number, number, number]> = {
  spires: [78, 103, 174, 164], 'south-tower': [160, 125, 72, 132],
};
const HATCH: Vec2 = [210, 257.5];
const OLD_HATCH: Record<string, Vec2[]> = {
  spires: [[190, 263], [192.5, 262.5]], 'south-tower': [[190, 256], [192.5, 257.5]],
};

// The old K48-t stair polygon overlaps K54. The smaller, explicit stair room
// owns those coordinates; do not infer that seeing the stair revealed K54 too.
function owner(point: Vec2, rooms: RoomChange[], side: 'before' | 'after'): RoomChange | undefined {
  return rooms.filter(r => pointInPolygon(point, r[side])).sort((a, b) => Math.abs(polygonArea(a[side])) - Math.abs(polygonArea(b[side])))[0];
}

function span(poly: Polygon, z: number): [number, number] | undefined {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
  }
  xs.sort((a, b) => a - b);
  return xs.length === 2 && xs[1] > xs[0] ? [xs[0], xs[1]] : undefined;
}

/** Map within a horizontal slice, so clipped/concave room corners remain inside. */
function roomPoint(point: Vec2, from: Polygon, to: Polygon): Vec2 | undefined {
  const a = bounds([from]), b = bounds([to]);
  const z = b.minZ + (point[1] - a.minZ) / (a.maxZ - a.minZ) * (b.maxZ - b.minZ);
  const source = span(from, point[1]), target = span(to, z);
  if (!source || !target) return undefined;
  return [target[0] + (point[0] - source[0]) / (source[1] - source[0]) * (target[1] - target[0]), z];
}

function touches(point: Vec2, wall: Segment): boolean {
  const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1], len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((point[0] - wall.a[0]) * dx + (point[1] - wall.a[1]) * dz) / len)) : 0;
  return Math.hypot(point[0] - wall.a[0] - t * dx, point[1] - wall.a[1] - t * dz) < 1e-7;
}

function cellPoint(cov: CoverageMap, k: number): Vec2 {
  return [cov.originX + (k % cov.width + 0.5) * cov.cell, cov.originZ + (Math.floor(k / cov.width) + 0.5) * cov.cell];
}

function validSeen(value: unknown, size: number): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  const raw = value.replace(/^c1:/, '');
  if (!/^[01]x[1-9]\d*(?:,[01]x[1-9]\d*)*$/.test(raw)) return false;
  return raw.split(',').reduce((sum, run) => sum + Number(run.split('x')[1]), 0) === size;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPoint(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/** Persisted JSON is not guaranteed to match CampaignState. Validate the fields
 * this migration reads before deriving blockers or constructing partial output. */
function savedDataIssues(state: CampaignState): string[] {
  const issues: string[] = [];
  const position = (value: unknown, field: string, label: string) => {
    if (!record(value) || typeof value.location !== 'string' || typeof value.level !== 'string') {
      issues.push(`${label}: invalid location/level record`); return;
    }
    if (value.location === 'K' && Object.hasOwn(OLD_FRAMES, value.level) && !validPoint(value[field])) {
      issues.push(`${label}.${field}: invalid coordinate tuple`);
    }
  };
  if (!Array.isArray(state.tokens)) issues.push('tokens: invalid list');
  else for (const [i, token] of state.tokens.entries()) position(token, 'pos', `token ${token?.id ?? i}`);
  if (state.encounter !== undefined) position(state.encounter, 'partyPos', 'encounter');
  if (!record(state.seen)) issues.push('seen: invalid explored record');
  else for (const [id, frame] of Object.entries(OLD_FRAMES)) {
    const key = `K/${id}`;
    if (Object.hasOwn(state.seen, key) && !validSeen(state.seen[key], frame[2] * frame[3])) {
      issues.push(`${key}: unrecognized legacy explored encoding/frame`);
    }
  }
  if (!record(state.doorsOpen)) issues.push('doorsOpen: invalid door record');
  else for (const [key, value] of Object.entries(state.doorsOpen)) {
    if (key.startsWith('K/') && typeof value !== 'boolean') issues.push(`${key}: invalid door state`);
  }
  if (!Array.isArray(state.reveals)) issues.push('reveals: invalid list');
  else for (const [i, reveal] of state.reveals.entries()) {
    if (!record(reveal) || typeof reveal.location !== 'string' || typeof reveal.type !== 'string') {
      issues.push(`reveal ${i}: invalid event record`); continue;
    }
    if (reveal.location !== 'K') continue;
    if (reveal.type === 'brush') {
      if (typeof reveal.level !== 'string') { issues.push(`reveal ${i}: invalid brush level`); continue; }
      if (!Object.hasOwn(OLD_FRAMES, reveal.level)) continue;
      if (typeof reveal.r !== 'number' || !Number.isFinite(reveal.r) || reveal.r < 0 ||
          !Array.isArray(reveal.pts) || !Array.from(reveal.pts).every(validPoint) ||
          !['reveal', 'fog', 'clear'].includes(reveal.mode)) issues.push(`K/${reveal.level}: invalid brush coordinates/radius/mode`);
    } else if ((reveal.type === 'room' && typeof reveal.key === 'string' && ['reveal', 'fog', 'explored'].includes(reveal.mode)) ||
               (reveal.type === 'object' && typeof reveal.id === 'string') ||
               (reveal.type === 'secret-door' && typeof reveal.id === 'string' && typeof reveal.wallId === 'string')) continue;
    else issues.push(`reveal ${i}: invalid Castle event`);
  }
  return issues;
}

/** Pure, atomic Castle-only recovery. Run before coverage/token construction in
 * the authoritative DM load, then persist/broadcast its returned state normally.
 * Missing markers mean legacy; newCampaign deliberately does not prefill one. */
export function migrateMapState(state: CampaignState, scene: SceneFile, grid: GridFile): MapMigrationResult {
  const unchanged = (issues: string[] = []): MapMigrationResult => ({ state, applied: false, issues });
  if (scene.location !== 'K') return unchanged();
  if (!record(state)) return unchanged(['campaign: invalid saved record']);
  if (state.mapRevisions !== undefined && (!record(state.mapRevisions) ||
      (Object.hasOwn(state.mapRevisions, 'K') && (!Number.isSafeInteger(state.mapRevisions.K) || state.mapRevisions.K < 0)))) {
    return unchanged(['mapRevisions.K: invalid revision record/value']);
  }
  if ((state.mapRevisions?.K ?? 0) >= CASTLE_MAP_REVISION) return unchanged();
  const issues = savedDataIssues(state);
  for (const change of CHANGES) {
    const room = scene.levels.find(l => l.id === change.level)?.rooms.find(r => r.key === change.key);
    if (!room || JSON.stringify(room.polygon) !== JSON.stringify(change.after)) issues.push(`K/${change.level}/${change.key}: unrecognized target layout`);
  }
  if (issues.length) return unchanged(issues);
  const secretWalls = revealSets(state, 'K').secretWalls;
  const contexts = new Map(Object.keys(OLD_FRAMES).map(id => {
    const level = scene.levels.find(l => l.id === id)!;
    const floor = [...level.rooms.map(r => r.polygon), ...(grid.levels[id]?.floorPolygons ?? [])];
    const current = CoverageMap.forPolygons(floor), old = new CoverageMap(...OLD_FRAMES[id]);
    const rooms = CHANGES.filter(r => r.level === id);
    const blockers = moveBlockers(level.walls.map(w => ({ ...w,
      flags: w.flags.includes('secret-door') && secretWalls.has(w.id) ? ['door'] : w.flags,
      open: state.doorsOpen[`K/${w.id}`] ?? w.open,
    })));
    if (current.cell !== 1) issues.push(`K/${id}: unsupported target coverage resolution`);
    const lookup = new Int32Array(current.seen.length).fill(-1);
    for (let k = 0; k < lookup.length; k++) {
      const p = cellPoint(current, k), target = owner(p, rooms, 'after');
      const source = target ? roomPoint(p, target.after, target.before) : p;
      if (!source || (target ? owner(source, rooms, 'before') !== target : owner(source, rooms, 'before'))) continue;
      const index = old.idx(...source);
      // The inverse point can straddle a fractional room edge when quantized.
      // Only the actual sampled cell's owner may supply explored or brush data.
      if (index >= 0 && owner(cellPoint(old, index), rooms, 'before') === target) lookup[k] = index;
    }
    return [id, { floor, current, old, rooms, blockers, lookup }] as const;
  }));
  const position = (location: string, level: string, point: Vec2, label: string): Vec2 => {
    const ctx = location === 'K' ? contexts.get(level) : undefined;
    if (!ctx) return point;
    const hatch = OLD_HATCH[level].some(p => p[0] === point[0] && p[1] === point[1]);
    const room = hatch ? ctx.rooms.find(r => r.key === (level === 'spires' ? 'K51' : 'K55')) : owner(point, ctx.rooms, 'before');
    if (!room) return point;
    const legal = (p: Vec2) => pointInPolygon(p, room.after) && ctx.floor.some(poly => pointInPolygon(p, poly)) && !ctx.blockers.some(w => touches(p, w));
    if (!hatch && legal(point)) return point;
    const candidate = hatch ? [...HATCH] as Vec2 : roomPoint(point, room.before, room.after);
    if (!candidate || !legal(candidate)) { issues.push(`${label}: no legal semantic destination in K/${level}/${room.key}`); return point; }
    return candidate;
  };
  const tokens = state.tokens.map(t => {
    const pos = position(t.location, t.level, t.pos, `token ${t.id}`);
    return pos === t.pos ? t : { ...t, pos };
  });
  const encounter = state.encounter ? { ...state.encounter, partyPos: position(state.encounter.location, state.encounter.level, state.encounter.partyPos, 'encounter.partyPos') } : undefined;
  const seen = { ...state.seen };
  for (const [id, ctx] of contexts) {
    const value = state.seen[`K/${id}`];
    if (!value) continue;
    ctx.old.load({ seen: value, paint: '' });
    for (let k = 0; k < ctx.lookup.length; k++) if (ctx.lookup[k] >= 0) ctx.current.seen[k] = ctx.old.seen[ctx.lookup[k]];
    seen[`K/${id}`] = ctx.current.serialize().seen;
  }
  const reveals: Reveal[] = state.reveals.map(r => {
    if (r.type !== 'brush' || r.location !== 'K') return r;
    const ctx = contexts.get(r.level); if (!ctx) return r;
    const changed = r.pts.some(p => ctx.rooms.some(room => ['before', 'after'].some(side => {
      const b = bounds([room[side as 'before' | 'after']]);
      return p[0] + r.r + 1 >= b.minX && p[0] - r.r - 1 <= b.maxX && p[1] + r.r + 1 >= b.minZ && p[1] - r.r - 1 <= b.maxZ;
    })));
    if (!changed) return r;
    ctx.old.paint.fill(0);
    for (const p of r.pts) ctx.old.brush(...p, r.r, 'reveal');
    const mask = new Uint8Array(ctx.current.paint.length);
    for (let k = 0; k < mask.length; k++) if (ctx.lookup[k] >= 0) mask[k] = ctx.old.paint[ctx.lookup[k]];
    // Contraction can make a single forced-fog/clear source cell smaller than a
    // destination cell. Retain its effect; never add a reveal by this expansion.
    if (r.mode !== 'reveal') for (let k = 0; k < ctx.old.paint.length; k++) {
      if (!ctx.old.paint[k]) continue;
      const p = cellPoint(ctx.old, k), source = owner(p, ctx.rooms, 'before');
      const target = source ? roomPoint(p, source.before, source.after) : p;
      if (!target || (!source && owner(target, ctx.rooms, 'after'))) continue;
      const index = ctx.current.idx(...target);
      if (index >= 0 && owner(cellPoint(ctx.current, index), ctx.rooms, 'after') === source) mask[index] = 1;
    }
    const pts: Vec2[] = [];
    for (let k = 0; k < mask.length; k++) if (mask[k]) pts.push(cellPoint(ctx.current, k));
    // One zero-radius point addresses one current one-foot cell. Keep the event
    // and its order intact, so undo and later brush overrides still work.
    return { ...r, r: 0, pts };
  });
  if (issues.length) return unchanged(issues);
  const next: CampaignState = { ...state, tokens, reveals, seen, mapRevisions: { ...state.mapRevisions, K: CASTLE_MAP_REVISION } };
  if (encounter) next.encounter = encounter;
  return { state: next, applied: true, issues: [] };
}
