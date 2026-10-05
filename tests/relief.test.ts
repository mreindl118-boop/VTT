// Relief (core/relief.ts): the sampler everything stands on, and the rules a map's authored relief keeps. Vallaki is
// the first map with relief: gentle, falling toward Lake Zarovich, the square near level, the streets graded.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { padFootprint, Relief, validateRelief, type ReliefData } from '../app/src/core/relief';
import { bounds, pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import type { SceneFile } from '../app/src/core/schema';

const grid = (cols: number, rows: number, f: (x: number, z: number) => number, cell = 10, origin: [number, number] = [0, 0]): ReliefData => ({
  v: 1, origin, cell, cols, rows,
  h: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => String(Math.round(f(origin[0] + c * cell, origin[1] + r * cell) * 10))).join(' ')),
});

describe('relief sampler', { timeout: 30_000 }, () => {
  const bumpy = grid(12, 9, (x, z) => 3 * Math.sin(x / 17) + 2 * Math.cos(z / 13) + 0.05 * x);
  const R = new Relief(bumpy);

  it('passes through its samples and joins them with flat triangles on the north-west to south-east diagonal', () => {
    for (let c = 0; c < 12; c++) for (let r = 0; r < 9; r++) {
      const want = Number(bumpy.h[r].split(' ')[c]) / 10;
      expect(R.natural(c * 10, r * 10)).toBeCloseTo(want, 6);
    }
    // inside cell (2, 3): on the diagonal the height is the mean of its two ends, and each half is a plane
    const h = (c: number, r: number) => Number(bumpy.h[r].split(' ')[c]) / 10;
    expect(R.natural(25, 35)).toBeCloseTo((h(2, 3) + h(3, 4)) / 2, 6);
    const p = (u: number, v: number) => R.natural(20 + u * 10, 30 + v * 10);
    expect(p(0.8, 0.2) - p(0.6, 0.2)).toBeCloseTo(p(0.6, 0.2) - p(0.4, 0.2), 6); // linear along x below the diagonal
    expect(p(0.2, 0.8) - p(0.2, 0.6)).toBeCloseTo(p(0.2, 0.6) - p(0.2, 0.4), 6);
  });

  it('reproduces a sloping plane exactly, flat and smooth alike, and carries the edge on beyond the grid', () => {
    const P = new Relief(grid(6, 5, (x, z) => 0.04 * x - 0.02 * z + 3));
    for (const [x, z] of [[3, 7], [17.5, 22.2], [41, 9], [49.9, 39.9]]) {
      expect(P.natural(x, z)).toBeCloseTo(0.04 * x - 0.02 * z + 3, 1);
      expect(P.smooth(x, z)).toBeCloseTo(0.04 * x - 0.02 * z + 3, 1);
    }
    expect(P.natural(-200, 20)).toBeCloseTo(P.natural(0, 20), 6);
    expect(P.natural(30, 900)).toBeCloseTo(P.natural(30, 40), 6);
    const [nx, ny, nz] = P.normal(25, 20), L = Math.hypot(0.04, 1, 0.02);
    expect(nx).toBeCloseTo(-0.04 / L, 3); expect(ny).toBeCloseTo(1 / L, 3); expect(nz).toBeCloseTo(0.02 / L, 3);
  });

  it('levels a pad at the highest ground under the footprint; the drop is how far the ground falls away round it', () => {
    const S = new Relief(grid(20, 20, (x) => 0.05 * x)); // 5 % up toward +x
    const pad = S.addPad('h1', 100, 100, 30, 20, 0);
    expect(pad.y).toBeCloseTo(0.05 * 115, 1);
    expect(pad.drop).toBeCloseTo(0.05 * 31, 1);          // the foundation shows on the low (west) side
    expect(S.at(100, 100)).toBeCloseTo(pad.y, 6);
    expect(S.at(86, 92)).toBeCloseTo(pad.y, 6);          // inside: level
    expect(S.at(80, 100)).toBeCloseTo(S.natural(80, 100), 6); // outside: the natural slope
    // turned 90 degrees, the 30-ft side runs along z: the highest corner is only 10 ft east of the centre
    const T = new Relief(grid(20, 20, (x) => 0.05 * x));
    expect(T.addPad('h2', 100, 100, 30, 20, 90).y).toBeCloseTo(0.05 * 110, 1);
    expect(T.at(100, 113)).toBeCloseTo(T.padOf('h2')!.y, 6);
  });

  it('finds where a ray meets the ground (the point lies on the ground and nothing nearer does), never for a ray going up', () => {
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
      const o: [number, number, number] = [rnd() * 110, 20 + rnd() * 200, rnd() * 80];
      const tx = rnd() * 110, tz = rnd() * 80, d = [tx - o[0], R.natural(tx, tz) - o[1], tz - o[2]], L = Math.hypot(...d);
      const t = R.raycast(o[0], o[1], o[2], d[0] / L, d[1] / L, d[2] / L);
      expect(t).not.toBeNull();
      const x = o[0] + (d[0] / L) * t!, y = o[1] + (d[1] / L) * t!, z = o[2] + (d[2] / L) * t!;
      expect(Math.abs(y - R.at(x, z))).toBeLessThan(0.01);
      for (let s = 0; s < t! - 0.5; s += 2) expect(o[1] + (d[1] / L) * s - R.at(o[0] + (d[0] / L) * s, o[2] + (d[2] / L) * s)).toBeGreaterThan(-0.01);
    }
    expect(R.raycast(50, 30, 40, 0.3, 0.9, 0.1)).toBeNull();
  });

  it('rejects a malformed block', () => {
    expect(validateRelief(bumpy)).toEqual([]);
    expect(validateRelief({ ...bumpy, rows: 10 })).not.toEqual([]);
    expect(validateRelief({ ...bumpy, h: bumpy.h.map((r, i) => (i === 2 ? r + ' 5' : r)) })).not.toEqual([]);
    expect(validateRelief({ ...bumpy, h: bumpy.h.map((r, i) => (i === 1 ? r.replace(/^\S+/, '1.5') : r)) })).not.toEqual([]);
  });
});

// ------------------------------------------------------------------ Vallaki's authored relief
const scene = JSON.parse(readFileSync(resolve(__dirname, '../locations/ch05/N/scene.json'), 'utf8')) as SceneFile;
const town = scene.levels.find((l) => l.id === 'town')!;
const V = new Relief(town.relief!);
// the palisade: its pieces run round the town in order
const pal: Polygon = town.walls.filter((w) => /^(pal|gate)-/.test(w.id)).map((w) => w.a as Vec2);
const pb = bounds([pal]);
// the town's ground sampled once, every 50 ft (the relief's own cell), and shared by the checks below: the palisade has
// 580 pieces, so testing points against it is the costly part
const townPts: Vec2[] = [];
for (let x = pb.minX; x <= pb.maxX; x += 50) for (let z = pb.minZ; z <= pb.maxZ; z += 50) if (pointInPolygon([x, z], pal)) townPts.push([x, z]);
const inTown = (fn: (x: number, z: number) => void) => { for (const [x, z] of townPts) fn(x, z); };
const slope = (x: number, z: number, e = 5) => Math.hypot(V.natural(x + e, z) - V.natural(x - e, z), V.natural(x, z + e) - V.natural(x, z - e)) / (2 * e);

// a sane ceiling for a loaded machine: each check takes well under a second on an idle one
describe('Vallaki relief', { timeout: 60_000 }, () => {
  it('is a valid block covering the whole map, 0 at the map centre (the pin)', () => {
    expect(validateRelief(town.relief!)).toEqual([]);
    const all = bounds([...town.rooms.map((r) => r.polygon), ...(town.terrain ?? []).map((t) => t.polygon)]), ext = V.extent;
    expect(ext.minX).toBeLessThanOrEqual(all.minX); expect(ext.maxX).toBeGreaterThanOrEqual(all.maxX);
    expect(ext.minZ).toBeLessThanOrEqual(all.minZ); expect(ext.maxZ).toBeGreaterThanOrEqual(all.maxZ);
    expect(Math.abs(V.natural((all.minX + all.maxX) / 2, (all.minZ + all.maxZ) / 2))).toBeLessThan(0.15);
    expect(town.relief!.src).toMatch(/vallaki-town\.py/);
  });

  it('is gentle: a few tens of feet across the town, slopes of a few per cent, never a board', () => {
    const hs: number[] = [], ss: number[] = [];
    inTown((x, z) => { hs.push(V.natural(x, z)); ss.push(slope(x, z)); });
    ss.sort((a, b) => a - b);
    const range = Math.max(...hs) - Math.min(...hs);
    expect(range).toBeGreaterThan(20);
    expect(range).toBeLessThan(80);
    expect(ss[Math.floor(ss.length * 0.95)]).toBeLessThan(0.05);
    expect(ss[ss.length - 1]).toBeLessThan(0.09);
    expect(ss[Math.floor(ss.length * 0.5)]).toBeGreaterThan(0.005); // not flat
  });

  it('falls toward Lake Zarovich (north on this map): the lake side of town lies well below the far side', () => {
    const third = (pb.maxZ - pb.minZ) / 3, north: number[] = [], south: number[] = [];
    inTown((x, z) => { if (z < pb.minZ + third) north.push(V.natural(x, z)); else if (z > pb.maxZ - third) south.push(V.natural(x, z)); });
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(south) - mean(north)).toBeGreaterThan(15);
  });

  it('keeps the town square near level', () => {
    const sq = town.rooms.find((r) => r.key === 'N8')!.polygon, b = bounds([sq]), hs: number[] = [];
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) hs.push(V.natural(b.minX + ((b.maxX - b.minX) * i) / 10, b.minZ + ((b.maxZ - b.minZ) * j) / 10));
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(2); // about 1 % across its diagonal: near level, still draining
  });

  it('grades every street along its run: no piece of street in town climbs more than 6 per cent', () => {
    let worst = 0, n = 0;
    // (the bare earth round each building is a quad too: not a street)
    const yards = new Set(town.objects.filter((o) => o.kind === 'house' || o.kind === 'church-building').map((o) => `${Math.round(o.pos[0])},${Math.round(o.pos[2])}`));
    for (const t of town.terrain ?? []) {
      if ((t.floor !== 'cobble' && t.floor !== 'dirt') || t.polygon.length !== 4) continue;
      const cx = t.polygon.reduce((v, p) => v + p[0], 0) / 4, cz = t.polygon.reduce((v, p) => v + p[1], 0) / 4;
      if (yards.has(`${Math.round(cx)},${Math.round(cz)}`)) continue;
      const [a, b, c, d] = t.polygon, m0: Vec2 = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2], m1: Vec2 = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      const L = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), W = Math.hypot(a[0] - d[0], a[1] - d[1]);
      if (L < 20 || W < 10 || !pointInPolygon(m0, pal) || !pointInPolygon(m1, pal)) continue; // a street piece, not a footpath or a yard
      n++; worst = Math.max(worst, Math.abs(V.natural(...m1) - V.natural(...m0)) / L);
    }
    expect(n).toBeGreaterThan(100);
    expect(worst).toBeLessThan(0.06);
  });

  it('stands every building on a pad with a modest foundation', () => {
    let pads = 0, deepest = 0;
    for (const o of town.objects) {
      const fp = padFootprint(o); if (!fp) continue;
      const p = V.addPad(o.id, fp.x, fp.z, fp.w, fp.d, fp.rot);
      pads++; deepest = Math.max(deepest, p.drop);
      expect(V.at(fp.x, fp.z)).toBeCloseTo(p.y, 6);
    }
    expect(pads).toBeGreaterThan(900);
    expect(deepest).toBeLessThan(5);
  });
});
