// Castle Ravenloft (ch04/K) plays from its gate (scripts/authoring/castle-ravenloft.py). The generator's contract, read
// off the scene it writes, under the Players' rules the app moves the party by (canWalk over the floor, the walls as
// moveBlockers, a stair taken when the party stands within 5.5 ft of its end, the arrival snapped to its cell):
// the party starts on the entry level at the gate, on floor, free to step every way; every door and secret door has
// floor on both sides and lets the party through when it is open; no blocking wall runs through a door's opening; every
// room can be reached from the start over doors and stairs, except the few the castle keeps shut on purpose; and every
// stair, ladder and trapdoor lands the party on floor with a free step that does not take another stair.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bounds, pointInPolygon, segmentsIntersect, type Polygon, type Segment, type Vec2 } from '../app/src/core/geometry';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import { squareCellAt, squareCellCenter } from '../app/src/core/grid';
import type { GridFile, Level, SceneFile, VerticalLink, Wall } from '../app/src/core/schema';

const scene = JSON.parse(readFileSync('locations/ch04/K/scene.json', 'utf8')) as SceneFile;
const grid = JSON.parse(readFileSync('locations/ch04/K/grid.json', 'utf8')) as GridFile;

/** Rooms the castle keeps shut on purpose (the schema has no flag for it yet): no door or stair of the module leads
 *  into them on foot. */
const SEALED: Record<string, string> = {
  K31a: 'the elevator shaft on the main floor: no door opens on it here; the car rides past (K61 to K47)',
};

const TRIGGER = 5.5; // app.ts afterPartyMove: within 5.5 ft of a link's end the party takes it
const levelOf = (id: string) => scene.levels.find((l) => l.id === id)!;
const floorOf = (l: Level) => [...grid.levels[l.id].floorPolygons, ...l.rooms.map((r) => r.polygon)] as Polygon[];
const onFloor = (p: Vec2, floor: Polygon[]) => floor.some((poly) => pointInPolygon(p, poly));
const isDoor = (w: Wall) => w.flags.includes('door') || w.flags.includes('secret-door');
/** The walls with one door open (a secret door found and opened); every other wall as authored. */
const withOpen = (l: Level, id: string): Wall[] => l.walls.map((w) => (w.id === id ? { ...w, flags: ['door'], open: true } : w));
/** Every door, locked or secret, open: the DM can open them all. */
const allOpen = (l: Level): Wall[] => l.walls.map((w) => (isDoor(w) ? { ...w, flags: ['door'], open: true } : w));
const cellOf = (p: Vec2): Vec2 => squareCellCenter(squareCellAt(p));
const ends = (l: Level) => scene.links.flatMap((k) => [k.from, k.to].filter((e) => e.level === l.id).map((e) => ({ k, pos: e.pos as Vec2 })));
const takesStairs = (l: Level, p: Vec2, except?: VerticalLink) => ends(l).filter((e) => e.k !== except && Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1]) <= TRIGGER).map((e) => e.k.id);
const STEPS: Vec2[] = [[5, 0], [-5, 0], [0, 5], [0, -5]];
const geom = (w: Wall) => { const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], len = Math.hypot(dx, dz); return { len, u: [dx / len, dz / len] as Vec2, n: [-dz / len, dx / len] as Vec2, m: [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2] as Vec2 }; };
const at = (m: Vec2, n: Vec2, s: number): Vec2 => [m[0] + n[0] * s, m[1] + n[1] * s];

/** The party's start: the scene's one spawn, on its entry level, snapped to its cell as the app places the token. */
function start(): { level: Level; pos: Vec2 } | null {
  const spawns = scene.levels.flatMap((l) => l.objects.filter((o) => o.kind === 'spawn').map((o) => ({ level: l, pos: cellOf([o.pos[0], o.pos[2]]) })));
  return spawns.length === 1 ? spawns[0] : null;
}

/** Everywhere the party can stand from the start with every door open: the 2.5-ft lattice canWalk searches, flooded
 *  level by level, crossing to another level wherever a reached cell takes a stair. */
function flood(): Map<string, Vec2[]> {
  const STEP = 2.5, reached = new Map<string, Vec2[]>();
  const lat = new Map<string, { x0: number; z0: number; nx: number; nz: number; on: Uint8Array; seen: Uint8Array; floor: Polygon[]; bucket: Map<string, Segment[]>; queue: number[] }>();
  const latOf = (l: Level) => {
    let L = lat.get(l.id);
    if (L) return L;
    const floor = floorOf(l), b = bounds(floor);
    const x0 = Math.floor(b.minX / STEP) * STEP, z0 = Math.floor(b.minZ / STEP) * STEP, nx = Math.ceil((b.maxX - x0) / STEP), nz = Math.ceil((b.maxZ - z0) / STEP);
    const on = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) on[j * nx + i] = onFloor([x0 + (i + 0.5) * STEP, z0 + (j + 0.5) * STEP], floor) ? 1 : 0;
    const bucket = new Map<string, Segment[]>();
    for (const s of moveBlockers(allOpen(l))) {
      for (let bx = Math.floor(Math.min(s.a[0], s.b[0]) / 10); bx <= Math.floor(Math.max(s.a[0], s.b[0]) / 10); bx++)
        for (let bz = Math.floor(Math.min(s.a[1], s.b[1]) / 10); bz <= Math.floor(Math.max(s.a[1], s.b[1]) / 10); bz++) {
          const k = `${bx},${bz}`; if (!bucket.has(k)) bucket.set(k, []); bucket.get(k)!.push(s);
        }
    }
    L = { x0, z0, nx, nz, on, seen: new Uint8Array(nx * nz), floor, bucket, queue: [] };
    lat.set(l.id, L); reached.set(l.id, []);
    return L;
  };
  const blocked = (L: ReturnType<typeof latOf>, p: Vec2, q: Vec2) => {
    const near = new Set<Segment>();
    for (let bx = Math.floor(Math.min(p[0], q[0]) / 10); bx <= Math.floor(Math.max(p[0], q[0]) / 10); bx++)
      for (let bz = Math.floor(Math.min(p[1], q[1]) / 10); bz <= Math.floor(Math.max(p[1], q[1]) / 10); bz++) for (const s of L.bucket.get(`${bx},${bz}`) ?? []) near.add(s);
    for (const s of near) if (segmentsIntersect(p, q, s.a, s.b)) return true;
    return false;
  };
  const node = (L: ReturnType<typeof latOf>, i: number, j: number): Vec2 => [L.x0 + (i + 0.5) * STEP, L.z0 + (j + 0.5) * STEP];
  const enter = (l: Level, p: Vec2) => { // a standing point: joined to the lattice nodes it reaches in a straight step
    const L = latOf(l), ci = Math.floor((p[0] - L.x0) / STEP - 0.5), cj = Math.floor((p[1] - L.z0) / STEP - 0.5);
    if (!onFloor(p, L.floor)) return;
    for (let j = cj - 1; j <= cj + 2; j++) for (let i = ci - 1; i <= ci + 2; i++) {
      if (i < 0 || j < 0 || i >= L.nx || j >= L.nz) continue;
      const n = j * L.nx + i;
      if (!L.on[n] || L.seen[n] || blocked(L, p, node(L, i, j))) continue;
      L.seen[n] = 1; L.queue.push(n);
    }
  };
  const s = start();
  if (!s) return reached;
  enter(s.level, s.pos);
  const taken = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const l of scene.levels) {
      const L = lat.get(l.id); if (!L || !L.queue.length) continue;
      changed = true;
      for (let h = 0; h < L.queue.length; h++) {
        const n = L.queue[h], i = n % L.nx, j = (n - i) / L.nx, p = node(L, i, j);
        reached.get(l.id)!.push(p);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= L.nx || c >= L.nz) continue;
          const m = c * L.nx + a;
          if (L.seen[m] || !L.on[m]) continue;
          if (di && dj && (!L.on[j * L.nx + a] || !L.on[c * L.nx + i])) continue;
          if (blocked(L, p, node(L, a, c))) continue;
          L.seen[m] = 1; L.queue.push(m);
        }
      }
      L.queue = [];
      // a stair is taken from any cell the party reaches within its trigger
      for (const k of scene.links) for (const [e, o] of [[k.from, k.to], [k.to, k.from]] as const) {
        if (e.level !== l.id || taken.has(`${k.id}:${e.level}:${e.pos}`)) continue;
        const pts = reached.get(l.id)!;
        const c0 = cellOf(e.pos as Vec2);
        const cells: Vec2[] = [];
        for (let dz = -10; dz <= 10; dz += 5) for (let dx = -10; dx <= 10; dx += 5) { const c: Vec2 = [c0[0] + dx, c0[1] + dz]; if (Math.hypot(c[0] - e.pos[0], c[1] - e.pos[1]) <= TRIGGER && onFloor(c, L.floor)) cells.push(c); }
        const stand = cells.some((c) => pts.some((p) => Math.abs(p[0] - c[0]) <= 1.25 + 1e-9 && Math.abs(p[1] - c[1]) <= 1.25 + 1e-9 && !blocked(L, c, p)));
        if (!stand) continue;
        taken.add(`${k.id}:${e.level}:${e.pos}`);
        enter(levelOf(o.level), cellOf(o.pos as Vec2));
      }
    }
  }
  return reached;
}

describe('Castle Ravenloft plays from its gate', () => {
  it('the party starts on the entry level at the gate, on floor, free to step every way', () => {
    const s = start();
    expect(s, 'one spawn in the scene').not.toBeNull();
    expect(s!.level.id).toBe(scene.entry);
    const floor = floorOf(s!.level), walls = moveBlockers(s!.level.walls);
    expect(onFloor(s!.pos, floor), `spawn ${s!.pos} on floor`).toBe(true);
    for (const d of STEPS) {
      const q: Vec2 = [s!.pos[0] + d[0], s!.pos[1] + d[1]];
      expect(canWalk(s!.pos, q, walls, floor), `step ${d} from the spawn`).toBe(true);
      expect(takesStairs(s!.level, q), `step ${d} from the spawn takes no stair`).toEqual([]);
    }
    // at the gate: the first room of the castle the party stands in is the drawbridge or the front courtyard
    const room = s!.level.rooms.find((r) => pointInPolygon(s!.pos, r.polygon));
    expect(['K1', 'K1-bridge', 'K1-g']).toContain(room?.key);
  });

  it('every door and secret door has floor within 2 ft on both sides and lets the party through when open', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const floor = floorOf(l);
      for (const w of l.walls.filter(isDoor)) {
        const { m, n } = geom(w), p1 = at(m, n, -2), p2 = at(m, n, 2);
        if (!onFloor(p1, floor) || !onFloor(p2, floor)) { bad.push(`${l.id}/${w.id}: no floor ${onFloor(p1, floor) ? 'beyond' : 'before'} it`); continue; }
        const walls = moveBlockers(withOpen(l, w.id));
        if (!canWalk(p1, p2, walls, floor) || !canWalk(p2, p1, walls, floor)) bad.push(`${l.id}/${w.id}: blocked when open`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no blocking wall runs through a door\'s opening', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const blockers = l.walls.filter((w) => !w.flags.includes('ethereal'));
      for (const d of l.walls.filter(isDoor)) {
        const { len, u, n, m } = geom(d);
        if (len < 1) continue;
        const ia = at(d.a as Vec2, u, 0.5), ib = at(d.b as Vec2, u, -0.5); // the opening, short of its jambs
        for (const w of blockers) {
          if (w === d) continue;
          const crossT = (p: Vec2) => (p[0] - d.a[0]) * n[0] + (p[1] - d.a[1]) * n[1];
          const along = (p: Vec2) => (p[0] - d.a[0]) * u[0] + (p[1] - d.a[1]) * u[1];
          const collinear = Math.abs(crossT(w.a as Vec2)) < 0.05 && Math.abs(crossT(w.b as Vec2)) < 0.05;
          const overlap = collinear && Math.min(len - 0.5, Math.max(along(w.a as Vec2), along(w.b as Vec2))) - Math.max(0.5, Math.min(along(w.a as Vec2), along(w.b as Vec2))) > 0.05;
          if (overlap || segmentsIntersect(ia, ib, w.a as Vec2, w.b as Vec2) || segmentsIntersect(at(m, n, -2), at(m, n, 2), w.a as Vec2, w.b as Vec2)) bad.push(`${l.id}/${d.id} crossed by ${w.id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every room can be reached from the start over doors and stairs, but the ones kept shut on purpose', () => {
    const reached = flood(), missed: string[] = [];
    for (const l of scene.levels) for (const r of l.rooms) {
      if (SEALED[r.key]) continue;
      if (!(reached.get(l.id) ?? []).some((p) => pointInPolygon(p, r.polygon))) missed.push(`${l.id}/${r.key}`);
    }
    expect(missed).toEqual([]);
    // the shut ones really are shut: a key listed here that the party reaches is stale
    const open = scene.levels.flatMap((l) => l.rooms.filter((r) => SEALED[r.key] && (reached.get(l.id) ?? []).some((p) => pointInPolygon(p, r.polygon))).map((r) => r.key));
    expect(open).toEqual([]);
  });

  it('every stair, ladder and trapdoor lands the party on floor with a free step that takes no other stair', () => {
    const bad: string[] = [];
    for (const k of scene.links) for (const e of [k.from, k.to]) {
      const l = levelOf(e.level), floor = floorOf(l), a = cellOf(e.pos as Vec2), walls = moveBlockers(l.walls);
      const where = `${k.id} at ${e.level} ${e.pos}`;
      if (!onFloor(a, floor)) { bad.push(`${where}: lands off the floor`); continue; }
      const other = takesStairs(l, a, k);
      if (other.length) bad.push(`${where}: lands on ${other.join(', ')}`);
      const free = STEPS.some((d) => { const q: Vec2 = [a[0] + d[0], a[1] + d[1]]; return canWalk(a, q, walls, floor) && !takesStairs(l, q).length; });
      if (!free) bad.push(`${where}: no free step`);
    }
    expect(bad).toEqual([]);
  });

  it('a passage on one level leads to its far end', () => {
    // same-level links (the dungeon's stairs and slide, the ladder behind K34's mirror): the party, taken from either
    // end, comes out at the other (app.ts takeLink, core/verticalLinks.ts), so the two ends are in different rooms, at
    // least a marker apart (12 ft)
    const bad: string[] = [];
    const roomAt = (l: Level, p: Vec2) => l.rooms.find((r) => pointInPolygon(p, r.polygon))?.key;
    for (const k of scene.links.filter((x) => x.from.level === x.to.level)) {
      const l = levelOf(k.from.level), a = cellOf(k.from.pos as Vec2), b = cellOf(k.to.pos as Vec2);
      const d = Math.hypot(k.to.pos[0] - k.from.pos[0], k.to.pos[1] - k.from.pos[1]);
      if (d < 12) bad.push(`${k.id}: its ends ${d.toFixed(1)} ft apart`);
      if (roomAt(l, a) === roomAt(l, b)) bad.push(`${k.id}: both ends in ${roomAt(l, a)}`);
    }
    expect(bad).toEqual([]);
    const slide = scene.links.find((k) => k.id === 'lk-k82')!;
    expect(roomAt(levelOf(slide.to.level), cellOf(slide.to.pos as Vec2)), 'the marble slide ends in the flooded cell').toBe('K74e');
  });
});
