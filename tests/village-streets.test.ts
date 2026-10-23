// Village of Barovia (locations/ch03/E/scene.json, item 2f-4): the streets are mitred quad strips that meet at
// junctions and end on another street, at a plot or at a road exit; Death House (appB/death-house, entered from E7)
// stands on its own plot beside its street, facing the street, with no street polygon intersecting its footprint; and
// every other village house keeps its placement.
import { describe, expect, it } from 'vitest';
import villageScene from '../locations/ch03/E/scene.json';
import villageGrid from '../locations/ch03/E/grid.json';
import deathHouseScene from '../locations/appB/death-house/scene.json';
import deathHouseGrid from '../locations/appB/death-house/grid.json';
import { boundsInParent, childPlacement, enterRoomOf, footprintOf, l0Of, roadExit, siteRoads } from '../app/src/core/frames';
import { bounds, pointInPolygon } from '../app/src/core/geometry';
import { squareCellAt, squareCellCenter } from '../app/src/core/grid';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import type { GridFile, SceneFile, SceneObject } from '../app/src/core/schema';

type Vec2 = [number, number];
type Poly = Vec2[];

const village = villageScene as unknown as SceneFile;
const vGrid = villageGrid as unknown as GridFile;
const dh = deathHouseScene as unknown as SceneFile;
const dhGrid = deathHouseGrid as unknown as GridFile;
const lv = village.levels[0];

/** Oriented rectangle footprint of a building object (matching scripts/authoring/audit-outdoor.py). */
function houseRect(o: SceneObject): Poly {
  const w = o.dims?.w ?? 24, d = o.dims?.d ?? 18;
  const a = ((o.rotY ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const [x, , z] = o.pos;
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as Vec2[]
  ).map(([dx, dz]) => [x + c * dx + s * dz, z - s * dx + c * dz]);
}

function axes(poly: Poly): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    const L = Math.hypot(x1 - x0, z1 - z0) || 1;
    out.push([-(z1 - z0) / L, (x1 - x0) / L]);
  }
  return out;
}

/** Separating-axis overlap test for two convex polygons; `slack > 0` shrinks projections by `slack`. */
function overlap(a: Poly, b: Poly, slack = 0): boolean {
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    const pa = a.map(([x, z]) => x * ax + z * az);
    const pb = b.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) - slack <= Math.min(...pb) || Math.max(...pb) - slack <= Math.min(...pa)) return false;
  }
  return true;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}

function polyDist(p: Vec2, poly: Poly): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

// The 93 non-E7 village houses settled in measured-p42 frame: [id, x, z, rotY, w, d, h, stories, key].
const EXPECTED_HOUSES: [string, number, number, number, number, number, number, number, string][] = [
  ['village-h118', 222.5, 715.0, -180, 45, 25, 13, 2, 'E4'],
  ['village-h80', 257.5, 482.5, -45, 30, 25, 13, 2, 'E1'],
  ['village-h56', 262.5, 362.5, 180, 25, 25, 13, 2, 'E2'],
  ['village-h42', 270.0, 332.5, -90, 35, 15, 11, 2, 'E2'],
  ['village-h58', 260.0, 372.5, -180, 30, 15, 11, 2, 'E2'],
  ['village-h78', 235.0, 472.5, -135, 25, 15, 11, 2, 'E1'],
  ['village-h116', 220.0, 687.5, -90, 25, 15, 11, 2, 'E4'],
  ['village-h77', 260.0, 450.0, -90, 20, 15, 11, 2, 'E1'],
  ['village-h84', 235.0, 495.0, -90, 15, 10, 11, 2, 'E3'],
  ['village-h63', 415.0, 385.0, -180, 40, 30, 13, 2, ''],
  ['village-h71', 130.0, 452.5, -135, 45, 25, 13, 2, ''],
  ['village-h62', 372.5, 382.5, -45, 35, 30, 13, 2, ''],
  ['village-h74', 352.5, 452.5, -180, 40, 25, 13, 2, ''],
  ['village-h105', 220.0, 612.5, -45, 30, 30, 13, 2, ''],
  ['village-h73', 75.0, 450.0, -45, 35, 25, 13, 2, ''],
  ['village-h106', 157.5, 617.5, -135, 40, 20, 13, 2, ''],
  ['village-h4', 245.0, 212.5, -135, 40, 20, 13, 2, ''],
  ['village-h89', 160.0, 517.5, -135, 40, 20, 13, 2, ''],
  ['village-h30', 430.0, 305.0, -45, 30, 25, 13, 2, ''],
  ['village-h49', 95.0, 367.5, -45, 30, 25, 13, 2, ''],
  ['village-h57', 322.5, 377.5, 180, 30, 25, 13, 2, ''],
  ['village-h87', 472.5, 510.0, -90, 30, 25, 13, 2, ''],
  ['village-h103', 312.5, 585.0, -180, 30, 25, 13, 2, ''],
  ['village-h1', 490.0, 117.5, -180, 30, 25, 11, 1, ''],
  ['village-h48', 157.5, 365.0, -135, 25, 25, 11, 1, ''],
  ['village-h117', 180.0, 700.0, -180, 40, 15, 11, 1, ''],
  ['village-h101', 225.0, 575.0, -180, 30, 20, 11, 1, ''],
  ['village-h18', 412.5, 260.0, -90, 30, 20, 11, 1, ''],
  ['village-h111', 372.5, 642.5, -180, 25, 20, 11, 1, ''],
  ['village-h54', 490.0, 385.0, 180, 25, 20, 11, 1, ''],
  ['village-h85', 310.0, 497.5, -90, 25, 20, 11, 1, ''],
  ['village-h23', 437.5, 272.5, -90, 25, 20, 11, 1, ''],
  ['village-h37', 145.0, 337.5, -135, 25, 20, 11, 1, ''],
  ['village-h75', 472.5, 447.5, 180, 25, 20, 11, 1, ''],
  ['village-h79', 405.0, 480.0, -90, 25, 20, 11, 1, ''],
  ['village-h0', 505.0, 92.5, 180, 25, 20, 11, 1, ''],
  ['village-h83', 340.0, 485.0, 180, 25, 20, 11, 1, ''],
  ['village-h99', 357.5, 570.0, -90, 25, 20, 11, 1, ''],
  ['village-h104', 412.5, 590.0, -135, 25, 20, 11, 1, ''],
  ['village-h110', 305.0, 627.5, -135, 30, 15, 11, 1, ''],
  ['village-h39', 335.0, 345.0, -90, 30, 15, 11, 1, ''],
  ['village-h40', 315.0, 345.0, -90, 30, 15, 11, 1, ''],
  ['village-h2', 380.0, 202.5, -135, 30, 15, 11, 1, ''],
  ['village-h108', 257.5, 607.5, -180, 30, 15, 11, 1, ''],
  ['village-h34', 75.0, 325.0, -90, 30, 15, 11, 1, ''],
  ['village-h97', 312.5, 562.5, -180, 30, 15, 11, 1, ''],
  ['village-h60', 65.0, 385.0, -45, 20, 20, 11, 1, ''],
  ['village-h107', 350.0, 597.5, -90, 20, 20, 11, 1, ''],
  ['village-h17', 387.5, 265.0, -135, 20, 20, 11, 1, ''],
  ['village-h95', 355.0, 522.5, -135, 20, 20, 11, 1, ''],
  ['village-h98', 160.0, 552.5, 180, 25, 15, 11, 1, ''],
  ['village-h7', 435.0, 210.0, 135, 25, 15, 11, 1, ''],
  ['village-h41', 380.0, 342.5, -45, 25, 15, 11, 1, ''],
  ['village-h29', 207.5, 297.5, -180, 25, 15, 11, 1, ''],
  ['village-h46', 242.5, 335.0, 135, 25, 15, 11, 1, ''],
  ['village-h59', 165.0, 390.0, 180, 25, 15, 11, 1, ''],
  ['village-h33', 477.5, 312.5, -90, 25, 15, 11, 1, ''],
  ['village-h100', 375.0, 572.5, -90, 25, 15, 11, 1, ''],
  ['village-h102', 157.5, 577.5, 180, 35, 10, 11, 1, ''],
  ['village-h86', 50.0, 500.0, -135, 20, 15, 11, 1, ''],
  ['village-h31', 285.0, 305.0, -180, 30, 10, 11, 1, ''],
  ['village-h61', 125.0, 390.0, -180, 30, 10, 11, 1, ''],
  ['village-h92', 400.0, 527.5, -45, 20, 15, 11, 1, ''],
  ['village-h6', 352.5, 205.0, -90, 20, 15, 11, 1, ''],
  ['village-h11', 282.5, 225.0, -135, 30, 10, 11, 1, ''],
  ['village-h27', 350.0, 290.0, -135, 20, 15, 11, 1, ''],
  ['village-h81', 472.5, 482.5, -135, 20, 15, 11, 1, ''],
  ['village-h22', 322.5, 262.5, -135, 25, 10, 11, 1, ''],
  ['village-h14', 295.0, 232.5, -135, 25, 10, 11, 1, ''],
  ['village-h76', 310.0, 455.0, -90, 25, 10, 11, 1, ''],
  ['village-h21', 180.0, 265.0, 135, 25, 10, 11, 1, ''],
  ['village-h35', 377.5, 315.0, -180, 25, 10, 11, 1, ''],
  ['village-h53', 422.5, 357.5, 180, 25, 10, 11, 1, ''],
  ['village-h91', 310.0, 525.0, -180, 25, 10, 11, 1, ''],
  ['village-h32', 525.0, 300.0, -180, 25, 10, 11, 1, ''],
  ['village-h43', 425.0, 342.5, 180, 25, 10, 11, 1, ''],
  ['village-h66', 300.0, 397.5, 180, 25, 10, 11, 1, ''],
  ['village-h36', 237.5, 315.0, -180, 25, 10, 11, 1, ''],
  ['village-h113', 172.5, 637.5, -180, 25, 10, 11, 1, ''],
  ['village-h47', 115.0, 357.5, -45, 20, 10, 11, 1, ''],
  ['village-h70', 25.0, 435.0, 135, 20, 10, 11, 1, ''],
  ['village-h13', 397.5, 220.0, -135, 20, 10, 11, 1, ''],
  ['village-h25', 257.5, 275.0, -135, 20, 10, 11, 1, ''],
  ['village-h44', 197.5, 347.5, -135, 20, 10, 11, 1, ''],
  ['village-h8', 457.5, 205.0, 180, 20, 10, 11, 1, ''],
  ['village-h112', 255.0, 632.5, -180, 20, 10, 11, 1, ''],
  ['village-h55', 210.0, 372.5, -45, 20, 10, 11, 1, ''],
  ['village-h26', 405.0, 287.5, -90, 20, 10, 11, 1, ''],
  ['village-h3', 442.5, 195.0, -180, 15, 10, 11, 1, ''],
  ['village-h16', 250.0, 235.0, -135, 15, 10, 11, 1, ''],
  ['village-h19', 435.0, 250.0, -90, 15, 10, 11, 1, ''],
  ['village-h119', 167.5, 722.5, 180, 15, 10, 11, 1, ''],
  ['village-h28', 287.5, 290.0, -135, 10, 10, 11, 1, ''],
];

describe('village of Barovia streets and Death House plot (item 2f-4)', () => {
  const streets = (lv.terrain ?? []).filter((t) => t.floor === 'cobble').map((t) => t.polygon as Poly);

  it('every street segment is a mitred 4-vertex quad (no 8-gon joint discs) meeting the next without a gap or kink', () => {
    expect(streets.length).toBeGreaterThanOrEqual(40);
    // No 8-vertex joint discs remain; every piece of street terrain is a 4-vertex quad.
    const nonQuads = streets.filter((p) => p.length !== 4);
    expect(nonQuads, 'non-quad street polygons (e.g. 8-gon joint discs)').toEqual([]);

    // Group quads into contiguous mitred chains: quad i's far cross-edge [q[1], q[2]] matches quad i+1's near cross-edge [next[0], next[3]].
    const chains: Poly[][] = [];
    for (const q of streets) {
      const prev = chains.find((c) => {
        const last = c[c.length - 1];
        return dist(last[1], q[0]) <= 0.15 && dist(last[2], q[3]) <= 0.15;
      });
      if (prev) prev.push(q);
      else chains.push([q]);
    }
    // There are 9 streets in the village, each with multiple mitred segments and 0 gap/kink at every interior bend.
    expect(chains.length).toBe(9);
    for (const c of chains) {
      expect(c.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i + 1 < c.length; i++) {
        expect(dist(c[i][1], c[i + 1][0]), `left mitre gap at segment ${i}`).toBeLessThanOrEqual(0.15);
        expect(dist(c[i][2], c[i + 1][3]), `right mitre gap at segment ${i}`).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('the streets form one connected network whose ends all lie on another street, at a plot, or at a road exit', () => {
    const nonQuads = streets.filter((p) => p.length !== 4);
    expect(nonQuads).toEqual([]);

    const chains: Poly[][] = [];
    for (const q of streets) {
      const prev = chains.find((c) => {
        const last = c[c.length - 1];
        return dist(last[1], q[0]) <= 0.15 && dist(last[2], q[3]) <= 0.15;
      });
      if (prev) prev.push(q);
      else chains.push([q]);
    }

    const plots = lv.rooms.map((r) => r.polygon as Poly);
    const fp = footprintOf(lv);
    const allRoads = siteRoads(lv);
    // Road exits on the west, east, and north edges of the village street network.
    const exits: Vec2[] = [
      roadExit(fp.bbox, allRoads, Math.PI),
      roadExit(fp.bbox, allRoads, 0),
      roadExit(fp.bbox, allRoads, -Math.PI / 2),
    ];

    const looseEnds: string[] = [];
    chains.forEach((c, ci) => {
      const first = c[0], last = c[c.length - 1];
      const ends: [string, Vec2][] = [
        [`chain ${ci} start`, mid(first[0], first[3])],
        [`chain ${ci} end`, mid(last[1], last[2])],
      ];
      const otherStreets = chains.filter((_, j) => j !== ci).flat();
      for (const [label, pt] of ends) {
        const onOtherStreet = otherStreets.some((st) => polyDist(pt, st) <= 1.0);
        const onPlot = plots.some((pl) => polyDist(pt, pl) <= 1.0);
        const onExit = exits.some((ex) => dist(pt, ex) <= 12.0);
        if (!onOtherStreet && !onPlot && !onExit) looseEnds.push(`${label} at [${pt[0].toFixed(1)}, ${pt[1].toFixed(1)}]`);
      }
    });
    expect(looseEnds, 'street ends stranded in the grass').toEqual([]);

    // Every street chain is connected to Main street (chain 0) through shared junctions or shared keyed plots.
    const adj = new Set<number>([0]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < chains.length; i++) {
        if (adj.has(i)) continue;
        const reach = [...adj].some((j) =>
          chains[i].some((a) =>
            chains[j].some((b) => overlap(a, b, -0.5)) ||
            plots.some((pl) => overlap(a, pl, -0.5) && chains[j].some((b) => overlap(b, pl, -0.5))),
          ),
        );
        if (reach) {
          adj.add(i);
          changed = true;
        }
      }
    }
    expect(adj.size, 'all street chains form one connected network').toBe(chains.length);
  });

  it('places Death House (E7 and appB/death-house) on its own plot beside its street, facing the street, with no street intersecting its footprint', () => {
    const hit = enterRoomOf(village, 'appB/death-house', dh.location);
    expect(hit).toBeDefined();
    expect(hit!.room.key).toBe('E7');

    const e7House = lv.objects.find((o) => o.kind === 'house' && o.key === 'E7');
    expect(e7House, 'E7 house in ch03/E').toBeDefined();
    // Faces west (-x) toward North loop, matching appB/death-house's dTheta = -pi/2.
    expect(e7House!.rotY).toBe(-90);
    expect(e7House!.dims?.stories).toBe(3);

    const e7Rect = houseRect(e7House!);
    const e7RoomPoly = hit!.room.polygon as Poly;

    // Nested appB/death-house ground-floor footprint in ch03/E coordinates.
    const dhFp = footprintOf(l0Of(dh));
    const place = childPlacement(dhFp, hit!.level, e7RoomPoly);
    expect(place.rotationY).toBeCloseTo(-Math.PI / 2, 6);
    const dhBounds = boundsInParent(place, dhFp.bbox);
    const dhPoly: Poly = [
      [dhBounds.minX, dhBounds.minZ],
      [dhBounds.maxX, dhBounds.minZ],
      [dhBounds.maxX, dhBounds.maxZ],
      [dhBounds.minX, dhBounds.maxZ],
    ];

    // Neither E7's building/room footprint nor appB/death-house's nested footprint is intersected by any street polygon.
    const hitsE7House = streets.filter((st) => overlap(st, e7Rect, 0.1));
    const hitsE7Room = streets.filter((st) => overlap(st, e7RoomPoly, 0.1));
    const hitsDh = streets.filter((st) => overlap(st, dhPoly, 0.1));
    expect(hitsE7House, 'street polygons intersecting E7 house').toEqual([]);
    expect(hitsE7Room, 'street polygons intersecting E7 room plot').toEqual([]);
    expect(hitsDh, 'street polygons intersecting appB/death-house ground floor').toEqual([]);

    // And the street runs right alongside the west front entrance of Death House (within 8 ft of dhBounds.minX).
    const gateFront: Vec2 = [dhBounds.minX, (dhBounds.minZ + dhBounds.maxZ) / 2];
    const dStreet = Math.min(...streets.map((st) => polyDist(gateFront, st)));
    expect(dStreet).toBeGreaterThan(0);
    expect(dStreet).toBeLessThanOrEqual(8);
  });

  it('keeps every other village house where it is and leaves no house standing on a street', () => {
    const otherHouses = lv.objects
      .filter((o) => o.kind === 'house' && o.key !== 'E7')
      .map((o): [string, number, number, number, number, number, number, number, string] => [
        o.id,
        o.pos[0],
        o.pos[2],
        o.rotY ?? 0,
        o.dims?.w ?? 0,
        o.dims?.d ?? 0,
        o.dims?.h ?? 0,
        o.dims?.stories ?? 1,
        o.key ?? '',
      ]);
    expect(otherHouses).toEqual(EXPECTED_HOUSES);

    // No house in the village stands on a street (audit-outdoor.py slack = 1.0).
    const allHouses = lv.objects.filter((o) => o.kind === 'house');
    const onStreet = allHouses
      .filter((o) => {
        const r = houseRect(o);
        return streets.some((st) => overlap(r, st, 1.0));
      })
      .map((o) => o.id);
    expect(onStreet, 'houses standing on a street').toEqual([]);
  });

  it('preserves Players-mode start and movement/door walkability in the village and into Death House', () => {
    const startOf = (s: SceneFile): Vec2 => {
      for (const l of s.levels) {
        const sp = l.objects.find((o) => o.kind === 'spawn');
        if (sp) return squareCellCenter(squareCellAt([sp.pos[0], sp.pos[2]]));
      }
      const b = bounds([s.levels[0].rooms[0].polygon]);
      return squareCellCenter(squareCellAt([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]));
    };

    const vFloor = vGrid.levels.village.floorPolygons;
    const vBlockers = moveBlockers(lv.walls);
    const vSpawn = startOf(village);
    const e7House = lv.objects.find((o) => o.kind === 'house' && o.key === 'E7')!;
    const beforeE7: Vec2 = [e7House.pos[0] - 35, e7House.pos[2]];
    expect(canWalk(vSpawn, beforeE7, vBlockers, vFloor)).toBe(true);

    const f1 = dh.levels[0];
    const dhFloor = dhGrid.levels.f1.floorPolygons;
    const dhSpawn = startOf(dh);
    const foyer: Vec2 = [2.5, 42.5];
    const hall: Vec2 = [2.5, 27.5];
    // Closed front door blocks entry from the portico (1A) into the foyer (1B); opening f1-front-doors and f1-foyer-hall admits the party.
    expect(canWalk(dhSpawn, foyer, moveBlockers(f1.walls), dhFloor)).toBe(false);
    const openedWalls = f1.walls.map((w) => (w.id === 'f1-front-doors' || w.id === 'f1-foyer-hall' ? { ...w, open: true } : w));
    expect(canWalk(dhSpawn, foyer, moveBlockers(openedWalls), dhFloor)).toBe(true);
    expect(canWalk(foyer, hall, moveBlockers(openedWalls), dhFloor)).toBe(true);
  });
});
