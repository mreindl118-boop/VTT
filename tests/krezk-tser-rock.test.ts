// Queue item 2f-2: Krezk's crag and Tser Falls' gorge — realistic in scale and texture.
// - Krezk (locations/ch08/S): the abbey's hill is a steep hill in proportion to the village (not a 400–720 ft tower of
//   rock), the slope is walkable where the switchback road (S5) climbs, and the rock face uses broken rock ('rock'
//   surface) without stretched vertical cells or dozens of horizontal stripes.
// - Tser Falls (locations/ch02/H): the gorge is two rock masses the falls cut through (north and south of the chasm and
//   pool, in proportion to the bridge and camp), the cauldron/ledge gorge walls are solid rock masses rather than thin
//   vertical ribbons, boulders are realistically sized, and all gorge/slab/cliff rock colours use the 'rock' surface.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GridFile, Level, SceneFile } from '../app/src/core/schema';
import { surfaceOf } from '../app/src/kit/surfaces';
import { PROPS_V1 } from '../app/src/kit/props';
import '../app/src/kit/sites';

type Vec2 = [number, number];
type Polygon = Vec2[];

const ROOT = join(__dirname, '..');
const loadScene = (rel: string) => JSON.parse(readFileSync(join(ROOT, 'locations', rel, 'scene.json'), 'utf8')) as SceneFile;
const loadGrid = (rel: string) => JSON.parse(readFileSync(join(ROOT, 'locations', rel, 'grid.json'), 'utf8')) as GridFile;

function inPoly([x, z]: Vec2, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function decodeHeightfield(d: Record<string, number>) {
  const nx = d.nx ?? 10, nz = d.nz ?? 10, cell = d.cell ?? 10, q = d.q ?? 0.5, drop = d.drop ?? 0;
  const W = nx + 1, H: (number | null)[] = new Array(W * (nz + 1)).fill(null);
  for (let k = 0; k < H.length; k++) {
    const v = d[`d${k >> 2}`];
    if (v === undefined) continue;
    const c = Math.floor(v / Math.pow(4096, k & 3)) % 4096;
    if (c !== 4095) H[k] = c * q - drop;
  }
  return { nx, nz, cell, W, H };
}

describe('rock surface grain (app/src/kit/surfaces.ts)', () => {
  it('maps Krezk hill rock and Tser Falls gorge, chasm and slab rock colours to the broken rock surface', () => {
    const krezkRock = ['#5b5752', '#4a4a52', '#55535a', '#6b6760'];
    const tserGorgeRock = [
      '#5d5b55', '#4e4c47', '#67645d',
      '#47453f', '#4a4946', '#525358', '#606369', '#757980',
      '#3b3a37', '#45454a', '#55585d', '#6c7076', '#868b91',
      '#2f302f', '#383a3e', '#474b51', '#5d6269', '#787e85',
      '#3b3a36', '#3d3e3d', '#454850', '#53575e', '#6a6f77',
      '#58544f', '#44413d', '#6c6760', '#343230',
    ];
    for (const hex of [...krezkRock, ...tserGorgeRock]) {
      expect(surfaceOf(hex), `surfaceOf(${hex})`).toBe('rock');
    }
  });
});

describe("Krezk's abbey hill and rock face (locations/ch08/S)", () => {
  const scene = loadScene('ch08/S');
  const grid = loadGrid('ch08/S');
  const village = scene.levels.find((l) => l.id === 'village') as Level;
  const ledge = scene.levels.find((l) => l.id === 'ledge') as Level;

  it('places the abbey on a steep hill in proportion to the village, not a hundreds-of-feet rock tower', () => {
    expect(ledge.elevationFt).toBeGreaterThanOrEqual(60);
    expect(ledge.elevationFt).toBeLessThanOrEqual(120);

    const mountain = village.objects.find((o) => o.id === 'land-mountain')!;
    const cliff = village.objects.find((o) => o.id === 'land-cliff')!;
    const mVals = decodeHeightfield(mountain.dims!).H.filter((h): h is number => h !== null);
    const cVals = decodeHeightfield(cliff.dims!).H.filter((h): h is number => h !== null);
    const maxH = Math.max(...mVals, ...cVals);
    expect(maxH).toBeGreaterThanOrEqual(ledge.elevationFt + 20);
    expect(maxH).toBeLessThanOrEqual(160);
  });

  it('keeps the cliff heightfield free of stretched vertical cutting cells and multi-hundred-foot horizontal banding', () => {
    const cliff = village.objects.find((o) => o.id === 'land-cliff')!;
    const { nx, nz, W, H } = decodeHeightfield(cliff.dims!);
    let maxStep = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = H[j * W + i], b = H[j * W + i + 1], c = H[(j + 1) * W + i];
        if (a !== null && b !== null && a >= 0 && b >= 0) maxStep = Math.max(maxStep, Math.abs(b - a));
        if (a !== null && c !== null && a >= 0 && c >= 0) maxStep = Math.max(maxStep, Math.abs(c - a));
      }
    }
    // On a 5-ft lattice, a cell step <= 11 ft keeps triangle aspect ratios near 1:1..2:1 instead of stretched vertical ribbons.
    expect(maxStep).toBeLessThanOrEqual(11);

    const group = PROPS_V1.heightfield(cliff.dims!);
    let rockMinY = Infinity, rockMaxY = -Infinity;
    group.traverse((obj: any) => {
      if (!obj.isMesh) return;
      const hex = '#' + obj.material.color.getHexString();
      if (['#4a4a52', '#5b5752', '#55535a'].includes(hex)) {
        expect(surfaceOf(hex)).toBe('rock');
        const pos = obj.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const y = pos.getY(k);
          if (y >= 0) {
            rockMinY = Math.min(rockMinY, y);
            rockMaxY = Math.max(rockMaxY, y);
          }
        }
      }
    });
    expect(rockMaxY - rockMinY).toBeLessThanOrEqual(65);
  });

  it('makes the slope walkable where the switchback road (S5) climbs', () => {
    const road = village.objects.find((o) => o.id === 'S5-road')!;
    const d = road.dims!;
    const n = d.n ?? 0;
    expect(n).toBeGreaterThanOrEqual(10);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([d[`x${i}`], d[`z${i}`], d[`y${i}`]]);

    let maxGrade = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0, y0] = pts[i - 1], [x1, z1, y1] = pts[i];
      const run = Math.hypot(x1 - x0, z1 - z0);
      if (run > 1e-3) maxGrade = Math.max(maxGrade, Math.abs(y1 - y0) / run);
    }
    expect(maxGrade).toBeLessThanOrEqual(0.22);

    const walkablePolys: Polygon[] = [
      ...grid.levels.village.floorPolygons,
      ...village.rooms.map((r) => r.polygon),
    ];
    const uncovered = pts.filter(([x, z]) => !walkablePolys.some((poly) => inPoly([x, z], poly)));
    expect(uncovered, 'road points outside walkable floor polygons').toEqual([]);
  });
});

describe("Tser Falls' gorge rock masses and boulders (locations/ch02/H)", () => {
  const scene = loadScene('ch02/H');
  const deck = scene.levels.find((l) => l.id === 'deck') as Level;
  const ledge = scene.levels.find((l) => l.id === 'ledge') as Level;
  const pool = scene.levels.find((l) => l.id === 'pool') as Level;

  it('frames the gorge on the deck with two rock masses (north and south of the falls and chasm) in proportion to the bridge', () => {
    const crags = deck.objects.filter((o) => o.kind === 'crag');
    expect(crags.length).toBeGreaterThanOrEqual(12);
    const heights = crags.map((o) => o.dims?.h ?? 0);
    expect(Math.max(...heights)).toBeLessThanOrEqual(60);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(16);

    // Chasm / tarn centerline z at x: tarn & sill ~ 245..253 for x <= 190, then sloping south-east to 418 at x = 600
    const gorgeZ = (x: number) => (x <= 190 ? 248 : 253 + ((x - 190) / (600 - 190)) * (418 - 253));
    const northMass = crags.filter((o) => {
      const [x, , z] = o.pos, gz = gorgeZ(x);
      return x >= 35 && x <= 565 && z < gz - 20 && z >= gz - 155;
    });
    const southMass = crags.filter((o) => {
      const [x, , z] = o.pos, gz = gorgeZ(x);
      return x >= 35 && x <= 565 && z > gz + 20 && z <= gz + 155;
    });
    expect(northMass.length, 'north gorge rock mass crags').toBeGreaterThanOrEqual(6);
    expect(southMass.length, 'south gorge rock mass crags').toBeGreaterThanOrEqual(6);
    // South rock mass must flank both the falls head (x < 240) and the gorge rib east of the bridge (x > 290)
    expect(southMass.filter((o) => o.pos[0] < 240).length).toBeGreaterThanOrEqual(3);
    expect(southMass.filter((o) => o.pos[0] > 290).length).toBeGreaterThanOrEqual(3);
  });

  it('builds the cauldron and ledge gorge walls as solid rock masses rather than thin vertical ribbons', () => {
    const poolWalls = pool.objects.filter((o) => o.kind === 'h-cauldron-wall');
    // Two rock masses (north and south of the falls) rather than a single thin ribbon wrapping behind the falls
    expect(poolWalls.length).toBeGreaterThanOrEqual(2);
    for (const w of poolWalls) {
      const cut = w.dims?.cut ?? 0, h = w.dims?.h ?? 900;
      expect(cut, `${w.id} cut`).toBeGreaterThanOrEqual(45);
      expect(h, `${w.id} h`).toBeLessThanOrEqual(120);
      expect(cut / h, `${w.id} solid cut ratio`).toBeGreaterThanOrEqual(0.7);
    }

    const ledgeWalls = ledge.objects.filter((o) => o.kind === 'h-cauldron-wall');
    expect(ledgeWalls.length).toBeGreaterThanOrEqual(1);
    for (const w of ledgeWalls) {
      const cut = w.dims?.cut ?? 0, h = w.dims?.h ?? 900;
      expect(cut, `${w.id} cut`).toBeGreaterThanOrEqual(35);
      expect(h, `${w.id} h`).toBeLessThanOrEqual(110);
      expect(cut / h, `${w.id} solid cut ratio`).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('keeps boulders on all levels at realistic boulder scale rather than oversized blocks', () => {
    for (const lv of [deck, ledge, pool]) {
      const boulders = lv.objects.filter((o) => o.kind === 'boulder');
      for (const b of boulders) {
        expect(b.dims?.r ?? 2.5, `${lv.id}/${b.id} radius`).toBeLessThanOrEqual(2.4);
      }
    }
    const anvil = deck.objects.find((o) => o.kind === 'h-anvil-block')!;
    expect(anvil.dims?.scale ?? 1).toBeLessThanOrEqual(0.75);
  });
});
