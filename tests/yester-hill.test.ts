// Yester Hill (ch14/Y) is drawn as a hill you climb (scripts/authoring/yester-hill.py): its land is a heightfield that
// runs out to the forest floor round the hill's foot, every prop stands on it, each cairn ring keeps its contour, the
// trail never climbs steeper than 1 in 5, a token on any level always stands on the ground under it (the forest floor
// round the foot, a landing on the trail, the outer track, or the flat top), the party climbs the trail level by level
// with no jump of more than about 100 ft, the land drawn beyond the map (kit/sites/w.ts) meets the map's own with no
// step, the hill's scenery is never under the fog of war, and the fog wall fades out instead of ending in an edge.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { hillLandAt } from '../app/src/kit/sites/w';
import { PROPS_V1 } from '../app/src/kit/props';
import '../app/src/kit/sites';
import { buildBackdrop } from '../app/src/render/backdrop';
import { CAMPAIGNS, worldOf } from '../app/src/campaigns';
import { bounds, pointInPolygon, type Vec2 } from '../app/src/core/geometry';
import { canWalk } from '../app/src/core/movement';
import { moveBlockers } from '../app/src/core/light';
import type { Level, SceneFile, GridFile } from '../app/src/core/schema';

const scene = JSON.parse(readFileSync('locations/ch14/Y/scene.json', 'utf8')) as SceneFile;
const grid = JSON.parse(readFileSync('locations/ch14/Y/grid.json', 'utf8')) as GridFile;
const hill = scene.levels.find((l) => l.id === 'hill')!, summit = scene.levels.find((l) => l.id === 'summit')!;
const outer = scene.levels.find((l) => l.id === 'outer')!;
type Dims = Record<string, number>;

/** A level's land as drawn: world height (ft) at plan (x, z). Every level draws the same land (checked below), so its
 *  heights are read once. */
const landDims = hill.objects.find((x) => x.kind === 'hill-land')!.dims as Dims, landFn = hillLandAt(landDims);
function landOf(l: Level) {
  const o = l.objects.find((x) => x.kind === 'hill-land')!;
  return { o, at: (x: number, z: number) => landFn(x - o.pos[0], z - o.pos[2]) + o.pos[1] + l.elevationFt };
}
const H = landOf(hill);
const ext = (o: { pos: number[]; dims?: Dims }) => ({ x0: o.pos[0], z0: o.pos[2], x1: o.pos[0] + o.dims!.nx * o.dims!.cell, z1: o.pos[2] + o.dims!.nz * o.dims!.cell });
const E = ext(H.o);
const floorOf = (l: Level) => [...grid.levels[l.id].floorPolygons, ...l.rooms.map((r) => r.polygon)] as Vec2[][];
/** The hill level's fence: the invisible walls round the hill's foot, as one closed loop. */
const fence = hill.walls.filter((w) => w.flags.includes('invisible'));
const fenceLoop = fence.map((w) => w.a as Vec2);
const segDist = (x: number, z: number, a: Vec2, b: Vec2) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
/** The backdrop draws its moon and halo on canvases: a stand-in 2D canvas for node (nothing here looks at them). */
function stubCanvas(): void {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return;
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  g.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
}

describe('Yester Hill is a hill', () => {
  it('every kind the two maps use is in the kit', () => {
    const scenes = ['locations/ch14/Y/scene.json', 'locations/ch12/W/scene.json'].map((f) => JSON.parse(readFileSync(f, 'utf8')) as SceneFile);
    const kinds = new Set(scenes.flatMap((sc) => sc.levels.flatMap((l) => l.objects.map((o) => o.kind))));
    for (const k of ['hill-land', 'hill-track', 'hill-patch', 'hill-pine', 'hill-dead-tree', 'cairn', 'black-boulder', 'fog-wall', 'strahd-effigy', 'gulthias-tree', 'vine-row', 'fermentation-vat']) {
      expect(kinds.has(k), k).toBe(true); expect(typeof PROPS_V1[k], k).toBe('function');
    }
  });
  it('the land climbs some 270 ft from the forest floor to a broad top, its slopes no steeper than about 1 in 2', () => {
    // the tracks and the trail are cut into the slope: their banks are steeper than the land round them
    const lines = hill.objects.filter((o) => o.kind === 'hill-track').map((o) => Array.from({ length: o.dims!.n }, (_, i) => [o.dims!['x' + i], o.dims!['z' + i]] as Vec2));
    const nearLine = (x: number, z: number) => lines.some((l) => l.some(([px, pz], i) => i > 0 && segDist(x, z, l[i - 1], [px, pz]) < 40));   // a deep cut's bank reaches a way out
    let lo = Infinity, hi = -Infinity, steep = 0, worst = 0, n = 0;
    for (let x = E.x0; x < E.x1 - 10; x += 10) for (let z = E.z0 + ((x - E.x0) % 20); z < E.z1 - 10; z += 20) {   // every other cell
      const h = H.at(x + 5, z + 5); lo = Math.min(lo, h); hi = Math.max(hi, h); n++;
      const g = Math.hypot(H.at(x + 10, z + 5) - H.at(x, z + 5), H.at(x + 5, z + 10) - H.at(x + 5, z)) / 10;
      worst = Math.max(worst, g);
      if (g > 0.56 && !nearLine(x + 5, z + 5)) steep++;
    }
    expect(lo).toBeGreaterThan(-0.2);                    // never under the forest floor (the level's own ground)
    expect(hi).toBeGreaterThan(265);
    expect(steep, 'cells steeper than 0.56 away from the tracks and the trail').toBe(0);
    expect(worst, 'the banks cut for the tracks and the trail').toBeLessThan(0.8);
  });
  it('the land reaches the forest floor before it ends, all round', () => {
    for (let x = E.x0; x <= E.x1; x += 10) for (const z of [E.z0 + 0.5, E.z1 - 0.5]) expect(Math.abs(H.at(x, z)), `${x},${z}`).toBeLessThan(0.1);
    for (let z = E.z0; z <= E.z1; z += 10) for (const x of [E.x0 + 0.5, E.x1 - 0.5]) expect(Math.abs(H.at(x, z)), `${x},${z}`).toBeLessThan(0.1);
  });
  it('every level draws the same land, the hill\'s own', () => {
    expect(scene.levels.length).toBe(5);
    for (const l of scene.levels) {
      const o = landOf(l).o;
      expect(o.dims, l.id).toEqual(landDims);
      expect(l.elevationFt + o.pos[1], l.id).toBeCloseTo(hill.elevationFt + H.o.pos[1], 3);
    }
  });
  it('every prop stands on the land, on every level (on its level\'s floor where it has one)', () => {
    const SKIP = ['hill-land', 'hill-track', 'hill-patch', 'note', 'spawn', 'fog-wall'], HIGH = ['summit-gem'];   // the gem is in the effigy's chest
    for (const l of scene.levels) {
      const land = landOf(l), rooms = l.rooms.map((r) => r.polygon as Vec2[]);
      const patches = l.objects.filter((o) => o.kind === 'hill-patch').map((o) => Array.from({ length: o.dims!.n }, (_, i) => [o.dims!['x' + i], o.dims!['z' + i]] as Vec2));
      for (const o of l.objects) {
        if (SKIP.includes(o.kind) || HIGH.includes(o.id)) continue;
        let g = land.at(o.pos[0], o.pos[2]);
        if (rooms.some((p) => pointInPolygon([o.pos[0], o.pos[2]], p))) g = Math.max(g, l.elevationFt);
        else if (patches.some((p) => pointInPolygon([o.pos[0], o.pos[2]], p))) g += 0.15;
        expect(Math.abs(l.elevationFt + o.pos[1] - g), `${l.id} ${o.id}`).toBeLessThan(1);
      }
    }
  });
  it('each ring of cairns keeps its contour', () => {
    const ys = hill.objects.filter((o) => o.kind === 'cairn').map((o) => o.pos[1]).sort((a, b) => a - b);
    let cut = 1; for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > ys[cut] - ys[cut - 1]) cut = i;
    for (const ring of [ys.slice(0, cut), ys.slice(cut)]) { expect(ring.length).toBeGreaterThan(30); expect(ring[ring.length - 1] - ring[0]).toBeLessThan(2); }
  });
  it('the trail climbs from the forest floor to the top at no more than 1 in 5', () => {
    const d = hill.objects.find((o) => o.id === 'hill-trail')!.dims!;
    let worst = 0;
    for (let i = 1; i < d.n; i++) worst = Math.max(worst, (d['y' + i] - d['y' + (i - 1)]) / Math.hypot(d['x' + i] - d['x' + (i - 1)], d['z' + i] - d['z' + (i - 1)]));
    expect(worst).toBeLessThanOrEqual(0.2001);
    expect(d['y0']).toBeLessThan(1.5);
    expect(d['y' + (d.n - 1)]).toBeGreaterThan(260);
  });
});

describe('Yester Hill: a token always stands on the ground', () => {
  it('the hill level: players walk the forest floor round the foot; a closed fence keeps them off the slope', () => {
    expect(fence.length).toBeGreaterThan(60);
    for (let k = 0; k < fence.length; k++) expect(fence[k].b).toEqual(fence[(k + 1) % fence.length].a);
    const floor = floorOf(hill);
    // everywhere a player can stand (on the floor, outside the fence) the land is the level's own ground
    let n = 0;
    for (let x = E.x0 + 2.5; x < E.x1; x += 25) for (let z = E.z0 + 2.5; z < E.z1; z += 25) {
      if (!floor.some((p) => pointInPolygon([x, z], p)) || pointInPolygon([x, z], fenceLoop)) continue;
      expect(Math.abs(H.at(x, z) - hill.elevationFt), `${x},${z}`).toBeLessThan(0.4); n++;
    }
    expect(n).toBeGreaterThan(2000);
    // the rooms, the spawn and the stair up all lie on that floor
    for (const r of hill.rooms) for (const p of r.polygon) expect(pointInPolygon(p as Vec2, fenceLoop), r.key).toBe(false);
    const spawn = hill.objects.find((o) => o.kind === 'spawn')!, link = scene.links.find((k) => k.from.level === 'hill')!;
    for (const p of [[spawn.pos[0], spawn.pos[2]], link.from.pos] as Vec2[]) { expect(pointInPolygon(p, fenceLoop)).toBe(false); expect(Math.abs(H.at(p[0], p[1]))).toBeLessThan(0.4); }
  });
  it('the hill level: the party walks the forest floor at the trail\'s foot and by the fog, never up the slope', () => {
    // walking is checked inside a window round each place (the whole level's floor is the lattice: a slow search)
    const walls = moveBlockers(hill.walls), link = scene.links.find((k) => k.from.level === 'hill')!;
    const win = (x: number, z: number, r: number): Vec2[][] => [[[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]]];
    const [lx, lz] = link.from.pos as Vec2, ne = win(lx, lz, 300);
    expect(canWalk([lx, lz], [lx + 120, lz - 40], walls, ne)).toBe(true);                // on along the forest floor
    expect(canWalk([lx, lz], [lx - 200, lz + 260], walls, ne)).toBe(false);              // up the east slope
    expect(H.at(lx - 200, lz + 260)).toBeGreaterThan(20);
    const y5 = bounds([hill.rooms.find((r) => r.key === 'Y5')!.polygon as Vec2[]]), cx = (y5.minX + y5.maxX) / 2, cz = (y5.minZ + y5.maxZ) / 2, w = win(cx, cz, 300);
    expect(canWalk([cx, cz - 250], [cx, cz], walls, w)).toBe(true);                      // along the fog's foot
    expect(canWalk([cx, cz], [cx + 260, cz], walls, w)).toBe(false);                     // up the west slope
    expect(H.at(cx + 260, cz)).toBeGreaterThan(20);
  });
  it('every level above the forest floor: its floor (the summit\'s flat top and inner track, a landing on the trail, the outer track) lies on the land', () => {
    // the turf a hair under the grid; under a keyed floor (a foot-thick slab: the tracks, the ring's earth) a bench up to
    // a foot lower is covered
    for (const l of scene.levels.filter((x) => x !== hill)) {
      let n = 0;
      const land = landOf(l), rooms = l.rooms.map((r) => r.polygon as Vec2[]);
      for (const p of floorOf(l)) {
        const b = bounds([p]), st = l === summit ? 12 : l === outer ? 5 : 2;   // a landing's few hundred square feet finely
        for (let x = b.minX + 1; x < b.maxX; x += st) for (let z = b.minZ + 1; z < b.maxZ; z += st) {
          if (!pointInPolygon([x, z], p)) continue;
          const d = l.elevationFt - land.at(x, z);
          expect(d, `${l.id} ${x},${z}`).toBeGreaterThan(0.3);
          expect(d, `${l.id} ${x},${z}`).toBeLessThan(rooms.some((r) => pointInPolygon([x, z], r)) ? 1.2 : 0.8); n++;
        }
      }
      expect(n, l.id).toBeGreaterThan(l === summit ? 3000 : 100);
    }
    const link = scene.links.find((k) => k.to.level === 'summit')!;
    expect(floorOf(summit).some((p) => pointInPolygon(link.to.pos as Vec2, p))).toBe(true);
    // its battle ground is at least as big as the old flat inset's (680 x 815 ft)
    const area = (p: Vec2[]) => Math.abs(p.reduce((a, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return a + x * z2 - x2 * z; }, 0)) / 2;
    expect(Math.max(...grid.levels.summit.floorPolygons.map((p) => area(p as Vec2[])))).toBeGreaterThan(480_000);
  });
});

describe('Yester Hill: the party climbs the trail', () => {
  // the trail up, stretch by stretch: forest floor, lower landing, upper landing, outer track, summit
  const ORDER = ['hill', 'slope-low', 'slope-high', 'outer', 'summit'];
  const lv = (id: string) => scene.levels.find((l) => l.id === id)!;
  it('the levels rise one stretch of the trail at a time, none more than about 100 ft above the one below', () => {
    expect(scene.levels.map((l) => l.id).sort()).toEqual([...ORDER].sort());
    for (let k = 0; k + 1 < ORDER.length; k++) {
      const a = lv(ORDER[k]), b = lv(ORDER[k + 1]);
      const links = scene.links.filter((x) => (x.from.level === a.id && x.to.level === b.id) || (x.to.level === a.id && x.from.level === b.id));
      expect(links.length, `${a.id} -> ${b.id}`).toBe(1);
      expect(links[0].from.level, links[0].id).toBe(a.id);                       // each link runs up the hill
      expect(b.elevationFt - a.elevationFt, `${a.id} -> ${b.id}`).toBeGreaterThan(10);
      expect(b.elevationFt - a.elevationFt, `${a.id} -> ${b.id}`).toBeLessThan(100);
    }
    expect(scene.links.length).toBe(ORDER.length - 1);
  });
  it('each link stands on its level\'s floor, and on each level the party walks from the stair it came up to the next one', () => {
    for (const k of scene.links) for (const end of [k.from, k.to]) expect(floorOf(lv(end.level)).some((p) => pointInPolygon(end.pos as Vec2, p)), `${k.id} ${end.level}`).toBe(true);
    for (let k = 1; k + 1 < ORDER.length; k++) {
      const l = lv(ORDER[k]), arrive = scene.links.find((x) => x.to.level === l.id)!.to.pos as Vec2, leave = scene.links.find((x) => x.from.level === l.id)!.from.pos as Vec2;
      // far enough apart that arriving by one never takes the other (a stair is taken within 5.5 ft of its end)
      expect(Math.hypot(arrive[0] - leave[0], arrive[1] - leave[1]), l.id).toBeGreaterThan(15);
      const r = Math.hypot(arrive[0] - leave[0], arrive[1] - leave[1]) + 40, mid: Vec2 = [(arrive[0] + leave[0]) / 2, (arrive[1] + leave[1]) / 2];
      const floor = floorOf(l).filter((p) => p.some((q) => Math.abs(q[0] - mid[0]) < r && Math.abs(q[1] - mid[1]) < r));
      expect(canWalk(arrive, leave, moveBlockers(l.walls), floor), l.id).toBe(true);
    }
  });
  it('the outer track is a level of its own: the party walks it all round, past Kavan\'s cairn among the cairns on its verge', () => {
    const arrive = scene.links.find((x) => x.to.level === 'outer')!.to.pos as Vec2, walls = moveBlockers(outer.walls), floor = floorOf(outer);
    const sectors = outer.rooms.filter((r) => r.key.startsWith('Y2-outer'));
    expect(sectors.map((r) => r.key.slice(8)).sort()).toEqual(['east', 'north', 'northwest', 'south', 'southeast', 'southwest']);
    for (const r of sectors) {
      const p = r.polygon as Vec2[], mid: Vec2 = [(p[10][0] + p[p.length - 11][0]) / 2, (p[10][1] + p[p.length - 11][1]) / 2];
      expect(canWalk(arrive, mid, walls, floor), r.key).toBe(true);
      expect(Math.abs(outer.elevationFt - landOf(outer).at(mid[0], mid[1])), r.key).toBeLessThan(1.2);
    }
    const kavan = outer.objects.find((o) => o.id.endsWith('kavan'))!, cairns = outer.objects.filter((o) => o.kind === 'cairn');
    expect(kavan.key).toBe('Y2-outersouthwest');
    expect(Math.min(...cairns.map((c) => Math.hypot(c.pos[0] - kavan.pos[0], c.pos[2] - kavan.pos[2])))).toBeLessThan(12);
    // the cairn stands by the track: a step off the track's floor
    expect(floor.some((p) => pointInPolygon([kavan.pos[0], kavan.pos[2]], p))).toBe(false);
    const toward = sectors.find((r) => r.key === 'Y2-outersouthwest')!.polygon as Vec2[];
    expect(Math.min(...toward.map((q) => Math.hypot(q[0] - kavan.pos[0], q[1] - kavan.pos[2])))).toBeLessThan(15);
  });
});

describe('Yester Hill: the land beyond the map, the fog of war and the fog', () => {
  it('the land drawn beyond the map (built as the app builds it) meets the map\'s land at its edge with no step', () => {
    stubCanvas();
    const camp = CAMPAIGNS.find((c) => c.prefixes.includes('ch14'))!, world = worldOf(camp);
    const pin = world.pins.find((p) => p.scenes?.includes('ch14/Y'))!;
    const bb = bounds([...hill.rooms.map((r) => r.polygon), ...(hill.terrain ?? []).map((t) => t.polygon)]);
    const bd = buildBackdrop({ ground: 'grass', center: [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], radius: Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2, elevation: hill.elevationFt, pin: pin.pos as Vec2, world, theme: camp.theme, bounds: bb, north: hill.north, roads: [], crag: pin.heightFt ?? 0 });
    const land = bd.getObjectByName('land')!, ray = new THREE.Raycaster();
    bd.updateMatrixWorld(true);
    const at = (x: number, z: number) => { ray.set(new THREE.Vector3(x, 5000, z), new THREE.Vector3(0, -1, 0)); return ray.intersectObject(land)[0]?.point.y; };
    let worst = 0, n = 0;
    for (let t = 0.02; t < 0.99; t += 0.04) {
      const x = E.x0 + (E.x1 - E.x0) * t, z = E.z0 + (E.z1 - E.z0) * t;
      for (const [px, pz, dx, dz] of [[x, E.z0, 0, -1], [x, E.z1, 0, 1], [E.x0, z, -1, 0], [E.x1, z, 1, 0]]) {
        const out = at(px + dx * 4, pz + dz * 4); expect(out, `${px},${pz}`).toBeDefined();
        worst = Math.max(worst, Math.abs(out! - H.at(px - dx * 0.5, pz - dz * 0.5))); n++;
      }
    }
    expect(n).toBeGreaterThan(90);
    expect(worst).toBeLessThan(0.25);
  });
  it('the hill\'s scenery is never under the fog of war (it is seen from both levels, like the land beyond the map)', () => {
    const open = (o: THREE.Object3D) => { let all = true, n = 0; o.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; n++; if (!(m.material as THREE.Material).userData.fogExempt?.value) all = false; }); return n > 0 && all; };
    const KINDS = ['hill-land', 'hill-track', 'hill-patch', 'hill-pine', 'hill-dead-tree', 'cairn', 'black-boulder', 'strahd-effigy', 'gulthias-tree', 'dead-shrub', 'fog-wall'];
    const ALWAYS = ['hill-land', 'hill-track', 'hill-patch', 'hill-pine', 'hill-dead-tree', 'fog-wall'];   // the rest ask for it (dims.open)
    for (const k of KINDS) {
      const o = hill.objects.find((x) => x.kind === k)!;          // one of each: they are built alike
      expect(open((PROPS_V1[k] as (d: Dims) => THREE.Object3D)((o.dims ?? {}) as Dims)), o.id).toBe(true);
    }
    for (const l of scene.levels) for (const o of l.objects) if (KINDS.includes(o.kind) && !ALWAYS.includes(o.kind)) expect(o.dims?.open, `${l.id} ${o.id}`).toBe(1);
  });
  it('the fog wall stands on the forest floor west of the hill, runs past both ends of the land, and every sheet fades out at its top and foot', () => {
    const fog = hill.objects.filter((o) => o.kind === 'fog-wall');
    expect(fog.length).toBe(1);
    const f = fog[0], d = f.dims!;
    expect(f.pos[0]).toBeLessThan(E.x0 + 20);
    expect(Math.abs(f.pos[1] - H.at(f.pos[0] + 10, f.pos[2]))).toBeLessThan(0.1);
    expect(f.pos[2] - d.len / 2 - d.ext).toBeLessThan(E.z0 - 300); expect(f.pos[2] + d.len / 2 + d.ext).toBeGreaterThan(E.z1 + 300);
    const g = (PROPS_V1['fog-wall'] as (d: Dims) => THREE.Object3D)(d as Dims);
    let top = 0, foot = 0, most = 0, n = 0;
    g.traverse((c) => {
      const m = c as THREE.Mesh; if (!m.isMesh) return;
      const pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
      expect(col.itemSize).toBe(4);
      let ymax = 0; for (let i = 0; i < pos.count; i++) ymax = Math.max(ymax, pos.getY(i));
      for (let i = 0; i < pos.count; i++) { const a = col.getW(i); most = Math.max(most, a); n++; if (pos.getY(i) < -1.4) foot = Math.max(foot, a); }
      // the highest vertices of each sheet are clear
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > ymax * 0.98) top = Math.max(top, col.getW(i));
    });
    expect(n).toBeGreaterThan(1000);
    expect(most).toBeGreaterThan(0.3);
    expect(top).toBeLessThan(0.01);
    expect(foot).toBeLessThan(0.01);
  });
});
