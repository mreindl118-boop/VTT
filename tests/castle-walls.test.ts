// Castle Ravenloft's walls have bodies (owner 2026-10-19: "Notice how the walls in Ravenloft as they are are like 0 mm
// thin. That shouldn't be the case. They should be proportionately sized walls where possible. Borrowing from the space
// around them and kind of distorting the place just slightly to make it logical."). Read off the scene the generator
// writes (scripts/authoring/castle-ravenloft.py with thickwalls.py) and the footprints and blockers the app draws and
// walks by (core/wallBody.ts, core/light.ts): every wall has a thickness in proportion to what it is; doors cut through
// the whole depth; bodies meet with no gap and never stand in one another where they could flicker; the party never
// stands inside a wall and cannot pass through one; stairs and narrow ways keep their clear width.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pointInPolygon, segmentsIntersect, type Polygon, type Vec2 } from '../app/src/core/geometry';
import { bodyLine, wallFootprints } from '../app/src/core/wallBody';
import { moveBlockers, sightBlockers } from '../app/src/core/light';
import type { GridFile, Level, SceneFile, Wall } from '../app/src/core/schema';

const scene = JSON.parse(readFileSync('locations/ch04/K/scene.json', 'utf8')) as SceneFile;
const grid = JSON.parse(readFileSync('locations/ch04/K/grid.json', 'utf8')) as GridFile;
const drawn = (w: Wall) => !w.flags.includes('invisible') && !w.flags.includes('ethereal');
const opening = (w: Wall) => w.flags.includes('door') || w.flags.includes('secret-door');
const len = (w: Wall) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
const floorOf = (l: Level) => [...grid.levels[l.id].floorPolygons, ...l.rooms.map((r) => r.polygon)] as Polygon[];
type Box = { x0: number; z0: number; x1: number; z1: number };
const boxOf = (p: Polygon): Box => p.reduce((b, [x, z]) => ({ x0: Math.min(b.x0, x), z0: Math.min(b.z0, z), x1: Math.max(b.x1, x), z1: Math.max(b.z1, z) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
const inBox = (p: Vec2, b: Box) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.z0 && p[1] <= b.z1;
/** Within e of the polygon's outline (a sample on an edge belongs to neither side). */
const onEdge = (p: Vec2, poly: Polygon, e = 0.06) => poly.some((a, i) => {
  const b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < e;
});
const strictlyIn = (p: Vec2, poly: Polygon) => pointInPolygon(p, poly) && !onEdge(p, poly);
/** Each level's drawn bodies with their boxes. */
const bodies = (l: Level) => { const fp = wallFootprints(l.walls); return l.walls.map((w, i) => ({ w, f: fp[i]! })).filter((x) => x.f).map((x) => ({ ...x, b: boxOf(x.f) })); };

describe('Castle Ravenloft: walls with a body', () => {
  it('every wall the castle draws has a thickness, in proportion to what it is', () => {
    const missing: string[] = [];
    for (const l of scene.levels) for (const w of l.walls) if (drawn(w) && !(w.thicknessFt! > 0)) missing.push(`${l.id}/${w.id}`);
    expect(missing).toEqual([]);
    const all = scene.levels.flatMap((l) => l.walls.filter(drawn).map((w) => ({ l, w })));
    // the curtain wall is the thickest: one 20-ft body from the courtyard's face to the outer face
    const curtain = all.filter(({ l, w }) => l.id === 'ground' && w.heightFt === 90);
    expect(curtain.length).toBeGreaterThan(3);
    expect(curtain.every(({ w }) => w.thicknessFt === 20)).toBe(true);
    expect(Math.max(...all.filter(({ w }) => w.heightFt !== 90).map(({ w }) => w.thicknessFt!))).toBeLessThan(20);
    // railings and balustrades are thin
    expect(all.filter(({ w }) => (w.heightFt ?? 99) <= 4).every(({ w }) => w.thicknessFt! <= 1)).toBe(true);
    // the stair towers' rings are 4 ft: the walls along the octagon's sides (the floor's edge, inset from the ring), each
    // parallel to a side within the ring's depth and standing beside it, not running on past its corner
    for (const l of scene.levels) for (const r of l.rooms.filter((r) => /^K(18|20|83)\b/.test(r.key) && r.polygon.length >= 8)) {
      const sides = r.polygon.map((a, i) => [a, r.polygon[(i + 1) % r.polygon.length]] as [Vec2, Vec2]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 3);
      const ring = l.walls.filter((w) => drawn(w) && !opening(w) && len(w) > 3 && sides.some(([a, b]) => {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u: Vec2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        const m: Vec2 = [(w.a[0] + w.b[0]) / 2 - a[0], (w.a[1] + w.b[1]) / 2 - a[1]], s = m[0] * u[0] + m[1] * u[1], d = Math.abs(m[0] * u[1] - m[1] * u[0]);
        return Math.abs(((w.b[0] - w.a[0]) * u[1] - (w.b[1] - w.a[1]) * u[0]) / len(w)) < 0.02 && d < 4.5 && s > 0 && s < L;
      }));
      expect(ring.length, `${l.id}/${r.key}`).toBeGreaterThan(3);
      for (const w of ring) expect(w.thicknessFt, `${l.id}/${r.key} ring ${w.id}`).toBe(4);
    }
  });

  it('doors and secret doors cut through the whole depth of the wall they stand in', () => {
    const bad: string[] = [];
    for (const l of scene.levels) for (const d of l.walls.filter(opening)) {
      const u: Vec2 = [(d.b[0] - d.a[0]) / len(d), (d.b[1] - d.a[1]) / len(d)];
      const ends: { end: Vec2; ok: boolean; on: string[] }[] = [];
      for (const end of [d.a, d.b] as Vec2[]) {
        // a wall that runs on from the door in its line is the wall it stands in: the door's body (its opening) is that
        // wall's, as thick and standing off the line the same way (one of the two, where the wall changes at the door)
        const on = l.walls.filter((w) => w !== d && drawn(w) && !opening(w) && [w.a, w.b].some((p) => Math.hypot(p[0] - end[0], p[1] - end[1]) < 0.05)
          && Math.abs(((w.b[0] - w.a[0]) * u[1] - (w.b[1] - w.a[1]) * u[0]) / len(w)) < 0.02);
        const side = (w: Wall) => (w.offsetFt ?? 0) * Math.sign((w.b[0] - w.a[0]) * u[0] + (w.b[1] - w.a[1]) * u[1]);
        if (on.length) ends.push({ end, ok: on.some((w) => Math.abs(w.thicknessFt! - d.thicknessFt!) < 1e-6 && Math.abs(side(w) - (d.offsetFt ?? 0)) < 1e-6), on: on.map((w) => `${w.id} (${w.thicknessFt} ft)`) });
      }
      // a whole side of a tower's ring is a door: the ring's walls meet it at both ends, at the ring's corners, as thick
      const ring = [d.a, d.b].every((end) => l.walls.some((w) => w !== d && drawn(w) && !opening(w) && Math.abs(w.thicknessFt! - d.thicknessFt!) < 1e-6
        && !(w.offsetFt ?? 0) && !(d.offsetFt ?? 0) && [w.a, w.b].some((p) => Math.hypot(p[0] - end[0], p[1] - end[1]) < 0.05)));
      if (ends.length && !ends.some((e) => e.ok) && !ring) bad.push(`${l.id}/${d.id} (${d.thicknessFt} ft) in ${ends.flatMap((e) => e.on).join(', ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('no hole where walls meet: every point of a wall\'s own stretch is in a body or on open floor', () => {
    // (a wall that runs on past a tower's corner in a thinner line leaves a dent in the tower's outline, on the floor
    // outside it; a point in no body and on no floor is a hole, the ground showing through between the walls)
    const bad: string[] = [];
    for (const l of scene.levels) {
      const B = bodies(l), floor = floorOf(l);
      for (const { w } of B) {
        const [ba] = bodyLine(w), h = w.thicknessFt! / 2, L = len(w), u: Vec2 = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], n: Vec2 = [-u[1], u[0]];
        let missed = 0;
        for (let s = 0.07; s < L; s += 0.5) for (const k of [-0.9, -0.45, 0, 0.45, 0.9]) {
          const p: Vec2 = [ba[0] + u[0] * s + n[0] * h * k, ba[1] + u[1] * s + n[1] * h * k];
          if (!B.some((o) => inBox(p, o.b) && (pointInPolygon(p, o.f) || onEdge(p, o.f))) && !floor.some((F) => pointInPolygon(p, F))) missed++;
        }
        if (missed) bad.push(`${l.id}/${w.id}: ${missed} points of its own stretch in no body and on no floor`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no body stands in another where they could flicker (two materials, or two heights, in one place)', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const B = bodies(l);
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const A = B[i], C = B[j];
        if (A.w.material === C.w.material && A.w.heightFt === C.w.heightFt) continue;   // one solid, one look: nothing to see
        if (A.b.x1 < C.b.x0 || C.b.x1 < A.b.x0 || A.b.z1 < C.b.z0 || C.b.z1 < A.b.z0) continue;
        let area = 0;
        for (let z = Math.max(A.b.z0, C.b.z0) + 0.03; z < Math.min(A.b.z1, C.b.z1); z += 0.25) for (let x = Math.max(A.b.x0, C.b.x0) + 0.02; x < Math.min(A.b.x1, C.b.x1); x += 0.25) {
          const p: Vec2 = [x, z];
          if (strictlyIn(p, A.f) && strictlyIn(p, C.f)) area += 0.0625;
        }
        // a lower body wholly inside a taller one is hidden in it
        const lowerInside = (lo: typeof A, hi: typeof A) => (lo.w.heightFt ?? 0) < (hi.w.heightFt ?? 0) || (hi.w.heightFt !== undefined && lo.w.heightFt === undefined);
        if (area > 0.25 && !(A.w.material === C.w.material && (lowerInside(A, C) || lowerInside(C, A)))) bad.push(`${l.id}: ${A.w.id} (${A.w.material}) and ${C.w.id} (${C.w.material}) share ${area.toFixed(2)} sq ft`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the party never stands inside a wall: every floor stops at the faces of the walls round it', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const solid = bodies(l).filter(({ w }) => !opening(w));
      for (const F of floorOf(l)) {
        const b = boxOf(F);
        for (let z = Math.floor(b.z0) + 0.5; z < b.z1; z += 1) for (let x = Math.floor(b.x0) + 0.5; x < b.x1; x += 1) {
          const p: Vec2 = [x, z];
          if (!pointInPolygon(p, F)) continue;
          const hit = solid.find((S) => inBox(p, S.b) && strictlyIn(p, S.f));
          if (hit) bad.push(`${l.id}: floor at ${p} inside ${hit.w.id}`);
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('a line through any wall\'s body is cut, for the party and for sight; an open door\'s is not', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const shut = moveBlockers(l.walls), seen = sightBlockers(l.walls);
      const open = l.walls.map((w) => (w.flags.includes('door') ? { ...w, open: true } : w));
      const walkOpen = moveBlockers(open);
      const B = bodies(l);
      const clear = (p: Vec2) => !B.some((o) => inBox(p, o.b) && pointInPolygon(p, o.f));
      for (const w of l.walls.filter((w) => drawn(w) && w.thicknessFt && len(w) > 1)) {
        const h = w.thicknessFt! / 2, u: Vec2 = [(w.b[0] - w.a[0]) / len(w), (w.b[1] - w.a[1]) / len(w)], n: Vec2 = [-u[1], u[0]];
        const [ba, bb] = bodyLine(w), m: Vec2 = [(ba[0] + bb[0]) / 2, (ba[1] + bb[1]) / 2];
        // from just outside one face to just inside the body: the face stops it (not only the line); the outside point
        // must be clear of every body (at a steep mitre it can lie in the neighbour's)
        const out: Vec2 = [m[0] + n[0] * (h + 0.3), m[1] + n[1] * (h + 0.3)], inside: Vec2 = [m[0] + n[0] * h * 0.5, m[1] + n[1] * h * 0.5];
        if (!clear(out)) continue;
        const cuts = (segs: { a: Vec2; b: Vec2 }[], p: Vec2, q: Vec2) => segs.some((s) => segmentsIntersect(p, q, s.a, s.b));
        if (w.flags.includes('door')) {
          const through: Vec2 = [m[0] - n[0] * (h + 0.3), m[1] - n[1] * (h + 0.3)];
          if (cuts(walkOpen, out, through)) bad.push(`${l.id}/${w.id}: blocked when open`);
          continue;
        }
        if (w.flags.includes('window') || w.flags.includes('secret-door')) continue;
        if (!cuts(shut, out, inside)) bad.push(`${l.id}/${w.id}: the party walks into its body`);
        if (!cuts(seen, out, inside)) bad.push(`${l.id}/${w.id}: sight enters its body`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every stair keeps clear of the walls, and every room keeps one clear 5-ft cell', () => {
    const bad: string[] = [];
    for (const l of scene.levels) {
      const solid = bodies(l).filter(({ w }) => !opening(w));
      const inWall = (p: Vec2) => solid.some((S) => inBox(p, S.b) && strictlyIn(p, S.f));
      for (const o of l.objects) {
        const d = o.dims ?? {};
        if (o.kind === 'stairs-straight' && (d.rise ?? 0) >= 1) {
          const w2 = (d.w ?? 5) / 2, alongX = d.fromX !== undefined;
          const [lo, hi] = alongX ? [Math.min(d.fromX!, d.toX!), Math.max(d.fromX!, d.toX!)] : [Math.min(d.fromZ!, d.toZ!), Math.max(d.fromZ!, d.toZ!)];
          const c = alongX ? o.pos[2] : o.pos[0];
          let n = 0;
          for (let s = lo + 0.25; s < hi; s += 0.5) for (let t = c - w2 + 0.25; t < c + w2; t += 0.5) if (inWall(alongX ? [s, t] : [t, s])) n++;
          if (n > 1) bad.push(`${l.id}/${o.id}: ${n * 0.25} sq ft of its flight inside a wall`);
          if (2 * w2 < 5 && (d.w ?? 5) >= 5) bad.push(`${l.id}/${o.id}: narrowed below 5 ft`);
        }
        if (o.kind === 'spiral-stair' && (d.rise ?? 0) >= 1) {
          const r = d.r ?? 6, r0 = d.r0 ?? 0;
          let n = 0;
          for (let a = 0; a < 360; a += 5) for (let q = Math.max(r0, 0.25); q <= r - 0.1; q += 0.5) if (inWall([o.pos[0] + q * Math.cos((a * Math.PI) / 180), o.pos[2] + q * Math.sin((a * Math.PI) / 180)])) n++;
          if (n) bad.push(`${l.id}/${o.id}: its treads run into a wall`);
          if (r0 && r - r0 < 5 - 1e-6) bad.push(`${l.id}/${o.id}: treads ${r - r0} ft, below 5`);
        }
      }
      // one clear cell: a 5-ft square somewhere on every room's floor
      for (const r of l.rooms) {
        const b = boxOf(r.polygon);
        let ok = false;
        for (let z = b.z0; z <= b.z1 - 5 && !ok; z += 0.5) for (let x = b.x0; x <= b.x1 - 5 && !ok; x += 0.5) {
          const sq: Vec2[] = [];
          for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) sq.push([x + 0.05 + i * 1.225, z + 0.05 + j * 1.225]);
          ok = sq.every((p) => pointInPolygon(p, r.polygon));
        }
        if (!ok && (b.x1 - b.x0 >= 5 && b.z1 - b.z0 >= 5)) bad.push(`${l.id}/${r.key}: no clear 5-ft cell left`);
      }
    }
    expect(bad).toEqual([]);
  });
});
