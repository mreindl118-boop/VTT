// Yester Hill (ch14/Y) is drawn as a hill you climb (scripts/authoring/yester-hill.py): its land is a heightfield, every
// prop stands on it, each cairn ring keeps its contour, the trail never climbs steeper than 1 in 5, the summit level's
// floor is the hilltop with its grid on the turf, and the land drawn beyond the map (kit/sites/w.ts) meets the lattice.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { yesterLand } from '../app/src/kit/sites/w';
import { PROPS_V1 } from '../app/src/kit/props';
import '../app/src/kit/sites';

type Obj = { id: string; kind: string; pos: [number, number, number]; dims?: Record<string, number>; polygon?: number[][] };
type Lvl = { id: string; elevationFt: number; objects: Obj[] };
const scene = JSON.parse(readFileSync('locations/ch14/Y/scene.json', 'utf8')) as { levels: Lvl[] };
const grid = JSON.parse(readFileSync('locations/ch14/Y/grid.json', 'utf8')) as { levels: Record<string, { floorPolygons: number[][][] }> };
const hill = scene.levels.find((l) => l.id === 'hill')!, summit = scene.levels.find((l) => l.id === 'summit')!;

/** A heightfield prop as the kit draws it (kit/sites/s.ts): heights in ft relative to the level's floor. */
function field(o: Obj, elev: number) {
  const d = o.dims!, nx = d.nx, nz = d.nz, cell = d.cell, q = d.q, W = nx + 1, H: number[] = [];
  for (let k = 0; k < W * (nz + 1); k++) { const c = Math.floor(d['d' + Math.floor(k / 4)] / 4096 ** (k % 4)) % 4096; H.push(c === 4095 ? NaN : c * q + o.pos[1] + elev); }
  const at = (x: number, z: number) => {
    const fx = (x - o.pos[0]) / cell, fz = (z - o.pos[2]) / cell, i = Math.min(Math.max(Math.floor(fx), 0), nx - 1), j = Math.min(Math.max(Math.floor(fz), 0), nz - 1), u = fx - i, v = fz - j;
    const a = H[j * W + i], b = H[j * W + i + 1], c = H[(j + 1) * W + i + 1], e = H[(j + 1) * W + i];
    if (Math.abs(a - c) < Math.abs(b - e)) return u >= v ? a + (b - a) * u + (c - b) * v : a + (c - e) * u + (e - a) * v;
    return u + v <= 1 ? a + (b - a) * u + (e - a) * v : c + (e - c) * (1 - u) + (b - c) * (1 - v);
  };
  return { at, H, W, nx, nz, cell, x0: o.pos[0], z0: o.pos[2] };
}
const land = field(hill.objects.find((o) => o.kind === 'heightfield')!, hill.elevationFt);
const inPoly = (x: number, z: number, p: number[][]) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };

describe('Yester Hill is a hill', () => {
  it('every kind the two maps use is in the kit', () => {
    const scenes = ['locations/ch14/Y/scene.json', 'locations/ch12/W/scene.json'].map((f) => JSON.parse(readFileSync(f, 'utf8')) as { levels: Lvl[] });
    const kinds = new Set(scenes.flatMap((sc) => sc.levels.flatMap((l) => l.objects.map((o) => o.kind))));
    for (const k of ['cairn', 'black-boulder', 'fog-wall', 'strahd-effigy', 'gulthias-tree', 'vine-row', 'fermentation-vat']) { expect(kinds.has(k), k).toBe(true); expect(typeof PROPS_V1[k], k).toBe('function'); }
    const fog = (PROPS_V1['fog-wall'] as (d: Record<string, number>) => { children: unknown[] })({ len: 170, h: 620, d: 900, base: 40, z0: 0, seed: 3, end: 1, ext: 400 });
    expect(fog.children.length).toBeGreaterThan(20);
  });
  it('the land climbs some 270 ft from the forest floor to a broad top, no slope steeper than about 1 in 2', () => {
    const plate = land.H.filter((_, k) => { const x = land.x0 + (k % land.W) * land.cell, z = land.z0 + Math.floor(k / land.W) * land.cell; return x >= 0 && x <= 1725 && z >= 0 && z <= 2250; });
    expect(Math.min(...plate)).toBeGreaterThanOrEqual(0.5);          // never under the level's own floor and grid
    expect(Math.max(...plate)).toBeGreaterThan(250);
    let steep = 0;
    for (let x = 0; x <= 1720; x += 10) for (let z = 0; z <= 2240; z += 10) {
      const g = Math.hypot(land.at(x + 10, z) - land.at(x, z), land.at(x, z + 10) - land.at(x, z)) / 10;
      if (g > 0.55) steep++;
    }
    expect(steep, 'cells steeper than 0.55 (cut banks of the tracks excepted, they are few)').toBeLessThan(400);
  });
  it('every prop stands on the land', () => {
    for (const o of hill.objects) {
      if (['heightfield', 'road-ribbon', 'prism', 'note', 'spawn', 'fog-wall'].includes(o.kind)) continue;
      expect(Math.abs(o.pos[1] - land.at(o.pos[0], o.pos[2])), o.id).toBeLessThan(1);
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
    expect(d['y0']).toBeLessThan(3);
    expect(d['y' + (d.n - 1)]).toBeGreaterThan(260);
  });
  it('the summit level stands on the hilltop: its floor is the turf and its grid lies on it', () => {
    const top = summit.elevationFt;
    for (const poly of grid.levels.summit.floorPolygons) for (const [x, z] of poly) expect(Math.abs(land.at(x, z) - top), `${x},${z}`).toBeLessThan(1.2);
    for (const o of summit.objects.filter((o) => o.kind === 'black-boulder' || o.kind === 'strahd-effigy')) expect(Math.abs(o.pos[1]), o.id).toBeLessThan(1);
  });
  it('the land drawn beyond the map meets the lattice at its outer edge', () => {
    let worst = 0;
    for (let i = 0; i <= land.nx; i++) for (const j of [0, land.nz]) { const x = land.x0 + i * land.cell, z = land.z0 + j * land.cell; worst = Math.max(worst, Math.abs(land.H[j * land.W + i] - yesterLand(x, z))); }
    for (let j = 0; j <= land.nz; j++) for (const i of [0, land.nx]) { const x = land.x0 + i * land.cell, z = land.z0 + j * land.cell; worst = Math.max(worst, Math.abs(land.H[j * land.W + i] - yesterLand(x, z))); }
    expect(worst).toBeLessThan(1);
  });
  it('the fog wall stands on the west rim and its pieces join end to end', () => {
    const fog = hill.objects.filter((o) => o.kind === 'fog-wall').sort((a, b) => a.pos[2] - b.pos[2]);
    expect(fog.length).toBeGreaterThan(10);
    for (const o of fog) { expect(o.pos[0]).toBeLessThan(60); expect(o.dims!.z0).toBe(o.pos[2]); }
    for (let i = 1; i < fog.length; i++) expect(fog[i].pos[2] - fog[i - 1].pos[2]).toBeCloseTo(fog[i].dims!.len, 3);
    expect(fog[0].pos[2] - fog[0].dims!.len / 2).toBeLessThan(0);
    expect(fog[fog.length - 1].pos[2] + fog[0].dims!.len / 2).toBeGreaterThan(2250);
    const inFog = fog.filter((o) => inPoly(o.pos[0], o.pos[2], [[0, 0], [1725, 0], [1725, 2250], [0, 2250]]));
    expect(inFog.length).toBeGreaterThan(8);
  });
});
