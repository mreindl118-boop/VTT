// The valley's rivers (item 2f-1a). locations/ch02/barovia-region/world.json draws each river as one polyline measured
// from the regional map by scripts/authoring/barovia-world.py, through the lakes it passes. This keeps the water joined:
// every river end lies in a lake (on or past its drawn shore, render/worldlakes.ts), on another river, or on the map's
// frame (where the river leaves the valley into the mists), but for a river's head where the page draws a spring or a
// pool the data does not carry, named below. (The Sheep Chase country's one stream stops half a mile and a mile short of
// its frame; its data is not measured here, so these rules are Barovia's.)
import { describe, expect, it } from 'vitest';
import barovia from '../locations/ch02/barovia-region/world.json';
import type { WorldData } from '../app/src/campaigns';
import { inLakeShape, lakeRing, ringSd } from '../app/src/render/worldlakes';

type Vec2 = [number, number];
const NEAR = 0.01; // miles: what "on" means for a river end
/** The river heads that rise from nothing the data draws: river name -> why. */
const HEADS: Record<string, string> = {
  'River Ivlis': 'its head is a small pool west of Tser Falls that the data does not carry',
};

const segDist = (p: Vec2, a: Vec2, b: Vec2) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
const polyDist = (p: Vec2, pts: Vec2[]) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
/** How far a point lies outside a lake as it is drawn (0 inside). */
function lakeGap(l: WorldData['lakes'][number], p: Vec2): number {
  if (inLakeShape(l, p)) return 0;
  const ring = lakeRing(l);
  if (ring) return ringSd(ring, p[0], p[1]);
  const [cx, cy] = l.center, [rx, ry] = l.r, rho = Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry);
  return (rho - 1) * Math.min(rx, ry);
}

function riverRules(name: string, data: WorldData, heads: Record<string, string>) {
  it(`${name}: every river end lies in a lake, on another river or on the frame (or is a named head)`, () => {
    const b = data.bounds, loose: string[] = [], headsSeen: string[] = [];
    data.rivers.forEach((r, i) => {
      for (const e of [r.pts[0], r.pts[r.pts.length - 1]] as Vec2[]) {
        const lake = Math.min(Infinity, ...data.lakes.map((l) => lakeGap(l, e)));
        const river = Math.min(Infinity, ...data.rivers.filter((_, j) => j !== i).map((o) => polyDist(e, o.pts as Vec2[])));
        const frame = Math.min(e[0] - b.minX, b.maxX - e[0], e[1] - b.minY, b.maxY - e[1]);
        if (lake <= NEAR || river <= NEAR || frame <= NEAR) continue;
        if (heads[r.name] && !headsSeen.includes(r.name)) { headsSeen.push(r.name); continue; }
        loose.push(`${r.name} at [${e}]: ${lake.toFixed(3)} mi from a lake, ${river.toFixed(3)} from a river, ${frame.toFixed(3)} from the frame`);
      }
    });
    expect(loose, 'river ends on nothing').toEqual([]);
    expect(headsSeen.sort(), 'every named head is a river\'s loose end').toEqual(Object.keys(heads).sort());
  });
}

describe('the world rivers stay joined', () => {
  riverRules('Barovia', barovia as unknown as WorldData, HEADS);
  it('Barovia: the River Ivlis is one river through the Tser Pool, and the camp\'s pool runs into it', () => {
    const data = barovia as unknown as WorldData;
    expect(data.rivers.filter((r) => /Ivlis/.test(r.name)).map((r) => r.name)).toEqual(['River Ivlis']);
    const pool = data.lakes.find((l) => l.name === 'Tser Pool')!, outlet = data.rivers.find((r) => r.name === 'Tser Pool outlet')!;
    expect(inLakeShape(pool, outlet.pts[0] as Vec2)).toBe(true);
    expect(polyDist(outlet.pts[outlet.pts.length - 1] as Vec2, data.rivers.find((r) => r.name === 'River Ivlis')!.pts as Vec2[])).toBeLessThan(1e-4);
  });
});
